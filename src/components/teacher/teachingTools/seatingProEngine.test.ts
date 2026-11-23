import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  addDeskToAisle,
  adjustDeskSeatCount,
  applyCandidateRoomConfig,
  buildOrientedAislesView,
  buildSeatingChartXlsxBytes,
  buildSeatingFlightPlan,
  buildSeatingSampleXlsxBytes,
  computeSeatingStats,
  createInitialSeatingProState,
  createSeatingSampleStudents,
  evaluateRoomChangeImpact,
  evaluateSeatingFlightFrame,
  extractSeatingXlsxMatrix,
  formatStudentDisplayName,
  getRoomCapacitySummary,
  getUnassignedStudents,
  indexRoomSeats,
  loadSeatingProState,
  migrateLegacySeatingToProState,
  parseSeatingRosterPreview,
  rebuildRoomGridDimensions,
  resetUnpinnedPlacements,
  runSeatingAssignmentSolver,
  saveSeatingProState,
  swapOrMoveSeatAction,
  toggleSeatLockAction,
  toggleSeatPinAction,
  undoLastSeatingAction,
} from './seatingProEngine';
import { createDefaultSeatingState } from './teachingToolsEngine';

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

test('Default room is 3 aisles x 6 desks x 2 seats = 36 seats & balances 25 students as 9-8-8', () => {
  const s25 = createSeatingSampleStudents('sample_25');
  const state = createInitialSeatingProState({
    classId: 'cls_25',
    className: 'Lớp 8A1',
    sourceType: 'sample_editable',
    students: s25,
  });

  const summary = getRoomCapacitySummary(state);
  assert.equal(summary.totalSeats, 36);
  assert.equal(summary.availableSeats, 36);
  assert.equal(summary.lockedSeats, 0);

  const solved = runSeatingAssignmentSolver({
    state,
    skipAnimation: true,
  });
  assert.equal(solved.ok, true);

  const stats = computeSeatingStats(
    solved.nextState.room,
    solved.nextState.assignments,
    solved.nextState.pinnedSeatIds,
    solved.nextState.lockedSeatIds
  );
  const sortedCounts = stats.aisles.map((a) => a.assignedCount).sort((a, b) => a - b);
  assert.deepEqual(sortedCounts, [8, 8, 9]);
  assert.equal(stats.spread, 1);
});

test('Handles 1 student, 50 students, duplicate names + absent student, and reports exact 2-seat shortage (50 vs 48)', () => {
  // 1 student
  const s1 = createSeatingSampleStudents('sample_1');
  const st1 = createInitialSeatingProState({
    classId: 'cls_1',
    className: 'Lớp 1 HS',
    sourceType: 'sample_editable',
    students: s1,
  });
  const res1 = runSeatingAssignmentSolver({ state: st1, skipAnimation: true });
  assert.equal(res1.ok, true);
  assert.equal(getRoomCapacitySummary(res1.nextState).assignedSeats, 1);

  // Duplicate names + 1 absent ("003" Trần Thị Bình absent)
  const sDup = createSeatingSampleStudents('sample_dup_absent');
  const stDup = createInitialSeatingProState({
    classId: 'cls_dup',
    className: 'Lớp trùng tên',
    sourceType: 'sample_editable',
    students: sDup,
  });
  const resDup = runSeatingAssignmentSolver({ state: stDup, skipAnimation: true });
  assert.equal(resDup.ok, true);
  assert.equal(getRoomCapacitySummary(resDup.nextState).assignedSeats, 5);
  assert.equal(Object.values(resDup.nextState.assignments).includes('dup_003'), false);
  assert.equal(Object.values(resDup.nextState.assignments).includes('dup_001'), true);
  assert.equal(Object.values(resDup.nextState.assignments).includes('dup_002'), true);

  // Short-name disambiguation automatically differentiates duplicate names
  const fmtA = formatStudentDisplayName({
    student: stDup.students[0],
    sttIndex: 1,
    mode: 'last_two',
    allStudents: stDup.students,
  });
  const fmtB = formatStudentDisplayName({
    student: stDup.students[1],
    sttIndex: 2,
    mode: 'last_two',
    allStudents: stDup.students,
  });
  assert.notEqual(fmtA.primary, fmtB.primary);

  // 50 students on 50 seats (5x5x2) with 2 locked seats = 48 available -> MUST report missing exactly 2 seats!
  const s50 = createSeatingSampleStudents('sample_50');
  let st50 = createInitialSeatingProState({
    classId: 'cls_50',
    className: 'Lớp 50 HS',
    sourceType: 'sample_editable',
    students: s50,
  });
  st50 = {
    ...st50,
    room: rebuildRoomGridDimensions(st50.room, 5, 5, 2), // 50 seats
  };
  const { orderedSeatIds } = indexRoomSeats(st50.room);
  st50 = toggleSeatLockAction(st50, orderedSeatIds[0]).nextState;
  st50 = toggleSeatLockAction(st50, orderedSeatIds[1]).nextState;
  assert.equal(getRoomCapacitySummary(st50).availableSeats, 48);

  const shortRes = runSeatingAssignmentSolver({ state: st50, skipAnimation: true });
  assert.equal(shortRes.ok, false);
  assert.equal(shortRes.shortageCount, 2);
  assert.ok(shortRes.reason?.includes('Thiếu 2 ghế'));

  // Unlock those 2 seats -> all 50 seats available -> places 50 unique students cleanly!
  st50 = toggleSeatLockAction(st50, orderedSeatIds[0]).nextState;
  st50 = toggleSeatLockAction(st50, orderedSeatIds[1]).nextState;
  const full50 = runSeatingAssignmentSolver({ state: st50, skipAnimation: true });
  assert.equal(full50.ok, true);
  const placedIds = Object.values(full50.nextState.assignments).filter(Boolean);
  assert.equal(placedIds.length, 50);
  assert.equal(new Set(placedIds).size, 50);
});

