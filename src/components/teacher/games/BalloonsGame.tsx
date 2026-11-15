import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Sparkles,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Timer as TimerIcon,
  CheckCircle2,
  AlertCircle,
  Users,
  Hand,
  Wand2,
  Trophy,
  EyeOff,
  Award,
  RefreshCw,
  Pause,
} from 'lucide-react';

export type BalloonGamePhase =
  | 'IDLE'
  | 'SELECTING'
  | 'HIGHLIGHTING'
  | 'POPPING'
  | 'REVEALING'
  | 'COMPLETED';

export type BalloonPlayMode = 'MANUAL' | 'AUTO';

export interface BalloonPalette {
  id: string;
  name: string;
  light: string;
  mid: string;
  dark: string;
  rim: string;
  knot: string;
  glow: string;
  badgeBg: string;
  badgeText: string;
}

export const BALLOON_PALETTES: BalloonPalette[] = [
  {
    id: 'ruby_red',
    name: 'Đỏ Lễ Hội',
    light: '#FF8A8A',
    mid: '#EF4444',
    dark: '#991B1B',
    rim: '#FCA5A5',
    knot: '#B91C1C',
    glow: 'rgba(239, 68, 68, 0.65)',
    badgeBg: 'bg-red-500',
    badgeText: 'text-white',
  },
  {
    id: 'sunshine_gold',
    name: 'Vàng Ánh Kim',
    light: '#FEF08A',
    mid: '#F59E0B',
    dark: '#B45309',
    rim: '#FDE047',
    knot: '#D97706',
    glow: 'rgba(245, 158, 11, 0.7)',
    badgeBg: 'bg-amber-400',
    badgeText: 'text-slate-900',
  },
  {
    id: 'sky_blue',
    name: 'Xanh Bầu Trời',
    light: '#7DD3FC',
    mid: '#0284C7',
    dark: '#075985',
    rim: '#BAE6FD',
    knot: '#0369A1',
    glow: 'rgba(14, 165, 233, 0.65)',
    badgeBg: 'bg-sky-500',
    badgeText: 'text-white',
  },
  {
    id: 'royal_purple',
    name: 'Tím Huyền Diệu',
    light: '#D8B4FE',
    mid: '#9333EA',
    dark: '#581C87',
    rim: '#E9D5FF',
    knot: '#7E22CE',
    glow: 'rgba(168, 85, 247, 0.65)',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
  },
  {
    id: 'candy_pink',
    name: 'Hồng Kẹo Ngọt',
    light: '#F9A8D4',
    mid: '#EC4899',
    dark: '#9D174D',
    rim: '#FBCFE8',
    knot: '#DB2777',
    glow: 'rgba(236, 72, 153, 0.65)',
    badgeBg: 'bg-pink-500',
    badgeText: 'text-white',
  },
  {
    id: 'tangerine_orange',
    name: 'Cam Rực Rỡ',
    light: '#FDBA74',
    mid: '#F97316',
    dark: '#9A3412',
    rim: '#FED7AA',
    knot: '#EA580C',
    glow: 'rgba(249, 115, 22, 0.65)',
    badgeBg: 'bg-orange-500',
    badgeText: 'text-white',
  },
  {
    id: 'emerald_mint',
    name: 'Xanh Ngọc Bích',
    light: '#6EE7B7',
    mid: '#10B981',
    dark: '#065F46',
    rim: '#A7F3D0',
    knot: '#059669',
    glow: 'rgba(16, 185, 129, 0.65)',
    badgeBg: 'bg-emerald-500',
    badgeText: 'text-white',
  },
];

export interface AssignedBalloon {
  balloonId: string;
  displayNumber: number;
  student: StudentCandidate;
  palette: BalloonPalette;
  bobDuration: number;
  bobDelay: number;
}

export interface BalloonsGameProps {
  availableCandidates: StudentCandidate[];
  onPick: (student: StudentCandidate, meta?: { bonusPoints?: number; note?: string; sessionId?: string }) => void;
  isMuted: boolean;
  // Extended props for full carnival control & synchronization
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
  onUpdateLatestNote?: (note: string) => void;
}

/**
 * Unbiased cryptographic random integer in [0, max - 1] using rejection sampling.
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
 * Fisher-Yates unbiased shuffle using secureRandomInt.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Dedicated Web Audio Sound Synthesizer for A08 Balloon Pop Carnival
 */
class BalloonSoundEngine {
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

