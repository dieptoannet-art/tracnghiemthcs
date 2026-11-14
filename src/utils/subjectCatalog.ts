import type { SubjectId } from '../types/index.ts';

export interface CanonicalSubjectOption {
  id: SubjectId;
  name: string;
  shortCode: string;
  aliases: string[];
}

export const CANONICAL_SUBJECT_CATALOG: CanonicalSubjectOption[] = [
  {
    id: 'math',
    name: 'Toán',
    shortCode: 'TOAN',
    aliases: ['toan', 'toan hoc', 'math', 'mathematics']
  },
  {
    id: 'informatics',
    name: 'Tin học',
    shortCode: 'TIN',
    aliases: ['tin', 'tin hoc', 'informatics', 'it']
  },
  {
    id: 'science',
    name: 'Khoa học tự nhiên',
    shortCode: 'KHTN',
    aliases: ['khtn', 'khoa hoc tu nhien', 'science', 'natural science']
  },
  {
    id: 'literature',
    name: 'Ngữ văn',
    shortCode: 'VAN',
    aliases: ['van', 'ngu van', 'literature']
  },
  {
    id: 'english',
    name: 'Tiếng Anh',
    shortCode: 'ANH',
    aliases: ['anh', 'tieng anh', 'ngoai ngu', 'english']
  },
  {
    id: 'history_geo',
    name: 'Lịch sử và Địa lí',
    shortCode: 'LSDL',
    aliases: [
      'lich su va dia li',
      'lich su va dia ly',
      'lich su dia li',
      'lich su dia ly',
      'lich su & dia li',
      'lich su & dia ly',
      'lsdl',
      'su dia',
      'su - dia',
      'history_geo',
      'history and geography'
    ]
  },
  {
    id: 'technology',
    name: 'Công nghệ',
    shortCode: 'CN',
    aliases: ['cong nghe', 'cn', 'technology']
  },
  {
    id: 'civics',
    name: 'Giáo dục công dân',
    shortCode: 'GDCD',
    aliases: ['gdcd', 'giao duc cong dan', 'civics']
  }
];

export function stripDiacriticsLower(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCanonicalSubjectOption(subjectId?: string | null): CanonicalSubjectOption {
  const clean = String(subjectId || '').trim().toLowerCase();
  const direct = CANONICAL_SUBJECT_CATALOG.find(item => item.id === clean);
  if (direct) return direct;
  const resolved = resolveCanonicalSubject(subjectId);
  if (resolved.ok && resolved.subjectId) {
    return CANONICAL_SUBJECT_CATALOG.find(item => item.id === resolved.subjectId) || CANONICAL_SUBJECT_CATALOG[0];
  }
  return {
    id: (clean || 'other') as SubjectId,
    name: subjectId ? String(subjectId) : 'Chưa bổ sung môn',
    shortCode: clean.toUpperCase() || 'OTHER',
    aliases: []
  };
}

export function getSubjectDisplayName(subjectId?: string | null): string {
  if (!subjectId || !String(subjectId).trim()) {
    return 'Chưa bổ sung môn';
  }
  return getCanonicalSubjectOption(subjectId).name;
}

export function resolveCanonicalSubject(rawInput?: string | null): {
  ok: boolean;
  subjectId?: SubjectId;
  label?: string;
  ambiguous?: boolean;
  error?: string;
} {
  const raw = String(rawInput || '').trim();
  if (!raw) {
    return { ok: false, error: 'Thiếu tên hoặc mã môn học.' };
  }

  const rawLower = raw.toLowerCase();
  const byExactId = CANONICAL_SUBJECT_CATALOG.find(item => item.id === rawLower);
  if (byExactId) {
    return { ok: true, subjectId: byExactId.id, label: byExactId.name };
  }

  const norm = stripDiacriticsLower(raw);
  const exactMatches = CANONICAL_SUBJECT_CATALOG.filter(item => {
    const normName = stripDiacriticsLower(item.name);
    const normCode = stripDiacriticsLower(item.shortCode);
    const normId = stripDiacriticsLower(item.id);
    if (norm === normName || norm === normCode || norm === normId) return true;
    return item.aliases.some(alias => stripDiacriticsLower(alias) === norm);
  });

  if (exactMatches.length === 1) {
    return { ok: true, subjectId: exactMatches[0].id, label: exactMatches[0].name };
  }
  if (exactMatches.length > 1) {
    return {
      ok: false,
      ambiguous: true,
      error: `Tên môn "${raw}" khớp nhiều môn học (${exactMatches.map(m => m.name).join(', ')}).`
    };
  }

  return {
    ok: false,
    error: `Môn "${raw}" không khớp danh mục môn THCS chuẩn (${CANONICAL_SUBJECT_CATALOG.map(m => m.name).join(', ')}).`
  };
}
