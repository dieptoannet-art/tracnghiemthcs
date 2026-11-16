import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { MathView } from '../../MathView';
import { MathGrade } from '../types';
import { Point2D } from '../mathEngine/mathVerificationEngine';
import {
  TransformationKind,
  TransformationParams,
  resolveReflectionLineEquation,
  transformPolygon2D,
} from '../mathEngine/transformationEngine';

interface M14ToolProps {
  grade: MathGrade;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  resetSignal: number;
}

type ShapePresetKey = 'TRIANGLE_ASYM' | 'L_SHAPE' | 'RECTANGLE' | 'HEX_PATTERN';

const SHAPE_PRESETS: Record<
  ShapePresetKey,
  { label: string; points: Point2D[]; vertexLabels: string[] }
> = {
  TRIANGLE_ASYM: {
    label: 'Tam giác ABC',
    points: [
      { x: 1, y: 2 },
      { x: 4, y: 1 },
      { x: 2, y: 5 },
    ],
    vertexLabels: ['A', 'B', 'C'],
  },
  L_SHAPE: {
    label: 'Hình chữ L (dễ thấy lật/quay)',
    points: [
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 5 },
      { x: 1, y: 5 },
    ],
    vertexLabels: ['A', 'B', 'C', 'D', 'E', 'F'],
  },
  RECTANGLE: {
    label: 'Hình chữ nhật đối xứng (Lớp 6)',
    points: [
      { x: -3, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: -2 },
      { x: -3, y: -2 },
    ],
    vertexLabels: ['A', 'B', 'C', 'D'],
  },
  HEX_PATTERN: {
    label: 'Cánh hoa lục giác (Hoa văn đối xứng)',
    points: [
      { x: 0, y: 0 },
      { x: 2, y: 1 },
      { x: 4, y: 0 },
      { x: 2, y: -1 },
    ],
    vertexLabels: ['O', 'P', 'Q', 'R'],
  },
};

const WORLD_MIN = -8;
const WORLD_MAX = 8;
const SVG_SIZE = 560;
const GRID_TICKS = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];

function worldToSvg(p: Point2D): { sx: number; sy: number } {
  const span = WORLD_MAX - WORLD_MIN;
  return {
    sx: ((p.x - WORLD_MIN) / span) * SVG_SIZE,
    sy: ((WORLD_MAX - p.y) / span) * SVG_SIZE,
  };
}

function svgToWorld(sx: number, sy: number, snap: boolean): Point2D {
  const span = WORLD_MAX - WORLD_MIN;
  let wx = WORLD_MIN + (sx / SVG_SIZE) * span;
  let wy = WORLD_MAX - (sy / SVG_SIZE) * span;
  if (snap) {
    wx = Math.round(wx * 2) / 2;
    wy = Math.round(wy * 2) / 2;
  } else {
    wx = Number(wx.toFixed(2));
    wy = Number(wy.toFixed(2));
  }
  return {
    x: Math.min(WORLD_MAX - 0.5, Math.max(WORLD_MIN + 0.5, wx)),
    y: Math.min(WORLD_MAX - 0.5, Math.max(WORLD_MIN + 0.5, wy)),
  };
}