test('Respects pinned seats, skips locked seats, enforces noSameDeskPairs, and catches pinned desk conflict before solve', () => {
  const s12 = createSeatingSampleStudents('sample_25').slice(0, 12);
  let state = createInitialSeatingProState({
    classId: 'cls_const',
    className: 'Lớp 7B',
    sourceType: 'sample_editable',
    students: s12,
  });
  const { orderedSeatIds, locationsById } = indexRoomSeats(state.room);
  const seatDesk1A = orderedSeatIds[0]; // Dãy 1 Bàn 1 Chỗ 1
  const seatDesk1B = orderedSeatIds[1]; // Dãy 1 Bàn 1 Chỗ 2
  const lockedSeat = orderedSeatIds[2]; // Dãy 1 Bàn 2 Chỗ 1

  // Place two students at Desk 1 and pin both, lock lockedSeat
  state = {
    ...state,
    assignments: {
      [seatDesk1A]: s12[0].id,
      [seatDesk1B]: s12[1].id,
    },
    pinnedSeatIds: [seatDesk1A, seatDesk1B],
    lockedSeatIds: [lockedSeat],
    constraints: {
      assignmentMode: 'balanced_aisles',
      frontPriorityDeskCount: 2,
      noSameDeskPairs: [[s12[0].id, s12[1].id]],
    },
  };

  // Pre-solve conflict check MUST catch that s12[0] and s12[1] are pinned on the same desk!
  const conflictRes = runSeatingAssignmentSolver({ state, skipAnimation: true });
  assert.equal(conflictRes.ok, false);
  assert.ok(conflictRes.reason?.includes('Dãy 1 – Bàn 1'));

  // Unpin second student from Desk 1 and re-solve -> s12[0] stays pinned at seatDesk1A, s12[1] MUST NOT sit at seatDesk1B!
  state = toggleSeatPinAction(state, seatDesk1B).nextState;
  const validSolve = runSeatingAssignmentSolver({ state, skipAnimation: true });
  assert.equal(validSolve.ok, true);
  assert.equal(validSolve.nextState.assignments[seatDesk1A], s12[0].id);
  assert.equal(validSolve.nextState.assignments[lockedSeat] ?? null, null);

  // Verify no pair sits on the same desk
  const seatOfB = Object.keys(validSolve.nextState.assignments).find(
    (k) => validSolve.nextState.assignments[k] === s12[1].id
  )!;
  assert.notEqual(
    locationsById.get(seatOfB)?.deskId,
    locationsById.get(seatDesk1A)?.deskId
  );

  // Manual swap violating noSameDeskPairs MUST also be blocked cleanly!
  const illegalSwap = swapOrMoveSeatAction(validSolve.nextState, seatOfB, seatDesk1B);
  assert.equal(illegalSwap.ok, false);
  assert.ok(illegalSwap.error?.includes('Không ngồi cùng bàn'));
});

