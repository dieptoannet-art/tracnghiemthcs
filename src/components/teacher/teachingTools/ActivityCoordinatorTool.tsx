import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BookmarkPlus,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImagePlus,
  Lock,
  Maximize2,
  Pause,
  Play,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';
import { playTeachingToolBell } from './teachingToolsAudio';
import {
  ActivityMode,
  ActivityState,
  StudentGroupItem,
  ToolStudentItem,
} from './teachingToolsEngine';
import {
  ACTIVITY_SAMPLE_PRESETS,
  ACTIVITY_TAB_META,
  ActivityProPackageTemplate,
  ActivityProSessionState,
  ActivityWorkingGroup,
  buildActivityScheduleForState,
  createInitialActivityProSession,
  extractActivityProTemplate,
  finishActivityRun,
  formatClockMMSS,
  formatDurationVietnamese,
  getActivityProjectorChannelName,
  goToActivityPhase,
  loadActivityProSession,
  parseStationsMultiline,
  pauseActivityRun,
  rebuildLockedScheduleWhilePaused,
  resetActivityToIdle,
  resolveWorkingGroups,
  resumeActivityRun,
  saveActivityProSession,
  startActivityRun,
  tickActivityRun,
} from './activityProEngine';
import {
  ActivityPrintDocType,
  ActivityPrintModal,
  ActivityPrintSheetContent,
  ActivityProjectorModal,
  ActivitySchedulePreviewModal,
  ActivitySummaryPanel,
  PRINT_DOCS_BY_MODE,
} from './ActivityPrintAndProjector';

interface ActivityCoordinatorToolProps {
  classId: string;
  classNameLabel: string;
  groups: StudentGroupItem[];
  presentStudents: ToolStudentItem[];
  activityState: ActivityState;
  accountScopeId?: string | null;
  isMutedGlobal: boolean;
  reducedMotionGlobal?: boolean;
  onChangeActivityState: (next: ActivityState) => void;
  onGoToGroups?: () => void;
  onSaveToLessonPackage?: (template: ActivityProPackageTemplate, suggestedTitle: string) => void;
  packageHydrationVersion?: number;
}

