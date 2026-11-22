/**
 * F04 — MÊ CUNG TRÍ TUỆ 3D (Tây Đô Smart EDU)
 * Pure deterministic Grid Maze, BFS Optimal Solver & Command Programming Engine:
 * - Single source of truth grid ('#' wall, '.' walkable, 'S' start, 'E' goal)
 * - Strict grid validation before play: rectangular rows, valid symbols, exactly 1 S & 1 E, BFS-proven solvable
 * - Four fixed map directions: 'up' | 'down' | 'left' | 'right' (never diagonal, never wall/OOB)
 * - Modes:
 *   1. 'explore' (Khám phá): 1 step per action, wall bump "Lối này bị chặn" without adding steps,
 *      Undo restoring prior valid tile & decrementing stepCount, separate undoCount & hintsAppliedCount,
 *      BFS hint from ANY current position (including dead ends) applied ONLY on explicit action.
 *   2. 'plan' (Lập kế hoạch): compose command sequence (add/delete/reorder via buttons without DnD),
 *      "Chạy thử" or "Chạy từng bước" starting from S, edit-locked while running,
 *      stops at exact blocked command #k keeping robot at last valid tile and preserving sequence for edits,
 *      stops immediately upon reaching E counting ONLY actual steps taken and reporting unused trailing commands,
 *      reports "Robot chưa tới đích" if sequence ends before E, stop mid-run never counts as completion.
 * - Optional classroom presentation mode (1–50 students, 2–6 rotating groups, shared class progress only)
 * - 3 built-in verified sample mazes ("Dữ liệu mẫu") with exact prompt 7x7 starter grid
 * - Demo-isolated session persistence that always restores mid-auto-run reloads in STOPPED state
 */

import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type MazeDirection = 'up' | 'down' | 'left' | 'right';

export type MazePlayMode = 'explore' | 'plan';

export type MazeCellType = '#' | '.' | 'S' | 'E';

export interface GridPos {
  row: number;
  col: number;
}

export interface MazeLevelDefinition {
  id: string;
  title: string;
  difficultyLabel: 'Làm quen' | 'Trung bình' | 'Thử thách';
  description: string;
  grid: string[];
  isSample: boolean;
  sourceBadge: string;
}

export interface MazeValidationResult {
  valid: boolean;
  errors: string[];
  rows: number;
  cols: number;
  start: GridPos | null;
  goal: GridPos | null;
  shortestDistance: number | null;
  manhattanDistance: number | null;
  sampleOptimalPath: MazeDirection[];
}

export interface MazeHintResult {
  solvable: boolean;
  from: GridPos;
  remainingShortestSteps: number;
  recommendedDirection: MazeDirection | null;
  alternativeOptimalDirections: MazeDirection[];
  nextPos: GridPos | null;
  explanationLatex: string;
  explanationText: string;
}

export interface MazePlanExecutionOutcome {
  status: 'idle' | 'running' | 'completed' | 'blocked' | 'incomplete' | 'stopped';
  currentStepIndex: number; // 0-based index of currently executing or last executed command
  blockedCommandIndex: number | null; // 0-based index of command that hit a wall/OOB
  unusedCommandsCount: number;
  stepsExecuted: number;
  message: string;
}

export interface MazeGameState {
  levelId: string;
  mode: MazePlayMode;
  robotPos: GridPos;
  facing: MazeDirection;
  visitedTrail: GridPos[]; // Ordered list of positions robot stepped on (starts with [S])
  stepCount: number; // Valid steps in current attempt
  undoCount: number; // Separate counter in Explore mode
  hintsAppliedCount: number; // Separate counter of applied hints
  activeHint: MazeHintResult | null;
  completed: boolean;
  isOptimal: boolean;
  statusMessage: string | null;
  lastBlockedPos: GridPos | null;

  // Plan mode fields
  program: MazeDirection[];
  runAttempts: number;
  planOutcome: MazePlanExecutionOutcome;
  isAutoRunning: boolean;

  // Classroom presentation (optional, shared progress only — zero fake group scores)
  classroomEnabled: boolean;
  groupCount: number; // 2–6
  activeGroupIndex: number; // 0..groupCount-1
  classSizeHint: number; // 1–50
}

export const D_DIRECTION_DELTA: Record<MazeDirection, GridPos> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

export const DIRECTION_LABELS_VI: Record<MazeDirection, string> = {
  up: 'Lên',
  down: 'Xuống',
  left: 'Trái',
  right: 'Phải',
};

export const DIRECTION_ARROWS: Record<MazeDirection, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

export const F04_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const F04_SESSION_STORAGE_KEY = 'taydo_f04_maze_session_v1';
export const F04_SESSION_VERSION = 1;

// ============================================================================
// BUILT-IN VERIFIED SAMPLE MAZES ("Dữ liệu mẫu")
// ============================================================================

