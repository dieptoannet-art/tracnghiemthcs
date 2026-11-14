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
  Briefcase,
  BookOpen,
  Info,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Grade, SubjectId } from '../../types';

interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'register';
}

const TEACHER_SUBJECTS: { id: SubjectId; label: string }[] = [
  { id: 'math', label: 'Toán học' },
  { id: 'informatics', label: 'Tin học' },
  { id: 'science', label: 'Khoa học tự nhiên' },
  { id: 'literature', label: 'Ngữ văn' },
  { id: 'english', label: 'Tiếng Anh' },
  { id: 'history_geo', label: 'Lịch sử và Địa lí' },
  { id: 'technology', label: 'Công nghệ' },
  { id: 'civics', label: 'GDCD' },
  { id: 'other', label: 'Bộ môn khác' }
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  initialMode,
}) => {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    signIn,
    signUp,
    authError,
    authLoading,
    isSupabaseLiveConfigured
  } = useApp();

  const isOpen = propIsOpen !== undefined ? propIsOpen : authModalOpen;
  const handleClose = propOnClose || (() => setAuthModalOpen(false));

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState<Grade>('8');
  const [studentCode, setStudentCode] = useState('');
  const [teacherSubject, setTeacherSubject] = useState<string>('Toán học');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync mode with context
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    } else if (authModalMode) {
      setMode(authModalMode);
    }
  }, [initialMode, authModalMode, isOpen]);

  // Reset errors when modal opens or mode changes
  useEffect(() => {
    setLocalError(null);
    setSuccessMsg(null);
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMsg(null);

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
        setSuccessMsg('Đăng nhập thành công! Đang tải dữ liệu và các menu...');
        setTimeout(() => {
          handleClose();
        }, 600);
      } else {
        setLocalError(res.error || 'Đăng nhập thất bại.');
      }
    } else {
      // Register mode
      if (!fullName.trim()) {
        setLocalError(`Vui lòng nhập họ và tên ${selectedRole === 'teacher' ? 'giáo viên' : 'học sinh'}.`);
        return;
      }

      if (password !== confirmPassword) {
        setLocalError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
        return;
      }

      const effectiveRegisterRole = isSupabaseLiveConfigured ? 'student' : selectedRole;
      const res = await signUp(
        cleanEmail,
        cleanPass,
        fullName.trim(),
        effectiveRegisterRole,
        effectiveRegisterRole === 'student' ? grade : undefined,
        effectiveRegisterRole === 'student' ? studentCode.trim() : undefined,
        effectiveRegisterRole === 'teacher' ? teacherSubject : undefined
      );

      if (res.success) {
        const roleLabel = effectiveRegisterRole === 'teacher' ? 'Giáo viên' : 'Học sinh';
        setSuccessMsg(
          isSupabaseLiveConfigured
            ? `Đăng ký tài khoản Học sinh thành công! Nếu bạn là Giáo viên, vui lòng liên hệ Quản trị viên để được cấp quyền Giáo viên.`
            : `Đăng ký tài khoản ${roleLabel} thành công! Hệ thống đã lưu thông tin và thiết lập các menu ${roleLabel} cho bạn.`
        );
        setTimeout(() => {
          handleClose();
        }, 1200);
      } else {
        setLocalError(res.error || 'Đăng ký tài khoản thất bại.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative border border-[#DCE8F7] my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#006BFF]/10 text-[#006BFF] mb-3 shadow-inner">
            {mode === 'login' ? <Lock className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#082B52]">
            {mode === 'login' ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản mới'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Tây Đô • Dữ liệu lưu trữ an toàn trên Supabase
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-[#F3F8FF] p-1 rounded-xl mb-5 border border-[#DCE8F7]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setAuthModalMode('login');
              setLocalError(null);
              setSuccessMsg(null);
            }}
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
            onClick={() => {
              setMode('register');
              setAuthModalMode('register');
              setLocalError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
              mode === 'register'
                ? 'bg-white text-[#006BFF] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isSupabaseLiveConfigured ? 'Đăng ký tài khoản' : 'Đăng ký (Chọn Giáo viên / Học sinh)'}</span>
          </button>
        </div>

        {/* Config Check Notice */}
        {!isSupabaseLiveConfigured && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start space-x-2">
            <Info className="w-4 h-4 text-[#006BFF] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Đăng ký trải nghiệm ngay: </span>
              Bạn có thể chọn vai trò <strong>Giáo viên</strong> hoặc <strong>Học sinh</strong> và đăng ký ngay lập tức. Hệ thống sẽ áp dụng và hiển thị đúng các menu tương ứng. Khi cấu hình biến môi trường Supabase, dữ liệu sẽ tự động đồng bộ lên máy chủ Supabase.
            </div>
          </div>
        )}

        {/* Error notification */}
        {(localError || authError) && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2 animate-shake">
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              {/* 1. CHỌN VAI TRÒ: GIÁO VIÊN HOẶC HỌC SINH */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  1. Chọn vai trò tài khoản: <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Option: Học sinh */}
                  <div
                    onClick={() => setSelectedRole('student')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      selectedRole === 'student'
                        ? 'border-[#006BFF] bg-blue-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`p-2 rounded-lg ${selectedRole === 'student' ? 'bg-[#006BFF] text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedRole === 'student' ? 'bg-[#006BFF] text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {selectedRole === 'student' ? 'Đang chọn' : 'Học sinh'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#082B52]">Học sinh THCS</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Luyện theo chương, thi trực tuyến, sổ câu sai, xem tiến bộ
                      </p>
                    </div>
                  </div>

                  {/* Option: Giáo viên */}
                  <div
                    onClick={() => {
                      if (!isSupabaseLiveConfigured) {
                        setSelectedRole('teacher');
                      }
                    }}
                    className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                      isSupabaseLiveConfigured
                        ? 'border-slate-200 bg-slate-50 opacity-75 cursor-not-allowed'
                        : selectedRole === 'teacher'
                        ? 'border-[#006BFF] bg-blue-50/70 shadow-xs cursor-pointer'
                        : 'border-slate-200 hover:border-slate-300 bg-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`p-2 rounded-lg ${!isSupabaseLiveConfigured && selectedRole === 'teacher' ? 'bg-[#006BFF] text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${!isSupabaseLiveConfigured && selectedRole === 'teacher' ? 'bg-[#006BFF] text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {isSupabaseLiveConfigured ? 'Quản trị cấp' : selectedRole === 'teacher' ? 'Đang chọn' : 'Giáo viên'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#082B52]">Giáo viên bộ môn</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {isSupabaseLiveConfigured
                          ? 'Đăng ký học sinh trước, sau đó Quản trị viên cấp quyền Giáo viên'
                          : 'Ngân hàng câu hỏi, tạo đề thi, ma trận đặc tả, chấm bài'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. HỌ VÀ TÊN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Họ và tên {selectedRole === 'teacher' ? 'giáo viên' : 'học sinh'}: <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={selectedRole === 'teacher' ? 'Ví dụ: Thầy Diệp Thanh Toàn' : 'Ví dụ: Nguyễn Văn An'}
                    className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden"
                  />
                </div>
              </div>

              {/* 3. THÔNG TIN THEO VAI TRÒ (HỌC SINH HOẶC GIÁO VIÊN) */}
              {selectedRole === 'student' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Khối lớp học:
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
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Môn giảng dạy chính:
                    </label>
                    <div className="relative">
                      <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <select
                        value={teacherSubject}
                        onChange={e => setTeacherSubject(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden bg-white"
                      >
                        {TEACHER_SUBJECTS.map(s => (
                          <option key={s.id} value={s.label}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đơn vị công tác:
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Trường THCS Tây Đô"
                      className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 text-slate-600 outline-hidden"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* EMAIL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {mode === 'register' ? '3. Email đăng nhập:' : 'Email đăng nhập:'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={selectedRole === 'teacher' ? 'giaovien@taydo.edu.vn' : 'hocsinh@taydo.edu.vn'}
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-[#006BFF]/20 focus:border-[#006BFF] outline-hidden font-mono"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div className={mode === 'register' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-1'}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {mode === 'register' ? '4. Mật khẩu:' : 'Mật khẩu:'} <span className="text-red-500">*</span>
              </label>
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

            {mode === 'register' && (
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

          {/* Hint regarding permissions */}
          {mode === 'register' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px] text-slate-600">
              <div className="flex items-center space-x-1.5 font-bold text-[#082B52]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#006BFF]" />
                <span>Quyền hạn theo vai trò đã chọn:</span>
              </div>
              {selectedRole === 'teacher' ? (
                <p>
                  Tài khoản <strong>Giáo viên</strong> sẽ được hiển thị đầy đủ các menu: <em>Lớp học, Ngân hàng câu hỏi, Tạo đề thi, Ma trận & đặc tả, Chấm bài tự luận & Trợ lý Gemini</em>.
                </p>
              ) : (
                <p>
                  Tài khoản <strong>Học sinh</strong> sẽ được mở các menu: <em>Luyện theo bài/chương, Ôn tập học kỳ, Bài được giao, Kiểm tra trực tuyến, Sổ câu sai & Báo cáo tiến bộ</em>.
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-[#006BFF] text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {authLoading ? (
                <span>Đang xử lý kết nối...</span>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập hệ thống</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Hoàn tất đăng ký ({selectedRole === 'teacher' ? 'Giáo viên' : 'Học sinh'})</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Demo fallback prompt */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Hệ thống THCS Tây Đô</span>
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
