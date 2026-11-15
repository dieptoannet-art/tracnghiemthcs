import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question, Grade, CognitiveLevel } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Image as ImageIcon,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Timer as TimerIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Trophy,
  Award,
  EyeOff,
  BookOpen,
  Settings,
  Grid,
  Eye,
  Upload,
  Sparkles,
  Lightbulb,
  Undo2,
  SkipForward,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  HelpCircle,
  Layers,
} from 'lucide-react';

export type MysteryGameState =
  | 'SETUP'
  | 'READY'
  | 'TILE_SELECTED'
  | 'QUESTION'
  | 'ANSWERING'
  | 'JUDGING'
  | 'REVEALING'
  | 'NEXT_TURN'
  | 'FINISHED';

export type MysteryPlayMode = 'TILE_FLIP' | 'BLUR_REVEAL' | 'TEAM_DECODE_ARENA';

export type GridPresetKey = '3x3' | '3x4' | '4x4' | '5x5';

export interface GridPresetConfig {
  key: GridPresetKey;
  label: string;
  rows: number;
  cols: number;
  totalTiles: number;
}

export const GRID_PRESETS: Record<GridPresetKey, GridPresetConfig> = {
  '3x3': { key: '3x3', label: '3×3 (9 ô)', rows: 3, cols: 3, totalTiles: 9 },
  '3x4': { key: '3x4', label: '3×4 (12 ô)', rows: 3, cols: 4, totalTiles: 12 },
  '4x4': { key: '4x4', label: '4×4 (16 ô)', rows: 4, cols: 4, totalTiles: 16 },
  '5x5': { key: '5x5', label: '5×5 (25 ô)', rows: 5, cols: 5, totalTiles: 25 },
};

export interface MysteryPictureAsset {
  id: string;
  title: string;
  subject: string;
  lesson: string;
  imageUrl: string;
  secretAnswer: string;
  acceptedAnswers: string[];
  hints: string[];
  isCustom?: boolean;
}

export interface DecodeTeam {
  id: string;
  name: string;
  colorHex: string;
  members: StudentCandidate[];
  score: number;
  correctAnswers: number;
  guessAttemptsUsed: number;
}

export interface ManualQuestionItem {
  id: string;
  stem: string;
  answer: string;
}

