import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  X
} from 'lucide-react';
import { Grade, YccdItem } from '../../types';
import {
  buildYccdIdentityKey,
  mergeYccdCatalog,
  parseYccdCsv,
  YccdCsvGroupStat,
  YccdCsvParseError,
  YccdCsvParseResult
} from '../../utils/yccdCsvParser';

interface YccdCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCatalog: YccdItem[];
  onConfirmImport: (items: YccdItem[]) => { inserted: number; updated: number; unchanged: number };
}

interface CombinedCsvParseResult extends YccdCsvParseResult {
  fileNames: string[];
}

export const YccdCsvImportModal: React.FC<YccdCsvImportModalProps> = ({
  isOpen,
  onClose,
  existingCatalog,
  onConfirmImport
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<CombinedCsvParseResult | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState<boolean>(false);
  const [importDone, setImportDone] = useState<{
    inserted: number;
    updated: number;
    unchanged: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setParseResult(null);
      setReadError(null);
      setImportDone(null);
      setIsReading(false);
    }
  }, [isOpen]);

  const previewMergeStats = useMemo(() => {
    if (!parseResult || parseResult.items.length === 0) return null;
    const { inserted, updated, unchanged } = mergeYccdCatalog(existingCatalog, parseResult.items);
    return { inserted, updated, unchanged };
  }, [parseResult, existingCatalog]);

  const subjectMatrixRows = useMemo(() => {
    if (!parseResult || parseResult.groupStats.length === 0) return [];
    const bySubj = new Map<string, { subject: string; counts: Record<Grade, number>; total: number }>();
    for (const st of parseResult.groupStats) {
      let row = bySubj.get(st.subject);
      if (!row) {
        row = { subject: st.subject, counts: { '6': 0, '7': 0, '8': 0, '9': 0 }, total: 0 };
        bySubj.set(st.subject, row);
      }
      row.counts[st.grade] += st.count;
      row.total += st.count;
    }
    return Array.from(bySubj.values()).sort((a, b) => a.subject.localeCompare(b.subject, 'vi'));
  }, [parseResult]);

  if (!isOpen) return null;

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(
      f => f.name.toLowerCase().endsWith('.csv') || f.type.includes('csv') || f.type === 'text/plain' || f.type === ''
    );
    if (files.length === 0) {
      setReadError('Vui lòng chọn ít nhất một tệp định dạng .csv.');
      return;
    }

    setReadError(null);
    setImportDone(null);
    setIsReading(true);

    try {
      const combinedItems: YccdItem[] = [];
      const seenIdentity = new Map<string, number>();
      const combinedErrors: YccdCsvParseError[] = [];
      let totalDataRows = 0;

      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(buffer);
        const parsed = parseYccdCsv(text);
        totalDataRows += parsed.totalDataRows;

        for (const err of parsed.errors) {
          combinedErrors.push({
            ...err,
            reason: files.length > 1 ? `[${file.name}] ${err.reason}` : err.reason
          });
        }

        for (const item of parsed.items) {
          const idKey = buildYccdIdentityKey(item);
          const dupIdx = seenIdentity.get(idKey);
          if (dupIdx !== undefined) {
            combinedItems[dupIdx] = {
              ...item,
              stableKey: combinedItems[dupIdx].stableKey,
              orderIndex: combinedItems[dupIdx].orderIndex
            };
          } else {
            seenIdentity.set(idKey, combinedItems.length);
            combinedItems.push({ ...item, orderIndex: combinedItems.length });
          }
        }
      }

      const statMap = new Map<string, YccdCsvGroupStat>();
      for (const it of combinedItems) {
        const k = `${it.subject}__${it.grade}`;
        const existing = statMap.get(k);
        if (existing) {
          existing.count += 1;
        } else {
          statMap.set(k, { subject: it.subject, grade: it.grade, count: 1 });
        }
      }

      setParseResult({
        fileNames: files.map(f => f.name),
        items: combinedItems,
        errors: combinedErrors,
        groupStats: Array.from(statMap.values()).sort(
          (a, b) => a.subject.localeCompare(b.subject, 'vi') || Number(a.grade) - Number(b.grade)
        ),
        totalDataRows
      });
    } catch (err: any) {
      setReadError(err?.message || 'Không thể đọc tệp CSV. Vui lòng kiểm tra định dạng UTF-8.');
      setParseResult(null);
    } finally {
      setIsReading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleConfirm = () => {
    if (!parseResult || parseResult.items.length === 0) return;
    const stats = onConfirmImport(parseResult.items);
    setImportDone(stats);
    setTimeout(() => {
      onClose();
    }, 950);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto font-serif">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#DCE8F7] relative space-y-5 my-6 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#006BFF] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#082B52]">
              Nhập danh mục Yêu cầu cần đạt (CSV)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Hỗ trợ chọn 1 hoặc nhiều tệp CSV UTF-8 (có hoặc không có BOM), tự động ánh xạ 11 cột chuẩn GDPT 2018 và
              đối chiếu khóa <b>Môn + Khối + ID YCCĐ</b> để cập nhật sạch sẽ, không tạo bản ghi trùng lặp.
            </p>
          </div>
        </div>

        {/* File Picker Zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-[#006BFF]/40 bg-[#F3F8FF]/70 rounded-2xl p-6 text-center space-y-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
          <Upload className="w-8 h-8 text-[#006BFF] mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#082B52]">
              {parseResult && parseResult.fileNames.length > 0
                ? parseResult.fileNames.length === 1
                  ? `Tệp đã chọn: ${parseResult.fileNames[0]}`
                  : `Đã chọn ${parseResult.fileNames.length} tệp CSV: ${parseResult.fileNames.join(', ')}`
                : 'Chọn một hoặc nhiều tệp .csv từ máy tính hoặc kéo thả vào đây'}
            </p>
            <p className="text-xs text-slate-500">
              Nhập lại cùng tệp hoặc bản sao (1), (2) sẽ cập nhật/giữ nguyên bản ghi cũ theo mã môn + khối + ID YCCĐ.
            </p>
          </div>
          <button
            type="button"
            disabled={isReading}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isReading ? 'Đang đọc tệp CSV...' : 'Chọn tệp CSV từ máy tính'}</span>
          </button>
        </div>

        {readError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{readError}</span>
          </div>
        )}

        {/* Preview Summary */}
        {parseResult && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#082B52]">
                  Kết quả kiểm tra ({parseResult.totalDataRows} dòng dữ liệu):
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                    Hợp lệ: {parseResult.items.length}
                  </span>
                  {parseResult.errors.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold">
                      Lỗi: {parseResult.errors.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Group stats matrix by Subject x Grade */}
              {subjectMatrixRows.length > 0 && (
                <div className="overflow-x-auto bg-white border border-blue-200 rounded-xl">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#EFF6FF] text-[#082B52] font-bold border-b border-blue-200">
                        <th className="text-left px-3 py-2">Môn học</th>
                        <th className="text-center px-2 py-2 w-16">Khối 6</th>
                        <th className="text-center px-2 py-2 w-16">Khối 7</th>
                        <th className="text-center px-2 py-2 w-16">Khối 8</th>
                        <th className="text-center px-2 py-2 w-16">Khối 9</th>
                        <th className="text-center px-3 py-2 w-20 text-[#006BFF]">Tổng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjectMatrixRows.map(row => (
                        <tr key={row.subject} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 font-bold text-[#082B52]">{row.subject}</td>
                          <td className="px-2 py-2 text-center text-slate-700 font-semibold">{row.counts['6']}</td>
                          <td className="px-2 py-2 text-center text-slate-700 font-semibold">{row.counts['7']}</td>
                          <td className="px-2 py-2 text-center text-slate-700 font-semibold">{row.counts['8']}</td>
                          <td className="px-2 py-2 text-center text-slate-700 font-semibold">{row.counts['9']}</td>
                          <td className="px-3 py-2 text-center font-bold text-[#006BFF]">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Deduplication preview */}
              {previewMergeStats && (
                <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center gap-3">
                  <span className="font-bold text-slate-800">Khi lưu vào danh mục:</span>
                  <span className="text-emerald-700 font-bold">+ {previewMergeStats.inserted} dòng mới</span>
                  <span className="text-amber-700 font-bold">↻ {previewMergeStats.updated} cập nhật</span>
                  <span className="text-slate-600 font-semibold">
                    = {previewMergeStats.unchanged} dòng trùng khóa giữ nguyên
                  </span>
                </div>
              )}
            </div>

            {/* Line-by-line errors */}
            {parseResult.errors.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 max-h-44 overflow-y-auto">
                <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Các dòng không hợp lệ sẽ bị bỏ qua ({parseResult.errors.length} dòng):</span>
                </div>
                <ul className="space-y-1 text-[11px] text-rose-700">
                  {parseResult.errors.map((err, i) => (
                    <li key={i} className="bg-white/80 p-1.5 rounded border border-rose-100">
                      <b>Dòng {err.rowNumber}:</b> {err.reason}
                      {err.rawPreview && <div className="text-slate-500 truncate mt-0.5">{err.rawPreview}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {importDone && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đã nhập xong! Thêm mới {importDone.inserted}, cập nhật {importDone.updated}, giữ nguyên{' '}
              {importDone.unchanged} bản ghi trùng khóa.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={!parseResult || parseResult.items.length === 0 || Boolean(importDone)}
            onClick={handleConfirm}
            className="px-5 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-40 cursor-pointer"
          >
            Xác nhận lưu ({parseResult?.items.length || 0} YCCĐ)
          </button>
        </div>
      </div>
    </div>
  );
};