export const ActivityCoordinatorTool: React.FC<ActivityCoordinatorToolProps> = ({
  classId,
  classNameLabel,
  groups: dividerGroups,
  presentStudents,
  activityState,
  accountScopeId,
  isMutedGlobal,
  reducedMotionGlobal = false,
  onChangeActivityState,
  onGoToGroups,
  onSaveToLessonPackage,
  packageHydrationVersion = 0,
}) => {
  const [session, setSession] = useState<ActivityProSessionState>(() => {
    const saved = loadActivityProSession(classId, accountScopeId);
    if (saved) return saved;
    return createInitialActivityProSession({
      classId,
      className: classNameLabel,
      dividerGroups,
      presentStudents,
      legacyActivityState: activityState,
    });
  });

  // Re-load isolated session if classId, accountScopeId, or packageHydrationVersion changes
  useEffect(() => {
    const saved = loadActivityProSession(classId, accountScopeId);
    if (saved) {
      setSession(saved);
    } else {
      setSession(
        createInitialActivityProSession({
          classId,
          className: classNameLabel,
          dividerGroups,
          presentStudents,
          legacyActivityState: activityState,
        })
      );
    }
  }, [classId, accountScopeId, packageHydrationVersion]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [localReducedMotion, setLocalReducedMotion] = useState<boolean>(reducedMotionGlobal);
  const [isConfigOpenMobile, setIsConfigOpenMobile] = useState<boolean>(true);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [showProjectorModal, setShowProjectorModal] = useState<boolean>(false);
  const [activePrintDoc, setActivePrintDoc] = useState<ActivityPrintDocType | null>(null);
  const [pasteStationsDraft, setPasteStationsDraft] = useState<string>('');
  const [showStationPasteBox, setShowStationPasteBox] = useState<boolean>(false);
  const [actionBanner, setActionBanner] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [selectedTableclothGroupId, setSelectedTableclothGroupId] = useState<string>('');
  const [feedbackDraft, setFeedbackDraft] = useState<{
    fromGroupId: string;
    targetGroupId: string;
    strength: string;
    question: string;
    suggestion: string;
  }>({ fromGroupId: '', targetGroupId: '', strength: '', question: '', suggestion: '' });

  // Always keep latest callback refs cleanly for real-clock tick
  const effectiveMuted = isMutedGlobal || session.bellMuted;

  const commitSession = useCallback(
    (updater: ActivityProSessionState | ((prev: ActivityProSessionState) => ActivityProSessionState)) => {
      setSession((prev) => {
        const nextRaw = typeof updater === 'function' ? updater(prev) : updater;
        const stamped: ActivityProSessionState = {
          ...nextRaw,
          updatedAtMs: Date.now(),
        };
        saveActivityProSession(stamped, accountScopeId);
        return stamped;
      });
    },
    [accountScopeId]
  );

  // Sync compact Đợt 1 ActivityState bridge when idle config changes
  const syncLegacyBridge = useCallback(
    (next: ActivityProSessionState) => {
      onChangeActivityState({
        ...activityState,
        mode: next.mode,
        stations: next.stationConfig.stations.map((s) => ({
          id: s.id,
          title: s.title,
          task: s.task,
          capacity: s.capacity,
        })),
        roundDurationSeconds: next.stationConfig.workSeconds,
        splitMultiTurn: next.stationConfig.allowWaitingTurns,
        instructions: next.teacherPrivateNote,
        status: next.status,
      });
    },
    [activityState, onChangeActivityState]
  );

  // Compute preview groups & schedule (frozen when running/paused!)
  const liveResolved = useMemo(
    () =>
      resolveWorkingGroups({
        sourceConfig: session.groupSource,
        dividerGroups,
        presentStudents,
        manualBoxCountPerGroup: session.tableclothConfig.manualBoxCountPerGroup,
      }),
    [
      session.groupSource,
      dividerGroups,
      presentStudents,
      session.tableclothConfig.manualBoxCountPerGroup,
    ]
  );

  const previewBuild = useMemo(
    () =>
      buildActivityScheduleForState({
        session,
        dividerGroups,
        presentStudents,
      }),
    [session, dividerGroups, presentStudents]
  );

  const activeGroups: ActivityWorkingGroup[] =
    session.status !== 'idle' && session.lockedGroupsSnapshot
      ? session.lockedGroupsSnapshot
      : previewBuild.groups;

  const activeSchedule =
    session.status !== 'idle' && session.lockedSchedule
      ? session.lockedSchedule
      : previewBuild.schedule;

  // Detect whether live Chia nhóm changed while locked snapshot is active
  const dividerChangedWhileLocked = useMemo(() => {
    if (session.status === 'idle' || session.groupSource.sourceMode !== 'from_divider') return false;
    if (!session.lockedGroupsSnapshot) return false;
    const lockedSig = session.lockedGroupsSnapshot
      .map((g) => `${g.id}:${g.name}:${g.members.map((m) => m.id).join(',')}`)
      .join('|');
    const liveSig = liveResolved.groups
      .map((g) => `${g.id}:${g.name}:${g.members.map((m) => m.id).join(',')}`)
      .join('|');
    return lockedSig !== liveSig;
  }, [session.status, session.groupSource.sourceMode, session.lockedGroupsSnapshot, liveResolved.groups]);

  // Real-clock interval + visibility wake recovery
  const tickSessionRef = useRef(session);
  tickSessionRef.current = session;
  const activeScheduleRef = useRef(activeSchedule);
  activeScheduleRef.current = activeSchedule;

  useEffect(() => {
    if (session.status !== 'running') return;

    const runClockCheck = () => {
      const tNow = Date.now();
      setNowMs(tNow);
      const outcome = tickActivityRun(tickSessionRef.current, tNow, activeScheduleRef.current);
      if (outcome.shouldRingBell && !effectiveMuted) {
        playTeachingToolBell(false);
      }
      if (outcome.nextState !== tickSessionRef.current) {
        commitSession(outcome.nextState);
      }
    };

    runClockCheck();
    const timerId = window.setInterval(runClockCheck, 250);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        runClockCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [session.status, effectiveMuted, commitSession]);

  const currentTickSnapshot = useMemo(
    () => tickActivityRun(session, nowMs, activeSchedule),
    [session, nowMs, activeSchedule]
  );

  const currentPhase =
    activeSchedule.phases[session.currentPhaseIndex] || activeSchedule.phases[0] || null;

  // BroadcastChannel push for read-only projector mirror
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      const ch = new BroadcastChannel(getActivityProjectorChannelName(classId));
      ch.postMessage({
        type: 'ACTIVITY_STAGE_SYNC',
        classId,
        classNameLabel,
        mode: session.mode,
        status: session.status,
        currentPhaseIndex: session.currentPhaseIndex,
        totalPhases: activeSchedule.totalPhases,
        currentPhase,
        displaySeconds: currentTickSnapshot.displaySeconds,
        progressRatio: currentTickSnapshot.progressRatio,
      });
      return () => ch.close();
    } catch {
      return undefined;
    }
  }, [
    classId,
    classNameLabel,
    session.mode,
    session.status,
    session.currentPhaseIndex,
    activeSchedule.totalPhases,
    currentPhase,
    currentTickSnapshot.displaySeconds,
    currentTickSnapshot.progressRatio,
  ]);

  // Select default Tablecloth group tab
  useEffect(() => {
    if (activeGroups.length > 0 && !activeGroups.some((g) => g.id === selectedTableclothGroupId)) {
      setSelectedTableclothGroupId(activeGroups[0].id);
    }
  }, [activeGroups, selectedTableclothGroupId]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleSelectMode = (mode: ActivityMode) => {
    if (session.status !== 'idle') {
      setErrorBanner('Đang có phiên chạy. Hãy Kết thúc hoặc Làm lại về Pha 1 trước khi đổi kỹ thuật.');
      return;
    }
    setErrorBanner('');
    commitSession((prev) => {
      const next: ActivityProSessionState = {
        ...prev,
        mode,
        currentPhaseIndex: 0,
        lockedGroupsSnapshot: null,
        lockedSchedule: null,
      };
      syncLegacyBridge(next);
      return next;
    });
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = ACTIVITY_SAMPLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setErrorBanner('');
    commitSession((prev) => {
      const next = preset.apply(prev);
      syncLegacyBridge(next);
      return next;
    });
    setActionBanner(`Đã nạp nhanh "${preset.title}". Nhấn Bắt đầu hoặc Xem lịch để sử dụng.`);
  };

  const handleStart = () => {
    setErrorBanner('');
    const tNow = Date.now();
    setNowMs(tNow);
    const res = startActivityRun({
      session,
      dividerGroups,
      presentStudents,
      nowMs: tNow,
    });
    if (!res.ok) {
      setErrorBanner(res.error || 'Chưa thể bắt đầu vì thiếu cấu hình.');
      return;
    }
    commitSession(res.nextState);
    setActionBanner('Đã chốt nhóm và bắt đầu Pha 1.');
  };

  const handlePauseResume = () => {
    const tNow = Date.now();
    setNowMs(tNow);
    if (session.status === 'idle') {
      handleStart();
      return;
    }
    if (session.status === 'running') {
      commitSession((prev) => pauseActivityRun(prev, tNow));
      return;
    }
    if (session.status === 'paused') {
      commitSession((prev) => resumeActivityRun(prev, tNow));
    }
  };

  const handleNextPhase = () => {
    const tNow = Date.now();
    setNowMs(tNow);
    const token = session.activePhaseToken;
    commitSession((prev) =>
      goToActivityPhase({
        session: prev,
        targetPhaseIndex: prev.currentPhaseIndex + 1,
        expectedToken: token,
        nowMs: tNow,
      })
    );
  };

  const handlePrevPhase = () => {
    const tNow = Date.now();
    setNowMs(tNow);
    const token = session.activePhaseToken;
    commitSession((prev) =>
      goToActivityPhase({
        session: prev,
        targetPhaseIndex: Math.max(0, prev.currentPhaseIndex - 1),
        expectedToken: token,
        nowMs: tNow,
      })
    );
  };

  const handleFinish = () => {
    const tNow = Date.now();
    setNowMs(tNow);
    commitSession((prev) => finishActivityRun(prev, tNow));
  };

  const handleResetToIdle = () => {
    const tNow = Date.now();
    setNowMs(tNow);
    setErrorBanner('');
    commitSession((prev) => resetActivityToIdle(prev, previewBuild.schedule, tNow));
    setActionBanner('Đã đưa hoạt động về trạng thái chuẩn bị trước giờ chạy.');
  };

  const handleRebuildLockedFromDivider = () => {
    const tNow = Date.now();
    const pausedFirst = session.status === 'running' ? pauseActivityRun(session, tNow) : session;
    const rebuilt = rebuildLockedScheduleWhilePaused({
      session: pausedFirst,
      dividerGroups,
      presentStudents,
      nowMs: tNow,
    });
    if (!rebuilt.ok) {
      setErrorBanner(rebuilt.error || 'Không thể dựng lại lịch.');
      return;
    }
    commitSession(rebuilt.nextState);
    setActionBanner('Đã tạm dừng và cập nhật lại lịch theo nhóm mới từ Chia nhóm học sinh.');
  };

  const handleSavePackageClick = () => {
    if (!onSaveToLessonPackage) {
      setActionBanner('Đã lưu phiên hoạt động hiện tại vào bộ nhớ cục bộ của lớp.');
      return;
    }
    const modeLabel = ACTIVITY_TAB_META.find((m) => m.mode === session.mode)?.label || 'Hoạt động nhóm';
    const template = extractActivityProTemplate(session);
    onSaveToLessonPackage(template, `${modeLabel} · ${classNameLabel}`);
    setActionBanner(`Đã lưu cấu hình "${modeLabel}" vào danh sách Gói tiết dạy.`);
  };

  const handleOpenPrint = (doc?: ActivityPrintDocType) => {
    const fallbackDoc = PRINT_DOCS_BY_MODE[session.mode][0].id;
    setActivePrintDoc(doc || fallbackDoc);
  };

  const handleTriggerPrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const isLockedRunning = session.status !== 'idle';
  const distinctPhaseAndRound = activeSchedule.totalPhases !== activeSchedule.totalRounds;
  const availablePrintDocs = PRINT_DOCS_BY_MODE[session.mode];

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="space-y-4 font-edtech text-[#0F2D52]">
      {/* Hidden A4 Print Root (only visible during window.print()) */}
      {activePrintDoc && (
        <div className="hidden print:block seating-a4-print-root p-4">
          <ActivityPrintSheetContent
            docType={activePrintDoc}
            classNameLabel={classNameLabel}
            session={session}
            schedule={activeSchedule}
            groups={activeGroups}
          />
        </div>
      )}

      {/* Top Mode Navigation Bar + Action Toolbar */}
      <section className="bg-white rounded-2xl border border-[#DCE8F7] shadow-xs p-4 space-y-4 no-print">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#1769F4]">
              Công cụ dạy học → Quản lý lớp học → Hoạt động nhóm
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#082B52]">
              Điều phối hoạt động nhóm · {classNameLabel}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={localReducedMotion}
                onChange={(e) => setLocalReducedMotion(e.target.checked)}
              />
              <span>Giảm chuyển động</span>
            </label>

            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              disabled={activeSchedule.phases.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE8F7] bg-[#F8FBFF] hover:border-[#1769F4] disabled:opacity-45 text-xs font-extrabold text-[#082B52] cursor-pointer"
            >
              <CalendarClock className="w-4 h-4 text-[#1769F4]" />
              <span>Xem lịch ({activeSchedule.totalPhases} pha)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowProjectorModal(true)}
              disabled={activeSchedule.phases.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#082B52] hover:bg-[#0F2D52] disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Chế độ chiếu</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenPrint()}
              disabled={activeSchedule.phases.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-45 text-xs font-extrabold text-slate-800 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>In phiếu A4</span>
            </button>

            <button
              type="button"
              onClick={handleSavePackageClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-extrabold text-emerald-900 cursor-pointer"
            >
              <BookmarkPlus className="w-4 h-4 text-emerald-700" />
              <span>Lưu vào Gói tiết dạy</span>
            </button>
          </div>
        </div>

        {/* 4 Activity Tabs */}
        <div role="tablist" aria-label="Bốn kỹ thuật hoạt động nhóm" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {ACTIVITY_TAB_META.map((tab) => {
            const isSelected = session.mode === tab.mode;
            return (
              <button
                key={tab.mode}
                role="tab"
                type="button"
                aria-selected={isSelected}
                onClick={() => handleSelectMode(tab.mode)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#F0F7FF] border-[#1769F4] ring-2 ring-[#1769F4]/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs sm:text-sm font-extrabold ${
                      isSelected ? 'text-[#1769F4]' : 'text-[#082B52]'
                    }`}
                  >
                    {tab.label}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tab.accentHex }}
                  />
                </div>
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{tab.tagline}</p>
              </button>
            );
          })}
        </div>

        {/* 4 Ready-to-Use Built-in Presets Strip */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Mẫu nạp nhanh:</span>
          </span>
          {ACTIVITY_SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.id)}
              title={preset.description}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${
                session.mode === preset.mode
                  ? 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {preset.title}
            </button>
          ))}
        </div>

        {actionBanner && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2">
            <span>{actionBanner}</span>
            <button type="button" onClick={() => setActionBanner('')} className="hover:underline cursor-pointer">
              Ẩn
            </button>
          </div>
        )}

        {errorBanner && (
          <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between gap-2">
            <span>{errorBanner}</span>
            <button type="button" onClick={() => setErrorBanner('')} className="hover:underline cursor-pointer">
              Đóng
            </button>
          </div>
        )}

        {dividerChangedWhileLocked && (
          <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <span>
              Dữ liệu ở công cụ Chia nhóm vừa thay đổi, nhưng phiên đang chạy vẫn giữ bản nhóm đã chốt để không xáo trộn lớp.
            </span>
            <button
              type="button"
              onClick={handleRebuildLockedFromDivider}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold cursor-pointer"
            >
              Tạm dừng &amp; Dựng lại lịch mới
            </button>
          </div>
        )}
      </section>

      {/* Main Two-Column Desktop Layout (Collapsible Config on Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start no-print">
        {/* LEFT COLUMN: GROUP SOURCE + MODE TASK CONFIG + SETTINGS */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-[#DCE8F7] shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsConfigOpenMobile((p) => !p)}
            className="w-full px-4 py-3.5 bg-[#F8FBFF] border-b border-slate-200 flex items-center justify-between gap-2 lg:cursor-default"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#1769F4]" />
              <span className="text-sm font-extrabold text-[#082B52]">
                Thiết lập nhóm, nhiệm vụ &amp; thời gian
              </span>
            </div>
            <span className="lg:hidden text-xs font-bold text-[#1769F4] inline-flex items-center gap-1">
              {isConfigOpenMobile ? (
                <>
                  Thu gọn <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Mở rộng <ChevronDown className="w-4 h-4" />
                </>
              )}
            </span>
          </button>

          <div className={`${isConfigOpenMobile ? 'block' : 'hidden lg:block'} p-4 space-y-5`}>
            {isLockedRunning && (
              <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between gap-2">
                <span>Đang khóa cấu trúc nhóm &amp; lịch trong lúc phiên đang chạy.</span>
                <button
                  type="button"
                  onClick={handleResetToIdle}
                  className="text-[#1769F4] font-extrabold hover:underline shrink-0 cursor-pointer"
                >
                  Đặt lại để sửa
                </button>
              </div>
            )}

            {/* 1. Group Source Selector (3 Sources) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#1769F4]" />
                  <span>Nguồn nhóm ({activeGroups.length} nhóm)</span>
                </label>
                {onGoToGroups && session.groupSource.sourceMode === 'from_divider' && (
                  <button
                    type="button"
                    onClick={onGoToGroups}
                    className="text-[11px] font-bold text-[#1769F4] hover:underline cursor-pointer"
                  >
                    Mở Chia nhóm học sinh
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'from_divider', label: 'Dùng nhóm đã chia' },
                    { id: 'quick_split', label: 'Chia nhanh' },
                    { id: 'names_only', label: 'Chỉ dùng tên nhóm' },
                  ] as const
                ).map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    disabled={isLockedRunning}
                    onClick={() =>
                      commitSession((prev) => ({
                        ...prev,
                        groupSource: { ...prev.groupSource, sourceMode: src.id },
                      }))
                    }
                    className={`px-2 py-2 rounded-xl border text-[11px] font-extrabold cursor-pointer disabled:opacity-60 transition-colors ${
                      session.groupSource.sourceMode === src.id
                        ? 'bg-[#1769F4] text-white border-[#1769F4]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>

              {/* Group Source Sub-controls */}
              {session.groupSource.sourceMode === 'quick_split' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">Số nhóm cần chia (1–12):</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      disabled={isLockedRunning}
                      value={session.groupSource.quickGroupCount}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          groupSource: {
                            ...prev.groupSource,
                            quickGroupCount: Math.max(1, Math.min(12, Number(e.target.value || 1))),
                          },
                        }))
                      }
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-extrabold text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      Dán danh sách tên cục bộ (tùy chọn, bỏ trống sẽ dùng {presentStudents.length} HS đang có mặt của lớp):
                    </label>
                    <textarea
                      rows={3}
                      disabled={isLockedRunning}
                      value={session.groupSource.quickPasteText}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          groupSource: { ...prev.groupSource, quickPasteText: e.target.value },
                        }))
                      }
                      placeholder="Mỗi dòng một họ tên (tự sinh mã HS001... nếu cần, tối đa 50 HS)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              {session.groupSource.sourceMode === 'names_only' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">Số lượng nhóm (1–12):</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      disabled={isLockedRunning}
                      value={session.groupSource.manualGroupCount}
                      onChange={(e) => {
                        const cnt = Math.max(1, Math.min(12, Number(e.target.value || 1)));
                        commitSession((prev) => {
                          const nextNames = Array.from(
                            { length: cnt },
                            (_, idx) => prev.groupSource.manualGroupNames[idx] || `Nhóm ${idx + 1}`
                          );
                          return {
                            ...prev,
                            groupSource: {
                              ...prev.groupSource,
                              manualGroupCount: cnt,
                              manualGroupNames: nextNames,
                            },
                          };
                        });
                      }}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-extrabold text-center"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from({ length: session.groupSource.manualGroupCount }, (_, idx) => (
                      <input
                        key={idx}
                        type="text"
                        disabled={isLockedRunning}
                        value={session.groupSource.manualGroupNames[idx] ?? `Nhóm ${idx + 1}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          commitSession((prev) => {
                            const nextNames = prev.groupSource.manualGroupNames.slice();
                            nextNames[idx] = val;
                            return {
                              ...prev,
                              groupSource: { ...prev.groupSource, manualGroupNames: nextNames },
                            };
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Mode-Specific Settings */}
            {session.mode === 'station_rotation' && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Danh sách trạm ({session.stationConfig.stations.length})
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isLockedRunning}
                      onClick={() => setShowStationPasteBox((p) => !p)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                    >
                      Dán nhanh
                    </button>
                    <button
                      type="button"
                      disabled={isLockedRunning || session.stationConfig.stations.length >= 12}
                      onClick={() =>
                        commitSession((prev) => ({
                          ...prev,
                          stationConfig: {
                            ...prev.stationConfig,
                            stations: [
                              ...prev.stationConfig.stations,
                              {
                                id: `st_${Date.now().toString(36)}`,
                                title: `Trạm ${prev.stationConfig.stations.length + 1}`,
                                task: 'Nhập nhiệm vụ trạm tại đây.',
                                capacity: 1,
                                materials: '',
                              },
                            ],
                          },
                        }))
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1769F4] text-white text-[11px] font-bold cursor-pointer disabled:opacity-45"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm trạm</span>
                    </button>
                  </div>
                </div>

                {showStationPasteBox && (
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
                    <textarea
                      rows={3}
                      value={pasteStationsDraft}
                      onChange={(e) => setPasteStationsDraft(e.target.value)}
                      placeholder="Mỗi dòng dạng: Trạm Quan sát: Quan sát thí nghiệm và ghi kết quả"
                      className="w-full p-2 rounded-lg border border-sky-300 bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseStationsMultiline(pasteStationsDraft);
                        if (parsed.length > 0) {
                          commitSession((prev) => ({
                            ...prev,
                            stationConfig: { ...prev.stationConfig, stations: parsed },
                          }));
                          setShowStationPasteBox(false);
                          setPasteStationsDraft('');
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-[#1769F4] text-white text-xs font-extrabold cursor-pointer"
                    >
                      Nạp danh sách trạm
                    </button>
                  </div>
                )}

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {session.stationConfig.stations.map((st, idx) => (
                    <div key={st.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          disabled={isLockedRunning}
                          value={st.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            commitSession((prev) => ({
                              ...prev,
                              stationConfig: {
                                ...prev.stationConfig,
                                stations: prev.stationConfig.stations.map((item, i) =>
                                  i === idx ? { ...item, title: val } : item
                                ),
                              },
                            }));
                          }}
                          className="flex-1 px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                          placeholder={`Tên trạm ${idx + 1}`}
                        />
                        <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 shrink-0">
                          <span>Chỗ:</span>
                          <input
                            type="number"
                            min={1}
                            max={12}
                            disabled={isLockedRunning}
                            value={st.capacity}
                            onChange={(e) => {
                              const cap = Math.max(1, Math.min(12, Number(e.target.value || 1)));
                              commitSession((prev) => ({
                                ...prev,
                                stationConfig: {
                                  ...prev.stationConfig,
                                  stations: prev.stationConfig.stations.map((item, i) =>
                                    i === idx ? { ...item, capacity: cap } : item
                                  ),
                                },
                              }));
                            }}
                            className="w-12 px-1.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-center"
                          />
                        </label>
                        {session.stationConfig.stations.length > 1 && (
                          <button
                            type="button"
                            disabled={isLockedRunning}
                            onClick={() =>
                              commitSession((prev) => ({
                                ...prev,
                                stationConfig: {
                                  ...prev.stationConfig,
                                  stations: prev.stationConfig.stations.filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Xóa trạm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        disabled={isLockedRunning}
                        value={st.task}
                        onChange={(e) => {
                          const val = e.target.value;
                          commitSession((prev) => ({
                            ...prev,
                            stationConfig: {
                              ...prev.stationConfig,
                              stations: prev.stationConfig.stations.map((item, i) =>
                                i === idx ? { ...item, task: val } : item
                              ),
                            },
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs"
                        placeholder="Nhiệm vụ của học sinh tại trạm"
                      />
                      <input
                        type="text"
                        disabled={isLockedRunning}
                        value={st.materials}
                        onChange={(e) => {
                          const val = e.target.value;
                          commitSession((prev) => ({
                            ...prev,
                            stationConfig: {
                              ...prev.stationConfig,
                              stations: prev.stationConfig.stations.map((item, i) =>
                                i === idx ? { ...item, materials: val } : item
                              ),
                            },
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-600"
                        placeholder="Giáo cụ / Tài liệu đi kèm (tùy chọn)"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="space-y-1 text-xs font-bold text-slate-700">
                    <span>Thời gian mỗi trạm (giây)</span>
                    <input
                      type="number"
                      min={15}
                      max={3600}
                      disabled={isLockedRunning}
                      value={session.stationConfig.workSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          stationConfig: {
                            ...prev.stationConfig,
                            workSeconds: Math.max(15, Number(e.target.value || 60)),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-700">
                    <span>Chuyển trạm (giây, 0 = bỏ qua)</span>
                    <input
                      type="number"
                      min={0}
                      max={300}
                      disabled={isLockedRunning}
                      value={session.stationConfig.transitionSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          stationConfig: {
                            ...prev.stationConfig,
                            transitionSeconds: Math.max(0, Number(e.target.value || 0)),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLockedRunning}
                    checked={session.stationConfig.allowWaitingTurns}
                    onChange={(e) =>
                      commitSession((prev) => ({
                        ...prev,
                        stationConfig: {
                          ...prev.stationConfig,
                          allowWaitingTurns: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Cho phép chia lượt chờ (Nhóm chờ) nếu số nhóm vượt tổng chỗ</span>
                </label>
              </div>
            )}

            {session.mode === 'jigsaw' && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Chủ đề chuyên gia ({session.jigsawConfig.topics.length}/6)
                  </h3>
                  <button
                    type="button"
                    disabled={isLockedRunning || session.jigsawConfig.topics.length >= 6}
                    onClick={() =>
                      commitSession((prev) => ({
                        ...prev,
                        jigsawConfig: {
                          ...prev.jigsawConfig,
                          topics: [
                            ...prev.jigsawConfig.topics,
                            {
                              id: `top_${Date.now().toString(36)}`,
                              title: `Chủ đề ${prev.jigsawConfig.topics.length + 1}`,
                              task: 'Nghiên cứu nội dung chủ đề và chuẩn bị chia sẻ.',
                              materials: '',
                            },
                          ],
                        },
                      }))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1769F4] text-white text-[11px] font-bold cursor-pointer disabled:opacity-45"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm chủ đề</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {session.jigsawConfig.topics.map((tp, idx) => (
                    <div key={tp.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          disabled={isLockedRunning}
                          value={tp.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            commitSession((prev) => ({
                              ...prev,
                              jigsawConfig: {
                                ...prev.jigsawConfig,
                                topics: prev.jigsawConfig.topics.map((item, i) =>
                                  i === idx ? { ...item, title: val } : item
                                ),
                              },
                            }));
                          }}
                          className="flex-1 px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                        />
                        {session.jigsawConfig.topics.length > 2 && (
                          <button
                            type="button"
                            disabled={isLockedRunning}
                            onClick={() =>
                              commitSession((prev) => ({
                                ...prev,
                                jigsawConfig: {
                                  ...prev.jigsawConfig,
                                  topics: prev.jigsawConfig.topics.filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        disabled={isLockedRunning}
                        value={tp.task}
                        onChange={(e) => {
                          const val = e.target.value;
                          commitSession((prev) => ({
                            ...prev,
                            jigsawConfig: {
                              ...prev.jigsawConfig,
                              topics: prev.jigsawConfig.topics.map((item, i) =>
                                i === idx ? { ...item, task: val } : item
                              ),
                            },
                          }));
                        }}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs"
                        placeholder="Yêu cầu thảo luận chuyên gia"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="space-y-1 text-[11px] font-bold text-slate-700">
                    <span>Chuyên gia (giây)</span>
                    <input
                      type="number"
                      min={15}
                      disabled={isLockedRunning}
                      value={session.jigsawConfig.expertSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          jigsawConfig: {
                            ...prev.jigsawConfig,
                            expertSeconds: Math.max(15, Number(e.target.value || 60)),
                          },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                  <label className="space-y-1 text-[11px] font-bold text-slate-700">
                    <span>Di chuyển (giây)</span>
                    <input
                      type="number"
                      min={0}
                      disabled={isLockedRunning}
                      value={session.jigsawConfig.moveSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          jigsawConfig: {
                            ...prev.jigsawConfig,
                            moveSeconds: Math.max(0, Number(e.target.value || 0)),
                          },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                  <label className="space-y-1 text-[11px] font-bold text-slate-700">
                    <span>Mảnh ghép (giây)</span>
                    <input
                      type="number"
                      min={15}
                      disabled={isLockedRunning}
                      value={session.jigsawConfig.homeShareSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          jigsawConfig: {
                            ...prev.jigsawConfig,
                            homeShareSeconds: Math.max(15, Number(e.target.value || 60)),
                          },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLockedRunning}
                    checked={session.jigsawConfig.allowDualExpertRole}
                    onChange={(e) =>
                      commitSession((prev) => ({
                        ...prev,
                        jigsawConfig: {
                          ...prev.jigsawConfig,
                          allowDualExpertRole: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Cho phép HS đóng vai kép (chia nhiều lượt chuyên gia) nếu nhóm thiếu người</span>
                </label>
              </div>
            )}

            {session.mode === 'tablecloth' && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Câu hỏi trung tâm chung cho cả lớp
                  </label>
                  <textarea
                    rows={3}
                    disabled={isLockedRunning}
                    value={session.tableclothConfig.sharedPrompt}
                    onChange={(e) =>
                      commitSession((prev) => ({
                        ...prev,
                        tableclothConfig: {
                          ...prev.tableclothConfig,
                          sharedPrompt: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLockedRunning}
                    checked={session.tableclothConfig.usePerGroupPrompts}
                    onChange={(e) =>
                      commitSession((prev) => ({
                        ...prev,
                        tableclothConfig: {
                          ...prev.tableclothConfig,
                          usePerGroupPrompts: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Giao câu hỏi riêng theo từng nhóm</span>
                </label>

                {session.tableclothConfig.usePerGroupPrompts && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {activeGroups.map((g) => (
                      <input
                        key={g.id}
                        type="text"
                        disabled={isLockedRunning}
                        value={session.tableclothConfig.perGroupPrompts[g.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          commitSession((prev) => ({
                            ...prev,
                            tableclothConfig: {
                              ...prev.tableclothConfig,
                              perGroupPrompts: {
                                ...prev.tableclothConfig.perGroupPrompts,
                                [g.id]: val,
                              },
                            },
                          }));
                        }}
                        placeholder={`Câu hỏi riêng cho ${g.name}`}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    ))}
                  </div>
                )}

                {session.groupSource.sourceMode === 'names_only' && (
                  <label className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                    <span>Số ô cá nhân mỗi nhóm (tổ chức trên giấy):</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      disabled={isLockedRunning}
                      value={session.tableclothConfig.manualBoxCountPerGroup}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          tableclothConfig: {
                            ...prev.tableclothConfig,
                            manualBoxCountPerGroup: Math.max(
                              1,
                              Math.min(10, Number(e.target.value || 4))
                            ),
                          },
                        }))
                      }
                      className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-center font-extrabold"
                    />
                  </label>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="space-y-1 text-xs font-bold text-slate-700">
                    <span>Pha 1 · Cá nhân (giây)</span>
                    <input
                      type="number"
                      min={15}
                      disabled={isLockedRunning}
                      value={session.tableclothConfig.individualSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          tableclothConfig: {
                            ...prev.tableclothConfig,
                            individualSeconds: Math.max(15, Number(e.target.value || 60)),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-700">
                    <span>Pha 2 · Thống nhất (giây)</span>
                    <input
                      type="number"
                      min={15}
                      disabled={isLockedRunning}
                      value={session.tableclothConfig.consensusSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          tableclothConfig: {
                            ...prev.tableclothConfig,
                            consensusSeconds: Math.max(15, Number(e.target.value || 60)),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                </div>
              </div>
            )}

            {session.mode === 'gallery_walk' && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Sản phẩm / Gian trưng bày theo nhóm ({activeGroups.length})
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activeGroups.map((g, idx) => {
                    const prod = session.galleryConfig.products[g.id];
                    return (
                      <div key={g.id} className="p-2 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold text-[#6D28D9]">
                            Gian #{idx + 1} · {g.name}
                          </span>
                          <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1769F4] cursor-pointer">
                            <ImagePlus className="w-3.5 h-3.5" />
                            <span>{prod?.imageUrl ? 'Đổi ảnh' : 'Ảnh sản phẩm'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const objectUrl = URL.createObjectURL(file);
                                commitSession((prev) => ({
                                  ...prev,
                                  galleryConfig: {
                                    ...prev.galleryConfig,
                                    products: {
                                      ...prev.galleryConfig.products,
                                      [g.id]: {
                                        title: prod?.title || `Sản phẩm ${g.name}`,
                                        subtitle: prod?.subtitle || '',
                                        imageUrl: objectUrl,
                                      },
                                    },
                                  },
                                }));
                              }}
                            />
                          </label>
                        </div>
                        <input
                          type="text"
                          value={prod?.title || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            commitSession((prev) => ({
                              ...prev,
                              galleryConfig: {
                                ...prev.galleryConfig,
                                products: {
                                  ...prev.galleryConfig.products,
                                  [g.id]: {
                                    title: val,
                                    subtitle: prod?.subtitle || '',
                                    imageUrl: prod?.imageUrl,
                                  },
                                },
                              },
                            }));
                          }}
                          placeholder={`Tên sản phẩm số ${idx + 1} (VD: Poster Nhóm ${idx + 1})`}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="space-y-1 text-[11px] font-bold text-slate-700">
                    <span>Mỗi lượt (giây)</span>
                    <input
                      type="number"
                      min={15}
                      disabled={isLockedRunning}
                      value={session.galleryConfig.visitSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          galleryConfig: {
                            ...prev.galleryConfig,
                            visitSeconds: Math.max(15, Number(e.target.value || 60)),
                          },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                  <label className="space-y-1 text-[11px] font-bold text-slate-700">
                    <span>Chuyển lượt (giây)</span>
                    <input
                      type="number"
                      min={0}
                      disabled={isLockedRunning}
                      value={session.galleryConfig.transitionSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          galleryConfig: {
                            ...prev.galleryConfig,
                            transitionSeconds: Math.max(0, Number(e.target.value || 0)),
                          },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold"
                    />
                  </label>
                  <label className="space-y-1 text-[11px] font-bold text-slate-700">
                    <span>Tổng hợp cuối</span>
                    <input
                      type="number"
                      min={15}
                      disabled={isLockedRunning || !session.galleryConfig.includeFinalReviewPhase}
                      value={session.galleryConfig.finalReviewSeconds}
                      onChange={(e) =>
                        commitSession((prev) => ({
                          ...prev,
                          galleryConfig: {
                            ...prev.galleryConfig,
                            finalReviewSeconds: Math.max(15, Number(e.target.value || 60)),
                          },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold disabled:opacity-50"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLockedRunning}
                    checked={session.galleryConfig.includeFinalReviewPhase}
                    onChange={(e) =>
                      commitSession((prev) => ({
                        ...prev,
                        galleryConfig: {
                          ...prev.galleryConfig,
                          includeFinalReviewPhase: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Có pha cuối để mỗi nhóm quay về đọc góp ý trên sản phẩm của mình</span>
                </label>
              </div>
            )}

            {/* 3. Auto-advance, Bell, Private Teacher Note & Total Time Box */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={session.autoAdvance}
                    onChange={(e) =>
                      commitSession((prev) => ({ ...prev, autoAdvance: e.target.checked }))
                    }
                  />
                  <span>Hết giờ tự chuyển pha</span>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    commitSession((prev) => ({ ...prev, bellMuted: !prev.bellMuted }))
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {effectiveMuted ? (
                    <>
                      <BellOff className="w-3.5 h-3.5 text-rose-500" />
                      <span>Chuông tắt</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Chuông bật</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">
                  Ghi chú riêng của giáo viên (tự ẩn khi bật Chế độ chiếu):
                </label>
                <input
                  type="text"
                  value={session.teacherPrivateNote}
                  onChange={(e) =>
                    commitSession((prev) => ({ ...prev, teacherPrivateNote: e.target.value }))
                  }
                  placeholder="Nhắc nhở quan sát học sinh, chốt kiến thức..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700"
                />
              </div>

              {/* Predicted Total Duration Banner */}
              <div className="p-3 rounded-xl bg-[#F0F7FF] border border-[#DCE8F7] flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-slate-600 uppercase">Tổng thời lượng dự kiến</p>
                  <p className="text-base font-extrabold text-[#082B52]">
                    {formatDurationVietnamese(activeSchedule.totalDurationSeconds)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-[#1769F4]">
                    {activeSchedule.totalPhases} pha ({activeSchedule.totalRounds} vòng)
                  </p>
                  <p className="text-[11px] text-slate-500">{activeGroups.length} nhóm</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: ACTIVE PHASE, LARGE CLOCK, PROGRESS, LIVE CARDS & CONTROLS */}
        <section className="lg:col-span-7 space-y-4">
          {/* Validation Errors / Warnings */}
          {activeSchedule.errors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2.5">
              {activeSchedule.errors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm font-bold text-rose-900">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
              {session.mode === 'jigsaw' && activeSchedule.jigsawMissingTopicsInfo && (
                <div className="flex flex-wrap gap-2 pt-1 pl-7">
                  <button
                    type="button"
                    onClick={() =>
                      commitSession((prev) => ({
                        ...prev,
                        jigsawConfig: {
                          ...prev.jigsawConfig,
                          topics: prev.jigsawConfig.topics.slice(
                            0,
                            Math.max(2, activeSchedule.jigsawMissingTopicsInfo!.recommendedMaxTopics)
                          ),
                        },
                      }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-xs font-extrabold text-rose-900 hover:bg-rose-100 cursor-pointer"
                  >
                    Giảm xuống {Math.max(2, activeSchedule.jigsawMissingTopicsInfo.recommendedMaxTopics)} chủ đề
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitSession((prev) => ({
                        ...prev,
                        jigsawConfig: { ...prev.jigsawConfig, allowDualExpertRole: true },
                      }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 cursor-pointer"
                  >
                    Bật HS đóng vai kép (nhiều lượt)
                  </button>
                  {onGoToGroups && (
                    <button
                      type="button"
                      onClick={onGoToGroups}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      Chia lại nhóm
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSchedule.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1">
              {activeSchedule.warnings.map((w, idx) => (
                <p key={idx} className="text-xs font-semibold text-amber-950">
                  • {w}
                </p>
              ))}
            </div>
          )}

          {/* Post-Completion Summary Panel */}
          {session.status === 'completed' && (
            <ActivitySummaryPanel
              session={session}
              schedule={activeSchedule}
              groups={activeGroups}
              onResetToIdle={handleResetToIdle}
              onSavePackage={handleSavePackageClick}
              onOpenPrintModal={handleOpenPrint}
            />
          )}

          {/* Active Stage Controller Card */}
          <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-xs p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#082B52] text-white">
                    Vòng {currentPhase?.roundNumber || 1}/{activeSchedule.totalRounds || 1}
                  </span>
                  {distinctPhaseAndRound && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#F0F7FF] text-[#1769F4] border border-[#DCE8F7]">
                      Pha {session.currentPhaseIndex + 1}/{activeSchedule.totalPhases}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-lg ${
                      session.status === 'running'
                        ? 'bg-emerald-100 text-emerald-800'
                        : session.status === 'paused'
                        ? 'bg-amber-100 text-amber-900'
                        : session.status === 'completed'
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-sky-50 text-sky-800'
                    }`}
                  >
                    {session.status === 'running'
                      ? 'Đang chạy'
                      : session.status === 'paused'
                      ? 'Đang tạm dừng'
                      : session.status === 'completed'
                      ? 'Đã tổng kết'
                      : 'Sẵn sàng'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#082B52]">
                  {currentPhase?.title || 'Chưa có pha hợp lệ'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  {currentPhase?.instructions || 'Hoàn tất cấu hình bên trái để bắt đầu điều phối.'}
                </p>
              </div>

              {/* Large Monospace Timer */}
              <div className="text-left sm:text-right shrink-0">
                <div className="text-4xl sm:text-5xl font-extrabold font-mono-num text-[#082B52] tracking-tight">
                  {formatClockMMSS(currentTickSnapshot.displaySeconds)}
                </div>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  Thời lượng pha: {formatDurationVietnamese(currentPhase?.durationSeconds || 0)}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  currentPhase?.isTransition ? 'bg-amber-500' : 'bg-[#1769F4]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, currentTickSnapshot.progressRatio * 100))}%` }}
              />
            </div>

            {/* Primary Transport Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {session.status === 'idle' ? (
                  <button
                    type="button"
                    disabled={!activeSchedule.canStart}
                    onClick={handleStart}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-sm font-extrabold cursor-pointer shadow-xs"
                  >
                    <Play className="w-4 h-4" />
                    <span>Bắt đầu</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    disabled={session.status === 'completed'}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] disabled:opacity-45 text-white text-sm font-extrabold cursor-pointer shadow-xs"
                  >
                    {session.status === 'running' ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>Tạm dừng</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Tiếp tục</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  disabled={session.status === 'idle' || session.currentPhaseIndex <= 0}
                  onClick={handlePrevPhase}
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-extrabold cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Pha trước</span>
                </button>

                <button
                  type="button"
                  disabled={session.status === 'idle' || session.status === 'completed'}
                  onClick={handleNextPhase}
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-extrabold cursor-pointer"
                >
                  <span>Pha tiếp theo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {session.status !== 'idle' && session.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={handleFinish}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 text-xs font-extrabold cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Kết thúc</span>
                  </button>
                )}
                {session.status !== 'idle' && (
                  <button
                    type="button"
                    onClick={handleResetToIdle}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Làm lại</span>
                  </button>
                )}
              </div>
            </div>

            {/* Print Shortcut Pills directly under Controls */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">Phiếu in nhanh:</span>
              {availablePrintDocs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={!activeSchedule.canStart}
                  onClick={() => handleOpenPrint(d.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-[#1769F4] text-[11px] font-bold text-[#082B52] cursor-pointer disabled:opacity-45"
                >
                  <Printer className="w-3 h-3 text-[#1769F4]" />
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Tablecloth Digital Board (when Tablecloth tab is active) */}
          {session.mode === 'tablecloth' && activeGroups.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-xs p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-[#082B52]">
                    Mô phỏng Khăn trải bàn theo nhóm
                  </h4>
                  <p className="text-xs text-slate-500">
                    {session.currentPhaseIndex === 0
                      ? 'Đang ở Pha 1 (Cá nhân): các góc xung quanh mở, ô trung tâm sẽ mở ở Pha 2.'
                      : 'Đang ở Pha 2 (Thống nhất): ô trung tâm đã mở để ghi kết luận chung.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {activeGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedTableclothGroupId(g.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                        selectedTableclothGroupId === g.id
                          ? 'bg-[#082B52] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const grp =
                  activeGroups.find((g) => g.id === selectedTableclothGroupId) || activeGroups[0];
                const isPhase2 = session.currentPhaseIndex >= 1 || session.status === 'completed';
                const boxCount = grp.effectiveMemberCount;
                const prompt =
                  session.tableclothConfig.usePerGroupPrompts &&
                  session.tableclothConfig.perGroupPrompts[grp.id]?.trim()
                    ? session.tableclothConfig.perGroupPrompts[grp.id].trim()
                    : session.tableclothConfig.sharedPrompt;

                return (
                  <div className="space-y-3 p-3 rounded-xl bg-amber-50/40 border border-amber-200">
                    <p className="text-xs font-bold text-amber-950">
                      Câu hỏi của {grp.name}: {prompt}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Array.from({ length: boxCount }, (_, slotIdx) => {
                        const member = grp.members[slotIdx];
                        const val = session.tableclothNotes.individualNotes[grp.id]?.[slotIdx] || '';
                        return (
                          <div key={slotIdx} className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-1">
                            <span className="text-[11px] font-extrabold text-slate-700 block">
                              {member ? `Góc ${slotIdx + 1}: ${member.displayName}` : `Góc cá nhân ${slotIdx + 1}`}
                            </span>
                            <textarea
                              rows={2}
                              value={val}
                              onChange={(e) => {
                                const txt = e.target.value;
                                commitSession((prev) => ({
                                  ...prev,
                                  tableclothNotes: {
                                    ...prev.tableclothNotes,
                                    individualNotes: {
                                      ...prev.tableclothNotes.individualNotes,
                                      [grp.id]: {
                                        ...(prev.tableclothNotes.individualNotes[grp.id] || {}),
                                        [slotIdx]: txt,
                                      },
                                    },
                                  },
                                }));
                              }}
                              placeholder="Ý kiến cá nhân (Pha 1)..."
                              className="w-full text-xs p-1.5 rounded border border-slate-200"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className={`p-3 rounded-xl border-2 space-y-1.5 ${
                        isPhase2
                          ? 'bg-emerald-50 border-emerald-400'
                          : 'bg-slate-100 border-dashed border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span className="flex items-center gap-1.5 text-[#082B52]">
                          {isPhase2 ? <Unlock className="w-4 h-4 text-emerald-600" /> : <Lock className="w-4 h-4 text-slate-500" />}
                          <span>Ô TRUNG TÂM · THỐNG NHẤT NHÓM</span>
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {isPhase2 ? 'Đã mở khóa' : 'Điền ở bước 2'}
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        disabled={!isPhase2}
                        value={session.tableclothNotes.consensusNotes[grp.id] || ''}
                        onChange={(e) => {
                          const txt = e.target.value;
                          commitSession((prev) => ({
                            ...prev,
                            tableclothNotes: {
                              ...prev.tableclothNotes,
                              consensusNotes: {
                                ...prev.tableclothNotes.consensusNotes,
                                [grp.id]: txt,
                              },
                            },
                          }));
                        }}
                        placeholder={
                          isPhase2
                            ? 'Nhập kết luận chung sau khi cả nhóm thảo luận...'
                            : 'Ô trung tâm sẽ mở khi chuyển sang Pha 2 · Thảo luận và thống nhất'
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Quick Gallery Feedback Recorder (when Gallery Walk is active) */}
          {session.mode === 'gallery_walk' && activeGroups.length >= 2 && (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-xs p-4 space-y-3">
              <h4 className="text-sm font-extrabold text-[#082B52]">
                Ghi nhanh góp ý Phòng tranh (tùy chọn lưu trên máy chiếu)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={feedbackDraft.fromGroupId || activeGroups[0].id}
                  onChange={(e) => setFeedbackDraft((d) => ({ ...d, fromGroupId: e.target.value }))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                >
                  {activeGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      Nhóm góp ý: {g.name}
                    </option>
                  ))}
                </select>
                <select
                  value={feedbackDraft.targetGroupId || activeGroups[1].id}
                  onChange={(e) => setFeedbackDraft((d) => ({ ...d, targetGroupId: e.target.value }))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                >
                  {activeGroups.map((g, idx) => (
                    <option key={g.id} value={g.id}>
                      Cho Tranh #{idx + 1} ({g.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={feedbackDraft.strength}
                  onChange={(e) => setFeedbackDraft((d) => ({ ...d, strength: e.target.value }))}
                  placeholder="1 điểm mạnh..."
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  value={feedbackDraft.question}
                  onChange={(e) => setFeedbackDraft((d) => ({ ...d, question: e.target.value }))}
                  placeholder="1 câu hỏi..."
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  value={feedbackDraft.suggestion}
                  onChange={(e) => setFeedbackDraft((d) => ({ ...d, suggestion: e.target.value }))}
                  placeholder="1 đề xuất..."
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const fromId = feedbackDraft.fromGroupId || activeGroups[0].id;
                  const targetId = feedbackDraft.targetGroupId || activeGroups[1].id;
                  const fromGrp = activeGroups.find((g) => g.id === fromId) || activeGroups[0];
                  const targetIdx = activeGroups.findIndex((g) => g.id === targetId);
                  if (!feedbackDraft.strength.trim() && !feedbackDraft.question.trim() && !feedbackDraft.suggestion.trim()) {
                    return;
                  }
                  commitSession((prev) => ({
                    ...prev,
                    galleryFeedbacks: [
                      ...prev.galleryFeedbacks,
                      {
                        id: `fb_${Date.now().toString(36)}`,
                        fromGroupId: fromGrp.id,
                        fromGroupName: fromGrp.name,
                        targetGroupId: targetId,
                        targetProductNumber: (targetIdx >= 0 ? targetIdx : 1) + 1,
                        strength: feedbackDraft.strength.trim(),
                        question: feedbackDraft.question.trim(),
                        suggestion: feedbackDraft.suggestion.trim(),
                      },
                    ],
                  }));
                  setFeedbackDraft((d) => ({ ...d, strength: '', question: '', suggestion: '' }));
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-extrabold cursor-pointer"
              >
                Lưu góp ý
              </button>
            </div>
          )}

          {/* Current Phase Assignment Cards Grid */}
          {currentPhase && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {currentPhase.cards.map((card) => {
                const imgUrl = typeof card.meta?.imageUrl === 'string' ? card.meta.imageUrl : '';
                return (
                  <article
                    key={card.cardId}
                    className={`rounded-2xl border p-4 space-y-2.5 ${
                      card.isWaiting
                        ? 'bg-slate-100 border-slate-300 text-slate-700'
                        : 'bg-white border-[#DCE8F7] shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-extrabold text-white"
                        style={{ backgroundColor: card.accentColor }}
                      >
                        {card.badge}
                      </span>
                      {card.subtitle && (
                        <span className="text-[11px] font-bold text-slate-500">{card.subtitle}</span>
                      )}
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-[#082B52]">
                      {card.title}
                    </h4>

                    {imgUrl && (
                      <img
                        src={imgUrl}
                        alt={card.title}
                        className="w-full h-24 object-cover rounded-xl border border-slate-200"
                      />
                    )}

                    <p className="text-xs text-slate-700 leading-relaxed">{card.body}</p>

                    {card.materials && (
                      <p className="text-[11px] font-semibold text-slate-500">
                        Tài liệu: {card.materials}
                      </p>
                    )}

                    {card.members && card.members.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {card.members.map((m) => (
                          <span
                            key={m.id}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold"
                          >
                            {m.label}
                            {m.homeGroupLabel ? ` (${m.homeGroupLabel})` : ''}
                            {m.roleTag ? ` · ${m.roleTag}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      <ActivityProjectorModal
        isOpen={showProjectorModal}
        classNameLabel={classNameLabel}
        session={session}
        schedule={activeSchedule}
        currentPhase={currentPhase}
        displaySeconds={currentTickSnapshot.displaySeconds}
        progressRatio={currentTickSnapshot.progressRatio}
        reducedMotion={localReducedMotion}
        onClose={() => setShowProjectorModal(false)}
        onTogglePauseResume={handlePauseResume}
        onPrevPhase={handlePrevPhase}
        onNextPhase={handleNextPhase}
        onToggleBellMute={() =>
          commitSession((prev) => ({ ...prev, bellMuted: !prev.bellMuted }))
        }
      />

      <ActivitySchedulePreviewModal
        isOpen={showScheduleModal}
        session={session}
        schedule={activeSchedule}
        groups={activeGroups}
        onClose={() => setShowScheduleModal(false)}
      />

      <ActivityPrintModal
        docType={activePrintDoc}
        classNameLabel={classNameLabel}
        session={session}
        schedule={activeSchedule}
        groups={activeGroups}
        onChangeDocType={setActivePrintDoc}
        onClose={() => setActivePrintDoc(null)}
        onTriggerBrowserPrint={handleTriggerPrint}
      />
    </div>
  );
};