export const F04_SAMPLE_LEVELS: MazeLevelDefinition[] = [
  {
    id: 'maze_01_intro',
    title: 'Màn 1 · Mê cung làm quen (7×7)',
    difficultyLabel: 'Làm quen',
    description:
      'Mê cung khởi đầu với hai con đường ngắn nhất khác nhau cùng dài 8 bước. Luyện đọc sơ đồ và sửa lệnh khi gặp tường.',
    // EXACT 7x7 grid required by specification
    grid: [
      '#######',
      '#S..#.#',
      '#.#.#.#',
      '#.#...#',
      '#.###.#',
      '#....E#',
      '#######',
    ],
    isSample: true,
    sourceBadge: F04_SAMPLE_BADGE,
  },
  {
    id: 'maze_02_detour',
    title: 'Màn 2 · Rẽ vòng tránh tường (9×9)',
    difficultyLabel: 'Trung bình',
    description:
      'Vách ngăn trung tâm buộc robot đi vòng xa hơn khoảng cách thẳng. So sánh nhánh trái và nhánh phải để tìm đường tối ưu.',
    grid: [
      '#########',
      '#S..#...#',
      '###.#.#.#',
      '#.......#',
      '#.#####.#',
      '#.#...#.#',
      '#.#.#...#',
      '#...#.E.#',
      '#########',
    ],
    isSample: true,
    sourceBadge: F04_SAMPLE_BADGE,
  },
  {
    id: 'maze_03_challenge',
    title: 'Màn 3 · Thử thách sa bàn (11×9)',
    difficultyLabel: 'Thử thách',
    description:
      'Sa bàn nhiều ngã rẽ và ngõ cụt đòi hỏi quan sát toàn bản đồ và lập chuỗi lệnh chính xác.',
    grid: [
      '###########',
      '#S..#.....#',
      '###.#.###.#',
      '#...#.#...#',
      '#.###.#.###',
      '#.#.......#',
      '#.#.#####.#',
      '#.......#E#',
      '###########',
    ],
    isSample: true,
    sourceBadge: F04_SAMPLE_BADGE,
  },
];

export function getMazeLevelById(levelId: string): MazeLevelDefinition {
  return F04_SAMPLE_LEVELS.find((l) => l.id === levelId) || F04_SAMPLE_LEVELS[0];
}

// ============================================================================
// GRID VALIDATION & BFS OPTIMAL PATHFINDER
// ============================================================================

export function posEquals(a: GridPos, b: GridPos): boolean {
  return a.row === b.row && a.col === b.col;
}

export function getCellAt(grid: string[], row: number, col: number): MazeCellType | null {
  if (row < 0 || row >= grid.length) return null;
  const line = grid[row];
  if (col < 0 || col >= line.length) return null;
  const ch = line[col];
  if (ch === '#' || ch === '.' || ch === 'S' || ch === 'E') return ch;
  return null;
}

export function isWalkableCell(grid: string[], row: number, col: number): boolean {
  const ch = getCellAt(grid, row, col);
  return ch === '.' || ch === 'S' || ch === 'E';
}

export function findMazeEndpoints(grid: string[]): {
  starts: GridPos[];
  goals: GridPos[];
  invalidChars: Array<{ row: number; col: number; char: string }>;
} {
  const starts: GridPos[] = [];
  const goals: GridPos[] = [];
  const invalidChars: Array<{ row: number; col: number; char: string }> = [];

  for (let r = 0; r < grid.length; r++) {
    const line = grid[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === 'S') starts.push({ row: r, col: c });
      else if (ch === 'E') goals.push({ row: r, col: c });
      else if (ch !== '#' && ch !== '.') {
        invalidChars.push({ row: r, col: c, char: ch });
      }
    }
  }
  return { starts, goals, invalidChars };
}

/**
 * Exact BFS distance map from `target` (typically E) to every reachable walkable tile.
 * Allows O(1) lookup of shortest remaining distance and ALL optimal next directions from any tile.
 */
export function computeBfsDistancesToTarget(
  grid: string[],
  target: GridPos
): Map<string, number> {
  const dist = new Map<string, number>();
  if (!isWalkableCell(grid, target.row, target.col)) return dist;

  const keyOf = (r: number, c: number) => `${r},${c}`;
  const queue: GridPos[] = [target];
  dist.set(keyOf(target.row, target.col), 0);

  let head = 0;
  const dirs: MazeDirection[] = ['up', 'down', 'left', 'right'];

  while (head < queue.length) {
    const cur = queue[head++];
    const curDist = dist.get(keyOf(cur.row, cur.col))!;
    for (const dir of dirs) {
      const nr = cur.row + D_DIRECTION_DELTA[dir].row;
      const nc = cur.col + D_DIRECTION_DELTA[dir].col;
      if (!isWalkableCell(grid, nr, nc)) continue;
      const nk = keyOf(nr, nc);
      if (!dist.has(nk)) {
        dist.set(nk, curDist + 1);
        queue.push({ row: nr, col: nc });
      }
    }
  }

  return dist;
}

export function reconstructOptimalPath(
  grid: string[],
  from: GridPos,
  goal: GridPos
): MazeDirection[] | null {
  const distMap = computeBfsDistancesToTarget(grid, goal);
  const keyOf = (r: number, c: number) => `${r},${c}`;
  const startDist = distMap.get(keyOf(from.row, from.col));
  if (startDist === undefined) return null;

  const path: MazeDirection[] = [];
  let cur: GridPos = { ...from };
  let remaining = startDist;
  const dirs: MazeDirection[] = ['right', 'down', 'left', 'up'];

  while (remaining > 0) {
    let stepped = false;
    for (const dir of dirs) {
      const nr = cur.row + D_DIRECTION_DELTA[dir].row;
      const nc = cur.col + D_DIRECTION_DELTA[dir].col;
      const d = distMap.get(keyOf(nr, nc));
      if (d === remaining - 1) {
        path.push(dir);
        cur = { row: nr, col: nc };
        remaining = d;
        stepped = true;
        break;
      }
    }
    if (!stepped) return null;
  }

  return path;
}

