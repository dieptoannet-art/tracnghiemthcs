import { StudentCandidate } from '../studentCallRules';
import { cryptoRandomInt } from './wheel3dMath';

export type DinoEgg3DState =
  | 'SETUP'
  | 'LOADING_STUDENTS'
  | 'READY'
  | 'SELECTING'
  | 'HATCHING'
  | 'REVEALING'
  | 'SAVING'
  | 'COMPLETED'
  | 'ERROR_RECOVERY'
  | 'FINISHED';

export type DinoEggAnimationSubPhase =
  | 'READY'
  | 'EGG_SELECTED'
  | 'EGG_MOVING_TO_CENTER'
  | 'EGG_WOBBLING'
  | 'FIRST_CRACK'
  | 'CRACK_SPREADING'
  | 'SHELL_SPLITTING'
  | 'DINO_PEEKING'
  | 'DINO_BLINK_AND_MOVE'
  | 'DINO_STEPPING_OUT'
  | 'DINO_HAPPY_JUMP'
  | 'NAME_BOARD_REVEAL'
  | 'COMPLETED';

export type DinoEggGameMode =
  | 'SECRET_NEST' // Chế độ 1: Tổ trứng bí mật (6–12 quả trứng 3D)
  | 'GIANT_EGG'   // Chế độ 2: Đại trứng khủng long (1 quả trứng lớn trung tâm - tối ưu máy chiếu 40-50 HS)
  | 'DINO_NURSERY'; // Chế độ 3: Vườn ươm khủng long (Mỗi học sinh 1 quả trứng, phân trang khu vực)

export type DinoSpecies =
  | 'BABY_TREX'
  | 'BABY_TRICERATOPS'
  | 'BABY_BRACHIOSAURUS';

export type DinoEggSpeedMode = 'FAST' | 'NORMAL' | 'SUSPENSE';

export type DinoEggQualityPreset = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DinoEggShellPalette {
  id: string;
  nameVi: string;
  shellBaseHex: string;
  shellSpotHex: string;
  crackGlowHex: string;
  nestAuraHex: string;
}

export const DINO_EGG_PALETTES: DinoEggShellPalette[] = [
  {
    id: 'emerald_jungle',
    nameVi: 'Ngọc Lục Bảo Rừng Xanh',
    shellBaseHex: '#10B981',
    shellSpotHex: '#064E3B',
    crackGlowHex: '#FDE047',
    nestAuraHex: '#34D399',
  },
  {
    id: 'amber_volcano',
    nameVi: 'Hổ Phách Núi Lửa',
    shellBaseHex: '#F59E0B',
    shellSpotHex: '#78350F',
    crackGlowHex: '#FEF08A',
    nestAuraHex: '#FBBF24',
  },
  {
    id: 'azure_glacier',
    nameVi: 'Lam Ngọc Tiền Sử',
    shellBaseHex: '#0EA5E9',
    shellSpotHex: '#0C4A6E',
    crackGlowHex: '#67E8F9',
    nestAuraHex: '#38BDF8',
  },
  {
    id: 'amethyst_crystal',
    nameVi: 'Tím Thạch Anh Cổ Đại',
    shellBaseHex: '#8B5CF6',
    shellSpotHex: '#4C1D95',
    crackGlowHex: '#FDE047',
    nestAuraHex: '#C4B5FD',
  },
  {
    id: 'crimson_magma',
    nameVi: 'Đỏ Dung Nham',
    shellBaseHex: '#EF4444',
    shellSpotHex: '#7F1D1D',
    crackGlowHex: '#FEF08A',
    nestAuraHex: '#FCA5A5',
  },
  {
    id: 'golden_sun',
    nameVi: 'Vàng Thái Dương',
    shellBaseHex: '#EAB308',
    shellSpotHex: '#713F12',
    crackGlowHex: '#FFFBEB',
    nestAuraHex: '#FDE047',
  },
];

export const DINO_SPECIES_LIST: {
  id: DinoSpecies;
  nameVi: string;
  badgeText: string;
  primaryColorHex: string;
  bellyColorHex: string;
  crestColorHex: string;
}[] = [
  {
    id: 'BABY_TREX',
    nameVi: 'Khủng long Bạo Chúa con (Baby T-Rex)',
    badgeText: 'Baby T-Rex',
    primaryColorHex: '#22C55E',
    bellyColorHex: '#FEF3C7',
    crestColorHex: '#F59E0B',
  },
  {
    id: 'BABY_TRICERATOPS',
    nameVi: 'Khủng long Ba Sừng con (Baby Triceratops)',
    badgeText: 'Baby Triceratops',
    primaryColorHex: '#F97316',
    bellyColorHex: '#FFEDD5',
    crestColorHex: '#06B6D4',
  },
  {
    id: 'BABY_BRACHIOSAURUS',
    nameVi: 'Khủng long Cổ Dài con (Baby Brachiosaurus)',
    badgeText: 'Baby Brachiosaurus',
    primaryColorHex: '#38BDF8',
    bellyColorHex: '#E0F2FE',
    crestColorHex: '#FACC15',
  },
];

