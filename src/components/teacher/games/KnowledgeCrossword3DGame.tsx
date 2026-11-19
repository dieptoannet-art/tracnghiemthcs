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
  BookOpen,
  Sparkles,
  HelpCircle,
  Eye,
  ArrowRight,
  RefreshCw,
  X,
  AlertTriangle,
  Check,
  Lightbulb,
  Key,
  ZoomIn,
  ZoomOut,
  Focus,
  Layers,
  Award,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question } from '../../../types';
import { MathView } from '../../MathView';
import { SpaceRocketVoiceManager } from './SpaceRocketVoiceManager';

// ============================================================================
// TYPES & DATA STRUCTURES FOR C05: Ô CHỮ KIẾN THỨC 3D ("BỨC TƯỜNG TRI THỨC")
// ============================================================================

export type C05CrosswordType = 'VERTICAL_COLUMN' | 'INDEPENDENT_KEYWORD';
export type C05OrgMode = 'CLASS' | 'INDIVIDUAL' | 'TEAMS';
export type C05RowTimeLimit = 0 | 30 | 45 | 60 | 90; // 0 = Không giới hạn
export type C05MaxAttempts = 1 | 2;

export type C05RowStatus = 'UNOPENED' | 'SOLVED_BY_PLAYER' | 'REVEALED_BY_TEACHER';

export type C05KeywordStatus =
  | 'LOCKED'
  | 'AVAILABLE'
  | 'SOLVED_EARLY_30'
  | 'SOLVED_FINAL_10'
  | 'REVEALED_BY_TEACHER';

export type C05StagePhase =
  | 'SETUP'
  | 'SELECTING_ROW'
  | 'ROW_ACTIVE'
  | 'ROW_FEEDBACK'
  | 'KEYWORD_CHALLENGE'
  | 'FINAL_SIMULTANEOUS_KEYWORD'
  | 'FINISHED';

export interface C05CrosswordRowConfig {
  rowId: string;
  rowNumber: number; // 1-based (1..N)
  clue: string;
  displayAnswer: string; // Full Vietnamese diacritics, e.g. "MÀN HÌNH"
  gridAnswer: string; // Normalized uppercase ASCII no spaces, e.g. "MANHINH"
  acceptedAnswers: string[]; // Variants accepted when typing
  keywordPosition1Based?: number; // 1-based position in gridAnswer (for editor clarity)
  keywordIndex?: number; // 0-based index in gridAnswer (converted once)
  clueLetterForIndependent?: string; // Optional clue letter unlocked in Type B
  hint?: string;
  explanation: string;
  imageUrl?: string;
}

export interface C05CrosswordDataset {
  datasetId: string;
  title: string;
  topic: string;
  subjectLabel: string;
  crosswordType: C05CrosswordType;
  displayKeyword: string; // e.g. "MÁY TÍNH"
  gridKeyword: string; // e.g. "MAYTINH"
  acceptedKeywords: string[];
  keywordClue: string;
  keywordExplanation: string;
  rows: C05CrosswordRowConfig[];
  isSample: boolean;
}

export interface C05RuntimeRowState {
  rowId: string;
  status: C05RowStatus;
  hintUsed: boolean;
  revealedLetterIndex: number | null; // Optional single non-keyword cell opened by hint
  solvedByEntityId: string | null;
  solvedByEntityName: string | null;
  pointsAwarded: number; // 10, 5, or 0
  attemptsUsedInCurrentTurn: number;
}

export interface C05CompetitorEntity {
  entityId: string;
  name: string;
  colorHex: string;
  score: number;
  rowsSolvedCount: number;
  turnsTakenCount: number;
  usedEarlyKeywordGuess: boolean;
  wonKeywordPoints: number; // 30, 10, or 0
}

export interface C05ValidationIssue {
  rowNumber?: number;
  rowId?: string;
  message: string;
}

export interface C05DatasetValidationResult {
  valid: boolean;
  issues: C05ValidationIssue[];
  maxLeftChars: number;
  maxRightChars: number;
  totalGridColumns: number;
  keywordColumnIndex0Based: number;
}

export interface KnowledgeCrossword3DGameProps {
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
  onPick?: (
    student: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string }
  ) => void;
}

export const C05_STORAGE_KEY = 'taydo_smart_edu_c05_active_session_v1';
export const C05_STORAGE_VERSION = 1;
const C05_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const TEAM_PALETTE = [
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#EC4899', // Pink
  '#8B5CF6', // Violet
];

// ============================================================================
// VIETNAMESE NORMALIZATION & GRAPHENE-SAFE GRID TOKENIZER (SECTION 6)
// ============================================================================

/**
 * Normalizes a Vietnamese string into uppercase ASCII without diacritics,
 * mapping đ/Đ -> D, removing combining marks (both NFC and NFD),
 * and optionally removing all whitespace for crossword grid representation.
 */
export function normalizeVietnameseCrosswordGrid(
  input: string,
  stripSpaces: boolean = true
): string {
  if (!input) return '';
  // First normalize to NFD so precomposed and decomposed Unicode sequences behave identically
  const nfd = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();

  if (stripSpaces) {
    // Keep letters A-Z, digits 0-9, and essential mathematical symbols if any, stripping spaces
    return nfd.replace(/\s+/g, '').trim();
  }
  return nfd.replace(/\s+/g, ' ').trim();
}

/**
 * Splits a normalized gridAnswer into true character cells (grapheme-safe).
 */
export function splitGridCells(gridAnswer: string): string[] {
  return Array.from(gridAnswer);
}

/**
 * Checks if a user's typed answer matches a row's gridAnswer, displayAnswer,
 * or any declared acceptedAnswers according to the published no-diacritic crossword rule.
 * Never uses fuzzy matching to accept unrelated words.
 */
export function isRowAnswerAccepted(
  userRawInput: string,
  row: C05CrosswordRowConfig
): boolean {
  const cleanedRaw = userRawInput.trim();
  if (!cleanedRaw) return false;

  const userGridNorm = normalizeVietnameseCrosswordGrid(cleanedRaw, true);
  if (!userGridNorm) return false;

  const targetGridNorm = normalizeVietnameseCrosswordGrid(row.gridAnswer, true);
  if (userGridNorm === targetGridNorm) return true;

  const displayGridNorm = normalizeVietnameseCrosswordGrid(row.displayAnswer, true);
  if (userGridNorm === displayGridNorm) return true;

  for (const variant of row.acceptedAnswers || []) {
    const varNorm = normalizeVietnameseCrosswordGrid(variant, true);
    if (varNorm && userGridNorm === varNorm) {
      return true;
    }
  }

  return false;
}

export function isKeywordAnswerAccepted(
  userRawInput: string,
  dataset: C05CrosswordDataset
): boolean {
  const cleanedRaw = userRawInput.trim();
  if (!cleanedRaw) return false;

  const userGridNorm = normalizeVietnameseCrosswordGrid(cleanedRaw, true);
  if (!userGridNorm) return false;

  if (userGridNorm === normalizeVietnameseCrosswordGrid(dataset.gridKeyword, true)) {
    return true;
  }
  if (userGridNorm === normalizeVietnameseCrosswordGrid(dataset.displayKeyword, true)) {
    return true;
  }
  for (const v of dataset.acceptedKeywords || []) {
    const varNorm = normalizeVietnameseCrosswordGrid(v, true);
    if (varNorm && userGridNorm === varNorm) return true;
  }
  return false;
}

// ============================================================================
// DETERMINISTIC SCORING, HINT & KEYWORD RULES HELPERS (SECTIONS 9, 10, 11, 18)
// ============================================================================

export function computeC05RowPoints(params: {
  isSolvedByPlayer: boolean;
  hintUsedOnRow: boolean;
}): number {
  if (!params.isSolvedByPlayer) return 0; // Wrong, timeout, or Revealed by teacher = 0 pts
  return params.hintUsedOnRow ? 5 : 10;
}

export function computeC05KeywordUnlock(params: {
  totalRows: number;
  openedRowsCount: number; // Includes both SOLVED_BY_PLAYER and REVEALED_BY_TEACHER
}): {
  minRequired: number;
  isUnlocked: boolean;
  hasUnopenedRows: boolean;
} {
  const minRequired = params.totalRows <= 1 ? Math.max(1, params.totalRows) : 2;
  const isUnlocked = params.openedRowsCount >= minRequired;
  const hasUnopenedRows = params.openedRowsCount < params.totalRows;
  return {
    minRequired,
    isUnlocked,
    hasUnopenedRows,
  };
}

export function computeC05KeywordPoints(params: {
  hasUnopenedRows: boolean;
  keywordAlreadyAwarded: boolean;
}): number {
  if (params.keywordAlreadyAwarded) return 0; // Never award keyword points twice
  return params.hasUnopenedRows ? 30 : 10;
}

export function computeC05RankedCompetitors(
  competitors: C05CompetitorEntity[]
): Array<C05CompetitorEntity & { rank: number; isTied: boolean }> {
  const sorted = [...competitors].sort((a, b) => b.score - a.score);
  return sorted.map((comp) => {
    const rank = 1 + sorted.filter((other) => other.score > comp.score).length;
    const isTied = sorted.filter((other) => other.score === comp.score).length > 1;
    return {
      ...comp,
      rank,
      isTied,
    };
  });
}

// ============================================================================
// KEYWORD COLUMN & GEOMETRY VALIDATOR (SECTION 12)
// ============================================================================

export function validateCrosswordDataset(
  dataset: C05CrosswordDataset
): C05DatasetValidationResult {
  const issues: C05ValidationIssue[] = [];
  const normKeyword = normalizeVietnameseCrosswordGrid(dataset.gridKeyword, true);
  const keywordChars = splitGridCells(normKeyword);

  if (keywordChars.length === 0) {
    issues.push({ message: 'Từ khóa chủ đề đang trống.' });
  }

  if (!dataset.rows || dataset.rows.length === 0) {
    issues.push({ message: 'Bộ ô chữ chưa có hàng ngang nào.' });
  }

  if (dataset.crosswordType === 'VERTICAL_COLUMN') {
    if (dataset.rows.length !== keywordChars.length) {
      issues.push({
        message: `Số lượng hàng ngang (${dataset.rows.length}) không khớp với số chữ cái của từ khóa cột dọc "${normKeyword}" (${keywordChars.length} chữ).`,
      });
    }
  }

  let maxLeftChars = 0;
  let maxRightChars = 0;

  dataset.rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const normGrid = normalizeVietnameseCrosswordGrid(row.gridAnswer, true);
    const cells = splitGridCells(normGrid);

    if (!row.clue || !row.clue.trim()) {
      issues.push({
        rowNumber: rowNum,
        rowId: row.rowId,
        message: `Hàng ${rowNum}: Thiếu câu gợi ý.`,
      });
    }

    if (cells.length < 2 || cells.length > 18) {
      issues.push({
        rowNumber: rowNum,
        rowId: row.rowId,
        message: `Hàng ${rowNum} ("${row.displayAnswer}"): Độ dài sau chuẩn hóa là ${cells.length} ô (yêu cầu từ 2 đến 18 ô).`,
      });
    }

    if (dataset.crosswordType === 'VERTICAL_COLUMN') {
      const kIdx =
        typeof row.keywordIndex === 'number'
          ? row.keywordIndex
          : typeof row.keywordPosition1Based === 'number'
          ? row.keywordPosition1Based - 1
          : -1;

      if (kIdx < 0 || kIdx >= cells.length) {
        issues.push({
          rowNumber: rowNum,
          rowId: row.rowId,
          message: `Hàng ${rowNum} ("${normGrid}"): Vị trí chữ cột khóa (${kIdx + 1}) nằm ngoài phạm vi độ dài từ (1..${cells.length}).`,
        });
      } else {
        const expectedChar = keywordChars[idx];
        const actualChar = cells[kIdx];
        if (expectedChar && actualChar !== expectedChar) {
          issues.push({
            rowNumber: rowNum,
            rowId: row.rowId,
            message: `Hàng ${rowNum} ("${normGrid}"): Chữ tại vị trí ${kIdx + 1} là "${actualChar}", không khớp chữ thứ ${rowNum} của từ khóa "${normKeyword}" là "${expectedChar}".`,
          });
        }
        const leftCount = kIdx;
        const rightCount = cells.length - 1 - kIdx;
        if (leftCount > maxLeftChars) maxLeftChars = leftCount;
        if (rightCount > maxRightChars) maxRightChars = rightCount;
      }
    } else {
      if (cells.length > maxRightChars) maxRightChars = cells.length;
    }
  });

  const totalGridColumns =
    dataset.crosswordType === 'VERTICAL_COLUMN'
      ? maxLeftChars + 1 + maxRightChars
      : maxRightChars;

  return {
    valid: issues.length === 0,
    issues,
    maxLeftChars,
    maxRightChars,
    totalGridColumns,
    keywordColumnIndex0Based: maxLeftChars,
  };
}

// ============================================================================
// BUILT-IN SAMPLE DATASETS (SECTION 16)
// Tagged "Dữ liệu mẫu" — Never written to real DB
// ============================================================================

/**
 * BỘ MẪU 1 (CHUẨN MỤC 16): THIẾT BỊ VÀ THẾ GIỚI SỐ
 * Từ khóa chuẩn: MÁY TÍNH -> MAYTINH (7 hàng)
 * Positions 1-based: 1(M), 2(A), 3(Y), 1(T), 1(I), 4(N), 2(H)
 * Converted 0-based once: 0, 1, 2, 0, 0, 3, 1
 */
