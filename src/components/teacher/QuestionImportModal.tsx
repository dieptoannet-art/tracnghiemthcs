import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { parseExcelQuestionWorkbook, ParseExcelResult, ParsedQuestionRow } from '../../utils/excelParser';
import { downloadQuestionImportTemplate } from '../../utils/exportExcel';
import { supabase } from '../../lib/supabase';
import { Question } from '../../types';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Database,
  Layers,
  HelpCircle,
  RefreshCw,
  LogIn,
  Copy,
  Check,
  ShieldAlert,
  Laptop,
  WifiOff
} from 'lucide-react';

interface QuestionImportModalProps {
  onClose: () => void;
  onImportSuccess: (questions: any[]) => void;
}

const RLS_MIGRATION_SQL = `-- 1. CẤP QUYỀN THAO TÁC CƠ SỞ DỮ LIỆU CHO VAI TRÒ AUTHENTICATED (CHẶN ANON)
REVOKE ALL ON TABLE public.questions FROM anon;
REVOKE ALL ON TABLE public.protected_solutions FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.protected_solutions TO authenticated;

-- 2. THIẾT LẬP CHÍNH SÁCH RLS CHO PHÉP GIÁO VIÊN & QUẢN TRỊ THÊM/SỬA CÂU HỎI
DROP POLICY IF EXISTS "Giáo viên và Quản trị được thêm câu hỏi" ON public.questions;
CREATE POLICY "Giáo viên và Quản trị được thêm câu hỏi" ON public.questions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_role());

DROP POLICY IF EXISTS "Giáo viên và Quản trị được sửa câu hỏi" ON public.questions;
CREATE POLICY "Giáo viên và Quản trị được sửa câu hỏi" ON public.questions
  FOR UPDATE TO authenticated USING (public.is_staff_role()) WITH CHECK (public.is_staff_role());

-- 3. THIẾT LẬP CHÍNH SÁCH RLS CHO PHÉP LƯU ĐÁP ÁN BẢO VỆ
DROP POLICY IF EXISTS "Giáo viên và Quản trị được thêm đáp án bảo vệ" ON public.protected_solutions;
CREATE POLICY "Giáo viên và Quản trị được thêm đáp án bảo vệ" ON public.protected_solutions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_role());

DROP POLICY IF EXISTS "Giáo viên và Quản trị được sửa đáp án bảo vệ" ON public.protected_solutions;
CREATE POLICY "Giáo viên và Quản trị được sửa đáp án bảo vệ" ON public.protected_solutions
  FOR UPDATE TO authenticated USING (public.is_staff_role()) WITH CHECK (public.is_staff_role());`;

