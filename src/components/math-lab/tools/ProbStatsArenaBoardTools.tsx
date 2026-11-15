import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  BarChart3,
  Copy,
  Dices,
  Download,
  Eraser,
  PenTool,
  Play,
  ShieldAlert,
  Swords,
  Trash2,
  Zap,
} from 'lucide-react';
import { MathView } from '../../MathView';
import { Question } from '../../../types';
import {
  ProbabilityExperimentType,
  analyzeStatisticalDataset,
  getTheoreticalOutcomes,
  runProbabilityBatchSimulation,
} from '../mathEngine/mathVerificationEngine';
import { MathGrade } from '../types';
import { getMathQuizQuestionsForGrade } from '../adapters/mathLabAdapters';

interface ToolCommonProps {
  grade: MathGrade;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  resetSignal: number;
  systemQuestions?: Question[];
}

// ============================================================================
// M03 – MÔ PHỎNG XÁC SUẤT THỰC NGHIỆM (PROBABILITY SIMULATOR)
// ============================================================================

export const M03ProbabilitySimulatorTool: React.FC<ToolCommonProps> = ({
  isDarkTheme,
  resetSignal,
}) => {
  const [expType, setExpType] = useState<ProbabilityExperimentType>('ONE_DIE');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalTrials, setTotalTrials] = useState<number>(0);
  const [lastOutcome, setLastOutcome] = useState<string>('');

  const outcomes = getTheoreticalOutcomes(expType);

  const resetSimulation = (newType: ProbabilityExperimentType = expType) => {
    const initial: Record<string, number> = {};
    for (const o of getTheoreticalOutcomes(newType)) {
      initial[o.key] = 0;
    }
    setCounts(initial);
    setTotalTrials(0);
    setLastOutcome('');
  };

  useEffect(() => {
    resetSimulation(expType);
  }, [resetSignal]);

  const handleSelectExperiment = (t: ProbabilityExperimentType) => {
    setExpType(t);
    resetSimulation(t);
  };

  const handleRunBatch = (batchSize: number) => {
    const sim = runProbabilityBatchSimulation({
      type: expType,
      trialsCount: batchSize,
    });
    setCounts((prev) => {
      const next = { ...prev };
      for (const o of sim.outcomes) {
        next[o.key] = (next[o.key] || 0) + o.frequency;
      }
      return next;
    });
    setTotalTrials((prev) => prev + sim.totalTrials);
    setLastOutcome(sim.lastOutcomeKey);
  };

  let maxAbsDeviation = 0;
  for (const o of outcomes) {
    const emp = totalTrials > 0 ? (counts[o.key] || 0) / totalTrials : 0;
    const diff = Math.abs(emp - o.theoreticalProb);
    if (diff > maxAbsDeviation) maxAbsDeviation = diff;
  }

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
              { id: 'COIN_TOSS', label: '1 Đồng xu (Lớp 6)' },
              { id: 'ONE_DIE', label: '1 Xúc xắc 6 mặt (Lớp 6–7)' },
              { id: 'TWO_DICE_SUM', label: 'Tổng 2 Xúc xắc (Lớp 8–9)' },
              { id: 'SPINNER', label: 'Vòng quay 4 màu' },
              { id: 'CARD_DRAW', label: 'Rút thẻ 1–10 (Lớp 7–8)' },
              { id: 'BALL_URN', label: 'Túi bóng Đỏ/Xanh/Vàng (Lớp 8–9)' },
            ] as { id: ProbabilityExperimentType; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectExperiment(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                expType === item.id
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

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[1, 10, 100, 1000, 10000].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleRunBatch(n)}
              className="px-2.5 py-1.5 rounded-xl font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-xs"
            >
              +{n.toLocaleString('vi-VN')} lần
            </button>
          ))}
          <button
            type="button"
            onClick={() => resetSimulation(expType)}
            className="px-2.5 py-1.5 rounded-xl font-semibold bg-slate-200 dark:bg-slate-800"
          >
            Xóa mẫu
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`lg:col-span-7 rounded-2xl border p-4 space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
              <Dices className="w-4 h-4" />
              Biểu đồ Hội tụ Xác suất Thực nghiệm so với Lý thuyết
            </span>
            <span className="font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">
              Tổng số phép thử N = {totalTrials.toLocaleString('vi-VN')}
            </span>
          </div>

          <div className="space-y-2.5 pt-2">
            {outcomes.map((o) => {
              const count = counts[o.key] || 0;
              const empProb = totalTrials > 0 ? count / totalTrials : 0;
              const empPct = Number((empProb * 100).toFixed(1));
              const theoPct = Number((o.theoreticalProb * 100).toFixed(1));
              return (
                <div key={o.key} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>{o.label}</span>
                    <span className="font-mono">
                      Thực nghiệm: <strong>{empPct}%</strong> ({count} lần) | Lý thuyết:{' '}
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {theoPct}%
                      </span>
                    </span>
                  </div>
                  <div className="relative h-5 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-teal-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, empPct)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
                      style={{ left: `${Math.min(100, theoPct)}%` }}
                      title={`Xác suất lý thuyết: ${theoPct}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`lg:col-span-5 rounded-2xl border p-4 space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
            Bảng Tần số & Độ lệch Cực đại
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
              <div className="text-slate-500">Tổng số lần thử (N)</div>
              <div className="text-base font-extrabold font-mono text-teal-700 dark:text-teal-300">
                {totalTrials.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <div className="text-slate-500">Độ lệch lớn nhất |f/N - P|</div>
              <div className="text-base font-extrabold font-mono text-indigo-700 dark:text-indigo-300">
                {(maxAbsDeviation * 100).toFixed(2)}%
              </div>
            </div>
          </div>

          {lastOutcome && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              Kết quả gần nhất: <strong>{lastOutcome}</strong>
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-1">
            <div className="font-bold text-emerald-800 dark:text-emerald-300">
              Nhận xét Sư phạm (Luật số lớn):
            </div>
            <MathView
              content={
                'Khi số phép thử $N$ tăng lên $1\\,000$ hoặc $10\\,000$ lần, tần số tương đối $f_i = \\frac{n_i}{N}$ hội tụ rất sát về xác suất lý thuyết $P(A)$ (vạch màu vàng cam).'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M04 – BẢNG TẦN SỐ & BIỂU ĐỒ THỐNG KÊ (STATISTICS & DATA LAB)
// ============================================================================

const PRESET_DATASETS: {
  id: string;
  title: string;
  items: { label: string; count: number }[];
}[] = [
  {
    id: 'MATH_SCORES_NUMERIC',
    title: 'Điểm kiểm tra Toán (Định lượng – Lớp 7, 8, 9)',
    items: [
      { label: '6', count: 4 },
      { label: '7', count: 8 },
      { label: '8', count: 15 },
      { label: '9', count: 10 },
      { label: '10', count: 3 },
    ],
  },
  {
    id: 'FAVORITE_SPORTS_QUALITATIVE',
    title: 'Môn thể thao yêu thích (Định tính – Lớp 6, 7)',
    items: [
      { label: 'Bóng đá', count: 16 },
      { label: 'Cầu lông', count: 12 },
      { label: 'Bơi lội', count: 7 },
      { label: 'Cờ vua', count: 5 },
    ],
  },
];

export const M04StatisticsLabTool: React.FC<ToolCommonProps> = ({
  isDarkTheme,
  resetSignal,
}) => {
  const [datasetIdx, setDatasetIdx] = useState<number>(0);
  const [items, setItems] = useState<{ label: string; count: number }[]>(
    PRESET_DATASETS[0].items
  );
  const [chartType, setChartType] = useState<'COLUMN' | 'PIE' | 'LINE'>('COLUMN');

  useEffect(() => {
    setDatasetIdx(0);
    setItems(PRESET_DATASETS[0].items.map((i) => ({ ...i })));
    setChartType('COLUMN');
  }, [resetSignal]);

  const analysis = analyzeStatisticalDataset(items);
  const maxFreq = Math.max(1, ...analysis.rows.map((x) => x.frequency));

  const handleSelectDataset = (idx: number) => {
    const ds = PRESET_DATASETS[idx];
    setDatasetIdx(idx);
    setItems(ds.items.map((i) => ({ ...i })));
  };

  const handleFreqChange = (index: number, newFreq: number) => {
    const safe = Math.max(1, Math.min(100, Math.round(newFreq)));
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, count: safe } : item))
    );
  };

  const totalRelPercent = Number(
    analysis.rows.reduce((acc, r) => acc + r.relativePercent, 0).toFixed(1)
  );

  return (
    <div className="space-y-4">
      <div
        className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${
          isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_DATASETS.map((ds, idx) => (
            <button
              key={ds.id}
              type="button"
              onClick={() => handleSelectDataset(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                datasetIdx === idx
                  ? 'bg-teal-600 text-white shadow-xs'
                  : isDarkTheme
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {ds.title}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {(
            [
              { id: 'COLUMN', label: 'Biểu đồ Cột' },
              { id: 'LINE', label: 'Đoạn thẳng' },
              { id: 'PIE', label: 'Hình quạt tròn (%)' },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChartType(c.id)}
              className={`px-2.5 py-1.5 rounded-xl font-bold ${
                chartType === c.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`lg:col-span-6 rounded-2xl border p-4 space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" />
            Bảng Tần số & Tần số tương đối (N = {analysis.totalCount})
          </h3>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="p-2 border border-slate-200 dark:border-slate-700 text-left">
                  Giá trị / Danh mục (xᵢ)
                </th>
                <th className="p-2 border border-slate-200 dark:border-slate-700 text-center">
                  Tần số (nᵢ)
                </th>
                <th className="p-2 border border-slate-200 dark:border-slate-700 text-right">
                  Tần số tương đối (fᵢ%)
                </th>
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map((row, idx) => (
                <tr key={row.label}>
                  <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold">
                    {row.label}
                  </td>
                  <td className="p-2 border border-slate-200 dark:border-slate-700 text-center">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={items[idx]?.count ?? row.frequency}
                      onChange={(e) => handleFreqChange(idx, Number(e.target.value))}
                      className="w-16 text-center font-mono font-bold rounded-lg border px-1.5 py-1 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                  </td>
                  <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-mono font-bold text-teal-600">
                    {row.relativePercent}%
                  </td>
                </tr>
              ))}
              <tr className="bg-teal-500/10 font-extrabold">
                <td className="p-2 border border-slate-200 dark:border-slate-700">Tổng cộng</td>
                <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-mono">
                  {analysis.totalCount}
                </td>
                <td className="p-2 border border-slate-200 dark:border-slate-700 text-right font-mono">
                  {totalRelPercent}%
                </td>
              </tr>
            </tbody>
          </table>

          {analysis.isNumericDataset ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs pt-2">
              <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <div className="text-[11px] text-slate-500">Số TB cộng (x̄)</div>
                <div className="text-sm font-extrabold font-mono text-teal-700 dark:text-teal-300">
                  {analysis.mean !== null ? Number(analysis.mean.toFixed(2)) : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="text-[11px] text-slate-500">Trung vị (Mₑ)</div>
                <div className="text-sm font-extrabold font-mono text-indigo-700 dark:text-indigo-300">
                  {analysis.median !== null ? Number(analysis.median.toFixed(2)) : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-[11px] text-slate-500">Mốt (M₀)</div>
                <div className="text-sm font-extrabold font-mono text-amber-700 dark:text-amber-300">
                  {analysis.modes.join(', ')}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[11px] text-slate-500">Khoảng biến thiên R</div>
                <div className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                  {analysis.range}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-800 dark:text-amber-200">
                  Quy tắc Thống kê chuẩn GDPT 2018 (Dữ liệu Định tính):
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Dữ liệu danh mục (không phải là số) chỉ xác định được{' '}
                  <strong>Mốt (M₀ = {analysis.modes.join(', ')})</strong> và{' '}
                  <strong>Tần số tương đối (%)</strong>. Không tính Số trung bình cộng hay Trung vị cho dữ liệu định tính!
                </p>
              </div>
            </div>
          )}
        </div>

        <div
          className={`lg:col-span-6 rounded-2xl border p-4 flex flex-col justify-between ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="text-sm font-extrabold text-indigo-700 dark:text-indigo-400 mb-2">
            Biểu đồ Trực quan Hóa Dữ liệu
          </div>

          {chartType === 'COLUMN' && (
            <div className="h-64 flex items-end justify-around gap-3 pt-6 pb-2 px-4 border-b border-slate-300 dark:border-slate-700">
              {analysis.rows.map((row) => {
                const heightPct = Math.round((row.frequency / maxFreq) * 100);
                return (
                  <div key={row.label} className="flex-1 flex flex-col items-center h-full justify-end">
                    <span className="text-xs font-mono font-bold mb-1">
                      {row.frequency} ({row.relativePercent}%)
                    </span>
                    <div
                      className="w-full max-w-[54px] rounded-t-xl bg-teal-600 transition-all duration-300"
                      style={{ height: `${Math.max(6, heightPct)}%` }}
                    />
                    <span className="text-xs font-bold mt-2 truncate max-w-full">
                      {row.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {chartType === 'LINE' && (
            <svg viewBox="0 0 420 220" className="w-full h-64">
              {analysis.rows.map((row, idx) => {
                const x = 50 + idx * (320 / Math.max(1, analysis.rows.length - 1));
                const y = 185 - (row.frequency / maxFreq) * 140;
                const nextRow = analysis.rows[idx + 1];
                const nx = nextRow
                  ? 50 + (idx + 1) * (320 / Math.max(1, analysis.rows.length - 1))
                  : x;
                const ny = nextRow ? 185 - (nextRow.frequency / maxFreq) * 140 : y;
                return (
                  <g key={row.label}>
                    {nextRow && (
                      <line
                        x1={x}
                        y1={y}
                        x2={nx}
                        y2={ny}
                        stroke="#4f46e5"
                        strokeWidth="3"
                      />
                    )}
                    <circle cx={x} cy={y} r={6} fill="#0d9488" />
                    <text x={x} y={y - 10} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0d9488">
                      {row.frequency}
                    </text>
                    <text x={x} y={208} textAnchor="middle" fontSize="11" fill="#64748b">
                      {row.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {chartType === 'PIE' && (
            <div className="space-y-2 py-4">
              {analysis.rows.map((row, idx) => {
                const pct = row.relativePercent || 0;
                const degree = Number(((pct / 100) * 360).toFixed(1));
                const colors = [
                  'bg-teal-600',
                  'bg-indigo-600',
                  'bg-amber-500',
                  'bg-emerald-600',
                  'bg-rose-500',
                ];
                return (
                  <div key={row.label} className="space-y-1 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>{row.label}</span>
                      <span className="font-mono">
                        {pct}% (Góc quạt tâm: {degree}°)
                      </span>
                    </div>
                    <div className="h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${colors[idx % colors.length]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M11 – ĐẤU TRƯỜNG TOÁN HỌC TỐC ĐỘ (SPEED MATH ARENA)
// ============================================================================

export const M11SpeedMathArenaTool: React.FC<ToolCommonProps> = ({
  grade,
  isDarkTheme,
  resetSignal,
  systemQuestions,
}) => {
  const questions = getMathQuizQuestionsForGrade(systemQuestions, grade);
  const [arenaMode, setArenaMode] = useState<'SOLO' | 'TEAM_DUEL'>('TEAM_DUEL');
  const [qIndex, setQIndex] = useState<number>(0);
  const [teamAScore, setTeamAScore] = useState<number>(0);
  const [teamBScore, setTeamBScore] = useState<number>(0);
  const [ropeOffset, setRopeOffset] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [activeTurn, setActiveTurn] = useState<'TEAM_A' | 'TEAM_B'>('TEAM_A');

  useEffect(() => {
    setQIndex(0);
    setTeamAScore(0);
    setTeamBScore(0);
    setRopeOffset(0);
    setSelectedOpt(null);
    setActiveTurn('TEAM_A');
  }, [grade, resetSignal]);

  const currentQ = questions[qIndex % Math.max(1, questions.length)];

  const handleSelectOption = (letter: 'A' | 'B' | 'C' | 'D') => {
    if (selectedOpt !== null || !currentQ) return;
    setSelectedOpt(letter);
    const isCorrect = letter === currentQ.correctAnswer;
    if (isCorrect) {
      if (activeTurn === 'TEAM_A') {
        setTeamAScore((s) => s + 10);
        setRopeOffset((r) => Math.max(-3, r - 1));
      } else {
        setTeamBScore((s) => s + 10);
        setRopeOffset((r) => Math.min(3, r + 1));
      }
    }
  };

  const handleNextQuestion = () => {
    setSelectedOpt(null);
    setQIndex((i) => i + 1);
    setActiveTurn((t) => (t === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A'));
  };

  if (!currentQ) {
    return <div className="p-6 text-center text-sm">Đang tải câu hỏi Toán học...</div>;
  }

  return (
    <div className="space-y-4">
      <div
        className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${
          isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setArenaMode('TEAM_DUEL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 ${
              arenaMode === 'TEAM_DUEL'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Thi đấu 2 Đội Kéo co (Trên lớp)</span>
          </button>
          <button
            type="button"
            onClick={() => setArenaMode('SOLO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 ${
              arenaMode === 'SOLO'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Luyện tập Cá nhân</span>
          </button>
        </div>

        <div className="text-xs font-bold text-slate-500">
          Ngân hàng Toán Lớp {grade}: Câu {(qIndex % questions.length) + 1}/{questions.length} (
          {currentQ.source === 'SYSTEM_BANK' ? 'Ngân hàng Hệ thống' : 'Chuẩn GDPT 2018'})
        </div>
      </div>

      {arenaMode === 'TEAM_DUEL' && (
        <div
          className={`p-4 rounded-2xl border ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-sm font-extrabold mb-2">
            <span className="text-teal-600">ĐỘI A (Tổ 1–2): {teamAScore} điểm</span>
            <span className="px-3 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
              Lượt trả lời: {activeTurn === 'TEAM_A' ? 'ĐỘI A' : 'ĐỘI B'}
            </span>
            <span className="text-indigo-600">ĐỘI B (Tổ 3–4): {teamBScore} điểm</span>
          </div>
          <div className="relative h-4 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 w-8 rounded-full bg-amber-500 transition-all duration-300"
              style={{ left: `calc(${50 + ropeOffset * 12}% - 16px)` }}
            />
          </div>
        </div>
      )}

      <div
        className={`rounded-2xl border p-5 space-y-4 ${
          isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold">
            Chủ đề: {currentQ.topic}
          </span>
          <Award className="w-5 h-5 text-amber-500" />
        </div>

        <div className="text-base sm:text-lg font-bold leading-relaxed">
          <MathView content={currentQ.question} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['A', 'B', 'C', 'D'] as const).map((letter, idx) => {
            const optText = currentQ.options[idx];
            const isChosen = selectedOpt === letter;
            const isRight = letter === currentQ.correctAnswer;
            let btnStyle = isDarkTheme
              ? 'bg-slate-800 border-slate-700 hover:border-teal-500'
              : 'bg-slate-50 border-slate-200 hover:border-teal-500';
            if (selectedOpt !== null) {
              if (isRight) {
                btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-200';
              } else if (isChosen) {
                btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-200';
              }
            }
            return (
              <button
                key={letter}
                type="button"
                onClick={() => handleSelectOption(letter)}
                className={`p-3.5 rounded-xl border-2 text-left transition flex items-center gap-3 ${btnStyle}`}
              >
                <span className="w-7 h-7 rounded-lg bg-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  {letter}
                </span>
                <div className="text-sm font-semibold">
                  <MathView content={optText} />
                </div>
              </button>
            );
          })}
        </div>

        {selectedOpt !== null && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs sm:text-sm space-y-1">
              <div className="font-extrabold text-emerald-800 dark:text-emerald-300">
                {selectedOpt === currentQ.correctAnswer
                  ? 'Chính xác! +10 điểm'
                  : `Chưa đúng! Đáp án đúng là ${currentQ.correctAnswer}.`}
              </div>
              <MathView content={currentQ.explanation} />
            </div>
            <button
              type="button"
              onClick={handleNextQuestion}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Câu tiếp theo</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// M12 – BẢNG TRẮNG TOÁN HỌC TƯƠNG TÁC (INTERACTIVE MATH WHITEBOARD)
// ============================================================================

export const M12InteractiveMathBoardTool: React.FC<ToolCommonProps> = ({
  isDarkTheme,
  resetSignal,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokeColor, setStrokeColor] = useState<string>('#0d9488');
  const [strokeWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [latexInput, setLatexInput] = useState<string>(
    '\\Delta = b^2 - 4ac \\ge 0 \\Rightarrow x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}'
  );
  const [copiedNotice, setCopiedNotice] = useState<string>('');

  const initGridCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = isDarkTheme ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = isDarkTheme ? '#1e293b' : '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    initGridCanvas();
  }, [isDarkTheme, resetSignal]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `bang-toan-tay-do-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyLatex = () => {
    navigator.clipboard?.writeText(`$$${latexInput}$$`).catch(() => {});
    setCopiedNotice('Đã sao chép công thức LaTeX!');
    setTimeout(() => setCopiedNotice(''), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`lg:col-span-7 rounded-2xl border p-3 space-y-2 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-teal-600 flex items-center gap-1">
                <PenTool className="w-3.5 h-3.5" />
                Bảng nháp & Trình bày Hình học
              </span>
              {['#0d9488', '#0284c7', '#d97706', '#dc2626', '#4f46e5'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setStrokeColor(c)}
                  className={`w-5 h-5 rounded-full border-2 ${
                    strokeColor === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStrokeColor(isDarkTheme ? '#0f172a' : '#ffffff')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold inline-flex items-center gap-1"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Tẩy</span>
              </button>
              <button
                type="button"
                onClick={initGridCanvas}
                className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 font-semibold inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa bảng</span>
              </button>
              <button
                type="button"
                onClick={handleExportPNG}
                className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-semibold inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Lưu ảnh PNG</span>
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={680}
            height={360}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setIsDrawing(false)}
            onPointerLeave={() => setIsDrawing(false)}
            className="w-full h-72 sm:h-80 rounded-xl border border-slate-200 dark:border-slate-800 touch-none cursor-crosshair"
          />
        </div>

        <div
          className={`lg:col-span-5 rounded-2xl border p-4 space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
              Trình soạn Công thức Toán KaTeX
            </h3>
            <button
              type="button"
              onClick={handleCopyLatex}
              className="px-2.5 py-1 rounded-lg bg-teal-600/15 text-teal-700 dark:text-teal-300 text-xs font-bold inline-flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Chép LaTeX</span>
            </button>
          </div>

          {copiedNotice && (
            <div className="text-xs font-bold text-emerald-600">{copiedNotice}</div>
          )}

          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { label: 'Phân số \\frac{a}{b}', snippet: '\\frac{a}{b}' },
              { label: 'Căn bậc hai \\sqrt{x}', snippet: '\\sqrt{x}' },
              { label: 'Bình phương x^2', snippet: 'x^2' },
              { label: 'Góc \\widehat{ABC}', snippet: '\\widehat{ABC} = 90^\\circ' },
              { label: 'Tam giác \\triangle', snippet: '\\triangle ABC \\sim \\triangle DEF' },
              { label: 'Hệ PT', snippet: '\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}' },
            ].map((sym) => (
              <button
                key={sym.label}
                type="button"
                onClick={() => setLatexInput((prev) => `${prev} ${sym.snippet}`)}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white font-semibold transition"
              >
                {sym.label}
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={latexInput}
            onChange={(e) => setLatexInput(e.target.value)}
            className={`w-full rounded-xl p-3 text-xs font-mono border outline-none ${
              isDarkTheme
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          />

          <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/25 min-h-[96px] flex items-center justify-center">
            <MathView content={`$$${latexInput}$$`} />
          </div>
        </div>
      </div>
    </div>
  );
};
