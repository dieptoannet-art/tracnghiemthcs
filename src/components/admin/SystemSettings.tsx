import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, Shield, HardDrive, Download, Upload, RotateCcw, CheckCircle2 } from 'lucide-react';

interface SystemSettingsProps {
  onOpenSupabaseConfig: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ onOpenSupabaseConfig }) => {
  const { auditLogs, questions, classes, exams, submissions, resetDemoData, isDemoMode } = useApp();
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
            <Settings className="w-6 h-6 text-purple-600" />
            <span>Mẫu biểu & Cấu hình hệ thống</span>
          </h2>
          <p className="text-sm text-slate-500">
            Trường THCS Tây Đô • Quản trị hệ thống, nhật ký thao tác và sao lưu cơ sở dữ liệu
          </p>
        </div>
      </div>

      {backupNotice && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-2xl flex items-center space-x-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{backupNotice}</span>
        </div>
      )}

      {/* Database connection & backup action row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-[#006BFF]" />
            <h3 className="font-bold text-sm text-[#082B52]">Cơ sở dữ liệu & Chế độ hoạt động</h3>
          </div>
          <p className="text-xs text-slate-600">
            Hiện tại: <b>{isDemoMode ? 'Dữ liệu minh họa (Demo Client)' : 'Supabase Live Connected'}</b>.
          </p>
          <button
            onClick={onOpenSupabaseConfig}
            className="px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs"
          >
            Cấu hình kết nối Supabase
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <Download className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-[#082B52]">Sao lưu & Phục hồi dữ liệu</h3>
          </div>
          <p className="text-xs text-slate-600">
            Tải về toàn bộ cơ sở dữ liệu câu hỏi, lớp học, đề thi và bảng điểm dưới dạng JSON chuẩn.
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBackupJson}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs flex items-center space-x-1"
            >
              <Download className="w-4 h-4" />
              <span>Tải bản sao lưu JSON</span>
            </button>
            <button
              onClick={resetDemoData}
              className="px-3 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 flex items-center space-x-1"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Khôi phục gốc</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden shadow-xs space-y-2">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#082B52] flex items-center space-x-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Nhật ký thao tác hệ thống (Audit Logs)</span>
          </h3>
          <span className="text-xs text-slate-400">{auditLogs.length} sự kiện</span>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F3F8FF] text-[#12345B] uppercase font-bold sticky top-0">
              <tr>
                <th className="py-2.5 px-4">Thời gian</th>
                <th className="py-2.5 px-4">Người thực hiện</th>
                <th className="py-2.5 px-4">Vai trò</th>
                <th className="py-2.5 px-4">Hành động</th>
                <th className="py-2.5 px-4">Đối tượng</th>
                <th className="py-2.5 px-4">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-2.5 px-4 font-bold text-[#082B52]">{log.actor}</td>
                  <td className="py-2.5 px-4 uppercase text-[10px] font-semibold text-slate-500">{log.role}</td>
                  <td className="py-2.5 px-4 font-semibold text-[#006BFF]">{log.action}</td>
                  <td className="py-2.5 px-4 font-mono">{log.target}</td>
                  <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
