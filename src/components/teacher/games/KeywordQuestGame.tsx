import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Clock,
  Lightbulb,
  BookOpen,
  Award,
  Sparkles,
  HelpCircle,
  Eye,
  ArrowRight,
  RefreshCw,
  ZoomIn,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Search,
  KeyRound,
  Grid,
  Compass,
  ShieldCheck,
  SkipForward,
  Check,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question } from '../../../types';
import { MathView } from '../../MathView';
import { SpaceRocketVoiceManager } from './SpaceRocketVoiceManager';

// ============================================================================
// TYPES & STATE MACHINE FOR B09: TÌM TỪ KHÓA 3D ("TRẠM GIẢI MÃ TRI THỨC")
// ============================================================================

export type B09PlayMode = 'DECODE_KEYWORD' | 'WORD_GRID_HUNT';
export type B09OrgMode = 'CLASS' | 'INDIVIDUAL' | 'TEAMS';
export type B09DatasetKey = 'SAMPLE_MATH' | 'SAMPLE_INFORMATICS' | 'QUESTION_BANK' | 'CUSTOM';

export type B09StagePhase =
  | 'SETUP'
  | 'READY'
  | 'PLAYING'
  | 'EVALUATING'
  | 'FEEDBACK'
  | 'NEXT_TURN'
  | 'PAUSED'
  | 'FINISHED';

export interface KeywordItemDefinition {
  id: string;
  displayAnswer: string;
  acceptedAnswers: string[];
  clue: string;
  hints: [string, string]; // 2 text hints; 3rd hint opens an unrevealed character tile
  explanation: string;
  searchToken: string; // Uppercase ASCII without spaces for Word Grid
  topicTag?: string;
  isSample?: boolean;
}

export interface GridCoord {
  row: number;
  col: number;
}

export type GridDirectionKey = 'E' | 'S' | 'W' | 'N' | 'SE' | 'NE' | 'SW' | 'NW';

export interface PlacedGridWord {
  wordId: string;
  searchToken: string;
  displayAnswer: string;
  clue: string;
  explanation: string;
  primaryCoords: GridCoord[];
  validOccurrences: GridCoord[][]; // All valid straight-line occurrences found in post-fill scan
}

export interface GeneratedWordGrid {
  size: number;
  cells: string[][]; // Uppercase ASCII single characters
  placedWords: PlacedGridWord[];
  skippedWords: string[];
}

export interface B09TeamItem {
  id: string;
  name: string;
  colorHex: string;
  score: number;
  solvedCount: number;
  attempts: number;
}

export interface B09TurnLog {
  turnId: string;
  timestamp: string;
  mode: B09PlayMode;
  actorLabel: string;
  keywordDisplay: string;
  submittedText: string;
  isCorrect: boolean;
  pointsAwarded: number;
  hintsUsed: number;
}

export interface KeywordQuestGameProps {
  availableCandidates: StudentCandidate[];
  allCandidates?: StudentCandidate[];
  absentIds?: Set<string>;
  classes?: ClassRoom[];
  questions?: Question[];
  selectedSourceKey?: string;
  onSelectSourceKey?: (key: string) => void;
  resolvedClassName?: string;
  teacherId?: string;
  teacherName?: string;
  userRole?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenAbsentModal?: () => void;
  onOpenHistoryModal?: () => void;
  onCloseGame?: () => void;
}

const B09_STORAGE_KEY = 'taydo_smart_edu_b09_active_session_v1';
const B09_STORAGE_VERSION = 1;

const TEAM_PRESETS: Array<{ name: string; colorHex: string }> = [
  { name: 'Đội Sao Xanh', colorHex: '#006BFF' },
  { name: 'Đội Phượng Hoàng', colorHex: '#F59E0B' },
  { name: 'Đội Ngọc Bích', colorHex: '#10B981' },
  { name: 'Đội Tia Chớp', colorHex: '#8B5CF6' },
  { name: 'Đội Hải Đăng', colorHex: '#EC4899' },
  { name: 'Đội Tinh Vân', colorHex: '#06B6D4' },
];

// ============================================================================
// VIETNAMESE UNICODE & GRAPHEME UTILITIES
// ============================================================================

/**
 * Normalize Vietnamese string using Unicode NFC, trim ends, and collapse multiple spaces.
 */
export function normalizeVietnameseNFC(input: string): string {
  return (input || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Strip Vietnamese diacritics and convert đ/Đ -> d/D after NFD decomposition.
 */
export function stripVietnameseAccents(input: string): string {
  const nfc = normalizeVietnameseNFC(input);
  return nfc
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}

/**
 * Convert a keyword into an uppercase ASCII search token without spaces for the 2D letter grid.
 */
export function toGridSearchToken(input: string): string {
  return stripVietnameseAccents(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Segment a Vietnamese string into visible grapheme clusters (characters),
 * ensuring accented letters (even if NFD) never split into multiple tiles.
 */
export function segmentVietnameseGraphemes(input: string): string[] {
  const nfc = (input || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!nfc) return [];
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('vi', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(nfc), (s) => s.segment);
  }
  return Array.from(nfc);
}

/**
 * Check whether a grapheme is a letter or digit that students need to guess,
 * versus spaces or fixed punctuation (-, /, ., etc.).
 */
export function isGuessableGrapheme(grapheme: string): boolean {
  if (!grapheme || grapheme === ' ') return false;
  return /[\p{L}\p{N}]/u.test(grapheme);
}

/**
 * Strictly evaluate a player's submitted answer against displayAnswer and acceptedAnswers.
 * - Normalizes Unicode NFC, trims & collapses whitespace, case-insensitive.
 * - Preserves Vietnamese accents by default.
 * - Only accepts unaccented answers if `acceptNoAccent` is explicitly enabled.
 * - Never uses fuzzy/approximate matching.
 */
export function evaluateKeywordSubmission(
  rawSubmitted: string,
  item: KeywordItemDefinition,
  acceptNoAccent: boolean
): { isCorrect: boolean; matchedCanonical: string } {
  const cleanedSub = normalizeVietnameseNFC(rawSubmitted).toLocaleLowerCase('vi-VN');
  if (!cleanedSub) {
    return { isCorrect: false, matchedCanonical: item.displayAnswer };
  }

  const validTargets = [item.displayAnswer, ...(item.acceptedAnswers || [])]
    .map((ans) => normalizeVietnameseNFC(ans))
    .filter(Boolean);

  // 1. Exact NFC match (case-insensitive)
  for (const target of validTargets) {
    if (cleanedSub === target.toLocaleLowerCase('vi-VN')) {
      return { isCorrect: true, matchedCanonical: item.displayAnswer };
    }
  }

  // 2. Optional accent-insensitive match (with đ/Đ -> d handling)
  if (acceptNoAccent) {
    const strippedSub = stripVietnameseAccents(cleanedSub).toLowerCase();
    for (const target of validTargets) {
      const strippedTarget = stripVietnameseAccents(target).toLowerCase();
      if (strippedSub && strippedSub === strippedTarget) {
        return { isCorrect: true, matchedCanonical: item.displayAnswer };
      }
    }
  }

  return { isCorrect: false, matchedCanonical: item.displayAnswer };
}

// ============================================================================
// BUILT-IN VERIFIED SAMPLE DATASETS ("DỮ LIỆU MẪU" — NOT SAVED TO DB)
// ============================================================================

export const SAMPLE_DATASET_MATH_B09: KeywordItemDefinition[] = [
  {
    id: 'b09_math_01',
    displayAnswer: 'TẬP HỢP',
    acceptedAnswers: ['Tập hợp'],
    clue: 'Khái niệm dùng để mô tả một nhóm đối tượng xác định.',
    hints: [
      'Thường được đặt tên bằng chữ cái in hoa như A, B, N, Z và viết các phần tử trong dấu ngoặc nhọn { }.',
      'Ví dụ: Nhóm các số tự nhiên nhỏ hơn 5 hoặc nhóm các học sinh tổ 1 lớp 6A.',
    ],
    explanation:
      'Tập hợp là khái niệm cơ bản của Toán học dùng để chỉ một nhóm đối tượng xác định; mỗi đối tượng trong nhóm gọi là một phần tử.',
    searchToken: 'TAPHOP',
    topicTag: 'Toán 6 · Số học',
    isSample: true,
  },
  {
    id: 'b09_math_02',
    displayAnswer: 'SỐ NGUYÊN',
    acceptedAnswers: ['Số nguyên', 'Tập số nguyên'],
    clue: 'Gồm số nguyên âm, số 0 và số nguyên dương.',
    hints: [
      'Tập hợp các số này được kí hiệu bằng chữ cái in hoa Z.',
      'Ví dụ: ..., -3, -2, -1, 0, 1, 2, 3, ... dùng để biểu diễn nhiệt độ dưới 0°C hoặc độ cao dưới mực nước biển.',
    ],
    explanation:
      'Tập hợp số nguyên (ℤ) bao gồm các số nguyên âm, số 0 và các số nguyên dương.',
    searchToken: 'SONGUYEN',
    topicTag: 'Toán 6 · Số học',
    isSample: true,
  },
  {
    id: 'b09_math_03',
    displayAnswer: 'PHÂN SỐ',
    acceptedAnswers: ['Phân số'],
    clue: 'Có dạng a/b, với a và b là số nguyên, b khác 0.',
    hints: [
      'Trong biểu thức a/b, a được gọi là tử số và b được gọi là mẫu số.',
      'Ví dụ: 3/4 chiếc bánh hoặc -2/5 mét vải.',
    ],
    explanation:
      'Phân số có dạng a/b với a, b ∈ ℤ và b ≠ 0, biểu thị thương của phép chia số nguyên a cho số nguyên b.',
    searchToken: 'PHANSO',
    topicTag: 'Toán 6 · Số học',
    isSample: true,
  },
  {
    id: 'b09_math_04',
    displayAnswer: 'TAM GIÁC',
    acceptedAnswers: ['Tam giác', 'Hình tam giác'],
    clue: 'Đa giác có ba cạnh.',
    hints: [
      'Hình này có 3 đỉnh, 3 cạnh và tổng số đo 3 góc trong luôn bằng 180 độ.',
      'Có các dạng đặc biệt như cân, đều hoặc vuông.',
    ],
    explanation:
      'Tam giác là đa giác gồm 3 đỉnh không thẳng hàng và 3 đoạn thẳng nối các đỉnh đó.',
    searchToken: 'TAMGIAC',
    topicTag: 'Toán THCS · Hình học',
    isSample: true,
  },
  {
    id: 'b09_math_05',
    displayAnswer: 'CHU VI',
    acceptedAnswers: ['Chu vi'],
    clue: 'Tổng độ dài các cạnh của một đa giác.',
    hints: [
      'Đại lượng này cho biết độ dài đường bao quanh toàn bộ một hình phẳng.',
      'Ví dụ: Muốn tính độ dài hàng rào bao quanh mảnh vườn hình chữ nhật, ta lấy (dài + rộng) × 2.',
    ],
    explanation:
      'Chu vi của một đa giác là tổng độ dài tất cả các cạnh bao quanh hình đó.',
    searchToken: 'CHUVI',
    topicTag: 'Toán THCS · Hình học',
    isSample: true,
  },
  {
    id: 'b09_math_06',
    displayAnswer: 'DIỆN TÍCH',
    acceptedAnswers: ['Diện tích'],
    clue: 'Đại lượng đo phần mặt phẳng mà một hình chiếm.',
    hints: [
      'Thường đo bằng các đơn vị có số mũ 2 như cm², m², km².',
      'Ví dụ: Để biết cần lát bao nhiêu viên gạch cho nền phòng học, ta phải tính đại lượng này của nền phòng.',
    ],
    explanation:
      'Diện tích là đại lượng biểu thị độ lớn phần mặt phẳng được giới hạn bởi một hình học.',
    searchToken: 'DIENTICH',
    topicTag: 'Toán THCS · Hình học',
    isSample: true,
  },
  {
    id: 'b09_math_07',
    displayAnswer: 'GÓC VUÔNG',
    acceptedAnswers: ['Góc vuông'],
    clue: 'Góc có số đo 90 độ.',
    hints: [
      'Hai cạnh của góc này vuông góc với nhau, thường được kí hiệu bằng một ô vuông nhỏ ở đỉnh.',
      'Ví dụ: Góc tạo bởi hai mép liền kề của quyển sách giáo khoa hoặc chiếc ê-ke.',
    ],
    explanation:
      'Góc vuông là góc có số đo bằng 90°, bằng một nửa góc bẹt.',
    searchToken: 'GOCVUONG',
    topicTag: 'Toán 6 · Hình học',
    isSample: true,
  },
  {
    id: 'b09_math_08',
    displayAnswer: 'ĐỐI XỨNG',
    acceptedAnswers: ['Đối xứng'],
    clue: 'Thuật ngữ xuất hiện trong “trục …” và “tâm …”.',
    hints: [
      'Tính chất giúp hai nửa của một hình trùng khít lên nhau khi gấp theo một đường thẳng hoặc quay 180° quanh một điểm.',
      'Ví dụ: Cánh bướm, chữ cái A in hoa hoặc hình tròn đều mang tính chất hình học hài hòa này.',
    ],
    explanation:
      'Đối xứng (gồm đối xứng trục và đối xứng tâm) là tính chất cân đối quan trọng của các hình phẳng trong tự nhiên và Toán học.',
    searchToken: 'DOIXUNG',
    topicTag: 'Toán 6 · Hình học',
    isSample: true,
  },
];

export const SAMPLE_DATASET_INFORMATICS_B09: KeywordItemDefinition[] = [
  {
    id: 'b09_info_01',
    displayAnswer: 'THÔNG TIN',
    acceptedAnswers: ['Thông tin'],
    clue: 'Những gì đem lại hiểu biết cho con người.',
    hints: [
      'Con người tiếp nhận nội dung này qua các giác quan khi đọc sách, nghe giảng hay quan sát đèn giao thông.',
      'Là cơ sở để con người suy nghĩ và đưa ra quyết định đúng đắn.',
    ],
    explanation:
      'Thông tin là tất cả những gì mang lại sự hiểu biết cho con người về thế giới xung quanh và về chính bản thân mình.',
    searchToken: 'THONGTIN',
    topicTag: 'Tin học 6 · Chủ đề A',
    isSample: true,
  },
  {
    id: 'b09_info_02',
    displayAnswer: 'DỮ LIỆU',
    acceptedAnswers: ['Dữ liệu'],
    clue: 'Thông tin được biểu diễn để có thể lưu trữ và xử lí.',
    hints: [
      'Có thể ở dạng chữ viết, con số, hình ảnh hoặc âm thanh được mã hóa trong máy tính.',
      'Khi nhìn vào các con số điểm kiểm tra trên bảng tính, đó chính là dạng biểu diễn này.',
    ],
    explanation:
      'Dữ liệu là thông tin đã được đưa vào vật mang tin (hoặc máy tính) dưới dạng văn bản, số, hình ảnh, âm thanh để lưu trữ và xử lí.',
    searchToken: 'DULIEU',
    topicTag: 'Tin học 6 · Chủ đề A',
    isSample: true,
  },
  {
    id: 'b09_info_03',
    displayAnswer: 'BÀN PHÍM',
    acceptedAnswers: ['Bàn phím'],
    clue: 'Thiết bị dùng để nhập kí tự vào máy tính.',
    hints: [
      'Thiết bị vào (Input) có các hàng phím chữ cái A–Z, phím số 0–9 và phím Space, Enter.',
      'Giúp học sinh gõ văn bản, nhập câu lệnh hoặc điền đáp án.',
    ],
    explanation:
      'Bàn phím (Keyboard) là thiết bị nhập cơ bản giúp người dùng gửi các kí tự, con số và lệnh điều khiển vào máy tính.',
    searchToken: 'BANPHIM',
    topicTag: 'Tin học · Thiết bị số',
    isSample: true,
  },
  {
    id: 'b09_info_04',
    displayAnswer: 'MÀN HÌNH',
    acceptedAnswers: ['Màn hình'],
    clue: 'Thiết bị hiển thị hình ảnh và nội dung.',
    hints: [
      'Là thiết bị ra (Output) quan trọng nhất giúp người dùng nhìn thấy giao diện phần mềm, bài giảng và video.',
      'Trông giống chiếc tivi đặt trước mặt người sử dụng máy tính.',
    ],
    explanation:
      'Màn hình (Monitor) là thiết bị xuất chuẩn dùng để hiển thị trực quan kết quả xử lí thông tin của máy tính.',
    searchToken: 'MANHINH',
    topicTag: 'Tin học · Thiết bị số',
    isSample: true,
  },
  {
    id: 'b09_info_05',
    displayAnswer: 'THUẬT TOÁN',
    acceptedAnswers: ['Thuật toán'],
    clue: 'Dãy hữu hạn các bước để giải quyết một bài toán.',
    hints: [
      'Có thể mô tả bằng liệt kê từng bước hoặc bằng sơ đồ khối (nhập đầu vào Input → xuất đầu ra Output).',
      'Là nền tảng trước khi viết chương trình máy tính.',
    ],
    explanation:
      'Thuật toán (Algorithm) là một dãy hữu hạn các thao tác được sắp xếp theo trình tự xác định sao cho từ đầu vào ta nhận được đầu ra cần tìm.',
    searchToken: 'THUATTOAN',
    topicTag: 'Tin học · Lập trình',
    isSample: true,
  },
  {
    id: 'b09_info_06',
    displayAnswer: 'INTERNET',
    acceptedAnswers: ['Internet', 'Mạng Internet'],
    clue: 'Mạng liên kết các mạng máy tính trên phạm vi toàn cầu.',
    hints: [
      'Giúp hàng tỉ người dùng khắp thế giới tra cứu web, gửi thư điện tử và học trực tuyến.',
      'Không thuộc quyền sở hữu riêng của một cá nhân hay tổ chức duy nhất nào.',
    ],
    explanation:
      'Internet là hệ thống mạng máy tính khổng lồ kết nối các mạng máy tính trên toàn thế giới sử dụng bộ giao thức truyền thông TCP/IP.',
    searchToken: 'INTERNET',
    topicTag: 'Tin học · Mạng máy tính',
    isSample: true,
  },
  {
    id: 'b09_info_07',
    displayAnswer: 'TỆP',
    acceptedAnswers: ['Tệp', 'Tệp tin', 'Tập tin'],
    clue: 'Đơn vị lưu trữ dữ liệu có tên trên thiết bị lưu trữ.',
    hints: [
      'Thường có phần tên và phần mở rộng cách nhau bởi dấu chấm, ví dụ: baigiang.pptx, baitap.docx.',
      'Được chứa bên trong các thư mục trên ổ đĩa.',
    ],
    explanation:
      'Tệp (File) là đơn vị cơ bản để lưu trữ thông tin trên thiết bị nhớ ngoài, mỗi tệp có tên riêng để phân biệt và truy cập.',
    searchToken: 'TEP',
    topicTag: 'Tin học · Lưu trữ',
    isSample: true,
  },
  {
    id: 'b09_info_08',
    displayAnswer: 'THƯ MỤC',
    acceptedAnswers: ['Thư mục'],
    clue: 'Dùng để tổ chức tệp và các thư mục con.',
    hints: [
      'Thường có biểu tượng hình kẹp giấy màu vàng trên máy tính Windows.',
      'Giúp sắp xếp tài liệu học tập theo từng môn học, từng học kì gọn gàng theo cấu trúc hình cây.',
    ],
    explanation:
      'Thư mục (Folder / Directory) là ngăn chứa giúp quản lí, phân loại các tệp và thư mục con một cách khoa học.',
    searchToken: 'THUMUC',
    topicTag: 'Tin học · Lưu trữ',
    isSample: true,
  },
];

// ============================================================================
// DATASET VALIDATION & WORD SEARCH GRID GENERATOR
// ============================================================================

export function validateKeywordDataset(
  items: KeywordItemDefinition[],
  mode: B09PlayMode
): { validItems: KeywordItemDefinition[]; warnings: string[] } {
  const validItems: KeywordItemDefinition[] = [];
  const warnings: string[] = [];
  const seenAnswers = new Set<string>();
  const seenTokens = new Set<string>();

  for (const raw of items) {
    const displayAnswer = normalizeVietnameseNFC(raw.displayAnswer).toUpperCase();
    const clue = normalizeVietnameseNFC(raw.clue);
    const searchToken = toGridSearchToken(raw.searchToken || displayAnswer);

    if (!displayAnswer || !clue) {
      warnings.push(`Bỏ qua mục thiếu từ khóa hoặc gợi ý.`);
      continue;
    }

    if (searchToken.length < 2) {
      warnings.push(`Từ "${displayAnswer}" quá ngắn (cần tối thiểu 2 kí tự chữ cái).`);
      continue;
    }

    if (mode === 'WORD_GRID_HUNT' && searchToken.length > 12) {
      warnings.push(`Từ "${displayAnswer}" (${searchToken.length} chữ cái) vượt quá kích thước bảng chữ tối đa 12×12.`);
      continue;
    }

    const normKey = displayAnswer.toLocaleLowerCase('vi-VN');
    if (seenAnswers.has(normKey)) {
      warnings.push(`Từ khóa trùng lặp "${displayAnswer}" đã được lược bỏ.`);
      continue;
    }

    if (mode === 'WORD_GRID_HUNT' && seenTokens.has(searchToken)) {
      warnings.push(
        `Từ "${displayAnswer}" có cùng chuỗi không dấu "${searchToken}" với một từ đã chọn trên bảng chữ nên chỉ giữ 1 từ.`
      );
      continue;
    }

    seenAnswers.add(normKey);
    seenTokens.add(searchToken);

    validItems.push({
      ...raw,
      displayAnswer,
      clue,
      searchToken,
      acceptedAnswers: (raw.acceptedAnswers || []).map((a) => normalizeVietnameseNFC(a)).filter(Boolean),
      hints: [
        normalizeVietnameseNFC(raw.hints?.[0]) || `Từ khóa gồm ${searchToken.length} chữ cái liên quan trực tiếp đến gợi ý.`,
        normalizeVietnameseNFC(raw.hints?.[1]) || `Chữ cái đầu tiên của từ khóa là "${displayAnswer.charAt(0)}".`,
      ],
      explanation:
        normalizeVietnameseNFC(raw.explanation) ||
        `Từ khóa chính xác là "${displayAnswer}": ${clue}`,
    });
  }

  return { validItems, warnings };
}

const DIRECTION_DELTAS: Record<GridDirectionKey, { dr: number; dc: number }> = {
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 },
  N: { dr: -1, dc: 0 },
  SE: { dr: 1, dc: 1 },
  NE: { dr: -1, dc: 1 },
  SW: { dr: 1, dc: -1 },
  NW: { dr: -1, dc: -1 },
};

const VIETNAMESE_GRID_FILL_ALPHABET = 'ABCDEGHIKLMNOPQRSTUVXY';

export function getAllowedDirections(allowDiagonal: boolean, allowReverse: boolean): GridDirectionKey[] {
  const dirs: GridDirectionKey[] = ['E', 'S'];
  if (allowDiagonal) {
    dirs.push('SE', 'NE');
  }
  if (allowReverse) {
    dirs.push('W', 'N');
    if (allowDiagonal) {
      dirs.push('SW', 'NW');
    }
  }
  return dirs;
}

/**
 * Scan the completed grid along allowed directions to find ALL valid occurrences of a searchToken.
 * Ensures that if random filler letters accidentally form a second valid instance of a target word,
 * selecting either valid instance is accepted and never falsely rejected.
 */
export function scanAllOccurrencesInGrid(
  cells: string[][],
  searchToken: string,
  allowedDirs: GridDirectionKey[]
): GridCoord[][] {
  const size = cells.length;
  const len = searchToken.length;
  const occurrences: GridCoord[][] = [];
  if (len === 0 || size === 0) return occurrences;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c] !== searchToken[0]) continue;
      for (const dirKey of allowedDirs) {
        const { dr, dc } = DIRECTION_DELTAS[dirKey];
        const endR = r + dr * (len - 1);
        const endC = c + dc * (len - 1);
        if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

        const coords: GridCoord[] = [];
        let matched = true;
        for (let i = 0; i < len; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (cells[nr][nc] !== searchToken[i]) {
            matched = false;
            break;
          }
          coords.push({ row: nr, col: nc });
        }
        if (matched) {
          occurrences.push(coords);
        }
      }
    }
  }

  return occurrences;
}