export interface MysteryPictureGameProps {
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

const LEVEL_LABELS: Record<CognitiveLevel, string> = {
  know: 'Nhận biết',
  understand: 'Thông hiểu',
  apply: 'Vận dụng',
};

const TEAM_COLORS = ['#006BFF', '#D97706', '#E11D48', '#7C3AED'];

/**
 * Helper to encode rich educational SVG scenes as reliable data URIs
 */
function createSvgDataUri(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

const BUILTIN_MYSTERY_PICTURES: MysteryPictureAsset[] = [
  {
    id: 'mp_science_solar',
    title: 'Khám phá Vũ trụ & Hệ Mặt Trời',
    subject: 'science',
    lesson: 'Hệ Mặt Trời và Ngân Hà',
    secretAnswer: 'Hệ Mặt Trời',
    acceptedAnswers: ['he mat troi', 'hệ mặt trời', ' thái dương hệ', 'solar system'],
    hints: [
      'Gợi ý 1: Hệ hành tinh có ngôi sao trung tâm phát sáng tự nhiên.',
      'Gợi ý 2: Trái Đất là hành tinh thứ 3 tính từ trung tâm của hệ này.',
      'Gợi ý 3: Bao gồm 8 hành tinh quay quanh Mặt Trời.',
    ],
    imageUrl: createSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
        <defs>
          <radialGradient id="sunGlow" cx="20%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#FEF08A"/>
            <stop offset="35%" stop-color="#F59E0B"/>
            <stop offset="100%" stop-color="#090D16" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="spaceBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#050814"/>
            <stop offset="50%" stop-color="#0F172A"/>
            <stop offset="100%" stop-color="#1E1B4B"/>
          </linearGradient>
        </defs>
        <rect width="800" height="450" fill="url(#spaceBg)"/>
        <circle cx="140" cy="225" r="240" fill="url(#sunGlow)"/>
        <circle cx="110" cy="225" r="78" fill="#FACC15" stroke="#FEF08A" stroke-width="6"/>
        <ellipse cx="110" cy="225" rx="165" ry="95" fill="none" stroke="#38BDF8" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="6 6"/>
        <ellipse cx="110" cy="225" rx="255" ry="140" fill="none" stroke="#38BDF8" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="6 6"/>
        <ellipse cx="110" cy="225" rx="365" ry="185" fill="none" stroke="#38BDF8" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="6 6"/>
        <ellipse cx="110" cy="225" rx="495" ry="215" fill="none" stroke="#38BDF8" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="6 6"/>
        <ellipse cx="110" cy="225" rx="625" ry="235" fill="none" stroke="#38BDF8" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="6 6"/>
        <circle cx="268" cy="195" r="14" fill="#94A3B8"/>
        <circle cx="355" cy="168" r="22" fill="#F59E0B"/>
        <g transform="translate(465, 255)">
          <circle r="28" fill="#2563EB" stroke="#93C5FD" stroke-width="3"/>
          <path d="M-14 -10 Q0 -20 12 -4 Q20 10 4 18 Q-12 12 -14 -10 Z" fill="#10B981"/>
        </g>
        <circle cx="578" cy="145" r="20" fill="#EF4444"/>
        <g transform="translate(685, 235)">
          <ellipse rx="58" ry="16" fill="none" stroke="#FDE047" stroke-width="7" transform="rotate(-18)"/>
          <circle r="34" fill="#D97706"/>
        </g>
      </svg>
    `),
  },
  {
    id: 'mp_math_pythagoras',
    title: 'Định lý Hình học Bất hủ',
    subject: 'math',
    lesson: 'Định lý Pythagore trong tam giác vuông',
    secretAnswer: 'Định lý Pythagore',
    acceptedAnswers: ['dinh ly pythagore', 'pythagore', 'pitago', 'định lý pitago', 'dinh ly pitago'],
    hints: [
      'Gợi ý 1: Một định lý nổi tiếng áp dụng cho tam giác vuông.',
      'Gợi ý 2: Liên hệ giữa bình phương cạnh huyền và tổng bình phương hai cạnh góc vuông.',
      'Gợi ý 3: Công thức quen thuộc: a² + b² = c².',
    ],
    imageUrl: createSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
        <rect width="800" height="450" fill="#0F172A"/>
        <g stroke="#1E293B" stroke-width="1">
          <line x1="0" y1="90" x2="800" y2="90"/><line x1="0" y1="180" x2="800" y2="180"/>
          <line x1="0" y1="270" x2="800" y2="270"/><line x1="0" y1="360" x2="800" y2="360"/>
          <line x1="160" y1="0" x2="160" y2="450"/><line x1="320" y1="0" x2="320" y2="450"/>
          <line x1="480" y1="0" x2="480" y2="450"/><line x1="640" y1="0" x2="640" y2="450"/>
        </g>
        <!-- Square a^2 -->
        <rect x="210" y="170" width="110" height="110" fill="#3B82F6" fill-opacity="0.35" stroke="#60A5FA" stroke-width="4"/>
        <text x="265" y="232" text-anchor="middle" fill="#DBEAFE" font-size="32" font-weight="900">a²</text>
        <!-- Square b^2 -->
        <rect x="320" y="280" width="150" height="150" fill="#10B981" fill-opacity="0.35" stroke="#34D399" stroke-width="4"/>
        <text x="395" y="365" text-anchor="middle" fill="#D1FAE5" font-size="34" font-weight="900">b²</text>
        <!-- Right Triangle -->
        <polygon points="320,170 320,280 470,280" fill="#FACC15" fill-opacity="0.9" stroke="#FEF08A" stroke-width="4"/>
        <rect x="320" y="262" width="18" height="18" fill="none" stroke="#0F172A" stroke-width="3"/>
        <!-- Square c^2 on hypotenuse -->
        <polygon points="320,170 470,280 580,130 430,20" fill="#EC4899" fill-opacity="0.35" stroke="#F472B6" stroke-width="4"/>
        <text x="455" y="155" text-anchor="middle" fill="#FCE7F3" font-size="38" font-weight="900">c²</text>
        <text x="640" y="245" text-anchor="middle" fill="#FDE047" font-size="34" font-weight="900">a² + b² = c²</text>
      </svg>
    `),
  },
  {
    id: 'mp_geo_cairang',
    title: 'Nét văn hóa đặc trưng Tây Đô Cần Thơ',
    subject: 'history_geo',
    lesson: 'Vùng Đồng bằng sông Cửu Long',
    secretAnswer: 'Chợ nổi Cái Răng',
    acceptedAnswers: ['cho noi cai rang', 'chợ nổi cái răng', 'cho noi', 'chợ nổi cần thơ'],
    hints: [
      'Gợi ý 1: Di sản văn hóa phi vật thể quốc gia nổi tiếng tại TP. Cần Thơ.',
      'Gợi ý 2: Hoạt động mua bán nông sản, trái cây diễn ra tấp nập trên sông vào sáng sớm.',
      'Gợi ý 3: Các ghe xuồng thường treo nông sản lên cây "bẹo" để giới thiệu hàng hóa.',
    ],
    imageUrl: createSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
        <defs>
          <linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1E3A8A"/>
            <stop offset="50%" stop-color="#F97316"/>
            <stop offset="100%" stop-color="#FDE047"/>
          </linearGradient>
          <linearGradient id="riverWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0284C7"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
        </defs>
        <rect width="800" height="250" fill="url(#dawnSky)"/>
        <circle cx="650" cy="135" r="52" fill="#FEF08A" opacity="0.9"/>
        <rect y="235" width="800" height="215" fill="url(#riverWater)"/>
        <!-- Boats & Cây Bẹo -->
        <g transform="translate(150, 255)">
          <path d="M0 30 L35 65 L185 65 L220 30 Z" fill="#92400E" stroke="#FDE047" stroke-width="3"/>
          <line x1="110" y1="-85" x2="110" y2="30" stroke="#78350F" stroke-width="6"/>
          <circle cx="95" cy="-65" r="14" fill="#FACC15"/>
          <circle cx="125" cy="-55" r="16" fill="#10B981"/>
          <circle cx="55" cy="22" r="18" fill="#EF4444"/>
          <circle cx="90" cy="20" r="18" fill="#F59E0B"/>
          <circle cx="135" cy="22" r="18" fill="#10B981"/>
        </g>
        <g transform="translate(430, 285)">
          <path d="M0 25 L30 58 L195 58 L225 25 Z" fill="#78350F" stroke="#FBBF24" stroke-width="3"/>
          <line x1="115" y1="-90" x2="115" y2="25" stroke="#451A03" stroke-width="6"/>
          <circle cx="115" cy="-70" r="16" fill="#F97316"/>
          <circle cx="70" cy="16" r="16" fill="#FACC15"/>
          <circle cx="110" cy="14" r="18" fill="#EC4899"/>
          <circle cx="150" cy="16" r="16" fill="#22C55E"/>
        </g>
      </svg>
    `),
  },
  {
    id: 'mp_info_network',
    title: 'Kết nối Tri thức Toàn cầu',
    subject: 'informatics',
    lesson: 'Mạng máy tính và Internet',
    secretAnswer: 'Mạng Internet',
    acceptedAnswers: ['mang internet', 'internet', 'mạng máy tính', 'mang may tinh'],
    hints: [
      'Gợi ý 1: Hệ thống thông tin toàn cầu kết nối hàng tỷ thiết bị số.',
      'Gợi ý 2: Sử dụng bộ giao thức truyền thông TCP/IP.',
      'Gợi ý 3: Giúp học sinh truy cập kho học liệu trực tuyến Tây Đô Smart EDU mọi lúc mọi nơi.',
    ],
    imageUrl: createSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
        <rect width="800" height="450" fill="#071126"/>
        <circle cx="400" cy="225" r="135" fill="#0284C7" fill-opacity="0.25" stroke="#38BDF8" stroke-width="4"/>
        <ellipse cx="400" cy="225" rx="68" ry="135" fill="none" stroke="#38BDF8" stroke-width="3"/>
        <ellipse cx="400" cy="225" rx="135" ry="55" fill="none" stroke="#38BDF8" stroke-width="3"/>
        <line x1="265" y1="225" x2="535" y2="225" stroke="#38BDF8" stroke-width="3"/>
        <line x1="400" y1="90" x2="400" y2="360" stroke="#38BDF8" stroke-width="3"/>
        <!-- Connected Nodes -->
        <line x1="290" y1="145" x2="150" y2="95" stroke="#FACC15" stroke-width="3" stroke-dasharray="6 4"/>
        <line x1="510" y1="145" x2="650" y2="95" stroke="#FACC15" stroke-width="3" stroke-dasharray="6 4"/>
        <line x1="290" y1="305" x2="150" y2="355" stroke="#FACC15" stroke-width="3" stroke-dasharray="6 4"/>
        <line x1="510" y1="305" x2="650" y2="355" stroke="#FACC15" stroke-width="3" stroke-dasharray="6 4"/>
        <circle cx="150" cy="95" r="28" fill="#1E293B" stroke="#FACC15" stroke-width="4"/>
        <circle cx="650" cy="95" r="28" fill="#1E293B" stroke="#FACC15" stroke-width="4"/>
        <circle cx="150" cy="355" r="28" fill="#1E293B" stroke="#34D399" stroke-width="4"/>
        <circle cx="650" cy="355" r="28" fill="#1E293B" stroke="#34D399" stroke-width="4"/>
      </svg>
    `),
  },
];

function normalizeAnswerString(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

function secureRandomInt(max: number): number {
  if (max <= 1) return 0;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const uint32Max = 0xffffffff;
    const limit = uint32Max - (uint32Max % max);
    const buf = new Uint32Array(1);
    let rand = 0;
    do {
      window.crypto.getRandomValues(buf);
      rand = buf[0];
    } while (rand >= limit);
    return rand % max;
  }
  return Math.floor(Math.random() * max);
}

class MysterySoundEngine {
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

