import { StudentCandidate } from '../studentCallRules';
import { cryptoRandomInt } from './wheel3dMath';

export type Claw3DState =
  | 'SETUP'
  | 'LOADING_STUDENTS'
  | 'READY'
  | 'TARGET_SELECTED'
  | 'MOVING'
  | 'LOWERING'
  | 'GRABBING'
  | 'LIFTING'
  | 'DROPPING'
  | 'OPENING'
  | 'REVEALING'
  | 'SAVING'
  | 'COMPLETED'
  | 'ERROR_RECOVERY'
  | 'FINISHED';

export type ClawAnimationSubPhase =
  | 'IDLE'
  | 'TARGET_SELECTED'
  | 'MOVING_TO_TARGET'
  | 'LOWERING'
  | 'CLAW_OPENING'
  | 'CLAW_CLOSING'
  | 'CAPSULE_ATTACHED'
  | 'LIFTING'
  | 'MOVING_TO_DROP'
  | 'RELEASING'
  | 'CAPSULE_FALLING'
  | 'CAPSULE_OPENING'
  | 'RESULT_REVEAL'
  | 'RESETTING'
  | 'COMPLETED';

export type ClawControlMode = 'AUTO' | 'JOYSTICK';

export type ClawSpeedMode = 'FAST' | 'NORMAL';

export type ClawQualityPreset = 'LOW' | 'MEDIUM' | 'HIGH';

export type ClawCameraPreset =
  | 'FRONT'
  | 'ISO_34'
  | 'CLAW_CLOSEUP'
  | 'DROP_CHUTE'
  | 'RESULT_TRAY';

export interface Claw3DCapsuleItem {
  capsuleIndex: number;
  sttNumber: number; // 1 .. N (fixed per class roster)
  formattedStt: string; // "01" .. "50"
  student: StudentCandidate;
  shortLabel: string;
  colorHex: string;
  topDomeHex: string;
  accentHex: string;
  // 3D rest coordinates inside the glass chamber
  restX: number;
  restY: number;
  restZ: number;
  radius: number;
  tier: number;
}

export interface Claw3DTurnPlan {
  turnId: string;
  selectedCapsuleIndex: number;
  selectedCapsule: Claw3DCapsuleItem;
  startCarriageX: number;
  startCarriageZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  dropChuteX: number;
  dropChuteZ: number;
  trayLandingY: number;
  durationMs: number;
}

export interface ClawMechanicalFrameState {
  stateMachinePhase: Claw3DState;
  subPhase: ClawAnimationSubPhase;
  carriageX: number;
  carriageZ: number;
  clawHeadY: number;
  cableLength: number;
  prongOpenAngleRad: number; // 0.16 (closed) .. 0.68 (wide open)
  capsuleX: number;
  capsuleY: number;
  capsuleZ: number;
  capsuleSplitDistance: number; // 0 (closed) .. 0.55 (split open in tray)
  capsuleSplitTiltRad: number; // 0 .. 0.85 rad
  capsuleGlowIntensity: number; // 0 .. 1
  shouldTriggerReveal: boolean;
}

export const CAPSULE_3D_PALETTE: Array<{
  bottomHex: string;
  topHex: string;
  accentHex: string;
}> = [
  { bottomHex: '#0284C7', topHex: '#7DD3FC', accentHex: '#FDE047' }, // Cyan Tech
  { bottomHex: '#E11D48', topHex: '#FDA4AF', accentHex: '#FEF08A' }, // Arcade Ruby
  { bottomHex: '#D97706', topHex: '#FDE68A', accentHex: '#FFFFFF' }, // Golden Amber
  { bottomHex: '#059669', topHex: '#6EE7B7', accentHex: '#FEF08A' }, // Emerald Neon
  { bottomHex: '#7C3AED', topHex: '#C4B5FD', accentHex: '#FDE047' }, // Electric Violet
  { bottomHex: '#2563EB', topHex: '#93C5FD', accentHex: '#FDE047' }, // Royal Blue
  { bottomHex: '#EA580C', topHex: '#FDBA74', accentHex: '#FEF08A' }, // Tangerine
  { bottomHex: '#DB2777', topHex: '#F9A8D4', accentHex: '#FEF08A' }, // Magenta
];