/**
 * Generate a deterministic-safe 2D Word Search board:
 * - Automatically determines initial board size (8x8 for short words, scaling to 10x10 or 12x12).
 * - Places longest words first.
 * - Only intersects when characters match.
 * - Retries up to a safe limit and scales board size up to 12x12 if needed.
 * - Post-scans all placed words across allowed directions.
 */
export function generateWordSearchGrid(
  items: KeywordItemDefinition[],
  allowDiagonal: boolean,
  allowReverse: boolean
): GeneratedWordGrid {
  const allowedDirs = getAllowedDirections(allowDiagonal, allowReverse);
  const sortedItems = [...items].sort((a, b) => b.searchToken.length - a.searchToken.length);
  const longestLen = sortedItems.reduce((max, it) => Math.max(max, it.searchToken.length), 0);
  const totalChars = sortedItems.reduce((sum, it) => sum + it.searchToken.length, 0);

  let initialSize = 8;
  if (longestLen > 8 || items.length > 5 || totalChars > 34) {
    initialSize = 10;
  }
  if (longestLen > 10 || items.length > 7 || totalChars > 52) {
    initialSize = 12;
  }
  const candidateSizes = [initialSize, 10, 12].filter(
    (s, idx, arr) => s >= Math.max(8, longestLen) && arr.indexOf(s) === idx
  );
  if (candidateSizes.length === 0) {
    candidateSizes.push(Math.max(12, longestLen));
  }

  for (const boardSize of candidateSizes) {
    const maxBoardAttempts = 30;
    for (let attempt = 0; attempt < maxBoardAttempts; attempt++) {
      const cells: string[][] = Array.from({ length: boardSize }, () => Array(boardSize).fill(''));
      const tempPlaced: Array<{
        item: KeywordItemDefinition;
        coords: GridCoord[];
      }> = [];
      let allPlaced = true;

      for (const item of sortedItems) {
        const token = item.searchToken;
        const len = token.length;
        if (len > boardSize) {
          allPlaced = false;
          break;
        }

        // Build all valid candidate placements for this word on the current board
        const validPlacements: Array<{ coords: GridCoord[]; overlapScore: number }> = [];
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            for (const dirKey of allowedDirs) {
              const { dr, dc } = DIRECTION_DELTAS[dirKey];
              const endR = r + dr * (len - 1);
              const endC = c + dc * (len - 1);
              if (endR < 0 || endR >= boardSize || endC < 0 || endC >= boardSize) continue;

              let canPlace = true;
              let overlapScore = 0;
              const coords: GridCoord[] = [];

              for (let i = 0; i < len; i++) {
                const nr = r + dr * i;
                const nc = c + dc * i;
                const existing = cells[nr][nc];
                if (existing !== '' && existing !== token[i]) {
                  canPlace = false;
                  break;
                }
                if (existing === token[i]) {
                  overlapScore += 1;
                }
                coords.push({ row: nr, col: nc });
              }

              if (canPlace) {
                validPlacements.push({ coords, overlapScore });
              }
            }
          }
        }

        if (validPlacements.length === 0) {
          allPlaced = false;
          break;
        }

        // Shuffle valid placements slightly while favoring nice intersections
        const picked =
          validPlacements[Math.floor(Math.random() * validPlacements.length)];
        picked.coords.forEach((pt, idx) => {
          cells[pt.row][pt.col] = token[idx];
        });
        tempPlaced.push({ item, coords: picked.coords });
      }

      if (allPlaced) {
        // Fill empty cells with Vietnamese uppercase ASCII letters
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            if (!cells[r][c]) {
              const randIdx = Math.floor(Math.random() * VIETNAMESE_GRID_FILL_ALPHABET.length);
              cells[r][c] = VIETNAMESE_GRID_FILL_ALPHABET[randIdx];
            }
          }
        }

        // Preserve original item order for UI clue list and run post-fill scan
        const placedWords: PlacedGridWord[] = items.map((originalItem) => {
          const foundTemp = tempPlaced.find((p) => p.item.id === originalItem.id)!;
          const allOccurrences = scanAllOccurrencesInGrid(
            cells,
            originalItem.searchToken,
            allowedDirs
          );
          return {
            wordId: originalItem.id,
            searchToken: originalItem.searchToken,
            displayAnswer: originalItem.displayAnswer,
            clue: originalItem.clue,
            explanation: originalItem.explanation,
            primaryCoords: foundTemp.coords,
            validOccurrences:
              allOccurrences.length > 0 ? allOccurrences : [foundTemp.coords],
          };
        });

        return {
          size: boardSize,
          cells,
          placedWords,
          skippedWords: [],
        };
      }
    }
  }

  // Fallback deterministic row placement on a 12x12 board if heavily constrained
  const fallbackSize = Math.max(12, longestLen);
  const cells: string[][] = Array.from({ length: fallbackSize }, () =>
    Array(fallbackSize).fill('')
  );
  const placedWords: PlacedGridWord[] = [];
  const skippedWords: string[] = [];

  items.forEach((item, idx) => {
    const token = item.searchToken;
    if (idx < fallbackSize && token.length <= fallbackSize) {
      const startCol = Math.floor((fallbackSize - token.length) / 2);
      const coords: GridCoord[] = [];
      for (let i = 0; i < token.length; i++) {
        cells[idx][startCol + i] = token[i];
        coords.push({ row: idx, col: startCol + i });
      }
      placedWords.push({
        wordId: item.id,
        searchToken: token,
        displayAnswer: item.displayAnswer,
        clue: item.clue,
        explanation: item.explanation,
        primaryCoords: coords,
        validOccurrences: [coords],
      });
    } else {
      skippedWords.push(item.displayAnswer);
    }
  });

  for (let r = 0; r < fallbackSize; r++) {
    for (let c = 0; c < fallbackSize; c++) {
      if (!cells[r][c]) {
        const randIdx = Math.floor(Math.random() * VIETNAMESE_GRID_FILL_ALPHABET.length);
        cells[r][c] = VIETNAMESE_GRID_FILL_ALPHABET[randIdx];
      }
    }
  }

  return {
    size: fallbackSize,
    cells,
    placedWords,
    skippedWords,
  };
}

/**
 * Compute straight-line coordinates from start to end if and only if the line matches one of the allowed directions.
 */
