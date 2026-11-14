import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Database,
  Check,
  Copy,
  ExternalLink,
  Download,
  AlertCircle,
  X,
  ShieldCheck,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  HelpCircle,
  Server
} from 'lucide-react';
import {
  testSupabaseConnection,
  updateSupabaseCredentials,
  resetSupabaseCredentials,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY
} from '../lib/supabase';

interface SupabaseGuideModalProps {
  onClose: () => void;
}

export const SupabaseGuideModal: React.FC<SupabaseGuideModalProps> = ({ onClose }) => {
  const {
    supabaseConfig,
    setSupabaseConfig,
    supabaseStatus,
    supabaseStatusLabel,
    authVerified,
    dbVerified,
    verifySupabase
  } = useApp();

  const [url, setUrl] = useState(supabaseConfig.url || '');
  const [anonKey, setAnonKey] = useState(supabaseConfig.anonKey || '');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [isPausedError, setIsPausedError] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [testDetails, setTestDetails] = useState<{ auth?: boolean; db?: boolean } | null>(null);

  const handleTestConnection = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestStatus('error');
      setTestMessage('Vui lòng nhập đầy đủ Supabase Project URL và Publishable/Anon Key.');
      setIsPausedError(false);
      return;
    }

    setTestStatus('testing');
    setTestMessage('');
    setIsPausedError(false);
    setTestDetails(null);

    try {
      const res = await testSupabaseConnection(url.trim(), anonKey.trim());

      if (res.success) {
        setTestStatus('success');
        setTestMessage(res.message);
        setIsPausedError(false);
        setTestDetails({
          auth: res.authVerified,
          db: res.dbVerified
        });
        updateSupabaseCredentials(url.trim(), anonKey.trim());
        setSupabaseConfig({
          url: url.trim(),
          anonKey: anonKey.trim(),
          isConnected: true
        });
        // Run verification in context
        verifySupabase();
      } else {
        setTestStatus('error');
        setTestMessage(res.message || 'Không thể kết nối tới Supabase. Kiểm tra lại URL và Key.');
        if (res.isPausedOrDnsError) {
          setIsPausedError(true);
        }
      }
    } catch (err: any) {
      setTestStatus('error');
      const msg = err?.message || 'Lỗi mạng hoặc CORS khi kết nối tới Supabase URL.';
      setTestMessage(msg);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setIsPausedError(true);
      }
    }
  };

  const handleSaveConfig = () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestStatus('error');
      setTestMessage('Vui lòng nhập đầy đủ Supabase Project URL và Publishable/Anon Key.');
      return;
    }

    updateSupabaseCredentials(url.trim(), anonKey.trim());
    setSupabaseConfig({
      url: url.trim(),
      anonKey: anonKey.trim(),
      isConnected: true
    });
    setSaveNotice('Đã lưu cấu hình Supabase vào hệ thống thành công!');
    setTimeout(() => setSaveNotice(''), 4000);
    verifySupabase();
  };

  const handleResetDefault = () => {
    resetSupabaseCredentials();
    setUrl(DEFAULT_SUPABASE_URL);
    setAnonKey(DEFAULT_SUPABASE_ANON_KEY);
    setSupabaseConfig({
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_ANON_KEY,
      isConnected: true
    });
    setTestStatus('idle');
    setTestMessage('Đã khôi phục thông tin cấu hình mặc định ban đầu.');
    setIsPausedError(false);
    verifySupabase();
  };

  const handleDownloadSql = () => {
    const a = document.createElement('a');
    a.href = '/src/data/supabase_schema.sql';
    a.download = 'supabase_schema_taydo.sql';
    a.click();
  };

  const getStatusColor = () => {
    switch (supabaseStatus) {
      case 'unconfigured':
        return 'bg-slate-50 border-slate-300 text-slate-800';
      case 'configured_unverified':
        return 'bg-amber-50 border-amber-300 text-amber-900';
      case 'verified_all':
        return 'bg-emerald-50 border-emerald-300 text-emerald-900';
      case 'verified_auth_only':
        return 'bg-blue-50 border-blue-300 text-blue-900';
      case 'verified_db_only':
        return 'bg-teal-50 border-teal-300 text-teal-900';
      case 'error':
        return 'bg-red-50 border-red-300 text-red-900';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-[#006BFF] rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#082B52]">
                Cấu hình & Trạng thái kết nối CSDL Supabase
              </h3>
              <p className="text-xs text-slate-500">
                Kết nối xác thực thực tế cho Auth và Cơ sở dữ liệu PostgreSQL
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Verified Status Badge */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${getStatusColor()}`}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
              Trạng thái thực tế:
            </span>
            <span className="font-bold text-base flex items-center space-x-1.5 mt-0.5">
              <span>{supabaseStatusLabel}</span>
            </span>
            <p className="text-xs mt-1 opacity-80 leading-relaxed">
              {supabaseStatus === 'unconfigured' &&
                'Chưa có URL và Publishable Key hợp lệ trong tệp cấu hình.'}
              {supabaseStatus === 'configured_unverified' &&
                'Đã cấu hình URL và Key. Nhấn "Kiểm tra kết nối" để xác minh trực tiếp với máy chủ Supabase.'}
              {supabaseStatus === 'verified_auth_only' &&
                'Đã xác minh thành công Dịch vụ Xác thực (Auth). Cơ sở dữ liệu đang đợi phản hồi.'}
              {supabaseStatus === 'verified_db_only' &&
                'Đã xác minh thành công Cơ sở dữ liệu (CSDL). Đang sử dụng dữ liệu thật từ bảng public.questions.'}
              {supabaseStatus === 'verified_all' &&
                'Đã xác minh thực tế thành công cả Dịch vụ Xác thực (Auth) và Cơ sở dữ liệu (CSDL Supabase).'}
              {supabaseStatus === 'error' &&
                'Có cấu hình nhưng kết nối tới máy chủ Supabase không phản hồi (Kiểm tra bên dưới).'}
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
            <button
              onClick={verifySupabase}
              className="px-3 py-1.5 bg-white border rounded-lg text-xs font-bold shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Kiểm tra ngay
            </button>
          </div>
        </div>

        {/* Supabase PostgreSQL Architecture Banner (Updated to correctly reflect database-first architecture) */}
        <div className="p-4 bg-emerald-50/90 rounded-2xl border border-emerald-300 text-xs text-emerald-950 flex items-start space-x-3 shadow-2xs">
          <Server className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 text-sm">
                Kiến trúc lưu trữ & đồng bộ CSDL Supabase (PostgreSQL):
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-bold">
                Nguồn dữ liệu thật
              </span>
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              Hệ thống kết nối và lấy dữ liệu trực tiếp từ các bảng cơ sở dữ liệu Supabase:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-emerald-900">
              <li><strong>public.questions:</strong> Nạp toàn bộ 272 câu Tin học 6 (170 ABCD, 51 Đúng–Sai 4 ý, 51 Tự luận) cùng ngân hàng câu hỏi môn Toán, KHTN...</li>
              <li><strong>public.protected_solutions:</strong> Lưu trữ đáp án, barem chấm điểm và giải thích chi tiết, được bảo vệ qua chính sách phân quyền RLS.</li>
              <li><strong>public.profiles:</strong> Quản lý vai trò Giáo viên / Quản trị viên / Học sinh theo tài khoản đăng nhập.</li>
            </ul>
          </div>
        </div>

        {/* Supabase Connection Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#082B52]">1. Thông tin kết nối Supabase</h4>
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center space-x-1 cursor-pointer font-medium"
              title="Đặt lại về thông số mặc định"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Khôi phục mặc định</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Supabase Project URL (VITE_SUPABASE_URL):
              </label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-3 py-2 border rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Supabase Publishable/Anon Key (VITE_SUPABASE_PUBLISHABLE_KEY):
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={e => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6... hoặc sb_publishable_..."
                className="w-full px-3 py-2 border rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="px-4 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl font-bold shadow-xs disabled:opacity-50 text-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{testStatus === 'testing' ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối thực tế'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs text-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu cấu hình</span>
              </button>

              {saveNotice && (
                <span className="text-xs font-bold text-emerald-600 animate-fadeIn">
                  {saveNotice}
                </span>
              )}
            </div>

            {testMessage && (
              <div className="space-y-1 pt-1">
                <span className={`text-xs font-bold block ${
                  testStatus === 'success' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {testMessage}
                </span>
                {testDetails && (
                  <div className="text-[11px] text-slate-600 space-x-2">
                    <span>• CSDL: <strong className={testDetails.db ? 'text-emerald-700' : 'text-amber-700'}>{testDetails.db ? 'Đã kết nối' : 'Chưa phản hồi'}</strong></span>
                    <span>• Dịch vụ Auth: <strong className={testDetails.auth ? 'text-emerald-700' : 'text-amber-700'}>{testDetails.auth ? 'Đã xác minh (Có phiên)' : 'Chưa xác thực (Chưa có phiên)'}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Diagnostic Troubleshooting Card when Failed to fetch occurs */}
            {(isPausedError || testStatus === 'error') && (
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/90 space-y-2.5 text-xs text-amber-950 mt-3 animate-fadeIn">
                <div className="font-bold text-amber-900 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Hướng dẫn khắc phục khi máy chủ không phản hồi (Failed to fetch):</span>
                  </div>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-bold underline"
                  >
                    <span>Mở Supabase</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-2 text-xs text-amber-900 leading-relaxed">
                  <div className="flex items-start space-x-2">
                    <span className="font-bold text-amber-800 shrink-0 mt-0.5">1.</span>
                    <div>
                      <strong>Dự án Supabase đang ở trạng thái TẠM DỪNG (Paused):</strong> Trên gói Supabase Free, máy chủ sẽ tự động tạm ngắt kết nối nếu không có hoạt động trong 7 ngày. Khi vào <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-700 underline font-semibold">Supabase Dashboard</a>, nếu thấy banner thông báo màu vàng <em>"Project is paused"</em>, bạn chỉ cần bấm nút <strong>"Restore project"</strong>. Sau 1–2 phút máy chủ chuyển sang đèn xanh Active là kết nối lại bình thường.
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <span className="font-bold text-amber-800 shrink-0 mt-0.5">2.</span>
                    <div>
                      <strong>Kiểm tra lại URL & Key chính xác:</strong> Trong giao diện Supabase của dự án (ví dụ <code>kien-thuc-thcs</code>), nhấp vào nút <strong>Connect</strong> ở thanh menu trên cùng hoặc vào <strong>Settings ➔ API</strong> để sao chép đúng Project URL và <code>anon / publishable key</code>, sau đó dán vào ô bên trên và bấm <strong>"Lưu cấu hình"</strong>.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SQL Migration & RLS Guide */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#082B52] flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>2. File SQL Migrations & Phân quyền RLS</span>
            </h4>

            <button
              type="button"
              onClick={handleDownloadSql}
              className="flex items-center space-x-1 text-xs text-[#006BFF] font-bold hover:underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file SQL</span>
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Để kích hoạt đồng bộ phân hệ <strong>Lớp học &amp; Bài được giao</strong> trên Supabase đã có <code>profiles</code> &amp; <code>questions</code>, hãy chạy lần lượt 2 file trong Supabase SQL Editor:
            <br />
            <strong>Bước 1:</strong> <code>src/data/01_bootstrap_assignment_tables.sql</code> ➔ <strong>Bước 2:</strong> <code>src/data/02_sync_classes_exams_assignments.sql</code>.
          </p>

          <div className="p-3 bg-white rounded-lg border font-mono text-[11px] text-slate-700 max-h-36 overflow-y-auto space-y-1">
            <p className="text-slate-500 font-bold">-- 1. Cấp quyền Quản trị viên (Admin) cho tài khoản:</p>
            <p className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">UPDATE public.profiles SET role = 'admin' WHERE email = 'dieptoan.net@gmail.com';</p>
            <p className="text-slate-500 font-bold mt-2">-- 2. Cấp quyền RLS INSERT cho bảng questions & protected_solutions:</p>
            <p className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;</p>
            <p className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">GRANT SELECT, INSERT, UPDATE, DELETE ON public.protected_solutions TO authenticated;</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#082B52] hover:bg-[#0c3866] text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