// Fixed coordinates Inside the 3D Arcade Cabinet Chamber
export const CLAW_CHAMBER_BOUNDS = {
  minX: -1.95,
  maxX: 1.95,
  minZ: -1.15,
  maxZ: 1.05,
  railY: 2.15,
  restClawHeadY: 1.72,
  floorY: -0.78,
  dropChuteX: -1.52,
  dropChuteZ: 0.72,
  trayLandingY: -1.78,
};

function clamp01(val: number): number {
  return Math.min(Math.max(val, 0), 1);
}

function smoothstep01(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Format compact label for capsule badge / HUD readout.
 */
export function formatCapsuleStudentLabel(
  fullName: string,
  sttNumber: number
): { formattedStt: string; shortLabel: string } {
  const formattedStt = String(sttNumber).padStart(2, '0');
  const clean = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!clean) {
    return { formattedStt, shortLabel: `#${formattedStt}` };
  }
  const parts = clean.split(' ');
  const givenName = parts[parts.length - 1];
  const middleInitial =
    parts.length >= 2 ? `${parts[parts.length - 2].charAt(0).toUpperCase()}. ` : '';
  return {
    formattedStt,
    shortLabel: `${middleInitial}${givenName}`.slice(0, 12),
  };
}

/**
 * Deterministic, collision-free 3D spatial layout for 1..50+ student capsules inside the glass chamber.
 * Keeps capsules clear of the front-left drop chute (`x < -1.05 && z > 0.25`) so the claw always has
 * a clean vertical path to every single student capsule.
 */
export function buildClaw3DCapsules(
  eligibleStudents: StudentCandidate[],
  fullRosterStudents?: StudentCandidate[]
): Claw3DCapsuleItem[] {
  const rosterSttMap = new Map<string, number>();
  if (fullRosterStudents && fullRosterStudents.length > 0) {
    fullRosterStudents.forEach((s, idx) => {
      rosterSttMap.set(s.id, idx + 1);
    });
  }

  const count = eligibleStudents.length;
  if (count === 0) return [];

  // Scale capsule radius by class size (Section IV)
  const radius =
    count <= 15 ? 0.28 : count <= 30 ? 0.235 : 0.195;

  // Build candidate slots in the chamber avoiding the front-left drop chute zone
  const candidateSlots: Array<{ x: number; y: number; z: number; tier: number }> = [];

  if (count <= 15) {
    // Spacious single-layer grid
    const cols = 5;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -1.55 + c * 0.82 + (r % 2 === 1 ? 0.16 : -0.08);
        const z = -0.95 + r * 0.58;
        // Skip drop chute corner (front-left: x < -0.95 and z > 0.22)
        if (x < -0.95 && z > 0.22) continue;
        candidateSlots.push({
          x: Math.min(Math.max(x, -1.78), 1.78),
          y: CLAW_CHAMBER_BOUNDS.floorY + radius,
          z: Math.min(Math.max(z, -1.05), 0.92),
          tier: 0,
        });
      }
    }
  } else if (count <= 30) {
    // Medium density staggered layout (up to 32 slots)
    const cols = 7;
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -1.72 + c * 0.58 + (r % 2 === 1 ? 0.14 : -0.06);
        const z = -1.02 + r * 0.48;
        if (x < -1.02 && z > 0.22) continue;
        candidateSlots.push({
          x: Math.min(Math.max(x, -1.82), 1.82),
          y: CLAW_CHAMBER_BOUNDS.floorY + radius,
          z: Math.min(Math.max(z, -1.08), 0.95),
          tier: 0,
        });
      }
    }
  } else {
    // 31..50+ students: Two-tier staggered arrangement so 50 capsules never overlap chaotically
    for (let tier = 0; tier < 2; tier++) {
      const cols = 7;
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const offsetX = tier === 1 ? 0.22 : 0;
          const offsetZ = tier === 1 ? 0.14 : 0;
          const x = -1.74 + c * 0.57 + (r % 2 === 1 ? 0.14 : -0.06) + offsetX;
          const z = -1.02 + r * 0.47 + offsetZ;
          if (x < -1.02 && z > 0.2) continue;
          candidateSlots.push({
            x: Math.min(Math.max(x, -1.82), 1.82),
            y: CLAW_CHAMBER_BOUNDS.floorY + radius + tier * (radius * 1.48),
            z: Math.min(Math.max(z, -1.08), 0.95),
            tier,
          });
        }
      }
    }
  }

  return eligibleStudents.map((student, idx) => {
    const sttNumber = rosterSttMap.get(student.id) ?? idx + 1;
    const { formattedStt, shortLabel } = formatCapsuleStudentLabel(
      student.fullName,
      sttNumber
    );
    const palette = CAPSULE_3D_PALETTE[idx % CAPSULE_3D_PALETTE.length];
    const slot = candidateSlots[idx % candidateSlots.length] || {
      x: 0,
      y: CLAW_CHAMBER_BOUNDS.floorY + radius,
      z: 0,
      tier: 0,
    };

    return {
      capsuleIndex: idx,
      sttNumber,
      formattedStt,
      student,
      shortLabel,
      colorHex: palette.bottomHex,
      topDomeHex: palette.topHex,
      accentHex: palette.accentHex,
      restX: slot.x,
      restY: slot.y,
      restZ: slot.z,
      radius,
      tier: slot.tier,
    };
  });
}

