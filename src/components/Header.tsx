import React, { useState } from 'react';
import {
  BookOpen,
  Bell,
  Database,
  LogIn,
  LogOut,
  User,
  X,
  UserPlus,
  Compass,
  Award,
  Home,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatAccountLoginDisplay } from '../utils/studentAuthHelper';
import { ACCESS_MODE_LABELS } from '../types/accessMode';

interface HeaderProps {
  onOpenSupabaseConfig: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSupabaseConfig, onToggleMobileMenu }) => {
  const {
    accessMode,
    isDemoSandbox,
    enterPublicGuest,
    enterKhktShowcase,
    exitDemoToWorkspace,
    authenticatedProdUser,
    authenticatedProdProfile,
    currentRole,
    user,
    userProfile,
    profileStatus,
    profileError,
    retryLoadProfile,
    signOut,
    openAuthModal,
    supabaseStatus,
    supabaseStatusLabel,
    currentView,
    setCurrentView,
    reducedMotion,
    setReducedMotion,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'Bài kiểm tra mới', time: '10 phút trước', desc: 'Có bài kiểm tra mới được giao trong lớp học của bạn.' },
    { id: 2, title: 'Đã có điểm bài làm', time: '1 giờ trước', desc: 'Giáo viên bộ môn đã cập nhật điểm bài kiểm tra gần nhất.' },
    { id: 3, title: 'Nhắc nhở học tập', time: 'Hôm qua', desc: 'Kiểm tra hạn nộp các bài được giao trên hệ thống.' }
  ];

  const getRoleBadge = () => {
    if (isDemoSandbox) {
      if (accessMode === 'DEMO_TEACHER') {
        return { label: 'GV Demo (50 HS)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      if (accessMode === 'DEMO_STUDENT') {
        return { label: 'HS Demo', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      }
      if (accessMode === 'KHKT_SHOWCASE') {
        return { label: 'KHKT 2027', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      }
      return { label: 'Khách Demo', bg: 'bg-sky-50 text-[#0B63CE] border-sky-200' };
    }
    const role = userProfile?.role || currentRole;
    switch (role) {
      case 'admin':
        return { label: 'Quản trị', bg: 'bg-red-50 text-red-700 border-red-200' };
      case 'teacher':
        return { label: 'Giáo viên', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'reviewer':
        return { label: 'Kiểm duyệt', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: 'Học sinh', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  };

  const roleBadge = getRoleBadge();

  const getInitials = () => {
    if (userProfile?.fullName) {
      const parts = userProfile.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return userProfile.fullName.slice(0, 2).toUpperCase();
    }
    return user ? 'TK' : isDemoSandbox ? 'DM' : 'ĐN';
  };

  return (
    <header className="bg-white/95 backdrop-blur-xs border-b border-[#E2E8F0] sticky top-0 z-30 px-4 sm:px-6 py-2.5 shadow-[0_4px_16px_-10px_rgba(16,44,84,0.08)] font-edtech">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Branding & School Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-[#102C54] hover:bg-[#EAF3FF] rounded-xl cursor-pointer transition-colors"
            aria-label="Mở menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div
            className="flex items-center space-x-2.5 cursor-pointer select-none min-w-0"
            onClick={() => setCurrentView('dashboard')}
            title="Quay lại Bảng tổng quan Tây Đô Smart EDU"
          >
            <div className="text-white flex items-center justify-center p-2 bg-gradient-to-br from-[#1769F4] to-[#102C54] rounded-xl shadow-[0_6px_14px_-4px_rgba(23,105,244,0.38)] shrink-0">
              <BookOpen className="w-5 h-5" strokeWidth={2.3} />
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-[#102C54] whitespace-nowrap">
                Tây Đô Smart EDU
              </span>
              <span className="text-slate-300 font-light hidden xl:inline text-base">|</span>
              <span className="text-xs text-[#64748B] font-semibold hidden xl:inline truncate">
                {ACCESS_MODE_LABELS[accessMode]}
              </span>
            </div>
          </div>

          {/* Compact 3-space Quick Nav */}
          <nav className="hidden lg:flex items-center gap-1 ml-2 pl-3 border-l border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setCurrentView('dashboard')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-[#EAF3FF] text-[#1769F4]'
                  : 'text-[#64748B] hover:text-[#102C54] hover:bg-[#F6F9FD]'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Trang chủ</span>
            </button>
            <button
              type="button"
              onClick={enterPublicGuest}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                currentView === 'public_explore'
                  ? 'bg-[#EAF3FF] text-[#1769F4]'
                  : 'text-[#64748B] hover:text-[#102C54] hover:bg-[#F6F9FD]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Trải nghiệm</span>
            </button>
            <button
              type="button"
              onClick={() => enterKhktShowcase(false)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                currentView === 'khkt_showcase' || currentView === 'khkt_presentation'
                  ? 'bg-[#EAF3FF] text-[#1769F4]'
                  : 'text-[#64748B] hover:text-[#102C54] hover:bg-[#F6F9FD]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>KHKT 2027</span>
            </button>
          </nav>
        </div>

        {/* Right: Reduced Motion, Status Indicator, Auth & Profile */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setReducedMotion(!reducedMotion)}
            className={`hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              reducedMotion
                ? 'bg-[#102C54] text-white border-[#102C54]'
                : 'bg-[#F6F9FD] text-[#64748B] border-[#E2E8F0] hover:text-[#102C54] hover:bg-[#EAF3FF]'
            }`}
            title="Giảm hiệu ứng chuyển động cho máy chiếu"
          >
            {reducedMotion ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{reducedMotion ? 'Ít hiệu ứng' : 'Hiệu ứng'}</span>
          </button>

          {!isDemoSandbox && (
            <button
              onClick={onOpenSupabaseConfig}
              className={`hidden xl:flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                supabaseStatus === 'unconfigured'
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  : supabaseStatus === 'configured_unverified'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : supabaseStatus === 'verified_all'
                  ? 'bg-[#ECFDF5] text-[#0F766E] border-[#A7F3D0] hover:bg-emerald-100'
                  : supabaseStatus === 'verified_auth_only'
                  ? 'bg-[#EAF3FF] text-[#102C54] border-[#C7DCFA] hover:bg-blue-100'
                  : supabaseStatus === 'verified_db_only'
                  ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                  : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] hover:bg-red-100'
              }`}
              title="Nhấp để cấu hình Supabase hoặc kiểm tra trạng thái kết nối thực tế"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="font-semibold">{supabaseStatusLabel}</span>
            </button>
          )}

          {!isDemoSandbox && user && profileStatus === 'error' && (
            <button
              type="button"
              onClick={retryLoadProfile}
              title={profileError || 'Lỗi tải hồ sơ và vai trò từ Supabase'}
              className="hidden sm:inline-flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-xl bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] font-bold hover:bg-red-100 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Lỗi tải hồ sơ (Thử lại)</span>
            </button>
          )}

          {/* User Info & Role Badge */}
          <div className="flex items-center space-x-2 bg-[#F6F9FD] border border-[#E2E8F0] px-2.5 sm:px-3 py-1.5 rounded-xl">
            <div className="w-6 h-6 rounded-lg bg-[#EAF3FF] text-[#1769F4] flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-xs text-[#102C54] truncate max-w-[110px] sm:max-w-[170px]">
              {userProfile
                ? userProfile.fullName
                : user
                ? profileStatus === 'loading'
                  ? 'Đang tải hồ sơ...'
                  : formatAccountLoginDisplay(user.email, user.user_metadata?.student_code, 'student')
                : 'Chưa đăng nhập'}
            </span>
            <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${roleBadge.bg}`}>
              {roleBadge.label}
            </span>
          </div>

          {/* Auth / Return to Production Controls */}
          {isDemoSandbox ? (
            authenticatedProdUser ? (
              <button
                type="button"
                onClick={() => exitDemoToWorkspace('dashboard')}
                className="flex items-center space-x-1.5 text-xs bg-[#102C54] hover:bg-[#15396B] text-white px-3 py-1.5 rounded-xl font-bold shadow-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                title={`Quay về tài khoản thật (${authenticatedProdProfile?.fullName || authenticatedProdUser.email})`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#12A879]" />
                <span className="hidden sm:inline">Về Workspace</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="hidden sm:flex items-center space-x-1 text-xs text-[#1769F4] border border-[#C7DCFA] hover:bg-[#EAF3FF] px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Đăng ký</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('login_portal')}
                  className="flex items-center space-x-1.5 text-xs bg-[#1769F4] hover:bg-[#0F56D3] text-white px-3 py-1.5 rounded-xl font-bold shadow-xs whitespace-nowrap transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập</span>
                </button>
              </div>
            )
          ) : user || userProfile ? (
            <button
              onClick={signOut}
              className="flex items-center space-x-1 text-xs text-[#64748B] hover:text-[#EF4444] px-2.5 py-1.5 rounded-xl border border-[#E2E8F0] hover:border-red-200 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-semibold">Đăng xuất</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('login_portal')}
              className="flex items-center space-x-1.5 text-xs bg-[#1769F4] hover:bg-[#0F56D3] text-white px-3 py-1.5 rounded-xl font-bold shadow-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-[#64748B] hover:text-[#1769F4] hover:bg-[#EAF3FF] rounded-xl transition-colors cursor-pointer"
              aria-label="Thông báo"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute -top-0.5 -right-0.5 bg-[#EF4444] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white td-tabular-nums">
                3
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] py-2 z-50">
                <div className="px-4 py-2 border-b border-[#E2E8F0] flex items-center justify-between">
                  <span className="font-bold text-sm text-[#102C54]">Thông báo hệ thống (3)</span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="Đóng thông báo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-3 hover:bg-[#F6F9FD] transition-colors cursor-pointer">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-bold text-[#1769F4]">{n.title}</span>
                        <span className="text-[10px] text-[#64748B] whitespace-nowrap">{n.time}</span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar with Initials */}
          <div
            onClick={() => {
              if (isDemoSandbox || !user) {
                setCurrentView('login_portal');
              }
            }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1769F4] to-[#102C54] text-white flex items-center justify-center font-bold text-xs tracking-wide shadow-xs cursor-pointer shrink-0"
            title={userProfile?.fullName || ACCESS_MODE_LABELS[accessMode]}
          >
            {getInitials()}
          </div>
        </div>
      </div>
    </header>
  );
};
