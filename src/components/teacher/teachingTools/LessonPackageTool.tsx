import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FolderOpen,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ACTIVITY_MODE_META,
  ClassTeachingSessionState,
  LessonPackageItem,
  buildPackageFromSession,
  serializePackageForShare,
  validateAndImportPackageJson,
} from './teachingToolsEngine';

import type { ToolQuestionSet } from './questionBankEngine';
import type { ActivityProPackageTemplate } from './activityProEngine';

interface LessonPackageToolProps {
  currentClassName: string;
  currentSession: ClassTeachingSessionState;
  savedPackages: LessonPackageItem[];
  questionSets?: ToolQuestionSet[];
  hasSavedSessionForClass: boolean;
  activityProTemplate?: ActivityProPackageTemplate | null;
  onSavePackagesList: (nextPackages: LessonPackageItem[]) => void;
  onApplyPackageFresh: (pkg: LessonPackageItem) => void;
  onResumeSavedClassSession: () => void;
}

export const LessonPackageTool: React.FC<LessonPackageToolProps> = ({
  currentClassName,
  currentSession,
  savedPackages,
  questionSets = [],
  hasSavedSessionForClass,
  activityProTemplate = null,
  onSavePackagesList,
  onApplyPackageFresh,
  onResumeSavedClassSession,
}) => {
  const [packageName, setPackageName] = useState<string>('');
  const [packageDesc, setPackageDesc] = useState<string>('');
  const [attachSetId, setAttachSetId] = useState<string>(
    () => currentSession.pendingReviewGamePrefill?.questionSetId || questionSets[0]?.id || ''
  );
  const [attachGameMode, setAttachGameMode] = useState<'puzzle' | 'race' | 'golden_bell'>(
    () => currentSession.pendingReviewGamePrefill?.mode || 'puzzle'
  );
  const [attachSeconds, setAttachSeconds] = useState<number>(
    () => currentSession.pendingReviewGamePrefill?.secondsPerQuestion ?? 30
  );
  const [attachPoints, setAttachPoints] = useState<number>(
    () => currentSession.pendingReviewGamePrefill?.pointsPerCorrect ?? 10
  );
  const [previewPkg, setPreviewPkg] = useState<LessonPackageItem | null>(null);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSaveCurrentAsPackage = () => {
    const pickedQuestionSet = attachSetId
      ? questionSets.find((q) => q.id === attachSetId) || null
      : null;
    const newPkg = buildPackageFromSession({
      name: packageName.trim() || `Gói tiết dạy · ${currentClassName}`,
      description: packageDesc.trim(),
      session: currentSession,
      questionSet: pickedQuestionSet,
      reviewConfig: pickedQuestionSet
        ? {
            mode: attachGameMode,
            secondsPerQuestion: attachSeconds,
            pointsPerCorrect: attachPoints,
            turnRule: currentSession.pendingReviewGamePrefill?.turnRule || 'rotate_every_question',
          }
        : null,
      activityProTemplate,
    });
    onSavePackagesList([newPkg, ...savedPackages]);
    setPackageName('');
    setPackageDesc('');
    setStatusMsg({
      type: 'success',
      text: `Đã lưu gói "${newPkg.name}" (chỉ lưu cấu hình & bộ câu hỏi, không kèm danh sách học sinh).`,
    });
  };

  const handleDuplicatePackage = (pkg: LessonPackageItem) => {
    const nowIso = new Date().toISOString();
    const copyPkg: LessonPackageItem = {
      ...pkg,
      packageId: `pkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${pkg.name} (Bản sao)`,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    onSavePackagesList([copyPkg, ...savedPackages]);
    setStatusMsg({
      type: 'success',
      text: `Đã nhân bản gói "${pkg.name}".`,
    });
  };

  const handleDeletePackage = (packageId: string) => {
    onSavePackagesList(savedPackages.filter((p) => p.packageId !== packageId));
    if (previewPkg?.packageId === packageId) {
      setPreviewPkg(null);
    }
  };

  const handleExportJsonFile = (pkg: LessonPackageItem) => {
    const json = serializePackageForShare(pkg);
    try {
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pkg.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'goi_tiet_day'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg({
        type: 'success',
        text: `Đã xuất tệp JSON cho gói "${pkg.name}" (không chứa danh sách học sinh).`,
      });
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'Không thể tải tệp trên trình duyệt hiện tại.',
      });
    }
  };

  const handleCopyJson = async (pkg: LessonPackageItem) => {
    const json = serializePackageForShare(pkg);
    try {
      await navigator.clipboard.writeText(json);
      setStatusMsg({
        type: 'success',
        text: `Đã sao chép JSON cấu hình gói "${pkg.name}" vào bộ nhớ tạm.`,
      });
    } catch {
      setImportJsonText(json);
      setStatusMsg({
        type: 'success',
        text: 'Đã hiển thị JSON chia sẻ vào khung bên dưới.',
      });
    }
  };

  const handleImportJson = (raw: string) => {
    const result = validateAndImportPackageJson(raw);
    if (!result.ok || !result.pkg) {
      setStatusMsg({
        type: 'error',
        text: result.error || 'Tệp JSON không hợp lệ.',
      });
      return;
    }
    onSavePackagesList([result.pkg, ...savedPackages]);
    setImportJsonText('');
    setStatusMsg({
      type: 'success',
      text: `Đã nhập thành công gói "${result.pkg.name}".`,
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handleImportJson(String(reader.result || ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5 font-edtech">
      {/* Save Current Setup Card + Resume Saved Session */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#0F2D52]">
              Gói tiết dạy &amp; Phiên làm việc
            </h3>
            <p className="text-sm text-slate-600">
              Lưu tái sử dụng cấu hình nhóm, hoạt động, đồng hồ và bảng điểm. Mặc định tệp chia
              sẻ không chứa danh sách học sinh.
            </p>
          </div>

          {hasSavedSessionForClass && (
            <button
              type="button"
              onClick={onResumeSavedClassSession}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Tiếp tục phiên đã lưu ({currentClassName})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <input
            type="text"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            placeholder="Tên gói (VD: Toán 8 · Luyện tập trạm)"
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-[#1769F4] focus:outline-none"
          />
          <input
            type="text"
            value={packageDesc}
            onChange={(e) => setPackageDesc(e.target.value)}
            placeholder="Ghi chú ngắn cho tiết dạy..."
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-[#1769F4] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveCurrentAsPackage}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-sm font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Lưu cấu hình hiện tại thành gói</span>
          </button>
        </div>

        {questionSets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label className="block font-bold text-slate-600">
                Đính kèm bộ câu hỏi ôn tập (tùy chọn):
              </label>
              <select
                value={attachSetId}
                onChange={(e) => setAttachSetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              >
                <option value="">Không đính kèm bộ câu hỏi</option>
                {questionSets.map((qs) => (
                  <option key={qs.id} value={qs.id}>
                    {qs.title} ({qs.questions.length} câu)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-600">Trò chơi mặc định:</label>
              <select
                value={attachGameMode}
                onChange={(e) =>
                  setAttachGameMode(e.target.value as 'puzzle' | 'race' | 'golden_bell')
                }
                disabled={!attachSetId}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 disabled:opacity-50"
              >
                <option value="puzzle">Mở mảnh ghép</option>
                <option value="race">Đường đua</option>
                <option value="golden_bell">Rung chuông vàng</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-1">
                <label className="block font-bold text-slate-600">Giây/câu:</label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  disabled={!attachSetId}
                  value={attachSeconds}
                  onChange={(e) => setAttachSeconds(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-bold disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-600">Điểm/câu:</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  disabled={!attachSetId}
                  value={attachPoints}
                  onChange={(e) => setAttachPoints(Math.max(1, Number(e.target.value)))}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-bold disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {statusMsg && (
          <div
            role={statusMsg.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2 p-3 rounded-lg border text-xs sm:text-sm font-semibold ${
              statusMsg.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {statusMsg.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>

      {/* Saved Packages List */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <h4 className="text-base font-bold text-[#0F2D52]">
          Danh sách gói đã lưu ({savedPackages.length})
        </h4>

        {savedPackages.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
            <FolderOpen className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Chưa có gói tiết dạy nào được lưu
            </p>
            <p className="text-xs text-slate-500">
              Lưu cấu hình hiện tại hoặc nhập từ tệp JSON bên dưới.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedPackages.map((pkg) => (
              <div
                key={pkg.packageId}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-base font-bold text-[#0F2D52] truncate">
                      {pkg.name}
                    </h5>
                    <button
                      type="button"
                      onClick={() => handleDeletePackage(pkg.packageId)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      aria-label={`Xóa gói ${pkg.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">{pkg.description}</p>
                  <div className="text-xs text-slate-500 pt-1">
                    {pkg.config.groupCount} nhóm ·{' '}
                    {ACTIVITY_MODE_META[pkg.config.activityMode].label} (
                    {pkg.config.activityRoundDurationSeconds}s/vòng) · Đồng hồ{' '}
                    {pkg.config.timerMinutes}p{pkg.config.timerSeconds}s ·{' '}
                    {pkg.config.scoreboardTeamCount} đội
                    {pkg.config.embeddedQuestionSet
                      ? ` · Kèm bộ câu hỏi (${pkg.config.embeddedQuestionSet.questions.length} câu)`
                      : pkg.config.questionSetId
                        ? ' · Kèm tham chiếu bộ câu hỏi'
                        : ''}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyPackageFresh(pkg);
                      setStatusMsg({
                        type: 'success',
                        text: `Đã áp dụng "${pkg.name}" cho tiết mới tại ${currentClassName} (điểm & tiến độ đã đặt lại).`,
                      });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-bold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Dùng cho tiết mới</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPreviewPkg(
                        previewPkg?.packageId === pkg.packageId ? null : pkg
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem trước</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicatePackage(pkg)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportJsonFile(pkg)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCopyJson(pkg)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <span>Chép JSON</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {previewPkg && (
          <div className="mt-3 p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 text-xs sm:text-sm">
            <div className="font-bold text-[#0F2D52]">
              Xem trước cấu hình: {previewPkg.name}
            </div>
            <ul className="space-y-1 text-slate-700 list-disc pl-5">
              <li>
                Chia nhóm: {previewPkg.config.groupSplitMode === 'by_group_count' ? `Theo ${previewPkg.config.groupCount} nhóm` : `Tối đa ${previewPkg.config.maxPerGroup} HS/nhóm`}
              </li>
              <li>
                Sơ đồ lớp: {previewPkg.config.seatingRows} hàng × {previewPkg.config.seatingCols} ghế (khóa trống {previewPkg.config.blockedSeatKeys.length} ghế)
              </li>
              <li>
                Hoạt động nhóm: {ACTIVITY_MODE_META[previewPkg.config.activityMode].label} ({previewPkg.config.activityStations.length} trạm, {previewPkg.config.activityRoundDurationSeconds}s/vòng)
              </li>
              <li>
                Đồng hồ: {previewPkg.config.timerMode === 'countdown' ? `${previewPkg.config.timerMinutes}p${previewPkg.config.timerSeconds}s` : 'Bấm giờ'} · Chuông: {previewPkg.config.timerBellEnabled ? 'Bật' : 'Tắt'}
              </li>
              <li>
                Bảng điểm: {previewPkg.config.scoreboardTeamCount} đội ({previewPkg.config.scoreboardTeamNames.join(', ')})
              </li>
              {(previewPkg.config.embeddedQuestionSet || previewPkg.config.questionSetId) && (
                <li>
                  Bộ câu hỏi &amp; Trò chơi ôn tập:{' '}
                  {previewPkg.config.embeddedQuestionSet?.title || previewPkg.config.questionSetId}{' '}
                  · Chế độ{' '}
                  {previewPkg.config.reviewGameMode === 'race'
                    ? 'Đường đua'
                    : previewPkg.config.reviewGameMode === 'golden_bell'
                      ? 'Rung chuông vàng'
                      : 'Mở mảnh ghép'}{' '}
                  ({previewPkg.config.reviewRoundSeconds ?? 30}s/câu · +{previewPkg.config.reviewPointsPerCorrect ?? 10}đ)
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* JSON Import Area */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-bold text-[#0F2D52]">
              Nhập Gói tiết dạy từ tệp JSON
            </h4>
            <p className="text-xs text-slate-500">
              Hệ thống kiểm tra định dạng trước khi nạp; tệp lỗi sẽ báo rõ và không ghi đè gói đã lưu.
            </p>
          </div>
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Chọn tệp .json</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          rows={3}
          value={importJsonText}
          onChange={(e) => setImportJsonText(e.target.value)}
          placeholder="Hoặc dán trực tiếp nội dung JSON gói tiết dạy vào đây..."
          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs text-slate-800 focus:border-[#1769F4] focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!importJsonText.trim()}
            onClick={() => handleImportJson(importJsonText)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs sm:text-sm font-bold cursor-pointer disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            <span>Kiểm tra &amp; Nhập JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
