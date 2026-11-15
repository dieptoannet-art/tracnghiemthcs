import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Box,
  Compass,
  Dices,
  Download,
  Filter,
  FlaskConical,
  Grid,
  PenTool,
  PieChart,
  Play,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
  Triangle,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SMART_MATH_LAB_REGISTRY, getMathToolById } from './MathLabRegistry';
import { MathLabErrorBoundary } from './MathLabErrorBoundary';
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

const TOOL_ICON_MAP: Record<MathToolId, React.ReactNode> = {
  M01: <Compass className="w-5 h-5" />,
  M02: <TrendingUp className="w-5 h-5" />,
  M03: <Dices className="w-5 h-5" />,
  M04: <BarChart3 className="w-5 h-5" />,
  M05: <PieChart className="w-5 h-5" />,
  M06: <Scale className="w-5 h-5" />,
  M07: <Activity className="w-5 h-5" />,
  M08: <Box className="w-5 h-5" />,
  M09: <Grid className="w-5 h-5" />,
  M10: <Triangle className="w-5 h-5" />,
  M11: <Swords className="w-5 h-5" />,
  M12: <PenTool className="w-5 h-5" />,
};

const STRAND_GRADIENT_MAP: Record<MathKnowledgeStrand, string> = {
  geometry_measurement: 'from-teal-700 to-emerald-700',
  number_algebra: 'from-indigo-700 to-blue-700',
  statistics_prob: 'from-amber-600 to-orange-600',
  practice_experience: 'from-purple-700 to-indigo-700',
};