export function validateMazeGrid(grid: string[]): MazeValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(grid) || grid.length < 3) {
    return {
      valid: false,
      errors: ['Lưới mê cung phải có ít nhất 3 hàng.'],
      rows: grid?.length ?? 0,
      cols: 0,
      start: null,
      goal: null,
      shortestDistance: null,
      manhattanDistance: null,
      sampleOptimalPath: [],
    };
  }

  const cols = grid[0]?.length ?? 0;
  if (cols < 3) {
    errors.push('Mỗi hàng lưới mê cung phải có ít nhất 3 cột.');
  }

  for (let r = 0; r < grid.length; r++) {
    if (grid[r].length !== cols) {
      errors.push(`Hàng ${r + 1} có độ dài ${grid[r].length}, khác với độ dài chuẩn ${cols}.`);
    }
  }

  const { starts, goals, invalidChars } = findMazeEndpoints(grid);
  if (invalidChars.length > 0) {
    errors.push(
      `Ký hiệu không hợp lệ tại (${invalidChars[0].row + 1}, ${invalidChars[0].col + 1}): "${invalidChars[0].char}". Chỉ chấp nhận #, ., S, E.`
    );
  }
  if (starts.length !== 1) {
    errors.push(`Cần đúng 1 ô xuất phát S (hiện có ${starts.length}).`);
  }
  if (goals.length !== 1) {
    errors.push(`Cần đúng 1 ô đích E (hiện có ${goals.length}).`);
  }

  const start = starts.length === 1 ? starts[0] : null;
  const goal = goals.length === 1 ? goals[0] : null;

  let shortestDistance: number | null = null;
  let manhattanDistance: number | null = null;
  let sampleOptimalPath: MazeDirection[] = [];

  if (errors.length === 0 && start && goal) {
    manhattanDistance = Math.abs(goal.row - start.row) + Math.abs(goal.col - start.col);
    const distMap = computeBfsDistancesToTarget(grid, goal);
    const d = distMap.get(`${start.row},${start.col}`);
    if (d === undefined) {
      errors.push('Mê cung vô nghiệm: không có đường đi hợp lệ nối từ S đến E.');
    } else {
      shortestDistance = d;
      sampleOptimalPath = reconstructOptimalPath(grid, start, goal) || [];
    }
  }

  return {
    valid: errors.length === 0 && shortestDistance !== null,
    errors,
    rows: grid.length,
    cols,
    start,
    goal,
    shortestDistance,
    manhattanDistance,
    sampleOptimalPath,
  };
}

/**
 * Generates mathematical explanation string (KaTeX-ready for shared MathView).
 */
export function buildMazeOptimalMathExplanation(validation: MazeValidationResult): string {
  if (!validation.valid || !validation.start || !validation.goal || validation.shortestDistance === null) {
    return 'Mê cung chưa hợp lệ.';
  }
  const dr = Math.abs(validation.goal.row - validation.start.row);
  const dc = Math.abs(validation.goal.col - validation.start.col);
  const manhattan = dr + dc;
  const shortest = validation.shortestDistance;

  if (shortest === manhattan) {
    return `Điểm xuất phát \\(S\\) và đích \\(E\\) cách nhau \\(${dr}\\) hàng và \\(${dc}\\) cột. Vì mỗi lệnh chỉ đi đúng \\(1\\) ô theo hàng hoặc cột nên cần ít nhất \\(${dr}+${dc}=${manhattan}\\) bước (khớp với đường ngắn nhất tìm được bằng BFS: \\(${shortest}\\) bước).`;
  }
  const detour = shortest - manhattan;
  return `Chênh lệch thẳng giữa \\(S\\) và \\(E\\) là \\(${dr}+${dc}=${manhattan}\\) bước, nhưng các bức tường buộc robot phải đi vòng thêm \\(${detour}\\) bước. Theo thuật toán tìm kiếm theo chiều rộng (BFS), đường đi ngắn nhất có đúng \\(${shortest}\\) bước.`;
}

// ============================================================================
// HINT COMPUTATION (BFS from ANY current position, including dead ends)
// ============================================================================

export function computeMazeHintFromPosition(
  grid: string[],
  currentPos: GridPos,
  goalPos: GridPos
): MazeHintResult {
  const distMap = computeBfsDistancesToTarget(grid, goalPos);
  const keyOf = (r: number, c: number) => `${r},${c}`;
  const curDist = distMap.get(keyOf(currentPos.row, currentPos.col));

  if (curDist === undefined) {
    return {
      solvable: false,
      from: currentPos,
      remainingShortestSteps: 0,
      recommendedDirection: null,
      alternativeOptimalDirections: [],
      nextPos: null,
      explanationLatex: 'Không tìm thấy đường tới đích từ vị trí hiện tại.',
      explanationText: 'Không tìm thấy đường tới đích từ vị trí hiện tại.',
    };
  }

  if (curDist === 0) {
    return {
      solvable: true,
      from: currentPos,
      remainingShortestSteps: 0,
      recommendedDirection: null,
      alternativeOptimalDirections: [],
      nextPos: null,
      explanationLatex: 'Robot đã ở ô đích \\(E\\).',
      explanationText: 'Robot đã ở ô đích E.',
    };
  }

  const dirs: MazeDirection[] = ['right', 'down', 'left', 'up'];
  const optimalDirs: MazeDirection[] = [];
  for (const dir of dirs) {
    const nr = currentPos.row + D_DIRECTION_DELTA[dir].row;
    const nc = currentPos.col + D_DIRECTION_DELTA[dir].col;
    if (distMap.get(keyOf(nr, nc)) === curDist - 1) {
      optimalDirs.push(dir);
    }
  }

  const chosen = optimalDirs[0] ?? null;
  const nextPos = chosen
    ? {
        row: currentPos.row + D_DIRECTION_DELTA[chosen].row,
        col: currentPos.col + D_DIRECTION_DELTA[chosen].col,
      }
    : null;

  const altText =
    optimalDirs.length > 1
      ? ` (có ${optimalDirs.length} hướng cùng ngắn nhất: ${optimalDirs
          .map((d) => DIRECTION_LABELS_VI[d])
          .join(', ')})`
      : '';

  return {
    solvable: true,
    from: currentPos,
    remainingShortestSteps: curDist,
    recommendedDirection: chosen,
    alternativeOptimalDirections: optimalDirs,
    nextPos,
    explanationLatex: chosen
      ? `Từ vị trí hiện tại, đi **${DIRECTION_LABELS_VI[chosen]}** (${DIRECTION_ARROWS[chosen]}) để tiến gần đích. Còn ít nhất \\(${curDist}\\) bước ngắn nhất${altText}.`
      : 'Không xác định được hướng tối ưu.',
    explanationText: chosen
      ? `Gợi ý đi ${DIRECTION_LABELS_VI[chosen]} — còn ít nhất ${curDist} bước tới đích${altText}.`
      : 'Không xác định được hướng tối ưu.',
  };
}

