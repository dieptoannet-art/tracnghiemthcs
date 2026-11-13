import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType
} from 'docx';
import {
  CognitiveLevel,
  MatrixDraftState,
  QuestionType
} from '../types';
import {
  buildAllocationKey,
  COGNITIVE_LABELS,
  COGNITIVE_LEVELS,
  EXAM_PERIOD_LABELS,
  formatPercentClean,
  getPointsPerUnit,
  MatrixSummaryResult,
  QUESTION_FORMAT_LABELS,
  roundScore,
  TreeTopicGroup
} from './matrixCalculations';

const FONT_FAMILY = 'Times New Roman';

const BORDER_COLOR = '475569';
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' }
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
};

function makeRun(
  text: string,
  options: { bold?: boolean; italics?: boolean; size?: number; color?: string; underline?: boolean } = {}
): TextRun {
  return new TextRun({
    text,
    font: FONT_FAMILY,
    size: options.size ?? 20, // 10pt default for dense matrices
    bold: options.bold,
    italics: options.italics,
    color: options.color ?? '0F172A',
    underline: options.underline ? {} : undefined
  });
}

function makePara(
  runs: TextRun[] | string,
  options: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingBefore?: number;
    spacingAfter?: number;
    pageBreakBefore?: boolean;
  } = {}
): Paragraph {
  return new Paragraph({
    alignment: options.align ?? AlignmentType.LEFT,
    spacing: {
      before: options.spacingBefore ?? 20,
      after: options.spacingAfter ?? 20,
      line: 240
    },
    pageBreakBefore: options.pageBreakBefore,
    children: typeof runs === 'string' ? [makeRun(runs)] : runs
  });
}

