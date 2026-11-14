import { ClassRoom } from '../../types';

export interface StudentCandidate {
  id: string;
  code: string;
  fullName: string;
  gender?: 'Nam' | 'Nữ';
  isAbsent?: boolean;
}

export type CallGameMode =
  | 'wheel'           // 1. Vòng quay may mắn
  | 'gift_box'        // 2. Hộp quà bí mật
  | 'cards'           // 3. Thẻ bài lật mở
  | 'flying_envelope' // 4. Bức thư bồ câu
  | 'magic_sphere'    // 5. Quả cầu bốc thăm
  | 'rocket'          // 6. Tên lửa không gian
  | 'call_pair'       // 7. Cặp đôi đối kháng (2 bạn)
  | 'call_trio'       // 8. Nhóm ba bạn (3 bạn)
  | 'speed_timer'     // 9. Chiếc nón tốc độ (Kèm đếm ngược)
  | 'star_of_hope';   // 10. Ngôi sao hi vọng (x2 điểm / trợ giúp)

export interface CallGameMeta {
  id: CallGameMode;
  title: string;
  shortDesc: string;
  actionLabel: string;
  playingLabel: string;
  iconName: string;
  badge: string;
  pickCount: number;
}

export const CALL_GAME_MODES: CallGameMeta[] = [
  {
    id: 'wheel',
    title: 'Vòng quay may mắn',
    shortDesc: 'Vòng quay nhiều màu viền vàng, kim chỉ dừng đúng tên học sinh',
    actionLabel: 'Quay ngay',
    playingLabel: 'Đang quay...',
    iconName: 'Disc',
    badge: '1 bạn',
    pickCount: 1,
  },
  {
    id: 'gift_box',
    title: 'Hộp quà bí mật',
    shortDesc: 'Mở hộp quà bí ẩn để khám phá học sinh được trao nhiệm vụ',
    actionLabel: 'Mở hộp quà',
    playingLabel: 'Đang mở quà...',
    iconName: 'Gift',
    badge: '1 bạn',
    pickCount: 1,
  },
  {
    id: 'cards',
    title: 'Thẻ bài lật mở',
    shortDesc: 'Bộ thẻ bài úp ngược lật mở ngẫu nhiên tên học sinh',
    actionLabel: 'Xáo & lật thẻ',
    playingLabel: 'Đang lật thẻ...',
    iconName: 'Layers',
    badge: '1 bạn',
    pickCount: 1,
  },
  {
    id: 'flying_envelope',
    title: 'Bức thư bồ câu',
    shortDesc: 'Bồ câu đưa thư niêm phong mở ra tên học sinh may mắn',
    actionLabel: 'Mở bức thư',
    playingLabel: 'Đang mở thư...',
    iconName: 'Mail',
    badge: '1 bạn',
    pickCount: 1,
  },
  {
    id: 'rocket',
    title: 'Tên lửa không gian',
    shortDesc: 'Đếm ngược 3-2-1 phóng tên lửa đưa học sinh lên bảng',
    actionLabel: 'Phóng tên lửa',
    playingLabel: 'Đang phóng...',
    iconName: 'Rocket',
    badge: '1 bạn',
    pickCount: 1,
  },
  {
    id: 'magic_sphere',
    title: 'Lồng cầu bốc thăm',
    shortDesc: 'Lồng quay xáo trộn quả cầu may mắn chọn tên học sinh',
    actionLabel: 'Quay lồng cầu',
    playingLabel: 'Đang bốc thăm...',
    iconName: 'CircleDot',
    badge: '1 bạn',
    pickCount: 1,
  },
  {
    id: 'call_pair',
    title: 'Cặp đôi đối đầu',
    shortDesc: 'Gọi ngẫu nhiên 2 học sinh cùng lúc để vấn đáp hoặc thi đua',
    actionLabel: 'Gọi cặp đôi',
    playingLabel: 'Đang chọn cặp...',
    iconName: 'Users',
    badge: '2 bạn',
    pickCount: 2,
  },
  {
    id: 'call_trio',
    title: 'Nhóm ba bạn',
    shortDesc: 'Gọi ngẫu nhiên 3 học sinh cùng lúc cho hoạt động nhóm',
    actionLabel: 'Gọi nhóm ba',
    playingLabel: 'Đang lập nhóm...',
    iconName: 'UserPlus',
    badge: '3 bạn',
    pickCount: 3,
  },
  {
    id: 'speed_timer',
    title: 'Chiếc nón tốc độ',
    shortDesc: 'Chọn học sinh và tự động bật đồng hồ đếm ngược 30 giây',
    actionLabel: 'Quay tốc độ (30s)',
    playingLabel: 'Đang chọn...',
    iconName: 'Timer',
    badge: '30 giây',
    pickCount: 1,
  },
  {
    id: 'star_of_hope',
    title: 'Ngôi sao hi vọng',
    shortDesc: 'Trao Ngôi sao hi vọng nhân đôi điểm hoặc quyền trợ giúp',
    actionLabel: 'Trao ngôi sao',
    playingLabel: 'Đang trao sao...',
    iconName: 'Sparkles',
    badge: 'x2 điểm',
    pickCount: 1,
  },
];