// ============================================================================
// STATE CREATION & EXPLORE MODE OPERATIONS
// ============================================================================

export function createMazeGameState(params?: {
  levelId?: string;
  mode?: MazePlayMode;
  classroomEnabled?: boolean;
  groupCount?: number;
  classSizeHint?: number;
}): MazeGameState {
  const level = getMazeLevelById(params?.levelId || F04_SAMPLE_LEVELS[0].id);
  const validation = validateMazeGrid(level.grid);
  if (!validation.valid || !validation.start) {
    throw new Error(`Built-in maze invalid: ${validation.errors.join('; ')}`);
  }

  return {
    levelId: level.id,
    mode: params?.mode ?? 'explore',
    robotPos: { ...validation.start },
    facing: 'right',
    visitedTrail: [{ ...validation.start }],
    stepCount: 0,
    undoCount: 0,
    hintsAppliedCount: 0,
    activeHint: null,
    completed: false,
    isOptimal: false,
    statusMessage: null,
    lastBlockedPos: null,

    program: [],
    runAttempts: 0,
    planOutcome: {
      status: 'idle',
      currentStepIndex: -1,
      blockedCommandIndex: null,
      unusedCommandsCount: 0,
      stepsExecuted: 0,
      message: 'Xếp chuỗi lệnh rồi bấm Chạy thử hoặc Chạy từng bước.',
    },
    isAutoRunning: false,

    classroomEnabled: Boolean(params?.classroomEnabled),
    groupCount: Math.max(2, Math.min(6, Math.round(params?.groupCount ?? 4))),
    activeGroupIndex: 0,
    classSizeHint: Math.max(1, Math.min(50, Math.round(params?.classSizeHint ?? 36))),
  };
}

export function attemptMoveFromPos(
  grid: string[],
  pos: GridPos,
  dir: MazeDirection
): {
  allowed: boolean;
  nextPos: GridPos;
  reason?: 'wall' | 'out_of_bounds';
} {
  const nr = pos.row + D_DIRECTION_DELTA[dir].row;
  const nc = pos.col + D_DIRECTION_DELTA[dir].col;
  const cell = getCellAt(grid, nr, nc);
  if (cell === null) {
    return { allowed: false, nextPos: pos, reason: 'out_of_bounds' };
  }
  if (cell === '#') {
    return { allowed: false, nextPos: pos, reason: 'wall' };
  }
  return { allowed: true, nextPos: { row: nr, col: nc } };
}

/**
 * Explore mode: move strictly ONE cell in `dir`.
 * - Valid move: increments stepCount by 1, appends to visitedTrail, clears activeHint.
 * - Blocked: robot stays put, statusMessage = "Lối này bị chặn", stepCount unchanged.
 * - Reaching E: sets completed = true ONCE and evaluates optimality vs BFS shortest distance.
 */
export function stepExploreMaze(
  state: MazeGameState,
  dir: MazeDirection,
  options?: { fromHint?: boolean }
): { state: MazeGameState; moved: boolean; blocked: boolean; completedNow: boolean } {
  if (state.mode !== 'explore' || state.completed) {
    return { state, moved: false, blocked: false, completedNow: false };
  }

  const level = getMazeLevelById(state.levelId);
  const validation = validateMazeGrid(level.grid);
  if (!validation.valid || !validation.goal || validation.shortestDistance === null) {
    return { state, moved: false, blocked: false, completedNow: false };
  }

  const attempt = attemptMoveFromPos(level.grid, state.robotPos, dir);
  if (!attempt.allowed) {
    const blockedTarget = {
      row: state.robotPos.row + D_DIRECTION_DELTA[dir].row,
      col: state.robotPos.col + D_DIRECTION_DELTA[dir].col,
    };
    return {
      moved: false,
      blocked: true,
      completedNow: false,
      state: {
        ...state,
        facing: dir,
        statusMessage: 'Lối này bị chặn',
        lastBlockedPos: blockedTarget,
      },
    };
  }

  const nextStepCount = state.stepCount + 1;
  const reachedGoal = posEquals(attempt.nextPos, validation.goal);
  const nextGroupIdx = state.classroomEnabled
    ? (state.activeGroupIndex + 1) % state.groupCount
    : state.activeGroupIndex;

  return {
    moved: true,
    blocked: false,
    completedNow: reachedGoal,
    state: {
      ...state,
      robotPos: attempt.nextPos,
      facing: dir,
      visitedTrail: [...state.visitedTrail, attempt.nextPos],
      stepCount: nextStepCount,
      hintsAppliedCount: options?.fromHint
        ? state.hintsAppliedCount + 1
        : state.hintsAppliedCount,
      activeHint: null,
      completed: reachedGoal,
      isOptimal: reachedGoal && nextStepCount === validation.shortestDistance,
      statusMessage: reachedGoal
        ? nextStepCount === validation.shortestDistance
          ? `Tuyệt vời! Robot đã về đích với ${nextStepCount} bước tối ưu.`
          : `Robot đã về đích sau ${nextStepCount} bước (ngắn nhất là ${validation.shortestDistance} bước).`
        : null,
      lastBlockedPos: null,
      activeGroupIndex: nextGroupIdx,
    },
  };
}

