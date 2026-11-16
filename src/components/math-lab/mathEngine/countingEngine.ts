export type CountingScenarioId = 'CLOTHES' | 'DIGITS' | 'COIN_DIE' | 'CUSTOM';

export type CountingEventFilter =
  | 'ALL'
  | 'EVEN_NUMBER'
  | 'HEADS_AND_EVEN'
  | 'CONTAINS_1';

export interface TreeStageSpec {
  stageName: string;
  options: string[];
}

export interface TreeNodeVisual {
  id: string;
  parentId: string | null;
  level: number; // 0 = root
  label: string;
  pathLabels: string[];
  xNorm: number; // 0..1
  yNorm: number; // 0..1
  isLeaf: boolean;
  matchesEvent: boolean;
}

export interface TreeEdgeVisual {
  fromId: string;
  toId: string;
  matchesEvent: boolean;
}

export interface CountingTreeResult {
  valid: boolean;
  errorVi?: string;
  scenarioId: CountingScenarioId;
  stageNames: string[];
  totalOutcomes: number;
  matchingOutcomes: number;
  probability: number;
  displayedLeafCount: number;
  isTruncatedForDisplay: boolean;
  nodes: TreeNodeVisual[];
  edges: TreeEdgeVisual[];
  outcomesList: { path: string[]; matchesEvent: boolean }[];
  formulaLatex: string;
}

export interface RuleCalculationResult {
  valid: boolean;
  errorVi?: string;
  rule: 'ADDITION' | 'MULTIPLICATION';
  counts: number[];
  total: number;
  summaryLatex: string;
}

export interface CombinatoricsResult {
  valid: boolean;
  errorVi?: string;
  kind: 'PERMUTATION' | 'ARRANGEMENT' | 'COMBINATION';
  n: number;
  k: number;
  value: number;
  formulaLatex: string;
  explanationVi: string;
}

export const MAX_SAFE_FACTORIAL_N = 18;
export const MAX_TREE_DISPLAY_LEAVES = 48;

export function calculateAdditionRule(counts: number[]): RuleCalculationResult {
  if (counts.length === 0) {
    return {
      valid: false,
      errorVi: 'Cần ít nhất 1 phương án để tính quy tắc cộng.',
      rule: 'ADDITION',
      counts: [],
      total: 0,
      summaryLatex: '',
    };
  }
  for (const c of counts) {
    if (!Number.isFinite(c) || !Number.isInteger(c) || c < 0) {
      return {
        valid: false,
        errorVi: 'Số cách ở mỗi phương án phải là số nguyên không âm.',
        rule: 'ADDITION',
        counts,
        total: 0,
        summaryLatex: '\\text{Số liệu không hợp lệ}',
      };
    }
  }
  const total = counts.reduce((acc, v) => acc + v, 0);
  return {
    valid: true,
    rule: 'ADDITION',
    counts,
    total,
    summaryLatex: `${counts.join(' + ')} = ${total}`,
  };
}

export function calculateMultiplicationRule(counts: number[]): RuleCalculationResult {
  if (counts.length === 0) {
    return {
      valid: false,
      errorVi: 'Cần ít nhất 1 công đoạn để tính quy tắc nhân.',
      rule: 'MULTIPLICATION',
      counts: [],
      total: 0,
      summaryLatex: '',
    };
  }
  for (const c of counts) {
    if (!Number.isFinite(c) || !Number.isInteger(c) || c < 0) {
      return {
        valid: false,
        errorVi: 'Số cách ở mỗi công đoạn phải là số nguyên không âm.',
        rule: 'MULTIPLICATION',
        counts,
        total: 0,
        summaryLatex: '\\text{Số liệu không hợp lệ}',
      };
    }
  }
  const total = counts.reduce((acc, v) => acc * v, 1);
  return {
    valid: true,
    rule: 'MULTIPLICATION',
    counts,
    total,
    summaryLatex: `${counts.join(' \\times ')} = ${total}`,
  };
}

export function factorialExact(n: number): number | null {
  if (!Number.isInteger(n) || n < 0 || n > MAX_SAFE_FACTORIAL_N) {
    return null;
  }
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
  }
  return res;
}

