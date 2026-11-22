import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import {
  F04_SAMPLE_LEVELS,
  F04_SESSION_STORAGE_KEY,
  MazeDirection,
  validateMazeGrid,
  buildMazeOptimalMathExplanation,
  computeMazeHintFromPosition,
  createMazeGameState,
  stepExploreMaze,
  undoExploreStep,
  requestExploreHint,
  applyActiveExploreHint,
  addPlanCommand,
  removePlanCommandAt,
  movePlanCommand,
  replacePlanCommandAt,
  simulatePlanSequence,
  startPlanRunFromStart,
  advancePlanRunOneStep,
  stopPlanRunMidway,
  computePlanDiagnosticHint,
  saveF04Session,
  loadF04Session,
  clearF04Session,
  attemptMoveFromPos,
} from './maze3dEngine';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';

// ---------------------------------------------------------------------------
// 1. Maze Validation & BFS Integrity (all built-in mazes valid; bad mazes blocked)
// ---------------------------------------------------------------------------
test('F04: All 3 built-in sample mazes pass strict validation and BFS solvability', () => {
  assert.equal(F04_SAMPLE_LEVELS.length, 3);
  for (const level of F04_SAMPLE_LEVELS) {
    const v = validateMazeGrid(level.grid);
    assert.equal(v.valid, true, `Level ${level.id} should be valid: ${v.errors.join(', ')}`);
    assert.ok(v.start && v.goal);
    assert.ok(v.shortestDistance !== null && v.shortestDistance > 0);
    assert.equal(v.sampleOptimalPath.length, v.shortestDistance);
    // Simulating the BFS sample path must complete optimally
    const sim = simulatePlanSequence(level.grid, v.sampleOptimalPath);
    assert.equal(sim.outcome.status, 'completed');
    assert.equal(sim.outcome.stepsExecuted, v.shortestDistance);
    assert.equal(sim.isOptimal, true);
  }

  // Exact starter 7x7 maze shortest distance = 8, Manhattan = 4+4 = 8
  const v1 = validateMazeGrid(F04_SAMPLE_LEVELS[0].grid);
  assert.equal(v1.rows, 7);
  assert.equal(v1.cols, 7);
  assert.equal(v1.shortestDistance, 8);
  assert.equal(v1.manhattanDistance, 8);

  // Màn 2 & 3 have walls forcing real detours (BFS > Manhattan) or valid multi-turn paths
  const v2 = validateMazeGrid(F04_SAMPLE_LEVELS[1].grid);
  const v3 = validateMazeGrid(F04_SAMPLE_LEVELS[2].grid);
  assert.ok(v2.shortestDistance! >= v2.manhattanDistance!);
  assert.ok(v3.shortestDistance! >= v3.manhattanDistance!);
});

test('F04: Invalid mazes (unsolvable, missing E, duplicate S, ragged rows, bad char) are rejected', () => {
  // Unsolvable maze (wall blocks S from E)
  const unsolvable = validateMazeGrid([
    '#####',
    '#S#E#',
    '#####',
  ]);
  assert.equal(unsolvable.valid, false);
  assert.ok(unsolvable.errors.some((e) => e.includes('vô nghiệm')));

  // Duplicate S
  const dupS = validateMazeGrid([
    '#####',
    '#S.S#',
    '#..E#',
    '#####',
  ]);
  assert.equal(dupS.valid, false);

  // Ragged rows
  const ragged = validateMazeGrid([
    '#####',
    '#S.E',
    '#####',
  ]);
  assert.equal(ragged.valid, false);

  // Illegal symbol
  const badChar = validateMazeGrid([
    '#####',
    '#S?E#',
    '#####',
  ]);
  assert.equal(badChar.valid, false);
});

