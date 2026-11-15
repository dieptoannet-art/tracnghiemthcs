import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  History,
  Settings,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Sparkles,
  Clock,
  Lightbulb,
  Undo2,
  Plus,
  Trash2,
  Save,
  Eye,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Award,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  KeyRound,
  Compass,
  ScrollText,
  FileCheck2,
  Layers,
  Sliders,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question, Grade } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type SecretCodePlayMode = 'TREASURE_CODE' | 'SPY_CIPHER' | 'TEAM_ARENA' | 'DESIGNER';

export type SecretCodeStyle =
  | 'DIRECT_ORDER'
  | 'LOGIC_DEDUCTION'
  | 'A1Z26'
  | 'CAESAR'
  | 'SYMBOL_MAP'
  | 'NUMBER_SEQUENCE';

export type SecretCodeStageState =
  | 'SETUP'
  | 'READY'
  | 'CHALLENGE_SELECTED'
  | 'QUESTION'
  | 'ANSWERING'
  | 'CHECKING'
  | 'CLUE_UNLOCKED'
  | 'CODE_ENTRY'
  | 'UNLOCKING'
  | 'COMPLETED';

export interface SecretChallengeStation {
  id: string;
  orderIndex: number; // 0-based
  title: string;
  runeSymbol: string;
  questionId?: string;
  questionSource: 'bank' | 'builtin' | 'manual';
  questionText: string;
  questionType: 'single_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer: string;
  imageUrl?: string;
  difficulty: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng';
  /** Mảnh mã trực tiếp (VD: "2" hoặc "T") hoặc nội dung manh mối suy luận */
  clueToken: string;
  clueDescription: string;
  points: number;
  timeLimitSec: number;
  explanation: string;
}

export interface SecretCodeSet {
  id: string;
  title: string;
  subject: string;
  grade: Grade;
  chapter: string;
  lesson: string;
  codeStyle: SecretCodeStyle;
  codeLength: number; // 4, 5, or 6
  /** Mật mã chuẩn hóa (không dấu, in hoa, không khoảng trắng) dùng cho các vòng quay khóa */
  finalCode: string;
  /** Hiển thị tiếng Việt gốc có dấu (ví dụ: "2518" hoặc "TIN HỌC") */
  originalDisplayAnswer: string;
  /** Danh sách các đáp án chấp nhận được khi nhập nhanh */
  acceptedCodes: string[];
  /** Bản thông điệp mã hóa hiển thị trên bảng mật mã (dành cho Điệp viên giải mã / Suy luận) */
  encodedBannerText: string;
  /** Quy tắc giải mã công bố rõ cho học sinh */
  ruleDescription: string;
  /** Dịch chuyển Caesar (nếu codeStyle === 'CAESAR') */
  caesarShift?: number;
  /** Bảng ánh xạ ký hiệu (nếu codeStyle === 'SYMBOL_MAP') */
  symbolMap?: Record<string, string>;
  /** 3 cấp độ gợi ý */
  hints: [string, string, string];
  /** Lời giải từng bước hiển thị sau khi mở khóa */
  stepByStepSolution: string;
  stations: SecretChallengeStation[];
  status: 'draft' | 'approved' | 'archived';
  authorId: string;
  updatedAt: string;
}

export interface SecretCodeTeam {
  id: string;
  name: string;
  colorHex: string;
  members: StudentCandidate[];
  score: number;
  unlockedStationIds: string[];
  correctAnswersCount: number;
  codeAttempts: number;
  completedTimeSec?: number;
  assignedSetId?: string;
}

export interface ScoreActionHistoryItem {
  id: string;
  timestamp: string;
  description: string;
  teamId?: string;
  deltaScore: number;
  stationId?: string;
}

export interface SecretCodeGameProps {
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
  onToggleMute?: () => void;
  onOpenAbsentModal?: () => void;
  onOpenHistoryModal?: () => void;
}

// ============================================================================
// CONSTANTS & VIETNAMESE NORMALIZATION HELPERS
// ============================================================================

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Toán học',
  literature: 'Ngữ văn',
  english: 'Tiếng Anh',
  science: 'Khoa học tự nhiên',
  history_geo: 'Lịch sử & Địa lí',
  informatics: 'Tin học',
  civic: 'Giáo dục công dân',
  technology: 'Công nghệ',
  general: 'Tổng hợp THCS',
};

const RUNE_SYMBOLS = ['◆', '★', '▲', '●', '✦', '⬟'];

const TEAM_PRESETS = [
  { id: 'team-1', name: 'Đội Thám Hiểm Xanh', colorHex: '#0EA5E9' },
  { id: 'team-2', name: 'Đội Giải Mã Vàng', colorHex: '#F59E0B' },
  { id: 'team-3', name: 'Đội Mật Vụ Tím', colorHex: '#8B5CF6' },
  { id: 'team-4', name: 'Đội Kho Báu Ngọc', colorHex: '#10B981' },
];

const STORAGE_CUSTOM_SETS_KEY = 'taydo_smart_edu_b04_custom_sets_v1';
const STORAGE_ACTIVE_SESSION_KEY = 'taydo_smart_edu_b04_active_session_v1';

/**
 * Chuẩn hóa ký tự tiếng Việt sang bảng 26 chữ cái A-Z hoặc chữ số 0-9
 * Quy định rõ: Đ/đ -> D, tách dấu NFD, bỏ khoảng trắng và ký tự đặc biệt.
 */
export function normalizeCodeString(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Mã hóa A1Z26 (A=1, B=2, ..., Z=26) cho văn bản tiếng Việt đã chuẩn hóa
 */
export function encodeToA1Z26(plainText: string): string {
  const clean = normalizeCodeString(plainText);
  const nums: string[] = [];
  for (const ch of clean) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      nums.push(String(code - 64));
    } else {
      nums.push(ch);
    }
  }
  return nums.join(' – ');
}

/**
 * Mã hóa dịch chuyển Caesar trên bảng 26 chữ cái chuẩn hóa (A-Z)
 */
export function encodeCaesar(plainText: string, shift: number): string {
  const clean = normalizeCodeString(plainText);
  const normalizedShift = ((shift % 26) + 26) % 26;
  return clean
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + normalizedShift) % 26) + 65);
      }
      return ch;
    })
    .join('');
}

// ============================================================================
// VALIDATION & SOLVABILITY VERIFIER
// ============================================================================

export interface SecretCodeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  verifiedUniqueSolution: boolean;
}

export function validateSecretCodeSet(set: SecretCodeSet): SecretCodeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!set.title.trim()) {
    errors.push('Bộ giải mã chưa có tiêu đề.');
  }

  const normalizedFinal = normalizeCodeString(set.finalCode);
  if (normalizedFinal.length < 3 || normalizedFinal.length > 8) {
    errors.push('Đáp án mật mã cuối phải có độ dài từ 3 đến 8 ký tự chữ hoặc số.');
  }

  if (normalizedFinal.length !== set.codeLength) {
    errors.push(
      `Độ dài mật mã cấu hình (${set.codeLength}) không khớp với số ký tự chuẩn hóa của đáp án cuối "${normalizedFinal}" (${normalizedFinal.length} ký tự).`
    );
  }

  if (!set.ruleDescription.trim()) {
    errors.push('Chưa có quy tắc giải mã công bố cho học sinh.');
  }

  if (!set.stations || set.stations.length < 3 || set.stations.length > 6) {
    errors.push('Bộ giải mã cần có từ 3 đến 6 trạm thử thách.');
  }

  set.stations.forEach((st, idx) => {
    const label = `Trạm #${idx + 1}`;
    if (!st.questionText.trim()) {
      errors.push(`${label}: Chưa có nội dung câu hỏi.`);
    }
    if (!st.correctAnswer.trim()) {
      errors.push(`${label}: Chưa có đáp án đúng cho câu hỏi.`);
    }
    if (!st.clueToken.trim() && !st.clueDescription.trim()) {
      errors.push(`${label}: Chưa thiết lập mảnh mật mã hoặc manh mối.`);
    }
    // Không vô tình tiết lộ toàn bộ mật mã ngay trong nội dung câu hỏi
    if (
      normalizedFinal.length >= 4 &&
      normalizeCodeString(st.questionText).includes(normalizedFinal)
    ) {
      warnings.push(`${label}: Nội dung câu hỏi có chứa chuỗi trùng với mật mã cuối.`);
    }
  });

  // Kiểm tra tính giải được và tính duy nhất theo từng kiểu mật mã
  let verifiedUniqueSolution = false;

  if (set.codeStyle === 'DIRECT_ORDER') {
    const combinedTokens = normalizeCodeString(set.stations.map((s) => s.clueToken).join(''));
    if (combinedTokens !== normalizedFinal) {
      errors.push(
        `Kiểu Ghép mảnh theo thứ tự: Chuỗi ghép từ các trạm ("${combinedTokens}") không khớp với mật mã cuối ("${normalizedFinal}").`
      );
    } else {
      verifiedUniqueSolution = true;
    }
  } else if (set.codeStyle === 'A1Z26') {
    const expectedBanner = encodeToA1Z26(normalizedFinal);
    if (!expectedBanner) {
      errors.push('Không thể mã hóa A1Z26 cho mật mã rỗng.');
    } else {
      verifiedUniqueSolution = true;
    }
  } else if (set.codeStyle === 'CAESAR') {
    const shift = set.caesarShift ?? 3;
    const encoded = encodeCaesar(normalizedFinal, shift);
    if (encoded.length === normalizedFinal.length) {
      verifiedUniqueSolution = true;
    }
  } else {
    // LOGIC_DEDUCTION / SYMBOL_MAP / NUMBER_SEQUENCE
    if (set.stepByStepSolution.trim().length < 10) {
      errors.push('Mật mã suy luận / quy luật bắt buộc phải có lời giải từng bước rõ ràng để xác minh nghiệm duy nhất.');
    } else {
      verifiedUniqueSolution = true;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    verifiedUniqueSolution,
  };
}

// ============================================================================
// BUILT-IN VERIFIED SECRET CODE ADVENTURE SETS (THCS)
// ============================================================================

