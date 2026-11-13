import {
  CognitiveLevel,
  ExamMatrix,
  ExamPeriod,
  Grade,
  MatrixAllocationCell,
  MatrixDraftState,
  MatrixPointConfig,
  MatrixRow,
  Question,
  QuestionType,
  YccdItem
} from '../types';
import {
  normalizeSubjectToKey,
  stripVietnameseAccents
} from './yccdCsvParser';

export const COGNITIVE_LEVELS: CognitiveLevel[] = ['know', 'understand', 'apply'];

export const COGNITIVE_LABELS: Record<CognitiveLevel, string> = {
  know: 'Nhận biết',
  understand: 'Thông hiểu',
  apply: 'Vận dụng'
};

export const QUESTION_FORMAT_LABELS: Record<QuestionType, string> = {
  single_choice: 'TNKQ (Nhiều lựa chọn)',
  true_false_group: 'Đúng – Sai',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận'
};

export const EXAM_PERIOD_LABELS: Record<ExamPeriod, string> = {
  mid1: 'Giữa kì I',
  final1: 'Cuối kì I',
  mid2: 'Giữa kì II',
  final2: 'Cuối kì II'
};

export const DEFAULT_POINT_CONFIG: MatrixPointConfig = {
  targetTotalScore: 10.0,
  singleChoicePerQuestion: 0.25,
  trueFalsePerSubItem: 0.25,
  shortAnswerPerQuestion: 0.5,
  essayPerSubItem: 0.5,
  targetCognitiveRatio: {
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30
  }
};

export function buildUnitKey(item: Pick<YccdItem, 'subjectKey' | 'grade' | 'topicId' | 'unitId'>): string {
  return `${item.subjectKey}|${item.grade}|${item.topicId}|${item.unitId}`;
}

export function buildAllocationKey(unitKey: string, level: CognitiveLevel, questionType: QuestionType): string {
  return `${unitKey}::${level}::${questionType}`;
}

