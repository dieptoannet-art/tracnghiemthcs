import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Users,
  Gamepad2,
  FlaskConical,
  BookOpen,
  ClipboardCheck,
  Briefcase,
  RotateCcw,
  Maximize2,
  Minimize2,
  Presentation,
  ArrowRight,
  Play,
  ShieldCheck,
  Search,
  Home,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EDU_GAMES_CATALOG } from '../../data/eduGameCatalog';
import { SMART_MATH_LAB_REGISTRY } from '../math-lab/MathLabRegistry';

export const PublicGuestPortal: React.FC = () => {
  const {
    accessMode,
    enterPublicGuest,
    enterDemoRole,
    enterKhktShowcase,
    resetDemoSandbox,
    classes,
    assignments,
    submissions,
    openCoreKnowledgeLesson,
    setPreferredDemoAssignmentId,
    setCurrentView,
    exitDemoToWorkspace,
    authenticatedProdUser,
  } = useApp();

  const [gameSearch, setGameSearch] = useState('');
  const [gameStatusFilter, setGameStatusFilter] = useState<'all' | 'ready' | 'upcoming'>('ready');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(false);

  const primary50Class = useMemo(
    () => classes.find((c) => c.id === 'demo-cls-8a1') || classes[0],
    [classes]
  );

  const readyGamesCount = useMemo(
    () => EDU_GAMES_CATALOG.filter((g) => g.isReady).length,
    []
  );

  const filteredGames = useMemo(() => {
    const q = gameSearch.trim().toLowerCase();
    return EDU_GAMES_CATALOG.filter((g) => {
      if (gameStatusFilter === 'ready' && !g.isReady) return false;
      if (gameStatusFilter === 'upcoming' && g.isReady) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q)
      );
    }).slice(0, 12);
  }, [gameSearch, gameStatusFilter]);

  const handleToggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  const handleResetDemo = () => {
    resetDemoSandbox();
    setResetFeedback(true);
    window.setTimeout(() => setResetFeedback(false), 2500);
  };

  const launchDemoExam = (asgId: string) => {
    enterDemoRole('student');
    setPreferredDemoAssignmentId(asgId);
    setCurrentView('student_assignments');
  };

  const launchDemoTeacherFeature = (targetView: string) => {
    enterDemoRole('teacher', targetView);
  };

  return (
    <div className="space-y-6 font-edtech pb-8">
      {/* Top Role Switcher & Control Deck */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#EAF3FF] text-[#1769F4] text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>CỔNG TRẢI NGHIỆM CÔNG KHAI · SANDBOX 50 HỌC SINH</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#102C54]">
              Trải nghiệm Smart EDU không cần đăng nhập
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              Chuyển đổi tự do giữa 3 vai trò mô phỏng (Khách, Giáo viên Demo 50 HS, Học sinh Demo). Mọi thao tác được lưu cục bộ trong Sandbox và không tác động tới dữ liệu Supabase chính thức.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => enterKhktShowcase(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
            >
              <Presentation className="w-4 h-4" />
              <span>Trình diễn KHKT (6 bước)</span>
            </button>
            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap shrink-0 border border-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{resetFeedback ? 'Đã đặt lại Demo!' : 'Đặt lại Demo'}</span>
            </button>
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold whitespace-nowrap shrink-0 border border-slate-200 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#102C54] text-xs font-bold whitespace-nowrap shrink-0 border border-slate-200 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Trang chủ</span>
            </button>
          </div>
        </div>

        {/* Role Selector */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1">Vai trò đang xem:</span>
            <button
              type="button"
              onClick={enterPublicGuest}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                accessMode === 'PUBLIC_GUEST'
                  ? 'bg-[#1769F4] text-white border-[#1769F4] shadow-2xs'
                  : 'bg-[#F6F9FD] text-[#102C54] border-[#C7DCFA] hover:bg-[#EAF3FF]'
              }`}
            >
              Khách trải nghiệm (Public Guest)
            </button>
            <button
              type="button"
              onClick={() => enterDemoRole('teacher')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 tabular-nums transition-all cursor-pointer ${
                accessMode === 'DEMO_TEACHER'
                  ? 'bg-[#12A879] text-white border-[#12A879] shadow-2xs'
                  : 'bg-[#ECFDF7] text-[#0B6E4F] border-[#12A879]/30 hover:bg-emerald-100'
              }`}
            >
              Giáo viên Demo ({primary50Class?.students?.length || 50} HS)
            </button>
            <button
              type="button"
              onClick={() => enterDemoRole('student')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                accessMode === 'DEMO_STUDENT'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
            >
              Học sinh Demo (DM8001)
            </button>
          </div>

          <button
            type="button"
            onClick={() => exitDemoToWorkspace('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769F4] hover:underline cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {authenticatedProdUser ? 'Quay về Không gian Làm việc Thật' : 'Đăng nhập Tài khoản Chính thức'}
            </span>
          </button>
        </div>
      </section>

      {/* Pillar 1 & 2: Quick Interactive Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Tin học 6 Bài 1 + Core Knowledge + Sample Exams */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-2xs flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#102C54]">
                  Bài học Tin học 6 &amp; Đề kiểm tra Mẫu
                </h2>
                <p className="text-xs text-slate-500">
                  Mở thẳng học liệu HTML5 GDPT 2018 &amp; chấm điểm tức thì
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F6F9FD] border border-[#C7DCFA] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  Tin học 6 · Chủ đề 1 · Bài 1
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">✓ Sẵn sàng</span>
              </div>
              <h3 className="text-sm font-extrabold text-[#102C54]">
                Bài 1: Thông tin và dữ liệu (Tương tác trực tiếp)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nhúng nguyên bản từ kho học liệu chính thức <code>/lessons/lop-6/tin-hoc/chu-de-01/bai-01/index.html</code>.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openCoreKnowledgeLesson('tin_6_cd1_b1')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Mở ngay Tin học 6 – Bài 1</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('student_core_knowledge')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#102C54] text-xs font-bold border border-slate-200 cursor-pointer"
                >
                  <span>Duyệt 553 bài học (Lớp 6–9)</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Làm Đề Kiểm tra &amp; Tự động Chấm điểm ({assignments.length} bài giao Demo)</span>
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => launchDemoExam('demo-asg-tin6-b1')}
                  className="w-full text-left p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-[#102C54]">
                      Kiểm tra Tin học 6 – Bài 1: Thông tin và dữ liệu
                    </div>
                    <div className="text-[11px] text-slate-600">15 phút · Tự động chấm điểm tức thì</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-700 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => launchDemoExam('demo-asg-math8-demo')}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-[#102C54]">
                      Đề minh họa Toán 8 – Đa thức &amp; Hình học
                    </div>
                    <div className="text-[11px] text-slate-600">
                      30 phút · Lớp 8A1 (50 HS Demo) · {submissions.length} lượt nộp mẫu
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentView('student_results')}
            className="w-full py-2.5 px-3 rounded-xl bg-[#F6F9FD] hover:bg-[#E4F0FF] text-[#1769F4] text-xs font-bold border border-[#C7DCFA] cursor-pointer"
          >
            Xem Bảng Kết quả &amp; Tiến bộ Học sinh Demo
          </button>
        </section>

        {/* Smart Math Lab M01-M17 */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-2xs flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#102C54]">
                    Smart Math Lab — 17 Phòng thí nghiệm Toán (M01–M17)
                  </h2>
                  <p className="text-xs text-slate-500">
                    M01–M17 hoạt động đầy đủ với tương tác tham số · M18–M24 chưa triển khai
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('math_lab')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs cursor-pointer shrink-0"
              >
                <span>Mở Toàn bộ Math Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SMART_MATH_LAB_REGISTRY.filter((m) =>
                ['M15', 'M08', 'M03', 'M01', 'M10', 'M17'].includes(m.id)
              ).map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setCurrentView('math_lab')}
                  className="text-left p-3.5 rounded-xl bg-[#F6F9FD] hover:bg-teal-50/70 border border-[#E2E8F0] hover:border-teal-300 transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold font-mono-num text-teal-700">
                      {mod.id} · Lớp {mod.grades.join(', ')}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Sẵn sàng
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-[#102C54]">{mod.nameVi}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-2">{mod.shortDescription}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between gap-2">
            <span>
              Tất cả <strong>17 chuyên đề (M01–M17)</strong> trong hệ thống đều có sẵn mô hình trực quan, bảng số liệu và chế độ trình chiếu.
            </span>
            <span className="font-mono-num font-bold text-slate-700 shrink-0">M01–M17</span>
          </div>
        </section>
      </div>

      {/* Pillar 3: EDU Games 50 HS Showcase */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#EAF3FF] text-[#1769F4] flex items-center justify-center shrink-0">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#102C54]">
                Thư viện Trò chơi Giáo dục (50 mã danh mục · {readyGamesCount} trò chơi sẵn sàng)
              </h2>
              <p className="text-xs text-slate-500">
                Nạp sẵn lớp mẫu <strong>{primary50Class?.name || '8A1 (Demo 50 HS)'}</strong> ({primary50Class?.students?.length || 50} học sinh) để thử ngay Đua vịt 3D (A05) hoặc Vòng quay 3D (A01).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentView('teacher_student_call')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#1255CC] text-white text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Mở EDU Game Center (?view=teacher_student_call)</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F6F9FD] p-3 rounded-xl border border-[#E2E8F0]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={gameSearch}
              onChange={(e) => setGameSearch(e.target.value)}
              placeholder="Tìm trò chơi theo mã (A05, B01...) hoặc tên..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1769F4]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setGameStatusFilter('ready')}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                gameStatusFilter === 'ready'
                  ? 'bg-[#1769F4] text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              Sẵn sàng ({readyGamesCount})
            </button>
            <button
              type="button"
              onClick={() => setGameStatusFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                gameStatusFilter === 'upcoming'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              Đang phát triển ({EDU_GAMES_CATALOG.length - readyGamesCount})
            </button>
            <button
              type="button"
              onClick={() => setGameStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                gameStatusFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              Tất cả ({EDU_GAMES_CATALOG.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredGames.map((g) => (
            <div
              key={g.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                g.isReady
                  ? 'bg-white border-[#C7DCFA]'
                  : 'bg-slate-50 border-slate-200 opacity-85'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold font-mono-num text-[#1769F4]">
                    {g.code}
                  </span>
                  {g.isReady ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      Sẵn sàng
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                      <Clock className="w-3 h-3" />
                      Đang phát triển
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-[#102C54]">{g.title}</div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{g.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('teacher_student_call')}
                className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-bold cursor-pointer ${
                  g.isReady
                    ? 'bg-[#EAF3FF] hover:bg-[#D7E8FF] text-[#1769F4]'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {g.isReady ? 'Mở trong Game Center' : 'Xem thông tin danh mục'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Pillar 4: Simulated Teacher Workflows (50 Demo Students) */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#102C54]">
                Nghiệp vụ Giáo viên Mô phỏng (Giáo viên Demo · 50 HS Sandbox)
              </h2>
              <p className="text-xs text-slate-500">
                Thử toàn bộ quy trình quản lý lớp 50 học sinh, soạn ma trận, tạo đề &amp; chấm bài mà không ghi vào Supabase.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Users className="w-3.5 h-3.5" />
            <span>{primary50Class?.students?.length || 50} học sinh lớp 8A1 Demo</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { view: 'teacher_classes', label: 'Quản lý Lớp 50 HS', desc: 'Xem 50 học sinh mẫu DM8001–DM8050 & thêm HS thử' },
            { view: 'teacher_matrix', label: 'Ma trận & Đặc tả', desc: 'Thiết lập tỷ lệ 40/30/30 chuẩn CV 7991' },
            { view: 'teacher_create_exam', label: 'Tạo đề & Giao bài', desc: 'Sinh đề mới & giao thử vào lớp Sandbox' },
            { view: 'teacher_grading', label: 'Chấm bài & Thống kê', desc: 'Xem phổ điểm & chấm câu tự luận mẫu' },
            { view: 'teacher_question_bank', label: 'Ngân hàng Câu hỏi', desc: 'Duyệt & tìm câu hỏi Toán / Tin học' },
          ].map((item) => (
            <button
              key={item.view}
              type="button"
              onClick={() => launchDemoTeacherFeature(item.view)}
              className="text-left p-3.5 rounded-xl bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer space-y-1"
            >
              <div className="text-xs font-extrabold text-emerald-900">{item.label}</div>
              <div className="text-[11px] text-slate-600 leading-snug">{item.desc}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
