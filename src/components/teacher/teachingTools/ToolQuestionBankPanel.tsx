import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Gamepad2,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CognitiveLevel, Grade, Question } from '../../../types';
import { MathView } from '../../MathView';
import { extractPdfPagesFromArrayBuffer } from './pdfTextLayerExtractor';
import {
  ImportPreviewRow,
  PdfAndKeyParseResult,
  ShortAnswerGradingRule,
  ToolQuestionItem,
  ToolQuestionSet,
  ToolQuestionType,
  buildQuestionItemsFromPreviewRows,
  duplicateToolQuestion,
  filterToolQuestions,
  generateCsvSampleTemplate,
  getMcqDisplayLabelForCorrectOption,
  importFromSystemBankQuestions,
  makeStableId,
  parsePdfTextAndAnswerKey,
  parseSpreadsheetQuestionImport,
  parseXlsxWorkbookToPreview,
  reorderMcqOption,
} from './questionBankEngine';

interface ToolQuestionBankPanelProps {
  questionSets: ToolQuestionSet[];
  systemBankQuestions: Question[];
  onSaveQuestionSets: (nextSets: ToolQuestionSet[]) => void;
  onStartReviewGameWithSet: (setId: string) => void;
}

const LEVEL_LABELS: Record<CognitiveLevel, string> = {
  know: 'Biết',
  understand: 'Hiểu',
  apply: 'Vận dụng',
};

const TYPE_LABELS: Record<ToolQuestionType, string> = {
  mcq: 'Trắc nghiệm ABCD',
  true_false: 'Đúng / Sai',
  short_answer: 'Trả lời ngắn',
};

