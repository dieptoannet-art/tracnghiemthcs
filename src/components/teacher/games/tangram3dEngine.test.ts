import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TANGRAM_PIECE_ORDER,
  TANGRAM_PIECE_SPECS,
  TANGRAM_SAMPLE_PUZZLES,
  getTangramPuzzleById,
  polygonArea,
  convexIntersectionArea,
  getPieceWorldPolygon,
  evaluateTangramBoard,
  createTangramGameState,
  placeOrMovePiece,
  rotatePiece,
  flipPiece,
  returnPieceToTray,
  undoTangramAction,
  computeTangramHint,
  applyTangramHintMove,
  saveTangramSession,
  loadTangramSession,
  clearTangramSession,
  getTangramStorageKey,
  TANGRAM_STORAGE_KEY_REAL,
  TANGRAM_STORAGE_KEY_DEMO,
} from './tangram3dEngine';
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

test('1. Exact 7 Tangram pieces sum to 16 sq units and Master Square outer contour is (0,0)-(4,0)-(4,4)-(0,4)', () => {
  assert.equal(TANGRAM_PIECE_ORDER.length, 7);
  const totalArea = TANGRAM_PIECE_ORDER.reduce((acc, id) => acc + TANGRAM_PIECE_SPECS[id].area, 0);
  assert.equal(totalArea, 16);

  // Verify each piece's local vertices have exact canonical area
  for (const id of TANGRAM_PIECE_ORDER) {
    const spec = TANGRAM_PIECE_SPECS[id];
    assert.ok(Math.abs(polygonArea(spec.localVertices) - spec.area) < 1e-6);
  }

  // Master square outer contour has ZERO internal seams (exact 4-vertex outer square of area 16)
  const master = getTangramPuzzleById('f02_square_master');
  assert.equal(master.outerContours.length, 1);
  assert.equal(master.outerContours[0].length, 4);
  assert.ok(Math.abs(polygonArea(master.outerContours[0]) - 16) < 1e-6);

  // Starts with all 7 pieces in tray
  const init = createTangramGameState({ mode: 'guided', puzzleId: 'f02_square_master' });
  for (const id of TANGRAM_PIECE_ORDER) {
    assert.equal(init.pieces[id].onBoard, false);
  }
});

test('2. Playing Master Square & swapping congruent pieces (large_1 <-> large_2, small_1 <-> small_2) both complete ONCE', () => {
  const master = getTangramPuzzleById('f02_square_master');
  let state = createTangramGameState({ mode: 'challenge', puzzleId: 'f02_square_master' });
  let winTriggers = 0;

  // Swap large_1 with large_2 AND small_1 with small_2!
  const swapMap: Record<string, string> = {
    large_1: 'large_2',
    large_2: 'large_1',
    small_1: 'small_2',
    small_2: 'small_1',
  };

  for (const slot of master.solutionSlots) {
    const assignedPieceId = (swapMap[slot.pieceId] ?? slot.pieceId) as typeof slot.pieceId;
    assert.equal(state.isCompleted, false);
    const res = placeOrMovePiece(state, assignedPieceId, slot.x, slot.y, {
      enableSnap: false,
      rotationDeg: slot.rotationDeg,
      flipped: slot.flipped,
    });
    assert.equal(res.changed, true, `Piece ${assignedPieceId} should place cleanly without overlap`);
    if (res.justCompleted) winTriggers++;
    state = res.state;
  }

  assert.equal(state.isCompleted, true);
  assert.equal(winTriggers, 1);
  const ev = evaluateTangramBoard(state.pieces, master);
  assert.equal(ev.allSevenPlaced, true);
  assert.ok(ev.maxPairwiseOverlap < 1e-4);
  assert.ok(ev.totalOutsideArea < 1e-4);
  assert.ok(ev.uncoveredInsideArea < 1e-4);

  // Moving an already-solved piece in place must NOT trigger completion a second time
  const slot0 = master.solutionSlots[0];
  const repeat = placeOrMovePiece(state, 'large_2', slot0.x, slot0.y, {
    enableSnap: false,
    rotationDeg: slot0.rotationDeg,
  });
  assert.equal(repeat.justCompleted, false);
  assert.equal(repeat.state.completionToken, 1);
});