export function computeStraightLineCoords(
  start: GridCoord,
  end: GridCoord,
  allowedDirs: GridDirectionKey[]
): { coords: GridCoord[]; dirKey: GridDirectionKey | null; isValidDirection: boolean } {
  const dRow = end.row - start.row;
  const dCol = end.col - start.col;

  if (dRow === 0 && dCol === 0) {
    return { coords: [start], dirKey: null, isValidDirection: true };
  }

  const absR = Math.abs(dRow);
  const absC = Math.abs(dCol);

  // Must be horizontal, vertical, or exact 45-degree diagonal
  if (dRow !== 0 && dCol !== 0 && absR !== absC) {
    return { coords: [], dirKey: null, isValidDirection: false };
  }

  const steps = Math.max(absR, absC);
  const stepR = dRow === 0 ? 0 : dRow / absR;
  const stepC = dCol === 0 ? 0 : dCol / absC;

  let matchedDir: GridDirectionKey | null = null;
  for (const [k, delta] of Object.entries(DIRECTION_DELTAS) as Array<
    [GridDirectionKey, { dr: number; dc: number }]
  >) {
    if (delta.dr === stepR && delta.dc === stepC) {
      matchedDir = k;
      break;
    }
  }

  if (!matchedDir || !allowedDirs.includes(matchedDir)) {
    return { coords: [], dirKey: matchedDir, isValidDirection: false };
  }

  const coords: GridCoord[] = [];
  for (let i = 0; i <= steps; i++) {
    coords.push({
      row: start.row + stepR * i,
      col: start.col + stepC * i,
    });
  }

  return { coords, dirKey: matchedDir, isValidDirection: true };
}

// ============================================================================
// WEB AUDIO SOUND ENGINE FOR B09 (NO EXTERNAL AUDIO FILES REQUIRED)
// ============================================================================

class B09SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public stopAll(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public playSelectTile(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playSubmit(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.11);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playCorrect(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.13, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.25);
    });
  }

  public playWrong(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(175, now + 0.22);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playCelebration(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 987.77, 1046.5];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.14, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.46);
    });
  }
}

const b09Sound = new B09SoundEngine();

// ============================================================================
// MAIN COMPONENT: KEYWORD QUEST GAME (B09 - TÌM TỪ KHÓA 3D)
// ============================================================================

