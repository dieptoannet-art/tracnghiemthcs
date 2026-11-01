import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, UserCheck, Shield, Key, Plus, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { UserRole } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const AccountManagement: React.FC = () => {
  const { currentRole, user, userProfile, isDemoMode, addAuditLog } = useApp();

  const [accounts, setAccounts] = useState([
    { id: 'acc-01', name: 'Diệp Thanh Toàn', email: 'toan.dt@taydo.edu.vn', role: 'teacher', dept: 'Tổ Toán - Tin', status: 'Đang hoạt động' },
    { id: 'acc-02', name: 'Nguyễn Văn An', email: 'an.nv@taydo.edu.vn', role: 'student', dept: 'Lớp 8A1', status: 'Đang hoạt động' },
    { id: 'acc-03', name: 'Lê Thị Mai', email: 'mai.lt@taydo.edu.vn', role: 'teacher', dept: 'Tổ KHTN', status: 'Đang hoạt động' },
    { id: 'acc-04', name: 'Ban Giám Hiệu THCS Tây Đô', email: 'admin@taydo.edu.vn', role: 'admin', dept: 'Ban Giám Hiệu', status: 'Đang hoạt động' },
    { id: 'acc-05', name: 'Trần Văn Bình', email: 'binh.tv@taydo.edu.vn', role: 'reviewer', dept: 'Tổ KHXH', status: 'Đang hoạt động' }
  ]);

  const [isLoadingReal, setIsLoadingReal] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUsingRealData, setIsUsingRealData] = useState(false);

  // Fetch real profiles from Supabase if user is admin
  const fetchRealProfiles = async () => {
    if (!isSupabaseConfigured || isDemoMode || !user) return;

    setIsLoadingReal(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        const msg = error.message || '';
        if (
          msg.includes("Could not find the table 'public.profiles'") ||
          msg.includes('schema cache') ||
          error.code === 'PGRST204' ||
          error.code === 'PGRST205' ||
          error.code === '42P01'
        ) {
          setLoadError('Bảng public.profiles chưa được khởi tạo trên CSDL Supabase. Vui lòng chạy file SQL migration.');
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          setLoadError('Không thể kết nối mạng đến Supabase.');
        } else {
          setLoadError(msg);
        }
        setIsUsingRealData(false);
      } else if (data && data.length > 0) {
        const formatted = data.map(p => ({
          id: p.id,
          name: p.full_name || 'Chưa đặt tên',
          email: p.email,
          role: p.role,
          dept: p.grade ? `Khối ${p.grade}` : 'Trường THCS Tây Đô',
          status: 'Đang hoạt động'
        }));
        setAccounts(formatted);
        setIsUsingRealData(true);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setLoadError('Không thể kết nối mạng đến Supabase.');
      } else {
        setLoadError(msg || 'Không thể tải danh sách tài khoản từ Supabase.');
      }
      setIsUsingRealData(false);
    } finally {
      setIsLoadingReal(false);
    }
  };

  useEffect(() => {
    fetchRealProfiles();
  }, [user, isDemoMode]);

  const handleRoleChange = async (id: string, newRole: string) => {
    // If connected to Supabase and user is admin, update in Supabase
    if (isSupabaseConfigured && !isDemoMode && isUsingRealData) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', id);

        if (error) {
          alert(`Không thể cập nhật vai trò trên Supabase: ${error.message}`);
          return;
        }
      } catch (err: any) {
        alert(`Lỗi: ${err?.message || 'Không thể kết nối Supabase'}`);
        return;
      }
    }

    setAccounts(prev => prev.map(a => (a.id === id ? { ...a, role: newRole } : a)));
    addAuditLog('Phân quyền tài khoản', id, `Thay đổi vai trò thành ${newRole}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
            <Users className="w-6 h-6 text-[#006BFF]" />
            <span>Quản lý Tài khoản & Phân quyền bảo mật</span>
          </h2>
          <p className="text-sm text-slate-500">
            Hệ thống phân quyền RLS cấp cơ sở dữ liệu: Học sinh, Giáo viên bộ môn, Người kiểm duyệt và Quản trị
          </p>
        </div>

        {isSupabaseConfigured && !isDemoMode && (
          <button
            onClick={fetchRealProfiles}
            disabled={isLoadingReal}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReal ? 'animate-spin' : ''}`} />
            <span>{isLoadingReal ? 'Đang kết nối Supabase...' : 'Tải từ Supabase'}</span>
          </button>
        )}
      </div>

      {/* Real Data Status Badge */}
      <div className="flex items-center space-x-2">
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
            isUsingRealData
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          {isUsingRealData
            ? '● Dữ liệu thật từ bảng public.profiles trên Supabase'
            : '○ Dữ liệu trên trình duyệt'}
        </span>
        {loadError && (
          <span className="text-xs text-red-600 flex items-center space-x-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{loadError}</span>
          </span>
        )}
      </div>

      {/* Account Table */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#082B52]">
            Danh sách người dùng hệ thống ({accounts.length} tài khoản)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F3F8FF] text-[#12345B] text-xs uppercase font-bold border-b border-[#DCE8F7]">
              <tr>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Email đăng nhập</th>
                <th className="py-3 px-4">Đơn vị / Lớp</th>
                <th className="py-3 px-4">Vai trò hệ thống</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-[#082B52]">{acc.name}</td>
                  <td className="py-3 px-4 text-xs text-slate-600 font-mono">{acc.email}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{acc.dept}</td>
                  <td className="py-3 px-4">
                    <select
                      value={acc.role}
                      disabled={currentRole !== 'admin'}
                      onChange={e => handleRoleChange(acc.id, e.target.value)}
                      className="text-xs px-2.5 py-1 rounded-lg border font-semibold bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="student">Học sinh</option>
                      <option value="teacher">Giáo viên</option>
                      <option value="reviewer">Người kiểm duyệt</option>
                      <option value="admin">Quản trị viên</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {acc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