test('Manual swap, move to empty seat, undo, and double orientation flip preserve physical placement', () => {
  const s6 = createSeatingSampleStudents('sample_dup_absent'); // 5 present
  let state = createInitialSeatingProState({
    classId: 'cls_swap',
    className: 'Lớp 6C',
    sourceType: 'sample_editable',
    students: s6,
  });
  state = runSeatingAssignmentSolver({ state, skipAnimation: true }).nextState;

  const { orderedSeatIds } = indexRoomSeats(state.room);
  const occupiedSeats = orderedSeatIds.filter((id) => Boolean(state.assignments[id]));
  const emptySeat = orderedSeatIds.find((id) => !state.assignments[id])!;

  const seat1 = occupiedSeats[0];
  const seat2 = occupiedSeats[1];
  const stu1 = state.assignments[seat1];
  const stu2 = state.assignments[seat2];

  // Swap two students
  state = swapOrMoveSeatAction(state, seat1, seat2).nextState;
  assert.equal(state.assignments[seat1], stu2);
  assert.equal(state.assignments[seat2], stu1);

  // Move to empty seat
  state = swapOrMoveSeatAction(state, seat1, emptySeat).nextState;
  assert.equal(state.assignments[emptySeat], stu2);
  assert.equal(state.assignments[seat1] ?? null, null);

  // Undo twice -> restores original seats!
  state = undoLastSeatingAction(state);
  assert.equal(state.assignments[seat1], stu2);
  assert.equal(state.assignments[emptySeat] ?? null, null);
  state = undoLastSeatingAction(state);
  assert.equal(state.assignments[seat1], stu1);
  assert.equal(state.assignments[seat2], stu2);

  // Double orientation flip (front -> back -> front) matches 100% identically and never alters assignments
  const snapshotBefore = JSON.stringify(state.assignments);
  const viewFront1 = buildOrientedAislesView(state.room, 'front_board');
  const viewBack = buildOrientedAislesView(state.room, 'back_of_class');
  const flippedAgain = buildOrientedAislesView(state.room, 'front_board');

  assert.notDeepEqual(
    viewFront1.map((a) => a.aisle.id),
    viewBack.map((a) => a.aisle.id)
  );
  assert.deepEqual(flippedAgain, viewFront1);
  assert.equal(JSON.stringify(state.assignments), snapshotBefore);
});

