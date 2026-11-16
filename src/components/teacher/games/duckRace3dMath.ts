import { StudentCandidate } from '../studentCallRules';
import { cryptoRandomInt } from './wheel3dMath';

export type DuckRace3DState =
  | 'IDLE'
  | 'READY'
  | 'COUNTDOWN'
  | 'RACING'
  | 'PAUSED'
  | 'FINISHING'
  | 'RESULT'
  | 'RESET';

export type DuckRaceDurationSec = 5 | 10 | 15;

export type DuckRaceCameraMode = 'OVERVIEW' | 'FOLLOW_PACK' | 'FINISH_CLOSEUP';

export type DuckRaceHeatMode = 'REPRESENTATIVE_FAIR' | 'BRACKET_HEATS';

export type DuckRaceQualityPreset = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DuckPalette {
  id: string;
  nameVi: string;
  bodyHex: string;
  wingHex: string;
  goggleHex: string;
  beakHex: string;
  badgeHex: string;
}

export const DUCK_RACE_PALETTES: DuckPalette[] = [
  {
    id: 'gold',
    nameVi: 'Vàng Nắng',
    bodyHex: '#FFCC33',
    wingHex: '#F59E0B',
    goggleHex: '#10294A',
    beakHex: '#FF6B1A',
    badgeHex: '#F59E0B',
  },
  {
    id: 'ocean',
    nameVi: 'Xanh Biển',
    bodyHex: '#009FE3',
    wingHex: '#0284C7',
    goggleHex: '#FFCC33',
    beakHex: '#FF7A1A',
    badgeHex: '#0284C7',
  },
  {
    id: 'coral',
    nameVi: 'Cam San Hô',
    bodyHex: '#FF7849',
    wingHex: '#EA580C',
    goggleHex: '#FFFFFF',
    beakHex: '#FFCC33',
    badgeHex: '#EA580C',
  },
  {
    id: 'emerald',
    nameVi: 'Ngọc Lục',
    bodyHex: '#10B981',
    wingHex: '#059669',
    goggleHex: '#10294A',
    beakHex: '#FF8A1E',
    badgeHex: '#059669',
  },
  {
    id: 'violet',
    nameVi: 'Tím Hoàng Gia',
    bodyHex: '#8B5CF6',
    wingHex: '#7C3AED',
    goggleHex: '#FFCC33',
    beakHex: '#FF7A1A',
    badgeHex: '#7C3AED',
  },
  {
    id: 'pink',
    nameVi: 'Hồng Phấn',
    bodyHex: '#EC4899',
    wingHex: '#DB2777',
    goggleHex: '#FFFFFF',
    beakHex: '#FF9E1B',
    badgeHex: '#DB2777',
  },
  {
    id: 'cyan',
    nameVi: 'Xanh Ngọc',
    bodyHex: '#14C9E5',
    wingHex: '#0891B2',
    goggleHex: '#10294A',
    beakHex: '#FF701A',
    badgeHex: '#0891B2',
  },
  {
    id: 'crimson',
    nameVi: 'Đỏ Đua',
    bodyHex: '#EF4444',
    wingHex: '#DC2626',
    goggleHex: '#FFCC33',
    beakHex: '#FFA41B',
    badgeHex: '#DC2626',
  },
];

export const MAX_DUCK_LANES = 8;
export const TRACK_START_X = -13;
export const TRACK_FINISH_X = 13;
export const TRACK_LENGTH = TRACK_FINISH_X - TRACK_START_X; // 26 world units
export const LANE_SPACING = 1.9;
export const COUNTDOWN_TOTAL_MS = 2800; // 3 (900ms) -> 2 (900ms) -> 1 (900ms) -> GO trigger
export const FINISHING_SLOWMO_MS = 1350;
const KINEMATIC_SAMPLES = 64;

