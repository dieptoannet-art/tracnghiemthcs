import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  FolderOpen,
  HelpCircle,
  LayoutGrid,
  Link2,
  Minimize2,
  Maximize2,
  PanelLeftOpen,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  CognitiveLevel,
  ExamMatrix,
  ExamPeriod,
  Grade,
  MatrixAllocationCell,
  MatrixDraftState,
  MatrixPointConfig,
  QuestionType,
  YccdItem
} from '../../types';
import {
  applyAutoCodesToAllocations,
  buildAllocationKey,
  buildExamMatrixRecord,
  buildYccdTree,
  checkBankReadinessForMatrix,
  COGNITIVE_LABELS,
  COGNITIVE_LEVELS,
  computeMatrixSummary,
  DEFAULT_POINT_CONFIG,
  EXAM_PERIOD_LABELS,
  formatPercentClean,
  QUESTION_FORMAT_LABELS,
  TreeTopicGroup
} from '../../utils/matrixCalculations';
import {
  normalizeGrade,
  normalizeId,
  normalizeSubjectToKey,
  subjectKeyToDisplayName
} from '../../utils/yccdCsvParser';
import { exportMatrixAndSpecDocx } from '../../utils/exportMatrixDocx';
import { YccdTreeSidebar } from './YccdTreeSidebar';
import { YccdCsvImportModal } from './YccdCsvImportModal';

const BASE_SUBJECT_OPTIONS = [
  'Tin học',
  'Toán',
  'Khoa học tự nhiên',
  'Ngữ văn',
  'Tiếng Anh',
  'Lịch sử và Địa lí',
  'Công nghệ',
  'Giáo dục công dân'
];

const LEVEL_TAG_STYLES: Record<CognitiveLevel, string> = {
  know: 'bg-sky-100 text-sky-900 border-sky-200',
  understand: 'bg-amber-100 text-amber-900 border-amber-200',
  apply: 'bg-emerald-100 text-emerald-900 border-emerald-200'
};

interface BackupSnapshot {
  selectedYccdKeys: string[];
  allocations: Record<string, MatrixAllocationCell>;
  competencyOverrides: Record<string, string>;
  pointConfig: MatrixPointConfig;
  durationMinutes: number;
  showShortAnswer: boolean;
}

function createDraftUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const ExamMatrixModal: React.FC = () => {
  const {
    matrices,
    questions,
    yccdCatalog,
    importYccdItems,
    saveMatrixDraft,
    deleteMatrixDraft,
    setCurrentView,
    setPendingMatrixPrompt,
    userProfile
  } = useApp();

  // Dynamic subject list combining standard subjects + any newly imported CSV subjects
  const subjectOptions = useMemo(() => {
    const list = [...BASE_SUBJECT_OPTIONS];
    const seenNorm = new Set(list.map(s => normalizeSubjectToKey(s)));
    for (const item of yccdCatalog) {
      const k = normalizeSubjectToKey(item.subject);
      if (!seenNorm.has(k)) {
        seenNorm.add(k);
        list.push(item.subject);
      }
    }
    return list;
  }, [yccdCatalog]);

  // Initial filter values: Tin học – Khối 6 – Giữa kì I – 45 phút (matching spec & mockup)
  const [draftId, setDraftId] = useState<string>(() => createDraftUuid());
  const [draftTitle, setDraftTitle] = useState<string>(
    'Ma trận & Bản đặc tả kiểm tra Giữa kì I - Tin học 6'
  );
  const [subjectName, setSubjectName] = useState<string>('Tin học');
  const [grade, setGrade] = useState<Grade>('6');
  const [period, setPeriod] = useState<ExamPeriod>('mid1');
  const [schoolYear, setSchoolYear] = useState<string>('2025 - 2026');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [showShortAnswer, setShowShortAnswer] = useState<boolean>(false);

  const [pointConfig, setPointConfig] = useState<MatrixPointConfig>(() => ({
    ...DEFAULT_POINT_CONFIG
  }));

  const [allocations, setAllocations] = useState<Record<string, MatrixAllocationCell>>({});
  const [competencyOverrides, setCompetencyOverrides] = useState<Record<string, string>>({});

  // Default selected YCCĐ: Topic A (Chủ đề A) of Tin học Khối 6 so UI matches mockup out of the box
  const [selectedYccdKeys, setSelectedYccdKeys] = useState<string[]>(() => {
    const grade6InformaticsTopicA = yccdCatalog.filter(
      it =>
        normalizeSubjectToKey(it.subject) === 'informatics' &&
        normalizeGrade(it.grade) === '6' &&
        (normalizeId(it.topicId) === '326' || it.topicShortLabel === 'Chủ đề A')
    );
    return grade6InformaticsTopicA.map(it => normalizeId(it.stableKey));
  });

  // UI States
  const [activeTab, setActiveTab] = useState<'matrix' | 'specification'>('matrix');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const [showPointConfig, setShowPointConfig] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);
  const [showDraftsModal, setShowDraftsModal] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showBankPanel, setShowBankPanel] = useState<boolean>(true);

  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({ '326': true });
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [collapsedMatrixTopics, setCollapsedMatrixTopics] = useState<Record<string, boolean>>({});
  const [editingLinkRowKey, setEditingLinkRowKey] = useState<string | null>(null);
  const [editingCompKey, setEditingCompKey] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'warning' | 'info'; text: string } | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [undoSelectionSnapshot, setUndoSelectionSnapshot] = useState<{
    prevKeys: string[];
    label: string;
  } | null>(null);

  // Per-(subjectKey+grade+period) session backup so switching filters doesn't destroy unsaved work
  const filterBucketCacheRef = useRef<Record<string, BackupSnapshot>>({});

  const showToast = (type: 'success' | 'warning' | 'info', text: string) => {
    setToastMsg({ type, text });
  };

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const currentSubjectKey = useMemo(() => normalizeSubjectToKey(subjectName), [subjectName]);

  // Filter YCCĐ catalog for current subject + grade
  const filteredCatalog = useMemo(
    () =>
      yccdCatalog.filter(
        it =>
          normalizeSubjectToKey(it.subject) === currentSubjectKey &&
          normalizeGrade(it.grade) === normalizeGrade(grade)
      ),
    [yccdCatalog, currentSubjectKey, grade]
  );

  // Build 3-level tree from filtered catalog
  const tree: TreeTopicGroup[] = useMemo(() => buildYccdTree(filteredCatalog), [filteredCatalog]);

  // Expand first topic automatically when filtered tree changes and none are expanded
  useEffect(() => {
    if (tree.length > 0) {
      setExpandedTopics(prev => {
        const hasAnyVisibleExpanded = tree.some(t => prev[t.topicId]);
        if (hasAnyVisibleExpanded) return prev;
        return { ...prev, [tree[0].topicId]: true };
      });
    }
  }, [tree]);

  const activeFormats: QuestionType[] = useMemo(
    () =>
      showShortAnswer
        ? ['single_choice', 'true_false_group', 'short_answer', 'essay']
        : ['single_choice', 'true_false_group', 'essay'],
    [showShortAnswer]
  );

  const selectedSet = useMemo(() => new Set(selectedYccdKeys.map(normalizeId)), [selectedYccdKeys]);

  // Compute live matrix & specification summary (Single Source of Truth)
  const summary = useMemo(
    () =>
      computeMatrixSummary(
        tree,
        selectedSet,
        allocations,
        pointConfig,
        activeFormats,
        competencyOverrides
      ),
    [tree, selectedSet, allocations, pointConfig, activeFormats, competencyOverrides]
  );

  // Bank Readiness live check
  const bankReadiness = useMemo(
    () =>
      checkBankReadinessForMatrix(
        tree,
        selectedSet,
        allocations,
        activeFormats,
        subjectName,
        grade,
        questions
      ),
    [tree, selectedSet, allocations, activeFormats, subjectName, grade, questions]
  );

  // Switch filters safely while backing up unsaved entries per bucket
  const handleFilterChange = (nextSubject: string, nextGrade: Grade, nextPeriod: ExamPeriod) => {
    const oldBucket = `${currentSubjectKey}::${grade}::${period}`;
    const hasEnteredData = Object.values(allocations).some(a => a.count > 0 || a.codeText.trim() !== '');
    if (hasEnteredData || selectedYccdKeys.length > 0 || filteredCatalog.length > 0) {
      filterBucketCacheRef.current[oldBucket] = {
        selectedYccdKeys,
        allocations,
        competencyOverrides,
        pointConfig,
        durationMinutes,
        showShortAnswer
      };
    }

    const nextSubjKey = normalizeSubjectToKey(nextSubject);
    const nextBucket = `${nextSubjKey}::${nextGrade}::${nextPeriod}`;
    const cached = filterBucketCacheRef.current[nextBucket];

    setSubjectName(nextSubject);
    setGrade(nextGrade);
    setPeriod(nextPeriod);
    setDraftTitle(`Ma trận & Bản đặc tả kiểm tra ${EXAM_PERIOD_LABELS[nextPeriod]} - ${nextSubject} ${nextGrade}`);
    setEditingLinkRowKey(null);
    setUndoSelectionSnapshot(null);
    setCollapsedMatrixTopics({});

    if (cached) {
      setSelectedYccdKeys(cached.selectedYccdKeys.map(normalizeId));
      setAllocations(cached.allocations);
      setCompetencyOverrides(cached.competencyOverrides || {});
      setPointConfig(cached.pointConfig);
      setDurationMinutes(cached.durationMinutes);
      setShowShortAnswer(cached.showShortAnswer);
      showToast('info', `Đã khôi phục phân bổ đã nhập trước đó cho ${nextSubject} ${nextGrade} (${EXAM_PERIOD_LABELS[nextPeriod]}).`);
    } else {
      // If first time visiting a subject/grade/period, pre-select Topic 1 if available cleanly
      const targetItems = yccdCatalog.filter(
        it =>
          normalizeSubjectToKey(it.subject) === nextSubjKey &&
          normalizeGrade(it.grade) === normalizeGrade(nextGrade)
      );
      const firstTopicId = targetItems[0] ? normalizeId(targetItems[0].topicId) : '';
      const defaultKeys = firstTopicId
        ? targetItems.filter(it => normalizeId(it.topicId) === firstTopicId).map(it => normalizeId(it.stableKey))
        : [];
      setSelectedYccdKeys(defaultKeys);
      setAllocations({});
      setCompetencyOverrides({});
      if (firstTopicId) {
        setExpandedTopics(prev => ({ ...prev, [firstTopicId]: true }));
      }
    }
  };

  // Toggle selection handlers with undo protection if unchecking allocated items
  const applySelectionUpdate = (nextKeysRaw: string[], uncheckLabel?: string) => {
    const nextKeys = Array.from(new Set(nextKeysRaw.map(normalizeId).filter(Boolean)));
    const prevKeysNorm = selectedYccdKeys.map(normalizeId);
    const prevSet = new Set(prevKeysNorm);
    const nextSet = new Set(nextKeys);
    const removedKeys = prevKeysNorm.filter(k => !nextSet.has(k));

    if (removedKeys.length > 0 && uncheckLabel) {
      // Check if any removed YCCĐ belongs to a unit that has entered allocations
      const removedKeySet = new Set(removedKeys);
      const removedUnitKeys = new Set(
        filteredCatalog
          .filter(it => removedKeySet.has(normalizeId(it.stableKey)))
          .map(it => `${normalizeId(it.subjectKey)}|${normalizeGrade(it.grade)}|${normalizeId(it.topicId)}|${normalizeId(it.unitId)}`)
      );
      const affectsAllocated = Object.values(allocations).some(
        c => c.count > 0 && removedUnitKeys.has(c.unitKey)
      );
      if (affectsAllocated) {
        setUndoSelectionSnapshot({ prevKeys: Array.from(prevSet), label: uncheckLabel });
      }
    }

    setSelectedYccdKeys(nextKeys);
    setAllocations(prev => applyAutoCodesToAllocations(tree, nextSet, prev, activeFormats));
  };

  const expandMatrixTopicsForKeys = (keys: string[]) => {
    const keySet = new Set(keys.map(normalizeId));
    const topicIdsToOpen: string[] = [];
    for (const t of tree) {
      const hasAny = t.units.some(u =>
        COGNITIVE_LEVELS.some(lvl => u.itemsByLevel[lvl].some(it => keySet.has(normalizeId(it.stableKey))))
      );
      if (hasAny) {
        topicIdsToOpen.push(normalizeId(t.topicId));
      }
    }
    if (topicIdsToOpen.length > 0) {
      setCollapsedMatrixTopics(prev => {
        const next = { ...prev };
        for (const tid of topicIdsToOpen) {
          next[tid] = false;
        }
        return next;
      });
    }
  };

  const handleToggleYccd = (stableKey: string) => {
    const normKey = normalizeId(stableKey);
    const exists = selectedSet.has(normKey);
    const nextKeys = exists
      ? selectedYccdKeys.filter(k => normalizeId(k) !== normKey)
      : [...selectedYccdKeys, normKey];
    if (!exists) {
      expandMatrixTopicsForKeys([normKey]);
    }
    applySelectionUpdate(nextKeys, exists ? '1 Yêu cầu cần đạt vừa bỏ chọn' : undefined);
  };

  const handleToggleUnit = (_unitKey: string, allUnitKeys: string[]) => {
    const normUnitKeys = allUnitKeys.map(normalizeId).filter(Boolean);
    const allChecked = normUnitKeys.length > 0 && normUnitKeys.every(k => selectedSet.has(k));
    const unitKeySet = new Set(normUnitKeys);
    const nextKeys = allChecked
      ? selectedYccdKeys.filter(k => !unitKeySet.has(normalizeId(k)))
      : Array.from(new Set([...selectedYccdKeys.map(normalizeId), ...normUnitKeys]));
    if (!allChecked) {
      expandMatrixTopicsForKeys(normUnitKeys);
    }
    applySelectionUpdate(nextKeys, allChecked ? 'Đơn vị kiến thức vừa bỏ chọn' : undefined);
  };

  const handleToggleTopic = (topicId: string, allTopicKeys: string[]) => {
    const normTopicId = normalizeId(topicId);
    const treeTopic = tree.find(t => normalizeId(t.topicId) === normTopicId);
    const canonicalTopicKeys = treeTopic
      ? treeTopic.units.flatMap(u =>
          COGNITIVE_LEVELS.flatMap(lvl => u.itemsByLevel[lvl].map(it => normalizeId(it.stableKey)))
        )
      : allTopicKeys.map(normalizeId).filter(Boolean);

    const allChecked =
      canonicalTopicKeys.length > 0 && canonicalTopicKeys.every(k => selectedSet.has(k));
    const topicKeySet = new Set(canonicalTopicKeys);
    const nextKeys = allChecked
      ? selectedYccdKeys.filter(k => !topicKeySet.has(normalizeId(k)))
      : Array.from(new Set([...selectedYccdKeys.map(normalizeId), ...canonicalTopicKeys]));

    if (!allChecked) {
      setCollapsedMatrixTopics(prev => ({ ...prev, [normTopicId]: false }));
    }
    applySelectionUpdate(nextKeys, allChecked ? 'Chủ đề vừa bỏ chọn' : undefined);
  };

  const handleSelectAllFiltered = () => {
    const allKeys = filteredCatalog.map(it => normalizeId(it.stableKey));
    setCollapsedMatrixTopics({});
    applySelectionUpdate(allKeys);
  };

  const handleClearAllFiltered = () => {
    applySelectionUpdate([], 'toàn bộ danh mục đã chọn');
  };

  const handleUndoSelection = () => {
    if (!undoSelectionSnapshot) return;
    const restored = undoSelectionSnapshot.prevKeys.map(normalizeId);
    expandMatrixTopicsForKeys(restored);
    setSelectedYccdKeys(restored);
    setAllocations(prev => applyAutoCodesToAllocations(tree, new Set(restored), prev, activeFormats));
    setUndoSelectionSnapshot(null);
    showToast('success', 'Đã khôi phục lựa chọn và số liệu phân bổ trước đó.');
  };

  // Allocation cell edits (top count input & bottom code input)
  const handleCountChange = (
    unitKey: string,
    level: CognitiveLevel,
    qType: QuestionType,
    rawText: string,
    defaultLinkedKey: string
  ) => {
    const allocKey = buildAllocationKey(unitKey, level, qType);
    const trimmed = rawText.trim();
    const parsedNum = trimmed === '' ? 0 : Number(trimmed);
    const validCount = Number.isInteger(parsedNum) && parsedNum > 0 ? parsedNum : 0;

    setAllocations(prev => {
      const existing = prev[allocKey];
      const nextCell: MatrixAllocationCell = {
        unitKey,
        level,
        questionType: qType,
        count: validCount,
        rawCountText: rawText,
        codeText: existing?.codeText || '',
        isManualCode: existing?.isManualCode || false,
        linkedYccdKeys:
          existing?.linkedYccdKeys && existing.linkedYccdKeys.length > 0
            ? existing.linkedYccdKeys
            : defaultLinkedKey
            ? [defaultLinkedKey]
            : []
      };
      const updated = { ...prev, [allocKey]: nextCell };
      return applyAutoCodesToAllocations(tree, selectedSet, updated, activeFormats);
    });
  };

  const handleCodeChange = (
    unitKey: string,
    level: CognitiveLevel,
    qType: QuestionType,
    codeValue: string,
    defaultLinkedKey: string
  ) => {
    const allocKey = buildAllocationKey(unitKey, level, qType);
    setAllocations(prev => {
      const existing = prev[allocKey] || {
        unitKey,
        level,
        questionType: qType,
        count: 0,
        rawCountText: '',
        codeText: '',
        isManualCode: false,
        linkedYccdKeys: defaultLinkedKey ? [defaultLinkedKey] : []
      };
      return {
        ...prev,
        [allocKey]: {
          ...existing,
          codeText: codeValue,
          isManualCode: codeValue.trim() !== ''
        }
      };
    });
  };

  const handleResetCellAutoCode = (allocKey: string) => {
    setAllocations(prev => {
      const existing = prev[allocKey];
      if (!existing) return prev;
      const updated = {
        ...prev,
        [allocKey]: { ...existing, isManualCode: false, codeText: '' }
      };
      return applyAutoCodesToAllocations(tree, selectedSet, updated, activeFormats);
    });
  };

  const handleResetAllAutoCodes = () => {
    setAllocations(prev => {
      const cleared: Record<string, MatrixAllocationCell> = {};
      for (const [k, cell] of Object.entries(prev) as Array<[string, MatrixAllocationCell]>) {
        cleared[k] = { ...cell, isManualCode: false, codeText: '' };
      }
      return applyAutoCodesToAllocations(tree, selectedSet, cleared, activeFormats);
    });
    showToast('info', 'Đã tự động đánh lại toàn bộ mã câu/ý liên tục từ trên xuống.');
  };

  const handleToggleLinkedYccd = (allocKey: string, yccdStableKey: string, checkedSiblingKeys: string[]) => {
    setAllocations(prev => {
      const cell = prev[allocKey];
      if (!cell) return prev;
      const currentValid = (cell.linkedYccdKeys || []).filter(k => checkedSiblingKeys.includes(k));
      const base = currentValid.length > 0 ? currentValid : checkedSiblingKeys.slice(0, 1);
      const exists = base.includes(yccdStableKey);
      let nextLinked = exists ? base.filter(k => k !== yccdStableKey) : [...base, yccdStableKey];
      if (nextLinked.length === 0) {
        nextLinked = [yccdStableKey];
      }
      return {
        ...prev,
        [allocKey]: {
          ...cell,
          linkedYccdKeys: nextLinked
        }
      };
    });
  };

  const handleToggleShortAnswer = (checked: boolean) => {
    setShowShortAnswer(checked);
    const nextFormats: QuestionType[] = checked
      ? ['single_choice', 'true_false_group', 'short_answer', 'essay']
      : ['single_choice', 'true_false_group', 'essay'];
    setAllocations(prev => applyAutoCodesToAllocations(tree, selectedSet, prev, nextFormats));
  };

  const buildCurrentDraftState = (): MatrixDraftState => ({
    id: draftId,
    title: draftTitle.trim() || `Ma trận ${subjectName} ${grade} - ${EXAM_PERIOD_LABELS[period]}`,
    subject: subjectName,
    subjectKey: currentSubjectKey,
    grade,
    period,
    schoolYear,
    durationMinutes: Math.max(5, Number(durationMinutes) || 45),
    showShortAnswer,
    selectedYccdKeys,
    allocations,
    competencyOverrides,
    pointConfig,
    updatedAt: new Date().toISOString(),
    authorName: userProfile?.fullName || 'GV. Diệp Thanh Toàn'
  });

  // Save draft to AppContext + localStorage + Supabase
  const handleSaveDraft = async () => {
    const draft = buildCurrentDraftState();
    const record = buildExamMatrixRecord(
      draft,
      tree,
      summary,
      activeFormats,
      userProfile?.id
    );
    const res = await saveMatrixDraft(record);
    if (res.savedToSupabase) {
      showToast('success', 'Đã lưu bản nháp vào hồ sơ hệ thống & đồng bộ Supabase thành công!');
    } else if (res.error) {
      showToast('warning', `Đã lưu bản nháp trên trình duyệt (Supabase: ${res.error}).`);
    } else {
      showToast('success', 'Đã lưu bản nháp ma trận & bản đặc tả thành công!');
    }
  };

  // Load saved matrix draft (restores filters, selected YCCĐ, allocations, manual codes, duration, point config)
  const handleLoadDraft = (mtx: ExamMatrix) => {
    if (mtx.draftState) {
      const ds = mtx.draftState;
      setDraftId(ds.id);
      setSubjectName(ds.subject || subjectKeyToDisplayName(ds.subjectKey));
      setGrade(ds.grade);
      setPeriod(ds.period);
      setSchoolYear(ds.schoolYear || '2025 - 2026');
      setDurationMinutes(ds.durationMinutes || 45);
      setShowShortAnswer(Boolean(ds.showShortAnswer));
      const normalizedLoadedKeys = (ds.selectedYccdKeys || []).map(normalizeId);
      setSelectedYccdKeys(normalizedLoadedKeys);
      setAllocations(ds.allocations || {});
      setCompetencyOverrides(ds.competencyOverrides || {});
      setPointConfig(ds.pointConfig || { ...DEFAULT_POINT_CONFIG });
      setDraftTitle(ds.title);
      setCollapsedMatrixTopics({});

      // Expand topics of loaded YCCĐs
      const loadedKeySet = new Set(normalizedLoadedKeys);
      const targetItems = yccdCatalog.filter(it => loadedKeySet.has(normalizeId(it.stableKey)));
      const expandMap: Record<string, boolean> = {};
      targetItems.forEach(it => {
        expandMap[normalizeId(it.topicId)] = true;
      });
      if (Object.keys(expandMap).length > 0) setExpandedTopics(expandMap);

      setShowDraftsModal(false);
      showToast('success', `Đã mở lại hồ sơ: "${ds.title}"`);
      return;
    }

    // Fallback for legacy seeded matrix (e.g. mtx-toan8-gk1)
    setDraftId(mtx.id);
    setSubjectName(subjectKeyToDisplayName(mtx.subject));
    setGrade(mtx.grade);
    setPeriod(mtx.period);
    setSchoolYear(mtx.schoolYear || '2025 - 2026');
    setDurationMinutes(mtx.durationMinutes || 45);
    setDraftTitle(mtx.title);
    setShowDraftsModal(false);
    showToast('info', `Đã nạp bộ lọc từ hồ sơ "${mtx.title}". Vui lòng chọn thêm YCCĐ từ cây bên trái.`);
  };

  // Export genuine .docx Word file
  const handleDownloadWord = async () => {
    try {
      setIsExportingDocx(true);
      const draft = buildCurrentDraftState();
      await exportMatrixAndSpecDocx({
        draft,
        tree,
        summary,
        activeFormats,
        teacherName: userProfile?.fullName || 'GV. Diệp Thanh Toàn',
        schoolName: userProfile?.schoolName || 'TRƯỜNG THCS TÂY ĐÔ'
      });
      showToast('success', 'Đã xuất tệp Word (.docx) chuẩn khổ ngang Times New Roman kèm Ma trận & Bản đặc tả!');
    } catch (err: any) {
      showToast('warning', `Lỗi khi tạo tệp DOCX: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Generate AI Exam Blueprint string for Gemini / Clipboard
  const aiBlueprintText = useMemo(() => {
    const draft = buildCurrentDraftState();
    const lines: string[] = [
      `YÊU CẦU TẠO ĐỀ KIỂM TRA CHUẨN GDPT 2018 - TRƯỜNG THCS TÂY ĐÔ`,
      `- Môn học: ${draft.subject} | Khối: Lớp ${draft.grade} | Đợt kiểm tra: ${EXAM_PERIOD_LABELS[draft.period]}`,
      `- Thời lượng: ${draft.durationMinutes} phút | Tổng điểm: ${summary.totalPoints.toFixed(2)} / ${pointConfig.targetTotalScore.toFixed(1)}`,
      `- Quy mô: ${summary.totalOriginalQuestions} câu gốc (${summary.totalSubItems} ý)`,
      `- Tỉ lệ mức độ: Nhận biết ${formatPercentClean(summary.levelPercents.know)} (${summary.levelPointsTotals.know.toFixed(2)}đ) | Thông hiểu ${formatPercentClean(summary.levelPercents.understand)} (${summary.levelPointsTotals.understand.toFixed(2)}đ) | Vận dụng ${formatPercentClean(summary.levelPercents.apply)} (${summary.levelPointsTotals.apply.toFixed(2)}đ)`,
      `- Phân bổ từng phần:`
    ];

    for (const qType of activeFormats) {
      const f = summary.byFormat[qType];
      if (f.totalSubItems > 0) {
        lines.push(
          `  + ${f.label}: ${f.totalOriginalQuestions} câu (${f.totalSubItems} ý) = ${f.totalPoints.toFixed(2)}đ`
        );
      }
    }

    lines.push('', 'CHI TIẾT BẢN ĐẶC TẢ & MÃ CÂU / Ý:');
    for (const sr of summary.specRows) {
      if (sr.allocations.length === 0) continue;
      const allocDesc = sr.allocations
        .map(a => `${a.formatLabel}: ${a.count} [Mã: ${a.codeText}] (${a.isSharedCredit ? 'chung mã' : `${a.points.toFixed(2)}đ`})`)
        .join(' ; ');
      lines.push(
        `${sr.orderIndex}. [${sr.levelLabel}${sr.competencyCode ? ` - ${sr.competencyCode}` : ''}] ${sr.topic} > ${sr.unit}: ${sr.yccdItem.yccd} => ${allocDesc}`
      );
    }

    lines.push(
      '',
      'Hãy biên soạn đề thi đầy đủ đúng từng mã câu/ý, đúng YCCĐ và mức độ trên, kèm đáp án chi tiết và thang điểm.'
    );
    return lines.join('\n');
  }, [
    draftTitle,
    subjectName,
    grade,
    period,
    durationMinutes,
    showShortAnswer,
    selectedYccdKeys,
    allocations,
    competencyOverrides,
    pointConfig,
    summary,
    activeFormats
  ]);

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(aiBlueprintText);
      showToast('success', 'Đã sao chép cấu hình ma trận, danh sách YCCĐ, mã câu/ý và điểm vào bộ nhớ tạm!');
    } catch {
      showToast('warning', 'Không thể truy cập bộ nhớ tạm trình duyệt.');
    }
  };

  const handleOpenGeminiWithBlueprint = () => {
    setPendingMatrixPrompt(aiBlueprintText);
    setShowAiModal(false);
    setCurrentView('teacher_gemini');
  };

  // Helper to build visual matrix rows grouped by Topic -> Unit -> Checked Levels
  const matrixVisualGroups = useMemo(() => {
    const groups: Array<{
      topic: TreeTopicGroup;
      unitRows: Array<{
        unitKey: string;
        unit: string;
        levelRows: Array<{
          level: CognitiveLevel;
          checkedItems: YccdItem[];
        }>;
      }>;
      totalSubRows: number;
    }> = [];

    for (const topic of tree) {
      const unitRows: Array<{
        unitKey: string;
        unit: string;
        levelRows: Array<{
          level: CognitiveLevel;
          checkedItems: YccdItem[];
        }>;
      }> = [];
      let totalSubRows = 0;

      for (const unit of topic.units) {
        const levelRows: Array<{ level: CognitiveLevel; checkedItems: YccdItem[] }> = [];
        for (const lvl of COGNITIVE_LEVELS) {
          const checked = unit.itemsByLevel[lvl].filter(it => selectedSet.has(it.stableKey));
          if (checked.length > 0) {
            levelRows.push({ level: lvl, checkedItems: checked });
          }
        }
        if (levelRows.length > 0) {
          unitRows.push({ unitKey: unit.unitKey, unit: unit.unit, levelRows });
          totalSubRows += levelRows.length;
        }
      }

      if (unitRows.length > 0) {
        groups.push({ topic, unitRows, totalSubRows });
      }
    }

    return groups;
  }, [tree, selectedSet]);

  return (
    <div className="space-y-4 font-serif">
      {/* Top Action & Filter Toolbar (matching attached mockup + specification) */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Line 1: Filters & Quick Toggles */}
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-[140px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              Môn học:
            </label>
            <select
              value={subjectName}
              onChange={e => handleFilterChange(e.target.value, grade, period)}
              className="w-full px-3 py-1.5 text-xs font-bold text-[#082B52] bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
            >
              {subjectOptions.map(s => {
                const sKey = normalizeSubjectToKey(s);
                const countInGrade = yccdCatalog.filter(
                  it =>
                    normalizeSubjectToKey(it.subject) === sKey &&
                    normalizeGrade(it.grade) === normalizeGrade(grade)
                ).length;
                return (
                  <option key={s} value={s}>
                    {s} {countInGrade > 0 ? `(${countInGrade})` : '(Chờ CSV)'}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="min-w-[120px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              Khối lớp:
            </label>
            <select
              value={grade}
              onChange={e => handleFilterChange(subjectName, e.target.value as Grade, period)}
              className="w-full px-3 py-1.5 text-xs font-bold text-[#082B52] bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
            >
              {(['6', '7', '8', '9'] as Grade[]).map(g => {
                const countForGrade = yccdCatalog.filter(
                  it =>
                    normalizeSubjectToKey(it.subject) === currentSubjectKey &&
                    normalizeGrade(it.grade) === g
                ).length;
                return (
                  <option key={g} value={g}>
                    Khối {g} {countForGrade > 0 ? `(${countForGrade})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="min-w-[130px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              Kỳ thi / Đợt kiểm tra:
            </label>
            <select
              value={period}
              onChange={e => handleFilterChange(subjectName, grade, e.target.value as ExamPeriod)}
              className="w-full px-3 py-1.5 text-xs font-bold text-[#082B52] bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
            >
              {(Object.keys(EXAM_PERIOD_LABELS) as ExamPeriod[]).map(p => (
                <option key={p} value={p}>
                  {EXAM_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[105px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              Thời lượng:
            </label>
            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#006BFF]">
              <input
                type="number"
                min={5}
                max={180}
                value={durationMinutes}
                onChange={e => setDurationMinutes(Math.max(5, parseInt(e.target.value, 10) || 45))}
                className="w-14 px-2 py-1.5 text-xs font-bold text-[#082B52] text-center focus:outline-hidden"
              />
              <span className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border-l border-slate-200">
                phút
              </span>
            </div>
          </div>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-[#082B52] cursor-pointer hover:bg-slate-50 select-none">
            <input
              type="checkbox"
              checked={showShortAnswer}
              onChange={e => handleToggleShortAnswer(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#006BFF] cursor-pointer"
            />
            <span>Trả lời ngắn</span>
          </label>

          <button
            type="button"
            onClick={() => setIsCompactMode(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-[#082B52] cursor-pointer"
          >
            {isCompactMode ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            <span>{isCompactMode ? 'Mở rộng' : 'Thu nhỏ'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Hướng dẫn</span>
          </button>
        </div>

        {/* Line 2: Workflow Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCsvModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F8FF] hover:bg-blue-100 text-[#006BFF] border border-[#006BFF]/30 rounded-lg text-xs font-bold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nhập yêu cầu cần đạt</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPointConfig(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                showPointConfig
                  ? 'bg-[#082B52] text-white border-[#082B52]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Cấu hình điểm ({pointConfig.targetTotalScore.toFixed(1)}đ)</span>
            </button>

            <button
              type="button"
              onClick={handleResetAllAutoCodes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              title="Đặt lại toàn bộ mã câu tự động liên tục từ trên xuống"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đánh lại mã tự động</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDraftsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-[#082B52] border border-slate-300 rounded-lg text-xs font-bold cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#006BFF]" />
              <span>Mở bản đã lưu ({matrices.length})</span>
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu bản nháp</span>
            </button>

            <button
              type="button"
              disabled={isExportingDocx}
              onClick={handleDownloadWord}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingDocx ? 'Đang xuất DOCX...' : 'Tải Word (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Point & Scale Config Drawer */}
        {showPointConfig && (
          <div className="p-3.5 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#082B52]">
                Cấu hình thang điểm & đơn giá câu/ý:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPointConfig({
                      ...DEFAULT_POINT_CONFIG,
                      targetTotalScore: 10,
                      singleChoicePerQuestion: 0.25,
                      trueFalsePerSubItem: 0.25,
                      shortAnswerPerQuestion: 0.25,
                      essayPerSubItem: 0.25
                    })
                  }
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md text-[11px] font-bold cursor-pointer"
                >
                  Đặt 0,25đ mỗi câu/ý (như ảnh mẫu)
                </button>
                <button
                  type="button"
                  onClick={() => setPointConfig({ ...DEFAULT_POINT_CONFIG })}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[11px] font-semibold cursor-pointer"
                >
                  Khôi phục mặc định (0.25 / 0.25 / 0.50)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Thang điểm đề</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="100"
                  value={pointConfig.targetTotalScore}
                  onChange={e =>
                    setPointConfig({
                      ...pointConfig,
                      targetTotalScore: Math.max(1, parseFloat(e.target.value) || 10)
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-[#082B52]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-800 mb-1">TNKQ (đ/câu)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="5"
                  value={pointConfig.singleChoicePerQuestion}
                  onChange={e =>
                    setPointConfig({
                      ...pointConfig,
                      singleChoicePerQuestion: Math.max(0.05, parseFloat(e.target.value) || 0.25)
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-blue-300 rounded-lg bg-white font-bold text-blue-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-purple-800 mb-1">Đúng–Sai (đ/ý)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="5"
                  value={pointConfig.trueFalsePerSubItem}
                  onChange={e =>
                    setPointConfig({
                      ...pointConfig,
                      trueFalsePerSubItem: Math.max(0.05, parseFloat(e.target.value) || 0.25)
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg bg-white font-bold text-purple-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-teal-800 mb-1">Trả lời ngắn (đ/câu)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="5"
                  value={pointConfig.shortAnswerPerQuestion}
                  onChange={e =>
                    setPointConfig({
                      ...pointConfig,
                      shortAnswerPerQuestion: Math.max(0.05, parseFloat(e.target.value) || 0.5)
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-teal-300 rounded-lg bg-white font-bold text-teal-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 mb-1">Tự luận (đ/ý)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="5"
                  value={pointConfig.essayPerSubItem}
                  onChange={e =>
                    setPointConfig({
                      ...pointConfig,
                      essayPerSubItem: Math.max(0.05, parseFloat(e.target.value) || 0.5)
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg bg-white font-bold text-emerald-900"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast & Undo Notification */}
      {toastMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : toastMsg.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {undoSelectionSnapshot && (
        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="text-amber-900 font-semibold">
            Đã tạm ẩn <b>{undoSelectionSnapshot.label}</b> khỏi bảng (số lượng & mã câu vẫn được giữ an toàn).
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndoSelection}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Khôi phục phần đã nhập</span>
            </button>
            <button
              type="button"
              onClick={() => setUndoSelectionSnapshot(null)}
              className="text-amber-800 hover:underline font-semibold cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Summary Metrics Cards (hidden when Thu nhỏ is active) */}
      {!isCompactMode && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Mức nhận biết</div>
            <div className="text-xl font-bold text-[#006BFF] mt-0.5">
              {summary.levelPointsTotals.know.toFixed(2)} điểm
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Chiếm <b>{formatPercentClean(summary.levelPercents.know)}</b> tổng điểm ({summary.levelSubItemTotals.know}{' '}
              câu/ý)
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Mức thông hiểu</div>
            <div className="text-xl font-bold text-amber-600 mt-0.5">
              {summary.levelPointsTotals.understand.toFixed(2)} điểm
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Chiếm <b>{formatPercentClean(summary.levelPercents.understand)}</b> tổng điểm (
              {summary.levelSubItemTotals.understand} câu/ý)
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Mức vận dụng</div>
            <div className="text-xl font-bold text-emerald-600 mt-0.5">
              {summary.levelPointsTotals.apply.toFixed(2)} điểm
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Chiếm <b>{formatPercentClean(summary.levelPercents.apply)}</b> tổng điểm ({summary.levelSubItemTotals.apply}{' '}
              câu/ý)
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Tổng điểm & Quy mô đề</div>
            <div className="text-xl font-bold text-[#082B52] mt-0.5">
              {summary.totalPoints.toFixed(2)} / {pointConfig.targetTotalScore.toFixed(1)}đ
            </div>
            <div className="text-[11px] mt-0.5">
              {summary.totalPoints === 0 ? (
                <span className="text-slate-500 font-semibold">Chưa phân bổ câu hỏi</span>
              ) : summary.isMatchingTargetScore ? (
                <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Đạt chuẩn thang điểm ({summary.totalOriginalQuestions} câu gốc, {summary.totalSubItems} ý)
                  </span>
                </span>
              ) : (
                <span className="text-amber-700 font-bold inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Lệch {summary.scoreDiffFromTarget > 0 ? '+' : ''}
                    {summary.scoreDiffFromTarget.toFixed(2)}đ • {summary.totalOriginalQuestions} câu / {summary.totalSubItems}{' '}
                    ý
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Split Workspace: Collapsible YCCĐ Tree (Left) + Tabs & Tables (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {isSidebarOpen && (
          <div className="lg:col-span-4 xl:col-span-3">
            <YccdTreeSidebar
              subject={subjectName}
              grade={grade}
              tree={tree}
              selectedKeys={selectedSet}
              expandedTopics={expandedTopics}
              expandedUnits={expandedUnits}
              onToggleTopicExpand={topicId =>
                setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }))
              }
              onToggleUnitExpand={unitKey =>
                setExpandedUnits(prev => ({ ...prev, [unitKey]: !(prev[unitKey] ?? true) }))
              }
              onToggleYccd={handleToggleYccd}
              onToggleUnit={handleToggleUnit}
              onToggleTopic={handleToggleTopic}
              onSelectAll={handleSelectAllFiltered}
              onClearAll={handleClearAllFiltered}
              onCollapseSidebar={() => setIsSidebarOpen(false)}
              onOpenCsvImport={() => setShowCsvModal(true)}
            />
          </div>
        )}

        {/* Right Panel */}
        <div className={isSidebarOpen ? 'lg:col-span-8 xl:col-span-9 space-y-3' : 'lg:col-span-12 space-y-3'}>
          {/* Rule Reminder Bar + Collapsed Sidebar Opener */}
          <div className="flex flex-wrap items-center gap-2">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="px-3 py-2 bg-[#0D2B52] hover:bg-[#154380] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              >
                <PanelLeftOpen className="w-4 h-4" />
                <span>Mở cây YCCĐ ({selectedYccdKeys.length})</span>
              </button>
            )}

            <div className="flex-1 min-w-[260px] px-3.5 py-2 bg-[#FFFBEB] border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
              <span>
                <b>Quy ước:</b> Hàng trên nhập <b>số lượng (ý/câu)</b>, Đúng–Sai hiện tại ={' '}
                <b>{pointConfig.trueFalsePerSubItem.toFixed(2)}đ/ý</b> (4 ý ={' '}
                {(pointConfig.trueFalsePerSubItem * 4).toFixed(2)}đ). Hàng dưới <b>tự động sinh mã câu</b> liên tục từ
                trên xuống, thầy cô có thể sửa lại khi chia mức độ (VD: <i>14a,b</i>, <i>2a</i>).
              </span>
            </div>
          </div>

          {/* Existing Two Tabs */}
          <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-xs overflow-hidden">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-3 bg-slate-50/60">
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setActiveTab('matrix')}
                  className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer ${
                    activeTab === 'matrix'
                      ? 'border-[#006BFF] text-[#006BFF] bg-white'
                      : 'border-transparent text-slate-600 hover:text-[#082B52]'
                  }`}
                >
                  1. Bảng Ma trận đề kiểm tra
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('specification')}
                  className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer ${
                    activeTab === 'specification'
                      ? 'border-[#006BFF] text-[#006BFF] bg-white'
                      : 'border-transparent text-slate-600 hover:text-[#082B52]'
                  }`}
                >
                  2. Bản đặc tả ma trận đề (YCCĐ & Năng lực)
                </button>
              </div>

              <div className="text-[11px] font-semibold text-slate-500 py-2 px-2">
                {subjectName} • Khối {grade} • {EXAM_PERIOD_LABELS[period]} • {durationMinutes} phút
              </div>
            </div>

            {/* TAB 1: MATRIX TABLE */}
            {activeTab === 'matrix' && (
              <div className="overflow-x-auto overflow-y-auto max-h-[68vh]">
                {matrixVisualGroups.length === 0 ? (
                  <div className="p-10 text-center space-y-2 text-slate-500">
                    <LayoutGrid className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-[#082B52]">Chưa có Yêu cầu cần đạt nào được chọn</p>
                    <p className="text-xs max-w-md mx-auto">
                      Hãy tích chọn Chương / Chủ đề, Đơn vị kiến thức hoặc Yêu cầu cần đạt ở cây bên trái để bắt đầu lập
                      ma trận đề kiểm tra.
                    </p>
                  </div>
                ) : (
                  <table className="w-full min-w-[980px] border-collapse text-xs">
                    <thead className="sticky top-0 z-10 shadow-2xs">
                      <tr className="bg-[#1C3B70] text-white text-center font-bold">
                        <th rowSpan={3} className="border border-slate-300/60 px-2.5 py-2 w-36">
                          Chương / Chủ đề
                        </th>
                        <th rowSpan={3} className="border border-slate-300/60 px-2.5 py-2 w-40">
                          Nội dung / đơn vị kiến thức
                        </th>
                        <th rowSpan={3} className="border border-slate-300/60 px-3 py-2 min-w-[270px]">
                          Yêu cầu cần đạt
                        </th>
                        <th
                          colSpan={activeFormats.length * 3}
                          className="border border-slate-300/60 px-2 py-1.5 bg-[#152E5B]"
                        >
                          Số câu hỏi ở các mức độ đánh giá
                        </th>
                        <th colSpan={3} rowSpan={2} className="border border-slate-300/60 px-2 py-1.5 bg-[#1C3B70]">
                          Tổng
                        </th>
                        <th rowSpan={3} className="border border-slate-300/60 px-2 py-2 w-16 bg-[#1C3B70]">
                          Điểm bài
                        </th>
                      </tr>
                      <tr className="text-white text-center font-bold">
                        {activeFormats.map(qType => (
                          <th
                            key={qType}
                            colSpan={3}
                            className={`border border-slate-300/60 px-2 py-1.5 ${
                              qType === 'single_choice'
                                ? 'bg-[#1769C2]'
                                : qType === 'true_false_group'
                                ? 'bg-[#9333EA]'
                                : qType === 'short_answer'
                                ? 'bg-[#0D9488]'
                                : 'bg-[#15803D]'
                            }`}
                          >
                            {qType === 'single_choice'
                              ? 'TNKQ (Nhiều lựa chọn)'
                              : qType === 'true_false_group'
                              ? 'Đúng - Sai (ý)'
                              : qType === 'short_answer'
                              ? 'Trả lời ngắn'
                              : 'Tự luận (ý)'}
                          </th>
                        ))}
                      </tr>
                      <tr className="text-white text-center text-[11px] font-bold">
                        {activeFormats.flatMap(qType =>
                          COGNITIVE_LEVELS.map(lvl => (
                            <th
                              key={`${qType}-${lvl}`}
                              className={`border border-slate-300/60 px-1.5 py-1 min-w-[62px] ${
                                qType === 'single_choice'
                                  ? 'bg-[#2B7DE0]'
                                  : qType === 'true_false_group'
                                  ? 'bg-[#A855F7]'
                                  : qType === 'short_answer'
                                  ? 'bg-[#14B8A6]'
                                  : 'bg-[#16A34A]'
                              }`}
                            >
                              {lvl === 'know' ? 'Biết' : lvl === 'understand' ? 'Hiểu' : 'VD'}
                            </th>
                          ))
                        )}
                        <th className="border border-slate-300/60 px-1.5 py-1 w-12 bg-[#1E3A8A]">Biết</th>
                        <th className="border border-slate-300/60 px-1.5 py-1 w-12 bg-[#1E3A8A]">Hiểu</th>
                        <th className="border border-slate-300/60 px-1.5 py-1 w-12 bg-[#1E3A8A]">VD</th>
                      </tr>
                    </thead>

                    <tbody className="bg-white">
                      {matrixVisualGroups.map(group => {
                        const isTopicCollapsed = collapsedMatrixTopics[group.topic.topicId] ?? false;

                        if (isTopicCollapsed) {
                          return (
                            <tr key={group.topic.topicId} className="bg-blue-50/50">
                              <td
                                colSpan={3 + activeFormats.length * 3 + 4}
                                className="border border-slate-200 px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="font-bold text-[#006BFF]">{group.topic.topic}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCollapsedMatrixTopics(p => ({ ...p, [group.topic.topicId]: false }))
                                    }
                                    className="px-2.5 py-0.5 bg-white hover:bg-blue-50 border border-slate-300 rounded text-[11px] font-bold text-[#082B52] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                    <span>Mở rộng ({group.unitRows.length} nội dung)</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        let topicRendered = false;

                        return (
                          <React.Fragment key={group.topic.topicId}>
                            {group.unitRows.map(uRow => {
                              let unitRendered = false;

                              return uRow.levelRows.map(lRow => {
                            const showTopicCell = !topicRendered;
                            topicRendered = true;
                            const showUnitCell = !unitRendered;
                            unitRendered = true;

                            const unitLevelKey = `${uRow.unitKey}::${lRow.level}`;
                            const compValue =
                              competencyOverrides[unitLevelKey] ??
                              lRow.checkedItems[0]?.competencyCode ??
                              (currentSubjectKey === 'informatics' ? 'NLa' : '');

                            // Count totals & points on this specific (unit, level) row
                            let rowSubTotalForLevel = 0;
                            let rowPoints = 0;
                            for (const qType of activeFormats) {
                              const c = allocations[buildAllocationKey(uRow.unitKey, lRow.level, qType)];
                              if (c && Number.isInteger(c.count) && c.count > 0) {
                                rowSubTotalForLevel += c.count;
                                const unitPts =
                                  qType === 'single_choice'
                                    ? pointConfig.singleChoicePerQuestion
                                    : qType === 'true_false_group'
                                    ? pointConfig.trueFalsePerSubItem
                                    : qType === 'short_answer'
                                    ? pointConfig.shortAnswerPerQuestion
                                    : pointConfig.essayPerSubItem;
                                rowPoints += c.count * unitPts;
                              }
                            }

                            const activeRowCells = activeFormats
                              .map(qType => allocations[buildAllocationKey(uRow.unitKey, lRow.level, qType)])
                              .filter((c): c is MatrixAllocationCell => Boolean(c && c.count > 0));

                            const checkedSiblingKeys = lRow.checkedItems.map(it => it.stableKey);

                            return (
                              <tr key={`${uRow.unitKey}-${lRow.level}`} className="hover:bg-slate-50/70">
                                {showTopicCell && (
                                  <td
                                    rowSpan={group.totalSubRows}
                                    className="border border-slate-200 px-2.5 py-3 align-top bg-slate-50/40"
                                  >
                                    <div className="font-bold text-[#006BFF] text-xs leading-snug">
                                      {group.topic.topic}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCollapsedMatrixTopics(p => ({ ...p, [group.topic.topicId]: true }))
                                      }
                                      className="mt-2 px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                      <span>Thu gọn</span>
                                    </button>
                                  </td>
                                )}

                                {showUnitCell && (
                                  <td
                                    rowSpan={uRow.levelRows.length}
                                    className="border border-slate-200 px-2.5 py-3 align-top font-semibold text-[#082B52] text-xs leading-snug"
                                  >
                                    {uRow.unit}
                                  </td>
                                )}

                                {/* YCCĐ & Competency cell */}
                                <td className="border border-slate-200 px-2.5 py-2 align-top">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                        LEVEL_TAG_STYLES[lRow.level]
                                      }`}
                                    >
                                      [{COGNITIVE_LABELS[lRow.level]}]
                                    </span>

                                    {editingCompKey === unitLevelKey ? (
                                      <input
                                        type="text"
                                        autoFocus
                                        value={compValue}
                                        onChange={e =>
                                          setCompetencyOverrides(prev => ({
                                            ...prev,
                                            [unitLevelKey]: e.target.value
                                          }))
                                        }
                                        onBlur={() => setEditingCompKey(null)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') setEditingCompKey(null);
                                        }}
                                        placeholder="NLa"
                                        className="w-16 px-1.5 py-0.5 text-[11px] font-bold border border-[#006BFF] rounded bg-white text-[#082B52]"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setEditingCompKey(unitLevelKey)}
                                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 border border-slate-200 text-[11px] font-bold text-[#082B52] cursor-pointer"
                                        title="Nhấp để sửa mã năng lực (VD: NLa, NLb)"
                                      >
                                        {compValue || '+ Năng lực'}
                                      </button>
                                    )}

                                    {lRow.checkedItems.length > 1 && activeRowCells.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingLinkRowKey(prev =>
                                            prev === unitLevelKey ? null : unitLevelKey
                                          )
                                        }
                                        className="ml-auto px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold text-[#006BFF] inline-flex items-center gap-1 cursor-pointer"
                                        title="Chọn YCCĐ cụ thể mà từng câu/ý đánh giá trong Bản đặc tả"
                                      >
                                        <Link2 className="w-3 h-3" />
                                        <span>Gắn YCCĐ</span>
                                      </button>
                                    )}
                                  </div>

                                  <ul className="space-y-1 text-[11px] text-slate-700 leading-relaxed">
                                    {lRow.checkedItems.map(it => (
                                      <li key={it.stableKey} className="flex items-start gap-1">
                                        <span className="text-slate-400 select-none">-</span>
                                        <span className="whitespace-pre-line">{it.yccd}</span>
                                      </li>
                                    ))}
                                  </ul>

                                  {/* Popover-like inline YCCĐ mapper when multiple YCCĐ share a level */}
                                  {editingLinkRowKey === unitLevelKey && activeRowCells.length > 0 && (
                                    <div className="mt-2 p-2.5 bg-blue-50/90 border border-blue-200 rounded-lg space-y-2 text-[11px]">
                                      <div className="flex items-center justify-between font-bold text-[#082B52]">
                                        <span>Chọn YCCĐ cho từng phân bổ (không cộng trùng điểm):</span>
                                        <button
                                          type="button"
                                          onClick={() => setEditingLinkRowKey(null)}
                                          className="text-slate-500 hover:text-slate-800 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      {activeRowCells.map(ac => {
                                        const aKey = buildAllocationKey(uRow.unitKey, lRow.level, ac.questionType);
                                        const currentLinked = (ac.linkedYccdKeys || []).filter(k =>
                                          checkedSiblingKeys.includes(k)
                                        );
                                        const resolvedLinked =
                                          currentLinked.length > 0 ? currentLinked : checkedSiblingKeys.slice(0, 1);

                                        return (
                                          <div key={aKey} className="bg-white p-2 rounded border border-blue-100 space-y-1">
                                            <div className="font-bold text-[#006BFF]">
                                              {QUESTION_FORMAT_LABELS[ac.questionType]} ({ac.count} | Mã:{' '}
                                              {ac.codeText || '-'})
                                            </div>
                                            {lRow.checkedItems.map(item => (
                                              <label
                                                key={item.stableKey}
                                                className="flex items-start gap-1.5 cursor-pointer text-slate-700"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={resolvedLinked.includes(item.stableKey)}
                                                  onChange={() =>
                                                    handleToggleLinkedYccd(aKey, item.stableKey, checkedSiblingKeys)
                                                  }
                                                  className="mt-0.5 accent-[#006BFF]"
                                                />
                                                <span className="line-clamp-2">{item.yccd}</span>
                                              </label>
                                            ))}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>

                                {/* Matrix Allocation Cells (Format x Level) */}
                                {activeFormats.flatMap(qType =>
                                  COGNITIVE_LEVELS.map(colLevel => {
                                    const isRowLevel = colLevel === lRow.level;
                                    const bgTint =
                                      qType === 'single_choice'
                                        ? 'bg-sky-50/40'
                                        : qType === 'true_false_group'
                                        ? 'bg-purple-50/40'
                                        : qType === 'short_answer'
                                        ? 'bg-teal-50/40'
                                        : 'bg-emerald-50/40';

                                    if (!isRowLevel) {
                                      return (
                                        <td
                                          key={`${qType}-${colLevel}`}
                                          className={`border border-slate-200 px-1 py-2 text-center text-slate-400 ${bgTint}`}
                                        >
                                          -
                                        </td>
                                      );
                                    }

                                    const allocKey = buildAllocationKey(uRow.unitKey, lRow.level, qType);
                                    const cell = allocations[allocKey];
                                    const issue = summary.validationIssues[allocKey];
                                    const defaultLinked = lRow.checkedItems[0]?.stableKey || '';

                                    const borderAccent = issue
                                      ? issue.severity === 'error'
                                        ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/50'
                                        : 'border-amber-500 bg-amber-50/40'
                                      : qType === 'single_choice'
                                      ? 'border-sky-400 focus:ring-sky-300'
                                      : qType === 'true_false_group'
                                      ? 'border-purple-400 focus:ring-purple-300'
                                      : qType === 'short_answer'
                                      ? 'border-teal-400 focus:ring-teal-300'
                                      : 'border-emerald-400 focus:ring-emerald-300';

                                    return (
                                      <td
                                        key={`${qType}-${colLevel}`}
                                        className={`border border-slate-200 px-1.5 py-1.5 align-middle text-center ${bgTint}`}
                                      >
                                        <div className="flex flex-col items-center gap-1">
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            value={cell?.rawCountText ?? ''}
                                            onChange={e =>
                                              handleCountChange(
                                                uRow.unitKey,
                                                lRow.level,
                                                qType,
                                                e.target.value,
                                                defaultLinked
                                              )
                                            }
                                            aria-label={`Số lượng ${QUESTION_FORMAT_LABELS[qType]} - ${COGNITIVE_LABELS[colLevel]}`}
                                            className={`w-12 h-7 text-center text-xs font-bold rounded-md bg-white border focus:outline-hidden focus:ring-2 ${borderAccent}`}
                                          />
                                          <div className="relative flex items-center justify-center w-full">
                                            <input
                                              type="text"
                                              value={cell?.codeText ?? ''}
                                              onChange={e =>
                                                handleCodeChange(
                                                  uRow.unitKey,
                                                  lRow.level,
                                                  qType,
                                                  e.target.value,
                                                  defaultLinked
                                                )
                                              }
                                              placeholder=""
                                              aria-label={`Mã câu/ý ${QUESTION_FORMAT_LABELS[qType]} - ${COGNITIVE_LABELS[colLevel]}`}
                                              className={`w-14 h-6 px-1 text-center text-[10px] font-semibold rounded bg-white/90 border border-dashed text-slate-700 focus:outline-hidden focus:ring-1 ${
                                                issue
                                                  ? 'border-rose-500 text-rose-800'
                                                  : 'border-slate-300 focus:border-[#006BFF]'
                                              }`}
                                            />
                                            {cell?.isManualCode && (
                                              <button
                                                type="button"
                                                onClick={() => handleResetCellAutoCode(allocKey)}
                                                title="Khôi phục mã tự động cho ô này"
                                                className="ml-0.5 text-slate-400 hover:text-[#006BFF] cursor-pointer"
                                              >
                                                <RotateCcw className="w-2.5 h-2.5" />
                                              </button>
                                            )}
                                          </div>
                                          {issue && (
                                            <div
                                              className={`text-[9px] leading-tight font-bold max-w-[76px] ${
                                                issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'
                                              }`}
                                            >
                                              {issue.message}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })
                                )}

                                {/* Row Totals (Biết / Hiểu / VD + Điểm bài) */}
                                {COGNITIVE_LEVELS.map(lvl => {
                                  const val = lvl === lRow.level ? rowSubTotalForLevel : 0;
                                  return (
                                    <td
                                      key={`row-sum-${lvl}`}
                                      className="border border-slate-200 px-1.5 py-2 text-center font-bold text-[#082B52]"
                                    >
                                      {val > 0 ? val : '-'}
                                    </td>
                                  );
                                })}

                                <td className="border border-slate-200 px-2 py-2 text-center font-bold text-[#082B52]">
                                  {rowPoints > 0 ? rowPoints.toFixed(2) : '-'}
                                </td>
                              </tr>
                            );
                          });
                        })}
                          </React.Fragment>
                        );
                      })}

                      {/* Footer Row 1: Tổng số câu / ý */}
                      <tr className="bg-slate-50 font-bold text-[#082B52] text-center border-t-2 border-slate-300">
                        <td colSpan={3} className="border border-slate-200 px-3 py-2 text-center uppercase text-[11px]">
                          TỔNG SỐ CÂU / Ý
                        </td>
                        {activeFormats.flatMap(qType =>
                          COGNITIVE_LEVELS.map(lvl => (
                            <td key={`tot-c-${qType}-${lvl}`} className="border border-slate-200 px-1.5 py-2">
                              {summary.byFormat[qType].countsByLevel[lvl]}
                            </td>
                          ))
                        )}
                        {COGNITIVE_LEVELS.map(lvl => (
                          <td key={`tot-lvl-${lvl}`} className="border border-slate-200 px-1.5 py-2">
                            {summary.levelSubItemTotals[lvl]}
                          </td>
                        ))}
                        <td className="border border-slate-200 px-2 py-2 text-[11px]">
                          {summary.totalOriginalQuestions} câu / {summary.totalSubItems} ý
                        </td>
                      </tr>

                      {/* Footer Row 2: Tổng điểm */}
                      <tr className="bg-[#F3F8FF] font-bold text-center text-[#082B52]">
                        <td colSpan={3} className="border border-slate-200 px-3 py-2 text-center uppercase text-[11px]">
                          TỔNG ĐIỂM (Thang {pointConfig.targetTotalScore.toFixed(1)})
                        </td>
                        {activeFormats.map(qType => {
                          const fStat = summary.byFormat[qType];
                          return (
                            <td
                              key={`tot-pts-${qType}`}
                              colSpan={3}
                              className={`border border-slate-200 px-2 py-2 ${
                                qType === 'single_choice'
                                  ? 'text-[#006BFF]'
                                  : qType === 'true_false_group'
                                  ? 'text-purple-700'
                                  : qType === 'short_answer'
                                  ? 'text-teal-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              <div>{fStat.totalPoints.toFixed(2)}đ</div>
                              <div className="text-[10px] font-semibold text-slate-600">
                                {fStat.totalOriginalQuestions} câu gốc • {fStat.totalSubItems} ý
                              </div>
                            </td>
                          );
                        })}
                        <td className="border border-slate-200 px-1.5 py-2 text-[#006BFF]">
                          {summary.levelPointsTotals.know.toFixed(2)}
                        </td>
                        <td className="border border-slate-200 px-1.5 py-2 text-amber-700">
                          {summary.levelPointsTotals.understand.toFixed(2)}
                        </td>
                        <td className="border border-slate-200 px-1.5 py-2 text-emerald-700">
                          {summary.levelPointsTotals.apply.toFixed(2)}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-sm text-[#082B52]">
                          {summary.totalPoints.toFixed(2)}
                        </td>
                      </tr>

                      {/* Footer Row 3: Tỉ lệ % thực tế */}
                      <tr className="bg-white font-bold text-center text-slate-700 text-[11px]">
                        <td colSpan={3} className="border border-slate-200 px-3 py-1.5 uppercase">
                          TỈ LỆ % THỰC TẾ TRÊN TỔNG ĐIỂM ({summary.totalPoints.toFixed(2)}đ)
                        </td>
                        {activeFormats.map(qType => (
                          <td key={`pct-${qType}`} colSpan={3} className="border border-slate-200 px-2 py-1.5">
                            {formatPercentClean(summary.byFormat[qType].percentOfActualTotal)}
                          </td>
                        ))}
                        <td className="border border-slate-200 px-1.5 py-1.5 text-[#006BFF]">
                          {formatPercentClean(summary.levelPercents.know)}
                        </td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-amber-700">
                          {formatPercentClean(summary.levelPercents.understand)}
                        </td>
                        <td className="border border-slate-200 px-1.5 py-1.5 text-emerald-700">
                          {formatPercentClean(summary.levelPercents.apply)}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5">
                          {summary.totalPoints > 0 ? '100%' : '0%'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB 2: SPECIFICATION TABLE (Shared single source of truth) */}
            {activeTab === 'specification' && (
              <div className="overflow-x-auto overflow-y-auto max-h-[68vh]">
                {summary.specRows.length === 0 ? (
                  <div className="p-10 text-center space-y-2 text-slate-500">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-[#082B52]">Chưa có Yêu cầu cần đạt để lập Bản đặc tả</p>
                    <p className="text-xs">Hãy chọn các Yêu cầu cần đạt ở cây bên trái và phân bổ số câu/ý trong Ma trận.</p>
                  </div>
                ) : (
                  <table className="w-full min-w-[900px] border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-[#1C3B70] text-white text-center font-bold">
                      <tr>
                        <th className="border border-slate-300/60 px-2 py-2.5 w-10">TT</th>
                        <th className="border border-slate-300/60 px-3 py-2.5 w-44">Chương / Chủ đề</th>
                        <th className="border border-slate-300/60 px-3 py-2.5 w-44">Nội dung / Đơn vị kiến thức</th>
                        <th className="border border-slate-300/60 px-3 py-2.5">Yêu cầu cần đạt chuẩn GDPT 2018</th>
                        <th className="border border-slate-300/60 px-2 py-2.5 w-16">Năng lực</th>
                        <th className="border border-slate-300/60 px-2 py-2.5 w-24">Mức độ</th>
                        <th className="border border-slate-300/60 px-3 py-2.5 w-44">Hình thức & Số câu / ý</th>
                        <th className="border border-slate-300/60 px-2 py-2.5 w-24">Mã câu / ý</th>
                        <th className="border border-slate-300/60 px-2 py-2.5 w-16">Điểm</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {summary.specRows.map(sr => (
                        <tr key={`${sr.yccdItem.stableKey}-${sr.orderIndex}`} className="hover:bg-slate-50">
                          <td className="border border-slate-200 px-2 py-2.5 text-center font-bold text-slate-500">
                            {sr.orderIndex}
                          </td>
                          <td className="border border-slate-200 px-3 py-2.5 font-bold text-[#082B52]">
                            {sr.topic}
                          </td>
                          <td className="border border-slate-200 px-3 py-2.5 text-slate-800 font-medium">
                            {sr.unit}
                          </td>
                          <td className="border border-slate-200 px-3 py-2.5 text-slate-700 leading-relaxed">
                            <span className="font-bold text-[#006BFF] mr-1">{sr.yccdItem.sourceLabel}</span>
                            <span className="whitespace-pre-line">{sr.yccdItem.yccd}</span>
                          </td>
                          <td className="border border-slate-200 px-2 py-2.5 text-center font-bold text-[#082B52]">
                            {sr.competencyCode || '-'}
                          </td>
                          <td className="border border-slate-200 px-2 py-2.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                                LEVEL_TAG_STYLES[sr.level]
                              }`}
                            >
                              {sr.levelLabel}
                            </span>
                          </td>
                          <td className="border border-slate-200 px-3 py-2.5">
                            {sr.allocations.length === 0 ? (
                              <span className="text-slate-400 italic">Chưa phân bổ</span>
                            ) : (
                              <div className="space-y-1">
                                {sr.allocations.map(al => {
                                  const unitLbl =
                                    al.questionType === 'true_false_group' || al.questionType === 'essay' ? 'ý' : 'câu';
                                  return (
                                    <div key={al.allocKey} className="text-[11px]">
                                      <b className="text-[#082B52]">{al.formatLabel}:</b> {al.count} {unitLbl}
                                      {al.isSharedCredit && (
                                        <span className="ml-1 text-[10px] italic text-slate-500">
                                          (gắn chung — không cộng trùng)
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-2.5 text-center font-bold text-[#006BFF]">
                            {sr.allocations.length > 0
                              ? sr.allocations.map(a => a.codeText).filter(Boolean).join('; ')
                              : '-'}
                          </td>
                          <td className="border border-slate-200 px-2 py-2.5 text-center font-bold text-[#082B52]">
                            {sr.rowTotalPoints > 0 ? sr.rowTotalPoints.toFixed(2) : '-'}
                          </td>
                        </tr>
                      ))}

                      <tr className="bg-[#F3F8FF] font-bold text-[#082B52] border-t-2 border-slate-300">
                        <td colSpan={6} className="border border-slate-200 px-3 py-2.5 text-center uppercase text-[11px]">
                          TỔNG CỘNG BẢN ĐẶC TẢ (KHỚP 100% VỚI MA TRẬN)
                        </td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center">
                          {summary.totalOriginalQuestions} câu gốc ({summary.totalSubItems} ý)
                        </td>
                        <td className="border border-slate-200 px-2 py-2.5 text-center text-[11px]">
                          NB {formatPercentClean(summary.levelPercents.know)} • TH{' '}
                          {formatPercentClean(summary.levelPercents.understand)} • VD{' '}
                          {formatPercentClean(summary.levelPercents.apply)}
                        </td>
                        <td className="border border-slate-200 px-2 py-2.5 text-center text-sm text-[#006BFF]">
                          {summary.totalPoints.toFixed(2)}đ
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Bank Readiness Panel (Dynamic real check against AppContext.questions) */}
          {!isCompactMode && bankReadiness.length > 0 && (
            <div className="bg-blue-50/70 rounded-2xl border border-blue-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowBankPanel(v => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-[#082B52] uppercase cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-[#006BFF]" />
                  <span>Kiểm tra độ sẵn sàng của Ngân hàng câu hỏi theo Ma trận</span>
                  {showBankPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[11px] font-semibold text-slate-600">
                  Môn {subjectName} • Khối {grade}
                </span>
              </div>

              {showBankPanel && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {bankReadiness.map(br => (
                    <div
                      key={br.unitKey}
                      className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#082B52] truncate">{br.unit}</div>
                        <div className="text-[10px] text-slate-500 truncate">{br.topic}</div>
                        {br.status === 'lacking' && br.missingBreakdown.length > 0 && (
                          <div className="text-[10px] text-amber-800 mt-1 leading-snug">
                            Thiếu: {br.missingBreakdown.join('; ')}
                          </div>
                        )}
                      </div>

                      {br.status === 'sufficient' ? (
                        <span className="shrink-0 text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đủ ({br.availableCount}/{br.requiredCount})</span>
                        </span>
                      ) : br.status === 'lacking' ? (
                        <span className="shrink-0 text-amber-700 font-bold text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Thiếu ({br.availableCount}/{br.requiredCount})</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-slate-400 font-semibold text-[11px]">
                          Chưa phân bổ
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Action Row matching mockup */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="text-xs font-bold text-[#006BFF] hover:underline px-2 py-1.5 cursor-pointer"
              >
                ← Trang chủ
              </button>

              <button
                type="button"
                disabled={isExportingDocx}
                onClick={handleDownloadWord}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Tải Ma trận & Đặc tả (Word)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tạo đề thi bằng AI</span>
              </button>

              <button
                type="button"
                onClick={handleCopyConfig}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-[#082B52] border border-slate-300 rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#006BFF]" />
                <span>Sao chép cấu hình tạo đề</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: CSV Import */}
      <YccdCsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        existingCatalog={yccdCatalog}
        onConfirmImport={items => {
          const stats = importYccdItems(items);
          const importedSubjects = Array.from(new Set(items.map(it => it.subject)));
          showToast(
            'success',
            `Đã nhập danh mục YCCĐ (${importedSubjects.join(', ')}): +${stats.inserted} mới, ${stats.updated} cập nhật, ${stats.unchanged} giữ nguyên.`
          );
          return stats;
        }}
      />

      {/* Modal: Saved Drafts Manager */}
      {showDraftsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-[#082B52] flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[#006BFF]" />
                <span>Danh sách bản nháp & Ma trận đã lưu ({matrices.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDraftsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {matrices.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Chưa có hồ sơ ma trận nào được lưu.</p>
            ) : (
              <div className="space-y-2.5">
                {matrices.map(m => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-bold text-[#082B52] truncate">{m.title}</div>
                      <div className="text-[11px] text-slate-600 flex flex-wrap gap-2">
                        <span>Môn: <b>{m.draftState?.subject || subjectKeyToDisplayName(m.subject)}</b></span>
                        <span>• Khối <b>{m.grade}</b></span>
                        <span>• {EXAM_PERIOD_LABELS[m.period]}</span>
                        <span>• {m.durationMinutes} phút</span>
                        <span>• <b>{m.totalPoints.toFixed(2)}đ</b></span>
                        {m.draftState && (
                          <span className="text-emerald-700 font-bold">
                            • {m.draftState.selectedYccdKeys.length} YCCĐ
                          </span>
                        )}
                      </div>
                      {m.updatedAt && (
                        <div className="text-[10px] text-slate-400">
                          Cập nhật: {new Date(m.updatedAt).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadDraft(m)}
                        className="px-3.5 py-1.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Mở bản này
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMatrixDraft(m.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                        title="Xóa bản lưu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: AI Exam Blueprint & Creation Integration */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-[#082B52] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#006BFF]" />
                <span>Tạo đề thi từ Ma trận & Bản đặc tả</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-[#082B52] space-y-1">
              <div>
                <b>Hồ sơ hiện hành:</b> {subjectName} • Khối {grade} • {EXAM_PERIOD_LABELS[period]} ({durationMinutes}{' '}
                phút)
              </div>
              <div>
                <b>Tổng hợp:</b> {summary.totalOriginalQuestions} câu gốc ({summary.totalSubItems} ý) •{' '}
                {summary.totalPoints.toFixed(2)} điểm • Biết {formatPercentClean(summary.levelPercents.know)} – Hiểu{' '}
                {formatPercentClean(summary.levelPercents.understand)} – Vận dụng{' '}
                {formatPercentClean(summary.levelPercents.apply)}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Cấu hình chi tiết (YCCĐ, phân bổ số câu/ý, mã câu/ý và điểm):
              </label>
              <textarea
                rows={10}
                readOnly
                value={aiBlueprintText}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCopyConfig}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-[#082B52] rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#006BFF]" />
                <span>Sao chép cấu hình tạo đề</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAiModal(false);
                    setCurrentView('teacher_create_exam');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Chuyển sang Tạo đề & Giao bài
                </button>
                <button
                  type="button"
                  onClick={handleOpenGeminiWithBlueprint}
                  className="px-4 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Mở Trợ lý Gemini với ma trận này</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Guide / Hướng dẫn */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-[#082B52] flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-[#006BFF]" />
                <span>Hướng dẫn lập Ma trận & Bản đặc tả</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-700 leading-relaxed list-decimal pl-4">
              <li>
                <b>Chọn phạm vi YCCĐ:</b> Lọc theo Môn học, Khối 6–9 và Đợt kiểm tra; tích chọn Chương/Chủ đề, Đơn vị
                kiến thức hoặc từng Yêu cầu cần đạt ở cây bên trái. Nếu môn học chưa có dữ liệu, bấm{' '}
                <b>Nhập yêu cầu cần đạt</b> để tải tệp CSV (11 cột).
              </li>
              <li>
                <b>Nhập số lượng & mã câu/ý:</b> Hàng trên của mỗi ô là <b>số câu</b> (với TNKQ, Trả lời ngắn) hoặc{' '}
                <b>số ý</b> (với Đúng–Sai, Tự luận). Hàng dưới tự động đánh mã câu liên tục từ trên xuống.
              </li>
              <li>
                <b>Chia ý một câu qua nhiều mức độ:</b> Giáo viên có thể sửa tay mã ở hàng dưới (ví dụ nhập{' '}
                <code>14a, 14b</code> ở Nhận biết và <code>14c, 14d</code> ở Thông hiểu). Hệ thống tự nhận diện chung câu
                gốc <b>14</b> (tính <b>1 câu gốc, 4 ý</b>) và báo trùng mã nếu nhập đè.
              </li>
              <li>
                <b>Gắn YCCĐ trong Bản đặc tả:</b> Khi một mức độ có nhiều YCCĐ, dùng nút <b>Gắn YCCĐ</b> để chọn đúng
                yêu cầu mà từng câu đánh giá. Điểm số và số lượng không bao giờ bị cộng đúp.
              </li>
              <li>
                <b>Lưu & Xuất Word:</b> Bấm <b>Lưu bản nháp</b> để lưu đầy đủ bộ lọc và số liệu; bấm{' '}
                <b>Tải Ma trận & Đặc tả (Word)</b> để xuất tệp <code>.docx</code> khổ ngang chuẩn Times New Roman.
              </li>
            </ol>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