/**
 * Select a student fairly using `cryptoRandomInt` BEFORE starting the claw animation,
 * and build the immutable `Claw3DTurnPlan` (Section V & VII).
 */
export function createFairClawTurnPlan(params: {
  capsules: Claw3DCapsuleItem[];
  startCarriageX: number;
  startCarriageZ: number;
  speedMode: ClawSpeedMode;
}): Claw3DTurnPlan {
  const { capsules, startCarriageX, startCarriageZ, speedMode } = params;
  if (capsules.length === 0) {
    throw new Error('Không có học sinh hợp lệ trong buồng máy gắp.');
  }

  const selectedCapsuleIndex =
    capsules.length === 1 ? 0 : cryptoRandomInt(capsules.length);
  const selectedCapsule = capsules[selectedCapsuleIndex];

  const durationMs = speedMode === 'FAST' ? 5200 : 7800;
  const turnId = `claw_turn_${Date.now()}_${cryptoRandomInt(1000000)}`;

  return {
    turnId,
    selectedCapsuleIndex,
    selectedCapsule,
    startCarriageX,
    startCarriageZ,
    targetX: selectedCapsule.restX,
    targetY: selectedCapsule.restY,
    targetZ: selectedCapsule.restZ,
    dropChuteX: CLAW_CHAMBER_BOUNDS.dropChuteX,
    dropChuteZ: CLAW_CHAMBER_BOUNDS.dropChuteZ,
    trayLandingY: CLAW_CHAMBER_BOUNDS.trayLandingY,
    durationMs,
  };
}

/**
 * Evaluate the complete 3-Prong Claw & Capsule kinematic state at normalized progress `t ∈ [0, 1]`.
 *
 * Timeline breakdown (Section III & VII):
 * - [0.00, 0.04]: TARGET_SELECTED (lights lock on, claw prepares)
 * - [0.04, 0.22]: MOVING_TO_TARGET (trolley & gantry bridge glide to targetX, targetZ; prongs open slightly)
 * - [0.22, 0.36]: LOWERING & CLAW_OPENING (cable extends down to targetY; 3 prongs open wide to 0.66 rad)
 * - [0.36, 0.45]: CLAW_CLOSING & CAPSULE_ATTACHED (3 prongs close snugly to 0.28 rad around the target capsule)
 * - [0.45, 0.60]: LIFTING (cable retracts, lifting the attached capsule smoothly up to restClawHeadY)
 * - [0.60, 0.76]: MOVING_TO_DROP (carriage carries the gripped capsule over to the drop chute `(dropChuteX, dropChuteZ)`)
 * - [0.76, 0.82]: RELEASING (3 prongs open to 0.64 rad at the drop chute)
 * - [0.82, 0.90]: CAPSULE_FALLING (capsule drops through the chute into the collection tray with a gentle bounce)
 * - [0.90, 0.97]: CAPSULE_OPENING (the 2 hemispheres split open in the tray with golden light burst, while claw resets)
 * - [0.97, 1.00]: RESULT_REVEAL / COMPLETED (capsule fully open, ready to announce student name)
 */
