import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Dices,
  FolderOpen,
  Gamepad2,
  LayoutGrid,
  Package,
  RefreshCw,
  Sparkles,
  Square,
  Timer,
  Trophy,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { ClassRoom } from '../../../types';
import {
  loadEduGameMuted,
  saveEduGameMuted,
} from '../../../utils/eduGameAudioController';
import imgGroupDivider from '../../../assets/images/tool_group_divider_3d_1795354459717.jpg';
import imgSeatingChart from '../../../assets/images/tool_seating_chart_3d_1795354463646.jpg';
import imgActivityCoordinator from '../../../assets/images/tool_activity_coordinator_3d_1795354463402.jpg';
import imgClassroomTimer from '../../../assets/images/tool_classroom_timer_3d_1795354464219.jpg';
import imgTeamScoreboard from '../../../assets/images/tool_team_scoreboard_3d_1795354462621.jpg';
import imgLessonPackage from '../../../assets/images/tool_lesson_package_3d_1795354463691.jpg';
import imgQuestionBank from '../../../assets/images/tool_question_bank_3d_1795355621615.jpg';
import imgReviewGames from '../../../assets/images/tool_review_games_3d_1795355621558.jpg';
import imgQuickActivities from '../../../assets/images/tool_quick_activities_3d_1795355621312.jpg';
import {
  ACTIVITY_MODE_META,
  ClassTeachingSessionState,
  LessonPackageItem,
  TeachingToolId,
  ToolStudentItem,
  applyPackageForNewLesson,
  createFreshClassTeachingSession,
  formatTimerClock,
  getAvailableSeatKeys,
  loadClassTeachingSession,
  loadLessonPackagesList,
  resolvePermittedTeacherClasses,
  saveClassTeachingSession,
  saveLessonPackagesList,
  tickTimerSnapshot,
} from './teachingToolsEngine';
import {
  ToolQuestionSet,
  loadToolQuestionSets,
  saveToolQuestionSets,
} from './questionBankEngine';
import { createDefaultQuickActivityState } from './quickActivitiesEngine';
import {
  ReviewGameSessionState,
  clearReviewGameSession,
  loadReviewGameSession,
  transferReviewScoresToScoreboard,
} from './reviewGamesEngine';
import { GroupDividerTool } from './GroupDividerTool';
import { SeatingChartTool } from './SeatingChartTool';
import { ActivityCoordinatorTool } from './ActivityCoordinatorTool';
import { ClassroomTimerTool } from './ClassroomTimerTool';
import { TeamScoreboardTool } from './TeamScoreboardTool';
import { LessonPackageTool } from './LessonPackageTool';
import { ToolQuestionBankPanel } from './ToolQuestionBankPanel';
import { ReviewGamesStudio } from './ReviewGamesStudio';
import { QuickActivitiesTool } from './QuickActivitiesTool';

interface ToolCardMeta {
  id: TeachingToolId;
  code: string;
  title: string;
  subtitle: string;
  image: string;
  icon: React.ComponentType<{ className?: string }>;
  accentBg: string;
}