/**
 * Explore mode Undo: restores previous valid position, decrements stepCount by 1,
 * increments separate undoCount, and clears activeHint.
 */
export function undoExploreStep(state: MazeGameState): { state: MazeGameState; undone: boolean } {
  if (state.mode !== 'explore' || state.completed || state.visitedTrail.length <= 1) {
    return { state, undone: false };
  }
  const nextTrail = state.visitedTrail.slice(0, -1);
  const prevPos = nextTrail[nextTrail.length - 1];
  return {
    undone: true,
    state: {
      ...state,
      robotPos: { ...prevPos },
      visitedTrail: nextTrail,
      stepCount: Math.max(0, state.stepCount - 1),
      undoCount: state.undoCount + 1,
      activeHint: null,
      statusMessage: 'Đã hoàn tác về vị trí hợp lệ trước đó.',
      lastBlockedPos: null,
    },
  };
}

export function requestExploreHint(state: MazeGameState): MazeGameState {
  if (state.mode !== 'explore' || state.completed) return state;
  const level = getMazeLevelById(state.levelId);
  const validation = validateMazeGrid(level.grid);
  if (!validation.valid || !validation.goal) return state;

  const hint = computeMazeHintFromPosition(level.grid, state.robotPos, validation.goal);
  return {
    ...state,
    activeHint: hint,
    statusMessage: hint.explanationText,
  };
}

export function applyActiveExploreHint(state: MazeGameState): {
  state: MazeGameState;
  applied: boolean;
  completedNow: boolean;
} {
  if (!state.activeHint || !state.activeHint.recommendedDirection || state.completed) {
    return { state, applied: false, completedNow: false };
  }
  const res = stepExploreMaze(state, state.activeHint.recommendedDirection, { fromHint: true });
  return {
    state: res.state,
    applied: res.moved,
    completedNow: res.completedNow,
  };
}

// ============================================================================
// PLAN MODE: COMMAND EDITING & DETERMINISTIC EXECUTION / STEPPING
// ============================================================================

export function addPlanCommand(state: MazeGameState, dir: MazeDirection): MazeGameState {
  if (state.isAutoRunning || state.completed) return state;
  if (state.program.length >= 60) return state;
  return {
    ...state,
    program: [...state.program, dir],
    planOutcome: {
      ...state.planOutcome,
      blockedCommandIndex: null,
    },
  };
}

export function removePlanCommandAt(state: MazeGameState, index: number): MazeGameState {
  if (state.isAutoRunning || state.completed) return state;
  if (index < 0 || index >= state.program.length) return state;
  return {
    ...state,
    program: state.program.filter((_, i) => i !== index),
    planOutcome: {
      ...state.planOutcome,
      blockedCommandIndex: null,
    },
  };
}

export function movePlanCommand(
  state: MazeGameState,
  index: number,
  delta: -1 | 1
): MazeGameState {
  if (state.isAutoRunning || state.completed) return state;
  const target = index + delta;
  if (index < 0 || index >= state.program.length || target < 0 || target >= state.program.length) {
    return state;
  }
  const next = [...state.program];
  const temp = next[index];
  next[index] = next[target];
  next[target] = temp;
  return {
    ...state,
    program: next,
    planOutcome: {
      ...state.planOutcome,
      blockedCommandIndex: null,
    },
  };
}

export function replacePlanCommandAt(
  state: MazeGameState,
  index: number,
  dir: MazeDirection
): MazeGameState {
  if (state.isAutoRunning || state.completed) return state;
  if (index < 0 || index >= state.program.length) return state;
  const next = state.program.map((c, i) => (i === index ? dir : c));
  return {
    ...state,
    program: next,
    planOutcome: {
      ...state.planOutcome,
      blockedCommandIndex: null,
    },
  };
}

export function clearPlanCommands(state: MazeGameState): MazeGameState {
  if (state.isAutoRunning) return state;
  const level = getMazeLevelById(state.levelId);
  const validation = validateMazeGrid(level.grid);
  const start = validation.start ?? { row: 1, col: 1 };
  return {
    ...state,
    program: [],
    robotPos: { ...start },
    visitedTrail: [{ ...start }],
    stepCount: 0,
    completed: false,
    isOptimal: false,
    lastBlockedPos: null,
    statusMessage: null,
    planOutcome: {
      status: 'idle',
      currentStepIndex: -1,
      blockedCommandIndex: null,
      unusedCommandsCount: 0,
      stepsExecuted: 0,
      message: 'Đã xóa chuỗi lệnh. Hãy xếp lệnh mới.',
    },
  };
}

/**
 * Pure full simulation of a command sequence from S (used for diagnostics, testing, & instant skip).
 */