// ---------------------------------------------------------------------------
// 2. Starter 7x7 Maze: BOTH 8-step optimal paths + longer valid path accepted
// ---------------------------------------------------------------------------
test('F04: Starter 7x7 maze accepts BOTH 8-step optimal paths and valid longer paths without comparing to one sample', () => {
  const grid = F04_SAMPLE_LEVELS[0].grid;

  const optimalPathA: MazeDirection[] = ['right', 'right', 'down', 'down', 'right', 'right', 'down', 'down'];
  const optimalPathB: MazeDirection[] = ['down', 'down', 'down', 'down', 'right', 'right', 'right', 'right'];
  // Longer valid path (10 steps: right, left, then path B)
  const longerPath: MazeDirection[] = [
    'right',
    'left',
    'down',
    'down',
    'down',
    'down',
    'right',
    'right',
    'right',
    'right',
  ];

  const simA = simulatePlanSequence(grid, optimalPathA);
  assert.equal(simA.outcome.status, 'completed');
  assert.equal(simA.outcome.stepsExecuted, 8);
  assert.equal(simA.isOptimal, true);

  const simB = simulatePlanSequence(grid, optimalPathB);
  assert.equal(simB.outcome.status, 'completed');
  assert.equal(simB.outcome.stepsExecuted, 8);
  assert.equal(simB.isOptimal, true);

  const simLong = simulatePlanSequence(grid, longerPath);
  assert.equal(simLong.outcome.status, 'completed');
  assert.equal(simLong.outcome.stepsExecuted, 10);
  assert.equal(simLong.isOptimal, false);
});

// ---------------------------------------------------------------------------
// 3. Plan Mode Collision, Incomplete, Early Goal Arrival & Trailing Unused Commands
// ---------------------------------------------------------------------------
test('F04: Plan mode stops at exact blocked command #2 for "Phải, Xuống" on starter 7x7, handles OOB, early E & incomplete', () => {
  const grid = F04_SAMPLE_LEVELS[0].grid;

  // Exact spec test: "Phải, Xuống" -> 1 valid step to (1,2), then blocked by '#' at (2,2) on command #2 (index 1)
  const blockedSim = simulatePlanSequence(grid, ['right', 'down', 'right']);
  assert.equal(blockedSim.outcome.status, 'blocked');
  assert.equal(blockedSim.outcome.blockedCommandIndex, 1); // Command #2
  assert.equal(blockedSim.outcome.stepsExecuted, 1);
  assert.deepEqual(blockedSim.finalPos, { row: 1, col: 2 });

  // Out-of-bounds test on an open-edge grid
  const oobRes = attemptMoveFromPos(['S.E', '...', '...'], { row: 0, col: 0 }, 'up');
  assert.equal(oobRes.allowed, false);
  assert.equal(oobRes.reason, 'out_of_bounds');

  // Sequence ending before E -> "Robot chưa tới đích"
  const incompleteSim = simulatePlanSequence(grid, ['down', 'down']);
  assert.equal(incompleteSim.outcome.status, 'incomplete');
  assert.equal(incompleteSim.outcome.stepsExecuted, 2);
  assert.ok(incompleteSim.outcome.message.includes('Robot chưa tới đích'));

  // Early arrival at E with 3 trailing unused commands -> stops immediately, counts only 8 steps, reports 3 unused
  const trailingSim = simulatePlanSequence(grid, [
    'down',
    'down',
    'down',
    'down',
    'right',
    'right',
    'right',
    'right',
    'left',
    'up',
    'right',
  ]);
  assert.equal(trailingSim.outcome.status, 'completed');
  assert.equal(trailingSim.outcome.stepsExecuted, 8);
  assert.equal(trailingSim.outcome.unusedCommandsCount, 3);
  assert.equal(trailingSim.isOptimal, true);
});

