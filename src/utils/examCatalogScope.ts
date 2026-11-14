import {
  CognitiveLevel,
  ExamPeriod,
  Grade,
  Question,
  QuestionType,
  SubjectId,
  YccdItem
} from '../types';
import {
  CORE_KNOWLEDGE_LESSONS,
  getGroupsByGradeAndSubject,
  getLessonsByGroup
} from '../data/coreKnowledgeLessons';
import { buildYccdTree } from './matrixCalculations';
import { normalizeGrade, normalizeSubjectToKey, stripVietnameseAccents } from './yccdCsvParser';
import { isQuestionInSubject } from '../components/teacher/QuestionBank';

export const EXAM_GRADES: Grade[] = ['6', '7', '8', '9'];

export interface ExamSubjectOption {
  id: SubjectId;
  name: string;
  shortCode: string;
}

export const EXAM_SUBJECT_OPTIONS: ExamSubjectOption[] = [
  { id: 'math', name: 'Toán', shortCode: 'TOAN' },
  { id: 'informatics', name: 'Tin học', shortCode: 'TIN' },
  { id: 'science', name: 'Khoa học tự nhiên', shortCode: 'KHTN' },
  { id: 'literature', name: 'Ngữ văn', shortCode: 'VAN' },
  { id: 'english', name: 'Tiếng Anh', shortCode: 'ANH' },
  { id: 'history_geo', name: 'Lịch sử và Địa lí', shortCode: 'LSDL' },
  { id: 'technology', name: 'Công nghệ', shortCode: 'CN' },
  { id: 'civics', name: 'Giáo dục công dân', shortCode: 'GDCD' }
];

export const EXAM_PERIOD_META: Array<{ id: ExamPeriod; label: string; shortCode: string }> = [
  { id: 'mid1', label: 'Giữa kỳ I', shortCode: 'GK1' },
  { id: 'final1', label: 'Cuối kỳ I', shortCode: 'CK1' },
  { id: 'mid2', label: 'Giữa kỳ II', shortCode: 'GK2' },
  { id: 'final2', label: 'Cuối kỳ II', shortCode: 'CK2' }
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Trắc nghiệm 4 lựa chọn',
  true_false_group: 'Đúng – Sai nhiều ý',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận'
};

export const QUESTION_LEVEL_LABELS: Record<CognitiveLevel, string> = {
  know: 'Nhận biết',
  understand: 'Thông hiểu',
  apply: 'Vận dụng'
};

export const NO_CATALOG_MESSAGE = 'Chưa có danh mục chủ đề cho môn và khối này';

const SUBJECT_ID_TO_CATALOG_CODE: Partial<Record<SubjectId, string>> = {
  math: 'Toan',
  informatics: 'Tin',
  science: 'KHTN'
};

const TEXTBOOK_PRIORITY_ORDER = [
  'Kết nối tri thức',
  'Cánh Diều',
  'Chân trời sáng tạo'
];

export function getSubjectOption(subjectId: SubjectId): ExamSubjectOption {
  return (
    EXAM_SUBJECT_OPTIONS.find(item => item.id === subjectId) || {
      id: subjectId,
      name: 'Toán',
      shortCode: 'TOAN'
    }
  );
}

/**
 * Danh mục môn theo khối đang có trong dự án (THCS Khối 6–9).
 */
export function getSubjectsForGrade(_grade: Grade): ExamSubjectOption[] {
  return EXAM_SUBJECT_OPTIONS;
}

export function normalizeTextbookName(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const clean = stripVietnameseAccents(raw).replace(/\s+/g, ' ');
  if (clean.includes('ket noi tri thuc') || clean === 'kntt') return 'Kết nối tri thức';
  if (clean.includes('canh dieu') || clean === 'cd') return 'Cánh Diều';
  if (clean.includes('chan troi sang tao') || clean === 'ctst') return 'Chân trời sáng tạo';
  return raw;
}

export function isQuestionApprovedForExam(q: Pick<Question, 'status'>): boolean {
  return q.status === 'approved';
}

/**
 * Lấy danh sách bộ sách có mặt trong dữ liệu dự án cho cặp (Khối, Môn).
 * Chỉ hiện bộ chọn "Bộ sách" trên giao diện khi có từ 2 bộ sách trở lên.
 */
