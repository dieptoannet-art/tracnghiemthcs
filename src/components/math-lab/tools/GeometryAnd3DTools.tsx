import React, { useEffect, useState } from 'react';
import {
  Box,
  Compass,
  Eye,
  Layers,
  Move,
  RefreshCw,
  Ruler,
  Save,
  Sparkles,
  Triangle,
} from 'lucide-react';
import { MathView } from '../../MathView';
import {
  Point2D,
  Solid3DType,
  angleDegreesABC,
  computeSolid3DMetrics,
  distance2D,
  midpoint2D,
  polygonArea2D,
} from '../mathEngine/mathVerificationEngine';
import { MathGrade } from '../types';
import { loadSavedMathConstructions, saveMathConstruction } from '../adapters/mathLabAdapters';

interface ToolCommonProps {
  grade: MathGrade;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  resetSignal: number;
}

interface DraggableVertex extends Point2D {
  id: string;
  label: string;
}

// ============================================================================
// M01 – HÌNH HỌC PHẲNG ĐỘNG 2D (DYNAMIC GEOMETRY STUDIO)
// ============================================================================

type GeometryPreset = 'TRIANGLE_SUM' | 'MIDSEGMENT' | 'RIGHT_CIRCLE' | 'QUADRILATERAL';

export const M01DynamicGeometryTool: React.FC<ToolCommonProps> = ({
  grade,
  isPresentationMode,
  isDarkTheme,
  resetSignal,
}) => {
  const [preset, setPreset] = useState<GeometryPreset>(
    grade === 9 ? 'RIGHT_CIRCLE' : grade === 8 ? 'MIDSEGMENT' : 'TRIANGLE_SUM'
  );
  const [points, setPoints] = useState<DraggableVertex[]>([
    { id: 'A', label: 'A', x: 0, y: 3 },
    { id: 'B', label: 'B', x: -4, y: -2 },
    { id: 'C', label: 'C', x: 4, y: -2 },
    { id: 'D', label: 'D', x: 3, y: 2 },
  ]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showMidsegment, setShowMidsegment] = useState<boolean>(true);
  const [showCircle, setShowCircle] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string>('');

  const applyPreset = (p: GeometryPreset) => {
    setPreset(p);
    if (p === 'TRIANGLE_SUM') {
      setPoints([
        { id: 'A', label: 'A', x: 0, y: 3 },
        { id: 'B', label: 'B', x: -4, y: -2 },
        { id: 'C', label: 'C', x: 4, y: -2 },
        { id: 'D', label: 'D', x: 3, y: 2 },
      ]);
      setShowMidsegment(false);
      setShowCircle(false);
    } else if (p === 'MIDSEGMENT') {
      setPoints([
        { id: 'A', label: 'A', x: -1, y: 3.5 },
        { id: 'B', label: 'B', x: -4.5, y: -2.5 },
        { id: 'C', label: 'C', x: 3.5, y: -2.5 },
        { id: 'D', label: 'D', x: 3, y: 2 },
      ]);
      setShowMidsegment(true);
      setShowCircle(false);
    } else if (p === 'RIGHT_CIRCLE') {
      setPoints([
        { id: 'A', label: 'A', x: 2, y: 3.46 },
        { id: 'B', label: 'B', x: -4, y: 0 },
        { id: 'C', label: 'C', x: 4, y: 0 },
        { id: 'D', label: 'D', x: 0, y: -4 },
      ]);
      setShowCircle(true);
      setShowMidsegment(false);
    } else {
      setPoints([
        { id: 'A', label: 'A', x: -3, y: 2 },
        { id: 'B', label: 'B', x: 3, y: 2 },
        { id: 'C', label: 'C', x: 4, y: -2 },
        { id: 'D', label: 'D', x: -2, y: -2 },
      ]);
      setShowMidsegment(false);
      setShowCircle(false);
    }
  };

  useEffect(() => {
    applyPreset(grade === 9 ? 'RIGHT_CIRCLE' : grade === 8 ? 'MIDSEGMENT' : 'TRIANGLE_SUM');
  }, [resetSignal, grade]);

  const ptA = points[0];
  const ptB = points[1];
  const ptC = points[2];
  const ptD = points[3];

  const lenAB = Number(distance2D(ptA, ptB).toFixed(2));
  const lenBC = Number(distance2D(ptB, ptC).toFixed(2));
  const lenCA = Number(distance2D(ptC, ptA).toFixed(2));

  const angleA = Number(angleDegreesABC(ptB, ptA, ptC).toFixed(1));
  const angleB = Number(angleDegreesABC(ptA, ptB, ptC).toFixed(1));
  const angleC = Number(angleDegreesABC(ptA, ptC, ptB).toFixed(1));
  const sumAngles = Number((angleA + angleB + angleC).toFixed(1));

  const midM = midpoint2D(ptA, ptB);
  const midN = midpoint2D(ptA, ptC);
  const lenMN = Number(distance2D(midM, midN).toFixed(2));
  const midO = midpoint2D(ptB, ptC);
  const radiusBC = lenBC / 2;

  const activePoly = preset === 'QUADRILATERAL' ? [ptA, ptB, ptC, ptD] : [ptA, ptB, ptC];
  const area = Number(polygonArea2D(activePoly).toFixed(2));
  const perimeter =
    preset === 'QUADRILATERAL'
      ? Number(
          (
            distance2D(ptA, ptB) +
            distance2D(ptB, ptC) +
            distance2D(ptC, ptD) +
            distance2D(ptD, ptA)
          ).toFixed(2)
        )
      : Number((lenAB + lenBC + lenCA).toFixed(2));

  const toSvgX = (x: number) => 300 + x * 42;
  const toSvgY = (y: number) => 200 - y * 42;
  const fromSvgX = (px: number) => {
    const raw = (px - 300) / 42;
    const clamped = Math.max(-6.5, Math.min(6.5, raw));
    return snapToGrid ? Math.round(clamped * 2) / 2 : Number(clamped.toFixed(2));
  };
  const fromSvgY = (py: number) => {
    const raw = (200 - py) / 42;
    const clamped = Math.max(-4.2, Math.min(4.2, raw));
    return snapToGrid ? Math.round(clamped * 2) / 2 : Number(clamped.toFixed(2));
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = 600 / rect.width;
    const scaleY = 400 / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    let nx = fromSvgX(px);
    let ny = fromSvgY(py);

    if (preset === 'RIGHT_CIRCLE' && draggingId === 'A' && radiusBC > 0.2) {
      const dx = nx - midO.x;
      const dy = ny - midO.y;
      const len = Math.hypot(dx, dy) || 1;
      nx = Number((midO.x + (dx / len) * radiusBC).toFixed(2));
      ny = Number((midO.y + (dy / len) * radiusBC).toFixed(2));
    }

    setPoints((prev) =>
      prev.map((p) => (p.id === draggingId ? { ...p, x: nx, y: ny } : p))
    );
  };

  const handleSaveConstruction = () => {
    saveMathConstruction({
      id: `m01-const-${Date.now()}`,
      toolId: 'M01',
      title: `Hình học ${preset} (${new Date().toLocaleTimeString('vi-VN')})`,
      grade,
      payload: { preset, points, showMidsegment, showCircle },
      updatedAt: new Date().toISOString(),
    });
    setSavedNotice('Đã lưu cấu hình hình học vào bộ nhớ trình duyệt!');
    setTimeout(() => setSavedNotice(''), 2500);
  };

  const handleLoadLastConstruction = () => {
    const list = loadSavedMathConstructions('M01');
    if (list.length > 0) {
      const latest = list[0].payload as {
        preset?: GeometryPreset;
        points?: DraggableVertex[];
        showMidsegment?: boolean;
        showCircle?: boolean;
      };
      if (latest.preset) setPreset(latest.preset);
      if (Array.isArray(latest.points) && latest.points.length === 4) {
        setPoints(latest.points);
      }
      if (typeof latest.showMidsegment === 'boolean') setShowMidsegment(latest.showMidsegment);
      if (typeof latest.showCircle === 'boolean') setShowCircle(latest.showCircle);
      setSavedNotice('Đã khôi phục hình vẽ gần nhất!');
      setTimeout(() => setSavedNotice(''), 2500);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${
          isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'TRIANGLE_SUM', label: 'Tam giác & Tổng 3 góc (Lớp 7)' },
              { id: 'MIDSEGMENT', label: 'Đường trung bình MN (Lớp 8)' },
              { id: 'RIGHT_CIRCLE', label: 'Góc nội tiếp chắn nửa đường tròn (Lớp 9)' },
              { id: 'QUADRILATERAL', label: 'Tứ giác & Chu vi, Diện tích (Lớp 6–8)' },
            ] as { id: GeometryPreset; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                preset === item.id
                  ? 'bg-teal-600 text-white shadow-xs'
                  : isDarkTheme
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              className="rounded text-teal-600"
            />
            <span>Bắt dính lưới (0.5)</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={showMidsegment}
              onChange={(e) => setShowMidsegment(e.target.checked)}
              className="rounded text-teal-600"
            />
            <span>Đường trung bình MN</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={showCircle}
              onChange={(e) => setShowCircle(e.target.checked)}
              className="rounded text-teal-600"
            />
            <span>Đường tròn đk BC</span>
          </label>

          <button
            type="button"
            onClick={handleSaveConstruction}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600/15 text-teal-700 dark:text-teal-300 font-bold"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu hình</span>
          </button>
          <button
            type="button"
            onClick={handleLoadLastConstruction}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Mở lại</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
          {savedNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div
          className={`lg:col-span-8 rounded-2xl border overflow-hidden relative ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5" />
              Kéo thả trực tiếp các đỉnh A, B, C {preset === 'QUADRILATERAL' ? ', D' : ''} trên mặt phẳng tọa độ
            </span>
            <span className="font-mono text-slate-500">
              A({ptA.x}; {ptA.y}) • B({ptB.x}; {ptB.y}) • C({ptC.x}; {ptC.y})
            </span>
          </div>

          <svg
            viewBox="0 0 600 400"
            className="w-full h-[340px] sm:h-[420px] touch-none select-none cursor-crosshair"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={() => setDraggingId(null)}
            onPointerLeave={() => setDraggingId(null)}
          >
            {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((gx) => (
              <g key={`gx-${gx}`}>
                <line
                  x1={toSvgX(gx)}
                  y1={0}
                  x2={toSvgX(gx)}
                  y2={400}
                  stroke={
                    gx === 0
                      ? isDarkTheme
                        ? '#64748b'
                        : '#475569'
                      : isDarkTheme
                      ? '#1e293b'
                      : '#e2e8f0'
                  }
                  strokeWidth={gx === 0 ? 1.8 : 1}
                />
                {gx !== 0 && (
                  <text
                    x={toSvgX(gx) - 4}
                    y={214}
                    fontSize="9"
                    fill={isDarkTheme ? '#64748b' : '#94a3b8'}
                  >
                    {gx}
                  </text>
                )}
              </g>
            ))}
            {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((gy) => (
              <g key={`gy-${gy}`}>
                <line
                  x1={0}
                  y1={toSvgY(gy)}
                  x2={600}
                  y2={toSvgY(gy)}
                  stroke={
                    gy === 0
                      ? isDarkTheme
                        ? '#64748b'
                        : '#475569'
                      : isDarkTheme
                      ? '#1e293b'
                      : '#e2e8f0'
                  }
                  strokeWidth={gy === 0 ? 1.8 : 1}
                />
                {gy !== 0 && (
                  <text
                    x={305}
                    y={toSvgY(gy) + 3}
                    fontSize="9"
                    fill={isDarkTheme ? '#64748b' : '#94a3b8'}
                  >
                    {gy}
                  </text>
                )}
              </g>
            ))}

            {showCircle && (
              <g>
                <circle
                  cx={toSvgX(midO.x)}
                  cy={toSvgY(midO.y)}
                  r={radiusBC * 42}
                  fill="rgba(14, 165, 233, 0.06)"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <circle cx={toSvgX(midO.x)} cy={toSvgY(midO.y)} r="4" fill="#0284c7" />
                <text
                  x={toSvgX(midO.x) + 6}
                  y={toSvgY(midO.y) + 14}
                  fontSize="12"
                  fontWeight="bold"
                  fill="#0284c7"
                >
                  O (Tâm)
                </text>
              </g>
            )}

            <polygon
              points={activePoly.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ')}
              fill="rgba(13, 148, 136, 0.14)"
              stroke="#0d9488"
              strokeWidth="3"
            />

            {showMidsegment && preset !== 'QUADRILATERAL' && (
              <g>
                <line
                  x1={toSvgX(midM.x)}
                  y1={toSvgY(midM.y)}
                  x2={toSvgX(midN.x)}
                  y2={toSvgY(midN.y)}
                  stroke="#f59e0b"
                  strokeWidth="3"
                />
                <circle cx={toSvgX(midM.x)} cy={toSvgY(midM.y)} r="5" fill="#f59e0b" />
                <circle cx={toSvgX(midN.x)} cy={toSvgY(midN.y)} r="5" fill="#f59e0b" />
                <text
                  x={toSvgX(midM.x) - 18}
                  y={toSvgY(midM.y) - 6}
                  fontSize="12"
                  fontWeight="bold"
                  fill="#d97706"
                >
                  M
                </text>
                <text
                  x={toSvgX(midN.x) + 8}
                  y={toSvgY(midN.y) - 6}
                  fontSize="12"
                  fontWeight="bold"
                  fill="#d97706"
                >
                  N
                </text>
              </g>
            )}

            {activePoly.map((p) => (
              <g
                key={p.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDraggingId(p.id);
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                <circle
                  cx={toSvgX(p.x)}
                  cy={toSvgY(p.y)}
                  r={isPresentationMode ? 11 : 9}
                  fill={draggingId === p.id ? '#f59e0b' : '#0f766e'}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <text
                  x={toSvgX(p.x) + 12}
                  y={toSvgY(p.y) - 10}
                  fontSize={isPresentationMode ? '16' : '13'}
                  fontWeight="bold"
                  fill={isDarkTheme ? '#f8fafc' : '#0f172a'}
                >
                  {p.label}({p.x}; {p.y})
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="lg:col-span-4 space-y-3">
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <h3 className="text-sm font-extrabold flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
              <Ruler className="w-4 h-4" />
              <span>Số đo Độ dài, Chu vi & Diện tích</span>
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="text-[11px] text-slate-500">Cạnh AB</div>
                <div className="text-sm font-extrabold font-mono">{lenAB}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="text-[11px] text-slate-500">Cạnh BC</div>
                <div className="text-sm font-extrabold font-mono">{lenBC}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="text-[11px] text-slate-500">Cạnh CA</div>
                <div className="text-sm font-extrabold font-mono">{lenCA}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <div className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold">
                  Chu vi P
                </div>
                <div className="text-base font-extrabold text-teal-700 dark:text-teal-300 font-mono">
                  {perimeter} đv
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">
                  Diện tích S
                </div>
                <div className="text-base font-extrabold text-indigo-700 dark:text-indigo-300 font-mono">
                  {area} đv²
                </div>
              </div>
            </div>
          </div>

          {preset !== 'QUADRILATERAL' && (
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <h3 className="text-sm font-extrabold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Compass className="w-4 h-4" />
                <span>Số đo Góc & Bất biến Tam giác</span>
              </h3>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <div className="text-[11px] text-slate-500">Góc A</div>
                  <div className="text-sm font-extrabold font-mono text-amber-600">
                    {angleA}°
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <div className="text-[11px] text-slate-500">Góc B</div>
                  <div className="text-sm font-extrabold font-mono">{angleB}°</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <div className="text-[11px] text-slate-500">Góc C</div>
                  <div className="text-sm font-extrabold font-mono">{angleC}°</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-1">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">
                  Kiểm nghiệm định lí Tổng 3 góc:
                </div>
                <MathView
                  content={`$$\\hat{A} + \\hat{B} + \\hat{C} = ${angleA}^\\circ + ${angleB}^\\circ + ${angleC}^\\circ = ${sumAngles}^\\circ$$`}
                />
              </div>

              {showMidsegment && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs space-y-1">
                  <div className="font-bold text-amber-800 dark:text-amber-300">
                    Kiểm nghiệm Đường trung bình MN:
                  </div>
                  <MathView
                    content={`$$MN = ${lenMN}, \\quad BC = ${lenBC} \\Rightarrow \\frac{MN}{BC} = ${
                      lenBC > 0 ? (lenMN / lenBC).toFixed(2) : 0
                    }$$`}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M08 – HÌNH HỌC KHÔNG GIAN 3D & TRẢI PHẲNG (3D SOLID GEOMETRY & NET STUDIO)
// ============================================================================

export const M08SolidGeometry3DTool: React.FC<ToolCommonProps> = ({
  grade,
  isDarkTheme,
  resetSignal,
}) => {
  const [solidType, setSolidType] = useState<Solid3DType>(
    grade === 9 ? 'CYLINDER' : grade === 8 ? 'PYRAMID' : 'BOX'
  );
  const [dimA, setDimA] = useState<number>(4);
  const [dimB, setDimB] = useState<number>(3);
  const [height, setHeight] = useState<number>(5);
  const [radius, setRadius] = useState<number>(3);
  const [rotY, setRotY] = useState<number>(32);
  const [rotX, setRotX] = useState<number>(22);
  const [unfoldRatio, setUnfoldRatio] = useState<number>(0);

  useEffect(() => {
    setSolidType(grade === 9 ? 'CYLINDER' : grade === 8 ? 'PYRAMID' : 'BOX');
    setDimA(4);
    setDimB(3);
    setHeight(5);
    setRadius(3);
    setUnfoldRatio(0);
  }, [grade, resetSignal]);

  const metrics = computeSolid3DMetrics(solidType, {
    a: dimA,
    b: dimB,
    h: height,
    r: radius,
  });

  const project3D = (x: number, y: number, z: number) => {
    const radY = (rotY * Math.PI) / 180;
    const radX = (rotX * Math.PI) / 180;
    const x1 = x * Math.cos(radY) - z * Math.sin(radY);
    const z1 = x * Math.sin(radY) + z * Math.cos(radY);
    const y2 = y * Math.cos(radX) - z1 * Math.sin(radX);
    const scale = 18;
    return {
      px: 170 + x1 * scale,
      py: 155 - y2 * scale,
    };
  };

  return (
    <div className="space-y-4">
      <div
        className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${
          isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'BOX', label: 'Hình hộp chữ nhật (Lớp 7)' },
              { id: 'CUBE', label: 'Hình lập phương (Lớp 7)' },
              { id: 'PRISM', label: 'Lăng trụ đứng tam giác (Lớp 7)' },
              { id: 'PYRAMID', label: 'Hình chóp tứ giác đều (Lớp 8)' },
              { id: 'CYLINDER', label: 'Hình trụ (Lớp 9)' },
              { id: 'CONE', label: 'Hình nón (Lớp 9)' },
              { id: 'SPHERE', label: 'Hình cầu (Lớp 9)' },
            ] as { id: Solid3DType; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSolidType(item.id);
                if (item.id === 'SPHERE') setUnfoldRatio(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                solidType === item.id
                  ? 'bg-teal-600 text-white shadow-xs'
                  : isDarkTheme
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`rounded-2xl border p-3 flex flex-col justify-between ${
              isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                <Box className="w-3.5 h-3.5" />
                Mô hình Không gian 3D
              </span>
              <span className="text-[11px] text-slate-500">
                Đỉnh: {metrics.verticesCount} • Cạnh: {metrics.edgesCount} • Mặt: {metrics.facesCount}
              </span>
            </div>

            <svg viewBox="0 0 340 280" className="w-full h-64">
              {(() => {
                if (solidType === 'BOX' || solidType === 'CUBE') {
                  const a = dimA / 2;
                  const b = (solidType === 'CUBE' ? dimA : dimB) / 2;
                  const h = (solidType === 'CUBE' ? dimA : height) / 2;
                  const v = [
                    project3D(-a, -h, -b),
                    project3D(a, -h, -b),
                    project3D(a, -h, b),
                    project3D(-a, -h, b),
                    project3D(-a, h, -b),
                    project3D(a, h, -b),
                    project3D(a, h, b),
                    project3D(-a, h, b),
                  ];
                  const edges = [
                    [0, 1],
                    [1, 2],
                    [2, 3],
                    [3, 0],
                    [4, 5],
                    [5, 6],
                    [6, 7],
                    [7, 4],
                    [0, 4],
                    [1, 5],
                    [2, 6],
                    [3, 7],
                  ];
                  return (
                    <g>
                      <polygon
                        points={`${v[4].px},${v[4].py} ${v[5].px},${v[5].py} ${v[6].px},${v[6].py} ${v[7].px},${v[7].py}`}
                        fill="rgba(13, 148, 136, 0.25)"
                      />
                      <polygon
                        points={`${v[1].px},${v[1].py} ${v[2].px},${v[2].py} ${v[6].px},${v[6].py} ${v[5].px},${v[5].py}`}
                        fill="rgba(20, 184, 166, 0.16)"
                      />
                      {edges.map(([i, j], idx) => (
                        <line
                          key={idx}
                          x1={v[i].px}
                          y1={v[i].py}
                          x2={v[j].px}
                          y2={v[j].py}
                          stroke="#0d9488"
                          strokeWidth={idx < 4 ? '1.6' : '2.4'}
                          strokeDasharray={idx === 0 || idx === 3 || idx === 8 ? '4 3' : undefined}
                        />
                      ))}
                    </g>
                  );
                }
                if (solidType === 'PYRAMID') {
                  const a = dimA / 2;
                  const h = height / 2;
                  const base = [
                    project3D(-a, -h, -a),
                    project3D(a, -h, -a),
                    project3D(a, -h, a),
                    project3D(-a, -h, a),
                  ];
                  const apex = project3D(0, h, 0);
                  const center = project3D(0, -h, 0);
                  return (
                    <g>
                      <polygon
                        points={base.map((p) => `${p.px},${p.py}`).join(' ')}
                        fill="rgba(14, 165, 233, 0.15)"
                        stroke="#0284c7"
                        strokeWidth="2"
                      />
                      {base.map((p, idx) => (
                        <line
                          key={idx}
                          x1={apex.px}
                          y1={apex.py}
                          x2={p.px}
                          y2={p.py}
                          stroke="#0d9488"
                          strokeWidth="2.4"
                        />
                      ))}
                      <line
                        x1={apex.px}
                        y1={apex.py}
                        x2={center.px}
                        y2={center.py}
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                      <text x={apex.px + 6} y={apex.py - 6} fontSize="12" fontWeight="bold" fill="#f59e0b">
                        S (Đỉnh)
                      </text>
                    </g>
                  );
                }
                if (solidType === 'PRISM') {
                  const a = dimA / 2;
                  const h = height / 2;
                  const bot = [
                    project3D(-a, -h, -a * 0.6),
                    project3D(a, -h, -a * 0.6),
                    project3D(0, -h, a),
                  ];
                  const top = [
                    project3D(-a, h, -a * 0.6),
                    project3D(a, h, -a * 0.6),
                    project3D(0, h, a),
                  ];
                  return (
                    <g>
                      <polygon
                        points={bot.map((p) => `${p.px},${p.py}`).join(' ')}
                        fill="rgba(13, 148, 136, 0.14)"
                        stroke="#0d9488"
                        strokeWidth="2"
                      />
                      <polygon
                        points={top.map((p) => `${p.px},${p.py}`).join(' ')}
                        fill="rgba(13, 148, 136, 0.25)"
                        stroke="#0d9488"
                        strokeWidth="2.2"
                      />
                      {[0, 1, 2].map((i) => (
                        <line
                          key={i}
                          x1={bot[i].px}
                          y1={bot[i].py}
                          x2={top[i].px}
                          y2={top[i].py}
                          stroke="#0d9488"
                          strokeWidth="2.2"
                        />
                      ))}
                    </g>
                  );
                }
                if (solidType === 'CYLINDER') {
                  const rx = radius * 17;
                  const ry = radius * 6.5;
                  const topY = 140 - height * 13;
                  const botY = 140 + height * 13;
                  return (
                    <g>
                      <ellipse
                        cx={170}
                        cy={botY}
                        rx={rx}
                        ry={ry}
                        fill="rgba(13, 148, 136, 0.16)"
                        stroke="#0d9488"
                        strokeWidth="2.2"
                      />
                      <line
                        x1={170 - rx}
                        y1={topY}
                        x2={170 - rx}
                        y2={botY}
                        stroke="#0d9488"
                        strokeWidth="2.4"
                      />
                      <line
                        x1={170 + rx}
                        y1={topY}
                        x2={170 + rx}
                        y2={botY}
                        stroke="#0d9488"
                        strokeWidth="2.4"
                      />
                      <ellipse
                        cx={170}
                        cy={topY}
                        rx={rx}
                        ry={ry}
                        fill="rgba(20, 184, 166, 0.28)"
                        stroke="#0d9488"
                        strokeWidth="2.4"
                      />
                      <line
                        x1={170}
                        y1={topY}
                        x2={170 + rx}
                        y2={topY}
                        stroke="#f59e0b"
                        strokeWidth="2"
                      />
                      <text x={170 + rx / 2 - 6} y={topY - 5} fontSize="11" fontWeight="bold" fill="#d97706">
                        r={radius}
                      </text>
                    </g>
                  );
                }
                if (solidType === 'CONE') {
                  const rx = radius * 17;
                  const ry = radius * 6.5;
                  const apexY = 145 - height * 14;
                  const botY = 145 + height * 12;
                  return (
                    <g>
                      <ellipse
                        cx={170}
                        cy={botY}
                        rx={rx}
                        ry={ry}
                        fill="rgba(13, 148, 136, 0.18)"
                        stroke="#0d9488"
                        strokeWidth="2.2"
                      />
                      <line
                        x1={170}
                        y1={apexY}
                        x2={170 - rx}
                        y2={botY}
                        stroke="#0d9488"
                        strokeWidth="2.4"
                      />
                      <line
                        x1={170}
                        y1={apexY}
                        x2={170 + rx}
                        y2={botY}
                        stroke="#0d9488"
                        strokeWidth="2.4"
                      />
                      <line
                        x1={170}
                        y1={apexY}
                        x2={170}
                        y2={botY}
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    </g>
                  );
                }
                const rPx = radius * 21;
                return (
                  <g>
                    <circle
                      cx={170}
                      cy={140}
                      r={rPx}
                      fill="rgba(14, 165, 233, 0.2)"
                      stroke="#0284c7"
                      strokeWidth="2.5"
                    />
                    <ellipse
                      cx={170}
                      cy={140}
                      rx={rPx}
                      ry={rPx * 0.35}
                      fill="none"
                      stroke="#0d9488"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                    />
                    <line
                      x1={170}
                      y1={140}
                      x2={170 + rPx}
                      y2={140}
                      stroke="#f59e0b"
                      strokeWidth="2.2"
                    />
                    <text x={170 + rPx / 2 - 10} y={134} fontSize="12" fontWeight="bold" fill="#d97706">
                      R={radius}
                    </text>
                  </g>
                );
              })()}
            </svg>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1">
                  Xoay ngang ({rotY}°)
                </label>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  value={rotY}
                  onChange={(e) => setRotY(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">
                  Góc nhìn nghiêng ({rotX}°)
                </label>
                <input
                  type="range"
                  min={5}
                  max={65}
                  value={rotX}
                  onChange={(e) => setRotX(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            </div>
          </div>

          <div
            className={`rounded-2xl border p-3 flex flex-col justify-between ${
              isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                Hình trải phẳng (2D Net)
              </span>
              {metrics.hasFlatNet && (
                <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-300">
                  Độ mở: {Math.round(unfoldRatio * 100)}%
                </span>
              )}
            </div>

            {metrics.hasFlatNet ? (
              <>
                <svg viewBox="0 0 340 280" className="w-full h-64">
                  {(() => {
                    const spread = 0.35 + unfoldRatio * 0.65;
                    if (solidType === 'BOX' || solidType === 'CUBE') {
                      const w = 44 * spread;
                      const h = 54 * spread;
                      return (
                        <g transform="translate(170, 140)">
                          <rect
                            x={-w / 2}
                            y={-h / 2}
                            width={w}
                            height={h}
                            fill="rgba(99, 102, 241, 0.25)"
                            stroke="#4f46e5"
                            strokeWidth="2"
                          />
                          <rect
                            x={-w / 2 - w}
                            y={-h / 2}
                            width={w}
                            height={h}
                            fill="rgba(13, 148, 136, 0.2)"
                            stroke="#0d9488"
                            strokeWidth="2"
                          />
                          <rect
                            x={w / 2}
                            y={-h / 2}
                            width={w}
                            height={h}
                            fill="rgba(13, 148, 136, 0.2)"
                            stroke="#0d9488"
                            strokeWidth="2"
                          />
                          <rect
                            x={-w / 2}
                            y={-h / 2 - w}
                            width={w}
                            height={w}
                            fill="rgba(245, 158, 11, 0.2)"
                            stroke="#d97706"
                            strokeWidth="2"
                          />
                          <rect
                            x={-w / 2}
                            y={h / 2}
                            width={w}
                            height={w}
                            fill="rgba(245, 158, 11, 0.2)"
                            stroke="#d97706"
                            strokeWidth="2"
                          />
                          <rect
                            x={w / 2 + w}
                            y={-h / 2}
                            width={w}
                            height={h}
                            fill="rgba(99, 102, 241, 0.25)"
                            stroke="#4f46e5"
                            strokeWidth="2"
                          />
                        </g>
                      );
                    }
                    if (solidType === 'PYRAMID') {
                      const s = 54;
                      const petal = 68 * spread;
                      return (
                        <g transform="translate(170, 140)">
                          <rect
                            x={-s / 2}
                            y={-s / 2}
                            width={s}
                            height={s}
                            fill="rgba(99, 102, 241, 0.22)"
                            stroke="#4f46e5"
                            strokeWidth="2"
                          />
                          <polygon
                            points={`${-s / 2},${-s / 2} ${s / 2},${-s / 2} 0,${-s / 2 - petal}`}
                            fill="rgba(13, 148, 136, 0.22)"
                            stroke="#0d9488"
                            strokeWidth="2"
                          />
                          <polygon
                            points={`${-s / 2},${s / 2} ${s / 2},${s / 2} 0,${s / 2 + petal}`}
                            fill="rgba(13, 148, 136, 0.22)"
                            stroke="#0d9488"
                            strokeWidth="2"
                          />
                          <polygon
                            points={`${-s / 2},${-s / 2} ${-s / 2},${s / 2} ${-s / 2 - petal},0`}
                            fill="rgba(13, 148, 136, 0.22)"
                            stroke="#0d9488"
                            strokeWidth="2"
                          />
                          <polygon
                            points={`${s / 2},${-s / 2} ${s / 2},${s / 2} ${s / 2 + petal},0`}
                            fill="rgba(13, 148, 136, 0.22)"
                            stroke="#0d9488"
                            strokeWidth="2"
                          />
                        </g>
                      );
                    }
                    if (solidType === 'CYLINDER') {
                      const rectW = 160 * spread;
                      const rectH = 85;
                      const rCircle = 26;
                      return (
                        <g transform="translate(170, 140)">
                          <rect
                            x={-rectW / 2}
                            y={-rectH / 2}
                            width={rectW}
                            height={rectH}
                            fill="rgba(13, 148, 136, 0.2)"
                            stroke="#0d9488"
                            strokeWidth="2"
                          />
                          <circle
                            cx={0}
                            cy={-rectH / 2 - rCircle}
                            r={rCircle}
                            fill="rgba(99, 102, 241, 0.22)"
                            stroke="#4f46e5"
                            strokeWidth="2"
                          />
                          <circle
                            cx={0}
                            cy={rectH / 2 + rCircle}
                            r={rCircle}
                            fill="rgba(99, 102, 241, 0.22)"
                            stroke="#4f46e5"
                            strokeWidth="2"
                          />
                          <text x={-35} y={4} fontSize="11" fontWeight="bold" fill="#0f766e">
                            2πr × h
                          </text>
                        </g>
                      );
                    }
                    return (
                      <g transform="translate(170, 145)">
                        <path
                          d="M 0,-60 L -75,30 A 95,95 0 0,0 75,30 Z"
                          fill="rgba(13, 148, 136, 0.22)"
                          stroke="#0d9488"
                          strokeWidth="2"
                        />
                        <circle
                          cx={0}
                          cy={68}
                          r={26}
                          fill="rgba(99, 102, 241, 0.22)"
                          stroke="#4f46e5"
                          strokeWidth="2"
                        />
                      </g>
                    );
                  })()}
                </svg>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <label className="block text-[11px] font-semibold mb-1">
                    Thanh trượt Gấp / Mở hình khai triển ({Math.round(unfoldRatio * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={unfoldRatio}
                    onChange={(e) => setUnfoldRatio(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs space-y-2">
                <Eye className="w-8 h-8 text-amber-500" />
                <div className="font-extrabold text-amber-800 dark:text-amber-300">
                  Tính chất Hình học chuẩn: Mặt cầu không có hình trải phẳng (Flat Net)
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  {metrics.netLimitationNoteVi}
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className={`lg:col-span-4 rounded-2xl border p-4 space-y-4 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
            Thông số Kích thước & Công thức
          </h3>

          <div className="space-y-3 text-xs">
            {(solidType === 'BOX' ||
              solidType === 'CUBE' ||
              solidType === 'PRISM' ||
              solidType === 'PYRAMID') && (
              <div>
                <label className="flex justify-between font-semibold mb-1">
                  <span>Cạnh đáy a:</span>
                  <span className="font-mono font-bold">{dimA} cm</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={dimA}
                  onChange={(e) => setDimA(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            )}

            {solidType === 'BOX' && (
              <div>
                <label className="flex justify-between font-semibold mb-1">
                  <span>Cạnh đáy b:</span>
                  <span className="font-mono font-bold">{dimB} cm</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={dimB}
                  onChange={(e) => setDimB(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            )}

            {(solidType === 'CYLINDER' || solidType === 'CONE' || solidType === 'SPHERE') && (
              <div>
                <label className="flex justify-between font-semibold mb-1">
                  <span>Bán kính r:</span>
                  <span className="font-mono font-bold">{radius} cm</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={0.5}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            )}

            {solidType !== 'CUBE' && solidType !== 'SPHERE' && (
              <div>
                <label className="flex justify-between font-semibold mb-1">
                  <span>Chiều cao h:</span>
                  <span className="font-mono font-bold">{height} cm</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 flex justify-between items-center">
              <span>Diện tích xung quanh:</span>
              <span className="text-sm font-extrabold font-mono text-teal-700 dark:text-teal-300">
                {Number(metrics.lateralArea.toFixed(2))} cm²
              </span>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex justify-between items-center">
              <span>Diện tích toàn phần:</span>
              <span className="text-sm font-extrabold font-mono text-indigo-700 dark:text-indigo-300">
                {Number(metrics.totalArea.toFixed(2))} cm²
              </span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex justify-between items-center">
              <span>Thể tích (V):</span>
              <span className="text-base font-extrabold font-mono text-amber-700 dark:text-amber-300">
                {Number(metrics.volume.toFixed(2))} cm³
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs space-y-1">
            <div className="font-bold text-slate-700 dark:text-slate-300">
              Công thức áp dụng:
            </div>
            <MathView content={`$$${metrics.formulaLateralLatex}$$`} />
            <MathView content={`$$${metrics.formulaVolumeLatex}$$`} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M10 – PHÒNG THÍ NGHIỆM PYTHAGORE & LƯỢNG GIÁC (PYTHAGORAS & TRIGONOMETRY LAB)
// ============================================================================

export const M10PythagoreTrigTool: React.FC<ToolCommonProps> = ({
  grade,
  isDarkTheme,
  resetSignal,
}) => {
  const [sideA, setSideA] = useState<number>(3);
  const [sideB, setSideB] = useState<number>(4);
  const [observerDist, setObserverDist] = useState<number>(12);
  const [eyeHeight, setEyeHeight] = useState<number>(1.5);
  const [elevAngle, setElevAngle] = useState<number>(35);
  const [activeTab, setActiveTab] = useState<'PYTHAGORE_TRIG' | 'CLINOMETER'>(
    grade === 9 ? 'CLINOMETER' : 'PYTHAGORE_TRIG'
  );

  useEffect(() => {
    setSideA(3);
    setSideB(4);
    setObserverDist(12);
    setEyeHeight(1.5);
    setElevAngle(35);
  }, [resetSignal]);

  const hypC = Number(Math.hypot(sideA, sideB).toFixed(4));
  const areaA2 = Number((sideA * sideA).toFixed(2));
  const areaB2 = Number((sideB * sideB).toFixed(2));
  const areaC2 = Number((sideA * sideA + sideB * sideB).toFixed(2));

  const angleRad = Math.atan2(sideA, sideB);
  const angleDeg = Number(((angleRad * 180) / Math.PI).toFixed(2));
  const sinAlpha = Number((sideA / hypC).toFixed(4));
  const cosAlpha = Number((sideB / hypC).toFixed(4));
  const tanAlpha = Number((sideA / sideB).toFixed(4));
  const cotAlpha = Number((sideB / sideA).toFixed(4));

  const flagpoleHeight = Number(
    (eyeHeight + observerDist * Math.tan((elevAngle * Math.PI) / 180)).toFixed(2)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('PYTHAGORE_TRIG')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'PYTHAGORE_TRIG'
              ? 'bg-teal-600 text-white shadow-xs'
              : isDarkTheme
              ? 'bg-slate-800 text-slate-300'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          1. Định lí Pythagore a² + b² = c² & Tỉ số lượng giác (Lớp 8–9)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CLINOMETER')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'CLINOMETER'
              ? 'bg-teal-600 text-white shadow-xs'
              : isDarkTheme
              ? 'bg-slate-800 text-slate-300'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          2. Ứng dụng Giác kế đo chiều cao Cột cờ sân trường (Lớp 9)
        </button>
      </div>

      {activeTab === 'PYTHAGORE_TRIG' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div
            className={`lg:col-span-7 rounded-2xl border p-4 ${
              isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="text-xs font-bold text-teal-600 dark:text-teal-400 mb-2 flex items-center gap-1.5">
              <Triangle className="w-4 h-4" />
              Mô hình Trực quan Diện tích 3 Hình vuông trên 3 cạnh Tam giác vuông
            </div>

            <svg viewBox="0 0 460 320" className="w-full h-72">
              {(() => {
                const scale = 18;
                const x0 = 175;
                const y0 = 205;
                const w = sideB * scale;
                const h = sideA * scale;
                return (
                  <g>
                    <rect
                      x={x0 - h}
                      y={y0 - h}
                      width={h}
                      height={h}
                      fill="rgba(245, 158, 11, 0.22)"
                      stroke="#d97706"
                      strokeWidth="2"
                    />
                    <text
                      x={x0 - h / 2 - 18}
                      y={y0 - h / 2 + 4}
                      fontSize="11"
                      fontWeight="bold"
                      fill="#b45309"
                    >
                      a²={areaA2}
                    </text>

                    <rect
                      x={x0}
                      y={y0}
                      width={w}
                      height={w}
                      fill="rgba(14, 165, 233, 0.22)"
                      stroke="#0284c7"
                      strokeWidth="2"
                    />
                    <text
                      x={x0 + w / 2 - 20}
                      y={y0 + w / 2 + 4}
                      fontSize="11"
                      fontWeight="bold"
                      fill="#0369a1"
                    >
                      b²={areaB2}
                    </text>

                    <polygon
                      points={`${x0},${y0} ${x0 + w},${y0} ${x0},${y0 - h}`}
                      fill="rgba(13, 148, 136, 0.28)"
                      stroke="#0f766e"
                      strokeWidth="2.8"
                    />
                    <rect
                      x={x0}
                      y={y0 - 12}
                      width={12}
                      height={12}
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="1.8"
                    />
                    <text
                      x={x0 + w - 42}
                      y={y0 - 6}
                      fontSize="12"
                      fontWeight="bold"
                      fill="#0f766e"
                    >
                      α={angleDeg}°
                    </text>
                  </g>
                );
              })()}
            </svg>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <label className="flex justify-between font-bold mb-1">
                  <span>Cạnh đối a:</span>
                  <span className="font-mono text-amber-600">{sideA} cm</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.5}
                  value={sideA}
                  onChange={(e) => setSideA(Number(e.target.value))}
                  className="w-full accent-amber-600"
                />
              </div>
              <div>
                <label className="flex justify-between font-bold mb-1">
                  <span>Cạnh kề b:</span>
                  <span className="font-mono text-sky-600">{sideB} cm</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.5}
                  value={sideB}
                  onChange={(e) => setSideB(Number(e.target.value))}
                  className="w-full accent-sky-600"
                />
              </div>
            </div>
          </div>

          <div
            className={`lg:col-span-5 rounded-2xl border p-4 space-y-3 ${
              isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
              Bảng Kiểm nghiệm Pythagore & Tỉ số Lượng giác
            </h3>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                Định lí Pythagore:
              </div>
              <MathView
                content={`$$a^2 + b^2 = ${areaA2} + ${areaB2} = ${areaC2} = c^2 \\Rightarrow c = \\sqrt{${areaC2}} \\approx ${hypC}\\text{ cm}$$`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="text-slate-500">sin α = a / c</div>
                <div className="text-sm font-extrabold font-mono mt-0.5">{sinAlpha}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="text-slate-500">cos α = b / c</div>
                <div className="text-sm font-extrabold font-mono mt-0.5">{cosAlpha}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="text-slate-500">tan α = a / b</div>
                <div className="text-sm font-extrabold font-mono mt-0.5">{tanAlpha}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="text-slate-500">cot α = b / a</div>
                <div className="text-sm font-extrabold font-mono mt-0.5">{cotAlpha}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
              <MathView
                content={`Hệ thức cơ bản: $\\sin^2(${angleDeg}^\\circ) + \\cos^2(${angleDeg}^\\circ) = ${(
                  sinAlpha * sinAlpha +
                  cosAlpha * cosAlpha
                ).toFixed(2)}$`}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-2xl border p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="lg:col-span-7 space-y-3">
            <div className="text-xs font-bold text-teal-600 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Mô phỏng Thực hành Đo chiều cao Cột cờ sân trường bằng Giác kế (Lớp 9)
            </div>
            <svg viewBox="0 0 480 260" className="w-full h-60 rounded-xl bg-sky-500/5 border border-sky-500/20">
              <line x1={30} y1={220} x2={450} y2={220} stroke="#0f766e" strokeWidth="3" />
              <line x1={90} y1={220} x2={90} y2={185} stroke="#0284c7" strokeWidth="4" />
              <circle cx={90} cy={178} r={7} fill="#0284c7" />
              <line x1={360} y1={220} x2={360} y2={45} stroke="#dc2626" strokeWidth="5" />
              <polygon points="360,45 405,60 360,75" fill="#ef4444" />
              <line
                x1={90}
                y1={185}
                x2={360}
                y2={185}
                stroke="#64748b"
                strokeWidth="1.8"
                strokeDasharray="5 4"
              />
              <line x1={90} y1={185} x2={360} y2={45} stroke="#f59e0b" strokeWidth="2.5" />
              <text x={140} y={178} fontSize="12" fontWeight="bold" fill="#d97706">
                α = {elevAngle}°
              </text>
              <text x={200} y={204} fontSize="12" fontWeight="bold" fill="#0f766e">
                d = {observerDist} m
              </text>
              <text x={372} y={135} fontSize="13" fontWeight="bold" fill="#dc2626">
                H = {flagpoleHeight} m
              </text>
            </svg>
          </div>

          <div className="lg:col-span-5 space-y-3 text-xs">
            <div>
              <label className="flex justify-between font-bold mb-1">
                <span>Khoảng cách từ giác kế tới chân cột cờ (d):</span>
                <span className="font-mono">{observerDist} m</span>
              </label>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={observerDist}
                onChange={(e) => setObserverDist(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>

            <div>
              <label className="flex justify-between font-bold mb-1">
                <span>Góc nâng đọc trên giác kế (α):</span>
                <span className="font-mono">{elevAngle}°</span>
              </label>
              <input
                type="range"
                min={15}
                max={65}
                step={1}
                value={elevAngle}
                onChange={(e) => setElevAngle(Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>

            <div>
              <label className="flex justify-between font-bold mb-1">
                <span>Chiều cao giác kế so với mặt đất (h₀):</span>
                <span className="font-mono">{eyeHeight} m</span>
              </label>
              <input
                type="range"
                min={1}
                max={2}
                step={0.1}
                value={eyeHeight}
                onChange={(e) => setEyeHeight(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <div className="font-extrabold text-emerald-800 dark:text-emerald-300">
                Chiều cao thực tế của Cột cờ:
              </div>
              <MathView
                content={`$$H = h_0 + d \\cdot \\tan\\alpha = ${eyeHeight} + ${observerDist} \\cdot \\tan(${elevAngle}^\\circ) \\approx ${flagpoleHeight}\\text{ m}$$`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