export function computeCombinatorics(
  kind: 'PERMUTATION' | 'ARRANGEMENT' | 'COMBINATION',
  n: number,
  kInput?: number
): CombinatoricsResult {
  const k = kind === 'PERMUTATION' ? n : (kInput ?? 0);

  if (!Number.isInteger(n) || n < 0) {
    return {
      valid: false,
      errorVi: 'Tham số n phải là số nguyên không âm (n ≥ 0).',
      kind,
      n,
      k,
      value: 0,
      formulaLatex: '\\text{Lỗi tham số } n',
      explanationVi: 'Không xác định giai thừa cho số âm.',
    };
  }

  if (n > MAX_SAFE_FACTORIAL_N) {
    return {
      valid: false,
      errorVi: `Để đảm bảo độ chính xác số nguyên tuyệt đối trong trình duyệt, n được giới hạn tối đa là ${MAX_SAFE_FACTORIAL_N}.`,
      kind,
      n,
      k,
      value: 0,
      formulaLatex: `n > ${MAX_SAFE_FACTORIAL_N}`,
      explanationVi: 'Vượt ngưỡng an toàn chính xác số nguyên 53-bit.',
    };
  }

  if (kind !== 'PERMUTATION' && (!Number.isInteger(k) || k < 0 || k > n)) {
    return {
      valid: false,
      errorVi: `Điều kiện bắt buộc là 0 ≤ k ≤ n (đang nhập k = ${k}, n = ${n}).`,
      kind,
      n,
      k,
      value: 0,
      formulaLatex: '\\text{Vi phạm } 0 \\le k \\le n',
      explanationVi: 'Số phần tử được chọn k phải nằm trong [0; n].',
    };
  }

  if (kind === 'PERMUTATION') {
    const val = factorialExact(n) ?? 1;
    return {
      valid: true,
      kind,
      n,
      k: n,
      value: val,
      formulaLatex: `P_{${n}} = ${n}! = ${val.toLocaleString('en-US').replace(/,/g, '\\,')}`,
      explanationVi: `Số cách sắp xếp thứ tự toàn bộ ${n} phần tử khác nhau là ${n}! = ${val}.`,
    };
  }

  if (kind === 'ARRANGEMENT') {
    let val = 1;
    for (let i = 0; i < k; i++) {
      val *= n - i;
    }
    return {
      valid: true,
      kind,
      n,
      k,
      value: val,
      formulaLatex: `A_{${n}}^{${k}} = \\frac{${n}!}{(${n} - ${k})!} = ${val.toLocaleString('en-US').replace(/,/g, '\\,')}`,
      explanationVi: `Số cách chọn ${k} phần tử từ ${n} phần tử CÓ XẾP THỨ TỰ là ${val}.`,
    };
  }

  // COMBINATION: tính bằng tích rút gọn để tránh tràn trung gian
  const r = Math.min(k, n - k);
  let num = 1;
  for (let i = 1; i <= r; i++) {
    num = (num * (n - r + i)) / i;
  }
  const val = Math.round(num);
  return {
    valid: true,
    kind,
    n,
    k,
    value: val,
    formulaLatex: `C_{${n}}^{${k}} = \\binom{${n}}{${k}} = \\frac{${n}!}{${k}!(${n}-${k})!} = ${val.toLocaleString('en-US').replace(/,/g, '\\,')}`,
    explanationVi: `Số cách chọn tập con ${k} phần tử từ ${n} phần tử KHÔNG PHÂN BIỆT THỨ TỰ là ${val}.`,
  };
}

function evaluateEventMatch(path: string[], filter: CountingEventFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'EVEN_NUMBER') {
    const last = path[path.length - 1] ?? '';
    const num = Number(last);
    return Number.isFinite(num) && num % 2 === 0;
  }
  if (filter === 'HEADS_AND_EVEN') {
    const first = path[0] ?? '';
    const last = Number(path[path.length - 1] ?? '');
    return first.startsWith('Ngửa') && Number.isFinite(last) && last % 2 === 0;
  }
  if (filter === 'CONTAINS_1') {
    return path.some((p) => p === '1' || p.includes('1'));
  }
  return true;
}

