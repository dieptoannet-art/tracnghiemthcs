import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVITY_SAMPLE_PRESETS,
  buildActivityScheduleForState,
  createInitialActivityProSession,
  extractActivityProTemplate,
  formatDurationVietnamese,
  goToActivityPhase,
  hydrateActivityProFromTemplate,
  parseStationsMultiline,
  pauseActivityRun,
  rebuildLockedScheduleWhilePaused,
  resolveWorkingGroups,
  resumeActivityRun,
  startActivityRun,
  tickActivityRun,
} from './activityProEngine';
import {
  StudentGroupItem,
  ToolStudentItem,
  divideStudentsIntoGroups,
  serializePackageForShare,
  validateAndImportPackageJson,
  buildPackageFromSession,
  createFreshClassTeachingSession,
} from './teachingToolsEngine';

function makeStudents(count: number, duplicateFirstTwo = false): ToolStudentItem[] {
  return Array.from({ length: count }, (_, idx) => {
    const code = `HS${String(idx + 1).padStart(3, '0')}`;
    const fullName =
      duplicateFirstTwo && idx < 2 ? 'Nguyễn Văn An' : `Học sinh ${idx + 1}`;
    return { id: `stu_${idx + 1}`, code, fullName };
  });
}

test('Nhóm nguồn: 1 HS, 50 HS, tối đa 12 nhóm, không tạo nhóm rỗng và phân biệt trùng tên theo mã', () => {
  const single = makeStudents(1);
  const singleRes = resolveWorkingGroups({
    sourceConfig: {
      sourceMode: 'quick_split',
      quickGroupCount: 4,
      quickPasteText: '',
      manualGroupCount: 4,
      manualGroupNames: [],
    },
    dividerGroups: [],
    presentStudents: single,
  });
  assert.equal(singleRes.groups.length, 1);
  assert.equal(singleRes.groups[0].members.length, 1);
  assert.ok(singleRes.warnings.length > 0);

  const fifty = makeStudents(50, true);
  const fiftyRes = resolveWorkingGroups({
    sourceConfig: {
      sourceMode: 'quick_split',
      quickGroupCount: 12,
      quickPasteText: '',
      manualGroupCount: 12,
      manualGroupNames: [],
    },
    dividerGroups: [],
    presentStudents: fifty,
  });
  assert.equal(fiftyRes.groups.length, 12);
  assert.equal(
    fiftyRes.groups.reduce((acc, g) => acc + g.members.length, 0),
    50
  );
  // Duplicate names carry student code in displayName
  const allDisplay = fiftyRes.groups.flatMap((g) => g.members.map((m) => m.displayName));
  assert.ok(allDisplay.includes('Nguyễn Văn An (HS001)'));
  assert.ok(allDisplay.includes('Nguyễn Văn An (HS002)'));
});

test('Dạy học theo trạm: 6 nhóm / 6 trạm / 7p / 30s chuyển = 11 pha, 44p30s, không va chạm', () => {
  const base = createInitialActivityProSession({
    classId: 'cls_8a1',
    className: 'Lớp 8A1',
  });
  const preset1 = ACTIVITY_SAMPLE_PRESETS.find((p) => p.id === 'preset_stations_6_groups')!;
  const session = preset1.apply(base);

  const { groups, schedule } = buildActivityScheduleForState({
    session,
    dividerGroups: [],
    presentStudents: [],
  });

  assert.equal(groups.length, 6);
  assert.equal(schedule.canStart, true);
  assert.equal(schedule.totalRounds, 6);
  assert.equal(schedule.totalPhases, 11); // 6 work + 5 transitions (none after final round)
  assert.equal(schedule.totalDurationSeconds, 2670); // 44m30s
  assert.equal(formatDurationVietnamese(schedule.totalDurationSeconds), '44 phút 30 giây');

  // Verify every group visits all 6 stations once, no collisions
  const matrix = schedule.stationMatrix!;
  assert.equal(matrix.length, 6);
  for (const round of matrix) {
    const seenStations = new Set(round.assignments.map((a) => a.stationId));
    assert.equal(seenStations.size, 6);
  }
  for (const g of groups) {
    const visitedByGroup = new Set(
      matrix.map((r) => r.assignments.find((a) => a.groupId === g.id)!.stationId)
    );
    assert.equal(visitedByGroup.size, 6);
  }
});

