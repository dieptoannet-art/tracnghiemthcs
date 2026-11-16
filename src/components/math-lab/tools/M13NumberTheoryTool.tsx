import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Divide,
  FastForward,
  GitBranch,
  Grid3X3,
  Hash,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { MathView } from '../../MathView';
import { MathGrade } from '../types';
import {
  FactorTreeNode,
  MAX_FAST_SIEVE_LIMIT,
  MAX_VISUAL_SIEVE_LIMIT,
  checkDivisibilityRules,
  classifyNumber,
  computeGcdAndLcm,
  euclideanDivision,
  factorizeNumber,
  generateEratosthenesSieve,
  getDivisorsAndMultiples,
} from '../mathEngine/numberTheoryEngine';

interface M13ToolProps {
  grade: MathGrade;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  resetSignal: number;
}

type M13Tab = 'SIEVE' | 'FACTOR_TREE' | 'EUCLID_GCD_LCM' | 'DIVISIBILITY_REM';

interface TreeLayoutNode {
  node: FactorTreeNode;
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
}

function layoutFactorTree(root: FactorTreeNode): {
  nodes: TreeLayoutNode[];
  width: number;
  height: number;
} {
  let leafIndex = 0;
  const xMap = new Map<string, number>();
  const depthMap = new Map<string, number>();
  let maxDepth = 0;

  const measure = (node: FactorTreeNode, depth: number): number => {
    depthMap.set(node.id, depth);
    if (depth > maxDepth) maxDepth = depth;
    if (!node.left || !node.right) {
      const x = leafIndex * 74 + 46;
      leafIndex++;
      xMap.set(node.id, x);
      return x;
    }
    const lx = measure(node.left, depth + 1);
    const rx = measure(node.right, depth + 1);
    const mid = (lx + rx) / 2;
    xMap.set(node.id, mid);
    return mid;
  };

  measure(root, 0);

  const nodes: TreeLayoutNode[] = [];
  const collect = (node: FactorTreeNode, px?: number, py?: number) => {
    const x = xMap.get(node.id) ?? 50;
    const depth = depthMap.get(node.id) ?? 0;
    const y = depth * 66 + 34;
    nodes.push({ node, x, y, parentX: px, parentY: py });
    if (node.left) collect(node.left, x, y);
    if (node.right) collect(node.right, x, y);
  };
  collect(root);

  const width = Math.max(300, leafIndex * 74 + 28);
  const height = Math.max(160, (maxDepth + 1) * 66 + 24);
  return { nodes, width, height };
}