export interface DuckRacerEntry {
  laneIndex: number; // 0 .. laneCount - 1
  laneNumber: number; // 1 .. laneCount
  laneZ: number;
  student: StudentCandidate;
  safeName: string;
  safeCode: string;
  displayLabel: string; // Disambiguated if duplicate names exist
  sttNumber: number;
  formattedStt: string;
  palette: DuckPalette;
  isWinner: boolean;
  targetFinishProgress: number; // 1.0 for winner, < 0.975 for others
  progressSamples: number[]; // length = KINEMATIC_SAMPLES + 1, strictly non-decreasing
  wingPhaseOffset: number;
  bobPhaseOffset: number;
}

export interface DuckRaceTurnPlan {
  turnId: string;
  createdAtMs: number;
  durationSec: DuckRaceDurationSec;
  durationMs: number;
  heatMode: DuckRaceHeatMode;
  heatIndex: number;
  totalHeats: number;
  winner: StudentCandidate;
  winnerLaneIndex: number;
  winnerSttNumber: number;
  winnerDisplayLabel: string;
  racers: DuckRacerEntry[];
}

export interface DuckFrameState {
  laneIndex: number;
  progress: number; // 0..1
  x: number;
  z: number;
  speedNorm: number; // instantaneous normalized speed factor
  isLeading: boolean;
}

/**
 * Unbiased Fisher-Yates shuffle using cryptoRandomInt (no modulo bias, no sort bias).
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

/**
 * Normalize missing/blank student name or code safely without mutating source objects.
 */
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

/**
 * Format compact yet unmistakable Vietnamese name for 3D lane nameplates,
 * preserving full distinction when two students share the same fullName.
 */
export function formatLaneDisplayLabel(
  safeName: string,
  formattedStt: string,
  hasDuplicateName: boolean
): string {
  const maxLen = hasDuplicateName ? 18 : 22;
  const shortened =
    safeName.length > maxLen ? `${safeName.slice(0, maxLen - 1).trimEnd()}…` : safeName;
  return hasDuplicateName ? `#${formattedStt} · ${shortened}` : shortened;
}

/**
 * Partition eligible students into balanced heats of at most `maxPerHeat` (8).
 */
export function computeHeatBuckets(
  eligibleStudents: readonly StudentCandidate[],
  maxPerHeat: number = MAX_DUCK_LANES
): StudentCandidate[][] {
  if (eligibleStudents.length === 0) return [];
  const cap = Math.max(1, Math.min(MAX_DUCK_LANES, maxPerHeat));
  const buckets: StudentCandidate[][] = [];
  for (let i = 0; i < eligibleStudents.length; i += cap) {
    buckets.push(eligibleStudents.slice(i, i + cap));
  }
  return buckets;
}

/**
 * Generate a strictly non-decreasing kinematic progress lookup table [0 .. targetFinishProgress].
 * Ducks alternate bursts and overtake smoothly in the middle segment, while guaranteeing:
 * - Zero backward motion (all slopes > 0)
 * - Winner arrives cleanly at targetFinishProgress === 1.0 FIRST
 * - FPS drop never alters race outcome or finish timing
 */
