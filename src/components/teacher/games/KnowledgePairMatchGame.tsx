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
  Layers,
  Eye,
  ArrowRight,
  RefreshCw,
  ZoomIn,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Shuffle,
  Check,
  SkipForward,
  Sliders,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question } from '../../../types';
import { MathView } from '../../MathView';
import { SpaceRocketVoiceManager } from './SpaceRocketVoiceManager';

// ============================================================================
// TYPES & STATE MACHINE FOR B08: GHÉP CẶP KIẾN THỨC 3D
// ============================================================================

export type B08PlayMode = 'VISUAL_MATCH' | 'MEMORY_FLIP';
export type B08OrgMode = 'CLASS' | 'INDIVIDUAL' | 'TEAMS';
export type B08DatasetKey = 'SAMPLE_MATH6' | 'SAMPLE_INFO' | 'SAMPLE_GEO_SCI' | 'QUESTION_BANK' | 'CUSTOM';

export type B08StagePhase =
  | 'SETUP'
  | 'READY'
  | 'FIRST_SELECTED'
  | 'SECOND_SELECTED'
  | 'EVALUATING'
  | 'FEEDBACK'
  | 'NEXT_TURN'
  | 'PAUSED'
  | 'FINISHED';

export interface KnowledgePairDefinition {
  pairId: string;
  sideAContent: string;
  sideBContent: string;
  explanation: string;
  topicTag?: string;
  isSample?: boolean;
}

export interface KnowledgeCardItem {
  cardId: string;
  pairId: string;
  side: 'A' | 'B';
  content: string;
  explanation: string;
  topicTag?: string;
}

export interface B08TeamItem {
  id: string;
  name: string;
  colorHex: string;
  score: number;
  matchedCount: number;
  attempts: number;
}

export interface B08TurnLog {
  turnId: string;
  timestamp: string;
  actorLabel: string;
  cardA: string;
  cardB: string;
  isCorrect: boolean;
  pointsAwarded: number;
  pairId?: string;
}

export interface KnowledgePairMatchGameProps {
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
  onPick?: (
    student: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string }
  ) => void;
  onCloseGame?: () => void;
}

// ============================================================================
// STORAGE KEYS (SCOPED STRICTLY TO B08)
// ============================================================================

const B08_SESSION_STORAGE_KEY = 'taydo_smart_edu_b08_active_session_v1';
const B08_CUSTOM_PAIRS_STORAGE_KEY = 'taydo_smart_edu_b08_custom_pairs_v1';

// ============================================================================
// BUILT-IN VERIFIED SAMPLE DATASETS (TAGGED "DỮ LIỆU MẪU")
// ============================================================================

export const SAMPLE_DATASET_MATH6: KnowledgePairDefinition[] = [
  {
    pairId: 'm6_p1',
    sideAContent: '12 + 8',
    sideBContent: '20',
    explanation: 'Phép cộng hai số tự nhiên: $12 + 8 = 20$.',
    topicTag: 'Toán 6 · Số tự nhiên',
    isSample: true,
  },
  {
    pairId: 'm6_p2',
    sideAContent: '7 × 6',
    sideBContent: '42',
    explanation: 'Phép nhân hai số tự nhiên: $7 \\times 6 = 42$.',
    topicTag: 'Toán 6 · Phép nhân',
    isSample: true,
  },
  {
    pairId: 'm6_p3',
    sideAContent: '36 : 4',
    sideBContent: '9',
    explanation: 'Phép chia hết: $36 : 4 = 9$ vì $9 \\times 4 = 36$.',
    topicTag: 'Toán 6 · Phép chia',
    isSample: true,
  },
  {
    pairId: 'm6_p4',
    sideAContent: '$5^2$',
    sideBContent: '25',
    explanation: 'Bình phương của 5: $5^2 = 5 \\times 5 = 25$.',
    topicTag: 'Toán 6 · Lũy thừa',
    isSample: true,
  },
  {
    pairId: 'm6_p5',
    sideAContent: '$3^3$',
    sideBContent: '27',
    explanation: 'Lập phương của 3: $3^3 = 3 \\times 3 \\times 3 = 27$.',
    topicTag: 'Toán 6 · Lũy thừa',
    isSample: true,
  },
  {
    pairId: 'm6_p6',
    sideAContent: '$2^4$',
    sideBContent: '16',
    explanation: 'Lũy thừa bậc 4 của 2: $2^4 = 2 \\times 2 \\times 2 \\times 2 = 16$.',
    topicTag: 'Toán 6 · Lũy thừa',
    isSample: true,
  },
  {
    pairId: 'm6_p7',
    sideAContent: '45 − 17',
    sideBContent: '28',
    explanation: 'Phép trừ hai số tự nhiên có nhớ: $45 - 17 = 28$.',
    topicTag: 'Toán 6 · Phép trừ',
    isSample: true,
  },
  {
    pairId: 'm6_p8',
    sideAContent: '18 + 15',
    sideBContent: '33',
    explanation: 'Phép cộng hai số tự nhiên có nhớ: $18 + 15 = 33$.',
    topicTag: 'Toán 6 · Phép cộng',
    isSample: true,
  },
];

export const SAMPLE_DATASET_INFORMATICS: KnowledgePairDefinition[] = [
  {
    pairId: 'inf_p1',
    sideAContent: 'Bàn phím',
    sideBContent: 'Nhập kí tự vào máy tính',
    explanation: 'Bàn phím là thiết bị vào cơ bản giúp người dùng gõ chữ, số và kí hiệu vào máy tính.',
    topicTag: 'Tin học · Thiết bị vào',
    isSample: true,
  },
  {
    pairId: 'inf_p2',
    sideAContent: 'Chuột',
    sideBContent: 'Điều khiển con trỏ và chọn đối tượng',
    explanation: 'Chuột máy tính là thiết bị vào giúp di chuyển con trỏ trên màn hình và chọn, kéo thả đối tượng.',
    topicTag: 'Tin học · Thiết bị vào',
    isSample: true,
  },
  {
    pairId: 'inf_p3',
    sideAContent: 'Màn hình',
    sideBContent: 'Hiển thị hình ảnh và nội dung',
    explanation: 'Màn hình là thiết bị ra quan trọng nhất, hiển thị trực quan văn bản, hình ảnh và giao diện.',
    topicTag: 'Tin học · Thiết bị ra',
    isSample: true,
  },
  {
    pairId: 'inf_p4',
    sideAContent: 'Máy in',
    sideBContent: 'Đưa nội dung từ máy tính ra giấy',
    explanation: 'Máy in là thiết bị ra dùng để chuyển thông tin số từ máy tính thành văn bản, hình ảnh trên giấy.',
    topicTag: 'Tin học · Thiết bị ra',
    isSample: true,
  },
  {
    pairId: 'inf_p5',
    sideAContent: 'Micro',
    sideBContent: 'Thu nhận âm thanh',
    explanation: 'Micro là thiết bị vào tiếp nhận sóng âm thanh và chuyển thành tín hiệu số cho máy tính xử lý.',
    topicTag: 'Tin học · Thiết bị vào',
    isSample: true,
  },
  {
    pairId: 'inf_p6',
    sideAContent: 'Loa',
    sideBContent: 'Phát âm thanh',
    explanation: 'Loa là thiết bị ra chuyển đổi dữ liệu âm thanh số từ máy tính thành âm thanh nghe được.',
    topicTag: 'Tin học · Thiết bị ra',
    isSample: true,
  },
  {
    pairId: 'inf_p7',
    sideAContent: 'Máy quét',
    sideBContent: 'Chuyển tài liệu giấy thành dữ liệu số',
    explanation: 'Máy quét (Scanner) là thiết bị vào thu nhận hình ảnh trên giấy để lưu thành tệp số trong máy tính.',
    topicTag: 'Tin học · Thiết bị vào',
    isSample: true,
  },
  {
    pairId: 'inf_p8',
    sideAContent: 'Webcam',
    sideBContent: 'Thu nhận hình ảnh và video',
    explanation: 'Webcam là camera kỹ thuật số đóng vai trò thiết bị vào để ghi hình ảnh và truyền video trực tiếp.',
    topicTag: 'Tin học · Thiết bị vào',
    isSample: true,
  },
];

export const SAMPLE_DATASET_GEO_SCI: KnowledgePairDefinition[] = [
  {
    pairId: 'gs_p1',
    sideAContent: 'Tam giác đều',
    sideBContent: 'Ba cạnh bằng nhau và ba góc đều bằng 60°',
    explanation: 'Tam giác đều có 3 cạnh bằng nhau và mỗi góc trong luôn bằng $180^\\circ : 3 = 60^\\circ$.',
    topicTag: 'Hình học THCS',
    isSample: true,
  },
  {
    pairId: 'gs_p2',
    sideAContent: 'Định lý Pythagore',
    sideBContent: 'Trong tam giác vuông: $a^2 + b^2 = c^2$',
    explanation: 'Bình phương cạnh huyền $c$ bằng tổng bình phương hai cạnh góc vuông $a$ và $b$.',
    topicTag: 'Hình học 8',
    isSample: true,
  },
  {
    pairId: 'gs_p3',
    sideAContent: 'Hình thoi',
    sideBContent: 'Tứ giác có bốn cạnh bằng nhau, hai đường chéo vuông góc',
    explanation: 'Hình thoi là hình bình hành đặc biệt có 4 cạnh bằng nhau và hai đường chéo vuông góc tại trung điểm mỗi đường.',
    topicTag: 'Hình học THCS',
    isSample: true,
  },
  {
    pairId: 'gs_p4',
    sideAContent: 'Quang hợp ở thực vật',
    sideBContent: 'Tổng hợp chất hữu cơ và giải phóng khí Oxygen dưới ánh sáng',
    explanation: 'Lục lạp sử dụng năng lượng ánh sáng để tổng hợp chất hữu cơ từ $\\text{CO}_2$ và nước, đồng thời nhả khí $\\text{O}_2$.',
    topicTag: 'KHTN 6–7',
    isSample: true,
  },
  {
    pairId: 'gs_p5',
    sideAContent: 'Khúc xạ ánh sáng',
    sideBContent: 'Tia sáng bị gãy khúc khi truyền xiên góc qua mặt phân cách hai môi trường',
    explanation: 'Do tốc độ ánh sáng thay đổi khi đi từ môi trường trong suốt này sang môi trường trong suốt khác.',
    topicTag: 'KHTN 9',
    isSample: true,
  },
  {
    pairId: 'gs_p6',
    sideAContent: 'Số nguyên tố chẵn duy nhất',
    sideBContent: 'Số 2',
    explanation: 'Số 2 chỉ có hai ước tự nhiên là 1 và 2; mọi số chẵn lớn hơn 2 đều chia hết cho 2 nên là hợp số.',
    topicTag: 'Số học 6',
    isSample: true,
  },
  {
    pairId: 'gs_p7',
    sideAContent: 'Hằng đẳng thức hiệu hai bình phương',
    sideBContent: '$a^2 - b^2 = (a - b)(a + b)$',
    explanation: 'Hiệu hai bình phương của hai biểu thức bằng tích của hiệu hai biểu thức với tổng của chúng.',
    topicTag: 'Đại số 8',
    isSample: true,
  },
  {
    pairId: 'gs_p8',
    sideAContent: 'Lực đẩy Archimedes',
    sideBContent: '$F_A = d \\cdot V$ (hướng thẳng đứng từ dưới lên)',
    explanation: 'Mọi vật nhúng trong chất lỏng đều chịu lực đẩy hướng thẳng đứng lên trên có độ lớn bằng trọng lượng phần chất lỏng bị vật chiếm chỗ.',
    topicTag: 'KHTN 8',
    isSample: true,
  },
];

const TEAM_PALETTE = [
  { name: 'Đội 1 · Sao Vàng', colorHex: '#F59E0B' },
  { name: 'Đội 2 · Tia Chớp Xanh', colorHex: '#0284C7' },
  { name: 'Đội 3 · Ngọc Lục Bảo', colorHex: '#059669' },
  { name: 'Đội 4 · Phượng Hoàng Đỏ', colorHex: '#E11D48' },
  { name: 'Đội 5 · Tinh Thể Tím', colorHex: '#7C3AED' },
  { name: 'Đội 6 · Hải Đăng Cam', colorHex: '#EA580C' },
];

