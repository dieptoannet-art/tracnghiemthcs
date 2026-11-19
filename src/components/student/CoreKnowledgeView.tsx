import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Book,
  BookOpen,
  ArrowLeft,
  Maximize2,
  Minimize2,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Info,
  Play,
  Download,
  ClipboardList,
  Award,
  Compass,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText,
  RotateCcw,
  Rocket
} from 'lucide-react';
import {
  CoreKnowledgeLesson,
  CoreKnowledgeGroup
} from '../../types/coreKnowledge';
import {
  AVAILABLE_GRADES,
  SUPPORTED_BRIDGE_LESSON_IDS,
  getSubjectsByGrade,
  getVolumesByGradeAndSubject,
  getGroupsByGradeAndSubject,
  getLessonsByGroup,
  getCoreKnowledgeLessonById
} from '../../data/coreKnowledgeLessons';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { mountLessonHistoryBridge } from '../../lib/lessonHistoryBridge';
import { Grade } from '../../types';
import {
  findMatchingPublishedWorksheetsByLesson,
  mapCatalogSubjectCodeToId,
  triggerMaterialDownload
} from '../../utils/studyMaterialsSync';
import {
  HeroKnowledgeIllustration3D,
  SubjectBookIllustration3D,
  RecentLaptopIllustration3D,
  LessonCardIllustration3D
} from './coreKnowledgeThumbnails';
import { TOAN9_INTEGRATED_LESSON_IDS } from '../grade9/Toan9Lessons1To5View';
import { KHKT_DEMO_KEYS } from '../../utils/khktDemoSandbox';

const RECENT_VIEW_KEY = 'taydo_last_viewed_core_lesson';

