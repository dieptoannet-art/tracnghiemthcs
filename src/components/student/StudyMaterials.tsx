import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CORE_KNOWLEDGE_LESSONS,
  getGroupsByGradeAndSubject,
  getLessonsByGroup
} from '../../data/coreKnowledgeLessons';
import {
  ExamPeriod,
  Grade,
  StudyDocument,
  StudyMaterialStatus,
  StudyMaterialType,
  SubjectId
} from '../../types';
import {
  EXAM_TERM_OPTIONS,
  STUDY_MATERIAL_TYPE_OPTIONS,
  SUBJECT_OPTIONS,
  findMatchingPublishedOutlines,
  formatRealFileSize,
  formatRealUpdatedDate,
  getExamTermLabel,
  getMaterialTypeLabel,
  getSubjectLabel,
  hasValidAttachedFile,
  isPdfMaterial,
  isPracticeOrSpreadsheetFormat,
  isStudentVisibleMaterial,
  mapSubjectIdToCatalogCode,
  resolveMaterialFileUrl,
  triggerMaterialDownload
} from '../../utils/studyMaterialsSync';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderOpen,
  HardDrive,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  X
} from 'lucide-react';

interface MaterialFormState {
  id?: string;
  title: string;
  topic: string;
  grade: Grade;
  subject: SubjectId;
  materialType: StudyMaterialType;
  examTerm: ExamPeriod | '';
  chapterKey: string;
  lessonId: string;
  description: string;
  usageInstructions: string;
  externalFileUrl: string;
  selectedFile: File | null;
}

const DEFAULT_FORM_STATE: MaterialFormState = {
  title: '',
  topic: '',
  grade: '8',
  subject: 'math',
  materialType: 'de_cuong',
  examTerm: 'mid1',
  chapterKey: '',
  lessonId: '',
  description: '',
  usageInstructions: '',
  externalFileUrl: '',
  selectedFile: null
};

function getTypeBadgeStyle(type: StudyMaterialType): string {
  switch (type) {
    case 'de_cuong':
      return 'bg-blue-100 text-[#006BFF] border-blue-200';
    case 'phieu_bai_tap':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'de_tham_khao':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'so_tay':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'tep_thuc_hanh':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    default:
      return 'bg-blue-100 text-[#006BFF] border-blue-200';
  }
}