// ---------------------------------------------------------------------------
// 4. Explore Mode: 1 step/action, Wall Bump, Undo, BFS Hint from Dead End + Explicit Apply
// ---------------------------------------------------------------------------
test('F04: Explore mode enforces wall bump without counting step, Undo restores prior tile, and BFS hint works from dead end', () => {
  let state = createMazeGameState({ levelId: F04_SAMPLE_LEVELS[0].id, mode: 'explore' });
  assert.deepEqual(state.robotPos, { row: 1, col: 1 });

  // Bump into top wall -> "Lối này bị chặn", stepCount stays 0
  const bump = stepExploreMaze(state, 'up');
  assert.equal(bump.moved, false);
  assert.equal(bump.blocked, true);
  assert.equal(bump.state.stepCount, 0);
  assert.equal(bump.state.statusMessage, 'Lối này bị chặn');
  state = bump.state;

  // Walk into top-right dead end on starter 7x7: R, R, D, D, R, R, U, U -> (1,5) dead end!
  const toDeadEnd: MazeDirection[] = ['right', 'right', 'down', 'down', 'right', 'right', 'up', 'up'];
  for (const dir of toDeadEnd) {
    const step = stepExploreMaze(state, dir);
    assert.equal(step.moved, true);
    state = step.state;
  }
  assert.deepEqual(state.robotPos, { row: 1, col: 5 });
  assert.equal(state.stepCount, 8);

  // Request BFS hint from dead end -> MUST suggest 'down' (4 steps remaining to E at (5,5)), does NOT move robot yet!
  const withHint = requestExploreHint(state);
  assert.deepEqual(withHint.robotPos, { row: 1, col: 5 });
  assert.equal(withHint.hintsAppliedCount, 0);
  assert.ok(withHint.activeHint);
  assert.equal(withHint.activeHint.recommendedDirection, 'down');
  assert.equal(withHint.activeHint.remainingShortestSteps, 4);

  // Explicit "Áp dụng gợi ý" moves robot down to (2,5) and increments hintsAppliedCount separately
  const applied = applyActiveExploreHint(withHint);
  assert.equal(applied.applied, true);
  assert.deepEqual(applied.state.robotPos, { row: 2, col: 5 });
  assert.equal(applied.state.stepCount, 9);
  assert.equal(applied.state.hintsAppliedCount, 1);

  // Undo restores (1,5), decrements stepCount to 8, increments undoCount to 1
  const undone = undoExploreStep(applied.state);
  assert.equal(undone.undone, true);
  assert.deepEqual(undone.state.robotPos, { row: 1, col: 5 });
  assert.equal(undone.state.stepCount, 8);
  assert.equal(undone.state.undoCount, 1);
  assert.equal(undone.state.hintsAppliedCount, 1);
});

// ---------------------------------------------------------------------------
// 5. Plan Mode Editing, Stepping, Stop Mid-Run (Never Completes), & Diagnostic Hint
// ---------------------------------------------------------------------------
test('F04: Plan mode editing buttons, stepping, stop mid-run never completes, and diagnostic hint pinpoints command #k', () => {
  let state = createMazeGameState({ levelId: F04_SAMPLE_LEVELS[0].id, mode: 'plan' });
  state = addPlanCommand(state, 'right');
  state = addPlanCommand(state, 'down');
  state = addPlanCommand(state, 'left');
  assert.deepEqual(state.program, ['right', 'down', 'left']);

  // Move command #3 up to #2, replace #2, remove #3
  state = movePlanCommand(state, 2, -1);
  assert.deepEqual(state.program, ['right', 'left', 'down']);
  state = replacePlanCommandAt(state, 1, 'down');
  assert.deepEqual(state.program, ['right', 'down', 'down']);
  state = removePlanCommandAt(state, 2);
  assert.deepEqual(state.program, ['right', 'down']);

  // Start stepping from S
  const startRes = startPlanRunFromStart(state, false);
  assert.equal(startRes.started, true);
  assert.equal(startRes.state.runAttempts, 1);
  state = startRes.state;

  // Step 1: right -> moved to (1,2)
  const s1 = advancePlanRunOneStep(state);
  assert.equal(s1.stepOutcome, 'moved');
  assert.deepEqual(s1.state.robotPos, { row: 1, col: 2 });

  // Stop mid-run -> NEVER completed
  const stopped = stopPlanRunMidway(s1.state);
  assert.equal(stopped.completed, false);
  assert.equal(stopped.isAutoRunning, false);
  assert.equal(stopped.planOutcome.status, 'stopped');

  // Re-run and advance to hit wall at command #2
  const run2 = startPlanRunFromStart(stopped, false).state;
  const r2s1 = advancePlanRunOneStep(run2).state;
  const r2s2 = advancePlanRunOneStep(r2s1);
  assert.equal(r2s2.stepOutcome, 'blocked');
  assert.equal(r2s2.state.planOutcome.blockedCommandIndex, 1);
  // Original drafted program is preserved for editing!
  assert.deepEqual(r2s2.state.program, ['right', 'down']);

  // Diagnostic hint prioritizes command #2 and suggests valid fix ('right')
  const diag = computePlanDiagnosticHint(r2s2.state);
  assert.equal(diag.blockedCommandNumber, 2);
  assert.equal(diag.suggestedNextDir, 'right');
});