  public playTileSelect(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  public playTileOpen(isMuted: boolean) {
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
        osc.stop(start + 0.27);
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
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {}
  }

  public playGrandVictory(isMuted: boolean) {
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
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch {}
  }
}

export const MysteryPictureGame: React.FC<MysteryPictureGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds = new Set(),
  classes = [],
  questions = [],
  selectedSourceKey = '',
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  teacherId = '',
  userRole = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onOpenAbsentModal,
}) => {
  // Primary State Machine: SETUP -> READY -> TILE_SELECTED -> QUESTION -> ANSWERING -> JUDGING -> REVEALING -> NEXT_TURN -> FINISHED
  const [gameState, setGameState] = useState<MysteryGameState>('SETUP');
  const [playMode, setPlayMode] = useState<MysteryPlayMode>('TILE_FLIP');
  const [gridPresetKey, setGridPresetKey] = useState<GridPresetKey>('3x3');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Mystery Picture Library & Custom Upload
  const [customPictures, setCustomPictures] = useState<MysteryPictureAsset[]>(() => {
    try {
      const raw = localStorage.getItem(`taydo_b02_custom_pics_${teacherId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const allPictures = useMemo(
    () => [...customPictures, ...BUILTIN_MYSTERY_PICTURES],
    [customPictures]
  );
  const [selectedPictureId, setSelectedPictureId] = useState<string>(
    BUILTIN_MYSTERY_PICTURES[0].id
  );
  const [previewSecretInSetup, setPreviewSecretInSetup] = useState<boolean>(false);

  // Upload Custom Picture Form State
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadSubject, setUploadSubject] = useState<string>('science');
  const [uploadLesson, setUploadLesson] = useState<string>('');
  const [uploadSecretAnswer, setUploadSecretAnswer] = useState<string>('');
  const [uploadAcceptedSynonyms, setUploadAcceptedSynonyms] = useState<string>('');
  const [uploadHint1, setUploadHint1] = useState<string>('');
  const [uploadHint2, setUploadHint2] = useState<string>('');
  const [uploadDataUrl, setUploadDataUrl] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Question Bank Filter State
  const [filterGrade, setFilterGrade] = useState<string>('ALL');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterChapter, setFilterChapter] = useState<string>('ALL');
  const [filterLesson, setFilterLesson] = useState<string>('ALL');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [freeOpenWithoutQuestions, setFreeOpenWithoutQuestions] = useState<boolean>(false);
  const [manualQuestions, setManualQuestions] = useState<ManualQuestionItem[]>([]);
  const [newManualStem, setNewManualStem] = useState<string>('');
  const [newManualAnswer, setNewManualAnswer] = useState<string>('');

  // Scoring & Blur Rules Configuration
  const [pointsPerTile, setPointsPerTile] = useState<number>(10);
  const [pointsMysterySolved, setPointsMysterySolved] = useState<number>(30);
  const [penaltyWrongGuess, setPenaltyWrongGuess] = useState<number>(0);
  const [maxGuessesPerTeam, setMaxGuessesPerTeam] = useState<number>(3);
  const [questionTimerSec, setQuestionTimerSec] = useState<number>(30);

  // Teams State (2-4 teams)
  const [teamCount, setTeamCount] = useState<number>(3);
  const [teamNames, setTeamNames] = useState<string[]>([
    'Đội Khám Phá 1',
    'Đội Giải Mã 2',
    'Đội Ánh Sáng 3',
    'Đội Trí Tuệ 4',
  ]);
  const [teams, setTeams] = useState<DecodeTeam[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);

  // Active Session Runtime State
  const [sessionId, setSessionId] = useState<string>(
    () => `B02_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  const [startedAt, setStartedAt] = useState<string>('');
  const [openedTileIndices, setOpenedTileIndices] = useState<Set<number>>(new Set());
  const [flippingTileIndex, setFlippingTileIndex] = useState<number | null>(null);
  const [activeTileIndex, setActiveTileIndex] = useState<number | null>(null);
  const [tileQuestionsMap, setTileQuestionsMap] = useState<Record<number, Question>>({});

  // Mode 2 (Progressive Blur Reveal) State
  const [blurStep, setBlurStep] = useState<number>(0);
  const TOTAL_BLUR_STEPS = 8;

  // Question & Timer Runtime
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string>('');
  const [showAnswerExplanation, setShowAnswerExplanation] = useState<boolean>(false);
  const [revealedHintsCount, setRevealedHintsCount] = useState<number>(0);

  // Mystery Picture Guess Input
  const [pictureGuessInput, setPictureGuessInput] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [solvedByTeamName, setSolvedByTeamName] = useState<string | null>(null);

  // Undo Snapshot & Saved Session Recovery
  const [undoSnapshot, setUndoSnapshot] = useState<{
    openedTiles: number[];
    teams: DecodeTeam[];
    currentTurnIndex: number;
    blurStep: number;
    gameState: MysteryGameState;
  } | null>(null);
  const [hasRecoverableSession, setHasRecoverableSession] = useState<boolean>(false);

  const actionLockRef = useRef<boolean>(false);
  const soundEngineRef = useRef<MysterySoundEngine | null>(null);
  if (!soundEngineRef.current) {
    soundEngineRef.current = new MysterySoundEngine();
  }

  const selectedPicture = useMemo(
    () => allPictures.find((p) => p.id === selectedPictureId) || BUILTIN_MYSTERY_PICTURES[0],
    [allPictures, selectedPictureId]
  );

  const gridConfig = GRID_PRESETS[gridPresetKey];

  // Present students in the class
  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((s) => !absentIds.has(s.id));
  }, [allCandidates, availableCandidates, absentIds]);

  // Check if there is a saved in-progress session in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`taydo_b02_active_session_${teacherId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.gameState && parsed.gameState !== 'SETUP' && parsed.gameState !== 'FINISHED') {
          setHasRecoverableSession(true);
        }
      }
    } catch {}
  }, [teacherId]);

  // Approved Questions from Smart EDU Question Bank
  const authorizedQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.status === 'approved') return true;
      if (userRole === 'admin' || userRole === 'reviewer') return true;
      return false;
    });
  }, [questions, userRole]);

  const availableSubjects = useMemo(() => {
    const s = new Set<string>();
    authorizedQuestions
      .filter((q) => filterGrade === 'ALL' || q.grade === filterGrade)
      .forEach((q) => {
        if (q.subject) s.add(q.subject);
      });
    return Array.from(s);
  }, [authorizedQuestions, filterGrade]);

  const availableChapters = useMemo(() => {
    const s = new Set<string>();
    authorizedQuestions
      .filter(
        (q) =>
          (filterGrade === 'ALL' || q.grade === filterGrade) &&
          (filterSubject === 'ALL' || q.subject === filterSubject)
      )
      .forEach((q) => {
        if (q.chapter) s.add(q.chapter);
      });
    return Array.from(s);
  }, [authorizedQuestions, filterGrade, filterSubject]);

  const availableLessons = useMemo(() => {
    const s = new Set<string>();
    authorizedQuestions
      .filter(
        (q) =>
          (filterGrade === 'ALL' || q.grade === filterGrade) &&
          (filterSubject === 'ALL' || q.subject === filterSubject) &&
          (filterChapter === 'ALL' || q.chapter === filterChapter)
      )
      .forEach((q) => {
        if (q.lesson) s.add(q.lesson);
      });
    return Array.from(s);
  }, [authorizedQuestions, filterGrade, filterSubject, filterChapter]);

  const filteredBankQuestions = useMemo(() => {
    return authorizedQuestions.filter((q) => {
      if (filterGrade !== 'ALL' && q.grade !== filterGrade) return false;
      if (filterSubject !== 'ALL' && q.subject !== filterSubject) return false;
      if (filterChapter !== 'ALL' && q.chapter !== filterChapter) return false;
      if (filterLesson !== 'ALL' && q.lesson !== filterLesson) return false;
      if (filterLevel !== 'ALL' && q.level !== filterLevel) return false;
      return true;
    });
  }, [authorizedQuestions, filterGrade, filterSubject, filterChapter, filterLesson, filterLevel]);

  // Combined question pool (filtered bank questions + teacher-added manual questions)
  const combinedQuestionPool = useMemo(() => {
    const convertedManual: Question[] = manualQuestions.map((mq, idx) => ({
      id: mq.id,
      code: `TC-${idx + 1}`,
      grade: '8',
      subject: selectedPicture.subject,
      textbook: 'Kết nối tri thức',
      chapter: 'Câu hỏi bổ sung',
      lesson: selectedPicture.lesson,
      level: 'know',
      type: 'short_answer',
      stem: mq.stem,
      points: pointsPerTile,
      explanation: `Đáp án đúng: ${mq.answer}`,
      status: 'approved',
      author: 'Giáo viên',
      version: 1,
      correctAnswer: mq.answer,
    }));
    return [...filteredBankQuestions, ...convertedManual];
  }, [filteredBankQuestions, manualQuestions, selectedPicture, pointsPerTile]);

  // Countdown timer effect
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          soundEngineRef.current?.playWrong(isMuted);
          setStatusBanner({
            type: 'error',
            text: 'Đã hết thời gian trả lời câu hỏi! Giáo viên hãy xác nhận kết quả.',
          });
          setGameState('JUDGING');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isTimerRunning, isMuted]);

  // Handle Teacher Image File Upload (PNG, JPG, WebP <= 5MB)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Chỉ hỗ trợ định dạng ảnh PNG, JPG hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Dung lượng ảnh tối đa là 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomPicture = () => {
    if (!uploadTitle.trim() || !uploadSecretAnswer.trim() || !uploadDataUrl) {
      setUploadError('Vui lòng nhập tiêu đề, đáp án bí mật và chọn tệp hình ảnh.');
      return;
    }

    const synonyms = uploadAcceptedSynonyms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const newAsset: MysteryPictureAsset = {
      id: `custom_mp_${Date.now()}`,
      title: uploadTitle.trim(),
      subject: uploadSubject,
      lesson: uploadLesson.trim() || 'Bài học tùy chỉnh',
      imageUrl: uploadDataUrl,
      secretAnswer: uploadSecretAnswer.trim(),
      acceptedAnswers: [uploadSecretAnswer.trim(), ...synonyms],
      hints: [uploadHint1.trim(), uploadHint2.trim()].filter(Boolean),
      isCustom: true,
    };

    const nextCustom = [newAsset, ...customPictures];
    setCustomPictures(nextCustom);
    setSelectedPictureId(newAsset.id);
    setShowUploadForm(false);
    setUploadTitle('');
    setUploadSecretAnswer('');
    setUploadAcceptedSynonyms('');
    setUploadHint1('');
    setUploadHint2('');
    setUploadDataUrl('');
    try {
      localStorage.setItem(`taydo_b02_custom_pics_${teacherId}`, JSON.stringify(nextCustom));
    } catch {}
  };

  // Persist session state to localStorage & Supabase audit_logs
  const saveSessionSnapshot = useCallback(
    async (
      stateToSave: MysteryGameState,
      openedSet: Set<number>,
      currentTeams: DecodeTeam[],
      turnIdx: number,
      currentBlurStep: number,
      isCompleted = false
    ) => {
      const payload = {
        sessionId,
        gameState: stateToSave,
        playMode,
        gridPresetKey,
        selectedPictureId,
        openedTiles: Array.from(openedSet),
        teams: currentTeams,
        currentTurnIndex: turnIdx,
        blurStep: currentBlurStep,
        startedAt: startedAt || new Date().toISOString(),
        completedAt: isCompleted ? new Date().toISOString() : null,
      };

      try {
        if (isCompleted) {
          localStorage.removeItem(`taydo_b02_active_session_${teacherId}`);
        } else {
          localStorage.setItem(
            `taydo_b02_active_session_${teacherId}`,
            JSON.stringify(payload)
          );
        }
      } catch {}

      if (!isSupabaseConfigured || !isCompleted) return;
      try {
        await supabase.from('audit_logs').insert({
          actor_id: teacherId || null,
          actor_role: userRole || 'teacher',
          action_type: 'edu_game_b02_session',
          entity_type: 'edu_game_session',
          entity_id: sessionId,
          metadata: {
            game_id: 'B02',
            game_title: 'Đoán hình bí mật (EDU Mystery Picture)',
            class_id: selectedSourceKey || resolvedClassName,
            class_name: resolvedClassName,
            teacher_id: teacherId,
            image_reference: selectedPicture.id,
            question_ids: Object.values(tileQuestionsMap).map((q) => q.id),
            game_settings: {
              playMode,
              gridPresetKey,
              pointsPerTile,
              pointsMysterySolved,
              penaltyWrongGuess,
            },
            opened_tiles: Array.from(openedSet),
            team_scores: currentTeams.map((t) => ({
              id: t.id,
              name: t.name,
              score: t.score,
              correctAnswers: t.correctAnswers,
              guessAttemptsUsed: t.guessAttemptsUsed,
            })),
            current_turn: turnIdx,
            started_at: startedAt,
            completed_at: new Date().toISOString(),
          },
        });
      } catch {}
    },
    [
      sessionId,
      playMode,
      gridPresetKey,
      selectedPictureId,
      startedAt,
      teacherId,
      userRole,
      selectedSourceKey,
      resolvedClassName,
      selectedPicture.id,
      tileQuestionsMap,
      pointsPerTile,
      pointsMysterySolved,
      penaltyWrongGuess,
    ]
  );

  // Restore saved session from localStorage
  const handleRestoreSavedSession = () => {
    try {
      const raw = localStorage.getItem(`taydo_b02_active_session_${teacherId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSessionId(parsed.sessionId || sessionId);
      setPlayMode(parsed.playMode || 'TILE_FLIP');
      setGridPresetKey(parsed.gridPresetKey || '3x3');
      setSelectedPictureId(parsed.selectedPictureId || BUILTIN_MYSTERY_PICTURES[0].id);
      setOpenedTileIndices(new Set(parsed.openedTiles || []));
      setTeams(parsed.teams || []);
      setCurrentTurnIndex(parsed.currentTurnIndex || 0);
      setBlurStep(parsed.blurStep || 0);
      setStartedAt(parsed.startedAt || new Date().toISOString());
      setGameState('READY');
      setHasRecoverableSession(false);
      setStatusBanner({
        type: 'info',
        text: 'Đã khôi phục phiên chơi đang diễn ra!',
      });
    } catch {}
  };

  // Start new game session (SETUP -> READY)
  const handleStartGame = () => {
    const builtTeams: DecodeTeam[] = Array.from({ length: teamCount }, (_, idx) => ({
      id: `team_${idx + 1}`,
      name: teamNames[idx]?.trim() || `Đội ${idx + 1}`,
      colorHex: TEAM_COLORS[idx % TEAM_COLORS.length],
      members: presentStudents.filter((_, sIdx) => sIdx % teamCount === idx),
      score: 0,
      correctAnswers: 0,
      guessAttemptsUsed: 0,
    }));

    const totalTiles = gridConfig.totalTiles;
    const shuffledQ = [...combinedQuestionPool];
    for (let i = shuffledQ.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [shuffledQ[i], shuffledQ[j]] = [shuffledQ[j], shuffledQ[i]];
    }

    const qMap: Record<number, Question> = {};
    if (!freeOpenWithoutQuestions) {
      for (let i = 0; i < totalTiles; i++) {
        if (i < shuffledQ.length) {
          qMap[i] = shuffledQ[i];
        }
      }
    }

    const nowIso = new Date().toISOString();
    setStartedAt(nowIso);
    setTeams(builtTeams);
    setCurrentTurnIndex(0);
    setOpenedTileIndices(new Set());
    setFlippingTileIndex(null);
    setActiveTileIndex(null);
    setTileQuestionsMap(qMap);
    setBlurStep(0);
    setRevealedHintsCount(0);
    setSolvedByTeamName(null);
    setUndoSnapshot(null);
    setPictureGuessInput('');
    setStatusBanner({
      type: 'info',
      text:
        playMode === 'BLUR_REVEAL'
          ? 'Chế độ Hình ảnh hé lộ: Trả lời câu hỏi để giảm độ mờ bức tranh!'
          : `Lượt đầu tiên thuộc về ${builtTeams[0]?.name}. Hãy chọn một ô số trên bức tranh!`,
    });
    actionLockRef.current = false;
    setGameState('READY');
  };

  // Select a tile (READY -> TILE_SELECTED -> QUESTION / ANSWERING)
  const handleSelectTile = (tileIndex: number) => {
    if (actionLockRef.current) return;
    if (openedTileIndices.has(tileIndex)) return;
    if (
      gameState !== 'READY' &&
      gameState !== 'NEXT_TURN' &&
      gameState !== 'SCORED' as unknown as MysteryGameState
    ) {
      if (gameState === 'QUESTION' || gameState === 'ANSWERING' || gameState === 'JUDGING') {
        setStatusBanner({
          type: 'error',
          text: 'Đang xử lý câu hỏi của ô hiện tại! Vui lòng hoàn tất trước khi chọn ô khác.',
        });
        return;
      }
    }

    soundEngineRef.current?.playTileSelect(isMuted);
    setActiveTileIndex(tileIndex);
    setSelectedOptionLabel('');
    setShowAnswerExplanation(false);

    const assignedQ = tileQuestionsMap[tileIndex];
    // If teacher enabled Free Open Mode or tile has no question, reveal tile immediately
    if (freeOpenWithoutQuestions || !assignedQ) {
      setFlippingTileIndex(tileIndex);
      setGameState('REVEALING');
      window.setTimeout(() => {
        const nextOpened = new Set(openedTileIndices);
        nextOpened.add(tileIndex);
        setOpenedTileIndices(nextOpened);
        setFlippingTileIndex(null);
        setActiveTileIndex(null);
        soundEngineRef.current?.playTileOpen(isMuted);
        setGameState('READY');
        saveSessionSnapshot('READY', nextOpened, teams, currentTurnIndex, blurStep, false);
      }, reducedMotion ? 100 : 420);
      return;
    }

    setTimeLeft(questionTimerSec);
    setIsTimerRunning(true);
    setGameState('ANSWERING');
    setStatusBanner({
      type: 'info',
      text: `Đã chọn Ô số #${tileIndex + 1}. Mời ${
        teams[currentTurnIndex]?.name || 'Học sinh'
      } trả lời câu hỏi!`,
    });
  };

  // Trigger next question in Mode 2 (BLUR_REVEAL)
  const handleStartBlurStepQuestion = () => {
    const nextIdx = blurStep % Math.max(1, combinedQuestionPool.length);
    const q = combinedQuestionPool[nextIdx];
    if (!q || freeOpenWithoutQuestions) {
      const nextStep = Math.min(TOTAL_BLUR_STEPS, blurStep + 1);
      setBlurStep(nextStep);
      soundEngineRef.current?.playTileOpen(isMuted);
      return;
    }
    setTileQuestionsMap((prev) => ({ ...prev, [blurStep]: q }));
    setActiveTileIndex(blurStep);
    setSelectedOptionLabel('');
    setShowAnswerExplanation(false);
    setTimeLeft(questionTimerSec);
    setIsTimerRunning(true);
    setGameState('ANSWERING');
  };

  // Confirm Correct or Wrong Answer for the active tile/step
  const handleJudgeTileQuestion = (isCorrect: boolean) => {
    if (actionLockRef.current || activeTileIndex === null) return;
    actionLockRef.current = true;
    setIsTimerRunning(false);

    // Save Undo snapshot
    setUndoSnapshot({
      openedTiles: Array.from(openedTileIndices),
      teams: teams.map((t) => ({ ...t })),
      currentTurnIndex,
      blurStep,
      gameState,
    });

    const activeTeam = teams[currentTurnIndex];

    if (isCorrect) {
      soundEngineRef.current?.playTileOpen(isMuted);
      const updatedTeams = teams.map((t, idx) =>
        idx === currentTurnIndex
          ? {
              ...t,
              score: t.score + pointsPerTile,
              correctAnswers: t.correctAnswers + 1,
            }
          : t
      );
      setTeams(updatedTeams);

      if (playMode === 'BLUR_REVEAL') {
        const nextBlur = Math.min(TOTAL_BLUR_STEPS, blurStep + 1);
        setBlurStep(nextBlur);
        setActiveTileIndex(null);
        setGameState('READY');
        setStatusBanner({
          type: 'success',
          text: `Chính xác! ${activeTeam?.name || 'Đội chơi'} nhận +${pointsPerTile} điểm và độ mờ hình ảnh giảm xuống (${Math.round(
            (nextBlur / TOTAL_BLUR_STEPS) * 100
          )}% độ nét)!`,
        });
        actionLockRef.current = false;
        saveSessionSnapshot(
          'READY',
          openedTileIndices,
          updatedTeams,
          currentTurnIndex,
          nextBlur,
          false
        );
      } else {
        // Flip & dissolve selected tile
        setFlippingTileIndex(activeTileIndex);
        setGameState('REVEALING');
        const targetTile = activeTileIndex;
        window.setTimeout(() => {
          const nextOpened = new Set(openedTileIndices);
          nextOpened.add(targetTile);
          setOpenedTileIndices(nextOpened);
          setFlippingTileIndex(null);
          setActiveTileIndex(null);
          const nextTurn = (currentTurnIndex + 1) % Math.max(1, updatedTeams.length);
          setCurrentTurnIndex(nextTurn);
          setGameState('READY');
          setStatusBanner({
            type: 'success',
            text: `Chính xác! Ô số #${targetTile + 1} đã mở (+${pointsPerTile}đ cho ${
              activeTeam?.name
            }). Lượt tiếp theo: ${updatedTeams[nextTurn]?.name}!`,
          });
          actionLockRef.current = false;
          saveSessionSnapshot('READY', nextOpened, updatedTeams, nextTurn, blurStep, false);
        }, reducedMotion ? 100 : 480);
      }
    } else {
      soundEngineRef.current?.playWrong(isMuted);
      const nextTurn = (currentTurnIndex + 1) % Math.max(1, teams.length);
      setCurrentTurnIndex(nextTurn);
      setActiveTileIndex(null);
      setGameState('READY');
      setStatusBanner({
        type: 'error',
        text: `Câu trả lời chưa chính xác! Ô vẫn đóng và quyền chọn chuyển sang ${
          teams[nextTurn]?.name || 'đội tiếp theo'
        }.`,
      });
      actionLockRef.current = false;
      saveSessionSnapshot('READY', openedTileIndices, teams, nextTurn, blurStep, false);
    }
  };

  // Undo most recent action
  const handleUndo = () => {
    if (!undoSnapshot) return;
    setOpenedTileIndices(new Set(undoSnapshot.openedTiles));
    setTeams(undoSnapshot.teams);
    setCurrentTurnIndex(undoSnapshot.currentTurnIndex);
    setBlurStep(undoSnapshot.blurStep);
    setGameState('READY');
    setActiveTileIndex(null);
    setUndoSnapshot(null);
    setStatusBanner({
      type: 'info',
      text: 'Đã hoàn tác thao tác chấm điểm/mở ô gần nhất.',
    });
  };

  // Evaluate Mystery Picture Secret Guess
  const handleCheckMysteryGuess = (forceCorrectByTeacher?: boolean) => {
    const activeTeam = teams[currentTurnIndex];
    if (!activeTeam) return;

    if (activeTeam.guessAttemptsUsed >= maxGuessesPerTeam && forceCorrectByTeacher === undefined) {
      setStatusBanner({
        type: 'error',
        text: `${activeTeam.name} đã sử dụng hết ${maxGuessesPerTeam} lượt đoán hình bí mật!`,
      });
      return;
    }

    const normalizedInput = normalizeAnswerString(pictureGuessInput);
    const isMatched =
      forceCorrectByTeacher === true
        ? true
        : forceCorrectByTeacher === false
        ? false
        : selectedPicture.acceptedAnswers.some(
            (ans) => normalizeAnswerString(ans) === normalizedInput
          ) || normalizeAnswerString(selectedPicture.secretAnswer) === normalizedInput;

    if (isMatched) {
      soundEngineRef.current?.playGrandVictory(isMuted);
      const allTileSet = new Set<number>(
        Array.from({ length: gridConfig.totalTiles }, (_, i) => i)
      );
      const updatedTeams = teams.map((t, idx) =>
        idx === currentTurnIndex
          ? {
              ...t,
              score: t.score + pointsMysterySolved,
              guessAttemptsUsed: t.guessAttemptsUsed + 1,
            }
          : t
      );
      setOpenedTileIndices(allTileSet);
      setBlurStep(TOTAL_BLUR_STEPS);
      setTeams(updatedTeams);
      setSolvedByTeamName(activeTeam.name);
      setGameState('FINISHED');
      setStatusBanner({
        type: 'success',
        text: `CHÚC MỪNG ${activeTeam.name.toUpperCase()} ĐÃ GIẢI MÃ ĐÚNG HÌNH BÍ MẬT: "${
          selectedPicture.secretAnswer
        }" (+${pointsMysterySolved} ĐIỂM)!`,
      });
      saveSessionSnapshot('FINISHED', allTileSet, updatedTeams, currentTurnIndex, TOTAL_BLUR_STEPS, true);
    } else {
      soundEngineRef.current?.playWrong(isMuted);
      const delta = penaltyWrongGuess > 0 ? -Math.abs(penaltyWrongGuess) : 0;
      const updatedTeams = teams.map((t, idx) =>
        idx === currentTurnIndex
          ? {
              ...t,
              score: t.score + delta,
              guessAttemptsUsed: t.guessAttemptsUsed + 1,
            }
          : t
      );
      const nextTurn = (currentTurnIndex + 1) % Math.max(1, updatedTeams.length);
      setTeams(updatedTeams);
      setCurrentTurnIndex(nextTurn);
      setPictureGuessInput('');
      setStatusBanner({
        type: 'error',
        text: `Dự đoán của ${activeTeam.name} chưa chính xác (${
          delta < 0 ? `${delta}đ` : '0đ'
        }). Lượt tiếp theo thuộc về ${updatedTeams[nextTurn]?.name}!`,
      });
      saveSessionSnapshot('READY', openedTileIndices, updatedTeams, nextTurn, blurStep, false);
    }
  };

  // Calculate current CSS blur radius for Mode 2
  const currentBlurPx = useMemo(() => {
    if (gameState === 'FINISHED') return 0;
    if (playMode !== 'BLUR_REVEAL') return 0;
    const blurLevels = [28, 22, 17, 12, 8, 5, 2, 0];
    return blurLevels[Math.min(blurStep, blurLevels.length - 1)] ?? 0;
  }, [gameState, playMode, blurStep]);

  const currentQuestion =
    activeTileIndex !== null ? tileQuestionsMap[activeTileIndex] || null : null;

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.correctAnswers - a.correctAnswers;
      }),
    [teams]
  );

  return (
    <div className="w-full space-y-4">
      {/* Top Game Show Header */}
      <div className="bg-gradient-to-r from-[#071329] via-[#0E2752] to-[#1E1B4B] border border-cyan-400/40 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-md">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                B02 · EDU MYSTERY PICTURE
              </span>
              <span className="text-xs text-amber-300 font-bold">
                Lớp: {resolvedClassName}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black text-white">
              ĐOÁN HÌNH BÍ MẬT – KHÁM PHÁ KIẾN THỨC BÀI HỌC
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {gameState !== 'SETUP' && (
            <button
              type="button"
              onClick={() => setGameState('SETUP')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-300" />
              <span>Cấu hình</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setReducedMotion((r) => !r)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
              reducedMotion
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {reducedMotion ? 'Giảm chuyển động: BẬT' : 'Hiệu ứng: Đầy đủ'}
          </button>

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

      {/* Recoverable Session Prompt */}
      {gameState === 'SETUP' && hasRecoverableSession && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-900">
            <RefreshCw className="w-4 h-4 text-amber-600" />
            <span>Phát hiện một phiên Đoán Hình Bí Mật đang chơi dở trước khi tải lại trang.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreSavedSession}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black"
            >
              Khôi phục phiên cũ
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(`taydo_b02_active_session_${teacherId}`);
                setHasRecoverableSession(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-800 text-xs font-bold"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 1: SETUP & PICTURE / QUESTION CONFIGURATION
         ===================================================================== */}
      {gameState === 'SETUP' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-md space-y-6">
          {/* Row 1: Play Mode, Grid Size & Teams */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#006BFF]" />
                <span>1. Chọn Chế Độ Khám Phá & Số Ô Che</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPlayMode('TILE_FLIP')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    playMode === 'TILE_FLIP'
                      ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-md'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Grid className="w-4 h-4 mb-1" />
                  <div className="text-xs font-extrabold">Chế độ 1: Lật ô</div>
                  <div className="text-[10px] opacity-80">9, 12, 16, 25 ô</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPlayMode('BLUR_REVEAL')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    playMode === 'BLUR_REVEAL'
                      ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-md'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Eye className="w-4 h-4 mb-1" />
                  <div className="text-xs font-extrabold">Chế độ 2: Hé lộ mờ</div>
                  <div className="text-[10px] opacity-80">Giảm mờ 8 mức</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPlayMode('TEAM_DECODE_ARENA')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    playMode === 'TEAM_DECODE_ARENA'
                      ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-md'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Trophy className="w-4 h-4 mb-1" />
                  <div className="text-xs font-extrabold">Chế độ 3: Đấu trường</div>
                  <div className="text-[10px] opacity-80">2 – 4 đội giải mã</div>
                </button>
              </div>

              {playMode !== 'BLUR_REVEAL' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    Số lượng ô che bức tranh:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(GRID_PRESETS) as GridPresetKey[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setGridPresetKey(k)}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                          gridPresetKey === k
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {GRID_PRESETS[k].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Teams & Class Setup */}
            <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#006BFF]" />
                  <span>2. Lớp Học & Đội Giải Mã ({teamCount} đội)</span>
                </div>
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

              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: teamCount }, (_, i) => (
                  <div key={i} className="bg-white p-2 rounded-xl border border-slate-200">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-black text-white mb-1"
                      style={{ backgroundColor: TEAM_COLORS[i] }}
                    >
                      ĐỘI {i + 1}
                    </span>
                    <input
                      type="text"
                      value={teamNames[i] || ''}
                      onChange={(e) => {
                        const next = [...teamNames];
                        next[i] = e.target.value;
                        setTeamNames(next);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-[#0F2D52]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Secret Picture Library & Teacher Upload */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#006BFF]" />
                <span>3. Chọn Hoặc Tải Lên Hình Ảnh Bí Mật</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewSecretInSetup((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-[#006BFF]" />
                  <span>{previewSecretInSetup ? 'Ẩn xem trước đáp án' : 'Xem trước ảnh & đáp án'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadForm((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-[#006BFF] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải ảnh từ máy tính</span>
                </button>
              </div>
            </div>

            {showUploadForm && (
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-4 space-y-3">
                <div className="text-xs font-extrabold text-[#006BFF]">
                  Tải Hình Ảnh Bí Mật Mới (Hỗ trợ PNG, JPG, WebP tối đa 5MB)
                </div>

                {uploadError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-bold">
                    {uploadError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Tiêu đề chủ đề:
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="VD: Danh nhân văn hóa..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Đáp án bí mật chính xác:
                    </label>
                    <input
                      type="text"
                      value={uploadSecretAnswer}
                      onChange={(e) => setUploadSecretAnswer(e.target.value)}
                      placeholder="VD: Nguyễn Trãi"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Các đáp án chấp nhận (cách bằng dấu phẩy):
                    </label>
                    <input
                      type="text"
                      value={uploadAcceptedSynonyms}
                      onChange={(e) => setUploadAcceptedSynonyms(e.target.value)}
                      placeholder="VD: Ức Trai, Nguyen Trai"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Chọn tệp ảnh (PNG/JPG/WebP):
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      className="w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Gợi ý 1:
                    </label>
                    <input
                      type="text"
                      value={uploadHint1}
                      onChange={(e) => setUploadHint1(e.target.value)}
                      placeholder="Nhập gợi ý 1..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Gợi ý 2:
                    </label>
                    <input
                      type="text"
                      value={uploadHint2}
                      onChange={(e) => setUploadHint2(e.target.value)}
                      placeholder="Nhập gợi ý 2..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomPicture}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                  >
                    Lưu vào thư viện ảnh
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {allPictures.map((pic) => {
                const isSelected = pic.id === selectedPictureId;
                return (
                  <div
                    key={pic.id}
                    onClick={() => setSelectedPictureId(pic.id)}
                    className={`cursor-pointer rounded-2xl border-2 p-3 transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#006BFF] shadow-sm'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-[#006BFF] mb-1">
                        <span>{SUBJECT_LABELS[pic.subject] || pic.subject}</span>
                        {isSelected && <span className="text-emerald-600">✓ Đang chọn</span>}
                      </div>
                      <h5 className="text-xs font-extrabold text-[#0F2D52]">{pic.title}</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">{pic.lesson}</p>
                    </div>

                    {previewSecretInSetup && (
                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                        <img
                          src={pic.imageUrl}
                          alt="Xem trước"
                          className="w-full h-20 object-cover rounded-lg border border-slate-200"
                        />
                        <div className="text-[11px] font-extrabold text-emerald-700">
                          Đáp án: {pic.secretAnswer}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 3: Question Bank & Shortage Resolution Options */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#006BFF]" />
                <span>4. Nguồn Câu Hỏi Mở Ô (Ngân hàng Smart EDU: {combinedQuestionPool.length} câu)</span>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeOpenWithoutQuestions}
                  onChange={(e) => setFreeOpenWithoutQuestions(e.target.checked)}
                  className="rounded text-[#006BFF]"
                />
                <span>Chế độ mở ô tự do (Không bắt buộc trả lời câu hỏi)</span>
              </label>
            </div>

            {!freeOpenWithoutQuestions && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <select
                    value={filterGrade}
                    onChange={(e) => setFilterGrade(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="ALL">Tất cả khối</option>
                    {(['6', '7', '8', '9'] as Grade[]).map((g) => (
                      <option key={g} value={g}>
                        Khối {g}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterSubject}
                    onChange={(e) => setFilterSubject(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="ALL">Tất cả môn ({availableSubjects.length})</option>
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>
                        {SUBJECT_LABELS[s] || s}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterChapter}
                    onChange={(e) => setFilterChapter(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="ALL">Tất cả chương ({availableChapters.length})</option>
                    {availableChapters.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterLesson}
                    onChange={(e) => setFilterLesson(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="ALL">Tất cả bài ({availableLessons.length})</option>
                    {availableLessons.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="ALL">Mọi mức độ</option>
                    <option value="know">{LEVEL_LABELS.know}</option>
                    <option value="understand">{LEVEL_LABELS.understand}</option>
                    <option value="apply">{LEVEL_LABELS.apply}</option>
                  </select>
                </div>

                {/* Shortage Handler if available questions < totalTiles */}
                {combinedQuestionPool.length < gridConfig.totalTiles && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 text-xs text-amber-900">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>
                        Số câu hỏi hợp lệ hiện có ({combinedQuestionPool.length} câu) ít hơn số ô che ({gridConfig.totalTiles} ô). Giáo viên có thể chọn:
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setGridPresetKey('3x3')}
                        className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-bold hover:bg-amber-100"
                      >
                        1. Giảm xuống 9 ô (3×3)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFreeOpenWithoutQuestions(true)}
                        className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-bold hover:bg-amber-100"
                      >
                        2. Bật chế độ mở ô tự do không kèm câu hỏi
                      </button>
                    </div>

                    {/* Manual question quick-add */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newManualStem}
                        onChange={(e) => setNewManualStem(e.target.value)}
                        placeholder="Nhập nội dung câu hỏi bổ sung thủ công..."
                        className="flex-1 min-w-[200px] bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs"
                      />
                      <input
                        type="text"
                        value={newManualAnswer}
                        onChange={(e) => setNewManualAnswer(e.target.value)}
                        placeholder="Đáp án..."
                        className="w-40 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newManualStem.trim()) return;
                          setManualQuestions((prev) => [
                            ...prev,
                            {
                              id: `mq_${Date.now()}`,
                              stem: newManualStem.trim(),
                              answer: newManualAnswer.trim() || 'Đúng',
                            },
                          ]);
                          setNewManualStem('');
                          setNewManualAnswer('');
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-slate-400">
              * Lưu ý trình chiếu 1 màn hình: Đáp án bí mật được ẩn hoàn toàn trên giao diện cho tới khi giải mã thành công.
            </p>
            <button
              type="button"
              onClick={handleStartGame}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#006BFF] via-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-base shadow-xl flex items-center gap-2.5"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>BẮT ĐẦU KHÁM PHÁ HÌNH BÍ MẬT ➔</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: ACTIVE MYSTERY PICTURE STAGE (60-65% Picture / 35-40% Panel)
         ===================================================================== */}
      {gameState !== 'SETUP' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT 60-65%: 16:9 Mystery Picture Frame & Synchronized Tile Overlay */}
          <div className="lg:col-span-7 xl:col-span-8 bg-gradient-to-b from-[#071126] via-[#0C1E3E] to-[#09152B] rounded-3xl border-2 border-cyan-400/40 p-4 sm:p-6 text-white shadow-2xl flex flex-col justify-between space-y-4">
            {/* Stage Status Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs">
                  {playMode === 'BLUR_REVEAL'
                    ? `ĐỘ NÉT: ${Math.round((blurStep / TOTAL_BLUR_STEPS) * 100)}%`
                    : `ĐÃ MỞ: ${openedTileIndices.size} / ${gridConfig.totalTiles} Ô`}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-cyan-200">
                  Chủ đề: {selectedPicture.lesson}
                </span>
              </div>

              {teams[currentTurnIndex] && gameState !== 'FINISHED' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">Đang trong lượt:</span>
                  <span
                    className="px-3 py-1 rounded-xl text-xs font-black text-white shadow-sm"
                    style={{ backgroundColor: teams[currentTurnIndex].colorHex }}
                  >
                    {teams[currentTurnIndex].name}
                  </span>
                </div>
              )}
            </div>

            {/* Unified 16:9 Coordinate Picture & Tile Grid Container */}
            <div className="relative w-full aspect-video rounded-2xl border-4 border-amber-400/70 bg-slate-950 overflow-hidden shadow-[0_0_35px_rgba(0,107,255,0.28)] select-none">
              {/* Underlying Secret Image (Never exposes secretAnswer in alt/title before FINISHED) */}
              <img
                src={selectedPicture.imageUrl}
                alt={gameState === 'FINISHED' ? selectedPicture.secretAnswer : 'Hình bí mật'}
                className="w-full h-full object-cover transition-all duration-500"
                style={{
                  filter:
                    playMode === 'BLUR_REVEAL' && gameState !== 'FINISHED'
                      ? `blur(${currentBlurPx}px) brightness(0.92)`
                      : 'none',
                  transform:
                    playMode === 'BLUR_REVEAL' && currentBlurPx > 0 ? 'scale(1.08)' : 'scale(1)',
                }}
              />

              {/* Tile Grid Overlay for Mode 1 (TILE_FLIP) & Mode 3 (TEAM_DECODE_ARENA) */}
              {playMode !== 'BLUR_REVEAL' && gameState !== 'FINISHED' && (
                <div
                  className="absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${gridConfig.rows}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: gridConfig.totalTiles }, (_, idx) => {
                    const isOpened = openedTileIndices.has(idx);
                    const isFlipping = flippingTileIndex === idx;
                    const isSelected = activeTileIndex === idx;

                    if (isOpened) {
                      return (
                        <div
                          key={idx}
                          className="border border-white/10 pointer-events-none transition-opacity duration-300 opacity-0"
                        />
                      );
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectTile(idx)}
                        className={`relative border border-cyan-300/30 flex flex-col items-center justify-center transition-all duration-300 ${
                          isFlipping
                            ? 'scale-75 opacity-0 rotate-12 bg-amber-400'
                            : isSelected
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 ring-4 ring-white z-10'
                            : 'bg-gradient-to-br from-[#0F2952]/95 via-[#16386E]/95 to-[#1E3A8A]/95 hover:from-[#1D4ED8] hover:to-[#2563EB] text-white'
                        }`}
                      >
                        <span className="text-lg sm:text-2xl font-black drop-shadow">
                          {idx + 1}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                          {tileQuestionsMap[idx] ? 'Câu hỏi' : 'Mở ô'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Victory Overlay Banner when FINISHED */}
              {gameState === 'FINISHED' && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-900/85 to-transparent p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> ĐÁP ÁN HÌNH BÍ MẬT ĐÃ ĐƯỢC GIẢI MÃ
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                      {selectedPicture.secretAnswer}
                    </h2>
                    {solvedByTeamName && (
                      <p className="text-xs text-emerald-300 font-bold">
                        Đội giải mã xuất sắc: {solvedByTeamName} (+{pointsMysterySolved} điểm)
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setGameState('SETUP')}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm"
                  >
                    Chơi hình mới ➔
                  </button>
                </div>
              )}
            </div>

            {/* Progressive Clarity Bar for Mode 2 (BLUR_REVEAL) */}
            {playMode === 'BLUR_REVEAL' && gameState !== 'FINISHED' && (
              <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <div className="flex justify-between text-xs font-bold text-cyan-200">
                    <span>Tiến độ hé lộ hình ảnh ({blurStep}/{TOTAL_BLUR_STEPS} bước)</span>
                    <span>Độ mờ hiện tại: {currentBlurPx}px</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${(blurStep / TOTAL_BLUR_STEPS) * 100}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartBlurStepQuestion}
                  className="px-4 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-500 text-white text-xs font-black"
                >
                  Câu hỏi giảm độ mờ tiếp theo ➔
                </button>
              </div>
            )}

            {/* Hints & Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-500/20">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={revealedHintsCount >= selectedPicture.hints.length}
                  onClick={() =>
                    setRevealedHintsCount((c) => Math.min(selectedPicture.hints.length, c + 1))
                  }
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Mở gợi ý ({revealedHintsCount}/{selectedPicture.hints.length})
                  </span>
                </button>

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
                    setActiveTileIndex(null);
                    setIsTimerRunning(false);
                    setGameState('READY');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Chuyển lượt đội kế
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const allSet = new Set<number>(
                    Array.from({ length: gridConfig.totalTiles }, (_, i) => i)
                  );
                  setOpenedTileIndices(allSet);
                  setBlurStep(TOTAL_BLUR_STEPS);
                  setGameState('FINISHED');
                  saveSessionSnapshot('FINISHED', allSet, teams, currentTurnIndex, TOTAL_BLUR_STEPS, true);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-bold"
              >
                Công bố hình & Kết thúc sớm
              </button>
            </div>

            {revealedHintsCount > 0 && (
              <div className="bg-amber-950/60 border border-amber-400/40 rounded-2xl p-3 space-y-1 text-xs text-amber-200">
                {selectedPicture.hints.slice(0, revealedHintsCount).map((h, i) => (
                  <div key={i} className="font-semibold">
                    💡 {h}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT 35-40%: Active Tile Question, Secret Picture Guess Box & Team Scoreboard */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between gap-4">
            {/* Status Notification */}
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

            {/* Card 1: Active Tile Question Box */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-[#006BFF]" />
                  <span>
                    {activeTileIndex !== null
                      ? `Câu Hỏi Mở Ô Số #${activeTileIndex + 1}`
                      : 'Câu Hỏi Mở Ô'}
                  </span>
                </span>
                {activeTileIndex !== null && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono ${
                      timeLeft <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-blue-50 text-[#006BFF]'
                    }`}
                  >
                    ⏱ {timeLeft}s
                  </span>
                )}
              </div>

              {currentQuestion ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-[#0F2D52]">
                    {currentQuestion.stem}
                  </div>

                  {currentQuestion.type === 'single_choice' && currentQuestion.options && (
                    <div className="grid grid-cols-1 gap-1.5">
                      {currentQuestion.options.map((opt) => {
                        const isPicked = selectedOptionLabel === opt.label;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedOptionLabel(opt.label)}
                            className={`p-2 rounded-xl border text-left text-xs font-bold flex items-center gap-2 ${
                              isPicked
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span className="w-5 h-5 rounded bg-slate-100 text-[#0F2D52] font-black flex items-center justify-center shrink-0">
                              {opt.label}
                            </span>
                            <span>{opt.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAnswerExplanation((v) => !v)}
                      className="text-xs font-bold text-[#006BFF] hover:underline"
                    >
                      {showAnswerExplanation ? 'Ẩn đáp án câu hỏi' : 'Xem đáp án câu hỏi'}
                    </button>
                  </div>

                  {showAnswerExplanation && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      <strong>Đáp án: {currentQuestion.correctAnswer}</strong>
                      {currentQuestion.explanation && <p>{currentQuestion.explanation}</p>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleJudgeTileQuestion(true)}
                      className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ĐÚNG – MỞ Ô (+{pointsPerTile}đ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJudgeTileQuestion(false)}
                      className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>SAI – GIỮ ĐÓNG Ô</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">
                  Hãy bấm vào một ô số trên bức tranh bên trái để hiển thị câu hỏi!
                </p>
              )}
            </div>

            {/* Card 2: Guess Secret Mystery Picture Box */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-2 border-amber-300 p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Đoán Đáp Án Hình Bí Mật (+{pointsMysterySolved}đ)</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled={gameState === 'FINISHED'}
                  value={pictureGuessInput}
                  onChange={(e) => setPictureGuessInput(e.target.value)}
                  placeholder="Nhập dự đoán nội dung bức tranh..."
                  className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
                <button
                  type="button"
                  disabled={gameState === 'FINISHED' || !pictureGuessInput.trim()}
                  onClick={() => handleCheckMysteryGuess()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black disabled:opacity-40 flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" /> Kiểm tra
                </button>
              </div>

              {/* Teacher Direct Judgment for Verbal Student Guess */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={gameState === 'FINISHED'}
                  onClick={() => handleCheckMysteryGuess(true)}
                  className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold disabled:opacity-40"
                >
                  ✓ GV xác nhận Đoán Đúng (+{pointsMysterySolved}đ)
                </button>
                <button
                  type="button"
                  disabled={gameState === 'FINISHED'}
                  onClick={() => handleCheckMysteryGuess(false)}
                  className="py-1.5 px-3 rounded-xl bg-white border border-rose-300 text-rose-700 text-[11px] font-extrabold disabled:opacity-40"
                >
                  ✗ Đoán Sai
                </button>
              </div>
            </div>

            {/* Card 3: Live Team Leaderboard */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-2.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Bảng Xếp Hạng Các Đội</span>
                </span>
              </div>

              <div className="space-y-2">
                {sortedTeams.map((t, rankIdx) => {
                  const isCurrentTurn = teams[currentTurnIndex]?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        const foundIdx = teams.findIndex((item) => item.id === t.id);
                        if (foundIdx >= 0) setCurrentTurnIndex(foundIdx);
                      }}
                      className={`cursor-pointer p-2.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isCurrentTurn
                          ? 'bg-blue-50/90 border-[#006BFF] ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                          style={{ backgroundColor: t.colorHex }}
                        >
                          #{rankIdx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[#0F2D52] truncate flex items-center gap-1.5">
                            <span>{t.name}</span>
                            {isCurrentTurn && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-[#006BFF] text-white rounded">
                                Đang chọn
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold">
                            Mở đúng: {t.correctAnswers} ô · Đã đoán hình: {t.guessAttemptsUsed}/
                            {maxGuessesPerTeam}
                          </div>
                        </div>
                      </div>

                      <div className="text-base font-black text-[#006BFF] shrink-0">
                        {t.score} đ
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
