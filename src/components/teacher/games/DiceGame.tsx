import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Dices,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Timer as TimerIcon,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  Trophy,
  Award,
  EyeOff,
  History,
  RefreshCw,
  Layers,
  Hash,
  Flame,
} from 'lucide-react';

export type DiceGamePhase =
  | 'IDLE'
  | 'PREPARING'
  | 'ROLLING'
  | 'BOUNCING'
  | 'SETTLING'
  | 'REVEALING'
  | 'COMPLETED';

export type DicePlayMode = 'LUCKY_DICE' | 'TWO_DIGIT_3D' | 'CHALLENGE_DICE';

export type ChallengeCategoryKey = 'points' | 'time' | 'difficulty' | 'question_type';

export interface ChallengePreset {
  key: ChallengeCategoryKey;
  label: string;
  faces: Record<number, { title: string; badge: string; color: string }>;
}

export const CHALLENGE_PRESETS: Record<ChallengeCategoryKey, ChallengePreset> = {
  points: {
    key: 'points',
    label: 'Điểm thưởng khuyến khích',
    faces: {
      1: { title: '+1 điểm khuyến khích tinh thần', badge: '+1 điểm', color: 'bg-sky-500' },
      2: { title: '+2 điểm phát biểu xây dựng bài', badge: '+2 điểm', color: 'bg-emerald-500' },
      3: { title: '+3 điểm trả lời rõ ràng, tự tin', badge: '+3 điểm', color: 'bg-teal-500' },
      4: { title: '+5 điểm hoàn thành tốt nhiệm vụ', badge: '+5 điểm', color: 'bg-indigo-500' },
      5: { title: '+8 điểm xuất sắc vượt thử thách', badge: '+8 điểm', color: 'bg-purple-600' },
      6: { title: '+10 điểm Siêu sao + Tràng pháo tay cả lớp', badge: '+10 điểm', color: 'bg-amber-500' },
    },
  },
  time: {
    key: 'time',
    label: 'Thời gian suy nghĩ & trả lời',
    faces: {
      1: { title: 'Thử thách tia chớp: 15 giây trả lời', badge: '15 giây', color: 'bg-rose-500' },
      2: { title: 'Phản xạ nhanh: 20 giây trả lời', badge: '20 giây', color: 'bg-orange-500' },
      3: { title: 'Thời gian tiêu chuẩn: 30 giây trả lời', badge: '30 giây', color: 'bg-sky-500' },
      4: { title: 'Suy luận kỹ: 45 giây trả lời', badge: '45 giây', color: 'bg-emerald-500' },
      5: { title: 'Thong thả trình bày: 60 giây trả lời', badge: '60 giây', color: 'bg-indigo-500' },
      6: { title: 'Ưu tiên đặc biệt: 90 giây + Gợi ý từ GV', badge: '90 giây', color: 'bg-amber-500' },
    },
  },
  difficulty: {
    key: 'difficulty',
    label: 'Mức độ thử thách câu hỏi',
    faces: {
      1: { title: 'Mức 1: Khởi động nhẹ nhàng (Nhận biết)', badge: 'Khởi động', color: 'bg-emerald-500' },
      2: { title: 'Mức 2: Câu hỏi Nhận biết kiến thức nền', badge: 'Nhận biết', color: 'bg-sky-500' },
      3: { title: 'Mức 3: Câu hỏi Thông hiểu bản chất', badge: 'Thông hiểu', color: 'bg-indigo-500' },
      4: { title: 'Mức 4: Bài tập Vận dụng thực hành', badge: 'Vận dụng', color: 'bg-purple-600' },
      5: { title: 'Mức 5: Thử thách Vận dụng cao (Nhân đôi lộc)', badge: 'Vận dụng cao', color: 'bg-rose-500' },
      6: { title: 'Mức 6: Ngôi sao May mắn (Được mời 1 bạn trợ giúp)', badge: 'Trợ giúp', color: 'bg-amber-500' },
    },
  },
  question_type: {
    key: 'question_type',
    label: 'Hình thức câu hỏi kiểm tra',
    faces: {
      1: { title: 'Chọn 1 đáp án đúng (A, B, C hoặc D)', badge: 'Trắc nghiệm', color: 'bg-sky-500' },
      2: { title: 'Xác định Đúng / Sai và giải thích ngắn gọn', badge: 'Đúng / Sai', color: 'bg-emerald-500' },
      3: { title: 'Trả lời ngắn / Điền từ khóa chính xác', badge: 'Trả lời ngắn', color: 'bg-teal-500' },
      4: { title: 'Trình bày lời giải nhanh trên bảng', badge: 'Lên bảng', color: 'bg-indigo-500' },
      5: { title: 'Nêu 1 ví dụ thực tế liên quan bài học', badge: 'Thực tế', color: 'bg-purple-600' },
      6: { title: 'Đặc quyền tự chọn chủ đề câu hỏi yêu thích', badge: 'Tự chọn', color: 'bg-amber-500' },
    },
  },
};

export interface DiceGameProps {
  availableCandidates: StudentCandidate[];
  onPick: (
    student: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string; orderNumber?: number }
  ) => void;
  isMuted: boolean;
  allCandidates?: StudentCandidate[];
  absentIds?: Set<string>;
  calledSessionIds?: Set<string>;
  antiDuplicate?: boolean;
  onToggleAntiDuplicate?: () => void;
  onResetSession?: () => void;
  classes?: ClassRoom[];
  selectedSourceKey?: string;
  onSelectSourceKey?: (key: string) => void;
  resolvedClassName?: string;
  teacherId?: string;
  teacherName?: string;
  userRole?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onToggleMute?: () => void;
  onOpenAbsentModal?: () => void;
  onOpenHistoryModal?: () => void;
  onUpdateLatestNote?: (note: string) => void;
}

/**
 * Unbiased cryptographic random integer in [0, max - 1] using rejection sampling.
 * Eliminates modulo bias completely.
 */
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

/**
 * Exact target Euler angles (deg) so that a standard 6-sided cube (with opposite faces summing to 7)
 * lands with `faceValue` (1..6) facing directly toward the camera (Front = +Z).
 *
 * Cube Face Definitions:
 * - Face 1 (Front):  rotateY(0deg)   translateZ(half)
 * - Face 6 (Back):   rotateY(180deg) translateZ(half)  [1 + 6 = 7]
 * - Face 3 (Right):  rotateY(90deg)  translateZ(half)  [3 + 4 = 7]
 * - Face 4 (Left):   rotateY(-90deg) translateZ(half)  [4 + 3 = 7]
 * - Face 2 (Top):    rotateX(90deg)  translateZ(half)  [2 + 5 = 7]
 * - Face 5 (Bottom): rotateX(-90deg) translateZ(half)  [5 + 2 = 7]
 */
function getBaseAnglesForFace(faceValue: number): { rx: number; ry: number; rz: number } {
  switch (faceValue) {
    case 1:
      return { rx: 0, ry: 0, rz: 0 };
    case 6:
      return { rx: 0, ry: 180, rz: 0 };
    case 3:
      return { rx: 0, ry: -90, rz: 0 };
    case 4:
      return { rx: 0, ry: 90, rz: 0 };
    case 2:
      return { rx: -90, ry: 0, rz: 0 };
    case 5:
      return { rx: 90, ry: 0, rz: 0 };
    default:
      return { rx: 0, ry: 0, rz: 0 };
  }
}

/**
 * Web Audio Sound Engine for 3D Dice clatter, table bounce, settle click, and fanfare
 */
class DiceSoundEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
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

  playDiceShake(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(380 + Math.random() * 240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }

  playTableBounce(muted: boolean, intensity = 1) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      // Crisp wooden/felt table impact click + low thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220 * intensity + 80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(58, ctx.currentTime + 0.085);
      gain.gain.setValueAtTime(0.22 * intensity, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  playRevealFanfare(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + i * 0.085;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.44);
      });
    } catch {}
  }

  playTimerBell(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.24, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.85);
    } catch {}
  }
}

const diceSound = new DiceSoundEngine();

