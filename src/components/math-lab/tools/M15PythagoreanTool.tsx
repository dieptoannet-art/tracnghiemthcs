import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Pause,
  Play,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  Triangle,
} from 'lucide-react';
import { MathView } from '../../MathView';
import { MathGrade } from '../types';
import { Point2D } from '../mathEngine/mathVerificationEngine';
import {
  buildFrameABDissection,
  buildPerigalDissection,
  buildPythagoreanGeometry,
  checkConversePythagorean,
  solveLegFromHypotenuse,
} from '../mathEngine/pythagoreanEngine';

interface M15ToolProps {
  grade: MathGrade;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  resetSignal: number;
}

type WorkspaceTab = 'SQUARES' | 'DISSECTION' | 'CONVERSE_APP';
type DissectionMethod = 'PERIGAL' | 'FRAME_AB';

const SVG_SIZE = 540;

const PIECE_COLORS: Record<
  'teal' | 'blue' | 'amber' | 'rose' | 'emerald' | 'slate',
  { fill: string; stroke: string }
> = {
  teal: { fill: '#0d9488', stroke: '#115e59' },
  blue: { fill: '#2563eb', stroke: '#1e40af' },
  amber: { fill: '#f59e0b', stroke: '#b45309' },
  rose: { fill: '#e11d48', stroke: '#9f1239' },
  emerald: { fill: '#10b981', stroke: '#065f46' },
  slate: { fill: '#64748b', stroke: '#334155' },
};

