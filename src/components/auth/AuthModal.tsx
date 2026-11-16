import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LogIn,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  GraduationCap,
  Info,
  ShieldCheck,
  KeyRound,
  ArrowLeft
} from 'lucide-react';
import { Grade } from '../../types';

interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'register' | 'forgot_password' | 'set_password';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  initialMode
}) => {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    signIn,
    signUp,
    requestPasswordReset,
    updatePasswordForRecovery,
    authError,
    authLoading,
    isSupabaseLiveConfigured
  } = useApp();

  const isOpen = propIsOpen !== undefined ? propIsOpen : authModalOpen;
  const handleClose = propOnClose || (() => setAuthModalOpen(false));

  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password' | 'set_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState<Grade>('8');
  const [studentCode, setStudentCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    } else if (authModalMode) {
      setMode(authModalMode);
    }
  }, [initialMode, authModalMode, isOpen]);

  useEffect(() => {
    setLocalError(null);
    setSuccessMsg(null);
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const switchMode = (nextMode: 'login' | 'register' | 'forgot_password' | 'set_password') => {
    setMode(nextMode);
    setAuthModalMode(nextMode);
    setLocalError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMsg(null);

    if (mode === 'forgot_password') {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        setLocalError('Vui lòng nhập Email tài khoản để nhận liên kết đặt lại mật khẩu.');
        return;
      }
      const res = await requestPasswordReset(cleanEmail);
      if (res.success) {
        setSuccessMsg(
          `Đã gửi liên kết đặt lại mật khẩu tới ${cleanEmail}. Vui lòng kiểm tra hộp thư (kể cả thư mục Spam) và nhấp vào liên kết để tạo mật khẩu mới.`
        );
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
        setSuccessMsg('Đã thiết lập mật khẩu mới thành công! Đang mở hệ thống...');
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          handleClose();
        }, 900);
      } else {
        setLocalError(res.error || 'Không thể cập nhật mật khẩu mới.');
      }
      return;
    }

    const cleanIdentifier = email.trim();
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
          setAuthModalMode('set_password');
          setSuccessMsg(
            'Đăng nhập lần đầu thành công! Vui lòng đổi sang mật khẩu cá nhân mới của em để bảo mật tài khoản.'
          );
          return;
        }
        setSuccessMsg('Đăng nhập thành công! Đang đồng bộ hồ sơ & phân quyền từ CSDL...');
        setTimeout(() => {
          handleClose();
        }, 550);
      } else {
        setLocalError(res.error || 'Đăng nhập thất bại.');
      }
      return;
    }

    // Register mode (always registers as 'student'; teacher/admin roles are granted only via Admin workflow)
    if (!fullName.trim()) {
      setLocalError('Vui lòng nhập họ và tên học sinh.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
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
      setSuccessMsg(
        'Đăng ký tài khoản Học sinh thành công! Nếu bạn là Giáo viên, vui lòng liên hệ Quản trị viên để được mời hoặc cấp quyền Giáo viên.'
      );
      setTimeout(() => {
        handleClose();
      }, 1200);
    } else {
      setLocalError(res.error || 'Đăng ký tài khoản thất bại.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto font-edtech">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-[0_24px_60px_-16px_rgba(16,44,84,0.35)] relative border border-[#E2E8F0] my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#EAF3FF] text-[#1769F4] mb-3 border border-[#C7DCFA]">
            {mode === 'login' ? (
              <Lock className="w-6 h-6" />
            ) : mode === 'register' ? (
              <UserPlus className="w-6 h-6" />
            ) : (
              <KeyRound className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#102C54] tracking-tight">
            {mode === 'login'
              ? 'Đăng nhập hệ thống'
              : mode === 'register'
              ? 'Đăng ký tài khoản Học sinh'
              : mode === 'forgot_password'
              ? 'Quên mật khẩu'
              : 'Thiết lập mật khẩu mới'}
          </h3>
          <p className="text-xs text-[#64748B] mt-1">
            Trường THCS Tây Đô • Học sinh đăng nhập bằng Mã học sinh · Giáo viên đăng nhập bằng Email
          </p>
        </div>

        {/* Mode Switcher Tabs for Login / Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-[#EAF3FF]/70 p-1 rounded-xl mb-5 border border-[#C7DCFA]">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#1769F4] shadow-xs'
                  : 'text-[#64748B] hover:text-[#102C54]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-[#1769F4] shadow-xs'
                  : 'text-[#64748B] hover:text-[#102C54]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Đăng ký Học sinh</span>
            </button>
          </div>
        )}

        {!isSupabaseLiveConfigured && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Chưa cấu hình URL / Publishable Key Supabase. Vui lòng thiết lập cấu hình Supabase để đăng nhập tài khoản thật.
            </div>
          </div>
        )}

        {/* Error notification */}
        {(localError || authError) && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{localError || authError}</span>
          </div>
        )}

        {/* Success notification */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'set_password' && (
            <div className="p-3 rounded-xl bg-[#EAF3FF] border border-[#C7DCFA] text-xs text-[#102C54] flex items-start space-x-2.5">
              <KeyRound className="w-4 h-4 text-[#1769F4] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Vui lòng nhập mật khẩu mới (tối thiểu 6 ký tự) để bảo vệ tài khoản của bạn trong những lần đăng nhập tiếp theo.
              </div>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div className="p-3 rounded-xl bg-[#EAF3FF] border border-[#C7DCFA] flex items-start space-x-2.5 text-xs text-[#102C54]">
                <GraduationCap className="w-4 h-4 text-[#1769F4] shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Học sinh đã được trường cấp <strong>Mã học sinh</strong> và mật khẩu khởi tạo hãy chuyển sang tab <strong>Đăng nhập</strong> (không cần tự đăng ký).
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên học sinh: <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#1769F4]/20 focus:border-[#1769F4] outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Khối lớp:
                  </label>
                  <select
                    value={grade}
                    onChange={e => setGrade(e.target.value as Grade)}
                    className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#1769F4]/20 focus:border-[#1769F4] outline-hidden bg-white"
                  >
                    <option value="6">Khối 6</option>
                    <option value="7">Khối 7</option>
                    <option value="8">Khối 8</option>
                    <option value="9">Khối 9</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã học sinh (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={studentCode}
                    onChange={e => setStudentCode(e.target.value)}
                    placeholder="HS80101"
                    className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#1769F4]/20 focus:border-[#1769F4] outline-hidden font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {/* LOGIN IDENTIFIER OR EMAIL (for login, register, forgot_password) */}
          {mode !== 'set_password' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {mode === 'login'
                  ? 'Mã học sinh hoặc Email đăng nhập:'
                  : 'Email đăng nhập:'}{' '}
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
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={
                    mode === 'login'
                      ? 'VD: HS9A101 (Học sinh) hoặc ten@taydo.edu.vn (Giáo viên)'
                      : 'tennguoidung@taydo.edu.vn'
                  }
                  className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#1769F4]/20 focus:border-[#1769F4] outline-hidden font-mono"
                />
              </div>
              {mode === 'login' && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Học sinh nhập <strong>Mã học sinh</strong> (VD: <code>HS9A101</code>). Giáo viên &amp; Quản trị viên nhập <strong>Email</strong>.
                </p>
              )}
            </div>
          )}

          {/* PASSWORD */}
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
                      className="text-[11px] font-bold text-[#006BFF] hover:underline"
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
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#1769F4]/20 focus:border-[#1769F4] outline-hidden font-mono"
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
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Khớp với mật khẩu trên"
                      className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#1769F4]/20 focus:border-[#1769F4] outline-hidden font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'forgot_password' && (
            <div className="space-y-2.5">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-950 leading-relaxed space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-700" />
                  <span>Dành cho Học sinh đăng nhập bằng Mã học sinh:</span>
                </div>
                <p>
                  Tài khoản học sinh không sử dụng email cá nhân. Nếu quên mật khẩu, em vui lòng báo cho <strong>Giáo viên chủ nhiệm</strong> hoặc <strong>Quản trị viên</strong> để được cấp lại mật khẩu mới trực tiếp trên hệ thống.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[11px] text-slate-600 leading-relaxed space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-[#102C54]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1769F4]" />
                  <span>Dành cho Giáo viên &amp; Quản trị viên (đăng nhập bằng Email):</span>
                </div>
                <p>
                  Nhập email tài khoản bên trên để nhận liên kết đặt lại mật khẩu qua Supabase Auth.
                </p>
              </div>
            </div>
          )}

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-[#1769F4] text-white rounded-xl text-xs font-bold shadow-[0_6px_16px_-6px_rgba(23,105,244,0.45)] hover:bg-[#1256CE] disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {authLoading ? (
                <span>Đang xử lý...</span>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập hệ thống</span>
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
                className="w-full py-2 text-xs font-bold text-[#64748B] hover:text-[#102C54] flex items-center justify-center space-x-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại đăng nhập</span>
              </button>
            )}
          </div>
        </form>

        <div className="mt-5 pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
          <span>Trường THCS Tây Đô</span>
          <button
            type="button"
            onClick={handleClose}
            className="font-bold text-[#1769F4] hover:underline cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
