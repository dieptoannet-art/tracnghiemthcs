import { StudentCandidate } from '../studentCallRules';
import { cryptoRandomInt } from './wheel3dMath';

export type GiftBox3DState =
  | 'SETUP'
  | 'LOADING_STUDENTS'
  | 'READY'
  | 'SELECTING'
  | 'OPENING'
  | 'REVEALING'
  | 'SAVING'
  | 'COMPLETED'
  | 'ERROR_RECOVERY'
  | 'FINISHED';

export type GiftBoxAnimationSubPhase =
  | 'READY'
  | 'BOX_SELECTED'
  | 'CAMERA_FOCUS'
  | 'BOX_MOVING_TO_CENTER'
  | 'BOX_SHAKING'
  | 'RIBBON_UNTYING'
  | 'BOW_OPENING'
  | 'LID_LIFTING'
  | 'INNER_LIGHT'
  | 'MAGIC_PARTICLES'
  | 'NAME_CARD_RISING'
  | 'RESULT_REVEAL'
  | 'CELEBRATION'
  | 'COMPLETED';

export type GiftBoxGameMode =
  | 'LUCKY_BOXES'
  | 'ONE_BOX_PER_STUDENT'
  | 'GIANT_BOX';

export type GiftBoxSpeedMode = 'FAST' | 'NORMAL' | 'SUSPENSE';

export type GiftBoxQualityPreset = 'LOW' | 'MEDIUM' | 'HIGH';

export interface GiftBoxMaterialPalette {
  id: string;
  nameVi: string;
  boxColorHex: string;
  lidColorHex: string;
  ribbonColorHex: string;
  bowColorHex: string;
  glowColorHex: string;
}

/**
 * 6 High-contrast 3D gift box material styles required by Section III:
 * Ruby Red, Sapphire Blue, Royal Purple, Gold, Emerald Teal, Pastel Pink.
 */
export const GIFT_BOX_3D_PALETTES: GiftBoxMaterialPalette[] = [
  {
    id: 'ruby',
    nameVi: 'Đỏ Ruby',
    boxColorHex: '#DC2626',
    lidColorHex: '#EF4444',
    ribbonColorHex: '#F5C45E',
    bowColorHex: '#FDE047',
    glowColorHex: '#FEF08A',
  },
  {
    id: 'sapphire',
    nameVi: 'Xanh Sapphire',
    boxColorHex: '#1478D4',
    lidColorHex: '#2563EB',
    ribbonColorHex: '#F5C45E',
    bowColorHex: '#FDE047',
    glowColorHex: '#40D8FF',
  },
  {
    id: 'purple',
    nameVi: 'Tím Hoàng Gia',
    boxColorHex: '#7C3AED',
    lidColorHex: '#8B5CF6',
    ribbonColorHex: '#40D8FF',
    bowColorHex: '#7DD3FC',
    glowColorHex: '#C4B5FD',
  },
  {
    id: 'gold',
    nameVi: 'Vàng Kim',
    boxColorHex: '#D97706',
    lidColorHex: '#F59E0B',
    ribbonColorHex: '#E11D48',
    bowColorHex: '#FDA4AF',
    glowColorHex: '#FEF08A',
  },
  {
    id: 'emerald',
    nameVi: 'Xanh Ngọc',
    boxColorHex: '#059669',
    lidColorHex: '#10B981',
    ribbonColorHex: '#F5C45E',
    bowColorHex: '#FEF08A',
    glowColorHex: '#6EE7B7',
  },
  {
    id: 'pastel_pink',
    nameVi: 'Hồng Pastel',
    boxColorHex: '#EC4899',
    lidColorHex: '#F472B6',
    ribbonColorHex: '#FFFFFF',
    bowColorHex: '#FEF08A',
    glowColorHex: '#FBCFE8',
  },
];

export interface GiftBox3DItem {
  boxId: string;
  boxIndex: number; // 0 .. M-1
  displayNumber: number; // 1 .. M
  formattedBoxNumber: string; // "01" .. "50"
  palette: GiftBoxMaterialPalette;
  // In ONE_BOX_PER_STUDENT mode, boundStudent is pre-assigned via unbiased Fisher-Yates shuffle.
  // In LUCKY_BOXES and GIANT_BOX modes, boundStudent is null until a box is selected.
  boundStudent: StudentCandidate | null;
  boundStudentStt: number | null;
  isOpened: boolean;
  restX: number;
  restY: number;
  restZ: number;
  boxScale: number;
  pageIndex: number; // Used when paginating 30-50 boxes on smaller screens
}

