import rawCatalogData from './catalog_kien_thuc_trong_tam.json';
import { CoreKnowledgeLesson, CoreKnowledgeGroup, CoreKnowledgeStatus } from '../types/coreKnowledge';

/**
 * Danh mục tập trung KIẾN THỨC TRỌNG TÂM
 * Nguồn dữ liệu duy nhất: catalog_kien_thuc_trong_tam.json (458 mục chuẩn hoá)
 * Bao gồm:
 * - Toán 6 (Tập 1 & 2), Toán 7 (Tập 1 & 2), Toán 9 (Tập 1 & 2)
 * - Tin học 6, Tin học 7, Tin học 9 (gồm cả 2 nhánh a/b)
 * - Khoa học tự nhiên 6, 7, 8, 9 (gồm nhóm Mở đầu đứng trước Chương I)
 *
 * Quy tắc:
 * - Không sửa tên bài, không tự bịa thêm lớp/môn/chương/bài.
 * - Chỉ đánh dấu 'ready' khi file HTML thực sự có sẵn trong public/lessons/.
 * - Hiện tại có 2 bài học thực tế sẵn sàng:
 *   1. /lessons/lop-6/toan/chuong-01/bai-01/index.html (toan_6_c1_b1)
 *   2. /lessons/lop-6/toan/chuong-06/bai-23/index.html (toan_6_c6_b23)
 * - Tất cả các bài còn lại giữ nguyên trạng thái 'pending_upload' (Đang cập nhật).
 */

const RAW_LIST = rawCatalogData as Array<Omit<CoreKnowledgeLesson, 'status'> & { status?: string }>;

export const CORE_KNOWLEDGE_LESSONS: CoreKnowledgeLesson[] = RAW_LIST.map(item => {
  // Chỉ các bài có file HTML thực tế được đánh dấu ready
  const isReady = item.id === 'toan_6_c1_b1' || item.id === 'toan_6_c6_b23';
  const status: CoreKnowledgeStatus = isReady ? 'ready' : 'pending_upload';

  return {
    ...item,
    status
  };
});

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
