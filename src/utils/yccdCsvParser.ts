import { CognitiveLevel, Grade, SubjectId, YccdItem } from '../types';

export interface YccdCsvParseError {
  rowNumber: number;
  reason: string;
  rawPreview: string;
}

export interface YccdCsvGroupStat {
  subject: string;
  grade: Grade;
  count: number;
}

export interface YccdCsvParseResult {
  items: YccdItem[];
  errors: YccdCsvParseError[];
  groupStats: YccdCsvGroupStat[];
  totalDataRows: number;
}

export function normalizeSubjectToKey(subject: string = ''): SubjectId {
  const raw = String(subject).trim().toLowerCase();
  if (
    raw === 'informatics' ||
    raw === 'math' ||
    raw === 'science' ||
    raw === 'literature' ||
    raw === 'english' ||
    raw === 'history_geo' ||
    raw === 'technology' ||
    raw === 'civics'
  ) {
    return raw as SubjectId;
  }

  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.includes('tin hoc') || clean === 'tin' || clean.includes('informatics')) return 'informatics';
  if (clean.includes('toan') || clean.includes('math')) return 'math';
  if (clean.includes('khoa hoc') || clean.includes('khtn') || clean.includes('science')) return 'science';
  if (clean.includes('ngu van') || clean === 'van' || clean.includes('literature')) return 'literature';
  if (clean.includes('tieng anh') || clean === 'anh' || clean.includes('english')) return 'english';
  if (
    clean.includes('lich su') ||
    clean.includes('dia li') ||
    clean.includes('dia ly') ||
    clean.includes('su va dia') ||
    clean === 'su' ||
    clean === 'dia' ||
    clean.includes('history')
  ) {
    return 'history_geo';
  }
  if (clean.includes('cong nghe') || clean.includes('technology')) return 'technology';
  if (clean.includes('giao duc cong dan') || clean.includes('gdcd') || clean.includes('cong dan') || clean.includes('civics')) {
    return 'civics';
  }
  return 'other';
}

export function subjectKeyToDisplayName(key: SubjectId | string): string {
  switch (key) {
    case 'informatics':
      return 'Tin học';
    case 'math':
      return 'Toán';
    case 'science':
      return 'Khoa học tự nhiên';
    case 'literature':
      return 'Ngữ văn';
    case 'english':
      return 'Tiếng Anh';
    case 'history_geo':
      return 'Lịch sử và Địa lí';
    case 'technology':
      return 'Công nghệ';
    case 'civics':
      return 'Giáo dục công dân';
    default:
      return String(key || 'Môn khác');
  }
}

export function stripVietnameseAccents(value: string = ''): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function normalizeHeaderName(name: string): string {
  return stripVietnameseAccents(name).replace(/\s+/g, ' ').trim();
}

/**
 * State-machine RFC-4180 CSV parser:
 * - Strips UTF-8 BOM (\uFEFF)
 * - Handles CRLF (\r\n) & LF (\n)
 * - Preserves commas and newlines inside double-quoted fields
 * - Handles escaped double quotes ("")
 */
export function parseCsvMatrixRecords(rawText: string): string[][] {
  const cleanText = rawText.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\r') {
      if (next === '\n') i++;
      currentRow.push(currentCell);
      records.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else if (ch === '\n') {
      currentRow.push(currentCell);
      records.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    records.push(currentRow);
  }

  return records.filter(row => row.some(cell => cell.trim() !== ''));
}

function parseCognitiveLevel(sourceLabel: string, levelText: string): { level: CognitiveLevel; label: string; normalizedSource: string } | null {
  const srcClean = sourceLabel.trim().toUpperCase();
  const lvlNorm = stripVietnameseAccents(levelText);

  if (srcClean.includes('[NB]') || srcClean === 'NB' || lvlNorm.includes('nhan biet')) {
    return { level: 'know', label: 'Nhận biết', normalizedSource: srcClean || '[NB]' };
  }
  if (srcClean.includes('[TH]') || srcClean === 'TH' || lvlNorm.includes('thong hieu')) {
    return { level: 'understand', label: 'Thông hiểu', normalizedSource: srcClean || '[TH]' };
  }
  if (srcClean.includes('[VD]') || srcClean.includes('[VDC]') || srcClean === 'VD' || lvlNorm.includes('van dung')) {
    return { level: 'apply', label: 'Vận dụng', normalizedSource: srcClean || '[VD]' };
  }
  return null;
}

