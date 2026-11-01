import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Question, CognitiveLevel, QuestionType, QuestionStatus, Grade } from '../../types';
import { MathView } from '../MathView';
import { QuestionEditorModal } from './QuestionEditorModal';
import { QuestionImportModal } from './QuestionImportModal';
import { supabase } from '../../lib/supabase';
import {
  Database,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit3,
  Trash2,
  Eye,
  BookOpen,
  LogIn,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  Layers,
  Sparkles,
  HelpCircle,
  FileText,
  Laptop
} from 'lucide-react';

interface SupabaseProtectedSolution {
  question_id: string;
  correct_answer?: string;
  sub_item_answers?: { id: string; isCorrect: boolean }[];
  accepted_answers?: string[];
  sample_essay_answer?: string;
  rubric?: { text: string; max_points: number } | any;
  explanation: string;
}

/**
 * Chuẩn hóa khối lớp thành chuỗi số đơn (6, 7, 8, 9)
 * Xử lý an toàn các trường hợp dữ liệu: 6, '6', 'Lớp 6', 'Khối 6'
 */
export function normalizeGrade(g: any): string {
  if (g === null || g === undefined) return '';
  const str = String(g).trim();
  const match = str.match(/\b([6-9])\b/) || str.match(/([6-9])/);
  if (match) return match[1];
  return str;
}

/**
 * Chuẩn hóa tên môn học để so sánh chính xác giữa tiếng Việt, tiếng Anh và mã nội bộ
 * Ví dụ: 'Tin học', 'informatics', 'tin_hoc', 'Tin Học', 'Tin học 6' đều cùng quy về 'tin_hoc'
 */
export function normalizeSubject(s: string = ''): string {
  const clean = String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    ['tin hoc', 'tin', 'informatics', 'it', 'tinhoc', 'tin_hoc'].includes(clean) ||
    clean.startsWith('tin hoc') ||
    clean.startsWith('tinhoc') ||
    clean === 'tin'
  ) {
    return 'tin_hoc';
  }
  if (
    ['toan', 'math', 'toan hoc', 'toan_hoc'].includes(clean) ||
    clean.startsWith('toan') ||
    clean.startsWith('math')
  ) {
    return 'toan';
  }
  if (['ngu van', 'van', 'literature', 'ngu_van'].includes(clean) || clean.startsWith('ngu van')) {
    return 'ngu_van';
  }
  if (['tieng anh', 'anh', 'english', 'tieng_anh'].includes(clean) || clean.startsWith('tieng anh')) {
    return 'tieng_anh';
  }
  if (['khoa hoc tu nhien', 'khtn', 'science', 'khoa_hoc_tu_nhien'].includes(clean) || clean.startsWith('khoa hoc')) {
    return 'khtn';
  }
  if (['lich su va dia li', 'lich su dia li', 'lsdl', 'history_geo', 'lich_su_dia_li'].includes(clean)) {
    return 'lich_su_dia_li';
  }
  if (['cong nghe', 'technology', 'cong_nghe'].includes(clean) || clean.startsWith('cong nghe')) {
    return 'cong_nghe';
  }
  if (['giao duc cong dan', 'gdcd', 'civics', 'giao_duc_cong_dan'].includes(clean) || clean.startsWith('giao duc')) {
    return 'gdcd';
  }
  return clean;
}

/**
 * Kiểm tra 2 môn học có tương đương nhau hay không
 */
export function isSameSubject(a: string = '', b: string = ''): boolean {
  if (!a || !b) return false;
  if (a === 'all' || b === 'all') return true;
  return normalizeSubject(a) === normalizeSubject(b);
}

/**
 * Kiểm tra một câu hỏi có thuộc về môn học mục tiêu hay không
 * Hỗ trợ đối chiếu cả theo subject và mã câu hỏi (VD: mã bắt đầu bằng TH6_... hoặc TH_... luôn là Tin học)
 */
export function isQuestionInSubject(q: any, targetSubject: string = ''): boolean {
  if (!targetSubject || targetSubject === 'all') return true;
  const targetNorm = normalizeSubject(targetSubject);
  const qSubjectNorm = normalizeSubject(q?.subject);
  if (qSubjectNorm === targetNorm) return true;

  // Đối chiếu nhận diện bổ trợ theo quy ước mã câu hỏi
  const code = String(q?.code || '').trim().toUpperCase();
  if (targetNorm === 'tin_hoc' && (code.startsWith('TH6') || code.startsWith('TH_') || code.startsWith('TINHOC') || code.startsWith('TH'))) {
    return true;
  }
  if (targetNorm === 'toan' && (code.startsWith('TOAN') || code.startsWith('T8') || code.startsWith('T6') || code.startsWith('T7') || code.startsWith('T9'))) {
    return true;
  }
  return false;
}

/**
 * Lấy tên hiển thị chuẩn tiếng Việt cho môn học
 */
