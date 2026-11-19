import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  RotateCcw,
  LogIn,
  CheckCircle2,
  GraduationCap,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const KhktDemoBanner: React.FC = () => {
  const {
    isDemoSandbox,
    demoRole,
    setDemoRole,
    resetDemoSandbox,
    exitDemoToRealLogin,
  } = useApp();

  const [justReset, setJustReset] = useState(false);

  useEffect(() => {
    if (!justReset) return;
    const timer = window.setTimeout(() => setJustReset(false), 3500);
    return () => window.clearTimeout(timer);
  }, [justReset]);

  if (!isDemoSandbox) return null;

  const handleReset = () => {
    resetDemoSandbox();
    setJustReset(true);
  };

  return (
    <div
      role="region"
      aria-label="Thanh điều khiển Bản demo KHKT"
      className="bg-gradient-to-r from-[#0F2D52] via-[#143D70] to-[#0F2D52] text-white border-b border-amber-400/35 px-3 sm:px-6 py-2 shadow-sm font-edtech"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Prominent KHKT Demo Badge + Isolation notice */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400 text-[#0F2D52] text-xs font-extrabold tracking-wide shadow-xs shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bản demo KHKT</span>
          </span>
          <span className="text-xs text-blue-100/95 font-medium truncate">
            Chế độ khách tự động · Dữ liệu mẫu tách biệt, lưu tiến độ riêng trên trình duyệt này
          </span>
          {justReset && (
            <span
              role="status"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-xs font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã đặt lại bản demo</span>
            </span>
          )}
        </div>

        {/* Right: Role perspective switcher + Reset Demo + Real Login */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="inline-flex items-center bg-white/10 border border-white/15 rounded-xl p-0.5"
            role="group"
            aria-label="Chuyển góc nhìn trải nghiệm demo"
          >
            <button
              type="button"
              onClick={() => setDemoRole('teacher')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                demoRole === 'teacher'
                  ? 'bg-white text-[#0F2D52] shadow-xs'
                  : 'text-blue-100 hover:text-white'
              }`}
              title="Trải nghiệm cả công cụ Giáo viên (dữ liệu mẫu) và Học sinh"
            >
              <Users className="w-3 h-3" />
              <span>GV &amp; HS (Mẫu)</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('student')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                demoRole === 'student'
                  ? 'bg-white text-[#0F2D52] shadow-xs'
                  : 'text-blue-100 hover:text-white'
              }`}
              title="Xem thuần góc nhìn Học sinh"
            >
              <GraduationCap className="w-3 h-3" />
              <span>Học sinh</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/12 hover:bg-white/20 text-amber-200 hover:text-white border border-amber-300/35 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            title="Xóa tiến độ demo trên trình duyệt này và khôi phục dữ liệu mẫu ban đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại bản demo</span>
          </button>

          <button
            type="button"
            onClick={exitDemoToRealLogin}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0F2D52] text-xs font-extrabold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            title="Chuyển sang trang đăng nhập tài khoản thật của hệ thống"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng nhập tài khoản thật</span>
          </button>
        </div>
      </div>
    </div>
  );
};