export const M14TransformationTool: React.FC<M14ToolProps> = ({
  grade,
  isPresentationMode,
  isDarkTheme,
  resetSignal,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [presetKey, setPresetKey] = useState<ShapePresetKey>(
    grade === 6 ? 'RECTANGLE' : 'TRIANGLE_ASYM'
  );
  const [points, setPoints] = useState<Point2D[]>(
    SHAPE_PRESETS[grade === 6 ? 'RECTANGLE' : 'TRIANGLE_ASYM'].points
  );
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  const [kind, setKind] = useState<TransformationKind>(
    grade === 6 ? 'REFLECT_OX' : 'ROTATE'
  );
  const [dx, setDx] = useState<number>(3);
  const [dy, setDy] = useState<number>(-1);
  const [center, setCenter] = useState<Point2D>({ x: 0, y: 0 });
  const [angleDeg, setAngleDeg] = useState<number>(90);
  const [lineMode, setLineMode] = useState<'TWO_POINTS' | 'EQUATION'>('TWO_POINTS');
  const [lineP1, setLineP1] = useState<Point2D>({ x: -4, y: -4 });
  const [lineP2, setLineP2] = useState<Point2D>({ x: 4, y: 4 });
  const [lineEq, setLineEq] = useState<{ a: number; b: number; c: number }>({
    a: 1,
    b: -1,
    c: 0,
  });
  const [scaleK, setScaleK] = useState<number>(2);

  // Điều khiển hiển thị & hoạt ảnh từng bước
  const [progressT, setProgressT] = useState<number>(1);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [showCoords, setShowCoords] = useState<boolean>(true);
  const [showPatternCopies, setShowPatternCopies] = useState<boolean>(false);

  const applyShapePreset = (key: ShapePresetKey) => {
    setPresetKey(key);
    setPoints(SHAPE_PRESETS[key].points.map((p) => ({ ...p })));
  };

  useEffect(() => {
    const defaultShape: ShapePresetKey = grade === 6 ? 'RECTANGLE' : 'TRIANGLE_ASYM';
    setPresetKey(defaultShape);
    setPoints(SHAPE_PRESETS[defaultShape].points.map((p) => ({ ...p })));
    setKind(grade === 6 ? 'REFLECT_OX' : 'ROTATE');
    setDx(3);
    setDy(-1);
    setCenter({ x: 0, y: 0 });
    setAngleDeg(90);
    setLineMode('TWO_POINTS');
    setLineP1({ x: -4, y: -4 });
    setLineP2({ x: 4, y: 4 });
    setLineEq({ a: 1, b: -1, c: 0 });
    setScaleK(2);
    setProgressT(1);
    setIsAnimating(false);
    setShowPatternCopies(false);
  }, [resetSignal, grade]);

  // Hoạt ảnh từng bước t: 0 -> 1
  useEffect(() => {
    if (!isAnimating) return;
    const timer = window.setInterval(() => {
      setProgressT((prev) => {
        const next = Number((prev + 0.04).toFixed(2));
        if (next >= 1) {
          setIsAnimating(false);
          return 1;
        }
        return next;
      });
    }, 35);
    return () => window.clearInterval(timer);
  }, [isAnimating]);

  const params: TransformationParams = useMemo(
    () => ({
      kind,
      dx,
      dy,
      center,
      angleDeg,
      lineMode,
      lineP1,
      lineP2,
      lineEq,
      scaleK,
    }),
    [kind, dx, dy, center, angleDeg, lineMode, lineP1, lineP2, lineEq, scaleK]
  );

  const batchResult = useMemo(
    () => transformPolygon2D(points, params, progressT),
    [points, params, progressT]
  );

  const fullBatchResult = useMemo(
    () => transformPolygon2D(points, params, 1),
    [points, params]
  );

  // Hoa văn đối xứng quay lặp 60° (hoặc 90°) khi bật chế độ ghép hoa văn
  const rosetteCopies = useMemo(() => {
    if (!showPatternCopies) return [];
    return [60, 120, 180, 240, 300].map((deg) =>
      transformPolygon2D(points, { kind: 'ROTATE', center, angleDeg: deg }, 1).images
    );
  }, [showPatternCopies, points, center]);

  // Đường thẳng đối xứng kéo dài cắt khung [WORLD_MIN, WORLD_MAX]
  const reflectionLineSegment = useMemo(() => {
    if (kind !== 'REFLECT_LINE') return null;
    const line = resolveReflectionLineEquation(params);
    if (!line.valid) return null;
    const { a, b, c } = line;
    if (Math.abs(b) > Math.abs(a)) {
      const y1 = (-c - a * WORLD_MIN) / b;
      const y2 = (-c - a * WORLD_MAX) / b;
      return { p1: { x: WORLD_MIN, y: y1 }, p2: { x: WORLD_MAX, y: y2 } };
    }
    const x1 = (-c - b * WORLD_MIN) / a;
    const x2 = (-c - b * WORLD_MAX) / a;
    return { p1: { x: x1, y: WORLD_MIN }, p2: { x: x2, y: WORLD_MAX } };
  }, [kind, params]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingVertexIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * SVG_SIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * SVG_SIZE;
    const nextPt = svgToWorld(sx, sy, snapToGrid);
    setPoints((prev) => prev.map((p, idx) => (idx === draggingVertexIdx ? nextPt : p)));
  };

  const vertexLabels = SHAPE_PRESETS[presetKey].vertexLabels;

  const surfaceCls = isDarkTheme
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const subCardCls = isDarkTheme
    ? 'bg-slate-950/60 border-slate-800 text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  const inputCls = isDarkTheme
    ? 'bg-slate-800 border-slate-700 text-white'
    : 'bg-white border-slate-300 text-slate-900';

  const origSvgPoints = points
    .map((p) => {
      const s = worldToSvg(p);
      return `${s.sx},${s.sy}`;
    })
    .join(' ');

  const imgSvgPoints = batchResult.images
    .map((p) => {
      const s = worldToSvg(p);
      return `${s.sx},${s.sy}`;
    })
    .join(' ');

  const transformOptions: {
    id: TransformationKind;
    label: string;
    isExpanded: boolean;
  }[] = [
    { id: 'REFLECT_OX', label: 'Đối xứng trục Ox', isExpanded: false },
    { id: 'REFLECT_OY', label: 'Đối xứng trục Oy', isExpanded: false },
    { id: 'REFLECT_POINT', label: 'Đối xứng tâm', isExpanded: false },
    { id: 'REFLECT_LINE', label: 'Đối xứng đường bất kỳ', isExpanded: true },
    { id: 'TRANSLATE', label: 'Phép tịnh tiến', isExpanded: true },
    { id: 'ROTATE', label: 'Phép quay', isExpanded: true },
    { id: 'DILATION', label: 'Phép vị tự (k)', isExpanded: true },
  ];

  const originSvg = worldToSvg({ x: 0, y: 0 });

  return (
    <div className="space-y-4">
      {/* THANH CHỌN PHÉP BIẾN HÌNH & PHÂN BIỆT CHUẨN / MỞ RỘNG */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {transformOptions.map((opt) => {
            const active = kind === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setKind(opt.id);
                  setProgressT(1);
                  setIsAnimating(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  active
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : isDarkTheme
                      ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                }`}
              >
                <span>{opt.label}</span>
                {opt.isExpanded && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                      active
                        ? 'bg-amber-300 text-slate-950'
                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    Mở rộng
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setProgressT(0);
            setIsAnimating(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold cursor-pointer shadow-xs"
        >
          {isAnimating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isAnimating ? 'Đang chạy biến hình...' : 'Chạy hoạt ảnh từng bước'}</span>
        </button>
      </div>

      {/* KHÔNG GIAN CHÍNH: MẶT PHẲNG TỌA ĐỘ OXY + BẢNG ĐIỀU KHIỂN & BẤT BIẾN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* CỘT TRÁI (7 CỘT): MẶT PHẲNG TỌA ĐỘ TƯƠNG TÁC TỈ LỆ 1:1 */}
        <div className={`lg:col-span-7 rounded-2xl border p-4 space-y-3 ${surfaceCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-extrabold text-blue-600 dark:text-blue-400">
                <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
                Hình gốc (kéo đỉnh để đổi)
              </span>
              <span className="inline-flex items-center gap-1.5 font-extrabold text-orange-600 dark:text-orange-400">
                <span className="w-3 h-3 rounded-xs bg-orange-500 inline-block" />
                Hình ảnh ({Math.round(progressT * 100)}%)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTrails((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border font-bold inline-flex items-center gap-1 cursor-pointer ${
                  showTrails ? 'bg-indigo-600 text-white border-indigo-700' : subCardCls
                }`}
              >
                {showTrails ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>Quỹ đạo</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCoords((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border font-bold inline-flex items-center gap-1 cursor-pointer ${
                  showCoords ? 'bg-indigo-600 text-white border-indigo-700' : subCardCls
                }`}
              >
                <span>Tọa độ</span>
              </button>
              <button
                type="button"
                onClick={() => setSnapToGrid((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                  snapToGrid ? 'bg-teal-600 text-white border-teal-700' : subCardCls
                }`}
              >
                Bắt lưới 0.5
              </button>
              <button
                type="button"
                onClick={() => setShowPatternCopies((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border font-bold inline-flex items-center gap-1 cursor-pointer ${
                  showPatternCopies ? 'bg-purple-600 text-white border-purple-700' : subCardCls
                }`}
                title="Ghép hoa văn đối xứng quay lặp 60° (Mở rộng)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hoa văn</span>
              </button>
            </div>
          </div>

          {/* Khung SVG tỉ lệ vuông 1:1 (không làm méo hình học) */}
          <div className="w-full flex justify-center">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDraggingVertexIdx(null)}
              onPointerLeave={() => setDraggingVertexIdx(null)}
              className={`w-full max-w-[540px] aspect-square rounded-2xl border select-none touch-none ${
                isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
              }`}
              role="img"
              aria-label="Mặt phẳng tọa độ Oxy mô phỏng phép biến hình"
            >
              {/* Lưới đơn vị */}
              {GRID_TICKS.map((tick) => {
                const pos = worldToSvg({ x: tick, y: tick });
                const isAxis = tick === 0;
                return (
                  <g key={tick}>
                    <line
                      x1={pos.sx}
                      y1={0}
                      x2={pos.sx}
                      y2={SVG_SIZE}
                      stroke={
                        isAxis
                          ? isDarkTheme
                            ? '#94a3b8'
                            : '#334155'
                          : isDarkTheme
                            ? '#1e293b'
                            : '#e2e8f0'
                      }
                      strokeWidth={isAxis ? 2 : 1}
                    />
                    <line
                      x1={0}
                      y1={pos.sy}
                      x2={SVG_SIZE}
                      y2={pos.sy}
                      stroke={
                        isAxis
                          ? isDarkTheme
                            ? '#94a3b8'
                            : '#334155'
                          : isDarkTheme
                            ? '#1e293b'
                            : '#e2e8f0'
                      }
                      strokeWidth={isAxis ? 2 : 1}
                    />
                    {tick !== 0 && tick % 2 === 0 && (
                      <>
                        <text
                          x={pos.sx}
                          y={originSvg.sy + 14}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill={isDarkTheme ? '#94a3b8' : '#64748b'}
                        >
                          {tick}
                        </text>
                        <text
                          x={originSvg.sx - 8}
                          y={pos.sy + 3}
                          textAnchor="end"
                          fontSize="10"
                          fontWeight="700"
                          fill={isDarkTheme ? '#94a3b8' : '#64748b'}
                        >
                          {tick}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Nhãn trục Ox, Oy, O */}
              <text
                x={SVG_SIZE - 14}
                y={originSvg.sy - 8}
                fontSize="12"
                fontWeight="800"
                fill={isDarkTheme ? '#cbd5e1' : '#1e293b'}
              >
                x
              </text>
              <text
                x={originSvg.sx + 10}
                y={16}
                fontSize="12"
                fontWeight="800"
                fill={isDarkTheme ? '#cbd5e1' : '#1e293b'}
              >
                y
              </text>
              <text
                x={originSvg.sx - 10}
                y={originSvg.sy + 14}
                fontSize="11"
                fontWeight="800"
                fill={isDarkTheme ? '#cbd5e1' : '#1e293b'}
              >
                O
              </text>

              {/* Trục đối xứng nổi bật (Ox, Oy hoặc đường thẳng d) */}
              {kind === 'REFLECT_OX' && (
                <line
                  x1={0}
                  y1={originSvg.sy}
                  x2={SVG_SIZE}
                  y2={originSvg.sy}
                  stroke="#ef4444"
                  strokeWidth={3}
                  strokeDasharray="8 4"
                />
              )}
              {kind === 'REFLECT_OY' && (
                <line
                  x1={originSvg.sx}
                  y1={0}
                  x2={originSvg.sx}
                  y2={SVG_SIZE}
                  stroke="#ef4444"
                  strokeWidth={3}
                  strokeDasharray="8 4"
                />
              )}
              {kind === 'REFLECT_LINE' && reflectionLineSegment && (
                <line
                  x1={worldToSvg(reflectionLineSegment.p1).sx}
                  y1={worldToSvg(reflectionLineSegment.p1).sy}
                  x2={worldToSvg(reflectionLineSegment.p2).sx}
                  y2={worldToSvg(reflectionLineSegment.p2).sy}
                  stroke="#ef4444"
                  strokeWidth={3}
                  strokeDasharray="8 4"
                />
              )}

              {/* Hoa văn lặp (nếu bật) */}
              {rosetteCopies.map((poly, rIdx) => (
                <polygon
                  key={`rosette-${rIdx}`}
                  points={poly
                    .map((p) => {
                      const s = worldToSvg(p);
                      return `${s.sx},${s.sy}`;
                    })
                    .join(' ')}
                  fill="#a855f7"
                  fillOpacity={0.14}
                  stroke="#9333ea"
                  strokeWidth={1.5}
                />
              ))}

              {/* Quỹ đạo biến đổi (nếu bật) */}
              {showTrails &&
                batchResult.valid &&
                points.map((origPt, idx) => {
                  const sOrig = worldToSvg(origPt);
                  const sImg = worldToSvg(fullBatchResult.images[idx]);
                  if (kind === 'ROTATE') {
                    const sCenter = worldToSvg(center);
                    const rPx = Math.hypot(sOrig.sx - sCenter.sx, sOrig.sy - sCenter.sy);
                    return (
                      <g key={`trail-${idx}`}>
                        {rPx > 2 && (
                          <circle
                            cx={sCenter.sx}
                            cy={sCenter.sy}
                            r={rPx}
                            fill="none"
                            stroke="#6366f1"
                            strokeOpacity={0.35}
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                          />
                        )}
                      </g>
                    );
                  }
                  if (kind === 'DILATION') {
                    const sCenter = worldToSvg(center);
                    return (
                      <g key={`trail-${idx}`}>
                        <line
                          x1={sCenter.sx}
                          y1={sCenter.sy}
                          x2={sOrig.sx}
                          y2={sOrig.sy}
                          stroke="#8b5cf6"
                          strokeOpacity={0.45}
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                        />
                        <line
                          x1={sCenter.sx}
                          y1={sCenter.sy}
                          x2={sImg.sx}
                          y2={sImg.sy}
                          stroke="#8b5cf6"
                          strokeOpacity={0.45}
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                        />
                      </g>
                    );
                  }
                  return (
                    <line
                      key={`trail-${idx}`}
                      x1={sOrig.sx}
                      y1={sOrig.sy}
                      x2={sImg.sx}
                      y2={sImg.sy}
                      stroke="#6366f1"
                      strokeOpacity={0.45}
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                  );
                })}

              {/* Hình gốc */}
              <polygon
                points={origSvgPoints}
                fill="#2563eb"
                fillOpacity={0.2}
                stroke="#2563eb"
                strokeWidth={2.5}
              />

              {/* Hình ảnh (nếu hợp lệ) */}
              {batchResult.valid && (
                <polygon
                  points={imgSvgPoints}
                  fill="#f97316"
                  fillOpacity={0.25}
                  stroke="#ea580c"
                  strokeWidth={2.5}
                />
              )}

              {/* Tâm đối xứng / Tâm quay / Tâm vị tự */}
              {(kind === 'REFLECT_POINT' || kind === 'ROTATE' || kind === 'DILATION') && (
                <g>
                  <circle
                    cx={worldToSvg(center).sx}
                    cy={worldToSvg(center).sy}
                    r={6}
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <text
                    x={worldToSvg(center).sx + 9}
                    y={worldToSvg(center).sy - 7}
                    fontSize="12"
                    fontWeight="800"
                    fill="#ef4444"
                  >
                    {kind === 'REFLECT_POINT' ? 'I' : 'C'}
                    {showCoords ? `(${center.x};${center.y})` : ''}
                  </text>
                </g>
              )}

              {/* 2 điểm định hướng P1, P2 khi chọn đường thẳng qua 2 điểm */}
              {kind === 'REFLECT_LINE' && lineMode === 'TWO_POINTS' && (
                <>
                  {[
                    { pt: lineP1, lbl: 'P₁' },
                    { pt: lineP2, lbl: 'P₂' },
                  ].map((item) => {
                    const sp = worldToSvg(item.pt);
                    return (
                      <g key={item.lbl}>
                        <circle cx={sp.sx} cy={sp.sy} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
                        <text x={sp.sx + 7} y={sp.sy - 6} fontSize="11" fontWeight="800" fill="#dc2626">
                          {item.lbl}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}

              {/* Vectơ tịnh tiến minh họa */}
              {kind === 'TRANSLATE' && (
                <g>
                  <line
                    x1={originSvg.sx}
                    y1={originSvg.sy}
                    x2={worldToSvg({ x: dx, y: dy }).sx}
                    y2={worldToSvg({ x: dx, y: dy }).sy}
                    stroke="#10b981"
                    strokeWidth={3}
                  />
                  <circle
                    cx={worldToSvg({ x: dx, y: dy }).sx}
                    cy={worldToSvg({ x: dx, y: dy }).sy}
                    r={4.5}
                    fill="#10b981"
                  />
                </g>
              )}

              {/* Đỉnh hình ảnh */}
              {batchResult.valid &&
                batchResult.images.map((imgPt, idx) => {
                  const s = worldToSvg(imgPt);
                  const lbl = `${vertexLabels[idx] || `V${idx + 1}`}′`;
                  return (
                    <g key={`img-pt-${idx}`}>
                      <circle
                        cx={s.sx}
                        cy={s.sy}
                        r={5}
                        fill="#ea580c"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <text
                        x={s.sx + 8}
                        y={s.sy + 14}
                        fontSize={isPresentationMode ? '13' : '11'}
                        fontWeight="800"
                        fill={isDarkTheme ? '#fdba74' : '#c2410c'}
                      >
                        {lbl}
                        {showCoords ? `(${Number(imgPt.x.toFixed(1))};${Number(imgPt.y.toFixed(1))})` : ''}
                      </text>
                    </g>
                  );
                })}

              {/* Đỉnh hình gốc có thể kéo thả */}
              {points.map((pt, idx) => {
                const s = worldToSvg(pt);
                const lbl = vertexLabels[idx] || `V${idx + 1}`;
                return (
                  <g
                    key={`orig-pt-${idx}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingVertexIdx(idx);
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <circle
                      cx={s.sx}
                      cy={s.sy}
                      r={7}
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <text
                      x={s.sx + 8}
                      y={s.sy - 8}
                      fontSize={isPresentationMode ? '13' : '11'}
                      fontWeight="800"
                      fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                    >
                      {lbl}
                      {showCoords ? `(${pt.x};${pt.y})` : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* CỘT PHẢI (5 CỘT): THAM SỐ ĐIỀU KHIỂN, HOẠT ẢNH & BẢNG SO SÁNH BẤT BIẾN */}
        <div className="lg:col-span-5 space-y-4">
          {/* Chọn hình mẫu & Thanh tiến độ từng bước */}
          <div className={`rounded-2xl border p-4 space-y-3 ${surfaceCls}`}>
            <div className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              1. Chọn hình gốc & Hoạt ảnh từng bước
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(SHAPE_PRESETS) as ShapePresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyShapePreset(key)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold text-left truncate cursor-pointer ${
                    presetKey === key ? 'bg-blue-600 text-white border-blue-700' : subCardCls
                  }`}
                >
                  {SHAPE_PRESETS[key].label}
                </button>
              ))}
            </div>

            {/* Thanh kéo tiến độ biến đổi */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs font-bold">
                <span>Tiến độ biến hình t:</span>
                <span className="text-teal-600 dark:text-teal-400">
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
                aria-label="Thanh tiến độ hoạt ảnh biến hình"
                className="w-full accent-teal-600"
              />
            </div>

            {/* Điều khiển tham số riêng của từng phép biến hình */}
            <div className={`p-3 rounded-xl border space-y-2.5 text-xs ${subCardCls}`}>
              <div className="font-extrabold">2. Tham số phép biến hình:</div>

              {kind === 'TRANSLATE' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">dx = {dx}</label>
                    <input
                      type="number"
                      step={0.5}
                      value={dx}
                      onChange={(e) => setDx(Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-bold ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">dy = {dy}</label>
                    <input
                      type="number"
                      step={0.5}
                      value={dy}
                      onChange={(e) => setDy(Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-bold ${inputCls}`}
                    />
                  </div>
                </div>
              )}

              {(kind === 'REFLECT_POINT' || kind === 'ROTATE' || kind === 'DILATION') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">Tâm hoành độ cx:</label>
                    <input
                      type="number"
                      step={0.5}
                      value={center.x}
                      onChange={(e) => setCenter((c) => ({ ...c, x: Number(e.target.value) }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-bold ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Tâm tung độ cy:</label>
                    <input
                      type="number"
                      step={0.5}
                      value={center.y}
                      onChange={(e) => setCenter((c) => ({ ...c, y: Number(e.target.value) }))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-bold ${inputCls}`}
                    />
                  </div>
                </div>
              )}

              {kind === 'ROTATE' && (
                <div className="space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Góc quay θ:</span>
                    <span className="text-blue-600 dark:text-blue-400">{angleDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={-360}
                    max={360}
                    step={5}
                    value={angleDeg}
                    onChange={(e) => setAngleDeg(Number(e.target.value))}
                    aria-label="Thanh trượt góc quay"
                    className="w-full accent-blue-600"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[-90, 45, 90, 180, 270, 360].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setAngleDeg(deg)}
                        className={`px-2 py-1 rounded-md border text-[11px] font-bold cursor-pointer ${
                          angleDeg === deg
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {kind === 'DILATION' && (
                <div className="space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Tỉ số vị tự k:</span>
                    <span className="text-purple-600 dark:text-purple-400">{scaleK}</span>
                  </div>
                  <input
                    type="range"
                    min={-3}
                    max={3}
                    step={0.25}
                    value={scaleK}
                    onChange={(e) => setScaleK(Number(e.target.value))}
                    aria-label="Thanh trượt tỉ số vị tự"
                    className="w-full accent-purple-600"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[-2, -1, 0, 0.5, 1.5, 2].map((kv) => (
                      <button
                        key={kv}
                        type="button"
                        onClick={() => setScaleK(kv)}
                        className={`px-2 py-1 rounded-md border text-[11px] font-bold cursor-pointer ${
                          scaleK === kv
                            ? 'bg-purple-600 text-white border-purple-700'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        k={kv}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {kind === 'REFLECT_LINE' && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLineMode('TWO_POINTS')}
                      className={`flex-1 py-1 rounded-lg border font-bold cursor-pointer ${
                        lineMode === 'TWO_POINTS'
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Qua 2 điểm P₁, P₂
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineMode('EQUATION')}
                      className={`flex-1 py-1 rounded-lg border font-bold cursor-pointer ${
                        lineMode === 'EQUATION'
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      ax + by + c = 0
                    </button>
                  </div>

                  {lineMode === 'TWO_POINTS' ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <label className="text-[10px] font-bold">P₁.x</label>
                        <input
                          type="number"
                          value={lineP1.x}
                          onChange={(e) => setLineP1((p) => ({ ...p, x: Number(e.target.value) }))}
                          className={`w-full px-2 py-1 rounded border font-bold ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold">P₁.y</label>
                        <input
                          type="number"
                          value={lineP1.y}
                          onChange={(e) => setLineP1((p) => ({ ...p, y: Number(e.target.value) }))}
                          className={`w-full px-2 py-1 rounded border font-bold ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold">P₂.x</label>
                        <input
                          type="number"
                          value={lineP2.x}
                          onChange={(e) => setLineP2((p) => ({ ...p, x: Number(e.target.value) }))}
                          className={`w-full px-2 py-1 rounded border font-bold ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold">P₂.y</label>
                        <input
                          type="number"
                          value={lineP2.y}
                          onChange={(e) => setLineP2((p) => ({ ...p, y: Number(e.target.value) }))}
                          className={`w-full px-2 py-1 rounded border font-bold ${inputCls}`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="text-[10px] font-bold">Hệ số a</label>
                        <input
                          type="number"
                          value={lineEq.a}
                          onChange={(e) => setLineEq((q) => ({ ...q, a: Number(e.target.value) }))}
                          className={`w-full px-2 py-1 rounded border font-bold ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold">Hệ số b</label>
                        <input
                          type="number"
                          value={lineEq.b}
                          onChange={(e) => setLineEq((q) => ({ ...q, b: Number(e.target.value) }))}
                          className={`w-full px-2 py-1 rounded border font-bold ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold">Hệ số c</label>
                        <input
                          type="number"
                          value={lineEq.c}
                          onChange={(e) => setLineEq((q) => ({ ...q, c: Number(e.target.value) }))}
                          className={`w-full px-2 py-1 rounded border font-bold ${inputCls}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(kind === 'REFLECT_OX' || kind === 'REFLECT_OY') && (
                <p className="opacity-85">
                  Đang dùng trục chuẩn {kind === 'REFLECT_OX' ? 'hoành Ox (y = 0)' : 'tung Oy (x = 0)'}. Kéo thả các đỉnh hình xanh để quan sát đối xứng tức thời.
                </p>
              )}
            </div>

            {/* Công thức LaTeX biểu diễn phép biến hình */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs">
              <div className="font-bold mb-1">Biểu thức tọa độ:</div>
              <MathView content={`$${batchResult.summaryLatex}$`} />
            </div>

            {/* Cảnh báo đường suy biến hoặc phép vị tự */}
            {!batchResult.valid && batchResult.errorVi && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{batchResult.errorVi}</span>
              </div>
            )}
            {batchResult.warningVi && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{batchResult.warningVi}</span>
              </div>
            )}
          </div>

          {/* Bảng Kiểm chứng Bảo toàn Độ dài & Góc (So sánh Hình gốc vs Hình ảnh) */}
          {fullBatchResult.valid &&
            fullBatchResult.originalMetrics &&
            fullBatchResult.imageMetrics && (
              <div className={`rounded-2xl border p-4 space-y-2.5 text-xs ${surfaceCls}`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold">Kiểm chứng Độ dài & Góc (Gốc vs Ảnh)</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                      fullBatchResult.isIsometry
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {fullBatchResult.isIsometry ? 'Phép dời hình (Bảo toàn)' : 'Đổi kích thước |k|'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center font-semibold">
                  <div className={`p-2 rounded-xl border ${subCardCls}`}>
                    <div className="text-[10px] opacity-70">Cạnh AB / A′B′</div>
                    <div className="font-extrabold">
                      {fullBatchResult.originalMetrics.sideAB.toFixed(2)} /{' '}
                      {fullBatchResult.imageMetrics.sideAB.toFixed(2)}
                    </div>
                  </div>
                  <div className={`p-2 rounded-xl border ${subCardCls}`}>
                    <div className="text-[10px] opacity-70">Góc ∠B / ∠B′</div>
                    <div className="font-extrabold">
                      {fullBatchResult.originalMetrics.angleB.toFixed(1)}° /{' '}
                      {fullBatchResult.imageMetrics.angleB.toFixed(1)}°
                    </div>
                  </div>
                  <div className={`p-2 rounded-xl border ${subCardCls}`}>
                    <div className="text-[10px] opacity-70">Diện tích S / S′</div>
                    <div className="font-extrabold">
                      {fullBatchResult.originalMetrics.area.toFixed(2)} /{' '}
                      {fullBatchResult.imageMetrics.area.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] opacity-75">
                    Thay đổi tọa độ đỉnh đầu tiên (A) bằng bàn phím:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPoints((prev) =>
                          prev.map((p, i) => (i === 0 ? { ...p, x: p.x - 0.5 } : p))
                        )
                      }
                      className="px-2 py-0.5 rounded border font-bold cursor-pointer"
                    >
                      A.x−
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPoints((prev) =>
                          prev.map((p, i) => (i === 0 ? { ...p, x: p.x + 0.5 } : p))
                        )
                      }
                      className="px-2 py-0.5 rounded border font-bold cursor-pointer"
                    >
                      A.x+
                    </button>
                    <button
                      type="button"
                      onClick={() => applyShapePreset(presetKey)}
                      className="px-2 py-0.5 rounded border font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Khôi phục
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
