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
  Award,
  Sparkles,
  HelpCircle,
  Eye,
  ArrowRight,
  RefreshCw,
  ZoomIn,
  X,
  AlertTriangle,
  KeyRound,
  Lock,
  Unlock,
  Check,
  SkipForward,
  Layers,
  ShieldCheck,
  FastForward,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question } from '../../../types';
import { MathView } from '../../MathView';
import { SpaceRocketVoiceManager } from './SpaceRocketVoiceManager';

// ============================================================================
// TYPES & STATE MACHINE FOR B07: Ô CỬA BÍ MẬT 3D ("ĐẠI SẢNH NHỮNG Ô CỬA BÍ MẬT")
// ============================================================================

export type B07OrgMode = 'CLASS' | 'INDIVIDUAL' | 'TEAMS';
export type B07ScoringMode = 'SECRET' | 'FIXED';
export type B07QuestionSource = 'SAMPLE_12' | 'QUESTION_BANK' | 'COMBINED';
export type B07DoorCount = 6 | 9 | 12;
export type B07RewardArtifact = 'STAR' | 'TROPHY' | 'BOOK' | 'CRYSTAL';

export type B07StagePhase =
  | 'SETUP'
  | 'SELECTING_DOOR'
  | 'ANSWERING_QUESTION'
  | 'ANSWER_FEEDBACK'
  | 'OPENING_DOOR'
  | 'TURN_SUMMARY'
  | 'PAUSED'
  | 'FINISHED';

export interface B07QuestionItem {
  id: string;
  code: string;
  topicTag: string;
  questionType: 'MULTIPLE_CHOICE' | 'ORAL_SHORT';
  stem: string;
  options?: Array<{ id: string; label: string; text: string }>;
  correctAnswer: string;
  explanation: string;
  isSample?: boolean;
}

export interface B07DoorEntity {
  doorId: string;
  doorNumber: number;
  status: 'CLOSED' | 'SELECTED' | 'OPENED';
  rewardArtifact: B07RewardArtifact;
  secretPoints: 10 | 20 | 30;
  question: B07QuestionItem;
  answeredCorrectly: boolean | null;
  pointsAwarded: number;
  openedByLabel?: string;
}

export interface B07TeamItem {
  id: string;
  name: string;
  colorHex: string;
  score: number;
  correctCount: number;
  doorsOpened: number;
}

export interface B07TurnRecord {
  turnId: string;
  timestamp: string;
  doorNumber: number;
  actorLabel: string;
  questionStem: string;
  correctAnswerText: string;
  explanation: string;
  isCorrect: boolean;
  pointsAwarded: number;
  rewardArtifact: B07RewardArtifact;
}

export interface MysteryDoors3DGameProps {
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

const B07_STORAGE_KEY = 'taydo_smart_edu_b07_active_session_v1';
const B07_STORAGE_VERSION = 1;

const TEAM_PRESETS: Array<{ name: string; colorHex: string }> = [
  { name: 'Đội Sao Vàng', colorHex: '#F59E0B' },
  { name: 'Đội Tia Chớp', colorHex: '#006BFF' },
  { name: 'Đội Ngọc Bích', colorHex: '#10B981' },
  { name: 'Đội Phượng Hoàng', colorHex: '#EC4899' },
  { name: 'Đội Tinh Vân', colorHex: '#8B5CF6' },
  { name: 'Đội Hải Đăng', colorHex: '#06B6D4' },
];

const REWARD_META: Record<
  B07RewardArtifact,
  { title: string; subtitle: string; badgeColor: string }
> = {
  STAR: {
    title: 'Ngôi Sao Tỏa Sáng',
    subtitle: 'Biểu tượng của sự nhạy bén và khởi đầu rực rỡ',
    badgeColor: '#FBBF24',
  },
  TROPHY: {
    title: 'Cúp Vàng Danh Dự',
    subtitle: 'Vinh danh nỗ lực chinh phục thử thách kiến thức',
    badgeColor: '#F59E0B',
  },
  BOOK: {
    title: 'Sách Vàng Tri Thức',
    subtitle: 'Mở ra kho tàng khái niệm và tư duy khoa học',
    badgeColor: '#38BDF8',
  },
  CRYSTAL: {
    title: 'Tinh Thể Năng Lượng',
    subtitle: 'Kết tinh sự tập trung và tinh thần đồng đội',
    badgeColor: '#A855F7',
  },
};

// ============================================================================
// CRYPTO-SAFE SHUFFLE & EQUAL SECRET REWARD DISTRIBUTION
// ============================================================================

export function fisherYatesShuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Generates an equally distributed pool of [10, 20, 30] secret points for 6, 9, or 12 doors,
 * shuffled once at session start so every tier (10, 20, 30) appears exactly doorCount/3 times.
 */
export function buildBalancedSecretRewards(doorCount: B07DoorCount): Array<{
  points: 10 | 20 | 30;
  artifact: B07RewardArtifact;
}> {
  const tiers: Array<10 | 20 | 30> = [10, 20, 30];
  const artifacts: B07RewardArtifact[] = ['STAR', 'TROPHY', 'BOOK', 'CRYSTAL'];
  const rawList: Array<{ points: 10 | 20 | 30; artifact: B07RewardArtifact }> = [];

  for (let i = 0; i < doorCount; i++) {
    const points = tiers[i % 3];
    const artifact = artifacts[i % artifacts.length];
    rawList.push({ points, artifact });
  }

  return fisherYatesShuffle(rawList);
}

// ============================================================================
// BUILT-IN 12 VERIFIED SAMPLE QUESTIONS ("DỮ LIỆU MẪU" — NOT SAVED TO DB)
// ============================================================================

export const SAMPLE_B07_QUESTIONS: B07QuestionItem[] = [
  {
    id: 'b07_sample_01',
    code: 'B07_M01',
    topicTag: 'Toán 6 · Số tự nhiên',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Kết quả của phép tính lũy thừa $2^3 + 3^2$ bằng bao nhiêu?',
    options: [
      { id: 'A', label: 'A', text: '12' },
      { id: 'B', label: 'B', text: '17' },
      { id: 'C', label: 'C', text: '15' },
      { id: 'D', label: 'D', text: '18' },
    ],
    correctAnswer: 'B',
    explanation: 'Ta có $2^3 = 8$ và $3^2 = 9$. Do đó $8 + 9 = 17$.',
    isSample: true,
  },
  {
    id: 'b07_sample_02',
    code: 'B07_M02',
    topicTag: 'Toán 6 · Hình học phẳng',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Hình lục giác đều có bao nhiêu cạnh bằng nhau?',
    options: [
      { id: 'A', label: 'A', text: '4 cạnh' },
      { id: 'B', label: 'B', text: '5 cạnh' },
      { id: 'C', label: 'C', text: '6 cạnh' },
      { id: 'D', label: 'D', text: '8 cạnh' },
    ],
    correctAnswer: 'C',
    explanation: 'Hình lục giác đều có 6 cạnh bằng nhau và 6 góc ở các đỉnh bằng nhau.',
    isSample: true,
  },
  {
    id: 'b07_sample_03',
    code: 'B07_M03',
    topicTag: 'Tin học 6 · Máy tính & Thông tin',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Thiết bị nào sau đây là thiết bị vào (Input) cơ bản của máy tính?',
    options: [
      { id: 'A', label: 'A', text: 'Loa (Speaker)' },
      { id: 'B', label: 'B', text: 'Máy in (Printer)' },
      { id: 'C', label: 'C', text: 'Màn hình (Monitor)' },
      { id: 'D', label: 'D', text: 'Bàn phím (Keyboard)' },
    ],
    correctAnswer: 'D',
    explanation: 'Bàn phím là thiết bị vào giúp nhập kí tự và lệnh điều khiển vào máy tính.',
    isSample: true,
  },
  {
    id: 'b07_sample_04',
    code: 'B07_M04',
    topicTag: 'KHTN 6 · Các thể của chất',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Quá trình chất chuyển từ thể lỏng sang thể hơi (khí) được gọi là gì?',
    options: [
      { id: 'A', label: 'A', text: 'Sự nóng chảy' },
      { id: 'B', label: 'B', text: 'Sự bay hơi' },
      { id: 'C', label: 'C', text: 'Sự đông đặc' },
      { id: 'D', label: 'D', text: 'Sự ngưng tụ' },
    ],
    correctAnswer: 'B',
    explanation: 'Sự chuyển từ thể lỏng sang thể hơi (khí) gọi là sự bay hơi.',
    isSample: true,
  },
  {
    id: 'b07_sample_05',
    code: 'B07_M05',
    topicTag: 'Toán 7 · Tam giác',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Tổng số đo ba góc trong một tam giác bất kì luôn bằng bao nhiêu độ?',
    options: [
      { id: 'A', label: 'A', text: '90°' },
      { id: 'B', label: 'B', text: '180°' },
      { id: 'C', label: 'C', text: '270°' },
      { id: 'D', label: 'D', text: '360°' },
    ],
    correctAnswer: 'B',
    explanation: 'Theo định lí tổng ba góc của một tam giác, tổng ba góc trong tam giác luôn bằng 180°.',
    isSample: true,
  },
  {
    id: 'b07_sample_06',
    code: 'B07_M06',
    topicTag: 'Toán 8 · Định lí Pythagore',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Một tam giác vuông có hai cạnh góc vuông lần lượt là 3 cm và 4 cm. Độ dài cạnh huyền là:',
    options: [
      { id: 'A', label: 'A', text: '5 cm' },
      { id: 'B', label: 'B', text: '6 cm' },
      { id: 'C', label: 'C', text: '7 cm' },
      { id: 'D', label: 'D', text: '25 cm' },
    ],
    correctAnswer: 'A',
    explanation: 'Theo định lí Pythagore: $c = \\sqrt{3^2 + 4^2} = \\sqrt{9 + 16} = \\sqrt{25} = 5\\text{ cm}$.',
    isSample: true,
  },
  {
    id: 'b07_sample_07',
    code: 'B07_M07',
    topicTag: 'Tin học 7 · Bảng tính điện tử',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Trong phần mềm bảng tính Excel, hàm nào dùng để tính tổng các giá trị số?',
    options: [
      { id: 'A', label: 'A', text: 'AVERAGE' },
      { id: 'B', label: 'B', text: 'MAX' },
      { id: 'C', label: 'C', text: 'SUM' },
      { id: 'D', label: 'D', text: 'COUNT' },
    ],
    correctAnswer: 'C',
    explanation: 'Hàm SUM được sử dụng để tính tổng các số trong vùng dữ liệu được chọn.',
    isSample: true,
  },
  {
    id: 'b07_sample_08',
    code: 'B07_M08',
    topicTag: 'KHTN 7 · Tốc độ chuyển động',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Công thức tính tốc độ chuyển động $v$ theo quãng đường $s$ và thời gian $t$ là:',
    options: [
      { id: 'A', label: 'A', text: 'v = s / t' },
      { id: 'B', label: 'B', text: 'v = s × t' },
      { id: 'C', label: 'C', text: 'v = t / s' },
      { id: 'D', label: 'D', text: 'v = s + t' },
    ],
    correctAnswer: 'A',
    explanation: 'Tốc độ bằng quãng đường đi được chia cho thời gian đi quãng đường đó: $v = \\frac{s}{t}$.',
    isSample: true,
  },
  {
    id: 'b07_sample_09',
    code: 'B07_M09',
    topicTag: 'Toán 9 · Căn bậc hai',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Căn bậc hai số học của 81 là số nào sau đây?',
    options: [
      { id: 'A', label: 'A', text: '-9' },
      { id: 'B', label: 'B', text: '9' },
      { id: 'C', label: 'C', text: '±9' },
      { id: 'D', label: 'D', text: '81' },
    ],
    correctAnswer: 'B',
    explanation: 'Căn bậc hai số học của số dương $a$ là số không âm $x$ sao cho $x^2 = a$. Vì $9 > 0$ và $9^2 = 81$ nên $\\sqrt{81} = 9$.',
    isSample: true,
  },
  {
    id: 'b07_sample_10',
    code: 'B07_M10',
    topicTag: 'Tin học 8 · Thuật toán',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Cấu trúc rẽ nhánh trong lập trình thường được biểu diễn bằng từ khóa nào?',
    options: [
      { id: 'A', label: 'A', text: 'IF ... THEN / ELSE' },
      { id: 'B', label: 'B', text: 'PRINT' },
      { id: 'C', label: 'C', text: 'INPUT' },
      { id: 'D', label: 'D', text: 'IMPORT' },
    ],
    correctAnswer: 'A',
    explanation: 'Cấu trúc rẽ nhánh kiểm tra điều kiện và thực hiện nhánh lệnh tương ứng qua IF ... THEN ... ELSE.',
    isSample: true,
  },
  {
    id: 'b07_sample_11',
    code: 'B07_M11',
    topicTag: 'Toán THCS · Câu hỏi trả lời ngắn',
    questionType: 'ORAL_SHORT',
    stem: 'Hãy nêu dấu hiệu chia hết cho 5 của một số tự nhiên và cho một ví dụ minh họa.',
    correctAnswer: 'Các số có chữ số tận cùng là 0 hoặc 5 thì chia hết cho 5 (ví dụ: 15, 20, 105).',
    explanation: 'Số tự nhiên có chữ số tận cùng là 0 hoặc 5 thì chia hết cho 5 và chỉ những số đó mới chia hết cho 5.',
    isSample: true,
  },
  {
    id: 'b07_sample_12',
    code: 'B07_M12',
    topicTag: 'Tin học THCS · Câu hỏi trả lời miệng',
    questionType: 'ORAL_SHORT',
    stem: 'Em hãy kể tên 2 trình duyệt web phổ biến dùng để truy cập thông tin trên Internet.',
    correctAnswer: 'Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari, Cốc Cốc...',
    explanation: 'Trình duyệt web (Web Browser) là phần mềm ứng dụng giúp người dùng truy cập và xem các trang web trên Internet.',
    isSample: true,
  },
];

// ============================================================================
// WEB AUDIO SOUND ENGINE FOR B07 (NO EXTERNAL AUDIO FILES REQUIRED)
// ============================================================================

class B07SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
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