export const CoreKnowledgeView: React.FC = () => {
  const {
    user,
    isDemoSandbox,
    studyDocs,
    openStudyMaterialsWithIntent,
    coreKnowledgeTargetLessonId,
    clearCoreKnowledgeTargetLesson,
    setCurrentView,
  } = useApp();

  const recentStorageKey = isDemoSandbox ? KHKT_DEMO_KEYS.RECENT_CORE_LESSON : RECENT_VIEW_KEY;

  // 1. Bộ chọn 5 cấp phụ thuộc: Khối lớp -> Môn học -> Tập sách -> Chương/Chủ đề -> Bài học
  // Mặc định ban đầu: Khối 6, Môn Toán, Tập 1, Chương I, Bài 1
  const [selectedGrade, setSelectedGrade] = useState<number | ''>(6);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('Toan');
  const [selectedVolume, setSelectedVolume] = useState<number | ''>(1);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('1_Chương I. Tập hợp các số tự nhiên');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('toan_6_c1_b1');

  // Trạng thái khung học tập iframe
  const [activeLesson, setActiveLesson] = useState<CoreKnowledgeLesson | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);
  const [iframeError, setIframeError] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const frameContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'connected' | 'offline_mode'>('idle');

  // Ghi nhận lịch sử bài học vừa mở gần nhất (chỉ lưu vết, không tính điểm/hoàn thành)
  const [recentView, setRecentView] = useState<{
    lessonId: string;
    lessonTitle: string;
    breadcrumb: string;
    viewedAt: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(recentStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 2. Danh sách Môn học phụ thuộc vào Khối lớp
  const availableSubjects = useMemo(() => {
    if (!selectedGrade) return [];
    return getSubjectsByGrade(Number(selectedGrade));
  }, [selectedGrade]);

  // 3. Danh sách Tập sách phụ thuộc vào Khối lớp & Môn học (Toán có Tập 1 / Tập 2)
  const availableVolumes = useMemo(() => {
    if (!selectedGrade || !selectedSubjectCode) return [];
    return getVolumesByGradeAndSubject(Number(selectedGrade), selectedSubjectCode);
  }, [selectedGrade, selectedSubjectCode]);

  const hasMultipleVolumes = availableVolumes.length > 1;

  // 4. Danh sách Chương / Chủ đề phụ thuộc vào Khối, Môn & Tập sách
  const availableGroups = useMemo(() => {
    if (!selectedGrade || !selectedSubjectCode) return [];
    if (hasMultipleVolumes && !selectedVolume) return [];
    return getGroupsByGradeAndSubject(
      Number(selectedGrade),
      selectedSubjectCode,
      selectedVolume ? Number(selectedVolume) : undefined
    );
  }, [selectedGrade, selectedSubjectCode, selectedVolume, hasMultipleVolumes]);

  // 5. Danh sách Bài học phụ thuộc vào Khối, Môn & Nhóm (sắp xếp theo sortOrder số học)
  const availableLessons = useMemo(() => {
    if (!selectedGrade || !selectedSubjectCode || !selectedGroupKey) return [];
    return getLessonsByGroup(Number(selectedGrade), selectedSubjectCode, selectedGroupKey);
  }, [selectedGrade, selectedSubjectCode, selectedGroupKey]);

  // Phân nhóm nhánh bài học (đặc biệt cho Tin học 8 & 9 Chủ đề 4: Bài chung, Nhánh a, Nhánh b)
  const lessonBranchGroups = useMemo(() => {
    const hasBranches = availableLessons.some(l => Boolean(l.branch));
    if (!hasBranches) {
      return {
        hasBranches: false,
        common: availableLessons,
        branchA: [] as CoreKnowledgeLesson[],
        branchB: [] as CoreKnowledgeLesson[],
        commonLabel: '',
        branchALabel: '',
        branchBLabel: ''
      };
    }
    const common = availableLessons.filter(l => !l.branch);
    const branchA = availableLessons.filter(l => Boolean(l.branch && l.branch.startsWith('a')));
    const branchB = availableLessons.filter(l => Boolean(l.branch && l.branch.startsWith('b')));

    const getCode = (l?: CoreKnowledgeLesson): string => {
      if (!l) return '';
      const m = l.lessonLabel.match(/^(Bài\s+[0-9]+[ab]?)/i);
      return m && m[1] ? m[1] : (l.lessonCode || '').toUpperCase();
    };

    const firstCommon = common[0];
    const lastCommon = common[common.length - 1];
    const commonLabel = firstCommon && lastCommon
      ? `— Phần nội dung chung (${getCode(firstCommon)} – ${getCode(lastCommon)}) —`
      : '— Phần nội dung chung —';

    const firstA = branchA[0];
    const lastA = branchA[branchA.length - 1];
    const branchNameA = firstA?.branch || 'a';
    const branchALabel = firstA && lastA
      ? `— Nhánh ${branchNameA} (${getCode(firstA)} – ${getCode(lastA)}) —`
      : '— Nhánh a —';

    const firstB = branchB[0];
    const lastB = branchB[branchB.length - 1];
    const branchNameB = firstB?.branch || 'b';
    const branchBLabel = firstB && lastB
      ? `— Nhánh ${branchNameB} (${getCode(firstB)} – ${getCode(lastB)}) —`
      : '— Nhánh b —';

    return { hasBranches: true, common, branchA, branchB, commonLabel, branchALabel, branchBLabel };
  }, [availableLessons]);

  // Thông tin nhóm đang chọn
  const currentSelectedGroup = useMemo<CoreKnowledgeGroup | undefined>(() => {
    return availableGroups.find(g => g.groupKey === selectedGroupKey);
  }, [availableGroups, selectedGroupKey]);

  // Bài học đang được chọn trong dropdown
  const currentSelectedLesson = useMemo<CoreKnowledgeLesson | undefined>(() => {
    if (!selectedLessonId) return undefined;
    return getCoreKnowledgeLessonById(selectedLessonId);
  }, [selectedLessonId]);

  // Phiếu bài tập đã công bố gắn trực tiếp với ID bài học đang chọn / đang xem
  const worksheetsForSelectedLesson = useMemo(
    () => findMatchingPublishedWorksheetsByLesson(studyDocs, currentSelectedLesson?.id),
    [studyDocs, currentSelectedLesson?.id]
  );

  const worksheetsForActiveLesson = useMemo(
    () => findMatchingPublishedWorksheetsByLesson(studyDocs, activeLesson?.id),
    [studyDocs, activeLesson?.id]
  );

  const [worksheetDownloadError, setWorksheetDownloadError] = useState<string | null>(null);

  const handleDownloadLessonWorksheet = async (
    lesson: CoreKnowledgeLesson,
    worksheets: ReturnType<typeof findMatchingPublishedWorksheetsByLesson>
  ) => {
    if (worksheets.length === 0) return;
    setWorksheetDownloadError(null);
    if (worksheets.length === 1) {
      const res = await triggerMaterialDownload(worksheets[0]);
      if (!res.success) {
        setWorksheetDownloadError(res.error || 'Không thể tải phiếu bài tập.');
      }
      return;
    }

    openStudyMaterialsWithIntent({
      grade: String(lesson.grade) as Grade,
      subject: mapCatalogSubjectCodeToId(lesson.subjectCode),
      materialType: 'phieu_bai_tap',
      chapterKey: `${lesson.volume}_${lesson.chapterLabel}`,
      lessonId: lesson.id
    });
  };

  // ==========================================
  // QUY TẮC RESET PHỤ THUỘC KHI ĐỔI CẤP CHỌN
  // ==========================================
  // Khi đổi Khối: xóa lựa chọn Môn, Tập, Chương, Bài
  const handleGradeChange = (newGrade: number | '') => {
    setSelectedGrade(newGrade);
    setSelectedSubjectCode('');
    setSelectedVolume('');
    setSelectedGroupKey('');
    setSelectedLessonId('');
  };

  // Khi đổi Môn: cập nhật Tập sách mặc định nếu môn chỉ có 1 tập, ngược lại yêu cầu chọn Tập 1 / Tập 2
  const handleSubjectChange = (newSubjectCode: string) => {
    setSelectedSubjectCode(newSubjectCode);
    const vols =
      selectedGrade && newSubjectCode
        ? getVolumesByGradeAndSubject(Number(selectedGrade), newSubjectCode)
        : [];
    setSelectedVolume(vols.length === 1 ? vols[0] : '');
    setSelectedGroupKey('');
    setSelectedLessonId('');
  };

  // Khi đổi Tập sách: xóa lựa chọn Chương, Bài
  const handleVolumeChange = (newVolume: number | '') => {
    setSelectedVolume(newVolume);
    setSelectedGroupKey('');
    setSelectedLessonId('');
  };

  // Khi đổi Chương: xóa lựa chọn Bài
  const handleGroupChange = (newGroupKey: string) => {
    setSelectedGroupKey(newGroupKey);
    setSelectedLessonId('');
  };

  // Khi đổi Bài
  const handleLessonChange = (newLessonId: string) => {
    setSelectedLessonId(newLessonId);
  };

  // Nút "Vào học" chỉ bật khi chọn đủ các cấp VÀ status === 'ready'
  const isReadyToStart = Boolean(
    selectedGrade &&
    selectedSubjectCode &&
    selectedVolume &&
    selectedGroupKey &&
    selectedLessonId &&
    currentSelectedLesson &&
    currentSelectedLesson.status === 'ready'
  );

  // Hiển thị đường dẫn nội dung đã chọn (Breadcrumb)
  const currentBreadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (selectedGrade) parts.push(`Lớp ${selectedGrade}`);
    if (selectedSubjectCode) {
      const subj = availableSubjects.find(s => s.code === selectedSubjectCode);
      parts.push(subj ? subj.name : selectedSubjectCode);
    }
    if (hasMultipleVolumes && selectedVolume) {
      parts.push(`Tập ${selectedVolume}`);
    }
    if (currentSelectedGroup) {
      parts.push(currentSelectedGroup.chapterLabel);
    }
    if (currentSelectedLesson) {
      parts.push(currentSelectedLesson.lessonLabel);
    }
    return parts.join(' / ');
  }, [
    selectedGrade,
    selectedSubjectCode,
    selectedVolume,
    hasMultipleVolumes,
    currentSelectedGroup,
    currentSelectedLesson,
    availableSubjects
  ]);

  // Tiêu đề cấp 3 (Chương học cho Toán, Chủ đề cho Tin học)
  const groupLabelPrompt = selectedSubjectCode === 'Tin' ? 'Chủ đề' : 'Chương học';

  // Format nhãn hiển thị cho bài học trong danh sách chọn
  // Quy tắc:
  // - Các mục thuộc nhánh Tin học 9 hiển thị tiền tố [Nhánh a] / [Nhánh b]
  // - Các mục "Luyện tập chung" trùng tên thêm nhãn phụ "(Trang SGK {sourcePage})" để phân biệt
  const getLessonOptionLabel = (lesson: CoreKnowledgeLesson) => {
    const isLuyenTapChung =
      lesson.lessonTitle.includes('Luyện tập chung') ||
      lesson.lessonLabel.includes('Luyện tập chung');

    const branchPrefix = lesson.branch
      ? `[Nhánh ${lesson.branch.startsWith('a') ? 'a' : 'b'}] `
      : '';

    const pageTag = isLuyenTapChung
      ? ` (Mục ${lesson.sortOrder}${lesson.sourcePage ? ` · Trang ${lesson.sourcePage}` : ''})`
      : '';

    const baseLabel = `${branchPrefix}${lesson.lessonLabel}${pageTag}`;

    const statusBadge = lesson.status === 'ready' ? '(✓ Sẵn sàng)' : '(Đang cập nhật)';
    return `${baseLabel} ${statusBadge}`;
  };

  // Mở rộng danh sách "Bài học trong chương" khi chương có > 3 mục
  const [showAllChapterLessons, setShowAllChapterLessons] = useState<boolean>(false);

  // Thu gọn danh sách khi người dùng đổi khối, môn, tập hoặc chương
  useEffect(() => {
    setShowAllChapterLessons(false);
  }, [selectedGrade, selectedSubjectCode, selectedVolume, selectedGroupKey]);

  // Sắp xếp bài học trong chương: ưu tiên bài 'ready' trước, giữ nguyên thứ tự danh mục (sortOrder)
  const orderedChapterLessons = useMemo(() => {
    return [...availableLessons].sort((a, b) => {
      const rankA = a.status === 'ready' ? 0 : 1;
      const rankB = b.status === 'ready' ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      return a.sortOrder - b.sortOrder;
    });
  }, [availableLessons]);

  const hasAnyReadyLessonInChapter = useMemo(
    () => orderedChapterLessons.some(l => l.status === 'ready'),
    [orderedChapterLessons]
  );

  const displayedChapterLessons = useMemo(
    () =>
      showAllChapterLessons
        ? orderedChapterLessons
        : orderedChapterLessons.slice(0, 3),
    [orderedChapterLessons, showAllChapterLessons]
  );

  // Mở bài học cụ thể vào khung iframe, đồng bộ bộ chọn và lưu lịch sử gần đây
  const openLessonInViewer = (lesson: CoreKnowledgeLesson) => {
    if (!lesson || lesson.status !== 'ready') {
      return;
    }

    const vols = getVolumesByGradeAndSubject(lesson.grade, lesson.subjectCode);
    const groupKey = `${lesson.volume}_${lesson.chapterLabel}`;
    const breadcrumbParts: string[] = [
      `Lớp ${lesson.grade}`,
      lesson.subjectName
    ];
    if (vols.length > 1 && lesson.volume) {
      breadcrumbParts.push(`Tập ${lesson.volume}`);
    }
    breadcrumbParts.push(lesson.chapterLabel, lesson.lessonLabel);

    setSelectedGrade(lesson.grade);
    setSelectedSubjectCode(lesson.subjectCode);
    setSelectedVolume(lesson.volume);
    setSelectedGroupKey(groupKey);
    setSelectedLessonId(lesson.id);

    setActiveLesson(lesson);
    setIsIframeLoading(true);
    setIframeError(false);

    // Ghi nhận lịch sử xem gần đây (không chấm điểm / không tích hoàn thành)
    try {
      const recentData = {
        lessonId: lesson.id,
        lessonTitle: `${lesson.chapterLabel} • ${lesson.lessonLabel}`,
        breadcrumb: breadcrumbParts.join(' / '),
        viewedAt: new Date().toISOString()
      };
      localStorage.setItem(recentStorageKey, JSON.stringify(recentData));
      setRecentView(recentData);
    } catch {
      // ignore storage error
    }

    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!coreKnowledgeTargetLessonId) return;
    const targetLesson = getCoreKnowledgeLessonById(coreKnowledgeTargetLessonId);
    if (targetLesson && targetLesson.status === 'ready') {
      openLessonInViewer(targetLesson);
    }
    clearCoreKnowledgeTargetLesson();
  }, [coreKnowledgeTargetLessonId, clearCoreKnowledgeTargetLesson]);

  // Mở bài học đang chọn từ bộ lọc phía trên
  const handleStartLearning = () => {
    if (!currentSelectedLesson) return;
    openLessonInViewer(currentSelectedLesson);
  };

  // Quay lại bộ chọn bài (giữ nguyên tất cả lựa chọn hiện tại trong phiên)
  const handleBackToSelector = () => {
    if (isFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setActiveLesson(null);
    setIsFullscreen(false);
  };

  // Toàn màn hình toggle
  const handleToggleFullscreen = () => {
    if (!frameContainerRef.current) return;

    if (!document.fullscreenElement) {
      frameContainerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(prev => !prev));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Cài đặt cầu nối đồng bộ lịch sử bài học với Supabase (Toán 6–9, Tin học 6–9, KHTN 6–9)
  useEffect(() => {
    if (!activeLesson || !iframeRef.current) return;

    // Kích hoạt với các ID bài học trong danh mục cầu nối và đường dẫn học liệu THCS cùng origin
    const isSupportedLesson =
      SUPPORTED_BRIDGE_LESSON_IDS.has(activeLesson.id) &&
      /^\/lessons\/lop-[6-9]\//.test(activeLesson.htmlUrl);

    if (!isSupportedLesson) {
      setBridgeStatus('idle');
      return;
    }

    if (isDemoSandbox) {
      setBridgeStatus('offline_mode');
      return;
    }

    const userId = user?.id;
    const isValidUuid = Boolean(
      userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    );

    if (!isValidUuid) {
      setBridgeStatus('offline_mode');
      return;
    }

    try {
      setBridgeStatus('connected');
      const cleanup = mountLessonHistoryBridge({
        iframe: iframeRef.current,
        lessonId: activeLesson.id,
        userId: userId!,
        supabase
      });

      return () => {
        cleanup();
        setBridgeStatus('idle');
      };
    } catch (err) {
      console.warn('Cầu nối Supabase lịch sử bài học tạm bỏ qua:', err);
      setBridgeStatus('idle');
    }
  }, [activeLesson, user?.id, isDemoSandbox]);

  const formatTimeAgo = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' ' +
        d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      );
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-5 font-edtech max-w-7xl mx-auto pb-8">
      {/* ============================================================
          1. HERO BANNER 3D: KIẾN THỨC TRỌNG TÂM (Design System 2027)
          ============================================================ */}
      <div className="relative overflow-hidden rounded-2xl border border-[#C7DCFA] bg-gradient-to-r from-[#EAF3FF] via-[#F4F8FF] to-[#DFECFF] px-5 py-4 sm:px-7 sm:py-5 shadow-[0_10px_28px_-14px_rgba(16,44,84,0.14)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-h-[115px] lg:min-h-[126px]">
        <div className="pointer-events-none absolute -top-12 left-1/3 w-72 h-40 rounded-full bg-white/60 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 right-1/4 w-64 h-32 rounded-full bg-[#1769F4]/10 blur-2xl" />

        {/* Cột trái: Icon sách 3D + Tiêu đề + Mô tả */}
        <div className="relative z-10 flex items-center space-x-3.5 sm:space-x-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b from-[#2B7FFF] to-[#1769F4] text-white shadow-[0_10px_22px_-8px_rgba(23,105,244,0.5)] border border-white/60 flex items-center justify-center shrink-0">
            <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-xs" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-[30px] font-bold text-[#102C54] tracking-tight leading-tight">
              Kiến thức trọng tâm
            </h2>
            <p className="text-xs sm:text-sm text-[#4B6487] font-medium mt-1">
              Chọn bài học để tự học, khám phá kiến thức và luyện tập hiệu quả theo chuẩn GDPT 2018.
            </p>
            <div className="w-14 h-1 rounded-full bg-gradient-to-r from-[#1769F4] to-[#12A879] mt-2" />
          </div>
        </div>

        {/* Cột giữa & phải: Minh họa 3D chồng sách & bóng đèn + Thông tin bộ sách */}
        <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 sm:gap-5">
          <div className="hidden sm:flex items-center justify-center -my-2">
            <HeroKnowledgeIllustration3D />
          </div>

          <div className="inline-flex items-center space-x-3 px-4 py-2.5 bg-white/95 backdrop-blur-xs border border-[#C7DCFA] rounded-xl shadow-[0_6px_16px_-8px_rgba(16,44,84,0.16)] shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1769F4] to-[#102C54] text-white flex items-center justify-center shadow-xs shrink-0">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <span className="block text-xs sm:text-[13px] font-bold text-[#102C54]">
                Kết nối tri thức với cuộc sống
              </span>
              <span className="block text-xs sm:text-[13px] font-bold text-[#1769F4] mt-0.5 tabular-nums">
                Lớp 6, 7, 8, 9
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          2. KHUNG HỌC TẬP (IFRAME) HOẶC BỘ CHỌN BÀI HỌC
          ============================================================ */}
      {activeLesson ? (
        <div
          ref={frameContainerRef}
          className={`bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_12px_32px_-14px_rgba(16,44,84,0.16)] flex flex-col transition-all overflow-hidden ${
            isFullscreen
              ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen'
              : 'min-h-[82vh]'
          }`}
        >
          {/* Thanh tiêu đề & điều khiển trên khung học tập */}
          <div className="bg-[#102C54] text-white px-4 py-3 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#1D4073] shrink-0">
            {/* Nút quay lại & Tiêu đề bài */}
            <div className="flex items-center space-x-3 min-w-0">
              <button
                type="button"
                onClick={handleBackToSelector}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Quay lại chọn bài học khác (giữ nguyên lựa chọn)"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Quay lại chọn bài</span>
              </button>

              <div className="min-w-0">
                <div className="text-[11px] text-blue-200/90 truncate">
                  {currentBreadcrumb}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {activeLesson.chapterLabel} • {activeLesson.lessonLabel}
                </h3>
              </div>
            </div>

            {/* Các tiện ích: Mở bản 3D Tự học (cho Bài 1–5 Toán 9), Phiếu bài tập, Trạng thái đồng bộ Supabase, Toàn màn hình & Mở tab mới */}
            <div className="flex items-center space-x-2 shrink-0">
              {TOAN9_INTEGRATED_LESSON_IDS.has(activeLesson.id) && (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      url.searchParams.set('view', 'teacher_lectures');
                      url.searchParams.set('lecture', activeLesson.id);
                      url.searchParams.set('mode', 'student');
                      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
                    }
                    setCurrentView('teacher_lectures');
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-b from-[#237A50] to-[#155234] hover:brightness-105 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                  title="Mở giao diện 3D Học sinh tự học của bài này trong Bài giảng"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Bản 3D Tự học</span>
                </button>
              )}

              {worksheetsForActiveLesson.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadLessonWorksheet(activeLesson, worksheetsForActiveLesson)
                  }
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#12A879] hover:bg-[#0E8F66] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                  title="Tải phiếu bài tập đã công bố của bài học này"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải phiếu bài tập</span>
                </button>
              )}

              {SUPPORTED_BRIDGE_LESSON_IDS.has(activeLesson.id) && (
                <>
                  {bridgeStatus === 'connected' && (
                    <span className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 rounded-xl text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Đồng bộ Supabase ({user?.email?.split('@')[0] || 'Đã kết nối'})</span>
                    </span>
                  )}
                  {bridgeStatus === 'offline_mode' && (
                    <span className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500/20 text-amber-200 border border-amber-400/30 rounded-xl text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      <span>
                        {isDemoSandbox
                          ? 'Lưu cục bộ trên trình duyệt (Bản demo KHKT)'
                          : 'Lưu trên thiết bị (Đăng nhập để đồng bộ)'}
                      </span>
                    </span>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Xem toàn màn hình'}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Thu nhỏ</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Toàn màn hình</span>
                  </>
                )}
              </button>

              <a
                href={activeLesson.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#1769F4] hover:bg-[#1256CE] text-white rounded-xl text-xs font-bold transition-colors shadow-2xs whitespace-nowrap shrink-0"
                title="Mở học liệu trong tab mới độc lập"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Mở tab mới</span>
              </a>
            </div>
          </div>

          {/* Vùng iframe nhúng bài học */}
          <div className="relative flex-1 bg-[#F6F9FD] w-full min-h-[65vh] sm:min-h-[660px] flex flex-col">
            {isIframeLoading && !iframeError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/85 backdrop-blur-2xs">
                <div className="w-10 h-10 border-3 border-[#1769F4] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-[#64748B] font-bold mt-3">
                  Đang tải nội dung bài học...
                </p>
              </div>
            )}

            {iframeError ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="max-w-md bg-white p-6 rounded-2xl border border-rose-200 shadow-sm space-y-3">
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-[#102C54] text-base">
                    Không thể hiển thị học liệu trong khung nhúng
                  </h4>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    Nội dung học liệu cho bài học này chưa sẵn sàng hoặc trình duyệt đang chặn nhúng.
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <a
                      href={activeLesson.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-[#1769F4] text-white rounded-xl text-xs font-bold hover:bg-[#1256CE] whitespace-nowrap"
                    >
                      Mở trong tab mới
                    </a>
                    <button
                      type="button"
                      onClick={handleBackToSelector}
                      className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#172B4D] hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      Quay lại chọn bài
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                title={`Bài học: ${activeLesson.lessonLabel} - ${activeLesson.chapterLabel}`}
                src={activeLesson.htmlUrl}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                className="w-full flex-1 border-0 h-full min-h-[65vh] sm:min-h-[680px]"
                onLoad={(e) => {
                  setIsIframeLoading(false);
                  try {
                    const iframeEl = e.currentTarget;
                    const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
                    if (doc) {
                      // Phát hiện trường hợp máy chủ trả về nhầm trang chủ SPA thay vì nội dung bài học HTML
                      const hasSpaRoot = Boolean(doc.getElementById('root'));
                      const docTitle = doc.title || '';
                      const isSpaTitle =
                        docTitle.startsWith('TÂY ĐÔ SMART EDU') ||
                        docTitle.includes('TRẮC NGHIỆM THCS TÂY ĐÔ');
                      if (hasSpaRoot || isSpaTitle) {
                        setIframeError(true);
                      }
                    }
                  } catch {
                    // Trình duyệt chặn truy cập cross-origin (nếu có)
                  }
                }}
                onError={() => {
                  setIsIframeLoading(false);
                  setIframeError(true);
                }}
              />
            )}
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------
           B. BỘ CHỌN BÀI HỌC 5 CẤP (CASCADE SELECTORS)
           1. Khối lớp (6, 7, 8, 9)
           2. Môn học (Toán, Tin học, KHTN)
           3. Tập sách (Tập 1 / Tập 2 cho Toán; tự chọn trọn bộ cho môn 1 tập)
           4. Chương học / Chủ đề
           5. Bài học cụ thể (sắp theo sortOrder số)
           ------------------------------------------------------------ */
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-[0_8px_24px_-12px_rgba(16,44,84,0.08)] space-y-5">
            {/* Tiêu đề bộ chọn + Đường dẫn học liệu */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#2B7FFF] to-[#1769F4] text-white shadow-[0_6px_14px_rgba(23,105,244,0.28)] border border-white/50 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#102C54]">
                    Bộ chọn học liệu theo cấp bậc
                  </h3>
                  <p className="text-xs text-[#64748B] font-medium mt-0.5">
                    Chọn lần lượt: Khối lớp → Môn học → {hasMultipleVolumes ? 'Tập 1 / Tập 2 → ' : ''}{groupLabelPrompt} → Bài học để mở nội dung.
                  </p>
                </div>
              </div>

              {/* Đường dẫn nội dung đã chọn */}
              <div className="px-4 py-2 bg-[#EAF3FF] rounded-xl border border-[#C7DCFA] text-xs font-medium text-[#102C54] max-w-full lg:max-w-2xl">
                <span className="text-[#4B6487] mr-1.5 font-bold uppercase text-[11px] block sm:inline">
                  ĐƯỜNG DẪN:
                </span>
                <span className="font-bold text-[#1769F4] break-words">
                  {currentBreadcrumb || 'Chưa chọn'}
                </span>
              </div>
            </div>

            {/* Lưới 5 dropdown phụ thuộc nhau */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 text-xs">
              {/* 1. KHỐI LỚP (6, 7, 8, 9) */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="flex items-center space-x-1.5 font-extrabold text-[#102A52]">
                  <GraduationCap className="w-4 h-4 text-[#176BFF] shrink-0" />
                  <span>
                    1. Khối lớp: <span className="text-rose-500">*</span>
                  </span>
                </label>
                <select
                  value={selectedGrade}
                  onChange={e => handleGradeChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-[43px] px-3 rounded-xl border border-[#C8DCF6] bg-[#F9FCFF] hover:border-[#7EB3FF] font-bold text-[#102A52] focus:bg-white focus:outline-hidden focus:border-[#176BFF] focus:ring-3 focus:ring-[#176BFF]/15 shadow-2xs transition-all cursor-pointer"
                >
                  <option value="">-- Chọn Khối --</option>
                  {AVAILABLE_GRADES.map(g => (
                    <option key={g} value={g}>
                      Khối {g} (Lớp {g})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#5B7290] font-medium">Chuẩn GDPT: Lớp 6–9</p>
              </div>

              {/* 2. MÔN HỌC (Toán, Tin học, KHTN - Khóa nếu chưa chọn Khối) */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="flex items-center space-x-1.5 font-extrabold text-[#102A52]">
                  <BookOpen className="w-4 h-4 text-[#176BFF] shrink-0" />
                  <span>
                    2. Môn học: <span className="text-rose-500">*</span>
                  </span>
                </label>
                <select
                  value={selectedSubjectCode}
                  onChange={e => handleSubjectChange(e.target.value)}
                  disabled={!selectedGrade}
                  className="w-full h-[43px] px-3 rounded-xl border border-[#C8DCF6] bg-[#F9FCFF] hover:border-[#7EB3FF] font-bold text-[#102A52] focus:bg-white focus:outline-hidden focus:border-[#176BFF] focus:ring-3 focus:ring-[#176BFF]/15 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                >
                  <option value="">
                    {!selectedGrade ? '-- Chọn Khối trước --' : '-- Chọn Môn học --'}
                  </option>
                  {availableSubjects.map(s => (
                    <option key={s.code} value={s.code}>
                      Môn {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#5B7290] font-medium">Môn có dữ liệu thực tế</p>
              </div>

              {/* 3. TẬP SÁCH (Tập 1 / Tập 2 cho Toán; tự chọn cho môn 1 tập) */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="flex items-center space-x-1.5 font-extrabold text-[#102A52]">
                  <Layers className="w-4 h-4 text-[#176BFF] shrink-0" />
                  <span>
                    3. Tập sách: <span className="text-rose-500">*</span>
                  </span>
                </label>
                <select
                  value={selectedVolume}
                  onChange={e => handleVolumeChange(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedSubjectCode}
                  className="w-full h-[43px] px-3 rounded-xl border border-[#C8DCF6] bg-[#F9FCFF] hover:border-[#7EB3FF] font-bold text-[#102A52] focus:bg-white focus:outline-hidden focus:border-[#176BFF] focus:ring-3 focus:ring-[#176BFF]/15 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                >
                  {!selectedSubjectCode ? (
                    <option value="">-- Chọn Môn trước --</option>
                  ) : hasMultipleVolumes ? (
                    <>
                      <option value="">-- Chọn Tập sách --</option>
                      {availableVolumes.map(v => (
                        <option key={v} value={v}>
                          Tập {v}
                        </option>
                      ))}
                    </>
                  ) : (
                    availableVolumes.map(v => (
                      <option key={v} value={v}>
                        Trọn bộ (1 tập)
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-[#5B7290] font-medium">
                  {hasMultipleVolumes ? 'Toán chia Tập 1 & Tập 2' : 'Tự chọn theo bộ sách'}
                </p>
              </div>

              {/* 4. CHƯƠNG / CHỦ ĐỀ (Khóa nếu chưa chọn Môn & Tập) */}
              <div className="space-y-1.5 lg:col-span-3">
                <label className="flex items-center space-x-1.5 font-extrabold text-[#102A52]">
                  <Book className="w-4 h-4 text-[#176BFF] shrink-0" />
                  <span>
                    4. {groupLabelPrompt}: <span className="text-rose-500">*</span>
                  </span>
                </label>
                <select
                  value={selectedGroupKey}
                  onChange={e => handleGroupChange(e.target.value)}
                  disabled={!selectedSubjectCode || !selectedVolume}
                  className="w-full h-[43px] px-3.5 rounded-xl border border-[#C8DCF6] bg-[#F9FCFF] hover:border-[#7EB3FF] font-bold text-[#102A52] focus:bg-white focus:outline-hidden focus:border-[#176BFF] focus:ring-3 focus:ring-[#176BFF]/15 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                >
                  <option value="">
                    {!selectedSubjectCode
                      ? '-- Chọn Môn trước --'
                      : !selectedVolume
                        ? '-- Chọn Tập sách trước --'
                        : `-- Chọn ${groupLabelPrompt} --`}
                  </option>
                  {availableGroups.map(g => (
                    <option key={g.groupKey} value={g.groupKey}>
                      {g.chapterLabel}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#5B7290] font-medium">
                  {selectedSubjectCode === 'Tin'
                    ? 'Tin học hiển thị theo Chủ đề'
                    : 'Gồm Chương, Trải nghiệm & Ôn tập'}
                </p>
              </div>

              {/* 5. BÀI HỌC CỤ THỂ (Khóa nếu chưa chọn Chương/Chủ đề) */}
              <div className="space-y-1.5 lg:col-span-3">
                <label className="flex items-center space-x-1.5 font-extrabold text-[#102A52]">
                  <FileText className="w-4 h-4 text-[#176BFF] shrink-0" />
                  <span>
                    5. Bài học cụ thể: <span className="text-rose-500">*</span>
                  </span>
                </label>
                <select
                  value={selectedLessonId}
                  onChange={e => handleLessonChange(e.target.value)}
                  disabled={!selectedGroupKey}
                  className="w-full h-[43px] px-3.5 rounded-xl border border-[#C8DCF6] bg-[#F9FCFF] hover:border-[#7EB3FF] font-bold text-[#102A52] focus:bg-white focus:outline-hidden focus:border-[#176BFF] focus:ring-3 focus:ring-[#176BFF]/15 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
                >
                  <option value="">
                    {!selectedGroupKey
                      ? `-- Chọn ${groupLabelPrompt} trước --`
                      : '-- Chọn Bài học --'}
                  </option>
                  {lessonBranchGroups.hasBranches ? (
                    <>
                      {lessonBranchGroups.common.length > 0 && (
                        <optgroup label={lessonBranchGroups.commonLabel}>
                          {lessonBranchGroups.common.map(l => (
                            <option key={l.id} value={l.id}>
                              {getLessonOptionLabel(l)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {lessonBranchGroups.branchA.length > 0 && (
                        <optgroup label={lessonBranchGroups.branchALabel}>
                          {lessonBranchGroups.branchA.map(l => (
                            <option key={l.id} value={l.id}>
                              {getLessonOptionLabel(l)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {lessonBranchGroups.branchB.length > 0 && (
                        <optgroup label={lessonBranchGroups.branchBLabel}>
                          {lessonBranchGroups.branchB.map(l => (
                            <option key={l.id} value={l.id}>
                              {getLessonOptionLabel(l)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    availableLessons.map(l => (
                      <option key={l.id} value={l.id}>
                        {getLessonOptionLabel(l)}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-[#5B7290] font-medium">Gồm Bài học, Luyện tập chung, Ôn tập</p>
              </div>
            </div>

            {/* ============================================================
                THẺ THÔNG TIN BÀI HỌC ĐÃ CHỌN (3D SUBJECT BANNER CARD)
                ============================================================ */}
            {currentSelectedLesson ? (
              <div className="relative overflow-hidden rounded-2xl border border-[#C7DCFA] bg-gradient-to-r from-[#EAF3FF] via-[#F4F8FF] to-[#E6F0FF] p-4 sm:p-5 shadow-[0_8px_22px_-12px_rgba(23,105,244,0.18)]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Cột trái + Cột giữa: Minh họa sách 3D & Thông tin bài học */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 flex-1">
                    <div className="flex items-center justify-center sm:justify-start shrink-0">
                      <SubjectBookIllustration3D
                        subjectCode={selectedSubjectCode}
                        grade={selectedGrade}
                      />
                    </div>

                    <div className="hidden sm:block w-px self-stretch my-2 bg-[#C7DCFA] shrink-0" />

                    {/* Cột 2: Thông tin chi tiết bài học */}
                    <div className="space-y-2.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase text-[#4B6487] tracking-wide">
                          THÔNG TIN BÀI HỌC:
                        </span>
                        {currentSelectedLesson.volume && selectedSubjectCode === 'Toan' && (
                          <span className="px-2.5 py-0.5 bg-[#D6E8FF] text-[#102C54] rounded-md text-xs font-bold border border-[#B2D2FA]">
                            Tập {currentSelectedLesson.volume}
                          </span>
                        )}
                        {currentSelectedLesson.branch && (
                          <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[11px] font-bold border border-purple-200">
                            Nhánh {currentSelectedLesson.branch.startsWith('a') ? 'a' : 'b'}: {currentSelectedLesson.branch}
                          </span>
                        )}
                        {currentSelectedLesson.groupType === 'intro' && (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[11px] font-bold border border-emerald-200">
                            Phần Mở đầu
                          </span>
                        )}
                        {currentSelectedLesson.itemType === 'practice' && (
                          <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 rounded-md text-[11px] font-bold border border-sky-200">
                            Luyện tập chung · Mục {currentSelectedLesson.sortOrder}
                          </span>
                        )}
                        {currentSelectedLesson.itemType === 'chapter_review' && (
                          <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[11px] font-bold border border-indigo-200">
                            Bài tập cuối chương
                          </span>
                        )}
                        {currentSelectedLesson.itemType === 'activity' && (
                          <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 rounded-md text-[11px] font-bold border border-teal-200">
                            Hoạt động thực hành trải nghiệm
                          </span>
                        )}
                        {currentSelectedLesson.itemType === 'year_review' && (
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[11px] font-bold border border-amber-200">
                            Ôn tập cuối năm
                          </span>
                        )}
                        <span className="text-xs font-bold text-[#4B6487] tabular-nums">
                          Trang SGK {currentSelectedLesson.sourcePage}
                        </span>
                      </div>

                      <h4 className="text-lg sm:text-[21px] font-bold text-[#102C54] leading-snug tracking-tight">
                        {currentSelectedLesson.chapterLabel} - {currentSelectedLesson.lessonLabel}
                      </h4>

                      {/* Thanh thông báo trạng thái sẵn sàng hoặc đang cập nhật */}
                      {currentSelectedLesson.status === 'ready' ? (
                        <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white/95 border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-2xs">
                          <CheckCircle2 className="w-4 h-4 text-[#12A879] shrink-0" />
                          <span>
                            Bài học đã sẵn sàng. Nhấn “Bắt đầu học” để mở bài học trong khung xem độc lập.
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50/95 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start space-x-2.5">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-900">Bài học đang được cập nhật:</span>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                              Tệp học liệu HTML cho bài học này đang được chuẩn bị và kiểm duyệt theo chương trình GDPT 2018. Hệ thống không mở một bài khác thay thế để đảm bảo đúng tiến trình bài giảng của học sinh.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột 3: Huy hiệu trạng thái + Tải phiếu bài tập + Nút "Bắt đầu học" */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2.5 sm:gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#C7DCFA]/80">
                    {currentSelectedLesson.status === 'ready' ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4 text-[#12A879]" />
                        <span>Học liệu sẵn sàng</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold whitespace-nowrap">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Bài học đang được cập nhật</span>
                      </span>
                    )}

                    {worksheetsForSelectedLesson.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadLessonWorksheet(
                            currentSelectedLesson,
                            worksheetsForSelectedLesson
                          )
                        }
                        className="px-4 py-2.5 bg-[#12A879] hover:bg-[#0E8F66] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải phiếu bài tập</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleStartLearning}
                      disabled={!isReadyToStart}
                      className="px-5 py-2.5 bg-[#1769F4] hover:bg-[#1256CE] text-white rounded-xl text-sm font-bold transition-all shadow-[0_8px_20px_-6px_rgba(23,105,244,0.45)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Bắt đầu học</span>
                    </button>
                  </div>
                </div>

                {worksheetDownloadError && (
                  <p className="text-xs font-semibold text-rose-600 mt-2">{worksheetDownloadError}</p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-[#E2E8F0] bg-[#F6F9FD] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[#64748B]">
                  * Hãy chọn đủ Khối lớp, Môn học, {hasMultipleVolumes ? 'Tập sách, ' : ''}{groupLabelPrompt} và Bài học để kích hoạt nút bắt đầu học.
                </span>
                <button
                  type="button"
                  disabled
                  className="px-5 py-2.5 bg-slate-300 text-white rounded-xl text-xs font-bold opacity-60 cursor-not-allowed flex items-center justify-center space-x-2 shrink-0 whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Bắt đầu học</span>
                </button>
              </div>
            )}

            {/* ============================================================
                THẺ BÀI HỌC VỪA MỞ GẦN ĐÂY (CONTINUE LEARNING STRIP)
                ============================================================ */}
            {recentView && (
              <div className="px-4 py-3.5 sm:px-5 sm:py-3.5 bg-[#F6F9FD] rounded-2xl border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <RecentLaptopIllustration3D />
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-[#64748B] font-semibold block text-[11px] tabular-nums">
                      Bài học vừa mở gần đây ({formatTimeAgo(recentView.viewedAt)}):
                    </span>
                    <span className="font-bold text-[#102C54] text-sm sm:text-[15px] block truncate">
                      {recentView.lessonTitle}
                    </span>
                    <span className="text-[#64748B] text-xs font-medium block truncate">
                      {recentView.breadcrumb}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const lesson = getCoreKnowledgeLessonById(recentView.lessonId);
                    if (lesson && lesson.status === 'ready') {
                      openLessonInViewer(lesson);
                    }
                  }}
                  className="px-4 py-2 border border-[#C7DCFA] hover:border-[#1769F4] text-[#1769F4] bg-white hover:bg-[#EAF3FF] rounded-xl font-bold text-xs shadow-2xs inline-flex items-center justify-center space-x-1.5 transition-all cursor-pointer shrink-0 self-start sm:self-auto whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Mở lại bài này</span>
                </button>
              </div>
            )}
          </div>

          {/* ============================================================
              KHU VỰC "BÀI HỌC TRONG CHƯƠNG" (3D LESSON LIBRARY GRID)
              ============================================================ */}
          <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-[0_8px_24px_-12px_rgba(16,44,84,0.08)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#2B7FFF] to-[#1769F4] text-white shadow-[0_6px_14px_rgba(23,105,244,0.28)] border border-white/50 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-lg sm:text-xl font-bold text-[#102C54] tracking-tight">
                    Bài học trong chương
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-[#1769F4]">
                    {currentSelectedGroup
                      ? currentSelectedGroup.chapterLabel
                      : `Chưa chọn ${groupLabelPrompt.toLowerCase()}`}
                  </p>
                </div>
              </div>

              {currentSelectedGroup && orderedChapterLessons.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllChapterLessons(prev => !prev)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-[#C7DCFA] bg-[#EAF3FF] hover:bg-[#DCEBFF] text-[#1769F4] text-xs font-bold transition-all cursor-pointer self-start sm:self-auto shrink-0 whitespace-nowrap"
                >
                  {showAllChapterLessons ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span>Thu gọn</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span className="tabular-nums">Xem tất cả ({orderedChapterLessons.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {!currentSelectedGroup ? (
              <p className="text-xs sm:text-sm text-slate-600 font-semibold">
                Hãy chọn Khối lớp, Môn học{hasMultipleVolumes ? ', Tập sách' : ''} và {groupLabelPrompt} ở phía trên để xem danh sách bài học.
              </p>
            ) : (
              <div className="space-y-4">
                {!hasAnyReadyLessonInChapter && (
                  <p className="text-xs sm:text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                    Chương này đang bổ sung học liệu
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {displayedChapterLessons.map((lesson, idx) => {
                    const isReady = lesson.status === 'ready';
                    const isCurrentlySelected = lesson.id === selectedLessonId;

                    // Nền thẻ xoay vòng 3 tông chuẩn thiết kế 3D: Xanh da trời, Xanh ngọc bạc hà, Kem vàng ấm
                    const cardToneClass =
                      idx % 3 === 0
                        ? 'bg-gradient-to-b from-[#EDF6FF] to-[#DFEEFF] border-[#C4DFFF]'
                        : idx % 3 === 1
                          ? 'bg-gradient-to-b from-[#EEFCF5] to-[#DEF7EA] border-[#BCEAD5]'
                          : 'bg-gradient-to-b from-[#FFFBEB] to-[#FEF2CC] border-[#FCD98B]';

                    const iconToneClass =
                      idx % 3 === 0
                        ? 'bg-white text-[#1463F3] border-[#B9D7FF]'
                        : idx % 3 === 1
                          ? 'bg-white text-[#0D9456] border-[#A7E6C9]'
                          : 'bg-white text-[#D97706] border-[#F9D07A]';

                    const renderLessonTypeIcon = () => {
                      switch (lesson.itemType) {
                        case 'practice':
                          return <ClipboardList className="w-5 h-5" />;
                        case 'chapter_review':
                          return <Award className="w-5 h-5" />;
                        case 'activity':
                          return <Compass className="w-5 h-5" />;
                        case 'year_review':
                          return <GraduationCap className="w-5 h-5" />;
                        default:
                          return <BookOpen className="w-5 h-5" />;
                      }
                    };

                    const getItemTypeLabel = () => {
                      switch (lesson.itemType) {
                        case 'practice':
                          return 'LUYỆN TẬP CHUNG';
                        case 'chapter_review':
                          return 'BÀI TẬP CUỐI CHƯƠNG';
                        case 'activity':
                          return 'THỰC HÀNH TRẢI NGHIỆM';
                        case 'year_review':
                          return 'ÔN TẬP CUỐI NĂM';
                        default:
                          return 'BÀI HỌC';
                      }
                    };

                    return (
                      <div
                        key={lesson.id}
                        onClick={() => {
                          setSelectedLessonId(lesson.id);
                          if (isReady) {
                            openLessonInViewer(lesson);
                          }
                        }}
                        role={isReady ? 'button' : undefined}
                        tabIndex={isReady ? 0 : undefined}
                        onKeyDown={e => {
                          if (isReady && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            setSelectedLessonId(lesson.id);
                            openLessonInViewer(lesson);
                          }
                        }}
                        className={`group rounded-2xl border p-4 sm:p-5 shadow-[0_6px_18px_rgba(16,42,82,0.06)] flex flex-col justify-between transition-all duration-200 ${cardToneClass} ${
                          isReady
                            ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(16,42,82,0.12)]'
                            : 'opacity-90'
                        } ${isCurrentlySelected ? 'ring-2 ring-[#176BFF]/60' : ''}`}
                      >
                        {/* Hàng trên: Icon loại bài + Tiêu đề + Huy hiệu trạng thái */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start space-x-3 min-w-0">
                            <div
                              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${iconToneClass}`}
                            >
                              {renderLessonTypeIcon()}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="text-[11px] font-extrabold text-[#3A5273] uppercase tracking-wider">
                                {getItemTypeLabel()}
                              </div>
                              <h4 className="text-base sm:text-[17px] font-extrabold text-[#102A52] leading-snug line-clamp-2 group-hover:text-[#1463F3] transition-colors">
                                {lesson.lessonLabel}
                              </h4>
                            </div>
                          </div>

                          {isReady ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC] text-[11px] font-extrabold shrink-0 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A36A]" />
                              <span>Sẵn sàng</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-extrabold shrink-0">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              <span>Đang cập nhật</span>
                            </span>
                          )}
                        </div>

                        {/* Khu vực minh họa 3D trung tâm theo đúng nội dung bài học */}
                        <div className="mt-2 -mx-1">
                          <LessonCardIllustration3D lesson={lesson} />
                        </div>

                        {/* Chân thẻ: Trang SGK & Nút mở nhanh */}
                        <div className="pt-2.5 mt-1 border-t border-[#102A52]/8 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[#3A5273]">
                            {lesson.sourcePage
                              ? `Trang SGK ${lesson.sourcePage} · Học liệu tương tác`
                              : isReady
                                ? 'Học liệu HTML trực tuyến'
                                : 'Đang bổ sung học liệu'}
                          </span>

                          {isReady && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedLessonId(lesson.id);
                                openLessonInViewer(lesson);
                              }}
                              className="inline-flex items-center space-x-1 px-3.5 py-1.5 bg-[#1769F4] hover:bg-[#1256CE] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap"
                            >
                              <Play className="w-3 h-3 fill-white" />
                              <span>Vào học</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
