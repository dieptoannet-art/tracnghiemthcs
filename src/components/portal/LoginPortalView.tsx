import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  Lock,
  Mail,
  User,
  GraduationCap,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Compass,
  Award,
  LogOut,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Grade } from '../../types';

export const LoginPortalView: React.FC = () => {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    updatePasswordForRecovery,
    signOut,
    authError,
    authLoading,
    isSupabaseLiveConfigured,
    authenticatedProdUser,
    authenticatedProdProfile,
    authenticatedProdRole,
    exitDemoToWorkspace,
    enterPublicGuest,
    enterKhktShowcase,
    setCurrentView,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password' | 'set_password'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState<Grade>('8');
  const [studentCode, setStudentCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setMode('set_password');
    }
  }, []);

  const switchMode = (next: 'login' | 'register' | 'forgot_password' | 'set_password') => {
    setMode(next);
    setLocalError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMsg(null);

    if (mode === 'forgot_password') {
      const cleanEmail = identifier.trim().toLowerCase();
      if (!cleanEmail) {
        setLocalError('Vui lòng nhập Email tài khoản để nhận liên kết đặt lại mật khẩu.');
        return;
      }
      const res = await requestPasswordReset(cleanEmail);
      if (res.success) {
        setSuccessMsg(`Đã gửi liên kết đặt lại mật khẩu tới ${cleanEmail}.`);
      } else {
        setLocalError(res.error || 'Không thể gửi email đặt lại mật khẩu.');
      }
      return;
    }

    if (mode === 'set_password') {
      const cleanPass = password.trim();
      if (cleanPass.length < 6) {
        setLocalError('Mật khẩu mới cần tối thiểu 6 ký tự.');
        return;
      }
      if (cleanPass !== confirmPassword.trim()) {
        setLocalError('Mật khẩu xác nhận không khớp.');
        return;
      }
      const res = await updatePasswordForRecovery(cleanPass);
      if (res.success) {
        setSuccessMsg('Đã thiết lập mật khẩu mới thành công! Đang mở Không gian Làm việc...');
        setPassword('');
        setConfirmPassword('');
        window.setTimeout(() => {
          exitDemoToWorkspace('dashboard');
        }, 700);
      } else {
        setLocalError(res.error || 'Không thể cập nhật mật khẩu mới.');
      }
      return;
    }

    const cleanIdentifier = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanIdentifier || !cleanPass) {
      setLocalError(
        mode === 'login'
          ? 'Vui lòng nhập đầy đủ Mã học sinh (hoặc Email) và Mật khẩu.'
          : 'Vui lòng nhập đầy đủ Email và Mật khẩu.'
      );
      return;
    }

    if (cleanPass.length < 6) {
      setLocalError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }

    if (mode === 'login') {
      const res = await signIn(cleanIdentifier, cleanPass);
      if (res.success) {
        if (res.mustChangePassword) {
          setPassword('');
          setConfirmPassword('');
          setMode('set_password');
          setSuccessMsg('Đăng nhập lần đầu thành công! Vui lòng đổi mật khẩu mới để bảo vệ tài khoản.');
          return;
        }
        setSuccessMsg('Đăng nhập thành công! Đang mở Không gian Làm việc Chính thức...');
        window.setTimeout(() => {
          exitDemoToWorkspace('dashboard');
        }, 450);
      } else {
        setLocalError(res.error || 'Đăng nhập thất bại.');
      }
      return;
    }

    if (!fullName.trim()) {
      setLocalError('Vui lòng nhập họ và tên học sinh.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp.');
      return;
    }

    const res = await signUp(
      cleanIdentifier.toLowerCase(),
      cleanPass,
      fullName.trim(),
      'student',
      grade,
      studentCode.trim()
    );
    if (res.success) {
      setSuccessMsg('Đăng ký tài khoản Học sinh thành công!');
      window.setTimeout(() => {
        exitDemoToWorkspace('dashboard');
      }, 900);
    } else {
      setLocalError(res.error || 'Đăng ký tài khoản thất bại.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FD] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 font-edtech">
      <div className="max-w-5xl w-full mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentView('home_portal')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769F4] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Cổng chính Tây Đô Smart EDU</span>
          </button>
          <span className="text-xs font-semibold text-slate-500">Trường THCS Tây Đô</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Form Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 flex flex-col justify-between">
            {authenticatedProdUser && mode !== 'set_password' ? (
              <div className="space-y-6 my-auto py-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                      Phiên xác thực đang hoạt động
                    </span>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-[#102C54]">
                      {authenticatedProdProfile?.fullName || authenticatedProdUser.email}
                    </h1>
                    <p className="text-xs text-slate-500">
                      Vai trò trên CSDL: <strong className="text-[#102C54]">{authenticatedProdRole}</strong> ·{' '}
                      {authenticatedProdUser.email}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F6F9FD] border border-[#E2E8F0] text-xs text-slate-600 leading-relaxed">
                  Tài khoản chính thức của bạn vẫn được giữ an toàn ngay cả khi bạn chuyển sang xem chế độ Demo / KHKT. Nhấn nút dưới đây để quay về Không gian Làm việc Chính thức ngay.
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => exitDemoToWorkspace('dashboard')}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#1769F4] hover:bg-[#1255CC] text-white text-sm font-bold shadow-xs cursor-pointer"
                  >
                    Vào Không gian Làm việc Chính thức
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="py-3 px-4 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-extrabold text-[#102C54]">
                    {mode === 'login'
                      ? 'Đăng nhập Không gian Làm việc'
                      : mode === 'register'
                      ? 'Đăng ký tài khoản Học sinh'
                      : mode === 'forgot_password'
                      ? 'Khôi phục mật khẩu'
                      : 'Thiết lập mật khẩu mới'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Học sinh dùng <strong>Mã học sinh</strong> · Giáo viên và Quản trị viên dùng <strong>Email công vụ</strong>.
                  </p>
                </div>

                {(mode === 'login' || mode === 'register') && (
                  <div className="flex bg-[#F6F9FD] p-1 rounded-xl border border-[#E2E8F0]">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        mode === 'login'
                          ? 'bg-white text-[#1769F4] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Đăng nhập</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg whitespace-nowrap shrink-0 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        mode === 'register'
                          ? 'bg-white text-[#1769F4] shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Đăng ký Học sinh</span>
                    </button>
                  </div>
                )}

                {!isSupabaseLiveConfigured && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      Chưa phát hiện cấu hình biến môi trường Supabase trong phiên này. Bạn vẫn có thể trải nghiệm đầy đủ toàn bộ chức năng qua Cổng Khách hoặc KHKT Showcase.
                    </span>
                  </div>
                )}

                {(localError || authError) && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{localError || authError}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Họ và tên học sinh <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Nguyễn Văn An"
                            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-[#1769F4] focus:ring-2 focus:ring-[#1769F4]/15 outline-hidden"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                          <select
                            value={grade}
                            onChange={(e) => setGrade(e.target.value as Grade)}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                          >
                            <option value="6">Khối 6</option>
                            <option value="7">Khối 7</option>
                            <option value="8">Khối 8</option>
                            <option value="9">Khối 9</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Mã học sinh (nếu có)
                          </label>
                          <input
                            type="text"
                            value={studentCode}
                            onChange={(e) => setStudentCode(e.target.value)}
                            placeholder="HS80101"
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono-num"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {mode !== 'set_password' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {mode === 'login' ? 'Mã học sinh hoặc Email:' : 'Email đăng nhập:'}{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        {mode === 'login' ? (
                          <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        ) : (
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        )}
                        <input
                          type={mode === 'login' ? 'text' : 'email'}
                          required
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder={mode === 'login' ? 'HS9A101 hoặc ten@taydo.edu.vn' : 'ten@taydo.edu.vn'}
                          className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-[#1769F4] focus:ring-2 focus:ring-[#1769F4]/15 outline-hidden font-mono-num"
                        />
                      </div>
                    </div>
                  )}

                  {mode !== 'forgot_password' && (
                    <div className={mode === 'register' || mode === 'set_password' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-1.5'}>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">
                            {mode === 'set_password' ? 'Mật khẩu mới:' : 'Mật khẩu:'} <span className="text-red-500">*</span>
                          </label>
                          {mode === 'login' && (
                            <button
                              type="button"
                              onClick={() => switchMode('forgot_password')}
                              className="text-[11px] font-bold text-[#1769F4] hover:underline cursor-pointer"
                            >
                              Quên mật khẩu?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Tối thiểu 6 ký tự"
                            className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-[#1769F4] focus:ring-2 focus:ring-[#1769F4]/15 outline-hidden font-mono-num"
                          />
                        </div>
                      </div>

                      {(mode === 'register' || mode === 'set_password') && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Nhập lại mật khẩu: <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="password"
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Khớp mật khẩu trên"
                              className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-[#1769F4] focus:ring-2 focus:ring-[#1769F4]/15 outline-hidden font-mono-num"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 bg-[#1769F4] hover:bg-[#1255CC] text-white rounded-xl text-sm font-bold shadow-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {authLoading ? (
                      <span>Đang xác thực...</span>
                    ) : mode === 'login' ? (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Đăng nhập Không gian Chính thức</span>
                      </>
                    ) : mode === 'register' ? (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Đăng ký tài khoản Học sinh</span>
                      </>
                    ) : mode === 'forgot_password' ? (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Gửi email đặt lại mật khẩu</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Lưu mật khẩu mới</span>
                      </>
                    )}
                  </button>

                  {mode === 'forgot_password' && (
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="w-full py-2 text-xs font-bold text-slate-600 hover:text-[#102C54] cursor-pointer"
                    >
                      ← Quay lại đăng nhập
                    </button>
                  )}
                </form>
              </div>
            )}
          </div>

          {/* Right Sandbox & Security Notice Column */}
          <div className="lg:col-span-5 bg-[#102C54] text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/10 border border-white/15 text-xs font-bold text-sky-200">
                <GraduationCap className="w-4 h-4" />
                <span>Không cần tài khoản vẫn có thể xem thử</span>
              </div>
              <h2 className="text-xl font-extrabold leading-snug">
                Bảo mật nghiêm ngặt giữa Tài khoản Thật &amp; Môi trường Trải nghiệm
              </h2>
              <p className="text-xs sm:text-sm text-blue-100/85 leading-relaxed">
                Khách tham quan và Ban Giám khảo KHKT không được cấp tài khoản quản trị thật và không thể đọc ghi cơ sở dữ liệu Supabase chính thức. Toàn bộ dữ liệu 50 học sinh mẫu, đề minh họa và lịch sử trò chơi trong Chế độ Khách chỉ nằm cục bộ trong trình duyệt.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={enterPublicGuest}
                className="w-full py-3 px-4 rounded-xl bg-white text-[#102C54] hover:bg-sky-50 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-[#1769F4]" />
                <span>Trải nghiệm ngay không cần đăng nhập (/explore)</span>
              </button>
              <button
                type="button"
                onClick={() => enterKhktShowcase(true)}
                className="w-full py-3 px-4 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/45 border border-indigo-300/40 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-300" />
                <span>Mở Trình diễn Ban Giám khảo KHKT (6 bước)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