/**
 * Standard 3x3 Pip Layout for a 6-sided Die Face (values 1 to 6).
 * Face 1 has the traditional oversized crimson center pip; Faces 4 has crimson pips;
 * Faces 2, 3, 5, 6 have deep navy pips.
 */
const DieFacePips: React.FC<{ value: number }> = ({ value }) => {
  // 3x3 grid coordinates (0..8)
  const activePositions: Record<number, number[]> = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  const active = activePositions[value] || [4];
  const isRedPip = value === 1 || value === 4;

  return (
    <div className="w-full h-full p-2.5 sm:p-3 grid grid-cols-3 grid-rows-3 place-items-center select-none pointer-events-none">
      {Array.from({ length: 9 }).map((_, idx) => {
        const hasPip = active.includes(idx);
        if (!hasPip) return <div key={idx} />;
        return (
          <div
            key={idx}
            className={`rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.55)] ${
              value === 1
                ? 'w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-red-500 to-rose-700 ring-2 ring-red-200'
                : isRedPip
                ? 'w-3.5 h-3.5 sm:w-4 sm:h-4 bg-gradient-to-br from-red-500 to-rose-700'
                : 'w-3.5 h-3.5 sm:w-4 sm:h-4 bg-gradient-to-br from-slate-800 to-slate-950'
            }`}
          />
        );
      })}
    </div>
  );
};

/**
 * Authentic 6-Sided 3D Cube Die with opposite faces summing to 7 (1-6, 2-5, 3-4),
 * inner solid core planes, specular gloss, and dynamic table shadow.
 */