export const ToolQuestionBankPanel: React.FC<ToolQuestionBankPanelProps> = ({
  questionSets,
  systemBankQuestions,
  onSaveQuestionSets,
  onStartReviewGameWithSet,
}) => {
  const [selectedSetId, setSelectedSetId] = useState<string>(
    () => questionSets[0]?.id || ''
  );

  const activeSet = useMemo(
    () => questionSets.find((s) => s.id === selectedSetId) || questionSets[0] || null,
    [questionSets, selectedSetId]
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterLesson, setFilterLesson] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Panels & modals
  const [subPanel, setSubPanel] = useState<'browse' | 'import_sheet' | 'import_pdf'>('browse');
  const [editingQuestion, setEditingQuestion] = useState<ToolQuestionItem | null>(null);
  const [isCreatingNewQ, setIsCreatingNewQ] = useState<boolean>(false);
  const [previewQuestion, setPreviewQuestion] = useState<ToolQuestionItem | null>(null);
  const [showNewSetModal, setShowNewSetModal] = useState<boolean>(false);
  const [newSetTitle, setNewSetTitle] = useState<string>('');
  const [newSetGrade, setNewSetGrade] = useState<Grade>('8');
  const [newSetSubject, setNewSetSubject] = useState<string>('Toán');
  const [newSetLesson, setNewSetLesson] = useState<string>('Ôn tập chủ đề');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Spreadsheet / CSV import state
  const [sheetRawText, setSheetRawText] = useState<string>('');
  const [sheetTargetTitle, setSheetTargetTitle] = useState<string>('');
  const [sheetPreviewRows, setSheetPreviewRows] = useState<ImportPreviewRow[]>([]);

  // PDF + Answer table import state
  const [pdfRawPagesText, setPdfRawPagesText] = useState<string>('');
  const [pdfParsedPages, setPdfParsedPages] = useState<
    { pageNumber: number; text: string; isImageOnly?: boolean }[]
  >([]);
  const [pdfAnswerKeyText, setPdfAnswerKeyText] = useState<string>('');
  const [pdfTargetTitle, setPdfTargetTitle] = useState<string>('');
  const [pdfParseResult, setPdfParseResult] = useState<PdfAndKeyParseResult | null>(null);
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);

  const uniqueLessons = useMemo(() => {
    if (!activeSet) return [];
    return Array.from(new Set(activeSet.questions.map((q) => q.lesson).filter(Boolean)));
  }, [activeSet]);

  const filteredQuestions = useMemo(() => {
    if (!activeSet) return [];
    return filterToolQuestions({
      questions: activeSet.questions,
      query: searchQuery,
      grade: filterGrade,
      subject: filterSubject,
      lesson: filterLesson,
      level: filterLevel,
      type: filterType,
    });
  }, [activeSet, searchQuery, filterGrade, filterSubject, filterLesson, filterLevel, filterType]);

  const updateActiveSetQuestions = (
    updater: (prev: ToolQuestionItem[]) => ToolQuestionItem[]
  ) => {
    if (!activeSet) return;
    const nextSets = questionSets.map((s) =>
      s.id === activeSet.id
        ? {
            ...s,
            questions: updater(s.questions),
            updatedAtIso: new Date().toISOString(),
          }
        : s
    );
    onSaveQuestionSets(nextSets);
  };

  const handleCreateEmptySet = () => {
    if (!newSetTitle.trim()) return;
    const nowIso = new Date().toISOString();
    const created: ToolQuestionSet = {
      id: makeStableId('tqs'),
      title: newSetTitle.trim(),
      grade: newSetGrade,
      subject: newSetSubject.trim() || 'Toán',
      lesson: newSetLesson.trim() || 'Chủ đề chung',
      description: 'Bộ câu hỏi tự soạn dùng cho các trò chơi ôn tập.',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      questions: [],
    };
    onSaveQuestionSets([created, ...questionSets]);
    setSelectedSetId(created.id);
    setShowNewSetModal(false);
    setNewSetTitle('');
    setStatusBanner({
      type: 'success',
      text: `Đã tạo bộ câu hỏi mới "${created.title}".`,
    });
  };

  const handleDuplicateSet = (setItem: ToolQuestionSet) => {
    const nowIso = new Date().toISOString();
    const copy: ToolQuestionSet = {
      ...setItem,
      id: makeStableId('tqs'),
      title: `${setItem.title} (Bản sao)`,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      questions: setItem.questions.map((q) => duplicateToolQuestion(q)),
    };
    onSaveQuestionSets([copy, ...questionSets]);
    setSelectedSetId(copy.id);
    setStatusBanner({
      type: 'success',
      text: `Đã sao chép thành bộ mới "${copy.title}".`,
    });
  };

  const handlePullSystemBankSet = () => {
    if (systemBankQuestions.length === 0) {
      setStatusBanner({
        type: 'error',
        text: 'Ngân hàng chung Smart EDU hiện chưa có câu hỏi nào.',
      });
      return;
    }
    const pulled = importFromSystemBankQuestions(systemBankQuestions);
    onSaveQuestionSets([pulled, ...questionSets]);
    setSelectedSetId(pulled.id);
    setStatusBanner({
      type: 'success',
      text: `Đã nạp ${pulled.questions.length} câu hỏi từ Ngân hàng Smart EDU thành một bộ riêng.`,
    });
  };

  const handleDeleteQuestion = (qId: string) => {
    updateActiveSetQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const handleDuplicateSingleQuestion = (q: ToolQuestionItem) => {
    const copy = duplicateToolQuestion(q);
    updateActiveSetQuestions((prev) => [...prev, copy]);
  };

  const handleOpenNewQuestionEditor = () => {
    setIsCreatingNewQ(true);
    setEditingQuestion({
      id: makeStableId('tq'),
      code: `CH-${(activeSet?.questions.length || 0) + 1}`,
      grade: activeSet?.grade || '8',
      subject: activeSet?.subject || 'Toán',
      lesson: activeSet?.lesson || 'Ôn tập',
      level: 'know',
      type: 'mcq',
      stem: '',
      explanation: '',
      options: [
        { id: makeStableId('opt'), text: '' },
        { id: makeStableId('opt'), text: '' },
        { id: makeStableId('opt'), text: '' },
        { id: makeStableId('opt'), text: '' },
      ],
      statements: [
        { id: makeStableId('tf'), label: 'a', text: '', isCorrect: true },
        { id: makeStableId('tf'), label: 'b', text: '', isCorrect: false },
        { id: makeStableId('tf'), label: 'c', text: '', isCorrect: true },
        { id: makeStableId('tf'), label: 'd', text: '', isCorrect: false },
      ],
      referenceAnswer: '',
      shortAnswerRule: 'manual_only',
    });
  };

  const handleSaveEditedQuestion = (saved: ToolQuestionItem) => {
    if (isCreatingNewQ) {
      updateActiveSetQuestions((prev) => [...prev, saved]);
      setStatusBanner({ type: 'success', text: `Đã thêm câu "${saved.code}" vào bộ câu hỏi.` });
    } else {
      updateActiveSetQuestions((prev) => prev.map((q) => (q.id === saved.id ? saved : q)));
      setStatusBanner({ type: 'success', text: `Đã cập nhật câu "${saved.code}".` });
    }
    setEditingQuestion(null);
    setIsCreatingNewQ(false);
  };

  const handleDownloadCsvTemplate = () => {
    const csv = '\uFEFF' + generateCsvSampleTemplate();
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Nhap_Cau_Hoi_SmartEDU.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setSheetRawText(generateCsvSampleTemplate());
    }
  };

  const handleParseSpreadsheetText = (raw: string) => {
    setSheetRawText(raw);
    const preview = parseSpreadsheetQuestionImport(raw, {
      grade: activeSet?.grade || '8',
      subject: activeSet?.subject || 'Toán',
      lesson: activeSet?.lesson || 'Ôn tập',
    });
    setSheetPreviewRows(preview);
  };

  const handleSpreadsheetFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.tsv');
    const reader = new FileReader();
    reader.onload = () => {
      if (isCsv) {
        handleParseSpreadsheetText(String(reader.result || ''));
      } else {
        try {
          const wb = XLSX.read(reader.result, { type: 'array' });
          const preview = parseXlsxWorkbookToPreview(wb, {
            grade: activeSet?.grade || '8',
            subject: activeSet?.subject || 'Toán',
            lesson: activeSet?.lesson || 'Ôn tập',
          });
          setSheetPreviewRows(preview);
        } catch {
          setStatusBanner({
            type: 'error',
            text: 'Không đọc được tệp bảng tính. Hãy dùng đúng định dạng .xlsx hoặc .csv.',
          });
        }
      }
    };
    if (isCsv) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleSaveSheetPreviewAsNewSet = () => {
    const validRows = sheetPreviewRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      setStatusBanner({
        type: 'error',
        text: 'Chưa có dòng hợp lệ để lưu. Hãy sửa các dòng đang báo lỗi trước khi lưu.',
      });
      return;
    }
    const items = buildQuestionItemsFromPreviewRows(validRows);
    const nowIso = new Date().toISOString();
    const newSet: ToolQuestionSet = {
      id: makeStableId('tqs'),
      title: sheetTargetTitle.trim() || `Bộ câu hỏi nhập bảng (${items.length} câu)`,
      grade: items[0].grade,
      subject: items[0].subject,
      lesson: items[0].lesson,
      description: 'Tạo mới từ tệp CSV/Excel (bảo toàn các bộ câu hỏi đã có).',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      questions: items,
    };
    onSaveQuestionSets([newSet, ...questionSets]);
    setSelectedSetId(newSet.id);
    setSubPanel('browse');
    setSheetPreviewRows([]);
    setSheetRawText('');
    setSheetTargetTitle('');
    setStatusBanner({
      type: 'success',
      text: `Đã tạo bộ câu hỏi mới "${newSet.title}" với ${items.length} câu hợp lệ (không ghi đè bộ cũ).`,
    });
  };

  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const extracted = await extractPdfPagesFromArrayBuffer(buf);
      setPdfParsedPages(extracted.pages);
      setPdfRawPagesText(
        extracted.pages
          .map((p) =>
            p.isImageOnly
              ? `[Trang ${p.pageNumber}: Dạng ảnh / không có lớp văn bản]`
              : `--- Trang ${p.pageNumber} ---\n${p.text}`
          )
          .join('\n\n')
      );
      const parsed = parsePdfTextAndAnswerKey({
        pages: extracted.pages,
        answerKeyText: pdfAnswerKeyText,
        defaults: { grade: '8', subject: 'Toán', lesson: file.name.replace(/\.pdf$/i, '') },
      });
      setPdfParseResult(parsed);
      if (!pdfTargetTitle.trim()) {
        setPdfTargetTitle(`Đề từ PDF · ${file.name.replace(/\.pdf$/i, '')}`);
      }
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'Không đọc được tệp PDF. Kiểm tra tệp PDF hợp lệ hoặc dán văn bản trực tiếp.',
      });
    } finally {
      setPdfBusy(false);
    }
    e.target.value = '';
  };

  const handleAnalyzePdfAndKey = (overrideKeyText?: string) => {
    const keyText = overrideKeyText ?? pdfAnswerKeyText;
    const pagesToUse =
      pdfParsedPages.length > 0
        ? pdfParsedPages
        : pdfRawPagesText
            .split(/---\s*Trang\s*\d+\s*---/i)
            .map((chunk, i) => ({
              pageNumber: i + 1,
              text: chunk.trim(),
              isImageOnly: chunk.trim().length < 15,
            }))
            .filter((p) => p.text.length > 0);

    const parsed = parsePdfTextAndAnswerKey({
      pages: pagesToUse,
      answerKeyText: keyText,
      defaults: { grade: '8', subject: 'Toán', lesson: 'Nhập từ PDF' },
    });
    setPdfParseResult(parsed);
  };

  const handleSavePdfPreviewAsNewSet = () => {
    if (!pdfParseResult) return;
    const validRows = pdfParseResult.rows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      setStatusBanner({
        type: 'error',
        text: 'Cần sửa các câu thiếu đáp án hoặc trùng mã ở bảng xem trước trước khi lưu.',
      });
      return;
    }
    const items = buildQuestionItemsFromPreviewRows(validRows);
    const nowIso = new Date().toISOString();
    const newSet: ToolQuestionSet = {
      id: makeStableId('tqs'),
      title: pdfTargetTitle.trim() || `Bộ đề nhập PDF (${items.length} câu)`,
      grade: items[0].grade,
      subject: items[0].subject,
      lesson: items[0].lesson,
      description: 'Tạo mới từ PDF có lớp văn bản & bảng đáp án.',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      questions: items,
    };
    onSaveQuestionSets([newSet, ...questionSets]);
    setSelectedSetId(newSet.id);
    setSubPanel('browse');
    setPdfParseResult(null);
    setPdfParsedPages([]);
    setPdfRawPagesText('');
    setPdfAnswerKeyText('');
    setPdfTargetTitle('');
    setStatusBanner({
      type: 'success',
      text: `Đã tạo bộ câu hỏi mới "${newSet.title}" với ${items.length} câu hợp lệ.`,
    });
  };

  return (
    <div className="space-y-5 font-edtech">
      {/* Header & Top Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#082B52]">
              Ngân hàng câu hỏi (Dùng chung cho Trò chơi ôn tập)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Hỗ trợ Trắc nghiệm ABCD (đảo phương án vẫn giữ đúng đáp án theo ID), Đúng/Sai từng ý và Trả lời ngắn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewSetModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo bộ mới</span>
            </button>
            <button
              type="button"
              onClick={handlePullSystemBankSet}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F2D52] text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
            >
              <Database className="w-4 h-4" />
              <span>Nạp từ Ngân hàng chung ({systemBankQuestions.length})</span>
            </button>
          </div>
        </div>

        {/* Mode Switcher Bar: Browse / Import Excel-CSV / Import PDF */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSubPanel('browse')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              subPanel === 'browse'
                ? 'bg-[#082B52] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Danh sách bộ &amp; Soạn trực tiếp
          </button>
          <button
            type="button"
            onClick={() => setSubPanel('import_sheet')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              subPanel === 'import_sheet'
                ? 'bg-[#082B52] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Dán Excel / Nhập CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setSubPanel('import_pdf')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              subPanel === 'import_pdf'
                ? 'bg-[#082B52] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Nhập PDF + Bảng đáp án</span>
          </button>
        </div>

        {statusBanner && (
          <div
            role={statusBanner.type === 'error' ? 'alert' : 'status'}
            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold ${
              statusBanner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <span>{statusBanner.text}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* PANEL 1: BROWSE & DIRECT AUTHORING */}
      {subPanel === 'browse' && (
        <div className="space-y-4">
          {/* Selected Question Set Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Bộ câu hỏi đang mở
                </label>
                <select
                  value={activeSet?.id || ''}
                  onChange={(e) => setSelectedSetId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-[#082B52]"
                >
                  {questionSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.questions.length} câu · Khối {s.grade} · {s.subject})
                    </option>
                  ))}
                </select>
              </div>

              {activeSet && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenNewQuestionEditor}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm câu trực tiếp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateSet(activeSet)}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Nhân bản bộ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartReviewGameWithSet(activeSet.id)}
                    disabled={activeSet.questions.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-[#0F2D52] text-xs font-extrabold cursor-pointer"
                  >
                    <Gamepad2 className="w-4 h-4" />
                    <span>Chơi Trò chơi ôn tập</span>
                  </button>
                </div>
              )}
            </div>

            {/* Search (accent-insensitive) & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-3 border-t border-slate-100">
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm không dấu (vd: phuong trinh, pythagore)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>

              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="all">Tất cả khối</option>
                <option value="6">Khối 6</option>
                <option value="7">Khối 7</option>
                <option value="8">Khối 8</option>
                <option value="9">Khối 9</option>
              </select>

              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="all">Tất cả môn</option>
                <option value="Toán">Toán</option>
                <option value="Tin học">Tin học</option>
                <option value="KHTN">KHTN</option>
                <option value="Ngữ văn">Ngữ văn</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
              </select>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="all">Tất cả mức độ</option>
                <option value="know">Biết</option>
                <option value="understand">Hiểu</option>
                <option value="apply">Vận dụng</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="all">Tất cả dạng</option>
                <option value="mcq">Trắc nghiệm ABCD</option>
                <option value="true_false">Đúng / Sai</option>
                <option value="short_answer">Trả lời ngắn</option>
              </select>
            </div>

            {uniqueLessons.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-600">Lọc bài học:</span>
                <select
                  value={filterLesson}
                  onChange={(e) => setFilterLesson(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="all">Tất cả bài học</option>
                  {uniqueLessons.map((les) => (
                    <option key={les} value={les}>
                      {les}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500">
                  Hiển thị {filteredQuestions.length}/{activeSet?.questions.length || 0} câu
                </span>
              </div>
            )}
          </div>

          {/* Question List */}
          <div className="space-y-3">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700">
                  Không có câu hỏi nào phù hợp điều kiện lọc hiện tại.
                </p>
                <p className="text-xs text-slate-500">
                  Hãy thử xóa từ khóa tìm kiếm hoặc bấm "Thêm câu trực tiếp" để soạn mới.
                </p>
              </div>
            ) : (
              filteredQuestions.map((q, idx) => (
                <article
                  key={q.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-xs text-slate-500 font-semibold flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-[#082B52]">Câu {idx + 1}</span>
                      <span>·</span>
                      <span className="font-mono text-[#1769F4]">{q.code}</span>
                      <span>·</span>
                      <span>Khối {q.grade}</span>
                      <span>·</span>
                      <span>{q.subject}</span>
                      <span>·</span>
                      <span>{q.lesson}</span>
                      <span>·</span>
                      <span>{LEVEL_LABELS[q.level]}</span>
                      <span>·</span>
                      <span>{TYPE_LABELS[q.type]}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewQuestion(q)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                        title="Xem trước hiển thị trình chiếu"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewQ(false);
                          setEditingQuestion(q);
                        }}
                        className="p-1.5 rounded-lg text-[#1769F4] hover:bg-blue-50 cursor-pointer"
                        title="Sửa câu hỏi & thứ tự phương án"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateSingleQuestion(q)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                        title="Nhân bản câu hỏi"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-sm sm:text-base font-bold text-[#082B52]">
                    <MathView content={q.stem} block />
                  </div>

                  {q.imageDataUrl && (
                    <img
                      src={q.imageDataUrl}
                      alt={`Minh họa ${q.code}`}
                      referrerPolicy="no-referrer"
                      className="max-h-44 rounded-xl border border-slate-200 object-contain"
                    />
                  )}

                  {q.type === 'mcq' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isRight = opt.id === q.correctOptionId;
                        return (
                          <div
                            key={opt.id}
                            className={`px-3 py-2 rounded-xl border text-xs sm:text-sm flex items-start gap-2 ${
                              isRight
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="font-extrabold shrink-0">{letter}.</span>
                            <div className="min-w-0 flex-1">
                              <MathView content={opt.text} />
                            </div>
                            {isRight && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'true_false' && q.statements && (
                    <div className="space-y-1.5">
                      {q.statements.map((st) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold mr-1.5">{st.label})</span>
                            <MathView content={st.text} />
                          </div>
                          <span
                            className={`font-extrabold shrink-0 ${
                              st.isCorrect ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {st.isCorrect ? 'Đúng' : 'Sai'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'short_answer' && (
                    <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950">
                      <span className="font-bold">Đáp án tham chiếu:</span>{' '}
                      <span className="font-mono font-bold">{q.referenceAnswer || '—'}</span>
                      <span className="mx-2 text-amber-600">·</span>
                      <span>
                        Quy tắc:{' '}
                        {q.shortAnswerRule === 'manual_only'
                          ? 'Giáo viên chấm trực tiếp (xét đơn vị / tương đương)'
                          : q.shortAnswerRule === 'numeric_tolerance'
                            ? `Sai số số học ±${q.numericTolerance ?? 0}`
                            : q.shortAnswerRule === 'case_insensitive'
                              ? 'So khớp văn bản không phân biệt hoa/thường'
                              : 'Khớp chính xác từng ký tự'}
                      </span>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <span className="font-bold text-slate-700">Lời giải: </span>
                      <MathView content={q.explanation} />
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* PANEL 2: IMPORT EXCEL / CSV PASTE */}
      {subPanel === 'import_sheet' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#082B52]">
                Nhập câu hỏi từ Excel / CSV theo mẫu
              </h3>
              <p className="text-xs text-slate-600">
                Dán trực tiếp vùng bảng từ Excel hoặc tải lên tệp .csv/.xlsx. Hệ thống tạo bộ câu hỏi mới, tuyệt đối không ghi đè bộ cũ.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F2D52] text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Tải mẫu CSV chuẩn</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-bold cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Chọn tệp .csv / .xlsx</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls"
                  onChange={handleSpreadsheetFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={sheetTargetTitle}
              onChange={(e) => setSheetTargetTitle(e.target.value)}
              placeholder="Tên bộ câu hỏi mới sẽ tạo..."
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <button
              type="button"
              onClick={() => handleParseSpreadsheetText(generateCsvSampleTemplate())}
              className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#1769F4] text-xs font-bold cursor-pointer"
            >
              Nạp nhanh dữ liệu bảng mẫu để thử nghiệm
            </button>
          </div>

          <textarea
            value={sheetRawText}
            onChange={(e) => handleParseSpreadsheetText(e.target.value)}
            rows={5}
            placeholder="Dán dữ liệu sao chép từ Excel (Ctrl+C -> Ctrl+V) hoặc CSV vào đây..."
            className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs"
          />

          {sheetPreviewRows.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-[#082B52]">
                  Xem trước {sheetPreviewRows.length} dòng · Hợp lệ:{' '}
                  <span className="text-emerald-700">
                    {sheetPreviewRows.filter((r) => r.errors.length === 0).length}
                  </span>{' '}
                  · Có lỗi cần sửa:{' '}
                  <span className="text-rose-700">
                    {sheetPreviewRows.filter((r) => r.errors.length > 0).length}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleSaveSheetPreviewAsNewSet}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Lưu thành bộ câu hỏi mới
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Dòng</th>
                      <th className="p-2.5">Mã câu</th>
                      <th className="p-2.5">Dạng</th>
                      <th className="p-2.5">Nội dung (có thể sửa trực tiếp)</th>
                      <th className="p-2.5">Đáp án</th>
                      <th className="p-2.5">Kiểm tra lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sheetPreviewRows.map((row, idx) => (
                      <tr
                        key={`${row.rowNumber}_${idx}`}
                        className={row.errors.length > 0 ? 'bg-rose-50/70' : 'bg-white'}
                      >
                        <td className="p-2.5 font-mono">{row.rowNumber}</td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={row.code}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSheetPreviewRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        code: val,
                                        errors: r.errors.filter((err) => !err.includes('Trùng mã')),
                                      }
                                    : r
                                )
                              );
                            }}
                            className="w-24 px-2 py-1 rounded border border-slate-300 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2.5 whitespace-nowrap">{TYPE_LABELS[row.type]}</td>
                        <td className="p-2.5 min-w-[220px]">
                          <input
                            type="text"
                            value={row.stem}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSheetPreviewRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        stem: val,
                                        errors: val.trim()
                                          ? r.errors.filter((err) => !err.includes('Thiếu nội dung'))
                                          : r.errors,
                                      }
                                    : r
                                )
                              );
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                          />
                        </td>
                        <td className="p-2.5 font-mono">
                          {row.type === 'mcq'
                            ? row.correctOptionLetter || '—'
                            : row.type === 'short_answer'
                              ? row.referenceAnswer || '—'
                              : row.statements.map((s) => (s.isCorrect ? 'Đ' : 'S')).join(',')}
                        </td>
                        <td className="p-2.5 min-w-[190px]">
                          {row.errors.length === 0 ? (
                            <span className="text-emerald-700 font-bold">Hợp lệ</span>
                          ) : (
                            <span className="text-rose-700 font-semibold">
                              {row.errors.join(' ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL 3: IMPORT PDF + ANSWER TABLE */}
      {subPanel === 'import_pdf' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#082B52]">
                Nhập đề từ PDF có lớp văn bản &amp; Bảng đáp án
              </h3>
              <p className="text-xs text-slate-600">
                Nhận dạng nhãn "Câu 1", "Câu 2"... theo từng phần, tự động báo câu thiếu đáp án, mã trùng và trang PDF dạng ảnh cần xử lý thủ công.
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-bold cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{pdfBusy ? 'Đang đọc PDF...' : 'Chọn tệp PDF đề thi'}</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Nội dung văn bản PDF trích xuất (hoặc dán văn bản đề để kiểm thử):
              </label>
              <textarea
                value={pdfRawPagesText}
                onChange={(e) => {
                  setPdfRawPagesText(e.target.value);
                  setPdfParsedPages([]);
                }}
                rows={7}
                placeholder={'PHẦN I\nCâu 1: Giải phương trình 2x - 4 = 0\nA. x = 1\nB. x = 2\nC. x = 3\nD. x = 4'}
                className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Bảng đáp án theo mẫu (Phần | Câu | Đáp án | Lời giải):
              </label>
              <textarea
                value={pdfAnswerKeyText}
                onChange={(e) => setPdfAnswerKeyText(e.target.value)}
                rows={7}
                placeholder={'Phần I\tCâu 1\tB\t2x = 4 nên x = 2\nPhần I\tCâu 2\tA'}
                className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={pdfTargetTitle}
              onChange={(e) => setPdfTargetTitle(e.target.value)}
              placeholder="Tên bộ câu hỏi mới từ PDF..."
              className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <button
              type="button"
              onClick={() => handleAnalyzePdfAndKey()}
              className="px-4 py-2 rounded-xl bg-[#082B52] hover:bg-[#0D3A6D] text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              Đối chiếu câu hỏi &amp; bảng đáp án
            </button>
          </div>

          {pdfParseResult && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              {pdfParseResult.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1 text-xs font-semibold text-amber-950">
                  {pdfParseResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-[#082B52]">
                  Nhận dạng được {pdfParseResult.rows.length} câu hỏi
                </p>
                <button
                  type="button"
                  onClick={handleSavePdfPreviewAsNewSet}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Lưu các câu hợp lệ thành bộ mới
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Phần</th>
                      <th className="p-2.5">Mã</th>
                      <th className="p-2.5">Nội dung</th>
                      <th className="p-2.5">Đáp án ghép (sửa được)</th>
                      <th className="p-2.5">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pdfParseResult.rows.map((row, idx) => (
                      <tr
                        key={`${row.code}_${idx}`}
                        className={row.errors.length > 0 ? 'bg-rose-50/70' : 'bg-white'}
                      >
                        <td className="p-2.5 whitespace-nowrap">{row.sectionLabel}</td>
                        <td className="p-2.5 font-mono font-bold">{row.code}</td>
                        <td className="p-2.5 max-w-md">{row.stem}</td>
                        <td className="p-2.5">
                          {row.type === 'mcq' ? (
                            <select
                              value={row.correctOptionLetter}
                              onChange={(e) => {
                                const val = e.target.value as 'A' | 'B' | 'C' | 'D' | '';
                                setPdfParseResult((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        rows: prev.rows.map((r, i) =>
                                          i === idx
                                            ? {
                                                ...r,
                                                correctOptionLetter: val,
                                                errors: val
                                                  ? r.errors.filter((er) => !er.includes('Thiếu đáp án'))
                                                  : r.errors,
                                              }
                                            : r
                                        ),
                                      }
                                    : null
                                );
                              }}
                              className="px-2 py-1 rounded border border-slate-300 font-bold"
                            >
                              <option value="">— Chọn —</option>
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={row.referenceAnswer}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPdfParseResult((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        rows: prev.rows.map((r, i) =>
                                          i === idx
                                            ? {
                                                ...r,
                                                referenceAnswer: val,
                                                errors: val.trim()
                                                  ? r.errors.filter((er) => !er.includes('Thiếu đáp án'))
                                                  : r.errors,
                                              }
                                            : r
                                        ),
                                      }
                                    : null
                                );
                              }}
                              className="w-28 px-2 py-1 rounded border border-slate-300"
                            />
                          )}
                        </td>
                        <td className="p-2.5">
                          {row.errors.length === 0 ? (
                            <span className="text-emerald-700 font-bold">Sẵn sàng</span>
                          ) : (
                            <span className="text-rose-700 font-semibold">
                              {row.errors.join(' ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: NEW QUESTION SET */}
      {showNewSetModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-lg font-extrabold text-[#082B52]">Tạo bộ câu hỏi mới</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newSetTitle}
                onChange={(e) => setNewSetTitle(e.target.value)}
                placeholder="Tên bộ câu hỏi (VD: Ôn tập Chương II Toán 8)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={newSetGrade}
                  onChange={(e) => setNewSetGrade(e.target.value as Grade)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="6">Khối 6</option>
                  <option value="7">Khối 7</option>
                  <option value="8">Khối 8</option>
                  <option value="9">Khối 9</option>
                </select>
                <input
                  type="text"
                  value={newSetSubject}
                  onChange={(e) => setNewSetSubject(e.target.value)}
                  placeholder="Môn học"
                  className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <input
                type="text"
                value={newSetLesson}
                onChange={(e) => setNewSetLesson(e.target.value)}
                placeholder="Bài học / Chủ đề"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewSetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateEmptySet}
                className="px-4 py-2 rounded-xl bg-[#1769F4] text-white text-xs font-bold cursor-pointer"
              >
                Tạo bộ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT QUESTION EDITOR (With Option-ID Reordering!) */}
      {editingQuestion && (
        <QuestionItemEditorModal
          question={editingQuestion}
          onClose={() => {
            setEditingQuestion(null);
            setIsCreatingNewQ(false);
          }}
          onSave={handleSaveEditedQuestion}
        />
      )}

      {/* MODAL: FULLSCREEN-STYLE QUESTION PREVIEW */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-[#081A33]/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-extrabold text-[#1769F4] uppercase">
                Xem trước trình chiếu · {previewQuestion.code} · {LEVEL_LABELS[previewQuestion.level]}
              </span>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xl font-bold text-[#082B52]">
              <MathView content={previewQuestion.stem} block />
            </div>
            {previewQuestion.type === 'mcq' && previewQuestion.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previewQuestion.options.map((o, i) => (
                  <div
                    key={o.id}
                    className={`p-3.5 rounded-xl border text-base font-semibold flex items-center gap-2 ${
                      o.id === previewQuestion.correctOptionId
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span className="font-extrabold">{String.fromCharCode(65 + i)}.</span>
                    <MathView content={o.text} />
                  </div>
                ))}
              </div>
            )}
            {previewQuestion.explanation && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-[#082B52]">
                <span className="font-bold">Lời giải: </span>
                <MathView content={previewQuestion.explanation} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface QuestionItemEditorModalProps {
  question: ToolQuestionItem;
  onClose: () => void;
  onSave: (q: ToolQuestionItem) => void;
}

const QuestionItemEditorModal: React.FC<QuestionItemEditorModalProps> = ({
  question,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<ToolQuestionItem>(() => ({
    ...question,
    options: question.options?.map((o) => ({ ...o })) || [
      { id: makeStableId('opt'), text: '' },
      { id: makeStableId('opt'), text: '' },
      { id: makeStableId('opt'), text: '' },
      { id: makeStableId('opt'), text: '' },
    ],
    statements: question.statements?.map((s) => ({ ...s })) || [
      { id: makeStableId('tf'), label: 'a', text: '', isCorrect: true },
      { id: makeStableId('tf'), label: 'b', text: '', isCorrect: false },
      { id: makeStableId('tf'), label: 'c', text: '', isCorrect: true },
      { id: makeStableId('tf'), label: 'd', text: '', isCorrect: false },
    ],
  }));

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((prev) => ({ ...prev, imageDataUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-5 sm:p-6 space-y-4 my-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-extrabold text-[#082B52]">
            Soạn &amp; Chỉnh sửa câu hỏi
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã câu</label>
            <input
              type="text"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Khối</label>
            <select
              value={draft.grade}
              onChange={(e) => setDraft({ ...draft, grade: e.target.value as Grade })}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="6">Khối 6</option>
              <option value="7">Khối 7</option>
              <option value="8">Khối 8</option>
              <option value="9">Khối 9</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Môn</label>
            <input
              type="text"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Mức độ</label>
            <select
              value={draft.level}
              onChange={(e) => setDraft({ ...draft, level: e.target.value as CognitiveLevel })}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="know">Biết</option>
              <option value="understand">Hiểu</option>
              <option value="apply">Vận dụng</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Dạng câu</label>
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as ToolQuestionType })}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="mcq">Trắc nghiệm ABCD</option>
              <option value="true_false">Đúng / Sai</option>
              <option value="short_answer">Trả lời ngắn</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Bài học / Chủ đề</label>
          <input
            type="text"
            value={draft.lesson}
            onChange={(e) => setDraft({ ...draft, lesson: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-bold text-slate-700">
              Nội dung câu hỏi (hỗ trợ KaTeX trong cặp dấu $...$)
            </label>
            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Đính kèm ảnh</span>
              <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
            </label>
          </div>
          <textarea
            value={draft.stem}
            onChange={(e) => setDraft({ ...draft, stem: e.target.value })}
            rows={3}
            className="w-full p-3 rounded-xl border border-slate-300 text-sm"
          />
          {draft.stem.trim() && (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">Xem trước Toán:</span>
              <MathView content={draft.stem} block />
            </div>
          )}
        </div>

        {/* Type-specific editor */}
        {draft.type === 'mcq' && draft.options && (
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#082B52]">
                Các phương án ABCD (Đáp án đang chọn theo ID: phương án{' '}
                {getMcqDisplayLabelForCorrectOption(draft)})
              </span>
            </div>
            {draft.options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isCorrect = opt.id === draft.correctOptionId;
              return (
                <div key={opt.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, correctOptionId: opt.id })}
                    className={`w-9 h-9 rounded-lg font-extrabold text-xs shrink-0 cursor-pointer border ${
                      isCorrect
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                    title="Chọn làm đáp án đúng"
                  >
                    {letter}
                  </button>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        options: prev.options?.map((o) =>
                          o.id === opt.id ? { ...o, text: val } : o
                        ),
                      }));
                    }}
                    placeholder={`Nội dung phương án ${letter}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
                  />
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => setDraft((prev) => reorderMcqOption(prev, opt.id, 'up'))}
                    className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-30 cursor-pointer"
                    title="Chuyển lên"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === (draft.options?.length || 0) - 1}
                    onClick={() => setDraft((prev) => reorderMcqOption(prev, opt.id, 'down'))}
                    className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-30 cursor-pointer"
                    title="Chuyển xuống"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {draft.type === 'true_false' && draft.statements && (
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-extrabold text-[#082B52] block">
              Các ý Đúng / Sai (mỗi ý có đáp án riêng)
            </span>
            {draft.statements.map((st) => (
              <div key={st.id} className="flex items-center gap-2">
                <span className="font-bold text-xs w-6 text-center">{st.label})</span>
                <input
                  type="text"
                  value={st.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      statements: prev.statements?.map((item) =>
                        item.id === st.id ? { ...item, text: val } : item
                      ),
                    }));
                  }}
                  placeholder={`Nội dung ý ${st.label}`}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      statements: prev.statements?.map((item) =>
                        item.id === st.id ? { ...item, isCorrect: !item.isCorrect } : item
                      ),
                    }))
                  }
                  className={`px-3 py-2 rounded-lg text-xs font-extrabold shrink-0 cursor-pointer ${
                    st.isCorrect
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {st.isCorrect ? 'Đúng' : 'Sai'}
                </button>
              </div>
            ))}
          </div>
        )}

        {draft.type === 'short_answer' && (
          <div className="space-y-2.5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Đáp án tham chiếu (dùng hiển thị cho giáo viên khi chấm)
              </label>
              <input
                type="text"
                value={draft.referenceAnswer || ''}
                onChange={(e) => setDraft({ ...draft, referenceAnswer: e.target.value })}
                placeholder="Ví dụ: 100 hoặc 4 m"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quy tắc chấm
                </label>
                <select
                  value={draft.shortAnswerRule || 'manual_only'}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      shortAnswerRule: e.target.value as ShortAnswerGradingRule,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                >
                  <option value="manual_only">Giáo viên chấm thủ công (mặc định an toàn)</option>
                  <option value="exact_trimmed">Tự chấm khi khớp chính xác</option>
                  <option value="case_insensitive">Không phân biệt hoa / thường</option>
                  <option value="numeric_tolerance">Số học có sai số (đơn vị chuyển GV duyệt)</option>
                </select>
              </div>
              {draft.shortAnswerRule === 'numeric_tolerance' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sai số cho phép (±)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.numericTolerance ?? 0.01}
                    onChange={(e) =>
                      setDraft({ ...draft, numericTolerance: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Lời giải chi tiết (chỉ hiện trên màn chiếu sau thao tác công bố)
          </label>
          <textarea
            value={draft.explanation}
            onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
            rows={2}
            className="w-full p-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!draft.stem.trim()}
            onClick={() => onSave(draft)}
            className="px-5 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
          >
            Lưu câu hỏi
          </button>
        </div>
      </div>
    </div>
  );
};
