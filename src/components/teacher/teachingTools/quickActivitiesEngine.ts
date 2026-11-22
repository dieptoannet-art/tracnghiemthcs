import { ToolStudentItem } from './teachingToolsEngine';

export interface PairGroupResult {
  id: string;
  label: string;
  members: ToolStudentItem[];
  isTrio: boolean;
}

export type OddStudentHandling = 'form_one_trio' | 'one_solo_task';

export interface PairActivityOutcome {
  mode: 'empty' | 'single_individual' | 'paired';
  pairs: PairGroupResult[];
  soloStudent: ToolStudentItem | null;
  soloTaskPrompt: string;
  message: string;
}

export interface ChallengeDrawItem {
  id: string;
  text: string;
}

export interface ChallengeDrawHistoryEntry {
  drawId: string;
  challengeId: string;
  challengeText: string;
  drawnAtIso: string;
}

export interface QuickActivitySessionState {
  oddHandling: OddStudentHandling;
  soloTaskPrompt: string;
  latestPairs: PairActivityOutcome | null;
  challenges: ChallengeDrawItem[];
  noRepeatInSession: boolean;
  drawnChallengeIds: string[];
  drawHistory: ChallengeDrawHistoryEntry[];
  currentChallenge: ChallengeDrawItem | null;
}

export const DEFAULT_CHALLENGES: ChallengeDrawItem[] = [
  { id: 'ch_1', text: 'Giải thích một khái niệm vừa học bằng ví dụ thực tế trong 45 giây.' },
  { id: 'ch_2', text: 'Đặt 1 câu hỏi "Vì sao?" về nội dung bài học cho nhóm đối diện trả lời.' },
  { id: 'ch_3', text: 'Tóm tắt 3 từ khóa quan trọng nhất của bài bằng sơ đồ ngắn trên bảng.' },
  { id: 'ch_4', text: 'Nêu một lỗi sai thường gặp khi giải dạng toán hôm nay và cách tránh.' },
  { id: 'ch_5', text: 'Trình bày lại bước giải bài tập vừa làm mà không nhìn vở.' },
  { id: 'ch_6', text: 'Đổi vai làm "giáo viên nhí": hướng dẫn bạn bên cạnh cách kiểm tra đáp án.' },
];

