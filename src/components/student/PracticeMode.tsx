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
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  Eye,
  Flag,
  AlertCircle,
  Clock,
  Shuffle,
  Sparkles,
  Award,
  HelpCircle,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  FileText,
  Laptop,
  CheckSquare,
  AlertOctagon,
  RefreshCw,
  SlidersHorizontal,
  BarChart3,
  Bookmark,
  Camera,
  Image as ImageIcon,
  Upload,
  Trash2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Paperclip,
  GraduationCap,
  Target,
  Play,
  ChevronDown,
  ChevronUp,
  Rocket,
  Settings
} from 'lucide-react';
import { CANONICAL_SUBJECT_CATALOG } from '../../utils/subjectCatalog';
import { PracticeHeroIllustration3D, SubjectCardIllustration3D } from './practiceThumbnails';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchSeqRef = useRef<number>(0);

  const canAccessSolutions = useMemo(() => {
    const role = userProfile?.role;
    return role === 'teacher' || role === 'admin' || role === 'reviewer';
  }, [userProfile]);

  // Load questions from Supabase (combining priority Tin học + all batches + solutions)
  const loadQuestionsFromSupabase = useCallback(async () => {
    const reqId = ++fetchSeqRef.current;
    setIsLoadingQuestions(true);
    setLoadError(null);
    try {
      const qMap = new Map<string, any>();
      let hadFetchFailure = false;

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

          if (error) {
            hadFetchFailure = true;
            hasMore = false;
          } else if (!qBatch || qBatch.length === 0) {
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
        hadFetchFailure = true;
        console.warn('Lỗi khi nạp lô câu hỏi Supabase:', qErr);
      }

      if (reqId !== fetchSeqRef.current) return;
      setSupabaseQuestions(Array.from(qMap.values()));
      if (hadFetchFailure && qMap.size === 0) {
        setLoadError('Không thể đồng bộ thêm câu hỏi từ máy chủ. Hệ thống đang hiển thị dữ liệu hiện có.');
      }

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
          if (reqId !== fetchSeqRef.current) return;
          setProtectedSolutions(solMap);
        } catch (sErr) {
          console.warn('Lỗi khi nạp protected_solutions cho luyện tập:', sErr);
        }
      }
    } catch (err) {
      if (reqId !== fetchSeqRef.current) return;
      setLoadError('Đã xảy ra lỗi khi tải ngân hàng câu hỏi. Vui lòng thử lại.');
      console.warn('Ngoại lệ khi nạp câu hỏi Supabase:', err);
    } finally {
      if (reqId === fetchSeqRef.current) {
        setIsLoadingQuestions(false);
      }
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [isStartingSession, setIsStartingSession] = useState<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  // ==========================================
  // 3. DYNAMIC CURRICULUM LISTS
  // ==========================================
  // Câu hỏi hợp lệ theo phân quyền hiện tại
  const eligibleMasterQuestions = useMemo(() => {
    return allMasterQuestions.filter(
      q => canAccessSolutions || q.status === 'approved' || q.status === 'pending'
    );
  }, [allMasterQuestions, canAccessSolutions]);

  // Danh sách khối lớp hệ thống hỗ trợ (chuẩn 6–9 + khối phát sinh nếu có trong dữ liệu)
  const availableGrades = useMemo(() => {
    const gradeSet = new Set<string>(['6', '7', '8', '9']);
    eligibleMasterQuestions.forEach(q => {
      const g = normalizeGrade(q.grade);
      if (g) gradeSet.add(g);
    });
    return Array.from(gradeSet).sort((a, b) => Number(a) - Number(b));
  }, [eligibleMasterQuestions]);

  // Danh sách môn học động từ hệ thống (ưu tiên thứ tự 4 môn trọng tâm rồi mở rộng đầy đủ)
  const availableSubjects = useMemo(() => {
    const styleByNorm: Record<string, { displayName: string; pastelClass: string }> = {
      tin_hoc: {
        displayName: 'Tin học',
        pastelClass: 'bg-[#EFF6FF] border-[#CFE2FF] hover:border-[#7BB2FF]'
      },
      toan: {
        displayName: 'Toán học',
        pastelClass: 'bg-[#ECFDF5] border-[#BBEAD4] hover:border-[#5CD39E]'
      },
      khtn: {
        displayName: 'Khoa học tự nhiên',
        pastelClass: 'bg-[#FFFBEB] border-[#FCE49C] hover:border-[#F5C542]'
      },
      ngu_van: {
        displayName: 'Ngữ văn',
        pastelClass: 'bg-[#F5F3FF] border-[#DDD3FE] hover:border-[#B69DF8]'
      },
      tieng_anh: {
        displayName: 'Tiếng Anh',
        pastelClass: 'bg-[#F0F9FF] border-[#BAE6FD] hover:border-[#60C5F8]'
      },
      lich_su_dia_li: {
        displayName: 'Lịch sử và Địa lí',
        pastelClass: 'bg-[#FFF7ED] border-[#FED7AA] hover:border-[#FB923C]'
      },
      cong_nghe: {
        displayName: 'Công nghệ',
        pastelClass: 'bg-[#ECFEFF] border-[#A5F3FC] hover:border-[#22D3EE]'
      },
      gdcd: {
        displayName: 'Giáo dục công dân',
        pastelClass: 'bg-[#FFF1F2] border-[#FECDD3] hover:border-[#FB7185]'
      }
    };

    const preferredOrder = ['tin_hoc', 'toan', 'khtn', 'ngu_van', 'tieng_anh', 'lich_su_dia_li', 'cong_nghe', 'gdcd'];
    const mapByNorm = new Map<string, { id: string; name: string; norm: string; pastelClass: string }>();

    // Nạp từ danh mục môn chuẩn
    CANONICAL_SUBJECT_CATALOG.forEach(item => {
      const idVal = item.name;
      const norm = normalizeSubject(idVal);
      const style = styleByNorm[norm];
      mapByNorm.set(norm, {
        id: idVal,
        name: style?.displayName || item.name,
        norm,
        pastelClass: style?.pastelClass || 'bg-[#F8FAFC] border-[#DCE8F7] hover:border-[#9CC2FF]'
      });
    });

    // Bổ sung bất kỳ môn nào khác có trong dữ liệu thực tế
    eligibleMasterQuestions.forEach(q => {
      if (!q.subject) return;
      const norm = normalizeSubject(q.subject);
      if (!mapByNorm.has(norm)) {
        const displayName = getSubjectDisplayName(q.subject);
        mapByNorm.set(norm, {
          id: q.subject,
          name: displayName,
          norm,
          pastelClass: 'bg-[#F8FAFC] border-[#DCE8F7] hover:border-[#9CC2FF]'
        });
      }
    });

    const items = Array.from(mapByNorm.values());
    items.sort((a, b) => {
      const idxA = preferredOrder.indexOf(a.norm);
      const idxB = preferredOrder.indexOf(b.norm);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });
    return items;
  }, [eligibleMasterQuestions]);

  // Danh sách các bộ sách có sẵn cho khối + môn đã chọn (giữ nguyên tên gốc từ dữ liệu)
  const availableTextbooks = useMemo(() => {
    const tbSet = new Set<string>();
    eligibleMasterQuestions.forEach(q => {
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;
      const matchSub = isQuestionInSubject(q, selectedSubject);
      if (matchGrade && matchSub && q.textbook) {
        tbSet.add(q.textbook);
      }
    });
    return Array.from(tbSet).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [eligibleMasterQuestions, selectedGrade, selectedSubject]);

  // Danh sách các Chương / Chủ đề thực tế có trong ngân hàng
  const availableChapters = useMemo(() => {
    const chSet = new Set<string>();
    eligibleMasterQuestions.forEach(q => {
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;
      const matchSub = isQuestionInSubject(q, selectedSubject);
      const matchTb = selectedTextbook === 'all' || q.textbook === selectedTextbook;
      if (matchGrade && matchSub && matchTb && q.chapter) {
        chSet.add(q.chapter);
      }
    });
    return Array.from(chSet).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [eligibleMasterQuestions, selectedGrade, selectedSubject, selectedTextbook]);

  // Danh sách các Bài học cụ thể thực tế có trong chương đã chọn
  const availableLessons = useMemo(() => {
    const lSet = new Set<string>();
    eligibleMasterQuestions.forEach(q => {
      const matchGrade = normalizeGrade(q.grade) === selectedGrade;
      const matchSub = isQuestionInSubject(q, selectedSubject);
      const matchTb = selectedTextbook === 'all' || q.textbook === selectedTextbook;
      const matchCh = selectedChapter === 'all' || q.chapter === selectedChapter;
      if (matchGrade && matchSub && matchTb && matchCh && q.lesson) {
        lSet.add(q.lesson);
      }
    });
    return Array.from(lSet).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [eligibleMasterQuestions, selectedGrade, selectedSubject, selectedTextbook, selectedChapter]);

  // Bảo toàn quan hệ phụ thuộc khi dữ liệu hoặc lựa chọn cha thay đổi
  useEffect(() => {
    if (selectedTextbook !== 'all' && !availableTextbooks.includes(selectedTextbook)) {
      setSelectedTextbook('all');
    }
  }, [availableTextbooks, selectedTextbook]);

  useEffect(() => {
    if (selectedChapter !== 'all' && !availableChapters.includes(selectedChapter)) {
      setSelectedChapter('all');
    }
  }, [availableChapters, selectedChapter]);

  useEffect(() => {
    if (selectedLesson !== 'all' && !availableLessons.includes(selectedLesson)) {
      setSelectedLesson('all');
    }
  }, [availableLessons, selectedLesson]);

  const hasShortAnswerQuestions = useMemo(
    () => eligibleMasterQuestions.some(q => q.type === 'short_answer'),
    [eligibleMasterQuestions]
  );

  // Danh sách câu hỏi thỏa mãn tất cả tiêu chí đã chọn
  const availableQuestions = useMemo(() => {
    return eligibleMasterQuestions.filter(q => {
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

      return matchGrade && matchSub && matchTb && matchCh && matchLs && matchLvl && matchType;
    });
  }, [
    eligibleMasterQuestions,
    selectedGrade,
    selectedSubject,
    selectedTextbook,
    selectedChapter,
    selectedLesson,
    targetLevel,
    targetType
  ]);

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

  // Bắt đầu phiên luyện tập (có chống bấm lặp tạo nhiều phiên)
  const handleStartPractice = (overrideQuestions?: NormalizedPracticeQuestion[]) => {
    if (isStartingRef.current) return;
    const sourceQuestions = overrideQuestions || availableQuestions;
    if (sourceQuestions.length === 0) return;

    isStartingRef.current = true;
    setIsStartingSession(true);

    let pool = [...sourceQuestions];
    if (shuffleQuestions) {
      pool.sort(() => 0.5 - Math.random());
    }

    const countToPick = questionCount >= 9999 ? pool.length : Math.min(questionCount, pool.length);
    const selected = pool.slice(0, countToPick);

    setPracticeQuestions(selected);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setRevealedSolutions({});
    setFlaggedQuestions({});
    setShowExitConfirm(false);
    setSecondsElapsed(0);
    setTimerActive(true);
    setIsFinished(false);
    setIsPracticing(true);

    setTimeout(() => {
      isStartingRef.current = false;
      setIsStartingSession(false);
    }, 250);
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

  // Nhãn hiển thị phục vụ thẻ tóm tắt "Phiên luyện tập của em"
  const selectedSubjectMeta = useMemo(() => {
    const norm = normalizeSubject(selectedSubject);
    return (
      availableSubjects.find(s => s.norm === norm) || {
        id: selectedSubject,
        name: getSubjectDisplayName(selectedSubject),
        norm,
        pastelClass: ''
      }
    );
  }, [availableSubjects, selectedSubject]);

  const questionTypeOptions = useMemo(() => {
    const opts = [
      { id: 'all', label: 'Tất cả' },
      { id: 'single_choice', label: 'Trắc nghiệm ABCD' },
      { id: 'true_false_group', label: 'Đúng – Sai 4 ý' }
    ];
    if (hasShortAnswerQuestions) {
      opts.push({ id: 'short_answer', label: 'Trả lời ngắn' });
    }
    opts.push({ id: 'essay', label: 'Tự luận' });
    return opts;
  }, [hasShortAnswerQuestions]);

  const levelOptions = [
    { id: 'all', label: 'Tất cả' },
    { id: 'know', label: 'Biết' },
    { id: 'understand', label: 'Hiểu' },
    { id: 'apply', label: 'Vận dụng' }
  ];

  const selectedTypeLabel =
    questionTypeOptions.find(t => t.id === targetType)?.label || 'Tất cả';
  const selectedLevelLabel =
    levelOptions.find(l => l.id === targetLevel)?.label || 'Tất cả';

  const effectiveSessionCount =
    availableQuestions.length === 0
      ? 0
      : Math.min(questionCount >= 9999 ? availableQuestions.length : questionCount, availableQuestions.length);

  // ==========================================
  // RENDER INTERFACE
  // ==========================================
  return (
    <div
      className="space-y-5 pb-6 text-[#102A52]"
      style={{ fontFamily: '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* 1. BANNER GIỚI THIỆU ĐẦU TRANG (ĐỒNG BỘ PHONG CÁCH "KIẾN THỨC TRỌNG TÂM") */}
      {!isPracticing ? (
        <section
          aria-label="Giới thiệu Luyện tập theo bài và chương"
          className="relative overflow-hidden rounded-[22px] border border-[#C6E0FF] bg-gradient-to-r from-[#DCEEFF] via-[#EAF5FF] to-[#D6ECFF] px-5 py-4 sm:px-7 sm:py-5 shadow-[0_8px_24px_rgba(16,42,82,0.06)] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          {/* Ánh sáng nền mềm */}
          <div className="pointer-events-none absolute -top-12 left-1/3 w-72 h-40 rounded-full bg-white/50 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 right-1/4 w-64 h-32 rounded-full bg-sky-200/40 blur-2xl" />

          {/* Cột trái: Icon sách + Nhãn GDPT + Tiêu đề + Mô tả */}
          <div className="relative z-10 flex items-start sm:items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b from-[#3B9EFF] to-[#1363DF] text-white shadow-[0_8px_18px_rgba(23,107,255,0.28)] border border-white/60 flex items-center justify-center shrink-0">
              <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#D4E7FF] border border-[#B2D3FF] text-[11px] font-bold text-[#0E5CE6] mb-1.5">
                GDPT 2018 • Lớp 6–9
              </div>
              <h1 className="text-2xl sm:text-[28px] lg:text-[30px] font-extrabold text-[#102A52] tracking-tight leading-tight">
                Luyện tập theo bài &amp; chương
              </h1>
              <p className="text-sm text-[#526581] font-medium mt-1 leading-snug">
                Chọn nội dung phù hợp, tự tin chinh phục kiến thức.
              </p>
              <div className="w-14 h-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-purple-600 mt-2.5" />
            </div>
          </div>

          {/* Cột phải: Cụm minh họa 3D học tập (laptop, sách, bút, bia mục tiêu) */}
          <div className="relative z-10 hidden sm:flex items-center justify-end lg:justify-end -my-1">
            <PracticeHeroIllustration3D />
          </div>
        </section>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E7FF] pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#3B9EFF] to-[#1363DF] text-white flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-[#102A52] truncate">
                Luyện tập theo bài &amp; chương
              </h1>
              <p className="text-xs text-[#526581] font-medium truncate">
                Lớp {selectedGrade} · {selectedSubjectMeta.name}
                {selectedChapter !== 'all' ? ` · ${selectedChapter}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thông báo lỗi tải dữ liệu (nếu có) */}
      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadQuestionsFromSupabase}
            disabled={isLoadingQuestions}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 transition-colors shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuestions ? 'animate-spin' : ''}`} />
            <span>Thử tải lại</span>
          </button>
        </div>
      )}

      {/* 2. MÀN HÌNH THIẾT LẬP PHIÊN LUYỆN TẬP (HAI CỘT) */}
      {!isPracticing ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_365px] gap-5 items-start">
          {/* CỘT TRÁI: THIẾT LẬP PHIÊN LUYỆN TẬP */}
          <section
            aria-labelledby="practice-setup-heading"
            className="bg-white rounded-[22px] border border-[#D9E7FF] p-5 sm:p-6 shadow-[0_8px_24px_rgba(16,42,82,0.05)] space-y-5"
          >
            {/* Header thẻ thiết lập + Tiện ích đồng bộ & Sổ câu sai */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8F1FF]">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#EAF2FF] border border-[#D2E4FF] text-[#0866FF] flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 id="practice-setup-heading" className="text-lg sm:text-xl font-extrabold text-[#102A52] leading-snug">
                    Thiết lập phiên luyện tập
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[#526581] font-medium mt-0.5">
                    Lựa chọn nội dung để tạo phiên luyện phù hợp với mục tiêu học tập.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={loadQuestionsFromSupabase}
                  disabled={isLoadingQuestions}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 bg-[#F4F8FF] border border-[#D9E7FF] text-[#102A52] rounded-xl text-xs font-bold hover:bg-[#E8F1FF] transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
                  title="Đồng bộ lại câu hỏi từ ngân hàng"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#0866FF] ${isLoadingQuestions ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                  <span>{isLoadingQuestions ? 'Đang đồng bộ...' : 'Cập nhật ngân hàng'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('student_wrong_book')}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                  <span>Sổ câu sai</span>
                </button>
              </div>
            </div>

            {/* BƯỚC 1 & 2: KHỐI LỚP & MÔN HỌC */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* 1. Chọn khối lớp */}
              <div className="md:col-span-5 space-y-2.5">
                <h3 className="text-sm font-extrabold text-[#102A52]">
                  1. Chọn khối lớp
                </h3>
                <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Chọn khối lớp">
                  {availableGrades.map(g => {
                    const countInGrade = eligibleMasterQuestions.filter(
                      q => normalizeGrade(q.grade) === g
                    ).length;
                    const isSelected = selectedGrade === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedGrade(g);
                          setSelectedTextbook('all');
                          setSelectedChapter('all');
                          setSelectedLesson('all');
                        }}
                        className={`relative min-h-[76px] p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-1 ${
                          isSelected
                            ? 'bg-gradient-to-b from-[#1A7BFF] to-[#0866FF] text-white border-[#0866FF] shadow-[0_8px_18px_rgba(8,102,255,0.28)]'
                            : 'bg-white text-[#102A52] border-[#D9E7FF] hover:border-[#94BDFF] hover:bg-[#F4F8FF]'
                        }`}
                      >
                        {isSelected && (
                          <span
                            className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white/25 text-white flex items-center justify-center"
                            aria-hidden="true"
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 font-extrabold text-sm sm:text-[15px]">
                          <GraduationCap
                            className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#0866FF]'}`}
                            aria-hidden="true"
                          />
                          <span>Lớp {g}</span>
                        </div>
                        <span
                          className={`text-xs font-medium tabular-nums ${
                            isSelected ? 'text-blue-100' : 'text-[#526581]'
                          }`}
                        >
                          {isLoadingQuestions && eligibleMasterQuestions.length === 0
                            ? 'Đang tải...'
                            : `(${countInGrade.toLocaleString('vi-VN')} câu)`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Chọn môn học (mở rộng đầy đủ mọi môn có trong hệ thống) */}
              <div className="md:col-span-7 space-y-2.5">
                <h3 className="text-sm font-extrabold text-[#102A52]">
                  2. Chọn môn học
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="group" aria-label="Chọn môn học">
                  {availableSubjects.map(sub => {
                    const countInSub = eligibleMasterQuestions.filter(
                      q => normalizeGrade(q.grade) === selectedGrade && isQuestionInSubject(q, sub.id)
                    ).length;
                    const isSelected = normalizeSubject(selectedSubject) === sub.norm;

                    return (
                      <button
                        key={sub.norm}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedSubject(sub.id);
                          setSelectedTextbook('all');
                          setSelectedChapter('all');
                          setSelectedLesson('all');
                        }}
                        className={`relative min-h-[76px] p-2.5 sm:p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-1 ${
                          isSelected
                            ? 'bg-[#EAF3FF] border-2 border-[#0866FF] shadow-[0_6px_16px_rgba(8,102,255,0.14)]'
                            : `${sub.pastelClass}`
                        }`}
                      >
                        <SubjectCardIllustration3D subject={sub.id} size="sm" />

                        <div className="min-w-0 flex-1 pr-5">
                          <span className="block font-extrabold text-[13px] sm:text-sm text-[#102A52] leading-tight break-words">
                            {sub.name}
                          </span>
                          <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full bg-white/95 border border-[#D9E7FF] text-[11px] font-bold text-[#102A52] tabular-nums shadow-2xs">
                            {isLoadingQuestions && eligibleMasterQuestions.length === 0
                              ? '...'
                              : `${countInSub.toLocaleString('vi-VN')} câu`}
                          </span>
                        </div>

                        {isSelected && (
                          <span
                            className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#0866FF] text-white flex items-center justify-center shadow-2xs"
                            aria-hidden="true"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* BƯỚC 3: PHẠM VI KIẾN THỨC */}
            <div className="p-4 sm:p-5 bg-[#F4F8FF] rounded-2xl border border-[#D9E7FF] space-y-3.5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#102A52]">
                <Layers className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                <h3>3. Phạm vi kiến thức</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Chọn Chủ đề / Chương */}
                <div>
                  <label
                    htmlFor="practice-chapter-select"
                    className="block text-xs font-bold text-[#334E73] mb-1.5"
                  >
                    Chủ đề / Chương:
                  </label>
                  <select
                    id="practice-chapter-select"
                    value={selectedChapter}
                    onChange={e => {
                      setSelectedChapter(e.target.value);
                      setSelectedLesson('all');
                    }}
                    className="w-full min-h-[42px] text-[13px] px-3.5 py-2 border border-[#CFE0FB] rounded-xl bg-white text-[#102A52] font-semibold focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF] cursor-pointer"
                  >
                    <option value="all">
                      Tất cả chủ đề / chương ({availableChapters.length})
                    </option>
                    {availableChapters.map(chap => {
                      const countChap = eligibleMasterQuestions.filter(
                        q =>
                          normalizeGrade(q.grade) === selectedGrade &&
                          isQuestionInSubject(q, selectedSubject) &&
                          (selectedTextbook === 'all' || q.textbook === selectedTextbook) &&
                          q.chapter === chap
                      ).length;
                      return (
                        <option key={chap} value={chap}>
                          {chap} ({countChap.toLocaleString('vi-VN')} câu)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Chọn Bài học cụ thể */}
                <div>
                  <label
                    htmlFor="practice-lesson-select"
                    className="block text-xs font-bold text-[#334E73] mb-1.5"
                  >
                    Bài học:
                  </label>
                  <select
                    id="practice-lesson-select"
                    value={selectedLesson}
                    onChange={e => setSelectedLesson(e.target.value)}
                    className="w-full min-h-[42px] text-[13px] px-3.5 py-2 border border-[#CFE0FB] rounded-xl bg-white text-[#102A52] font-semibold focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF] cursor-pointer"
                  >
                    <option value="all">
                      Tất cả bài học ({availableLessons.length})
                    </option>
                    {availableLessons.map(les => {
                      const countLes = eligibleMasterQuestions.filter(
                        q =>
                          normalizeGrade(q.grade) === selectedGrade &&
                          isQuestionInSubject(q, selectedSubject) &&
                          (selectedTextbook === 'all' || q.textbook === selectedTextbook) &&
                          (selectedChapter === 'all' || q.chapter === selectedChapter) &&
                          q.lesson === les
                      ).length;
                      return (
                        <option key={les} value={les}>
                          {les} ({countLes.toLocaleString('vi-VN')} câu)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Bộ sách lấy nguyên vẹn từ dữ liệu hiện tại */}
              <div className="pt-3 border-t border-[#DCE9FF] flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#526581] font-bold shrink-0">Bộ sách:</span>
                {availableTextbooks.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn bộ sách">
                    <button
                      type="button"
                      aria-pressed={selectedTextbook === 'all'}
                      onClick={() => {
                        setSelectedTextbook('all');
                        setSelectedChapter('all');
                        setSelectedLesson('all');
                      }}
                      className={`min-h-[34px] px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                        selectedTextbook === 'all'
                          ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-2xs'
                          : 'bg-white text-[#334E73] border-[#CFE0FB] hover:bg-[#EAF2FF]'
                      }`}
                    >
                      Tất cả bộ sách
                    </button>
                    {availableTextbooks.map(tb => (
                      <button
                        key={tb}
                        type="button"
                        aria-pressed={selectedTextbook === tb}
                        onClick={() => {
                          setSelectedTextbook(tb);
                          setSelectedChapter('all');
                          setSelectedLesson('all');
                        }}
                        className={`min-h-[34px] px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                          selectedTextbook === tb
                            ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-2xs'
                            : 'bg-white text-[#334E73] border-[#CFE0FB] hover:bg-[#EAF2FF]'
                        }`}
                      >
                        {tb}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[#526581] font-medium">
                    Chưa có phân loại bộ sách cho khối và môn học đang chọn.
                  </span>
                )}
              </div>
            </div>

            {/* BƯỚC 4, 5, 6: DẠNG CÂU HỎI, MỨC ĐỘ NHẬN THỨC, SỐ CÂU TRONG PHIÊN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 pt-1">
              {/* 4. Dạng câu hỏi */}
              <div className="sm:col-span-2 xl:col-span-5 space-y-2">
                <h3 className="text-xs sm:text-[13px] font-extrabold text-[#102A52] flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                  <span>4. Dạng câu hỏi</span>
                </h3>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn dạng câu hỏi">
                  {questionTypeOptions.map(t => {
                    const active = targetType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTargetType(t.id)}
                        className={`min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                          active
                            ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-2xs'
                            : 'bg-[#F4F8FF] text-[#334E73] border-[#D9E7FF] hover:bg-[#E7F0FF]'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Mức độ nhận thức */}
              <div className="xl:col-span-3 space-y-2">
                <h3 className="text-xs sm:text-[13px] font-extrabold text-[#102A52] flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                  <span>5. Mức độ</span>
                </h3>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn mức độ nhận thức">
                  {levelOptions.map(item => {
                    const active = targetLevel === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTargetLevel(item.id)}
                        className={`min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                          active
                            ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-2xs'
                            : 'bg-[#F4F8FF] text-[#334E73] border-[#D9E7FF] hover:bg-[#E7F0FF]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Số câu trong phiên */}
              <div className="xl:col-span-4 space-y-2">
                <h3 className="text-xs sm:text-[13px] font-extrabold text-[#102A52] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                  <span>6. Số câu</span>
                </h3>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn số lượng câu hỏi">
                  {[5, 10, 15, 20, 9999].map(cnt => {
                    const active = questionCount === cnt;
                    return (
                      <button
                        key={cnt}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setQuestionCount(cnt)}
                        className={`min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors tabular-nums cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                          active
                            ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-2xs'
                            : 'bg-[#F4F8FF] text-[#334E73] border-[#D9E7FF] hover:bg-[#E7F0FF]'
                        }`}
                      >
                        {cnt === 9999 ? 'Toàn bộ' : `${cnt} câu`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ACCORDION: TÙY CHỌN NÂNG CAO */}
            <div className="rounded-2xl border border-[#D9E7FF] bg-[#F4F8FF]/70 overflow-hidden">
              <button
                type="button"
                aria-expanded={showAdvancedOptions}
                aria-controls="advanced-practice-options"
                onClick={() => setShowAdvancedOptions(prev => !prev)}
                className="w-full min-h-[46px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#EAF2FF] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0866FF]"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <Settings className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                  <span className="text-xs sm:text-[13px] font-extrabold text-[#102A52]">
                    Tùy chọn nâng cao
                  </span>
                  <span className="text-[11px] font-medium text-[#526581]">
                    · {shuffleQuestions ? 'Đang bật xáo trộn câu' : 'Giữ nguyên thứ tự câu'}
                    {practiceModeType === 'instant'
                      ? showInstantSolution
                        ? ' · Tự mở lời giải'
                        : ' · Mở lời giải thủ công'
                      : ' · Tính giờ khi làm bài'}
                  </span>
                </div>
                {showAdvancedOptions ? (
                  <ChevronUp className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                )}
              </button>

              {showAdvancedOptions && (
                <div
                  id="advanced-practice-options"
                  className="px-4 pb-4 pt-3 border-t border-[#DCE9FF] bg-white/80 space-y-3 text-xs sm:text-[13px] text-[#334E73]"
                >
                  <label className="flex items-start sm:items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={e => setShuffleQuestions(e.target.checked)}
                      className="w-4 h-4 mt-0.5 sm:mt-0 text-[#0866FF] rounded border-[#B9D2FA] focus:ring-[#0866FF]"
                    />
                    <span className="font-semibold text-[#102A52]">
                      Xáo trộn thứ tự câu hỏi ngẫu nhiên trong mỗi lần luyện
                    </span>
                  </label>

                  <label
                    className={`flex items-start sm:items-center gap-2.5 select-none ${
                      practiceModeType === 'instant' ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={showInstantSolution}
                      disabled={practiceModeType !== 'instant'}
                      onChange={e => setShowInstantSolution(e.target.checked)}
                      className="w-4 h-4 mt-0.5 sm:mt-0 text-[#0866FF] rounded border-[#B9D2FA] focus:ring-[#0866FF]"
                    />
                    <span className="font-semibold text-[#102A52]">
                      Tự động mở lời giải chi tiết ngay khi chọn đáp án
                      {practiceModeType !== 'instant' && (
                        <span className="block sm:inline sm:ml-1.5 text-[11px] font-normal text-[#526581]">
                          (chỉ áp dụng ở chế độ Luyện giải từng câu)
                        </span>
                      )}
                    </span>
                  </label>

                  <p className="text-[11px] text-[#526581] pt-1 border-t border-[#EBF2FF] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                    <span>
                      Thời gian làm bài được đồng hồ ghi nhận tự động trong suốt phiên luyện và lưu kèm kết quả khi nộp bài.
                    </span>
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* CỘT PHẢI: PHIÊN LUYỆN TẬP CỦA EM */}
          <aside
            aria-labelledby="practice-summary-heading"
            className="bg-white rounded-[22px] border border-[#D9E7FF] p-5 sm:p-6 shadow-[0_8px_24px_rgba(16,42,82,0.06)] space-y-4 [@media(min-width:1024px)_and_(min-height:860px)]:sticky [@media(min-width:1024px)_and_(min-height:860px)]:top-5"
          >
            {/* Tiêu đề cột tóm tắt */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#EAF2FF] text-[#0866FF] flex items-center justify-center shrink-0">
                <Target className="w-4 h-4" aria-hidden="true" />
              </div>
              <h2 id="practice-summary-heading" className="text-lg font-extrabold text-[#102A52]">
                Phiên luyện tập của em
              </h2>
            </div>

            {/* Khung minh họa 3D theo môn đang chọn */}
            <div className="rounded-2xl border border-[#DCE9FF] bg-gradient-to-b from-[#EAF3FF] to-[#F5F9FF] py-3 px-4 flex items-center justify-center">
              <SubjectCardIllustration3D subject={selectedSubject} size="lg" />
            </div>

            {/* Danh sách tóm tắt cấu hình thực tế */}
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex items-start gap-2.5">
                <GraduationCap className="w-4 h-4 text-[#0866FF] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
                  <dt className="text-[#526581] font-medium shrink-0">Khối lớp:</dt>
                  <dd className="font-extrabold text-[#102A52] text-right">Lớp {selectedGrade}</dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Laptop className="w-4 h-4 text-[#0866FF] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
                  <dt className="text-[#526581] font-medium shrink-0">Môn học:</dt>
                  <dd className="font-extrabold text-[#102A52] text-right break-words">
                    {selectedSubjectMeta.name}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-[#0866FF] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[#526581] font-medium text-xs">Chủ đề / Chương:</dt>
                  <dd className="font-bold text-[#102A52] break-words leading-snug mt-0.5">
                    {selectedChapter === 'all' ? 'Tất cả chủ đề / chương' : selectedChapter}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-[#0866FF] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[#526581] font-medium text-xs">Bài học / Phạm vi:</dt>
                  <dd className="font-bold text-[#102A52] break-words leading-snug mt-0.5">
                    {selectedLesson === 'all' ? 'Tất cả bài học' : selectedLesson}
                  </dd>
                </div>
              </div>

              {selectedTextbook !== 'all' && (
                <div className="flex items-start gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#0866FF] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
                    <dt className="text-[#526581] font-medium shrink-0">Bộ sách:</dt>
                    <dd className="font-bold text-[#102A52] text-right break-words">
                      {selectedTextbook}
                    </dd>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <Filter className="w-4 h-4 text-[#0866FF] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
                  <dt className="text-[#526581] font-medium shrink-0">Lọc:</dt>
                  <dd className="font-bold text-[#102A52] text-right break-words">
                    {selectedTypeLabel} · {selectedLevelLabel}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckSquare className="w-4 h-4 text-[#0866FF] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
                  <dt className="text-[#526581] font-medium shrink-0">Số câu dự kiến:</dt>
                  <dd className="font-extrabold text-[#102A52] text-right tabular-nums">
                    {isLoadingQuestions && eligibleMasterQuestions.length === 0
                      ? 'Đang tính...'
                      : `${effectiveSessionCount.toLocaleString('vi-VN')} câu hỏi`}
                  </dd>
                </div>
              </div>
            </dl>

            {/* Nhãn số câu phù hợp / Trạng thái tải & rỗng */}
            {isLoadingQuestions && eligibleMasterQuestions.length === 0 ? (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#EAF2FF] border border-[#CFE0FB] text-[#0866FF] text-xs font-bold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin motion-reduce:animate-none shrink-0" />
                <span>Đang tải câu hỏi phù hợp...</span>
              </div>
            ) : availableQuestions.length > 0 ? (
              <div className="space-y-1.5">
                <div className="px-3.5 py-2 rounded-full bg-[#EBFDF3] border border-[#AEEBC9] text-[#065F46] text-xs sm:text-[13px] font-extrabold flex items-center justify-center gap-2 tabular-nums">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                  <span>{availableQuestions.length.toLocaleString('vi-VN')} câu phù hợp</span>
                </div>
                {questionCount < 9999 && availableQuestions.length < questionCount && (
                  <p className="text-[11px] text-[#526581] text-center font-medium">
                    Ngân hàng hiện có {availableQuestions.length} câu phù hợp, phiên sẽ lấy đủ {availableQuestions.length} câu hiện có.
                  </p>
                )}
              </div>
            ) : (
              <div
                role="status"
                className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-start gap-2 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Chưa có câu hỏi phù hợp với bộ lọc hiện tại. Hãy chọn lại chủ đề, dạng câu hoặc mức độ.
                </span>
              </div>
            )}

            {/* Chế độ luyện tập (Radio cards) */}
            <div className="pt-2 border-t border-[#E8F1FF] space-y-2.5">
              <div className="flex items-center gap-2 text-xs sm:text-[13px] font-extrabold text-[#102A52]">
                <SlidersHorizontal className="w-4 h-4 text-[#0866FF] shrink-0" aria-hidden="true" />
                <span>Chế độ luyện tập</span>
              </div>

              <div className="space-y-2" role="radiogroup" aria-label="Chế độ luyện tập">
                <label
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    practiceModeType === 'instant'
                      ? 'bg-[#F0F6FF] border-[#0866FF] ring-1 ring-[#0866FF]/30'
                      : 'bg-white border-[#D9E7FF] hover:bg-[#F7FAFF]'
                  }`}
                >
                  <input
                    type="radio"
                    name="practiceModeType"
                    value="instant"
                    checked={practiceModeType === 'instant'}
                    onChange={() => setPracticeModeType('instant')}
                    className="mt-1 w-4 h-4 text-[#0866FF] border-[#B6CEFA] focus:ring-[#0866FF] shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-extrabold text-[#102A52]">
                      Luyện giải từng câu
                    </span>
                    <span className="block text-xs text-[#526581] mt-0.5">
                      {showInstantSolution
                        ? 'Xem đáp án và giải thích ngay sau khi chọn'
                        : 'Chủ động bấm xem đáp án và lời giải từng câu'}
                    </span>
                  </span>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    practiceModeType === 'timed_exam'
                      ? 'bg-[#F0F6FF] border-[#0866FF] ring-1 ring-[#0866FF]/30'
                      : 'bg-white border-[#D9E7FF] hover:bg-[#F7FAFF]'
                  }`}
                >
                  <input
                    type="radio"
                    name="practiceModeType"
                    value="timed_exam"
                    checked={practiceModeType === 'timed_exam'}
                    onChange={() => setPracticeModeType('timed_exam')}
                    className="mt-1 w-4 h-4 text-[#0866FF] border-[#B6CEFA] focus:ring-[#0866FF] shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-extrabold text-[#102A52]">
                      Thi thử tính giờ
                    </span>
                    <span className="block text-xs text-[#526581] mt-0.5">
                      Đếm giờ liên tục, chấm điểm và xem lời giải khi nộp
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Nút Bắt đầu luyện tập */}
            <button
              type="button"
              onClick={() => handleStartPractice()}
              disabled={
                availableQuestions.length === 0 ||
                isStartingSession ||
                (isLoadingQuestions && eligibleMasterQuestions.length === 0)
              }
              className="w-full min-h-[48px] py-3.5 px-5 bg-gradient-to-b from-[#1E7BFF] to-[#0866FF] hover:from-[#166EF5] hover:to-[#0056E0] text-white text-[15px] font-extrabold rounded-2xl shadow-[0_8px_20px_rgba(8,102,255,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-2"
            >
              {isStartingSession ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <span>Đang tạo phiên luyện tập...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-white" aria-hidden="true" />
                  <span>Bắt đầu luyện tập</span>
                </>
              )}
            </button>

            {/* Dải trạng thái sẵn sàng bên dưới nút */}
            {availableQuestions.length > 0 && (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#EBFDF3] border border-[#C6F4D8] text-[#065F46] text-xs font-bold flex items-center justify-center gap-2">
                <Rocket className="w-4 h-4 text-[#059669] shrink-0" aria-hidden="true" />
                <span>Sẵn sàng chinh phục kiến thức!</span>
              </div>
            )}
          </aside>
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

              {showExitConfirm ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1">
                  <span className="text-[11px] font-bold text-rose-800">Kết thúc phiên?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExitConfirm(false);
                      handleFinishPractice();
                    }}
                    className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700"
                  >
                    Xác nhận
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExitConfirm(false)}
                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(true)}
                  className="px-3 py-1 bg-slate-100 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Kết thúc sớm
                </button>
              )}
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