// ============================================================================
// CRYPTOGRAPHIC RANDOM & FISHER-YATES SHUFFLE
// ============================================================================

export function secureRandomInt(max: number): number {
  if (max <= 1) return 0;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const uint32Max = 0xffffffff;
    const limit = uint32Max - (uint32Max % max);
    const buf = new Uint32Array(1);
    let val = 0;
    do {
      window.crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return val % max;
  }
  return Math.floor(Math.random() * max);
}

export function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// ============================================================================
// DATASET VALIDATION & AMBIGUITY CHECKER
// ============================================================================

export interface PairDatasetValidationResult {
  valid: boolean;
  validPairs: KnowledgePairDefinition[];
  ambiguousWarnings: string[];
  structuralErrors: string[];
}

function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function validateAndFilterPairDataset(
  rawPairs: KnowledgePairDefinition[]
): PairDatasetValidationResult {
  const validPairs: KnowledgePairDefinition[] = [];
  const ambiguousWarnings: string[] = [];
  const structuralErrors: string[] = [];

  const seenPairIds = new Set<string>();
  const seenSideAText = new Map<string, string>();
  const seenSideBText = new Map<string, string>();

  for (let idx = 0; idx < rawPairs.length; idx++) {
    const item = rawPairs[idx];
    const pId = (item.pairId || `pair_${idx + 1}`).trim();
    const aText = (item.sideAContent || '').trim();
    const bText = (item.sideBContent || '').trim();

    if (!aText || !bText) {
      structuralErrors.push(`Cặp #${idx + 1} (${pId}) bị thiếu nội dung phía A hoặc phía B.`);
      continue;
    }
    if (seenPairIds.has(pId)) {
      structuralErrors.push(`Mã cặp "${pId}" bị trùng lặp.`);
      continue;
    }

    const normA = normalizeForComparison(aText);
    const normB = normalizeForComparison(bText);

    if (seenSideAText.has(normA)) {
      ambiguousWarnings.push(
        `Nội dung phía A "${aText}" bị trùng với cặp "${seenSideAText.get(normA)}", có thể gây nhiều cách ghép đúng.`
      );
      continue;
    }
    if (seenSideBText.has(normB)) {
      ambiguousWarnings.push(
        `Nội dung phía B "${bText}" bị trùng với cặp "${seenSideBText.get(normB)}", có thể gây nhiều cách ghép đúng.`
      );
      continue;
    }

    seenPairIds.add(pId);
    seenSideAText.set(normA, pId);
    seenSideBText.set(normB, pId);

    validPairs.push({
      pairId: pId,
      sideAContent: aText,
      sideBContent: bText,
      explanation: (item.explanation || '').trim() || `Cặp kiến thức đúng: ${aText} ↔ ${bText}.`,
      topicTag: item.topicTag,
      isSample: item.isSample,
    });
  }

  return {
    valid: validPairs.length > 0 && structuralErrors.length === 0,
    validPairs,
    ambiguousWarnings,
    structuralErrors,
  };
}

/**
 * Pure function to determine if two selected cards form a valid match.
 * Strictly uses pairId and opposite side ('A' vs 'B'), never screen index or color.
 */
export function evaluateCardMatch(
  card1: KnowledgeCardItem | null,
  card2: KnowledgeCardItem | null,
  matchedPairIds: ReadonlySet<string>
): { isMatch: boolean; reason: 'MATCH' | 'SAME_CARD' | 'SAME_SIDE' | 'ALREADY_MATCHED' | 'MISMATCH' } {
  if (!card1 || !card2) {
    return { isMatch: false, reason: 'MISMATCH' };
  }
  if (card1.cardId === card2.cardId) {
    return { isMatch: false, reason: 'SAME_CARD' };
  }
  if (card1.side === card2.side) {
    return { isMatch: false, reason: 'SAME_SIDE' };
  }
  if (matchedPairIds.has(card1.pairId) || matchedPairIds.has(card2.pairId)) {
    return { isMatch: false, reason: 'ALREADY_MATCHED' };
  }
  if (card1.pairId === card2.pairId) {
    return { isMatch: true, reason: 'MATCH' };
  }
  return { isMatch: false, reason: 'MISMATCH' };
}

// ============================================================================
// WEB AUDIO SYNTHESIZER (NO OVERLAPPING / RESPECTS MUTE)
// ============================================================================

class B08SoundEngine {
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

  playCardSelect(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.095);
    } catch {}
  }

  playMatchSuccess(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + idx * 0.07;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.34);
      });
    } catch {}
  }

  playMatchMismatch(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(195, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.11, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  playVictoryFanfare(muted: boolean) {
    if (muted) return;
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
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.47);
      });
    } catch {}
  }
}

const b08Sound = new B08SoundEngine();

// ============================================================================
// CUSTOM 3D SVG ILLUSTRATIONS (ZERO EMOJI)
// ============================================================================

const HallOfKnowledgeCrest3D: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="b08_goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="b08_cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#BAE6FD" />
        <stop offset="50%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#1E3A8A" />
      </linearGradient>
      <filter id="b08_dropShadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.45" />
      </filter>
    </defs>
    <g filter="url(#b08_dropShadow)">
      {/* Left 3D Puzzle Crystal Node (Side A) */}
      <path
        d="M14 34 H52 V48 C62 48 62 64 52 64 V82 H14 Z"
        fill="url(#b08_cyanGrad)"
        stroke="#7DD3FC"
        strokeWidth="2.5"
      />
      {/* Right 3D Puzzle Crystal Node (Side B) */}
      <path
        d="M66 34 H106 V82 H66 V64 C56 64 56 48 66 48 Z"
        fill="url(#b08_goldGrad)"
        stroke="#FEF08A"
        strokeWidth="2.5"
      />
      {/* Energy Connection Bridge Spark */}
      <circle cx="60" cy="56" r="8" fill="#FFFFFF" opacity="0.9" />
      <polygon points="60,20 64,30 74,34 64,38 60,48 56,38 46,34 56,30" fill="#FDE047" />
    </g>
  </svg>
);

const VictoryTrophy3DSVG: React.FC<{ className?: string }> = ({ className = 'w-20 h-20' }) => (
  <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="b08_cupGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="55%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="50" fill="#F59E0B" opacity="0.15" />
    <path
      d="M36 26 H84 V52 C84 70 72 82 60 84 C48 82 36 70 36 52 Z"
      fill="url(#b08_cupGold)"
      stroke="#FEF08A"
      strokeWidth="2.5"
    />
    <path
      d="M36 32 H22 C22 50 28 60 38 62"
      fill="none"
      stroke="url(#b08_cupGold)"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <path
      d="M84 32 H98 C98 50 92 60 82 62"
      fill="none"
      stroke="url(#b08_cupGold)"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <rect x="53" y="83" width="14" height="14" rx="2" fill="url(#b08_cupGold)" />
    <rect x="38" y="96" width="44" height="10" rx="4" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" />
    <polygon points="60,38 64,48 75,49 67,56 69,66 60,60 51,66 53,56 45,49 56,48" fill="#FFFBEB" />
  </svg>
);

// ============================================================================
// PERSISTED SESSION INTERFACE
// ============================================================================

interface PersistedB08Session {
  version: 1;
  sessionId: string;
  playMode: B08PlayMode;
  orgMode: B08OrgMode;
  datasetKey: B08DatasetKey;
  pairCount: 4 | 6 | 8;
  timeLimitSec: number;
  remainingSec: number;
  elapsedPlaySec: number;
  hintsEnabled: boolean;
  hintsUsed: number;
  maxHints: number;
  activePairs: KnowledgePairDefinition[];
  sideACards: KnowledgeCardItem[];
  sideBCards: KnowledgeCardItem[];
  memoryDeck: KnowledgeCardItem[];
  matchedPairIds: string[];
  matchOrderMap: Record<string, number>;
  attemptsCount: number;
  wrongCount: number;
  classScore: number;
  teams: B08TeamItem[];
  activeTeamIndex: number;
  activeStudentId: string | null;
  turnLogs: B08TurnLog[];
  lastExplanation: {
    pairId: string;
    sideAContent: string;
    sideBContent: string;
    explanation: string;
  } | null;
  savedAt: number;
}

// ============================================================================
// MAIN COMPONENT: KnowledgePairMatchGame (B08)
// ============================================================================

