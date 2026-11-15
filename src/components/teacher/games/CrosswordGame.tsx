import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question, Grade } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Grid,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Trophy,
  BookOpen,
  Settings,
  Eye,
  Sparkles,
  Lightbulb,
  Undo2,
  SkipForward,
  Send,
  Plus,
  Copy,
  Archive,
  Edit3,
  RefreshCw,
  HelpCircle,
  Wand2,
  Key,
} from 'lucide-react';

export type CrosswordGameState =
  | 'SETUP'
  | 'READY'
  | 'ROW_SELECTED'
  | 'QUESTION_DISPLAYED'
  | 'ANSWERING'
  | 'CHECKING'
  | 'REVEALING'
  | 'NEXT_TURN'
  | 'KEYWORD_GUESS'
  | 'FINISHED';

export type CrosswordPlayMode = 'TRADITIONAL' | 'SMART_BUILDER' | 'TEAM_ARENA';

export interface CrosswordRowItem {
  id: string;
  rowIndex: number; // 0 .. M-1
  clue: string;
  originalAnswer: string; // e.g. "ĐỒNG BẰNG"
  intersectIndex: number; // 0-based index in stripped word that intersects vertical keyword
  points: number;
  timeLimitSec: number;
  explanation: string;
}

export interface CrosswordPuzzleSet {
  id: string;
  title: string;
  subject: string;
  grade: Grade;
  chapter: string;
  lesson: string;
  originalKeyword: string; // e.g. "TÂY ĐÔ"
  rows: CrosswordRowItem[];
  status: 'draft' | 'approved' | 'archived';
  authorId: string;
  updatedAt: string;
}

export interface CrosswordTeam {
  id: string;
  name: string;
  colorHex: string;
  members: StudentCandidate[];
  score: number;
  rowsSolved: number;
  keywordGuesses: number;
}

export interface CrosswordGameProps {
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

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Toán học',
  literature: 'Ngữ văn',
  english: 'Tiếng Anh',
  science: 'Khoa học tự nhiên',
  history_geo: 'Lịch sử & Địa lí',
  informatics: 'Tin học',
  technology: 'Công nghệ',
  civics: 'Giáo dục công dân',
  other: 'Môn khác',
};

const TEAM_COLORS = ['#006BFF', '#D97706', '#E11D48', '#7C3AED'];

/**
 * Convert any Vietnamese character to its uppercase ASCII base (properly mapping Đ/đ -> D).
 */
export function toCrosswordAsciiChar(ch: string): string {
  return ch
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}

/**
 * Strip spaces and punctuation from a Vietnamese word/phrase, returning an array of characters:
 * - withDiacritics = false -> ["D", "O", "N", "G", "B", "A", "N", "G"]
 * - withDiacritics = true  -> ["Đ", "Ồ", "N", "G", "B", "Ằ", "N", "G"]
 */