export const SAMPLE_C05_DIGITAL_WORLD_DATASET: C05CrosswordDataset = {
  datasetId: 'c05_sample_digital_world',
  title: 'Thiết bị và Thế giới số (Cột từ khóa chuẩn)',
  topic: 'CHỦ ĐỀ: THIẾT BỊ VÀ THẾ GIỚI SỐ',
  subjectLabel: 'Tin học THCS · Dữ liệu mẫu',
  crosswordType: 'VERTICAL_COLUMN',
  displayKeyword: 'MÁY TÍNH',
  gridKeyword: 'MAYTINH',
  acceptedKeywords: ['MÁY TÍNH', 'MAY TINH', 'MAYTINH', 'MÁY VI TÍNH'],
  keywordClue:
    'Thiết bị điện tử có thể tiếp nhận, lưu trữ, xử lí và trao đổi thông tin theo chương trình.',
  keywordExplanation:
    'MÁY TÍNH là thiết bị điện tử số trung tâm giúp con người thu nhận, lưu trữ, xử lí dữ liệu tự động theo chương trình và kết nối truyền thông.',
  isSample: true,
  rows: [
    {
      rowId: 'c05_dw_r1',
      rowNumber: 1,
      clue: 'Thiết bị hiển thị hình ảnh và nội dung từ máy tính.',
      displayAnswer: 'MÀN HÌNH',
      gridAnswer: 'MANHINH',
      acceptedAnswers: ['MÀN HÌNH', 'MAN HINH', 'MANHINH', 'MÀN HÌNH MÁY TÍNH'],
      keywordPosition1Based: 1, // M ở vị trí 1
      keywordIndex: 0,
      hint: 'Thiết bị xuất (Output) quen thuộc đặt trước mặt người dùng để quan sát văn bản, hình ảnh, video.',
      explanation: 'MÀN HÌNH (Monitor) là thiết bị ra chuẩn dùng để hiển thị thông tin hình ảnh cho người sử dụng.',
    },
    {
      rowId: 'c05_dw_r2',
      rowNumber: 2,
      clue: 'Thiết bị dùng để nhập kí tự vào máy tính.',
      displayAnswer: 'BÀN PHÍM',
      gridAnswer: 'BANPHIM',
      acceptedAnswers: ['BÀN PHÍM', 'BAN PHIM', 'BANPHIM', 'BÀN PHÍM MÁY TÍNH'],
      keywordPosition1Based: 2, // A ở vị trí 2
      keywordIndex: 1,
      hint: 'Thiết bị vào (Input) gồm các hàng phím chữ cái, chữ số và phím chức năng.',
      explanation: 'BÀN PHÍM (Keyboard) là thiết bị vào cơ bản giúp gõ văn bản, ký tự và gửi lệnh vào máy tính.',
    },
    {
      rowId: 'c05_dw_r3',
      rowNumber: 3,
      clue: 'Thiết bị đưa nội dung từ máy tính ra giấy.',
      displayAnswer: 'MÁY IN',
      gridAnswer: 'MAYIN',
      acceptedAnswers: ['MÁY IN', 'MAY IN', 'MAYIN'],
      keywordPosition1Based: 3, // Y ở vị trí 3
      keywordIndex: 2,
      hint: 'Thiết bị ngoại vi thường dùng trong văn phòng và trường học để xuất tài liệu văn bản, tranh ảnh ra trang giấy.',
      explanation: 'MÁY IN (Printer) là thiết bị đầu ra chuyển dữ liệu số trên máy tính thành bản in trên giấy.',
    },
    {
      rowId: 'c05_dw_r4',
      rowNumber: 4,
      clue: 'Dùng để tổ chức tệp và các thư mục con.',
      displayAnswer: 'THƯ MỤC',
      gridAnswer: 'THUMUC',
      acceptedAnswers: ['THƯ MỤC', 'THU MUC', 'THUMUC', 'FOLDER'],
      keywordPosition1Based: 1, // T ở vị trí 1
      keywordIndex: 0,
      hint: 'Biểu tượng thường có hình kẹp hồ sơ màu vàng trong trình quản lý tệp của hệ điều hành.',
      explanation: 'THƯ MỤC (Folder/Directory) giúp sắp xếp, phân loại tệp tin và các thư mục con theo cấu trúc hình cây khoa học.',
    },
    {
      rowId: 'c05_dw_r5',
      rowNumber: 5,
      clue: 'Mạng liên kết các mạng máy tính trên phạm vi toàn cầu.',
      displayAnswer: 'INTERNET',
      gridAnswer: 'INTERNET',
      acceptedAnswers: ['INTERNET', 'MẠNG INTERNET', 'MANG INTERNET'],
      keywordPosition1Based: 1, // I ở vị trí 1
      keywordIndex: 0,
      hint: 'Hệ thống mạng toàn cầu giúp truy cập Web, gửi thư điện tử và học tập trực tuyến khắp thế giới.',
      explanation: 'INTERNET là hệ thống thông tin toàn cầu kết nối hàng tỷ thiết bị và mạng máy tính qua giao thức TCP/IP.',
    },
    {
      rowId: 'c05_dw_r6',
      rowNumber: 6,
      clue: 'Các chương trình giúp máy tính thực hiện những công việc nhất định.',
      displayAnswer: 'PHẦN MỀM',
      gridAnswer: 'PHANMEM',
      acceptedAnswers: ['PHẦN MỀM', 'PHAN MEM', 'PHANMEM', 'PHẦN MỀM MÁY TÍNH'],
      keywordPosition1Based: 4, // N ở vị trí 4 (P-H-A-N-M-E-M)
      keywordIndex: 3,
      hint: 'Đối lập với phần cứng hữu hình; ví dụ như hệ điều hành Windows, trình duyệt web hay trình soạn thảo Word.',
      explanation: 'PHẦN MỀM (Software) là tập hợp các câu lệnh, chương trình điều khiển phần cứng máy tính thực hiện tác vụ.',
    },
    {
      rowId: 'c05_dw_r7',
      rowNumber: 7,
      clue: 'Thiết bị dùng để điều khiển con trỏ và chọn đối tượng.',
      displayAnswer: 'CHUỘT',
      gridAnswer: 'CHUOT',
      acceptedAnswers: ['CHUỘT', 'CHUOT', 'CHUỘT MÁY TÍNH', 'CON CHUỘT'],
      keywordPosition1Based: 2, // H ở vị trí 2 (C-H-U-O-T)
      keywordIndex: 1,
      hint: 'Thiết bị cầm tay nhỏ gọn dùng để di chuyển mũi tên trên màn hình, nháy chọn và kéo thả.',
      explanation: 'CHUỘT máy tính (Mouse) là thiết bị trỏ giúp thao tác trực quan với giao diện đồ họa người dùng.',
    },
  ],
};

/**
 * BỘ MẪU 2 (TOÁN THCS – CỘT TỪ KHÓA): HÌNH HỌC & ĐẠI SỐ CƠ BẢN
 * Từ khóa chuẩn: TAM GIÁC -> TAMGIAC (7 hàng)
 * 1. TRUNG ĐIỂM -> TRUNGDIEM (vị trí 1 = T)
 * 2. ĐA THỨC -> DATHUC (vị trí 2 = A)
 * 3. MẪU SỐ -> MAUSO (vị trí 1 = M)
 * 4. GÓC VUÔNG -> GOCVUONG (vị trí 1 = G)
 * 5. DIỆN TÍCH -> DIENTICH (vị trí 2 = I)
 * 6. PHÂN SỐ -> PHANSO (vị trí 3 = A)
 * 7. CẠNH HUYỀN -> CANHHUYEN (vị trí 1 = C)
 */
export const SAMPLE_C05_MATH_DATASET: C05CrosswordDataset = {
  datasetId: 'c05_sample_math_thcs',
  title: 'Hình học & Đại số THCS (Cột từ khóa)',
  topic: 'CHỦ ĐỀ: KIẾN THỨC TOÁN HỌC TRỌNG TÂM',
  subjectLabel: 'Toán THCS · Dữ liệu mẫu',
  crosswordType: 'VERTICAL_COLUMN',
  displayKeyword: 'TAM GIÁC',
  gridKeyword: 'TAMGIAC',
  acceptedKeywords: ['TAM GIÁC', 'TAM GIAC', 'TAMGIAC', 'HÌNH TAM GIÁC'],
  keywordClue:
    'Hình hình học phẳng gồm ba đoạn thẳng nối ba điểm không thẳng hàng, có tổng ba góc trong luôn bằng 180 độ.',
  keywordExplanation:
    'TAM GIÁC là đa giác cơ bản nhất trong hình học phẳng, nền tảng của định lí Pythagore, tỉ số lượng giác và các bài toán chứng minh hình học THCS.',
  isSample: true,
  rows: [
    {
      rowId: 'c05_math_r1',
      rowNumber: 1,
      clue: 'Điểm nằm giữa hai đầu đoạn thẳng và cách đều hai đầu đoạn thẳng đó.',
      displayAnswer: 'TRUNG ĐIỂM',
      gridAnswer: 'TRUNGDIEM',
      acceptedAnswers: ['TRUNG ĐIỂM', 'TRUNG DIEM', 'TRUNGDIEM'],
      keywordPosition1Based: 1, // T ở vị trí 1
      keywordIndex: 0,
      hint: 'Điểm chia đoạn thẳng AB thành hai phần bằng nhau MA = MB.',
      explanation: 'TRUNG ĐIỂM của đoạn thẳng là điểm nằm trên đoạn thẳng và chia đoạn thẳng đó thành hai đoạn bằng nhau.',
    },
    {
      rowId: 'c05_math_r2',
      rowNumber: 2,
      clue: 'Biểu thức đại số là một tổng của những đơn thức.',
      displayAnswer: 'ĐA THỨC',
      gridAnswer: 'DATHUC',
      acceptedAnswers: ['ĐA THỨC', 'DA THUC', 'DATHUC'],
      keywordPosition1Based: 2, // A ở vị trí 2 (D-A-T-H-U-C)
      keywordIndex: 1,
      hint: 'Ví dụ: x² + 2xy - 3 là một biểu thức thuộc loại này.',
      explanation: 'ĐA THỨC là một tổng của những đơn thức; mỗi đơn thức trong tổng gọi là một hạng tử của đa thức đó.',
    },
    {
      rowId: 'c05_math_r3',
      rowNumber: 3,
      clue: 'Số tự nhiên hoặc số nguyên khác 0 nằm ở phía dưới dấu gạch ngang của một phân số.',
      displayAnswer: 'MẪU SỐ',
      gridAnswer: 'MAUSO',
      acceptedAnswers: ['MẪU SỐ', 'MAU SO', 'MAUSO', 'MẪU'],
      keywordPosition1Based: 1, // M ở vị trí 1
      keywordIndex: 0,
      hint: 'Trong phân số a/b (b ≠ 0), a là tử số còn b được gọi là gì?',
      explanation: 'Trong phân số a/b, b (với b ≠ 0) là MẪU SỐ, cho biết đơn vị được chia thành bao nhiêu phần bằng nhau.',
    },
    {
      rowId: 'c05_math_r4',
      rowNumber: 4,
      clue: 'Góc có số đo bằng 90 độ.',
      displayAnswer: 'GÓC VUÔNG',
      gridAnswer: 'GOCVUONG',
      acceptedAnswers: ['GÓC VUÔNG', 'GOC VUONG', 'GOCVUONG'],
      keywordPosition1Based: 1, // G ở vị trí 1
      keywordIndex: 0,
      hint: 'Góc tạo bởi hai đường thẳng vuông góc với nhau, ký hiệu bằng ô vuông nhỏ ở đỉnh.',
      explanation: 'GÓC VUÔNG có số đo chính xác bằng 90°, bằng một nửa góc bẹt.',
    },
    {
      rowId: 'c05_math_r5',
      rowNumber: 5,
      clue: 'Đại lượng biểu thị phạm vi bề mặt của một hình phẳng, thường đo bằng cm², m².',
      displayAnswer: 'DIỆN TÍCH',
      gridAnswer: 'DIENTICH',
      acceptedAnswers: ['DIỆN TÍCH', 'DIEN TICH', 'DIENTICH'],
      keywordPosition1Based: 2, // I ở vị trí 2 (D-I-E-N-T-I-C-H)
      keywordIndex: 1,
      hint: 'Với hình chữ nhật, đại lượng này bằng chiều dài nhân với chiều rộng.',
      explanation: 'DIỆN TÍCH là số đo phần mặt phẳng giới hạn bởi một hình học phẳng.',
    },
    {
      rowId: 'c05_math_r6',
      rowNumber: 6,
      clue: 'Biểu thức dạng a/b với a, b là các số nguyên và b khác 0.',
      displayAnswer: 'PHÂN SỐ',
      gridAnswer: 'PHANSO',
      acceptedAnswers: ['PHÂN SỐ', 'PHAN SO', 'PHANSO'],
      keywordPosition1Based: 3, // A ở vị trí 3 (P-H-A-N-S-O)
      keywordIndex: 2,
      hint: 'Dùng để biểu diễn thương của phép chia số nguyên a cho số nguyên b (b ≠ 0).',
      explanation: 'PHÂN SỐ có dạng a/b (a, b ∈ ℤ, b ≠ 0), trong đó a là tử số và b là mẫu số.',
    },
    {
      rowId: 'c05_math_r7',
      rowNumber: 7,
      clue: 'Cạnh đối diện với góc vuông và là cạnh dài nhất trong tam giác vuông.',
      displayAnswer: 'CẠNH HUYỀN',
      gridAnswer: 'CANHHUYEN',
      acceptedAnswers: ['CẠNH HUYỀN', 'CANH HUYEN', 'CANHHUYEN'],
      keywordPosition1Based: 1, // C ở vị trí 1
      keywordIndex: 0,
      hint: 'Theo định lí Pythagore, bình phương cạnh này bằng tổng bình phương hai cạnh góc vuông.',
      explanation: 'Trong tam giác vuông, CẠNH HUYỀN là cạnh đối diện với góc vuông và luôn có độ dài lớn hơn mỗi cạnh góc vuông.',
    },
  ],
};

/**
 * BỘ MẪU 3 (KIỂU B – TỪ KHÓA ĐỘC LẬP): AN TOÀN TRÊN KHÔNG GIAN MẠNG
 * Các hàng ngang giải theo chủ đề; chữ gợi mở hiển thị trong khay manh mối (không tạo cột dọc).
 */
