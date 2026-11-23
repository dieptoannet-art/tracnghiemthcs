import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Disc,
  Gift,
  Layers,
  Sparkles,
  UserX,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import {
  WHEEL_3D_COLOR_PALETTE,
  buildWheel3DSliceItems,
  computeTargetWheelAngleRad,
  evaluateWheel3DSpinCurve,
  resolveWheelLabelMode,
} from '../games/wheel3dMath';
import imgDrawBox3d from '../../../assets/images/picker_draw_box_3d_1795357938354.jpg';
import imgSlotClassroom3d from '../../../assets/images/picker_slot_classroom_3d_1795357939348.jpg';
import {
  PickerCallMode,
  PickerStudentItem,
  PickerTurnRecord,
} from './namePickerEngine';
import { NamePicker3DStage } from './NamePicker3DStage';

interface NamePickerStageProps {
  mode: PickerCallMode;
  allStudents: PickerStudentItem[];
  eligiblePool: PickerStudentItem[];
  remainingPool: PickerStudentItem[];
  activeTurn: PickerTurnRecord | null;
  requestedK: number;
  reducedMotion: boolean;
  use3D?: boolean;
  isFullscreen: boolean;
  onCompleteAnimation: () => void;
  onStartQuickTurn?: () => void;
  onOpenClassicA01?: () => void;
  onAutoFallback2D?: (reason: string) => void;
}

function toWheelCandidates(list: PickerStudentItem[]): StudentCandidate[] {
  return list.map((s) => ({
    id: s.id,
    code: s.code,
    fullName: s.fullName,
    isAbsent: !s.present,
  }));
}