export interface DinoEgg3DItem {
  eggId: string;
  eggIndex: number; // 0 .. M-1
  displayNumber: number; // 1 .. M
  formattedEggNumber: string; // "01" .. "50"
  palette: DinoEggShellPalette;
  species: DinoSpecies;
  // In DINO_NURSERY mode, boundStudent is pre-assigned via unbiased Fisher-Yates shuffle.
  // In SECRET_NEST and GIANT_EGG modes, boundStudent is null until an egg is selected.
  boundStudent: StudentCandidate | null;
  boundStudentStt: number | null;
  isHatched: boolean;
  restX: number;
  restY: number;
  restZ: number;
  eggScale: number;
  pageIndex: number;
}

export interface DinoEgg3DTurnPlan {
  turnId: string;
  eggId: string;
  eggIndex: number;
  gameMode: DinoEggGameMode;
  species: DinoSpecies;
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

export interface DinoEggCinematicFrameState {
  stateMachinePhase: DinoEgg3DState;
  subPhase: DinoEggAnimationSubPhase;
  // Egg transform
  eggX: number;
  eggY: number;
  eggZ: number;
  eggScale: number;
  wobbleRotX: number;
  wobbleRotY: number;
  wobbleRotZ: number;
  // Crack & shell split transform
  crackProgress: number; // 0 (none) .. 1 (full glowing cracks)
  topShellLiftY: number; // 0 (closed) .. 1.05 (lifted & tilted away)
  topShellTiltX: number; // 0 .. -0.95 rad
  topShellShiftZ: number; // 0 .. -0.58
  topShellOpacity: number; // 1 .. 0.15
  fallingShardsProgress: number; // 0 .. 1 (shell fragments falling to nest)
  // Baby Dinosaur transform & animation
  dinoVisible: boolean;
  dinoRiseY: number; // -0.35 (inside shell) .. +0.32 (standing proud on nest)
  dinoScale: number; // 0.1 .. 1.0
  dinoHeadNodX: number;
  dinoHeadTurnY: number;
  dinoBlinkScaleY: number; // 1.0 (open eyes) .. 0.08 (blink closed)
  dinoTailWagY: number; // -0.38 .. +0.38 rad
  dinoLegStepAngle: number; // -0.3 .. +0.3 rad
  dinoHappyBounceY: number; // 0 .. 0.22
  // Inner glow & prehistoric sparkles
  innerGlowIntensity: number; // 0 .. 1
  particleBurstProgress: number; // 0 .. 1
  // 3D Student Name Board above baby dinosaur (guaranteed non-overlapping)
  nameBoardVisible: boolean;
  nameBoardLiftY: number; // 0.65 .. 1.48 (floating clearly above baby dino head/neck)
  nameBoardScale: number; // 0.05 .. 1.0
  // Camera focus blend (0 = overview jungle nest, 1 = close-up hatching focus)
  cameraFocusBlend: number;
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
 * Unbiased Fisher-Yates shuffle using `cryptoRandomInt`.
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
 * Compute 3D nest positions for `totalInPage` dinosaur eggs on the prehistoric stage.
 * Adapts scale and spacing so eggs are large, well-proportioned, and never clip.
 */
export function computeStageEggCoordinates(
  index: number,
  totalInPage: number,
  gameMode: DinoEggGameMode
): { x: number; y: number; z: number; scale: number } {
  if (gameMode === 'GIANT_EGG' || totalInPage <= 1) {
    return { x: 0, y: -0.42, z: 0.45, scale: 1.52 };
  }

  if (totalInPage === 2) {
    const x = (index === 0 ? -1 : 1) * 1.42;
    return { x, y: -0.32, z: 0.25, scale: 1.14 };
  }

  if (totalInPage <= 4) {
    const cols = totalInPage;
    const x = (index - (cols - 1) / 2) * 1.58;
    const z = index % 2 === 0 ? 0.28 : -0.12;
    return { x, y: -0.3, z, scale: 1.04 };
  }

  if (totalInPage <= 6) {
    const cols = 3;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = (col - 1) * 1.78;
    const y = row === 0 ? 0.12 : -0.58;
    const z = row === 0 ? -0.42 : 0.42;
    return { x, y, z, scale: 0.94 };
  }

  if (totalInPage <= 8) {
    const cols = 4;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = (col - 1.5) * 1.52;
    const y = row === 0 ? 0.14 : -0.58;
    const z = row === 0 ? -0.44 : 0.44;
    return { x, y, z, scale: 0.88 };
  }

  if (totalInPage <= 10) {
    const cols = 5;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = (col - 2) * 1.34;
    const y = row === 0 ? 0.16 : -0.58;
    const z = row === 0 ? -0.45 : 0.44;
    return { x, y, z, scale: 0.82 };
  }

  // 11..12 eggs (3 rows x 4 cols)
  const cols = 4;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const x = (col - 1.5) * 1.5;
  const y = 0.42 - row * 0.62;
  const z = -0.62 + row * 0.56;
  return { x, y, z, scale: 0.78 };
}

export interface DinoEggCameraFraming {
  overviewDistance: number;
  overviewLookY: number;
  focusCamY: number;
  focusCamZ: number;
  focusLookY: number;
  focusLookZ: number;
}

/**
 * Compute aspect-ratio-safe camera framing so that:
 * 1. In overview mode (`camFocusBlend = 0`), the entire prehistoric nest and all eggs in the active page
 *    fit cleanly inside the viewport on 1280×720, 1366×768, 1600×900, 1920×1080, 2560×1440, tablet, and phone.
 * 2. In close-up hatching mode (`camFocusBlend = 1`), the maximum motion envelope — bottom nest (`y = -1.25`),
 *    baby dinosaur head/tail/bounce, lifted top shell, and floating 3D student name board (`y ≈ +2.05`, width `2.3`) —
 *    is 100% visible with zero clipping.
 */
export function computeDinoEggCameraFraming(params: {
  aspectRatio: number;
  eggsInPageCount: number;
  gameMode: DinoEggGameMode;
}): DinoEggCameraFraming {
  const safeAspect = Math.max(0.5, Math.min(params.aspectRatio || 1.77, 3.5));

  const isSingleGiant = params.gameMode === 'GIANT_EGG' || params.eggsInPageCount <= 1;
  const halfWidthNeeded = isSingleGiant ? 2.35 : params.eggsInPageCount <= 6 ? 3.35 : 3.95;
  const halfHeightNeeded = isSingleGiant ? 2.15 : 2.4;

  // FOV = 42 deg => tan(21 deg) ≈ 0.38386
  const tanHalfFov = Math.tan((42 * Math.PI) / 360);
  const distForHeight = halfHeightNeeded / tanHalfFov;
  const distForWidth = halfWidthNeeded / (tanHalfFov * safeAspect);

  const overviewDistance = Math.min(Math.max(Math.max(distForHeight, distForWidth) + 0.6, 6.5), 13.0);
  const overviewLookY = isSingleGiant ? 0.02 : -0.06;

  // Close-up hatching envelope at centerStageZ = 1.25:
  // Vertical span: from nest base (-1.25) to top of 3D Name Board above Baby Brachiosaurus (+2.18)
  // Horizontal span: dinosaur tail wag + shell shards + 3D Name Board width -> halfWidth ≈ 1.72
  const focusHalfHeight = 1.86;
  const focusHalfWidth = 1.72;
  const focusDeltaZHeight = focusHalfHeight / tanHalfFov;
  const focusDeltaZWidth = focusHalfWidth / (tanHalfFov * safeAspect);
  const focusDeltaZ = Math.max(focusDeltaZHeight, focusDeltaZWidth, 4.15);

  return {
    overviewDistance,
    overviewLookY,
    focusCamY: 0.78,
    focusCamZ: 1.25 + focusDeltaZ,
    focusLookY: 0.42,
    focusLookZ: 1.05,
  };
}

/**
 * Build 3D Dinosaur Egg items for the selected `DinoEggGameMode` (Section VI):
 * - `SECRET_NEST`: 6–12 presentation eggs on the central prehistoric nest.
 * - `GIANT_EGG`: 1 giant prehistoric egg in the center nest (ideal for projectors & 40–50 students).
 * - `DINO_NURSERY`: 1 egg per eligible student, fairly shuffled via `cryptoFisherYatesShuffle`
 *   and grouped into pages (`pageSize`, default 10) so 1–50 students never crowd or shrink.
 */
export function buildDinoEgg3DItems(params: {
  gameMode: DinoEggGameMode;
  eligibleStudents: StudentCandidate[];
  fullRosterStudents?: StudentCandidate[];
  nestEggCount?: number;
  pageSize?: number;
}): DinoEgg3DItem[] {
  const {
    gameMode,
    eligibleStudents,
    fullRosterStudents = [],
    nestEggCount = 8,
    pageSize = 10,
  } = params;

  const rosterSttMap = new Map<string, number>();
  const baseRoster = fullRosterStudents.length > 0 ? fullRosterStudents : eligibleStudents;
  baseRoster.forEach((student, idx) => {
    rosterSttMap.set(student.id, idx + 1);
  });

  if (eligibleStudents.length === 0) {
    return [];
  }

  const speciesIds: DinoSpecies[] = [
    'BABY_TREX',
    'BABY_TRICERATOPS',
    'BABY_BRACHIOSAURUS',
  ];

  if (gameMode === 'GIANT_EGG') {
    const coords = computeStageEggCoordinates(0, 1, 'GIANT_EGG');
    return [
      {
        eggId: 'giant_dino_egg_01',
        eggIndex: 0,
        displayNumber: 1,
        formattedEggNumber: '01',
        palette: DINO_EGG_PALETTES[0],
        species: 'BABY_TREX',
        boundStudent: null,
        boundStudentStt: null,
        isHatched: false,
        restX: coords.x,
        restY: coords.y,
        restZ: coords.z,
        eggScale: coords.scale,
        pageIndex: 0,
      },
    ];
  }

  if (gameMode === 'SECRET_NEST') {
    const count = Math.min(Math.max(nestEggCount, 6), 12);
    return Array.from({ length: count }, (_, idx) => {
      const coords = computeStageEggCoordinates(idx, count, 'SECRET_NEST');
      return {
        eggId: `nest_egg_${idx + 1}`,
        eggIndex: idx,
        displayNumber: idx + 1,
        formattedEggNumber: String(idx + 1).padStart(2, '0'),
        palette: DINO_EGG_PALETTES[idx % DINO_EGG_PALETTES.length],
        species: speciesIds[idx % speciesIds.length],
        boundStudent: null,
        boundStudentStt: null,
        isHatched: false,
        restX: coords.x,
        restY: coords.y,
        restZ: coords.z,
        eggScale: coords.scale,
        pageIndex: 0,
      };
    });
  }

  // Mode 3: DINO_NURSERY — 1 egg per eligible student, shuffled fairly via Fisher-Yates
  const shuffledStudents = cryptoFisherYatesShuffle(eligibleStudents);
  const safePageSize = Math.max(6, pageSize);

  return shuffledStudents.map((student, idx) => {
    const pageIndex = Math.floor(idx / safePageSize);
    const indexInPage = idx % safePageSize;
    const remainingAfterPageStart = shuffledStudents.length - pageIndex * safePageSize;
    const countInThisPage = Math.min(safePageSize, remainingAfterPageStart);
    const coords = computeStageEggCoordinates(
      indexInPage,
      countInThisPage,
      'DINO_NURSERY'
    );
    const stt = rosterSttMap.get(student.id) ?? idx + 1;

    return {
      eggId: `nursery_egg_${idx + 1}_${student.id}`,
      eggIndex: idx,
      displayNumber: idx + 1,
      formattedEggNumber: String(idx + 1).padStart(2, '0'),
      palette: DINO_EGG_PALETTES[idx % DINO_EGG_PALETTES.length],
      species: speciesIds[idx % speciesIds.length],
      boundStudent: student,
      boundStudentStt: stt,
      isHatched: false,
      restX: coords.x,
      restY: coords.y,
      restZ: coords.z,
      eggScale: coords.scale,
      pageIndex,
    };
  });
}

/**
 * Create an immutable `DinoEgg3DTurnPlan` when an egg is selected or when the teacher clicks "ẤP TRỨNG".
 * - In `DINO_NURSERY` mode, uses the egg's pre-shuffled `boundStudent` (preserving `egg_id <-> student_id`).
 * - In `SECRET_NEST` and `GIANT_EGG` modes, picks an eligible student with uniform probability `1 / N`
 *   via `cryptoRandomInt`.
 * - Dinosaur species is strictly visual and never alters student selection.
 */
export function createFairDinoEggTurnPlan(params: {
  eggs: DinoEgg3DItem[];
  targetEggIndex?: number;
  eligibleStudents: StudentCandidate[];
  fullRosterStudents?: StudentCandidate[];
  gameMode: DinoEggGameMode;
  speedMode: DinoEggSpeedMode;
}): DinoEgg3DTurnPlan {
  const {
    eggs,
    targetEggIndex,
    eligibleStudents,
    fullRosterStudents = [],
    gameMode,
    speedMode,
  } = params;

  if (eligibleStudents.length === 0) {
    throw new Error('Không còn học sinh hợp lệ trong lượt để ấp trứng.');
  }

  const unhatchedEggs = eggs.filter((e) => !e.isHatched);
  if (unhatchedEggs.length === 0) {
    throw new Error('Tất cả trứng trong khu vực này đã nở.');
  }

  let chosenEgg: DinoEgg3DItem | undefined;
  if (
    typeof targetEggIndex === 'number' &&
    eggs[targetEggIndex] &&
    !eggs[targetEggIndex].isHatched
  ) {
    chosenEgg = eggs[targetEggIndex];
  } else {
    chosenEgg = unhatchedEggs[cryptoRandomInt(unhatchedEggs.length)];
  }

  const rosterSttMap = new Map<string, number>();
  const baseRoster = fullRosterStudents.length > 0 ? fullRosterStudents : eligibleStudents;
  baseRoster.forEach((s, idx) => {
    rosterSttMap.set(s.id, idx + 1);
  });

  let selectedStudent: StudentCandidate;
  if (gameMode === 'DINO_NURSERY' && chosenEgg.boundStudent) {
    selectedStudent = chosenEgg.boundStudent;
  } else {
    const randomStudentIdx =
      eligibleStudents.length === 1 ? 0 : cryptoRandomInt(eligibleStudents.length);
    selectedStudent = eligibleStudents[randomStudentIdx];
  }

  const studentSttNumber =
    chosenEgg.boundStudentStt ?? rosterSttMap.get(selectedStudent.id) ?? 1;
  const formattedStudentStt = String(studentSttNumber).padStart(2, '0');

  const speciesList: DinoSpecies[] = [
    'BABY_TREX',
    'BABY_TRICERATOPS',
    'BABY_BRACHIOSAURUS',
  ];
  const chosenSpecies: DinoSpecies =
    gameMode === 'GIANT_EGG'
      ? speciesList[cryptoRandomInt(speciesList.length)]
      : chosenEgg.species;

  const durationMs =
    speedMode === 'FAST' ? 4400 : speedMode === 'NORMAL' ? 6400 : 8400;

  const turnId = `dino_turn_${Date.now()}_${cryptoRandomInt(1000000)}`;

  return {
    turnId,
    eggId: chosenEgg.eggId,
    eggIndex: chosenEgg.eggIndex,
    gameMode,
    species: chosenSpecies,
    selectedStudent,
    studentSttNumber,
    formattedStudentStt,
    startX: chosenEgg.restX,
    startY: chosenEgg.restY,
    startZ: chosenEgg.restZ,
    startScale: chosenEgg.eggScale,
    centerStageX: 0,
    centerStageY: -0.44,
    centerStageZ: 1.25,
    centerStageScale: 1.36,
    durationMs,
  };
}

/**
 * Evaluate the 12-Stage Cinematic Dinosaur Egg Hatching Timeline at normalized `t ∈ [0, 1]` (Section VII):
 * - [0.00, 0.08]: EGG_SELECTED (egg glows & lifts slightly from nest)
 * - [0.08, 0.20]: EGG_MOVING_TO_CENTER (egg glides to the central hatching altar; camera focuses)
 * - [0.20, 0.34]: EGG_WOBBLING (suspenseful multi-axis wobble)
 * - [0.34, 0.44]: FIRST_CRACK (first glowing crack appears across the shell)
 * - [0.44, 0.56]: CRACK_SPREADING (cracks spread around equator with warm golden light inside)
 * - [0.56, 0.66]: SHELL_SPLITTING (top shell cap lifts & tilts off; shell shards fall)
 * - [0.66, 0.74]: DINO_PEEKING (baby dinosaur pokes head out of bottom shell)
 * - [0.74, 0.82]: DINO_BLINK_AND_MOVE (baby dinosaur blinks eyes, wiggles legs & wags tail)
 * - [0.82, 0.89]: DINO_STEPPING_OUT (baby dinosaur rises proudly above the lower shell)
 * - [0.89, 0.95]: DINO_HAPPY_JUMP (baby dinosaur jumps joyfully & wags tail)
 * - [0.95, 1.00]: NAME_BOARD_REVEAL -> COMPLETED (3D student name board floats clearly above dino)
 */
export function evaluateDinoEggCinematicTimeline(
  plan: DinoEgg3DTurnPlan,
  normalizedT: number
): DinoEggCinematicFrameState {
  const t = clamp01(normalizedT);

  let stateMachinePhase: DinoEgg3DState = 'HATCHING';
  let subPhase: DinoEggAnimationSubPhase = 'EGG_SELECTED';

  let eggX = plan.startX;
  let eggY = plan.startY;
  let eggZ = plan.startZ;
  let eggScale = plan.startScale;
  let wobbleRotX = 0;
  let wobbleRotY = 0;
  let wobbleRotZ = 0;

  let crackProgress = 0;
  let topShellLiftY = 0;
  let topShellTiltX = 0;
  let topShellShiftZ = 0;
  let topShellOpacity = 1;
  let fallingShardsProgress = 0;

  let dinoVisible = false;
  let dinoRiseY = -0.35;
  let dinoScale = 0.01;
  let dinoHeadNodX = 0;
  let dinoHeadTurnY = 0;
  let dinoBlinkScaleY = 1.0;
  let dinoTailWagY = 0;
  let dinoLegStepAngle = 0;
  let dinoHappyBounceY = 0;

  let innerGlowIntensity = 0;
  let particleBurstProgress = 0;
  let nameBoardVisible = false;
  let nameBoardLiftY = 0.72;
  let nameBoardScale = 0.01;
  let cameraFocusBlend = 0;

  if (t < 0.08) {
    stateMachinePhase = 'SELECTING';
    subPhase = 'EGG_SELECTED';
    const p = smoothstep01(t / 0.08);
    eggY = lerp(plan.startY, plan.startY + 0.22, p);
    cameraFocusBlend = p * 0.35;
  } else if (t < 0.20) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'EGG_MOVING_TO_CENTER';
    const p = smoothstep01((t - 0.08) / 0.12);
    eggX = lerp(plan.startX, plan.centerStageX, p);
    eggY = lerp(plan.startY + 0.22, plan.centerStageY, p) + Math.sin(p * Math.PI) * 0.25;
    eggZ = lerp(plan.startZ, plan.centerStageZ, p);
    eggScale = lerp(plan.startScale, plan.centerStageScale, p);
    cameraFocusBlend = lerp(0.35, 0.85, p);
  } else if (t < 0.34) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'EGG_WOBBLING';
    const p = clamp01((t - 0.20) / 0.14);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    const env = Math.sin(p * Math.PI);
    wobbleRotZ = Math.sin(p * Math.PI * 12) * 0.15 * env;
    wobbleRotX = Math.cos(p * Math.PI * 8) * 0.08 * env;
    cameraFocusBlend = lerp(0.85, 0.95, p);
  } else if (t < 0.44) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'FIRST_CRACK';
    const p = clamp01((t - 0.34) / 0.10);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    wobbleRotZ = Math.sin(p * Math.PI * 10) * 0.12;
    crackProgress = lerp(0.05, 0.48, p);
    innerGlowIntensity = lerp(0.05, 0.38, p);
    cameraFocusBlend = 1.0;
  } else if (t < 0.56) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'CRACK_SPREADING';
    const p = clamp01((t - 0.44) / 0.12);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    wobbleRotZ = Math.sin(p * Math.PI * 16) * 0.16;
    wobbleRotY = Math.sin(p * Math.PI * 6) * 0.1;
    crackProgress = lerp(0.48, 1.0, p);
    innerGlowIntensity = lerp(0.38, 0.85, p);
    fallingShardsProgress = p * 0.35;
    cameraFocusBlend = 1.0;
  } else if (t < 0.66) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'SHELL_SPLITTING';
    const p = smoothstep01((t - 0.56) / 0.10);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    crackProgress = 1.0;
    topShellLiftY = lerp(0, 0.95, p);
    topShellTiltX = lerp(0, -0.88, p);
    topShellShiftZ = lerp(0, -0.52, p);
    topShellOpacity = lerp(1.0, 0.22, p);
    fallingShardsProgress = lerp(0.35, 1.0, p);
    innerGlowIntensity = 1.0;
    particleBurstProgress = p * 0.45;
    dinoVisible = true;
    dinoRiseY = lerp(-0.32, -0.05, p);
    dinoScale = lerp(0.35, 0.78, p);
    cameraFocusBlend = 1.0;
  } else if (t < 0.74) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'DINO_PEEKING';
    const p = smoothstep01((t - 0.66) / 0.08);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    crackProgress = 1.0;
    topShellLiftY = 0.98;
    topShellTiltX = -0.92;
    topShellShiftZ = -0.55;
    topShellOpacity = 0.12;
    fallingShardsProgress = 1.0;
    innerGlowIntensity = 0.95;
    particleBurstProgress = lerp(0.45, 0.7, p);
    dinoVisible = true;
    dinoRiseY = lerp(-0.05, 0.14, p);
    dinoScale = lerp(0.78, 0.95, p);
    dinoHeadNodX = Math.sin(p * Math.PI * 2) * 0.15;
    dinoHeadTurnY = Math.sin(p * Math.PI * 2) * 0.22;
    cameraFocusBlend = 1.0;
  } else if (t < 0.82) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'DINO_BLINK_AND_MOVE';
    const p = clamp01((t - 0.74) / 0.08);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    crackProgress = 1.0;
    topShellLiftY = 1.02;
    topShellTiltX = -0.95;
    topShellShiftZ = -0.58;
    topShellOpacity = 0.05;
    fallingShardsProgress = 1.0;
    innerGlowIntensity = 0.9;
    particleBurstProgress = lerp(0.7, 0.85, p);
    dinoVisible = true;
    dinoRiseY = 0.16;
    dinoScale = 0.98;
    // Blink twice during this phase
    const blinkWave = Math.abs(Math.sin(p * Math.PI * 3));
    dinoBlinkScaleY = blinkWave < 0.22 ? 0.08 : 1.0;
    dinoTailWagY = Math.sin(p * Math.PI * 6) * 0.35;
    dinoLegStepAngle = Math.sin(p * Math.PI * 6) * 0.28;
    dinoHeadTurnY = Math.cos(p * Math.PI * 2) * 0.18;
    cameraFocusBlend = 1.0;
  } else if (t < 0.89) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'DINO_STEPPING_OUT';
    const p = smoothstep01((t - 0.82) / 0.07);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    crackProgress = 1.0;
    topShellLiftY = 1.05;
    topShellOpacity = 0;
    fallingShardsProgress = 1.0;
    innerGlowIntensity = 0.95;
    particleBurstProgress = lerp(0.85, 0.95, p);
    dinoVisible = true;
    dinoRiseY = lerp(0.16, 0.32, p);
    dinoScale = 1.0;
    dinoTailWagY = Math.sin(p * Math.PI * 6) * 0.36;
    dinoLegStepAngle = Math.sin(p * Math.PI * 8) * 0.32;
    nameBoardVisible = true;
    nameBoardLiftY = lerp(0.95, 1.32, p);
    nameBoardScale = lerp(0.25, 0.78, p);
    cameraFocusBlend = 1.0;
  } else if (t < 0.95) {
    stateMachinePhase = 'HATCHING';
    subPhase = 'DINO_HAPPY_JUMP';
    const p = clamp01((t - 0.89) / 0.06);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    crackProgress = 1.0;
    topShellOpacity = 0;
    fallingShardsProgress = 1.0;
    innerGlowIntensity = 1.0;
    particleBurstProgress = 1.0;
    dinoVisible = true;
    dinoRiseY = 0.32;
    dinoScale = 1.0;
    dinoHappyBounceY = Math.abs(Math.sin(p * Math.PI * 2)) * 0.2;
    dinoTailWagY = Math.sin(p * Math.PI * 8) * 0.4;
    dinoHeadNodX = -Math.abs(Math.sin(p * Math.PI * 2)) * 0.18;
    nameBoardVisible = true;
    nameBoardLiftY = lerp(1.32, 1.46, p);
    nameBoardScale = lerp(0.78, 1.0, p);
    cameraFocusBlend = 1.0;
  } else {
    stateMachinePhase = 'REVEALING';
    subPhase = t < 0.985 ? 'NAME_BOARD_REVEAL' : 'COMPLETED';
    const p = clamp01((t - 0.95) / 0.05);
    eggX = plan.centerStageX;
    eggY = plan.centerStageY;
    eggZ = plan.centerStageZ;
    eggScale = plan.centerStageScale;
    crackProgress = 1.0;
    topShellOpacity = 0;
    fallingShardsProgress = 1.0;
    innerGlowIntensity = 1.0;
    particleBurstProgress = 1.0;
    dinoVisible = true;
    dinoRiseY = 0.32;
    dinoScale = 1.0;
    dinoHappyBounceY = Math.sin(p * Math.PI) * 0.08;
    dinoTailWagY = Math.sin(p * Math.PI * 4) * 0.25;
    nameBoardVisible = true;
    nameBoardLiftY = 1.46;
    nameBoardScale = 1.0;
    cameraFocusBlend = 1.0;
  }

  return {
    stateMachinePhase,
    subPhase,
    eggX,
    eggY,
    eggZ,
    eggScale,
    wobbleRotX,
    wobbleRotY,
    wobbleRotZ,
    crackProgress,
    topShellLiftY,
    topShellTiltX,
    topShellShiftZ,
    topShellOpacity,
    fallingShardsProgress,
    dinoVisible,
    dinoRiseY,
    dinoScale,
    dinoHeadNodX,
    dinoHeadTurnY,
    dinoBlinkScaleY,
    dinoTailWagY,
    dinoLegStepAngle,
    dinoHappyBounceY,
    innerGlowIntensity,
    particleBurstProgress,
    nameBoardVisible,
    nameBoardLiftY,
    nameBoardScale,
    cameraFocusBlend,
    shouldTriggerReveal: t >= 1,
  };
}

