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
  Play
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

const RECENT_VIEW_KEY = 'taydo_last_viewed_core_lesson';

export const CoreKnowledgeView: React.FC = () => {
  const { user } = useApp();

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
      const saved = localStorage.getItem(RECENT_VIEW_KEY);
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

  // Mở bài học vào khung iframe
  const handleStartLearning = () => {
    if (!currentSelectedLesson) return;

    // Không mở bài khác thay thế khi chưa có học liệu
    if (currentSelectedLesson.status !== 'ready') {
      return;
    }

    setActiveLesson(currentSelectedLesson);
    setIsIframeLoading(true);
    setIframeError(false);

    // Ghi nhận lịch sử xem gần đây (không chấm điểm / không tích hoàn thành)
    try {
      const recentData = {
        lessonId: currentSelectedLesson.id,
        lessonTitle: `${currentSelectedLesson.chapterLabel} • ${currentSelectedLesson.lessonLabel}`,
        breadcrumb: currentBreadcrumb,
        viewedAt: new Date().toISOString()
      };
      localStorage.setItem(RECENT_VIEW_KEY, JSON.stringify(recentData));
      setRecentView(recentData);
    } catch {
      // ignore storage error
    }
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
  }, [activeLesson, user?.id]);

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
    <div className="space-y-6 font-serif max-w-7xl mx-auto">
      {/* ============================================================
          1. HEADER TRANG: KIẾN THỨC TRỌNG TÂM
          ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE8F7] pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-blue-100 text-[#006BFF] rounded-xl shadow-2xs">
              <Book className="w-6 h-6 text-[#006BFF]" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-[#082B52]">
                Kiến thức trọng tâm
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn bài học để tự học, khám phá kiến thức và luyện tập.
              </p>
            </div>
          </div>
        </div>

        {/* Thông tin chuẩn hoá SGK */}
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#006BFF]" />
            <span>Kết nối tri thức với cuộc sống • Lớp 6, 7, 8, 9</span>
          </span>
        </div>
      </div>

      {/* ============================================================
          2. KHUNG HỌC TẬP (IFRAME) HOẶC BỘ CHỌN BÀI HỌC
          ============================================================ */}
      {activeLesson ? (
        /* ------------------------------------------------------------
           A. KHUNG HỌC TẬP (IFRAME VIEWER)
           - Giữ CSS, JS, KaTeX, hình ảnh và tương tác độc lập của bài
           - Có quay lại, mở tab mới, toàn màn hình
           ------------------------------------------------------------ */
        <div
          ref={frameContainerRef}
          className={`bg-white rounded-2xl border border-[#DCE8F7] shadow-md flex flex-col transition-all overflow-hidden ${
            isFullscreen
              ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen'
              : 'min-h-[82vh]'
          }`}
        >
          {/* Thanh tiêu đề & điều khiển trên khung học tập */}
          <div className="bg-[#082B52] text-white px-4 py-3 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#0f3d73] shrink-0">
            {/* Nút quay lại & Tiêu đề bài */}
            <div className="flex items-center space-x-3 min-w-0">
              <button
                type="button"
                onClick={handleBackToSelector}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                title="Quay lại chọn bài học khác (giữ nguyên lựa chọn)"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Quay lại chọn bài</span>
              </button>

              <div className="min-w-0">
                <div className="text-[11px] text-blue-200 font-sans truncate">
                  {currentBreadcrumb}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  {activeLesson.chapterLabel} • {activeLesson.lessonLabel}
                </h3>
              </div>
            </div>

            {/* Các tiện ích: Trạng thái đồng bộ Supabase, Toàn màn hình & Mở tab mới */}
            <div className="flex items-center space-x-2 shrink-0">
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
                      <span>Lưu trên thiết bị (Đăng nhập để đồng bộ)</span>
                    </span>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
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
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                title="Mở học liệu trong tab mới độc lập"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Mở tab mới</span>
              </a>
            </div>
          </div>

          {/* Vùng iframe nhúng bài học */}
          <div className="relative flex-1 bg-slate-50 w-full min-h-[65vh] sm:min-h-[660px] flex flex-col">
            {isIframeLoading && !iframeError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xs">
                <div className="w-10 h-10 border-3 border-[#006BFF] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-600 font-bold mt-3">
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
                  <h4 className="font-bold text-[#082B52] text-base">
                    Không thể hiển thị học liệu trong khung nhúng
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tệp bài học tại <code>{activeLesson.htmlUrl}</code> chưa sẵn sàng hoặc trình duyệt chặn nhúng.
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    <a
                      href={activeLesson.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600"
                    >
                      Mở trong tab mới
                    </a>
                    <button
                      type="button"
                      onClick={handleBackToSelector}
                      className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-[#082B52] flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-[#006BFF]" />
                  <span>Bộ chọn học liệu theo cấp bậc</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chọn lần lượt: Khối lớp → Môn học → {hasMultipleVolumes ? 'Tập 1 / Tập 2 → ' : ''}{groupLabelPrompt} → Bài học để mở nội dung.
                </p>
              </div>

              {/* Đường dẫn nội dung đã chọn */}
              <div className="px-3.5 py-2 bg-[#F3F8FF] rounded-xl border border-[#DCE8F7] text-xs font-medium text-[#082B52] max-w-xl">
                <span className="text-slate-400 mr-1.5 font-bold uppercase text-[10px] block sm:inline">
                  Đường dẫn:
                </span>
                <span className="font-bold text-[#006BFF] break-words">
                  {currentBreadcrumb || 'Chưa chọn'}
                </span>
              </div>
            </div>

            {/* Lưới 5 dropdown phụ thuộc nhau */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 text-xs">
              {/* 1. KHỐI LỚP (6, 7, 8, 9) */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="block font-bold text-slate-700">
                  1. Khối lớp: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedGrade}
                  onChange={e => handleGradeChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                >
                  <option value="">-- Chọn Khối --</option>
                  {AVAILABLE_GRADES.map(g => (
                    <option key={g} value={g}>
                      Khối {g} (Lớp {g})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Chuẩn GDPT: Lớp 6–9</p>
              </div>

              {/* 2. MÔN HỌC (Toán, Tin học, KHTN - Khóa nếu chưa chọn Khối) */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="block font-bold text-slate-700">
                  2. Môn học: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSubjectCode}
                  onChange={e => handleSubjectChange(e.target.value)}
                  disabled={!selectedGrade}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
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
                <p className="text-[11px] text-slate-400">Môn có dữ liệu thực tế</p>
              </div>

              {/* 3. TẬP SÁCH (Tập 1 / Tập 2 cho Toán; tự chọn cho môn 1 tập) */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="block font-bold text-slate-700">
                  3. Tập sách: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedVolume}
                  onChange={e => handleVolumeChange(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedSubjectCode}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
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
                <p className="text-[11px] text-slate-400">
                  {hasMultipleVolumes ? 'Toán chia Tập 1 & Tập 2' : 'Tự chọn theo bộ sách'}
                </p>
              </div>

              {/* 4. CHƯƠNG / CHỦ ĐỀ (Khóa nếu chưa chọn Môn & Tập) */}
              <div className="space-y-1.5 lg:col-span-3">
                <label className="block font-bold text-slate-700">
                  4. {groupLabelPrompt}: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedGroupKey}
                  onChange={e => handleGroupChange(e.target.value)}
                  disabled={!selectedSubjectCode || !selectedVolume}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
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
                <p className="text-[11px] text-slate-400">
                  {selectedSubjectCode === 'Tin'
                    ? 'Tin học hiển thị theo Chủ đề'
                    : 'Gồm Chương, Trải nghiệm & Ôn tập'}
                </p>
              </div>

              {/* 5. BÀI HỌC CỤ THỂ (Khóa nếu chưa chọn Chương/Chủ đề) */}
              <div className="space-y-1.5 lg:col-span-3">
                <label className="block font-bold text-slate-700">
                  5. Bài học cụ thể: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedLessonId}
                  onChange={e => handleLessonChange(e.target.value)}
                  disabled={!selectedGroupKey}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
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
                <p className="text-[11px] text-slate-400">Gồm Bài học, Luyện tập chung, Ôn tập</p>
              </div>
            </div>

            {/* Chi tiết bài học đã chọn & Trạng thái học liệu */}
            {currentSelectedLesson && (
              <div className="p-4 rounded-xl border border-[#DCE8F7] bg-[#FBFDFF] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        Thông tin bài học:
                      </span>
                      {currentSelectedLesson.volume && selectedSubjectCode === 'Toan' && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                          Tập {currentSelectedLesson.volume}
                        </span>
                      )}
                      {currentSelectedLesson.branch && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-[10px] font-bold border border-purple-200">
                          Nhánh {currentSelectedLesson.branch.startsWith('a') ? 'a' : 'b'}: {currentSelectedLesson.branch}
                        </span>
                      )}
                      {currentSelectedLesson.groupType === 'intro' && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold border border-emerald-200">
                          Phần Mở đầu
                        </span>
                      )}
                      {currentSelectedLesson.itemType === 'practice' && (
                        <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md text-[10px] font-bold border border-sky-200">
                          Luyện tập chung · Mục {currentSelectedLesson.sortOrder}
                        </span>
                      )}
                      {currentSelectedLesson.itemType === 'chapter_review' && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-200">
                          Bài tập cuối chương
                        </span>
                      )}
                      {currentSelectedLesson.itemType === 'activity' && (
                        <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-[10px] font-bold border border-teal-200">
                          Hoạt động thực hành trải nghiệm
                        </span>
                      )}
                      {currentSelectedLesson.itemType === 'year_review' && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md text-[10px] font-bold border border-amber-200">
                          Ôn tập cuối năm
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">
                        Trang SGK {currentSelectedLesson.sourcePage}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-[#082B52]">
                      {currentSelectedLesson.chapterLabel} • {currentSelectedLesson.lessonLabel}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Tệp bài học: <code>{currentSelectedLesson.htmlUrl}</code>
                    </p>
                  </div>

                  {/* Huy hiệu trạng thái */}
                  <div>
                    {currentSelectedLesson.status === 'ready' ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Học liệu sẵn sàng</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Bài học đang được cập nhật</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Thông báo quy định khi bài chưa có file */}
                {currentSelectedLesson.status !== 'ready' && (
                  <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start space-x-2.5">
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
            )}

            {/* Nút hành động "Vào học" */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {!selectedGrade || !selectedSubjectCode || !selectedVolume || !selectedGroupKey || !selectedLessonId ? (
                  <span>* Hãy chọn đủ Khối lớp, Môn học, {hasMultipleVolumes ? 'Tập sách, ' : ''}{groupLabelPrompt} và Bài học để kích hoạt nút vào học.</span>
                ) : currentSelectedLesson?.status === 'ready' ? (
                  <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Bài học đã sẵn sàng. Nhấn “Vào học” để mở bài học trong khung xem độc lập.</span>
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Bài học đang được cập nhật, nút “Vào học” sẽ tự động bật khi có tệp học liệu tương ứng.</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleStartLearning}
                disabled={!isReadyToStart}
                className="px-6 py-2.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Vào học</span>
              </button>
            </div>
          </div>

          {/* Card: Lịch sử bài học vừa truy cập gần đây */}
          {recentView && (
            <div className="p-4 bg-white rounded-2xl border border-[#DCE8F7] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">
                    Bài học vừa mở gần đây ({formatTimeAgo(recentView.viewedAt)}):
                  </span>
                  <span className="font-bold text-[#082B52]">
                    {recentView.lessonTitle}
                  </span>
                  <span className="text-slate-500 text-[11px] block">
                    {recentView.breadcrumb}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const lesson = getCoreKnowledgeLessonById(recentView.lessonId);
                  if (lesson && lesson.status === 'ready') {
                    setSelectedGrade(lesson.grade);
                    setSelectedSubjectCode(lesson.subjectCode);
                    setSelectedVolume(lesson.volume);
                    setSelectedGroupKey(`${lesson.volume}_${lesson.chapterLabel}`);
                    setSelectedLessonId(lesson.id);
                    setActiveLesson(lesson);
                    setIsIframeLoading(true);
                    setIframeError(false);
                  }
                }}
                className="px-3.5 py-1.5 border border-[#DCE8F7] hover:border-blue-400 text-[#006BFF] bg-blue-50/50 hover:bg-blue-50 rounded-xl font-bold transition-colors cursor-pointer shrink-0"
              >
                Mở lại bài này
              </button>
            </div>
          )}

          {/* Thông tin quy định danh mục & tích hợp học liệu */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
              <h5 className="font-bold text-[#082B52] flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-[#006BFF]" />
                <span>Quy tắc vận hành & Tích hợp Lịch sử Supabase (Toán 6–9, Tin học 6–9, KHTN 6–9):</span>
              </h5>
              <div className="flex items-center space-x-2">
                <a
                  href="/tich-hop/01_lich_su_supabase.sql"
                  download="01_lich_su_supabase.sql"
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-white hover:bg-blue-50 text-[#006BFF] border border-[#DCE8F7] hover:border-blue-400 rounded-lg text-[11px] font-bold shadow-2xs transition-colors"
                  title="Tải tệp SQL migration để chạy trong Supabase SQL Editor"
                >
                  <span>⬇ Tải 01_lich_su_supabase.sql</span>
                </a>
              </div>
            </div>

            <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-600 pl-1 leading-relaxed">
              <li>
                <strong>Nguồn danh mục chuẩn:</strong> Toàn bộ 553 mục thuộc sách giáo khoa Kết nối tri thức với cuộc sống (Toán 6, 7, 8, 9 Tập 1 &amp; Tập 2; Tin học 6, 7, 8, 9; Khoa học tự nhiên 6, 7, 8, 9).
              </li>
              <li>
                <strong>Cầu nối lịch sử học tập:</strong> Tự động kích hoạt khi học sinh đăng nhập bằng tài khoản Supabase Auth. Dữ liệu tiến độ, câu trả lời, gợi ý và điểm số được lưu vào bảng <code>edu_lesson_attempts</code> thông qua RPC <code>edu_save_lesson_attempt</code>. Nếu chưa đăng nhập, bài học hoạt động độc lập và lưu cục bộ trên trình duyệt.
              </li>
              <li>
                <strong>Cấu trúc học liệu:</strong> <code>public/lessons/lop-&#123;khối&#125;/&#123;môn&#125;/&#123;chương-hoặc-chủ-đề&#125;/&#123;bài&#125;/index.html</code> (mỗi bài có thư mục độc lập chứa index.html và tài nguyên).
              </li>
              <li>
                <strong>Đường dẫn truy cập web:</strong> <code>/lessons/lop-8/toan/chuong-04/bai-15/index.html</code> (tuyệt đối không chứa tiền tố <code>/public</code>).
              </li>
              <li>
                <strong>Học liệu sẵn sàng trực tiếp:</strong> Hệ thống tự động đối chiếu các tệp HTML có sẵn trong <code>public/lessons/</code> qua <code>availableLessonPaths.json</code> (Toán 8 hiện sẵn sàng 58/75 mục; 17 mục chưa tải lên giữ trạng thái “Đang cập nhật”). Khi chép các tệp còn lại vào đúng thư mục và build lại, nút “Vào học” sẽ tự động kích hoạt.
              </li>
              <li>
                <strong>Bảo toàn nguyên bản:</strong> Giữ nguyên 100% mã nguồn HTML, KaTeX toán học, CSS, tương tác JavaScript thông qua iframe độc lập cùng origin.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
