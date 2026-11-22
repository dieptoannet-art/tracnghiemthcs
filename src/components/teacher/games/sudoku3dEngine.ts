/**
 * F01 — Sudoku 3D Engine (Pure TypeScript, Zero DOM Dependency)
 *
 * Implements:
 * - Two board sizes: 4x4 (default, values 1-4, 2x2 boxes) and 9x9 (values 1-9, 3x3 boxes)
 * - Exact uniqueness validator (early-stops immediately after finding a 2nd solution)
 * - Verified built-in 4x4 & 9x9 sample puzzles (including exact required 4x4 puzzle)
 * - Budgeted puzzle generator with automatic verified fallback
 * - Transparent, human-explainable step-by-step hint solver (Naked Single, Hidden Single,
 *   Locked Candidates / Naked Pair) grounded strictly in the current board state
 * - Row/Column/Box conflict detection, candidate notes, full undo stack, strict completion guard
 * - Session persistence with /demo sandbox isolation and corrupt-JSON recovery
 */

import { isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export type SudokuSize = 4 | 9;
export type SudokuPlayMode = 'solo' | 'class';
export type SudokuDifficulty = 'basic' | 'intermediate' | 'advanced';

export interface SudokuPuzzle {
  id: string;
  title: string;
  size: SudokuSize;
  difficulty: SudokuDifficulty;
  difficultyLabel: string;
  techniqueSummary: string;
  isSample: boolean;
  /** 0 represents an empty cell; 1..size represents a locked given digit. */
  givens: number[][];
  /** Verified unique solution (used only for validation/testing, NEVER for fake hints). */
  solution: number[][];
}

export interface SudokuValidationResult {
  valid: boolean;
  solutionCount: number; // 0, 1, or 2 (capped at 2)
  solution: number[][] | null;
  errors: string[];
}

export interface SudokuConflictUnit {
  type: 'row' | 'col' | 'box';
  index: number; // 0-based
  digit: number;
  cells: Array<{ row: number; col: number }>;
  label: string;
}

export interface SudokuConflictReport {
  hasConflicts: boolean;
  conflictCellKeys: string[];
  conflictUnits: SudokuConflictUnit[];
  highlightRows: number[];
  highlightCols: number[];
  highlightBoxes: number[];
  summaryMessage: string;
}

export type SudokuHintStatus = 'found' | 'has_conflicts' | 'already_complete' | 'no_logical_step';

export type SudokuHintTechnique =
  | 'naked_single'
  | 'hidden_single_row'
  | 'hidden_single_col'
  | 'hidden_single_box'
  | 'locked_candidate_single'
  | 'naked_pair_single';

export interface SudokuHintStep {
  status: SudokuHintStatus;
  technique?: SudokuHintTechnique;
  techniqueLabel?: string;
  targetCell?: { row: number; col: number };
  suggestedDigit?: number;
  /** Clean explanation text (supports LaTeX inline formulas for Smart EDU MathView). */
  explanation: string;
  /** Plain Vietnamese speech text without LaTeX commands. */
  speechText: string;
  highlightRows: number[];
  highlightCols: number[];
  highlightBoxes: number[];
  highlightCells: string[];
  conflictReport?: SudokuConflictReport;
}

export interface SudokuUndoEntry {
  values: number[][];
  notes: Record<string, number[]>;
  description: string;
}

export interface SudokuGameState {
  puzzle: SudokuPuzzle;
  mode: SudokuPlayMode;
  values: number[][];
  notes: Record<string, number[]>;
  undoStack: SudokuUndoEntry[];
  hintsUsed: number;
  timerEnabled: boolean;
  elapsedSeconds: number;
  isCompleted: boolean;
  completionToken: number;
  completedAtMs: number | null;
}

export interface PersistedSudokuSession {
  version: 1;
  puzzleId: string;
  customPuzzle?: SudokuPuzzle;
  mode: SudokuPlayMode;
  values: number[][];
  notes: Record<string, number[]>;
  undoStack: SudokuUndoEntry[];
  hintsUsed: number;
  timerEnabled: boolean;
  elapsedSeconds: number;
  isCompleted: boolean;
  completionToken: number;
  completedAtMs: number | null;
  savedAtMs: number;
}

export const SUDOKU_STORAGE_KEY_REAL = 'taydo_f01_sudoku_3d_session_v1';
export const SUDOKU_STORAGE_KEY_DEMO = 'khkt_demo_f01_sudoku_3d_session_v1';

// ============================================================================
// COORDINATE & GRID HELPERS
// ============================================================================

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function getBoxSize(size: SudokuSize): number {
  return size === 4 ? 2 : 3;
}

export function getBoxIndex(row: number, col: number, size: SudokuSize): number {
  const b = getBoxSize(size);
  return Math.floor(row / b) * b + Math.floor(col / b);
}

export function getBoxOrigin(boxIndex: number, size: SudokuSize): { startRow: number; startCol: number } {
  const b = getBoxSize(size);
  return {
    startRow: Math.floor(boxIndex / b) * b,
    startCol: (boxIndex % b) * b,
  };
}

export function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

export function cloneNotes(notes: Record<string, number[]>): Record<string, number[]> {
  const copy: Record<string, number[]> = {};
  for (const [key, list] of Object.entries(notes)) {
    if (Array.isArray(list) && list.length > 0) {
      copy[key] = [...list];
    }
  }
  return copy;
}

export function parseGridStrings(rows: string[], size: SudokuSize): number[][] {
  return rows.map((line) => {
    const tokens = line
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const chars = tokens.length === size ? tokens : line.replace(/\s+/g, '').split('');
    return chars.slice(0, size).map((ch) => {
      if (ch === '.' || ch === '0') return 0;
      const num = Number(ch);
      return Number.isInteger(num) ? num : 0;
    });
  });
}

// ============================================================================
// EXACT UNIQUENESS SOLVER (STOPS IMMEDIATELY AT 2 SOLUTIONS)
// ============================================================================

function computeAllowedMask(grid: number[][], size: SudokuSize, row: number, col: number): number {
  const fullMask = (1 << size) - 1;
  let used = 0;
  for (let i = 0; i < size; i++) {
    const rv = grid[row][i];
    if (rv >= 1 && rv <= size) used |= 1 << (rv - 1);
    const cv = grid[i][col];
    if (cv >= 1 && cv <= size) used |= 1 << (cv - 1);
  }
  const b = getBoxSize(size);
  const sr = Math.floor(row / b) * b;
  const sc = Math.floor(col / b) * b;
  for (let r = sr; r < sr + b; r++) {
    for (let c = sc; c < sc + b; c++) {
      const bv = grid[r][c];
      if (bv >= 1 && bv <= size) used |= 1 << (bv - 1);
    }
  }
  return fullMask & ~used;
}

function popcount(mask: number): number {
  let count = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    count++;
  }
  return count;
}

/**
 * Counts Sudoku solutions up to `limit` (default 2, stopping IMMEDIATELY upon finding the 2nd solution).
 * Uses Minimum Remaining Values (MRV) heuristic so even hard 9x9 grids finish in < 5 ms.
 */
export function countSudokuSolutions(
  grid: number[][],
  size: SudokuSize,
  limit = 2,
  maxNodes = 250000
): { count: number; firstSolution: number[][] | null; timedOut: boolean } {
  const work = cloneGrid(grid);
  let count = 0;
  let firstSolution: number[][] | null = null;
  let nodes = 0;
  let timedOut = false;

  const search = () => {
    if (count >= limit || timedOut) return;
    nodes++;
    if (nodes > maxNodes) {
      timedOut = true;
      return;
    }

    let bestRow = -1;
    let bestCol = -1;
    let bestMask = 0;
    let bestCount = size + 1;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (work[r][c] !== 0) continue;
        const mask = computeAllowedMask(work, size, r, c);
        const cnt = popcount(mask);
        if (cnt === 0) return; // dead end
        if (cnt < bestCount) {
          bestCount = cnt;
          bestRow = r;
          bestCol = c;
          bestMask = mask;
          if (cnt === 1) break;
        }
      }
      if (bestCount === 1) break;
    }

    if (bestRow === -1) {
      count++;
      if (!firstSolution) {
        firstSolution = cloneGrid(work);
      }
      return;
    }

    for (let d = 1; d <= size; d++) {
      if ((bestMask & (1 << (d - 1))) === 0) continue;
      work[bestRow][bestCol] = d;
      search();
      work[bestRow][bestCol] = 0;
      if (count >= limit || timedOut) return;
    }
  };

  search();
  return { count, firstSolution, timedOut };
}