test('3. All 5 built-in sample puzzles (including flipped-parallelogram challenges) verify and solve cleanly', () => {
  assert.ok(TANGRAM_SAMPLE_PUZZLES.length >= 4);
  const flippedPuzzles = TANGRAM_SAMPLE_PUZZLES.filter((p) => p.requiresParallelogramFlip);
  assert.ok(flippedPuzzles.length >= 2, 'Should include puzzles requiring flipping the parallelogram');

  for (const puzzle of TANGRAM_SAMPLE_PUZZLES) {
    let state = createTangramGameState({ mode: 'challenge', puzzleId: puzzle.id });
    for (const slot of puzzle.solutionSlots) {
      // For parallelogram, verify flipPiece flips state before placing when required
      if (slot.pieceId === 'parallelogram' && slot.flipped) {
        const flippedRes = flipPiece(state, 'parallelogram');
        assert.equal(flippedRes.changed, true);
        assert.equal(flippedRes.state.pieces.parallelogram.flipped, true);
        state = flippedRes.state;
      }
      const res = placeOrMovePiece(state, slot.pieceId, slot.x, slot.y, {
        enableSnap: false,
        rotationDeg: slot.rotationDeg,
        flipped: slot.flipped,
      });
      assert.equal(res.changed, true, `Puzzle ${puzzle.id} slot ${slot.pieceId} must place without overlap`);
      state = res.state;
    }
    assert.equal(state.isCompleted, true, `Puzzle ${puzzle.id} must complete with all 7 pieces`);
  }

  // Explicitly prove flipped-parallelogram puzzle FAILS if parallelogram is NOT flipped!
  const trianglePuzzle = getTangramPuzzleById('f02_big_triangle');
  let unflippedState = createTangramGameState({ mode: 'challenge', puzzleId: 'f02_big_triangle' });
  for (const slot of trianglePuzzle.solutionSlots) {
    const res = placeOrMovePiece(unflippedState, slot.pieceId, slot.x, slot.y, {
      enableSnap: false,
      rotationDeg: slot.rotationDeg,
      flipped: false, // refuse to flip parallelogram
    });
    if (res.changed) unflippedState = res.state;
  }
  assert.equal(
    unflippedState.isCompleted,
    false,
    'Big Triangle must NOT complete when parallelogram is left unflipped'
  );
});

test('4. Edge-touching pieces are valid; overlapping pieces are rejected & reverted; outside protrusion fails completion', () => {
  const master = getTangramPuzzleById('f02_square_master');
  let state = createTangramGameState({ mode: 'challenge', puzzleId: 'f02_square_master' });

  // Place large_1 and large_2 touching along shared edge (2,2)-(4,0) -> valid (0 overlap)
  const s1 = master.solutionSlots.find((s) => s.pieceId === 'large_1')!;
  const s2 = master.solutionSlots.find((s) => s.pieceId === 'large_2')!;
  state = placeOrMovePiece(state, 'large_1', s1.x, s1.y, { enableSnap: false, rotationDeg: s1.rotationDeg }).state;
  const touchRes = placeOrMovePiece(state, 'large_2', s2.x, s2.y, { enableSnap: false, rotationDeg: s2.rotationDeg });
  assert.equal(touchRes.changed, true);
  state = touchRes.state;
  assert.ok(
    convexIntersectionArea(getPieceWorldPolygon(state.pieces.large_1), getPieceWorldPolygon(state.pieces.large_2)) < 1e-6
  );

  // Attempt to drop square right on top of large_1 -> REJECTED and stays in tray!
  const overlapRes = placeOrMovePiece(state, 'square', s1.x, s1.y, { enableSnap: false });
  assert.equal(overlapRes.changed, false);
  assert.ok(overlapRes.rejectedOverlapWith?.includes('large_1'));
  assert.equal(overlapRes.state.pieces.square.onBoard, false);

  // Place square completely outside the 4x4 target -> detected as outside protrusion & not complete
  const outRes = placeOrMovePiece(state, 'square', -2, 2, { enableSnap: false });
  assert.equal(outRes.changed, true);
  const ev = evaluateTangramBoard(outRes.state.pieces, master);
  assert.equal(ev.isCompleted, false);
  assert.ok(ev.outsidePieces.some((o) => o.id === 'square'));
  assert.ok(ev.totalOutsideArea > 1.5);
});

