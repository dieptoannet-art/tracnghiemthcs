import React, { useMemo, useState } from 'react';
import {
  Ban,
  DoorOpen,
  Eye,
  GraduationCap,
  Monitor,
  Pin,
  PinOff,
  Printer,
  X,
} from 'lucide-react';
import {
  OrientedAisleView,
  SeatingNameDisplayMode,
  SeatingProState,
  buildOrientedAislesView,
  computeSeatingStats,
  formatIsoDateVi,
  formatStudentDisplayName,
  getRoomCapacitySummary,
} from './seatingProEngine';

export interface ClassroomMapViewProps {
  state: SeatingProState;
  interactive: boolean;
  editToolMode: 'swap' | 'lock' | 'pin';
  selectedSeatId: string | null;
  selectedWaitingStudentId: string | null;
  revealedSeatSet: Set<string> | null; // null = reveal all; Set = only show assigned seat in set during animation
  seatAssignmentsOverride?: Record<string, string | null>;
  recentlyLandedSeatIds?: Set<string>;
  zoomPercent?: number;
  forceBW?: boolean;
  isProjector?: boolean;
  aislesSubset?: OrientedAisleView[];
  onSeatClick?: (seatId: string) => void;
  onDirectPinToggle?: (seatId: string) => void;
}

const MULTI_AISLE_STYLES = [
  { header: 'bg-blue-700 text-white', border: 'border-blue-200', tint: 'bg-blue-50/70' },
  { header: 'bg-emerald-700 text-white', border: 'border-emerald-200', tint: 'bg-emerald-50/70' },
  { header: 'bg-amber-700 text-white', border: 'border-amber-200', tint: 'bg-amber-50/70' },
  { header: 'bg-violet-700 text-white', border: 'border-violet-200', tint: 'bg-violet-50/70' },
  { header: 'bg-cyan-700 text-white', border: 'border-cyan-200', tint: 'bg-cyan-50/70' },
  { header: 'bg-rose-700 text-white', border: 'border-rose-200', tint: 'bg-rose-50/70' },
];

