import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Layers,
  Play,
  Pause,
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
  Sparkles,
  Trophy,
  Award,
  EyeOff,
  History,
  RefreshCw,
  Hand,
  Wand2,
  BookOpen,
  Shuffle,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';

export type CardGamePhase =
  | 'IDLE'
  | 'SHUFFLING'
  | 'SPREADING'
  | 'SELECTING'
  | 'FLIPPING'
  | 'REVEALING'
  | 'COMPLETED';

export type CardPlayMode = 'MANUAL_PICK' | 'AUTO_PICK' | 'CHALLENGE_DUAL_DECK';

export type ChallengeSourceType = 'QUESTION_BANK' | 'CUSTOM_CARDS';

export interface CustomChallengeCardItem {
  id: string;
  category: 'points' | 'time' | 'task' | 'question';
  badge: string;
  title: string;
  detail: string;
}

const DEFAULT_CUSTOM_CHALLENGES: CustomChallengeCardItem[] = [
  {
    id: 'cc_1',
    category: 'points',
    badge: 'Điểm thưởng +5đ',
    title: 'Thẻ Ngôi Sao May Mắn',
    detail: 'Trả lời đúng câu hỏi của giáo viên sẽ nhận ngay +5 điểm thưởng khích lệ trong phiên!',
  },
  {
    id: 'cc_2',
    category: 'time',
    badge: 'Thời gian 45s',
    title: 'Thẻ Thêm Thời Gian Suy Nghĩ',
    detail: 'Học sinh được cộng thêm 15 giây (tổng 45 giây) để suy nghĩ và trình bày câu trả lời.',
  },
  {
    id: 'cc_3',
    category: 'task',
    badge: 'Trợ giúp 50/50',
    title: 'Thẻ Quyền Trợ Giúp Đồng Đội',
    detail: 'Được phép mời 1 bạn cùng tổ hỗ trợ gợi ý 1 từ khóa quan trọng.',
  },
  {
    id: 'cc_4',
    category: 'question',
    badge: 'Nhiệm vụ nhanh',
    title: 'Thẻ Tóm Tắt Kiến Thức Trọng Tâm',
    detail: 'Hãy nêu 1 ý chính hoặc 1 công thức quan trọng nhất vừa học trong bài hôm nay.',
  },
  {
    id: 'cc_5',
    category: 'points',
    badge: 'Nhân đôi x2',
    title: 'Thẻ Nhân Đôi Điểm Thưởng',
    detail: 'Nếu vượt qua thử thách trên bảng, điểm thưởng lượt này được nhân đôi (x2)!',
  },
  {
    id: 'cc_6',
    category: 'task',
    badge: 'Thử thách tốc độ',
    title: 'Thẻ Phản Xạ Tia Chớp (15 giây)',
    detail: 'Trả lời nhanh câu hỏi nhận biết trong vòng 15 giây để nhận tràng pháo tay của lớp.',
  },
];

export interface AssignedStudentCard {
  cardId: string;
  slotNumber: number;
  student: StudentCandidate;
  accentIdx: number;
}

export interface SecretCardGameProps {
  availableCandidates: StudentCandidate[];
  onPick: (
    student: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string }
  ) => void;
  isMuted: boolean;
  allCandidates?: StudentCandidate[];
  absentIds?: Set<string>;
  calledSessionIds?: Set<string>;
  antiDuplicate?: boolean;
  onToggleAntiDuplicate?: () => void;
  onResetSession?: () => void;
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
  onToggleMute?: () => void;
  onOpenAbsentModal?: () => void;
  onOpenHistoryModal?: () => void;
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
 * Unbiased Fisher-Yates shuffle using secureRandomInt.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Web Audio Sound Synthesizer for Magic Card Show (Shuffle Riffle, Card Slide, 3D Flip Whoosh, Reveal Chime)
 */
class CardSoundEngine {
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

  playCardRustle(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.055);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, ctx.currentTime);
      filter.Q.setValueAtTime(1.4, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.002, ctx.currentTime + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch {}
  }

  playMagicFlip(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  playRevealChime(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + idx * 0.08;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.17, start + 0.02);
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
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
  }
}

const cardSound = new CardSoundEngine();

/**
 * Custom SVG Back Artwork for Mystery Card 3D (Star Mandala, Open Knowledge Book, Tây Đô Smart EDU Crest)
 * Zero emoji used.
 */
const MysteryCardBackArtwork: React.FC<{
  slotNumber: number;
  variant?: 'student' | 'challenge';
  isHighlighted?: boolean;
}> = ({ slotNumber, variant = 'student', isHighlighted = false }) => {
  const isChallenge = variant === 'challenge';
  return (
    <div
      className={`w-full h-full rounded-2xl p-2 flex flex-col justify-between relative overflow-hidden select-none border-2 ${
        isHighlighted
          ? 'border-yellow-300 shadow-[0_0_25px_rgba(250,204,21,0.85)]'
          : isChallenge
          ? 'border-cyan-400/80'
          : 'border-amber-400/80'
      } ${
        isChallenge
          ? 'bg-gradient-to-br from-[#0F2942] via-[#133B5C] to-[#071A2C]'
          : 'bg-gradient-to-br from-[#1A103C] via-[#261758] to-[#0D0722]'
      }`}
    >
      {/* Inner Ornate Filigree Frame */}
      <div
        className={`w-full h-full rounded-xl border ${
          isChallenge ? 'border-cyan-300/45' : 'border-amber-300/45'
        } p-2 flex flex-col items-center justify-between relative`}
      >
        {/* Corner Stars */}
        <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full pointer-events-none opacity-85">
          <defs>
            <radialGradient id={`cardGlow_${slotNumber}_${variant}`} cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={isChallenge ? '#38BDF8' : '#FACC15'}
                stopOpacity="0.38"
              />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="50" cy="70" r="42" fill={`url(#cardGlow_${slotNumber}_${variant})`} />

          {/* Geometric Mandala Rings */}
          <circle
            cx="50"
            cy="70"
            r="30"
            fill="none"
            stroke={isChallenge ? '#38BDF8' : '#FBBF24'}
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <circle
            cx="50"
            cy="70"
            r="22"
            fill="none"
            stroke={isChallenge ? '#BAE6FD' : '#FDE68A'}
            strokeWidth="0.9"
          />

          {/* 8-Pointed Magic Star */}
          <polygon
            points="50,36 56,60 80,66 56,72 50,96 44,72 20,66 44,60"
            fill={isChallenge ? '#0284C7' : '#D97706'}
            opacity="0.55"
          />
          <polygon
            points="50,42 54,61 73,66 54,71 50,90 46,71 27,66 46,61"
            fill={isChallenge ? '#7DD3FC' : '#FEF08A'}
          />

          {/* Open Education Book Icon in Center */}
          <path
            d="M41 62 C44 60, 48 61, 50 63 C52 61, 56 60, 59 62 L59 72 C56 70, 52 71, 50 73 C48 71, 44 70, 41 72 Z"
            fill="#0F172A"
          />
        </svg>

        {/* Top Header */}
        <span
          className={`relative z-10 text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${
            isChallenge ? 'text-cyan-200' : 'text-amber-200'
          }`}
        >
          TÂY ĐÔ EDU
        </span>

        {/* Bottom Slot Badge (Never leaks student identity!) */}
        <span
          className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black shadow-xs ${
            isChallenge
              ? 'bg-cyan-400 text-slate-950'
              : 'bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950'
          }`}
        >
          {isChallenge ? `THỬ THÁCH #${slotNumber}` : `THẺ #${String(slotNumber).padStart(2, '0')}`}
        </span>
      </div>
    </div>
  );
};

