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
  Undo2,
  Plus,
  Trash2,
  Save,
  Eye,
  AlertTriangle,
  BookOpen,
  Award,
  SkipForward,
  Sliders,
  Upload,
  Image as ImageIcon,
  Delete,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question, Grade, CognitiveLevel } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

// ============================================================================
// TYPES & STATE MACHINE
// ============================================================================

export type PictureWordPlayMode =
  | 'CLASSIC_GUESS'
  | 'LETTER_TILES'
  | 'TEAM_ARENA'
  | 'LESSON_BUILDER';

export type PictureWordStageState =
  | 'SETUP'
  | 'READY'
  | 'PUZZLE_DISPLAYED'
  | 'ANSWERING'
  | 'CHECKING'
  | 'HINT_REVEALING'
  | 'SCORING'
  | 'NEXT_PUZZLE'
  | 'FINISHED';

export type BuiltinVisualArtKey =
  | 'FIRE_THERMAL'
  | 'RULER_DEGREE'
  | 'MOUSE_ANIMAL'
  | 'COMPUTER_SCREEN'
  | 'SUN_LIGHT'
  | 'LEAF_CHLOROPHYLL'
  | 'TRIANGLE_3'
  | 'RIGHT_ANGLE_90'
  | 'COMPASS_WEST'
  | 'CAPITAL_CITY'
  | 'WATER_DROP'
  | 'VAPOR_CLOUD';

export interface VisualCluePanel {
  id: string;
  caption: string;
  artType: 'builtin_svg' | 'uploaded_image';
  builtinKey?: BuiltinVisualArtKey;
  imageUrl?: string;
}

export interface PictureWordPuzzleItem {
  id: string;
  title: string;
  subject: string;
  grade: Grade;
  chapter: string;
  lesson: string;
  /** Đáp án gốc tiếng Việt có dấu (VD: "NHIỆT ĐỘ") */
  originalAnswer: string;
  /** Các đáp án thay thế được chấp nhận */
  acceptedAnswers: string[];
  /** 1 đến 3 hình gợi ý kết hợp tạo thành từ khóa */
  visualPanels: VisualCluePanel[];
  /** Gợi ý 3 cấp: [Chủ đề, Số tiếng/chữ cái đầu, Gợi ý sâu/một phần đáp án] */
  hints: [string, string, string];
  /** Giải thích mối liên hệ giữa các hình minh họa và từ khóa */
  visualConnectionExplanation: string;
  source: 'builtin' | 'custom';
  authorId: string;
  createdAt: string;
}

export interface PictureWordTeam {
  id: string;
  name: string;
  colorHex: string;
  members: StudentCandidate[];
  score: number;
  correctCount: number;
  hintsUsedTotal: number;
}

export interface PictureWordScoreLog {
  id: string;
  timestamp: string;
  puzzleIndex: number;
  targetName: string;
  teamId?: string;
  deltaPoints: number;
  reason: string;
}

export interface ScrambledTileItem {
  tileId: string;
  char: string;
}

export interface PictureWordGameProps {
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
// VIETNAMESE NORMALIZATION & LETTER EXTRACTION HELPERS
// ============================================================================

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Toán học',
  literature: 'Ngữ văn',
  english: 'Tiếng Anh',
  science: 'Khoa học tự nhiên',
  history_geo: 'Lịch sử & Địa lí',
  informatics: 'Tin học',
  technology: 'Công nghệ',
  civics: 'Giáo dục công dân',
  general: 'Tổng hợp THCS',
};

const TEAM_PRESETS = [
  { id: 'pw-team-1', name: 'Đội Tinh Mắt Xanh', colorHex: '#0EA5E9' },
  { id: 'pw-team-2', name: 'Đội Nhanh Trí Vàng', colorHex: '#F59E0B' },
  { id: 'pw-team-3', name: 'Đội Sáng Tạo Tím', colorHex: '#8B5CF6' },
  { id: 'pw-team-4', name: 'Đội Bứt Phá Ngọc', colorHex: '#10B981' },
];

const STORAGE_CUSTOM_PUZZLES_KEY = 'taydo_smart_edu_b06_custom_puzzles_v1';
const STORAGE_ACTIVE_SESSION_KEY = 'taydo_smart_edu_b06_active_session_v1';

/**
 * Chuẩn hóa ký tự tiếng Việt sang chữ cái A-Z không dấu (Đ/đ -> D, tách dấu NFD)
 */
export function toAsciiUpperChar(ch: string): string {
  return ch
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}

/**
 * Chuẩn hóa chuỗi tiếng Việt để so khớp đáp án
 */
export function normalizeVietnameseAnswer(raw: string, stripAccents: boolean): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!stripAccents) return cleaned;
  return cleaned
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'D');
}

/**
 * Tách mảng chữ cái cho Chế độ 2 – Ghép chữ giải mã (bỏ khoảng trắng)
 */
