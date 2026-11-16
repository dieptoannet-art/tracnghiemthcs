import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { MathView } from '../MathView';
import { supabase } from '../../lib/supabase';
import { Question, Grade, ExamPeriod } from '../../types';
import { normalizeGrade, normalizeSubject, isQuestionInSubject } from '../teacher/QuestionBank';
import {
  getGroupsByGradeAndSubject,
  getLessonsByGroup,
  getVolumesByGradeAndSubject
} from '../../data/coreKnowledgeLessons';
import {
  ExamStructureConfig,
  getExamStructure
} from '../../utils/examStructure';
import { ExamStructureConfigModal } from '../teacher/ExamStructureConfigModal';
import {
  findMatchingPublishedOutlines,
  mapSubjectNameToId
} from '../../utils/studyMaterialsSync';
import {
  SemesterBannerIllustration3D,
  ExamCardIllustration3D,
  SelectedExamIllustration3D,
  OutlineBooksIllustration3D,
  ExamCardVisualVariant
} from './semesterReviewIllustrations3D';
import {
  Calendar,
  Clock,
  BookOpen,
  Award,
  FileText,
  Printer,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Play,
  Sliders,
  Camera,
  Upload,
  Trash2,
  Check,
  Info,
  Send,
  GraduationCap,
  X,
  ClipboardList,
  Layers
} from 'lucide-react';

interface PeriodOption {
  id: ExamPeriod;
  label: string;
  shortLabel: string;
  kind: 'mid' | 'final';
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { id: 'mid1', label: 'Giữa học kỳ I', shortLabel: 'Giữa HK I', kind: 'mid' },
  { id: 'final1', label: 'Cuối học kỳ I', shortLabel: 'Cuối HK I', kind: 'final' },
  { id: 'mid2', label: 'Giữa học kỳ II', shortLabel: 'Giữa HK II', kind: 'mid' },
  { id: 'final2', label: 'Cuối học kỳ II', shortLabel: 'Cuối HK II', kind: 'final' }
];

const SUBJECT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Toán', label: 'Toán học' },
  { value: 'Tin học', label: 'Tin học' },
  { value: 'Khoa học tự nhiên', label: 'Khoa học tự nhiên' },
  { value: 'Ngữ văn', label: 'Ngữ văn' },
  { value: 'Tiếng Anh', label: 'Tiếng Anh' },
  { value: 'Lịch sử và Địa lí', label: 'Lịch sử & Địa lí' },
  { value: 'Công nghệ', label: 'Công nghệ' },
  { value: 'Giáo dục công dân', label: 'GDCD' }
];

const resolveInitialSubject = (contextSubject?: string): string => {
  if (!contextSubject) return 'Toán';
  const norm = normalizeSubject(contextSubject);
  const matched = SUBJECT_OPTIONS.find(opt => normalizeSubject(opt.value) === norm);
  return matched ? matched.value : 'Toán';
};

const mapToCoreSubjectCode = (subject: string): 'Toan' | 'Tin' | 'KHTN' | null => {
  const norm = normalizeSubject(subject);
  if (norm === 'toan') return 'Toan';
  if (norm === 'tin_hoc') return 'Tin';
  if (norm === 'khtn') return 'KHTN';
  return null;
};

interface MockExamOption {
  id: number;
  code: string;
  title: string;
  description: string;
  variant: ExamCardVisualVariant;
  durationMinutes: number;
  questionCount: number;
}