/**
 * Validates size, value range, given-cell integrity, conflict-freedom, and EXACT unique solution.
 */
export function validateSudokuPuzzle(grid: number[][], size: SudokuSize): SudokuValidationResult {
  const errors: string[] = [];
  if (size !== 4 && size !== 9) {
    return { valid: false, solutionCount: 0, solution: null, errors: ['Kích thước bảng chỉ hỗ trợ 4×4 hoặc 9×9.'] };
  }
  if (!Array.isArray(grid) || grid.length !== size) {
    return { valid: false, solutionCount: 0, solution: null, errors: [`Bảng phải có đúng ${size} hàng.`] };
  }

  let givenCount = 0;
  for (let r = 0; r < size; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== size) {
      errors.push(`Hàng ${r + 1} phải có đúng ${size} cột.`);
      continue;
    }
    for (let c = 0; c < size; c++) {
      const val = grid[r][c];
      if (!Number.isInteger(val) || val < 0 || val > size) {
        errors.push(`Ô hàng ${r + 1}, cột ${c + 1} có giá trị ngoài phạm vi 0–${size}.`);
      } else if (val > 0) {
        givenCount++;
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, solutionCount: 0, solution: null, errors };
  }
  if (givenCount === 0) {
    return { valid: false, solutionCount: 0, solution: null, errors: ['Đề không có ô cho sẵn nào.'] };
  }
  if (givenCount === size * size) {
    return { valid: false, solutionCount: 0, solution: null, errors: ['Đề đã điền kín toàn bộ ô.'] };
  }

  const conflicts = detectSudokuConflicts(grid, size);
  if (conflicts.hasConflicts) {
    return {
      valid: false,
      solutionCount: 0,
      solution: null,
      errors: [`Các ô cho sẵn bị xung đột: ${conflicts.summaryMessage}`],
    };
  }

  const { count, firstSolution, timedOut } = countSudokuSolutions(grid, size, 2);
  if (timedOut) {
    return {
      valid: false,
      solutionCount: count,
      solution: null,
      errors: ['Vượt quá giới hạn thời gian kiểm tra tính duy nhất của đề.'],
    };
  }
  if (count === 0) {
    return { valid: false, solutionCount: 0, solution: null, errors: ['Đề vô nghiệm (không có lời giải hợp lệ).'] };
  }
  if (count > 1) {
    return {
      valid: false,
      solutionCount: count,
      solution: null,
      errors: ['Đề có từ 2 nghiệm trở lên (không duy nhất), đã bị loại.'],
    };
  }

  return {
    valid: true,
    solutionCount: 1,
    solution: firstSolution,
    errors: [],
  };
}

// ============================================================================
// CONFLICT DETECTION & COMPLETION VERIFICATION
// ============================================================================

export function detectSudokuConflicts(grid: number[][], size: SudokuSize): SudokuConflictReport {
  const conflictSet = new Set<string>();
  const conflictUnits: SudokuConflictUnit[] = [];
  const rowSet = new Set<number>();
  const colSet = new Set<number>();
  const boxSet = new Set<number>();

  // 1. Rows
  for (let r = 0; r < size; r++) {
    const byDigit = new Map<number, Array<{ row: number; col: number }>>();
    for (let c = 0; c < size; c++) {
      const val = grid[r]?.[c] ?? 0;
      if (val < 1 || val > size) continue;
      const list = byDigit.get(val) ?? [];
      list.push({ row: r, col: c });
      byDigit.set(val, list);
    }
    for (const [digit, cells] of byDigit.entries()) {
      if (cells.length > 1) {
        rowSet.add(r);
        cells.forEach((cell) => conflictSet.add(cellKey(cell.row, cell.col)));
        const colsText = cells.map((c) => `cột ${c.col + 1}`).join(', ');
        conflictUnits.push({
          type: 'row',
          index: r,
          digit,
          cells,
          label: `Hàng ${r + 1} trùng số ${digit} (${colsText})`,
        });
      }
    }
  }

  // 2. Columns
  for (let c = 0; c < size; c++) {
    const byDigit = new Map<number, Array<{ row: number; col: number }>>();
    for (let r = 0; r < size; r++) {
      const val = grid[r]?.[c] ?? 0;
      if (val < 1 || val > size) continue;
      const list = byDigit.get(val) ?? [];
      list.push({ row: r, col: c });
      byDigit.set(val, list);
    }
    for (const [digit, cells] of byDigit.entries()) {
      if (cells.length > 1) {
        colSet.add(c);
        cells.forEach((cell) => conflictSet.add(cellKey(cell.row, cell.col)));
        const rowsText = cells.map((cell) => `hàng ${cell.row + 1}`).join(', ');
        conflictUnits.push({
          type: 'col',
          index: c,
          digit,
          cells,
          label: `Cột ${c + 1} trùng số ${digit} (${rowsText})`,
        });
      }
    }
  }

  // 3. Boxes
  const b = getBoxSize(size);
  for (let box = 0; box < size; box++) {
    const { startRow, startCol } = getBoxOrigin(box, size);
    const byDigit = new Map<number, Array<{ row: number; col: number }>>();
    for (let r = startRow; r < startRow + b; r++) {
      for (let c = startCol; c < startCol + b; c++) {
        const val = grid[r]?.[c] ?? 0;
        if (val < 1 || val > size) continue;
        const list = byDigit.get(val) ?? [];
        list.push({ row: r, col: c });
        byDigit.set(val, list);
      }
    }
    for (const [digit, cells] of byDigit.entries()) {
      if (cells.length > 1) {
        boxSet.add(box);
        cells.forEach((cell) => conflictSet.add(cellKey(cell.row, cell.col)));
        const posText = cells.map((cell) => `H${cell.row + 1}C${cell.col + 1}`).join(', ');
        conflictUnits.push({
          type: 'box',
          index: box,
          digit,
          cells,
          label: `Vùng ${box + 1} trùng số ${digit} (${posText})`,
        });
      }
    }
  }

  const hasConflicts = conflictUnits.length > 0;
  const summaryMessage = hasConflicts
    ? `Phát hiện ${conflictUnits.length} xung đột: ${conflictUnits
        .slice(0, 3)
        .map((u) => u.label)
        .join('; ')}${conflictUnits.length > 3 ? ` và ${conflictUnits.length - 3} mục khác` : ''}.`
    : 'Chưa phát hiện xung đột.';

  return {
    hasConflicts,
    conflictCellKeys: Array.from(conflictSet),
    conflictUnits,
    highlightRows: Array.from(rowSet),
    highlightCols: Array.from(colSet),
    highlightBoxes: Array.from(boxSet),
    summaryMessage,
  };
}

export function countFilledCells(values: number[][], size: SudokuSize): {
  totalCells: number;
  filledCells: number;
  emptyCells: number;
} {
  let filled = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = values[r]?.[c] ?? 0;
      if (v >= 1 && v <= size) filled++;
    }
  }
  const totalCells = size * size;
  return {
    totalCells,
    filledCells: filled,
    emptyCells: totalCells - filled,
  };
}

export function countUserFilledCells(values: number[][], givens: number[][], size: SudokuSize): {
  editableTotal: number;
  userFilled: number;
} {
  let editableTotal = 0;
  let userFilled = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (givens[r][c] === 0) {
        editableTotal++;
        const v = values[r]?.[c] ?? 0;
        if (v >= 1 && v <= size) userFilled++;
      }
    }
  }
  return { editableTotal, userFilled };
}

