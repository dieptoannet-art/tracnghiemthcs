import React, { useState } from 'react';
import {
  AlertTriangle,
  Coins,
  Dices,
  Hash,
  RotateCcw,
} from 'lucide-react';
import {
  PickerUtilitiesState,
  drawPickerRandomNumber,
  flipPickerCoin,
  resetCoinStats,
  resetNumberDrawState,
  rollPickerDice,
} from './namePickerEngine';
import { playTeachingToolScoreCue } from './teachingToolsAudio';
import { Coin3DCanvas, Dice3DCanvas } from './NamePicker3DStage';

interface NamePickerUtilitiesBarProps {
  utilities: PickerUtilitiesState;
  reducedMotion: boolean;
  use3D?: boolean;
  isMutedGlobal: boolean;
  onChangeUtilities: (next: PickerUtilitiesState) => void;
}

const DIE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const DieCube: React.FC<{ value: number; rolling: boolean }> = ({ value, rolling }) => {
  const activePips = DIE_PIPS[value] || DIE_PIPS[1];
  return (
    <div
      className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-slate-100 border-2 border-[#0F3C78]/25 shadow-sm p-2 grid grid-cols-3 grid-rows-3 gap-1 place-items-center transition-transform duration-300 ${
        rolling ? 'rotate-12 scale-95' : 'rotate-0 scale-100'
      }`}
      aria-label={`Xúc xắc mặt ${value}`}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <span
          key={idx}
          className={`w-2.5 h-2.5 rounded-full ${
            activePips.includes(idx)
              ? value === 1 || value === 6
                ? 'bg-[#DC2626]'
                : 'bg-[#082B52]'
              : 'bg-transparent'
          }`}
        />
      ))}
    </div>
  );
};

export const NamePickerUtilitiesBar: React.FC<NamePickerUtilitiesBarProps> = ({
  utilities,
  reducedMotion,
  use3D = false,
  isMutedGlobal,
  onChangeUtilities,
}) => {
  const [diceRolling, setDiceRolling] = useState<boolean>(false);
  const [coinFlipping, setCoinFlipping] = useState<boolean>(false);
  const [fromInput, setFromInput] = useState<string>(String(utilities.numberFrom));
  const [toInput, setToInput] = useState<string>(String(utilities.numberTo));

  const handleRollDice = () => {
    playTeachingToolScoreCue(isMutedGlobal, true);
    if (reducedMotion) {
      onChangeUtilities(rollPickerDice(utilities, utilities.diceCount));
      return;
    }
    setDiceRolling(true);
    window.setTimeout(() => {
      onChangeUtilities(rollPickerDice(utilities, utilities.diceCount));
      setDiceRolling(false);
    }, 260);
  };

  const handleFlipCoin = () => {
    playTeachingToolScoreCue(isMutedGlobal, true);
    if (reducedMotion) {
      onChangeUtilities(flipPickerCoin(utilities));
      return;
    }
    setCoinFlipping(true);
    window.setTimeout(() => {
      onChangeUtilities(flipPickerCoin(utilities));
      setCoinFlipping(false);
    }, 260);
  };

  const handleDrawNumber = () => {
    playTeachingToolScoreCue(isMutedGlobal, true);
    const parsedFrom = fromInput.trim() === '' ? NaN : Number(fromInput);
    const parsedTo = toInput.trim() === '' ? NaN : Number(toInput);
    onChangeUtilities(
      drawPickerRandomNumber({
        utilities,
        fromInput: parsedFrom,
        toInput: parsedTo,
        noRepeat: utilities.numberNoRepeat,
      })
    );
  };

  const rangeSpan =
    Number.isFinite(Number(fromInput)) &&
    Number.isFinite(Number(toInput)) &&
    Number(toInput) >= Number(fromInput)
      ? Math.trunc(Number(toInput)) - Math.trunc(Number(fromInput)) + 1
      : 0;

  return (
    <section
      aria-label="Ba tiện ích ngẫu nhiên"
      className="grid grid-cols-1 lg:grid-cols-3 gap-4 font-edtech"
    >
      {/* 1. TUNG XÚC XẮC */}
      <article className="bg-white rounded-2xl border border-[#DCE8F7] p-4 flex flex-col justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#082B52]">
              <Dices className="w-4 h-4 text-[#1769F4]" />
              <h3 className="text-sm font-extrabold">Tung xúc xắc</h3>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100">
              {([1, 2, 3] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onChangeUtilities({ ...utilities, diceCount: cnt })}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                    utilities.diceCount === cnt
                      ? 'bg-white text-[#082B52] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cnt} viên
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[84px] rounded-xl bg-[#F8FBFF] border border-[#DCE8F7] p-2.5 flex flex-wrap items-center justify-center gap-3">
            {use3D ? (
              <Dice3DCanvas
                values={utilities.lastDiceValues.slice(0, utilities.diceCount)}
                rolling={diceRolling && !reducedMotion}
              />
            ) : (
              utilities.lastDiceValues.slice(0, utilities.diceCount).map((val, idx) => (
                <DieCube key={idx} value={val} rolling={diceRolling} />
              ))
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>
              Mặt:{' '}
              <strong className="font-mono tabular-nums text-[#082B52]">
                {utilities.lastDiceSum !== null
                  ? utilities.lastDiceValues.join(' + ')
                  : 'Chưa tung'}
              </strong>
            </span>
            <span className="text-sm font-black font-mono tabular-nums text-[#1769F4]">
              Tổng: {utilities.lastDiceSum ?? '—'}
            </span>
          </div>

          {utilities.diceHistory.length > 0 && (
            <div className="text-[11px] text-slate-500 truncate">
              Gần đây:{' '}
              {utilities.diceHistory
                .slice(0, 4)
                .map((h) => `[${h.values.join(',')}=${h.sum}]`)
                .join(' · ')}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleRollDice}
          disabled={diceRolling}
          className="w-full py-2 px-4 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] disabled:opacity-60 text-white text-xs sm:text-sm font-bold cursor-pointer"
        >
          {diceRolling ? 'Đang tung...' : `Tung ${utilities.diceCount} xúc xắc`}
        </button>
      </article>

      {/* 2. TUNG ĐỒNG XU */}
      <article className="bg-white rounded-2xl border border-[#DCE8F7] p-4 flex flex-col justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#082B52]">
              <Coins className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-extrabold">Tung đồng xu</h3>
            </div>
            <button
              type="button"
              onClick={() => onChangeUtilities(resetCoinStats(utilities))}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#082B52] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại thống kê</span>
            </button>
          </div>

          <div className="min-h-[84px] rounded-xl bg-[#F8FBFF] border border-[#DCE8F7] p-3 flex items-center justify-center gap-4">
            {use3D ? (
              <Coin3DCanvas
                side={utilities.lastCoinSide}
                flipping={coinFlipping && !reducedMotion}
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-sm font-black shadow-sm transition-transform duration-300 ${
                  coinFlipping
                    ? 'scale-90 rotate-180 bg-amber-300 border-amber-500 text-[#082B52]'
                    : utilities.lastCoinSide === 'Ngửa'
                      ? 'bg-amber-400 border-amber-600 text-[#082B52]'
                      : utilities.lastCoinSide === 'Sấp'
                        ? 'bg-[#082B52] border-[#1769F4] text-white'
                        : 'bg-slate-200 border-slate-300 text-slate-600'
                }`}
              >
                {utilities.lastCoinSide || 'Xu'}
              </div>
            )}
            <div className="space-y-0.5 text-xs">
              <div className="font-extrabold text-[#082B52] text-sm">
                {utilities.lastCoinSide ? `Kết quả: ${utilities.lastCoinSide}` : 'Sẵn sàng tung'}
              </div>
              <div className="text-slate-600 font-semibold font-mono tabular-nums">
                Sấp: {utilities.coinTailsCount} · Ngửa: {utilities.coinHeadsCount} · Tổng:{' '}
                {utilities.coinTotalFlips}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFlipCoin}
          disabled={coinFlipping}
          className="w-full py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-[#082B52] text-xs sm:text-sm font-extrabold cursor-pointer"
        >
          {coinFlipping ? 'Đang tung...' : 'Tung đồng xu'}
        </button>
      </article>

      {/* 3. BỐC SỐ NGẪU NHIÊN */}
      <article className="bg-white rounded-2xl border border-[#DCE8F7] p-4 flex flex-col justify-between gap-3">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#082B52]">
              <Hash className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-extrabold">Bốc số ngẫu nhiên</h3>
            </div>
            <button
              type="button"
              onClick={() => onChangeUtilities(resetNumberDrawState(utilities))}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#082B52] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm mới</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-0.5">
              <label className="block font-bold text-slate-600">Từ số</label>
              <input
                type="number"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
              />
            </div>
            <div className="space-y-0.5">
              <label className="block font-bold text-slate-600">Đến số</label>
              <input
                type="number"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={utilities.numberNoRepeat}
                onChange={(e) =>
                  onChangeUtilities({
                    ...utilities,
                    numberNoRepeat: e.target.checked,
                    numberExhausted: false,
                  })
                }
              />
              <span>Không lặp lại</span>
            </label>
            <span className="text-[11px] font-semibold text-slate-500 font-mono tabular-nums">
              Khoảng {utilities.activeRangeFrom}–{utilities.activeRangeTo} · Đã bốc{' '}
              {utilities.drawnNumbers.length}
              {rangeSpan > 0 ? `/${rangeSpan}` : ''}
            </span>
          </div>

          {utilities.numberError && (
            <div
              role="alert"
              className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-800 flex items-start gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{utilities.numberError}</span>
            </div>
          )}

          <div className="rounded-xl bg-[#F8FBFF] border border-[#DCE8F7] px-3 py-2 flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-600">Kết quả:</span>
            <span className="text-2xl font-black font-mono tabular-nums text-[#082B52]">
              {utilities.lastDrawnNumber !== null ? utilities.lastDrawnNumber : '—'}
            </span>
          </div>

          {utilities.numberHistory.length > 0 && (
            <div className="text-[11px] text-slate-500 truncate font-mono">
              Đã bốc: {utilities.numberHistory.slice(0, 8).map((n) => n.value).join(', ')}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleDrawNumber}
          className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
        >
          {utilities.numberExhausted ? 'Bốc lại / Làm mới khoảng' : 'Bốc số'}
        </button>
      </article>
    </section>
  );
};