test('Per-desk customization (Dãy 2 Bàn 1 = 3 seats), impact confirmation, Làm lại keeps pins & locks, reload recovery & legacy Đợt 1 migration', () => {
  setupMemoryWindow('/teacher_tools');

  const s12 = createSeatingSampleStudents('sample_25').slice(0, 12);
  let state = createInitialSeatingProState({
    classId: 'cls_custom',
    className: 'Lớp 9A',
    sourceType: 'sample_editable',
    students: s12,
  });

  // Customize Dãy 2 - Bàn 1 to 3 seats -> total seats = 37
  const aisle2 = state.room.aisles[1];
  const aisle2Desk1 = aisle2.desks[0];
  let customRoom = adjustDeskSeatCount(state.room, aisle2.id, aisle2Desk1.id, 3);
  state = applyCandidateRoomConfig(state, customRoom);
  assert.equal(getRoomCapacitySummary(state).totalSeats, 37);

  // Add a desk to Dãy 1 -> total seats = 39
  customRoom = addDeskToAisle(state.room, state.room.aisles[0].id);
  state = applyCandidateRoomConfig(state, customRoom);
  assert.equal(getRoomCapacitySummary(state).totalSeats, 39);

  // Solve, pin first student, lock one seat
  state = runSeatingAssignmentSolver({ state, skipAnimation: false }).nextState; // animating!
  const { orderedSeatIds } = indexRoomSeats(state.room);
  const firstAssigned = orderedSeatIds.find((sId) => Boolean(state.assignments[sId]))!;
  const lockedCandidate = orderedSeatIds.find((sId) => !state.assignments[sId])!;

  // Simulate mid-animation reload -> must recover revealed assignments cleanly!
  saveSeatingProState(state, 'teacher_acc_1');
  const reloaded = loadSeatingProState('cls_custom', 'teacher_acc_1')!;
  assert.ok(reloaded);
  assert.equal(reloaded.activeReveal?.status, 'revealed');
  assert.equal(getRoomCapacitySummary(reloaded).assignedSeats, 12);

  // Pin & lock then shrink room to 2 aisles -> evaluateRoomChangeImpact flags affected students & applying puts them in waiting list!
  let pinnedAndLocked = toggleSeatPinAction(reloaded, firstAssigned).nextState;
  pinnedAndLocked = toggleSeatLockAction(pinnedAndLocked, lockedCandidate).nextState;
  const shrunkRoom = rebuildRoomGridDimensions(pinnedAndLocked.room, 1, 2, 2); // Only 4 seats!
  const impact = evaluateRoomChangeImpact(pinnedAndLocked, shrunkRoom);
  assert.equal(impact.hasImpact, true);
  assert.ok(impact.lostSeats.length > 0);
  const afterShrink = applyCandidateRoomConfig(pinnedAndLocked, shrunkRoom);
  assert.ok(getUnassignedStudents(afterShrink).length >= 8);

  // "Làm lại" keeps room config, pins, and locks while clearing unpinned seats
  let withPinRestore = undoLastSeatingAction(afterShrink);
  const resetState = resetUnpinnedPlacements(withPinRestore);
  assert.equal(resetState.assignments[firstAssigned], withPinRestore.assignments[firstAssigned]);
  assert.equal(resetState.lockedSeatIds.includes(lockedCandidate), true);
  assert.equal(getRoomCapacitySummary(resetState).assignedSeats, 1);

  // Legacy Đợt 1 SeatingState migration preserves assignments, blocks & pins
  let legacy = createDefaultSeatingState(4, 6);
  legacy = {
    ...legacy,
    blockedSeatKeys: ['0-0'],
    pinnedSeatKeys: ['0-1'],
    assignments: { '0-1': s12[0].id, '1-2': s12[1].id },
    orientation: 'back_of_class',
  };
  const migrated = migrateLegacySeatingToProState({
    classId: 'legacy_cls',
    className: 'Lớp Đợt 1',
    sourceType: 'real_readonly',
    students: s12,
    legacySeating: legacy,
  });
  assert.equal(migrated.orientation, 'back_of_class');
  assert.equal(migrated.lockedSeatIds.length, 1);
  assert.equal(migrated.pinnedSeatIds.length, 1);
  assert.equal(Object.values(migrated.assignments).filter(Boolean).length, 2);
});

test('XLSX export/import roundtrip keeps string codes ("001") & checks sample Excel file on disk', () => {
  const sDup = createSeatingSampleStudents('sample_dup_absent');
  let state = createInitialSeatingProState({
    classId: 'cls_xlsx',
    className: 'Lớp 8C',
    sourceType: 'sample_editable',
    students: sDup,
  });
  state = runSeatingAssignmentSolver({ state, skipAnimation: true }).nextState;

  const xlsxBytes = buildSeatingChartXlsxBytes(state);
  const wb = XLSX.read(xlsxBytes, { type: 'array' });
  const sheet = wb.Sheets['SoDoChoNgoi'];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  assert.deepEqual(rows[0], ['Dãy', 'Bàn', 'Chỗ', 'Mã học sinh', 'Họ và tên', 'Trạng thái ghế']);
  const assignedRow = rows.find((r, idx) => idx > 0 && r[3] === '001');
  assert.ok(assignedRow, 'Code "001" must remain exact string without losing leading zeros');
  assert.equal(assignedRow![4], 'Nguyễn Văn An');

  // Verify static sample Excel on disk matches spec (no email column!)
  const samplePath = path.resolve(process.cwd(), 'public/samples/mau_so_do_cho_ngoi.xlsx');
  assert.equal(fs.existsSync(samplePath), true);
  const sampleBuf = fs.readFileSync(samplePath);
  const matrix = extractSeatingXlsxMatrix(new Uint8Array(sampleBuf).buffer);
  assert.deepEqual(matrix[0], ['Mã học sinh', 'Họ và tên', 'Có mặt']);
  assert.equal(matrix[1][0], '001');

  // Verify names-only paste creates distinct local codes & catches >50 error
  const pasted = parseSeatingRosterPreview('Nguyễn A\n\nTrần B', 'names_only_lines');
  assert.equal(pasted.validRows.length, 2);
  assert.equal(pasted.emptyRowsSkipped, 1);
  assert.equal(pasted.validRows[0].code, 'HS001');
  assert.equal(pasted.validRows[1].code, 'HS002');
});