const TOOL_CARDS: ToolCardMeta[] = [
  {
    id: 'groups',
    code: 'A',
    title: 'Chia nhóm học sinh',
    subtitle: 'Chia đều theo số nhóm hoặc sĩ số tối đa, đổi tên nhóm và kéo chuyển thành viên.',
    image: imgGroupDivider,
    icon: Users,
    accentBg: 'from-[#0F3C78] to-[#1D4ED8]',
  },
  {
    id: 'seating',
    code: 'B',
    title: 'Sơ đồ chỗ ngồi',
    subtitle: 'Thiết lập hàng × cột, ghế trống, ghim chỗ cố định, đổi chỗ và bản in lớp học.',
    image: imgSeatingChart,
    icon: LayoutGrid,
    accentBg: 'from-[#0E4A6B] to-[#0284C7]',
  },
  {
    id: 'activity',
    code: 'C',
    title: 'Điều phối hoạt động nhóm',
    subtitle: 'Luân chuyển trạm, Mảnh ghép, Khăn trải bàn, Phòng tranh kèm lịch vòng và đồng hồ.',
    image: imgActivityCoordinator,
    icon: RefreshCw,
    accentBg: 'from-[#0B5345] to-[#047857]',
  },
  {
    id: 'timer',
    code: 'D',
    title: 'Đồng hồ lớp học',
    subtitle: 'Đếm ngược và bấm giờ chuẩn xác theo mốc thời gian thực, chuông báo và toàn màn hình.',
    image: imgClassroomTimer,
    icon: Timer,
    accentBg: 'from-[#6C3483] to-[#6D28D9]',
  },
  {
    id: 'scoreboard',
    code: 'E',
    title: 'Bảng điểm đội',
    subtitle: 'Cộng trừ nhanh kèm lý do, hoàn tác tức thì, giữ đồng hạng và màn hình trình chiếu.',
    image: imgTeamScoreboard,
    icon: Trophy,
    accentBg: 'from-[#9A3412] to-[#D97706]',
  },
  {
    id: 'packages',
    code: 'F',
    title: 'Gói tiết dạy',
    subtitle: 'Lưu cấu hình chuẩn, nhân bản, xuất/nhập JSON tách biệt danh sách lớp để tái sử dụng.',
    image: imgLessonPackage,
    icon: Package,
    accentBg: 'from-[#1E293B] to-[#334155]',
  },
  {
    id: 'question_bank',
    code: 'G',
    title: 'Ngân hàng câu hỏi',
    subtitle: 'Soạn 1 bộ dùng chung, nhập nhanh từ Excel/CSV hoặc PDF kèm bảng đáp án, giữ công thức Toán.',
    image: imgQuestionBank,
    icon: BookOpen,
    accentBg: 'from-[#0F3C78] to-[#0284C7]',
  },
  {
    id: 'review_games',
    code: 'H',
    title: 'Trò chơi ôn tập',
    subtitle: 'Chạy 1 bộ câu hỏi qua Mở mảnh ghép, Đường đua, Rung chuông vàng và chuyển điểm về lớp.',
    image: imgReviewGames,
    icon: Gamepad2,
    accentBg: 'from-[#1E3A8A] to-[#6D28D9]',
  },
  {
    id: 'quick_activities',
    code: 'I',
    title: 'Hoạt động nhanh',
    subtitle: 'Ghép cặp học sinh thông minh (kể cả sĩ số lẻ) và bốc thử thách trực quan trên máy chiếu.',
    image: imgQuickActivities,
    icon: Sparkles,
    accentBg: 'from-[#0B5345] to-[#0D9488]',
  },
];

function buildDemoSampleRoster(
  prefix: string,
  count: number,
  includeDuplicateNames: boolean
): ClassRoom['students'] {
  const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Phan', 'Đặng', 'Bùi', 'Đỗ'];
  const middles = ['Văn', 'Minh', 'Ngọc', 'Thanh', 'Gia', 'Bảo', 'Hoàng', 'Phương'];
  const firstNames = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hiếu', 'Hương', 'Khang', 'Linh', 'Mai', 'Nam', 'Nhi', 'Quân', 'Thảo', 'Trang'];

  const out: ClassRoom['students'] = [];
  for (let i = 0; i < count; i++) {
    const stt = String(i + 1).padStart(2, '0');
    let fullName = `${surnames[i % surnames.length]} ${middles[(i * 3) % middles.length]} ${firstNames[(i * 5) % firstNames.length]}`;
    if (includeDuplicateNames && (i === 0 || i === 1)) {
      fullName = 'Nguyễn Văn An';
    }
    out.push({
      id: `${prefix}-stu-${stt}`,
      code: `HS${stt}`,
      fullName,
      email: '',
      gender: i % 2 === 0 ? 'Nam' : 'Nữ',
    });
  }
  return out;
}