export const SecretCardGame: React.FC<SecretCardGameProps> = ({
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
  questions = [],
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
  // Play Modes: 1. Teacher Manual Pick, 2. System Auto Pick, 3. Dual-Deck Challenge
  const [playMode, setPlayMode] = useState<CardPlayMode>('MANUAL_PICK');

  // Strict State Machine: IDLE -> SHUFFLING -> SPREADING -> SELECTING -> FLIPPING -> REVEALING -> COMPLETED
  const [phase, setPhase] = useState<CardGamePhase>('IDLE');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // Session & Fisher-Yates Shuffled Student Cards
  const [sessionId, setSessionId] = useState<string>(() => `a10_sess_${Date.now().toString(36)}`);
  const [deck, setDeck] = useState<AssignedStudentCard[]>([]);

  // Active Card & Revealed Student (Only populated once FLIPPING finishes!)
  const [spotlightCardId, setSpotlightCardId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<AssignedStudentCard | null>(null);
  const [flipAngleY, setFlipAngleY] = useState<number>(0); // 0 -> 180 deg
  const [revealedStudent, setRevealedStudent] = useState<StudentCandidate | null>(null);

  // Mode 3: Challenge Deck B State
  const [challengeSource, setChallengeSource] = useState<ChallengeSourceType>('CUSTOM_CARDS');
  const [customChallenges, setCustomChallenges] = useState<CustomChallengeCardItem[]>(
    DEFAULT_CUSTOM_CHALLENGES
  );
  const [newChallengeTitle, setNewChallengeTitle] = useState<string>('');
  const [newChallengeDetail, setNewChallengeDetail] = useState<string>('');

  // Question Bank Filters for Mode 3
  const [qbGrade, setQbGrade] = useState<string>('all');
  const [qbSubject, setQbSubject] = useState<string>('all');
  const [qbChapter, setQbChapter] = useState<string>('all');
  const [qbLevel, setQbLevel] = useState<string>('all');
  const [revealedQuestion, setRevealedQuestion] = useState<Question | null>(null);
  const [revealedCustomChallenge, setRevealedCustomChallenge] =
    useState<CustomChallengeCardItem | null>(null);
  const [showQuestionAnswer, setShowQuestionAnswer] = useState<boolean>(false);

  // Pagination for Large Classes (up to 10 cards per page so cards stay large and legible)
  const CARDS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Independent Answer Timer (15s, 30s default, 60s, Custom)
  const [timerPreset, setTimerPreset] = useState<number>(30);
  const [customTimerInput, setCustomTimerInput] = useState<string>('45');
  const [isCustomTimer, setIsCustomTimer] = useState<boolean>(false);
  const [timerRemaining, setTimerRemaining] = useState<number>(30);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Bonus Points & Note + Supabase Sync
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [roundNote, setRoundNote] = useState<string>('');
  const [supabaseSyncState, setSupabaseSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string | null>(null);

  // Timers & Animation Refs
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const savedTurnIdsRef = useRef<Set<string>>(new Set());
  const currentTurnIdRef = useRef<string | null>(null);
  const pendingTargetCardRef = useRef<AssignedStudentCard | null>(null);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Present students in the class (excluding absent students)
  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((st) => !absentIds.has(st.id));
  }, [allCandidates, availableCandidates, absentIds]);

  const presentSignature = useMemo(
    () => presentStudents.map((s) => s.id).join('|'),
    [presentStudents]
  );

  // Build & Fisher-Yates Shuffle the Student Card Deck when session or class changes
  useEffect(() => {
    clearAllTimers();
    const shuffled = fisherYatesShuffle(presentStudents);
    const newDeck: AssignedStudentCard[] = shuffled.map((student, idx) => ({
      cardId: `${sessionId}_card_${idx + 1}_${student.id}`,
      slotNumber: idx + 1,
      student,
      accentIdx: idx % 4,
    }));
    setDeck(newDeck);
    setCurrentPage(1);
    setPhase('IDLE');
    setIsPaused(false);
    setSpotlightCardId(null);
    setActiveCard(null);
    setFlipAngleY(0);
    setRevealedStudent(null);
    setRevealedQuestion(null);
    setRevealedCustomChallenge(null);
    setShowQuestionAnswer(false);
    setSupabaseSyncState('idle');
    setSupabaseErrorMsg(null);
  }, [presentSignature, sessionId, clearAllTimers]);

  // Check if a card has already been opened in this session
  const isCardOpened = useCallback(
    (card: AssignedStudentCard): boolean => {
      if (!antiDuplicate) return false;
      return calledSessionIds.has(card.student.id);
    },
    [antiDuplicate, calledSessionIds]
  );

  // Eligible cards remaining across ALL pages
  const eligibleCards = useMemo(() => {
    return deck.filter((c) => !isCardOpened(c));
  }, [deck, isCardOpened]);

  const totalPages = Math.max(1, Math.ceil(deck.length / CARDS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageCards = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    return deck.slice(start, start + CARDS_PER_PAGE);
  }, [deck, currentPage]);

  // Filtered Question Bank for Mode 3 (Challenge Deck B)
  const availableChapters = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (qbGrade !== 'all' && q.grade !== qbGrade) return;
      if (qbSubject !== 'all' && q.subject !== qbSubject) return;
      if (q.chapter) set.add(q.chapter);
    });
    return Array.from(set);
  }, [questions, qbGrade, qbSubject]);

  const filteredBankQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (qbGrade !== 'all' && q.grade !== qbGrade) return false;
      if (qbSubject !== 'all' && q.subject !== qbSubject) return false;
      if (qbChapter !== 'all' && q.chapter !== qbChapter) return false;
      if (qbLevel !== 'all' && q.level !== qbLevel) return false;
      return true;
    });
  }, [questions, qbGrade, qbSubject, qbChapter, qbLevel]);

  // Independent Answer Countdown Timer
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          cardSound.playTimerBell(isMuted);
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
      slotNum: number,
      points: number,
      noteText: string,
      mode: CardPlayMode,
      forceRetry = false
    ) => {
      const turnId = currentTurnIdRef.current || `turn_${sessionId}_${student.id}_${slotNum}`;
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

        const formattedSlot = String(slotNum).padStart(2, '0');
        const detailsText = [
          `Trò chơi: A10 - Thẻ bài bí mật 3D`,
          `Lớp: ${resolvedClassName}`,
          `Thẻ: #${formattedSlot}`,
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
          action: 'EDU_GAME_A10_CARD_PICK',
          target: `A10 (${resolvedClassName}) - Thẻ #${formattedSlot} ${student.fullName}`,
          details: detailsText,
          actor_id: authUser.id,
          metadata: {
            game_id: 'A10',
            game_title: 'Thẻ bài bí mật 3D',
            session_id: sessionId,
            class_id: selectedSourceKey,
            class_name: resolvedClassName,
            student_id: student.id,
            student_code: student.code,
            student_name: student.fullName,
            card_slot: slotNum,
            play_mode: mode,
            reward_points: points,
            note: noteText.trim(),
            selected_at: new Date().toISOString(),
          },
        });

        if (error) throw error;

        savedTurnIdsRef.current.add(dedupeKey);
        setSupabaseSyncState('saved');
      } catch (err: any) {
        console.warn('A10 Supabase sync warning:', err);
        setSupabaseSyncState('error');
        setSupabaseErrorMsg(
          err?.message || 'Chưa đồng bộ được lên đám mây Supabase. Lịch sử tại máy vẫn được giữ an toàn.'
        );
      }
    },
    [resolvedClassName, selectedSourceKey, sessionId, teacherName, userRole]
  );

  // Execute 3D Flip & Reveal for a chosen card (SELECTING -> FLIPPING -> REVEALING -> COMPLETED)
  const executeCardFlipAndReveal = useCallback(
    (targetCard: AssignedStudentCard, modeUsed: CardPlayMode) => {
      try {
        pendingTargetCardRef.current = targetCard;

        // Navigate to the page containing targetCard if on another page
        const idxInDeck = deck.findIndex((c) => c.cardId === targetCard.cardId);
        if (idxInDeck >= 0) {
          const targetPage = Math.floor(idxInDeck / CARDS_PER_PAGE) + 1;
          setCurrentPage(targetPage);
        }

        // If in Mode 3 (Challenge Dual Deck), also pick a random Challenge Card from Deck B
        if (modeUsed === 'CHALLENGE_DUAL_DECK') {
          setShowQuestionAnswer(false);
          if (challengeSource === 'QUESTION_BANK') {
            if (filteredBankQuestions.length > 0) {
              const qIdx = secureRandomInt(filteredBankQuestions.length);
              setRevealedQuestion(filteredBankQuestions[qIdx]);
              setRevealedCustomChallenge(null);
            } else {
              setRevealedQuestion(null);
            }
          } else {
            if (customChallenges.length > 0) {
              const cIdx = secureRandomInt(customChallenges.length);
              setRevealedCustomChallenge(customChallenges[cIdx]);
              setRevealedQuestion(null);
            }
          }
        } else {
          setRevealedQuestion(null);
          setRevealedCustomChallenge(null);
        }

        setSpotlightCardId(targetCard.cardId);
        setActiveCard(targetCard);
        setFlipAngleY(0);
        setRevealedStudent(null);
        setPhase('SELECTING');
        cardSound.playCardRustle(isMuted);

        // Step 1: Card lifts and moves to center stage, begins 180° 3D Y-axis flip
        const t1 = window.setTimeout(() => {
          setPhase('FLIPPING');
          cardSound.playMagicFlip(isMuted);

          const flipDuration = reduceMotion ? 180 : 620;
          const startFlip = performance.now();

          const animateFlip = (now: number) => {
            const p = Math.min(Math.max((now - startFlip) / flipDuration, 0), 1);
            // Smooth cubic ease-in-out from 0 deg to 180 deg
            const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            const currentDeg = ease * 180;
            setFlipAngleY(currentDeg);

            if (p < 1) {
              rafRef.current = requestAnimationFrame(animateFlip);
            } else {
              rafRef.current = null;
              setFlipAngleY(180);
              // Only reveal student name AFTER 180° flip is 100% complete!
              setPhase('REVEALING');
              setRevealedStudent(targetCard.student);
              setBonusPoints(0);
              setRoundNote('');
              setTimerRunning(false);
              setTimerRemaining(timerPreset);
              cardSound.playRevealChime(isMuted);

              const t2 = window.setTimeout(() => {
                setPhase('COMPLETED');
                const turnId = `turn_${sessionId}_${Date.now()}_${targetCard.student.id}`;
                currentTurnIdRef.current = turnId;
                if (!savedTurnIdsRef.current.has(turnId)) {
                  savedTurnIdsRef.current.add(turnId);
                  onPick(targetCard.student, {
                    bonusPoints: 0,
                    note: '',
                    sessionId,
                  });
                  syncTurnToSupabase(
                    targetCard.student,
                    targetCard.slotNumber,
                    0,
                    '',
                    modeUsed
                  );
                }
              }, 260);
              timersRef.current.push(t2);
            }
          };

          rafRef.current = requestAnimationFrame(animateFlip);
        }, reduceMotion ? 120 : 380);

        timersRef.current.push(t1);
      } catch (err) {
        console.error('A10 flip recovery:', err);
        setPhase('IDLE');
      }
    },
    [
      challengeSource,
      customChallenges,
      deck,
      filteredBankQuestions,
      isMuted,
      onPick,
      reduceMotion,
      sessionId,
      syncTurnToSupabase,
      timerPreset,
    ]
  );

  // Mode 1: Teacher manually clicks a card on the magic table
  const handleManualCardClick = (card: AssignedStudentCard) => {
    if (phase !== 'IDLE' && phase !== 'COMPLETED') return;
    if (isCardOpened(card)) return;

    clearAllTimers();
    setIsPaused(false);
    executeCardFlipAndReveal(card, playMode);
  };

  // Standalone Shuffle Deck Animation (SHUFFLING -> SPREADING -> IDLE)
  const handleShuffleDeckOnly = () => {
    if (phase !== 'IDLE' && phase !== 'COMPLETED') return;
    if (presentStudents.length === 0) return;

    clearAllTimers();
    setActiveCard(null);
    setRevealedStudent(null);
    setSpotlightCardId(null);
    setFlipAngleY(0);
    setPhase('SHUFFLING');
    cardSound.playCardRustle(isMuted);

    // Shuffle uncalled students using Fisher-Yates
    const shuffled = fisherYatesShuffle(presentStudents);
    const newDeck: AssignedStudentCard[] = shuffled.map((student, idx) => ({
      cardId: `${sessionId}_card_${idx + 1}_${student.id}`,
      slotNumber: idx + 1,
      student,
      accentIdx: idx % 4,
    }));

    const t1 = window.setTimeout(() => {
      cardSound.playCardRustle(isMuted);
      setDeck(newDeck);
      setPhase('SPREADING');

      const t2 = window.setTimeout(() => {
        setPhase('IDLE');
      }, reduceMotion ? 150 : 420);
      timersRef.current.push(t2);
    }, reduceMotion ? 200 : 620);
    timersRef.current.push(t1);
  };

  // Mode 2 & Mode 3: Shuffle, Spread, Spotlight & Auto-Pick Eligible Card
  const handleSystemShuffleAndPick = () => {
    if (phase !== 'IDLE' && phase !== 'COMPLETED') return;
    if (eligibleCards.length === 0) return;

    clearAllTimers();
    setIsPaused(false);
    setActiveCard(null);
    setRevealedStudent(null);
    setSpotlightCardId(null);
    setFlipAngleY(0);

    // 1. Fair cryptographic selection from ALL eligible cards across the entire class
    const winnerIndex = secureRandomInt(eligibleCards.length);
    const winningCard = eligibleCards[winnerIndex];
    pendingTargetCardRef.current = winningCard;

    // 2. SHUFFLING -> SPREADING -> SELECTING -> FLIPPING -> REVEALING -> COMPLETED
    setPhase('SHUFFLING');
    cardSound.playCardRustle(isMuted);

    const tShuffle = window.setTimeout(() => {
      setPhase('SPREADING');
      cardSound.playCardRustle(isMuted);

      const tSpread = window.setTimeout(() => {
        setPhase('SELECTING');

        // Spotlight sweeps across cards before locking onto winningCard
        const pageEligible = pageCards.filter((c) => !isCardOpened(c));
        const sweepPool = pageEligible.length > 0 ? pageEligible : eligibleCards;
        const totalSteps = reduceMotion ? 2 : 7;
        let step = 0;

        const runSweep = () => {
          step++;
          if (step < totalSteps) {
            const randCard = sweepPool[secureRandomInt(sweepPool.length)];
            setSpotlightCardId(randCard.cardId);
            cardSound.playCardRustle(isMuted);
            const tid = window.setTimeout(runSweep, 95 + step * 20);
            timersRef.current.push(tid);
          } else {
            executeCardFlipAndReveal(
              winningCard,
              playMode === 'MANUAL_PICK' ? 'AUTO_PICK' : playMode
            );
          }
        };

        runSweep();
      }, reduceMotion ? 140 : 420);
      timersRef.current.push(tSpread);
    }, reduceMotion ? 180 : 560);
    timersRef.current.push(tShuffle);
  };

  // Safe Emergency Recovery if teacher wants to skip animation without changing chosen student
  const handleSafeCompleteNow = () => {
    const target = pendingTargetCardRef.current;
    if (!target) {
      clearAllTimers();
      setPhase('IDLE');
      return;
    }
    clearAllTimers();
    setActiveCard(target);
    setFlipAngleY(180);
    setRevealedStudent(target.student);
    setPhase('COMPLETED');
    const turnId = `turn_${sessionId}_${Date.now()}_${target.student.id}`;
    currentTurnIdRef.current = turnId;
    if (!savedTurnIdsRef.current.has(turnId)) {
      savedTurnIdsRef.current.add(turnId);
      onPick(target.student, { bonusPoints: 0, note: '', sessionId });
      syncTurnToSupabase(target.student, target.slotNumber, 0, '', playMode);
    }
  };

  // Reset Full Session
  const handleRefreshSession = () => {
    clearAllTimers();
    savedTurnIdsRef.current.clear();
    currentTurnIdRef.current = null;
    pendingTargetCardRef.current = null;
    setSessionId(`a10_sess_${Date.now().toString(36)}`);
    setPhase('IDLE');
    setIsPaused(false);
    setActiveCard(null);
    setRevealedStudent(null);
    setSpotlightCardId(null);
    setFlipAngleY(0);
    setBonusPoints(0);
    setRoundNote('');
    onResetSession?.();
  };

  // Save Bonus Points & Note
  const handleSaveScoreAndNote = () => {
    if (!revealedStudent || !activeCard) return;
    const combined = [
      `Thẻ #${String(activeCard.slotNumber).padStart(2, '0')}`,
      bonusPoints > 0 ? `+${bonusPoints} điểm thưởng` : '',
      roundNote.trim(),
    ]
      .filter(Boolean)
      .join(' - ');

    onUpdateLatestNote?.(combined);
    syncTurnToSupabase(
      revealedStudent,
      activeCard.slotNumber,
      bonusPoints,
      roundNote,
      playMode,
      true
    );
  };

  const isAnimating =
    phase === 'SHUFFLING' ||
    phase === 'SPREADING' ||
    phase === 'SELECTING' ||
    phase === 'FLIPPING' ||
    phase === 'REVEALING';

  const allCalled = presentStudents.length > 0 && eligibleCards.length === 0;
  const isSmallFanDeck = pageCards.length <= 7;

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* ===================================================================
          LEFT COLUMN (70-75% on Desktop): MAGIC CARD SHOW 3D STAGE
         =================================================================== */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between space-y-4">
        <div
          className={`relative w-full ${
            isFullscreen ? 'min-h-[75vh]' : 'min-h-[500px] sm:min-h-[560px]'
          } rounded-3xl border-4 border-amber-400/70 shadow-2xl overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#0A1128] via-[#1C1136] to-[#090D1E]`}
        >
          {/* 1. MAGIC CARD SHOW TABLE & AMBIENT STAGE LIGHTING */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Stage Spotlights */}
            <div className="absolute -top-24 left-1/4 w-96 h-64 bg-purple-500/25 rounded-full blur-3xl" />
            <div className="absolute -top-24 right-1/4 w-96 h-64 bg-cyan-400/20 rounded-full blur-3xl" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[280px] bg-amber-400/15 rounded-full blur-3xl" />

            {/* Velvet Magician Table Surface with Glowing Gold & Cyan Trim */}
            <div
              className="absolute inset-x-5 sm:inset-x-10 top-24 bottom-14 rounded-[44px] border-2 border-amber-300/45 bg-gradient-to-b from-[#1E1B4B]/85 via-[#172554]/90 to-[#0F172A]/95 shadow-[0_0_50px_rgba(245,158,11,0.18),inset_0_0_45px_rgba(0,0,0,0.65)]"
              style={{ transform: 'perspective(1000px) rotateX(10deg)' }}
            >
              <div className="absolute inset-3 rounded-[36px] border border-dashed border-cyan-300/30" />
            </div>
          </div>

          {/* 2. TOP STAGE HEADER: 3 Modes Switcher & Remaining Counter */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2 sm:px-6">
            <div className="bg-slate-950/85 backdrop-blur-xs p-1 rounded-2xl border border-amber-400/40 flex flex-wrap items-center gap-1 shadow-lg">
              <button
                type="button"
                disabled={isAnimating}
                onClick={() => {
                  setPlayMode('MANUAL_PICK');
                  setActiveCard(null);
                  setRevealedStudent(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  playMode === 'MANUAL_PICK'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-xs'
                    : 'text-amber-100 hover:bg-white/10'
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span>1. GV chọn thẻ</span>
              </button>

              <button
                type="button"
                disabled={isAnimating}
                onClick={() => {
                  setPlayMode('AUTO_PICK');
                  setActiveCard(null);
                  setRevealedStudent(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  playMode === 'AUTO_PICK'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-xs'
                    : 'text-amber-100 hover:bg-white/10'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>2. Máy chọn thẻ may mắn</span>
              </button>

              <button
                type="button"
                disabled={isAnimating}
                onClick={() => {
                  setPlayMode('CHALLENGE_DUAL_DECK');
                  setActiveCard(null);
                  setRevealedStudent(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  playMode === 'CHALLENGE_DUAL_DECK'
                    ? 'bg-gradient-to-r from-cyan-400 to-sky-300 text-slate-950 shadow-xs'
                    : 'text-amber-100 hover:bg-white/10'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>3. Thẻ bài thử thách (Bộ A + B)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isAnimating || presentStudents.length === 0}
                onClick={handleShuffleDeckOnly}
                className="px-3.5 py-1.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/60 text-amber-200 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Xáo bài 3D</span>
              </button>

              <div className="px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-cyan-400/40 text-xs font-extrabold text-cyan-200 tabular-nums">
                Còn <span className="text-amber-300 font-black">{eligibleCards.length}</span> /{' '}
                {presentStudents.length} thẻ
              </div>
            </div>
          </div>

          {/* 3. MODE 3 FILTER BAR (Question Bank vs Custom Challenge Deck B) */}
          {playMode === 'CHALLENGE_DUAL_DECK' && (
            <div className="relative z-20 mx-4 sm:mx-6 px-4 py-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-cyan-400/40 flex flex-wrap items-center justify-between gap-2 text-xs text-white">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-cyan-300">Bộ B (Thẻ thử thách):</span>
                <button
                  type="button"
                  onClick={() => setChallengeSource('CUSTOM_CARDS')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    challengeSource === 'CUSTOM_CARDS'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-white/10 text-slate-200 hover:bg-white/15'
                  }`}
                >
                  Thẻ nhiệm vụ & điểm thưởng ({customChallenges.length})
                </button>
                <button
                  type="button"
                  onClick={() => setChallengeSource('QUESTION_BANK')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    challengeSource === 'QUESTION_BANK'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-white/10 text-slate-200 hover:bg-white/15'
                  }`}
                >
                  Ngân hàng câu hỏi ({filteredBankQuestions.length} câu)
                </button>
              </div>

              {challengeSource === 'QUESTION_BANK' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={qbGrade}
                    onChange={(e) => {
                      setQbGrade(e.target.value);
                      setQbChapter('all');
                    }}
                    className="bg-slate-900 border border-cyan-400/40 rounded-lg px-2 py-1 text-[11px] font-bold text-cyan-200"
                  >
                    <option value="all">Tất cả khối</option>
                    <option value="6">Khối 6</option>
                    <option value="7">Khối 7</option>
                    <option value="8">Khối 8</option>
                    <option value="9">Khối 9</option>
                  </select>

                  <select
                    value={qbSubject}
                    onChange={(e) => {
                      setQbSubject(e.target.value);
                      setQbChapter('all');
                    }}
                    className="bg-slate-900 border border-cyan-400/40 rounded-lg px-2 py-1 text-[11px] font-bold text-cyan-200"
                  >
                    <option value="all">Tất cả môn</option>
                    <option value="math">Toán</option>
                    <option value="science">KHTN</option>
                    <option value="informatics">Tin học</option>
                  </select>

                  <select
                    value={qbChapter}
                    onChange={(e) => setQbChapter(e.target.value)}
                    className="bg-slate-900 border border-cyan-400/40 rounded-lg px-2 py-1 text-[11px] font-bold text-cyan-200 max-w-[140px] truncate"
                  >
                    <option value="all">Tất cả chương</option>
                    {availableChapters.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>

                  <select
                    value={qbLevel}
                    onChange={(e) => setQbLevel(e.target.value)}
                    className="bg-slate-900 border border-cyan-400/40 rounded-lg px-2 py-1 text-[11px] font-bold text-cyan-200"
                  >
                    <option value="all">Mọi mức độ</option>
                    <option value="know">Nhận biết</option>
                    <option value="understand">Thông hiểu</option>
                    <option value="apply">Vận dụng</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 4. CENTER MAGIC CARD ARENA */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-3 sm:px-8">
            {presentStudents.length === 0 ? (
              <div className="bg-white/95 rounded-3xl p-8 text-center max-w-md shadow-2xl space-y-3">
                <Users className="w-12 h-12 text-indigo-600 mx-auto" />
                <h3 className="text-lg font-black text-[#0F2D52]">Lớp chưa có học sinh có mặt</h3>
                <p className="text-xs text-slate-600">
                  Vui lòng chọn lớp học khác hoặc kiểm tra lại danh sách học sinh vắng mặt.
                </p>
              </div>
            ) : allCalled && !isAnimating && !activeCard ? (
              <div className="bg-white/95 rounded-3xl p-8 text-center max-w-lg shadow-2xl border-4 border-amber-400 space-y-4 animate-fadeIn">
                <Trophy className="w-14 h-14 text-amber-500 mx-auto" />
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase">
                  HOÀN THÀNH PHIÊN GỌI
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-[#0F2D52]">
                  ĐÃ GỌI HẾT LỚP ({presentStudents.length} HỌC SINH)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Tất cả các thẻ bài trong phiên này đã được lật mở. Nhấn Làm mới phiên để xáo bộ bài mới!
                </p>
                <button
                  type="button"
                  onClick={handleRefreshSession}
                  className="px-6 py-3 bg-[#006BFF] hover:bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>XÁO BÀI & LÀM MỚI PHIÊN</span>
                </button>
              </div>
            ) : (
              /* Card Spread Grid or Fan Layout */
              <div
                className={`w-full my-auto transition-all duration-500 ${
                  phase === 'SHUFFLING'
                    ? 'scale-75 opacity-80'
                    : 'scale-100 opacity-100'
                } ${
                  isSmallFanDeck
                    ? 'flex flex-wrap items-center justify-center gap-3 sm:gap-5 max-w-4xl'
                    : 'grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 max-w-4xl mx-auto justify-items-center'
                }`}
                style={{ perspective: '1100px' }}
              >
                {pageCards.map((card, idx) => {
                  const opened = isCardOpened(card);
                  const isSpotlit = spotlightCardId === card.cardId;
                  // Subtle fan angle when class/page has <= 7 cards
                  const midIdx = (pageCards.length - 1) / 2;
                  const fanDeg = isSmallFanDeck && phase === 'IDLE' ? (idx - midIdx) * 4.5 : 0;
                  const fanLift =
                    isSmallFanDeck && phase === 'IDLE' ? Math.abs(idx - midIdx) * 4 : 0;
                  const shuffleOffset =
                    phase === 'SHUFFLING'
                      ? (idx % 2 === 0 ? -1 : 1) * (20 + (idx % 3) * 14)
                      : 0;

                  return (
                    <button
                      key={card.cardId}
                      type="button"
                      disabled={isAnimating || opened}
                      onClick={() => handleManualCardClick(card)}
                      className={`group relative w-28 h-40 sm:w-32 sm:h-44 rounded-2xl transition-all duration-300 focus:outline-none ${
                        opened
                          ? 'opacity-40 cursor-not-allowed'
                          : isAnimating
                          ? 'cursor-wait'
                          : 'cursor-pointer hover:-translate-y-3 hover:scale-105 hover:z-20'
                      }`}
                      style={{
                        transformStyle: 'preserve-3d',
                        transform:
                          phase === 'SHUFFLING'
                            ? `translate3d(${shuffleOffset}px, 0px, 0px) rotateZ(${
                                idx % 2 === 0 ? -8 : 8
                              }deg)`
                            : `translateY(${fanLift}px) rotateZ(${fanDeg}deg)`,
                      }}
                    >
                      <MysteryCardBackArtwork
                        slotNumber={card.slotNumber}
                        variant="student"
                        isHighlighted={isSpotlit}
                      />

                      {opened && (
                        <div className="absolute inset-0 rounded-2xl bg-slate-950/70 backdrop-blur-2xs flex flex-col items-center justify-center p-2 text-white">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-1" />
                          <span className="text-[10px] font-black uppercase text-emerald-300">
                            Đã mở
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 5. CENTER STAGE 3D 180° CARD FLIP & REVEAL MODAL OVERLAY */}
            {activeCard &&
              (phase === 'SELECTING' ||
                phase === 'FLIPPING' ||
                phase === 'REVEALING' ||
                phase === 'COMPLETED') && (
                <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 sm:p-6 animate-fadeIn">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-10 max-w-4xl w-full">
                    {/* DECK A: 3D Flipping Student Card (preserve-3d + backface-visibility: hidden) */}
                    <div
                      className="relative w-56 h-80 sm:w-64 sm:h-92 shrink-0"
                      style={{ perspective: '1200px' }}
                    >
                      <div
                        className="w-full h-full relative shadow-[0_20px_60px_rgba(250,204,21,0.35)] rounded-3xl"
                        style={{
                          transformStyle: 'preserve-3d',
                          transform: `rotateY(${flipAngleY}deg)`,
                        }}
                      >
                        {/* Back Face (0 deg) */}
                        <div
                          className="absolute inset-0 rounded-3xl"
                          style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                          }}
                        >
                          <MysteryCardBackArtwork
                            slotNumber={activeCard.slotNumber}
                            variant="student"
                            isHighlighted={true}
                          />
                        </div>

                        {/* Front Face (180 deg) - Student identity only rendered once flip reaches >= 90 deg */}
                        <div
                          className="absolute inset-0 rounded-3xl border-4 border-amber-300 bg-gradient-to-b from-amber-200 via-yellow-50 to-white p-5 flex flex-col items-center justify-between text-center shadow-2xl"
                          style={{
                            transform: 'rotateY(180deg)',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                          }}
                        >
                          <div className="w-full flex items-center justify-between text-[11px] font-black text-amber-800 uppercase">
                            <span>THẺ #{String(activeCard.slotNumber).padStart(2, '0')}</span>
                            <span>TÂY ĐÔ EDU</span>
                          </div>

                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg border-2 border-white">
                            <Trophy className="w-8 h-8" />
                          </div>

                          {revealedStudent ? (
                            <div className="space-y-1.5 my-auto">
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                                HỌC SINH ĐƯỢC CHỌN
                              </span>
                              <h3 className="text-xl sm:text-2xl font-black text-[#0F2D52] leading-snug break-words">
                                {revealedStudent.fullName}
                              </h3>
                              <p className="text-xs font-extrabold text-slate-600">
                                Mã HS: {revealedStudent.code}
                              </p>
                              <p className="text-[11px] font-bold text-[#006BFF]">
                                Lớp: {resolvedClassName}
                              </p>
                            </div>
                          ) : (
                            <div className="my-auto text-xs font-bold text-slate-400">
                              Đang mở thẻ...
                            </div>
                          )}

                          <div className="w-full pt-2 border-t border-amber-200 flex items-center justify-center gap-1 text-[10px] font-extrabold text-emerald-700">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Chúc mừng bạn!</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DECK B: Challenge Card (When in Mode 3 CHALLENGE_DUAL_DECK) */}
                    {playMode === 'CHALLENGE_DUAL_DECK' && revealedStudent && (
                      <div className="flex-1 max-w-md w-full bg-gradient-to-b from-slate-900 to-indigo-950 rounded-3xl border-2 border-cyan-400 p-5 text-white shadow-2xl space-y-3 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-xs font-black uppercase">
                            BỘ B · THẺ THỬ THÁCH
                          </span>
                          <span className="text-[11px] text-cyan-200 font-bold">
                            {challengeSource === 'QUESTION_BANK'
                              ? 'Từ Ngân hàng câu hỏi'
                              : 'Thẻ nhiệm vụ & thưởng'}
                          </span>
                        </div>

                        {challengeSource === 'QUESTION_BANK' ? (
                          revealedQuestion ? (
                            <div className="space-y-3 text-left">
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                                <span className="px-2 py-0.5 rounded bg-blue-500/30 text-sky-200">
                                  Mã: {revealedQuestion.code}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-purple-500/30 text-purple-200">
                                  Khối {revealedQuestion.grade} · {revealedQuestion.chapter}
                                </span>
                              </div>
                              <p className="text-sm sm:text-base font-bold text-white leading-relaxed bg-white/10 p-3.5 rounded-2xl border border-white/15">
                                {revealedQuestion.stem}
                              </p>

                              {revealedQuestion.options && revealedQuestion.options.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                                  {revealedQuestion.options.map((opt) => (
                                    <div
                                      key={opt.id}
                                      className={`px-3 py-1.5 rounded-xl border ${
                                        showQuestionAnswer &&
                                        revealedQuestion.correctAnswer === opt.label
                                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 font-extrabold'
                                          : 'bg-white/5 border-white/10 text-slate-200'
                                      }`}
                                    >
                                      <strong>{opt.label}.</strong> {opt.text}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => setShowQuestionAnswer((v) => !v)}
                                className="px-3.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/50 text-amber-200 text-xs font-extrabold flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>
                                  {showQuestionAnswer ? 'Ẩn đáp án / gợi ý' : 'Xem đáp án / gợi ý'}
                                </span>
                              </button>

                              {showQuestionAnswer && (
                                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-400/50 text-xs text-emerald-100 space-y-1">
                                  {revealedQuestion.correctAnswer && (
                                    <p className="font-extrabold text-emerald-300">
                                      Đáp án đúng: {revealedQuestion.correctAnswer}
                                    </p>
                                  )}
                                  {revealedQuestion.explanation && (
                                    <p>{revealedQuestion.explanation}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-xs text-amber-200 space-y-1">
                              <p className="font-extrabold">
                                Chưa có câu hỏi khớp bộ lọc hiện tại
                              </p>
                              <p>
                                Vui lòng chọn lại Khối/Môn/Chương ở thanh bộ lọc phía trên hoặc chuyển sang chế độ Thẻ nhiệm vụ & điểm thưởng.
                              </p>
                            </div>
                          )
                        ) : revealedCustomChallenge ? (
                          <div className="p-4 rounded-2xl bg-white/10 border border-cyan-300/30 space-y-2 text-left">
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black">
                              {revealedCustomChallenge.badge}
                            </span>
                            <h4 className="text-base sm:text-lg font-black text-white">
                              {revealedCustomChallenge.title}
                            </h4>
                            <p className="text-xs sm:text-sm text-cyan-100 leading-relaxed">
                              {revealedCustomChallenge.detail}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Next Turn Actions right beneath the 3D Flipped Card */}
                  {phase === 'COMPLETED' && (
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                      {eligibleCards.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={handleSystemShuffleAndPick}
                            className="px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 rounded-2xl text-xs sm:text-sm font-black shadow-xl flex items-center gap-2 cursor-pointer"
                          >
                            <Wand2 className="w-4 h-4" />
                            <span>CHỌN THẺ TIẾP (NGẪU NHIÊN) ➔</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveCard(null);
                              setPhase('IDLE');
                            }}
                            className="px-5 py-3 bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer"
                          >
                            <Hand className="w-4 h-4 text-amber-300" />
                            <span>Trở lại bàn bài để tự chọn thẻ tiếp</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRefreshSession}
                          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs sm:text-sm font-black shadow-xl flex items-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>ĐÃ GỌI HẾT LỚP · LÀM MỚI PHIÊN</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* 6. BOTTOM STAGE BAR: Pagination & State Indicator */}
          <div className="relative z-20 px-4 py-3 sm:px-6 bg-slate-950/80 backdrop-blur-xs border-t border-amber-400/25 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100">
            <div className="flex items-center gap-2 font-bold">
              <span>Trạng thái bàn bài:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 font-extrabold">
                {phase}
              </span>
              {isAnimating && (
                <button
                  type="button"
                  onClick={handleSafeCompleteNow}
                  className="text-[11px] text-cyan-300 underline hover:text-cyan-200 ml-2"
                >
                  Mở nhanh
                </button>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/20">
                <button
                  type="button"
                  disabled={currentPage <= 1 || isAnimating}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-full hover:bg-white/20 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pNum = i + 1;
                    const start = i * CARDS_PER_PAGE;
                    const slice = deck.slice(start, start + CARDS_PER_PAGE);
                    const remainingOnPage = slice.filter((c) => !isCardOpened(c)).length;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        disabled={isAnimating}
                        onClick={() => setCurrentPage(pNum)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-all tabular-nums ${
                          currentPage === pNum
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-white/80 hover:bg-white/15'
                        }`}
                      >
                        Bàn {pNum} ({remainingOnPage})
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages || isAnimating}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded-full hover:bg-white/20 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PRIMARY STAGE CONTROL BAR RIGHT BENEATH THE MAGIC TABLE */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <button
            type="button"
            disabled={isAnimating || eligibleCards.length === 0}
            onClick={handleSystemShuffleAndPick}
            className="sm:col-span-6 py-4 px-6 bg-gradient-to-r from-purple-600 via-[#006BFF] to-amber-500 hover:opacity-95 text-white rounded-2xl text-base sm:text-lg font-black shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
          >
            <Layers className={`w-6 h-6 ${isAnimating ? 'animate-spin' : ''}`} />
            <span>
              {allCalled
                ? 'ĐÃ GỌI HẾT LỚP'
                : isAnimating
                ? '🃏 ĐANG XÁO & LẬT THẺ 3D...'
                : phase === 'COMPLETED' || revealedStudent
                ? '🃏 CHỌN THẺ TIẾP ➔'
                : '🃏 XÁO VÀ CHỌN THẺ ➔'}
            </span>
          </button>

          <button
            type="button"
            disabled={isAnimating || presentStudents.length === 0}
            onClick={handleShuffleDeckOnly}
            className="sm:col-span-3 py-4 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-2xl text-xs sm:text-sm font-extrabold shadow-xs transition-all disabled:opacity-45 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shuffle className="w-4 h-4 text-amber-700" />
            <span>TRÁO BÀI</span>
          </button>

          <button
            type="button"
            disabled={isAnimating}
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
                Lớp & Cấu hình thẻ
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
                disabled={isAnimating}
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
                disabled={isAnimating}
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
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isFullscreen ? 'Thu nhỏ' : 'Full màn hình'}</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Result Panel (Never reveals student identity before 3D flip finishes!) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-[#0F2D52] uppercase tracking-wider">
                Kết quả mở thẻ
              </h4>
              <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                Đã mở: {calledSessionIds.size}/{presentStudents.length}
              </span>
            </div>

            {isAnimating ? (
              <div className="py-6 px-3 bg-purple-50 border border-purple-200 rounded-xl text-center space-y-2 animate-pulse">
                <Layers className="w-8 h-8 text-purple-600 mx-auto animate-spin" />
                <p className="text-xs font-extrabold text-[#0F2D52]">
                  Đang thực hiện ảo thuật thẻ bài ({phase})...
                </p>
                <p className="text-[11px] text-slate-500">
                  Danh tính học sinh sẽ xuất hiện sau khi thẻ lật đủ 180°.
                </p>
              </div>
            ) : revealedStudent && activeCard ? (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                      🃏 Thẻ #{String(activeCard.slotNumber).padStart(2, '0')} đã mở
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
                      <Award className="w-3.5 h-3.5 text-amber-500" /> Điểm thưởng & Ghi chú
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
                    placeholder="Ghi chú câu trả lời..."
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
                          syncTurnToSupabase(
                            revealedStudent,
                            activeCard.slotNumber,
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
              <div className="py-5 px-3 text-center text-slate-400 space-y-1.5">
                <Layers className="w-9 h-9 mx-auto opacity-35" />
                <p className="text-xs font-bold text-slate-500">Chưa lật thẻ nào</p>
                <p className="text-[11px]">
                  Nhấp vào một thẻ trên bàn hoặc bấm nút <strong>XÁO VÀ CHỌN THẺ</strong>.
                </p>
              </div>
            )}
          </div>

          {/* 3. Custom Challenge Cards Quick Editor (When Mode 3 + CUSTOM_CARDS is active) */}
          {playMode === 'CHALLENGE_DUAL_DECK' && challengeSource === 'CUSTOM_CARDS' && (
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 space-y-2 shadow-2xs">
              <span className="text-[11px] font-extrabold text-[#0F2D52] uppercase tracking-wider block">
                Thêm thẻ thử thách Bộ B ({customChallenges.length})
              </span>
              <input
                type="text"
                value={newChallengeTitle}
                onChange={(e) => setNewChallengeTitle(e.target.value)}
                placeholder="Tiêu đề thẻ (VD: +3 điểm thưởng)..."
                className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newChallengeDetail}
                  onChange={(e) => setNewChallengeDetail(e.target.value)}
                  placeholder="Nội dung chi tiết..."
                  className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newChallengeTitle.trim()) return;
                    setCustomChallenges((prev) => [
                      {
                        id: `cc_${Date.now()}`,
                        category: 'task',
                        badge: 'Thử thách mới',
                        title: newChallengeTitle.trim(),
                        detail:
                          newChallengeDetail.trim() ||
                          'Hoàn thành nhiệm vụ do giáo viên giao.',
                      },
                      ...prev,
                    ]);
                    setNewChallengeTitle('');
                    setNewChallengeDetail('');
                  }}
                  className="p-1.5 bg-[#006BFF] text-white rounded-lg hover:bg-blue-600"
                  title="Thêm thẻ thử thách"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 4. Independent Answer Countdown Timer */}
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
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-bold">
          <span>Mã trò chơi: A10</span>
          <span>Xáo bài: Fisher–Yates 1/{eligibleCards.length || 1}</span>
        </div>
      </div>
    </div>
  );
};