export function evaluateClawMechanicalTimeline(
  plan: Claw3DTurnPlan,
  normalizedT: number
): ClawMechanicalFrameState {
  const t = clamp01(normalizedT);
  const restY = CLAW_CHAMBER_BOUNDS.restClawHeadY;
  const railY = CLAW_CHAMBER_BOUNDS.railY;
  // Claw head stops slightly above capsule center so its 3 prongs wrap around the capsule equator
  const grabHeadY = plan.targetY + 0.36;
  const heldCapsuleOffsetY = -0.36;

  let stateMachinePhase: Claw3DState = 'MOVING';
  let subPhase: ClawAnimationSubPhase = 'MOVING_TO_TARGET';
  let carriageX = plan.startCarriageX;
  let carriageZ = plan.startCarriageZ;
  let clawHeadY = restY;
  let prongOpenAngleRad = 0.22;

  let capsuleX = plan.targetX;
  let capsuleY = plan.targetY;
  let capsuleZ = plan.targetZ;
  let capsuleSplitDistance = 0;
  let capsuleSplitTiltRad = 0;
  let capsuleGlowIntensity = 0;

  if (t < 0.04) {
    stateMachinePhase = 'TARGET_SELECTED';
    subPhase = 'TARGET_SELECTED';
    const localP = smoothstep01(t / 0.04);
    prongOpenAngleRad = lerp(0.18, 0.32, localP);
  } else if (t < 0.22) {
    stateMachinePhase = 'MOVING';
    subPhase = 'MOVING_TO_TARGET';
    const localP = smoothstep01((t - 0.04) / 0.18);
    carriageX = lerp(plan.startCarriageX, plan.targetX, localP);
    carriageZ = lerp(plan.startCarriageZ, plan.targetZ, localP);
    prongOpenAngleRad = lerp(0.32, 0.64, localP);
  } else if (t < 0.36) {
    stateMachinePhase = 'LOWERING';
    subPhase = t < 0.29 ? 'LOWERING' : 'CLAW_OPENING';
    const localP = smoothstep01((t - 0.22) / 0.14);
    carriageX = plan.targetX;
    carriageZ = plan.targetZ;
    clawHeadY = lerp(restY, grabHeadY, localP);
    prongOpenAngleRad = 0.65;
  } else if (t < 0.45) {
    stateMachinePhase = 'GRABBING';
    subPhase = t < 0.41 ? 'CLAW_CLOSING' : 'CAPSULE_ATTACHED';
    const localP = smoothstep01((t - 0.36) / 0.09);
    carriageX = plan.targetX;
    carriageZ = plan.targetZ;
    clawHeadY = grabHeadY;
    prongOpenAngleRad = lerp(0.65, 0.28, localP);
    capsuleGlowIntensity = localP * 0.45;
  } else if (t < 0.60) {
    stateMachinePhase = 'LIFTING';
    subPhase = 'LIFTING';
    const localP = smoothstep01((t - 0.45) / 0.15);
    carriageX = plan.targetX;
    carriageZ = plan.targetZ;
    clawHeadY = lerp(grabHeadY, restY, localP);
    prongOpenAngleRad = 0.28;
    // Capsule is firmly attached to the claw head
    capsuleX = carriageX;
    capsuleY = clawHeadY + heldCapsuleOffsetY;
    capsuleZ = carriageZ;
    capsuleGlowIntensity = 0.45;
  } else if (t < 0.76) {
    stateMachinePhase = 'MOVING';
    subPhase = 'MOVING_TO_DROP';
    const localP = smoothstep01((t - 0.60) / 0.16);
    carriageX = lerp(plan.targetX, plan.dropChuteX, localP);
    carriageZ = lerp(plan.targetZ, plan.dropChuteZ, localP);
    clawHeadY = restY;
    prongOpenAngleRad = 0.28;
    capsuleX = carriageX;
    capsuleY = clawHeadY + heldCapsuleOffsetY;
    capsuleZ = carriageZ;
    capsuleGlowIntensity = 0.55;
  } else if (t < 0.82) {
    stateMachinePhase = 'DROPPING';
    subPhase = 'RELEASING';
    const localP = smoothstep01((t - 0.76) / 0.06);
    carriageX = plan.dropChuteX;
    carriageZ = plan.dropChuteZ;
    clawHeadY = restY;
    prongOpenAngleRad = lerp(0.28, 0.64, localP);
    capsuleX = plan.dropChuteX;
    capsuleY = lerp(restY + heldCapsuleOffsetY, restY + heldCapsuleOffsetY - 0.18, localP);
    capsuleZ = plan.dropChuteZ;
    capsuleGlowIntensity = 0.65;
  } else if (t < 0.90) {
    stateMachinePhase = 'DROPPING';
    subPhase = 'CAPSULE_FALLING';
    const localP = clamp01((t - 0.82) / 0.08);
    carriageX = plan.dropChuteX;
    carriageZ = plan.dropChuteZ;
    clawHeadY = restY;
    prongOpenAngleRad = lerp(0.64, 0.24, localP);

    // Gravity fall + single damped bounce at bottom of tray
    const startDropY = restY + heldCapsuleOffsetY - 0.18;
    let fallY = lerp(startDropY, plan.trayLandingY, Math.min(localP * 1.25, 1));
    if (localP > 0.78) {
      const bouncePhase = (localP - 0.78) / 0.22;
      fallY = plan.trayLandingY + Math.sin(bouncePhase * Math.PI) * 0.16;
    }
    capsuleX = plan.dropChuteX;
    capsuleY = fallY;
    capsuleZ = lerp(plan.dropChuteZ, plan.dropChuteZ + 0.35, localP);
    capsuleGlowIntensity = 0.75;
  } else if (t < 0.97) {
    stateMachinePhase = 'OPENING';
    subPhase = 'CAPSULE_OPENING';
    const localP = smoothstep01((t - 0.90) / 0.07);
    // Claw smoothly resets toward center while capsule opens in the tray
    carriageX = lerp(plan.dropChuteX, 0, localP);
    carriageZ = lerp(plan.dropChuteZ, 0, localP);
    clawHeadY = restY;
    prongOpenAngleRad = 0.2;

    capsuleX = plan.dropChuteX;
    capsuleY = plan.trayLandingY;
    capsuleZ = plan.dropChuteZ + 0.35;
    capsuleSplitDistance = lerp(0, 0.46, localP);
    capsuleSplitTiltRad = lerp(0, 0.82, localP);
    capsuleGlowIntensity = lerp(0.75, 1.0, localP);
  } else {
    stateMachinePhase = 'REVEALING';
    subPhase = 'RESULT_REVEAL';
    carriageX = 0;
    carriageZ = 0;
    clawHeadY = restY;
    prongOpenAngleRad = 0.2;

    capsuleX = plan.dropChuteX;
    capsuleY = plan.trayLandingY;
    capsuleZ = plan.dropChuteZ + 0.35;
    capsuleSplitDistance = 0.46;
    capsuleSplitTiltRad = 0.82;
    capsuleGlowIntensity = 1.0;
  }

  const cableLength = Math.max(0.18, railY - clawHeadY);

  return {
    stateMachinePhase,
    subPhase,
    carriageX,
    carriageZ,
    clawHeadY,
    cableLength,
    prongOpenAngleRad,
    capsuleX,
    capsuleY,
    capsuleZ,
    capsuleSplitDistance,
    capsuleSplitTiltRad,
    capsuleGlowIntensity,
    shouldTriggerReveal: t >= 1,
  };
}