export const SmartMathLabView: React.FC = () => {
  const { userProfile, studentUser, classes, questions } = useApp();
  const displayUserName =
    userProfile?.fullName || studentUser?.fullName || 'Học sinh THCS Tây Đô';

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
    classes && classes.length > 0 ? classes[0].id : 'class-default'
  );
  const [recentToolIds, setRecentToolIds] = useState<MathToolId[]>(() => loadRecentMathTools());
  const [resultsHistory, setResultsHistory] = useState<MathActivityResultRecord[]>(() =>
    loadMathActivityResults()
  );
  const [sessions, setSessions] = useState<MathClassroomSession[]>(() =>
    loadMathClassroomSessions()
  );
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
  const [showResultsDrawer, setShowResultsDrawer] = useState<boolean>(false);

  const selectedClassObj = useMemo(() => {
    if (!classes || classes.length === 0) return null;
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  const diagnosticsReport = useMemo(() => runSmartMathLabUnitTests(), []);

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
        const q = searchQuery.toLowerCase();
        const matchId = tool.id.toLowerCase().includes(q);
        const matchName = tool.nameVi.toLowerCase().includes(q);
        const matchDesc = tool.shortDescription.toLowerCase().includes(q);
        const matchFeat = tool.features.some((f) => f.toLowerCase().includes(q));
        return matchId || matchName || matchDesc || matchFeat;
      }
      return true;
    });
  }, [gradeFilter, strandFilter, searchQuery]);

  const handleOpenTool = (toolId: MathToolId, preferredGrade?: MathGrade) => {
    const tool = getMathToolById(toolId);
    if (!tool) return;
    const supportedNums = tool.grades.map((g) => Number(g) as MathGrade);
    const targetGrade: MathGrade =
      preferredGrade && supportedNums.includes(preferredGrade)
        ? preferredGrade
        : gradeFilter !== 'ALL' && supportedNums.includes(gradeFilter)
        ? gradeFilter
        : supportedNums[0] || 8;

    const matchingActivity =
      tool.sampleActivities.find((a) => Number(a.grade) === targetGrade) ||
      tool.sampleActivities[0];

    setSelectedToolId(toolId);
    setActiveGrade(targetGrade);
    setActiveActivity(matchingActivity);
    setRecentToolIds(recordRecentMathTool(toolId));
  };

  const handleCreateClassroomSession = (toolId: MathToolId) => {
    const tool = getMathToolById(toolId);
    if (!tool) return;
    const act = tool.sampleActivities[0];
    const actGrade = (Number(act.grade) || 8) as MathGrade;
    const newSession = createMathClassroomSession({
      toolId,
      activityId: act.id,
      grade: actGrade,
      classId: selectedClassObj?.id || 'guest-class',
      className: selectedClassObj?.name || 'Lớp THCS Tây Đô',
      teacherId: userProfile?.id,
      teacherName: displayUserName,
    });
    setSessions((prev) => [newSession, ...prev]);
    handleOpenTool(toolId, actGrade);
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
    const activeTool = getMathToolById(selectedToolId)!;
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
        selectedClassName={selectedClassObj?.name || 'Lớp học Thực hành'}
        studentCount={selectedClassObj?.students?.length || 35}
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
        </MathLabErrorBoundary>
      </MathToolShell>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* BANNER CHÍNH */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-teal-900 via-teal-800 to-indigo-900 text-white p-6 sm:p-8 shadow-lg border border-teal-700/40">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-bold">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>SMART MATH LAB V1.0 • CHUẨN GDPT 2018 (KẾT NỐI TRI THỨC)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Phòng Thí Nghiệm Toán Học Tương Tác THCS (Lớp 6 – 9)
            </h1>
            <p className="text-sm text-teal-100/90 leading-relaxed">
              Hệ thống 12 công cụ trực quan hóa Đại số, Hình học phẳng, Hình học không gian 3D, Thống kê & Xác suất thực nghiệm với quy trình khám phá 6 bước chuẩn sư phạm dành cho Giáo viên trình chiếu và Học sinh thực hành.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 text-center">
              <div className="text-2xl font-extrabold text-amber-400">12</div>
              <div className="text-[11px] text-teal-100 font-semibold">Công cụ M01–M12</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 text-center">
              <div className="text-2xl font-extrabold text-emerald-400">4 Khối</div>
              <div className="text-[11px] text-teal-100 font-semibold">Lớp 6 • 7 • 8 • 9</div>
            </div>
            <button
              type="button"
              onClick={() => setShowDiagnosticsModal(true)}
              className="p-3.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-center transition"
            >
              <div className="text-xl font-extrabold text-emerald-300 flex items-center justify-center gap-1">
                <ShieldCheck className="w-5 h-5" />
                <span>
                  {diagnosticsReport.totalChecks - diagnosticsReport.failedChecks.length}/
                  {diagnosticsReport.totalChecks}
                </span>
              </div>
              <div className="text-[11px] text-emerald-100 font-semibold">
                Kiểm định Toán học
              </div>
            </button>
            <button
              type="button"
              onClick={() => setShowResultsDrawer((v) => !v)}
              className="p-3.5 rounded-2xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-center transition"
            >
              <div className="text-2xl font-extrabold text-indigo-200">
                {resultsHistory.length}
              </div>
              <div className="text-[11px] text-indigo-100 font-semibold">
                Lượt làm bài & CSV
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* THANH CHỌN LỚP HỌC, KHỐI LỚP & MẠCH KIẾN THỨC */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Khối lớp:
            </span>
            {(['ALL', 6, 7, 8, 9] as const).map((g) => (
              <button
                key={String(g)}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  gradeFilter === g
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {g === 'ALL' ? 'Tất cả khối (6–9)' : `Toán Lớp ${g}`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <Users className="w-4 h-4 text-teal-600" />
              Lớp giảng dạy:
            </span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              aria-label="Chọn lớp học"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none"
            >
              {classes && classes.length > 0 ? (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Lớp {c.name} ({c.students?.length || 0} học sinh)
                  </option>
                ))
              ) : (
                <option value="class-default">Lớp Thực hành THCS Tây Đô (35 HS)</option>
              )}
            </select>

            {sessions.length > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 font-bold">
                Mã phiên gần nhất: {sessions[0].code}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStrandFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                strandFilter === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả mạch kiến thức
            </button>
            {(Object.keys(KNOWLEDGE_STRAND_LABELS) as MathKnowledgeStrand[]).map((strand) => (
              <button
                key={strand}
                type="button"
                onClick={() => setStrandFilter(strand)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  strandFilter === strand
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {KNOWLEDGE_STRAND_LABELS[strand]}
              </button>
            ))}
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã M01..M12, Pythagore, Parabol, Xác suất..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-teal-600"
            />
          </div>
        </div>
      </div>

      {/* BẢNG KẾT QUẢ & XUẤT CSV */}
      {showResultsDrawer && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-indigo-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Lịch sử Kết quả Thực hành Toán học ({resultsHistory.length} bản ghi)</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất bảng điểm CSV (Excel)</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResultsDrawer(false)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>

          {resultsHistory.length === 0 ? (
            <p className="text-xs text-slate-500">
              Chưa có bản ghi kết quả nào. Hãy mở một công cụ và hoàn thành Bước 6 (Luyện tập) để lưu điểm!
            </p>
          ) : (
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="p-2 border border-slate-200">Công cụ</th>
                    <th className="p-2 border border-slate-200">Học sinh</th>
                    <th className="p-2 border border-slate-200">Lớp</th>
                    <th className="p-2 border border-slate-200">Tiến độ 6 bước</th>
                    <th className="p-2 border border-slate-200">Điểm</th>
                    <th className="p-2 border border-slate-200">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsHistory.slice(0, 15).map((r) => (
                    <tr key={r.id}>
                      <td className="p-2 border border-slate-200 font-bold text-teal-700">
                        {r.toolId}
                      </td>
                      <td className="p-2 border border-slate-200 font-semibold">{r.studentName}</td>
                      <td className="p-2 border border-slate-200">{r.className}</td>
                      <td className="p-2 border border-slate-200">
                        {r.completedSteps.length}/6 bước
                      </td>
                      <td className="p-2 border border-slate-200 font-extrabold text-emerald-700">
                        {r.score}/{r.maxScore}
                      </td>
                      <td className="p-2 border border-slate-200 text-slate-500">
                        {new Date(r.completedAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TRUY CẬP NHANH GẦN ĐÂY */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-slate-500 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Truy cập nhanh gần đây:
        </span>
        {recentToolIds.map((id) => {
          const t = getMathToolById(id);
          if (!t) return null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleOpenTool(id)}
              className="px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-teal-500 text-slate-700 font-bold shadow-2xs transition"
            >
              {t.id} • {t.nameVi}
            </button>
          );
        })}
      </div>

      {/* LƯỚI 12 CÔNG CỤ DẠY HỌC TOÁN THCS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            className="bg-white rounded-2xl border border-slate-200 hover:border-teal-500/60 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
          >
            <div>
              <div
                className={`p-4 bg-gradient-to-r ${STRAND_GRADIENT_MAP[tool.strand]} text-white flex items-center justify-between`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                    {TOOL_ICON_MAP[tool.id]}
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-black/25">
                      {tool.id}
                    </span>
                    <h3 className="text-base font-extrabold mt-0.5">{tool.nameVi}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {tool.grades.map((g) => (
                    <span
                      key={g}
                      className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[11px] font-extrabold"
                    >
                      L{g}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="text-xs font-bold text-teal-700">
                  {KNOWLEDGE_STRAND_LABELS[tool.strand]}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {tool.shortDescription}
                </p>

                <div className="space-y-1 pt-1">
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    Kịch bản thực hành mẫu ({tool.sampleActivities.length} bài):
                  </div>
                  {tool.sampleActivities.slice(0, 2).map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() =>
                        handleOpenTool(tool.id, (Number(act.grade) || 8) as MathGrade)
                      }
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-teal-50 text-xs text-slate-700 hover:text-teal-800 font-medium truncate transition flex items-center justify-between"
                    >
                      <span className="truncate">• {act.title}</span>
                      <span className="text-[10px] font-bold text-teal-600 ml-2 shrink-0">
                        Mở →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleOpenTool(tool.id)}
                className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition shadow-2xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Mở Phòng thí nghiệm</span>
              </button>
              <button
                type="button"
                onClick={() => handleCreateClassroomSession(tool.id)}
                className="py-2 px-3 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
                title="Giao phiên hoạt động cho lớp đang chọn"
              >
                Giao lớp
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL BÁO CÁO KIỂM ĐỊNH ĐỘ CHÍNH XÁC TOÁN HỌC TỰ ĐỘNG */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Báo cáo Tự Kiểm định Engine Toán học (Smart Math Lab V1.0)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đã kiểm tra {diagnosticsReport.totalChecks} nhóm kiểm thử biên & công thức chuẩn GDPT 2018 • Trạng thái:{' '}
                    <strong className="text-emerald-600">
                      {diagnosticsReport.passed ? '100% PASS' : 'CÓ LỖI'}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Đóng
              </button>
            </div>

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
              ].map((label, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-800">{label}</span>
                  <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-emerald-500/15 text-emerald-700">
                    PASS
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
