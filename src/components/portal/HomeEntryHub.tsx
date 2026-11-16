import React from 'react';
import {
  Compass,
  Award,
  Lock,
  ArrowRight,
  Gamepad2,
  FlaskConical,
  BookOpen,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Users,
  Presentation,
  EyeOff,
  Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import smartHubHeroImg from '../../assets/images/smart_hub_hero_1794796357208.jpg';

export const HomeEntryHub: React.FC = () => {
  const {
    enterPublicGuest,
    enterDemoRole,
    enterKhktShowcase,
    exitDemoToWorkspace,
    authenticatedProdUser,
    authenticatedProdProfile,
    authenticatedProdRole,
    openCoreKnowledgeLesson,
    setPreferredDemoAssignmentId,
    setCurrentView,
    reducedMotion,
    setReducedMotion,
  } = useApp();

  const handleQuickDemoExam = () => {
    enterDemoRole('student');
    setPreferredDemoAssignmentId('demo-asg-tin6-b1');
    setCurrentView('student_assignments');
  };

  const handleQuickGame50 = () => {
    enterDemoRole('teacher', 'teacher_student_call');
  };

  const handleQuickMathLab = () => {
    enterPublicGuest();
    setCurrentView('math_lab');
  };

  const handleQuickTin6 = () => {
    enterPublicGuest();
    openCoreKnowledgeLesson('tin_6_cd1_b1');
  };

  return (
    <div className="min-h-screen bg-[#F6F9FD] text-[#102C54] font-edtech flex flex-col">
      {/* Compact Hub Header */}
      <header className="bg-white/95 backdrop-blur-xs border-b border-[#E2E8F0] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1769F4] text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-extrabold tracking-tight text-[#102C54]">
                TÂY ĐÔ SMART EDU
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                Hệ sinh thái Giáo dục Số &amp; Khám phá KHKT · THCS Tây Đô
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setReducedMotion(!reducedMotion)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                reducedMotion
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Bật/tắt chế độ giảm chuyển động cho trình chiếu ổn định"
            >
              {reducedMotion ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{reducedMotion ? 'Đã giảm hiệu ứng' : 'Giảm hiệu ứng'}</span>
            </button>

            {authenticatedProdUser ? (
              <button
                type="button"
                onClick={() => exitDemoToWorkspace('dashboard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#102C54] hover:bg-[#153766] text-white text-xs font-bold whitespace-nowrap shrink-0 shadow-xs transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Vào Workspace ({authenticatedProdProfile?.fullName || authenticatedProdRole})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentView('login_portal')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#1255CC] text-white text-xs font-bold whitespace-nowrap shrink-0 shadow-xs transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Đăng nhập làm việc</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 space-y-8">
        {/* Hero Overview */}
        <section className="bg-white rounded-3xl border border-[#E2E8F0] shadow-[0_12px_36px_rgba(12,45,94,0.06)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#EAF3FF] border border-[#C7DCFA] text-[#1769F4] text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>KHÔNG CẦN ĐĂNG NHẬP ĐỂ TRẢI NGHIỆM · BẢO TOÀN HỆ THỐNG THẬT</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-[#102C54] leading-tight tracking-tight">
                Nền tảng Dạy học Tương tác, Phòng thí nghiệm Toán &amp; Trò chơi Lớp học 50 HS
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                Khách tham quan và Ban Giám khảo KHKT có thể trực tiếp mở học liệu Tin học &amp; Toán THCS, điều khiển phòng thí nghiệm Toán học động M01–M17, tổ chức Đua vịt 3D cho lớp 50 học sinh mẫu và làm bài kiểm tra tự động chấm điểm ngay tại trình duyệt mà không tác động tới dữ liệu trường học thật.
              </p>

              {/* Verified Quantitative Facts Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="bg-[#F6F9FD] border border-[#E2E8F0] rounded-xl p-3">
                  <div className="text-lg font-extrabold font-mono-num tabular-nums text-[#1769F4]">18 / 50</div>
                  <div className="text-[11px] font-semibold text-slate-600">Game 3D &amp; tương tác sẵn sàng</div>
                </div>
                <div className="bg-[#F6F9FD] border border-[#E2E8F0] rounded-xl p-3">
                  <div className="text-lg font-extrabold font-mono-num tabular-nums text-teal-700">17 / 17</div>
                  <div className="text-[11px] font-semibold text-slate-600">Chuyên đề Math Lab M01–M17</div>
                </div>
                <div className="bg-[#F6F9FD] border border-[#E2E8F0] rounded-xl p-3">
                  <div className="text-lg font-extrabold font-mono-num tabular-nums text-indigo-700">553</div>
                  <div className="text-[11px] font-semibold text-slate-600">Bài học GDPT 2018 (Lớp 6–9)</div>
                </div>
                <div className="bg-[#F6F9FD] border border-[#E2E8F0] rounded-xl p-3">
                  <div className="text-lg font-extrabold font-mono-num tabular-nums text-amber-700">50 HS</div>
                  <div className="text-[11px] font-semibold text-slate-600">Lớp 8A1 Demo chuẩn bị sẵn</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 h-full bg-[#EAF3FF] p-4 sm:p-6 flex items-center justify-center">
              <div className="w-full overflow-hidden rounded-2xl border border-[#C7DCFA] shadow-md bg-white">
                <img
                  src={smartHubHeroImg}
                  alt="Minh họa hệ sinh thái học tập tương tác Tây Đô Smart EDU"
                  referrerPolicy="no-referrer"
                  className="w-full h-56 sm:h-72 object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3 Primary Action Portals */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#102C54]">
                Chọn không gian làm việc &amp; khám phá
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Tách biệt hoàn toàn giữa Cổng Trải nghiệm Công khai / KHKT Showcase (Sandbox) và Không gian Làm việc Chính thức (Supabase RLS).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. TRẢI NGHIỆM SMART EDU */}
            <div className="bg-white rounded-2xl border-2 border-[#1769F4]/25 hover:border-[#1769F4] shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF3FF] text-[#1769F4] flex items-center justify-center">
                    <Compass className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Vào ngay · Không cần đăng nhập
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#102C54]">
                    1. TRẢI NGHIỆM SMART EDU
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    Dùng thử đầy đủ Trò chơi lớp học 50 HS, Phòng thí nghiệm Toán M01–M17, Bài học Tin học 6, Làm bài &amp; chấm điểm tự động và vai trò Giáo viên Demo trong Sandbox độc lập.
                  </p>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1769F4] shrink-0" />
                    <span>Chuyển đổi linh hoạt Khách / GV Demo / HS Demo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1769F4] shrink-0" />
                    <span>Cô lập hoàn toàn khỏi CSDL trường học</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={enterPublicGuest}
                  className="w-full py-3 px-4 rounded-xl bg-[#1769F4] hover:bg-[#1255CC] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <span>Mở Cổng Trải nghiệm (/explore)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => enterDemoRole('teacher', 'teacher_classes')}
                    className="py-2 px-2.5 rounded-lg bg-[#F6F9FD] hover:bg-[#E4F0FF] text-[#1769F4] text-xs font-bold border border-[#C7DCFA] cursor-pointer"
                  >
                    GV Demo (50 HS)
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickDemoExam}
                    className="py-2 px-2.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200 cursor-pointer"
                  >
                    Làm Đề Tin 6 (Demo)
                  </button>
                </div>
              </div>
            </div>

            {/* 2. KHÁM PHÁ SẢN PHẨM KHKT */}
            <div className="bg-white rounded-2xl border-2 border-indigo-200 hover:border-indigo-500 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <Award className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Cuộc thi KHKT 2027
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#102C54]">
                    2. KHÁM PHÁ SẢN PHẨM KHKT
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    Không gian giới thiệu đề tài, điểm mới sáng tạo, kiến trúc kỹ thuật và Chế độ Trình diễn 6 bước tương tác trực tiếp dành cho Ban Giám khảo.
                  </p>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Trình diễn 6 bước có liên kết sản phẩm chạy thật</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Minh bạch hoàn toàn thông tin &amp; minh chứng thực nghiệm</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => enterKhktShowcase(true)}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Presentation className="w-4 h-4" />
                  <span>Trình diễn 6 bước (BGK)</span>
                </button>
                <button
                  type="button"
                  onClick={() => enterKhktShowcase(false)}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 cursor-pointer"
                >
                  Xem Hồ sơ KHKT (/khkt)
                </button>
              </div>
            </div>

            {/* 3. ĐĂNG NHẬP LÀM VIỆC */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-slate-500 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#102C54] flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-300">
                    Supabase Auth &amp; RLS
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#102C54]">
                    3. ĐĂNG NHẬP LÀM VIỆC
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    Cổng làm việc chính thức cho Giáo viên, Học sinh và Quản trị viên Trường THCS Tây Đô với phân quyền xác thực từ cơ sở dữ liệu.
                  </p>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Học sinh đăng nhập bằng Mã học sinh</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Giáo viên / Quản trị viên bằng Email được cấp</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                {authenticatedProdUser ? (
                  <button
                    type="button"
                    onClick={() => exitDemoToWorkspace('dashboard')}
                    className="w-full py-3 px-4 rounded-xl bg-[#102C54] hover:bg-[#153766] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Tiếp tục Không gian Chính thức</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentView('login_portal')}
                    className="w-full py-3 px-4 rounded-xl bg-[#102C54] hover:bg-[#153766] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Đăng nhập Hệ thống (/login)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentView('login_portal')}
                  className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer"
                >
                  {authenticatedProdUser ? 'Quản lý phiên đăng nhập' : 'Đăng ký Học sinh mới'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Direct Live Launchers Strip */}
        <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-[#102C54]">
                Truy cập nhanh tính năng trọng tâm (Chế độ Trải nghiệm ngay)
              </h3>
              <p className="text-xs text-slate-500">
                Nhấp để mở trực tiếp từng phân hệ đang hoạt động với dữ liệu mẫu 50 học sinh.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
              <Users className="w-3.5 h-3.5 text-[#1769F4]" />
              <span>URL gọi tên giữ nguyên: <code>?view=teacher_student_call</code></span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={handleQuickGame50}
              className="text-left p-4 rounded-xl bg-[#F6F9FD] hover:bg-[#EAF3FF] border border-[#C7DCFA] transition-colors cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between text-[#1769F4]">
                <Gamepad2 className="w-5 h-5" />
                <span className="text-[10px] font-extrabold uppercase">A01–F05</span>
              </div>
              <div className="text-sm font-bold text-[#102C54]">Đua vịt 3D &amp; Gọi tên 50 HS</div>
              <div className="text-[11px] text-slate-600">Mở EDU Game Center với lớp 8A1 (50 HS)</div>
            </button>

            <button
              type="button"
              onClick={handleQuickMathLab}
              className="text-left p-4 rounded-xl bg-teal-50/60 hover:bg-teal-50 border border-teal-200 transition-colors cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between text-teal-700">
                <FlaskConical className="w-5 h-5" />
                <span className="text-[10px] font-extrabold uppercase">M01–M17</span>
              </div>
              <div className="text-sm font-bold text-[#102C54]">Smart Math Lab 2D/3D</div>
              <div className="text-[11px] text-slate-600">Bao gồm M15 Định lý Pythagore &amp; Hình 3D</div>
            </button>

            <button
              type="button"
              onClick={handleQuickTin6}
              className="text-left p-4 rounded-xl bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-200 transition-colors cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between text-indigo-700">
                <BookOpen className="w-5 h-5" />
                <span className="text-[10px] font-extrabold uppercase">Lớp 6 · Bài 1</span>
              </div>
              <div className="text-sm font-bold text-[#102C54]">Tin học 6: Thông tin &amp; Dữ liệu</div>
              <div className="text-[11px] text-slate-600">Mở thẳng bài giảng HTML tương tác</div>
            </button>

            <button
              type="button"
              onClick={handleQuickDemoExam}
              className="text-left p-4 rounded-xl bg-amber-50/70 hover:bg-amber-50 border border-amber-200 transition-colors cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between text-amber-700">
                <ClipboardCheck className="w-5 h-5" />
                <span className="text-[10px] font-extrabold uppercase">Auto-Grade</span>
              </div>
              <div className="text-sm font-bold text-[#102C54]">Làm Đề kiểm tra Demo</div>
              <div className="text-[11px] text-slate-600">Thi thử &amp; chấm điểm tức thì trong Sandbox</div>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