/**
 * Reports board completion ONLY if:
 * 1) Every cell has a valid digit 1..size
 * 2) Every given cell is untouched
 * 3) Every row, column, and box contains 1..size with zero duplicates
 */
export function checkSudokuCompletion(values: number[][], givens: number[][], size: SudokuSize): boolean {
  if (!Array.isArray(values) || values.length !== size) return false;
  for (let r = 0; r < size; r++) {
    if (!Array.isArray(values[r]) || values[r].length !== size) return false;
    for (let c = 0; c < size; c++) {
      const val = values[r][c];
      if (!Number.isInteger(val) || val < 1 || val > size) return false;
      if (givens[r][c] !== 0 && val !== givens[r][c]) return false;
    }
  }
  return !detectSudokuConflicts(values, size).hasConflicts;
}

// ============================================================================
// HUMAN-EXPLAINABLE STEP-BY-STEP HINT ENGINE
// ============================================================================

export function getCandidatesForCell(grid: number[][], size: SudokuSize, row: number, col: number): number[] {
  if (grid[row][col] !== 0) return [];
  const mask = computeAllowedMask(grid, size, row, col);
  const result: number[] = [];
  for (let d = 1; d <= size; d++) {
    if ((mask & (1 << (d - 1))) !== 0) result.push(d);
  }
  return result;
}

function getMissingDigitsInRow(grid: number[][], size: SudokuSize, row: number): number[] {
  const present = new Set<number>();
  for (let c = 0; c < size; c++) {
    if (grid[row][c] > 0) present.add(grid[row][c]);
  }
  const missing: number[] = [];
  for (let d = 1; d <= size; d++) {
    if (!present.has(d)) missing.push(d);
  }
  return missing;
}

function getMissingDigitsInCol(grid: number[][], size: SudokuSize, col: number): number[] {
  const present = new Set<number>();
  for (let r = 0; r < size; r++) {
    if (grid[r][col] > 0) present.add(grid[r][col]);
  }
  const missing: number[] = [];
  for (let d = 1; d <= size; d++) {
    if (!present.has(d)) missing.push(d);
  }
  return missing;
}

function getMissingDigitsInBox(grid: number[][], size: SudokuSize, boxIndex: number): number[] {
  const present = new Set<number>();
  const b = getBoxSize(size);
  const { startRow, startCol } = getBoxOrigin(boxIndex, size);
  for (let r = startRow; r < startRow + b; r++) {
    for (let c = startCol; c < startCol + b; c++) {
      if (grid[r][c] > 0) present.add(grid[r][c]);
    }
  }
  const missing: number[] = [];
  for (let d = 1; d <= size; d++) {
    if (!present.has(d)) missing.push(d);
  }
  return missing;
}

function formatDigitList(digits: number[]): string {
  if (digits.length === 0) return '';
  if (digits.length === 1) return `${digits[0]}`;
  if (digits.length === 2) return `${digits[0]} và ${digits[1]}`;
  return `${digits.slice(0, -1).join(', ')} và ${digits[digits.length - 1]}`;
}