export const SAMPLE_C05_INDEPENDENT_KEYWORD_DATASET: C05CrosswordDataset = {
  datasetId: 'c05_sample_cyber_safety',
  title: 'An toàn trên Không gian mạng (Từ khóa độc lập)',
  topic: 'CHỦ ĐỀ: CÔNG DÂN SỐ & BẢO MẬT THÔNG TIN',
  subjectLabel: 'Tin học THCS · Dữ liệu mẫu',
  crosswordType: 'INDEPENDENT_KEYWORD',
  displayKeyword: 'BẢO MẬT',
  gridKeyword: 'BAOMAT',
  acceptedKeywords: ['BẢO MẬT', 'BAO MAT', 'BAOMAT', 'BẢO MẬT THÔNG TIN'],
  keywordClue:
    'Nguyên tắc cốt lõi giúp giữ gìn thông tin cá nhân, tài khoản và dữ liệu số không bị đánh cắp hoặc truy cập trái phép.',
  keywordExplanation:
    'BẢO MẬT thông tin số là kỹ năng thiết yếu của học sinh trong thời đại số: sử dụng mật khẩu mạnh, xác thực hai lớp và cảnh giác trước liên kết lừa đảo.',
  isSample: true,
  rows: [
    {
      rowId: 'c05_ind_r1',
      rowNumber: 1,
      clue: 'Chuỗi ký tự bí mật dùng để xác minh quyền truy cập vào tài khoản cá nhân.',
      displayAnswer: 'MẬT KHẨU',
      gridAnswer: 'MATKHAU',
      acceptedAnswers: ['MẬT KHẨU', 'MAT KHAU', 'MATKHAU', 'PASSWORD'],
      clueLetterForIndependent: 'B',
      hint: 'Cần kết hợp chữ hoa, chữ thường, chữ số và ký tự đặc biệt để tăng độ mạnh.',
      explanation: 'MẬT KHẨU (Password) là chìa khóa bảo vệ tài khoản trực tuyến khỏi sự xâm nhập trái phép.',
    },
    {
      rowId: 'c05_ind_r2',
      rowNumber: 2,
      clue: 'Chương trình hoặc đoạn mã độc hại có khả năng tự nhân bản và phá hoại dữ liệu máy tính.',
      displayAnswer: 'VIRUS',
      gridAnswer: 'VIRUS',
      acceptedAnswers: ['VIRUS', 'VI RÚT', 'VI RUT', 'VIRUS MÁY TÍNH'],
      clueLetterForIndependent: 'A',
      hint: 'Thường lây lan qua tệp đính kèm không rõ nguồn gốc hoặc thiết bị nhớ ngoài.',
      explanation: 'VIRUS máy tính là mã độc có khả năng tự sao chép và gây rối loạn hoạt động của hệ thống.',
    },
    {
      rowId: 'c05_ind_r3',
      rowNumber: 3,
      clue: 'Hệ thống phần cứng hoặc phần mềm giúp kiểm soát luồng dữ liệu ra vào mạng và ngăn chặn truy cập trái phép.',
      displayAnswer: 'TƯỜNG LỬA',
      gridAnswer: 'TUONGLUA',
      acceptedAnswers: ['TƯỜNG LỬA', 'TUONG LUA', 'TUONGLUA', 'FIREWALL'],
      clueLetterForIndependent: 'O',
      hint: 'Trong tiếng Anh được gọi là Firewall.',
      explanation: 'TƯỜNG LỬA (Firewall) đóng vai trò rào chắn an ninh giữa mạng nội bộ và mạng bên ngoài.',
    },
    {
      rowId: 'c05_ind_r4',
      rowNumber: 4,
      clue: 'Việc tạo bản sao dữ liệu dự phòng để khôi phục khi máy tính gặp sự cố.',
      displayAnswer: 'SAO LƯU',
      gridAnswer: 'SAOLUU',
      acceptedAnswers: ['SAO LƯU', 'SAO LUU', 'SAOLUU', 'BACKUP'],
      clueLetterForIndependent: 'M',
      hint: 'Thao tác giúp không bị mất tài liệu học tập quan trọng khi hỏng ổ cứng.',
      explanation: 'SAO LƯU (Backup) là biện pháp phòng ngừa mất mát dữ liệu hiệu quả nhất.',
    },
    {
      rowId: 'c05_ind_r5',
      rowNumber: 5,
      clue: 'Quyền của mỗi cá nhân trong việc kiểm soát thông tin đời sống riêng tư của mình trên mạng.',
      displayAnswer: 'RIÊNG TƯ',
      gridAnswer: 'RIENGTU',
      acceptedAnswers: ['RIÊNG TƯ', 'RIENG TU', 'RIENGTU', 'QUYỀN RIÊNG TƯ'],
      clueLetterForIndependent: 'A',
      hint: 'Không tự ý đăng tải ảnh hoặc số điện thoại của người khác khi chưa được đồng ý là tôn trọng quyền này.',
      explanation: 'Bảo vệ quyền RIÊNG TƯ giúp mỗi người an toàn và được tôn trọng trong môi trường số.',
    },
    {
      rowId: 'c05_ind_r6',
      rowNumber: 6,
      clue: 'Biến đổi dữ liệu sang dạng mật mã để người không có khóa giải mã không thể đọc được.',
      displayAnswer: 'MÃ HÓA',
      gridAnswer: 'MAHOA',
      acceptedAnswers: ['MÃ HÓA', 'MA HOA', 'MAHOA', 'ENCRYPTION'],
      clueLetterForIndependent: 'T',
      hint: 'Giao thức HTTPS sử dụng kỹ thuật này để bảo vệ dữ liệu truyền trên web.',
      explanation: 'MÃ HÓA (Encryption) đảm bảo tính bí mật của thông tin khi lưu trữ và truyền tải qua mạng.',
    },
  ],
};

export const BUILTIN_C05_DATASETS: C05CrosswordDataset[] = [
  SAMPLE_C05_DIGITAL_WORLD_DATASET,
  SAMPLE_C05_MATH_DATASET,
  SAMPLE_C05_INDEPENDENT_KEYWORD_DATASET,
];

// ============================================================================
// WEB AUDIO SYNTHESIZER FOR C05 ("BỨC TƯỜNG TRI THỨC")
// Prevents overlapping chimes when flipping multiple tiles!
// ============================================================================

class CrosswordSoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playSelectRow(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }

  public playLockAnswer(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.11, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }

  public playRowSolvedChord(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      // Single clean arpeggio chord (never spams per letter cell)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = ctx.currentTime + idx * 0.06;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {}
  }

  public playGentleRetryTone(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(349.23, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(293.66, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch {}
  }

  public playKeywordVictoryFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + idx * 0.09;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.48);
      });
    } catch {}
  }

  public stopAll(): void {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.close().catch(() => {});
      } catch {}
      this.ctx = null;
    }
  }
}

// ============================================================================
// PERSISTENCE MODEL (ISOLATED KEY: taydo_smart_edu_c05_active_session_v1)
// ============================================================================

interface C05PersistedSession {
  version: number;
  savedAt: number;
  dataset: C05CrosswordDataset;
  orgMode: C05OrgMode;
  rowTimeLimit: C05RowTimeLimit;
  maxAttemptsPerTurn: C05MaxAttempts;
  hintsEnabled: boolean;
  competitors: C05CompetitorEntity[];
  activeCompetitorIdx: number;
  rowStates: Record<string, C05RuntimeRowState>;
  selectedRowId: string | null;
  keywordStatus: C05KeywordStatus;
  keywordSolvedByEntityNames: string[];
  stagePhase: C05StagePhase;
  remainingMsSnapshot: number;
}

function loadC05PersistedSession(): C05PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(C05_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as C05PersistedSession;
    if (
      !parsed ||
      parsed.version !== C05_STORAGE_VERSION ||
      !parsed.dataset ||
      !Array.isArray(parsed.dataset.rows) ||
      Date.now() - parsed.savedAt > C05_SESSION_TTL_MS
    ) {
      window.localStorage.removeItem(C05_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(C05_STORAGE_KEY);
    } catch {}
    return null;
  }
}

function saveC05PersistedSession(session: C05PersistedSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(C05_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

function clearC05PersistedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(C05_STORAGE_KEY);
  } catch {}
}

// ============================================================================
// 3D EXTRUDED KNOWLEDGE BOOK & PODIUM ACCENT (SECTION 4)
// ============================================================================

const KnowledgeWall3DEmblem: React.FC = () => (
  <svg
    viewBox="0 0 120 96"
    className="w-20 h-16 shrink-0 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
    aria-label="Biểu tượng Bức Tường Tri Thức 3D"
  >
    <defs>
      <linearGradient id="c05GoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="c05CyanTile" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
    </defs>
    {/* 3D Podium Base */}
    <polygon points="14,78 60,90 106,78 60,66" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" />
    {/* 3D Open Knowledge Book */}
    <path
      d="M 22 68 Q 41 60 60 68 Q 79 60 98 68 L 94 42 Q 77 34 60 42 Q 43 34 26 42 Z"
      fill="#1E3A8A"
      stroke="url(#c05GoldGrad)"
      strokeWidth="2"
    />
    <line x1="60" y1="42" x2="60" y2="68" stroke="#FEF08A" strokeWidth="2" />
    {/* Floating 3D Extruded Letter Cubes above Book */}
    <rect x="28" y="14" width="18" height="18" rx="4" fill="url(#c05CyanTile)" stroke="#E0F2FE" strokeWidth="1.2" />
    <rect x="51" y="10" width="20" height="20" rx="4" fill="url(#c05GoldGrad)" stroke="#FEF9C3" strokeWidth="1.5" />
    <rect x="76" y="14" width="18" height="18" rx="4" fill="url(#c05CyanTile)" stroke="#E0F2FE" strokeWidth="1.2" />
    <text x="37" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900">C</text>
    <text x="61" y="24" textAnchor="middle" fill="#0F172A" fontSize="11" fontWeight="900">0</text>
    <text x="85" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900">5</text>
  </svg>
);

// ============================================================================
// MAIN COMPONENT: KnowledgeCrossword3DGame (C05 – Ô CHỮ KIẾN THỨC 3D)
// ============================================================================