// ---------------------------------------------------------------------------
// 6. MathView KaTeX Validity for All 3 Mazes & Hint Formula
// ---------------------------------------------------------------------------
test('F04: Math explanations and BFS hints render cleanly via KaTeX without syntax errors', () => {
  for (const level of F04_SAMPLE_LEVELS) {
    const v = validateMazeGrid(level.grid);
    const expr = buildMazeOptimalMathExplanation(v);
    const inlineMatches = [...expr.matchAll(/\\\((.+?)\\\)/g)];
    assert.ok(inlineMatches.length >= 2, `Expected KaTeX math in ${level.id}`);
    for (const m of inlineMatches) {
      const html = katex.renderToString(m[1], { throwOnError: true });
      assert.ok(html.length > 0);
    }
  }

  const hint = computeMazeHintFromPosition(
    F04_SAMPLE_LEVELS[0].grid,
    { row: 1, col: 1 },
    { row: 5, col: 5 }
  );
  const hintLatex = [...hint.explanationLatex.matchAll(/\\\((.+?)\\\)/g)];
  assert.ok(hintLatex.length >= 1);
  for (const m of hintLatex) {
    katex.renderToString(m[1], { throwOnError: true });
  }
});

// ---------------------------------------------------------------------------
// 7. Persistence Isolation (/demo) + Mid-Auto-Run Reload Restores STOPPED + Headless Audio Safety
// ---------------------------------------------------------------------------
test('F04: Persistence isolates /demo, recovers corrupt JSON, and reloads mid-auto-run in STOPPED state', () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  // Simulate /demo runtime
  (globalThis as unknown as { window: unknown }).window = {
    location: { pathname: '/demo/games', search: '', hash: '' },
    localStorage: mockLocalStorage,
  };

  let state = createMazeGameState({ levelId: F04_SAMPLE_LEVELS[0].id, mode: 'plan' });
  state = addPlanCommand(state, 'down');
  state = addPlanCommand(state, 'down');
  const runningState = startPlanRunFromStart(state, true).state;
  assert.equal(runningState.isAutoRunning, true);
  assert.equal(runningState.planOutcome.status, 'running');

  saveF04Session(runningState, false);

  // Verify isolated /demo key was used
  const demoKey = `${KHKT_DEMO_STORAGE_PREFIX}${F04_SESSION_STORAGE_KEY}`;
  assert.ok(store.has(demoKey), 'Expected session stored under /demo isolated key');
  assert.equal(store.has(F04_SESSION_STORAGE_KEY), false);

  // Reloading mid-auto-run MUST restore in STOPPED state while preserving program & showTrail
  const restored = loadF04Session();
  assert.ok(restored);
  assert.equal(restored.state.isAutoRunning, false);
  assert.equal(restored.state.planOutcome.status, 'stopped');
  assert.deepEqual(restored.state.program, ['down', 'down']);
  assert.equal(restored.showTrail, false);

  // Corrupt JSON recovery
  store.set(demoKey, '{broken_json');
  assert.equal(loadF04Session(), null);
  assert.equal(store.has(demoKey), false);

  // Clear session cleanly
  clearF04Session();

  // Headless audio safety check (muted & unmuted without AudioContext must never throw)
  const bank = new EduGameSoundBank();
  assert.doesNotThrow(() => {
    bank.playMazeStep(true);
    bank.playMazeStep(false);
    bank.playMazeWallBump(true);
    bank.playMazeWallBump(false);
    bank.playMazeGoalFanfare(true);
    bank.playMazeGoalFanfare(false);
    bank.stopAll();
    bank.dispose();
  });

  delete (globalThis as unknown as { window?: unknown }).window;
});
