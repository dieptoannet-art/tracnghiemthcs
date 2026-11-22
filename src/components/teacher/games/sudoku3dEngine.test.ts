import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUDOKU_4X4_PUZZLES,
  SUDOKU_9X9_PUZZLES,
  ALL_VERIFIED_SUDOKU_PUZZLES,
  parseGridStrings,
  validateSudokuPuzzle,
  countSudokuSolutions,
  generateValidatedSudokuPuzzle,
  createSudokuGameState,
  setCellValue,
  toggleCellNote,
  clearCell,
  undoLastSudokuAction,
  detectSudokuConflicts,
  computeSudokuHint,
  applySudokuHint,
  checkSudokuCompletion,
  replayCurrentSudokuPuzzle,
  saveSudokuSession,
  loadSudokuSession,
  clearSudokuSession,
  getSudokuStorageKey,
  SUDOKU_STORAGE_KEY_REAL,
  SUDOKU_STORAGE_KEY_DEMO,
  cellKey,
} from './sudoku3dEngine';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

test('1. Default 4x4 sample puzzle matches exact prompt grid, has unique solution, and solves cleanly to completion', () => {
  const sample = SUDOKU_4X4_PUZZLES[0];
  assert.equal(sample.size, 4);
  assert.deepEqual(
    sample.givens,
    parseGridStrings(['1 . . 4', '. 4 1 .', '2 . . 3', '. 3 2 .'], 4)
  );
  const expectedSolution = parseGridStrings(['1 2 3 4', '3 4 1 2', '2 1 4 3', '4 3 2 1'], 4);
  assert.deepEqual(sample.solution, expectedSolution);

  const validation = validateSudokuPuzzle(sample.givens, 4);
  assert.equal(validation.valid, true);
  assert.equal(validation.solutionCount, 1);
  assert.deepEqual(validation.solution, expectedSolution);

  // Play the full 4x4 board step-by-step and verify completion fires ONCE on the final cell
  let state = createSudokuGameState(sample, { mode: 'solo', timerEnabled: true });
  let completionEvents = 0;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (sample.givens[r][c] !== 0) continue;
      // Before last cell is placed, board must NOT report completed
      assert.equal(state.isCompleted, false);
      const res = setCellValue(state, r, c, expectedSolution[r][c]);
      assert.equal(res.changed, true);
      if (res.justCompleted) completionEvents++;
      state = res.state;
    }
  }

  assert.equal(state.isCompleted, true);
  assert.equal(completionEvents, 1);
  assert.equal(state.completionToken, 1);

  // Rapid duplicate click on any cell after completion must NOT trigger victory a second time
  const rapidClick = setCellValue(state, 0, 1, 2);
  assert.equal(rapidClick.changed, false);
  assert.equal(rapidClick.justCompleted, false);
  assert.equal(rapidClick.state.completionToken, 1);
});

test('2. All built-in 4x4 and 9x9 puzzles have exact unique solutions, and full 9x9 solves cleanly', () => {
  assert.ok(SUDOKU_4X4_PUZZLES.length >= 3);
  assert.ok(SUDOKU_9X9_PUZZLES.length >= 3);

  for (const puzzle of ALL_VERIFIED_SUDOKU_PUZZLES) {
    const check = validateSudokuPuzzle(puzzle.givens, puzzle.size);
    assert.equal(check.valid, true, `Puzzle ${puzzle.id} should be valid`);
    assert.equal(check.solutionCount, 1, `Puzzle ${puzzle.id} must have unique solution`);
    assert.ok(puzzle.difficultyLabel.length > 0);
  }

  // Play through an entire 9x9 puzzle to completion
  const puzzle9 = SUDOKU_9X9_PUZZLES[0];
  let state = createSudokuGameState(puzzle9, { mode: 'class', timerEnabled: true });
  let completionTriggers = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (puzzle9.givens[r][c] !== 0) continue;
      assert.equal(checkSudokuCompletion(state.values, puzzle9.givens, 9), false);
      const res = setCellValue(state, r, c, puzzle9.solution[r][c]);
      if (res.justCompleted) completionTriggers++;
      state = res.state;
    }
  }
  assert.equal(state.isCompleted, true);
  assert.equal(completionTriggers, 1);
});

