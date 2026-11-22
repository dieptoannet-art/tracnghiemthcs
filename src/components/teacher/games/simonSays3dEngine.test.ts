import test from 'node:test';
import assert from 'node:assert/strict';
import {
  E04_GESTURES,
  E04_MATH_TRUE_DO_ITEMS,
  E04_POINTS_CORRECT,
  E04_SAMPLE_BADGE,
  E04_SESSION_STORAGE_KEY,
  E04_SIMON_SCORED_TEMPLATE,
  E04_SIMON_WARMUP_TURNS,
  advanceSimonTurn,
  buildSimonCommandDisplayText,
  buildSimonCommandSpeechText,
  clearE04Session,
  commitSimonTurn,
  computeSimonStandings,
  createDefaultSimonSaysConfig,
  createInitialSimonSaysState,
  createSimonTeams,
  editLastSimonTurn,
  getE04SessionStorageKey,
  getExpectedDecisionForTurn,
  loadE04Session,
  resolveSimonInstructorPoseForPhase,
  saveE04Session,
  validateSimonSetupConfig,
} from './simonSays3dEngine';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    get length() {
      return map.size;
    },
  };
}

// ============================================================================
// 1. MODE 1: "SIMON BẢO" STRUCTURE, SINGLE SOURCE OF TRUTH & VERBATIM SPEECH
// ============================================================================

test('E04 Mode 1 (Simon bảo) builds 2 non-scored warm-ups + 8 scored turns (4 Simon, 4 direct)', () => {
  const cfg = createDefaultSimonSaysConfig('simon_says');
  assert.equal(cfg.includeWarmupInSimonMode, true);
  assert.equal(E04_GESTURES.length, 4);

  const state = createInitialSimonSaysState({ config: cfg, rng: createSeededRng(2027) });
  assert.equal(state.turns.length, 10);

  const warmups = state.turns.filter((t) => t.isWarmup);
  const scored = state.turns.filter((t) => !t.isWarmup);
  assert.equal(warmups.length, 2);
  assert.equal(scored.length, 8);

  // Warm-ups: 1 with "Simon bảo:" -> execute, 1 direct -> hold
  assert.equal(warmups[0].hasSimonPrefix, true);
  assert.equal(getExpectedDecisionForTurn(warmups[0]), 'execute');
  assert.equal(warmups[1].hasSimonPrefix, false);
  assert.equal(getExpectedDecisionForTurn(warmups[1]), 'hold');

  // Scored: strictly 4 with "Simon bảo:" and 4 direct
  const withPrefix = scored.filter((t) => t.hasSimonPrefix === true);
  const direct = scored.filter((t) => t.hasSimonPrefix === false);
  assert.equal(withPrefix.length, 4);
  assert.equal(direct.length, 4);

  // Verify shuffling actually varies order across seeds while preserving exact 4/4 counts
  const state2 = createInitialSimonSaysState({ config: cfg, rng: createSeededRng(9911) });
  const ids1 = state.turns.slice(2).map((t) => t.id).join(',');
  const ids2 = state2.turns.slice(2).map((t) => t.id).join(',');
  assert.notEqual(ids1, ids2);
});

test('E04 Single-source-of-truth: display text, verbatim speech, and expected decision never diverge', () => {
  const withSimon = E04_SIMON_SCORED_TEMPLATE.find(
    (t) => t.gestureId === 'raise_one_hand' && t.hasSimonPrefix === true
  )!;
  const withoutSimon = E04_SIMON_SCORED_TEMPLATE.find(
    (t) => t.gestureId === 'raise_one_hand' && t.hasSimonPrefix === false
  )!;

  assert.equal(buildSimonCommandDisplayText(withSimon), 'Simon bảo: Giơ một tay.');
  assert.equal(buildSimonCommandSpeechText(withSimon), 'Simon bảo: Giơ một tay.');
  assert.equal(getExpectedDecisionForTurn(withSimon), 'execute');

  // Direct command MUST NOT contain "Simon bảo" in display OR voice text!
  assert.equal(buildSimonCommandDisplayText(withoutSimon), 'Giơ một tay.');
  assert.equal(buildSimonCommandSpeechText(withoutSimon), 'Giơ một tay.');
  assert.equal(buildSimonCommandSpeechText(withoutSimon).includes('Simon'), false);
  assert.equal(getExpectedDecisionForTurn(withoutSimon), 'hold');

  // Verify across ALL 10 Simon turns (2 warmup + 8 scored)
  for (const t of [...E04_SIMON_WARMUP_TURNS, ...E04_SIMON_SCORED_TEMPLATE]) {
    const display = buildSimonCommandDisplayText(t);
    const speech = buildSimonCommandSpeechText(t);
    assert.equal(speech, display);
    if (t.hasSimonPrefix) {
      assert.ok(display.startsWith('Simon bảo: '));
      assert.equal(getExpectedDecisionForTurn(t), 'execute');
    } else {
      assert.equal(display.includes('Simon bảo'), false);
      assert.equal(speech.includes('Simon bảo'), false);
      assert.equal(getExpectedDecisionForTurn(t), 'hold');
    }
  }
});

