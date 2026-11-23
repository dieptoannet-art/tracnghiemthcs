import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Box,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Pin,
  Plus,
  Printer,
  RotateCcw,
  Settings2,
  Shuffle,
  SlidersHorizontal,
  Square,
  Trash2,
  Undo2,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { ClassRoom } from '../../../types';
import { playTeachingToolBell } from './teachingToolsAudio';
import type { SeatingState, ToolStudentItem } from './teachingToolsEngine';
import {
  ConfigImpactReport,
  DeskNumberingDirection,
  MAX_SEATING_STUDENTS,
  SeatingAssignmentMode,
  SeatingColorTheme,
  SeatingFlightFrame,
  SeatingLocalClassPreset,
  SeatingNameDisplayMode,
  SeatingProState,
  SeatingRoomConfig,
  SeatingRosterPreviewResult,
  SeatingRosterScope,
  addDeskToAisle,
  adjustDeskSeatCount,
  applyCandidateRoomConfig,
  assignWaitingStudentToSeat,
  buildSeatingChartXlsxBytes,
  buildSeatingFlightPlan,
  buildSeatingSampleXlsxBytes,
  computeSeatingStats,
  createInitialSeatingProState,
  createSeatingSampleStudents,
  evaluateRoomChangeImpact,
  evaluateSeatingFlightFrame,
  exportSeatingChartPngDataUrl,
  extractSeatingXlsxMatrix,
  finalizeSeatingReveal,
  formatIsoDateVi,
  formatStudentDisplayName,
  getAislePaletteByIndex,
  getEligibleSeatingStudents,
  getRoomCapacitySummary,
  getTodayIsoDate,
  getUnassignedStudents,
  indexRoomSeats,
  loadSeatingLocalClasses,
  loadSeatingProState,
  parseSeatingRosterPreview,
  rebuildRoomGridDimensions,
  removeDeskFromAisle,
  resetUnpinnedPlacements,
  runSeatingAssignmentSolver,
  saveSeatingLocalClasses,
  saveSeatingProState,
  swapOrMoveSeatAction,
  syncSeatingWithUpstreamStudents,
  toggleSeatLockAction,
  toggleSeatPinAction,
  undoLastSeatingAction,
} from './seatingProEngine';
import {
  ClassroomMapView,
  SeatingPrintPreviewModal,
  SeatingProjectorModal,
} from './SeatingPrintAndPreview';
import { Seating3DScene } from './Seating3DScene';

export interface SeatingChartToolProps {
  classId?: string;
  classNameLabel: string;
  teacherNameLabel?: string;
  presentStudents: ToolStudentItem[];
  allClassStudents?: ToolStudentItem[];
  seatingState: SeatingState;
  permittedRealClasses?: ClassRoom[];
  accountScopeId?: string;
  isDemoSandbox?: boolean;
  isMutedGlobal?: boolean;
  reducedMotionGlobal?: boolean;
  onToggleMuteGlobal?: () => void;
  onChangeSeatingState: (next: SeatingState) => void;
}

function downloadUint8Bytes(bytes: Uint8Array, filename: string, mime: string) {
  try {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Ignore blocked downloads in headless mode
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  } catch {
    // Ignore cleanly
  }
}

/**
 * Đảm bảo ngay khi mở công cụ Sơ đồ chỗ ngồi lần đầu (chưa có ghế nào được xếp và chưa có lịch sử thao tác),
 * sơ đồ tự động xếp sẵn học sinh vào các dãy để hiển thị ngay màu nền ô học sinh theo dãy (#047857, #0369A1, #4F46E5).
 */
function ensureInitialSeatedState(raw: SeatingProState): SeatingProState {
  const hasAnyAssigned = Object.values(raw.assignments).some((stuId) => Boolean(stuId));
  if (hasAnyAssigned || raw.undoStack.length > 0 || raw.pinnedSeatIds.length > 0) {
    return raw;
  }
  const eligible = getEligibleSeatingStudents(raw);
  if (eligible.length === 0) {
    return raw;
  }

  const solved = runSeatingAssignmentSolver({
    state: raw,
    skipAnimation: true,
  });
  if (solved.ok) {
    return {
      ...solved.nextState,
      activeReveal: null,
      undoStack: [],
    };
  }

  // Trường hợp lớp mẫu 50 HS trên phòng mặc định 36 ghế: xếp trước các ghế khả dụng theo từng bàn/dãy
  const { orderedSeatIds } = indexRoomSeats(raw.room);
  const lockedSet = new Set(raw.lockedSeatIds);
  const availSeats = orderedSeatIds.filter((sId) => !lockedSet.has(sId));
  if (availSeats.length === 0) return raw;

  const nextAssignments: Record<string, string | null> = {};
  orderedSeatIds.forEach((sId) => {
    nextAssignments[sId] = null;
  });
  availSeats.forEach((sId, idx) => {
    if (idx < eligible.length) {
      nextAssignments[sId] = eligible[idx].id;
    }
  });

  return {
    ...raw,
    assignments: nextAssignments,
    activeReveal: null,
  };
}