export const KeywordQuestGame: React.FC<KeywordQuestGameProps> = ({
  availableCandidates,
  questions = [],
  resolvedClassName = 'Lớp học',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onCloseGame,
}) => {
  // --------------------------------------------------------------------------
  // 1. CONFIGURATION & SETUP STATE
  // --------------------------------------------------------------------------
  const [playMode, setPlayMode] = useState<B09PlayMode>('DECODE_KEYWORD');
  const [datasetKey, setDatasetKey] = useState<B09DatasetKey>('SAMPLE_MATH');
  const [orgMode, setOrgMode] = useState<B09OrgMode>('CLASS');
  const [teamCount, setTeamCount] = useState<number>(3);

  // Decode Mode settings (Defaults: 5 rounds, 45s/round, max 2 attempts)
  const [decodeRoundCount, setDecodeRoundCount] = useState<number>(5);
  const [decodeTimeSec, setDecodeTimeSec] = useState<number>(45); // 0 = unlimited
  const [maxAttemptsPerRound, setMaxAttemptsPerRound] = useState<number>(2); // 0 = unlimited

  // Grid Hunt Mode settings (Defaults: 6 words, 180s (3 min), no diagonal/reverse by default)
  const [gridWordCount, setGridWordCount] = useState<number>(6);
  const [gridTimeSec, setGridTimeSec] = useState<number>(180); // 0 = unlimited
  const [allowDiagonal, setAllowDiagonal] = useState<boolean>(false);
  const [allowReverse, setAllowReverse] = useState<boolean>(false);

  // Vietnamese & Accessibility settings
  const [acceptNoAccent, setAcceptNoAccent] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // Custom keyword editor state
  const [customItems, setCustomItems] = useState<KeywordItemDefinition[]>([
    {
      id: 'b09_custom_1',
      displayAnswer: 'TAM GIÁC ĐỀU',
      acceptedAnswers: ['Tam giác đều'],
      clue: 'Tam giác có ba cạnh bằng nhau và ba góc bằng nhau (mỗi góc 60 độ).',
      hints: [
        'Mọi đường cao của hình này đồng thời là đường trung tuyến và phân giác.',
        'Ba cạnh có độ dài hoàn toàn bằng nhau.',
      ],
      explanation: 'Tam giác đều là tam giác có 3 cạnh bằng nhau và 3 góc đều bằng 60°.',
      searchToken: 'TAMGIACDEU',
      topicTag: 'Tự soạn',
      isSample: false,
    },
    {
      id: 'b09_custom_2',
      displayAnswer: 'SỐ NGUYÊN TỐ',
      acceptedAnswers: ['Số nguyên tố'],
      clue: 'Số tự nhiên lớn hơn 1, chỉ có hai ước là 1 và chính nó.',
      hints: [
        'Số 2 là số chẵn duy nhất thuộc loại số này.',
        'Ví dụ: 2, 3, 5, 7, 11, 13, 17, 19...',
      ],
      explanation: 'Số nguyên tố là số tự nhiên lớn hơn 1 chỉ chia hết cho 1 và chính nó.',
      searchToken: 'SONGUYENTO',
      topicTag: 'Tự soạn',
      isSample: false,
    },
    {
      id: 'b09_custom_3',
      displayAnswer: 'HÌNH THOI',
      acceptedAnswers: ['Hình thoi'],
      clue: 'Tứ giác có bốn cạnh bằng nhau và hai đường chéo vuông góc.',
      hints: [
        'Hai đường chéo cắt nhau tại trung điểm của mỗi đường và là các đường phân giác của các góc.',
        'Trông giống hình con diều cân đối.',
      ],
      explanation: 'Hình thoi là tứ giác có bốn cạnh bằng nhau.',
      searchToken: 'HINHTHOI',
      topicTag: 'Tự soạn',
      isSample: false,
    },
    {
      id: 'b09_custom_4',
      displayAnswer: 'MẠNG MÁY TÍNH',
      acceptedAnswers: ['Mạng máy tính'],
      clue: 'Hai hay nhiều máy tính và thiết bị được kết nối để truyền dữ liệu và dùng chung tài nguyên.',
      hints: [
        'Có thể kết nối bằng dây cáp mạng hoặc sóng Wi-Fi.',
        'Giúp các máy trong phòng Tin học chia sẻ tệp và máy in.',
      ],
      explanation: 'Mạng máy tính giúp kết nối các thiết bị số để trao đổi dữ liệu và chia sẻ tài nguyên.',
      searchToken: 'MANGMAYTINH',
      topicTag: 'Tự soạn',
      isSample: false,
    },
  ]);
  const [newCustomAnswer, setNewCustomAnswer] = useState<string>('');
  const [newCustomAccepted, setNewCustomAccepted] = useState<string>('');
  const [newCustomClue, setNewCustomClue] = useState<string>('');
  const [newCustomHint1, setNewCustomHint1] = useState<string>('');
  const [newCustomHint2, setNewCustomHint2] = useState<string>('');
  const [newCustomExplanation, setNewCustomExplanation] = useState<string>('');
  const [customEditorError, setCustomEditorError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // 2. ACTIVE SESSION STATE
  // --------------------------------------------------------------------------
  const [phase, setPhase] = useState<B09StagePhase>('SETUP');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionKeywords, setSessionKeywords] = useState<KeywordItemDefinition[]>([]);
  const [datasetWarnings, setDatasetWarnings] = useState<string[]>([]);

  // Decode Mode runtime state
  const [currentRoundIdx, setCurrentRoundIdx] = useState<number>(0);
  const [inputAnswer, setInputAnswer] = useState<string>('');
  const [attemptsUsedInRound, setAttemptsUsedInRound] = useState<number>(0);
  const [unlockedHintCount, setUnlockedHintCount] = useState<number>(0); // 0..3
  const [revealedLetterIndices, setRevealedLetterIndices] = useState<number[]>([]);
  const [isRoundResolved, setIsRoundResolved] = useState<boolean>(false);
  const [roundOutcome, setRoundOutcome] = useState<{
    status: 'CORRECT' | 'WRONG_RETRY' | 'REVEALED' | 'TIMEOUT';
    message: string;
    pointsAwarded: number;
  } | null>(null);

  // Word Grid Mode runtime state
  const [wordGrid, setWordGrid] = useState<GeneratedWordGrid | null>(null);
  const [foundWordIds, setFoundWordIds] = useState<string[]>([]);
  const [hintedWordIds, setHintedWordIds] = useState<string[]>([]);
  const [activeHintStartCoord, setActiveHintStartCoord] = useState<GridCoord | null>(null);
  const [gridSelectionStart, setGridSelectionStart] = useState<GridCoord | null>(null);
  const [gridSelectionCurrent, setGridSelectionCurrent] = useState<GridCoord | null>(null);
  const [isPointerDraggingGrid, setIsPointerDraggingGrid] = useState<boolean>(false);
  const [focusedGridCell, setFocusedGridCell] = useState<GridCoord>({ row: 0, col: 0 });
  const [lastSolvedGridWord, setLastSolvedGridWord] = useState<PlacedGridWord | null>(null);
  const [gridFeedbackBanner, setGridFeedbackBanner] = useState<{
    type: 'SUCCESS' | 'ERROR' | 'INFO';
    text: string;
  } | null>(null);

  // Scoring, Teams & Individual Turn state
  const [classScore, setClassScore] = useState<number>(0);
  const [scoredKeywordIds, setScoredKeywordIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<B09TeamItem[]>([]);
  const [activeTeamIdx, setActiveTeamIdx] = useState<number>(0);
  const [activeStudent, setActiveStudent] = useState<StudentCandidate | null>(null);
  const [individualScores, setIndividualScores] = useState<Record<string, { name: string; score: number; solved: number }>>({});
  const [turnLogs, setTurnLogs] = useState<B09TurnLog[]>([]);

  // Timer & Pause state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const deadlineMsRef = useRef<number | null>(null);
  const pausedRemainingMsRef = useRef<number | null>(null);
  const phaseBeforePauseRef = useRef<B09StagePhase>('PLAYING');
  const evaluatedTurnKeyRef = useRef<string | null>(null);
  const isComposingRef = useRef<boolean>(false);

  // Modals & Notice state
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [zoomedContent, setZoomedContent] = useState<{ title: string; body: string } | null>(null);
  const [confirmExitModal, setConfirmExitModal] = useState<'SETUP' | 'LIBRARY' | 'RESTART' | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [hasRestorableSession, setHasRestorableSession] = useState<boolean>(false);

  const voiceManagerRef = useRef<SpaceRocketVoiceManager | null>(null);
  if (!voiceManagerRef.current && typeof window !== 'undefined') {
    voiceManagerRef.current = new SpaceRocketVoiceManager();
  }

  // Cleanup voice and audio on unmount
  useEffect(() => {
    return () => {
      voiceManagerRef.current?.cancel();
      b09Sound.stopAll();
    };
  }, []);

  useEffect(() => {
    if (isMuted) {
      voiceManagerRef.current?.cancel();
      b09Sound.stopAll();
    }
  }, [isMuted]);

  // --------------------------------------------------------------------------
  // 3. CONVERT SYSTEM QUESTION BANK TO KEYWORDS (WHEN SELECTED)
  // --------------------------------------------------------------------------
  const questionBankKeywords = useMemo<KeywordItemDefinition[]>(() => {
    if (!questions || questions.length === 0) return [];
    const results: KeywordItemDefinition[] = [];

    for (const q of questions) {
      let answerText = '';
      if (q.options && q.options.length > 0 && q.correctAnswer) {
        const foundOpt = q.options.find(
          (o) => o.id === q.correctAnswer || o.label === q.correctAnswer
        );
        answerText = foundOpt ? foundOpt.text : '';
      } else if (typeof q.correctAnswer === 'string') {
        answerText = q.correctAnswer;
      }

      const cleanedAnswer = normalizeVietnameseNFC(answerText)
        .replace(/^[A-D]\.\s*/i, '')
        .trim();
      const token = toGridSearchToken(cleanedAnswer);

      // Keep concise concept answers (2..12 letters) suitable for keyword decoding/search
      if (
        cleanedAnswer &&
        token.length >= 2 &&
        token.length <= 12 &&
        !/[$\\{}]/.test(cleanedAnswer)
      ) {
        const stemClean = normalizeVietnameseNFC(q.stem || '');
        if (!stemClean) continue;
        results.push({
          id: `qb_${q.id}`,
          displayAnswer: cleanedAnswer.toUpperCase(),
          acceptedAnswers: [cleanedAnswer],
          clue: stemClean,
          hints: [
            q.explanation
              ? normalizeVietnameseNFC(q.explanation).slice(0, 140)
              : `Thuật ngữ gồm ${token.length} chữ cái thuộc chủ đề ${q.chapter || q.subject || 'bài học'}.`,
            `Chữ cái bắt đầu là "${cleanedAnswer.charAt(0).toUpperCase()}".`,
          ],
          explanation:
            normalizeVietnameseNFC(q.explanation || '') ||
            `Đáp án đúng là "${cleanedAnswer.toUpperCase()}".`,
          searchToken: token,
          topicTag: q.chapter || q.subject || 'Ngân hàng câu hỏi',
          isSample: false,
        });
      }
    }

    return results;
  }, [questions]);

  // Active raw dataset based on teacher selection
  const activeRawDataset = useMemo<KeywordItemDefinition[]>(() => {
    switch (datasetKey) {
      case 'SAMPLE_MATH':
        return SAMPLE_DATASET_MATH_B09;
      case 'SAMPLE_INFORMATICS':
        return SAMPLE_DATASET_INFORMATICS_B09;
      case 'QUESTION_BANK':
        return questionBankKeywords;
      case 'CUSTOM':
        return customItems;
      default:
        return SAMPLE_DATASET_MATH_B09;
    }
  }, [datasetKey, questionBankKeywords, customItems]);

  const validatedSetupPool = useMemo(() => {
    return validateKeywordDataset(activeRawDataset, playMode);
  }, [activeRawDataset, playMode]);

  // --------------------------------------------------------------------------
  // 4. LOCAL STORAGE SESSION PERSISTENCE (SCOPED TO B09 ONLY)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(B09_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.version === B09_STORAGE_VERSION &&
        parsed.sessionId &&
        Array.isArray(parsed.sessionKeywords) &&
        parsed.sessionKeywords.length > 0 &&
        parsed.phase &&
        parsed.phase !== 'SETUP' &&
        parsed.phase !== 'FINISHED'
      ) {
        setHasRestorableSession(true);
      }
    } catch {
      window.localStorage.removeItem(B09_STORAGE_KEY);
    }
  }, []);

  const saveSessionToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (phase === 'SETUP' || !sessionId || sessionKeywords.length === 0) return;
    try {
      const payload = {
        version: B09_STORAGE_VERSION,
        savedAt: Date.now(),
        sessionId,
        playMode,
        datasetKey,
        orgMode,
        teamCount,
        acceptNoAccent,
        decodeTimeSec,
        maxAttemptsPerRound,
        gridTimeSec,
        allowDiagonal,
        allowReverse,
        phase: phase === 'PAUSED' ? 'PAUSED' : 'PLAYING',
        sessionKeywords,
        currentRoundIdx,
        attemptsUsedInRound,
        unlockedHintCount,
        revealedLetterIndices,
        isRoundResolved,
        wordGrid,
        foundWordIds,
        hintedWordIds,
        classScore,
        scoredKeywordIds,
        teams,
        activeTeamIdx,
        turnLogs,
        remainingSeconds,
      };
      window.localStorage.setItem(B09_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    phase,
    sessionId,
    playMode,
    datasetKey,
    orgMode,
    teamCount,
    acceptNoAccent,
    decodeTimeSec,
    maxAttemptsPerRound,
    gridTimeSec,
    allowDiagonal,
    allowReverse,
    sessionKeywords,
    currentRoundIdx,
    attemptsUsedInRound,
    unlockedHintCount,
    revealedLetterIndices,
    isRoundResolved,
    wordGrid,
    foundWordIds,
    hintedWordIds,
    classScore,
    scoredKeywordIds,
    teams,
    activeTeamIdx,
    turnLogs,
    remainingSeconds,
  ]);

  useEffect(() => {
    if (phase !== 'SETUP' && phase !== 'FINISHED') {
      saveSessionToStorage();
    }
  }, [phase, currentRoundIdx, foundWordIds, classScore, unlockedHintCount, attemptsUsedInRound, saveSessionToStorage]);

  const clearSavedSessionStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(B09_STORAGE_KEY);
      setHasRestorableSession(false);
    } catch {
      // Ignore
    }
  }, []);

  const handleRestoreSavedSession = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(B09_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.version !== B09_STORAGE_VERSION) {
        clearSavedSessionStorage();
        return;
      }

      setSessionId(data.sessionId);
      setPlayMode(data.playMode || 'DECODE_KEYWORD');
      setDatasetKey(data.datasetKey || 'SAMPLE_MATH');
      setOrgMode(data.orgMode || 'CLASS');
      setTeamCount(data.teamCount || 3);
      setAcceptNoAccent(Boolean(data.acceptNoAccent));
      setDecodeTimeSec(typeof data.decodeTimeSec === 'number' ? data.decodeTimeSec : 45);
      setMaxAttemptsPerRound(typeof data.maxAttemptsPerRound === 'number' ? data.maxAttemptsPerRound : 2);
      setGridTimeSec(typeof data.gridTimeSec === 'number' ? data.gridTimeSec : 180);
      setAllowDiagonal(Boolean(data.allowDiagonal));
      setAllowReverse(Boolean(data.allowReverse));
      setSessionKeywords(data.sessionKeywords || []);
      setCurrentRoundIdx(data.currentRoundIdx || 0);
      setAttemptsUsedInRound(data.attemptsUsedInRound || 0);
      setUnlockedHintCount(data.unlockedHintCount || 0);
      setRevealedLetterIndices(data.revealedLetterIndices || []);
      setIsRoundResolved(Boolean(data.isRoundResolved));
      setWordGrid(data.wordGrid || null);
      setFoundWordIds(data.foundWordIds || []);
      setHintedWordIds(data.hintedWordIds || []);
      setClassScore(data.classScore || 0);
      setScoredKeywordIds(data.scoredKeywordIds || []);
      setTeams(data.teams || []);
      setActiveTeamIdx(data.activeTeamIdx || 0);
      setTurnLogs(data.turnLogs || []);

      const restoredSec = typeof data.remainingSeconds === 'number' ? data.remainingSeconds : 0;
      setRemainingSeconds(restoredSec);
      if (restoredSec > 0) {
        deadlineMsRef.current = Date.now() + restoredSec * 1000;
      } else {
        deadlineMsRef.current = null;
      }

      setInputAnswer('');
      setRoundOutcome(null);
      setGridSelectionStart(null);
      setGridSelectionCurrent(null);
      setHasRestorableSession(false);
      setPhase('PLAYING');
    } catch {
      clearSavedSessionStorage();
    }
  };

  // --------------------------------------------------------------------------
  // 5. CURRENT KEYWORD & SEGMENTATION HELPERS (DECODE MODE)
  // --------------------------------------------------------------------------
  const currentDecodeItem = useMemo<KeywordItemDefinition | null>(() => {
    if (sessionKeywords.length === 0) return null;
    return sessionKeywords[currentRoundIdx] || null;
  }, [sessionKeywords, currentRoundIdx]);

  const currentDecodeGraphemes = useMemo(() => {
    if (!currentDecodeItem) return [];
    const graphemes = segmentVietnameseGraphemes(currentDecodeItem.displayAnswer);
    return graphemes.map((char, index) => ({
      index,
      char,
      isSpace: char === ' ',
      isGuessable: isGuessableGrapheme(char),
    }));
  }, [currentDecodeItem]);

  // Calculate current potential points in Decode Mode before submitting
  const currentDecodePotentialPoints = useMemo(() => {
    if (unlockedHintCount === 0) return 30;
    if (unlockedHintCount === 1) return 20;
    return 10;
  }, [unlockedHintCount]);

  // Current actor label (Class / Team / Student)
  const currentActorLabel = useMemo(() => {
    if (orgMode === 'TEAMS' && teams[activeTeamIdx]) {
      return teams[activeTeamIdx].name;
    }
    if (orgMode === 'INDIVIDUAL' && activeStudent) {
      return activeStudent.fullName;
    }
    return `Cả lớp (${resolvedClassName})`;
  }, [orgMode, teams, activeTeamIdx, activeStudent, resolvedClassName]);

  // Pick a random student for Individual Mode
  const pickRandomNextStudent = useCallback(() => {
    if (!availableCandidates || availableCandidates.length === 0) {
      setActiveStudent(null);
      return;
    }
    const rand = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
    setActiveStudent(rand);
  }, [availableCandidates]);

  // --------------------------------------------------------------------------
  // 6. SESSION INITIALIZATION
  // --------------------------------------------------------------------------
  const handleStartSession = () => {
    const { validItems, warnings } = validatedSetupPool;
    setDatasetWarnings(warnings);

    const targetCount = playMode === 'DECODE_KEYWORD' ? decodeRoundCount : gridWordCount;
    if (validItems.length === 0) return;

    const actualCount = Math.min(targetCount, validItems.length);
    // Shuffle once at session start
    const shuffled = [...validItems].sort(() => Math.random() - 0.5).slice(0, actualCount);

    const newSessionId = `b09_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setSessionId(newSessionId);
    setSessionKeywords(shuffled);
    setCurrentRoundIdx(0);
    setInputAnswer('');
    setAttemptsUsedInRound(0);
    setUnlockedHintCount(0);
    setRevealedLetterIndices([]);
    setIsRoundResolved(false);
    setRoundOutcome(null);
    setFoundWordIds([]);
    setHintedWordIds([]);
    setActiveHintStartCoord(null);
    setGridSelectionStart(null);
    setGridSelectionCurrent(null);
    setLastSolvedGridWord(null);
    setGridFeedbackBanner(null);
    setClassScore(0);
    setScoredKeywordIds([]);
    setTurnLogs([]);
    setIndividualScores({});
    evaluatedTurnKeyRef.current = null;

    if (orgMode === 'TEAMS') {
      const builtTeams: B09TeamItem[] = Array.from({ length: teamCount }, (_, i) => ({
        id: `team_${i + 1}`,
        name: TEAM_PRESETS[i]?.name || `Đội ${i + 1}`,
        colorHex: TEAM_PRESETS[i]?.colorHex || '#006BFF',
        score: 0,
        solvedCount: 0,
        attempts: 0,
      }));
      setTeams(builtTeams);
      setActiveTeamIdx(0);
    } else {
      setTeams([]);
      setActiveTeamIdx(0);
    }

    if (orgMode === 'INDIVIDUAL') {
      pickRandomNextStudent();
    } else {
      setActiveStudent(null);
    }

    if (playMode === 'WORD_GRID_HUNT') {
      const generated = generateWordSearchGrid(shuffled, allowDiagonal, allowReverse);
      setWordGrid(generated);
      if (gridTimeSec > 0) {
        setRemainingSeconds(gridTimeSec);
        deadlineMsRef.current = Date.now() + gridTimeSec * 1000;
      } else {
        setRemainingSeconds(0);
        deadlineMsRef.current = null;
      }
    } else {
      setWordGrid(null);
      if (decodeTimeSec > 0) {
        setRemainingSeconds(decodeTimeSec);
        deadlineMsRef.current = Date.now() + decodeTimeSec * 1000;
      } else {
        setRemainingSeconds(0);
        deadlineMsRef.current = null;
      }
    }

    setPhase('PLAYING');
    b09Sound.playSelectTile(isMuted);
  };

  // --------------------------------------------------------------------------
  // 7. SCORE & TURN RECORDING HELPER (ANTI-DUPLICATE SCORING)
  // --------------------------------------------------------------------------
  const awardPointsOnce = useCallback(
    (keywordId: string, basePoints: number, actorTeamIdx: number, actorStudent: StudentCandidate | null): number => {
      if (basePoints <= 0) return 0;
      if (scoredKeywordIds.includes(keywordId)) {
        return 0;
      }

      setScoredKeywordIds((prev) => (prev.includes(keywordId) ? prev : [...prev, keywordId]));
      setClassScore((prev) => prev + basePoints);

      if (orgMode === 'TEAMS') {
        setTeams((prev) =>
          prev.map((t, idx) =>
            idx === actorTeamIdx
              ? { ...t, score: t.score + basePoints, solvedCount: t.solvedCount + 1 }
              : t
          )
        );
      } else if (orgMode === 'INDIVIDUAL' && actorStudent) {
        setIndividualScores((prev) => {
          const existing = prev[actorStudent.id] || {
            name: actorStudent.fullName,
            score: 0,
            solved: 0,
          };
          return {
            ...prev,
            [actorStudent.id]: {
              name: actorStudent.fullName,
              score: existing.score + basePoints,
              solved: existing.solved + 1,
            },
          };
        });
      }

      return basePoints;
    },
    [scoredKeywordIds, orgMode]
  );

  // Rotate team / student turn cleanly and wipe any unsubmitted draft input
  const advanceActorTurn = useCallback(() => {
    setGridSelectionStart(null);
    setGridSelectionCurrent(null);
    setIsPointerDraggingGrid(false);
    if (orgMode === 'TEAMS' && teams.length > 0) {
      setActiveTeamIdx((prev) => (prev + 1) % teams.length);
    } else if (orgMode === 'INDIVIDUAL') {
      pickRandomNextStudent();
    }
  }, [orgMode, teams.length, pickRandomNextStudent]);

  // --------------------------------------------------------------------------
  // 8. DECODE MODE ACTIONS (SUBMIT, HINTS, REVEAL, NEXT ROUND)
  // --------------------------------------------------------------------------
  const handleUnlockDecodeHint = () => {
    if (phase !== 'PLAYING' || isRoundResolved || !currentDecodeItem) return;
    if (unlockedHintCount >= 3) return;

    const nextHintLevel = unlockedHintCount + 1;
    setUnlockedHintCount(nextHintLevel);
    b09Sound.playSelectTile(isMuted);

    // 3rd hint: Reveal one unrevealed guessable character tile
    if (nextHintLevel === 3) {
      const unrevealedGuessable = currentDecodeGraphemes.filter(
        (g) => g.isGuessable && !revealedLetterIndices.includes(g.index)
      );
      if (unrevealedGuessable.length > 0) {
        const pick =
          unrevealedGuessable[Math.floor(Math.random() * unrevealedGuessable.length)];
        setRevealedLetterIndices((prev) => [...prev, pick.index]);
      }
    }
  };

  const handleDecodeSubmit = useCallback(() => {
    if (phase !== 'PLAYING' || isRoundResolved || !currentDecodeItem) return;
    if (isComposingRef.current) return;

    // Check deadline before accepting submission
    if (deadlineMsRef.current !== null && Date.now() > deadlineMsRef.current) {
      return;
    }

    const trimmed = normalizeVietnameseNFC(inputAnswer);
    if (!trimmed) return;

    const attemptNumber = attemptsUsedInRound + 1;
    const turnLockKey = `${sessionId}_round_${currentRoundIdx}_attempt_${attemptNumber}`;
    if (evaluatedTurnKeyRef.current === turnLockKey) return;
    evaluatedTurnKeyRef.current = turnLockKey;

    setPhase('EVALUATING');
    b09Sound.playSubmit(isMuted);

    const { isCorrect } = evaluateKeywordSubmission(trimmed, currentDecodeItem, acceptNoAccent);
    const actingTeamIdx = activeTeamIdx;
    const actingStudent = activeStudent;

    if (orgMode === 'TEAMS') {
      setTeams((prev) =>
        prev.map((t, idx) => (idx === actingTeamIdx ? { ...t, attempts: t.attempts + 1 } : t))
      );
    }

    if (isCorrect) {
      const awarded = awardPointsOnce(
        currentDecodeItem.id,
        currentDecodePotentialPoints,
        actingTeamIdx,
        actingStudent
      );
      setAttemptsUsedInRound(attemptNumber);
      setIsRoundResolved(true);
      deadlineMsRef.current = null;
      setRoundOutcome({
        status: 'CORRECT',
        message: `Chính xác! Từ khóa là “${currentDecodeItem.displayAnswer}” (+${awarded} điểm).`,
        pointsAwarded: awarded,
      });
      setTurnLogs((prev) => [
        {
          turnId: turnLockKey,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          mode: 'DECODE_KEYWORD',
          actorLabel: currentActorLabel,
          keywordDisplay: currentDecodeItem.displayAnswer,
          submittedText: trimmed,
          isCorrect: true,
          pointsAwarded: awarded,
          hintsUsed: unlockedHintCount,
        },
        ...prev,
      ]);
      b09Sound.playCorrect(isMuted);
      setPhase('FEEDBACK');
    } else {
      setAttemptsUsedInRound(attemptNumber);
      const reachedLimit = maxAttemptsPerRound > 0 && attemptNumber >= maxAttemptsPerRound;

      setTurnLogs((prev) => [
        {
          turnId: turnLockKey,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          mode: 'DECODE_KEYWORD',
          actorLabel: currentActorLabel,
          keywordDisplay: currentDecodeItem.displayAnswer,
          submittedText: trimmed,
          isCorrect: false,
          pointsAwarded: 0,
          hintsUsed: unlockedHintCount,
        },
        ...prev,
      ]);

      b09Sound.playWrong(isMuted);

      if (reachedLimit) {
        deadlineMsRef.current = null;
        setRoundOutcome({
          status: 'WRONG_RETRY',
          message: `Chưa chính xác. Đã hết ${maxAttemptsPerRound} lượt trả lời của vòng này. Giáo viên có thể bấm “Công bố đáp án”.`,
          pointsAwarded: 0,
        });
        setPhase('FEEDBACK');
      } else {
        setRoundOutcome({
          status: 'WRONG_RETRY',
          message:
            maxAttemptsPerRound > 0
              ? `Chưa chính xác! Hãy kiểm tra lại gợi ý (còn ${maxAttemptsPerRound - attemptNumber} lượt thử).`
              : `Chưa chính xác! Hãy đọc thêm gợi ý và thử lại.`,
          pointsAwarded: 0,
        });
        setPhase('PLAYING');
      }
    }
  }, [
    phase,
    isRoundResolved,
    currentDecodeItem,
    inputAnswer,
    attemptsUsedInRound,
    sessionId,
    currentRoundIdx,
    acceptNoAccent,
    activeTeamIdx,
    activeStudent,
    orgMode,
    awardPointsOnce,
    currentDecodePotentialPoints,
    currentActorLabel,
    unlockedHintCount,
    isMuted,
    maxAttemptsPerRound,
  ]);

  const handleTeacherRevealDecodeAnswer = () => {
    if (!currentDecodeItem || isRoundResolved) return;
    voiceManagerRef.current?.cancel();
    deadlineMsRef.current = null;
    setIsRoundResolved(true);
    setInputAnswer('');
    setRoundOutcome({
      status: 'REVEALED',
      message: `Công bố đáp án: “${currentDecodeItem.displayAnswer}” (0 điểm).`,
      pointsAwarded: 0,
    });
    setPhase('FEEDBACK');
    b09Sound.playSelectTile(isMuted);
  };

  const handleNextDecodeRound = () => {
    voiceManagerRef.current?.cancel();
    if (currentRoundIdx + 1 >= sessionKeywords.length) {
      deadlineMsRef.current = null;
      setPhase('FINISHED');
      clearSavedSessionStorage();
      b09Sound.playCelebration(isMuted);
      return;
    }

    // Rotate team/student and clear any draft input from previous actor
    advanceActorTurn();
    setCurrentRoundIdx((prev) => prev + 1);
    setInputAnswer('');
    setAttemptsUsedInRound(0);
    setUnlockedHintCount(0);
    setRevealedLetterIndices([]);
    setIsRoundResolved(false);
    setRoundOutcome(null);
    evaluatedTurnKeyRef.current = null;

    if (decodeTimeSec > 0) {
      setRemainingSeconds(decodeTimeSec);
      deadlineMsRef.current = Date.now() + decodeTimeSec * 1000;
    } else {
      setRemainingSeconds(0);
      deadlineMsRef.current = null;
    }

    setPhase('PLAYING');
  };

  // --------------------------------------------------------------------------
  // 9. WORD GRID HUNT MODE ACTIONS (SELECTION, VERIFICATION, HINT)
  // --------------------------------------------------------------------------
  const allowedGridDirs = useMemo(
    () => getAllowedDirections(allowDiagonal, allowReverse),
    [allowDiagonal, allowReverse]
  );

  const activeSelectionInfo = useMemo(() => {
    if (!gridSelectionStart || !gridSelectionCurrent) {
      return { coords: [] as GridCoord[], isValidDirection: true, previewToken: '' };
    }
    const line = computeStraightLineCoords(
      gridSelectionStart,
      gridSelectionCurrent,
      allowedGridDirs
    );
    const previewToken =
      wordGrid && line.isValidDirection
        ? line.coords.map((pt) => wordGrid.cells[pt.row]?.[pt.col] || '').join('')
        : '';
    return {
      coords: line.coords,
      isValidDirection: line.isValidDirection,
      previewToken,
    };
  }, [gridSelectionStart, gridSelectionCurrent, allowedGridDirs, wordGrid]);

  const commitGridSelection = useCallback(
    (startPt: GridCoord, endPt: GridCoord) => {
      if (!wordGrid || phase !== 'PLAYING') return;
      if (deadlineMsRef.current !== null && Date.now() > deadlineMsRef.current) return;

      const line = computeStraightLineCoords(startPt, endPt, allowedGridDirs);
      setGridSelectionStart(null);
      setGridSelectionCurrent(null);
      setIsPointerDraggingGrid(false);

      if (!line.isValidDirection || line.coords.length < 2) {
        if (!line.isValidDirection) {
          b09Sound.playWrong(isMuted);
          setGridFeedbackBanner({
            type: 'ERROR',
            text: 'Hướng chọn không hợp lệ! Chỉ chọn theo đường thẳng thuộc các hướng được phép.',
          });
        }
        return;
      }

      const selectedString = line.coords
        .map((c) => wordGrid.cells[c.row]?.[c.col] || '')
        .join('');

      // Check against all placed target words (matching exact token & valid straight-line coordinates)
      const matchedWord = wordGrid.placedWords.find((pw) => {
        if (pw.searchToken !== selectedString) return false;
        // Verify full coordinate match against any valid occurrence scanned on the grid
        return pw.validOccurrences.some(
          (occ) =>
            occ.length === line.coords.length &&
            occ.every(
              (pt, idx) =>
                pt.row === line.coords[idx].row && pt.col === line.coords[idx].col
            )
        );
      });

      const actingTeamIdx = activeTeamIdx;
      const actingStudent = activeStudent;

      if (matchedWord) {
        if (foundWordIds.includes(matchedWord.wordId)) {
          setGridFeedbackBanner({
            type: 'INFO',
            text: `Từ khóa “${matchedWord.displayAnswer}” đã được tìm thấy trước đó (không cộng điểm lại).`,
          });
          return;
        }

        const wasHinted = hintedWordIds.includes(matchedWord.wordId);
        const basePoints = wasHinted ? 5 : 10;
        const awarded = awardPointsOnce(
          matchedWord.wordId,
          basePoints,
          actingTeamIdx,
          actingStudent
        );

        const nextFound = [...foundWordIds, matchedWord.wordId];
        setFoundWordIds(nextFound);
        setLastSolvedGridWord(matchedWord);
        setActiveHintStartCoord(null);
        b09Sound.playCorrect(isMuted);

        setTurnLogs((prev) => [
          {
            turnId: `grid_${Date.now()}_${matchedWord.wordId}`,
            timestamp: new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            mode: 'WORD_GRID_HUNT',
            actorLabel: currentActorLabel,
            keywordDisplay: matchedWord.displayAnswer,
            submittedText: selectedString,
            isCorrect: true,
            pointsAwarded: awarded,
            hintsUsed: wasHinted ? 1 : 0,
          },
          ...prev,
        ]);

        setGridFeedbackBanner({
          type: 'SUCCESS',
          text: `Tuyệt vời! ${currentActorLabel} đã tìm thấy “${matchedWord.displayAnswer}” (+${awarded} điểm).`,
        });

        // Check if all words on the board are found
        if (nextFound.length >= wordGrid.placedWords.length) {
          deadlineMsRef.current = null;
          setTimeout(() => {
            setPhase('FINISHED');
            clearSavedSessionStorage();
            b09Sound.playCelebration(isMuted);
          }, 900);
        } else {
          advanceActorTurn();
        }
      } else {
        b09Sound.playWrong(isMuted);
        setTurnLogs((prev) => [
          {
            turnId: `grid_miss_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            mode: 'WORD_GRID_HUNT',
            actorLabel: currentActorLabel,
            keywordDisplay: '—',
            submittedText: selectedString,
            isCorrect: false,
            pointsAwarded: 0,
            hintsUsed: 0,
          },
          ...prev,
        ]);
        setGridFeedbackBanner({
          type: 'ERROR',
          text: `Chuỗi “${selectedString}” chưa phải từ khóa mục tiêu (0 điểm). Chuyển lượt tiếp theo!`,
        });
        advanceActorTurn();
      }
    },
    [
      wordGrid,
      phase,
      allowedGridDirs,
      activeTeamIdx,
      activeStudent,
      foundWordIds,
      hintedWordIds,
      awardPointsOnce,
      isMuted,
      currentActorLabel,
      clearSavedSessionStorage,
      advanceActorTurn,
    ]
  );

  // Trigger Hint in Grid Hunt Mode (Highlights first cell of an unfound word; reduces its reward to 5 pts)
  const handleTriggerGridHint = () => {
    if (!wordGrid || phase !== 'PLAYING') return;
    const unfound = wordGrid.placedWords.filter((pw) => !foundWordIds.includes(pw.wordId));
    if (unfound.length === 0) return;

    const target = unfound[0];
    const startPt = target.primaryCoords[0];
    if (!hintedWordIds.includes(target.wordId)) {
      setHintedWordIds((prev) => [...prev, target.wordId]);
    }
    setActiveHintStartCoord(startPt);
    b09Sound.playSelectTile(isMuted);
    setGridFeedbackBanner({
      type: 'INFO',
      text: `Gợi ý: Ô chữ đầu tiên của một từ khóa chưa mở đã phát sáng vàng (Hàng ${startPt.row + 1}, Cột ${startPt.col + 1}). Từ này khi tìm thấy sẽ nhận +5 điểm.`,
    });
  };

  // Map of cells belonging to found words (supports multiple intersecting words cleanly)
  const foundCellMap = useMemo(() => {
    const map = new Map<string, number>(); // key "r_c" -> count of found words intersecting
    if (!wordGrid) return map;
    for (const pw of wordGrid.placedWords) {
      if (!foundWordIds.includes(pw.wordId)) continue;
      for (const pt of pw.primaryCoords) {
        const key = `${pt.row}_${pt.col}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [wordGrid, foundWordIds]);

  const activeSelectedCellSet = useMemo(() => {
    const set = new Set<string>();
    for (const pt of activeSelectionInfo.coords) {
      set.add(`${pt.row}_${pt.col}`);
    }
    return set;
  }, [activeSelectionInfo.coords]);

  // --------------------------------------------------------------------------
  // 10. DEADLINE-BASED TIMER & PAUSE / RESUME MANAGEMENT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'PLAYING' || deadlineMsRef.current === null) return;

    const tick = () => {
      if (deadlineMsRef.current === null) return;
      const diffMs = deadlineMsRef.current - Date.now();
      if (diffMs <= 0) {
        setRemainingSeconds(0);
        deadlineMsRef.current = null;

        // Handle timeout cleanly without conflicting with simultaneous submit
        if (playMode === 'DECODE_KEYWORD') {
          const timeoutLockKey = `${sessionId}_round_${currentRoundIdx}_timeout`;
          if (evaluatedTurnKeyRef.current !== timeoutLockKey && !isRoundResolved) {
            evaluatedTurnKeyRef.current = timeoutLockKey;
            b09Sound.playWrong(isMuted);
            setRoundOutcome({
              status: 'TIMEOUT',
              message:
                'Đã hết thời gian suy nghĩ cho vòng này! Giáo viên có thể bấm “Công bố đáp án” hoặc chuyển vòng.',
              pointsAwarded: 0,
            });
            setPhase('FEEDBACK');
          }
        } else {
          b09Sound.playCelebration(isMuted);
          setPhase('FINISHED');
          clearSavedSessionStorage();
        }
      } else {
        setRemainingSeconds(Math.ceil(diffMs / 1000));
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [
    phase,
    playMode,
    sessionId,
    currentRoundIdx,
    isRoundResolved,
    isMuted,
    clearSavedSessionStorage,
  ]);

  const handlePauseSession = useCallback(() => {
    if (phase === 'SETUP' || phase === 'FINISHED' || phase === 'PAUSED') return;
    voiceManagerRef.current?.cancel();
    phaseBeforePauseRef.current = phase;
    if (deadlineMsRef.current !== null) {
      pausedRemainingMsRef.current = Math.max(0, deadlineMsRef.current - Date.now());
      deadlineMsRef.current = null;
    } else {
      pausedRemainingMsRef.current = null;
    }
    setPhase('PAUSED');
  }, [phase]);

  const handleResumeSession = useCallback(() => {
    if (phase !== 'PAUSED') return;
    if (pausedRemainingMsRef.current !== null && pausedRemainingMsRef.current > 0) {
      deadlineMsRef.current = Date.now() + pausedRemainingMsRef.current;
      setRemainingSeconds(Math.ceil(pausedRemainingMsRef.current / 1000));
    }
    pausedRemainingMsRef.current = null;
    setPhase(phaseBeforePauseRef.current || 'PLAYING');
  }, [phase]);

  // Opening guide modal during active play automatically pauses the timer
  const handleOpenGuide = () => {
    if (phase === 'PLAYING' || phase === 'FEEDBACK') {
      handlePauseSession();
    }
    setShowGuideModal(true);
  };

  // --------------------------------------------------------------------------
  // 11. VIETNAMESE VOICE READER (CLUE ONLY — NEVER READS HIDDEN ANSWER)
  // --------------------------------------------------------------------------
  const handleSpeakClue = (clueText: string, topicLabel?: string) => {
    const vm = voiceManagerRef.current;
    if (!vm) return;
    const cleanClue = clueText.replace(/\$+/g, '').trim();
    const spoken = topicLabel
      ? `Gợi ý chủ đề ${topicLabel}: ${cleanClue}`
      : `Gợi ý: ${cleanClue}`;
    const outcome = vm.speakVietnamese(spoken, isMuted);
    if (!outcome.spoken) {
      if (outcome.reason === 'muted_or_disabled') {
        setVoiceNotice('Âm thanh đang tắt. Hãy bật loa trên thanh điều khiển để đọc gợi ý.');
      } else {
        setVoiceNotice(
          'Trình duyệt hiện chưa có giọng đọc tiếng Việt (vi-VN). Học sinh vẫn có thể đọc gợi ý trực tiếp trên màn hình.'
        );
      }
      setTimeout(() => setVoiceNotice(null), 3500);
    } else {
      setVoiceNotice(null);
    }
  };

  // --------------------------------------------------------------------------
  // 12. CUSTOM KEYWORD BUILDER HANDLER
  // --------------------------------------------------------------------------
  const handleAddCustomKeyword = () => {
    setCustomEditorError(null);
    const ans = normalizeVietnameseNFC(newCustomAnswer).toUpperCase();
    const clue = normalizeVietnameseNFC(newCustomClue);
    const token = toGridSearchToken(ans);

    if (!ans || !clue) {
      setCustomEditorError('Vui lòng nhập đầy đủ Từ khóa chuẩn (có dấu) và Câu gợi ý.');
      return;
    }
    if (token.length < 2 || token.length > 12) {
      setCustomEditorError('Từ khóa cần có từ 2 đến 12 chữ cái (không tính khoảng trắng).');
      return;
    }
    if (customItems.some((it) => it.searchToken === token)) {
      setCustomEditorError(
        `Từ khóa "${ans}" tạo chuỗi không dấu "${token}" trùng với một từ đã có trong danh sách.`
      );
      return;
    }

    const acceptedList = newCustomAccepted
      .split(',')
      .map((s) => normalizeVietnameseNFC(s))
      .filter(Boolean);

    const newItem: KeywordItemDefinition = {
      id: `b09_custom_${Date.now()}`,
      displayAnswer: ans,
      acceptedAnswers: acceptedList.length > 0 ? acceptedList : [ans],
      clue,
      hints: [
        normalizeVietnameseNFC(newCustomHint1) || `Từ khóa gồm ${token.length} chữ cái.`,
        normalizeVietnameseNFC(newCustomHint2) || `Chữ cái đầu tiên là "${ans.charAt(0)}".`,
      ],
      explanation:
        normalizeVietnameseNFC(newCustomExplanation) || `Từ khóa chính xác là "${ans}": ${clue}`,
      searchToken: token,
      topicTag: 'Tự soạn',
      isSample: false,
    };

    setCustomItems((prev) => [...prev, newItem]);
    setNewCustomAnswer('');
    setNewCustomAccepted('');
    setNewCustomClue('');
    setNewCustomHint1('');
    setNewCustomHint2('');
    setNewCustomExplanation('');
  };

  // --------------------------------------------------------------------------
  // 13. LEADERBOARD WITH TIE-RANKING ("ĐỒNG HẠNG")
  // --------------------------------------------------------------------------
  const rankedTeams = useMemo(() => {
    if (teams.length === 0) return [];
    const sorted = [...teams].sort((a, b) => b.score - a.score || b.solvedCount - a.solvedCount);
    return sorted.map((team, idx) => {
      const sameScoreCount = sorted.filter((t) => t.score === team.score).length;
      const firstIndexWithScore = sorted.findIndex((t) => t.score === team.score);
      return {
        ...team,
        rank: firstIndexWithScore + 1,
        isTied: sameScoreCount > 1,
        displayIdx: idx,
      };
    });
  }, [teams]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ==========================================================================
  // RENDER: 3D STAGE HEADER & MAIN VIEWPORT
  // ==========================================================================
  return (
    <div className="relative w-full min-h-[680px] rounded-3xl bg-gradient-to-b from-[#061229] via-[#0B1E40] to-[#08152E] text-white border-2 border-cyan-400/40 shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col select-none">
      {/* 3D Ambient Lighting & Subtle Perspective Grid Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -left-24 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute top-1/4 -right-24 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(56,189,248,0.35) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* TOP NAVIGATION BAR */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#07152E]/90 backdrop-blur-md border-b border-cyan-400/25">
        <div className="flex items-center gap-3">
          {onCloseGame && (
            <button
              type="button"
              onClick={() => {
                if (phase !== 'SETUP' && phase !== 'FINISHED') {
                  setConfirmExitModal('LIBRARY');
                } else {
                  voiceManagerRef.current?.cancel();
                  onCloseGame();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>← Quay lại</span>
            </button>
          )}

          {/* 3D Magnifier & Crystal Emblem SVG */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-800 p-0.5 shadow-[0_0_20px_rgba(34,211,238,0.35)] shrink-0">
            <div className="w-full h-full rounded-[14px] bg-[#081A38] flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-6 h-6">
                <defs>
                  <linearGradient id="b09Lens" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#2563EB" />
                  </linearGradient>
                  <linearGradient id="b09Gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FDE047" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                </defs>
                <circle cx="16" cy="16" r="9" fill="url(#b09Lens)" fillOpacity="0.3" stroke="url(#b09Lens)" strokeWidth="3" />
                <line x1="22.5" y1="22.5" x2="30" y2="30" stroke="url(#b09Gold)" strokeWidth="3.5" strokeLinecap="round" />
                <polygon points="16,10 18,14 22,14.5 19,17.5 19.8,21.5 16,19.5 12.2,21.5 13,17.5 10,14.5 14,14" fill="url(#b09Gold)" />
              </svg>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/50 text-amber-300 text-[11px] font-black tracking-wider">
                B09
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Tìm từ khóa · Trạm Giải Mã Tri Thức 3D
              </h2>
            </div>
            <p className="text-[11px] text-cyan-200/80 font-medium hidden sm:block">
              Nhóm B: Khởi động tiết học · {playMode === 'DECODE_KEYWORD' ? 'Chế độ 1: Giải mã từ khóa' : 'Chế độ 2: Săn từ trên bảng chữ'}
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dataset source badge */}
          {(datasetKey === 'SAMPLE_MATH' || datasetKey === 'SAMPLE_INFORMATICS') && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-extrabold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Dữ liệu mẫu</span>
            </span>
          )}

          {phase !== 'SETUP' && phase !== 'FINISHED' && (
            <>
              <button
                type="button"
                onClick={phase === 'PAUSED' ? handleResumeSession : handlePauseSession}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  phase === 'PAUSED'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-amber-200 border-amber-400/30'
                }`}
              >
                {phase === 'PAUSED' ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{phase === 'PAUSED' ? 'Tiếp tục' : 'Tạm dừng'}</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmExitModal('SETUP')}
                className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thiết lập lại</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleOpenGuide}
            className="px-3 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-800/80 text-cyan-200 border border-cyan-400/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Hướng dẫn</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                : 'bg-cyan-950/70 border-cyan-400/40 text-cyan-200 hover:bg-cyan-900/70'
            }`}
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600/60 text-slate-200 cursor-pointer"
              title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </header>

      {/* Voice Notice Toast */}
      {voiceNotice && (
        <div className="relative z-30 mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-100 text-xs font-bold flex items-center justify-between gap-3">
          <span>{voiceNotice}</span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="text-amber-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 1: SETUP SCREEN                                                */}
      {/* ==================================================================== */}
      {phase === 'SETUP' && (
        <div className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          {/* Restorable Session Banner */}
          {hasRestorableSession && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-900/70 via-blue-900/70 to-indigo-900/70 border border-cyan-400/50 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-cyan-300 shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-white">
                    Phát hiện phiên chơi B09 đang tạm dừng trước đó
                  </p>
                  <p className="text-xs text-cyan-200/90">
                    Giáo viên có thể khôi phục nguyên trạng bảng chữ, vòng chơi và điểm số hoặc bắt đầu phiên mới.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestoreSavedSession}
                  className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black transition-all cursor-pointer"
                >
                  Khôi phục phiên
                </button>
                <button
                  type="button"
                  onClick={clearSavedSessionStorage}
                  className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          )}

          {/* Setup Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Play Mode & Dataset Selection */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Choose Play Mode */}
              <div className="p-5 rounded-3xl bg-[#0B2144]/85 border border-cyan-400/25 shadow-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-300" />
                    <span>1. Chọn chế độ Tìm từ khóa</span>
                  </h3>
                  <span className="text-[11px] font-bold text-slate-300">
                    2 chế độ chuẩn sư phạm THCS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setPlayMode('DECODE_KEYWORD')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      playMode === 'DECODE_KEYWORD'
                        ? 'bg-gradient-to-br from-blue-600/40 to-cyan-500/25 border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.25)]'
                        : 'bg-slate-900/60 border-slate-700/70 hover:border-slate-500'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md bg-cyan-400/20 text-cyan-300 text-[11px] font-black">
                          MẶC ĐỊNH KHỞI ĐỘNG
                        </span>
                        <KeyRound className="w-5 h-5 text-cyan-300" />
                      </div>
                      <h4 className="text-base font-black text-white">
                        Chế độ 1: Giải mã từ khóa
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Đọc gợi ý, quan sát số ô chữ cái, mở tối đa 3 gợi ý phụ và chốt đáp án. Rèn tư duy khái niệm nhanh 3–5 phút.
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span>30 / 20 / 10 điểm mỗi vòng</span>
                      <span>Tối đa 3 gợi ý</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlayMode('WORD_GRID_HUNT')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      playMode === 'WORD_GRID_HUNT'
                        ? 'bg-gradient-to-br from-blue-600/40 to-cyan-500/25 border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.25)]'
                        : 'bg-slate-900/60 border-slate-700/70 hover:border-slate-500'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[11px] font-black">
                          BẢNG CHỮ 3D
                        </span>
                        <Grid className="w-5 h-5 text-amber-300" />
                      </div>
                      <h4 className="text-base font-black text-white">
                        Chế độ 2: Săn từ trên bảng chữ
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Tinh mắt tìm các từ khóa ẩn trên bảng phím 3D (8×8 đến 12×12) theo gợi ý. Hỗ trợ kéo chuột, chạm 2 điểm và bàn phím.
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-bold text-cyan-300">
                      <span>+10 điểm / từ (+5 nếu gợi ý)</span>
                      <span>Ngang / Dọc chuẩn</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Choose Knowledge Dataset */}
              <div className="p-5 rounded-3xl bg-[#0B2144]/85 border border-cyan-400/25 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-300" />
                    <span>2. Nguồn bộ từ khóa</span>
                  </h3>
                  <span className="text-xs font-bold text-emerald-300">
                    Hợp lệ: {validatedSetupPool.validItems.length} từ khóa
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDatasetKey('SAMPLE_MATH')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      datasetKey === 'SAMPLE_MATH'
                        ? 'bg-blue-600/35 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-300">BỘ MẪU A · DỮ LIỆU MẪU</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/10">8 từ</span>
                    </div>
                    <p className="text-sm font-extrabold text-white mt-1">Toán THCS (Lớp 6–9)</p>
                    <p className="text-[11px] text-slate-300 mt-0.5 truncate">
                      Tập hợp, Số nguyên, Phân số, Tam giác, Chu vi, Diện tích, Góc vuông, Đối xứng
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDatasetKey('SAMPLE_INFORMATICS')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      datasetKey === 'SAMPLE_INFORMATICS'
                        ? 'bg-blue-600/35 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-cyan-300">BỘ MẪU B · DỮ LIỆU MẪU</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/10">8 từ</span>
                    </div>
                    <p className="text-sm font-extrabold text-white mt-1">Tin học THCS</p>
                    <p className="text-[11px] text-slate-300 mt-0.5 truncate">
                      Thông tin, Dữ liệu, Bàn phím, Màn hình, Thuật toán, Internet, Tệp, Thư mục
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDatasetKey('QUESTION_BANK')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      datasetKey === 'QUESTION_BANK'
                        ? 'bg-blue-600/35 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-300">NGÂN HÀNG HỆ THỐNG</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/10">
                        {questionBankKeywords.length} từ
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-white mt-1">Trích xuất từ Ngân hàng câu hỏi</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Lọc các câu hỏi có đáp án thuật ngữ ngắn gọn (2–12 chữ cái)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDatasetKey('CUSTOM')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      datasetKey === 'CUSTOM'
                        ? 'bg-blue-600/35 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-300">GIÁO VIÊN TỰ SOẠN</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/10">
                        {customItems.length} từ
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-white mt-1">Bộ từ khóa tùy chỉnh</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Thêm từ khóa, biến thể chấp nhận, gợi ý và giải thích riêng
                    </p>
                  </button>
                </div>

                {/* Custom Keyword Builder Panel */}
                {datasetKey === 'CUSTOM' && (
                  <div className="p-4 rounded-2xl bg-slate-950/75 border border-cyan-400/30 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                      Thêm từ khóa mới vào bộ tự soạn
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={newCustomAnswer}
                        onChange={(e) => setNewCustomAnswer(e.target.value)}
                        placeholder="Từ khóa chuẩn có dấu (VD: SỐ HỮU TỈ)"
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                      <input
                        type="text"
                        value={newCustomAccepted}
                        onChange={(e) => setNewCustomAccepted(e.target.value)}
                        placeholder="Biến thể chấp nhận, cách bởi dấu phẩy (tùy chọn)"
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <input
                      type="text"
                      value={newCustomClue}
                      onChange={(e) => setNewCustomClue(e.target.value)}
                      placeholder="Câu gợi ý chính cho học sinh..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={newCustomHint1}
                        onChange={(e) => setNewCustomHint1(e.target.value)}
                        placeholder="Gợi ý phụ 1 (thông tin bổ sung)"
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                      <input
                        type="text"
                        value={newCustomHint2}
                        onChange={(e) => setNewCustomHint2(e.target.value)}
                        placeholder="Gợi ý phụ 2 (ví dụ gần gũi)"
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    {customEditorError && (
                      <p className="text-xs font-bold text-rose-400">{customEditorError}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Chuỗi bảng chữ tự động: <strong className="text-cyan-300">{toGridSearchToken(newCustomAnswer) || '—'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleAddCustomKeyword}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm từ khóa</span>
                      </button>
                    </div>

                    {/* Existing custom items list */}
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pt-2 border-t border-slate-800">
                      {customItems.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                        >
                          <div className="truncate">
                            <span className="font-black text-amber-300">{it.displayAnswer}</span>
                            <span className="text-slate-400 ml-2">({it.searchToken})</span>
                            <span className="text-slate-300 ml-2">— {it.clue}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomItems((prev) => prev.filter((x) => x.id !== it.id))
                            }
                            className="text-rose-400 hover:text-rose-300 shrink-0 cursor-pointer"
                            title="Xóa từ khóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dataset Preview List */}
                <div className="p-3.5 rounded-2xl bg-slate-950/55 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Danh sách từ khóa sẵn sàng trong bộ đang chọn:</span>
                    <span className="text-cyan-300">{validatedSetupPool.validItems.length} mục</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {validatedSetupPool.validItems.map((item) => (
                      <span
                        key={item.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-xs font-bold text-slate-200"
                      >
                        {item.displayAnswer}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Rules, Organization, Timer & Launch */}
            <div className="lg:col-span-5 space-y-5">
              <div className="p-5 rounded-3xl bg-[#0B2144]/85 border border-cyan-400/25 shadow-xl space-y-4">
                <h3 className="text-sm sm:text-base font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-300" />
                  <span>3. Cấu hình tổ chức lớp & Luật chơi</span>
                </h3>

                {/* Organization Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Hình thức tổ chức lớp học:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'CLASS' as B09OrgMode, label: 'Cả lớp chung' },
                      { key: 'TEAMS' as B09OrgMode, label: 'Thi đấu Đội (2–6)' },
                      { key: 'INDIVIDUAL' as B09OrgMode, label: 'Gọi Cá nhân' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setOrgMode(opt.key)}
                        className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                          orgMode === opt.key
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow'
                            : 'bg-slate-900/70 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {orgMode === 'TEAMS' && (
                    <div className="pt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300 font-bold">Số đội tham gia:</span>
                      <div className="flex items-center gap-1.5">
                        {[2, 3, 4, 5, 6].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setTeamCount(cnt)}
                            className={`w-8 h-8 rounded-lg text-xs font-black border cursor-pointer ${
                              teamCount === cnt
                                ? 'bg-amber-400 text-slate-950 border-amber-200'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mode-specific parameters */}
                {playMode === 'DECODE_KEYWORD' ? (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">Số vòng giải mã:</span>
                      <div className="flex items-center gap-1.5">
                        {[3, 5, 6, 8].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setDecodeRoundCount(n)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black border cursor-pointer ${
                              decodeRoundCount === n
                                ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {n} vòng
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">Thời gian mỗi vòng:</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { sec: 30, label: '30s' },
                          { sec: 45, label: '45s' },
                          { sec: 60, label: '60s' },
                          { sec: 0, label: 'Không giới hạn' },
                        ].map((t) => (
                          <button
                            key={t.sec}
                            type="button"
                            onClick={() => setDecodeTimeSec(t.sec)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-black border cursor-pointer ${
                              decodeTimeSec === t.sec
                                ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">Giới hạn số lần trả lời/vòng:</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { val: 1, label: '1 lần' },
                          { val: 2, label: '2 lần (Mặc định)' },
                          { val: 3, label: '3 lần' },
                          { val: 0, label: 'Không giới hạn' },
                        ].map((m) => (
                          <button
                            key={m.val}
                            type="button"
                            onClick={() => setMaxAttemptsPerRound(m.val)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-black border cursor-pointer ${
                              maxAttemptsPerRound === m.val
                                ? 'bg-amber-400 text-slate-950 border-amber-200'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">Số từ khóa trên bảng chữ:</span>
                      <div className="flex items-center gap-1.5">
                        {[4, 5, 6, 8].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setGridWordCount(n)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black border cursor-pointer ${
                              gridWordCount === n
                                ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {n} từ
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">Thời gian cả bảng chữ:</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { sec: 120, label: '2 phút' },
                          { sec: 180, label: '3 phút' },
                          { sec: 300, label: '5 phút' },
                          { sec: 0, label: 'Không giới hạn' },
                        ].map((t) => (
                          <button
                            key={t.sec}
                            type="button"
                            onClick={() => setGridTimeSec(t.sec)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-black border cursor-pointer ${
                              gridTimeSec === t.sec
                                ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Advanced Grid Direction Toggles (Off by default) */}
                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/80 space-y-2">
                      <p className="text-[11px] font-bold text-amber-300">
                        Hướng đặt từ nâng cao (Mặc định chỉ Ngang trái→phải & Dọc trên→dưới):
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowDiagonal}
                            onChange={(e) => setAllowDiagonal(e.target.checked)}
                            className="rounded accent-cyan-400"
                          />
                          <span>Cho phép Đường chéo (↘, ↗)</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowReverse}
                            onChange={(e) => setAllowReverse(e.target.checked)}
                            className="rounded accent-cyan-400"
                          />
                          <span>Cho phép Chiều đảo ngược (←, ↑)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vietnamese Diacritic & Motion Toggles */}
                <div className="pt-2 border-t border-white/10 space-y-2.5">
                  <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/70 border border-slate-700/80 cursor-pointer">
                    <div>
                      <p className="text-xs font-extrabold text-white">
                        Chấp nhận đáp án không dấu (bao gồm đ/Đ → d)
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Mặc định tắt để rèn chuẩn chính tả tiếng Việt; bật khi máy chiếu không thuận tiện gõ dấu.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={acceptNoAccent}
                      onChange={(e) => setAcceptNoAccent(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400 shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/70 border border-slate-700/80 cursor-pointer">
                    <div>
                      <p className="text-xs font-extrabold text-white">
                        Giảm chuyển động 3D (Reduce Motion)
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Tối ưu cho máy cấu hình nhẹ hoặc màn hình tương tác lớp học.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={reduceMotion}
                      onChange={(e) => setReduceMotion(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400 shrink-0"
                    />
                  </label>
                </div>

                {/* Insufficient dataset warning if teacher requested more items than available */}
                {validatedSetupPool.validItems.length <
                  (playMode === 'DECODE_KEYWORD' ? decodeRoundCount : gridWordCount) && (
                  <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      Bộ dữ liệu hiện có {validatedSetupPool.validItems.length} từ khóa hợp lệ. Hệ thống sẽ điều chỉnh quy mô phiên chơi về {validatedSetupPool.validItems.length} từ (không tự lặp lại từ).
                    </div>
                  </div>
                )}

                {/* Launch Button */}
                <button
                  type="button"
                  disabled={validatedSetupPool.validItems.length === 0}
                  onClick={handleStartSession}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-base shadow-[0_10px_30px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>
                    BẮT ĐẦU KHỞI ĐỘNG ({Math.min(
                      validatedSetupPool.validItems.length,
                      playMode === 'DECODE_KEYWORD' ? decodeRoundCount : gridWordCount
                    )}{' '}
                    {playMode === 'DECODE_KEYWORD' ? 'VÒNG GIẢI MÃ' : 'TỪ KHÓA BẢNG CHỮ'})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 2: ACTIVE GAMEPLAY (DECODE MODE OR WORD GRID HUNT MODE)        */}
      {/* ==================================================================== */}
      {(phase === 'PLAYING' || phase === 'EVALUATING' || phase === 'FEEDBACK' || phase === 'PAUSED') && (
        <div className="relative z-10 flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start overflow-y-auto">
          {/* ================================================================ */}
          {/* CENTER STAGE (8 COLUMNS ON DESKTOP)                              */}
          {/* ================================================================ */}
          <div className="lg:col-span-8 space-y-4">
            {/* Top Status Strip: Current Actor, Round/Progress, Timer */}
            <div className="p-3.5 rounded-2xl bg-[#091D3E]/90 border border-cyan-400/30 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-black">
                  {playMode === 'DECODE_KEYWORD'
                    ? `Vòng ${currentRoundIdx + 1} / ${sessionKeywords.length}`
                    : `Đã tìm: ${foundWordIds.length} / ${wordGrid?.placedWords.length || 0} từ`}
                </span>

                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-extrabold text-white">
                  <Users className="w-3.5 h-3.5 text-amber-300" />
                  <span>Lượt:</span>
                  <span className="text-amber-300">{currentActorLabel}</span>
                </div>

                {acceptNoAccent && (
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
                    Chấp nhận không dấu: BẬT
                  </span>
                )}
              </div>

              {/* Timer Badge */}
              <div className="flex items-center gap-2">
                {(playMode === 'DECODE_KEYWORD' ? decodeTimeSec > 0 : gridTimeSec > 0) ? (
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border font-black text-sm flex items-center gap-1.5 ${
                      remainingSeconds <= 10
                        ? 'bg-rose-600/30 border-rose-400 text-rose-200 animate-pulse'
                        : 'bg-slate-900/90 border-cyan-400/40 text-cyan-200'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-amber-300" />
                    <span>{formatTimer(remainingSeconds)}</span>
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-bold text-slate-300">
                    Không giới hạn giờ
                  </span>
                )}
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* MODE 1 STAGE: DECODE KEYWORD (GIẢI MÃ TỪ KHÓA)                 */}
            {/* -------------------------------------------------------------- */}
            {playMode === 'DECODE_KEYWORD' && currentDecodeItem && (
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-[#0D2652]/95 to-[#081938]/95 border-2 border-cyan-400/35 shadow-2xl space-y-6">
                {/* Clue Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-blue-500/25 border border-blue-400/40 text-cyan-200 text-xs font-extrabold">
                      {currentDecodeItem.topicTag || 'Khái niệm trọng tâm'}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-300/50 text-amber-300 text-xs font-black">
                      Điểm hiện có: +{currentDecodePotentialPoints} điểm
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSpeakClue(currentDecodeItem.clue, currentDecodeItem.topicTag)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-300/40 text-cyan-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                      <span>Đọc gợi ý</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomedContent({
                          title: `Gợi ý vòng ${currentRoundIdx + 1}`,
                          body: currentDecodeItem.clue,
                        })
                      }
                      className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
                      title="Phóng to gợi ý"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Clue Box */}
                <div className="p-5 rounded-2xl bg-[#07152E]/90 border border-cyan-300/30 shadow-inner">
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1.5">
                    Gợi ý ban đầu:
                  </p>
                  <div className="text-lg sm:text-xl font-extrabold text-white leading-relaxed">
                    <MathView content={currentDecodeItem.clue} />
                  </div>
                </div>

                {/* 3D Keycap Tiles Representing Answer Length */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-cyan-200/90">
                    <span>
                      Ô chữ từ khóa ({currentDecodeGraphemes.filter((g) => g.isGuessable).length} chữ cái):
                    </span>
                    <span className="text-slate-400">
                      Khoảng trắng tách giữa các từ · Đếm chuẩn theo kí tự tiếng Việt
                    </span>
                  </div>

                  <div
                    className="p-4 sm:p-5 rounded-2xl bg-[#051024]/90 border border-blue-400/25 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 min-h-[92px]"
                    aria-label={
                      isRoundResolved
                        ? `Từ khóa đã mở: ${currentDecodeItem.displayAnswer}`
                        : `Từ khóa gồm ${currentDecodeGraphemes.filter((g) => g.isGuessable).length} chữ cái đang ẩn`
                    }
                  >
                    {currentDecodeGraphemes.map((g) => {
                      if (g.isSpace) {
                        return (
                          <div
                            key={`space_${g.index}`}
                            className="w-4 sm:w-6 h-12 shrink-0"
                            aria-hidden="true"
                          />
                        );
                      }

                      const isShown =
                        isRoundResolved ||
                        !g.isGuessable ||
                        revealedLetterIndices.includes(g.index);

                      return (
                        <div
                          key={`tile_${g.index}`}
                          className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl flex items-center justify-center font-black text-lg sm:text-xl transition-all ${
                            isRoundResolved
                              ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 border-2 border-emerald-200 shadow-[0_4px_0_#065F46,0_0_20px_rgba(16,185,129,0.4)]'
                              : isShown
                              ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-2 border-amber-100 shadow-[0_4px_0_#92400E]'
                              : 'bg-gradient-to-b from-[#163466] to-[#0D2144] text-cyan-200 border-2 border-cyan-400/40 shadow-[0_5px_0_#071226]'
                          }`}
                        >
                          {isShown ? g.char : '?'}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Supplemental Hints (Up to 3) */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4" />
                      <span>Gợi ý bổ sung (Đã dùng: {unlockedHintCount}/3)</span>
                    </span>
                    {!isRoundResolved && unlockedHintCount < 3 && (
                      <button
                        type="button"
                        onClick={handleUnlockDecodeHint}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/50 text-amber-200 text-xs font-extrabold transition-all cursor-pointer"
                      >
                        {unlockedHintCount === 0 && '+ Mở Gợi ý 1 (Điểm vòng còn 20đ)'}
                        {unlockedHintCount === 1 && '+ Mở Gợi ý 2 (Điểm vòng còn 10đ)'}
                        {unlockedHintCount === 2 && '+ Mở 1 chữ cái trên ô chữ (Giữ mức 10đ)'}
                      </button>
                    )}
                  </div>

                  {unlockedHintCount > 0 && (
                    <div className="grid grid-cols-1 gap-2">
                      {unlockedHintCount >= 1 && (
                        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-100">
                          <strong className="text-amber-300">Gợi ý bổ sung 1: </strong>
                          {currentDecodeItem.hints[0]}
                        </div>
                      )}
                      {unlockedHintCount >= 2 && (
                        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-100">
                          <strong className="text-amber-300">Gợi ý bổ sung 2: </strong>
                          {currentDecodeItem.hints[1]}
                        </div>
                      )}
                      {unlockedHintCount >= 3 && (
                        <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-xs text-cyan-100">
                          <strong className="text-cyan-300">Gợi ý bổ sung 3: </strong>
                          Đã mở 1 chữ cái trực tiếp trên hàng ô chữ phía trên!
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Answer Input & Submit Bar (Protected against Vietnamese IME premature Enter) */}
                {!isRoundResolved && (
                  <div className="pt-2 space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <input
                        type="text"
                        value={inputAnswer}
                        disabled={
                          phase !== 'PLAYING' ||
                          (maxAttemptsPerRound > 0 && attemptsUsedInRound >= maxAttemptsPerRound)
                        }
                        onCompositionStart={() => {
                          isComposingRef.current = true;
                        }}
                        onCompositionEnd={() => {
                          isComposingRef.current = false;
                        }}
                        onChange={(e) => setInputAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' &&
                            !isComposingRef.current &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            handleDecodeSubmit();
                          }
                        }}
                        placeholder="Nhập từ khóa đáp án tại đây..."
                        className="flex-1 px-4 py-3.5 rounded-2xl bg-[#061229] border-2 border-cyan-400/50 focus:border-amber-300 text-base sm:text-lg font-extrabold text-white placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
                      />

                      <button
                        type="button"
                        disabled={
                          phase !== 'PLAYING' ||
                          !normalizeVietnameseNFC(inputAnswer) ||
                          (maxAttemptsPerRound > 0 && attemptsUsedInRound >= maxAttemptsPerRound)
                        }
                        onClick={handleDecodeSubmit}
                        className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-sm sm:text-base shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0"
                      >
                        <Check className="w-5 h-5" />
                        <span>Chốt đáp án</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 font-medium">
                      <span>
                        Số lượt đã thử:{' '}
                        <strong className="text-white">
                          {attemptsUsedInRound} / {maxAttemptsPerRound === 0 ? '∞' : maxAttemptsPerRound}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleTeacherRevealDecodeAnswer}
                        className="text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Giáo viên công bố đáp án</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Feedback & Pedagogical Explanation Box */}
                {roundOutcome && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`p-4 sm:p-5 rounded-2xl border-2 space-y-3 ${
                      roundOutcome.status === 'CORRECT'
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100'
                        : roundOutcome.status === 'WRONG_RETRY' && !isRoundResolved
                        ? 'bg-rose-950/75 border-rose-400/80 text-rose-100'
                        : 'bg-amber-950/80 border-amber-400 text-amber-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                        {roundOutcome.status === 'CORRECT' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-amber-400 shrink-0" />
                        )}
                        <span>{roundOutcome.message}</span>
                      </div>

                      {!isRoundResolved && (
                        <button
                          type="button"
                          onClick={handleTeacherRevealDecodeAnswer}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                        >
                          Công bố đáp án
                        </button>
                      )}
                    </div>

                    {isRoundResolved && (
                      <div className="pt-2 border-t border-white/15 space-y-3">
                        <div className="text-xs sm:text-sm text-white/95 leading-relaxed">
                          <strong className="text-cyan-300">Giải thích kiến thức: </strong>
                          <MathView content={currentDecodeItem.explanation} />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleNextDecodeRound}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <span>
                              {currentRoundIdx + 1 >= sessionKeywords.length
                                ? 'Tổng kết phiên chơi'
                                : 'Vòng tiếp theo'}
                            </span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* MODE 2 STAGE: WORD GRID HUNT (SĂN TỪ TRÊN BẢNG CHỮ)            */}
            {/* -------------------------------------------------------------- */}
            {playMode === 'WORD_GRID_HUNT' && wordGrid && (
              <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-b from-[#0D2652]/95 to-[#081938]/95 border-2 border-cyan-400/35 shadow-2xl space-y-4">
                {/* Board Header & Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-300/50 text-amber-200 text-xs font-black">
                      Bảng chữ không dấu ({wordGrid.size}×{wordGrid.size})
                    </span>
                    <span className="text-xs font-bold text-cyan-200">
                      Hướng cho phép: Ngang (→), Dọc (↓)
                      {allowDiagonal ? ', Chéo (↘, ↗)' : ''}
                      {allowReverse ? ', Đảo ngược (←, ↑)' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {gridSelectionStart && (
                      <button
                        type="button"
                        onClick={() => {
                          setGridSelectionStart(null);
                          setGridSelectionCurrent(null);
                          setIsPointerDraggingGrid(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 text-xs font-extrabold cursor-pointer"
                      >
                        Hủy chọn ({activeSelectionInfo.previewToken || '...'})
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleTriggerGridHint}
                      disabled={foundWordIds.length >= wordGrid.placedWords.length}
                      className="px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 disabled:opacity-40 border border-amber-300/50 text-amber-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                      title="Làm sáng ô chữ đầu tiên của một từ chưa tìm thấy (từ đó sẽ nhận 5 điểm)"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                      <span>Gợi ý ô đầu (Từ nhận +5đ)</span>
                    </button>
                  </div>
                </div>

                {/* Live Feedback Banner */}
                {gridFeedbackBanner && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`px-4 py-2.5 rounded-2xl border text-xs sm:text-sm font-extrabold flex items-center justify-between gap-2 ${
                      gridFeedbackBanner.type === 'SUCCESS'
                        ? 'bg-emerald-950/85 border-emerald-400 text-emerald-200'
                        : gridFeedbackBanner.type === 'ERROR'
                        ? 'bg-rose-950/85 border-rose-400 text-rose-200'
                        : 'bg-blue-950/85 border-cyan-400 text-cyan-200'
                    }`}
                  >
                    <span>{gridFeedbackBanner.text}</span>
                    <button
                      type="button"
                      onClick={() => setGridFeedbackBanner(null)}
                      className="opacity-75 hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* 3D Keycap Letter Grid Container */}
                <div
                  className="w-full overflow-x-auto py-2 flex justify-center"
                  onPointerUp={() => {
                    if (isPointerDraggingGrid && gridSelectionStart && gridSelectionCurrent) {
                      commitGridSelection(gridSelectionStart, gridSelectionCurrent);
                    }
                    setIsPointerDraggingGrid(false);
                  }}
                >
                  <div
                    role="grid"
                    aria-label="Bảng chữ không dấu tìm từ khóa"
                    style={{
                      gridTemplateColumns: `repeat(${wordGrid.size}, minmax(0, 1fr))`,
                    }}
                    className={`grid gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-2xl bg-[#051024]/95 border-2 border-cyan-400/30 shadow-inner ${
                      isPointerDraggingGrid ? 'touch-none' : ''
                    }`}
                  >
                    {wordGrid.cells.map((rowCells, rIdx) =>
                      rowCells.map((letter, cIdx) => {
                        const cellKey = `${rIdx}_${cIdx}`;
                        const foundIntersectionCount = foundCellMap.get(cellKey) || 0;
                        const isCurrentlySelected = activeSelectedCellSet.has(cellKey);
                        const isStartAnchor =
                          gridSelectionStart?.row === rIdx && gridSelectionStart?.col === cIdx;
                        const isHintedStart =
                          activeHintStartCoord?.row === rIdx && activeHintStartCoord?.col === cIdx;
                        const isFocused =
                          focusedGridCell.row === rIdx && focusedGridCell.col === cIdx;

                        const sizeClass =
                          wordGrid.size <= 8
                            ? 'w-10 h-10 sm:w-12 sm:h-12 text-base sm:text-lg'
                            : wordGrid.size <= 10
                            ? 'w-8 h-8 sm:w-10 sm:h-10 text-sm sm:text-base'
                            : 'w-7 h-7 sm:w-9 sm:h-9 text-xs sm:text-sm';

                        return (
                          <button
                            key={cellKey}
                            type="button"
                            role="gridcell"
                            tabIndex={isFocused ? 0 : -1}
                            aria-label={`Hàng ${rIdx + 1} cột ${cIdx + 1} chữ ${letter}${
                              foundIntersectionCount > 0 ? ' (thuộc từ đã mở)' : ''
                            }`}
                            onFocus={() => setFocusedGridCell({ row: rIdx, col: cIdx })}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              const pt = { row: rIdx, col: cIdx };
                              setFocusedGridCell(pt);
                              // Support 2-click mode: if a start point is already chosen and user clicks a different cell, commit!
                              if (
                                gridSelectionStart &&
                                (gridSelectionStart.row !== rIdx || gridSelectionStart.col !== cIdx)
                              ) {
                                commitGridSelection(gridSelectionStart, pt);
                                return;
                              }
                              setGridSelectionStart(pt);
                              setGridSelectionCurrent(pt);
                              setIsPointerDraggingGrid(true);
                              b09Sound.playSelectTile(isMuted);
                            }}
                            onPointerEnter={() => {
                              if (isPointerDraggingGrid && gridSelectionStart) {
                                setGridSelectionCurrent({ row: rIdx, col: cIdx });
                              } else if (gridSelectionStart && !isPointerDraggingGrid) {
                                setGridSelectionCurrent({ row: rIdx, col: cIdx });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                const next = {
                                  row: rIdx,
                                  col: Math.min(wordGrid.size - 1, cIdx + 1),
                                };
                                setFocusedGridCell(next);
                                if (gridSelectionStart) setGridSelectionCurrent(next);
                              } else if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                const next = { row: rIdx, col: Math.max(0, cIdx - 1) };
                                setFocusedGridCell(next);
                                if (gridSelectionStart) setGridSelectionCurrent(next);
                              } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                const next = {
                                  row: Math.min(wordGrid.size - 1, rIdx + 1),
                                  col: cIdx,
                                };
                                setFocusedGridCell(next);
                                if (gridSelectionStart) setGridSelectionCurrent(next);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const next = { row: Math.max(0, rIdx - 1), col: cIdx };
                                setFocusedGridCell(next);
                                if (gridSelectionStart) setGridSelectionCurrent(next);
                              } else if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                const pt = { row: rIdx, col: cIdx };
                                if (!gridSelectionStart) {
                                  setGridSelectionStart(pt);
                                  setGridSelectionCurrent(pt);
                                  b09Sound.playSelectTile(isMuted);
                                } else {
                                  commitGridSelection(gridSelectionStart, pt);
                                }
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setGridSelectionStart(null);
                                setGridSelectionCurrent(null);
                              }
                            }}
                            className={`${sizeClass} rounded-xl font-black flex items-center justify-center transition-all cursor-pointer relative ${
                              isCurrentlySelected
                                ? activeSelectionInfo.isValidDirection
                                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-2 border-white shadow-[0_3px_0_#92400E] scale-105 z-10'
                                  : 'bg-rose-600/80 text-white border-2 border-rose-300'
                                : isHintedStart
                                ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 border-2 border-white animate-bounce'
                                : foundIntersectionCount > 1
                                ? 'bg-gradient-to-b from-cyan-400 to-emerald-500 text-slate-950 border-2 border-white shadow-[0_3px_0_#065F46]'
                                : foundIntersectionCount === 1
                                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 border-2 border-emerald-200 shadow-[0_3px_0_#065F46]'
                                : isStartAnchor
                                ? 'bg-cyan-400 text-slate-950 border-2 border-white'
                                : 'bg-gradient-to-b from-[#17366B] to-[#0D2147] hover:from-[#1E4484] hover:to-[#132E5E] text-white border border-cyan-400/35 shadow-[0_4px_0_#061126]'
                            }`}
                          >
                            <span>{letter}</span>
                            {foundIntersectionCount > 1 && (
                              <span
                                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-300 text-slate-950 text-[9px] font-black flex items-center justify-center"
                                title="Giao điểm của 2 từ khóa đã tìm thấy"
                              >
                                ×2
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Explanation Card of Most Recently Found Word */}
                {lastSolvedGridWord && (
                  <div className="p-4 rounded-2xl bg-emerald-950/75 border border-emerald-400/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                        Từ khóa vừa giải mã: {lastSolvedGridWord.displayAnswer}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-200">
                        Chuỗi bảng chữ: {lastSolvedGridWord.searchToken}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-white leading-relaxed">
                      {lastSolvedGridWord.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* SIDEBAR (4 COLUMNS ON DESKTOP): CLUE LIST / SCOREBOARD / LOGS    */}
          {/* ================================================================ */}
          <div className="lg:col-span-4 space-y-4">
            {/* Word Grid Clues List (When in Mode 2) */}
            {playMode === 'WORD_GRID_HUNT' && wordGrid && (
              <div className="p-4 rounded-3xl bg-[#091D3E]/90 border border-cyan-400/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-amber-300" />
                    <span>Gợi ý cần tìm ({foundWordIds.length}/{wordGrid.placedWords.length})</span>
                  </h3>
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {wordGrid.placedWords.map((pw, idx) => {
                    const isFound = foundWordIds.includes(pw.wordId);
                    const isHinted = hintedWordIds.includes(pw.wordId);
                    return (
                      <div
                        key={pw.wordId}
                        className={`p-3 rounded-2xl border transition-all ${
                          isFound
                            ? 'bg-emerald-950/60 border-emerald-400/60 text-emerald-100'
                            : 'bg-slate-900/80 border-slate-700/80 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-black text-amber-300">
                            #{idx + 1} · {pw.searchToken.length} chữ cái
                            {isHinted && !isFound ? ' (Đã gợi ý: +5đ)' : ''}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSpeakClue(pw.clue)}
                              className="p-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 cursor-pointer"
                              title="Đọc gợi ý"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            {isFound ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 text-[11px] font-black">
                                ĐÃ TÌM: {pw.displayAnswer}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-bold">
                                Đang ẩn
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-white/95">{pw.clue}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scoreboard Panel */}
            <div className="p-4 rounded-3xl bg-[#091D3E]/90 border border-cyan-400/30 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" />
                  <span>Bảng điểm & Tiến độ</span>
                </h3>
                <span className="text-xs font-extrabold text-cyan-200">
                  Tổng: {classScore} điểm
                </span>
              </div>

              {orgMode === 'TEAMS' && rankedTeams.length > 0 ? (
                <div className="space-y-2">
                  {teams.map((team, idx) => {
                    const isTurn = idx === activeTeamIdx;
                    return (
                      <div
                        key={team.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                          isTurn
                            ? 'bg-gradient-to-r from-blue-900/90 to-cyan-900/70 border-amber-300 shadow-md'
                            : 'bg-slate-900/75 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: team.colorHex }}
                          />
                          <div className="truncate">
                            <p className="text-xs font-black text-white truncate flex items-center gap-1.5">
                              <span>{team.name}</span>
                              {isTurn && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                                  ĐẾN LƯỢT
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Giải đúng: {team.solvedCount} từ
                            </p>
                          </div>
                        </div>
                        <span className="text-base font-black text-amber-300 shrink-0">
                          {team.score} đ
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-300">{currentActorLabel}</p>
                    <p className="text-[11px] text-slate-400">
                      Số từ khóa đã mở: {scoredKeywordIds.length} / {sessionKeywords.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-300">{classScore}</span>
                    <span className="text-xs font-bold text-amber-200 ml-1">điểm</span>
                  </div>
                </div>
              )}

              {/* Teacher Quick Controls */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                {orgMode !== 'CLASS' && (
                  <button
                    type="button"
                    onClick={advanceActorTurn}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Đổi lượt đội/HS</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    voiceManagerRef.current?.cancel();
                    deadlineMsRef.current = null;
                    setPhase('FINISHED');
                    clearSavedSessionStorage();
                    b09Sound.playCelebration(isMuted);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold cursor-pointer ml-auto"
                >
                  Kết thúc & Tổng kết
                </button>
              </div>
            </div>

            {/* Recent Turn History */}
            {turnLogs.length > 0 && (
              <div className="p-4 rounded-3xl bg-[#091D3E]/90 border border-cyan-400/25 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Lịch sử thao tác gần đây
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {turnLogs.slice(0, 8).map((log) => (
                    <div
                      key={log.turnId}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <span className="font-bold text-cyan-200">{log.actorLabel}: </span>
                        <span className="text-white">{log.submittedText}</span>
                      </div>
                      <span
                        className={`font-black shrink-0 ${
                          log.isCorrect ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {log.isCorrect ? `+${log.pointsAwarded}đ` : '0đ'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* PAUSE OVERLAY (MASKS CLUES & BOARD TO PREVENT PEEKING)           */}
          {/* ================================================================ */}
          {phase === 'PAUSED' && (
            <div className="absolute inset-0 z-40 bg-[#050E22]/95 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-400/20 border-2 border-amber-300 flex items-center justify-center text-amber-300">
                <Pause className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Trò chơi đang tạm dừng
              </h3>
              <p className="text-xs sm:text-sm text-cyan-200 max-w-md">
                Đồng hồ đếm ngược đã được giữ nguyên và nội dung câu gợi ý / bảng chữ được ẩn tạm thời để đảm bảo công bằng.
              </p>
              <button
                type="button"
                onClick={handleResumeSession}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Tiếp tục phiên chơi</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 3: FINISHED SUMMARY & KNOWLEDGE REVIEW                         */}
      {/* ==================================================================== */}
      {phase === 'FINISHED' && (
        <div className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-[#0D2856] via-[#0A1E42] to-[#07152E] border-2 border-amber-300/60 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border-2 border-amber-300 flex items-center justify-center text-amber-300">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-xs font-black">
                    HOÀN THÀNH KHỞI ĐỘNG B09
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                    Tổng kết Trạm Giải Mã Tri Thức
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleStartSession}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Chơi lại phiên mới</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('SETUP')}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-600 cursor-pointer"
                >
                  Đổi cấu hình / Chế độ
                </button>
              </div>
            </div>

            {/* Team Leaderboard with Tie Detection ("Đồng hạng") */}
            {orgMode === 'TEAMS' && rankedTeams.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-wider text-amber-300">
                  Bảng xếp hạng các đội
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rankedTeams.map((team) => (
                    <div
                      key={team.id}
                      className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
                        team.rank === 1
                          ? 'bg-amber-500/20 border-amber-300'
                          : 'bg-slate-900/80 border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-black uppercase text-cyan-300">
                          {team.isTied ? `Đồng hạng #${team.rank}` : `Hạng #${team.rank}`}
                        </span>
                        <p className="text-base font-black text-white">{team.name}</p>
                        <p className="text-xs text-slate-300">
                          Giải đúng: {team.solvedCount} từ khóa
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-amber-300">{team.score}</span>
                        <span className="text-xs font-bold text-amber-200 block">điểm</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Pedagogical Review of All Session Keywords (Always Full Accented Vietnamese) */}
            <div className="space-y-3">
              <h4 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Bảng ôn tập từ khóa & Giải thích chuẩn có dấu ({sessionKeywords.length} từ)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sessionKeywords.map((item, idx) => {
                  const wasSolved = scoredKeywordIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-400/25 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-amber-300">
                          {idx + 1}. {item.displayAnswer}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            wasSolved
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {wasSolved ? 'Đã giải mã' : 'Công bố'}
                        </span>
                      </div>
                      <p className="text-xs text-cyan-200 font-semibold">Gợi ý: {item.clue}</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.explanation}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* FOOTER INSTRUCTION BAR                                               */}
      {/* ==================================================================== */}
      <footer className="relative z-20 px-4 sm:px-6 py-2.5 bg-[#061126]/95 border-t border-cyan-400/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-cyan-300">Hướng dẫn nhanh:</span>
          {playMode === 'DECODE_KEYWORD' ? (
            <span>
              Đọc gợi ý → Nhập từ khóa → Bấm “Chốt đáp án” (Đúng ngay: +30đ, dùng 1 gợi ý: +20đ, 2–3 gợi ý: +10đ).
            </span>
          ) : (
            <span>
              Kéo chuột hoặc bấm ô đầu rồi bấm ô cuối theo đường thẳng để đánh dấu từ khóa (+10đ/từ, dùng gợi ý ô đầu: +5đ).
            </span>
          )}
        </div>
        <span className="text-slate-400">
          Tây Đô Smart EDU · B09 Tìm từ khóa 3D
        </span>
      </footer>

      {/* ==================================================================== */}
      {/* MODAL: HOW TO PLAY GUIDE                                             */}
      {/* ==================================================================== */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-[#0A1E40] border-2 border-cyan-400/50 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-300">
                Hướng dẫn chơi B09 – Tìm từ khóa 3D
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700 space-y-1">
                <p className="font-black text-cyan-300">1. Chế độ Giải mã từ khóa (Mặc định)</p>
                <p>
                  • Mỗi vòng hiển thị gợi ý và số ô chữ cái của từ khóa. Học sinh suy luận và nhập đáp án rồi bấm <strong>“Chốt đáp án”</strong>.
                </p>
                <p>
                  • Điểm số: Chưa dùng gợi ý phụ <strong>+30 điểm</strong>; dùng 1 gợi ý <strong>+20 điểm</strong>; dùng 2–3 gợi ý <strong>+10 điểm</strong>; sai hoặc công bố <strong>0 điểm</strong>.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700 space-y-1">
                <p className="font-black text-amber-300">2. Chế độ Săn từ trên bảng chữ</p>
                <p>
                  • Bảng chữ sử dụng chữ IN HOA KHÔNG DẤU. Kéo chuột từ ô đầu đến ô cuối, hoặc bấm ô đầu rồi bấm ô cuối (hoặc dùng phím mũi tên + Enter/Space).
                </p>
                <p>
                  • Điểm số: Tìm đúng mỗi từ nhận <strong>+10 điểm</strong> (nếu dùng gợi ý làm sáng ô đầu nhận <strong>+5 điểm</strong>).
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 rounded-xl bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ZOOMED CLUE CONTENT                                           */}
      {/* ==================================================================== */}
      {zoomedContent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-[#0A1E40] border-2 border-cyan-400 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-cyan-300">{zoomedContent.title}</h3>
              <button
                type="button"
                onClick={() => setZoomedContent(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-xl sm:text-2xl font-extrabold leading-relaxed text-white">
              <MathView content={zoomedContent.body} />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CONFIRM RESET OR EXIT ACTIVE SESSION                          */}
      {/* ==================================================================== */}
      {confirmExitModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0A1E40] border-2 border-amber-400/60 p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-amber-300">
              Xác nhận rời phiên chơi đang diễn ra?
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Phiên khởi động hiện tại đang có tiến độ và điểm số. Bạn có chắc chắn muốn kết thúc phiên hiện tại không?
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmExitModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Ở lại chơi tiếp
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmExitModal;
                  setConfirmExitModal(null);
                  voiceManagerRef.current?.cancel();
                  deadlineMsRef.current = null;
                  clearSavedSessionStorage();
                  if (target === 'LIBRARY' && onCloseGame) {
                    onCloseGame();
                  } else {
                    setPhase('SETUP');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black cursor-pointer"
              >
                Xác nhận rời phiên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeywordQuestGame;