export function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatPercentClean(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/**
 * Expands question/sub-item shorthand into individual code tokens.
 * Examples:
 * - "1-4" => ["1", "2", "3", "4"]
 * - "14a,b" => ["14a", "14b"]
 * - "14a, 14b" => ["14a", "14b"]
 * - "14a-14d" => ["14a", "14b", "14c", "14d"]
 * - "14a-d" => ["14a", "14b", "14c", "14d"]
 * - "2a, 2b" => ["2a", "2b"]
 */
export function expandQuestionCodes(rawText: string): string[] {
  const cleaned = String(rawText || '')
    .replace(/câu|bài/gi, '')
    .trim();
  if (!cleaned) return [];

  const parts = cleaned
    .split(/[,;]+/)
    .map(p => p.trim())
    .filter(Boolean);

  const tokens: string[] = [];
  let lastNumericPrefix = '';

  for (const part of parts) {
    // Pattern 1: Numeric range "1-4"
    const numRange = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (numRange) {
      const start = parseInt(numRange[1], 10);
      const end = parseInt(numRange[2], 10);
      if (start <= end && end - start <= 100) {
        for (let n = start; n <= end; n++) {
          tokens.push(String(n));
        }
        lastNumericPrefix = '';
        continue;
      }
    }

    // Pattern 2: Full sub-item range "14a-14d" or "14a-d"
    const subRange = part.match(/^(\d+)([a-zA-Z])\s*[-–]\s*(\d*)([a-zA-Z])$/);
    if (subRange) {
      const prefix = subRange[1];
      const startChar = subRange[2].toLowerCase().charCodeAt(0);
      const endPrefix = subRange[3] || prefix;
      const endChar = subRange[4].toLowerCase().charCodeAt(0);
      if (prefix === endPrefix && startChar <= endChar && endChar - startChar <= 26) {
        for (let c = startChar; c <= endChar; c++) {
          tokens.push(`${prefix}${String.fromCharCode(c)}`);
        }
        lastNumericPrefix = prefix;
        continue;
      }
    }

    // Pattern 3: Prefix + letter like "14a"
    const fullSub = part.match(/^(\d+)([a-zA-Z]+)$/);
    if (fullSub) {
      lastNumericPrefix = fullSub[1];
      tokens.push(`${fullSub[1]}${fullSub[2].toLowerCase()}`);
      continue;
    }

    // Pattern 4: Continuation shorthand like "b" after "14a" -> "14b"
    const loneLetter = part.match(/^([a-zA-Z])$/);
    if (loneLetter && lastNumericPrefix) {
      tokens.push(`${lastNumericPrefix}${loneLetter[1].toLowerCase()}`);
      continue;
    }

    // Pattern 5: Plain integer or arbitrary code
    const plainNum = part.match(/^(\d+)$/);
    if (plainNum) {
      lastNumericPrefix = plainNum[1];
      tokens.push(plainNum[1]);
      continue;
    }

    tokens.push(part);
  }

  return tokens;
}

export function getRootQuestionCode(token: string): string {
  const cleaned = String(token || '').trim().replace(/^(câu|bài)\s*/i, '');
  const match = cleaned.match(/^(\d+)(?:[a-zA-Z._]*)$/);
  if (match) return match[1];
  return cleaned;
}

function compactSequentialNumbers(nums: number[]): string {
  if (nums.length === 0) return '';
  if (nums.length === 1) return String(nums[0]);
  const isContiguous = nums.every((v, i) => i === 0 || v === nums[i - 1] + 1);
  if (isContiguous) return `${nums[0]}-${nums[nums.length - 1]}`;
  return nums.join(', ');
}

export interface TreeUnitGroup {
  unitKey: string;
  unitId: string;
  unit: string;
  topicId: string;
  topic: string;
  topicShortLabel: string;
  itemsByLevel: Record<CognitiveLevel, YccdItem[]>;
}

export interface TreeTopicGroup {
  topicId: string;
  topic: string;
  topicShortLabel: string;
  units: TreeUnitGroup[];
}

export function buildYccdTree(items: YccdItem[]): TreeTopicGroup[] {
  const topics: TreeTopicGroup[] = [];
  const topicMap = new Map<string, TreeTopicGroup>();
  const unitMap = new Map<string, TreeUnitGroup>();

  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const item of sorted) {
    let topicNode = topicMap.get(item.topicId);
    if (!topicNode) {
      topicNode = {
        topicId: item.topicId,
        topic: item.topic,
        topicShortLabel: item.topicShortLabel,
        units: []
      };
      topicMap.set(item.topicId, topicNode);
      topics.push(topicNode);
    }

    const uKey = buildUnitKey(item);
    let unitNode = unitMap.get(uKey);
    if (!unitNode) {
      unitNode = {
        unitKey: uKey,
        unitId: item.unitId,
        unit: item.unit,
        topicId: item.topicId,
        topic: item.topic,
        topicShortLabel: item.topicShortLabel,
        itemsByLevel: {
          know: [],
          understand: [],
          apply: []
        }
      };
      unitMap.set(uKey, unitNode);
      topicNode.units.push(unitNode);
    }

    unitNode.itemsByLevel[item.level].push(item);
  }

  return topics;
}