// ============================================================================
// 2. MODE 2: "ĐÚNG THÌ LÀM – TOÁN THCS" SAMPLE PACK & KATEX RENDERING
// ============================================================================

test('E04 Mode 2 (Đúng thì làm – Toán THCS) has exact 8 sample turns (4 True, 4 False) and valid KaTeX', () => {
  assert.equal(E04_MATH_TRUE_DO_ITEMS.length, 8);
  const trues = E04_MATH_TRUE_DO_ITEMS.filter((i) => i.isStatementTrue === true);
  const falses = E04_MATH_TRUE_DO_ITEMS.filter((i) => i.isStatementTrue === false);
  assert.equal(trues.length, 4);
  assert.equal(falses.length, 4);

  E04_MATH_TRUE_DO_ITEMS.forEach((item) => {
    assert.equal(item.sourceBadge, E04_SAMPLE_BADGE);
    assert.equal(
      getExpectedDecisionForTurn(item),
      item.isStatementTrue ? 'execute' : 'hold'
    );

    const renderedStmt = renderMathToHtml(item.statementLatex || '');
    assert.ok(renderedStmt.length > 0);
    assert.equal(renderedStmt.includes('katex-error'), false, `KaTeX error in ${item.code} statement`);

    const renderedExp = renderMathToHtml(item.explanation);
    assert.ok(renderedExp.length > 0);
    assert.equal(renderedExp.includes('katex-error'), false, `KaTeX error in ${item.code} explanation`);
  });

  // Malformed LaTeX does not crash and falls back safely
  const malformed = renderMathToHtml('\\(\\frac{1}{2\\)');
  assert.equal(typeof malformed, 'string');
  assert.ok(malformed.length > 0);
});

// ============================================================================
// 3. STRICT ANTI-SPOILER INSTRUCTOR POSE RESOLVER
// ============================================================================

test('E04 Anti-spoiler pose resolver keeps instructor ready_wait before reveal and on Hold turns', () => {
  const execTurn = E04_SIMON_SCORED_TEMPLATE.find((t) => t.hasSimonPrefix === true)!;
  const holdTurn = E04_SIMON_SCORED_TEMPLATE.find((t) => t.hasSimonPrefix === false)!;

  // Before reveal: ALWAYS ready_wait
  assert.equal(
    resolveSimonInstructorPoseForPhase({ phase: 'thinking', turn: execTurn }),
    'ready_wait'
  );
  assert.equal(
    resolveSimonInstructorPoseForPhase({ phase: 'signal_collect', turn: execTurn }),
    'ready_wait'
  );
  assert.equal(
    resolveSimonInstructorPoseForPhase({ phase: 'thinking', turn: holdTurn }),
    'ready_wait'
  );
  assert.equal(
    resolveSimonInstructorPoseForPhase({ phase: 'signal_collect', turn: holdTurn }),
    'ready_wait'
  );

  // On reveal: ONLY demonstrates gesture if expected === 'execute'
  assert.equal(
    resolveSimonInstructorPoseForPhase({ phase: 'revealed', turn: execTurn }),
    execTurn.gestureId
  );
  assert.equal(
    resolveSimonInstructorPoseForPhase({ phase: 'revealed', turn: holdTurn }),
    'ready_wait'
  );
});

// ============================================================================
// 4. SOLO PRACTICE & WHOLE-CLASS FLOW
// ============================================================================