function buildMonotonicLaneSamples(params: {
  isWinner: boolean;
  targetFinishProgress: number;
  laneSeed: number;
}): number[] {
  const { isWinner, targetFinishProgress } = params;
  const f1 = 1.4 + (cryptoRandomInt(100) / 100) * 1.4;
  const f2 = 2.6 + (cryptoRandomInt(100) / 100) * 1.8;
  const p1 = (cryptoRandomInt(628) / 100);
  const p2 = (cryptoRandomInt(628) / 100);
  const earlySurge = isWinner ? 0.72 + (cryptoRandomInt(30) / 100) : 0.9 + (cryptoRandomInt(55) / 100);
  const lateSurge = isWinner ? 1.55 + (cryptoRandomInt(25) / 100) : 0.75 + (cryptoRandomInt(30) / 100);

  const weights: number[] = [];
  let sum = 0;

  for (let k = 1; k <= KINEMATIC_SAMPLES; k++) {
    const u = k / KINEMATIC_SAMPLES;
    // Start acceleration ramp (u near 0 starts gentle, builds up)
    const startRamp = 0.45 + 0.55 * Math.min(1, u / 0.14);
    const wave =
      0.26 * Math.sin(u * Math.PI * f1 + p1) +
      0.16 * Math.cos(u * Math.PI * f2 + p2);

    // Mid-race vs sprint weighting creates exciting lead swaps
    const phaseWeight = u < 0.58 ? earlySurge : lateSurge;
    const stepSpeed = Math.max(0.28, startRamp * (phaseWeight + wave));
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

  // Enforce strict monotonicity & clamp non-winners below winner in final sprint
  for (let k = 1; k <= KINEMATIC_SAMPLES; k++) {
    if (samples[k] < samples[k - 1]) {
      samples[k] = samples[k - 1];
    }
  }
  return samples;
}

/**
 * Compute world Z coordinate for lane `laneIndex` out of `laneCount` centered symmetrically at z = 0.
 */
export function computeLaneZ(laneIndex: number, laneCount: number): number {
  const safeCount = Math.max(1, laneCount);
  return (laneIndex - (safeCount - 1) / 2) * LANE_SPACING;
}

/**
 * Build the preview lineup shown during READY state before the race starts.
 */
export function buildPreviewLineup(params: {
  eligibleStudents: readonly StudentCandidate[];
  fullRoster: readonly StudentCandidate[];
  heatMode: DuckRaceHeatMode;
  heatIndex: number;
}): {
  lineup: DuckRacerEntry[];
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

  let poolSlice: StudentCandidate[] = [];
  let totalHeats = 1;
  let safeHeatIndex = 0;

  if (heatMode === 'BRACKET_HEATS' && eligibleStudents.length > MAX_DUCK_LANES) {
    const buckets = computeHeatBuckets(eligibleStudents, MAX_DUCK_LANES);
    totalHeats = buckets.length;
    safeHeatIndex = Math.max(0, Math.min(heatIndex, totalHeats - 1));
    poolSlice = buckets[safeHeatIndex];
  } else if (eligibleStudents.length <= MAX_DUCK_LANES) {
    poolSlice = [...eligibleStudents];
  } else {
    poolSlice = eligibleStudents.slice(0, MAX_DUCK_LANES);
  }

  const laneCount = poolSlice.length;
  const lineup: DuckRacerEntry[] = poolSlice.map((student, laneIndex) => {
    const sttNumber = rosterSttMap.get(student.id) ?? laneIndex + 1;
    const { safeName, safeCode, formattedStt } = getSafeStudentFields(student, sttNumber);
    const hasDuplicateName = (nameCounts.get(safeName.toLowerCase()) ?? 0) > 1;
    return {
      laneIndex,
      laneNumber: laneIndex + 1,
      laneZ: computeLaneZ(laneIndex, laneCount),
      student,
      safeName,
      safeCode,
      displayLabel: formatLaneDisplayLabel(safeName, formattedStt, hasDuplicateName),
      sttNumber,
      formattedStt,
      palette: DUCK_RACE_PALETTES[laneIndex % DUCK_RACE_PALETTES.length],
      isWinner: false,
      targetFinishProgress: 0,
      progressSamples: [0],
      wingPhaseOffset: laneIndex * 0.75,
      bobPhaseOffset: laneIndex * 1.15,
    };
  });

  return { lineup, totalHeats, safeHeatIndex };
}

/**
 * SELECTION + RACE PLAN GENERATOR (Immutable per turnId)
 * 1. Picks the single winner fairly with `cryptoRandomInt` BEFORE any animation begins.
 *    - REPRESENTATIVE_FAIR: 1/N equal chance across ALL eligibleStudents (even for 30 or 50 students).
 *    - BRACKET_HEATS: 1/M equal chance across all M students in the selected heat bucket.
 * 2. Assembles up to 8 lanes ensuring the winner is placed in a shuffled random lane (#1..#L).
 * 3. Precomputes monotonic progress curves so the winner reaches progress=1.0 first.
 */
export function createFairDuckRaceTurnPlan(params: {
  eligibleStudents: readonly StudentCandidate[];
  fullRoster: readonly StudentCandidate[];
  durationSec: DuckRaceDurationSec;
  heatMode: DuckRaceHeatMode;
  heatIndex: number;
  turnId?: string;
}): DuckRaceTurnPlan {
  const { eligibleStudents, fullRoster, durationSec, heatMode, heatIndex } = params;

  if (eligibleStudents.length === 0) {
    throw new Error('Không có học sinh hợp lệ nào để bắt đầu cuộc đua.');
  }

  const rosterSttMap = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  const refRoster = fullRoster.length > 0 ? fullRoster : eligibleStudents;
  refRoster.forEach((st, idx) => {
    rosterSttMap.set(st.id, idx + 1);
    const norm = (st.fullName || '').trim().toLowerCase();
    nameCounts.set(norm, (nameCounts.get(norm) ?? 0) + 1);
  });

  let selectionPool: StudentCandidate[];
  let totalHeats = 1;
  let safeHeatIndex = 0;

  if (heatMode === 'BRACKET_HEATS' && eligibleStudents.length > MAX_DUCK_LANES) {
    const buckets = computeHeatBuckets(eligibleStudents, MAX_DUCK_LANES);
    totalHeats = buckets.length;
    safeHeatIndex = Math.max(0, Math.min(heatIndex, totalHeats - 1));
    selectionPool = buckets[safeHeatIndex];
  } else {
    selectionPool = [...eligibleStudents];
  }

  // 1. Fair cryptographic winner pick (zero modulo bias)
  const winnerIdxInPool = cryptoRandomInt(selectionPool.length);
  const winner = selectionPool[winnerIdxInPool];
  const winnerSttNumber = rosterSttMap.get(winner.id) ?? winnerIdxInPool + 1;
  const winnerSafe = getSafeStudentFields(winner, winnerSttNumber);
  const winnerDup = (nameCounts.get(winnerSafe.safeName.toLowerCase()) ?? 0) > 1;
  const winnerDisplayLabel = formatLaneDisplayLabel(
    winnerSafe.safeName,
    winnerSafe.formattedStt,
    winnerDup
  );

  // 2. Build lane participants (all if <= 8, or winner + 7 unbiased peers shuffled across lanes)
  let laneStudents: StudentCandidate[];
  if (selectionPool.length <= MAX_DUCK_LANES) {
    laneStudents = [...selectionPool];
  } else {
    const others = selectionPool.filter((s) => s.id !== winner.id);
    const pickedOthers = cryptoFisherYatesShuffle(others).slice(0, MAX_DUCK_LANES - 1);
    laneStudents = cryptoFisherYatesShuffle([winner, ...pickedOthers]);
  }

  const laneCount = laneStudents.length;
  const racers: DuckRacerEntry[] = laneStudents.map((student, laneIndex) => {
    const isWinner = student.id === winner.id;
    const sttNumber = rosterSttMap.get(student.id) ?? laneIndex + 1;
    const { safeName, safeCode, formattedStt } = getSafeStudentFields(student, sttNumber);
    const hasDuplicateName = (nameCounts.get(safeName.toLowerCase()) ?? 0) > 1;

    // Non-winners finish closely behind for excitement (0.85 .. 0.962), never >= 0.98
    const finishMargin = isWinner
      ? 1.0
      : 0.855 + (cryptoRandomInt(108) / 1000); // [0.855 .. 0.962]

    return {
      laneIndex,
      laneNumber: laneIndex + 1,
      laneZ: computeLaneZ(laneIndex, laneCount),
      student,
      safeName,
      safeCode,
      displayLabel: formatLaneDisplayLabel(safeName, formattedStt, hasDuplicateName),
      sttNumber,
      formattedStt,
      palette: DUCK_RACE_PALETTES[laneIndex % DUCK_RACE_PALETTES.length],
      isWinner,
      targetFinishProgress: finishMargin,
      progressSamples: buildMonotonicLaneSamples({
        isWinner,
        targetFinishProgress: finishMargin,
        laneSeed: laneIndex,
      }),
      wingPhaseOffset: laneIndex * 0.85,
      bobPhaseOffset: laneIndex * 1.2,
    };
  });

  // Ensure winner does not lose even at u = 0.999 due to rounding
  const winnerLaneIndex = racers.findIndex((r) => r.isWinner);
  const winnerEntry = racers[winnerLaneIndex];
  for (let lane = 0; lane < racers.length; lane++) {
    if (lane === winnerLaneIndex) continue;
    const other = racers[lane];
    // Guarantee in the final 4% of race time, winner is strictly ahead of every competitor
    for (let k = KINEMATIC_SAMPLES - 3; k <= KINEMATIC_SAMPLES; k++) {
      if (other.progressSamples[k] >= winnerEntry.progressSamples[k] - 0.008) {
        other.progressSamples[k] = Math.max(
          other.progressSamples[k - 1] ?? 0,
          winnerEntry.progressSamples[k] - (0.015 + (KINEMATIC_SAMPLES - k === 0 ? 0.025 : 0.01))
        );
      }
    }
  }

  return {
    turnId: params.turnId || `a05_turn_${Date.now().toString(36)}_${cryptoRandomInt(100000)}`,
    createdAtMs: Date.now(),
    durationSec,
    durationMs: durationSec * 1000,
    heatMode,
    heatIndex: safeHeatIndex,
    totalHeats,
    winner,
    winnerLaneIndex,
    winnerSttNumber,
    winnerDisplayLabel,
    racers,
  };
}

/**
 * Evaluate exact duck positions at `raceElapsedMs` using monotonic time normalization.
 * Zero allocations of Three.js vectors; returns plain lightweight numbers for HUD & 3D update.
 */
export function evaluateDuckRaceFrame(
  plan: DuckRaceTurnPlan,
  raceElapsedMs: number,
  outFrames?: DuckFrameState[]
): {
  u: number;
  isRaceCompleted: boolean;
  leaderLaneIndex: number;
  leaderProgress: number;
  packCenterX: number;
  frames: DuckFrameState[];
} {
  const u = Math.min(Math.max(raceElapsedMs / Math.max(1, plan.durationMs), 0), 1);
  const scaled = u * KINEMATIC_SAMPLES;
  const idx0 = Math.min(Math.floor(scaled), KINEMATIC_SAMPLES);
  const idx1 = Math.min(idx0 + 1, KINEMATIC_SAMPLES);
  const frac = scaled - idx0;

  const frames = outFrames && outFrames.length === plan.racers.length
    ? outFrames
    : plan.racers.map((r) => ({
        laneIndex: r.laneIndex,
        progress: 0,
        x: TRACK_START_X,
        z: r.laneZ,
        speedNorm: 0,
        isLeading: false,
      }));

  let maxProgress = -1;
  let leaderLaneIndex = 0;
  let sumX = 0;

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
    isRaceCompleted: u >= 1,
    leaderLaneIndex,
    leaderProgress: Math.max(0, maxProgress),
    packCenterX: frames.length > 0 ? sumX / frames.length : TRACK_START_X,
    frames,
  };
}