export const QuestionImportModal: React.FC<QuestionImportModalProps> = ({
  onClose,
  onImportSuccess
}) => {
  const { user, userProfile, openAuthModal, importQuestionsBatch } = useApp();

  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseExcelResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessSummary, setSaveSuccessSummary] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  // Error diagnostics states
  const [isRlsPermissionError, setIsRlsPermissionError] = useState<boolean>(false);
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false);
  const [isCopiedSql, setIsCopiedSql] = useState<boolean>(false);

  // Step 1 configurations
  const [selectedGrade, setSelectedGrade] = useState<string>('6');
  const [selectedSubject, setSelectedSubject] = useState<string>('Tin học');
  const [selectedTextbook, setSelectedTextbook] = useState<string>('Kết nối tri thức với cuộc sống');

  // Step 2 Question type selections (Mặc định chọn ABCD và Đúng-Sai; tự luận là tùy chọn theo quy định)
  const [importABCD, setImportABCD] = useState<boolean>(true);
  const [importTF, setImportTF] = useState<boolean>(true);
  const [importEssay, setImportEssay] = useState<boolean>(false);

  const canSaveToSupabase = Boolean(
    user && (userProfile?.role === 'teacher' || userProfile?.role === 'admin' || userProfile?.role === 'reviewer')
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsAnalyzing(true);
    setSaveError(null);
    setIsRlsPermissionError(false);
    setIsNetworkError(false);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const parsed = parseExcelQuestionWorkbook(
          wb,
          selectedGrade,
          selectedSubject,
          selectedTextbook
        );

        setParseResult(parsed);
        setIsAnalyzing(false);
        setStep('preview');
      } catch (err: any) {
        console.error('File parsing error:', err);
        setSaveError(`Lỗi khi đọc file Excel: ${err?.message || 'Định dạng không hỗ trợ'}`);
        setIsAnalyzing(false);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  // Filter questions based on selected question types
  const candidateQuestions = (parseResult?.questions || []).filter(q => {
    if (q.type === 'single_choice' && !importABCD) return false;
    if (q.type === 'true_false_group' && !importTF) return false;
    if (q.type === 'essay' && !importEssay) return false;
    return true;
  });

  const handleCopySql = () => {
    navigator.clipboard.writeText(RLS_MIGRATION_SQL);
    setIsCopiedSql(true);
    setTimeout(() => setIsCopiedSql(false), 3000);
  };

  // Fallback: Lưu vào bộ nhớ cục bộ ứng dụng để tiếp tục làm việc mà không bị gián đoạn
  const handleSaveLocally = () => {
    if (candidateQuestions.length === 0) return;
    const formattedQuestions: Partial<Question>[] = candidateQuestions.map(q => ({
      code: q.code,
      grade: (['6', '7', '8', '9'].includes(q.grade) ? q.grade : '6') as any,
      subject: q.subject as any,
      textbook: q.textbook as any,
      chapter: q.chapter,
      lesson: q.lesson,
      yccd: q.yccd,
      competency: q.competency,
      level: q.level,
      type: q.type,
      stem: q.stem,
      points: q.points,
      options: q.options as any,
      correctAnswer: q.correctAnswer,
      subItems: Array.isArray(q.subItems)
        ? (q.subItems.map((sub: any, idx: number) => {
            const matchedAns =
              q.subItemAnswers?.find((a: any) => a.id === sub.id || a.label === sub.label) ||
              q.subItemAnswers?.[idx];
            return {
              ...sub,
              isCorrect: matchedAns !== undefined ? Boolean(matchedAns.isCorrect) : sub.isCorrect
            };
          }) as any)
        : undefined,
      sampleAnswer: q.sampleEssayAnswer,
      explanation: q.explanation,
      status: q.status
    }));

    importQuestionsBatch(formattedQuestions);
    setSaveSuccessSummary(
      `Đã lưu thành công ${candidateQuestions.length} câu hỏi vào bộ nhớ ứng dụng trình duyệt! Bạn có thể xem, tìm kiếm và kiểm duyệt câu hỏi ngay bây giờ.`
    );
    setIsRlsPermissionError(false);
    setIsNetworkError(false);
    setSaveError(null);
    onImportSuccess(candidateQuestions);
  };

  const handleConfirmImport = async () => {
    if (candidateQuestions.length === 0) return;

    if (!canSaveToSupabase) {
      setSaveError('Chưa có phiên đăng nhập Giáo viên hoặc Quản trị viên trên Supabase. Không thể ghi dữ liệu thật.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setIsRlsPermissionError(false);
    setIsNetworkError(false);
    setSaveProgress('Đang kiểm tra kết nối và đối chiếu mã câu hỏi trong Supabase...');

    try {
      // 1. Lấy danh sách mã câu hỏi hiện có trong DB để tránh ghi đè / trùng lặp (Quy tắc 5: mặc định bỏ qua câu đã có)
      let existingCodeSet = new Set<string>();
      try {
        const { data: existingRows, error: exErr } = await supabase
          .from('questions')
          .select('code');

        if (!exErr && existingRows) {
          existingCodeSet = new Set(existingRows.map((r: any) => r.code));
        } else if (exErr) {
          console.warn('Lưu ý khi kiểm tra trùng mã:', exErr.message);
          if (exErr.code === '42501' || exErr.message?.includes('permission denied')) {
            setIsRlsPermissionError(true);
          }
        }
      } catch (checkErr: any) {
        console.warn('Bỏ qua kiểm tra trùng mã từ xa do mạng:', checkErr);
      }

      const questionsToInsert = candidateQuestions.filter(q => !existingCodeSet.has(q.code));
      const skippedCount = candidateQuestions.length - questionsToInsert.length;

      if (questionsToInsert.length === 0) {
        setIsSaving(false);
        setSaveSuccessSummary(`Tất cả ${candidateQuestions.length} câu hỏi đã có sẵn trong cơ sở dữ liệu Supabase. Hệ thống bỏ qua, không ghi đè.`);
        return;
      }

      setSaveProgress(`Đang lưu ${questionsToInsert.length} câu hỏi vào Supabase (${skippedCount > 0 ? `bỏ qua ${skippedCount} câu trùng` : ''})...`);

      // 2. Chèn vào bảng public.questions theo lô nhỏ (batch of 15) để đảm bảo ổn định mạng và không bị timeout
      const batchSize = 15;
      let insertedCount = 0;

      // Xác định author_id an toàn (chỉ truyền khi id là định dạng UUID hợp lệ)
      const validAuthorUuid =
        userProfile?.id && userProfile.id.length === 36 && userProfile.id.includes('-')
          ? userProfile.id
          : null;

      for (let i = 0; i < questionsToInsert.length; i += batchSize) {
        const batch = questionsToInsert.slice(i, i + batchSize);

        const questionPayloads = batch.map(q => ({
          code: String(q.code).trim(),
          grade: String(q.grade || selectedGrade),
          subject: String(q.subject || selectedSubject),
          textbook: String(q.textbook || selectedTextbook),
          chapter: String(q.chapter || 'Chủ đề chung'),
          lesson: String(q.lesson || 'Bài 1'),
          yccd: q.yccd || 'Chuẩn kiến thức GDPT 2018',
          competency: q.competency || null,
          level: q.level || 'know',
          type: q.type || 'single_choice',
          stem: String(q.stem || ''),
          points: Number(q.points) || 0.25,
          options: q.options || null,
          sub_items: Array.isArray(q.subItems)
            ? q.subItems.map((sub: any, idx: number) => {
                const matchedAns =
                  q.subItemAnswers?.find((a: any) => a.id === sub.id || a.label === sub.label) ||
                  q.subItemAnswers?.[idx];
                const resolvedIsCorrect =
                  matchedAns !== undefined
                    ? Boolean(matchedAns.isCorrect)
                    : sub.isCorrect !== undefined
                    ? Boolean(sub.isCorrect)
                    : undefined;
                return {
                  id: sub.id || String.fromCharCode(97 + idx),
                  text: sub.text || '',
                  level: sub.level || 'know',
                  ...(resolvedIsCorrect !== undefined ? { isCorrect: resolvedIsCorrect } : {})
                };
              })
            : null,
          status: 'pending', // Mặc định ở trạng thái Chờ duyệt theo quy tắc
          author_id: validAuthorUuid,
          version: 1
        }));

        let insertRes: any = null;
        let lastError: any = null;

        // Thử lại tối đa 2 lần với khoảng nghỉ 800ms nếu gặp lỗi mạng tạm thời
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            insertRes = await supabase
              .from('questions')
              .insert(questionPayloads)
              .select('id, code');

            if (!insertRes.error) {
              lastError = null;
              break;
            } else {
              lastError = insertRes.error;
            }
          } catch (fetchErr: any) {
            lastError = fetchErr;
          }

          if (attempt === 0) {
            await new Promise(res => setTimeout(res, 800));
          }
        }

        if (lastError) {
          const errMsg = lastError.message || String(lastError);
          const isFetchFailure = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || !navigator.onLine;

          if (isFetchFailure) {
            setIsNetworkError(true);
            throw new Error(`Không thể kết nối đến máy chủ Supabase (Failed to fetch). Vui lòng thử lại hoặc chọn "Lưu vào bộ nhớ ứng dụng".`);
          }

          if (lastError.code === '42501' || errMsg.includes('permission denied')) {
            setIsRlsPermissionError(true);
            throw new Error(
              `Lỗi bảo mật Supabase (42501): Bảng questions đang thiếu chính sách RLS 'FOR INSERT' cho tài khoản Giáo viên.`
            );
          }

          throw new Error(`Lỗi khi lưu bảng questions (lô ${Math.floor(i / batchSize) + 1}): ${errMsg}`);
        }

        const insertedQuestions = insertRes?.data || [];

        // 3. Chèn đáp án bảo vệ vào bảng public.protected_solutions
        if (insertedQuestions && insertedQuestions.length > 0) {
          const solutionPayloads = insertedQuestions.map((iq: any) => {
            const origin = batch.find(b => b.code === iq.code);
            return {
              question_id: iq.id,
              correct_answer: origin?.correctAnswer || null,
              sub_item_answers: origin?.subItemAnswers || null,
              sample_essay_answer: origin?.sampleEssayAnswer || null,
              rubric: origin?.rubric || null,
              explanation: origin?.explanation || 'Lời giải chi tiết'
            };
          });

          try {
            const { error: solErr } = await supabase
              .from('protected_solutions')
              .upsert(solutionPayloads);

            if (solErr) {
              console.warn('Lưu ý khi cập nhật protected_solutions:', solErr.message);
            }
          } catch (solEx) {
            console.warn('Lỗi mạng ngoại lệ khi lưu protected_solutions:', solEx);
          }
        }

        insertedCount += batch.length;
        setSaveProgress(`Đã lưu ${insertedCount} / ${questionsToInsert.length} câu vào Supabase...`);
      }

      setIsSaving(false);
      setSaveSuccessSummary(
        `Đã lưu thành công ${questionsToInsert.length} câu hỏi thật vào CSDL Supabase!${skippedCount > 0 ? ` (Bỏ qua ${skippedCount} câu đã có)` : ''}`
      );

      // Callback báo thành công để màn hình chính tải lại
      onImportSuccess(questionsToInsert);
    } catch (err: any) {
      console.error('Lỗi khi nhập Supabase:', err);
      setIsSaving(false);
      const msg = err?.message || 'Lỗi khi lưu câu hỏi vào cơ sở dữ liệu Supabase.';
      setSaveError(msg);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setIsNetworkError(true);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-serif">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#082B52]">Nhập ngân hàng câu hỏi từ Excel</h3>
              <p className="text-xs text-slate-500">
                Hỗ trợ tệp cấu trúc chuẩn (Sheet 01 Bài học, 02 ABCD, 03 Đúng–Sai, 04 Tự luận) và lưu thật vào Supabase
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload & Parameters */}
        {step === 'upload' ? (
          <div className="space-y-6">
            {/* Download Template Banner */}
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-[#082B52]">Tải tệp Excel mẫu chuẩn THCS</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tệp mẫu gồm các Sheet: 01_Danh_muc_bai_hoc, 02_Trac_nghiem_ABCD, 03_Dung_Sai, 04_Tu_luan.
                </p>
              </div>
              <button
                onClick={downloadQuestionImportTemplate}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white text-[#006BFF] border border-[#006BFF] rounded-xl text-xs font-bold hover:bg-blue-50 shrink-0 shadow-2xs"
              >
                <Download className="w-4 h-4" />
                <span>Tải tệp Excel mẫu (.xlsx)</span>
              </button>
            </div>

            {/* Scope selectors (Lớp, Môn, Bộ sách) */}
            <div className="bg-[#FBFDFF] p-4 rounded-xl border border-[#DCE8F7] space-y-3">
              <span className="text-xs font-bold text-[#082B52] block">
                Phạm vi áp dụng (theo chuẩn môn học GDPT 2018):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Khối lớp:</label>
                  <select
                    value={selectedGrade}
                    onChange={e => setSelectedGrade(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-white font-semibold text-slate-700"
                  >
                    <option value="6">Lớp 6</option>
                    <option value="7">Lớp 7</option>
                    <option value="8">Lớp 8</option>
                    <option value="9">Lớp 9</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Môn học:</label>
                  <select
                    value={selectedSubject}
                    onChange={e => setSelectedSubject(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-white font-semibold text-slate-700"
                  >
                    <option value="Tin học">Tin học</option>
                    <option value="Toán">Toán</option>
                    <option value="Khoa học tự nhiên">Khoa học tự nhiên</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Công nghệ">Công nghệ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Bộ sách:</label>
                  <select
                    value={selectedTextbook}
                    onChange={e => setSelectedTextbook(e.target.value)}
                    className="w-full text-xs px-3 py-2 border rounded-xl bg-white font-semibold text-slate-700"
                  >
                    <option value="Kết nối tri thức với cuộc sống">Kết nối tri thức với cuộc sống</option>
                    <option value="Cánh Diều">Cánh Diều</option>
                    <option value="Chân trời sáng tạo">Chân trời sáng tạo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-[#082B52]">Chọn tệp Excel từ máy tính của bạn</h4>
              <div className="border-2 border-dashed border-[#DCE8F7] hover:border-[#006BFF] rounded-2xl p-8 text-center bg-[#FBFDFF] transition-colors relative cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#082B52]">
                      Kéo thả tệp vào đây hoặc <span className="text-[#006BFF]">chọn từ máy tính</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Định dạng hỗ trợ: .xlsx, .xls</p>
                  </div>
                </div>
              </div>
            </div>

            {isAnalyzing && (
              <div className="text-center py-4 text-xs font-semibold text-[#006BFF] flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang phân tích các Sheet (01 Bài học, 02 ABCD, 03 Đúng–Sai, 04 Tự luận)...</span>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Preview, Validation & Supabase Storage */
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase">Tệp đã chọn:</span>
                <span className="font-bold text-sm text-[#082B52] ml-2">{file?.name}</span>
                {parseResult?.isMultiSheetFormat && (
                  <span className="ml-2 text-[10px] font-bold bg-blue-100 text-[#006BFF] px-2 py-0.5 rounded-full">
                    Định dạng đa sheet chuẩn
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setStep('upload');
                  setSaveSuccessSummary(null);
                  setSaveError(null);
                  setIsRlsPermissionError(false);
                  setIsNetworkError(false);
                }}
                className="text-xs text-[#006BFF] font-semibold hover:underline"
              >
                Chọn tệp khác
              </button>
            </div>

            {/* Success summary message */}
            {saveSuccessSummary && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-300 text-xs text-emerald-800 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Hoàn tất nhập dữ liệu!</span>
                </div>
                <p>{saveSuccessSummary}</p>
                <div className="pt-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700"
                  >
                    Đóng và xem danh sách câu hỏi
                  </button>
                </div>
              </div>
            )}

            {/* Network / Failed to Fetch Diagnostic Card */}
            {isNetworkError && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-xs text-amber-900 space-y-3 shadow-xs">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                    <WifiOff className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-[#082B52]">
                      Không thể gửi yêu cầu tới Supabase (Failed to fetch)
                    </h4>
                    <p className="text-slate-600 leading-relaxed text-[11.5px]">
                      Trình duyệt không thể hoàn tất kết nối tới máy chủ Supabase. Nguyên nhân có thể do kết nối mạng chập chờn, tiện ích chặn quảng cáo (AdBlocker) chặn domain Supabase, hoặc dự án Supabase đang tạm nghỉ (paused).
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-amber-200 text-[11.5px] text-slate-700 space-y-1">
                  <p className="font-bold text-[#082B52]">Giải pháp ngay lập tức:</p>
                  <p>• Bấm <b>"Lưu vào bộ nhớ ứng dụng"</b> để lưu toàn bộ câu hỏi vào hệ thống ngay lập tức, tiếp tục xem, tìm kiếm và thẩm định mà không bị mất dữ liệu.</p>
                  <p>• Hoặc kiểm tra mạng và bấm <b>"Thử lại lưu Supabase"</b>.</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-amber-200/60">
                  <span className="text-slate-600 font-medium">
                    Không lo mất dữ liệu: Lưu vào bộ nhớ để sử dụng ngay:
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSaveLocally}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs"
                    >
                      <Laptop className="w-4 h-4" />
                      <span>Lưu vào bộ nhớ ứng dụng</span>
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Thử lại lưu Supabase</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* RLS Permission Denied Diagnostic Card */}
            {isRlsPermissionError && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-xs text-amber-900 space-y-3 shadow-xs">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-[#082B52]">
                      Supabase từ chối quyền ghi: permission denied for table questions (Lỗi 42501)
                    </h4>
                    <p className="text-slate-600 leading-relaxed text-[11.5px]">
                      Bảng <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200 font-mono text-[#006BFF]">public.questions</code> trên Supabase đang kích hoạt <b>Row Level Security (RLS)</b> nhưng hiện tại chưa được cấp quyền <b>INSERT</b> cho vai trò người dùng đã xác thực (authenticated) hoặc Giáo viên.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200 font-mono text-[11px] text-slate-800 space-y-1">
                  <div className="flex justify-between items-center mb-1 pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-[#082B52] font-sans">
                      Lệnh SQL cấp quyền RLS (Chạy tại Supabase Dashboard → SQL Editor):
                    </span>
                    <button
                      onClick={handleCopySql}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-[#006BFF] text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors shadow-2xs"
                    >
                      {isCopiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopiedSql ? 'Đã sao chép!' : 'Sao chép lệnh SQL'}</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre text-[10.5px] text-slate-700 max-h-36 p-1 bg-slate-50 rounded">
                    {RLS_MIGRATION_SQL}
                  </pre>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-amber-200/60">
                  <span className="text-slate-600 font-medium">
                    Bạn có thể lưu câu hỏi vào bộ nhớ ứng dụng để duyệt và sử dụng ngay bây giờ:
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSaveLocally}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs"
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span>Lưu vào bộ nhớ ứng dụng</span>
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Thử lại lưu Supabase</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error notifications (non-RLS and non-network) */}
            {saveError && !isRlsPermissionError && !isNetworkError && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 space-y-1">
                <div className="flex items-center space-x-2 font-bold text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Có lỗi xảy ra:</span>
                </div>
                <p>{saveError}</p>
              </div>
            )}

            {/* Validation errors from Excel file */}
            {parseResult && parseResult.errors.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="flex items-center space-x-2 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Cảnh báo định dạng ({parseResult.errors.length} dòng cần lưu ý):</span>
                </div>
                <ul className="list-disc list-inside max-h-24 overflow-y-auto space-y-0.5 text-[11px]">
                  {parseResult.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>
                      <b>[{err.sheet}]</b> Dòng {err.row} ({err.field}): {err.message}
                    </li>
                  ))}
                  {parseResult.errors.length > 10 && (
                    <li className="italic">...và {parseResult.errors.length - 10} cảnh báo khác</li>
                  )}
                </ul>
              </div>
            )}

            {/* Question Type Selection Checkboxes (Quy tắc 3: Mặc định chọn ABCD và Đúng-Sai, Tự luận là tùy chọn) */}
            <div className="p-4 bg-[#F3F8FF] rounded-xl border border-[#DCE8F7] space-y-2">
              <span className="text-xs font-bold text-[#082B52] block">
                Chọn các loại câu hỏi cần nhập vào ngân hàng:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importABCD}
                    onChange={e => setImportABCD(e.target.checked)}
                    className="w-4 h-4 text-[#006BFF] rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Trắc nghiệm ABCD ({parseResult?.counts.singleChoice || 0} câu)
                  </span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importTF}
                    onChange={e => setImportTF(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Đúng – Sai 4 ý ({parseResult?.counts.trueFalse || 0} câu)
                  </span>
                </label>

                <label className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importEssay}
                    onChange={e => setImportEssay(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Tự luận ({parseResult?.counts.essay || 0} câu - Tùy chọn)
                  </span>
                </label>
              </div>
            </div>

            {/* Check DB Authentication warning */}
            {!canSaveToSupabase && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Chưa đăng nhập tài khoản Giáo viên/Quản trị viên trên Supabase. Bạn có thể xem trước nội dung, nhưng nút <b>Xác nhận nhập</b> bị vô hiệu hóa để bảo vệ tính toàn vẹn dữ liệu.
                  </span>
                </div>
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-3 py-1.5 bg-[#006BFF] text-white rounded-lg text-xs font-bold shrink-0 hover:bg-blue-600"
                >
                  Đăng nhập ngay
                </button>
              </div>
            )}

            {/* Preview Table */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>
                  Danh sách xem trước: <b>{candidateQuestions.length}</b> câu hỏi được chọn
                </span>
                <span className="text-emerald-700">Mặc định ở trạng thái Chờ duyệt</span>
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F3F8FF] text-[#12345B] uppercase font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">Mã câu</th>
                      <th className="p-2.5">Bài học</th>
                      <th className="p-2.5">Dạng câu</th>
                      <th className="p-2.5">Mức độ</th>
                      <th className="p-2.5">Nội dung câu hỏi</th>
                      <th className="p-2.5">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {candidateQuestions.slice(0, 50).map((q, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold font-mono text-[#006BFF] whitespace-nowrap">{q.code}</td>
                        <td className="p-2.5 max-w-[150px] truncate">{q.lesson}</td>
                        <td className="p-2.5 whitespace-nowrap">
                          {q.type === 'single_choice' ? 'ABCD' : q.type === 'true_false_group' ? 'Đúng–Sai' : 'Tự luận'}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {q.level === 'know' ? 'Biết' : q.level === 'understand' ? 'Hiểu' : 'Vận dụng'}
                        </td>
                        <td className="p-2.5 max-w-xs truncate">{q.stem}</td>
                        <td className="p-2.5 font-bold">{q.points}đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {candidateQuestions.length > 50 && (
                <p className="text-[11px] text-slate-400 italic text-right px-1">
                  Đang hiển thị 50 câu đầu tiên trong tổng số {candidateQuestions.length} câu.
                </p>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-semibold">
                {isSaving ? saveProgress : `Sẵn sàng nhập ${candidateQuestions.length} câu`}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={candidateQuestions.length === 0 || isSaving || !canSaveToSupabase}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 flex items-center space-x-1.5 shadow-xs"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang lưu vào Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span>Xác nhận nhập ({candidateQuestions.length} câu)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