export function extractPuzzleLetters(raw: string, useDiacritics: boolean): string[] {
  const noSpaces = raw.replace(/[\s\-_.,;:'"?!()[\]{}/\\]+/g, '').toUpperCase();
  const chars = Array.from(noSpaces);
  if (useDiacritics) {
    return chars.filter((c) => /^[A-Z0-9]$/.test(toAsciiUpperChar(c)));
  }
  return chars
    .map((c) => toAsciiUpperChar(c))
    .filter((c) => /^[A-Z0-9]$/.test(c));
}

// ============================================================================
// CUSTOM SVG ARTWORK RENDERER FOR VISUAL CLUE PANELS (NO EMOJI SLOP)
// ============================================================================

export const VisualClueSvgArtwork: React.FC<{ artKey: BuiltinVisualArtKey }> = ({ artKey }) => {
  switch (artKey) {
    case 'FIRE_THERMAL':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <defs>
            <radialGradient id="fireGlowB06" cx="50%" cy="60%" r="50%">
              <stop offset="0%" stopColor="#FDE047" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <circle cx="110" cy="90" r="65" fill="url(#fireGlowB06)" />
          {/* Campfire Logs */}
          <rect x="65" y="122" width="90" height="14" rx="6" fill="#78350F" transform="rotate(-8 110 129)" />
          <rect x="65" y="122" width="90" height="14" rx="6" fill="#92400E" transform="rotate(8 110 129)" />
          {/* Outer Flame */}
          <path
            d="M110 22 C138 52 152 78 136 106 C126 122 94 122 84 106 C68 78 82 52 110 22 Z"
            fill="#F97316"
            stroke="#FACC15"
            strokeWidth="3"
          />
          {/* Inner Flame */}
          <path
            d="M110 48 C126 68 132 86 122 104 C116 114 104 114 98 104 C88 86 94 68 110 48 Z"
            fill="#FDE047"
          />
          {/* Rising Heat Waves */}
          <path d="M70 50 Q64 38 70 26" stroke="#FB923C" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M150 50 Q156 38 150 26" stroke="#FB923C" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );

    case 'RULER_DEGREE':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          {/* Protractor / Degree Arc */}
          <path
            d="M42 122 A68 68 0 0 1 178 122 Z"
            fill="#1E293B"
            stroke="#38BDF8"
            strokeWidth="4"
          />
          <path
            d="M66 122 A44 44 0 0 1 154 122 Z"
            fill="#0F172A"
            stroke="#7DD3FC"
            strokeWidth="2"
          />
          {/* Degree Tick Marks */}
          <line x1="110" y1="54" x2="110" y2="66" stroke="#FACC15" strokeWidth="3" />
          <line x1="62" y1="74" x2="72" y2="82" stroke="#38BDF8" strokeWidth="2.5" />
          <line x1="158" y1="74" x2="148" y2="82" stroke="#38BDF8" strokeWidth="2.5" />
          {/* Degree Symbol Label */}
          <text x="110" y="42" textAnchor="middle" fill="#FEF08A" fontSize="22" fontWeight="900">
            90° · 180°
          </text>
        </svg>
      );

    case 'MOUSE_ANIMAL':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          {/* Cute Stylized Mouse */}
          <path d="M45 112 Q22 95 36 74" stroke="#F472B6" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="105" cy="96" rx="46" ry="30" fill="#94A3B8" stroke="#E2E8F0" strokeWidth="3" />
          <circle cx="82" cy="64" r="16" fill="#CBD5E1" stroke="#E2E8F0" strokeWidth="3" />
          <circle cx="82" cy="64" r="9" fill="#F472B6" />
          <circle cx="126" cy="66" r="15" fill="#CBD5E1" stroke="#E2E8F0" strokeWidth="3" />
          <circle cx="126" cy="66" r="8" fill="#F472B6" />
          {/* Eyes & Nose */}
          <circle cx="132" cy="90" r="4.5" fill="#0F172A" />
          <circle cx="152" cy="96" r="6" fill="#F43F5E" />
          {/* Whiskers */}
          <line x1="142" y1="102" x2="168" y2="98" stroke="#F8FAFC" strokeWidth="2" />
          <line x1="142" y1="106" x2="166" y2="108" stroke="#F8FAFC" strokeWidth="2" />
        </svg>
      );

    case 'COMPUTER_SCREEN':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          {/* Monitor Frame */}
          <rect x="44" y="24" width="132" height="86" rx="10" fill="#1E293B" stroke="#38BDF8" strokeWidth="3.5" />
          <rect x="52" y="32" width="116" height="70" rx="6" fill="#0284C7" />
          {/* Code / Binary inside screen */}
          <rect x="64" y="44" width="52" height="8" rx="4" fill="#FEF08A" />
          <rect x="64" y="58" width="84" height="7" rx="3.5" fill="#E0F2FE" />
          <rect x="64" y="72" width="68" height="7" rx="3.5" fill="#7DD3FC" />
          {/* Stand */}
          <rect x="98" y="110" width="24" height="18" fill="#64748B" />
          <rect x="74" y="128" width="72" height="8" rx="4" fill="#94A3B8" />
        </svg>
      );

    case 'SUN_LIGHT':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <circle cx="110" cy="80" r="34" fill="#FACC15" stroke="#FEF08A" strokeWidth="4" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="110"
              y1="26"
              x2="110"
              y2="12"
              stroke="#FDE047"
              strokeWidth="4"
              strokeLinecap="round"
              transform={`rotate(${deg} 110 80)`}
            />
          ))}
        </svg>
      );

    case 'LEAF_CHLOROPHYLL':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <path
            d="M52 122 C52 54 118 28 168 34 C162 88 134 132 52 122 Z"
            fill="#10B981"
            stroke="#6EE7B7"
            strokeWidth="3.5"
          />
          <path d="M44 128 Q106 82 162 38" stroke="#ECFDF5" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M88 94 L118 92 M108 76 L136 74" stroke="#A7F3D0" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'TRIANGLE_3':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <polygon
            points="110,24 46,132 174,132"
            fill="#1D4ED8"
            fillOpacity="0.35"
            stroke="#38BDF8"
            strokeWidth="4"
          />
          <circle cx="110" cy="24" r="5" fill="#FACC15" />
          <circle cx="46" cy="132" r="5" fill="#FACC15" />
          <circle cx="174" cy="132" r="5" fill="#FACC15" />
          <text x="110" y="102" textAnchor="middle" fill="#FEF08A" fontSize="22" fontWeight="900">
            3 CẠNH
          </text>
        </svg>
      );

    case 'RIGHT_ANGLE_90':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <path d="M62 28 V128 H168" fill="none" stroke="#34D399" strokeWidth="5" strokeLinecap="round" />
          <rect x="62" y="100" width="28" height="28" fill="#10B981" fillOpacity="0.3" stroke="#FACC15" strokeWidth="3" />
          <circle cx="76" cy="114" r="3" fill="#FACC15" />
          <text x="130" y="82" textAnchor="middle" fill="#FEF08A" fontSize="24" fontWeight="900">
            90°
          </text>
        </svg>
      );

    case 'COMPASS_WEST':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <circle cx="110" cy="80" r="54" fill="#1E293B" stroke="#38BDF8" strokeWidth="3.5" />
          <text x="110" y="38" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="900">B</text>
          <text x="110" y="130" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="900">N</text>
          <text x="156" y="84" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="900">Đ</text>
          <text x="62" y="85" textAnchor="middle" fill="#FACC15" fontSize="16" fontWeight="900">TÂY</text>
          {/* Compass Needle pointing West */}
          <polygon points="68,80 110,72 110,88" fill="#EF4444" />
          <polygon points="152,80 110,72 110,88" fill="#CBD5E1" />
          <circle cx="110" cy="80" r="5" fill="#FACC15" />
        </svg>
      );

    case 'CAPITAL_CITY':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <rect x="42" y="64" width="36" height="68" rx="4" fill="#3B82F6" />
          <rect x="86" y="34" width="48" height="98" rx="4" fill="#6366F1" stroke="#FACC15" strokeWidth="2.5" />
          <rect x="142" y="54" width="36" height="78" rx="4" fill="#0EA5E9" />
          <polygon points="110,16 96,34 124,34" fill="#FACC15" />
          <text x="110" y="148" textAnchor="middle" fill="#FEF08A" fontSize="13" fontWeight="900">
            ĐÔ THỊ / KINH ĐÔ
          </text>
        </svg>
      );

    case 'WATER_DROP':
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <path
            d="M110 24 C140 66 154 88 154 108 A44 44 0 1 1 66 108 C66 88 80 66 110 24 Z"
            fill="#0EA5E9"
            stroke="#7DD3FC"
            strokeWidth="3.5"
          />
          <ellipse cx="96" cy="102" rx="8" ry="14" fill="#E0F2FE" fillOpacity="0.6" />
        </svg>
      );

    case 'VAPOR_CLOUD':
    default:
      return (
        <svg viewBox="0 0 220 160" className="w-full h-full object-contain">
          <rect width="220" height="160" rx="16" fill="#0F172A" />
          <path
            d="M68 96 A24 24 0 0 1 92 58 A30 30 0 0 1 148 64 A22 22 0 0 1 162 96 Z"
            fill="#CBD5E1"
            stroke="#F8FAFC"
            strokeWidth="3"
          />
          <path d="M84 134 L84 108 M78 114 L84 106 L90 114" stroke="#38BDF8" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M110 134 L110 108 M104 114 L110 106 L116 114" stroke="#38BDF8" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M136 134 L136 108 M130 114 L136 106 L142 114" stroke="#38BDF8" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
  }
};

// ============================================================================
// BUILT-IN VERIFIED PICTURE WORD PUZZLES (THCS)
// ============================================================================

