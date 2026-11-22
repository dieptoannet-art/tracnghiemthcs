import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import {
  F05_SAMPLE_CHALLENGES,
  F05_SESSION_STORAGE_KEY,
  LOGIC_SAMPLE_PREDICATES,
  caesarShiftChar,
  caesarEncode,
  caesarDecode,
  verifyFourDigitLogicClues,
  validateAndNormalizeCodeInput,
  createCipherGameState,
  submitCipherAttempt,
  revealNextCipherHint,
  revealCipherSolution,
  evaluateSimultaneousGroups,
  computeCipherSummary,
  saveF05Session,
  loadF05Session,
  clearF05Session,
} from './cipher3dEngine';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';

// ---------------------------------------------------------------------------
// 1. Challenge A ("Bốn ô khóa"): 0734 unlocks, 734 rejected as missing digit without counting attempt
// ---------------------------------------------------------------------------
test('F05: Challenge 1 (Bốn ô khóa) accepts "0734" preserving leading zero and rejects "734" without counting attempt', () => {
  let state = createCipherGameState({ activeChallengeId: 'cipher_01_four_locks' });

  // Empty input -> format error, attempts remain 0
  const emptyRes = submitCipherAttempt(state, '   ');
  assert.equal(emptyRes.outcome, 'format_error');
  assert.equal(emptyRes.state.progressById.cipher_01_four_locks.attempts, 0);

  // "734" -> missing leading zero -> format error, attempts remain 0
  const shortRes = submitCipherAttempt(emptyRes.state, '734');
  assert.equal(shortRes.outcome, 'format_error');
  assert.ok(shortRes.state.lastFeedback.message.includes('Thiếu chữ số'));
  assert.equal(shortRes.state.progressById.cipher_01_four_locks.attempts, 0);

  // Valid wrong 4-digit code "0735" -> counts 1 attempt, returns "Mã chưa khớp", does NOT reveal answer
  const wrongRes = submitCipherAttempt(shortRes.state, '0735');
  assert.equal(wrongRes.outcome, 'wrong');
  assert.ok(wrongRes.state.lastFeedback.message.includes('Mã chưa khớp'));
  assert.equal(wrongRes.state.progressById.cipher_01_four_locks.attempts, 1);
  assert.equal(wrongRes.state.progressById.cipher_01_four_locks.status, 'unsolved');

  // Correct code "0734" -> unlocks vault, status becomes "solved", attempts = 2
  const okRes = submitCipherAttempt(wrongRes.state, '0734');
  assert.equal(okRes.outcome, 'correct');
  assert.equal(okRes.state.progressById.cipher_01_four_locks.status, 'solved');
  assert.equal(okRes.state.progressById.cipher_01_four_locks.attempts, 2);
  assert.equal(okRes.state.progressById.cipher_01_four_locks.solutionRevealed, true);

  // Double-submit after already solved -> idempotent 'already_unlocked', never increments attempts again
  const dupRes = submitCipherAttempt(okRes.state, '0734');
  assert.equal(dupRes.outcome, 'already_unlocked');
  assert.equal(dupRes.state.progressById.cipher_01_four_locks.attempts, 2);
});

// ---------------------------------------------------------------------------
// 2. Challenge B ("Bốn chữ số bí ẩn"): 24-permutation exhaustive check proves 2341 is unique
// ---------------------------------------------------------------------------
test('F05: Challenge 2 verifies all 24 permutations of {1,2,3,4} giving unique code 2341 and rejects ambiguous clue sets', () => {
  const verified = verifyFourDigitLogicClues(LOGIC_SAMPLE_PREDICATES);
  assert.equal(verified.totalPermutationsChecked, 24);
  assert.equal(verified.hasUniqueSolution, true);
  assert.deepEqual(verified.validCodes, ['2341']);
  assert.equal(verified.uniqueCode, '2341');

  // An under-constrained clue set (only d1 = 2 * d4) yields multiple valid codes and must fail uniqueness!
  const ambiguous = verifyFourDigitLogicClues([([d1, , , d4]) => d1 === 2 * d4]);
  assert.equal(ambiguous.totalPermutationsChecked, 24);
  assert.equal(ambiguous.hasUniqueSolution, false);
  assert.ok(ambiguous.validCodes.length > 1);

  // Playing Challenge 2 with "2341" solves cleanly
  const state = createCipherGameState({ activeChallengeId: 'cipher_02_four_digits' });
  const okRes = submitCipherAttempt(state, '2341');
  assert.equal(okRes.outcome, 'correct');
  assert.equal(okRes.state.progressById.cipher_02_four_digits.status, 'solved');
});