export function simulatePlanSequence(
  grid: string[],
  program: MazeDirection[]
): {
  finalPos: GridPos;
  trail: GridPos[];
  outcome: MazePlanExecutionOutcome;
  isOptimal: boolean;
  lastBlockedPos: GridPos | null;
} {
  const validation = validateMazeGrid(grid);
  if (!validation.valid || !validation.start || !validation.goal || validation.shortestDistance === null) {
    throw new Error('Cannot simulate invalid maze.');
  }

  let cur = { ...validation.start };
  const trail: GridPos[] = [{ ...cur }];

  if (program.length === 0) {
    return {
      finalPos: cur,
      trail,
      isOptimal: false,
      lastBlockedPos: null,
      outcome: {
        status: 'incomplete',
        currentStepIndex: -1,
        blockedCommandIndex: null,
        unusedCommandsCount: 0,
        stepsExecuted: 0,
        message: 'Chuỗi lệnh đang trống. Hãy thêm ít nhất 1 lệnh.',
      },
    };
  }

  for (let i = 0; i < program.length; i++) {
    const dir = program[i];
    const res = attemptMoveFromPos(grid, cur, dir);
    if (!res.allowed) {
      const blockedTarget = {
        row: cur.row + D_DIRECTION_DELTA[dir].row,
        col: cur.col + D_DIRECTION_DELTA[dir].col,
      };
      return {
        finalPos: cur,
        trail,
        isOptimal: false,
        lastBlockedPos: blockedTarget,
        outcome: {
          status: 'blocked',
          currentStepIndex: i,
          blockedCommandIndex: i,
          unusedCommandsCount: program.length - i,
          stepsExecuted: trail.length - 1,
          message: `Lệnh #${i + 1} (${DIRECTION_LABELS_VI[dir]}) bị chặn! Robot dừng sau ${trail.length - 1} bước hợp lệ — hãy sửa lệnh #${i + 1}.`,
        },
      };
    }

    cur = res.nextPos;
    trail.push({ ...cur });

    if (posEquals(cur, validation.goal)) {
      const stepsExecuted = trail.length - 1;
      const unused = program.length - (i + 1);
      const isOptimal = stepsExecuted === validation.shortestDistance;
      return {
        finalPos: cur,
        trail,
        isOptimal,
        lastBlockedPos: null,
        outcome: {
          status: 'completed',
          currentStepIndex: i,
          blockedCommandIndex: null,
          unusedCommandsCount: unused,
          stepsExecuted,
          message:
            unused > 0
              ? `Robot đã tới đích sau ${stepsExecuted} bước (dừng ngay, còn thừa ${unused} lệnh ở cuối chuỗi).`
              : isOptimal
                ? `Xuất sắc! Robot về đích với đúng ${stepsExecuted} bước tối ưu.`
                : `Robot đã về đích sau ${stepsExecuted} bước (đường ngắn nhất là ${validation.shortestDistance} bước).`,
        },
      };
    }
  }

  return {
    finalPos: cur,
    trail,
    isOptimal: false,
    lastBlockedPos: null,
    outcome: {
      status: 'incomplete',
      currentStepIndex: program.length - 1,
      blockedCommandIndex: null,
      unusedCommandsCount: 0,
      stepsExecuted: trail.length - 1,
      message: `Robot chưa tới đích sau ${trail.length - 1} bước. Hãy chỉnh hoặc thêm lệnh rồi chạy lại.`,
    },
  };
}

/**
 * Begins a fresh Plan run from Start `S` (resets robot to S, increments runAttempts once).
 */
export function startPlanRunFromStart(
  state: MazeGameState,
  autoRunning: boolean
): { state: MazeGameState; started: boolean } {
  if (state.mode !== 'plan' || state.program.length === 0) {
    return {
      started: false,
      state: {
        ...state,
        statusMessage: 'Hãy xếp ít nhất một lệnh trước khi chạy thử.',
      },
    };
  }
  const level = getMazeLevelById(state.levelId);
  const validation = validateMazeGrid(level.grid);
  if (!validation.valid || !validation.start) {
    return { state, started: false };
  }

  return {
    started: true,
    state: {
      ...state,
      robotPos: { ...validation.start },
      facing: state.program[0],
      visitedTrail: [{ ...validation.start }],
      stepCount: 0,
      completed: false,
      isOptimal: false,
      activeHint: null,
      lastBlockedPos: null,
      runAttempts: state.runAttempts + 1,
      isAutoRunning: autoRunning,
      statusMessage: 'Đang chạy chuỗi lệnh từ điểm xuất phát S...',
      planOutcome: {
        status: 'running',
        currentStepIndex: -1,
        blockedCommandIndex: null,
        unusedCommandsCount: 0,
        stepsExecuted: 0,
        message: 'Đang thực hiện chuỗi lệnh...',
      },
    },
  };
}

/**
 * Executes the NEXT single command in an active Plan run (used by both auto-run timer & "Chạy từng bước").
 */