function makeCell(
  children: Paragraph[],
  options: {
    widthPct?: number;
    colSpan?: number;
    rowSpan?: number;
    fill?: string;
    verticalAlign?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable];
  } = {}
): TableCell {
  return new TableCell({
    columnSpan: options.colSpan,
    rowSpan: options.rowSpan,
    verticalAlign: options.verticalAlign ?? VerticalAlignTable.CENTER,
    width: options.widthPct !== undefined ? { size: options.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: options.fill
      ? {
          fill: options.fill,
          type: ShadingType.CLEAR,
          color: 'auto'
        }
      : undefined,
    margins: {
      top: 60,
      bottom: 60,
      left: 70,
      right: 70
    },
    children
  });
}

function formatHeaderLabel(qType: QuestionType): string {
  switch (qType) {
    case 'single_choice':
      return 'TNKQ nhiều lựa chọn (câu)';
    case 'true_false_group':
      return 'Đúng – Sai (ý)';
    case 'short_answer':
      return 'Trả lời ngắn (câu)';
    case 'essay':
      return 'Tự luận (ý)';
  }
}

function formatHeaderFill(qType: QuestionType): string {
  switch (qType) {
    case 'single_choice':
      return 'DBEAFE'; // Blue tint
    case 'true_false_group':
      return 'EDE9FE'; // Purple tint
    case 'short_answer':
      return 'CCFBF1'; // Teal tint
    case 'essay':
      return 'DCFCE7'; // Green tint
  }
}

export interface DocxBuildInput {
  draft: MatrixDraftState;
  tree: TreeTopicGroup[];
  summary: MatrixSummaryResult;
  activeFormats: QuestionType[];
  teacherName?: string;
  schoolName?: string;
}

export function buildMatrixAndSpecDocx(input: DocxBuildInput): Document {
  const {
    draft,
    tree,
    summary,
    activeFormats,
    teacherName = draft.authorName || 'GV. Diệp Thanh Toàn',
    schoolName = 'TRƯỜNG THCS TÂY ĐÔ'
  } = input;

  const selectedSet = new Set(draft.selectedYccdKeys);
  const periodLabel = EXAM_PERIOD_LABELS[draft.period] || 'Giữa kì I';
  const today = new Date();
  const dateLine = `Tây Đô, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

  // Build Official School Header Table
  const officialHeaderTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          makeCell(
            [
              makePara([makeRun('PHÒNG GD&ĐT HUYỆN TÂY ĐÔ', { size: 22 })], { align: AlignmentType.CENTER }),
              makePara([makeRun(schoolName.toUpperCase(), { bold: true, size: 24 })], { align: AlignmentType.CENTER }),
              makePara([makeRun(`Giáo viên biên soạn: ${teacherName}`, { italics: true, size: 21 })], {
                align: AlignmentType.CENTER
              })
            ],
            { widthPct: 45 }
          ),
          makeCell(
            [
              makePara([makeRun('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, size: 22 })], {
                align: AlignmentType.CENTER
              }),
              makePara([makeRun('Độc lập - Tự do - Hạnh phúc', { bold: true, underline: true, size: 22 })], {
                align: AlignmentType.CENTER
              }),
              makePara([makeRun(dateLine, { italics: true, size: 20 })], { align: AlignmentType.CENTER })
            ],
            { widthPct: 55 }
          )
        ]
      })
    ]
  });

  // =========================================================================
  // PHẦN I: BẢNG MA TRẬN ĐỀ KIỂM TRA
  // =========================================================================
  const totalFormatSubCols = activeFormats.length * 3;

  const matrixHeaderRow1 = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      makeCell([makePara([makeRun('TT', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })], {
        rowSpan: 3,
        fill: '1E3A8A',
        widthPct: 4
      }),
      makeCell(
        [
          makePara([makeRun('Chương / Chủ đề', { bold: true, color: 'FFFFFF', size: 19 })], {
            align: AlignmentType.CENTER
          })
        ],
        { rowSpan: 3, fill: '1E3A8A', widthPct: 16 }
      ),
      makeCell(
        [
          makePara([makeRun('Nội dung / Đơn vị kiến thức', { bold: true, color: 'FFFFFF', size: 19 })], {
            align: AlignmentType.CENTER
          })
        ],
        { rowSpan: 3, fill: '1E3A8A', widthPct: 18 }
      ),
      makeCell(
        [
          makePara([makeRun('Mức độ đánh giá & phân bổ câu/ý', { bold: true, color: 'FFFFFF', size: 19 })], {
            align: AlignmentType.CENTER
          })
        ],
        { colSpan: totalFormatSubCols, fill: '1D4ED8' }
      ),
      makeCell(
        [makePara([makeRun('Tổng', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })],
        { colSpan: 3, fill: '1E3A8A' }
      ),
      makeCell(
        [
          makePara([makeRun('Tổng điểm / Tỉ lệ %', { bold: true, color: 'FFFFFF', size: 19 })], {
            align: AlignmentType.CENTER
          })
        ],
        { rowSpan: 3, fill: '1E3A8A', widthPct: 9 }
      )
    ]
  });

  const matrixHeaderRow2 = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      ...activeFormats.map(qType =>
        makeCell(
          [
            makePara([makeRun(formatHeaderLabel(qType), { bold: true, size: 18 })], {
              align: AlignmentType.CENTER
            })
          ],
          { colSpan: 3, fill: formatHeaderFill(qType) }
        )
      ),
      ...COGNITIVE_LEVELS.map(lvl =>
        makeCell(
          [
            makePara([makeRun(lvl === 'know' ? 'Biết' : lvl === 'understand' ? 'Hiểu' : 'VD', { bold: true, size: 18 })], {
              align: AlignmentType.CENTER
            })
          ],
          { rowSpan: 2, fill: 'E2E8F0' }
        )
      )
    ]
  });

  const matrixHeaderRow3 = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: activeFormats.flatMap(qType =>
      COGNITIVE_LEVELS.map(lvl =>
        makeCell(
          [
            makePara([makeRun(lvl === 'know' ? 'Biết' : lvl === 'understand' ? 'Hiểu' : 'VD', { bold: true, size: 17 })], {
              align: AlignmentType.CENTER
            })
          ],
          { fill: formatHeaderFill(qType) }
        )
      )
    )
  });

  // Collect active unit rows grouped by topic for proper vertical topic cell merging
  interface UnitMatrixDisplayRow {
    topicId: string;
    topic: string;
    unitKey: string;
    unit: string;
  }
  const activeUnitRows: UnitMatrixDisplayRow[] = [];
  for (const topic of tree) {
    for (const unit of topic.units) {
      const hasChecked = COGNITIVE_LEVELS.some(lvl =>
        unit.itemsByLevel[lvl].some(it => selectedSet.has(it.stableKey))
      );
      if (hasChecked) {
        activeUnitRows.push({
          topicId: topic.topicId,
          topic: topic.topic,
          unitKey: unit.unitKey,
          unit: unit.unit
        });
      }
    }
  }

  const matrixBodyRows: TableRow[] = [];
  let rowNum = 1;

  for (let idx = 0; idx < activeUnitRows.length; idx++) {
    const row = activeUnitRows[idx];
    const isFirstInTopic = idx === 0 || activeUnitRows[idx - 1].topicId !== row.topicId;
    let topicSpan = 1;
    if (isFirstInTopic) {
      for (let j = idx + 1; j < activeUnitRows.length && activeUnitRows[j].topicId === row.topicId; j++) {
        topicSpan++;
      }
    }

    const rowCountsByLevel: Record<CognitiveLevel, number> = { know: 0, understand: 0, apply: 0 };
    let rowPoints = 0;

    const formatCells: TableCell[] = [];
    for (const qType of activeFormats) {
      const unitPts = getPointsPerUnit(qType, draft.pointConfig);
      for (const lvl of COGNITIVE_LEVELS) {
        const cell = draft.allocations[buildAllocationKey(row.unitKey, lvl, qType)];
        const cnt = cell && Number.isInteger(cell.count) && cell.count > 0 ? cell.count : 0;
        if (cnt > 0) {
          rowCountsByLevel[lvl] += cnt;
          rowPoints = roundScore(rowPoints + cnt * unitPts);
        }

        const unitUnit = qType === 'true_false_group' || qType === 'essay' ? 'ý' : 'câu';
        const cellParagraphs: Paragraph[] =
          cnt > 0
            ? [
                makePara([makeRun(`${cnt} ${unitUnit}`, { bold: true, size: 18 })], { align: AlignmentType.CENTER }),
                ...(cell?.codeText
                  ? [
                      makePara([makeRun(`(${cell.codeText})`, { italics: true, size: 16, color: '334155' })], {
                        align: AlignmentType.CENTER
                      })
                    ]
                  : [])
              ]
            : [makePara([makeRun('-', { size: 18, color: '94A3B8' })], { align: AlignmentType.CENTER })];

        formatCells.push(makeCell(cellParagraphs));
      }
    }

    const rowPercent =
      summary.totalPoints > 0 ? formatPercentClean((rowPoints / summary.totalPoints) * 100) : '0%';

    const cells: TableCell[] = [
      makeCell([makePara([makeRun(String(rowNum++), { bold: true, size: 18 })], { align: AlignmentType.CENTER })])
    ];

    if (isFirstInTopic) {
      cells.push(
        makeCell([makePara([makeRun(row.topic, { bold: true, size: 18, color: '1E3A8A' })])], {
          rowSpan: topicSpan > 1 ? topicSpan : undefined
        })
      );
    }

    cells.push(makeCell([makePara([makeRun(row.unit, { bold: true, size: 18 })])]));
    cells.push(...formatCells);

    for (const lvl of COGNITIVE_LEVELS) {
      const c = rowCountsByLevel[lvl];
      cells.push(
        makeCell([
          makePara([makeRun(c > 0 ? String(c) : '-', { bold: c > 0, size: 18 })], {
            align: AlignmentType.CENTER
          })
        ])
      );
    }

    cells.push(
      makeCell([
        makePara(
          [
            makeRun(`${rowPoints.toFixed(2)}đ`, { bold: true, size: 18 }),
            makeRun(` (${rowPercent})`, { size: 17, color: '475569' })
          ],
          { align: AlignmentType.CENTER }
        )
      ])
    );

    matrixBodyRows.push(new TableRow({ cantSplit: true, children: cells }));
  }

  // Footer Row 1: Tổng số câu / ý
  const totalCountRow = new TableRow({
    cantSplit: true,
    children: [
      makeCell(
        [makePara([makeRun('Tổng số câu / ý', { bold: true, size: 18 })], { align: AlignmentType.CENTER })],
        { colSpan: 3, fill: 'F1F5F9' }
      ),
      ...activeFormats.flatMap(qType =>
        COGNITIVE_LEVELS.map(lvl => {
          const val = summary.byFormat[qType].countsByLevel[lvl];
          return makeCell(
            [makePara([makeRun(String(val), { bold: true, size: 18 })], { align: AlignmentType.CENTER })],
            { fill: 'F1F5F9' }
          );
        })
      ),
      ...COGNITIVE_LEVELS.map(lvl =>
        makeCell(
          [
            makePara([makeRun(String(summary.levelSubItemTotals[lvl]), { bold: true, size: 18 })], {
              align: AlignmentType.CENTER
            })
          ],
          { fill: 'F1F5F9' }
        )
      ),
      makeCell(
        [
          makePara(
            [
              makeRun(`${summary.totalOriginalQuestions} câu`, { bold: true, size: 18 }),
              makeRun(` / ${summary.totalSubItems} ý`, { size: 17, color: '475569' })
            ],
            { align: AlignmentType.CENTER }
          )
        ],
        { fill: 'F1F5F9' }
      )
    ]
  });

  // Footer Row 2: Tổng số điểm
  const totalPointsRow = new TableRow({
    cantSplit: true,
    children: [
      makeCell(
        [makePara([makeRun('Tổng số điểm', { bold: true, size: 18 })], { align: AlignmentType.CENTER })],
        { colSpan: 3, fill: 'EFF6FF' }
      ),
      ...activeFormats.map(qType => {
        const fs = summary.byFormat[qType];
        return makeCell(
          [
            makePara(
              [
                makeRun(`${fs.totalPoints.toFixed(2)}đ`, { bold: true, size: 18, color: '1E3A8A' }),
                makeRun(` (${fs.totalOriginalQuestions} câu)`, { size: 17, color: '475569' })
              ],
              { align: AlignmentType.CENTER }
            )
          ],
          { colSpan: 3, fill: 'EFF6FF' }
        );
      }),
      ...COGNITIVE_LEVELS.map(lvl =>
        makeCell(
          [
            makePara([makeRun(`${summary.levelPointsTotals[lvl].toFixed(2)}đ`, { bold: true, size: 18 })], {
              align: AlignmentType.CENTER
            })
          ],
          { fill: 'EFF6FF' }
        )
      ),
      makeCell(
        [
          makePara([makeRun(`${summary.totalPoints.toFixed(2)} điểm`, { bold: true, size: 19, color: '1D4ED8' })], {
            align: AlignmentType.CENTER
          })
        ],
        { fill: 'EFF6FF' }
      )
    ]
  });

  // Footer Row 3: Tỉ lệ %
  const totalPercentRow = new TableRow({
    cantSplit: true,
    children: [
      makeCell(
        [makePara([makeRun('Tỉ lệ %', { bold: true, size: 18 })], { align: AlignmentType.CENTER })],
        { colSpan: 3, fill: 'F8FAFC' }
      ),
      ...activeFormats.map(qType =>
        makeCell(
          [
            makePara(
              [makeRun(formatPercentClean(summary.byFormat[qType].percentOfActualTotal), { bold: true, size: 18 })],
              { align: AlignmentType.CENTER }
            )
          ],
          { colSpan: 3, fill: 'F8FAFC' }
        )
      ),
      ...COGNITIVE_LEVELS.map(lvl =>
        makeCell(
          [
            makePara(
              [makeRun(formatPercentClean(summary.levelPercents[lvl]), { bold: true, size: 18 })],
              { align: AlignmentType.CENTER }
            )
          ],
          { fill: 'F8FAFC' }
        )
      ),
      makeCell(
        [
          makePara([makeRun(summary.totalPoints > 0 ? '100%' : '0%', { bold: true, size: 18 })], {
            align: AlignmentType.CENTER
          })
        ],
        { fill: 'F8FAFC' }
      )
    ]
  });

  const matrixTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [matrixHeaderRow1, matrixHeaderRow2, matrixHeaderRow3, ...matrixBodyRows, totalCountRow, totalPointsRow, totalPercentRow]
  });

  // =========================================================================
  // PHẦN II: BẢN ĐẶC TẢ ĐỀ KIỂM TRA (YCCĐ & NĂNG LỰC)
  // =========================================================================
  const specHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      makeCell([makePara([makeRun('TT', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })], {
        fill: '1E3A8A',
        widthPct: 4
      }),
      makeCell(
        [makePara([makeRun('Chương / Chủ đề', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })],
        { fill: '1E3A8A', widthPct: 14 }
      ),
      makeCell(
        [
          makePara([makeRun('Nội dung / Đơn vị kiến thức', { bold: true, color: 'FFFFFF', size: 19 })], {
            align: AlignmentType.CENTER
          })
        ],
        { fill: '1E3A8A', widthPct: 15 }
      ),
      makeCell(
        [makePara([makeRun('Yêu cầu cần đạt', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })],
        { fill: '1E3A8A', widthPct: 31 }
      ),
      makeCell(
        [makePara([makeRun('Năng lực', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })],
        { fill: '1E3A8A', widthPct: 7 }
      ),
      makeCell(
        [makePara([makeRun('Mức độ', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })],
        { fill: '1E3A8A', widthPct: 8 }
      ),
      makeCell(
        [
          makePara([makeRun('Hình thức & Số câu/ý', { bold: true, color: 'FFFFFF', size: 19 })], {
            align: AlignmentType.CENTER
          })
        ],
        { fill: '1E3A8A', widthPct: 11 }
      ),
      makeCell(
        [makePara([makeRun('Mã câu / ý', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })],
        { fill: '1E3A8A', widthPct: 6 }
      ),
      makeCell(
        [makePara([makeRun('Điểm', { bold: true, color: 'FFFFFF', size: 19 })], { align: AlignmentType.CENTER })],
        { fill: '1E3A8A', widthPct: 4 }
      )
    ]
  });

  const specBodyRows: TableRow[] = summary.specRows.map(sr => {
    const formatSummaryParas =
      sr.allocations.length > 0
        ? sr.allocations.map(al => {
            const unitStr = al.questionType === 'true_false_group' || al.questionType === 'essay' ? 'ý' : 'câu';
            return makePara([
              makeRun(`${QUESTION_FORMAT_LABELS[al.questionType]}: `, { bold: true, size: 18 }),
              makeRun(`${al.count} ${unitStr}`, { size: 18 }),
              ...(al.isSharedCredit ? [makeRun(' (gắn chung)', { italics: true, size: 16, color: '64748B' })] : [])
            ]);
          })
        : [makePara([makeRun('Chưa phân bổ', { italics: true, size: 17, color: '94A3B8' })], { align: AlignmentType.CENTER })];

    const codesText =
      sr.allocations.length > 0
        ? sr.allocations.map(al => al.codeText).filter(Boolean).join('; ')
        : '-';

    return new TableRow({
      cantSplit: true,
      children: [
        makeCell([makePara([makeRun(String(sr.orderIndex), { bold: true, size: 18 })], { align: AlignmentType.CENTER })]),
        makeCell([makePara([makeRun(sr.topic, { bold: true, size: 18 })])]),
        makeCell([makePara([makeRun(sr.unit, { size: 18 })])]),
        makeCell([
          makePara([
            makeRun(`${sr.yccdItem.sourceLabel} `, { bold: true, size: 18, color: '1D4ED8' }),
            makeRun(sr.yccdItem.yccd, { size: 18 })
          ])
        ]),
        makeCell([makePara([makeRun(sr.competencyCode || '-', { bold: true, size: 18 })], { align: AlignmentType.CENTER })]),
        makeCell([
          makePara(
            [
              makeRun(sr.levelLabel, {
                bold: true,
                size: 18,
                color: sr.level === 'know' ? '1D4ED8' : sr.level === 'understand' ? 'B45309' : '047857'
              })
            ],
            { align: AlignmentType.CENTER }
          )
        ]),
        makeCell(formatSummaryParas),
        makeCell([makePara([makeRun(codesText, { bold: true, size: 18 })], { align: AlignmentType.CENTER })]),
        makeCell([
          makePara([makeRun(sr.rowTotalPoints > 0 ? sr.rowTotalPoints.toFixed(2) : '-', { bold: true, size: 18 })], {
            align: AlignmentType.CENTER
          })
        ])
      ]
    });
  });

  const specFooterRow = new TableRow({
    cantSplit: true,
    children: [
      makeCell(
        [
          makePara(
            [
              makeRun(
                `TỔNG CỘNG: ${summary.totalOriginalQuestions} câu gốc (${summary.totalSubItems} ý) • Biết ${formatPercentClean(
                  summary.levelPercents.know
                )} – Hiểu ${formatPercentClean(summary.levelPercents.understand)} – Vận dụng ${formatPercentClean(
                  summary.levelPercents.apply
                )}`,
                { bold: true, size: 18 }
              )
            ],
            { align: AlignmentType.CENTER }
          )
        ],
        { colSpan: 8, fill: 'EFF6FF' }
      ),
      makeCell(
        [
          makePara([makeRun(`${summary.totalPoints.toFixed(2)}đ`, { bold: true, size: 19, color: '1D4ED8' })], {
            align: AlignmentType.CENTER
          })
        ],
        { fill: 'EFF6FF' }
      )
    ]
  });

  const specTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [specHeaderRow, ...specBodyRows, specFooterRow]
  });

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: 22
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297)
            },
            margin: {
              top: convertMillimetersToTwip(12),
              bottom: convertMillimetersToTwip(12),
              left: convertMillimetersToTwip(12),
              right: convertMillimetersToTwip(12)
            }
          }
        },
        children: [
          officialHeaderTable,
          makePara(
            [
              makeRun(`MA TRẬN VÀ BẢN ĐẶC TẢ ĐỀ KIỂM TRA ${periodLabel.toUpperCase()}`, {
                bold: true,
                size: 28,
                color: '082B52'
              })
            ],
            { align: AlignmentType.CENTER, spacingBefore: 160, spacingAfter: 60 }
          ),
          makePara(
            [
              makeRun('Môn học: ', { bold: true, size: 22 }),
              makeRun(`${draft.subject}   |   `, { size: 22 }),
              makeRun('Khối: ', { bold: true, size: 22 }),
              makeRun(`Lớp ${draft.grade}   |   `, { size: 22 }),
              makeRun('Thời lượng: ', { bold: true, size: 22 }),
              makeRun(`${draft.durationMinutes} phút   |   `, { size: 22 }),
              makeRun('Năm học: ', { bold: true, size: 22 }),
              makeRun(`${draft.schoolYear}   |   `, { size: 22 }),
              makeRun('Tổng điểm: ', { bold: true, size: 22 }),
              makeRun(`${summary.totalPoints.toFixed(2)} / ${draft.pointConfig.targetTotalScore.toFixed(1)}`, {
                bold: true,
                size: 22,
                color: '1D4ED8'
              })
            ],
            { align: AlignmentType.CENTER, spacingAfter: 160 }
          ),

          makePara([makeRun('PHẦN I. BẢNG MA TRẬN ĐỀ KIỂM TRA', { bold: true, size: 24, color: '1E3A8A' })], {
            spacingBefore: 80,
            spacingAfter: 80
          }),
          matrixTable,
          makePara(
            [
              makeRun(
                `Ghi chú quy đổi điểm hiện hành: TNKQ ${draft.pointConfig.singleChoicePerQuestion.toFixed(
                  2
                )}đ/câu; Đúng–Sai ${draft.pointConfig.trueFalsePerSubItem.toFixed(
                  2
                )}đ/ý; ${draft.showShortAnswer ? `Trả lời ngắn ${draft.pointConfig.shortAnswerPerQuestion.toFixed(2)}đ/câu; ` : ''}Tự luận ${draft.pointConfig.essayPerSubItem.toFixed(
                  2
                )}đ/ý. Mức độ thực tế: Biết ${formatPercentClean(summary.levelPercents.know)} – Hiểu ${formatPercentClean(
                  summary.levelPercents.understand
                )} – Vận dụng ${formatPercentClean(summary.levelPercents.apply)}.`,
                { italics: true, size: 19, color: '334155' }
              )
            ],
            { spacingBefore: 80, spacingAfter: 140 }
          ),

          makePara(
            [makeRun('PHẦN II. BẢN ĐẶC TẢ ĐỀ KIỂM TRA (YCCĐ & NĂNG LỰC)', { bold: true, size: 24, color: '1E3A8A' })],
            {
              pageBreakBefore: true,
              spacingBefore: 60,
              spacingAfter: 80
            }
          ),
          specTable
        ]
      }
    ]
  });
}

export async function exportMatrixAndSpecDocx(input: DocxBuildInput, fileName?: string): Promise<void> {
  const doc = buildMatrixAndSpecDocx(input);
  const blob = await Packer.toBlob(doc);
  const safeSubject = input.draft.subject.replace(/\s+/g, '_');
  const safePeriod = EXAM_PERIOD_LABELS[input.draft.period].replace(/\s+/g, '_');
  const finalName =
    fileName || `Ma_tran_Dac_ta_${safeSubject}_Khoi_${input.draft.grade}_${safePeriod}_THCS_Tay_Do.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
