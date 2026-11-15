import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Grid,
  PieChart,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { MathView } from '../../MathView';
import {
  addFractions,
  applyEquationBalanceOperation,
  compareFractions,
  createExactFraction,
  divideFractions,
  evaluateSingleVarPolynomial,
  formatFractionLatex,
  multiplyFractions,
  solveLinearEquation,
  solveParabolaLineIntersection,
  subtractFractions,
  toCommonDenominator,
  verifyAlgebraicEquivalence,
} from '../mathEngine/mathVerificationEngine';
import { MathGrade } from '../types';

interface ToolCommonProps {
  grade: MathGrade;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  resetSignal: number;
}

// ============================================================================
// M02 – VẼ ĐỒ THỊ HÀM SỐ & KHẢO SÁT TƯƠNG GIAO (FUNCTION GRAPHER)
// ============================================================================

export const M02FunctionGrapherTool: React.FC<ToolCommonProps> = ({
  grade,
  isDarkTheme,
  resetSignal,
}) => {
  const [coefA, setCoefA] = useState<number>(grade === 9 ? 1 : 0);
  const [coefM, setCoefM] = useState<number>(grade === 9 ? 1 : 2);
  const [coefN, setCoefN] = useState<number>(grade === 9 ? 2 : -2);
  const [showParabola, setShowParabola] = useState<boolean>(grade === 9);
  const [showLine, setShowLine] = useState<boolean>(true);

  useEffect(() => {
    if (grade === 9) {
      setCoefA(1);
      setCoefM(1);
      setCoefN(2);
      setShowParabola(true);
      setShowLine(true);
    } else {
      setCoefA(0);
      setCoefM(2);
      setCoefN(-2);
      setShowParabola(false);
      setShowLine(true);
    }
  }, [grade, resetSignal]);

  const intersection = solveParabolaLineIntersection(
    showParabola ? coefA : 0,
    showLine ? coefM : 0,
    showLine ? coefN : 0
  );

  const toSvgX = (x: number) => 280 + x * 28;
  const toSvgY = (y: number) => 210 - y * 28;

  const parabolaPoints: string[] = [];
  if (showParabola) {
    for (let x = -6; x <= 6; x += 0.15) {
      const y = coefA * x * x;
      if (y >= -7 && y <= 7.5) {
        parabolaPoints.push(`${toSvgX(x).toFixed(1)},${toSvgY(y).toFixed(1)}`);
      }
    }
  }

  const xInterceptLine =
    Math.abs(coefM) > 1e-9 ? Number((-coefN / coefM).toFixed(2)) : null;

  const sampleXs = [-2, -1, 0, 1, 2];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`lg:col-span-7 rounded-2xl border p-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
            <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Mặt phẳng tọa độ Oxy & Điểm tương giao
            </span>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={showLine}
                  onChange={(e) => setShowLine(e.target.checked)}
                />
                <span className="text-teal-600">Đường thẳng (d)</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={showParabola}
                  onChange={(e) => {
                    setShowParabola(e.target.checked);
                    if (e.target.checked && coefA === 0) setCoefA(1);
                  }}
                />
                <span className="text-indigo-600">Parabol (P)</span>
              </label>
            </div>
          </div>

          <svg viewBox="0 0 560 380" className="w-full h-80 sm:h-96 rounded-xl border border-slate-200 dark:border-slate-800">
            {[-9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((gx) => (
              <g key={`gx-${gx}`}>
                <line
                  x1={toSvgX(gx)}
                  y1={0}
                  x2={toSvgX(gx)}
                  y2={380}
                  stroke={
                    gx === 0
                      ? isDarkTheme
                        ? '#94a3b8'
                        : '#334155'
                      : isDarkTheme
                      ? '#1e293b'
                      : '#f1f5f9'
                  }
                  strokeWidth={gx === 0 ? 2 : 1}
                />
                {gx !== 0 && gx % 2 === 0 && (
                  <text
                    x={toSvgX(gx) - 5}
                    y={224}
                    fontSize="10"
                    fill={isDarkTheme ? '#64748b' : '#64748b'}
                  >
                    {gx}
                  </text>
                )}
              </g>
            ))}
            {[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7].map((gy) => (
              <g key={`gy-${gy}`}>
                <line
                  x1={0}
                  y1={toSvgY(gy)}
                  x2={560}
                  y2={toSvgY(gy)}
                  stroke={
                    gy === 0
                      ? isDarkTheme
                        ? '#94a3b8'
                        : '#334155'
                      : isDarkTheme
                      ? '#1e293b'
                      : '#f1f5f9'
                  }
                  strokeWidth={gy === 0 ? 2 : 1}
                />
                {gy !== 0 && gy % 2 === 0 && (
                  <text
                    x={286}
                    y={toSvgY(gy) + 4}
                    fontSize="10"
                    fill={isDarkTheme ? '#64748b' : '#64748b'}
                  >
                    {gy}
                  </text>
                )}
              </g>
            ))}

            {showParabola && parabolaPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="#4f46e5"
                strokeWidth="3"
                points={parabolaPoints.join(' ')}
              />
            )}

            {showLine && (
              <line
                x1={toSvgX(-9)}
                y1={toSvgY(coefM * -9 + coefN)}
                x2={toSvgX(9)}
                y2={toSvgY(coefM * 9 + coefN)}
                stroke="#0d9488"
                strokeWidth="2.8"
              />
            )}

            {showParabola &&
              showLine &&
              intersection.points.map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={toSvgX(pt.x)}
                    cy={toSvgY(pt.y)}
                    r={6.5}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={toSvgX(pt.x) + 9}
                    y={toSvgY(pt.y) - 8}
                    fontSize="12"
                    fontWeight="bold"
                    fill="#d97706"
                  >
                    ({Number(pt.x.toFixed(2))}; {Number(pt.y.toFixed(2))})
                  </text>
                </g>
              ))}
          </svg>
        </div>

        <div
          className={`lg:col-span-5 rounded-2xl border p-4 space-y-4 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
            Thanh trượt Hệ số & Bảng giá trị
          </h3>

          {showLine && (
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-2.5 text-xs">
              <div className="font-bold text-teal-800 dark:text-teal-300">
                Đường thẳng (d): y = {coefM}x {coefN >= 0 ? `+ ${coefN}` : `- ${Math.abs(coefN)}`}
              </div>
              <div>
                <label className="flex justify-between font-semibold mb-1">
                  <span>Hệ số góc m:</span>
                  <span className="font-mono font-bold">{coefM}</span>
                </label>
                <input
                  type="range"
                  min={-4}
                  max={4}
                  step={0.5}
                  value={coefM}
                  onChange={(e) => setCoefM(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
              <div>
                <label className="flex justify-between font-semibold mb-1">
                  <span>Tung độ gốc n:</span>
                  <span className="font-mono font-bold">{coefN}</span>
                </label>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.5}
                  value={coefN}
                  onChange={(e) => setCoefN(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                • Giao trục tung Oy: (0; {coefN}) • Giao trục hoành Ox:{' '}
                {xInterceptLine !== null
                  ? `(${xInterceptLine}; 0)`
                  : 'Song song hoặc trùng trục Ox (m = 0)'}
              </div>
            </div>
          )}

          {showParabola && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2 text-xs">
              <div className="font-bold text-indigo-800 dark:text-indigo-300">
                Parabol (P): y = {coefA}x²
              </div>
              <div>
                <label className="flex justify-between font-semibold mb-1">
                  <span>Hệ số a:</span>
                  <span className="font-mono font-bold">{coefA}</span>
                </label>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.25}
                  value={coefA}
                  onChange={(e) => setCoefA(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
              {coefA === 0 && (
                <div className="text-[11px] text-amber-600 font-semibold">
                  Lưu ý: Khi a = 0, hàm số suy biến thành đường thẳng y = 0 (trục hoành Ox).
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse text-center">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="p-1.5 border border-slate-200 dark:border-slate-700">x</th>
                  {sampleXs.map((x) => (
                    <th key={x} className="p-1.5 border border-slate-200 dark:border-slate-700 font-mono">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {showLine && (
                  <tr>
                    <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-bold text-teal-600">
                      y = mx + n
                    </td>
                    {sampleXs.map((x) => (
                      <td key={x} className="p-1.5 border border-slate-200 dark:border-slate-700 font-mono">
                        {Number((coefM * x + coefN).toFixed(2))}
                      </td>
                    ))}
                  </tr>
                )}
                {showParabola && (
                  <tr>
                    <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-bold text-indigo-600">
                      y = ax²
                    </td>
                    {sampleXs.map((x) => (
                      <td key={x} className="p-1.5 border border-slate-200 dark:border-slate-700 font-mono">
                        {Number((coefA * x * x).toFixed(2))}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showParabola && showLine && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs space-y-1">
              <div className="font-bold text-amber-800 dark:text-amber-300">
                Phân tích Tương giao (P) và (d):
              </div>
              <p>{intersection.summaryVi}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M05 – MÔ HÌNH TRỰC QUAN PHÂN SỐ & TỈ SỐ (FRACTION & RATIO VISUALIZER)
// ============================================================================

export const M05FractionVisualizerTool: React.FC<ToolCommonProps> = ({
  isDarkTheme,
  resetSignal,
}) => {
  const [num1, setNum1] = useState<number>(1);
  const [den1, setDen1] = useState<number>(2);
  const [num2, setNum2] = useState<number>(1);
  const [den2, setDen2] = useState<number>(3);
  const [op, setOp] = useState<'+' | '-' | '*' | '/'>('+');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    setNum1(1);
    setDen1(2);
    setNum2(1);
    setDen2(3);
    setOp('+');
    setErrorMsg('');
  }, [resetSignal]);

  const safeDen1 = den1 === 0 ? 1 : den1;
  const safeDen2 = den2 === 0 ? 1 : den2;
  const f1 = createExactFraction(num1, safeDen1);
  const f2 = createExactFraction(num2, safeDen2);
  const common = toCommonDenominator(f1, f2);
  const cmp = compareFractions(f1, f2);
  const cmpSymbol = cmp < 0 ? '<' : cmp > 0 ? '>' : '=';

  let result = f1;
  let divisionZeroError = false;
  if (op === '+') result = addFractions(f1, f2);
  else if (op === '-') result = subtractFractions(f1, f2);
  else if (op === '*') result = multiplyFractions(f1, f2);
  else {
    if (f2.num === 0) {
      divisionZeroError = true;
    } else {
      result = divideFractions(f1, f2);
    }
  }

  const decValue = Number((result.num / result.den).toFixed(4));
  const pctValue = Number(((result.num / result.den) * 100).toFixed(2));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`lg:col-span-7 rounded-2xl border p-4 space-y-4 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
            <PieChart className="w-4 h-4" />
            Mô hình Thanh Phân số & Quy đồng mẫu số chung (Lớp 6–7)
          </h3>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between font-bold">
              <span>
                Phân số A = {num1}/{safeDen1} (Tối giản: {f1.num}/{f1.den})
              </span>
              <span className="text-teal-600">
                Quy đồng mẫu {common.commonDen}: {common.aNum}/{common.commonDen}
              </span>
            </div>
            <div className="grid grid-flow-col auto-cols-fr gap-1 h-9 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {Array.from({ length: Math.min(24, Math.max(1, Math.abs(safeDen1))) }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-md transition ${
                    i < Math.abs(num1)
                      ? 'bg-teal-600 text-white'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between font-bold">
              <span>
                Phân số B = {num2}/{safeDen2} (Tối giản: {f2.num}/{f2.den})
              </span>
              <span className="text-indigo-600">
                Quy đồng mẫu {common.commonDen}: {common.bNum}/{common.commonDen}
              </span>
            </div>
            <div className="grid grid-flow-col auto-cols-fr gap-1 h-9 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {Array.from({ length: Math.min(24, Math.max(1, Math.abs(safeDen2))) }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-md transition ${
                    i < Math.abs(num2)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="font-bold text-amber-700 dark:text-amber-300">
              Mô hình Lưới Mẫu số chung BCNN({f1.den}, {f2.den}) = {common.commonDen}:
            </div>
            <div className="grid grid-flow-col auto-cols-fr gap-0.5 h-10 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {Array.from({ length: Math.min(36, common.commonDen) }).map((_, i) => {
                const n1 = Math.max(0, common.aNum);
                const n2 = Math.max(0, common.bNum);
                const bg =
                  i < n1
                    ? 'bg-teal-600'
                    : i < n1 + n2
                    ? 'bg-indigo-500'
                    : 'bg-white dark:bg-slate-900';
                return <div key={i} className={`rounded-xs ${bg}`} />;
              })}
            </div>
          </div>
        </div>

        <div
          className={`lg:col-span-5 rounded-2xl border p-4 space-y-4 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
            Nhập Phân số & Phép toán Chính xác
          </h3>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-2">
              <div className="font-bold text-teal-800 dark:text-teal-300">Phân số A</div>
              <label className="block">
                <span>Tử số: {num1}</span>
                <input
                  type="range"
                  min={-8}
                  max={10}
                  value={num1}
                  onChange={(e) => setNum1(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </label>
              <label className="block">
                <span>Mẫu số (≠ 0): {safeDen1}</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={safeDen1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v === 0) {
                      setErrorMsg('Mẫu số phải khác 0!');
                    } else {
                      setErrorMsg('');
                      setDen1(v);
                    }
                  }}
                  className="w-full accent-teal-600"
                />
              </label>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
              <div className="font-bold text-indigo-800 dark:text-indigo-300">Phân số B</div>
              <label className="block">
                <span>Tử số: {num2}</span>
                <input
                  type="range"
                  min={-8}
                  max={10}
                  value={num2}
                  onChange={(e) => setNum2(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </label>
              <label className="block">
                <span>Mẫu số (≠ 0): {safeDen2}</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={safeDen2}
                  onChange={(e) => setDen2(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(['+', '-', '*', '/'] as const).map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => setOp(symbol)}
                className={`flex-1 py-2 rounded-xl text-sm font-extrabold border transition ${
                  op === symbol
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : isDarkTheme
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {symbol === '*' ? '×' : symbol === '/' ? '÷' : symbol}
              </button>
            ))}
          </div>

          {divisionZeroError ? (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-bold text-rose-700 dark:text-rose-300">
              Không thể chia cho phân số có tử số bằng 0!
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 text-xs">
              <div className="font-bold text-emerald-800 dark:text-emerald-300">
                Kết quả tính chính xác (rút gọn tối giản bằng ƯCLN):
              </div>
              <MathView
                content={`$$${formatFractionLatex(f1)} ${
                  op === '*' ? '\\cdot' : op === '/' ? ':' : op
                } ${formatFractionLatex(f2)} = ${formatFractionLatex(
                  result
                )} \\approx ${decValue} \\quad (${pctValue}\\%)$$`}
              />
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                So sánh hai phân số: {f1.num}/{f1.den} {cmpSymbol} {f2.num}/{f2.den}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M06 – CÂN THĂNG BẰNG PHƯƠNG TRÌNH (EQUATION BALANCE LAB)
// ============================================================================

export const M06EquationBalanceTool: React.FC<ToolCommonProps> = ({
  isDarkTheme,
  resetSignal,
}) => {
  const [eqState, setEqState] = useState({ a: 2, b: 3, c: 0, d: 9 });
  const [opVal, setOpVal] = useState<number>(3);
  const [feedback, setFeedback] = useState<string>(
    'Phương trình đang ở trạng thái cân bằng. Hãy thực hiện phép biến đổi tương đương lên cả hai vế!'
  );

  useEffect(() => {
    setEqState({ a: 2, b: 3, c: 0, d: 9 });
    setOpVal(3);
    setFeedback('Đã đặt lại phương trình mẫu: 2x + 3 = 9.');
  }, [resetSignal]);

  const solution = solveLinearEquation(eqState);

  const handleApplyOp = (
    type: 'ADD_CONST' | 'SUB_CONST' | 'ADD_X' | 'SUB_X' | 'MUL_BOTH' | 'DIV_BOTH'
  ) => {
    const res = applyEquationBalanceOperation(eqState, type, opVal);
    setFeedback(res.explanationVi);
    if (res.isEquivalent) {
      setEqState(res.next);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setEqState({ a: 2, b: 3, c: 0, d: 9 });
            setFeedback('Phương trình 1 nghiệm duy nhất: 2x + 3 = 9');
          }}
          className="px-3 py-1.5 rounded-xl font-bold bg-teal-600 text-white"
        >
          Mẫu 1: 2x + 3 = 9 (Nghiệm duy nhất)
        </button>
        <button
          type="button"
          onClick={() => {
            setEqState({ a: 3, b: 2, c: 1, d: 10 });
            setFeedback('Phương trình có ẩn ở hai vế: 3x + 2 = x + 10');
          }}
          className="px-3 py-1.5 rounded-xl font-bold bg-indigo-600 text-white"
        >
          Mẫu 2: 3x + 2 = x + 10
        </button>
        <button
          type="button"
          onClick={() => {
            setEqState({ a: 2, b: 4, c: 2, d: 9 });
            setFeedback('Phương trình vô nghiệm: 2x + 4 = 2x + 9');
          }}
          className="px-3 py-1.5 rounded-xl font-bold bg-amber-600 text-white"
        >
          Mẫu 3: 2x + 4 = 2x + 9 (Vô nghiệm)
        </button>
        <button
          type="button"
          onClick={() => {
            setEqState({ a: 2, b: 5, c: 2, d: 5 });
            setFeedback('Phương trình vô số nghiệm: 2x + 5 = 2x + 5');
          }}
          className="px-3 py-1.5 rounded-xl font-bold bg-emerald-600 text-white"
        >
          Mẫu 4: 2x + 5 = 2x + 5 (Vô số nghiệm)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`lg:col-span-7 rounded-2xl border p-4 flex flex-col justify-between ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
            <Scale className="w-4 h-4" />
            Mô hình Cân Thăng Bằng Đại Số
          </div>

          <svg viewBox="0 0 520 250" className="w-full h-60">
            <polygon points="220,235 300,235 260,130" fill="#0f766e" />
            <line x1={80} y1={130} x2={440} y2={130} stroke="#0d9488" strokeWidth="6" />
            <line x1={120} y1={130} x2={120} y2={165} stroke="#64748b" strokeWidth="2.5" />
            <rect x={45} y={165} width={150} height={12} rx={6} fill="#0284c7" />
            <rect
              x={55}
              y={95}
              width={130}
              height={62}
              rx={12}
              fill="rgba(14, 165, 233, 0.14)"
              stroke="#0284c7"
              strokeWidth="2"
            />
            <text x={120} y={132} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#0284c7">
              {eqState.a}x {eqState.b >= 0 ? `+ ${eqState.b}` : `- ${Math.abs(eqState.b)}`}
            </text>

            <circle cx={260} cy={130} r={18} fill="#f59e0b" />
            <text x={260} y={136} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#fff">
              =
            </text>

            <line x1={400} y1={130} x2={400} y2={165} stroke="#64748b" strokeWidth="2.5" />
            <rect x={325} y={165} width={150} height={12} rx={6} fill="#4f46e5" />
            <rect
              x={335}
              y={95}
              width={130}
              height={62}
              rx={12}
              fill="rgba(79, 70, 229, 0.14)"
              stroke="#4f46e5"
              strokeWidth="2"
            />
            <text x={400} y={132} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#4f46e5">
              {eqState.c !== 0
                ? `${eqState.c}x ${eqState.d >= 0 ? `+ ${eqState.d}` : `- ${Math.abs(eqState.d)}`}`
                : `${eqState.d}`}
            </text>
          </svg>

          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs font-semibold">
            {feedback}
          </div>
        </div>

        <div
          className={`lg:col-span-5 rounded-2xl border p-4 space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
            Thực hiện Phép toán lên CẢ HAI VẾ
          </h3>

          <div className="text-xs">
            <label className="block font-bold mb-1">
              Chọn giá trị hằng số k để tác động lên 2 vế:
            </label>
            <input
              type="number"
              value={opVal}
              onChange={(e) => setOpVal(Number(e.target.value))}
              className={`w-full rounded-xl px-3 py-2 border font-mono font-bold ${
                isDarkTheme
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleApplyOp('SUB_CONST')}
              className="p-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white transition"
            >
              Trừ {opVal} ở hai vế
            </button>
            <button
              type="button"
              onClick={() => handleApplyOp('ADD_CONST')}
              className="p-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white transition"
            >
              Cộng {opVal} vào hai vế
            </button>
            <button
              type="button"
              onClick={() => handleApplyOp('SUB_X')}
              className="p-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white transition"
            >
              Bớt {opVal}x ở hai vế
            </button>
            <button
              type="button"
              onClick={() => handleApplyOp('DIV_BOTH')}
              className="p-2.5 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-600 hover:text-white transition"
            >
              Chia hai vế cho {opVal}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5">
            <div className="font-extrabold text-emerald-800 dark:text-emerald-300">
              Lời giải chuẩn & Phân loại tập nghiệm:
            </div>
            <p className="font-semibold">{solution.summaryVi}</p>
            <MathView content={`$$${solution.latexSolution}$$`} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M07 – TRỤC SỐ TƯƠNG TÁC & SỐ NGUYÊN, SỐ THỰC (NUMBER LINE LAB)
// ============================================================================

export const M07NumberLineIntegersTool: React.FC<ToolCommonProps> = ({
  grade,
  isDarkTheme,
  resetSignal,
}) => {
  const [startInt, setStartInt] = useState<number>(-3);
  const [stepInt, setStepInt] = useState<number>(5);
  const [showSqrt2, setShowSqrt2] = useState<boolean>(grade >= 7);
  const [ineqBound, setIneqBound] = useState<number>(2);

  useEffect(() => {
    setStartInt(-3);
    setStepInt(5);
    setShowSqrt2(grade >= 7);
    setIneqBound(2);
  }, [grade, resetSignal]);

  const sumInt = startInt + stepInt;
  const toLineX = (v: number) => 280 + v * 28;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-4 space-y-4 ${
          isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
            <ArrowRight className="w-4 h-4" />
            Trục số Biểu diễn Vector Số nguyên, Số vô tỉ √2 & Bất phương trình
          </span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold">
            <input
              type="checkbox"
              checked={showSqrt2}
              onChange={(e) => setShowSqrt2(e.target.checked)}
            />
            <span>Dựng cung tròn biểu diễn √2 ≈ 1,4142 (Lớp 7)</span>
          </label>
        </div>

        <svg viewBox="0 0 560 190" className="w-full h-48">
          <line x1={20} y1={120} x2={540} y2={120} stroke="#334155" strokeWidth="2.5" />
          {[-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <g key={n}>
              <line
                x1={toLineX(n)}
                y1={114}
                x2={toLineX(n)}
                y2={126}
                stroke={n === 0 ? '#0d9488' : '#64748b'}
                strokeWidth={n === 0 ? 3 : 1.5}
              />
              <text
                x={toLineX(n)}
                y={144}
                textAnchor="middle"
                fontSize="11"
                fontWeight={n === 0 ? 'bold' : 'normal'}
                fill={n === 0 ? '#0d9488' : '#64748b'}
              >
                {n}
              </text>
            </g>
          ))}

          <line
            x1={toLineX(0)}
            y1={88}
            x2={toLineX(startInt)}
            y2={88}
            stroke="#0284c7"
            strokeWidth="4"
          />
          <circle cx={toLineX(startInt)} cy={88} r={5} fill="#0284c7" />

          <line
            x1={toLineX(startInt)}
            y1={62}
            x2={toLineX(sumInt)}
            y2={62}
            stroke="#f59e0b"
            strokeWidth="4"
          />
          <circle cx={toLineX(sumInt)} cy={62} r={6} fill="#f59e0b" />
          <text
            x={toLineX(sumInt)}
            y={48}
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill="#d97706"
          >
            Kết quả: {sumInt}
          </text>

          {showSqrt2 && (
            <g>
              <rect
                x={toLineX(0)}
                y={120 - 28}
                width={28}
                height={28}
                fill="rgba(16, 185, 129, 0.2)"
                stroke="#059669"
                strokeWidth="1.8"
              />
              <line
                x1={toLineX(0)}
                y1={120}
                x2={toLineX(1)}
                y2={120 - 28}
                stroke="#059669"
                strokeWidth="2"
              />
              <circle cx={toLineX(Math.SQRT2)} cy={120} r={4.5} fill="#dc2626" />
              <text
                x={toLineX(Math.SQRT2)}
                y={165}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#dc2626"
              >
                √2 ≈ 1.414
              </text>
            </g>
          )}
        </svg>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <label className="flex justify-between font-bold mb-1">
              <span>Số hạng đầu a:</span>
              <span className="font-mono">{startInt}</span>
            </label>
            <input
              type="range"
              min={-6}
              max={6}
              value={startInt}
              onChange={(e) => setStartInt(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <label className="flex justify-between font-bold mb-1">
              <span>Độ dịch chuyển b:</span>
              <span className="font-mono">{stepInt >= 0 ? `+${stepInt}` : stepInt}</span>
            </label>
            <input
              type="range"
              min={-6}
              max={6}
              value={stepInt}
              onChange={(e) => setStepInt(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col justify-center">
            <div className="font-bold text-emerald-800 dark:text-emerald-300">
              Phép cộng số nguyên & Giá trị tuyệt đối:
            </div>
            <MathView
              content={`$$(${startInt}) + (${stepInt}) = ${sumInt}, \\quad |${startInt}| = ${Math.abs(
                startInt
              )}$$`}
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>Tập nghiệm bất phương trình (Lớp 9):</strong> x ≥ {ineqBound} ⇒ [{ineqBound}; +∞)
          </div>
          <input
            type="range"
            min={-5}
            max={5}
            value={ineqBound}
            onChange={(e) => setIneqBound(Number(e.target.value))}
            className="w-44 accent-teal-600"
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M09 – GẠCH ĐẠI SỐ & HẰNG ĐẲNG THỨC (ALGEBRA TILES & POLYNOMIAL VERIFIER)
// ============================================================================

export const M09AlgebraTilesIdentityTool: React.FC<ToolCommonProps> = ({
  isDarkTheme,
  resetSignal,
}) => {
  const [tileA, setTileA] = useState<number>(3);
  const [tileB, setTileB] = useState<number>(2);
  const [exprLeft, setExprLeft] = useState<string>('(x + 2)^2');
  const [exprRight, setExprRight] = useState<string>('x^2 + 4x + 4');

  useEffect(() => {
    setTileA(3);
    setTileB(2);
    setExprLeft('(x + 2)^2');
    setExprRight('x^2 + 4x + 4');
  }, [resetSignal]);

  const verification = verifyAlgebraicEquivalence(exprLeft, exprRight);
  const samplePoints = [-2, -1, 0, 1, 2].map((x) => ({
    x,
    val1: evaluateSingleVarPolynomial(exprLeft, x),
    val2: evaluateSingleVarPolynomial(exprRight, x),
  }));

  const totalSide = tileA + tileB;
  const scale = 28;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`lg:col-span-6 rounded-2xl border p-4 space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
            <Grid className="w-4 h-4" />
            Mô hình Diện tích Gạch Đại số (a + b)² = a² + 2ab + b² (Lớp 8)
          </h3>

          <svg viewBox="0 0 320 260" className="w-full h-60">
            <g transform="translate(50, 20)">
              <rect
                x={0}
                y={0}
                width={tileA * scale}
                height={tileA * scale}
                fill="rgba(13, 148, 136, 0.28)"
                stroke="#0f766e"
                strokeWidth="2"
              />
              <text
                x={(tileA * scale) / 2}
                y={(tileA * scale) / 2 + 4}
                textAnchor="middle"
                fontSize="13"
                fontWeight="bold"
                fill="#0f766e"
              >
                a² = {tileA * tileA}
              </text>

              <rect
                x={tileA * scale}
                y={0}
                width={tileB * scale}
                height={tileA * scale}
                fill="rgba(245, 158, 11, 0.25)"
                stroke="#d97706"
                strokeWidth="2"
              />
              <text
                x={tileA * scale + (tileB * scale) / 2}
                y={(tileA * scale) / 2 + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#b45309"
              >
                ab={tileA * tileB}
              </text>

              <rect
                x={0}
                y={tileA * scale}
                width={tileA * scale}
                height={tileB * scale}
                fill="rgba(245, 158, 11, 0.25)"
                stroke="#d97706"
                strokeWidth="2"
              />
              <text
                x={(tileA * scale) / 2}
                y={tileA * scale + (tileB * scale) / 2 + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#b45309"
              >
                ab={tileA * tileB}
              </text>

              <rect
                x={tileA * scale}
                y={tileA * scale}
                width={tileB * scale}
                height={tileB * scale}
                fill="rgba(99, 102, 241, 0.28)"
                stroke="#4f46e5"
                strokeWidth="2"
              />
              <text
                x={tileA * scale + (tileB * scale) / 2}
                y={tileA * scale + (tileB * scale) / 2 + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#4338ca"
              >
                b²={tileB * tileB}
              </text>
            </g>
          </svg>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="flex justify-between font-bold mb-1">
                <span>Cạnh a:</span>
                <span className="font-mono">{tileA}</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={tileA}
                onChange={(e) => setTileA(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>
            <div>
              <label className="flex justify-between font-bold mb-1">
                <span>Cạnh b:</span>
                <span className="font-mono">{tileB}</span>
              </label>
              <input
                type="range"
                min={1}
                max={3}
                value={tileB}
                onChange={(e) => setTileB(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs">
            <MathView
              content={`$$(${tileA} + ${tileB})^2 = ${totalSide}^2 = ${
                totalSide * totalSide
              } = ${tileA}^2 + 2\\cdot${tileA}\\cdot${tileB} + ${tileB}^2$$`}
            />
          </div>
        </div>

        <div
          className={`lg:col-span-6 rounded-2xl border p-4 space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <h3 className="text-sm font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
            <Calculator className="w-4 h-4" />
            Kiểm định Tương đương Đa thức Đa điểm (Không so khớp chuỗi thô)
          </h3>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setExprLeft('(x + 3)^2');
                setExprRight('x^2 + 6x + 9');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
            >
              (x+3)² = x²+6x+9
            </button>
            <button
              type="button"
              onClick={() => {
                setExprLeft('(x - 2)(x + 2)');
                setExprRight('x^2 - 4');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
            >
              (x-2)(x+2) = x²-4
            </button>
            <button
              type="button"
              onClick={() => {
                setExprLeft('2x + 3');
                setExprRight('3 + 2x');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
            >
              Giao hoán: 2x+3 = 3+2x
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold mb-1">Biểu thức Vế trái A(x):</label>
              <input
                type="text"
                value={exprLeft}
                onChange={(e) => setExprLeft(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 border font-mono ${
                  isDarkTheme
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Biểu thức Vế phải B(x):</label>
              <input
                type="text"
                value={exprRight}
                onChange={(e) => setExprRight(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 border font-mono ${
                  isDarkTheme
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              verification.isEquivalent
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-bold">
              {!verification.isValidSyntax
                ? 'Cú pháp biểu thức chưa hợp lệ (chỉ dùng biến x và phép +, -, *, ^).'
                : verification.isEquivalent
                ? 'Hai đa thức tương đương đại số trên toàn bộ 7 điểm mẫu kiểm định!'
                : `Hai biểu thức KHÔNG tương đương (sai khác tại x = ${verification.mismatchSampleX}).`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse text-center">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="p-1.5 border border-slate-200 dark:border-slate-700">Điểm thử x</th>
                  {samplePoints.map((pt) => (
                    <th key={pt.x} className="p-1.5 border border-slate-200 dark:border-slate-700 font-mono">
                      {pt.x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-bold">
                    A(x)
                  </td>
                  {samplePoints.map((pt) => (
                    <td key={pt.x} className="p-1.5 border border-slate-200 dark:border-slate-700 font-mono">
                      {pt.val1 ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-bold">
                    B(x)
                  </td>
                  {samplePoints.map((pt) => (
                    <td key={pt.x} className="p-1.5 border border-slate-200 dark:border-slate-700 font-mono">
                      {pt.val2 ?? '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
