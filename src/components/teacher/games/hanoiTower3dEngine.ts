/**
 * F03 — THÁP HÀ NỘI 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * Pure deterministic engine & exact shortest-path BFS solver supporting:
 *
 * 1. Exact Tower of Hanoi rules (3–8 discs, numbered 1 = smallest .. n = largest):
 *    - Three pegs: A ("A – Xuất phát"), B ("B – Trung gian"), C ("C – Đích").
 *    - Only the top disc on a peg may be lifted; buried discs can never be moved.
 *    - A disc can only be placed onto an empty peg or onto a strictly larger disc.
 *    - Completion checked strictly from board data (C has [n..1], A & B empty), firing ONCE.
 *
 * 2. Three Modes:
 *    - 'guided' ("Làm quen"): Default 3 discs, step-by-step guidance, no timer.
 *    - 'challenge' ("Thử thách ít bước"): 3–8 discs, minimum target T(n)=2^n-1 & delta on finish, optional timer.
 *    - 'classroom' ("Cả lớp cùng giải"): Shared board for 1–50 HS, 2–6 rotating discussion groups
 *      proposing & explaining moves, shared class progress only (zero fake per-group scores).
 *
 * 3. Exact Shortest-Path Hint Engine from ANY Current Valid Board State (BFS on legal state graph):
 *    - Encodes 3..8 disc configurations into base-3 integers (at most 3^8 = 6,561 states).
 *    - Generates ONLY legal top-disc moves respecting larger-under-smaller rule.
 *    - Proves exact shortest remaining path in < 2ms without freezing UI.
 *    - Labels "Tối ưu từ vị trí hiện tại" ONLY when BFS reaches target state.
 *    - Never replays canonical sample order after a player deviates!
 *    - Separate canonical sample-solution generator for the isolated "Xem lời giải mẫu" viewer.
 *
 * 4. Move counter, Undo (restores exact prior board & decrements move count, tracking undoCount &
 *    hintsAppliedCount separately), idempotent gesture guard, and /demo-isolated persistence.
 */

import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type HanoiPegId = 'A' | 'B' | 'C';
export type HanoiGameMode = 'guided' | 'challenge' | 'classroom';

export const HANOI_PEG_IDS: HanoiPegId[] = ['A', 'B', 'C'];
export const HANOI_MIN_DISCS = 3;
export const HANOI_MAX_DISCS = 8;
export const HANOI_DEFAULT_DISCS = 3;
export const F03_SESSION_STORAGE_KEY = 'taydo_f03_hanoi_tower_session_v1';
export const F03_SESSION_VERSION = 1;

export interface HanoiPegMeta {
  id: HanoiPegId;
  shortLabel: string;
  fullLabel: string;
  role: string;
}

export const HANOI_PEG_META: Record<HanoiPegId, HanoiPegMeta> = {
  A: { id: 'A', shortLabel: 'Cọc A', fullLabel: 'A – Xuất phát', role: 'Xuất phát' },
  B: { id: 'B', shortLabel: 'Cọc B', fullLabel: 'B – Trung gian', role: 'Trung gian' },
  C: { id: 'C', shortLabel: 'Cọc C', fullLabel: 'C – Đích', role: 'Đích' },
};

export interface HanoiDiscStyle {
  disc: number;
  hex: string;
  strokeHex: string;
  textOnDisc: string;
  name: string;
}