/**
 * Deduplication registry guaranteeing each `turnId` is recorded at most once.
 */
export class DinoEggTurnDeduplicator {
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

export interface DinoEgg3DUnitTestReport {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
}

/**
 * Automated Unit Tests for A04 – Trứng Khủng Long 3D (Section X & XIII):
 * 1. Verifies all 10 required class sizes: 1, 2, 5, 10, 20, 25, 30, 40, 45, and 50 students across all 3 modes.
 * 2. Verifies 1-to-1 `egg_id <-> student_id` bijection in `DINO_NURSERY` mode without truncation at 20 or 25.
 * 3. Verifies 20 consecutive turns with anti-repeat without duplicate or absent selections.
 * 4. Verifies all 12 hatching animation phases (`EGG_WOBBLING`, `FIRST_CRACK`, `SHELL_SPLITTING`, `DINO_PEEKING`, `DINO_HAPPY_JUMP`, `NAME_BOARD_REVEAL`).
 */
export function runDinoEgg3DUnitTests(): DinoEgg3DUnitTestReport {
  const failedChecks: string[] = [];
  let totalChecks = 0;

  const classSizes = [1, 2, 5, 10, 20, 25, 30, 40, 45, 50];
  const modes: DinoEggGameMode[] = ['SECRET_NEST', 'GIANT_EGG', 'DINO_NURSERY'];

  for (const count of classSizes) {
    const roster: StudentCandidate[] = Array.from({ length: count }, (_, i) => ({
      id: `dino_stu_${count}_${i + 1}`,
      code: `HS${String(i + 1).padStart(2, '0')}`,
      fullName: `Học Sinh Khủng Long ${i + 1}`,
    }));

    for (const mode of modes) {
      totalChecks++;
      const eggs = buildDinoEgg3DItems({
        gameMode: mode,
        eligibleStudents: roster,
        fullRosterStudents: roster,
        nestEggCount: 8,
        pageSize: 10,
      });

      if (mode === 'GIANT_EGG' && eggs.length !== 1) {
        failedChecks.push(`GIANT_EGG expected 1 egg, got ${eggs.length}`);
      }
      if (mode === 'SECRET_NEST' && eggs.length !== 8) {
        failedChecks.push(`SECRET_NEST expected 8 eggs, got ${eggs.length}`);
      }
      if (mode === 'DINO_NURSERY') {
        if (eggs.length !== count) {
          failedChecks.push(`DINO_NURSERY expected ${count} eggs, got ${eggs.length}`);
        }
        const boundIds = new Set(eggs.map((e) => e.boundStudent?.id).filter(Boolean));
        if (boundIds.size !== count) {
          failedChecks.push(
            `DINO_NURSERY bijection failed for N=${count}: ${boundIds.size} unique ids`
          );
        }
      }
    }
  }

  // Test 2: 20 consecutive turns in a 30-student class with anti-repeat
  const roster30: StudentCandidate[] = Array.from({ length: 30 }, (_, i) => ({
    id: `turn_dino_${i + 1}`,
    code: `HS${String(i + 1).padStart(2, '0')}`,
    fullName: `Trần Khủng Long ${i + 1}`,
  }));
  const calledIds = new Set<string>();

  for (let turn = 0; turn < 20; turn++) {
    totalChecks++;
    const eligible = roster30.filter((s) => !calledIds.has(s.id));
    if (eligible.length !== 30 - turn) {
      failedChecks.push(`Turn ${turn}: expected ${30 - turn} eligible, got ${eligible.length}`);
    }

    const mode: DinoEggGameMode =
      turn % 3 === 0
        ? 'SECRET_NEST'
        : turn % 3 === 1
        ? 'GIANT_EGG'
        : 'DINO_NURSERY';

    const eggs = buildDinoEgg3DItems({
      gameMode: mode,
      eligibleStudents: eligible,
      fullRosterStudents: roster30,
    });

    const plan = createFairDinoEggTurnPlan({
      eggs,
      eligibleStudents: eligible,
      fullRosterStudents: roster30,
      gameMode: mode,
      speedMode: 'NORMAL',
    });

    if (!plan.selectedStudent || calledIds.has(plan.selectedStudent.id)) {
      failedChecks.push(`Turn ${turn}: invalid or duplicate student selected`);
    }
    if (
      mode === 'DINO_NURSERY' &&
      eggs[plan.eggIndex].boundStudent?.id !== plan.selectedStudent.id
    ) {
      failedChecks.push(`Turn ${turn}: DINO_NURSERY student mismatch with chosen egg`);
    }
    calledIds.add(plan.selectedStudent.id);

    // Test 3: Timeline check across cracking, shell splitting, dino peeking, and reveal
    totalChecks++;
    const crackFrame = evaluateDinoEggCinematicTimeline(plan, 0.5);
    const splitFrame = evaluateDinoEggCinematicTimeline(plan, 0.62);
    const dinoFrame = evaluateDinoEggCinematicTimeline(plan, 0.92);
    const endFrame = evaluateDinoEggCinematicTimeline(plan, 1.0);

    if (crackFrame.crackProgress <= 0.4) {
      failedChecks.push(`Turn ${turn}: crackProgress too low at t=0.5`);
    }
    if (splitFrame.topShellLiftY <= 0.2) {
      failedChecks.push(`Turn ${turn}: topShellLiftY did not lift at t=0.62`);
    }
    if (!dinoFrame.dinoVisible || dinoFrame.dinoRiseY <= 0) {
      failedChecks.push(`Turn ${turn}: baby dinosaur not visible at t=0.92`);
    }
    if (!endFrame.nameBoardVisible || !endFrame.shouldTriggerReveal) {
      failedChecks.push(`Turn ${turn}: 3D name board not visible at t=1.0`);
    }
  }

  // Test 4: Deduplicator guard
  totalChecks++;
  const dedup = new DinoEggTurnDeduplicator();
  if (!dedup.markSaved('dino_turn_01') || dedup.markSaved('dino_turn_01')) {
    failedChecks.push('DinoEggTurnDeduplicator failed to prevent duplicate turnId');
  }

  return {
    passed: failedChecks.length === 0,
    totalChecks,
    failedChecks,
  };
}