test('E04 Solo Practice awards 0 on warm-ups and +10/0 across 8 scored turns', () => {
  const cfg = {
    ...createDefaultSimonSaysConfig('simon_says'),
    participantMode: 'solo_practice' as const,
  };
  let state = createInitialSimonSaysState({ config: cfg, rng: createSeededRng(77) });

  // Complete 2 warm-ups correctly -> still 0 points
  for (let i = 0; i < 2; i++) {
    const turn = state.turns[state.currentTurnIndex];
    assert.equal(turn.isWarmup, true);
    const res = commitSimonTurn(state, {
      turn,
      soloChoice: getExpectedDecisionForTurn(turn),
    });
    assert.equal(res.committed, true);
    assert.equal(res.record?.pointsDeltaByParticipant.solo_1, 0);
    state = advanceSimonTurn(res.state);
  }
  assert.equal(computeSimonStandings(state)[0].points, 0);

  // Complete 8 scored turns: get 6 right, 2 wrong -> 60 points
  for (let i = 0; i < 8; i++) {
    const turn = state.turns[state.currentTurnIndex];
    assert.equal(turn.isWarmup, false);
    const expected = getExpectedDecisionForTurn(turn);
    const choice = i < 6 ? expected : expected === 'execute' ? 'hold' : 'execute';
    const res = commitSimonTurn(state, { turn, soloChoice: choice });
    assert.equal(res.committed, true);
    state = res.state.status === 'playing' ? advanceSimonTurn(res.state) : res.state;
  }

  assert.equal(state.status, 'finished');
  const standings = computeSimonStandings(state);
  assert.equal(standings.length, 1);
  assert.equal(standings[0].points, 6 * E04_POINTS_CORRECT);
  assert.equal(standings[0].correctCount, 6);
  assert.equal(standings[0].incorrectCount, 2);
});

test('E04 Whole-Class (1–50 HS) completes session cleanly without fabricating scores', () => {
  const cfg = {
    ...createDefaultSimonSaysConfig('math_true_do'),
    participantMode: 'whole_class' as const,
  };
  let state = createInitialSimonSaysState({ config: cfg });
  assert.equal(state.turns.length, 8);

  for (let i = 0; i < 8; i++) {
    const turn = state.turns[state.currentTurnIndex];
    const res = commitSimonTurn(state, { turn });
    assert.equal(res.committed, true);
    assert.equal(res.record?.resultMode, 'non_scored_class');
    state = res.state.status === 'playing' ? advanceSimonTurn(res.state) : res.state;
  }

  assert.equal(state.status, 'finished');
  assert.equal(state.history.length, 8);
  assert.deepEqual(computeSimonStandings(state), []);
});

// ============================================================================
// 5. TEAMS MODE: UNRECORDED GUARD, HOLD VS NO_ANSWER, DOUBLE-CLICK, EDIT, TIES
// ============================================================================

test('E04 Teams mode strictly rejects unrecorded teams, distinguishes Hold vs No Answer, prevents double-click, supports edit-last-turn and Đồng hạng ties', () => {
  const cfg = {
    ...createDefaultSimonSaysConfig('math_true_do'),
    participantMode: 'teams' as const,
    teams: createSimonTeams(3, ['Đội A', 'Đội B', 'Đội C']),
  };
  assert.equal(validateSimonSetupConfig(cfg).valid, true);

  let state = createInitialSimonSaysState({ config: cfg });
  // Turn 0 (MT-01): True -> expected 'execute'
  const turn0 = state.turns[0];
  assert.equal(getExpectedDecisionForTurn(turn0), 'execute');

  // Rejects if any team is still 'unrecorded' (NEVER infers 'hold'!)
  const blocked = commitSimonTurn(state, {
    turn: turn0,
    teamChoices: {
      steam_1: 'execute',
      steam_2: 'unrecorded',
      steam_3: 'hold',
    },
  });
  assert.equal(blocked.committed, false);
  assert.equal(blocked.reason, 'unrecorded_team');

  // Commit Turn 0 cleanly
  const c0 = commitSimonTurn(state, {
    turn: turn0,
    teamChoices: {
      steam_1: 'execute', // +10
      steam_2: 'hold', // 0
      steam_3: 'no_answer', // 0
    },
  });
  assert.equal(c0.committed, true);
  state = c0.state;

  // Duplicate commit of same turnId (double-click) MUST be rejected
  const dup = commitSimonTurn(state, {
    turn: turn0,
    teamChoices: {
      steam_1: 'execute',
      steam_2: 'execute',
      steam_3: 'execute',
    },
  });
  assert.equal(dup.committed, false);
  assert.equal(dup.reason, 'duplicate_turn_commit');
  assert.equal(state.history.length, 1);

  // Edit last turn before moving on: change Đội B to 'execute' (+10) -> A & B tie at 10
  const edited = editLastSimonTurn(state, {
    steam_1: 'execute',
    steam_2: 'execute',
    steam_3: 'no_answer',
  });
  assert.equal(edited.edited, true);
  state = edited.state;

  const afterEdit = computeSimonStandings(state);
  assert.equal(afterEdit[0].points, 10);
  assert.equal(afterEdit[1].points, 10);
  assert.equal(afterEdit[0].rank, 1);
  assert.equal(afterEdit[1].rank, 1);
  assert.equal(afterEdit[0].isTied, true);
  assert.equal(afterEdit[1].isTied, true);
  assert.equal(afterEdit[2].rank, 3);
  assert.equal(afterEdit[2].points, 0);

  // Advance to Turn 1 (MT-02): False -> expected 'hold'
  state = advanceSimonTurn(state);
  const turn1 = state.turns[state.currentTurnIndex];
  assert.equal(getExpectedDecisionForTurn(turn1), 'hold');

  // Prove 'hold' (+10) is strictly different from 'no_answer' (0)!
  const c1 = commitSimonTurn(state, {
    turn: turn1,
    teamChoices: {
      steam_1: 'hold', // +10 -> 20
      steam_2: 'no_answer', // 0 -> 10 (NOT treated as hold!)
      steam_3: 'hold', // +10 -> 10
    },
  });
  assert.equal(c1.committed, true);
  state = c1.state;

  const standings2 = computeSimonStandings(state);
  assert.equal(standings2[0].id, 'steam_1');
  assert.equal(standings2[0].points, 20);
  assert.equal(standings2[0].rank, 1);
  assert.equal(standings2[0].isTied, false);

  // steam_2 and steam_3 tied at 10 -> Đồng hạng rank 2
  assert.equal(standings2[1].points, 10);
  assert.equal(standings2[2].points, 10);
  assert.equal(standings2[1].rank, 2);
  assert.equal(standings2[2].rank, 2);
  assert.equal(standings2[1].isTied, true);
  assert.equal(standings2[2].isTied, true);
  // No team eliminated
  assert.equal(standings2.length, 3);
});