/** High-contrast classroom-friendly distinct palette for discs 1 (smallest) .. 8 (largest). */
export const HANOI_DISC_STYLES: HanoiDiscStyle[] = [
  { disc: 1, hex: '#F8FAFC', strokeHex: '#CBD5E1', textOnDisc: '#0F172A', name: 'Trắng ngà' },
  { disc: 2, hex: '#2DD4BF', strokeHex: '#0F766E', textOnDisc: '#061024', name: 'Xanh ngọc' },
  { disc: 3, hex: '#FBBF24', strokeHex: '#B45309', textOnDisc: '#061024', name: 'Vàng ấm' },
  { disc: 4, hex: '#FB7185', strokeHex: '#BE123C', textOnDisc: '#061024', name: 'Đỏ san hô' },
  { disc: 5, hex: '#38BDF8', strokeHex: '#0369A1', textOnDisc: '#061024', name: 'Xanh trời' },
  { disc: 6, hex: '#A78BFA', strokeHex: '#6D28D9', textOnDisc: '#061024', name: 'Tím lavender' },
  { disc: 7, hex: '#34D399', strokeHex: '#047857', textOnDisc: '#061024', name: 'Xanh lá ngọc' },
  { disc: 8, hex: '#F97316', strokeHex: '#C2410C', textOnDisc: '#061024', name: 'Cam hổ phách' },
];

export function getHanoiDiscStyle(disc: number): HanoiDiscStyle {
  return HANOI_DISC_STYLES[(Math.max(1, disc) - 1) % HANOI_DISC_STYLES.length];
}

export type HanoiPegsState = Record<HanoiPegId, number[]>;

export interface HanoiMoveRecord {
  stepNumber: number; // 1-based position in current move history
  disc: number;
  from: HanoiPegId;
  to: HanoiPegId;
  appliedViaHint: boolean;
  proposedByGroup: string | null;
  timestamp: number;
}

export interface HanoiHintResult {
  status: 'found' | 'already_solved' | 'budget_exceeded' | 'invalid_state';
  isProvenOptimal: boolean;
  label: string;
  move: { from: HanoiPegId; to: HanoiPegId; disc: number } | null;
  remainingOptimalMoves: number | null;
  explanation: string;
  statesExplored: number;
}

export interface HanoiSessionState {
  mode: HanoiGameMode;
  discCount: number; // 3..8
  pegs: HanoiPegsState;
  history: HanoiMoveRecord[];
  /** Main counter = valid moves in current sequence (= history.length). */
  moveCount: number;
  /** Tracked separately: how many times player pressed Undo. */
  undoCount: number;
  /** Tracked separately: how many hints were explicitly applied. */
  hintsAppliedCount: number;
  /** Classroom rotating discussion groups (2..6), no per-group fake scores. */
  groupsCount: number;
  activeGroupIndex: number;
  /** Optional timer (off by default). */
  timerEnabled: boolean;
  elapsedSeconds: number;
  /** Completion flag derived strictly from board data; fires completion event once. */
  isCompleted: boolean;
  hasFiredCompletionEvent: boolean;
}

export interface HanoiMoveValidation {
  valid: boolean;
  disc?: number;
  reason?: string;
}

export interface HanoiMoveResult {
  nextState: HanoiSessionState;
  moved: boolean;
  justCompleted: boolean;
  moveRecord?: HanoiMoveRecord;
  errorReason?: string;
}

export interface HanoiCanonicalStep {
  stepNumber: number;
  disc: number;
  from: HanoiPegId;
  to: HanoiPegId;
  explanation: string;
}

export interface HanoiFormulaBenchmark {
  discs: number;
  minMoves: number;
  formulaTex: string;
}

// ============================================================================
// FORMULA HELPERS (T(n) = 2^n - 1)
// ============================================================================

export function getHanoiMinMoves(discCount: number): number {
  const n = Math.max(1, Math.min(20, Math.round(discCount)));
  return Math.pow(2, n) - 1;
}

export const HANOI_FORMULA_BENCHMARKS: HanoiFormulaBenchmark[] = [3, 4, 5, 6, 7, 8].map((n) => ({
  discs: n,
  minMoves: getHanoiMinMoves(n),
  formulaTex: `\\(T(${n}) = 2^{${n}} - 1 = ${getHanoiMinMoves(n)}\\)`,
}));

// ============================================================================
// INITIAL BOARD & BOARD VALIDATION
// ============================================================================