test('5. Rotate 45 deg, flip, return to tray, undo, and two-level hints preserve all 7 pieces without loss', () => {
  let state = createTangramGameState({ mode: 'challenge', puzzleId: 'f02_square_master' });

  // Rotate & flip parallelogram in tray
  state = rotatePiece(state, 'parallelogram', 45).state;
  assert.equal(state.pieces.parallelogram.rotationDeg, 45);
  state = flipPiece(state, 'parallelogram').state;
  assert.equal(state.pieces.parallelogram.flipped, true);

  // Undo flip -> restores flipped=false, rotation=45
  const u1 = undoTangramAction(state);
  assert.equal(u1.undone, true);
  assert.equal(u1.state.pieces.parallelogram.flipped, false);
  assert.equal(u1.state.pieces.parallelogram.rotationDeg, 45);
  state = u1.state;

  // Level 1 hint gives observation without moving pieces
  const h1 = computeTangramHint(state, 1, 0);
  assert.equal(h1.status, 'ok');
  assert.equal(h1.suggestedMove, undefined);

  // Level 2 hint suggests 1 piece without auto-placing it
  const h2 = computeTangramHint(state, 2);
  assert.equal(h2.status, 'ok');
  assert.ok(h2.suggestedMove);
  assert.equal(state.pieces[h2.suggestedMove!.pieceId].onBoard, false);

  // Explicit Apply Hint places the piece and increments hintsUsed
  const applied = applyTangramHintMove(state, h2);
  assert.equal(applied.changed, true);
  assert.equal(applied.state.hintsUsed, 1);
  assert.equal(applied.state.pieces[h2.suggestedMove!.pieceId].onBoard, true);

  // Return to tray never loses piece
  const returned = returnPieceToTray(applied.state, h2.suggestedMove!.pieceId);
  assert.equal(returned.changed, true);
  assert.equal(returned.state.pieces[h2.suggestedMove!.pieceId].onBoard, false);
  assert.equal(Object.keys(returned.state.pieces).length, 7);

  // If a piece protrudes outside target, Level 2 hint flags it as blocking
  const outsideState = placeOrMovePiece(returned.state, 'medium', -2.5, 2, { enableSnap: false }).state;
  const blockedHint = computeTangramHint(outsideState, 2);
  assert.equal(blockedHint.status, 'blocked');
  assert.ok(blockedHint.blockingPieceIds.includes('medium'));
});

test('6. Free Build mode never reports win/loss even if pieces form a square, and saves custom title', () => {
  const master = getTangramPuzzleById('f02_square_master');
  let state = createTangramGameState({ mode: 'free', puzzleId: 'f02_square_master' });
  state = { ...state, freeBuildName: 'Con mèo của lớp 6A' };

  for (const slot of master.solutionSlots) {
    const res = placeOrMovePiece(state, slot.pieceId, slot.x, slot.y, {
      enableSnap: false,
      rotationDeg: slot.rotationDeg,
      flipped: slot.flipped,
    });
    assert.equal(res.justCompleted, false);
    state = res.state;
  }
  assert.equal(state.isCompleted, false);
  assert.equal(state.freeBuildName, 'Con mèo của lớp 6A');
});

test('7. Session persistence restores puzzle, piece positions, rotation & flip, isolates /demo, and handles corrupt JSON', () => {
  const storage = new MemoryStorage();
  let state = createTangramGameState({
    mode: 'challenge',
    puzzleId: 'f02_sailboat',
    classroomEnabled: true,
    groupCount: 5,
  });
  state = flipPiece(state, 'parallelogram').state;
  state = rotatePiece(state, 'parallelogram', 45).state;
  state = placeOrMovePiece(state, 'parallelogram', 1.5, 0.5, { enableSnap: false }).state;

  saveTangramSession(state, storage);
  const restored = loadTangramSession(storage);
  assert.ok(restored);
  assert.equal(restored!.mode, 'challenge');
  assert.equal(restored!.puzzleId, 'f02_sailboat');
  assert.equal(restored!.classroomEnabled, true);
  assert.equal(restored!.groupCount, 5);
  assert.equal(restored!.pieces.parallelogram.onBoard, true);
  assert.equal(restored!.pieces.parallelogram.rotationDeg, 45);
  assert.equal(restored!.pieces.parallelogram.flipped, true);
  assert.equal(restored!.pieces.parallelogram.x, 1.5);
  assert.equal(restored!.pieces.parallelogram.y, 0.5);

  assert.notEqual(TANGRAM_STORAGE_KEY_REAL, TANGRAM_STORAGE_KEY_DEMO);
  assert.equal(getTangramStorageKey(), TANGRAM_STORAGE_KEY_REAL);

  storage.setItem(TANGRAM_STORAGE_KEY_REAL, '{corrupt json!');
  assert.equal(loadTangramSession(storage), null);

  clearTangramSession(storage);
  assert.equal(storage.getItem(TANGRAM_STORAGE_KEY_REAL), null);
});

test('8. F02 EduGameSoundBank cues degrade safely when muted/headless and honor turn tokens', () => {
  const bank = new EduGameSoundBank();
  const token = 'f02_test_turn';
  bank.setActiveTurnToken(token);
  assert.doesNotThrow(() => {
    bank.playTangramPlacePiece(true, false, token);
    bank.playTangramPlacePiece(false, true, token);
    bank.playTangramRejectCue(false, token);
    bank.playTangramCompleteFanfare(false, token);
    bank.stopAll();
    bank.playTangramCompleteFanfare(false, 'stale_token');
    bank.dispose();
  });
});
