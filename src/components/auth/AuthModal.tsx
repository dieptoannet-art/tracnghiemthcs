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

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setLocalError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    if (cleanPass.length < 6) {
      setLocalError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }

    if (mode === 'login') {
      const res = await signIn(cleanEmail, cleanPass);
      if (res.success) {
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
      cleanEmail,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto font-serif">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative border border-[#DCE8F7] my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#006BFF]/10 text-[#006BFF] mb-3 shadow-inner">
            {mode === 'login' ? (
              <Lock className="w-6 h-6" />
            ) : mode === 'register' ? (
              <UserPlus className="w-6 h-6" />
            ) : (
              <KeyRound className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#082B52]">
            {mode === 'login'
              ? 'Đăng nhập hệ thống'
              : mode === 'register'
              ? 'Đăng ký tài khoản Học sinh'
              : mode === 'forgot_password'
              ? 'Quên mật khẩu'
              : 'Thiết lập mật khẩu mới'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Tây Đô • Phân quyền trực tiếp theo hồ sơ Supabase
          </p>
        </div>

        {/* Mode Switcher Tabs for Login / Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-[#F3F8FF] p-1 rounded-xl mb-5 border border-[#DCE8F7]">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'login'
                  ? 'bg-white text-[#006BFF] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'register'
                  ? 'bg-white text-[#006BFF] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
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
          {mode === 'register' && (
            <>
              <div className="p-3 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] flex items-start space-x-2.5 text-xs text-[#12345B]">
                <GraduationCap className="w-4 h-4 text-[#006BFF] shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Tài khoản tự đăng ký luôn khởi tạo với vai trò <strong>Học sinh</strong>. Giáo viên hoặc Quản trị viên sẽ nhận thư mời kích hoạt hoặc được cấp quyền trong mục <em>Quản trị → Tài khoản &amp; phân quyền</em>.
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
                    className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden"
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
                    className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden bg-white"
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
                    className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {/* EMAIL (for login, register, forgot_password) */}
          {mode !== 'set_password' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email đăng nhập: <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tennguoidung@taydo.edu.vn"
                  className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden font-mono"
                />
              </div>
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
                    className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden font-mono"
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
                      className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'forgot_password' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-[#082B52]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#006BFF]" />
                <span>Lưu ý cấu hình gửi email Supabase Auth:</span>
              </div>
              <p>
                Hệ thống sử dụng <code>resetPasswordForEmail</code> của Supabase Auth. Nếu chưa nhận được email hoặc báo lỗi gửi thư, quản trị viên cần bật SMTP / Custom SMTP và thêm URL trang web vào mục <strong>Redirect URLs</strong> trong Supabase Dashboard.
              </p>
            </div>
          )}

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-[#006BFF] text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
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
                className="w-full py-2 text-xs font-bold text-slate-600 hover:text-[#082B52] flex items-center justify-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại đăng nhập</span>
              </button>
            )}
          </div>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Trường THCS Tây Đô</span>
          <button
            type="button"
            onClick={handleClose}
            className="font-bold text-[#006BFF] hover:underline"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