export const ClassroomMapView: React.FC<ClassroomMapViewProps> = ({
  state,
  interactive,
  editToolMode,
  selectedSeatId,
  selectedWaitingStudentId,
  revealedSeatSet,
  seatAssignmentsOverride,
  recentlyLandedSeatIds,
  zoomPercent = 100,
  forceBW = false,
  isProjector = false,
  aislesSubset,
  onSeatClick,
  onDirectPinToggle,
}) => {
  const isBW = forceBW || state.colorTheme === 'bw';
  const isMulti = !isBW && state.colorTheme === 'multicolor';
  const isRotated180 = state.orientation === 'back_of_class';

  const orientedAisles = useMemo(
    () => aislesSubset || buildOrientedAislesView(state.room, state.orientation),
    [aislesSubset, state.room, state.orientation]
  );

  const studentIdxMap = useMemo(() => {
    const map = new Map<string, { stu: SeatingProState['students'][number]; stt: number }>();
    state.students.forEach((s, idx) => map.set(s.id, { stu: s, stt: idx + 1 }));
    return map;
  }, [state.students]);

  const lockedSet = useMemo(() => new Set(state.lockedSeatIds), [state.lockedSeatIds]);
  const pinnedSet = useMemo(() => new Set(state.pinnedSeatIds), [state.pinnedSeatIds]);

  const frontFurnitureRow = (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5 border ${
        isBW
          ? 'bg-white border-black text-black'
          : 'bg-[#F0F6FF] border-[#CFE0F5] text-[#082B52]'
      }`}
    >
      {/* Door swaps physical side on 180-degree flip */}
      {!isRotated180 ? (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold shrink-0 ${
            isBW
              ? 'bg-white border-black text-black'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <DoorOpen className="w-4 h-4 shrink-0" />
          <span>CỬA RA VÀO</span>
        </div>
      ) : (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold shrink-0 ${
            isBW
              ? 'bg-white border-black text-black'
              : 'bg-white border-[#1769F4]/40 text-[#0F2D52]'
          }`}
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span>BÀN GIÁO VIÊN</span>
        </div>
      )}

      {/* Blackboard & Podium */}
      <div
        className={`flex-1 min-w-[200px] py-2 px-4 rounded-lg text-center text-xs sm:text-sm font-extrabold tracking-wide border ${
          isBW
            ? 'bg-white border-2 border-black text-black'
            : 'bg-[#082B52] border-[#082B52] text-white'
        }`}
      >
        BẢNG LỚP · BỤC GIẢNG
      </div>

      {/* Teacher Desk vs Door on opposite side */}
      {!isRotated180 ? (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold shrink-0 ${
            isBW
              ? 'bg-white border-black text-black'
              : 'bg-white border-[#1769F4]/40 text-[#0F2D52]'
          }`}
        >
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span>BÀN GIÁO VIÊN</span>
        </div>
      ) : (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold shrink-0 ${
            isBW
              ? 'bg-white border-black text-black'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <DoorOpen className="w-4 h-4 shrink-0" />
          <span>CỬA RA VÀO</span>
        </div>
      )}
    </div>
  );

  const scaleFactor = zoomPercent / 100;

  return (
    <div
      className="space-y-3 origin-top-left transition-transform duration-150"
      style={
        scaleFactor !== 1
          ? {
              transform: `scale(${scaleFactor})`,
              width: `${100 / scaleFactor}%`,
            }
          : undefined
      }
    >
      {!isRotated180 && frontFurnitureRow}

      <div
        className="grid gap-3 min-w-[680px]"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, orientedAisles.length)}, minmax(210px, 1fr))`,
        }}
      >
        {orientedAisles.map((aView) => {
          const aisleStyle = isBW
            ? { header: 'bg-black text-white', border: 'border-black', tint: 'bg-white' }
            : isMulti
              ? MULTI_AISLE_STYLES[aView.aisleIndex % MULTI_AISLE_STYLES.length]
              : { header: 'bg-[#0F2D52] text-white', border: 'border-[#DCE8F7]', tint: 'bg-[#F8FBFF]' };

          return (
            <div
              key={aView.aisle.id}
              className={`rounded-xl border ${aisleStyle.border} ${aisleStyle.tint} p-2.5 flex flex-col gap-2.5`}
            >
              <div
                className={`px-3 py-1.5 rounded-lg text-center text-xs font-extrabold tracking-wide ${aisleStyle.header}`}
              >
                {aView.aisle.name}
              </div>

              <div className="space-y-2">
                {aView.desks.map((dView) => {
                  const isFrontZone =
                    dView.deskPhysicalIndex < state.constraints.frontPriorityDeskCount;
                  return (
                    <div
                      key={dView.desk.id}
                      className={`rounded-lg border p-2 space-y-1.5 ${
                        isBW
                          ? 'bg-white border-black'
                          : isFrontZone
                            ? 'bg-white border-[#93C5FD]'
                            : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                        <span className={isBW ? 'text-black' : 'text-[#082B52]'}>
                          Bàn {dView.deskDisplayNumber}
                        </span>
                        <span className={`font-mono-num ${isBW ? 'text-black' : 'text-slate-500'}`}>
                          {dView.seatIds.length} chỗ
                          {isFrontZone && !isBW ? ' · Gần bảng' : ''}
                        </span>
                      </div>

                      <div
                        className="grid gap-1.5"
                        style={{
                          gridTemplateColumns: `repeat(${Math.max(1, dView.seatIds.length)}, minmax(0, 1fr))`,
                        }}
                      >
                        {dView.seatIds.map((seatId) => {
                          const isLocked = lockedSet.has(seatId);
                          const isPinned = pinnedSet.has(seatId);
                          const rawStuId = seatAssignmentsOverride
                            ? seatAssignmentsOverride[seatId] || null
                            : state.assignments[seatId] || null;
                          const isVisibleInAnim =
                            Boolean(seatAssignmentsOverride) ||
                            revealedSeatSet === null ||
                            isPinned ||
                            revealedSeatSet.has(seatId);
                          const stuId = isVisibleInAnim ? rawStuId : null;
                          const stuInfo = stuId ? studentIdxMap.get(stuId) : undefined;
                          const isSelected = selectedSeatId === seatId;
                          const isRecentlyLanded = Boolean(recentlyLandedSeatIds?.has(seatId));
                          const formatted = stuInfo
                            ? formatStudentDisplayName({
                                student: stuInfo.stu,
                                sttIndex: stuInfo.stt,
                                mode: state.nameDisplayMode,
                                allStudents: state.students,
                              })
                            : null;

                          const waitingTargetReady =
                            Boolean(selectedWaitingStudentId) && !isLocked && !(isPinned && rawStuId);

                          const seatCls = isLocked
                            ? isBW
                              ? 'bg-neutral-200 border-dashed border-black text-black'
                              : 'bg-slate-100 border-dashed border-slate-300 text-slate-500'
                            : isSelected
                              ? isBW
                                ? 'bg-neutral-100 border-2 border-black ring-2 ring-black'
                                : 'bg-amber-50 border-amber-500 ring-2 ring-amber-400 text-[#0F2D52]'
                              : isRecentlyLanded
                                ? isBW
                                  ? 'bg-neutral-100 border-2 border-black ring-2 ring-black'
                                  : 'bg-emerald-50/85 border-emerald-400 ring-2 ring-emerald-300 text-[#065F46]'
                                : waitingTargetReady
                                  ? 'bg-emerald-50/70 border-emerald-400 hover:border-emerald-600 text-[#0F2D52]'
                                  : stuInfo
                                    ? isPinned
                                      ? isBW
                                        ? 'bg-white border-2 border-black text-black'
                                        : 'bg-blue-50 border-[#1769F4] text-[#082B52]'
                                      : isBW
                                        ? 'bg-white border-black text-black'
                                        : 'bg-white border-slate-200 hover:border-[#1769F4] text-[#0F2D52]'
                                    : isBW
                                      ? 'bg-white border-dotted border-black text-neutral-500'
                                      : 'bg-slate-50/80 border-slate-200 hover:border-slate-400 text-slate-400';

                          const Tag = interactive ? 'button' : 'div';
                          return (
                            <Tag
                              key={seatId}
                              data-seat-id={seatId}
                              type={interactive ? 'button' : undefined}
                              onClick={interactive ? () => onSeatClick?.(seatId) : undefined}
                              className={`relative rounded-md border px-1.5 py-2 min-h-[60px] flex flex-col justify-between text-center transition-colors ${
                                interactive ? 'cursor-pointer touch-manipulation' : ''
                              } ${seatCls} ${
                                editToolMode === 'lock' && interactive ? 'hover:ring-1 hover:ring-rose-400' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="font-mono-num opacity-75">
                                  C{dView.seatIds.indexOf(seatId) + 1}
                                </span>
                                {isPinned && (
                                  interactive && onDirectPinToggle ? (
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDirectPinToggle(seatId);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          onDirectPinToggle(seatId);
                                        }
                                      }}
                                      title="Bỏ ghim vị trí"
                                      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold ${
                                        isBW ? 'bg-black text-white' : 'bg-[#1769F4] text-white'
                                      }`}
                                    >
                                      <Pin className="w-2.5 h-2.5" />
                                    </span>
                                  ) : (
                                    <Pin className={`w-3 h-3 ${isBW ? 'text-black' : 'text-[#1769F4]'}`} />
                                  )
                                )}
                                {!isPinned && interactive && stuInfo && editToolMode === 'pin' && (
                                  <PinOff className="w-3 h-3 text-slate-400" />
                                )}
                              </div>

                              {isLocked ? (
                                <div className="my-auto flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold">
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Khóa</span>
                                </div>
                              ) : formatted ? (
                                <div className="my-auto space-y-0.5">
                                  <div
                                    className={`font-bold leading-tight break-words ${
                                      isProjector ? 'text-sm' : 'text-[11px] sm:text-xs'
                                    }`}
                                  >
                                    {formatted.primary}
                                  </div>
                                  {formatted.secondaryCode && (
                                    <div className="text-[9px] font-mono-num opacity-75">
                                      {formatted.secondaryCode}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="my-auto text-[10px] font-semibold">
                                  {rawStuId && !isVisibleInAnim ? 'Đang xếp...' : 'Trống'}
                                </div>
                              )}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isRotated180 && frontFurnitureRow}
    </div>
  );
};

// ============================================================================
// FULLSCREEN PROJECTOR MODE (CHỈ SƠ ĐỒ, THÔNG TIN LỚP & THOÁT)
// ============================================================================
export const SeatingProjectorModal: React.FC<{
  state: SeatingProState;
  onChangeNameDisplayMode: (mode: SeatingNameDisplayMode) => void;
  onToggleOrientation: () => void;
  onClose: () => void;
}> = ({ state, onChangeNameDisplayMode, onToggleOrientation, onClose }) => {
  const summary = getRoomCapacitySummary(state);
  const stats = computeSeatingStats(state.room, state.assignments, state.pinnedSeatIds, state.lockedSeatIds);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trình chiếu sơ đồ chỗ ngồi"
      className="fixed inset-0 z-50 bg-[#081A33] text-white p-4 sm:p-6 overflow-y-auto flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            SƠ ĐỒ CHỖ NGỒI — {state.meta.className || 'Lớp học'}
          </h2>
          <p className="text-xs sm:text-sm text-sky-100/90 mt-0.5">
            GV: {state.meta.teacherName || 'Chưa nhập'}
            {state.meta.academicNote ? ` · ${state.meta.academicNote}` : ''}
            {state.meta.showDateOnChart ? ` · Ngày lập: ${formatIsoDateVi(state.meta.createdDateIso)}` : ''}
            {` · Đã xếp: ${summary.assignedSeats}/${summary.availableSeats} ghế khả dụng`}
            {` · Góc nhìn: ${state.orientation === 'front_board' ? 'Bảng ở trên' : 'Nhìn từ bục giảng'}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-white/10 rounded-xl">
            {(
              [
                { id: 'full', label: 'Tên đầy đủ' },
                { id: 'last_two', label: 'Hai từ cuối' },
                { id: 'stt_name', label: 'STT + tên' },
              ] as { id: SeatingNameDisplayMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeNameDisplayMode(opt.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                  state.nameDisplayMode === opt.id
                    ? 'bg-white text-[#082B52]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleOrientation}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-4 h-4" />
            <span>Đảo góc nhìn</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-extrabold cursor-pointer whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            <span>Thoát trình chiếu (Esc)</span>
          </button>
        </div>
      </div>

      <div className="bg-white text-[#0F2D52] rounded-2xl p-4 sm:p-5 flex-1 overflow-x-auto">
        <ClassroomMapView
          state={state}
          interactive={false}
          editToolMode="swap"
          selectedSeatId={null}
          selectedWaitingStudentId={null}
          revealedSeatSet={null}
          isProjector
        />

        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-700">
          <div className="flex flex-wrap items-center gap-4">
            {stats.aisles.map((a) => (
              <span key={a.aisleId}>
                {a.aisleName}: {a.assignedCount}/{a.availableCount} HS
              </span>
            ))}
          </div>
          <span>Chênh lệch giữa các dãy: {stats.spread} HS</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PRINT A4 LANDSCAPE PREVIEW MODAL & HIDDEN PRINT CONTAINER
// ============================================================================
export const SeatingPrintPreviewModal: React.FC<{
  state: SeatingProState;
  onClose: () => void;
}> = ({ state, onClose }) => {
  const [bwPrint, setBwPrint] = useState<boolean>(true);
  const [splitByAislePages, setSplitByAislePages] = useState<boolean>(
    state.room.aisles.length > 4
  );

  const orientedAisles = useMemo(
    () => buildOrientedAislesView(state.room, state.orientation),
    [state.room, state.orientation]
  );

  const aislePages = useMemo(() => {
    if (!splitByAislePages || orientedAisles.length <= 2) {
      return [orientedAisles];
    }
    const perPage = Math.max(2, Math.ceil(orientedAisles.length / 2));
    const chunks: OrientedAisleView[][] = [];
    for (let i = 0; i < orientedAisles.length; i += perPage) {
      chunks.push(orientedAisles.slice(i, i + perPage));
    }
    return chunks;
  }, [orientedAisles, splitByAislePages]);

  const summary = getRoomCapacitySummary(state);

  const handleTriggerPrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const renderPages = (forPrintOnly: boolean) => (
    <div className={forPrintOnly ? 'space-y-6' : 'space-y-6'}>
      {aislePages.map((subset, pageIdx) => (
        <section
          key={pageIdx}
          className={`bg-white text-black rounded-xl border border-slate-300 p-4 sm:p-6 space-y-3 ${
            forPrintOnly ? 'border-0 p-0 rounded-none' : ''
          }`}
          style={
            forPrintOnly && pageIdx > 0
              ? { breakBefore: 'page', pageBreakBefore: 'always' }
              : undefined
          }
        >
          <div className="text-center border-b border-black/20 pb-2">
            <h2 className="text-lg font-extrabold tracking-tight">
              SƠ ĐỒ CHỖ NGỒI — {state.meta.className || 'Lớp học'}
              {aislePages.length > 1 ? ` (Trang ${pageIdx + 1}/${aislePages.length})` : ''}
            </h2>
            <p className="text-xs text-slate-700 mt-0.5">
              GV: {state.meta.teacherName || 'Chưa nhập'}
              {state.meta.academicNote ? ` · ${state.meta.academicNote}` : ''}
              {state.meta.showDateOnChart ? ` · Ngày lập: ${formatIsoDateVi(state.meta.createdDateIso)}` : ''}
              {` · Đã xếp ${summary.assignedSeats} HS · Khả dụng ${summary.availableSeats}/${summary.totalSeats} ghế`}
              {` · Góc nhìn: ${state.orientation === 'front_board' ? 'Bảng ở trên' : 'Nhìn từ bục giảng'}`}
            </p>
          </div>

          <ClassroomMapView
            state={state}
            interactive={false}
            editToolMode="swap"
            selectedSeatId={null}
            selectedWaitingStudentId={null}
            revealedSeatSet={null}
            forceBW={bwPrint}
            aislesSubset={subset}
          />
        </section>
      ))}
    </div>
  );

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xem trước bản in A4 ngang"
        className="fixed inset-0 z-50 bg-slate-900/75 p-4 sm:p-6 overflow-y-auto flex items-start justify-center print:hidden"
      >
        <div className="bg-white rounded-2xl border border-slate-200 max-w-6xl w-full p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-extrabold text-[#082B52]">
                Xem trước &amp; In A4 ngang
              </h3>
              <p className="text-xs text-slate-600">
                Sử dụng đúng góc nhìn đang chọn ({state.orientation === 'front_board' ? 'Bảng ở trên' : 'Nhìn từ bục giảng'}).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bwPrint}
                  onChange={(e) => setBwPrint(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Mẫu Đen trắng</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitByAislePages}
                  onChange={(e) => setSplitByAislePages(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Chia trang theo dãy (sơ đồ lớn)</span>
              </label>

              <button
                type="button"
                onClick={handleTriggerPrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs font-extrabold cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>In A4 ngang</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Đóng</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-100 rounded-xl p-4 overflow-x-auto max-h-[75vh] overflow-y-auto">
            {renderPages(false)}
          </div>
        </div>
      </div>

      {/* Hidden A4 Landscape Print Portal */}
      <div className="hidden print:block seating-a4-print-root">
        {renderPages(true)}
      </div>
    </>
  );
};