/**
 * Deduplicate turn commits so double-clicks, watchdog timers, and animation completion
 * can NEVER pick/save the same turnId twice.
 */
export class DuckRaceTurnDeduplicator {
  private committedTurnIds = new Set<string>();

  public markCommitted(turnId: string): boolean {
    if (!turnId || this.committedTurnIds.has(turnId)) return false;
    this.committedTurnIds.add(turnId);
    return true;
  }

  public hasCommitted(turnId: string): boolean {
    return this.committedTurnIds.has(turnId);
  }

  public clear(): void {
    this.committedTurnIds.clear();
  }
}

// ============================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG A05 (DUCK RACE 3D PREMIUM)
// ============================================================================

export interface DuckRaceUnitTestCase {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runDuckRace3DUnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
  cases: DuckRaceUnitTestCase[];
} {
  const cases: DuckRaceUnitTestCase[] = [];

  const makeRoster = (n: number): StudentCandidate[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `st_${i + 1}`,
      code: `HS${String(i + 1).padStart(2, '0')}`,
      fullName: `Nguyễn Minh Học Sinh ${i + 1}`,
    }));

  // 1. Lớp 1 học sinh
  const r1 = makeRoster(1);
  const p1 = createFairDuckRaceTurnPlan({
    eligibleStudents: r1,
    fullRoster: r1,
    durationSec: 10,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  const end1 = evaluateDuckRaceFrame(p1, p1.durationMs);
  cases.push({
    id: 'a05_roster_1',
    label: 'Lớp 1 học sinh: lên làn và về đích progress = 1.0',
    passed: p1.racers.length === 1 && p1.winner.id === 'st_1' && Math.abs(end1.frames[0].progress - 1) < 1e-6,
    detail: `lanes=${p1.racers.length}, progress=${end1.frames[0].progress}`,
  });

  // 2. Lớp 2 học sinh
  const r2 = makeRoster(2);
  const p2 = createFairDuckRaceTurnPlan({
    eligibleStudents: r2,
    fullRoster: r2,
    durationSec: 5,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  cases.push({
    id: 'a05_roster_2',
    label: 'Lớp 2 học sinh: đủ 2 làn đối xứng',
    passed: p2.racers.length === 2 && p2.racers[0].laneZ === -p2.racers[1].laneZ,
    detail: `z0=${p2.racers[0].laneZ}, z1=${p2.racers[1].laneZ}`,
  });

  // 3. Lớp 6 học sinh
  const r6 = makeRoster(6);
  const p6 = createFairDuckRaceTurnPlan({
    eligibleStudents: r6,
    fullRoster: r6,
    durationSec: 10,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  cases.push({
    id: 'a05_roster_6',
    label: 'Lớp 6 học sinh: hiển thị đủ 6 làn không thiếu',
    passed: p6.racers.length === 6 && p6.racers.some((r) => r.isWinner),
    detail: `lanes=${p6.racers.length}`,
  });

  // 4. Lớp 30 học sinh (đại diện & chia bảng)
  const r30 = makeRoster(30);
  const p30Rep = createFairDuckRaceTurnPlan({
    eligibleStudents: r30,
    fullRoster: r30,
    durationSec: 15,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  const buckets30 = computeHeatBuckets(r30, MAX_DUCK_LANES);
  cases.push({
    id: 'a05_roster_30',
    label: 'Lớp 30 học sinh: tối đa 8 làn rõ nét & chia đủ 4 bảng đấu',
    passed:
      p30Rep.racers.length === 8 &&
      p30Rep.racers.some((r) => r.student.id === p30Rep.winner.id) &&
      buckets30.length === 4 &&
      buckets30.reduce((acc, b) => acc + b.length, 0) === 30,
    detail: `lanes=${p30Rep.racers.length}, heats=${buckets30.length}`,
  });

  // 5. Lớp 50 học sinh
  const r50 = makeRoster(50);
  const p50 = createFairDuckRaceTurnPlan({
    eligibleStudents: r50,
    fullRoster: r50,
    durationSec: 10,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  const buckets50 = computeHeatBuckets(r50, MAX_DUCK_LANES);
  cases.push({
    id: 'a05_roster_50',
    label: 'Lớp 50 học sinh: chọn toàn lớp không loại ai, tối đa 8 làn & 7 bảng',
    passed:
      p50.racers.length === 8 &&
      buckets50.length === 7 &&
      buckets50.reduce((acc, b) => acc + b.length, 0) === 50,
    detail: `lanes=${p50.racers.length}, heats=${buckets50.length}`,
  });

  // 6. Tên dài + trùng tên + thiếu tên/mã HS
  const edgeRoster: StudentCandidate[] = [
    { id: 'e1', code: '', fullName: 'Nguyễn Thị Hoàng Bảo Trâm Anh Thư' },
    { id: 'e2', code: 'HS02', fullName: 'Nguyễn Thị Hoàng Bảo Trâm Anh Thư' },
    { id: 'e3', code: '', fullName: '' },
  ];
  const pEdge = createFairDuckRaceTurnPlan({
    eligibleStudents: edgeRoster,
    fullRoster: edgeRoster,
    durationSec: 10,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  const labels = pEdge.racers.map((r) => r.displayLabel);
  const codes = pEdge.racers.map((r) => r.safeCode);
  cases.push({
    id: 'a05_edge_names',
    label: 'Tên dài, trùng tên & thiếu tên/mã đều phân biệt rõ ràng không rỗng',
    passed:
      new Set(labels).size === 3 &&
      labels[0].startsWith('#01 ·') &&
      labels[1].startsWith('#02 ·') &&
      codes.every((c) => c.length > 0) &&
      pEdge.racers[2].safeName === 'Học sinh #03',
    detail: labels.join(' | '),
  });

  // 7. Chuyển động đơn điệu & Vịt thắng luôn chạm đích trước ở 5s, 10s, 15s
  let kinematicOk = true;
  for (const dur of [5, 10, 15] as DuckRaceDurationSec[]) {
    const plan = createFairDuckRaceTurnPlan({
      eligibleStudents: r6,
      fullRoster: r6,
      durationSec: dur,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    const prevProg = new Array(plan.racers.length).fill(0);
    for (let step = 0; step <= 20; step++) {
      const f = evaluateDuckRaceFrame(plan, (plan.durationMs * step) / 20);
      for (let i = 0; i < f.frames.length; i++) {
        if (f.frames[i].progress + 1e-9 < prevProg[i]) kinematicOk = false;
        prevProg[i] = f.frames[i].progress;
      }
      if (step === 20) {
        if (f.leaderLaneIndex !== plan.winnerLaneIndex) kinematicOk = false;
        if (Math.abs(f.frames[plan.winnerLaneIndex].progress - 1) > 1e-6) kinematicOk = false;
        for (let i = 0; i < f.frames.length; i++) {
          if (i !== plan.winnerLaneIndex && f.frames[i].progress >= 0.99) kinematicOk = false;
        }
      }
    }
  }
  cases.push({
    id: 'a05_kinematics_durations',
    label: 'Động học 5s/10s/15s đơn điệu (không bơi lùi) & vịt thắng về đích #1 tuyệt đối',
    passed: kinematicOk,
    detail: kinematicOk ? '5s/10s/15s đều chuẩn xác' : 'Sai thứ tự hoặc bước tiến',
  });

  // 8. Kiểm tra tính công bằng xác suất Monte Carlo (N = 6, 3000 lượt)
  const counts = new Map<string, number>();
  r6.forEach((s) => counts.set(s.id, 0));
  const trials = 3000;
  for (let t = 0; t < trials; t++) {
    const plan = createFairDuckRaceTurnPlan({
      eligibleStudents: r6,
      fullRoster: r6,
      durationSec: 5,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    counts.set(plan.winner.id, (counts.get(plan.winner.id) ?? 0) + 1);
  }
  const expected = trials / r6.length; // 500
  const maxRelDev = Math.max(
    ...Array.from(counts.values()).map((c) => Math.abs(c - expected) / expected)
  );
  cases.push({
    id: 'a05_fairness_monte_carlo',
    label: 'Xác suất chọn công bằng (3.000 lượt thử, N=6: độ lệch tối đa < 18%)',
    passed: maxRelDev < 0.18,
    detail: `maxRelDev = ${(maxRelDev * 100).toFixed(2)}%`,
  });

  // 9. Chống ghi trùng turnId
  const dedup = new DuckRaceTurnDeduplicator();
  const firstOk = dedup.markCommitted('turn_xyz');
  const secondBlocked = !dedup.markCommitted('turn_xyz');
  cases.push({
    id: 'a05_dedup_guard',
    label: 'Chặn ghi kết quả trùng lặp theo turnId khi double-click',
    passed: firstOk && secondBlocked,
    detail: `first=${firstOk}, secondBlocked=${secondBlocked}`,
  });

  // 10. Chống lỗi pool rỗng
  let threwOnEmpty = false;
  try {
    createFairDuckRaceTurnPlan({
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
    id: 'a05_empty_guard',
    label: 'Từ chối an toàn khi danh sách học sinh khả dụng rỗng',
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
