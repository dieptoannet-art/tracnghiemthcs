import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Question, CognitiveLevel, QuestionType, Grade } from '../../types';
import { MathView } from '../MathView';
import { supabase } from '../../lib/supabase';
import {
  normalizeGrade,
  normalizeSubject,
  isQuestionInSubject,
  getSubjectDisplayName
} from '../teacher/QuestionBank';
import { CANONICAL_SUBJECT_CATALOG } from '../../utils/subjectCatalog';
import {
  PracticeBannerIllustration3D,
  PracticeReadyIllustration3D,
  SubjectThumbnail3D
} from './practiceIllustrations3D';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  Flag,
  Clock,
  Award,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText,
  GraduationCap,
  ListChecks,
  AlertOctagon,
  RefreshCw,
  Sliders,
  BarChart3,
  Camera,
  Image as ImageIcon,
  Upload,
  Trash2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Paperclip,
  Play,
  Target,
  BookMarked,
  AlertCircle
} from 'lucide-react';

interface NormalizedPracticeQuestion extends Question {
  rawSubItems?: { id: string; label: string; text: string; isCorrect?: boolean; level?: string }[];
}

export const PracticeMode: React.FC = () => {
  const {
    questions: localQuestions,
    selectedGrade: contextGrade,
    selectedSubject: contextSubject,
    user,
    userProfile,
    setCurrentView
  } = useApp();

  // ==========================================
  // 1. DATA SOURCE: SUPABASE + LOCAL QUESTIONS
  // ==========================================
  const [supabaseQuestions, setSupabaseQuestions] = useState<any[]>([]);
  const [protectedSolutions, setProtectedSolutions] = useState<Map<string, any>>(new Map());
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);

  const canAccessSolutions = useMemo(() => {
    const role = userProfile?.role;
    return role === 'teacher' || role === 'admin' || role === 'reviewer';
  }, [userProfile]);

  // Load questions from Supabase (combining priority Tin học + all batches + solutions)
  const loadQuestionsFromSupabase = useCallback(async () => {
    setIsLoadingQuestions(true);
    try {
      const qMap = new Map<string, any>();

      // 1. Tải ưu tiên môn Tin học (đặc biệt là 272 câu Lớp 6 và các câu TH7, TH8, TH9)
      try {
        let page = 0;
        let hasMore = true;
        while (hasMore && page < 5) {
          const from = page * 1000;
          const to = from + 999;
          const { data: tinHocData, error } = await supabase
            .from('questions')
            .select('*')
            .or('subject.ilike.%tin%,subject.ilike.%informatics%,code.ilike.TH%')
            .range(from, to);

          if (error || !tinHocData || tinHocData.length === 0) {
            hasMore = false;
          } else {
            tinHocData.forEach((q: any) => {
              if (q.id) qMap.set(q.id, q);
            });
            if (tinHocData.length < 1000) hasMore = false;
            page++;
          }
        }
      } catch (tErr) {
        console.warn('Lỗi khi nạp câu hỏi Tin học cho luyện tập:', tErr);
      }

      // 2. Tải thêm câu hỏi từ bảng questions theo phân trang
      try {
        let page = 0;
        let hasMore = true;
        while (hasMore && page < 5) {
          const from = page * 1000;
          const to = from + 999;
          const { data: qBatch, error } = await supabase
            .from('questions')
            .select('*')
            .order('id', { ascending: true })
            .range(from, to);

          if (error || !qBatch || qBatch.length === 0) {
            hasMore = false;
          } else {
            qBatch.forEach((q: any) => {
              if (q.id && !qMap.has(q.id)) {
                qMap.set(q.id, q);
              }
            });
            if (qBatch.length < 1000) hasMore = false;
            page++;
          }
        }
      } catch (qErr) {
        console.warn('Lỗi khi nạp lô câu hỏi Supabase:', qErr);
      }

      setSupabaseQuestions(Array.from(qMap.values()));

      // 3. Tải lời giải chi tiết từ protected_solutions nếu có quyền
      if (canAccessSolutions) {
        try {
          let page = 0;
          let hasMore = true;
          const solMap = new Map<string, any>();
          while (hasMore && page < 5) {
            const from = page * 1000;
            const to = from + 999;
            const { data: solBatch, error } = await supabase
              .from('protected_solutions')
              .select('*')
              .range(from, to);

            if (error || !solBatch || solBatch.length === 0) {
              hasMore = false;
            } else {
              solBatch.forEach((s: any) => {
                if (s.question_id) solMap.set(s.question_id, s);
              });
              if (solBatch.length < 1000) hasMore = false;
              page++;
            }
          }
          setProtectedSolutions(solMap);
        } catch (sErr) {
          console.warn('Lỗi khi nạp protected_solutions cho luyện tập:', sErr);
        }
      }
    } catch (err) {
      console.warn('Ngoại lệ khi nạp câu hỏi Supabase:', err);
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [canAccessSolutions]);

  useEffect(() => {
    loadQuestionsFromSupabase();
  }, [loadQuestionsFromSupabase]);

  // Hợp nhất toàn bộ câu hỏi (Supabase + Local) và chuẩn hóa cấu trúc
  const allMasterQuestions = useMemo<NormalizedPracticeQuestion[]>(() => {
    const combinedMap = new Map<string, NormalizedPracticeQuestion>();

    // 1. Nạp từ local questions
    (localQuestions || []).forEach(q => {
      combinedMap.set(q.id, {
        ...q,
        rawSubItems: q.subItems || []
      });
    });

    // 2. Nạp từ Supabase questions
    supabaseQuestions.forEach((sq: any) => {
      const sol = protectedSolutions.get(sq.id);

      // Parse options an toàn
      let parsedOptions: any[] = [];
      if (Array.isArray(sq.options)) {
        parsedOptions = sq.options;
      } else if (typeof sq.options === 'string') {
        try {
          parsedOptions = JSON.parse(sq.options);
        } catch {
          parsedOptions = [];
        }
      }

      // Chuẩn hóa nhãn A, B, C, D cho options
      const formattedOptions = parsedOptions.map((opt, i) => {
        const label = opt.label || String.fromCharCode(65 + i);
        return {
          id: opt.id || `opt-${i}`,
          label,
          text: opt.text || ''
        };
      });

      // Parse sub_items an toàn cho câu đúng sai
      let parsedSubItems: any[] = [];
      if (Array.isArray(sq.sub_items)) {
        parsedSubItems = sq.sub_items;
      } else if (typeof sq.sub_items === 'string') {
        try {
          parsedSubItems = JSON.parse(sq.sub_items);
        } catch {
          parsedSubItems = [];
        }
      }

      // Ghép đáp án đúng/sai nếu có từ solution
      const subItemAnswers: any[] = sol?.sub_item_answers
        ? Array.isArray(sol.sub_item_answers)
          ? sol.sub_item_answers
          : typeof sol.sub_item_answers === 'string'
          ? (() => {
              try {
                return JSON.parse(sol.sub_item_answers);
              } catch {
                return [];
              }
            })()
          : []
        : [];

      const formattedSubItems = parsedSubItems.map((item, idx) => {
        const itemAns = subItemAnswers.find((a: any) => a.id === item.id || a.label === item.label);
        return {
          id: item.id || `sub-${idx}`,
          label: item.label || String.fromCharCode(97 + idx),
          text: item.text || '',
          level: item.level || 'know',
          isCorrect: itemAns !== undefined ? Boolean(itemAns.isCorrect) : item.isCorrect
        };
      });

      const normalizedQ: NormalizedPracticeQuestion = {
        id: sq.id,
        code: sq.code || `Q-${sq.id.slice(0, 8)}`,
        grade: (normalizeGrade(sq.grade) || '6') as Grade,
        subject: sq.subject || 'Tin học',
        textbook: sq.textbook || 'Kết nối tri thức với cuộc sống',
        chapter: sq.chapter || 'Chủ đề chung',
        lesson: sq.lesson || 'Bài học chung',
        yccd: sq.yccd || '',
        competency: sq.competency || '',
        level: (sq.level as CognitiveLevel) || 'know',
        type: (sq.type as QuestionType) || 'single_choice',
        stem: sq.stem || '',
        points: Number(sq.points) || 1.0,
        options: formattedOptions,
        subItems: formattedSubItems,
        rawSubItems: formattedSubItems,
        correctAnswer: sol?.correct_answer || sq.correctAnswer || (formattedOptions[0]?.label || 'A'),
        explanation: sol?.explanation || sq.explanation || 'Xem lại kiến thức lý thuyết trong sách giáo khoa.',
        acceptedAnswers: sol?.accepted_answers || sq.acceptedAnswers || [],
        rubric: sol?.rubric || sq.rubric || undefined,
        sampleAnswer: sol?.sample_answer || sq.sample_answer || sq.sampleAnswer || undefined,
        status: sq.status || 'approved',
        author: sq.author || 'Tổ Chuyên môn THCS Tây Đô',
        version: sq.version || 1
      };

      combinedMap.set(sq.id, normalizedQ);
    });

    return Array.from(combinedMap.values());
  }, [localQuestions, supabaseQuestions, protectedSolutions]);

  // ==========================================
  // 2. CONFIGURATION & FILTERING STATES
  // ==========================================
  // Khối lớp: mặc định Lớp 6 (hoặc lớp người dùng đang học)
  const [selectedGrade, setSelectedGrade] = useState<string>(() => {
    return normalizeGrade(contextGrade) || '6';
  });

  // Môn học: mặc định Tin học (nếu có câu hỏi) hoặc Toán
  const [selectedSubject, setSelectedSubject] = useState<string>('Tin học');

  // Bộ sách giáo khoa
  const [selectedTextbook, setSelectedTextbook] = useState<string>('all');

  // Chương / Chủ đề & Bài học cụ thể
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  const [selectedLesson, setSelectedLesson] = useState<string>('all');

  // Mức độ nhận thức & Dạng câu
  const [targetLevel, setTargetLevel] = useState<string>('all');
  const [targetType, setTargetType] = useState<string>('all');

  // Số lượng câu hỏi & Phương thức làm bài
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [practiceModeType, setPracticeModeType] = useState<'instant' | 'timed_exam'>('instant');
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [showInstantSolution, setShowInstantSolution] = useState<boolean>(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isStartingSession, setIsStartingSession] = useState<boolean>(false);
  const startingLockRef = useRef<boolean>(false);
  const step1Ref = useRef<HTMLElement | null>(null);
  const step2Ref = useRef<HTMLElement | null>(null);
  const step3Ref = useRef<HTMLElement | null>(null);

  // ==========================================
  // 3. DYNAMIC CURRICULUM LISTS
  // ==========================================
  // Danh sách các bộ sách có sẵn cho khối + môn đã chọn
  const availableTextbooks = useMemo(() => {
    const tbSet = new Set<string>();
    allMasterQuestions.forEach(q => {
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;
      const matchSub = isQuestionInSubject(q, selectedSubject);
      if (matchGrade && matchSub && q.textbook) {
        tbSet.add(q.textbook);
      }
    });
    return Array.from(tbSet).sort();
  }, [allMasterQuestions, selectedGrade, selectedSubject]);

  // Danh sách các Chương / Chủ đề thực tế có trong ngân hàng
  const availableChapters = useMemo(() => {
    const chSet = new Set<string>();
    allMasterQuestions.forEach(q => {
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;
      const matchSub = isQuestionInSubject(q, selectedSubject);
      const matchTb = selectedTextbook === 'all' || q.textbook === selectedTextbook;
      if (matchGrade && matchSub && matchTb && q.chapter) {
        chSet.add(q.chapter);
      }
    });
    return Array.from(chSet).sort();
  }, [allMasterQuestions, selectedGrade, selectedSubject, selectedTextbook]);

  // Danh sách các Bài học cụ thể thực tế có trong chương đã chọn
  const availableLessons = useMemo(() => {
    const lSet = new Set<string>();
    allMasterQuestions.forEach(q => {
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;
      const matchSub = isQuestionInSubject(q, selectedSubject);
      const matchTb = selectedTextbook === 'all' || q.textbook === selectedTextbook;
      const matchCh = selectedChapter === 'all' || q.chapter === selectedChapter;
      if (matchGrade && matchSub && matchTb && matchCh && q.lesson) {
        lSet.add(q.lesson);
      }
    });
    return Array.from(lSet).sort();
  }, [allMasterQuestions, selectedGrade, selectedSubject, selectedTextbook, selectedChapter]);

  // Danh sách câu hỏi thỏa mãn tất cả tiêu chí đã chọn
  const availableQuestions = useMemo(() => {
    return allMasterQuestions.filter(q => {
      // 1. Khối lớp
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;

      // 2. Môn học
      const matchSub = isQuestionInSubject(q, selectedSubject);

      // 3. Bộ sách
      const matchTb = selectedTextbook === 'all' || q.textbook === selectedTextbook;

      // 4. Chủ đề / Chương
      const matchCh = selectedChapter === 'all' || q.chapter === selectedChapter;

      // 5. Bài học
      const matchLs = selectedLesson === 'all' || q.lesson === selectedLesson;

      // 6. Mức độ nhận thức
      const matchLvl = targetLevel === 'all' || q.level === targetLevel;

      // 7. Dạng câu
      const matchType = targetType === 'all' || q.type === targetType;

      // 8. Trạng thái: Giáo viên/Admin luyện tập được cả câu pending/draft; học sinh ưu tiên approved hoặc toàn bộ câu có sẵn
      const isEligibleStatus =
        canAccessSolutions || q.status === 'approved' || q.status === 'pending';

      return matchGrade && matchSub && matchTb && matchCh && matchLs && matchLvl && matchType && isEligibleStatus;
    });
  }, [
    allMasterQuestions,
    selectedGrade,
    selectedSubject,
    selectedTextbook,
    selectedChapter,
    selectedLesson,
    targetLevel,
    targetType,
    canAccessSolutions
  ]);

  // Danh sách khối lớp hiện có từ hệ thống (mặc định 6–9 + mở rộng nếu có trong dữ liệu)
  const availableGrades = useMemo(() => {
    const gradeSet = new Set<string>(['6', '7', '8', '9']);
    allMasterQuestions.forEach(q => {
      const g = normalizeGrade(q.grade);
      if (g) gradeSet.add(g);
    });
    return Array.from(gradeSet).sort((a, b) => Number(a) - Number(b));
  }, [allMasterQuestions]);

  // Danh sách môn học lấy từ danh mục hệ thống + môn phát sinh từ ngân hàng câu hỏi
  const availableSubjects = useMemo(() => {
    const priorityOrder = ['tin_hoc', 'toan', 'khtn', 'ngu_van', 'tieng_anh', 'cong_nghe', 'lich_su_dia_li', 'gdcd'];
    const mapByNorm = new Map<string, { id: string; label: string; normKey: string }>();

    CANONICAL_SUBJECT_CATALOG.forEach(item => {
      const normKey = normalizeSubject(item.name);
      const id = item.id === 'math' ? 'Toán' : item.name;
      const label = item.id === 'math' ? 'Toán học' : item.name;
      if (!mapByNorm.has(normKey)) {
        mapByNorm.set(normKey, { id, label, normKey });
      }
    });

    allMasterQuestions.forEach(q => {
      if (!q.subject) return;
      const normKey = normalizeSubject(q.subject);
      if (normKey && !mapByNorm.has(normKey)) {
        mapByNorm.set(normKey, {
          id: q.subject,
          label: getSubjectDisplayName(q.subject),
          normKey
        });
      }
    });

    return Array.from(mapByNorm.values()).sort((a, b) => {
      const ia = priorityOrder.indexOf(a.normKey);
      const ib = priorityOrder.indexOf(b.normKey);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.label.localeCompare(b.label, 'vi');
    });
  }, [allMasterQuestions]);

  // Đảm bảo lựa chọn con không bị kẹt ở giá trị không hợp lệ khi đổi lớp/môn/bộ sách/chương
  useEffect(() => {
    if (isLoadingQuestions) return;
    if (selectedTextbook !== 'all' && !availableTextbooks.includes(selectedTextbook)) {
      setSelectedTextbook('all');
    }
  }, [isLoadingQuestions, selectedTextbook, availableTextbooks]);

  useEffect(() => {
    if (isLoadingQuestions) return;
    if (selectedChapter !== 'all' && !availableChapters.includes(selectedChapter)) {
      setSelectedChapter('all');
    }
  }, [isLoadingQuestions, selectedChapter, availableChapters]);

  useEffect(() => {
    if (isLoadingQuestions) return;
    if (selectedLesson !== 'all' && !availableLessons.includes(selectedLesson)) {
      setSelectedLesson('all');
    }
  }, [isLoadingQuestions, selectedLesson, availableLessons]);

  // ==========================================
  // 4. ACTIVE PRACTICE SESSION STATES
  // ==========================================
  const [isPracticing, setIsPracticing] = useState<boolean>(false);
  const [practiceQuestions, setPracticeQuestions] = useState<NormalizedPracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, any>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Timer states
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);

  // Trạng thái đính kèm ảnh và tệp tài liệu cho câu tự luận
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    title: string;
    zoom: number;
    rotation: number;
  } | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Nén ảnh client-side nhằm tối ưu hiệu năng và bộ nhớ trình duyệt
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = event => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 1600;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('Lỗi nạp ảnh'));
      };
      reader.onerror = () => reject(new Error('Lỗi đọc tệp ảnh'));
    });
  };

  // Xoay ảnh base64 90 độ
  const rotateImageBase64 = (base64: string, callback: (rotated: string) => void) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        callback(canvas.toDataURL('image/jpeg', 0.85));
      }
    };
  };

  // Lấy dữ liệu bài làm tự luận an toàn
  const getEssayState = (qId: string): { text: string; images: string[]; files: { name: string; size: number; dataUrl: string }[] } => {
    const val = selectedAnswers[qId];
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      return {
        text: typeof val.text === 'string' ? val.text : '',
        images: Array.isArray(val.images) ? val.images : [],
        files: Array.isArray(val.files) ? val.files : []
      };
    }
    return {
      text: typeof val === 'string' ? val : '',
      images: [],
      files: []
    };
  };

  // Xử lý thay đổi văn bản tự luận
  const handleEssayTextChange = (qId: string, text: string) => {
    if (isFinished) return;
    const current = getEssayState(qId);
    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: { ...current, text }
    }));
  };

  // Thêm ảnh chụp bài làm (Camera hoặc Thư viện)
  const handleAddEssayImages = async (qId: string, files: FileList | null) => {
    if (!files || files.length === 0 || isFinished) return;
    setIsProcessingImage(true);
    try {
      const current = getEssayState(qId);
      const remainingSlots = Math.max(0, 5 - current.images.length);
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      const compressedList: string[] = [];
      for (const file of filesToProcess) {
        try {
          const comp = await compressImageFile(file);
          compressedList.push(comp);
        } catch (e) {
          console.warn('Lỗi xử lý ảnh:', e);
        }
      }

      const updatedImages = [...current.images, ...compressedList];
      setSelectedAnswers(prev => ({
        ...prev,
        [qId]: { ...current, images: updatedImages }
      }));
    } finally {
      setIsProcessingImage(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Thêm tệp tài liệu / bài nộp tự luận (PDF, DOC, TXT, ...)
  const handleAddEssayDocs = async (qId: string, files: FileList | null) => {
    if (!files || files.length === 0 || isFinished) return;
    setIsProcessingImage(true);
    try {
      const current = getEssayState(qId);
      const remainingSlots = Math.max(0, 3 - current.files.length);
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      const newDocs: { name: string; size: number; dataUrl: string }[] = [];
      for (const file of filesToProcess) {
        try {
          if (file.type.startsWith('image/')) {
            const comp = await compressImageFile(file);
            newDocs.push({ name: file.name, size: file.size, dataUrl: comp });
          } else {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = e => resolve(e.target?.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            newDocs.push({ name: file.name, size: file.size, dataUrl });
          }
        } catch (e) {
          console.warn('Lỗi nạp tệp:', e);
        }
      }

      const updatedDocs = [...current.files, ...newDocs];
      setSelectedAnswers(prev => ({
        ...prev,
        [qId]: { ...current, files: updatedDocs }
      }));
    } finally {
      setIsProcessingImage(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  // Xoay ảnh bài làm
  const handleRotateEssayImage = (qId: string, imgIdx: number) => {
    const current = getEssayState(qId);
    if (!current.images[imgIdx]) return;
    rotateImageBase64(current.images[imgIdx], rotated => {
      const updatedImages = [...current.images];
      updatedImages[imgIdx] = rotated;
      setSelectedAnswers(prev => ({
        ...prev,
        [qId]: { ...current, images: updatedImages }
      }));
      if (previewModal && previewModal.url === current.images[imgIdx]) {
        setPreviewModal(prev => prev ? { ...prev, url: rotated } : null);
      }
    });
  };

  // Xóa ảnh bài làm
  const handleRemoveEssayImage = (qId: string, imgIdx: number) => {
    const current = getEssayState(qId);
    const updatedImages = current.images.filter((_, i) => i !== imgIdx);
    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: { ...current, images: updatedImages }
    }));
  };

  // Xóa tệp đính kèm
  const handleRemoveEssayFile = (qId: string, fileIdx: number) => {
    const current = getEssayState(qId);
    const updatedDocs = current.files.filter((_, i) => i !== fileIdx);
    setSelectedAnswers(prev => ({
      ...prev,
      [qId]: { ...current, files: updatedDocs }
    }));
  };

  // Stopwatch timer during practice
  useEffect(() => {
    let interval: any = null;
    if (isPracticing && !isFinished && timerActive) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPracticing, isFinished, timerActive]);

  useEffect(() => {
    startingLockRef.current = false;
    setIsStartingSession(false);
  }, [isPracticing]);

  // Bắt đầu phiên luyện tập (chống bấm lặp tạo nhiều phiên)
  const handleStartPractice = (overrideQuestions?: NormalizedPracticeQuestion[]) => {
    if (startingLockRef.current) return;
    const sourceQuestions = overrideQuestions || availableQuestions;
    if (sourceQuestions.length === 0) return;

    startingLockRef.current = true;
    setIsStartingSession(true);

    let pool = [...sourceQuestions];
    if (shuffleQuestions) {
      pool.sort(() => 0.5 - Math.random());
    }

    const countToPick = questionCount >= 9999 ? pool.length : Math.min(questionCount, pool.length);
    const selected = pool.slice(0, countToPick);
    if (selected.length === 0) {
      startingLockRef.current = false;
      setIsStartingSession(false);
      return;
    }

    setPracticeQuestions(selected);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setRevealedSolutions({});
    setFlaggedQuestions({});
    setSecondsElapsed(0);
    setTimerActive(true);
    setIsFinished(false);
    setIsPracticing(true);
  };

  const currentQ = practiceQuestions[currentIndex];

  // Trả lời câu hỏi trắc nghiệm ABCD
  const handleSelectOption = (optLabel: string) => {
    if (isFinished) return;
    setSelectedAnswers(prev => ({ ...prev, [currentQ.id]: optLabel }));
    if (practiceModeType === 'instant' && showInstantSolution) {
      setRevealedSolutions(prev => ({ ...prev, [currentQ.id]: true }));
    }
  };

  // Trả lời câu hỏi Đúng - Sai từng ý a, b, c, d
  const handleTrueFalseSelect = (subItemId: string, val: boolean) => {
    if (isFinished) return;
    setSelectedAnswers(prev => {
      const current = prev[currentQ.id] || {};
      return {
        ...prev,
        [currentQ.id]: {
          ...current,
          [subItemId]: val
        }
      };
    });
  };

  // Trả lời câu hỏi ngắn
  const handleShortAnswerChange = (val: string) => {
    if (isFinished) return;
    setSelectedAnswers(prev => ({ ...prev, [currentQ.id]: val }));
  };

  // Đánh dấu cờ câu hỏi
  const toggleFlagQuestion = (qId: string) => {
    setFlaggedQuestions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Bật/tắt xem lời giải chi tiết cho câu hiện tại
  const toggleRevealSolution = (qId: string) => {
    setRevealedSolutions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  // ==========================================
  // 5. SCORE CALCULATION & WRONG QUESTIONS
  // ==========================================
  const sessionAnalytics = useMemo(() => {
    let totalScore = 0;
    let maxPossibleScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const questionResults: {
      question: NormalizedPracticeQuestion;
      isCorrect: boolean;
      pointsAwarded: number;
      maxPoints: number;
      userAns: any;
    }[] = [];

    practiceQuestions.forEach(q => {
      const ans = selectedAnswers[q.id];
      const qMaxPoints = q.points || 1.0;
      maxPossibleScore += qMaxPoints;

      if (ans === undefined || ans === null || ans === '') {
        unansweredCount++;
        questionResults.push({
          question: q,
          isCorrect: false,
          pointsAwarded: 0,
          maxPoints: qMaxPoints,
          userAns: null
        });
        return;
      }

      if (q.type === 'single_choice') {
        const isCorrect = String(ans).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase();
        if (isCorrect) {
          totalScore += qMaxPoints;
          correctCount++;
        } else {
          wrongCount++;
        }
        questionResults.push({
          question: q,
          isCorrect,
          pointsAwarded: isCorrect ? qMaxPoints : 0,
          maxPoints: qMaxPoints,
          userAns: ans
        });
      } else if (q.type === 'true_false_group') {
        const subItems = q.subItems || q.rawSubItems || [];
        const itemAnswers = (ans as Record<string, boolean>) || {};
        let subCorrect = 0;

        subItems.forEach(item => {
          if (itemAnswers[item.id] !== undefined && itemAnswers[item.id] === item.isCorrect) {
            subCorrect += 1;
          }
        });

        // Thang điểm chuẩn Bộ GD&ĐT GDPT 2018 cho câu Đúng - Sai 4 ý
        let pts = 0;
        if (subCorrect === 1) pts = 0.1;
        else if (subCorrect === 2) pts = 0.25;
        else if (subCorrect === 3) pts = 0.5;
        else if (subCorrect === 4) pts = 1.0;

        totalScore += pts;
        const isFullyCorrect = subCorrect === subItems.length && subItems.length > 0;
        if (isFullyCorrect) correctCount++;
        else wrongCount++;

        questionResults.push({
          question: q,
          isCorrect: isFullyCorrect,
          pointsAwarded: pts,
          maxPoints: 1.0,
          userAns: itemAnswers
        });
      } else if (q.type === 'short_answer') {
        const normalized = String(ans).trim().toLowerCase();
        const isMatch = (q.acceptedAnswers || []).some(a => a.toLowerCase().trim() === normalized);
        if (isMatch) {
          totalScore += qMaxPoints;
          correctCount++;
        } else {
          wrongCount++;
        }
        questionResults.push({
          question: q,
          isCorrect: isMatch,
          pointsAwarded: isMatch ? qMaxPoints : 0,
          maxPoints: qMaxPoints,
          userAns: ans
        });
      } else if (q.type === 'essay') {
        const essayState = typeof ans === 'object' && ans !== null
          ? ans
          : { text: typeof ans === 'string' ? ans : '', images: [], files: [] };
        const hasText = Boolean(essayState.text && essayState.text.trim().length > 0);
        const hasFiles = Boolean((essayState.images && essayState.images.length > 0) || (essayState.files && essayState.files.length > 0));
        const isAttempted = hasText || hasFiles;

        if (isAttempted) {
          totalScore += qMaxPoints;
          correctCount++;
        } else {
          wrongCount++;
        }

        questionResults.push({
          question: q,
          isCorrect: isAttempted,
          pointsAwarded: isAttempted ? qMaxPoints : 0,
          maxPoints: qMaxPoints,
          userAns: essayState
        });
      } else {
        questionResults.push({
          question: q,
          isCorrect: true,
          pointsAwarded: qMaxPoints,
          maxPoints: qMaxPoints,
          userAns: ans
        });
      }
    });

    // Điểm quy đổi theo thang 10
    const scaledScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 10 : 0;

    return {
      totalScore: Number(totalScore.toFixed(2)),
      scaledScore: Number(scaledScore.toFixed(1)),
      maxPossibleScore,
      correctCount,
      wrongCount,
      unansweredCount,
      questionResults
    };
  }, [practiceQuestions, selectedAnswers]);

  // Hoàn tất phiên và lưu các câu sai vào Sổ câu sai LocalStorage
  const handleFinishPractice = () => {
    setTimerActive(false);
    setIsFinished(true);

    // Lưu các câu sai vào localStorage để liên kết với Sổ câu sai
    try {
      const wrongList = sessionAnalytics.questionResults.filter(r => !r.isCorrect);
      if (wrongList.length > 0) {
        const existingWrongIds: string[] = JSON.parse(
          localStorage.getItem('taydo_wrong_question_ids') || '[]'
        );
        const newIds = wrongList.map(r => r.question.id);
        const combined = Array.from(new Set([...existingWrongIds, ...newIds]));
        localStorage.setItem('taydo_wrong_question_ids', JSON.stringify(combined));
      }
    } catch (e) {
      console.warn('Lỗi lưu sổ câu sai:', e);
    }
  };

  // Luyện tập lại chỉ những câu đã làm sai
  const handleRetryWrongOnly = () => {
    const wrongQuestions = sessionAnalytics.questionResults
      .filter(r => !r.isCorrect)
      .map(r => r.question);

    if (wrongQuestions.length > 0) {
      handleStartPractice(wrongQuestions);
    }
  };

  // Định dạng thời gian mm:ss
  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Nhãn hiển thị môn học và trạng thái tùy chỉnh nâng cao
  const selectedSubjectMeta = availableSubjects.find(
    s => normalizeSubject(s.id) === normalizeSubject(selectedSubject)
  );
  const selectedSubjectDisplay = selectedSubjectMeta?.label || getSubjectDisplayName(selectedSubject);

  const customFilterLabels = useMemo(() => {
    const items: string[] = [];
    if (targetType === 'single_choice') items.push('Trắc nghiệm ABCD');
    else if (targetType === 'true_false_group') items.push('Đúng – Sai 4 ý');
    else if (targetType === 'essay') items.push('Tự luận');

    if (targetLevel === 'know') items.push('Mức độ: Biết');
    else if (targetLevel === 'understand') items.push('Mức độ: Hiểu');
    else if (targetLevel === 'apply') items.push('Mức độ: Vận dụng');

    if (!shuffleQuestions) items.push('Không đảo câu');
    if (practiceModeType === 'instant' && !showInstantSolution) items.push('Tự mở giải thích');
    return items;
  }, [targetType, targetLevel, shuffleQuestions, practiceModeType, showInstantSolution]);

  const hasCustomAdvancedSettings = customFilterLabels.length > 0;
  const plannedQuestionCount =
    availableQuestions.length === 0
      ? 0
      : Math.min(
          questionCount >= 9999 ? availableQuestions.length : questionCount,
          availableQuestions.length
        );

  const scopeSummaryText = useMemo(() => {
    if (selectedLesson !== 'all') return selectedLesson;
    if (selectedChapter !== 'all') return selectedChapter;
    return 'Tất cả chương / chủ đề';
  }, [selectedChapter, selectedLesson]);

  const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
    if (!ref.current) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start'
    });
  };

  // ==========================================
  // RENDER INTERFACE
  // ==========================================
  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto pb-8">
      {/* 1. COMPACT BANNER HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-[#C6E0FF] bg-gradient-to-r from-[#DCEEFF] via-[#EAF5FF] to-[#D6ECFF] px-5 py-4 sm:px-7 sm:py-5 shadow-[0_6px_20px_rgba(16,42,82,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative z-10 flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#3B9EFF] to-[#1363DF] text-white shadow-[0_6px_14px_rgba(23,107,255,0.28)] border border-white/60 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-[28px] font-extrabold text-[#0B2A52] tracking-tight leading-tight">
              Luyện tập theo bài &amp; chương
            </h1>
            <p className="text-sm sm:text-[15px] text-[#334E70] font-medium mt-1">
              Chọn bài học và bắt đầu luyện tập theo cách của em.
            </p>
          </div>
        </div>

        <div className="relative z-10 hidden sm:flex items-center justify-end shrink-0 -my-2">
          <PracticeBannerIllustration3D />
        </div>
      </div>

      {/* Khu vực quản trị / giáo viên tách khỏi luồng luyện tập của học sinh */}
      {canAccessSolutions && !isPracticing && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white border border-[#DCE8F7] text-xs text-[#334E70]">
          <span className="font-medium">
            Chế độ Giáo viên / Quản trị: đang nạp{' '}
            <strong className="text-[#0B2A52] tabular-nums">{allMasterQuestions.length}</strong> câu hỏi từ ngân hàng.
          </span>
          <button
            type="button"
            onClick={loadQuestionsFromSupabase}
            disabled={isLoadingQuestions}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-[#CFDCED] bg-[#F6FAFF] hover:bg-[#EAF3FF] text-[#0B2A52] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#006BFF] ${isLoadingQuestions ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            <span>{isLoadingQuestions ? 'Đang tải...' : 'Cập nhật ngân hàng'}</span>
          </button>
        </div>
      )}

      {/* 2. CONFIGURATION SCREEN (KHI CHƯA VÀO PHIÊN LUYỆN TẬP) */}
      {!isPracticing ? (
        <div className="space-y-5">
          {/* Dải hướng dẫn 3 bước (hướng dẫn trên cùng một trang, không phải biểu mẫu từng bước) */}
          <nav aria-label="Hướng dẫn các bước luyện tập" className="px-2">
            <ol className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm font-semibold text-[#1E3A5F]">
              <li className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollToSection(step1Ref)}
                  className="inline-flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-white/80 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-[#006BFF] text-white text-xs font-bold flex items-center justify-center tabular-nums">
                    1
                  </span>
                  <span className="text-[#0B2A52] font-bold whitespace-nowrap">Chọn lớp &amp; môn</span>
                </button>
              </li>
              <li aria-hidden="true" className="hidden sm:block flex-1 max-w-[90px] h-px bg-[#C7DAEF]" />
              <li className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollToSection(step2Ref)}
                  className="inline-flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-white/80 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-[#DCE8F7] text-[#1E3A5F] text-xs font-bold flex items-center justify-center tabular-nums">
                    2
                  </span>
                  <span className="text-[#334E70] whitespace-nowrap">Chọn bài học</span>
                </button>
              </li>
              <li aria-hidden="true" className="hidden sm:block flex-1 max-w-[90px] h-px bg-[#C7DAEF]" />
              <li className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollToSection(step3Ref)}
                  className="inline-flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-white/80 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-[#DCE8F7] text-[#1E3A5F] text-xs font-bold flex items-center justify-center tabular-nums">
                    3
                  </span>
                  <span className="text-[#334E70] whitespace-nowrap">Bắt đầu luyện tập</span>
                </button>
              </li>
            </ol>
          </nav>

          {/* Bố cục chính 2 cột ~ 2:1 trên desktop, 1 cột trên màn hình nhỏ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* CỘT TRÁI (2 phần): Các khối chọn nội dung và cách luyện */}
            <div className="lg:col-span-8 space-y-5 min-w-0">
              {/* KHỐI 1: Em muốn học môn gì? */}
              <section
                ref={step1Ref}
                aria-labelledby="practice-step-1-heading"
                className="bg-white rounded-2xl border border-[#CFDCED] p-5 sm:p-6 shadow-[0_3px_14px_rgba(16,42,82,0.04)] space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#006BFF] flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h2 id="practice-step-1-heading" className="text-lg sm:text-xl font-bold text-[#0B2A52]">
                    1. Em muốn học môn gì?
                  </h2>
                </div>

                {/* Chọn khối lớp (gọn, rõ, không nhồi số câu) */}
                <div className="flex flex-wrap gap-2.5" role="group" aria-label="Chọn khối lớp">
                  {availableGrades.map(g => {
                    const isSelected = selectedGrade === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedGrade(g);
                          setSelectedChapter('all');
                          setSelectedLesson('all');
                        }}
                        className={`min-h-[42px] px-5 py-2 rounded-xl border text-sm font-bold inline-flex items-center gap-1.5 transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer ${
                          isSelected
                            ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-[0_4px_12px_rgba(0,107,255,0.28)]'
                            : 'bg-white text-[#1E3A5F] border-[#CFDCED] hover:bg-[#F3F8FF] hover:border-[#8AB8FF]'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        <span>Lớp {g}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Các thẻ môn học từ hệ thống */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1"
                  role="group"
                  aria-label="Chọn môn học"
                >
                  {availableSubjects.map(sub => {
                    const isSelected = normalizeSubject(selectedSubject) === sub.normKey;
                    return (
                      <button
                        key={sub.normKey}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedSubject(sub.id);
                          setSelectedChapter('all');
                          setSelectedLesson('all');
                        }}
                        className={`relative min-h-[112px] p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer ${
                          isSelected
                            ? 'border-2 border-[#006BFF] bg-[#EFF6FF] shadow-[0_4px_14px_rgba(0,107,255,0.12)]'
                            : 'border border-[#CFDCED] bg-[#FAFCFF] hover:bg-[#F3F8FF] hover:border-[#8AB8FF]'
                        }`}
                      >
                        {isSelected && (
                          <span
                            aria-hidden="true"
                            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#006BFF] text-white flex items-center justify-center"
                          >
                            <Check className="w-3.5 h-3.5" strokeWidth={2.8} />
                          </span>
                        )}
                        <SubjectThumbnail3D subjectKey={sub.normKey} className="w-16 h-12 sm:w-20 sm:h-14" />
                        <span
                          className={`text-sm font-bold leading-snug ${
                            isSelected ? 'text-[#0052CC]' : 'text-[#102A52]'
                          }`}
                        >
                          {sub.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* KHỐI 2: Em muốn luyện bài nào? */}
              <section
                ref={step2Ref}
                aria-labelledby="practice-step-2-heading"
                className="bg-white rounded-2xl border border-[#CFDCED] p-5 sm:p-6 shadow-[0_3px_14px_rgba(16,42,82,0.04)] space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#006BFF] flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h2 id="practice-step-2-heading" className="text-lg sm:text-xl font-bold text-[#0B2A52]">
                    2. Em muốn luyện bài nào?
                  </h2>
                </div>

                {/* Hàng 1: Chương / Chủ đề và Bài học nằm cạnh nhau */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor="practice-chapter-select"
                      className="block text-sm font-bold text-[#1E3A5F] mb-1.5"
                    >
                      Chương / Chủ đề
                    </label>
                    <select
                      id="practice-chapter-select"
                      value={selectedChapter}
                      onChange={e => {
                        setSelectedChapter(e.target.value);
                        setSelectedLesson('all');
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-semibold text-[#0B2A52] bg-white border border-[#CFDCED] rounded-xl focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#006BFF] hover:border-[#8AB8FF] transition-colors"
                    >
                      <option value="all">Tất cả chương / chủ đề</option>
                      {availableChapters.map(chap => {
                        const countChap = allMasterQuestions.filter(
                          q =>
                            normalizeGrade(q.grade) === selectedGrade &&
                            isQuestionInSubject(q, selectedSubject) &&
                            (selectedTextbook === 'all' || q.textbook === selectedTextbook) &&
                            q.chapter === chap
                        ).length;
                        return (
                          <option key={chap} value={chap}>
                            {chap} ({countChap} câu)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="practice-lesson-select"
                      className="block text-sm font-bold text-[#1E3A5F] mb-1.5"
                    >
                      Bài học
                    </label>
                    <select
                      id="practice-lesson-select"
                      value={selectedLesson}
                      onChange={e => setSelectedLesson(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-semibold text-[#0B2A52] bg-white border border-[#CFDCED] rounded-xl focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#006BFF] hover:border-[#8AB8FF] transition-colors"
                    >
                      <option value="all">Tất cả bài học</option>
                      {availableLessons.map(les => {
                        const countLes = allMasterQuestions.filter(
                          q =>
                            normalizeGrade(q.grade) === selectedGrade &&
                            isQuestionInSubject(q, selectedSubject) &&
                            (selectedTextbook === 'all' || q.textbook === selectedTextbook) &&
                            (selectedChapter === 'all' || q.chapter === selectedChapter) &&
                            q.lesson === les
                        ).length;
                        return (
                          <option key={les} value={les}>
                            {les} ({countLes} câu)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Hàng 2: Bộ sách + Gợi ý ngắn */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <label
                      htmlFor="practice-textbook-select"
                      className="text-sm font-bold text-[#1E3A5F] shrink-0"
                    >
                      Bộ sách
                    </label>
                    <select
                      id="practice-textbook-select"
                      value={selectedTextbook}
                      onChange={e => setSelectedTextbook(e.target.value)}
                      className="w-full min-w-0 min-h-[44px] px-3.5 py-2 text-sm font-semibold text-[#0B2A52] bg-white border border-[#CFDCED] rounded-xl focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#006BFF] hover:border-[#8AB8FF] transition-colors"
                    >
                      <option value="all">Tất cả bộ sách</option>
                      {availableTextbooks.map(tb => (
                        <option key={tb} value={tb}>
                          {tb}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="text-sm italic text-[#4B6484] sm:border-l sm:border-[#DCE8F7] sm:pl-4">
                    Chọn một bài để luyện tập tập trung hơn.
                  </p>
                </div>
              </section>

              {/* KHỐI 3: Chọn cách luyện tập + Tùy chỉnh thêm */}
              <section
                ref={step3Ref}
                aria-labelledby="practice-step-3-heading"
                className="bg-white rounded-2xl border border-[#CFDCED] p-5 sm:p-6 shadow-[0_3px_14px_rgba(16,42,82,0.04)] space-y-5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#006BFF] flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <h2 id="practice-step-3-heading" className="text-lg sm:text-xl font-bold text-[#0B2A52]">
                    3. Chọn cách luyện tập
                  </h2>
                </div>

                {/* Hai chế độ hiện có */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" role="group" aria-label="Chế độ luyện tập">
                  <button
                    type="button"
                    aria-pressed={practiceModeType === 'instant'}
                    onClick={() => setPracticeModeType('instant')}
                    className={`min-h-[72px] p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer ${
                      practiceModeType === 'instant'
                        ? 'border-2 border-[#006BFF] bg-[#EFF6FF]'
                        : 'border border-[#CFDCED] bg-white hover:bg-[#F7FAFF] hover:border-[#8AB8FF]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        practiceModeType === 'instant'
                          ? 'border-[#006BFF] bg-white'
                          : 'border-[#94A3B8] bg-white'
                      }`}
                    >
                      {practiceModeType === 'instant' && (
                        <span className="w-3 h-3 rounded-full bg-[#006BFF]" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-[#0B2A52]">Luyện từng câu</span>
                      <span className="block text-xs sm:text-[13px] text-[#4B6484] mt-0.5">
                        {showInstantSolution ? 'Xem giải thích sau mỗi câu' : 'Tự mở giải thích khi cần'}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={practiceModeType === 'timed_exam'}
                    onClick={() => setPracticeModeType('timed_exam')}
                    className={`min-h-[72px] p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer ${
                      practiceModeType === 'timed_exam'
                        ? 'border-2 border-[#006BFF] bg-[#EFF6FF]'
                        : 'border border-[#CFDCED] bg-white hover:bg-[#F7FAFF] hover:border-[#8AB8FF]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        practiceModeType === 'timed_exam'
                          ? 'border-[#006BFF] bg-white'
                          : 'border-[#94A3B8] bg-white'
                      }`}
                    >
                      {practiceModeType === 'timed_exam' && (
                        <span className="w-3 h-3 rounded-full bg-[#006BFF]" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-[#0B2A52]">Thi thử tính giờ</span>
                      <span className="block text-xs sm:text-[13px] text-[#4B6484] mt-0.5">
                        Xem kết quả sau khi nộp
                      </span>
                    </span>
                  </button>
                </div>

                {/* Số câu hỏi trong phiên */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 pt-1">
                  <span className="text-sm font-bold text-[#1E3A5F] shrink-0">Số câu hỏi:</span>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Số câu hỏi">
                    {[5, 10, 15, 20, 9999].map(cnt => {
                      const isSelected = questionCount === cnt;
                      return (
                        <button
                          key={cnt}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setQuestionCount(cnt)}
                          className={`min-h-[42px] px-4 py-2 text-sm font-bold rounded-xl border transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer ${
                            isSelected
                              ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-[0_3px_10px_rgba(0,107,255,0.25)]'
                              : 'bg-white text-[#1E3A5F] border-[#CFDCED] hover:bg-[#F3F8FF] hover:border-[#8AB8FF]'
                          }`}
                        >
                          {cnt === 9999 ? 'Toàn bộ' : `${cnt} câu`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accordion: Tùy chỉnh thêm (thu gọn các tùy chọn ít dùng, không reset giá trị) */}
                <div className="rounded-xl border border-[#DCE8F7] bg-[#F8FBFF] overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={isAdvancedOpen}
                    aria-controls="practice-advanced-options"
                    onClick={() => setIsAdvancedOpen(prev => !prev)}
                    className="w-full min-h-[46px] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-[#F0F6FF] transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#006BFF] cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <Sliders className="w-4 h-4 text-[#006BFF] shrink-0" aria-hidden="true" />
                      <span className="text-sm font-bold text-[#0B2A52]">Tùy chỉnh thêm</span>
                      <span className="text-xs text-[#5A7191] hidden sm:inline">
                        Dạng câu · Mức độ · Đảo câu
                      </span>
                      {hasCustomAdvancedSettings && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#E0EEFF] border border-[#9CC5FF] text-[#0052CC] text-xs font-bold">
                          <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>Đang áp dụng tùy chỉnh</span>
                        </span>
                      )}
                    </div>
                    {isAdvancedOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#334E70] shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#334E70] shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  {isAdvancedOpen && (
                    <div
                      id="practice-advanced-options"
                      className="px-4 pb-4 pt-3 border-t border-[#DCE8F7] bg-white space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Dạng câu hỏi */}
                        <div>
                          <span className="block text-xs font-bold text-[#1E3A5F] mb-2">
                            Dạng câu hỏi
                          </span>
                          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Dạng câu hỏi">
                            {[
                              { id: 'all', label: 'Tất cả' },
                              { id: 'single_choice', label: 'Trắc nghiệm ABCD' },
                              { id: 'true_false_group', label: 'Đúng - Sai 4 ý' },
                              { id: 'essay', label: 'Tự luận' }
                            ].map(t => {
                              const isSelected = targetType === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => setTargetType(t.id)}
                                  className={`min-h-[40px] py-2 px-2.5 text-xs font-bold rounded-xl border text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#006BFF] cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#006BFF] text-white border-[#006BFF]'
                                      : 'bg-[#F6FAFF] text-[#1E3A5F] border-[#CFDCED] hover:bg-[#EAF3FF]'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Mức độ nhận thức */}
                        <div>
                          <span className="block text-xs font-bold text-[#1E3A5F] mb-2">
                            Mức độ nhận thức
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Mức độ nhận thức">
                            {[
                              { id: 'all', label: 'Tất cả' },
                              { id: 'know', label: 'Biết' },
                              { id: 'understand', label: 'Hiểu' },
                              { id: 'apply', label: 'Vận dụng' }
                            ].map(item => {
                              const isSelected = targetLevel === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => setTargetLevel(item.id)}
                                  className={`min-h-[40px] py-2 px-2 text-xs font-bold rounded-xl border text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#006BFF] cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#006BFF] text-white border-[#006BFF]'
                                      : 'bg-[#F6FAFF] text-[#1E3A5F] border-[#CFDCED] hover:bg-[#EAF3FF]'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Cài đặt bổ sung */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#EAF1FA] text-sm text-[#1E3A5F]">
                        <div className="flex flex-col gap-2.5">
                          <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[28px]">
                            <input
                              type="checkbox"
                              checked={shuffleQuestions}
                              onChange={e => setShuffleQuestions(e.target.checked)}
                              className="w-4 h-4 rounded-sm border-[#94A3B8] text-[#006BFF] focus:ring-[#006BFF]"
                            />
                            <span className="text-xs sm:text-sm font-semibold">
                              Xáo trộn thứ tự câu hỏi trong mỗi lần luyện
                            </span>
                          </label>

                          {practiceModeType === 'instant' && (
                            <label className="inline-flex items-center gap-2.5 cursor-pointer min-h-[28px]">
                              <input
                                type="checkbox"
                                checked={showInstantSolution}
                                onChange={e => setShowInstantSolution(e.target.checked)}
                                className="w-4 h-4 rounded-sm border-[#94A3B8] text-[#006BFF] focus:ring-[#006BFF]"
                              />
                              <span className="text-xs sm:text-sm font-semibold">
                                Tự động mở lời giải chi tiết khi chọn đáp án
                              </span>
                            </label>
                          )}
                        </div>

                        {hasCustomAdvancedSettings && (
                          <button
                            type="button"
                            onClick={() => {
                              setTargetType('all');
                              setTargetLevel('all');
                              setShuffleQuestions(true);
                              setShowInstantSolution(true);
                            }}
                            className="self-start sm:self-end text-xs font-bold text-[#006BFF] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] rounded-sm px-1 py-0.5 cursor-pointer"
                          >
                            Khôi phục mặc định
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* CỘT PHẢI (1 phần): Tóm tắt Sẵn sàng luyện tập & Bắt đầu */}
            <aside aria-label="Tóm tắt phiên luyện tập" className="lg:col-span-4 space-y-4 lg:sticky lg:top-20 self-start min-w-0">
              <div className="bg-white rounded-2xl border border-[#CFDCED] p-5 sm:p-6 shadow-[0_6px_22px_rgba(16,42,82,0.06)] space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#006BFF] flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0B2A52]">
                    Sẵn sàng luyện tập
                  </h2>
                </div>

                {/* Minh họa 3D nhỏ */}
                <div className="py-1">
                  <PracticeReadyIllustration3D />
                </div>

                {/* Tóm tắt trạng thái thật */}
                <dl className="divide-y divide-[#EAF1FA] text-sm border-t border-b border-[#EAF1FA]">
                  <div className="py-2.5 flex items-center gap-3">
                    <dt className="sr-only">Khối lớp</dt>
                    <GraduationCap className="w-4 h-4 text-[#1769C2] shrink-0" aria-hidden="true" />
                    <dd className="font-bold text-[#0B2A52]">Lớp {selectedGrade}</dd>
                  </div>

                  <div className="py-2.5 flex items-center gap-3">
                    <dt className="sr-only">Môn học</dt>
                    <BookMarked className="w-4 h-4 text-[#1769C2] shrink-0" aria-hidden="true" />
                    <dd className="font-bold text-[#0B2A52] truncate">{selectedSubjectDisplay}</dd>
                  </div>

                  <div className="py-2.5 flex items-start gap-3">
                    <dt className="sr-only">Phạm vi nội dung</dt>
                    <BookOpen className="w-4 h-4 text-[#1769C2] shrink-0 mt-0.5" aria-hidden="true" />
                    <dd className="font-bold text-[#0B2A52] leading-snug break-words min-w-0">
                      {scopeSummaryText}
                    </dd>
                  </div>

                  {selectedTextbook !== 'all' && (
                    <div className="py-2.5 flex items-start gap-3">
                      <dt className="sr-only">Bộ sách</dt>
                      <FileText className="w-4 h-4 text-[#1769C2] shrink-0 mt-0.5" aria-hidden="true" />
                      <dd className="font-semibold text-[#1E3A5F] leading-snug break-words min-w-0">
                        Bộ sách: {selectedTextbook}
                      </dd>
                    </div>
                  )}

                  <div className="py-2.5 flex items-center gap-3">
                    <dt className="sr-only">Số câu dự kiến</dt>
                    <ListChecks className="w-4 h-4 text-[#1769C2] shrink-0" aria-hidden="true" />
                    <dd className="font-bold text-[#0B2A52] tabular-nums">
                      {plannedQuestionCount} câu hỏi
                    </dd>
                  </div>

                  <div className="py-2.5 flex items-center gap-3">
                    <dt className="sr-only">Chế độ luyện</dt>
                    <Target className="w-4 h-4 text-[#1769C2] shrink-0" aria-hidden="true" />
                    <dd className="font-bold text-[#0B2A52]">
                      {practiceModeType === 'instant' ? 'Luyện từng câu' : 'Thi thử tính giờ'}
                    </dd>
                  </div>

                  {hasCustomAdvancedSettings && (
                    <div className="py-2.5 flex items-start gap-3">
                      <dt className="sr-only">Tùy chỉnh đang áp dụng</dt>
                      <Sliders className="w-4 h-4 text-[#006BFF] shrink-0 mt-0.5" aria-hidden="true" />
                      <dd className="text-xs font-semibold text-[#0052CC] leading-snug min-w-0">
                        Tùy chỉnh: {customFilterLabels.join(' · ')}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* Số câu phù hợp trong ngân hàng (thông tin phụ, dữ liệu thật) */}
                <p className="text-sm italic text-center text-[#4B6484] tabular-nums">
                  {isLoadingQuestions
                    ? 'Đang tải câu hỏi từ ngân hàng...'
                    : `${availableQuestions.length} câu phù hợp trong ngân hàng`}
                </p>

                {/* Thông báo rõ khi không có câu phù hợp */}
                {!isLoadingQuestions && availableQuestions.length === 0 && (
                  <div
                    role="status"
                    className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="leading-relaxed font-medium">
                        Chưa có câu hỏi phù hợp với lựa chọn hiện tại. Hãy chọn lại bài/chương khác hoặc kiểm tra mục{' '}
                        <strong>Tùy chỉnh thêm</strong>.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-6">
                      {(selectedChapter !== 'all' ||
                        selectedLesson !== 'all' ||
                        selectedTextbook !== 'all' ||
                        hasCustomAdvancedSettings) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChapter('all');
                            setSelectedLesson('all');
                            setSelectedTextbook('all');
                            setTargetType('all');
                            setTargetLevel('all');
                          }}
                          className="text-xs font-bold text-[#0052CC] hover:underline cursor-pointer"
                        >
                          Mở rộng toàn bộ bài học
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={loadQuestionsFromSupabase}
                        className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
                      >
                        Tải lại câu hỏi
                      </button>
                    </div>
                  </div>
                )}

                {/* Nút Bắt đầu luyện tập */}
                <button
                  type="button"
                  onClick={() => handleStartPractice()}
                  disabled={availableQuestions.length === 0 || isStartingSession}
                  className="w-full min-h-[48px] px-5 py-3 bg-[#006BFF] hover:bg-[#0058D6] active:bg-[#004BB8] text-white text-base font-bold rounded-xl shadow-[0_6px_16px_rgba(0,107,255,0.28)] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                  <span>
                    {isStartingSession ? 'Đang khởi tạo...' : 'Bắt đầu luyện tập'}
                  </span>
                </button>

                {/* Gợi ý điều chỉnh theo kích thước màn hình */}
                <p className="hidden lg:block text-xs italic text-center text-[#5A7191]">
                  Chọn bài bên trái để thay đổi nội dung.
                </p>
                <p className="lg:hidden text-xs italic text-center text-[#5A7191]">
                  Điều chỉnh lựa chọn để thay đổi nội dung.
                </p>

                {/* Liên kết đến Sổ câu sai hiện có */}
                <button
                  type="button"
                  onClick={() => setCurrentView('student_wrong_book')}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#CFDCED] bg-[#FAFCFF] hover:bg-[#EFF6FF] hover:border-[#8AB8FF] flex items-center justify-between gap-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006BFF] cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <BookOpen className="w-5 h-5 text-[#006BFF] shrink-0" aria-hidden="true" />
                    <span className="text-sm font-bold text-[#0052CC]">
                      Xem lại câu từng làm sai
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#006BFF] shrink-0" aria-hidden="true" />
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : isFinished ? (
        /* ==========================================
           3. RESULTS & ANALYTICS SCREEN
           ========================================== */
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 sm:p-8 max-w-3xl mx-auto shadow-xs space-y-6">
          <div className="text-center space-y-3 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <Award className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#082B52]">Hoàn thành bài luyện tập!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Lớp {selectedGrade} • {getSubjectDisplayName(selectedSubject)} • Thời gian làm bài: <b>{formatTime(secondsElapsed)}</b>
              </p>
            </div>
          </div>

          {/* Grid thống kê điểm & kết quả */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-4 bg-[#F3F8FF] rounded-xl border border-[#DCE8F7]">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Điểm quy đổi</span>
              <div className="text-3xl font-extrabold text-[#006BFF] mt-1">
                {sessionAnalytics.scaledScore}
                <span className="text-xs font-normal text-slate-400"> / 10</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Số câu đúng</span>
              <div className="text-3xl font-extrabold text-emerald-600 mt-1">
                {sessionAnalytics.correctCount}
                <span className="text-xs font-normal text-slate-400"> / {practiceQuestions.length}</span>
              </div>
            </div>

            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Số câu sai</span>
              <div className="text-3xl font-extrabold text-rose-600 mt-1">
                {sessionAnalytics.wrongCount}
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Thời gian</span>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">
                {formatTime(secondsElapsed)}
              </div>
            </div>
          </div>

          {/* Danh sách câu hỏi chi tiết sau khi làm xong */}
          <div className="space-y-4 pt-4">
            <h4 className="text-sm font-bold text-[#082B52] flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-[#006BFF]" />
              <span>Chi tiết kết quả từng câu hỏi:</span>
            </h4>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {sessionAnalytics.questionResults.map((r, idx) => (
                <div
                  key={r.question.id}
                  className={`p-4 rounded-xl border text-xs space-y-2 transition-colors ${
                    r.isCorrect
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${
                        r.isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-[#082B52]">[{r.question.code}]</span>
                      <span className="text-slate-500">• {r.question.lesson}</span>
                    </div>
                    <span className={`font-bold px-2 py-0.5 rounded-sm ${
                      r.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {r.isCorrect ? 'Chính xác' : 'Chưa đúng'} ({r.pointsAwarded} / {r.maxPoints}đ)
                    </span>
                  </div>

                  <div className="font-medium text-slate-800">
                    <MathView content={r.question.stem} />
                  </div>

                  {/* Lời giải chi tiết */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 space-y-1">
                    <b className="text-blue-900 block">Lời giải chi tiết:</b>
                    <MathView content={r.question.explanation} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-slate-100">
            {sessionAnalytics.wrongCount > 0 && (
              <button
                onClick={handleRetryWrongOnly}
                className="flex items-center space-x-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shadow-xs transition-colors"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Luyện lại {sessionAnalytics.wrongCount} câu làm sai</span>
              </button>
            )}

            <button
              onClick={() => handleStartPractice()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Luyện lại bộ này (đề mới xáo trộn)</span>
            </button>

            <button
              onClick={() => setIsPracticing(false)}
              className="px-5 py-2.5 border border-[#DCE8F7] bg-white text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Chọn chủ đề / bài học khác
            </button>
          </div>
        </div>
      ) : (
        /* ==========================================
           4. LIVE PRACTICE QUESTION VIEW
           ========================================== */
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header phiên làm bài */}
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-[#006BFF] border border-blue-200">
                Câu {currentIndex + 1} / {practiceQuestions.length}
              </span>
              <span className="text-xs text-slate-600 font-medium truncate max-w-xs">
                {currentQ.lesson || currentQ.chapter}
              </span>
            </div>

            {/* Đồng hồ & Nút thoát */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-700">
                <Clock className="w-3.5 h-3.5 text-[#006BFF]" />
                <span>{formatTime(secondsElapsed)}</span>
              </div>

              <button
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn kết thúc bài luyện tập hiện tại?')) {
                    handleFinishPractice();
                  }
                }}
                className="px-3 py-1 bg-slate-100 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors"
              >
                Kết thúc sớm
              </button>
            </div>
          </div>

          {/* BẢN ĐỒ CÂU HỎI NHANH (QUESTION PALETTE) */}
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2 text-[11px] font-bold text-slate-500">
              <span>Bản đồ câu hỏi:</span>
              <span className="text-xs font-semibold text-[#006BFF]">
                Đã trả lời: {practiceQuestions.filter(q => {
                  if (selectedAnswers[q.id] === undefined) return false;
                  if (q.type === 'essay') {
                    const st = getEssayState(q.id);
                    return Boolean(st.text.trim().length > 0 || st.images.length > 0 || (st.files?.length || 0) > 0);
                  }
                  return true;
                }).length} / {practiceQuestions.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {practiceQuestions.map((q, idx) => {
                const isCur = idx === currentIndex;
                const isFlagged = flaggedQuestions[q.id];
                const essayAns = q.type === 'essay' ? getEssayState(q.id) : null;
                const isAnswered = selectedAnswers[q.id] !== undefined && (
                  q.type !== 'essay'
                    ? true
                    : Boolean(essayAns?.text.trim().length || (essayAns?.images.length || 0) > 0 || (essayAns?.files?.length || 0) > 0)
                );

                let btnStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                if (isAnswered) {
                  btnStyle = 'bg-blue-100 text-[#006BFF] border-blue-300 font-bold';
                }
                if (isCur) {
                  btnStyle = 'bg-[#006BFF] text-white border-[#006BFF] ring-2 ring-blue-300 font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative w-8 h-8 rounded-lg text-xs flex items-center justify-center border transition-all ${btnStyle}`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* KHUNG CÂU HỎI TRỌNG TÂM */}
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 sm:p-8 shadow-xs space-y-6">
            {/* Header câu hỏi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-md bg-blue-100 text-[#006BFF]">
                  {currentQ.code}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {currentQ.level === 'know' ? 'Nhận biết' : currentQ.level === 'understand' ? 'Thông hiểu' : 'Vận dụng'}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800">
                  {currentQ.type === 'single_choice'
                    ? 'Trắc nghiệm ABCD (1 ĐA)'
                    : currentQ.type === 'true_false_group'
                    ? 'Đúng – Sai nhiều ý (a–d)'
                    : currentQ.type === 'essay'
                    ? 'Tự luận'
                    : 'Trả lời ngắn'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleFlagQuestion(currentQ.id)}
                  className={`p-1.5 rounded-lg border text-xs font-bold flex items-center space-x-1 transition-colors ${
                    flaggedQuestions[currentQ.id]
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                  title="Đánh dấu câu hỏi cần xem lại"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{flaggedQuestions[currentQ.id] ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                </button>
              </div>
            </div>

            {/* Nội dung đề bài */}
            <div className="text-base sm:text-lg font-bold text-[#12345B] leading-relaxed">
              <MathView content={currentQ.stem} />
            </div>

            {/* CÁC PHƯƠNG ÁN TRẢ LỜI THEO DẠNG CÂU */}
            {/* 1. Dạng Trắc nghiệm ABCD */}
            {currentQ.type === 'single_choice' && currentQ.options && (
              <div className="space-y-3">
                {currentQ.options.map(opt => {
                  const isSelected = selectedAnswers[currentQ.id] === opt.label;
                  const isRevealed = revealedSolutions[currentQ.id];
                  const isCorrect = String(opt.label).toUpperCase() === String(currentQ.correctAnswer).toUpperCase();

                  let cardStyle = 'border-[#DCE8F7] bg-white hover:border-[#006BFF] hover:bg-[#F3F8FF]';
                  if (isSelected) {
                    cardStyle = 'border-[#006BFF] bg-blue-50/70 ring-1 ring-[#006BFF] text-[#082B52] font-semibold';
                  }

                  if (isRevealed) {
                    if (isCorrect) {
                      cardStyle = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold';
                    } else if (isSelected && !isCorrect) {
                      cardStyle = 'border-rose-400 bg-rose-50/80 text-rose-950';
                    }
                  }

                  return (
                    <button
                      key={opt.id || opt.label}
                      type="button"
                      onClick={() => handleSelectOption(opt.label)}
                      className={`w-full p-4 rounded-xl border text-left flex items-start space-x-3.5 transition-all ${cardStyle}`}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border ${
                        isRevealed && isCorrect
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : isSelected
                          ? 'bg-[#006BFF] text-white border-[#006BFF]'
                          : 'bg-slate-50 text-slate-700 border-slate-300'
                      }`}>
                        {opt.label}
                      </span>
                      <div className="text-sm font-medium flex-1 pt-0.5">
                        <MathView content={opt.text} />
                      </div>
                      {isRevealed && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 self-center" />
                      )}
                      {isRevealed && isSelected && !isCorrect && (
                        <XCircle className="w-5 h-5 text-rose-500 shrink-0 self-center" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. Dạng Đúng - Sai 4 ý (a, b, c, d) */}
            {currentQ.type === 'true_false_group' && (currentQ.subItems || currentQ.rawSubItems) && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900 font-semibold flex items-center justify-between">
                  <span>Quy tắc chấm GDPT 2018: Đúng 1 ý = 0.1đ • Đúng 2 ý = 0.25đ • Đúng 3 ý = 0.5đ • Đúng 4 ý = 1.0đ</span>
                </div>

                {(currentQ.subItems || currentQ.rawSubItems || []).map((item, idx) => {
                  const currentAns = selectedAnswers[currentQ.id]?.[item.id];
                  const isRevealed = revealedSolutions[currentQ.id];
                  const isItemCorrect = item.isCorrect !== undefined ? currentAns === item.isCorrect : null;

                  return (
                    <div
                      key={item.id || idx}
                      className="p-4 rounded-xl border border-[#DCE8F7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FBFDFF] hover:border-blue-200 transition-colors"
                    >
                      <div className="text-sm font-medium flex-1">
                        <span className="font-bold text-[#006BFF] mr-2">
                          {item.label || String.fromCharCode(97 + idx)})
                        </span>
                        <MathView content={item.text} />
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTrueFalseSelect(item.id, true)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            currentAns === true
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Đúng
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTrueFalseSelect(item.id, false)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            currentAns === false
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Sai
                        </button>

                        {isRevealed && item.isCorrect !== undefined && (
                          <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                            isItemCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.isCorrect ? 'Đáp án: Đúng' : 'Đáp án: Sai'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Dạng Trả lời ngắn */}
            {currentQ.type === 'short_answer' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Nhập kết quả số hoặc từ khóa trả lời:
                </label>
                <input
                  type="text"
                  value={selectedAnswers[currentQ.id] || ''}
                  onChange={e => handleShortAnswerChange(e.target.value)}
                  placeholder="Nhập đáp án của bạn vào đây..."
                  className="w-full px-4 py-3 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                />
                {revealedSolutions[currentQ.id] && currentQ.acceptedAnswers && (
                  <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-900 border border-emerald-200">
                    Đáp án chấp nhận: <b>{currentQ.acceptedAnswers.join(' | ')}</b>
                  </div>
                )}
              </div>
            )}

            {/* 4. Dạng Tự luận (Essay) */}
            {currentQ.type === 'essay' && (() => {
              const essayState = getEssayState(currentQ.id);
              return (
                <div className="space-y-4">
                  {/* Tiêu chí điểm tối đa & năng lực */}
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <span className="font-semibold">
                      Điểm tối đa: <b className="text-[#006BFF]">{currentQ.points || 1.0} điểm</b>
                      {currentQ.competency && <span className="ml-2 text-slate-600 font-normal">• Năng lực: {currentQ.competency}</span>}
                    </span>
                    <span className="text-[11px] text-slate-500">Hỗ trợ gõ trực tiếp hoặc chụp ảnh/tải tệp bài làm tay</span>
                  </div>

                  {/* Phần 1: Ô nhập bài làm bằng văn bản */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                        <FileText className="w-4 h-4 text-[#006BFF]" />
                        <span>1. Trình bày bài giải / Lập luận bằng văn bản:</span>
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {essayState.text.length} ký tự
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={essayState.text}
                      onChange={e => handleEssayTextChange(currentQ.id, e.target.value)}
                      placeholder="Gõ chi tiết câu trả lời, các bước giải thích, phân tích hoặc kết luận của bạn vào đây..."
                      className="w-full px-4 py-3 rounded-xl border border-[#DCE8F7] bg-[#FBFDFF] text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] focus:border-[#006BFF] transition-all leading-relaxed"
                    />
                  </div>

                  {/* Phần 2: Đính kèm ảnh hoặc tệp tài liệu bài làm */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#DCE8F7] rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-1.5 font-bold text-xs text-[#082B52]">
                          <ImageIcon className="w-4 h-4 text-[#006BFF]" />
                          <span>2. Đính kèm ảnh bài làm hoặc tệp tài liệu (ảnh chụp bài viết tay, sơ đồ, code, word/pdf):</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Học sinh có thể làm bài ra giấy rồi chụp ảnh hoặc đính kèm tệp để nộp.
                        </p>
                      </div>

                      <span className="text-xs font-bold text-[#006BFF] px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg self-start sm:self-auto">
                        Đã đính kèm: {essayState.images.length + (essayState.files?.length || 0)}/5 tệp
                      </span>
                    </div>

                    {/* Hidden inputs */}
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={e => handleAddEssayImages(currentQ.id, e.target.files)}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => handleAddEssayImages(currentQ.id, e.target.files)}
                    />
                    <input
                      ref={docInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,image/*"
                      multiple
                      className="hidden"
                      onChange={e => handleAddEssayDocs(currentQ.id, e.target.files)}
                    />

                    {/* Upload action triggers */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={essayState.images.length >= 5 || isProcessingImage}
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center justify-center space-x-2 px-3 py-2.5 bg-emerald-50 border border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100/60 text-xs font-bold text-emerald-800 rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span>Chụp ảnh bài làm (Camera)</span>
                      </button>

                      <button
                        type="button"
                        disabled={essayState.images.length >= 5 || isProcessingImage}
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center justify-center space-x-2 px-3 py-2.5 bg-white border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] text-xs font-bold text-slate-700 rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-[#006BFF]" />
                        <span>Tải ảnh từ máy / Thư viện</span>
                      </button>

                      <button
                        type="button"
                        disabled={(essayState.files?.length || 0) >= 3 || isProcessingImage}
                        onClick={() => docInputRef.current?.click()}
                        className="flex items-center justify-center space-x-2 px-3 py-2.5 bg-white border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] text-xs font-bold text-slate-700 rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                      >
                        <Paperclip className="w-4 h-4 text-[#006BFF]" />
                        <span>Đính kèm tệp (.pdf, .docx, .txt)</span>
                      </button>
                    </div>

                    {/* Trạng thái đang nén ảnh */}
                    {isProcessingImage && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#006BFF] flex items-center space-x-2">
                        <div className="w-3.5 h-3.5 border-2 border-[#006BFF] border-t-transparent rounded-full animate-spin" />
                        <span>Đang nén và tối ưu hóa hình ảnh...</span>
                      </div>
                    )}

                    {/* Danh sách ảnh chụp bài làm đã tải lên */}
                    {essayState.images.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Ảnh bài làm đã tải lên (nhấn để phóng to, xoay ảnh hoặc xóa):
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                          {essayState.images.map((img, idx) => (
                            <div
                              key={idx}
                              className="relative group border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                            >
                              <div
                                onClick={() => setPreviewModal({ url: img, title: `Trang ${idx + 1} - Bài tự luận`, zoom: 1, rotation: 0 })}
                                className="cursor-pointer aspect-4/3 overflow-hidden bg-slate-100 flex items-center justify-center relative"
                              >
                                <img
                                  src={img}
                                  alt={`Trang ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1 text-white">
                                  <ZoomIn className="w-4 h-4" />
                                  <span className="text-[11px] font-semibold">Xem to</span>
                                </div>
                              </div>

                              <div className="p-1.5 flex items-center justify-between bg-slate-50 border-t border-slate-100">
                                <span className="text-[11px] font-bold text-slate-600 px-1">Ảnh {idx + 1}</span>
                                <div className="flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleRotateEssayImage(currentQ.id, idx)}
                                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-sm"
                                    title="Xoay ảnh 90 độ"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEssayImage(currentQ.id, idx)}
                                    className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-sm"
                                    title="Xóa ảnh này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Danh sách tệp tài liệu đính kèm */}
                    {essayState.files && essayState.files.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Tệp tài liệu đính kèm:
                        </div>
                        <div className="space-y-1">
                          {essayState.files.map((f, fIdx) => (
                            <div key={fIdx} className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2 truncate">
                                <FileText className="w-4 h-4 text-[#006BFF] shrink-0" />
                                <span className="font-semibold text-slate-700 truncate">{f.name}</span>
                                <span className="text-[10px] text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveEssayFile(currentQ.id, fIdx)}
                                className="p-1 text-slate-400 hover:text-rose-600"
                                title="Xóa tệp"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* LỜI GIẢI CHI TIẾT & HƯỚNG DẪN CHẤM KHI ĐƯỢC MỞ */}
            {revealedSolutions[currentQ.id] && (
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-slate-800 space-y-3 animate-fadeIn">
                <div className="flex items-center space-x-1.5 text-amber-900 font-bold uppercase tracking-wider">
                  <Eye className="w-4 h-4 text-amber-600" />
                  <span>
                    {currentQ.type === 'essay'
                      ? 'Hướng dẫn chấm, Barem & Đáp án mẫu tham khảo:'
                      : 'Lời giải chi tiết & Phương pháp giải:'}
                  </span>
                </div>

                {currentQ.type === 'essay' && (currentQ.rubric || currentQ.sampleAnswer) && (
                  <div className="space-y-2">
                    {currentQ.sampleAnswer && (
                      <div className="bg-white p-3 rounded-xl border border-emerald-200">
                        <b className="text-emerald-800 block mb-1">Đáp án mẫu:</b>
                        <div className="leading-relaxed text-slate-800">
                          <MathView content={currentQ.sampleAnswer} />
                        </div>
                      </div>
                    )}
                    {currentQ.rubric && (
                      <div className="bg-white p-3 rounded-xl border border-blue-200">
                        <b className="text-blue-900 block mb-1">Tiêu chí phân bổ điểm (Rubric):</b>
                        {typeof currentQ.rubric === 'string' ? (
                          <div className="leading-relaxed text-slate-700">
                            <MathView content={currentQ.rubric} />
                          </div>
                        ) : Array.isArray(currentQ.rubric) ? (
                          <div className="space-y-1">
                            {currentQ.rubric.map((r: any, rIdx: number) => (
                              <div key={r.id || rIdx} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-0">
                                <span>{r.criterion || r.text}</span>
                                <span className="font-bold text-blue-700 shrink-0 ml-2">{r.maxPoints || r.points} điểm</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                <div className="leading-relaxed bg-white p-3 rounded-xl border border-amber-100">
                  <MathView content={currentQ.explanation} />
                </div>
              </div>
            )}

            {/* THANH ĐIỀU HƯỚNG BÀI LÀM */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => toggleRevealSolution(currentQ.id)}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#006BFF] hover:underline"
              >
                <Eye className="w-4 h-4" />
                <span>{revealedSolutions[currentQ.id] ? 'Ẩn lời giải' : 'Xem lời giải chi tiết'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 border border-[#DCE8F7] rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                {currentIndex < practiceQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="px-5 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs flex items-center space-x-1.5"
                  >
                    <span>Câu tiếp theo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishPractice}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nộp bài & Hoàn thành</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM ẢNH BÀI LÀM PHÓNG TO */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h4 className="text-sm font-bold text-[#082B52] flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-[#006BFF]" />
                <span>{previewModal.title}</span>
              </h4>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? { ...prev, zoom: Math.max(0.5, prev.zoom - 0.25) } : null)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-500 w-12 text-center">
                  {Math.round(previewModal.zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? { ...prev, zoom: Math.min(3, prev.zoom + 0.25) } : null)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? { ...prev, rotation: (prev.rotation + 90) % 360 } : null)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                  title="Xoay 90 độ"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-900/90">
              <img
                src={previewModal.url}
                alt="Ảnh bài làm phóng to"
                style={{
                  transform: `scale(${previewModal.zoom}) rotate(${previewModal.rotation}deg)`,
                  transition: 'transform 0.2s ease-out',
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  objectFit: 'contain'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