export function clampDiscCount(discCount: number): number {
  return Math.max(HANOI_MIN_DISCS, Math.min(HANOI_MAX_DISCS, Math.round(discCount)));
}

export function createInitialPegs(discCount: number): HanoiPegsState {
  const n = clampDiscCount(discCount);
  const pegA: number[] = [];
  for (let d = n; d >= 1; d--) {
    pegA.push(d);
  }
  return { A: pegA, B: [], C: [] };
}

export function clonePegs(pegs: HanoiPegsState): HanoiPegsState {
  return {
    A: [...pegs.A],
    B: [...pegs.B],
    C: [...pegs.C],
  };
}

export function getTopDisc(pegs: HanoiPegsState, peg: HanoiPegId): number | null {
  const stack = pegs[peg];
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

/**
 * Checks whether a specific disc is currently the top disc on its peg (only top disc can be lifted).
 */
export function isDiscLiftable(pegs: HanoiPegsState, disc: number): boolean {
  for (const peg of HANOI_PEG_IDS) {
    const stack = pegs[peg];
    if (stack.length > 0 && stack[stack.length - 1] === disc) {
      return true;
    }
  }
  return false;
}

/**
 * Verifies board integrity: contains each disc 1..n exactly once, and every peg is strictly descending (bottom > top).
 */
export function isValidHanoiBoard(pegs: HanoiPegsState, discCount: number): boolean {
  const n = clampDiscCount(discCount);
  const seen = new Set<number>();
  for (const peg of HANOI_PEG_IDS) {
    const stack = pegs[peg];
    if (!Array.isArray(stack)) return false;
    for (let i = 0; i < stack.length; i++) {
      const d = stack[i];
      if (!Number.isInteger(d) || d < 1 || d > n || seen.has(d)) return false;
      seen.add(d);
      if (i > 0 && stack[i] >= stack[i - 1]) {
        return false; // Larger disc placed on top of smaller disc!
      }
    }
  }
  return seen.size === n;
}

/**
 * Completion strictly evaluated from authoritative board data:
 * Peg C holds all discs [n, n-1, ..., 1] in exact order, and pegs A & B are empty.
 */
export function isHanoiCompleted(pegs: HanoiPegsState, discCount: number): boolean {
  const n = clampDiscCount(discCount);
  if (pegs.A.length !== 0 || pegs.B.length !== 0 || pegs.C.length !== n) {
    return false;
  }
  for (let i = 0; i < n; i++) {
    if (pegs.C[i] !== n - i) return false;
  }
  return true;
}

export function createInitialHanoiState(params?: {
  mode?: HanoiGameMode;
  discCount?: number;
  groupsCount?: number;
  timerEnabled?: boolean;
}): HanoiSessionState {
  const mode: HanoiGameMode = params?.mode ?? 'guided';
  const discCount = clampDiscCount(params?.discCount ?? (mode === 'guided' ? 3 : HANOI_DEFAULT_DISCS));
  const groupsCount = Math.max(2, Math.min(6, Math.round(params?.groupsCount ?? 4)));
  return {
    mode,
    discCount,
    pegs: createInitialPegs(discCount),
    history: [],
    moveCount: 0,
    undoCount: 0,
    hintsAppliedCount: 0,
    groupsCount,
    activeGroupIndex: 0,
    timerEnabled: Boolean(params?.timerEnabled),
    elapsedSeconds: 0,
    isCompleted: false,
    hasFiredCompletionEvent: false,
  };
}

// ============================================================================
// RULE VALIDATION, MOVE EXECUTION & UNDO
// ============================================================================

export function validateHanoiMove(
  pegs: HanoiPegsState,
  from: HanoiPegId,
  to: HanoiPegId
): HanoiMoveValidation {
  if (from === to) {
    return {
      valid: false,
      reason: `Đã bỏ chọn ${HANOI_PEG_META[from].shortLabel}. Chọn hai cọc khác nhau để chuyển đĩa.`,
    };
  }
  const movingDisc = getTopDisc(pegs, from);
  if (movingDisc === null) {
    return {
      valid: false,
      reason: `${HANOI_PEG_META[from].fullLabel} đang trống — không có đĩa trên cùng để nhấc.`,
    };
  }
  const destTop = getTopDisc(pegs, to);
  if (destTop !== null && movingDisc > destTop) {
    return {
      valid: false,
      reason: `Không hợp lệ: không thể đặt đĩa số ${movingDisc} (lớn hơn) lên trên đĩa số ${destTop} ở ${HANOI_PEG_META[to].shortLabel}.`,
    };
  }
  return { valid: true, disc: movingDisc };
}

export function applyHanoiMove(
  state: HanoiSessionState,
  from: HanoiPegId,
  to: HanoiPegId,
  options?: {
    appliedViaHint?: boolean;
    nowMs?: number;
  }
): HanoiMoveResult {
  if (state.isCompleted) {
    return {
      nextState: state,
      moved: false,
      justCompleted: false,
      errorReason: 'Bài toán đã hoàn thành! Bấm "Chơi lại" hoặc chọn số đĩa mới để tiếp tục.',
    };
  }

  const check = validateHanoiMove(state.pegs, from, to);
  if (!check.valid || check.disc === undefined) {
    return {
      nextState: state,
      moved: false,
      justCompleted: false,
      errorReason: check.reason,
    };
  }

  const nextPegs = clonePegs(state.pegs);
  const popped = nextPegs[from].pop()!;
  nextPegs[to].push(popped);

  const appliedViaHint = Boolean(options?.appliedViaHint);
  const proposedByGroup =
    state.mode === 'classroom' ? `Nhóm ${state.activeGroupIndex + 1}` : null;

  const moveRecord: HanoiMoveRecord = {
    stepNumber: state.history.length + 1,
    disc: popped,
    from,
    to,
    appliedViaHint,
    proposedByGroup,
    timestamp: options?.nowMs ?? Date.now(),
  };

  const nextHistory = [...state.history, moveRecord];
  const completedNow = isHanoiCompleted(nextPegs, state.discCount);
  const justCompleted = completedNow && !state.hasFiredCompletionEvent;

  const nextState: HanoiSessionState = {
    ...state,
    pegs: nextPegs,
    history: nextHistory,
    moveCount: nextHistory.length,
    hintsAppliedCount: state.hintsAppliedCount + (appliedViaHint ? 1 : 0),
    activeGroupIndex:
      state.mode === 'classroom'
        ? (state.activeGroupIndex + 1) % state.groupsCount
        : state.activeGroupIndex,
    isCompleted: completedNow,
    hasFiredCompletionEvent: state.hasFiredCompletionEvent || completedNow,
  };

  return {
    nextState,
    moved: true,
    justCompleted,
    moveRecord,
  };
}

/**
 * Reverts the exact last valid move, restoring the previous board and decrementing moveCount by 1.
 * Tracks undoCount separately so the completion summary honestly reflects support usage.
 */
export function undoHanoiMove(state: HanoiSessionState): {
  nextState: HanoiSessionState;
  undone: boolean;
  revertedMove?: HanoiMoveRecord;
} {
  if (state.history.length === 0) {
    return { nextState: state, undone: false };
  }

  const lastMove = state.history[state.history.length - 1];
  const nextPegs = clonePegs(state.pegs);
  const topOnDest = nextPegs[lastMove.to][nextPegs[lastMove.to].length - 1];
  if (topOnDest !== lastMove.disc) {
    // Safety fallback: replay from initial state if history ever diverged
    const rebuilt = createInitialPegs(state.discCount);
    for (let i = 0; i < state.history.length - 1; i++) {
      const m = state.history[i];
      const d = rebuilt[m.from].pop();
      if (d !== undefined) rebuilt[m.to].push(d);
    }
    const trimmed = state.history.slice(0, -1);
    return {
      undone: true,
      revertedMove: lastMove,
      nextState: {
        ...state,
        pegs: rebuilt,
        history: trimmed,
        moveCount: trimmed.length,
        undoCount: state.undoCount + 1,
        activeGroupIndex:
          state.mode === 'classroom'
            ? (state.activeGroupIndex - 1 + state.groupsCount) % state.groupsCount
            : state.activeGroupIndex,
        isCompleted: false,
      },
    };
  }

  nextPegs[lastMove.to].pop();
  nextPegs[lastMove.from].push(lastMove.disc);
  const trimmed = state.history.slice(0, -1);

  return {
    undone: true,
    revertedMove: lastMove,
    nextState: {
      ...state,
      pegs: nextPegs,
      history: trimmed,
      moveCount: trimmed.length,
      undoCount: state.undoCount + 1,
      activeGroupIndex:
        state.mode === 'classroom'
          ? (state.activeGroupIndex - 1 + state.groupsCount) % state.groupsCount
          : state.activeGroupIndex,
      isCompleted: false,
    },
  };
}

// ============================================================================
// EXACT BFS SHORTEST-PATH SOLVER FROM ANY CURRENT VALID STATE (3–8 DISCS)
// Base-3 integer encoding: disc d (1..n) -> peg index 0(A), 1(B), 2(C)
// Total states for n = 8 is 3^8 = 6,561 -> runs in < 2ms synchronously!
// ============================================================================

const PEG_INDEX_TO_ID: HanoiPegId[] = ['A', 'B', 'C'];
const PEG_ID_TO_INDEX: Record<HanoiPegId, number> = { A: 0, B: 1, C: 2 };

export function encodePegsToBase3(pegs: HanoiPegsState, discCount: number): number {
  const n = clampDiscCount(discCount);
  const pegOfDisc = new Uint8Array(n + 1);
  for (let p = 0; p < 3; p++) {
    const stack = pegs[PEG_INDEX_TO_ID[p]];
    for (let i = 0; i < stack.length; i++) {
      pegOfDisc[stack[i]] = p;
    }
  }
  let code = 0;
  let mult = 1;
  for (let d = 1; d <= n; d++) {
    code += pegOfDisc[d] * mult;
    mult *= 3;
  }
  return code;
}

export function getGoalBase3Code(discCount: number): number {
  // All discs on peg C (index 2) => sum_{i=0}^{n-1} 2 * 3^i = 3^n - 1
  return Math.pow(3, clampDiscCount(discCount)) - 1;
}

/**
 * Runs exact Breadth-First Search (BFS) over legal Tower of Hanoi states (3–8 discs)
 * starting from the current board position to reach all discs on peg C.
 * - Generates ONLY legal top-disc moves respecting larger-under-smaller rule.
 * - Labels "Tối ưu từ vị trí hiện tại" ONLY if BFS finishes and proves shortest path.
 * - Works identically whether the player followed or deviated from the canonical solution.
 */
export function computeOptimalHintFromState(
  pegs: HanoiPegsState,
  discCount: number,
  options?: { maxExploredStates?: number }
): HanoiHintResult {
  const n = clampDiscCount(discCount);
  if (!isValidHanoiBoard(pegs, n)) {
    return {
      status: 'invalid_state',
      isProvenOptimal: false,
      label: 'Trạng thái bảng không hợp lệ',
      move: null,
      remainingOptimalMoves: null,
      explanation: 'Không thể phân tích trạng thái hiện tại.',
      statesExplored: 0,
    };
  }

  if (isHanoiCompleted(pegs, n)) {
    return {
      status: 'already_solved',
      isProvenOptimal: true,
      label: 'Đã hoàn thành',
      move: null,
      remainingOptimalMoves: 0,
      explanation: 'Toàn bộ đĩa đã xếp đúng thứ tự ở cọc C – Đích.',
      statesExplored: 0,
    };
  }

  const totalStates = Math.pow(3, n); // max 6,561 for n = 8
  const maxStates = options?.maxExploredStates ?? totalStates;
  const startCode = encodePegsToBase3(pegs, n);
  const goalCode = totalStates - 1; // all discs on peg C (2)

  // Precompute powers of 3 for O(n) decode/transition without allocation
  const pow3 = new Int32Array(n);
  pow3[0] = 1;
  for (let i = 1; i < n; i++) {
    pow3[i] = pow3[i - 1] * 3;
  }

  const dist = new Int16Array(totalStates);
  dist.fill(-1);
  const parentState = new Int32Array(totalStates);
  parentState.fill(-1);
  // Pack move as: (disc << 4) | (fromIdx << 2) | toIdx
  const parentMove = new Int16Array(totalStates);
  const queue = new Int32Array(totalStates);

  let head = 0;
  let tail = 0;
  dist[startCode] = 0;
  queue[tail++] = startCode;

  let explored = 0;
  let reachedGoal = false;

  // Reusable small arrays for top disc on each peg (0 = none, 1..n = smallest disc on that peg)
  const topDisc = new Int8Array(3);

  while (head < tail) {
    if (explored >= maxStates) {
      break;
    }
    const cur = queue[head++];
    explored += 1;
    const curDist = dist[cur];

    // Find top (smallest) disc on each peg by scanning d = 1..n
    topDisc[0] = 0;
    topDisc[1] = 0;
    topDisc[2] = 0;
    let rem = cur;
    for (let d = 1; d <= n; d++) {
      const p = rem % 3;
      rem = (rem - p) / 3;
      if (topDisc[p] === 0) {
        topDisc[p] = d;
      }
    }

    // Generate strictly legal top-disc moves between distinct pegs
    for (let from = 0; from < 3; from++) {
      const moving = topDisc[from];
      if (moving === 0) continue; // Peg empty
      for (let to = 0; to < 3; to++) {
        if (to === from) continue;
        const destTop = topDisc[to];
        if (destTop !== 0 && moving > destTop) continue; // Violates larger-under-smaller rule

        const nextCode = cur + (to - from) * pow3[moving - 1];
        if (dist[nextCode] !== -1) continue;

        dist[nextCode] = curDist + 1;
        parentState[nextCode] = cur;
        parentMove[nextCode] = (moving << 4) | (from << 2) | to;

        if (nextCode === goalCode) {
          reachedGoal = true;
          break;
        }
        queue[tail++] = nextCode;
      }
      if (reachedGoal) break;
    }
    if (reachedGoal) break;
  }

  if (!reachedGoal) {
    return {
      status: 'budget_exceeded',
      isProvenOptimal: false,
      label: 'Chưa tính xong đường ngắn nhất',
      move: null,
      remainingOptimalMoves: null,
      explanation: 'Quá trình tìm đường ngắn nhất chưa hoàn tất trong giới hạn hiện tại. Bạn có thể tiếp tục tự giải trên bàn chơi.',
      statesExplored: explored,
    };
  }

  // Backtrack from goalCode to startCode to recover the exact first optimal move
  let trace = goalCode;
  let firstMovePacked = parentMove[trace];
  while (parentState[trace] !== -1 && parentState[trace] !== startCode) {
    trace = parentState[trace];
    firstMovePacked = parentMove[trace];
  }

  const disc = firstMovePacked >> 4;
  const fromIdx = (firstMovePacked >> 2) & 0b11;
  const toIdx = firstMovePacked & 0b11;
  const from = PEG_INDEX_TO_ID[fromIdx];
  const to = PEG_INDEX_TO_ID[toIdx];
  const remainingOptimalMoves = dist[goalCode];

  const explanation = buildHintExplanation({
    pegs,
    discCount: n,
    disc,
    from,
    to,
    remainingOptimalMoves,
  });

  return {
    status: 'found',
    isProvenOptimal: true,
    label: 'Tối ưu từ vị trí hiện tại',
    move: { from, to, disc },
    remainingOptimalMoves,
    explanation,
    statesExplored: explored,
  };
}

function buildHintExplanation(params: {
  pegs: HanoiPegsState;
  discCount: number;
  disc: number;
  from: HanoiPegId;
  to: HanoiPegId;
  remainingOptimalMoves: number;
}): string {
  const { discCount, disc, from, to, remainingOptimalMoves } = params;
  const fromMeta = HANOI_PEG_META[from].fullLabel;
  const toMeta = HANOI_PEG_META[to].fullLabel;
  if (disc === discCount && to === 'C') {
    return `Đĩa lớn nhất (số ${disc}) đã thoáng — chuyển thẳng từ ${fromMeta} sang ${toMeta} để đặt nền móng ở cọc đích (còn ${remainingOptimalMoves} bước tối ưu).`;
  }
  if (disc === 1) {
    return `Chuyển đĩa nhỏ nhất (số 1) từ ${fromMeta} sang ${toMeta} để mở đường cho đĩa lớn hơn bên dưới (còn ${remainingOptimalMoves} bước tối ưu).`;
  }
  return `Chuyển đĩa số ${disc} từ ${fromMeta} sang ${toMeta} để gom gọn chồng đĩa nhỏ hơn về đúng vị trí đệm (còn ${remainingOptimalMoves} bước tối ưu).`;
}

// ============================================================================
// SEPARATE CANONICAL SAMPLE-SOLUTION GENERATOR (For Isolated Preview Viewer)
// ============================================================================

export function generateCanonicalSolutionSteps(discCount: number): HanoiCanonicalStep[] {
  const n = clampDiscCount(discCount);
  const steps: HanoiCanonicalStep[] = [];

  function solve(k: number, from: HanoiPegId, aux: HanoiPegId, to: HanoiPegId) {
    if (k <= 0) return;
    solve(k - 1, from, to, aux);
    const stepNumber = steps.length + 1;
    steps.push({
      stepNumber,
      disc: k,
      from,
      to,
      explanation:
        k === n && to === 'C'
          ? `Đặt đĩa lớn nhất (đĩa ${k}) từ ${HANOI_PEG_META[from].shortLabel} sang ${HANOI_PEG_META[to].fullLabel}.`
          : `Chuyển đĩa số ${k} từ ${HANOI_PEG_META[from].shortLabel} sang ${HANOI_PEG_META[to].shortLabel}.`,
    });
    solve(k - 1, aux, from, to);
  }

  solve(n, 'A', 'B', 'C');
  return steps;
}

/**
 * Reconstructs board snapshot at step `k` (0..2^n-1) of the isolated canonical sample viewer.
 */
export function buildCanonicalPreviewPegsAtStep(
  discCount: number,
  steps: HanoiCanonicalStep[],
  stepIndex: number
): HanoiPegsState {
  const pegs = createInitialPegs(discCount);
  const clamped = Math.max(0, Math.min(steps.length, Math.round(stepIndex)));
  for (let i = 0; i < clamped; i++) {
    const s = steps[i];
    const d = pegs[s.from].pop();
    if (d !== undefined) pegs[s.to].push(d);
  }
  return pegs;
}

// ============================================================================
// COMPLETION SUMMARY & /demo-ISOLATED PERSISTENCE
// ============================================================================

export interface HanoiCompletionSummary {
  minMoves: number;
  actualMoves: number;
  deltaMoves: number;
  isOptimalCount: boolean;
  headline: string;
  supportNote: string | null;
}

export function buildHanoiCompletionSummary(state: HanoiSessionState): HanoiCompletionSummary {
  const minMoves = getHanoiMinMoves(state.discCount);
  const actualMoves = state.moveCount;
  const deltaMoves = Math.max(0, actualMoves - minMoves);
  const isOptimalCount = actualMoves === minMoves;

  const hasSupport = state.undoCount > 0 || state.hintsAppliedCount > 0;
  let supportNote: string | null = null;
  if (hasSupport) {
    const parts: string[] = [];
    if (state.hintsAppliedCount > 0) parts.push(`${state.hintsAppliedCount} gợi ý đã áp dụng`);
    if (state.undoCount > 0) parts.push(`${state.undoCount} lần hoàn tác`);
    supportNote = `Quá trình giải có hỗ trợ: ${parts.join(' · ')}.`;
  }

  return {
    minMoves,
    actualMoves,
    deltaMoves,
    isOptimalCount,
    headline: isOptimalCount
      ? 'Lời giải ít bước nhất'
      : `Hoàn thành sau ${actualMoves} bước (+${deltaMoves} bước so với tối thiểu ${minMoves})`,
    supportNote,
  };
}

export interface F03PersistedSession {
  version: number;
  state: HanoiSessionState;
  savedAt: number;
}

export function getF03StorageKey(forceDemo?: boolean): string {
  const inDemo = forceDemo ?? isKhktDemoRuntime();
  return inDemo
    ? `${KHKT_DEMO_STORAGE_PREFIX}${F03_SESSION_STORAGE_KEY}`
    : F03_SESSION_STORAGE_KEY;
}

export function saveF03Session(
  state: HanoiSessionState,
  storage?: Pick<Storage, 'setItem'>,
  forceDemo?: boolean
): void {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return;
  try {
    const payload: F03PersistedSession = {
      version: F03_SESSION_VERSION,
      state,
      savedAt: Date.now(),
    };
    target.setItem(getF03StorageKey(forceDemo), JSON.stringify(payload));
  } catch {
    // Ignore storage quota / privacy errors
  }
}

export function loadF03Session(
  storage?: Pick<Storage, 'getItem' | 'removeItem'>,
  forceDemo?: boolean
): HanoiSessionState | null {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return null;
  const key = getF03StorageKey(forceDemo);
  try {
    const raw = target.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<F03PersistedSession>;
    if (!parsed || parsed.version !== F03_SESSION_VERSION || !parsed.state) {
      target.removeItem(key);
      return null;
    }
    const s = parsed.state;
    const discCount = clampDiscCount(s.discCount ?? HANOI_DEFAULT_DISCS);
    if (!s.pegs || !isValidHanoiBoard(s.pegs, discCount) || !Array.isArray(s.history)) {
      target.removeItem(key);
      return null;
    }
    const mode: HanoiGameMode =
      s.mode === 'guided' || s.mode === 'challenge' || s.mode === 'classroom'
        ? s.mode
        : 'guided';
    const completed = isHanoiCompleted(s.pegs, discCount);
    return {
      mode,
      discCount,
      pegs: clonePegs(s.pegs),
      history: s.history,
      moveCount: s.history.length,
      undoCount: Math.max(0, Number(s.undoCount) || 0),
      hintsAppliedCount: Math.max(0, Number(s.hintsAppliedCount) || 0),
      groupsCount: Math.max(2, Math.min(6, Number(s.groupsCount) || 4)),
      activeGroupIndex: Math.max(0, Number(s.activeGroupIndex) || 0),
      timerEnabled: Boolean(s.timerEnabled),
      elapsedSeconds: Math.max(0, Number(s.elapsedSeconds) || 0),
      isCompleted: completed,
      hasFiredCompletionEvent: completed || Boolean(s.hasFiredCompletionEvent),
    };
  } catch {
    try {
      target.removeItem(key);
    } catch {
      // Ignore
    }
    return null;
  }
}

export function clearF03Session(
  storage?: Pick<Storage, 'removeItem'>,
  forceDemo?: boolean
): void {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return;
  try {
    target.removeItem(getF03StorageKey(forceDemo));
  } catch {
    // Ignore
  }
}

export { PEG_ID_TO_INDEX };
