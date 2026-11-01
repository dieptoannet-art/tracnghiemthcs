import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Database, Check, Copy, ExternalLink, Download, AlertCircle, X, ShieldCheck, Laptop, CheckCircle2 } from 'lucide-react';
import { testSupabaseConnection } from '../lib/supabase';

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
  const [testDetails, setTestDetails] = useState<{ auth?: boolean; db?: boolean } | null>(null);

  const handleTestConnection = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestStatus('error');
      setTestMessage('Vui lòng nhập đầy đủ Supabase Project URL và Publishable/Anon Key.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');
    setTestDetails(null);

    try {
      const res = await testSupabaseConnection(url.trim(), anonKey.trim());

      if (res.success) {
        setTestStatus('success');
        setTestMessage(res.message);
        setTestDetails({
          auth: res.authVerified,
          db: res.dbVerified
        });
        setSupabaseConfig({
          url: url.trim(),
          anonKey: anonKey.trim(),
          isConnected: true
        });
        try {
          localStorage.setItem(
            'taydo_supabase_config',
            JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
          );
        } catch {
          // ignore
        }
        // Run verification in context
        verifySupabase();
      } else {
        setTestStatus('error');
        setTestMessage(res.message || 'Không thể kết nối tới Supabase. Kiểm tra lại URL và Key.');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err?.message || 'Lỗi mạng hoặc CORS khi kết nối tới Supabase URL.');
    }
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
                Cấu hình & Trạng thái kết nối Supabase
              </h3>
              <p className="text-xs text-slate-500">
                Kiểm tra xác thực thực tế cho Auth và Cơ sở dữ liệu (PostgreSQL)
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
                'Chưa có URL và Publishable Key hợp lệ trong tệp biến môi trường (.env).'}
              {supabaseStatus === 'configured_unverified' &&
                'Đã điền URL và Key nhưng chưa thực hiện yêu cầu kiểm tra thực tế tới máy chủ Supabase.'}
              {supabaseStatus === 'verified_auth_only' &&
                'Đã xác minh thành công Dịch vụ Xác thực (Auth). Cơ sở dữ liệu chưa được xác minh.'}
              {supabaseStatus === 'verified_db_only' &&
                'Đã xác minh thành công Cơ sở dữ liệu (CSDL). Chưa có phiên đăng nhập Auth.'}
              {supabaseStatus === 'verified_all' &&
                'Đã xác minh thực tế thành công cả Dịch vụ Xác thực (Auth) và Cơ sở dữ liệu (CSDL).'}
              {supabaseStatus === 'error' &&
                'Có cấu hình nhưng kết nối tới máy chủ Supabase thất bại.'}
            </p>
          </div>

          <button
            onClick={verifySupabase}
            className="px-3 py-1.5 bg-white border rounded-lg text-xs font-bold shadow-2xs hover:bg-slate-50 shrink-0 self-start sm:self-auto"
          >
            Kiểm tra ngay
          </button>
        </div>

        {/* LocalStorage Note Banner */}
        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start space-x-2">
          <Laptop className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Lưu ý về lưu trữ dữ liệu hiện tại:</span>
            <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
              Các phân hệ Ngân hàng câu hỏi, Đề thi, Lớp học và Kết quả bài làm hiện đang lưu ở <strong>Dữ liệu trên trình duyệt (localStorage)</strong>. Hệ thống chưa tự động đồng bộ lên Supabase cho đến khi các bảng dữ liệu tương ứng được kích hoạt ở các bước kế tiếp.
            </p>
          </div>
        </div>

        {/* Supabase Connection Form */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-[#082B52]">1. Thông tin kết nối Supabase</h4>

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
                className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
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
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 pt-2">
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="px-4 py-2 bg-[#006BFF] text-white rounded-xl font-bold hover:bg-blue-600 shadow-xs disabled:opacity-50 text-xs"
              >
                {testStatus === 'testing' ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối thực tế'}
              </button>

              {testMessage && (
                <div className="space-y-1">
                  <span className={`text-xs font-bold block ${
                    testStatus === 'success' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {testMessage}
                  </span>
                  {testDetails && (
                    <div className="text-[11px] text-slate-600 space-x-2">
                      <span>• CSDL: <strong className={testDetails.db ? 'text-emerald-700' : 'text-amber-700'}>{testDetails.db ? 'Đã phản hồi' : 'Chưa phản hồi'}</strong></span>
                      <span>• Dịch vụ Auth: <strong className={testDetails.auth ? 'text-emerald-700' : 'text-amber-700'}>{testDetails.auth ? 'Đã xác minh (Có phiên)' : 'Chưa xác thực (Chưa có phiên)'}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
              onClick={handleDownloadSql}
              className="flex items-center space-x-1 text-xs text-[#006BFF] font-bold hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file SQL</span>
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Tệp <code>/src/data/supabase_schema.sql</code> đã cấu hình bảo vệ hồ sơ người dùng, phân quyền RLS và bảo vệ đáp án.
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
            onClick={onClose}
            className="px-5 py-2 bg-[#082B52] text-white font-bold rounded-xl text-xs hover:bg-[#0c3866]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