const BUILTIN_PUZZLES: PictureWordPuzzleItem[] = [
  {
    id: 'b06-puz-1',
    title: 'Câu đố #1: Đại lượng Vật lí & Khoa học tự nhiên',
    subject: 'science',
    grade: '6',
    chapter: 'Các phép đo',
    lesson: 'Đo nhiệt độ',
    originalAnswer: 'NHIỆT ĐỘ',
    acceptedAnswers: ['NHIỆT ĐỘ', 'NHIET DO', 'NHIỆTĐỘ', 'NHIETDO'],
    visualPanels: [
      {
        id: 'vp-1a',
        caption: 'Hình 1: Ngọn lửa tỏa nhiệt lượng nóng',
        artType: 'builtin_svg',
        builtinKey: 'FIRE_THERMAL',
      },
      {
        id: 'vp-1b',
        caption: 'Hình 2: Thước đo góc / đơn vị độ (°)',
        artType: 'builtin_svg',
        builtinKey: 'RULER_DEGREE',
      },
    ],
    hints: [
      'Gợi ý cấp 1 (Chủ đề): Một đại lượng vật lí trong môn Khoa học tự nhiên 6 dùng nhiệt kế để đo.',
      'Gợi ý cấp 2 (Cấu trúc từ): Gồm 2 tiếng (7 chữ cái), bắt đầu bằng chữ N.',
      'Gợi ý cấp 3 (Mở một phần): Tiếng đầu là "NHIỆT", ghép với đơn vị góc ở hình 2.',
    ],
    visualConnectionExplanation:
      'Hình 1 biểu thị sức nóng / NHIỆT lượng; Hình 2 biểu thị thước đo góc theo đơn vị ĐỘ (°) ⇒ Ghép lại thành từ khóa: NHIỆT ĐỘ.',
    source: 'builtin',
    authorId: 'system',
    createdAt: '2026-11-15T00:00:00Z',
  },
  {
    id: 'b06-puz-2',
    title: 'Câu đố #2: Thiết bị ngoại vi quen thuộc',
    subject: 'informatics',
    grade: '6',
    chapter: 'Máy tính và cộng đồng',
    lesson: 'Thiết bị vào và thiết bị ra',
    originalAnswer: 'CHUỘT MÁY TÍNH',
    acceptedAnswers: ['CHUỘT MÁY TÍNH', 'CHUOT MAY TINH', 'CHUỘTMÁYTÍNH', 'CHUOTMAYTINH'],
    visualPanels: [
      {
        id: 'vp-2a',
        caption: 'Hình 1: Con vật nhỏ có đuôi dài và hai tai tròn',
        artType: 'builtin_svg',
        builtinKey: 'MOUSE_ANIMAL',
      },
      {
        id: 'vp-2b',
        caption: 'Hình 2: Màn hình và bộ máy tính để bàn',
        artType: 'builtin_svg',
        builtinKey: 'COMPUTER_SCREEN',
      },
    ],
    hints: [
      'Gợi ý cấp 1 (Chủ đề): Một thiết bị nhập dữ liệu (Input Device) cơ bản trong môn Tin học.',
      'Gợi ý cấp 2 (Cấu trúc từ): Gồm 3 tiếng (12 chữ cái), bắt đầu bằng chữ C.',
      'Gợi ý cấp 3 (Mở một phần): Tiếng đầu là "CHUỘT", hai tiếng sau là tên thiết bị ở hình 2.',
    ],
    visualConnectionExplanation:
      'Hình 1 là con CHUỘT; Hình 2 là chiếc MÁY TÍNH ⇒ Ghép lại thành thiết bị điều khiển con trỏ trên màn hình: CHUỘT MÁY TÍNH.',
    source: 'builtin',
    authorId: 'system',
    createdAt: '2026-11-15T00:00:00Z',
  },
  {
    id: 'b06-puz-3',
    title: 'Câu đố #3: Quá trình sinh học ở thực vật',
    subject: 'science',
    grade: '7',
    chapter: 'Trao đổi chất và chuyển hóa năng lượng',
    lesson: 'Quang hợp ở thực vật',
    originalAnswer: 'QUANG HỢP',
    acceptedAnswers: ['QUANG HỢP', 'QUANG HOP', 'QUANGHỢP', 'QUANGHOP'],
    visualPanels: [
      {
        id: 'vp-3a',
        caption: 'Hình 1: Ánh sáng mặt trời rực rỡ (Quang)',
        artType: 'builtin_svg',
        builtinKey: 'SUN_LIGHT',
      },
      {
        id: 'vp-3b',
        caption: 'Hình 2: Chiếc lá xanh tổng hợp chất hữu cơ (Hợp)',
        artType: 'builtin_svg',
        builtinKey: 'LEAF_CHLOROPHYLL',
      },
    ],
    hints: [
      'Gợi ý cấp 1 (Chủ đề): Quá trình cây xanh sử dụng ánh sáng mặt trời để tạo ra chất hữu cơ và khí oxygen.',
      'Gợi ý cấp 2 (Cấu trúc từ): Gồm 2 tiếng (8 chữ cái), bắt đầu bằng chữ Q.',
      'Gợi ý cấp 3 (Mở một phần): "QUANG" (ánh sáng) + "HỢP" (tổng hợp).',
    ],
    visualConnectionExplanation:
      'Hình 1 gợi từ Hán Việt "QUANG" (ánh sáng mặt trời); Hình 2 gợi sự tổng "HỢP" chất ở lá cây ⇒ Tạo thành thuật ngữ sinh học: QUANG HỢP.',
    source: 'builtin',
    authorId: 'system',
    createdAt: '2026-11-15T00:00:00Z',
  },
  {
    id: 'b06-puz-4',
    title: 'Câu đố #4: Khái niệm Hình học phẳng',
    subject: 'math',
    grade: '7',
    chapter: 'Tam giác',
    lesson: 'Tam giác vuông và định lí Pythagore',
    originalAnswer: 'TAM GIÁC VUÔNG',
    acceptedAnswers: ['TAM GIÁC VUÔNG', 'TAM GIAC VUONG', 'TAMGIÁCVUÔNG', 'TAMGIACVUONG'],
    visualPanels: [
      {
        id: 'vp-4a',
        caption: 'Hình 1: Đa giác có 3 cạnh và 3 đỉnh',
        artType: 'builtin_svg',
        builtinKey: 'TRIANGLE_3',
      },
      {
        id: 'vp-4b',
        caption: 'Hình 2: Hai tia tạo thành góc 90°',
        artType: 'builtin_svg',
        builtinKey: 'RIGHT_ANGLE_90',
      },
    ],
    hints: [
      'Gợi ý cấp 1 (Chủ đề): Một hình quen thuộc trong môn Toán học gắn liền với định lí Pythagore.',
      'Gợi ý cấp 2 (Cấu trúc từ): Gồm 3 tiếng (12 chữ cái), bắt đầu bằng chữ T.',
      'Gợi ý cấp 3 (Mở một phần): Hai tiếng đầu là "TAM GIÁC", tiếng thứ ba chỉ góc 90°.',
    ],
    visualConnectionExplanation:
      'Hình 1 là hình TAM GIÁC (3 cạnh); Hình 2 là góc VUÔNG (90°) ⇒ Ghép lại thành: TAM GIÁC VUÔNG.',
    source: 'builtin',
    authorId: 'system',
    createdAt: '2026-11-15T00:00:00Z',
  },
  {
    id: 'b06-puz-5',
    title: 'Câu đố #5: Địa danh lịch sử văn hóa miền Tây',
    subject: 'history_geo',
    grade: '8',
    chapter: 'Vùng Đồng bằng sông Cửu Long',
    lesson: 'Trung tâm kinh tế – văn hóa Cần Thơ',
    originalAnswer: 'TÂY ĐÔ',
    acceptedAnswers: ['TÂY ĐÔ', 'TAY DO', 'TÂYĐÔ', 'TAYDO'],
    visualPanels: [
      {
        id: 'vp-5a',
        caption: 'Hình 1: Kim la bàn chỉ về hướng Tây',
        artType: 'builtin_svg',
        builtinKey: 'COMPASS_WEST',
      },
      {
        id: 'vp-5b',
        caption: 'Hình 2: Đô thị trung tâm sầm uất',
        artType: 'builtin_svg',
        builtinKey: 'CAPITAL_CITY',
      },
    ],
    hints: [
      'Gợi ý cấp 1 (Chủ đề): Tên gọi thân thương của vùng đất Cần Thơ và cũng là tên ngôi trường của chúng ta.',
      'Gợi ý cấp 2 (Cấu trúc từ): Gồm 2 tiếng (5 chữ cái), bắt đầu bằng chữ T.',
      'Gợi ý cấp 3 (Mở một phần): Hướng "TÂY" + Kinh "ĐÔ".',
    ],
    visualConnectionExplanation:
      'Hình 1 chỉ hướng TÂY trên la bàn; Hình 2 biểu trưng cho ĐÔ thị / Kinh ĐÔ ⇒ Ghép lại thành: TÂY ĐÔ.',
    source: 'builtin',
    authorId: 'system',
    createdAt: '2026-11-15T00:00:00Z',
  },
  {
    id: 'b06-puz-6',
    title: 'Câu đố #6: Sự chuyển thể của chất',
    subject: 'science',
    grade: '6',
    chapter: 'Các thể của chất',
    lesson: 'Sự chuyển thể',
    originalAnswer: 'BAY HƠI',
    acceptedAnswers: ['BAY HƠI', 'BAY HOI', 'BAYHƠI', 'BAYHOI'],
    visualPanels: [
      {
        id: 'vp-6a',
        caption: 'Hình 1: Giọt nước ở thể lỏng',
        artType: 'builtin_svg',
        builtinKey: 'WATER_DROP',
      },
      {
        id: 'vp-6b',
        caption: 'Hình 2: Hơi nước bay lên tạo thành đám mây',
        artType: 'builtin_svg',
        builtinKey: 'VAPOR_CLOUD',
      },
    ],
    hints: [
      'Gợi ý cấp 1 (Chủ đề): Quá trình chất chuyển từ thể lỏng sang thể khí (hơi) ở mặt thoáng.',
      'Gợi ý cấp 2 (Cấu trúc từ): Gồm 2 tiếng (6 chữ cái), bắt đầu bằng chữ B.',
      'Gợi ý cấp 3 (Mở một phần): Tiếng đầu là "BAY", tiếng thứ hai là "HƠI".',
    ],
    visualConnectionExplanation:
      'Hình 1 là nước lỏng; Hình 2 là các mũi tên HƠI nước đang BAY lên cao ⇒ Tạo thành hiện tượng vật lí: BAY HƠI.',
    source: 'builtin',
    authorId: 'system',
    createdAt: '2026-11-15T00:00:00Z',
  },
];

// ============================================================================
// WEB AUDIO SYNTHESIZER FOR B06
// ============================================================================

class PictureWordSoundEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  public playTileClick(muted: boolean) {
    if (muted) return;
    this.playTone(620, 50, 'triangle', 0.09);
  }

  public playHintOpen(muted: boolean) {
    if (muted) return;
    [440, 554.37, 659.25].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 120, 'sine', 0.11), idx * 65);
    });
  }

  public playCorrect(muted: boolean) {
    if (muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 160, 'triangle', 0.15), idx * 75);
    });
  }

  public playWrong(muted: boolean) {
    if (muted) return;
    [250, 196].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 220, 'sawtooth', 0.12), idx * 140);
    });
  }

  public playVictory(muted: boolean) {
    if (muted) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 220, 'triangle', 0.15), idx * 90);
    });
  }
}

const pwSound = new PictureWordSoundEngine();

// ============================================================================
// MAIN COMPONENT: PictureWordGame (B06)
// ============================================================================

