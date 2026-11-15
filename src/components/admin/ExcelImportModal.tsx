import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  RefreshCw,
  Upload,
  X
} from 'lucide-react';
import {
  downloadClassStudentsTemplate,
  downloadImportResultReport,
  downloadStudentInitialCredentialsSheet,
  downloadTeachersTemplate,
  downloadTeachingAssignmentsTemplate,
  parseExcelImportFile,
  type ExcelImportKind,
  type ParsedAssignmentImportRow,
  type ParsedStudentImportRow,
  type ParsedTeacherImportRow
} from '../../utils/importExportTemplates';
import type { ExcelImportBatchResult, ExcelImportRowResult } from '../../../server/adminAccountsService';

export interface ExcelImportTargetClass {
  id: string;
  name: string;
  classCode?: string | null;
  grade: string;
  schoolYear: string;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  kind: ExcelImportKind;
  targetClass?: ExcelImportTargetClass | null;
  defaultSchoolYear?: string;
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
}

type ImportStep = 'upload' | 'preview' | 'result';

const KIND_META: Record<
  ExcelImportKind,
  { title: string; subtitle: string; endpointSlug: string }
> = {
  students: {
    title: 'Nhập học sinh từ Excel vào lớp',
    subtitle: 'Mẫu chuẩn 2 cột: Mã học sinh, Họ và tên (không cần email học sinh)',
    endpointSlug: 'students'
  },
  teachers: {
    title: 'Nhập danh sách giáo viên từ Excel',
    subtitle: 'Mẫu chuẩn 3 cột: Mã giáo viên, Họ và tên, Email đăng nhập',
    endpointSlug: 'teachers'
  },
  assignments: {
    title: 'Nhập phân công giảng dạy từ Excel',
    subtitle: 'Mẫu chuẩn 4 cột: Năm học, Mã giáo viên, Môn, Mã lớp',
    endpointSlug: 'assignments'
  }
};