function buildNakedSingleHint(grid: number[][], size: SudokuSize, row: number, col: number, digit: number): SudokuHintStep {
  const box = getBoxIndex(row, col, size);
  const rowMissing = getMissingDigitsInRow(grid, size, row);
  const colMissing = getMissingDigitsInCol(grid, size, col);
  const boxMissing = getMissingDigitsInBox(grid, size, box);

  const highlightRows: number[] = [];
  const highlightCols: number[] = [];
  const highlightBoxes: number[] = [];
  const highlightCells: string[] = [cellKey(row, col)];

  // Case A: Last remaining empty cell in row, col, or box (easiest for students to explain!)
  if (rowMissing.length === 1 && rowMissing[0] === digit) {
    highlightRows.push(row);
    const plain = `Ô hàng ${row + 1}, cột ${col + 1} chỉ còn số ${digit} vì hàng ${row + 1} đã có đủ các số còn lại và chỉ thiếu duy nhất số ${digit}.`;
    return {
      status: 'found',
      technique: 'naked_single',
      techniqueLabel: 'Ô cuối cùng trong hàng',
      targetCell: { row, col },
      suggestedDigit: digit,
      explanation: plain,
      speechText: plain,
      highlightRows,
      highlightCols,
      highlightBoxes,
      highlightCells,
    };
  }
  if (colMissing.length === 1 && colMissing[0] === digit) {
    highlightCols.push(col);
    const plain = `Ô hàng ${row + 1}, cột ${col + 1} chỉ còn số ${digit} vì cột ${col + 1} đã có đủ các số còn lại và chỉ thiếu duy nhất số ${digit}.`;
    return {
      status: 'found',
      technique: 'naked_single',
      techniqueLabel: 'Ô cuối cùng trong cột',
      targetCell: { row, col },
      suggestedDigit: digit,
      explanation: plain,
      speechText: plain,
      highlightRows,
      highlightCols,
      highlightBoxes,
      highlightCells,
    };
  }
  if (boxMissing.length === 1 && boxMissing[0] === digit) {
    highlightBoxes.push(box);
    const plain = `Ô hàng ${row + 1}, cột ${col + 1} chỉ còn số ${digit} vì vùng ${box + 1} đã có đủ các số còn lại và chỉ thiếu duy nhất số ${digit}.`;
    return {
      status: 'found',
      technique: 'naked_single',
      techniqueLabel: 'Ô cuối cùng trong vùng',
      targetCell: { row, col },
      suggestedDigit: digit,
      explanation: plain,
      speechText: plain,
      highlightRows,
      highlightCols,
      highlightBoxes,
      highlightCells,
    };
  }

  // Case B: Pick the tightest anchor unit (fewest missing digits) so the explanation is concise and verifiable
  type Anchor = { kind: 'row' | 'col' | 'box'; missing: number[] };
  const anchors: Anchor[] = [
    { kind: 'row', missing: rowMissing },
    { kind: 'col', missing: colMissing },
    { kind: 'box', missing: boxMissing },
  ];
  anchors.sort((a, b) => a.missing.length - b.missing.length);

  const anchor = anchors[0];
  const eliminated = anchor.missing.filter((d) => d !== digit);
  const colBlockers: number[] = [];
  const rowBlockers: number[] = [];
  const boxBlockers: number[] = [];

  for (const d of eliminated) {
    let found = false;
    if (anchor.kind !== 'col') {
      for (let r = 0; r < size; r++) {
        if (grid[r][col] === d) {
          colBlockers.push(d);
          highlightCells.push(cellKey(r, col));
          found = true;
          break;
        }
      }
    }
    if (!found && anchor.kind !== 'row') {
      for (let c = 0; c < size; c++) {
        if (grid[row][c] === d) {
          rowBlockers.push(d);
          highlightCells.push(cellKey(row, c));
          found = true;
          break;
        }
      }
    }
    if (!found && anchor.kind !== 'box') {
      const b = getBoxSize(size);
      const { startRow, startCol } = getBoxOrigin(box, size);
      for (let r = startRow; r < startRow + b; r++) {
        for (let c = startCol; c < startCol + b; c++) {
          if (grid[r][c] === d) {
            boxBlockers.push(d);
            highlightCells.push(cellKey(r, c));
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  }

  const anchorLabel =
    anchor.kind === 'row'
      ? `hàng ${row + 1}`
      : anchor.kind === 'col'
      ? `cột ${col + 1}`
      : `vùng ${box + 1}`;
  if (anchor.kind === 'row') highlightRows.push(row);
  if (anchor.kind === 'col') highlightCols.push(col);
  if (anchor.kind === 'box') highlightBoxes.push(box);

  const blockerParts: string[] = [];
  if (rowBlockers.length > 0) {
    highlightRows.push(row);
    blockerParts.push(`hàng ${row + 1} đã có số ${formatDigitList(rowBlockers)}`);
  }
  if (colBlockers.length > 0) {
    highlightCols.push(col);
    blockerParts.push(`cột ${col + 1} đã có số ${formatDigitList(colBlockers)}`);
  }
  if (boxBlockers.length > 0) {
    highlightBoxes.push(box);
    blockerParts.push(`vùng ${box + 1} đã có số ${formatDigitList(boxBlockers)}`);
  }

  const setMath = `\\{${anchor.missing.join(', ')}\\}`;
  const reasonSuffix = blockerParts.length > 0 ? `, còn ${blockerParts.join(' và ')}` : '';
  const explanation = `Ô hàng ${row + 1}, cột ${col + 1} chỉ còn số ${digit} vì ${anchorLabel} còn thiếu các số $${setMath}$${reasonSuffix}.`;
  const speechText = `Ô hàng ${row + 1}, cột ${col + 1} chỉ còn số ${digit} vì ${anchorLabel} còn thiếu ${formatDigitList(anchor.missing)}${reasonSuffix}.`;

  return {
    status: 'found',
    technique: 'naked_single',
    techniqueLabel: 'Loại trừ trực tiếp (Ô duy nhất)',
    targetCell: { row, col },
    suggestedDigit: digit,
    explanation,
    speechText,
    highlightRows: Array.from(new Set(highlightRows)),
    highlightCols: Array.from(new Set(highlightCols)),
    highlightBoxes: Array.from(new Set(highlightBoxes)),
    highlightCells: Array.from(new Set(highlightCells)),
  };
}

/**
 * Finds the clearest verifiable logical step on the CURRENT board.
 * Never fabricates a reason from the hidden solution.
 */
export function computeSudokuHint(
  values: number[][],
  givens: number[][],
  size: SudokuSize,
  preferredCell?: { row: number; col: number } | null
): SudokuHintStep {
  const conflicts = detectSudokuConflicts(values, size);
  if (conflicts.hasConflicts) {
    const msg = `Bảng đang có số trùng (${conflicts.conflictUnits[0].label}). Hãy kiểm tra và sửa các ô xung đột trước khi dùng gợi ý.`;
    return {
      status: 'has_conflicts',
      explanation: msg,
      speechText: msg,
      highlightRows: conflicts.highlightRows,
      highlightCols: conflicts.highlightCols,
      highlightBoxes: conflicts.highlightBoxes,
      highlightCells: conflicts.conflictCellKeys,
      conflictReport: conflicts,
    };
  }

  if (checkSudokuCompletion(values, givens, size)) {
    const msg = 'Bảng Sudoku đã được hoàn thành hợp lệ!';
    return {
      status: 'already_complete',
      explanation: msg,
      speechText: msg,
      highlightRows: [],
      highlightCols: [],
      highlightBoxes: [],
      highlightCells: [],
    };
  }

  // Build candidate map for all empty cells
  const candidates: number[][][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => getCandidatesForCell(values, size, r, c))
  );

  // If any empty cell has 0 candidates, the board has a logical contradiction (dead end)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (values[r][c] === 0 && candidates[r][c].length === 0) {
        const msg = `Ô hàng ${r + 1}, cột ${c + 1} hiện không còn số hợp lệ nào để điền (tất cả số từ 1 đến ${size} đều đã xuất hiện trên hàng, cột hoặc vùng liên quan). Hãy kiểm tra lại hoặc hoàn tác các nước đi gần đây.`;
        return {
          status: 'no_logical_step',
          explanation: msg,
          speechText: msg,
          highlightRows: [r],
          highlightCols: [c],
          highlightBoxes: [getBoxIndex(r, c, size)],
          highlightCells: [cellKey(r, c)],
        };
      }
    }
  }

  // 1. Check Naked Single — prefer selected cell first if it is already a naked single!
  if (
    preferredCell &&
    values[preferredCell.row]?.[preferredCell.col] === 0 &&
    candidates[preferredCell.row][preferredCell.col].length === 1
  ) {
    return buildNakedSingleHint(
      values,
      size,
      preferredCell.row,
      preferredCell.col,
      candidates[preferredCell.row][preferredCell.col][0]
    );
  }

  // Pick the easiest Naked Single (preferring units with fewest empty cells)
  let bestNaked: { row: number; col: number; digit: number; score: number } | null = null;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (values[r][c] === 0 && candidates[r][c].length === 1) {
        const minMissing = Math.min(
          getMissingDigitsInRow(values, size, r).length,
          getMissingDigitsInCol(values, size, c).length,
          getMissingDigitsInBox(values, size, getBoxIndex(r, c, size)).length
        );
        if (!bestNaked || minMissing < bestNaked.score) {
          bestNaked = { row: r, col: c, digit: candidates[r][c][0], score: minMissing };
        }
      }
    }
  }
  if (bestNaked) {
    return buildNakedSingleHint(values, size, bestNaked.row, bestNaked.col, bestNaked.digit);
  }

  // 2. Check Hidden Single in Box, Row, Column
  const b = getBoxSize(size);
  // 2a. Box Hidden Single
  for (let box = 0; box < size; box++) {
    const { startRow, startCol } = getBoxOrigin(box, size);
    for (let d = 1; d <= size; d++) {
      let alreadyPresent = false;
      const spots: Array<{ row: number; col: number }> = [];
      for (let r = startRow; r < startRow + b; r++) {
        for (let c = startCol; c < startCol + b; c++) {
          if (values[r][c] === d) {
            alreadyPresent = true;
            break;
          }
          if (values[r][c] === 0 && candidates[r][c].includes(d)) {
            spots.push({ row: r, col: c });
          }
        }
        if (alreadyPresent) break;
      }
      if (!alreadyPresent && spots.length === 1) {
        const target = spots[0];
        const blockingCells: string[] = [cellKey(target.row, target.col)];
        const hRows = new Set<number>();
        const hCols = new Set<number>();
        // Find cells containing d that eliminate the other empty cells in this box
        for (let r = startRow; r < startRow + b; r++) {
          for (let c = startCol; c < startCol + b; c++) {
            if (values[r][c] === 0 && (r !== target.row || c !== target.col)) {
              for (let cc = 0; cc < size; cc++) {
                if (values[r][cc] === d) {
                  hRows.add(r);
                  blockingCells.push(cellKey(r, cc));
                }
              }
              for (let rr = 0; rr < size; rr++) {
                if (values[rr][c] === d) {
                  hCols.add(c);
                  blockingCells.push(cellKey(rr, c));
                }
              }
            }
          }
        }
        const plain = `Trong vùng ${box + 1}, số ${d} chỉ có thể đặt ở ô hàng ${target.row + 1}, cột ${target.col + 1} vì mọi ô trống khác trong vùng này đều bị số ${d} ở các hàng hoặc cột cắt ngang loại trừ.`;
        return {
          status: 'found',
          technique: 'hidden_single_box',
          techniqueLabel: 'Vị trí duy nhất trong vùng',
          targetCell: target,
          suggestedDigit: d,
          explanation: plain,
          speechText: plain,
          highlightRows: Array.from(hRows),
          highlightCols: Array.from(hCols),
          highlightBoxes: [box],
          highlightCells: Array.from(new Set(blockingCells)),
        };
      }
    }
  }

  // 2b. Row Hidden Single
  for (let r = 0; r < size; r++) {
    for (let d = 1; d <= size; d++) {
      let alreadyPresent = false;
      const spots: number[] = [];
      for (let c = 0; c < size; c++) {
        if (values[r][c] === d) {
          alreadyPresent = true;
          break;
        }
        if (values[r][c] === 0 && candidates[r][c].includes(d)) {
          spots.push(c);
        }
      }
      if (!alreadyPresent && spots.length === 1) {
        const col = spots[0];
        const plain = `Trên hàng ${r + 1}, số ${d} chỉ có thể điền vào ô cột ${col + 1} vì các ô trống khác trên hàng này đều đã bị số ${d} ở cột hoặc vùng tương ứng chặn.`;
        return {
          status: 'found',
          technique: 'hidden_single_row',
          techniqueLabel: 'Vị trí duy nhất trên hàng',
          targetCell: { row: r, col },
          suggestedDigit: d,
          explanation: plain,
          speechText: plain,
          highlightRows: [r],
          highlightCols: [col],
          highlightBoxes: [getBoxIndex(r, col, size)],
          highlightCells: [cellKey(r, col)],
        };
      }
    }
  }

  // 2c. Column Hidden Single
  for (let c = 0; c < size; c++) {
    for (let d = 1; d <= size; d++) {
      let alreadyPresent = false;
      const spots: number[] = [];
      for (let r = 0; r < size; r++) {
        if (values[r][c] === d) {
          alreadyPresent = true;
          break;
        }
        if (values[r][c] === 0 && candidates[r][c].includes(d)) {
          spots.push(r);
        }
      }
      if (!alreadyPresent && spots.length === 1) {
        const row = spots[0];
        const plain = `Trên cột ${c + 1}, số ${d} chỉ có thể điền vào ô hàng ${row + 1} vì các ô trống khác trên cột này đều đã bị số ${d} ở hàng hoặc vùng tương ứng chặn.`;
        return {
          status: 'found',
          technique: 'hidden_single_col',
          techniqueLabel: 'Vị trí duy nhất trên cột',
          targetCell: { row, col: c },
          suggestedDigit: d,
          explanation: plain,
          speechText: plain,
          highlightRows: [row],
          highlightCols: [c],
          highlightBoxes: [getBoxIndex(row, c, size)],
          highlightCells: [cellKey(row, c)],
        };
      }
    }
  }

  // 3. Locked Candidates (Pointing Pair/Triple) -> yields an immediate verifiable single
  const reduced: Set<number>[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => new Set(candidates[r][c]))
  );

  for (let box = 0; box < size; box++) {
    const { startRow, startCol } = getBoxOrigin(box, size);
    for (let d = 1; d <= size; d++) {
      const boxCells: Array<{ row: number; col: number }> = [];
      for (let r = startRow; r < startRow + b; r++) {
        for (let c = startCol; c < startCol + b; c++) {
          if (values[r][c] === 0 && reduced[r][c].has(d)) {
            boxCells.push({ row: r, col: c });
          }
        }
      }
      if (boxCells.length < 2) continue;

      // All candidates for d in this box lie in the same row -> eliminate d from rest of row
      const allSameRow = boxCells.every((cell) => cell.row === boxCells[0].row);
      if (allSameRow) {
        const targetRow = boxCells[0].row;
        for (let c = 0; c < size; c++) {
          if (c >= startCol && c < startCol + b) continue;
          if (values[targetRow][c] === 0 && reduced[targetRow][c].has(d)) {
            const remaining = Array.from(reduced[targetRow][c]).filter((x) => x !== d);
            if (remaining.length === 1) {
              const finalDigit = remaining[0];
              const explanation = `Trong vùng ${box + 1}, số ${d} chắc chắn nằm trên hàng ${targetRow + 1} nên loại ${d} khỏi các ô khác trên hàng này; suy ra ô hàng ${targetRow + 1}, cột ${c + 1} chỉ còn số ${finalDigit}.`;
              return {
                status: 'found',
                technique: 'locked_candidate_single',
                techniqueLabel: 'Ứng viên khóa theo hàng',
                targetCell: { row: targetRow, col: c },
                suggestedDigit: finalDigit,
                explanation,
                speechText: explanation,
                highlightRows: [targetRow],
                highlightCols: [c],
                highlightBoxes: [box],
                highlightCells: [cellKey(targetRow, c), ...boxCells.map((x) => cellKey(x.row, x.col))],
              };
            }
          }
        }
      }

      // All candidates for d in this box lie in the same column -> eliminate d from rest of column
      const allSameCol = boxCells.every((cell) => cell.col === boxCells[0].col);
      if (allSameCol) {
        const targetCol = boxCells[0].col;
        for (let r = 0; r < size; r++) {
          if (r >= startRow && r < startRow + b) continue;
          if (values[r][targetCol] === 0 && reduced[r][targetCol].has(d)) {
            const remaining = Array.from(reduced[r][targetCol]).filter((x) => x !== d);
            if (remaining.length === 1) {
              const finalDigit = remaining[0];
              const explanation = `Trong vùng ${box + 1}, số ${d} chắc chắn nằm trên cột ${targetCol + 1} nên loại ${d} khỏi các ô khác trên cột này; suy ra ô hàng ${r + 1}, cột ${targetCol + 1} chỉ còn số ${finalDigit}.`;
              return {
                status: 'found',
                technique: 'locked_candidate_single',
                techniqueLabel: 'Ứng viên khóa theo cột',
                targetCell: { row: r, col: targetCol },
                suggestedDigit: finalDigit,
                explanation,
                speechText: explanation,
                highlightRows: [r],
                highlightCols: [targetCol],
                highlightBoxes: [box],
                highlightCells: [cellKey(r, targetCol), ...boxCells.map((x) => cellKey(x.row, x.col))],
              };
            }
          }
        }
      }
    }
  }

  // 4. Naked Pair in Row/Col/Box -> yields an immediate verifiable single
  const checkUnitNakedPair = (
    unitCells: Array<{ row: number; col: number }>,
    unitLabel: string,
    hRows: number[],
    hCols: number[],
    hBoxes: number[]
  ): SudokuHintStep | null => {
    const pairCells = unitCells.filter(
      (cell) => values[cell.row][cell.col] === 0 && candidates[cell.row][cell.col].length === 2
    );
    for (let i = 0; i < pairCells.length; i++) {
      for (let j = i + 1; j < pairCells.length; j++) {
        const c1 = candidates[pairCells[i].row][pairCells[i].col];
        const c2 = candidates[pairCells[j].row][pairCells[j].col];
        if (c1[0] === c2[0] && c1[1] === c2[1]) {
          const [p1, p2] = c1;
          for (const other of unitCells) {
            if (
              values[other.row][other.col] !== 0 ||
              (other.row === pairCells[i].row && other.col === pairCells[i].col) ||
              (other.row === pairCells[j].row && other.col === pairCells[j].col)
            ) {
              continue;
            }
            const remaining = candidates[other.row][other.col].filter((x) => x !== p1 && x !== p2);
            if (remaining.length === 1 && candidates[other.row][other.col].length > 1) {
              const finalDigit = remaining[0];
              const explanation = `Trong ${unitLabel}, hai ô (H${pairCells[i].row + 1}C${pairCells[i].col + 1}) và (H${pairCells[j].row + 1}C${pairCells[j].col + 1}) chỉ nhận cặp số $\\{${p1}, ${p2}\\}$. Loại ${p1} và ${p2} khỏi các ô khác trong ${unitLabel}, ô hàng ${other.row + 1}, cột ${other.col + 1} chỉ còn số ${finalDigit}.`;
              const speechText = `Trong ${unitLabel}, hai ô hàng ${pairCells[i].row + 1} cột ${pairCells[i].col + 1} và hàng ${pairCells[j].row + 1} cột ${pairCells[j].col + 1} giữ cặp số ${p1} và ${p2}, nên ô hàng ${other.row + 1}, cột ${other.col + 1} chỉ còn số ${finalDigit}.`;
              return {
                status: 'found',
                technique: 'naked_pair_single',
                techniqueLabel: 'Loại trừ cặp đôi',
                targetCell: other,
                suggestedDigit: finalDigit,
                explanation,
                speechText,
                highlightRows: hRows,
                highlightCols: hCols,
                highlightBoxes: hBoxes,
                highlightCells: [
                  cellKey(other.row, other.col),
                  cellKey(pairCells[i].row, pairCells[i].col),
                  cellKey(pairCells[j].row, pairCells[j].col),
                ],
              };
            }
          }
        }
      }
    }
    return null;
  };

  for (let r = 0; r < size; r++) {
    const unit = Array.from({ length: size }, (_, c) => ({ row: r, col: c }));
    const hit = checkUnitNakedPair(unit, `hàng ${r + 1}`, [r], [], []);
    if (hit) return hit;
  }
  for (let c = 0; c < size; c++) {
    const unit = Array.from({ length: size }, (_, r) => ({ row: r, col: c }));
    const hit = checkUnitNakedPair(unit, `cột ${c + 1}`, [], [c], []);
    if (hit) return hit;
  }
  for (let box = 0; box < size; box++) {
    const { startRow, startCol } = getBoxOrigin(box, size);
    const unit: Array<{ row: number; col: number }> = [];
    for (let r = startRow; r < startRow + b; r++) {
      for (let c = startCol; c < startCol + b; c++) {
        unit.push({ row: r, col: c });
      }
    }
    const hit = checkUnitNakedPair(unit, `vùng ${box + 1}`, [], [], [box]);
    if (hit) return hit;
  }

  const fallbackMsg =
    'Chưa tìm được bước suy luận trực tiếp bằng các kỹ thuật hiện có (ô duy nhất, vị trí duy nhất, ứng viên khóa, cặp đôi). Bạn hãy thử kiểm tra lại các ô vừa điền hoặc chọn một ô khác.';
  return {
    status: 'no_logical_step',
    explanation: fallbackMsg,
    speechText: fallbackMsg,
    highlightRows: [],
    highlightCols: [],
    highlightBoxes: [],
    highlightCells: [],
  };
}