export function advancePlanRunOneStep(state: MazeGameState): {
  state: MazeGameState;
  stepOutcome: 'moved' | 'blocked' | 'completed' | 'incomplete' | 'noop';
} {
  if (state.mode !== 'plan' || state.planOutcome.status !== 'running') {
    return { state, stepOutcome: 'noop' };
  }

  const nextIdx = state.planOutcome.currentStepIndex + 1;
  if (nextIdx >= state.program.length) {
    return {
      stepOutcome: 'incomplete',
      state: {
        ...state,
        isAutoRunning: false,
        statusMessage: 'Robot chưa tới đích',
        planOutcome: {
          status: 'incomplete',
          currentStepIndex: state.program.length - 1,
          blockedCommandIndex: null,
          unusedCommandsCount: 0,
          stepsExecuted: state.stepCount,
          message: `Robot chưa tới đích sau ${state.stepCount} bước. Hãy chỉnh lệnh và chạy lại.`,
        },
      },
    };
  }

  const level = getMazeLevelById(state.levelId);
  const validation = validateMazeGrid(level.grid);
  if (!validation.valid || !validation.goal || validation.shortestDistance === null) {
    return { state, stepOutcome: 'noop' };
  }

  const dir = state.program[nextIdx];
  const attempt = attemptMoveFromPos(level.grid, state.robotPos, dir);

  if (!attempt.allowed) {
    const blockedTarget = {
      row: state.robotPos.row + D_DIRECTION_DELTA[dir].row,
      col: state.robotPos.col + D_DIRECTION_DELTA[dir].col,
    };
    const msg = `Lệnh #${nextIdx + 1} (${DIRECTION_LABELS_VI[dir]}) gặp tường! Robot dừng sau ${state.stepCount} bước hợp lệ — hãy sửa lệnh #${nextIdx + 1}.`;
    return {
      stepOutcome: 'blocked',
      state: {
        ...state,
        facing: dir,
        isAutoRunning: false,
        lastBlockedPos: blockedTarget,
        statusMessage: msg,
        planOutcome: {
          status: 'blocked',
          currentStepIndex: nextIdx,
          blockedCommandIndex: nextIdx,
          unusedCommandsCount: state.program.length - nextIdx,
          stepsExecuted: state.stepCount,
          message: msg,
        },
      },
    };
  }

  const nextStepCount = state.stepCount + 1;
  const nextTrail = [...state.visitedTrail, attempt.nextPos];
  const reachedGoal = posEquals(attempt.nextPos, validation.goal);

  if (reachedGoal) {
    const unused = state.program.length - (nextIdx + 1);
    const isOptimal = nextStepCount === validation.shortestDistance;
    const msg =
      unused > 0
        ? `Robot đã tới đích sau ${nextStepCount} bước thực tế (dừng ngay, còn thừa ${unused} lệnh).`
        : isOptimal
          ? `Xuất sắc! Robot về đích với ${nextStepCount} bước tối ưu.`
          : `Robot đã về đích sau ${nextStepCount} bước (ngắn nhất là ${validation.shortestDistance} bước).`;
    return {
      stepOutcome: 'completed',
      state: {
        ...state,
        robotPos: attempt.nextPos,
        facing: dir,
        visitedTrail: nextTrail,
        stepCount: nextStepCount,
        completed: true,
        isOptimal,
        isAutoRunning: false,
        lastBlockedPos: null,
        statusMessage: msg,
        planOutcome: {
          status: 'completed',
          currentStepIndex: nextIdx,
          blockedCommandIndex: null,
          unusedCommandsCount: unused,
          stepsExecuted: nextStepCount,
          message: msg,
        },
      },
    };
  }

  // If that was the final command in the sequence and NOT at goal -> incomplete!
  if (nextIdx === state.program.length - 1) {
    const msg = `Robot chưa tới đích sau ${nextStepCount} bước. Hãy thêm hoặc sửa lệnh rồi chạy lại.`;
    return {
      stepOutcome: 'incomplete',
      state: {
        ...state,
        robotPos: attempt.nextPos,
        facing: dir,
        visitedTrail: nextTrail,
        stepCount: nextStepCount,
        isAutoRunning: false,
        lastBlockedPos: null,
        statusMessage: msg,
        planOutcome: {
          status: 'incomplete',
          currentStepIndex: nextIdx,
          blockedCommandIndex: null,
          unusedCommandsCount: 0,
          stepsExecuted: nextStepCount,
          message: msg,
        },
      },
    };
  }

  return {
    stepOutcome: 'moved',
    state: {
      ...state,
      robotPos: attempt.nextPos,
      facing: dir,
      visitedTrail: nextTrail,
      stepCount: nextStepCount,
      lastBlockedPos: null,
      statusMessage: `Đang thực hiện lệnh #${nextIdx + 1}: ${DIRECTION_LABELS_VI[dir]}`,
      planOutcome: {
        status: 'running',
        currentStepIndex: nextIdx,
        blockedCommandIndex: null,
        unusedCommandsCount: state.program.length - (nextIdx + 1),
        stepsExecuted: nextStepCount,
        message: `Đã thực hiện lệnh #${nextIdx + 1}: ${DIRECTION_LABELS_VI[dir]}`,
      },
    },
  };
}

/**
 * Stop an in-progress Plan run mid-way. Strictly NEVER marks completed.
 */
export function stopPlanRunMidway(state: MazeGameState): MazeGameState {
  if (state.mode !== 'plan') return state;
  return {
    ...state,
    isAutoRunning: false,
    completed: false,
    statusMessage: 'Đã dừng chạy giữa đường (chưa tính hoàn thành). Có thể chỉnh lệnh và chạy lại.',
    planOutcome: {
      ...state.planOutcome,
      status: 'stopped',
      message: 'Đã dừng giữa đường — bấm Chạy lại để bắt đầu từ ô xuất phát S.',
    },
  };
}

/**
 * Plan mode diagnostic hint: prioritizes identifying the FIRST blocked command in the user's program,
 * or where the robot stops and how many shortest steps remain from there, BEFORE revealing any sample path.
 */