export function getAvailableTextbooksForCombo(
  grade: Grade,
  subject: SubjectId,
  questions: Question[]
): string[] {
  const found = new Set<string>();
  const catalogCode = SUBJECT_ID_TO_CATALOG_CODE[subject];
  const numericGrade = Number(normalizeGrade(grade));

  if (catalogCode) {
    const hasCoreCatalog = CORE_KNOWLEDGE_LESSONS.some(
      l => l.grade === numericGrade && l.subjectCode === catalogCode
    );
    if (hasCoreCatalog) {
      found.add('Kết nối tri thức');
    }
  }

  for (const q of questions) {
    if (!isQuestionApprovedForExam(q)) continue;
    if (normalizeGrade(q.grade) !== normalizeGrade(grade)) continue;
    if (!isQuestionInSubject(q, subject)) continue;
    const tb = normalizeTextbookName(q.textbook);
    if (tb) found.add(tb);
  }

  return Array.from(found).sort((a, b) => {
    const idxA = TEXTBOOK_PRIORITY_ORDER.indexOf(a);
    const idxB = TEXTBOOK_PRIORITY_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b, 'vi');
  });
}

function normalizeSearchTokens(value: string): string {
  return stripVietnameseAccents(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function romanToInt(romanRaw: string): number | null {
  const s = romanRaw.toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const curr = map[s[i]];
    const next = i + 1 < s.length ? map[s[i + 1]] : 0;
    if (curr < next) {
      total -= curr;
    } else {
      total += curr;
    }
  }
  return total > 0 ? total : null;
}

function extractChapterNumber(label: string): number | null {
  const norm = stripVietnameseAccents(label);
  const arabicMatch = norm.match(/\b(?:chuong|chu de|phan)\s+(\d+)\b/);
  if (arabicMatch) {
    const num = Number(arabicMatch[1]);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  const romanMatch = norm.match(/\bchuong\s+([ivxlcdm]+)\b/);
  if (romanMatch) {
    return romanToInt(romanMatch[1]);
  }
  return null;
}

function extractTopicLetter(label: string): string | null {
  const norm = stripVietnameseAccents(label);
  const match = norm.match(/\bchu de\s+([a-g])\b/);
  return match ? match[1].toUpperCase() : null;
}

function stripLeadingGroupPrefix(label: string): string {
  return String(label || '')
    .replace(/^\s*(?:Chương|Chủ đề|Phần|Unit)\s+[A-Za-z0-9IVXLCDM]+\s*[.:–-]?\s*/i, '')
    .trim();
}

function stripLeadingLessonPrefix(label: string): string {
  return String(label || '')
    .replace(/^\s*(?:Bài|Tiết|Lesson)\s+\d+[a-zA-Z]?\s*[.:–-]?\s*/i, '')
    .trim();
}

function extractLessonCode(lessonLabel: string, questionCode?: string): string | null {
  const normLesson = stripVietnameseAccents(lessonLabel);
  const lessonMatch = normLesson.match(/\b(?:bai|lesson)\s+(\d+[a-z]?)\b/);
  if (lessonMatch) {
    return lessonMatch[1].toLowerCase();
  }
  if (questionCode) {
    const codeMatch = String(questionCode).trim().toUpperCase().match(/_B0*(\d+[A-Z]?)(?:_|$)/);
    if (codeMatch) {
      return codeMatch[1].toLowerCase();
    }
  }
  return null;
}

function extractChapterNumberFromCode(questionCode?: string): number | null {
  if (!questionCode) return null;
  const match = String(questionCode).trim().toUpperCase().match(/_C0*(\d+)(?:_|$)/);
  return match ? Number(match[1]) : null;
}

export interface ScopeCatalogLesson {
  id: string;
  groupId: string;
  lessonCode: string;
  label: string;
  titleBody: string;
  itemType: string;
  sortOrder: number;
  normalizedLabel: string;
  normalizedTitleBody: string;
  tokens: string[];
}

export interface ScopeCatalogGroup {
  id: string;
  volume: number;
  groupType: string;
  chapterNumber: number | null;
  topicLetter: string | null;
  label: string;
  titleBody: string;
  normalizedLabel: string;
  normalizedTitleBody: string;
  lessons: ScopeCatalogLesson[];
}

export interface ExamScopeCatalog {
  hasCatalog: boolean;
  sourceName: 'core_knowledge_catalog' | 'yccd_catalog' | 'none';
  textbookLabel: string;
  groups: ScopeCatalogGroup[];
}

function tokenizeSignificantWords(text: string): string[] {
  const stopWords = new Set(['va', 'cac', 'cua', 'voi', 've', 'mot', 'so', 'trong', 'cho', 'bai', 'hinh', 'thuc', 'hanh']);
  return normalizeSearchTokens(text)
    .split(' ')
    .filter(tok => tok.length >= 2 && !stopWords.has(tok));
}

/**
 * Nạp danh mục chương/chủ đề/bài học chuẩn xác theo đúng thứ tự từ danh mục dự án.
 * Tuyệt đối KHÔNG suy danh mục từ các câu hỏi mẫu.
 */
export function buildExamScopeCatalog(params: {
  grade: Grade;
  subject: SubjectId;
  textbook?: string;
  yccdCatalog: YccdItem[];
}): ExamScopeCatalog {
  const { grade, subject, textbook = '', yccdCatalog } = params;
  const normGrade = normalizeGrade(grade) as Grade;
  const numericGrade = Number(normGrade);
  const catalogCode = SUBJECT_ID_TO_CATALOG_CODE[subject];
  const normTextbook = normalizeTextbookName(textbook);

  const matchingYccd = (yccdCatalog || []).filter(
    it =>
      normalizeSubjectToKey(it.subjectKey || it.subject) === subject &&
      normalizeGrade(it.grade) === normGrade
  );

  // Trường hợp Tin học chọn bộ Cánh Diều: ưu tiên danh mục Chủ đề A..G từ YCCĐ chuẩn GDPT 2018
  if (subject === 'informatics' && normTextbook === 'Cánh Diều' && matchingYccd.length > 0) {
    const tree = buildYccdTree(matchingYccd);
    const groups: ScopeCatalogGroup[] = tree.map((topicNode, gIdx) => {
      const groupId = `yccd::${normGrade}::${subject}::${topicNode.topicId}`;
      const titleBody = stripLeadingGroupPrefix(topicNode.topic);
      const lessons: ScopeCatalogLesson[] = topicNode.units.map((u, uIdx) => {
        const lessonBody = stripLeadingLessonPrefix(u.unit);
        return {
          id: `yccd-unit::${u.unitKey}`,
          groupId,
          lessonCode: '',
          label: u.unit,
          titleBody: lessonBody,
          itemType: 'unit',
          sortOrder: uIdx + 1,
          normalizedLabel: normalizeSearchTokens(u.unit),
          normalizedTitleBody: normalizeSearchTokens(lessonBody),
          tokens: tokenizeSignificantWords(lessonBody)
        };
      });

      return {
        id: groupId,
        volume: 1,
        groupType: 'topic',
        chapterNumber: gIdx + 1,
        topicLetter: extractTopicLetter(topicNode.topic) || extractTopicLetter(topicNode.topicShortLabel),
        label: topicNode.topic,
        titleBody,
        normalizedLabel: normalizeSearchTokens(topicNode.topic),
        normalizedTitleBody: normalizeSearchTokens(titleBody),
        lessons
      };
    });

    return {
      hasCatalog: groups.length > 0,
      sourceName: groups.length > 0 ? 'yccd_catalog' : 'none',
      textbookLabel: 'Cánh Diều',
      groups
    };
  }

  // Nguồn danh mục chính: catalog_kien_thuc_trong_tam.json (Toán 6–9, Tin học 6–9, KHTN 6–9 — KNTT)
  if (
    catalogCode &&
    (!normTextbook || normTextbook === 'all' || normTextbook === 'Kết nối tri thức')
  ) {
    const rawGroups = getGroupsByGradeAndSubject(numericGrade, catalogCode);
    if (rawGroups.length > 0) {
      const groups: ScopeCatalogGroup[] = rawGroups.map(g => {
        const rawLessons = getLessonsByGroup(numericGrade, catalogCode, g.groupKey);
        const groupId = `${catalogCode.toLowerCase()}_${normGrade}::${g.groupKey}`;
        const titleBody = g.chapterTitle || stripLeadingGroupPrefix(g.chapterLabel);

        const lessons: ScopeCatalogLesson[] = rawLessons.map(lesson => {
          const lessonBody = lesson.lessonTitle || stripLeadingLessonPrefix(lesson.lessonLabel);
          return {
            id: lesson.id,
            groupId,
            lessonCode: String(lesson.lessonCode || '').trim(),
            label: lesson.lessonLabel,
            titleBody: lessonBody,
            itemType: lesson.itemType,
            sortOrder: lesson.sortOrder,
            normalizedLabel: normalizeSearchTokens(lesson.lessonLabel),
            normalizedTitleBody: normalizeSearchTokens(lessonBody),
            tokens: tokenizeSignificantWords(lessonBody)
          };
        });

        return {
          id: groupId,
          volume: g.volume,
          groupType: g.groupType,
          chapterNumber:
            g.chapterNumber !== null && g.chapterNumber > 0
              ? g.chapterNumber
              : extractChapterNumber(g.chapterLabel),
          topicLetter: extractTopicLetter(g.chapterLabel),
          label: g.chapterLabel,
          titleBody,
          normalizedLabel: normalizeSearchTokens(g.chapterLabel),
          normalizedTitleBody: normalizeSearchTokens(titleBody),
          lessons
        };
      });

      return {
        hasCatalog: true,
        sourceName: 'core_knowledge_catalog',
        textbookLabel: 'Kết nối tri thức',
        groups
      };
    }
  }

  // Fallback tới YCCĐ nếu môn/khối khác được giáo viên nạp YCCĐ CSV
  if (matchingYccd.length > 0 && (!normTextbook || normTextbook === 'all' || subject === 'informatics')) {
    const tree = buildYccdTree(matchingYccd);
    const groups: ScopeCatalogGroup[] = tree.map((topicNode, gIdx) => {
      const groupId = `yccd::${normGrade}::${subject}::${topicNode.topicId}`;
      const titleBody = stripLeadingGroupPrefix(topicNode.topic);
      const lessons: ScopeCatalogLesson[] = topicNode.units.map((u, uIdx) => {
        const lessonBody = stripLeadingLessonPrefix(u.unit);
        return {
          id: `yccd-unit::${u.unitKey}`,
          groupId,
          lessonCode: '',
          label: u.unit,
          titleBody: lessonBody,
          itemType: 'unit',
          sortOrder: uIdx + 1,
          normalizedLabel: normalizeSearchTokens(u.unit),
          normalizedTitleBody: normalizeSearchTokens(lessonBody),
          tokens: tokenizeSignificantWords(lessonBody)
        };
      });

      return {
        id: groupId,
        volume: 1,
        groupType: 'topic',
        chapterNumber: gIdx + 1,
        topicLetter: extractTopicLetter(topicNode.topic) || extractTopicLetter(topicNode.topicShortLabel),
        label: topicNode.topic,
        titleBody,
        normalizedLabel: normalizeSearchTokens(topicNode.topic),
        normalizedTitleBody: normalizeSearchTokens(titleBody),
        lessons
      };
    });

    if (groups.length > 0) {
      return {
        hasCatalog: true,
        sourceName: 'yccd_catalog',
        textbookLabel: normTextbook || 'Danh mục YCCĐ',
        groups
      };
    }
  }

  return {
    hasCatalog: false,
    sourceName: 'none',
    textbookLabel: normTextbook || '',
    groups: []
  };
}

function hasStrongKeywordMatch(aTokens: string[], bTokens: string[], aBodyNorm: string, bBodyNorm: string): boolean {
  if (!aBodyNorm || !bBodyNorm) return false;
  if (aBodyNorm.length >= 5 && bBodyNorm.length >= 5) {
    if (aBodyNorm.includes(bBodyNorm) || bBodyNorm.includes(aBodyNorm)) {
      return true;
    }
  }
  if (aTokens.length === 0 || bTokens.length === 0) return false;
  const bSet = new Set(bTokens);
  const aSet = new Set(aTokens);
  let overlapA = 0;
  for (const tok of aSet) {
    if (bSet.has(tok)) overlapA++;
  }
  let overlapB = 0;
  for (const tok of bSet) {
    if (aSet.has(tok)) overlapB++;
  }
  const ratioA = overlapA / aSet.size;
  const ratioB = overlapB / bSet.size;
  return overlapA >= 2 && (ratioA >= 0.7 || ratioB >= 0.7);
}

/**
 * Kiểm tra câu hỏi q có thuộc chương / chủ đề g hay không.
 */
export function doesQuestionMatchCatalogGroup(q: Question, group: ScopeCatalogGroup): boolean {
  const anyQ = q as unknown as Record<string, unknown>;
  const qChapterKey = String(anyQ.chapterKey || anyQ.topicId || '').trim();
  if (qChapterKey && (qChapterKey === group.id || group.id.endsWith(`::${qChapterKey}`))) {
    return true;
  }

  const qChapterRaw = String(q.chapter || '').trim();
  const qChapterNorm = normalizeSearchTokens(qChapterRaw);
  const qChapterBodyNorm = normalizeSearchTokens(stripLeadingGroupPrefix(qChapterRaw));

  // Đối chiếu trực tiếp tên nhóm đặc biệt (Mở đầu, Hoạt động trải nghiệm, Ôn tập cuối năm)
  if (group.groupType === 'intro') {
    return qChapterNorm.includes('mo dau');
  }
  if (group.groupType === 'activity') {
    return (
      qChapterNorm.includes('hoat dong') &&
      qChapterNorm.includes('trai nghiem') &&
      (group.volume === 1 ? !qChapterNorm.includes('tap hai') : !qChapterNorm.includes('tap mot'))
    );
  }
  if (group.groupType === 'review') {
    return qChapterNorm.includes('on tap cuoi nam');
  }

  // Đối chiếu theo chữ cái Chủ đề (Tin học Cánh Diều / YCCĐ: Chủ đề A..G)
  const qTopicLetter = extractTopicLetter(qChapterRaw);
  if (group.topicLetter && qTopicLetter) {
    return group.topicLetter === qTopicLetter;
  }

  // Đối chiếu theo số Chương / số Chủ đề (kể cả số La Mã I, II, III... <-> 1, 2, 3...)
  const qChapterNum = extractChapterNumber(qChapterRaw) ?? extractChapterNumberFromCode(q.code);
  if (group.chapterNumber !== null && group.chapterNumber > 0 && qChapterNum !== null) {
    return group.chapterNumber === qChapterNum;
  }

  // Đối chiếu theo tiêu đề chương/chủ đề
  if (group.normalizedTitleBody.length >= 5 && qChapterBodyNorm.length >= 5) {
    if (
      qChapterBodyNorm.includes(group.normalizedTitleBody) ||
      group.normalizedTitleBody.includes(qChapterBodyNorm)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Kiểm tra câu hỏi q có thuộc bài học / đơn vị kiến thức cụ thể hay không.
 */
export function doesQuestionMatchCatalogLesson(
  q: Question,
  lesson: ScopeCatalogLesson,
  parentGroup: ScopeCatalogGroup,
  matchedAnyGroupInCatalog: boolean
): boolean {
  const anyQ = q as unknown as Record<string, unknown>;
  const qLessonId = String(anyQ.lessonId || anyQ.unitId || '').trim();
  if (qLessonId && (qLessonId === lesson.id || lesson.id.endsWith(`::${qLessonId}`))) {
    return true;
  }

  const belongsToParentGroup = doesQuestionMatchCatalogGroup(q, parentGroup);
  // Nếu câu hỏi đã khớp với chương khác trong danh mục, tránh khớp nhầm số bài ở chương này
  if (matchedAnyGroupInCatalog && !belongsToParentGroup) {
    return false;
  }

  const qLessonRaw = String(q.lesson || '').trim();
  const qLessonNorm = normalizeSearchTokens(qLessonRaw);
  const qLessonBodyNorm = normalizeSearchTokens(stripLeadingLessonPrefix(qLessonRaw));
  const qLessonTokens = tokenizeSignificantWords(stripLeadingLessonPrefix(qLessonRaw));
  const qYccdNorm = normalizeSearchTokens(q.yccd || '');

  // Đối chiếu mã bài (Bài 1, Bài 10, Bài 11b...) trong phạm vi cùng chương/chủ đề
  const qLessonCode = extractLessonCode(qLessonRaw, q.code);
  if (belongsToParentGroup && lesson.lessonCode && qLessonCode) {
    if (lesson.lessonCode.toLowerCase() === qLessonCode.toLowerCase()) {
      return true;
    }
  }

  // Đối chiếu ôn tập chương / bài tập cuối chương
  if (
    belongsToParentGroup &&
    (lesson.normalizedLabel.includes('bai tap cuoi chuong') ||
      lesson.normalizedLabel.includes('luyen tap chung'))
  ) {
    if (
      lesson.normalizedLabel.includes('bai tap cuoi chuong') &&
      (qLessonNorm.includes('on tap chuong') || qLessonNorm.includes('cuoi chuong'))
    ) {
      return true;
    }
    if (
      lesson.normalizedLabel.includes('luyen tap chung') &&
      qLessonNorm.includes('luyen tap chung')
    ) {
      return true;
    }
  }

  // Đối chiếu tên bài học / đơn vị kiến thức
  if (hasStrongKeywordMatch(qLessonTokens, lesson.tokens, qLessonBodyNorm, lesson.normalizedTitleBody)) {
    return true;
  }

  // Với danh mục YCCĐ, kiểm tra thêm nội dung YCCĐ của câu hỏi
  if (
    belongsToParentGroup &&
    lesson.itemType === 'unit' &&
    lesson.normalizedTitleBody.length >= 6 &&
    qYccdNorm.includes(lesson.normalizedTitleBody)
  ) {
    return true;
  }

  return false;
}

export interface CatalogMatchIndex {
  groupQuestionIds: Map<string, Set<string>>;
  lessonQuestionIds: Map<string, Set<string>>;
}

/**
 * Lập chỉ mục liên kết câu hỏi đủ điều kiện vào từng chương/chủ đề và bài học trong danh mục.
 */
export function buildCatalogMatchIndex(
  catalog: ExamScopeCatalog,
  eligibleQuestions: Question[]
): CatalogMatchIndex {
  const groupQuestionIds = new Map<string, Set<string>>();
  const lessonQuestionIds = new Map<string, Set<string>>();

  for (const g of catalog.groups) {
    groupQuestionIds.set(g.id, new Set<string>());
    for (const l of g.lessons) {
      lessonQuestionIds.set(l.id, new Set<string>());
    }
  }

  if (!catalog.hasCatalog) {
    return { groupQuestionIds, lessonQuestionIds };
  }

  for (const q of eligibleQuestions) {
    const matchedGroups = catalog.groups.filter(g => doesQuestionMatchCatalogGroup(q, g));
    const matchedAnyGroup = matchedGroups.length > 0;

    for (const g of matchedGroups) {
      groupQuestionIds.get(g.id)?.add(q.id);
    }

    for (const g of catalog.groups) {
      for (const l of g.lessons) {
        if (doesQuestionMatchCatalogLesson(q, l, g, matchedAnyGroup)) {
          lessonQuestionIds.get(l.id)?.add(q.id);
          // Đảm bảo nhóm cha cũng phản ánh các câu đã liên kết vào bài con (nếu câu thiếu nhãn chương)
          if (!matchedAnyGroup) {
            groupQuestionIds.get(g.id)?.add(q.id);
          }
        }
      }
    }
  }

  return { groupQuestionIds, lessonQuestionIds };
}

/**
 * Lọc danh sách câu hỏi theo toàn bộ tiêu chí ngân hàng:
 * Khối lớp, Môn học, Bộ sách (nếu chọn), Trạng thái duyệt, Phạm vi đề, Dạng câu, Mức độ, Từ khóa.
 */
export function filterQuestionsForExamAuthoring(params: {
  questions: Question[];
  grade: Grade;
  subject: SubjectId;
  textbook?: string;
  showTextbookFilter: boolean;
  catalog: ExamScopeCatalog;
  matchIndex: CatalogMatchIndex;
  selectedGroupIds: Set<string>;
  selectedLessonIds: Set<string>;
  questionTypeFilter: 'all' | QuestionType;
  levelFilter: 'all' | CognitiveLevel;
  searchTerm: string;
}): Question[] {
  const {
    questions,
    grade,
    subject,
    textbook = '',
    showTextbookFilter,
    catalog,
    matchIndex,
    selectedGroupIds,
    selectedLessonIds,
    questionTypeFilter,
    levelFilter,
    searchTerm
  } = params;

  const normGrade = normalizeGrade(grade);
  const normTextbook = normalizeTextbookName(textbook);
  const hasScopeFilter =
    catalog.hasCatalog && (selectedGroupIds.size > 0 || selectedLessonIds.size > 0);

  let allowedQuestionIds: Set<string> | null = null;
  if (hasScopeFilter) {
    allowedQuestionIds = new Set<string>();
    selectedGroupIds.forEach(gId => {
      const set = matchIndex.groupQuestionIds.get(gId);
      set?.forEach(qId => allowedQuestionIds!.add(qId));
    });
    selectedLessonIds.forEach(lId => {
      const set = matchIndex.lessonQuestionIds.get(lId);
      set?.forEach(qId => allowedQuestionIds!.add(qId));
    });
  }

  const term = searchTerm.trim().toLowerCase();

  return questions.filter(q => {
    if (!isQuestionApprovedForExam(q)) return false;
    if (normalizeGrade(q.grade) !== normGrade) return false;
    if (!isQuestionInSubject(q, subject)) return false;

    if (showTextbookFilter && normTextbook && normTextbook !== 'all') {
      if (normalizeTextbookName(q.textbook) !== normTextbook) return false;
    }

    if (allowedQuestionIds && !allowedQuestionIds.has(q.id)) {
      return false;
    }

    if (questionTypeFilter !== 'all' && q.type !== questionTypeFilter) return false;
    if (levelFilter !== 'all' && q.level !== levelFilter) return false;

    if (term) {
      const haystack = `${q.code || ''} ${q.stem || ''} ${q.chapter || ''} ${q.lesson || ''} ${q.yccd || ''}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

// =========================================================================
// Cấu hình gợi ý phạm vi theo đợt kiểm tra (chỉ áp dụng khi giáo viên đã lưu)
// =========================================================================

const PERIOD_SCOPE_PRESETS_KEY = 'taydo_exam_period_scope_presets_v1';

export interface ExamPeriodScopePreset {
  groupIds: string[];
  lessonIds: string[];
  updatedAt: string;
}

function buildPresetKey(grade: Grade, subject: SubjectId, textbook: string, period: ExamPeriod): string {
  const tb = normalizeTextbookName(textbook) || 'default';
  return `${normalizeGrade(grade)}::${subject}::${tb}::${period}`;
}

function readAllPeriodScopePresets(): Record<string, ExamPeriodScopePreset> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(PERIOD_SCOPE_PRESETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getPeriodScopePreset(
  grade: Grade,
  subject: SubjectId,
  textbook: string,
  period: ExamPeriod
): ExamPeriodScopePreset | null {
  const all = readAllPeriodScopePresets();
  const key = buildPresetKey(grade, subject, textbook, period);
  const entry = all[key];
  if (!entry || (!Array.isArray(entry.groupIds) && !Array.isArray(entry.lessonIds))) {
    return null;
  }
  return {
    groupIds: Array.isArray(entry.groupIds) ? entry.groupIds : [],
    lessonIds: Array.isArray(entry.lessonIds) ? entry.lessonIds : [],
    updatedAt: entry.updatedAt || ''
  };
}

export function savePeriodScopePreset(
  grade: Grade,
  subject: SubjectId,
  textbook: string,
  period: ExamPeriod,
  groupIds: string[],
  lessonIds: string[]
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const all = readAllPeriodScopePresets();
    const key = buildPresetKey(grade, subject, textbook, period);
    all[key] = {
      groupIds,
      lessonIds,
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(PERIOD_SCOPE_PRESETS_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
}

export function clearPeriodScopePreset(
  grade: Grade,
  subject: SubjectId,
  textbook: string,
  period: ExamPeriod
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const all = readAllPeriodScopePresets();
    const key = buildPresetKey(grade, subject, textbook, period);
    delete all[key];
    window.localStorage.setItem(PERIOD_SCOPE_PRESETS_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
}