export const StudyMaterials: React.FC = () => {
  const {
    currentRole,
    studyDocs,
    studyDocsLoading,
    studyDocsError,
    retryLoadStudyDocs,
    studyMaterialNavIntent,
    clearStudyMaterialNavIntent,
    saveStudyMaterialAsync,
    deleteStudyMaterialAsync
  } = useApp();

  const canManage = currentRole === 'teacher' || currentRole === 'admin';

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');
  const [subjectFilter, setSubjectFilter] = useState<SubjectId | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<StudyMaterialType | 'all'>('all');
  const [examTermFilter, setExamTermFilter] = useState<ExamPeriod | 'all'>('all');
  const [chapterOrLessonFilter, setChapterOrLessonFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StudyMaterialStatus>('all');

  // Feedback & action states
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Preview / Detail modal state
  const [previewDoc, setPreviewDoc] = useState<StudyDocument | null>(null);
  const [previewResolvedUrl, setPreviewResolvedUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Teacher Create/Edit modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<StudyDocument | null>(null);
  const [formState, setFormState] = useState<MaterialFormState>(DEFAULT_FORM_STATE);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState<boolean>(false);

  // Inline delete confirm state (avoids window.confirm inside iframe)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<StudyDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Documents visible to current user role
  const roleVisibleDocs = useMemo(() => {
    if (canManage) return studyDocs;
    return studyDocs.filter(isStudentVisibleMaterial);
  }, [studyDocs, canManage]);

  // Apply cross-menu navigation intent (e.g. from SemesterReview -> "Xem đề cương" or CoreKnowledgeView)
  useEffect(() => {
    if (!studyMaterialNavIntent) return;

    if (studyMaterialNavIntent.grade !== undefined) {
      setGradeFilter(studyMaterialNavIntent.grade);
    }
    if (studyMaterialNavIntent.subject !== undefined) {
      setSubjectFilter(studyMaterialNavIntent.subject);
    }
    if (studyMaterialNavIntent.materialType !== undefined) {
      setTypeFilter(studyMaterialNavIntent.materialType);
    }
    if (studyMaterialNavIntent.examTerm !== undefined) {
      setExamTermFilter(studyMaterialNavIntent.examTerm);
    }
    if (studyMaterialNavIntent.lessonId && studyMaterialNavIntent.lessonId !== 'all') {
      setChapterOrLessonFilter(`lesson:${studyMaterialNavIntent.lessonId}`);
    } else if (studyMaterialNavIntent.chapterKey && studyMaterialNavIntent.chapterKey !== 'all') {
      setChapterOrLessonFilter(`chapter:${studyMaterialNavIntent.chapterKey}`);
    }
    if (studyMaterialNavIntent.searchQuery !== undefined) {
      setSearchQuery(studyMaterialNavIntent.searchQuery);
    }

    if (studyMaterialNavIntent.openMaterialId) {
      const target = roleVisibleDocs.find(d => d.id === studyMaterialNavIntent.openMaterialId);
      if (target) {
        handleOpenPreview(target);
      } else if (
        studyMaterialNavIntent.grade &&
        studyMaterialNavIntent.grade !== 'all' &&
        studyMaterialNavIntent.subject &&
        studyMaterialNavIntent.subject !== 'all' &&
        studyMaterialNavIntent.examTerm &&
        studyMaterialNavIntent.examTerm !== 'all' &&
        studyMaterialNavIntent.materialType === 'de_cuong'
      ) {
        const matched = findMatchingPublishedOutlines(
          roleVisibleDocs,
          studyMaterialNavIntent.grade,
          studyMaterialNavIntent.subject,
          studyMaterialNavIntent.examTerm
        );
        if (matched.length === 1) {
          handleOpenPreview(matched[0]);
        }
      }
    }

    clearStudyMaterialNavIntent();
  }, [studyMaterialNavIntent, roleVisibleDocs, clearStudyMaterialNavIntent]);

  // Show Đợt kiểm tra filter when Đề cương ôn tập or Đề tham khảo is selected
  const showExamTermFilter = typeFilter === 'de_cuong' || typeFilter === 'de_tham_khao';
  // Show Chương / Bài filter when Phiếu bài tập or Tệp thực hành is selected
  const showChapterLessonFilter = typeFilter === 'phieu_bai_tap' || typeFilter === 'tep_thuc_hanh';

  // Reset conditional filters when switching away from their respective document types
  useEffect(() => {
    if (!showExamTermFilter && examTermFilter !== 'all') {
      setExamTermFilter('all');
    }
    if (!showChapterLessonFilter && chapterOrLessonFilter !== 'all') {
      setChapterOrLessonFilter('all');
    }
  }, [showExamTermFilter, showChapterLessonFilter, examTermFilter, chapterOrLessonFilter]);

  // Derive Chương / Bài filter options from catalog_kien_thuc_trong_tam.json + existing documents
  const chapterLessonFilterOptions = useMemo(() => {
    const catalogLessons = CORE_KNOWLEDGE_LESSONS.filter(l => {
      if (gradeFilter !== 'all' && String(l.grade) !== String(gradeFilter)) return false;
      if (subjectFilter !== 'all') {
        const code = mapSubjectIdToCatalogCode(subjectFilter);
        if (!code || l.subjectCode !== code) return false;
      }
      return true;
    });

    const chaptersMap = new Map<string, string>();
    const lessonItems: Array<{ id: string; label: string }> = [];

    for (const l of catalogLessons) {
      const cKey = `${l.volume}_${l.chapterLabel}`;
      const gradePrefix = gradeFilter === 'all' ? `Lớp ${l.grade} • ` : '';
      const subjPrefix = subjectFilter === 'all' ? `${l.subjectName} • ` : '';
      if (!chaptersMap.has(cKey)) {
        chaptersMap.set(cKey, `${gradePrefix}${subjPrefix}${l.chapterLabel}`);
      }
      lessonItems.push({
        id: l.id,
        label: `${gradePrefix}${subjPrefix}${l.chapterLabel} → ${l.lessonLabel}`
      });
    }

    // Also include any custom chapter/lesson metadata attached to existing docs
    roleVisibleDocs.forEach(doc => {
      if (gradeFilter !== 'all' && doc.grade !== gradeFilter) return;
      if (subjectFilter !== 'all' && doc.subject !== subjectFilter) return;
      if (doc.chapterKey && doc.chapterLabel && !chaptersMap.has(doc.chapterKey)) {
        chaptersMap.set(doc.chapterKey, doc.chapterLabel);
      }
      if (doc.lessonId && doc.lessonLabel && !lessonItems.some(x => x.id === doc.lessonId)) {
        lessonItems.push({
          id: doc.lessonId,
          label: `${doc.chapterLabel ? `${doc.chapterLabel} → ` : ''}${doc.lessonLabel}`
        });
      }
    });

    return {
      chapters: Array.from(chaptersMap.entries()).map(([key, label]) => ({ key, label })),
      lessons: lessonItems
    };
  }, [gradeFilter, subjectFilter, roleVisibleDocs]);

  const hasCatalogChapterData =
    chapterLessonFilterOptions.chapters.length > 0 || chapterLessonFilterOptions.lessons.length > 0;

  // Reset chapter/lesson filter if current selection is no longer in available options
  useEffect(() => {
    if (chapterOrLessonFilter === 'all') return;
    if (chapterOrLessonFilter.startsWith('chapter:')) {
      const key = chapterOrLessonFilter.slice('chapter:'.length);
      if (!chapterLessonFilterOptions.chapters.some(c => c.key === key)) {
        setChapterOrLessonFilter('all');
      }
    } else if (chapterOrLessonFilter.startsWith('lesson:')) {
      const id = chapterOrLessonFilter.slice('lesson:'.length);
      if (!chapterLessonFilterOptions.lessons.some(l => l.id === id)) {
        setChapterOrLessonFilter('all');
      }
    }
  }, [chapterLessonFilterOptions, chapterOrLessonFilter]);

  // Filtered documents list
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return roleVisibleDocs.filter(doc => {
      if (gradeFilter !== 'all' && String(doc.grade) !== String(gradeFilter)) return false;
      if (subjectFilter !== 'all' && doc.subject !== subjectFilter) return false;
      if (typeFilter !== 'all' && doc.materialType !== typeFilter) return false;

      if (showExamTermFilter && examTermFilter !== 'all' && doc.examTerm !== examTermFilter) {
        return false;
      }

      if (showChapterLessonFilter && chapterOrLessonFilter !== 'all') {
        if (chapterOrLessonFilter.startsWith('chapter:')) {
          const targetKey = chapterOrLessonFilter.slice('chapter:'.length);
          const docCatalogLesson = doc.lessonId
            ? CORE_KNOWLEDGE_LESSONS.find(l => l.id === doc.lessonId)
            : undefined;
          const docKey =
            doc.chapterKey ||
            (docCatalogLesson ? `${docCatalogLesson.volume}_${docCatalogLesson.chapterLabel}` : '');
          if (docKey !== targetKey) return false;
        } else if (chapterOrLessonFilter.startsWith('lesson:')) {
          const targetLessonId = chapterOrLessonFilter.slice('lesson:'.length);
          if (doc.lessonId !== targetLessonId) return false;
        }
      }

      if (canManage && statusFilter !== 'all' && doc.status !== statusFilter) {
        return false;
      }

      if (q) {
        const haystack = [
          doc.title,
          doc.topic,
          doc.description,
          doc.chapterLabel,
          doc.lessonLabel,
          getSubjectLabel(doc.subject),
          getMaterialTypeLabel(doc.materialType)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    roleVisibleDocs,
    searchQuery,
    gradeFilter,
    subjectFilter,
    typeFilter,
    showExamTermFilter,
    examTermFilter,
    showChapterLessonFilter,
    chapterOrLessonFilter,
    canManage,
    statusFilter
  ]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      gradeFilter !== 'all' ||
      subjectFilter !== 'all' ||
      typeFilter !== 'all' ||
      examTermFilter !== 'all' ||
      chapterOrLessonFilter !== 'all' ||
      (canManage && statusFilter !== 'all')
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setGradeFilter('all');
    setSubjectFilter('all');
    setTypeFilter('all');
    setExamTermFilter('all');
    setChapterOrLessonFilter('all');
    setStatusFilter('all');
  };

  // Preview handler
  const handleOpenPreview = async (doc: StudyDocument) => {
    if (!hasValidAttachedFile(doc)) return;
    setPreviewDoc(doc);
    setPreviewResolvedUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);

    const res = await resolveMaterialFileUrl(doc.storagePath, doc.fileUrl);
    if (!res.url) {
      setPreviewError(res.error || 'Không thể mở tệp tài liệu.');
      setPreviewLoading(false);
      return;
    }
    setPreviewResolvedUrl(res.url);
    setPreviewLoading(false);
  };

  const handleClosePreview = () => {
    setPreviewDoc(null);
    setPreviewResolvedUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  // Download handler
  const handleDownload = async (doc: StudyDocument) => {
    if (!hasValidAttachedFile(doc)) return;
    setDownloadingId(doc.id);
    setActionFeedback(null);
    const res = await triggerMaterialDownload(doc);
    setDownloadingId(null);
    if (!res.success) {
      setActionFeedback({
        type: 'error',
        message: res.error || 'Không thể tải tệp về máy.'
      });
    }
  };

  // Teacher modal helpers
  const formCatalogSubjectCode = useMemo(
    () => mapSubjectIdToCatalogCode(formState.subject),
    [formState.subject]
  );

  const formAvailableGroups = useMemo(() => {
    if (!formCatalogSubjectCode) return [];
    return getGroupsByGradeAndSubject(Number(formState.grade), formCatalogSubjectCode);
  }, [formState.grade, formCatalogSubjectCode]);

  const formAvailableLessons = useMemo(() => {
    if (!formCatalogSubjectCode || !formState.chapterKey) return [];
    return getLessonsByGroup(Number(formState.grade), formCatalogSubjectCode, formState.chapterKey);
  }, [formState.grade, formCatalogSubjectCode, formState.chapterKey]);

  const openCreateModal = () => {
    setEditingDoc(null);
    setFormState({
      ...DEFAULT_FORM_STATE,
      grade: gradeFilter !== 'all' ? gradeFilter : '8',
      subject: subjectFilter !== 'all' ? subjectFilter : 'math',
      materialType: typeFilter !== 'all' ? typeFilter : 'de_cuong',
      examTerm: examTermFilter !== 'all' ? examTermFilter : 'mid1'
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (doc: StudyDocument) => {
    const linkedLesson = doc.lessonId
      ? CORE_KNOWLEDGE_LESSONS.find(l => l.id === doc.lessonId)
      : undefined;
    const derivedChapterKey =
      doc.chapterKey ||
      (linkedLesson ? `${linkedLesson.volume}_${linkedLesson.chapterLabel}` : '');

    setEditingDoc(doc);
    setFormState({
      id: doc.id,
      title: doc.title,
      topic: doc.topic || '',
      grade: doc.grade,
      subject: doc.subject,
      materialType: doc.materialType,
      examTerm: doc.examTerm || 'mid1',
      chapterKey: derivedChapterKey,
      lessonId: doc.lessonId || '',
      description: doc.description,
      usageInstructions: doc.usageInstructions || '',
      externalFileUrl: doc.storagePath ? '' : doc.fileUrl || '',
      selectedFile: null
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = async (targetStatus: StudyMaterialStatus) => {
    setFormError(null);

    if (!formState.title.trim()) {
      setFormError('Vui lòng nhập tên tài liệu.');
      return;
    }

    const isTermType =
      formState.materialType === 'de_cuong' || formState.materialType === 'de_tham_khao';
    const isLessonType =
      formState.materialType === 'phieu_bai_tap' || formState.materialType === 'tep_thuc_hanh';

    const selectedGroup = formAvailableGroups.find(g => g.groupKey === formState.chapterKey);
    const selectedLesson = formAvailableLessons.find(l => l.id === formState.lessonId);

    setFormSaving(true);
    const res = await saveStudyMaterialAsync({
      id: editingDoc?.id,
      title: formState.title,
      topic: formState.topic,
      grade: formState.grade,
      subject: formState.subject,
      materialType: formState.materialType,
      examTerm: isTermType ? (formState.examTerm || 'mid1') : null,
      lessonId: isLessonType ? (formState.lessonId || null) : null,
      chapterKey: isLessonType ? (formState.chapterKey || null) : null,
      chapterLabel: isLessonType ? (selectedGroup?.chapterLabel || editingDoc?.chapterLabel || null) : null,
      lessonLabel: isLessonType ? (selectedLesson?.lessonLabel || editingDoc?.lessonLabel || null) : null,
      description: formState.description,
      usageInstructions: formState.usageInstructions,
      status: targetStatus,
      selectedFile: formState.selectedFile,
      externalFileUrl: formState.selectedFile ? undefined : formState.externalFileUrl,
      existingMaterial: editingDoc
    });
    setFormSaving(false);

    if (!res.success) {
      setFormError(res.error || 'Không thể lưu tài liệu.');
      return;
    }

    setIsFormModalOpen(false);
    setEditingDoc(null);
    setActionFeedback({
      type: 'success',
      message:
        targetStatus === 'published'
          ? `Đã công bố tài liệu "${res.material?.title}" vào thư viện.`
          : `Đã lưu bản nháp "${res.material?.title}".`
    });
  };

  const handleTogglePublish = async (doc: StudyDocument, nextStatus: StudyMaterialStatus) => {
    setActionFeedback(null);
    const res = await saveStudyMaterialAsync({
      id: doc.id,
      title: doc.title,
      topic: doc.topic,
      grade: doc.grade,
      subject: doc.subject,
      materialType: doc.materialType,
      examTerm: doc.examTerm,
      lessonId: doc.lessonId,
      chapterKey: doc.chapterKey,
      chapterLabel: doc.chapterLabel,
      lessonLabel: doc.lessonLabel,
      description: doc.description,
      usageInstructions: doc.usageInstructions,
      status: nextStatus,
      existingMaterial: doc
    });
    if (!res.success) {
      setActionFeedback({
        type: 'error',
        message: res.error || 'Không thể cập nhật trạng thái tài liệu.'
      });
      return;
    }
    setActionFeedback({
      type: 'success',
      message:
        nextStatus === 'published'
          ? `Đã công bố "${doc.title}" cho học sinh.`
          : `Đã chuyển "${doc.title}" về bản nháp.`
    });
  };

  const handleConfirmDelete = async (doc: StudyDocument) => {
    setDeletingId(doc.id);
    const res = await deleteStudyMaterialAsync(doc.id);
    setDeletingId(null);
    setConfirmDeleteDoc(null);
    if (!res.success) {
      setActionFeedback({
        type: 'error',
        message: res.error || 'Không thể xóa tài liệu.'
      });
      return;
    }
    setActionFeedback({
      type: 'success',
      message: `Đã xóa tài liệu "${doc.title}".`
    });
  };

  return (
    <div className="space-y-6 font-serif">
      {/* 1. HEADER & TÌM KIẾM */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-blue-100 text-[#006BFF] rounded-xl">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#082B52]">Tài liệu học tập</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Thư viện học liệu Trường THCS Tây Đô: đề cương ôn tập, phiếu bài tập, đề tham khảo, sổ tay kiến thức và tệp thực hành
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Ô tìm theo tên tài liệu hoặc chủ đề */}
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên tài liệu hoặc chủ đề..."
                aria-label="Tìm theo tên tài liệu hoặc chủ đề"
                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] text-xs sm:text-sm text-[#082B52] placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Xóa từ khóa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm tài liệu</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. BỘ LỌC KHỐI LỚP, MÔN HỌC, LOẠI TÀI LIỆU & BỘ LỌC BỔ SUNG */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Khối lớp (6-9) */}
            <div className="space-y-1">
              <label className="block font-bold text-[#082B52]">Khối lớp</label>
              <select
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value as Grade | 'all')}
                className="w-full px-3 py-2 rounded-xl border border-[#DCE8F7] bg-white font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
              >
                <option value="all">Tất cả khối (6–9)</option>
                <option value="6">Khối 6</option>
                <option value="7">Khối 7</option>
                <option value="8">Khối 8</option>
                <option value="9">Khối 9</option>
              </select>
            </div>

            {/* Môn học */}
            <div className="space-y-1">
              <label className="block font-bold text-[#082B52]">Môn học</label>
              <select
                value={subjectFilter}
                onChange={e => setSubjectFilter(e.target.value as SubjectId | 'all')}
                className="w-full px-3 py-2 rounded-xl border border-[#DCE8F7] bg-white font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
              >
                <option value="all">Tất cả môn học</option>
                {SUBJECT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Loại tài liệu (5 loại) */}
            <div className="space-y-1">
              <label className="block font-bold text-[#082B52]">Loại tài liệu</label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as StudyMaterialType | 'all')}
                className="w-full px-3 py-2 rounded-xl border border-[#DCE8F7] bg-white font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
              >
                <option value="all">Tất cả 5 loại tài liệu</option>
                {STUDY_MATERIAL_TYPE_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Bộ lọc điều kiện: Đợt kiểm tra HOẶC Chương / Bài HOẶC Trạng thái (cho giáo viên) */}
            {showExamTermFilter ? (
              <div className="space-y-1">
                <label className="block font-bold text-[#082B52]">Đợt kiểm tra</label>
                <select
                  value={examTermFilter}
                  onChange={e => setExamTermFilter(e.target.value as ExamPeriod | 'all')}
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-blue-50/40 font-semibold text-[#082B52] focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                >
                  <option value="all">Tất cả đợt kiểm tra</option>
                  {EXAM_TERM_OPTIONS.map(term => (
                    <option key={term.value} value={term.value}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : showChapterLessonFilter && hasCatalogChapterData ? (
              <div className="space-y-1">
                <label className="block font-bold text-[#082B52]">Chương / Bài</label>
                <select
                  value={chapterOrLessonFilter}
                  onChange={e => setChapterOrLessonFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-blue-50/40 font-semibold text-[#082B52] focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                >
                  <option value="all">Tất cả chương / bài</option>
                  {chapterLessonFilterOptions.chapters.length > 0 && (
                    <optgroup label="Theo Chương / Chủ đề">
                      {chapterLessonFilterOptions.chapters.map(ch => (
                        <option key={ch.key} value={`chapter:${ch.key}`}>
                          {ch.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {chapterLessonFilterOptions.lessons.length > 0 && (
                    <optgroup label="Theo Bài học cụ thể">
                      {chapterLessonFilterOptions.lessons.map(ls => (
                        <option key={ls.id} value={`lesson:${ls.id}`}>
                          {ls.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            ) : canManage ? (
              <div className="space-y-1">
                <label className="block font-bold text-[#082B52]">Trạng thái xuất bản</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | StudyMaterialStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DCE8F7] bg-white font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                >
                  <option value="all">Tất cả (Công bố & Nháp)</option>
                  <option value="published">Đã công bố</option>
                  <option value="draft">Bản nháp (Ẩn với HS)</option>
                </select>
              </div>
            ) : (
              <div className="flex items-end">
                <div className="w-full px-3 py-2 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] text-slate-600 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#006BFF]" />
                    <span>Hiển thị:</span>
                  </span>
                  <span className="font-bold text-[#082B52]">{filteredDocs.length} tài liệu</span>
                </div>
              </div>
            )}
          </div>

          {/* Hàng phụ cho giáo viên khi bộ lọc điều kiện đang chiếm cột thứ 4 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (showExamTermFilter || (showChapterLessonFilter && hasCatalogChapterData)) && (
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-[#082B52]">Trạng thái:</span>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as 'all' | StudyMaterialStatus)}
                    className="px-2.5 py-1 rounded-lg border border-[#DCE8F7] bg-white font-semibold text-slate-700"
                  >
                    <option value="all">Tất cả</option>
                    <option value="published">Đã công bố</option>
                    <option value="draft">Bản nháp</option>
                  </select>
                </div>
              )}

              <span className="text-slate-500">
                Đang hiển thị <strong className="text-[#082B52]">{filteredDocs.length}</strong> tài liệu
                {!canManage && ' đã công bố'}
              </span>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg border border-[#DCE8F7] bg-[#F3F8FF] hover:bg-blue-100 text-[#006BFF] font-bold transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Thông báo thao tác (thành công / lỗi) */}
      {actionFeedback && (
        <div
          className={`rounded-2xl border p-4 flex items-center justify-between gap-3 text-xs sm:text-sm ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 shrink-0"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. TRẠNG THÁI ĐANG TẢI / LỖI / RỖNG / DANH SÁCH THẺ */}
      {studyDocsLoading ? (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-12 text-center shadow-xs space-y-3">
          <Loader2 className="w-9 h-9 text-[#006BFF] animate-spin mx-auto" />
          <p className="text-sm font-bold text-[#082B52]">Đang tải danh sách tài liệu học tập...</p>
          <p className="text-xs text-slate-500">Vui lòng chờ trong giây lát.</p>
        </div>
      ) : studyDocsError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 sm:p-10 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-xl mx-auto">
            <h3 className="text-lg font-bold text-[#082B52]">Không thể tải thư viện tài liệu</h3>
            <p className="text-xs sm:text-sm text-rose-700 leading-relaxed">{studyDocsError}</p>
          </div>
          <button
            type="button"
            onClick={retryLoadStudyDocs}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-10 sm:p-12 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 bg-blue-50 text-[#006BFF] rounded-full flex items-center justify-center mx-auto">
            <FolderOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-[#082B52]">Chưa có tài liệu phù hợp</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {canManage
                ? 'Không tìm thấy tài liệu nào khớp với bộ lọc hiện tại, hoặc bạn có thể thêm tài liệu mới và gắn tệp để công bố.'
                : 'Hiện chưa có tài liệu đã công bố phù hợp với bộ lọc đã chọn. Hãy thử xóa bộ lọc hoặc quay lại sau khi giáo viên cập nhật tệp tài liệu.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#F3F8FF] hover:bg-blue-100 text-[#006BFF] border border-[#DCE8F7] rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Xóa bộ lọc</span>
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm tài liệu</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* LƯỚI THẺ TÀI LIỆU: 3 CỘT MÁY TÍNH, 2 CỘT MÁY TÍNH BẢNG, 1 CỘT ĐIỆN THOẠI */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(doc => {
            const hasFile = hasValidAttachedFile(doc);
            const isPdf = isPdfMaterial(doc);
            const isPractice = isPracticeOrSpreadsheetFormat(doc);
            const realSize = formatRealFileSize(doc.fileSizeBytes);
            const realDate = formatRealUpdatedDate(doc.updatedAt);

            return (
              <div
                key={doc.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all space-y-4 ${
                  doc.status === 'draft'
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-[#DCE8F7] hover:border-[#006BFF] hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  {/* Nhãn loại tài liệu, trạng thái & định dạng tệp */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] ${getTypeBadgeStyle(
                        doc.materialType
                      )}`}
                    >
                      {getMaterialTypeLabel(doc.materialType)}
                    </span>

                    <div className="flex items-center space-x-1.5">
                      {canManage && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            doc.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {doc.status === 'published' ? 'Đã công bố' : 'Bản nháp'}
                        </span>
                      )}

                      {doc.fileFormat ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] uppercase">
                          {doc.fileFormat}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold text-[11px] border border-amber-200">
                          Chưa gắn tệp
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Khối lớp, Môn học & Liên kết đợt kiểm tra / bài học */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-[#F3F8FF] text-[#082B52] font-bold border border-[#DCE8F7]">
                      Khối {doc.grade}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#F3F8FF] text-[#006BFF] font-bold border border-[#DCE8F7]">
                      {getSubjectLabel(doc.subject)}
                    </span>
                    {doc.examTerm && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                        {getExamTermLabel(doc.examTerm)}
                      </span>
                    )}
                  </div>

                  {/* Tiêu đề tài liệu */}
                  <h4 className="font-bold text-base text-[#082B52] leading-snug">
                    {doc.title}
                  </h4>

                  {/* Chủ đề hoặc bài học liên kết (nếu có) */}
                  {(doc.chapterLabel || doc.lessonLabel) && (
                    <div className="text-[11px] text-[#006BFF] bg-blue-50/60 border border-blue-100 rounded-lg px-2.5 py-1.5 flex items-start space-x-1.5">
                      <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {[doc.chapterLabel, doc.lessonLabel].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                  )}

                  {/* Mô tả ngắn */}
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {doc.description || 'Chưa có mô tả chi tiết cho tài liệu này.'}
                  </p>

                  {/* Hướng dẫn sử dụng cho tệp Excel / thực hành (nếu có) */}
                  {isPractice && doc.usageInstructions && (
                    <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-[11px] text-emerald-900 space-y-0.5">
                      <div className="font-bold flex items-center space-x-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Hướng dẫn sử dụng:</span>
                      </div>
                      <p className="line-clamp-3 leading-relaxed text-emerald-800">
                        {doc.usageInstructions}
                      </p>
                    </div>
                  )}

                  {/* Dung lượng & Ngày cập nhật: CHỈ HIỆN KHI CÓ DỮ LIỆU THẬT */}
                  {(realSize || realDate) && (
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      {realSize && (
                        <span className="inline-flex items-center space-x-1">
                          <HardDrive className="w-3 h-3 text-slate-400" />
                          <span>{realSize}</span>
                        </span>
                      )}
                      {realDate && (
                        <span className="inline-flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Cập nhật: {realDate}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer hành động */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 truncate">{doc.author}</span>

                    {hasFile ? (
                      <div className="flex items-center space-x-2 shrink-0">
                        {isPdf ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(doc)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-[#F3F8FF] hover:bg-blue-100 text-[#006BFF] border border-[#DCE8F7] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem trước</span>
                          </button>
                        ) : (
                          doc.usageInstructions && (
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(doc)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-[#F3F8FF] hover:bg-blue-100 text-[#006BFF] border border-[#DCE8F7] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span>Hướng dẫn</span>
                            </button>
                          )
                        )}

                        <button
                          type="button"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {downloadingId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Tải về</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700">
                        Chưa có tệp đính kèm
                      </span>
                    )}
                  </div>

                  {/* Thanh quản trị cho giáo viên / quản trị viên */}
                  {canManage && (
                    <div className="pt-2 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(doc)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-[#DCE8F7] bg-white hover:bg-blue-50 text-[#082B52] font-bold transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-[#006BFF]" />
                          <span>{hasFile ? 'Sửa / Thay tệp' : 'Gắn tệp & Sửa'}</span>
                        </button>

                        {doc.status === 'draft' ? (
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(doc, 'published')}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Công bố</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(doc, 'draft')}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold transition-colors cursor-pointer"
                          >
                            <span>Chuyển nháp</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteDoc(doc)}
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold transition-colors cursor-pointer"
                        title="Xóa tài liệu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL XEM TRƯỚC PDF / CHI TIẾT TÀI LIỆU THỰC HÀNH */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 sm:p-6">
          <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#082B52] text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-blue-200">
                  <span>{getMaterialTypeLabel(previewDoc.materialType)}</span>
                  <span>•</span>
                  <span>Khối {previewDoc.grade}</span>
                  <span>•</span>
                  <span>{getSubjectLabel(previewDoc.subject)}</span>
                  {previewDoc.examTerm && (
                    <>
                      <span>•</span>
                      <span>{getExamTermLabel(previewDoc.examTerm)}</span>
                    </>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold truncate mt-0.5">
                  {previewDoc.title}
                </h3>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {previewResolvedUrl && (
                  <a
                    href={previewResolvedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {isPdfMaterial(previewDoc) ? 'Mở PDF trong tab mới' : 'Mở trong tab mới'}
                    </span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(previewDoc)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải về</span>
                </button>

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  aria-label="Đóng cửa sổ xem trước"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#F8FBFF]">
              {previewLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#006BFF] animate-spin mx-auto" />
                  <p className="text-xs font-bold text-[#082B52]">Đang tải tệp tài liệu...</p>
                </div>
              ) : previewError ? (
                <div className="p-6 bg-white rounded-xl border border-rose-200 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                  <p className="text-sm font-bold text-[#082B52]">Không thể xem trước tài liệu</p>
                  <p className="text-xs text-rose-700">{previewError}</p>
                </div>
              ) : isPdfMaterial(previewDoc) && previewResolvedUrl ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#082B52]">
                    <span>
                      Nếu trình duyệt trên thiết bị không nhúng trực tiếp PDF, vui lòng mở tệp ở tab mới hoặc tải về máy.
                    </span>
                    <a
                      href={previewResolvedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-blue-100 text-[#006BFF] border border-blue-300 rounded-lg font-bold shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Mở PDF trong tab mới</span>
                    </a>
                  </div>

                  <iframe
                    src={previewResolvedUrl}
                    title={`Xem trước PDF: ${previewDoc.title}`}
                    className="w-full h-[64vh] rounded-xl border border-[#DCE8F7] bg-white"
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 space-y-4 text-xs sm:text-sm">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-[#082B52] text-base">{previewDoc.title}</div>
                      {previewDoc.fileName && (
                        <div className="text-xs text-slate-500">
                          Tệp đính kèm: <code>{previewDoc.fileName}</code>
                          {previewDoc.fileFormat ? ` (${previewDoc.fileFormat})` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-[#082B52]">Mô tả tài liệu:</div>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {previewDoc.description || 'Không có mô tả bổ sung.'}
                    </p>
                  </div>

                  {previewDoc.usageInstructions && (
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                      <div className="font-bold text-emerald-900">Hướng dẫn sử dụng / thực hành:</div>
                      <p className="text-emerald-800 leading-relaxed whitespace-pre-line">
                        {previewDoc.usageInstructions}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(previewDoc)}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải về máy</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL GIÁO VIÊN THÊM / SỬA TÀI LIỆU */}
      {canManage && isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 sm:p-6">
          <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-[#082B52] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <FileText className="w-5 h-5 text-blue-300" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold">
                    {editingDoc ? 'Chỉnh sửa tài liệu & tệp đính kèm' : 'Thêm tài liệu học tập mới'}
                  </h3>
                  {editingDoc && (
                    <p className="text-[11px] text-blue-200">
                      Giữ nguyên mã ID ({editingDoc.id}) và các liên kết giữa các menu
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                aria-label="Đóng biểu mẫu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-[#082B52]">
                  Tên tài liệu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={e => setFormState(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ví dụ: Đề cương ôn tập Giữa kỳ I - Toán 8"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F7] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-[#082B52]">Khối lớp</label>
                  <select
                    value={formState.grade}
                    onChange={e =>
                      setFormState(prev => ({
                        ...prev,
                        grade: e.target.value as Grade,
                        chapterKey: '',
                        lessonId: ''
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-semibold"
                  >
                    <option value="6">Khối 6</option>
                    <option value="7">Khối 7</option>
                    <option value="8">Khối 8</option>
                    <option value="9">Khối 9</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#082B52]">Môn học</label>
                  <select
                    value={formState.subject}
                    onChange={e =>
                      setFormState(prev => ({
                        ...prev,
                        subject: e.target.value as SubjectId,
                        chapterKey: '',
                        lessonId: ''
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-semibold"
                  >
                    {SUBJECT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#082B52]">Loại tài liệu</label>
                  <select
                    value={formState.materialType}
                    onChange={e =>
                      setFormState(prev => ({
                        ...prev,
                        materialType: e.target.value as StudyMaterialType
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-semibold"
                  >
                    {STUDY_MATERIAL_TYPE_OPTIONS.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Liên kết theo Đợt kiểm tra hoặc Chương / Bài */}
              {(formState.materialType === 'de_cuong' || formState.materialType === 'de_tham_khao') && (
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
                  <label className="block font-bold text-[#082B52] text-xs">
                    Liên kết với Đợt kiểm tra (hiển thị trong Ôn tập học kỳ → Xem đề cương):
                  </label>
                  <select
                    value={formState.examTerm}
                    onChange={e =>
                      setFormState(prev => ({ ...prev, examTerm: e.target.value as ExamPeriod }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-white font-semibold text-xs"
                  >
                    {EXAM_TERM_OPTIONS.map(term => (
                      <option key={term.value} value={term.value}>
                        {term.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(formState.materialType === 'phieu_bai_tap' ||
                formState.materialType === 'tep_thuc_hanh') && (
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                  <div className="font-bold text-[#082B52] text-xs">
                    Liên kết với Chương / Bài học (hiện nút “Tải phiếu bài tập” trong Kiến thức trọng tâm):
                  </div>

                  {formAvailableGroups.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <label className="block font-semibold text-slate-700">Chương / Chủ đề</label>
                        <select
                          value={formState.chapterKey}
                          onChange={e =>
                            setFormState(prev => ({
                              ...prev,
                              chapterKey: e.target.value,
                              lessonId: ''
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-white font-medium"
                        >
                          <option value="">-- Không gắn chương cụ thể --</option>
                          {formAvailableGroups.map(g => (
                            <option key={g.groupKey} value={g.groupKey}>
                              {g.chapterLabel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-semibold text-slate-700">Bài học cụ thể</label>
                        <select
                          value={formState.lessonId}
                          onChange={e =>
                            setFormState(prev => ({ ...prev, lessonId: e.target.value }))
                          }
                          disabled={!formState.chapterKey}
                          className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-white font-medium disabled:bg-slate-100"
                        >
                          <option value="">-- Chọn bài học --</option>
                          {formAvailableLessons.map(ls => (
                            <option key={ls.id} value={ls.id}>
                              {ls.lessonLabel}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600">
                      Môn học này chưa có danh mục bài học trong Kiến thức trọng tâm (Toán, Tin học, KHTN).
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-[#082B52]">Chủ đề / Từ khóa tìm kiếm</label>
                <input
                  type="text"
                  value={formState.topic}
                  onChange={e => setFormState(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="Ví dụ: Hằng đẳng thức, Hàm IF/SUMIF, Phản ứng hóa học..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#DCE8F7] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#082B52]">Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={e => setFormState(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tóm tắt nội dung trọng tâm của tài liệu..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#DCE8F7] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-[#082B52]">
                  Hướng dẫn sử dụng{' '}
                  <span className="text-xs font-normal text-slate-500">
                    (khuyên dùng cho tệp thực hành / Excel)
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={formState.usageInstructions}
                  onChange={e =>
                    setFormState(prev => ({ ...prev, usageInstructions: e.target.value }))
                  }
                  placeholder="Ví dụ: Tải tệp .xlsx về máy, mở bằng Microsoft Excel và điền công thức vào cột Thành tiền..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#DCE8F7] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                />
              </div>

              {/* Tải tệp thật hoặc nhập URL hợp lệ */}
              <div className="p-4 rounded-xl border border-dashed border-blue-300 bg-[#F3F8FF] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-[#082B52] text-xs">
                      Tệp tài liệu đính kèm (PDF, Excel .xlsx, Word...)
                    </div>
                    {editingDoc && hasValidAttachedFile(editingDoc) && !formState.selectedFile && (
                      <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                        Đang gắn tệp: {editingDoc.fileName || editingDoc.fileFormat || 'Tệp hợp lệ'}
                      </div>
                    )}
                  </div>

                  <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-blue-50 text-[#006BFF] border border-[#DCE8F7] rounded-xl text-xs font-bold shadow-2xs shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{editingDoc ? 'Chọn tệp mới để thay' : 'Tải tệp từ máy'}</span>
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.zip,.sb3,.py"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        setFormState(prev => ({
                          ...prev,
                          selectedFile: file
                        }));
                      }}
                    />
                  </label>
                </div>

                {formState.selectedFile && (
                  <div className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-blue-200 text-xs">
                    <span className="font-semibold text-[#082B52] truncate">
                      Tệp đã chọn: {formState.selectedFile.name} (
                      {formatRealFileSize(formState.selectedFile.size) || ''})
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, selectedFile: null }))}
                      className="text-rose-600 hover:underline font-semibold ml-2 shrink-0"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Hoặc nhập đường dẫn tệp hợp lệ (nếu lưu sẵn trên máy chủ / đường dẫn HTTPS):
                  </label>
                  <input
                    type="text"
                    value={formState.externalFileUrl}
                    onChange={e =>
                      setFormState(prev => ({ ...prev, externalFileUrl: e.target.value }))
                    }
                    disabled={Boolean(formState.selectedFile)}
                    placeholder="Ví dụ: https://... hoặc /documents/de-cuong-gk1-toan-8.pdf"
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE8F7] bg-white text-xs disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer: Lưu nháp & Công bố */}
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                disabled={formSaving}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={() => handleSubmitForm('draft')}
                disabled={formSaving}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {formSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Lưu nháp</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmitForm('published')}
                disabled={formSaving}
                className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {formSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Công bố</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL XÁC NHẬN XÓA TÀI LIỆU (CHO GIÁO VIÊN) */}
      {confirmDeleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#082B52] text-base">Xác nhận xóa tài liệu</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bạn có chắc chắn muốn xóa tài liệu <strong>{confirmDeleteDoc.title}</strong>? Thao tác này không thể hoàn tác.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDoc(null)}
                disabled={deletingId === confirmDeleteDoc.id}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(confirmDeleteDoc)}
                disabled={deletingId === confirmDeleteDoc.id}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deletingId === confirmDeleteDoc.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Xóa tài liệu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