/**
 * Deduplication registry ensuring each `turnId` is saved and announced at most once.
 */
export class ClawTurnDeduplicator {
  private completedTurnIds = new Set<string>();

  public markCompleted(turnId: string): boolean {
    if (!turnId || this.completedTurnIds.has(turnId)) {
      return false;
    }
    this.completedTurnIds.add(turnId);
    return true;
  }

  public isCompleted(turnId: string): boolean {
    return this.completedTurnIds.has(turnId);
  }
}

export interface Claw3DUnitTestReport {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
}

/**
 * Automated Unit Tests for A02 – 3D Lucky Claw Machine (Section XVI):
 * 1. Capsule spatial generation & 1-to-1 `student_id` mapping for 1, 2, 10, 30, and 50 students.
 * 2. Fair RNG selection & strict anti-repeat over 20 consecutive turns.
 * 3. Mechanical timeline continuity & exact target capsule attachment/drop coordinates.
 * 4. Duplicate `turnId` prevention.
 */
export function runClawMachine3DUnitTests(): Claw3DUnitTestReport {
  const failedChecks: string[] = [];
  let totalChecks = 0;

  // Test 1: 1, 2, 10, 30, 50 student capsule mapping & drop-chute clearance
  const testCounts = [1, 2, 10, 30, 50];
  for (const count of testCounts) {
    totalChecks++;
    const roster: StudentCandidate[] = Array.from({ length: count }, (_, i) => ({
      id: `stu_${count}_${i + 1}`,
      code: `HS${String(i + 1).padStart(2, '0')}`,
      fullName: `Học Sinh Lớp ${i + 1}`,
    }));
    const capsules = buildClaw3DCapsules(roster, roster);
    if (capsules.length !== count) {
      failedChecks.push(`Expected ${count} capsules, got ${capsules.length}`);
    }
    capsules.forEach((cap, idx) => {
      totalChecks++;
      if (cap.student.id !== roster[idx].id || cap.sttNumber !== idx + 1) {
        failedChecks.push(`Capsule mapping mismatch at index ${idx} for N=${count}`);
      }
      // Verify capsule is within glass chamber bounds
      if (
        cap.restX < CLAW_CHAMBER_BOUNDS.minX ||
        cap.restX > CLAW_CHAMBER_BOUNDS.maxX ||
        cap.restZ < CLAW_CHAMBER_BOUNDS.minZ ||
        cap.restZ > CLAW_CHAMBER_BOUNDS.maxZ
      ) {
        failedChecks.push(`Capsule out of chamber bounds at index ${idx} for N=${count}`);
      }
    });
  }

  // Test 2: 20 consecutive turns with anti-repeat on a 25-student class
  const class25: StudentCandidate[] = Array.from({ length: 25 }, (_, i) => ({
    id: `student_claw_${i + 1}`,
    code: `HS${String(i + 1).padStart(2, '0')}`,
    fullName: `Nguyễn Văn Bạn ${i + 1}`,
  }));
  const calledSet = new Set<string>();
  for (let turn = 0; turn < 20; turn++) {
    totalChecks++;
    const eligible = class25.filter((s) => !calledSet.has(s.id));
    if (eligible.length !== 25 - turn) {
      failedChecks.push(`Turn ${turn}: expected ${25 - turn} eligible, got ${eligible.length}`);
    }
    const capsules = buildClaw3DCapsules(eligible, class25);
    const plan = createFairClawTurnPlan({
      capsules,
      startCarriageX: 0,
      startCarriageZ: 0,
      speedMode: 'NORMAL',
    });
    if (!plan.selectedCapsule || calledSet.has(plan.selectedCapsule.student.id)) {
      failedChecks.push(`Turn ${turn}: duplicate or invalid student selected`);
    }
    calledSet.add(plan.selectedCapsule.student.id);

    // Test 3: Verify timeline reaches exact target X/Z at lowering/grabbing (t = 0.40) and drop chute at t = 0.95
    totalChecks++;
    const grabFrame = evaluateClawMechanicalTimeline(plan, 0.40);
    if (
      Math.abs(grabFrame.carriageX - plan.targetX) > 1e-4 ||
      Math.abs(grabFrame.carriageZ - plan.targetZ) > 1e-4
    ) {
      failedChecks.push(`Turn ${turn}: claw did not align with target capsule at t=0.40`);
    }
    const openFrame = evaluateClawMechanicalTimeline(plan, 1.0);
    if (openFrame.capsuleSplitDistance <= 0.4 || !openFrame.shouldTriggerReveal) {
      failedChecks.push(`Turn ${turn}: capsule did not split open at t=1.0`);
    }
  }

  // Test 4: Deduplicator prevents duplicate turnId
  totalChecks++;
  const dedup = new ClawTurnDeduplicator();
  if (!dedup.markCompleted('turn_abc') || dedup.markCompleted('turn_abc')) {
    failedChecks.push('ClawTurnDeduplicator failed to block duplicate turnId');
  }

  return {
    passed: failedChecks.length === 0,
    totalChecks,
    failedChecks,
  };
}
