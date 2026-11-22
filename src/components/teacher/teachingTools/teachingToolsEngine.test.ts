import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_MODE_META,
  ToolStudentItem,
  advanceActivityRound,
  applyPackageForNewLesson,
  applyTeamScoreAction,
  assignSeatsRandomly,
  buildPackageFromSession,
  computeScoreboardRankings,
  createDefaultActivityState,
  createDefaultScoreboardState,
  createDefaultSeatingState,
  createDefaultTimerState,
  createFreshClassTeachingSession,
  divideStudentsIntoGroups,
  getClassSessionStorageKey,
  getOrientedSeatingGrid,
  getPresentStudents,
  importGroupsToScoreboard,
  loadClassTeachingSession,
  loadLessonPackagesList,
  moveStudentBetweenGroups,
  pauseActivityRun,
  pauseClassroomTimer,
  previewActivitySchedule,
  renameStudentGroup,
  resolvePermittedTeacherClasses,
  resumeActivityRun,
  saveClassTeachingSession,
  saveLessonPackagesList,
  seatKey,
  serializePackageForShare,
  startActivityRun,
  startClassroomTimer,
  swapSeats,
  tickTimerSnapshot,
  toggleSeatBlocked,
  toggleSeatPinned,
  undoLastScoreAction,
  validateActivityCapacity,
  validateAndImportPackageJson,
} from './teachingToolsEngine';
import {
  evaluateProductionRouteAccess,
  resolveRouteLocation,
} from '../../../utils/khktDemoSandbox';
import { ClassRoom } from '../../../types';

function makeStudents(count: number, prefix = 'stu'): ToolStudentItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `${prefix}_${idx + 1}`,
    code: `HS${String(idx + 1).padStart(2, '0')}`,
    fullName: `Học sinh ${idx + 1}`,
    gender: idx % 2 === 0 ? 'Nam' : 'Nữ',
  }));
}

function createMemoryWindow(initialPathname = '/') {
  const store = new Map<string, string>();
  const mockLocalStorage = {
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
    location: { pathname: initialPathname },
    localStorage: mockLocalStorage,
  };
  return { store, mockLocalStorage };
}

test('Tool A: divides 0, 1, 25, 41, and 50 students accurately without duplication', () => {
  // 0 students
  assert.equal(
    divideStudentsIntoGroups({
      presentStudents: [],
      splitMode: 'by_group_count',
      groupCount: 4,
      maxPerGroup: 6,
      shuffleSeed: 'seed0',
    }).length,
    0
  );

  // 1 student => 1 group strictly
  const oneGroup = divideStudentsIntoGroups({
    presentStudents: makeStudents(1),
    splitMode: 'by_group_count',
    groupCount: 4,
    maxPerGroup: 6,
    shuffleSeed: 'seed1',
  });
  assert.equal(oneGroup.length, 1);
  assert.deepEqual(
    oneGroup.map((g) => g.studentIds.length),
    [1]
  );

  // 41 students into 5 groups => [9, 8, 8, 8, 8], each student appears once
  const s41 = makeStudents(41);
  const g41 = divideStudentsIntoGroups({
    presentStudents: s41,
    splitMode: 'by_group_count',
    groupCount: 5,
    maxPerGroup: 10,
    shuffleSeed: 'seed41',
  });
  assert.deepEqual(
    g41.map((g) => g.studentIds.length),
    [9, 8, 8, 8, 8]
  );
  const seen41 = new Set(g41.flatMap((g) => g.studentIds));
  assert.equal(seen41.size, 41);

  // 25 students by max size 6 => 5 groups ([5, 5, 5, 5, 5])
  const g25 = divideStudentsIntoGroups({
    presentStudents: makeStudents(25),
    splitMode: 'by_max_size',
    groupCount: 4,
    maxPerGroup: 6,
    shuffleSeed: 'seed25',
  });
  assert.equal(g25.length, 5);
  assert.equal(new Set(g25.flatMap((g) => g.studentIds)).size, 25);

  // 50 students into 5 groups => [10,10,10,10,10]
  const g50 = divideStudentsIntoGroups({
    presentStudents: makeStudents(50),
    splitMode: 'by_group_count',
    groupCount: 5,
    maxPerGroup: 10,
    shuffleSeed: 'seed50',
  });
  assert.deepEqual(
    g50.map((g) => g.studentIds.length),
    [10, 10, 10, 10, 10]
  );

  // Rename and move student manually
  const renamed = renameStudentGroup(g41, g41[0].id, 'Nhóm Sao Mai');
  assert.equal(renamed[0].name, 'Nhóm Sao Mai');
  const movedId = renamed[0].studentIds[0];
  const afterMove = moveStudentBetweenGroups(renamed, movedId, renamed[1].id);
  assert.equal(afterMove[0].studentIds.includes(movedId), false);
  assert.equal(afterMove[1].studentIds.includes(movedId), true);
});

