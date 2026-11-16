import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  CognitiveLevel,
  Exam,
  ExamPeriod,
  Grade,
  Question,
  QuestionType,
  SubjectId
} from '../../types';
import { generateRequestUuid, isValidUuid } from '../../utils/supabaseAssignmentSync';
import { formatAssignmentDeadline } from '../../utils/studentAssignments';
import { resolveCanonicalSubject } from '../../utils/subjectCatalog';
import {
  EXAM_GRADES,
  EXAM_PERIOD_META,
  NO_CATALOG_MESSAGE,
  QUESTION_LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  buildCatalogMatchIndex,
  buildExamScopeCatalog,
  clearPeriodScopePreset,
  filterQuestionsForExamAuthoring,
  getAvailableTextbooksForCombo,
  getPeriodScopePreset,
  getSubjectOption,
  getSubjectsForGrade,
  isQuestionApprovedForExam,
  normalizeTextbookName,
  savePeriodScopePreset
} from '../../utils/examCatalogScope';
import { isQuestionInSubject, normalizeGrade } from './QuestionBank';
import { MathView } from '../MathView';
import { ExamPreviewModal } from './ExamPreviewModal';
import {
  FileEdit,
  Send,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Cloud,
  MonitorSmartphone,
  Info,
  CalendarClock,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Eye,
  Bookmark,
  Trash2,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Save,
  BookOpen,
  Layers,
  CheckSquare
} from 'lucide-react';

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function advanceRoundLabel(label: string): string {
  const match = label.trim().match(/^(.*?)(\d+)$/);
  if (match) {
    return `${match[1]}${Number(match[2]) + 1}`;
  }
  return `${label.trim()} (Đợt mới)`;
}

function buildDefaultExamTitle(grade: Grade, subject: SubjectId, period: ExamPeriod): string {
  const subjName = getSubjectOption(subject).name;
  const periodLabel = EXAM_PERIOD_META.find(p => p.id === period)?.label || 'Giữa kỳ I';
  return `Kiểm tra ${periodLabel} – Môn ${subjName} ${grade}`;
}

function buildDefaultExamCode(grade: Grade, subject: SubjectId, period: ExamPeriod): string {
  const subjCode = getSubjectOption(subject).shortCode;
  const periodCode = EXAM_PERIOD_META.find(p => p.id === period)?.shortCode || 'GK1';
  return `${subjCode}${grade}-${periodCode}-01`;
}

type PendingContextChange =
  | { type: 'grade'; nextGrade: Grade }
  | { type: 'subject'; nextSubject: SubjectId }
  | { type: 'textbook'; nextTextbook: string };

