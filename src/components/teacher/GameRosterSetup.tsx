import React, { useState, useRef, useMemo } from 'react';
import {
  Users,
  UserCheck,
  FileSpreadsheet,
  ClipboardPaste,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  AlertTriangle,
  Play,
  RotateCcw,
  Download,
  Sparkles,
  CheckSquare,
  Square,
  ShieldCheck,
  LogIn,
  History,
  Info,
  Upload,
} from 'lucide-react';
import {
  GuestClassSession,
  GuestStudentItem,
  GuestTurnHistoryItem,
  ParsedGuestRowPreview,
  parseRawTextToGuestRows,
  parseExcelBufferToGuestRows,
  createGuestStudentItems,
  reindexGuestStudents,
  findDuplicateNamesInRoster,
  generateSampleVietnameseRoster,
  buildGuestHistoryCsvContent,
  isLocalStorageAvailable,
} from './GuestRosterManager';
import { ClassRoom } from '../../types';

export interface GameRosterSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: () => void;
  targetGameTitle?: string;
  targetGameCode?: string;

  // Mode state
  rosterMode: 'guest' | 'teacher';
  onChangeRosterMode: (mode: 'guest' | 'teacher') => void;

  // Guest session state
  guestSession: GuestClassSession;
  onUpdateGuestSession: (next: GuestClassSession) => void;
  guestHistory: GuestTurnHistoryItem[];
  onClearAllGuestData: () => void;
  onResetGuestCalledSession: () => void;

  // Teacher system state
  isLoggedInTeacher: boolean;
  teacherClasses: ClassRoom[];
  selectedTeacherClassId: string;
  onSelectTeacherClassId: (classId: string) => void;
  onRequestLogin?: () => void;
}

