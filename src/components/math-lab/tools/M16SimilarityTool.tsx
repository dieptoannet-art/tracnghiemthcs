import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Layers,
  RotateCcw,
  Scaling,
  Sun,
} from 'lucide-react';
import { MathView } from '../../MathView';
import { MathGrade } from '../types';
import { Point2D } from '../mathEngine/mathVerificationEngine';
import {
  analyzeAngleBisector,
  analyzeThalesTheorem,
  analyzeTriangleSimilarity,
  buildScaledTriangle,
  solveShadowHeight,
} from '../mathEngine/similarityEngine';

interface M16ToolProps {
  grade: MathGrade;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  resetSignal: number;
}

type M16Tab = 'THALES' | 'SIMILAR' | 'BISECTOR' | 'SHADOW';

const SVG_SIZE = 540;
const WORLD_MIN = -8;
const WORLD_MAX = 8;
const GRID_TICKS = [-6, -4, -2, 0, 2, 4, 6];

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

function formatNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Number(v.toFixed(digits)).toString();
}

export const M16SimilarityTool: React.FC<M16ToolProps> = ({
  isPresentationMode,
  isDarkTheme,
  resetSignal,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [tab, setTab] = useState<M16Tab>('THALES');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [draggingVertex, setDraggingVertex] = useState<'A' | 'B' | 'C' | null>(null);

  // Tam giác gốc ABC dùng chung cho Thalès, Đồng dạng và Đường phân giác
  const [ptA, setPtA] = useState<Point2D>({ x: -0.5, y: 5 });
  const [ptB, setPtB] = useState<Point2D>({ x: -4.5, y: -2 });
  const [ptC, setPtC] = useState<Point2D>({ x: 4.5, y: -2 });

  // Tham số Thalès
  const [ratioT, setRatioT] = useState<number>(0.5);
  const [deviateN, setDeviateN] = useState<number>(0);

  // Tham số Tam giác đồng dạng
  const [scaleK, setScaleK] = useState<number>(1.5);
  const [skewCX, setSkewCX] = useState<number>(0);

  // Tham số Đo gián tiếp chiều cao bằng bóng nắng
  const [poleHeight, setPoleHeight] = useState<number>(1.5);
  const [poleShadow, setPoleShadow] = useState<number>(2);
  const [treeShadow, setTreeShadow] = useState<number>(12);

  useEffect(() => {
    setTab('THALES');
    setPtA({ x: -0.5, y: 5 });
    setPtB({ x: -4.5, y: -2 });
    setPtC({ x: 4.5, y: -2 });
    setRatioT(0.5);
    setDeviateN(0);
    setScaleK(1.5);
    setSkewCX(0);
    setPoleHeight(1.5);
    setPoleShadow(2);
    setTreeShadow(12);
  }, [resetSignal]);

  const thalesRes = useMemo(
    () => analyzeThalesTheorem({ A: ptA, B: ptB, C: ptC, ratioT, deviateN }),
    [ptA, ptB, ptC, ratioT, deviateN]
  );

  // Cho tab Tam giác đồng dạng, dùng tam giác nhỏ gọn hơn để 2 tam giác nằm vừa khung 1:1
  const simBaseTri = useMemo<[Point2D, Point2D, Point2D]>(
    () => [
      { x: -6, y: 3 },
      { x: -7, y: -2 },
      { x: -2.5, y: -2 },
    ],
    []
  );

  const scaledTri = useMemo(
    () =>
      buildScaledTriangle({
        A: simBaseTri[0],
        B: simBaseTri[1],
        C: simBaseTri[2],
        scaleK,
        offset: { x: 1, y: 3 },
        distortC: { x: skewCX, y: 0 },
      }),
    [simBaseTri, scaleK, skewCX]
  );

  const similarityRes = useMemo(
    () => analyzeTriangleSimilarity(simBaseTri, scaledTri.points),
    [simBaseTri, scaledTri]
  );

  const bisectorRes = useMemo(
    () => analyzeAngleBisector(ptA, ptB, ptC),
    [ptA, ptB, ptC]
  );

  const shadowRes = useMemo(
    () => solveShadowHeight({ poleHeight, poleShadow, treeShadow }),
    [poleHeight, poleShadow, treeShadow]
  );

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingVertex || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * SVG_SIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * SVG_SIZE;
    const nextPt = svgToWorld(sx, sy, snapToGrid);
    if (draggingVertex === 'A') setPtA(nextPt);
    else if (draggingVertex === 'B') setPtB(nextPt);
    else setPtC(nextPt);
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

  const renderGridLines = () => (
    <>
      {GRID_TICKS.map((tick) => {
        const p = worldToSvg({ x: tick, y: tick });
        const isAxis = tick === 0;
        return (
          <g key={tick}>
            <line
              x1={p.sx}
              y1={0}
              x2={p.sx}
              y2={SVG_SIZE}
              stroke={
                isAxis
                  ? isDarkTheme
                    ? '#475569'
                    : '#94a3b8'
                  : isDarkTheme
                    ? '#1e293b'
                    : '#e2e8f0'
              }
              strokeWidth={isAxis ? 1.4 : 1}
              strokeDasharray={isAxis ? '4 4' : undefined}
            />
            <line
              x1={0}
              y1={p.sy}
              x2={SVG_SIZE}
              y2={p.sy}
              stroke={
                isAxis
                  ? isDarkTheme
                    ? '#475569'
                    : '#94a3b8'
                  : isDarkTheme
                    ? '#1e293b'
                    : '#e2e8f0'
              }
              strokeWidth={isAxis ? 1.4 : 1}
              strokeDasharray={isAxis ? '4 4' : undefined}
            />
          </g>
        );
      })}
    </>
  );

  const polyString = (pts: Point2D[]) =>
    pts
      .map((p) => {
        const s = worldToSvg(p);
        return `${s.sx},${s.sy}`;
      })
      .join(' ');

  const tabItems: { id: M16Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'THALES', label: 'Định lý Thalès & Hệ quả', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'SIMILAR', label: 'Tam giác đồng dạng', icon: <Scaling className="w-3.5 h-3.5" /> },
    { id: 'BISECTOR', label: 'Đường phân giác', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'SHADOW', label: 'Đo chiều cao bóng nắng', icon: <Sun className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* THANH CHỌN 4 CHỦ ĐỀ TƯƠNG TÁC M16 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabItems.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                    : isDarkTheme
                      ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {(tab === 'THALES' || tab === 'BISECTOR') && (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSnapToGrid((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border font-bold cursor-pointer ${
                snapToGrid ? 'bg-indigo-600 text-white border-indigo-700' : subCardCls
              }`}
            >
              Bắt lưới 0.5
            </button>
            <button
              type="button"
              onClick={() => {
                setPtA({ x: -0.5, y: 5 });
                setPtB({ x: -4.5, y: -2 });
                setPtC({ x: 4.5, y: -2 });
                setRatioT(0.5);
                setDeviateN(0);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-bold cursor-pointer ${subCardCls}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mẫu chuẩn</span>
            </button>
          </div>
        )}
      </div>

      {/* KHÔNG GIAN CHÍNH: SÂN KHẤU TƯƠNG TÁC + BẢNG PHÂN TÍCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* CỘT TRÁI (7 CỘT): MẶT PHẲNG HÌNH HỌC ĐỘNG 1:1 */}
        <div className={`lg:col-span-7 rounded-2xl border p-4 space-y-3 ${surfaceCls}`}>
          {tab === 'THALES' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold">
                  Kéo thả 3 đỉnh A, B, C · Quan sát đoạn thẳng MN và tính song song với BC
                </span>
                <span
                  className={`font-extrabold ${
                    thalesRes.isParallel
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {thalesRes.isParallel ? 'MN ∥ BC' : 'MN ∦ BC'}
                </span>
              </div>

              <div className="w-full flex justify-center">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                  onPointerMove={handlePointerMove}
                  onPointerUp={() => setDraggingVertex(null)}
                  onPointerLeave={() => setDraggingVertex(null)}
                  className={`w-full max-w-[530px] aspect-square rounded-2xl border select-none touch-none ${
                    isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
                  }`}
                  role="img"
                  aria-label="Mô hình Định lý Thalès trên tam giác ABC"
                >
                  {renderGridLines()}

                  {thalesRes.valid && (
                    <>
                      {/* Nếu t > 1, vẽ tia kéo dài từ A qua B và C */}
                      {ratioT > 1 && (
                        <>
                          <line
                            x1={worldToSvg(ptA).sx}
                            y1={worldToSvg(ptA).sy}
                            x2={worldToSvg(thalesRes.pointM).sx}
                            y2={worldToSvg(thalesRes.pointM).sy}
                            stroke="#64748b"
                            strokeWidth={1.8}
                            strokeDasharray="5 4"
                          />
                          <line
                            x1={worldToSvg(ptA).sx}
                            y1={worldToSvg(ptA).sy}
                            x2={worldToSvg(thalesRes.pointN).sx}
                            y2={worldToSvg(thalesRes.pointN).sy}
                            stroke="#64748b"
                            strokeWidth={1.8}
                            strokeDasharray="5 4"
                          />
                        </>
                      )}

                      {/* Tam giác AMN */}
                      <polygon
                        points={polyString([ptA, thalesRes.pointM, thalesRes.pointN])}
                        fill="#0d9488"
                        fillOpacity={0.18}
                        stroke="none"
                      />

                      {/* Tam giác ABC */}
                      <polygon
                        points={polyString([ptA, ptB, ptC])}
                        fill="#2563eb"
                        fillOpacity={0.08}
                        stroke="#2563eb"
                        strokeWidth={2.5}
                      />

                      {/* Đoạn MN */}
                      <line
                        x1={worldToSvg(thalesRes.pointM).sx}
                        y1={worldToSvg(thalesRes.pointM).sy}
                        x2={worldToSvg(thalesRes.pointN).sx}
                        y2={worldToSvg(thalesRes.pointN).sy}
                        stroke={thalesRes.isParallel ? '#10b981' : '#e11d48'}
                        strokeWidth={3}
                      />

                      {/* Điểm M và N */}
                      {[
                        { pt: thalesRes.pointM, lbl: 'M', dx: -16 },
                        { pt: thalesRes.pointN, lbl: 'N', dx: 10 },
                      ].map((item) => {
                        const sp = worldToSvg(item.pt);
                        return (
                          <g key={item.lbl}>
                            <circle
                              cx={sp.sx}
                              cy={sp.sy}
                              r={5.5}
                              fill={thalesRes.isParallel ? '#059669' : '#e11d48'}
                              stroke="#ffffff"
                              strokeWidth={1.8}
                            />
                            <text
                              x={sp.sx + item.dx}
                              y={sp.sy - 6}
                              fontSize={isPresentationMode ? '14' : '12'}
                              fontWeight="800"
                              fill={
                                thalesRes.isParallel
                                  ? isDarkTheme
                                    ? '#6ee7b7'
                                    : '#047857'
                                  : '#e11d48'
                              }
                            >
                              {item.lbl}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}

                  {/* 3 đỉnh kéo thả A, B, C */}
                  {[
                    { id: 'A' as const, pt: ptA, dy: -12 },
                    { id: 'B' as const, pt: ptB, dy: 18 },
                    { id: 'C' as const, pt: ptC, dy: 18 },
                  ].map((v) => {
                    const s = worldToSvg(v.pt);
                    return (
                      <g
                        key={v.id}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDraggingVertex(v.id);
                        }}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <circle
                          cx={s.sx}
                          cy={s.sy}
                          r={7.5}
                          fill="#2563eb"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                        <text
                          x={s.sx}
                          y={s.sy + v.dy}
                          textAnchor="middle"
                          fontSize={isPresentationMode ? '14' : '12'}
                          fontWeight="800"
                          fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                        >
                          {v.id}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </>
          )}

          {tab === 'SIMILAR' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold">
                  Đối chiếu △ABC (xanh lam) và △A′B′C′ (cam) · Tỉ số k = {formatNum(scaleK, 2)}
                </span>
                <span
                  className={`font-extrabold ${
                    similarityRes.isSimilar
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {similarityRes.isSimilar ? 'ĐỒNG DẠNG' : 'KHÔNG ĐỒNG DẠNG'}
                </span>
              </div>

              <div className="w-full flex justify-center">
                <svg
                  viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                  className={`w-full max-w-[530px] aspect-square rounded-2xl border select-none ${
                    isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
                  }`}
                  role="img"
                  aria-label="So sánh hai tam giác đồng dạng"
                >
                  {renderGridLines()}

                  {/* Tam giác gốc ABC */}
                  <polygon
                    points={polyString(simBaseTri)}
                    fill="#2563eb"
                    fillOpacity={0.2}
                    stroke="#2563eb"
                    strokeWidth={2.5}
                  />
                  {(['A', 'B', 'C'] as const).map((lbl, idx) => {
                    const s = worldToSvg(simBaseTri[idx]);
                    return (
                      <text
                        key={lbl}
                        x={s.sx}
                        y={s.sy + (idx === 0 ? -10 : 16)}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="800"
                        fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                      >
                        {lbl}
                      </text>
                    );
                  })}

                  {/* Tam giác ảnh A'B'C' */}
                  {scaledTri.valid && (
                    <>
                      <polygon
                        points={polyString(scaledTri.points)}
                        fill={similarityRes.isSimilar ? '#f97316' : '#e11d48'}
                        fillOpacity={0.22}
                        stroke={similarityRes.isSimilar ? '#ea580c' : '#e11d48'}
                        strokeWidth={2.5}
                      />
                      {(['A′', 'B′', 'C′'] as const).map((lbl, idx) => {
                        const s = worldToSvg(scaledTri.points[idx]);
                        return (
                          <text
                            key={lbl}
                            x={s.sx}
                            y={s.sy + (idx === 0 ? -10 : 16)}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="800"
                            fill={
                              similarityRes.isSimilar
                                ? isDarkTheme
                                  ? '#fdba74'
                                  : '#c2410c'
                                : '#e11d48'
                            }
                          >
                            {lbl}
                          </text>
                        );
                      })}
                    </>
                  )}
                </svg>
              </div>
            </>
          )}

          {tab === 'BISECTOR' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold">
                  Kéo thả A, B, C · Tia phân giác AD chia cạnh BC theo đúng tỉ lệ AB / AC
                </span>
                <span className="font-extrabold text-teal-600 dark:text-teal-400 tabular-nums">
                  ∠BAD = ∠CAD = {formatNum(bisectorRes.angleBAD, 1)}°
                </span>
              </div>

              <div className="w-full flex justify-center">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                  onPointerMove={handlePointerMove}
                  onPointerUp={() => setDraggingVertex(null)}
                  onPointerLeave={() => setDraggingVertex(null)}
                  className={`w-full max-w-[530px] aspect-square rounded-2xl border select-none touch-none ${
                    isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
                  }`}
                  role="img"
                  aria-label="Tính chất đường phân giác AD trong tam giác ABC"
                >
                  {renderGridLines()}

                  {bisectorRes.valid && (
                    <>
                      <polygon
                        points={polyString([ptA, ptB, ptC])}
                        fill="#0d9488"
                        fillOpacity={0.12}
                        stroke="#2563eb"
                        strokeWidth={2.5}
                      />

                      {/* Tia phân giác AD */}
                      <line
                        x1={worldToSvg(ptA).sx}
                        y1={worldToSvg(ptA).sy}
                        x2={worldToSvg(bisectorRes.footD).sx}
                        y2={worldToSvg(bisectorRes.footD).sy}
                        stroke="#ea580c"
                        strokeWidth={3}
                      />

                      {/* Chân đường phân giác D */}
                      <circle
                        cx={worldToSvg(bisectorRes.footD).sx}
                        cy={worldToSvg(bisectorRes.footD).sy}
                        r={5.5}
                        fill="#ea580c"
                        stroke="#ffffff"
                        strokeWidth={1.8}
                      />
                      <text
                        x={worldToSvg(bisectorRes.footD).sx}
                        y={worldToSvg(bisectorRes.footD).sy + 18}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="800"
                        fill="#ea580c"
                      >
                        D
                      </text>
                    </>
                  )}

                  {[
                    { id: 'A' as const, pt: ptA, dy: -12 },
                    { id: 'B' as const, pt: ptB, dy: 18 },
                    { id: 'C' as const, pt: ptC, dy: 18 },
                  ].map((v) => {
                    const s = worldToSvg(v.pt);
                    return (
                      <g
                        key={v.id}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDraggingVertex(v.id);
                        }}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <circle
                          cx={s.sx}
                          cy={s.sy}
                          r={7.5}
                          fill="#2563eb"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                        <text
                          x={s.sx}
                          y={s.sy + v.dy}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="800"
                          fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                        >
                          {v.id}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </>
          )}

          {tab === 'SHADOW' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold">
                  Mô hình 2 tam giác đồng dạng (G.G): Tia nắng mặt trời song song
                </span>
                <span className="font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                  Chiều cao H = {formatNum(shadowRes.estimatedHeight, 2)} m
                </span>
              </div>

              <div className="w-full flex justify-center">
                <svg
                  viewBox="0 0 540 380"
                  className={`w-full max-w-[530px] h-[360px] rounded-2xl border select-none ${
                    isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
                  }`}
                  role="img"
                  aria-label="Ứng dụng tam giác đồng dạng đo chiều cao cây bằng bóng nắng"
                >
                  {/* Mặt đất */}
                  <line x1={30} y1={320} x2={510} y2={320} stroke="#64748b" strokeWidth={2.5} />

                  {/* Mặt trời góc trên trái */}
                  <circle cx={65} cy={55} r={22} fill="#fbbf24" fillOpacity={0.85} />

                  {/* Cây / Cột cao H */}
                  {(() => {
                    const maxShadow = Math.max(treeShadow, poleShadow, 4);
                    const pxPerM = Math.min(20, 220 / maxShadow);
                    const treeHpx = Math.min(210, Math.max(60, shadowRes.estimatedHeight * pxPerM));
                    const treeSpx = Math.min(230, Math.max(50, treeShadow * pxPerM));
                    const poleHpx = Math.min(120, Math.max(30, poleHeight * pxPerM));
                    const poleSpx = Math.min(130, Math.max(30, poleShadow * pxPerM));

                    const treeX = 85;
                    const poleX = 355;

                    return (
                      <>
                        {/* Tam giác Cây */}
                        <polygon
                          points={`${treeX},320 ${treeX},${320 - treeHpx} ${treeX + treeSpx},320`}
                          fill="#10b981"
                          fillOpacity={0.18}
                          stroke="#059669"
                          strokeWidth={2}
                        />
                        <line
                          x1={treeX}
                          y1={320}
                          x2={treeX}
                          y2={320 - treeHpx}
                          stroke="#047857"
                          strokeWidth={5}
                        />
                        <circle cx={treeX} cy={320 - treeHpx} r={24} fill="#10b981" fillOpacity={0.75} />
                        <line
                          x1={treeX}
                          y1={320 - treeHpx}
                          x2={treeX + treeSpx}
                          y2={320}
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                        />
                        <text
                          x={treeX - 10}
                          y={320 - treeHpx / 2}
                          textAnchor="end"
                          fontSize="12"
                          fontWeight="800"
                          fill={isDarkTheme ? '#6ee7b7' : '#047857'}
                        >
                          H = {formatNum(shadowRes.estimatedHeight, 2)}m
                        </text>
                        <text
                          x={treeX + treeSpx / 2}
                          y={340}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="800"
                          fill={isDarkTheme ? '#cbd5e1' : '#334155'}
                        >
                          Bóng L = {treeShadow}m
                        </text>

                        {/* Tam giác Cọc đo */}
                        <polygon
                          points={`${poleX},320 ${poleX},${320 - poleHpx} ${poleX + poleSpx},320`}
                          fill="#2563eb"
                          fillOpacity={0.2}
                          stroke="#2563eb"
                          strokeWidth={2}
                        />
                        <line
                          x1={poleX}
                          y1={320}
                          x2={poleX}
                          y2={320 - poleHpx}
                          stroke="#1d4ed8"
                          strokeWidth={4}
                        />
                        <line
                          x1={poleX}
                          y1={320 - poleHpx}
                          x2={poleX + poleSpx}
                          y2={320}
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                        />
                        <text
                          x={poleX - 8}
                          y={320 - poleHpx / 2}
                          textAnchor="end"
                          fontSize="11"
                          fontWeight="800"
                          fill={isDarkTheme ? '#93c5fd' : '#1d4ed8'}
                        >
                          h = {poleHeight}m
                        </text>
                        <text
                          x={poleX + poleSpx / 2}
                          y={340}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="800"
                          fill={isDarkTheme ? '#cbd5e1' : '#334155'}
                        >
                          Bóng l = {poleShadow}m
                        </text>
                      </>
                    );
                  })()}
                </svg>
              </div>
            </>
          )}
        </div>

        {/* CỘT PHẢI (5 CỘT): ĐIỀU KHIỂN THAM SỐ & BẢNG ĐỐI CHIẾU TỈ LỆ */}
        <div className="lg:col-span-5 space-y-4">
          {tab === 'THALES' && (
            <>
              <div className={`rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
                <div className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  1. Điều khiển vị trí đoạn MN
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Tỉ lệ trên cạnh AB (t = AM / AB):</span>
                    <span className="tabular-nums text-teal-600 dark:text-teal-400">
                      {formatNum(ratioT, 2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.5}
                    step={0.05}
                    value={ratioT}
                    onChange={(e) => setRatioT(Number(e.target.value))}
                    aria-label="Thanh trượt tỉ lệ Thalès t"
                    className="w-full accent-teal-600"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[
                      { val: 0.4, lbl: 't = 0.4' },
                      { val: 0.5, lbl: 'Trung bình (0.5)' },
                      { val: 0.75, lbl: 't = 0.75' },
                      { val: 1.4, lbl: 'Hệ quả ngoài (1.4)' },
                    ].map((btn) => (
                      <button
                        key={btn.val}
                        type="button"
                        onClick={() => setRatioT(btn.val)}
                        className={`px-2 py-1 rounded-md border font-bold cursor-pointer ${
                          Math.abs(ratioT - btn.val) < 0.01
                            ? 'bg-teal-600 text-white border-teal-700'
                            : subCardCls
                        }`}
                      >
                        {btn.lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Độ lệch điểm N (kiểm thử Thalès đảo):</span>
                    <span className="tabular-nums text-rose-600 dark:text-rose-400">
                      {deviateN >= 0 ? `+${formatNum(deviateN, 2)}` : formatNum(deviateN, 2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.3}
                    max={0.3}
                    step={0.05}
                    value={deviateN}
                    onChange={(e) => setDeviateN(Number(e.target.value))}
                    aria-label="Độ lệch điểm N để kiểm thử Thalès đảo"
                    className="w-full accent-rose-600"
                  />
                  {Math.abs(deviateN) > 0.001 && (
                    <button
                      type="button"
                      onClick={() => setDeviateN(0)}
                      className="mt-1 text-[11px] font-bold text-teal-600 underline cursor-pointer"
                    >
                      Đưa độ lệch về 0 để MN ∥ BC
                    </button>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
                  <MathView content={`$${thalesRes.summaryLatex}$`} />
                </div>
              </div>

              {thalesRes.valid && (
                <div className={`rounded-2xl border p-4 space-y-2.5 text-xs ${surfaceCls}`}>
                  <div className="font-extrabold">2. Bảng Tỉ số Độ dài & Diện tích</div>
                  <table className="w-full border-collapse tabular-nums">
                    <thead>
                      <tr className={subCardCls}>
                        <th className="p-2 border border-slate-200 dark:border-slate-700 text-left">
                          Cặp tỉ số
                        </th>
                        <th className="p-2 border border-slate-200 dark:border-slate-700 text-right">
                          Trên AB / BC
                        </th>
                        <th className="p-2 border border-slate-200 dark:border-slate-700 text-right">
                          Trên AC
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold">
                          AM/AB vs AN/AC
                        </td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-extrabold">
                          {formatNum(thalesRes.ratioAM_AB, 3)}
                        </td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-extrabold">
                          {formatNum(thalesRes.ratioAN_AC, 3)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold">
                          AM/MB vs AN/NC
                        </td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-semibold">
                          {formatNum(thalesRes.ratioAM_MB, 3)}
                        </td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-semibold">
                          {formatNum(thalesRes.ratioAN_NC, 3)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold">
                          MN/BC vs S_AMN/S_ABC
                        </td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-semibold">
                          MN/BC = {formatNum(thalesRes.ratioMN_BC, 3)}
                        </td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-semibold">
                          S′/S = {formatNum(thalesRes.areaRatio, 3)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div
                    className={`p-2.5 rounded-xl border font-bold flex items-start gap-2 ${
                      thalesRes.isParallel
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/35 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {thalesRes.isParallel ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{thalesRes.conclusionVi}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'SIMILAR' && (
            <>
              <div className={`rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
                <div className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  1. Điều khiển tỉ số đồng dạng k & biến dạng
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Tỉ số đồng dạng k:</span>
                    <span className="tabular-nums text-blue-600 dark:text-blue-400">
                      k = {formatNum(scaleK, 2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1.6}
                    step={0.1}
                    value={scaleK}
                    onChange={(e) => setScaleK(Number(e.target.value))}
                    aria-label="Thanh trượt tỉ số đồng dạng k"
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>Làm lệch đỉnh C′ (kiểm chứng phá đồng dạng):</span>
                    <span className="tabular-nums text-rose-600 dark:text-rose-400">
                      Δx = {formatNum(skewCX, 1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-2}
                    max={2}
                    step={0.5}
                    value={skewCX}
                    onChange={(e) => setSkewCX(Number(e.target.value))}
                    aria-label="Thanh trượt lệch đỉnh C phẩy"
                    className="w-full accent-rose-600"
                  />
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
                  <MathView content={`$${similarityRes.summaryLatex}$`} />
                </div>
              </div>

              {similarityRes.valid && similarityRes.tri1Metrics && similarityRes.tri2Metrics && (
                <div className={`rounded-2xl border p-4 space-y-2.5 text-xs ${surfaceCls}`}>
                  <div className="font-extrabold">2. Kiểm chứng 3 trường hợp C.C.C · C.G.C · G.G</div>
                  <div className="grid grid-cols-3 gap-2 text-center font-bold tabular-nums">
                    <div className={`p-2 rounded-xl border ${subCardCls}`}>
                      <div className="text-[10px] opacity-70">A′B′ / AB</div>
                      <div>{formatNum(similarityRes.ratioAB, 2)}</div>
                    </div>
                    <div className={`p-2 rounded-xl border ${subCardCls}`}>
                      <div className="text-[10px] opacity-70">B′C′ / BC</div>
                      <div>{formatNum(similarityRes.ratioBC, 2)}</div>
                    </div>
                    <div className={`p-2 rounded-xl border ${subCardCls}`}>
                      <div className="text-[10px] opacity-70">C′A′ / CA</div>
                      <div>{formatNum(similarityRes.ratioCA, 2)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center font-bold tabular-nums">
                    <div className={`p-2 rounded-xl border ${subCardCls}`}>
                      <div className="text-[10px] opacity-70">Tỉ số Chu vi (P′ / P)</div>
                      <div>{formatNum(similarityRes.perimeterRatio, 2)}</div>
                    </div>
                    <div className={`p-2 rounded-xl border ${subCardCls}`}>
                      <div className="text-[10px] opacity-70">Tỉ số Diện tích (S′ / S = k²)</div>
                      <div>{formatNum(similarityRes.areaRatio, 2)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 font-bold">
                    <span
                      className={
                        similarityRes.matchedByCCC ? 'text-emerald-600' : 'text-rose-600'
                      }
                    >
                      C.C.C: {similarityRes.matchedByCCC ? 'Đạt' : 'Không'}
                    </span>
                    <span>·</span>
                    <span
                      className={
                        similarityRes.matchedByCGC ? 'text-emerald-600' : 'text-rose-600'
                      }
                    >
                      C.G.C: {similarityRes.matchedByCGC ? 'Đạt' : 'Không'}
                    </span>
                    <span>·</span>
                    <span
                      className={
                        similarityRes.matchedByGG ? 'text-emerald-600' : 'text-rose-600'
                      }
                    >
                      G.G: {similarityRes.matchedByGG ? 'Đạt' : 'Không'}
                    </span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border font-bold flex items-start gap-2 ${
                      similarityRes.isSimilar
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/35 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {similarityRes.isSimilar ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{similarityRes.conclusionVi}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'BISECTOR' && (
            <div className={`rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
              <div className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Kiểm chứng Định lý Đường phân giác AD
              </div>
              <p className="opacity-85 leading-relaxed">
                Trong △ABC, đường phân giác của một góc chia cạnh đối diện thành hai đoạn thẳng tỉ lệ với hai cạnh kề hai đoạn ấy:
              </p>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
                <MathView content={`$${bisectorRes.summaryLatex}$`} />
              </div>
              {bisectorRes.valid && (
                <table className="w-full border-collapse tabular-nums">
                  <tbody>
                    <tr>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold">
                        AB / AC
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-semibold">
                        {formatNum(bisectorRes.lenAB)} / {formatNum(bisectorRes.lenAC)}
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-extrabold text-teal-600">
                        = {formatNum(bisectorRes.ratioAB_AC, 3)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold">
                        DB / DC
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-semibold">
                        {formatNum(bisectorRes.lenDB)} / {formatNum(bisectorRes.lenDC)}
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-extrabold text-orange-600">
                        = {formatNum(bisectorRes.ratioDB_DC, 3)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'SHADOW' && (
            <div className={`rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
              <div className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Nhập số liệu đo thực địa (mét)
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1">Cọc cao h (m):</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={poleHeight}
                    onChange={(e) => setPoleHeight(Number(e.target.value))}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Bóng cọc l (m):</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={poleShadow}
                    onChange={(e) => setPoleShadow(Number(e.target.value))}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Bóng cây L (m):</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={treeShadow}
                    onChange={(e) => setTreeShadow(Number(e.target.value))}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                  />
                </div>
              </div>

              {shadowRes.valid ? (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-1">
                  <div className="font-bold">Lời giải theo hai tam giác đồng dạng:</div>
                  <MathView content={`$${shadowRes.summaryLatex}$`} />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{shadowRes.errorVi}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
