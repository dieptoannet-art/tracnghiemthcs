import React, { useMemo, useState } from 'react';
import {
  Dices,
  History,
  Maximize2,
  Plus,
  RotateCcw,
  Shuffle,
  Timer,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ToolStudentItem } from './teachingToolsEngine';
import {
  DEFAULT_CHALLENGES,
  OddStudentHandling,
  QuickActivitySessionState,
  drawRandomChallenge,
  generateStudentPairs,
} from './quickActivitiesEngine';

interface QuickActivitiesToolProps {
  classNameLabel: string;
  presentStudents: ToolStudentItem[];
  quickState: QuickActivitySessionState;
  onChangeQuickState: (next: QuickActivitySessionState) => void;
  onOpenClassroomTimer: () => void;
}

export const QuickActivitiesTool: React.FC<QuickActivitiesToolProps> = ({
  classNameLabel,
  presentStudents,
  quickState,
  onChangeQuickState,
  onOpenClassroomTimer,
}) => {
  const [newChallengeText, setNewChallengeText] = useState<string>('');
  const [challengeError, setChallengeError] = useState<string>('');
  const [projectorMode, setProjectorMode] = useState<'none' | 'pairs' | 'challenge'>('none');

  const duplicateNamesSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of presentStudents) {
      counts.set(s.fullName, (counts.get(s.fullName) || 0) + 1);
    }
    const out = new Set<string>();
    for (const [name, cnt] of counts.entries()) {
      if (cnt > 1) out.add(name);
    }
    return out;
  }, [presentStudents]);

  const handleGeneratePairs = () => {
    const outcome = generateStudentPairs({
      presentStudents,
      oddHandling: quickState.oddHandling,
      soloTaskPrompt: quickState.soloTaskPrompt,
    });
    onChangeQuickState({
      ...quickState,
      latestPairs: outcome,
    });
  };

  const handleDrawChallenge = () => {
    const res = drawRandomChallenge(quickState);
    if (!res.ok) {
      setChallengeError(res.error || 'Không thể bốc thử thách.');
      return;
    }
    setChallengeError('');
    onChangeQuickState(res.nextState);
  };

  const handleAddChallenge = () => {
    const txt = newChallengeText.trim();
    if (!txt) return;
    onChangeQuickState({
      ...quickState,
      challenges: [
        ...quickState.challenges,
        { id: `ch_${Date.now().toString(36)}`, text: txt },
      ],
    });
    setNewChallengeText('');
  };

  const handleResetDrawnHistory = () => {
    setChallengeError('');
    onChangeQuickState({
      ...quickState,
      drawnChallengeIds: [],
      drawHistory: [],
      currentChallenge: null,
    });
  };

  return (
    <div className="space-y-5 font-edtech">
      {/* Shared Quick Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#082B52]">
            Hoạt động nhanh trên lớp
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {classNameLabel} · {presentStudents.length} học sinh có mặt · Sẵn sàng trình chiếu chữ lớn
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenClassroomTimer}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#082B52] hover:bg-[#0E3D73] text-white text-xs sm:text-sm font-bold cursor-pointer"
        >
          <Timer className="w-4 h-4" />
          <span>Mở Đồng hồ lớp học</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SECTION 1: GHÉP CẶP */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#082B52] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1769F4]" />
                <span>Ghép cặp học sinh</span>
              </h3>
              <p className="text-xs text-slate-600">
                Lấy danh sách học sinh có mặt của lớp hiện tại.
              </p>
            </div>
            {quickState.latestPairs && (
              <button
                type="button"
                onClick={() => setProjectorMode('pairs')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F2D52] text-xs font-bold cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Chiếu bảng cặp</span>
              </button>
            )}
          </div>

          {presentStudents.length >= 3 && presentStudents.length % 2 === 1 && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
              <p className="text-xs font-bold text-[#082B52]">
                Sĩ số có mặt hiện là số lẻ ({presentStudents.length} em) — chọn cách xử lý em dư:
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['form_one_trio', 'Tạo một nhóm ba'],
                    ['one_solo_task', 'Giao nhiệm vụ cá nhân cho 1 em'],
                  ] as [OddStudentHandling, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChangeQuickState({ ...quickState, oddHandling: key })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                      quickState.oddHandling === key
                        ? 'bg-[#1769F4] text-white border-[#1769F4]'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {quickState.oddHandling === 'one_solo_task' && (
                <input
                  type="text"
                  value={quickState.soloTaskPrompt}
                  onChange={(e) =>
                    onChangeQuickState({ ...quickState, soloTaskPrompt: e.target.value })
                  }
                  placeholder="Nội dung nhiệm vụ cá nhân..."
                  className="w-full px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-xs"
                />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleGeneratePairs}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-sm font-bold cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            <span>Ghép cặp ngẫu nhiên ngay ({presentStudents.length} HS có mặt)</span>
          </button>

          {quickState.latestPairs && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-emerald-800">
                {quickState.latestPairs.message}
              </p>

              {quickState.latestPairs.mode === 'single_individual' &&
                quickState.latestPairs.soloStudent && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                    <p className="text-sm font-extrabold text-[#082B52]">
                      {quickState.latestPairs.soloStudent.fullName}
                    </p>
                    <p className="text-xs text-amber-950">
                      {quickState.latestPairs.soloTaskPrompt}
                    </p>
                  </div>
                )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {quickState.latestPairs.pairs.map((pair) => (
                  <div
                    key={pair.id}
                    className={`p-3 rounded-xl border ${
                      pair.isTrio
                        ? 'bg-indigo-50/70 border-indigo-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <p className="text-xs font-extrabold text-[#1769F4] mb-1">
                      {pair.label}
                    </p>
                    <ul className="space-y-0.5 text-xs sm:text-sm font-semibold text-[#082B52]">
                      {pair.members.map((m) => (
                        <li key={m.id}>
                          • {m.fullName}
                          {duplicateNamesSet.has(m.fullName) ? ` (${m.code})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {quickState.latestPairs.mode === 'paired' &&
                quickState.latestPairs.soloStudent && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                    <span className="font-extrabold text-[#082B52]">
                      Nhiệm vụ cá nhân ({quickState.latestPairs.soloStudent.fullName}):{' '}
                    </span>
                    <span>{quickState.latestPairs.soloTaskPrompt}</span>
                  </div>
                )}
            </div>
          )}
        </section>

        {/* SECTION 2: BỐC THỬ THÁCH */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#082B52] flex items-center gap-2">
                <Dices className="w-5 h-5 text-amber-600" />
                <span>Bốc thử thách ngẫu nhiên</span>
              </h3>
              <p className="text-xs text-slate-600">
                Nhập danh sách nhiệm vụ, bốc ngẫu nhiên kèm tùy chọn tránh lặp.
              </p>
            </div>
            {quickState.currentChallenge && (
              <button
                type="button"
                onClick={() => setProjectorMode('challenge')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F2D52] text-xs font-bold cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Chiếu chữ lớn</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={quickState.noRepeatInSession}
                onChange={(e) =>
                  onChangeQuickState({
                    ...quickState,
                    noRepeatInSession: e.target.checked,
                  })
                }
                className="rounded border-slate-300"
              />
              <span>Tránh lặp thử thách đã bốc trong phiên</span>
            </label>
            <button
              type="button"
              onClick={handleResetDrawnHistory}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-[#1769F4] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại lượt bốc ({quickState.drawnChallengeIds.length}/{quickState.challenges.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDrawChallenge}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0F2D52] text-sm font-extrabold cursor-pointer"
          >
            <Dices className="w-4 h-4" />
            <span>Bốc 1 thử thách ngay</span>
          </button>

          {challengeError && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
              {challengeError}
            </p>
          )}

          {quickState.currentChallenge && (
            <div className="p-4 rounded-xl bg-[#082B52] text-white space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Thử thách vừa rút
              </span>
              <p className="text-base sm:text-lg font-extrabold leading-snug">
                {quickState.currentChallenge.text}
              </p>
            </div>
          )}

          {/* Manage Challenge List */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newChallengeText}
              onChange={(e) => setNewChallengeText(e.target.value)}
              placeholder="Thêm thử thách mới..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
            />
            <button
              type="button"
              onClick={handleAddChallenge}
              className="px-3.5 py-2 rounded-xl bg-[#082B52] text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {quickState.challenges.map((ch, idx) => (
              <div
                key={ch.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <span className="text-slate-800 font-medium">
                  {idx + 1}. {ch.text}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeQuickState({
                      ...quickState,
                      challenges: quickState.challenges.filter((c) => c.id !== ch.id),
                    })
                  }
                  className="text-rose-500 hover:text-rose-700 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {quickState.drawHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <History className="w-3.5 h-3.5" />
                  Lịch sử đã bốc ({quickState.drawHistory.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeQuickState({
                      ...quickState,
                      challenges: DEFAULT_CHALLENGES.map((d) => ({ ...d })),
                    })
                  }
                  className="text-[#1769F4] hover:underline cursor-pointer"
                >
                  Khôi phục mẫu mặc định
                </button>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 max-h-24 overflow-y-auto">
                {quickState.drawHistory.map((h, i) => (
                  <li key={h.drawId}>
                    {quickState.drawHistory.length - i}. {h.challengeText}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* PROJECTOR MODAL 16:9 */}
      {projectorMode !== 'none' && (
        <div className="fixed inset-0 z-50 bg-[#071A36] text-white flex flex-col p-6 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/15">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                {classNameLabel} · Màn chiếu Hoạt động nhanh
              </p>
              <h3 className="text-2xl font-extrabold">
                {projectorMode === 'pairs' ? 'Danh sách ghép cặp' : 'Thử thách ngẫu nhiên'}
              </h3>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setProjectorMode('none');
                  onOpenClassroomTimer();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 text-[#0F2D52] text-sm font-extrabold cursor-pointer"
              >
                <Timer className="w-4 h-4" />
                <span>Mở Đồng hồ lớp học</span>
              </button>
              <button
                type="button"
                onClick={() => setProjectorMode('none')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Đóng</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-8 flex items-center justify-center">
            {projectorMode === 'challenge' && quickState.currentChallenge && (
              <div className="max-w-4xl w-full text-center space-y-6">
                <p className="text-3xl sm:text-5xl font-extrabold leading-tight">
                  {quickState.currentChallenge.text}
                </p>
              </div>
            )}

            {projectorMode === 'pairs' && quickState.latestPairs && (
              <div className="max-w-6xl w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickState.latestPairs.pairs.map((pair) => (
                  <div
                    key={pair.id}
                    className="p-5 rounded-2xl bg-white/10 border border-white/20 space-y-2"
                  >
                    <p className="text-sm font-extrabold text-amber-300">{pair.label}</p>
                    <div className="space-y-1 text-xl font-bold">
                      {pair.members.map((m) => (
                        <p key={m.id}>{m.fullName}</p>
                      ))}
                    </div>
                  </div>
                ))}
                {quickState.latestPairs.soloStudent && (
                  <div className="p-5 rounded-2xl bg-amber-400/20 border border-amber-300/40 space-y-2">
                    <p className="text-sm font-extrabold text-amber-300">Nhiệm vụ cá nhân</p>
                    <p className="text-xl font-bold">{quickState.latestPairs.soloStudent.fullName}</p>
                    <p className="text-sm text-amber-100">{quickState.latestPairs.soloTaskPrompt}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
