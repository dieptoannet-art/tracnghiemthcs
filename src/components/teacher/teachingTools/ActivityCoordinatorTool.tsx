import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Monitor,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  ACTIVITY_MODE_META,
  ActivityMode,
  ActivityState,
  StudentGroupItem,
  advanceActivityRound,
  computeActivityRemainingMs,
  createDefaultActivityState,
  formatTimerClock,
  pauseActivityRun,
  previewActivitySchedule,
  resumeActivityRun,
  startActivityRun,
  validateActivityCapacity,
} from './teachingToolsEngine';
import { playTeachingToolBell } from './teachingToolsAudio';

interface ActivityCoordinatorToolProps {
  groups: StudentGroupItem[];
  activityState: ActivityState;
  isMutedGlobal: boolean;
  onChangeActivityState: (next: ActivityState) => void;
  onGoToGroups: () => void;
}

export const ActivityCoordinatorTool: React.FC<ActivityCoordinatorToolProps> = ({
  groups,
  activityState,
  isMutedGlobal,
  onChangeActivityState,
  onGoToGroups,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    computeActivityRemainingMs(activityState)
  );
  const [projectorOpen, setProjectorOpen] = useState<boolean>(false);
  const bellFiredRoundRef = useRef<number | null>(null);
  const stateRef = useRef(activityState);
  stateRef.current = activityState;

  useEffect(() => {
    const sync = () => {
      const rem = computeActivityRemainingMs(stateRef.current, Date.now());
      setRemainingMs(rem);
      if (
        stateRef.current.status === 'running' &&
        rem === 0 &&
        bellFiredRoundRef.current !== stateRef.current.currentRound
      ) {
        bellFiredRoundRef.current = stateRef.current.currentRound;
        playTeachingToolBell(isMutedGlobal);
      }
    };
    sync();
    if (activityState.status !== 'running') return;
    const id = window.setInterval(sync, 250);
    return () => window.clearInterval(id);
  }, [activityState.status, activityState.currentRound, activityState.roundTargetEndAtMs, isMutedGlobal]);

  const capacityCheck = useMemo(
    () => validateActivityCapacity(activityState, groups),
    [activityState, groups]
  );

  const schedule = useMemo(
    () => previewActivitySchedule(activityState, groups),
    [activityState, groups]
  );

  const currentRoundPlan = useMemo(
    () =>
      schedule.find((r) => r.roundNumber === activityState.currentRound) ||
      schedule[0] ||
      null,
    [schedule, activityState.currentRound]
  );

  const handleModeChange = (mode: ActivityMode) => {
    bellFiredRoundRef.current = null;
    onChangeActivityState(createDefaultActivityState(mode));
  };

  const handleAddStation = () => {
    const nextIdx = activityState.stations.length + 1;
    const nextStations = [
      ...activityState.stations,
      {
        id: `st_${Date.now().toString(36)}`,
        title: `Trạm ${nextIdx}`,
        task: `Nhiệm vụ thảo luận tại trạm ${nextIdx}`,
        capacity: 2,
      },
    ];
    onChangeActivityState({
      ...activityState,
      stations: nextStations,
      totalRounds: nextStations.length,
      lastError: '',
    });
  };

  const handleRemoveStation = (id: string) => {
    if (activityState.stations.length <= 1) return;
    const nextStations = activityState.stations.filter((s) => s.id !== id);
    onChangeActivityState({
      ...activityState,
      stations: nextStations,
      totalRounds: nextStations.length,
      currentRound: Math.min(activityState.currentRound, nextStations.length),
      lastError: '',
    });
  };

  return (
    <div className="space-y-5 font-edtech">
      {/* Mode Selection & Top Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#0F2D52]">
              Điều phối hoạt động nhóm
            </h3>
            <p className="text-sm text-slate-600">
              {groups.length > 0
                ? `Đang dùng ${groups.length} nhóm từ công cụ Chia nhóm học sinh`
                : 'Chưa có nhóm học sinh — nhấn Chọn / Chia nhóm để đồng bộ'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {groups.length === 0 && (
              <button
                type="button"
                onClick={onGoToGroups}
                className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs sm:text-sm font-bold cursor-pointer"
              >
                Chia nhóm ngay
              </button>
            )}

            <button
              type="button"
              onClick={() => setProjectorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <Monitor className="w-4 h-4" />
              <span>Màn chiếu hoạt động</span>
            </button>
          </div>
        </div>

        {/* 4 Activity Method Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {(Object.keys(ACTIVITY_MODE_META) as ActivityMode[]).map((modeKey) => {
            const meta = ACTIVITY_MODE_META[modeKey];
            const active = activityState.mode === modeKey;
            return (
              <button
                key={modeKey}
                type="button"
                onClick={() => handleModeChange(modeKey)}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50 border-[#1769F4] text-[#0F2D52]'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-sm font-bold">{meta.label}</div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                  {meta.shortDesc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Duration, Multi-Turn Split & Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div className="space-y-2">
            <label htmlFor="act-round-dur" className="block text-xs font-semibold text-slate-600">
              Thời lượng mỗi vòng (giây)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="act-round-dur"
                type="number"
                min={10}
                max={3600}
                value={activityState.roundDurationSeconds}
                onChange={(e) => {
                  const sec = Math.max(10, Math.min(3600, Number(e.target.value) || 60));
                  onChangeActivityState({
                    ...activityState,
                    roundDurationSeconds: sec,
                    remainingMsWhenPaused:
                      activityState.status === 'idle'
                        ? sec * 1000
                        : activityState.remainingMsWhenPaused,
                  });
                }}
                className="w-28 px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-900 tabular-nums"
              />
              <span className="text-xs text-slate-500">
                ({Math.floor(activityState.roundDurationSeconds / 60)}p{' '}
                {activityState.roundDurationSeconds % 60}s)
              </span>
            </div>

            <label className="flex items-center gap-2 pt-1 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={activityState.splitMultiTurn}
                onChange={(e) =>
                  onChangeActivityState({
                    ...activityState,
                    splitMultiTurn: e.target.checked,
                    lastError: '',
                  })
                }
                className="accent-[#1769F4]"
              />
              <span>
                Chia nhiều lượt nếu số nhóm vượt tổng sức chứa ({capacityCheck.totalCapacity})
              </span>
            </label>
          </div>

          <div className="lg:col-span-2 space-y-1.5">
            <label htmlFor="act-guide" className="block text-xs font-semibold text-slate-600">
              Hướng dẫn thực hiện trên lớp
            </label>
            <textarea
              id="act-guide"
              rows={2}
              value={activityState.instructions}
              onChange={(e) =>
                onChangeActivityState({
                  ...activityState,
                  instructions: e.target.value,
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:border-[#1769F4] focus:outline-none"
            />
          </div>
        </div>

        {/* Live Runner Controls */}
        <div className="p-4 rounded-xl bg-[#08132B] text-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-slate-300">
                {ACTIVITY_MODE_META[activityState.mode].label} · Vòng{' '}
                {activityState.currentRound}/{activityState.totalRounds}
              </div>
              <div className="text-3xl sm:text-4xl font-mono font-extrabold tabular-nums text-amber-300">
                {formatTimerClock(remainingMs)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activityState.status === 'idle' || activityState.status === 'completed' ? (
              <button
                type="button"
                onClick={() => {
                  bellFiredRoundRef.current = null;
                  onChangeActivityState(startActivityRun(activityState, groups));
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-sm font-bold cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Bắt đầu hoạt động</span>
              </button>
            ) : activityState.status === 'running' ? (
              <button
                type="button"
                onClick={() => onChangeActivityState(pauseActivityRun(activityState))}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-bold cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>Tạm dừng</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onChangeActivityState(resumeActivityRun(activityState))}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Tiếp tục</span>
              </button>
            )}

            <button
              type="button"
              disabled={activityState.currentRound <= 1}
              onClick={() => onChangeActivityState(advanceActivityRound(activityState, -1))}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Vòng trước</span>
            </button>

            <button
              type="button"
              onClick={() => {
                bellFiredRoundRef.current = null;
                onChangeActivityState(advanceActivityRound(activityState, 1));
              }}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
            >
              <span>Chuyển vòng</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                bellFiredRoundRef.current = null;
                onChangeActivityState({
                  ...activityState,
                  status: 'idle',
                  currentRound: 1,
                  roundTargetEndAtMs: null,
                  remainingMsWhenPaused: activityState.roundDurationSeconds * 1000,
                });
              }}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Đặt lại</span>
            </button>
          </div>
        </div>

        {/* Capacity Error Notice */}
        {(activityState.lastError || !capacityCheck.ok) && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm font-semibold"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{activityState.lastError || capacityCheck.error}</span>
          </div>
        )}
      </div>

      {/* Stations / Tasks Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-base font-bold text-[#0F2D52]">
            Danh sách trạm &amp; nhiệm vụ ({activityState.stations.length} trạm · Tổng sức chứa:{' '}
            {capacityCheck.totalCapacity} nhóm)
          </h4>
          <button
            type="button"
            onClick={handleAddStation}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm trạm</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activityState.stations.map((st, idx) => (
            <div
              key={st.id}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={st.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChangeActivityState({
                      ...activityState,
                      stations: activityState.stations.map((item, i) =>
                        i === idx ? { ...item, title: val } : item
                      ),
                    });
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-[#0F2D52]"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="text-[11px] text-slate-600">Sức chứa:</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={st.capacity}
                    onChange={(e) => {
                      const cap = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                      onChangeActivityState({
                        ...activityState,
                        stations: activityState.stations.map((item, i) =>
                          i === idx ? { ...item, capacity: cap } : item
                        ),
                        lastError: '',
                      });
                    }}
                    className="w-14 px-2 py-1 rounded border border-slate-300 text-xs font-bold text-slate-900 tabular-nums"
                  />
                  {activityState.stations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStation(st.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      aria-label="Xóa trạm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={2}
                value={st.task}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeActivityState({
                    ...activityState,
                    stations: activityState.stations.map((item, i) =>
                      i === idx ? { ...item, task: val } : item
                    ),
                  });
                }}
                placeholder="Nhập nhiệm vụ cho trạm này..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs sm:text-sm text-slate-700"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Preview Schedule Across Rounds */}
      {schedule.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <h4 className="text-base font-bold text-[#0F2D52]">
            Xem trước lượt hoạt động ({schedule.length} vòng · {groups.length} nhóm)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-bold">Nhóm</th>
                  {schedule.map((r) => (
                    <th key={r.roundNumber} className="px-3 py-2 font-bold">
                      Vòng {r.roundNumber}
                      {r.roundNumber === activityState.currentRound ? ' (Hiện tại)' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.map((grp) => (
                  <tr key={grp.id}>
                    <td className="px-3 py-2.5 font-bold text-[#0F2D52] whitespace-nowrap">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-xs mr-2"
                        style={{ backgroundColor: grp.color }}
                      />
                      {grp.name}
                    </td>
                    {schedule.map((r) => {
                      const item = r.assignments.find((a) => a.groupId === grp.id);
                      const isCur = r.roundNumber === activityState.currentRound;
                      return (
                        <td
                          key={r.roundNumber}
                          className={`px-3 py-2.5 ${isCur ? 'bg-blue-50/70 font-semibold text-[#0F2D52]' : 'text-slate-600'}`}
                        >
                          {item ? (
                            <div>
                              <div>{item.stationTitle}</div>
                              {item.turnNumber > 1 && (
                                <div className="text-[11px] text-amber-700">
                                  Lượt {item.turnNumber}
                                </div>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fullscreen Projector Modal */}
      {projectorOpen && (
        <div className="fixed inset-0 z-50 bg-[#071126] text-white p-5 sm:p-8 overflow-y-auto flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/15">
            <div>
              <div className="text-sm font-bold text-amber-300">
                {ACTIVITY_MODE_META[activityState.mode].label} · VÒNG {activityState.currentRound}/
                {activityState.totalRounds}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                Phân công nhiệm vụ các nhóm
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-4xl sm:text-6xl font-mono font-extrabold text-amber-300 tabular-nums">
                {formatTimerClock(remainingMs)}
              </div>
              <button
                type="button"
                onClick={() => setProjectorOpen(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Đóng</span>
              </button>
            </div>
          </div>

          <p className="text-base sm:text-lg text-slate-200 leading-relaxed bg-white/5 border border-white/10 rounded-xl p-4">
            {activityState.instructions}
          </p>

          {currentRoundPlan ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 content-start">
              {currentRoundPlan.assignments.map((item) => (
                <div
                  key={item.groupId}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-white/15 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl font-extrabold text-white flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-sm shrink-0"
                        style={{ backgroundColor: item.groupColor }}
                      />
                      {item.groupName}
                    </span>
                    {item.turnNumber > 1 && (
                      <span className="text-xs font-bold text-amber-300">
                        Lượt {item.turnNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-base font-bold text-sky-300">
                    {item.stationTitle}
                  </div>
                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                    {item.task}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-300 text-lg">
              Chưa có nhóm hoặc trạm hoạt động nào được cấu hình.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
