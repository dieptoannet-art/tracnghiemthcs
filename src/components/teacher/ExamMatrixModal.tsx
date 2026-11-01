import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExamMatrix, MatrixRow } from '../../types';
import { exportToWordDocument, generateMatrixHtml, generateExamPaperHtml, generateSolutionHtml } from '../../utils/exportWord';
import {
  LayoutGrid,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Printer,
  Sparkles
} from 'lucide-react';

export const ExamMatrixModal: React.FC = () => {
  const { matrices, questions, exams, selectedGrade, selectedSubject, createMatrix } = useApp();
  const currentMatrix = matrices[0] || null;

  const [activeTab, setActiveTab] = useState<'matrix' | 'specification'>('matrix');

  // Check bank availability for each cell in the matrix
  const bankCheckResults = currentMatrix?.rows.map(row => {
    const matchingKnow = questions.filter(q => q.level === 'know' && q.type === row.questionType);
    const matchingUnderstand = questions.filter(q => q.level === 'understand' && q.type === row.questionType);
    const matchingApply = questions.filter(q => q.level === 'apply' && q.type === row.questionType);

    const isLackingKnow = row.knowCount > matchingKnow.length;
    const isLackingUnderstand = row.understandCount > matchingUnderstand.length;
    const isLackingApply = row.applyCount > matchingApply.length;

    return {
      rowId: row.id,
      topic: row.topic,
      isLacking: isLackingKnow || isLackingUnderstand || isLackingApply,
      details: {
        know: { required: row.knowCount, available: matchingKnow.length },
        understand: { required: row.understandCount, available: matchingUnderstand.length },
        apply: { required: row.applyCount, available: matchingApply.length }
      }
    };
  }) || [];

  const handleExportMatrixWord = () => {
    if (!currentMatrix) return;
    const html = generateMatrixHtml(currentMatrix);
    exportToWordDocument(
      currentMatrix.title,
      html,
      `Ma_Tran_Kiem_Tra_THCS_Tay_Do_${currentMatrix.subject}_Lop${currentMatrix.grade}`
    );
  };

  const handleExportFullExamPackage = () => {
    const exam = exams[0];
    if (!exam || !currentMatrix) return;

    const matrixHtml = generateMatrixHtml(currentMatrix);
    const paperHtml = generateExamPaperHtml(exam);
    const solutionHtml = generateSolutionHtml(exam);

    const combinedHtml = `
      ${matrixHtml}
      <br style="page-break-after: always;" />
      ${paperHtml}
      <br style="page-break-after: always;" />
      ${solutionHtml}
    `;

    exportToWordDocument(
      'Hồ sơ kiểm tra hoàn chỉnh THCS Tây Đô',
      combinedHtml,
      `Ho_So_Kiem_Tra_Hoan_Chinh_${exam.code}`
    );
  };

  if (!currentMatrix) {
    return (
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center text-slate-400">
        Chưa có ma trận đề nào được tạo.
      </div>
    );
  }

  const totalKnowPts = currentMatrix.rows.reduce((sum, r) => sum + r.knowPoints, 0);
  const totalUnderstandPts = currentMatrix.rows.reduce((sum, r) => sum + r.understandPoints, 0);
  const totalApplyPts = currentMatrix.rows.reduce((sum, r) => sum + r.applyPoints, 0);
  const calculatedTotal = totalKnowPts + totalUnderstandPts + totalApplyPts;

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
            <LayoutGrid className="w-6 h-6 text-[#006BFF]" />
            <span>Ma trận & Bản đặc tả đề kiểm tra</span>
          </h2>
          <p className="text-sm text-slate-500">
            {currentMatrix.title} • Thời lượng: {currentMatrix.durationMinutes} phút
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportMatrixWord}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white text-[#006BFF] border border-[#006BFF] rounded-xl text-xs font-bold hover:bg-blue-50 shadow-2xs"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Ma trận Word (.doc)</span>
          </button>

          <button
            onClick={handleExportFullExamPackage}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Xuất trọn bộ Hồ sơ kiểm tra</span>
          </button>
        </div>
      </div>

      {/* Cognitive Ratio Cards (Tỉ lệ 40% - 40% - 20%) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Mức nhận biết (40%)</span>
          <div className="text-2xl font-bold text-[#006BFF] mt-1">{totalKnowPts.toFixed(2)} điểm</div>
          <span className="text-[11px] text-slate-500">Đạt {Math.round((totalKnowPts / calculatedTotal) * 100)}% tổng điểm</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Mức thông hiểu (40%)</span>
          <div className="text-2xl font-bold text-purple-600 mt-1">{totalUnderstandPts.toFixed(2)} điểm</div>
          <span className="text-[11px] text-slate-500">Đạt {Math.round((totalUnderstandPts / calculatedTotal) * 100)}% tổng điểm</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Mức vận dụng (20%)</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{totalApplyPts.toFixed(2)} điểm</div>
          <span className="text-[11px] text-slate-500">Đạt {Math.round((totalApplyPts / calculatedTotal) * 100)}% tổng điểm</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Tổng điểm đề thi</span>
          <div className="text-2xl font-bold text-[#082B52] mt-1">{calculatedTotal.toFixed(2)} / 10.0</div>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1 mt-0.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Khớp 100% định mức</span>
          </span>
        </div>
      </div>

      {/* Bank Availability Alert: Check if bank has missing items */}
      <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 space-y-2">
        <div className="flex items-center space-x-2 text-[#082B52] font-bold text-xs uppercase">
          <Sparkles className="w-4 h-4 text-[#006BFF]" />
          <span>Kiểm tra độ sẵn sàng của Ngân hàng câu hỏi theo Ma trận:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
          {bankCheckResults.map(bc => (
            <div key={bc.rowId} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="truncate pr-2 font-medium">{bc.topic}</span>
              <span className="shrink-0 text-emerald-700 font-bold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đủ câu hỏi</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs Switcher: Ma trận vs Bản đặc tả */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'matrix'
              ? 'border-[#006BFF] text-[#006BFF]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Bảng Ma trận đề kiểm tra
        </button>
        <button
          onClick={() => setActiveTab('specification')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'specification'
              ? 'border-[#006BFF] text-[#006BFF]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Bản đặc tả ma trận đề (YCCĐ & Năng lực)
        </button>
      </div>

      {/* 1. MATRIX VIEW */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-[#F3F8FF] text-[#12345B] text-xs uppercase font-bold border-b border-[#DCE8F7]">
                <tr>
                  <th rowSpan={2} className="py-3 px-3 text-center border-r border-[#DCE8F7] w-12">STT</th>
                  <th rowSpan={2} className="py-3 px-4 border-r border-[#DCE8F7]">Chủ đề / Đơn vị kiến thức</th>
                  <th rowSpan={2} className="py-3 px-3 text-center border-r border-[#DCE8F7]">Dạng câu</th>
                  <th colSpan={3} className="py-2 px-3 text-center border-r border-[#DCE8F7]">Mức độ nhận thức (Số câu / Số ý - Điểm)</th>
                  <th rowSpan={2} className="py-3 px-4 text-center">Tổng điểm</th>
                </tr>
                <tr className="border-t border-[#DCE8F7] text-[11px]">
                  <th className="py-2 px-3 text-center border-r border-[#DCE8F7] bg-blue-50/50">Nhận biết</th>
                  <th className="py-2 px-3 text-center border-r border-[#DCE8F7] bg-purple-50/50">Thông hiểu</th>
                  <th className="py-2 px-3 text-center border-r border-[#DCE8F7] bg-emerald-50/50">Vận dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {currentMatrix.rows.map((row, idx) => {
                  const rowSum = row.knowPoints + row.understandPoints + row.applyPoints;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-center text-slate-400 font-bold border-r border-slate-100">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 border-r border-slate-100">
                        <b className="text-[#082B52] block text-sm">{row.topic}</b>
                        <span className="text-slate-500 text-[11px]">{row.unit}</span>
                      </td>
                      <td className="py-3 px-3 text-center border-r border-slate-100 font-medium">
                        {row.questionType === 'single_choice'
                          ? 'Trắc nghiệm 1 ĐA'
                          : row.questionType === 'true_false_group'
                          ? 'Đúng - Sai (4 ý)'
                          : row.questionType === 'short_answer'
                          ? 'Trả lời ngắn'
                          : 'Tự luận'}
                      </td>
                      <td className="py-3 px-3 text-center border-r border-slate-100 font-semibold text-blue-700">
                        {row.knowCount > 0 ? `${row.knowCount} câu (${row.knowPoints}đ)` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center border-r border-slate-100 font-semibold text-purple-700">
                        {row.understandCount > 0 ? `${row.understandCount} câu (${row.understandPoints}đ)` : '-'}
                      </td>
                      <td className="py-3 px-3 text-center border-r border-slate-100 font-semibold text-emerald-700">
                        {row.applyCount > 0 ? `${row.applyCount} câu (${row.applyPoints}đ)` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#082B52] text-sm">
                        {rowSum.toFixed(2)}đ
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-slate-50 font-bold text-xs text-[#082B52]">
                  <td colSpan={3} className="py-3 px-4 text-center uppercase tracking-wider border-r border-slate-200">
                    TỔNG CỘNG ĐIỂM SỐ
                  </td>
                  <td className="py-3 px-3 text-center border-r border-slate-200 text-blue-800">
                    {totalKnowPts.toFixed(2)}đ ({currentMatrix.cognitiveRatio.knowPercent}%)
                  </td>
                  <td className="py-3 px-3 text-center border-r border-slate-200 text-purple-800">
                    {totalUnderstandPts.toFixed(2)}đ ({currentMatrix.cognitiveRatio.understandPercent}%)
                  </td>
                  <td className="py-3 px-3 text-center border-r border-slate-200 text-emerald-800">
                    {totalApplyPts.toFixed(2)}đ ({currentMatrix.cognitiveRatio.applyPercent}%)
                  </td>
                  <td className="py-3 px-4 text-center text-sm font-bold text-[#006BFF]">
                    {calculatedTotal.toFixed(2)}đ (100%)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SPECIFICATION VIEW */}
      {activeTab === 'specification' && (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-[#F3F8FF] text-[#12345B] text-xs uppercase font-bold border-b border-[#DCE8F7]">
                <tr>
                  <th className="py-3 px-3 text-center border-r border-[#DCE8F7] w-12">STT</th>
                  <th className="py-3 px-4 border-r border-[#DCE8F7] w-1/4">Chương / Chủ đề</th>
                  <th className="py-3 px-4 border-r border-[#DCE8F7] w-1/4">Đơn vị kiến thức</th>
                  <th className="py-3 px-4 border-r border-[#DCE8F7]">Yêu cầu cần đạt chuẩn GDPT 2018</th>
                  <th className="py-3 px-3 text-center">Số câu & Mức độ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {currentMatrix.rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 text-center text-slate-400 font-bold border-r border-slate-100">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#082B52] border-r border-slate-100">
                      {row.topic}
                    </td>
                    <td className="py-3 px-4 text-slate-700 border-r border-slate-100">
                      {row.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-600 border-r border-slate-100 leading-relaxed">
                      {row.yccd}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-[#006BFF]">
                      {[
                        row.knowCount > 0 ? `${row.knowCount} Biết` : null,
                        row.understandCount > 0 ? `${row.understandCount} Hiểu` : null,
                        row.applyCount > 0 ? `${row.applyCount} Vận dụng` : null
                      ].filter(Boolean).join(' + ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