function computeUniformTransform(allPoints: Point2D[], paddingPx = 42) {
  if (allPoints.length === 0) {
    return {
      toSvg: (p: Point2D) => ({ sx: SVG_SIZE / 2 + p.x * 20, sy: SVG_SIZE / 2 - p.y * 20 }),
      scale: 20,
      minX: -10,
      minY: -10,
    };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = Math.max(2, maxX - minX);
  const spanY = Math.max(2, maxY - minY);
  const drawable = SVG_SIZE - paddingPx * 2;
  const scale = drawable / Math.max(spanX, spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    toSvg: (p: Point2D) => ({
      sx: SVG_SIZE / 2 + (p.x - cx) * scale,
      sy: SVG_SIZE / 2 - (p.y - cy) * scale,
    }),
    fromSvg: (sx: number, sy: number): Point2D => ({
      x: cx + (sx - SVG_SIZE / 2) / scale,
      y: cy - (sy - SVG_SIZE / 2) / scale,
    }),
    scale,
    minX,
    minY,
  };
}

function formatNum(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—';
  return Number(v.toFixed(digits)).toString();
}

export const M15PythagoreanTool: React.FC<M15ToolProps> = ({
  isPresentationMode,
  isDarkTheme,
  resetSignal,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [tab, setTab] = useState<WorkspaceTab>('SQUARES');
  const [legA, setLegA] = useState<number>(3);
  const [legB, setLegB] = useState<number>(4);
  const [snapHalf, setSnapHalf] = useState<boolean>(true);
  const [draggingHandle, setDraggingHandle] = useState<'B' | 'C' | null>(null);

  // Ghép hình chứng minh
  const [dissectionMethod, setDissectionMethod] = useState<DissectionMethod>('PERIGAL');
  const [progressT, setProgressT] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // Định lý đảo (3 cạnh)
  const [side1, setSide1] = useState<number>(3);
  const [side2, setSide2] = useState<number>(4);
  const [side3, setSide3] = useState<number>(5);

  // Tính cạnh chưa biết & Đường chéo hình chữ nhật
  const [knownA, setKnownA] = useState<number>(6);
  const [knownC, setKnownC] = useState<number>(10);

  useEffect(() => {
    setTab('SQUARES');
    setLegA(3);
    setLegB(4);
    setDissectionMethod('PERIGAL');
    setProgressT(0);
    setIsAnimating(false);
    setSide1(3);
    setSide2(4);
    setSide3(5);
    setKnownA(6);
    setKnownC(10);
  }, [resetSignal]);

  useEffect(() => {
    if (!isAnimating) return;
    const timer = window.setInterval(() => {
      setProgressT((prev) => {
        const next = Number((prev + 0.025).toFixed(3));
        if (next >= 1) {
          setIsAnimating(false);
          return 1;
        }
        return next;
      });
    }, 32);
    return () => window.clearInterval(timer);
  }, [isAnimating]);

  const geom = useMemo(() => buildPythagoreanGeometry(legA, legB), [legA, legB]);

  const squaresViewport = useMemo(() => {
    if (!geom.valid) {
      return computeUniformTransform([
        { x: -4, y: -4 },
        { x: 8, y: 8 },
      ]);
    }
    const pts = [...geom.squareA, ...geom.squareB, ...geom.squareC];
    return computeUniformTransform(pts, 46);
  }, [geom]);

  const dissectionStart = useMemo(
    () =>
      dissectionMethod === 'PERIGAL'
        ? buildPerigalDissection(legA, legB, 0)
        : buildFrameABDissection(legA, legB, 0),
    [dissectionMethod, legA, legB]
  );

  const dissectionEnd = useMemo(
    () =>
      dissectionMethod === 'PERIGAL'
        ? buildPerigalDissection(legA, legB, 1)
        : buildFrameABDissection(legA, legB, 1),
    [dissectionMethod, legA, legB]
  );

  const dissectionFrame = useMemo(
    () =>
      dissectionMethod === 'PERIGAL'
        ? buildPerigalDissection(legA, legB, progressT)
        : buildFrameABDissection(legA, legB, progressT),
    [dissectionMethod, legA, legB, progressT]
  );

  const dissectionViewport = useMemo(() => {
    const pts = [
      ...dissectionStart.targetOutline,
      ...dissectionStart.sourceOutlines.flatMap((o) => o.points),
      ...dissectionEnd.pieces.flatMap((p) => p.points),
    ];
    return computeUniformTransform(pts, 44);
  }, [dissectionStart, dissectionEnd]);

  const converseResult = useMemo(
    () => checkConversePythagorean(side1, side2, side3),
    [side1, side2, side3]
  );

  const unknownLegRes = useMemo(
    () => solveLegFromHypotenuse(knownA, knownC),
    [knownA, knownC]
  );

  // Vẽ tam giác cho Định lý đảo bằng định lý Cosin
  const converseTrianglePts = useMemo(() => {
    if (!converseResult.validTriangle) return null;
    const [x, y, z] = converseResult.sortedSides;
    // Đặt cạnh dài nhất z nằm ngang từ P(0,0) đến Q(z,0); đỉnh R đối diện cạnh z
    const cosR = (x * x + z * z - y * y) / (2 * x * z);
    const clampedCos = Math.min(1, Math.max(-1, cosR));
    const rx = x * clampedCos;
    const ry = x * Math.sqrt(Math.max(0, 1 - clampedCos * clampedCos));
    return [
      { x: 0, y: 0 },
      { x: z, y: 0 },
      { x: rx, y: ry },
    ];
  }, [converseResult]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingHandle || !svgRef.current || !squaresViewport.fromSvg) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * SVG_SIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * SVG_SIZE;
    const world = squaresViewport.fromSvg(sx, sy);

    const clampSide = (val: number) => {
      const clamped = Math.min(12, Math.max(1, val));
      return snapHalf ? Math.round(clamped * 2) / 2 : Number(clamped.toFixed(1));
    };

    if (draggingHandle === 'B') {
      setLegA(clampSide(world.x));
    } else if (draggingHandle === 'C') {
      setLegB(clampSide(world.y));
    }
  };

  const handleTriggerProofAnimation = () => {
    setTab('DISSECTION');
    setProgressT(0);
    setIsAnimating(true);
  };

  const surfaceCls = isDarkTheme
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const subCardCls = isDarkTheme
    ? 'bg-slate-950/60 border-slate-800 text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  const inputCls = isDarkTheme
    ? 'bg-slate-800 border-slate-700 text-white'
    : 'bg-white border-slate-300 text-slate-900';

  const polyToSvgString = (
    poly: Point2D[],
    toSvg: (p: Point2D) => { sx: number; sy: number }
  ) =>
    poly
      .map((p) => {
        const s = toSvg(p);
        return `${s.sx},${s.sy}`;
      })
      .join(' ');

  const centroidOf = (poly: Point2D[]): Point2D => {
    const n = poly.length || 1;
    const sum = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / n, y: sum.y / n };
  };

  return (
    <div className="space-y-4">
      {/* THANH CHUYỂN CHẾ ĐỘ CHỨC NĂNG */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTab('SQUARES');
              setIsAnimating(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
              tab === 'SQUARES'
                ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                : isDarkTheme
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Triangle className="w-3.5 h-3.5" />
            <span>3 Hình vuông động</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerProofAnimation}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
              tab === 'DISSECTION'
                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                : isDarkTheme
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ghép hình chứng minh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('CONVERSE_APP');
              setIsAnimating(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
              tab === 'CONVERSE_APP'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : isDarkTheme
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Kiểm tra định lý đảo</span>
          </button>
        </div>

        {/* Bộ ba Pythagore mẫu chọn nhanh */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold opacity-75">Bộ ba chuẩn:</span>
          {[
            { a: 3, b: 4, label: '3 – 4 – 5' },
            { a: 6, b: 8, label: '6 – 8 – 10' },
            { a: 5, b: 12, label: '5 – 12 – 13' },
            { a: 4, b: 4, label: '4 – 4 – √32' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setLegA(preset.a);
                setLegB(preset.b);
                if (tab === 'CONVERSE_APP') {
                  setSide1(preset.a);
                  setSide2(preset.b);
                  setSide3(Math.hypot(preset.a, preset.b));
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg border font-bold tabular-nums whitespace-nowrap cursor-pointer ${
                Math.abs(legA - preset.a) < 0.01 && Math.abs(legB - preset.b) < 0.01
                  ? 'bg-teal-600 text-white border-teal-700'
                  : subCardCls
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* KHÔNG GIAN CHÍNH: SÂN KHẤU TƯƠNG TÁC + BẢNG ĐIỀU KHIỂN & DIỆN TÍCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* CỘT TRÁI (7 CỘT): MÔ HÌNH HÌNH HỌC ĐỘNG / GHÉP MẢNH / ĐỊNH LÝ ĐẢO */}
        <div className={`lg:col-span-7 rounded-2xl border p-4 flex flex-col justify-between space-y-3 ${surfaceCls}`}>
          {tab === 'SQUARES' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold">
                  Tam giác vuông ABC (vuông tại A) · Kéo điểm B hoặc C để thay đổi kích thước
                </span>
                <button
                  type="button"
                  onClick={() => setSnapHalf((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                    snapHalf ? 'bg-teal-600 text-white border-teal-700' : subCardCls
                  }`}
                >
                  Bắt bước 0.5
                </button>
              </div>

              <div className="w-full flex justify-center">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                  onPointerMove={handlePointerMove}
                  onPointerUp={() => setDraggingHandle(null)}
                  onPointerLeave={() => setDraggingHandle(null)}
                  className={`w-full max-w-[530px] aspect-square rounded-2xl border select-none touch-none ${
                    isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
                  }`}
                  role="img"
                  aria-label="Mô hình tam giác vuông và ba hình vuông trên ba cạnh"
                >
                  {geom.valid && (
                    <>
                      {/* Hình vuông cạnh a */}
                      <polygon
                        points={polyToSvgString(geom.squareA, squaresViewport.toSvg)}
                        fill="#0d9488"
                        fillOpacity={0.22}
                        stroke="#0d9488"
                        strokeWidth={2}
                      />
                      <text
                        x={squaresViewport.toSvg(centroidOf(geom.squareA)).sx}
                        y={squaresViewport.toSvg(centroidOf(geom.squareA)).sy - 5}
                        textAnchor="middle"
                        fontSize={isPresentationMode ? '14' : '12'}
                        fontWeight="800"
                        fill={isDarkTheme ? '#5eead4' : '#0f766e'}
                      >
                        a² = {formatNum(geom.areaA)}
                      </text>
                      <text
                        x={squaresViewport.toSvg(centroidOf(geom.squareA)).sx}
                        y={squaresViewport.toSvg(centroidOf(geom.squareA)).sy + 12}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={isDarkTheme ? '#99f6e4' : '#115e59'}
                      >
                        (a = {formatNum(geom.a, 1)})
                      </text>

                      {/* Hình vuông cạnh b */}
                      <polygon
                        points={polyToSvgString(geom.squareB, squaresViewport.toSvg)}
                        fill="#f59e0b"
                        fillOpacity={0.22}
                        stroke="#d97706"
                        strokeWidth={2}
                      />
                      <text
                        x={squaresViewport.toSvg(centroidOf(geom.squareB)).sx}
                        y={squaresViewport.toSvg(centroidOf(geom.squareB)).sy - 5}
                        textAnchor="middle"
                        fontSize={isPresentationMode ? '14' : '12'}
                        fontWeight="800"
                        fill={isDarkTheme ? '#fcd34d' : '#b45309'}
                      >
                        b² = {formatNum(geom.areaB)}
                      </text>
                      <text
                        x={squaresViewport.toSvg(centroidOf(geom.squareB)).sx}
                        y={squaresViewport.toSvg(centroidOf(geom.squareB)).sy + 12}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={isDarkTheme ? '#fde68a' : '#92400e'}
                      >
                        (b = {formatNum(geom.b, 1)})
                      </text>

                      {/* Hình vuông cạnh huyền c */}
                      <polygon
                        points={polyToSvgString(geom.squareC, squaresViewport.toSvg)}
                        fill="#2563eb"
                        fillOpacity={0.2}
                        stroke="#2563eb"
                        strokeWidth={2.5}
                      />
                      <text
                        x={squaresViewport.toSvg(centroidOf(geom.squareC)).sx}
                        y={squaresViewport.toSvg(centroidOf(geom.squareC)).sy - 6}
                        textAnchor="middle"
                        fontSize={isPresentationMode ? '15' : '13'}
                        fontWeight="800"
                        fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                      >
                        c² = {formatNum(geom.areaC)}
                      </text>
                      <text
                        x={squaresViewport.toSvg(centroidOf(geom.squareC)).sx}
                        y={squaresViewport.toSvg(centroidOf(geom.squareC)).sy + 13}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={isDarkTheme ? '#bfdbfe' : '#1e40af'}
                      >
                        (c = {formatNum(geom.c, 2)})
                      </text>

                      {/* Ký hiệu góc vuông tại A(0, 0) */}
                      <polygon
                        points={polyToSvgString(
                          [
                            { x: 0, y: 0 },
                            { x: Math.min(0.45, legA * 0.2), y: 0 },
                            { x: Math.min(0.45, legA * 0.2), y: Math.min(0.45, legB * 0.2) },
                            { x: 0, y: Math.min(0.45, legB * 0.2) },
                          ],
                          squaresViewport.toSvg
                        )}
                        fill="#ef4444"
                        fillOpacity={0.25}
                        stroke="#ef4444"
                        strokeWidth={1.5}
                      />

                      {/* Tam giác vuông ABC */}
                      <polygon
                        points={polyToSvgString(
                          [geom.vertexA, geom.vertexB, geom.vertexC],
                          squaresViewport.toSvg
                        )}
                        fill={isDarkTheme ? '#1e293b' : '#ffffff'}
                        fillOpacity={0.92}
                        stroke={isDarkTheme ? '#e2e8f0' : '#0f172a'}
                        strokeWidth={2.5}
                      />

                      {/* Đỉnh A cố định */}
                      <circle
                        cx={squaresViewport.toSvg(geom.vertexA).sx}
                        cy={squaresViewport.toSvg(geom.vertexA).sy}
                        r={5}
                        fill="#ef4444"
                      />
                      <text
                        x={squaresViewport.toSvg(geom.vertexA).sx - 12}
                        y={squaresViewport.toSvg(geom.vertexA).sy + 15}
                        fontSize="13"
                        fontWeight="800"
                        fill="#ef4444"
                      >
                        A (90°)
                      </text>

                      {/* Đỉnh B kéo thả */}
                      <g
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDraggingHandle('B');
                        }}
                        className="cursor-ew-resize"
                      >
                        <circle
                          cx={squaresViewport.toSvg(geom.vertexB).sx}
                          cy={squaresViewport.toSvg(geom.vertexB).sy}
                          r={8}
                          fill="#0d9488"
                          stroke="#ffffff"
                          strokeWidth={2.5}
                        />
                        <text
                          x={squaresViewport.toSvg(geom.vertexB).sx + 10}
                          y={squaresViewport.toSvg(geom.vertexB).sy + 15}
                          fontSize="13"
                          fontWeight="800"
                          fill={isDarkTheme ? '#5eead4' : '#0f766e'}
                        >
                          B (kéo)
                        </text>
                      </g>

                      {/* Đỉnh C kéo thả */}
                      <g
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDraggingHandle('C');
                        }}
                        className="cursor-ns-resize"
                      >
                        <circle
                          cx={squaresViewport.toSvg(geom.vertexC).sx}
                          cy={squaresViewport.toSvg(geom.vertexC).sy}
                          r={8}
                          fill="#d97706"
                          stroke="#ffffff"
                          strokeWidth={2.5}
                        />
                        <text
                          x={squaresViewport.toSvg(geom.vertexC).sx - 10}
                          y={squaresViewport.toSvg(geom.vertexC).sy - 12}
                          textAnchor="end"
                          fontSize="13"
                          fontWeight="800"
                          fill={isDarkTheme ? '#fcd34d' : '#b45309'}
                        >
                          C (kéo)
                        </text>
                      </g>
                    </>
                  )}
                </svg>
              </div>
            </>
          )}

          {tab === 'DISSECTION' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDissectionMethod('PERIGAL');
                      setProgressT(0);
                      setIsAnimating(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                      dissectionMethod === 'PERIGAL'
                        ? 'bg-blue-600 text-white border-blue-700'
                        : subCardCls
                    }`}
                  >
                    Cắt ghép trực tiếp Perigal (5 mảnh)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDissectionMethod('FRAME_AB');
                      setProgressT(0);
                      setIsAnimating(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                      dissectionMethod === 'FRAME_AB'
                        ? 'bg-blue-600 text-white border-blue-700'
                        : subCardCls
                    }`}
                  >
                    Khung (a + b)² (4 tam giác)
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (progressT >= 1) setProgressT(0);
                      setIsAnimating((v) => !v);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                  >
                    {isAnimating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isAnimating ? 'Tạm dừng' : 'Chạy ghép'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAnimating(false);
                      setProgressT(0);
                    }}
                    className={`p-1.5 rounded-lg border cursor-pointer ${subCardCls}`}
                    title="Đặt lại trạng thái ban đầu"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="w-full flex justify-center">
                <svg
                  viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                  className={`w-full max-w-[530px] aspect-square rounded-2xl border select-none ${
                    isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
                  }`}
                  role="img"
                  aria-label="Mô hình ghép mảnh chứng minh định lý Pythagore bảo toàn diện tích"
                >
                  {/* Khung nguồn (a^2, b^2) hoặc đường dẫn tham chiếu */}
                  {dissectionMethod === 'PERIGAL' &&
                    dissectionStart.sourceOutlines.map((outline, idx) => (
                      <polygon
                        key={`src-${idx}`}
                        points={polyToSvgString(outline.points, dissectionViewport.toSvg)}
                        fill="none"
                        stroke={isDarkTheme ? '#475569' : '#94a3b8'}
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                      />
                    ))}

                  {/* Khung đích c^2 hoặc (a+b)^2 */}
                  <polygon
                    points={polyToSvgString(
                      dissectionFrame.targetOutline,
                      dissectionViewport.toSvg
                    )}
                    fill={dissectionMethod === 'FRAME_AB' ? '#2563eb' : 'none'}
                    fillOpacity={dissectionMethod === 'FRAME_AB' ? 0.08 : 0}
                    stroke={isDarkTheme ? '#60a5fa' : '#2563eb'}
                    strokeWidth={2.5}
                    strokeDasharray={dissectionMethod === 'PERIGAL' ? '6 4' : undefined}
                  />

                  {/* Các mảnh ghép hình học thật bảo toàn diện tích */}
                  {dissectionFrame.pieces.map((piece) => {
                    const col = PIECE_COLORS[piece.colorKey];
                    const ctr = dissectionViewport.toSvg(centroidOf(piece.points));
                    return (
                      <g key={piece.id}>
                        <polygon
                          points={polyToSvgString(piece.points, dissectionViewport.toSvg)}
                          fill={col.fill}
                          fillOpacity={0.78}
                          stroke={col.stroke}
                          strokeWidth={1.8}
                        />
                        <text
                          x={ctr.sx}
                          y={ctr.sy + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="800"
                          fill="#ffffff"
                        >
                          {formatNum(piece.area, 1)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Nhãn vùng trống trong Khung (a+b)^2 */}
                  {dissectionMethod === 'FRAME_AB' && progressT < 0.15 && (
                    <>
                      <text
                        x={
                          dissectionViewport.toSvg(
                            centroidOf(dissectionStart.sourceOutlines[0].points)
                          ).sx
                        }
                        y={
                          dissectionViewport.toSvg(
                            centroidOf(dissectionStart.sourceOutlines[0].points)
                          ).sy
                        }
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="800"
                        fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                      >
                        a² = {formatNum(legA * legA)}
                      </text>
                      <text
                        x={
                          dissectionViewport.toSvg(
                            centroidOf(dissectionStart.sourceOutlines[1].points)
                          ).sx
                        }
                        y={
                          dissectionViewport.toSvg(
                            centroidOf(dissectionStart.sourceOutlines[1].points)
                          ).sy
                        }
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="800"
                        fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                      >
                        b² = {formatNum(legB * legB)}
                      </text>
                    </>
                  )}
                  {dissectionMethod === 'FRAME_AB' && progressT > 0.85 && (
                    <text
                      x={
                        dissectionViewport.toSvg(
                          centroidOf(dissectionEnd.sourceOutlines[2].points)
                        ).sx
                      }
                      y={
                        dissectionViewport.toSvg(
                          centroidOf(dissectionEnd.sourceOutlines[2].points)
                        ).sy
                      }
                      textAnchor="middle"
                      fontSize="15"
                      fontWeight="800"
                      fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                    >
                      c² = {formatNum(legA * legA + legB * legB)}
                    </text>
                  )}

                  {dissectionMethod === 'PERIGAL' && (
                    <text
                      x={
                        dissectionViewport.toSvg(centroidOf(dissectionFrame.targetOutline)).sx
                      }
                      y={
                        dissectionViewport.toSvg(centroidOf(dissectionFrame.targetOutline)).sy -
                        dissectionViewport.scale * (Math.hypot(legA, legB) * 0.52)
                      }
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="800"
                      fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                    >
                      Hình vuông cạnh c (c² = {formatNum(legA * legA + legB * legB)})
                    </text>
                  )}
                </svg>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Tiến độ ghép mảnh chứng minh:</span>
                  <span className="tabular-nums text-blue-600 dark:text-blue-400">
                    {Math.round(progressT * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={progressT}
                  onChange={(e) => {
                    setIsAnimating(false);
                    setProgressT(Number(e.target.value));
                  }}
                  aria-label="Thanh trượt tiến độ ghép hình chứng minh"
                  className="w-full accent-blue-600"
                />
              </div>
            </>
          )}

          {tab === 'CONVERSE_APP' && (
            <div className="space-y-4">
              {/* PHẦN 1: KIỂM TRA ĐỊNH LÝ PYTHAGORE ĐẢO */}
              <div className={`p-4 rounded-xl border space-y-3 ${subCardCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-extrabold">
                    Kiểm tra Định lý Pythagore đảo (x² + y² = z²)
                  </span>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {[
                      [3, 4, 5],
                      [5, 12, 13],
                      [2, 3, 4],
                      [1, 2, 10],
                    ].map(([s1, s2, s3]) => (
                      <button
                        key={`${s1}-${s2}-${s3}`}
                        type="button"
                        onClick={() => {
                          setSide1(s1);
                          setSide2(s2);
                          setSide3(s3);
                        }}
                        className="px-2 py-1 rounded-md border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 font-bold tabular-nums cursor-pointer"
                      >
                        ({s1}; {s2}; {s3})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block font-bold mb-1">Cạnh 1:</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={side1}
                      onChange={(e) => setSide1(Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Cạnh 2:</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={side2}
                      onChange={(e) => setSide2(Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Cạnh 3:</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={side3}
                      onChange={(e) => setSide3(Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                    />
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                    converseResult.isRightTriangle
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                      : converseResult.validTriangle
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {converseResult.isRightTriangle ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{converseResult.messageVi}</span>
                </div>

                {converseTrianglePts && (
                  <div className="w-full flex justify-center">
                    <svg
                      viewBox="0 0 420 220"
                      className={`w-full max-w-[420px] h-[200px] rounded-xl border ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      {(() => {
                        let maxX = -Infinity;
                        let maxY = -Infinity;
                        for (const p of converseTrianglePts) {
                          if (p.x > maxX) maxX = p.x;
                          if (p.y > maxY) maxY = p.y;
                        }
                        const s = Math.min(340 / Math.max(1, maxX), 150 / Math.max(1, maxY));
                        const ox = 40;
                        const oy = 185;
                        const toLocal = (p: Point2D) => ({
                          sx: ox + p.x * s,
                          sy: oy - p.y * s,
                        });
                        const [p0, p1, p2] = converseTrianglePts.map(toLocal);
                        return (
                          <>
                            <polygon
                              points={`${p0.sx},${p0.sy} ${p1.sx},${p1.sy} ${p2.sx},${p2.sy}`}
                              fill={converseResult.isRightTriangle ? '#10b981' : '#f59e0b'}
                              fillOpacity={0.2}
                              stroke={converseResult.isRightTriangle ? '#059669' : '#d97706'}
                              strokeWidth={2.5}
                            />
                            <text
                              x={(p0.sx + p1.sx) / 2}
                              y={oy + 16}
                              textAnchor="middle"
                              fontSize="11"
                              fontWeight="800"
                              fill={isDarkTheme ? '#e2e8f0' : '#0f172a'}
                            >
                              z = {converseResult.sortedSides[2]}
                            </text>
                            <text
                              x={(p0.sx + p2.sx) / 2 - 12}
                              y={(p0.sy + p2.sy) / 2}
                              textAnchor="end"
                              fontSize="11"
                              fontWeight="800"
                              fill={isDarkTheme ? '#e2e8f0' : '#0f172a'}
                            >
                              x = {converseResult.sortedSides[0]}
                            </text>
                            <text
                              x={(p1.sx + p2.sx) / 2 + 12}
                              y={(p1.sy + p2.sy) / 2}
                              textAnchor="start"
                              fontSize="11"
                              fontWeight="800"
                              fill={isDarkTheme ? '#e2e8f0' : '#0f172a'}
                            >
                              y = {converseResult.sortedSides[1]}
                            </text>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </div>

              {/* PHẦN 2: ỨNG DỤNG ĐƯỜNG CHÉO HÌNH CHỮ NHẬT */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${subCardCls}`}>
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <RectangleHorizontal className="w-4 h-4 text-teal-600" />
                  <span>Ứng dụng: Đường chéo hình chữ nhật kích thước a × b</span>
                </div>
                <p className="text-xs opacity-85">
                  Đang dùng chiều dài <strong>a = {formatNum(legA, 1)}</strong> và chiều rộng{' '}
                  <strong>b = {formatNum(legB, 1)}</strong>. Đường chéo chia hình chữ nhật thành 2 tam giác vuông nên độ dài đường chéo{' '}
                  <strong className="tabular-nums">
                    d = √({formatNum(legA, 1)}² + {formatNum(legB, 1)}²) = {formatNum(geom.c, 3)}
                  </strong>.
                </p>
                <svg
                  viewBox="0 0 360 150"
                  className={`w-full max-w-[360px] h-[140px] rounded-xl border mx-auto block ${
                    isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  {(() => {
                    const rw = Math.min(240, Math.max(60, legA * 22));
                    const rh = Math.min(100, Math.max(40, legB * 14));
                    const rx = (360 - rw) / 2;
                    const ry = (150 - rh) / 2;
                    return (
                      <>
                        <rect
                          x={rx}
                          y={ry}
                          width={rw}
                          height={rh}
                          fill="#0d9488"
                          fillOpacity={0.14}
                          stroke="#0d9488"
                          strokeWidth={2}
                        />
                        <line
                          x1={rx}
                          y1={ry + rh}
                          x2={rx + rw}
                          y2={ry}
                          stroke="#2563eb"
                          strokeWidth={2.5}
                        />
                        <text
                          x={rx + rw / 2}
                          y={ry + rh + 14}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="800"
                          fill="#0f766e"
                        >
                          a = {formatNum(legA, 1)}
                        </text>
                        <text
                          x={rx - 8}
                          y={ry + rh / 2 + 4}
                          textAnchor="end"
                          fontSize="11"
                          fontWeight="800"
                          fill="#b45309"
                        >
                          b = {formatNum(legB, 1)}
                        </text>
                        <text
                          x={rx + rw / 2}
                          y={ry + rh / 2 - 6}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="800"
                          fill="#1d4ed8"
                        >
                          d = {formatNum(geom.c, 2)}
                        </text>
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI (5 CỘT): THANH ĐIỀU KHIỂN a, b, BẢNG DIỆN TÍCH, CÔNG THỨC ĐỒNG BỘ & TÌM CẠNH */}
        <div className="lg:col-span-5 space-y-4">
          {/* Điều chỉnh hai cạnh góc vuông a, b */}
          <div className={`rounded-2xl border p-4 space-y-3 ${surfaceCls}`}>
            <div className="text-xs font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              1. Thanh điều chỉnh hai cạnh góc vuông a, b
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span>Cạnh góc vuông a (AB):</span>
                  <span className="tabular-nums text-teal-600 dark:text-teal-400">
                    a = {formatNum(legA, 1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={0.5}
                  value={legA}
                  onChange={(e) => setLegA(Number(e.target.value))}
                  aria-label="Thanh trượt cạnh góc vuông a"
                  className="w-full accent-teal-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span>Cạnh góc vuông b (AC):</span>
                  <span className="tabular-nums text-amber-600 dark:text-amber-400">
                    b = {formatNum(legB, 1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={0.5}
                  value={legB}
                  onChange={(e) => setLegB(Number(e.target.value))}
                  aria-label="Thanh trượt cạnh góc vuông b"
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            {/* Công thức LaTeX đồng bộ thời gian thực */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs space-y-1">
              <div className="font-bold">Công thức đồng bộ:</div>
              <MathView
                content={`$c^2 = a^2 + b^2 \\Rightarrow ${formatNum(legA, 1)}^2 + ${formatNum(
                  legB,
                  1
                )}^2 = ${formatNum(geom.areaA)} + ${formatNum(geom.areaB)} = ${formatNum(
                  geom.areaC
                )}$`}
              />
              <MathView
                content={`$c = \\sqrt{${formatNum(geom.areaC)}} \\approx ${formatNum(
                  geom.c,
                  4
                )}$`}
              />
            </div>
          </div>

          {/* Bảng diện tích 3 hình vuông & Kiểm chứng bảo toàn */}
          <div className={`rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
            <div className="flex items-center justify-between">
              <span className="font-extrabold">2. Bảng Diện tích 3 Hình vuông</span>
              <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>a² + b² = c²</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse tabular-nums">
                <thead>
                  <tr className={subCardCls}>
                    <th className="p-2 border border-slate-200 dark:border-slate-700 text-left">
                      Hình vuông trên cạnh
                    </th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700 text-right">
                      Độ dài cạnh
                    </th>
                    <th className="p-2 border border-slate-200 dark:border-slate-700 text-right">
                      Diện tích
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold text-teal-700 dark:text-teal-300">
                      Cạnh góc vuông a
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-semibold">
                      {formatNum(geom.a, 2)}
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-extrabold">
                      {formatNum(geom.areaA, 2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold text-amber-700 dark:text-amber-300">
                      Cạnh góc vuông b
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-semibold">
                      {formatNum(geom.b, 2)}
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-extrabold">
                      {formatNum(geom.areaB, 2)}
                    </td>
                  </tr>
                  <tr className="bg-blue-500/10">
                    <td className="p-2 border border-slate-200 dark:border-slate-700 font-extrabold text-blue-700 dark:text-blue-300">
                      Cạnh huyền c (a² + b²)
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-bold">
                      {formatNum(geom.c, 3)}
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-extrabold text-blue-700 dark:text-blue-300">
                      {formatNum(geom.areaC, 2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {tab === 'DISSECTION' && (
              <div className={`p-2.5 rounded-xl border space-y-1 ${subCardCls}`}>
                <div className="flex justify-between font-bold">
                  <span>Kiểm chứng tổng diện tích mảnh ghép:</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatNum(dissectionFrame.totalPieceArea, 2)} ={' '}
                    {formatNum(dissectionFrame.expectedSquareCArea, 2)}
                  </span>
                </div>
                <p className="text-[11px] opacity-80">
                  {dissectionMethod === 'PERIGAL'
                    ? '5 mảnh (4 tứ giác từ hình vuông lớn + 1 hình vuông nhỏ) giữ nguyên hình dạng và tổng diện tích khi tịnh tiến lấp đầy hình vuông c².'
                    : 'Trong khung (a + b)², 4 tam giác vuông giữ nguyên diện tích 2ab nên phần diện tích trống a² + b² luôn bằng đúng c².'}
                </p>
              </div>
            )}
          </div>

          {/* Tính cạnh góc vuông chưa biết khi biết c và a */}
          <div className={`rounded-2xl border p-4 space-y-2.5 text-xs ${surfaceCls}`}>
            <div className="font-extrabold">
              3. Tìm cạnh góc vuông chưa biết: b = √(c² − a²)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold mb-1">Cạnh góc vuông a:</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={knownA}
                  onChange={(e) => setKnownA(Number(e.target.value))}
                  className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Cạnh huyền c (c &gt; a):</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={knownC}
                  onChange={(e) => setKnownC(Number(e.target.value))}
                  className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                />
              </div>
            </div>

            {unknownLegRes.valid ? (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-between">
                <span>
                  b = √({knownC}² − {knownA}²) ={' '}
                  <span className="tabular-nums">{formatNum(unknownLegRes.unknownLeg, 4)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLegA(knownA);
                    setLegB(Number(unknownLegRes.unknownLeg.toFixed(2)));
                  }}
                  className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                >
                  Đưa lên hình
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-700 dark:text-rose-300 font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{unknownLegRes.errorVi}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
