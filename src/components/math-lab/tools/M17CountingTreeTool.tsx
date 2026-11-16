import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  GitFork,
  Layers,
  Sigma,
} from 'lucide-react';
import { MathView } from '../../MathView';
import { MathGrade } from '../types';
import {
  CountingEventFilter,
  CountingScenarioId,
  MAX_SAFE_FACTORIAL_N,
  TreeStageSpec,
  buildCountingTree,
  calculateAdditionRule,
  calculateMultiplicationRule,
  computeCombinatorics,
} from '../mathEngine/countingEngine';

interface M17ToolProps {
  grade: MathGrade;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  resetSignal: number;
}

type M17Tab = 'TREE' | 'RULES' | 'COMBINATORICS';

const SVG_W = 620;
const SVG_H = 440;

export const M17CountingTreeTool: React.FC<M17ToolProps> = ({
  isPresentationMode,
  isDarkTheme,
  resetSignal,
}) => {
  const [tab, setTab] = useState<M17Tab>('TREE');

  // Tab 1: Sơ đồ cây
  const [scenarioId, setScenarioId] = useState<CountingScenarioId>('COIN_DIE');
  const [noZeroFirstDigit, setNoZeroFirstDigit] = useState<boolean>(true);
  const [distinctItems, setDistinctItems] = useState<boolean>(false);
  const [eventFilter, setEventFilter] = useState<CountingEventFilter>('HEADS_AND_EVEN');
  const [selectedLeafId, setSelectedLeafId] = useState<string | null>(null);
  const [digitCount, setDigitCount] = useState<2 | 3>(2);
  const [customBranches, setCustomBranches] = useState<[number, number, number]>([3, 4, 2]);

  // Tab 2: Quy tắc Cộng & Nhân (Mở rộng)
  const [ruleType, setRuleType] = useState<'ADDITION' | 'MULTIPLICATION'>('MULTIPLICATION');
  const [ruleCounts, setRuleCounts] = useState<[number, number, number]>([4, 3, 2]);

  // Tab 3: Hoán vị / Chỉnh hợp / Tổ hợp (Mở rộng)
  const [combKind, setCombKind] = useState<'PERMUTATION' | 'ARRANGEMENT' | 'COMBINATION'>(
    'COMBINATION'
  );
  const [combN, setCombN] = useState<number>(5);
  const [combK, setCombK] = useState<number>(2);

  useEffect(() => {
    setTab('TREE');
    setScenarioId('COIN_DIE');
    setNoZeroFirstDigit(true);
    setDistinctItems(false);
    setEventFilter('HEADS_AND_EVEN');
    setSelectedLeafId(null);
    setDigitCount(2);
    setCustomBranches([3, 4, 2]);
    setRuleType('MULTIPLICATION');
    setRuleCounts([4, 3, 2]);
    setCombKind('COMBINATION');
    setCombN(5);
    setCombK(2);
  }, [resetSignal]);

  const stages: TreeStageSpec[] = useMemo(() => {
    if (scenarioId === 'CLOTHES') {
      return [
        { stageName: 'Chọn Áo', options: ['Áo Trắng', 'Áo Xanh', 'Áo Vàng'] },
        { stageName: 'Chọn Quần', options: ['Quần Đen', 'Quần Xám'] },
        { stageName: 'Chọn Mũ', options: ['Mũ Lưỡi trai', 'Mũ Tai bèo'] },
      ];
    }
    if (scenarioId === 'DIGITS') {
      const pool = ['0', '1', '2', '3'];
      const list: TreeStageSpec[] = [
        { stageName: digitCount === 2 ? 'Hàng chục' : 'Hàng trăm', options: pool },
        { stageName: digitCount === 2 ? 'Hàng đơn vị' : 'Hàng chục', options: pool },
      ];
      if (digitCount === 3) {
        list.push({ stageName: 'Hàng đơn vị', options: pool });
      }
      return list;
    }
    if (scenarioId === 'COIN_DIE') {
      return [
        { stageName: 'Tung Đồng xu', options: ['Sấp (S)', 'Ngửa (N)'] },
        { stageName: 'Tung Xúc xắc', options: ['1', '2', '3', '4', '5', '6'] },
      ];
    }
    return [
      {
        stageName: 'Bước 1',
        options: Array.from({ length: customBranches[0] }, (_, i) => `A${i + 1}`),
      },
      {
        stageName: 'Bước 2',
        options: Array.from({ length: customBranches[1] }, (_, i) => `B${i + 1}`),
      },
      {
        stageName: 'Bước 3',
        options: Array.from({ length: customBranches[2] }, (_, i) => `C${i + 1}`),
      },
    ];
  }, [scenarioId, digitCount, customBranches]);

  const treeRes = useMemo(
    () =>
      buildCountingTree({
        scenarioId,
        stages,
        noZeroFirstDigit,
        distinctItems,
        eventFilter,
      }),
    [scenarioId, stages, noZeroFirstDigit, distinctItems, eventFilter]
  );

  const selectedLeafPath = useMemo(() => {
    if (!selectedLeafId) return null;
    const node = treeRes.nodes.find((n) => n.id === selectedLeafId);
    return node ? node.pathLabels : null;
  }, [selectedLeafId, treeRes.nodes]);

  const ruleRes = useMemo(
    () =>
      ruleType === 'ADDITION'
        ? calculateAdditionRule(ruleCounts)
        : calculateMultiplicationRule(ruleCounts),
    [ruleType, ruleCounts]
  );

  const combRes = useMemo(
    () => computeCombinatorics(combKind, combN, combK),
    [combKind, combN, combK]
  );

  const arrCompanion = useMemo(
    () => computeCombinatorics('ARRANGEMENT', combN, combK),
    [combN, combK]
  );
  const combCompanion = useMemo(
    () => computeCombinatorics('COMBINATION', combN, combK),
    [combN, combK]
  );

  const surfaceCls = isDarkTheme
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const subCardCls = isDarkTheme
    ? 'bg-slate-950/60 border-slate-800 text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  const inputCls = isDarkTheme
    ? 'bg-slate-800 border-slate-700 text-white'
    : 'bg-white border-slate-300 text-slate-900';

  const nodeById = useMemo(() => {
    const map = new Map<string, (typeof treeRes.nodes)[number]>();
    treeRes.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [treeRes.nodes]);

  const isHighlightedNode = (nodeId: string): boolean => {
    if (!selectedLeafId) return false;
    return selectedLeafId === nodeId || selectedLeafId.startsWith(`${nodeId}|`);
  };

  return (
    <div className="space-y-4">
      {/* THANH CHỌN 3 CHẾ ĐỘ */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('TREE')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
              tab === 'TREE'
                ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                : isDarkTheme
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Sơ đồ cây & Không gian mẫu Ω</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('RULES')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
              tab === 'RULES'
                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                : isDarkTheme
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Quy tắc Cộng & Nhân</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-400 text-slate-950">
              Mở rộng
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('COMBINATORICS')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer ${
              tab === 'COMBINATORICS'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : isDarkTheme
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
            }`}
          >
            <Sigma className="w-3.5 h-3.5" />
            <span>Hoán vị · Chỉnh hợp · Tổ hợp</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-400 text-slate-950">
              Mở rộng
            </span>
          </button>
        </div>

        {tab === 'TREE' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(
              [
                { id: 'COIN_DIE', label: 'Đồng xu + Xúc xắc' },
                { id: 'CLOTHES', label: 'Chọn Trang phục' },
                { id: 'DIGITS', label: 'Lập số {0,1,2,3}' },
                { id: 'CUSTOM', label: 'Tùy chỉnh nhánh' },
              ] as { id: CountingScenarioId; label: string }[]
            ).map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setScenarioId(sc.id);
                  setSelectedLeafId(null);
                  if (sc.id === 'COIN_DIE') setEventFilter('HEADS_AND_EVEN');
                  else if (sc.id === 'DIGITS') setEventFilter('EVEN_NUMBER');
                  else setEventFilter('ALL');
                }}
                className={`px-2.5 py-1.5 rounded-lg border font-bold whitespace-nowrap cursor-pointer ${
                  scenarioId === sc.id
                    ? 'bg-teal-600 text-white border-teal-700'
                    : subCardCls
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: SƠ ĐỒ CÂY TƯƠNG TÁC */}
      {tab === 'TREE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className={`lg:col-span-8 rounded-2xl border p-4 space-y-3 ${surfaceCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold">
                Sơ đồ cây phân nhánh · Bấm vào bất kỳ nút lá để tô sáng đường đi kết quả
              </span>
              <span className="font-extrabold text-teal-600 dark:text-teal-400 tabular-nums">
                n(Ω) = {treeRes.totalOutcomes} kết quả
              </span>
            </div>

            {treeRes.isTruncatedForDisplay && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Tổng cộng có {treeRes.totalOutcomes} kết quả. Để sơ đồ sắc nét và không giật màn hình, hệ thống hiển thị {treeRes.displayedLeafCount} nhánh đầu tiên.
                </span>
              </div>
            )}

            {treeRes.valid ? (
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className={`w-full min-w-[460px] h-auto rounded-2xl border select-none ${
                    isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
                  }`}
                  role="img"
                  aria-label="Sơ đồ cây liệt kê các kết quả có thể"
                >
                  {/* Tiêu đề từng công đoạn ở trên cùng */}
                  <text
                    x={0.06 * SVG_W}
                    y={20}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="800"
                    fill={isDarkTheme ? '#94a3b8' : '#64748b'}
                  >
                    Gốc
                  </text>
                  {treeRes.stageNames.map((name, idx) => {
                    const x = (0.06 + ((idx + 1) / treeRes.stageNames.length) * 0.86) * SVG_W;
                    return (
                      <text
                        key={name + idx}
                        x={x}
                        y={20}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="800"
                        fill={isDarkTheme ? '#5eead4' : '#0f766e'}
                      >
                        {name}
                      </text>
                    );
                  })}

                  {/* Đường nối nhánh */}
                  {treeRes.edges.map((edge) => {
                    const from = nodeById.get(edge.fromId);
                    const to = nodeById.get(edge.toId);
                    if (!from || !to) return null;
                    const x1 = from.xNorm * SVG_W;
                    const y1 = 30 + from.yNorm * (SVG_H - 42);
                    const x2 = to.xNorm * SVG_W;
                    const y2 = 30 + to.yNorm * (SVG_H - 42);
                    const pathHighlighted = isHighlightedNode(edge.toId);
                    return (
                      <line
                        key={`${edge.fromId}-${edge.toId}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={
                          pathHighlighted
                            ? '#f59e0b'
                            : edge.matchesEvent
                              ? '#10b981'
                              : isDarkTheme
                                ? '#334155'
                                : '#cbd5e1'
                        }
                        strokeWidth={pathHighlighted ? 3 : edge.matchesEvent ? 2 : 1.3}
                      />
                    );
                  })}

                  {/* Các nút trên cây */}
                  {treeRes.nodes.map((node) => {
                    const cx = node.xNorm * SVG_W;
                    const cy = 30 + node.yNorm * (SVG_H - 42);
                    const highlighted = isHighlightedNode(node.id);
                    const r = node.isLeaf ? 11 : node.level === 0 ? 15 : 13;
                    return (
                      <g
                        key={node.id}
                        onClick={() => node.isLeaf && setSelectedLeafId(node.id)}
                        className={node.isLeaf ? 'cursor-pointer' : undefined}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={
                            highlighted
                              ? '#f59e0b'
                              : node.matchesEvent
                                ? '#0d9488'
                                : isDarkTheme
                                  ? '#1e293b'
                                  : '#ffffff'
                          }
                          stroke={
                            highlighted
                              ? '#b45309'
                              : node.matchesEvent
                                ? '#0f766e'
                                : isDarkTheme
                                  ? '#475569'
                                  : '#94a3b8'
                          }
                          strokeWidth={1.8}
                        />
                        <text
                          x={node.isLeaf ? cx + 16 : cx}
                          y={node.isLeaf ? cy + 4 : cy + 4}
                          textAnchor={node.isLeaf ? 'start' : 'middle'}
                          fontSize={isPresentationMode ? '12' : '10.5'}
                          fontWeight="800"
                          fill={
                            node.isLeaf
                              ? highlighted
                                ? '#d97706'
                                : node.matchesEvent
                                  ? isDarkTheme
                                    ? '#6ee7b7'
                                    : '#047857'
                                  : isDarkTheme
                                    ? '#cbd5e1'
                                    : '#334155'
                              : node.matchesEvent || highlighted
                                ? '#ffffff'
                                : isDarkTheme
                                  ? '#e2e8f0'
                                  : '#0f172a'
                          }
                        >
                          {node.isLeaf
                            ? node.pathLabels.join(' · ')
                            : node.label.length > 9
                              ? `${node.label.slice(0, 8)}…`
                              : node.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold">
                {treeRes.errorVi}
              </div>
            )}
          </div>

          {/* CỘT PHẢI: CẤU HÌNH RÀNG BUỘC & XÁC SUẤT BIẾN CỐ */}
          <div className="lg:col-span-4 space-y-4">
            <div className={`rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
              <div className="font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                1. Cấu hình nhánh & Ràng buộc
              </div>

              {scenarioId === 'DIGITS' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDigitCount(2)}
                      className={`flex-1 py-1.5 rounded-lg border font-bold cursor-pointer ${
                        digitCount === 2
                          ? 'bg-teal-600 text-white border-teal-700'
                          : subCardCls
                      }`}
                    >
                      Số 2 chữ số
                    </button>
                    <button
                      type="button"
                      onClick={() => setDigitCount(3)}
                      className={`flex-1 py-1.5 rounded-lg border font-bold cursor-pointer ${
                        digitCount === 3
                          ? 'bg-teal-600 text-white border-teal-700'
                          : subCardCls
                      }`}
                    >
                      Số 3 chữ số
                    </button>
                  </div>

                  <label className="flex items-center gap-2 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noZeroFirstDigit}
                      onChange={(e) => setNoZeroFirstDigit(e.target.checked)}
                      className="accent-teal-600"
                    />
                    <span>Chữ số đầu tiên khác 0</span>
                  </label>
                  <label className="flex items-center gap-2 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={distinctItems}
                      onChange={(e) => setDistinctItems(e.target.checked)}
                      className="accent-teal-600"
                    />
                    <span>Các chữ số đôi một khác nhau</span>
                  </label>
                </div>
              )}

              {scenarioId === 'CUSTOM' && (
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx}>
                      <label className="block font-bold mb-1">Bước {idx + 1}:</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={customBranches[idx]}
                        onChange={(e) => {
                          const v = Math.min(6, Math.max(1, Math.trunc(Number(e.target.value) || 1)));
                          setCustomBranches((prev) => {
                            const next = [...prev] as [number, number, number];
                            next[idx] = v;
                            return next;
                          });
                        }}
                        className={`w-full px-2 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block font-bold mb-1">Lọc biến cố thuận lợi E:</label>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value as CountingEventFilter)}
                  aria-label="Chọn điều kiện biến cố"
                  className={`w-full px-2.5 py-1.5 rounded-lg border font-bold ${inputCls}`}
                >
                  <option value="ALL">Tất cả kết quả (100%)</option>
                  {scenarioId === 'COIN_DIE' && (
                    <option value="HEADS_AND_EVEN">Mặt Ngửa và số chấm chẵn</option>
                  )}
                  {(scenarioId === 'COIN_DIE' || scenarioId === 'DIGITS') && (
                    <>
                      <option value="EVEN_NUMBER">Số cuối là số chẵn</option>
                      <option value="CONTAINS_1">Có xuất hiện chữ số 1</option>
                    </>
                  )}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
                <MathView content={`$${treeRes.formulaLatex}$`} />
              </div>

              {selectedLeafPath && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 font-bold">
                  Nhánh đang chọn: {selectedLeafPath.join(' → ')}
                </div>
              )}
            </div>

            <div className={`rounded-2xl border p-4 space-y-2 text-xs ${surfaceCls}`}>
              <div className="font-extrabold">
                2. Tập kết quả không gian mẫu ({treeRes.totalOutcomes})
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1.5">
                {treeRes.outcomesList.slice(0, 48).map((item, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-1 rounded-md border font-bold tabular-nums ${
                      item.matchesEvent
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                        : subCardCls
                    }`}
                  >
                    ({item.path.join(', ')})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUY TẮC CỘNG & QUY TẮC NHÂN (MỞ RỘNG) */}
      {tab === 'RULES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className={`lg:col-span-7 rounded-2xl border p-4 space-y-3 ${surfaceCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setRuleType('MULTIPLICATION')}
                  className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                    ruleType === 'MULTIPLICATION'
                      ? 'bg-blue-600 text-white border-blue-700'
                      : subCardCls
                  }`}
                >
                  Quy tắc Nhân (Nối tiếp)
                </button>
                <button
                  type="button"
                  onClick={() => setRuleType('ADDITION')}
                  className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                    ruleType === 'ADDITION'
                      ? 'bg-teal-600 text-white border-teal-700'
                      : subCardCls
                  }`}
                >
                  Quy tắc Cộng (Rời nhau)
                </button>
              </div>
              <span className="font-extrabold text-amber-600 dark:text-amber-400">
                Chuyên đề Mở rộng
              </span>
            </div>

            <svg
              viewBox="0 0 560 320"
              className={`w-full h-[300px] rounded-2xl border select-none ${
                isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-[#FBFDFF] border-slate-200'
              }`}
              role="img"
              aria-label="Sơ đồ trực quan phân biệt Quy tắc Cộng và Quy tắc Nhân"
            >
              {ruleType === 'MULTIPLICATION' ? (
                <>
                  {/* 4 trạm nối tiếp X -> Y -> Z -> W */}
                  {[0, 1, 2].map((stageIdx) => {
                    const xA = 65 + stageIdx * 145;
                    const xB = xA + 145;
                    const count = Math.min(8, Math.max(0, ruleCounts[stageIdx]));
                    return (
                      <g key={stageIdx}>
                        {Array.from({ length: count }).map((_, k) => {
                          const offset =
                            count === 1 ? 0 : ((k / (count - 1)) - 0.5) * 90;
                          const midX = (xA + xB) / 2;
                          return (
                            <path
                              key={k}
                              d={`M ${xA} 160 Q ${midX} ${160 + offset * 1.4} ${xB} 160`}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth={2}
                              strokeOpacity={0.75}
                            />
                          );
                        })}
                        <text
                          x={(xA + xB) / 2}
                          y={265}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="800"
                          fill="#2563eb"
                        >
                          {ruleCounts[stageIdx]} cách
                        </text>
                      </g>
                    );
                  })}
                  {['Bắt đầu', 'Trạm 1', 'Trạm 2', 'Đích'].map((lbl, idx) => {
                    const cx = 65 + idx * 145;
                    return (
                      <g key={lbl}>
                        <circle cx={cx} cy={160} r={18} fill="#0d9488" stroke="#fff" strokeWidth={2} />
                        <text x={cx} y={164} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">
                          {lbl}
                        </text>
                      </g>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Song song các phương án rời nhau từ A -> B */}
                  {ruleCounts.map((cnt, groupIdx) => {
                    const baseY = 70 + groupIdx * 90;
                    const showCnt = Math.min(6, Math.max(0, cnt));
                    const colors = ['#0d9488', '#2563eb', '#f59e0b'];
                    return (
                      <g key={groupIdx}>
                        {Array.from({ length: showCnt }).map((_, k) => {
                          const dy = showCnt === 1 ? 0 : ((k / (showCnt - 1)) - 0.5) * 42;
                          return (
                            <path
                              key={k}
                              d={`M 90 160 Q 280 ${baseY + dy} 470 160`}
                              fill="none"
                              stroke={colors[groupIdx]}
                              strokeWidth={2}
                            />
                          );
                        })}
                        <text
                          x={280}
                          y={baseY - 26}
                          textAnchor="middle"
                          fontSize="11.5"
                          fontWeight="800"
                          fill={colors[groupIdx]}
                        >
                          Phương án {groupIdx + 1}: {cnt} cách
                        </text>
                      </g>
                    );
                  })}
                  <circle cx={90} cy={160} r={20} fill="#0f172a" stroke="#fff" strokeWidth={2} />
                  <text x={90} y={164} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">
                    A
                  </text>
                  <circle cx={470} cy={160} r={20} fill="#0f172a" stroke="#fff" strokeWidth={2} />
                  <text x={470} y={164} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">
                    B
                  </text>
                </>
              )}
            </svg>
          </div>

          <div className={`lg:col-span-5 rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
            <div className="font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Tham số các {ruleType === 'MULTIPLICATION' ? 'công đoạn liên tiếp' : 'phương án độc lập'}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ruleCounts.map((val, idx) => (
                <div key={idx}>
                  <label className="block font-bold mb-1">
                    {ruleType === 'MULTIPLICATION' ? `Bước ${idx + 1}:` : `Loại ${idx + 1}:`}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={val}
                    onChange={(e) => {
                      const nextVal = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                      setRuleCounts((prev) => {
                        const copy = [...prev] as [number, number, number];
                        copy[idx] = nextVal;
                        return copy;
                      });
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-bold tabular-nums ${inputCls}`}
                  />
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-1">
              <div className="font-bold">Tổng số cách thực hiện:</div>
              <MathView content={`$${ruleRes.summaryLatex}$`} />
            </div>

            <div className={`p-3 rounded-xl border ${subCardCls}`}>
              <p className="leading-relaxed">
                {ruleType === 'MULTIPLICATION'
                  ? 'Quy tắc nhân áp dụng khi một công việc phải thực hiện nối tiếp qua nhiều công đoạn liên tiếp nhau (Bước 1 VÀ Bước 2 VÀ Bước 3).'
                  : 'Quy tắc cộng áp dụng khi có nhiều phương án rời nhau, chỉ cần chọn 1 trong các phương án là hoàn thành công việc (Loại 1 HOẶC Loại 2 HOẶC Loại 3).'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HOÁN VỊ, CHỈNH HỢP, TỔ HỢP (MỞ RỘNG) */}
      {tab === 'COMBINATORICS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className={`lg:col-span-6 rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
            <div className="flex items-center justify-between">
              <span className="font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Công cụ Hoán vị · Chỉnh hợp · Tổ hợp
              </span>
              <span className="font-extrabold text-amber-600 dark:text-amber-400">
                Chuyên đề Mở rộng
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'PERMUTATION', label: 'Hoán vị Pₙ' },
                  { id: 'ARRANGEMENT', label: 'Chỉnh hợp Aₙᵏ' },
                  { id: 'COMBINATION', label: 'Tổ hợp Cₙᵏ' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCombKind(item.id)}
                  className={`py-2 px-2 rounded-xl border font-bold cursor-pointer ${
                    combKind === item.id
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : subCardCls
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">
                  Tổng số phần tử n (0 ≤ n ≤ {MAX_SAFE_FACTORIAL_N}):
                </label>
                <input
                  type="number"
                  min={0}
                  max={MAX_SAFE_FACTORIAL_N + 5}
                  value={combN}
                  onChange={(e) => setCombN(Math.trunc(Number(e.target.value) || 0))}
                  className={`w-full px-3 py-2 rounded-lg border font-bold tabular-nums ${inputCls}`}
                />
              </div>

              {combKind !== 'PERMUTATION' && (
                <div>
                  <label className="block font-bold mb-1">Số phần tử chọn k (0 ≤ k ≤ n):</label>
                  <input
                    type="number"
                    min={0}
                    max={MAX_SAFE_FACTORIAL_N + 5}
                    value={combK}
                    onChange={(e) => setCombK(Math.trunc(Number(e.target.value) || 0))}
                    className={`w-full px-3 py-2 rounded-lg border font-bold tabular-nums ${inputCls}`}
                  />
                </div>
              )}
            </div>

            {combRes.valid ? (
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-2">
                <MathView content={`$${combRes.formulaLatex}$`} />
                <p className="font-semibold flex items-start gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{combRes.explanationVi}</span>
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{combRes.errorVi}</span>
              </div>
            )}
          </div>

          <div className={`lg:col-span-6 rounded-2xl border p-4 space-y-3 text-xs ${surfaceCls}`}>
            <div className="flex items-center gap-2 font-extrabold">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Phân biệt Chỉnh hợp (có thứ tự) và Tổ hợp (không thứ tự)</span>
            </div>

            {arrCompanion.valid && combCompanion.valid ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 tabular-nums">
                  <div className={`p-3 rounded-xl border ${subCardCls}`}>
                    <div className="font-bold text-blue-600 dark:text-blue-400">
                      Có thứ tự (Aₙᵏ)
                    </div>
                    <div className="text-2xl font-extrabold mt-1">
                      {arrCompanion.value.toLocaleString('vi-VN')}
                    </div>
                    <div className="opacity-75 mt-1">Ví dụ: Lập mật khẩu, xếp vị trí Nhất – Nhì</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${subCardCls}`}>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      Không thứ tự (Cₙᵏ)
                    </div>
                    <div className="text-2xl font-extrabold mt-1">
                      {combCompanion.value.toLocaleString('vi-VN')}
                    </div>
                    <div className="opacity-75 mt-1">Ví dụ: Chọn đội gồm k bạn, chọn tập con</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
                  <MathView
                    content={`$A_{${combN}}^{${combK}} = ${combK}! \\cdot C_{${combN}}^{${combK}} \\quad (${arrCompanion.value} = ${
                      computeCombinatorics('PERMUTATION', combK).value
                    } \\times ${combCompanion.value})$`}
                  />
                </div>
              </div>
            ) : (
              <p className="opacity-80">
                Nhập 0 ≤ k ≤ n ≤ {MAX_SAFE_FACTORIAL_N} để đối chiếu đồng thời Aₙᵏ và Cₙᵏ.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
