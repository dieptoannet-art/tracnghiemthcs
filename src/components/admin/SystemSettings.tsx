import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, Shield, HardDrive, Download, RotateCcw, CheckCircle2, Palette } from 'lucide-react';

interface SystemSettingsProps {
  onOpenSupabaseConfig: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ onOpenSupabaseConfig }) => {
  const { auditLogs, questions, classes, exams, submissions, resetDemoData, isDemoMode } = useApp();
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [isPremium2027, setPremium2027] = useState(true);

  const handleBackupJson = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      school: 'Trường THCS Tây Đô',
      teacher: 'Diệp Thanh Toàn',
      questions,
      classes,
      exams,
      submissions
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sao_Luu_Du_Lieu_THCS_Tay_Do_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice('Đã tải xuống tệp sao lưu dữ liệu toàn hệ thống JSON thành công!');
    setTimeout(() => setBackupNotice(null), 3000);
  };

  return (
    <div className="space-y-6 font-edtech">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#102C54] flex items-center space-x-2.5 tracking-tight">
            <Settings className="w-6 h-6 text-[#1769F4]" />
            <span>Mẫu biểu & Cấu hình hệ thống</span>
          </h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            Trường THCS Tây Đô • Quản trị hệ thống, nhật ký thao tác và sao lưu cơ sở dữ liệu
          </p>
        </div>
      </div>

      {backupNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center space-x-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-[#12A879] shrink-0" />
          <span>{backupNotice}</span>
        </div>
      )}

      {/* Database connection, backup & Design System 2027 flag */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_8px_24px_-12px_rgba(16,44,84,0.08)] flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-[#1769F4]" />
              <h3 className="font-bold text-sm text-[#102C54]">Cơ sở dữ liệu & Chế độ</h3>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Hiện tại: <strong className="text-[#172B4D]">{isDemoMode ? 'Dữ liệu minh họa (Demo Client)' : 'Supabase Live Connected'}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSupabaseConfig}
            className="self-start px-4 py-2 bg-[#1769F4] text-white rounded-xl text-xs font-bold hover:bg-[#1256CE] shadow-xs cursor-pointer whitespace-nowrap"
          >
            Cấu hình kết nối Supabase
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_8px_24px_-12px_rgba(16,44,84,0.08)] flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-[#12A879]" />
              <h3 className="font-bold text-sm text-[#102C54]">Sao lưu & Phục hồi dữ liệu</h3>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Tải về toàn bộ cơ sở dữ liệu câu hỏi, lớp học, đề thi và bảng điểm dưới dạng JSON chuẩn.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBackupJson}
              className="px-4 py-2 bg-[#12A879] text-white rounded-xl text-xs font-bold hover:bg-[#0E8F66] shadow-xs flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Tải bản sao lưu JSON</span>
            </button>
            <button
              type="button"
              onClick={resetDemoData}
              className="px-3 py-2 border border-[#E2E8F0] text-[#64748B] hover:text-[#102C54] rounded-xl text-xs font-semibold hover:bg-slate-50 flex items-center space-x-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Khôi phục gốc</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_8px_24px_-12px_rgba(16,44,84,0.08)] flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Palette className="w-5 h-5 text-[#1769F4]" />
                <h3 className="font-bold text-sm text-[#102C54]">Giao diện Smart EDU 2027</h3>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${isPremium2027 ? 'bg-emerald-50 text-[#12A879]' : 'bg-slate-100 text-slate-600'}`}>
                {isPremium2027 ? '2027 Active' : 'Classic'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Chuyển đổi an toàn giữa hệ thống giao diện 2027 và Classic (<code>?ui=2027|classic</code>), không ảnh hưởng dữ liệu.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPremium2027(!isPremium2027)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                isPremium2027
                  ? 'bg-[#102C54] hover:bg-[#173D73] text-white'
                  : 'bg-[#1769F4] hover:bg-[#1256CE] text-white'
              }`}
            >
              {isPremium2027 ? 'Chuyển tạm về Classic' : 'Bật Giao diện 2027'}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-[0_8px_24px_-12px_rgba(16,44,84,0.08)]">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#102C54] flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#1769F4]" />
            <span>Nhật ký thao tác hệ thống (Audit Logs)</span>
          </h3>
          <span className="text-xs font-semibold text-[#64748B] tabular-nums">{auditLogs.length} sự kiện</span>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#EAF3FF]/75 text-[#102C54] uppercase font-bold sticky top-0">
              <tr>
                <th className="py-2.5 px-4">Thời gian</th>
                <th className="py-2.5 px-4">Người thực hiện</th>
                <th className="py-2.5 px-4">Vai trò</th>
                <th className="py-2.5 px-4">Hành động</th>
                <th className="py-2.5 px-4">Đối tượng</th>
                <th className="py-2.5 px-4">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]/70">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-[#F6F9FD]">
                  <td className="py-2.5 px-4 text-[#64748B] whitespace-nowrap tabular-nums">{log.timestamp}</td>
                  <td className="py-2.5 px-4 font-bold text-[#102C54]">{log.actor}</td>
                  <td className="py-2.5 px-4 uppercase text-[10px] font-semibold text-[#64748B]">{log.role}</td>
                  <td className="py-2.5 px-4 font-semibold text-[#1769F4]">{log.action}</td>
                  <td className="py-2.5 px-4 font-mono">{log.target}</td>
                  <td className="py-2.5 px-4 text-[#64748B] max-w-xs truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