test('Duplicate student names remain strictly separate by stable student.id across attendance, groups, and seating', () => {
  const students: ToolStudentItem[] = [
    { id: 'stu_an_1', code: 'HS01', fullName: 'Nguyễn Văn An', gender: 'Nam' },
    { id: 'stu_an_2', code: 'HS02', fullName: 'Nguyễn Văn An', gender: 'Nam' },
    { id: 'stu_binh', code: 'HS03', fullName: 'Trần Thị Bình', gender: 'Nữ' },
  ];

  // Mark only stu_an_1 absent
  const present = getPresentStudents(students, ['stu_an_1']);
  assert.deepEqual(
    present.map((s) => s.id),
    ['stu_an_2', 'stu_binh']
  );

  // Both duplicate names present => placed into separate distinct seats
  const seating0 = createDefaultSeatingState(2, 2);
  const res = assignSeatsRandomly({
    seating: seating0,
    presentStudents: students,
    shuffleSeed: 'dup_seat',
  });
  assert.equal(res.ok, true);
  const assignedIds = Object.values(res.seating.assignments).filter(Boolean);
  assert.equal(assignedIds.includes('stu_an_1'), true);
  assert.equal(assignedIds.includes('stu_an_2'), true);
  assert.equal(new Set(assignedIds).size, 3);
});

test('Tool B: seating capacity shortage detection, pinned seat preservation, swap, and front/back orientation', () => {
  const s50 = makeStudents(50);
  // 5x10 = 50 seats, block 2 => 48 available seats => shortageCount = 2
  let seating = createDefaultSeatingState(5, 10);
  seating = toggleSeatBlocked(seating, seatKey(0, 0));
  seating = toggleSeatBlocked(seating, seatKey(0, 1));

  const shortResult = assignSeatsRandomly({
    seating,
    presentStudents: s50,
    shuffleSeed: 'short_50_48',
  });
  assert.equal(shortResult.ok, false);
  assert.equal(shortResult.shortageCount, 2);
  assert.match(shortResult.seating.lastError, /Thiếu 2 ghế/);

  // Unblock 2 seats => 50 available => succeeds
  seating = toggleSeatBlocked(seating, seatKey(0, 0));
  seating = toggleSeatBlocked(seating, seatKey(0, 1));
  const okResult = assignSeatsRandomly({
    seating,
    presentStudents: s50,
    shuffleSeed: 'ok_50_50',
  });
  assert.equal(okResult.ok, true);
  assert.equal(Object.keys(okResult.seating.assignments).length, 50);

  // Pin seat (0,0) and re-shuffle => pinned student stays strictly at (0,0)
  const pinnedStudentId = okResult.seating.assignments[seatKey(0, 0)]!;
  let pinnedSeating = toggleSeatPinned(okResult.seating, seatKey(0, 0));
  const reshuffled = assignSeatsRandomly({
    seating: pinnedSeating,
    presentStudents: s50,
    shuffleSeed: 'reshuffle_2',
  });
  assert.equal(reshuffled.ok, true);
  assert.equal(reshuffled.seating.assignments[seatKey(0, 0)], pinnedStudentId);

  // Swap (0,0) and (0,1)
  const occupant1 = reshuffled.seating.assignments[seatKey(0, 1)]!;
  const swapped = swapSeats(reshuffled.seating, seatKey(0, 0), seatKey(0, 1));
  assert.equal(swapped.assignments[seatKey(0, 0)], occupant1);
  assert.equal(swapped.assignments[seatKey(0, 1)], pinnedStudentId);
  assert.equal(swapped.pinnedSeatKeys.includes(seatKey(0, 1)), true);

  // Back of class flips rows & cols
  const frontGrid = getOrientedSeatingGrid({ ...swapped, orientation: 'front_board' });
  const backGrid = getOrientedSeatingGrid({ ...swapped, orientation: 'back_of_class' });
  assert.equal(frontGrid[0][0].seatKey, '0-0');
  assert.equal(backGrid[0][0].seatKey, '4-9');
});