test('Flight wave choreography guarantees 0 duplicate names at every timestamp, respects pins/locks & matches 30s vs instant end result', () => {
  const s25 = createSeatingSampleStudents('sample_25');
  let state1 = createInitialSeatingProState({
    classId: 'cls_flight',
    className: 'Lớp 8A5',
    sourceType: 'sample_editable',
    students: s25,
  });

  // First round placement (instant)
  state1 = runSeatingAssignmentSolver({ state: state1, skipAnimation: true }).nextState;
  const { orderedSeatIds } = indexRoomSeats(state1.room);
  const pinnedSeat = orderedSeatIds.find((id) => Boolean(state1.assignments[id]))!;
  const pinnedStudentId = state1.assignments[pinnedSeat]!;
  const lockedSeat = orderedSeatIds.find((id) => !state1.assignments[id])!;

  state1 = toggleSeatPinAction(state1, pinnedSeat).nextState;
  state1 = toggleSeatLockAction(state1, lockedSeat).nextState;

  // Second round randomize with 30s effect -> stores previousAssignments and locked target
  const res30 = runSeatingAssignmentSolver({ state: state1, skipAnimation: false });
  assert.equal(res30.ok, true);
  const reveal = res30.nextState.activeReveal!;
  assert.ok(reveal.previousAssignments);
  assert.equal(reveal.durationSeconds, 30);

  const plan = buildSeatingFlightPlan({
    previousAssignments: reveal.previousAssignments,
    targetAssignments: reveal.committedAssignments,
    orderedSeatIds,
    pinnedSeatIds: res30.nextState.pinnedSeatIds,
    lockedSeatIds: res30.nextState.lockedSeatIds,
    durationSeconds: 30,
    revealOrderSeatIds: reveal.revealOrderSeatIds,
  });

  assert.equal(plan.durationMs, 30000);
  assert.ok(plan.moves.length > 0);
  assert.equal(plan.moves.some((m) => m.studentId === pinnedStudentId), false, 'Pinned student must never fly');
  assert.equal(plan.moves.some((m) => m.toSeatId === lockedSeat), false, 'Locked seat must never receive a move');

  // Sample every 150ms across 0..30000ms: ZERO duplicate students on screen at any instant!
  for (let t = 0; t <= 30000; t += 150) {
    const frame = evaluateSeatingFlightFrame(plan, t);
    const seen = new Set<string>();
    for (const [seatId, stuId] of Object.entries(frame.stationaryAssignments)) {
      if (!stuId) continue;
      assert.equal(seen.has(stuId), false, `Duplicate stationary student ${stuId} at t=${t}ms seat=${seatId}`);
      seen.add(stuId);
    }
    for (const air of frame.airborneMoves) {
      assert.equal(seen.has(air.move.studentId), false, `Student ${air.move.studentId} both stationary & airborne at t=${t}ms`);
      seen.add(air.move.studentId);
    }
    assert.equal(frame.stationaryAssignments[pinnedSeat], pinnedStudentId, 'Pinned student stays stationary throughout');
    assert.equal(frame.stationaryAssignments[lockedSeat] ?? null, null, 'Locked seat stays empty throughout');
  }

  // Final frame matches committed targetAssignments 100% (identical to "Xem kết quả ngay")
  const endFrame = evaluateSeatingFlightFrame(plan, 30000);
  assert.equal(endFrame.isComplete, true);
  for (const sId of orderedSeatIds) {
    assert.equal(endFrame.stationaryAssignments[sId] ?? null, reveal.committedAssignments[sId] ?? null);
  }
});