// ---------------------------------------------------------------------------
// 3. Challenge C ("Tin nhắn từ Tây Đô"): Caesar wrap-around X->A (+3), A->X (-3), WDB GR -> TAY DO
// ---------------------------------------------------------------------------
test('F05: Challenge 3 Caesar cipher verifies wrap-around (X->A +3, A->X -3), WDB GR <-> TAY DO, and case/space normalization', () => {
  assert.equal(caesarShiftChar('A', 3), 'D');
  assert.equal(caesarShiftChar('X', 3), 'A');
  assert.equal(caesarShiftChar('A', -3), 'X');
  assert.equal(caesarEncode('TAY DO', 3), 'WDB GR');
  assert.equal(caesarDecode('WDB GR', 3), 'TAY DO');

  // Case-insensitive + extra outer/inner whitespace normalization: "  tay   do  " -> "TAY DO"
  const c3 = F05_SAMPLE_CHALLENGES[2];
  const norm = validateAndNormalizeCodeInput(c3, '  tay   do  ');
  assert.equal(norm.validFormat, true);
  assert.equal(norm.normalizedCode, 'TAY DO');

  // Accented Vietnamese input without declared variant -> format guidance, does NOT count attempt
  let state = createCipherGameState({ activeChallengeId: 'cipher_03_tay_do' });
  const accented = submitCipherAttempt(state, 'Tây Đô');
  assert.equal(accented.outcome, 'format_error');
  assert.equal(accented.state.progressById.cipher_03_tay_do.attempts, 0);

  // Submitting "  tay   do " unlocks cleanly
  const okRes = submitCipherAttempt(accented.state, '  tay   do ');
  assert.equal(okRes.outcome, 'correct');
  assert.equal(okRes.state.progressById.cipher_03_tay_do.status, 'solved');
});

// ---------------------------------------------------------------------------
// 4. Progressive Hints (L1 -> L2) & "Xem lời giải" BEFORE solving records "Đã xem lời giải"
// ---------------------------------------------------------------------------
test('F05: Hints reveal progressively (1->2) and viewing solution before solving locks status to viewed_solution', () => {
  let state = createCipherGameState({ activeChallengeId: 'cipher_01_four_locks' });

  // Request hint 1 and hint 2
  const h1 = revealNextCipherHint(state);
  assert.equal(h1.revealedLevel, 1);
  assert.equal(h1.state.progressById.cipher_01_four_locks.hintsUsed, 1);

  const h2 = revealNextCipherHint(h1.state);
  assert.equal(h2.revealedLevel, 2);
  assert.equal(h2.state.progressById.cipher_01_four_locks.hintsUsed, 2);

  // Requesting again after L2 does nothing
  const h3 = revealNextCipherHint(h2.state);
  assert.equal(h3.revealedLevel, null);
  assert.equal(h3.state.progressById.cipher_01_four_locks.hintsUsed, 2);

  // Click "Xem lời giải" BEFORE solving -> status = 'viewed_solution'
  state = revealCipherSolution(h2.state);
  assert.equal(state.progressById.cipher_01_four_locks.status, 'viewed_solution');
  assert.equal(state.progressById.cipher_01_four_locks.solutionRevealed, true);

  // Even if user enters "0734" afterwards, status MUST remain 'viewed_solution' (NOT upgraded to 'solved')!
  const afterView = submitCipherAttempt(state, '0734');
  assert.equal(afterView.outcome, 'correct');
  assert.equal(afterView.state.progressById.cipher_01_four_locks.status, 'viewed_solution');

  const summary = computeCipherSummary(afterView.state);
  assert.equal(summary.solvedCount, 0);
  assert.equal(summary.viewedSolutionCount, 1);
  assert.equal(summary.totalHintsUsed, 2);
});