function buildDemoPresetClasses(): ClassRoom[] {
  return [
    {
      id: 'demo-tool-sample-41',
      name: 'Lớp Mẫu 41 HS (Thử chia nhóm)',
      grade: '8',
      teacherName: 'Giáo viên Demo',
      studentCount: 41,
      inviteCode: 'DEMO-41',
      students: buildDemoSampleRoster('d41', 41, true),
    },
    {
      id: 'demo-tool-sample-50',
      name: 'Lớp Mẫu 50 HS (Trùng tên)',
      grade: '8',
      teacherName: 'Giáo viên Demo',
      studentCount: 50,
      inviteCode: 'DEMO-50',
      students: buildDemoSampleRoster('d50', 50, true),
    },
    {
      id: 'demo-tool-sample-25',
      name: 'Lớp Mẫu 25 HS',
      grade: '7',
      teacherName: 'Giáo viên Demo',
      studentCount: 25,
      inviteCode: 'DEMO-25',
      students: buildDemoSampleRoster('d25', 25, false),
    },
    {
      id: 'demo-tool-sample-01',
      name: 'Lớp Mẫu 1 HS (Biên tối thiểu)',
      grade: '6',
      teacherName: 'Giáo viên Demo',
      studentCount: 1,
      inviteCode: 'DEMO-01',
      students: buildDemoSampleRoster('d01', 1, false),
    },
    {
      id: 'demo-tool-sample-00',
      name: 'Lớp Mẫu Trống (0 HS)',
      grade: '6',
      teacherName: 'Giáo viên Demo',
      studentCount: 0,
      inviteCode: 'DEMO-00',
      students: [],
    },
  ];
}

function toToolStudents(cls: ClassRoom | null | undefined): ToolStudentItem[] {
  if (!cls || !Array.isArray(cls.students)) return [];
  return cls.students.map((st, idx) => ({
    id: st.id || `${cls.id}_idx_${idx + 1}`,
    code: st.code || String(idx + 1).padStart(2, '0'),
    fullName: st.fullName || `Học sinh ${idx + 1}`,
    gender: st.gender,
  }));
}

