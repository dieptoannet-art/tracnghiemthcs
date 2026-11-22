import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Eye,
  Monitor,
  Pin,
  PinOff,
  Printer,
  Shuffle,
  X,
} from 'lucide-react';
import {
  SeatingState,
  ToolStudentItem,
  assignSeatsRandomly,
  getAvailableSeatKeys,
  getOrientedSeatingGrid,
  swapSeats,
  toggleSeatBlocked,
  toggleSeatPinned,
  updateSeatingDimensions,
} from './teachingToolsEngine';

interface SeatingChartToolProps {
  classNameLabel: string;
  presentStudents: ToolStudentItem[];
  seatingState: SeatingState;
  onChangeSeatingState: (next: SeatingState) => void;
}

export const SeatingChartTool: React.FC<SeatingChartToolProps> = ({
  classNameLabel,
  presentStudents,
  seatingState,
  onChangeSeatingState,
}) => {
  const [editMode, setEditMode] = useState<'swap_pin' | 'block_empty'>('swap_pin');
  const [selectedSeatForSwap, setSelectedSeatForSwap] = useState<string | null>(null);
  const [projectorOpen, setProjectorOpen] = useState<boolean>(false);

  const studentById = useMemo(() => {
    const map = new Map<string, ToolStudentItem>();
    for (const s of presentStudents) map.set(s.id, s);
    return map;
  }, [presentStudents]);

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

  const availableSeats = useMemo(
    () => getAvailableSeatKeys(seatingState),
    [seatingState]
  );
  const orientedGrid = useMemo(
    () => getOrientedSeatingGrid(seatingState),
    [seatingState]
  );

  const handleAssignRandomly = () => {
    setSelectedSeatForSwap(null);
    const result = assignSeatsRandomly({
      seating: seatingState,
      presentStudents,
    });
    onChangeSeatingState(result.seating);
  };

  const handleSeatClick = (key: string, isBlocked: boolean) => {
    if (editMode === 'block_empty') {
      setSelectedSeatForSwap(null);
      onChangeSeatingState(toggleSeatBlocked(seatingState, key));
      return;
    }

    if (isBlocked) return;

    if (!selectedSeatForSwap) {
      setSelectedSeatForSwap(key);
      return;
    }

    if (selectedSeatForSwap === key) {
      setSelectedSeatForSwap(null);
      return;
    }

    onChangeSeatingState(swapSeats(seatingState, selectedSeatForSwap, key));
    setSelectedSeatForSwap(null);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const boardBanner = (
    <div className="w-full py-2 px-4 rounded-lg bg-[#0F2D52] text-white text-center text-xs sm:text-sm font-bold tracking-wide">
      BẢNG LỚP HỌC · BÀN GIÁO VIÊN
    </div>
  );

  const renderGridContent = (isProjector: boolean) => (
    <div className="space-y-3">
      {seatingState.orientation === 'front_board' && boardBanner}

      <div className="overflow-x-auto pb-1">
        <div
          className="grid gap-2 min-w-fit"
          style={{
            gridTemplateColumns: `repeat(${seatingState.cols}, minmax(${isProjector ? '110px' : '92px'}, 1fr))`,
          }}
        >
          {orientedGrid.flatMap((rowCells) =>
            rowCells.map((cell) => {
              const student = cell.studentId ? studentById.get(cell.studentId) : undefined;
              const isSelected = selectedSeatForSwap === cell.seatKey;
              const showCode = student && duplicateNamesSet.has(student.fullName);

              return (
                <div
                  key={cell.seatKey}
                  onClick={() => handleSeatClick(cell.seatKey, cell.isBlocked)}
                  className={`relative rounded-lg border p-2 min-h-[68px] flex flex-col justify-between transition-colors cursor-pointer select-none ${
                    cell.isBlocked
                      ? 'bg-slate-100 border-dashed border-slate-300 text-slate-400'
                      : isSelected
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400'
                        : student
                          ? cell.isPinned
                            ? 'bg-blue-50 border-[#1769F4] text-[#0F2D52]'
                            : 'bg-white border-slate-200 hover:border-slate-400 text-slate-900'
                          : 'bg-slate-50/70 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-400">
                    <span>
                      H{cell.row + 1}-G{cell.col + 1}
                    </span>
                    {!cell.isBlocked && !isProjector && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeSeatingState(toggleSeatPinned(seatingState, cell.seatKey));
                        }}
                        title={cell.isPinned ? 'Bỏ ghim vị trí' : 'Ghim vị trí này'}
                        className={`p-0.5 rounded cursor-pointer ${
                          cell.isPinned
                            ? 'text-[#1769F4] bg-blue-100'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {cell.isPinned ? (
                          <Pin className="w-3 h-3" />
                        ) : (
                          <PinOff className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    {cell.isPinned && isProjector && (
                      <Pin className="w-3.5 h-3.5 text-[#1769F4]" />
                    )}
                  </div>

                  {cell.isBlocked ? (
                    <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400 my-auto">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Ghế trống</span>
                    </div>
                  ) : student ? (
                    <div className="my-auto">
                      <div
                        className={`font-bold leading-snug break-words ${
                          isProjector ? 'text-sm sm:text-base' : 'text-xs sm:text-[13px]'
                        }`}
                      >
                        {student.fullName}
                      </div>
                      {showCode && (
                        <div className="text-[10px] font-mono text-slate-500">
                          {student.code || student.id}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 text-center my-auto">
                      Trống
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {seatingState.orientation === 'back_of_class' && boardBanner}
    </div>
  );

  return (
    <div className="space-y-4 font-edtech">
      {/* Control Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#0F2D52]">
              Sơ đồ chỗ ngồi lớp học
            </h3>
            <p className="text-sm text-slate-600">
              {presentStudents.length} học sinh có mặt · {availableSeats.length}/
              {seatingState.rows * seatingState.cols} ghế khả dụng
              {seatingState.pinnedSeatKeys.length > 0 &&
                ` · Đang ghim ${seatingState.pinnedSeatKeys.length} vị trí`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAssignRandomly}
              disabled={presentStudents.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] disabled:opacity-50 text-white text-sm font-bold cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Shuffle className="w-4 h-4" />
              <span>Xếp chỗ ngẫu nhiên</span>
            </button>

            <button
              type="button"
              onClick={() => setProjectorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <Monitor className="w-4 h-4" />
              <span>Màn trình chiếu</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Bản in</span>
            </button>
          </div>
        </div>

        {/* Dimensions & Modes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label htmlFor="seat-rows" className="text-xs font-semibold text-slate-600 shrink-0">
              Số hàng:
            </label>
            <input
              id="seat-rows"
              type="number"
              min={1}
              max={12}
              value={seatingState.rows}
              onChange={(e) =>
                onChangeSeatingState(
                  updateSeatingDimensions(
                    seatingState,
                    Number(e.target.value) || 1,
                    seatingState.cols
                  )
                )
              }
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-900 tabular-nums"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="seat-cols" className="text-xs font-semibold text-slate-600 shrink-0">
              Số ghế/hàng:
            </label>
            <input
              id="seat-cols"
              type="number"
              min={1}
              max={12}
              value={seatingState.cols}
              onChange={(e) =>
                onChangeSeatingState(
                  updateSeatingDimensions(
                    seatingState,
                    seatingState.rows,
                    Number(e.target.value) || 1
                  )
                )
              }
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-900 tabular-nums"
            />
          </div>

          {/* Click behavior */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setEditMode('swap_pin');
                setSelectedSeatForSwap(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                editMode === 'swap_pin'
                  ? 'bg-white text-[#0F2D52] shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Đổi chỗ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditMode('block_empty');
                setSelectedSeatForSwap(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                editMode === 'block_empty'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Đánh dấu ghế trống</span>
            </button>
          </div>

          {/* Orientation */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() =>
                onChangeSeatingState({ ...seatingState, orientation: 'front_board' })
              }
              className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                seatingState.orientation === 'front_board'
                  ? 'bg-white text-[#0F2D52] shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Từ bảng</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onChangeSeatingState({ ...seatingState, orientation: 'back_of_class' })
              }
              className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                seatingState.orientation === 'back_of_class'
                  ? 'bg-white text-[#0F2D52] shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Từ cuối lớp</span>
            </button>
          </div>
        </div>

        {seatingState.lastError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{seatingState.lastError}</span>
          </div>
        )}

        {selectedSeatForSwap && (
          <div className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Đang chọn ghế để đổi chỗ — nhấp vào một ghế khác để hoán đổi vị trí hai học sinh.
          </div>
        )}
      </div>

      {/* Interactive / Printable Classroom Map */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 print:border-0 print:p-0">
        <div className="hidden print:block mb-3 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            SƠ ĐỒ CHỖ NGỒI — {classNameLabel}
          </h2>
          <p className="text-xs text-slate-600">
            Góc nhìn: {seatingState.orientation === 'front_board' ? 'Từ bảng' : 'Từ cuối lớp'} · Sĩ số có mặt: {presentStudents.length} HS
          </p>
        </div>
        {renderGridContent(false)}
      </div>

      {/* Fullscreen Projector Modal */}
      {projectorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 p-4 sm:p-6 overflow-y-auto flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 text-white">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold">
                SƠ ĐỒ CHỖ NGỒI · {classNameLabel}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Góc nhìn: {seatingState.orientation === 'front_board' ? 'Từ bảng' : 'Từ cuối lớp'} · {presentStudents.length} học sinh có mặt
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProjectorOpen(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Đóng màn chiếu</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 flex-1">
            {renderGridContent(true)}
          </div>
        </div>
      )}
    </div>
  );
};