test('Dạy học theo trạm: parse dán nhanh + chia lượt chờ khi vượt tổng sức chứa không làm mất lượt trạm', () => {
  const parsed = parseStationsMultiline(
    'Trạm Quan sát: Quan sát thí nghiệm và ghi kết quả\nTrạm Tính toán: Giải 3 bài tập'
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'Trạm Quan sát');
  assert.equal(parsed[0].task, 'Quan sát thí nghiệm và ghi kết quả');

  const base = createInitialActivityProSession({
    classId: 'cls_wait',
    className: 'Lớp Test Chờ',
  });
  // 5 groups, 2 stations capacity 1 each = max 2 groups active per round
  const blockedSession = {
    ...base,
    mode: 'station_rotation' as const,
    groupSource: {
      ...base.groupSource,
      sourceMode: 'names_only' as const,
      manualGroupCount: 5,
      manualGroupNames: ['N1', 'N2', 'N3', 'N4', 'N5'],
    },
    stationConfig: {
      stations: parsed,
      workSeconds: 180,
      transitionSeconds: 0,
      allowWaitingTurns: false,
    },
  };
  const blockedBuild = buildActivityScheduleForState({
    session: blockedSession,
    dividerGroups: [],
    presentStudents: [],
  });
  assert.equal(blockedBuild.schedule.canStart, false);

  const allowedSession = {
    ...blockedSession,
    stationConfig: { ...blockedSession.stationConfig, allowWaitingTurns: true },
  };
  const allowedBuild = buildActivityScheduleForState({
    session: allowedSession,
    dividerGroups: [],
    presentStudents: [],
  });
  assert.equal(allowedBuild.schedule.canStart, true);
  const matrix = allowedBuild.schedule.stationMatrix!;
  // Every group completes both real stations (waiting rounds do NOT count as station completion!)
  for (let gIdx = 0; gIdx < 5; gIdx++) {
    const grpId = `grp_named_${gIdx + 1}`;
    const realStations = new Set(
      matrix
        .map((r) => r.assignments.find((a) => a.groupId === grpId)!)
        .filter((a) => !a.isWaiting)
        .map((a) => a.stationId)
    );
    assert.equal(realStations.size, 2);
  }
});

test('Mảnh ghép: 24 HS, 6 nhóm, 4 chủ đề (10p+1p+12p) = 3 pha, 23 phút, 6 HS/nhóm chuyên gia', () => {
  const base = createInitialActivityProSession({
    classId: 'cls_jig',
    className: 'Lớp 8A2',
  });
  const preset2 = ACTIVITY_SAMPLE_PRESETS.find((p) => p.id === 'preset_jigsaw_24hs')!;
  const session = preset2.apply(base);

  const { groups, schedule } = buildActivityScheduleForState({
    session,
    dividerGroups: [],
    presentStudents: [],
  });

  assert.equal(groups.length, 6);
  assert.equal(schedule.canStart, true);
  assert.equal(schedule.totalPhases, 3);
  assert.equal(schedule.totalDurationSeconds, 1380); // 23 minutes
  const expertPhase = schedule.phases[0];
  assert.equal(expertPhase.cards.length, 4);
  for (const card of expertPhase.cards) {
    assert.equal(card.members!.length, 6);
  }
});

test('Mảnh ghép: cảnh báo thiếu thành viên khi < số chủ đề & hỗ trợ đóng vai kép không trùng phòng', () => {
  const students = makeStudents(15); // 5 groups x 3 members, 4 topics
  const dividerGroups = divideStudentsIntoGroups({
    presentStudents: students,
    splitMode: 'by_group_count',
    groupCount: 5,
    maxPerGroup: 3,
    shuffleSeed: 'jig_short',
  });
  const base = createInitialActivityProSession({
    classId: 'cls_jig_short',
    className: 'Lớp Thiếu Người',
    dividerGroups,
    presentStudents: students,
  });
  const sessionBlocked = {
    ...base,
    mode: 'jigsaw' as const,
    jigsawConfig: { ...base.jigsawConfig, allowDualExpertRole: false },
  };
  const blocked = buildActivityScheduleForState({
    session: sessionBlocked,
    dividerGroups,
    presentStudents: students,
  });
  assert.equal(blocked.schedule.canStart, false);
  assert.equal(blocked.schedule.jigsawMissingTopicsInfo?.recommendedMaxTopics, 3);

  const sessionDual = {
    ...sessionBlocked,
    jigsawConfig: { ...sessionBlocked.jigsawConfig, allowDualExpertRole: true },
  };
  const dual = buildActivityScheduleForState({
    session: sessionDual,
    dividerGroups,
    presentStudents: students,
  });
  assert.equal(dual.schedule.canStart, true);
  // Dual-role creates 2 separate expert phases so no student appears in 2 rooms simultaneously
  const expertPhases = dual.schedule.phases.filter((p) => p.kind === 'jigsaw_expert');
  assert.equal(expertPhases.length, 2);
  for (const ep of expertPhases) {
    const seenInTurn = new Set<string>();
    for (const card of ep.cards) {
      for (const m of card.members || []) {
        assert.equal(seenInTurn.has(m.id), false);
        seenInTurn.add(m.id);
      }
    }
  }
});