export const GameRosterSetup: React.FC<GameRosterSetupProps> = ({
  isOpen,
  onClose,
  onStartGame,
  targetGameTitle,
  targetGameCode,
  rosterMode,
  onChangeRosterMode,
  guestSession,
  onUpdateGuestSession,
  guestHistory,
  onClearAllGuestData,
  onResetGuestCalledSession,
  isLoggedInTeacher,
  teacherClasses,
  selectedTeacherClassId,
  onSelectTeacherClassId,
  onRequestLogin,
}) => {
  const [activeInputTab, setActiveInputTab] = useState<'direct' | 'paste_excel' | 'upload_file' | 'history'>('direct');

  // Direct input states
  const [singleNameInput, setSingleNameInput] = useState('');
  const [singleNoteInput, setSingleNoteInput] = useState('');
  const [multiLineDirectInput, setMultiLineDirectInput] = useState('');

  // Paste from Excel / Google Sheets states
  const [excelPasteText, setExcelPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<{
    validRows: ParsedGuestRowPreview[];
    skippedCount: number;
    duplicateNames: string[];
  } | null>(null);

  // Upload Excel / CSV states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [filePreview, setFilePreview] = useState<{
    validRows: ParsedGuestRowPreview[];
    skippedCount: number;
    duplicateNames: string[];
  } | null>(null);

  // Roster Table editing & search
  const [rosterSearch, setRosterSearch] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [confirmClearRoster, setConfirmClearRoster] = useState(false);
  const [confirmWipeGuestStorage, setConfirmWipeGuestStorage] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ type: 'error' | 'warning' | 'success'; text: string } | null>(null);

  const storageOk = useMemo(() => isLocalStorageAvailable(), []);

  const duplicateNamesInRoster = useMemo(
    () => findDuplicateNamesInRoster(guestSession.students),
    [guestSession.students]
  );

  const participatingStudents = useMemo(
    () => guestSession.students.filter(s => s.participating),
    [guestSession.students]
  );

  const calledSet = useMemo(
    () => new Set(guestSession.calledStudentIds),
    [guestSession.calledStudentIds]
  );

  const remainingGuestStudents = useMemo(
    () => participatingStudents.filter(s => guestSession.allowRepeat || !calledSet.has(s.guestStudentId)),
    [participatingStudents, guestSession.allowRepeat, calledSet]
  );

  const filteredRosterStudents = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return guestSession.students;
    return guestSession.students.filter(
      s =>
        s.fullName.toLowerCase().includes(q) ||
        String(s.stt).includes(q) ||
        (s.note && s.note.toLowerCase().includes(q))
    );
  }, [guestSession.students, rosterSearch]);

  if (!isOpen) return null;

  // Handlers for Section A (Class Info)
  const handleMetaChange = (field: 'className' | 'activityName' | 'note', value: string) => {
    onUpdateGuestSession({
      ...guestSession,
      [field]: value,
    });
  };

  // Handlers for Direct Add
  const handleAddSingleStudent = () => {
    const cleaned = singleNameInput.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setValidationMessage({ type: 'error', text: 'Vui lòng nhập họ và tên học sinh trước khi thêm.' });
      return;
    }
    const newItems = createGuestStudentItems(
      [{ fullName: cleaned, note: singleNoteInput.trim() || undefined }],
      guestSession.students.length
    );
    const updatedStudents = reindexGuestStudents([...guestSession.students, ...newItems]);
    onUpdateGuestSession({
      ...guestSession,
      students: updatedStudents,
    });
    setSingleNameInput('');
    setSingleNoteInput('');
    setValidationMessage({ type: 'success', text: `Đã thêm học sinh "${cleaned}" vào danh sách.` });
  };

  const handleAddMultiLineDirect = () => {
    if (!multiLineDirectInput.trim()) {
      setValidationMessage({ type: 'error', text: 'Vui lòng nhập ít nhất 1 dòng tên học sinh.' });
      return;
    }
    const parsed = parseRawTextToGuestRows(multiLineDirectInput, guestSession.students);
    if (parsed.validRows.length === 0) {
      setValidationMessage({ type: 'error', text: 'Không tìm thấy tên học sinh hợp lệ nào trong nội dung vừa nhập.' });
      return;
    }
    const newItems = createGuestStudentItems(parsed.validRows, guestSession.students.length);
    const updatedStudents = reindexGuestStudents([...guestSession.students, ...newItems]);
    onUpdateGuestSession({
      ...guestSession,
      students: updatedStudents,
    });
    setMultiLineDirectInput('');
    setValidationMessage({
      type: parsed.duplicateNames.length > 0 ? 'warning' : 'success',
      text: `Đã thêm ${newItems.length} học sinh${parsed.skippedCount > 0 ? ` (bỏ qua ${parsed.skippedCount} dòng trống/tiêu đề)` : ''}${
        parsed.duplicateNames.length > 0 ? `. Lưu ý có tên trùng: ${parsed.duplicateNames.join(', ')} (đã phân biệt bằng mã ID riêng).` : '.'
      }`,
    });
  };

  // Handlers for Paste from Excel / Google Sheets
  const handlePreviewExcelPaste = (text: string) => {
    setExcelPasteText(text);
    if (!text.trim()) {
      setPastePreview(null);
      return;
    }
    const res = parseRawTextToGuestRows(text, guestSession.students);
    setPastePreview(res);
  };

  const handleConfirmExcelPaste = (replaceExisting: boolean) => {
    if (!pastePreview || pastePreview.validRows.length === 0) {
      setValidationMessage({ type: 'error', text: 'Chưa có dữ liệu hợp lệ để nhập.' });
      return;
    }
    const baseList = replaceExisting ? [] : guestSession.students;
    const newItems = createGuestStudentItems(pastePreview.validRows, baseList.length);
    const updatedStudents = reindexGuestStudents([...baseList, ...newItems]);
    onUpdateGuestSession({
      ...guestSession,
      students: updatedStudents,
      calledStudentIds: replaceExisting ? [] : guestSession.calledStudentIds,
    });
    setExcelPasteText('');
    setPastePreview(null);
    setValidationMessage({
      type: 'success',
      text: `Đã nhập thành công ${newItems.length} học sinh từ bảng tính!`,
    });
  };

  // Handlers for File Upload (.xlsx, .xls, .csv)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    setFilePreview(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['xlsx', 'xls', 'csv', 'txt'].includes(ext)) {
      setUploadError('Định dạng tệp không hợp lệ. Vui lòng chọn tệp Excel (.xlsx, .xls) hoặc .csv.');
      return;
    }

    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        if (!buffer || !(buffer instanceof ArrayBuffer)) {
          setUploadError('Không thể đọc nội dung tệp trên trình duyệt.');
          return;
        }
        const parsed = parseExcelBufferToGuestRows(buffer, guestSession.students);
        if (parsed.validRows.length === 0) {
          setUploadError('Tệp không có dòng họ tên học sinh nào hợp lệ. Vui lòng kiểm tra lại cột Họ và tên.');
          return;
        }
        setFilePreview(parsed);
      } catch {
        setUploadError('Không thể phân tích tệp Excel/CSV. Vui lòng kiểm tra tệp không bị đặt mật khẩu hoặc lỗi định dạng.');
      }
    };
    reader.onerror = () => {
      setUploadError('Lỗi khi đọc tệp từ thiết bị.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmFileImport = (replaceExisting: boolean) => {
    if (!filePreview || filePreview.validRows.length === 0) return;
    const baseList = replaceExisting ? [] : guestSession.students;
    const newItems = createGuestStudentItems(filePreview.validRows, baseList.length);
    const updatedStudents = reindexGuestStudents([...baseList, ...newItems]);
    onUpdateGuestSession({
      ...guestSession,
      students: updatedStudents,
      calledStudentIds: replaceExisting ? [] : guestSession.calledStudentIds,
    });
    setFilePreview(null);
    setUploadedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setValidationMessage({
      type: 'success',
      text: `Đã tải thành công ${newItems.length} học sinh từ tệp vào danh sách!`,
    });
  };

  // Roster Row Actions
  const handleToggleParticipating = (guestStudentId: string) => {
    onUpdateGuestSession({
      ...guestSession,
      students: guestSession.students.map(s =>
        s.guestStudentId === guestStudentId ? { ...s, participating: !s.participating } : s
      ),
    });
  };

  const handleSelectAllParticipating = (participating: boolean) => {
    onUpdateGuestSession({
      ...guestSession,
      students: guestSession.students.map(s => ({ ...s, participating })),
    });
  };

  const handleStartEditRow = (student: GuestStudentItem) => {
    setEditingStudentId(student.guestStudentId);
    setEditingNameValue(student.fullName);
    setEditingNoteValue(student.note || '');
  };

  const handleSaveEditRow = (guestStudentId: string) => {
    const cleaned = editingNameValue.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setValidationMessage({ type: 'error', text: 'Tên học sinh không được để trống.' });
      return;
    }
    onUpdateGuestSession({
      ...guestSession,
      students: guestSession.students.map(s =>
        s.guestStudentId === guestStudentId
          ? { ...s, fullName: cleaned, note: editingNoteValue.trim() || undefined }
          : s
      ),
    });
    setEditingStudentId(null);
  };

  const handleDeleteRow = (guestStudentId: string) => {
    const filtered = guestSession.students.filter(s => s.guestStudentId !== guestStudentId);
    onUpdateGuestSession({
      ...guestSession,
      students: reindexGuestStudents(filtered),
      calledStudentIds: guestSession.calledStudentIds.filter(id => id !== guestStudentId),
    });
  };

  const handleLoadSampleClass = (count: number) => {
    const sample = generateSampleVietnameseRoster(count);
    onUpdateGuestSession({
      ...guestSession,
      className: guestSession.className || `Lớp 6A1 (${count} HS)`,
      students: sample,
      calledStudentIds: [],
    });
    setValidationMessage({
      type: 'success',
      text: `Đã tạo nhanh danh sách mẫu gồm ${count} học sinh THCS.`,
    });
  };

  const handleExportGuestHistoryCsv = () => {
    if (guestHistory.length === 0) return;
    const csv = buildGuestHistoryCsvContent(guestHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lich_su_tro_choi_khach_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleProceedStartGame = () => {
    if (rosterMode === 'guest') {
      if (guestSession.students.length === 0) {
        setValidationMessage({
          type: 'error',
          text: 'Danh sách học sinh đang trống! Vui lòng nhập hoặc dán ít nhất 1 học sinh (hoặc bấm "Tạo nhanh 30 HS mẫu") trước khi bắt đầu.',
        });
        return;
      }
      if (participatingStudents.length === 0) {
        setValidationMessage({
          type: 'error',
          text: 'Tất cả học sinh đang ở trạng thái "Tạm nghỉ". Vui lòng bật "Tham gia" cho ít nhất 1 học sinh.',
        });
        return;
      }
    } else {
      const selectedClass = teacherClasses.find(c => c.id === selectedTeacherClassId);
      if (!selectedClass || (selectedClass.students?.length || 0) === 0) {
        setValidationMessage({
          type: 'error',
          text: 'Lớp hệ thống được chọn chưa có học sinh hoặc bạn chưa đăng nhập. Hãy chuyển sang "Chế độ Khách" để tự nhập danh sách ngay!',
        });
        return;
      }
    }
    onStartGame();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      <div className="bg-white w-full max-w-5xl rounded-3xl border-2 border-[#BED8FB] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-[#082B52] via-[#0F3D73] to-[#1769C2] text-white px-5 sm:px-7 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
              <Users className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold uppercase tracking-wider">
                  EDU Game Center
                </span>
                {targetGameCode && (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-300/40 text-cyan-100 text-xs font-bold">
                    {targetGameCode} · {targetGameTitle}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-wide mt-0.5">
                CHUẨN BỊ TRÒ CHƠI &amp; DANH SÁCH HỌC SINH
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F6FAFF]">
          {/* STORAGE WARNING IF LOCALSTORAGE BLOCKED */}
          {!storageOk && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-center gap-3 text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                Trình duyệt đang chặn bộ nhớ cục bộ (LocalStorage). Danh sách học sinh vẫn hoạt động bình thường trong phiên hiện tại nhưng sẽ mất khi tải lại trang.
              </span>
            </div>
          )}

          {/* MODE SELECTOR: 2 CLEAR CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPTION 1: GUEST MODE */}
            <button
              type="button"
              onClick={() => {
                onChangeRosterMode('guest');
                setValidationMessage(null);
              }}
              className={`text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 ${
                rosterMode === 'guest'
                  ? 'bg-gradient-to-br from-[#EAF4FF] to-white border-[#006BFF] shadow-md ring-2 ring-[#006BFF]/20'
                  : 'bg-white border-slate-200 hover:border-blue-300'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold ${
                  rosterMode === 'guest'
                    ? 'bg-[#006BFF] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base sm:text-lg font-bold text-[#082B52]">
                    1. CHẾ ĐỘ KHÁCH – Tự nhập danh sách
                  </span>
                  {rosterMode === 'guest' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#006BFF] text-white text-xs font-bold">
                      Đang chọn
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  <strong>Chơi ngay – Không cần đăng nhập.</strong> Tự nhập tên, dán từ Excel / Google Sheets hoặc tải tệp <code>.xlsx</code>, <code>.csv</code> ngay trên trình duyệt.
                </p>
              </div>
            </button>

            {/* OPTION 2: TEACHER SYSTEM MODE */}
            <button
              type="button"
              onClick={() => {
                onChangeRosterMode('teacher');
                setValidationMessage(null);
              }}
              className={`text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 ${
                rosterMode === 'teacher'
                  ? 'bg-gradient-to-br from-[#EAF4FF] to-white border-[#006BFF] shadow-md ring-2 ring-[#006BFF]/20'
                  : 'bg-white border-slate-200 hover:border-blue-300'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold ${
                  rosterMode === 'teacher'
                    ? 'bg-[#006BFF] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base sm:text-lg font-bold text-[#082B52]">
                    2. CHẾ ĐỘ GIÁO VIÊN – Dữ liệu hệ thống
                  </span>
                  {rosterMode === 'teacher' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#006BFF] text-white text-xs font-bold">
                      Đang chọn
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Sử dụng danh sách lớp học chính thức, ngân hàng câu hỏi và lưu lịch sử đồng bộ theo tài khoản Giáo viên Tây Đô Smart EDU.
                </p>
              </div>
            </button>
          </div>

          {/* VALIDATION / FEEDBACK BANNER */}
          {validationMessage && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium ${
                validationMessage.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : validationMessage.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {validationMessage.type === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                ) : validationMessage.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <span>{validationMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setValidationMessage(null)}
                className="text-xs underline opacity-75 hover:opacity-100"
              >
                Đóng
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* CONTENT FOR GUEST MODE                                         */}
          {/* ============================================================== */}
          {rosterMode === 'guest' && (
            <div className="space-y-5">
              {/* SECTION A: THÔNG TIN LỚP & CẤU HÌNH PHIÊN KHÁCH */}
              <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h3 className="text-base sm:text-lg font-bold text-[#082B52] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#006BFF] text-white text-xs flex items-center justify-center font-bold">
                      A
                    </span>
                    Thông tin lớp học / Nhóm học sinh (Chế độ Khách)
                  </h3>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-[#006BFF] font-bold border border-blue-200">
                      Sĩ số: {guestSession.students.length} HS
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      Tham gia: {participatingStudents.length} HS
                    </span>
                    <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
                      Còn lại chưa gọi: {remainingGuestStudents.length} HS
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên lớp / Nhóm học sinh *
                    </label>
                    <input
                      type="text"
                      value={guestSession.className}
                      onChange={e => handleMetaChange('className', e.target.value)}
                      placeholder="VD: 6A1, 8A2, Câu lạc bộ Tin học..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#006BFF] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên hoạt động / Tiết học (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={guestSession.activityName}
                      onChange={e => handleMetaChange('activityName', e.target.value)}
                      placeholder="VD: Khởi động Bài 5, Ôn tập chương 2..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#006BFF] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ghi chú (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={guestSession.note}
                      onChange={e => handleMetaChange('note', e.target.value)}
                      placeholder="VD: Tiết 2 sáng thứ Hai..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-[#006BFF] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Options: Anti-repeat & Share roster across games */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs sm:text-sm text-slate-700">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!guestSession.allowRepeat}
                        onChange={e =>
                          onUpdateGuestSession({
                            ...guestSession,
                            allowRepeat: !e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-[#006BFF]"
                      />
                      <span className="font-semibold text-[#082B52]">
                        Không lặp lại học sinh đã được gọi trong phiên
                      </span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={guestSession.shareAcrossGames}
                        onChange={e =>
                          onUpdateGuestSession({
                            ...guestSession,
                            shareAcrossGames: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-[#006BFF]"
                      />
                      <span>Giữ nguyên danh sách này khi chuyển sang trò chơi khác</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadSampleClass(30)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#006BFF] font-bold text-xs border border-blue-200 transition-colors"
                    >
                      + Tạo nhanh 30 HS mẫu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleClass(45)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
                    >
                      + Tạo 45 HS mẫu
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION B: 3 PHƯƠNG THỨC NHẬP DANH SÁCH HỌC SINH */}
              <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h3 className="text-base sm:text-lg font-bold text-[#082B52] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#006BFF] text-white text-xs flex items-center justify-center font-bold">
                      B
                    </span>
                    Nhập danh sách học sinh (3 cách linh hoạt)
                  </h3>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveInputTab('direct')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
                        activeInputTab === 'direct'
                          ? 'bg-[#006BFF] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      1. Nhập trực tiếp
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveInputTab('paste_excel')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
                        activeInputTab === 'paste_excel'
                          ? 'bg-[#006BFF] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      2. Dán từ Excel / Google Sheets
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveInputTab('upload_file')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
                        activeInputTab === 'upload_file'
                          ? 'bg-[#006BFF] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      3. Tải tệp Excel (.xlsx) / .csv
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveInputTab('history')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
                        activeInputTab === 'history'
                          ? 'bg-[#006BFF] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <History className="w-4 h-4" />
                      Lịch sử gọi ({guestHistory.length})
                    </button>
                  </div>
                </div>

                {/* TAB 1: NHẬP TRỰC TIẾP */}
                {activeInputTab === 'direct' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Add single student */}
                    <div className="bg-[#F8FBFF] rounded-2xl p-4 border border-blue-100 space-y-3">
                      <h4 className="text-sm font-bold text-[#082B52]">
                        Thêm từng học sinh
                      </h4>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={singleNameInput}
                          onChange={e => setSingleNameInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSingleStudent();
                            }
                          }}
                          placeholder="Nhập họ và tên (VD: Nguyễn Văn An)..."
                          className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:border-[#006BFF] focus:outline-none"
                        />
                        <input
                          type="text"
                          value={singleNoteInput}
                          onChange={e => setSingleNoteInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSingleStudent();
                            }
                          }}
                          placeholder="Ghi chú (Tổ 1...)"
                          className="sm:w-36 px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:border-[#006BFF] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddSingleStudent}
                          className="px-4 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white font-bold text-sm shrink-0 transition-colors"
                        >
                          + Thêm
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">
                        Mẹo: Nhấn phím <strong>Enter</strong> để thêm nhanh học sinh tiếp theo.
                      </p>
                    </div>

                    {/* Add multiple lines */}
                    <div className="bg-[#F8FBFF] rounded-2xl p-4 border border-blue-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-[#082B52]">
                          Nhập nhiều dòng (Mỗi học sinh 1 dòng)
                        </h4>
                        <button
                          type="button"
                          onClick={handleAddMultiLineDirect}
                          className="px-3.5 py-1.5 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white font-bold text-xs transition-colors"
                        >
                          + Thêm tất cả dòng vào danh sách
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={multiLineDirectInput}
                        onChange={e => setMultiLineDirectInput(e.target.value)}
                        placeholder={`Nguyễn Văn An\nTrần Thị Bình\nLê Hoàng Cường\nPhạm Minh Đức`}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:border-[#006BFF] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: DÁN TỪ EXCEL / GOOGLE SHEETS */}
                {activeInputTab === 'paste_excel' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs sm:text-sm text-[#082B52] flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#006BFF] shrink-0 mt-0.5" />
                      <div>
                        <strong>Hỗ trợ tự động nhận diện từ Excel / Google Sheets:</strong> Bạn có thể bôi đen và copy (Ctrl+C) <strong>1 cột</strong> (Họ và tên), <strong>2 cột</strong> (STT | Họ và tên) hoặc <strong>nhiều cột</strong> (STT | Họ và tên | Ghi chú) rồi dán (Ctrl+V) vào ô bên dưới. Hệ thống tự động bỏ dòng tiêu đề và dòng trống.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Dán dữ liệu từ Excel / Google Sheets vào đây:
                        </label>
                        <textarea
                          rows={6}
                          value={excelPasteText}
                          onChange={e => handlePreviewExcelPaste(e.target.value)}
                          placeholder={`STT\tHọ và tên\tGhi chú\n1\tNguyễn Văn An\tTổ 1\n2\tTrần Thị Bình\tTổ 2\n3\tLê Hoàng Cường\tTổ 3`}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:border-[#006BFF] focus:outline-none font-mono"
                        />
                      </div>

                      <div className="bg-[#F8FBFF] rounded-2xl border border-blue-200 p-4 flex flex-col justify-between">
                        {pastePreview ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2">
                              <span className="text-sm font-bold text-[#082B52]">
                                Xem trước kết quả phân tích:
                              </span>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                  Hợp lệ: {pastePreview.validRows.length} HS
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                                  Đã bỏ qua: {pastePreview.skippedCount} dòng
                                </span>
                              </div>
                            </div>

                            {pastePreview.duplicateNames.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                                <strong>Phát hiện tên trùng ({pastePreview.duplicateNames.length}):</strong>{' '}
                                {pastePreview.duplicateNames.join(', ')}. Hệ thống vẫn giữ đầy đủ và cấp mã <code>guestStudentId</code> riêng biệt.
                              </div>
                            )}

                            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 text-xs">
                              {pastePreview.validRows.slice(0, 25).map((r, i) => (
                                <div key={i} className="px-3 py-1.5 flex items-center justify-between">
                                  <span>
                                    <strong>{i + 1}.</strong> {r.fullName}
                                  </span>
                                  <span className="text-slate-400">{r.note || ''}</span>
                                </div>
                              ))}
                              {pastePreview.validRows.length > 25 && (
                                <div className="px-3 py-1.5 text-center text-slate-500 italic">
                                  ... và {pastePreview.validRows.length - 25} học sinh khác
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmExcelPaste(false)}
                                disabled={pastePreview.validRows.length === 0}
                                className="px-4 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-colors"
                              >
                                + Thêm nối tiếp ({pastePreview.validRows.length} HS)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmExcelPaste(true)}
                                disabled={pastePreview.validRows.length === 0}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-colors"
                              >
                                Thay thế danh sách hiện tại ({pastePreview.validRows.length} HS)
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-8">
                            <ClipboardPaste className="w-8 h-8 mb-2 opacity-60" />
                            <p className="text-sm">
                              Dán nội dung từ Excel hoặc Google Sheets vào khung bên trái để xem trước danh sách học sinh.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: TẢI TỆP EXCEL (.XLSX, .XLS) HOẶC .CSV */}
                {activeInputTab === 'upload_file' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="border-2 border-dashed border-blue-300 bg-[#F8FBFF] rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#006BFF] flex items-center justify-center">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-bold text-[#082B52]">
                            Chọn tệp danh sách lớp từ máy tính (.xlsx, .xls, .csv)
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Xử lý 100% trực tiếp trên trình duyệt — Không tải tệp lên máy chủ.
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv,.txt"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-5 py-2.5 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white font-bold text-sm shadow-xs transition-colors"
                        >
                          Chọn tệp Excel / CSV
                        </button>
                        {uploadedFileName && (
                          <p className="text-xs font-semibold text-emerald-700">
                            Đã chọn: {uploadedFileName}
                          </p>
                        )}
                        {uploadError && (
                          <p className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                            {uploadError}
                          </p>
                        )}
                      </div>

                      <div className="bg-[#F8FBFF] rounded-2xl border border-blue-200 p-4 flex flex-col justify-between">
                        {filePreview ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                              <span className="text-sm font-bold text-[#082B52]">
                                Xem trước tệp: {uploadedFileName}
                              </span>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                  Hợp lệ: {filePreview.validRows.length} HS
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                                  Bỏ qua: {filePreview.skippedCount} dòng
                                </span>
                              </div>
                            </div>

                            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 text-xs">
                              {filePreview.validRows.slice(0, 30).map((r, i) => (
                                <div key={i} className="px-3 py-1.5 flex items-center justify-between">
                                  <span>
                                    <strong>{i + 1}.</strong> {r.fullName}
                                  </span>
                                  <span className="text-slate-400">{r.note || ''}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmFileImport(true)}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-colors"
                              >
                                Dùng danh sách từ tệp này ({filePreview.validRows.length} HS)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmFileImport(false)}
                                className="px-4 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white font-bold text-xs sm:text-sm transition-colors"
                              >
                                + Ghép nối vào danh sách đang có
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-8">
                            <FileSpreadsheet className="w-8 h-8 mb-2 opacity-60" />
                            <p className="text-sm">
                              Sau khi chọn tệp <code>.xlsx</code> hoặc <code>.csv</code>, danh sách học sinh sẽ hiển thị tại đây để bạn kiểm tra trước khi xác nhận.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: LỊCH SỬ GỌI CHẾ ĐỘ KHÁCH */}
                {activeInputTab === 'history' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm text-slate-600">
                        Lịch sử các lượt gọi học sinh trong <strong>Chế độ Khách</strong> (lưu riêng trên trình duyệt của bạn, tách biệt hoàn toàn với CSDL hệ thống).
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onResetGuestCalledSession}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Đặt lại lượt đã gọi ({guestSession.calledStudentIds.length})
                        </button>
                        <button
                          type="button"
                          onClick={handleExportGuestHistoryCsv}
                          disabled={guestHistory.length === 0}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Tải lịch sử (.CSV)
                        </button>
                      </div>
                    </div>

                    {guestHistory.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-sm">
                        Chưa có lượt gọi học sinh nào trong phiên Khách hiện tại.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-white text-xs sm:text-sm">
                        {guestHistory.slice(0, 50).map((item, idx) => (
                          <div key={item.turnId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-blue-50 text-[#006BFF] font-bold text-xs flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <span className="font-bold text-[#082B52]">{item.studentName}</span>
                                <span className="text-slate-400 text-xs ml-2">
                                  ({item.className} · {item.gameCode} - {item.gameTitle})
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-slate-500">
                              {new Date(item.timestamp).toLocaleTimeString('vi-VN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION C: BẢNG DANH SÁCH HỌC SINH ĐÃ NHẬP */}
              <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 sm:p-5 shadow-xs space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#006BFF] text-white text-xs flex items-center justify-center font-bold">
                      C
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-[#082B52]">
                      Danh sách học sinh tham gia ({guestSession.students.length} học sinh)
                    </h3>
                  </div>

                  {/* Quick bulk controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={e => setRosterSearch(e.target.value)}
                        placeholder="Tìm kiếm tên HS..."
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-[#006BFF] focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectAllParticipating(true)}
                      disabled={guestSession.students.length === 0}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-[#006BFF]" />
                      Chọn tất cả
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectAllParticipating(false)}
                      disabled={guestSession.students.length === 0}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                      Bỏ chọn tất cả
                    </button>

                    {guestSession.calledStudentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={onResetGuestCalledSession}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Làm mới lượt gọi ({guestSession.calledStudentIds.length})
                      </button>
                    )}

                    {!confirmClearRoster ? (
                      <button
                        type="button"
                        onClick={() => setConfirmClearRoster(true)}
                        disabled={guestSession.students.length === 0}
                        className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa danh sách
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-red-100 px-2.5 py-1 rounded-xl border border-red-300">
                        <span className="text-xs font-bold text-red-800">Xác nhận xóa hết?</span>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateGuestSession({
                              ...guestSession,
                              students: [],
                              calledStudentIds: [],
                            });
                            setConfirmClearRoster(false);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-xs font-bold"
                        >
                          Có, xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearRoster(false)}
                          className="px-2 py-0.5 rounded-lg bg-white text-slate-700 text-xs font-bold"
                        >
                          Hủy
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Duplicate name warning banner (does not auto-delete!) */}
                {duplicateNamesInRoster.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 flex items-center justify-between gap-2">
                    <span>
                      <strong>Lưu ý trùng họ tên:</strong> Trong danh sách có học sinh trùng tên ({duplicateNamesInRoster.join(', ')}). Hệ thống vẫn giữ đầy đủ các em và phân biệt chính xác bằng mã <code>guestStudentId</code> riêng.
                    </span>
                  </div>
                )}

                {/* Roster Table */}
                {guestSession.students.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3 bg-[#FAFBFD]">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <div>
                      <p className="text-base font-bold text-slate-600">
                        Chưa có học sinh nào trong danh sách Khách
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Hãy nhập trực tiếp, dán từ Excel / Google Sheets ở Mục B, hoặc bấm nút bên dưới để tạo nhanh danh sách mẫu.
                      </p>
                    </div>
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleLoadSampleClass(30)}
                        className="px-4 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white font-bold text-xs sm:text-sm shadow-xs"
                      >
                        + Tạo nhanh lớp mẫu 30 học sinh
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead className="bg-[#F0F6FF] text-[#082B52] sticky top-0 z-10 border-b border-blue-200">
                        <tr>
                          <th className="py-2.5 px-3 font-bold w-14 text-center">STT</th>
                          <th className="py-2.5 px-3 font-bold">Họ và tên học sinh</th>
                          <th className="py-2.5 px-3 font-bold w-36">Ghi chú / Tổ</th>
                          <th className="py-2.5 px-3 font-bold w-36 text-center">Trạng thái</th>
                          <th className="py-2.5 px-3 font-bold w-28 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredRosterStudents.map(student => {
                          const isEditing = editingStudentId === student.guestStudentId;
                          const isAlreadyCalled = calledSet.has(student.guestStudentId);
                          return (
                            <tr
                              key={student.guestStudentId}
                              className={`hover:bg-blue-50/40 transition-colors ${
                                !student.participating ? 'opacity-55 bg-slate-50' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center font-bold text-slate-600">
                                {student.stt}
                              </td>
                              <td className="py-2 px-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editingNameValue}
                                    onChange={e => setEditingNameValue(e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-[#006BFF] text-sm font-bold"
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#082B52]">
                                      {student.fullName}
                                    </span>
                                    {isAlreadyCalled && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                                        Đã gọi
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editingNoteValue}
                                    onChange={e => setEditingNoteValue(e.target.value)}
                                    placeholder="Ghi chú..."
                                    className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs"
                                  />
                                ) : (
                                  student.note || '—'
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleParticipating(student.guestStudentId)}
                                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                                    student.participating
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                  }`}
                                >
                                  {student.participating ? 'Tham gia' : 'Tạm nghỉ'}
                                </button>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditRow(student.guestStudentId)}
                                      className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                      title="Lưu"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingStudentId(null)}
                                      className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      title="Hủy"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditRow(student)}
                                      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#006BFF]"
                                      title="Sửa tên học sinh"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRow(student.guestStudentId)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                                      title="Xóa học sinh"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CONTENT FOR TEACHER SYSTEM MODE                                */}
          {/* ============================================================== */}
          {rosterMode === 'teacher' && (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-[#082B52] flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#006BFF]" />
                  Chọn lớp học từ hệ thống Tây Đô Smart EDU
                </h3>
                {!isLoggedInTeacher && onRequestLogin && (
                  <button
                    type="button"
                    onClick={onRequestLogin}
                    className="px-4 py-1.5 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4" />
                    Đăng nhập tài khoản Giáo viên
                  </button>
                )}
              </div>

              {teacherClasses.length === 0 ? (
                <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-sm">
                  <p className="font-bold">
                    Hiện chưa có lớp học hệ thống hoặc bạn chưa đăng nhập tài khoản Giáo viên.
                  </p>
                  <p>
                    Bạn có thể đăng nhập tài khoản Giáo viên để tải danh sách lớp từ Supabase, hoặc bấm chuyển sang{' '}
                    <button
                      type="button"
                      onClick={() => onChangeRosterMode('guest')}
                      className="underline font-bold text-[#006BFF]"
                    >
                      Chế độ Khách – Tự nhập danh sách
                    </button>{' '}
                    để chơi ngay lập tức!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teacherClasses.map(cls => {
                    const isSelected = cls.id === selectedTeacherClassId;
                    const count = cls.students?.length || cls.studentCount || 0;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => onSelectTeacherClassId(cls.id)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-[#006BFF] bg-[#EAF4FF] shadow-xs'
                            : 'border-slate-200 hover:border-blue-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-[#082B52]">
                            {cls.name}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#006BFF] text-xs font-bold">
                            {count} HS
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Khối {cls.grade} · Năm học {cls.schoolYear || '2025-2026'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER CTA */}
        <div className="bg-white border-t border-[#DCE8F7] px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {rosterMode === 'guest' && (
              <>
                {!confirmWipeGuestStorage ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWipeGuestStorage(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                  >
                    Xóa toàn bộ dữ liệu khách trên trình duyệt
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-200">
                    <span className="text-xs font-bold text-red-800">
                      Xóa sạch dữ liệu &amp; lịch sử khách?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllGuestData();
                        setConfirmWipeGuestStorage(false);
                        setValidationMessage({
                          type: 'success',
                          text: 'Đã xóa toàn bộ dữ liệu khách khỏi trình duyệt.',
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold"
                    >
                      Xác nhận xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipeGuestStorage(false)}
                      className="px-2.5 py-1 rounded-lg bg-white text-slate-700 text-xs font-bold border border-slate-300"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleProceedStartGame}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-[#006BFF] to-[#1769C2] hover:from-blue-600 hover:to-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              BẮT ĐẦU TRÒ CHƠI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