export function computePlanDiagnosticHint(state: MazeGameState): {
  title: string;
  detail: string;
  blockedCommandNumber: number | null;
  remainingFromStop: number;
  suggestedNextDir: MazeDirection | null;
} {
  const level = getMazeLevelById(state.levelId);
  const validation = validateMazeGrid(level.grid);
  if (!validation.valid || !validation.start || !validation.goal) {
    return {
      title: 'Mê cung chưa hợp lệ',
      detail: 'Vui lòng chọn mê cung hợp lệ.',
      blockedCommandNumber: null,
      remainingFromStop: 0,
      suggestedNextDir: null,
    };
  }

  if (state.program.length === 0) {
    const startHint = computeMazeHintFromPosition(level.grid, validation.start, validation.goal);
    return {
      title: 'Chưa có lệnh nào',
      detail: startHint.recommendedDirection
        ? `Hãy thử bắt đầu bằng lệnh ${DIRECTION_LABELS_VI[startHint.recommendedDirection]} (${DIRECTION_ARROWS[startHint.recommendedDirection]}) từ ô xuất phát S.`
        : 'Hãy thêm lệnh di chuyển đầu tiên.',
      blockedCommandNumber: null,
      remainingFromStop: startHint.remainingShortestSteps,
      suggestedNextDir: startHint.recommendedDirection,
    };
  }

  const sim = simulatePlanSequence(level.grid, state.program);
  const stopHint = computeMazeHintFromPosition(level.grid, sim.finalPos, validation.goal);

  if (sim.outcome.status === 'blocked' && sim.outcome.blockedCommandIndex !== null) {
    const k = sim.outcome.blockedCommandIndex + 1;
    const badDir = DIRECTION_LABELS_VI[state.program[sim.outcome.blockedCommandIndex]];
    const fixText = stopHint.recommendedDirection
      ? ` Tại vị trí dừng (hàng ${sim.finalPos.row + 1}, cột ${sim.finalPos.col + 1}), nên đổi sang hướng ${DIRECTION_LABELS_VI[stopHint.recommendedDirection]} (${DIRECTION_ARROWS[stopHint.recommendedDirection]}).`
      : '';
    return {
      title: `Ưu tiên sửa lệnh #${k} (${badDir})`,
      detail: `Lệnh #${k} đâm vào tường sau ${sim.outcome.stepsExecuted} bước hợp lệ.${fixText}`,
      blockedCommandNumber: k,
      remainingFromStop: stopHint.remainingShortestSteps,
      suggestedNextDir: stopHint.recommendedDirection,
    };
  }

  if (sim.outcome.status === 'incomplete') {
    const nextText = stopHint.recommendedDirection
      ? ` Hướng tiếp theo gợi ý từ điểm dừng: ${DIRECTION_LABELS_VI[stopHint.recommendedDirection]} (${DIRECTION_ARROWS[stopHint.recommendedDirection]}), còn ít nhất ${stopHint.remainingShortestSteps} bước.`
      : '';
    return {
      title: 'Chuỗi lệnh chưa đủ tới đích',
      detail: `Robot dừng ở hàng ${sim.finalPos.row + 1}, cột ${sim.finalPos.col + 1} sau ${sim.outcome.stepsExecuted} bước.${nextText}`,
      blockedCommandNumber: null,
      remainingFromStop: stopHint.remainingShortestSteps,
      suggestedNextDir: stopHint.recommendedDirection,
    };
  }

  return {
    title: 'Chuỗi lệnh đã đưa robot tới đích',
    detail: sim.outcome.message,
    blockedCommandNumber: null,
    remainingFromStop: 0,
    suggestedNextDir: null,
  };
}

// ============================================================================
// DEMO-ISOLATED SESSION PERSISTENCE
// (Reloading mid-auto-run ALWAYS restores in STOPPED state!)
// ============================================================================

export interface MazePersistedSession {
  version: number;
  savedAt: number;
  state: MazeGameState;
  showTrail: boolean;
}

export function getF04StorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${F04_SESSION_STORAGE_KEY}`
    : F04_SESSION_STORAGE_KEY;
}

export function saveF04Session(state: MazeGameState, showTrail: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: MazePersistedSession = {
      version: F04_SESSION_VERSION,
      savedAt: Date.now(),
      state,
      showTrail: Boolean(showTrail),
    };
    window.localStorage.setItem(getF04StorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function loadF04Session(): MazePersistedSession | null {
  if (typeof window === 'undefined') return null;
  const key = getF04StorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MazePersistedSession>;
    if (
      !parsed ||
      parsed.version !== F04_SESSION_VERSION ||
      !parsed.state ||
      typeof parsed.state.levelId !== 'string' ||
      (parsed.state.mode !== 'explore' && parsed.state.mode !== 'plan') ||
      !parsed.state.robotPos ||
      !Array.isArray(parsed.state.visitedTrail) ||
      !Array.isArray(parsed.state.program)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    const level = getMazeLevelById(parsed.state.levelId);
    const validation = validateMazeGrid(level.grid);
    if (!validation.valid || !validation.start) {
      window.localStorage.removeItem(key);
      return null;
    }

    // Critical stability rule: if reloaded mid-auto-run, restore in STOPPED state at Start or safe stopped state so user actively runs again
    const wasRunning =
      parsed.state.isAutoRunning || parsed.state.planOutcome?.status === 'running';

    const restoredState: MazeGameState = wasRunning
      ? {
          ...parsed.state,
          robotPos: { ...validation.start },
          visitedTrail: [{ ...validation.start }],
          stepCount: 0,
          completed: false,
          isOptimal: false,
          isAutoRunning: false,
          statusMessage:
            'Đã khôi phục chuỗi lệnh ở trạng thái dừng sau khi tải lại trang. Bấm Chạy thử để chạy từ đầu.',
          planOutcome: {
            status: 'stopped',
            currentStepIndex: -1,
            blockedCommandIndex: null,
            unusedCommandsCount: 0,
            stepsExecuted: 0,
            message: 'Phiên đã khôi phục ở trạng thái dừng — bấm Chạy thử để chạy lại từ đầu.',
          },
        }
      : {
          ...parsed.state,
          isAutoRunning: false,
        };

    return {
      version: F04_SESSION_VERSION,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      state: restoredState,
      showTrail: parsed.showTrail !== false,
    };
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    return null;
  }
}

export function clearF04Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getF04StorageKey());
  } catch {
    // Ignore
  }
}