/**
 * Xây dựng sơ đồ cây liệt kê toàn bộ không gian mẫu (chống lag DOM khi cây quá 48 lá).
 */
export function buildCountingTree(params: {
  scenarioId: CountingScenarioId;
  stages: TreeStageSpec[];
  noZeroFirstDigit?: boolean;
  distinctItems?: boolean;
  eventFilter?: CountingEventFilter;
}): CountingTreeResult {
  const {
    scenarioId,
    stages,
    noZeroFirstDigit = false,
    distinctItems = false,
    eventFilter = 'ALL',
  } = params;

  if (stages.length === 0 || stages.some((s) => s.options.length === 0)) {
    return {
      valid: false,
      errorVi: 'Mỗi công đoạn trong sơ đồ cây cần có ít nhất 1 lựa chọn.',
      scenarioId,
      stageNames: [],
      totalOutcomes: 0,
      matchingOutcomes: 0,
      probability: 0,
      displayedLeafCount: 0,
      isTruncatedForDisplay: false,
      nodes: [],
      edges: [],
      outcomesList: [],
      formulaLatex: '\\text{Không có nhánh hợp lệ}',
    };
  }

  // Duyệt DFS thu thập toàn bộ đường đi hợp lệ (chặn tối đa 5.000 lá trong bộ nhớ)
  const outcomesList: { path: string[]; matchesEvent: boolean }[] = [];
  const MAX_MEMORY_OUTCOMES = 5000;

  const dfs = (stageIdx: number, currentPath: string[]) => {
    if (outcomesList.length >= MAX_MEMORY_OUTCOMES) return;
    if (stageIdx === stages.length) {
      outcomesList.push({
        path: currentPath,
        matchesEvent: evaluateEventMatch(currentPath, eventFilter),
      });
      return;
    }

    const opts = stages[stageIdx].options;
    for (const opt of opts) {
      if (scenarioId === 'DIGITS' && noZeroFirstDigit && stageIdx === 0 && opt === '0') {
        continue;
      }
      if (distinctItems && currentPath.includes(opt)) {
        continue;
      }
      dfs(stageIdx + 1, [...currentPath, opt]);
    }
  };

  dfs(0, []);

  if (outcomesList.length === 0) {
    return {
      valid: false,
      errorVi: 'Không tồn tại kết quả nào thỏa mãn đồng thời các ràng buộc hiện tại.',
      scenarioId,
      stageNames: stages.map((s) => s.stageName),
      totalOutcomes: 0,
      matchingOutcomes: 0,
      probability: 0,
      displayedLeafCount: 0,
      isTruncatedForDisplay: false,
      nodes: [],
      edges: [],
      outcomesList: [],
      formulaLatex: 'n(\\Omega) = 0',
    };
  }

  const totalOutcomes = outcomesList.length;
  const matchingOutcomes = outcomesList.filter((o) => o.matchesEvent).length;
  const probability = totalOutcomes > 0 ? matchingOutcomes / totalOutcomes : 0;

  // Dựng cây hiển thị từ các nhánh đầu tiên (tối đa MAX_TREE_DISPLAY_LEAVES)
  const visibleOutcomes = outcomesList.slice(0, MAX_TREE_DISPLAY_LEAVES);
  const isTruncatedForDisplay = totalOutcomes > MAX_TREE_DISPLAY_LEAVES;

  const nodesMap = new Map<string, TreeNodeVisual>();
  const edges: TreeEdgeVisual[] = [];
  const totalLevels = stages.length;

  // Root
  nodesMap.set('root', {
    id: 'root',
    parentId: null,
    level: 0,
    label: 'Bắt đầu',
    pathLabels: [],
    xNorm: 0.06,
    yNorm: 0.5,
    isLeaf: false,
    matchesEvent: matchingOutcomes > 0,
  });

  // Gán yNorm cho các lá đều nhau
  const leafCount = visibleOutcomes.length;
  const childrenByParent = new Map<string, string[]>();

  visibleOutcomes.forEach((outcome, leafIdx) => {
    let parentId = 'root';
    let pathSoFar: string[] = [];

    outcome.path.forEach((opt, depthIdx) => {
      pathSoFar = [...pathSoFar, opt];
      const level = depthIdx + 1;
      const nodeId = `n_${pathSoFar.join('|')}`;
      const isLeaf = level === totalLevels;

      if (!nodesMap.has(nodeId)) {
        const leafY =
          leafCount === 1 ? 0.5 : 0.08 + (leafIdx / Math.max(1, leafCount - 1)) * 0.84;
        nodesMap.set(nodeId, {
          id: nodeId,
          parentId,
          level,
          label: opt,
          pathLabels: pathSoFar,
          xNorm: 0.06 + (level / totalLevels) * 0.86,
          yNorm: isLeaf ? leafY : 0,
          isLeaf,
          matchesEvent: isLeaf ? outcome.matchesEvent : false,
        });
        edges.push({
          fromId: parentId,
          toId: nodeId,
          matchesEvent: outcome.matchesEvent,
        });
        const list = childrenByParent.get(parentId) ?? [];
        list.push(nodeId);
        childrenByParent.set(parentId, list);
      } else if (outcome.matchesEvent) {
        const existingNode = nodesMap.get(nodeId)!;
        existingNode.matchesEvent = true;
        const edge = edges.find((e) => e.fromId === parentId && e.toId === nodeId);
        if (edge) edge.matchesEvent = true;
      }

      parentId = nodeId;
    });
  });

  // Tính yNorm cho các nút trung gian theo trung bình các con từ dưới lên
  for (let lvl = totalLevels - 1; lvl >= 0; lvl--) {
    nodesMap.forEach((node) => {
      if (node.level === lvl && !node.isLeaf) {
        const kids = childrenByParent.get(node.id) ?? [];
        if (kids.length > 0) {
          const avgY =
            kids.reduce((acc, kidId) => acc + (nodesMap.get(kidId)?.yNorm ?? 0.5), 0) /
            kids.length;
          node.yNorm = avgY;
          node.matchesEvent = kids.some((kidId) => nodesMap.get(kidId)?.matchesEvent);
        }
      }
    });
  }

  const stageCountsDesc =
    scenarioId === 'DIGITS' && (noZeroFirstDigit || distinctItems)
      ? stages
          .map((s, idx) => {
            let count = s.options.length;
            if (noZeroFirstDigit && idx === 0 && s.options.includes('0')) count -= 1;
            if (distinctItems) count = Math.max(0, count - (idx === 0 ? 0 : idx - (noZeroFirstDigit && s.options.includes('0') ? 0 : 0)));
            return count;
          })
      : stages.map((s) => s.options.length);

  const formulaLatex =
    eventFilter === 'ALL'
      ? `n(\\Omega) = ${
          scenarioId === 'DIGITS' && distinctItems
            ? totalOutcomes
            : `${stageCountsDesc.join(' \\times ')} = ${totalOutcomes}`
        }`
      : `n(\\Omega) = ${totalOutcomes}, \\quad n(E) = ${matchingOutcomes} \\;\\Rightarrow\\; P(E) = \\frac{${matchingOutcomes}}{${totalOutcomes}} = ${Number(
          probability.toFixed(4)
        )}`;

  return {
    valid: true,
    scenarioId,
    stageNames: stages.map((s) => s.stageName),
    totalOutcomes,
    matchingOutcomes,
    probability,
    displayedLeafCount: visibleOutcomes.length,
    isTruncatedForDisplay,
    nodes: Array.from(nodesMap.values()),
    edges,
    outcomesList,
    formulaLatex,
  };
}

