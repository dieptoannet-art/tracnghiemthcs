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
  Search,
  BookOpen,
  RefreshCw,
  Type,
  RotateCcw
} from 'lucide-react';
import teacherLecturesData from '../../data/teacherLectureCatalog.json';

export interface LectureItem {
  id: string;
  grade: number;
  subjectCode: string;
  subjectName: string;
  bookSeries?: string | null;
  volume?: number | null;
  groupType?: string | null;
  chapterCode?: string | null;
  chapterOrder?: number | null;
  chapterNumber?: number | null;
  chapterTitle?: string | null;
  chapterLabel: string;
  lessonNumber?: number | null;
  lessonTitle?: string | null;
  lessonLabel: string;
  itemType: 'lesson' | 'practice' | 'chapter_review' | 'activity' | string;
  sortOrder: number;
  sourceFile?: string | null;
  sourcePage?: number | null;
  htmlFile?: string;
  htmlUrl: string;
  status?: string;
  lectureId?: string;
  lessonCode?: string | null;
}

interface TeacherLecturesProps {
  catalogOverride?: LectureItem[];
}

export function getChapterKey(item: LectureItem): string {
  const volPart = item.volume != null && Number(item.volume) > 0 ? String(item.volume) : 'none';
  const chapCode =
    item.chapterCode ||
    (item.groupType === 'activity' || item.itemType === 'activity'
      ? `activity_${item.chapterNumber ?? 0}`
      : item.chapterNumber != null
      ? `chap_${item.chapterNumber}`
      : item.chapterLabel);
  return `${item.grade}::${item.subjectCode}::${volPart}::${chapCode}`;
}

export function formatVolumeLabel(vol: number): string {
  if (vol === 1) return 'Tập một';
  if (vol === 2) return 'Tập hai';
  return `Tập ${vol}`;
}

function getShortChapterName(chapterLabel: string): string {
  const dotIdx = chapterLabel.indexOf('.');
  if (dotIdx > 0 && dotIdx < 20) {
    return chapterLabel.slice(0, dotIdx).trim();
  }
  return chapterLabel.length > 28 ? chapterLabel.slice(0, 28) + '…' : chapterLabel;
}

function sortLectureItems(items: LectureItem[]): LectureItem[] {
  return [...items].sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.subjectName !== b.subjectName) {
      return a.subjectName.localeCompare(b.subjectName, 'vi');
    }
    const volA = a.volume != null ? Number(a.volume) : 0;
    const volB = b.volume != null ? Number(b.volume) : 0;
    if (volA !== volB) return volA - volB;

    const chapOrderA =
      a.chapterOrder != null
        ? Number(a.chapterOrder)
        : a.groupType === 'activity' || a.itemType === 'activity' || a.chapterNumber === 0
        ? 999
        : Number(a.chapterNumber ?? 0);
    const chapOrderB =
      b.chapterOrder != null
        ? Number(b.chapterOrder)
        : b.groupType === 'activity' || b.itemType === 'activity' || b.chapterNumber === 0
        ? 999
        : Number(b.chapterNumber ?? 0);
    if (chapOrderA !== chapOrderB) return chapOrderA - chapOrderB;

    const sortA = a.sortOrder != null ? Number(a.sortOrder) : 9999;
    const sortB = b.sortOrder != null ? Number(b.sortOrder) : 9999;
    if (sortA !== sortB) return sortA - sortB;

    const lessonNumA = a.lessonNumber != null ? Number(a.lessonNumber) : 9999;
    const lessonNumB = b.lessonNumber != null ? Number(b.lessonNumber) : 9999;
    if (lessonNumA !== lessonNumB) return lessonNumA - lessonNumB;

    const pageA = a.sourcePage != null ? Number(a.sourcePage) : 9999;
    const pageB = b.sourcePage != null ? Number(b.sourcePage) : 9999;
    if (pageA !== pageB) return pageA - pageB;

    return a.lessonLabel.localeCompare(b.lessonLabel, 'vi', { numeric: true });
  });
}