  public stopAll(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public playSelectDoor(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.12);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playDoorUnlockAndOpen(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Mechanical latch click + warm portal sweep
    const notes = [280, 420, 630, 840];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.12, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.26);
    });
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
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.24);
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
    osc.frequency.setValueAtTime(230, now);
    osc.frequency.linearRampToValueAtTime(165, now + 0.24);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playFanfare(muted: boolean): void {
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

const b07Sound = new B07SoundEngine();

// ============================================================================
// 3D REWARD ARTIFACT SVG RENDERER (STAR, TROPHY, BOOK, CRYSTAL)
// ============================================================================

const RewardArtifact3DSVG: React.FC<{
  artifact: B07RewardArtifact;
  sizeClass?: string;
}> = ({ artifact, sizeClass = 'w-16 h-16' }) => {
  if (artifact === 'STAR') {
    return (
      <svg viewBox="0 0 80 80" className={sizeClass} aria-hidden="true">
        <defs>
          <linearGradient id="b07StarGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r="32" fill="#F59E0B" fillOpacity="0.18" />
        <polygon
          points="40,8 49,28 71,30 54,45 59,67 40,55 21,67 26,45 9,30 31,28"
          fill="url(#b07StarGrad)"
          stroke="#FEF9C3"
          strokeWidth="2.5"
        />
      </svg>
    );
  }
  if (artifact === 'TROPHY') {
    return (
      <svg viewBox="0 0 80 80" className={sizeClass} aria-hidden="true">
        <defs>
          <linearGradient id="b07CupGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="60%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#A16207" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r="32" fill="#EAB308" fillOpacity="0.18" />
        <path
          d="M24,16 H56 V32 C56,43 49,50 40,50 C31,50 24,43 24,32 Z"
          fill="url(#b07CupGrad)"
          stroke="#FEF08A"
          strokeWidth="2"
        />
        <path
          d="M24,20 H15 C15,31 20,36 25,36 M56,20 H65 C65,31 60,36 55,36"
          fill="none"
          stroke="#FDE047"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <rect x="36" y="50" width="8" height="12" rx="2" fill="url(#b07CupGrad)" />
        <rect x="26" y="62" width="28" height="7" rx="3" fill="#CA8A04" stroke="#FEF08A" strokeWidth="1.5" />
      </svg>
    );
  }
  if (artifact === 'BOOK') {
    return (
      <svg viewBox="0 0 80 80" className={sizeClass} aria-hidden="true">
        <defs>
          <linearGradient id="b07BookGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r="32" fill="#38BDF8" fillOpacity="0.18" />
        <path
          d="M14,22 C24,18 34,20 40,25 C46,20 56,18 66,22 V58 C56,54 46,56 40,61 C34,56 24,54 14,58 Z"
          fill="url(#b07BookGrad)"
          stroke="#E0F2FE"
          strokeWidth="2.5"
        />
        <line x1="40" y1="25" x2="40" y2="61" stroke="#FEF08A" strokeWidth="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 80" className={sizeClass} aria-hidden="true">
      <defs>
        <linearGradient id="b07CrystalGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#7E22CE" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="32" fill="#A855F7" fillOpacity="0.18" />
      <polygon
        points="40,8 62,28 54,66 26,66 18,28"
        fill="url(#b07CrystalGrad)"
        stroke="#F3E8FF"
        strokeWidth="2.5"
      />
      <polyline
        points="40,8 40,66 62,28 18,28"
        fill="none"
        stroke="#E9D5FF"
        strokeWidth="1.5"
        strokeOpacity="0.7"
      />
    </svg>
  );
};

// ============================================================================
// MAIN COMPONENT: MYSTERY DOORS 3D GAME (B07 - Ô CỬA BÍ MẬT 3D)
// ============================================================================

export const MysteryDoors3DGame: React.FC<MysteryDoors3DGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds = new Set(),
  questions = [],
  resolvedClassName = 'Lớp học',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onCloseGame,
  onPick,
}) => {
  // --------------------------------------------------------------------------
  // 1. SETUP CONFIGURATION STATE
  // --------------------------------------------------------------------------
  const [orgMode, setOrgMode] = useState<B07OrgMode>('CLASS');
  const [teamCount, setTeamCount] = useState<number>(3);
  const [doorCount, setDoorCount] = useState<B07DoorCount>(9);
  const [questionSource, setQuestionSource] = useState<B07QuestionSource>('SAMPLE_12');
  const [timeLimitSec, setTimeLimitSec] = useState<number>(30); // 0, 15, 30, 60
  const [scoringMode, setScoringMode] = useState<B07ScoringMode>('SECRET');
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 2. ACTIVE SESSION STATE
  // --------------------------------------------------------------------------
  const [phase, setPhase] = useState<B07StagePhase>('SETUP');
  const [sessionId, setSessionId] = useState<string>('');
  const [doors, setDoors] = useState<B07DoorEntity[]>([]);
  const [activeDoorId, setActiveDoorId] = useState<string | null>(null);
  const [hoveredDoorId, setHoveredDoorId] = useState<string | null>(null);

  // Question & Answer evaluation state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showOralReferenceAnswer, setShowOralReferenceAnswer] = useState<boolean>(false);
  const [lastTurnEvaluation, setLastTurnEvaluation] = useState<{
    isCorrect: boolean;
    reason: 'SUBMITTED' | 'ORAL_GRADED' | 'TIMEOUT';
    pointsToAward: number;
  } | null>(null);

  // Scoring, Teams & Turn rotation state
  const [classScore, setClassScore] = useState<number>(0);
  const [scoredDoorIds, setScoredDoorIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<B07TeamItem[]>([]);
  const [activeTeamIdx, setActiveTeamIdx] = useState<number>(0);
  const [activeStudent, setActiveStudent] = useState<StudentCandidate | null>(null);
  const [turnHistory, setTurnHistory] = useState<B07TurnRecord[]>([]);

  // Timer & Pause state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const deadlineMsRef = useRef<number | null>(null);
  const pausedRemainingMsRef = useRef<number | null>(null);
  const phaseBeforePauseRef = useRef<B07StagePhase>('SELECTING_DOOR');
  const turnEvalLockRef = useRef<string | null>(null);
  const doorOpenTimerRef = useRef<number | null>(null);

  // Modals & Notices
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [confirmActionModal, setConfirmActionModal] = useState<'SETUP' | 'LIBRARY' | 'REPLAY' | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [hasRestorableSession, setHasRestorableSession] = useState<boolean>(false);

  const voiceManagerRef = useRef<SpaceRocketVoiceManager | null>(null);
  if (!voiceManagerRef.current && typeof window !== 'undefined') {
    voiceManagerRef.current = new SpaceRocketVoiceManager();
  }

  useEffect(() => {
    return () => {
      voiceManagerRef.current?.cancel();
      b07Sound.stopAll();
      if (doorOpenTimerRef.current) {
        window.clearTimeout(doorOpenTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isMuted) {
      voiceManagerRef.current?.cancel();
      b07Sound.stopAll();
    }
  }, [isMuted]);

  // Present students list for Individual mode
  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((st) => !absentIds.has(st.id));
  }, [allCandidates, availableCandidates, absentIds]);

  // --------------------------------------------------------------------------
  // 3. QUESTION POOL CONVERSION & SHORTAGE CHECK
  // --------------------------------------------------------------------------
  const convertedBankQuestions = useMemo<B07QuestionItem[]>(() => {
    if (!questions || questions.length === 0) return [];
    const list: B07QuestionItem[] = [];
    const seenIds = new Set<string>();

    for (const q of questions) {
      if (!q || !q.stem || seenIds.has(q.id)) continue;
      seenIds.add(q.id);

      const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
      list.push({
        id: `bank_${q.id}`,
        code: q.code || `Q_${q.id.slice(0, 5)}`,
        topicTag: q.chapter || q.subject || `Lớp ${q.grade || ''}`.trim() || 'Ngân hàng câu hỏi',
        questionType: hasOptions ? 'MULTIPLE_CHOICE' : 'ORAL_SHORT',
        stem: q.stem,
        options: hasOptions
          ? q.options!.map((opt, idx) => ({
              id: opt.id || String.fromCharCode(65 + idx),
              label: opt.label || String.fromCharCode(65 + idx),
              text: opt.text,
            }))
          : undefined,
        correctAnswer: q.correctAnswer || 'Xem lời giải',
        explanation: q.explanation || `Đáp án chuẩn: ${q.correctAnswer || ''}`,
        isSample: false,
      });
    }
    return list;
  }, [questions]);

  const activeQuestionPool = useMemo<B07QuestionItem[]>(() => {
    if (questionSource === 'SAMPLE_12') {
      return SAMPLE_B07_QUESTIONS;
    }
    if (questionSource === 'QUESTION_BANK') {
      return convertedBankQuestions;
    }
    // COMBINED: Bank first, then non-duplicate samples
    return [...convertedBankQuestions, ...SAMPLE_B07_QUESTIONS];
  }, [questionSource, convertedBankQuestions]);

  const shortageCount = Math.max(0, doorCount - activeQuestionPool.length);

  // --------------------------------------------------------------------------
  // 4. LOCAL STORAGE SESSION PERSISTENCE (SCOPED TO B07 ONLY)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(B07_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.version === B07_STORAGE_VERSION &&
        parsed.sessionId &&
        Array.isArray(parsed.doors) &&
        parsed.doors.length > 0 &&
        parsed.phase &&
        parsed.phase !== 'SETUP' &&
        parsed.phase !== 'FINISHED'
      ) {
        setHasRestorableSession(true);
      }
    } catch {
      window.localStorage.removeItem(B07_STORAGE_KEY);
    }
  }, []);

  const saveSessionToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (phase === 'SETUP' || !sessionId || doors.length === 0) return;
    try {
      const payload = {
        version: B07_STORAGE_VERSION,
        savedAt: Date.now(),
        sessionId,
        orgMode,
        teamCount,
        doorCount,
        questionSource,
        timeLimitSec,
        scoringMode,
        doors,
        classScore,
        scoredDoorIds,
        teams,
        activeTeamIdx,
        turnHistory,
        phase: 'SELECTING_DOOR',
      };
      window.localStorage.setItem(B07_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    phase,
    sessionId,
    orgMode,
    teamCount,
    doorCount,
    questionSource,
    timeLimitSec,
    scoringMode,
    doors,
    classScore,
    scoredDoorIds,
    teams,
    activeTeamIdx,
    turnHistory,
  ]);

  useEffect(() => {
    if (phase !== 'SETUP' && phase !== 'FINISHED') {
      saveSessionToStorage();
    }
  }, [phase, doors, classScore, scoredDoorIds, activeTeamIdx, turnHistory, saveSessionToStorage]);

  const clearSavedSessionStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(B07_STORAGE_KEY);
      setHasRestorableSession(false);
    } catch {
      // Ignore
    }
  }, []);

  const handleRestoreSavedSession = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(B07_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.version !== B07_STORAGE_VERSION) {
        clearSavedSessionStorage();
        return;
      }

      setSessionId(data.sessionId);
      setOrgMode(data.orgMode || 'CLASS');
      setTeamCount(data.teamCount || 3);
      setDoorCount(data.doorCount || 9);
      setQuestionSource(data.questionSource || 'SAMPLE_12');
      setTimeLimitSec(typeof data.timeLimitSec === 'number' ? data.timeLimitSec : 30);
      setScoringMode(data.scoringMode || 'SECRET');
      // Ensure any half-selected door returns to CLOSED if not yet scored
      const restoredDoors: B07DoorEntity[] = (data.doors || []).map((d: B07DoorEntity) => ({
        ...d,
        status: (data.scoredDoorIds || []).includes(d.doorId) || d.status === 'OPENED' ? 'OPENED' : 'CLOSED',
      }));
      setDoors(restoredDoors);
      setClassScore(data.classScore || 0);
      setScoredDoorIds(data.scoredDoorIds || []);
      setTeams(data.teams || []);
      setActiveTeamIdx(data.activeTeamIdx || 0);
      setTurnHistory(data.turnHistory || []);
      setActiveDoorId(null);
      setLastTurnEvaluation(null);
      setHasRestorableSession(false);
      setPhase('SELECTING_DOOR');
    } catch {
      clearSavedSessionStorage();
    }
  };

  // --------------------------------------------------------------------------
  // 5. CURRENT ACTOR & DOOR HELPERS
  // --------------------------------------------------------------------------
  const activeDoor = useMemo(
    () => doors.find((d) => d.doorId === activeDoorId) || null,
    [doors, activeDoorId]
  );

  const currentActorLabel = useMemo(() => {
    if (orgMode === 'TEAMS' && teams[activeTeamIdx]) {
      return teams[activeTeamIdx].name;
    }
    if (orgMode === 'INDIVIDUAL' && activeStudent) {
      return activeStudent.fullName;
    }
    return `Cả lớp (${resolvedClassName})`;
  }, [orgMode, teams, activeTeamIdx, activeStudent, resolvedClassName]);

  const pickNextRandomStudent = useCallback(() => {
    if (presentStudents.length === 0) {
      setActiveStudent(null);
      return;
    }
    const rand = presentStudents[Math.floor(Math.random() * presentStudents.length)];
    setActiveStudent(rand);
  }, [presentStudents]);

  // --------------------------------------------------------------------------
  // 6. START NEW SESSION (STEP 1)
  // --------------------------------------------------------------------------
  const handleStartSession = () => {
    if (activeQuestionPool.length < doorCount) return;

    const newSessionId = `b07_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const shuffledQuestions = fisherYatesShuffle(activeQuestionPool).slice(0, doorCount);
    const balancedRewards = buildBalancedSecretRewards(doorCount);

    const builtDoors: B07DoorEntity[] = shuffledQuestions.map((q, idx) => ({
      doorId: `${newSessionId}_door_${idx + 1}`,
      doorNumber: idx + 1,
      status: 'CLOSED',
      rewardArtifact: balancedRewards[idx].artifact,
      secretPoints: balancedRewards[idx].points,
      question: q,
      answeredCorrectly: null,
      pointsAwarded: 0,
    }));

    setSessionId(newSessionId);
    setDoors(builtDoors);
    setActiveDoorId(null);
    setSelectedOptionId(null);
    setShowOralReferenceAnswer(false);
    setLastTurnEvaluation(null);
    setClassScore(0);
    setScoredDoorIds([]);
    setTurnHistory([]);
    turnEvalLockRef.current = null;
    deadlineMsRef.current = null;

    if (orgMode === 'TEAMS') {
      const builtTeams: B07TeamItem[] = Array.from({ length: teamCount }, (_, i) => ({
        id: `team_${i + 1}`,
        name: TEAM_PRESETS[i]?.name || `Đội ${i + 1}`,
        colorHex: TEAM_PRESETS[i]?.colorHex || '#006BFF',
        score: 0,
        correctCount: 0,
        doorsOpened: 0,
      }));
      setTeams(builtTeams);
      setActiveTeamIdx(0);
    } else {
      setTeams([]);
      setActiveTeamIdx(0);
    }

    if (orgMode === 'INDIVIDUAL') {
      pickNextRandomStudent();
    } else {
      setActiveStudent(null);
    }

    setPhase('SELECTING_DOOR');
    b07Sound.playSelectDoor(isMuted);
  };

  // --------------------------------------------------------------------------
  // 7. STEP 2 & 3: SELECT DOOR & DISPLAY QUESTION (START TIMER AFTER RENDER)
  // --------------------------------------------------------------------------
  const handleSelectDoor = (door: B07DoorEntity) => {
    if (phase !== 'SELECTING_DOOR') return;
    if (door.status !== 'CLOSED' || scoredDoorIds.includes(door.doorId)) return;

    b07Sound.playSelectDoor(isMuted);
    setActiveDoorId(door.doorId);
    setSelectedOptionId(null);
    setShowOralReferenceAnswer(false);
    setLastTurnEvaluation(null);
    turnEvalLockRef.current = null;

    setDoors((prev) =>
      prev.map((d) => (d.doorId === door.doorId ? { ...d, status: 'SELECTED' } : d))
    );

    if (timeLimitSec > 0) {
      setRemainingSeconds(timeLimitSec);
      deadlineMsRef.current = Date.now() + timeLimitSec * 1000;
    } else {
      setRemainingSeconds(0);
      deadlineMsRef.current = null;
    }

    setPhase('ANSWERING_QUESTION');
  };

  // --------------------------------------------------------------------------
  // 8. STEP 4 & 5: LOCK ANSWER & SHOW FEEDBACK (WITH SIMULTANEOUS TIMEOUT GUARD)
  // --------------------------------------------------------------------------
  const finalizeAnswerEvaluation = useCallback(
    (isCorrect: boolean, reason: 'SUBMITTED' | 'ORAL_GRADED' | 'TIMEOUT') => {
      if (!activeDoor || phase !== 'ANSWERING_QUESTION') return;

      const lockKey = `${sessionId}_${activeDoor.doorId}`;
      if (turnEvalLockRef.current === lockKey) return;
      turnEvalLockRef.current = lockKey;

      deadlineMsRef.current = null;
      voiceManagerRef.current?.cancel();

      const pointsToAward = isCorrect
        ? scoringMode === 'SECRET'
          ? activeDoor.secretPoints
          : 10
        : 0;

      if (isCorrect) {
        b07Sound.playCorrect(isMuted);
      } else {
        b07Sound.playWrong(isMuted);
      }

      setLastTurnEvaluation({
        isCorrect,
        reason,
        pointsToAward,
      });

      setPhase('ANSWER_FEEDBACK');
    },
    [activeDoor, phase, sessionId, scoringMode, isMuted]
  );

  const handleSubmitMultipleChoice = () => {
    if (!activeDoor || !selectedOptionId || phase !== 'ANSWERING_QUESTION') return;
    if (deadlineMsRef.current !== null && Date.now() > deadlineMsRef.current) return;

    const q = activeDoor.question;
    const chosenOpt = q.options?.find((o) => o.id === selectedOptionId);
    const target = (q.correctAnswer || '').trim().toLowerCase();

    const isCorrect = Boolean(
      chosenOpt &&
        (chosenOpt.id.trim().toLowerCase() === target ||
          chosenOpt.label.trim().toLowerCase() === target ||
          chosenOpt.text.trim().toLowerCase() === target)
    );

    finalizeAnswerEvaluation(isCorrect, 'SUBMITTED');
  };

  const handleTeacherGradeOral = (isCorrect: boolean) => {
    if (!activeDoor || phase !== 'ANSWERING_QUESTION') return;
    finalizeAnswerEvaluation(isCorrect, 'ORAL_GRADED');
  };

  // --------------------------------------------------------------------------
  // 9. STEP 6: OPEN 3D DOOR & AWARD POINTS ONCE (WITH SKIP ANIMATION SUPPORT)
  // --------------------------------------------------------------------------
  const commitDoorOpenedAndAwardScore = useCallback(
    (doorToCommit: B07DoorEntity, evaluation: { isCorrect: boolean; pointsToAward: number }) => {
      if (doorOpenTimerRef.current) {
        window.clearTimeout(doorOpenTimerRef.current);
        doorOpenTimerRef.current = null;
      }

      const alreadyScored = scoredDoorIds.includes(doorToCommit.doorId);
      const finalPoints = alreadyScored ? 0 : evaluation.pointsToAward;

      if (!alreadyScored) {
        setScoredDoorIds((prev) => [...prev, doorToCommit.doorId]);
        setClassScore((prev) => prev + finalPoints);

        if (orgMode === 'TEAMS') {
          setTeams((prev) =>
            prev.map((t, idx) =>
              idx === activeTeamIdx
                ? {
                    ...t,
                    score: t.score + finalPoints,
                    correctCount: t.correctCount + (evaluation.isCorrect ? 1 : 0),
                    doorsOpened: t.doorsOpened + 1,
                  }
                : t
            )
          );
        } else if (orgMode === 'INDIVIDUAL' && activeStudent && onPick && finalPoints > 0) {
          onPick(activeStudent, {
            bonusPoints: finalPoints,
            note: `B07 Ô cửa #${doorToCommit.doorNumber}`,
            sessionId,
          });
        }

        setDoors((prev) =>
          prev.map((d) =>
            d.doorId === doorToCommit.doorId
              ? {
                  ...d,
                  status: 'OPENED',
                  answeredCorrectly: evaluation.isCorrect,
                  pointsAwarded: finalPoints,
                  openedByLabel: currentActorLabel,
                }
              : d
          )
        );

        setTurnHistory((prev) => [
          {
            turnId: `turn_${Date.now()}_${doorToCommit.doorNumber}`,
            timestamp: new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            doorNumber: doorToCommit.doorNumber,
            actorLabel: currentActorLabel,
            questionStem: doorToCommit.question.stem,
            correctAnswerText: doorToCommit.question.correctAnswer,
            explanation: doorToCommit.question.explanation,
            isCorrect: evaluation.isCorrect,
            pointsAwarded: finalPoints,
            rewardArtifact: doorToCommit.rewardArtifact,
          },
          ...prev,
        ]);
      }

      setPhase('TURN_SUMMARY');
    },
    [
      scoredDoorIds,
      orgMode,
      activeTeamIdx,
      activeStudent,
      onPick,
      sessionId,
      currentActorLabel,
    ]
  );

  const handleTriggerOpenDoor = (skipAnim = false) => {
    if (!activeDoor || !lastTurnEvaluation) return;
    b07Sound.playDoorUnlockAndOpen(isMuted);

    // Mark door OPENED immediately so the 3D hinge swing animation plays on stage
    setDoors((prev) =>
      prev.map((d) =>
        d.doorId === activeDoor.doorId
          ? {
              ...d,
              status: 'OPENED',
              answeredCorrectly: lastTurnEvaluation.isCorrect,
              pointsAwarded: lastTurnEvaluation.pointsToAward,
              openedByLabel: currentActorLabel,
            }
          : d
      )
    );

    if (skipAnim || reduceMotion) {
      commitDoorOpenedAndAwardScore(activeDoor, lastTurnEvaluation);
    } else {
      setPhase('OPENING_DOOR');
      doorOpenTimerRef.current = window.setTimeout(() => {
        commitDoorOpenedAndAwardScore(activeDoor, lastTurnEvaluation);
      }, 950);
    }
  };

  // --------------------------------------------------------------------------
  // 10. STEP 7 & 8: NEXT TURN OR FINISH SESSION
  // --------------------------------------------------------------------------
  const handleNextTurn = () => {
    voiceManagerRef.current?.cancel();
    const openedCount = doors.filter((d) => d.status === 'OPENED').length;
    if (openedCount >= doors.length) {
      setActiveDoorId(null);
      setPhase('FINISHED');
      clearSavedSessionStorage();
      b07Sound.playFanfare(isMuted);
      return;
    }

    if (orgMode === 'TEAMS' && teams.length > 0) {
      setActiveTeamIdx((prev) => (prev + 1) % teams.length);
    } else if (orgMode === 'INDIVIDUAL') {
      pickNextRandomStudent();
    }

    setActiveDoorId(null);
    setSelectedOptionId(null);
    setLastTurnEvaluation(null);
    setPhase('SELECTING_DOOR');
  };

  // --------------------------------------------------------------------------
  // 11. DEADLINE TIMER & PAUSE / RESUME
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'ANSWERING_QUESTION' || deadlineMsRef.current === null) return;

    const tick = () => {
      if (deadlineMsRef.current === null) return;
      const diffMs = deadlineMsRef.current - Date.now();
      if (diffMs <= 0) {
        setRemainingSeconds(0);
        deadlineMsRef.current = null;
        finalizeAnswerEvaluation(false, 'TIMEOUT');
      } else {
        setRemainingSeconds(Math.ceil(diffMs / 1000));
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [phase, finalizeAnswerEvaluation]);

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
    setPhase(phaseBeforePauseRef.current || 'SELECTING_DOOR');
  }, [phase]);

  // --------------------------------------------------------------------------
  // 12. VIETNAMESE VOICE READER (SPEAK QUESTION STEM & OPTIONS)
  // --------------------------------------------------------------------------
  const handleSpeakQuestion = (q: B07QuestionItem) => {
    const vm = voiceManagerRef.current;
    if (!vm) return;
    const cleanStem = q.stem.replace(/\$+/g, '').trim();
    const optPart = q.options
      ? q.options.map((o) => `Đáp án ${o.label}: ${o.text.replace(/\$+/g, '')}`).join('. ')
      : '';
    const fullText = optPart ? `Câu hỏi: ${cleanStem}. ${optPart}` : `Câu hỏi: ${cleanStem}`;
    const outcome = vm.speakVietnamese(fullText, isMuted);
    if (!outcome.spoken) {
      if (outcome.reason === 'muted_or_disabled') {
        setVoiceNotice('Âm thanh đang tắt. Hãy bật loa trên thanh điều khiển để đọc câu hỏi.');
      } else {
        setVoiceNotice(
          'Trình duyệt trên máy này chưa có giọng đọc tiếng Việt (vi-VN). Học sinh vẫn có thể đọc câu hỏi trực tiếp trên màn hình.'
        );
      }
      setTimeout(() => setVoiceNotice(null), 3500);
    } else {
      setVoiceNotice(null);
    }
  };

  // --------------------------------------------------------------------------
  // 13. LEADERBOARD WITH TIE DETECTION ("ĐỒNG HẠNG")
  // --------------------------------------------------------------------------
  const rankedTeams = useMemo(() => {
    if (teams.length === 0) return [];
    const sorted = [...teams].sort(
      (a, b) => b.score - a.score || b.correctCount - a.correctCount
    );
    return sorted.map((team) => {
      const sameScoreCount = sorted.filter((t) => t.score === team.score).length;
      const firstIdx = sorted.findIndex((t) => t.score === team.score);
      return {
        ...team,
        rank: firstIdx + 1,
        isTied: sameScoreCount > 1,
      };
    });
  }, [teams]);

  const openedDoorsCount = useMemo(
    () => doors.filter((d) => d.status === 'OPENED').length,
    [doors]
  );

  const correctDoorsCount = useMemo(
    () => doors.filter((d) => d.status === 'OPENED' && d.answeredCorrectly).length,
    [doors]
  );

  // ==========================================================================
  // RENDER: 3D HALL OF MYSTERY DOORS
  // ==========================================================================
  return (
    <div className="relative w-full min-h-[680px] rounded-3xl bg-gradient-to-b from-[#061229] via-[#0B1E40] to-[#08152E] text-white border-2 border-amber-400/45 shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col select-none">
      {/* Ambient 3D Stage Lighting & Floor Perspective */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[750px] h-56 rounded-full bg-blue-500/15 blur-3xl" />
      </div>

      {/* TOP BAR */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#07152E]/90 backdrop-blur-md border-b border-amber-400/25">
        <div className="flex items-center gap-3">
          {onCloseGame && (
            <button
              type="button"
              onClick={() => {
                if (phase !== 'SETUP' && phase !== 'FINISHED') {
                  setConfirmActionModal('LIBRARY');
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

          {/* 3D Portal Archway Crest SVG */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-700 p-0.5 shadow-[0_0_20px_rgba(245,158,11,0.4)] shrink-0">
            <div className="w-full h-full rounded-[14px] bg-[#081A38] flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-6 h-6" aria-hidden="true">
                <path
                  d="M9,30 V13 C9,8 13,5 18,5 C23,5 27,8 27,13 V30"
                  fill="#F59E0B"
                  fillOpacity="0.25"
                  stroke="#FDE047"
                  strokeWidth="2.5"
                />
                <circle cx="22" cy="19" r="2" fill="#FEF08A" />
              </svg>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/50 text-amber-300 text-[11px] font-black tracking-wider">
                B07
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Ô cửa bí mật · Đại Sảnh Những Ô Cửa Bí Mật 3D
              </h2>
            </div>
            <p className="text-[11px] text-cyan-200/85 font-medium hidden sm:block">
              Nhóm B: Khởi động tiết học · {scoringMode === 'SECRET' ? 'Điểm bí mật 10–30đ (Có yếu tố may mắn)' : 'Điểm cố định 10đ/câu'}
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {(questionSource === 'SAMPLE_12' || questionSource === 'COMBINED') && (
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
                {phase === 'PAUSED' ? (
                  <Play className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                <span>{phase === 'PAUSED' ? 'Tiếp tục' : 'Tạm dừng'}</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmActionModal('REPLAY')}
                className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Chơi lại</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (phase === 'ANSWERING_QUESTION') handlePauseSession();
              setShowGuideModal(true);
            }}
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

      {/* Voice Notice Banner */}
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
      {/* PHASE 1: PRE-GAME SETUP SCREEN                                       */}
      {/* ==================================================================== */}
      {phase === 'SETUP' && (
        <div className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          {hasRestorableSession && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-900/60 via-blue-900/70 to-indigo-900/70 border border-amber-400/50 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-white">
                    Phát hiện phiên chơi B07 – Ô cửa bí mật đang dở dang
                  </p>
                  <p className="text-xs text-cyan-200/90">
                    Giáo viên có thể khôi phục các ô cửa đã mở và bảng điểm hoặc bắt đầu phiên mới.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestoreSavedSession}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all cursor-pointer"
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Organization, Door Count & Question Source */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Organization Mode & Number of Doors */}
              <div className="p-5 rounded-3xl bg-[#0B2144]/85 border border-cyan-400/25 shadow-xl space-y-4">
                <h3 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-300" />
                  <span>1. Chế độ tổ chức lớp & Số ô cửa 3D</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      key: 'CLASS' as B07OrgMode,
                      title: 'Cả lớp chung',
                      desc: 'Khởi động nhanh, ghi nhận tổng điểm chung cả lớp',
                    },
                    {
                      key: 'INDIVIDUAL' as B07OrgMode,
                      title: 'Cá nhân',
                      desc: 'Phân lượt học sinh trả lời và ghi nhận điểm thưởng',
                    },
                    {
                      key: 'TEAMS' as B07OrgMode,
                      title: 'Theo đội (2–6 đội)',
                      desc: 'Các đội luân phiên chọn ô cửa và đua điểm',
                    },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setOrgMode(m.key)}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        orgMode === m.key
                          ? 'bg-blue-600/35 border-amber-300 text-white shadow-md'
                          : 'bg-slate-900/65 border-slate-700/80 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-sm font-black text-white">{m.title}</p>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{m.desc}</p>
                    </button>
                  ))}
                </div>

                {orgMode === 'TEAMS' && (
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10">
                    <span className="text-xs font-bold text-slate-300">
                      Số lượng đội tham gia (2–6 đội):
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4, 5, 6].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTeamCount(cnt)}
                          className={`w-9 h-9 rounded-xl text-xs font-black border cursor-pointer ${
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

                {/* Door Count: 6, 9, or 12 */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Số lượng Ô cửa bí mật trên sân khấu:
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {([6, 9, 12] as B07DoorCount[]).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setDoorCount(cnt)}
                        className={`py-3 px-4 rounded-2xl border-2 font-black text-sm transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                          doorCount === cnt
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-white shadow-lg'
                            : 'bg-slate-900/75 text-slate-200 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <span>{cnt} Ô CỬA</span>
                        <span
                          className={`text-[10px] font-bold ${
                            doorCount === cnt ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {cnt === 6 ? 'Khởi động nhanh (~3p)' : cnt === 9 ? 'Chuẩn tiết học (~5p)' : 'Sôi nổi (~7p)'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Question Bank Source & Shortage Handling */}
              <div className="p-5 rounded-3xl bg-[#0B2144]/85 border border-cyan-400/25 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-cyan-300" />
                    <span>2. Bộ câu hỏi khởi động</span>
                  </h3>
                  <span className="text-xs font-bold text-emerald-300">
                    Khả dụng: {activeQuestionPool.length} câu
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setQuestionSource('SAMPLE_12')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      questionSource === 'SAMPLE_12'
                        ? 'bg-blue-600/35 border-amber-300 text-white'
                        : 'bg-slate-900/65 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase text-amber-300">
                      DỮ LIỆU MẪU (12 CÂU)
                    </span>
                    <p className="text-sm font-black text-white mt-0.5">Bộ mẫu THCS chuẩn</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Gồmทั้ง trắc nghiệm 1 đáp án và câu trả lời ngắn Toán – KHTN – Tin học
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuestionSource('QUESTION_BANK')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      questionSource === 'QUESTION_BANK'
                        ? 'bg-blue-600/35 border-amber-300 text-white'
                        : 'bg-slate-900/65 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase text-cyan-300">
                      NGÂN HÀNG CÂU HỎI ({convertedBankQuestions.length})
                    </span>
                    <p className="text-sm font-black text-white mt-0.5">Ngân hàng hiện tại</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Sử dụng trực tiếp các câu hỏi đã duyệt của lớp/môn đang chọn
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuestionSource('COMBINED')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      questionSource === 'COMBINED'
                        ? 'bg-blue-600/35 border-amber-300 text-white'
                        : 'bg-slate-900/65 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase text-emerald-300">
                      KẾT HỢP ({convertedBankQuestions.length + SAMPLE_B07_QUESTIONS.length})
                    </span>
                    <p className="text-sm font-black text-white mt-0.5">Ngân hàng + Mẫu</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Ưu tiên câu hỏi ngân hàng và tự bù bằng bộ mẫu khi thiếu
                    </p>
                  </button>
                </div>

                {/* Explicit Shortage Alert (Never silently repeats questions) */}
                {shortageCount > 0 && (
                  <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-400/60 text-rose-100 space-y-2.5">
                    <div className="flex items-start gap-2 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <span>
                        Nguồn câu hỏi đang chọn hiện có {activeQuestionPool.length} câu, còn thiếu{' '}
                        <strong className="text-amber-300">{shortageCount} câu</strong> để mở đủ {doorCount} ô cửa (mỗi câu chỉ xuất hiện 1 lần trong phiên).
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeQuestionPool.length >= 6 && doorCount > 6 && (
                        <button
                          type="button"
                          onClick={() => setDoorCount(activeQuestionPool.length >= 9 ? 9 : 6)}
                          className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                        >
                          Giảm xuống {activeQuestionPool.length >= 9 ? 9 : 6} ô cửa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setQuestionSource('COMBINED')}
                        className="px-3 py-1.5 rounded-xl bg-cyan-400 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        Bổ sung câu hỏi từ Bộ mẫu THCS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Scoring Rule, Timer, Motion & Start */}
            <div className="lg:col-span-5 space-y-5">
              <div className="p-5 rounded-3xl bg-[#0B2144]/85 border border-cyan-400/25 shadow-xl space-y-4">
                <h3 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-cyan-300" />
                  <span>3. Luật điểm, Thời gian & Trình chiếu</span>
                </h3>

                {/* Scoring Mode: Fixed vs Secret */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Tùy chọn luật tính điểm & Phần thưởng bí mật:
                  </label>
                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setScoringMode('SECRET')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        scoringMode === 'SECRET'
                          ? 'bg-gradient-to-r from-amber-500/25 to-blue-600/25 border-amber-300 text-white'
                          : 'bg-slate-900/70 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-300">
                          B. ĐIỂM BÍ MẬT (+10, +20 HOẶC +30 ĐIỂM)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 text-[10px] font-black">
                          Có yếu tố may mắn
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                        Phân bổ đều số cửa 10 / 20 / 30 điểm và xáo trộn cố định ngay khi bắt đầu phiên. Chỉ nhận điểm khi trả lời đúng (sai hoặc hết giờ: 0 điểm, không trừ điểm).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScoringMode('FIXED')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        scoringMode === 'FIXED'
                          ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/25 border-cyan-300 text-white'
                          : 'bg-slate-900/70 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-cyan-300">
                          A. ĐIỂM CỐ ĐỊNH (+10 ĐIỂM / CÂU ĐÚNG)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-200 text-[10px] font-black">
                          Công bằng tuyệt đối
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                        Mỗi câu trả lời đúng nhận đúng +10 điểm (sai hoặc hết giờ: 0 điểm). Vật phẩm 3D phía sau cửa mang tính trang trí khích lệ.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Time Limit per Question */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Thời gian suy nghĩ mỗi câu hỏi:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { sec: 0, label: 'Không giới hạn' },
                      { sec: 15, label: '15 giây' },
                      { sec: 30, label: '30 giây' },
                      { sec: 60, label: '60 giây' },
                    ].map((t) => (
                      <button
                        key={t.sec}
                        type="button"
                        onClick={() => setTimeLimitSec(t.sec)}
                        className={`py-2 px-2 rounded-xl text-xs font-black border cursor-pointer ${
                          timeLimitSec === t.sec
                            ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reduce Motion Toggle */}
                <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/70 border border-slate-700/80 cursor-pointer">
                  <div>
                    <p className="text-xs font-extrabold text-white">
                      Giảm chuyển động 3D (Reduce Motion)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Mở cửa tức thì, phù hợp máy cấu hình nhẹ hoặc cần tiết kiệm thời gian.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reduceMotion}
                    onChange={(e) => setReduceMotion(e.target.checked)}
                    className="w-4 h-4 accent-amber-400 shrink-0"
                  />
                </label>

                <button
                  type="button"
                  disabled={shortageCount > 0 || activeQuestionPool.length === 0}
                  onClick={handleStartSession}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-base shadow-[0_10px_30px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>BẮT ĐẦU MỞ {doorCount} Ô CỬA BÍ MẬT</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 2: MAIN 3D STAGE OF MYSTERY DOORS                              */}
      {/* ==================================================================== */}
      {phase !== 'SETUP' && phase !== 'FINISHED' && (
        <div className="relative z-10 flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start overflow-y-auto">
          {/* ================================================================ */}
          {/* CENTER 3D DOORS STAGE (8 COLUMNS ON DESKTOP)                     */}
          {/* ================================================================ */}
          <div className="lg:col-span-8 space-y-4">
            {/* Stage Banner */}
            <div className="p-3.5 rounded-2xl bg-[#091D3E]/90 border border-amber-400/35 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-300/50 text-amber-200 text-xs font-black">
                  Đã mở: {openedDoorsCount} / {doors.length} ô cửa
                </span>
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-extrabold text-white">
                  <Users className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Đến lượt:</span>
                  <span className="text-amber-300 truncate max-w-[200px]">
                    {currentActorLabel}
                  </span>
                </div>
              </div>

              <span className="text-xs font-bold text-cyan-200">
                {phase === 'SELECTING_DOOR'
                  ? 'Hãy chọn một ô cửa chưa mở trên sân khấu!'
                  : phase === 'OPENING_DOOR'
                  ? 'Cánh cửa 3D đang xoay mở...'
                  : 'Đang giải quyết câu hỏi của ô cửa'}
              </span>
            </div>

            {/* 3D Architectural Doors Grid */}
            <div className="relative rounded-3xl border-2 border-amber-400/45 bg-gradient-to-b from-[#0A1936] via-[#0F254E] to-[#071226] p-5 sm:p-7 shadow-2xl min-h-[490px] flex flex-col justify-center">
              {/* Floor Perspective Reflection Strip */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-amber-500/10 to-transparent" />

              <div
                className={`grid gap-4 sm:gap-5 w-full max-w-4xl mx-auto relative z-10 ${
                  doorCount === 6
                    ? 'grid-cols-2 sm:grid-cols-3'
                    : doorCount === 9
                    ? 'grid-cols-2 sm:grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                }`}
              >
                {doors.map((door) => {
                  const isOpened = door.status === 'OPENED';
                  const isSelected = door.status === 'SELECTED' || activeDoorId === door.doorId;
                  const isHovered = hoveredDoorId === door.doorId;
                  const rewardMeta = REWARD_META[door.rewardArtifact];

                  return (
                    <button
                      key={door.doorId}
                      type="button"
                      disabled={isOpened || phase !== 'SELECTING_DOOR'}
                      onMouseEnter={() => setHoveredDoorId(door.doorId)}
                      onMouseLeave={() => setHoveredDoorId(null)}
                      onClick={() => handleSelectDoor(door)}
                      aria-label={
                        isOpened
                          ? `Ô cửa số ${door.doorNumber} đã mở: ${rewardMeta.title}, ${door.pointsAwarded} điểm`
                          : `Ô cửa bí mật số ${door.doorNumber}, chưa mở`
                      }
                      style={{ perspective: '1100px' }}
                      className={`group relative aspect-[3/4] rounded-2xl p-2 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-amber-300 ${
                        isOpened
                          ? 'bg-[#07142B] border-2 border-emerald-400/60 cursor-default'
                          : isSelected
                          ? 'bg-amber-400/20 border-2 border-amber-300 scale-[1.03] shadow-[0_0_30px_rgba(251,191,36,0.5)] cursor-pointer'
                          : 'bg-[#081733] border-2 border-amber-400/50 hover:border-amber-300 hover:scale-[1.02] shadow-[0_14px_28px_rgba(0,0,0,0.65)] cursor-pointer'
                      }`}
                    >
                      {/* Warm Golden Seam Glow Behind Closed Door */}
                      {!isOpened && (
                        <div
                          className={`pointer-events-none absolute inset-1.5 rounded-xl transition-opacity duration-300 ${
                            isHovered || isSelected ? 'opacity-90' : 'opacity-40'
                          }`}
                          style={{
                            boxShadow: 'inset 0 0 22px rgba(251, 191, 36, 0.55)',
                          }}
                        />
                      )}

                      {/* Inner Chamber Behind Door (3D Reward Artifact & Earned Score) */}
                      <div className="absolute inset-2 rounded-xl bg-gradient-to-b from-[#071329] via-[#0E2347] to-[#050C1A] border border-cyan-400/25 flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                        {isOpened ? (
                          <>
                            <RewardArtifact3DSVG
                              artifact={door.rewardArtifact}
                              sizeClass="w-14 h-14 sm:w-16 sm:h-16"
                            />
                            <span className="text-[11px] font-black text-amber-300 mt-1 line-clamp-1">
                              {rewardMeta.title}
                            </span>
                            <span
                              className={`mt-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                                door.answeredCorrectly
                                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                              }`}
                            >
                              {door.answeredCorrectly
                                ? `+${door.pointsAwarded} điểm`
                                : '0 điểm'}
                            </span>
                          </>
                        ) : (
                          <div className="opacity-20 flex flex-col items-center">
                            <Lock className="w-6 h-6 text-amber-300" />
                          </div>
                        )}
                      </div>

                      {/* 3D Hinged Door Leaf (Rotates around Left Hinge Axis) */}
                      <div
                        style={{
                          transformStyle: 'preserve-3d',
                          transformOrigin: 'left center',
                          transform: isOpened
                            ? 'rotateY(-112deg)'
                            : isHovered && phase === 'SELECTING_DOOR' && !reduceMotion
                            ? 'rotateY(-10deg)'
                            : 'rotateY(0deg)',
                          transition: reduceMotion
                            ? 'none'
                            : 'transform 750ms cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                        className="relative w-full h-full rounded-xl"
                      >
                        {/* Left Metallic Hinges (Top, Middle, Bottom) */}
                        <div className="absolute -left-1.5 top-4 w-2 h-5 rounded-sm bg-gradient-to-r from-amber-600 via-yellow-300 to-amber-700 shadow" />
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-5 rounded-sm bg-gradient-to-r from-amber-600 via-yellow-300 to-amber-700 shadow" />
                        <div className="absolute -left-1.5 bottom-4 w-2 h-5 rounded-sm bg-gradient-to-r from-amber-600 via-yellow-300 to-amber-700 shadow" />

                        {/* Door Front Panel (Royal Wood + Gold Bevel + Crystal Number) */}
                        <div
                          style={{ backfaceVisibility: 'hidden' }}
                          className="w-full h-full rounded-xl bg-gradient-to-br from-[#6B3410] via-[#4A2208] to-[#2B1204] border-2 border-amber-300/80 shadow-[inset_0_2px_10px_rgba(254,240,138,0.35),4px_0_12px_rgba(0,0,0,0.6)] p-2.5 flex flex-col justify-between relative"
                        >
                          {/* Upper Carved Arch Trim */}
                          <div className="w-full py-1 rounded-t-lg bg-black/30 border border-amber-300/35 text-center">
                            <span className="text-[10px] font-black tracking-widest text-amber-200 uppercase">
                              Ô CỬA BÍ MẬT
                            </span>
                          </div>

                          {/* Center 3D Number Medallion */}
                          <div className="my-auto mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b from-[#0B1E40] to-[#061024] border-2 border-amber-300 shadow-[0_4px_12px_rgba(0,0,0,0.65),inset_0_0_12px_rgba(56,189,248,0.3)] flex items-center justify-center">
                            <span className="text-2xl sm:text-3xl font-black text-amber-300 tabular-nums">
                              {door.doorNumber}
                            </span>
                          </div>

                          {/* Brass Door Handle & Keyhole on Right Edge */}
                          <div
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-transform ${
                              isSelected ? 'rotate-12 scale-110' : ''
                            }`}
                          >
                            <div className="w-3.5 h-7 rounded-full bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-700 border border-yellow-100 shadow-md" />
                          </div>

                          {/* Bottom Status Plate */}
                          <div className="w-full py-1 rounded-b-lg bg-black/35 border border-amber-300/30 flex items-center justify-center gap-1 text-[10px] font-extrabold text-amber-100">
                            <KeyRound className="w-3 h-3 text-amber-300" />
                            <span>Chạm để mở</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Skip Door Swing Animation Bar when in OPENING_DOOR */}
              {phase === 'OPENING_DOOR' && activeDoor && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleTriggerOpenDoor(true)}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
                  >
                    <FastForward className="w-4 h-4" />
                    <span>Bỏ qua hoạt ảnh mở cửa</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* RIGHT SIDEBAR (4 COLUMNS ON DESKTOP): SCOREBOARD & LOGS          */}
          {/* ================================================================ */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded-3xl bg-[#091D3E]/90 border border-cyan-400/30 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" />
                  <span>Bảng điểm & Lượt chơi</span>
                </h3>
                <span className="text-xs font-extrabold text-cyan-200">
                  Tổng: {classScore} điểm
                </span>
              </div>

              {orgMode === 'TEAMS' && teams.length > 0 ? (
                <div className="space-y-2">
                  {teams.map((team, idx) => {
                    const isTurn = idx === activeTeamIdx;
                    return (
                      <div
                        key={team.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                          isTurn
                            ? 'bg-gradient-to-r from-blue-900/90 to-amber-900/50 border-amber-300 shadow-md'
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
                              <span className="truncate">{team.name}</span>
                              {isTurn && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black shrink-0">
                                  ĐẾN LƯỢT
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Đúng: {team.correctCount}/{team.doorsOpened} cửa
                            </p>
                          </div>
                        </div>
                        <span className="text-base font-black text-amber-300 shrink-0 tabular-nums">
                          {team.score} đ
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-200 truncate">
                      {currentActorLabel}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Trả lời đúng: {correctDoorsCount} / {openedDoorsCount} cửa đã mở
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-black text-amber-300 tabular-nums">
                      {classScore}
                    </span>
                    <span className="text-xs font-bold text-amber-200 ml-1">điểm</span>
                  </div>
                </div>
              )}

              {/* Teacher Quick Actions */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                {orgMode !== 'CLASS' && phase === 'SELECTING_DOOR' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (orgMode === 'TEAMS' && teams.length > 0) {
                        setActiveTeamIdx((prev) => (prev + 1) % teams.length);
                      } else if (orgMode === 'INDIVIDUAL') {
                        pickNextRandomStudent();
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Đổi lượt</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    voiceManagerRef.current?.cancel();
                    deadlineMsRef.current = null;
                    setPhase('FINISHED');
                    clearSavedSessionStorage();
                    b07Sound.playFanfare(isMuted);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold cursor-pointer ml-auto"
                >
                  Kết thúc & Tổng kết
                </button>
              </div>
            </div>

            {/* Turn History Log */}
            <div className="p-4 rounded-3xl bg-[#091D3E]/90 border border-cyan-400/25 space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Lịch sử mở cửa ({turnHistory.length})
              </h4>
              {turnHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Chưa có ô cửa nào được mở trong phiên này.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {turnHistory.map((item) => (
                    <div
                      key={item.turnId}
                      className="px-3 py-2 rounded-xl bg-slate-900/85 border border-slate-800 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-black text-amber-300">
                          Cửa #{item.doorNumber}
                        </span>
                        <span className="text-slate-300 ml-1.5 truncate">
                          · {item.actorLabel}
                        </span>
                      </div>
                      <span
                        className={`font-black shrink-0 ${
                          item.isCorrect ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {item.isCorrect ? `Đúng (+${item.pointsAwarded}đ)` : 'Chưa đúng (0đ)'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* STEP 3, 4 & 5 MODAL: QUESTION & ANSWER FEEDBACK                  */}
          {/* ================================================================ */}
          {(phase === 'ANSWERING_QUESTION' || phase === 'ANSWER_FEEDBACK') && activeDoor && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
              <div className="w-full max-w-2xl rounded-3xl bg-gradient-to-b from-[#0D2652] to-[#081836] border-2 border-amber-300 p-5 sm:p-7 text-white shadow-2xl space-y-5 my-auto">
                {/* Modal Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/15">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs sm:text-sm">
                      Ô CỬA SỐ #{activeDoor.doorNumber}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-blue-500/25 border border-blue-400/40 text-cyan-200 text-xs font-bold">
                      {activeDoor.question.topicTag}
                    </span>
                    <span className="text-xs font-bold text-amber-200">
                      Lượt: {currentActorLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSpeakQuestion(activeDoor.question)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-300/40 text-cyan-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Đọc câu hỏi</span>
                    </button>

                    {timeLimitSec > 0 && phase === 'ANSWERING_QUESTION' && (
                      <div
                        className={`px-3.5 py-1.5 rounded-xl border font-black text-sm flex items-center gap-1.5 tabular-nums ${
                          remainingSeconds <= 5
                            ? 'bg-rose-600/35 border-rose-400 text-rose-200 animate-pulse'
                            : 'bg-slate-900 border-amber-300/50 text-amber-300'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>{remainingSeconds}s</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Question Stem */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#061229]/95 border border-cyan-400/30 text-lg sm:text-xl font-extrabold text-white leading-relaxed">
                  <MathView content={activeDoor.question.stem} />
                </div>

                {/* Question Body: Multiple Choice vs Oral/Short Answer */}
                {activeDoor.question.questionType === 'MULTIPLE_CHOICE' &&
                activeDoor.question.options ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeDoor.question.options.map((opt) => {
                      const isSelected = selectedOptionId === opt.id;
                      const target = (activeDoor.question.correctAnswer || '')
                        .trim()
                        .toLowerCase();
                      const isCorrectOpt =
                        opt.id.trim().toLowerCase() === target ||
                        opt.label.trim().toLowerCase() === target ||
                        opt.text.trim().toLowerCase() === target;

                      let cardClass =
                        'bg-slate-900/80 border-slate-700 text-slate-100 hover:border-cyan-300';
                      let statusBadge: React.ReactNode = null;

                      if (phase === 'ANSWER_FEEDBACK') {
                        if (isCorrectOpt) {
                          cardClass =
                            'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-100 shadow-lg';
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ĐÁP ÁN ĐÚNG</span>
                            </span>
                          );
                        } else if (isSelected && !isCorrectOpt) {
                          cardClass =
                            'bg-rose-950/85 border-2 border-rose-400 text-rose-100';
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded bg-rose-500 text-white text-[10px] font-black flex items-center gap-1 shrink-0">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>CHƯA ĐÚNG</span>
                            </span>
                          );
                        }
                      } else if (isSelected) {
                        cardClass =
                          'bg-amber-400 text-slate-950 border-2 border-white font-black shadow-lg';
                      }

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={phase !== 'ANSWERING_QUESTION'}
                          onClick={() => setSelectedOptionId(opt.id)}
                          className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${cardClass}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                isSelected && phase === 'ANSWERING_QUESTION'
                                  ? 'bg-slate-950 text-amber-300'
                                  : 'bg-slate-800 text-cyan-300'
                              }`}
                            >
                              {opt.label}
                            </span>
                            <div className="text-sm sm:text-base font-bold break-words">
                              <MathView content={opt.text} />
                            </div>
                          </div>
                          {statusBadge}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-400/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-amber-300">
                        Câu hỏi trả lời miệng / ngắn (Giáo viên đánh giá trực tiếp)
                      </span>
                      {phase === 'ANSWERING_QUESTION' && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowOralReferenceAnswer((prev) => !prev)
                          }
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {showOralReferenceAnswer
                              ? 'Ẩn gợi ý đáp án'
                              : 'Xem đáp án tham khảo'}
                          </span>
                        </button>
                      )}
                    </div>

                    {(showOralReferenceAnswer || phase === 'ANSWER_FEEDBACK') && (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-400/40 text-xs sm:text-sm text-emerald-100">
                        <strong className="text-emerald-300">Đáp án chuẩn: </strong>
                        <MathView content={activeDoor.question.correctAnswer} />
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5: Feedback & Pedagogical Explanation (Text + Icon, not color alone) */}
                {phase === 'ANSWER_FEEDBACK' && lastTurnEvaluation && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`p-4 rounded-2xl border-2 space-y-2 ${
                      lastTurnEvaluation.isCorrect
                        ? 'bg-emerald-950/85 border-emerald-400 text-emerald-100'
                        : 'bg-rose-950/85 border-rose-400 text-rose-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                      {lastTurnEvaluation.isCorrect ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          <span>
                            CHÍNH XÁC! Đủ điều kiện nhận phần thưởng sau Ô cửa #{activeDoor.doorNumber}
                          </span>
                        </>
                      ) : lastTurnEvaluation.reason === 'TIMEOUT' ? (
                        <>
                          <Clock className="w-5 h-5 text-amber-300 shrink-0" />
                          <span>
                            HẾT GIỜ SUY NGHĨ! (0 điểm — Đáp án đúng: {activeDoor.question.correctAnswer})
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          <span>
                            CHƯA CHÍNH XÁC! (0 điểm — Đáp án đúng: {activeDoor.question.correctAnswer})
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-white/95 leading-relaxed">
                      <strong className="text-cyan-300">Giải thích ngắn: </strong>
                      <MathView content={activeDoor.question.explanation} />
                    </div>
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  {phase === 'ANSWERING_QUESTION' ? (
                    activeDoor.question.questionType === 'MULTIPLE_CHOICE' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTeacherGradeOral(true)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/45 border border-emerald-400/50 text-emerald-200 text-xs font-bold cursor-pointer"
                          >
                            GV chấm: Đúng
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTeacherGradeOral(false)}
                            className="px-3.5 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/45 border border-rose-400/50 text-rose-200 text-xs font-bold cursor-pointer"
                          >
                            GV chấm: Chưa đúng
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={!selectedOptionId}
                          onClick={handleSubmitMultipleChoice}
                          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer ml-auto"
                        >
                          <Check className="w-4 h-4" />
                          <span>Chốt đáp án</span>
                        </button>
                      </>
                    ) : (
                      <div className="w-full flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleTeacherGradeOral(false)}
                          className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center gap-2 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Chưa đúng (0đ)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTeacherGradeOral(true)}
                          className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Đúng (Mở thưởng)</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="w-full flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleTriggerOpenDoor(true)}
                        className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                      >
                        Bỏ qua hoạt ảnh
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerOpenDoor(false)}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm flex items-center gap-2 shadow-xl cursor-pointer"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Mở cửa #{activeDoor.doorNumber}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 6 & 7 MODAL: TURN SUMMARY & REWARD REVEAL                   */}
          {/* ================================================================ */}
          {phase === 'TURN_SUMMARY' && activeDoor && lastTurnEvaluation && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#102A5C] via-[#0B1D42] to-[#061128] border-2 border-amber-300 p-6 sm:p-8 text-white text-center shadow-2xl space-y-5">
                <div className="mx-auto w-24 h-24 rounded-3xl bg-amber-400/15 border-2 border-amber-300/70 flex items-center justify-center shadow-[0_0_35px_rgba(251,191,36,0.45)]">
                  <RewardArtifact3DSVG
                    artifact={activeDoor.rewardArtifact}
                    sizeClass="w-16 h-16"
                  />
                </div>

                <div className="space-y-1">
                  <span className="px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black uppercase tracking-wider">
                    Ô cửa số #{activeDoor.doorNumber} đã mở
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white pt-1">
                    {REWARD_META[activeDoor.rewardArtifact].title}
                  </h3>
                  <p className="text-xs text-cyan-200">
                    {REWARD_META[activeDoor.rewardArtifact].subtitle}
                  </p>
                </div>

                <div
                  className={`p-4 rounded-2xl border ${
                    lastTurnEvaluation.isCorrect
                      ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-200'
                      : 'bg-slate-900/90 border-slate-700 text-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold uppercase">
                    Kết quả lượt của {currentActorLabel}:
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300 mt-1 tabular-nums">
                    +{lastTurnEvaluation.pointsToAward} ĐIỂM
                  </p>
                  {!lastTurnEvaluation.isCorrect && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      (Câu trả lời chưa đúng nên nhận 0 điểm ở ô cửa này)
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNextTurn}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <span>
                    {openedDoorsCount >= doors.length
                      ? 'Xem Bảng Tổng Kết'
                      : 'Lượt tiếp theo'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* PAUSE OVERLAY                                                    */}
          {/* ================================================================ */}
          {phase === 'PAUSED' && (
            <div className="absolute inset-0 z-50 bg-[#050E22]/95 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-400/20 border-2 border-amber-300 flex items-center justify-center text-amber-300">
                <Pause className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Trò chơi đang tạm dừng
              </h3>
              <p className="text-xs sm:text-sm text-cyan-200 max-w-md">
                Thời gian suy nghĩ và trạng thái các ô cửa 3D đang được bảo toàn.
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
      {/* PHASE 3: STEP 8 — FINISHED SUMMARY & QUESTION REVIEW                 */}
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
                    HOÀN THÀNH B07 · Ô CỬA BÍ MẬT 3D
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                    Tổng kết Đại Sảnh Những Ô Cửa Bí Mật
                  </h3>
                  <p className="text-xs text-cyan-200">
                    Số câu trả lời đúng: <strong>{correctDoorsCount}</strong> /{' '}
                    <strong>{openedDoorsCount}</strong> cửa đã mở · Tổng điểm:{' '}
                    <strong className="text-amber-300">{classScore} điểm</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-300/50 text-cyan-200 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Xem lại câu hỏi</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartSession}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Chơi lại</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('SETUP')}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-600 cursor-pointer"
                >
                  Thiết lập mới
                </button>
                {onCloseGame && (
                  <button
                    type="button"
                    onClick={() => {
                      voiceManagerRef.current?.cancel();
                      onCloseGame();
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 cursor-pointer"
                  >
                    Về thư viện
                  </button>
                )}
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
                      <div className="min-w-0 pr-2">
                        <span className="text-[11px] font-black uppercase text-cyan-300">
                          {team.isTied ? `Đồng hạng #${team.rank}` : `Hạng #${team.rank}`}
                        </span>
                        <p className="text-base font-black text-white truncate">
                          {team.name}
                        </p>
                        <p className="text-xs text-slate-300">
                          Đúng {team.correctCount}/{team.doorsOpened} ô cửa
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-2xl font-black text-amber-300 tabular-nums">
                          {team.score}
                        </span>
                        <span className="text-xs font-bold text-amber-200 block">
                          điểm
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Inline Review of Opened Doors */}
            <div className="space-y-3">
              <h4 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Tóm tắt các ô cửa trong phiên ({doors.length} ô cửa)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doors.map((d) => (
                  <div
                    key={d.doorId}
                    className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-400/25 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-amber-300">
                        Ô cửa #{d.doorNumber} · {d.question.topicTag}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          d.status !== 'OPENED'
                            ? 'bg-slate-800 text-slate-400'
                            : d.answeredCorrectly
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {d.status !== 'OPENED'
                          ? 'Chưa mở'
                          : d.answeredCorrectly
                          ? `Đúng (+${d.pointsAwarded}đ)`
                          : 'Chưa đúng (0đ)'}
                      </span>
                    </div>
                    <div className="text-xs text-white font-semibold">
                      <MathView content={d.question.stem} />
                    </div>
                    <div className="text-xs text-emerald-300 font-bold">
                      Đáp án: <MathView content={d.question.correctAnswer} />
                    </div>
                    <div className="text-xs text-slate-300">
                      <MathView content={d.question.explanation} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* BOTTOM BAR                                                           */}
      {/* ==================================================================== */}
      <footer className="relative z-20 px-4 sm:px-6 py-2.5 bg-[#061126]/95 border-t border-amber-400/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-300">Quy trình lượt chơi:</span>
          <span>
            Chọn ô cửa chưa mở → Đọc & Chốt đáp án → Xem giải thích → Bấm “Mở cửa” khám phá phần thưởng 3D → Lượt tiếp theo.
          </span>
        </div>
        <span className="text-slate-400">
          Tây Đô Smart EDU · B07 Ô cửa bí mật 3D
        </span>
      </footer>

      {/* ==================================================================== */}
      {/* MODAL: REVIEW QUESTIONS ("XEM LẠI CÂU HỎI")                          */}
      {/* ==================================================================== */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-3xl bg-[#0A1E40] border-2 border-cyan-400 p-6 text-white flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-300">
                Xem lại toàn bộ câu hỏi & lời giải ({doors.length} ô cửa)
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {doors.map((d) => (
                <div
                  key={d.doorId}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300">
                      Ô cửa #{d.doorNumber} ({d.question.topicTag})
                    </span>
                    <span className="text-xs font-bold text-cyan-300">
                      Đáp án đúng: {d.question.correctAnswer}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    <MathView content={d.question.stem} />
                  </div>
                  <div className="text-xs text-slate-300">
                    <MathView content={d.question.explanation} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: GUIDE                                                         */}
      {/* ==================================================================== */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-[#0A1E40] border-2 border-amber-400/60 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-300">
                Hướng dẫn B07 – Ô cửa bí mật 3D
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
              <p>
                • <strong>Bước 1–3:</strong> Chọn một ô cửa chưa mở trên sân khấu. Bảng câu hỏi xuất hiện rõ ràng và đồng hồ bắt đầu đếm giờ.
              </p>
              <p>
                • <strong>Bước 4–5:</strong> Chọn phương án và bấm <strong>“Chốt đáp án”</strong> (hoặc giáo viên chấm <strong>“Đúng / Chưa đúng”</strong> với câu trả lời miệng). Hệ thống hiển thị đáp án và giải thích ngắn.
              </p>
              <p>
                • <strong>Bước 6–7:</strong> Giáo viên bấm <strong>“Mở cửa”</strong> để cánh cửa 3D xoay mở quanh bản lề, hé lộ vật phẩm 3D và điểm thưởng trước khi sang lượt tiếp theo.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CONFIRM REPLAY OR EXIT ACTIVE SESSION                         */}
      {/* ==================================================================== */}
      {confirmActionModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0A1E40] border-2 border-amber-400/60 p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-amber-300">
              {confirmActionModal === 'REPLAY'
                ? 'Xác nhận chơi lại từ đầu?'
                : 'Xác nhận rời phiên chơi đang diễn ra?'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Thao tác này sẽ xóa tiến độ mở cửa và điểm số của phiên đang chơi hiện tại.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmActionModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Ở lại chơi tiếp
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmActionModal;
                  setConfirmActionModal(null);
                  voiceManagerRef.current?.cancel();
                  deadlineMsRef.current = null;
                  clearSavedSessionStorage();
                  if (action === 'LIBRARY' && onCloseGame) {
                    onCloseGame();
                  } else {
                    setPhase('SETUP');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MysteryDoors3DGame;