// ---------------------------------------------------------------------------
// 5. Simultaneous 2–6 Groups Mode (Masked Input Evaluation & Recording Winners)
// ---------------------------------------------------------------------------
test('F05: Simultaneous 2-6 groups mode evaluates multiple teams at once and records winning groups accurately', () => {
  let state = createCipherGameState({
    activeChallengeId: 'cipher_02_four_digits',
    playMode: 'groups',
    groupCount: 4,
    classSizeHint: 50,
  });

  // Group 1 enters wrong valid code, Group 2 enters correct 2341, Group 3 left blank, Group 4 enters correct 2341
  state = {
    ...state,
    groupDrafts: [
      { groupIndex: 0, code: '1234', lockedIn: true },
      { groupIndex: 1, code: '2341', lockedIn: true },
      { groupIndex: 2, code: '', lockedIn: false },
      { groupIndex: 3, code: '2341', lockedIn: true },
    ],
  };

  const evalRes = evaluateSimultaneousGroups(state);
  assert.equal(evalRes.evaluatedCount, 3);
  assert.deepEqual(evalRes.winningGroups, [1, 3]);
  assert.equal(evalRes.state.progressById.cipher_02_four_digits.status, 'solved');
  assert.deepEqual(evalRes.state.progressById.cipher_02_four_digits.solvedGroupIndices, [1, 3]);
  assert.equal(evalRes.state.progressById.cipher_02_four_digits.attempts, 1);
});

// ---------------------------------------------------------------------------
// 6. KaTeX Validity for All Clues, Hints & Step-by-Step Solutions
// ---------------------------------------------------------------------------
test('F05: All LaTeX math expressions in clues, hints, and solutions compile cleanly via KaTeX', () => {
  const renderAllInlineLatex = (text: string) => {
    const matches = [...text.matchAll(/\\\((.+?)\\\)/g)];
    for (const m of matches) {
      const html = katex.renderToString(m[1], { throwOnError: true });
      assert.ok(html.length > 0);
    }
    return matches.length;
  };

  let totalFormulas = 0;
  for (const ch of F05_SAMPLE_CHALLENGES) {
    assert.equal(ch.sourceBadge, 'Dữ liệu mẫu');
    for (const clue of ch.clues) {
      totalFormulas += renderAllInlineLatex(clue.contentLatex);
    }
    totalFormulas += renderAllInlineLatex(ch.hintLevel1Latex);
    totalFormulas += renderAllInlineLatex(ch.hintLevel2Latex);
    totalFormulas += renderAllInlineLatex(ch.solutionSummaryLatex);
    for (const st of ch.solutionSteps) {
      totalFormulas += renderAllInlineLatex(st.detailLatex);
    }
  }
  assert.ok(totalFormulas >= 15, `Expected at least 15 KaTeX formulas across F05, got ${totalFormulas}`);
});

// ---------------------------------------------------------------------------
// 7. Persistence Isolation (/demo), Exact Restore Without Double-Counting, & Headless Audio Safety
// ---------------------------------------------------------------------------
test('F05: Persistence isolates /demo, restores attempts/hints/status without double-counting, recovers corrupt JSON, and audio degrades safely', () => {
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

  (globalThis as unknown as { window: unknown }).window = {
    location: { pathname: '/demo/games', search: '', hash: '' },
    localStorage: mockLocalStorage,
  };

  let state = createCipherGameState({ activeChallengeId: 'cipher_01_four_locks', playMode: 'class', classSizeHint: 48 });
  state = revealNextCipherHint(state).state;
  state = submitCipherAttempt(state, '0734').state;

  saveF05Session(state);

  const demoKey = `${KHKT_DEMO_STORAGE_PREFIX}${F05_SESSION_STORAGE_KEY}`;
  assert.ok(store.has(demoKey), 'Expected F05 session saved under isolated /demo key');
  assert.equal(store.has(F05_SESSION_STORAGE_KEY), false);

  const restored = loadF05Session();
  assert.ok(restored);
  assert.equal(restored.state.activeChallengeId, 'cipher_01_four_locks');
  assert.equal(restored.state.playMode, 'class');
  assert.equal(restored.state.classSizeHint, 48);
  assert.equal(restored.state.progressById.cipher_01_four_locks.status, 'solved');
  assert.equal(restored.state.progressById.cipher_01_four_locks.attempts, 1);
  assert.equal(restored.state.progressById.cipher_01_four_locks.hintsUsed, 1);

  // Corrupt JSON recovery
  store.set(demoKey, '{invalid_json');
  assert.equal(loadF05Session(), null);
  assert.equal(store.has(demoKey), false);

  clearF05Session();

  // Headless audio safety (muted & unmuted without AudioContext must never throw)
  const bank = new EduGameSoundBank();
  assert.doesNotThrow(() => {
    bank.playCipherKeyTap(true);
    bank.playCipherKeyTap(false);
    bank.playCipherSubmit(true, false);
    bank.playCipherSubmit(false, false);
    bank.playCipherSubmit(false, true);
    bank.playCipherVaultOpen(true);
    bank.playCipherVaultOpen(false);
    bank.stopAll();
    bank.dispose();
  });

  delete (globalThis as unknown as { window?: unknown }).window;
});