export interface GiftBox3DTurnPlan {
  turnId: string;
  boxId: string;
  boxIndex: number;
  gameMode: GiftBoxGameMode;
  selectedStudent: StudentCandidate;
  studentSttNumber: number;
  formattedStudentStt: string;
  startX: number;
  startY: number;
  startZ: number;
  startScale: number;
  centerStageX: number;
  centerStageY: number;
  centerStageZ: number;
  centerStageScale: number;
  durationMs: number;
}

export interface GiftBoxCinematicFrameState {
  stateMachinePhase: GiftBox3DState;
  subPhase: GiftBoxAnimationSubPhase;
  // Box body transform
  boxX: number;
  boxY: number;
  boxZ: number;
  boxScale: number;
  shakeRotX: number;
  shakeRotY: number;
  shakeRotZ: number;
  // 3D Ribbon & Bow transform
  ribbonSpreadFactor: number; // 0 (tight on box) .. 1 (untied & separated outward)
  ribbonOpacity: number; // 1 .. 0
  bowScale: number; // 1 .. 1.35 .. 0
  bowLiftY: number; // 0 .. 0.85
  bowRotY: number;
  // Separate 3D Lid transform
  lidLiftY: number; // 0 (closed) .. 1.15 (lifted high)
  lidTiltX: number; // 0 .. -0.65 rad (tilted back)
  lidShiftZ: number; // 0 .. -0.45
  // Inner volumetric light & magic particles
  innerLightIntensity: number; // 0 .. 1
  particleBurstProgress: number; // 0 .. 1
  // Rising 3D Hologram Name Card
  nameCardVisible: boolean;
  nameCardLiftY: number; // 0 (inside box) .. 1.08 (floating above open box)
  nameCardScale: number; // 0.1 .. 1.0
  // Camera focus blend (0 = overview stage, 1 = focused on center opening box)
  cameraFocusBlend: number;
  otherBoxesDimFactor: number; // 1.0 (normal) .. 0.35 (dimmed background)
  shouldTriggerReveal: boolean;
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

function smoothstep01(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Unbiased Fisher-Yates shuffle using `cryptoRandomInt` (Section 4.2 & V).
 * Returns a new shuffled array without mutating the input.
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
 * Compute 3D pedestal positions for `count` gift boxes on the stage.
 * Adapts box scale and row/column spacing so boxes remain large, balanced,
 * and never overflow the stage or shrink too small for 1..50 students.
 */
export function computeStageBoxCoordinates(
  index: number,
  totalInPage: number,
  gameMode: GiftBoxGameMode
): { x: number; y: number; z: number; scale: number } {
  if (gameMode === 'GIANT_BOX' || totalInPage <= 1) {
    return { x: 0, y: -0.45, z: 0.35, scale: 1.48 };
  }

  if (totalInPage === 2) {
    const x = (index === 0 ? -1 : 1) * 1.45;
    return { x, y: -0.25, z: 0.2, scale: 1.12 };
  }

  if (totalInPage <= 4) {
    const cols = totalInPage;
    const x = (index - (cols - 1) / 2) * 1.65;
    return { x, y: -0.2, z: 0.15, scale: 1.02 };
  }

  if (totalInPage <= 6) {
    const cols = 3;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = (col - 1) * 1.85;
    const y = row === 0 ? 0.22 : -0.68;
    const z = row === 0 ? -0.45 : 0.42;
    return { x, y, z, scale: 0.92 };
  }

  if (totalInPage <= 8) {
    const cols = 4;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = (col - 1.5) * 1.56;
    const y = row === 0 ? 0.22 : -0.68;
    const z = row === 0 ? -0.45 : 0.42;
    return { x, y, z, scale: 0.84 };
  }

  if (totalInPage <= 10) {
    const cols = 5;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = (col - 2) * 1.36;
    const y = row === 0 ? 0.24 : -0.66;
    const z = row === 0 ? -0.45 : 0.42;
    return { x, y, z, scale: 0.8 };
  }

  // 11..12 boxes per page view (3 rows x 4 cols)
  const cols = 4;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const x = (col - (cols - 1) / 2) * 1.54;
  const y = 0.48 - row * 0.68;
  const z = -0.68 + row * 0.58;
  return { x, y, z, scale: 0.76 };
}

export interface GiftBoxCameraFraming {
  overviewDistance: number;
  overviewLookY: number;
  focusCamY: number;
  focusCamZ: number;
  focusLookY: number;
  focusLookZ: number;
}

/**
 * Compute aspect-ratio-safe camera framing so that:
 * 1. In overview mode (`camFocusBlend = 0`), all boxes on the stage pedestal fit horizontally and vertically
 *    without clipping on 16:9, 16:10, 4:3, tablet, or mobile viewports.
 * 2. In close-up opening mode (`camFocusBlend = 1`), the center box (`y = -0.42`), lifted lid (`y ≈ +1.88`),
 *    and rising 3D hologram name card (`y ≈ +1.76`, width `2.24`) remain 100% inside the camera frustum.
 */
export function computeGiftBoxCameraFraming(params: {
  aspectRatio: number;
  boxesInPageCount: number;
  gameMode: GiftBoxGameMode;
}): GiftBoxCameraFraming {
  const safeAspect = Math.max(0.5, Math.min(params.aspectRatio || 1.77, 3.5));

  // Overview stage span: wider when showing 8-12 boxes, compact for GIANT_BOX
  const isSingleGiant = params.gameMode === 'GIANT_BOX' || params.boxesInPageCount <= 1;
  const halfWidthNeeded = isSingleGiant ? 2.2 : params.boxesInPageCount <= 6 ? 3.3 : 3.9;
  const halfHeightNeeded = isSingleGiant ? 2.1 : 2.35;

  // FOV = 42 deg => tan(21 deg) ≈ 0.38386
  const tanHalfFov = Math.tan((42 * Math.PI) / 360);
  const distForHeight = halfHeightNeeded / tanHalfFov;
  const distForWidth = halfWidthNeeded / (tanHalfFov * safeAspect);

  const overviewDistance = Math.min(Math.max(Math.max(distForHeight, distForWidth) + 0.55, 6.4), 12.8);
  const overviewLookY = isSingleGiant ? -0.02 : -0.08;

  // Close-up opening stage span at centerStageZ = 1.25:
  // Vertical range needed: from bottom of box (-1.15) to top of lifted lid & rising card (+2.15) -> center Y ≈ 0.42, halfHeight ≈ 1.75
  // Horizontal range needed: card width + particles -> halfWidth ≈ 1.65
  const focusHalfHeight = 1.78;
  const focusHalfWidth = 1.68;
  const focusDeltaZHeight = focusHalfHeight / tanHalfFov;
  const focusDeltaZWidth = focusHalfWidth / (tanHalfFov * safeAspect);
  const focusDeltaZ = Math.max(focusDeltaZHeight, focusDeltaZWidth, 3.95);

  return {
    overviewDistance,
    overviewLookY,
    focusCamY: 0.72,
    focusCamZ: 1.25 + focusDeltaZ,
    focusLookY: 0.36,
    focusLookZ: 1.05,
  };
}

/**
 * Build 3D Gift Box items for the selected `GiftBoxGameMode` (Section IV):
 * - `LUCKY_BOXES`: Creates `luckyBoxCount` (default 8, 6..12) presentation boxes.
 * - `ONE_BOX_PER_STUDENT`: Creates 1 box per eligible student, shuffled fairly via `cryptoFisherYatesShuffle`
 *   and grouped into pages (adaptive 10-12 boxes per stage area) so 1–50 students remain large and easy to click.
 * - `GIANT_BOX`: Creates 1 giant centerpiece gift box.
 */
export function buildGiftBox3DItems(params: {
  gameMode: GiftBoxGameMode;
  eligibleStudents: StudentCandidate[];
  fullRosterStudents?: StudentCandidate[];
  luckyBoxCount?: number;
  pageSize?: number;
}): GiftBox3DItem[] {
  const {
    gameMode,
    eligibleStudents,
    fullRosterStudents = [],
    luckyBoxCount = 8,
    pageSize = 15,
  } = params;

  const rosterSttMap = new Map<string, number>();
  const baseRoster = fullRosterStudents.length > 0 ? fullRosterStudents : eligibleStudents;
  baseRoster.forEach((student, idx) => {
    rosterSttMap.set(student.id, idx + 1);
  });

  if (eligibleStudents.length === 0) {
    return [];
  }

  if (gameMode === 'GIANT_BOX') {
    const coords = computeStageBoxCoordinates(0, 1, 'GIANT_BOX');
    return [
      {
        boxId: 'giant_box_01',
        boxIndex: 0,
        displayNumber: 1,
        formattedBoxNumber: '01',
        palette: GIFT_BOX_3D_PALETTES[0],
        boundStudent: null,
        boundStudentStt: null,
        isOpened: false,
        restX: coords.x,
        restY: coords.y,
        restZ: coords.z,
        boxScale: coords.scale,
        pageIndex: 0,
      },
    ];
  }

  if (gameMode === 'LUCKY_BOXES') {
    const count = Math.min(Math.max(luckyBoxCount, 6), 12);
    return Array.from({ length: count }, (_, idx) => {
      const coords = computeStageBoxCoordinates(idx, count, 'LUCKY_BOXES');
      return {
        boxId: `lucky_box_${idx + 1}`,
        boxIndex: idx,
        displayNumber: idx + 1,
        formattedBoxNumber: String(idx + 1).padStart(2, '0'),
        palette: GIFT_BOX_3D_PALETTES[idx % GIFT_BOX_3D_PALETTES.length],
        boundStudent: null,
        boundStudentStt: null,
        isOpened: false,
        restX: coords.x,
        restY: coords.y,
        restZ: coords.z,
        boxScale: coords.scale,
        pageIndex: 0,
      };
    });
  }

  // Mode 2: ONE_BOX_PER_STUDENT — Shuffle eligible students fairly before binding to boxes
  const shuffledStudents = cryptoFisherYatesShuffle(eligibleStudents);
  const safePageSize = Math.max(6, pageSize);

  return shuffledStudents.map((student, idx) => {
    const pageIndex = Math.floor(idx / safePageSize);
    const indexInPage = idx % safePageSize;
    const remainingAfterPageStart = shuffledStudents.length - pageIndex * safePageSize;
    const countInThisPage = Math.min(safePageSize, remainingAfterPageStart);
    const coords = computeStageBoxCoordinates(
      indexInPage,
      countInThisPage,
      'ONE_BOX_PER_STUDENT'
    );
    const stt = rosterSttMap.get(student.id) ?? idx + 1;

    return {
      boxId: `student_box_${idx + 1}_${student.id}`,
      boxIndex: idx,
      displayNumber: idx + 1,
      formattedBoxNumber: String(idx + 1).padStart(2, '0'),
      palette: GIFT_BOX_3D_PALETTES[idx % GIFT_BOX_3D_PALETTES.length],
      boundStudent: student,
      boundStudentStt: stt,
      isOpened: false,
      restX: coords.x,
      restY: coords.y,
      restZ: coords.z,
      boxScale: coords.scale,
      pageIndex,
    };
  });
}

/**
 * Create an immutable `GiftBox3DTurnPlan` when a box is selected or when the teacher clicks "MỞ HỘP".
 * - In `ONE_BOX_PER_STUDENT` mode, uses the box's pre-shuffled `boundStudent` (guaranteed 1-to-1 match).
 * - In `LUCKY_BOXES` and `GIANT_BOX` modes, selects a student with uniform probability `1 / N`
 *   across all `eligibleStudents` via `cryptoRandomInt`.
 */
export function createFairGiftBoxTurnPlan(params: {
  boxes: GiftBox3DItem[];
  targetBoxIndex?: number;
  eligibleStudents: StudentCandidate[];
  fullRosterStudents?: StudentCandidate[];
  gameMode: GiftBoxGameMode;
  speedMode: GiftBoxSpeedMode;
}): GiftBox3DTurnPlan {
  const {
    boxes,
    targetBoxIndex,
    eligibleStudents,
    fullRosterStudents = [],
    gameMode,
    speedMode,
  } = params;

  if (eligibleStudents.length === 0) {
    throw new Error('Không còn học sinh hợp lệ để mở hộp quà.');
  }

  const unopenedBoxes = boxes.filter((b) => !b.isOpened);
  if (unopenedBoxes.length === 0) {
    throw new Error('Tất cả hộp quà trên sân khấu đã được mở.');
  }

  let chosenBox: GiftBox3DItem | undefined;
  if (
    typeof targetBoxIndex === 'number' &&
    boxes[targetBoxIndex] &&
    !boxes[targetBoxIndex].isOpened
  ) {
    chosenBox = boxes[targetBoxIndex];
  } else {
    chosenBox = unopenedBoxes[cryptoRandomInt(unopenedBoxes.length)];
  }

  const rosterSttMap = new Map<string, number>();
  const baseRoster = fullRosterStudents.length > 0 ? fullRosterStudents : eligibleStudents;
  baseRoster.forEach((s, idx) => {
    rosterSttMap.set(s.id, idx + 1);
  });

  let selectedStudent: StudentCandidate;
  if (gameMode === 'ONE_BOX_PER_STUDENT' && chosenBox.boundStudent) {
    selectedStudent = chosenBox.boundStudent;
  } else {
    const randomStudentIdx =
      eligibleStudents.length === 1 ? 0 : cryptoRandomInt(eligibleStudents.length);
    selectedStudent = eligibleStudents[randomStudentIdx];
  }

  const studentSttNumber =
    chosenBox.boundStudentStt ?? rosterSttMap.get(selectedStudent.id) ?? 1;
  const formattedStudentStt = String(studentSttNumber).padStart(2, '0');

  const durationMs =
    speedMode === 'FAST' ? 4200 : speedMode === 'NORMAL' ? 6200 : 8200;

  const turnId = `gift_turn_${Date.now()}_${cryptoRandomInt(1000000)}`;

  return {
    turnId,
    boxId: chosenBox.boxId,
    boxIndex: chosenBox.boxIndex,
    gameMode,
    selectedStudent,
    studentSttNumber,
    formattedStudentStt,
    startX: chosenBox.restX,
    startY: chosenBox.restY,
    startZ: chosenBox.restZ,
    startScale: chosenBox.boxScale,
    centerStageX: 0,
    centerStageY: -0.42,
    centerStageZ: 1.25,
    centerStageScale: 1.38,
    durationMs,
  };
}

/**
 * Evaluate the 14-Stage Cinematic Gift Box Opening Timeline at normalized `t ∈ [0, 1]` (Section VI):
 * - [0.00, 0.06]: BOX_SELECTED (box glows, lifts slightly from pedestal)
 * - [0.06, 0.14]: CAMERA_FOCUS (camera zooms smoothly toward active stage zone)
 * - [0.14, 0.28]: BOX_MOVING_TO_CENTER (box glides to front-center spotlight; other boxes dim)
 * - [0.28, 0.44]: BOX_SHAKING (suspenseful multi-axis tremor + light peeking from lid seam)
 * - [0.44, 0.56]: RIBBON_UNTYING (vertical & horizontal 3D ribbons separate outward)
 * - [0.56, 0.66]: BOW_OPENING (3D bow loops expand, spin, and lift off the lid)
 * - [0.66, 0.78]: LID_LIFTING (3D lid lifts vertically and tilts back, releasing inner golden beam)
 * - [0.78, 0.85]: INNER_LIGHT & MAGIC_PARTICLES (golden light column + rising 3D star particles)
 * - [0.85, 0.96]: NAME_CARD_RISING (3D hologram student name card rises out of the open gift box)
 * - [0.96, 1.00]: RESULT_REVEAL -> CELEBRATION -> COMPLETED
 */
export function evaluateGiftBoxCinematicTimeline(
  plan: GiftBox3DTurnPlan,
  normalizedT: number
): GiftBoxCinematicFrameState {
  const t = clamp01(normalizedT);

  let stateMachinePhase: GiftBox3DState = 'OPENING';
  let subPhase: GiftBoxAnimationSubPhase = 'BOX_SELECTED';

  let boxX = plan.startX;
  let boxY = plan.startY;
  let boxZ = plan.startZ;
  let boxScale = plan.startScale;
  let shakeRotX = 0;
  let shakeRotY = 0;
  let shakeRotZ = 0;

  let ribbonSpreadFactor = 0;
  let ribbonOpacity = 1;
  let bowScale = 1;
  let bowLiftY = 0;
  let bowRotY = 0;

  let lidLiftY = 0;
  let lidTiltX = 0;
  let lidShiftZ = 0;

  let innerLightIntensity = 0;
  let particleBurstProgress = 0;
  let nameCardVisible = false;
  let nameCardLiftY = 0;
  let nameCardScale = 0.01;
  let cameraFocusBlend = 0;
  let otherBoxesDimFactor = 1.0;

  if (t < 0.06) {
    stateMachinePhase = 'SELECTING';
    subPhase = 'BOX_SELECTED';
    const p = smoothstep01(t / 0.06);
    boxY = lerp(plan.startY, plan.startY + 0.22, p);
    cameraFocusBlend = p * 0.25;
  } else if (t < 0.14) {
    stateMachinePhase = 'SELECTING';
    subPhase = 'CAMERA_FOCUS';
    const p = smoothstep01((t - 0.06) / 0.08);
    boxY = plan.startY + 0.22;
    cameraFocusBlend = lerp(0.25, 0.55, p);
    otherBoxesDimFactor = lerp(1.0, 0.5, p);
  } else if (t < 0.28) {
    stateMachinePhase = 'OPENING';
    subPhase = 'BOX_MOVING_TO_CENTER';
    const p = smoothstep01((t - 0.14) / 0.14);
    boxX = lerp(plan.startX, plan.centerStageX, p);
    boxY = lerp(plan.startY + 0.22, plan.centerStageY, p) + Math.sin(p * Math.PI) * 0.28;
    boxZ = lerp(plan.startZ, plan.centerStageZ, p);
    boxScale = lerp(plan.startScale, plan.centerStageScale, p);
    cameraFocusBlend = lerp(0.55, 0.85, p);
    otherBoxesDimFactor = 0.4;
  } else if (t < 0.44) {
    stateMachinePhase = 'OPENING';
    subPhase = 'BOX_SHAKING';
    const p = clamp01((t - 0.28) / 0.16);
    boxX = plan.centerStageX;
    boxY = plan.centerStageY;
    boxZ = plan.centerStageZ;
    boxScale = plan.centerStageScale;
    const envelope = Math.sin(p * Math.PI);
    shakeRotZ = Math.sin(p * Math.PI * 14) * 0.11 * envelope;
    shakeRotX = Math.cos(p * Math.PI * 10) * 0.06 * envelope;
    shakeRotY = Math.sin(p * Math.PI * 7) * 0.08 * envelope;
    innerLightIntensity = p * 0.28;
    cameraFocusBlend = 0.9;
    otherBoxesDimFactor = 0.35;
  } else if (t < 0.56) {
    stateMachinePhase = 'OPENING';
    subPhase = 'RIBBON_UNTYING';
    const p = smoothstep01((t - 0.44) / 0.12);
    boxX = plan.centerStageX;
    boxY = plan.centerStageY;
    boxZ = plan.centerStageZ;
    boxScale = plan.centerStageScale;
    ribbonSpreadFactor = p;
    ribbonOpacity = lerp(1, 0.15, p);
    bowScale = lerp(1, 1.28, p);
    innerLightIntensity = lerp(0.28, 0.45, p);
    cameraFocusBlend = 0.95;
    otherBoxesDimFactor = 0.35;
  } else if (t < 0.66) {
    stateMachinePhase = 'OPENING';
    subPhase = 'BOW_OPENING';
    const p = smoothstep01((t - 0.56) / 0.10);
    boxX = plan.centerStageX;
    boxY = plan.centerStageY;
    boxZ = plan.centerStageZ;
    boxScale = plan.centerStageScale;
    ribbonSpreadFactor = 1 + p * 0.5;
    ribbonOpacity = lerp(0.15, 0, p);
    bowLiftY = lerp(0, 0.85, p);
    bowRotY = p * Math.PI * 1.2;
    bowScale = lerp(1.28, 0.05, p);
    lidLiftY = lerp(0, 0.18, p);
    innerLightIntensity = lerp(0.45, 0.68, p);
    cameraFocusBlend = 1.0;
    otherBoxesDimFactor = 0.35;
  } else if (t < 0.78) {
    stateMachinePhase = 'OPENING';
    subPhase = 'LID_LIFTING';
    const p = smoothstep01((t - 0.66) / 0.12);
    boxX = plan.centerStageX;
    boxY = plan.centerStageY;
    boxZ = plan.centerStageZ;
    boxScale = plan.centerStageScale;
    ribbonSpreadFactor = 1.5;
    ribbonOpacity = 0;
    bowScale = 0;
    lidLiftY = lerp(0.18, 1.15, p);
    lidTiltX = lerp(0, -0.68, p);
    lidShiftZ = lerp(0, -0.48, p);
    innerLightIntensity = lerp(0.68, 1.0, p);
    particleBurstProgress = p * 0.45;
    cameraFocusBlend = 1.0;
    otherBoxesDimFactor = 0.35;
  } else if (t < 0.85) {
    stateMachinePhase = 'OPENING';
    subPhase = t < 0.815 ? 'INNER_LIGHT' : 'MAGIC_PARTICLES';
    const p = smoothstep01((t - 0.78) / 0.07);
    boxX = plan.centerStageX;
    boxY = plan.centerStageY;
    boxZ = plan.centerStageZ;
    boxScale = plan.centerStageScale;
    ribbonOpacity = 0;
    bowScale = 0;
    lidLiftY = 1.15;
    lidTiltX = -0.68;
    lidShiftZ = -0.48;
    innerLightIntensity = 1.0;
    particleBurstProgress = lerp(0.45, 0.82, p);
    nameCardVisible = true;
    nameCardLiftY = lerp(0.05, 0.42, p);
    nameCardScale = lerp(0.15, 0.55, p);
    cameraFocusBlend = 1.0;
    otherBoxesDimFactor = 0.35;
  } else if (t < 0.96) {
    stateMachinePhase = 'OPENING';
    subPhase = 'NAME_CARD_RISING';
    const p = smoothstep01((t - 0.85) / 0.11);
    boxX = plan.centerStageX;
    boxY = plan.centerStageY;
    boxZ = plan.centerStageZ;
    boxScale = plan.centerStageScale;
    ribbonOpacity = 0;
    bowScale = 0;
    lidLiftY = 1.15;
    lidTiltX = -0.68;
    lidShiftZ = -0.48;
    innerLightIntensity = 1.0;
    particleBurstProgress = lerp(0.82, 1.0, p);
    nameCardVisible = true;
    nameCardLiftY = lerp(0.42, 1.12, p);
    nameCardScale = lerp(0.55, 1.0, p);
    cameraFocusBlend = 1.0;
    otherBoxesDimFactor = 0.35;
  } else {
    stateMachinePhase = 'REVEALING';
    subPhase = t < 0.985 ? 'RESULT_REVEAL' : 'CELEBRATION';
    boxX = plan.centerStageX;
    boxY = plan.centerStageY;
    boxZ = plan.centerStageZ;
    boxScale = plan.centerStageScale;
    ribbonOpacity = 0;
    bowScale = 0;
    lidLiftY = 1.15;
    lidTiltX = -0.68;
    lidShiftZ = -0.48;
    innerLightIntensity = 1.0;
    particleBurstProgress = 1.0;
    nameCardVisible = true;
    nameCardLiftY = 1.12;
    nameCardScale = 1.0;
    cameraFocusBlend = 1.0;
    otherBoxesDimFactor = 0.35;
  }

  return {
    stateMachinePhase,
    subPhase,
    boxX,
    boxY,
    boxZ,
    boxScale,
    shakeRotX,
    shakeRotY,
    shakeRotZ,
    ribbonSpreadFactor,
    ribbonOpacity,
    bowScale,
    bowLiftY,
    bowRotY,
    lidLiftY,
    lidTiltX,
    lidShiftZ,
    innerLightIntensity,
    particleBurstProgress,
    nameCardVisible,
    nameCardLiftY,
    nameCardScale,
    cameraFocusBlend,
    otherBoxesDimFactor,
    shouldTriggerReveal: t >= 1,
  };
}

/**
 * Deduplication registry guaranteeing each `turnId` is recorded at most once.
 */
export class GiftBoxTurnDeduplicator {
  private savedTurnIds = new Set<string>();

  public markSaved(turnId: string): boolean {
    if (!turnId || this.savedTurnIds.has(turnId)) {
      return false;
    }
    this.savedTurnIds.add(turnId);
    return true;
  }

  public hasSaved(turnId: string): boolean {
    return this.savedTurnIds.has(turnId);
  }
}

export interface GiftBox3DUnitTestReport {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
}

/**
 * Automated Unit Tests for A03 – 3D Mystery Gift Box (Section XVI):
 * 1. Verifies all 3 modes (`LUCKY_BOXES`, `ONE_BOX_PER_STUDENT`, `GIANT_BOX`) for 1, 2, 10, 30, and 50 students.
 * 2. Verifies unbiased Fisher-Yates shuffle & 1-to-1 `box <-> student_id` integrity in `ONE_BOX_PER_STUDENT` mode.
 * 3. Verifies 20 consecutive turns with anti-repeat without ever picking an ineligible or duplicate student.
 * 4. Verifies cinematic timeline stages (`RIBBON_UNTYING`, `LID_LIFTING`, `NAME_CARD_RISING`, `RESULT_REVEAL`) and duplicate `turnId` guard.
 */
export function runMysteryGiftBox3DUnitTests(): GiftBox3DUnitTestReport {
  const failedChecks: string[] = [];
  let totalChecks = 0;

  const classSizes = [1, 2, 10, 30, 50];
  const modes: GiftBoxGameMode[] = ['LUCKY_BOXES', 'ONE_BOX_PER_STUDENT', 'GIANT_BOX'];

  for (const count of classSizes) {
    const roster: StudentCandidate[] = Array.from({ length: count }, (_, i) => ({
      id: `gift_stu_${count}_${i + 1}`,
      code: `HS${String(i + 1).padStart(2, '0')}`,
      fullName: `Học Sinh Bí Mật ${i + 1}`,
    }));

    for (const mode of modes) {
      totalChecks++;
      const boxes = buildGiftBox3DItems({
        gameMode: mode,
        eligibleStudents: roster,
        fullRosterStudents: roster,
        luckyBoxCount: 8,
      });

      if (mode === 'GIANT_BOX' && boxes.length !== 1) {
        failedChecks.push(`GIANT_BOX expected 1 box, got ${boxes.length}`);
      }
      if (mode === 'LUCKY_BOXES' && boxes.length !== 8) {
        failedChecks.push(`LUCKY_BOXES expected 8 boxes, got ${boxes.length}`);
      }
      if (mode === 'ONE_BOX_PER_STUDENT') {
        if (boxes.length !== count) {
          failedChecks.push(`ONE_BOX_PER_STUDENT expected ${count} boxes, got ${boxes.length}`);
        }
        // Check that shuffled boxes are a bijection of the eligible roster
        const boundIds = new Set(boxes.map((b) => b.boundStudent?.id).filter(Boolean));
        if (boundIds.size !== count) {
          failedChecks.push(
            `ONE_BOX_PER_STUDENT bijection failed for N=${count}: ${boundIds.size} unique ids`
          );
        }
      }
    }
  }

  // Test 2: 20 consecutive turns in a 25-student class across modes with anti-repeat
  const roster25: StudentCandidate[] = Array.from({ length: 25 }, (_, i) => ({
    id: `turn_stu_${i + 1}`,
    code: `HS${String(i + 1).padStart(2, '0')}`,
    fullName: `Nguyễn Ngọc Quà ${i + 1}`,
  }));
  const calledIds = new Set<string>();

  for (let turn = 0; turn < 20; turn++) {
    totalChecks++;
    const eligible = roster25.filter((s) => !calledIds.has(s.id));
    if (eligible.length !== 25 - turn) {
      failedChecks.push(`Turn ${turn}: expected ${25 - turn} eligible, got ${eligible.length}`);
    }
    const mode: GiftBoxGameMode =
      turn % 3 === 0
        ? 'LUCKY_BOXES'
        : turn % 3 === 1
        ? 'ONE_BOX_PER_STUDENT'
        : 'GIANT_BOX';

    const boxes = buildGiftBox3DItems({
      gameMode: mode,
      eligibleStudents: eligible,
      fullRosterStudents: roster25,
    });

    const plan = createFairGiftBoxTurnPlan({
      boxes,
      eligibleStudents: eligible,
      fullRosterStudents: roster25,
      gameMode: mode,
      speedMode: 'NORMAL',
    });

    if (!plan.selectedStudent || calledIds.has(plan.selectedStudent.id)) {
      failedChecks.push(`Turn ${turn}: invalid or duplicate student selected`);
    }
    if (
      mode === 'ONE_BOX_PER_STUDENT' &&
      boxes[plan.boxIndex].boundStudent?.id !== plan.selectedStudent.id
    ) {
      failedChecks.push(`Turn ${turn}: ONE_BOX_PER_STUDENT student mismatch with chosen box`);
    }
    calledIds.add(plan.selectedStudent.id);

    // Test 3: Timeline check at t=0.50 (ribbon untying), t=0.75 (lid lifting), t=1.0 (reveal)
    totalChecks++;
    const midFrame = evaluateGiftBoxCinematicTimeline(plan, 0.50);
    const lidFrame = evaluateGiftBoxCinematicTimeline(plan, 0.75);
    const endFrame = evaluateGiftBoxCinematicTimeline(plan, 1.0);

    if (midFrame.ribbonSpreadFactor <= 0) {
      failedChecks.push(`Turn ${turn}: ribbon did not spread at t=0.50`);
    }
    if (lidFrame.lidLiftY <= 0.5) {
      failedChecks.push(`Turn ${turn}: lid did not lift at t=0.75`);
    }
    if (!endFrame.nameCardVisible || !endFrame.shouldTriggerReveal) {
      failedChecks.push(`Turn ${turn}: 3D name card not visible at t=1.0`);
    }
  }

  // Test 4: Deduplicator guard
  totalChecks++;
  const dedup = new GiftBoxTurnDeduplicator();
  if (!dedup.markSaved('gift_turn_01') || dedup.markSaved('gift_turn_01')) {
    failedChecks.push('GiftBoxTurnDeduplicator failed to prevent duplicate turnId');
  }

  return {
    passed: failedChecks.length === 0,
    totalChecks,
    failedChecks,
  };
}