export const TeachingToolsHub: React.FC = () => {
  const {
    classes,
    questions,
    user,
    currentRole,
    isDemoSandbox,
    isUsingDemoAssignmentsData,
    teachingAssignments,
    classRoles,
    teachingSchemaWarning,
    openGameCenterTool,
  } = useApp();

  const accountScopeId = isDemoSandbox ? 'demo_khkt' : (user?.id || 'guest_teacher');

  const permittedClasses = useMemo(
    () =>
      resolvePermittedTeacherClasses({
        classes,
        userId: user?.id,
        currentRole,
        isDemoSandbox,
        isUsingDemoAssignmentsData,
        teachingAssignments,
        classRoles,
        teachingSchemaWarning,
      }),
    [
      classes,
      user?.id,
      currentRole,
      isDemoSandbox,
      isUsingDemoAssignmentsData,
      teachingAssignments,
      classRoles,
      teachingSchemaWarning,
    ]
  );

  const demoPresetClasses = useMemo(
    () => (isDemoSandbox ? buildDemoPresetClasses() : []),
    [isDemoSandbox]
  );

  const availableClasses = useMemo(
    () => [...permittedClasses, ...demoPresetClasses],
    [permittedClasses, demoPresetClasses]
  );

  const [selectedClassId, setSelectedClassId] = useState<string>(
    () => availableClasses[0]?.id || ''
  );

  useEffect(() => {
    if (availableClasses.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!availableClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  const activeClass = useMemo(
    () => availableClasses.find((c) => c.id === selectedClassId) || null,
    [availableClasses, selectedClassId]
  );

  const activeStudents = useMemo(() => toToolStudents(activeClass), [activeClass]);

  const [session, setSession] = useState<ClassTeachingSessionState | null>(null);
  const [hasSavedSessionForClass, setHasSavedSessionForClass] = useState<boolean>(false);
  const [savedPackages, setSavedPackages] = useState<LessonPackageItem[]>(() =>
    loadLessonPackagesList(accountScopeId)
  );
  const [questionSets, setQuestionSets] = useState<ToolQuestionSet[]>(() =>
    loadToolQuestionSets(accountScopeId)
  );
  const [activeTool, setActiveTool] = useState<TeachingToolId | null>(null);
  const [showAttendancePanel, setShowAttendancePanel] = useState<boolean>(false);
  const [isMutedGlobal, setIsMutedGlobal] = useState<boolean>(() => loadEduGameMuted(false));
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [bannerNote, setBannerNote] = useState<string>('');

  useEffect(() => {
    setSavedPackages(loadLessonPackagesList(accountScopeId));
    setQuestionSets(loadToolQuestionSets(accountScopeId));
  }, [accountScopeId]);

  useEffect(() => {
    if (!activeClass) {
      setSession(null);
      setHasSavedSessionForClass(false);
      return;
    }
    const existing = loadClassTeachingSession(activeClass.id, accountScopeId);
    if (existing) {
      setSession(existing);
      setHasSavedSessionForClass(true);
    } else {
      const fresh = createFreshClassTeachingSession({
        id: activeClass.id,
        name: activeClass.name,
        students: toToolStudents(activeClass),
      });
      setSession(fresh);
      setHasSavedSessionForClass(false);
    }
  }, [activeClass?.id, accountScopeId]);

  const commitSession = useCallback(
    (next: ClassTeachingSessionState) => {
      const stamped: ClassTeachingSessionState = {
        ...next,
        updatedAtMs: Date.now(),
      };
      setSession(stamped);
      saveClassTeachingSession(stamped, accountScopeId);
      setHasSavedSessionForClass(true);
    },
    [accountScopeId]
  );

  const handleToggleMuteGlobal = () => {
    const next = !isMutedGlobal;
    setIsMutedGlobal(next);
    saveEduGameMuted(next);
  };

  const handleToggleStudentAbsent = (studentId: string) => {
    if (!session) return;
    const isCurrentlyAbsent = session.absentStudentIds.includes(studentId);
    const nextAbsentIds = isCurrentlyAbsent
      ? session.absentStudentIds.filter((id) => id !== studentId)
      : [...session.absentStudentIds, studentId];

    // Remove newly-absent student from seating/groups to keep active rosters valid
    const nextGroups = !isCurrentlyAbsent
      ? {
          ...session.groupsState,
          groups: session.groupsState.groups.map((g) => ({
            ...g,
            studentIds: g.studentIds.filter((id) => id !== studentId),
          })),
        }
      : session.groupsState;

    let nextAssignments = session.seatingState.assignments;
    if (!isCurrentlyAbsent) {
      nextAssignments = { ...session.seatingState.assignments };
      for (const [k, v] of Object.entries(nextAssignments)) {
        if (v === studentId) nextAssignments[k] = null;
      }
    }

    commitSession({
      ...session,
      absentStudentIds: nextAbsentIds,
      groupsState: nextGroups,
      seatingState: {
        ...session.seatingState,
        assignments: nextAssignments,
      },
    });
  };

  const handleMarkAllPresent = () => {
    if (!session) return;
    commitSession({
      ...session,
      absentStudentIds: [],
    });
  };

  const handleLaunchCallStudentA01 = () => {
    const isAppContextClass = Boolean(
      activeClass && classes.some((c) => c.id === activeClass.id)
    );
    openGameCenterTool('a01', isAppContextClass && activeClass ? activeClass.id : undefined);
  };

  const handleSavePackagesList = (nextPackages: LessonPackageItem[]) => {
    setSavedPackages(nextPackages);
    saveLessonPackagesList(nextPackages, accountScopeId);
  };

  const handleSaveQuestionSets = (nextSets: ToolQuestionSet[]) => {
    setQuestionSets(nextSets);
    saveToolQuestionSets(nextSets, accountScopeId);
  };

  const handleStartReviewGameWithSet = (setId: string) => {
    if (session) {
      commitSession({
        ...session,
        pendingReviewGamePrefill: {
          questionSetId: setId,
          mode: session.pendingReviewGamePrefill?.mode || 'puzzle',
          secondsPerQuestion: session.pendingReviewGamePrefill?.secondsPerQuestion ?? 30,
          pointsPerCorrect: session.pendingReviewGamePrefill?.pointsPerCorrect ?? 10,
          turnRule: session.pendingReviewGamePrefill?.turnRule || 'rotate_every_question',
        },
      });
    }
    setActiveTool('review_games');
  };

  const handleOpenClassicEduGame = (gameId: string) => {
    const isAppContextClass = Boolean(
      activeClass && classes.some((c) => c.id === activeClass.id)
    );
    openGameCenterTool(gameId, isAppContextClass && activeClass ? activeClass.id : undefined);
  };

  const handleTransferReviewScores = (reviewSession: ReviewGameSessionState) => {
    if (!session || !activeClass) {
      return {
        ok: false,
        alreadyTransferred: false,
        error: 'Chưa có phiên lớp học hiện tại.',
        nextReviewSession: reviewSession,
        transferredTeamCount: 0,
      };
    }
    const res = transferReviewScoresToScoreboard({
      reviewSession,
      targetClassId: activeClass.id,
      scoreboard: session.scoreboardState,
      transferredReviewSessionIds: session.transferredReviewSessionIds || [],
    });
    if (res.ok) {
      commitSession({
        ...session,
        scoreboardState: res.nextScoreboard,
        transferredReviewSessionIds: res.nextTransferredIds,
      });
    }
    return res;
  };

  const handleApplyPackageFresh = (pkg: LessonPackageItem) => {
    if (!activeClass || !session) return;
    if (pkg.config.embeddedQuestionSet) {
      const exists = questionSets.some((q) => q.id === pkg.config.embeddedQuestionSet?.id);
      if (!exists) {
        const merged = [pkg.config.embeddedQuestionSet, ...questionSets];
        handleSaveQuestionSets(merged);
      }
    }
    clearReviewGameSession(activeClass.id, accountScopeId);

    const absentSet = new Set(session.absentStudentIds);
    const presentList = activeStudents.filter((s) => !absentSet.has(s.id));
    const freshFromPkg = applyPackageForNewLesson({
      pkg,
      targetClass: {
        id: activeClass.id,
        name: activeClass.name,
        students: presentList,
      },
    });
    commitSession({
      ...freshFromPkg,
      absentStudentIds: session.absentStudentIds,
    });
    setBannerNote(`Đã áp dụng gói "${pkg.name}" cho tiết mới của ${activeClass.name} (đã đặt lại điểm về 0).`);
  };

  const handleResumeSavedClassSession = () => {
    if (!activeClass) return;
    const loaded = loadClassTeachingSession(activeClass.id, accountScopeId);
    if (loaded) {
      setSession(loaded);
      const savedReview = loadReviewGameSession(activeClass.id, accountScopeId);
      setBannerNote(
        savedReview && savedReview.phase === 'playing'
          ? `Đã khôi phục phiên làm việc & trò chơi ôn tập đang chơi của ${activeClass.name}.`
          : `Đã khôi phục phiên làm việc đã lưu của ${activeClass.name}.`
      );
    }
  };

  const presentStudents = useMemo(() => {
    if (!session) return activeStudents;
    const absentSet = new Set(session.absentStudentIds);
    return activeStudents.filter((s) => !absentSet.has(s.id));
  }, [activeStudents, session]);

  const duplicateNamesSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const st of activeStudents) {
      counts.set(st.fullName, (counts.get(st.fullName) || 0) + 1);
    }
    const out = new Set<string>();
    for (const [name, cnt] of counts.entries()) {
      if (cnt > 1) out.add(name);
    }
    return out;
  }, [activeStudents]);

  const getToolLiveSummary = (toolId: TeachingToolId): string => {
    if (!session) return 'Chưa chọn lớp';
    switch (toolId) {
      case 'groups':
        return `${session.groupsState.groups.length} nhóm · ${presentStudents.length} HS có mặt`;
      case 'seating': {
        const avail = getAvailableSeatKeys(session.seatingState).length;
        return `${session.seatingState.rows}×${session.seatingState.cols} · ${avail} ghế khả dụng`;
      }
      case 'activity':
        return `${ACTIVITY_MODE_META[session.activityState.mode].label} · ${session.activityState.stations.length} trạm`;
      case 'timer': {
        const snap = tickTimerSnapshot(session.timerState);
        return `${session.timerState.mode === 'countdown' ? 'Đếm ngược' : 'Bấm giờ'} · ${formatTimerClock(snap.displayMs)}`;
      }
      case 'scoreboard':
        return `${session.scoreboardState.teams.length} đội · ${session.scoreboardState.history.filter((h) => !h.undone).length} lượt điểm`;
      case 'packages':
        return `${savedPackages.length} gói đã lưu`;
      case 'question_bank': {
        const totalQ = questionSets.reduce((acc, s) => acc + s.questions.length, 0);
        return `${questionSets.length} bộ · ${totalQ} câu hỏi`;
      }
      case 'review_games': {
        const activeReview = activeClass
          ? loadReviewGameSession(activeClass.id, accountScopeId)
          : null;
        return activeReview && activeReview.phase === 'playing'
          ? `Đang chơi câu ${activeReview.currentQuestionIdx + 1}/${activeReview.questions.length}`
          : '3 chế độ từ 1 bộ đề';
      }
      case 'quick_activities':
        return `${session.quickActivityState?.latestPairs?.pairs?.length || 0} cặp · ${
          (session.quickActivityState?.challenges || []).length || 6
        } thử thách`;
    }
  };

  return (
    <div className="space-y-5 font-edtech text-[#0F2D52] w-full min-w-0">
      {/* Shared Class Context Header Bar */}
      <section className="bg-white rounded-2xl border border-[#DCE8F7] shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#1769F4]">
              Tây Đô Smart EDU · Bộ công cụ giảng dạy trực tiếp
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#082B52] tracking-tight">
              Công cụ dạy học
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {activeClass
                ? `${activeClass.name} · Có mặt ${presentStudents.length}/${activeStudents.length} học sinh · Dữ liệu đồng bộ 9 công cụ`
                : 'Chọn lớp một lần để dùng xuyên suốt 9 công cụ giảng dạy.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleLaunchCallStudentA01}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0F2D52] text-xs sm:text-sm font-extrabold shadow-xs cursor-pointer transition-colors"
            >
              <Dices className="w-4 h-4 shrink-0" />
              <span>Gọi học sinh (A01)</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMuteGlobal}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                isMutedGlobal
                  ? 'bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-[#F0F7FF] border-[#DCE8F7] text-[#1769F4]'
              }`}
              title={isMutedGlobal ? 'Bật âm thanh chuông/điểm' : 'Tắt tiếng toàn công cụ'}
            >
              {isMutedGlobal ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isMutedGlobal ? 'Đang tắt tiếng' : 'Âm thanh bật'}</span>
            </button>
          </div>
        </div>

        {/* Single Class Selector + Quick Attendance */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">
            <div className="min-w-[240px] flex-1 max-w-md space-y-1">
              <label
                htmlFor="teaching-tools-class-select"
                className="block text-xs font-bold text-slate-700"
              >
                Lớp đang giảng dạy (chọn một lần cho cả 9 công cụ)
              </label>
              <select
                id="teaching-tools-class-select"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={availableClasses.length === 0}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-[#0F2D52] focus:outline-hidden focus:border-[#1769F4]"
              >
                {availableClasses.length === 0 ? (
                  <option value="">Chưa có lớp được phân công</option>
                ) : (
                  availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.students?.length || 0} HS)
                    </option>
                  ))
                )}
              </select>
            </div>

            {activeClass && (
              <button
                type="button"
                onClick={() => setShowAttendancePanel((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                  showAttendancePanel
                    ? 'bg-[#082B52] text-white border-[#082B52]'
                    : 'bg-[#F8FBFF] border-[#DCE8F7] text-[#0F2D52] hover:border-[#1769F4]'
                }`}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>
                  Điểm danh nhanh ({presentStudents.length}/{activeStudents.length} có mặt)
                </span>
              </button>
            )}
          </div>

          {activeTool !== null && (
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tổng quan 9 công cụ</span>
            </button>
          )}
        </div>

        {/* Collapsible Attendance Drawer */}
        {showAttendancePanel && activeClass && session && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-700">
                Đánh dấu học sinh có mặt / vắng mặt (tự động cập nhật sang Chia nhóm &amp; Sơ đồ chỗ ngồi):
              </p>
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="text-xs font-bold text-[#1769F4] hover:underline cursor-pointer"
              >
                Chọn tất cả có mặt ({activeStudents.length})
              </button>
            </div>

            {activeStudents.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Lớp hiện tại chưa có học sinh trong danh sách.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
                {activeStudents.map((st, idx) => {
                  const isPresent = !session.absentStudentIds.includes(st.id);
                  const isDupName = duplicateNamesSet.has(st.fullName);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleToggleStudentAbsent(st.id)}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left text-xs font-semibold cursor-pointer transition-colors ${
                        isPresent
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                      }`}
                    >
                      <span className="truncate">
                        {idx + 1}. {st.fullName}
                        {isDupName ? ` (${st.code})` : ''}
                      </span>
                      {isPresent ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {bannerNote && (
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2">
            <span>{bannerNote}</span>
            <button
              type="button"
              onClick={() => setBannerNote('')}
              className="text-emerald-700 hover:underline cursor-pointer shrink-0"
            >
              Ẩn
            </button>
          </div>
        )}
      </section>

      {/* No Assigned Class Guard for Real Teachers */}
      {availableClasses.length === 0 && (
        <section className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center space-y-3">
          <FolderOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h2 className="text-base font-extrabold text-[#082B52]">
            Bạn chưa được phân công lớp học nào
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
            Tài khoản giáo viên chỉ hiển thị các lớp thuộc quyền phụ trách. Hãy liên hệ quản trị viên để gắn phân công lớp hoặc mở A01 – Vòng quay may mắn để chọn danh sách tự do.
          </p>
        </section>
      )}

      {/* Hub Grid of 6 Tools */}
      {availableClasses.length > 0 && activeTool === null && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOL_CARDS.map((card) => {
            const Icon = card.icon;
            const imgFailed = Boolean(brokenImages[card.id]);
            return (
              <article
                key={card.id}
                className="bg-white rounded-2xl border border-[#DCE8F7] shadow-xs hover:border-[#1769F4] hover:shadow-md transition-all overflow-hidden flex flex-col"
              >
                <div className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br ${card.accentBg}`}>
                  {!imgFailed ? (
                    <img
                      src={card.image}
                      alt={card.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, [card.id]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/90">
                      <Icon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#081A33]/75 to-transparent pointer-events-none" />
                  <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between text-white">
                    <span className="text-xs font-extrabold tracking-wide">
                      Công cụ {card.code}
                    </span>
                    <Icon className="w-4 h-4 text-white/90" />
                  </div>
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <h2 className="text-base sm:text-lg font-extrabold text-[#082B52]">
                      {card.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {card.subtitle}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1769F4] truncate">
                      {getToolLiveSummary(card.id)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTool(card.id)}
                      className="px-3.5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-bold cursor-pointer shrink-0 transition-colors"
                    >
                      Mở công cụ
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Active Tool Workspace */}
      {availableClasses.length > 0 && activeTool !== null && session && activeClass && (
        <div className="space-y-4">
          {/* Quick 6-Tool Tab Switcher */}
          <nav
            aria-label="Chuyển nhanh công cụ dạy học"
            className="bg-white rounded-2xl border border-[#DCE8F7] p-2 flex flex-wrap gap-1.5"
          >
            {TOOL_CARDS.map((card) => {
              const Icon = card.icon;
              const isSelected = activeTool === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveTool(card.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#1769F4] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{card.code}. {card.title}</span>
                </button>
              );
            })}
          </nav>

          {activeTool === 'groups' && (
            <GroupDividerTool
              presentStudents={presentStudents}
              groupsState={session.groupsState}
              onChangeGroupsState={(nextGroups) =>
                commitSession({ ...session, groupsState: nextGroups })
              }
              onSendToActivity={() => setActiveTool('activity')}
              onSendToScoreboard={() => setActiveTool('scoreboard')}
            />
          )}

          {activeTool === 'seating' && (
            <SeatingChartTool
              classNameLabel={activeClass.name}
              presentStudents={presentStudents}
              seatingState={session.seatingState}
              onChangeSeatingState={(nextSeating) =>
                commitSession({ ...session, seatingState: nextSeating })
              }
            />
          )}

          {activeTool === 'activity' && (
            <ActivityCoordinatorTool
              groups={session.groupsState.groups}
              activityState={session.activityState}
              isMutedGlobal={isMutedGlobal}
              onChangeActivityState={(nextActivity) =>
                commitSession({ ...session, activityState: nextActivity })
              }
              onGoToGroups={() => setActiveTool('groups')}
            />
          )}

          {activeTool === 'timer' && (
            <ClassroomTimerTool
              timerState={session.timerState}
              isMutedGlobal={isMutedGlobal}
              onChangeTimerState={(nextTimer) =>
                commitSession({ ...session, timerState: nextTimer })
              }
            />
          )}

          {activeTool === 'scoreboard' && (
            <TeamScoreboardTool
              groups={session.groupsState.groups}
              scoreboardState={session.scoreboardState}
              isMutedGlobal={isMutedGlobal}
              onChangeScoreboardState={(nextScoreboard) =>
                commitSession({ ...session, scoreboardState: nextScoreboard })
              }
            />
          )}

          {activeTool === 'packages' && (
            <LessonPackageTool
              currentClassName={activeClass.name}
              currentSession={session}
              savedPackages={savedPackages}
              questionSets={questionSets}
              hasSavedSessionForClass={hasSavedSessionForClass}
              onSavePackagesList={handleSavePackagesList}
              onApplyPackageFresh={handleApplyPackageFresh}
              onResumeSavedClassSession={handleResumeSavedClassSession}
            />
          )}

          {activeTool === 'question_bank' && (
            <ToolQuestionBankPanel
              questionSets={questionSets}
              systemBankQuestions={questions}
              onSaveQuestionSets={handleSaveQuestionSets}
              onStartReviewGameWithSet={handleStartReviewGameWithSet}
            />
          )}

          {activeTool === 'review_games' && (
            <ReviewGamesStudio
              classId={activeClass.id}
              classNameLabel={activeClass.name}
              accountScopeId={accountScopeId}
              presentStudents={presentStudents}
              dot1Groups={session.groupsState.groups}
              questionSets={questionSets}
              transferredReviewSessionIds={session.transferredReviewSessionIds || []}
              isMutedGlobal={isMutedGlobal}
              initialPrefill={session.pendingReviewGamePrefill || null}
              onGoToQuestionBank={() => setActiveTool('question_bank')}
              onGoToGroups={() => setActiveTool('groups')}
              onGoToScoreboard={() => setActiveTool('scoreboard')}
              onOpenClassicEduGame={handleOpenClassicEduGame}
              onTransferScoresToScoreboard={handleTransferReviewScores}
            />
          )}

          {activeTool === 'quick_activities' && (
            <QuickActivitiesTool
              classNameLabel={activeClass.name}
              presentStudents={presentStudents}
              quickState={session.quickActivityState || createDefaultQuickActivityState()}
              onChangeQuickState={(nextQuick) =>
                commitSession({ ...session, quickActivityState: nextQuick })
              }
              onOpenClassroomTimer={() => setActiveTool('timer')}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default TeachingToolsHub;