// ============================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG M17 (10 TEST CASE BẮT BUỘC)
// ============================================================================

export interface M17UnitTestCaseResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runM17UnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
  cases: M17UnitTestCaseResult[];
} {
  const cases: M17UnitTestCaseResult[] = [];

  // 1. Quy tắc cộng: 3 + 2 = 5
  const addRes = calculateAdditionRule([3, 2]);
  cases.push({
    id: 'm17_add_rule',
    label: 'Quy tắc cộng: 3 phương án + 2 phương án = 5 cách',
    passed: addRes.valid && addRes.total === 5,
    detail: `total = ${addRes.total}`,
  });

  // 2. Quy tắc nhân: 4 áo * 3 quần * 2 mũ = 24
  const mulRes = calculateMultiplicationRule([4, 3, 2]);
  cases.push({
    id: 'm17_mul_rule',
    label: 'Quy tắc nhân: 4 × 3 × 2 = 24 bộ trang phục',
    passed: mulRes.valid && mulRes.total === 24,
    detail: `total = ${mulRes.total}`,
  });

  // 3. Lập số 2 chữ số từ {0,1,2,3} (khác 0 đầu, được lặp) = 3 * 4 = 12
  const digitsRepeat = buildCountingTree({
    scenarioId: 'DIGITS',
    stages: [
      { stageName: 'Hàng chục', options: ['0', '1', '2', '3'] },
      { stageName: 'Hàng đơn vị', options: ['0', '1', '2', '3'] },
    ],
    noZeroFirstDigit: true,
    distinctItems: false,
  });
  cases.push({
    id: 'm17_digits_repeat',
    label: 'Lập số 2 chữ số từ {0,1,2,3} (chục ≠ 0, được lặp) ⇒ 12 số',
    passed: digitsRepeat.valid && digitsRepeat.totalOutcomes === 12,
    detail: `n(Ω) = ${digitsRepeat.totalOutcomes}`,
  });

  // 4. Lập số 2 chữ số khác nhau từ {0,1,2,3} (khác 0 đầu) = 3 * 3 = 9
  const digitsDistinct = buildCountingTree({
    scenarioId: 'DIGITS',
    stages: [
      { stageName: 'Hàng chục', options: ['0', '1', '2', '3'] },
      { stageName: 'Hàng đơn vị', options: ['0', '1', '2', '3'] },
    ],
    noZeroFirstDigit: true,
    distinctItems: true,
  });
  cases.push({
    id: 'm17_digits_distinct',
    label: 'Lập số 2 chữ số đôi một khác nhau từ {0,1,2,3} ⇒ 9 số',
    passed: digitsDistinct.valid && digitsDistinct.totalOutcomes === 9,
    detail: `n(Ω) = ${digitsDistinct.totalOutcomes}`,
  });

  // 5. Cây phép thử Đồng xu + Xúc xắc: n(Ω)=12, biến cố Ngửa & Chẵn => 3/12 = 0.25
  const coinDie = buildCountingTree({
    scenarioId: 'COIN_DIE',
    stages: [
      { stageName: 'Đồng xu', options: ['Sấp (S)', 'Ngửa (N)'] },
      { stageName: 'Xúc xắc', options: ['1', '2', '3', '4', '5', '6'] },
    ],
    eventFilter: 'HEADS_AND_EVEN',
  });
  cases.push({
    id: 'm17_coin_die_prob',
    label: 'Sơ đồ cây Đồng xu × Xúc xắc: n(Ω)=12, P(Ngửa & Chẵn) = 3/12 = 0.25',
    passed:
      coinDie.valid &&
      coinDie.totalOutcomes === 12 &&
      coinDie.matchingOutcomes === 3 &&
      Math.abs(coinDie.probability - 0.25) < 1e-9,
    detail: `n(Ω)=${coinDie.totalOutcomes}, n(E)=${coinDie.matchingOutcomes}, P=${coinDie.probability}`,
  });

  // 6. Hoán vị (Mở rộng): 0! = 1, 5! = 120
  const p0 = computeCombinatorics('PERMUTATION', 0);
  const p5 = computeCombinatorics('PERMUTATION', 5);
  cases.push({
    id: 'm17_perm',
    label: 'Hoán vị (Mở rộng): P_0 = 0! = 1 và P_5 = 5! = 120',
    passed: p0.valid && p0.value === 1 && p5.valid && p5.value === 120,
    detail: `0!=${p0.value}, 5!=${p5.value}`,
  });

  // 7. Chỉnh hợp & Tổ hợp (Mở rộng): A(5,2)=20, C(5,2)=10, C(6,0)=1, C(6,6)=1
  const a52 = computeCombinatorics('ARRANGEMENT', 5, 2);
  const c52 = computeCombinatorics('COMBINATION', 5, 2);
  const c60 = computeCombinatorics('COMBINATION', 6, 0);
  const c66 = computeCombinatorics('COMBINATION', 6, 6);
  cases.push({
    id: 'm17_arr_comb',
    label: 'Chỉnh hợp & Tổ hợp (Mở rộng): A(5,2)=20, C(5,2)=10, C(6,0)=C(6,6)=1',
    passed:
      a52.valid &&
      a52.value === 20 &&
      c52.valid &&
      c52.value === 10 &&
      c60.valid &&
      c60.value === 1 &&
      c66.valid &&
      c66.value === 1,
    detail: `A(5,2)=${a52.value}, C(5,2)=${c52.value}`,
  });

  // 8. Chặn biên bất hợp lệ: k > n, số âm, n > 18
  const badK = computeCombinatorics('COMBINATION', 4, 5);
  const badNeg = computeCombinatorics('PERMUTATION', -3);
  const badBig = computeCombinatorics('PERMUTATION', 25);
  cases.push({
    id: 'm17_bounds_guard',
    label: 'Chặn an toàn khi k > n, n âm hoặc n > 18 (tránh tràn số)',
    passed: !badK.valid && !badNeg.valid && !badBig.valid,
    detail: 'Cả 3 trường hợp biên đều bị từ chối an toàn',
  });

  // 9. Đồng nhất thức Pascal & Đối xứng tổ hợp: C(10,3)=C(10,7)=120 và C(7,2)+C(7,3)=C(8,3)
  const c10_3 = computeCombinatorics('COMBINATION', 10, 3);
  const c10_7 = computeCombinatorics('COMBINATION', 10, 7);
  const c7_2 = computeCombinatorics('COMBINATION', 7, 2);
  const c7_3 = computeCombinatorics('COMBINATION', 7, 3);
  const c8_3 = computeCombinatorics('COMBINATION', 8, 3);
  cases.push({
    id: 'm17_pascal_symmetry',
    label: 'Tính chất C(10,3)=C(10,7)=120 và đẳng thức Pascal C(7,2)+C(7,3)=C(8,3)',
    passed:
      c10_3.value === 120 &&
      c10_7.value === 120 &&
      c7_2.value + c7_3.value === c8_3.value,
    detail: `C(10,3)=${c10_3.value}, C(8,3)=${c8_3.value}`,
  });

  // 10. Chặn quá tải DOM sơ đồ cây (> 48 lá cắt hiển thị nhưng giữ nguyên tổng kết quả)
  const bigTree = buildCountingTree({
    scenarioId: 'CUSTOM',
    stages: [
      { stageName: 'B1', options: ['1', '2', '3', '4', '5'] },
      { stageName: 'B2', options: ['A', 'B', 'C', 'D'] },
      { stageName: 'B3', options: ['X', 'Y', 'Z'] },
    ],
  });
  cases.push({
    id: 'm17_tree_dom_cap',
    label: 'Cây lớn (5×4×3 = 60 lá): giới hạn vẽ ≤ 48 lá mượt mà nhưng đếm đúng n(Ω)=60',
    passed:
      bigTree.valid &&
      bigTree.totalOutcomes === 60 &&
      bigTree.isTruncatedForDisplay &&
      bigTree.displayedLeafCount === MAX_TREE_DISPLAY_LEAVES,
    detail: `total=${bigTree.totalOutcomes}, displayed=${bigTree.displayedLeafCount}`,
  });

  const failedChecks = cases.filter((c) => !c.passed).map((c) => c.label);
  return {
    passed: failedChecks.length === 0,
    totalChecks: cases.length,
    failedChecks,
    cases,
  };
}
