import rawCatalogData from './catalog_kien_thuc_trong_tam.json';
import availableLessonPaths from './availableLessonPaths.json';
import { CoreKnowledgeLesson, CoreKnowledgeGroup, CoreKnowledgeStatus } from '../types/coreKnowledge';

/**
 * Danh mục tập trung KIẾN THỨC TRỌNG TÂM
 * Nguồn dữ liệu: catalog_kien_thuc_trong_tam.json (458 mục chuẩn hoá)
 * Tích hợp Toán 6 (Tập 1 & 2), Toán 7 (Tập 1 & 2), Toán 9 (Tập 1 & 2), Tin học 6, 7, 9, KHTN 6, 7, 8, 9
 *
 * Quy tắc:
 * - Chỉ đánh dấu 'ready' khi file HTML thực sự có sẵn và kiểm tra được trong public/lessons/.
 * - Tự động đồng bộ với danh sách availableLessonPaths.json.
 */

const RAW_LIST = rawCatalogData as Array<Omit<CoreKnowledgeLesson, 'status'> & { status?: string }>;
const availableSet = new Set(availableLessonPaths as string[]);

export const CORE_KNOWLEDGE_LESSONS: CoreKnowledgeLesson[] = RAW_LIST.map(item => {
  // Chỉ các bài có file HTML thực tế được đánh dấu ready
  const isReady = availableSet.has(item.htmlUrl);
  const status: CoreKnowledgeStatus = isReady ? 'ready' : 'pending_upload';

  return {
    ...item,
    status
  };
});

/** Tập hợp 38 ID thuộc gói học liệu Toán 6 Tập 1 */
export const TOAN6_TAP1_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 6 && l.subjectCode === 'Toan' && l.volume === 1).map(l => l.id)
);

/** Tập hợp 36 ID thuộc gói học liệu Toán 6 Tập 2 */
export const TOAN6_TAP2_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 6 && l.subjectCode === 'Toan' && l.volume === 2).map(l => l.id)
);

/** Toàn bộ 74 ID Toán 6 (Tập 1 & Tập 2) có hỗ trợ cầu nối lịch sử Supabase */
export const TOAN6_ALL_IDS = new Set<string>([
  ...Array.from(TOAN6_TAP1_IDS),
  ...Array.from(TOAN6_TAP2_IDS)
]);

/** Tập hợp 35 ID thuộc gói học liệu Toán 7 Tập 1 */
export const TOAN7_TAP1_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 7 && l.subjectCode === 'Toan' && l.volume === 1).map(l => l.id)
);

/** Tập hợp 36 ID thuộc gói học liệu Toán 7 Tập 2 */
export const TOAN7_TAP2_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 7 && l.subjectCode === 'Toan' && l.volume === 2).map(l => l.id)
);

/** Toàn bộ 71 ID Toán 7 (Tập 1 & Tập 2) có hỗ trợ cầu nối lịch sử Supabase */
export const TOAN7_ALL_IDS = new Set<string>([
  ...Array.from(TOAN7_TAP1_IDS),
  ...Array.from(TOAN7_TAP2_IDS)
]);

/** Toàn bộ 145 ID Toán 6 (Tập 1, 2) và Toán 7 (Tập 1, 2) có hỗ trợ cầu nối lịch sử Supabase */
export const SUPPORTED_BRIDGE_LESSON_IDS = new Set<string>([
  ...Array.from(TOAN6_ALL_IDS),
  ...Array.from(TOAN7_ALL_IDS)
]);

/** Khối lớp hỗ trợ theo dữ liệu: 6, 7, 8, 9 */
export const AVAILABLE_GRADES: number[] = [6, 7, 8, 9];

/** Lấy danh sách môn học theo khối lớp (Toán, Tin học) */
export function getSubjectsByGrade(grade: number): Array<{ code: string; name: string }> {
  const map = new Map<string, string>();
  CORE_KNOWLEDGE_LESSONS
    .filter(l => l.grade === grade)
    .forEach(l => {
      if (!map.has(l.subjectCode)) {
        map.set(l.subjectCode, l.subjectName);
      }
    });

  return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
}

/**
 * Lấy danh sách nhóm (Chương/Chủ đề/Hoạt động trải nghiệm/Ôn tập) theo khối và môn.
 * Quy tắc: Giữ nguyên thứ tự xuất hiện trong JSON (đã sắp đúng theo volume 1 -> volume 2 và thứ tự SGK).
 */
export function getGroupsByGradeAndSubject(
  grade: number,
  subjectCode: string
): CoreKnowledgeGroup[] {
  const seenKeys = new Set<string>();
  const groups: CoreKnowledgeGroup[] = [];

  CORE_KNOWLEDGE_LESSONS
    .filter(l => l.grade === grade && l.subjectCode === subjectCode)
    .forEach(l => {
      // Dùng chapterLabel hoặc kết hợp volume + chapterLabel để làm khóa nhóm duy nhất
      const groupKey = `${l.volume}_${l.chapterLabel}`;
      if (!seenKeys.has(groupKey)) {
        seenKeys.add(groupKey);
        groups.push({
          groupKey,
          volume: l.volume,
          groupType: l.groupType,
          chapterNumber: l.chapterNumber,
          chapterTitle: l.chapterTitle,
          chapterLabel: l.chapterLabel
        });
      }
    });

  return groups;
}

/**
 * Lấy danh sách bài học thuộc một nhóm cụ thể.
 * Quy tắc:
 * - Sắp xếp nghiêm ngặt theo `sortOrder` dạng số (KHÔNG sắp chữ cái hoặc theo chuỗi).
 */
export function getLessonsByGroup(
  grade: number,
  subjectCode: string,
  groupKey: string
): CoreKnowledgeLesson[] {
  return CORE_KNOWLEDGE_LESSONS
    .filter(
      l =>
        l.grade === grade &&
        l.subjectCode === subjectCode &&
        `${l.volume}_${l.chapterLabel}` === groupKey
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Tìm bài học theo ID duy nhất */
export function getCoreKnowledgeLessonById(id: string): CoreKnowledgeLesson | undefined {
  return CORE_KNOWLEDGE_LESSONS.find(l => l.id === id);
}
