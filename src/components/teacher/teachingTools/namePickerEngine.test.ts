import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_PICKER_STUDENTS,
  adjustPickerStudentScore,
  beginPickerTurn,
  buildPickerSampleXlsxBytes,
  buildPickerXlsxBytes,
  clearClassPickerHistory,
  createDefaultUtilitiesState,
  createInitialClassState,
  createPickerSampleClass,
  drawPickerRandomNumber,
  extractMatrixFromXlsxBuffer,
  finalizePickerTurn,
  flipPickerCoin,
  loadNamePickerClassState,
  parsePickerExcelPreview,
  pickRandomStudentsUnbiased,
  resetClassPickerScores,
  resetCoinStats,
  resetNumberDrawState,
  resolvePickerEligibility,
  rollPickerDice,
  saveNamePickerClassState,
  startNewPickerRound,
  undoLastPickerScore,
} from './namePickerEngine';

function setupMemoryWindow(pathname = '/teacher_tools') {
  const store = new Map<string, string>();
  const mockStorage = {
    get length() {
      return store.size;
    },
    key(i: number) {
      return Array.from(store.keys())[i] ?? null;
    },
    getItem(k: string) {
      return store.has(k) ? store.get(k)! : null;
    },
    setItem(k: string, v: string) {
      store.set(k, String(v));
    },
    removeItem(k: string) {
      store.delete(k);
    },
  };
  (globalThis as Record<string, unknown>).window = {
    location: { pathname },
    localStorage: mockStorage,
  };
  return store;
}

test('Edge rosters: 0 present, 1 present, 50 present, duplicate full names + 1 absent', () => {
  // 0 present students
  const emptyCls = createPickerSampleClass({ preset: 'sample_empty' });
  const emptyState = createInitialClassState({
    classId: emptyCls.id,
    className: emptyCls.name,
    sourceType: 'sample_editable',
    students: emptyCls.students,
  });
  const emptyElig = resolvePickerEligibility(emptyState);
  assert.equal(emptyElig.canCallNow, false);
  assert.equal(emptyElig.presentCount, 0);

  // 1 present student
  const oneCls = createPickerSampleClass({ preset: 'sample_1' });
  const oneState = createInitialClassState({
    classId: oneCls.id,
    className: oneCls.name,
    sourceType: 'sample_editable',
    students: oneCls.students,
  });
  const oneTurn = beginPickerTurn({ state: oneState, mode: 'wheel', skipAnimation: true });
  assert.equal(oneTurn.ok, true);
  assert.equal(oneTurn.nextState.activeTurn?.pickedStudents.length, 1);

  // 50 students all unique codes 001..050 & full non-repeat round completes in 50 calls
  const cls50 = createPickerSampleClass({ preset: 'sample_50' });
  assert.equal(cls50.students.length, 50);
  let state50 = createInitialClassState({
    classId: cls50.id,
    className: cls50.name,
    sourceType: 'sample_editable',
    students: cls50.students,
  });
  const calledSet50 = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const turn = beginPickerTurn({ state: state50, mode: 'slot_machine', skipAnimation: true });
    assert.equal(turn.ok, true);
    state50 = turn.nextState;
    const picked = state50.activeTurn?.pickedStudents[0];
    assert.ok(picked);
    assert.equal(calledSet50.has(picked.id), false);
    calledSet50.add(picked.id);
  }
  assert.equal(calledSet50.size, 50);
  const exhaustedTurn = beginPickerTurn({ state: state50, mode: 'slot_machine' });
  assert.equal(exhaustedTurn.ok, false);

  // Duplicate names ("Nguyễn Văn An" x2) + 1 absent ("003") remain tracked by unique student.id
  const dupCls = createPickerSampleClass({ preset: 'sample_dup_001' });
  const dupState = createInitialClassState({
    classId: dupCls.id,
    className: dupCls.name,
    sourceType: 'sample_editable',
    students: dupCls.students,
  });
  const dupElig = resolvePickerEligibility(dupState);
  assert.equal(dupElig.presentCount, 4);
  assert.equal(
    dupElig.eligiblePool.some((s) => s.code === '003'),
    false,
    'Absent student 003 must never be drawn'
  );
  const idsAn = dupElig.eligiblePool
    .filter((s) => s.fullName === 'Nguyễn Văn An')
    .map((s) => s.id);
  assert.equal(idsAn.length, 2);
  assert.notEqual(idsAn[0], idsAn[1]);
});

