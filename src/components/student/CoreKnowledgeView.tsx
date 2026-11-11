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
  CORE_KNOWLEDGE_LESSONS,
  AVAILABLE_GRADES,
  getSubjectsByGrade,
  getGroupsByGradeAndSubject,
  getLessonsByGroup,
  getCoreKnowledgeLessonById
} from '../../data/coreKnowledgeLessons';

const RECENT_VIEW_KEY = 'taydo_last_viewed_core_lesson';

export const CoreKnowledgeView: React.FC = () => {
  // 1. Bộ chọn 4 cấp phụ thuộc: Khối lớp -> Môn học -> Chương/Chủ đề -> Bài học
  // Mặc định ban đầu: Khối 6, Môn Toán, Chương I, Bài 1 (để người dùng trải nghiệm ngay bài học mẫu Toan_6_c1_b1.html đã sẵn sàng)
  const [selectedGrade, setSelectedGrade] = useState<number | ''>(6);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('Toan');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('1_Chương I. Tập hợp các số tự nhiên');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('toan_6_c1_b1');

  // Trạng thái khung học tập iframe
  const [activeLesson, setActiveLesson] = useState<CoreKnowledgeLesson | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);
  const [iframeError, setIframeError] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const frameContainerRef = useRef<HTMLDivElement>(null);

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

  // 2. Danh sách Môn học phụ thuộc vào Khối lớp (chỉ có Toán & Tin học)
  const availableSubjects = useMemo(() => {
    if (!selectedGrade) return [];
    return getSubjectsByGrade(Number(selectedGrade));
  }, [selectedGrade]);

  // 3. Danh sách Chương / Chủ đề phụ thuộc vào Khối & Môn (giữ nguyên thứ tự JSON, volume 1 -> volume 2)
  const availableGroups = useMemo(() => {
    if (!selectedGrade || !selectedSubjectCode) return [];
    return getGroupsByGradeAndSubject(Number(selectedGrade), selectedSubjectCode);
  }, [selectedGrade, selectedSubjectCode]);

  // 4. Danh sách Bài học phụ thuộc vào Khối, Môn & Nhóm (sắp xếp theo sortOrder số học)
  const availableLessons = useMemo(() => {
    if (!selectedGrade || !selectedSubjectCode || !selectedGroupKey) return [];
    return getLessonsByGroup(Number(selectedGrade), selectedSubjectCode, selectedGroupKey);
  }, [selectedGrade, selectedSubjectCode, selectedGroupKey]);

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
  // Khi đổi Khối: xóa lựa chọn Môn, Chương, Bài
  const handleGradeChange = (newGrade: number | '') => {
    setSelectedGrade(newGrade);
    setSelectedSubjectCode('');
    setSelectedGroupKey('');
    setSelectedLessonId('');
  };

  // Khi đổi Môn: xóa lựa chọn Chương, Bài
  const handleSubjectChange = (newSubjectCode: string) => {
    setSelectedSubjectCode(newSubjectCode);
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

  // Nút "Vào học" chỉ bật khi chọn đủ cả 4 cấp VÀ status === 'ready'
  const isReadyToStart = Boolean(
    selectedGrade &&
    selectedSubjectCode &&
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
    if (currentSelectedGroup) {
      // Nếu là môn Toán thì thêm nhãn volume phụ nếu có
      const volumeTag =
        selectedSubjectCode === 'Toan' && currentSelectedGroup.volume
          ? `[Tập ${currentSelectedGroup.volume}] `
          : '';
      parts.push(`${volumeTag}${currentSelectedGroup.chapterLabel}`);
    }
    if (currentSelectedLesson) {
      parts.push(currentSelectedLesson.lessonLabel);
    }
    return parts.join(' / ');
  }, [
    selectedGrade,
    selectedSubjectCode,
    currentSelectedGroup,
    currentSelectedLesson,
    availableSubjects
  ]);

  // Tiêu đề cấp 3 (Chương học cho Toán, Chủ đề cho Tin học)
  const groupLabelPrompt = selectedSubjectCode === 'Tin' ? 'Chủ đề' : 'Chương học';

  // Format nhãn hiển thị cho bài học trong danh sách chọn
  // Quy tắc: Các mục "Luyện tập chung" trùng tên thêm nhãn phụ "(Trang SGK {sourcePage})" để phân biệt
  const getLessonOptionLabel = (lesson: CoreKnowledgeLesson) => {
    const isLuyenTapChung =
      lesson.lessonTitle.includes('Luyện tập chung') ||
      lesson.lessonLabel.includes('Luyện tập chung');

    const baseLabel = isLuyenTapChung
      ? `${lesson.lessonLabel} (Trang SGK ${lesson.sourcePage})`
      : lesson.lessonLabel;

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
            <span>Kết nối tri thức với cuộc sống • Lớp 6 & 7</span>
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

            {/* Các tiện ích: Toàn màn hình & Mở tab mới */}
            <div className="flex items-center space-x-2 shrink-0">
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
          <div className="relative flex-1 bg-slate-50 w-full min-h-[660px] flex flex-col">
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
                title={`Bài học: ${activeLesson.lessonLabel} - ${activeLesson.chapterLabel}`}
                src={activeLesson.htmlUrl}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                className="w-full flex-1 border-0 h-full min-h-[680px]"
                onLoad={(e) => {
                  setIsIframeLoading(false);
                  try {
                    const iframeEl = e.currentTarget;
                    const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
                    if (doc) {
                      // Phát hiện trường hợp máy chủ trả về nhầm trang chủ SPA thay vì nội dung bài học HTML
                      const hasSpaRoot = Boolean(doc.getElementById('root'));
                      const docTitle = doc.title || '';
                      if (hasSpaRoot || (docTitle.includes('TRẮC NGHIỆM THCS TÂY ĐÔ') && !docTitle.includes('Chương'))) {
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
           B. BỘ CHỌN BÀI HỌC 4 CẤP (CASCADE SELECTORS)
           1. Khối lớp (6, 7)
           2. Môn học (Toán, Tin học)
           3. Chương học / Chủ đề
           4. Bài học cụ thể (sắp theo sortOrder số)
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
                  Chọn lần lượt: Khối lớp → Môn học → {groupLabelPrompt} → Bài học để mở nội dung.
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

            {/* Lưới 4 dropdown phụ thuộc nhau */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* 1. KHỐI LỚP (Chỉ 6 và 7 theo dữ liệu) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  1. Khối lớp: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedGrade}
                  onChange={e => handleGradeChange(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                >
                  <option value="">-- Chọn Khối lớp --</option>
                  {AVAILABLE_GRADES.map(g => (
                    <option key={g} value={g}>
                      Khối {g} (Lớp {g})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Dữ liệu chuẩn GDPT: Lớp 6 và 7</p>
              </div>

              {/* 2. MÔN HỌC (Toán, Tin học - Khóa nếu chưa chọn Khối) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  2. Môn học: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSubjectCode}
                  onChange={e => handleSubjectChange(e.target.value)}
                  disabled={!selectedGrade}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedGrade ? '-- Vui lòng chọn Khối trước --' : '-- Chọn Môn học --'}
                  </option>
                  {availableSubjects.map(s => (
                    <option key={s.code} value={s.code}>
                      Môn {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Hai tập Toán được gộp chung</p>
              </div>

              {/* 3. CHƯƠNG / CHỦ ĐỀ (Khóa nếu chưa chọn Môn) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  3. {groupLabelPrompt}: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedGroupKey}
                  onChange={e => handleGroupChange(e.target.value)}
                  disabled={!selectedSubjectCode}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedSubjectCode
                      ? '-- Vui lòng chọn Môn trước --'
                      : `-- Chọn ${groupLabelPrompt} --`}
                  </option>
                  {availableGroups.map(g => {
                    const volumeBadge =
                      selectedSubjectCode === 'Toan' && g.volume ? `[Tập ${g.volume}] ` : '';
                    return (
                      <option key={g.groupKey} value={g.groupKey}>
                        {volumeBadge}
                        {g.chapterLabel}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-400">
                  {selectedSubjectCode === 'Toan'
                    ? 'Toán hiển thị Chương & Volume phụ'
                    : 'Tin học hiển thị Chủ đề'}
                </p>
              </div>

              {/* 4. BÀI HỌC CỤ THỂ (Khóa nếu chưa chọn Chương/Chủ đề) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  4. Bài học cụ thể: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedLessonId}
                  onChange={e => handleLessonChange(e.target.value)}
                  disabled={!selectedGroupKey}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F7] bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedGroupKey
                      ? `-- Vui lòng chọn ${groupLabelPrompt} trước --`
                      : '-- Chọn Bài học --'}
                  </option>
                  {availableLessons.map(l => (
                    <option key={l.id} value={l.id}>
                      {getLessonOptionLabel(l)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Sắp xếp theo thứ tự số của bài</p>
              </div>
            </div>

            {/* Chi tiết bài học đã chọn & Trạng thái học liệu */}
            {currentSelectedLesson && (
              <div className="p-4 rounded-xl border border-[#DCE8F7] bg-[#FBFDFF] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        Thông tin bài học:
                      </span>
                      {currentSelectedLesson.volume && selectedSubjectCode === 'Toan' && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                          Tập {currentSelectedLesson.volume}
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
                      Tệp bài học dự kiến: <code>{currentSelectedLesson.htmlUrl}</code>
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
                {!selectedGrade || !selectedSubjectCode || !selectedGroupKey || !selectedLessonId ? (
                  <span>* Hãy chọn đủ 4 thông tin: Khối lớp, Môn học, {groupLabelPrompt}, Bài học để kích hoạt nút vào học.</span>
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
                    setSelectedGroupKey(`${lesson.volume}_${lesson.chapterLabel}`);
                    setSelectedLessonId(lesson.id);
                    setActiveLesson(lesson);
                    setIsIframeLoading(true);
                  }
                }}
                className="px-3.5 py-1.5 border border-[#DCE8F7] hover:border-blue-400 text-[#006BFF] bg-blue-50/50 hover:bg-blue-50 rounded-xl font-bold transition-colors cursor-pointer shrink-0"
              >
                Mở lại bài này
              </button>
            </div>
          )}

          {/* Thông tin quy định danh mục & tích hợp học liệu */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
            <h5 className="font-bold text-[#082B52] flex items-center space-x-1.5">
              <Info className="w-4 h-4 text-[#006BFF]" />
              <span>Quy tắc vận hành Danh mục Kiến thức trọng tâm:</span>
            </h5>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1 leading-relaxed">
              <li>
                <strong>Nguồn dữ liệu chuẩn:</strong> Toàn bộ 178 bài học thuộc 6 sách giáo khoa GDPT 2018 (Toán 6 Tập 1 & 2, Toán 7 Tập 1 & 2, Tin học 6, Tin học 7).
              </li>
              <li>
                <strong>Vị trí đặt file HTML độc lập:</strong> Thư mục <code>public/lessons/</code> (ví dụ: <code>public/lessons/Toan_6_c1_b1.html</code>).
              </li>
              <li>
                <strong>Đường dẫn truy cập trực tiếp:</strong> <code>/lessons/Toan_6_c1_b1.html</code> (không chứa tiền tố <code>/public</code>).
              </li>
              <li>
                <strong>Bảo toàn nguyên bản:</strong> Hệ thống giữ nguyên 100% mã nguồn HTML, KaTeX toán học, CSS, tương tác JavaScript thông qua iframe.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