export function normalizeId(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeGrade(value: unknown): Grade {
  const match = String(value ?? '').match(/([6-9])/);
  return (match ? match[1] : '6') as Grade;
}

export function buildYccdStableKey(sourceLabel: string, subject: string, grade: Grade, yccdId: unknown): string {
  const srcKey = stripVietnameseAccents(sourceLabel).replace(/[^a-z0-9]/g, '') || 'src';
  const subjKey = normalizeSubjectToKey(subject);
  const normGrade = normalizeGrade(grade);
  const idClean = normalizeId(yccdId);
  return `${srcKey}|${subjKey}|${normGrade}|${idClean}`;
}

/**
 * Canonical deduplication / upsert identity key:
 * internal subject key + grade + source YCCĐ ID.
 */
export function buildYccdIdentityKey(
  item: Pick<YccdItem, 'subjectKey' | 'subject' | 'grade' | 'yccdId' | 'stableKey'>
): string {
  const subjKey = item.subjectKey ? normalizeSubjectToKey(item.subjectKey) : normalizeSubjectToKey(item.subject);
  const normGrade = normalizeGrade(item.grade);
  const idClean = normalizeId(item.yccdId);
  if (idClean) {
    return `${subjKey}|${normGrade}|${idClean}`;
  }
  return normalizeId(item.stableKey);
}

export function normalizeYccdItem(raw: YccdItem): YccdItem {
  const subjectRaw = String(raw.subject ?? '').trim();
  const subjectKey = raw.subjectKey ? normalizeSubjectToKey(raw.subjectKey) : normalizeSubjectToKey(subjectRaw);
  const subject = subjectRaw || subjectKeyToDisplayName(subjectKey);
  const grade = normalizeGrade(raw.grade);
  const topic = String(raw.topic ?? '').trim();
  const unit = String(raw.unit ?? '').trim();
  const yccd = String(raw.yccd ?? '').trim();
  const sourceLabel = String(raw.sourceLabel ?? '').trim().toUpperCase() || '[NB]';
  const topicId = normalizeId(raw.topicId) || stripVietnameseAccents(topic).slice(0, 24);
  const topicShortLabel = String(raw.topicShortLabel ?? '').trim() || topic.split('.')[0] || topic;
  const unitId = normalizeId(raw.unitId) || stripVietnameseAccents(unit).slice(0, 24);
  const yccdId = normalizeId(raw.yccdId);
  const stableKey =
    normalizeId(raw.stableKey) || buildYccdStableKey(sourceLabel, subject || subjectKey, grade, yccdId);

  return {
    ...raw,
    stableKey,
    subject,
    subjectKey,
    grade,
    topic,
    unit,
    yccd,
    sourceLabel,
    topicId,
    topicShortLabel,
    unitId,
    yccdId
  };
}

export function parseYccdCsv(csvText: string): YccdCsvParseResult {
  const records = parseCsvMatrixRecords(csvText);
  if (records.length === 0) {
    return {
      items: [],
      errors: [{ rowNumber: 1, reason: 'Tệp CSV trống hoặc không có dữ liệu.', rawPreview: '' }],
      groupStats: [],
      totalDataRows: 0
    };
  }

  const headerRow = records[0].map(h => h.trim());
  const colIndexByNorm = new Map<string, number>();
  headerRow.forEach((h, idx) => {
    colIndexByNorm.set(normalizeHeaderName(h), idx);
  });

  const findCol = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = colIndexByNorm.get(normalizeHeaderName(alias));
      if (idx !== undefined) return idx;
    }
    return -1;
  };

  const colMap = {
    subject: findCol(['Môn học', 'Mon hoc']),
    grade: findCol(['Khối', 'Khoi', 'Khối lớp']),
    topic: findCol(['Chương / Chủ đề', 'Chuong / Chu de', 'Chủ đề', 'Chương']),
    unit: findCol(['Nội dung / Đơn vị kiến thức', 'Noi dung / Don vi kien thuc', 'Đơn vị kiến thức']),
    yccd: findCol(['Yêu cầu cần đạt', 'Yeu cau can dat', 'YCCĐ']),
    sourceLabel: findCol(['Nhãn nguồn', 'Nhan nguon']),
    level: findCol(['Mức độ', 'Muc do']),
    topicId: findCol(['ID chủ đề', 'ID chu de']),
    topicShortLabel: findCol(['Nhãn ngắn chủ đề', 'Nhan ngan chu de']),
    unitId: findCol(['ID đơn vị', 'ID don vi']),
    yccdId: findCol(['ID YCCĐ', 'ID YCCD']),
    competency: findCol(['Năng lực', 'Mã năng lực', 'Nang luc', 'Ma nang luc'])
  };

  const requiredCols: Array<[keyof typeof colMap, string]> = [
    ['subject', 'Môn học'],
    ['grade', 'Khối'],
    ['topic', 'Chương / Chủ đề'],
    ['unit', 'Nội dung / Đơn vị kiến thức'],
    ['yccd', 'Yêu cầu cần đạt'],
    ['sourceLabel', 'Nhãn nguồn'],
    ['level', 'Mức độ'],
    ['topicId', 'ID chủ đề'],
    ['topicShortLabel', 'Nhãn ngắn chủ đề'],
    ['unitId', 'ID đơn vị'],
    ['yccdId', 'ID YCCĐ']
  ];

  const missingHeaders = requiredCols.filter(([k]) => colMap[k] === -1).map(([, label]) => label);
  if (missingHeaders.length > 0) {
    return {
      items: [],
      errors: [
        {
          rowNumber: 1,
          reason: `Thiếu các cột bắt buộc trong tiêu đề CSV: ${missingHeaders.join(', ')}`,
          rawPreview: headerRow.join(', ').slice(0, 120)
        }
      ],
      groupStats: [],
      totalDataRows: Math.max(0, records.length - 1)
    };
  }

  const items: YccdItem[] = [];
  const errors: YccdCsvParseError[] = [];
  const seenKeys = new Map<string, number>();

  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    const rowNumber = i + 1;
    const get = (idx: number) => (idx >= 0 && idx < row.length ? row[idx].trim() : '');

    const subjectRaw = get(colMap.subject);
    const gradeRaw = get(colMap.grade);
    const topic = get(colMap.topic);
    const unit = get(colMap.unit);
    const yccd = get(colMap.yccd);
    const sourceLabel = get(colMap.sourceLabel);
    const levelText = get(colMap.level);
    const topicId = get(colMap.topicId);
    const topicShortLabel = get(colMap.topicShortLabel);
    const unitId = get(colMap.unitId);
    const yccdId = get(colMap.yccdId);
    const competencyRaw = colMap.competency >= 0 ? get(colMap.competency) : '';

    const rawPreview = row.join(' | ').slice(0, 120);

    const gradeMatch = gradeRaw.match(/([6-9])/);
    if (!gradeMatch) {
      errors.push({ rowNumber, reason: `Khối "${gradeRaw}" không nằm trong phạm vi THCS (6–9).`, rawPreview });
      continue;
    }
    const grade = gradeMatch[1] as Grade;

    if (!subjectRaw || !topic || !unit || !yccd || !yccdId) {
      errors.push({
        rowNumber,
        reason: 'Thiếu dữ liệu bắt buộc (Môn học, Chương / Chủ đề, Nội dung, YCCĐ hoặc ID YCCĐ).',
        rawPreview
      });
      continue;
    }

    const parsedLevel = parseCognitiveLevel(sourceLabel, levelText);
    if (!parsedLevel) {
      errors.push({
        rowNumber,
        reason: `Không nhận diện được mức độ nhận thức từ Nhãn nguồn "${sourceLabel}" / Mức độ "${levelText}".`,
        rawPreview
      });
      continue;
    }

    const subjectKey = normalizeSubjectToKey(subjectRaw);
    const canonicalSubject = subjectKey !== 'other' ? subjectKeyToDisplayName(subjectKey) : subjectRaw;
    const stableKey = buildYccdStableKey(parsedLevel.normalizedSource, canonicalSubject, grade, yccdId);

    const normalizedItem = normalizeYccdItem({
      stableKey,
      subject: canonicalSubject,
      subjectKey,
      grade,
      topic,
      unit,
      yccd,
      sourceLabel: parsedLevel.normalizedSource,
      level: parsedLevel.level,
      levelLabel: parsedLevel.label,
      topicId: topicId || stripVietnameseAccents(topic).slice(0, 24),
      topicShortLabel: topicShortLabel || topic.split('.')[0] || topic,
      unitId: unitId || stripVietnameseAccents(unit).slice(0, 24),
      yccdId,
      competencyCode: competencyRaw || (subjectKey === 'informatics' ? 'NLa' : undefined),
      orderIndex: items.length
    });

    const identityKey = buildYccdIdentityKey(normalizedItem);
    const dupIdx = seenKeys.get(identityKey);
    if (dupIdx !== undefined) {
      items[dupIdx] = {
        ...normalizedItem,
        stableKey: items[dupIdx].stableKey,
        orderIndex: items[dupIdx].orderIndex
      };
    } else {
      seenKeys.set(identityKey, items.length);
      items.push(normalizedItem);
    }
  }

  const statMap = new Map<string, YccdCsvGroupStat>();
  for (const it of items) {
    const k = `${it.subject}__${it.grade}`;
    const existing = statMap.get(k);
    if (existing) {
      existing.count += 1;
    } else {
      statMap.set(k, { subject: it.subject, grade: it.grade, count: 1 });
    }
  }

  return {
    items,
    errors,
    groupStats: Array.from(statMap.values()).sort((a, b) =>
      a.subject.localeCompare(b.subject, 'vi') || Number(a.grade) - Number(b.grade)
    ),
    totalDataRows: records.length - 1
  };
}

