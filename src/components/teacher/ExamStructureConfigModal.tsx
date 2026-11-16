import React, { useState, useEffect } from 'react';
import {
  Sliders,
  X,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  BookOpen,
  Layers,
  Percent,
  Check
} from 'lucide-react';
import {
  ExamStructureConfig,
  getExamStructure,
  saveExamStructure,
  resetExamStructure,
  DEFAULT_EXAM_STRUCTURES
} from '../../utils/examStructure';

interface ExamStructureConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSubject?: string;
  onStructureUpdated?: (newConfig: ExamStructureConfig) => void;
}

const AVAILABLE_SUBJECTS = [
  { id: 'Toán', name: 'Toán học', key: 'toan' },
  { id: 'Tin học', name: 'Tin học', key: 'tin_hoc' },
  { id: 'Khoa học tự nhiên', name: 'Khoa học tự nhiên', key: 'khtn' },
  { id: 'Ngữ văn', name: 'Ngữ văn', key: 'ngu_van' },
  { id: 'Tiếng Anh', name: 'Tiếng Anh', key: 'tieng_anh' },
  { id: 'Lịch sử và Địa lí', name: 'Lịch sử & Địa lí', key: 'lich_su_dia_li' },
  { id: 'Công nghệ', name: 'Công nghệ', key: 'cong_nghe' },
  { id: 'Giáo dục công dân', name: 'GDCD', key: 'gdcd' }
];