export const KnowledgeCrossword3DGame: React.FC<KnowledgeCrossword3DGameProps> = ({
  allCandidates = [],
  absentIds = new Set(),
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onCloseGame,
}) => {
  // 1. Setup State
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    SAMPLE_C05_DIGITAL_WORLD_DATASET.datasetId
  );
  const [customDatasets, setCustomDatasets] = useState<C05CrosswordDataset[]>([]);
  const [showCustomBuilderModal, setShowCustomBuilderModal] = useState<boolean>(false);

  // Custom dataset quick editor state (allows teacher to create or test validation)
  const [draftTitle, setDraftTitle] = useState<string>('Bộ Ô chữ Tùy chỉnh');
  const [draftType, setDraftType] = useState<C05CrosswordType>('VERTICAL_COLUMN');
  const [draftDisplayKeyword, setDraftDisplayKeyword] = useState<string>('TIN HỌC');
  const [draftKeywordClue, setDraftKeywordClue] = useState<string>(
    'Ngành khoa học nghiên cứu việc thu thập, lưu trữ và xử lí thông tin tự động bằng máy tính.'
  );
  const [draftRowsText, setDraftRowsText] = useState<string>(
    [
      'THÔNG TIN | 1 | Nội dung hiểu biết về sự vật, sự việc mang lại cho con người. | Dữ liệu sau khi xử lí mang lại điều này.',
      'INTERNET | 1 | Mạng máy tính toàn cầu kết nối hàng tỷ thiết bị. | Mạng toàn cầu.',
      'PHẦN MỀM | 4 | Chương trình điều khiển máy tính thực hiện công việc. | Ví dụ: Word, Excel.',
      'CHUỘT | 2 | Thiết bị cầm tay điều khiển con trỏ trên màn hình. | Thiết bị trỏ.',
      'BỘ NHỚ | 4 | Nơi lưu trữ dữ liệu và chương trình trong máy tính. | Gồm RAM và ROM.',
      'MÁY CƠ | 4 | Công cụ truyền thống trước khi có máy tính điện tử. | Có chữ C ở vị trí 4.',
    ].join('\n')
  );
  const [customBuilderError, setCustomBuilderError] = useState<string | null>(null);

  const [orgMode, setOrgMode] = useState<C05OrgMode>('CLASS'); // Default: Cả lớp
  const [teamCount, setTeamCount] = useState<number>(3); // 2..6 teams
  const [rowTimeLimit, setRowTimeLimit] = useState<C05RowTimeLimit>(0); // Default: Không giới hạn
  const [maxAttemptsPerTurn, setMaxAttemptsPerTurn] = useState<C05MaxAttempts>(2); // Default: 2
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(true); // Default: Có gợi ý
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const allAvailableDatasets = useMemo<C05CrosswordDataset[]>(
    () => [...BUILTIN_C05_DATASETS, ...customDatasets],
    [customDatasets]
  );

  const activeDataset = useMemo<C05CrosswordDataset>(() => {
    return (
      allAvailableDatasets.find((d) => d.datasetId === selectedDatasetId) ||
      SAMPLE_C05_DIGITAL_WORLD_DATASET
    );
  }, [allAvailableDatasets, selectedDatasetId]);

  const datasetValidation = useMemo<C05DatasetValidationResult>(
    () => validateCrosswordDataset(activeDataset),
    [activeDataset]
  );

  // 2. Runtime Game State
  const [stagePhase, setStagePhase] = useState<C05StagePhase>('SETUP');
  const [competitors, setCompetitors] = useState<C05CompetitorEntity[]>([]);
  const [activeCompetitorIdx, setActiveCompetitorIdx] = useState<number>(0);
  const [rowStates, setRowStates] = useState<Record<string, C05RuntimeRowState>>({});
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [keywordStatus, setKeywordStatus] = useState<C05KeywordStatus>('LOCKED');
  const [keywordSolvedByEntityNames, setKeywordSolvedByEntityNames] = useState<string[]>([]);

  // Row answering input + IME composition state (Section 6)
  const [rowInputText, setRowInputText] = useState<string>('');
  const isImeComposingRef = useRef<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'SUCCESS' | 'RETRY' | 'EXHAUSTED' | 'REVEALED' | 'INFO';
    message: string;
  } | null>(null);
  const [showConfirmRevealRowModal, setShowConfirmRevealRowModal] = useState<boolean>(false);
  const [showConfirmRevealKeywordModal, setShowConfirmRevealKeywordModal] = useState<boolean>(false);

  // Keyword answering state (Early guess vs Simultaneous final round)
  const [keywordChallengerEntityId, setKeywordChallengerEntityId] = useState<string>('');
  const [keywordInputText, setKeywordInputText] = useState<string>('');
  const [simultaneousKeywordInputs, setSimultaneousKeywordInputs] = useState<Record<string, string>>({});
  const [showPostKeywordSolvedChoiceModal, setShowPostKeywordSolvedChoiceModal] = useState<boolean>(false);

  // Board Presentation Controls: Zoom & Focus Active Row (Section 14)
  const [boardZoom, setBoardZoom] = useState<'NORMAL' | 'LARGE'>('NORMAL');
  const [focusActiveRowOnly, setFocusActiveRowOnly] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Saved Session Restore Prompt
  const [savedSessionToRestore, setSavedSessionToRestore] = useState<C05PersistedSession | null>(() =>
    loadC05PersistedSession()
  );

  // 3. Single Deadline-Based Timer (Section 13)
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const deadlineRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const activeTurnTokenRef = useRef<number>(0);
  const isSubmittingLockRef = useRef<boolean>(false);

  // Sound & Voice Managers
  const soundRef = useRef<CrosswordSoundEngine>(new CrosswordSoundEngine());
  const voiceRef = useRef<SpaceRocketVoiceManager>(new SpaceRocketVoiceManager());

  useEffect(() => {
    soundRef.current.muted = isMuted;
    if (isMuted || !voiceEnabled) {
      voiceRef.current.cancel();
    }
  }, [isMuted, voiceEnabled]);

  useEffect(() => {
    const s = soundRef.current;
    const v = voiceRef.current;
    return () => {
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      s.stopAll();
      v.cancel();
    };
  }, []);

  const stopRowTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    deadlineRef.current = null;
  }, []);

  const speakVietnameseText = useCallback(
    (text: string) => {
      if (isMuted || !voiceEnabled) return;
      const res = voiceRef.current.speakVietnamese(text, isMuted || !voiceEnabled);
      if (!res.spoken && res.reason === 'no_vietnamese_voice') {
        setVoiceNotice(
          'Thiết bị chưa cài giọng đọc tiếng Việt (vi-VN). Trò chơi vẫn hoạt động bình thường với phụ đề trên màn hình.'
        );
      }
    },
    [isMuted, voiceEnabled]
  );

  // Derived Counts: Opened Rows, Unopened Rows, Keyword Eligibility (Section 10)
  const rowProgressStats = useMemo(() => {
    const total = activeDataset.rows.length;
    let solvedByPlayer = 0;
    let revealedByTeacher = 0;
    let unopened = 0;
    let hintsUsedCount = 0;

    activeDataset.rows.forEach((r) => {
      const st = rowStates[r.rowId];
      if (!st || st.status === 'UNOPENED') unopened += 1;
      else if (st.status === 'SOLVED_BY_PLAYER') solvedByPlayer += 1;
      else if (st.status === 'REVEALED_BY_TEACHER') revealedByTeacher += 1;
      if (st?.hintUsed) hintsUsedCount += 1;
    });

    const openedTotal = solvedByPlayer + revealedByTeacher;
    const minRequiredForKeyword = total <= 1 ? total : 2;
    const isKeywordUnlocked = openedTotal >= minRequiredForKeyword;
    const allRowsOpened = unopened === 0 && total > 0;

    return {
      total,
      solvedByPlayer,
      revealedByTeacher,
      openedTotal,
      unopened,
      hintsUsedCount,
      minRequiredForKeyword,
      isKeywordUnlocked,
      allRowsOpened,
    };
  }, [activeDataset.rows, rowStates]);

  const isKeywordAlreadyResolved =
    keywordStatus === 'SOLVED_EARLY_30' ||
    keywordStatus === 'SOLVED_FINAL_10' ||
    keywordStatus === 'REVEALED_BY_TEACHER';

  // Persist active session to isolated C05 storage key
  useEffect(() => {
    if (stagePhase === 'SETUP') return;
    if (stagePhase === 'FINISHED') {
      clearC05PersistedSession();
      return;
    }
    saveC05PersistedSession({
      version: C05_STORAGE_VERSION,
      savedAt: Date.now(),
      dataset: activeDataset,
      orgMode,
      rowTimeLimit,
      maxAttemptsPerTurn,
      hintsEnabled,
      competitors,
      activeCompetitorIdx,
      rowStates,
      selectedRowId,
      keywordStatus,
      keywordSolvedByEntityNames,
      stagePhase,
      remainingMsSnapshot: remainingMs,
    });
  }, [
    stagePhase,
    activeDataset,
    orgMode,
    rowTimeLimit,
    maxAttemptsPerTurn,
    hintsEnabled,
    competitors,
    activeCompetitorIdx,
    rowStates,
    selectedRowId,
    keywordStatus,
    keywordSolvedByEntityNames,
    remainingMs,
  ]);

  // ============================================================================
  // START & RESTORE SESSION
  // ============================================================================

  const buildInitialCompetitors = (): C05CompetitorEntity[] => {
    if (orgMode === 'CLASS') {
      return [
        {
          entityId: 'class_all',
          name: 'Cả lớp',
          colorHex: TEAM_PALETTE[0],
          score: 0,
          rowsSolvedCount: 0,
          turnsTakenCount: 0,
          usedEarlyKeywordGuess: false,
          wonKeywordPoints: 0,
        },
      ];
    }
    if (orgMode === 'TEAMS') {
      const safeTeamCount = Math.max(2, Math.min(6, teamCount));
      return Array.from({ length: safeTeamCount }, (_, idx) => ({
        entityId: `team_${idx + 1}`,
        name: `Đội ${idx + 1}`,
        colorHex: TEAM_PALETTE[idx % TEAM_PALETTE.length],
        score: 0,
        rowsSolvedCount: 0,
        turnsTakenCount: 0,
        usedEarlyKeywordGuess: false,
        wonKeywordPoints: 0,
      }));
    }
    // INDIVIDUAL mode: use present candidates (up to 8 active slots or fallback)
    const present = allCandidates.filter((c) => !absentIds.has(c.id));
    if (present.length > 0) {
      return present.slice(0, 50).map((c, idx) => ({
        entityId: `stu_${c.id}_${idx + 1}`,
        name: c.fullName,
        colorHex: TEAM_PALETTE[idx % TEAM_PALETTE.length],
        score: 0,
        rowsSolvedCount: 0,
        turnsTakenCount: 0,
        usedEarlyKeywordGuess: false,
        wonKeywordPoints: 0,
      }));
    }
    return Array.from({ length: 4 }, (_, idx) => ({
      entityId: `ind_${idx + 1}`,
      name: `Học sinh 0${idx + 1}`,
      colorHex: TEAM_PALETTE[idx % TEAM_PALETTE.length],
      score: 0,
      rowsSolvedCount: 0,
      turnsTakenCount: 0,
      usedEarlyKeywordGuess: false,
      wonKeywordPoints: 0,
    }));
  };

  const handleStartSession = () => {
    if (!datasetValidation.valid) return;
    stopRowTimer();
    voiceRef.current.cancel();

    const initCompetitors = buildInitialCompetitors();
    const initRowStates: Record<string, C05RuntimeRowState> = {};
    activeDataset.rows.forEach((r) => {
      initRowStates[r.rowId] = {
        rowId: r.rowId,
        status: 'UNOPENED',
        hintUsed: false,
        revealedLetterIndex: null,
        solvedByEntityId: null,
        solvedByEntityName: null,
        pointsAwarded: 0,
        attemptsUsedInCurrentTurn: 0,
      };
    });

    setCompetitors(initCompetitors);
    setActiveCompetitorIdx(0);
    setRowStates(initRowStates);
    setSelectedRowId(null);
    setKeywordStatus('LOCKED');
    setKeywordSolvedByEntityNames([]);
    setFeedbackBanner(null);
    setRowInputText('');
    setKeywordInputText('');
    setIsPaused(false);
    setSavedSessionToRestore(null);
    setStagePhase('SELECTING_ROW');
    soundRef.current.playSelectRow();
  };

  const handleRestoreSavedSession = () => {
    if (!savedSessionToRestore) return;
    const s = savedSessionToRestore;
    if (!BUILTIN_C05_DATASETS.some((d) => d.datasetId === s.dataset.datasetId)) {
      setCustomDatasets((prev) => [
        ...prev.filter((d) => d.datasetId !== s.dataset.datasetId),
        s.dataset,
      ]);
    }
    setSelectedDatasetId(s.dataset.datasetId);
    setOrgMode(s.orgMode);
    setRowTimeLimit(s.rowTimeLimit);
    setMaxAttemptsPerTurn(s.maxAttemptsPerTurn);
    setHintsEnabled(s.hintsEnabled);
    setCompetitors(s.competitors);
    setActiveCompetitorIdx(s.activeCompetitorIdx);
    setRowStates(s.rowStates);
    setSelectedRowId(s.selectedRowId);
    setKeywordStatus(s.keywordStatus);
    setKeywordSolvedByEntityNames(s.keywordSolvedByEntityNames || []);
    setRemainingMs(s.remainingMsSnapshot || s.rowTimeLimit * 1000);
    setStagePhase(s.stagePhase === 'ROW_ACTIVE' ? 'SELECTING_ROW' : s.stagePhase);
    setSavedSessionToRestore(null);
  };

  const handleDiscardSavedSession = () => {
    clearC05PersistedSession();
    setSavedSessionToRestore(null);
  };

  // ============================================================================
  // ROW SELECTION, TIMER, HINT & SUBMISSION (SECTIONS 8, 9, 11, 13)
  // ============================================================================

  const selectedRowConfig = useMemo<C05CrosswordRowConfig | null>(() => {
    if (!selectedRowId) return null;
    return activeDataset.rows.find((r) => r.rowId === selectedRowId) || null;
  }, [activeDataset.rows, selectedRowId]);

  const selectedRowRuntime = useMemo<C05RuntimeRowState | null>(() => {
    if (!selectedRowId) return null;
    return rowStates[selectedRowId] || null;
  }, [rowStates, selectedRowId]);

  const activeCompetitor = competitors[activeCompetitorIdx] || competitors[0] || null;

  const advanceTurnToNextCompetitor = useCallback(() => {
    setCompetitors((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((c, idx) =>
        idx === activeCompetitorIdx
          ? { ...c, turnsTakenCount: c.turnsTakenCount + 1 }
          : c
      );
    });
    if (competitors.length > 1) {
      setActiveCompetitorIdx((prev) => (prev + 1) % competitors.length);
    }
  }, [activeCompetitorIdx, competitors.length]);

  const handleSelectRowToPlay = (row: C05CrosswordRowConfig) => {
    const st = rowStates[row.rowId];
    if (!st) return;

    // If row is already opened, just focus it to view explanation
    if (st.status !== 'UNOPENED') {
      setSelectedRowId(row.rowId);
      setFeedbackBanner({
        type: 'INFO',
        message: `Hàng ngang số ${row.rowNumber} đã mở: ${row.displayAnswer} — ${row.explanation}`,
      });
      return;
    }

    stopRowTimer();
    voiceRef.current.cancel();
    activeTurnTokenRef.current += 1;
    const token = activeTurnTokenRef.current;

    setSelectedRowId(row.rowId);
    setRowInputText('');
    setFeedbackBanner(null);
    setRowStates((prev) => ({
      ...prev,
      [row.rowId]: {
        ...prev[row.rowId],
        attemptsUsedInCurrentTurn: 0,
      },
    }));
    setStagePhase('ROW_ACTIVE');
    soundRef.current.playSelectRow();

    if (rowTimeLimit > 0) {
      const durationMs = rowTimeLimit * 1000;
      const targetDeadline = Date.now() + durationMs;
      deadlineRef.current = targetDeadline;
      setRemainingMs(durationMs);

      timerIntervalRef.current = window.setInterval(() => {
        if (activeTurnTokenRef.current !== token) {
          stopRowTimer();
          return;
        }
        if (!deadlineRef.current) return;
        const left = Math.max(0, deadlineRef.current - Date.now());
        setRemainingMs(left);
        if (left <= 0) {
          stopRowTimer();
          soundRef.current.playGentleRetryTone();
          setStagePhase('ROW_FEEDBACK');
          setFeedbackBanner({
            type: 'EXHAUSTED',
            message: `Hết thời gian cho lượt giải Hàng ${row.rowNumber}! Hàng vẫn giữ trạng thái chưa mở để lượt sau hoặc giáo viên công bố.`,
          });
        }
      }, 200);
    } else {
      setRemainingMs(0);
    }
  };

  // Use Hint on Current Row (Section 11: max 1 per row, persists across turns, caps row max score at 5)
  const handleUseRowHint = () => {
    if (!selectedRowConfig || !selectedRowRuntime || stagePhase !== 'ROW_ACTIVE') return;
    if (!hintsEnabled) return;
    if (selectedRowRuntime.hintUsed) return;

    const cells = splitGridCells(
      normalizeVietnameseCrosswordGrid(selectedRowConfig.gridAnswer, true)
    );
    const hasTextHint = Boolean(selectedRowConfig.hint && selectedRowConfig.hint.trim());

    // Find a safe non-keyword index to reveal if possible
    const candidateIndices = cells
      .map((_, idx) => idx)
      .filter((idx) => idx !== selectedRowConfig.keywordIndex);

    if (!hasTextHint && candidateIndices.length === 0) {
      setFeedbackBanner({
        type: 'INFO',
        message: 'Hàng ngang này không có gợi ý phụ. Không tiêu hao quyền gợi ý và không giảm điểm.',
      });
      return;
    }

    const revealIdx = candidateIndices.length > 0 ? candidateIndices[0] : null;
    setRowStates((prev) => ({
      ...prev,
      [selectedRowConfig.rowId]: {
        ...prev[selectedRowConfig.rowId],
        hintUsed: true,
        revealedLetterIndex: revealIdx,
      },
    }));
  };

  // Submit Row Answer (Section 6, 8, 9)
  const handleSubmitRowAnswer = () => {
    if (isSubmittingLockRef.current) return;
    if (!selectedRowConfig || !selectedRowRuntime || stagePhase !== 'ROW_ACTIVE') return;

    const trimmed = rowInputText.trim();
    if (!trimmed) {
      // Section 8: Do NOT consume an attempt if user clicks Submit when input is empty
      setFeedbackBanner({
        type: 'INFO',
        message: 'Vui lòng nhập đáp án trước khi bấm Chốt (không bị trừ lượt thử khi ô nhập đang trống).',
      });
      return;
    }

    isSubmittingLockRef.current = true;
    window.setTimeout(() => {
      isSubmittingLockRef.current = false;
    }, 300);

    soundRef.current.playLockAnswer();
    const isCorrect = isRowAnswerAccepted(trimmed, selectedRowConfig);

    if (isCorrect) {
      stopRowTimer();
      const awardedPoints = selectedRowRuntime.hintUsed ? 5 : 10;
      const solverId = activeCompetitor?.entityId || 'class_all';
      const solverName = activeCompetitor?.name || 'Cả lớp';

      setRowStates((prev) => ({
        ...prev,
        [selectedRowConfig.rowId]: {
          ...prev[selectedRowConfig.rowId],
          status: 'SOLVED_BY_PLAYER',
          solvedByEntityId: solverId,
          solvedByEntityName: solverName,
          pointsAwarded: awardedPoints,
        },
      }));

      setCompetitors((prev) =>
        prev.map((c, idx) =>
          idx === activeCompetitorIdx
            ? {
                ...c,
                score: c.score + awardedPoints,
                rowsSolvedCount: c.rowsSolvedCount + 1,
              }
            : c
        )
      );

      setStagePhase('ROW_FEEDBACK');
      setFeedbackBanner({
        type: 'SUCCESS',
        message: `Chính xác! ${solverName} nhận +${awardedPoints} điểm. Đáp án chuẩn: "${selectedRowConfig.displayAnswer}".`,
      });
      soundRef.current.playRowSolvedChord();
    } else {
      const nextAttemptsUsed = selectedRowRuntime.attemptsUsedInCurrentTurn + 1;
      setRowStates((prev) => ({
        ...prev,
        [selectedRowConfig.rowId]: {
          ...prev[selectedRowConfig.rowId],
          attemptsUsedInCurrentTurn: nextAttemptsUsed,
        },
      }));

      if (nextAttemptsUsed < maxAttemptsPerTurn) {
        soundRef.current.playGentleRetryTone();
        setFeedbackBanner({
          type: 'RETRY',
          message: `Chưa chính xác! Bạn còn ${maxAttemptsPerTurn - nextAttemptsUsed} lần thử trong lượt này.`,
        });
      } else {
        stopRowTimer();
        soundRef.current.playGentleRetryTone();
        setStagePhase('ROW_FEEDBACK');
        setFeedbackBanner({
          type: 'EXHAUSTED',
          message: `Chưa chính xác và đã hết ${maxAttemptsPerTurn} lần thử của lượt này. Hàng ngang vẫn giữ ẩn để lượt tiếp theo cùng suy luận!`,
        });
      }
    }
  };

  // Teacher reveals row for learning ("Công bố hàng" — 0 points, requires confirmation, Section 8)
  const handleConfirmTeacherRevealRow = () => {
    if (!selectedRowConfig) return;
    stopRowTimer();
    setShowConfirmRevealRowModal(false);

    setRowStates((prev) => ({
      ...prev,
      [selectedRowConfig.rowId]: {
        ...prev[selectedRowConfig.rowId],
        status: 'REVEALED_BY_TEACHER',
        solvedByEntityId: null,
        solvedByEntityName: 'Được công bố',
        pointsAwarded: 0,
      },
    }));

    setStagePhase('ROW_FEEDBACK');
    setFeedbackBanner({
      type: 'REVEALED',
      message: `Giáo viên đã công bố Hàng ${selectedRowConfig.rowNumber}: "${selectedRowConfig.displayAnswer}" (0 điểm – Mở để học tập).`,
    });
    soundRef.current.playRowSolvedChord();
  };

  const handleFinishRowTurnAndContinue = () => {
    stopRowTimer();
    advanceTurnToNextCompetitor();
    setSelectedRowId(null);
    setRowInputText('');
    setFeedbackBanner(null);

    // If all rows are now opened and keyword is not yet solved, offer Final Keyword Round!
    if (rowProgressStats.allRowsOpened && !isKeywordAlreadyResolved) {
      if (orgMode === 'TEAMS') {
        const initSim: Record<string, string> = {};
        competitors.forEach((c) => {
          initSim[c.entityId] = '';
        });
        setSimultaneousKeywordInputs(initSim);
        setStagePhase('FINAL_SIMULTANEOUS_KEYWORD');
      } else {
        setKeywordChallengerEntityId(competitors[0]?.entityId || 'class_all');
        setKeywordInputText('');
        setStagePhase('KEYWORD_CHALLENGE');
      }
      return;
    }

    if (rowProgressStats.allRowsOpened && isKeywordAlreadyResolved) {
      setStagePhase('FINISHED');
      return;
    }

    setStagePhase('SELECTING_ROW');
  };

  // ============================================================================
  // KEYWORD SOLVING HANDLERS (SECTION 10)
  // ============================================================================

  const handleOpenKeywordChallenge = () => {
    if (!rowProgressStats.isKeywordUnlocked || isKeywordAlreadyResolved) return;
    stopRowTimer();

    if (rowProgressStats.allRowsOpened && orgMode === 'TEAMS') {
      const initSim: Record<string, string> = {};
      competitors.forEach((c) => {
        initSim[c.entityId] = '';
      });
      setSimultaneousKeywordInputs(initSim);
      setStagePhase('FINAL_SIMULTANEOUS_KEYWORD');
      return;
    }

    // Find first competitor eligible for early guess (or any competitor if allRowsOpened)
    const eligibleChallenger = rowProgressStats.allRowsOpened
      ? competitors[activeCompetitorIdx] || competitors[0]
      : competitors.find((c) => !c.usedEarlyKeywordGuess) || competitors[0];

    setKeywordChallengerEntityId(eligibleChallenger?.entityId || 'class_all');
    setKeywordInputText('');
    setFeedbackBanner(null);
    setStagePhase('KEYWORD_CHALLENGE');
  };

  const handleSubmitSingleKeywordGuess = () => {
    const trimmed = keywordInputText.trim();
    if (!trimmed) return;

    const challenger =
      competitors.find((c) => c.entityId === keywordChallengerEntityId) || competitors[0];
    if (!challenger) return;

    const isEarlyGuess = !rowProgressStats.allRowsOpened;
    if (isEarlyGuess && challenger.usedEarlyKeywordGuess) {
      setFeedbackBanner({
        type: 'INFO',
        message: `${challenger.name} đã sử dụng quyền đoán sớm từ khóa trong phiên này (tối đa 1 lần đoán sớm).`,
      });
      return;
    }

    const isCorrect = isKeywordAnswerAccepted(trimmed, activeDataset);

    if (isCorrect) {
      const points = isEarlyGuess ? 30 : 10;
      setKeywordStatus(isEarlyGuess ? 'SOLVED_EARLY_30' : 'SOLVED_FINAL_10');
      setKeywordSolvedByEntityNames([challenger.name]);

      setCompetitors((prev) =>
        prev.map((c) =>
          c.entityId === challenger.entityId
            ? {
                ...c,
                score: c.score + points,
                usedEarlyKeywordGuess: isEarlyGuess ? true : c.usedEarlyKeywordGuess,
                wonKeywordPoints: points,
              }
            : c
        )
      );

      soundRef.current.playKeywordVictoryFanfare();
      speakVietnameseText(
        `Chúc mừng ${challenger.name} đã giải đúng từ khóa chủ đề ${activeDataset.displayKeyword} và nhận ${points} điểm!`
      );

      if (rowProgressStats.unopened > 0) {
        // Section 10: Let teacher choose whether to finish now or continue remaining rows for consolidation
        setShowPostKeywordSolvedChoiceModal(true);
      } else {
        setStagePhase('FINISHED');
      }
    } else {
      // Wrong early guess: 0 penalty, do NOT reveal keyword, still allowed to solve rows and join final round
      soundRef.current.playGentleRetryTone();
      if (isEarlyGuess) {
        setCompetitors((prev) =>
          prev.map((c) =>
            c.entityId === challenger.entityId ? { ...c, usedEarlyKeywordGuess: true } : c
          )
        );
        setFeedbackBanner({
          type: 'RETRY',
          message: `${challenger.name} đoán từ khóa chưa chính xác (không bị trừ điểm, vẫn được giải hàng ngang và tham gia lượt giải cuối).`,
        });
        setStagePhase('SELECTING_ROW');
      } else {
        setFeedbackBanner({
          type: 'RETRY',
          message: `Đáp án từ khóa chưa chính xác. Bạn có thể thử lại hoặc giáo viên bấm Công bố từ khóa.`,
        });
      }
    }
  };

  // Simultaneous Final Keyword Grading for Teams when all rows are opened (Section 10)
  const handleConfirmSimultaneousTeamKeywordRound = () => {
    const winners: string[] = [];

    setCompetitors((prev) =>
      prev.map((team) => {
        const teamAns = simultaneousKeywordInputs[team.entityId] || '';
        const correct = isKeywordAnswerAccepted(teamAns, activeDataset);
        if (correct) {
          winners.push(team.name);
          return {
            ...team,
            score: team.score + 10,
            wonKeywordPoints: 10,
          };
        }
        return team;
      })
    );

    if (winners.length > 0) {
      setKeywordStatus('SOLVED_FINAL_10');
      setKeywordSolvedByEntityNames(winners);
      soundRef.current.playKeywordVictoryFanfare();
    } else {
      setKeywordStatus('REVEALED_BY_TEACHER');
      setKeywordSolvedByEntityNames([]);
      soundRef.current.playRowSolvedChord();
    }
    setStagePhase('FINISHED');
  };

  const handleTeacherRevealKeyword = () => {
    setShowConfirmRevealKeywordModal(false);
    setKeywordStatus('REVEALED_BY_TEACHER');
    setKeywordSolvedByEntityNames([]);
    soundRef.current.playRowSolvedChord();
    if (rowProgressStats.unopened > 0) {
      setShowPostKeywordSolvedChoiceModal(true);
    } else {
      setStagePhase('FINISHED');
    }
  };

  // ============================================================================
  // CUSTOM DATASET BUILDER HANDLER (Validates before adding)
  // ============================================================================

  const handleSaveCustomDataset = () => {
    setCustomBuilderError(null);
    const normKeyword = normalizeVietnameseCrosswordGrid(draftDisplayKeyword, true);
    if (!normKeyword) {
      setCustomBuilderError('Vui lòng nhập Từ khóa chủ đề.');
      return;
    }

    const lines = draftRowsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedRows: C05CrosswordRowConfig[] = lines.map((line, idx) => {
      const parts = line.split('|').map((p) => p.trim());
      const displayAns = parts[0] || '';
      const pos1Based = Number(parts[1]) || 1;
      const clue = parts[2] || '';
      const hint = parts[3] || '';
      const gridAns = normalizeVietnameseCrosswordGrid(displayAns, true);
      return {
        rowId: `custom_r_${idx + 1}`,
        rowNumber: idx + 1,
        clue,
        displayAnswer: displayAns,
        gridAnswer: gridAns,
        acceptedAnswers: [displayAns, gridAns],
        keywordPosition1Based: pos1Based,
        keywordIndex: pos1Based - 1,
        clueLetterForIndependent: gridAns[0] || '',
        hint,
        explanation: `Đáp án chuẩn: ${displayAns} — ${clue}`,
      };
    });

    const candidateDataset: C05CrosswordDataset = {
      datasetId: `c05_custom_${Date.now()}`,
      title: draftTitle.trim() || 'Bộ Ô chữ Tùy chỉnh',
      topic: `CHỦ ĐỀ: ${(draftTitle || 'TÙY CHỈNH').toUpperCase()}`,
      subjectLabel: 'Bộ giáo viên kiểm tra',
      crosswordType: draftType,
      displayKeyword: draftDisplayKeyword.trim(),
      gridKeyword: normKeyword,
      acceptedKeywords: [draftDisplayKeyword.trim(), normKeyword],
      keywordClue: draftKeywordClue.trim() || 'Gợi ý từ khóa chủ đề.',
      keywordExplanation: `Từ khóa chủ đề: ${draftDisplayKeyword.trim()}.`,
      rows: parsedRows,
      isSample: false,
    };

    const validation = validateCrosswordDataset(candidateDataset);
    if (!validation.valid) {
      setCustomBuilderError(
        validation.issues.map((iss) => `• ${iss.message}`).join('\n')
      );
      return;
    }

    setCustomDatasets((prev) => [...prev, candidateDataset]);
    setSelectedDatasetId(candidateDataset.datasetId);
    setShowCustomBuilderModal(false);
  };

  // ============================================================================
  // RENDER: 1. SETUP SCREEN (SECTION 7)
  // ============================================================================

  if (stagePhase === 'SETUP') {
    return (
      <div className="w-full rounded-3xl bg-gradient-to-b from-[#061024] via-[#0B1D3E] to-[#08132A] text-white border border-sky-400/30 shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-sky-400/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onCloseGame && (
              <button
                type="button"
                onClick={onCloseGame}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Quay lại Thư viện</span>
              </button>
            )}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                C05 · Ô CHỮ KIẾN THỨC 3D · NHÓM C: CỦNG CỐ KIẾN THỨC
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                BỨC TƯỜNG TRI THỨC – KHÁM PHÁ TỪ KHÓA CHỦ ĐỀ
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
              <span>{isMuted ? 'Đang tắt âm' : 'Âm thanh: Bật'}</span>
            </button>
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Saved Session Restore Banner */}
        {savedSessionToRestore && (
          <div className="mx-5 mt-4 p-4 rounded-2xl bg-amber-500/15 border border-amber-400/50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-amber-200">
                Phát hiện phiên chơi C05 đang dở: {savedSessionToRestore.dataset.title}
              </div>
              <div className="text-xs text-slate-300">
                Đã mở{' '}
                {
                  Object.values(savedSessionToRestore.rowStates).filter(
                    (r) => r.status !== 'UNOPENED'
                  ).length
                }
                /{savedSessionToRestore.dataset.rows.length} hàng ngang
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreSavedSession}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Tiếp tục phiên đang dở
              </button>
              <button
                type="button"
                onClick={handleDiscardSavedSession}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Bắt đầu phiên mới
              </button>
            </div>
          </div>
        )}

        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Dataset Selection + Organization + Timing */}
          <div className="lg:col-span-7 space-y-5">
            {/* Hero Stage Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0F244A] via-[#132C5C] to-[#0B1936] border border-amber-400/30 flex items-center gap-4">
              <KnowledgeWall3DEmblem />
              <div className="space-y-1">
                <div className="text-xs font-bold text-cyan-300">
                  SÂN KHẤU 3D · BẢNG KHỐI CHỮ NỔI · CỘT TỪ KHÓA VÀNG
                </div>
                <h3 className="text-lg font-black text-amber-300">
                  Bức Tường Tri Thức Tây Đô Smart EDU
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ô chữ hiển thị <strong>CHỮ IN HOA KHÔNG DẤU</strong> (bỏ khoảng trắng, chuyển Đ → D). Sau khi giải đúng mỗi hàng, hệ thống lật mở chữ nổi 3D và hiển thị đáp án chuẩn đầy đủ dấu kèm giải thích.
                </p>
              </div>
            </div>

            {/* 1. Chọn Bộ Ô chữ & Kiểu cấu trúc */}
            <div className="p-5 rounded-2xl bg-slate-900/75 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                  1. Chọn bộ Ô chữ chủ đề
                </label>
                <button
                  type="button"
                  onClick={() => setShowCustomBuilderModal(true)}
                  className="text-xs font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  + Tạo / Kiểm tra bộ ô chữ tùy chỉnh
                </button>
              </div>

              <div className="space-y-2.5">
                {allAvailableDatasets.map((ds) => {
                  const isSelected = ds.datasetId === activeDataset.datasetId;
                  return (
                    <button
                      key={ds.datasetId}
                      type="button"
                      onClick={() => setSelectedDatasetId(ds.datasetId)}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 border-cyan-400 shadow-lg shadow-cyan-500/10'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-black text-white">{ds.title}</span>
                        <span className="text-[11px] font-bold text-amber-300">
                          {ds.crosswordType === 'VERTICAL_COLUMN'
                            ? `Kiểu A: Cột từ khóa dọc (${ds.rows.length} hàng)`
                            : `Kiểu B: Từ khóa độc lập (${ds.rows.length} hàng)`}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-300 flex flex-wrap items-center gap-2">
                        <span>{ds.subjectLabel}</span>
                        <span>·</span>
                        <span>Số hàng ngang: {ds.rows.length}</span>
                        {ds.isSample && (
                          <>
                            <span>·</span>
                            <span className="text-cyan-300 font-semibold">Dữ liệu mẫu</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Validation Feedback for Selected Dataset (Section 12) */}
              {!datasetValidation.valid ? (
                <div className="p-4 rounded-xl bg-rose-500/20 border border-rose-400/60 space-y-2 text-xs text-rose-200">
                  <div className="font-black flex items-center gap-1.5 text-rose-300">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Bộ ô chữ có lỗi cấu trúc cột khóa (Đã chặn bắt đầu):</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {datasetValidation.issues.map((iss, idx) => (
                      <li key={idx}>{iss.message}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 flex items-center justify-between">
                  <span>
                    Kiểm tra cấu trúc hợp lệ: {activeDataset.rows.length} hàng ngang ·{' '}
                    {activeDataset.crosswordType === 'VERTICAL_COLUMN'
                      ? `Cột từ khóa thẳng cột tại cột #${datasetValidation.keywordColumnIndex0Based + 1} (tổng rộng ${datasetValidation.totalGridColumns} ô)`
                      : 'Khay manh mối từ khóa độc lập'}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
              )}
            </div>

            {/* 2. Tổ chức lớp, Thời gian & Lượt thử */}
            <div className="p-5 rounded-2xl bg-slate-900/75 border border-slate-700/80 space-y-4">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                2. Hình thức tổ chức & Thông số lượt chơi
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { key: 'CLASS', label: 'Cả lớp (Mặc định)' },
                  { key: 'TEAMS', label: 'Thi đấu Đội (2–6 đội)' },
                  { key: 'INDIVIDUAL', label: 'Cá nhân luân phiên' },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setOrgMode(m.key as C05OrgMode)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black border cursor-pointer ${
                      orgMode === m.key
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {orgMode === 'TEAMS' && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Số lượng đội thi đấu:</span>
                  <div className="flex items-center gap-1.5">
                    {[2, 3, 4, 5, 6].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setTeamCount(cnt)}
                        className={`w-9 py-1.5 rounded-lg text-xs font-black border cursor-pointer ${
                          teamCount === cnt
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">Thời gian mỗi hàng ngang:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {([0, 30, 45, 60, 90] as C05RowTimeLimit[]).map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setRowTimeLimit(sec)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                          rowTimeLimit === sec
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-950/70 text-slate-300 border-slate-800'
                        }`}
                      >
                        {sec === 0 ? 'Không giới hạn' : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">Số lần thử mỗi lượt:</div>
                  <div className="flex gap-2">
                    {([1, 2] as C05MaxAttempts[]).map((att) => (
                      <button
                        key={att}
                        type="button"
                        onClick={() => setMaxAttemptsPerTurn(att)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                          maxAttemptsPerTurn === att
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                            : 'bg-slate-950/70 text-slate-300 border-slate-800'
                        }`}
                      >
                        {att} lần thử / lượt
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">Cho phép Gợi ý</span>
                  <input
                    type="checkbox"
                    checked={hintsEnabled}
                    onChange={(e) => setHintsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">Giọng đọc tiếng Việt</span>
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">Giảm chuyển động</span>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Transparent Scoring & Rules Summary + Start Button */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/75 border border-slate-700/80 space-y-4">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              3. Luật chơi & Thang điểm minh bạch
            </div>

            <div className="space-y-3 text-xs text-slate-200 leading-relaxed bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
              <div>
                <strong className="text-cyan-300">• Quy tắc hiển thị & chấm tiếng Việt:</strong>
                <p className="text-slate-300 mt-0.5">
                  Các ô chữ hiển thị <strong>CHỮ IN HOA KHÔNG DẤU</strong> (bỏ khoảng trắng, chuyển Đ → D). Khi nhập có thể gõ có dấu hoặc không dấu đều được chấp nhận theo biến thể chuẩn.
                </p>
              </div>

              <div>
                <strong className="text-emerald-300">• Điểm giải Hàng ngang:</strong>
                <ul className="list-disc pl-5 mt-0.5 text-slate-300 space-y-0.5">
                  <li>Giải đúng không dùng gợi ý: <strong>+10 điểm</strong>.</li>
                  <li>Giải đúng sau khi đã mở gợi ý của hàng: <strong>+5 điểm</strong> (gợi ý đã công khai giữ hiệu lực toàn phiên).</li>
                  <li>Trả lời sai, hết giờ hoặc giáo viên bấm “Công bố hàng”: <strong>0 điểm</strong> (không trừ điểm).</li>
                </ul>
              </div>

              <div>
                <strong className="text-amber-300">• Luật giải Từ khóa chủ đề:</strong>
                <ul className="list-disc pl-5 mt-0.5 text-slate-300 space-y-0.5">
                  <li>Mở khóa sau khi đã mở ít nhất <strong>2 hàng ngang</strong>.</li>
                  <li>Giải đúng khi còn ít nhất 1 hàng chưa mở: <strong>+30 điểm</strong> (mỗi người/đội tối đa 1 lần đoán sớm; đoán sai không bị trừ điểm và vẫn được giải hàng ngang).</li>
                  <li>Giải đúng sau khi tất cả hàng đã mở: <strong>+10 điểm</strong> (ở chế độ Đội, các đội chấm đồng thời ở lượt cuối để không lộ đáp án).</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              disabled={!datasetValidation.valid}
              onClick={handleStartSession}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 disabled:opacity-40 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5" />
              <span>BẮT ĐẦU KHÁM PHÁ Ô CHỮ 3D</span>
            </button>
          </div>
        </div>

        {/* Custom Dataset Validator Modal */}
        {showCustomBuilderModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-cyan-400/50 p-6 space-y-4 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-cyan-300">
                  Tạo & Kiểm tra Bộ Ô chữ Tùy chỉnh (Kiểm tra cột khóa tự động)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCustomBuilderModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Tên bộ ô chữ:</label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Kiểu cấu trúc:</label>
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as C05CrosswordType)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="VERTICAL_COLUMN">Kiểu A: Ô chữ có cột từ khóa dọc</option>
                    <option value="INDEPENDENT_KEYWORD">Kiểu B: Ô chữ có từ khóa độc lập</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Từ khóa chuẩn (có dấu):</label>
                  <input
                    type="text"
                    value={draftDisplayKeyword}
                    onChange={(e) => setDraftDisplayKeyword(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Gợi ý từ khóa:</label>
                  <input
                    type="text"
                    value={draftKeywordClue}
                    onChange={(e) => setDraftKeywordClue(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="text-xs space-y-1">
                <label className="block font-bold text-slate-300">
                  Danh sách hàng ngang (Mỗi dòng: <code>Đáp án có dấu | Vị trí chữ khóa (1-based) | Gợi ý chính | Gợi ý phụ</code>):
                </label>
                <textarea
                  rows={6}
                  value={draftRowsText}
                  onChange={(e) => setDraftRowsText(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                />
              </div>

              {customBuilderError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-xs text-rose-200 whitespace-pre-line">
                  {customBuilderError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomBuilderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomDataset}
                  className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Kiểm tra & Sử dụng bộ này
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER: 2. FINISHED SUMMARY SCREEN (SECTION 18)
  // ============================================================================

  if (stagePhase === 'FINISHED') {
    const sortedCompetitors = [...competitors].sort((a, b) => b.score - a.score);
    const topScore = sortedCompetitors[0]?.score ?? 0;
    const tiedTopCount = sortedCompetitors.filter((c) => c.score === topScore).length;
    const unevenTurns =
      competitors.length > 1 &&
      new Set(competitors.map((c) => c.turnsTakenCount)).size > 1;

    return (
      <div className="w-full rounded-3xl bg-gradient-to-b from-[#061024] via-[#0B1D3E] to-[#08132A] text-white border border-amber-400/40 shadow-2xl overflow-hidden p-5 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              TỔNG KẾT BỨC TƯỜNG TRI THỨC · C05 – Ô CHỮ KIẾN THỨC 3D
            </div>
            <h2 className="text-2xl font-black text-white mt-0.5">{activeDataset.title}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleStartSession}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Chơi lại</span>
            </button>
            <button
              type="button"
              onClick={() => setStagePhase('SETUP')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Chọn bộ khác</span>
            </button>
            {onCloseGame && (
              <button
                type="button"
                onClick={onCloseGame}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Về thư viện</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Overview Metrics (Clean unboxed typography) */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-amber-400/30 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
            <span>
              Hàng giải đúng:{' '}
              <strong className="text-emerald-300">
                {rowProgressStats.solvedByPlayer}/{rowProgressStats.total}
              </strong>
            </span>
            <span>·</span>
            <span>
              Hàng được giáo viên công bố:{' '}
              <strong className="text-amber-300">{rowProgressStats.revealedByTeacher}</strong>
            </span>
            <span>·</span>
            <span>
              Hàng chưa mở (không tính là sai):{' '}
              <strong className="text-slate-200">{rowProgressStats.unopened}</strong>
            </span>
            <span>·</span>
            <span>
              Số gợi ý đã dùng:{' '}
              <strong className="text-cyan-300">{rowProgressStats.hintsUsedCount}</strong>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-400/50 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              TỪ KHÓA CHỦ ĐỀ: {activeDataset.displayKeyword} ({activeDataset.gridKeyword})
            </div>
            <div className="text-xs text-slate-200">
              Trạng thái kết quả từ khóa:{' '}
              {keywordStatus === 'SOLVED_EARLY_30' ? (
                <strong className="text-emerald-300">
                  Được giải đúng sớm khi còn hàng chưa mở (+30đ) bởi {keywordSolvedByEntityNames.join(', ')}
                </strong>
              ) : keywordStatus === 'SOLVED_FINAL_10' ? (
                <strong className="text-emerald-300">
                  Được giải đúng ở lượt cuối (+10đ) bởi {keywordSolvedByEntityNames.join(', ')}
                </strong>
              ) : keywordStatus === 'REVEALED_BY_TEACHER' ? (
                <strong className="text-amber-300">Được giáo viên công bố để tổng kết kiến thức (0đ)</strong>
              ) : (
                <strong className="text-slate-400">Phiên kết thúc sớm trước khi mở từ khóa</strong>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              {activeDataset.keywordExplanation}
            </p>
          </div>

          {unevenTurns && (
            <div className="text-[11px] text-slate-400">
              Lưu ý: Phiên kết thúc khi số lượt giữa các đội chưa hoàn toàn bằng nhau; bảng dưới hiển thị rõ số lượt thực tế của từng đội.
            </div>
          )}
        </div>

        {/* Scoreboard Table with Co-Rank Support */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/90">
                <th className="py-3 px-4">Xếp hạng</th>
                <th className="py-3 px-4">Người chơi / Đội</th>
                <th className="py-3 px-4">Số hàng giải đúng</th>
                <th className="py-3 px-4">Số lượt thực tế</th>
                <th className="py-3 px-4">Điểm Từ khóa</th>
                <th className="py-3 px-4">Tổng điểm</th>
              </tr>
            </thead>
            <tbody>
              {sortedCompetitors.map((comp) => {
                // Compute true rank (supporting ties / Đồng hạng)
                const rank =
                  1 + sortedCompetitors.filter((other) => other.score > comp.score).length;
                const isTiedForRank =
                  sortedCompetitors.filter((other) => other.score === comp.score).length > 1;

                return (
                  <tr
                    key={comp.entityId}
                    className="border-b border-slate-800/60 hover:bg-slate-900/50"
                  >
                    <td className="py-2.5 px-4 font-black text-amber-300">
                      #{rank} {isTiedForRank && '(Đồng hạng)'}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white">{comp.name}</td>
                    <td className="py-2.5 px-4 text-emerald-300 font-bold">
                      {comp.rowsSolvedCount} hàng
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{comp.turnsTakenCount} lượt</td>
                    <td className="py-2.5 px-4 text-cyan-300 font-bold">
                      {comp.wonKeywordPoints > 0 ? `+${comp.wonKeywordPoints}đ` : '0đ'}
                    </td>
                    <td className="py-2.5 px-4 font-black text-white text-sm">
                      {comp.score} điểm
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tiedTopCount > 1 && topScore > 0 && (
            <div className="p-3 bg-amber-500/10 text-xs text-amber-200 font-bold text-center">
              Ghi nhận {tiedTopCount} đội/người chơi Đồng hạng Nhất với {topScore} điểm!
            </div>
          )}
        </div>

        {/* Full Knowledge Review for All Rows */}
        <div className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">
            Xem lại toàn bộ kiến thức các hàng ngang ({activeDataset.rows.length} hàng)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeDataset.rows.map((row) => {
              const st = rowStates[row.rowId];
              return (
                <div
                  key={row.rowId}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-amber-300">
                      Hàng {row.rowNumber}: {row.displayAnswer} ({row.gridAnswer})
                    </span>
                    <span className="text-slate-400">
                      {st?.status === 'SOLVED_BY_PLAYER'
                        ? `Giải đúng (+${st.pointsAwarded}đ · ${st.solvedByEntityName})`
                        : st?.status === 'REVEALED_BY_TEACHER'
                        ? 'Được công bố (0đ)'
                        : 'Chưa mở trong phiên'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    <strong>Gợi ý:</strong> {row.clue}
                  </div>
                  <div className="text-xs text-cyan-200 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                    <strong>Giải thích:</strong> {row.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: 3. ACTIVE 3D CROSSWORD STAGE ("BỨC TƯỜNG TRI THỨC" — SECTION 4 & 14)
  // ============================================================================

  const remainingSecondsDisplay = Math.ceil(remainingMs / 1000);
  const rowsToDisplay =
    focusActiveRowOnly && selectedRowConfig
      ? [selectedRowConfig]
      : activeDataset.rows;

  return (
    <div className="relative w-full rounded-3xl bg-gradient-to-b from-[#061024] via-[#0B1D3E] to-[#08132A] text-white border border-sky-400/30 shadow-2xl overflow-hidden select-none">
      {/* 1. TOP BAR (Quay lại, C05 – Ô chữ kiến thức, Tiến độ, Âm thanh, Toàn màn hình) */}
      <div className="px-4 py-3 bg-slate-950/85 border-b border-sky-400/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              stopRowTimer();
              voiceRef.current.cancel();
              setStagePhase('SETUP');
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thiết lập</span>
          </button>

          {onCloseGame && (
            <button
              type="button"
              onClick={() => {
                stopRowTimer();
                voiceRef.current.cancel();
                onCloseGame();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 pl-1 text-xs">
            <span className="font-black text-amber-300">C05 – Ô chữ kiến thức</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 truncate max-w-[220px]">{activeDataset.title}</span>
            {activeDataset.isSample && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] text-cyan-300 font-semibold">Dữ liệu mẫu</span>
              </>
            )}
          </div>
        </div>

        {/* Progress & Active Turn Indicator */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-black text-cyan-300">
            Đã mở: {rowProgressStats.openedTotal}/{rowProgressStats.total} hàng
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-amber-300 font-bold">
            Đang đến lượt: {activeCompetitor?.name || 'Cả lớp'}
          </span>
        </div>

        {/* Right Controls: Keyword Button, Zoom, Pause, Sound, Fullscreen */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!rowProgressStats.isKeywordUnlocked || isKeywordAlreadyResolved}
            onClick={handleOpenKeywordChallenge}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border cursor-pointer ${
              isKeywordAlreadyResolved
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                : rowProgressStats.isKeywordUnlocked
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
            title={
              rowProgressStats.isKeywordUnlocked
                ? 'Giải từ khóa chủ đề'
                : `Cần mở ít nhất ${rowProgressStats.minRequiredForKeyword} hàng ngang để mở khóa`
            }
          >
            <Key className="w-3.5 h-3.5" />
            <span>
              {isKeywordAlreadyResolved
                ? `Từ khóa: ${activeDataset.displayKeyword}`
                : rowProgressStats.isKeywordUnlocked
                ? `Giải từ khóa (+${rowProgressStats.unopened > 0 ? 30 : 10}đ)`
                : `Giải từ khóa (Mở ${rowProgressStats.openedTotal}/${rowProgressStats.minRequiredForKeyword})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBoardZoom((z) => (z === 'NORMAL' ? 'LARGE' : 'NORMAL'))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
            title="Phóng to / Thu nhỏ vùng bảng chữ"
          >
            {boardZoom === 'NORMAL' ? <ZoomIn className="w-4 h-4" /> : <ZoomOut className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPaused) {
                if (stagePhase === 'ROW_ACTIVE' && deadlineRef.current) {
                  setRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
                }
                stopRowTimer();
                voiceRef.current.cancel();
                setIsPaused(true);
              } else {
                setIsPaused(false);
              }
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-300" />}
            <span className="hidden md:inline">{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
          </button>

          <button
            type="button"
            onClick={() => setStagePhase('FINISHED')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer"
          >
            Tổng kết
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Notice Strip: No-Diacritic Grid Rule & Scoreboard Strip */}
      <div className="px-5 py-2 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-slate-300 flex flex-wrap items-center gap-2">
          <span className="text-amber-300 font-bold">Quy ước bảng chữ:</span>
          <span>Ô chữ hiển thị IN HOA KHÔNG DẤU (bỏ khoảng trắng, Đ → D).</span>
          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className="text-slate-400 hover:text-white underline cursor-pointer"
          >
            {reducedMotion ? 'Bật hoạt ảnh lật chữ' : 'Bỏ qua hoạt ảnh lật chữ'}
          </button>
          {selectedRowConfig && (
            <button
              type="button"
              onClick={() => setFocusActiveRowOnly((v) => !v)}
              className="ml-1 text-cyan-300 hover:underline font-bold cursor-pointer"
            >
              {focusActiveRowOnly ? 'Hiện toàn bộ bảng' : 'Chỉ tập trung hàng đang chọn'}
            </button>
          )}
        </div>

        {/* Compact Competitor Score Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {competitors.slice(0, 6).map((comp, idx) => {
            const isTurn = idx === activeCompetitorIdx;
            return (
              <div
                key={comp.entityId}
                onClick={() => {
                  if (stagePhase === 'SELECTING_ROW') {
                    setActiveCompetitorIdx(idx);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  isTurn
                    ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                    : 'bg-slate-900/90 border-slate-800 text-slate-300'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: comp.colorHex }}
                />
                <span>{comp.name}:</span>
                <strong className="text-white">{comp.score}đ</strong>
              </div>
            );
          })}
        </div>
      </div>

      {voiceNotice && (
        <div className="px-4 py-1.5 bg-amber-500/15 border-b border-amber-400/30 text-[11px] text-amber-200 flex items-center justify-between">
          <span>{voiceNotice}</span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="underline font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE: 3D EXTRUDED CROSSWORD WALL (CENTER) + CLUE & INPUT PANEL (BOTTOM/SIDE) */}
      <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left/Center 7 Cols: 3D Knowledge Wall Grid */}
        <div className="xl:col-span-7 rounded-2xl bg-gradient-to-b from-[#0C1E40] via-[#091732] to-[#061024] border-2 border-sky-400/35 p-4 sm:p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                {activeDataset.topic}
              </div>
              <div className="text-xs text-slate-400">
                {activeDataset.crosswordType === 'VERTICAL_COLUMN'
                  ? 'Các ô viền vàng thẳng cột tạo thành Từ khóa chủ đề từ trên xuống dưới'
                  : 'Giải các hàng ngang để mở chữ gợi mở trong Khay manh mối'}
              </div>
            </div>

            {isKeywordAlreadyResolved && (
              <div className="px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-400 text-amber-200 text-xs font-black">
                TỪ KHÓA: {activeDataset.displayKeyword}
              </div>
            )}
          </div>

          {/* Scrollable 3D Crossword Grid Container (never shrinks letters infinitely) */}
          <div className="w-full overflow-x-auto pb-2">
            <div className="min-w-fit space-y-2.5 mx-auto">
              {rowsToDisplay.map((row) => {
                const st = rowStates[row.rowId];
                const isOpened = st && st.status !== 'UNOPENED';
                const isSelected = selectedRowId === row.rowId;
                const cells = splitGridCells(
                  normalizeVietnameseCrosswordGrid(row.gridAnswer, true)
                );

                // Compute left padding slots for VERTICAL_COLUMN alignment (Section 12)
                const kIdx =
                  activeDataset.crosswordType === 'VERTICAL_COLUMN' &&
                  typeof row.keywordIndex === 'number'
                    ? row.keywordIndex
                    : -1;
                const leftEmptySlots =
                  activeDataset.crosswordType === 'VERTICAL_COLUMN' && kIdx >= 0
                    ? Math.max(0, datasetValidation.maxLeftChars - kIdx)
                    : 0;

                const tileSizeClass =
                  boardZoom === 'LARGE'
                    ? 'w-10 h-11 sm:w-11 sm:h-12 text-base sm:text-lg'
                    : 'w-8 h-9 sm:w-9 sm:h-10 text-xs sm:text-sm';

                return (
                  <div
                    key={row.rowId}
                    onClick={() => handleSelectRowToPlay(row)}
                    className={`group p-2 rounded-2xl border transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/20 border-cyan-400 shadow-lg shadow-cyan-500/15'
                        : isOpened
                        ? 'bg-slate-900/60 border-emerald-500/30 hover:border-emerald-400/50'
                        : 'bg-slate-950/55 border-slate-800/90 hover:border-sky-400/50'
                    }`}
                  >
                    {/* Row Number Badge */}
                    <button
                      type="button"
                      className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                          : isOpened
                          ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50'
                          : 'bg-slate-800 text-slate-200 border-slate-700 group-hover:border-cyan-400'
                      }`}
                    >
                      {row.rowNumber}
                    </button>

                    {/* Extruded 3D Tiles Row (No whitespace text padding; uses exact geometric spacer blocks) */}
                    <div className="flex items-center gap-1.5 flex-nowrap">
                      {Array.from({ length: leftEmptySlots }).map((_, emptyIdx) => (
                        <div
                          key={`empty_${row.rowId}_${emptyIdx}`}
                          className={`${tileSizeClass} opacity-0 pointer-events-none shrink-0`}
                          aria-hidden="true"
                        />
                      ))}

                      {cells.map((char, cellIdx) => {
                        const isKeywordCell =
                          activeDataset.crosswordType === 'VERTICAL_COLUMN' &&
                          cellIdx === kIdx;
                        const isHintRevealedCell =
                          st?.hintUsed && st.revealedLetterIndex === cellIdx;
                        const showChar =
                          isOpened ||
                          isHintRevealedCell ||
                          (isKeywordCell && isKeywordAlreadyResolved);

                        return (
                          <div
                            key={`${row.rowId}_c_${cellIdx}`}
                            aria-label={
                              showChar
                                ? `Hàng ${row.rowNumber} ô ${cellIdx + 1}: chữ ${char}`
                                : `Hàng ${row.rowNumber} ô ${cellIdx + 1}: đang ẩn`
                            }
                            style={{
                              animation:
                                showChar && !reducedMotion
                                  ? `c05TileFlipIn 0.42s cubic-bezier(0.22, 1, 0.36, 1) ${cellIdx * 0.045}s both`
                                  : 'none',
                            }}
                            className={`${tileSizeClass} rounded-xl font-mono font-black flex items-center justify-center shrink-0 border-2 shadow-[0_4px_0_rgba(0,0,0,0.45)] ${
                              isKeywordCell
                                ? showChar
                                  ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 border-yellow-200 shadow-[0_4px_0_#92400E]'
                                  : 'bg-amber-500/20 text-amber-200 border-amber-400/80 shadow-[0_4px_0_#78350F]'
                                : showChar
                                ? 'bg-gradient-to-b from-cyan-300 via-sky-400 to-blue-600 text-slate-950 border-cyan-100 shadow-[0_4px_0_#075985]'
                                : 'bg-gradient-to-b from-slate-800 to-slate-900 text-slate-400 border-slate-600/80'
                            }`}
                          >
                            {showChar ? char : ''}
                          </div>
                        );
                      })}
                    </div>

                    {/* Row Status Label & Full Diacritic Answer once opened */}
                    <div className="ml-auto pl-2 text-right shrink-0">
                      {isOpened ? (
                        <div className="text-xs font-black text-emerald-300">
                          {row.displayAnswer}
                        </div>
                      ) : (
                        <div className="text-[11px] font-bold text-slate-400">
                          {cells.length} chữ {st?.hintUsed ? '· Đã mở gợi ý (5đ)' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Type B Independent Keyword Clue Tray (Section 5B) */}
          {activeDataset.crosswordType === 'INDEPENDENT_KEYWORD' && (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-400/40 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold text-amber-300">
                Khay manh mối chữ cái (Từ khóa độc lập – {activeDataset.gridKeyword.length} chữ):
              </div>
              <div className="flex items-center gap-1.5">
                {activeDataset.rows.map((r) => {
                  const opened = rowStates[r.rowId]?.status !== 'UNOPENED';
                  return (
                    <div
                      key={`tray_${r.rowId}`}
                      className={`w-8 h-8 rounded-lg font-mono font-black text-xs flex items-center justify-center border ${
                        opened
                          ? 'bg-amber-400 text-slate-950 border-yellow-200'
                          : 'bg-slate-900 text-slate-500 border-slate-700'
                      }`}
                    >
                      {opened ? r.clueLetterForIndependent || r.gridAnswer[0] : '?'}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Clue Panel, Vietnamese Input, Hint, and Keyword Solving */}
        <div className="xl:col-span-5 space-y-4">
          {/* Panel A: Keyword Challenge Mode (Section 10) */}
          {stagePhase === 'KEYWORD_CHALLENGE' && (
            <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-950/60 via-slate-900 to-slate-950 border-2 border-amber-400/70 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 font-black text-base">
                  <Key className="w-5 h-5" />
                  <span>
                    GIẢI TỪ KHÓA CHỦ ĐỀ (+{rowProgressStats.unopened > 0 ? 30 : 10} ĐIỂM)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStagePhase('SELECTING_ROW')}
                  className="text-xs text-slate-300 hover:underline font-bold cursor-pointer"
                >
                  ← Quay lại chọn hàng
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-400/30 space-y-1.5">
                <div className="text-xs font-bold text-cyan-300">
                  Gợi ý từ khóa ({activeDataset.gridKeyword.length} chữ cái):
                </div>
                <p className="text-sm font-bold text-white leading-relaxed">
                  {activeDataset.keywordClue}
                </p>
              </div>

              {competitors.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Giáo viên chọn người/đội đang trả lời Từ khóa:
                  </label>
                  <select
                    value={keywordChallengerEntityId}
                    onChange={(e) => setKeywordChallengerEntityId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                  >
                    {competitors.map((c) => (
                      <option key={c.entityId} value={c.entityId}>
                        {c.name} ({c.score}đ)
                        {!rowProgressStats.allRowsOpened && c.usedEarlyKeywordGuess
                          ? ' — Đã dùng quyền đoán sớm'
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <input
                  type="text"
                  value={keywordInputText}
                  onCompositionStart={() => {
                    isImeComposingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    isImeComposingRef.current = false;
                  }}
                  onChange={(e) => setKeywordInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isImeComposingRef.current) {
                      e.preventDefault();
                      handleSubmitSingleKeywordGuess();
                    }
                  }}
                  placeholder={`Nhập đáp án từ khóa (${activeDataset.gridKeyword.length} chữ cái)...`}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border-2 border-amber-400/50 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-300"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmRevealKeywordModal(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Giáo viên công bố từ khóa (0đ)
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitSingleKeywordGuess}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Chốt đáp án Từ khóa</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Panel B: Simultaneous Final Keyword Round for Teams (Section 10) */}
          {stagePhase === 'FINAL_SIMULTANEOUS_KEYWORD' && (
            <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-950/60 via-slate-900 to-slate-950 border-2 border-amber-400/70 space-y-4 shadow-xl">
              <div className="text-amber-300 font-black text-base flex items-center gap-2">
                <Key className="w-5 h-5" />
                <span>LƯỢT GIẢI TỪ KHÓA CUỐI ĐỒNG THỜI (+10 ĐIỂM)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tất cả các hàng ngang đã mở! Các đội ghi đáp án từ khóa trên bảng/giấy trước khi giáo viên nhập và chấm đồng thời để không lộ đáp án cho đội sau. Các đội trả lời đúng đều nhận <strong>+10 điểm</strong>.
              </p>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white font-bold">
                Gợi ý từ khóa: {activeDataset.keywordClue}
              </div>

              <div className="space-y-2">
                {competitors.map((team) => (
                  <div key={team.entityId} className="flex items-center gap-2">
                    <span className="w-24 text-xs font-bold text-amber-200 shrink-0">
                      {team.name}:
                    </span>
                    <input
                      type="text"
                      value={simultaneousKeywordInputs[team.entityId] || ''}
                      onChange={(e) =>
                        setSimultaneousKeywordInputs((prev) => ({
                          ...prev,
                          [team.entityId]: e.target.value,
                        }))
                      }
                      placeholder="Nhập đáp án trên bảng của đội..."
                      className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleConfirmSimultaneousTeamKeywordRound}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black cursor-pointer"
              >
                Chấm đồng thời & Công bố Từ khóa
              </button>
            </div>
          )}

          {/* Panel C: Row Clue & Answer Input Panel (Section 8) */}
          {stagePhase !== 'KEYWORD_CHALLENGE' &&
            stagePhase !== 'FINAL_SIMULTANEOUS_KEYWORD' && (
              <div className="p-5 rounded-2xl bg-slate-900/85 border border-sky-400/35 space-y-4 shadow-xl">
                {!selectedRowConfig ? (
                  <div className="py-8 text-center space-y-3">
                    <BookOpen className="w-10 h-10 text-cyan-300 mx-auto" />
                    <div className="text-base font-black text-white">
                      Hãy chọn một Hàng ngang trên Bức Tường Tri Thức
                    </div>
                    <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                      Nhấn trực tiếp vào bất kỳ hàng ngang chưa mở nào trên bảng chữ bên trái để hiển thị gợi ý và bắt đầu lượt trả lời của <strong>{activeCompetitor?.name}</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Row Header & Timer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <div className="text-xs font-black text-amber-300">
                          HÀNG NGANG SỐ {selectedRowConfig.rowNumber} ({selectedRowConfig.gridAnswer.length} CHỮ CÁI)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Điểm tối đa hàng này:{' '}
                          <strong className="text-emerald-300">
                            {selectedRowRuntime?.hintUsed ? '5 điểm (đã mở gợi ý)' : '10 điểm'}
                          </strong>
                          {stagePhase === 'ROW_ACTIVE' && (
                            <>
                              {' · '}Lượt thử:{' '}
                              <strong className="text-cyan-300">
                                {(selectedRowRuntime?.attemptsUsedInCurrentTurn || 0) + 1}/{maxAttemptsPerTurn}
                              </strong>
                            </>
                          )}
                        </div>
                      </div>

                      {rowTimeLimit > 0 && stagePhase === 'ROW_ACTIVE' && (
                        <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-amber-400/60 text-amber-300 font-mono font-black text-sm flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{String(remainingSecondsDisplay).padStart(2, '0')}s</span>
                        </div>
                      )}
                    </div>

                    {/* Row Clue + Active Voice Read Button */}
                    <div className="p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-cyan-300">Gợi ý hàng ngang:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              speakVietnameseText(
                                `Hàng ngang số ${selectedRowConfig.rowNumber}, gồm ${selectedRowConfig.gridAnswer.length} chữ cái: ${selectedRowConfig.clue}`
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-cyan-300 cursor-pointer"
                          >
                            Đọc gợi ý
                          </button>
                          <button
                            type="button"
                            onClick={() => voiceRef.current.cancel()}
                            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-400 cursor-pointer"
                          >
                            Bỏ qua đọc
                          </button>
                        </div>
                      </div>

                      <div className="text-base sm:text-lg font-bold text-white leading-relaxed">
                        <MathView content={selectedRowConfig.clue} />
                      </div>

                      {/* Public Hint Box if Hint Used (Section 11) */}
                      {selectedRowRuntime?.hintUsed && selectedRowConfig.hint && (
                        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200">
                          <strong>Gợi ý bổ sung (Điểm tối đa hàng này còn 5đ):</strong>{' '}
                          {selectedRowConfig.hint}
                        </div>
                      )}
                    </div>

                    {/* Input & Controls when ROW_ACTIVE */}
                    {stagePhase === 'ROW_ACTIVE' &&
                      selectedRowRuntime?.status === 'UNOPENED' && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={rowInputText}
                              onCompositionStart={() => {
                                isImeComposingRef.current = true;
                              }}
                              onCompositionEnd={() => {
                                isImeComposingRef.current = false;
                              }}
                              onChange={(e) => setRowInputText(e.target.value)}
                              onKeyDown={(e) => {
                                // Section 6: Never submit on Enter while Vietnamese IME is composing!
                                if (
                                  e.key === 'Enter' &&
                                  !e.nativeEvent.isComposing &&
                                  !isImeComposingRef.current
                                ) {
                                  e.preventDefault();
                                  handleSubmitRowAnswer();
                                }
                              }}
                              placeholder={`Nhập đáp án Hàng ${selectedRowConfig.rowNumber} (có dấu hoặc không dấu)...`}
                              className="flex-1 p-3 rounded-xl bg-slate-950 border-2 border-cyan-400/50 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-300"
                            />
                            <button
                              type="button"
                              onClick={handleSubmitRowAnswer}
                              className="px-5 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              <Send className="w-4 h-4" />
                              <span>Chốt</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            {hintsEnabled && !selectedRowRuntime.hintUsed ? (
                              <button
                                type="button"
                                onClick={handleUseRowHint}
                                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Lightbulb className="w-3.5 h-3.5" />
                                <span>Dùng gợi ý: điểm tối đa hàng này còn 5</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                {selectedRowRuntime.hintUsed
                                  ? 'Đã mở gợi ý công khai cho hàng này (tối đa 5đ)'
                                  : 'Chế độ không dùng gợi ý'}
                              </span>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setShowConfirmRevealRowModal(true)}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                              >
                                Công bố hàng (0đ)
                              </button>
                              <button
                                type="button"
                                onClick={handleFinishRowTurnAndContinue}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                              >
                                Bỏ qua / Chuyển lượt
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Feedback & Explanation Box after Row Solved / Revealed / Turn Exhausted */}
                    {feedbackBanner && (
                      <div
                        className={`p-4 rounded-2xl border space-y-2 ${
                          feedbackBanner.type === 'SUCCESS'
                            ? 'bg-emerald-950/50 border-emerald-400/60 text-emerald-200'
                            : feedbackBanner.type === 'REVEALED'
                            ? 'bg-amber-950/40 border-amber-400/60 text-amber-200'
                            : feedbackBanner.type === 'RETRY'
                            ? 'bg-rose-950/40 border-rose-400/50 text-rose-200'
                            : 'bg-slate-950/80 border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-black">{feedbackBanner.message}</div>
                        {(selectedRowRuntime?.status === 'SOLVED_BY_PLAYER' ||
                          selectedRowRuntime?.status === 'REVEALED_BY_TEACHER') && (
                          <div className="text-xs text-slate-200 pt-1 leading-relaxed">
                            <strong className="text-cyan-300">Giải thích kiến thức: </strong>
                            {selectedRowConfig.explanation}
                          </div>
                        )}
                      </div>
                    )}

                    {stagePhase === 'ROW_FEEDBACK' && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleFinishRowTurnAndContinue}
                          className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>
                            {competitors.length > 1
                              ? 'Hoàn tất & Chuyển lượt đội tiếp theo'
                              : 'Tiếp tục chọn hàng ngang'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
        </div>
      </div>

      {/* ====================================================================
          MODAL 1: CONFIRM TEACHER REVEAL ROW ("Công bố hàng" — Section 8)
          ==================================================================== */}
      {showConfirmRevealRowModal && selectedRowConfig && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/50 p-5 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-2 text-amber-300 font-black text-base">
              <Eye className="w-5 h-5" />
              <span>Xác nhận Công bố Hàng ngang {selectedRowConfig.rowNumber}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Hàng ngang số {selectedRowConfig.rowNumber} sẽ được lật mở đáp án và giải thích để cả lớp cùng học tập. Trạng thái được ghi là <strong>“Được công bố”</strong> và <strong>không cộng điểm (0 điểm)</strong>.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmRevealRowModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmTeacherRevealRow}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Xác nhận Công bố hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: CONFIRM TEACHER REVEAL KEYWORD
          ==================================================================== */}
      {showConfirmRevealKeywordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/50 p-5 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-2 text-amber-300 font-black text-base">
              <Key className="w-5 h-5" />
              <span>Xác nhận Công bố Từ khóa chủ đề</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Từ khóa chủ đề sẽ được mở để lớp học tập (trạng thái <strong>“Được giáo viên công bố”</strong>, <strong>0 điểm</strong>).
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmRevealKeywordModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleTeacherRevealKeyword}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Xác nhận Công bố từ khóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: POST-KEYWORD SOLVED CHOICE (Section 10: Finish or Continue Rows)
          ==================================================================== */}
      {showPostKeywordSolvedChoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-emerald-400/60 p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-300 font-black text-lg">
              <Trophy className="w-6 h-6" />
              <span>TỪ KHÓA ĐÃ MỞ: {activeDataset.displayKeyword}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {activeDataset.keywordExplanation}
            </p>
            <p className="text-xs text-amber-200">
              Hiện vẫn còn <strong>{rowProgressStats.unopened} hàng ngang</strong> chưa mở. Giáo viên muốn kết thúc phiên ngay hay tiếp tục giải các hàng ngang còn lại để củng cố kiến thức (không cộng thêm điểm từ khóa lần hai)?
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPostKeywordSolvedChoiceModal(false);
                  setStagePhase('SELECTING_ROW');
                }}
                className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Tiếp tục giải {rowProgressStats.unopened} hàng còn lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPostKeywordSolvedChoiceModal(false);
                  setStagePhase('FINISHED');
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Kết thúc phiên & Xem Tổng kết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          OVERLAY 4: PAUSE OVERLAY (Section 13: stops timer, hides clue, locks input)
          ==================================================================== */}
      {isPaused && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
          <Pause className="w-12 h-12 text-amber-300" />
          <h3 className="text-xl font-black text-white">
            ĐANG TẠM DỪNG Ô CHỮ KIẾN THỨC 3D
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md">
            Đồng hồ đã tạm dừng, câu gợi ý đang được che và ô nhập đáp án đang khóa để đảm bảo công bằng.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsPaused(false);
              if (stagePhase === 'ROW_ACTIVE' && rowTimeLimit > 0 && remainingMs > 0) {
                activeTurnTokenRef.current += 1;
                const token = activeTurnTokenRef.current;
                deadlineRef.current = Date.now() + remainingMs;
                timerIntervalRef.current = window.setInterval(() => {
                  if (activeTurnTokenRef.current !== token || !deadlineRef.current) return;
                  const left = Math.max(0, deadlineRef.current - Date.now());
                  setRemainingMs(left);
                  if (left <= 0) {
                    stopRowTimer();
                    setStagePhase('ROW_FEEDBACK');
                  }
                }, 200);
              }
            }}
            className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Tiếp tục phiên chơi</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes c05TileFlipIn {
          0% {
            transform: perspective(500px) rotateX(-85deg) scale(0.92);
            opacity: 0.35;
          }
          100% {
            transform: perspective(500px) rotateX(0deg) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default KnowledgeCrossword3DGame;
