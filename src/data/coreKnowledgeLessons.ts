import rawCatalogData from './catalog_kien_thuc_trong_tam.json';
import availableLessonPaths from './availableLessonPaths.json';
import { CoreKnowledgeLesson, CoreKnowledgeGroup, CoreKnowledgeStatus } from '../types/coreKnowledge';

/**
 * Danh mục tập trung KIẾN THỨC TRỌNG TÂM
 * Nguồn dữ liệu: catalog_kien_thuc_trong_tam.json (553 mục chuẩn hoá)
 * Tích hợp Toán 6–9 (Tập 1 & 2), Tin học 6–9, KHTN 6–9
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

/** Tập hợp 38 ID thuộc gói học liệu Toán 8 Tập 1 */
export const TOAN8_TAP1_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 8 && l.subjectCode === 'Toan' && l.volume === 1).map(l => l.id)
);

/** Tập hợp 37 ID thuộc gói học liệu Toán 8 Tập 2 */
export const TOAN8_TAP2_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 8 && l.subjectCode === 'Toan' && l.volume === 2).map(l => l.id)
);

/** Toàn bộ 75 ID Toán 8 (Tập 1 & Tập 2) có hỗ trợ cầu nối lịch sử Supabase */
export const TOAN8_ALL_IDS = new Set<string>([
  ...Array.from(TOAN8_TAP1_IDS),
  ...Array.from(TOAN8_TAP2_IDS)
]);

/** Tập hợp 31 ID thuộc gói học liệu Toán 9 Tập 1 */
export const TOAN9_TAP1_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 9 && l.subjectCode === 'Toan' && l.volume === 1).map(l => l.id)
);

/** Tập hợp 32 ID thuộc gói học liệu Toán 9 Tập 2 */
export const TOAN9_TAP2_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 9 && l.subjectCode === 'Toan' && l.volume === 2).map(l => l.id)
);

/** Toàn bộ 63 ID Toán 9 (Tập 1 & Tập 2) có hỗ trợ cầu nối lịch sử Supabase */
export const TOAN9_ALL_IDS = new Set<string>([
  ...Array.from(TOAN9_TAP1_IDS),
  ...Array.from(TOAN9_TAP2_IDS)
]);

/** Tập hợp 17 ID thuộc gói học liệu Tin học 6 */
export const TIN6_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 6 && l.subjectCode === 'Tin').map(l => l.id)
);

/** Tập hợp 16 ID thuộc gói học liệu Tin học 7 */
export const TIN7_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 7 && l.subjectCode === 'Tin').map(l => l.id)
);

/** Tập hợp 20 ID thuộc gói học liệu Tin học 8 */
export const TIN8_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 8 && l.subjectCode === 'Tin').map(l => l.id)
);

/** Tập hợp 22 ID thuộc gói học liệu Tin học 9 */
export const TIN9_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 9 && l.subjectCode === 'Tin').map(l => l.id)
);

/** Toàn bộ 75 ID Tin học (Khối 6, 7, 8, 9) có hỗ trợ cầu nối lịch sử Supabase */
export const TIN_ALL_IDS = new Set<string>([
  ...Array.from(TIN6_IDS),
  ...Array.from(TIN7_IDS),
  ...Array.from(TIN8_IDS),
  ...Array.from(TIN9_IDS)
]);

/** Tập hợp 55 ID thuộc gói học liệu Khoa học tự nhiên 6 */
export const KHTN6_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 6 && l.subjectCode === 'KHTN').map(l => l.id)
);

/** Tập hợp 42 ID thuộc gói học liệu Khoa học tự nhiên 7 */
export const KHTN7_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 7 && l.subjectCode === 'KHTN').map(l => l.id)
);

/** Tập hợp 47 ID thuộc gói học liệu Khoa học tự nhiên 8 */
export const KHTN8_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 8 && l.subjectCode === 'KHTN').map(l => l.id)
);

/** Tập hợp 51 ID thuộc gói học liệu Khoa học tự nhiên 9 */
export const KHTN9_IDS = new Set<string>(
  RAW_LIST.filter(l => l.grade === 9 && l.subjectCode === 'KHTN').map(l => l.id)
);

/** Toàn bộ 195 ID Khoa học tự nhiên (Khối 6, 7, 8, 9) có hỗ trợ cầu nối lịch sử Supabase */
export const KHTN_ALL_IDS = new Set<string>([
  ...Array.from(KHTN6_IDS),
  ...Array.from(KHTN7_IDS),
  ...Array.from(KHTN8_IDS),
  ...Array.from(KHTN9_IDS)
]);

/** Toàn bộ các ID Toán 6–9 (283 mục), Tin học 6–9 (75 mục) và Khoa học tự nhiên 6–9 (195 mục) có hỗ trợ cầu nối lịch sử Supabase (553 mục) */
export const SUPPORTED_BRIDGE_LESSON_IDS = new Set<string>([
  ...Array.from(TOAN6_ALL_IDS),
  ...Array.from(TOAN7_ALL_IDS),
  ...Array.from(TOAN8_ALL_IDS),
  ...Array.from(TOAN9_ALL_IDS),
  ...Array.from(TIN_ALL_IDS),
  ...Array.from(KHTN_ALL_IDS)
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

/** Lấy danh sách tập sách (volume) theo khối lớp và môn học, sắp xếp tăng dần */
export function getVolumesByGradeAndSubject(grade: number, subjectCode: string): number[] {
  const vols = new Set<number>();
  CORE_KNOWLEDGE_LESSONS
    .filter(l => l.grade === grade && l.subjectCode === subjectCode)
    .forEach(l => {
      vols.add(l.volume || 1);
    });
  return Array.from(vols).sort((a, b) => a - b);
}

const GROUP_TYPE_ORDER: Record<string, number> = {
  intro: 0,
  chapter: 1,
  topic: 1,
  activity: 2,
  review: 3
};

/**
 * Lấy danh sách nhóm (Chương/Chủ đề/Hoạt động trải nghiệm/Ôn tập) theo khối, môn và tập sách (nếu chọn).
 * Quy tắc: Sắp theo volume -> loại nhóm (Mở đầu -> Chương/Chủ đề -> Hoạt động trải nghiệm -> Ôn tập cuối năm) -> số chương -> thứ tự xuất hiện.
 */
export function getGroupsByGradeAndSubject(
  grade: number,
  subjectCode: string,
  volume?: number
): CoreKnowledgeGroup[] {
  const seenKeys = new Set<string>();
  const groups: CoreKnowledgeGroup[] = [];

  CORE_KNOWLEDGE_LESSONS
    .filter(
      l =>
        l.grade === grade &&
        l.subjectCode === subjectCode &&
        (volume === undefined || l.volume === volume)
    )
    .forEach(l => {
      // Dùng kết hợp volume + chapterLabel để làm khóa nhóm duy nhất
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

  return groups.sort((a, b) => {
    if (a.volume !== b.volume) return a.volume - b.volume;
    const rankA = GROUP_TYPE_ORDER[a.groupType] ?? 9;
    const rankB = GROUP_TYPE_ORDER[b.groupType] ?? 9;
    if (rankA !== rankB) return rankA - rankB;
    return (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0);
  });
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