export const TeacherLectures: React.FC<TeacherLecturesProps> = ({ catalogOverride }) => {
  const lectures = useMemo(
    () => sortLectureItems((catalogOverride || teacherLecturesData) as LectureItem[]),
    [catalogOverride]
  );

  // Cascading Filter States: Khối lớp -> Môn học -> Tập sách -> Chương/Chủ đề -> Bài giảng
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedVolume, setSelectedVolume] = useState<string>('all');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('all');
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active presentation state
  const [selectedLecture, setSelectedLecture] = useState<LectureItem | null>(null);
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

  // 1. Available Grades
  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    lectures.forEach((l) => set.add(l.grade));
    return Array.from(set).sort((a, b) => a - b);
  }, [lectures]);

  // 2. Scope after Grade -> Available Subjects
  const itemsAfterGrade = useMemo(() => {
    if (selectedGrade === 'all') return lectures;
    return lectures.filter((l) => String(l.grade) === selectedGrade);
  }, [lectures, selectedGrade]);

  const availableSubjects = useMemo(() => {
    const map = new Map<string, string>();
    itemsAfterGrade.forEach((l) => {
      if (!map.has(l.subjectCode)) {
        map.set(l.subjectCode, l.subjectName);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [itemsAfterGrade]);

  // 3. Scope after Grade + Subject -> Available Volumes
  const itemsAfterSubject = useMemo(() => {
    if (selectedSubject === 'all') return itemsAfterGrade;
    return itemsAfterGrade.filter((l) => l.subjectCode === selectedSubject);
  }, [itemsAfterGrade, selectedSubject]);

  const availableVolumes = useMemo(() => {
    const set = new Set<number>();
    itemsAfterSubject.forEach((l) => {
      if (l.volume != null && Number(l.volume) > 0) {
        set.add(Number(l.volume));
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [itemsAfterSubject]);

  // Show Volume select only if the current scoped subject(s) have volume divisions
  const showVolumeFilter = availableVolumes.length > 0;

  // 4. Scope after Grade + Subject + Volume -> Available Chapters
  const itemsAfterVolume = useMemo(() => {
    if (!showVolumeFilter || selectedVolume === 'all') return itemsAfterSubject;
    return itemsAfterSubject.filter((l) => String(l.volume ?? '') === selectedVolume);
  }, [itemsAfterSubject, selectedVolume, showVolumeFilter]);

  const availableChapters = useMemo(() => {
    const map = new Map<string, { key: string; label: string; contextSuffix: string }>();
    const needCourseSuffix = selectedGrade === 'all' || selectedSubject === 'all';
    itemsAfterVolume.forEach((l) => {
      const key = getChapterKey(l);
      if (!map.has(key)) {
        const volStr = l.volume != null && Number(l.volume) > 0 ? ` · Tập ${l.volume}` : '';
        map.set(key, {
          key,
          label: l.chapterLabel,
          contextSuffix: needCourseSuffix ? ` (${l.subjectName} ${l.grade}${volStr})` : ''
        });
      }
    });
    return Array.from(map.values());
  }, [itemsAfterVolume, selectedGrade, selectedSubject]);

  // 5. Scope after Grade + Subject + Volume + Chapter -> Available Lessons
  const itemsAfterChapter = useMemo(() => {
    if (selectedChapter === 'all') return itemsAfterVolume;
    return itemsAfterVolume.filter((l) => getChapterKey(l) === selectedChapter);
  }, [itemsAfterVolume, selectedChapter]);

  // Count duplicate lessonLabels to disambiguate items like "Luyện tập chung"
  const lessonLabelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    itemsAfterChapter.forEach((l) => {
      counts.set(l.lessonLabel, (counts.get(l.lessonLabel) || 0) + 1);
    });
    return counts;
  }, [itemsAfterChapter]);

  const formatLessonOptionLabel = (item: LectureItem): string => {
    const isDuplicate = (lessonLabelCounts.get(item.lessonLabel) || 0) > 1;
    const needsDisambiguation = isDuplicate || selectedChapter === 'all';
    if (!needsDisambiguation) return item.lessonLabel;

    const parts: string[] = [getShortChapterName(item.chapterLabel)];
    if (item.sourcePage) parts.push(`Tr. ${item.sourcePage}`);
    return `${item.lessonLabel} (${parts.join(' · ')})`;
  };

  // Cascading change handlers
  const handleGradeChange = (newGrade: string) => {
    setSelectedGrade(newGrade);
    setSelectedSubject('all');
    setSelectedVolume('all');
    setSelectedChapter('all');
    setSelectedLessonId('all');
  };

  const handleSubjectChange = (newSubject: string) => {
    setSelectedSubject(newSubject);
    setSelectedVolume('all');
    setSelectedChapter('all');
    setSelectedLessonId('all');
  };

  const handleVolumeChange = (newVolume: string) => {
    setSelectedVolume(newVolume);
    const nextAfterVol =
      newVolume === 'all'
        ? itemsAfterSubject
        : itemsAfterSubject.filter((l) => String(l.volume ?? '') === newVolume);

    let nextChapter = selectedChapter;
    if (
      nextChapter !== 'all' &&
      !nextAfterVol.some((l) => getChapterKey(l) === nextChapter)
    ) {
      nextChapter = 'all';
      setSelectedChapter('all');
    }

    const nextAfterChap =
      nextChapter === 'all'
        ? nextAfterVol
        : nextAfterVol.filter((l) => getChapterKey(l) === nextChapter);

    if (
      selectedLessonId !== 'all' &&
      !nextAfterChap.some((l) => l.id === selectedLessonId)
    ) {
      setSelectedLessonId('all');
    }
  };

  const handleChapterChange = (newChapter: string) => {
    setSelectedChapter(newChapter);
    const nextAfterChap =
      newChapter === 'all'
        ? itemsAfterVolume
        : itemsAfterVolume.filter((l) => getChapterKey(l) === newChapter);

    if (
      selectedLessonId !== 'all' &&
      !nextAfterChap.some((l) => l.id === selectedLessonId)
    ) {
      setSelectedLessonId('all');
    }
  };

  const handleLessonChange = (newLessonId: string) => {
    setSelectedLessonId(newLessonId);
  };

  const handleResetAllFilters = () => {
    setSelectedGrade('all');
    setSelectedSubject('all');
    setSelectedVolume('all');
    setSelectedChapter('all');
    setSelectedLessonId('all');
    setActiveTypeFilter('all');
    setSearchQuery('');
  };

  // Scope after Lesson selection + Search Query (used for stats & type counts)
  const scopedBeforeType = useMemo(() => {
    return itemsAfterChapter.filter((item) => {
      if (selectedLessonId !== 'all' && item.id !== selectedLessonId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (item.lessonTitle || '').toLowerCase().includes(q);
        const matchLabel = item.lessonLabel.toLowerCase().includes(q);
        const matchChap = item.chapterLabel.toLowerCase().includes(q);
        const matchSubject = item.subjectName.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchLectureId = (item.lectureId || '').toLowerCase().includes(q);
        const matchCode = (item.lessonCode || '').toLowerCase().includes(q);
        if (
          !matchTitle &&
          !matchLabel &&
          !matchChap &&
          !matchSubject &&
          !matchId &&
          !matchLectureId &&
          !matchCode
        ) {
          return false;
        }
      }
      return true;
    });
  }, [itemsAfterChapter, selectedLessonId, searchQuery]);

  // Dynamic statistics computed strictly from catalog / active scope
  const stats = useMemo(() => {
    let lesson = 0;
    let practice = 0;
    let chapterReview = 0;
    let activity = 0;
    scopedBeforeType.forEach((item) => {
      if (item.itemType === 'lesson') lesson++;
      else if (item.itemType === 'practice') practice++;
      else if (item.itemType === 'chapter_review') chapterReview++;
      else if (item.itemType === 'activity') activity++;
    });
    return {
      total: scopedBeforeType.length,
      lesson,
      practice,
      chapterReview,
      activity
    };
  }, [scopedBeforeType]);

  // Ensure activeTypeFilter stays valid when changing course filters
  const effectiveTypeFilter = useMemo(() => {
    if (activeTypeFilter === 'all') return 'all';
    if (activeTypeFilter === 'lesson' && stats.lesson === 0) return 'all';
    if (activeTypeFilter === 'practice' && stats.practice === 0) return 'all';
    if (activeTypeFilter === 'chapter_review' && stats.chapterReview === 0) return 'all';
    if (activeTypeFilter === 'activity' && stats.activity === 0) return 'all';
    return activeTypeFilter;
  }, [activeTypeFilter, stats]);

  // Final filtered list
  const filteredLectures = useMemo(() => {
    if (effectiveTypeFilter === 'all') return scopedBeforeType;
    return scopedBeforeType.filter((item) => item.itemType === effectiveTypeFilter);
  }, [scopedBeforeType, effectiveTypeFilter]);

  // Dynamic Banner Title based on chosen bộ học liệu
  const bannerTitle = useMemo(() => {
    if (selectedSubject === 'all' && selectedGrade === 'all') {
      return 'Thư viện bài giảng';
    }
    if (selectedSubject === 'all' && selectedGrade !== 'all') {
      return `Thư viện bài giảng · Khối ${selectedGrade}`;
    }
    const matchedSubj = availableSubjects.find((s) => s.code === selectedSubject);
    const subjName = matchedSubj?.name || selectedSubject;
    const gradePart = selectedGrade !== 'all' ? ` ${selectedGrade}` : ' THCS';
    const volPart =
      showVolumeFilter && selectedVolume !== 'all'
        ? ` · ${formatVolumeLabel(Number(selectedVolume))}`
        : '';
    return `${subjName}${gradePart}${volPart}`;
  }, [selectedSubject, selectedGrade, selectedVolume, availableSubjects, showVolumeFilter]);

  const bannerSubtitle = useMemo(() => {
    const seriesSet = new Set<string>();
    itemsAfterVolume.forEach((i) => {
      if (i.bookSeries) seriesSet.add(i.bookSeries);
    });
    const seriesText =
      seriesSet.size > 0
        ? `Bộ sách ${Array.from(seriesSet).join(', ')} · Chương trình GDPT 2018.`
        : 'Chương trình GDPT 2018 · THCS Tây Đô.';
    return `${seriesText} Hỗ trợ trình chiếu trực tiếp trên lớp, phóng to cỡ chữ, đóng mở lời giải và mô hình tương tác.`;
  }, [itemsAfterVolume]);

  // Fullscreen listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

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

  // Verify iframe content: 404, SPA fallback, or data-lecture-id mismatch
  const handleIframeLoad = async () => {
    if (!selectedLecture) return;

    const expectedId = selectedLecture.lectureId || selectedLecture.id;

    try {
      // Check HTTP status directly on same-origin URL
      const res = await fetch(selectedLecture.htmlUrl, { method: 'GET' });
      if (!res.ok) {
        setVerification({
          status: 'failed',
          message: `Không tìm thấy tệp bài giảng (HTTP ${res.status}) tại đường dẫn: ${selectedLecture.htmlUrl}`
        });
        return;
      }
    } catch {
      // Proceed to inspect iframe DOM if fetch check failed
    }

    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) {
        setVerification({
          status: 'failed',
          message: `Không thể truy cập tài liệu bài giảng tại đường dẫn: ${selectedLecture.htmlUrl}`
        });
        return;
      }

      // Check SPA fallback
      const hasSpaRoot = Boolean(doc.getElementById('root'));
      const pageTitle = doc.title || '';
      const isSpaFallback =
        hasSpaRoot ||
        ((pageTitle.includes('TÂY ĐÔ SMART EDU') || pageTitle.includes('TRẮC NGHIỆM THCS TÂY ĐÔ')) &&
          !pageTitle.toLowerCase().includes('bài') &&
          !pageTitle.toLowerCase().includes('chương') &&
          !pageTitle.toLowerCase().includes('hoạt động') &&
          !pageTitle.toLowerCase().includes('geogebra'));

      if (isSpaFallback) {
        setVerification({
          status: 'failed',
          message: `Máy chủ trả nhầm trang chủ ứng dụng thay vì tệp bài giảng. Đường dẫn kiểm tra: ${selectedLecture.htmlUrl}`
        });
        return;
      }

      const htmlElem = doc.documentElement;
      const bodyElem = doc.body;
      const lectureIdAttr =
        htmlElem?.getAttribute('data-lecture-id') ||
        bodyElem?.getAttribute('data-lecture-id') ||
        doc.querySelector('[data-lecture-id]')?.getAttribute('data-lecture-id') ||
        null;

      if (lectureIdAttr) {
        if (lectureIdAttr === expectedId) {
          setVerification({
            status: 'verified',
            message: `Xác thực thành công học liệu (${lectureIdAttr})`,
            foundId: lectureIdAttr
          });
        } else {
          setVerification({
            status: 'failed',
            message: `Sai mã học liệu: HTML có data-lecture-id="${lectureIdAttr}" nhưng danh mục yêu cầu "${expectedId}". Đường dẫn: ${selectedLecture.htmlUrl}`,
            foundId: lectureIdAttr
          });
        }
      } else {
        // HTML exists, not SPA root, but lacks data-lecture-id
        const bodyTextLen = (doc.body?.textContent || '').trim().length;
        if (bodyTextLen < 40) {
          setVerification({
            status: 'failed',
            message: `Tệp bài giảng trống hoặc bị thiếu nội dung tại đường dẫn: ${selectedLecture.htmlUrl}`
          });
        } else {
          setVerification({
            status: 'verified',
            message: `Đã mở học liệu (${selectedLecture.lessonLabel})`
          });
        }
      }

      // Extract sections for quick navigation
      const headings = Array.from(
        doc.querySelectorAll('h1, h2.card-title, h2, .panel h2, .hero h1')
      ).map((el, index) => {
        const text = el.textContent?.trim().replace(/\s+/g, ' ') || `Phần ${index + 1}`;
        if (!el.id) el.id = `lecture-sec-${index}`;
        return {
          title: text.length > 45 ? text.substring(0, 45) + '...' : text,
          index
        };
      });
      setDetectedSections(headings);

      applyFontScaleToIframe(fontSizePercent);

      if (solutionsExpanded) {
        doc.querySelectorAll('details').forEach((d) => (d.open = true));
      }
    } catch (err: any) {
      setVerification({
        status: 'failed',
        message: `Lỗi đọc nội dung bài giảng tại ${selectedLecture.htmlUrl}: ${err?.message || 'Không xác định'}`
      });
    }
  };

  const handleToggleSolutions = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const nextState = !solutionsExpanded;
        setSolutionsExpanded(nextState);
        const details = doc.querySelectorAll('details');
        details.forEach((d) => (d.open = nextState));
      }
    } catch (e) {
      console.warn('Cannot toggle solutions:', e);
    }
  };

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

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error('Fullscreen request error:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Exit fullscreen error:', err);
      });
    }
  };

  const handleReloadIframe = () => {
    if (iframeRef.current && selectedLecture) {
      setVerification({ status: 'checking', message: 'Đang tải lại học liệu...' });
      iframeRef.current.src = selectedLecture.htmlUrl + '?reload=' + Date.now();
    }
  };

  const getItemTypeLabel = (type: string): { label: string; colorClass: string } => {
    switch (type) {
      case 'lesson':
        return { label: 'Bài học', colorClass: 'text-[#1769C2]' };
      case 'practice':
        return { label: 'Luyện tập', colorClass: 'text-emerald-700' };
      case 'chapter_review':
        return { label: 'Cuối chương', colorClass: 'text-purple-700' };
      case 'activity':
        return { label: 'Trải nghiệm', colorClass: 'text-amber-700' };
      default:
        return { label: 'Học liệu', colorClass: 'text-slate-600' };
    }
  };

  // -------------------------------------------------------------
  // VIEW: PRESENTATION MODE (Trình chiếu giảng dạy)
  // -------------------------------------------------------------
  if (selectedLecture) {
    return (
      <div
        ref={containerRef}
        className={`flex flex-col bg-slate-900 text-slate-100 font-serif ${
          isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : 'h-[calc(100vh-80px)] rounded-xl overflow-hidden border border-[#CFDCED]'
        }`}
      >
        {/* Top Control Bar */}
        <div className="bg-[#0F2D52] border-b border-blue-900/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0">
          {/* Left: Back & Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setSelectedLecture(null)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer"
              title="Quay lại danh sách bài giảng"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại danh sách</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-blue-200 hidden md:inline">
                  {selectedLecture.subjectName} {selectedLecture.grade}
                  {selectedLecture.volume ? ` · Tập ${selectedLecture.volume}` : ''}
                </span>
                <span className="text-blue-400 hidden md:inline" aria-hidden="true">·</span>
                <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[240px] sm:max-w-md lg:max-w-xl">
                  {selectedLecture.lessonLabel}
                </h2>
              </div>
            </div>
          </div>

          {/* Center: Verification status */}
          <div className="hidden lg:flex items-center text-xs">
            {verification.status === 'checking' && (
              <span className="flex items-center space-x-1.5 text-blue-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang kiểm tra học liệu...</span>
              </span>
            )}
            {verification.status === 'verified' && (
              <span
                className="flex items-center space-x-1.5 text-emerald-300"
                title={verification.message}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">
                  {verification.foundId
                    ? `Học liệu chuẩn (${verification.foundId})`
                    : 'Học liệu sẵn sàng'}
                </span>
              </span>
            )}
            {verification.status === 'failed' && (
              <span
                className="flex items-center space-x-1.5 text-rose-300"
                title={verification.message}
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span className="font-semibold">Lỗi kiểm tra học liệu</span>
              </span>
            )}
          </div>

          {/* Right: Presentation Tools */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {detectedSections.length > 0 && (
              <select
                aria-label="Chuyển nhanh tới phần bài giảng"
                onChange={(e) => handleScrollToSection(Number(e.target.value))}
                defaultValue=""
                className="bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/15 focus:outline-hidden focus:ring-1 focus:ring-blue-400 cursor-pointer max-w-[120px] sm:max-w-[160px] truncate"
              >
                <option value="" disabled className="text-slate-900 bg-white">
                  Chuyển phần...
                </option>
                {detectedSections.map((sec) => (
                  <option key={sec.index} value={sec.index} className="text-slate-900 bg-white">
                    {sec.title}
                  </option>
                ))}
              </select>
            )}

            {/* Font Size Scaling */}
            <button
              onClick={() => {
                const sizes = [100, 115, 130, 150];
                const nextIdx = (sizes.indexOf(fontSizePercent) + 1) % sizes.length;
                const nextVal = sizes[nextIdx];
                setFontSizePercent(nextVal);
                applyFontScaleToIframe(nextVal);
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/15 text-xs transition-colors cursor-pointer"
              title="Thay đổi cỡ chữ trình chiếu"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="font-mono font-bold tabular-nums text-[11px]">{fontSizePercent}%</span>
            </button>

            {/* Toggle Solutions */}
            <button
              onClick={handleToggleSolutions}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                solutionsExpanded
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={solutionsExpanded ? 'Thu gọn lời giải' : 'Mở tất cả lời giải và gợi ý'}
            >
              {solutionsExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {solutionsExpanded ? 'Đóng giải' : 'Mở giải'}
              </span>
            </button>

            <button
              onClick={handleReloadIframe}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
              title="Tải lại học liệu"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => window.open(selectedLecture.htmlUrl, '_blank')}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#1769C2] hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Mở bài giảng trong tab trình duyệt mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mở tab riêng</span>
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình trình chiếu'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Verification Error Banner */}
        {verification.status === 'failed' && (
          <div className="bg-rose-950 border-b border-rose-800 text-rose-100 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{verification.message}</span>
            </div>
            <button
              onClick={() => window.open(selectedLecture.htmlUrl, '_blank')}
              className="underline hover:text-white font-bold shrink-0 cursor-pointer"
            >
              Mở đường dẫn trực tiếp
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
  // VIEW: MULTI-GRADE MULTI-SUBJECT LECTURE LIBRARY
  // -------------------------------------------------------------
  const hasAnyActiveFilter =
    selectedGrade !== 'all' ||
    selectedSubject !== 'all' ||
    selectedVolume !== 'all' ||
    selectedChapter !== 'all' ||
    selectedLessonId !== 'all' ||
    effectiveTypeFilter !== 'all' ||
    searchQuery.trim() !== '';

  return (
    <div className="space-y-6 pb-12 font-serif">
      {/* 1. Dynamic Library Banner */}
      <div className="bg-gradient-to-r from-[#0F2D52] via-[#134278] to-[#1769C2] rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <p className="text-xs sm:text-sm font-medium text-blue-200 tracking-wide">
              Học liệu trình chiếu trực tiếp · Trường THCS Tây Đô
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {bannerTitle}
            </h1>
            <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
              {bannerSubtitle}
            </p>

            {/* Dynamic Computed Stats (Clean unboxed typography with separators) */}
            <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-blue-100 tabular-nums">
              <span className="font-bold text-white">{stats.total} học liệu</span>
              {stats.lesson > 0 && (
                <>
                  <span aria-hidden="true" className="text-blue-300/60">·</span>
                  <span>{stats.lesson} bài học</span>
                </>
              )}
              {stats.practice > 0 && (
                <>
                  <span aria-hidden="true" className="text-blue-300/60">·</span>
                  <span>{stats.practice} luyện tập</span>
                </>
              )}
              {stats.chapterReview > 0 && (
                <>
                  <span aria-hidden="true" className="text-blue-300/60">·</span>
                  <span>{stats.chapterReview} cuối chương</span>
                </>
              )}
              {stats.activity > 0 && (
                <>
                  <span aria-hidden="true" className="text-blue-300/60">·</span>
                  <span>{stats.activity} hoạt động</span>
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center shrink-0 opacity-20 pr-4">
            <Presentation className="w-28 h-28" />
          </div>
        </div>
      </div>

      {/* 2. Cascading Filters Panel (Khối lớp -> Môn học -> Tập sách -> Chương/Chủ đề -> Bài giảng) */}
      <div className="bg-white rounded-2xl border border-[#CFDCED] p-4 sm:p-5 shadow-xs space-y-4">
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            showVolumeFilter ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
          } gap-3`}
        >
          {/* 1. Khối lớp */}
          <div className="space-y-1">
            <label htmlFor="filter-grade" className="block text-xs font-bold text-[#0F2D52]">
              Khối lớp
            </label>
            <select
              id="filter-grade"
              value={selectedGrade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#F6FAFF] border border-[#CFDCED] rounded-xl text-[#0F2D52] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1769C2] cursor-pointer"
            >
              <option value="all">Tất cả khối</option>
              {availableGrades.map((g) => (
                <option key={g} value={String(g)}>
                  Khối {g}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Môn học */}
          <div className="space-y-1">
            <label htmlFor="filter-subject" className="block text-xs font-bold text-[#0F2D52]">
              Môn học
            </label>
            <select
              id="filter-subject"
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#F6FAFF] border border-[#CFDCED] rounded-xl text-[#0F2D52] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1769C2] cursor-pointer"
            >
              <option value="all">Tất cả môn</option>
              {availableSubjects.map((sub) => (
                <option key={sub.code} value={sub.code}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Tập sách (Ẩn khi môn học không chia tập) */}
          {showVolumeFilter && (
            <div className="space-y-1">
              <label htmlFor="filter-volume" className="block text-xs font-bold text-[#0F2D52]">
                Tập sách
              </label>
              <select
                id="filter-volume"
                value={selectedVolume}
                onChange={(e) => handleVolumeChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F6FAFF] border border-[#CFDCED] rounded-xl text-[#0F2D52] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1769C2] cursor-pointer"
              >
                <option value="all">Tất cả tập</option>
                {availableVolumes.map((v) => (
                  <option key={v} value={String(v)}>
                    {formatVolumeLabel(v)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Chương/Chủ đề */}
          <div className="space-y-1">
            <label htmlFor="filter-chapter" className="block text-xs font-bold text-[#0F2D52]">
              Chương/Chủ đề
            </label>
            <select
              id="filter-chapter"
              value={selectedChapter}
              onChange={(e) => handleChapterChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#F6FAFF] border border-[#CFDCED] rounded-xl text-[#0F2D52] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1769C2] cursor-pointer truncate"
            >
              <option value="all">Tất cả</option>
              {availableChapters.map((ch) => (
                <option key={ch.key} value={ch.key}>
                  {ch.label}
                  {ch.contextSuffix}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Bài giảng */}
          <div className="space-y-1">
            <label htmlFor="filter-lesson" className="block text-xs font-bold text-[#0F2D52]">
              Bài giảng
            </label>
            <select
              id="filter-lesson"
              value={selectedLessonId}
              onChange={(e) => handleLessonChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#F6FAFF] border border-[#CFDCED] rounded-xl text-[#0F2D52] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1769C2] cursor-pointer truncate"
            >
              <option value="all">Tất cả</option>
              {itemsAfterChapter.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatLessonOptionLabel(item)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input + Item Type Filter */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bài, số bài hoặc mã bài..."
              className="w-full pl-10 pr-12 py-2 text-sm bg-[#F6FAFF] border border-[#CFDCED] rounded-xl text-[#0F2D52] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1769C2]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-[#0F2D52] cursor-pointer"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Type Filter Tabs (Only shown if multiple types exist in current scope) */}
          {(stats.lesson > 0 || stats.practice > 0 || stats.chapterReview > 0 || stats.activity > 0) && (
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
              <button
                onClick={() => setActiveTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer tabular-nums ${
                  effectiveTypeFilter === 'all'
                    ? 'bg-white text-[#0F2D52] font-bold shadow-xs'
                    : 'text-slate-600 hover:text-[#0F2D52]'
                }`}
              >
                Tất cả ({stats.total})
              </button>
              {stats.lesson > 0 && (
                <button
                  onClick={() => setActiveTypeFilter('lesson')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer tabular-nums ${
                    effectiveTypeFilter === 'lesson'
                      ? 'bg-white text-[#1769C2] font-bold shadow-xs'
                      : 'text-slate-600 hover:text-[#0F2D52]'
                  }`}
                >
                  Bài học ({stats.lesson})
                </button>
              )}
              {stats.practice > 0 && (
                <button
                  onClick={() => setActiveTypeFilter('practice')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer tabular-nums ${
                    effectiveTypeFilter === 'practice'
                      ? 'bg-white text-emerald-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-[#0F2D52]'
                  }`}
                >
                  Luyện tập ({stats.practice})
                </button>
              )}
              {stats.chapterReview > 0 && (
                <button
                  onClick={() => setActiveTypeFilter('chapter_review')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer tabular-nums ${
                    effectiveTypeFilter === 'chapter_review'
                      ? 'bg-white text-purple-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-[#0F2D52]'
                  }`}
                >
                  Cuối chương ({stats.chapterReview})
                </button>
              )}
              {stats.activity > 0 && (
                <button
                  onClick={() => setActiveTypeFilter('activity')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer tabular-nums ${
                    effectiveTypeFilter === 'activity'
                      ? 'bg-white text-amber-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-[#0F2D52]'
                  }`}
                >
                  Trải nghiệm ({stats.activity})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Results Count & Active Reset */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-600 px-1">
          <span className="tabular-nums">
            Hiển thị <strong className="text-[#0F2D52]">{filteredLectures.length}</strong> bài giảng phù hợp
          </span>
          {hasAnyActiveFilter && (
            <button
              onClick={handleResetAllFilters}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-[#1769C2] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        {/* Empty State */}
        {filteredLectures.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#CFDCED] p-10 sm:p-12 text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-[#0F2D52]">
              Không tìm thấy bài giảng phù hợp
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Không có học liệu nào khớp với bộ lọc hoặc từ khóa đang chọn. Hãy thử đặt lại bộ lọc để xem toàn bộ thư viện.
            </p>
            <button
              onClick={handleResetAllFilters}
              className="px-4 py-2 bg-[#EAF5FF] text-[#1769C2] text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLectures.map((item) => {
              const typeMeta = getItemTypeLabel(item.itemType);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#CFDCED] hover:border-[#1769C2] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Top Kicker: Course + Item Type */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 font-medium truncate">
                        {item.subjectName} {item.grade}
                        {item.volume ? ` · Tập ${item.volume}` : ''}
                      </span>
                      <span className={`font-bold shrink-0 ${typeMeta.colorClass}`}>
                        {typeMeta.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base sm:text-lg font-bold text-[#0F2D52] group-hover:text-[#1769C2] transition-colors leading-snug">
                      {item.lessonLabel}
                    </h3>

                    {/* Chapter / Subject Topic & Page info (helps distinguish duplicate titles like Luyện tập chung) */}
                    <div className="text-xs text-slate-600 space-y-1">
                      <p className="line-clamp-1 font-medium text-slate-700" title={item.chapterLabel}>
                        {item.chapterLabel}
                      </p>
                      {(item.bookSeries || item.sourcePage) && (
                        <p className="text-slate-500 italic">
                          {item.bookSeries ? item.bookSeries : ''}
                          {item.bookSeries && item.sourcePage ? ' · ' : ''}
                          {item.sourcePage ? `Trang ${item.sourcePage} SGK` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-400 truncate" title={item.id}>
                      {item.id}
                    </span>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => window.open(item.htmlUrl, '_blank')}
                        className="p-2 text-slate-500 hover:text-[#1769C2] hover:bg-[#EAF5FF] rounded-lg transition-colors cursor-pointer"
                        title="Mở trong tab riêng"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedLecture(item);
                          setVerification({ status: 'checking', message: 'Đang chuẩn bị học liệu...' });
                          setSolutionsExpanded(false);
                        }}
                        className="px-3.5 py-2 bg-[#1769C2] hover:bg-[#12549e] text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                      >
                        <Presentation className="w-3.5 h-3.5" />
                        <span>Mở bài giảng</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
