import React, { useState } from 'react';
import { BookOpen, Bell, Database, LogIn, LogOut, User, Shield, GraduationCap, X, Laptop, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  onOpenSupabaseConfig: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSupabaseConfig, onToggleMobileMenu }) => {
  const {
    currentRole,
    user,
    userProfile,
    profileStatus,
    profileError,
    retryLoadProfile,
    signOut,
    setAuthModalOpen,
    openAuthModal,
    supabaseStatus,
    supabaseStatusLabel,
    setCurrentView
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'Bài kiểm tra mới', time: '10 phút trước', desc: 'Có bài kiểm tra mới được giao trong lớp học của bạn.' },
    { id: 2, title: 'Đã có điểm bài làm', time: '1 giờ trước', desc: 'Giáo viên bộ môn đã cập nhật điểm bài kiểm tra gần nhất.' },
    { id: 3, title: 'Nhắc nhở học tập', time: 'Hôm qua', desc: 'Kiểm tra hạn nộp các bài được giao trên hệ thống.' }
  ];

  // Helper for role label (strictly derived from DB profile role)
  const getRoleBadge = () => {
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

  // Helper for avatar initials
  const getInitials = () => {
    if (userProfile?.fullName) {
      const parts = userProfile.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return userProfile.fullName.slice(0, 2).toUpperCase();
    }
    return user ? 'TK' : 'ĐN';
  };

  return (
    <header className="bg-white border-b border-[#DCE8F7] sticky top-0 z-30 px-4 sm:px-6 py-2.5 shadow-xs">
      <div className="flex items-center justify-between">
        {/* Left: Branding & School Title */}
        <div className="flex items-center space-x-3">
          {/* Mobile hamburger button */}
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 text-[#082B52] hover:bg-[#F3F8FF] rounded-lg"
            aria-label="Mở menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => setCurrentView('dashboard')}
          >
            <div className="text-[#1769C2] flex items-center justify-center p-2 bg-[#EAF5FF] rounded-xl border border-[#CBE2FB]">
              <BookOpen className="w-6 h-6" strokeWidth={2.4} />
            </div>
            <div className="flex items-center space-x-2.5 font-serif">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F2D52]">
                Tây Đô Smart EDU
              </span>
              <span className="text-slate-300 font-light hidden sm:inline text-lg">|</span>
              <span className="text-xs sm:text-sm text-slate-600 font-medium hidden sm:inline">
                Trường THCS Tây Đô
              </span>
            </div>
          </div>
        </div>

        {/* Right: Status Indicator, Auth & Profile */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mode Indicator / Supabase Config Trigger */}
          <button
            onClick={onOpenSupabaseConfig}
            className={`hidden lg:flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
              supabaseStatus === 'unconfigured'
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                : supabaseStatus === 'configured_unverified'
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : supabaseStatus === 'verified_all'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : supabaseStatus === 'verified_auth_only'
                ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                : supabaseStatus === 'verified_db_only'
                ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
            }`}
            title="Nhấp để cấu hình Supabase hoặc kiểm tra trạng thái kết nối thực tế"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="font-semibold">
              {supabaseStatusLabel}
            </span>
          </button>

          {/* Profile Load Error Indicator */}
          {user && profileStatus === 'error' && (
            <button
              type="button"
              onClick={retryLoadProfile}
              title={profileError || 'Lỗi tải hồ sơ và vai trò từ Supabase'}
              className="hidden sm:inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-bold hover:bg-red-100"
            >
              <span>Lỗi tải hồ sơ (Thử lại)</span>
            </button>
          )}

          {/* User Info & DB Role Badge */}
          <div className="flex items-center space-x-2 bg-white border border-[#CFDCED] px-3 py-1.5 rounded-full shadow-2xs">
            <div className="w-6 h-6 rounded-full bg-[#EAF5FF] text-[#1769C2] flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-[#0F2D52] truncate max-w-[140px] sm:max-w-[200px]">
              {userProfile
                ? userProfile.fullName
                : user
                ? (profileStatus === 'loading' ? 'Đang tải hồ sơ...' : user.email || 'Tài khoản')
                : 'Chưa đăng nhập'}
            </span>
            {userProfile && (
              <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleBadge.bg}`}>
                {roleBadge.label}
              </span>
            )}
          </div>

          {/* Login or Logout Action Button */}
          {user || userProfile ? (
            <button
              onClick={signOut}
              className="flex items-center space-x-1 text-xs text-slate-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 transition-colors"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Đăng xuất</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <button
                onClick={() => openAuthModal('register')}
                className="flex items-center space-x-1 text-xs text-[#006BFF] border border-[#006BFF]/40 hover:border-[#006BFF] hover:bg-[#EBF3FF] px-2.5 py-1.5 rounded-xl font-bold transition-all shadow-2xs"
                title="Đăng ký tài khoản Học sinh mới"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Đăng ký</span>
              </button>
              <button
                onClick={() => openAuthModal('login')}
                className="flex items-center space-x-1.5 text-xs bg-[#006BFF] text-white px-3 py-1.5 rounded-xl font-bold shadow-xs hover:bg-blue-600 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </button>
            </div>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 text-slate-600 hover:text-[#006BFF] hover:bg-[#F3F8FF] rounded-full transition-colors"
              aria-label="Thông báo"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                3
              </span>
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#DCE8F7] py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-sm text-[#082B52]">Thông báo mới (3)</span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className="p-3 hover:bg-[#F3F8FF] transition-colors cursor-pointer">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-[#006BFF]">{n.title}</span>
                        <span className="text-[10px] text-slate-400">{n.time}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar with Initials */}
          <div
            onClick={() => {
              if (!user) setAuthModalOpen(true);
            }}
            className="w-9 h-9 rounded-full bg-[#006BFF] text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-xs cursor-pointer ring-2 ring-[#006BFF]/20"
            title={userProfile?.fullName || (currentRole === 'student' ? 'Học sinh' : currentRole === 'admin' ? 'Quản trị viên' : 'Giáo viên')}
          >
            {getInitials()}
          </div>
        </div>
      </div>
    </header>
  );
};