const BUILTIN_SECRET_SETS: SecretCodeSet[] = [
  {
    id: 'b04-set-treasure-order',
    title: 'Kho Báu Cổ Đại Tây Đô – Ghép Mảnh Mật Mã (Toán & KHTN)',
    subject: 'math',
    grade: '6',
    chapter: 'Số tự nhiên & Khoa học tự nhiên',
    lesson: 'Khởi động tư duy số học',
    codeStyle: 'DIRECT_ORDER',
    codeLength: 4,
    finalCode: '2518',
    originalDisplayAnswer: '2518',
    acceptedCodes: ['2518'],
    encodedBannerText: '[ #1 ] – [ #2 ] – [ #3 ] – [ #4 ]',
    ruleDescription:
      'Kiểu A – Ghép các mảnh mã theo thứ tự: Vượt qua 4 trạm thử thách để thu thập 4 chữ số mật mã từ Trạm #1 đến Trạm #4 rồi xoay 4 vòng khóa theo đúng thứ tự.',
    hints: [
      'Gợi ý 1: Mỗi trạm trả lời đúng sẽ mở khóa trực tiếp 1 chữ số tương ứng với vị trí vòng khóa.',
      'Gợi ý 2: Hai chữ số đầu tiên của ổ khóa là 2 và 5.',
      'Gợi ý 3: Ghép 4 mảnh từ Trạm #1 đến Trạm #4 ta được mật mã 2 - 5 - 1 - 8.',
    ],
    stepByStepSolution:
      'Bước 1: Trạm #1 cho mảnh số 2 (số nguyên tố chẵn duy nhất).\nBước 2: Trạm #2 cho mảnh số 5 (5 cạnh của ngũ giác đều).\nBước 3: Trạm #3 cho mảnh số 1 (phần tử trung hòa phép nhân).\nBước 4: Trạm #4 cho mảnh số 8 (số đỉnh của hình lập phương).\n⇒ Mật mã duy nhất mở rương kho báu là: 2518.',
    status: 'approved',
    authorId: 'system',
    updatedAt: '2026-11-15T00:00:00Z',
    stations: [
      {
        id: 'st-1',
        orderIndex: 0,
        title: 'Trạm #1: Viên Đá Số Nguyên Tố',
        runeSymbol: '◆',
        questionSource: 'builtin',
        questionText: 'Số nguyên tố chẵn duy nhất trong tập hợp các số tự nhiên là số nào?',
        questionType: 'single_choice',
        options: ['0', '2', '4', '6'],
        correctAnswer: '2',
        difficulty: 'Nhận biết',
        clueToken: '2',
        clueDescription: 'Vòng khóa số #1 có giá trị là 2.',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Số 2 là số nguyên tố chẵn duy nhất vì chỉ có hai ước là 1 và 2.',
      },
      {
        id: 'st-2',
        orderIndex: 1,
        title: 'Trạm #2: Cổng Hình Học Phẳng',
        runeSymbol: '★',
        questionSource: 'builtin',
        questionText: 'Hình ngũ giác đều có tất cả bao nhiêu cạnh bằng nhau?',
        questionType: 'single_choice',
        options: ['4 cạnh', '5 cạnh', '6 cạnh', '8 cạnh'],
        correctAnswer: '5 cạnh',
        difficulty: 'Nhận biết',
        clueToken: '5',
        clueDescription: 'Vòng khóa số #2 có giá trị là 5.',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Ngũ giác đều là đa giác đều có 5 cạnh và 5 góc bằng nhau.',
      },
      {
        id: 'st-3',
        orderIndex: 2,
        title: 'Trạm #3: Bí Mật Phép Nhân',
        runeSymbol: '▲',
        questionSource: 'builtin',
        questionText: 'Mọi số tự nhiên a khác 0 khi nâng lên lũy thừa bậc 0 (a⁰) đều có giá trị bằng bao nhiêu?',
        questionType: 'single_choice',
        options: ['0', '1', 'a', '10'],
        correctAnswer: '1',
        difficulty: 'Thông hiểu',
        clueToken: '1',
        clueDescription: 'Vòng khóa số #3 có giá trị là 1.',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Theo quy ước lũy thừa, với mọi a ≠ 0 thì a⁰ = 1.',
      },
      {
        id: 'st-4',
        orderIndex: 3,
        title: 'Trạm #4: Khối Lập Phương Cổ Vật',
        runeSymbol: '●',
        questionSource: 'builtin',
        questionText: 'Một hình lập phương hoàn chỉnh trong không gian có tất cả bao nhiêu đỉnh?',
        questionType: 'single_choice',
        options: ['6 đỉnh', '8 đỉnh', '10 đỉnh', '12 đỉnh'],
        correctAnswer: '8 đỉnh',
        difficulty: 'Thông hiểu',
        clueToken: '8',
        clueDescription: 'Vòng khóa số #4 có giá trị là 8.',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Hình lập phương có 6 mặt, 12 cạnh và 8 đỉnh.',
      },
    ],
  },
  {
    id: 'b04-set-logic-deduction',
    title: 'Mật Mã Suy Luận Kim Tự Tháp – Tư Duy Logic 4 Chữ Số',
    subject: 'math',
    grade: '7',
    chapter: 'Đại số & Suy luận logic',
    lesson: 'Mật mã suy luận có điều kiện',
    codeStyle: 'LOGIC_DEDUCTION',
    codeLength: 4,
    finalCode: '3618',
    originalDisplayAnswer: '3618',
    acceptedCodes: ['3618'],
    encodedBannerText: 'A – B – C – D (Tìm 4 chữ số thỏa mãn 4 manh mối)',
    ruleDescription:
      'Kiểu B – Mật mã suy luận: Mỗi trạm mở ra một mệnh đề toán học liên kết giữa 4 chữ số A, B, C, D. Hãy kết hợp các manh mối để suy luận mật mã duy nhất.',
    hints: [
      'Gợi ý 1: Từ manh mối #1, số cạnh của tam giác cho biết chữ số đầu tiên A = 3.',
      'Gợi ý 2: Manh mối #2 cho biết B gấp đôi A ⇒ B = 2 × 3 = 6; Manh mối #3 cho biết C = A - 2 = 1.',
      'Gợi ý 3: Manh mối #4 cho biết D = A + B - C = 3 + 6 - 1 = 8 ⇒ Mật mã là 3618.',
    ],
    stepByStepSolution:
      '• Từ Manh mối #1: Chữ số thứ nhất (A) bằng số cạnh của tam giác ⇒ A = 3.\n• Từ Manh mối #2: Chữ số thứ hai (B) gấp đôi chữ số thứ nhất ⇒ B = 3 × 2 = 6.\n• Từ Manh mối #3: Chữ số thứ ba (C) nhỏ hơn chữ số thứ nhất 2 đơn vị ⇒ C = 3 - 2 = 1.\n• Từ Manh mối #4: Chữ số thứ tư (D) bằng tổng hai chữ số đầu trừ chữ số thứ ba ⇒ D = (3 + 6) - 1 = 8.\n⇒ Nghiệm duy nhất: 3618.',
    status: 'approved',
    authorId: 'system',
    updatedAt: '2026-11-15T00:00:00Z',
    stations: [
      {
        id: 'st-logic-1',
        orderIndex: 0,
        title: 'Trạm #1: Manh Mối Chữ Số A',
        runeSymbol: '◆',
        questionSource: 'builtin',
        questionText: 'Tổng ba góc trong một tam giác bất kỳ trên mặt phẳng bằng bao nhiêu độ?',
        questionType: 'single_choice',
        options: ['90°', '180°', '270°', '360°'],
        correctAnswer: '180°',
        difficulty: 'Nhận biết',
        clueToken: 'A=3',
        clueDescription: 'Manh mối #1: Chữ số thứ nhất (A) đúng bằng số cạnh của một hình tam giác (A = 3).',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Tổng ba góc trong một tam giác luôn bằng 180°, và tam giác có 3 cạnh nên A = 3.',
      },
      {
        id: 'st-logic-2',
        orderIndex: 1,
        title: 'Trạm #2: Manh Mối Chữ Số B',
        runeSymbol: '★',
        questionSource: 'builtin',
        questionText: 'Giá trị của biểu thức 2³ (hai lũy thừa ba) bằng bao nhiêu?',
        questionType: 'single_choice',
        options: ['6', '8', '9', '12'],
        correctAnswer: '8',
        difficulty: 'Nhận biết',
        clueToken: 'B=2×A',
        clueDescription: 'Manh mối #2: Chữ số thứ hai (B) có giá trị gấp đôi chữ số thứ nhất (B = 2 × A).',
        points: 10,
        timeLimitSec: 20,
        explanation: '2³ = 2 × 2 × 2 = 8. Manh mối suy luận: B = 2 × A = 6.',
      },
      {
        id: 'st-logic-3',
        orderIndex: 2,
        title: 'Trạm #3: Manh Mối Chữ Số C',
        runeSymbol: '▲',
        questionSource: 'builtin',
        questionText: 'Căn bậc hai số học của 49 (√49) bằng bao nhiêu?',
        questionType: 'single_choice',
        options: ['6', '7', '8', '9'],
        correctAnswer: '7',
        difficulty: 'Thông hiểu',
        clueToken: 'C=A-2',
        clueDescription: 'Manh mối #3: Chữ số thứ ba (C) nhỏ hơn chữ số thứ nhất 2 đơn vị (C = A - 2).',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Vì 7 > 0 và 7² = 49 nên √49 = 7. Từ C = A - 2 suy ra C = 1.',
      },
      {
        id: 'st-logic-4',
        orderIndex: 3,
        title: 'Trạm #4: Manh Mối Chữ Số D',
        runeSymbol: '●',
        questionSource: 'builtin',
        questionText: 'Trong tỉ lệ thức a/b = c/d (với b, d ≠ 0), đẳng thức tích chéo nào sau đây đúng?',
        questionType: 'single_choice',
        options: ['a·d = b·c', 'a·b = c·d', 'a·c = b·d', 'a + d = b + c'],
        correctAnswer: 'a·d = b·c',
        difficulty: 'Thông hiểu',
        clueToken: 'D=A+B-C',
        clueDescription: 'Manh mối #4: Chữ số thứ tư (D) bằng tổng của A và B trừ đi C (D = A + B - C).',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Tính chất cơ bản của tỉ lệ thức: a/b = c/d ⇒ a·d = b·c. Khi đó D = 3 + 6 - 1 = 8.',
      },
    ],
  },
  {
    id: 'b04-set-spy-a1z26',
    title: 'Điệp Viên Giải Mã A1Z26 – Mật Danh Môn Học (Tin Học)',
    subject: 'informatics',
    grade: '6',
    chapter: 'Máy tính và cộng đồng',
    lesson: 'Biểu diễn thông tin và mã hóa',
    codeStyle: 'A1Z26',
    codeLength: 6,
    finalCode: 'TINHOC',
    originalDisplayAnswer: 'TIN HỌC',
    acceptedCodes: ['TINHOC', 'TIN HOC', 'TINHỌC', 'TIN HỌC'],
    encodedBannerText: '20 – 9 – 14 – 8 – 15 – 3',
    ruleDescription:
      'Chế độ Điệp viên – Mã số Chữ cái (A1Z26): Sử dụng bảng 26 chữ cái chuẩn hóa không dấu (A=1, B=2, C=3, ..., Z=26; chữ Đ quy ước thành D, bỏ dấu thanh tiếng Việt). Giải mã dãy số 20 – 9 – 14 – 8 – 15 – 3 để tìm mật khẩu 6 chữ cái.',
    hints: [
      'Gợi ý 1: Tra bảng A1Z26: 20 = T, 9 = I, 14 = N (3 chữ cái đầu tạo thành từ TIN).',
      'Gợi ý 2: Tra tiếp 3 số sau: 8 = H, 15 = O, 3 = C.',
      'Gợi ý 3: Ghép 6 chữ cái không dấu trên ổ khóa: T - I - N - H - O - C (TIN HỌC).',
    ],
    stepByStepSolution:
      'Quy tắc bảng chữ cái chuẩn hóa 26 ký tự (A=1 ... Z=26, bỏ dấu tiếng Việt):\n• 20 → T\n• 9 → I\n• 14 → N\n• 8 → H\n• 15 → O\n• 3 → C\n⇒ Từ khóa giải mã: TINHOC (nghĩa tiếng Việt có dấu: TIN HỌC).',
    status: 'approved',
    authorId: 'system',
    updatedAt: '2026-11-15T00:00:00Z',
    stations: [
      {
        id: 'st-spy-1',
        orderIndex: 0,
        title: 'Trạm Điệp Viên #1: Đơn Vị Dữ Liệu',
        runeSymbol: '◆',
        questionSource: 'builtin',
        questionText: 'Một Byte (B) trong bộ nhớ máy tính bằng bao nhiêu bit (b)?',
        questionType: 'single_choice',
        options: ['4 bit', '8 bit', '16 bit', '1024 bit'],
        correctAnswer: '8 bit',
        difficulty: 'Nhận biết',
        clueToken: '20=T, 9=I',
        clueDescription: 'Giải mã cặp số đầu tiên (20 – 9): 20 ứng với chữ T, 9 ứng với chữ I.',
        points: 10,
        timeLimitSec: 20,
        explanation: '1 Byte = 8 bit là đơn vị cơ bản dùng để đo dung lượng lưu trữ.',
      },
      {
        id: 'st-spy-2',
        orderIndex: 1,
        title: 'Trạm Điệp Viên #2: Bộ Xử Lý Trung Tâm',
        runeSymbol: '★',
        questionSource: 'builtin',
        questionText: 'Thiết bị nào được ví như "bộ não" của máy tính, thực hiện mọi phép tính và điều khiển?',
        questionType: 'single_choice',
        options: ['Chuột máy tính', 'Màn hình', 'CPU', 'Bàn phím'],
        correctAnswer: 'CPU',
        difficulty: 'Nhận biết',
        clueToken: '14=N',
        clueDescription: 'Giải mã số thứ 3 (14): Chữ cái thứ 14 trong bảng A–Z là N (ghép được chữ TIN).',
        points: 10,
        timeLimitSec: 20,
        explanation: 'CPU (Central Processing Unit) là bộ xử lý trung tâm của máy tính.',
      },
      {
        id: 'st-spy-3',
        orderIndex: 2,
        title: 'Trạm Điệp Viên #3: Thiết Bị Nhập',
        runeSymbol: '▲',
        questionSource: 'builtin',
        questionText: 'Thiết bị nào sau đây là thiết bị vào (Input Device) dùng để gõ văn bản vào máy tính?',
        questionType: 'single_choice',
        options: ['Bàn phím', 'Máy in', 'Loa', 'Máy chiếu'],
        correctAnswer: 'Bàn phím',
        difficulty: 'Nhận biết',
        clueToken: '8=H, 15=O',
        clueDescription: 'Giải mã cặp số thứ 4 và 5 (8 – 15): 8 ứng với chữ H, 15 ứng với chữ O.',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Bàn phím là thiết bị nhập dữ liệu chuẩn của máy tính.',
      },
      {
        id: 'st-spy-4',
        orderIndex: 3,
        title: 'Trạm Điệp Viên #4: Mạng Toàn Cầu',
        runeSymbol: '●',
        questionSource: 'builtin',
        questionText: 'Trình duyệt web (Web Browser) được sử dụng để làm gì?',
        questionType: 'single_choice',
        options: [
          'Truy cập và xem các trang web trên Internet',
          'Soạn thảo bảng tính offline',
          'Quét virus phần cứng',
          'Sạc pin cho máy tính',
        ],
        correctAnswer: 'Truy cập và xem các trang web trên Internet',
        difficulty: 'Thông hiểu',
        clueToken: '3=C',
        clueDescription: 'Giải mã số cuối cùng (3): Chữ cái thứ 3 trong bảng A–Z là C.',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Trình duyệt web giúp người dùng truy cập các trang thông tin trên World Wide Web.',
      },
    ],
  },
  {
    id: 'b04-set-spy-caesar',
    title: 'Điệp Viên Mật Mã Caesar – Giải Mã Tên Trường (TÂY ĐÔ)',
    subject: 'general',
    grade: '8',
    chapter: 'Mật mã học & Tư duy logic',
    lesson: 'Mật mã dịch chuyển Caesar (Shift +3)',
    codeStyle: 'CAESAR',
    codeLength: 5,
    finalCode: 'TAYDO',
    originalDisplayAnswer: 'TÂY ĐÔ',
    acceptedCodes: ['TAYDO', 'TAY DO', 'TÂY ĐÔ', 'TÂYĐÔ'],
    encodedBannerText: 'W – D – B – G – R (Mã hóa Caesar dịch tiến +3)',
    caesarShift: 3,
    ruleDescription:
      'Chế độ Điệp viên – Mã Caesar (Dịch chuyển k = +3 trên bảng 26 chữ cái A–Z không dấu, quy ước Đ → D): Mỗi chữ cái gốc đã bị dịch tiến 3 vị trí trong bảng chữ cái (ví dụ A → D, B → E). Để giải mã chuỗi WDBGR, hãy lùi mỗi chữ cái về trước 3 bước!',
    hints: [
      'Gợi ý 1: Lùi 3 bước từ chữ W: W → V → U → T. Vậy chữ cái đầu tiên là T.',
      'Gợi ý 2: Lùi 3 bước từ D được A; lùi 3 bước từ B (qua A → Z → Y) được Y ⇒ 3 chữ đầu là TAY (TÂY).',
      'Gợi ý 3: Lùi 3 bước từ G được D; lùi 3 bước từ R được O ⇒ Mật mã 5 chữ cái là TAYDO (TÂY ĐÔ).',
    ],
    stepByStepSolution:
      'Quy tắc giải mã Caesar (lùi 3 vị trí trên vòng tròn 26 chữ cái A–Z):\n• W (-3) → T\n• D (-3) → A\n• B (-3 qua A, Z) → Y\n• G (-3) → D (tương ứng chữ Đ trong tiếng Việt)\n• R (-3) → O (tương ứng chữ Ô trong tiếng Việt)\n⇒ Mật mã mở khóa: TAYDO (Trường THCS Tây Đô).',
    status: 'approved',
    authorId: 'system',
    updatedAt: '2026-11-15T00:00:00Z',
    stations: [
      {
        id: 'st-caesar-1',
        orderIndex: 0,
        title: 'Trạm Caesar #1: Khóa Dịch Chuyển',
        runeSymbol: '◆',
        questionSource: 'builtin',
        questionText: 'Trong bảng chữ cái A–Z, nếu dịch tiến chữ A thêm 3 vị trí thì ta nhận được chữ cái nào?',
        questionType: 'single_choice',
        options: ['Chữ C', 'Chữ D', 'Chữ E', 'Chữ F'],
        correctAnswer: 'Chữ D',
        difficulty: 'Nhận biết',
        clueToken: 'W → T',
        clueDescription: 'Ký tự mã hóa thứ 1 là W: Lùi 3 bước (W → V → U → T) ta tìm được chữ cái đầu là T.',
        points: 10,
        timeLimitSec: 20,
        explanation: 'A (+1) → B (+1) → C (+1) → D. Ngược lại từ D lùi 3 bước sẽ về A.',
      },
      {
        id: 'st-caesar-2',
        orderIndex: 1,
        title: 'Trạm Caesar #2: Vòng Tròn Chữ Cái',
        runeSymbol: '★',
        questionSource: 'builtin',
        questionText: 'Sông Hậu chảy qua thành phố Cần Thơ là một trong hai nhánh chính của hệ thống sông nào?',
        questionType: 'single_choice',
        options: ['Sông Hồng', 'Sông Mê Kông (Cửu Long)', 'Sông Đà', 'Sông Đồng Nai'],
        correctAnswer: 'Sông Mê Kông (Cửu Long)',
        difficulty: 'Nhận biết',
        clueToken: 'D → A, B → Y',
        clueDescription: 'Ký tự thứ 2 và 3 (D, B): Lùi 3 bước từ D được A, lùi 3 bước từ B qua Z được Y (ghép thành TAY).',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Sông Tiền và sông Hậu là hai nhánh chính của sông Mê Kông khi chảy vào miền Tây Nam Bộ.',
      },
      {
        id: 'st-caesar-3',
        orderIndex: 2,
        title: 'Trạm Caesar #3: Chuẩn Hóa Tiếng Việt',
        runeSymbol: '▲',
        questionSource: 'builtin',
        questionText: 'Trong mật mã học cổ điển dùng bảng 26 chữ cái Latinh không dấu, chữ "Đ" trong tiếng Việt được quy ước chuyển thành chữ nào?',
        questionType: 'single_choice',
        options: ['Chữ D', 'Chữ E', 'Chữ G', 'Chữ B'],
        correctAnswer: 'Chữ D',
        difficulty: 'Nhận biết',
        clueToken: 'G → D (Đ)',
        clueDescription: 'Ký tự thứ 4 là G: Lùi 3 bước (G → F → E → D) ta được chữ D (đại diện cho chữ Đ).',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Chữ Đ/đ được quy ước chuẩn hóa thành chữ D khi mã hóa trên bảng 26 ký tự A–Z.',
      },
      {
        id: 'st-caesar-4',
        orderIndex: 3,
        title: 'Trạm Caesar #4: Mảnh Ghép Cuối Cùng',
        runeSymbol: '●',
        questionSource: 'builtin',
        questionText: 'Tên gọi lịch sử "Tây Đô" gắn liền với vùng đất trung tâm nào của vùng Đồng bằng sông Cửu Long?',
        questionType: 'single_choice',
        options: ['Cần Thơ', 'Cà Mau', 'Bến Tre', 'Tây Ninh'],
        correctAnswer: 'Cần Thơ',
        difficulty: 'Thông hiểu',
        clueToken: 'R → O (Ô)',
        clueDescription: 'Ký tự thứ 5 là R: Lùi 3 bước (R → Q → P → O) ta được chữ O ⇒ Hoàn tất mật mã TAYDO.',
        points: 10,
        timeLimitSec: 20,
        explanation: 'Cần Thơ từ lâu được mệnh danh là Tây Đô – thủ phủ miền Tây Nam Bộ.',
      },
    ],
  },
];