export function getSubjectDisplayName(s: string = ''): string {
  const norm = normalizeSubject(s);
  switch (norm) {
    case 'tin_hoc':
      return 'Tin học';
    case 'toan':
      return 'Toán';
    case 'ngu_van':
      return 'Ngữ văn';
    case 'tieng_anh':
      return 'Tiếng Anh';
    case 'khtn':
      return 'Khoa học tự nhiên';
    case 'lich_su_dia_li':
      return 'Lịch sử và Địa lí';
    case 'cong_nghe':
      return 'Công nghệ';
    case 'gdcd':
      return 'Giáo dục công dân';
    default:
      return s || 'Khác';
  }
}

export const QuestionBank: React.FC = () => {
  const {
    questions: localQuestions,
    user,
    userProfile,
    openAuthModal,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    approveQuestion,
    importQuestionsBatch
  } = useApp();

  // Supabase live data states
  const [supabaseQuestions, setSupabaseQuestions] = useState<any[]>([]);
  const [protectedSolutions, setProtectedSolutions] = useState<Map<string, SupabaseProtectedSolution>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSupabaseSuccess, setIsSupabaseSuccess] = useState<boolean>(false);

  // Data source toggle: 'auto' | 'supabase' | 'local'
  const [dataSource, setDataSource] = useState<'auto' | 'supabase' | 'local'>('auto');

  // Filters state (Mặc định 'all' để không bị ẩn câu hỏi)
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterChapter, setFilterChapter] = useState<string>('all');
  const [filterLesson, setFilterLesson] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modal states
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // User authorization for solutions
  const canAccessSolutions = useMemo(() => {
    const role = userProfile?.role;
    return role === 'teacher' || role === 'admin' || role === 'reviewer';
  }, [userProfile]);

  /**
   * Truy vấn danh sách câu hỏi từ bảng public.questions bằng phiên đăng nhập Supabase hiện tại
   * Cơ chế kép:
   * 1. Chủ động tải toàn bộ câu hỏi môn Tin học (đặc biệt là 272 câu Lớp 6) ngay lập tức
   * 2. Tải toàn bộ ngân hàng câu hỏi tổng quát theo cơ chế phân trang chunked range (0..999, 1000..1999)
   * 3. Hợp nhất vào Map theo ID để đảm bảo không bỏ sót và không trùng lặp
   */
  const loadQuestionsFromSupabase = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const questionMap = new Map<string, any>();

      // 1. Tải ưu tiên các câu hỏi môn Tin học (môn Tin học, Tin học 6, mã TH...)
      try {
        const { data: tinHocData, error: tinHocErr } = await supabase
          .from('questions')
          .select('*')
          .or('subject.ilike.%tin%,subject.ilike.%informatics%,code.ilike.TH%')
          .limit(1000);

        if (!tinHocErr && tinHocData && tinHocData.length > 0) {
          tinHocData.forEach((q: any) => {
            if (q.id) questionMap.set(q.id, q);
          });
        }
      } catch (tErr) {
        console.warn('Lưu ý khi tải trực tiếp câu hỏi Tin học:', tErr);
      }

      // 2. Tải tất cả các lô câu hỏi từ public.questions bằng chunked range
      const batchPageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: qBatch, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + batchPageSize - 1);

        if (qErr) {
          if (questionMap.size === 0) {
            console.error('Lỗi truy vấn bảng questions Supabase:', qErr);
            setFetchError(`Mã lỗi [${qErr.code}]: ${qErr.message}. ${qErr.hint || ''}`);
            setIsSupabaseSuccess(false);
            setIsLoading(false);
            return;
          }
          hasMore = false;
          break;
        }

        if (!qBatch || qBatch.length === 0) {
          hasMore = false;
          break;
        }

        qBatch.forEach((q: any) => {
          if (q.id && !questionMap.has(q.id)) {
            questionMap.set(q.id, q);
          }
        });

        // Nếu lô trả về ít hơn 1000 hoặc đã tải đủ
        if (qBatch.length < batchPageSize || questionMap.size >= 10000) {
          hasMore = false;
        } else {
          from += batchPageSize;
        }
      }

      const allQuestions = Array.from(questionMap.values());
      setSupabaseQuestions(allQuestions);
      setIsSupabaseSuccess(allQuestions.length > 0);

      // 3. Nếu có quyền truy cập, tải toàn bộ bảng protected_solutions (dùng chunked range)
      if (canAccessSolutions) {
        try {
          let allSolutions: any[] = [];
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

            allSolutions = allSolutions.concat(solBatch);

            if (solBatch.length < batchPageSize || allSolutions.length >= 10000) {
              solHasMore = false;
            } else {
              solFrom += batchPageSize;
            }
          }

          const solMap = new Map<string, SupabaseProtectedSolution>();
          allSolutions.forEach((s: any) => {
            solMap.set(s.question_id, s);
          });
          setProtectedSolutions(solMap);
        } catch (sErr) {
          console.warn('Lỗi kết nối protected_solutions:', sErr);
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Lỗi mạng khi kết nối cơ sở dữ liệu Supabase.';
      setFetchError(msg);
      setIsSupabaseSuccess(false);
    } finally {
      setIsLoading(false);
    }
  }, [canAccessSolutions]);

  // Load questions on mount or auth change
  useEffect(() => {
    loadQuestionsFromSupabase();
  }, [loadQuestionsFromSupabase]);

  // Danh sách câu hỏi nguồn đang được sử dụng: kết hợp Supabase + Local để không bao giờ bị thiếu câu
  const activeQuestions = useMemo(() => {
    if (dataSource === 'supabase') {
      return supabaseQuestions.length > 0 ? supabaseQuestions : localQuestions;
    }
    if (dataSource === 'local') return localQuestions;

    // Chế độ tự động: Hợp nhất Supabase + Local (Supabase ghi đè bản trùng để ưu tiên CSDL thực tế)
    const combinedMap = new Map<string, any>();
    (localQuestions || []).forEach(q => combinedMap.set(q.id, q));
    (supabaseQuestions || []).forEach(q => combinedMap.set(q.id, q));
    return Array.from(combinedMap.values());
  }, [dataSource, supabaseQuestions, localQuestions]);

  const isCurrentSourceSupabase = Boolean(
    dataSource === 'supabase' ||
      (isSupabaseSuccess && supabaseQuestions.length > 0)
  );

  // Danh sách các chương/chủ đề dựa trên activeQuestions và khối/môn đã chọn
  const availableChapters = useMemo(() => {
    const chapters = new Set<string>();
    activeQuestions.forEach(q => {
      const matchGrade = filterGrade === 'all' || normalizeGrade(q.grade) === normalizeGrade(filterGrade);
      const matchSubject = isQuestionInSubject(q, filterSubject);
      if (matchGrade && matchSubject && q.chapter) {
        chapters.add(q.chapter);
      }
    });
    return Array.from(chapters).sort();
  }, [activeQuestions, filterGrade, filterSubject]);

  // Danh sách các bài học cụ thể
  const availableLessons = useMemo(() => {
    const lessons = new Set<string>();
    activeQuestions.forEach(q => {
      const matchGrade = filterGrade === 'all' || normalizeGrade(q.grade) === normalizeGrade(filterGrade);
      const matchSubject = isQuestionInSubject(q, filterSubject);
      const matchChapter = filterChapter === 'all' || q.chapter === filterChapter;
      if (matchGrade && matchSubject && matchChapter && q.lesson) {
        lessons.add(q.lesson);
      }
    });
    return Array.from(lessons).sort();
  }, [activeQuestions, filterGrade, filterSubject, filterChapter]);

  // Danh mục môn học chuẩn cùng số lượng câu hỏi thực tế trong activeQuestions
  const standardSubjects = [
    { id: 'all', name: 'Tất cả môn học' },
    { id: 'Tin học', name: 'Tin học' },
    { id: 'Toán', name: 'Toán' },
    { id: 'Khoa học tự nhiên', name: 'Khoa học tự nhiên' },
    { id: 'Ngữ văn', name: 'Ngữ văn' },
    { id: 'Tiếng Anh', name: 'Tiếng Anh' },
    { id: 'Công nghệ', name: 'Công nghệ' },
    { id: 'Lịch sử và Địa lí', name: 'Lịch sử và Địa lí' },
    { id: 'Giáo dục công dân', name: 'Giáo dục công dân' }
  ];

  // Lọc câu hỏi theo tất cả các tiêu chí
  const filteredQuestions = useMemo(() => {
    return activeQuestions.filter(q => {
      // 1. Khối lớp (chuẩn hóa 6, 7, 8, 9)
      const matchGrade = filterGrade === 'all' || normalizeGrade(q.grade) === normalizeGrade(filterGrade);

      // 2. Môn học (hỗ trợ cả chuẩn hóa tên và nhận diện tiền tố mã TH6, TOAN...)
      const matchSubject = filterSubject === 'all' || isQuestionInSubject(q, filterSubject);

      // 3. Chủ đề / Chương
      const matchChapter = filterChapter === 'all' || q.chapter === filterChapter;

      // 4. Bài học
      const matchLesson = filterLesson === 'all' || q.lesson === filterLesson;

      // 5. Mức độ
      const matchLevel = filterLevel === 'all' || q.level === filterLevel;

      // 6. Dạng câu
      const matchType = filterType === 'all' || q.type === filterType;

      // 7. Trạng thái
      const matchStatus = filterStatus === 'all' || q.status === filterStatus;

      // 8. Tìm kiếm từ khóa
      const qStem = q.stem || '';
      const qCode = q.code || '';
      const qLesson = q.lesson || '';
      const qChapter = q.chapter || '';
      const term = searchTerm.toLowerCase();

      const matchSearch =
        !term ||
        qCode.toLowerCase().includes(term) ||
        qStem.toLowerCase().includes(term) ||
        qLesson.toLowerCase().includes(term) ||
        qChapter.toLowerCase().includes(term);

      return matchGrade && matchSubject && matchChapter && matchLesson && matchLevel && matchType && matchStatus && matchSearch;
    });
  }, [
    activeQuestions,
    filterGrade,
    filterSubject,
    filterChapter,
    filterLesson,
    filterLevel,
    filterType,
    filterStatus,
    searchTerm
  ]);

  // Reset trang khi bộ lọc thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [filterGrade, filterSubject, filterChapter, filterLesson, filterLevel, filterType, filterStatus, searchTerm, pageSize]);

  // Phân trang
  const paginatedQuestions = useMemo(() => {
    if (pageSize >= 9999) return filteredQuestions;
    const start = (currentPage - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredQuestions.length / (pageSize >= 9999 ? 1 : pageSize)) || 1;

  // Thao tác duyệt câu hỏi
  const handleApproveQuestion = async (qId: string) => {
    if (isCurrentSourceSupabase) {
      try {
        const { error } = await supabase
          .from('questions')
          .update({ status: 'approved' })
          .eq('id', qId);

        if (error) {
          alert(`Lỗi khi duyệt câu hỏi: ${error.message}`);
        } else {
          setSupabaseQuestions(prev =>
            prev.map(item => (item.id === qId ? { ...item, status: 'approved' } : item))
          );
          setActionSuccessMessage('Đã phê duyệt câu hỏi thành công vào ngân hàng chính thức!');
          setTimeout(() => setActionSuccessMessage(null), 3000);
        }
      } catch (err: any) {
        alert(`Lỗi: ${err?.message || 'Không thể cập nhật Supabase'}`);
      }
    } else {
      approveQuestion(qId);
      setActionSuccessMessage('Đã phê duyệt câu hỏi thành công!');
      setTimeout(() => setActionSuccessMessage(null), 3000);
    }
  };

  // Thao tác xóa câu hỏi
  const handleDeleteQuestion = async (qId: string, qCode: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa câu hỏi "${qCode}"? Thao tác không thể hoàn tác.`)) {
      return;
    }
    if (isCurrentSourceSupabase) {
      try {
        const { error } = await supabase
          .from('questions')
          .delete()
          .eq('id', qId);

        if (error) {
          alert(`Lỗi khi xóa câu hỏi: ${error.message}`);
        } else {
          setSupabaseQuestions(prev => prev.filter(item => item.id !== qId));
          setActionSuccessMessage(`Đã xóa câu hỏi "${qCode}" khỏi Supabase.`);
          setTimeout(() => setActionSuccessMessage(null), 3000);
        }
      } catch (err: any) {
        alert(`Lỗi: ${err?.message || 'Không thể xóa trên Supabase'}`);
      }
    } else {
      deleteQuestion(qId);
      setActionSuccessMessage(`Đã xóa câu hỏi "${qCode}".`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
    }
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    let single = 0;
    let tf = 0;
    let essay = 0;
    let short = 0;
    filteredQuestions.forEach(q => {
      if (q.type === 'single_choice') single++;
      else if (q.type === 'true_false_group') tf++;
      else if (q.type === 'essay') essay++;
      else if (q.type === 'short_answer') short++;
    });
    return { single, tf, essay, short, total: filteredQuestions.length };
  }, [filteredQuestions]);

  // Thống kê số lượng theo môn Tin học
  const informaticsTotalCount = useMemo(() => {
    return activeQuestions.filter(q => isQuestionInSubject(q, 'Tin học')).length;
  }, [activeQuestions]);

  const informatics6PendingCount = useMemo(() => {
    return activeQuestions.filter(
      q =>
        isQuestionInSubject(q, 'Tin học') &&
        normalizeGrade(q.grade) === '6' &&
        q.status === 'pending'
    ).length;
  }, [activeQuestions]);

  // Reset all filters
  const handleResetFilters = () => {
    setFilterGrade('all');
    setFilterSubject('all');
    setFilterChapter('all');
    setFilterLesson('all');
    setFilterLevel('all');
    setFilterType('all');
    setFilterStatus('all');
    setSearchTerm('');
  };

  // Preset 1: Lọc môn Tin học (Tất cả khối lớp, tất cả trạng thái)
  const applyPresetAllInformatics = () => {
    setFilterSubject('Tin học');
    setFilterGrade('all');
    setFilterStatus('all');
    setFilterChapter('all');
    setFilterLesson('all');
    setFilterType('all');
    setFilterLevel('all');
    setSearchTerm('');
  };

  // Preset 2: Lớp 6 • Tin học • Chờ duyệt (Khớp 272 câu đề bài)
  const applyPresetGrade6InformaticsPending = () => {
    setFilterSubject('Tin học');
    setFilterGrade('6');
    setFilterStatus('pending');
    setFilterChapter('all');
    setFilterLesson('all');
    setFilterType('all');
    setFilterLevel('all');
    setSearchTerm('');
  };

  // Preset 3: Môn Toán học
  const applyPresetMath = () => {
    setFilterSubject('Toán');
    setFilterGrade('all');
    setFilterStatus('all');
    setFilterChapter('all');
    setFilterLesson('all');
    setFilterType('all');
    setFilterLevel('all');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6 font-serif">
      {/* Toast thông báo thao tác */}
      {actionSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2.5">
            <Database className="w-6 h-6 text-[#006BFF]" />
            <span>Ngân hàng câu hỏi trắc nghiệm</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý, phân loại và biên soạn theo chuẩn ma trận đề GDPT 2018
          </p>

          {/* Badge nguồn dữ liệu */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isLoading ? (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md inline-flex items-center space-x-1.5 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                <span>Đang truy vấn bảng public.questions từ Supabase...</span>
              </span>
            ) : isCurrentSourceSupabase ? (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-md inline-flex items-center space-x-1.5 shadow-2xs">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Dữ liệu Supabase ({activeQuestions.length} câu)</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-md inline-flex items-center space-x-1.5">
                <Laptop className="w-3.5 h-3.5 text-slate-600" />
                <span>Dữ liệu trên trình duyệt ({activeQuestions.length} câu)</span>
              </span>
            )}

            {/* Toggle nguồn dữ liệu khi cả 2 nguồn đều có sẵn */}
            {user && supabaseQuestions.length > 0 && localQuestions.length > 0 && (
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10.5px] font-bold">
                <button
                  onClick={() => setDataSource('supabase')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    isCurrentSourceSupabase ? 'bg-white text-[#006BFF] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Supabase ({supabaseQuestions.length})
                </button>
                <button
                  onClick={() => setDataSource('local')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    !isCurrentSourceSupabase ? 'bg-white text-[#006BFF] shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Trình duyệt ({localQuestions.length})
                </button>
              </div>
            )}

            {(user || userProfile) && (
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                Tài khoản: <b>{userProfile?.fullName || user?.email || 'Thầy Diệp Thanh Toàn'}</b> ({userProfile?.role === 'admin' ? 'Quản trị viên' : userProfile?.role === 'teacher' ? 'Giáo viên' : 'Học sinh'})
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút Làm mới từ Supabase */}
          <button
            onClick={loadQuestionsFromSupabase}
            disabled={isLoading}
            className="flex items-center space-x-1 px-3 py-2 bg-white text-slate-700 border border-[#DCE8F7] rounded-xl text-xs font-bold hover:bg-[#F3F8FF] hover:text-[#006BFF] transition-colors shadow-2xs disabled:opacity-50"
            title="Tải lại từ bảng public.questions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#006BFF]' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Nhập Excel / Word</span>
          </button>

          <button
            onClick={() => {
              setEditingQuestion(null);
              setEditorModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Soạn câu hỏi mới</span>
          </button>
        </div>
      </div>

      {/* Thông báo hướng dẫn khi chưa đăng nhập Supabase */}
      {!user && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/70 rounded-2xl border border-blue-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 text-[#006BFF] rounded-xl shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#082B52]">
                Bạn đang xem dữ liệu trên trình duyệt ({activeQuestions.length} câu)
              </h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Đăng nhập tài khoản Giáo viên/Quản trị viên để đồng bộ và truy vấn trực tiếp 272 câu Tin học 6 từ bảng CSDL Supabase.
              </p>
            </div>
          </div>
          <button
            onClick={() => openAuthModal('login')}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs transition-colors shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập ngay</span>
          </button>
        </div>
      )}

      {/* Quick Filter Presets Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 flex items-center space-x-1 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-[#006BFF]" />
          <span>Lọc nhanh:</span>
        </span>

        {/* Nút lọc: Môn Tin học (Tất cả khối) */}
        <button
          onClick={applyPresetAllInformatics}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            filterSubject === 'Tin học' && filterGrade === 'all' && filterStatus === 'all'
              ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-xs ring-2 ring-blue-200'
              : 'bg-white text-slate-700 border-[#DCE8F7] hover:bg-[#F3F8FF] hover:border-[#006BFF]'
          }`}
        >
          Môn Tin học ({informaticsTotalCount} câu)
        </button>

        {/* Nút lọc: Tin học 6 • Chờ duyệt */}
        <button
          onClick={applyPresetGrade6InformaticsPending}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            filterGrade === '6' && filterSubject === 'Tin học' && filterStatus === 'pending'
              ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-xs ring-2 ring-blue-200'
              : 'bg-white text-slate-700 border-[#DCE8F7] hover:bg-[#F3F8FF] hover:border-[#006BFF]'
          }`}
        >
          Tin học 6 • Chờ duyệt ({informatics6PendingCount} câu)
        </button>

        {/* Nút lọc: Môn Toán */}
        <button
          onClick={applyPresetMath}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            filterSubject === 'Toán' && filterGrade === 'all'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-[#DCE8F7] hover:bg-[#F3F8FF]'
          }`}
        >
          Môn Toán ({activeQuestions.filter(q => isQuestionInSubject(q, 'Toán')).length} câu)
        </button>

        {/* Nút lọc theo dạng câu */}
        <button
          onClick={() => {
            setFilterType(filterType === 'single_choice' ? 'all' : 'single_choice');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            filterType === 'single_choice'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-[#DCE8F7] hover:bg-[#F3F8FF]'
          }`}
        >
          Trắc nghiệm ABCD ({stats.single})
        </button>

        <button
          onClick={() => {
            setFilterType(filterType === 'true_false_group' ? 'all' : 'true_false_group');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            filterType === 'true_false_group'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white text-slate-700 border-[#DCE8F7] hover:bg-emerald-50'
          }`}
        >
          Đúng – Sai 4 ý ({stats.tf})
        </button>

        <button
          onClick={() => {
            setFilterType(filterType === 'essay' ? 'all' : 'essay');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            filterType === 'essay'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-white text-slate-700 border-[#DCE8F7] hover:bg-indigo-50'
          }`}
        >
          Tự luận ({stats.essay})
        </button>

        <button
          onClick={handleResetFilters}
          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Đặt lại tất cả bộ lọc"
        >
          Đặt lại bộ lọc
        </button>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs space-y-3">
        {/* Row 1: Search & Core Curriculum Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã câu, nội dung đề bài, tên bài..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] focus:outline-hidden focus:ring-1 focus:ring-[#006BFF]"
            />
          </div>

          {/* 1. Bộ lọc Môn học */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Môn học:</label>
            <select
              value={filterSubject}
              onChange={e => {
                setFilterSubject(e.target.value);
                setFilterChapter('all');
                setFilterLesson('all');
              }}
              className="w-full text-xs px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#006BFF]"
            >
              {standardSubjects.map(sub => {
                const count =
                  sub.id === 'all'
                    ? activeQuestions.length
                    : activeQuestions.filter(q => isQuestionInSubject(q, sub.id)).length;
                return (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({count} câu)
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Bộ lọc Khối lớp (6, 7, 8, 9) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Khối lớp:</label>
            <select
              value={filterGrade}
              onChange={e => {
                setFilterGrade(e.target.value);
                setFilterChapter('all');
                setFilterLesson('all');
              }}
              className="w-full text-xs px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#006BFF]"
            >
              <option value="all">Tất cả khối lớp ({activeQuestions.length})</option>
              {['6', '7', '8', '9'].map(g => {
                const gCount = activeQuestions.filter(q => {
                  const matchSub = filterSubject === 'all' || isQuestionInSubject(q, filterSubject);
                  return normalizeGrade(q.grade) === g && matchSub;
                }).length;
                return (
                  <option key={g} value={g}>
                    Khối {g} (Lớp {g}) - {gCount} câu
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Bộ lọc Trạng thái duyệt */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Trạng thái duyệt:</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#006BFF]"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt (Chính thức)</option>
              <option value="draft">Bản nháp</option>
              <option value="deprecated">Ngừng sử dụng</option>
            </select>
          </div>
        </div>

        {/* Row 2: Chapter, Lesson, Level & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
          {/* 4. Bộ lọc Chủ đề / Chương */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Chủ đề / Chương:</label>
            <select
              value={filterChapter}
              onChange={e => {
                setFilterChapter(e.target.value);
                setFilterLesson('all');
              }}
              className="w-full text-xs px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#006BFF] truncate"
            >
              <option value="all">Tất cả chủ đề / chương ({availableChapters.length})</option>
              {availableChapters.map(chap => (
                <option key={chap} value={chap}>
                  {chap}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Bộ lọc Bài học */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Bài học cụ thể:</label>
            <select
              value={filterLesson}
              onChange={e => setFilterLesson(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#006BFF] truncate"
            >
              <option value="all">Tất cả bài học ({availableLessons.length})</option>
              {availableLessons.map(les => (
                <option key={les} value={les}>
                  {les}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Mức độ nhận thức */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Mức độ nhận thức:</label>
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#006BFF]"
            >
              <option value="all">Tất cả mức độ</option>
              <option value="know">Nhận biết</option>
              <option value="understand">Thông hiểu</option>
              <option value="apply">Vận dụng</option>
            </select>
          </div>

          {/* 7. Dạng câu hỏi */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Dạng câu hỏi:</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-[#006BFF]"
            >
              <option value="all">Tất cả dạng câu</option>
              <option value="single_choice">Trắc nghiệm ABCD (1 ĐA)</option>
              <option value="true_false_group">Đúng – Sai nhiều ý (a–d)</option>
              <option value="essay">Tự luận</option>
              <option value="short_answer">Trả lời ngắn</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Page Size Controls */}
        <div className="text-xs text-slate-500 font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <span>
              Tìm thấy <b className="text-[#006BFF] text-sm">{filteredQuestions.length}</b> câu hỏi phù hợp
              {filterSubject !== 'all' && ` • Môn ${filterSubject}`}
              {filterGrade !== 'all' && ` • Lớp ${filterGrade}`}
              {filterStatus !== 'all' && ` • Trạng thái: ${filterStatus === 'pending' ? 'Chờ duyệt' : filterStatus === 'approved' ? 'Đã duyệt' : filterStatus}`}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-slate-400">Hiển thị mỗi trang:</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(parseInt(e.target.value, 10))}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
            >
              <option value={15}>15 câu</option>
              <option value={25}>25 câu</option>
              <option value={50}>50 câu</option>
              <option value={100}>100 câu</option>
              <option value={9999}>Tất cả</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#006BFF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-[#082B52]">Đang tải dữ liệu câu hỏi từ Supabase...</p>
          <p className="text-xs text-slate-400">Đang truy vấn bảng public.questions theo phiên người dùng</p>
        </div>
      )}

      {/* Questions list */}
      {!isLoading && (
        <div className="space-y-4">
          {paginatedQuestions.map((q, idx) => {
            // Solution from protected_solutions
            const solution = protectedSolutions.get(q.id);

            // Options parsing safely
            const rawOptions: any[] = Array.isArray(q.options)
              ? q.options
              : typeof q.options === 'string'
              ? (() => {
                  try {
                    return JSON.parse(q.options);
                  } catch {
                    return [];
                  }
                })()
              : [];

            // Sub items parsing safely
            const rawSubItems: any[] = Array.isArray(q.sub_items)
              ? q.sub_items
              : typeof q.sub_items === 'string'
              ? (() => {
                  try {
                    return JSON.parse(q.sub_items);
                  } catch {
                    return q.subItems || [];
                  }
                })()
              : q.subItems || [];

            // Sub item answers from solution or item itself
            const subItemAnswers: any[] = solution?.sub_item_answers
              ? Array.isArray(solution.sub_item_answers)
                ? solution.sub_item_answers
                : typeof solution.sub_item_answers === 'string'
                ? (() => {
                    try {
                      return JSON.parse(solution.sub_item_answers as any);
                    } catch {
                      return [];
                    }
                  })()
                : []
              : [];

            // Rubric parsing safely
            const rubric = solution?.rubric
              ? typeof solution.rubric === 'string'
                ? (() => {
                    try {
                      return JSON.parse(solution.rubric);
                    } catch {
                      return { text: solution.rubric };
                    }
                  })()
                : solution.rubric
              : null;

            return (
              <div
                key={q.id || q.code || idx}
                className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4 hover:border-[#006BFF]/60 transition-colors"
              >
                {/* Header info row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-md bg-blue-100 text-[#006BFF]">
                      {q.code}
                    </span>

                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      Lớp {q.grade} • {getSubjectDisplayName(q.subject)}
                    </span>

                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800">
                      {q.type === 'single_choice'
                        ? 'Trắc nghiệm ABCD'
                        : q.type === 'true_false_group'
                        ? 'Đúng - Sai (4 ý)'
                        : q.type === 'essay'
                        ? 'Tự luận'
                        : 'Trả lời ngắn'}
                    </span>

                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        q.level === 'know'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : q.level === 'understand'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {q.level === 'know' ? 'Nhận biết' : q.level === 'understand' ? 'Thông hiểu' : 'Vận dụng'}
                    </span>

                    <span className="text-xs text-slate-500 truncate max-w-xs" title={`${q.chapter} • ${q.lesson}`}>
                      • {q.lesson}
                    </span>
                  </div>

                  {/* Status badge & Actions */}
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        q.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : q.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : q.status === 'deprecated'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {q.status === 'approved'
                        ? 'Đã duyệt'
                        : q.status === 'pending'
                        ? 'Chờ duyệt'
                        : q.status === 'deprecated'
                        ? 'Ngừng sử dụng'
                        : 'Bản nháp'}
                    </span>

                    {/* Nút Phê duyệt câu hỏi */}
                    {q.status === 'pending' && (
                      <button
                        onClick={() => handleApproveQuestion(q.id)}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-2xs transition-colors"
                        title="Phê duyệt câu hỏi này vào ngân hàng chính thức"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Duyệt</span>
                      </button>
                    )}

                    {/* Nút Xóa câu hỏi */}
                    {userProfile?.role === 'admin' && (
                      <button
                        onClick={() => handleDeleteQuestion(q.id, q.code)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Stem */}
                <div className="text-sm sm:text-base font-medium text-[#12345B] leading-relaxed">
                  <MathView content={q.stem} />
                </div>

                {/* 1. Trắc nghiệm Single Choice */}
                {q.type === 'single_choice' && rawOptions.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {rawOptions.map((opt: any, optIdx: number) => {
                      const optLabel = opt.label || opt.id || String.fromCharCode(65 + optIdx);
                      const optText = opt.text || opt.content || '';
                      const isCorrect =
                        (solution?.correct_answer &&
                          (String(solution.correct_answer).toUpperCase() === String(optLabel).toUpperCase() ||
                            String(solution.correct_answer) === String(opt.id))) ||
                        (q.correctAnswer &&
                          (String(q.correctAnswer).toUpperCase() === String(optLabel).toUpperCase() ||
                            String(q.correctAnswer) === String(opt.id)));

                      return (
                        <div
                          key={opt.id || optIdx}
                          className={`p-2.5 rounded-xl border flex items-start space-x-2 transition-colors ${
                            isCorrect
                              ? 'border-emerald-400 bg-emerald-50/70 text-emerald-950 font-bold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span className={`font-bold ${isCorrect ? 'text-emerald-700' : 'text-[#006BFF]'}`}>
                            {optLabel}.
                          </span>
                          <div className="flex-1">
                            <MathView content={optText} />
                          </div>
                          {isCorrect && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 shrink-0">
                              ✓ Đáp án đúng
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Đúng - Sai 4 ý */}
                {q.type === 'true_false_group' && rawSubItems.length > 0 && (
                  <div className="space-y-2 text-xs bg-[#FBFDFF] p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-slate-700 font-bold mb-1">
                      <span>Bốn nhận định đánh giá (a – d):</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        Điểm tối đa cả câu: <b>{q.points || 1.0} điểm</b>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {rawSubItems.map((sub: any, subIdx: number) => {
                        const subLabel = ['a', 'b', 'c', 'd'][subIdx] || sub.label || sub.id;
                        const subText = sub.text || '';
                        const subLevel = sub.level || 'know';

                        const matchedAns = subItemAnswers.find(
                          (a: any) => String(a.id).toLowerCase() === String(sub.id).toLowerCase()
                        ) || subItemAnswers[subIdx];

                        const isAnswerAvailable = matchedAns !== undefined || sub.isCorrect !== undefined;
                        const isCorrect = matchedAns !== undefined ? matchedAns.isCorrect : sub.isCorrect;

                        return (
                          <div
                            key={sub.id || subIdx}
                            className="p-2 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="flex items-start space-x-2 flex-1">
                              <b className="text-[#006BFF]">{subLabel})</b>
                              <div className="text-slate-800">
                                <MathView content={subText} />
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                {subLevel === 'know' ? 'Nhận biết' : subLevel === 'understand' ? 'Thông hiểu' : 'Vận dụng'}
                              </span>

                              {isAnswerAvailable ? (
                                <span
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                    isCorrect
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-red-100 text-red-800 border border-red-300'
                                  }`}
                                >
                                  {isCorrect ? 'Đúng' : 'Sai'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic bg-slate-100 px-2 py-0.5 rounded">
                                  Bảo mật đáp án
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Tự luận */}
                {q.type === 'essay' && (
                  <div className="text-xs bg-blue-50/40 p-3.5 rounded-xl border border-blue-200 space-y-2 text-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-[#006BFF]" />
                        <span className="font-bold text-[#082B52]">Thông số chấm & Yêu cầu tự luận:</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {q.competency && (
                          <span className="bg-white border border-blue-200 text-blue-800 px-2 py-0.5 rounded font-medium">
                            Năng lực: <b>{q.competency}</b>
                          </span>
                        )}
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">
                          Điểm tối đa: {rubric?.max_points || q.points || 1.0} điểm
                        </span>
                      </div>
                    </div>

                    {(solution?.sample_essay_answer || q.sampleAnswer) && (
                      <div>
                        <b className="text-[#006BFF] block mb-0.5">Đáp án mẫu:</b>
                        <p className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-line">
                          {solution?.sample_essay_answer || q.sampleAnswer}
                        </p>
                      </div>
                    )}

                    {(rubric?.text || solution?.explanation || q.explanation) && (
                      <div>
                        <b className="text-emerald-700 block mb-0.5">Tiêu chuẩn chấm / Rubric:</b>
                        <p className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-line">
                          {rubric?.text || solution?.explanation || q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Trả lời ngắn */}
                {q.type === 'short_answer' && (solution?.accepted_answers || q.acceptedAnswers) && (
                  <div className="text-xs bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200 text-emerald-900">
                    Đáp án chấp nhận:{' '}
                    <b>
                      {Array.isArray(solution?.accepted_answers || q.acceptedAnswers)
                        ? (solution?.accepted_answers || q.acceptedAnswers).join(' | ')
                        : String(solution?.accepted_answers || q.acceptedAnswers)}
                    </b>
                  </div>
                )}

                {/* Lời giải chi tiết */}
                {(solution?.explanation || q.explanation) && q.type !== 'essay' && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-[#082B52]">Lời giải chi tiết: </span>
                    <MathView content={solution?.explanation || q.explanation} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state when no questions match filters */}
          {filteredQuestions.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-12 text-center space-y-4">
              <div className="w-12 h-12 bg-blue-50 text-[#006BFF] rounded-full flex items-center justify-center mx-auto">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[#082B52]">Không tìm thấy câu hỏi nào phù hợp</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Không có câu hỏi nào thỏa mãn tất cả tiêu chí bộ lọc đang chọn. Hãy thử nhấp vào các phím tắt bên dưới để xem danh sách câu hỏi.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors"
                >
                  Đặt lại tất cả bộ lọc
                </button>
                <button
                  onClick={applyPresetAllInformatics}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                >
                  Xem toàn bộ môn Tin học ({informaticsTotalCount} câu)
                </button>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredQuestions.length > pageSize && pageSize < 9999 && (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                Hiển thị <b>{(currentPage - 1) * pageSize + 1}</b> –{' '}
                <b>{Math.min(currentPage * pageSize, filteredQuestions.length)}</b> trên tổng số{' '}
                <b>{filteredQuestions.length}</b> câu hỏi
              </span>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 7) {
                    if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors ${
                        currentPage === pageNum
                          ? 'bg-[#006BFF] text-white shadow-xs'
                          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor Modal */}
      {editorModalOpen && (
        <QuestionEditorModal
          question={editingQuestion}
          onClose={() => setEditorModalOpen(false)}
          onSave={q => {
            if (editingQuestion) {
              updateQuestion(q);
            } else {
              addQuestion(q);
            }
            loadQuestionsFromSupabase();
          }}
        />
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <QuestionImportModal
          onClose={() => setImportModalOpen(false)}
          onImportSuccess={() => {
            loadQuestionsFromSupabase();
          }}
        />
      )}
    </div>
  );
};
