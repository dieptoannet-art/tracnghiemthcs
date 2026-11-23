import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  History,
  Maximize2,
  Minimize2,
  Minus,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Square,
  Star,
  Trash2,
  Undo2,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ClassRoom } from '../../../types';
import {
  MAX_PICKER_STUDENTS,
  NamePickerClassState,
  PICKER_CALL_MODE_META,
  PickerCallMode,
  PickerClassSourceType,
  PickerExcelPreviewResult,
  PickerLocalClassRecord,
  PickerScope,
  PickerUtilitiesState,
  adjustPickerStudentScore,
  beginPickerTurn,
  buildPickerSampleXlsxBytes,
  buildPickerXlsxBytes,
  clearClassPickerHistory,
  createInitialClassState,
  createPickerSampleClass,
  extractMatrixFromXlsxBuffer,
  finalizePickerTurn,
  loadNamePickerClassState,
  loadPickerLocalClasses,
  loadPickerUtilitiesState,
  parsePickerExcelPreview,
  resetClassPickerScores,
  resolvePickerEligibility,
  saveNamePickerClassState,
  savePickerLocalClasses,
  savePickerUtilitiesState,
  startNewPickerRound,
  syncRealClassRosterWithState,
  undoLastPickerScore,
} from './namePickerEngine';
import { NamePickerStage } from './NamePickerStages';
import { hasNamePickerWebGL } from './NamePicker3DStage';
import { NamePickerUtilitiesBar } from './NamePickerUtilitiesBar';
import { playTeachingToolBell, playTeachingToolScoreCue } from './teachingToolsAudio';

export interface NamePickerToolProps {
  permittedRealClasses: ClassRoom[];
  initialClassId?: string;
  accountScopeId: string;
  isDemoSandbox: boolean;
  isMutedGlobal: boolean;
  onToggleMuteGlobal: () => void;
  reducedMotionGlobal: boolean;
  onOpenClassicA01?: () => void;
}

interface UnifiedClassOption {
  id: string;
  name: string;
  sourceType: PickerClassSourceType;
  students: { id: string; code: string; fullName: string; present?: boolean }[];
}

const CALL_MODES_LIST: PickerCallMode[] = [
  'wheel',
  'draw_box',
  'slot_machine',
  'flip_cards',
  'elimination',
];

function triggerBytesDownload(bytes: Uint8Array, filename: string, mime: string) {
  try {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Ignore blocked downloads in headless sandboxes
  }
}