test('Khăn trải bàn: số ô cá nhân khớp sĩ số từng nhóm, ô trung tâm khóa ở Pha 1 và mở ở Pha 2 (10 phút)', () => {
  const base = createInitialActivityProSession({
    classId: 'cls_tc',
    className: 'Lớp TC',
  });
  const preset3 = ACTIVITY_SAMPLE_PRESETS.find((p) => p.id === 'preset_tablecloth_10m')!;
  const session = preset3.apply(base);
  const { schedule } = buildActivityScheduleForState({
    session,
    dividerGroups: [],
    presentStudents: [],
  });
  assert.equal(schedule.totalPhases, 2);
  assert.equal(schedule.totalDurationSeconds, 600);
  assert.equal(schedule.phases[0].cards[0].meta?.centerLocked, true);
  assert.equal(schedule.phases[1].cards[0].meta?.centerLocked, false);
});

test('Phòng tranh: 6 nhóm, 4p lượt, 30s chuyển, 2p tổng hợp cuối = 5 lượt, 10 pha, 24 phút, không xem tranh mình', () => {
  const base = createInitialActivityProSession({
    classId: 'cls_gal',
    className: 'Lớp PT',
  });
  const preset4 = ACTIVITY_SAMPLE_PRESETS.find((p) => p.id === 'preset_gallery_6_groups')!;
  const session = preset4.apply(base);
  const { groups, schedule } = buildActivityScheduleForState({
    session,
    dividerGroups: [],
    presentStudents: [],
  });

  assert.equal(schedule.canStart, true);
  assert.equal(schedule.galleryMatrix!.length, 5);
  assert.equal(schedule.totalPhases, 10); // 5 visit + 4 trans + 1 final review
  assert.equal(schedule.totalDurationSeconds, 1440); // 24 minutes

  // Never visits own product; visits all 5 others
  for (const grp of groups) {
    const visitedTargets = new Set<string>();
    for (const r of schedule.galleryMatrix!) {
      const visit = r.visits.find((v) => v.visitingGroupId === grp.id)!;
      assert.notEqual(visit.targetGroupId, grp.id);
      visitedTargets.add(visit.targetGroupId);
    }
    assert.equal(visitedTargets.size, 5);
  }
});

test('Đồng hồ thực, tạm dừng, ngủ/tỉnh lại không bắn chuông chồng và khóa chống nhảy đúp pha', () => {
  const base = createInitialActivityProSession({
    classId: 'cls_clk',
    className: 'Lớp Clock',
  });
  const preset1 = ACTIVITY_SAMPLE_PRESETS.find((p) => p.id === 'preset_stations_6_groups')!;
  const ready = { ...preset1.apply(base), autoAdvance: true, bellMuted: false };

  const t0 = 1_000_000;
  const started = startActivityRun({
    session: ready,
    dividerGroups: [],
    presentStudents: [],
    nowMs: t0,
  }).nextState;

  // Sleep 460s -> skips past Pha 1 (420s) + Transition 1 (30s) -> lands cleanly in Pha 3 (420s - 10s = 410s left!)
  const wake = tickActivityRun(started, t0 + 460_000);
  assert.equal(wake.phaseChanged, true);
  assert.equal(wake.nextState.currentPhaseIndex, 2);
  assert.equal(wake.displaySeconds, 410);
  assert.equal(wake.shouldRingBell, true);

  // Immediately calling tick again in same ms does NOT ring bell again!
  const secondTick = tickActivityRun(wake.nextState, t0 + 460_050);
  assert.equal(secondTick.shouldRingBell, false);

  // Race guard: manual phase jump with stale token is rejected!
  const paused = pauseActivityRun(wake.nextState, t0 + 465_000);
  const resumed = resumeActivityRun(paused, t0 + 500_000);
  const tokenNow = resumed.activePhaseToken;
  const moved1 = goToActivityPhase({
    session: resumed,
    targetPhaseIndex: resumed.currentPhaseIndex + 1,
    expectedToken: tokenNow,
    nowMs: t0 + 501_000,
  });
  assert.equal(moved1.currentPhaseIndex, 3);
  const staleMove = goToActivityPhase({
    session: moved1,
    targetPhaseIndex: moved1.currentPhaseIndex + 1,
    expectedToken: tokenNow,
    nowMs: t0 + 501_010,
  });
  assert.equal(staleMove.currentPhaseIndex, 3);
});

