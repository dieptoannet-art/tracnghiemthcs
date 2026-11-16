import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Filter,
  FlaskConical,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SMART_MATH_LAB_REGISTRY, getMathToolById } from './MathLabRegistry';
import { MathLabErrorBoundary } from './MathLabErrorBoundary';
import { MathLabCardThumbnail3D, SmartMathLabHeroIllustration3D } from './MathLabThumbnails3D';
import { MathToolShell } from './MathToolShell';
import {
  KNOWLEDGE_STRAND_LABELS,
  MathActivityResultRecord,
  MathActivitySpec,
  MathClassroomSession,
  MathGrade,
  MathKnowledgeStrand,
  MathToolId,
  PedagogicalMode,
} from './types';
import {
  createMathClassroomSession,
  exportMathResultsToCSV,
  loadMathActivityResults,
  loadMathClassroomSessions,
  loadRecentMathTools,
  recordRecentMathTool,
} from './adapters/mathLabAdapters';
import { runSmartMathLabUnitTests } from './mathEngine/mathVerificationEngine';
import {
  M01DynamicGeometryTool,
  M08SolidGeometry3DTool,
  M10PythagoreTrigTool,
} from './tools/GeometryAnd3DTools';
import {
  M02FunctionGrapherTool,
  M05FractionVisualizerTool,
  M06EquationBalanceTool,
  M07NumberLineIntegersTool,
  M09AlgebraTilesIdentityTool,
} from './tools/AlgebraAndGraphTools';
import {
  M03ProbabilitySimulatorTool,
  M04StatisticsLabTool,
  M11SpeedMathArenaTool,
  M12InteractiveMathBoardTool,
} from './tools/ProbStatsArenaBoardTools';
import { M13NumberTheoryTool } from './tools/M13NumberTheoryTool';
import { M14TransformationTool } from './tools/M14TransformationTool';
import { M15PythagoreanTool } from './tools/M15PythagoreanTool';
import { M16SimilarityTool } from './tools/M16SimilarityTool';
import { M17CountingTreeTool } from './tools/M17CountingTreeTool';

const STRAND_CHIP_STYLES: Record<MathKnowledgeStrand, { badge: string; dot: string }> = {
  geometry_measurement: {
    badge: 'bg-[#E9F7F4] text-[#0D7A5F] border-[#BDE8DC]',
    dot: 'bg-[#12A879]',
  },
  number_algebra: {
    badge: 'bg-[#EDF3FF] text-[#0856D6] border-[#C9DCFF]',
    dot: 'bg-[#0866FF]',
  },
  statistics_prob: {
    badge: 'bg-[#FFF5E8] text-[#B45309] border-[#FDE0B6]',
    dot: 'bg-[#F59E0B]',
  },
  practice_experience: {
    badge: 'bg-[#F1EEFF] text-[#5B3CC4] border-[#DCD4FF]',
    dot: 'bg-[#6366F1]',
  },
};