export interface CallHistoryItem {
  id: string;
  timestamp: number;
  classId: string;
  className: string;
  mode: CallGameMode;
  modeName: string;
  selectedStudents: StudentCandidate[];
  scoreNote?: string;
}

const STORAGE_PREFIX = 'taydo_call_game';

export function getStorageKey(teacherId: string, subKey: string): string {
  const safeId = teacherId || 'default_teacher';
  return `${STORAGE_PREFIX}_${safeId}_${subKey}`;
}

export function loadCallHistory(teacherId: string, classKey: string): CallHistoryItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(teacherId, `history_${classKey}`));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCallHistory(teacherId: string, classKey: string, items: CallHistoryItem[]): void {
  try {
    localStorage.setItem(getStorageKey(teacherId, `history_${classKey}`), JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save call history:', err);
  }
}

export function clearCallHistory(teacherId: string, classKey: string): void {
  try {
    localStorage.removeItem(getStorageKey(teacherId, `history_${classKey}`));
  } catch {}
}

export function loadAbsentIds(teacherId: string, classKey: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(teacherId, `absent_${classKey}`));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveAbsentIds(teacherId: string, classKey: string, ids: string[]): void {
  try {
    localStorage.setItem(getStorageKey(teacherId, `absent_${classKey}`), JSON.stringify(ids));
  } catch {}
}

export function loadCalledSessionIds(teacherId: string, classKey: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(teacherId, `session_called_${classKey}`));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCalledSessionIds(teacherId: string, classKey: string, ids: string[]): void {
  try {
    localStorage.setItem(getStorageKey(teacherId, `session_called_${classKey}`), JSON.stringify(ids));
  } catch {}
}

export function loadCustomManualStudents(teacherId: string): StudentCandidate[] {
  try {
    const raw = localStorage.getItem(getStorageKey(teacherId, 'manual_students'));
    if (!raw) {
      return [
        { id: 'm1', code: 'HT01', fullName: 'Nguyễn Văn An', gender: 'Nam' },
        { id: 'm2', code: 'HT02', fullName: 'Trần Thị Bình', gender: 'Nữ' },
        { id: 'm3', code: 'HT03', fullName: 'Lê Minh Châu', gender: 'Nam' },
        { id: 'm4', code: 'HT04', fullName: 'Phạm Thị Dung', gender: 'Nữ' },
        { id: 'm5', code: 'HT05', fullName: 'Vũ Đức Hùng', gender: 'Nam' },
        { id: 'm6', code: 'HT06', fullName: 'Đỗ Quỳnh Mai', gender: 'Nữ' },
        { id: 'm7', code: 'HT07', fullName: 'Bùi Gia Phúc', gender: 'Nam' },
        { id: 'm8', code: 'HT08', fullName: 'Ngô Thu Thảo', gender: 'Nữ' },
      ];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomManualStudents(teacherId: string, students: StudentCandidate[]): void {
  try {
    localStorage.setItem(getStorageKey(teacherId, 'manual_students'), JSON.stringify(students));
  } catch {}
}

/**
 * Lọc danh sách học sinh khả dụng cho lượt gọi
 */
export function getAvailableStudents(
  allStudents: StudentCandidate[],
  absentIds: Set<string>,
  calledSessionIds: Set<string>,
  antiDuplicate: boolean
): StudentCandidate[] {
  // 1. Loại bỏ học sinh vắng mặt
  const presentStudents = allStudents.filter(s => !absentIds.has(s.id));

  // 2. Nếu không bật chống trùng, tất cả học sinh có mặt đều khả dụng
  if (!antiDuplicate) {
    return presentStudents;
  }

  // 3. Nếu bật chống trùng, lọc bỏ những bạn đã được gọi trong phiên
  const uncalled = presentStudents.filter(s => !calledSessionIds.has(s.id));

  return uncalled;
}

/**
 * Chọn ngẫu nhiên N học sinh không trùng lặp từ tập hợp khả dụng
 */
export function pickRandomStudents(
  pool: StudentCandidate[],
  count: number
): StudentCandidate[] {
  if (pool.length === 0 || count <= 0) return [];
  const copy = [...pool];
  const picked: StudentCandidate[] = [];
  const targetCount = Math.min(count, copy.length);

  for (let i = 0; i < targetCount; i++) {
    const randomIndex = Math.floor(Math.random() * copy.length);
    picked.push(copy[randomIndex]);
    copy.splice(randomIndex, 1);
  }

  return picked;
}

/**
 * Chuyển đổi học sinh từ ClassRoom của AppContext sang StudentCandidate
 */
export function mapClassStudentsToCandidates(classRoom: ClassRoom): StudentCandidate[] {
  if (!classRoom || !classRoom.students) return [];
  return classRoom.students.map(s => ({
    id: s.id,
    code: s.code,
    fullName: s.fullName,
    gender: s.gender,
  }));
}

/**
 * Tính góc xoay mục tiêu (độ) sao cho lát cắt của winnerIndex dừng chính xác
 * dưới kim chỉ cố định ở đỉnh 12 giờ (góc 270 độ trong hệ tọa độ Canvas).
 */
export function computeWheelTargetRotation(
  currentRotationDeg: number,
  winnerIndex: number,
  totalSlices: number,
  spins = 6,
  jitterFactor = 0.45
): number {
  const safeTotal = Math.max(totalSlices, 1);
  const safeIndex = ((winnerIndex % safeTotal) + safeTotal) % safeTotal;
  const sliceDeg = 360 / safeTotal;
  const centerDeg = (safeIndex + 0.5) * sliceDeg;
  const clampedJitter = Math.min(Math.max(jitterFactor, 0), 0.6);
  const safeOffset = (Math.random() - 0.5) * sliceDeg * clampedJitter;
  const desiredMod = (((270 - (centerDeg + safeOffset)) % 360) + 360) % 360;
  const currentMod = ((currentRotationDeg % 360) + 360) % 360;
  const deltaMod = (((desiredMod - currentMod) % 360) + 360) % 360;
  return currentRotationDeg + spins * 360 + deltaMod;
}

/**
 * Xác định chỉ số lát cắt đang nằm dưới kim chỉ tại đỉnh 12 giờ (270 độ)
 */
export function getWheelSliceIndexAtPointer(
  rotationDeg: number,
  totalSlices: number
): number {
  const safeTotal = Math.max(totalSlices, 1);
  const sliceDeg = 360 / safeTotal;
  const localDeg = (((270 - rotationDeg) % 360) + 360) % 360;
  return Math.floor(localDeg / sliceDeg) % safeTotal;
}

/**
 * Phân tích văn bản danh sách học sinh nhập tay (hỗ trợ "Mã - Họ tên" hoặc chỉ "Họ tên")
 */
export function parseManualStudentsText(rawText: string): StudentCandidate[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const tabParts = line.split('\t').map(p => p.trim()).filter(Boolean);
    const sepParts = tabParts.length >= 2 ? tabParts : line.split(/[-–—:]/).map(p => p.trim());
    let code = `HS${String(index + 1).padStart(2, '0')}`;
    let fullName = line;

    if (sepParts.length >= 2 && sepParts[0].length <= 16) {
      code = sepParts[0];
      fullName = sepParts.slice(1).join(' ');
    }

    return {
      id: `manual-${index + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      fullName: fullName || line,
      gender: index % 2 === 0 ? 'Nam' : 'Nữ',
    };
  });
}