export function extractCrosswordLetters(raw: string, withDiacritics: boolean): string[] {
  const cleaned = raw
    .trim()
    .replace(/[\s\-_.,;:'"?!()[\]{}/\\]+/g, '')
    .toUpperCase();
  const chars = Array.from(cleaned);
  if (!withDiacritics) {
    return chars.map((c) => toCrosswordAsciiChar(c)).filter((c) => /^[A-Z0-9]$/.test(c));
  }
  return chars.filter((c) => /^[A-Z0-9]$/.test(toCrosswordAsciiChar(c)));
}

/**
 * Validate a crossword puzzle set to guarantee:
 * 1. Keyword length matches number of rows.
 * 2. Every row has a valid intersectIndex inside [0, wordLength - 1].
 * 3. The ASCII letter at row.intersectIndex equals the corresponding keyword ASCII letter.
 */
export function validateCrosswordPuzzle(puzzle: CrosswordPuzzleSet): {
  isValid: boolean;
  errors: string[];
  maxLeftOffset: number;
  maxRightOffset: number;
  totalCols: number;
} {
  const errors: string[] = [];
  const keywordAscii = extractCrosswordLetters(puzzle.originalKeyword, false);

  if (keywordAscii.length < 2) {
    errors.push('Từ khóa hàng dọc phải có ít nhất 2 chữ cái.');
  }

  if (puzzle.rows.length !== keywordAscii.length) {
    errors.push(
      `Số lượng hàng ngang (${puzzle.rows.length}) phải bằng độ dài từ khóa "${keywordAscii.join(
        ''
      )}" (${keywordAscii.length} ký tự).`
    );
  }

  let maxLeftOffset = 0;
  let maxRightOffset = 0;

  puzzle.rows.forEach((row, idx) => {
    const rowAscii = extractCrosswordLetters(row.originalAnswer, false);
    const expectedChar = keywordAscii[idx];
    if (rowAscii.length < 2) {
      errors.push(`Hàng ngang #${idx + 1} có đáp án quá ngắn.`);
      return;
    }
    if (!row.clue.trim()) {
      errors.push(`Hàng ngang #${idx + 1} chưa có câu hỏi gợi ý.`);
    }
    if (row.intersectIndex < 0 || row.intersectIndex >= rowAscii.length) {
      errors.push(
        `Hàng ngang #${idx + 1} ("${row.originalAnswer}") có vị trí giao vượt ngoài độ dài từ.`
      );
      return;
    }
    const actualChar = rowAscii[row.intersectIndex];
    if (actualChar !== expectedChar) {
      errors.push(
        `Hàng ngang #${idx + 1} ("${row.originalAnswer}") tại vị trí giao #${
          row.intersectIndex + 1
        } là chữ "${actualChar}", không khớp chữ "${expectedChar}" của từ khóa.`
      );
    }

    const leftCount = row.intersectIndex;
    const rightCount = rowAscii.length - 1 - row.intersectIndex;
    if (leftCount > maxLeftOffset) maxLeftOffset = leftCount;
    if (rightCount > maxRightOffset) maxRightOffset = rightCount;
  });

  return {
    isValid: errors.length === 0,
    errors,
    maxLeftOffset,
    maxRightOffset,
    totalCols: maxLeftOffset + 1 + maxRightOffset,
  };
}

const BUILTIN_CROSSWORD_PUZZLES: CrosswordPuzzleSet[] = [
  {
    id: 'cw_informatics_maytinh',
    title: 'Khám phá Thế giới Máy tính & Tin học',
    subject: 'informatics',
    grade: '8',
    chapter: 'Máy tính và cộng đồng',
    lesson: 'Cấu trúc và hoạt động của máy tính',
    originalKeyword: 'MÁY TÍNH',
    status: 'approved',
    authorId: 'system',
    updatedAt: '2026-11-14T08:00:00Z',
    rows: [
      {
        id: 'r1',
        rowIndex: 0,
        clue: 'Hệ thống các chương trình giúp điều khiển và khai thác phần cứng máy tính gọi là gì?',
        originalAnswer: 'PHẦN MỀM',
        intersectIndex: 4, // P-H-A-N-[M]-E-M
        points: 10,
        timeLimitSec: 30,
        explanation: 'Phần mềm (Software) là tập hợp các chương trình chạy trên máy tính.',
      },
      {
        id: 'r2',
        rowIndex: 1,
        clue: 'Thiết bị ngoại vi gồm các phím bấm dùng để nhập ký tự và số vào máy tính?',
        originalAnswer: 'BÀN PHÍM',
        intersectIndex: 1, // B-[A]-N-P-H-I-M
        points: 10,
        timeLimitSec: 30,
        explanation: 'Bàn phím (Keyboard) là thiết bị nhập dữ liệu cơ bản.',
      },
      {
        id: 'r3',
        rowIndex: 2,
        clue: 'Hành động kết nối vào mạng hoặc mở một trang web để tìm kiếm dữ liệu gọi là gì?',
        originalAnswer: 'TRUY CẬP',
        intersectIndex: 3, // T-R-U-[Y]-C-A-P
        points: 10,
        timeLimitSec: 30,
        explanation: 'Truy cập mạng/trang web để khai thác tài nguyên số.',
      },
      {
        id: 'r4',
        rowIndex: 3,
        clue: 'Hệ thống mạng máy tính toàn cầu kết nối hàng tỷ thiết bị trên thế giới?',
        originalAnswer: 'INTERNET',
        intersectIndex: 2, // I-N-[T]-E-R-N-E-T
        points: 10,
        timeLimitSec: 30,
        explanation: 'Internet là mạng liên kết toàn cầu dùng giao thức TCP/IP.',
      },
      {
        id: 'r5',
        rowIndex: 4,
        clue: 'Những hiểu biết có được về một sự vật, sự việc sau khi xử lý dữ liệu gọi là gì?',
        originalAnswer: 'THÔNG TIN',
        intersectIndex: 6, // T-H-O-N-G-T-[I]-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'Thông tin là ý nghĩa rút ra từ dữ liệu.',
      },
      {
        id: 'r6',
        rowIndex: 5,
        clue: 'Mạng máy tính cục bộ kết nối các máy tính trong phạm vi hẹp (phòng máy, trường học)?',
        originalAnswer: 'MẠNG LAN',
        intersectIndex: 2, // M-A-[N]-G-L-A-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'LAN (Local Area Network) là mạng máy tính cục bộ.',
      },
      {
        id: 'r7',
        rowIndex: 6,
        clue: 'Dãy hữu hạn các bước rõ ràng để giải quyết một bài toán trên máy tính gọi là gì?',
        originalAnswer: 'THUẬT TOÁN',
        intersectIndex: 1, // T-[H]-U-A-T-T-O-A-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'Thuật toán (Algorithm) là cơ sở để viết chương trình máy tính.',
      },
    ],
  },
  {
    id: 'cw_science_nguyentu',
    title: 'Cấu tạo Chất & Nguyên tử',
    subject: 'science',
    grade: '8',
    chapter: 'Chất và sự biến đổi của chất',
    lesson: 'Nguyên tử và Nguyên tố hóa học',
    originalKeyword: 'NGUYÊN TỬ',
    status: 'approved',
    authorId: 'system',
    updatedAt: '2026-11-14T08:00:00Z',
    rows: [
      {
        id: 's1',
        rowIndex: 0,
        clue: 'Hạt đại diện cho chất, gồm một số nguyên tử liên kết với nhau và thể hiện đầy đủ tính chất hóa học của chất?',
        originalAnswer: 'PHÂN TỬ',
        intersectIndex: 3, // P-H-A-[N]-T-U
        points: 10,
        timeLimitSec: 30,
        explanation: 'Phân tử là hạt đại diện cho chất.',
      },
      {
        id: 's2',
        rowIndex: 1,
        clue: 'Nguyên tố khí duy trì sự hô hấp và sự cháy trên Trái Đất (tên danh pháp quốc tế)?',
        originalAnswer: 'OXYGEN',
        intersectIndex: 3, // O-X-Y-[G]-E-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'Khí Oxygen (O₂) cần thiết cho sự hô hấp.',
      },
      {
        id: 's3',
        rowIndex: 2,
        clue: 'Hỗn hợp đồng nhất của chất tan và dung môi được gọi là gì?',
        originalAnswer: 'DUNG DỊCH',
        intersectIndex: 1, // D-[U]-N-G-D-I-C-H
        points: 10,
        timeLimitSec: 30,
        explanation: 'Dung dịch là hỗn hợp đồng nhất của dung môi và chất tan.',
      },
      {
        id: 's4',
        rowIndex: 3,
        clue: 'Nguyên tố hóa học nhẹ nhất, đứng ở ô số 1 trong bảng tuần hoàn?',
        originalAnswer: 'HYDROGEN',
        intersectIndex: 1, // H-[Y]-D-R-O-G-E-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'Hydrogen (H) nằm ở ô số 1 trong bảng tuần hoàn.',
      },
      {
        id: 's5',
        rowIndex: 4,
        clue: 'Hạt mang điện tích âm chuyển động xung quanh hạt nhân nguyên tử?',
        originalAnswer: 'ELECTRON',
        intersectIndex: 0, // [E]-L-E-C-T-R-O-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'Electron mang điện tích âm (-1) tạo nên lớp vỏ nguyên tử.',
      },
      {
        id: 's6',
        rowIndex: 5,
        clue: 'Hạt không mang điện nằm trong hạt nhân nguyên tử (cùng với proton)?',
        originalAnswer: 'NEUTRON',
        intersectIndex: 0, // [N]-E-U-T-R-O-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'Neutron không mang điện trong hạt nhân nguyên tử.',
      },
      {
        id: 's7',
        rowIndex: 6,
        clue: 'Phần trung tâm mang điện tích dương tập trung hầu hết khối lượng của nguyên tử?',
        originalAnswer: 'HẠT NHÂN',
        intersectIndex: 2, // H-A-[T]-N-H-A-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'Hạt nhân nằm ở tâm nguyên tử, gồm các hạt proton và neutron.',
      },
      {
        id: 's8',
        rowIndex: 7,
        clue: 'Bảng sắp xếp các nguyên tố hóa học theo chiều tăng dần điện tích hạt nhân của Mendeleev là bảng gì?',
        originalAnswer: 'TUẦN HOÀN',
        intersectIndex: 1, // T-[U]-A-N-H-O-A-N
        points: 10,
        timeLimitSec: 30,
        explanation: 'Bảng tuần hoàn các nguyên tố hóa học.',
      },
    ],
  },
  {
    id: 'cw_geo_taydo',
    title: 'Vùng đất Tây Đô & Đồng bằng sông Cửu Long',
    subject: 'history_geo',
    grade: '8',
    chapter: 'Vùng Đồng bằng sông Cửu Long',
    lesson: 'Thiên nhiên và văn hóa Tây Đô',
    originalKeyword: 'TÂY ĐÔ',
    status: 'approved',
    authorId: 'system',
    updatedAt: '2026-11-14T08:00:00Z',
    rows: [
      {
        id: 'g1',
        rowIndex: 0,
        clue: 'Thành phố trực thuộc Trung ương nằm ở trung tâm vùng Đồng bằng sông Cửu Long?',
        originalAnswer: 'CẦN THƠ',
        intersectIndex: 3, // C-A-N-[T]-H-O
        points: 10,
        timeLimitSec: 30,
        explanation: 'TP. Cần Thơ được mệnh danh là thủ phủ Tây Đô.',
      },
      {
        id: 'g2',
        rowIndex: 1,
        clue: 'Chợ nổi nổi tiếng bậc nhất tại TP. Cần Thơ được công nhận là Di sản văn hóa phi vật thể quốc gia?',
        originalAnswer: 'CÁI RĂNG',
        intersectIndex: 1, // C-[A]-I-R-A-N-G
        points: 10,
        timeLimitSec: 30,
        explanation: 'Chợ nổi Cái Răng là nét văn hóa sông nước đặc sắc của Cần Thơ.',
      },
      {
        id: 'g3',
        rowIndex: 2,
        clue: 'Tên gọi thân thương mà người dân cả nước dành cho vùng đất 13 tỉnh thành Đồng bằng sông Cửu Long?',
        originalAnswer: 'MIỀN TÂY',
        intersectIndex: 6, // M-I-E-N-T-A-[Y]
        points: 10,
        timeLimitSec: 30,
        explanation: 'Vùng Tây Nam Bộ thường được gọi thân mật là Miền Tây.',
      },
      {
        id: 'g4',
        rowIndex: 3,
        clue: 'Dạng địa hình bằng phẳng do phù sa sông bồi đắp thuận lợi cho trồng lúa nước?',
        originalAnswer: 'ĐỒNG BẰNG',
        intersectIndex: 0, // [D]-O-N-G-B-A-N-G
        points: 10,
        timeLimitSec: 30,
        explanation: 'Đồng bằng sông Cửu Long là đồng bằng châu thổ lớn nhất nước ta.',
      },
      {
        id: 'g5',
        rowIndex: 4,
        clue: 'Nhánh sông lớn chảy qua địa phận thành phố Cần Thơ trước khi đổ ra biển Đông?',
        originalAnswer: 'SÔNG HẬU',
        intersectIndex: 1, // S-[O]-N-G-H-A-U
        points: 10,
        timeLimitSec: 30,
        explanation: 'Sông Hậu (Hậu Giang) chảy qua trung tâm TP. Cần Thơ.',
      },
    ],
  },
  {
    id: 'cw_math_tamgiac',
    title: 'Hình học phẳng & Các tính chất cơ bản',
    subject: 'math',
    grade: '8',
    chapter: 'Định lý Thalès & Hình đồng dạng',
    lesson: 'Ôn tập Hình học phẳng',
    originalKeyword: 'TAM GIÁC',
    status: 'approved',
    authorId: 'system',
    updatedAt: '2026-11-14T08:00:00Z',
    rows: [
      {
        id: 'm1',
        rowIndex: 0,
        clue: 'Hình cơ bản không bị giới hạn về hai phía và đi qua hai điểm phân biệt?',
        originalAnswer: 'ĐƯỜNG THẲNG',
        intersectIndex: 5, // D-U-O-N-G-[T]-H-A-N-G
        points: 10,
        timeLimitSec: 30,
        explanation: 'Qua hai điểm phân biệt có một và chỉ một đường thẳng.',
      },
      {
        id: 'm2',
        rowIndex: 1,
        clue: 'Hình khép kín tạo bởi các đoạn thẳng nối tiếp nhau (như tứ giác, ngũ giác, lục giác) gọi chung là gì?',
        originalAnswer: 'ĐA GIÁC',
        intersectIndex: 1, // D-[A]-G-I-A-C
        points: 10,
        timeLimitSec: 30,
        explanation: 'Đa giác là hình gồm nhiều cạnh thẳng khép kín.',
      },
      {
        id: 'm3',
        rowIndex: 2,
        clue: 'Điểm nằm giữa và chia đoạn thẳng thành hai phần có độ dài bằng nhau gọi là gì?',
        originalAnswer: 'TRUNG ĐIỂM',
        intersectIndex: 8, // T-R-U-N-G-D-I-E-[M]
        points: 10,
        timeLimitSec: 30,
        explanation: 'Trung điểm cách đều hai đầu mút của đoạn thẳng.',
      },
      {
        id: 'm4',
        rowIndex: 3,
        clue: 'Góc có số đo bằng 90 độ được gọi là góc gì?',
        originalAnswer: 'GÓC VUÔNG',
        intersectIndex: 0, // [G]-O-C-V-U-O-N-G
        points: 10,
        timeLimitSec: 30,
        explanation: 'Góc vuông có số đo 90°.',
      },
      {
        id: 'm5',
        rowIndex: 4,
        clue: 'Đại lượng đặc trưng cho độ lớn bề mặt của một hình phẳng gọi là gì?',
        originalAnswer: 'DIỆN TÍCH',
        intersectIndex: 1, // D-[I]-E-N-T-I-C-H
        points: 10,
        timeLimitSec: 30,
        explanation: 'Diện tích đo phần mặt phẳng giới hạn bởi hình.',
      },
      {
        id: 'm6',
        rowIndex: 5,
        clue: 'Khoảng cách từ tâm đường tròn đến một điểm bất kỳ trên đường tròn gọi là gì?',
        originalAnswer: 'BÁN KÍNH',
        intersectIndex: 1, // B-[A]-N-K-I-N-H
        points: 10,
        timeLimitSec: 30,
        explanation: 'Bán kính bằng một nửa đường kính đường tròn.',
      },
      {
        id: 'm7',
        rowIndex: 6,
        clue: 'Tổng độ dài tất cả các cạnh bao quanh một hình phẳng gọi là gì?',
        originalAnswer: 'CHU VI',
        intersectIndex: 0, // [C]-H-U-V-I
        points: 10,
        timeLimitSec: 30,
        explanation: 'Chu vi là tổng độ dài đường bao quanh hình.',
      },
    ],
  },
];

class CrosswordSoundEngine {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
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

  public playRowSelect(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  public playRowSolved(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + i * 0.065;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.26);
      });
    } catch {}
  }

  public playWrong(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.setValueAtTime(205, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.34);
    } catch {}
  }

  public playKeywordVictory(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + i * 0.09;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.11, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.42);
      });
    } catch {}
  }
}