test('Scope switch (all_present -> starred_only), uniform 1/6 odds, anti-repeat persistence, shortfall prompt & round/history separation', () => {
  const cls12 = createPickerSampleClass({ preset: 'standard_12' });
  let state = createInitialClassState({
    classId: cls12.id,
    className: cls12.name,
    sourceType: 'sample_editable',
    students: cls12.students,
  });

  // Star first 6 students
  const starredIds = state.students.slice(0, 6).map((s) => s.id);
  state = {
    ...state,
    students: state.students.map((s) => ({
      ...s,
      starred: starredIds.includes(s.id),
    })),
  };

  // Equal probability check among the 6 starred candidates when picked sequentially by uniform index
  const uniformPicks = Array.from({ length: 6 }, (_, idx) =>
    pickRandomStudentsUnbiased(
      state.students.filter((s) => s.starred),
      1,
      () => idx
    )[0].id
  );
  assert.deepEqual(uniformPicks, starredIds);

  // Simulate calling the first starred student while in 'all_present' scope
  state = {
    ...state,
    scope: 'all_present',
    calledIdsInRound: [starredIds[0]],
  };

  // Switch scope to 'starred_only' -> must respect anti-repeat pool (only 5 remaining!)
  state = { ...state, scope: 'starred_only', requestedK: 3 };
  const elig1 = resolvePickerEligibility(state);
  assert.equal(elig1.remainingPool.length, 5);
  assert.equal(elig1.remainingPool.some((s) => s.id === starredIds[0]), false);

  // Pick 3 in starred_only -> only 2 left
  const t1 = beginPickerTurn({ state, mode: 'flip_cards', skipAnimation: true });
  assert.equal(t1.ok, true);
  state = t1.nextState;
  assert.equal(resolvePickerEligibility(state).remainingPool.length, 2);

  // Next call with k = 3 triggers shortfall warning rather than auto-repeating!
  const shortAttempt = beginPickerTurn({ state, mode: 'elimination' });
  assert.equal(shortAttempt.ok, false);
  assert.deepEqual(shortAttempt.requiresShortfallDecision, {
    remainingCount: 2,
    requestedK: 3,
  });

  // Option A: call the remaining 2 without repeating
  const callRemaining2 = beginPickerTurn({
    state,
    mode: 'elimination',
    countOverride: 2,
    skipAnimation: true,
  });
  assert.equal(callRemaining2.ok, true);
  state = callRemaining2.nextState;
  assert.equal(state.activeTurn?.pickedStudents.length, 2);
  // Elimination mode records ONLY final 2 winners in history (never eliminated candidates)
  assert.equal(state.history[0].pickedStudents.length, 2);

  // Add a score before testing "Bắt đầu vòng mới" vs "Xóa lịch sử lớp"
  state = adjustPickerStudentScore({
    state,
    studentId: state.students[0].id,
    delta: 1,
    actionId: 'act_score_1',
  });
  const historyLenBeforeNewRound = state.history.length;

  // "Bắt đầu vòng mới" resets round pool ONLY, preserving history and scores
  state = startNewPickerRound(state);
  assert.equal(state.calledIdsInRound.length, 0);
  assert.equal(state.history.length, historyLenBeforeNewRound);
  assert.equal(state.students[0].score, 1);

  // "Xóa lịch sử lớp" clears history WITHOUT wiping student scores
  state = clearClassPickerHistory(state);
  assert.equal(state.history.length, 0);
  assert.equal(state.students[0].score, 1);
});

test('Double trigger lock during animating turn + mid-animation reload commits strictly once without duplicating history', () => {
  const store = setupMemoryWindow('/teacher_tools');
  const cls12 = createPickerSampleClass({ preset: 'standard_12' });
  const initState = createInitialClassState({
    classId: cls12.id,
    className: cls12.name,
    sourceType: 'sample_editable',
    students: cls12.students,
  });

  // Start animated turn -> pre-commits winners in activeTurn (`status: 'animating'`)
  const started = beginPickerTurn({ state: initState, mode: 'draw_box', skipAnimation: false });
  assert.equal(started.ok, true);
  assert.equal(started.nextState.activeTurn?.status, 'animating');
  assert.equal(started.nextState.activeTurn?.recordedInHistory, false);
  const preCommittedWinner = started.nextState.activeTurn?.pickedStudents[0];
  assert.ok(preCommittedWinner);

  // Rapid second trigger (double click / held R key) MUST be rejected while animating
  const doubleTrigger = beginPickerTurn({ state: started.nextState, mode: 'draw_box' });
  assert.equal(doubleTrigger.ok, false);

  // Save mid-animation state, simulating unexpected page reload before animation completes
  saveNamePickerClassState(started.nextState, 'teacher_acc_1');
  const reloaded = loadNamePickerClassState(cls12.id, 'teacher_acc_1');
  assert.ok(reloaded);
  assert.equal(reloaded.activeTurn?.status, 'revealed');
  assert.equal(reloaded.activeTurn?.recordedInHistory, true);
  assert.equal(reloaded.activeTurn?.pickedStudents[0].id, preCommittedWinner.id);
  assert.equal(reloaded.history.length, 1);
  assert.deepEqual(reloaded.calledIdsInRound, [preCommittedWinner.id]);

  // Calling finalizePickerTurn again (or reloading a second time) is strictly idempotent
  const finalizedTwice = finalizePickerTurn(reloaded);
  assert.equal(finalizedTwice.history.length, 1);
  assert.equal(finalizedTwice.calledIdsInRound.length, 1);
  assert.ok(store.size >= 1);
});