test('Chốt snapshot nhóm khi đang chạy: sửa Chia nhóm không tự làm đổi lịch đang chạy', () => {
  const students = makeStudents(12);
  const groupsA: StudentGroupItem[] = divideStudentsIntoGroups({
    presentStudents: students,
    splitMode: 'by_group_count',
    groupCount: 3,
    maxPerGroup: 4,
    shuffleSeed: 'seed_a',
  });
  const base = createInitialActivityProSession({
    classId: 'cls_iso',
    className: 'Lớp Cô Lập',
    dividerGroups: groupsA,
    presentStudents: students,
  });
  const started = startActivityRun({
    session: base,
    dividerGroups: groupsA,
    presentStudents: students,
    nowMs: 1000,
  }).nextState;

  assert.equal(started.lockedGroupsSnapshot!.length, 3);

  // Divider silently changes to 6 groups
  const groupsB = divideStudentsIntoGroups({
    presentStudents: students,
    splitMode: 'by_group_count',
    groupCount: 6,
    maxPerGroup: 2,
    shuffleSeed: 'seed_b',
  });

  // Active schedule remains locked at 3 groups!
  assert.equal(started.lockedGroupsSnapshot!.length, 3);

  // Only explicit pause + rebuild updates locked snapshot to 6 groups
  const paused = pauseActivityRun(started, 2000);
  const rebuilt = rebuildLockedScheduleWhilePaused({
    session: paused,
    dividerGroups: groupsB,
    presentStudents: students,
    nowMs: 2500,
  }).nextState;
  assert.equal(rebuilt.lockedGroupsSnapshot!.length, 6);
});

test('Gói tiết dạy tách danh sách HS lớp cũ và nạp lại từ Pha 1 cho lớp mới', () => {
  const classAStudents = makeStudents(8);
  const baseA = createInitialActivityProSession({
    classId: 'cls_a',
    className: 'Lớp 8A1',
    presentStudents: classAStudents,
  });
  const modifiedA = {
    ...baseA,
    mode: 'tablecloth' as const,
    groupSource: {
      ...baseA.groupSource,
      sourceMode: 'quick_split' as const,
      quickPasteText: 'Học sinh Lớp A Riêng',
    },
    tableclothConfig: {
      ...baseA.tableclothConfig,
      sharedPrompt: 'Câu hỏi dùng chung cho mọi lớp',
    },
  };
  const template = extractActivityProTemplate(modifiedA);
  const dummySessionA = createFreshClassTeachingSession({
    id: 'cls_a',
    name: 'Lớp 8A1',
    students: classAStudents,
  });
  const pkg = buildPackageFromSession({
    name: 'Gói Khăn trải bàn chuẩn',
    session: dummySessionA,
    activityProTemplate: template,
  });
  const json = serializePackageForShare(pkg);
  assert.equal(json.includes('Học sinh Lớp A Riêng'), false);

  const imported = validateAndImportPackageJson(json);
  assert.equal(imported.ok, true);

  const classBStudents = makeStudents(16);
  const classBGroups = divideStudentsIntoGroups({
    presentStudents: classBStudents,
    splitMode: 'by_group_count',
    groupCount: 4,
    maxPerGroup: 4,
  });
  const hydratedB = hydrateActivityProFromTemplate({
    template: imported.pkg!.config.activityProTemplate!,
    targetClassId: 'cls_b',
    targetClassName: 'Lớp 8A2',
    dividerGroups: classBGroups,
    presentStudents: classBStudents,
  });

  assert.equal(hydratedB.status, 'idle');
  assert.equal(hydratedB.currentPhaseIndex, 0);
  assert.equal(hydratedB.groupSource.quickPasteText, '');
  assert.equal(hydratedB.tableclothConfig.sharedPrompt, 'Câu hỏi dùng chung cho mọi lớp');
});