export const SmartMathLabView: React.FC = () => {
  const {
    currentRole,
    userProfile,
    studentUser,
    classes,
    questions,
    assignmentDataLoading,
  } = useApp();

  const canAssignToClass = currentRole !== 'student';
  const displayUserName =
    userProfile?.fullName || studentUser?.fullName || (canAssignToClass ? 'Giáo viên Toán THCS' : 'Học sinh THCS Tây Đô');

  const userScopeKey = useMemo(() => {
    const uid = userProfile?.id || studentUser?.id || 'guest';
    return `${currentRole}_${uid}`;
  }, [currentRole, userProfile?.id, studentUser?.id]);

  const [selectedToolId, setSelectedToolId] = useState<MathToolId | null>(null);
  const [gradeFilter, setGradeFilter] = useState<MathGrade | 'ALL'>('ALL');
  const [strandFilter, setStrandFilter] = useState<MathKnowledgeStrand | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeGrade, setActiveGrade] = useState<MathGrade>(8);
  const [activeActivity, setActiveActivity] = useState<MathActivitySpec | null>(null);
  const [pedagogicalMode, setPedagogicalMode] = useState<PedagogicalMode>('GUIDED');
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);
  const [resetSignal, setResetSignal] = useState<number>(0);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes && classes.length > 0 ? classes[0].id : ''
  );
  const [recentToolIds, setRecentToolIds] = useState<MathToolId[]>(() =>
    loadRecentMathTools(userScopeKey)
  );
  const [resultsHistory, setResultsHistory] = useState<MathActivityResultRecord[]>(() =>
    loadMathActivityResults()
  );
  const [sessions, setSessions] = useState<MathClassroomSession[]>(() =>
    loadMathClassroomSessions()
  );
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
  const [showResultsDrawer, setShowResultsDrawer] = useState<boolean>(false);
  const [expandedDescIds, setExpandedDescIds] = useState<Record<string, boolean>>({});
  const [expandedActivityIds, setExpandedActivityIds] = useState<Record<string, boolean>>({});
  const [assignFeedback, setAssignFeedback] = useState<string | null>(null);

  useEffect(() => {
    setRecentToolIds(loadRecentMathTools(userScopeKey));
  }, [userScopeKey]);

  useEffect(() => {
    if (!classes || classes.length === 0) {
      setSelectedClassId('');
      return;
    }
    const stillExists = classes.some((c) => c.id === selectedClassId);
    if (!stillExists) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!showDiagnosticsModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDiagnosticsModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDiagnosticsModal]);

  const selectedClassObj = useMemo(() => {
    if (!canAssignToClass || !classes || classes.length === 0) return null;
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [canAssignToClass, classes, selectedClassId]);

  const supportedGrades = useMemo(() => {
    const gradeSet = new Set<MathGrade>();
    for (const tool of SMART_MATH_LAB_REGISTRY) {
      for (const g of tool.grades) {
        const num = Number(g) as MathGrade;
        if (num === 6 || num === 7 || num === 8 || num === 9) {
          gradeSet.add(num);
        }
      }
    }
    return Array.from(gradeSet).sort((a, b) => a - b);
  }, []);

  const diagnosticsReport = useMemo(() => runSmartMathLabUnitTests(), []);
  const passedChecksCount =
    diagnosticsReport.totalChecks - diagnosticsReport.failedChecks.length;

  const filteredTools = useMemo(() => {
    return SMART_MATH_LAB_REGISTRY.filter((tool) => {
      if (
        gradeFilter !== 'ALL' &&
        !tool.grades.includes(String(gradeFilter) as '6' | '7' | '8' | '9')
      ) {
        return false;
      }
      if (strandFilter !== 'ALL' && tool.strand !== strandFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const matchId = tool.id.toLowerCase().includes(q) || tool.code.toLowerCase().includes(q);
        const matchName = tool.nameVi.toLowerCase().includes(q);
        const matchDesc = tool.shortDescription.toLowerCase().includes(q);
        const matchStrand =
          tool.strandLabel.toLowerCase().includes(q) ||
          KNOWLEDGE_STRAND_LABELS[tool.strand].toLowerCase().includes(q);
        const matchFeat = tool.features.some((f) => f.toLowerCase().includes(q));
        const matchAct = tool.sampleActivities.some(
          (a) => a.title.toLowerCase().includes(q) || a.topic.toLowerCase().includes(q)
        );
        return matchId || matchName || matchDesc || matchStrand || matchFeat || matchAct;
      }
      return true;
    });
  }, [gradeFilter, strandFilter, searchQuery]);

  const recentTools = useMemo(() => {
    return recentToolIds
      .map((id) => getMathToolById(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  }, [recentToolIds]);

  const hasActiveFilter =
    gradeFilter !== 'ALL' || strandFilter !== 'ALL' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setGradeFilter('ALL');
    setStrandFilter('ALL');
    setSearchQuery('');
  };

  const handleOpenTool = (
    toolId: MathToolId,
    preferredGrade?: MathGrade,
    specificActivity?: MathActivitySpec
  ) => {
    const tool = getMathToolById(toolId);
    if (!tool) return;
    const supportedNums = tool.grades.map((g) => Number(g) as MathGrade);
    const targetGrade: MathGrade =
      preferredGrade && supportedNums.includes(preferredGrade)
        ? preferredGrade
        : specificActivity && supportedNums.includes(Number(specificActivity.grade) as MathGrade)
        ? (Number(specificActivity.grade) as MathGrade)
        : gradeFilter !== 'ALL' && supportedNums.includes(gradeFilter)
        ? gradeFilter
        : supportedNums[0] || 8;

    const matchingActivity =
      specificActivity ||
      tool.sampleActivities.find((a) => Number(a.grade) === targetGrade) ||
      tool.sampleActivities[0];

    setAssignFeedback(null);
    setSelectedToolId(toolId);
    setActiveGrade(targetGrade);
    setActiveActivity(matchingActivity);
    setRecentToolIds(recordRecentMathTool(toolId, userScopeKey));
  };

  const handleCreateClassroomSession = (toolId: MathToolId) => {
    if (!canAssignToClass) return;
    if (!selectedClassObj) {
      setAssignFeedback('Chưa có lớp giảng dạy để giao hoạt động. Hãy kiểm tra phân công lớp.');
      return;
    }
    const tool = getMathToolById(toolId);
    if (!tool) return;
    const supportedNums = tool.grades.map((g) => Number(g) as MathGrade);
    const preferredFromFilter =
      gradeFilter !== 'ALL' && supportedNums.includes(gradeFilter) ? gradeFilter : undefined;
    const act =
      (preferredFromFilter
        ? tool.sampleActivities.find((a) => Number(a.grade) === preferredFromFilter)
        : undefined) || tool.sampleActivities[0];
    const actGrade = (preferredFromFilter || Number(act.grade) || 8) as MathGrade;

    const newSession = createMathClassroomSession({
      toolId,
      activityId: act.id,
      grade: actGrade,
      classId: selectedClassObj.id,
      className: selectedClassObj.name,
      teacherId: userProfile?.id,
      teacherName: displayUserName,
    });
    setSessions((prev) => [newSession, ...prev]);
    setAssignFeedback(
      `Đã tạo phiên ${newSession.code} cho Lớp ${selectedClassObj.name} (${tool.code} · ${tool.nameVi}).`
    );
    handleOpenTool(toolId, actGrade, act);
  };

  const handleExportCSV = () => {
    const csv = exportMathResultsToCSV(resultsHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ket-qua-smart-math-lab-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (selectedToolId) {
    const activeTool = getMathToolById(selectedToolId);
    if (!activeTool) {
      return (
        <div
          role="alert"
          className="bg-white rounded-[22px] border border-[#D9E7FF] p-8 text-center space-y-4 text-[#102A56]"
        >
          <p className="text-base font-bold">Không tìm thấy phòng thí nghiệm mã {selectedToolId}.</p>
          <button
            type="button"
            onClick={() => setSelectedToolId(null)}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0866FF] text-white text-sm font-bold cursor-pointer"
          >
            Quay lại thư viện phòng thí nghiệm
          </button>
        </div>
      );
    }

    const currentActivity = activeActivity || activeTool.sampleActivities[0];

    const commonProps = {
      grade: activeGrade,
      isPresentationMode,
      isDarkTheme,
      resetSignal,
      systemQuestions: questions,
    };

    return (
      <MathToolShell
        tool={activeTool}
        activeGrade={activeGrade}
        onGradeChange={(g) => {
          setActiveGrade(g);
          const matchAct = activeTool.sampleActivities.find((a) => Number(a.grade) === g);
          if (matchAct) setActiveActivity(matchAct);
        }}
        activeActivity={currentActivity}
        onActivityChange={(act) => {
          setActiveActivity(act);
          setActiveGrade((Number(act.grade) || 8) as MathGrade);
        }}
        pedagogicalMode={pedagogicalMode}
        onPedagogicalModeChange={setPedagogicalMode}
        isPresentationMode={isPresentationMode}
        onTogglePresentationMode={() => setIsPresentationMode((v) => !v)}
        isDarkTheme={isDarkTheme}
        onToggleDarkTheme={() => setIsDarkTheme((v) => !v)}
        selectedClassName={
          canAssignToClass
            ? selectedClassObj?.name || 'Chưa chọn lớp'
            : studentUser?.className || `Lớp ${activeGrade}`
        }
        studentCount={selectedClassObj?.students?.length}
        currentUserName={displayUserName}
        onBackToHub={() => setSelectedToolId(null)}
        onResetTool={() => setResetSignal((s) => s + 1)}
        onResultSaved={(rec) => setResultsHistory((prev) => [rec, ...prev])}
      >
        <MathLabErrorBoundary
          toolName={`${activeTool.id} – ${activeTool.nameVi}`}
          onReset={() => setResetSignal((s) => s + 1)}
        >
          {selectedToolId === 'M01' && <M01DynamicGeometryTool {...commonProps} />}
          {selectedToolId === 'M02' && <M02FunctionGrapherTool {...commonProps} />}
          {selectedToolId === 'M03' && <M03ProbabilitySimulatorTool {...commonProps} />}
          {selectedToolId === 'M04' && <M04StatisticsLabTool {...commonProps} />}
          {selectedToolId === 'M05' && <M05FractionVisualizerTool {...commonProps} />}
          {selectedToolId === 'M06' && <M06EquationBalanceTool {...commonProps} />}
          {selectedToolId === 'M07' && <M07NumberLineIntegersTool {...commonProps} />}
          {selectedToolId === 'M08' && <M08SolidGeometry3DTool {...commonProps} />}
          {selectedToolId === 'M09' && <M09AlgebraTilesIdentityTool {...commonProps} />}
          {selectedToolId === 'M10' && <M10PythagoreTrigTool {...commonProps} />}
          {selectedToolId === 'M11' && <M11SpeedMathArenaTool {...commonProps} />}
          {selectedToolId === 'M12' && <M12InteractiveMathBoardTool {...commonProps} />}
          {selectedToolId === 'M13' && <M13NumberTheoryTool {...commonProps} />}
          {selectedToolId === 'M14' && <M14TransformationTool {...commonProps} />}
          {selectedToolId === 'M15' && <M15PythagoreanTool {...commonProps} />}
          {selectedToolId === 'M16' && <M16SimilarityTool {...commonProps} />}
          {selectedToolId === 'M17' && <M17CountingTreeTool {...commonProps} />}
        </MathLabErrorBoundary>
      </MathToolShell>
    );
  }

  return (
    <div
      className="bg-[#F4F8FF] text-[#102A56] rounded-[24px] p-3 sm:p-5 space-y-5 pb-10"
      style={{
        fontFamily:
          '"Be Vietnam Pro", "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* 1. BANNER SMART MATH LAB */}
      <section
        aria-label="Giới thiệu Smart Math Lab"
        className="relative overflow-hidden rounded-[22px] border border-[#C6E0FF] bg-gradient-to-r from-[#DCEEFF] via-[#EAF4FF] to-[#D4EAFF] px-5 py-4 sm:px-7 sm:py-5 shadow-[0_8px_24px_rgba(16,42,86,0.06)]"
      >
        <div
          className="pointer-events-none absolute -top-12 left-1/3 w-72 h-40 rounded-full bg-white/60 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 right-1/4 w-64 h-36 rounded-full bg-[#0866FF]/10 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Cột trái: Tiêu đề, phụ đề, mô tả & thống kê thực tế */}
          <div className="space-y-3 min-w-0 flex-1">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-[30px] font-extrabold text-[#102A56] tracking-tight leading-tight">
                  Smart Math Lab
                </h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#BBD9FF]/60 border border-[#9EC7FF] text-xs font-bold text-[#0856D6] tabular-nums">
                  GDPT 2018 • Lớp {supportedGrades[0]}–{supportedGrades[supportedGrades.length - 1]}
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold text-[#102A56]">
                Phòng thí nghiệm Toán tương tác THCS
              </p>
              <p className="text-xs sm:text-sm text-[#526581] font-medium leading-relaxed">
                Khám phá Toán học qua mô hình trực quan và hoạt động tương tác.
              </p>
            </div>

            {/* Chỉ số thư viện từ nguồn dữ liệu thống nhất + nút kiểm thử & kết quả/CSV */}
            <div
              className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px] tabular-nums"
              aria-label="Thông số phòng thí nghiệm và công cụ kiểm tra"
            >
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#C7DCFA] text-[#102A56] font-bold shadow-2xs">
                <FlaskConical className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                <span>{SMART_MATH_LAB_REGISTRY.length} phòng thí nghiệm</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#C7DCFA] text-[#102A56] font-bold shadow-2xs">
                <BookOpen className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                <span>{supportedGrades.length} khối lớp</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#C7DCFA] text-[#102A56] font-bold shadow-2xs">
                <Users className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                <span>Lớp {supportedGrades.join(' • ')}</span>
              </span>

              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 hover:bg-white border border-[#C7DCFA] hover:border-[#0866FF] text-[#102A56] font-semibold shadow-2xs transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
                title="Xem chi tiết kết quả tự kiểm thử thuật toán Toán học"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#12A879] shrink-0" aria-hidden="true" />
                <span>
                  Tự kiểm thử: {passedChecksCount}/{diagnosticsReport.totalChecks}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowResultsDrawer((v) => !v)}
                aria-expanded={showResultsDrawer}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-semibold shadow-2xs transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                  showResultsDrawer
                    ? 'bg-[#0866FF] text-white border-[#0866FF]'
                    : 'bg-white/95 hover:bg-white border-[#C7DCFA] hover:border-[#0866FF] text-[#102A56]'
                }`}
              >
                <Award
                  className={`w-3.5 h-3.5 shrink-0 ${
                    showResultsDrawer ? 'text-white' : 'text-[#0866FF]'
                  }`}
                  aria-hidden="true"
                />
                <span>
                  Lượt làm bài{canAssignToClass ? ' & CSV' : ''} ({resultsHistory.length})
                </span>
              </button>
            </div>
          </div>

          {/* Cột phải: Cụm minh họa 3D compa, lập phương trong suốt, thước êke, mặt phẳng tọa độ, xúc xắc */}
          <div className="hidden md:flex items-center justify-end shrink-0 -my-1">
            <SmartMathLabHeroIllustration3D />
          </div>
        </div>
      </section>

      {/* 2. BỘ LỌC HAI HÀNG */}
      <section
        aria-label="Bộ lọc và tìm kiếm phòng thí nghiệm"
        className="bg-white rounded-[20px] border border-[#D9E7FF] p-4 sm:p-5 shadow-[0_6px_20px_rgba(16,42,86,0.04)] space-y-3.5"
      >
        {/* Hàng 1: Khối lớp + Lớp giảng dạy (theo đúng vai trò) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo khối lớp">
            <span className="text-xs sm:text-[13px] font-bold text-[#526581] mr-1 inline-flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#0866FF]" aria-hidden="true" />
              <span>Khối lớp:</span>
            </span>

            {(['ALL', ...supportedGrades] as const).map((g) => {
              const isSelected = gradeFilter === g;
              return (
                <button
                  key={String(g)}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setGradeFilter(g)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-bold border transition-all inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-1 ${
                    isSelected
                      ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.24)]'
                      : 'bg-[#F4F8FF] text-[#102A56] border-[#D9E7FF] hover:bg-[#EAF2FF] hover:border-[#9CC2FF]'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                  <span>{g === 'ALL' ? 'Tất cả' : `Lớp ${g}`}</span>
                </button>
              );
            })}
          </div>

          {canAssignToClass && (
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px]">
              <label
                htmlFor="smart-math-lab-class-select"
                className="font-bold text-[#526581] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                <span>Lớp giảng dạy:</span>
              </label>

              {assignmentDataLoading && (!classes || classes.length === 0) ? (
                <span className="px-3 py-2 rounded-full bg-[#F4F8FF] border border-[#D9E7FF] text-xs font-semibold text-[#526581]">
                  Đang tải danh sách lớp...
                </span>
              ) : classes && classes.length > 0 ? (
                <select
                  id="smart-math-lab-class-select"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full border border-[#CFE0FB] bg-[#F4F8FF] text-[#102A56] text-xs sm:text-[13px] font-bold outline-hidden focus:bg-white focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF] cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp {c.name} ({c.students?.length || c.studentCount || 0} học sinh)
                    </option>
                  ))}
                </select>
              ) : (
                <span className="px-3.5 py-1.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#526581]">
                  Chưa có lớp giảng dạy
                </span>
              )}

              {sessions.length > 0 && (
                <span className="px-3 py-1 rounded-full bg-[#FFF7E6] border border-[#FCD996] text-[#9A5B00] text-xs font-bold tabular-nums">
                  Mã phiên gần nhất: {sessions[0].code}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hàng 2: Mạch kiến thức + Ô tìm kiếm */}
        <div className="pt-3.5 border-t border-[#EAF2FF] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Lọc theo mạch kiến thức"
          >
            <span className="text-xs sm:text-[13px] font-bold text-[#526581] mr-1 inline-flex items-center gap-1.5">
              <span>Mạch kiến thức:</span>
            </span>

            <button
              type="button"
              aria-pressed={strandFilter === 'ALL'}
              onClick={() => setStrandFilter('ALL')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-bold border transition-all inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-1 ${
                strandFilter === 'ALL'
                  ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.24)]'
                  : 'bg-[#F4F8FF] text-[#526581] border-[#D9E7FF] hover:bg-[#EAF2FF] hover:text-[#102A56]'
              }`}
            >
              {strandFilter === 'ALL' && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              <span>Tất cả mạch kiến thức</span>
            </button>

            {(Object.keys(KNOWLEDGE_STRAND_LABELS) as MathKnowledgeStrand[]).map((strand) => {
              const isSelected = strandFilter === strand;
              return (
                <button
                  key={strand}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setStrandFilter(strand)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-bold border transition-all inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-1 ${
                    isSelected
                      ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.24)]'
                      : 'bg-[#F4F8FF] text-[#526581] border-[#D9E7FF] hover:bg-[#EAF2FF] hover:text-[#102A56]'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                  <span>{KNOWLEDGE_STRAND_LABELS[strand]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 xl:min-w-[290px]">
            <div className="relative flex-1 min-w-0">
              <Search
                className="w-4 h-4 text-[#526581] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm phòng thí nghiệm theo mã, tên, mô tả hoặc tính năng"
                placeholder="Tìm phòng thí nghiệm..."
                className="w-full min-h-[40px] pl-10 pr-9 py-1.5 rounded-full border border-[#CFE0FB] bg-[#F4F8FF] text-xs sm:text-[13px] font-medium text-[#102A56] placeholder-[#526581]/80 focus:bg-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#526581] hover:text-[#102A56] hover:bg-[#E4EEFF] cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[40px] px-3 py-1.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Đặt lại</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* THÔNG BÁO GIAO LỚP (NẾU CÓ) */}
      {assignFeedback && (
        <div
          role="status"
          className="bg-white rounded-2xl border border-[#C6E0FF] px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm text-[#102A56] shadow-2xs"
        >
          <span className="font-semibold">{assignFeedback}</span>
          <button
            type="button"
            onClick={() => setAssignFeedback(null)}
            aria-label="Đóng thông báo"
            className="p-1 rounded-lg text-[#526581] hover:bg-[#F4F8FF] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BẢNG KẾT QUẢ & XUẤT CSV (MỞ KHI NGƯỜI DÙNG BẤM) */}
      {showResultsDrawer && (
        <section
          aria-label="Lịch sử kết quả thực hành Toán học"
          className="bg-white rounded-[20px] border border-[#C7DCFA] p-4 sm:p-5 shadow-[0_6px_20px_rgba(16,42,86,0.06)] space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-extrabold text-[#102A56] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#F59E0B]" aria-hidden="true" />
              <span>Lịch sử Kết quả Thực hành Toán học ({resultsHistory.length} bản ghi)</span>
            </h2>
            <div className="flex items-center gap-2">
              {resultsHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#12A879] hover:bg-[#0E8F66] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#12A879]"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Xuất bảng điểm CSV (Excel)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowResultsDrawer(false)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F4F8FF] hover:bg-[#E7F0FF] border border-[#D9E7FF] text-[#102A56] text-xs font-bold cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
              >
                Đóng
              </button>
            </div>
          </div>

          {resultsHistory.length === 0 ? (
            <p className="text-xs sm:text-sm text-[#526581]">
              Chưa có bản ghi kết quả nào. Hãy mở một phòng thí nghiệm và hoàn thành Bước 6 (Luyện tập) để lưu điểm.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-60 rounded-xl border border-[#E2EDFF]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EAF3FF] text-left text-[#102A56]">
                    <th className="p-2.5 border-b border-[#D9E7FF]">Phòng</th>
                    <th className="p-2.5 border-b border-[#D9E7FF]">Học sinh</th>
                    <th className="p-2.5 border-b border-[#D9E7FF]">Lớp</th>
                    <th className="p-2.5 border-b border-[#D9E7FF]">Tiến độ 6 bước</th>
                    <th className="p-2.5 border-b border-[#D9E7FF]">Điểm</th>
                    <th className="p-2.5 border-b border-[#D9E7FF]">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsHistory.slice(0, 15).map((r) => (
                    <tr key={r.id} className="hover:bg-[#F4F8FF] border-b border-[#F1F5F9] last:border-b-0">
                      <td className="p-2.5 font-bold text-[#0866FF]">{r.toolId}</td>
                      <td className="p-2.5 font-semibold text-[#102A56]">{r.studentName}</td>
                      <td className="p-2.5 text-[#526581]">{r.className}</td>
                      <td className="p-2.5 tabular-nums text-[#526581]">
                        {r.completedSteps.length}/6 bước
                      </td>
                      <td className="p-2.5 font-bold text-[#12A879] tabular-nums">
                        {r.score}/{r.maxScore}
                      </td>
                      <td className="p-2.5 text-[#526581] tabular-nums">
                        {new Date(r.completedAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 3. TRUY CẬP GẦN ĐÂY (DỮ LIỆU THỰC TẾ THEO NGƯỜI DÙNG) */}
      <section aria-label="Phòng thí nghiệm truy cập gần đây" className="px-1">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px]">
          <span className="font-bold text-[#526581] inline-flex items-center gap-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-[#0866FF]" aria-hidden="true" />
            <span>Truy cập gần đây:</span>
          </span>

          {recentTools.length > 0 ? (
            recentTools.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleOpenTool(t.id)}
                className="min-h-[34px] px-3.5 py-1 rounded-full bg-white border border-[#D9E7FF] hover:border-[#0866FF] hover:bg-[#EAF2FF] text-[#102A56] hover:text-[#0866FF] font-semibold shadow-2xs transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
              >
                <span className="font-bold tabular-nums">{t.code}</span>
                <span className="mx-1.5 text-[#94A3B8]" aria-hidden="true">
                  •
                </span>
                <span>{t.nameVi}</span>
              </button>
            ))
          ) : (
            <span className="text-xs text-[#526581]">
              Chưa có phòng thí nghiệm nào được mở gần đây — hãy chọn một phòng bên dưới để bắt đầu.
            </span>
          )}
        </div>
      </section>

      {/* 4. LƯỚI THƯ VIỆN: KHÁM PHÁ PHÒNG THÍ NGHIỆM (M01–M17) */}
      <section aria-labelledby="smart-math-lab-grid-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#EAF2FF] border border-[#CFE2FF] text-[#0866FF] flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4" aria-hidden="true" />
            </span>
            <h2
              id="smart-math-lab-grid-heading"
              className="text-lg sm:text-xl font-extrabold text-[#102A56] tracking-tight"
            >
              Khám phá phòng thí nghiệm
            </h2>
            <span className="text-[#CBD5E1] font-light" aria-hidden="true">
              |
            </span>
            <span className="text-sm text-[#526581] font-semibold tabular-nums">
              <strong className="text-[#102A56] font-extrabold">{filteredTools.length}</strong> phòng phù hợp
            </span>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0866FF] hover:underline whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] rounded-lg px-2 py-1"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xem tất cả {SMART_MATH_LAB_REGISTRY.length} phòng</span>
            </button>
          )}
        </div>

        {filteredTools.length === 0 ? (
          <div
            role="status"
            className="bg-white rounded-[22px] border border-[#D9E7FF] p-10 sm:p-12 text-center shadow-[0_6px_20px_rgba(16,42,86,0.04)] space-y-3.5"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#EAF2FF] text-[#0866FF] flex items-center justify-center mx-auto">
              <FlaskConical className="w-7 h-7" aria-hidden="true" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#102A56]">
              Không tìm thấy phòng thí nghiệm phù hợp
            </h3>
            <p className="text-sm text-[#526581] max-w-md mx-auto leading-relaxed">
              Không có phòng thí nghiệm nào khớp với bộ lọc khối lớp, mạch kiến thức hoặc từ khóa đang chọn.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2 bg-[#0866FF] hover:bg-[#0055E0] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-2"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Xóa bộ lọc</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredTools.map((tool) => {
              const strandStyle = STRAND_CHIP_STYLES[tool.strand];
              const isDescExpanded = Boolean(expandedDescIds[tool.id]);
              const isActsExpanded = Boolean(expandedActivityIds[tool.id]);
              const visibleActivities = isActsExpanded
                ? tool.sampleActivities
                : tool.sampleActivities.slice(0, 2);
              const hasMoreDesc = tool.shortDescription.length > 98;

              return (
                <article
                  key={tool.id}
                  className="bg-white rounded-[20px] border border-[#D9E7FF] hover:border-[#7BB2FF] p-3.5 sm:p-4 shadow-[0_6px_20px_rgba(16,42,86,0.05)] hover:shadow-[0_12px_28px_rgba(8,102,255,0.11)] transition-all flex flex-col justify-between gap-3.5"
                >
                  <div className="space-y-3">
                    {/* A. Thumbnail 3D nền pastel theo nội dung + mã phòng + khối lớp */}
                    <MathLabCardThumbnail3D
                      toolId={tool.id}
                      strand={tool.strand}
                      grades={tool.grades}
                      code={tool.code}
                    />

                    {/* B. Nội dung thông tin phòng thí nghiệm */}
                    <div className="px-1 space-y-2">
                      <h3 className="text-[16px] sm:text-[17px] font-extrabold text-[#102A56] leading-snug break-words">
                        {tool.nameVi}
                      </h3>

                      <div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${strandStyle.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${strandStyle.dot}`} aria-hidden="true" />
                          <span>{KNOWLEDGE_STRAND_LABELS[tool.strand]}</span>
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p
                          title={tool.shortDescription}
                          className={`text-xs sm:text-[13px] text-[#526581] leading-relaxed ${
                            isDescExpanded ? '' : 'line-clamp-2'
                          }`}
                        >
                          {tool.shortDescription}
                        </p>
                        {hasMoreDesc && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDescIds((prev) => ({
                                ...prev,
                                [tool.id]: !prev[tool.id],
                              }))
                            }
                            aria-expanded={isDescExpanded}
                            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#0866FF] hover:underline cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] rounded-sm"
                          >
                            <span>{isDescExpanded ? 'Thu gọn mô tả' : 'Xem đầy đủ mô tả'}</span>
                            {isDescExpanded ? (
                              <ChevronUp className="w-3 h-3" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="w-3 h-3" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* C. Kịch bản thực hành mẫu (1-2 ví dụ đầu + mở rộng nếu có nhiều hơn) */}
                      {tool.sampleActivities.length > 0 && (
                        <div className="pt-1 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#526581]">
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-[#0866FF]" aria-hidden="true" />
                              <span>Hoạt động mẫu ({tool.sampleActivities.length})</span>
                            </span>
                            {tool.sampleActivities.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedActivityIds((prev) => ({
                                    ...prev,
                                    [tool.id]: !prev[tool.id],
                                  }))
                                }
                                aria-expanded={isActsExpanded}
                                className="text-[#0866FF] hover:underline cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] rounded-sm"
                              >
                                {isActsExpanded
                                  ? 'Thu gọn'
                                  : `Xem tất cả (${tool.sampleActivities.length})`}
                              </button>
                            )}
                          </div>

                          {visibleActivities.map((act) => (
                            <button
                              key={act.id}
                              type="button"
                              onClick={() =>
                                handleOpenTool(
                                  tool.id,
                                  (Number(act.grade) || 8) as MathGrade,
                                  act
                                )
                              }
                              title={`Mở hoạt động: ${act.title}`}
                              className="w-full min-h-[36px] text-left px-3 py-1.5 rounded-xl bg-[#F4F8FF] hover:bg-[#EAF2FF] border border-[#E2ECFF] hover:border-[#9CC2FF] text-xs text-[#102A56] hover:text-[#0866FF] font-semibold transition-colors flex items-center justify-between gap-2 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
                            >
                              <span className="truncate">Ví dụ: {act.title}</span>
                              <span className="text-[11px] font-bold text-[#0866FF] shrink-0">
                                Mở →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* D. Nút hành động cuối thẻ */}
                  <div className="pt-3 border-t border-[#EAF2FF] px-1 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpenTool(tool.id)}
                      className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[#0866FF] hover:bg-[#0055E0] text-white text-xs sm:text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-[0_6px_16px_rgba(8,102,255,0.24)] cursor-pointer whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-1"
                    >
                      <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Mở phòng thí nghiệm</span>
                    </button>

                    {canAssignToClass && (
                      <button
                        type="button"
                        disabled={!selectedClassObj}
                        onClick={() => handleCreateClassroomSession(tool.id)}
                        title={
                          selectedClassObj
                            ? `Giao phiên hoạt động cho Lớp ${selectedClassObj.name}`
                            : 'Chưa có lớp giảng dạy để giao'
                        }
                        className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs sm:text-[13px] font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                          selectedClassObj
                            ? 'bg-white hover:bg-[#EAF2FF] text-[#102A56] border-[#CFE0FB] hover:border-[#0866FF] cursor-pointer'
                            : 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0] cursor-not-allowed'
                        }`}
                      >
                        Giao lớp
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL BÁO CÁO KIỂM THỬ ENGINE TOÁN HỌC TỰ ĐỘNG */}
      {showDiagnosticsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="math-lab-diagnostics-title"
          className="fixed inset-0 z-50 bg-[#091B36]/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDiagnosticsModal(false);
          }}
        >
          <div className="bg-white rounded-[22px] border border-[#D9E7FF] max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-[#ECFDF5] border border-[#BDE8DC] text-[#12A879] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                </span>
                <div>
                  <h3
                    id="math-lab-diagnostics-title"
                    className="text-base sm:text-lg font-extrabold text-[#102A56]"
                  >
                    Kết quả tự kiểm thử Engine Toán học
                  </h3>
                  <p className="text-xs sm:text-[13px] text-[#526581] mt-0.5 tabular-nums">
                    Đã chạy {diagnosticsReport.totalChecks} kiểm thử đơn vị trong bộ nhớ • Đạt:{' '}
                    <strong className={diagnosticsReport.passed ? 'text-[#12A879]' : 'text-rose-600'}>
                      {passedChecksCount}/{diagnosticsReport.totalChecks}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#F4F8FF] hover:bg-[#EAF2FF] border border-[#D9E7FF] text-[#102A56] text-xs font-bold cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
              >
                Đóng
              </button>
            </div>

            {diagnosticsReport.failedChecks.length > 0 && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1"
              >
                <p className="font-bold">Phát hiện kiểm thử chưa đạt:</p>
                <ul className="list-disc pl-4">
                  {diagnosticsReport.failedChecks.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {[
                '1. Số học Phân số tối giản (ƯCLN/BCNN, quy đồng, cộng/trừ/nhân/chia & chặn mẫu = 0)',
                '2. Phương trình bậc nhất 1 ẩn (Nghiệm duy nhất, Vô nghiệm, Vô số nghiệm & chặn chia 0)',
                '3. Khảo sát hàm số & Tương giao Parabol y = ax² với đường thẳng y = mx + n (xử lý suy biến a = 0)',
                '4. Mô phỏng Xác suất thực nghiệm lô lớn 1..10.000 phép thử trong bộ nhớ với cryptoRandomInt',
                '5. Phân tích Thống kê (Chặn tính Trung bình cộng / Trung vị trên dữ liệu định tính, tổng tần số tương đối 100%)',
                '6. Hình học không gian 3D (7 khối chuẩn GDPT 2018 & chặn trải phẳng mặt cầu theo định lý Gauss)',
                '7. Kiểm định Tương đương Đa thức đa điểm (Không dùng so khớp chuỗi thô)',
                '8. Hình học phẳng động 2D (Độ dài, góc nội tiếp, diện tích đa giác & tổng 3 góc tam giác = 180°)',
                '9. M13 Số học & Số nguyên tố (Sàng Eratosthenes N=100 → 25 số nguyên tố, prime, factor, ƯCLN/BCNN Euclid)',
                '10. M14 Phép biến hình (Tịnh tiến, Đối xứng, Quay, Bảo toàn khoảng cách & Phép vị tự)',
                '11. M15 Định lý Pythagore (Bộ ba Pythagore, Định lý đảo, Chặn biên & Ghép mảnh Perigal)',
                '12. M16 Đồng dạng & Tỉ lệ (Định lý Thalès, Thalès đảo, Đường trung bình, Tam giác đồng dạng)',
                '13. M17 Quy tắc đếm & Sơ đồ cây (Sơ đồ cây Ω, Lập số, Quy tắc cộng/nhân, Tổ hợp C(n,k))',
              ].map((label, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-[#E2EDFF] bg-[#F4F8FF] flex items-center justify-between gap-3"
                >
                  <span className="font-semibold text-[#102A56] leading-snug">{label}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-extrabold shrink-0 ${
                      diagnosticsReport.passed
                        ? 'bg-[#ECFDF5] text-[#0D7A5F] border border-[#BDE8DC]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {diagnosticsReport.passed ? 'ĐẠT' : 'KIỂM TRA'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