export const ExamStructureConfigModal: React.FC<ExamStructureConfigModalProps> = ({
  isOpen,
  onClose,
  initialSubject = 'Toán',
  onStructureUpdated
}) => {
  const [selectedSub, setSelectedSub] = useState<string>(initialSubject);
  const [config, setConfig] = useState<ExamStructureConfig>(() => getExamStructure(initialSubject));
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    setSelectedSub(initialSubject);
    setConfig(getExamStructure(initialSubject));
  }, [initialSubject, isOpen]);

  if (!isOpen) return null;

  const handleSubjectChange = (newSub: string) => {
    setSelectedSub(newSub);
    setConfig(getExamStructure(newSub));
    setSaveSuccess(false);
  };

  const handleApplyPreset = (presetKey: string) => {
    const preset = DEFAULT_EXAM_STRUCTURES[presetKey];
    if (preset) {
      setConfig({
        ...preset,
        subjectKey: config.subjectKey,
        subjectName: config.subjectName
      });
      setSaveSuccess(false);
    }
  };

  const totalPoints = Number((config.singleChoicePoints + config.trueFalsePoints + config.essayPoints).toFixed(1));
  const totalQuestions = config.singleChoiceCount + config.trueFalseCount + config.essayCount;
  const totalCognitivePercent = config.knowPercent + config.understandPercent + config.applyPercent;

  const isPointsValid = Math.abs(totalPoints - 10.0) < 0.05;
  const isPercentValid = totalCognitivePercent === 100;

  // Tính điểm từng câu
  const ptsPerSingle = config.singleChoiceCount > 0 ? (config.singleChoicePoints / config.singleChoiceCount).toFixed(2) : '0';
  const ptsPerTrueFalse = config.trueFalseCount > 0 ? (config.trueFalsePoints / config.trueFalseCount).toFixed(2) : '0';
  const ptsPerEssay = config.essayCount > 0 ? (config.essayPoints / config.essayCount).toFixed(2) : '0';

  const handleSave = () => {
    saveExamStructure(selectedSub, config);
    setSaveSuccess(true);
    if (onStructureUpdated) {
      onStructureUpdated(config);
    }
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 700);
  };

  const handleResetToDefault = () => {
    if (window.confirm(`Khôi phục cấu hình cấu trúc đề thi ${selectedSub} về chuẩn Bộ GD&ĐT?`)) {
      const resetConfig = resetExamStructure(selectedSub);
      setConfig(resetConfig);
      if (onStructureUpdated) {
        onStructureUpdated(resetConfig);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto font-edtech">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl relative border border-[#E2E8F0] my-6 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-[#102C54] hover:bg-slate-100 transition-colors"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF3FF] text-[#1769F4] flex items-center justify-center shrink-0 border border-[#C7DCFA]">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#102C54] tracking-tight">
              Tùy chỉnh cấu trúc đề thi Giữa kỳ & Cuối kỳ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Dành cho Giáo viên & Quản trị • Thiết lập số lượng câu hỏi, tỷ lệ điểm và ma trận nhận thức GDPT 2018
            </p>
          </div>
        </div>

        {/* Chọn Môn học cần tùy chỉnh */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#102C54]">
            1. Chọn môn học cần thiết lập cấu trúc:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AVAILABLE_SUBJECTS.map(sub => (
              <button
                key={sub.id}
                type="button"
                onClick={() => handleSubjectChange(sub.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center whitespace-nowrap shrink-0 ${
                  selectedSub === sub.id
                    ? 'bg-[#1769F4] text-white border-[#1769F4] shadow-xs'
                    : 'bg-[#F6F9FD] text-slate-700 border-[#E2E8F0] hover:bg-[#EAF3FF]'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>

        {/* Các mẫu cấu hình chuẩn nhanh (Presets) */}
        <div className="p-3.5 bg-[#EAF3FF]/70 border border-[#C7DCFA] rounded-2xl space-y-2 text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-[#102C54]">
            <Sparkles className="w-4 h-4 text-[#1769F4]" />
            <span>Mẫu cấu trúc chuẩn Bộ GD&ĐT (Áp dụng nhanh 1 chạm):</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleApplyPreset('toan')}
              className="px-3 py-1.5 bg-white border border-[#C7DCFA] text-[#102C54] rounded-xl font-bold text-[11px] hover:bg-[#EAF3FF] transition-all shadow-2xs"
            >
              📐 Môn Toán: 16 ABCD - 2 Đúng/Sai - 4 Tự luận (40-20-40)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('tin_hoc')}
              className="px-3 py-1.5 bg-white border border-[#C7DCFA] text-[#102C54] rounded-xl font-bold text-[11px] hover:bg-[#EAF3FF] transition-all shadow-2xs"
            >
              💻 Môn Tin: 12 ABCD - 4 Đúng/Sai - 3 Tự luận (30-40-30)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('khtn')}
              className="px-3 py-1.5 bg-white border border-[#C7DCFA] text-[#102C54] rounded-xl font-bold text-[11px] hover:bg-[#EAF3FF] transition-all shadow-2xs"
            >
              🔬 Chuẩn GDPT 2018 chung (16 ABCD - 2 Đ/S - 4 TL)
            </button>
          </div>
        </div>

        {/* 2. THIẾT LẬP CHI TIẾT 3 PHẦN THI */}
        <div className="space-y-4">
          <label className="block text-xs font-bold text-[#102C54]">
            2. Số lượng câu hỏi và thang điểm từng phần (Tổng cộng đạt 10,0 điểm):
          </label>

          {/* Phần I: Trắc nghiệm ABCD */}
          <div className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#102C54] flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-md bg-[#EAF3FF] text-[#1769F4] text-[11px] flex items-center justify-center font-bold">I</span>
                <span>Phần I: Trắc nghiệm nhiều lựa chọn (ABCD)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
                Mỗi câu: <b className="text-[#1769F4]">{ptsPerSingle}đ</b>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Số lượng câu hỏi:</label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={config.singleChoiceCount}
                  onChange={e => setConfig({ ...config, singleChoiceCount: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-[#102C54] tabular-nums focus:ring-2 focus:ring-[#1769F4] outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Tổng điểm Phần I (Tỷ lệ %):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={config.singleChoicePoints}
                    onChange={e => setConfig({ ...config, singleChoicePoints: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-[#102C54] tabular-nums focus:ring-2 focus:ring-[#1769F4] outline-hidden"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400 tabular-nums">điểm ({(config.singleChoicePoints * 10).toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Phần II: Trắc nghiệm Đúng - Sai */}
          <div className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#102C54] flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-md bg-[#ECFDF7] text-[#0B6E4F] text-[11px] flex items-center justify-center font-bold">II</span>
                <span>Phần II: Trắc nghiệm Đúng – Sai (4 ý a, b, c, d mỗi câu)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
                Mỗi câu: <b className="text-[#0B6E4F]">{ptsPerTrueFalse}đ</b> (Đúng 1=0.1, 2=0.25, 3=0.5, 4=1.0đ)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Số lượng câu hỏi:</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={config.trueFalseCount}
                  onChange={e => setConfig({ ...config, trueFalseCount: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-[#102C54] tabular-nums focus:ring-2 focus:ring-[#1769F4] outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Tổng điểm Phần II (Tỷ lệ %):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={config.trueFalsePoints}
                    onChange={e => setConfig({ ...config, trueFalsePoints: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-[#102C54] tabular-nums focus:ring-2 focus:ring-[#1769F4] outline-hidden"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400 tabular-nums">điểm ({(config.trueFalsePoints * 10).toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Phần III: Tự luận / Trả lời ngắn */}
          <div className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#102C54] flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 text-[11px] flex items-center justify-center font-bold">III</span>
                <span>Phần III: Tự luận / Câu hỏi trả lời ngắn</span>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
                Mỗi câu: <b className="text-purple-700">{ptsPerEssay}đ</b>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Số lượng câu hỏi:</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={config.essayCount}
                  onChange={e => setConfig({ ...config, essayCount: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-[#102C54] tabular-nums focus:ring-2 focus:ring-[#1769F4] outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Tổng điểm Phần III (Tỷ lệ %):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={config.essayPoints}
                    onChange={e => setConfig({ ...config, essayPoints: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-[#102C54] tabular-nums focus:ring-2 focus:ring-[#1769F4] outline-hidden"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400 tabular-nums">điểm ({(config.essayPoints * 10).toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. MA TRẬN MỨC ĐỘ NHẬN THỨC (BIẾT - HIỂU - VẬN DỤNG) */}
        <div className="space-y-3 p-4 bg-[#F6F9FD] border border-[#E2E8F0] rounded-2xl text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#102C54] flex items-center space-x-1.5">
              <Percent className="w-4 h-4 text-[#1769F4]" />
              <span>3. Phân bổ ma trận nhận thức GDPT 2018:</span>
            </span>
            <span className={`font-bold tabular-nums ${isPercentValid ? 'text-[#0B6E4F]' : 'text-rose-600'}`}>
              Tổng: {totalCognitivePercent}% {isPercentValid ? '✅' : '⚠️ Cần đủ 100%'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Nhận biết (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.knowPercent}
                onChange={e => setConfig({ ...config, knowPercent: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-[#1769F4] tabular-nums bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block tabular-nums">Tương đương {(config.knowPercent * 0.1).toFixed(1)}đ</span>
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Thông hiểu (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.understandPercent}
                onChange={e => setConfig({ ...config, understandPercent: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-teal-800 tabular-nums bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block tabular-nums">Tương đương {(config.understandPercent * 0.1).toFixed(1)}đ</span>
            </div>

            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Vận dụng (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.applyPercent}
                onChange={e => setConfig({ ...config, applyPercent: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl font-bold text-[#102C54] tabular-nums bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block tabular-nums">Tương đương {(config.applyPercent * 0.1).toFixed(1)}đ</span>
            </div>
          </div>
        </div>

        {/* 4. THỜI LƯỢNG LÀM BÀI */}
        <div className="flex items-center justify-between text-xs p-3 bg-white border border-[#E2E8F0] rounded-xl">
          <div className="flex items-center space-x-2 text-[#102C54] font-bold">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Thời lượng kiểm tra học kỳ:</span>
          </div>
          <div className="flex items-center space-x-2">
            {[45, 60, 90].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setConfig({ ...config, durationMinutes: m })}
                className={`px-3 py-1 rounded-lg font-bold border transition-all tabular-nums whitespace-nowrap shrink-0 ${
                  config.durationMinutes === m
                    ? 'bg-[#FFCC33] text-[#102C54] border-[#FFCC33]'
                    : 'bg-[#F6F9FD] text-slate-600 border-[#E2E8F0] hover:bg-slate-100'
                }`}
              >
                {m} phút
              </button>
            ))}
          </div>
        </div>

        {/* TỔNG KẾT CẤU TRÚC HIỆN TẠI (REAL-TIME SUMMARY STRIP) */}
        <div className="p-4 bg-[#EAF3FF] border border-[#C7DCFA] rounded-2xl space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="font-bold text-[#102C54] block tabular-nums">
                Tổng số câu hỏi đề thi: <span className="text-[#1769F4] text-sm">{totalQuestions} câu</span>
              </span>
              <span className="text-[11px] text-slate-600 tabular-nums">
                Tỷ lệ điểm dạng câu: ({config.singleChoicePoints * 10} - {config.trueFalsePoints * 10} - {config.essayPoints * 10})
                • Nhận thức: ({config.knowPercent} - {config.understandPercent} - {config.applyPercent})
              </span>
            </div>

            <div className="text-right tabular-nums">
              <span className="font-bold text-slate-600 block text-[11px]">Tổng thang điểm:</span>
              <span className={`text-base font-extrabold ${isPointsValid ? 'text-[#0B6E4F]' : 'text-rose-600'}`}>
                {totalPoints} / 10,0 điểm {isPointsValid ? '✅' : '⚠️'}
              </span>
            </div>
          </div>

          {!isPointsValid && (
            <p className="text-[11px] text-rose-600 font-semibold pt-1 border-t border-rose-200 tabular-nums">
              * Lưu ý: Thang điểm tổng 3 phần hiện là {totalPoints} điểm. Vui lòng điều chỉnh để đạt chuẩn 10,0 điểm.
            </p>
          )}
        </div>

        {/* THÔNG BÁO LƯU THÀNH CÔNG */}
        {saveSuccess && (
          <div className="p-3 bg-[#ECFDF7] border border-[#12A879]/30 text-[#0B6E4F] rounded-xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-[#12A879]" />
            <span>Đã lưu và áp dụng cấu trúc đề thi mới cho môn {selectedSub}!</span>
          </div>
        )}

        {/* ACTIONS FOOTER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-4 py-2 border border-[#E2E8F0] text-slate-600 hover:text-[#102C54] rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Khôi phục mặc định chuẩn Bộ GD&ĐT</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E2E8F0] text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 bg-[#1769F4] hover:bg-[#1255CC] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>Lưu & Áp dụng ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