/**
 * Classifies a puzzle's difficulty strictly by the deduction techniques required to solve it.
 */
export function classifySudokuDifficulty(givens: number[][], size: SudokuSize): {
  difficulty: SudokuDifficulty;
  difficultyLabel: string;
  techniqueSummary: string;
} {
  const work = cloneGrid(givens);
  let usedHidden = false;
  let usedAdvanced = false;
  let neededFallback = false;

  for (let step = 0; step < size * size; step++) {
    if (checkSudokuCompletion(work, givens, size)) break;
    const hint = computeSudokuHint(work, givens, size);
    if (hint.status !== 'found' || !hint.targetCell || !hint.suggestedDigit) {
      neededFallback = true;
      break;
    }
    if (
      hint.technique === 'hidden_single_row' ||
      hint.technique === 'hidden_single_col' ||
      hint.technique === 'hidden_single_box'
    ) {
      usedHidden = true;
    } else if (hint.technique === 'locked_candidate_single' || hint.technique === 'naked_pair_single') {
      usedAdvanced = true;
    }
    work[hint.targetCell.row][hint.targetCell.col] = hint.suggestedDigit;
  }

  if (usedAdvanced || neededFallback) {
    return {
      difficulty: 'advanced',
      difficultyLabel: 'Nâng cao',
      techniqueSummary: 'Cần phối hợp vị trí duy nhất, ứng viên khóa / cặp đôi',
    };
  }
  if (usedHidden) {
    return {
      difficulty: 'intermediate',
      difficultyLabel: 'Trung bình',
      techniqueSummary: 'Kết hợp loại trừ ô duy nhất và vị trí duy nhất',
    };
  }
  return {
    difficulty: 'basic',
    difficultyLabel: 'Cơ bản',
    techniqueSummary: 'Giải trọn vẹn bằng loại trừ trực tiếp (ô duy nhất)',
  };
}