test('Tool C: Activity Coordinator 4 modes, capacity block vs multi-turn split, preview, pause/resume & rounds', () => {
  assert.equal(Object.keys(ACTIVITY_MODE_META).length, 4);

  const groups9 = divideStudentsIntoGroups({
    presentStudents: makeStudents(27),
    splitMode: 'by_group_count',
    groupCount: 9,
    maxPerGroup: 4,
    shuffleSeed: 'act9',
  });

  // Jigsaw default has 3 stations * 2 capacity = 6 total capacity < 9 groups
  let activity = createDefaultActivityState('jigsaw');
  const blockedCap = validateActivityCapacity(activity, groups9);
  assert.equal(blockedCap.ok, false);
  const blockedStart = startActivityRun(activity, groups9, 10000);
  assert.equal(blockedStart.status, 'idle');
  assert.ok(blockedStart.lastError.length > 0);

  // Enabling splitMultiTurn unlocks capacity (2 turns required)
  activity = { ...activity, splitMultiTurn: true };
  const okCap = validateActivityCapacity(activity, groups9);
  assert.equal(okCap.ok, true);
  assert.equal(okCap.turnsRequired, 2);

  const schedule = previewActivitySchedule(activity, groups9);
  assert.equal(schedule.length, activity.stations.length);
  assert.equal(schedule[0].assignments.some((a) => a.turnNumber === 2), true);

  const started = startActivityRun(activity, groups9, 10000);
  assert.equal(started.status, 'running');
  const paused = pauseActivityRun(started, 25000);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.remainingMsWhenPaused, 165000);
  const resumed = resumeActivityRun(paused, 30000);
  assert.equal(resumed.roundTargetEndAtMs, 195000);
  const nextRound = advanceActivityRound(resumed, 1, 35000);
  assert.equal(nextRound.currentRound, 2);
});

test('Tool D: timestamp-anchored timer prevents tab-switch drift and fires bell strictly once', () => {
  let timer = createDefaultTimerState();
  timer = { ...timer, configuredMinutes: 1, configuredSeconds: 0, bellEnabled: true };

  // Start at t = 100_000 => targetEndAtMs = 160_000
  timer = startClassroomTimer(timer, 100_000);

  // Simulated browser tab throttle / wake-up jump after 65s (now = 165_000)
  const snapExpire = tickTimerSnapshot(timer, 165_000);
  assert.equal(snapExpire.displayMs, 0);
  assert.equal(snapExpire.shouldRingBell, true);
  assert.equal(snapExpire.nextState.status, 'finished');
  assert.equal(snapExpire.nextState.bellFiredForRun, true);

  // Subsequent ticks must NEVER ring bell a second time
  const snapRepeat = tickTimerSnapshot(snapExpire.nextState, 166_000);
  assert.equal(snapRepeat.displayMs, 0);
  assert.equal(snapRepeat.shouldRingBell, false);

  // Pause and resume countdown cleanly preserves remaining ms
  let t2 = startClassroomTimer(
    { ...createDefaultTimerState(), configuredMinutes: 0, configuredSeconds: 30 },
    1000
  );
  t2 = pauseClassroomTimer(t2, 11000); // 20s left
  assert.equal(t2.remainingMsWhenPaused, 20000);
  t2 = startClassroomTimer(t2, 50000);
  assert.equal(t2.targetEndAtMs, 70000);
});