export const NamePickerStage: React.FC<NamePickerStageProps> = ({
  mode,
  allStudents,
  eligiblePool,
  remainingPool,
  activeTurn,
  requestedK,
  reducedMotion,
  use3D = false,
  isFullscreen,
  onCompleteAnimation,
  onStartQuickTurn,
  onOpenClassicA01,
  onAutoFallback2D,
}) => {
  if (use3D && mode !== 'elimination') {
    return (
      <NamePicker3DStage
        mode={mode}
        allStudents={allStudents}
        eligiblePool={eligiblePool}
        remainingPool={remainingPool}
        activeTurn={activeTurn}
        requestedK={requestedK}
        reducedMotion={reducedMotion}
        isFullscreen={isFullscreen}
        onCompleteAnimation={onCompleteAnimation}
        onStartQuickTurn={onStartQuickTurn}
        onOpenClassicA01={onOpenClassicA01}
        onAutoFallback2D={onAutoFallback2D}
      />
    );
  }

  const isAnimating = Boolean(activeTurn && activeTurn.status === 'animating' && activeTurn.mode === mode);
  const isRevealed = Boolean(activeTurn && activeTurn.status === 'revealed');
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});

  // ============================================================================
  // MODE A: VÒNG QUAY (Integrates A01's slice geometry & spin curve cleanly)
  // ============================================================================
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelAngleRef = useRef<number>(0);

  const wheelRoster = useMemo(() => {
    const base = remainingPool.length > 0 ? remainingPool : eligiblePool;
    // Ensure pre-locked winner stays on wheel during its own reveal frame
    if (activeTurn && activeTurn.pickedStudents.length > 0) {
      const map = new Map(base.map((s) => [s.id, s]));
      activeTurn.pickedStudents.forEach((p) => {
        if (!map.has(p.id)) {
          map.set(p.id, {
            id: p.id,
            code: p.code,
            fullName: p.fullName,
            present: true,
            starred: false,
            score: 0,
          });
        }
      });
      return Array.from(map.values());
    }
    return base;
  }, [remainingPool, eligiblePool, activeTurn]);

  const wheelSlices = useMemo(
    () =>
      buildWheel3DSliceItems(
        toWheelCandidates(wheelRoster),
        toWheelCandidates(allStudents)
      ),
    [wheelRoster, allStudents]
  );

  const resolvedLabelMode = useMemo(
    () => resolveWheelLabelMode(wheelSlices.length, 'AUTO'),
    [wheelSlices.length]
  );

  // Draw wheel canvas at current angle
  const drawWheelCanvas = (angleCwRad: number) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const size = Math.min(canvas.parentElement?.clientWidth || 380, isFullscreen ? 460 : 380);
    if (canvas.width !== Math.round(size * dpr) || canvas.height !== Math.round(size * dpr)) {
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    const cx = size / 2;
    const cy = size / 2;
    const r = cx - 14;
    ctx.clearRect(0, 0, size, size);

    // Outer gold/navy rim
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = '#082B52';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#F59E0B';
    ctx.stroke();

    const n = wheelSlices.length;
    if (n === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Chưa có ứng viên', cx, cy);
      ctx.restore();
      return;
    }

    const sliceRad = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const slice = wheelSlices[i];
      // Canvas angle 0 is right (+X); -PI/2 puts pointer at 12 o'clock top cleanly
      const startAngle = -Math.PI / 2 - angleCwRad + i * sliceRad - sliceRad / 2;
      const endAngle = startAngle + sliceRad;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = slice.colorHex || WHEEL_3D_COLOR_PALETTE[i % WHEEL_3D_COLOR_PALETTE.length].bg;
      ctx.fill();
      ctx.lineWidth = n > 24 ? 1 : 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Label along slice radius
      const mid = (startAngle + endAngle) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label =
        resolvedLabelMode === 'NUMBER_STT'
          ? slice.formattedStt
          : resolvedLabelMode === 'SHORT_NAME'
            ? slice.shortLabel
            : slice.mediumLabel;
      ctx.font =
        n > 32
          ? 'bold 10px Plus Jakarta Sans, sans-serif'
          : n > 18
            ? 'bold 11px Plus Jakarta Sans, sans-serif'
            : 'bold 13px Plus Jakarta Sans, sans-serif';
      ctx.fillText(label, r - 12, 0);
      ctx.restore();
    }

    // Center cap
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#082B52';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FCD34D';
    ctx.stroke();

    // Top 12 o'clock pointer
    ctx.beginPath();
    ctx.moveTo(cx, 22);
    ctx.lineTo(cx - 11, 2);
    ctx.lineTo(cx + 11, 2);
    ctx.closePath();
    ctx.fillStyle = '#F59E0B';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.restore();
  };

  useEffect(() => {
    if (mode !== 'wheel') return;
    drawWheelCanvas(wheelAngleRef.current);
  }, [mode, wheelSlices, isFullscreen]);

  useEffect(() => {
    if (mode !== 'wheel' || !isAnimating || !activeTurn) return;
    const primary = activeTurn.pickedStudents[0];
    const targetIdx = Math.max(
      0,
      wheelSlices.findIndex((s) => s.student.id === primary?.id)
    );
    const startAngle = wheelAngleRef.current;

    if (reducedMotion) {
      const { targetAngleCwRad } = computeTargetWheelAngleRad({
        currentAngleCwRad: startAngle,
        selectedIndex: targetIdx,
        sliceCount: Math.max(1, wheelSlices.length),
        fullSpins: 1,
        sliceOffsetFactor: 0,
      });
      wheelAngleRef.current = targetAngleCwRad;
      drawWheelCanvas(targetAngleCwRad);
      onCompleteAnimation();
      return;
    }

    const durationMs = 2600;
    const { totalDeltaRad } = computeTargetWheelAngleRad({
      currentAngleCwRad: startAngle,
      selectedIndex: targetIdx,
      sliceCount: Math.max(1, wheelSlices.length),
      fullSpins: 4,
      sliceOffsetFactor: 0,
    });
    const totalDelta = totalDeltaRad;
    const startTime = performance.now();
    let rafId = 0;

    const frame = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startTime) / durationMs));
      const { progress } = evaluateWheel3DSpinCurve(t);
      const curr = startAngle + totalDelta * progress;
      wheelAngleRef.current = curr;
      drawWheelCanvas(curr);
      if (t < 1) {
        rafId = window.requestAnimationFrame(frame);
      } else {
        onCompleteAnimation();
      }
    };
    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [mode, isAnimating, activeTurn?.turnId, reducedMotion]);

  // ============================================================================
  // MODE B: HỘP BỐC THĂM (Sequential slip emerge from 3D chest)
  // ============================================================================
  const [boxRevealCount, setBoxRevealCount] = useState<number>(0);

  useEffect(() => {
    if (mode !== 'draw_box' || !activeTurn) {
      setBoxRevealCount(0);
      return;
    }
    if (activeTurn.status === 'revealed' || reducedMotion) {
      setBoxRevealCount(activeTurn.pickedStudents.length);
      if (activeTurn.status === 'animating') onCompleteAnimation();
      return;
    }
    setBoxRevealCount(0);
    const total = activeTurn.pickedStudents.length;
    const timers: number[] = [];
    for (let i = 1; i <= total; i++) {
      timers.push(
        window.setTimeout(() => {
          setBoxRevealCount(i);
          if (i === total) {
            window.setTimeout(onCompleteAnimation, 350);
          }
        }, i * 520)
      );
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [mode, activeTurn?.turnId, activeTurn?.status, reducedMotion]);

  // ============================================================================
  // MODE C: MÁY XÈNG (Scrolling candidate reels snapping onto pickedStudents)
  // ============================================================================
  const [slotTick, setSlotTick] = useState<number>(0);
  const [slotLockedCount, setSlotLockedCount] = useState<number>(0);

  useEffect(() => {
    if (mode !== 'slot_machine' || !activeTurn) {
      setSlotLockedCount(0);
      return;
    }
    if (activeTurn.status === 'revealed' || reducedMotion) {
      setSlotLockedCount(activeTurn.pickedStudents.length);
      if (activeTurn.status === 'animating') onCompleteAnimation();
      return;
    }
    setSlotLockedCount(0);
    const total = activeTurn.pickedStudents.length;
    const spinInterval = window.setInterval(() => setSlotTick((t) => t + 1), 85);
    const lockTimers: number[] = [];
    for (let i = 1; i <= total; i++) {
      lockTimers.push(
        window.setTimeout(() => {
          setSlotLockedCount(i);
          if (i === total) {
            window.clearInterval(spinInterval);
            window.setTimeout(onCompleteAnimation, 320);
          }
        }, 700 + i * 550)
      );
    }
    return () => {
      window.clearInterval(spinInterval);
      lockTimers.forEach((id) => window.clearTimeout(id));
    };
  }, [mode, activeTurn?.turnId, activeTurn?.status, reducedMotion]);

  // ============================================================================
  // MODE D: LẬT THẺ BÍ ẨN (Interactive / Keyboard mystery cards)
  // ============================================================================
  const [flippedCardIndices, setFlippedCardIndices] = useState<number[]>([]);
  const [focusedCardIdx, setFocusedCardIdx] = useState<number>(0);
  const flipCardCount = useMemo(() => {
    const k = activeTurn?.pickedStudents.length || requestedK;
    return Math.max(k, Math.min(8, Math.max(4, k + 3)));
  }, [activeTurn?.pickedStudents.length, requestedK]);

  useEffect(() => {
    if (mode !== 'flip_cards') return;
    if (!activeTurn) {
      setFlippedCardIndices([]);
      return;
    }
    if (activeTurn.status === 'revealed' || reducedMotion) {
      const targetCount = activeTurn.pickedStudents.length;
      setFlippedCardIndices(Array.from({ length: targetCount }, (_, i) => i));
      if (activeTurn.status === 'animating') onCompleteAnimation();
      return;
    }
    setFlippedCardIndices([]);
    // Auto-flip sequential stagger OR teacher clicks/keyboard flips early!
    const total = activeTurn.pickedStudents.length;
    const timers: number[] = [];
    for (let i = 0; i < total; i++) {
      timers.push(
        window.setTimeout(() => {
          setFlippedCardIndices((prev) => (prev.includes(i) ? prev : [...prev, i]));
          if (i === total - 1) {
            window.setTimeout(onCompleteAnimation, 300);
          }
        }, 350 + i * 420)
      );
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [mode, activeTurn?.turnId, activeTurn?.status, reducedMotion]);

  const handleCardInteract = (cardIdx: number) => {
    if (!activeTurn) {
      if (onStartQuickTurn) onStartQuickTurn();
      return;
    }
    if (activeTurn.status === 'animating') {
      setFlippedCardIndices((prev) => {
        if (prev.includes(cardIdx)) return prev;
        const next = [...prev, cardIdx];
        if (next.length >= activeTurn.pickedStudents.length) {
          onCompleteAnimation();
        }
        return next;
      });
    }
  };

  // ============================================================================
  // MODE E: LOẠI TRỪ DẦN (Dims eliminated candidates, keeps final k highlighted)
  // ============================================================================
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);

  useEffect(() => {
    if (mode !== 'elimination' || !activeTurn) {
      setEliminatedIds([]);
      return;
    }
    const winnerSet = new Set(activeTurn.pickedStudents.map((s) => s.id));
    const toEliminate = remainingPool
      .filter((s) => !winnerSet.has(s.id))
      .map((s) => s.id);

    if (activeTurn.status === 'revealed' || reducedMotion || toEliminate.length === 0) {
      setEliminatedIds(toEliminate);
      if (activeTurn.status === 'animating') onCompleteAnimation();
      return;
    }

    setEliminatedIds([]);
    const stepMs = Math.max(85, Math.min(340, Math.floor(2000 / toEliminate.length)));
    const timers: number[] = [];
    toEliminate.forEach((id, idx) => {
      timers.push(
        window.setTimeout(() => {
          setEliminatedIds((prev) => [...prev, id]);
          if (idx === toEliminate.length - 1) {
            window.setTimeout(onCompleteAnimation, 380);
          }
        }, (idx + 1) * stepMs)
      );
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [mode, activeTurn?.turnId, activeTurn?.status, reducedMotion]);

  // ============================================================================
  // SHARED RESULT BANNER (HIGH CONTRAST FOR 1920x1080 PROJECTOR)
  // ============================================================================
  const renderWinnerBanner = () => {
    if (!isRevealed || !activeTurn || activeTurn.pickedStudents.length === 0) return null;
    return (
      <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#082B52] via-[#0F3C78] to-[#1769F4] text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/15">
          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
            Kết quả lượt gọi · {activeTurn.pickedStudents.length} học sinh được chọn
          </span>
          <span className="text-xs font-semibold text-sky-200">
            Mã lượt {activeTurn.turnId.slice(-6)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {activeTurn.pickedStudents.map((stu, idx) => (
            <div
              key={stu.id}
              className="px-4 py-3 rounded-xl bg-white/15 border border-white/20 flex items-center gap-3"
            >
              <span className="w-8 h-8 rounded-lg bg-amber-400 text-[#082B52] font-black text-sm flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div
                  className={`${
                    isFullscreen ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
                  } font-extrabold text-white truncate`}
                  title={stu.fullName}
                >
                  {stu.fullName}
                </div>
                <div className="text-xs font-mono text-sky-200">Mã HS: {stu.code}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* MODE A: VÒNG QUAY */}
      {mode === 'wheel' && (
        <div className="flex flex-col items-center justify-center space-y-3 py-2">
          <div className="relative flex items-center justify-center">
            <canvas
              ref={wheelCanvasRef}
              aria-label="Vòng quay gọi tên học sinh"
              className="max-w-full"
            />
          </div>
          {wheelSlices.length > 15 && (
            <p className="text-xs font-semibold text-slate-500 text-center">
              Lớp có {wheelSlices.length} học sinh đang tham gia vòng quay — lát cắt tự động hiển thị{' '}
              {wheelSlices.length > 30 ? 'Số thứ tự (STT)' : 'Tên rút gọn'} để dễ quan sát, kết quả cuối hiện đầy đủ họ tên.
            </p>
          )}
          {onOpenClassicA01 && (
            <button
              type="button"
              onClick={onOpenClassicA01}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769F4] hover:underline cursor-pointer"
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Mở A01 – Vòng quay may mắn 3D gốc (kho trò chơi)</span>
            </button>
          )}
        </div>
      )}

      {/* MODE B: HỘP BỐC THĂM */}
      {mode === 'draw_box' && (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-[#DCE8F7] bg-[#082B52] aspect-video max-h-[340px] w-full mx-auto">
            {!imgFailed['draw_box'] ? (
              <img
                src={imgDrawBox3d}
                alt="Hộp bốc thăm lớp học"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed((prev) => ({ ...prev, draw_box: true }))}
                className={`w-full h-full object-cover ${
                  isAnimating && !reducedMotion ? 'scale-[1.03] transition-transform duration-500' : ''
                }`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <Gift className="w-16 h-16" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#061830]/90 via-[#061830]/35 to-transparent flex flex-col justify-end p-4 sm:p-5">
              {!activeTurn ? (
                <div className="text-center text-white space-y-1">
                  <div className="text-base sm:text-lg font-extrabold">
                    Hộp bốc thăm sẵn sàng ({remainingPool.length} phiếu tên)
                  </div>
                  <p className="text-xs text-sky-200">
                    Nhấn "Gọi ngay" để mở hộp và rút từng phiếu tên may mắn.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {activeTurn.pickedStudents.slice(0, boxRevealCount).map((stu, idx) => (
                    <div
                      key={stu.id}
                      className="p-3 rounded-xl bg-amber-50 border-2 border-amber-400 text-[#082B52] shadow-sm"
                    >
                      <div className="text-[11px] font-extrabold text-amber-700 uppercase">
                        Phiếu số {idx + 1} · Mã {stu.code}
                      </div>
                      <div className="text-base font-black truncate">{stu.fullName}</div>
                    </div>
                  ))}
                  {isAnimating && boxRevealCount < activeTurn.pickedStudents.length && (
                    <div className="p-3 rounded-xl bg-white/15 border border-white/25 text-white flex items-center gap-2 text-xs font-bold">
                      <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>Đang rút phiếu tiếp theo...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE C: MÁY XÈNG (Classroom theme image) */}
      {mode === 'slot_machine' && (
        <div className="relative rounded-2xl overflow-hidden border border-[#DCE8F7] bg-[#082B52] p-4 sm:p-6">
          {!imgFailed['slot'] && (
            <img
              src={imgSlotClassroom3d}
              alt="Nền lớp học Máy xèng"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed((prev) => ({ ...prev, slot: true }))}
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
          )}
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between text-white">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                Bảng quay tên lớp học thông minh
              </span>
              <span className="text-xs font-bold text-sky-200">
                {activeTurn ? `Gọi ${activeTurn.pickedStudents.length} em` : `Sẵn sàng gọi ${requestedK} em`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({
                length: activeTurn ? activeTurn.pickedStudents.length : Math.min(6, Math.max(1, requestedK)),
              }).map((_, reelIdx) => {
                const locked = activeTurn && reelIdx < slotLockedCount;
                const lockedStu = locked ? activeTurn.pickedStudents[reelIdx] : null;
                const poolRef = remainingPool.length > 0 ? remainingPool : eligiblePool;
                const rollingStu =
                  poolRef.length > 0
                    ? poolRef[(slotTick + reelIdx * 3) % poolRef.length]
                    : null;
                const shown = lockedStu || (isAnimating ? rollingStu : null);

                return (
                  <div
                    key={reelIdx}
                    className={`rounded-xl border-2 p-4 min-h-[96px] flex flex-col items-center justify-center text-center ${
                      locked
                        ? 'bg-white border-amber-400 text-[#082B52] shadow-md'
                        : 'bg-[#081C38]/90 border-sky-400/50 text-white'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1">
                      Ô số {reelIdx + 1}
                    </div>
                    {shown ? (
                      <>
                        <div className="text-base sm:text-lg font-black leading-tight break-words w-full">
                          {shown.fullName}
                        </div>
                        <div className="text-xs font-mono opacity-75 mt-0.5">Mã: {shown.code}</div>
                      </>
                    ) : (
                      <div className="text-sm font-bold text-sky-200">Chờ quay...</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODE D: LẬT THẺ BÍ ẨN (Keyboard navigable + clickable mystery cards) */}
      {mode === 'flip_cards' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span className="font-bold">
              Bấm trực tiếp thẻ bất kỳ hoặc dùng phím Mũi tên + Enter / Space để lật mở.
            </span>
            <span className="font-semibold text-[#1769F4]">
              Đã mở {flippedCardIndices.length}/{activeTurn?.pickedStudents.length || requestedK} thẻ
            </span>
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            role="group"
            aria-label="Bộ thẻ bí ẩn chọn học sinh"
          >
            {Array.from({ length: flipCardCount }).map((_, idx) => {
              const revealedPos = flippedCardIndices.indexOf(idx);
              const revealedStu =
                revealedPos >= 0 && activeTurn?.pickedStudents[revealedPos]
                  ? activeTurn.pickedStudents[revealedPos]
                  : null;
              const isFocused = focusedCardIdx === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleCardInteract(idx)}
                  onFocus={() => setFocusedCardIdx(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      setFocusedCardIdx((idx + 1) % flipCardCount);
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      setFocusedCardIdx((idx - 1 + flipCardCount) % flipCardCount);
                    } else if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardInteract(idx);
                    }
                  }}
                  className={`min-h-[116px] rounded-2xl border-2 p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    revealedStu
                      ? 'bg-emerald-50 border-emerald-500 text-[#082B52]'
                      : isFocused
                        ? 'bg-[#1769F4] border-amber-300 text-white ring-2 ring-amber-300'
                        : 'bg-[#082B52] hover:bg-[#0F3C78] border-[#1E406F] text-white'
                  }`}
                >
                  {revealedStu ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
                      <div className="text-sm sm:text-base font-extrabold leading-snug break-words w-full">
                        {revealedStu.fullName}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-700 mt-0.5">
                        Mã {revealedStu.code}
                      </div>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-6 h-6 text-amber-300 mb-1" />
                      <span className="text-xs font-extrabold">Thẻ bí mật #{idx + 1}</span>
                      <span className="text-[11px] text-sky-200">Nhấn để lật</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE E: LOẠI TRỪ DẦN */}
      {mode === 'elimination' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span className="font-bold">
              Ứng viên trên sân khấu: {remainingPool.length} · Sẽ giữ lại đúng{' '}
              {activeTurn?.pickedStudents.length || requestedK} người cuối cùng
            </span>
            {isAnimating && (
              <span className="font-extrabold text-[#1769F4]">
                Đã rời sân khấu: {eliminatedIds.length}
              </span>
            )}
          </div>

          {remainingPool.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs font-bold text-slate-500">
              Không còn ứng viên khả dụng trong vòng hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
              {remainingPool.map((stu) => {
                const isEliminated = eliminatedIds.includes(stu.id);
                const isWinner =
                  isRevealed &&
                  Boolean(activeTurn?.pickedStudents.some((p) => p.id === stu.id));

                return (
                  <div
                    key={stu.id}
                    className={`px-3 py-2.5 rounded-xl border text-xs transition-opacity ${
                      isWinner
                        ? 'bg-amber-100 border-amber-500 text-[#082B52] font-extrabold ring-2 ring-amber-300'
                        : isEliminated
                          ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-40 line-through'
                          : 'bg-white border-slate-200 text-[#082B52] font-bold'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{stu.fullName}</span>
                      {isEliminated && <UserX className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                    </div>
                    <div className="text-[11px] font-mono opacity-75">Mã {stu.code}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Common high-contrast winner reveal banner */}
      {renderWinnerBanner()}
    </div>
  );
};