export const SemesterReview: React.FC = () => {
  const {
    questions: localQuestions,
    selectedGrade: contextGrade,
    selectedSubject: contextSubject,
    setCurrentView,
    currentRole,
    userProfile,
    studyDocs,
    openStudyMaterialsWithIntent
  } = useApp();

  // Phân quyền: Chỉ giáo viên / quản trị / kiểm duyệt mới thấy công cụ chỉnh cấu trúc & ma trận
  const canManageExamConfig =
    currentRole === 'teacher' || currentRole === 'admin' || currentRole === 'reviewer';

  // 1. Bộ lọc khối lớp, môn học, kỳ ôn tập (giữ đúng ngữ cảnh người dùng, không ép cứng)
  const [selectedPeriod, setSelectedPeriod] = useState<ExamPeriod>('mid1');
  const [selectedGrade, setSelectedGrade] = useState<string>(() => {
    const profileGrade = normalizeGrade(userProfile?.grade);
    const ctxGrade = normalizeGrade(contextGrade);
    const candidate = profileGrade || ctxGrade || '6';
    return ['6', '7', '8', '9'].includes(candidate) ? candidate : '6';
  });
  const [selectedSubject, setSelectedSubject] = useState<string>(() =>
    resolveInitialSubject(contextSubject)
  );

  // Hai tab chính gọn gàng: Ôn kiến thức | Thi thử
  const [activeTab, setActiveTab] = useState<'curriculum_guide' | 'mock_exam'>('mock_exam');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(1);
  const [isStructureExpanded, setIsStructureExpanded] = useState<boolean>(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState<boolean>(false);
  const [expandedTopicKeys, setExpandedTopicKeys] = useState<Record<string, boolean>>({});

  // Tham chiếu cuộn mượt khi chuyển sang tab Ôn kiến thức từ khối "Cần ôn lại trước?"
  const workspaceTabRef = useRef<HTMLDivElement | null>(null);
  const isStartingLockRef = useRef<boolean>(false);
  const [isStartingExam, setIsStartingExam] = useState<boolean>(false);

  // Cấu hình cấu trúc đề thi động theo môn (Toán: 16-2-4; Tin: 12-4-3; Ngữ văn: 8-2-2 90p...)
  const [structureConfig, setStructureConfig] = useState<ExamStructureConfig>(() =>
    getExamStructure(resolveInitialSubject(contextSubject))
  );
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setStructureConfig(getExamStructure(selectedSubject));
  }, [selectedSubject]);

  // Liên kết tới đề cương ôn tập đã công bố trong Thư viện Tài liệu học tập
  const mappedSubjectId = useMemo(
    () => mapSubjectNameToId(selectedSubject),
    [selectedSubject]
  );

  const matchingPublishedOutlines = useMemo(
    () =>
      findMatchingPublishedOutlines(
        studyDocs,
        selectedGrade as Grade,
        mappedSubjectId,
        selectedPeriod
      ),
    [studyDocs, selectedGrade, mappedSubjectId, selectedPeriod]
  );

  const [noOutlineNotice, setNoOutlineNotice] = useState<string | null>(null);

  useEffect(() => {
    setNoOutlineNotice(null);
    setExpandedTopicKeys({});
  }, [selectedPeriod, selectedGrade, selectedSubject]);

  const handleOpenPublishedOutline = () => {
    if (matchingPublishedOutlines.length === 0) {
      setNoOutlineNotice('Chưa có tài liệu đề cương đính kèm cho đợt này.');
      return;
    }

    setNoOutlineNotice(null);
    openStudyMaterialsWithIntent({
      grade: selectedGrade as Grade,
      subject: mappedSubjectId,
      materialType: 'de_cuong',
      examTerm: selectedPeriod,
      openMaterialId:
        matchingPublishedOutlines.length === 1 ? matchingPublishedOutlines[0].id : undefined
    });
  };

  const handleViewOutlineTab = () => {
    setActiveTab('curriculum_guide');
    setIsExamRunning(false);
    workspaceTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Supabase question storage
  const [supabaseQuestions, setSupabaseQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const fetchQuestions = async () => {
      try {
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .limit(1000);

        if (isMounted && !error && data) {
          setSupabaseQuestions(data);
        }
      } catch (err: any) {
        console.warn('Lỗi khi nạp câu hỏi cho Ôn tập học kỳ:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchQuestions();

    return () => {
      isMounted = false;
    };
  }, []);

  // Tổng hợp kho câu hỏi (bảo toàn 100% logic cũ)
  const allQuestions = useMemo<Question[]>(() => {
    const qMap = new Map<string, Question>();
    (localQuestions || []).forEach(q => qMap.set(q.id, q));

    supabaseQuestions.forEach((sq: any) => {
      let parsedOptions: any[] = [];
      if (Array.isArray(sq.options)) parsedOptions = sq.options;
      else if (typeof sq.options === 'string') {
        try {
          parsedOptions = JSON.parse(sq.options);
        } catch {
          parsedOptions = [];
        }
      }
      const formattedOptions = parsedOptions.map((opt, i) => ({
        id: opt.id || `opt-${i}`,
        label: opt.label || String.fromCharCode(65 + i),
        text: opt.text || ''
      }));

      qMap.set(sq.id, {
        id: sq.id,
        code: sq.code || `Q-${sq.id.slice(0, 8)}`,
        grade: (normalizeGrade(sq.grade) || '6') as Grade,
        subject: sq.subject || 'Tin học',
        textbook: sq.textbook || 'Kết nối tri thức',
        chapter: sq.chapter || 'Chủ đề chung',
        lesson: sq.lesson || 'Bài học chung',
        yccd: sq.yccd || '',
        competency: sq.competency || '',
        level: sq.level || 'know',
        type: sq.type || 'single_choice',
        stem: sq.stem || '',
        points: Number(sq.points) || 1.0,
        options: formattedOptions,
        subItems: Array.isArray(sq.sub_items) ? sq.sub_items : [],
        correctAnswer: sq.correctAnswer || (formattedOptions[0]?.label || 'A'),
        explanation: sq.explanation || 'Xem lại kiến thức trong đề cương học kỳ.',
        acceptedAnswers: sq.acceptedAnswers || [],
        rubric: sq.rubric || undefined,
        sampleAnswer: sq.sample_answer || sq.sampleAnswer || undefined,
        status: sq.status || 'approved',
        author: sq.author || 'Tổ Chuyên môn THCS Tây Đô',
        version: sq.version || 1
      });
    });

    return Array.from(qMap.values());
  }, [localQuestions, supabaseQuestions]);

  // Bộ câu hỏi phù hợp với khối lớp và môn học
  const poolQuestions = useMemo(() => {
    return allQuestions.filter(q => {
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;
      const matchSub = isQuestionInSubject(q, selectedSubject);
      return matchGrade && matchSub;
    });
  }, [allQuestions, selectedGrade, selectedSubject]);

  // Bộ đề thi học kỳ mô phỏng theo cấu trúc GDPT 2018 và tùy chỉnh của Giáo viên
  const semesterMockExamQuestions = useMemo(() => {
    const singleInGrade = poolQuestions.filter(q => q.type === 'single_choice');
    const tfInGrade = poolQuestions.filter(q => q.type === 'true_false_group');
    const essayInGrade = poolQuestions.filter(
      q => q.type === 'essay' || q.type === 'short_answer'
    );

    const allSubjectQuestions = allQuestions.filter(q =>
      isQuestionInSubject(q, selectedSubject)
    );
    const allSingle = allSubjectQuestions.filter(q => q.type === 'single_choice');
    const allTf = allSubjectQuestions.filter(q => q.type === 'true_false_group');
    const allEssay = allSubjectQuestions.filter(
      q => q.type === 'essay' || q.type === 'short_answer'
    );

    const result: Question[] = [];

    // --- PHẦN I: TRẮC NGHIỆM ABCD ---
    const targetSingleCount = structureConfig.singleChoiceCount;
    const ptsPerSingle =
      targetSingleCount > 0
        ? Number((structureConfig.singleChoicePoints / targetSingleCount).toFixed(2))
        : 0.25;
    const singlePicked: Question[] = [];
    singleInGrade.forEach(q => {
      if (singlePicked.length < targetSingleCount && !singlePicked.some(p => p.id === q.id)) {
        singlePicked.push({ ...q, points: ptsPerSingle, examSection: 'part1' as any });
      }
    });
    allSingle.forEach(q => {
      if (singlePicked.length < targetSingleCount && !singlePicked.some(p => p.id === q.id)) {
        singlePicked.push({ ...q, points: ptsPerSingle, examSection: 'part1' as any });
      }
    });
    if (singlePicked.length < targetSingleCount) {
      const needed = targetSingleCount - singlePicked.length;
      for (let i = 0; i < needed; i++) {
        singlePicked.push({
          id: `syn-mc-${selectedSubject}-${i + 1}`,
          code: `${selectedSubject.slice(0, 2).toUpperCase()}${selectedGrade}_GK_MC_${(
            singlePicked.length + 1
          )
            .toString()
            .padStart(3, '0')}`,
          grade: selectedGrade as Grade,
          subject: selectedSubject,
          textbook: 'Kết nối tri thức',
          chapter: 'Kiến thức trọng tâm học kỳ',
          lesson: `Dạng bài tập trắc nghiệm số ${singlePicked.length + 1}`,
          level: (i % 3 === 0 ? 'know' : i % 3 === 1 ? 'understand' : 'apply') as any,
          type: 'single_choice',
          stem: `Khẳng định nào sau đây là chính xác đối với kiến thức trọng tâm học kỳ môn ${selectedSubject} (Khối ${selectedGrade})?`,
          points: ptsPerSingle,
          options: [
            { id: 'A', label: 'A', text: 'Khẳng định đúng theo định nghĩa chuẩn SGK' },
            { id: 'B', label: 'B', text: 'Khẳng định sai lệch điều kiện cần và đủ' },
            { id: 'C', label: 'C', text: 'Khẳng định thiếu giả thiết bài toán' },
            { id: 'D', label: 'D', text: 'Khẳng định chỉ đúng trong một trường hợp suy biến' }
          ],
          correctAnswer: 'A',
          explanation: `Kiến thức cốt lõi được quy định trong chương trình GDPT 2018 môn ${selectedSubject}.`,
          status: 'approved',
          author: 'Tổ Chuyên môn THCS Tây Đô',
          version: 1,
          examSection: 'part1' as any
        });
      }
    }
    result.push(...singlePicked);

    // --- PHẦN II: TRẮC NGHIỆM ĐÚNG - SAI 4 Ý ---
    const targetTfCount = structureConfig.trueFalseCount;
    const ptsPerTf =
      targetTfCount > 0
        ? Number((structureConfig.trueFalsePoints / targetTfCount).toFixed(2))
        : 1.0;
    const tfPicked: Question[] = [];
    tfInGrade.forEach(q => {
      if (tfPicked.length < targetTfCount && !tfPicked.some(p => p.id === q.id)) {
        tfPicked.push({ ...q, points: ptsPerTf, examSection: 'part2' as any });
      }
    });
    allTf.forEach(q => {
      if (tfPicked.length < targetTfCount && !tfPicked.some(p => p.id === q.id)) {
        tfPicked.push({ ...q, points: ptsPerTf, examSection: 'part2' as any });
      }
    });
    if (tfPicked.length < targetTfCount) {
      const needed = targetTfCount - tfPicked.length;
      for (let i = 0; i < needed; i++) {
        tfPicked.push({
          id: `syn-tf-${selectedSubject}-${i + 1}`,
          code: `${selectedSubject.slice(0, 2).toUpperCase()}${selectedGrade}_GK_TF_${(
            tfPicked.length + 1
          )
            .toString()
            .padStart(2, '0')}`,
          grade: selectedGrade as Grade,
          subject: selectedSubject,
          textbook: 'Kết nối tri thức',
          chapter: 'Kiến thức cốt lõi học kỳ',
          lesson: `Câu hỏi suy luận đúng - sai ${tfPicked.length + 1}`,
          level: 'understand',
          type: 'true_false_group',
          stem: `Xét tính Đúng/Sai của các nhận định chuyên đề môn ${selectedSubject} lớp ${selectedGrade}:`,
          points: ptsPerTf,
          explanation: 'Đối chiếu tính chất và công thức trong đề cương ôn tập học kỳ.',
          status: 'approved',
          author: 'Tổ Chuyên môn THCS Tây Đô',
          version: 1,
          subItems: [
            {
              id: `syn-tf-sub-a-${i}`,
              label: 'a',
              text: 'Nhận định đúng theo định nghĩa SGK GDPT 2018.',
              isCorrect: true,
              level: 'know'
            },
            {
              id: `syn-tf-sub-b-${i}`,
              label: 'b',
              text: 'Phát biểu sai về điều kiện áp dụng định lí/quy tắc.',
              isCorrect: false,
              level: 'understand'
            },
            {
              id: `syn-tf-sub-c-${i}`,
              label: 'c',
              text: 'Công thức môn học được áp dụng chính xác.',
              isCorrect: true,
              level: 'understand'
            },
            {
              id: `syn-tf-sub-d-${i}`,
              label: 'd',
              text: 'Kết luận tổng quát trong mọi trường hợp là không đúng.',
              isCorrect: false,
              level: 'apply'
            }
          ],
          examSection: 'part2' as any
        });
      }
    }
    result.push(...tfPicked);

    // --- PHẦN III: TỰ LUẬN / TRẢ LỜI NGẮN ---
    const targetEssayCount = structureConfig.essayCount;
    const ptsPerEssay =
      targetEssayCount > 0
        ? Number((structureConfig.essayPoints / targetEssayCount).toFixed(2))
        : 1.0;
    const essayPicked: Question[] = [];
    essayInGrade.forEach(q => {
      if (essayPicked.length < targetEssayCount && !essayPicked.some(p => p.id === q.id)) {
        essayPicked.push({ ...q, points: ptsPerEssay, examSection: 'part3' as any });
      }
    });
    allEssay.forEach(q => {
      if (essayPicked.length < targetEssayCount && !essayPicked.some(p => p.id === q.id)) {
        essayPicked.push({ ...q, points: ptsPerEssay, examSection: 'part3' as any });
      }
    });
    if (essayPicked.length < targetEssayCount) {
      const needed = targetEssayCount - essayPicked.length;
      for (let i = 0; i < needed; i++) {
        essayPicked.push({
          id: `syn-es-${selectedSubject}-${i + 1}`,
          code: `${selectedSubject.slice(0, 2).toUpperCase()}${selectedGrade}_GK_ES_${(
            essayPicked.length + 1
          )
            .toString()
            .padStart(2, '0')}`,
          grade: selectedGrade as Grade,
          subject: selectedSubject,
          textbook: 'Kết nối tri thức',
          chapter: 'Vận dụng thực tiễn học kỳ',
          lesson: `Bài toán tự luận trọng tâm ${essayPicked.length + 1}`,
          level: 'apply',
          type: 'essay',
          stem: `Trình bày chi tiết lời giải hoặc các bước giải quyết tình huống thực tế sau đây môn ${selectedSubject} (Khối ${selectedGrade}):`,
          points: ptsPerEssay,
          explanation: 'Lập luận rõ ràng, nêu các bước giải, tính toán chính xác và kết luận.',
          sampleAnswer: 'Trình bày lời giải chi tiết theo các bước hướng dẫn trong đáp án ma trận.',
          status: 'approved',
          author: 'Tổ Chuyên môn THCS Tây Đô',
          version: 1,
          examSection: 'part3' as any
        });
      }
    }
    result.push(...essayPicked);

    return result;
  }, [poolQuestions, allQuestions, selectedSubject, selectedGrade, structureConfig]);

  // Danh sách bộ đề ôn tập thật từ cấu trúc hiện hành (không gắn nhãn sai lệch)
  const availableMockExams = useMemo<MockExamOption[]>(() => {
    const qCount = semesterMockExamQuestions.length;
    const mins = structureConfig.durationMinutes;
    return [
      {
        id: 1,
        code: 'Đề số 01',
        title: 'Đề thi thử tổng hợp số 01',
        description: `Bộ đề mô phỏng theo cấu trúc ${qCount} câu`,
        variant: 'check',
        durationMinutes: mins,
        questionCount: qCount
      },
      {
        id: 2,
        code: 'Đề số 02',
        title: 'Đề thi thử tổng hợp số 02',
        description: `Ôn luyện cân đối các mức độ nhận thức`,
        variant: 'chart',
        durationMinutes: mins,
        questionCount: qCount
      },
      {
        id: 3,
        code: 'Đề số 03',
        title: 'Đề thi thử tổng hợp số 03',
        description: `Tổng ôn kiến thức & kỹ năng làm bài`,
        variant: 'target',
        durationMinutes: mins,
        questionCount: qCount
      }
    ];
  }, [semesterMockExamQuestions.length, structureConfig.durationMinutes]);

  const selectedExam = useMemo(
    () => availableMockExams.find(e => e.id === selectedExamId) || null,
    [availableMockExams, selectedExamId]
  );

  // Dữ liệu "Ôn kiến thức" theo đúng lớp + môn + kỳ thực tế
  const curriculumTopicGroups = useMemo(() => {
    const gradeNum = Number(selectedGrade) || 6;
    const coreCode = mapToCoreSubjectCode(selectedSubject);

    if (coreCode) {
      const volumes = getVolumesByGradeAndSubject(gradeNum, coreCode);
      const isSem1 = selectedPeriod === 'mid1' || selectedPeriod === 'final1';
      const targetVolume =
        volumes.length > 1 ? (isSem1 ? 1 : 2) : volumes[0];
      const groups = getGroupsByGradeAndSubject(gradeNum, coreCode, targetVolume);
      const filteredGroups = groups.filter(g => g.groupType !== 'intro');
      return filteredGroups.map(g => ({
        key: g.groupKey,
        title: g.chapterLabel,
        volume: g.volume,
        lessons: getLessonsByGroup(gradeNum, coreCode, g.groupKey).map(l => ({
          id: l.id,
          title: l.lessonLabel
        }))
      }));
    }

    // Các môn khác chưa có trong catalog_kien_thuc_trong_tam: lấy chương & bài thật từ ngân hàng câu hỏi
    const chapterMap = new Map<string, Set<string>>();
    poolQuestions.forEach(q => {
      const ch = (q.chapter || '').trim();
      const ls = (q.lesson || '').trim();
      if (!ch) return;
      if (!chapterMap.has(ch)) chapterMap.set(ch, new Set());
      if (ls) chapterMap.get(ch)!.add(ls);
    });

    return Array.from(chapterMap.entries()).map(([chapterTitle, lessonSet], idx) => ({
      key: `qb-ch-${idx}-${chapterTitle}`,
      title: chapterTitle,
      volume: 1,
      lessons: Array.from(lessonSet).map((lTitle, lIdx) => ({
        id: `qb-ls-${idx}-${lIdx}`,
        title: lTitle
      }))
    }));
  }, [selectedGrade, selectedSubject, selectedPeriod, poolQuestions]);

  // Trạng thái phiên thi thử học kỳ
  const [isExamRunning, setIsExamRunning] = useState<boolean>(false);
  const [examIndex, setExamIndex] = useState<number>(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, any>>({});
  const [examSecondsLeft, setExamSecondsLeft] = useState<number>(
    () => structureConfig.durationMinutes * 60
  );
  const [isExamSubmitted, setIsExamSubmitted] = useState<boolean>(false);
  const [confirmEarlySubmit, setConfirmEarlySubmit] = useState<boolean>(false);

  // Đếm ngược giờ thi học kỳ (chỉ chạy khi vào màn hình làm bài)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isExamRunning && !isExamSubmitted) {
      timer = setInterval(() => {
        setExamSecondsLeft(prev => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            setIsExamSubmitted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isExamRunning, isExamSubmitted]);

  const handleStartSemesterExam = () => {
    if (isStartingLockRef.current || semesterMockExamQuestions.length === 0) return;
    isStartingLockRef.current = true;
    setIsStartingExam(true);

    setExamIndex(0);
    setExamAnswers({});
    setExamSecondsLeft(structureConfig.durationMinutes * 60);
    setIsExamSubmitted(false);
    setConfirmEarlySubmit(false);
    setIsExamRunning(true);

    setTimeout(() => {
      isStartingLockRef.current = false;
      setIsStartingExam(false);
    }, 350);
  };

  const handleSelectExamOption = (qId: string, val: any) => {
    if (isExamSubmitted) return;
    setExamAnswers(prev => ({ ...prev, [qId]: val }));
  };

  // Tính kết quả thi thử học kỳ theo chuẩn GDPT 2018 (thang 10,0 điểm)
  const examResult = useMemo(() => {
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;

    const ptsPerSingle =
      structureConfig.singleChoiceCount > 0
        ? structureConfig.singleChoicePoints / structureConfig.singleChoiceCount
        : 0.25;

    const ptsPerTF =
      structureConfig.trueFalseCount > 0
        ? structureConfig.trueFalsePoints / structureConfig.trueFalseCount
        : 1.0;

    const ptsPerEssay =
      structureConfig.essayCount > 0
        ? structureConfig.essayPoints / structureConfig.essayCount
        : 1.0;

    semesterMockExamQuestions.forEach(q => {
      const ans = examAnswers[q.id];

      if (q.type === 'single_choice') {
        if (
          ans &&
          String(ans).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase()
        ) {
          totalScore += ptsPerSingle;
          correctCount++;
        } else {
          wrongCount++;
        }
      } else if (q.type === 'true_false_group') {
        const itemAnswers = (ans as Record<string, boolean>) || {};
        let subCorrect = 0;
        (q.subItems || []).forEach(sub => {
          if (itemAnswers[sub.id] !== undefined && itemAnswers[sub.id] === (sub as any).isCorrect) {
            subCorrect++;
          }
        });

        let ptsRatio = 0;
        if (subCorrect === 1) ptsRatio = 0.1;
        else if (subCorrect === 2) ptsRatio = 0.25;
        else if (subCorrect === 3) ptsRatio = 0.5;
        else if (subCorrect === 4) ptsRatio = 1.0;

        totalScore += ptsRatio * ptsPerTF;
        if (subCorrect === 4) correctCount++;
        else if (subCorrect === 0) wrongCount++;
      } else {
        const textAns = typeof ans === 'object' ? ans?.text : ans;
        const fileAns = typeof ans === 'object' ? ans?.files : null;
        if ((textAns && String(textAns).trim().length > 3) || (Array.isArray(fileAns) && fileAns.length > 0)) {
          totalScore += ptsPerEssay;
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    const scaledScore = Math.min(10, Math.max(0, Number(totalScore.toFixed(1))));

    let rank = 'Chưa đạt';
    let rankBadge = 'bg-rose-100 text-rose-800 border-rose-300';
    if (scaledScore >= 8.0) {
      rank = 'Tốt (Giỏi)';
      rankBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (scaledScore >= 6.5) {
      rank = 'Khá';
      rankBadge = 'bg-blue-100 text-blue-800 border-blue-300';
    } else if (scaledScore >= 5.0) {
      rank = 'Đạt (Trung bình)';
      rankBadge = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return {
      scaledScore,
      correctCount,
      wrongCount,
      rank,
      rankBadge
    };
  }, [semesterMockExamQuestions, examAnswers, structureConfig]);

  const currentPeriodOption = useMemo(
    () => PERIOD_OPTIONS.find(p => p.id === selectedPeriod) || PERIOD_OPTIONS[0],
    [selectedPeriod]
  );

  const selectedSubjectLabel = useMemo(
    () => SUBJECT_OPTIONS.find(s => s.value === selectedSubject)?.label || selectedSubject,
    [selectedSubject]
  );

  const formatMinutes = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalConfigQuestions =
    structureConfig.singleChoiceCount +
    structureConfig.trueFalseCount +
    structureConfig.essayCount;

  // =====================================================================
  // PHẦN HIỂN THỊ CHÍNH
  // =====================================================================
  if (isExamRunning) {
    /* GIAO DIỆN PHÒNG THI THỬ HỌC KỲ TRỰC TUYẾN (BẢO TOÀN 100% NGHIỆP VỤ) */
    return (
      <div className="bg-[#F4F8FF] min-h-full rounded-[24px] p-3 sm:p-5 font-edtech text-[#102A56]">
        <div className="space-y-4 max-w-4xl mx-auto">
          {isExamSubmitted ? (
            /* KẾT QUẢ THI THỬ HỌC KỲ */
            <div className="bg-white rounded-[24px] border border-[#D9E7FF] p-6 sm:p-8 shadow-sm text-center space-y-6">
              <div className="w-20 h-20 bg-[#ECFDF7] text-[#12A879] rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Award className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold text-[#526581] block">
                  Kết quả {selectedExam?.code || 'Đề thi thử'} • {currentPeriodOption.label} • {selectedSubjectLabel} Lớp {selectedGrade}
                </span>
                <h3 className="text-3xl font-extrabold text-[#102A56] mt-1 tabular-nums">
                  Điểm tổng kết: <span className="text-[#0866FF]">{examResult.scaledScore}</span> / 10
                </h3>
                <div
                  className={`mt-2 inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${examResult.rankBadge}`}
                >
                  <span>
                    Xếp loại học lực: <b>{examResult.rank}</b>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-xs">
                <div className="p-3 bg-[#EAF3FF] rounded-xl border border-[#D9E7FF]">
                  <span className="text-[#526581] block">Số câu đúng</span>
                  <b className="text-[#12A879] text-lg tabular-nums">{examResult.correctCount}</b>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-rose-600 block">Số câu sai</span>
                  <b className="text-rose-700 text-lg tabular-nums">{examResult.wrongCount}</b>
                </div>
                <div className="p-3 bg-[#F4F8FF] rounded-xl border border-[#D9E7FF]">
                  <span className="text-[#0866FF] block">Đã trả lời</span>
                  <b className="text-[#102A56] text-lg tabular-nums">
                    {Object.keys(examAnswers).length} / {semesterMockExamQuestions.length}
                  </b>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-amber-700 block">Thời gian làm</span>
                  <b className="text-amber-800 text-lg tabular-nums">
                    {formatMinutes(Math.max(0, structureConfig.durationMinutes * 60 - examSecondsLeft))}
                  </b>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-[#D9E7FF]">
                <button
                  type="button"
                  onClick={handleStartSemesterExam}
                  className="min-h-[44px] px-5 py-2.5 bg-[#0866FF] text-white rounded-xl text-sm font-bold hover:bg-[#0553D6] transition-colors motion-reduce:transition-none shadow-xs whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
                >
                  Thi lại đề này
                </button>
                <button
                  type="button"
                  onClick={() => setIsExamRunning(false)}
                  className="min-h-[44px] px-5 py-2.5 border border-[#D9E7FF] bg-white text-[#102A56] rounded-xl text-sm font-semibold hover:bg-[#F4F8FF] transition-colors motion-reduce:transition-none whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
                >
                  Quay lại Ôn tập học kỳ
                </button>
              </div>
            </div>
          ) : (
            /* ĐANG LÀM BÀI THI THỬ HỌC KỲ */
            <div className="space-y-4">
              {/* Header đồng hồ đếm ngược kỳ thi */}
              <div className="bg-white rounded-[20px] border border-[#D9E7FF] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="px-3 py-1 bg-[#EAF3FF] text-[#0866FF] rounded-lg text-xs font-bold tabular-nums whitespace-nowrap">
                    Câu {examIndex + 1} / {semesterMockExamQuestions.length}
                  </span>
                  <span className="text-xs sm:text-sm text-[#526581] font-semibold truncate max-w-xs">
                    {selectedExam?.code || 'Đề số 01'} • {semesterMockExamQuestions[examIndex]?.lesson || 'Học kỳ'}
                  </span>
                </div>

                <div className="flex items-center space-x-2.5 shrink-0">
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-mono font-bold tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{formatMinutes(examSecondsLeft)}</span>
                  </div>

                  {!confirmEarlySubmit ? (
                    <button
                      type="button"
                      onClick={() => setConfirmEarlySubmit(true)}
                      className="min-h-[40px] px-4 py-1.5 bg-[#12A879] text-white rounded-xl text-xs font-bold hover:bg-[#0F8F67] shadow-xs whitespace-nowrap cursor-pointer"
                    >
                      Nộp bài thi
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => setIsExamSubmitted(true)}
                        className="px-3 py-1 bg-[#12A879] text-white rounded-lg text-xs font-bold hover:bg-[#0F8F67] cursor-pointer whitespace-nowrap"
                      >
                        Xác nhận nộp
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmEarlySubmit(false)}
                        className="px-2.5 py-1 bg-white text-[#526581] border border-[#D9E7FF] rounded-lg text-xs font-semibold hover:text-[#102A56] cursor-pointer whitespace-nowrap"
                      >
                        Làm tiếp
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bản đồ câu hỏi thi học kỳ */}
              <div className="bg-white rounded-[20px] border border-[#D9E7FF] p-3.5 shadow-xs">
                <div className="text-xs font-bold text-[#526581] mb-2">Bản đồ câu hỏi thi:</div>
                <div className="flex flex-wrap gap-1.5">
                  {semesterMockExamQuestions.map((q, idx) => {
                    const isCur = idx === examIndex;
                    const isAns = examAnswers[q.id] !== undefined;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setExamIndex(idx)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold tabular-nums flex items-center justify-center border transition-all motion-reduce:transition-none cursor-pointer ${
                          isCur
                            ? 'bg-[#0866FF] text-white border-[#0866FF] ring-2 ring-[#0866FF]/30'
                            : isAns
                            ? 'bg-[#EAF3FF] text-[#0866FF] border-[#C7DCFA]'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nội dung câu hỏi thi học kỳ */}
              {semesterMockExamQuestions[examIndex] &&
                (() => {
                  const cur = semesterMockExamQuestions[examIndex];
                  const ptsPerSingle =
                    structureConfig.singleChoiceCount > 0
                      ? Number(
                          (structureConfig.singleChoicePoints / structureConfig.singleChoiceCount).toFixed(2)
                        )
                      : 0.25;
                  const ptsPerTf =
                    structureConfig.trueFalseCount > 0
                      ? Number(
                          (structureConfig.trueFalsePoints / structureConfig.trueFalseCount).toFixed(2)
                        )
                      : 1.0;
                  const ptsPerEssay =
                    structureConfig.essayCount > 0
                      ? Number((structureConfig.essayPoints / structureConfig.essayCount).toFixed(2))
                      : 1.0;

                  const partLabel =
                    cur.type === 'single_choice'
                      ? `Phần I: Trắc nghiệm ABCD (${ptsPerSingle}đ)`
                      : cur.type === 'true_false_group'
                      ? `Phần II: Đúng - Sai 4 ý (${ptsPerTf}đ)`
                      : `Phần III: Tự luận (${ptsPerEssay}đ)`;

                  return (
                    <div className="bg-white rounded-[20px] border border-[#D9E7FF] p-6 sm:p-8 shadow-xs space-y-5">
                      <div className="flex items-center justify-between border-b border-[#D9E7FF] pb-3 text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-[#0866FF]">[{cur.code}]</span>
                          <span className="font-semibold text-[#526581]">{partLabel}</span>
                        </div>
                        <span className="font-bold text-[#102A56] tabular-nums">
                          {cur.points || 0.5} điểm
                        </span>
                      </div>

                      <div className="text-base sm:text-lg font-bold text-[#102A56]">
                        <MathView content={cur.stem} />
                      </div>

                      {/* Dạng ABCD */}
                      {cur.type === 'single_choice' && cur.options && (
                        <div className="space-y-2.5">
                          {cur.options.map((opt: any) => {
                            const isSel = examAnswers[cur.id] === opt.label;
                            return (
                              <button
                                key={opt.id || opt.label}
                                type="button"
                                onClick={() => handleSelectExamOption(cur.id, opt.label)}
                                className={`w-full p-3.5 rounded-xl border text-left flex items-start space-x-3 transition-all motion-reduce:transition-none cursor-pointer ${
                                  isSel
                                    ? 'bg-[#EAF3FF] border-[#0866FF] ring-1 ring-[#0866FF] text-[#102A56] font-semibold'
                                    : 'bg-white border-[#D9E7FF] hover:bg-[#F4F8FF]'
                                }`}
                              >
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border ${
                                    isSel
                                      ? 'bg-[#0866FF] text-white border-[#0866FF]'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {opt.label}
                                </span>
                                <div className="text-sm font-medium pt-0.5 flex-1">
                                  <MathView content={opt.text} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Dạng Đúng - Sai */}
                      {cur.type === 'true_false_group' && cur.subItems && (
                        <div className="space-y-2.5">
                          {cur.subItems.map((sub: any, sIdx: number) => {
                            const currVal = examAnswers[cur.id]?.[sub.id];
                            return (
                              <div
                                key={sub.id || sIdx}
                                className="p-3.5 rounded-xl border border-[#D9E7FF] bg-[#F4F8FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                              >
                                <div className="font-medium flex-1">
                                  <b className="text-[#0866FF] mr-2">
                                    {sub.label || String.fromCharCode(97 + sIdx)})
                                  </b>
                                  <MathView content={sub.text} />
                                </div>
                                <div className="flex items-center space-x-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const old = examAnswers[cur.id] || {};
                                      handleSelectExamOption(cur.id, { ...old, [sub.id]: true });
                                    }}
                                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                                      currVal === true
                                        ? 'bg-[#0866FF] text-white border-[#0866FF]'
                                        : 'bg-white text-slate-700 border-slate-300'
                                    }`}
                                  >
                                    Đúng
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const old = examAnswers[cur.id] || {};
                                      handleSelectExamOption(cur.id, { ...old, [sub.id]: false });
                                    }}
                                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                                      currVal === false
                                        ? 'bg-rose-600 text-white border-rose-600'
                                        : 'bg-white text-slate-700 border-slate-300'
                                    }`}
                                  >
                                    Sai
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Dạng Tự luận / Trả lời ngắn */}
                      {(cur.type === 'essay' || cur.type === 'short_answer') && (
                        <div className="space-y-3">
                          <label className="block text-xs font-bold text-[#102A56]">
                            Nhập bài giải tự luận hoặc đính kèm ảnh/file bài làm:
                          </label>
                          <textarea
                            rows={4}
                            value={
                              typeof examAnswers[cur.id] === 'string'
                                ? examAnswers[cur.id]
                                : examAnswers[cur.id]?.text || ''
                            }
                            onChange={e => {
                              const prev = examAnswers[cur.id];
                              if (typeof prev === 'object' && prev !== null) {
                                handleSelectExamOption(cur.id, { ...prev, text: e.target.value });
                              } else {
                                handleSelectExamOption(cur.id, e.target.value);
                              }
                            }}
                            placeholder="Trình bày chi tiết lời giải, cách tính toán hoặc các bước thực hiện..."
                            className="w-full px-4 py-3 rounded-xl border border-[#D9E7FF] bg-[#F4F8FF] text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0866FF]"
                          />

                          <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#526581] flex items-center space-x-1.5">
                                <Camera className="w-4 h-4 text-[#0866FF]" />
                                <span>Đính kèm ảnh chụp bài giải viết tay hoặc file tệp:</span>
                              </span>
                              <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#D9E7FF] hover:border-[#0866FF] rounded-lg text-xs font-bold text-[#0866FF] shadow-2xs whitespace-nowrap">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Chọn ảnh / tệp</span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = ev => {
                                        const dataUrl = ev.target?.result as string;
                                        const prev = examAnswers[cur.id];
                                        const currentText =
                                          typeof prev === 'string' ? prev : prev?.text || '';
                                        const currentFiles =
                                          typeof prev === 'object' && Array.isArray(prev?.files)
                                            ? prev.files
                                            : [];
                                        handleSelectExamOption(cur.id, {
                                          text: currentText,
                                          files: [...currentFiles, { name: file.name, url: dataUrl }]
                                        });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            </div>

                            {(() => {
                              const val = examAnswers[cur.id];
                              const files: Array<{ name: string; url: string }> =
                                typeof val === 'object' && Array.isArray(val?.files) ? val.files : [];
                              if (files.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {files.map((f, fIdx) => (
                                    <div
                                      key={fIdx}
                                      className="relative group rounded-lg border border-[#D9E7FF] bg-white p-1.5 flex items-center space-x-2"
                                    >
                                      {f.url.startsWith('data:image') ? (
                                        <img
                                          src={f.url}
                                          alt={f.name}
                                          referrerPolicy="no-referrer"
                                          className="w-10 h-10 object-cover rounded-md"
                                        />
                                      ) : (
                                        <FileText className="w-6 h-6 text-[#0866FF]" />
                                      )}
                                      <div className="text-[11px] max-w-[120px] truncate text-slate-700 font-medium">
                                        {f.name}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedFiles = files.filter(
                                            (_, idx) => idx !== fIdx
                                          );
                                          const currentText =
                                            typeof val === 'string' ? val : val?.text || '';
                                          handleSelectExamOption(cur.id, {
                                            text: currentText,
                                            files: updatedFiles
                                          });
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                                        title="Xóa tệp"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Nút chuyển câu */}
                      <div className="flex items-center justify-between pt-4 border-t border-[#D9E7FF]">
                        <button
                          type="button"
                          onClick={() => setExamIndex(p => Math.max(0, p - 1))}
                          disabled={examIndex === 0}
                          className="min-h-[44px] px-4 py-2 border border-[#D9E7FF] rounded-xl text-xs font-bold text-[#102A56] hover:bg-[#F4F8FF] disabled:opacity-30 flex items-center space-x-1 whitespace-nowrap cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Câu trước</span>
                        </button>

                        {examIndex < semesterMockExamQuestions.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => setExamIndex(p => p + 1)}
                            className="min-h-[44px] px-5 py-2 bg-[#0866FF] text-white rounded-xl text-xs font-bold hover:bg-[#0553D6] flex items-center space-x-1 whitespace-nowrap cursor-pointer"
                          >
                            <span>Câu tiếp theo</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsExamSubmitted(true)}
                            className="min-h-[44px] px-6 py-2 bg-[#12A879] text-white rounded-xl text-xs font-bold hover:bg-[#0F8F67] shadow-xs whitespace-nowrap cursor-pointer"
                          >
                            Nộp bài thi ngay
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F8FF] min-h-full rounded-[24px] p-3 sm:p-5 space-y-4 font-edtech text-[#102A56]">
      {/* 1. BANNER NGẮN GỌN ĐỒNG BỘ MÀU XANH BĂNG */}
      <section
        aria-labelledby="semester-review-heading"
        className="relative overflow-hidden rounded-[22px] border border-[#D9E7FF] bg-gradient-to-r from-[#EAF3FF] via-[#F2F7FF] to-[#DFECFF] px-5 py-4 sm:px-7 sm:py-5 shadow-[0_6px_20px_rgba(16,42,86,0.05)]"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-7 h-7 text-[#0866FF] shrink-0" aria-hidden="true" />
              <h1
                id="semester-review-heading"
                className="text-xl sm:text-2xl lg:text-[28px] font-extrabold text-[#102A56] tracking-tight leading-tight"
              >
                Ôn tập &amp; Thi thử học kỳ
              </h1>
            </div>
            <p className="text-sm sm:text-[15px] text-[#526581] leading-relaxed">
              Ôn lại kiến thức, chọn đề và tự tin thử sức.
            </p>

            {/* Khu vực thiết lập chỉ hiển thị cho giáo viên / quản trị */}
            {canManageExamConfig && (
              <div className="pt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#0866FF] bg-white/80 border border-[#D9E7FF] px-2.5 py-1 rounded-lg">
                  Thiết lập giáo viên
                </span>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#EAF3FF] text-[#102A56] border border-[#D9E7FF] rounded-lg text-xs font-bold transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#0866FF]" aria-hidden="true" />
                  <span>Tùy chỉnh số câu &amp; ma trận ({selectedSubject})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('teacher_matrix')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#EAF3FF] text-[#526581] hover:text-[#102A56] border border-[#D9E7FF] rounded-lg text-xs font-semibold transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[#0866FF]" aria-hidden="true" />
                  <span>Trình soạn ma trận đề</span>
                </button>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center justify-end shrink-0">
            <SemesterBannerIllustration3D />
          </div>
        </div>
      </section>

      {/* 2. KHỐI CHỌN LỚP, MÔN VÀ KỲ ÔN TẬP */}
      <section
        aria-label="Chọn lớp, môn học và kỳ ôn tập"
        className="bg-white rounded-[22px] border border-[#D9E7FF] p-4 sm:p-5 shadow-[0_4px_16px_rgba(16,42,86,0.04)] space-y-4"
      >
        {/* Hàng 1: Lớp của em + Môn học */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-[#EAF1FF]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#102A56] mr-1">
              <GraduationCap className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
              <span>Lớp của em:</span>
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn khối lớp">
              {['6', '7', '8', '9'].map(g => {
                const isSelected = selectedGrade === g;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedGrade(g);
                      setIsExamRunning(false);
                    }}
                    className={`min-h-[40px] px-4 py-1.5 rounded-full text-sm font-bold border inline-flex items-center gap-1.5 transition-all motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF] ${
                      isSelected
                        ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.28)]'
                        : 'bg-[#F8FBFF] text-[#102A56] border-[#D9E7FF] hover:bg-[#EAF3FF]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                    <span>Lớp {g}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <label
              htmlFor="semester-subject-select"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#102A56] whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
              <span>Môn học:</span>
            </label>
            <select
              id="semester-subject-select"
              value={selectedSubject}
              onChange={e => {
                setSelectedSubject(e.target.value);
                setIsExamRunning(false);
              }}
              className="min-h-[40px] min-w-[180px] sm:min-w-[200px] px-3.5 py-2 rounded-xl border border-[#D9E7FF] bg-[#F8FBFF] text-sm font-bold text-[#102A56] focus:outline-hidden focus:ring-2 focus:ring-[#0866FF] cursor-pointer"
            >
              {SUBJECT_OPTIONS.map(sub => (
                <option key={sub.value} value={sub.value}>
                  {sub.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hàng 2: Em muốn ôn kỳ nào? */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#102A56]">
            <Calendar className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
            <span>Em muốn ôn kỳ nào?</span>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
            role="group"
            aria-label="Chọn kỳ ôn tập"
          >
            {PERIOD_OPTIONS.map(period => {
              const isSelected = selectedPeriod === period.id;
              return (
                <button
                  key={period.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedPeriod(period.id);
                    setIsExamRunning(false);
                  }}
                  className={`min-h-[46px] px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-between gap-2 transition-all motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF] ${
                    isSelected
                      ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_14px_rgba(8,102,255,0.28)]'
                      : 'bg-[#F8FBFF] text-[#102A56] border-[#D9E7FF] hover:bg-[#EAF3FF]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    {period.kind === 'mid' ? (
                      <GraduationCap
                        className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#0866FF]'}`}
                        aria-hidden="true"
                      />
                    ) : (
                      <Calendar
                        className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#0866FF]'}`}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{period.label}</span>
                  </span>

                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="w-5 h-5 rounded-full bg-white text-[#0866FF] flex items-center justify-center shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.8} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. BỐ CỤC CHÍNH 2 CỘT (~2:1 TRÊN DESKTOP, 1 CỘT TRÊN TABLET/MOBILE) */}
      <div ref={workspaceTabRef} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CỘT TRÁI: Ôn kiến thức & Chọn đề thi thử */}
        <div className="lg:col-span-8 bg-white rounded-[22px] border border-[#D9E7FF] p-4 sm:p-5 shadow-[0_4px_16px_rgba(16,42,86,0.04)] space-y-4">
          {/* 2 Tabs nổi bật: Ôn kiến thức | Thi thử */}
          <div
            role="tablist"
            aria-label="Chế độ ôn tập học kỳ"
            className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#F4F8FF] border border-[#D9E7FF]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'curriculum_guide'}
              onClick={() => setActiveTab('curriculum_guide')}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF] ${
                activeTab === 'curriculum_guide'
                  ? 'bg-[#0866FF] text-white shadow-xs'
                  : 'bg-white text-[#102A56] hover:bg-[#EAF3FF]'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ôn kiến thức</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'mock_exam'}
              onClick={() => setActiveTab('mock_exam')}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF] ${
                activeTab === 'mock_exam'
                  ? 'bg-[#0866FF] text-white shadow-xs'
                  : 'bg-white text-[#102A56] hover:bg-[#EAF3FF]'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Thi thử</span>
            </button>
          </div>

          {activeTab === 'mock_exam' ? (
            /* TAB THI THỬ */
            <div role="tabpanel" className="space-y-4">
              {/* Dải ngữ cảnh gọn nhẹ */}
              <div className="rounded-xl bg-[#EAF3FF]/80 border border-[#D9E7FF] px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 font-extrabold text-[#102A56]">
                  <ClipboardList className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                  <span>
                    {selectedSubject} {selectedGrade} • {currentPeriodOption.label}
                  </span>
                </span>
                <span className="text-[#94A3B8]" aria-hidden="true">
                  |
                </span>
                <span className="text-[#526581]">
                  {selectedExam
                    ? `Đang chọn ${selectedExam.code}. Bấm "Bắt đầu thi thử" ở cột bên phải khi em sẵn sàng.`
                    : 'Chọn một đề bên dưới để bắt đầu.'}
                </span>
              </div>

              {/* Tiêu đề danh sách đề */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#102A56] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0866FF]" aria-hidden="true" />
                  <span>Chọn đề thi thử</span>
                </h2>
                {isLoading && (
                  <span className="text-xs font-semibold text-[#526581]">
                    Đang cập nhật ngân hàng câu hỏi...
                  </span>
                )}
              </div>

              {/* Lưới thẻ đề thi thử */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {availableMockExams.map(exam => {
                  const isSelected = selectedExamId === exam.id;
                  return (
                    <article
                      key={exam.id}
                      className={`relative rounded-[20px] p-3.5 flex flex-col justify-between gap-3 transition-all motion-reduce:transition-none ${
                        isSelected
                          ? 'bg-[#F8FBFF] border-2 border-[#0866FF] shadow-[0_8px_22px_rgba(8,102,255,0.14)]'
                          : 'bg-white border border-[#D9E7FF] hover:border-[#8AB8FF] hover:shadow-xs'
                      }`}
                    >
                      {isSelected && (
                        <span
                          aria-label="Đề đang được chọn"
                          className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-[#0866FF] text-white flex items-center justify-center shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </span>
                      )}

                      <div className="space-y-2.5">
                        <ExamCardIllustration3D variant={exam.variant} />

                        <div className="space-y-1 px-0.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#EAF3FF] text-[#0866FF] text-xs font-bold">
                            {exam.code}
                          </span>
                          <h3 className="text-[15px] font-extrabold text-[#102A56] leading-snug">
                            {exam.title}
                          </h3>
                          <p className="text-xs text-[#526581] leading-relaxed">
                            {exam.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#526581] border-t border-[#EAF1FF] pt-2.5 tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#0866FF]" aria-hidden="true" />
                            <span>{exam.durationMinutes} phút</span>
                          </span>
                          <span className="text-[#CBD5E1]" aria-hidden="true">
                            |
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-[#0866FF]" aria-hidden="true" />
                            <span>{exam.questionCount} câu</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedExamId(exam.id)}
                          className={`min-h-[44px] w-full rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF] ${
                            isSelected
                              ? 'bg-[#0866FF] text-white hover:bg-[#0553D6]'
                              : 'bg-[#F4F8FF] text-[#0866FF] border border-[#C7DCFA] hover:bg-[#EAF3FF]'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                          <span>{isSelected ? 'Đã chọn đề này' : 'Chọn đề này'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Thanh cấu trúc đề + Ma trận & bản đặc tả */}
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <button
                    type="button"
                    aria-expanded={isStructureExpanded}
                    onClick={() => setIsStructureExpanded(prev => !prev)}
                    className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl border border-[#D9E7FF] bg-[#F8FBFF] hover:bg-[#EAF3FF] flex items-center justify-between gap-2 text-left transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
                  >
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-[#102A56]">
                        {isStructureExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                        )}
                        <span>Xem cấu trúc đề</span>
                      </span>
                      <span className="text-[#CBD5E1]" aria-hidden="true">
                        |
                      </span>
                      <span className="text-xs sm:text-sm text-[#526581] font-medium">
                        Dạng câu hỏi • Mức độ ({totalConfigQuestions} câu • {structureConfig.durationMinutes} phút)
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMatrixModalOpen(true)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#C7DCFA] bg-white hover:bg-[#EAF3FF] text-[#0866FF] text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors motion-reduce:transition-none cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
                  >
                    <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="underline decoration-[#0866FF]/40 underline-offset-2">
                      Ma trận &amp; bản đặc tả
                    </span>
                  </button>
                </div>

                {/* Chi tiết cấu trúc đề khi bấm mở */}
                {isStructureExpanded && (
                  <div className="rounded-2xl border border-[#D9E7FF] bg-[#F8FBFF] p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-white rounded-xl border border-[#D9E7FF] p-3">
                        <div className="text-xs font-bold text-[#0866FF]">Phần I • Trắc nghiệm ABCD</div>
                        <div className="text-base font-extrabold text-[#102A56] mt-0.5 tabular-nums">
                          {structureConfig.singleChoiceCount} câu ({structureConfig.singleChoicePoints.toFixed(1)}đ)
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-[#D9E7FF] p-3">
                        <div className="text-xs font-bold text-[#0866FF]">Phần II • Đúng - Sai 4 ý</div>
                        <div className="text-base font-extrabold text-[#102A56] mt-0.5 tabular-nums">
                          {structureConfig.trueFalseCount} câu ({structureConfig.trueFalsePoints.toFixed(1)}đ)
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-[#D9E7FF] p-3">
                        <div className="text-xs font-bold text-[#0866FF]">Phần III • Tự luận / Trả lời ngắn</div>
                        <div className="text-base font-extrabold text-[#102A56] mt-0.5 tabular-nums">
                          {structureConfig.essayCount} câu ({structureConfig.essayPoints.toFixed(1)}đ)
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#526581] pt-1 border-t border-[#EAF1FF]">
                      <span>
                        Tỉ lệ mức độ nhận thức: <b className="text-[#102A56]">Nhận biết {structureConfig.knowPercent}%</b> •{' '}
                        <b className="text-[#102A56]">Thông hiểu {structureConfig.understandPercent}%</b> •{' '}
                        <b className="text-[#102A56]">Vận dụng {structureConfig.applyPercent}%</b>
                      </span>
                      <span className="font-bold text-[#102A56] tabular-nums">
                        Thang điểm 10.0 • Thời gian {structureConfig.durationMinutes} phút
                      </span>
                    </div>
                  </div>
                )}

                {/* Dải nhắc nhở trước khi bắt đầu */}
                <div className="rounded-xl border border-[#D9E7FF] bg-[#F8FBFF] px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-[#526581]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#102A56]">
                    <Info className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                    <span>Trước khi bắt đầu</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#12A879]" aria-hidden="true" />
                    <span>Kiểm tra môn và kỳ thi</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                    <span>Bài làm có tính giờ</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                    <span>Nộp bài để xem kết quả</span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* TAB ÔN KIẾN THỨC */
            <div role="tabpanel" className="space-y-4">
              <div className="rounded-xl bg-[#EAF3FF]/80 border border-[#D9E7FF] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#102A56]">
                    Kiến thức trọng tâm: {currentPeriodOption.label}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#526581] mt-0.5">
                    Môn {selectedSubjectLabel} • Lớp {selectedGrade}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenPublishedOutline}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0866FF] hover:bg-[#0553D6] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {matchingPublishedOutlines.length > 0
                        ? `Mở tài liệu đề cương (${matchingPublishedOutlines.length})`
                        : 'Tài liệu đề cương'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#D9E7FF] bg-white hover:bg-[#F4F8FF] text-[#102A56] rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                    <span>In đề cương</span>
                  </button>
                </div>
              </div>

              {noOutlineNotice && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm font-semibold text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>{noOutlineNotice}</span>
                </div>
              )}

              {/* Danh mục chương/chủ đề & bài học thật theo lớp, môn, kỳ */}
              {curriculumTopicGroups.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#526581]">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                      <span>Danh mục chương / chủ đề cần ôn ({curriculumTopicGroups.length} nhóm)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentView('student_core_knowledge')}
                      className="text-[#0866FF] hover:underline cursor-pointer"
                    >
                      Mở Kiến thức trọng tâm →
                    </button>
                  </div>

                  {curriculumTopicGroups.map((group, idx) => {
                    const isOpen = expandedTopicKeys[group.key] ?? idx === 0;
                    return (
                      <div
                        key={group.key}
                        className="rounded-2xl border border-[#D9E7FF] bg-[#F8FBFF] overflow-hidden"
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setExpandedTopicKeys(prev => ({
                              ...prev,
                              [group.key]: !isOpen
                            }))
                          }
                          className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-[#EAF3FF] transition-colors cursor-pointer"
                        >
                          <span className="text-sm font-bold text-[#102A56]">{group.title}</span>
                          <span className="inline-flex items-center gap-2 shrink-0 text-xs font-semibold text-[#526581]">
                            <span>{group.lessons.length} bài</span>
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#0866FF]" aria-hidden="true" />
                            )}
                          </span>
                        </button>

                        {isOpen && group.lessons.length > 0 && (
                          <ul className="px-4 pb-3 pt-1 border-t border-[#E6EEFF] bg-white divide-y divide-[#F1F5FF] text-sm">
                            {group.lessons.map(lesson => (
                              <li key={lesson.id} className="py-2 flex items-center justify-between gap-2 text-[#102A56]">
                                <span className="inline-flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                                  <span>{lesson.title}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-[#D9E7FF] bg-[#F8FBFF] p-5 text-sm text-[#526581] space-y-2">
                  <p className="font-bold text-[#102A56]">
                    Chưa có danh mục bài học chi tiết cho môn {selectedSubjectLabel} (Lớp {selectedGrade}).
                  </p>
                  <p>
                    Em có thể bấm nút <b>Tài liệu đề cương</b> ở trên để kiểm tra tài liệu thầy cô đã tải lên, hoặc chuyển sang tab <b>Thi thử</b> để làm đề tổng hợp.
                  </p>
                </div>
              )}

              {/* Nút chuyển nhanh sang Thi thử */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#EAF1FF]">
                <button
                  type="button"
                  onClick={() => setCurrentView('student_practice')}
                  className="text-sm font-bold text-[#0866FF] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                  <span>Luyện tập theo từng bài &amp; chương</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('mock_exam')}
                  className="min-h-[44px] px-5 py-2 bg-[#0866FF] hover:bg-[#0553D6] text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Chuyển sang chọn đề thi thử</span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: Đề em đã chọn + Cần ôn lại trước? */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Card 1: Đề em đã chọn */}
          <div className="bg-white rounded-[22px] border border-[#D9E7FF] p-5 shadow-[0_6px_20px_rgba(16,42,86,0.05)] space-y-4">
            <div className="flex items-center gap-2 text-base font-extrabold text-[#102A56] pb-3 border-b border-[#EAF1FF]">
              <ClipboardList className="w-5 h-5 text-[#0866FF]" aria-hidden="true" />
              <h2>Đề em đã chọn</h2>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="text-xl font-extrabold text-[#102A56] leading-tight">
                  {selectedExam ? selectedExam.code : 'Chưa chọn đề'}
                </div>
                <div className="text-sm font-semibold text-[#526581]">
                  {selectedSubject} • Lớp {selectedGrade}
                </div>
                <div className="text-sm font-medium text-[#526581]">
                  {currentPeriodOption.label}
                </div>
              </div>

              <SelectedExamIllustration3D />
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-sm font-bold text-[#102A56] tabular-nums">
              <div className="rounded-xl border border-[#D9E7FF] bg-[#F8FBFF] px-3 py-2.5 flex items-center justify-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                <span>{selectedExam ? `${selectedExam.questionCount} câu` : `${semesterMockExamQuestions.length} câu`}</span>
              </div>
              <div className="rounded-xl border border-[#D9E7FF] bg-[#F8FBFF] px-3 py-2.5 flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                <span>{structureConfig.durationMinutes} phút</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartSemesterExam}
              disabled={!selectedExam || semesterMockExamQuestions.length === 0 || isStartingExam}
              className="min-h-[48px] w-full rounded-xl bg-[#0866FF] hover:bg-[#0553D6] disabled:opacity-45 text-white text-[15px] font-bold flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(8,102,255,0.28)] transition-all motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
            >
              <Play className="w-4 h-4 fill-white" aria-hidden="true" />
              <span>{isStartingExam ? 'Đang mở đề...' : 'Bắt đầu thi thử'}</span>
            </button>

            <p className="text-xs text-[#526581] flex items-center justify-center gap-1.5 text-center">
              <Info className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
              <span>Đồng hồ bắt đầu khi em vào làm bài.</span>
            </p>
          </div>

          {/* Card 2: Cần ôn lại trước? */}
          <div className="rounded-[22px] border border-[#C9EEDF] bg-gradient-to-br from-[#F2FCF8] via-[#F7FCFA] to-[#EAF7FF] p-5 shadow-[0_4px_14px_rgba(16,42,86,0.04)] space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-base font-extrabold text-[#102A56] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#12A879] shrink-0" aria-hidden="true" />
                  <span>Cần ôn lại trước?</span>
                </h2>
                <p className="text-sm text-[#526581] leading-snug">
                  Xem kiến thức trọng tâm của kỳ đã chọn.
                </p>
              </div>
              <OutlineBooksIllustration3D />
            </div>

            <button
              type="button"
              onClick={handleViewOutlineTab}
              className="min-h-[44px] w-full rounded-xl bg-white hover:bg-[#EAF3FF] border border-[#8AB8FF] text-[#0866FF] text-sm font-bold flex items-center justify-center gap-2 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
            >
              <span>Xem đề cương</span>
            </button>

            <div className="pt-0.5 text-center">
              <button
                type="button"
                onClick={() => setCurrentView('student_practice')}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-[#0866FF] hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0866FF]"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>Luyện theo bài &amp; chương</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Modal Ma trận & Bản đặc tả GDPT 2018 (bảo toàn đầy đủ bảng chuẩn, không làm rối trang chính) */}
      {isMatrixModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="matrix-spec-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-[24px] border border-[#D9E7FF] shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#EAF1FF] pb-4">
              <div>
                <h3
                  id="matrix-spec-modal-title"
                  className="text-lg font-extrabold text-[#102A56]"
                >
                  Ma trận &amp; Bản đặc tả đề thi: {selectedSubjectLabel} • Lớp {selectedGrade}
                </h3>
                <p className="text-xs sm:text-sm text-[#526581] mt-0.5">
                  {currentPeriodOption.label} • Thang điểm 10.0 • Thời gian {structureConfig.durationMinutes} phút
                </p>
              </div>

              <div className="flex items-center gap-2">
                {canManageExamConfig && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMatrixModalOpen(false);
                      setIsConfigModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF3FF] hover:bg-[#DCEBFF] text-[#0866FF] border border-[#C7DCFA] rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tùy chỉnh</span>
                  </button>
                )}

                <button
                  type="button"
                  aria-label="Đóng cửa sổ ma trận"
                  onClick={() => setIsMatrixModalOpen(false)}
                  className="w-9 h-9 rounded-xl border border-[#D9E7FF] bg-[#F8FBFF] hover:bg-[#EAF3FF] flex items-center justify-center text-[#526581] hover:text-[#102A56] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bảng tỉ lệ nhận thức */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-[#F4F8FF] rounded-xl border border-[#D9E7FF] text-center">
                <span className="text-xs font-bold text-[#526581]">Nhận biết</span>
                <div className="text-2xl font-extrabold text-[#0866FF] mt-1 tabular-nums">
                  {structureConfig.knowPercent}%
                </div>
                <div className="text-xs text-[#526581] mt-0.5 tabular-nums">
                  Tương đương {(structureConfig.knowPercent / 10).toFixed(1)} điểm
                </div>
              </div>

              <div className="p-4 bg-[#EAF3FF] rounded-xl border border-[#C7DCFA] text-center">
                <span className="text-xs font-bold text-[#0866FF]">Thông hiểu</span>
                <div className="text-2xl font-extrabold text-[#102A56] mt-1 tabular-nums">
                  {structureConfig.understandPercent}%
                </div>
                <div className="text-xs text-[#526581] mt-0.5 tabular-nums">
                  Tương đương {(structureConfig.understandPercent / 10).toFixed(1)} điểm
                </div>
              </div>

              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                <span className="text-xs font-bold text-indigo-700">Vận dụng</span>
                <div className="text-2xl font-extrabold text-indigo-700 mt-1 tabular-nums">
                  {structureConfig.applyPercent}%
                </div>
                <div className="text-xs text-[#526581] mt-0.5 tabular-nums">
                  Tương đương {(structureConfig.applyPercent / 10).toFixed(1)} điểm
                </div>
              </div>
            </div>

            {/* Bảng cấu trúc chi tiết */}
            <div className="overflow-x-auto border border-[#D9E7FF] rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#EAF3FF] text-[#102A56] font-bold">
                  <tr>
                    <th className="p-3">Phần thi</th>
                    <th className="p-3">Dạng câu hỏi</th>
                    <th className="p-3">Số lượng câu</th>
                    <th className="p-3">Thang điểm</th>
                    <th className="p-3">Tỉ lệ điểm</th>
                    <th className="p-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAF1FF]">
                  <tr>
                    <td className="p-3 font-bold text-[#102A56]">Phần I</td>
                    <td className="p-3">Trắc nghiệm ABCD (1 đáp án đúng)</td>
                    <td className="p-3 font-semibold tabular-nums">
                      {structureConfig.singleChoiceCount} câu
                    </td>
                    <td className="p-3 font-semibold tabular-nums">
                      {structureConfig.singleChoicePoints.toFixed(1)} điểm (
                      {structureConfig.singleChoiceCount > 0
                        ? (
                            structureConfig.singleChoicePoints / structureConfig.singleChoiceCount
                          ).toFixed(2)
                        : 0}
                      đ/câu)
                    </td>
                    <td className="p-3 font-bold text-[#0866FF] tabular-nums">
                      {(structureConfig.singleChoicePoints * 10).toFixed(0)}%
                    </td>
                    <td className="p-3 text-[#526581]">Bao quát kiến thức trọng tâm</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-[#102A56]">Phần II</td>
                    <td className="p-3">Trắc nghiệm Đúng – Sai (4 ý a, b, c, d)</td>
                    <td className="p-3 font-semibold tabular-nums">
                      {structureConfig.trueFalseCount} câu ({structureConfig.trueFalseCount * 4} ý)
                    </td>
                    <td className="p-3 font-semibold tabular-nums">
                      {structureConfig.trueFalsePoints.toFixed(1)} điểm (
                      {structureConfig.trueFalseCount > 0
                        ? (structureConfig.trueFalsePoints / structureConfig.trueFalseCount).toFixed(2)
                        : 0}
                      đ/câu)
                    </td>
                    <td className="p-3 font-bold text-[#0866FF] tabular-nums">
                      {(structureConfig.trueFalsePoints * 10).toFixed(0)}%
                    </td>
                    <td className="p-3 text-[#526581]">
                      Đúng 1=0.1đ, 2=0.25đ, 3=0.5đ, 4=1.0đ
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-[#102A56]">Phần III</td>
                    <td className="p-3">Tự luận / Trả lời ngắn</td>
                    <td className="p-3 font-semibold tabular-nums">
                      {structureConfig.essayCount} câu
                    </td>
                    <td className="p-3 font-semibold tabular-nums">
                      {structureConfig.essayPoints.toFixed(1)} điểm (
                      {structureConfig.essayCount > 0
                        ? (structureConfig.essayPoints / structureConfig.essayCount).toFixed(2)
                        : 0}
                      đ/câu)
                    </td>
                    <td className="p-3 font-bold text-indigo-700 tabular-nums">
                      {(structureConfig.essayPoints * 10).toFixed(0)}%
                    </td>
                    <td className="p-3 text-[#526581]">Lập luận, giải thích, tính toán</td>
                  </tr>
                  <tr className="bg-[#F4F8FF] font-bold">
                    <td colSpan={2} className="p-3 text-[#102A56]">
                      Tổng cộng toàn đề
                    </td>
                    <td className="p-3 text-[#0866FF] tabular-nums">
                      {totalConfigQuestions} câu
                    </td>
                    <td className="p-3 text-[#0B6E4F] tabular-nums">10.0 điểm</td>
                    <td className="p-3 text-[#0B6E4F] tabular-nums">100%</td>
                    <td className="p-3 text-[#526581] tabular-nums">
                      Thời gian làm bài: {structureConfig.durationMinutes} phút
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal tùy chỉnh ma trận số câu cho giáo viên */}
      {canManageExamConfig && (
        <ExamStructureConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          initialSubject={selectedSubject}
          onStructureUpdated={cfg => setStructureConfig(cfg)}
        />
      )}
    </div>
  );
};