// ============================================================================
// 6. PERSISTENCE, /DEMO ISOLATION & CORRUPT STORAGE AUTO-RECOVERY
// ============================================================================

test('E04 Persistence isolates /demo storage keys and recovers safely from corrupt JSON', () => {
  const storage = createMemoryStorage();
  const prevWindow = (globalThis as any).window;

  try {
    // Normal route
    (globalThis as any).window = {
      location: { pathname: '/' },
      localStorage: storage,
    };
    assert.equal(getE04SessionStorageKey(), E04_SESSION_STORAGE_KEY);

    const cfg = createDefaultSimonSaysConfig('simon_says');
    const st = createInitialSimonSaysState({ config: cfg, rng: createSeededRng(101) });
    saveE04Session(st);

    const loadedNormal = loadE04Session();
    assert.equal(loadedNormal.recoveredFromCorruption, false);
    assert.equal(loadedNormal.state?.turns.length, 10);

    // Switch to /demo route -> completely isolated key
    (globalThis as any).window = {
      location: { pathname: '/demo' },
      localStorage: storage,
    };
    assert.equal(
      getE04SessionStorageKey(),
      `${KHKT_DEMO_STORAGE_PREFIX}${E04_SESSION_STORAGE_KEY}`
    );
    assert.equal(loadE04Session().state, null);

    // Corrupt JSON on /demo -> clears and returns recoveredFromCorruption: true
    storage.setItem(getE04SessionStorageKey(), '{corrupt-json');
    const recovered = loadE04Session();
    assert.equal(recovered.state, null);
    assert.equal(recovered.recoveredFromCorruption, true);
    assert.equal(storage.getItem(getE04SessionStorageKey()), null);

    // Normal storage remains intact
    (globalThis as any).window = {
      location: { pathname: '/' },
      localStorage: storage,
    };
    assert.equal(loadE04Session().state?.turns.length, 10);
    clearE04Session();
    assert.equal(loadE04Session().state, null);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = prevWindow;
    }
  }
});

// ============================================================================
// 7. E04 AUDIO CUES IN HEADLESS/MUTED ENVIRONMENT
// ============================================================================

test('E04 EduGameSoundBank cues execute safely when muted or headless and respect stopAll', () => {
  const bank = new EduGameSoundBank();
  const token = 'e04_turn_1';
  bank.setActiveTurnToken(token);

  assert.doesNotThrow(() => {
    bank.playSimonSignalCue(true, token);
    bank.playSimonSignalCue(false, token);
    bank.playSimonFeedbackCue(true, true, token);
    bank.playSimonFeedbackCue(false, false, token);
    bank.playSimonSessionSummary(true, token);
    bank.playSimonSessionSummary(false, token);
    bank.stopAll();
    // Stale token after token switch / stopAll should remain a safe no-op
    bank.setActiveTurnToken('e04_turn_2');
    bank.playSimonSignalCue(false, token);
    bank.dispose();
  });
});