test('Per-class isolation + score undo + reset + /demo sandbox storage prefix separation', () => {
  setupMemoryWindow('/teacher_tools');
  const clsA = createPickerSampleClass({ preset: 'standard_12', customName: 'Lớp 8A' });
  const clsB = createPickerSampleClass({ preset: 'standard_12', customName: 'Lớp 8B' });

  let stateA = createInitialClassState({
    classId: clsA.id,
    className: clsA.name,
    sourceType: 'sample_editable',
    students: clsA.students,
  });
  let stateB = createInitialClassState({
    classId: clsB.id,
    className: clsB.name,
    sourceType: 'sample_editable',
    students: clsB.students,
  });

  stateA = adjustPickerStudentScore({
    state: stateA,
    studentId: stateA.students[0].id,
    delta: 1,
    actionId: 'a1',
  });
  stateA = adjustPickerStudentScore({
    state: stateA,
    studentId: stateA.students[0].id,
    delta: 1,
    actionId: 'a2',
  });
  assert.equal(stateA.students[0].score, 2);
  // Duplicate actionId is ignored idempotently
  stateA = adjustPickerStudentScore({
    state: stateA,
    studentId: stateA.students[0].id,
    delta: 1,
    actionId: 'a2',
  });
  assert.equal(stateA.students[0].score, 2);

  // Undo latest reverts only last delta
  stateA = undoLastPickerScore(stateA);
  assert.equal(stateA.students[0].score, 1);

  saveNamePickerClassState(stateA, 'teacher_prod');
  saveNamePickerClassState(stateB, 'teacher_prod');

  const loadedA = loadNamePickerClassState(clsA.id, 'teacher_prod');
  const loadedB = loadNamePickerClassState(clsB.id, 'teacher_prod');
  assert.equal(loadedA?.students[0].score, 1);
  assert.equal(loadedB?.students[0].score, 0);

  // Confirm reset zeroes only class A scores
  const resetA = resetClassPickerScores(stateA);
  assert.equal(resetA.students.every((s) => s.score === 0), true);

  // /demo URL isolates storage keys cleanly
  setupMemoryWindow('/demo/teacher_tools');
  const loadedInDemo = loadNamePickerClassState(clsA.id, 'teacher_prod');
  assert.equal(loadedInDemo, null);
});