export const CreateExamModal: React.FC = () => {
  const {
    questions: localQuestions,
    exams,
    classes,
    assignments,
    teachingAssignments,
    teachingSchemaWarning,
    selectedGrade: contextGrade,
    selectedSubject: contextSubject,
    selectedPeriod: contextPeriod,
    yccdCatalog,
    user,
    userProfile,
    currentRole,
    setCurrentView,
    isUsingDemoAssignmentsData,
    saveExamAsync,
    publishExamAssignmentAsync,
    openAuthModal
  } = useApp();

  // =========================================================================
  // 1. NGUỒN CÂU HỎI ĐỒNG BỘ (LOCAL + SUPABASE ĐÃ CHUẨN HÓA)
  // =========================================================================
  const [supabaseQuestions, setSupabaseQuestions] = useState<Question[]>([]);
  const [loadingBank, setLoadingBank] = useState<boolean>(false);

  const loadSupabaseQuestions = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setSupabaseQuestions([]);
      return;
    }
    setLoadingBank(true);
    try {
      const qMap = new Map<string, any>();
      const batchPageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: qBatch, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + batchPageSize - 1);

        if (qErr || !qBatch || qBatch.length === 0) {
          hasMore = false;
          break;
        }
        qBatch.forEach((row: any) => {
          if (row.id && !qMap.has(row.id)) qMap.set(row.id, row);
        });
        if (qBatch.length < batchPageSize || qMap.size >= 10000) {
          hasMore = false;
        } else {
          from += batchPageSize;
        }
      }

      const solMap = new Map<string, any>();
      const canAccessSolutions =
        currentRole === 'teacher' || currentRole === 'admin' || currentRole === 'reviewer';
      if (canAccessSolutions && qMap.size > 0) {
        let solFrom = 0;
        let solHasMore = true;
        while (solHasMore) {
          const { data: solBatch, error: solErr } = await supabase
            .from('protected_solutions')
            .select('*')
            .range(solFrom, solFrom + batchPageSize - 1);
          if (solErr || !solBatch || solBatch.length === 0) {
            solHasMore = false;
            break;
          }
          solBatch.forEach((s: any) => solMap.set(s.question_id, s));
          if (solBatch.length < batchPageSize || solMap.size >= 10000) {
            solHasMore = false;
          } else {
            solFrom += batchPageSize;
          }
        }
      }

      const normalizedList: Question[] = Array.from(qMap.values()).map((sq: any) => {
        const sol = solMap.get(sq.id);
        let parsedOptions: any[] = [];
        if (Array.isArray(sq.options)) parsedOptions = sq.options;
        else if (typeof sq.options === 'string') {
          try {
            parsedOptions = JSON.parse(sq.options);
          } catch {
            parsedOptions = [];
          }
        }
        const formattedOptions = parsedOptions.map((opt, idx) => ({
          id: opt.id || `opt-${idx}`,
          label: opt.label || String.fromCharCode(65 + idx),
          text: opt.text || ''
        }));

        let parsedSubItems: any[] = [];
        if (Array.isArray(sq.sub_items)) parsedSubItems = sq.sub_items;
        else if (typeof sq.sub_items === 'string') {
          try {
            parsedSubItems = JSON.parse(sq.sub_items);
          } catch {
            parsedSubItems = [];
          }
        }

        const subItemAnswers: any[] = Array.isArray(sol?.sub_item_answers)
          ? sol.sub_item_answers
          : [];

        const formattedSubItems = parsedSubItems.map((item, idx) => {
          const itemAns = subItemAnswers.find(
            (a: any) => a.id === item.id || a.label === item.label
          );
          return {
            id: item.id || `sub-${idx}`,
            label: item.label || String.fromCharCode(97 + idx),
            text: item.text || '',
            level: item.level || 'know',
            isCorrect: itemAns !== undefined ? Boolean(itemAns.isCorrect) : Boolean(item.isCorrect),
            yccd: item.yccd
          };
        });

        return {
          id: String(sq.id),
          code: String(sq.code || `Q-${String(sq.id).slice(0, 8)}`),
          grade: (normalizeGrade(sq.grade) || '6') as Grade,
          subject: sq.subject || 'math',
          textbook: (normalizeTextbookName(sq.textbook) || 'Kết nối tri thức') as any,
          chapter: sq.chapter || '',
          lesson: sq.lesson || '',
          yccd: sq.yccd || '',
          competency: sq.competency || '',
          level: (sq.level as CognitiveLevel) || 'know',
          type: (sq.type as QuestionType) || 'single_choice',
          stem: sq.stem || '',
          image: sq.image || undefined,
          points: Number(sq.points) || 0.25,
          explanation: sol?.explanation || sq.explanation || '',
          status: sq.status || 'approved',
          author: sq.author || 'Tổ Chuyên môn THCS Tây Đô',
          version: Number(sq.version) || 1,
          options: formattedOptions.length > 0 ? formattedOptions : undefined,
          correctAnswer: sol?.correct_answer || sq.correctAnswer || undefined,
          subItems: formattedSubItems.length > 0 ? formattedSubItems : undefined,
          acceptedAnswers: sol?.accepted_answers || sq.acceptedAnswers || undefined,
          isNumericTolerance: Boolean(sq.is_numeric_tolerance ?? sq.isNumericTolerance),
          numericTolerance: sq.numeric_tolerance ?? sq.numericTolerance,
          rubric: sol?.rubric || sq.rubric || undefined,
          sampleAnswer: sol?.sample_answer || sq.sample_answer || sq.sampleAnswer || undefined,
          examSection: sq.exam_section || sq.examSection
        };
      });

      setSupabaseQuestions(normalizedList);
    } catch {
      // Giữ câu hỏi cục bộ nếu mạng gián đoạn
    } finally {
      setLoadingBank(false);
    }
  }, [user, currentRole]);

  useEffect(() => {
    loadSupabaseQuestions();
  }, [loadSupabaseQuestions]);

  const allQuestions = useMemo<Question[]>(() => {
    const map = new Map<string, Question>();
    (localQuestions || []).forEach(q => map.set(q.id, q));
    supabaseQuestions.forEach(q => map.set(q.id, q));
    return Array.from(map.values());
  }, [localQuestions, supabaseQuestions]);

  // =========================================================================
  // 2. TRẠNG THÁI 2 BƯỚC: SOẠN & LƯU ĐỀ -> GIAO BÀI CHO LỚP
  // =========================================================================
  const [workflowStep, setWorkflowStep] = useState<'compose' | 'assign'>('compose');
  const [selectedExistingExamId, setSelectedExistingExamId] = useState<string>('');

  // Thông số đề đang soạn (Bước 1 — KHÔNG chứa Lớp nhận bài)
  const [draftGrade, setDraftGrade] = useState<Grade>(() =>
    EXAM_GRADES.includes(contextGrade) ? contextGrade : '8'
  );
  const [draftSubject, setDraftSubject] = useState<SubjectId>(() =>
    contextSubject && contextSubject !== 'other' ? contextSubject : 'math'
  );
  const [draftPeriod, setDraftPeriod] = useState<ExamPeriod>(contextPeriod || 'mid1');
  const [selectedTextbook, setSelectedTextbook] = useState<string>('');
  const [duration, setDuration] = useState<number>(45);

  const titleEditedRef = useRef<boolean>(false);
  const codeEditedRef = useRef<boolean>(false);
  const [examTitle, setExamTitle] = useState<string>(() =>
    buildDefaultExamTitle(
      EXAM_GRADES.includes(contextGrade) ? contextGrade : '8',
      contextSubject && contextSubject !== 'other' ? contextSubject : 'math',
      contextPeriod || 'mid1'
    )
  );
  const [examCode, setExamCode] = useState<string>(() =>
    buildDefaultExamCode(
      EXAM_GRADES.includes(contextGrade) ? contextGrade : '8',
      contextSubject && contextSubject !== 'other' ? contextSubject : 'math',
      contextPeriod || 'mid1'
    )
  );

  // Tự cập nhật tiêu đề & mã đề mặc định nếu giáo viên chưa tự gõ
  useEffect(() => {
    if (!titleEditedRef.current) {
      setExamTitle(buildDefaultExamTitle(draftGrade, draftSubject, draftPeriod));
    }
    if (!codeEditedRef.current) {
      setExamCode(buildDefaultExamCode(draftGrade, draftSubject, draftPeriod));
    }
  }, [draftGrade, draftSubject, draftPeriod]);

  // Bộ môn theo khối hiện tại trong dự án
  const subjectOptionsForGrade = useMemo(
    () => getSubjectsForGrade(draftGrade),
    [draftGrade]
  );

  // Danh sách bộ sách có trong dữ liệu của (Khối, Môn)
  const availableTextbooks = useMemo(
    () => getAvailableTextbooksForCombo(draftGrade, draftSubject, allQuestions),
    [draftGrade, draftSubject, allQuestions]
  );
  const showTextbookSelector = availableTextbooks.length > 1;

  useEffect(() => {
    if (!showTextbookSelector) {
      setSelectedTextbook(availableTextbooks[0] || '');
      return;
    }
    if (
      !selectedTextbook ||
      (selectedTextbook !== 'all' && !availableTextbooks.includes(selectedTextbook))
    ) {
      setSelectedTextbook(availableTextbooks[0] || 'all');
    }
  }, [availableTextbooks, showTextbookSelector, selectedTextbook]);

  // =========================================================================
  // 3. CỘT PHẠM VI ĐỀ (DANH MỤC CHƯƠNG / CHỦ ĐỀ / BÀI HỌC)
  // =========================================================================
  const activeTextbookFilter = showTextbookSelector ? selectedTextbook : '';

  const scopeCatalog = useMemo(
    () =>
      buildExamScopeCatalog({
        grade: draftGrade,
        subject: draftSubject,
        textbook: activeTextbookFilter,
        yccdCatalog
      }),
    [draftGrade, draftSubject, activeTextbookFilter, yccdCatalog]
  );

  // Tập câu hỏi đủ điều kiện cho (Khối, Môn, Bộ sách) để đếm số câu ở từng chương/bài
  const eligibleQuestionsForCombo = useMemo(() => {
    const normGrade = normalizeGrade(draftGrade);
    const normTb = normalizeTextbookName(activeTextbookFilter);
    return allQuestions.filter(q => {
      if (!isQuestionApprovedForExam(q)) return false;
      if (normalizeGrade(q.grade) !== normGrade) return false;
      if (!isQuestionInSubject(q, draftSubject)) return false;
      if (showTextbookSelector && normTb && normTb !== 'all') {
        if (normalizeTextbookName(q.textbook) !== normTb) return false;
      }
      return true;
    });
  }, [allQuestions, draftGrade, draftSubject, showTextbookSelector, activeTextbookFilter]);

  const catalogMatchIndex = useMemo(
    () => buildCatalogMatchIndex(scopeCatalog, eligibleQuestionsForCombo),
    [scopeCatalog, eligibleQuestionsForCombo]
  );

  const [scopeSearch, setScopeSearch] = useState<string>('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(() => new Set());
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(() => new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());
  const [presetBannerMsg, setPresetBannerMsg] = useState<string | null>(null);
  const [presetVersion, setPresetVersion] = useState<number>(0);

  const activePeriodPreset = useMemo(() => {
    void presetVersion;
    return getPeriodScopePreset(draftGrade, draftSubject, activeTextbookFilter, draftPeriod);
  }, [draftGrade, draftSubject, activeTextbookFilter, draftPeriod, presetVersion]);

  const scopeContextKey = `${draftGrade}::${draftSubject}::${activeTextbookFilter}::${draftPeriod}`;
  const prevScopeContextKeyRef = useRef<string>('');

  // Reset phạm vi và áp dụng gợi ý đợt kiểm tra CHỈ KHI đổi tổ hợp (Khối, Môn, Bộ sách, Đợt) và giáo viên đã cấu hình trước
  useEffect(() => {
    if (prevScopeContextKeyRef.current === scopeContextKey) {
      return;
    }
    prevScopeContextKeyRef.current = scopeContextKey;

    const validGroupIds = new Set(scopeCatalog.groups.map(g => g.id));
    const validLessonIds = new Set(scopeCatalog.groups.flatMap(g => g.lessons.map(l => l.id)));

    if (activePeriodPreset && scopeCatalog.hasCatalog) {
      const nextGroups = new Set(activePeriodPreset.groupIds.filter(id => validGroupIds.has(id)));
      const nextLessons = new Set(
        activePeriodPreset.lessonIds.filter(id => validLessonIds.has(id))
      );
      setSelectedGroupIds(nextGroups);
      setSelectedLessonIds(nextLessons);
      const periodName =
        EXAM_PERIOD_META.find(p => p.id === draftPeriod)?.label || 'đợt kiểm tra';
      setPresetBannerMsg(
        `Đang áp dụng phạm vi gợi ý bạn đã cấu hình cho ${periodName}. Bạn vẫn có thể chọn tự do toàn bộ danh mục.`
      );
    } else {
      setSelectedGroupIds(new Set());
      setSelectedLessonIds(new Set());
      setPresetBannerMsg(null);
    }

    // Mặc định mở các chương có sẵn câu hỏi (hoặc 2 chương đầu tiên) để giáo viên thấy rõ cấu trúc
    const initialExpanded = new Set<string>();
    scopeCatalog.groups.forEach((g, idx) => {
      const count = catalogMatchIndex.groupQuestionIds.get(g.id)?.size || 0;
      if (count > 0 || idx < 2) {
        initialExpanded.add(g.id);
      }
    });
    setExpandedGroupIds(initialExpanded);
  }, [scopeContextKey, scopeCatalog, activePeriodPreset, draftPeriod, catalogMatchIndex]);

  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleSelectGroup = (groupId: string) => {
    const group = scopeCatalog.groups.find(g => g.id === groupId);
    if (!group) return;
    setSelectedGroupIds(prevGroups => {
      const nextGroups = new Set(prevGroups);
      const nextLessons = new Set(selectedLessonIds);
      if (nextGroups.has(groupId)) {
        nextGroups.delete(groupId);
        group.lessons.forEach(l => nextLessons.delete(l.id));
      } else {
        nextGroups.add(groupId);
        group.lessons.forEach(l => nextLessons.delete(l.id));
      }
      setSelectedLessonIds(nextLessons);
      return nextGroups;
    });
  };

  const toggleSelectLesson = (groupId: string, lessonId: string) => {
    const group = scopeCatalog.groups.find(g => g.id === groupId);
    if (!group) return;
    if (selectedGroupIds.has(groupId)) {
      // Đang chọn cả chương -> bỏ chọn chương và giữ các bài còn lại
      setSelectedGroupIds(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
      setSelectedLessonIds(prev => {
        const next = new Set(prev);
        group.lessons.forEach(l => {
          if (l.id !== lessonId) next.add(l.id);
          else next.delete(l.id);
        });
        return next;
      });
      return;
    }

    setSelectedLessonIds(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const handleSavePeriodSuggestion = () => {
    savePeriodScopePreset(
      draftGrade,
      draftSubject,
      activeTextbookFilter,
      draftPeriod,
      Array.from(selectedGroupIds),
      Array.from(selectedLessonIds)
    );
    setPresetVersion(v => v + 1);
    const periodName = EXAM_PERIOD_META.find(p => p.id === draftPeriod)?.label || '';
    setPresetBannerMsg(`Đã lưu gợi ý phạm vi cho đợt ${periodName}.`);
  };

  const handleClearPeriodSuggestion = () => {
    clearPeriodScopePreset(draftGrade, draftSubject, activeTextbookFilter, draftPeriod);
    setPresetVersion(v => v + 1);
    setPresetBannerMsg(null);
  };

  // Lọc cây danh mục theo ô tìm kiếm phạm vi
  const filteredCatalogGroups = useMemo(() => {
    const term = scopeSearch.trim().toLowerCase();
    if (!term) return scopeCatalog.groups;
    return scopeCatalog.groups
      .map(g => {
        const groupMatches = g.label.toLowerCase().includes(term);
        const matchingLessons = g.lessons.filter(l => l.label.toLowerCase().includes(term));
        if (groupMatches) return g;
        if (matchingLessons.length > 0) {
          return { ...g, lessons: matchingLessons };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [scopeCatalog.groups, scopeSearch]);

  // =========================================================================
  // 4. CỘT NGÂN HÀNG CÂU HỎI & CỘT ĐỀ ĐANG SOẠN (KHỞI TẠO TRỐNG!)
  // =========================================================================
  const [bankSearch, setBankSearch] = useState<string>('');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | QuestionType>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | CognitiveLevel>('all');

  // ĐỀ ĐANG SOẠN: Luôn bắt đầu TRỐNG — chỉ chứa câu giáo viên chủ động thêm vào!
  const [draftQuestionIds, setDraftQuestionIds] = useState<string[]>([]);
  const [lockedIds, setLockedIds] = useState<Record<string, boolean>>({});
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Xác nhận khi đổi Khối / Môn / Bộ sách lúc đề đang soạn đã có câu
  const [pendingContextChange, setPendingContextChange] =
    useState<PendingContextChange | null>(null);

  const questionById = useMemo(() => {
    const map = new Map<string, Question>();
    allQuestions.forEach(q => map.set(q.id, q));
    return map;
  }, [allQuestions]);

  const draftQuestions = useMemo(
    () =>
      draftQuestionIds
        .map(id => questionById.get(id))
        .filter((q): q is Question => Boolean(q)),
    [draftQuestionIds, questionById]
  );

  const draftTotalPoints = useMemo(
    () =>
      parseFloat(
        draftQuestions.reduce((sum, q) => sum + (Number(q.points) || 0), 0).toFixed(2)
      ),
    [draftQuestions]
  );

  const filteredBankQuestions = useMemo(
    () =>
      filterQuestionsForExamAuthoring({
        questions: allQuestions,
        grade: draftGrade,
        subject: draftSubject,
        textbook: activeTextbookFilter,
        showTextbookFilter: showTextbookSelector,
        catalog: scopeCatalog,
        matchIndex: catalogMatchIndex,
        selectedGroupIds,
        selectedLessonIds,
        questionTypeFilter,
        levelFilter,
        searchTerm: bankSearch
      }),
    [
      allQuestions,
      draftGrade,
      draftSubject,
      activeTextbookFilter,
      showTextbookSelector,
      scopeCatalog,
      catalogMatchIndex,
      selectedGroupIds,
      selectedLessonIds,
      questionTypeFilter,
      levelFilter,
      bankSearch
    ]
  );

  const applyContextSwitch = (change: PendingContextChange) => {
    setDraftQuestionIds([]);
    setLockedIds({});
    setSelectedGroupIds(new Set());
    setSelectedLessonIds(new Set());
    setBankSearch('');
    setScopeSearch('');
    setActionError(null);
    setActionSuccessMsg(null);

    if (change.type === 'grade') {
      setDraftGrade(change.nextGrade);
    } else if (change.type === 'subject') {
      setDraftSubject(change.nextSubject);
      setSelectedTextbook('');
    } else if (change.type === 'textbook') {
      setSelectedTextbook(change.nextTextbook);
    }
    setPendingContextChange(null);
  };

  const requestGradeChange = (nextGrade: Grade) => {
    if (nextGrade === draftGrade) return;
    if (draftQuestionIds.length > 0) {
      setPendingContextChange({ type: 'grade', nextGrade });
      return;
    }
    applyContextSwitch({ type: 'grade', nextGrade });
  };

  const requestSubjectChange = (nextSubject: SubjectId) => {
    if (nextSubject === draftSubject) return;
    if (draftQuestionIds.length > 0) {
      setPendingContextChange({ type: 'subject', nextSubject });
      return;
    }
    applyContextSwitch({ type: 'subject', nextSubject });
  };

  const requestTextbookChange = (nextTextbook: string) => {
    if (nextTextbook === selectedTextbook) return;
    if (draftQuestionIds.length > 0) {
      setPendingContextChange({ type: 'textbook', nextTextbook });
      return;
    }
    applyContextSwitch({ type: 'textbook', nextTextbook });
  };

  const toggleQuestionInDraft = (qId: string) => {
    setDraftQuestionIds(prev =>
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const moveDraftQuestion = (index: number, direction: -1 | 1) => {
    setDraftQuestionIds(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const toggleLock = (id: string) => {
    setLockedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddAllFilteredToDraft = () => {
    setDraftQuestionIds(prev => {
      const next = new Set(prev);
      filteredBankQuestions.forEach(q => next.add(q.id));
      return Array.from(next);
    });
  };

  // =========================================================================
  // 5. LƯU ĐỀ (BƯỚC 1) & GIAO BÀI CHO LỚP (BƯỚC 2)
  // =========================================================================
  const [targetClassId, setTargetClassId] = useState<string>(classes[0]?.id || '');
  const [roundLabel, setRoundLabel] = useState<string>('Đợt 1');
  const [openTimeLocal, setOpenTimeLocal] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date())
  );
  const [closeTimeLocal, setCloseTimeLocal] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 14 * 24 * 3600 * 1000))
  );
  const [attemptsAllowed, setAttemptsAllowed] = useState<number>(1);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [showSolutionAfterSubmit, setShowSolutionAfterSubmit] = useState<boolean>(true);
  const [isComputerLabMode, setIsComputerLabMode] = useState<boolean>(false);

  const [publishRequestId, setPublishRequestId] = useState<string>(() => generateRequestUuid());
  const [examRequestId, setExamRequestId] = useState<string>(() => generateRequestUuid());
  const [isSavingExam, setIsSavingExam] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const assignableExams = useMemo(() => {
    if (isUsingDemoAssignmentsData) return exams;
    return exams.filter(ex => {
      if (!isValidUuid(ex.id)) return false;
      if (currentRole === 'admin') return true;
      return !ex.authorId || ex.authorId === user?.id;
    });
  }, [exams, isUsingDemoAssignmentsData, currentRole, user?.id]);

  useEffect(() => {
    if (assignableExams.length === 0) {
      setSelectedExistingExamId('');
      return;
    }
    if (!assignableExams.some(e => e.id === selectedExistingExamId)) {
      setSelectedExistingExamId(assignableExams[0].id);
    }
  }, [assignableExams, selectedExistingExamId]);

  const selectedSavedExam: Exam | null =
    assignableExams.find(e => e.id === selectedExistingExamId) || null;

  const isSelectedExamAssigned = useMemo(() => {
    if (!selectedSavedExam) return false;
    return assignments.some(a => a.examId === selectedSavedExam.id);
  }, [selectedSavedExam, assignments]);

  // Lọc Lớp nhận bài theo phân công giảng dạy (Lớp – Môn) đang hoạt động của giáo viên
  const eligibleClasses = useMemo(() => {
    if (isUsingDemoAssignmentsData || currentRole === 'admin') {
      return classes;
    }
    if (!selectedSavedExam || !user?.id) {
      return [];
    }
    if (teachingSchemaWarning && teachingAssignments.length === 0) {
      return classes.filter(c => !c.teacherId || c.teacherId === user.id);
    }
    const resolvedTarget = resolveCanonicalSubject(selectedSavedExam.subject);
    const targetSubj =
      resolvedTarget.ok && resolvedTarget.subjectId
        ? resolvedTarget.subjectId
        : String(selectedSavedExam.subject || '').trim().toLowerCase();

    return classes.filter(cls =>
      teachingAssignments.some(ta => {
        if (
          ta.teacherId !== user.id ||
          ta.classId !== cls.id ||
          ta.status !== 'active' ||
          ta.needsSubjectCompletion ||
          !ta.subject ||
          (cls.schoolYear && ta.schoolYear !== cls.schoolYear)
        ) {
          return false;
        }
        const resolvedTa = resolveCanonicalSubject(ta.subject);
        const taSubj =
          resolvedTa.ok && resolvedTa.subjectId
            ? resolvedTa.subjectId
            : String(ta.subject).trim().toLowerCase();
        return taSubj === targetSubj;
      })
    );
  }, [
    classes,
    teachingAssignments,
    teachingSchemaWarning,
    selectedSavedExam,
    isUsingDemoAssignmentsData,
    currentRole,
    user?.id
  ]);

  useEffect(() => {
    if (eligibleClasses.length === 0) {
      setTargetClassId('');
      return;
    }
    if (!eligibleClasses.some(c => c.id === targetClassId)) {
      setTargetClassId(eligibleClasses[0].id);
    }
  }, [eligibleClasses, targetClassId]);

  const selectedClass = eligibleClasses.find(c => c.id === targetClassId) || null;

  const classAssignments = useMemo(() => {
    if (!targetClassId) return [];
    return assignments.filter(a => a.classId === targetClassId);
  }, [assignments, targetClassId]);

  // Lưu đề kiểm tra ở Bước 1, sau đó chuyển sang Bước 2 để chọn "Lớp nhận bài"
  const handleSaveExamDraft = async () => {
    if (isSavingExam) return;
    setActionError(null);
    setActionSuccessMsg(null);

    if (!examTitle.trim() || !examCode.trim()) {
      setActionError('Vui lòng nhập đầy đủ Tên bài kiểm tra và Mã đề thi.');
      return;
    }
    if (draftQuestions.length === 0) {
      setActionError('Đề đang soạn chưa có câu hỏi nào. Hãy chọn ít nhất 1 câu từ Ngân hàng câu hỏi.');
      return;
    }

    const lockedQuestionIds = draftQuestionIds.filter(id => lockedIds[id]);

    setIsSavingExam(true);
    try {
      const res = await saveExamAsync({
        newExamDraft: {
          code: examCode.trim().toUpperCase(),
          title: examTitle.trim(),
          grade: draftGrade,
          subject: draftSubject,
          period: draftPeriod,
          durationMinutes: duration,
          questions: draftQuestions,
          lockedQuestionIds,
          totalPoints: draftTotalPoints
        },
        examRequestId
      });

      if (!res.success || !res.exam) {
        setActionError(res.error || 'Không thể lưu đề kiểm tra. Vui lòng thử lại.');
        return;
      }

      setSelectedExistingExamId(res.exam.id);
      setExamRequestId(generateRequestUuid());
      setActionSuccessMsg(
        res.isDemo
          ? `Đã lưu đề "${res.exam.title}" (Khối ${res.exam.grade} – ${getSubjectOption(res.exam.subject).name}). Hãy chọn Lớp nhận bài ở bước bên dưới.`
          : `Đã lưu đề "${res.exam.title}" (Khối ${res.exam.grade} – ${getSubjectOption(res.exam.subject).name}) lên Supabase. Hãy chọn Lớp nhận bài để giao.`
      );
      setWorkflowStep('assign');
    } finally {
      setIsSavingExam(false);
    }
  };

  // Giao đề đã lưu cho lớp ở Bước 2
  const handlePublishAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;

    setActionError(null);
    setActionSuccessMsg(null);

    if (!selectedSavedExam) {
      setActionError('Vui lòng chọn một đề kiểm tra đã lưu trước khi giao bài.');
      return;
    }
    if (!selectedClass) {
      setActionError('Vui lòng chọn hoặc tạo lớp nhận bài.');
      return;
    }

    const openDate = new Date(openTimeLocal);
    const closeDate = new Date(closeTimeLocal);
    if (Number.isNaN(openDate.getTime()) || Number.isNaN(closeDate.getTime())) {
      setActionError('Thời gian mở đề hoặc hạn nộp không hợp lệ.');
      return;
    }
    if (closeDate.getTime() <= openDate.getTime()) {
      setActionError('Hạn nộp bài phải sau thời gian mở đề.');
      return;
    }
    if (closeDate.getTime() <= Date.now()) {
      setActionError('Hạn nộp bài phải lớn hơn thời điểm hiện tại.');
      return;
    }

    setIsPublishing(true);
    try {
      const res = await publishExamAssignmentAsync({
        targetClass: selectedClass,
        existingExam: selectedSavedExam,
        assignmentSettings: {
          openTimeIso: openDate.toISOString(),
          closeTimeIso: closeDate.toISOString(),
          durationMinutes: duration || selectedSavedExam.durationMinutes || 45,
          attemptsAllowed: Math.max(1, attemptsAllowed),
          allowReview: true,
          showSolutionAfterSubmit,
          shuffleQuestions,
          shuffleOptions,
          isComputerLabMode,
          roundLabel: roundLabel.trim() || 'Đợt 1'
        },
        publishRequestId,
        examRequestId
      });

      if (!res.success || !res.assignment) {
        setActionError(res.error || 'Không thể giao bài. Vui lòng thử lại.');
        return;
      }

      setActionSuccessMsg(
        res.isDemo
          ? `Giao bài thành công (Demo cục bộ): "${res.assignment.examTitle}" → lớp ${res.assignment.className}!`
          : `Giao bài thành công! Đề "${res.assignment.examTitle}" đã đồng bộ lên Supabase cho lớp ${res.assignment.className}.`
      );
      setPublishRequestId(generateRequestUuid());
      setRoundLabel(prev => advanceRoundLabel(prev));
    } finally {
      setIsPublishing(false);
    }
  };

  const draftStats = useMemo(() => {
    const byLevel: Record<CognitiveLevel, number> = { know: 0, understand: 0, apply: 0 };
    const byType: Record<QuestionType, number> = {
      single_choice: 0,
      true_false_group: 0,
      short_answer: 0,
      essay: 0
    };
    for (const q of draftQuestions) {
      if (byLevel[q.level] !== undefined) byLevel[q.level]++;
      if (byType[q.type] !== undefined) byType[q.type]++;
    }
    return { byLevel, byType };
  }, [draftQuestions]);

  const hasScopeSelection = selectedGroupIds.size > 0 || selectedLessonIds.size > 0;
  const activeSubjectInfo = getSubjectOption(draftSubject);

  return (
    <div className="space-y-5 font-edtech">
      {/* Header & Step Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#102C54] flex items-center gap-2.5">
            <FileEdit className="w-6 h-6 text-[#1769F4] shrink-0" />
            <span>Tạo đề kiểm tra &amp; Giao bài theo lớp</span>
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Chọn khối, môn và phạm vi từ danh mục chuẩn để soạn đề; sau khi lưu đề mới chọn lớp nhận bài.
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {isUsingDemoAssignmentsData ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                <MonitorSmartphone className="w-3.5 h-3.5 shrink-0" />
                <span>Chế độ Demo cục bộ (Lưu trên trình duyệt này)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0B6E4F] bg-[#ECFDF7] border border-[#12A879]/30 px-2.5 py-0.5 rounded-md">
                <Cloud className="w-3.5 h-3.5 shrink-0" />
                <span>Đồng bộ trực tiếp lên Supabase</span>
              </span>
            )}
            {loadingBank && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#1769F4] font-semibold">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Đang đồng bộ ngân hàng câu hỏi...</span>
              </span>
            )}
          </div>
        </div>

        {/* 2-Step Workflow Switcher */}
        <div className="inline-flex bg-[#EAF3FF] p-1 rounded-xl border border-[#C7DCFA] self-start lg:self-auto">
          <button
            type="button"
            onClick={() => {
              setWorkflowStep('compose');
              setActionError(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              workflowStep === 'compose'
                ? 'bg-[#1769F4] text-white shadow-xs'
                : 'text-[#102C54] hover:bg-white'
            }`}
          >
            <span>1. Soạn đề kiểm tra</span>
            {draftQuestions.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                  workflowStep === 'compose' ? 'bg-white/20 text-white' : 'bg-[#EAF3FF] text-[#1769F4]'
                }`}
              >
                {draftQuestions.length} câu
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setWorkflowStep('assign');
              setActionError(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
              workflowStep === 'assign'
                ? 'bg-[#1769F4] text-white shadow-xs'
                : 'text-[#102C54] hover:bg-white'
            }`}
          >
            <span>2. Giao bài cho lớp ({assignableExams.length})</span>
          </button>
        </div>
      </div>

      {/* Demo Warning Banner */}
      {isUsingDemoAssignmentsData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Đang ở chế độ Demo cục bộ</p>
              <p className="text-amber-800 mt-0.5">
                Đề thi và bài giao ở chế độ này chỉ lưu trên trình duyệt hiện tại. Đăng nhập tài khoản Giáo viên Supabase để giao bài tới học sinh.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0 whitespace-nowrap cursor-pointer"
          >
            Đăng nhập Supabase
          </button>
        </div>
      )}

      {/* Alerts */}
      {actionError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-start justify-between gap-3 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Thao tác chưa hoàn tất</p>
              <p className="text-xs text-red-800 mt-0.5">{actionError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-bold underline shrink-0 whitespace-nowrap cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {actionSuccessMsg && (
        <div
          role="status"
          className="p-3.5 bg-[#ECFDF7] border border-[#12A879]/30 text-[#0B6E4F] rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold"
        >
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 text-[#12A879] shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="text-xs underline shrink-0 whitespace-nowrap cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* BƯỚC 1: SOẠN & LƯU ĐỀ KIỂM TRA (KHÔNG CÓ CHỌN LỚP NHẬN BÀI Ở ĐÂY)     */}
      {/* ===================================================================== */}
      {workflowStep === 'compose' && (
        <div className="space-y-4">
          {/* Thanh thông số đầu màn hình soạn đề */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label
                  htmlFor="exam-grade-select"
                  className="block text-xs font-bold text-[#102C54] mb-1"
                >
                  Khối lớp:
                </label>
                <select
                  id="exam-grade-select"
                  value={draftGrade}
                  onChange={e => requestGradeChange(e.target.value as Grade)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl bg-[#F6F9FD] font-bold text-[#102C54] focus:outline-none focus:border-[#1769F4]"
                >
                  {EXAM_GRADES.map(g => (
                    <option key={g} value={g}>
                      Khối {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="exam-subject-select"
                  className="block text-xs font-bold text-[#102C54] mb-1"
                >
                  Môn học:
                </label>
                <select
                  id="exam-subject-select"
                  value={draftSubject}
                  onChange={e => requestSubjectChange(e.target.value as SubjectId)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl bg-[#F6F9FD] font-bold text-[#102C54] focus:outline-none focus:border-[#1769F4]"
                >
                  {subjectOptionsForGrade.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {showTextbookSelector && (
                <div>
                  <label
                    htmlFor="exam-textbook-select"
                    className="block text-xs font-bold text-[#102C54] mb-1"
                  >
                    Bộ sách:
                  </label>
                  <select
                    id="exam-textbook-select"
                    value={selectedTextbook}
                    onChange={e => requestTextbookChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl bg-[#F6F9FD] font-semibold text-[#102C54] focus:outline-none focus:border-[#1769F4]"
                  >
                    {availableTextbooks.map(tb => (
                      <option key={tb} value={tb}>
                        {tb}
                      </option>
                    ))}
                    <option value="all">Tất cả bộ sách</option>
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="exam-period-select"
                  className="block text-xs font-bold text-[#102C54] mb-1"
                >
                  Đợt kiểm tra:
                </label>
                <select
                  id="exam-period-select"
                  value={draftPeriod}
                  onChange={e => setDraftPeriod(e.target.value as ExamPeriod)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#102C54] focus:outline-none focus:border-[#1769F4]"
                >
                  {EXAM_PERIOD_META.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="exam-duration-select"
                  className="block text-xs font-bold text-[#102C54] mb-1"
                >
                  Thời lượng làm bài:
                </label>
                <select
                  id="exam-duration-select"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#102C54] focus:outline-none focus:border-[#1769F4]"
                >
                  <option value={15}>15 phút (Thường xuyên)</option>
                  <option value={45}>45 phút (1 tiết)</option>
                  <option value={60}>60 phút (Giữa / Cuối kỳ)</option>
                  <option value={90}>90 phút (Khảo sát)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8">
                <label
                  htmlFor="exam-title-input"
                  className="block text-xs font-bold text-[#102C54] mb-1"
                >
                  Tên bài kiểm tra:
                </label>
                <input
                  id="exam-title-input"
                  type="text"
                  value={examTitle}
                  onChange={e => {
                    titleEditedRef.current = true;
                    setExamTitle(e.target.value);
                  }}
                  placeholder="Ví dụ: Kiểm tra Giữa kỳ I – Toán 8"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl text-[#102C54] focus:outline-none focus:border-[#1769F4]"
                />
              </div>
              <div className="md:col-span-4">
                <label
                  htmlFor="exam-code-input"
                  className="block text-xs font-bold text-[#102C54] mb-1"
                >
                  Mã đề thi:
                </label>
                <input
                  id="exam-code-input"
                  type="text"
                  value={examCode}
                  onChange={e => {
                    codeEditedRef.current = true;
                    setExamCode(e.target.value);
                  }}
                  placeholder="VD: TOAN8-GK1-01"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl font-mono uppercase text-[#102C54] focus:outline-none focus:border-[#1769F4]"
                />
              </div>
            </div>
          </div>

          {/* 3 CỘT SOẠN ĐỀ: PHẠM VI ĐỀ | NGÂN HÀNG CÂU HỎI | ĐỀ ĐANG SOẠN */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* CỘT 1: PHẠM VI ĐỀ */}
            <section
              aria-label="Phạm vi đề"
              className="xl:col-span-4 bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-xs flex flex-col space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-[#102C54] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#1769F4] shrink-0" />
                    <span>Phạm vi đề</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {activeSubjectInfo.name} – Khối {draftGrade}
                    {showTextbookSelector && selectedTextbook && selectedTextbook !== 'all'
                      ? ` • ${selectedTextbook}`
                      : ''}
                  </p>
                </div>

                {scopeCatalog.hasCatalog && (
                  <div className="flex items-center gap-2 text-[11px] font-bold shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroupIds(new Set(scopeCatalog.groups.map(g => g.id)))
                      }
                      className="text-[#1769F4] hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Mở hết
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setExpandedGroupIds(new Set())}
                      className="text-slate-500 hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Thu gọn
                    </button>
                  </div>
                )}
              </div>

              {scopeCatalog.hasCatalog && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={scopeSearch}
                    onChange={e => setScopeSearch(e.target.value)}
                    placeholder="Tìm chương, chủ đề hoặc bài học..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F0] rounded-xl bg-[#F6F9FD] focus:outline-none focus:border-[#1769F4]"
                  />
                </div>
              )}

              {scopeCatalog.hasCatalog && (presetBannerMsg || hasScopeSelection) && (
                <div className="p-2.5 rounded-xl bg-[#EAF3FF] border border-[#C7DCFA] text-[11px] text-[#102C54] space-y-1.5">
                  {presetBannerMsg && <p className="leading-snug">{presetBannerMsg}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    {hasScopeSelection && (
                      <>
                        <button
                          type="button"
                          onClick={handleSavePeriodSuggestion}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#C7DCFA] text-[#1769F4] font-bold hover:bg-[#EAF3FF] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Bookmark className="w-3 h-3 shrink-0" />
                          <span>
                            Lưu gợi ý{' '}
                            {EXAM_PERIOD_META.find(p => p.id === draftPeriod)?.label || ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGroupIds(new Set());
                            setSelectedLessonIds(new Set());
                          }}
                          className="px-2 py-1 rounded-lg text-slate-600 hover:bg-white font-semibold tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Bỏ chọn ({selectedGroupIds.size} chương, {selectedLessonIds.size} bài)
                        </button>
                      </>
                    )}
                    {activePeriodPreset && (
                      <button
                        type="button"
                        onClick={handleClearPeriodSuggestion}
                        className="px-2 py-1 rounded-lg text-red-700 hover:bg-red-50 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Xóa gợi ý đợt
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!scopeCatalog.hasCatalog ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-[#C7DCFA] bg-[#EAF3FF]/60 space-y-2">
                  <BookOpen className="w-7 h-7 text-[#1769F4] mx-auto opacity-80" />
                  <p className="text-xs font-bold text-[#102C54]">{NO_CATALOG_MESSAGE}</p>
                  <p className="text-[11px] text-slate-500">
                    Bạn vẫn có thể xem và chọn các câu hỏi đã duyệt của môn {activeSubjectInfo.name} Khối {draftGrade} ở cột Ngân hàng câu hỏi.
                  </p>
                </div>
              ) : filteredCatalogGroups.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500 bg-[#F6F9FD] rounded-xl border border-[#E2E8F0]">
                  Không tìm thấy chương hoặc bài học khớp từ khóa &quot;{scopeSearch}&quot;.
                </div>
              ) : (
                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                  {filteredCatalogGroups.map((group, idx) => {
                    const prevGroup = idx > 0 ? filteredCatalogGroups[idx - 1] : null;
                    const showVolumeDivider =
                      scopeCatalog.groups.some(g => g.volume === 2) &&
                      (!prevGroup || prevGroup.volume !== group.volume);
                    const isSearching = scopeSearch.trim().length > 0;
                    const isExpanded = isSearching || expandedGroupIds.has(group.id);
                    const isGroupChecked = selectedGroupIds.has(group.id);
                    const hasPartialLessons =
                      !isGroupChecked && group.lessons.some(l => selectedLessonIds.has(l.id));
                    const groupCount = catalogMatchIndex.groupQuestionIds.get(group.id)?.size ?? 0;

                    return (
                      <React.Fragment key={group.id}>
                        {showVolumeDivider && (
                          <div className="pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-wider text-[#1769F4]">
                            Tập {group.volume}
                          </div>
                        )}
                        <div
                          className={`rounded-xl border transition-colors ${
                            isGroupChecked || hasPartialLessons
                              ? 'border-[#1769F4] bg-[#EAF3FF]/70'
                              : 'border-[#E2E8F0] bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-2 p-2.5">
                            <button
                              type="button"
                              onClick={() => toggleExpandGroup(group.id)}
                              className="p-0.5 text-slate-500 hover:text-[#102C54] mt-0.5 shrink-0 cursor-pointer"
                              aria-label={isExpanded ? `Thu gọn ${group.label}` : `Mở rộng ${group.label}`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>

                            <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isGroupChecked}
                                ref={el => {
                                  if (el) el.indeterminate = hasPartialLessons;
                                }}
                                onChange={() => toggleSelectGroup(group.id)}
                                className="w-4 h-4 accent-[#1769F4] rounded-sm mt-0.5 shrink-0"
                              />
                              <span className="text-xs font-bold text-[#102C54] leading-snug">
                                {group.label}
                              </span>
                            </label>

                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 tabular-nums ${
                                groupCount > 0
                                  ? 'bg-[#EAF3FF] text-[#1769F4]'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {groupCount} câu
                            </span>
                          </div>

                          {isExpanded && group.lessons.length > 0 && (
                            <div className="border-t border-slate-100 px-2.5 py-2 space-y-1.5 bg-white/80 rounded-b-xl">
                              {group.lessons.map(lesson => {
                                const isLessonChecked =
                                  isGroupChecked || selectedLessonIds.has(lesson.id);
                                const lessonCount =
                                  catalogMatchIndex.lessonQuestionIds.get(lesson.id)?.size ?? 0;

                                return (
                                  <label
                                    key={lesson.id}
                                    className="flex items-start justify-between gap-2 pl-5 pr-1 py-1 rounded-lg hover:bg-[#EAF3FF]/80 cursor-pointer text-xs"
                                  >
                                    <span className="flex items-start gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isLessonChecked}
                                        onChange={() => toggleSelectLesson(group.id, lesson.id)}
                                        className="w-3.5 h-3.5 accent-[#1769F4] rounded-sm mt-0.5 shrink-0"
                                      />
                                      <span className="text-slate-700 leading-snug">
                                        {lesson.label}
                                      </span>
                                    </span>
                                    <span
                                      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0 tabular-nums ${
                                        lessonCount > 0
                                          ? 'bg-[#ECFDF7] text-[#0B6E4F]'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {lessonCount} câu
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </section>

            {/* CỘT 2: NGÂN HÀNG CÂU HỎI */}
            <section
              aria-label="Ngân hàng câu hỏi"
              className="xl:col-span-4 bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-xs flex flex-col space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-[#102C54]">Ngân hàng câu hỏi</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {hasScopeSelection
                      ? `Đang lọc theo phạm vi đã chọn • Chỉ câu đã duyệt`
                      : `Toàn bộ ${activeSubjectInfo.name} ${draftGrade} • Chỉ câu đã duyệt`}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#1769F4] bg-[#EAF3FF] border border-[#C7DCFA] px-2.5 py-1 rounded-lg shrink-0 tabular-nums">
                  {filteredBankQuestions.length} câu
                </span>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={e => setBankSearch(e.target.value)}
                    placeholder="Tìm mã câu, nội dung câu hỏi..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F0] rounded-xl bg-[#F6F9FD] focus:outline-none focus:border-[#1769F4]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Lọc theo dạng câu"
                    value={questionTypeFilter}
                    onChange={e => setQuestionTypeFilter(e.target.value as 'all' | QuestionType)}
                    className="px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-xl bg-white text-[#102C54]"
                  >
                    <option value="all">Tất cả dạng câu</option>
                    <option value="single_choice">TNKQ 4 lựa chọn</option>
                    <option value="true_false_group">Đúng – Sai nhiều ý</option>
                    <option value="short_answer">Trả lời ngắn</option>
                    <option value="essay">Tự luận</option>
                  </select>
                  <select
                    aria-label="Lọc theo mức độ"
                    value={levelFilter}
                    onChange={e => setLevelFilter(e.target.value as 'all' | CognitiveLevel)}
                    className="px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-xl bg-white text-[#102C54]"
                  >
                    <option value="all">Tất cả mức độ</option>
                    <option value="know">Nhận biết</option>
                    <option value="understand">Thông hiểu</option>
                    <option value="apply">Vận dụng</option>
                  </select>
                </div>

                {filteredBankQuestions.length > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 tabular-nums">
                      Hiển thị {filteredBankQuestions.length} câu đủ điều kiện
                    </span>
                    <button
                      type="button"
                      onClick={handleAddAllFilteredToDraft}
                      className="inline-flex items-center gap-1 font-bold text-[#1769F4] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Thêm tất cả đang lọc</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {filteredBankQuestions.map(q => {
                  const isAdded = draftQuestionIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-xl border transition-all text-xs space-y-2 ${
                        isAdded
                          ? 'border-[#1769F4] bg-[#EAF3FF]/60'
                          : 'border-[#E2E8F0] bg-white hover:border-[#C7DCFA]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#102C54]">
                            <span className="font-mono">[{q.code}]</span>
                            <span className="text-[#0B6E4F] tabular-nums">({q.points}đ)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {QUESTION_TYPE_LABELS[q.type]} • {QUESTION_LEVEL_LABELS[q.level]}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleQuestionInDraft(q.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 inline-flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                            isAdded
                              ? 'bg-[#ECFDF7] text-[#0B6E4F] hover:bg-red-100 hover:text-red-800'
                              : 'bg-[#1769F4] text-white hover:bg-[#1255CC]'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Minus className="w-3 h-3" />
                              <span>Đã thêm</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Thêm vào đề</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-slate-700 line-clamp-3">
                        <MathView content={q.stem} />
                      </div>

                      {(q.chapter || q.lesson) && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {q.chapter}
                          {q.lesson ? ` • ${q.lesson}` : ''}
                        </p>
                      )}
                    </div>
                  );
                })}

                {filteredBankQuestions.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500 bg-[#F6F9FD] rounded-xl border border-[#E2E8F0] space-y-1.5">
                    <p className="font-bold text-[#102C54]">
                      Không có câu hỏi phù hợp với bộ lọc hiện tại
                    </p>
                    <p>
                      Hãy kiểm tra lại phạm vi chương/bài, dạng câu, mức độ hoặc duyệt câu hỏi trong Ngân hàng câu hỏi.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* CỘT 3: ĐỀ ĐANG SOẠN */}
            <section
              aria-label="Đề đang soạn"
              className="xl:col-span-4 bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-xs flex flex-col space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-[#102C54] tabular-nums">
                    Đề đang soạn ({draftQuestions.length} câu)
                  </h3>
                  <p className="text-[11px] text-[#0B6E4F] font-bold mt-0.5 tabular-nums">
                    Tổng điểm: {draftTotalPoints.toFixed(2)} điểm
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={draftQuestions.length === 0}
                    onClick={() => setIsPreviewOpen(true)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#C7DCFA] bg-[#EAF3FF] text-[#102C54] text-xs font-bold hover:bg-blue-100 disabled:opacity-40 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#1769F4]" />
                    <span>Xem trước</span>
                  </button>
                  {draftQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftQuestionIds([]);
                        setLockedIds({});
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      title="Xóa toàn bộ câu khỏi đề đang soạn"
                      aria-label="Xóa toàn bộ câu khỏi đề đang soạn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] bg-[#EAF3FF] p-2 rounded-xl border border-[#C7DCFA] tabular-nums">
                <div>
                  <span className="text-slate-600 block">Nhận biết</span>
                  <b className="text-[#102C54]">{draftStats.byLevel.know} câu</b>
                </div>
                <div>
                  <span className="text-slate-600 block">Thông hiểu</span>
                  <b className="text-[#102C54]">{draftStats.byLevel.understand} câu</b>
                </div>
                <div>
                  <span className="text-slate-600 block">Vận dụng</span>
                  <b className="text-[#102C54]">{draftStats.byLevel.apply} câu</b>
                </div>
              </div>

              <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
                {draftQuestions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-[#F6F9FD] rounded-xl border border-dashed border-slate-300 space-y-1.5">
                    <p className="font-bold text-[#102C54]">Đề đang soạn chưa có câu hỏi</p>
                    <p>
                      Chọn phạm vi ở cột bên trái và bấm <b>&quot;Thêm vào đề&quot;</b> tại cột Ngân hàng câu hỏi.
                    </p>
                  </div>
                ) : (
                  draftQuestions.map((q, idx) => {
                    const isLocked = Boolean(lockedIds[q.id]);
                    return (
                      <div
                        key={q.id}
                        className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F6F9FD] text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-[#102C54] min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-[#1769F4] text-white text-[10px] shrink-0 tabular-nums">
                              Câu {idx + 1}
                            </span>
                            <span className="font-mono truncate">[{q.code}]</span>
                            <span className="text-[#0B6E4F] shrink-0 tabular-nums">({q.points}đ)</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveDraftQuestion(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Chuyển lên"
                              aria-label="Chuyển lên"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDraftQuestion(idx, 1)}
                              disabled={idx === draftQuestions.length - 1}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Chuyển xuống"
                              aria-label="Chuyển xuống"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleLock(q.id)}
                              className={`p-1 rounded cursor-pointer ${
                                isLocked
                                  ? 'text-amber-800 bg-amber-100'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                              title={
                                isLocked
                                  ? 'Đã khóa vị trí không bị xáo trộn'
                                  : 'Khóa vị trí câu này'
                              }
                            >
                              {isLocked ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleQuestionInDraft(q.id)}
                              className="px-1.5 py-0.5 rounded text-red-600 hover:bg-red-50 font-bold whitespace-nowrap cursor-pointer"
                              title="Bỏ khỏi đề"
                            >
                              Bỏ
                            </button>
                          </div>
                        </div>

                        <div className="text-slate-600 line-clamp-2">
                          <MathView content={q.stem} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveExamDraft}
                disabled={isSavingExam || draftQuestions.length === 0}
                className="w-full py-3 bg-[#1769F4] text-white text-sm font-bold rounded-xl shadow-xs hover:bg-[#1255CC] transition-colors flex items-center justify-center gap-2 disabled:opacity-40 whitespace-nowrap cursor-pointer"
              >
                {isSavingExam ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu đề kiểm tra...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu đề &amp; Sang bước giao bài</span>
                  </>
                )}
              </button>
            </section>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* BƯỚC 2: GIAO BÀI CHO LỚP (SAU KHI LƯU ĐỀ — CHỌN LỚP NHẬN BÀI TẠI ĐÂY)  */}
      {/* ===================================================================== */}
      {workflowStep === 'assign' && (
        <div className="space-y-6">
          <form onSubmit={handlePublishAssignment} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <h3 className="text-base font-bold text-[#102C54]">
                  2. Giao đề đã lưu cho lớp học
                </h3>
                <button
                  type="button"
                  onClick={() => setWorkflowStep('compose')}
                  className="text-xs font-bold text-[#1769F4] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại soạn đề mới</span>
                </button>
              </div>

              {/* Chọn đề đã lưu */}
              <div>
                <label
                  htmlFor="saved-exam-select"
                  className="block text-xs font-bold text-[#102C54] mb-1"
                >
                  Đề kiểm tra đã lưu:
                </label>
                {assignableExams.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-[#F6F9FD] border border-[#E2E8F0] text-xs text-slate-600">
                    Chưa có đề kiểm tra nào được lưu. Hãy hoàn tất soạn đề ở Bước 1 và bấm &quot;Lưu đề &amp; Sang bước giao bài&quot;.
                  </div>
                ) : (
                  <>
                    <select
                      id="saved-exam-select"
                      value={selectedExistingExamId}
                      onChange={e => setSelectedExistingExamId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl font-semibold text-[#102C54]"
                    >
                      {assignableExams.map(ex => (
                        <option key={ex.id} value={ex.id}>
                          [{ex.code}] {ex.title} — Khối {ex.grade} •{' '}
                          {getSubjectOption(ex.subject).name} ({ex.questionCount ?? ex.questions.length} câu,{' '}
                          {ex.durationMinutes} phút)
                        </option>
                      ))}
                    </select>
                    {isSelectedExamAssigned && (
                      <p className="mt-1.5 text-[11px] text-amber-800 flex items-center gap-1">
                        <Lock className="w-3 h-3 shrink-0" />
                        <span>
                          Đề thi này đã có lượt giao bài nên môn học và tác giả đề được khóa ở tầng CSDL để giữ toàn vẹn dữ liệu.
                        </span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Lớp nhận bài & Nhãn đợt */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="target-class-select"
                    className="block text-xs font-bold text-[#102C54] mb-1"
                  >
                    Lớp nhận bài:
                  </label>
                  {eligibleClasses.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                      {currentRole === 'admin' ? (
                        <div className="flex items-center justify-between gap-2">
                          <span>Chưa có lớp học nào.</span>
                          <button
                            type="button"
                            onClick={() => setCurrentView('admin_accounts')}
                            className="font-bold underline text-[#1769F4] shrink-0 whitespace-nowrap cursor-pointer"
                          >
                            Mở Quản lý lớp &amp; tài khoản
                          </button>
                        </div>
                      ) : selectedSavedExam ? (
                        <p className="leading-relaxed">
                          Bạn chưa có phân công giảng dạy đang hoạt động cho môn{' '}
                          <strong>{getSubjectOption(selectedSavedExam.subject).name}</strong> (hoặc phân công cũ đang chờ Quản trị viên bổ sung môn).
                        </p>
                      ) : (
                        <p>Hãy chọn một đề đã lưu ở trên để hiển thị lớp nhận bài phù hợp.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <select
                        id="target-class-select"
                        value={targetClassId}
                        onChange={e => setTargetClassId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl font-semibold text-[#102C54]"
                      >
                        {eligibleClasses.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.studentCount} HS) - Khối {c.grade}
                            {c.schoolYear ? ` · ${c.schoolYear}` : ''}
                          </option>
                        ))}
                      </select>
                      {!isUsingDemoAssignmentsData && currentRole === 'teacher' && selectedSavedExam && (
                        <p className="text-[11px] text-slate-500">
                          Chỉ hiển thị lớp bạn đang được phân công dạy môn{' '}
                          <strong>{getSubjectOption(selectedSavedExam.subject).name}</strong>.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="round-label-input"
                    className="block text-xs font-bold text-[#102C54] mb-1"
                  >
                    Nhãn đợt giao bài (giao nhiều đợt):
                  </label>
                  <input
                    id="round-label-input"
                    type="text"
                    value={roundLabel}
                    onChange={e => setRoundLabel(e.target.value)}
                    placeholder="Ví dụ: Đợt 1, Đợt kiểm tra bù..."
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl text-[#102C54]"
                  />
                </div>
              </div>

              {/* Thời gian mở / đóng / số lần làm */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#102C54] mb-1">
                    Thời gian mở đề:
                  </label>
                  <input
                    type="datetime-local"
                    value={openTimeLocal}
                    onChange={e => setOpenTimeLocal(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#102C54] mb-1">
                    Hạn nộp bài:
                  </label>
                  <input
                    type="datetime-local"
                    value={closeTimeLocal}
                    onChange={e => setCloseTimeLocal(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#102C54] mb-1">
                    Số lần làm bài:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={attemptsAllowed}
                    onChange={e => setAttemptsAllowed(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl tabular-nums"
                  />
                </div>
              </div>

              {/* Cấu hình chống gian lận */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-[#102C54] block">
                  Cấu hình chống gian lận &amp; Trộn đề:
                </span>

                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={e => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 accent-[#1769F4] rounded-sm"
                  />
                  <span>
                    <b>Xáo trộn thứ tự câu hỏi</b> ngẫu nhiên theo từng học sinh
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={e => setShuffleOptions(e.target.checked)}
                    className="w-4 h-4 accent-[#1769F4] rounded-sm"
                  />
                  <span>
                    <b>Xáo trộn thứ tự các phương án A, B, C, D</b>
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSolutionAfterSubmit}
                    onChange={e => setShowSolutionAfterSubmit(e.target.checked)}
                    className="w-4 h-4 accent-[#1769F4] rounded-sm"
                  />
                  <span>
                    Cho phép học sinh <b>xem lời giải chi tiết ngay sau khi nộp</b>
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isComputerLabMode}
                    onChange={e => setIsComputerLabMode(e.target.checked)}
                    className="w-4 h-4 accent-[#1769F4] rounded-sm"
                  />
                  <span>
                    <b>Chế độ phòng máy:</b> Tự động đăng xuất tài khoản sau khi nộp bài
                  </span>
                </label>
              </div>
            </div>

            {/* Tóm tắt đề & Nút phát hành */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <h3 className="text-base font-bold text-[#102C54] border-b border-slate-100 pb-2">
                  Tóm tắt đề kiểm tra sẽ giao
                </h3>
                {selectedSavedExam ? (
                  <div className="p-4 rounded-xl bg-[#EAF3FF] border border-[#C7DCFA] space-y-2 text-xs text-[#102C54] tabular-nums">
                    <p className="font-bold text-sm">{selectedSavedExam.title}</p>
                    <p>
                      Mã đề: <b className="font-mono">{selectedSavedExam.code}</b>
                    </p>
                    <p>
                      Khối &amp; Môn:{' '}
                      <b>
                        Khối {selectedSavedExam.grade} –{' '}
                        {getSubjectOption(selectedSavedExam.subject).name}
                      </b>
                    </p>
                    <p>
                      Số câu hỏi:{' '}
                      <b>
                        {selectedSavedExam.questionCount ?? selectedSavedExam.questions.length} câu
                      </b>{' '}
                      • Tổng điểm: <b>{selectedSavedExam.totalPoints} điểm</b>
                    </p>
                    <p>
                      Thời lượng: <b>{selectedSavedExam.durationMinutes} phút</b>
                    </p>
                    {selectedClass && (
                      <p className="pt-1 border-t border-[#C7DCFA]">
                        Lớp nhận bài: <b>{selectedClass.name}</b> ({selectedClass.studentCount} HS)
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Chưa có đề nào được chọn.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isPublishing || !selectedClass || !selectedSavedExam}
                className="w-full py-3 bg-[#1769F4] text-white font-bold rounded-xl shadow-xs hover:bg-[#1255CC] transition-colors flex items-center justify-center gap-2 disabled:opacity-40 whitespace-nowrap cursor-pointer"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang phát hành &amp; đồng bộ...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Phát hành &amp; Giao bài cho lớp</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Danh sách lượt đã giao cho lớp */}
          {selectedClass && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#102C54] flex items-center gap-2 tabular-nums">
                  <Users className="w-4 h-4 text-[#1769F4]" />
                  <span>
                    Các lượt bài đã giao cho {selectedClass.name} ({classAssignments.length})
                  </span>
                </h3>
              </div>
              {classAssignments.length === 0 ? (
                <p className="text-xs text-slate-500">Lớp này chưa có bài được giao nào.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {classAssignments.map(asg => (
                    <div
                      key={asg.id}
                      className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F6F9FD] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#102C54] truncate">{asg.examTitle}</span>
                        {asg.roundLabel && (
                          <span className="px-2 py-0.5 rounded-md bg-[#EAF3FF] text-[#1769F4] font-bold shrink-0">
                            {asg.roundLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 tabular-nums">
                        <CalendarClock className="w-3.5 h-3.5 text-[#1769F4]" />
                        <span>
                          Hạn nộp: {formatAssignmentDeadline(asg.closeTime) || asg.closeTime}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal xác nhận khi đổi Khối/Môn/Bộ sách lúc Đề đang soạn đã có câu */}
      {pendingContextChange && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4 font-edtech"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-switch-title"
        >
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="confirm-switch-title" className="text-base font-bold text-[#102C54]">
                  Xác nhận thay đổi cấu hình đề
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Đề đang soạn hiện có <b className="tabular-nums">{draftQuestionIds.length} câu hỏi</b>. Khi đổi{' '}
                  {pendingContextChange.type === 'grade'
                    ? `sang Khối ${pendingContextChange.nextGrade}`
                    : pendingContextChange.type === 'subject'
                    ? `sang môn ${getSubjectOption(pendingContextChange.nextSubject).name}`
                    : `bộ sách`}
                  , các câu hỏi đã thêm và phạm vi đang chọn sẽ được xóa để tránh lẫn môn/khối.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingContextChange(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Giữ đề hiện tại
              </button>
              <button
                type="button"
                onClick={() => applyContextSwitch(pendingContextChange)}
                className="px-4 py-2 rounded-xl bg-[#1769F4] text-white text-xs font-bold hover:bg-[#1255CC] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Xác nhận đổi &amp; Xóa câu đã chọn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem trước đề đang soạn */}
      <ExamPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={examTitle}
        code={examCode}
        grade={draftGrade}
        subject={draftSubject}
        textbook={showTextbookSelector ? selectedTextbook : undefined}
        period={draftPeriod}
        durationMinutes={duration}
        questions={draftQuestions}
        lockedIds={lockedIds}
      />
    </div>
  );
};