function getRowStatusClass(status: ExcelImportRowResult['status']): string {
  switch (status) {
    case 'ready':
    case 'created':
    case 'reused':
      return 'text-emerald-800 bg-emerald-50 border-emerald-200';
    case 'skipped':
      return 'text-slate-700 bg-slate-100 border-slate-200';
    case 'partial_failed':
      return 'text-amber-900 bg-amber-50 border-amber-300';
    case 'error':
      return 'text-red-800 bg-red-50 border-red-200';
  }
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  kind,
  targetClass,
  defaultSchoolYear = '2025-2026',
  getAccessToken,
  onClose,
  onCompleted
}) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<
    ParsedStudentImportRow[] | ParsedTeacherImportRow[] | ParsedAssignmentImportRow[]
  >([]);
  const [previewResult, setPreviewResult] = useState<ExcelImportBatchResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ExcelImportBatchResult | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryingRowNum, setRetryingRowNum] = useState<number | null>(null);
  const [showInitialPasswords, setShowInitialPasswords] = useState<boolean>(false);
  const [copiedRowNum, setCopiedRowNum] = useState<number | null>(null);

  if (!isOpen) return null;

  const meta = KIND_META[kind];

  const resetModal = () => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setPreviewResult(null);
    setConfirmResult(null);
    setErrorMsg(null);
    setRetryingRowNum(null);
    setShowInitialPasswords(false);
    setCopiedRowNum(null);
  };

  const handleClose = () => {
    if (busy) return;
    resetModal();
    onClose();
  };

  const handleDownloadTemplate = () => {
    if (kind === 'students') {
      downloadClassStudentsTemplate(targetClass?.name, targetClass?.schoolYear);
    } else if (kind === 'teachers') {
      downloadTeachersTemplate();
    } else {
      downloadTeachingAssignmentsTemplate(defaultSchoolYear);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    if (kind === 'students' && !targetClass?.id) {
      setErrorMsg('Chưa xác định lớp đích để nhập học sinh.');
      return;
    }

    setBusy(true);
    try {
      const parsed = await parseExcelImportFile(file, kind);
      if (!parsed.rows || parsed.rows.length === 0) {
        setErrorMsg('Tệp Excel không có dòng dữ liệu nào để kiểm tra.');
        setBusy(false);
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Phiên đăng nhập Quản trị viên đã hết hạn. Vui lòng đăng nhập lại.');
        setBusy(false);
        return;
      }

      const body =
        kind === 'students'
          ? { classId: targetClass?.id, rows: parsed.rows }
          : { rows: parsed.rows };

      const res = await fetch(`/api/admin/import/${meta.endpointSlug}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        setErrorMsg(payload?.message || `Không thể kiểm tra dữ liệu Excel (${res.status}).`);
        setBusy(false);
        return;
      }

      setFileName(file.name);
      setParsedRows(parsed.rows);
      setPreviewResult(payload as ExcelImportBatchResult);
      setStep('preview');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể đọc tệp Excel. Vui lòng kiểm tra định dạng .xlsx / .xls.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (busy || parsedRows.length === 0) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Phiên đăng nhập Quản trị viên đã hết hạn.');
        setBusy(false);
        return;
      }

      const body =
        kind === 'students'
          ? { classId: targetClass?.id, rows: parsedRows }
          : { rows: parsedRows };

      const res = await fetch(`/api/admin/import/${meta.endpointSlug}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        setErrorMsg(payload?.message || `Không thể thực hiện nhập dữ liệu (${res.status}).`);
        setBusy(false);
        return;
      }

      setConfirmResult(payload as ExcelImportBatchResult);
      setStep('result');
      await onCompleted();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi mạng khi xác nhận nhập Excel.');
    } finally {
      setBusy(false);
    }
  };

  const handleRetryStudentClassAssign = async (row: ExcelImportRowResult) => {
    if (!row.accountId || !targetClass?.id || retryingRowNum !== null) return;
    setRetryingRowNum(row.rowNumber);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Phiên đăng nhập đã hết hạn.');
        setRetryingRowNum(null);
        return;
      }

      const res = await fetch(`/api/admin/users/${row.accountId}/assign-class`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ classId: targetClass.id })
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        setErrorMsg(payload?.message || 'Thử gán lớp lại vẫn chưa thành công.');
        setRetryingRowNum(null);
        return;
      }

      setConfirmResult(prev => {
        if (!prev) return prev;
        const updatedRows = prev.rows.map(item =>
          item.rowNumber === row.rowNumber
            ? {
                ...item,
                status: 'reused' as const,
                statusLabel: 'Đã gán lớp thành công',
                classAssigned: true,
                canRetryClassAssign: false,
                message: `Đã gán học sinh vào lớp ${targetClass.name} thành công.`
              }
            : item
        );
        return {
          ...prev,
          summary: {
            ...prev.summary,
            reusedCount: prev.summary.reusedCount + 1,
            partialFailedCount: Math.max(0, prev.summary.partialFailedCount - 1)
          },
          rows: updatedRows
        };
      });
      await onCompleted();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi khi thử gán lớp lại.');
    } finally {
      setRetryingRowNum(null);
    }
  };

  const activeData = step === 'result' ? confirmResult : previewResult;
  const columnKeys =
    activeData && activeData.rows.length > 0 ? Object.keys(activeData.rows[0].columns) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto font-serif"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-5 my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3.5 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] text-[#006BFF]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#082B52]">{meta.title}</h3>
              <p className="text-xs text-slate-600 mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-step indicator */}
        <div className="flex items-center gap-2 text-xs font-bold shrink-0">
          <span
            className={`px-3 py-1.5 rounded-lg border ${
              step === 'upload'
                ? 'bg-[#082B52] text-white border-[#082B52]'
                : 'bg-[#F3F8FF] text-[#082B52] border-[#DCE8F7]'
            }`}
          >
            1. Tải lên
          </span>
          <span className="text-slate-400">→</span>
          <span
            className={`px-3 py-1.5 rounded-lg border ${
              step === 'preview'
                ? 'bg-[#082B52] text-white border-[#082B52]'
                : 'bg-[#F3F8FF] text-[#082B52] border-[#DCE8F7]'
            }`}
          >
            2. Xem trước
          </span>
          <span className="text-slate-400">→</span>
          <span
            className={`px-3 py-1.5 rounded-lg border ${
              step === 'result'
                ? 'bg-[#082B52] text-white border-[#082B52]'
                : 'bg-[#F3F8FF] text-[#082B52] border-[#DCE8F7]'
            }`}
          >
            3. Kết quả nhập
          </span>
        </div>

        {/* Target class banner for student import */}
        {kind === 'students' && targetClass && (
          <div className="p-3.5 rounded-xl bg-[#F3F8FF] border border-[#CBE2FB] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="text-[#082B52] space-y-0.5">
              <p className="font-bold text-sm">
                Lớp đích: {targetClass.name} (Khối {targetClass.grade})
              </p>
              <p className="text-slate-600">
                Năm học: <strong className="text-[#082B52]">{targetClass.schoolYear}</strong>
                {targetClass.classCode ? (
                  <>
                    {' '}
                    · Mã lớp: <strong className="font-mono text-[#006BFF]">{targetClass.classCode}</strong>
                  </>
                ) : null}
              </p>
            </div>
            <span className="text-[11px] text-slate-600">
              Dữ liệu các năm học trước của học sinh luôn được giữ nguyên.
            </span>
          </div>
        )}

        {/* Error banner */}
        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5 shrink-0"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Step body */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {step === 'upload' && (
            <div className="space-y-4">
              {kind === 'students' && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <KeyRound className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Hướng dẫn nhập học sinh không cần Email:</span>
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-emerald-900/90 leading-relaxed">
                    <li>
                      Tệp Excel chỉ cần đúng <strong>2 cột</strong>: <code>Mã học sinh</code> và <code>Họ và tên</code>. Không yêu cầu email cá nhân và không gửi thư mời.
                    </li>
                    <li>
                      Học sinh mới sẽ được tạo tài khoản trực tiếp với tên đăng nhập là <strong>Mã học sinh</strong> và một <strong>Mật khẩu khởi tạo ngẫu nhiên</strong> (yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên).
                    </li>
                    <li>
                      Học sinh đã có tài khoản từ trước (khớp <code>Mã học sinh</code>) sẽ được giữ nguyên tài khoản &amp; mật khẩu hiện có, chỉ bổ sung vào lớp nếu chưa có trong lớp.
                    </li>
                  </ul>
                </div>
              )}

              <div className="p-5 rounded-2xl border border-dashed border-[#9EC5F8] bg-[#F8FBFF] text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#DCE8F7] text-[#006BFF] flex items-center justify-center mx-auto">
                  {busy ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#082B52]">
                    {busy ? 'Đang đọc và kiểm tra dữ liệu với Supabase...' : 'Chọn tệp Excel (.xlsx, .xls) hoặc CSV (.csv) để kiểm tra trước'}
                  </p>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto">
                    {kind === 'students'
                      ? 'Hệ thống sẽ đối chiếu Mã học sinh với dữ liệu hiện có trước khi tạo tài khoản và xếp lớp. Bạn có thể tải mẫu chuẩn 2 cột bên dưới.'
                      : 'Hệ thống sẽ kiểm tra từng dòng trước khi ghi dữ liệu vào Supabase Auth và CSDL. Bạn có thể tải tệp mẫu để điền đúng tên cột.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#DCE8F7] bg-white hover:bg-slate-50 text-xs font-bold text-[#082B52] whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 text-[#006BFF]" />
                    <span>{kind === 'students' ? 'Tải mẫu Excel 2 cột (.xlsx)' : 'Tải mẫu Excel (.xlsx)'}</span>
                  </button>

                  <label className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white text-xs font-bold cursor-pointer whitespace-nowrap">
                    <Upload className="w-4 h-4" />
                    <span>{busy ? 'Đang kiểm tra...' : 'Chọn tệp Excel / CSV'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      disabled={busy}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {(step === 'preview' || step === 'result') && activeData && (
            <div className="space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <div className="p-3 rounded-xl border border-[#DCE8F7] bg-[#F8FBFF]">
                  <span className="text-slate-500 block">Tổng số dòng</span>
                  <strong className="text-lg text-[#082B52] tabular-nums">{activeData.summary.totalRows}</strong>
                </div>
                {step === 'preview' ? (
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70">
                    <span className="text-emerald-800 block">Sẵn sàng nhập</span>
                    <strong className="text-lg text-emerald-900 tabular-nums">{activeData.summary.readyToApply}</strong>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70">
                    <span className="text-emerald-800 block">Tạo mới</span>
                    <strong className="text-lg text-emerald-900 tabular-nums">{activeData.summary.createdCount}</strong>
                  </div>
                )}
                <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/60">
                  <span className="text-blue-800 block">{step === 'preview' ? 'Ghi chú / Tệp' : 'Dùng lại / Xếp lớp'}</span>
                  <strong className="text-lg text-[#082B52] tabular-nums">
                    {step === 'preview' ? fileName.slice(0, 14) : activeData.summary.reusedCount}
                  </strong>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-slate-600 block">Bỏ qua (đã có)</span>
                  <strong className="text-lg text-slate-800 tabular-nums">{activeData.summary.skippedCount}</strong>
                </div>
                <div className="p-3 rounded-xl border border-red-200 bg-red-50/70">
                  <span className="text-red-800 block">
                    Lỗi{activeData.summary.partialFailedCount > 0 ? ` / Gán lớp lỗi (${activeData.summary.partialFailedCount})` : ''}
                  </span>
                  <strong className="text-lg text-red-900 tabular-nums">
                    {activeData.summary.errorCount + activeData.summary.partialFailedCount}
                  </strong>
                </div>
              </div>

              {step === 'result' &&
                kind === 'students' &&
                activeData.rows.some(r => Boolean(r.initialPassword)) && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-amber-900">
                        <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                          Đã khởi tạo mật khẩu lần đầu cho{' '}
                          {activeData.rows.filter(r => Boolean(r.initialPassword)).length} học sinh mới
                        </span>
                      </p>
                      <p className="text-amber-900/90 leading-relaxed">
                        Vì lý do bảo mật, mật khẩu khởi tạo <strong>chỉ hiển thị một lần duy nhất</strong> tại bước này và không lưu dạng rõ trong CSDL. Hãy tải phiếu mật khẩu để phát cho học sinh.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowInitialPasswords(v => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 text-amber-900 font-bold"
                      >
                        {showInitialPasswords ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Ẩn mật khẩu</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Hiện mật khẩu</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadStudentInitialCredentialsSheet(
                            targetClass?.name || 'Lop',
                            targetClass?.schoolYear || defaultSchoolYear,
                            activeData.rows
                              .filter(r => Boolean(r.initialPassword))
                              .map(r => ({
                                studentCode: r.columns['Mã học sinh'] || r.loginIdentifier || '',
                                fullName: r.columns['Họ và tên'] || '',
                                initialPassword: r.initialPassword || ''
                              }))
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#082B52] hover:bg-[#0d3a6d] text-white font-bold shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải phiếu mật khẩu khởi tạo (.xlsx)</span>
                      </button>
                    </div>
                  </div>
                )}

              {activeData.summary.partialFailedCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Có <strong>{activeData.summary.partialFailedCount}</strong> học sinh đã được tạo tài khoản thành công nhưng bước gán vào lớp bị gián đoạn. Bấm <strong>Thử gán lớp lại</strong> ngay trên từng dòng bên dưới.
                  </span>
                </div>
              )}

              {/* Row Table */}
              <div className="border border-[#DCE8F7] rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[340px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F3F8FF] text-[#12345B] font-bold border-b border-[#DCE8F7] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap">Dòng</th>
                        {columnKeys.map(col => (
                          <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 whitespace-nowrap">Trạng thái</th>
                        {step === 'result' && kind === 'students' && (
                          <th className="py-2.5 px-3 whitespace-nowrap">Mật khẩu khởi tạo</th>
                        )}
                        <th className="py-2.5 px-3">Chi tiết</th>
                        {step === 'result' && kind === 'students' && (
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Xử lý</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeData.rows.map(row => (
                        <tr key={row.rowNumber} className="hover:bg-[#F8FBFF]">
                          <td className="py-2 px-3 font-mono text-slate-500 tabular-nums">{row.rowNumber}</td>
                          {columnKeys.map(col => (
                            <td key={col} className="py-2 px-3 text-[#082B52] font-medium whitespace-nowrap">
                              {row.columns[col] || '—'}
                            </td>
                          ))}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${getRowStatusClass(
                                row.status
                              )}`}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          {step === 'result' && kind === 'students' && (
                            <td className="py-2 px-3 whitespace-nowrap">
                              {row.initialPassword ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <code className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 font-mono font-bold text-[#082B52]">
                                    {showInitialPasswords ? row.initialPassword : '••••••••••'}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.initialPassword && navigator.clipboard) {
                                        navigator.clipboard.writeText(row.initialPassword);
                                        setCopiedRowNum(row.rowNumber);
                                        setTimeout(() => setCopiedRowNum(null), 1800);
                                      }
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-[#006BFF]"
                                    title="Sao chép mật khẩu khởi tạo"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  {copiedRowNum === row.rowNumber && (
                                    <span className="text-[10px] font-bold text-emerald-700">Đã chép</span>
                                  )}
                                </div>
                              ) : row.status === 'reused' || row.status === 'skipped' ? (
                                <span className="text-[11px] text-slate-500">Giữ nguyên mật khẩu hiện có</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          )}
                          <td className="py-2 px-3 text-slate-700 leading-relaxed min-w-[220px]">
                            {row.message}
                          </td>
                          {step === 'result' && kind === 'students' && (
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              {row.canRetryClassAssign && row.accountId ? (
                                <button
                                  type="button"
                                  disabled={retryingRowNum !== null}
                                  onClick={() => handleRetryStudentClassAssign(row)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold disabled:opacity-50"
                                >
                                  {retryingRowNum === row.rowNumber ? 'Đang gán...' : 'Thử gán lớp lại'}
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 shrink-0">
          {step === 'upload' && (
            <>
              <span className="text-[11px] text-slate-500">
                Bước 1/3: Tải mẫu chuẩn hoặc chọn tệp Excel từ máy tính.
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Đóng
              </button>
            </>
          )}

          {step === 'preview' && previewResult && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep('upload');
                  setErrorMsg(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-40"
              >
                Chọn tệp khác
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={busy || previewResult.summary.readyToApply === 0}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl disabled:opacity-40 whitespace-nowrap"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xử lý nhập...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Xác nhận nhập ({previewResult.summary.readyToApply} dòng)</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'result' && confirmResult && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadImportResultReport(
                      kind,
                      confirmResult.rows.map(r => ({
                        rowNumber: r.rowNumber,
                        statusLabel: r.statusLabel,
                        message: r.message,
                        columns: r.columns
                      }))
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#082B52] border border-[#DCE8F7] bg-[#F3F8FF] hover:bg-[#E4F0FF] rounded-xl whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#006BFF]" />
                  <span>Tải báo cáo kết quả (.xlsx)</span>
                </button>

                {kind === 'students' &&
                  confirmResult.rows.some(r => Boolean(r.initialPassword)) && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadStudentInitialCredentialsSheet(
                          targetClass?.name || 'Lop',
                          targetClass?.schoolYear || defaultSchoolYear,
                          confirmResult.rows
                            .filter(r => Boolean(r.initialPassword))
                            .map(r => ({
                              studentCode: r.columns['Mã học sinh'] || r.loginIdentifier || '',
                              fullName: r.columns['Họ và tên'] || '',
                              initialPassword: r.initialPassword || ''
                            }))
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-950 border border-amber-300 bg-amber-100 hover:bg-amber-200/80 rounded-xl whitespace-nowrap"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-800" />
                      <span>Tải phiếu mật khẩu khởi tạo (.xlsx)</span>
                    </button>
                  )}
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-xs font-bold bg-[#082B52] hover:bg-[#0d3a6d] text-white rounded-xl"
              >
                Hoàn tất
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