export const KnowledgePairMatchGame: React.FC<KnowledgePairMatchGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds = new Set(),
  questions = [],
  resolvedClassName = 'Lớp học',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onOpenAbsentModal,
  onOpenHistoryModal,
  onPick,
  onCloseGame,
}) => {
  // 1. Setup & Configuration State (Defaults per specification)
  const [phase, setPhase] = useState<B08StagePhase>('SETUP');
  const [playMode, setPlayMode] = useState<B08PlayMode>('VISUAL_MATCH');
  const [datasetKey, setDatasetKey] = useState<B08DatasetKey>('SAMPLE_MATH6');
  const [pairCount, setPairCount] = useState<4 | 6 | 8>(6);
  const [orgMode, setOrgMode] = useState<B08OrgMode>('CLASS');
  const [teamCount, setTeamCount] = useState<number>(2);
  const [timeLimitSec, setTimeLimitSec] = useState<number>(0); // 0 = unlimited, 120, 180, 300
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(true);
  const [localAudioOn, setLocalAudioOn] = useState<boolean>(true);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // Question Bank Filter (when datasetKey === 'QUESTION_BANK')
  const [qbGrade, setQbGrade] = useState<string>('all');
  const [qbSubject, setQbSubject] = useState<string>('all');

  // Custom Pairs State
  const [customPairs, setCustomPairs] = useState<KnowledgePairDefinition[]>(() => {
    if (typeof window === 'undefined') return SAMPLE_DATASET_MATH6.slice(0, 6);
    try {
      const raw = window.localStorage.getItem(B08_CUSTOM_PAIRS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return SAMPLE_DATASET_MATH6.slice(0, 6).map((p, idx) => ({
      ...p,
      pairId: `custom_${idx + 1}`,
      isSample: false,
    }));
  });
  const [newSideA, setNewSideA] = useState<string>('');
  const [newSideB, setNewSideB] = useState<string>('');
  const [newExplanation, setNewExplanation] = useState<string>('');

  // 2. Active Session State
  const [sessionId, setSessionId] = useState<string>(() => `b08_${Date.now().toString(36)}`);
  const [activePairs, setActivePairs] = useState<KnowledgePairDefinition[]>([]);
  const [sideACards, setSideACards] = useState<KnowledgeCardItem[]>([]);
  const [sideBCards, setSideBCards] = useState<KnowledgeCardItem[]>([]);
  const [memoryDeck, setMemoryDeck] = useState<KnowledgeCardItem[]>([]);

  // Selection & Evaluation State
  const [selectedCard1, setSelectedCard1] = useState<KnowledgeCardItem | null>(null);
  const [selectedCard2, setSelectedCard2] = useState<KnowledgeCardItem | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [matchOrderMap, setMatchOrderMap] = useState<Record<string, number>>({});
  const [mismatchCardIds, setMismatchCardIds] = useState<Set<string>>(new Set());
  const [hintHighlightedPairId, setHintHighlightedPairId] = useState<string | null>(null);
  const [draggedCard, setDraggedCard] = useState<KnowledgeCardItem | null>(null);

  // Scores, Counters & Turn Management
  const [attemptsCount, setAttemptsCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const maxHints = 2;
  const [classScore, setClassScore] = useState<number>(0);
  const [teams, setTeams] = useState<B08TeamItem[]>(() =>
    TEAM_PALETTE.slice(0, 2).map((t, i) => ({
      id: `b08_team_${i + 1}`,
      name: t.name,
      colorHex: t.colorHex,
      score: 0,
      matchedCount: 0,
      attempts: 0,
    }))
  );
  const [activeTeamIndex, setActiveTeamIndex] = useState<number>(0);
  const [activeStudent, setActiveStudent] = useState<StudentCandidate | null>(null);
  const [turnLogs, setTurnLogs] = useState<B08TurnLog[]>([]);

  // Pedagogical Explanation & Status Feedback
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [lastExplanation, setLastExplanation] = useState<{
    pairId: string;
    sideAContent: string;
    sideBContent: string;
    explanation: string;
  } | null>(null);

  // Modals (Zoom Card, Guide, Knowledge Review, Saved Session Prompt)
  const [zoomedCard, setZoomedCard] = useState<KnowledgeCardItem | null>(null);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showKnowledgeReviewModal, setShowKnowledgeReviewModal] = useState<boolean>(false);
  const [restorableSession, setRestorableSession] = useState<PersistedB08Session | null>(null);

  // Timer State (Single Source of Truth with deadline & pause compensation)
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [elapsedPlaySec, setElapsedPlaySec] = useState<number>(0);
  const phaseBeforePauseRef = useRef<B08StagePhase>('READY');
  const deadlineMsRef = useRef<number | null>(null);
  const playStartMsRef = useRef<number | null>(null);
  const accumulatedPlaySecRef = useRef<number>(0);

  // Race Condition & Stale Callback Guards
  const sessionIdRef = useRef<string>(sessionId);
  const turnSequenceRef = useRef<number>(0);
  const isEvaluatingRef = useRef<boolean>(false);
  const scoredPairIdsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);

  // Vietnamese Voice Manager (Strict vi-VN, never falls back to English)
  const voiceManagerRef = useRef<SpaceRocketVoiceManager | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const effectiveMuted = isMuted || !localAudioOn;

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((tid) => window.clearTimeout(tid));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    voiceManagerRef.current = new SpaceRocketVoiceManager();
    return () => {
      clearAllTimers();
      voiceManagerRef.current?.dispose();
    };
  }, [clearAllTimers]);

  // Check if there is a restorable B08 session in localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(B08_SESSION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedB08Session;
      if (
        parsed &&
        parsed.version === 1 &&
        Array.isArray(parsed.activePairs) &&
        parsed.activePairs.length > 0 &&
        Array.isArray(parsed.matchedPairIds) &&
        parsed.matchedPairIds.length < parsed.activePairs.length
      ) {
        setRestorableSession(parsed);
      }
    } catch {
      window.localStorage.removeItem(B08_SESSION_STORAGE_KEY);
    }
  }, []);

  // Present students for Individual Mode
  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((st) => !absentIds.has(st.id));
  }, [allCandidates, availableCandidates, absentIds]);

  // Update default hintsEnabled when switching orgMode in SETUP
  const handleSelectOrgMode = (nextOrg: B08OrgMode) => {
    setOrgMode(nextOrg);
    // In competitive team mode, disable hints by default per Section 10
    if (nextOrg === 'TEAMS') {
      setHintsEnabled(false);
    } else {
      setHintsEnabled(true);
    }
  };

  // Convert Question Bank items into KnowledgePairDefinitions
  const bankConvertedPairs = useMemo<KnowledgePairDefinition[]>(() => {
    const list: KnowledgePairDefinition[] = [];
    for (const q of questions) {
      if (!q || !q.stem || !q.correctAnswer) continue;
      if (q.status && q.status !== 'approved') continue;
      if (qbGrade !== 'all' && String(q.grade) !== qbGrade) continue;
      if (qbSubject !== 'all' && String(q.subject) !== qbSubject) continue;

      let answerText = q.correctAnswer.trim();
      if (Array.isArray(q.options) && q.options.length > 0) {
        const matchedOpt = q.options.find(
          (o) =>
            o.label.trim().toLowerCase() === answerText.toLowerCase() ||
            o.id.trim().toLowerCase() === answerText.toLowerCase() ||
            o.text.trim().toLowerCase() === answerText.toLowerCase()
        );
        if (matchedOpt) {
          answerText = matchedOpt.text.trim();
        }
      }

      if (!answerText) continue;
      list.push({
        pairId: `qb_${q.id}`,
        sideAContent: q.stem.trim(),
        sideBContent: answerText,
        explanation: q.explanation?.trim() || `Đáp án đúng cho "${q.stem.trim()}" là "${answerText}".`,
        topicTag: q.chapter || `Lớp ${q.grade}`,
        isSample: false,
      });
    }
    return list;
  }, [questions, qbGrade, qbSubject]);

  // Select Raw Dataset based on datasetKey
  const selectedRawDataset = useMemo<KnowledgePairDefinition[]>(() => {
    switch (datasetKey) {
      case 'SAMPLE_MATH6':
        return SAMPLE_DATASET_MATH6;
      case 'SAMPLE_INFO':
        return SAMPLE_DATASET_INFORMATICS;
      case 'SAMPLE_GEO_SCI':
        return SAMPLE_DATASET_GEO_SCI;
      case 'QUESTION_BANK':
        return bankConvertedPairs;
      case 'CUSTOM':
        return customPairs;
      default:
        return SAMPLE_DATASET_MATH6;
    }
  }, [datasetKey, bankConvertedPairs, customPairs]);

  // Validate active dataset for duplicates / ambiguity / missing sides
  const datasetValidation = useMemo(
    () => validateAndFilterPairDataset(selectedRawDataset),
    [selectedRawDataset]
  );

  const availableValidCount = datasetValidation.validPairs.length;
  const isShortOnPairs = availableValidCount < pairCount;

  // Save custom pairs to B08 localStorage key
  const handleAddCustomPair = () => {
    const a = newSideA.trim();
    const b = newSideB.trim();
    const exp = newExplanation.trim();
    if (!a || !b) return;
    const next: KnowledgePairDefinition[] = [
      ...customPairs,
      {
        pairId: `custom_${Date.now().toString(36)}`,
        sideAContent: a,
        sideBContent: b,
        explanation: exp || `Cặp kiến thức đúng: ${a} ↔ ${b}.`,
        topicTag: 'Tự soạn',
        isSample: false,
      },
    ];
    setCustomPairs(next);
    setNewSideA('');
    setNewSideB('');
    setNewExplanation('');
    try {
      window.localStorage.setItem(B08_CUSTOM_PAIRS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleRemoveCustomPair = (pairIdToRemove: string) => {
    const next = customPairs.filter((p) => p.pairId !== pairIdToRemove);
    setCustomPairs(next);
    try {
      window.localStorage.setItem(B08_CUSTOM_PAIRS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // Persist active session state to localStorage (B08 key only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (phase === 'SETUP') return;
    if (phase === 'FINISHED') {
      try {
        window.localStorage.removeItem(B08_SESSION_STORAGE_KEY);
      } catch {}
      return;
    }
    try {
      const payload: PersistedB08Session = {
        version: 1,
        sessionId,
        playMode,
        orgMode,
        datasetKey,
        pairCount,
        timeLimitSec,
        remainingSec,
        elapsedPlaySec,
        hintsEnabled,
        hintsUsed,
        maxHints,
        activePairs,
        sideACards,
        sideBCards,
        memoryDeck,
        matchedPairIds: Array.from(matchedPairIds),
        matchOrderMap,
        attemptsCount,
        wrongCount,
        classScore,
        teams,
        activeTeamIndex,
        activeStudentId: activeStudent?.id || null,
        turnLogs,
        lastExplanation,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(B08_SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [
    phase,
    sessionId,
    playMode,
    orgMode,
    datasetKey,
    pairCount,
    timeLimitSec,
    remainingSec,
    elapsedPlaySec,
    hintsEnabled,
    hintsUsed,
    activePairs,
    sideACards,
    sideBCards,
    memoryDeck,
    matchedPairIds,
    matchOrderMap,
    attemptsCount,
    wrongCount,
    classScore,
    teams,
    activeTeamIndex,
    activeStudent,
    turnLogs,
    lastExplanation,
  ]);

  // Speak Vietnamese text safely
  const handleSpeakVietnamese = useCallback(
    (textToSpeak: string) => {
      if (!voiceManagerRef.current) return;
      const clean = textToSpeak.replace(/\$+/g, '').trim();
      const outcome = voiceManagerRef.current.speakVietnamese(clean, effectiveMuted);
      if (!outcome.spoken) {
        if (outcome.reason === 'no_vietnamese_voice' || outcome.reason === 'unsupported') {
          setVoiceNotice('Trình duyệt trên máy này chưa cài gói giọng đọc tiếng Việt (vi-VN). Bạn vẫn có thể chơi bình thường.');
        } else if (outcome.reason === 'muted_or_disabled') {
          setVoiceNotice('Âm thanh đang tắt. Hãy bật âm thanh trên thanh công cụ để nghe giọng đọc.');
        }
      } else {
        setVoiceNotice(null);
      }
    },
    [effectiveMuted]
  );

  // Single-source-of-truth Timer Effect (respects PAUSED and deadlineMsRef)
  useEffect(() => {
    const isPlayingPhase =
      phase === 'READY' ||
      phase === 'FIRST_SELECTED' ||
      phase === 'SECOND_SELECTED' ||
      phase === 'EVALUATING' ||
      phase === 'FEEDBACK' ||
      phase === 'NEXT_TURN';

    if (!isPlayingPhase) return;

    playStartMsRef.current = Date.now();
    if (timeLimitSec > 0 && deadlineMsRef.current === null) {
      deadlineMsRef.current = Date.now() + remainingSec * 1000;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      if (playStartMsRef.current !== null) {
        const deltaSec = Math.floor((now - playStartMsRef.current) / 1000);
        setElapsedPlaySec(accumulatedPlaySecRef.current + deltaSec);
      }

      if (timeLimitSec > 0 && deadlineMsRef.current !== null) {
        const leftMs = deadlineMsRef.current - now;
        const leftSec = Math.max(0, Math.ceil(leftMs / 1000));
        setRemainingSec(leftSec);

        if (leftMs <= 0) {
          window.clearInterval(interval);
          // Only expire if not already finished
          if (!isEvaluatingRef.current) {
            clearAllTimers();
            voiceManagerRef.current?.cancel();
            setPhase('FINISHED');
            setStatusBanner({
              type: 'warning',
              message: 'Đã hết thời gian phiên chơi! Hệ thống đã khóa bảng và ghi nhận kết quả.',
            });
          }
        }
      }
    }, 250);

    return () => {
      if (playStartMsRef.current !== null) {
        accumulatedPlaySecRef.current += Math.floor((Date.now() - playStartMsRef.current) / 1000);
        playStartMsRef.current = null;
      }
      window.clearInterval(interval);
    };
  }, [phase, timeLimitSec, clearAllTimers]);

  // Start a new session (shuffles cards ONCE at creation)
  const handleStartNewSession = useCallback(
    (overridePairCount?: 4 | 6 | 8) => {
      const targetCount = overridePairCount || pairCount;
      if (datasetValidation.validPairs.length < targetCount) return;

      clearAllTimers();
      voiceManagerRef.current?.cancel();

      const newSessId = `b08_${Date.now().toString(36)}`;
      sessionIdRef.current = newSessId;
      turnSequenceRef.current += 1;
      isEvaluatingRef.current = false;
      scoredPairIdsRef.current = new Set();

      // Shuffle valid pairs and slice exact targetCount
      const chosenPairs = fisherYatesShuffle(datasetValidation.validPairs).slice(0, targetCount);

      const cardsA: KnowledgeCardItem[] = chosenPairs.map((p) => ({
        cardId: `${newSessId}_A_${p.pairId}`,
        pairId: p.pairId,
        side: 'A',
        content: p.sideAContent,
        explanation: p.explanation,
        topicTag: p.topicTag,
      }));

      const cardsB: KnowledgeCardItem[] = chosenPairs.map((p) => ({
        cardId: `${newSessId}_B_${p.pairId}`,
        pairId: p.pairId,
        side: 'B',
        content: p.sideBContent,
        explanation: p.explanation,
        topicTag: p.topicTag,
      }));

      // Shuffle Side A and Side B independently ONCE
      const shuffledA = fisherYatesShuffle(cardsA);
      const shuffledB = fisherYatesShuffle(cardsB);
      // Unified shuffled deck for Memory Flip mode
      const unifiedMemory = fisherYatesShuffle([...cardsA, ...cardsB]);

      const initialTeams: B08TeamItem[] = TEAM_PALETTE.slice(0, teamCount).map((t, idx) => ({
        id: `b08_team_${idx + 1}`,
        name: t.name,
        colorHex: t.colorHex,
        score: 0,
        matchedCount: 0,
        attempts: 0,
      }));

      setSessionId(newSessId);
      if (overridePairCount) setPairCount(overridePairCount);
      setActivePairs(chosenPairs);
      setSideACards(shuffledA);
      setSideBCards(shuffledB);
      setMemoryDeck(unifiedMemory);
      setSelectedCard1(null);
      setSelectedCard2(null);
      setMatchedPairIds(new Set());
      setMatchOrderMap({});
      setMismatchCardIds(new Set());
      setHintHighlightedPairId(null);
      setAttemptsCount(0);
      setWrongCount(0);
      setHintsUsed(0);
      setClassScore(0);
      setTeams(initialTeams);
      setActiveTeamIndex(0);
      setTurnLogs([]);
      setLastExplanation(null);
      setRestorableSession(null);

      if (orgMode === 'INDIVIDUAL' && presentStudents.length > 0) {
        setActiveStudent(presentStudents[secureRandomInt(presentStudents.length)]);
      } else {
        setActiveStudent(null);
      }

      accumulatedPlaySecRef.current = 0;
      playStartMsRef.current = Date.now();
      setElapsedPlaySec(0);
      if (timeLimitSec > 0) {
        setRemainingSec(timeLimitSec);
        deadlineMsRef.current = Date.now() + timeLimitSec * 1000;
      } else {
        setRemainingSec(0);
        deadlineMsRef.current = null;
      }

      setStatusBanner({
        type: 'info',
        message:
          playMode === 'VISUAL_MATCH'
            ? 'Hãy chọn 1 thẻ ở Cột A và 1 thẻ tương ứng ở Cột B (hoặc ngược lại) để kết nối tri thức.'
            : 'Chế độ Lật thẻ ghi nhớ: Mỗi lượt chọn mở 2 thẻ (1 thẻ Phía A và 1 thẻ Phía B tương ứng).',
      });
      setPhase('READY');
    },
    [
      pairCount,
      datasetValidation.validPairs,
      clearAllTimers,
      teamCount,
      orgMode,
      presentStudents,
      timeLimitSec,
      playMode,
    ]
  );

  // Restore saved session without re-shuffling cards
  const handleRestoreSavedSession = () => {
    if (!restorableSession) return;
    clearAllTimers();
    voiceManagerRef.current?.cancel();

    sessionIdRef.current = restorableSession.sessionId;
    turnSequenceRef.current += 1;
    isEvaluatingRef.current = false;
    scoredPairIdsRef.current = new Set(restorableSession.matchedPairIds);

    setSessionId(restorableSession.sessionId);
    setPlayMode(restorableSession.playMode);
    setOrgMode(restorableSession.orgMode);
    setDatasetKey(restorableSession.datasetKey);
    setPairCount(restorableSession.pairCount);
    setTimeLimitSec(restorableSession.timeLimitSec);
    setRemainingSec(restorableSession.remainingSec);
    setElapsedPlaySec(restorableSession.elapsedPlaySec);
    accumulatedPlaySecRef.current = restorableSession.elapsedPlaySec;
    deadlineMsRef.current =
      restorableSession.timeLimitSec > 0
        ? Date.now() + restorableSession.remainingSec * 1000
        : null;

    setHintsEnabled(restorableSession.hintsEnabled);
    setHintsUsed(restorableSession.hintsUsed);
    setActivePairs(restorableSession.activePairs);
    setSideACards(restorableSession.sideACards);
    setSideBCards(restorableSession.sideBCards);
    setMemoryDeck(restorableSession.memoryDeck);
    setMatchedPairIds(new Set(restorableSession.matchedPairIds));
    setMatchOrderMap(restorableSession.matchOrderMap || {});
    setAttemptsCount(restorableSession.attemptsCount);
    setWrongCount(restorableSession.wrongCount);
    setClassScore(restorableSession.classScore);
    setTeams(restorableSession.teams);
    setActiveTeamIndex(restorableSession.activeTeamIndex);
    setTurnLogs(restorableSession.turnLogs || []);
    setLastExplanation(restorableSession.lastExplanation);
    setSelectedCard1(null);
    setSelectedCard2(null);
    setMismatchCardIds(new Set());
    setRestorableSession(null);

    if (restorableSession.activeStudentId && presentStudents.length > 0) {
      const found = presentStudents.find((s) => s.id === restorableSession.activeStudentId);
      setActiveStudent(found || presentStudents[0]);
    }

    setStatusBanner({
      type: 'info',
      message: 'Đã khôi phục phiên chơi trước đó (giữ nguyên vị trí các thẻ và điểm số).',
    });
    setPhase('READY');
  };

  // Pause / Resume Handlers
  const handleTogglePause = () => {
    if (phase === 'SETUP' || phase === 'FINISHED') return;
    if (phase === 'PAUSED') {
      // Resume
      if (timeLimitSec > 0) {
        deadlineMsRef.current = Date.now() + remainingSec * 1000;
      }
      playStartMsRef.current = Date.now();
      setPhase(phaseBeforePauseRef.current);
      setStatusBanner({
        type: 'info',
        message: 'Đã tiếp tục phiên chơi.',
      });
    } else {
      // Pause
      clearAllTimers();
      voiceManagerRef.current?.cancel();
      isEvaluatingRef.current = false;
      setMismatchCardIds(new Set());
      if (playMode === 'MEMORY_FLIP') {
        // Clear half-open cards on pause so nothing stays stuck
        setSelectedCard1(null);
        setSelectedCard2(null);
        phaseBeforePauseRef.current = 'READY';
      } else {
        phaseBeforePauseRef.current = selectedCard1 ? 'FIRST_SELECTED' : 'READY';
      }
      deadlineMsRef.current = null;
      setPhase('PAUSED');
    }
  };

  // Trigger Hint (Max 2 hints per session; highlights an unmatched pair briefly without awarding points)
  const handleTriggerHint = () => {
    if (
      !hintsEnabled ||
      hintsUsed >= maxHints ||
      phase === 'PAUSED' ||
      phase === 'FINISHED' ||
      phase === 'SETUP' ||
      isEvaluatingRef.current
    ) {
      return;
    }

    const unmatched = activePairs.filter((p) => !matchedPairIds.has(p.pairId));
    if (unmatched.length === 0) return;

    const targetPair = unmatched[secureRandomInt(unmatched.length)];
    const activeTurnSeq = turnSequenceRef.current;
    const activeSessId = sessionIdRef.current;

    setHintsUsed((prev) => prev + 1);
    setHintHighlightedPairId(targetPair.pairId);
    b08Sound.playCardSelect(effectiveMuted);
    setStatusBanner({
      type: 'info',
      message: `Gợi ý (${hintsUsed + 1}/${maxHints}): Hai thẻ thuộc cùng một cặp đang sáng viền vàng. Hãy chạm chọn để ghép!`,
    });

    const tid = window.setTimeout(
      () => {
        if (sessionIdRef.current !== activeSessId || turnSequenceRef.current !== activeTurnSeq) {
          return;
        }
        setHintHighlightedPairId(null);
      },
      reduceMotion ? 1400 : 2400
    );
    timersRef.current.push(tid);
  };

  // Core Pair Evaluation Logic (FIRST_SELECTED -> SECOND_SELECTED -> EVALUATING -> FEEDBACK -> NEXT_TURN / FINISHED)
  const evaluateSelectedPair = useCallback(
    (first: KnowledgeCardItem, second: KnowledgeCardItem) => {
      if (isEvaluatingRef.current) return;
      // Check if time already expired before evaluation started
      if (timeLimitSec > 0 && deadlineMsRef.current !== null && Date.now() > deadlineMsRef.current) {
        setPhase('FINISHED');
        return;
      }

      isEvaluatingRef.current = true;
      turnSequenceRef.current += 1;
      const currentSeq = turnSequenceRef.current;
      const currentSess = sessionIdRef.current;

      // Capture current team / student BEFORE animation starts so points always go to the actor of this turn
      const actingTeamIdx = activeTeamIndex;
      const actingTeam = teams[actingTeamIdx];
      const actingStudent = activeStudent;

      setSelectedCard1(first);
      setSelectedCard2(second);
      setHintHighlightedPairId(null);
      setPhase('EVALUATING');

      const result = evaluateCardMatch(first, second, scoredPairIdsRef.current);
      const nextAttempts = attemptsCount + 1;
      setAttemptsCount(nextAttempts);

      const cardALabel = first.side === 'A' ? first.content : second.content;
      const cardBLabel = first.side === 'B' ? first.content : second.content;
      const actorName =
        orgMode === 'TEAMS'
          ? actingTeam?.name || `Đội ${actingTeamIdx + 1}`
          : orgMode === 'INDIVIDUAL' && actingStudent
          ? actingStudent.fullName
          : 'Cả lớp';

      if (result.isMatch) {
        // Guard against duplicate scoring for the same pairId
        scoredPairIdsRef.current.add(first.pairId);
        const nextMatchedSet = new Set(scoredPairIdsRef.current);
        const matchOrderNumber = nextMatchedSet.size;

        setMatchedPairIds(nextMatchedSet);
        setMatchOrderMap((prev) => ({ ...prev, [first.pairId]: matchOrderNumber }));
        setClassScore((prev) => prev + 10);

        if (orgMode === 'TEAMS') {
          setTeams((prev) =>
            prev.map((t, idx) =>
              idx === actingTeamIdx
                ? {
                    ...t,
                    score: t.score + 10,
                    matchedCount: t.matchedCount + 1,
                    attempts: t.attempts + 1,
                  }
                : t
            )
          );
        } else if (orgMode === 'INDIVIDUAL' && actingStudent) {
          onPick?.(actingStudent, {
            bonusPoints: 10,
            note: `B08 Ghép đúng: ${cardALabel} ↔ ${cardBLabel}`,
            sessionId: currentSess,
          });
        }

        const logEntry: B08TurnLog = {
          turnId: `turn_${currentSess}_${currentSeq}`,
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          actorLabel: actorName,
          cardA: cardALabel,
          cardB: cardBLabel,
          isCorrect: true,
          pointsAwarded: 10,
          pairId: first.pairId,
        };
        setTurnLogs((prev) => [logEntry, ...prev]);

        setLastExplanation({
          pairId: first.pairId,
          sideAContent: cardALabel,
          sideBContent: cardBLabel,
          explanation: first.explanation,
        });

        setStatusBanner({
          type: 'success',
          message: `Chính xác! +10 điểm cho ${actorName}. Đã mở củng cố kiến thức bên dưới.`,
        });
        setPhase('FEEDBACK');

        const isAllCompleted = nextMatchedSet.size >= activePairs.length;
        if (isAllCompleted) {
          b08Sound.playVictoryFanfare(effectiveMuted);
        } else {
          b08Sound.playMatchSuccess(effectiveMuted);
        }

        const delayMs = reduceMotion ? 220 : 520;
        const tid = window.setTimeout(() => {
          if (sessionIdRef.current !== currentSess || turnSequenceRef.current !== currentSeq) {
            return;
          }
          isEvaluatingRef.current = false;
          setSelectedCard1(null);
          setSelectedCard2(null);

          if (isAllCompleted) {
            setPhase('FINISHED');
          } else {
            if (orgMode === 'TEAMS') {
              setActiveTeamIndex((actingTeamIdx + 1) % teams.length);
            } else if (orgMode === 'INDIVIDUAL' && presentStudents.length > 1) {
              const others = presentStudents.filter((s) => s.id !== actingStudent?.id);
              setActiveStudent(others[secureRandomInt(others.length)]);
            }
            setPhase('READY');
          }
        }, delayMs);
        timersRef.current.push(tid);
      } else {
        // MISMATCH
        setWrongCount((prev) => prev + 1);
        setMismatchCardIds(new Set([first.cardId, second.cardId]));
        b08Sound.playMatchMismatch(effectiveMuted);

        if (orgMode === 'TEAMS') {
          setTeams((prev) =>
            prev.map((t, idx) =>
              idx === actingTeamIdx ? { ...t, attempts: t.attempts + 1 } : t
            )
          );
        }

        const logEntry: B08TurnLog = {
          turnId: `turn_${currentSess}_${currentSeq}`,
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          actorLabel: actorName,
          cardA: first.content,
          cardB: second.content,
          isCorrect: false,
          pointsAwarded: 0,
        };
        setTurnLogs((prev) => [logEntry, ...prev]);

        setStatusBanner({
          type: 'error',
          message:
            result.reason === 'SAME_SIDE'
              ? 'Chưa đúng: Hai thẻ vừa lật cùng thuộc một phía. Hãy chọn 1 thẻ Phía A và 1 thẻ Phía B!'
              : 'Chưa đúng, hãy thử lại! (+0 điểm, không trừ điểm)',
        });
        setPhase('FEEDBACK');

        const mismatchHoldMs =
          playMode === 'MEMORY_FLIP'
            ? reduceMotion
              ? 550
              : 1350
            : reduceMotion
            ? 250
            : 650;

        const tid = window.setTimeout(() => {
          if (sessionIdRef.current !== currentSess || turnSequenceRef.current !== currentSeq) {
            return;
          }
          isEvaluatingRef.current = false;
          setMismatchCardIds(new Set());
          setSelectedCard1(null);
          setSelectedCard2(null);

          if (orgMode === 'TEAMS') {
            setActiveTeamIndex((actingTeamIdx + 1) % teams.length);
          } else if (orgMode === 'INDIVIDUAL' && presentStudents.length > 1) {
            const others = presentStudents.filter((s) => s.id !== actingStudent?.id);
            setActiveStudent(others[secureRandomInt(others.length)]);
          }
          setPhase('READY');
        }, mismatchHoldMs);
        timersRef.current.push(tid);
      }
    },
    [
      timeLimitSec,
      activeTeamIndex,
      teams,
      activeStudent,
      attemptsCount,
      orgMode,
      onPick,
      activePairs.length,
      effectiveMuted,
      reduceMotion,
      presentStudents,
      playMode,
    ]
  );

  // Skip current feedback animation immediately while preserving evaluated result
  const handleSkipFeedbackWait = () => {
    if (!isEvaluatingRef.current) return;
    clearAllTimers();
    turnSequenceRef.current += 1;
    isEvaluatingRef.current = false;
    setMismatchCardIds(new Set());
    setSelectedCard1(null);
    setSelectedCard2(null);

    if (matchedPairIds.size >= activePairs.length) {
      setPhase('FINISHED');
    } else {
      if (orgMode === 'TEAMS') {
        setActiveTeamIndex((prev) => (prev + 1) % teams.length);
      }
      setPhase('READY');
    }
  };

  // Handle Card Click / Keyboard Select in both modes
  const handleSelectCard = useCallback(
    (card: KnowledgeCardItem) => {
      if (
        phase === 'SETUP' ||
        phase === 'PAUSED' ||
        phase === 'FINISHED' ||
        isEvaluatingRef.current
      ) {
        return;
      }
      if (matchedPairIds.has(card.pairId)) {
        return;
      }

      if (playMode === 'VISUAL_MATCH') {
        // Visual Match Mode:
        // 1. Clicking the currently selected card deselects it
        if (selectedCard1 && selectedCard1.cardId === card.cardId) {
          setSelectedCard1(null);
          setPhase('READY');
          return;
        }
        // 2. If no card selected yet -> select as first card
        if (!selectedCard1) {
          b08Sound.playCardSelect(effectiveMuted);
          setSelectedCard1(card);
          setPhase('FIRST_SELECTED');
          return;
        }
        // 3. If clicking another card on the SAME side -> replace selection on that side
        if (selectedCard1.side === card.side) {
          b08Sound.playCardSelect(effectiveMuted);
          setSelectedCard1(card);
          setPhase('FIRST_SELECTED');
          return;
        }
        // 4. Opposite side selected -> evaluate pair!
        b08Sound.playCardSelect(effectiveMuted);
        evaluateSelectedPair(selectedCard1, card);
      } else {
        // Memory Flip Mode:
        // Cannot select the same card twice
        if (selectedCard1 && selectedCard1.cardId === card.cardId) {
          return;
        }
        if (!selectedCard1) {
          b08Sound.playCardSelect(effectiveMuted);
          setSelectedCard1(card);
          setPhase('FIRST_SELECTED');
          return;
        }
        // Second card flipped -> evaluate pair
        b08Sound.playCardSelect(effectiveMuted);
        evaluateSelectedPair(selectedCard1, card);
      }
    },
    [
      phase,
      matchedPairIds,
      playMode,
      selectedCard1,
      effectiveMuted,
      evaluateSelectedPair,
    ]
  );

  // Drag & Drop support for Visual Match mode
  const handleDropOnCard = (targetCard: KnowledgeCardItem) => {
    if (!draggedCard || playMode !== 'VISUAL_MATCH' || isEvaluatingRef.current) return;
    if (matchedPairIds.has(targetCard.pairId) || matchedPairIds.has(draggedCard.pairId)) return;
    if (draggedCard.side === targetCard.side) return;
    b08Sound.playCardSelect(effectiveMuted);
    evaluateSelectedPair(draggedCard, targetCard);
    setDraggedCard(null);
  };

  // Early Finish / Return to Setup with Confirmation if session in progress
  const handleEndSessionEarly = () => {
    clearAllTimers();
    voiceManagerRef.current?.cancel();
    isEvaluatingRef.current = false;
    setSelectedCard1(null);
    setSelectedCard2(null);
    setMismatchCardIds(new Set());
    setPhase('FINISHED');
  };

  const handleReturnToSetup = () => {
    if (
      phase !== 'SETUP' &&
      phase !== 'FINISHED' &&
      attemptsCount > 0 &&
      !window.confirm('Bạn có chắc muốn quay về màn hình Thiết lập? Tiến độ phiên đang chơi sẽ kết thúc.')
    ) {
      return;
    }
    clearAllTimers();
    voiceManagerRef.current?.cancel();
    isEvaluatingRef.current = false;
    try {
      window.localStorage.removeItem(B08_SESSION_STORAGE_KEY);
    } catch {}
    setPhase('SETUP');
  };

  // Format seconds as MM:SS
  const formatClock = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Compute Leaderboard with Tie Detection (Đồng hạng)
  const rankedTeams = useMemo(() => {
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    let currentRank = 1;
    return sorted.map((team, idx) => {
      if (idx > 0 && team.score < sorted[idx - 1].score) {
        currentRank = idx + 1;
      }
      const isTied = sorted.filter((t) => t.score === team.score).length > 1;
      return { ...team, rank: currentRank, isTied };
    });
  }, [teams]);

  const unmatchedPairsList = useMemo(
    () => activePairs.filter((p) => !matchedPairIds.has(p.pairId)),
    [activePairs, matchedPairIds]
  );

  // ============================================================================
  // RENDER UI
  // ============================================================================

  return (
    <div className="w-full flex flex-col space-y-3 font-sans text-slate-100 select-none">
      {/* =====================================================================
          TOP STAGE BAR: Quay lại · B08 – Ghép cặp kiến thức · Âm thanh · Toàn màn hình
         ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-[#0A1628] border border-sky-400/30 shadow-lg">
        <div className="flex items-center gap-2.5">
          {onCloseGame && (
            <button
              type="button"
              onClick={() => {
                voiceManagerRef.current?.cancel();
                clearAllTimers();
                onCloseGame();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600/80 text-xs font-bold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              ← Quay lại thư viện
            </button>
          )}
          {phase !== 'SETUP' && (
            <button
              type="button"
              onClick={handleReturnToSetup}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600/80 text-xs font-bold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Thiết lập phiên</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider text-cyan-300 uppercase">B08</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <h2 className="text-sm sm:text-base font-extrabold text-white whitespace-nowrap">
              Ghép cặp kiến thức
            </h2>
            <span aria-hidden="true" className="hidden sm:inline text-slate-500">·</span>
            <span className="hidden sm:inline text-xs text-sky-200/80 font-medium truncate max-w-[180px]">
              {resolvedClassName}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReduceMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              reduceMotion
                ? 'bg-amber-400/20 border-amber-400/60 text-amber-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Giảm hiệu ứng chuyển động"
          >
            {reduceMotion ? 'Giảm chuyển động: Bật' : 'Giảm chuyển động'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (onToggleMute) {
                onToggleMute();
              } else {
                setLocalAudioOn((v) => !v);
              }
              voiceManagerRef.current?.cancel();
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {effectiveMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                <span>Đã tắt âm</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Âm thanh</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-sky-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Hướng dẫn</span>
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-3 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 border border-sky-400/50 text-xs font-bold text-sky-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Thoát toàn màn hình</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Toàn màn hình</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          1. SETUP SCREEN (MÀN HÌNH THIẾT LẬP PHIÊN)
         ===================================================================== */}
      {phase === 'SETUP' && (
        <div className="w-full rounded-3xl border-2 border-sky-400/40 bg-gradient-to-b from-[#0A1628] via-[#0F2442] to-[#091326] p-5 sm:p-7 shadow-2xl space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-sky-300/20">
            <div className="flex items-center gap-4">
              <HallOfKnowledgeCrest3D className="w-16 h-16 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-300 tracking-wide">
                  Tây Đô Smart EDU · Khởi động tiết học (3–7 phút)
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Đại Sảnh Kết Nối Tri Thức 3D
                </h1>
                <p className="text-xs sm:text-sm text-sky-100/80 mt-0.5">
                  Ghép đúng các cặp khái niệm – định nghĩa, phép tính – kết quả hoặc thiết bị – chức năng kèm giải thích củng cố kiến thức.
                </p>
              </div>
            </div>

            {restorableSession && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/50 flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <div className="text-xs">
                  <div className="font-extrabold text-amber-300">Có phiên đang chơi dở!</div>
                  <div className="text-amber-100/90 tabular-nums">
                    Đã ghép {restorableSession.matchedPairIds.length}/{restorableSession.activePairs.length} cặp · {restorableSession.attemptsCount} lần thử
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreSavedSession}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer whitespace-nowrap"
                >
                  Khôi phục phiên
                </button>
              </div>
            )}
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Cols: Mode & Dataset Selection */}
            <div className="lg:col-span-7 space-y-4">
              {/* 1. Chế độ chơi */}
              <div className="p-4 rounded-2xl bg-slate-900/75 border border-sky-400/25 space-y-2.5">
                <label className="block text-xs font-extrabold text-sky-300">
                  01. Chọn chế độ chơi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPlayMode('VISUAL_MATCH')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      playMode === 'VISUAL_MATCH'
                        ? 'bg-sky-500/25 border-sky-400 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">1. Ghép cặp trực quan (Cột A ↔ B)</span>
                      <span className="text-[11px] font-bold text-amber-300">Mặc định</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Hiển thị rõ nội dung hai phía A và B. Chọn hoặc kéo thả để kết nối cặp đúng và xem giải thích.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlayMode('MEMORY_FLIP')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      playMode === 'MEMORY_FLIP'
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">2. Lật thẻ ghi nhớ 3D</span>
                      <Layers className="w-4 h-4 text-amber-300" />
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Tất cả thẻ úp xuống (có nhãn trung tính Phía A / Phía B). Mỗi lượt lật tối đa 2 thẻ để tìm cặp đúng.
                    </p>
                  </button>
                </div>
              </div>

              {/* 2. Bộ kiến thức */}
              <div className="p-4 rounded-2xl bg-slate-900/75 border border-sky-400/25 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-sky-300">
                    02. Chọn bộ nội dung ghép cặp
                  </label>
                  <span className="text-xs text-slate-300 tabular-nums">
                    Hợp lệ: <strong className="text-emerald-400">{availableValidCount}</strong> cặp
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      key: 'SAMPLE_MATH6' as B08DatasetKey,
                      title: 'Bộ A — Toán 6: Phép tính & Kết quả',
                      sub: 'Dữ liệu mẫu · 8 cặp chuẩn',
                    },
                    {
                      key: 'SAMPLE_INFO' as B08DatasetKey,
                      title: 'Bộ B — Tin học: Thiết bị & Chức năng',
                      sub: 'Dữ liệu mẫu · 8 cặp chuẩn',
                    },
                    {
                      key: 'SAMPLE_GEO_SCI' as B08DatasetKey,
                      title: 'Bộ C — Hình học & KHTN THCS',
                      sub: 'Dữ liệu mẫu · 8 cặp tổng hợp',
                    },
                    {
                      key: 'QUESTION_BANK' as B08DatasetKey,
                      title: 'Ngân hàng câu hỏi hệ thống',
                      sub: `Đang có ${bankConvertedPairs.length} câu đủ điều kiện`,
                    },
                    {
                      key: 'CUSTOM' as B08DatasetKey,
                      title: 'Bộ cặp kiến thức tự soạn',
                      sub: `Đang lưu ${customPairs.length} cặp tại máy`,
                    },
                  ].map((ds) => (
                    <button
                      key={ds.key}
                      type="button"
                      onClick={() => setDatasetKey(ds.key)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        datasetKey === ds.key
                          ? 'bg-sky-500/25 border-sky-400 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-white">{ds.title}</div>
                      <div className="text-[11px] text-sky-200/80 mt-0.5">{ds.sub}</div>
                    </button>
                  ))}
                </div>

                {/* Filters when Question Bank is chosen */}
                {datasetKey === 'QUESTION_BANK' && (
                  <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-300 font-bold">Lọc ngân hàng:</span>
                    <select
                      value={qbGrade}
                      onChange={(e) => setQbGrade(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold"
                    >
                      <option value="all">Tất cả khối (6–9)</option>
                      <option value="6">Khối 6</option>
                      <option value="7">Khối 7</option>
                      <option value="8">Khối 8</option>
                      <option value="9">Khối 9</option>
                    </select>
                    <select
                      value={qbSubject}
                      onChange={(e) => setQbSubject(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold"
                    >
                      <option value="all">Tất cả môn</option>
                      <option value="math">Toán học</option>
                      <option value="informatics">Tin học</option>
                      <option value="science">Khoa học tự nhiên</option>
                    </select>
                  </div>
                )}

                {/* Custom Pairs Editor when CUSTOM is chosen */}
                {datasetKey === 'CUSTOM' && (
                  <div className="pt-2 space-y-2.5 border-t border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        value={newSideA}
                        onChange={(e) => setNewSideA(e.target.value)}
                        placeholder="Nội dung Phía A (VD: Khái niệm / Phép tính)"
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                      />
                      <input
                        type="text"
                        value={newSideB}
                        onChange={(e) => setNewSideB(e.target.value)}
                        placeholder="Nội dung Phía B (VD: Định nghĩa / Kết quả)"
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                      />
                    </div>
                    <div className="flex gap-2 text-xs">
                      <input
                        type="text"
                        value={newExplanation}
                        onChange={(e) => setNewExplanation(e.target.value)}
                        placeholder="Giải thích ngắn củng cố kiến thức sau khi ghép đúng..."
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomPair}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm cặp</span>
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {customPairs.map((cp, idx) => (
                        <div
                          key={cp.pairId}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <span className="truncate">
                            <strong>#{idx + 1}:</strong> {cp.sideAContent} ↔ {cp.sideBContent}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomPair(cp.pairId)}
                            className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                            title="Xóa cặp này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dataset Warnings (Ambiguity or Insufficient Pairs) */}
                {datasetValidation.ambiguousWarnings.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Phát hiện cặp có nội dung trùng lặp (đã tự động lọc để tránh chấm sai):</span>
                    </div>
                    <ul className="list-disc list-inside opacity-90 space-y-0.5">
                      {datasetValidation.ambiguousWarnings.slice(0, 3).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {isShortOnPairs && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/50 text-xs text-rose-200 space-y-2">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        Bộ nội dung đang chọn chỉ có {availableValidCount} cặp hợp lệ (cần {pairCount} cặp, còn thiếu{' '}
                        {pairCount - availableValidCount} cặp). Hệ thống không tự nhân bản cặp trùng lặp.
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {availableValidCount >= 4 && pairCount > 4 && (
                        <button
                          type="button"
                          onClick={() => setPairCount(availableValidCount >= 6 ? 6 : 4)}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-black cursor-pointer"
                        >
                          Giảm xuống {availableValidCount >= 6 ? 6 : 4} cặp
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDatasetKey('SAMPLE_MATH6')}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 text-white font-bold cursor-pointer"
                      >
                        Dùng Bộ mẫu Toán 6 (8 cặp)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Pair Count, Organization Mode, Time Limit, Hints */}
            <div className="lg:col-span-5 space-y-4">
              {/* 3. Số lượng cặp */}
              <div className="p-4 rounded-2xl bg-slate-900/75 border border-sky-400/25 space-y-2.5">
                <label className="block text-xs font-extrabold text-sky-300">
                  03. Số cặp kiến thức trong phiên
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([4, 6, 8] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setPairCount(cnt)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer tabular-nums ${
                        pairCount === cnt
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {cnt} cặp ({cnt * 2} thẻ)
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Tổ chức lớp: Cả lớp, Cá nhân, 2–6 Đội */}
              <div className="p-4 rounded-2xl bg-slate-900/75 border border-sky-400/25 space-y-3">
                <label className="block text-xs font-extrabold text-sky-300">
                  04. Hình thức tham gia (1–50 học sinh)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'CLASS' as B08OrgMode, label: 'Cả lớp' },
                    { key: 'INDIVIDUAL' as B08OrgMode, label: 'Cá nhân' },
                    { key: 'TEAMS' as B08OrgMode, label: 'Theo đội (2–6)' },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => handleSelectOrgMode(m.key)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                        orgMode === m.key
                          ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {orgMode === 'TEAMS' && (
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Số đội thi đấu luân phiên:</span>
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setTeamCount(n)}
                          className={`w-8 h-8 rounded-lg border font-black tabular-nums cursor-pointer ${
                            teamCount === n
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-slate-950 border-slate-700 text-slate-300'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Thời gian & Gợi ý */}
              <div className="p-4 rounded-2xl bg-slate-900/75 border border-sky-400/25 space-y-3">
                <label className="block text-xs font-extrabold text-sky-300">
                  05. Thời gian & Quyền gợi ý
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { sec: 0, label: 'Không giới hạn' },
                    { sec: 120, label: '2 phút' },
                    { sec: 180, label: '3 phút' },
                    { sec: 300, label: '5 phút' },
                  ].map((t) => (
                    <button
                      key={t.sec}
                      type="button"
                      onClick={() => setTimeLimitSec(t.sec)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        timeLimitSec === t.sec
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="pt-1 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200">Cho phép gợi ý (tối đa 2 lần/phiên):</span>
                    <p className="text-[11px] text-slate-400">
                      Làm nổi bật ngắn 2 thẻ cùng cặp, không tự cộng điểm.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHintsEnabled((v) => !v)}
                    className={`px-3.5 py-1.5 rounded-xl border font-black cursor-pointer ${
                      hintsEnabled
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                        : 'bg-slate-950 border-slate-700 text-slate-400'
                    }`}
                  >
                    {hintsEnabled ? 'BẬT' : 'TẮT'}
                  </button>
                </div>
              </div>

              {/* Start Button */}
              <button
                type="button"
                disabled={isShortOnPairs}
                onClick={() => handleStartNewSession()}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:brightness-105 disabled:opacity-40 text-slate-950 font-black text-base shadow-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Bắt đầu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. ACTIVE 3D STAGE (READY / SELECTING / EVALUATING / PAUSED)
         ===================================================================== */}
      {phase !== 'SETUP' && phase !== 'FINISHED' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* CENTER 3D BOARD AREA (9 Cols on Desktop so cards take the majority of space) */}
          <div className="lg:col-span-9 rounded-3xl border-2 border-sky-400/40 bg-gradient-to-b from-[#0A1628] via-[#102444] to-[#081224] p-4 sm:p-6 shadow-2xl flex flex-col justify-between space-y-4 relative overflow-hidden">
            {/* Top Status Strip inside Stage */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sky-300/20 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-sky-100">
                <span className="font-extrabold text-amber-300">
                  {playMode === 'VISUAL_MATCH' ? 'Ghép cặp trực quan (A ↔ B)' : 'Lật thẻ ghi nhớ 3D'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Đã ghép: <strong className="text-emerald-300">{matchedPairIds.size}/{activePairs.length}</strong> cặp
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Số lần thử: <strong className="text-white">{attemptsCount}</strong>
                </span>
                {activePairs[0]?.isSample && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300 font-bold">Dữ liệu mẫu</span>
                  </>
                )}
              </div>

              {/* Active Turn Indicator */}
              <div className="flex items-center gap-2">
                {orgMode === 'TEAMS' && teams[activeTeamIndex] && (
                  <div className="px-3 py-1 rounded-xl bg-slate-950/90 border border-amber-400/60 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: teams[activeTeamIndex].colorHex }}
                    />
                    <span className="font-black text-amber-300 truncate max-w-[160px]">
                      Lượt: {teams[activeTeamIndex].name}
                    </span>
                  </div>
                )}

                {orgMode === 'INDIVIDUAL' && (
                  <div className="px-3 py-1 rounded-xl bg-slate-950/90 border border-sky-400/50 flex items-center gap-2">
                    <span className="font-bold text-sky-200 truncate max-w-[170px]">
                      HS: {activeStudent ? activeStudent.fullName : 'Tự chọn trên lớp'}
                    </span>
                    {presentStudents.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveStudent(presentStudents[secureRandomInt(presentStudents.length)])
                        }
                        className="text-amber-300 hover:underline font-extrabold cursor-pointer"
                      >
                        Đổi bạn
                      </button>
                    )}
                  </div>
                )}

                {/* Clock Display */}
                <div className="px-3 py-1 rounded-xl bg-slate-950/90 border border-sky-400/40 font-mono font-black text-sm text-amber-300 flex items-center gap-1.5 tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-sky-300" />
                  <span>
                    {timeLimitSec > 0 ? formatClock(remainingSec) : formatClock(elapsedPlaySec)}
                  </span>
                </div>
              </div>
            </div>

            {/* Feedback & Action Banner */}
            {statusBanner && (
              <div
                className={`px-4 py-2.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-2 ${
                  statusBanner.type === 'success'
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-100'
                    : statusBanner.type === 'error'
                    ? 'bg-rose-500/20 border-rose-400/60 text-rose-100'
                    : statusBanner.type === 'warning'
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-100'
                    : 'bg-sky-500/15 border-sky-400/40 text-sky-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {statusBanner.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : statusBanner.type === 'error' ? (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                  )}
                  <span>{statusBanner.message}</span>
                </div>

                {isEvaluatingRef.current && (
                  <button
                    type="button"
                    onClick={handleSkipFeedbackWait}
                    className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Bỏ qua hoạt ảnh</span>
                  </button>
                )}
              </div>
            )}

            {/* PAUSED OVERLAY (Hides cards in Memory Mode and blocks clicks) */}
            {phase === 'PAUSED' ? (
              <div className="my-auto py-16 px-6 rounded-3xl bg-slate-950/95 border-2 border-amber-400/50 text-center space-y-4">
                <Pause className="w-12 h-12 text-amber-400 mx-auto" />
                <h3 className="text-xl font-black text-white">Phiên chơi đang tạm dừng</h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                  Đồng hồ đã tạm dừng và bảng thẻ đang được khóa bảo toàn trạng thái. Bấm &ldquo;Tiếp tục&rdquo; để quay lại lượt chơi.
                </p>
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm cursor-pointer inline-flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Tiếp tục chơi</span>
                </button>
              </div>
            ) : playMode === 'VISUAL_MATCH' ? (
              /* ===============================================================
                 MODE 1: VISUAL MATCHING (2 INDEPENDENT COLUMNS A & B)
                 =============================================================== */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 my-auto">
                {/* COLUMN A */}
                <div className="space-y-2.5">
                  <div className="px-3 py-1.5 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-between text-xs font-extrabold text-sky-200">
                    <span>CỘT A · KHÁI NIỆM / PHÉP TÍNH / THIẾT BỊ</span>
                    <span>Chọn 1 thẻ</span>
                  </div>

                  <div className="space-y-2.5">
                    {sideACards.map((card, idx) => {
                      const isMatched = matchedPairIds.has(card.pairId);
                      const matchedNum = matchOrderMap[card.pairId];
                      const isSelected =
                        selectedCard1?.cardId === card.cardId ||
                        selectedCard2?.cardId === card.cardId;
                      const isMismatch = mismatchCardIds.has(card.cardId);
                      const isHinted = hintHighlightedPairId === card.pairId && !isMatched;

                      return (
                        <div
                          key={card.cardId}
                          draggable={!isMatched && !isEvaluatingRef.current}
                          onDragStart={() => setDraggedCard(card)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropOnCard(card)}
                          className={`relative rounded-2xl border-2 transition-all duration-150 ${
                            isMatched
                              ? 'bg-emerald-950/60 border-emerald-400/75 shadow-[0_4px_0_#065f46]'
                              : isMismatch
                              ? 'bg-rose-950/80 border-rose-400 shadow-[0_4px_0_#9f1239] scale-[0.99]'
                              : isSelected
                              ? 'bg-[#FFFBEB] text-slate-950 border-amber-400 shadow-[0_6px_0_#d97706] -translate-y-0.5'
                              : isHinted
                              ? 'bg-amber-950/80 border-amber-300 shadow-[0_5px_0_#b45309] ring-2 ring-amber-300'
                              : 'bg-[#F8FAFC] text-[#0F172A] border-sky-300 hover:border-amber-400 shadow-[0_5px_0_#1e3a8a]'
                          }`}
                        >
                          <div className="flex items-stretch justify-between gap-2 p-3 sm:p-3.5">
                            <button
                              type="button"
                              disabled={isMatched}
                              onClick={() => handleSelectCard(card)}
                              className="flex-1 text-left flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg cursor-pointer disabled:cursor-default"
                            >
                              <span
                                className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 tabular-nums ${
                                  isMatched
                                    ? 'bg-emerald-500 text-slate-950'
                                    : isSelected
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-[#0F2942] text-sky-200'
                                }`}
                              >
                                A{idx + 1}
                              </span>
                              <div
                                className={`text-sm sm:text-base font-extrabold leading-snug break-words ${
                                  isMatched
                                    ? 'text-emerald-100'
                                    : isMismatch
                                    ? 'text-rose-100'
                                    : 'text-[#0F172A]'
                                }`}
                              >
                                <MathView content={card.content} />
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isMatched ? (
                                <span className="px-2 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[11px] font-black flex items-center gap-1 tabular-nums">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Cặp #{matchedNum}</span>
                                </span>
                              ) : isMismatch ? (
                                <span className="px-2 py-1 rounded-lg bg-rose-500/30 text-rose-200 text-[11px] font-black">
                                  Thử lại
                                </span>
                              ) : isSelected ? (
                                <span className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black">
                                  Đang chọn
                                </span>
                              ) : null}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSpeakVietnamese(card.content);
                                }}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  isMatched
                                    ? 'border-emerald-500/40 text-emerald-200 hover:bg-emerald-800/50'
                                    : 'border-slate-300 text-slate-600 hover:bg-slate-200'
                                }`}
                                title="Đọc nội dung thẻ bằng tiếng Việt"
                                aria-label={`Đọc thẻ A${idx + 1}`}
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>

                              {card.content.length > 36 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomedCard(card);
                                  }}
                                  className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-200 cursor-pointer"
                                  title="Phóng to nội dung thẻ"
                                  aria-label={`Phóng to thẻ A${idx + 1}`}
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* COLUMN B */}
                <div className="space-y-2.5">
                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-between text-xs font-extrabold text-amber-200">
                    <span>CỘT B · ĐỊNH NGHĨA / KẾT QUẢ / CHỨC NĂNG</span>
                    <span>Chọn 1 thẻ đối ứng</span>
                  </div>

                  <div className="space-y-2.5">
                    {sideBCards.map((card, idx) => {
                      const isMatched = matchedPairIds.has(card.pairId);
                      const matchedNum = matchOrderMap[card.pairId];
                      const isSelected =
                        selectedCard1?.cardId === card.cardId ||
                        selectedCard2?.cardId === card.cardId;
                      const isMismatch = mismatchCardIds.has(card.cardId);
                      const isHinted = hintHighlightedPairId === card.pairId && !isMatched;

                      return (
                        <div
                          key={card.cardId}
                          draggable={!isMatched && !isEvaluatingRef.current}
                          onDragStart={() => setDraggedCard(card)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropOnCard(card)}
                          className={`relative rounded-2xl border-2 transition-all duration-150 ${
                            isMatched
                              ? 'bg-emerald-950/60 border-emerald-400/75 shadow-[0_4px_0_#065f46]'
                              : isMismatch
                              ? 'bg-rose-950/80 border-rose-400 shadow-[0_4px_0_#9f1239] scale-[0.99]'
                              : isSelected
                              ? 'bg-[#FFFBEB] text-slate-950 border-amber-400 shadow-[0_6px_0_#d97706] -translate-y-0.5'
                              : isHinted
                              ? 'bg-amber-950/80 border-amber-300 shadow-[0_5px_0_#b45309] ring-2 ring-amber-300'
                              : 'bg-[#F8FAFC] text-[#0F172A] border-amber-300/90 hover:border-sky-400 shadow-[0_5px_0_#78350f]'
                          }`}
                        >
                          <div className="flex items-stretch justify-between gap-2 p-3 sm:p-3.5">
                            <button
                              type="button"
                              disabled={isMatched}
                              onClick={() => handleSelectCard(card)}
                              className="flex-1 text-left flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg cursor-pointer disabled:cursor-default"
                            >
                              <span
                                className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 tabular-nums ${
                                  isMatched
                                    ? 'bg-emerald-500 text-slate-950'
                                    : isSelected
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-[#451A03] text-amber-200'
                                }`}
                              >
                                B{idx + 1}
                              </span>
                              <div
                                className={`text-sm sm:text-base font-extrabold leading-snug break-words ${
                                  isMatched
                                    ? 'text-emerald-100'
                                    : isMismatch
                                    ? 'text-rose-100'
                                    : 'text-[#0F172A]'
                                }`}
                              >
                                <MathView content={card.content} />
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isMatched ? (
                                <span className="px-2 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[11px] font-black flex items-center gap-1 tabular-nums">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Cặp #{matchedNum}</span>
                                </span>
                              ) : isMismatch ? (
                                <span className="px-2 py-1 rounded-lg bg-rose-500/30 text-rose-200 text-[11px] font-black">
                                  Thử lại
                                </span>
                              ) : isSelected ? (
                                <span className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black">
                                  Đang chọn
                                </span>
                              ) : null}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSpeakVietnamese(card.content);
                                }}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  isMatched
                                    ? 'border-emerald-500/40 text-emerald-200 hover:bg-emerald-800/50'
                                    : 'border-slate-300 text-slate-600 hover:bg-slate-200'
                                }`}
                                title="Đọc nội dung thẻ bằng tiếng Việt"
                                aria-label={`Đọc thẻ B${idx + 1}`}
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>

                              {card.content.length > 36 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomedCard(card);
                                  }}
                                  className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-200 cursor-pointer"
                                  title="Phóng to nội dung thẻ"
                                  aria-label={`Phóng to thẻ B${idx + 1}`}
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* ===============================================================
                 MODE 2: MEMORY FLIP 3D (ALL CARDS FACE-DOWN UNTIL FLIPPED)
                 =============================================================== */
              <div
                className={`grid gap-3.5 my-auto ${
                  memoryDeck.length <= 8
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : memoryDeck.length <= 12
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                    : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                {memoryDeck.map((card, idx) => {
                  const isMatched = matchedPairIds.has(card.pairId);
                  const matchedNum = matchOrderMap[card.pairId];
                  const isSelected =
                    selectedCard1?.cardId === card.cardId ||
                    selectedCard2?.cardId === card.cardId;
                  const isFaceUp = isMatched || isSelected;
                  const isMismatch = mismatchCardIds.has(card.cardId);
                  const isHinted = hintHighlightedPairId === card.pairId && !isMatched;

                  return (
                    <div
                      key={card.cardId}
                      className="relative min-h-[126px] sm:min-h-[138px]"
                      style={{ perspective: '1000px' }}
                    >
                      {!isFaceUp ? (
                        /* FACE-DOWN 3D CARD (Never leaks card content in DOM or aria-label!) */
                        <button
                          type="button"
                          onClick={() => handleSelectCard(card)}
                          aria-label={`Thẻ úp số ${idx + 1}, nhóm ${card.side === 'A' ? 'Phía A' : 'Phía B'}`}
                          className={`w-full h-full min-h-[126px] sm:min-h-[138px] rounded-2xl border-2 p-3 flex flex-col items-center justify-between transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                            isHinted
                              ? 'bg-gradient-to-b from-amber-800 to-amber-950 border-amber-300 shadow-[0_6px_0_#78350f] ring-2 ring-amber-300'
                              : 'bg-gradient-to-b from-[#132D54] to-[#0B1C36] border-sky-400/60 hover:border-amber-300 shadow-[0_6px_0_#061021] hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="w-full flex items-center justify-between text-[11px] font-bold text-sky-200/90">
                            <span className="tabular-nums">Thẻ #{idx + 1}</span>
                            <span className="text-amber-300">Phía {card.side}</span>
                          </div>

                          <div className="w-11 h-11 rounded-2xl bg-sky-400/15 border border-sky-300/35 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-amber-300" />
                          </div>

                          <span className="text-[11px] font-extrabold text-sky-100">
                            Chạm để lật mở
                          </span>
                        </button>
                      ) : (
                        /* FACE-UP REVEALED CARD */
                        <div
                          className={`w-full h-full min-h-[126px] sm:min-h-[138px] rounded-2xl border-2 p-3 flex flex-col justify-between transition-all duration-150 ${
                            isMatched
                              ? 'bg-emerald-950/85 border-emerald-400 text-emerald-50 shadow-[0_6px_0_#065f46]'
                              : isMismatch
                              ? 'bg-rose-950/90 border-rose-400 text-rose-50 shadow-[0_6px_0_#9f1239]'
                              : 'bg-[#FFFBEB] border-amber-400 text-[#0F172A] shadow-[0_6px_0_#b45309]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px] font-black">
                            <span
                              className={
                                isMatched
                                  ? 'text-emerald-300'
                                  : isMismatch
                                  ? 'text-rose-300'
                                  : 'text-amber-800'
                              }
                            >
                              Thẻ #{idx + 1} · Phía {card.side}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSpeakVietnamese(card.content);
                                }}
                                className="p-1 rounded hover:bg-black/10 cursor-pointer"
                                title="Đọc nội dung thẻ đang mở"
                                aria-label={`Đọc thẻ số ${idx + 1}`}
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              {card.content.length > 32 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomedCard(card);
                                  }}
                                  className="p-1 rounded hover:bg-black/10 cursor-pointer"
                                  title="Phóng to nội dung thẻ"
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="my-auto py-1 text-center text-xs sm:text-sm font-extrabold leading-snug break-words">
                            <MathView content={card.content} />
                          </div>

                          <div className="text-center text-[11px] font-black">
                            {isMatched ? (
                              <span className="text-emerald-300 inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Đã ghép (#{matchedNum})
                              </span>
                            ) : isMismatch ? (
                              <span className="text-rose-300">Chưa đúng cặp</span>
                            ) : (
                              <span className="text-amber-800">Đang lật mở</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* PEDAGOGICAL EXPLANATION BOX (Appears immediately when a pair is matched) */}
            {lastExplanation && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/75 border border-emerald-400/50 text-emerald-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="font-black text-emerald-300 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 shrink-0" />
                    <span>
                      Củng cố kiến thức: <MathView content={lastExplanation.sideAContent} /> ↔{' '}
                      <MathView content={lastExplanation.sideBContent} />
                    </span>
                  </div>
                  <div className="text-emerald-100/95 leading-relaxed">
                    <MathView content={lastExplanation.explanation} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSpeakVietnamese(lastExplanation.explanation)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/50 hover:bg-emerald-600 border border-emerald-400/50 text-xs font-bold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Đọc giải thích</span>
                </button>
              </div>
            )}

            {/* Voice Notice if browser lacks Vietnamese TTS */}
            {voiceNotice && (
              <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 flex items-center justify-between">
                <span>{voiceNotice}</span>
                <button
                  type="button"
                  onClick={() => setVoiceNotice(null)}
                  className="text-amber-300 font-bold ml-2 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            )}

            {/* Bottom Teacher Controls Bar */}
            <div className="pt-2 border-t border-sky-300/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {hintsEnabled && (
                  <button
                    type="button"
                    disabled={hintsUsed >= maxHints || phase === 'PAUSED' || isEvaluatingRef.current}
                    onClick={handleTriggerHint}
                    className="px-3.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 disabled:opacity-40 border border-amber-300/60 text-amber-200 font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                    <span>Gợi ý ({maxHints - hintsUsed} lần còn lại)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {phase === 'PAUSED' ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tiếp tục</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-300" />
                      <span>Tạm dừng</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      attemptsCount === 0 ||
                      window.confirm('Bạn có chắc muốn chơi lại từ đầu với bộ kiến thức này?')
                    ) {
                      handleStartNewSession();
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sky-200 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Chơi lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleEndSessionEarly}
                  className="px-4 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 border border-rose-400/50 text-white font-extrabold cursor-pointer"
                >
                  Kết thúc phiên
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR (3 Cols on Desktop): SCOREBOARD & TURN HISTORY */}
          <div className="lg:col-span-3 space-y-4 flex flex-col justify-between">
            <div className="rounded-3xl border border-sky-400/30 bg-[#0A1628] p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                  Bảng điểm & Tiến độ
                </h3>
                <span className="text-xs font-bold text-emerald-300 tabular-nums">
                  +10đ / cặp đúng
                </span>
              </div>

              {orgMode === 'TEAMS' ? (
                <div className="space-y-2">
                  {teams.map((team, idx) => {
                    const isTurn = idx === activeTeamIndex;
                    return (
                      <div
                        key={team.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isTurn
                            ? 'bg-amber-400/15 border-amber-400 shadow-md'
                            : 'bg-slate-900/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: team.colorHex }}
                            />
                            <span className="text-xs font-extrabold text-white truncate">
                              {team.name}
                            </span>
                          </div>
                          <span className="text-sm font-black text-amber-300 tabular-nums shrink-0">
                            {team.score} đ
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 tabular-nums">
                          <span>Đúng: {team.matchedCount} cặp</span>
                          <span>Thử: {team.attempts} lần</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-sky-400/30 text-center space-y-1">
                  <div className="text-xs text-slate-300 font-bold">
                    {orgMode === 'INDIVIDUAL' ? 'Điểm tích lũy phiên cá nhân' : 'Điểm chung cả lớp'}
                  </div>
                  <div className="text-3xl font-black text-amber-300 tabular-nums">
                    {classScore} điểm
                  </div>
                  <div className="text-xs text-emerald-300 font-bold tabular-nums">
                    Hoàn thành {matchedPairIds.size} / {activePairs.length} cặp
                  </div>
                </div>
              )}

              {/* Session Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div className="text-slate-400">Số lần thử</div>
                  <div className="text-sm font-black text-white">{attemptsCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div className="text-slate-400">Chưa đúng</div>
                  <div className="text-sm font-black text-rose-300">{wrongCount}</div>
                </div>
              </div>

              {/* Recent Turn Logs */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-xs font-extrabold text-sky-300">Lịch sử lượt ghép gần nhất</div>
                {turnLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    Chưa có lượt ghép nào trong phiên này.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {turnLogs.slice(0, 8).map((log) => (
                      <div
                        key={log.turnId}
                        className={`p-2 rounded-xl border text-[11px] ${
                          log.isCorrect
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                            : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="truncate max-w-[130px]">{log.actorLabel}</span>
                          <span className="tabular-nums">
                            {log.isCorrect ? '+10đ (Đúng)' : '0đ (Thử lại)'}
                          </span>
                        </div>
                        <div className="truncate opacity-85 mt-0.5">
                          {log.cardA} ↔ {log.cardB}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. SESSION SUMMARY SCREEN (TỔNG KẾT PHIÊN & XEM LẠI KIẾN THỨC)
         ===================================================================== */}
      {phase === 'FINISHED' && (
        <div className="w-full max-w-4xl mx-auto rounded-3xl border-2 border-amber-400/70 bg-gradient-to-b from-[#0A1628] via-[#102444] to-[#081224] p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-sky-300/20 pb-5">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <VictoryTrophy3DSVG className="w-20 h-20 shrink-0 mx-auto sm:mx-0" />
              <div>
                <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                  Tổng kết phiên · B08 Ghép cặp kiến thức
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  {matchedPairIds.size === activePairs.length
                    ? 'Hoàn Thành Đại Sảnh Kết Nối Tri Thức!'
                    : 'Tổng Kết Phiên Ghép Cặp Kiến Thức'}
                </h3>
                <p className="text-xs sm:text-sm text-sky-200 mt-1">
                  Lớp: <strong>{resolvedClassName}</strong> · Chế độ:{' '}
                  <strong>{playMode === 'VISUAL_MATCH' ? 'Ghép trực quan' : 'Lật thẻ ghi nhớ'}</strong>
                </p>
              </div>
            </div>

            <div className="px-5 py-3 rounded-2xl bg-amber-400/15 border border-amber-400/50 text-center shrink-0">
              <div className="text-xs font-bold text-amber-200">Tổng điểm đạt được</div>
              <div className="text-3xl font-black text-amber-300 tabular-nums">{classScore} đ</div>
            </div>
          </div>

          {/* 4 Key Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center tabular-nums">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs text-slate-400">Số cặp hoàn thành</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">
                {matchedPairIds.size} / {activePairs.length}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs text-slate-400">Tổng số lần thử</div>
              <div className="text-xl font-black text-white mt-0.5">{attemptsCount}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs text-slate-400">Số lần ghép sai</div>
              <div className="text-xl font-black text-rose-400 mt-0.5">{wrongCount}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs text-slate-400">Thời gian · Gợi ý</div>
              <div className="text-xl font-black text-sky-300 mt-0.5">
                {formatClock(elapsedPlaySec)} · {hintsUsed}/{maxHints}
              </div>
            </div>
          </div>

          {/* Team Leaderboard with Tie Support */}
          {orgMode === 'TEAMS' && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                Bảng xếp hạng các đội (Ghi nhận đồng hạng nếu bằng điểm)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {rankedTeams.map((team) => (
                  <div
                    key={team.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                      team.rank === 1
                        ? 'bg-amber-400/15 border-amber-400 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs tabular-nums shrink-0">
                        Hạng #{team.rank} {team.isTied ? '(Đồng hạng)' : ''}
                      </span>
                      <span className="text-sm font-extrabold truncate">{team.name}</span>
                    </div>
                    <span className="text-base font-black text-amber-300 tabular-nums shrink-0">
                      {team.score} đ ({team.matchedCount} cặp)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uncompleted Pairs (if session ended early or timed out) */}
          {unmatchedPairsList.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 space-y-2">
              <div className="text-xs font-extrabold text-amber-300">
                Các cặp chưa hoàn thành trong phiên ({unmatchedPairsList.length} cặp):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {unmatchedPairsList.map((p) => (
                  <div
                    key={p.pairId}
                    className="p-2.5 rounded-xl bg-slate-950/75 border border-slate-800 text-slate-200"
                  >
                    <div className="font-extrabold text-white">
                      <MathView content={p.sideAContent} /> ↔ <MathView content={p.sideBContent} />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      <MathView content={p.explanation} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4 Required Summary Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowKnowledgeReviewModal(true)}
              className="px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Xem lại kiến thức</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartNewSession()}
              className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Chơi lại bộ này</span>
            </button>

            <button
              type="button"
              onClick={() => setPhase('SETUP')}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>Chọn bộ khác</span>
            </button>

            {onCloseGame && (
              <button
                type="button"
                onClick={onCloseGame}
                className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm cursor-pointer"
              >
                Về thư viện
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: XEM LẠI KIẾN THỨC (FULL PAIR REVIEW & EXPLANATIONS)
         ===================================================================== */}
      {showKnowledgeReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-3xl border-2 border-sky-400/60 bg-[#0A1628] p-6 text-white shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-amber-300">
                  Bảng tổng hợp kiến thức & Giải thích chi tiết
                </h3>
                <p className="text-xs text-slate-300">
                  Toàn bộ {activePairs.length} cặp kiến thức trong phiên chơi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKnowledgeReviewModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {activePairs.map((pair, idx) => {
                const isDone = matchedPairIds.has(pair.pairId);
                return (
                  <div
                    key={pair.pairId}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-sky-300">
                        Cặp #{idx + 1} {isDone ? '· Đã ghép đúng' : '· Chưa mở'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleSpeakVietnamese(
                            `${pair.sideAContent}. Tương ứng với: ${pair.sideBContent}. ${pair.explanation}`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Nghe đọc</span>
                      </button>
                    </div>
                    <div className="text-sm sm:text-base font-black text-white">
                      <MathView content={pair.sideAContent} />{' '}
                      <span className="text-amber-400 mx-1.5">↔</span>{' '}
                      <MathView content={pair.sideBContent} />
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-emerald-300">Giải thích:</strong>{' '}
                      <MathView content={pair.explanation} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowKnowledgeReviewModal(false)}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Đóng bảng xem lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: PHÓNG TO NỘI DUNG THẺ DÀI (ZOOM CARD MODAL)
         ===================================================================== */}
      {zoomedCard && (
        <div
          onClick={() => setZoomedCard(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl border-2 border-amber-400 bg-[#0A1628] p-6 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-extrabold text-amber-300 uppercase">
                Phóng to thẻ · Phía {zoomedCard.side}
              </span>
              <button
                type="button"
                onClick={() => setZoomedCard(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-6 text-center text-xl sm:text-2xl font-black leading-relaxed">
              <MathView content={zoomedCard.content} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSpeakVietnamese(zoomedCard.content)}
                className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Đọc tiếng Việt</span>
              </button>
              <button
                type="button"
                onClick={() => setZoomedCard(null)}
                className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: HƯỚNG DẪN SỬ DỤNG (DOES NOT RESET SESSION)
         ===================================================================== */}
      {showGuideModal && (
        <div
          onClick={() => setShowGuideModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border-2 border-sky-400/60 bg-[#0A1628] p-6 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-300">
                Hướng dẫn nhanh · B08 Ghép cặp kiến thức 3D
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <p>
                <strong>1. Chế độ Ghép cặp trực quan (Mặc định):</strong> Chọn 1 thẻ ở Cột A rồi chọn 1 thẻ ở Cột B (hoặc ngược lại). Có thể bấm lại thẻ đang chọn để bỏ chọn hoặc kéo thả thẻ sang cột đối diện.
              </p>
              <p>
                <strong>2. Chế độ Lật thẻ ghi nhớ:</strong> Các thẻ úp xuống với ký hiệu trung tính Phía A / Phía B. Mỗi lượt lật tối đa 2 thẻ; nếu đúng cặp thẻ sẽ mở khóa và hiện giải thích.
              </p>
              <p>
                <strong>3. Luật điểm & Phân lượt:</strong> Mỗi cặp ghép đúng được <strong>+10 điểm</strong> (chỉ cộng 1 lần duy nhất cho mỗi cặp). Ghép sai được 0 điểm và không bị trừ điểm.
              </p>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Đã hiểu, tiếp tục phiên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