  playSpotlightTick(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.045);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  playBalloonInflate(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.32);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.34);
    } catch {}
  }

  playBalloonPop(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      // 1. White noise burst for realistic latex rupture
      const bufferSize = Math.floor(ctx.sampleRate * 0.14);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, ctx.currentTime);
      filter.Q.setValueAtTime(0.9, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.42, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.13);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start();

      // 2. Low-mid acoustic pop thump
      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(320, ctx.currentTime);
      thump.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.11);
      thumpGain.gain.setValueAtTime(0.35, ctx.currentTime);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      thump.connect(thumpGain);
      thumpGain.connect(ctx.destination);
      thump.start();
      thump.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  playCelebrationFanfare(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + idx * 0.085;
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

const soundEngine = new BalloonSoundEngine();

/**
 * Custom 2D Illustrated SVG Balloon with realistic oval shape, specular gloss,
 * ribbon bow, shadow, and swaying string (NO emoji).
 */
const CarnivalBalloonSVG: React.FC<{
  balloon: AssignedBalloon;
  isHighlighted: boolean;
  isInflating: boolean;
  isExploding: boolean;
  isPopped: boolean;
  reduceMotion: boolean;
}> = ({ balloon, isHighlighted, isInflating, isExploding, isPopped, reduceMotion }) => {
  const { palette, displayNumber, balloonId } = balloon;
  const gradId = `b_grad_${balloonId}`;
  const rimId = `b_rim_${balloonId}`;

  if (isExploding) {
    // Render dynamic explosion burst with flying rubber shards, confetti, and shockwaves
    const shards = Array.from({ length: 12 }).map((_, idx) => {
      const angle = (idx * 30 * Math.PI) / 180;
      const dist = 65 + (idx % 3) * 20;
      const tx = Math.round(Math.cos(angle) * dist);
      const ty = Math.round(Math.sin(angle) * dist);
      const rot = idx * 45 + 120;
      const shardColor =
        idx % 3 === 0 ? palette.mid : idx % 3 === 1 ? '#FDE047' : BALLOON_PALETTES[(idx + 2) % BALLOON_PALETTES.length].mid;
      return { idx, tx, ty, rot, shardColor };
    });

    return (
      <div className="relative w-28 h-36 sm:w-32 sm:h-40 flex items-center justify-center select-none pointer-events-none">
        {/* Expanding Shockwave Rings */}
        <div
          className="absolute w-24 h-24 rounded-full border-4 border-amber-300 a08-pop-shockwave"
          style={{ boxShadow: `0 0 28px ${palette.glow}` }}
        />
        <div className="absolute w-16 h-16 rounded-full border-2 border-white a08-pop-shockwave" />

        {/* Flying Latex Shards & Confetti Particles */}
        {shards.map((s) => (
          <div
            key={s.idx}
            className="absolute w-3.5 h-3.5 rounded-xs a08-pop-shard"
            style={
              {
                backgroundColor: s.shardColor,
                '--tx': `${s.tx}px`,
                '--ty': `${s.ty}px`,
                '--rot': `${s.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}

        {/* Central Comic Starburst POP! */}
        <div className="relative z-20 flex flex-col items-center justify-center scale-110 animate-bounce">
          <svg viewBox="0 0 120 120" className="w-24 h-24 drop-shadow-lg">
            <polygon
              points="60,4 73,34 106,22 88,52 116,72 84,82 92,114 62,94 34,114 40,82 8,72 36,52 18,22 50,34"
              fill="#FACC15"
              stroke="#FFFFFF"
              strokeWidth="4"
            />
            <polygon
              points="60,18 70,40 94,32 80,54 102,68 78,76 84,100 61,84 40,100 45,76 22,68 44,54 30,32 52,40"
              fill={palette.mid}
            />
          </svg>
          <span className="absolute text-sm sm:text-base font-black text-white tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]">
            BÙM!
          </span>
        </div>
      </div>
    );
  }

  if (isPopped) {
    // Already popped state (when antiDuplicate is ON)
    return (
      <div className="relative w-24 h-32 sm:w-28 sm:h-36 flex flex-col items-center justify-center opacity-45 select-none">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/70 bg-white/25 backdrop-blur-2xs flex flex-col items-center justify-center text-sky-950 shadow-inner">
          <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          <span className="text-[10px] font-black mt-0.5">#{displayNumber}</span>
        </div>
        <span className="mt-1 px-2 py-0.5 rounded-full bg-white/60 text-[#102E54] text-[10px] font-extrabold">
          Đã mở
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center select-none transition-transform duration-300 ${
        isInflating
          ? 'a08-balloon-inflating z-30'
          : isHighlighted
          ? 'scale-115 z-20'
          : 'a08-balloon-float group-hover:scale-110 group-hover:z-20'
      }`}
      style={
        {
          '--bob-dur': `${balloon.bobDuration}s`,
          '--bob-delay': `${balloon.bobDelay}s`,
          filter: isHighlighted || isInflating
            ? `drop-shadow(0 0 18px ${palette.glow}) drop-shadow(0 0 8px rgba(255,255,255,0.9))`
            : 'drop-shadow(0 10px 14px rgba(15, 45, 82, 0.22))',
        } as React.CSSProperties
      }
    >
      {/* Highlighting Ring Aura */}
      {(isHighlighted || isInflating) && (
        <div className="absolute -inset-2 rounded-full border-4 border-yellow-300/90 animate-ping pointer-events-none" />
      )}

      <svg
        viewBox="0 0 120 176"
        className="w-24 h-34 sm:w-28 sm:h-40 overflow-visible"
        aria-label={`Bóng bay số ${displayNumber}`}
      >
        <defs>
          {/* 3D Radial Lighting on Balloon Body */}
          <radialGradient id={gradId} cx="34%" cy="28%" r="68%" fx="30%" fy="24%">
            <stop offset="0%" stopColor={palette.light} />
            <stop offset="48%" stopColor={palette.mid} />
            <stop offset="92%" stopColor={palette.dark} />
            <stop offset="100%" stopColor={palette.rim} />
          </radialGradient>

          <linearGradient id={rimId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Swaying Balloon String */}
        <g className={reduceMotion ? '' : 'a08-string-sway'}>
          <path
            d="M 60 137 Q 50 151, 63 163 T 57 175"
            fill="none"
            stroke="#FFFBEB"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.92"
          />
        </g>

        {/* Balloon Knot at Neck */}
        <polygon
          points="56,129 64,129 68,137 52,137"
          fill={palette.knot}
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* Main Natural Oval Balloon Body */}
        <path
          d="M 60 8 C 93 8, 111 36, 106 74 C 101 106, 78 124, 64 130 L 56 130 C 42 124, 19 106, 14 74 C 9 36, 27 8, 60 8 Z"
          fill={`url(#${gradId})`}
          stroke={isHighlighted ? '#FEF08A' : 'rgba(255,255,255,0.55)'}
          strokeWidth={isHighlighted ? '3.5' : '1.6'}
        />

        {/* Inner Rim Depth Overlay */}
        <path
          d="M 60 8 C 93 8, 111 36, 106 74 C 101 106, 78 124, 64 130 L 56 130 C 42 124, 19 106, 14 74 C 9 36, 27 8, 60 8 Z"
          fill={`url(#${rimId})`}
          pointerEvents="none"
        />

        {/* Glossy Specular Highlight Crescent (Upper Left) */}
        <path
          d="M 30 34 C 35 21, 47 16, 56 16 C 47 21, 38 30, 34 46 C 31 55, 26 54, 26 46 C 26 42, 28 38, 30 34 Z"
          fill="#FFFFFF"
          opacity="0.65"
        />
        {/* Secondary Gloss Dot */}
        <circle cx="29" cy="60" r="3.5" fill="#FFFFFF" opacity="0.55" />

        {/* Festive Satin Bow at Balloon Neck */}
        <path
          d="M 60 132 C 52 127, 46 131, 51 136 C 55 138, 58 135, 60 133 Z"
          fill="#FEF08A"
        />
        <path
          d="M 60 132 C 68 127, 74 131, 69 136 C 65 138, 62 135, 60 133 Z"
          fill="#FEF08A"
        />
        <circle cx="60" cy="133" r="2.2" fill="#F59E0B" />

        {/* Balloon Number Medallion (Does NOT reveal student name before popping) */}
        <g transform="translate(60, 68)">
          <circle
            cx="0"
            cy="0"
            r="20"
            fill="rgba(255, 255, 255, 0.92)"
            stroke={palette.dark}
            strokeWidth="2"
          />
          <text
            x="0"
            y="6"
            textAnchor="middle"
            fill="#0F2D52"
            fontSize="16"
            fontWeight="900"
            fontFamily="sans-serif"
          >
            #{displayNumber}
          </text>
        </g>
      </svg>
    </div>
  );
};

export const BalloonsGame: React.FC<BalloonsGameProps> = ({
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
  teacherId = 'gv_taydo',
  teacherName = 'Giáo viên',
  userRole = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  onToggleMute,
  onOpenAbsentModal,
  onUpdateLatestNote,
}) => {
  // Game Mode: Mode 1 (Teacher Manual Pick) vs Mode 2 (System Random Pick)
  const [playMode, setPlayMode] = useState<BalloonPlayMode>('MANUAL');

  // Strict State Machine: IDLE -> SELECTING -> HIGHLIGHTING -> POPPING -> REVEALING -> COMPLETED
  const [phase, setPhase] = useState<BalloonGamePhase>('IDLE');
  const [popSubStage, setPopSubStage] = useState<'NONE' | 'INFLATING' | 'EXPLODING'>('NONE');

  // Reduced Motion Accessibility Option
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // Session ID & Stable Balloon Mapping
  const [sessionId, setSessionId] = useState<string>(() => `a08_sess_${Date.now().toString(36)}`);
  const [assignedBalloons, setAssignedBalloons] = useState<AssignedBalloon[]>([]);

  // Active & Picked Balloon Tracking
  const [spotlightBalloonId, setSpotlightBalloonId] = useState<string | null>(null);
  const [selectedBalloon, setSelectedBalloon] = useState<AssignedBalloon | null>(null);
  const [revealedStudent, setRevealedStudent] = useState<StudentCandidate | null>(null);
  const [showWinnerOverlay, setShowWinnerOverlay] = useState<boolean>(false);

  // Pagination for Large Classes (up to 12 balloons per page so balloons stay large and clear)
  const BALLOONS_PER_PAGE = 12;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Answer Timer Controls (15s, 30s default, 60s, Custom)
  const [timerPreset, setTimerPreset] = useState<number>(30);
  const [customTimerInput, setCustomTimerInput] = useState<string>('45');
  const [isCustomTimer, setIsCustomTimer] = useState<boolean>(false);
  const [timerRemaining, setTimerRemaining] = useState<number>(30);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Score / Bonus Points & Note for Picked Student
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [roundNote, setRoundNote] = useState<string>('');
  const [supabaseSyncState, setSupabaseSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string | null>(null);

  // Refs for timers and idempotency
  const timersRef = useRef<number[]>([]);
  const savedTurnIdsRef = useRef<Set<string>>(new Set());
  const currentTurnIdRef = useRef<string | null>(null);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Present students in the selected class (excluding absent students)
  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((st) => !absentIds.has(st.id));
  }, [allCandidates, availableCandidates, absentIds]);

  const presentSignature = useMemo(
    () => presentStudents.map((s) => s.id).join('|'),
    [presentStudents]
  );

  // Initialize / Shuffle student-to-balloon assignment ONLY when class/present list or sessionId changes
  useEffect(() => {
    clearAllTimers();
    const shuffled = fisherYatesShuffle(presentStudents);
    const mapped: AssignedBalloon[] = shuffled.map((student, idx) => ({
      balloonId: `${sessionId}_b_${idx + 1}_${student.id}`,
      displayNumber: idx + 1,
      student,
      palette: BALLOON_PALETTES[idx % BALLOON_PALETTES.length],
      bobDuration: 3.6 + (idx % 5) * 0.35,
      bobDelay: (idx % 6) * -0.55,
    }));
    setAssignedBalloons(mapped);
    setCurrentPage(1);
    setPhase('IDLE');
    setPopSubStage('NONE');
    setSpotlightBalloonId(null);
    setSelectedBalloon(null);
    setRevealedStudent(null);
    setShowWinnerOverlay(false);
    setSupabaseSyncState('idle');
    setSupabaseErrorMsg(null);
  }, [presentSignature, sessionId, clearAllTimers]);

  // Determine which balloons are already popped in this session
  const isBalloonPopped = useCallback(
    (b: AssignedBalloon): boolean => {
      if (!antiDuplicate) return false;
      return calledSessionIds.has(b.student.id);
    },
    [antiDuplicate, calledSessionIds]
  );

  // Eligible balloons that can still be chosen
  const eligibleBalloons = useMemo(() => {
    return assignedBalloons.filter((b) => !isBalloonPopped(b));
  }, [assignedBalloons, isBalloonPopped]);

  const totalPages = Math.max(1, Math.ceil(assignedBalloons.length / BALLOONS_PER_PAGE));

  // Keep currentPage in valid range
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageBalloons = useMemo(() => {
    const start = (currentPage - 1) * BALLOONS_PER_PAGE;
    return assignedBalloons.slice(start, start + BALLOONS_PER_PAGE);
  }, [assignedBalloons, currentPage]);

  // Answer Countdown Timer Effect (does NOT auto-advance student when time expires)
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          soundEngine.playTimerBell(isMuted);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, isMuted]);

  // Persist turn result to Supabase audit_logs (with retry support & duplicate guard)
  const syncTurnToSupabase = useCallback(
    async (student: StudentCandidate, points: number, noteText: string, mode: BalloonPlayMode, forceRetry = false) => {
      const turnId = currentTurnIdRef.current || `turn_${sessionId}_${student.id}`;
      if (!forceRetry && savedTurnIdsRef.current.has(`${turnId}_${points}_${noteText}`)) {
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
          // Demo/local session without active Supabase JWT: local history is already saved
          savedTurnIdsRef.current.add(`${turnId}_${points}_${noteText}`);
          setSupabaseSyncState('saved');
          return;
        }

        const formattedSummary = [
          `Trò chơi: A08 - Bóng bay may mắn`,
          `Lớp: ${resolvedClassName}`,
          `HS: ${student.fullName} (${student.code})`,
          `Chế độ: ${mode === 'MANUAL' ? 'GV chọn bóng' : 'Máy chọn ngẫu nhiên'}`,
          points > 0 ? `Điểm thưởng: +${points}đ` : '',
          noteText.trim() ? `Ghi chú: ${noteText.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const { error } = await supabase.from('audit_logs').insert({
          actor_name: teacherName || 'Giáo viên',
          role: userRole || 'teacher',
          action: 'EDU_GAME_A08_BALLOON_PICK',
          target: `A08 (${resolvedClassName}) - ${student.fullName}`,
          details: formattedSummary,
          actor_id: authUser.id,
          metadata: {
            gameCode: 'A08',
            gameTitle: 'Bóng bay may mắn',
            sessionId,
            classId: selectedSourceKey,
            className: resolvedClassName,
            studentId: student.id,
            studentCode: student.code,
            studentName: student.fullName,
            playMode: mode,
            bonusPoints: points,
            note: noteText.trim(),
            timestamp: new Date().toISOString(),
          },
        });

        if (error) {
          throw error;
        }

        savedTurnIdsRef.current.add(`${turnId}_${points}_${noteText}`);
        setSupabaseSyncState('saved');
      } catch (err: any) {
        console.warn('A08 Supabase sync warning:', err);
        setSupabaseSyncState('error');
        setSupabaseErrorMsg(
          err?.message || 'Chưa đồng bộ được lên đám mây Supabase. Kết quả vẫn được giữ an toàn tại máy.'
        );
      }
    },
    [resolvedClassName, selectedSourceKey, sessionId, teacherName, userRole]
  );

  // Execute Popping & Reveal sequence for a chosen balloon
  const triggerBalloonPopSequence = useCallback(
    (targetBalloon: AssignedBalloon, modeUsed: BalloonPlayMode) => {
      try {
        // Ensure the page containing targetBalloon is visible
        const targetIndex = assignedBalloons.findIndex((b) => b.balloonId === targetBalloon.balloonId);
        if (targetIndex >= 0) {
          const targetPage = Math.floor(targetIndex / BALLOONS_PER_PAGE) + 1;
          setCurrentPage(targetPage);
        }

        setSelectedBalloon(targetBalloon);
        setSpotlightBalloonId(targetBalloon.balloonId);
        setPhase('HIGHLIGHTING');
        setPopSubStage('NONE');
        soundEngine.playSpotlightTick(isMuted);

        // Step 1: Highlight -> Inflating & Shaking (POPPING)
        const t1 = window.setTimeout(() => {
          setPhase('POPPING');
          setPopSubStage('INFLATING');
          soundEngine.playBalloonInflate(isMuted);

          // Step 2: Inflating -> Exploding Burst (POP!)
          const t2 = window.setTimeout(() => {
            setPopSubStage('EXPLODING');
            soundEngine.playBalloonPop(isMuted);

            // Step 3: Exploding -> Revealing Student Identity
            const t3 = window.setTimeout(() => {
              setPhase('REVEALING');
              setPopSubStage('NONE');
              setRevealedStudent(targetBalloon.student);
              setShowWinnerOverlay(true);
              setBonusPoints(0);
              setRoundNote('');
              soundEngine.playCelebrationFanfare(isMuted);

              // Reset answer timer to preset for the newly picked student
              setTimerRunning(false);
              setTimerRemaining(timerPreset);

              // Step 4: Completed & Record History Once
              const t4 = window.setTimeout(() => {
                setPhase('COMPLETED');
                const turnId = `turn_${sessionId}_${Date.now()}_${targetBalloon.student.id}`;
                currentTurnIdRef.current = turnId;
                if (!savedTurnIdsRef.current.has(turnId)) {
                  savedTurnIdsRef.current.add(turnId);
                  onPick(targetBalloon.student, {
                    bonusPoints: 0,
                    note: '',
                    sessionId,
                  });
                  syncTurnToSupabase(targetBalloon.student, 0, '', modeUsed);
                }
              }, 260);
              timersRef.current.push(t4);
            }, 460);
            timersRef.current.push(t3);
          }, 360);
          timersRef.current.push(t2);
        }, 380);
        timersRef.current.push(t1);
      } catch (err) {
        console.error('Balloon animation recovery:', err);
        setPhase('IDLE');
        setPopSubStage('NONE');
      }
    },
    [assignedBalloons, isMuted, onPick, sessionId, syncTurnToSupabase, timerPreset]
  );

  // Mode 1: Teacher clicks directly on a balloon
  const handleManualBalloonClick = (balloon: AssignedBalloon) => {
    if (phase !== 'IDLE' && phase !== 'COMPLETED') return;
    if (isBalloonPopped(balloon)) return;

    clearAllTimers();
    setShowWinnerOverlay(false);
    setRevealedStudent(null);
    triggerBalloonPopSequence(balloon, 'MANUAL');
  };

  // Mode 2: System randomly picks an eligible balloon across ALL pages
  const handleSystemPickBalloon = () => {
    if (phase !== 'IDLE' && phase !== 'COMPLETED') return;
    if (eligibleBalloons.length === 0) return;

    clearAllTimers();
    setShowWinnerOverlay(false);
    setRevealedStudent(null);
    setSelectedBalloon(null);
    setPhase('SELECTING');

    // Fair cryptographic selection from ALL eligible balloons in the class
    const winnerIndex = secureRandomInt(eligibleBalloons.length);
    const winningBalloon = eligibleBalloons[winnerIndex];

    // Spotlight jumping effect across balloons before locking onto winningBalloon
    const currentPageEligible = pageBalloons.filter((b) => !isBalloonPopped(b));
    const spotlightPool = currentPageEligible.length > 0 ? currentPageEligible : eligibleBalloons;

    const totalTicks = reduceMotion ? 3 : 9;
    let step = 0;

    const runTick = () => {
      step++;
      if (step < totalTicks) {
        const randomSpotlight = spotlightPool[secureRandomInt(spotlightPool.length)];
        setSpotlightBalloonId(randomSpotlight.balloonId);
        soundEngine.playSpotlightTick(isMuted);
        const nextDelay = 95 + step * 18;
        const tid = window.setTimeout(runTick, nextDelay);
        timersRef.current.push(tid);
      } else {
        // Switch to the winning balloon's page if needed and lock target
        const targetIdxInAll = assignedBalloons.findIndex((b) => b.balloonId === winningBalloon.balloonId);
        if (targetIdxInAll >= 0) {
          const targetPage = Math.floor(targetIdxInAll / BALLOONS_PER_PAGE) + 1;
          setCurrentPage(targetPage);
        }
        triggerBalloonPopSequence(winningBalloon, 'AUTO');
      }
    };

    runTick();
  };

  // Start a fresh session (re-shuffles balloons with Fisher-Yates)
  const handleRefreshSession = () => {
    clearAllTimers();
    savedTurnIdsRef.current.clear();
    currentTurnIdRef.current = null;
    setSessionId(`a08_sess_${Date.now().toString(36)}`);
    setPhase('IDLE');
    setPopSubStage('NONE');
    setSpotlightBalloonId(null);
    setSelectedBalloon(null);
    setRevealedStudent(null);
    setShowWinnerOverlay(false);
    setBonusPoints(0);
    setRoundNote('');
    onResetSession?.();
  };

  // Save bonus points & note for the revealed student
  const handleSaveScoreAndNote = () => {
    if (!revealedStudent) return;
    const combinedNote = [
      bonusPoints > 0 ? `+${bonusPoints} điểm thưởng` : '',
      roundNote.trim(),
    ]
      .filter(Boolean)
      .join(' - ');

    onUpdateLatestNote?.(combinedNote);
    syncTurnToSupabase(revealedStudent, bonusPoints, roundNote, playMode, true);
  };

  const isBusy =
    phase === 'SELECTING' ||
    phase === 'HIGHLIGHTING' ||
    phase === 'POPPING' ||
    phase === 'REVEALING';

  const allCalled = presentStudents.length > 0 && eligibleBalloons.length === 0;

  return (
    <div
      className={`w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch ${
        reduceMotion ? 'a08-reduce-motion' : ''
      }`}
    >
      {/* ===================================================================
          LEFT COLUMN (70-75% on Desktop): BALLOON POP CARNIVAL STAGE
         =================================================================== */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between space-y-4">
        <div
          className={`relative w-full ${
            isFullscreen ? 'min-h-[74vh]' : 'min-h-[480px] sm:min-h-[540px]'
          } rounded-3xl border-4 border-sky-300 shadow-2xl overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#1E88E5] via-[#64B5F6] to-[#E1F5FE]`}
        >
          {/* 1. CARNIVAL SKY SCENERY: Sunburst, Floating Clouds, Twinkling Stars & Bunting Flags */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Warm Carnival Sun Glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[520px] h-[260px] bg-gradient-to-b from-yellow-200/55 via-amber-100/25 to-transparent rounded-full blur-2xl" />

            {/* Twinkling Stars & Sparkles */}
            {[
              { top: '12%', left: '8%', delay: '0s' },
              { top: '18%', left: '24%', delay: '0.8s' },
              { top: '10%', left: '75%', delay: '0.4s' },
              { top: '22%', left: '88%', delay: '1.2s' },
              { top: '36%', left: '12%', delay: '1.6s' },
              { top: '32%', left: '92%', delay: '0.6s' },
            ].map((st, idx) => (
              <svg
                key={idx}
                viewBox="0 0 24 24"
                className="absolute w-5 h-5 text-yellow-100 a08-star-glow"
                style={{ top: st.top, left: st.left, animationDelay: st.delay }}
              >
                <path
                  fill="currentColor"
                  d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
                />
              </svg>
            ))}

            {/* Drifting Fluffy White Clouds */}
            <svg
              viewBox="0 0 220 90"
              className="absolute top-12 left-4 w-40 sm:w-52 text-white/80 a08-cloud-slow"
            >
              <path
                fill="currentColor"
                d="M45 72 H175 C192 72 205 59 205 43 C205 28 193 16 178 15 C171 5 159 0 145 0 C126 0 110 12 105 29 C99 25 91 23 83 23 C63 23 47 38 45 57 C33 58 24 64 24 72 Z"
              />
            </svg>
            <svg
              viewBox="0 0 220 90"
              className="absolute top-16 right-6 w-44 sm:w-56 text-white/75 a08-cloud-slow"
              style={{ animationDelay: '-6s' }}
            >
              <path
                fill="currentColor"
                d="M45 72 H175 C192 72 205 59 205 43 C205 28 193 16 178 15 C171 5 159 0 145 0 C126 0 110 12 105 29 C99 25 91 23 83 23 C63 23 47 38 45 57 C33 58 24 64 24 72 Z"
              />
            </svg>
            <svg
              viewBox="0 0 220 90"
              className="absolute bottom-24 left-1/3 w-36 text-white/60 a08-cloud-slow"
              style={{ animationDelay: '-3s' }}
            >
              <path
                fill="currentColor"
                d="M45 72 H175 C192 72 205 59 205 43 C205 28 193 16 178 15 C171 5 159 0 145 0 C126 0 110 12 105 29 C99 25 91 23 83 23 C63 23 47 38 45 57 C33 58 24 64 24 72 Z"
              />
            </svg>

            {/* Festive Carnival Bunting Flags along the Top */}
            <svg
              viewBox="0 0 1000 75"
              preserveAspectRatio="none"
              className="absolute top-0 left-0 w-full h-12 sm:h-14 drop-shadow-sm"
            >
              {/* Left Garland */}
              <path
                d="M 0 6 Q 250 58, 500 8 Q 750 58, 1000 6"
                fill="none"
                stroke="#FFFBEB"
                strokeWidth="3"
              />
              {Array.from({ length: 20 }).map((_, idx) => {
                const x = idx * 50 + 10;
                const t = (x % 500) / 500;
                const y = Math.round(6 + 4 * t * (1 - t) * 26);
                const flagColors = ['#EF4444', '#FACC15', '#10B981', '#EC4899', '#8B5CF6', '#F97316'];
                const color = flagColors[idx % flagColors.length];
                return (
                  <polygon
                    key={idx}
                    points={`${x},${y} ${x + 32},${y} ${x + 16},${y + 30}`}
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>

            {/* Carnival Stage Floor / Tent Deck at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0F2D52] via-[#1E3A8A] to-transparent opacity-90" />
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-[repeating-linear-gradient(90deg,#EF4444_0px,#EF4444_28px,#FFFFFF_28px,#FFFFFF_56px,#FACC15_56px,#FACC15_84px)] opacity-90 border-t-2 border-amber-300" />
          </div>

          {/* 2. TOP STAGE BAR: Carnival Title, Mode Switcher & Remaining Counter */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 pt-5 pb-2 sm:px-6">
            <div className="flex items-center gap-2.5 bg-white/90 backdrop-blur-xs px-3.5 py-1.5 rounded-full shadow-md border border-sky-200">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs sm:text-sm font-black text-[#0F2D52] uppercase tracking-wide">
                🎪 LỄ HỘI BÓNG BAY MAY MẮN · {resolvedClassName}
              </span>
            </div>

            {/* Play Mode Switcher Pills right on Stage Header */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-900/80 backdrop-blur-xs p-1 rounded-full border border-white/30 flex items-center gap-1 shadow-md">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setPlayMode('MANUAL')}
                  className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    playMode === 'MANUAL'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>GV chọn bóng</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setPlayMode('AUTO')}
                  className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    playMode === 'AUTO'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Máy chọn ngẫu nhiên</span>
                </button>
              </div>

              <div className="bg-white/90 backdrop-blur-xs px-3.5 py-1.5 rounded-full shadow-md border border-sky-200 text-xs font-extrabold text-[#0F2D52] tabular-nums">
                Còn <span className="text-rose-600 font-black">{eligibleBalloons.length}</span> / {presentStudents.length} bóng
              </div>
            </div>
          </div>

          {/* 3. CENTER FLOATING BALLOONS ARENA */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-3 sm:px-8">
            {presentStudents.length === 0 ? (
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 text-center max-w-md shadow-xl border-2 border-sky-200 space-y-3">
                <Users className="w-12 h-12 text-sky-600 mx-auto" />
                <h3 className="text-lg font-black text-[#0F2D52]">Lớp chưa có học sinh có mặt</h3>
                <p className="text-xs text-slate-600">
                  Vui lòng chọn lớp học khác hoặc kiểm tra lại danh sách học sinh vắng mặt.
                </p>
              </div>
            ) : allCalled && phase !== 'POPPING' && !showWinnerOverlay ? (
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 text-center max-w-lg shadow-2xl border-4 border-amber-400 space-y-4 animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                  <Trophy className="w-9 h-9" />
                </div>
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                  HOÀN THÀNH PHIÊN GỌI
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#0F2D52]">
                  ĐÃ GỌI HẾT LỚP ({presentStudents.length} HỌC SINH)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Tất cả các quả bóng bay trong phiên này đã được mở. Hãy làm mới phiên để xáo bóng và bắt đầu lượt mới!
                </p>
                <button
                  type="button"
                  onClick={handleRefreshSession}
                  className="px-7 py-3.5 bg-gradient-to-r from-[#006BFF] to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl text-sm font-black shadow-lg flex items-center gap-2 mx-auto transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>LÀM MỚI PHIÊN BÓNG BAY</span>
                </button>
              </div>
            ) : (
              <div
                className={`w-full grid gap-3 sm:gap-5 items-center justify-items-center my-auto ${
                  pageBalloons.length <= 2
                    ? 'grid-cols-1 sm:grid-cols-2 max-w-xl'
                    : pageBalloons.length <= 4
                    ? 'grid-cols-2 sm:grid-cols-4 max-w-3xl'
                    : pageBalloons.length <= 8
                    ? 'grid-cols-2 sm:grid-cols-4 max-w-4xl'
                    : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 max-w-5xl'
                }`}
              >
                {pageBalloons.map((balloon) => {
                  const popped = isBalloonPopped(balloon);
                  const isHighlighted =
                    spotlightBalloonId === balloon.balloonId &&
                    (phase === 'SELECTING' || phase === 'HIGHLIGHTING' || phase === 'POPPING');
                  const isTargetPopping =
                    selectedBalloon?.balloonId === balloon.balloonId && phase === 'POPPING';
                  const isInflating = isTargetPopping && popSubStage === 'INFLATING';
                  const isExploding = isTargetPopping && popSubStage === 'EXPLODING';

                  return (
                    <button
                      key={balloon.balloonId}
                      type="button"
                      disabled={isBusy || popped}
                      onClick={() => handleManualBalloonClick(balloon)}
                      title={
                        popped
                          ? `Bóng #${balloon.displayNumber} đã nổ`
                          : `Nhấn để châm nổ bóng #${balloon.displayNumber}`
                      }
                      className={`group relative flex flex-col items-center justify-center p-1 rounded-2xl focus:outline-none transition-all ${
                        popped
                          ? 'cursor-not-allowed'
                          : isBusy
                          ? 'cursor-wait'
                          : 'cursor-pointer'
                      }`}
                    >
                      <CarnivalBalloonSVG
                        balloon={balloon}
                        isHighlighted={isHighlighted}
                        isInflating={isInflating}
                        isExploding={isExploding}
                        isPopped={popped}
                        reduceMotion={reduceMotion}
                      />

                      {/* Hover hint pill in Manual Mode */}
                      {!popped && !isBusy && (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity -mt-2 px-2.5 py-0.5 rounded-full bg-slate-900/85 text-amber-300 text-[10px] font-extrabold shadow-md whitespace-nowrap pointer-events-none">
                          Châm bóng #{balloon.displayNumber}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 4. CELEBRATION WINNER REVEAL OVERLAY (Only shown AFTER balloon pops!) */}
            {showWinnerOverlay && revealedStudent && (phase === 'REVEALING' || phase === 'COMPLETED') && (
              <div className="absolute inset-0 z-30 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
                {/* Confetti Rain SVG */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const left = `${(i * 19) % 96 + 2}%`;
                    const delay = `${(i % 6) * 0.12}s`;
                    const colors = ['#FACC15', '#EF4444', '#38BDF8', '#EC4899', '#10B981', '#A855F7'];
                    return (
                      <div
                        key={i}
                        className="absolute top-4 w-3 h-5 rounded-xs"
                        style={{
                          left,
                          backgroundColor: colors[i % colors.length],
                          animation: reduceMotion ? 'none' : `a08-confetti-fall 1.8s ease-out ${delay} infinite`,
                        }}
                      />
                    );
                  })}
                </div>

                <div className="relative bg-gradient-to-b from-amber-300 via-yellow-200 to-white rounded-3xl border-4 border-white p-6 sm:p-8 max-w-xl w-full text-center shadow-[0_20px_60px_rgba(0,0,0,0.55)] space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-rose-600 text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-md">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      BÓNG SỐ #{selectedBalloon?.displayNumber || 1} ĐÃ NỔ · CHÚC MỪNG!
                    </span>
                  </div>

                  <div className="py-3 px-4 bg-white/90 rounded-2xl border-2 border-amber-300 shadow-inner space-y-1.5">
                    <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                      Học sinh được chọn
                    </p>
                    <h3 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#0F2D52] tracking-tight leading-tight break-words">
                      {revealedStudent.fullName}
                    </h3>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-[#006BFF] text-xs font-extrabold">
                        Mã HS: {revealedStudent.code}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                        Lớp: {resolvedClassName}
                      </span>
                    </div>
                  </div>

                  {/* Next Turn Actions right inside the Stage Reveal Card */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    {eligibleBalloons.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSystemPickBalloon}
                          className="px-6 py-3 bg-gradient-to-r from-[#006BFF] to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <Wand2 className="w-4 h-4" />
                          <span>CHỌN BÓNG TIẾP (NGẪU NHIÊN) ➔</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowWinnerOverlay(false);
                            setPhase('IDLE');
                          }}
                          className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <Hand className="w-4 h-4 text-amber-300" />
                          <span>Tự chọn bóng tiếp trên sân khấu</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRefreshSession}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>ĐÃ GỌI HẾT LỚP · LÀM MỚI PHIÊN</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. BOTTOM STAGE BAR: Pagination for Large Classes & Stage Hint */}
          <div className="relative z-20 px-4 py-3 sm:px-6 bg-slate-950/65 backdrop-blur-xs border-t border-white/20 flex flex-wrap items-center justify-between gap-3 text-white">
            <div className="text-xs font-bold text-sky-100 flex items-center gap-2">
              <span>
                {playMode === 'MANUAL'
                  ? '👆 Chế độ Giáo viên chọn: Nhấn trực tiếp vào bất kỳ quả bóng nào trên sân khấu để làm nổ bóng.'
                  : '✨ Chế độ Máy chọn: Nhấn "Chọn bóng may mắn" để đèn sân khấu tìm và làm nổ bóng ngẫu nhiên.'}
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full border border-white/25">
                <button
                  type="button"
                  disabled={currentPage <= 1 || isBusy}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-full hover:bg-white/20 disabled:opacity-40 transition-colors"
                  title="Trang bóng trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pNum = i + 1;
                    const sliceStart = i * BALLOONS_PER_PAGE;
                    const sliceBalloons = assignedBalloons.slice(sliceStart, sliceStart + BALLOONS_PER_PAGE);
                    const unpoppedOnPage = sliceBalloons.filter((b) => !isBalloonPopped(b)).length;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        disabled={isBusy}
                        onClick={() => setCurrentPage(pNum)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-all tabular-nums ${
                          currentPage === pNum
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : 'text-white/85 hover:bg-white/15'
                        }`}
                      >
                        Tr.{pNum} ({unpoppedOnPage})
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages || isBusy}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded-full hover:bg-white/20 disabled:opacity-40 transition-colors"
                  title="Trang bóng tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PRIMARY STAGE CONTROL BAR RIGHT BENEATH THE CARNIVAL STAGE */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <button
            type="button"
            disabled={isBusy || eligibleBalloons.length === 0}
            onClick={handleSystemPickBalloon}
            className="sm:col-span-8 py-4 px-6 bg-gradient-to-r from-rose-500 via-amber-500 to-[#006BFF] hover:opacity-95 text-white rounded-2xl text-base sm:text-lg font-black shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
          >
            <Sparkles className={`w-6 h-6 ${isBusy ? 'animate-spin' : ''}`} />
            <span>
              {allCalled
                ? 'ĐÃ GỌI HẾT LỚP'
                : phase === 'SELECTING'
                ? '🎪 ĐÈN SÂN KHẤU ĐANG TÌM BÓNG...'
                : phase === 'HIGHLIGHTING' || phase === 'POPPING'
                ? '💥 BÓNG ĐANG CĂNG VÀ NỔ...'
                : phase === 'COMPLETED' || revealedStudent
                ? '🎈 CHỌN BÓNG TIẾP ➔'
                : '🎈 CHỌN BÓNG MAY MẮN ➔'}
            </span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleRefreshSession}
            className="sm:col-span-4 py-4 px-4 bg-white hover:bg-slate-50 text-[#0F2D52] border-2 border-slate-200 rounded-2xl text-xs sm:text-sm font-extrabold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#006BFF]" />
            <span>Làm mới phiên ({eligibleBalloons.length}/{presentStudents.length})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================
          RIGHT COLUMN (25-30% on Desktop): RESULTS, TIMER, BONUS & CONTROLS
         =================================================================== */}
      <div className="lg:col-span-4 xl:col-span-3 bg-slate-50 rounded-3xl border border-slate-200 p-5 flex flex-col justify-between space-y-5 shadow-xs">
        <div className="space-y-4">
          {/* 1. Class & Quick Settings Section */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Lớp & Cấu hình phiên
              </span>
              {onOpenAbsentModal && (
                <button
                  type="button"
                  onClick={onOpenAbsentModal}
                  className="text-[11px] font-extrabold text-[#006BFF] hover:underline"
                >
                  Vắng ({absentIds.size})
                </button>
              )}
            </div>

            {onSelectSourceKey && classes.length > 0 && (
              <select
                value={selectedSourceKey}
                disabled={isBusy}
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
                disabled={isBusy}
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
                title="Giảm hiệu ứng chuyển động cho máy cấu hình yếu"
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

          {/* 2. Current Turn Result Box (Strictly hidden during animation until balloon pops!) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-[#0F2D52] uppercase tracking-wider">
                Kết quả mở bóng
              </h4>
              <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                Đã gọi: {calledSessionIds.size}/{presentStudents.length}
              </span>
            </div>

            {isBusy ? (
              <div className="py-6 px-3 bg-sky-50 border border-sky-200 rounded-xl text-center space-y-2 animate-pulse">
                <Sparkles className="w-8 h-8 text-sky-600 mx-auto animate-spin" />
                <p className="text-xs font-extrabold text-[#0F2D52]">
                  {phase === 'SELECTING'
                    ? 'Đang rọi đèn tìm bóng may mắn...'
                    : 'Quả bóng đang căng phồng và phát nổ!'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Danh tính học sinh sẽ xuất hiện ngay sau khi bóng nổ.
                </p>
              </div>
            ) : revealedStudent ? (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      🎯 Bóng #{selectedBalloon?.displayNumber || 1} trúng thưởng
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
                      <Award className="w-3.5 h-3.5 text-amber-500" /> Cộng điểm thưởng & Ghi chú
                    </span>
                    {bonusPoints > 0 && (
                      <span className="text-emerald-600 font-black">+{bonusPoints} điểm</span>
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
                    placeholder="Ghi chú (VD: Trả lời đúng, nhanh...)"
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
                      {supabaseSyncState === 'saving' ? 'Đang lưu...' : 'Lưu điểm thưởng & ghi chú'}
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
                          syncTurnToSupabase(revealedStudent, bonusPoints, roundNote, playMode, true)
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
                <Users className="w-9 h-9 mx-auto opacity-35" />
                <p className="text-xs font-bold text-slate-500">Chưa mở quả bóng nào</p>
                <p className="text-[11px]">
                  Nhấn trực tiếp vào một quả bóng hoặc bấm nút <strong>Chọn bóng may mắn</strong>.
                </p>
              </div>
            )}
          </div>

          {/* 3. Answer Timer Section (15s, 30s default, 60s, Custom - never auto-switches student) */}
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
                    <Pause className="w-3.5 h-3.5" /> Tạm dừng
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

            {timerRemaining === 0 && (
              <p className="text-[11px] font-extrabold text-rose-600 text-center">
                ⏰ Đã hết thời gian trả lời! (Giữ nguyên học sinh đang gọi)
              </p>
            )}
          </div>
        </div>

        {/* Bottom Session Status Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-bold">
          <span>Mã trò chơi: A08</span>
          <span>Trạng thái: {phase}</span>
        </div>
      </div>
    </div>
  );
};