// ============================================================================
// WEB AUDIO SYNTHESIZER FOR SECRET CODE ADVENTURE
// ============================================================================

class SecretAdventureAudio {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
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

  public playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', gainVal = 0.12) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Ignore audio errors
    }
  }

  public playStart(muted: boolean) {
    if (muted) return;
    [330, 440, 554, 659].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 150, 'triangle', 0.12), idx * 80);
    });
  }

  public playDialClick(muted: boolean) {
    if (muted) return;
    this.playTone(620, 45, 'triangle', 0.08);
  }

  public playCorrect(muted: boolean) {
    if (muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 160, 'sine', 0.14), idx * 75);
    });
  }

  public playWrong(muted: boolean) {
    if (muted) return;
    [240, 195].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 220, 'sawtooth', 0.11), idx * 140);
    });
  }

  public playClueUnlocked(muted: boolean) {
    if (muted) return;
    [587.33, 783.99, 987.77, 1174.66].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 140, 'triangle', 0.13), idx * 65);
    });
  }

  public playUnlockChest(muted: boolean) {
    if (muted) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.5];
    notes.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 220, 'triangle', 0.15), idx * 95);
    });
  }
}

const adventureAudio = new SecretAdventureAudio();

// ============================================================================
// MAIN COMPONENT: SecretCodeGame (B04)
// ============================================================================

