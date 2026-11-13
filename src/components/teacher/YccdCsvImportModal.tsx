import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  X
} from 'lucide-react';
import { YccdItem } from '../../types';
import {
  mergeYccdCatalog,
  parseYccdCsv,
  YccdCsvParseResult
} from '../../utils/yccdCsvParser';

interface YccdCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCatalog: YccdItem[];
  onConfirmImport: (items: YccdItem[]) => { inserted: number; updated: number; unchanged: number };
}

export const YccdCsvImportModal: React.FC<YccdCsvImportModalProps> = ({
  isOpen,
  onClose,
  existingCatalog,
  onConfirmImport
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<YccdCsvParseResult | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState<{
    inserted: number;
    updated: number;
    unchanged: number;
  } | null>(null);

  const previewMergeStats = useMemo(() => {
    if (!parseResult || parseResult.items.length === 0) return null;
    const { inserted, updated, unchanged } = mergeYccdCatalog(existingCatalog, parseResult.items);
    return { inserted, updated, unchanged };
  }, [parseResult, existingCatalog]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setReadError(null);
    setImportDone(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      const parsed = parseYccdCsv(text);
      setParseResult(parsed);
    } catch (err: any) {
      setReadError(err?.message || 'Không thể đọc tệp CSV. Vui lòng kiểm tra định dạng UTF-8.');
      setParseResult(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleConfirm = () => {
    if (!parseResult || parseResult.items.length === 0) return;
    const stats = onConfirmImport(parseResult.items);
    setImportDone(stats);
    setTimeout(() => {
      onClose();
      setParseResult(null);
      setFileName('');
      setImportDone(null);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto font-serif">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#DCE8F7] relative space-y-5 my-6 max-h-[90vh] overflow-y-auto">
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
              Hỗ trợ tệp CSV UTF-8 (có hoặc không có BOM), tự động ánh xạ 11 cột: Môn học, Khối, Chương / Chủ đề,
              Nội dung / Đơn vị kiến thức, Yêu cầu cần đạt, Nhãn nguồn, Mức độ, ID chủ đề, Nhãn ngắn chủ đề, ID đơn vị,
              ID YCCĐ.
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
            onChange={handleFileInputChange}
            className="hidden"
          />
          <Upload className="w-8 h-8 text-[#006BFF] mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#082B52]">
              {fileName ? `Tệp đã chọn: ${fileName}` : 'Chọn tệp .csv từ máy tính hoặc kéo thả vào đây'}
            </p>
            <p className="text-xs text-slate-500">
              Hệ thống đối chiếu khóa Môn + Khối + ID YCCĐ để cập nhật sạch sẽ, không tạo bản ghi trùng lặp.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Chọn tệp CSV từ máy tính</span>
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
                  Kết quả kiểm tra tệp ({parseResult.totalDataRows} dòng dữ liệu):
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

              {/* Group stats by Subject & Grade */}
              {parseResult.groupStats.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {parseResult.groupStats.map(st => (
                    <div
                      key={`${st.subject}-${st.grade}`}
                      className="p-2.5 bg-white border border-blue-200 rounded-lg text-xs"
                    >
                      <div className="font-bold text-[#082B52]">
                        {st.subject} • Khối {st.grade}
                      </div>
                      <div className="text-[#006BFF] font-bold mt-0.5">{st.count} YCCĐ hợp lệ</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Deduplication preview */}
              {previewMergeStats && (
                <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center gap-3">
                  <span className="font-bold text-slate-800">Khi lưu vào danh mục:</span>
                  <span className="text-emerald-700 font-bold">+ {previewMergeStats.inserted} dòng mới</span>
                  <span className="text-amber-700 font-bold">↻ {previewMergeStats.updated} cập nhật</span>
                  <span className="text-slate-600 font-semibold">
                    = {previewMergeStats.unchanged} dòng trùng khớp giữ nguyên
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