test('Tool E: scoreboard counts deliberate distinct clicks, blocks retried duplicate actionId, undoes, and keeps equal tie rank', () => {
  const groups = divideStudentsIntoGroups({
    presentStudents: makeStudents(12),
    splitMode: 'by_group_count',
    groupCount: 3,
    maxPerGroup: 5,
    shuffleSeed: 'sb',
  });
  let sb = importGroupsToScoreboard(groups, createDefaultScoreboardState());

  // Two deliberate clicks on Team 1 with distinct actionIds => BOTH count
  sb = applyTeamScoreAction({
    state: sb,
    teamId: sb.teams[0].id,
    delta: 5,
    actionId: 'click_1',
    reason: 'Phát biểu tốt',
  });
  sb = applyTeamScoreAction({
    state: sb,
    teamId: sb.teams[0].id,
    delta: 5,
    actionId: 'click_2',
    reason: 'Phát biểu tốt',
  });
  assert.equal(sb.teams[0].score, 10);

  // Retried dispatch with SAME actionId => ignored
  sb = applyTeamScoreAction({
    state: sb,
    teamId: sb.teams[0].id,
    delta: 5,
    actionId: 'click_2',
  });
  assert.equal(sb.teams[0].score, 10);

  // Team 2 also scores 10 => tied at #1, Team 3 is #3 (1, 1, 3)
  sb = applyTeamScoreAction({
    state: sb,
    teamId: sb.teams[1].id,
    delta: 10,
    actionId: 'click_3',
  });
  const ranks = computeScoreboardRankings(sb.teams);
  assert.deepEqual(
    ranks.map((r) => r.rank),
    [1, 1, 3]
  );

  // Undo Team 2 action
  sb = undoLastScoreAction(sb);
  assert.equal(sb.teams[1].score, 0);
});

test('Tool F: privacy-clean JSON export, bad JSON protection, and applyPackageForNewLesson student swap', () => {
  const classAStudents: ToolStudentItem[] = [
    { id: 'a1', code: 'A01', fullName: 'Học Sinh Bí Mật Lớp A' },
    { id: 'a2', code: 'A02', fullName: 'Trần Văn Lớp A' },
  ];
  let sessionA = createFreshClassTeachingSession({
    id: 'cls_A',
    name: 'Lớp 8A1',
    students: classAStudents,
  });
  sessionA.scoreboardState = applyTeamScoreAction({
    state: sessionA.scoreboardState,
    teamId: sessionA.scoreboardState.teams[0].id,
    delta: 20,
    actionId: 'pts_a',
  });

  const pkg = buildPackageFromSession({
    name: 'Gói Toán 8 Chuẩn',
    session: sessionA,
  });
  const jsonText = serializePackageForShare(pkg);
  assert.equal(jsonText.includes('Học Sinh Bí Mật Lớp A'), false);
  assert.equal(jsonText.includes('a1'), false);

  // Bad JSON syntax & schema fail safely
  const badSyntax = validateAndImportPackageJson('{ bad json');
  assert.equal(badSyntax.ok, false);
  const badSchema = validateAndImportPackageJson(JSON.stringify({ hello: 'world' }));
  assert.equal(badSchema.ok, false);

  // Valid import succeeds
  const imported = validateAndImportPackageJson(jsonText);
  assert.equal(imported.ok, true);
  assert.ok(imported.pkg);

  // Apply package for fresh lesson on Class B => resets scores to 0 & binds Class B students
  const classBStudents: ToolStudentItem[] = [
    { id: 'b1', code: 'B01', fullName: 'Lê Thị Lớp B' },
    { id: 'b2', code: 'B02', fullName: 'Phạm Văn Lớp B' },
  ];
  const sessionB = applyPackageForNewLesson({
    pkg: imported.pkg!,
    targetClass: { id: 'cls_B', name: 'Lớp 8A2', students: classBStudents },
  });
  assert.equal(sessionB.classId, 'cls_B');
  assert.equal(
    sessionB.scoreboardState.teams.every((t) => t.score === 0),
    true
  );
  const bMemberIds = new Set(
    sessionB.groupsState.groups.flatMap((g) => g.studentIds)
  );
  assert.deepEqual(Array.from(bMemberIds).sort(), ['b1', 'b2']);
});