export function mergeYccdCatalog(
  existing: YccdItem[],
  incoming: YccdItem[]
): { merged: YccdItem[]; inserted: number; updated: number; unchanged: number; upsertedItems: YccdItem[] } {
  const byIdentity = new Map<string, number>();
  const result: YccdItem[] = [];

  for (const raw of existing) {
    const item = normalizeYccdItem(raw);
    const idKey = buildYccdIdentityKey(item);
    const prevIdx = byIdentity.get(idKey);
    if (prevIdx === undefined) {
      byIdentity.set(idKey, result.length);
      result.push({ ...item, orderIndex: result.length });
    } else {
      result[prevIdx] = {
        ...item,
        stableKey: result[prevIdx].stableKey,
        orderIndex: result[prevIdx].orderIndex
      };
    }
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const upsertedItems: YccdItem[] = [];

  for (const rawItem of incoming) {
    const item = normalizeYccdItem(rawItem);
    const idKey = buildYccdIdentityKey(item);
    const idx = byIdentity.get(idKey);
    if (idx === undefined) {
      const nextItem = { ...item, orderIndex: result.length };
      byIdentity.set(idKey, result.length);
      result.push(nextItem);
      upsertedItems.push(nextItem);
      inserted++;
    } else {
      const prev = result[idx];
      const same =
        prev.subject === item.subject &&
        prev.subjectKey === item.subjectKey &&
        prev.grade === item.grade &&
        prev.topic === item.topic &&
        prev.topicShortLabel === item.topicShortLabel &&
        prev.unit === item.unit &&
        prev.yccd === item.yccd &&
        prev.level === item.level &&
        prev.levelLabel === item.levelLabel &&
        prev.sourceLabel === item.sourceLabel &&
        prev.topicId === item.topicId &&
        prev.unitId === item.unitId &&
        prev.yccdId === item.yccdId &&
        (prev.competencyCode || '') === (item.competencyCode || '');

      if (same) {
        unchanged++;
      } else {
        // Preserve prev.stableKey so saved ExamMatrix drafts referencing older stableKeys stay valid
        const updatedItem = { ...item, stableKey: prev.stableKey, orderIndex: prev.orderIndex };
        result[idx] = updatedItem;
        upsertedItems.push(updatedItem);
        updated++;
      }
    }
  }

  return { merged: result, inserted, updated, unchanged, upsertedItems };
}