export interface CellValidationIssue {
  key: string;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Computes auto-generated codes in top-to-bottom row order while preserving manually edited codes.
 */
export function applyAutoCodesToAllocations(
  tree: TreeTopicGroup[],
  selectedSet: Set<string>,
  allocations: Record<string, MatrixAllocationCell>,
  activeFormats: QuestionType[]
): Record<string, MatrixAllocationCell> {
  const next: Record<string, MatrixAllocationCell> = { ...allocations };

  // Pre-calculate total single choice count so true_false_group continues naturally (or starts at 1 if 0)
  let totalSingleChoiceCount = 0;
  for (const topic of tree) {
    for (const unit of topic.units) {
      for (const level of COGNITIVE_LEVELS) {
        if (!unit.itemsByLevel[level].some(it => selectedSet.has(it.stableKey))) continue;
        const scCell = next[buildAllocationKey(unit.unitKey, level, 'single_choice')];
        if (scCell && Number.isInteger(scCell.count) && scCell.count > 0) {
          totalSingleChoiceCount += scCell.count;
        }
      }
    }
  }

  const counters: Record<QuestionType, number> = {
    single_choice: 0,
    true_false_group: 0, // 0-based sub-item index; 0..3 -> question (base+1)a..d
    short_answer: 0,
    essay: 0
  };

  for (const topic of tree) {
    for (const unit of topic.units) {
      for (const level of COGNITIVE_LEVELS) {
        const checkedInLevel = unit.itemsByLevel[level].filter(it => selectedSet.has(it.stableKey));
        if (checkedInLevel.length === 0) continue;

        for (const qType of activeFormats) {
          const allocKey = buildAllocationKey(unit.unitKey, level, qType);
          const cell = next[allocKey];
          if (!cell) continue;

          const count = Number.isInteger(cell.count) && cell.count > 0 ? cell.count : 0;
          if (count === 0) {
            if (!cell.isManualCode && cell.codeText !== '') {
              next[allocKey] = { ...cell, codeText: '' };
            }
            continue;
          }

          if (cell.isManualCode && cell.codeText.trim() !== '') {
            continue;
          }

          let generated = '';
          if (qType === 'single_choice' || qType === 'short_answer' || qType === 'essay') {
            const nums: number[] = [];
            for (let i = 0; i < count; i++) {
              counters[qType] += 1;
              nums.push(counters[qType]);
            }
            generated = compactSequentialNumbers(nums);
          } else if (qType === 'true_false_group') {
            const subLabels = ['a', 'b', 'c', 'd'];
            const startQ = totalSingleChoiceCount + 1;
            const codes: string[] = [];
            for (let i = 0; i < count; i++) {
              const idx = counters.true_false_group;
              const qNum = startQ + Math.floor(idx / 4);
              const subChar = subLabels[idx % 4];
              codes.push(`${qNum}${subChar}`);
              counters.true_false_group += 1;
            }
            generated = codes.join(', ');
          }

          next[allocKey] = {
            ...cell,
            codeText: generated,
            isManualCode: false
          };
        }
      }
    }
  }

  return next;
}

export function validateMatrixCells(
  tree: TreeTopicGroup[],
  selectedSet: Set<string>,
  allocations: Record<string, MatrixAllocationCell>,
  activeFormats: QuestionType[]
): Record<string, CellValidationIssue> {
  const issues: Record<string, CellValidationIssue> = {};
  const tokenOccurrences: Record<QuestionType, Map<string, string[]>> = {
    single_choice: new Map(),
    true_false_group: new Map(),
    short_answer: new Map(),
    essay: new Map()
  };

  for (const topic of tree) {
    for (const unit of topic.units) {
      for (const level of COGNITIVE_LEVELS) {
        const hasChecked = unit.itemsByLevel[level].some(it => selectedSet.has(it.stableKey));
        if (!hasChecked) continue;

        for (const qType of activeFormats) {
          const allocKey = buildAllocationKey(unit.unitKey, level, qType);
          const cell = allocations[allocKey];
          if (!cell) continue;

          const rawStr = (cell.rawCountText ?? '').trim();
          if (rawStr !== '') {
            const parsedNum = Number(rawStr);
            if (!Number.isFinite(parsedNum) || parsedNum < 0 || !Number.isInteger(parsedNum)) {
              issues[allocKey] = {
                key: allocKey,
                severity: 'error',
                message: 'Số lượng phải là số nguyên không âm (0, 1, 2...)'
              };
              continue;
            }
          }

          if (cell.count > 0) {
            const tokens = expandQuestionCodes(cell.codeText);
            if (cell.codeText.trim() !== '' && tokens.length !== cell.count) {
              issues[allocKey] = {
                key: allocKey,
                severity: 'warning',
                message: `Số lượng là ${cell.count} nhưng mã chỉ khớp ${tokens.length} mục`
              };
            }

            // Detect duplicate within same cell
            const localSeen = new Set<string>();
            for (const tok of tokens) {
              const normTok = tok.toLowerCase();
              if (localSeen.has(normTok)) {
                issues[allocKey] = {
                  key: allocKey,
                  severity: 'error',
                  message: `Trùng mã "${tok}" ngay trong ô`
                };
              }
              localSeen.add(normTok);

              const scopeMap = tokenOccurrences[qType];
              const list = scopeMap.get(normTok) || [];
              list.push(allocKey);
              scopeMap.set(normTok, list);
            }
          }
        }
      }
    }
  }

  // Flag cross-cell duplicate codes in the same question format scope
  for (const qType of activeFormats) {
    const scopeMap = tokenOccurrences[qType];
    scopeMap.forEach((cellKeys, normTok) => {
      if (cellKeys.length > 1) {
        const uniqueCells = Array.from(new Set(cellKeys));
        if (uniqueCells.length > 1) {
          for (const cKey of uniqueCells) {
            issues[cKey] = {
              key: cKey,
              severity: 'error',
              message: `Trùng mã "${normTok}" ở nhiều dòng cùng hình thức`
            };
          }
        }
      }
    });
  }

  return issues;
}

export function getPointsPerUnit(qType: QuestionType, config: MatrixPointConfig): number {
  switch (qType) {
    case 'single_choice':
      return config.singleChoicePerQuestion;
    case 'true_false_group':
      return config.trueFalsePerSubItem;
    case 'short_answer':
      return config.shortAnswerPerQuestion;
    case 'essay':
      return config.essayPerSubItem;
  }
}

export interface FormatSummaryStats {
  questionType: QuestionType;
  label: string;
  countsByLevel: Record<CognitiveLevel, number>;
  pointsByLevel: Record<CognitiveLevel, number>;
  totalSubItems: number;
  totalOriginalQuestions: number;
  totalPoints: number;
  percentOfActualTotal: number;
}

export interface SpecificationRowItem {
  orderIndex: number;
  topicId: string;
  topic: string;
  unitKey: string;
  unit: string;
  level: CognitiveLevel;
  levelLabel: string;
  yccdItem: YccdItem;
  competencyCode: string;
  allocations: Array<{
    allocKey: string;
    questionType: QuestionType;
    formatLabel: string;
    count: number;
    codeText: string;
    points: number;
    isSharedCredit: boolean;
  }>;
  rowTotalPoints: number;
}

export interface MatrixSummaryResult {
  byFormat: Record<QuestionType, FormatSummaryStats>;
  levelSubItemTotals: Record<CognitiveLevel, number>;
  levelPointsTotals: Record<CognitiveLevel, number>;
  levelPercents: Record<CognitiveLevel, number>;
  totalOriginalQuestions: number;
  totalSubItems: number;
  totalPoints: number;
  scoreDiffFromTarget: number;
  isMatchingTargetScore: boolean;
  validationIssues: Record<string, CellValidationIssue>;
  hasValidationErrors: boolean;
  specRows: SpecificationRowItem[];
}

export function computeMatrixSummary(
  tree: TreeTopicGroup[],
  selectedSet: Set<string>,
  allocations: Record<string, MatrixAllocationCell>,
  pointConfig: MatrixPointConfig,
  activeFormats: QuestionType[],
  competencyOverrides: Record<string, string> = {}
): MatrixSummaryResult {
  const validationIssues = validateMatrixCells(tree, selectedSet, allocations, activeFormats);

  const byFormat: Record<QuestionType, FormatSummaryStats> = {
    single_choice: {
      questionType: 'single_choice',
      label: QUESTION_FORMAT_LABELS.single_choice,
      countsByLevel: { know: 0, understand: 0, apply: 0 },
      pointsByLevel: { know: 0, understand: 0, apply: 0 },
      totalSubItems: 0,
      totalOriginalQuestions: 0,
      totalPoints: 0,
      percentOfActualTotal: 0
    },
    true_false_group: {
      questionType: 'true_false_group',
      label: QUESTION_FORMAT_LABELS.true_false_group,
      countsByLevel: { know: 0, understand: 0, apply: 0 },
      pointsByLevel: { know: 0, understand: 0, apply: 0 },
      totalSubItems: 0,
      totalOriginalQuestions: 0,
      totalPoints: 0,
      percentOfActualTotal: 0
    },
    short_answer: {
      questionType: 'short_answer',
      label: QUESTION_FORMAT_LABELS.short_answer,
      countsByLevel: { know: 0, understand: 0, apply: 0 },
      pointsByLevel: { know: 0, understand: 0, apply: 0 },
      totalSubItems: 0,
      totalOriginalQuestions: 0,
      totalPoints: 0,
      percentOfActualTotal: 0
    },
    essay: {
      questionType: 'essay',
      label: QUESTION_FORMAT_LABELS.essay,
      countsByLevel: { know: 0, understand: 0, apply: 0 },
      pointsByLevel: { know: 0, understand: 0, apply: 0 },
      totalSubItems: 0,
      totalOriginalQuestions: 0,
      totalPoints: 0,
      percentOfActualTotal: 0
    }
  };

  const rootSets: Record<QuestionType, Set<string>> = {
    single_choice: new Set(),
    true_false_group: new Set(),
    short_answer: new Set(),
    essay: new Set()
  };
  let uncodedTfSubItems = 0;
  let uncodedEssaySubItems = 0;

  const specRows: SpecificationRowItem[] = [];
  let specOrder = 1;

  for (const topic of tree) {
    for (const unit of topic.units) {
      for (const level of COGNITIVE_LEVELS) {
        const checkedYccds = unit.itemsByLevel[level].filter(it => selectedSet.has(it.stableKey));
        if (checkedYccds.length === 0) continue;

        const checkedKeySet = new Set(checkedYccds.map(it => it.stableKey));
        const unitLevelCompKey = `${unit.unitKey}::${level}`;

        // Collect all allocations in this (unit, level) row
        const levelRowAllocs: Array<{
          allocKey: string;
          qType: QuestionType;
          count: number;
          codeText: string;
          points: number;
          linkedKeys: string[];
        }> = [];

        for (const qType of activeFormats) {
          const allocKey = buildAllocationKey(unit.unitKey, level, qType);
          const cell = allocations[allocKey];
          if (!cell || !Number.isInteger(cell.count) || cell.count <= 0) continue;

          const ptsPerUnit = getPointsPerUnit(qType, pointConfig);
          const cellPoints = roundScore(cell.count * ptsPerUnit);

          byFormat[qType].countsByLevel[level] += cell.count;
          byFormat[qType].pointsByLevel[level] = roundScore(byFormat[qType].pointsByLevel[level] + cellPoints);
          byFormat[qType].totalSubItems += cell.count;
          byFormat[qType].totalPoints = roundScore(byFormat[qType].totalPoints + cellPoints);

          const expandedTokens = expandQuestionCodes(cell.codeText);
          if (qType === 'true_false_group' || qType === 'essay') {
            if (expandedTokens.length > 0) {
              for (const tok of expandedTokens) {
                rootSets[qType].add(getRootQuestionCode(tok));
              }
            } else {
              if (qType === 'true_false_group') uncodedTfSubItems += cell.count;
              else uncodedEssaySubItems += cell.count;
            }
          }

          const validLinked = (cell.linkedYccdKeys || []).filter(k => checkedKeySet.has(k));
          const resolvedLinked = validLinked.length > 0 ? validLinked : [checkedYccds[0].stableKey];

          levelRowAllocs.push({
            allocKey,
            qType,
            count: cell.count,
            codeText: cell.codeText.trim() || `${cell.count}`,
            points: cellPoints,
            linkedKeys: resolvedLinked
          });
        }

        // Track credited allocations so points/counts are NEVER double-counted when 1 cell maps to multiple YCCĐs
        const alreadyCreditedAllocKeys = new Set<string>();

        for (const yccdItem of checkedYccds) {
          const matchingAllocs = levelRowAllocs.filter(al => al.linkedKeys.includes(yccdItem.stableKey));
          const mappedAllocs = matchingAllocs.map(al => {
            const isShared = alreadyCreditedAllocKeys.has(al.allocKey);
            if (!isShared) alreadyCreditedAllocKeys.add(al.allocKey);
            return {
              allocKey: al.allocKey,
              questionType: al.qType,
              formatLabel: QUESTION_FORMAT_LABELS[al.qType],
              count: al.count,
              codeText: al.codeText,
              points: al.points,
              isSharedCredit: isShared
            };
          });

          const rowTotalPoints = roundScore(
            mappedAllocs.reduce((acc, a) => acc + (a.isSharedCredit ? 0 : a.points), 0)
          );

          const compCode =
            competencyOverrides[yccdItem.stableKey] ||
            competencyOverrides[unitLevelCompKey] ||
            yccdItem.competencyCode ||
            (yccdItem.subjectKey === 'informatics' ? 'NLa' : '');

          specRows.push({
            orderIndex: specOrder++,
            topicId: topic.topicId,
            topic: topic.topic,
            unitKey: unit.unitKey,
            unit: unit.unit,
            level,
            levelLabel: COGNITIVE_LABELS[level],
            yccdItem,
            competencyCode: compCode,
            allocations: mappedAllocs,
            rowTotalPoints
          });
        }
      }
    }
  }

  byFormat.single_choice.totalOriginalQuestions = byFormat.single_choice.totalSubItems;
  byFormat.short_answer.totalOriginalQuestions = byFormat.short_answer.totalSubItems;
  byFormat.true_false_group.totalOriginalQuestions =
    rootSets.true_false_group.size + (uncodedTfSubItems > 0 ? Math.ceil(uncodedTfSubItems / 4) : 0);
  byFormat.essay.totalOriginalQuestions =
    rootSets.essay.size + uncodedEssaySubItems;

  const levelSubItemTotals: Record<CognitiveLevel, number> = { know: 0, understand: 0, apply: 0 };
  const levelPointsTotals: Record<CognitiveLevel, number> = { know: 0, understand: 0, apply: 0 };

  for (const qType of activeFormats) {
    for (const lvl of COGNITIVE_LEVELS) {
      levelSubItemTotals[lvl] += byFormat[qType].countsByLevel[lvl];
      levelPointsTotals[lvl] = roundScore(levelPointsTotals[lvl] + byFormat[qType].pointsByLevel[lvl]);
    }
  }

  const totalPoints = roundScore(
    levelPointsTotals.know + levelPointsTotals.understand + levelPointsTotals.apply
  );

  const totalSubItems = activeFormats.reduce((s, f) => s + byFormat[f].totalSubItems, 0);
  const totalOriginalQuestions = activeFormats.reduce((s, f) => s + byFormat[f].totalOriginalQuestions, 0);

  for (const qType of activeFormats) {
    byFormat[qType].percentOfActualTotal =
      totalPoints > 0 ? Math.round((byFormat[qType].totalPoints / totalPoints) * 1000) / 10 : 0;
  }

  const levelPercents: Record<CognitiveLevel, number> = {
    know: totalPoints > 0 ? Math.round((levelPointsTotals.know / totalPoints) * 1000) / 10 : 0,
    understand: totalPoints > 0 ? Math.round((levelPointsTotals.understand / totalPoints) * 1000) / 10 : 0,
    apply: totalPoints > 0 ? Math.round((levelPointsTotals.apply / totalPoints) * 1000) / 10 : 0
  };

  const scoreDiffFromTarget = roundScore(totalPoints - pointConfig.targetTotalScore);
  const isMatchingTargetScore = Math.abs(scoreDiffFromTarget) < 0.01 && totalPoints > 0;

  return {
    byFormat,
    levelSubItemTotals,
    levelPointsTotals,
    levelPercents,
    totalOriginalQuestions,
    totalSubItems,
    totalPoints,
    scoreDiffFromTarget,
    isMatchingTargetScore,
    validationIssues,
    hasValidationErrors: Object.values(validationIssues).some(v => v.severity === 'error'),
    specRows
  };
}

export interface UnitBankReadiness {
  unitKey: string;
  topic: string;
  unit: string;
  requiredCount: number;
  availableCount: number;
  status: 'sufficient' | 'lacking' | 'unchecked';
  missingBreakdown: string[];
}

export function checkBankReadinessForMatrix(
  tree: TreeTopicGroup[],
  selectedSet: Set<string>,
  allocations: Record<string, MatrixAllocationCell>,
  activeFormats: QuestionType[],
  subject: string,
  grade: Grade,
  questions: Question[]
): UnitBankReadiness[] {
  const targetSubjKey = normalizeSubjectToKey(subject);
  const matchingSubjGrade = questions.filter(
    q => normalizeSubjectToKey(String(q.subject)) === targetSubjKey && String(q.grade) === String(grade)
  );

  const results: UnitBankReadiness[] = [];

  for (const topic of tree) {
    const topicShortNorm = stripVietnameseAccents(topic.topicShortLabel);
    const topicMainNorm = stripVietnameseAccents(topic.topic.split('.').slice(1).join('.').trim() || topic.topic);

    for (const unit of topic.units) {
      const hasAnySelected = COGNITIVE_LEVELS.some(lvl =>
        unit.itemsByLevel[lvl].some(it => selectedSet.has(it.stableKey))
      );
      if (!hasAnySelected) continue;

      const unitNorm = stripVietnameseAccents(unit.unit);
      let requiredTotal = 0;
      let availableMatchedTotal = 0;
      const missingBreakdown: string[] = [];

      for (const lvl of COGNITIVE_LEVELS) {
        for (const qType of activeFormats) {
          const cell = allocations[buildAllocationKey(unit.unitKey, lvl, qType)];
          if (!cell || cell.count <= 0) continue;

          // Note: for true_false_group, each Question in the bank contains 4 sub-items; count sub-items available
          const matchingQ = matchingSubjGrade.filter(q => {
            if (q.type !== qType) return false;
            const qChapterNorm = stripVietnameseAccents(q.chapter || '');
            const qLessonNorm = stripVietnameseAccents(q.lesson || '');
            const qYccdNorm = stripVietnameseAccents(q.yccd || '');

            const chapterMatch =
              (topicShortNorm && qChapterNorm.includes(topicShortNorm)) ||
              (topicMainNorm && qChapterNorm.includes(topicMainNorm)) ||
              (unitNorm && (qLessonNorm.includes(unitNorm) || qYccdNorm.includes(unitNorm)));

            if (!chapterMatch) return false;

            if (qType === 'true_false_group' && q.subItems && q.subItems.length > 0) {
              return q.subItems.some(sub => (sub.level || q.level) === lvl);
            }
            return q.level === lvl;
          });

          const availUnits =
            qType === 'true_false_group'
              ? matchingQ.reduce((sum, q) => {
                  const subCount = q.subItems?.filter(s => (s.level || q.level) === lvl).length || 0;
                  return sum + (subCount > 0 ? subCount : q.level === lvl ? 4 : 0);
                }, 0)
              : matchingQ.length;

          requiredTotal += cell.count;
          availableMatchedTotal += Math.min(availUnits, cell.count);

          if (availUnits < cell.count) {
            missingBreakdown.push(
              `${QUESTION_FORMAT_LABELS[qType]} (${COGNITIVE_LABELS[lvl]}): có ${availUnits}/cần ${cell.count}`
            );
          }
        }
      }

      const status: UnitBankReadiness['status'] =
        requiredTotal === 0 ? 'unchecked' : missingBreakdown.length === 0 ? 'sufficient' : 'lacking';

      results.push({
        unitKey: unit.unitKey,
        topic: topic.topic,
        unit: unit.unit,
        requiredCount: requiredTotal,
        availableCount: availableMatchedTotal,
        status,
        missingBreakdown
      });
    }
  }

  return results;
}

/**
 * Converts full interactive DraftState + Summary into legacy ExamMatrix format for AppContext / export compatibility.
 */
export function buildExamMatrixRecord(
  draft: MatrixDraftState,
  tree: TreeTopicGroup[],
  summary: MatrixSummaryResult,
  activeFormats: QuestionType[],
  authorId?: string
): ExamMatrix {
  const selectedSet = new Set(draft.selectedYccdKeys);
  const rows: MatrixRow[] = [];

  for (const topic of tree) {
    for (const unit of topic.units) {
      const checkedInUnit = COGNITIVE_LEVELS.flatMap(lvl =>
        unit.itemsByLevel[lvl].filter(it => selectedSet.has(it.stableKey))
      );
      if (checkedInUnit.length === 0) continue;

      for (const qType of activeFormats) {
        const knowCell = draft.allocations[buildAllocationKey(unit.unitKey, 'know', qType)];
        const understandCell = draft.allocations[buildAllocationKey(unit.unitKey, 'understand', qType)];
        const applyCell = draft.allocations[buildAllocationKey(unit.unitKey, 'apply', qType)];

        const kc = knowCell?.count || 0;
        const uc = understandCell?.count || 0;
        const ac = applyCell?.count || 0;
        if (kc + uc + ac === 0) continue;

        const pts = getPointsPerUnit(qType, draft.pointConfig);
        rows.push({
          id: `${unit.unitKey}::${qType}`,
          topic: topic.topic,
          unit: unit.unit,
          yccd: checkedInUnit.map(it => `${it.sourceLabel} ${it.yccd}`).join(' | '),
          questionType: qType,
          knowCount: kc,
          knowPoints: roundScore(kc * pts),
          understandCount: uc,
          understandPoints: roundScore(uc * pts),
          applyCount: ac,
          applyPoints: roundScore(ac * pts)
        });
      }
    }
  }

  return {
    id: draft.id,
    title: draft.title,
    grade: draft.grade,
    subject: draft.subjectKey,
    period: draft.period,
    schoolYear: draft.schoolYear,
    durationMinutes: draft.durationMinutes,
    totalPoints: summary.totalPoints,
    rows,
    cognitiveRatio: {
      knowPercent: Math.round(summary.levelPercents.know),
      understandPercent: Math.round(summary.levelPercents.understand),
      applyPercent: Math.round(summary.levelPercents.apply)
    },
    draftState: draft,
    updatedAt: draft.updatedAt,
    authorId,
    authorName: draft.authorName
  };
}