test('3. Validator rejects unsolvable (0 solutions), multi-solution (>=2, stopping at 2), and malformed grids', () => {
  // Multi-solution 4x4 (only 2 givens -> many solutions, solver stops immediately at 2)
  const multiGrid = parseGridStrings(['1 . . .', '. . . .', '. . . .', '. . . 4'], 4);
  const multiCheck = validateSudokuPuzzle(multiGrid, 4);
  assert.equal(multiCheck.valid, false);
  assert.equal(multiCheck.solutionCount, 2);

  const countDirect = countSudokuSolutions(multiGrid, 4, 2);
  assert.equal(countDirect.count, 2);

  // Unsolvable 4x4 (no conflicting givens directly, yet cell (0,3) has 0 candidates: row has 1,2,3; col has 4)
  const unsolvableGrid = parseGridStrings(['1 2 3 .', '. . . 4', '. . . .', '. . . .'], 4);
  // Wait: (0,3) can't be 1,2,3 (row) and can't be 4 (col) -> 0 solutions!
  const unsolvableCheck = validateSudokuPuzzle(unsolvableGrid, 4);
  assert.equal(unsolvableCheck.valid, false);
  assert.equal(unsolvableCheck.solutionCount, 0);

  // Out-of-range digit on 4x4
  const badRange = parseGridStrings(['5 . . 4', '. 4 1 .', '2 . . 3', '. 3 2 .'], 4);
  const badRangeCheck = validateSudokuPuzzle(badRange, 4);
  assert.equal(badRangeCheck.valid, false);

  // Generator respects zero time budget by falling back to verified puzzle
  const fb = generateValidatedSudokuPuzzle(4, { timeBudgetMs: 0 });
  assert.equal(fb.usedFallback, true);
  assert.equal(validateSudokuPuzzle(fb.puzzle.givens, 4).solutionCount, 1);
});

test('4. Locked givens cannot be edited/noted/cleared; conflicts detected across row, column, and box', () => {
  const sample = SUDOKU_4X4_PUZZLES[0];
  let state = createSudokuGameState(sample);

  // Cell (0,0) is given = 1 -> strictly locked
  const tryEdit = setCellValue(state, 0, 0, 3);
  assert.equal(tryEdit.changed, false);
  assert.equal(tryEdit.blockedReason, 'locked_given');
  assert.equal(tryEdit.state.values[0][0], 1);

  const tryNote = toggleCellNote(state, 0, 0, 2);
  assert.equal(tryNote.changed, false);
  assert.equal(tryNote.blockedReason, 'locked_given');

  const tryErase = clearCell(state, 0, 0);
  assert.equal(tryErase.changed, false);
  assert.equal(tryErase.blockedReason, 'locked_given');

  // Empty board still has no conflicts -> reports "Chưa phát hiện xung đột."
  const cleanReport = detectSudokuConflicts(state.values, 4);
  assert.equal(cleanReport.hasConflicts, false);
  assert.ok(cleanReport.summaryMessage.includes('Chưa phát hiện xung đột'));

  // Place 1 at (0,1): duplicates row 1 (with (0,0)=1) AND box 1 (with (0,0)=1)
  state = setCellValue(state, 0, 1, 1).state;
  // Place 3 at (1,0): duplicates row? no, box? no; place 2 at (1,0) -> duplicates col 1 (with (2,0)=2)
  state = setCellValue(state, 1, 0, 2).state;

  const report = detectSudokuConflicts(state.values, 4);
  assert.equal(report.hasConflicts, true);
  assert.ok(report.highlightRows.includes(0));
  assert.ok(report.highlightCols.includes(0));
  assert.ok(report.highlightBoxes.includes(0));
  assert.ok(report.conflictCellKeys.includes(cellKey(0, 0)));
  assert.ok(report.conflictCellKeys.includes(cellKey(0, 1)));
  assert.ok(report.conflictCellKeys.includes(cellKey(1, 0)));
  assert.ok(report.conflictCellKeys.includes(cellKey(2, 0)));
});

test('5. Candidate notes do not count as answers, and Undo restores BOTH numbers and exact candidate notes', () => {
  const sample = SUDOKU_4X4_PUZZLES[0];
  let state = createSudokuGameState(sample);

  // Add notes [2, 3] on empty cell (0,1)
  state = toggleCellNote(state, 0, 1, 2).state;
  state = toggleCellNote(state, 0, 1, 3).state;
  assert.deepEqual(state.notes[cellKey(0, 1)], [2, 3]);
  assert.equal(state.values[0][1], 0); // Note is NOT an answer
  assert.equal(checkSudokuCompletion(state.values, sample.givens, 4), false);

  // Enter digit 2 on (0,1) -> clears notes on (0,1)
  state = setCellValue(state, 0, 1, 2).state;
  assert.equal(state.values[0][1], 2);
  assert.equal(state.notes[cellKey(0, 1)], undefined);

  // Undo digit entry -> restores empty cell AND exact notes [2, 3]!
  const undo1 = undoLastSudokuAction(state);
  assert.equal(undo1.undone, true);
  assert.equal(undo1.state.values[0][1], 0);
  assert.deepEqual(undo1.state.notes[cellKey(0, 1)], [2, 3]);

  // Undo second note toggle -> restores [2]
  const undo2 = undoLastSudokuAction(undo1.state);
  assert.equal(undo2.undone, true);
  assert.deepEqual(undo2.state.notes[cellKey(0, 1)], [2]);
});