export const PictureWordGame: React.FC<PictureWordGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds = new Set(),
  questions = [],
  resolvedClassName = 'Lớp học',
  teacherId = 'teacher-1',
  teacherName = 'Giáo viên',
  userRole = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onOpenAbsentModal,
}) => {
  // 1. Custom & Built-in Puzzles
  const [customPuzzles, setCustomPuzzles] = useState<PictureWordPuzzleItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_PUZZLES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    return [];
  });

  const allPuzzles = useMemo(
    () => [...customPuzzles, ...BUILTIN_PUZZLES],
    [customPuzzles]
  );

  // 2. Mode & State Machine
  const [playMode, setPlayMode] = useState<PictureWordPlayMode>('LETTER_TILES');
  const [stageState, setStageState] = useState<PictureWordStageState>('PUZZLE_DISPLAYED');
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState<number>(0);
  const [acceptUnaccentedVietnamese, setAcceptUnaccentedVietnamese] = useState<boolean>(true);
  const [useDiacriticTiles, setUseDiacriticTiles] = useState<boolean>(false); // Default: Bảng chữ cái chuẩn hóa A-Z (Đ->D) cho khay ghép chữ

  const currentPuzzle = useMemo(
    () =>
      allPuzzles[Math.min(currentPuzzleIndex, Math.max(0, allPuzzles.length - 1))] ||
      BUILTIN_PUZZLES[0],
    [allPuzzles, currentPuzzleIndex]
  );

  // 3. Scoring Tier Configuration (Section IV)
  const [scoreTier0Hint, setScoreTier0Hint] = useState<number>(20);
  const [scoreTier1Hint, setScoreTier1Hint] = useState<number>(15);
  const [scoreTier2Hint, setScoreTier2Hint] = useState<number>(10);
  const [scoreTier3Hint, setScoreTier3Hint] = useState<number>(5);

  // 4. Timer Configuration (Section IX: 15s, 30s default, 45s, 60s)
  const [configuredTimeSec, setConfiguredTimeSec] = useState<number>(30);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(30);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // 5. Hints & Answer State for Current Puzzle
  const [unlockedHintLevels, setUnlockedHintLevels] = useState<number[]>([]);
  const [teacherRevealedFullAnswer, setTeacherRevealedFullAnswer] = useState<boolean>(false);
  const [classicTextInput, setClassicTextInput] = useState<string>('');
  const [roundFeedback, setRoundFeedback] = useState<{
    isCorrect: boolean;
    headline: string;
    explanation: string;
  } | null>(null);

  // 6. Mode 2: Letter Tiles Tray & Answer Slots State
  const targetAnswerLetters = useMemo(
    () => extractPuzzleLetters(currentPuzzle.originalAnswer, useDiacriticTiles),
    [currentPuzzle.originalAnswer, useDiacriticTiles]
  );

  const [scrambledTray, setScrambledTray] = useState<ScrambledTileItem[]>([]);
  const [slotAssignments, setSlotAssignments] = useState<Array<ScrambledTileItem | null>>([]);
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null);

  // 7. Individual & Team Arena State
  const [calledStudent, setCalledStudent] = useState<StudentCandidate | null>(null);
  const [individualScore, setIndividualScore] = useState<number>(0);
  const [teamCount, setTeamCount] = useState<number>(3);
  const [teams, setTeams] = useState<PictureWordTeam[]>([]);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number>(0);
  const [scoredPuzzleIds, setScoredPuzzleIds] = useState<string[]>([]);
  const [scoreLogs, setScoreLogs] = useState<PictureWordScoreLog[]>([]);
  const sessionStartIsoRef = useRef<string>(new Date().toISOString());

  // 8. Lesson Builder State (Section VI & VII)
  const [builderTitle, setBuilderTitle] = useState<string>('Câu đố Đuổi hình bắt chữ mới');
  const [builderGrade, setBuilderGrade] = useState<Grade>('6');
  const [builderSubject, setBuilderSubject] = useState<string>('science');
  const [builderLesson, setBuilderLesson] = useState<string>('');
  const [builderKeyword, setBuilderKeyword] = useState<string>('NHIỆT KẾ');
  const [builderExplanation, setBuilderExplanation] = useState<string>(
    'Hình 1 biểu thị nhiệt lượng; Hình 2 biểu thị dụng cụ đo kế ⇒ Ghép thành NHIỆT KẾ.'
  );
  const [builderHint1, setBuilderHint1] = useState<string>(
    'Gợi ý 1: Dụng cụ dùng trong phòng thí nghiệm Khoa học tự nhiên.'
  );
  const [builderHint2, setBuilderHint2] = useState<string>('Gợi ý 2: Gồm 2 tiếng, bắt đầu bằng chữ N.');
  const [builderHint3, setBuilderHint3] = useState<string>('Gợi ý 3: Dùng để đo nhiệt độ cơ thể hoặc nước.');
  const [builderPanels, setBuilderPanels] = useState<VisualCluePanel[]>([
    {
      id: 'bp-1',
      caption: 'Hình gợi ý #1',
      artType: 'builtin_svg',
      builtinKey: 'FIRE_THERMAL',
    },
    {
      id: 'bp-2',
      caption: 'Hình gợi ý #2',
      artType: 'builtin_svg',
      builtinKey: 'RULER_DEGREE',
    },
  ]);
  const [builderNotice, setBuilderNotice] = useState<string | null>(null);

  // ============================================================================
  // INITIALIZE TEAMS & SCRAMBLED LETTER TRAY
  // ============================================================================

  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((s) => !absentIds.has(s.id));
  }, [allCandidates, availableCandidates, absentIds]);

  const buildTeams = useCallback(
    (count: number): PictureWordTeam[] => {
      return TEAM_PRESETS.slice(0, count).map((preset, idx) => ({
        id: preset.id,
        name: preset.name,
        colorHex: preset.colorHex,
        members: presentStudents.filter((_, i) => i % count === idx),
        score: 0,
        correctCount: 0,
        hintsUsedTotal: 0,
      }));
    },
    [presentStudents]
  );

  useEffect(() => {
    setTeams(buildTeams(teamCount));
  }, [teamCount, buildTeams]);

  // Build scrambled letter tray whenever currentPuzzle or useDiacriticTiles changes
  const initPuzzleRoundState = useCallback(
    (letters: string[]) => {
      const decoys = ['A', 'N', 'T', 'H', 'C', 'M', 'G', 'I'];
      const extraCount = letters.length <= 6 ? 2 : 1;
      const combinedChars = [...letters, ...decoys.slice(0, extraCount)];

      // Deterministic-friendly shuffle
      const tiles: ScrambledTileItem[] = combinedChars
        .map((ch, idx) => ({
          tileId: `tile-${idx}-${ch}`,
          char: ch,
          sortWeight: ((idx * 37 + ch.charCodeAt(0) * 13) % 97) + Math.random() * 10,
        }))
        .sort((a, b) => a.sortWeight - b.sortWeight)
        .map(({ tileId, char }) => ({ tileId, char }));

      setScrambledTray(tiles);
      setSlotAssignments(Array.from({ length: letters.length }, () => null));
      setUnlockedHintLevels([]);
      setTeacherRevealedFullAnswer(false);
      setClassicTextInput('');
      setRoundFeedback(null);
      setTimeLeftSec(configuredTimeSec);
      setIsTimerRunning(true);
      setStageState('PUZZLE_DISPLAYED');
    },
    [configuredTimeSec]
  );

  useEffect(() => {
    initPuzzleRoundState(targetAnswerLetters);
  }, [currentPuzzle.id, targetAnswerLetters, initPuzzleRoundState]);

  // Countdown Timer Effect
  useEffect(() => {
    if (!isTimerRunning || stageState === 'SCORING' || stageState === 'FINISHED') return;
    if (timeLeftSec <= 0) {
      setIsTimerRunning(false);
      pwSound.playWrong(isMuted);
      setRoundFeedback({
        isCorrect: false,
        headline: 'HẾT THỜI GIAN SUY NGHĨ!',
        explanation:
          'Đồng hồ đã về 0 giây. Giáo viên có thể mở thêm gợi ý, chuyển lượt cho đội tiếp theo hoặc công bố đáp án.',
      });
      return;
    }
    const timer = window.setInterval(() => {
      setTimeLeftSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTimerRunning, timeLeftSec, stageState, isMuted]);

  // ============================================================================
  // LETTER TILES INTERACTION (CLICK & DRAG-AND-DROP WITHOUT LOSING TILES)
  // ============================================================================

  const usedTileIds = useMemo(() => {
    const s = new Set<string>();
    slotAssignments.forEach((item) => {
      if (item) s.add(item.tileId);
    });
    return s;
  }, [slotAssignments]);

  const handleClickTrayTile = (tile: ScrambledTileItem) => {
    if (stageState === 'SCORING' || stageState === 'FINISHED') return;
    if (usedTileIds.has(tile.tileId)) return;

    const firstEmptyIdx = slotAssignments.findIndex((s) => s === null);
    if (firstEmptyIdx === -1) return;

    pwSound.playTileClick(isMuted);
    setStageState('ANSWERING');
    setSlotAssignments((prev) => {
      const next = [...prev];
      next[firstEmptyIdx] = tile;
      return next;
    });
  };

  const handleRemoveSlotTile = (slotIdx: number) => {
    if (stageState === 'SCORING' || stageState === 'FINISHED') return;
    pwSound.playTileClick(isMuted);
    setSlotAssignments((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const handleBackspaceSlot = () => {
    if (stageState === 'SCORING' || stageState === 'FINISHED') return;
    for (let i = slotAssignments.length - 1; i >= 0; i--) {
      if (slotAssignments[i] !== null) {
        handleRemoveSlotTile(i);
        break;
      }
    }
  };

  const handleClearAllSlots = () => {
    if (stageState === 'SCORING' || stageState === 'FINISHED') return;
    pwSound.playTileClick(isMuted);
    setSlotAssignments(Array.from({ length: targetAnswerLetters.length }, () => null));
  };

  const handleDropTileOnSlot = (slotIdx: number, tileId: string) => {
    if (stageState === 'SCORING' || stageState === 'FINISHED') return;
    const tileObj = scrambledTray.find((t) => t.tileId === tileId);
    if (!tileObj) return;

    pwSound.playTileClick(isMuted);
    setStageState('ANSWERING');
    setSlotAssignments((prev) => {
      const next = prev.map((existing) =>
        existing && existing.tileId === tileId ? null : existing
      );
      next[slotIdx] = tileObj;
      return next;
    });
    setDraggedTileId(null);
  };

  // ============================================================================
  // 3-TIER HINT SYSTEM & SCORING CALCULATION
  // ============================================================================

  const currentPotentialPoints = useMemo(() => {
    if (teacherRevealedFullAnswer) return 0;
    const hintsCount = unlockedHintLevels.length;
    if (hintsCount === 0) return scoreTier0Hint;
    if (hintsCount === 1) return scoreTier1Hint;
    if (hintsCount === 2) return scoreTier2Hint;
    return scoreTier3Hint;
  }, [
    teacherRevealedFullAnswer,
    unlockedHintLevels.length,
    scoreTier0Hint,
    scoreTier1Hint,
    scoreTier2Hint,
    scoreTier3Hint,
  ]);

  const handleUnlockHintTier = (tierNumber: 1 | 2 | 3) => {
    // Không cho sử dụng cùng một gợi ý nhiều lần để trừ điểm lặp
    if (unlockedHintLevels.includes(tierNumber)) return;
    pwSound.playHintOpen(isMuted);
    setStageState('HINT_REVEALING');
    setUnlockedHintLevels((prev) => [...prev, tierNumber].sort());

    if (playMode === 'TEAM_ARENA' && teams.length > 0) {
      setTeams((prev) =>
        prev.map((t, idx) =>
          idx === activeTeamIndex ? { ...t, hintsUsedTotal: t.hintsUsedTotal + 1 } : t
        )
      );
    }
  };

  const handleTeacherRevealAnswer = () => {
    setIsTimerRunning(false);
    setTeacherRevealedFullAnswer(true);
    setStageState('SCORING');
    pwSound.playHintOpen(isMuted);
    setRoundFeedback({
      isCorrect: false,
      headline: `GIÁO VIÊN TIẾT LỘ ĐÁP ÁN: ${currentPuzzle.originalAnswer} (0 điểm)`,
      explanation: `${currentPuzzle.visualConnectionExplanation} (Lưu ý: Vì đáp án đã được tiết lộ toàn bộ nên câu đố này không tính điểm tự giải).`,
    });
  };

  const handleCheckAnswer = () => {
    if (stageState === 'CHECKING' || stageState === 'SCORING' || stageState === 'FINISHED') {
      return;
    }

    setStageState('CHECKING');

    let userSubmittedRaw = '';
    if (playMode === 'LETTER_TILES') {
      userSubmittedRaw = slotAssignments.map((s) => (s ? s.char : '')).join('');
    } else {
      userSubmittedRaw = classicTextInput.trim();
    }

    if (!userSubmittedRaw) {
      setStageState('ANSWERING');
      return;
    }

    const expectedCandidates = [
      currentPuzzle.originalAnswer,
      ...currentPuzzle.acceptedAnswers,
    ];

    const normalizedSubmittedNoSpace = normalizeVietnameseAnswer(
      userSubmittedRaw,
      acceptUnaccentedVietnamese
    ).replace(/\s+/g, '');

    const isMatched = expectedCandidates.some((cand) => {
      const normCand = normalizeVietnameseAnswer(
        cand,
        acceptUnaccentedVietnamese
      ).replace(/\s+/g, '');
      return normCand === normalizedSubmittedNoSpace;
    });

    if (isMatched) {
      setIsTimerRunning(false);
      pwSound.playCorrect(isMuted);

      const alreadyScored = scoredPuzzleIds.includes(currentPuzzle.id);
      const earnedPts = teacherRevealedFullAnswer ? 0 : currentPotentialPoints;

      if (!alreadyScored && !teacherRevealedFullAnswer) {
        setScoredPuzzleIds((prev) => [...prev, currentPuzzle.id]);

        if (playMode === 'TEAM_ARENA' && teams.length > 0) {
          const currentTeam = teams[activeTeamIndex];
          setTeams((prev) =>
            prev.map((t, idx) =>
              idx === activeTeamIndex
                ? {
                    ...t,
                    score: t.score + earnedPts,
                    correctCount: t.correctCount + 1,
                  }
                : t
            )
          );
          setScoreLogs((prev) => [
            {
              id: `pw-log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              puzzleIndex: currentPuzzleIndex + 1,
              targetName: currentTeam.name,
              teamId: currentTeam.id,
              deltaPoints: earnedPts,
              reason: `Giải đúng "${currentPuzzle.originalAnswer}" (${unlockedHintLevels.length} gợi ý · +${earnedPts}đ)`,
            },
            ...prev,
          ]);
        } else {
          setIndividualScore((prev) => prev + earnedPts);
          setScoreLogs((prev) => [
            {
              id: `pw-log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              puzzleIndex: currentPuzzleIndex + 1,
              targetName: calledStudent ? calledStudent.fullName : 'Cả lớp / Cá nhân',
              deltaPoints: earnedPts,
              reason: `Giải đúng "${currentPuzzle.originalAnswer}" (${unlockedHintLevels.length} gợi ý · +${earnedPts}đ)`,
            },
            ...prev,
          ]);
        }
      }

      setRoundFeedback({
        isCorrect: true,
        headline: `CHÍNH XÁC! TỪ KHÓA LÀ: "${currentPuzzle.originalAnswer}" (+${earnedPts} điểm)`,
        explanation: currentPuzzle.visualConnectionExplanation,
      });
      setStageState('SCORING');
    } else {
      pwSound.playWrong(isMuted);
      setRoundFeedback({
        isCorrect: false,
        headline: 'CHƯA CHÍNH XÁC! HÃY QUAN SÁT KỸ CÁC HÌNH GỢI Ý HOẶC MỞ THÊM GỢI Ý.',
        explanation:
          'Mẹo: Hãy tìm từ đại diện cho từng hình rồi ghép lại theo thứ tự từ trái sang phải.',
      });
      setStageState('ANSWERING');
      if (playMode === 'TEAM_ARENA' && teams.length > 1) {
        setActiveTeamIndex((prev) => (prev + 1) % teams.length);
      }
    }
  };

  // Persist session to Supabase public.audit_logs
  const persistSessionToSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      await supabase.from('audit_logs').insert({
        actor_id: teacherId,
        actor_role: 'teacher',
        action_type: 'EDU_GAME_SESSION_COMPLETED',
        entity_type: 'edu_game_b06',
        entity_id: `B06_${Date.now()}`,
        metadata: {
          game_id: 'B06',
          game_title: 'Đuổi hình bắt chữ (EDU Picture Word Challenge 1.0)',
          play_mode: playMode,
          class_name: resolvedClassName,
          teacher_name: teacherName,
          total_puzzles: allPuzzles.length,
          solved_puzzles_count: scoredPuzzleIds.length,
          individual_score: individualScore,
          teams_summary: teams.map((t) => ({
            name: t.name,
            score: t.score,
            correctCount: t.correctCount,
            hintsUsedTotal: t.hintsUsedTotal,
          })),
          score_logs: scoreLogs.slice(0, 20),
          started_at: sessionStartIsoRef.current,
          completed_at: new Date().toISOString(),
        },
      });
    } catch {
      // Ignore network/RLS errors gracefully
    }
  }, [
    teacherId,
    playMode,
    resolvedClassName,
    teacherName,
    allPuzzles.length,
    scoredPuzzleIds.length,
    individualScore,
    teams,
    scoreLogs,
  ]);

  const handleNextPuzzle = () => {
    if (currentPuzzleIndex + 1 >= allPuzzles.length) {
      setIsTimerRunning(false);
      setStageState('FINISHED');
      pwSound.playVictory(isMuted);
      persistSessionToSupabase();
      return;
    }
    if (playMode === 'TEAM_ARENA' && teams.length > 1) {
      setActiveTeamIndex((prev) => (prev + 1) % teams.length);
    }
    setStageState('NEXT_PUZZLE');
    setCurrentPuzzleIndex((prev) => prev + 1);
  };

  const handleUndoLastScore = () => {
    if (scoreLogs.length === 0) return;
    const [latest, ...rest] = scoreLogs;
    setScoreLogs(rest);
    if (latest.teamId) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === latest.teamId ? { ...t, score: Math.max(0, t.score - latest.deltaPoints) } : t
        )
      );
    } else {
      setIndividualScore((prev) => Math.max(0, prev - latest.deltaPoints));
    }
  };

  // ============================================================================
  // LESSON BUILDER & SAFE IMAGE UPLOAD HANDLERS (SECTION VI & VII)
  // ============================================================================

  const suggestedLessonKeywords = useMemo(() => {
    const suggestions: Array<{ keyword: string; context: string }> = [];
    questions
      .filter((q) => {
        if (q.status !== 'approved' && userRole !== 'admin' && userRole !== 'reviewer') {
          return false;
        }
        if (String(q.grade) !== String(builderGrade)) return false;
        if (builderSubject !== 'general' && q.subject !== builderSubject) return false;
        return true;
      })
      .forEach((q) => {
        if (q.type === 'short_answer' && q.acceptedAnswers?.[0]) {
          suggestions.push({
            keyword: q.acceptedAnswers[0].toUpperCase(),
            context: q.stem,
          });
        } else if (q.type === 'single_choice' && q.options && q.correctAnswer) {
          const opt = q.options.find(
            (o) => o.label === q.correctAnswer || o.id === q.correctAnswer
          );
          if (opt && opt.text.trim().length <= 18) {
            suggestions.push({
              keyword: opt.text.trim().toUpperCase(),
              context: q.stem,
            });
          }
        }
      });
    return suggestions.slice(0, 8);
  }, [questions, userRole, builderGrade, builderSubject]);

  const handleUploadImageForPanel = (panelIdx: number, file: File | null) => {
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setBuilderNotice('Chỉ hỗ trợ định dạng ảnh an toàn: PNG, JPG hoặc WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setBuilderNotice('Kích thước ảnh tải lên không được vượt quá 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        setBuilderPanels((prev) =>
          prev.map((p, idx) =>
            idx === panelIdx
              ? { ...p, artType: 'uploaded_image', imageUrl: dataUrl }
              : p
          )
        );
        setBuilderNotice('Đã tải ảnh minh họa thành công!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomPuzzle = () => {
    const cleanAns = builderKeyword.trim().toUpperCase();
    if (cleanAns.length < 2) {
      setBuilderNotice('Vui lòng nhập từ khóa đáp án có ít nhất 2 ký tự.');
      return;
    }
    if (!builderExplanation.trim()) {
      setBuilderNotice('Vui lòng nhập lời giải thích mối liên hệ giữa hình gợi ý và từ khóa.');
      return;
    }

    const newPuzzle: PictureWordPuzzleItem = {
      id: `b06-custom-${Date.now()}`,
      title: builderTitle.trim() || `Câu đố: ${cleanAns}`,
      subject: builderSubject,
      grade: builderGrade,
      chapter: 'Chủ đề bài học',
      lesson: builderLesson || 'Bài học tự chọn',
      originalAnswer: cleanAns,
      acceptedAnswers: [cleanAns, normalizeVietnameseAnswer(cleanAns, true)],
      visualPanels: builderPanels,
      hints: [builderHint1, builderHint2, builderHint3],
      visualConnectionExplanation: builderExplanation.trim(),
      source: 'custom',
      authorId: teacherId,
      createdAt: new Date().toISOString(),
    };

    const updated = [newPuzzle, ...customPuzzles];
    setCustomPuzzles(updated);
    try {
      localStorage.setItem(STORAGE_CUSTOM_PUZZLES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota
    }
    setBuilderNotice(`Đã lưu câu đố "${newPuzzle.originalAnswer}" vào bộ câu đố của lớp!`);
    setCurrentPuzzleIndex(0);
    setPlayMode('LETTER_TILES');
  };

  // ============================================================================
  // RENDER UI
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* TOP BAR */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-700/80 p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Game Identity & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5 pr-3 border-r border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-purple-600 flex items-center justify-center text-slate-950 font-black shadow-md">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 tracking-wider">
                    B06 · KHỞI ĐỘNG
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-sky-300 font-semibold">{resolvedClassName}</span>
                </div>
                <h2 className="text-base font-black tracking-tight text-white">
                  Đuổi Hình Bắt Chữ – EDU Picture Word Challenge
                </h2>
              </div>
            </div>

            {/* 4 Segmented Mode Buttons */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setPlayMode('CLASSIC_GUESS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playMode === 'CLASSIC_GUESS'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                1. Cổ điển (Nhập từ khóa)
              </button>
              <button
                type="button"
                onClick={() => setPlayMode('LETTER_TILES')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playMode === 'LETTER_TILES'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                2. Ghép chữ giải mã
              </button>
              <button
                type="button"
                onClick={() => setPlayMode('TEAM_ARENA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playMode === 'TEAM_ARENA'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                3. Thi đấu theo đội
              </button>
              <button
                type="button"
                onClick={() => setPlayMode('LESSON_BUILDER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playMode === 'LESSON_BUILDER'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                + Tạo câu đố từ bài học
              </button>
            </div>
          </div>

          {/* Right: Puzzle Selector & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {playMode !== 'LESSON_BUILDER' && (
              <select
                value={currentPuzzleIndex}
                onChange={(e) => setCurrentPuzzleIndex(Number(e.target.value))}
                aria-label="Chọn câu đố hình ảnh"
                className="bg-slate-800 border border-slate-600 text-white text-xs font-bold rounded-xl px-3 py-2 max-w-[240px] truncate"
              >
                {allPuzzles.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    Câu #{idx + 1}: {p.title}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={onToggleMute}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            {onOpenAbsentModal && (
              <button
                type="button"
                onClick={onOpenAbsentModal}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5 text-sky-400" />
                Có mặt ({presentStudents.length})
              </button>
            )}

            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* LESSON BUILDER MODE (TẠO CÂU ĐỐ TỪ BÀI HỌC & QUẢN LÝ HÌNH ẢNH)       */}
      {/* ==================================================================== */}
      {playMode === 'LESSON_BUILDER' ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                Tạo Câu Đố Đuổi Hình Bắt Chữ Từ Bài Học & Quản Lý Hình Minh Họa
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Đề xuất thuật ngữ từ Ngân hàng câu hỏi Smart EDU, ghép 1–3 hình minh họa SVG hoặc tải ảnh PNG/JPG/WebP từ máy tính.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveCustomPuzzle}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-4 h-4" />
              Duyệt & Lưu câu đố
            </button>
          </div>

          {builderNotice && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-900 flex items-center justify-between">
              <span>{builderNotice}</span>
              <button
                type="button"
                onClick={() => setBuilderNotice(null)}
                className="font-bold text-blue-700 hover:underline"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Row 1: Metadata & Suggested Keywords from Question Bank */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
              <select
                value={builderGrade}
                onChange={(e) => setBuilderGrade(e.target.value as Grade)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
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
                value={builderSubject}
                onChange={(e) => setBuilderSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
              >
                {Object.entries(SUBJECT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Từ khóa đáp án (Tiếng Việt có dấu)
              </label>
              <input
                type="text"
                value={builderKeyword}
                onChange={(e) => setBuilderKeyword(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề câu đố</label>
              <input
                type="text"
                value={builderTitle}
                onChange={(e) => setBuilderTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900"
              />
            </div>
          </div>

          {/* Suggested Keywords from Smart EDU Bank */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-800">
              Đề xuất thuật ngữ / khái niệm từ Ngân hàng câu hỏi ({suggestedLessonKeywords.length} gợi ý):
            </div>
            {suggestedLessonKeywords.length === 0 ? (
              <p className="text-xs text-slate-500">
                Chưa có câu trả lời ngắn khớp bộ lọc hiện tại. Giáo viên có thể nhập trực tiếp từ khóa bài học ở ô phía trên (Lưu ý: Nếu từ khóa trừu tượng khó biểu diễn trực quan bằng hình ảnh, hãy ưu tiên chọn các danh từ/khái niệm ghép từ 2–3 tiếng).
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {suggestedLessonKeywords.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBuilderKeyword(item.keyword)}
                    className="px-3 py-1 rounded-lg bg-white border border-slate-300 hover:border-blue-500 text-xs font-bold text-slate-800"
                  >
                    {item.keyword}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Visual Clue Panels Editor (1-3 Panels) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900">
                Thiết lập 1–3 Hình Gợi Ý Minh Họa
              </h4>
              <div className="flex items-center gap-2">
                {builderPanels.length < 3 && (
                  <button
                    type="button"
                    onClick={() =>
                      setBuilderPanels((prev) => [
                        ...prev,
                        {
                          id: `bp-${Date.now()}`,
                          caption: `Hình gợi ý #${prev.length + 1}`,
                          artType: 'builtin_svg',
                          builtinKey: 'SUN_LIGHT',
                        },
                      ])
                    }
                    className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold"
                  >
                    + Thêm hình thứ {builderPanels.length + 1}
                  </button>
                )}
                {builderPanels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBuilderPanels((prev) => prev.slice(0, prev.length - 1))}
                    className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold"
                  >
                    - Bớt 1 hình
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {builderPanels.map((panel, idx) => (
                <div
                  key={panel.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
                >
                  <div className="text-xs font-black text-slate-800">
                    Khung hình gợi ý #{idx + 1}
                  </div>
                  <div className="h-32 rounded-xl overflow-hidden bg-slate-900 border border-slate-300 flex items-center justify-center">
                    {panel.artType === 'uploaded_image' && panel.imageUrl ? (
                      <img
                        src={panel.imageUrl}
                        alt={panel.caption}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <VisualClueSvgArtwork artKey={panel.builtinKey || 'FIRE_THERMAL'} />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Chọn hình SVG minh họa có sẵn:
                    </label>
                    <select
                      value={panel.builtinKey || 'FIRE_THERMAL'}
                      onChange={(e) =>
                        setBuilderPanels((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? {
                                  ...p,
                                  artType: 'builtin_svg',
                                  builtinKey: e.target.value as BuiltinVisualArtKey,
                                }
                              : p
                          )
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white"
                    >
                      <option value="FIRE_THERMAL">Ngọn lửa / Nhiệt lượng</option>
                      <option value="RULER_DEGREE">Thước đo góc / Độ (°)</option>
                      <option value="MOUSE_ANIMAL">Con chuột</option>
                      <option value="COMPUTER_SCREEN">Màn hình máy tính</option>
                      <option value="SUN_LIGHT">Ánh sáng mặt trời (Quang)</option>
                      <option value="LEAF_CHLOROPHYLL">Chiếc lá xanh (Hợp)</option>
                      <option value="TRIANGLE_3">Hình tam giác (3 cạnh)</option>
                      <option value="RIGHT_ANGLE_90">Góc vuông 90°</option>
                      <option value="COMPASS_WEST">La bàn chỉ hướng Tây</option>
                      <option value="CAPITAL_CITY">Đô thị / Kinh đô</option>
                      <option value="WATER_DROP">Giọt nước lỏng</option>
                      <option value="VAPOR_CLOUD">Hơi nước bay lên</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Hoặc tải ảnh từ máy tính (PNG/JPG/WebP ≤ 2MB):
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        handleUploadImageForPanel(idx, e.target.files?.[0] || null)
                      }
                      className="w-full text-[11px] text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Chú thích dưới hình:
                    </label>
                    <input
                      type="text"
                      value={panel.caption}
                      onChange={(e) =>
                        setBuilderPanels((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, caption: e.target.value } : p
                          )
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hints & Visual Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                3 cấp độ gợi ý của câu đố
              </label>
              <input
                type="text"
                value={builderHint1}
                onChange={(e) => setBuilderHint1(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                value={builderHint2}
                onChange={(e) => setBuilderHint2(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                value={builderHint3}
                onChange={(e) => setBuilderHint3(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Giải thích mối liên hệ giữa hình ảnh và từ khóa (bắt buộc)
              </label>
              <textarea
                rows={4}
                value={builderExplanation}
                onChange={(e) => setBuilderExplanation(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900"
              />
            </div>
          </div>
        </div>
      ) : (
        /* ==================================================================== */
        /* MAIN PICTURE WORD STAGE (65-70% LEFT) & SCOREBOARD (30-35% RIGHT)    */
        /* ==================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT 8 COLUMNS: VISUAL CLUES, LETTER SLOTS & HINTS STAGE */}
          <div className="lg:col-span-8 bg-gradient-to-b from-[#071126] via-[#111E3B] to-[#1E1B4B] rounded-2xl border border-sky-500/30 p-5 sm:p-6 text-white flex flex-col justify-between relative overflow-hidden shadow-xl min-h-[600px]">
            {/* Top Stage Header: Puzzle Progress & Timer Controls */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <span>
                    CÂU ĐỐ {currentPuzzleIndex + 1} / {allPuzzles.length}
                  </span>
                  <span>·</span>
                  <span>
                    {SUBJECT_LABELS[currentPuzzle.subject] || currentPuzzle.subject} (Khối{' '}
                    {currentPuzzle.grade})
                  </span>
                  <span>·</span>
                  <span className="text-teal-300">
                    Điểm hiện tại của câu: +{currentPotentialPoints}đ
                  </span>
                </div>
                <h3 className="text-base font-black text-white mt-0.5">
                  {currentPuzzle.title}
                </h3>
              </div>

              {/* Timer & Pause/Resume/Preset Controls */}
              <div className="flex items-center gap-2">
                <select
                  value={configuredTimeSec}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setConfiguredTimeSec(v);
                    setTimeLeftSec(v);
                  }}
                  aria-label="Thời gian đồng hồ"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200"
                >
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsTimerRunning((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1"
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Tạm dừng
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Tiếp tục
                    </>
                  )}
                </button>

                <div
                  className={`px-3.5 py-1.5 rounded-xl border-2 font-mono font-black text-sm tabular-nums ${
                    timeLeftSec <= 5
                      ? 'bg-rose-950 border-rose-400 text-rose-300'
                      : 'bg-slate-900 border-amber-400 text-amber-300'
                  }`}
                >
                  {timeLeftSec}s
                </div>
              </div>
            </div>

            {stageState === 'FINISHED' ? (
              <div className="relative z-10 my-auto py-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center mx-auto">
                  <Trophy className="w-9 h-9" />
                </div>
                <h3 className="text-2xl font-black text-white">
                  HOÀN THÀNH THỬ THÁCH ĐUỔI HÌNH BẮT CHỮ!
                </h3>
                <p className="text-sm text-slate-300">
                  Đã giải mã {scoredPuzzleIds.length}/{allPuzzles.length} câu đố hình ảnh.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPuzzleIndex(0);
                    setScoredPuzzleIds([]);
                    setIndividualScore(0);
                    setTeams(buildTeams(teamCount));
                    initPuzzleRoundState(targetAnswerLetters);
                  }}
                  className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-lg"
                >
                  Chơi lại từ đầu
                </button>
              </div>
            ) : (
              /* ============================================================== */
              /* VISUAL CLUE PANELS + ANSWER AREA + 3-TIER HINTS                */
              /* ============================================================== */
              <div className="relative z-10 my-4 space-y-5">
                {/* 1 to 3 Visual Clue Cards with "+" Connectors */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {currentPuzzle.visualPanels.map((panel, idx) => (
                    <React.Fragment key={panel.id}>
                      {idx > 0 && (
                        <div className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                          +
                        </div>
                      )}
                      <div className="flex-1 w-full bg-slate-900/95 border-2 border-sky-400/40 rounded-2xl p-3 shadow-lg flex flex-col items-center">
                        <div className="w-full h-36 sm:h-44 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
                          {panel.artType === 'uploaded_image' && panel.imageUrl ? (
                            <img
                              src={panel.imageUrl}
                              alt={panel.caption}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <VisualClueSvgArtwork
                              artKey={panel.builtinKey || 'FIRE_THERMAL'}
                            />
                          )}
                        </div>
                        <div className="mt-2 text-xs font-bold text-sky-200 text-center">
                          {panel.caption}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {/* MODE 2: LETTER TILES SLOTS & SCRAMBLED TRAY */}
                {playMode === 'LETTER_TILES' ? (
                  <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-amber-300">
                        Ô ghép chữ giải mã ({targetAnswerLetters.length} chữ cái ·{' '}
                        {useDiacriticTiles
                          ? 'Chế độ chữ có dấu'
                          : 'Chế độ chữ không dấu chuẩn hóa Đ → D'}
                        ):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setUseDiacriticTiles((prev) => !prev)}
                          className="text-sky-300 hover:underline font-bold"
                        >
                          Đổi sang {useDiacriticTiles ? 'Không dấu (A–Z)' : 'Có dấu tiếng Việt'}
                        </button>
                        <button
                          type="button"
                          onClick={handleBackspaceSlot}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1"
                        >
                          <Delete className="w-3.5 h-3.5" /> Xóa 1 chữ
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllSlots}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold"
                        >
                          Xóa hết
                        </button>
                      </div>
                    </div>

                    {/* Target Answer Slots */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {slotAssignments.map((assigned, sIdx) => (
                        <div
                          key={sIdx}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedTileId) handleDropTileOnSlot(sIdx, draggedTileId);
                          }}
                          onClick={() => {
                            if (assigned) handleRemoveSlotTile(sIdx);
                          }}
                          className={`w-11 h-12 sm:w-12 sm:h-14 rounded-xl border-2 flex items-center justify-center text-lg sm:text-xl font-mono font-black cursor-pointer transition-all select-none ${
                            stageState === 'SCORING' && roundFeedback?.isCorrect
                              ? 'bg-emerald-500 border-emerald-200 text-slate-950 shadow-md'
                              : assigned
                              ? 'bg-amber-400 border-white text-slate-950 shadow-md'
                              : 'bg-slate-950 border-dashed border-sky-400/60 text-slate-500'
                          }`}
                          title={assigned ? 'Nhấn để trả chữ về khay' : 'Kéo thả hoặc nhấn chọn chữ'}
                        >
                          {assigned ? assigned.char : ''}
                        </div>
                      ))}
                    </div>

                    {/* Scrambled Letter Tiles Tray */}
                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-[11px] text-slate-400 mb-2 text-center">
                        Khay chữ cái xáo trộn (Nhấn chọn hoặc kéo thả vào ô trống phía trên):
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {scrambledTray.map((tile) => {
                          const isUsed = usedTileIds.has(tile.tileId);
                          return (
                            <button
                              key={tile.tileId}
                              type="button"
                              draggable={!isUsed && stageState !== 'SCORING'}
                              onDragStart={() => setDraggedTileId(tile.tileId)}
                              onClick={() => handleClickTrayTile(tile)}
                              disabled={isUsed || stageState === 'SCORING'}
                              className={`w-10 h-11 rounded-xl font-mono font-black text-base border transition-all ${
                                isUsed
                                  ? 'bg-slate-900 border-slate-800 text-slate-700 opacity-35 cursor-not-allowed'
                                  : 'bg-slate-800 hover:bg-sky-500 hover:text-slate-950 border-sky-400/50 text-white shadow-sm'
                              }`}
                            >
                              {tile.char}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* MODE 1 & MODE 3: DIRECT VIETNAMESE KEYWORD INPUT */
                  <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-amber-300">
                        Nhập từ khóa đáp án ({currentPuzzle.originalAnswer.replace(/\s+/g, '').length} chữ cái):
                      </span>
                      <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acceptUnaccentedVietnamese}
                          onChange={(e) => setAcceptUnaccentedVietnamese(e.target.checked)}
                          className="rounded"
                        />
                        Chấp nhận cả nhập tiếng Việt không dấu
                      </label>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={classicTextInput}
                        onChange={(e) => {
                          setClassicTextInput(e.target.value);
                          setStageState('ANSWERING');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCheckAnswer();
                        }}
                        disabled={stageState === 'SCORING'}
                        placeholder="Nhập từ khóa suy luận từ hình ảnh..."
                        className="flex-1 rounded-xl bg-slate-950 border border-slate-600 px-4 py-2.5 text-base font-black text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={handleCheckAnswer}
                        disabled={stageState === 'SCORING'}
                        className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs whitespace-nowrap"
                      >
                        Kiểm tra đáp án
                      </button>
                    </div>
                  </div>
                )}

                {/* 3-TIER HINT BAR */}
                <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      Hệ thống Gợi ý 3 cấp (Không gợi ý: +{scoreTier0Hint}đ · Cấp 1: +{scoreTier1Hint}đ · Cấp 2: +{scoreTier2Hint}đ · Cấp 3: +{scoreTier3Hint}đ)
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {([1, 2, 3] as const).map((lvl) => {
                        const isOpened = unlockedHintLevels.includes(lvl);
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => handleUnlockHintTier(lvl)}
                            disabled={isOpened || stageState === 'SCORING'}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                              isOpened
                                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                            }`}
                          >
                            {isOpened ? `Đã mở Gợi ý ${lvl}` : `Mở Gợi ý ${lvl}`}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={handleTeacherRevealAnswer}
                        disabled={stageState === 'SCORING'}
                        className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-xs font-bold text-rose-200"
                      >
                        Tiết lộ đáp án (0đ)
                      </button>
                    </div>
                  </div>

                  {unlockedHintLevels.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-800">
                      {unlockedHintLevels.map((lvl) => (
                        <div key={lvl} className="text-xs text-amber-200 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{currentPuzzle.hints[lvl - 1]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BOTTOM BAR: VISUAL CONNECTION EXPLANATION & ACTION BUTTONS */}
            {stageState !== 'FINISHED' && (
              <div className="relative z-10 space-y-3 pt-3 border-t border-slate-800">
                {roundFeedback && (
                  <div
                    className={`p-4 rounded-xl border ${
                      roundFeedback.isCorrect
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100'
                        : 'bg-rose-950/90 border-rose-400 text-rose-100'
                    }`}
                  >
                    <div className="font-black text-sm flex items-center gap-2">
                      {roundFeedback.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span>{roundFeedback.headline}</span>
                    </div>
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                      <strong>Giải thích mối liên hệ hình – chữ:</strong> {roundFeedback.explanation}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {playMode === 'LETTER_TILES' && (
                    <button
                      type="button"
                      onClick={handleCheckAnswer}
                      disabled={stageState === 'SCORING'}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs shadow-md"
                    >
                      Kiểm tra chữ đã ghép (+{currentPotentialPoints}đ)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleNextPuzzle}
                    className="ml-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <SkipForward className="w-4 h-4" />
                    {currentPuzzleIndex + 1 >= allPuzzles.length
                      ? 'Kết thúc & Xem tổng kết'
                      : 'Câu đố tiếp theo'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT 4 COLUMNS: SCOREBOARD, TEAM ARENA & SCORING LOG */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  {playMode === 'TEAM_ARENA'
                    ? 'Bảng Xếp Hạng Đội Đuổi Hình'
                    : 'Người Trả Lời & Bảng Điểm'}
                </h4>
                {scoreLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoLastScore}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Hoàn tác
                  </button>
                )}
              </div>

              {playMode === 'TEAM_ARENA' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">Số đội thi đấu:</span>
                    <div className="flex items-center gap-1">
                      {[2, 3, 4].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTeamCount(cnt)}
                          className={`px-2.5 py-1 rounded-lg font-bold ${
                            teamCount === cnt
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          {cnt} đội
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {teams.map((t, idx) => {
                      const isTurn = idx === activeTeamIndex;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setActiveTeamIndex(idx)}
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
                              <div className="text-xs font-black text-slate-900">
                                {t.name}{' '}
                                {isTurn && (
                                  <span className="text-[10px] font-bold text-purple-700">
                                    · Đang tới lượt
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Giải đúng: {t.correctCount} · Dùng gợi ý: {t.hintsUsedTotal} ·{' '}
                                {t.members.length} HS
                              </div>
                            </div>
                          </div>
                          <div className="text-base font-mono font-black text-slate-900 tabular-nums">
                            {t.score}đ
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="truncate">
                      <span className="text-slate-500">Học sinh trả lời: </span>
                      <span className="font-bold text-slate-900">
                        {calledStudent
                          ? `${calledStudent.fullName} (${calledStudent.code})`
                          : 'Cả lớp cùng đoán'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!presentStudents.length) return;
                        const r = Math.floor(Math.random() * presentStudents.length);
                        setCalledStudent(presentStudents[r]);
                      }}
                      className="text-blue-600 hover:underline font-bold shrink-0 ml-2"
                    >
                      Gọi ngẫu nhiên
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-600">Tổng điểm hiện tại</div>
                      <div className="text-[11px] text-slate-500">
                        Đã giải: {scoredPuzzleIds.length}/{allPuzzles.length} câu đố
                      </div>
                    </div>
                    <div className="text-2xl font-mono font-black text-blue-600 tabular-nums">
                      {individualScore}đ
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SCORING LOG CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Lịch Sử Giải Đố & Dùng Gợi Ý
                </h4>
                {scoreLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4">
                    Chưa có câu đố nào được giải trong phiên này.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {scoreLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            Câu #{log.puzzleIndex} · {log.targetName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{log.reason}</div>
                        </div>
                        <span className="font-mono font-black text-emerald-600 shrink-0 tabular-nums">
                          +{log.deltaPoints}đ
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Đáp án gốc tiếng Việt có dấu luôn được bảo toàn</span>
                <span className="font-bold text-slate-700">B06 v1.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