function seededOrder<T>(items: T[], seed: string): T[] {
  const copy = items.slice();
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 98765;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function createDefaultQuickActivityState(): QuickActivitySessionState {
  return {
    oddHandling: 'form_one_trio',
    soloTaskPrompt: 'Nhiệm vụ cá nhân: Quan sát, ghi nhận ý hay nhất của 2 cặp và tổng kết sau 3 phút.',
    latestPairs: null,
    challenges: DEFAULT_CHALLENGES.map((c) => ({ ...c })),
    noRepeatInSession: true,
    drawnChallengeIds: [],
    drawHistory: [],
    currentChallenge: null,
  };
}

/**
 * Generates random pairs from present students.
 * - 0 students => empty
 * - 1 student => single individual task mode
 * - Odd >= 3 => honors `oddHandling` ('form_one_trio' or 'one_solo_task')
 */
export function generateStudentPairs(params: {
  presentStudents: ToolStudentItem[];
  oddHandling: OddStudentHandling;
  soloTaskPrompt?: string;
  seed?: string;
}): PairActivityOutcome {
  const {
    presentStudents,
    oddHandling,
    soloTaskPrompt = 'Nhiệm vụ cá nhân: Tổng hợp điểm chính của hoạt động hoặc hỗ trợ kiểm tra chéo.',
    seed,
  } = params;

  // Deduplicate strictly by stable student.id
  const uniqueMap = new Map<string, ToolStudentItem>();
  for (const s of presentStudents) {
    if (!uniqueMap.has(s.id)) uniqueMap.set(s.id, s);
  }
  const pool = Array.from(uniqueMap.values());

  if (pool.length === 0) {
    return {
      mode: 'empty',
      pairs: [],
      soloStudent: null,
      soloTaskPrompt,
      message: 'Chưa có học sinh có mặt trong lớp để ghép cặp.',
    };
  }

  if (pool.length === 1) {
    return {
      mode: 'single_individual',
      pairs: [],
      soloStudent: pool[0],
      soloTaskPrompt,
      message: `Lớp hiện có 1 học sinh (${pool[0].fullName}) — tự động chuyển sang nhiệm vụ cá nhân.`,
    };
  }

  const ordered =
    seed !== undefined
      ? seededOrder(pool, seed)
      : pool.slice().sort(() => Math.random() - 0.5);

  const isOdd = ordered.length % 2 === 1;
  const pairs: PairGroupResult[] = [];
  let soloStudent: ToolStudentItem | null = null;

  if (isOdd && oddHandling === 'form_one_trio') {
    // Pair all except last 3, then form 1 trio
    const limit = ordered.length - 3;
    for (let i = 0; i < limit; i += 2) {
      pairs.push({
        id: `pair_${pairs.length + 1}`,
        label: `Cặp ${pairs.length + 1}`,
        members: [ordered[i], ordered[i + 1]],
        isTrio: false,
      });
    }
    pairs.push({
      id: `pair_${pairs.length + 1}`,
      label: `Nhóm ba ${pairs.length + 1}`,
      members: [ordered[limit], ordered[limit + 1], ordered[limit + 2]],
      isTrio: true,
    });
    return {
      mode: 'paired',
      pairs,
      soloStudent: null,
      soloTaskPrompt,
      message: `Đã chia ${ordered.length} học sinh thành ${pairs.length - 1} cặp đôi và 1 nhóm ba.`,
    };
  }

  const pairCountLimit = isOdd ? ordered.length - 1 : ordered.length;
  for (let i = 0; i < pairCountLimit; i += 2) {
    pairs.push({
      id: `pair_${pairs.length + 1}`,
      label: `Cặp ${pairs.length + 1}`,
      members: [ordered[i], ordered[i + 1]],
      isTrio: false,
    });
  }
  if (isOdd) {
    soloStudent = ordered[ordered.length - 1];
  }

  return {
    mode: 'paired',
    pairs,
    soloStudent,
    soloTaskPrompt,
    message: isOdd
      ? `Đã ghép ${pairs.length} cặp và giao nhiệm vụ cá nhân cho ${soloStudent?.fullName}.`
      : `Đã ghép đều ${ordered.length} học sinh thành ${pairs.length} cặp đôi.`,
  };
}

export function drawRandomChallenge(
  state: QuickActivitySessionState,
  seed?: string
): {
  ok: boolean;
  error?: string;
  nextState: QuickActivitySessionState;
} {
  if (state.challenges.length === 0) {
    return {
      ok: false,
      error: 'Danh sách thử thách đang trống. Hãy thêm ít nhất 1 thử thách trước khi bốc.',
      nextState: state,
    };
  }

  const drawnSet = new Set(state.drawnChallengeIds);
  const candidates = state.noRepeatInSession
    ? state.challenges.filter((c) => !drawnSet.has(c.id))
    : state.challenges;

  if (candidates.length === 0) {
    return {
      ok: false,
      error: 'Đã bốc hết toàn bộ thử thách trong phiên (đang bật tránh lặp). Nhấn "Đặt lại lượt bốc" để chơi vòng mới.',
      nextState: state,
    };
  }

  const picked =
    seed !== undefined
      ? seededOrder(candidates, seed)[0]
      : candidates[Math.floor(Math.random() * candidates.length)];

  const entry: ChallengeDrawHistoryEntry = {
    drawId: `draw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    challengeId: picked.id,
    challengeText: picked.text,
    drawnAtIso: new Date().toISOString(),
  };

  return {
    ok: true,
    nextState: {
      ...state,
      currentChallenge: picked,
      drawnChallengeIds: state.noRepeatInSession
        ? [...state.drawnChallengeIds, picked.id]
        : state.drawnChallengeIds,
      drawHistory: [entry, ...state.drawHistory].slice(0, 100),
    },
  };
}