test('Three random utilities: 3 dice sum 3..18, coin reset isolation, number draw 1-5 exhaustion & range change reset', () => {
  let u = createDefaultUtilitiesState();

  // 3 dice
  u = rollPickerDice(u, 3, 1000, () => 5); // all 6 -> sum 18
  assert.deepEqual(u.lastDiceValues, [6, 6, 6]);
  assert.equal(u.lastDiceSum, 18);

  u = rollPickerDice(u, 3, 2000, () => 0); // all 1 -> sum 3
  assert.deepEqual(u.lastDiceValues, [1, 1, 1]);
  assert.equal(u.lastDiceSum, 3);

  // Flip coin twice then reset coin only -> dice & numbers stay untouched!
  u = flipPickerCoin(u, () => 0); // Sấp
  u = flipPickerCoin(u, () => 1); // Ngửa
  assert.equal(u.coinTailsCount, 1);
  assert.equal(u.coinHeadsCount, 1);
  assert.equal(u.coinTotalFlips, 2);

  // Draw numbers 1..5 non-repeating
  for (let i = 0; i < 5; i++) {
    u = drawPickerRandomNumber({
      utilities: u,
      fromInput: 1,
      toInput: 5,
      noRepeat: true,
      nowMs: 3000 + i,
      rngInt: () => 0,
    });
    assert.equal(u.numberError, '');
  }
  assert.deepEqual(u.drawnNumbers, [1, 2, 3, 4, 5]);
  assert.equal(u.numberExhausted, true);

  // 6th draw in 1..5 -> reports exhaustion cleanly
  const afterExhaust = drawPickerRandomNumber({
    utilities: u,
    fromInput: 1,
    toInput: 5,
    noRepeat: true,
  });
  assert.ok(afterExhaust.numberError.includes('Đã bốc hết'));

  // Reset coin only -> preserves diceHistory and drawnNumbers
  const coinReset = resetCoinStats(afterExhaust);
  assert.equal(coinReset.coinTotalFlips, 0);
  assert.equal(coinReset.diceHistory.length, 2);
  assert.equal(coinReset.drawnNumbers.length, 5);

  // Changing range (10..15) automatically clears old range history & draws cleanly
  const newRange = drawPickerRandomNumber({
    utilities: coinReset,
    fromInput: 10,
    toInput: 15,
    noRepeat: true,
    rngInt: () => 2,
  });
  assert.equal(newRange.numberError, '');
  assert.equal(newRange.lastDrawnNumber, 12);
  assert.deepEqual(newRange.drawnNumbers, [12]);
  assert.equal(newRange.numberHistory.length, 1);

  // Invalid from > to rejected safely
  const invalidRange = drawPickerRandomNumber({
    utilities: newRange,
    fromInput: 50,
    toInput: 10,
    noRepeat: true,
  });
  assert.ok(invalidRange.numberError.length > 0);

  // Explicit number draw reset clears drawnNumbers
  const clearedNumbers = resetNumberDrawState(newRange);
  assert.equal(clearedNumbers.drawnNumbers.length, 0);
  assert.equal(clearedNumbers.lastDrawnNumber, null);
});

test('Excel XLSX roundtrip preserves leading-zero string codes ("001"), Vietnamese accents, error rows, duplicates & >50 guard + verifies static sample xlsx file', () => {
  const bytes = buildPickerSampleXlsxBytes();
  const matrix = extractMatrixFromXlsxBuffer(bytes.slice().buffer as ArrayBuffer);
  const preview = parsePickerExcelPreview(matrix);

  assert.equal(preview.errorCount, 0);
  assert.equal(preview.validRows.length, 6);
  assert.equal(preview.validRows[0].code, '001');
  assert.equal(preview.validRows[0].fullName, 'Nguyễn Minh An');
  assert.equal(preview.validRows[2].code, '003');
  assert.equal(preview.validRows[2].fullName, 'Nguyễn Minh An');
  assert.equal(preview.validRows[4].present, false);

  // Verify generated static sample Excel file on disk has exact same leading-zero structure and no email column
  const sampleFilePath = path.resolve(process.cwd(), 'public/samples/mau_danh_sach_goi_ten.xlsx');
  assert.equal(fs.existsSync(sampleFilePath), true);
  const diskBuf = fs.readFileSync(sampleFilePath);
  const diskMatrix = extractMatrixFromXlsxBuffer(new Uint8Array(diskBuf).buffer);
  assert.deepEqual(diskMatrix[0], ['Mã học sinh', 'Họ và tên', 'Có mặt']);
  assert.equal(diskMatrix[1][0], '001');

  // Roundtrip export of custom leading-zero codes
  const customBytes = buildPickerXlsxBytes([
    { code: '0007', fullName: 'Đặng Bảo Quốc', present: true },
    { code: '0008', fullName: 'Võ Thị Thuỳ Dương', present: true },
  ]);
  const customMatrix = extractMatrixFromXlsxBuffer(customBytes.slice().buffer as ArrayBuffer);
  const customPreview = parsePickerExcelPreview(customMatrix);
  assert.equal(customPreview.validRows[0].code, '0007');
  assert.equal(customPreview.validRows[0].fullName, 'Đặng Bảo Quốc');

  // Duplicate code & missing name detection
  const badPreview = parsePickerExcelPreview(
    'Mã học sinh\tHọ và tên\n001\tNguyễn Văn A\n001\tTrần Văn B\n003\t'
  );
  assert.equal(badPreview.hasDuplicateCodes, true);
  assert.equal(badPreview.errorCount, 2);

  // Exceeds 50 students guard
  const over50Text = Array.from(
    { length: MAX_PICKER_STUDENTS + 1 },
    (_, i) => `${String(i + 1).padStart(3, '0')}\tHọc sinh ${i + 1}`
  ).join('\n');
  const over50Preview = parsePickerExcelPreview(over50Text);
  assert.equal(over50Preview.exceedsMaxStudents, true);
  assert.equal(over50Preview.errorCount, 1);
});