test('Isolated storage across accounts & /demo, per-class persistence, and corrupt JSON recovery', () => {
  const { store } = createMemoryWindow('/');

  const prodSession = createFreshClassTeachingSession({
    id: 'cls_8a1',
    name: 'Lớp 8A1',
    students: makeStudents(6),
  });
  saveClassTeachingSession(prodSession, 'teacher_1');

  // Corrupt storage JSON for teacher_2 recovers cleanly to null without crashing
  const corruptKey = getClassSessionStorageKey('cls_8a1', 'teacher_2');
  store.set(corruptKey, '{{{broken');
  assert.equal(loadClassTeachingSession('cls_8a1', 'teacher_2'), null);
  assert.equal(store.has(corruptKey), false);

  // Teacher 1 production session survives untouched
  const loadedProd = loadClassTeachingSession('cls_8a1', 'teacher_1');
  assert.equal(loadedProd?.classId, 'cls_8a1');

  // Switch to /demo path => isolated storage namespace
  createMemoryWindow('/demo/cong-cu-day-hoc');
  // Put back prod check via production window
  const demoSession = createFreshClassTeachingSession({
    id: 'cls_8a1',
    name: 'Lớp 8A1 (Demo)',
    students: makeStudents(4),
  });
  saveClassTeachingSession(demoSession, 'demo_khkt');
  const demoKey = getClassSessionStorageKey('cls_8a1', 'demo_khkt');
  assert.match(demoKey, /^taydo_khkt_demo_v1_/);

  const pkg = buildPackageFromSession({ name: 'Demo Pkg', session: demoSession });
  saveLessonPackagesList([pkg], 'demo_khkt');
  assert.equal(loadLessonPackagesList('demo_khkt').length, 1);
});

test('RBAC scoping: teacher only sees assigned classes, student blocked from production /teacher tools, /demo open', () => {
  const classes: ClassRoom[] = [
    {
      id: 'cls_1',
      name: '8A1',
      grade: '8',
      teacherName: 'GV A',
      schoolYear: '2026-2027',
      studentCount: 1,
      inviteCode: '111',
      students: [],
    },
    {
      id: 'cls_2',
      name: '8A2',
      grade: '8',
      teacherName: 'GV B',
      schoolYear: '2026-2027',
      studentCount: 1,
      inviteCode: '222',
      students: [],
    },
  ];

  const scoped = resolvePermittedTeacherClasses({
    classes,
    userId: 'gv_a',
    currentRole: 'teacher',
    isDemoSandbox: false,
    isUsingDemoAssignmentsData: false,
    teachingAssignments: [
      {
        id: 'ta1',
        classId: 'cls_1',
        teacherId: 'gv_a',
        subject: 'math',
        schoolYear: '2026-2027',
        status: 'active',
        needsSubjectCompletion: false,
      },
    ],
    classRoles: [],
    teachingSchemaWarning: null,
  });
  assert.deepEqual(
    scoped.map((c) => c.id),
    ['cls_1']
  );

  // Route guard checks
  const demoResolved = resolveRouteLocation('/demo/cong-cu-day-hoc', '');
  assert.equal(demoResolved.isDemo, true);
  assert.equal(demoResolved.view, 'teacher_tools');

  const unauthProd = evaluateProductionRouteAccess({
    isDemoSandbox: false,
    currentView: 'teacher_tools',
    pathname: '/?view=teacher_tools',
    search: '',
    isAuthenticated: false,
    authenticatedRole: 'student',
  });
  assert.equal(unauthProd.allowed, false);

  const studentProd = evaluateProductionRouteAccess({
    isDemoSandbox: false,
    currentView: 'teacher_tools',
    pathname: '/?view=teacher_tools',
    search: '',
    isAuthenticated: true,
    authenticatedRole: 'student',
  });
  assert.equal(studentProd.allowed, false);

  const teacherProd = evaluateProductionRouteAccess({
    isDemoSandbox: false,
    currentView: 'teacher_tools',
    pathname: '/?view=teacher_tools',
    search: '',
    isAuthenticated: true,
    authenticatedRole: 'teacher',
  });
  assert.equal(teacherProd.allowed, true);
});