test('6. Explainable hints never auto-fill, guide conflict resolution first, and apply only on explicit action', () => {
  const sample = SUDOKU_4X4_PUZZLES[0];
  let state = createSudokuGameState(sample);

  // Request hint on (0,1): Row 1 misses {2, 3}, Col 2 has 4 and 3 -> only 2 fits!
  const hint = computeSudokuHint(state.values, sample.givens, 4, { row: 0, col: 1 });
  assert.equal(hint.status, 'found');
  assert.deepEqual(hint.targetCell, { row: 0, col: 1 });
  assert.equal(hint.suggestedDigit, 2);
  assert.ok(hint.explanation.includes('hàng 1, cột 2'));
  assert.ok(hint.explanation.includes('2'));
  assert.ok(hint.highlightRows.includes(0) || hint.highlightCols.includes(1));

  // Verify computing a hint NEVER mutates the board before clicking "Áp dụng gợi ý"
  assert.equal(state.values[0][1], 0);
  assert.equal(state.hintsUsed, 0);

  // Explicit apply fills the cell and increments hintsUsed
  const applied = applySudokuHint(state, hint);
  assert.equal(applied.changed, true);
  assert.equal(applied.state.values[0][1], 2);
  assert.equal(applied.state.hintsUsed, 1);

  // If board has a conflict, hint refuses to fill and instructs to fix conflicts first
  const conflicted = setCellValue(applied.state, 0, 2, 2).state; // duplicates 2 in row 1
  const conflictHint = computeSudokuHint(conflicted.values, sample.givens, 4);
  assert.equal(conflictHint.status, 'has_conflicts');
  assert.equal(conflictHint.suggestedDigit, undefined);
  assert.ok(conflictHint.explanation.includes('xung đột'));

  // Incomplete board with 0 conflicts never claims completion
  const replayed = replayCurrentSudokuPuzzle(applied.state);
  assert.equal(replayed.values[0][1], 0);
  assert.equal(replayed.hintsUsed, 0);
  assert.equal(replayed.isCompleted, false);
});

test('7. Session persistence preserves puzzle, values, notes & hints, isolates /demo, and recovers from corrupt JSON', () => {
  const storage = new MemoryStorage();
  const sample = SUDOKU_4X4_PUZZLES[0];
  let state = createSudokuGameState(sample, { mode: 'class', timerEnabled: true });
  state = setCellValue(state, 0, 1, 2).state;
  state = toggleCellNote(state, 0, 2, 3).state;
  state = { ...state, elapsedSeconds: 47, hintsUsed: 1 };

  saveSudokuSession(state, storage);
  const restored = loadSudokuSession(storage);
  assert.ok(restored);
  assert.equal(restored!.puzzle.id, sample.id);
  assert.equal(restored!.mode, 'class');
  assert.equal(restored!.values[0][1], 2);
  assert.deepEqual(restored!.notes[cellKey(0, 2)], [3]);
  assert.equal(restored!.elapsedSeconds, 47);
  assert.equal(restored!.hintsUsed, 1);

  // Verify /demo isolation key distinction
  assert.notEqual(SUDOKU_STORAGE_KEY_REAL, SUDOKU_STORAGE_KEY_DEMO);
  assert.equal(getSudokuStorageKey(), SUDOKU_STORAGE_KEY_REAL);

  // Corrupt JSON recovers safely to null
  storage.setItem(SUDOKU_STORAGE_KEY_REAL, '{bad-json!!!');
  assert.equal(loadSudokuSession(storage), null);

  clearSudokuSession(storage);
  assert.equal(storage.getItem(SUDOKU_STORAGE_KEY_REAL), null);
});

test('8. F01 EduGameSoundBank cues degrade safely in headless/muted environments and honor turn tokens', () => {
  const bank = new EduGameSoundBank();
  const token = 'f01_test_turn';
  bank.setActiveTurnToken(token);
  assert.doesNotThrow(() => {
    bank.playSudokuPlaceTile(true, false, token);
    bank.playSudokuPlaceTile(false, true, token);
    bank.playSudokuConflictCue(false, token);
    bank.playSudokuCompleteFanfare(false, token);
    bank.stopAll();
    bank.playSudokuCompleteFanfare(false, 'stale_token');
    bank.dispose();
  });
});
