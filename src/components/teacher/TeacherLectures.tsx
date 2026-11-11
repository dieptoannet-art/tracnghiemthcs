import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Presentation,
  ArrowLeft,
  ExternalLink,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  ListOrdered,
  Search,
  BookOpen,
  Sparkles,
  RefreshCw,
  Layers,
  Compass,
  Type,
  Laptop,
  Filter
} from 'lucide-react';
import teacherLecturesData from '../../data/teacherLectureCatalog.json';

export interface LectureItem {
  id: string;
  grade: number;
  subjectCode: string;
  subjectName: string;
  bookSeries: string;
  volume: number;
  groupType: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterLabel: string;
  lessonNumber: number | null;
  lessonTitle: string;
  lessonLabel: string;
  itemType: 'lesson' | 'practice' | 'chapter_review' | 'activity' | string;
  sortOrder: number;
  sourceFile: string;
  sourcePage: number;
  htmlFile: string;
  htmlUrl: string;
  status: string;
  lectureId: string;
}

export const TeacherLectures: React.FC = () => {
  const lectures = teacherLecturesData as LectureItem[];

  const [selectedLecture, setSelectedLecture] = useState<LectureItem | null>(null);
  const [activeChapterFilter, setActiveChapterFilter] = useState<string>('all');
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Presentation viewer controls
  const [fontSizePercent, setFontSizePercent] = useState<number>(100);
  const [solutionsExpanded, setSolutionsExpanded] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [verification, setVerification] = useState<{
    status: 'checking' | 'verified' | 'failed';
    message: string;
    foundId?: string;
  }>({
    status: 'checking',
    message: 'Đang xác thực mã học liệu...'
  });
  const [detectedSections, setDetectedSections] = useState<Array<{ title: string; index: number }>>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Group chapters for filter
  const chapterOptions = useMemo(() => {
    const list = [
      { id: 'all', label: 'Tất cả chương', count: lectures.length },
      { id: 'c1', label: 'Chương I: Tập hợp các số tự nhiên', count: lectures.filter(l => l.chapterNumber === 1).length },
      { id: 'c2', label: 'Chương II: Tính chia hết', count: lectures.filter(l => l.chapterNumber === 2).length },
      { id: 'c3', label: 'Chương III: Số nguyên', count: lectures.filter(l => l.chapterNumber === 3).length },
      { id: 'c4', label: 'Chương IV: Hình phẳng trong thực tiễn', count: lectures.filter(l => l.chapterNumber === 4).length },
      { id: 'c5', label: 'Chương V: Tính đối xứng', count: lectures.filter(l => l.chapterNumber === 5).length },
      { id: 'tn', label: 'Hoạt động thực hành trải nghiệm', count: lectures.filter(l => l.itemType === 'activity').length },
    ];
    return list;
  }, [lectures]);

  // Filtered lectures
  const filteredLectures = useMemo(() => {
    return lectures.filter(item => {
      // Chapter filter
      if (activeChapterFilter === 'c1' && item.chapterNumber !== 1) return false;
      if (activeChapterFilter === 'c2' && item.chapterNumber !== 2) return false;
      if (activeChapterFilter === 'c3' && item.chapterNumber !== 3) return false;
      if (activeChapterFilter === 'c4' && item.chapterNumber !== 4) return false;
      if (activeChapterFilter === 'c5' && item.chapterNumber !== 5) return false;
      if (activeChapterFilter === 'tn' && item.itemType !== 'activity') return false;

      // Type filter
      if (activeTypeFilter !== 'all' && item.itemType !== activeTypeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.lessonTitle.toLowerCase().includes(q);
        const matchLabel = item.lessonLabel.toLowerCase().includes(q);
        const matchChap = item.chapterLabel.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        if (!matchTitle && !matchLabel && !matchChap && !matchId) return false;
      }

      return true;
    });
  }, [lectures, activeChapterFilter, activeTypeFilter, searchQuery]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // When changing font size or switching lecture, apply zoom/font size to iframe
  const applyFontScaleToIframe = (percent: number) => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc && doc.body) {
        const bodyStyle = doc.body.style as any;
        bodyStyle.zoom = `${percent}%`;
        if (!('zoom' in bodyStyle)) {
          bodyStyle.transform = `scale(${percent / 100})`;
          bodyStyle.transformOrigin = 'top center';
        }
      }
    } catch (e) {
      console.warn('Cannot adjust iframe font scale:', e);
    }
  };

  // Check data-lecture-id when iframe loads
  const handleIframeLoad = () => {
    if (!selectedLecture) return;

    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) {
        setVerification({
          status: 'failed',
          message: 'Không thể truy cập tài liệu iframe (lỗi bảo mật CORS hoặc mạng).'
        });
        return;
      }

      // Check if it's the SPA fallback (e.g. index.html of Tay Do Smart Edu)
      const pageTitle = doc.title || '';
      const isSpaFallback = pageTitle.includes('TÂY ĐÔ SMART EDU') && !pageTitle.toLowerCase().includes('toán 6') && !pageTitle.toLowerCase().includes('geogebra');

      // Check for data-lecture-id on html or body or element
      const htmlElem = doc.documentElement;
      const bodyElem = doc.body;
      const lectureIdAttr =
        htmlElem.getAttribute('data-lecture-id') ||
        bodyElem.getAttribute('data-lecture-id') ||
        doc.querySelector('[data-lecture-id]')?.getAttribute('data-lecture-id');

      if (isSpaFallback || !lectureIdAttr) {
        setVerification({
          status: 'failed',
          message: 'Cảnh báo: Không tìm thấy học liệu chính thức (máy chủ trả trang chủ hoặc 404).'
        });
      } else if (lectureIdAttr === selectedLecture.id || lectureIdAttr === selectedLecture.lectureId) {
        setVerification({
          status: 'verified',
          message: `Xác thực thành công học liệu chính thức: ${lectureIdAttr}`,
          foundId: lectureIdAttr
        });
      } else {
        setVerification({
          status: 'verified',
          message: `Học liệu hợp lệ (Mã: ${lectureIdAttr})`,
          foundId: lectureIdAttr
        });
      }

      // Extract sections / headings from the loaded document for quick jump
      const headings = Array.from(
        doc.querySelectorAll('h1, h2.card-title, h2, .panel h2, .hero h1')
      ).map((el, index) => {
        const text = el.textContent?.trim().replace(/\s+/g, ' ') || `Phần ${index + 1}`;
        // Tag element with an anchor index if not present
        if (!el.id) el.id = `lecture-sec-${index}`;
        return {
          title: text.length > 45 ? text.substring(0, 45) + '...' : text,
          index
        };
      });
      setDetectedSections(headings);

      // Apply current font scaling
      applyFontScaleToIframe(fontSizePercent);

      // If solution expansion is active, apply it
      if (solutionsExpanded) {
        doc.querySelectorAll('details').forEach(d => (d.open = true));
      }
    } catch (err: any) {
      setVerification({
        status: 'failed',
        message: `Lỗi đọc nội dung bài giảng: ${err?.message || 'Không xác định'}`
      });
    }
  };

  // Toggle solutions inside iframe
  const handleToggleSolutions = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const nextState = !solutionsExpanded;
        setSolutionsExpanded(nextState);
        const details = doc.querySelectorAll('details');
        details.forEach(d => (d.open = nextState));
      }
    } catch (e) {
      console.warn('Cannot toggle solutions:', e);
    }
  };

  // Scroll to section inside iframe
  const handleScrollToSection = (index: number) => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const target = doc.getElementById(`lecture-sec-${index}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } catch (e) {
      console.warn('Cannot scroll to section:', e);
    }
  };

  // Toggle fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Fullscreen request error:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Exit fullscreen error:', err);
      });
    }
  };

  // Reload iframe
  const handleReloadIframe = () => {
    if (iframeRef.current && selectedLecture) {
      setVerification({ status: 'checking', message: 'Đang tải lại học liệu...' });
      iframeRef.current.src = selectedLecture.htmlUrl + '?reload=' + Date.now();
    }
  };

  // Badge helper
  const getItemTypeBadge = (type: string) => {
    switch (type) {
      case 'lesson':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">Bài lý thuyết</span>;
      case 'practice':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">Luyện tập chung</span>;
      case 'chapter_review':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700">Ôn cuối chương</span>;
      case 'activity':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Trải nghiệm thực tế</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Bài học</span>;
    }
  };

  // -------------------------------------------------------------
  // VIEW: PRESENTATION MODE (Trình chiếu giảng dạy)
  // -------------------------------------------------------------
  if (selectedLecture) {
    return (
      <div
        ref={containerRef}
        className={`flex flex-col bg-slate-900 text-slate-100 ${
          isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : 'h-[calc(100vh-64px)]'
        }`}
      >
        {/* Top Control Bar */}
        <div className="bg-[#082B52] border-b border-blue-900/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0">
          {/* Left: Back & Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setSelectedLecture(null)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer"
              title="Quay lại danh sách bài giảng"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Danh sách</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded font-mono font-medium hidden md:inline-block">
                  {selectedLecture.chapterNumber ? `Chương ${selectedLecture.chapterNumber}` : 'Trải nghiệm'}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[260px] sm:max-w-md lg:max-w-xl">
                  {selectedLecture.lessonLabel}
                </h2>
              </div>
            </div>
          </div>

          {/* Center: Verification status badge */}
          <div className="hidden lg:flex items-center text-xs">
            {verification.status === 'checking' && (
              <span className="flex items-center space-x-1.5 text-blue-300 bg-blue-950/80 px-2.5 py-1 rounded-full border border-blue-800/60">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang kiểm tra...</span>
              </span>
            )}
            {verification.status === 'verified' && (
              <span
                className="flex items-center space-x-1.5 text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/60"
                title={verification.message}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-medium">Học liệu chuẩn ({verification.foundId || selectedLecture.id})</span>
              </span>
            )}
            {verification.status === 'failed' && (
              <span
                className="flex items-center space-x-1.5 text-rose-300 bg-rose-950/80 px-2.5 py-1 rounded-full border border-rose-800/60"
                title={verification.message}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-semibold">Cảnh báo: Fallback / Không khớp</span>
              </span>
            )}
          </div>

          {/* Right: Presentation Tools (Chữ lớn, Lời giải, Chuyển phần, Fullscreen, Tab riêng) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Quick Section Jump Dropdown */}
            {detectedSections.length > 0 && (
              <div className="relative group">
                <select
                  aria-label="Chuyển nhanh tới phần bài giảng"
                  onChange={(e) => handleScrollToSection(Number(e.target.value))}
                  defaultValue=""
                  className="bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-hidden focus:ring-1 focus:ring-blue-400 cursor-pointer appearance-none max-w-[120px] sm:max-w-[160px] truncate"
                >
                  <option value="" disabled className="text-slate-900 bg-white">Chuyển phần...</option>
                  {detectedSections.map((sec) => (
                    <option key={sec.index} value={sec.index} className="text-slate-900 bg-white">
                      {sec.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Font Size Scaling (Chữ lớn cho máy chiếu / TV) */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10 text-xs">
              <button
                onClick={() => {
                  const sizes = [100, 115, 130, 150];
                  const nextIdx = (sizes.indexOf(fontSizePercent) + 1) % sizes.length;
                  const nextVal = sizes[nextIdx];
                  setFontSizePercent(nextVal);
                  applyFontScaleToIframe(nextVal);
                }}
                className="flex items-center space-x-1 px-2 py-1 text-white hover:text-blue-200 transition-colors cursor-pointer"
                title="Thay đổi cỡ chữ trình chiếu"
              >
                <Type className="w-3.5 h-3.5" />
                <span className="font-mono font-bold text-[11px]">{fontSizePercent}%</span>
              </button>
            </div>

            {/* Toggle Solutions (Đóng/Mở lời giải) */}
            <button
              onClick={handleToggleSolutions}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                solutionsExpanded
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={solutionsExpanded ? 'Thu gọn lời giải' : 'Mở tất cả lời giải và gợi ý'}
            >
              {solutionsExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {solutionsExpanded ? 'Đóng giải' : 'Mở giải'}
              </span>
            </button>

            {/* Reload button */}
            <button
              onClick={handleReloadIframe}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
              title="Tải lại học liệu"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Open in New Tab */}
            <button
              onClick={() => window.open(selectedLecture.htmlUrl, '_blank')}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Mở bài giảng trong tab trình duyệt mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tab riêng</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình trình chiếu'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Verification Alert Banner (if failed) */}
        {verification.status === 'failed' && (
          <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{verification.message} Vui lòng kiểm tra lại đường dẫn tệp: <code>{selectedLecture.htmlUrl}</code></span>
            </div>
            <button
              onClick={() => window.open(selectedLecture.htmlUrl, '_blank')}
              className="underline hover:text-white font-bold ml-2 shrink-0"
            >
              Thử mở URL trực tiếp
            </button>
          </div>
        )}

        {/* Main Iframe Viewer */}
        <div className="flex-1 w-full h-full relative bg-white">
          <iframe
            ref={iframeRef}
            src={selectedLecture.htmlUrl}
            title={selectedLecture.lessonLabel}
            onLoad={handleIframeLoad}
            className="w-full h-full border-0 block"
            allow="fullscreen; clipboard-read; clipboard-write; autoplay"
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: CATALOG & FILTER MODE (Danh sách bài giảng Toán 6 Tập 1)
  // -------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#082B52] via-[#0B3B70] to-[#006BFF] rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <Presentation className="w-80 h-80 -mr-16" />
        </div>
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold text-blue-100">
            <Presentation className="w-3.5 h-3.5" />
            <span>Học liệu Trình chiếu Trực tiếp · THCS Tây Đô</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            BÀI GIẢNG TOÁN 6 — TẬP MỘT
          </h1>

          <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed font-serif">
            Bộ học liệu điện tử chất lượng cao bám sát Chương trình GDPT 2018 (Kết nối tri thức với cuộc sống).
            Tích hợp công cụ tương tác trực tiếp, mô hình hình học GeoGebra, bài tập trắc nghiệm và lời giải chi tiết phục vụ giảng dạy trên lớp.
          </p>

          {/* Quick Statistics chips */}
          <div className="pt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-xs font-medium border border-white/10 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-300" />
              <span>38 bài giảng hoàn chỉnh</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-xs font-medium border border-white/10 flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
              <span>22 bài lý thuyết mới</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-xs font-medium border border-white/10 flex items-center space-x-1.5">
              <ListOrdered className="w-3.5 h-3.5 text-sky-300" />
              <span>8 tiết luyện tập & 5 cuối chương</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-xs font-medium border border-white/10 flex items-center space-x-1.5">
              <Laptop className="w-3.5 h-3.5 text-amber-300" />
              <span>3 hoạt động trải nghiệm & GeoGebra</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Search & Type filter row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bài giảng, số bài, GeoGebra, số nguyên, ước bội..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006BFF] focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1"
              >
                Xóa
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTypeFilter === 'all'
                    ? 'bg-white text-[#082B52] shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Tất cả loại
              </button>
              <button
                onClick={() => setActiveTypeFilter('lesson')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTypeFilter === 'lesson'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Bài học (22)
              </button>
              <button
                onClick={() => setActiveTypeFilter('practice')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTypeFilter === 'practice'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Luyện tập (8)
              </button>
              <button
                onClick={() => setActiveTypeFilter('chapter_review')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTypeFilter === 'chapter_review'
                    ? 'bg-white text-purple-700 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Cuối chương (5)
              </button>
              <button
                onClick={() => setActiveTypeFilter('activity')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTypeFilter === 'activity'
                    ? 'bg-white text-amber-700 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Trải nghiệm (3)
              </button>
            </div>
          </div>
        </div>

        {/* Chapter Tabs Row */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 pt-1 text-xs font-medium border-t border-slate-100">
          <span className="text-slate-400 font-semibold px-2 flex items-center space-x-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Chương:</span>
          </span>
          {chapterOptions.map((ch) => {
            const isSelected = activeChapterFilter === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChapterFilter(ch.id)}
                className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-[#082B52] text-white shadow-xs font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{ch.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {ch.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Lecture Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>Hiển thị <strong>{filteredLectures.length}</strong> bài giảng phù hợp</span>
          {searchQuery && (
            <span>Kết quả cho từ khóa: &quot;{searchQuery}&quot;</span>
          )}
        </div>

        {filteredLectures.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">Không tìm thấy bài giảng phù hợp</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Thử xóa bớt bộ lọc hoặc từ khóa tìm kiếm để hiển thị đầy đủ danh mục bài giảng Toán 6 Tập 1.
            </p>
            <button
              onClick={() => {
                setActiveChapterFilter('all');
                setActiveTypeFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              Đặt lại tất cả bộ lọc
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLectures.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[170px]">
                      {item.chapterLabel}
                    </span>
                    {getItemTypeBadge(item.itemType)}
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="text-base font-bold text-[#082B52] group-hover:text-[#006BFF] transition-colors leading-snug line-clamp-2">
                      {item.lessonLabel}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1 font-serif italic">
                      Bộ sách: {item.bookSeries} · Trang {item.sourcePage}
                    </p>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-slate-400 truncate">
                    {item.id}
                  </span>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {/* Open in separate tab */}
                    <button
                      onClick={() => window.open(item.htmlUrl, '_blank')}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Mở trong tab riêng biệt"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                    {/* Open in built-in presentation viewer */}
                    <button
                      onClick={() => {
                        setSelectedLecture(item);
                        setVerification({ status: 'checking', message: 'Đang chuẩn bị học liệu...' });
                        setSolutionsExpanded(false);
                      }}
                      className="px-3 py-1.5 bg-[#006BFF] hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <Presentation className="w-3.5 h-3.5" />
                      <span>Mở bài giảng</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
