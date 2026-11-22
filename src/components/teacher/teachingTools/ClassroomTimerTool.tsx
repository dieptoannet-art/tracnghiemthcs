import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  ClassroomTimerMode,
  ClassroomTimerState,
  formatTimerClock,
  pauseClassroomTimer,
  resetClassroomTimer,
  startClassroomTimer,
  tickTimerSnapshot,
} from './teachingToolsEngine';
import { playTeachingToolBell } from './teachingToolsAudio';

interface ClassroomTimerToolProps {
  timerState: ClassroomTimerState;
  isMutedGlobal: boolean;
  onChangeTimerState: (next: ClassroomTimerState) => void;
}

export const ClassroomTimerTool: React.FC<ClassroomTimerToolProps> = ({
  timerState,
  isMutedGlobal,
  onChangeTimerState,
}) => {
  const [displayMs, setDisplayMs] = useState<number>(
    () => tickTimerSnapshot(timerState).displayMs
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const timerRef = useRef(timerState);
  timerRef.current = timerState;

  useEffect(() => {
    const sync = () => {
      const snap = tickTimerSnapshot(timerRef.current, Date.now());
      setDisplayMs(snap.displayMs);
      if (snap.shouldRingBell) {
        playTeachingToolBell(isMutedGlobal);
      }
      if (snap.nextState !== timerRef.current) {
        onChangeTimerState(snap.nextState);
      }
    };

    sync();
    if (timerState.status !== 'running') return;
    const id = window.setInterval(sync, 200);
    return () => window.clearInterval(id);
  }, [timerState.status, timerState.mode, timerState.targetEndAtMs, timerState.stopwatchStartedAtMs, isMutedGlobal, onChangeTimerState]);

  const setPreset = (minutes: number, seconds = 0) => {
    const next: ClassroomTimerState = {
      ...timerState,
      mode: 'countdown',
      configuredMinutes: minutes,
      configuredSeconds: seconds,
      status: 'idle',
      targetEndAtMs: null,
      remainingMsWhenPaused: (minutes * 60 + seconds) * 1000,
      bellFiredForRun: false,
    };
    onChangeTimerState(next);
    setDisplayMs((minutes * 60 + seconds) * 1000);
  };

  const handleModeSwitch = (mode: ClassroomTimerMode) => {
    onChangeTimerState(
      resetClassroomTimer({
        ...timerState,
        mode,
      })
    );
  };

  const isRunning = timerState.status === 'running';
  const isFinished = timerState.mode === 'countdown' && timerState.status === 'finished';

  const clockCard = (
    <div
      className={`rounded-2xl border p-6 sm:p-10 flex flex-col items-center justify-center gap-6 text-center transition-colors ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#08132B] text-white border-0 rounded-none'
          : isFinished
            ? 'bg-amber-50 border-amber-400 text-[#0F2D52]'
            : 'bg-[#08132B] border-slate-800 text-white'
      }`}
    >
      <div className="w-full max-w-2xl flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-semibold text-slate-300">
          {timerState.mode === 'countdown' ? 'ĐỒNG HỒ ĐẾM NGƯỢC' : 'ĐỒNG HỒ BẤM GIỜ'}
          {isFinished ? ' · HẾT GIỜ!' : ''}
        </span>

        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
            isFinished && !isFullscreen
              ? 'bg-[#0F2D52] text-white'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-4 h-4" />
              <span>Thu nhỏ</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              <span>Toàn màn hình</span>
            </>
          )}
        </button>
      </div>

      <div
        className={`font-mono font-extrabold tabular-nums tracking-tight select-none ${
          isFullscreen
            ? 'text-7xl sm:text-9xl'
            : 'text-6xl sm:text-8xl'
        } ${isFinished ? 'text-amber-500' : ''}`}
      >
        {formatTimerClock(displayMs)}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {isRunning ? (
          <button
            type="button"
            onClick={() => onChangeTimerState(pauseClassroomTimer(timerState))}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm sm:text-base cursor-pointer"
          >
            <Pause className="w-5 h-5" />
            <span>Tạm dừng</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChangeTimerState(startClassroomTimer(timerState))}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white font-extrabold text-sm sm:text-base cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{timerState.status === 'paused' ? 'Tiếp tục' : 'Bắt đầu'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            const r = resetClassroomTimer(timerState);
            onChangeTimerState(r);
            setDisplayMs(tickTimerSnapshot(r).displayMs);
          }}
          className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm cursor-pointer ${
            isFinished && !isFullscreen
              ? 'bg-slate-200 hover:bg-slate-300 text-slate-900'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Đặt lại</span>
        </button>

        {timerState.mode === 'countdown' && (
          <button
            type="button"
            onClick={() =>
              onChangeTimerState({
                ...timerState,
                bellEnabled: !timerState.bellEnabled,
              })
            }
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm cursor-pointer ${
              timerState.bellEnabled
                ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {timerState.bellEnabled ? (
              <>
                <Bell className="w-4 h-4" />
                <span>Chuông: Bật</span>
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4" />
                <span>Chuông: Tắt</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 font-edtech">
      {!isFullscreen && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#0F2D52]">
                Đồng hồ lớp học
              </h3>
              <p className="text-sm text-slate-600">
                Đếm ngược chính xác theo mốc thời gian thực, chuông báo phát một lần khi hết giờ.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'countdown', label: 'Đếm ngược' },
                  { id: 'stopwatch', label: 'Bấm giờ' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeSwitch(m.id)}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold cursor-pointer ${
                    timerState.mode === m.id
                      ? 'bg-white text-[#0F2D52] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {timerState.mode === 'countdown' && (
            <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <label htmlFor="timer-min" className="block text-xs font-semibold text-slate-600">
                    Phút
                  </label>
                  <input
                    id="timer-min"
                    type="number"
                    min={0}
                    max={180}
                    disabled={isRunning}
                    value={timerState.configuredMinutes}
                    onChange={(e) => {
                      const mins = Math.max(0, Math.min(180, Number(e.target.value) || 0));
                      setPreset(mins, timerState.configuredSeconds);
                    }}
                    className="w-20 px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-900 tabular-nums disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="timer-sec" className="block text-xs font-semibold text-slate-600">
                    Giây
                  </label>
                  <input
                    id="timer-sec"
                    type="number"
                    min={0}
                    max={59}
                    disabled={isRunning}
                    value={timerState.configuredSeconds}
                    onChange={(e) => {
                      const secs = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                      setPreset(timerState.configuredMinutes, secs);
                    }}
                    className="w-20 px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-900 tabular-nums disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 2, 3, 5, 10, 15].map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setPreset(m, 0)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    {m} phút
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {clockCard}
    </div>
  );
};