// ============================================================================
// VERIFIED BUILT-IN SAMPLE PUZZLES (4x4 & 9x9)
// ============================================================================

function createVerifiedPuzzle(params: {
  id: string;
  title: string;
  size: SudokuSize;
  rows: string[];
  isSample?: boolean;
}): SudokuPuzzle {
  const givens = parseGridStrings(params.rows, params.size);
  const validation = validateSudokuPuzzle(givens, params.size);
  if (!validation.valid || !validation.solution) {
    throw new Error(`Built-in Sudoku puzzle ${params.id} failed validation: ${validation.errors.join('; ')}`);
  }
  const diff = classifySudokuDifficulty(givens, params.size);
  return {
    id: params.id,
    title: params.title,
    size: params.size,
    difficulty: diff.difficulty,
    difficultyLabel: diff.difficultyLabel,
    techniqueSummary: diff.techniqueSummary,
    isSample: params.isSample ?? true,
    givens,
    solution: validation.solution,
  };
}

export const SUDOKU_4X4_PUZZLES: SudokuPuzzle[] = [
  createVerifiedPuzzle({
    id: 'f01_4x4_sample_1',
    title: 'Đề mẫu 4×4 – Khởi động #1',
    size: 4,
    // Exact puzzle specified in F01 master prompt
    rows: ['1 . . 4', '. 4 1 .', '2 . . 3', '. 3 2 .'],
  }),
  createVerifiedPuzzle({
    id: 'f01_4x4_sample_2',
    title: 'Đề mẫu 4×4 – Làm quen #2',
    size: 4,
    rows: ['. 2 . 4', '4 . 2 .', '. 1 . 3', '3 . 1 .'],
  }),
  createVerifiedPuzzle({
    id: 'f01_4x4_sample_3',
    title: 'Đề mẫu 4×4 – Suy luận #3',
    size: 4,
    rows: ['3 . . 1', '. 2 3 .', '. 3 1 .', '2 . . 3'],
  }),
];

export const SUDOKU_9X9_PUZZLES: SudokuPuzzle[] = [
  createVerifiedPuzzle({
    id: 'f01_9x9_sample_1',
    title: 'Đề mẫu 9×9 – Khởi động #1',
    size: 9,
    rows: [
      '5 3 . . 7 . . . .',
      '6 . . 1 9 5 . . .',
      '. 9 8 . . . . 6 .',
      '8 . . . 6 . . . 3',
      '4 . . 8 . 3 . . 1',
      '7 . . . 2 . . . 6',
      '. 6 . . . . 2 8 .',
      '. . . 4 1 9 . . 5',
      '. . . . 8 . . 7 9',
    ],
  }),
  createVerifiedPuzzle({
    id: 'f01_9x9_sample_2',
    title: 'Đề mẫu 9×9 – Rèn suy luận #2',
    size: 9,
    rows: [
      '. 2 . 6 . 8 . . .',
      '5 8 . . . 9 7 . .',
      '. . . . 4 . . . .',
      '3 7 . . . . 5 . .',
      '6 . . . . . . . 4',
      '. . 8 . . . . 1 3',
      '. . . . 2 . . . .',
      '. . 9 8 . . . 3 6',
      '. . . 3 . 6 . 9 .',
    ],
  }),
  createVerifiedPuzzle({
    id: 'f01_9x9_sample_3',
    title: 'Đề mẫu 9×9 – Cân bằng #3',
    size: 9,
    rows: [
      '8 . . 4 . 6 . . 7',
      '. . . . . . 4 . .',
      '. 1 . . . . 6 5 .',
      '5 . 9 . 3 . 7 8 .',
      '. . . . 7 . . . .',
      '. 4 8 . 2 . 1 . 3',
      '. 5 2 . . . . 9 .',
      '. . 1 . . . . . .',
      '3 . . 9 . 2 . . 5',
    ],
  }),
];

export const ALL_VERIFIED_SUDOKU_PUZZLES: SudokuPuzzle[] = [...SUDOKU_4X4_PUZZLES, ...SUDOKU_9X9_PUZZLES];

export function getVerifiedPuzzlesBySize(size: SudokuSize): SudokuPuzzle[] {
  return size === 4 ? SUDOKU_4X4_PUZZLES : SUDOKU_9X9_PUZZLES;
}

export function getDefaultSudokuPuzzle(size: SudokuSize = 4): SudokuPuzzle {
  return size === 4 ? SUDOKU_4X4_PUZZLES[0] : SUDOKU_9X9_PUZZLES[0];
}