export const CrosswordGame: React.FC<CrosswordGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds = new Set(),
  questions = [],
  selectedSourceKey = '',
  resolvedClassName = 'Lớp học',
  teacherId = '',
  userRole = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
}) => {
  // Primary State Machine: SETUP -> READY -> ROW_SELECTED -> QUESTION_DISPLAYED -> ANSWERING -> CHECKING -> REVEALING -> NEXT_TURN -> KEYWORD_GUESS -> FINISHED
  const [gameState, setGameState] = useState<CrosswordGameState>('SETUP');
  const [playMode, setPlayMode] = useState<CrosswordPlayMode>('TRADITIONAL');
  const [showWithDiacritics, setShowWithDiacritics] = useState<boolean>(false); // Default: Ô chữ không dấu (chuẩn tạo lưới), cho phép bật Ô chữ có dấu
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Puzzle Sets Management (Built-in + Teacher Custom Saved Sets)
  const [customPuzzles, setCustomPuzzles] = useState<CrosswordPuzzleSet[]>(() => {
    try {
      const raw = localStorage.getItem(`taydo_b03_puzzles_${teacherId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const allActivePuzzles = useMemo(
    () =>
      [...customPuzzles, ...BUILTIN_CROSSWORD_PUZZLES].filter(
        (p) => p.status !== 'archived'
      ),
    [customPuzzles]
  );

  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string>(
    BUILTIN_CROSSWORD_PUZZLES[0].id
  );
  const [previewGridInSetup, setPreviewGridInSetup] = useState<boolean>(false);

  // Smart Builder / Editor State (Mode 2 & Section IX)
  const [builderGrade, setBuilderGrade] = useState<Grade>('8');
  const [builderSubject, setBuilderSubject] = useState<string>('informatics');
  const [builderChapter, setBuilderChapter] = useState<string>('ALL');
  const [builderLesson, setBuilderLesson] = useState<string>('ALL');
  const [builderTitle, setBuilderTitle] = useState<string>('Bộ Ô Chữ Bài Học Mới');
  const [builderKeyword, setBuilderKeyword] = useState<string>('TRI THỨC');
  const [builderRows, setBuilderRows] = useState<CrosswordRowItem[]>([]);
  const [builderNotice, setBuilderNotice] = useState<string | null>(null);
  const [editingPuzzleId, setEditingPuzzleId] = useState<string | null>(null);

  // Scoring & Team Arena Configuration
  const [teamCount, setTeamCount] = useState<number>(3);
  const [teamNames, setTeamNames] = useState<string[]>([
    'Đội Sao Khuê',
    'Đội Ánh Sáng',
    'Đội Tiên Phong',
    'Đội Bứt Phá',
  ]);
  const [pointsPerRow, setPointsPerRow] = useState<number>(10);
  const [pointsForKeyword, setPointsForKeyword] = useState<number>(30);
  const [penaltyWrongKeyword, setPenaltyWrongKeyword] = useState<number>(0);

  // Runtime Match State
  const [sessionId] = useState<string>(
    () => `B03_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  const [teams, setTeams] = useState<CrosswordTeam[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [solvedRowIndices, setSolvedRowIndices] = useState<Set<number>>(new Set());
  const [hintRevealedIntersectRows, setHintRevealedIntersectRows] = useState<Set<number>>(
    new Set()
  );
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [rowAnswerInput, setRowAnswerInput] = useState<string>('');
  const [keywordGuessInput, setKeywordGuessInput] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [solvedKeywordWinner, setSolvedKeywordWinner] = useState<string | null>(null);

  // Undo Snapshot
  const [undoSnapshot, setUndoSnapshot] = useState<{
    solvedRows: number[];
    teams: CrosswordTeam[];
    currentTurnIndex: number;
  } | null>(null);

  const actionLockRef = useRef<boolean>(false);
  const soundEngineRef = useRef<CrosswordSoundEngine | null>(null);
  if (!soundEngineRef.current) {
    soundEngineRef.current = new CrosswordSoundEngine();
  }

  const activePuzzle = useMemo(
    () =>
      allActivePuzzles.find((p) => p.id === selectedPuzzleId) ||
      BUILTIN_CROSSWORD_PUZZLES[0],
    [allActivePuzzles, selectedPuzzleId]
  );

  const activePuzzleValidation = useMemo(
    () => validateCrosswordPuzzle(activePuzzle),
    [activePuzzle]
  );

  // Present students in the class
  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((s) => !absentIds.has(s.id));
  }, [allCandidates, availableCandidates, absentIds]);

  // Approved Questions from Smart EDU Question Bank for Smart Crossword Builder
  const authorizedQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.status === 'approved') return true;
      if (userRole === 'admin' || userRole === 'reviewer') return true;
      return false;
    });
  }, [questions, userRole]);

  // Countdown timer for active row clue
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          soundEngineRef.current?.playWrong(isMuted);
          setStatusBanner({
            type: 'error',
            text: 'Đã hết thời gian suy nghĩ cho hàng ngang hiện tại!',
          });
          setGameState('CHECKING');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isTimerRunning, isMuted]);

  // Smart Builder: Auto-generate horizontal rows from Smart EDU Question Bank matching the vertical keyword
  const handleGenerateRowsFromBank = useCallback(() => {
    const keywordLetters = extractCrosswordLetters(builderKeyword, false);
    if (keywordLetters.length < 2) {
      setBuilderNotice('Vui lòng nhập từ khóa bí mật có ít nhất 2 chữ cái.');
      return;
    }

    // Filter bank questions matching selected lesson/chapter/subject
    const candidateQuestions = authorizedQuestions.filter((q) => {
      if (builderSubject !== 'ALL' && q.subject !== builderSubject) return false;
      if (builderChapter !== 'ALL' && q.chapter !== builderChapter) return false;
      if (builderLesson !== 'ALL' && q.lesson !== builderLesson) return false;
      return true;
    });

    // Extract usable short keyword answers from bank questions (never use bare 'A','B','C','D')
    const usableBankEntries: Array<{
      qId: string;
      clue: string;
      answerText: string;
      asciiLetters: string[];
      explanation: string;
    }> = [];

    candidateQuestions.forEach((q) => {
      let resolvedAnswerText = '';
      if (q.type === 'single_choice' && q.options && q.correctAnswer) {
        const opt = q.options.find(
          (o) => o.label === q.correctAnswer || o.id === q.correctAnswer
        );
        if (opt) resolvedAnswerText = opt.text.trim();
      } else if (q.type === 'short_answer') {
        resolvedAnswerText = (q.acceptedAnswers?.[0] || q.correctAnswer || '').trim();
      }

      if (!resolvedAnswerText) return;
      const ascii = extractCrosswordLetters(resolvedAnswerText, false);
      // Filter out overly long sentences (> 16 letters) or answers without letters
      if (ascii.length >= 2 && ascii.length <= 16 && /[A-Z]/.test(ascii.join(''))) {
        usableBankEntries.push({
          qId: q.id,
          clue: q.stem,
          answerText: resolvedAnswerText.toUpperCase(),
          asciiLetters: ascii,
          explanation: q.explanation || '',
        });
      }
    });

    const usedQuestionIds = new Set<string>();
    let missingCount = 0;

    const generatedRows: CrosswordRowItem[] = keywordLetters.map((targetChar, rIdx) => {
      const matchedEntry = usableBankEntries.find(
        (entry) =>
          !usedQuestionIds.has(entry.qId) && entry.asciiLetters.includes(targetChar)
      );

      if (matchedEntry) {
        usedQuestionIds.add(matchedEntry.qId);
        const intersectIdx = matchedEntry.asciiLetters.indexOf(targetChar);
        return {
          id: `gen_${Date.now()}_${rIdx}`,
          rowIndex: rIdx,
          clue: matchedEntry.clue,
          originalAnswer: matchedEntry.answerText,
          intersectIndex: intersectIdx,
          points: 10,
          timeLimitSec: 30,
          explanation: matchedEntry.explanation,
        };
      }

      missingCount += 1;
      // Preserve existing edited row if it already matches targetChar
      const existing = builderRows[rIdx];
      if (existing) {
        const existingAscii = extractCrosswordLetters(existing.originalAnswer, false);
        const foundIdx = existingAscii.indexOf(targetChar);
        if (foundIdx >= 0) {
          return { ...existing, rowIndex: rIdx, intersectIndex: foundIdx };
        }
      }

      return {
        id: `manual_${Date.now()}_${rIdx}`,
        rowIndex: rIdx,
        clue: `Nhập câu hỏi gợi ý cho hàng ngang #${rIdx + 1} (chứa chữ "${targetChar}")...`,
        originalAnswer: targetChar,
        intersectIndex: 0,
        points: 10,
        timeLimitSec: 30,
        explanation: '',
      };
    });

    setBuilderRows(generatedRows);
    if (missingCount > 0) {
      setBuilderNotice(
        `Đã tìm thấy ${
          keywordLetters.length - missingCount
        }/${keywordLetters.length} đáp án phù hợp trong Ngân hàng câu hỏi. Còn ${missingCount} hàng ngang chưa có đáp án khớp chữ cái giao, giáo viên vui lòng nhập bổ sung bên dưới.`
      );
    } else {
      setBuilderNotice(
        `Đã tự động ghép thành công đủ ${keywordLetters.length}/${keywordLetters.length} hàng ngang từ Ngân hàng câu hỏi! Giáo viên có thể kiểm tra và chỉnh sửa trước khi duyệt.`
      );
    }
  }, [
    builderKeyword,
    authorizedQuestions,
    builderSubject,
    builderChapter,
    builderLesson,
    builderRows,
  ]);

  // Save Draft or Approve Custom Crossword Set
  const handleSaveBuilderPuzzle = (targetStatus: 'draft' | 'approved') => {
    const candidatePuzzle: CrosswordPuzzleSet = {
      id: editingPuzzleId || `cw_custom_${Date.now()}`,
      title: builderTitle.trim() || 'Bộ ô chữ tự tạo',
      subject: builderSubject,
      grade: builderGrade,
      chapter: builderChapter === 'ALL' ? 'Chủ đề chung' : builderChapter,
      lesson: builderLesson === 'ALL' ? 'Bài học tùy chỉnh' : builderLesson,
      originalKeyword: builderKeyword.trim().toUpperCase(),
      rows: builderRows,
      status: targetStatus,
      authorId: teacherId,
      updatedAt: new Date().toISOString(),
    };

    const check = validateCrosswordPuzzle(candidatePuzzle);
    if (targetStatus === 'approved' && !check.isValid) {
      setBuilderNotice(
        `Chưa thể duyệt bộ ô chữ vì lưới chưa hợp lệ: ${check.errors[0]}`
      );
      return;
    }

    const nextList = [
      candidatePuzzle,
      ...customPuzzles.filter((p) => p.id !== candidatePuzzle.id),
    ];
    setCustomPuzzles(nextList);
    setSelectedPuzzleId(candidatePuzzle.id);
    try {
      localStorage.setItem(`taydo_b03_puzzles_${teacherId}`, JSON.stringify(nextList));
    } catch {}

    setBuilderNotice(
      targetStatus === 'approved'
        ? 'Đã duyệt và lưu bộ ô chữ thành công! Bạn có thể bấm "Bắt đầu chơi" ngay.'
        : 'Đã lưu nháp bộ ô chữ thành công!'
    );
  };

  // Start Crossword Game Session (SETUP -> READY)
  const handleStartGame = () => {
    if (!activePuzzleValidation.isValid) {
      setStatusBanner({
        type: 'error',
        text: `Bộ ô chữ hiện tại có lỗi giao điểm: ${activePuzzleValidation.errors[0]}`,
      });
      return;
    }

    const builtTeams: CrosswordTeam[] = Array.from({ length: teamCount }, (_, i) => ({
      id: `team_${i + 1}`,
      name: teamNames[i]?.trim() || `Đội ${i + 1}`,
      colorHex: TEAM_COLORS[i % TEAM_COLORS.length],
      members: presentStudents.filter((_, sIdx) => sIdx % teamCount === i),
      score: 0,
      rowsSolved: 0,
      keywordGuesses: 0,
    }));

    setTeams(builtTeams);
    setCurrentTurnIndex(0);
    setSolvedRowIndices(new Set());
    setHintRevealedIntersectRows(new Set());
    setActiveRowIndex(null);
    setRowAnswerInput('');
    setKeywordGuessInput('');
    setSolvedKeywordWinner(null);
    setUndoSnapshot(null);
    actionLockRef.current = false;
    setGameState('READY');
    setStatusBanner({
      type: 'info',
      text: `Bắt đầu giải ô chữ "${activePuzzle.title}"! Mời ${
        builtTeams[0]?.name || 'Học sinh'
      } chọn một hàng ngang.`,
    });
  };

  // Select a Horizontal Row (READY -> ROW_SELECTED -> QUESTION_DISPLAYED -> ANSWERING)
  const handleSelectRow = (rowIndex: number) => {
    if (actionLockRef.current) return;
    if (solvedRowIndices.has(rowIndex)) return;
    const row = activePuzzle.rows[rowIndex];
    if (!row) return;

    soundEngineRef.current?.playRowSelect(isMuted);
    setActiveRowIndex(rowIndex);
    setRowAnswerInput('');
    setTimeLeft(row.timeLimitSec || 30);
    setIsTimerRunning(true);
    setGameState('ANSWERING');
    setStatusBanner({
      type: 'info',
      text: `Đang mở Hàng ngang số #${rowIndex + 1} (${
        extractCrosswordLetters(row.originalAnswer, false).length
      } chữ cái).`,
    });
  };

  // Check / Judge Horizontal Row Answer
  const handleJudgeRow = (forceCorrectByTeacher?: boolean) => {
    if (actionLockRef.current || activeRowIndex === null) return;
    const row = activePuzzle.rows[activeRowIndex];
    if (!row) return;

    actionLockRef.current = true;
    setIsTimerRunning(false);

    // Compare student answer according to Vietnamese Crossword Rule
    const expectedLetters = extractCrosswordLetters(
      row.originalAnswer,
      showWithDiacritics
    ).join('');
    const expectedAscii = extractCrosswordLetters(row.originalAnswer, false).join('');
    const studentSubmitted = extractCrosswordLetters(
      rowAnswerInput,
      showWithDiacritics
    ).join('');
    const studentAscii = extractCrosswordLetters(rowAnswerInput, false).join('');

    const isCorrect =
      forceCorrectByTeacher === true
        ? true
        : forceCorrectByTeacher === false
        ? false
        : showWithDiacritics
        ? studentSubmitted === expectedLetters
        : studentAscii === expectedAscii;

    setUndoSnapshot({
      solvedRows: Array.from(solvedRowIndices),
      teams: teams.map((t) => ({ ...t })),
      currentTurnIndex,
    });

    if (isCorrect) {
      soundEngineRef.current?.playRowSolved(isMuted);
      setGameState('REVEALING');
      const targetRow = activeRowIndex;
      const pts = row.points || pointsPerRow;
      const activeTeam = teams[currentTurnIndex];

      const updatedTeams = teams.map((t, idx) =>
        idx === currentTurnIndex
          ? { ...t, score: t.score + pts, rowsSolved: t.rowsSolved + 1 }
          : t
      );
      const nextSolved = new Set(solvedRowIndices);
      nextSolved.add(targetRow);

      setTeams(updatedTeams);
      setSolvedRowIndices(nextSolved);
      const nextTurn = (currentTurnIndex + 1) % Math.max(1, updatedTeams.length);
      setCurrentTurnIndex(nextTurn);
      setStatusBanner({
        type: 'success',
        text: `Chính xác! Hàng ngang #${targetRow + 1} là "${row.originalAnswer}" (+${pts}đ cho ${
          activeTeam?.name || 'Học sinh'
        }).`,
      });
      setGameState('NEXT_TURN');
      actionLockRef.current = false;
    } else {
      soundEngineRef.current?.playWrong(isMuted);
      const nextTurn = (currentTurnIndex + 1) % Math.max(1, teams.length);
      setCurrentTurnIndex(nextTurn);
      setStatusBanner({
        type: 'error',
        text: `Chưa chính xác! Hàng ngang #${activeRowIndex + 1} vẫn đóng. Lượt chuyển sang ${
          teams[nextTurn]?.name || 'đội tiếp theo'
        }.`,
      });
      setGameState('NEXT_TURN');
      actionLockRef.current = false;
    }
  };

  // Undo last row judgment
  const handleUndo = () => {
    if (!undoSnapshot) return;
    setSolvedRowIndices(new Set(undoSnapshot.solvedRows));
    setTeams(undoSnapshot.teams);
    setCurrentTurnIndex(undoSnapshot.currentTurnIndex);
    setUndoSnapshot(null);
    setStatusBanner({
      type: 'info',
      text: 'Đã hoàn tác lượt chấm điểm hàng ngang gần nhất.',
    });
  };

  // Check Vertical Secret Keyword Guess
  const handleCheckKeywordGuess = (forceCorrectByTeacher?: boolean) => {
    const activeTeam = teams[currentTurnIndex];
    if (!activeTeam) return;

    const expectedAscii = extractCrosswordLetters(
      activePuzzle.originalKeyword,
      false
    ).join('');
    const expectedDiacritics = extractCrosswordLetters(
      activePuzzle.originalKeyword,
      true
    ).join('');
    const submittedAscii = extractCrosswordLetters(keywordGuessInput, false).join('');
    const submittedDiacritics = extractCrosswordLetters(keywordGuessInput, true).join('');

    const isMatched =
      forceCorrectByTeacher === true
        ? true
        : forceCorrectByTeacher === false
        ? false
        : showWithDiacritics
        ? submittedDiacritics === expectedDiacritics || submittedAscii === expectedAscii
        : submittedAscii === expectedAscii;

    if (isMatched) {
      soundEngineRef.current?.playKeywordVictory(isMuted);
      const allRows = new Set(activePuzzle.rows.map((_, i) => i));
      const updatedTeams = teams.map((t, idx) =>
        idx === currentTurnIndex
          ? {
              ...t,
              score: t.score + pointsForKeyword,
              keywordGuesses: t.keywordGuesses + 1,
            }
          : t
      );
      setSolvedRowIndices(allRows);
      setTeams(updatedTeams);
      setSolvedKeywordWinner(activeTeam.name);
      setGameState('FINISHED');
      setStatusBanner({
        type: 'success',
        text: `XUẤT SẮC! ${activeTeam.name.toUpperCase()} ĐÃ GIẢI ĐÚNG TỪ KHÓA HÀNG DỌC: "${
          activePuzzle.originalKeyword
        }" (+${pointsForKeyword} ĐIỂM)!`,
      });

      // Persist to Supabase audit_logs
      if (isSupabaseConfigured) {
        supabase
          .from('audit_logs')
          .insert({
            actor_id: teacherId || null,
            actor_role: userRole || 'teacher',
            action_type: 'edu_game_b03_crossword',
            entity_type: 'edu_game_session',
            entity_id: sessionId,
            metadata: {
              game_id: 'B03',
              game_title: 'Lật ô chữ bí mật (EDU Crossword Challenge)',
              puzzle_id: activePuzzle.id,
              puzzle_title: activePuzzle.title,
              keyword: activePuzzle.originalKeyword,
              class_id: selectedSourceKey || resolvedClassName,
              class_name: resolvedClassName,
              team_scores: updatedTeams.map((t) => ({
                id: t.id,
                name: t.name,
                score: t.score,
                rowsSolved: t.rowsSolved,
              })),
              completed_at: new Date().toISOString(),
            },
          })
          .then(() => {});
      }
    } else {
      soundEngineRef.current?.playWrong(isMuted);
      const delta = penaltyWrongKeyword > 0 ? -Math.abs(penaltyWrongKeyword) : 0;
      const updatedTeams = teams.map((t, idx) =>
        idx === currentTurnIndex
          ? {
              ...t,
              score: t.score + delta,
              keywordGuesses: t.keywordGuesses + 1,
            }
          : t
      );
      const nextTurn = (currentTurnIndex + 1) % Math.max(1, updatedTeams.length);
      setTeams(updatedTeams);
      setCurrentTurnIndex(nextTurn);
      setKeywordGuessInput('');
      setStatusBanner({
        type: 'error',
        text: `Từ khóa dự đoán của ${activeTeam.name} chưa chính xác (${
          delta < 0 ? `${delta}đ` : '0đ'
        }). Lượt chuyển sang ${updatedTeams[nextTurn]?.name}!`,
      });
    }
  };

  const activeRow =
    activeRowIndex !== null ? activePuzzle.rows[activeRowIndex] || null : null;

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.rowsSolved - a.rowsSolved;
      }),
    [teams]
  );

  return (
    <div className="w-full space-y-4">
      {/* Top Game Show Header */}
      <div className="bg-gradient-to-r from-[#071126] via-[#0F254E] to-[#1E1B4B] border border-cyan-400/40 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-md">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                B03 · EDU CROSSWORD CHALLENGE 1.0
              </span>
              <span className="text-xs text-amber-300 font-bold">
                Lớp: {resolvedClassName}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black text-white">
              LẬT Ô CHỮ BÍ MẬT – GIẢI MÃ TỪ KHÓA TRỌNG TÂM
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Vietnamese Diacritic Mode Toggle */}
          <button
            type="button"
            onClick={() => setShowWithDiacritics((d) => !d)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              showWithDiacritics
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
            }`}
            title="Chuyển đổi hiển thị Ô chữ không dấu (mặc định) và Ô chữ có dấu Tiếng Việt"
          >
            {showWithDiacritics ? 'Hiển thị: Ô chữ CÓ DẤU' : 'Hiển thị: Ô chữ KHÔNG DẤU'}
          </button>

          {gameState !== 'SETUP' && (
            <button
              type="button"
              onClick={() => setGameState('SETUP')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-300" />
              <span>Chọn / Tạo bộ ô chữ</span>
            </button>
          )}

          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-300" />
              )}
            </button>
          )}

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          SCREEN 1: SETUP, LIBRARY & SMART CROSSWORD BUILDER
         ===================================================================== */}
      {gameState === 'SETUP' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-md space-y-6">
          {/* Mode Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPlayMode('TRADITIONAL')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  playMode === 'TRADITIONAL'
                    ? 'bg-[#006BFF] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Chế độ 1: Giải Ô Chữ Truyền Thống</span>
              </button>

              <button
                type="button"
                onClick={() => setPlayMode('TEAM_ARENA')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  playMode === 'TEAM_ARENA'
                    ? 'bg-[#006BFF] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>Chế độ 3: Đấu Trường Ô Chữ (2–4 Đội)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPlayMode('SMART_BUILDER');
                  if (builderRows.length === 0) {
                    setBuilderKeyword(activePuzzle.originalKeyword);
                    setBuilderTitle(`${activePuzzle.title} (Bản sao)`);
                    setBuilderRows(activePuzzle.rows.map((r) => ({ ...r })));
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  playMode === 'SMART_BUILDER'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <Wand2 className="w-4 h-4" />
                <span>Chế độ 2: Tạo & Biên Tập Ô Chữ Thông Minh</span>
              </button>
            </div>
          </div>

          {playMode === 'SMART_BUILDER' ? (
            /* SMART CROSSWORD BUILDER & VALIDATOR */
            <div className="space-y-5">
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-indigo-600" />
                    <span>Công cụ Tạo Ô Chữ Từ Ngân Hàng Câu Hỏi Bài Học</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateRowsFromBank}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tự động ghép hàng ngang từ Ngân hàng câu hỏi</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Tên bộ ô chữ:
                    </label>
                    <input
                      type="text"
                      value={builderTitle}
                      onChange={(e) => setBuilderTitle(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Môn học:
                    </label>
                    <select
                      value={builderSubject}
                      onChange={(e) => setBuilderSubject(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold"
                    >
                      {Object.entries(SUBJECT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Từ khóa hàng dọc bí mật (có dấu hoặc không dấu):
                    </label>
                    <input
                      type="text"
                      value={builderKeyword}
                      onChange={(e) => setBuilderKeyword(e.target.value.toUpperCase())}
                      placeholder="VD: MÁY TÍNH"
                      className="w-full bg-amber-50 border-2 border-amber-400 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900"
                    />
                  </div>
                </div>

                {builderNotice && (
                  <div className="p-3 rounded-xl bg-white border border-indigo-200 text-xs font-bold text-indigo-900">
                    {builderNotice}
                  </div>
                )}
              </div>

              {/* Row-by-Row Editor with Instant Intersection Check */}
              <div className="space-y-2.5">
                {extractCrosswordLetters(builderKeyword, false).map((targetChar, rIdx) => {
                  const row = builderRows[rIdx] || {
                    id: `r_${rIdx}`,
                    rowIndex: rIdx,
                    clue: '',
                    originalAnswer: targetChar,
                    intersectIndex: 0,
                    points: 10,
                    timeLimitSec: 30,
                    explanation: '',
                  };
                  const rowAscii = extractCrosswordLetters(row.originalAnswer, false);
                  const isIntersectionMatched =
                    rowAscii[row.intersectIndex] === targetChar;

                  return (
                    <div
                      key={rIdx}
                      className={`p-3 rounded-2xl border-2 transition-all grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${
                        isIntersectionMatched
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-rose-50/60 border-rose-300'
                      }`}
                    >
                      <div className="lg:col-span-2 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
                          {targetChar}
                        </span>
                        <div>
                          <div className="text-xs font-black text-[#0F2D52]">
                            Hàng ngang #{rIdx + 1}
                          </div>
                          <div
                            className={`text-[10px] font-bold ${
                              isIntersectionMatched ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isIntersectionMatched ? '✓ Giao điểm khớp' : '✗ Chưa khớp chữ giao'}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-5">
                        <input
                          type="text"
                          value={row.clue}
                          onChange={(e) => {
                            const next = [...builderRows];
                            next[rIdx] = { ...row, clue: e.target.value };
                            setBuilderRows(next);
                          }}
                          placeholder="Câu hỏi gợi ý hàng ngang..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium"
                        />
                      </div>

                      <div className="lg:col-span-3">
                        <input
                          type="text"
                          value={row.originalAnswer}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            const ascii = extractCrosswordLetters(val, false);
                            const autoIdx = Math.max(0, ascii.indexOf(targetChar));
                            const next = [...builderRows];
                            next[rIdx] = {
                              ...row,
                              originalAnswer: val,
                              intersectIndex: autoIdx,
                            };
                            setBuilderRows(next);
                          }}
                          placeholder="Đáp án hàng ngang..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-extrabold uppercase"
                        />
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500">
                          Vị trí chữ giao (1..{Math.max(1, rowAscii.length)}):
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, rowAscii.length)}
                          value={row.intersectIndex + 1}
                          onChange={(e) => {
                            const idx = Math.max(0, (parseInt(e.target.value, 10) || 1) - 1);
                            const next = [...builderRows];
                            next[rIdx] = { ...row, intersectIndex: idx };
                            setBuilderRows(next);
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveBuilderPuzzle('draft')}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Lưu bản nháp
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveBuilderPuzzle('approved')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md"
                >
                  ✓ Duyệt & Sử dụng bộ ô chữ này
                </button>
              </div>
            </div>
          ) : (
            /* PUZZLE SELECTION & TEAM SETUP */
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52]">
                    1. Chọn Bộ Ô Chữ Kiến Thức ({allActivePuzzles.length} bộ sẵn sàng)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewGridInSetup((v) => !v)}
                    className="text-xs font-bold text-[#006BFF] hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{previewGridInSetup ? 'Ẩn xem trước đáp án' : 'Xem trước đáp án & từ khóa'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {allActivePuzzles.map((pz) => {
                    const isSelected = pz.id === selectedPuzzleId;
                    const kwLen = extractCrosswordLetters(pz.originalKeyword, false).length;
                    return (
                      <div
                        key={pz.id}
                        onClick={() => setSelectedPuzzleId(pz.id)}
                        className={`cursor-pointer rounded-2xl border-2 p-3.5 transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50/90 border-[#006BFF] shadow-sm'
                            : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-extrabold text-[#006BFF] mb-1">
                            <span>{SUBJECT_LABELS[pz.subject] || pz.subject} · Khối {pz.grade}</span>
                            <span>{kwLen} hàng ngang</span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-black text-[#0F2D52]">
                            {pz.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{pz.lesson}</p>
                        </div>

                        {previewGridInSetup && (
                          <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] font-bold text-amber-800">
                            Từ khóa dọc: {pz.originalKeyword}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team & Scoring Config */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-[#0F2D52]">
                      2. Đội Chơi ({teamCount} đội)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setTeamCount(n)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                            teamCount === n
                              ? 'bg-[#006BFF] text-white'
                              : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          {n} Đội
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: teamCount }, (_, i) => (
                      <input
                        key={i}
                        type="text"
                        value={teamNames[i] || ''}
                        onChange={(e) => {
                          const next = [...teamNames];
                          next[i] = e.target.value;
                          setTeamNames(next);
                        }}
                        className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#0F2D52]"
                      />
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 grid grid-cols-2 gap-2.5">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">
                      Điểm mỗi hàng ngang
                    </span>
                    <select
                      value={pointsPerRow}
                      onChange={(e) => setPointsPerRow(Number(e.target.value))}
                      className="w-full mt-1 text-xs font-extrabold text-emerald-700"
                    >
                      <option value={10}>+10 điểm</option>
                      <option value={15}>+15 điểm</option>
                      <option value={20}>+20 điểm</option>
                    </select>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">
                      Điểm giải từ khóa dọc
                    </span>
                    <select
                      value={pointsForKeyword}
                      onChange={(e) => setPointsForKeyword(Number(e.target.value))}
                      className="w-full mt-1 text-xs font-extrabold text-amber-700"
                    >
                      <option value={30}>+30 điểm</option>
                      <option value={40}>+40 điểm</option>
                      <option value={50}>+50 điểm</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#006BFF] via-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-base shadow-xl flex items-center gap-2.5"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>BẮT ĐẦU GIẢI Ô CHỮ BÍ MẬT ➔</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: ACTIVE CROSSWORD BOARD & CLUE / TEAM PANEL (60-65% / 35-40%)
         ===================================================================== */}
      {gameState !== 'SETUP' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT 60-65%: Interactive Crossword Matrix with Highlighted Golden Keyword Column */}
          <div className="lg:col-span-7 xl:col-span-8 bg-gradient-to-b from-[#071126] via-[#0C1E3E] to-[#09152B] rounded-3xl border-2 border-cyan-400/40 p-4 sm:p-6 text-white shadow-2xl flex flex-col justify-between space-y-4 overflow-x-auto">
            {/* Top Status */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                  {activePuzzle.title}
                </span>
                <div className="text-xs text-slate-300">
                  Đã giải: <strong className="text-emerald-300">{solvedRowIndices.size}</strong> /{' '}
                  {activePuzzle.rows.length} hàng ngang
                </div>
              </div>

              {teams[currentTurnIndex] && gameState !== 'FINISHED' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">Lượt chọn:</span>
                  <span
                    className="px-3 py-1 rounded-xl text-xs font-black text-white"
                    style={{ backgroundColor: teams[currentTurnIndex].colorHex }}
                  >
                    {teams[currentTurnIndex].name}
                  </span>
                </div>
              )}
            </div>

            {/* Crossword Grid Rows */}
            <div className="my-auto py-3 flex flex-col items-center justify-center space-y-2 min-w-fit">
              {activePuzzle.rows.map((row, rIdx) => {
                const letters = extractCrosswordLetters(
                  row.originalAnswer,
                  showWithDiacritics
                );
                const isRowSolved = solvedRowIndices.has(rIdx) || gameState === 'FINISHED';
                const isRowActive = activeRowIndex === rIdx;
                const isHintUnlocked = hintRevealedIntersectRows.has(rIdx);
                const startCol = activePuzzleValidation.maxLeftOffset - row.intersectIndex;

                return (
                  <div
                    key={row.id}
                    onClick={() => handleSelectRow(rIdx)}
                    className={`group flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl transition-all cursor-pointer ${
                      isRowActive
                        ? 'bg-cyan-500/20 ring-2 ring-cyan-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {/* Row Number Selector Button */}
                    <button
                      type="button"
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center shrink-0 transition-all ${
                        isRowSolved
                          ? 'bg-emerald-500 text-slate-950'
                          : isRowActive
                          ? 'bg-cyan-400 text-slate-950 scale-105'
                          : 'bg-slate-800 text-cyan-200 border border-cyan-500/40 group-hover:bg-blue-600 group-hover:text-white'
                      }`}
                    >
                      {rIdx + 1}
                    </button>

                    {/* Aligned Cells across totalCols */}
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {Array.from(
                        { length: activePuzzleValidation.totalCols },
                        (_, colIdx) => {
                          const letterIdx = colIdx - startCol;
                          const isInsideWord =
                            letterIdx >= 0 && letterIdx < letters.length;
                          const isKeywordColumn =
                            colIdx === activePuzzleValidation.maxLeftOffset;

                          if (!isInsideWord) {
                            return (
                              <div
                                key={colIdx}
                                className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg opacity-0 pointer-events-none"
                              />
                            );
                          }

                          const showChar =
                            isRowSolved || (isKeywordColumn && isHintUnlocked);

                          return (
                            <div
                              key={colIdx}
                              style={{
                                transitionDelay: isRowSolved
                                  ? `${letterIdx * 45}ms`
                                  : '0ms',
                              }}
                              className={`w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl border-2 flex items-center justify-center font-black text-xs sm:text-base md:text-lg select-none transition-all duration-300 ${
                                isKeywordColumn
                                  ? showChar
                                    ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-slate-950 border-white shadow-[0_0_16px_rgba(251,191,36,0.75)] scale-105 z-10'
                                    : 'bg-amber-500/30 border-amber-400 text-amber-200'
                                  : showChar
                                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-cyan-200 shadow-md'
                                  : isRowActive
                                  ? 'bg-slate-800 border-cyan-300 text-cyan-200'
                                  : 'bg-slate-900/90 border-slate-700 text-slate-500'
                              }`}
                            >
                              {showChar ? letters[letterIdx] : isKeywordColumn ? '?' : ''}
                            </div>
                          );
                        }
                      )}
                    </div>

                    {/* Word length badge */}
                    <span className="hidden sm:inline-block text-[10px] font-bold text-slate-400 pl-1">
                      ({letters.length})
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Controls */}
            <div className="pt-3 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {activeRowIndex !== null &&
                  !solvedRowIndices.has(activeRowIndex) &&
                  !hintRevealedIntersectRows.has(activeRowIndex) && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(hintRevealedIntersectRows);
                        next.add(activeRowIndex);
                        setHintRevealedIntersectRows(next);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      <span>Mở gợi ý chữ giao hàng #{activeRowIndex + 1}</span>
                    </button>
                  )}

                {undoSnapshot && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-cyan-200 flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Hoàn tác
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const nextTurn = (currentTurnIndex + 1) % Math.max(1, teams.length);
                    setCurrentTurnIndex(nextTurn);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Chuyển lượt đội kế
                </button>
              </div>

              <div className="text-xs font-bold text-amber-300">
                Cột màu vàng: TỪ KHÓA HÀNG DỌC ({extractCrosswordLetters(activePuzzle.originalKeyword, false).length} chữ cái)
              </div>
            </div>
          </div>

          {/* RIGHT 35-40%: Row Clue Answering, Vertical Keyword Guess & Team Leaderboard */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between gap-4">
            {statusBanner && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold ${
                  statusBanner.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : statusBanner.type === 'error'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-blue-50 border-blue-200 text-[#0F2D52]'
                }`}
              >
                {statusBanner.text}
              </div>
            )}

            {/* Card 1: Active Horizontal Row Clue & Input */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-[#006BFF]" />
                  <span>
                    {activeRow
                      ? `Hàng Ngang Số #${activeRow.rowIndex + 1} (${
                          extractCrosswordLetters(activeRow.originalAnswer, false).length
                        } chữ cái)`
                      : 'Câu Hỏi Hàng Ngang'}
                  </span>
                </span>
                {activeRow && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#006BFF] text-xs font-black font-mono">
                    ⏱ {timeLeft}s
                  </span>
                )}
              </div>

              {activeRow ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-[#0F2D52]">
                    {activeRow.clue}
                  </div>

                  {!solvedRowIndices.has(activeRow.rowIndex) ? (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={rowAnswerInput}
                          onChange={(e) => setRowAnswerInput(e.target.value)}
                          placeholder="Nhập đáp án hàng ngang..."
                          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold uppercase text-slate-900"
                        />
                        <button
                          type="button"
                          disabled={!rowAnswerInput.trim()}
                          onClick={() => handleJudgeRow()}
                          className="px-3.5 py-2 rounded-xl bg-[#006BFF] text-white text-xs font-black disabled:opacity-40"
                        >
                          Kiểm tra
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleJudgeRow(true)}
                          className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> GV chấm ĐÚNG (+{pointsPerRow}đ)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleJudgeRow(false)}
                          className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> GV chấm SAI
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <div className="font-black">
                        ✓ Đáp án gốc: {activeRow.originalAnswer}
                      </div>
                      {activeRow.explanation && <div>{activeRow.explanation}</div>}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-5">
                  Hãy nhấn vào một hàng ngang trên bảng ô chữ để hiển thị câu hỏi gợi ý!
                </p>
              )}
            </div>

            {/* Card 2: Guess Secret Vertical Keyword */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-amber-300 p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>Giải Mã Từ Khóa Hàng Dọc (+{pointsForKeyword}đ)</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled={gameState === 'FINISHED'}
                  value={keywordGuessInput}
                  onChange={(e) => setKeywordGuessInput(e.target.value)}
                  placeholder="Nhập từ khóa hàng dọc..."
                  className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold uppercase text-slate-900"
                />
                <button
                  type="button"
                  disabled={gameState === 'FINISHED' || !keywordGuessInput.trim()}
                  onClick={() => handleCheckKeywordGuess()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black disabled:opacity-40 flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" /> Giải mã
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={gameState === 'FINISHED'}
                  onClick={() => handleCheckKeywordGuess(true)}
                  className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold disabled:opacity-40"
                >
                  ✓ GV xác nhận Đoán Đúng Từ Khóa (+{pointsForKeyword}đ)
                </button>
                <button
                  type="button"
                  disabled={gameState === 'FINISHED'}
                  onClick={() => handleCheckKeywordGuess(false)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 text-[11px] font-extrabold disabled:opacity-40"
                >
                  ✗ Đoán Sai
                </button>
              </div>
            </div>

            {/* Card 3: Team Scoreboard */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-2.5 flex-1">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Bảng Xếp Hạng Đội Chơi</span>
              </div>

              <div className="space-y-2">
                {sortedTeams.map((t, rankIdx) => {
                  const isCurrentTurn = teams[currentTurnIndex]?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        const idx = teams.findIndex((item) => item.id === t.id);
                        if (idx >= 0) setCurrentTurnIndex(idx);
                      }}
                      className={`cursor-pointer p-2.5 rounded-2xl border flex items-center justify-between ${
                        isCurrentTurn
                          ? 'bg-blue-50 border-[#006BFF] ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center"
                          style={{ backgroundColor: t.colorHex }}
                        >
                          #{rankIdx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-extrabold text-[#0F2D52]">
                            {t.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold">
                            Đã giải: {t.rowsSolved} hàng ngang
                          </div>
                        </div>
                      </div>
                      <div className="text-base font-black text-[#006BFF]">
                        {t.score} đ
                      </div>
                    </div>
                  );
                })}
              </div>

              {gameState === 'FINISHED' && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-700">
                    Từ khóa: {activePuzzle.originalKeyword}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGameState('SETUP')}
                    className="px-4 py-1.5 rounded-xl bg-[#006BFF] text-white text-xs font-black"
                  >
                    Chơi bộ ô chữ khác
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