export const SecretCodeGame: React.FC<SecretCodeGameProps> = ({
  availableCandidates,
  classes = [],
  questions = [],
  selectedSourceKey,
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  teacherId = 'teacher-1',
  teacherName = 'Giáo viên',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onOpenAbsentModal,
  onOpenHistoryModal,
}) => {
  // 1. Custom & Built-in Sets
  const [customSets, setCustomSets] = useState<SecretCodeSet[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_SETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });

  const allSets = useMemo(() => [...BUILTIN_SECRET_SETS, ...customSets], [customSets]);

  // 2. Core Mode & Active Set
  const [playMode, setPlayMode] = useState<SecretCodePlayMode>('TREASURE_CODE');
  const [selectedSetId, setSelectedSetId] = useState<string>(BUILTIN_SECRET_SETS[0].id);
  const activeSet = useMemo(
    () => allSets.find((s) => s.id === selectedSetId) || BUILTIN_SECRET_SETS[0],
    [allSets, selectedSetId]
  );

  // 3. State Machine
  const [stageState, setStageState] = useState<SecretCodeStageState>('READY');
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // 4. Scoring & Rules Configuration
  const [pointsPerCorrect, setPointsPerCorrect] = useState<number>(10);
  const [pointsPerCrack, setPointsPerCrack] = useState<number>(30);
  const [hintPenalty, setHintPenalty] = useState<number>(5);
  const [speedBonusPoints, setSpeedBonusPoints] = useState<number>(10);
  const [maxCodeAttempts, setMaxCodeAttempts] = useState<number>(5);

  // 5. Active Gameplay State
  const [unlockedStationIds, setUnlockedStationIds] = useState<string[]>([]);
  const [scoredActionKeys, setScoredActionKeys] = useState<string[]>([]);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [selectedAnswerInput, setSelectedAnswerInput] = useState<string>('');
  const [stationFeedback, setStationFeedback] = useState<{
    isCorrect: boolean;
    message: string;
    clueToken?: string;
  } | null>(null);

  // 6. Rotary Combination Lock Dials State
  const [dialValues, setDialValues] = useState<string[]>(() =>
    Array.from({ length: BUILTIN_SECRET_SETS[0].codeLength }, () => '0')
  );
  const [codeAttemptsUsed, setCodeAttemptsUsed] = useState<number>(0);
  const [lockCheckFeedback, setLockCheckFeedback] = useState<{
    status: 'IDLE' | 'CHECKING' | 'WRONG' | 'UNLOCKED';
    message: string;
  }>({ status: 'IDLE', message: '' });
  const [unlockedHintsCount, setUnlockedHintsCount] = useState<number>(0);
  const [caesarInspectorShift, setCaesarInspectorShift] = useState<number>(3);

  // 7. Individual & Team Score Tracking
  const [individualScore, setIndividualScore] = useState<number>(0);
  const [calledStudent, setCalledStudent] = useState<StudentCandidate | null>(null);
  const [teamCount, setTeamCount] = useState<number>(3);
  const [teamCodePolicy, setTeamCodePolicy] = useState<'SHARED_CODE' | 'TEAM_SPECIFIC_CODE'>('SHARED_CODE');
  const [teams, setTeams] = useState<SecretCodeTeam[]>([]);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number>(0);
  const [scoreHistory, setScoreHistory] = useState<ScoreActionHistoryItem[]>([]);

  // 8. Timers
  const [questionTimerSec, setQuestionTimerSec] = useState<number>(20);
  const [isQuestionTimerRunning, setIsQuestionTimerRunning] = useState<boolean>(false);
  const [sessionElapsedSec, setSessionElapsedSec] = useState<number>(0);
  const sessionStartRef = useRef<string>(new Date().toISOString());

  // 9. Designer Mode State (Màn hình "Thiết kế mật mã" + Kết nối Ngân hàng câu hỏi)
  const [designerTitle, setDesignerTitle] = useState<string>('Hành Trình Giải Mã Kiến Thức Mới');
  const [designerSubject, setDesignerSubject] = useState<string>('math');
  const [designerGrade, setDesignerGrade] = useState<Grade>('6');
  const [designerChapter, setDesignerChapter] = useState<string>('');
  const [designerLesson, setDesignerLesson] = useState<string>('');
  const [designerDifficulty, setDesignerDifficulty] = useState<string>('ALL');
  const [designerCodeStyle, setDesignerCodeStyle] = useState<SecretCodeStyle>('DIRECT_ORDER');
  const [designerCodeLength, setDesignerCodeLength] = useState<number>(4);
  const [designerFinalCode, setDesignerFinalCode] = useState<string>('2468');
  const [designerOriginalAnswer, setDesignerOriginalAnswer] = useState<string>('2468');
  const [designerRuleDesc, setDesignerRuleDesc] = useState<string>(
    'Vượt qua các trạm câu hỏi để thu thập từng ký tự mật mã theo đúng thứ tự.'
  );
  const [designerStepSolution, setDesignerStepSolution] = useState<string>(
    'Ghép lần lượt các mảnh mật mã từ Trạm #1 đến trạm cuối để mở khóa.'
  );
  const [designerStations, setDesignerStations] = useState<SecretChallengeStation[]>(
    BUILTIN_SECRET_SETS[0].stations
  );
  const [designerBannerMessage, setDesignerBannerMessage] = useState<string | null>(null);

  // ============================================================================
  // INITIALIZE TEAMS & RESTORE SAVED SESSION
  // ============================================================================

  const buildTeamsFromCandidates = useCallback(
    (count: number): SecretCodeTeam[] => {
      const pool = [...availableCandidates];
      return TEAM_PRESETS.slice(0, count).map((preset, idx) => {
        const members = pool.filter((_, i) => i % count === idx);
        const assignedSet = BUILTIN_SECRET_SETS[idx % BUILTIN_SECRET_SETS.length];
        return {
          id: preset.id,
          name: preset.name,
          colorHex: preset.colorHex,
          members,
          score: 0,
          unlockedStationIds: [],
          correctAnswersCount: 0,
          codeAttempts: 0,
          assignedSetId: assignedSet.id,
        };
      });
    },
    [availableCandidates]
  );

  useEffect(() => {
    setTeams(buildTeamsFromCandidates(teamCount));
  }, [teamCount, buildTeamsFromCandidates]);

  // Reset dial values when activeSet changes
  useEffect(() => {
    const cleanCode = normalizeCodeString(activeSet.finalCode);
    const isNumericOnly = /^[0-9]+$/.test(cleanCode);
    setDialValues(
      Array.from({ length: activeSet.codeLength }, () => (isNumericOnly ? '0' : 'A'))
    );
    setUnlockedStationIds([]);
    setScoredActionKeys([]);
    setActiveStationId(null);
    setStationFeedback(null);
    setCodeAttemptsUsed(0);
    setUnlockedHintsCount(0);
    setLockCheckFeedback({ status: 'IDLE', message: '' });
    setStageState('READY');
  }, [activeSet.id, activeSet.codeLength, activeSet.finalCode]);

  // Restore saved session on first mount if valid
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(STORAGE_ACTIVE_SESSION_KEY);
      if (!savedRaw) return;
      const saved = JSON.parse(savedRaw);
      if (saved && saved.setId === selectedSetId && Array.isArray(saved.unlockedStationIds)) {
        setUnlockedStationIds(saved.unlockedStationIds);
        if (Array.isArray(saved.dialValues) && saved.dialValues.length === activeSet.codeLength) {
          setDialValues(saved.dialValues);
        }
        if (typeof saved.individualScore === 'number') {
          setIndividualScore(saved.individualScore);
        }
        if (typeof saved.codeAttemptsUsed === 'number') {
          setCodeAttemptsUsed(saved.codeAttemptsUsed);
        }
      }
    } catch {
      // Ignore corrupt session
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save active session state to localStorage
  useEffect(() => {
    try {
      const payload = {
        setId: activeSet.id,
        playMode,
        stageState,
        unlockedStationIds,
        dialValues,
        individualScore,
        codeAttemptsUsed,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_ACTIVE_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    activeSet.id,
    playMode,
    stageState,
    unlockedStationIds,
    dialValues,
    individualScore,
    codeAttemptsUsed,
  ]);

  // Question countdown timer
  useEffect(() => {
    if (!isQuestionTimerRunning || stageState !== 'QUESTION') return;
    if (questionTimerSec <= 0) {
      setIsQuestionTimerRunning(false);
      return;
    }
    const timer = setInterval(() => {
      setQuestionTimerSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isQuestionTimerRunning, questionTimerSec, stageState]);

  // Overall session elapsed timer
  useEffect(() => {
    if (stageState === 'COMPLETED' || stageState === 'SETUP') return;
    const interval = setInterval(() => {
      setSessionElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [stageState]);

  // ============================================================================
  // HELPER COMPUTATIONS
  // ============================================================================

  const activeStation = useMemo(
    () => activeSet.stations.find((s) => s.id === activeStationId) || null,
    [activeSet.stations, activeStationId]
  );

  const normalizedTargetCode = useMemo(
    () => normalizeCodeString(activeSet.finalCode),
    [activeSet.finalCode]
  );

  const isTargetNumericOnly = useMemo(
    () => /^[0-9]+$/.test(normalizedTargetCode),
    [normalizedTargetCode]
  );

  const dialCharacterPool = useMemo(() => {
    if (isTargetNumericOnly) {
      return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    }
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  }, [isTargetNumericOnly]);

  // ============================================================================
  // GAMEPLAY HANDLERS (STATE MACHINE)
  // ============================================================================

  const pickRandomStudentForStation = useCallback(() => {
    if (!availableCandidates.length) return;
    const randomIdx = Math.floor(Math.random() * availableCandidates.length);
    setCalledStudent(availableCandidates[randomIdx]);
  }, [availableCandidates]);

  const handleSelectStation = (station: SecretChallengeStation) => {
    if (stageState === 'UNLOCKING' || stageState === 'COMPLETED') return;
    setActiveStationId(station.id);
    setSelectedAnswerInput('');
    setStationFeedback(null);
    setQuestionTimerSec(station.timeLimitSec || 20);
    setIsQuestionTimerRunning(true);
    setStageState('QUESTION');
    adventureAudio.playDialClick(isMuted);
  };

  const recordScoreChange = (description: string, deltaScore: number, teamId?: string, stationId?: string) => {
    const entry: ScoreActionHistoryItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      description,
      teamId,
      deltaScore,
      stationId,
    };
    setScoreHistory((prev) => [entry, ...prev.slice(0, 19)]);
  };

  const handleUndoLastScore = () => {
    if (scoreHistory.length === 0) return;
    const [last, ...rest] = scoreHistory;
    setScoreHistory(rest);
    if (last.teamId) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === last.teamId ? { ...t, score: Math.max(0, t.score - last.deltaScore) } : t
        )
      );
    } else {
      setIndividualScore((prev) => Math.max(0, prev - last.deltaScore));
    }
  };

  const handleSubmitStationAnswer = () => {
    if (!activeStation) return;
    if (!selectedAnswerInput.trim()) return;

    setStageState('CHECKING');
    setIsQuestionTimerRunning(false);

    const normalizedUser = normalizeCodeString(selectedAnswerInput);
    const normalizedCorrect = normalizeCodeString(activeStation.correctAnswer);
    const isCorrect =
      normalizedUser === normalizedCorrect ||
      selectedAnswerInput.trim().toLowerCase() === activeStation.correctAnswer.trim().toLowerCase();

    const actionKey = `station-${activeStation.id}`;
    const alreadyUnlocked = unlockedStationIds.includes(activeStation.id);
    const alreadyScored = scoredActionKeys.includes(actionKey);

    if (isCorrect) {
      adventureAudio.playCorrect(isMuted);
      setTimeout(() => adventureAudio.playClueUnlocked(isMuted), 240);

      // Không cho phép nhận 2 mảnh mã hoặc cộng điểm 2 lần từ cùng 1 thử thách
      if (!alreadyUnlocked) {
        setUnlockedStationIds((prev) => [...prev, activeStation.id]);
      }

      // Nếu là Kiểu A (DIRECT_ORDER) và token có 1 ký tự, tự động gợi ý/đặt vào vòng khóa tương ứng
      if (
        activeSet.codeStyle === 'DIRECT_ORDER' &&
        activeStation.orderIndex < dialValues.length
      ) {
        const cleanToken = normalizeCodeString(activeStation.clueToken);
        if (cleanToken.length === 1) {
          setDialValues((prev) => {
            const next = [...prev];
            next[activeStation.orderIndex] = cleanToken;
            return next;
          });
        }
      }

      if (!alreadyScored) {
        setScoredActionKeys((prev) => [...prev, actionKey]);
        const awardPts = activeStation.points || pointsPerCorrect;

        if (playMode === 'TEAM_ARENA' && teams.length > 0) {
          const currentTeam = teams[activeTeamIndex];
          setTeams((prev) =>
            prev.map((t, idx) =>
              idx === activeTeamIndex
                ? {
                    ...t,
                    score: t.score + awardPts,
                    correctAnswersCount: t.correctAnswersCount + 1,
                    unlockedStationIds: t.unlockedStationIds.includes(activeStation.id)
                      ? t.unlockedStationIds
                      : [...t.unlockedStationIds, activeStation.id],
                  }
                : t
            )
          );
          recordScoreChange(
            `${currentTeam.name} giải đúng ${activeStation.title} (+${awardPts}đ)`,
            awardPts,
            currentTeam.id,
            activeStation.id
          );
        } else {
          setIndividualScore((prev) => prev + awardPts);
          recordScoreChange(
            `Giải đúng ${activeStation.title} (+${awardPts}đ)`,
            awardPts,
            undefined,
            activeStation.id
          );
        }
      }

      setStationFeedback({
        isCorrect: true,
        message: alreadyUnlocked
          ? 'Chính xác! Mảnh manh mối này đã được thu thập trước đó.'
          : `Chính xác! Đã mở khóa mảnh manh mối: ${activeStation.clueToken}`,
        clueToken: activeStation.clueToken,
      });
      setStageState('CLUE_UNLOCKED');
    } else {
      adventureAudio.playWrong(isMuted);
      setStationFeedback({
        isCorrect: false,
        message: 'Chưa chính xác! Hãy suy nghĩ lại hoặc chuyển quyền trợ giúp.',
      });
      setStageState('ANSWERING');
      if (playMode === 'TEAM_ARENA' && teams.length > 1) {
        setActiveTeamIndex((prev) => (prev + 1) % teams.length);
      }
    }
  };

  // Xoay từng vòng khóa mật mã (Rotary Dial)
  const handleRotateDial = (dialIdx: number, direction: 1 | -1) => {
    if (stageState === 'COMPLETED' || stageState === 'UNLOCKING') return;
    adventureAudio.playDialClick(isMuted);
    setStageState('CODE_ENTRY');
    setLockCheckFeedback({ status: 'IDLE', message: '' });

    setDialValues((prev) => {
      const next = [...prev];
      const currentVal = next[dialIdx] || dialCharacterPool[0];
      const currentPos = Math.max(0, dialCharacterPool.indexOf(currentVal));
      const nextPos =
        (currentPos + direction + dialCharacterPool.length) % dialCharacterPool.length;
      next[dialIdx] = dialCharacterPool[nextPos];
      return next;
    });
  };

  const handleDirectCodeInput = (rawText: string) => {
    if (stageState === 'COMPLETED' || stageState === 'UNLOCKING') return;
    const clean = normalizeCodeString(rawText).slice(0, activeSet.codeLength);
    setStageState('CODE_ENTRY');
    setLockCheckFeedback({ status: 'IDLE', message: '' });

    setDialValues((prev) => {
      const next = [...prev];
      for (let i = 0; i < activeSet.codeLength; i++) {
        next[i] = clean[i] || (isTargetNumericOnly ? '0' : 'A');
      }
      return next;
    });
  };

  // Lưu kết quả phiên chơi lên Supabase (audit_logs)
  const persistSessionToSupabase = useCallback(
    async (finalResult: 'UNLOCKED' | 'FAILED', totalAttempts: number) => {
      if (!isSupabaseConfigured) return;
      try {
        await supabase.from('audit_logs').insert({
          actor_id: teacherId,
          actor_role: 'teacher',
          action_type: 'EDU_GAME_SESSION_COMPLETED',
          entity_type: 'edu_game_b04',
          entity_id: activeSet.id,
          metadata: {
            game_id: 'B04',
            game_title: 'Giải mã bí mật (EDU Secret Code Adventure 1.0)',
            set_id: activeSet.id,
            set_title: activeSet.title,
            play_mode: playMode,
            code_style: activeSet.codeStyle,
            class_name: resolvedClassName,
            teacher_name: teacherName,
            unlocked_stations: unlockedStationIds,
            code_attempts: totalAttempts,
            individual_score: individualScore,
            teams_summary: teams.map((t) => ({
              name: t.name,
              score: t.score,
              unlockedCount: t.unlockedStationIds.length,
              attempts: t.codeAttempts,
            })),
            final_result: finalResult,
            started_at: sessionStartRef.current,
            completed_at: new Date().toISOString(),
          },
        });
      } catch {
        // Ignore network/RLS errors gracefully
      }
    },
    [
      teacherId,
      activeSet.id,
      activeSet.title,
      activeSet.codeStyle,
      playMode,
      resolvedClassName,
      teacherName,
      unlockedStationIds,
      individualScore,
      teams,
    ]
  );

  // Kiểm tra mật mã ổ khóa
  const handleVerifyLockCode = () => {
    if (stageState === 'UNLOCKING' || stageState === 'COMPLETED') return;
    if (codeAttemptsUsed >= maxCodeAttempts) {
      setLockCheckFeedback({
        status: 'WRONG',
        message: `Đã hết số lượt thử mật mã tối đa (${maxCodeAttempts} lượt). Giáo viên có thể cấp thêm lượt hoặc đặt lại!`,
      });
      return;
    }

    const enteredCode = normalizeCodeString(dialValues.join(''));
    const nextAttemptCount = codeAttemptsUsed + 1;
    setCodeAttemptsUsed(nextAttemptCount);

    const acceptedNormalized = new Set([
      normalizedTargetCode,
      ...activeSet.acceptedCodes.map((c) => normalizeCodeString(c)),
    ]);

    setLockCheckFeedback({
      status: 'CHECKING',
      message: 'Đang kiểm tra khớp bánh răng ổ khóa...',
    });

    if (acceptedNormalized.has(enteredCode)) {
      setStageState('UNLOCKING');
      adventureAudio.playUnlockChest(isMuted);

      const crackActionKey = `crack-code-${activeSet.id}`;
      const fastBonus = sessionElapsedSec <= 180 ? speedBonusPoints : 0;
      const totalCrackAward = pointsPerCrack + fastBonus;

      if (!scoredActionKeys.includes(crackActionKey)) {
        setScoredActionKeys((prev) => [...prev, crackActionKey]);
        if (playMode === 'TEAM_ARENA' && teams.length > 0) {
          const currentTeam = teams[activeTeamIndex];
          setTeams((prev) =>
            prev.map((t, idx) =>
              idx === activeTeamIndex
                ? {
                    ...t,
                    score: t.score + totalCrackAward,
                    codeAttempts: t.codeAttempts + 1,
                    completedTimeSec: sessionElapsedSec,
                  }
                : t
            )
          );
          recordScoreChange(
            `${currentTeam.name} mở khóa Rương Kho Báu (+${totalCrackAward}đ)`,
            totalCrackAward,
            currentTeam.id
          );
        } else {
          setIndividualScore((prev) => prev + totalCrackAward);
          recordScoreChange(
            `Mở khóa Rương Kho Báu thành công (+${totalCrackAward}đ)`,
            totalCrackAward
          );
        }
      }

      setTimeout(() => {
        setLockCheckFeedback({
          status: 'UNLOCKED',
          message: `Chốt khóa đã mở! Mật mã chính xác: ${activeSet.originalDisplayAnswer}`,
        });
        setStageState('COMPLETED');
        persistSessionToSupabase('UNLOCKED', nextAttemptCount);
      }, 650);
    } else {
      adventureAudio.playWrong(isMuted);
      if (playMode === 'TEAM_ARENA' && teams.length > 0) {
        setTeams((prev) =>
          prev.map((t, idx) =>
            idx === activeTeamIndex ? { ...t, codeAttempts: t.codeAttempts + 1 } : t
          )
        );
        if (teams.length > 1) {
          setActiveTeamIndex((prev) => (prev + 1) % teams.length);
        }
      }
      setLockCheckFeedback({
        status: 'WRONG',
        message: `Mật mã "${enteredCode}" chưa khớp! Còn ${Math.max(
          0,
          maxCodeAttempts - nextAttemptCount
        )} lượt thử. Các mảnh mã đã thu thập vẫn được giữ nguyên.`,
      });
      setStageState('CODE_ENTRY');
    }
  };

  // Mở gợi ý (có trừ điểm nếu cấu hình)
  const handleUnlockNextHint = () => {
    if (unlockedHintsCount >= activeSet.hints.length) return;
    const nextHintLevel = unlockedHintsCount + 1;
    setUnlockedHintsCount(nextHintLevel);
    adventureAudio.playDialClick(isMuted);

    if (hintPenalty > 0) {
      if (playMode === 'TEAM_ARENA' && teams.length > 0) {
        const currentTeam = teams[activeTeamIndex];
        setTeams((prev) =>
          prev.map((t, idx) =>
            idx === activeTeamIndex ? { ...t, score: Math.max(0, t.score - hintPenalty) } : t
          )
        );
        recordScoreChange(
          `${currentTeam.name} dùng Gợi ý cấp ${nextHintLevel} (-${hintPenalty}đ)`,
          -hintPenalty,
          currentTeam.id
        );
      } else {
        setIndividualScore((prev) => Math.max(0, prev - hintPenalty));
        recordScoreChange(`Dùng Gợi ý cấp ${nextHintLevel} (-${hintPenalty}đ)`, -hintPenalty);
      }
    }
  };

  // Khởi động lại phiên chơi
  const handleResetGameSession = () => {
    const cleanCode = normalizeCodeString(activeSet.finalCode);
    const isNumeric = /^[0-9]+$/.test(cleanCode);
    setDialValues(Array.from({ length: activeSet.codeLength }, () => (isNumeric ? '0' : 'A')));
    setUnlockedStationIds([]);
    setScoredActionKeys([]);
    setActiveStationId(null);
    setStationFeedback(null);
    setCodeAttemptsUsed(0);
    setUnlockedHintsCount(0);
    setIndividualScore(0);
    setScoreHistory([]);
    setSessionElapsedSec(0);
    sessionStartRef.current = new Date().toISOString();
    setTeams(buildTeamsFromCandidates(teamCount));
    setLockCheckFeedback({ status: 'IDLE', message: '' });
    setStageState('READY');
    adventureAudio.playStart(isMuted);
  };

  // ============================================================================
  // QUESTION BANK INTEGRATION & DESIGNER HELPERS
  // ============================================================================

  const filteredBankQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (designerSubject !== 'general' && q.subject && q.subject !== designerSubject) {
        return false;
      }
      if (q.grade && String(q.grade) !== String(designerGrade)) {
        return false;
      }
      if (designerChapter.trim() && q.chapter && !q.chapter.toLowerCase().includes(designerChapter.toLowerCase())) {
        return false;
      }
      if (designerLesson.trim() && q.lesson && !q.lesson.toLowerCase().includes(designerLesson.toLowerCase())) {
        return false;
      }
      if (designerDifficulty !== 'ALL' && String(q.level || '') !== designerDifficulty) {
        return false;
      }
      return true;
    });
  }, [
    questions,
    designerSubject,
    designerGrade,
    designerChapter,
    designerLesson,
    designerDifficulty,
  ]);

  const handleLoadStationsFromQuestionBank = () => {
    const cleanCode = normalizeCodeString(designerFinalCode);
    const targetLen = designerCodeLength;

    if (filteredBankQuestions.length === 0) {
      setDesignerBannerMessage(
        `Ngân hàng câu hỏi hiện có 0 câu khớp bộ lọc (Khối ${designerGrade} · ${
          SUBJECT_LABELS[designerSubject] || designerSubject
        }). Bạn có thể chọn thêm bài/môn, giảm số trạm hoặc nhập câu hỏi thủ công bên dưới.`
      );
      return;
    }

    const newStations: SecretChallengeStation[] = Array.from({ length: targetLen }, (_, idx) => {
      const bankQ = filteredBankQuestions[idx];
      const codeChar = cleanCode[idx] || String(idx + 1);

      if (bankQ) {
        let resolvedCorrect = bankQ.correctAnswer || '';
        const optionTexts =
          bankQ.options && bankQ.options.length > 0
            ? bankQ.options.map((o) => o.text)
            : undefined;

        if (bankQ.type === 'single_choice' && bankQ.options && bankQ.correctAnswer) {
          const matchedOpt = bankQ.options.find(
            (o) => o.label === bankQ.correctAnswer || o.id === bankQ.correctAnswer
          );
          if (matchedOpt) {
            resolvedCorrect = matchedOpt.text;
          }
        } else if (bankQ.type === 'short_answer' && bankQ.acceptedAnswers?.length) {
          resolvedCorrect = bankQ.acceptedAnswers[0];
        }

        return {
          id: `bank-st-${Date.now()}-${idx}`,
          orderIndex: idx,
          title: `Trạm #${idx + 1}: Thử thách bài học`,
          runeSymbol: RUNE_SYMBOLS[idx % RUNE_SYMBOLS.length],
          questionId: bankQ.id,
          questionSource: 'bank',
          questionText: bankQ.stem,
          questionType:
            bankQ.type === 'true_false_group'
              ? 'true_false'
              : bankQ.type === 'single_choice'
              ? 'single_choice'
              : 'short_answer',
          options: optionTexts,
          correctAnswer: resolvedCorrect || 'Đúng',
          difficulty: 'Nhận biết',
          clueToken: codeChar,
          clueDescription: `Mảnh mật mã vị trí #${idx + 1} là "${codeChar}".`,
          points: 10,
          timeLimitSec: 20,
          explanation: bankQ.explanation || `Đáp án chuẩn từ ngân hàng câu hỏi: ${resolvedCorrect}`,
        };
      }

      // Nếu ngân hàng không đủ câu cho các trạm còn lại, giữ trạm trống để giáo viên nhập thủ công
      return {
        id: `manual-st-${Date.now()}-${idx}`,
        orderIndex: idx,
        title: `Trạm #${idx + 1}: Nhập câu hỏi thủ công`,
        runeSymbol: RUNE_SYMBOLS[idx % RUNE_SYMBOLS.length],
        questionSource: 'manual',
        questionText: '',
        questionType: 'short_answer',
        correctAnswer: '',
        difficulty: 'Nhận biết',
        clueToken: codeChar,
        clueDescription: `Mảnh mật mã vị trí #${idx + 1} là "${codeChar}".`,
        points: 10,
        timeLimitSec: 20,
        explanation: '',
      };
    });

    setDesignerStations(newStations);

    if (filteredBankQuestions.length < targetLen) {
      setDesignerBannerMessage(
        `Ngân hàng hiện chỉ có ${filteredBankQuestions.length}/${targetLen} câu hỏi khớp bộ lọc. Hệ thống đã nạp ${filteredBankQuestions.length} câu thật từ ngân hàng và để trống ${
          targetLen - filteredBankQuestions.length
        } trạm để Giáo viên nhập bổ sung hoặc giảm số mảnh mật mã.`
      );
    } else {
      setDesignerBannerMessage(
        `Đã nạp thành công ${targetLen} câu hỏi từ Ngân hàng câu hỏi Smart EDU!`
      );
    }
  };

  const designerDraftSet: SecretCodeSet = useMemo(() => {
    const cleanFinal = normalizeCodeString(designerFinalCode);
    const encodedBanner =
      designerCodeStyle === 'A1Z26'
        ? encodeToA1Z26(cleanFinal)
        : designerCodeStyle === 'CAESAR'
        ? `${encodeCaesar(cleanFinal, 3)} (Caesar +3)`
        : cleanFinal
            .split('')
            .map((_, i) => `[ #${i + 1} ]`)
            .join(' – ');

    return {
      id: `custom-b04-${Date.now()}`,
      title: designerTitle,
      subject: designerSubject,
      grade: designerGrade,
      chapter: designerChapter || 'Chủ đề tùy chọn',
      lesson: designerLesson || 'Bài học tùy chọn',
      codeStyle: designerCodeStyle,
      codeLength: designerCodeLength,
      finalCode: cleanFinal,
      originalDisplayAnswer: designerOriginalAnswer || cleanFinal,
      acceptedCodes: [cleanFinal, designerOriginalAnswer],
      encodedBannerText: encodedBanner,
      caesarShift: 3,
      ruleDescription: designerRuleDesc,
      hints: [
        `Gợi ý 1: Mật mã gồm ${designerCodeLength} ký tự. Hãy giải các trạm thử thách để mở manh mối.`,
        `Gợi ý 2: Ký tự đầu tiên của mật mã là "${cleanFinal[0] || ''}".`,
        `Gợi ý 3: Đáp án đầy đủ là "${designerOriginalAnswer || cleanFinal}".`,
      ],
      stepByStepSolution: designerStepSolution,
      stations: designerStations.slice(0, designerCodeLength),
      status: 'approved',
      authorId: teacherId,
      updatedAt: new Date().toISOString(),
    };
  }, [
    designerTitle,
    designerSubject,
    designerGrade,
    designerChapter,
    designerLesson,
    designerCodeStyle,
    designerCodeLength,
    designerFinalCode,
    designerOriginalAnswer,
    designerRuleDesc,
    designerStepSolution,
    designerStations,
    teacherId,
  ]);

  const designerValidation = useMemo(
    () => validateSecretCodeSet(designerDraftSet),
    [designerDraftSet]
  );

  const handleSaveCustomSet = (andPlayNow: boolean) => {
    if (!designerValidation.isValid) return;
    const newSet: SecretCodeSet = {
      ...designerDraftSet,
      id: `b04-custom-${Date.now()}`,
    };
    const updated = [newSet, ...customSets];
    setCustomSets(updated);
    try {
      localStorage.setItem(STORAGE_CUSTOM_SETS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage error
    }
    setDesignerBannerMessage(`Đã lưu bộ giải mã "${newSet.title}" thành công!`);
    if (andPlayNow) {
      setSelectedSetId(newSet.id);
      setPlayMode('TREASURE_CODE');
    }
  };

  // ============================================================================
  // RENDER UI
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* TOP CONTROL BAR */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-700/80 p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Game Identity & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5 pr-3 border-r border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 tracking-wider">B04 · KHỞI ĐỘNG</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-teal-300 font-semibold">{resolvedClassName}</span>
                </div>
                <h2 className="text-base font-black tracking-tight text-white">
                  Giải Mã Bí Mật – Secret Code Adventure
                </h2>
              </div>
            </div>

            {/* 4 Segmented Mode Buttons */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setPlayMode('TREASURE_CODE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  playMode === 'TREASURE_CODE'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                1. Mật mã kho báu
              </button>
              <button
                onClick={() => {
                  setPlayMode('SPY_CIPHER');
                  if (
                    activeSet.codeStyle !== 'A1Z26' &&
                    activeSet.codeStyle !== 'CAESAR' &&
                    activeSet.codeStyle !== 'SYMBOL_MAP'
                  ) {
                    setSelectedSetId('b04-set-spy-a1z26');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  playMode === 'SPY_CIPHER'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                2. Điệp viên giải mã
              </button>
              <button
                onClick={() => setPlayMode('TEAM_ARENA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  playMode === 'TEAM_ARENA'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                3. Đấu trường giải mã
              </button>
              <button
                onClick={() => setPlayMode('DESIGNER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  playMode === 'DESIGNER'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Thiết kế mật mã
              </button>
            </div>
          </div>

          {/* Right: Puzzle Selector & Classroom Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {playMode !== 'DESIGNER' && (
              <select
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(e.target.value)}
                aria-label="Chọn bộ mật mã"
                className="bg-slate-800 border border-slate-600 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 max-w-[270px] truncate"
              >
                {allSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{SUBJECT_LABELS[s.subject] || s.subject} K{s.grade}] {s.title}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setReduceMotion((prev) => !prev)}
              className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                reduceMotion
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Giảm hiệu ứng chuyển động cho máy cấu hình yếu"
            >
              {reduceMotion ? 'Đã giảm chuyển động' : 'Hiệu ứng chuẩn'}
            </button>

            <button
              onClick={onToggleMute}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-teal-400" />}
            </button>

            {onOpenAbsentModal && (
              <button
                onClick={onOpenAbsentModal}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5 text-sky-400" />
                Điểm danh ({availableCandidates.length})
              </button>
            )}

            <button
              onClick={handleResetGameSession}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Chơi lại
            </button>

            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* DESIGNER MODE ("THIẾT KẾ MẬT MÃ")                                    */}
      {/* ==================================================================== */}
      {playMode === 'DESIGNER' ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                Thiết Kế Bộ Giải Mã Bí Mật & Kết Nối Ngân Hàng Câu Hỏi
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Tạo thử thách mật mã mới, nạp câu hỏi từ Ngân hàng Smart EDU và kiểm tra tính giải được duy nhất trước khi lưu.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveCustomSet(false)}
                disabled={!designerValidation.isValid}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Lưu bộ giải mã
              </button>
              <button
                onClick={() => handleSaveCustomSet(true)}
                disabled={!designerValidation.isValid}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                Lưu & Chơi ngay
              </button>
            </div>
          </div>

          {designerBannerMessage && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-900 flex items-center justify-between gap-3">
              <span>{designerBannerMessage}</span>
              <button
                onClick={() => setDesignerBannerMessage(null)}
                className="text-blue-700 hover:underline font-bold whitespace-nowrap"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Step 1: General Metadata & Filter Bank */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên bộ giải mã</label>
              <input
                type="text"
                value={designerTitle}
                onChange={(e) => setDesignerTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
              <select
                value={designerGrade}
                onChange={(e) => setDesignerGrade(e.target.value as Grade)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              >
                <option value="6">Khối 6</option>
                <option value="7">Khối 7</option>
                <option value="8">Khối 8</option>
                <option value="9">Khối 9</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn học</label>
              <select
                value={designerSubject}
                onChange={(e) => setDesignerSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              >
                {Object.entries(SUBJECT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kiểu mật mã</label>
              <select
                value={designerCodeStyle}
                onChange={(e) => setDesignerCodeStyle(e.target.value as SecretCodeStyle)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              >
                <option value="DIRECT_ORDER">Kiểu A – Ghép mảnh theo thứ tự</option>
                <option value="LOGIC_DEDUCTION">Kiểu B – Mật mã suy luận logic</option>
                <option value="A1Z26">Điệp viên – Mã số A1Z26 (A=1..Z=26)</option>
                <option value="CAESAR">Điệp viên – Mã dịch chuyển Caesar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số mảnh mật mã</label>
              <select
                value={designerCodeLength}
                onChange={(e) => {
                  const len = Number(e.target.value);
                  setDesignerCodeLength(len);
                  setDesignerFinalCode((prev) =>
                    normalizeCodeString(prev).padEnd(len, '1').slice(0, len)
                  );
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              >
                <option value={4}>4 mảnh (4 vòng khóa)</option>
                <option value={5}>5 mảnh (5 vòng khóa)</option>
                <option value={6}>6 mảnh (6 vòng khóa)</option>
              </select>
            </div>
          </div>

          {/* Step 2: Code Target & Rule Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Đáp án mật mã chuẩn hóa ({designerCodeLength} ký tự A–Z hoặc 0–9)
              </label>
              <input
                type="text"
                maxLength={designerCodeLength}
                value={designerFinalCode}
                onChange={(e) => {
                  const clean = normalizeCodeString(e.target.value).slice(0, designerCodeLength);
                  setDesignerFinalCode(clean);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base font-mono font-black tracking-widest text-slate-900 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hiển thị đáp án gốc có dấu (VD: TÂY ĐÔ / 2518)
              </label>
              <input
                type="text"
                value={designerOriginalAnswer}
                onChange={(e) => setDesignerOriginalAnswer(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900"
              />
            </div>

            <div className="flex flex-col justify-end">
              <button
                onClick={handleLoadStationsFromQuestionBank}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                Nạp câu hỏi từ Ngân hàng ({filteredBankQuestions.length} câu khớp)
              </button>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Quy tắc giải mã công bố cho học sinh
              </label>
              <input
                type="text"
                value={designerRuleDesc}
                onChange={(e) => setDesignerRuleDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lời giải từng bước (hiển thị sau khi mở khóa)
              </label>
              <input
                type="text"
                value={designerStepSolution}
                onChange={(e) => setDesignerStepSolution(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Step 3: Stations List Editor */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-slate-800">
              Danh sách {designerCodeLength} trạm thử thách & mảnh manh mối
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: designerCodeLength }).map((_, idx) => {
                const st = designerStations[idx] || {
                  id: `temp-${idx}`,
                  orderIndex: idx,
                  title: `Trạm #${idx + 1}`,
                  runeSymbol: RUNE_SYMBOLS[idx % RUNE_SYMBOLS.length],
                  questionSource: 'manual',
                  questionText: '',
                  questionType: 'short_answer',
                  correctAnswer: '',
                  difficulty: 'Nhận biết',
                  clueToken: designerFinalCode[idx] || '',
                  clueDescription: '',
                  points: 10,
                  timeLimitSec: 20,
                  explanation: '',
                };

                const updateStationField = (patch: Partial<SecretChallengeStation>) => {
                  setDesignerStations((prev) => {
                    const copy = [...prev];
                    copy[idx] = { ...st, ...patch };
                    return copy;
                  });
                };

                return (
                  <div
                    key={st.id || idx}
                    className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">
                        {st.runeSymbol} Trạm #{idx + 1} ({st.questionSource === 'bank' ? 'Ngân hàng' : 'Thủ công'})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600">Mảnh mã:</span>
                        <input
                          type="text"
                          value={st.clueToken}
                          onChange={(e) => updateStationField({ clueToken: e.target.value })}
                          className="w-20 rounded-lg border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-black text-amber-900 text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                        Nội dung câu hỏi
                      </label>
                      <input
                        type="text"
                        value={st.questionText}
                        onChange={(e) => updateStationField({ questionText: e.target.value })}
                        placeholder="Nhập câu hỏi thử thách..."
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          Đáp án đúng của câu hỏi
                        </label>
                        <input
                          type="text"
                          value={st.correctAnswer}
                          onChange={(e) => updateStationField({ correctAnswer: e.target.value })}
                          placeholder="Đáp án..."
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-emerald-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          Mô tả manh mối mở ra
                        </label>
                        <input
                          type="text"
                          value={st.clueDescription}
                          onChange={(e) => updateStationField({ clueDescription: e.target.value })}
                          placeholder="Gợi ý suy luận..."
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: Validation Status */}
          <div
            className={`p-4 rounded-xl border ${
              designerValidation.isValid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-xs">
              {designerValidation.isValid ? (
                <>
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  Bộ giải mã hợp lệ & đã xác minh tính giải được duy nhất! Sẵn sàng lưu và tổ chức chơi.
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Cần hoàn thiện các mục sau trước khi lưu:
                </>
              )}
            </div>
            {designerValidation.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
                {designerValidation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        /* ==================================================================== */
        /* MAIN ADVENTURE STAGE (65-70% LEFT) & CONTROL PANEL (30-35% RIGHT)    */
        /* ==================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT 8 COLUMNS (~67%): SECRET CODE ADVENTURE STAGE & ROTARY LOCK */}
          <div className="lg:col-span-8 bg-gradient-to-b from-[#071126] via-[#0F1E3D] to-[#112A46] rounded-2xl border border-teal-500/30 p-5 text-white flex flex-col justify-between relative overflow-hidden shadow-xl min-h-[620px]">
            {/* Ambient Stage Lighting Rays (respects reduceMotion) */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className={`absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-full bg-teal-500/15 blur-3xl ${
                  reduceMotion ? '' : ' transition-opacity duration-700'
                }`}
              />
              <div
                className={`absolute bottom-10 left-1/2 -translate-x-1/2 w-[420px] h-[220px] rounded-full ${
                  stageState === 'COMPLETED' ? 'bg-amber-400/30' : 'bg-indigo-500/15'
                } blur-3xl`}
              />
            </div>

            {/* TOP STAGE HEADER: Adventure Title, Rule Banner & Timer */}
            <div className="relative z-10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-teal-300 font-bold">
                    <span>{SUBJECT_LABELS[activeSet.subject] || activeSet.subject}</span>
                    <span>·</span>
                    <span>Khối {activeSet.grade}</span>
                    <span>·</span>
                    <span>
                      {activeSet.codeStyle === 'DIRECT_ORDER'
                        ? 'Kiểu A: Ghép mảnh theo thứ tự'
                        : activeSet.codeStyle === 'LOGIC_DEDUCTION'
                        ? 'Kiểu B: Mật mã suy luận'
                        : activeSet.codeStyle === 'A1Z26'
                        ? 'Điệp viên: Mã A1Z26 (A=1..Z=26)'
                        : 'Điệp viên: Mã dịch chuyển Caesar'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-0.5">{activeSet.title}</h3>
                </div>

                {/* Status & Timer */}
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center gap-2 text-xs font-mono tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-slate-300">Thời gian:</span>
                    <span className="font-black text-amber-300">
                      {Math.floor(sessionElapsedSec / 60)}:
                      {String(sessionElapsedSec % 60).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-mono tabular-nums">
                    <span className="text-slate-300">Manh mối: </span>
                    <span className="font-black text-teal-300">
                      {unlockedStationIds.length}/{activeSet.stations.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rule & Encoded Message Banner */}
              <div className="bg-slate-900/85 border border-teal-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <ScrollText className="w-4 h-4" />
                    Quy tắc giải mã & Thông điệp bí mật:
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{activeSet.ruleDescription}</p>
                </div>
                <div className="shrink-0 bg-slate-950 border border-amber-400/50 rounded-xl px-4 py-2 text-center">
                  <div className="text-[11px] text-slate-400 font-semibold">BẢNG MẬT MÃ</div>
                  <div className="text-sm font-mono font-black text-amber-300 tracking-wider mt-0.5">
                    {activeSet.encodedBannerText}
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER ADVENTURE ARENA: TREASURE CHEST SVG + CHALLENGE RUNE STATIONS */}
            <div className="relative z-10 my-4 flex flex-col items-center justify-center">
              {/* Challenge Stations Row (4, 5, or 6 Rune Stones) */}
              <div className="w-full mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-teal-300">
                    BƯỚC 1: Chọn trạm thử thách để trả lời câu hỏi và thu thập mảnh mật mã
                  </span>
                  <span className="text-xs text-slate-300">
                    Nhấn vào từng trạm bên dưới ({unlockedStationIds.length}/{activeSet.stations.length} đã mở)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {activeSet.stations.map((st, idx) => {
                    const isUnlocked = unlockedStationIds.includes(st.id);
                    const isSelected = activeStationId === st.id;
                    return (
                      <button
                        key={st.id}
                        onClick={() => handleSelectStation(st)}
                        className={`group relative rounded-xl p-3 text-left border transition-all ${
                          isUnlocked
                            ? 'bg-emerald-950/80 border-emerald-400/70 text-emerald-100 shadow-md'
                            : isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                            : 'bg-slate-900/80 border-slate-700 hover:border-teal-400 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center text-sm font-black text-amber-300">
                            {st.runeSymbol}
                          </span>
                          <span className="text-[11px] font-bold">
                            {isUnlocked ? (
                              <span className="text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đã mở
                              </span>
                            ) : (
                              <span className="text-amber-300">+{st.points}đ</span>
                            )}
                          </span>
                        </div>
                        <div className="mt-2 text-xs font-extrabold truncate">
                          Trạm #{idx + 1}
                        </div>
                        <div className="mt-1 text-xs font-mono font-black truncate">
                          {isUnlocked ? (
                            <span className="text-amber-300">Manh mối: {st.clueToken}</span>
                          ) : (
                            <span className="text-slate-400">Đang khóa [ ? ]</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ANIMATED TREASURE CHEST & MECHANICAL SHACKLE LOCK SVG */}
              <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-950/65 border border-slate-800 rounded-2xl p-4">
                {/* Left 5 Cols: Animated SVG Vault Door & Treasure Chest */}
                <div className="md:col-span-5 flex flex-col items-center justify-center">
                  <svg
                    viewBox="0 0 280 210"
                    className="w-full max-w-[260px] h-auto drop-shadow-xl"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <radialGradient id="chestGlowB04" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FACC15" stopOpacity="0.65" />
                        <stop offset="65%" stopColor="#14B8A6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#09152B" stopOpacity="0" />
                      </radialGradient>
                      <linearGradient id="goldTrimB04" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FEF08A" />
                        <stop offset="50%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#B45309" />
                      </linearGradient>
                      <linearGradient id="woodChestB04" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#78350F" />
                        <stop offset="100%" stopColor="#451A03" />
                      </linearGradient>
                    </defs>

                    {/* Background Aura */}
                    <circle cx="140" cy="115" r="95" fill="url(#chestGlowB04)" />

                    {/* Ancient Stone Archway */}
                    <path
                      d="M36 190 V80 C36 28 244 28 244 80 V190"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />

                    {/* Golden Light Burst When Unlocked */}
                    {(stageState === 'UNLOCKING' || stageState === 'COMPLETED') && (
                      <g>
                        <polygon
                          points="140,110 65,25 105,20"
                          fill="#FEF08A"
                          fillOpacity="0.45"
                        />
                        <polygon
                          points="140,110 130,15 155,15"
                          fill="#FDE047"
                          fillOpacity="0.6"
                        />
                        <polygon
                          points="140,110 180,20 215,28"
                          fill="#FEF08A"
                          fillOpacity="0.45"
                        />
                      </g>
                    )}

                    {/* Chest Lid (Translates up when unlocked) */}
                    <g
                      style={{
                        transform:
                          stageState === 'UNLOCKING' || stageState === 'COMPLETED'
                            ? 'translateY(-26px)'
                            : 'translateY(0px)',
                        transition: reduceMotion ? 'none' : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      <path
                        d="M58 98 C58 56 222 56 222 98 Z"
                        fill="url(#woodChestB04)"
                        stroke="url(#goldTrimB04)"
                        strokeWidth="5"
                      />
                      <rect x="92" y="66" width="14" height="32" fill="url(#goldTrimB04)" />
                      <rect x="174" y="66" width="14" height="32" fill="url(#goldTrimB04)" />
                    </g>

                    {/* Sparkling Knowledge Gems Inside Chest (Visible when opened) */}
                    {(stageState === 'UNLOCKING' || stageState === 'COMPLETED') && (
                      <g transform="translate(80, 76)">
                        <circle cx="25" cy="16" r="10" fill="#FACC15" />
                        <circle cx="48" cy="12" r="12" fill="#38BDF8" />
                        <circle cx="72" cy="14" r="11" fill="#F43F5E" />
                        <circle cx="95" cy="16" r="10" fill="#34D399" />
                        <text
                          x="60"
                          y="5"
                          textAnchor="middle"
                          fill="#FEF08A"
                          fontSize="12"
                          fontWeight="900"
                        >
                          ★ KHO BÁU MỞ ★
                        </text>
                      </g>
                    )}

                    {/* Chest Base Body */}
                    <rect
                      x="58"
                      y="98"
                      width="164"
                      height="82"
                      rx="10"
                      fill="url(#woodChestB04)"
                      stroke="url(#goldTrimB04)"
                      strokeWidth="5"
                    />
                    <rect x="92" y="98" width="14" height="82" fill="url(#goldTrimB04)" />
                    <rect x="174" y="98" width="14" height="82" fill="url(#goldTrimB04)" />

                    {/* Center Padlock Shackle & Body */}
                    <g
                      transform={
                        stageState === 'UNLOCKING' || stageState === 'COMPLETED'
                          ? 'translate(140, 114)'
                          : 'translate(140, 124)'
                      }
                    >
                      {/* Shackle Arch */}
                      <path
                        d={
                          stageState === 'UNLOCKING' || stageState === 'COMPLETED'
                            ? 'M-14 -14 V-30 C-14 -42 14 -42 14 -30 V-22'
                            : 'M-14 -10 V-22 C-14 -34 14 -34 14 -22 V-10'
                        }
                        fill="none"
                        stroke="#FEF08A"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      {/* Padlock Shield */}
                      <rect
                        x="-24"
                        y="-12"
                        width="48"
                        height="40"
                        rx="8"
                        fill={
                          stageState === 'COMPLETED'
                            ? '#10B981'
                            : lockCheckFeedback.status === 'WRONG'
                            ? '#EF4444'
                            : '#0F172A'
                        }
                        stroke="url(#goldTrimB04)"
                        strokeWidth="3.5"
                      />
                      <circle cx="0" cy="4" r="5" fill="#FACC15" />
                      <path d="M-3 6 L-5 18 H5 L3 6 Z" fill="#FACC15" />
                    </g>
                  </svg>

                  <div className="text-center mt-1">
                    <span className="text-xs font-extrabold text-amber-300">
                      {stageState === 'COMPLETED'
                        ? 'Rương kho báu đã mở thành công!'
                        : `Ổ khóa ${activeSet.codeLength} vòng quay · Lượt thử: ${codeAttemptsUsed}/${maxCodeAttempts}`}
                    </span>
                  </div>
                </div>

                {/* Right 7 Cols: Interactive Rotary Combination Lock Dials */}
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      {stageState === 'COMPLETED' ? (
                        <Unlock className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Lock className="w-4 h-4 text-amber-400" />
                      )}
                      BƯỚC 2: Xoay vòng khóa hoặc nhập mật mã ({activeSet.codeLength} ký tự)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {isTargetNumericOnly ? 'Chế độ vòng số (0–9)' : 'Chế độ chữ & số (A–Z)'}
                    </span>
                  </div>

                  {/* Rotary Dials Row */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 bg-slate-900/95 border-2 border-amber-500/40 rounded-2xl p-4 shadow-inner">
                    {dialValues.map((val, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 mb-1">
                          VÒNG #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRotateDial(idx, 1)}
                          disabled={stageState === 'COMPLETED'}
                          aria-label={`Tăng vòng khóa ${idx + 1}`}
                          className="w-12 h-7 rounded-t-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-amber-300 transition-colors disabled:opacity-40"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <div
                          className={`w-12 h-14 border-x-2 flex items-center justify-center text-2xl font-mono font-black select-none ${
                            stageState === 'COMPLETED'
                              ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                              : lockCheckFeedback.status === 'WRONG'
                              ? 'bg-rose-950 border-rose-400 text-rose-200'
                              : 'bg-slate-950 border-amber-400 text-amber-300'
                          }`}
                        >
                          {val}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRotateDial(idx, -1)}
                          disabled={stageState === 'COMPLETED'}
                          aria-label={`Giảm vòng khóa ${idx + 1}`}
                          className="w-12 h-7 rounded-b-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-amber-300 transition-colors disabled:opacity-40"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Fast Keyboard Entry & Unlock Trigger */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      maxLength={activeSet.codeLength}
                      value={dialValues.join('')}
                      onChange={(e) => handleDirectCodeInput(e.target.value)}
                      disabled={stageState === 'COMPLETED'}
                      placeholder={`Nhập nhanh ${activeSet.codeLength} ký tự...`}
                      className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm font-mono font-black tracking-widest text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyLockCode}
                      disabled={stageState === 'COMPLETED' || stageState === 'UNLOCKING'}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4" />
                      Kiểm tra & Mở khóa (+{pointsPerCrack}đ)
                    </button>
                  </div>

                  {/* Lock Feedback Banner */}
                  {lockCheckFeedback.message && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                        lockCheckFeedback.status === 'UNLOCKED'
                          ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                          : lockCheckFeedback.status === 'WRONG'
                          ? 'bg-rose-950/90 border-rose-400 text-rose-200'
                          : 'bg-sky-950/90 border-sky-400 text-sky-200'
                      }`}
                    >
                      {lockCheckFeedback.status === 'UNLOCKED' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span>{lockCheckFeedback.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BOTTOM STAGE: COLLECTED CLUE PARCHMENTS & SPY DECODER TOOL */}
            <div className="relative z-10 space-y-3">
              {/* Collected Clues Strip */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    Bảng thu thập mảnh manh mối ({unlockedStationIds.length}/{activeSet.stations.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleUnlockNextHint}
                    disabled={unlockedHintsCount >= activeSet.hints.length}
                    className="text-xs font-bold text-teal-300 hover:text-teal-200 disabled:opacity-40 flex items-center gap-1"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    Mở gợi ý ({unlockedHintsCount}/{activeSet.hints.length})
                    {hintPenalty > 0 ? ` [-${hintPenalty}đ]` : ''}
                  </button>
                </div>

                {unlockedStationIds.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Chưa có mảnh mật mã nào được mở. Hãy chọn một Trạm thử thách phía trên và trả lời đúng câu hỏi!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeSet.stations
                      .filter((s) => unlockedStationIds.includes(s.id))
                      .map((s) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/40 text-xs flex items-start gap-2"
                        >
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-black shrink-0">
                            {s.clueToken}
                          </span>
                          <span className="text-amber-100 leading-snug">{s.clueDescription}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Unlocked Hints List */}
                {unlockedHintsCount > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1">
                    {activeSet.hints.slice(0, unlockedHintsCount).map((h, i) => (
                      <div key={i} className="text-xs text-teal-200 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SPY CIPHER INTERACTIVE REFERENCE TOOL (Visible in SPY_CIPHER mode or A1Z26/CAESAR sets) */}
              {(playMode === 'SPY_CIPHER' ||
                activeSet.codeStyle === 'A1Z26' ||
                activeSet.codeStyle === 'CAESAR') && (
                <div className="bg-slate-950/90 border border-teal-500/40 rounded-xl p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-teal-300">
                      Công cụ tra cứu Điệp viên (Bảng 26 chữ cái chuẩn hóa A–Z · Quy ước Đ → D, bỏ dấu thanh)
                    </span>
                    {activeSet.codeStyle === 'CAESAR' && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-300">Bước dịch Caesar:</span>
                        <input
                          type="number"
                          min={1}
                          max={25}
                          value={caesarInspectorShift}
                          onChange={(e) => setCaesarInspectorShift(Number(e.target.value) || 3)}
                          className="w-14 rounded bg-slate-800 border border-slate-600 px-2 py-0.5 text-center font-mono font-bold text-amber-300"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-13 gap-1 text-center font-mono text-[11px]">
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, idx) => {
                      const shiftedChar = String.fromCharCode(
                        ((idx + caesarInspectorShift) % 26) + 65
                      );
                      return (
                        <div
                          key={letter}
                          className="rounded bg-slate-900 border border-slate-800 py-1 px-0.5"
                        >
                          <div className="font-black text-amber-300">{letter}</div>
                          <div className="text-[10px] text-teal-300">
                            {activeSet.codeStyle === 'CAESAR' ? `→${shiftedChar}` : idx + 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VICTORY & STEP-BY-STEP SOLUTION PANEL */}
              {stageState === 'COMPLETED' && (
                <div className="bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border-2 border-amber-400 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
                      <Trophy className="w-5 h-5" />
                      CHÚC MỪNG GIẢI MÃ KHO BÁU THÀNH CÔNG: {activeSet.originalDisplayAnswer}
                    </div>
                    <span className="text-xs font-bold text-emerald-300">
                      Đã lưu lịch sử phiên chơi
                    </span>
                  </div>
                  <div className="text-xs text-slate-100 whitespace-pre-line bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="font-bold text-amber-300 mb-1">Lời giải chi tiết từng bước:</div>
                    {activeSet.stepByStepSolution}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 4 COLUMNS (~33%): ACTIVE QUESTION CHALLENGE, SCOREBOARD & CONTROLS */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* QUESTION & CHALLENGE CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex-1 flex flex-col justify-between">
              {activeStation ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-bold text-blue-600">
                        {activeStation.runeSymbol} {activeStation.title}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Mức độ: {activeStation.difficulty} · Thưởng +{activeStation.points}đ
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-xs font-mono font-black text-amber-800 tabular-nums">
                      {questionTimerSec}s
                    </div>
                  </div>

                  {/* Optional Student Picker for Individual Participation */}
                  <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                    <div className="truncate">
                      <span className="text-slate-500">Học sinh trả lời: </span>
                      <span className="font-bold text-slate-900">
                        {calledStudent ? `${calledStudent.fullName} (${calledStudent.code})` : 'Cả lớp / Đội đang tới lượt'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={pickRandomStudentForStation}
                      className="text-blue-600 hover:underline font-bold shrink-0 ml-2"
                    >
                      Gọi ngẫu nhiên
                    </button>
                  </div>

                  {/* Question Text */}
                  <div className="p-3.5 rounded-xl bg-slate-900 text-white text-sm font-bold leading-relaxed">
                    {activeStation.questionText}
                  </div>

                  {/* Answer Input / Options */}
                  {activeStation.options && activeStation.options.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {activeStation.options.map((opt, i) => {
                        const isChosen = selectedAnswerInput === opt;
                        const optLetter = String.fromCharCode(65 + i);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSelectedAnswerInput(opt);
                              setStageState('ANSWERING');
                            }}
                            className={`p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2.5 ${
                              isChosen
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : 'bg-slate-50 border-slate-200 hover:border-blue-400 text-slate-800'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                isChosen ? 'bg-white text-blue-700' : 'bg-white border border-slate-300 text-slate-700'
                              }`}
                            >
                              {optLetter}
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nhập câu trả lời của học sinh:
                      </label>
                      <input
                        type="text"
                        value={selectedAnswerInput}
                        onChange={(e) => {
                          setSelectedAnswerInput(e.target.value);
                          setStageState('ANSWERING');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSubmitStationAnswer();
                        }}
                        placeholder="Nhập đáp án..."
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmitStationAnswer}
                    disabled={!selectedAnswerInput.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black text-xs shadow-sm transition-all"
                  >
                    Chấm đáp án & Mở mảnh mật mã
                  </button>

                  {stationFeedback && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                        stationFeedback.isCorrect
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="font-black flex items-center gap-1.5">
                        {stationFeedback.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{stationFeedback.message}</span>
                      </div>
                      {stationFeedback.isCorrect && activeStation.explanation && (
                        <p className="text-slate-600 mt-1">{activeStation.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="my-auto text-center py-8 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto font-black">
                    <Compass className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">
                    Chưa chọn trạm thử thách
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hãy nhấn vào một trong các <strong>Trạm thử thách (#1 – #{activeSet.stations.length})</strong> trên sân khấu bên trái để mở câu hỏi và thu thập manh mối mật mã.
                  </p>
                </div>
              )}
            </div>

            {/* SCOREBOARD & TEAM ARENA CONTROLS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  {playMode === 'TEAM_ARENA' ? 'Bảng Xếp Hạng Đội Giải Mã' : 'Bảng Điểm & Lịch Sử Chấm'}
                </h4>
                {scoreHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoLastScore}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                    title="Hoàn tác thao tác chấm điểm gần nhất"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Hoàn tác
                  </button>
                )}
              </div>

              {playMode === 'TEAM_ARENA' ? (
                <div className="space-y-3">
                  {/* Team Count & Code Assignment Mode */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700">Số đội:</span>
                      {[2, 3, 4].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTeamCount(cnt)}
                          className={`px-2 py-0.5 rounded font-bold ${
                            teamCount === cnt
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          {cnt} đội
                        </button>
                      ))}
                    </div>

                    <select
                      value={teamCodePolicy}
                      onChange={(e) =>
                        setTeamCodePolicy(e.target.value as 'SHARED_CODE' | 'TEAM_SPECIFIC_CODE')
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800"
                    >
                      <option value="SHARED_CODE">Mật mã chung cho các đội</option>
                      <option value="TEAM_SPECIFIC_CODE">Mỗi đội 1 bộ mã riêng</option>
                    </select>
                  </div>

                  {teamCodePolicy === 'TEAM_SPECIFIC_CODE' && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                      Lưu ý: Khi chọn mỗi đội một bộ mã riêng, Giáo viên vui lòng kiểm tra trước độ khó của từng bộ mã để đảm bảo công bằng giữa các đội.
                    </div>
                  )}

                  {/* Teams List */}
                  <div className="space-y-2">
                    {teams.map((t, idx) => {
                      const isTurn = idx === activeTeamIndex;
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setActiveTeamIndex(idx);
                            if (teamCodePolicy === 'TEAM_SPECIFIC_CODE' && t.assignedSetId) {
                              setSelectedSetId(t.assignedSetId);
                            }
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isTurn
                              ? 'bg-purple-50 border-purple-500 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: t.colorHex }}
                            />
                            <div className="truncate">
                              <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                <span>{t.name}</span>
                                {isTurn && (
                                  <span className="text-[10px] font-bold text-purple-700">
                                    · Đang tới lượt
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {t.unlockedStationIds.length} mảnh mã · {t.correctAnswersCount} câu đúng · {t.members.length} HS
                              </div>
                            </div>
                          </div>
                          <div className="text-base font-mono font-black text-slate-900 tabular-nums shrink-0">
                            {t.score}đ
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <div className="text-xs font-bold text-slate-600">Tổng điểm giải mã hiện tại</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Đúng câu hỏi: +{pointsPerCorrect}đ · Mở khóa rương: +{pointsPerCrack}đ
                    </div>
                  </div>
                  <div className="text-2xl font-mono font-black text-blue-600 tabular-nums">
                    {individualScore}đ
                  </div>
                </div>
              )}

              {/* Recent Score Audit Log */}
              {scoreHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1 max-h-28 overflow-y-auto">
                  <div className="text-[11px] font-bold text-slate-500">Nhật ký chấm điểm (có hỗ trợ Hoàn tác):</div>
                  {scoreHistory.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="text-[11px] text-slate-600 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        [{item.timestamp}] {item.description}
                      </span>
                      <span
                        className={`font-mono font-bold shrink-0 ${
                          item.deltaScore >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {item.deltaScore >= 0 ? `+${item.deltaScore}đ` : `${item.deltaScore}đ`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