// ============================================================================
// BUDGETED RANDOMIZED PUZZLE GENERATOR (WITH GUARANTEED VERIFIED FALLBACK)
// ============================================================================

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function permuteVerifiedPuzzle(base: SudokuPuzzle, rng: () => number, customIndex: number): SudokuPuzzle {
  const size = base.size;
  const b = getBoxSize(size);

  // 1. Digit permutation
  const digits = shuffleWithRng(
    Array.from({ length: size }, (_, i) => i + 1),
    rng
  );
  // 2. Band & row-within-band permutation
  const bands = shuffleWithRng(
    Array.from({ length: b }, (_, i) => i),
    rng
  );
  const rowOrder: number[] = [];
  for (const band of bands) {
    const inner = shuffleWithRng(
      Array.from({ length: b }, (_, i) => band * b + i),
      rng
    );
    rowOrder.push(...inner);
  }
  // 3. Stack & col-within-stack permutation
  const stacks = shuffleWithRng(
    Array.from({ length: b }, (_, i) => i),
    rng
  );
  const colOrder: number[] = [];
  for (const stack of stacks) {
    const inner = shuffleWithRng(
      Array.from({ length: b }, (_, i) => stack * b + i),
      rng
    );
    colOrder.push(...inner);
  }
  // 4. Optional transpose
  const transpose = rng() > 0.5;

  const transformGrid = (src: number[][]): number[][] => {
    const out = Array.from({ length: size }, () => Array(size).fill(0));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const sr = transpose ? colOrder[c] : rowOrder[r];
        const sc = transpose ? rowOrder[r] : colOrder[c];
        const val = src[sr][sc];
        out[r][c] = val === 0 ? 0 : digits[val - 1];
      }
    }
    return out;
  };

  const givens = transformGrid(base.givens);
  const validation = validateSudokuPuzzle(givens, size);
  if (!validation.valid || !validation.solution) {
    return base;
  }
  const diff = classifySudokuDifficulty(givens, size);
  return {
    id: `f01_${size}x${size}_gen_${customIndex}`,
    title: `Đề mới ${size}×${size} (${diff.difficultyLabel})`,
    size,
    difficulty: diff.difficulty,
    difficultyLabel: diff.difficultyLabel,
    techniqueSummary: diff.techniqueSummary,
    isSample: true,
    givens,
    solution: validation.solution,
  };
}

/**
 * Generates a fresh unique-solution puzzle within `timeBudgetMs`.
 * If budget is exceeded or validation fails, returns a verified built-in puzzle immediately.
 */
export function generateValidatedSudokuPuzzle(
  size: SudokuSize,
  options?: { excludeId?: string; timeBudgetMs?: number; rng?: () => number }
): { puzzle: SudokuPuzzle; usedFallback: boolean } {
  const timeBudgetMs = options?.timeBudgetMs ?? 120;
  const rng = options?.rng ?? Math.random;
  const started = Date.now();
  const pool = getVerifiedPuzzlesBySize(size);
  const fallback = pool.find((p) => p.id !== options?.excludeId) ?? pool[0];

  if (timeBudgetMs <= 0) {
    return { puzzle: fallback, usedFallback: true };
  }

  try {
    const seedBase = pool[Math.floor(rng() * pool.length)] ?? pool[0];
    if (Date.now() - started > timeBudgetMs) {
      return { puzzle: fallback, usedFallback: true };
    }
    const generated = permuteVerifiedPuzzle(seedBase, rng, Math.floor(rng() * 9000) + 1000);
    if (Date.now() - started > timeBudgetMs) {
      return { puzzle: fallback, usedFallback: true };
    }
    const verified = validateSudokuPuzzle(generated.givens, size);
    if (verified.valid && verified.solutionCount === 1) {
      return { puzzle: generated, usedFallback: false };
    }
  } catch {
    // Fall back safely to verified puzzle
  }
  return { puzzle: fallback, usedFallback: true };
}

// ============================================================================
// IMMUTABLE STATE REDUCERS (VALUE, NOTES, ERASE, UNDO, HINT APPLY, REPLAY)
// ============================================================================

export function createSudokuGameState(
  puzzle: SudokuPuzzle,
  options?: { mode?: SudokuPlayMode; timerEnabled?: boolean }
): SudokuGameState {
  return {
    puzzle,
    mode: options?.mode ?? 'solo',
    values: cloneGrid(puzzle.givens),
    notes: {},
    undoStack: [],
    hintsUsed: 0,
    timerEnabled: options?.timerEnabled ?? true,
    elapsedSeconds: 0,
    isCompleted: false,
    completionToken: 0,
    completedAtMs: null,
  };
}

export function isCellGiven(state: SudokuGameState, row: number, col: number): boolean {
  return (state.puzzle.givens[row]?.[col] ?? 0) !== 0;
}

const MAX_UNDO_HISTORY = 120;

function pushUndo(state: SudokuGameState, description: string): SudokuUndoEntry[] {
  const entry: SudokuUndoEntry = {
    values: cloneGrid(state.values),
    notes: cloneNotes(state.notes),
    description,
  };
  const next = [...state.undoStack, entry];
  return next.length > MAX_UNDO_HISTORY ? next.slice(next.length - MAX_UNDO_HISTORY) : next;
}

export interface SudokuEditResult {
  state: SudokuGameState;
  changed: boolean;
  /** True ONLY on the exact transition from incomplete -> complete (prevents double celebration). */
  justCompleted: boolean;
  blockedReason?: 'locked_given' | 'already_completed' | 'invalid_digit';
}

export function setCellValue(
  state: SudokuGameState,
  row: number,
  col: number,
  digit: number
): SudokuEditResult {
  if (state.isCompleted) {
    return { state, changed: false, justCompleted: false, blockedReason: 'already_completed' };
  }
  if (row < 0 || row >= state.puzzle.size || col < 0 || col >= state.puzzle.size) {
    return { state, changed: false, justCompleted: false, blockedReason: 'invalid_digit' };
  }
  if (!Number.isInteger(digit) || digit < 0 || digit > state.puzzle.size) {
    return { state, changed: false, justCompleted: false, blockedReason: 'invalid_digit' };
  }
  if (isCellGiven(state, row, col)) {
    return { state, changed: false, justCompleted: false, blockedReason: 'locked_given' };
  }

  const key = cellKey(row, col);
  const currentVal = state.values[row][col];
  const currentNotes = state.notes[key] ?? [];

  if (digit === 0 && currentVal === 0 && currentNotes.length === 0) {
    return { state, changed: false, justCompleted: false };
  }
  if (digit !== 0 && currentVal === digit && currentNotes.length === 0) {
    return { state, changed: false, justCompleted: false };
  }

  const nextValues = cloneGrid(state.values);
  nextValues[row][col] = digit;
  const nextNotes = cloneNotes(state.notes);
  delete nextNotes[key];

  const completedNow = checkSudokuCompletion(nextValues, state.puzzle.givens, state.puzzle.size);
  const justCompleted = !state.isCompleted && completedNow;

  const nextState: SudokuGameState = {
    ...state,
    values: nextValues,
    notes: nextNotes,
    undoStack: pushUndo(
      state,
      digit === 0 ? `Xóa ô H${row + 1}C${col + 1}` : `Điền ${digit} vào ô H${row + 1}C${col + 1}`
    ),
    isCompleted: completedNow,
    completionToken: justCompleted ? state.completionToken + 1 : state.completionToken,
    completedAtMs: justCompleted ? Date.now() : state.completedAtMs,
  };

  return { state: nextState, changed: true, justCompleted };
}