export const NamePickerTool: React.FC<NamePickerToolProps> = ({
  permittedRealClasses,
  initialClassId,
  accountScopeId,
  isDemoSandbox,
  isMutedGlobal,
  onToggleMuteGlobal,
  reducedMotionGlobal,
  onOpenClassicA01,
}) => {
  const [localClasses, setLocalClasses] = useState<PickerLocalClassRecord[]>(() => {
    const existing = loadPickerLocalClasses(accountScopeId);
    if (existing.length > 0) return existing;
    if (permittedRealClasses.length === 0 || isDemoSandbox) {
      const def = createPickerSampleClass({ preset: 'standard_12' });
      savePickerLocalClasses([def], accountScopeId);
      return [def];
    }
    return [];
  });

  useEffect(() => {
    const loaded = loadPickerLocalClasses(accountScopeId);
    if (loaded.length === 0 && (permittedRealClasses.length === 0 || isDemoSandbox)) {
      const def = createPickerSampleClass({ preset: 'standard_12' });
      savePickerLocalClasses([def], accountScopeId);
      setLocalClasses([def]);
    } else {
      setLocalClasses(loaded);
    }
  }, [accountScopeId, isDemoSandbox]);

  const classOptions = useMemo<UnifiedClassOption[]>(() => {
    const realOpts: UnifiedClassOption[] = permittedRealClasses.map((cls) => ({
      id: cls.id,
      name: cls.name,
      sourceType: isDemoSandbox ? 'sample_editable' : 'real_readonly',
      students: (cls.students || []).map((st, idx) => ({
        id: st.id || `${cls.id}_s_${idx + 1}`,
        code: String(st.code || String(idx + 1).padStart(3, '0')),
        fullName: st.fullName || `Học sinh ${idx + 1}`,
        present: true,
      })),
    }));
    const localOpts: UnifiedClassOption[] = localClasses.map((lc) => ({
      id: lc.id,
      name: lc.name,
      sourceType: lc.sourceType,
      students: lc.students,
    }));
    return [...realOpts, ...localOpts];
  }, [permittedRealClasses, localClasses, isDemoSandbox]);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    () => initialClassId || classOptions[0]?.id || ''
  );

  useEffect(() => {
    if (classOptions.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!classOptions.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classOptions[0].id);
    }
  }, [classOptions, selectedClassId]);

  useEffect(() => {
    if (!initialClassId) return;
    setSelectedClassId((prev) => {
      if (prev === initialClassId) return prev;
      return classOptions.some((c) => c.id === initialClassId) ? initialClassId : prev;
    });
  }, [initialClassId]);

  const activeClassOpt = useMemo(
    () => classOptions.find((c) => c.id === selectedClassId) || null,
    [classOptions, selectedClassId]
  );

  const [classState, setClassState] = useState<NamePickerClassState | null>(null);
  const [utilities, setUtilities] = useState<PickerUtilitiesState>(() =>
    loadPickerUtilitiesState(accountScopeId)
  );
  const [callMode, setCallMode] = useState<PickerCallMode>('wheel');
  const [localReducedMotion, setLocalReducedMotion] = useState<boolean>(reducedMotionGlobal);
  const [lightMode2D, setLightMode2D] = useState<boolean>(() => !hasNamePickerWebGL());
  const [isFullscreenOverlay, setIsFullscreenOverlay] = useState<boolean>(false);
  const [mobileRosterOpen, setMobileRosterOpen] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  // Modals & confirmations (any open modal disables `R` keyboard shortcut cleanly!)
  const [shortfallDecision, setShortfallDecision] = useState<{
    remainingCount: number;
    requestedK: number;
  } | null>(null);
  const [showSampleModal, setShowSampleModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showResetScoresConfirm, setShowResetScoresConfirm] = useState<boolean>(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState<boolean>(false);

  // Edit local roster modal state
  const [editDraftStudents, setEditDraftStudents] = useState<
    { id: string; code: string; fullName: string; present: boolean }[]
  >([]);
  const [newStuCode, setNewStuCode] = useState<string>('');
  const [newStuName, setNewStuName] = useState<string>('');
  const [editError, setEditError] = useState<string>('');

  // Excel import modal state
  const [importTargetName, setImportTargetName] = useState<string>('Lớp nhập Excel');
  const [importPasteText, setImportPasteText] = useState<string>('');
  const [importPreview, setImportPreview] = useState<PickerExcelPreviewResult | null>(null);

  const stageSectionRef = useRef<HTMLDivElement | null>(null);

  // Sync utilities when account scope changes
  useEffect(() => {
    setUtilities(loadPickerUtilitiesState(accountScopeId));
  }, [accountScopeId]);

  const commitUtilities = useCallback(
    (next: PickerUtilitiesState) => {
      setUtilities(next);
      savePickerUtilitiesState(next, accountScopeId);
    },
    [accountScopeId]
  );

  // Load isolated per-class state whenever class selection or account scope switches
  useEffect(() => {
    if (!activeClassOpt) {
      setClassState(null);
      return;
    }
    const existing = loadNamePickerClassState(activeClassOpt.id, accountScopeId);
    if (existing) {
      const synced = syncRealClassRosterWithState(existing, activeClassOpt.students);
      setClassState(synced);
      saveNamePickerClassState(synced, accountScopeId);
    } else {
      const fresh = createInitialClassState({
        classId: activeClassOpt.id,
        className: activeClassOpt.name,
        sourceType: activeClassOpt.sourceType,
        students: activeClassOpt.students,
      });
      setClassState(fresh);
      saveNamePickerClassState(fresh, accountScopeId);
    }
    setShortfallDecision(null);
    setBannerMsg(null);
  }, [activeClassOpt?.id, accountScopeId]);

  const commitClassState = useCallback(
    (next: NamePickerClassState) => {
      setClassState(next);
      saveNamePickerClassState(next, accountScopeId);
    },
    [accountScopeId]
  );

  const eligibility = useMemo(() => {
    if (!classState) {
      return {
        presentCount: 0,
        eligiblePool: [],
        remainingPool: [],
        canCallNow: false,
        shortfall: null,
        blockedReason: 'Chưa chọn lớp.',
      };
    }
    return resolvePickerEligibility(classState);
  }, [classState]);

  const duplicateNamesSet = useMemo(() => {
    if (!classState) return new Set<string>();
    const counts = new Map<string, number>();
    for (const s of classState.students) {
      counts.set(s.fullName, (counts.get(s.fullName) || 0) + 1);
    }
    const dups = new Set<string>();
    for (const [name, cnt] of counts.entries()) {
      if (cnt > 1) dups.add(name);
    }
    return dups;
  }, [classState?.students]);

  const isAnyModalOpen =
    showSampleModal ||
    showEditModal ||
    showImportModal ||
    showResetScoresConfirm ||
    showClearHistoryConfirm ||
    shortfallDecision !== null;

  const isTurnAnimating = Boolean(classState?.activeTurn?.status === 'animating');

  const handleTriggerCall = useCallback(
    (options?: { countOverride?: number; skipAnimation?: boolean }) => {
      if (!classState) return;
      const res = beginPickerTurn({
        state: classState,
        mode: callMode,
        countOverride: options?.countOverride,
        skipAnimation: options?.skipAnimation,
      });

      if (res.requiresShortfallDecision) {
        setShortfallDecision(res.requiresShortfallDecision);
        return;
      }
      if (!res.ok) {
        setBannerMsg({
          type: 'error',
          text: res.error || 'Không thể thực hiện lượt gọi.',
        });
        return;
      }

      setShortfallDecision(null);
      setBannerMsg(null);
      commitClassState(res.nextState);
      if (options?.skipAnimation) {
        playTeachingToolBell(isMutedGlobal);
      }
    },
    [classState, callMode, commitClassState, isMutedGlobal]
  );

  const handleCompleteStageAnimation = useCallback(() => {
    setClassState((prev) => {
      if (!prev || !prev.activeTurn || prev.activeTurn.status !== 'animating') {
        return prev;
      }
      const finalized = finalizePickerTurn(prev);
      saveNamePickerClassState(finalized, accountScopeId);
      playTeachingToolBell(isMutedGlobal);
      return finalized;
    });
  }, [accountScopeId, isMutedGlobal]);

  const handleSkipAnimation = useCallback(() => {
    if (!classState) return;
    if (classState.activeTurn && classState.activeTurn.status === 'animating') {
      const finalized = finalizePickerTurn(classState);
      commitClassState(finalized);
      playTeachingToolBell(isMutedGlobal);
    } else {
      handleTriggerCall({ skipAnimation: true });
    }
  }, [classState, commitClassState, handleTriggerCall, isMutedGlobal]);

  // Global keyboard shortcut `R` + `Escape` for fullscreen exit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenOverlay) {
        setIsFullscreenOverlay(false);
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
        return;
      }

      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.repeat || isAnyModalOpen || isTurnAnimating) return;
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl) {
          const tag = activeEl.tagName.toLowerCase();
          if (
            tag === 'input' ||
            tag === 'textarea' ||
            tag === 'select' ||
            activeEl.isContentEditable ||
            activeEl.getAttribute('role') === 'textbox'
          ) {
            return;
          }
        }
        e.preventDefault();
        handleTriggerCall();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAnyModalOpen, isTurnAnimating, isFullscreenOverlay, handleTriggerCall]);

  const handleToggleFullscreen = () => {
    if (isFullscreenOverlay) {
      setIsFullscreenOverlay(false);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      return;
    }
    setIsFullscreenOverlay(true);
    try {
      stageSectionRef.current?.requestFullscreen?.().catch(() => {});
    } catch {
      // Headless / iframe environment falls back automatically to full-viewport fixed overlay
    }
  };

  // ============================================================================
  // LEFT COLUMN: ATTENDANCE, STAR, ACTIVITY SCORE, SAMPLE & EXCEL ACTIONS
  // ============================================================================
  const handleToggleStudentPresent = (studentId: string) => {
    if (!classState) return;
    commitClassState({
      ...classState,
      students: classState.students.map((s) =>
        s.id === studentId ? { ...s, present: !s.present } : s
      ),
    });
  };

  const handleToggleStudentStar = (studentId: string) => {
    if (!classState) return;
    commitClassState({
      ...classState,
      students: classState.students.map((s) =>
        s.id === studentId ? { ...s, starred: !s.starred } : s
      ),
    });
  };

  const handleScoreAdjust = (studentId: string, delta: 1 | -1) => {
    if (!classState) return;
    playTeachingToolScoreCue(isMutedGlobal, delta > 0);
    const actionId = `np_sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    commitClassState(
      adjustPickerStudentScore({
        state: classState,
        studentId,
        delta,
        actionId,
      })
    );
  };

  const handleCreateSampleClass = (
    preset: 'standard_12' | 'sample_50' | 'sample_1' | 'sample_empty' | 'sample_dup_001'
  ) => {
    const created = createPickerSampleClass({ preset });
    const nextLocals = [created, ...localClasses];
    setLocalClasses(nextLocals);
    savePickerLocalClasses(nextLocals, accountScopeId);
    setSelectedClassId(created.id);
    setShowSampleModal(false);
    setBannerMsg({
      type: 'success',
      text: `Đã tạo "${created.name}" (${created.students.length} HS).`,
    });
  };

  const handleOpenEditRoster = () => {
    if (!classState) return;
    if (classState.sourceType === 'real_readonly') {
      setBannerMsg({
        type: 'info',
        text: 'Lớp thật sử dụng danh sách theo phân công hệ thống. Hãy dùng "Thêm lớp mẫu" hoặc "Nhập Excel" để chỉnh sửa danh sách cục bộ.',
      });
      return;
    }
    setEditDraftStudents(
      classState.students.map((s) => ({
        id: s.id,
        code: s.code,
        fullName: s.fullName,
        present: s.present,
      }))
    );
    setEditError('');
    setNewStuCode('');
    setNewStuName('');
    setShowEditModal(true);
  };

  const handleSaveEditedRoster = () => {
    if (!classState) return;
    if (editDraftStudents.length > MAX_PICKER_STUDENTS) {
      setEditError(`Tối đa ${MAX_PICKER_STUDENTS} học sinh mỗi lớp.`);
      return;
    }
    const seen = new Set<string>();
    for (const s of editDraftStudents) {
      if (!s.code.trim() || !s.fullName.trim()) {
        setEditError('Mã học sinh và Họ và tên không được để trống.');
        return;
      }
      const u = s.code.trim().toUpperCase();
      if (seen.has(u)) {
        setEditError(`Mã học sinh "${s.code}" bị trùng.`);
        return;
      }
      seen.add(u);
    }

    const oldMap = new Map(classState.students.map((s) => [s.id, s]));
    const nextStudents = editDraftStudents.map((d) => {
      const old = oldMap.get(d.id);
      return {
        id: d.id,
        code: d.code.trim(),
        fullName: d.fullName.trim(),
        present: d.present,
        starred: old ? old.starred : false,
        score: old ? old.score : 0,
      };
    });

    const nextLocals = localClasses.map((lc) =>
      lc.id === classState.classId ? { ...lc, students: editDraftStudents } : lc
    );
    setLocalClasses(nextLocals);
    savePickerLocalClasses(nextLocals, accountScopeId);

    commitClassState({
      ...classState,
      students: nextStudents,
    });
    setShowEditModal(false);
    setBannerMsg({
      type: 'success',
      text: `Đã cập nhật danh sách lớp (${nextStudents.length} học sinh).`,
    });
  };

  const handleImportXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const matrix = extractMatrixFromXlsxBuffer(buffer);
      setImportTargetName(file.name.replace(/\.(xlsx|xls|csv)$/i, '') || 'Lớp nhập Excel');
      setImportPreview(parsePickerExcelPreview(matrix));
    } catch {
      setImportPreview({
        rows: [],
        validRows: [],
        errorCount: 1,
        hasDuplicateCodes: false,
        exceedsMaxStudents: false,
        globalError: 'Không đọc được tệp Excel. Hãy kiểm tra định dạng .xlsx.',
      });
    }
    e.target.value = '';
  };

  const handleConfirmExcelImport = () => {
    if (!importPreview || importPreview.validRows.length === 0) return;
    if (importPreview.hasDuplicateCodes || importPreview.exceedsMaxStudents) return;

    const newClassId = `picker_imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const newRecord: PickerLocalClassRecord = {
      id: newClassId,
      name: importTargetName.trim() || 'Lớp nhập Excel',
      sourceType: 'imported_local',
      createdAtMs: Date.now(),
      students: importPreview.validRows.slice(0, MAX_PICKER_STUDENTS).map((r, idx) => ({
        id: `${newClassId}_${r.code}_${idx + 1}`,
        code: r.code,
        fullName: r.fullName,
        present: r.present,
      })),
    };

    const nextLocals = [newRecord, ...localClasses];
    setLocalClasses(nextLocals);
    savePickerLocalClasses(nextLocals, accountScopeId);
    setSelectedClassId(newRecord.id);
    setShowImportModal(false);
    setImportPasteText('');
    setImportPreview(null);
    setBannerMsg({
      type: 'success',
      text: `Đã nhập lớp "${newRecord.name}" (${newRecord.students.length} HS, giữ nguyên mã số).`,
    });
  };

  const handleExportCurrentClassExcel = () => {
    if (!classState) return;
    const bytes = buildPickerXlsxBytes(
      classState.students.map((s) => ({
        code: s.code,
        fullName: s.fullName,
        present: s.present,
      })),
      classState.className
    );
    const safeName = classState.className.replace(/[^a-zA-Z0-9_-]/g, '_') || 'lop_hoc';
    triggerBytesDownload(
      bytes,
      `${safeName}_goi_ten.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    setBannerMsg({
      type: 'success',
      text: `Đã xuất tệp Excel danh sách lớp "${classState.className}" (${classState.students.length} HS).`,
    });
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  const canEditActiveRoster = classState && classState.sourceType !== 'real_readonly';

  const renderRosterColumn = () => {
    if (!classState) {
      return (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 text-center text-xs font-bold text-slate-500">
          Chưa có lớp khả dụng. Hãy nhấn &quot;Thêm lớp mẫu&quot; để bắt đầu ngay.
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 space-y-3.5">
        {/* Class Selector & Present Count */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <label htmlFor="np-class-select" className="font-extrabold text-[#082B52]">
              Danh sách lớp học
            </label>
            <span className="font-bold text-[#1769F4] font-mono tabular-nums">
              Có mặt {eligibility.presentCount}/{classState.students.length} HS
            </span>
          </div>

          <select
            id="np-class-select"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-[#082B52]"
          >
            {classOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} ({opt.students.length} HS)
                {opt.sourceType === 'real_readonly' ? ' · Lớp thật' : ' · Cục bộ'}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-slate-500">
            {classState.sourceType === 'real_readonly'
              ? 'Đọc theo phân công lớp thật. Điểm danh, dấu sao và điểm hoạt động chỉ lưu trong phiên thử.'
              : 'Lớp cục bộ: chỉnh sửa tự do (tối đa 50 HS), dữ liệu tách biệt theo tài khoản & lớp.'}
          </p>
        </div>

        {/* 4 Roster Buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setShowSampleModal(true)}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-[#F8FBFF] hover:bg-blue-50 border border-[#DCE8F7] text-xs font-bold text-[#082B52] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#1769F4]" />
            <span>Thêm lớp mẫu</span>
          </button>

          <button
            type="button"
            onClick={handleOpenEditRoster}
            className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
              canEditActiveRoster
                ? 'bg-[#F8FBFF] hover:bg-blue-50 border-[#DCE8F7] text-[#082B52]'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Sửa danh sách</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportPreview(null);
              setImportPasteText('');
              setShowImportModal(true);
            }}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-[#F8FBFF] hover:bg-blue-50 border border-[#DCE8F7] text-xs font-bold text-[#082B52] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nhập Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportCurrentClassExcel}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-[#F8FBFF] hover:bg-blue-50 border border-[#DCE8F7] text-xs font-bold text-[#082B52] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#1769F4]" />
            <span>Xuất Excel</span>
          </button>
        </div>

        {/* Scrollable Student List */}
        {classState.students.length === 0 ? (
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs font-semibold text-slate-500">
            Lớp hiện tại chưa có học sinh nào. Hãy bấm &quot;Sửa danh sách&quot; hoặc &quot;Nhập Excel&quot;.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {classState.students.map((stu) => {
              const isDup = duplicateNamesSet.has(stu.fullName);
              const isCalledInRound = classState.calledIdsInRound.includes(stu.id);
              return (
                <div
                  key={stu.id}
                  className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                    !stu.present
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : isCalledInRound && classState.noRepeatInRound
                        ? 'bg-blue-50/50 border-blue-200'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleStudentPresent(stu.id)}
                      aria-label={`Điểm danh ${stu.fullName}`}
                      title={stu.present ? 'Đang có mặt (nhấn để đánh vắng)' : 'Đang vắng (nhấn để đánh có mặt)'}
                      className="cursor-pointer shrink-0"
                    >
                      {stu.present ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStudentStar(stu.id)}
                      aria-label={`Gắn sao ưu tiên ${stu.fullName}`}
                      title={stu.starred ? 'Đang trong nhóm Ưu tiên' : 'Thêm vào nhóm Ưu tiên'}
                      className="cursor-pointer shrink-0"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          stu.starred ? 'text-amber-500 fill-amber-400' : 'text-slate-300'
                        }`}
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`font-bold truncate ${
                          !stu.present ? 'line-through text-slate-400' : 'text-[#082B52]'
                        }`}
                        title={`${stu.code} - ${stu.fullName}`}
                      >
                        {stu.fullName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {stu.code}
                        {isDup ? ' · Trùng tên' : ''}
                        {!stu.present ? ' · Vắng' : ''}
                        {isCalledInRound ? ' · Đã gọi' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Session Activity Score +1 / -1 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleScoreAdjust(stu.id, -1)}
                      aria-label={`Trừ 1 điểm ${stu.fullName}`}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 font-black flex items-center justify-center cursor-pointer"
                    >
                      −
                    </button>
                    <span className="min-w-[26px] text-center font-mono tabular-nums font-extrabold text-[#082B52]">
                      {stu.score}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleScoreAdjust(stu.id, 1)}
                      aria-label={`Cộng 1 điểm ${stu.fullName}`}
                      className="w-6 h-6 rounded-lg bg-blue-50 hover:bg-emerald-100 text-[#1769F4] hover:text-emerald-700 font-black flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Undo & Reset Class Scores */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <button
            type="button"
            disabled={!classState.lastScoreUndo}
            onClick={() => commitClassState(undoLastPickerScore(classState))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-bold text-slate-700 cursor-pointer disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Hoàn tác điểm</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetScoresConfirm(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại điểm phiên</span>
          </button>
        </div>

        {/* Đã gọi gần đây */}
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-extrabold text-[#082B52]">
            <span>Đã gọi gần đây ({classState.history.length})</span>
          </div>
          {classState.history.length === 0 ? (
            <p className="text-[11px] text-slate-500">Chưa có lượt gọi nào ở lớp này.</p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {classState.history.slice(0, 6).map((h) => (
                <div
                  key={h.turnId}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] text-slate-700"
                >
                  <div className="flex items-center justify-between font-bold text-[#082B52]">
                    <span>{h.modeLabel}</span>
                    <span className="font-mono text-slate-500">
                      {new Date(h.timestampMs).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="truncate font-semibold text-[#1769F4]">
                    {h.pickedStudents.map((s) => `${s.fullName} (${s.code})`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 font-edtech text-[#0F2D52] w-full min-w-0">
      {/* Header Breadcrumb & Toolbar */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-bold text-[#1769F4]">
            Công cụ dạy học · Quản lý lớp học · Gọi tên &amp; Bốc thăm
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#082B52] truncate">
            Gọi tên &amp; Bốc thăm — {activeClassOpt?.name || 'Chọn lớp'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={lightMode2D}
              onChange={(e) => setLightMode2D(e.target.checked)}
            />
            <span>Chế độ nhẹ (2D)</span>
          </label>

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
            onClick={onToggleMuteGlobal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE8F7] bg-[#F8FBFF] text-xs font-bold text-[#082B52] cursor-pointer"
          >
            {isMutedGlobal ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-[#1769F4]" />}
            <span>{isMutedGlobal ? 'Tắt âm' : 'Âm thanh bật'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#082B52] hover:bg-[#0F3C78] text-white text-xs font-bold cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Trình chiếu toàn màn hình</span>
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div
          role={bannerMsg.type === 'error' ? 'alert' : 'status'}
          className={`px-4 py-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-2 ${
            bannerMsg.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : bannerMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMsg.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{bannerMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="text-xs underline cursor-pointer shrink-0"
          >
            Ẩn
          </button>
        </div>
      )}

      {/* Main Responsive Split: Left Roster (1/3) + Right Stage (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN (Mobile collapsible, positioned after Stage on small screens) */}
        <div className="lg:col-span-4 order-2 lg:order-1 min-w-0">
          <div className="lg:hidden mb-2">
            <button
              type="button"
              onClick={() => setMobileRosterOpen((prev) => !prev)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#DCE8F7] flex items-center justify-between text-xs font-extrabold text-[#082B52] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1769F4]" />
                <span>
                  Danh sách lớp &amp; Điểm ({eligibility.presentCount}/
                  {classState?.students.length || 0} có mặt)
                </span>
              </span>
              {mobileRosterOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className={`${mobileRosterOpen ? 'block' : 'hidden'} lg:block`}>
            {renderRosterColumn()}
          </div>
        </div>

        {/* RIGHT COLUMN: STAGE + 5 MODES + FULLSCREEN WRAPPER (Mobile First!) */}
        <div
          ref={stageSectionRef}
          className={`${
            isFullscreenOverlay
              ? 'fixed inset-0 z-50 bg-[#F8FBFF] p-4 sm:p-8 flex flex-col justify-between overflow-y-auto'
              : 'lg:col-span-8 order-1 lg:order-2 min-w-0'
          }`}
        >
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 sm:p-5 space-y-4">
            {/* Fullscreen top bar */}
            {isFullscreenOverlay && (
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="text-sm font-extrabold text-[#082B52]">
                  {activeClassOpt?.name} · Đủ điều kiện: {eligibility.eligiblePool.length} · Còn lại:{' '}
                  {eligibility.remainingPool.length}
                </div>
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Thoát toàn màn hình (Esc)</span>
                </button>
              </div>
            )}

            {/* 5-Mode Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="tablist"
                aria-label="Năm chế độ gọi tên"
              >
                {CALL_MODES_LIST.map((m) => {
                  const meta = PICKER_CALL_MODE_META[m];
                  const active = callMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setCallMode(m)}
                      className={`px-3 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#1769F4] text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {meta.code}. {meta.label}
                    </button>
                  );
                })}
              </div>

              <span className="text-xs font-semibold text-slate-500 font-mono tabular-nums">
                Đủ điều kiện: <strong className="text-[#082B52]">{eligibility.eligiblePool.length}</strong> · Còn lại trong vòng:{' '}
                <strong className="text-[#1769F4]">{eligibility.remainingPool.length}</strong>
              </span>
            </div>

            {/* Stage Controls: Scope, Anti-repeat, Count k, Call Buttons */}
            {classState && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FBFF] border border-[#DCE8F7]">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Scope */}
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white border border-slate-200">
                    {(
                      [
                        { id: 'all_present', label: 'Tất cả có mặt' },
                        { id: 'starred_only', label: 'Chỉ nhóm ưu tiên ★' },
                      ] as { id: PickerScope; label: string }[]
                    ).map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => commitClassState({ ...classState, scope: sc.id })}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                          classState.scope === sc.id
                            ? 'bg-[#082B52] text-white'
                            : 'text-slate-600 hover:text-[#082B52]'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>

                  {/* No Repeat Toggle */}
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#082B52] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={classState.noRepeatInRound}
                      onChange={(e) =>
                        commitClassState({ ...classState, noRepeatInRound: e.target.checked })
                      }
                    />
                    <span>Không gọi lại trong vòng</span>
                  </label>

                  {/* Quantity k stepper + integer input */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-bold text-slate-600 mr-1">Số lượng gọi:</span>
                    <button
                      type="button"
                      onClick={() =>
                        commitClassState({
                          ...classState,
                          requestedK: Math.max(1, classState.requestedK - 1),
                        })
                      }
                      aria-label="Giảm số lượng gọi"
                      className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={MAX_PICKER_STUDENTS}
                      value={classState.requestedK}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(MAX_PICKER_STUDENTS, Math.trunc(Number(e.target.value) || 1)));
                        commitClassState({ ...classState, requestedK: val });
                      }}
                      aria-label="Số học sinh mỗi lượt"
                      className="w-12 py-1 text-center rounded-lg border border-slate-300 bg-white font-mono font-extrabold text-sm text-[#082B52]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        commitClassState({
                          ...classState,
                          requestedK: Math.min(MAX_PICKER_STUDENTS, classState.requestedK + 1),
                        })
                      }
                      aria-label="Tăng số lượng gọi"
                      className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Primary CTA + Skip */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!eligibility.canCallNow || isTurnAnimating}
                    onClick={() => handleTriggerCall()}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs sm:text-sm font-extrabold shadow-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isTurnAnimating ? 'Đang gọi...' : 'Gọi ngay (R)'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!eligibility.canCallNow && !isTurnAnimating}
                    onClick={handleSkipAnimation}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-45 text-slate-700 text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Bỏ qua hiệu ứng</span>
                  </button>
                </div>
              </div>
            )}

            {/* Blocked reason callout if 0 eligible or exhausted round */}
            {!eligibility.canCallNow && (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm font-bold text-amber-950 flex flex-wrap items-center justify-between gap-2"
              >
                <span>{eligibility.blockedReason}</span>
                {classState && eligibility.eligiblePool.length > 0 && eligibility.remainingPool.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      commitClassState(startNewPickerRound(classState));
                      setBannerMsg({
                        type: 'success',
                        text: 'Đã bắt đầu vòng mới. Tất cả học sinh đủ điều kiện đã sẵn sàng.',
                      });
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1769F4] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Bắt đầu vòng mới
                  </button>
                )}
              </div>
            )}

            {/* ACTIVE VISUAL STAGE FOR SELECTED MODE */}
            {classState && (
              <NamePickerStage
                mode={callMode}
                allStudents={classState.students}
                eligiblePool={eligibility.eligiblePool}
                remainingPool={eligibility.remainingPool}
                activeTurn={classState.activeTurn}
                requestedK={classState.requestedK}
                reducedMotion={localReducedMotion}
                use3D={!lightMode2D}
                isFullscreen={isFullscreenOverlay}
                onCompleteAnimation={handleCompleteStageAnimation}
                onStartQuickTurn={() => handleTriggerCall()}
                onOpenClassicA01={onOpenClassicA01}
                onAutoFallback2D={(reason) => {
                  setLightMode2D(true);
                  setBannerMsg({ type: 'info', text: reason });
                }}
              />
            )}

            {/* Round & History Management Row (hidden in streamlined fullscreen) */}
            {classState && !isFullscreenOverlay && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      commitClassState(startNewPickerRound(classState));
                      setBannerMsg({
                        type: 'info',
                        text: 'Đã bắt đầu vòng mới (làm mới danh sách chống lặp, giữ nguyên lịch sử & điểm).',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F0F7FF] hover:bg-blue-100 border border-[#DCE8F7] text-[#1769F4] font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Bắt đầu vòng mới</span>
                  </button>

                  <button
                    type="button"
                    disabled={classState.history.length === 0}
                    onClick={() => setShowClearHistoryConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 font-bold cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa lịch sử lớp</span>
                  </button>
                </div>

                <span className="text-slate-500 font-semibold">
                  Phím R gọi nhanh · {PICKER_CALL_MODE_META[callMode].shortDesc}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: 3 INDEPENDENT RANDOM UTILITIES (Hidden only in Fullscreen Projector) */}
      {!isFullscreenOverlay && (
        <NamePickerUtilitiesBar
          utilities={utilities}
          reducedMotion={localReducedMotion}
          use3D={!lightMode2D}
          isMutedGlobal={isMutedGlobal}
          onChangeUtilities={commitUtilities}
        />
      )}

      {/* Full Lịch sử gọi tên section (Teacher screen bottom summary) */}
      {classState && !isFullscreenOverlay && classState.history.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#DCE8F7] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#082B52] flex items-center gap-2">
              <History className="w-4 h-4 text-[#1769F4]" />
              <span>Nhật ký các lượt gọi lớp {classState.className} ({classState.history.length} lượt)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 pr-3 font-bold">Thời gian</th>
                  <th className="py-1.5 pr-3 font-bold">Chế độ</th>
                  <th className="py-1.5 pr-3 font-bold">Phạm vi</th>
                  <th className="py-1.5 font-bold">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {classState.history.slice(0, 20).map((h) => (
                  <tr key={h.turnId} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(h.timestampMs).toLocaleTimeString('vi-VN')}
                    </td>
                    <td className="py-1.5 pr-3 font-bold text-[#082B52]">{h.modeLabel}</td>
                    <td className="py-1.5 pr-3 text-slate-600">
                      {h.scope === 'starred_only' ? 'Nhóm ưu tiên ★' : 'Tất cả có mặt'}
                    </td>
                    <td className="py-1.5 font-bold text-[#1769F4]">
                      {h.pickedStudents.map((s) => `${s.fullName} (${s.code})`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================
          MODALS (SHORTFALL, SAMPLE CLASS, EDIT ROSTER, EXCEL IMPORT, CONFIRMS)
         ======================================================================== */}
      {shortfallDecision && classState && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h4 className="text-base font-extrabold text-[#082B52]">
              Số học sinh còn lại ít hơn số lượng cần gọi
            </h4>
            <p className="text-xs sm:text-sm text-slate-700">
              Vòng hiện tại chỉ còn <strong>{shortfallDecision.remainingCount} học sinh</strong>{' '}
              chưa gọi, nhỏ hơn số lượng bạn yêu cầu ({shortfallDecision.requestedK}). Hệ thống không tự động lặp tên để bù đủ.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShortfallDecision(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = startNewPickerRound(classState);
                  commitClassState(next);
                  setShortfallDecision(null);
                  setBannerMsg({
                    type: 'info',
                    text: 'Đã bắt đầu vòng mới. Hãy nhấn Gọi ngay để chọn đủ số lượng.',
                  });
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#082B52] text-xs font-extrabold cursor-pointer"
              >
                Bắt đầu vòng mới
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTriggerCall({ countOverride: shortfallDecision.remainingCount })
                }
                className="px-4 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-extrabold cursor-pointer"
              >
                Gọi {shortfallDecision.remainingCount} bạn còn lại
              </button>
            </div>
          </div>
        </div>
      )}

      {showSampleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-extrabold text-[#082B52]">Thêm lớp mẫu thử nghiệm</h4>
              <button
                type="button"
                onClick={() => setShowSampleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {(
                [
                  { id: 'standard_12', label: 'Lớp mẫu chuẩn 12 HS (Mã 001–012)' },
                  { id: 'sample_50', label: 'Lớp mẫu đông 50 HS (Mã 001–050, có trùng tên)' },
                  { id: 'sample_dup_001', label: 'Lớp kiểm tra trùng tên & 1 học sinh vắng (5 HS)' },
                  { id: 'sample_1', label: 'Lớp biên tối thiểu 1 HS' },
                  { id: 'sample_empty', label: 'Lớp trống 0 HS' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleCreateSampleClass(p.id)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FBFF] hover:bg-blue-50 border border-[#DCE8F7] text-left font-bold text-[#082B52] cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showEditModal && classState && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-extrabold text-[#082B52]">
                Sửa danh sách lớp: {classState.className} ({editDraftStudents.length}/{MAX_PICKER_STUDENTS})
              </h4>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              <input
                type="text"
                value={newStuCode}
                onChange={(e) => setNewStuCode(e.target.value)}
                placeholder="Mã HS (VD: 009)"
                className="sm:col-span-3 px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
              />
              <input
                type="text"
                value={newStuName}
                onChange={(e) => setNewStuName(e.target.value)}
                placeholder="Họ và tên học sinh..."
                className="sm:col-span-6 px-3 py-2 rounded-xl border border-slate-300 font-semibold"
              />
              <button
                type="button"
                onClick={() => {
                  const code = newStuCode.trim() || String(editDraftStudents.length + 1).padStart(3, '0');
                  const name = newStuName.trim();
                  if (!name) {
                    setEditError('Vui lòng nhập Họ và tên học sinh.');
                    return;
                  }
                  if (editDraftStudents.length >= MAX_PICKER_STUDENTS) {
                    setEditError(`Lớp đã đạt tối đa ${MAX_PICKER_STUDENTS} học sinh.`);
                    return;
                  }
                  setEditDraftStudents((prev) => [
                    ...prev,
                    {
                      id: `stu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
                      code,
                      fullName: name,
                      present: true,
                    },
                  ]);
                  setNewStuCode('');
                  setNewStuName('');
                  setEditError('');
                }}
                className="sm:col-span-3 px-3 py-2 rounded-xl bg-[#1769F4] text-white font-bold cursor-pointer"
              >
                + Thêm HS
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {editDraftStudents.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.code}
                    onChange={(e) =>
                      setEditDraftStudents((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, code: e.target.value } : item))
                      )
                    }
                    className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                  <input
                    type="text"
                    value={s.fullName}
                    onChange={(e) =>
                      setEditDraftStudents((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, fullName: e.target.value } : item
                        )
                      )
                    }
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditDraftStudents((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditedRoster}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                Lưu danh sách
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-extrabold text-[#082B52]">
                Nhập danh sách học sinh từ Excel (.xlsx) hoặc Dán bảng
              </h4>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Cột chuẩn gồm <strong>Mã học sinh</strong> (giữ số 0 ở đầu như <code>001</code>),{' '}
              <strong>Họ và tên</strong> và cột tùy chọn <strong>Có mặt</strong> (Có/Vắng). Không chứa Email. Tối đa {MAX_PICKER_STUDENTS} HS.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerBytesDownload(
                    buildPickerSampleXlsxBytes(),
                    'mau_danh_sach_goi_ten.xlsx',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F0F7FF] border border-[#DCE8F7] text-[#1769F4] text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải file Excel mẫu (.xlsx)</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#082B52] text-white text-xs font-bold cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Chọn tệp .xlsx</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportXlsxFile}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Tên lớp sẽ tạo:</label>
              <input
                type="text"
                value={importTargetName}
                onChange={(e) => setImportTargetName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Hoặc dán trực tiếp từ Excel (Ctrl+V):
              </label>
              <textarea
                rows={4}
                value={importPasteText}
                onChange={(e) => {
                  const val = e.target.value;
                  setImportPasteText(val);
                  setImportPreview(val.trim() ? parsePickerExcelPreview(val) : null);
                }}
                placeholder={'Mã học sinh\tHọ và tên\tCó mặt\n001\tNguyễn Văn An\tCó\n002\tNguyễn Văn An\tCó'}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs"
              />
            </div>

            {importPreview && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                {importPreview.globalError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                    {importPreview.globalError}
                  </div>
                )}
                <div className="text-xs font-bold text-[#082B52]">
                  Xem trước: {importPreview.rows.length} dòng · Hợp lệ:{' '}
                  <span className="text-emerald-700">{importPreview.validRows.length}</span> · Lỗi:{' '}
                  <span className="text-rose-700">{importPreview.errorCount}</span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-2 font-bold">Dòng</th>
                        <th className="p-2 font-bold">Mã HS</th>
                        <th className="p-2 font-bold">Họ và tên</th>
                        <th className="p-2 font-bold">Có mặt</th>
                        <th className="p-2 font-bold">Kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.map((r) => (
                        <tr
                          key={r.rowNumber}
                          className={`border-b border-slate-100 ${
                            r.errors.length > 0 ? 'bg-rose-50/70' : ''
                          }`}
                        >
                          <td className="p-2 font-mono">{r.rowNumber}</td>
                          <td className="p-2 font-mono font-bold">{r.code || '—'}</td>
                          <td className="p-2 font-semibold">{r.fullName || '—'}</td>
                          <td className="p-2">{r.present ? 'Có' : 'Vắng'}</td>
                          <td className="p-2">
                            {r.errors.length === 0 ? (
                              <span className="text-emerald-700 font-bold">Hợp lệ</span>
                            ) : (
                              <span className="text-rose-700 font-bold">{r.errors.join(' ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={
                  !importPreview ||
                  importPreview.validRows.length === 0 ||
                  importPreview.hasDuplicateCodes ||
                  importPreview.exceedsMaxStudents
                }
                onClick={handleConfirmExcelImport}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer disabled:cursor-not-allowed"
              >
                Nhập {importPreview?.validRows.length || 0} học sinh hợp lệ
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetScoresConfirm && classState && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <h4 className="text-base font-extrabold text-[#082B52]">
              Đặt lại điểm phiên lớp {classState.className}?
            </h4>
            <p className="text-xs text-slate-600">
              Thao tác này chỉ đưa điểm hoạt động của lớp đang chọn về 0, không ảnh hưởng lớp khác hay sổ điểm chính thức.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetScoresConfirm(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  commitClassState(resetClassPickerScores(classState));
                  setShowResetScoresConfirm(false);
                  setBannerMsg({
                    type: 'info',
                    text: `Đã đặt lại điểm phiên cho lớp ${classState.className}.`,
                  });
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận đặt lại
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearHistoryConfirm && classState && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <h4 className="text-base font-extrabold text-[#082B52]">
              Xóa toàn bộ lịch sử gọi của lớp {classState.className}?
            </h4>
            <p className="text-xs text-slate-600">
              Lịch sử lượt gọi của lớp này sẽ bị xóa. Nếu chỉ muốn bắt đầu lượt chống lặp mới mà giữ lịch sử, hãy dùng nút &quot;Bắt đầu vòng mới&quot;.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirm(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  commitClassState(clearClassPickerHistory(classState));
                  setShowClearHistoryConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Xóa lịch sử lớp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