export const M13NumberTheoryTool: React.FC<M13ToolProps> = ({
  grade,
  isPresentationMode,
  isDarkTheme,
  resetSignal,
}) => {
  const [activeTab, setActiveTab] = useState<M13Tab>('SIEVE');

  // 1. Trạng thái Sàng Eratosthenes & Kiểm tra số
  const [sieveLimitInput, setSieveLimitInput] = useState<number>(100);
  const [currentSieveStep, setCurrentSieveStep] = useState<number>(0);
  const [isPlayingSieve, setIsPlayingSieve] = useState<boolean>(false);
  const [inspectNum, setInspectNum] = useState<number>(97);

  // 2. Trạng thái Phân tích thừa số nguyên tố
  const [factorInput, setFactorInput] = useState<number>(60);

  // 3. Trạng thái ƯCLN & BCNN (Euclid)
  const [euclidA, setEuclidA] = useState<number>(24);
  const [euclidB, setEuclidB] = useState<number>(36);

  // 4. Trạng thái Ước – Bội, Chia hết & Chia có dư
  const [divRuleNum, setDivRuleNum] = useState<number>(1260);
  const [multipleRangeLimit, setMultipleRangeLimit] = useState<number>(100);
  const [remDividend, setRemDividend] = useState<number>(29);
  const [remDivisor, setRemDivisor] = useState<number>(6);

  useEffect(() => {
    setSieveLimitInput(100);
    setCurrentSieveStep(0);
    setIsPlayingSieve(false);
    setInspectNum(grade === 6 ? 29 : 97);
    setFactorInput(60);
    setEuclidA(24);
    setEuclidB(36);
    setDivRuleNum(1260);
    setRemDividend(29);
    setRemDivisor(6);
  }, [resetSignal, grade]);

  const sieveData = useMemo(() => generateEratosthenesSieve(sieveLimitInput), [sieveLimitInput]);

  // Chạy hoạt ảnh từng bước sàng Eratosthenes
  useEffect(() => {
    if (!isPlayingSieve || !sieveData.isValid) return;
    if (currentSieveStep >= sieveData.steps.length) {
      setIsPlayingSieve(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setCurrentSieveStep((s) => Math.min(s + 1, sieveData.steps.length));
    }, 950);
    return () => window.clearTimeout(timer);
  }, [isPlayingSieve, currentSieveStep, sieveData.isValid, sieveData.steps.length]);

  const crossedByStepMap = useMemo(() => {
    const map = new Map<number, number>();
    const activeSteps = sieveData.steps.slice(0, currentSieveStep);
    for (const st of activeSteps) {
      for (const m of st.crossedMultiples) {
        if (!map.has(m)) {
          map.set(m, st.prime);
        }
      }
    }
    return map;
  }, [sieveData.steps, currentSieveStep]);

  const activePrimeHighlight = useMemo(() => {
    if (currentSieveStep <= 0 || currentSieveStep > sieveData.steps.length) return null;
    return sieveData.steps[currentSieveStep - 1]?.prime ?? null;
  }, [sieveData.steps, currentSieveStep]);

  const inspectedClass = useMemo(() => classifyNumber(inspectNum), [inspectNum]);
  const factorResult = useMemo(() => factorizeNumber(factorInput), [factorInput]);
  const treeLayout = useMemo(
    () => (factorResult.tree ? layoutFactorTree(factorResult.tree) : null),
    [factorResult.tree]
  );
  const gcdLcmResult = useMemo(() => computeGcdAndLcm(euclidA, euclidB), [euclidA, euclidB]);
  const divMultResult = useMemo(
    () => getDivisorsAndMultiples(divRuleNum, multipleRangeLimit),
    [divRuleNum, multipleRangeLimit]
  );
  const divisibilityAudit = useMemo(() => checkDivisibilityRules(divRuleNum), [divRuleNum]);
  const remDivision = useMemo(
    () => euclideanDivision(remDividend, remDivisor),
    [remDividend, remDivisor]
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

  const sieveGridNumbers = useMemo(() => {
    if (!sieveData.isValid) return [];
    return Array.from({ length: sieveData.visualLimit }, (_, idx) => idx + 1);
  }, [sieveData.isValid, sieveData.visualLimit]);

  const visiblePrimesInGridCount = useMemo(() => {
    if (currentSieveStep < sieveData.steps.length) {
      // Đếm các số >= 2 chưa bị gạch tại bước hiện tại
      let count = 0;
      for (let n = 2; n <= sieveData.visualLimit; n++) {
        if (!crossedByStepMap.has(n)) count++;
      }
      return count;
    }
    return sieveData.primeCount;
  }, [currentSieveStep, sieveData.steps.length, sieveData.visualLimit, sieveData.primeCount, crossedByStepMap]);

  return (
    <div className="space-y-4">
      {/* THANH CHUYỂN 4 KHÔNG GIAN PHÒNG THÍ NGHIỆM SỐ HỌC M13 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'SIEVE', label: '1. Sàng Eratosthenes & Nguyên tố', icon: <Grid3X3 className="w-4 h-4" /> },
            { id: 'FACTOR_TREE', label: '2. Cây Thừa số nguyên tố', icon: <GitBranch className="w-4 h-4" /> },
            { id: 'EUCLID_GCD_LCM', label: '3. ƯCLN & BCNN (Euclid)', icon: <Hash className="w-4 h-4" /> },
            { id: 'DIVISIBILITY_REM', label: '4. Ước – Bội & Chia có dư', icon: <Divide className="w-4 h-4" /> },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as M13Tab)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border-b-2 ${
                  active
                    ? 'bg-teal-600 text-white border-teal-800 shadow-sm'
                    : isDarkTheme
                      ? 'bg-slate-800 text-slate-300 border-slate-950 hover:bg-slate-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-teal-50'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs font-bold">
          M13 • Chuẩn số học GDPT 2018
        </span>
      </div>

      {/* ===================================================================
          TAB 1: SÀNG ERATOSTHENES 3D & KIỂM TRA SỐ NGUYÊN TỐ
          =================================================================== */}
      {activeTab === 'SIEVE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Bảng số 3D tương tác (8 cột) */}
          <div className={`lg:col-span-8 rounded-2xl border p-4 space-y-4 ${surfaceCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={`font-extrabold ${isPresentationMode ? 'text-lg' : 'text-base'}`}>
                  Bảng Sàng Eratosthenes Tương Tác (1 → {sieveData.visualLimit})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bấm vào bất kỳ khối số để phân loại, hoặc chạy hoạt ảnh gạch bội số từng bước.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="font-bold" htmlFor="m13-sieve-limit">
                  Giới hạn N:
                </label>
                <input
                  id="m13-sieve-limit"
                  type="number"
                  min={2}
                  max={MAX_FAST_SIEVE_LIMIT}
                  value={sieveLimitInput}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSieveLimitInput(Number.isNaN(v) ? 2 : v);
                    setCurrentSieveStep(0);
                    setIsPlayingSieve(false);
                  }}
                  className={`w-24 px-2.5 py-1.5 rounded-xl border font-bold outline-none ${inputCls}`}
                />
                {[30, 50, 100, 150, 200].map((presetN) => (
                  <button
                    key={presetN}
                    type="button"
                    onClick={() => {
                      setSieveLimitInput(presetN);
                      setCurrentSieveStep(0);
                      setIsPlayingSieve(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                      sieveLimitInput === presetN
                        ? 'bg-teal-600 text-white border-teal-700'
                        : subCardCls
                    }`}
                  >
                    N={presetN}
                  </button>
                ))}
              </div>
            </div>

            {!sieveData.isValid ? (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{sieveData.errorVi}</span>
              </div>
            ) : (
              <>
                {sieveData.isVisualTruncated && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                    Giới hạn N = {sieveData.limit.toLocaleString('vi-VN')} quá lớn để hiển thị toàn bộ ô cùng lúc. Hệ thống tính nhanh đủ <strong>{sieveData.primeCount.toLocaleString('vi-VN')}</strong> số nguyên tố trong bộ nhớ và hiển thị bảng trực quan {MAX_VISUAL_SIEVE_LIMIT} ô đầu để tránh treo trình duyệt.
                  </div>
                )}

                {/* Thanh điều khiển từng bước */}
                <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${subCardCls}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlayingSieve(false);
                        setCurrentSieveStep(0);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      aria-label="Đặt lại bước sàng"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Đầu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlayingSieve(false);
                        setCurrentSieveStep((s) => Math.max(0, s - 1));
                      }}
                      disabled={currentSieveStep === 0}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                      aria-label="Lùi một bước sàng"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentSieveStep >= sieveData.steps.length) {
                          setCurrentSieveStep(0);
                        }
                        setIsPlayingSieve((p) => !p);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isPlayingSieve ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlayingSieve ? 'Tạm dừng' : 'Chạy từng bước'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlayingSieve(false);
                        setCurrentSieveStep((s) => Math.min(sieveData.steps.length, s + 1));
                      }}
                      disabled={currentSieveStep >= sieveData.steps.length}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                      aria-label="Tiến một bước sàng"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlayingSieve(false);
                        setCurrentSieveStep(sieveData.steps.length);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                      <span>Lọc hết ngay</span>
                    </button>
                  </div>

                  <div className="text-xs font-bold">
                    Bước: <span className="text-teal-600 dark:text-teal-400">{currentSieveStep}/{sieveData.steps.length}</span> • Số còn lại:{' '}
                    <span className="text-amber-600 dark:text-amber-400">{visiblePrimesInGridCount}</span>
                  </div>
                </div>

                {/* Mô tả bước hiện tại */}
                <div className="px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs font-semibold text-sky-900 dark:text-sky-200">
                  {currentSieveStep === 0
                    ? 'Bước 0: Số 1 không phải số nguyên tố. Bấm "Chạy từng bước" hoặc tiến từng bước để giữ các số nguyên tố và gạch bỏ bội số của chúng.'
                    : sieveData.steps[currentSieveStep - 1]?.descriptionVi}
                </div>

                {/* Lưới các khối số 3D nhẹ nhàng */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-[430px] overflow-y-auto p-1">
                  {sieveGridNumbers.map((num) => {
                    const isOne = num === 1;
                    const crossedBy = crossedByStepMap.get(num);
                    const isCrossed = crossedBy !== undefined;
                    const isActivePivot = activePrimeHighlight === num;
                    const isConfirmedPrime =
                      !isOne && !isCrossed && currentSieveStep >= sieveData.steps.length;
                    const isSelected = inspectNum === num;

                    let blockCls = isDarkTheme
                      ? 'bg-slate-800 border-slate-700 border-b-4 border-b-slate-950 text-slate-100'
                      : 'bg-white border-slate-200 border-b-4 border-b-slate-300 text-slate-800';

                    if (isOne) {
                      blockCls = isDarkTheme
                        ? 'bg-slate-800/40 border-slate-700 border-b-4 border-b-slate-900 text-slate-500'
                        : 'bg-slate-100 border-slate-200 border-b-4 border-b-slate-300 text-slate-400';
                    } else if (isActivePivot) {
                      blockCls =
                        'bg-amber-400 border-amber-500 border-b-4 border-b-amber-700 text-slate-950 ring-2 ring-amber-300 scale-[1.03]';
                    } else if (isCrossed) {
                      blockCls = isDarkTheme
                        ? 'bg-rose-950/50 border-rose-900/60 border-b-2 text-rose-300/60 line-through'
                        : 'bg-rose-50 border-rose-200 border-b-2 text-rose-400 line-through';
                    } else if (isConfirmedPrime) {
                      blockCls = isDarkTheme
                        ? 'bg-emerald-600/90 border-emerald-500 border-b-4 border-b-emerald-800 text-white shadow-sm'
                        : 'bg-emerald-500 border-emerald-600 border-b-4 border-b-emerald-700 text-white shadow-sm';
                    }

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setInspectNum(num)}
                        aria-label={`Số ${num}${isConfirmedPrime ? ' (số nguyên tố)' : isCrossed ? ` (hợp số chia hết cho ${crossedBy})` : ''}`}
                        className={`relative rounded-xl border px-1 py-2.5 font-extrabold transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isPresentationMode ? 'text-base' : 'text-sm'
                        } ${blockCls} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <span>{num}</span>
                        {isOne && (
                          <span className="text-[9px] font-bold uppercase tracking-tight leading-none mt-0.5">
                            Đơn vị
                          </span>
                        )}
                        {isCrossed && (
                          <span className="text-[9px] font-bold no-underline opacity-85 leading-none mt-0.5">
                            ×{crossedBy}
                          </span>
                        )}
                        {isConfirmedPrime && (
                          <span className="text-[9px] font-extrabold uppercase tracking-tight leading-none mt-0.5 text-emerald-100">
                            NT
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Cột phải: Kiểm tra & Phân loại số chi tiết */}
          <div className={`lg:col-span-4 rounded-2xl border p-4 space-y-4 flex flex-col justify-between ${surfaceCls}`}>
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Kiểm tra & Phân loại số</span>
              </h3>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={inspectNum}
                  onChange={(e) => setInspectNum(Number(e.target.value))}
                  aria-label="Nhập số cần kiểm tra nguyên tố"
                  className={`flex-1 px-3 py-2 rounded-xl border text-sm font-extrabold outline-none ${inputCls}`}
                />
                {[0, 1, 2, 97, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setInspectNum(v)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      inspectNum === v ? 'bg-teal-600 text-white border-teal-700' : subCardCls
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div
                className={`p-3.5 rounded-xl border space-y-2 ${
                  inspectedClass.isPrime
                    ? 'bg-emerald-500/10 border-emerald-500/35'
                    : inspectedClass.category === 'ZERO' || inspectedClass.category === 'UNIT_ONE'
                      ? 'bg-amber-500/10 border-amber-500/35'
                      : 'bg-sky-500/10 border-sky-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                    Kết quả phân loại:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-white/80 dark:bg-slate-900 text-slate-900 dark:text-white border border-black/10">
                    {inspectedClass.categoryLabelVi}
                  </span>
                </div>
                <p className="text-xs leading-relaxed font-medium">{inspectedClass.explanationVi}</p>
                <div className="pt-1 text-xs">
                  <MathView content={`$${inspectedClass.latexSummary}$`} />
                </div>
              </div>

              {sieveData.isValid && (
                <div className={`p-3 rounded-xl border space-y-2 ${subCardCls}`}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Danh sách số nguyên tố ≤ {sieveData.limit}:</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold">
                      {sieveData.primeCount} số
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5">
                    {sieveData.primes.slice(0, 120).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setInspectNum(p)}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/25 text-xs font-bold cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                    {sieveData.primes.length > 120 && (
                      <span className="text-[11px] text-slate-500 font-semibold">
                        ... và {sieveData.primes.length - 120} số nguyên tố khác
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2.5">
              Chú thích nhanh: Số <strong>0</strong> và <strong>1</strong> không phải số nguyên tố; số nguyên tố nhỏ nhất là <strong>2</strong>.
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 2: CÂY PHÂN TÍCH THỪA SỐ NGUYÊN TỐ
          =================================================================== */}
      {activeTab === 'FACTOR_TREE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className={`lg:col-span-8 rounded-2xl border p-4 space-y-4 ${surfaceCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold">
                  Cây Phân tích Thừa số Nguyên tố (Sơ đồ cây & Cột chia dọc)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Các nút tròn màu xanh ngọc là thừa số nguyên tố (lá cây).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  value={factorInput}
                  onChange={(e) => setFactorInput(Number(e.target.value))}
                  aria-label="Nhập số cần phân tích thừa số nguyên tố"
                  className={`w-28 px-3 py-1.5 rounded-xl border text-sm font-extrabold outline-none ${inputCls}`}
                />
                {[60, 84, 120, 180, 0, 1, -36].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFactorInput(preset)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      factorInput === preset ? 'bg-teal-600 text-white border-teal-700' : subCardCls
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {!factorResult.canFactorize || !treeLayout ? (
              <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-sm font-extrabold">{factorResult.expressionText}</h3>
                <p className="text-xs max-w-lg mx-auto leading-relaxed">{factorResult.noteVi}</p>
                <div className="pt-1">
                  <MathView content={`$${factorResult.latex}$`} />
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl border p-4 overflow-x-auto flex flex-col items-center ${subCardCls}`}>
                <svg
                  viewBox={`0 0 ${treeLayout.width} ${treeLayout.height}`}
                  className="w-full max-w-[680px] h-auto min-h-[220px]"
                  role="img"
                  aria-label={`Cây phân tích thừa số nguyên tố của ${factorResult.absValue}`}
                >
                  {/* Các nhánh nối */}
                  {treeLayout.nodes.map((item) =>
                    item.parentX !== undefined && item.parentY !== undefined ? (
                      <line
                        key={`edge-${item.node.id}`}
                        x1={item.parentX}
                        y1={item.parentY}
                        x2={item.x}
                        y2={item.y}
                        stroke={isDarkTheme ? '#64748b' : '#94a3b8'}
                        strokeWidth={2.5}
                      />
                    ) : null
                  )}
                  {/* Các nút 3D */}
                  {treeLayout.nodes.map((item) => (
                    <g key={item.node.id}>
                      <circle
                        cx={item.x}
                        cy={item.y + 3}
                        r={21}
                        fill={item.node.isPrime ? '#047857' : '#1d4ed8'}
                      />
                      <circle
                        cx={item.x}
                        cy={item.y}
                        r={21}
                        fill={item.node.isPrime ? '#10b981' : '#3b82f6'}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                      <text
                        x={item.x}
                        y={item.y + 5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={item.node.value >= 1000 ? 11 : 13}
                        fontWeight="800"
                      >
                        {item.node.value}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          <div className={`lg:col-span-4 rounded-2xl border p-4 space-y-4 ${surfaceCls}`}>
            <h3 className="text-sm font-extrabold">Kết quả chuẩn & Cột chia dọc</h3>
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Dạng phân tích lũy thừa chuẩn:
              </div>
              <div className={isPresentationMode ? 'text-lg' : 'text-base'}>
                <MathView content={`$${factorResult.latex}$`} />
              </div>
              <p className="text-xs leading-relaxed opacity-90">{factorResult.noteVi}</p>
            </div>

            {factorResult.divisionSteps.length > 0 && (
              <div className={`p-3.5 rounded-xl border space-y-2 ${subCardCls}`}>
                <div className="text-xs font-bold">Bảng chia dọc theo ước nguyên tố nhỏ nhất:</div>
                <div className="font-mono text-xs divide-y divide-slate-200 dark:divide-slate-800 max-h-56 overflow-y-auto">
                  {factorResult.divisionSteps.map((st, idx) => (
                    <div key={idx} className="grid grid-cols-2 py-1">
                      <span className="text-right pr-3 border-r-2 border-teal-600 font-bold">
                        {st.dividend}
                      </span>
                      <span className="pl-3 font-extrabold text-teal-600 dark:text-teal-400">
                        {st.divisor}
                      </span>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 py-1">
                    <span className="text-right pr-3 border-r-2 border-teal-600 font-bold">1</span>
                    <span className="pl-3 text-slate-400">Dừng</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 3: ƯCLN & BCNN BẰNG THUẬT TOÁN EUCLID
          =================================================================== */}
      {activeTab === 'EUCLID_GCD_LCM' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className={`lg:col-span-8 rounded-2xl border p-4 space-y-4 ${surfaceCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold">
                  Thuật toán Euclid tìm ƯCLN(a, b) và BCNN(a, b)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Công thức an toàn chống tràn số: BCNN(a, b) = |a / ƯCLN(a, b) × b|
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="font-bold">a =</label>
                <input
                  type="number"
                  value={euclidA}
                  onChange={(e) => setEuclidA(Number(e.target.value))}
                  aria-label="Số nguyên a"
                  className={`w-24 px-2.5 py-1.5 rounded-xl border font-extrabold outline-none ${inputCls}`}
                />
                <label className="font-bold">b =</label>
                <input
                  type="number"
                  value={euclidB}
                  onChange={(e) => setEuclidB(Number(e.target.value))}
                  aria-label="Số nguyên b"
                  className={`w-24 px-2.5 py-1.5 rounded-xl border font-extrabold outline-none ${inputCls}`}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { a: 24, b: 36, label: '(24, 36)' },
                { a: 12, b: 18, label: '(12, 18)' },
                { a: 0, b: 5, label: 'Biên: (0, 5)' },
                { a: 0, b: 0, label: 'Biên: (0, 0)' },
                { a: -24, b: 36, label: 'Số âm: (-24, 36)' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setEuclidA(p.a);
                    setEuclidB(p.b);
                  }}
                  className={`px-3 py-1 rounded-lg border font-bold cursor-pointer ${
                    euclidA === p.a && euclidB === p.b
                      ? 'bg-teal-600 text-white border-teal-700'
                      : subCardCls
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Thanh tỉ lệ trực quan a và b */}
            {gcdLcmResult.isValid && Math.abs(euclidA) > 0 && Math.abs(euclidB) > 0 && gcdLcmResult.gcd && (
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${subCardCls}`}>
                <div className="text-xs font-bold">
                  Trực quan thước đo chung lớn nhất d = {gcdLcmResult.gcd}:
                </div>
                {[
                  { label: `|a| = ${Math.abs(euclidA)}`, val: Math.abs(euclidA), color: 'bg-blue-500' },
                  { label: `|b| = ${Math.abs(euclidB)}`, val: Math.abs(euclidB), color: 'bg-indigo-500' },
                ].map((bar) => {
                  const maxVal = Math.max(Math.abs(euclidA), Math.abs(euclidB));
                  const pct = (bar.val / maxVal) * 100;
                  const segments = Math.min(30, Math.round(bar.val / gcdLcmResult.gcd!));
                  return (
                    <div key={bar.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{bar.label}</span>
                        <span>= {bar.val / gcdLcmResult.gcd!} đoạn × {gcdLcmResult.gcd}</span>
                      </div>
                      <div className="w-full h-6 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5">
                        <div className="h-full flex gap-0.5" style={{ width: `${pct}%` }}>
                          {Array.from({ length: segments }).map((_, i) => (
                            <div key={i} className={`flex-1 rounded-xs ${bar.color}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bảng từng bước thuật toán Euclid */}
            <div className={`rounded-xl border overflow-hidden ${subCardCls}`}>
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-extrabold">
                Các bước chia có dư liên tiếp (Thuật toán Euclid)
              </div>
              {gcdLcmResult.steps.length === 0 ? (
                <div className="p-4 text-xs leading-relaxed font-medium">
                  {gcdLcmResult.explanationVi}
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {gcdLcmResult.steps.map((st) => (
                    <div
                      key={st.step}
                      className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-bold text-teal-600 dark:text-teal-400">
                        Bước {st.step}:
                      </span>
                      <MathView content={`$${st.equationLatex}$`} />
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold ${
                          st.remainder === 0
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      >
                        Dư r = {st.remainder}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`lg:col-span-4 rounded-2xl border p-4 space-y-4 ${surfaceCls}`}>
            <h3 className="text-sm font-extrabold">Kết luận ƯCLN & BCNN</h3>
            <div
              className={`p-3.5 rounded-xl border space-y-1.5 ${
                gcdLcmResult.gcdStatus === 'UNDEFINED'
                  ? 'bg-amber-500/15 border-amber-500/40'
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider">Ước chung lớn nhất</div>
              <div className="text-base font-extrabold">
                <MathView content={`$${gcdLcmResult.latexGcd}$`} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-sky-500/10 border-sky-500/30 space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider">Bội chung nhỏ nhất</div>
              <div className="text-base font-extrabold">
                <MathView content={`$${gcdLcmResult.latexLcm}$`} />
              </div>
            </div>

            <p className="text-xs leading-relaxed opacity-90">{gcdLcmResult.explanationVi}</p>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 4: BẢNG ƯỚC – BỘI, DẤU HIỆU CHIA HẾT & PHÉP CHIA CÓ DƯ
          =================================================================== */}
      {activeTab === 'DIVISIBILITY_REM' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Bên trái: Bảng Ước – Bội & Dấu hiệu chia hết */}
          <div className={`lg:col-span-7 rounded-2xl border p-4 space-y-4 ${surfaceCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold">Bảng Ước – Bội & Dấu hiệu chia hết</h2>
              <div className="flex items-center gap-2 text-xs">
                <label className="font-bold">Số n =</label>
                <input
                  type="number"
                  value={divRuleNum}
                  onChange={(e) => setDivRuleNum(Number(e.target.value))}
                  aria-label="Số nguyên n kiểm tra ước bội"
                  className={`w-24 px-2.5 py-1.5 rounded-xl border font-extrabold outline-none ${inputCls}`}
                />
                <label className="font-bold">Bội ≤</label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={multipleRangeLimit}
                  onChange={(e) => setMultipleRangeLimit(Number(e.target.value))}
                  aria-label="Phạm vi bội"
                  className={`w-20 px-2.5 py-1.5 rounded-xl border font-bold outline-none ${inputCls}`}
                />
              </div>
            </div>

            {/* Bảng dấu hiệu chia hết cho 2, 3, 5, 9 */}
            {divisibilityAudit.isValid && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {divisibilityAudit.rules.map((r) => (
                  <div
                    key={r.divisor}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      r.divisible
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-500/5 border-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-extrabold">
                      <span>Chia hết cho {r.divisor}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${
                          r.divisible
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {r.divisible ? 'Có' : 'Không'}
                      </span>
                    </div>
                    <p className="opacity-85 leading-relaxed">{r.evidenceVi}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tập ước dương và tập bội */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className={`p-3.5 rounded-xl border space-y-2 ${subCardCls}`}>
                <div className="font-extrabold">
                  Tập ước dương Ư({divRuleNum}) ({divMultResult.divisorCountText}):
                </div>
                {divMultResult.isZero ? (
                  <p className="opacity-80">{divMultResult.noteVi}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {divMultResult.divisors.map((d) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/25"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className={`p-3.5 rounded-xl border space-y-2 ${subCardCls}`}>
                <div className="font-extrabold">
                  Bội không âm B({divRuleNum}) ≤ {divMultResult.multipleLimit}:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {divMultResult.multiples.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/25"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bên phải: Minh họa Phép chia có dư a = b * q + r */}
          <div className={`lg:col-span-5 rounded-2xl border p-4 space-y-4 ${surfaceCls}`}>
            <h3 className="text-base font-extrabold">Minh họa Phép chia có dư (a = b·q + r)</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block font-bold mb-1">Số bị chia (a):</label>
                <input
                  type="number"
                  value={remDividend}
                  onChange={(e) => setRemDividend(Number(e.target.value))}
                  aria-label="Số bị chia a"
                  className={`w-full px-3 py-1.5 rounded-xl border font-extrabold outline-none ${inputCls}`}
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Số chia (b ≠ 0):</label>
                <input
                  type="number"
                  value={remDivisor}
                  onChange={(e) => setRemDivisor(Number(e.target.value))}
                  aria-label="Số chia b"
                  className={`w-full px-3 py-1.5 rounded-xl border font-extrabold outline-none ${inputCls}`}
                />
              </div>
            </div>

            {!remDivision.isValid ? (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold">
                {remDivision.errorVi}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                  <div className="text-sm font-extrabold">
                    <MathView content={`$${remDivision.latex}$`} />
                  </div>
                  <p className="text-xs leading-relaxed">{remDivision.explanationVi}</p>
                </div>

                {/* Minh họa chia nhóm trực quan khi giá trị hợp lý (0 <= a <= 60 và 1 <= b <= 12) */}
                {remDivision.dividend >= 0 &&
                  remDivision.dividend <= 60 &&
                  remDivision.divisor >= 1 &&
                  remDivision.divisor <= 12 && (
                    <div className={`p-3 rounded-xl border space-y-2 ${subCardCls}`}>
                      <div className="text-xs font-bold">
                        Chia {remDivision.dividend} viên vào các nhóm {remDivision.divisor} viên:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: remDivision.quotient }).map((_, gIdx) => (
                          <div
                            key={gIdx}
                            className="p-1.5 rounded-xl bg-teal-500/15 border border-teal-500/35 flex flex-wrap gap-1 max-w-[110px]"
                          >
                            {Array.from({ length: remDivision.divisor }).map((__, dotIdx) => (
                              <span
                                key={dotIdx}
                                className="w-3 h-3 rounded-full bg-teal-500 border-b-2 border-teal-700"
                              />
                            ))}
                          </div>
                        ))}
                        {remDivision.remainder > 0 && (
                          <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50 flex flex-wrap gap-1 items-center">
                            {Array.from({ length: remDivision.remainder }).map((_, rIdx) => (
                              <span
                                key={rIdx}
                                className="w-3 h-3 rounded-full bg-amber-500 border-b-2 border-amber-700"
                              />
                            ))}
                            <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 ml-1">
                              Dư {remDivision.remainder}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