export function toggleCellNote(
  state: SudokuGameState,
  row: number,
  col: number,
  digit: number
): SudokuEditResult {
  if (state.isCompleted) {
    return { state, changed: false, justCompleted: false, blockedReason: 'already_completed' };
  }
  if (row < 0 || row >= state.puzzle.size || col < 0 || col >= state.puzzle.size) {
    return { state, changed: false, justCompleted: false, blockedReason: 'invalid_digit' };
  }
  if (!Number.isInteger(digit) || digit < 1 || digit > state.puzzle.size) {
    return { state, changed: false, justCompleted: false, blockedReason: 'invalid_digit' };
  }
  if (isCellGiven(state, row, col)) {
    return { state, changed: false, justCompleted: false, blockedReason: 'locked_given' };
  }
  // Notes apply to empty cells; if cell has a value, ignore note toggle so students don't accidentally erase answers
  if (state.values[row][col] !== 0) {
    return { state, changed: false, justCompleted: false };
  }

  const key = cellKey(row, col);
  const nextNotes = cloneNotes(state.notes);
  const existing = new Set(nextNotes[key] ?? []);
  if (existing.has(digit)) {
    existing.delete(digit);
  } else {
    existing.add(digit);
  }
  const sorted = Array.from(existing).sort((a, b) => a - b);
  if (sorted.length > 0) {
    nextNotes[key] = sorted;
  } else {
    delete nextNotes[key];
  }

  return {
    state: {
      ...state,
      notes: nextNotes,
      undoStack: pushUndo(state, `Ghi chú số ${digit} tại ô H${row + 1}C${col + 1}`),
    },
    changed: true,
    justCompleted: false,
  };
}

export function clearCell(state: SudokuGameState, row: number, col: number): SudokuEditResult {
  return setCellValue(state, row, col, 0);
}

export function undoLastSudokuAction(state: SudokuGameState): {
  state: SudokuGameState;
  undone: boolean;
} {
  if (state.undoStack.length === 0) {
    return { state, undone: false };
  }
  const prev = state.undoStack[state.undoStack.length - 1];
  const nextStack = state.undoStack.slice(0, -1);
  const completedNow = checkSudokuCompletion(prev.values, state.puzzle.givens, state.puzzle.size);
  return {
    state: {
      ...state,
      values: cloneGrid(prev.values),
      notes: cloneNotes(prev.notes),
      undoStack: nextStack,
      isCompleted: completedNow,
      completedAtMs: completedNow ? state.completedAtMs : null,
    },
    undone: true,
  };
}

export function applySudokuHint(state: SudokuGameState, hint: SudokuHintStep): SudokuEditResult {
  if (hint.status !== 'found' || !hint.targetCell || !hint.suggestedDigit) {
    return { state, changed: false, justCompleted: false };
  }
  const edit = setCellValue(state, hint.targetCell.row, hint.targetCell.col, hint.suggestedDigit);
  if (!edit.changed) return edit;
  return {
    ...edit,
    state: {
      ...edit.state,
      hintsUsed: state.hintsUsed + 1,
    },
  };
}

export function replayCurrentSudokuPuzzle(state: SudokuGameState): SudokuGameState {
  return createSudokuGameState(state.puzzle, {
    mode: state.mode,
    timerEnabled: state.timerEnabled,
  });
}

// ============================================================================
// SESSION PERSISTENCE (/DEMO ISOLATED + CORRUPT JSON SAFE)
// ============================================================================

export function getSudokuStorageKey(): string {
  return isKhktDemoRuntime() ? SUDOKU_STORAGE_KEY_DEMO : SUDOKU_STORAGE_KEY_REAL;
}

export function saveSudokuSession(state: SudokuGameState, storage?: Storage): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return;
    const isBuiltIn = ALL_VERIFIED_SUDOKU_PUZZLES.some((p) => p.id === state.puzzle.id);
    const payload: PersistedSudokuSession = {
      version: 1,
      puzzleId: state.puzzle.id,
      customPuzzle: isBuiltIn ? undefined : state.puzzle,
      mode: state.mode,
      values: state.values,
      notes: state.notes,
      undoStack: state.undoStack.slice(-40),
      hintsUsed: state.hintsUsed,
      timerEnabled: state.timerEnabled,
      elapsedSeconds: state.elapsedSeconds,
      isCompleted: state.isCompleted,
      completionToken: state.completionToken,
      completedAtMs: state.completedAtMs,
      savedAtMs: Date.now(),
    };
    store.setItem(getSudokuStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore quota or storage restriction errors
  }
}

export function loadSudokuSession(storage?: Storage): SudokuGameState | null {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return null;
    const raw = store.getItem(getSudokuStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSudokuSession>;
    if (!parsed || parsed.version !== 1 || typeof parsed.puzzleId !== 'string') return null;

    let puzzle = ALL_VERIFIED_SUDOKU_PUZZLES.find((p) => p.id === parsed.puzzleId) ?? null;
    if (!puzzle && parsed.customPuzzle) {
      const candidate = parsed.customPuzzle;
      const check = validateSudokuPuzzle(candidate.givens, candidate.size);
      if (check.valid && check.solution) {
        puzzle = { ...candidate, solution: check.solution };
      }
    }
    if (!puzzle) return null;

    const size = puzzle.size;
    if (!Array.isArray(parsed.values) || parsed.values.length !== size) return null;

    // Sanitize values & guarantee givens cannot be altered by corrupted storage
    const cleanValues = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => {
        if (puzzle!.givens[r][c] !== 0) return puzzle!.givens[r][c];
        const v = parsed.values?.[r]?.[c];
        return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= size ? v : 0;
      })
    );

    // Sanitize notes
    const cleanNotes: Record<string, number[]> = {};
    if (parsed.notes && typeof parsed.notes === 'object') {
      for (const [key, arr] of Object.entries(parsed.notes)) {
        const [rs, cs] = key.split('-');
        const r = Number(rs);
        const c = Number(cs);
        if (
          !Number.isInteger(r) ||
          !Number.isInteger(c) ||
          r < 0 ||
          r >= size ||
          c < 0 ||
          c >= size ||
          puzzle.givens[r][c] !== 0 ||
          cleanValues[r][c] !== 0
        ) {
          continue;
        }
        if (Array.isArray(arr)) {
          const validDigits = Array.from(
            new Set(arr.filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= size))
          ).sort((a, b) => a - b);
          if (validDigits.length > 0) cleanNotes[key] = validDigits;
        }
      }
    }

    const cleanUndo: SudokuUndoEntry[] = Array.isArray(parsed.undoStack)
      ? parsed.undoStack
          .filter((u) => u && Array.isArray(u.values) && u.values.length === size)
          .slice(-40)
          .map((u) => ({
            values: cloneGrid(u.values),
            notes: cloneNotes(u.notes ?? {}),
            description: typeof u.description === 'string' ? u.description : 'Hoàn tác',
          }))
      : [];

    const recomputedComplete = checkSudokuCompletion(cleanValues, puzzle.givens, size);

    return {
      puzzle,
      mode: parsed.mode === 'class' ? 'class' : 'solo',
      values: cleanValues,
      notes: cleanNotes,
      undoStack: cleanUndo,
      hintsUsed: typeof parsed.hintsUsed === 'number' && parsed.hintsUsed >= 0 ? Math.floor(parsed.hintsUsed) : 0,
      timerEnabled: typeof parsed.timerEnabled === 'boolean' ? parsed.timerEnabled : true,
      elapsedSeconds:
        typeof parsed.elapsedSeconds === 'number' && parsed.elapsedSeconds >= 0
          ? Math.floor(parsed.elapsedSeconds)
          : 0,
      isCompleted: recomputedComplete,
      completionToken:
        typeof parsed.completionToken === 'number' && parsed.completionToken >= 0
          ? parsed.completionToken
          : recomputedComplete
          ? 1
          : 0,
      completedAtMs: recomputedComplete ? parsed.completedAtMs ?? Date.now() : null,
    };
  } catch {
    return null;
  }
}

export function clearSudokuSession(storage?: Storage): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    store?.removeItem(getSudokuStorageKey());
  } catch {
    // Ignore
  }
}
