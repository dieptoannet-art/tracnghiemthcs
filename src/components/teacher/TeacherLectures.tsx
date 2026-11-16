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
  RotateCcw,
  Layers,
  PenLine,
  Bookmark,
  FlaskConical,
  FileText,
  Info,
  X
} from 'lucide-react';
import teacherLecturesData from '../../data/teacherLectureCatalog.json';
import {
  LectureHeroBookBadge3D,
  LectureHeroIllustration3D,
  LectureCardThumbnail3D
} from './teacherLectureThumbnails';

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
  const [expandedInfoIds, setExpandedInfoIds] = useState<Record<string, boolean>>({});

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

  // Full-library statistics (computed across all items in the library catalog)
  const libraryStats = useMemo(() => {
    let lesson = 0;
    let practice = 0;
    let chapterReview = 0;
    let activity = 0;
    lectures.forEach((item) => {
      if (item.itemType === 'lesson') lesson++;
      else if (item.itemType === 'practice') practice++;
      else if (item.itemType === 'chapter_review') chapterReview++;
      else if (item.itemType === 'activity') activity++;
    });
    return {
      total: lectures.length,
      lesson,
      practice,
      chapterReview,
      activity
    };
  }, [lectures]);

  // Dynamic statistics computed strictly from current dropdown + search scope (for type filter buttons)
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

  // Dynamic Book Series & Curriculum badge reflecting actual catalog / active scope
  const curriculumBadgeLabel = useMemo(() => {
    const sourceItems = itemsAfterVolume.length > 0 ? itemsAfterVolume : lectures;
    const seriesSet = new Set<string>();
    sourceItems.forEach((i) => {
      if (i.bookSeries) seriesSet.add(i.bookSeries);
    });
    const seriesText =
      seriesSet.size > 0
        ? Array.from(seriesSet).join(', ')
        : 'THCS Tây Đô';

    if (selectedSubject !== 'all' || selectedGrade !== 'all') {
      const matchedSubj = availableSubjects.find((s) => s.code === selectedSubject);
      const subjPart = selectedSubject !== 'all' ? (matchedSubj?.name || selectedSubject) : '';
      const gradePart = selectedGrade !== 'all' ? `Lớp ${selectedGrade}` : '';
      const volPart =
        showVolumeFilter && selectedVolume !== 'all'
          ? formatVolumeLabel(Number(selectedVolume))
          : '';
      const scopeParts = [subjPart, gradePart, volPart].filter(Boolean).join(' · ');
      return scopeParts ? `${scopeParts} · ${seriesText} • GDPT 2018` : `${seriesText} • GDPT 2018`;
    }

    return `${seriesText} • GDPT 2018`;
  }, [
    itemsAfterVolume,
    lectures,
    selectedSubject,
    selectedGrade,
    selectedVolume,
    availableSubjects,
    showVolumeFilter
  ]);

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

  const getItemTypeLabel = (type: string): { label: string; badgeClass: string } => {
    switch (type) {
      case 'lesson':
        return {
          label: 'Bài học',
          badgeClass: 'bg-[#E9F2FF] text-[#0866FF] border-[#CFE2FF]'
        };
      case 'practice':
        return {
          label: 'Luyện tập',
          badgeClass: 'bg-[#E7F9F0] text-[#0D7A54] border-[#BCEAD5]'
        };
      case 'chapter_review':
        return {
          label: 'Cuối chương',
          badgeClass: 'bg-[#F3EEFF] text-[#6D28D9] border-[#DFD1FE]'
        };
      case 'activity':
        return {
          label: 'Trải nghiệm',
          badgeClass: 'bg-[#FFF3E6] text-[#C25E00] border-[#FAD8B8]'
        };
      default:
        return {
          label: 'Học liệu',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
        };
    }
  };

  const toggleCardInfo = (id: string) => {
    setExpandedInfoIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // -------------------------------------------------------------
  // VIEW: PRESENTATION MODE (Trình chiếu giảng dạy)
  // -------------------------------------------------------------
  if (selectedLecture) {
    return (
      <div
        ref={containerRef}
        className={`flex flex-col bg-slate-900 text-slate-100 font-edtech ${
          isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : 'h-[calc(100vh-80px)] rounded-xl overflow-hidden border border-[#E2E8F0]'
        }`}
      >
        {/* Top Control Bar */}
        <div className="bg-[#102C54] border-b border-white/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0">
          {/* Left: Back & Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setSelectedLecture(null)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer"
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
                <CheckCircle2 className="w-4 h-4 text-[#12A879]" />
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
                className="bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/15 focus:outline-hidden focus:ring-1 focus:ring-[#1769F4] cursor-pointer max-w-[120px] sm:max-w-[160px] truncate"
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
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/15 text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Thay đổi cỡ chữ trình chiếu"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="font-mono font-bold tabular-nums text-[11px]">{fontSizePercent}%</span>
            </button>

            {/* Toggle Solutions */}
            <button
              onClick={handleToggleSolutions}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                solutionsExpanded
                  ? 'bg-[#FFCC33]/20 text-[#FFCC33] border border-[#FFCC33]/50'
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
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors shrink-0 cursor-pointer"
              title="Tải lại học liệu"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => window.open(selectedLecture.htmlUrl, '_blank')}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#1769F4] hover:bg-[#1255CC] text-white rounded-lg text-xs font-bold transition-all shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
              title="Mở bài giảng trong tab trình duyệt mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mở tab riêng</span>
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors shrink-0 cursor-pointer"
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
              className="underline hover:text-white font-bold whitespace-nowrap shrink-0 cursor-pointer"
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
    <div
      className="space-y-5 pb-10 text-[#102A52]"
      style={{ fontFamily: '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
    >
      {/* 1. BANNER THƯ VIỆN BÀI GIẢNG (ĐỒNG BỘ PHONG CÁCH KIẾN THỨC TRỌNG TÂM) */}
      <section
        aria-label="Giới thiệu Thư viện bài giảng"
        className="relative overflow-hidden rounded-[22px] border border-[#C6E0FF] bg-gradient-to-r from-[#DCEEFF] via-[#EAF5FF] to-[#D6ECFF] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_8px_24px_rgba(16,42,82,0.06)]"
      >
        <div className="pointer-events-none absolute -top-12 left-1/3 w-72 h-40 rounded-full bg-white/55 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-1/4 w-64 h-36 rounded-full bg-sky-200/45 blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Cột trái: Biểu tượng sách + Tiêu đề + Mô tả + Nhãn bộ sách + Thống kê toàn thư viện */}
          <div className="space-y-4 min-w-0 flex-1">
            <div className="flex items-start sm:items-center gap-4">
              <LectureHeroBookBadge3D />
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-[30px] font-extrabold text-[#102A52] tracking-tight leading-tight">
                  Thư viện bài giảng
                </h1>
                <p className="text-sm sm:text-[15px] text-[#526581] font-medium mt-1 leading-snug">
                  Học liệu trực quan • Sẵn sàng trình chiếu trên lớp
                </p>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/85 border border-[#BBD6FC] text-xs font-bold text-[#0866FF] mt-2">
                  {curriculumBadgeLabel}
                </div>
              </div>
            </div>

            {/* Thống kê toàn thư viện (tính trực tiếp từ nguồn dữ liệu thư viện) */}
            <div
              className="flex flex-wrap items-center gap-2 text-xs sm:text-[13px] tabular-nums"
              aria-label="Thống kê toàn thư viện học liệu"
            >
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#C7DCFA] text-[#102A52] font-bold shadow-2xs">
                <Layers className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                <span>{libraryStats.total.toLocaleString('vi-VN')} học liệu</span>
              </span>

              {libraryStats.lesson > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#C7DCFA] text-[#102A52] font-semibold shadow-2xs">
                  <BookOpen className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                  <span>{libraryStats.lesson.toLocaleString('vi-VN')} bài học</span>
                </span>
              )}

              {libraryStats.practice > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#C7DCFA] text-[#102A52] font-semibold shadow-2xs">
                  <PenLine className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                  <span>{libraryStats.practice.toLocaleString('vi-VN')} luyện tập</span>
                </span>
              )}

              {libraryStats.chapterReview > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#C7DCFA] text-[#102A52] font-semibold shadow-2xs">
                  <Bookmark className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                  <span>{libraryStats.chapterReview.toLocaleString('vi-VN')} cuối chương</span>
                </span>
              )}

              {libraryStats.activity > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#C7DCFA] text-[#102A52] font-semibold shadow-2xs">
                  <FlaskConical className="w-3.5 h-3.5 text-[#0866FF] shrink-0" aria-hidden="true" />
                  <span>{libraryStats.activity.toLocaleString('vi-VN')} trải nghiệm</span>
                </span>
              )}
            </div>
          </div>

          {/* Cột phải: Cụm minh họa 3D màn chiếu, sách mở, bút và khối hình học */}
          <div className="hidden md:flex items-center justify-end shrink-0 -my-1">
            <LectureHeroIllustration3D />
          </div>
        </div>
      </section>

      {/* 2. BỘ LỌC 2 HÀNG (KHỐI LỚP -> MÔN HỌC -> TẬP SÁCH -> CHƯƠNG/CHỦ ĐỀ -> BÀI GIẢNG) */}
      <section
        aria-label="Bộ lọc và tìm kiếm bài giảng"
        className="bg-white rounded-[20px] border border-[#D9E7FF] p-4 sm:p-5 shadow-[0_6px_20px_rgba(16,42,82,0.04)] space-y-4"
      >
        {/* Hàng 1: Đầy đủ 5 bộ lọc phân cấp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Khối lớp */}
          <div className="space-y-1.5">
            <label htmlFor="filter-grade" className="block text-xs font-bold text-[#102A52]">
              Khối lớp
            </label>
            <select
              id="filter-grade"
              value={selectedGrade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-[13px] font-semibold bg-[#F4F8FF] border border-[#CFE0FB] rounded-xl text-[#102A52] focus:bg-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF] cursor-pointer"
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
          <div className="space-y-1.5">
            <label htmlFor="filter-subject" className="block text-xs font-bold text-[#102A52]">
              Môn học
            </label>
            <select
              id="filter-subject"
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-[13px] font-semibold bg-[#F4F8FF] border border-[#CFE0FB] rounded-xl text-[#102A52] focus:bg-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF] cursor-pointer"
            >
              <option value="all">Tất cả môn</option>
              {availableSubjects.map((sub) => (
                <option key={sub.code} value={sub.code}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Tập sách */}
          <div className="space-y-1.5">
            <label htmlFor="filter-volume" className="block text-xs font-bold text-[#102A52]">
              Tập sách
            </label>
            <select
              id="filter-volume"
              value={showVolumeFilter ? selectedVolume : 'all'}
              disabled={!showVolumeFilter}
              onChange={(e) => handleVolumeChange(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-[13px] font-semibold bg-[#F4F8FF] border border-[#CFE0FB] rounded-xl text-[#102A52] focus:bg-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
            >
              {!showVolumeFilter ? (
                <option value="all">Trọn bộ</option>
              ) : (
                <>
                  <option value="all">Tất cả tập</option>
                  {availableVolumes.map((v) => (
                    <option key={v} value={String(v)}>
                      {formatVolumeLabel(v)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 4. Chương / Chủ đề */}
          <div className="space-y-1.5">
            <label htmlFor="filter-chapter" className="block text-xs font-bold text-[#102A52]">
              Chương / Chủ đề
            </label>
            <select
              id="filter-chapter"
              value={selectedChapter}
              onChange={(e) => handleChapterChange(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-[13px] font-semibold bg-[#F4F8FF] border border-[#CFE0FB] rounded-xl text-[#102A52] focus:bg-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF] cursor-pointer truncate"
            >
              <option value="all">Tất cả chương</option>
              {availableChapters.map((ch) => (
                <option key={ch.key} value={ch.key}>
                  {ch.label}
                  {ch.contextSuffix}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Bài giảng */}
          <div className="space-y-1.5">
            <label htmlFor="filter-lesson" className="block text-xs font-bold text-[#102A52]">
              Bài giảng
            </label>
            <select
              id="filter-lesson"
              value={selectedLessonId}
              onChange={(e) => handleLessonChange(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-[13px] font-semibold bg-[#F4F8FF] border border-[#CFE0FB] rounded-xl text-[#102A52] focus:bg-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF] cursor-pointer truncate"
            >
              <option value="all">Tất cả bài giảng</option>
              {itemsAfterChapter.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatLessonOptionLabel(item)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hàng 2: Ô tìm kiếm + Nhóm chọn loại học liệu */}
        <div className="pt-3.5 border-t border-[#EAF2FF] flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#526581] pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm tên bài, số bài hoặc mã bài"
              placeholder="Tìm tên bài, số bài hoặc mã bài..."
              className="w-full min-h-[44px] pl-10 pr-12 py-2 text-[13px] sm:text-sm bg-[#F4F8FF] border border-[#CFE0FB] rounded-full text-[#102A52] placeholder-[#526581]/80 font-medium focus:bg-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:border-[#0866FF]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-[#526581] hover:text-[#102A52] hover:bg-[#E4EEFF] cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Xóa</span>
              </button>
            )}
          </div>

          {/* Nhóm chọn loại học liệu (tự xuống dòng khi hẹp) */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo loại học liệu">
            {(stats.lesson > 0 || stats.practice > 0 || stats.chapterReview > 0 || stats.activity > 0 || stats.total > 0) && (
              <>
                <button
                  type="button"
                  aria-pressed={effectiveTypeFilter === 'all'}
                  onClick={() => setActiveTypeFilter('all')}
                  className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                    effectiveTypeFilter === 'all'
                      ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.24)]'
                      : 'bg-[#F4F8FF] text-[#334E73] border-[#D9E7FF] hover:bg-[#E7F0FF]'
                  }`}
                >
                  Tất cả ({stats.total.toLocaleString('vi-VN')})
                </button>

                {stats.lesson > 0 && (
                  <button
                    type="button"
                    aria-pressed={effectiveTypeFilter === 'lesson'}
                    onClick={() => setActiveTypeFilter('lesson')}
                    className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                      effectiveTypeFilter === 'lesson'
                        ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.24)]'
                        : 'bg-[#F4F8FF] text-[#334E73] border-[#D9E7FF] hover:bg-[#E7F0FF]'
                    }`}
                  >
                    Bài học ({stats.lesson.toLocaleString('vi-VN')})
                  </button>
                )}

                {stats.practice > 0 && (
                  <button
                    type="button"
                    aria-pressed={effectiveTypeFilter === 'practice'}
                    onClick={() => setActiveTypeFilter('practice')}
                    className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                      effectiveTypeFilter === 'practice'
                        ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.24)]'
                        : 'bg-[#F4F8FF] text-[#334E73] border-[#D9E7FF] hover:bg-[#E7F0FF]'
                    }`}
                  >
                    Luyện tập ({stats.practice.toLocaleString('vi-VN')})
                  </button>
                )}

                {stats.chapterReview > 0 && (
                  <button
                    type="button"
                    aria-pressed={effectiveTypeFilter === 'chapter_review'}
                    onClick={() => setActiveTypeFilter('chapter_review')}
                    className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                      effectiveTypeFilter === 'chapter_review'
                        ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.24)]'
                        : 'bg-[#F4F8FF] text-[#334E73] border-[#D9E7FF] hover:bg-[#E7F0FF]'
                    }`}
                  >
                    Cuối chương ({stats.chapterReview.toLocaleString('vi-VN')})
                  </button>
                )}

                {stats.activity > 0 && (
                  <button
                    type="button"
                    aria-pressed={effectiveTypeFilter === 'activity'}
                    onClick={() => setActiveTypeFilter('activity')}
                    className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0 cursor-pointer tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] ${
                      effectiveTypeFilter === 'activity'
                        ? 'bg-[#0866FF] text-white border-[#0866FF] shadow-[0_4px_12px_rgba(8,102,255,0.24)]'
                        : 'bg-[#F4F8FF] text-[#334E73] border-[#D9E7FF] hover:bg-[#E7F0FF]'
                    }`}
                  >
                    Trải nghiệm ({stats.activity.toLocaleString('vi-VN')})
                  </button>
                )}
              </>
            )}

            {hasAnyActiveFilter && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. KHU VỰC KẾT QUẢ & LƯỚI THẺ BÀI GIẢNG */}
      <section aria-labelledby="lecture-results-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#EAF2FF] border border-[#CFE2FF] text-[#0866FF] flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
            </span>
            <h2
              id="lecture-results-heading"
              className="text-lg sm:text-xl font-extrabold text-[#102A52] tracking-tight"
            >
              Khám phá bài giảng
            </h2>
            <span className="text-[#CBD5E1] font-light" aria-hidden="true">
              |
            </span>
            <span className="text-sm text-[#526581] font-semibold tabular-nums">
              <strong className="text-[#102A52] font-extrabold">
                {filteredLectures.length.toLocaleString('vi-VN')}
              </strong>{' '}
              học liệu phù hợp
            </span>
          </div>

          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0866FF] hover:underline whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] rounded-lg px-2 py-1"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        {/* Trạng thái không tìm thấy */}
        {filteredLectures.length === 0 ? (
          <div
            role="status"
            className="bg-white rounded-[22px] border border-[#D9E7FF] p-10 sm:p-12 text-center shadow-[0_6px_20px_rgba(16,42,82,0.04)] space-y-3.5"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#EAF2FF] text-[#0866FF] flex items-center justify-center mx-auto">
              <BookOpen className="w-7 h-7" aria-hidden="true" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#102A52]">
              Không tìm thấy bài giảng phù hợp
            </h3>
            <p className="text-sm text-[#526581] max-w-md mx-auto leading-relaxed">
              Không có học liệu nào khớp với bộ lọc hoặc từ khóa đang chọn. Hãy thử điều chỉnh bộ lọc hoặc đặt lại để xem toàn bộ thư viện.
            </p>
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2 bg-[#0866FF] hover:bg-[#0055E0] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-2"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Xóa bộ lọc</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredLectures.map((item) => {
              const typeMeta = getItemTypeLabel(item.itemType);
              const isInfoOpen = Boolean(expandedInfoIds[item.id]);

              return (
                <article
                  key={item.id}
                  className="bg-white rounded-[20px] border border-[#D9E7FF] hover:border-[#7BB2FF] p-3.5 sm:p-4 shadow-[0_6px_20px_rgba(16,42,82,0.05)] hover:shadow-[0_12px_28px_rgba(8,102,255,0.11)] transition-all flex flex-col justify-between gap-3.5"
                >
                  {/* A. Thumbnail 3D theo nội dung bài học */}
                  <div className="space-y-3">
                    <LectureCardThumbnail3D item={item} />

                    {/* B. Thông tin bài giảng */}
                    <div className="px-1 space-y-2">
                      {/* Dòng phụ: Môn + Khối + Tập & Nhãn loại học liệu */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#526581] font-semibold truncate">
                          {item.subjectName} {item.grade}
                          {item.volume ? ` · Tập ${item.volume}` : ''}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${typeMeta.badgeClass}`}
                        >
                          {typeMeta.label}
                        </span>
                      </div>

                      {/* Tên bài học đầy đủ (xuống dòng tự nhiên, không cắt mất chữ quan trọng) */}
                      <h3 className="text-[16px] sm:text-[17px] font-extrabold text-[#102A52] leading-snug break-words">
                        {item.lessonLabel}
                      </h3>

                      {/* Chương / Chủ đề & Trang SGK / Bộ sách */}
                      <div className="space-y-1 text-xs text-[#526581]">
                        {item.chapterLabel && (
                          <p className="flex items-start gap-1.5 font-medium leading-snug">
                            <BookOpen className="w-3.5 h-3.5 text-[#526581] shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="break-words">{item.chapterLabel}</span>
                          </p>
                        )}
                        {(item.sourcePage || item.bookSeries) && (
                          <p className="flex items-start gap-1.5 font-medium leading-snug">
                            <FileText className="w-3.5 h-3.5 text-[#526581] shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="break-words">
                              {item.sourcePage ? `Trang ${item.sourcePage} SGK` : ''}
                              {item.sourcePage && item.bookSeries ? ' · ' : ''}
                              {item.bookSeries || ''}
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Ngăn mở rộng Thông tin bài giảng (mở/đóng bằng chuột, bàn phím, cảm ứng) */}
                      {isInfoOpen && (
                        <div
                          id={`lecture-info-${item.id}`}
                          className="mt-2 p-2.5 rounded-xl bg-[#F4F8FF] border border-[#D9E7FF] text-[11px] text-[#334E73] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#526581]">Mã học liệu:</span>
                            <code className="font-mono font-bold text-[#102A52] break-all">{item.id}</code>
                          </div>
                          {item.lessonCode && item.lessonCode !== item.id && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#526581]">Mã bài:</span>
                              <code className="font-mono font-bold text-[#102A52]">{item.lessonCode}</code>
                            </div>
                          )}
                          {item.lectureId && item.lectureId !== item.id && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#526581]">Mã trình chiếu:</span>
                              <code className="font-mono font-bold text-[#102A52]">{item.lectureId}</code>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* C & D. Hành động cuối thẻ & nút Thông tin bài giảng */}
                  <div className="pt-3 border-t border-[#EAF2FF] px-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCardInfo(item.id)}
                      aria-expanded={isInfoOpen}
                      aria-controls={`lecture-info-${item.id}`}
                      aria-label={`Thông tin bài giảng ${item.lessonLabel}`}
                      title={`Thông tin bài giảng (${item.id})`}
                      className={`inline-flex items-center gap-1 min-h-[38px] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] min-w-0 ${
                        isInfoOpen
                          ? 'bg-[#EAF2FF] text-[#0866FF]'
                          : 'text-[#526581] hover:text-[#102A52] hover:bg-[#F4F8FF]'
                      }`}
                    >
                      <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate font-mono">{item.id}</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => window.open(item.htmlUrl, '_blank')}
                        aria-label={`Mở ${item.lessonLabel} trong tab riêng`}
                        title="Mở trong tab riêng"
                        className="min-w-[44px] min-h-[44px] rounded-xl border border-[#D9E7FF] bg-[#F4F8FF] text-[#334E73] hover:text-[#0866FF] hover:bg-[#EAF2FF] hover:border-[#94BDFF] flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF]"
                      >
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLecture(item);
                          setVerification({ status: 'checking', message: 'Đang chuẩn bị học liệu...' });
                          setSolutionsExpanded(false);
                        }}
                        className="min-h-[44px] px-4 py-2 bg-[#0866FF] hover:bg-[#0055E0] text-white text-xs sm:text-[13px] font-bold rounded-xl shadow-[0_6px_16px_rgba(8,102,255,0.24)] transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0866FF] focus-visible:ring-offset-1"
                      >
                        <Presentation className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Mở bài giảng</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
