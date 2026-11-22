import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HanoiPegId,
  createInitialHanoiState,
  getHanoiMinMoves,
  isDiscLiftable,
  isHanoiCompleted,
  validateHanoiMove,
  applyHanoiMove,
  undoHanoiMove,
  computeOptimalHintFromState,
  generateCanonicalSolutionSteps,
  buildCanonicalPreviewPegsAtStep,
  buildHanoiCompletionSummary,
  saveF03Session,
  loadF03Session,
  clearF03Session,
  getF03StorageKey,
} from './hanoiTower3dEngine';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('F03 — Tháp Hà Nội 3D Engine, BFS Optimal Solver & Acceptance Suite', () => {
  it('1. Exact 3-disc canonical walkthrough (A->C, A->B, C->B, A->C, B->A, B->C, A->C), completion ONCE at 7/7, and hint after step 1 is A->B with 6 remaining', () => {
    let state = createInitialHanoiState({ mode: 'guided', discCount: 3 });
    assert.deepEqual(state.pegs, { A: [3, 2, 1], B: [], C: [] });
    assert.equal(getHanoiMinMoves(3), 7);

    const sequence: Array<[HanoiPegId, HanoiPegId]> = [
      ['A', 'C'],
      ['A', 'B'],
      ['C', 'B'],
      ['A', 'C'],
      ['B', 'A'],
      ['B', 'C'],
      ['A', 'C'],
    ];

    let completionEvents = 0;

    sequence.forEach(([from, to], idx) => {
      const res = applyHanoiMove(state, from, to);
      assert.equal(res.moved, true, `Step ${idx + 1} (${from}->${to}) must succeed`);
      state = res.nextState;
      if (res.justCompleted) completionEvents += 1;

      if (idx === 0) {
        // After step 1 (A -> C), optimal hint MUST be A -> B with 6 steps remaining!
        const hint = computeOptimalHintFromState(state.pegs, state.discCount);
        assert.equal(hint.status, 'found');
        assert.equal(hint.isProvenOptimal, true);
        assert.equal(hint.label, 'Tối ưu từ vị trí hiện tại');
        assert.deepEqual(hint.move, { from: 'A', to: 'B', disc: 2 });
        assert.equal(hint.remainingOptimalMoves, 6);
      }

      if (idx < 6) {
        assert.equal(state.isCompleted, false);
        assert.equal(completionEvents, 0);
      }
    });

    assert.equal(state.isCompleted, true);
    assert.equal(completionEvents, 1, 'Completion event must fire strictly ONCE');
    assert.deepEqual(state.pegs, { A: [], B: [], C: [3, 2, 1] });
    assert.equal(state.moveCount, 7);

    const summary = buildHanoiCompletionSummary(state);
    assert.equal(summary.actualMoves, 7);
    assert.equal(summary.minMoves, 7);
    assert.equal(summary.deltaMoves, 0);
    assert.equal(summary.isOptimalCount, true);
    assert.equal(summary.headline, 'Lời giải ít bước nhất');
    assert.equal(summary.supportNote, null);

    // Further moves after completion must be blocked without firing completion again
    const extra = applyHanoiMove(state, 'C', 'A');
    assert.equal(extra.moved, false);
    assert.equal(extra.justCompleted, false);
  });

  it('2. Rule enforcement: buried discs cannot be lifted, larger-on-smaller rejected without changing board or moveCount', () => {
    let state = createInitialHanoiState({ mode: 'challenge', discCount: 4 });
    // Initially A has [4, 3, 2, 1] -> only disc 1 is liftable; 2, 3, 4 are buried
    assert.equal(isDiscLiftable(state.pegs, 1), true);
    assert.equal(isDiscLiftable(state.pegs, 2), false);
    assert.equal(isDiscLiftable(state.pegs, 3), false);
    assert.equal(isDiscLiftable(state.pegs, 4), false);

    // Move disc 1: A -> C
    state = applyHanoiMove(state, 'A', 'C').nextState;
    assert.equal(state.moveCount, 1);

    // Attempt illegal move: disc 2 (A) onto disc 1 (C) -> MUST reject & keep state + moveCount untouched
    const illegal = applyHanoiMove(state, 'A', 'C');
    assert.equal(illegal.moved, false);
    assert.ok(illegal.errorReason?.includes('Không hợp lệ'));
    assert.equal(illegal.nextState.moveCount, 1);
    assert.deepEqual(illegal.nextState.pegs, { A: [4, 3, 2], B: [], C: [1] });

    // Empty peg source rejected
    const emptySrc = validateHanoiMove(state.pegs, 'B', 'C');
    assert.equal(emptySrc.valid, false);

    // Same peg rejected
    const samePeg = validateHanoiMove(state.pegs, 'A', 'A');
    assert.equal(samePeg.valid, false);
  });

  it('3. Deviation from canonical solution: BFS computes exact shortest valid path from arbitrary mid-game state to C', () => {
    // Deviate intentionally on 3-disc puzzle: move 1 = A -> B (suboptimal start!)
    let state = createInitialHanoiState({ mode: 'challenge', discCount: 3 });
    state = applyHanoiMove(state, 'A', 'B').nextState;
    // Further deviate: move 2 = A -> C (disc 2 onto C), move 3 = B -> C (disc 1 onto C)
    state = applyHanoiMove(state, 'A', 'C').nextState;
    state = applyHanoiMove(state, 'B', 'C').nextState;
    assert.deepEqual(state.pegs, { A: [3], B: [], C: [2, 1] });

    const initialHint = computeOptimalHintFromState(state.pegs, state.discCount);
    assert.equal(initialHint.status, 'found');
    assert.equal(initialHint.isProvenOptimal, true);
    assert.ok(initialHint.move !== null);
    assert.ok((initialHint.remainingOptimalMoves ?? 0) > 0);

    // Follow BFS hints step-by-step and verify every step is legal and reaches C in EXACT remainingOptimalMoves!
    const expectedRemaining = initialHint.remainingOptimalMoves!;
    let stepsTaken = 0;
    while (!state.isCompleted && stepsTaken < 20) {
      const h = computeOptimalHintFromState(state.pegs, state.discCount);
      assert.equal(h.status, 'found');
      assert.equal(h.isProvenOptimal, true);
      assert.equal(h.remainingOptimalMoves, expectedRemaining - stepsTaken);
      const res = applyHanoiMove(state, h.move!.from, h.move!.to, { appliedViaHint: true });
      assert.equal(res.moved, true);
      state = res.nextState;
      stepsTaken += 1;
    }

    assert.equal(state.isCompleted, true);
    assert.equal(stepsTaken, expectedRemaining);
    assert.equal(state.hintsAppliedCount, expectedRemaining);

    // Budget exceeded guard never falsely claims optimal
    const budgeted = computeOptimalHintFromState({ A: [3, 2, 1], B: [], C: [] }, 3, {
      maxExploredStates: 2,
    });
    assert.equal(budgeted.status, 'budget_exceeded');
    assert.equal(budgeted.isProvenOptimal, false);
  });

  it('4. 8-disc support: T(8)=255, canonical solution solves 8 discs cleanly, and BFS solves mid-game 8-disc state rapidly', () => {
    assert.equal(getHanoiMinMoves(4), 15);
    assert.equal(getHanoiMinMoves(5), 31);
    assert.equal(getHanoiMinMoves(8), 255);

    const steps8 = generateCanonicalSolutionSteps(8);
    assert.equal(steps8.length, 255);
    const finalPreview = buildCanonicalPreviewPegsAtStep(8, steps8, 255);
    assert.equal(isHanoiCompleted(finalPreview, 8), true);

    // Take an arbitrary mid-game 8-disc position (after 100 canonical moves + 1 deviation)
    const midPegs = buildCanonicalPreviewPegsAtStep(8, steps8, 100);
    const t0 = performance.now();
    const hint8 = computeOptimalHintFromState(midPegs, 8);
    const elapsedMs = performance.now() - t0;

    assert.equal(hint8.status, 'found');
    assert.equal(hint8.isProvenOptimal, true);
    assert.equal(hint8.remainingOptimalMoves, 155);
    assert.ok(hint8.move !== null);
    assert.ok(elapsedMs < 250, `8-disc BFS took ${elapsedMs.toFixed(1)}ms, expected responsive < 250ms`);
  });

  it('5. Undo restores exact prior board & decrements moveCount while tracking undoCount & hintsAppliedCount separately', () => {
    let state = createInitialHanoiState({ mode: 'challenge', discCount: 3 });
    const h1 = computeOptimalHintFromState(state.pegs, 3);
    state = applyHanoiMove(state, h1.move!.from, h1.move!.to, { appliedViaHint: true }).nextState;
    assert.equal(state.moveCount, 1);
    assert.equal(state.hintsAppliedCount, 1);
    assert.equal(state.undoCount, 0);

    // Make a second move then undo it
    state = applyHanoiMove(state, 'A', 'B').nextState;
    assert.equal(state.moveCount, 2);
    const u = undoHanoiMove(state);
    assert.equal(u.undone, true);
    state = u.nextState;
    assert.equal(state.moveCount, 1);
    assert.equal(state.undoCount, 1);
    assert.equal(state.hintsAppliedCount, 1);
    assert.deepEqual(state.pegs, { A: [3, 2], B: [], C: [1] });

    // Finish optimally from here (6 more moves -> total 7 moves, with support!)
    const rest: Array<[HanoiPegId, HanoiPegId]> = [
      ['A', 'B'],
      ['C', 'B'],
      ['A', 'C'],
      ['B', 'A'],
      ['B', 'C'],
      ['A', 'C'],
    ];
    for (const [f, t] of rest) {
      state = applyHanoiMove(state, f, t).nextState;
    }
    const summary = buildHanoiCompletionSummary(state);
    assert.equal(summary.headline, 'Lời giải ít bước nhất');
    assert.ok(summary.supportNote?.includes('1 gợi ý đã áp dụng'));
    assert.ok(summary.supportNote?.includes('1 lần hoàn tác'));
  });

  it('6. Classroom mode (2–6 rotating groups, 1–50 HS shared board) & MathView formulas + malformed fallback', () => {
    let state = createInitialHanoiState({ mode: 'classroom', discCount: 3, groupsCount: 4 });
    assert.equal(state.activeGroupIndex, 0);
    const m1 = applyHanoiMove(state, 'A', 'C');
    assert.equal(m1.moveRecord?.proposedByGroup, 'Nhóm 1');
    assert.equal(m1.nextState.activeGroupIndex, 1);

    const m2 = applyHanoiMove(m1.nextState, 'A', 'B');
    assert.equal(m2.moveRecord?.proposedByGroup, 'Nhóm 2');
    assert.equal(m2.nextState.activeGroupIndex, 2);

    // Undo rotates active group back cleanly
    const u = undoHanoiMove(m2.nextState);
    assert.equal(u.nextState.activeGroupIndex, 1);

    // Shared MathView renders T(n)=2^n-1 and T(n)=2T(n-1)+1 cleanly + raw fallback for broken LaTeX
    const f1 = renderMathToHtml('Công thức \\(T(n)=2^n-1\\) và \\(T(n)=2T(n-1)+1\\)');
    assert.ok(f1.includes('katex'));
    const broken = renderMathToHtml('Thử lỗi \\(\\frac{1}{\\) bàn chơi vẫn hoạt động');
    assert.ok(broken.includes('\\frac{1}{'));
    assert.ok(broken.includes('bàn chơi vẫn hoạt động'));
  });

  it('7. Persistence restores discCount, pegs, history, counters & support counts, isolates /demo, and heals corrupt JSON', () => {
    const storage = createMemoryStorage();
    let state = createInitialHanoiState({ mode: 'challenge', discCount: 5 });
    state = applyHanoiMove(state, 'A', 'C', { appliedViaHint: true }).nextState;
    state = applyHanoiMove(state, 'A', 'B').nextState;
    state = undoHanoiMove(state).nextState;

    saveF03Session(state, storage, false);
    const demoState = createInitialHanoiState({ mode: 'guided', discCount: 3 });
    saveF03Session(demoState, storage, true);

    assert.notEqual(getF03StorageKey(false), getF03StorageKey(true));

    const loadedProd = loadF03Session(storage, false);
    assert.ok(loadedProd);
    assert.equal(loadedProd.discCount, 5);
    assert.equal(loadedProd.moveCount, 1);
    assert.equal(loadedProd.undoCount, 1);
    assert.equal(loadedProd.hintsAppliedCount, 1);
    assert.deepEqual(loadedProd.pegs, { A: [5, 4, 3, 2], B: [], C: [1] });

    const loadedDemo = loadF03Session(storage, true);
    assert.equal(loadedDemo?.discCount, 3);
    assert.equal(loadedDemo?.moveCount, 0);

    // Corrupt JSON self-heals
    storage.setItem(getF03StorageKey(true), '{invalid-json');
    assert.equal(loadF03Session(storage, true), null);
    assert.equal(storage.getItem(getF03StorageKey(true)), null);

    clearF03Session(storage, false);
    assert.equal(loadF03Session(storage, false), null);
  });

  it('8. F03 EduGameSoundBank cues degrade safely when muted/headless and honor turn tokens', () => {
    const bank = new EduGameSoundBank();
    bank.setActiveTurnToken('f03_t1');
    assert.doesNotThrow(() => {
      bank.playHanoiLiftDisc(false, 'f03_t1');
      bank.playHanoiPlaceDisc(false, 3, 'f03_t1');
      bank.playHanoiInvalidMove(false, 'f03_t1');
      bank.playHanoiCompleteFanfare(false, 'f03_t1');
      // Muted & stale token calls
      bank.playHanoiPlaceDisc(true, 1, 'f03_t1');
      bank.playHanoiCompleteFanfare(false, 'f03_stale');
      bank.stopAll();
      bank.dispose();
    });
  });
});