export const SeatingChartTool: React.FC<SeatingChartToolProps> = ({
  classId = 'default_seating_class',
  classNameLabel,
  teacherNameLabel = 'Giáo viên phụ trách',
  presentStudents,
  allClassStudents,
  seatingState,
  permittedRealClasses = [],
  accountScopeId = 'guest_teacher',
  isDemoSandbox = false,
  isMutedGlobal = false,
  reducedMotionGlobal = false,
  onToggleMuteGlobal,
  onChangeSeatingState,
}) => {
  // Local sample / imported class presets
  const [localPresets, setLocalPresets] = useState<SeatingLocalClassPreset[]>(() => {
    const existing = loadSeatingLocalClasses(accountScopeId);
    if (existing.length > 0) return existing;
    if (permittedRealClasses.length === 0 && presentStudents.length === 0 && (!allClassStudents || allClassStudents.length === 0)) {
      const def: SeatingLocalClassPreset = {
        id: 'seating_sample_standard_36',
        name: 'Lớp mẫu 36 HS (3 dãy × 6 bàn × 2 chỗ)',
        teacherName: teacherNameLabel,
        sourceType: 'sample_editable',
        students: createSeatingSampleStudents('standard_36'),
      };
      saveSeatingLocalClasses([def], accountScopeId);
      return [def];
    }
    return [];
  });
  const [selectedSourceId, setSelectedSourceId] = useState<string>(() => {
    if (permittedRealClasses.length === 0 && presentStudents.length === 0 && (!allClassStudents || allClassStudents.length === 0)) {
      return 'seating_sample_standard_36';
    }
    return classId;
  });

  useEffect(() => {
    setLocalPresets(loadSeatingLocalClasses(accountScopeId));
  }, [accountScopeId]);

  useEffect(() => {
    if (classId && !localPresets.some((p) => p.id === selectedSourceId)) {
      setSelectedSourceId(classId);
    }
  }, [classId]);

  const activeSourceMeta = useMemo(() => {
    const localMatch = localPresets.find((p) => p.id === selectedSourceId);
    if (localMatch) {
      return {
        id: localMatch.id,
        name: localMatch.name,
        teacherName: localMatch.teacherName,
        sourceType: localMatch.sourceType as 'sample_editable' | 'imported_local',
        students: localMatch.students.map((s) => ({
          id: s.id,
          code: s.code,
          fullName: s.fullName,
          present: s.present,
        })),
        isExternalRealClass: false,
      };
    }

    const permMatch = permittedRealClasses.find((c) => c.id === selectedSourceId);
    if (permMatch) {
      return {
        id: permMatch.id,
        name: permMatch.name,
        teacherName: permMatch.teacherName || teacherNameLabel,
        sourceType: (isDemoSandbox ? 'sample_editable' : 'real_readonly') as
          | 'real_readonly'
          | 'sample_editable',
        students: (permMatch.students || []).map((st, idx) => ({
          id: st.id || `${permMatch.id}_s_${idx + 1}`,
          code: String(st.code || String(idx + 1).padStart(3, '0')),
          fullName: st.fullName || `Học sinh ${idx + 1}`,
          present: true,
        })),
        isExternalRealClass: permMatch.id === classId,
      };
    }

    const baseList = allClassStudents && allClassStudents.length > 0 ? allClassStudents : presentStudents;
    return {
      id: classId,
      name: classNameLabel,
      teacherName: teacherNameLabel,
      sourceType: (isDemoSandbox ? 'sample_editable' : 'real_readonly') as
        | 'real_readonly'
        | 'sample_editable',
      students: baseList.map((s) => ({
        id: s.id,
        code: s.code,
        fullName: s.fullName,
        present: presentStudents.some((p) => p.id === s.id),
      })),
      isExternalRealClass: true,
    };
  }, [
    selectedSourceId,
    localPresets,
    permittedRealClasses,
    classId,
    classNameLabel,
    teacherNameLabel,
    allClassStudents,
    presentStudents,
    isDemoSandbox,
  ]);

  const [state, setState] = useState<SeatingProState>(() => {
    const saved = loadSeatingProState(activeSourceMeta.id, accountScopeId);
    if (saved) {
      return ensureInitialSeatedState(
        syncSeatingWithUpstreamStudents(
          saved,
          activeSourceMeta.students.map((s) => ({
            id: s.id,
            code: s.code,
            fullName: s.fullName,
          }))
        )
      );
    }
    return ensureInitialSeatedState(
      createInitialSeatingProState({
        classId: activeSourceMeta.id,
        className: activeSourceMeta.name,
        teacherName: activeSourceMeta.teacherName,
        sourceType: activeSourceMeta.sourceType,
        students: activeSourceMeta.students,
        legacySeating: activeSourceMeta.id === classId ? seatingState : null,
      })
    );
  });

  // Reload state whenever active source class or account scope changes
  useEffect(() => {
    const saved = loadSeatingProState(activeSourceMeta.id, accountScopeId);
    if (saved) {
      const synced = ensureInitialSeatedState(
        syncSeatingWithUpstreamStudents(
          saved,
          activeSourceMeta.students.map((s) => ({
            id: s.id,
            code: s.code,
            fullName: s.fullName,
          }))
        )
      );
      setState(synced);
      saveSeatingProState(synced, accountScopeId);
    } else {
      const fresh = ensureInitialSeatedState(
        createInitialSeatingProState({
          classId: activeSourceMeta.id,
          className: activeSourceMeta.name,
          teacherName: activeSourceMeta.teacherName,
          sourceType: activeSourceMeta.sourceType,
          students: activeSourceMeta.students,
          legacySeating: activeSourceMeta.id === classId ? seatingState : null,
        })
      );
      setState(fresh);
      saveSeatingProState(fresh, accountScopeId);
    }
    setSelectedSeatId(null);
    setSelectedWaitingId(null);
  }, [activeSourceMeta.id, accountScopeId]);

  const commitState = useCallback(
    (next: SeatingProState) => {
      const stamped: SeatingProState = {
        ...next,
        updatedAtMs: Date.now(),
      };
      setState(stamped);
      saveSeatingProState(stamped, accountScopeId);

      // Sync lightweight orientation/dimensions back to legacy ClassTeachingSessionState if editing active hub class
      if (stamped.classId === classId) {
        onChangeSeatingState({
          ...seatingState,
          rows: Math.max(1, Math.min(12, stamped.room.defaultDesksPerAisle)),
          cols: Math.max(1, Math.min(12, stamped.room.aisleCount * stamped.room.defaultSeatsPerDesk)),
          orientation: stamped.orientation,
          lastError: stamped.lastError,
        });
      }
    },
    [accountScopeId, classId, onChangeSeatingState, seatingState]
  );

  // Local UI state
  const [localMuted, setLocalMuted] = useState<boolean>(isMutedGlobal);
  const effectiveMuted = onToggleMuteGlobal ? isMutedGlobal : localMuted;
  const handleToggleSound = () => {
    if (onToggleMuteGlobal) onToggleMuteGlobal();
    else setLocalMuted((m) => !m);
  };

  const [editToolMode, setEditToolMode] = useState<'swap' | 'lock' | 'pin'>('swap');
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedWaitingId, setSelectedWaitingId] = useState<string | null>(null);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [openAccordions, setOpenAccordions] = useState<{
    info: boolean;
    room: boolean;
    students: boolean;
    constraints: boolean;
  }>({
    info: true,
    room: true,
    students: false,
    constraints: false,
  });

  // Modals
  const [projectorOpen, setProjectorOpen] = useState<boolean>(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState<boolean>(false);
  const [customDesksOpen, setCustomDesksOpen] = useState<boolean>(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [pendingRoomImpact, setPendingRoomImpact] = useState<{
    candidateRoom: SeatingRoomConfig;
    report: ConfigImpactReport;
  } | null>(null);
  const [pendingLockConfirm, setPendingLockConfirm] = useState<{
    seatId: string;
    seatLabel: string;
    studentName: string;
  } | null>(null);

  // Import / Paste Modal state
  const [importTab, setImportTab] = useState<'excel' | 'paste_names'>('excel');
  const [importClassName, setImportClassName] = useState<string>('Lớp nhập danh sách');
  const [importPasteText, setImportPasteText] = useState<string>('');
  const [importPreview, setImportPreview] = useState<SeatingRosterPreviewResult | null>(null);

  // Constraint pair selector
  const [pairStudentA, setPairStudentA] = useState<string>('');
  const [pairStudentB, setPairStudentB] = useState<string>('');

  // Status banner
  const [toastMsg, setToastMsg] = useState<string>('');

  // View dimension (2D vs 3D Isometric) & Completion banner
  const [viewDimension, setViewDimension] = useState<'2d' | '3d'>('2d');
  const [completionSummary, setCompletionSummary] = useState<string>('');
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Reveal parabolic flight choreography state
  const [flightFrame, setFlightFrame] = useState<SeatingFlightFrame | null>(null);
  const [remainingAnimMs, setRemainingAnimMs] = useState<number>(0);
  const animRafRef = useRef<number | null>(null);
  const seatRectCacheRef = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({});

  // Escape exits projector cleanly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && projectorOpen) {
        setProjectorOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [projectorOpen]);

  const activeFlightPlan = useMemo(() => {
    const rev = state.activeReveal;
    if (!rev || rev.status !== 'animating') return null;
    const { orderedSeatIds } = indexRoomSeats(state.room);
    return buildSeatingFlightPlan({
      previousAssignments: rev.previousAssignments || {},
      targetAssignments: rev.committedAssignments,
      orderedSeatIds,
      pinnedSeatIds: state.pinnedSeatIds,
      lockedSeatIds: state.lockedSeatIds,
      durationSeconds: rev.durationSeconds,
      revealOrderSeatIds: rev.revealOrderSeatIds,
    });
  }, [state.activeReveal?.turnId, state.activeReveal?.status]);

  const buildCompletionText = useCallback(
    (targetState: SeatingProState) => {
      const finStats = computeSeatingStats(
        targetState.room,
        targetState.assignments,
        targetState.pinnedSeatIds,
        targetState.lockedSeatIds
      );
      const aisleLine = finStats.aisles.map((a) => `${a.aisleName}: ${a.assignedCount} HS`).join(' · ');
      return `Đã xếp chỗ xong (${aisleLine})`;
    },
    []
  );

  // Measure rendered 2D seat coordinates relative to mapContainerRef for floating parabolic cards
  const refreshSeatRects = useCallback(() => {
    const wrap = mapContainerRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const map: Record<string, { x: number; y: number; w: number; h: number }> = {};
    const nodes = wrap.querySelectorAll<HTMLElement>('[data-seat-id]');
    nodes.forEach((el) => {
      const sId = el.getAttribute('data-seat-id');
      if (!sId) return;
      const r = el.getBoundingClientRect();
      map[sId] = {
        x: r.left - wrapRect.left + wrap.scrollLeft,
        y: r.top - wrapRect.top,
        w: r.width,
        h: r.height,
      };
    });
    seatRectCacheRef.current = map;
  }, []);

  // Animation ticker driven by timestamp-anchored parabolic flight plan
  useEffect(() => {
    if (animRafRef.current !== null) {
      window.cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }

    const rev = state.activeReveal;
    if (!rev || rev.status !== 'animating' || !activeFlightPlan) {
      setFlightFrame(null);
      setRemainingAnimMs(0);
      return;
    }

    if (reducedMotionGlobal || rev.durationSeconds <= 0 || activeFlightPlan.moves.length === 0) {
      const done = finalizeSeatingReveal(state);
      commitState(done);
      playTeachingToolBell(effectiveMuted);
      setCompletionSummary(buildCompletionText(done));
      setFlightFrame(null);
      setRemainingAnimMs(0);
      return;
    }

    refreshSeatRects();
    const durationMs = Math.max(400, activeFlightPlan.durationMs);

    const step = () => {
      const elapsed = Math.max(0, Date.now() - rev.startedAtMs);
      const frame = evaluateSeatingFlightFrame(activeFlightPlan, elapsed);
      setFlightFrame(frame);
      setRemainingAnimMs(Math.max(0, durationMs - elapsed));

      if (elapsed >= durationMs || frame.isComplete) {
        animRafRef.current = null;
        const done = finalizeSeatingReveal(state);
        commitState(done);
        playTeachingToolBell(effectiveMuted);
        setCompletionSummary(buildCompletionText(done));
        setFlightFrame(null);
        setRemainingAnimMs(0);
        return;
      }

      if (viewDimension === '2d' && Object.keys(seatRectCacheRef.current).length === 0) {
        refreshSeatRects();
      }
      animRafRef.current = window.requestAnimationFrame(step);
    };

    animRafRef.current = window.requestAnimationFrame(step);
    window.addEventListener('resize', refreshSeatRects);

    return () => {
      window.removeEventListener('resize', refreshSeatRects);
      if (animRafRef.current !== null) {
        window.cancelAnimationFrame(animRafRef.current);
        animRafRef.current = null;
      }
    };
  }, [
    state.activeReveal?.turnId,
    state.activeReveal?.status,
    activeFlightPlan,
    reducedMotionGlobal,
    viewDimension,
    refreshSeatRects,
    buildCompletionText,
  ]);

  useEffect(() => {
    if (viewDimension === '2d') {
      const id = window.requestAnimationFrame(refreshSeatRects);
      return () => window.cancelAnimationFrame(id);
    }
  }, [state.orientation, zoomPercent, viewDimension, refreshSeatRects]);

  const isAnimating = Boolean(state.activeReveal && state.activeReveal.status === 'animating');

  const capacitySummary = useMemo(() => getRoomCapacitySummary(state), [state]);
  const roomSeatIndex = useMemo(() => indexRoomSeats(state.room), [state.room]);
  const eligibleStudents = useMemo(() => getEligibleSeatingStudents(state), [state]);
  const waitingStudents = useMemo(() => getUnassignedStudents(state), [state]);
  const statsSummary = useMemo(
    () =>
      computeSeatingStats(
        state.room,
        state.assignments,
        state.pinnedSeatIds,
        state.lockedSeatIds
      ),
    [state.room, state.assignments, state.pinnedSeatIds, state.lockedSeatIds]
  );

  // Handlers
  const handleRunRandomSeating = (skipAnim: boolean) => {
    setCompletionSummary('');
    if (isAnimating && skipAnim) {
      // "Xem kết quả ngay" while running: stop animation and commit result!
      const finalized = finalizeSeatingReveal(state);
      commitState(finalized);
      playTeachingToolBell(effectiveMuted);
      setCompletionSummary(buildCompletionText(finalized));
      setFlightFrame(null);
      setRemainingAnimMs(0);
      return;
    }
    if (isAnimating) return;

    setSelectedSeatId(null);
    setSelectedWaitingId(null);
    const res = runSeatingAssignmentSolver({
      state,
      skipAnimation: skipAnim || reducedMotionGlobal,
    });
    commitState(res.nextState);
    if (res.ok && (skipAnim || reducedMotionGlobal || state.effectDurationSeconds <= 0)) {
      playTeachingToolBell(effectiveMuted);
      setCompletionSummary(buildCompletionText(res.nextState));
    }
  };

  const handleRequestRoomChange = (candidateRoom: SeatingRoomConfig, label: string) => {
    const report = evaluateRoomChangeImpact(state, candidateRoom);
    if (report.hasImpact) {
      setPendingRoomImpact({ candidateRoom, report });
      return;
    }
    commitState(applyCandidateRoomConfig(state, candidateRoom, label));
  };

  const handleConfirmRoomImpact = () => {
    if (!pendingRoomImpact) return;
    commitState(
      applyCandidateRoomConfig(
        state,
        pendingRoomImpact.candidateRoom,
        'Áp dụng thay đổi cấu hình phòng (chuyển HS về danh sách chờ)'
      )
    );
    setPendingRoomImpact(null);
    setToastMsg('Đã cập nhật cấu hình phòng học. Học sinh ở ghế bị bỏ đã chuyển về danh sách chờ.');
  };

  const handleSeatClick = (seatId: string) => {
    if (isAnimating) return;

    // 1. Placing a student picked from waiting queue
    if (selectedWaitingId) {
      const res = assignWaitingStudentToSeat(state, selectedWaitingId, seatId);
      commitState(res.nextState);
      if (res.ok) {
        setSelectedWaitingId(null);
        setSelectedSeatId(null);
      }
      return;
    }

    // 2. Pin mode
    if (editToolMode === 'pin') {
      const res = toggleSeatPinAction(state, seatId);
      commitState(res.nextState);
      return;
    }

    // 3. Lock mode
    if (editToolMode === 'lock') {
      const res = toggleSeatLockAction(state, seatId, false);
      if (res.requiresConfirm) {
        setPendingLockConfirm(res.requiresConfirm);
        return;
      }
      commitState(res.nextState);
      return;
    }

    // 4. Swap mode
    if (state.lockedSeatIds.includes(seatId)) {
      commitState({ ...state, lastError: 'Ghế đang bị khóa không thể đổi chỗ.' });
      return;
    }
    if (!selectedSeatId) {
      if (!state.assignments[seatId]) return;
      setSelectedSeatId(seatId);
      return;
    }
    if (selectedSeatId === seatId) {
      setSelectedSeatId(null);
      return;
    }
    const res = swapOrMoveSeatAction(state, selectedSeatId, seatId);
    commitState(res.nextState);
    if (res.ok) setSelectedSeatId(null);
  };

  const handleDirectPinToggle = (seatId: string) => {
    if (isAnimating) return;
    const res = toggleSeatPinAction(state, seatId);
    commitState(res.nextState);
  };

  const handleConfirmLockOccupied = () => {
    if (!pendingLockConfirm) return;
    const res = toggleSeatLockAction(state, pendingLockConfirm.seatId, true);
    commitState(res.nextState);
    setPendingLockConfirm(null);
  };

  const handleConfirmResetUnpinned = () => {
    setResetConfirmOpen(false);
    setSelectedSeatId(null);
    setSelectedWaitingId(null);
    commitState(resetUnpinnedPlacements(state));
    setToastMsg('Đã xóa các chỗ tự động & đổi chỗ chưa ghim. Giữ nguyên ghế ghim và ghế khóa.');
  };

  const handleExportPng = () => {
    setExportMenuOpen(false);
    const dataUrl = exportSeatingChartPngDataUrl(state);
    if (!dataUrl) {
      setToastMsg('Trình duyệt hiện không hỗ trợ xuất ảnh PNG.');
      return;
    }
    const safeName = (state.meta.className || 'lop_hoc').replace(/[^a-zA-Z0-9_-]+/g, '_');
    downloadDataUrl(dataUrl, `so_do_cho_ngoi_${safeName}.png`);
    setToastMsg('Đã tải ảnh PNG sơ đồ toàn lớp độ phân giải cao.');
  };

  const handleExportXlsx = () => {
    setExportMenuOpen(false);
    const bytes = buildSeatingChartXlsxBytes(state);
    const safeName = (state.meta.className || 'lop_hoc').replace(/[^a-zA-Z0-9_-]+/g, '_');
    downloadUint8Bytes(
      bytes,
      `so_do_cho_ngoi_${safeName}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    setToastMsg('Đã xuất file Excel (.xlsx) giữ nguyên Mã học sinh dạng văn bản.');
  };

  const handleLoadSamplePreset = (
    preset: 'standard_36' | 'sample_25' | 'sample_50' | 'sample_1' | 'sample_dup_absent',
    label: string
  ) => {
    const presetId = `seating_sample_${preset}`;
    const newPreset: SeatingLocalClassPreset = {
      id: presetId,
      name: label,
      teacherName: 'Giáo viên Demo',
      sourceType: 'sample_editable',
      students: createSeatingSampleStudents(preset),
    };
    const nextPresets = [
      newPreset,
      ...localPresets.filter((p) => p.id !== presetId),
    ];
    setLocalPresets(nextPresets);
    saveSeatingLocalClasses(nextPresets, accountScopeId);
    setSelectedSourceId(presetId);
    setToastMsg(`Đã tạo & chọn ${label}.`);
  };

  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const matrix = extractSeatingXlsxMatrix(buf);
      setImportTab('excel');
      setImportPreview(parseSeatingRosterPreview(matrix, 'excel_matrix'));
      if (!importClassName.trim() || importClassName === 'Lớp nhập danh sách') {
        setImportClassName(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch {
      setImportPreview({
        rows: [],
        validRows: [],
        errorCount: 1,
        emptyRowsSkipped: 0,
        hasDuplicateCodes: false,
        exceedsMaxStudents: false,
        globalError: 'Không đọc được tệp Excel (.xlsx). Hãy kiểm tra lại định dạng tệp.',
      });
    }
    e.target.value = '';
  };

  const handleConfirmImportRoster = () => {
    if (!importPreview || importPreview.errorCount > 0 || importPreview.validRows.length === 0) {
      return;
    }
    const newId = `seating_imp_${Date.now().toString(36)}`;
    const newPreset: SeatingLocalClassPreset = {
      id: newId,
      name: importClassName.trim() || 'Lớp nhập danh sách',
      teacherName: state.meta.teacherName || 'Giáo viên phụ trách',
      sourceType: 'imported_local',
      students: importPreview.validRows.map((r, idx) => ({
        id: `${newId}_s_${idx + 1}_${r.code}`,
        code: r.code,
        fullName: r.fullName,
        present: r.present,
        frontPriority: false,
      })),
    };
    const nextPresets = [newPreset, ...localPresets];
    setLocalPresets(nextPresets);
    saveSeatingLocalClasses(nextPresets, accountScopeId);
    setSelectedSourceId(newId);
    setImportModalOpen(false);
    setImportPreview(null);
    setImportPasteText('');
    setToastMsg(`Đã nhập lớp "${newPreset.name}" (${newPreset.students.length} HS).`);
  };

  const handleAddNoSameDeskPair = () => {
    if (!pairStudentA || !pairStudentB || pairStudentA === pairStudentB) return;
    const exists = state.constraints.noSameDeskPairs.some(
      ([a, b]) =>
        (a === pairStudentA && b === pairStudentB) ||
        (a === pairStudentB && b === pairStudentA)
    );
    if (exists) return;
    commitState({
      ...state,
      constraints: {
        ...state.constraints,
        noSameDeskPairs: [...state.constraints.noSameDeskPairs, [pairStudentA, pairStudentB]],
      },
      lastError: '',
    });
    setPairStudentA('');
    setPairStudentB('');
  };

  const handleRemoveNoSameDeskPair = (idx: number) => {
    commitState({
      ...state,
      constraints: {
        ...state.constraints,
        noSameDeskPairs: state.constraints.noSameDeskPairs.filter((_, i) => i !== idx),
      },
    });
  };

  const toggleAccordion = (key: keyof typeof openAccordions) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const studentNameMap = useMemo(
    () => new Map(state.students.map((s) => [s.id, s.fullName])),
    [state.students]
  );

  // Left Sidebar Panel Content (shared between Desktop column & Mobile drawer)
  const renderLeftAccordionContent = () => (
    <div className="space-y-3">
      {/* 1. THÔNG TIN LỚP */}
      <section className="bg-white rounded-xl border border-[#DCE8F7] overflow-hidden">
        <button
          type="button"
          onClick={() => toggleAccordion('info')}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left bg-[#F8FBFF] hover:bg-[#EFF6FF] cursor-pointer"
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#082B52]">
            1. Thông tin lớp
          </span>
          {openAccordions.info ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openAccordions.info && (
          <div className="p-3.5 space-y-2.5 text-xs">
            <div className="space-y-1">
              <label htmlFor="seating-meta-class" className="font-bold text-slate-700 block">
                Tên lớp
              </label>
              <input
                id="seating-meta-class"
                type="text"
                value={state.meta.className}
                onChange={(e) =>
                  commitState({
                    ...state,
                    meta: { ...state.meta, className: e.target.value },
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-[#0F2D52]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="seating-meta-teacher" className="font-bold text-slate-700 block">
                Tên giáo viên
              </label>
              <input
                id="seating-meta-teacher"
                type="text"
                value={state.meta.teacherName}
                onChange={(e) =>
                  commitState({
                    ...state,
                    meta: { ...state.meta, teacherName: e.target.value },
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#0F2D52]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="seating-meta-note" className="font-bold text-slate-700 block">
                Ghi chú năm học / học kỳ
              </label>
              <input
                id="seating-meta-note"
                type="text"
                value={state.meta.academicNote}
                onChange={(e) =>
                  commitState({
                    ...state,
                    meta: { ...state.meta, academicNote: e.target.value },
                  })
                }
                placeholder="VD: Học kỳ II · Năm học 2026–2027"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#0F2D52]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="seating-meta-date" className="font-bold text-slate-700 block">
                Ngày lập sơ đồ
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="seating-meta-date"
                  type="date"
                  value={state.meta.createdDateIso}
                  onChange={(e) =>
                    commitState({
                      ...state,
                      meta: { ...state.meta, createdDateIso: e.target.value },
                    })
                  }
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#0F2D52]"
                />
                <button
                  type="button"
                  onClick={() =>
                    commitState({
                      ...state,
                      meta: { ...state.meta, createdDateIso: getTodayIsoDate() },
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DCE8F7] text-[#1769F4] font-bold cursor-pointer whitespace-nowrap"
                >
                  Hôm nay
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={state.meta.showDateOnChart}
                onChange={(e) =>
                  commitState({
                    ...state,
                    meta: { ...state.meta, showDateOnChart: e.target.checked },
                  })
                }
                className="rounded border-slate-300"
              />
              <span>Hiện ngày lập trên sơ đồ</span>
            </label>
          </div>
        )}
      </section>

      {/* 2. CẤU HÌNH LỚP HỌC */}
      <section className="bg-white rounded-xl border border-[#DCE8F7] overflow-hidden">
        <button
          type="button"
          onClick={() => toggleAccordion('room')}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left bg-[#F8FBFF] hover:bg-[#EFF6FF] cursor-pointer"
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#082B52]">
            2. Cấu hình lớp học ({capacitySummary.totalSeats} ghế)
          </span>
          {openAccordions.room ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openAccordions.room && (
          <div className="p-3.5 space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label htmlFor="room-aisles" className="font-bold text-slate-700 block">
                  Số dãy
                </label>
                <input
                  id="room-aisles"
                  type="number"
                  min={1}
                  max={6}
                  value={state.room.aisleCount}
                  onChange={(e) => {
                    const nextA = Math.max(1, Math.min(6, Number(e.target.value) || 1));
                    handleRequestRoomChange(
                      rebuildRoomGridDimensions(
                        state.room,
                        nextA,
                        state.room.defaultDesksPerAisle,
                        state.room.defaultSeatsPerDesk
                      ),
                      `Đổi số dãy thành ${nextA}`
                    );
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold text-[#0F2D52] tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="room-desks" className="font-bold text-slate-700 block">
                  Bàn/dãy
                </label>
                <input
                  id="room-desks"
                  type="number"
                  min={1}
                  max={12}
                  value={state.room.defaultDesksPerAisle}
                  onChange={(e) => {
                    const nextD = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                    handleRequestRoomChange(
                      rebuildRoomGridDimensions(
                        state.room,
                        state.room.aisleCount,
                        nextD,
                        state.room.defaultSeatsPerDesk
                      ),
                      `Đổi số bàn/dãy thành ${nextD}`
                    );
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold text-[#0F2D52] tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="room-seats" className="font-bold text-slate-700 block">
                  Chỗ/bàn
                </label>
                <input
                  id="room-seats"
                  type="number"
                  min={1}
                  max={4}
                  value={state.room.defaultSeatsPerDesk}
                  onChange={(e) => {
                    const nextS = Math.max(1, Math.min(4, Number(e.target.value) || 1));
                    handleRequestRoomChange(
                      rebuildRoomGridDimensions(
                        state.room,
                        state.room.aisleCount,
                        state.room.defaultDesksPerAisle,
                        nextS
                      ),
                      `Đổi số chỗ/bàn thành ${nextS}`
                    );
                  }}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold text-[#0F2D52] tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="room-desk-num" className="font-bold text-slate-700 block">
                Đánh số bàn bắt đầu từ
              </label>
              <select
                id="room-desk-num"
                value={state.room.deskNumbering}
                onChange={(e) =>
                  commitState({
                    ...state,
                    room: {
                      ...state.room,
                      deskNumbering: e.target.value as DeskNumberingDirection,
                    },
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-[#0F2D52] bg-white"
              >
                <option value="front_to_back">Từ phía gần bục giảng (Bàn 1 ở trên)</option>
                <option value="back_to_front">Từ phía cuối lớp (Bàn 1 ở cuối)</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold">Tổng ghế</div>
                <div className="text-sm font-extrabold text-[#082B52] font-mono-num">
                  {capacitySummary.totalSeats}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold">Ghế khóa</div>
                <div className="text-sm font-extrabold text-rose-700 font-mono-num">
                  {capacitySummary.lockedSeats}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
                <div className="text-[10px] text-[#1769F4] font-semibold">Khả dụng</div>
                <div className="text-sm font-extrabold text-[#082B52] font-mono-num">
                  {capacitySummary.availableSeats}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCustomDesksOpen(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#1769F4]/40 bg-[#F8FBFF] hover:bg-[#EFF6FF] text-[#1769F4] font-bold cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Tùy chỉnh từng bàn (thêm/bớt/sửa chỗ)</span>
            </button>
          </div>
        )}
      </section>

      {/* 3. DANH SÁCH HỌC SINH */}
      <section className="bg-white rounded-xl border border-[#DCE8F7] overflow-hidden">
        <button
          type="button"
          onClick={() => toggleAccordion('students')}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left bg-[#F8FBFF] hover:bg-[#EFF6FF] cursor-pointer"
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#082B52]">
            3. Danh sách học sinh ({eligibleStudents.length}/{state.students.length} xếp)
          </span>
          {openAccordions.students ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {openAccordions.students && (
          <div className="p-3.5 space-y-3 text-xs">
            {/* Nguồn lớp & nút nhập/mẫu */}
            <div className="space-y-1.5">
              <label htmlFor="seating-source-select" className="font-bold text-slate-700 block">
                Nguồn danh sách lớp
              </label>
              <select
                id="seating-source-select"
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-[#0F2D52] bg-white"
              >
                <option value={classId}>
                  {classNameLabel} (Đang chọn ở Hub)
                </option>
                {permittedRealClasses
                  .filter((c) => c.id !== classId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.students?.length || 0} HS · Lớp thật)
                    </option>
                  ))}
                {localPresets.map((lp) => (
                  <option key={lp.id} value={lp.id}>
                    {lp.name} ({lp.students.length} HS · Cục bộ)
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1769F4] hover:bg-[#0F56D3] text-white font-bold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Nhập / Dán DS</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSamplePreset('sample_25', 'Lớp mẫu 25 HS')}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0F2D52] font-bold cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Mẫu 25 HS</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleLoadSamplePreset('standard_36', 'Lớp mẫu 36 HS')}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold cursor-pointer"
                >
                  Mẫu 36 HS
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSamplePreset('sample_50', 'Lớp mẫu 50 HS')}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold cursor-pointer"
                >
                  Mẫu 50 HS
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSamplePreset('sample_dup_absent', 'Mẫu trùng tên & vắng')}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold cursor-pointer"
                >
                  Trùng tên &amp; vắng
                </button>
              </div>
            </div>

            {/* Phạm vi & Hiển thị tên */}
            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <span className="font-bold text-slate-700 block">Phạm vi học sinh cần xếp</span>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => commitState({ ...state, rosterScope: 'present_only' })}
                    className={`flex-1 py-1 px-2 rounded text-[11px] font-bold cursor-pointer ${
                      state.rosterScope === 'present_only'
                        ? 'bg-white text-[#082B52] shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Chỉ có mặt ({state.students.filter((s) => s.present).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => commitState({ ...state, rosterScope: 'all_students' })}
                    className={`flex-1 py-1 px-2 rounded text-[11px] font-bold cursor-pointer ${
                      state.rosterScope === 'all_students'
                        ? 'bg-white text-[#082B52] shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Cả danh sách ({state.students.length})
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="seating-name-fmt" className="font-bold text-slate-700 block">
                  Hiển thị tên trên sơ đồ
                </label>
                <select
                  id="seating-name-fmt"
                  value={state.nameDisplayMode}
                  onChange={(e) =>
                    commitState({
                      ...state,
                      nameDisplayMode: e.target.value as SeatingNameDisplayMode,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-[#0F2D52] bg-white"
                >
                  <option value="full">Họ tên đầy đủ</option>
                  <option value="last_two">Hai từ cuối (tự phân biệt nếu trùng)</option>
                  <option value="stt_name">Số thứ tự kèm tên</option>
                </select>
              </div>
            </div>

            {/* Danh sách học sinh (có mặt & ưu tiên gần bảng) */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                <span>Sẽ xếp: {eligibleStudents.length} HS</span>
                <span>Tích ↑ để ưu tiên gần bảng</span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {state.students.length === 0 ? (
                  <p className="text-slate-500 py-2 text-center">Danh sách đang trống.</p>
                ) : (
                  state.students.map((stu, idx) => (
                    <div
                      key={stu.id}
                      className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg border ${
                        stu.present
                          ? 'bg-white border-slate-200 text-[#0F2D52]'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          commitState({
                            ...state,
                            students: state.students.map((s) =>
                              s.id === stu.id ? { ...s, present: !s.present } : s
                            ),
                          })
                        }
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                        title={stu.present ? 'Đang có mặt (bấm để đánh dấu vắng)' : 'Đang vắng'}
                      >
                        {stu.present ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="font-mono-num text-[10px] text-slate-500 shrink-0">
                          {stu.code}
                        </span>
                        <span className={`truncate font-semibold ${!stu.present ? 'line-through' : ''}`}>
                          {idx + 1}. {stu.fullName}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          commitState({
                            ...state,
                            students: state.students.map((s) =>
                              s.id === stu.id
                                ? { ...s, frontPriority: !s.frontPriority }
                                : s
                            ),
                          })
                        }
                        title="Ưu tiên ngồi gần bảng"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer shrink-0 ${
                          stu.frontPriority
                            ? 'bg-[#1769F4] text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        ↑ Bảng
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. CÁCH XẾP CHỖ VÀ RÀNG BUỘC */}
      <section className="bg-white rounded-xl border border-[#DCE8F7] overflow-hidden">
        <button
          type="button"
          onClick={() => toggleAccordion('constraints')}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left bg-[#F8FBFF] hover:bg-[#EFF6FF] cursor-pointer"
        >
          <span className="text-xs font-extrabold uppercase tracking-wide text-[#082B52]">
            4. Cách xếp chỗ &amp; Ràng buộc ({state.constraints.noSameDeskPairs.length} cặp)
          </span>
          {openAccordions.constraints ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {openAccordions.constraints && (
          <div className="p-3.5 space-y-3 text-xs">
            <div className="space-y-1.5">
              <span className="font-bold text-slate-700 block">Chế độ xếp ngẫu nhiên</span>
              <label className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="seating_assign_mode"
                  checked={state.constraints.assignmentMode === 'balanced_aisles'}
                  onChange={() =>
                    commitState({
                      ...state,
                      constraints: {
                        ...state.constraints,
                        assignmentMode: 'balanced_aisles',
                      },
                    })
                  }
                />
                <span>
                  <strong className="block text-[#082B52]">B. Ngẫu nhiên &amp; phân bố đều giữa các dãy</strong>
                  <span className="text-[11px] text-slate-500">
                    VD: 25 HS trên 3 dãy chia đều 9–8–8.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="seating_assign_mode"
                  checked={state.constraints.assignmentMode === 'random_valid'}
                  onChange={() =>
                    commitState({
                      ...state,
                      constraints: {
                        ...state.constraints,
                        assignmentMode: 'random_valid',
                      },
                    })
                  }
                />
                <span>
                  <strong className="block text-[#082B52]">A. Ngẫu nhiên trong các vị trí hợp lệ</strong>
                  <span className="text-[11px] text-slate-500">
                    Bốc ngẫu nhiên mọi ghế khả dụng thỏa ràng buộc.
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-100">
              <label htmlFor="front-desk-count" className="font-bold text-slate-700 block">
                Số bàn đầu dãy tính là “vùng gần bảng”
              </label>
              <input
                id="front-desk-count"
                type="number"
                min={1}
                max={Math.max(1, state.room.defaultDesksPerAisle)}
                value={state.constraints.frontPriorityDeskCount}
                onChange={(e) =>
                  commitState({
                    ...state,
                    constraints: {
                      ...state.constraints,
                      frontPriorityDeskCount: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                    },
                  })
                }
                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-[#0F2D52] tabular-nums"
              />
            </div>

            {/* Ràng buộc bắt buộc: Không ngồi cùng bàn */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-700 block">
                Không ngồi cùng bàn (bắt buộc)
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <select
                  aria-label="Học sinh thứ nhất"
                  value={pairStudentA}
                  onChange={(e) => setPairStudentA(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  <option value="">-- Chọn học sinh A --</option>
                  {state.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.fullName}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Học sinh thứ hai"
                  value={pairStudentB}
                  onChange={(e) => setPairStudentB(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  <option value="">-- Chọn học sinh B --</option>
                  {state.students
                    .filter((s) => s.id !== pairStudentA)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.fullName}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!pairStudentA || !pairStudentB || pairStudentA === pairStudentB}
                  onClick={handleAddNoSameDeskPair}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#082B52] hover:bg-[#0F2D52] disabled:opacity-40 text-white font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm cặp không ngồi cùng bàn</span>
                </button>
              </div>

              {state.constraints.noSameDeskPairs.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {state.constraints.noSameDeskPairs.map(([aId, bId], idx) => (
                    <div
                      key={`${aId}-${bId}-${idx}`}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-900"
                    >
                      <span className="truncate font-semibold">
                        {studentNameMap.get(aId) || aId} ↔ {studentNameMap.get(bId) || bId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveNoSameDeskPair(idx)}
                        className="text-rose-700 hover:text-rose-900 cursor-pointer shrink-0"
                        title="Xóa ràng buộc"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Danh sách chờ xếp (hiện khi có học sinh chưa xếp vào ghế nào) */}
      {waitingStudents.length > 0 && (
        <section className="bg-amber-50/70 rounded-xl border border-amber-200 p-3.5 space-y-2 text-xs">
          <div className="font-extrabold text-amber-950">
            Danh sách chờ xếp ({waitingStudents.length} HS)
          </div>
          <p className="text-[11px] text-amber-900">
            Chạm vào tên học sinh rồi chạm vào một ghế trống (hoặc ghế chưa ghim) trên sơ đồ để xếp chỗ.
          </p>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {waitingStudents.map((stu) => {
              const isPicked = selectedWaitingId === stu.id;
              return (
                <button
                  key={stu.id}
                  type="button"
                  onClick={() => {
                    setSelectedSeatId(null);
                    setSelectedWaitingId(isPicked ? null : stu.id);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left font-bold cursor-pointer ${
                    isPicked
                      ? 'bg-[#1769F4] text-white border-[#1769F4]'
                      : 'bg-white border-amber-200 text-[#0F2D52] hover:border-amber-400'
                  }`}
                >
                  <span className="truncate">{stu.fullName}</span>
                  <span className="font-mono-num text-[10px] opacity-80">{stu.code}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="space-y-4 font-edtech text-[#0F2D52] print:hidden">
      {/* TOP ACTION BAR */}
      <section className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <label htmlFor="seating-duration-sec" className="font-bold text-slate-700 whitespace-nowrap">
              Hiệu ứng (giây):
            </label>
            <input
              id="seating-duration-sec"
              type="number"
              min={0}
              max={60}
              value={state.effectDurationSeconds}
              onChange={(e) =>
                commitState({
                  ...state,
                  effectDurationSeconds: Math.max(0, Math.min(60, Number(e.target.value) || 0)),
                })
              }
              className="w-14 px-1.5 py-0.5 rounded border border-slate-300 bg-white font-extrabold text-center tabular-nums"
            />
          </div>

          <button
            type="button"
            onClick={handleToggleSound}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer whitespace-nowrap ${
              effectiveMuted
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : 'bg-[#F0F7FF] border-[#DCE8F7] text-[#1769F4]'
            }`}
          >
            {effectiveMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{effectiveMuted ? 'Tắt tiếng' : 'Âm thanh'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              commitState({
                ...state,
                orientation:
                  state.orientation === 'front_board' ? 'back_of_class' : 'front_board',
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0F2D52] cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-4 h-4 text-[#1769F4]" />
            <span>
              Đảo góc nhìn ({state.orientation === 'front_board' ? 'Bảng ở trên' : 'Từ cuối lớp'})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProjectorOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#082B52] hover:bg-[#0F2D52] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Trình chiếu</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => setResetConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-bold text-slate-700 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Làm lại</span>
          </button>

          <button
            type="button"
            onClick={() => handleRunRandomSeating(true)}
            disabled={eligibleStudents.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-[#082B52] text-xs font-extrabold cursor-pointer whitespace-nowrap"
          >
            <Zap className="w-4 h-4" />
            <span>Xem kết quả ngay</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#0F2D52] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-[#1769F4]" />
              <span>Xuất / In</span>
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-30 space-y-1">
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 text-xs font-bold text-left cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#1769F4]" />
                  <span>Tải ảnh PNG toàn sơ đồ</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportXlsx}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 text-xs font-bold text-left cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Xuất danh sách XLSX</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    setPrintPreviewOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 text-xs font-bold text-left cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-700" />
                  <span>Xem trước &amp; In A4 ngang</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isAnimating || eligibleStudents.length === 0}
            onClick={() => handleRunRandomSeating(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] disabled:opacity-45 text-white text-xs sm:text-sm font-extrabold cursor-pointer whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4" />
            <span>{isAnimating ? 'Đang xếp chỗ...' : 'Xếp lại ngẫu nhiên'}</span>
          </button>
        </div>
      </section>

      {/* MOBILE CONFIG DRAWER TOGGLE */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-[#DCE8F7] text-xs font-extrabold text-[#082B52] cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#1769F4]" />
            <span>Cấu hình lớp, Danh sách &amp; Ràng buộc</span>
          </span>
          {mobileDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {mobileDrawerOpen && <div className="mt-2.5">{renderLeftAccordionContent()}</div>}
      </div>

      {/* MAIN TWO-COLUMN DESKTOP WORKSPACE (1/3 Left Controls + 2/3 Wide Classroom Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 space-y-3">
          {renderLeftAccordionContent()}
        </aside>

        <main className="lg:col-span-8 xl:col-span-9 space-y-3.5 min-w-0">
          {/* Header Meta & Quick Chart Edit Bar */}
          <section className="bg-white rounded-2xl border border-[#DCE8F7] p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#082B52] tracking-tight">
                  Sơ đồ chỗ ngồi — {state.meta.className || 'Lớp học'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  GV: {state.meta.teacherName || 'Chưa nhập'}
                  {state.meta.academicNote ? ` · ${state.meta.academicNote}` : ''}
                  {state.meta.showDateOnChart
                    ? ` · Ngày lập: ${formatIsoDateVi(state.meta.createdDateIso)}`
                    : ''}
                  {` · Cần xếp: ${eligibleStudents.length} HS · Đã xếp: ${capacitySummary.assignedSeats} · Trống: ${capacitySummary.emptyAvailableSeats} · Khả dụng: ${capacitySummary.availableSeats}/${capacitySummary.totalSeats} ghế`}
                </p>
              </div>

              {/* View Dimension + Theme & Zoom */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setViewDimension('2d')}
                    className={`px-2.5 py-1 rounded cursor-pointer whitespace-nowrap ${
                      viewDimension === '2d'
                        ? 'bg-white text-[#082B52] shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Sơ đồ 2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewDimension('3d')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded cursor-pointer whitespace-nowrap ${
                      viewDimension === '3d'
                        ? 'bg-[#082B52] text-white shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <Box className="w-3 h-3" />
                    <span>Lớp học 3D</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-bold">
                  {(
                    [
                      { id: 'monochrome', label: 'Đơn sắc' },
                      { id: 'multicolor', label: 'Đa màu' },
                      { id: 'bw', label: 'Đen trắng' },
                    ] as { id: SeatingColorTheme; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => commitState({ ...state, colorTheme: t.id })}
                      className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap ${
                        state.colorTheme === t.id
                          ? 'bg-white text-[#082B52] shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {viewDimension === '2d' && (
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-bold">
                    {[75, 100, 125].map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setZoomPercent(z)}
                        className={`px-2 py-1 rounded cursor-pointer font-mono-num ${
                          zoomPercent === z
                            ? 'bg-white text-[#082B52] shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        {z}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chart Editing Toolbar: Đổi chỗ | Khóa chỗ | Ghim chỗ | Hoàn tác */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditToolMode('swap');
                    setSelectedSeatId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    editToolMode === 'swap'
                      ? 'bg-[#1769F4] border-[#1769F4] text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Đổi chỗ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditToolMode('lock');
                    setSelectedSeatId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    editToolMode === 'lock'
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Khóa chỗ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditToolMode('pin');
                    setSelectedSeatId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    editToolMode === 'pin'
                      ? 'bg-[#082B52] border-[#082B52] text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>Ghim chỗ ({capacitySummary.pinnedCount})</span>
                </button>

                <button
                  type="button"
                  disabled={state.undoStack.length === 0 || isAnimating}
                  onClick={() => commitState(undoLastSeatingAction(state))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Hoàn tác ({state.undoStack.length})</span>
                </button>
              </div>

              <div className="text-[11px] font-semibold text-slate-500">
                {selectedWaitingId
                  ? `Đang chọn ${studentNameMap.get(selectedWaitingId)} — chạm ghế đích để xếp`
                  : selectedSeatId
                    ? 'Đã chọn 1 ghế — chạm ghế thứ hai để đổi hoặc chuyển sang ghế trống'
                    : editToolMode === 'swap'
                      ? 'Chạm hai ghế để đổi chỗ hoặc chuyển sang ghế trống'
                      : editToolMode === 'lock'
                        ? 'Chạm ghế để khóa hoặc mở khóa'
                        : 'Chạm ghế đã có người để ghim/bỏ ghim cố định'}
              </div>
            </div>

            {/* Alerts, Conflicts, Unmet Priorities & Explanations */}
            {state.lastError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{state.lastError}</span>
              </div>
            )}

            {state.lastUnmetPriorities.length > 0 && !state.lastError && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold">
                Vùng gần bảng ({state.constraints.frontPriorityDeskCount} bàn đầu) không đủ chỗ cho tất cả học sinh ưu tiên; các em chưa ngồi gần bảng: {state.lastUnmetPriorities.join(', ')}.
              </div>
            )}

            {state.lastBalanceNote && !state.lastError && (
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[#082B52] text-xs font-semibold">
                {state.lastBalanceNote}
              </div>
            )}

            {/* Live Parabolic Choreography Countdown / Completion Banner */}
            {isAnimating && (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#082B52] text-white flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 font-extrabold">
                  <Clock className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>
                    Đang hoán đổi &amp; xếp chỗ...{' '}
                    <span className="font-mono-num text-amber-300 text-sm ml-1">
                      {(remainingAnimMs / 1000).toFixed(1)}s
                    </span>
                  </span>
                  {flightFrame && (
                    <span className="px-2 py-0.5 rounded bg-white/15 font-mono-num text-[11px]">
                      {flightFrame.completedCount}/{flightFrame.totalMoves} lượt bay
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRunRandomSeating(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#082B52] font-extrabold cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Xem kết quả ngay</span>
                </button>
              </div>
            )}

            {completionSummary && !isAnimating && !state.lastError && (
              <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{completionSummary}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCompletionSummary('')}
                  className="text-emerald-700 hover:underline cursor-pointer shrink-0"
                >
                  Ẩn
                </button>
              </div>
            )}

            {toastMsg && (
              <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2">
                <span>{toastMsg}</span>
                <button
                  type="button"
                  onClick={() => setToastMsg('')}
                  className="text-emerald-700 hover:underline cursor-pointer"
                >
                  Ẩn
                </button>
              </div>
            )}
          </section>

          {/* Interactive Scrollable Classroom Map (2D + Parabolic Flight Overlay OR 3D Isometric WebGL) */}
          <section
            ref={mapContainerRef}
            className="relative bg-white rounded-2xl border border-[#DCE8F7] p-3.5 sm:p-4 overflow-x-auto"
          >
            {viewDimension === '3d' ? (
              <Seating3DScene
                state={state}
                flightFrame={flightFrame}
                interactive={!isAnimating}
                selectedSeatId={selectedSeatId}
                selectedWaitingStudentId={selectedWaitingId}
                onSeatClick={handleSeatClick}
                onAutoFallback2D={(reason) => {
                  setViewDimension('2d');
                  setToastMsg(reason);
                }}
              />
            ) : (
              <>
                <ClassroomMapView
                  state={state}
                  interactive={!isAnimating}
                  editToolMode={editToolMode}
                  selectedSeatId={selectedSeatId}
                  selectedWaitingStudentId={selectedWaitingId}
                  revealedSeatSet={null}
                  seatAssignmentsOverride={flightFrame?.stationaryAssignments}
                  recentlyLandedSeatIds={flightFrame?.recentlyLandedSeatIds}
                  zoomPercent={zoomPercent}
                  onSeatClick={handleSeatClick}
                  onDirectPinToggle={handleDirectPinToggle}
                />

                {/* Parabolic Airborne Student Card Overlay Layer (zero duplicate names) */}
                {isAnimating && flightFrame && flightFrame.airborneMoves.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
                    {flightFrame.airborneMoves.map(({ move, progress, easedProgress }) => {
                      const toRect = seatRectCacheRef.current[move.toSeatId];
                      if (!toRect) return null;
                      const fromRect = move.fromSeatId
                        ? seatRectCacheRef.current[move.fromSeatId]
                        : undefined;
                      const startX = fromRect ? fromRect.x : Math.max(16, toRect.x - 160);
                      const startY = fromRect ? fromRect.y : 20;
                      const arcLift = Math.sin(progress * Math.PI) * 58;
                      const curX = startX + (toRect.x - startX) * easedProgress;
                      const curY = startY + (toRect.y - startY) * easedProgress - arcLift;

                      const stuObj = state.students.find((s) => s.id === move.studentId);
                      const sttIdx = stuObj ? state.students.indexOf(stuObj) + 1 : 1;
                      const labelInfo = stuObj
                        ? formatStudentDisplayName({
                            student: stuObj,
                            sttIndex: sttIdx,
                            mode: state.nameDisplayMode,
                            allStudents: state.students,
                          })
                        : { primary: move.studentId, secondaryCode: null };

                      const targetLoc = roomSeatIndex.locationsById.get(move.toSeatId);
                      const targetPalette = getAislePaletteByIndex(targetLoc?.aisleIndex ?? 0);
                      const isBW = state.colorTheme === 'bw';

                      return (
                        <div
                          key={move.moveId}
                          style={{
                            width: `${Math.max(82, toRect.w)}px`,
                            minHeight: `${Math.max(58, toRect.h)}px`,
                            transform: `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0) scale(1.06)`,
                          }}
                          className={`absolute top-0 left-0 rounded-lg border-2 shadow-xl px-2 py-1.5 flex flex-col items-center justify-center text-center will-change-transform ${
                            isBW
                              ? 'border-black bg-white text-black'
                              : `${targetPalette.seatFillCls} border-amber-300 ring-2 ring-amber-300/80 text-white`
                          }`}
                        >
                          <span
                            className={`text-[9px] font-extrabold uppercase tracking-wider ${
                              isBW ? 'text-black/75' : 'text-amber-200'
                            }`}
                          >
                            {move.isSwap ? 'Đổi chỗ' : 'Xếp vào bàn'}
                          </span>
                          <span className="text-xs font-extrabold leading-snug break-words whitespace-normal w-full">
                            {labelInfo.primary}
                          </span>
                          {labelInfo.secondaryCode && (
                            <span
                              className={`text-[9px] font-mono-num ${
                                isBW ? 'text-black/75' : 'text-white/85'
                              }`}
                            >
                              {labelInfo.secondaryCode}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Aisle Balance Stats Footer */}
          <section className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-extrabold text-[#082B52]">
                <Layers className="w-4 h-4 text-[#1769F4]" />
                <span>Thống kê theo dãy:</span>
              </span>
              {statsSummary.aisles.map((a) => (
                <div
                  key={a.aisleId}
                  className="px-2.5 py-1 rounded-lg bg-[#F8FBFF] border border-[#DCE8F7] font-bold text-[#0F2D52] font-mono-num"
                >
                  {a.aisleName}: {a.assignedCount} HS ({a.availableCount} khả dụng)
                </div>
              ))}
            </div>
            <div className="font-extrabold text-[#1769F4] font-mono-num">
              Chênh lệch giữa các dãy: {statsSummary.spread} HS
            </div>
          </section>
        </main>
      </div>

      {/* MODAL: TÙY CHỈNH TỪNG BÀN */}
      {customDesksOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#082B52]">
                  Tùy chỉnh từng bàn theo dãy
                </h3>
                <p className="text-xs text-slate-600">
                  Thêm hoặc bớt bàn ở từng dãy, chỉnh số chỗ riêng từng bàn (VD: Dãy 2 – Bàn 1 có 3 chỗ).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomDesksOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {state.room.aisles.map((aisle, aIdx) => (
                <div key={aisle.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#082B52]">{aisle.name}</span>
                    <button
                      type="button"
                      disabled={aisle.desks.length >= 12}
                      onClick={() =>
                        handleRequestRoomChange(
                          addDeskToAisle(state.room, aisle.id),
                          `Thêm bàn vào ${aisle.name}`
                        )
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#EFF6FF] hover:bg-[#DCE8F7] disabled:opacity-40 text-[#1769F4] text-[11px] font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Thêm bàn</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {aisle.desks.map((desk, dIdx) => {
                      const displayNum =
                        state.room.deskNumbering === 'front_to_back'
                          ? dIdx + 1
                          : aisle.desks.length - dIdx;
                      return (
                        <div
                          key={desk.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                        >
                          <span className="font-bold text-[#0F2D52]">
                            Bàn {displayNum}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Số chỗ Dãy ${aIdx + 1} Bàn ${displayNum}`}
                              value={desk.seatIds.length}
                              onChange={(e) =>
                                handleRequestRoomChange(
                                  adjustDeskSeatCount(
                                    state.room,
                                    aisle.id,
                                    desk.id,
                                    Number(e.target.value)
                                  ),
                                  `Đổi số chỗ ${aisle.name} – Bàn ${displayNum}`
                                )
                              }
                              className="px-1.5 py-0.5 rounded border border-slate-300 bg-white font-bold text-xs"
                            >
                              {[1, 2, 3, 4].map((n) => (
                                <option key={n} value={n}>
                                  {n} chỗ
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={aisle.desks.length <= 1}
                              onClick={() =>
                                handleRequestRoomChange(
                                  removeDeskFromAisle(state.room, aisle.id, desk.id),
                                  `Xóa ${aisle.name} – Bàn ${displayNum}`
                                )
                              }
                              title="Xóa bàn này"
                              className="p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-30 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN THAY CẤU HÌNH LÀM MẤT GHẾ CÓ NGƯỜI / GHIM */}
      {pendingRoomImpact && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 space-y-3">
            <h3 className="text-base font-extrabold text-rose-800">
              Thay đổi cấu hình làm mất ghế đang sử dụng
            </h3>
            <p className="text-xs text-slate-700">
              Các vị trí sau bị cắt khỏi sơ đồ. Nếu xác nhận, các học sinh mất chỗ sẽ được chuyển vào danh sách chờ xếp:
            </p>
            <ul className="max-h-44 overflow-y-auto space-y-1 text-xs bg-rose-50/60 border border-rose-200 rounded-xl p-3">
              {pendingRoomImpact.report.lostSeats.map((ls) => (
                <li key={ls.seatId} className="font-semibold text-rose-950">
                  • {ls.label}
                  {ls.studentName ? ` — ${ls.studentName}` : ' — Ghế trống'}
                  {ls.wasPinned ? ' (Đang ghim)' : ''}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingRoomImpact(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy thay đổi
              </button>
              <button
                type="button"
                onClick={handleConfirmRoomImpact}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
              >
                Xác nhận áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN KHÓA GHẾ ĐANG CÓ HỌC SINH */}
      {pendingLockConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3">
            <h3 className="text-base font-extrabold text-[#082B52]">
              Khóa ghế đang có học sinh?
            </h3>
            <p className="text-xs text-slate-700">
              Ghế <strong>{pendingLockConfirm.seatLabel}</strong> đang xếp cho em{' '}
              <strong>{pendingLockConfirm.studentName}</strong>. Khi khóa ghế này, em sẽ được chuyển về danh sách chờ xếp.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingLockConfirm(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmLockOccupied}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
              >
                Khóa ghế &amp; chuyển chờ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN LÀM LẠI */}
      {resetConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3">
            <h3 className="text-base font-extrabold text-[#082B52]">
              Làm lại sơ đồ chỗ ngồi?
            </h3>
            <p className="text-xs text-slate-700">
              Thao tác này sẽ xóa toàn bộ vị trí tự động và các lần đổi chỗ chưa ghim. Cấu hình dãy/bàn/chỗ, các ghế đang khóa và các học sinh đang ghim được giữ nguyên.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetUnpinned}
                className="px-3.5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-extrabold cursor-pointer"
              >
                Xác nhận làm lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NHẬP EXCEL HOẶC DÁN DANH SÁCH HỌC SINH */}
      {importModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#082B52]">
                Nhập danh sách học sinh (XLSX / Dán tên)
              </h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="seating-import-cls-name" className="font-bold text-slate-700 block">
                  Tên lớp mới (lưu cục bộ)
                </label>
                <input
                  id="seating-import-cls-name"
                  type="text"
                  value={importClassName}
                  onChange={(e) => setImportClassName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadUint8Bytes(
                      buildSeatingSampleXlsxBytes(),
                      'mau_so_do_cho_ngoi.xlsx',
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#1769F4]" />
                  <span>Tải file Excel mẫu</span>
                </button>

                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1769F4] hover:bg-[#0F56D3] text-white font-bold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn file .xlsx</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setImportTab('excel')}
                className={`flex-1 py-1.5 rounded cursor-pointer ${
                  importTab === 'excel' ? 'bg-white text-[#082B52] shadow-xs' : 'text-slate-600'
                }`}
              >
                Dán bảng (Mã | Họ tên | Có mặt)
              </button>
              <button
                type="button"
                onClick={() => setImportTab('paste_names')}
                className={`flex-1 py-1.5 rounded cursor-pointer ${
                  importTab === 'paste_names' ? 'bg-white text-[#082B52] shadow-xs' : 'text-slate-600'
                }`}
              >
                Dán mỗi dòng một tên (tự tạo mã)
              </button>
            </div>

            <textarea
              rows={5}
              value={importPasteText}
              onChange={(e) => {
                const v = e.target.value;
                setImportPasteText(v);
                setImportPreview(
                  parseSeatingRosterPreview(
                    v,
                    importTab === 'paste_names' ? 'names_only_lines' : 'excel_matrix'
                  )
                );
              }}
              placeholder={
                importTab === 'paste_names'
                  ? 'Nguyễn Văn An\nTrần Thị Bình\nNguyễn Văn An'
                  : 'Mã học sinh\tHọ và tên\tCó mặt\n001\tNguyễn Minh An\tCó\n002\tTrần Bảo Ngọc\tVắng'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
            />

            {importPreview && (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                  <span className="text-emerald-700">
                    Hợp lệ: {importPreview.validRows.length}/{MAX_SEATING_STUDENTS} HS
                  </span>
                  {importPreview.emptyRowsSkipped > 0 && (
                    <span className="text-slate-500">
                      Đã bỏ qua {importPreview.emptyRowsSkipped} dòng trống
                    </span>
                  )}
                  {importPreview.errorCount > 0 && (
                    <span className="text-rose-700">
                      Dòng lỗi: {importPreview.errorCount}
                    </span>
                  )}
                </div>

                {importPreview.globalError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                    {importPreview.globalError}
                  </div>
                )}

                {importPreview.rows.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-2.5 py-1.5">Dòng</th>
                          <th className="px-2.5 py-1.5">Mã HS</th>
                          <th className="px-2.5 py-1.5">Họ và tên</th>
                          <th className="px-2.5 py-1.5">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.map((r) => (
                          <tr
                            key={`${r.rowNumber}-${r.code}`}
                            className={r.errors.length > 0 ? 'bg-rose-50 text-rose-900' : 'border-t border-slate-100'}
                          >
                            <td className="px-2.5 py-1 font-mono-num">{r.rowNumber}</td>
                            <td className="px-2.5 py-1 font-mono-num font-bold">{r.code}</td>
                            <td className="px-2.5 py-1 font-semibold">{r.fullName}</td>
                            <td className="px-2.5 py-1">
                              {r.errors.length > 0
                                ? r.errors.join(' ')
                                : r.present
                                  ? 'Có mặt'
                                  : 'Vắng'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={
                  !importPreview ||
                  importPreview.errorCount > 0 ||
                  importPreview.validRows.length === 0
                }
                onClick={handleConfirmImportRoster}
                className="px-4 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer"
              >
                Nhập lớp này ({importPreview?.validRows.length || 0} HS)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECTOR & PRINT A4 PREVIEW */}
      {projectorOpen && (
        <SeatingProjectorModal
          state={state}
          onChangeNameDisplayMode={(mode) => commitState({ ...state, nameDisplayMode: mode })}
          onToggleOrientation={() =>
            commitState({
              ...state,
              orientation:
                state.orientation === 'front_board' ? 'back_of_class' : 'front_board',
            })
          }
          onClose={() => setProjectorOpen(false)}
        />
      )}

      {printPreviewOpen && (
        <SeatingPrintPreviewModal
          state={state}
          onClose={() => setPrintPreviewOpen(false)}
        />
      )}
    </div>
  );
};