const True3DSixSidedDie: React.FC<{
  rx: number;
  ry: number;
  rz: number;
  liftY: number;
  offsetX: number;
  isSettled: boolean;
  label?: string;
  accentColor?: 'gold' | 'cyan';
}> = ({ rx, ry, rz, liftY, offsetX, isSettled, label, accentColor = 'gold' }) => {
  // Cube size: 96px (halfSize = 48px)
  const sizePx = 96;
  const half = sizePx / 2;

  const faces: { value: number; transform: string }[] = [
    { value: 1, transform: `rotateY(0deg) translateZ(${half}px)` },
    { value: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { value: 3, transform: `rotateY(90deg) translateZ(${half}px)` },
    { value: 4, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { value: 2, transform: `rotateX(90deg) translateZ(${half}px)` },
    { value: 5, transform: `rotateX(-90deg) translateZ(${half}px)` },
  ];

  // Dynamic shadow scales down and blurs when die is lifted into the air (liftY < 0)
  const heightRatio = Math.min(Math.max(Math.abs(liftY) / 130, 0), 1);
  const shadowScale = 1 - heightRatio * 0.42;
  const shadowOpacity = 0.58 - heightRatio * 0.35;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* 3D Perspective Viewport */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: `${sizePx + 40}px`,
          height: `${sizePx + 40}px`,
          perspective: '900px',
        }}
      >
        {/* Dynamic Ground Shadow on the Navy Table */}
        <div
          className="absolute bottom-1 rounded-full bg-black pointer-events-none transition-transform duration-75"
          style={{
            width: `${sizePx * 0.92}px`,
            height: '24px',
            transform: `translateX(${offsetX}px) scale(${shadowScale})`,
            opacity: shadowOpacity,
            filter: `blur(${6 + heightRatio * 8}px)`,
          }}
        />

        {/* Settled Spotlight Halo */}
        {isSettled && (
          <div
            className={`absolute inset-1 rounded-full pointer-events-none animate-pulse ${
              accentColor === 'gold'
                ? 'bg-amber-400/25 ring-4 ring-amber-300/60'
                : 'bg-cyan-400/25 ring-4 ring-cyan-300/60'
            }`}
            style={{ filter: 'blur(4px)' }}
          />
        )}

        {/* The 3D Cube Container */}
        <div
          style={{
            width: `${sizePx}px`,
            height: `${sizePx}px`,
            transformStyle: 'preserve-3d',
            transform: `translate3d(${offsetX}px, ${liftY}px, 0px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
          }}
        >
          {/* Solid Inner Core Planes so rounded corners never look hollow */}
          <div
            className="absolute inset-1 bg-amber-100 rounded-xl"
            style={{ transform: 'rotateY(0deg)' }}
          />
          <div
            className="absolute inset-1 bg-amber-100 rounded-xl"
            style={{ transform: 'rotateY(90deg)' }}
          />
          <div
            className="absolute inset-1 bg-amber-100 rounded-xl"
            style={{ transform: 'rotateX(90deg)' }}
          />

          {/* 6 Geometric 3D Faces */}
          {faces.map((f) => (
            <div
              key={f.value}
              className={`absolute inset-0 rounded-2xl border-2 bg-gradient-to-br from-white via-[#FFFDF7] to-[#E2E8F0] shadow-[inset_0_0_14px_rgba(15,45,82,0.14)] ${
                isSettled
                  ? accentColor === 'gold'
                    ? 'border-amber-300'
                    : 'border-cyan-300'
                  : 'border-slate-300/90'
              }`}
              style={{
                transform: f.transform,
                backfaceVisibility: 'hidden',
              }}
            >
              {/* Glossy Top-Left Specular Reflection */}
              <div className="absolute top-1 left-1.5 right-4 h-3 rounded-full bg-gradient-to-b from-white/90 to-transparent pointer-events-none" />
              <DieFacePips value={f.value} />
            </div>
          ))}
        </div>
      </div>

      {label && (
        <span className="mt-1 px-3 py-0.5 rounded-full bg-slate-900/80 border border-sky-400/30 text-[11px] font-extrabold text-sky-200 tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
};

/**
 * 10-Faced 3D Decagonal Digit Prism (Khối lăng trụ số 3D 10 mặt 0–9)
 * Used in Mode 2 (Xúc xắc hai chữ số 01–50) so we NEVER draw 7, 8, 9 on a 6-sided cube!
 * Each of the 10 faces is placed at `rotateX(digit * 36deg) translateZ(radius)`.
 */
const Decagonal3DDigitRoller: React.FC<{
  rotationX: number;
  tiltY: number;
  liftY: number;
  isSettled: boolean;
  label: string;
  accent: 'gold' | 'cyan';
}> = ({ rotationX, tiltY, liftY, isSettled, label, accent }) => {
  const faceHeight = 64;
  const faceWidth = 88;
  // Apothem radius for a 10-sided regular prism: r = (h / 2) / tan(18 deg) ≈ 32 / 0.3249 ≈ 98px
  const radius = 98;

  const heightRatio = Math.min(Math.max(Math.abs(liftY) / 110, 0), 1);
  const shadowScale = 1 - heightRatio * 0.35;

  return (
    <div className="relative flex flex-col items-center select-none">
      <div
        className="relative flex items-center justify-center"
        style={{
          width: '130px',
          height: '150px',
          perspective: '950px',
        }}
      >
        {/* Dynamic Table Shadow */}
        <div
          className="absolute bottom-1 w-24 h-6 rounded-full bg-black/55 pointer-events-none"
          style={{
            transform: `scale(${shadowScale})`,
            filter: `blur(${6 + heightRatio * 6}px)`,
          }}
        />

        {/* 10-Sided 3D Prism */}
        <div
          style={{
            width: `${faceWidth}px`,
            height: `${faceHeight}px`,
            transformStyle: 'preserve-3d',
            transform: `translate3d(0px, ${liftY}px, -20px) rotateY(${tiltY}deg) rotateX(${rotationX}deg)`,
          }}
        >
          {Array.from({ length: 10 }).map((_, digit) => {
            // Face `digit` sits at angle `digit * 36deg` around X axis
            const faceAngle = digit * 36;
            return (
              <div
                key={digit}
                className={`absolute inset-0 rounded-xl border-2 flex items-center justify-center font-black text-3xl sm:text-4xl shadow-inner ${
                  accent === 'gold'
                    ? 'bg-gradient-to-b from-amber-50 via-white to-amber-100 border-amber-400 text-[#0F2D52]'
                    : 'bg-gradient-to-b from-cyan-50 via-white to-sky-100 border-cyan-400 text-[#0F2D52]'
                } ${isSettled ? 'ring-2 ring-yellow-300' : ''}`}
                style={{
                  transform: `rotateX(${faceAngle}deg) translateZ(${radius}px)`,
                  backfaceVisibility: 'hidden',
                }}
              >
                <span className="tabular-nums drop-shadow-2xs">{digit}</span>
              </div>
            );
          })}
        </div>
      </div>

      <span className="mt-2 px-3 py-0.5 rounded-full bg-slate-900/85 border border-sky-400/30 text-[11px] font-extrabold text-amber-300 tracking-wide">
        {label}
      </span>
    </div>
  );
};

export const DiceGame: React.FC<DiceGameProps> = ({
  availableCandidates,
  onPick,
  isMuted,
  allCandidates,
  absentIds = new Set(),
  calledSessionIds = new Set(),
  antiDuplicate = true,
  onToggleAntiDuplicate,
  onResetSession,
  classes = [],
  selectedSourceKey = 'manual',
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  teacherName = 'Giáo viên',
  userRole = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  onToggleMute,
  onOpenAbsentModal,
  onOpenHistoryModal,
  onUpdateLatestNote,
}) => {
  // 3 Modes: Mode 1 (Lucky Dice), Mode 2 (Two-Digit 3D 01-50), Mode 3 (Challenge Dice)
  const [playMode, setPlayMode] = useState<DicePlayMode>('LUCKY_DICE');

  // Strict State Machine: IDLE -> PREPARING -> ROLLING -> BOUNCING -> SETTLING -> REVEALING -> COMPLETED
  const [phase, setPhase] = useState<DiceGamePhase>('IDLE');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // Configurable Roll Duration: 2s, 4s (default), 6s
  const [rollDurationSec, setRollDurationSec] = useState<number>(4);

  // Session & Student Mapping (1..N order numbers)
  const [sessionId, setSessionId] = useState<string>(() => `a09_sess_${Date.now().toString(36)}`);

  // 3D Die 1 & Die 2 Transform State
  const [die1Pose, setDie1Pose] = useState({ rx: -18, ry: 28, rz: 0, liftY: 0, offsetX: 0 });
  const [die2Pose, setDie2Pose] = useState({ rx: 16, ry: -32, rz: 0, liftY: 0, offsetX: 0 });
  const [die1TargetFace, setDie1TargetFace] = useState<number>(6);
  const [die2TargetFace, setDie2TargetFace] = useState<number>(5);

  // Mode 2 (10-Faced 3D Digit Rollers) Transform State
  const [tensRollerAngle, setTensRollerAngle] = useState<number>(0);
  const [unitsRollerAngle, setUnitsRollerAngle] = useState<number>(-36);
  const [rollerLiftY, setRollerLiftY] = useState<number>(0);
  const [tensDigitTarget, setTensDigitTarget] = useState<number>(0);
  const [unitsDigitTarget, setUnitsDigitTarget] = useState<number>(1);

  // Mode 3 (Challenge Dice) State
  const [challengeCategory, setChallengeCategory] = useState<ChallengeCategoryKey>('points');
  const [challengeStudentId, setChallengeStudentId] = useState<string>('');
  const [revealedChallengeFace, setRevealedChallengeFace] = useState<number | null>(null);

  // Picked Student & Order Number Result (Strictly hidden until REVEALING/COMPLETED!)
  const [revealedStudent, setRevealedStudent] = useState<StudentCandidate | null>(null);
  const [revealedOrderNumber, setRevealedOrderNumber] = useState<number | null>(null);
  const [showWinnerBanner, setShowWinnerBanner] = useState<boolean>(false);

  // Independent Answer Timer (15s, 30s default, 60s, Custom)
  const [timerPreset, setTimerPreset] = useState<number>(30);
  const [customTimerInput, setCustomTimerInput] = useState<string>('45');
  const [isCustomTimer, setIsCustomTimer] = useState<boolean>(false);
  const [timerRemaining, setTimerRemaining] = useState<number>(30);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Bonus Points & Note + Supabase Sync State
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [roundNote, setRoundNote] = useState<string>('');
  const [supabaseSyncState, setSupabaseSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string | null>(null);

  // Animation RAF & Pause/Resume Tracking Refs
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const animSpecRef = useRef<{
    startTime: number;
    elapsedBeforePause: number;
    totalDurationMs: number;
    modeUsed: DicePlayMode;
    chosenStudent: StudentCandidate;
    chosenOrderNumber: number;
    face1: number;
    face2: number;
    tensDigit: number;
    unitsDigit: number;
    startPose1: { rx: number; ry: number; rz: number };
    targetPose1: { rx: number; ry: number; rz: number };
    startPose2: { rx: number; ry: number; rz: number };
    targetPose2: { rx: number; ry: number; rz: number };
    startTensAngle: number;
    targetTensAngle: number;
    startUnitsAngle: number;
    targetUnitsAngle: number;
    lastSoundStep: number;
    bouncePlayed: [boolean, boolean, boolean];
  } | null>(null);

  const savedTurnIdsRef = useRef<Set<string>>(new Set());
  const currentTurnIdRef = useRef<string | null>(null);

  const stopAnimations = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAnimations();
    };
  }, [stopAnimations]);

  // All present students in the class with stable 1-based order number (01..N)
  const numberedPresentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base
      .filter((st) => !absentIds.has(st.id))
      .map((student, idx) => ({
        student,
        orderNumber: idx + 1,
      }));
  }, [allCandidates, availableCandidates, absentIds]);

  // Eligible students for Mode 1 & Mode 2 (respects antiDuplicate)
  const eligibleNumberedStudents = useMemo(() => {
    if (!antiDuplicate) return numberedPresentStudents;
    return numberedPresentStudents.filter((item) => !calledSessionIds.has(item.student.id));
  }, [numberedPresentStudents, antiDuplicate, calledSessionIds]);

  // Keep default challengeStudentId valid for Mode 3
  useEffect(() => {
    if (numberedPresentStudents.length > 0 && !challengeStudentId) {
      setChallengeStudentId(numberedPresentStudents[0].student.id);
    }
  }, [numberedPresentStudents, challengeStudentId]);

  // Reset stage when class changes
  useEffect(() => {
    stopAnimations();
    setPhase('IDLE');
    setIsPaused(false);
    setRevealedStudent(null);
    setRevealedOrderNumber(null);
    setRevealedChallengeFace(null);
    setShowWinnerBanner(false);
    setSupabaseSyncState('idle');
    setSupabaseErrorMsg(null);
  }, [selectedSourceKey, stopAnimations]);

  // Independent Answer Countdown Timer
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          diceSound.playTimerBell(isMuted);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, isMuted]);

  // Sync turn result to Supabase public.audit_logs (with duplicate guard & safe retry)
  const syncTurnToSupabase = useCallback(
    async (
      student: StudentCandidate,
      orderNum: number,
      points: number,
      noteText: string,
      mode: DicePlayMode,
      forceRetry = false
    ) => {
      const turnId = currentTurnIdRef.current || `turn_${sessionId}_${student.id}_${orderNum}`;
      const dedupeKey = `${turnId}_${points}_${noteText}`;
      if (!forceRetry && savedTurnIdsRef.current.has(dedupeKey)) {
        return;
      }

      if (!isSupabaseConfigured) {
        setSupabaseSyncState('saved');
        return;
      }

      setSupabaseSyncState('saving');
      setSupabaseErrorMsg(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData?.session?.user;
        if (!authUser) {
          savedTurnIdsRef.current.add(dedupeKey);
          setSupabaseSyncState('saved');
          return;
        }

        const formattedOrder = String(orderNum).padStart(2, '0');
        const detailsText = [
          `Trò chơi: A09 - Xúc xắc chọn tên 3D`,
          `Lớp: ${resolvedClassName}`,
          `Số thứ tự: #${formattedOrder}`,
          `HS: ${student.fullName} (${student.code})`,
          `Chế độ: ${mode}`,
          points > 0 ? `Điểm thưởng: +${points}đ` : '',
          noteText.trim() ? `Ghi chú: ${noteText.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const { error } = await supabase.from('audit_logs').insert({
          actor_name: teacherName || 'Giáo viên',
          role: userRole || 'teacher',
          action: 'EDU_GAME_A09_DICE_PICK',
          target: `A09 (${resolvedClassName}) - #${formattedOrder} ${student.fullName}`,
          details: detailsText,
          actor_id: authUser.id,
          metadata: {
            gameCode: 'A09',
            gameTitle: 'Xúc xắc chọn tên 3D',
            sessionId,
            classId: selectedSourceKey,
            className: resolvedClassName,
            studentId: student.id,
            studentCode: student.code,
            studentName: student.fullName,
            selectedOrderNumber: orderNum,
            playMode: mode,
            bonusPoints: points,
            note: noteText.trim(),
            timestamp: new Date().toISOString(),
          },
        });

        if (error) throw error;

        savedTurnIdsRef.current.add(dedupeKey);
        setSupabaseSyncState('saved');
      } catch (err: any) {
        console.warn('A09 Supabase sync warning:', err);
        setSupabaseSyncState('error');
        setSupabaseErrorMsg(
          err?.message || 'Chưa đồng bộ được lên đám mây Supabase. Lịch sử tại máy vẫn được giữ an toàn.'
        );
      }
    },
    [resolvedClassName, selectedSourceKey, sessionId, teacherName, userRole]
  );

  // Core Frame-by-Frame 3D Physics & Quaternion/Euler Interpolation Loop
  const runAnimationLoop = useCallback(() => {
    const stepFrame = (now: number) => {
      const spec = animSpecRef.current;
      if (!spec) return;

      const elapsed = spec.elapsedBeforePause + (now - spec.startTime);
      const rawProgress = Math.min(Math.max(elapsed / spec.totalDurationMs, 0), 1);

      // Update State Machine Phase according to timeline progress:
      // 0.00 -> 0.14: PREPARING (Lifting off table)
      // 0.14 -> 0.56: ROLLING (High-speed multi-axis rotation in air)
      // 0.56 -> 0.82: BOUNCING (Impacting table and bouncing with decay)
      // 0.82 -> 1.00: SETTLING (Decelerating smoothly into exact target face)
      if (rawProgress < 0.14) {
        setPhase((p) => (p !== 'PREPARING' ? 'PREPARING' : p));
      } else if (rawProgress < 0.56) {
        setPhase((p) => (p !== 'ROLLING' ? 'ROLLING' : p));
      } else if (rawProgress < 0.82) {
        setPhase((p) => (p !== 'BOUNCING' ? 'BOUNCING' : p));
      } else if (rawProgress < 1.0) {
        setPhase((p) => (p !== 'SETTLING' ? 'SETTLING' : p));
      }

      // Smooth ease-out curve for rotation convergence: 1 - (1 - t)^3.5
      const easeOut = 1 - Math.pow(1 - rawProgress, 3.5);

      // Vertical Lift & Table Bounce Curve (liftY <= 0)
      let liftY = 0;
      let lateralWave = 0;
      if (!reduceMotion) {
        if (rawProgress < 0.56) {
          // Parabolic arc in the air
          const airT = rawProgress / 0.56;
          liftY = -Math.sin(airT * Math.PI) * 105;
          lateralWave = Math.sin(airT * Math.PI * 3) * 18;
        } else if (rawProgress < 0.84) {
          // 2 physical bounces with decaying amplitude
          const bounceT = (rawProgress - 0.56) / 0.28;
          const decay = Math.pow(1 - bounceT, 1.8);
          liftY = -Math.abs(Math.sin(bounceT * Math.PI * 2.5)) * 42 * decay;
          lateralWave = Math.sin(bounceT * Math.PI * 2) * 6 * decay;
        } else {
          liftY = 0;
          lateralWave = 0;
        }
      }

      // Sound effects triggered at physical milestones
      const soundTickIndex = Math.floor(rawProgress * 12);
      if (soundTickIndex > spec.lastSoundStep && rawProgress < 0.54) {
        spec.lastSoundStep = soundTickIndex;
        diceSound.playDiceShake(isMuted);
      }
      if (rawProgress >= 0.56 && !spec.bouncePlayed[0]) {
        spec.bouncePlayed[0] = true;
        diceSound.playTableBounce(isMuted, 1.0);
      }
      if (rawProgress >= 0.69 && !spec.bouncePlayed[1]) {
        spec.bouncePlayed[1] = true;
        diceSound.playTableBounce(isMuted, 0.65);
      }
      if (rawProgress >= 0.82 && !spec.bouncePlayed[2]) {
        spec.bouncePlayed[2] = true;
        diceSound.playTableBounce(isMuted, 0.35);
      }

      // Interpolate 3D Rotations toward exact target face angles
      const rx1 = spec.startPose1.rx + (spec.targetPose1.rx - spec.startPose1.rx) * easeOut;
      const ry1 = spec.startPose1.ry + (spec.targetPose1.ry - spec.startPose1.ry) * easeOut;
      const rz1 = spec.startPose1.rz + (spec.targetPose1.rz - spec.startPose1.rz) * easeOut;

      const rx2 = spec.startPose2.rx + (spec.targetPose2.rx - spec.startPose2.rx) * easeOut;
      const ry2 = spec.startPose2.ry + (spec.targetPose2.ry - spec.startPose2.ry) * easeOut;
      const rz2 = spec.startPose2.rz + (spec.targetPose2.rz - spec.startPose2.rz) * easeOut;

      setDie1Pose({
        rx: rx1,
        ry: ry1,
        rz: rz1,
        liftY,
        offsetX: -lateralWave,
      });

      setDie2Pose({
        rx: rx2,
        ry: ry2,
        rz: rz2,
        liftY: liftY * 0.92,
        offsetX: lateralWave,
      });

      // Interpolate 10-sided 3D Digit Rollers for Mode 2
      const tensAngle =
        spec.startTensAngle + (spec.targetTensAngle - spec.startTensAngle) * easeOut;
      const unitsAngle =
        spec.startUnitsAngle + (spec.targetUnitsAngle - spec.startUnitsAngle) * easeOut;
      setTensRollerAngle(tensAngle);
      setUnitsRollerAngle(unitsAngle);
      setRollerLiftY(liftY * 0.65);

      if (rawProgress < 1.0) {
        rafRef.current = requestAnimationFrame(stepFrame);
      } else {
        // Animation settled exactly on target faces!
        rafRef.current = null;
        setPhase('REVEALING');
        setRevealedStudent(spec.chosenStudent);
        setRevealedOrderNumber(spec.chosenOrderNumber);
        setChallengeStudentId(spec.chosenStudent.id);
        if (spec.modeUsed === 'CHALLENGE_DICE') {
          setRevealedChallengeFace(spec.face1);
        } else {
          setRevealedChallengeFace(null);
        }
        setShowWinnerBanner(true);
        setBonusPoints(0);
        setRoundNote('');
        setTimerRunning(false);
        setTimerRemaining(timerPreset);
        diceSound.playRevealFanfare(isMuted);

        timeoutRef.current = window.setTimeout(() => {
          setPhase('COMPLETED');
          const turnId = `turn_${sessionId}_${Date.now()}_${spec.chosenStudent.id}`;
          currentTurnIdRef.current = turnId;

          if (spec.modeUsed !== 'CHALLENGE_DICE') {
            if (!savedTurnIdsRef.current.has(turnId)) {
              savedTurnIdsRef.current.add(turnId);
              onPick(spec.chosenStudent, {
                bonusPoints: 0,
                note: '',
                sessionId,
                orderNumber: spec.chosenOrderNumber,
              });
              syncTurnToSupabase(
                spec.chosenStudent,
                spec.chosenOrderNumber,
                0,
                '',
                spec.modeUsed
              );
            }
          } else {
            // In Mode 3 (Challenge Dice), record challenge note without altering academic gradebook
            const preset = CHALLENGE_PRESETS[challengeCategory];
            const faceInfo = preset.faces[spec.face1];
            const challengeNote = `Thử thách xúc xắc mặt ${spec.face1}: ${faceInfo?.title || ''}`;
            setRoundNote(challengeNote);
            syncTurnToSupabase(
              spec.chosenStudent,
              spec.chosenOrderNumber,
              0,
              challengeNote,
              'CHALLENGE_DICE'
            );
          }
        }, 280);
      }
    };

    rafRef.current = requestAnimationFrame(stepFrame);
  }, [challengeCategory, isMuted, onPick, reduceMotion, sessionId, syncTurnToSupabase, timerPreset]);

  // Start Rolling the 3D Dice
  const startRollDice = () => {
    if (
      phase === 'PREPARING' ||
      phase === 'ROLLING' ||
      phase === 'BOUNCING' ||
      phase === 'SETTLING' ||
      phase === 'REVEALING'
    ) {
      return;
    }

    stopAnimations();
    setIsPaused(false);
    setShowWinnerBanner(false);
    setRevealedStudent(null);
    setRevealedOrderNumber(null);
    setRevealedChallengeFace(null);

    // 1. Fair Pre-Selection of Student & Target Faces
    let chosenItem: { student: StudentCandidate; orderNumber: number } | null = null;

    if (playMode === 'CHALLENGE_DICE') {
      if (numberedPresentStudents.length === 0) return;
      chosenItem =
        numberedPresentStudents.find((item) => item.student.id === challengeStudentId) ||
        numberedPresentStudents[0];
    } else {
      if (eligibleNumberedStudents.length === 0) return;
      // Uniform 1/N selection using cryptographic rejection sampling
      const randomIndex = secureRandomInt(eligibleNumberedStudents.length);
      chosenItem = eligibleNumberedStudents[randomIndex];
    }

    if (!chosenItem) return;

    // 2. Determine 3D Dice Faces / 3D Digit Roller Targets
    const f1 = secureRandomInt(6) + 1; // 1..6
    const f2 = secureRandomInt(6) + 1; // 1..6
    setDie1TargetFace(f1);
    setDie2TargetFace(f2);

    const orderNum = chosenItem.orderNumber;
    const tens = Math.floor(orderNum / 10) % 10;
    const units = orderNum % 10;
    setTensDigitTarget(tens);
    setUnitsDigitTarget(units);

    // Calculate multi-turn target Euler angles so the cubes land on exact faces f1 and f2
    const base1 = getBaseAnglesForFace(f1);
    const base2 = getBaseAnglesForFace(f2);
    const turns = reduceMotion ? 1 : rollDurationSec >= 6 ? 5 : rollDurationSec >= 4 ? 4 : 3;

    // Align target angles to next multiple of 360 + base angle
    const currentNormRx1 = die1Pose.rx - (die1Pose.rx % 360);
    const currentNormRy1 = die1Pose.ry - (die1Pose.ry % 360);
    const currentNormRz1 = die1Pose.rz - (die1Pose.rz % 360);

    const currentNormRx2 = die2Pose.rx - (die2Pose.rx % 360);
    const currentNormRy2 = die2Pose.ry - (die2Pose.ry % 360);
    const currentNormRz2 = die2Pose.rz - (die2Pose.rz % 360);

    const targetPose1 = {
      rx: currentNormRx1 + 360 * turns + base1.rx,
      ry: currentNormRy1 + 360 * turns + base1.ry,
      rz: currentNormRz1 + 360 * (turns - 1) + base1.rz,
    };

    const targetPose2 = {
      rx: currentNormRx2 - 360 * turns + base2.rx,
      ry: currentNormRy2 + 360 * (turns + 1) + base2.ry,
      rz: currentNormRz2 + 360 * (turns - 1) + base2.rz,
    };

    // For Mode 2 (10-faced 3D Digit Rollers): face `d` is brought to front by `rotateX(-d * 36deg)`
    const baseTensNorm = tensRollerAngle - (tensRollerAngle % 360);
    const baseUnitsNorm = unitsRollerAngle - (unitsRollerAngle % 360);
    const targetTensAngle = baseTensNorm - 360 * turns - tens * 36;
    const targetUnitsAngle = baseUnitsNorm - 360 * (turns + 1) - units * 36;

    animSpecRef.current = {
      startTime: performance.now(),
      elapsedBeforePause: 0,
      totalDurationMs: (reduceMotion ? 1.2 : rollDurationSec) * 1000,
      modeUsed: playMode,
      chosenStudent: chosenItem.student,
      chosenOrderNumber: orderNum,
      face1: f1,
      face2: f2,
      tensDigit: tens,
      unitsDigit: units,
      startPose1: { rx: die1Pose.rx, ry: die1Pose.ry, rz: die1Pose.rz },
      targetPose1,
      startPose2: { rx: die2Pose.rx, ry: die2Pose.ry, rz: die2Pose.rz },
      targetPose2,
      startTensAngle: tensRollerAngle,
      targetTensAngle,
      startUnitsAngle: unitsRollerAngle,
      targetUnitsAngle,
      lastSoundStep: -1,
      bouncePlayed: [false, false, false],
    };

    setPhase('PREPARING');
    runAnimationLoop();
  };

  // Pause / Resume Roll Animation
  const handleTogglePauseRoll = () => {
    const spec = animSpecRef.current;
    if (!spec) return;

    if (!isPaused) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      spec.elapsedBeforePause += performance.now() - spec.startTime;
      setIsPaused(true);
    } else {
      spec.startTime = performance.now();
      setIsPaused(false);
      runAnimationLoop();
    }
  };

  // Safe Emergency Recovery if animation ever needs manual completion
  const handleSafeRecover = () => {
    const spec = animSpecRef.current;
    stopAnimations();
    setIsPaused(false);
    if (spec) {
      setDie1Pose({ ...spec.targetPose1, liftY: 0, offsetX: 0 });
      setDie2Pose({ ...spec.targetPose2, liftY: 0, offsetX: 0 });
      setTensRollerAngle(spec.targetTensAngle);
      setUnitsRollerAngle(spec.targetUnitsAngle);
      setRollerLiftY(0);
      setRevealedStudent(spec.chosenStudent);
      setRevealedOrderNumber(spec.chosenOrderNumber);
      setShowWinnerBanner(true);
      setPhase('COMPLETED');
    } else {
      setPhase('IDLE');
    }
  };

  // Reset Full Session
  const handleRefreshSession = () => {
    stopAnimations();
    savedTurnIdsRef.current.clear();
    currentTurnIdRef.current = null;
    animSpecRef.current = null;
    setSessionId(`a09_sess_${Date.now().toString(36)}`);
    setIsPaused(false);
    setPhase('IDLE');
    setRevealedStudent(null);
    setRevealedOrderNumber(null);
    setRevealedChallengeFace(null);
    setShowWinnerBanner(false);
    setBonusPoints(0);
    setRoundNote('');
    onResetSession?.();
  };

  // Save Bonus Points & Note
  const handleSaveScoreAndNote = () => {
    if (!revealedStudent || !revealedOrderNumber) return;
    const combined = [
      `#${String(revealedOrderNumber).padStart(2, '0')}`,
      bonusPoints > 0 ? `+${bonusPoints} điểm thưởng` : '',
      roundNote.trim(),
    ]
      .filter(Boolean)
      .join(' - ');

    onUpdateLatestNote?.(combined);
    syncTurnToSupabase(
      revealedStudent,
      revealedOrderNumber,
      bonusPoints,
      roundNote,
      playMode,
      true
    );
  };

  const isRollingActive =
    phase === 'PREPARING' ||
    phase === 'ROLLING' ||
    phase === 'BOUNCING' ||
    phase === 'SETTLING' ||
    phase === 'REVEALING';

  const isSettledOrCompleted = phase === 'REVEALING' || phase === 'COMPLETED';
  const allCalled =
    playMode !== 'CHALLENGE_DICE' &&
    numberedPresentStudents.length > 0 &&
    eligibleNumberedStudents.length === 0;

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* ===================================================================
          LEFT COLUMN (70-75% on Desktop): 3D GAME SHOW DICE STAGE
         =================================================================== */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between space-y-4">
        <div
          className={`relative w-full ${
            isFullscreen ? 'min-h-[75vh]' : 'min-h-[500px] sm:min-h-[560px]'
          } rounded-3xl border-4 border-sky-400/70 shadow-2xl overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#0B2545] via-[#133B6E] to-[#081A33]`}
        >
          {/* 1. 3D GAME SHOW LIGHTING & FELT TABLE SURFACE */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Top Blue, Purple & Gold Stage Spotlights */}
            <div className="absolute -top-24 left-1/4 w-96 h-64 bg-sky-400/25 rounded-full blur-3xl" />
            <div className="absolute -top-24 right-1/4 w-96 h-64 bg-purple-500/25 rounded-full blur-3xl" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[540px] h-[280px] bg-amber-300/15 rounded-full blur-3xl" />

            {/* 3D Perspective Navy Table Arena Ring */}
            <div
              className="absolute inset-x-6 sm:inset-x-12 top-24 bottom-14 rounded-[48px] border-4 border-cyan-300/45 bg-gradient-to-b from-[#16427C]/80 via-[#0F2E5A]/90 to-[#091D3A]/95 shadow-[0_0_50px_rgba(56,189,248,0.22),inset_0_0_40px_rgba(0,0,0,0.55)]"
              style={{
                transform: 'perspective(900px) rotateX(14deg)',
              }}
            >
              {/* Inner Golden Rim Line on Table */}
              <div className="absolute inset-3 rounded-[38px] border-2 border-dashed border-amber-300/35" />
            </div>
          </div>

          {/* 2. TOP STAGE HEADER: 3 Mode Tabs & Roll Speed Selector */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2 sm:px-6">
            {/* 3 Play Modes Switcher */}
            <div className="bg-slate-950/80 backdrop-blur-xs p-1 rounded-2xl border border-sky-400/35 flex flex-wrap items-center gap-1 shadow-lg">
              <button
                type="button"
                disabled={isRollingActive}
                onClick={() => {
                  setPlayMode('LUCKY_DICE');
                  setShowWinnerBanner(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  playMode === 'LUCKY_DICE'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-xs'
                    : 'text-sky-100 hover:bg-white/10'
                }`}
              >
                <Dices className="w-3.5 h-3.5" />
                <span>1. Xúc xắc may mắn</span>
              </button>

              <button
                type="button"
                disabled={isRollingActive}
                onClick={() => {
                  setPlayMode('TWO_DIGIT_3D');
                  setShowWinnerBanner(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  playMode === 'TWO_DIGIT_3D'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-xs'
                    : 'text-sky-100 hover:bg-white/10'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                <span>2. Khối số 3D (01–50)</span>
              </button>

              <button
                type="button"
                disabled={isRollingActive}
                onClick={() => {
                  setPlayMode('CHALLENGE_DICE');
                  setShowWinnerBanner(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  playMode === 'CHALLENGE_DICE'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-xs'
                    : 'text-sky-100 hover:bg-white/10'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>3. Xúc xắc thử thách</span>
              </button>
            </div>

            {/* Roll Duration Selector (2s, 4s default, 6s) */}
            <div className="flex items-center gap-1.5 bg-slate-950/75 backdrop-blur-xs px-3 py-1.5 rounded-2xl border border-sky-400/30 text-xs">
              <span className="text-sky-200 font-bold">Thời gian lăn:</span>
              {[2, 4, 6].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={isRollingActive}
                  onClick={() => setRollDurationSec(sec)}
                  className={`px-2 py-0.5 rounded-lg font-extrabold transition-all cursor-pointer ${
                    rollDurationSec === sec
                      ? 'bg-sky-500 text-white shadow-2xs'
                      : 'text-sky-200/80 hover:bg-white/10'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* 3. DIGITAL SCOREBOARD DISPLAY (Distinguishes 1-6 Dice Faces vs 01-50 Student Order Number) */}
          <div className="relative z-20 px-4 sm:px-8 flex flex-wrap items-center justify-center gap-3">
            {playMode === 'LUCKY_DICE' && (
              <div className="bg-slate-950/85 backdrop-blur-md border-2 border-amber-400/60 rounded-2xl px-5 py-2.5 shadow-xl flex flex-wrap items-center justify-center gap-5 text-white">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                    Mặt xúc xắc 3D (1–6):
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/10 font-black text-amber-300 text-sm tabular-nums">
                    {isSettledOrCompleted
                      ? `${die1TargetFace} + ${die2TargetFace} = ${die1TargetFace + die2TargetFace} điểm lộc`
                      : 'Đang lăn...'}
                  </span>
                </div>
                <div className="h-4 w-px bg-white/20 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                    Mã số thứ tự HS (1/{eligibleNumberedStudents.length || numberedPresentStudents.length}):
                  </span>
                  <span className="px-3 py-0.5 rounded-lg bg-emerald-500/25 border border-emerald-400/50 font-black text-white text-base tabular-nums">
                    {isSettledOrCompleted && revealedOrderNumber
                      ? `#${String(revealedOrderNumber).padStart(2, '0')}`
                      : '??'}
                  </span>
                </div>
              </div>
            )}

            {playMode === 'TWO_DIGIT_3D' && (
              <div className="bg-slate-950/85 backdrop-blur-md border-2 border-cyan-400/60 rounded-2xl px-5 py-2.5 shadow-xl flex flex-wrap items-center justify-center gap-4 text-white">
                <span className="text-xs font-bold text-cyan-200">
                  Bộ Khối Lăng Trụ Số 3D Mười Mặt (0–9): Biểu diễn chính xác số thứ tự 01 –{' '}
                  {String(numberedPresentStudents.length).padStart(2, '0')}
                </span>
                <span className="px-3 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black text-base tabular-nums">
                  {isSettledOrCompleted && revealedOrderNumber
                    ? `SỐ #${String(revealedOrderNumber).padStart(2, '0')}`
                    : 'SỐ #??'}
                </span>
              </div>
            )}

            {playMode === 'CHALLENGE_DICE' && (
              <div className="bg-slate-950/85 backdrop-blur-md border-2 border-purple-400/60 rounded-2xl px-4 py-2 shadow-xl flex flex-wrap items-center justify-center gap-3 text-white">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-200">Học sinh nhận thử thách:</span>
                  <select
                    value={challengeStudentId}
                    disabled={isRollingActive}
                    onChange={(e) => setChallengeStudentId(e.target.value)}
                    className="bg-slate-900 border border-purple-400/50 rounded-xl px-2.5 py-1 text-xs font-extrabold text-amber-300 focus:outline-none"
                  >
                    {numberedPresentStudents.map((item) => (
                      <option key={item.student.id} value={item.student.id}>
                        #{String(item.orderNumber).padStart(2, '0')} - {item.student.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-200">Loại thử thách:</span>
                  <select
                    value={challengeCategory}
                    disabled={isRollingActive}
                    onChange={(e) => setChallengeCategory(e.target.value as ChallengeCategoryKey)}
                    className="bg-slate-900 border border-purple-400/50 rounded-xl px-2.5 py-1 text-xs font-extrabold text-sky-300 focus:outline-none"
                  >
                    {Object.values(CHALLENGE_PRESETS).map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 4. CENTER 3D DICE / 3D DIGIT ROLLERS ARENA */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-4">
            {numberedPresentStudents.length === 0 ? (
              <div className="bg-white/95 rounded-3xl p-8 text-center max-w-md shadow-2xl space-y-3">
                <Users className="w-12 h-12 text-sky-600 mx-auto" />
                <h3 className="text-lg font-black text-[#0F2D52]">Chưa có học sinh có mặt</h3>
                <p className="text-xs text-slate-600">
                  Vui lòng kiểm tra lại lớp học hoặc danh sách vắng mặt.
                </p>
              </div>
            ) : allCalled && !isRollingActive && !showWinnerBanner ? (
              <div className="bg-white/95 rounded-3xl p-8 text-center max-w-lg shadow-2xl border-4 border-amber-400 space-y-4 animate-fadeIn">
                <Trophy className="w-14 h-14 text-amber-500 mx-auto" />
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase">
                  HOÀN THÀNH PHIÊN GỌI
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#0F2D52]">
                  ĐÃ GỌI HẾT LỚP ({numberedPresentStudents.length} HỌC SINH)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Tất cả học sinh hợp lệ trong lớp đã được gọi trong phiên này. Nhấn Làm mới phiên để tung lượt mới!
                </p>
                <button
                  type="button"
                  onClick={handleRefreshSession}
                  className="px-6 py-3 bg-[#006BFF] hover:bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>LÀM MỚI PHIÊN XÚC XẮC</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-5 my-auto">
                {/* Render 3D Objects according to Play Mode */}
                {playMode === 'LUCKY_DICE' && (
                  <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14">
                    <True3DSixSidedDie
                      rx={die1Pose.rx}
                      ry={die1Pose.ry}
                      rz={die1Pose.rz}
                      liftY={die1Pose.liftY}
                      offsetX={die1Pose.offsetX}
                      isSettled={isSettledOrCompleted}
                      label="Xúc xắc 3D #1 (Đối diện = 7)"
                      accentColor="gold"
                    />
                    <True3DSixSidedDie
                      rx={die2Pose.rx}
                      ry={die2Pose.ry}
                      rz={die2Pose.rz}
                      liftY={die2Pose.liftY}
                      offsetX={die2Pose.offsetX}
                      isSettled={isSettledOrCompleted}
                      label="Xúc xắc 3D #2 (Đối diện = 7)"
                      accentColor="cyan"
                    />
                  </div>
                )}

                {playMode === 'TWO_DIGIT_3D' && (
                  <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
                    <Decagonal3DDigitRoller
                      rotationX={tensRollerAngle}
                      tiltY={12}
                      liftY={rollerLiftY}
                      isSettled={isSettledOrCompleted}
                      label="Khối 3D 10 mặt · Hàng chục"
                      accent="gold"
                    />
                    <Decagonal3DDigitRoller
                      rotationX={unitsRollerAngle}
                      tiltY={-12}
                      liftY={rollerLiftY}
                      isSettled={isSettledOrCompleted}
                      label="Khối 3D 10 mặt · Hàng đơn vị"
                      accent="cyan"
                    />
                  </div>
                )}

                {playMode === 'CHALLENGE_DICE' && (
                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 max-w-3xl">
                    <True3DSixSidedDie
                      rx={die1Pose.rx}
                      ry={die1Pose.ry}
                      rz={die1Pose.rz}
                      liftY={die1Pose.liftY}
                      offsetX={die1Pose.offsetX}
                      isSettled={isSettledOrCompleted}
                      label="Xúc xắc Thử thách 3D (1–6)"
                      accentColor="gold"
                    />

                    {/* 6 Challenge Faces Reference Board */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-950/75 backdrop-blur-xs p-3 rounded-2xl border border-sky-400/30">
                      {[1, 2, 3, 4, 5, 6].map((faceNum) => {
                        const info = CHALLENGE_PRESETS[challengeCategory].faces[faceNum];
                        const isHit = isSettledOrCompleted && revealedChallengeFace === faceNum;
                        return (
                          <div
                            key={faceNum}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              isHit
                                ? 'bg-amber-400 text-slate-950 border-white ring-4 ring-amber-300 scale-105 shadow-lg'
                                : 'bg-white/10 text-white border-white/15'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black">Mặt {faceNum} chấm</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white ${info.color}`}
                              >
                                {info.badge}
                              </span>
                            </div>
                            <p
                              className={`text-[11px] font-bold mt-1 leading-snug ${
                                isHit ? 'text-slate-900' : 'text-sky-100'
                              }`}
                            >
                              {info.title}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inline Celebration Banner once dice have completely stopped */}
                {showWinnerBanner && revealedStudent && isSettledOrCompleted && (
                  <div className="w-full max-w-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-slate-950 rounded-3xl p-4 sm:p-5 border-4 border-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                    <div className="flex items-center gap-3.5 text-center sm:text-left">
                      <div className="w-14 h-14 rounded-2xl bg-slate-950 text-amber-300 flex flex-col items-center justify-center shrink-0 shadow-md border-2 border-amber-400">
                        <span className="text-[10px] font-bold uppercase">Số TT</span>
                        <span className="text-lg font-black tabular-nums">
                          #{String(revealedOrderNumber || 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-rose-700 flex items-center justify-center sm:justify-start gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {playMode === 'CHALLENGE_DICE' && revealedChallengeFace
                              ? `MẶT ${revealedChallengeFace} CHẤM · ${
                                  CHALLENGE_PRESETS[challengeCategory].faces[revealedChallengeFace]?.badge
                                }`
                              : 'HỌC SINH MAY MẮN ĐƯỢC CHỌN'}
                          </span>
                        </div>
                        <h3 className="text-xl sm:text-3xl font-black text-[#0F2D52] leading-tight">
                          {revealedStudent.fullName}
                        </h3>
                        <p className="text-xs font-extrabold text-slate-700 mt-0.5">
                          {playMode === 'CHALLENGE_DICE' && revealedChallengeFace
                            ? CHALLENGE_PRESETS[challengeCategory].faces[revealedChallengeFace]?.title
                            : `Mã HS: ${revealedStudent.code} · Lớp: ${resolvedClassName}`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={allCalled}
                      onClick={startRollDice}
                      className="px-5 py-3 bg-slate-950 hover:bg-slate-800 text-amber-300 rounded-2xl text-xs sm:text-sm font-black shadow-lg shrink-0 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Dices className="w-4 h-4" />
                      <span>TUNG TIẾP ➔</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. BOTTOM STAGE STATUS BAR */}
          <div className="relative z-20 px-4 py-3 sm:px-6 bg-slate-950/75 backdrop-blur-xs border-t border-sky-400/25 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200">
            <div className="flex items-center gap-2 font-bold">
              <span>Trạng thái:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-amber-300 font-extrabold">
                {phase}
                {isPaused ? ' (ĐANG TẠM DỪNG)' : ''}
              </span>
            </div>

            <div className="flex items-center gap-3 font-bold tabular-nums">
              <span>
                Hợp lệ còn lại:{' '}
                <strong className="text-emerald-300">{eligibleNumberedStudents.length}</strong> /{' '}
                {numberedPresentStudents.length} học sinh
              </span>
              {isRollingActive && (
                <button
                  type="button"
                  onClick={handleSafeRecover}
                  className="text-[11px] text-amber-300 underline hover:text-amber-200"
                >
                  Bỏ qua hoạt ảnh
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PRIMARY STAGE CONTROL BAR RIGHT BENEATH THE 3D DICE TABLE */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <button
            type="button"
            disabled={(isRollingActive && !isPaused) || allCalled || numberedPresentStudents.length === 0}
            onClick={startRollDice}
            className="sm:col-span-6 py-4 px-6 bg-gradient-to-r from-amber-500 via-blue-600 to-indigo-700 hover:opacity-95 text-white rounded-2xl text-base sm:text-lg font-black shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
          >
            <Dices className={`w-6 h-6 ${isRollingActive && !isPaused ? 'animate-spin' : ''}`} />
            <span>
              {allCalled
                ? 'ĐÃ GỌI HẾT LỚP'
                : isRollingActive
                ? '🎲 XÚC XẮC 3D ĐANG LĂN...'
                : phase === 'COMPLETED' || revealedStudent
                ? '🎲 TUNG TIẾP ➔'
                : '🎲 TUNG XÚC XẮC 3D ➔'}
            </span>
          </button>

          {/* PAUSE / RESUME BUTTON DURING ROLL */}
          <button
            type="button"
            disabled={!isRollingActive}
            onClick={handleTogglePauseRoll}
            className="sm:col-span-3 py-4 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-2xl text-xs sm:text-sm font-extrabold shadow-xs transition-all disabled:opacity-45 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4 fill-current text-emerald-600" />
                <span>TIẾP TỤC LĂN</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 text-amber-700" />
                <span>TẠM DỪNG</span>
              </>
            )}
          </button>

          {/* REFRESH SESSION BUTTON */}
          <button
            type="button"
            disabled={isRollingActive && !isPaused}
            onClick={handleRefreshSession}
            className="sm:col-span-3 py-4 px-4 bg-white hover:bg-slate-50 text-[#0F2D52] border-2 border-slate-200 rounded-2xl text-xs sm:text-sm font-extrabold shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#006BFF]" />
            <span>LÀM MỚI PHIÊN</span>
          </button>
        </div>
      </div>

      {/* ===================================================================
          RIGHT COLUMN (25-30% on Desktop): RESULTS, TIMER, BONUS & CONTROLS
         =================================================================== */}
      <div className="lg:col-span-4 xl:col-span-3 bg-slate-50 rounded-3xl border border-slate-200 p-5 flex flex-col justify-between space-y-5 shadow-xs">
        <div className="space-y-4">
          {/* 1. Class & Session Settings */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Lớp & Phiên xúc xắc
              </span>
              <div className="flex items-center gap-2">
                {onOpenAbsentModal && (
                  <button
                    type="button"
                    onClick={onOpenAbsentModal}
                    className="text-[11px] font-extrabold text-[#006BFF] hover:underline"
                  >
                    Vắng ({absentIds.size})
                  </button>
                )}
                {onOpenHistoryModal && (
                  <button
                    type="button"
                    onClick={onOpenHistoryModal}
                    className="text-[11px] font-extrabold text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    <History className="w-3 h-3" /> Lịch sử
                  </button>
                )}
              </div>
            </div>

            {onSelectSourceKey && classes.length > 0 && (
              <select
                value={selectedSourceKey}
                disabled={isRollingActive}
                onChange={(e) => onSelectSourceKey(e.target.value)}
                className="w-full text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[#0F2D52] focus:outline-none focus:ring-2 focus:ring-[#006BFF]"
              >
                <option value="manual">-- Danh sách tự do --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.students?.length || 0} HS)
                  </option>
                ))}
              </select>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isRollingActive}
                onClick={onToggleAntiDuplicate}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold border flex items-center justify-between transition-all ${
                  antiDuplicate
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <span>Chống trùng</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-black shadow-2xs">
                  {antiDuplicate ? 'BẬT' : 'TẮT'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReduceMotion((prev) => !prev)}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold border flex items-center justify-between transition-all ${
                  reduceMotion
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
                title="Giảm hiệu ứng nảy 3D cho máy cấu hình yếu"
              >
                <span className="flex items-center gap-1">
                  <EyeOff className="w-3 h-3" /> Giảm động
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-black shadow-2xs">
                  {reduceMotion ? 'BẬT' : 'TẮT'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              {onToggleMute && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1.5"
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                      <span>Đang tắt âm</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Âm thanh: Bật</span>
                    </>
                  )}
                </button>
              )}

              {onToggleFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{isFullscreen ? 'Thu nhỏ' : 'Full màn hình'}</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Result Panel (Never reveals student identity before dice settle!) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-[#0F2D52] uppercase tracking-wider">
                Kết quả lượt tung
              </h4>
              <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                Đã gọi: {calledSessionIds.size}/{numberedPresentStudents.length}
              </span>
            </div>

            {isRollingActive ? (
              <div className="py-6 px-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center space-y-2 animate-pulse">
                <Dices className="w-8 h-8 text-indigo-600 mx-auto animate-spin" />
                <p className="text-xs font-extrabold text-[#0F2D52]">
                  Xúc xắc 3D đang quay và lăn trên bàn... ({phase})
                </p>
                <p className="text-[11px] text-slate-500">
                  Kết quả sẽ được công bố ngay khi xúc xắc dừng hẳn.
                </p>
              </div>
            ) : revealedStudent && isSettledOrCompleted ? (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      🎲 Số thứ tự #{String(revealedOrderNumber || 1).padStart(2, '0')}
                    </span>
                    {supabaseSyncState === 'saved' && (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Đã lưu
                      </span>
                    )}
                  </div>
                  <h5 className="text-lg font-black text-[#0F2D52] leading-snug">
                    {revealedStudent.fullName}
                  </h5>
                  <p className="text-xs font-bold text-slate-600">Mã HS: {revealedStudent.code}</p>
                </div>

                {/* Bonus Points & Note Controls */}
                <div className="space-y-2 pt-1">
                  <label className="text-[11px] font-extrabold text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-500" /> Điểm thưởng phiên & Ghi chú
                    </span>
                    {bonusPoints > 0 && (
                      <span className="text-emerald-600 font-black">+{bonusPoints}đ</span>
                    )}
                  </label>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 5, 10].map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setBonusPoints((prev) => (prev === pt ? 0 : pt))}
                        className={`py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
                          bonusPoints === pt
                            ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        +{pt}đ
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={roundNote}
                    onChange={(e) => setRoundNote(e.target.value)}
                    placeholder="Ghi chú lượt gọi / thử thách..."
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006BFF]"
                  />

                  <button
                    type="button"
                    onClick={handleSaveScoreAndNote}
                    disabled={supabaseSyncState === 'saving'}
                    className="w-full py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {supabaseSyncState === 'saving' ? 'Đang lưu...' : 'Lưu ghi chú & điểm thưởng'}
                    </span>
                  </button>

                  {supabaseSyncState === 'error' && supabaseErrorMsg && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{supabaseErrorMsg}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          syncTurnToSupabase(
                            revealedStudent,
                            revealedOrderNumber || 1,
                            bonusPoints,
                            roundNote,
                            playMode,
                            true
                          )
                        }
                        className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Thử lưu lại
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 px-3 text-center text-slate-400 space-y-1.5">
                <Layers className="w-9 h-9 mx-auto opacity-35" />
                <p className="text-xs font-bold text-slate-500">Chưa tung xúc xắc</p>
                <p className="text-[11px]">
                  Nhấn nút <strong>TUNG XÚC XẮC 3D</strong> để bắt đầu lượt chọn công bằng.
                </p>
              </div>
            )}
          </div>

          {/* 3. Independent Answer Countdown Timer (15s, 30s default, 60s, Custom) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#0F2D52] flex items-center gap-1.5">
                <TimerIcon className="w-4 h-4 text-amber-500" />
                <span>Đồng hồ trả lời</span>
              </span>
              <span
                className={`text-lg font-black tabular-nums ${
                  timerRemaining === 0
                    ? 'text-rose-600 animate-bounce'
                    : timerRemaining <= 5 && timerRunning
                    ? 'text-amber-600'
                    : 'text-[#006BFF]'
                }`}
              >
                {timerRemaining}s
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[15, 30, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setIsCustomTimer(false);
                    setTimerPreset(sec);
                    setTimerRemaining(sec);
                    setTimerRunning(false);
                  }}
                  className={`py-1.5 rounded-lg text-[11px] font-extrabold border transition-all ${
                    !isCustomTimer && timerPreset === sec
                      ? 'bg-[#006BFF] border-[#006BFF] text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {sec}s
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomTimer((v) => !v)}
                className={`py-1.5 rounded-lg text-[11px] font-extrabold border transition-all ${
                  isCustomTimer
                    ? 'bg-[#006BFF] border-[#006BFF] text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Tùy chỉnh
              </button>
            </div>

            {isCustomTimer && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={customTimerInput}
                  onChange={(e) => setCustomTimerInput(e.target.value)}
                  className="w-20 text-xs font-bold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = Math.min(Math.max(parseInt(customTimerInput, 10) || 30, 5), 600);
                    setTimerPreset(parsed);
                    setTimerRemaining(parsed);
                    setTimerRunning(false);
                  }}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[11px] font-bold"
                >
                  Áp dụng ({customTimerInput || 30}s)
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (timerRemaining === 0) setTimerRemaining(timerPreset);
                  setTimerRunning((r) => !r);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                  timerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {timerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Tạm dừng đếm
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Bắt đầu đếm
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerRemaining(timerPreset);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                title="Đặt lại đồng hồ"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-bold">
          <span>Mã trò chơi: A09</span>
          <span>Xác suất: Đồng đều 1/{eligibleNumberedStudents.length || 1}</span>
        </div>
      </div>
    </div>
  );
};
