import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question, Grade, CognitiveLevel } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Zap,
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
  History,
  RefreshCw,
  BookOpen,
  Settings,
  Shield,
  Flame,
  Star,
  SkipForward,
  Undo2,
  Download,
  Wifi,
  UserCheck,
  Shuffle,
  Plus,
  Minus,
  Eye,
  Bell,
  Sparkles,
} from 'lucide-react';

export type SpeedGameState =
  | 'SETUP'
  | 'READY'
  | 'QUESTION_DISPLAYED'
  | 'BUZZER_OPEN'
  | 'BUZZED'
  | 'ANSWERING'
  | 'JUDGING'
  | 'SCORED'
  | 'NEXT_QUESTION'
  | 'FINISHED';

export type SpeedCompetitionMode = 'INDIVIDUAL' | 'TEAM' | 'ONLINE_ROOM';

export interface SpeedContender {
  id: string;
  name: string;
  shortLabel: string;
  colorHex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeIcon: 'bolt' | 'shield' | 'flame' | 'star';
  members: StudentCandidate[];
  score: number;
  correctCount: number;
  wrongCount: number;
  shortcutKey: string; // '1'..'8'
  lastReactionMs?: number | null;
}

export interface ScoringLogEntry {
  id: string;
  questionIndex: number;
  questionCode: string;
  contenderId: string;
  contenderName: string;
  outcome: 'correct' | 'wrong' | 'manual_adjust' | 'skipped';
  pointsDelta: number;
  reason?: string;
  timestamp: string;
}

export interface SpeedChallengeGameProps {
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

const TEAM_PRESETS: Array<{
  defaultName: string;
  colorHex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeIcon: 'bolt' | 'shield' | 'flame' | 'star';
}> = [
  {
    defaultName: 'Đội Tia Chớp Xanh',
    colorHex: '#006BFF',
    bgClass: 'from-blue-600 to-cyan-500',
    borderClass: 'border-cyan-400',
    textClass: 'text-cyan-300',
    badgeIcon: 'bolt',
  },
  {
    defaultName: 'Đội Khiên Vàng',
    colorHex: '#D97706',
    bgClass: 'from-amber-500 to-orange-500',
    borderClass: 'border-amber-400',
    textClass: 'text-amber-300',
    badgeIcon: 'shield',
  },
  {
    defaultName: 'Đội Phượng Hoàng Đỏ',
    colorHex: '#E11D48',
    bgClass: 'from-rose-600 to-pink-500',
    borderClass: 'border-rose-400',
    textClass: 'text-rose-300',
    badgeIcon: 'flame',
  },
  {
    defaultName: 'Đội Sao Băng Tím',
    colorHex: '#7C3AED',
    bgClass: 'from-purple-600 to-indigo-500',
    borderClass: 'border-purple-400',
    textClass: 'text-purple-300',
    badgeIcon: 'star',
  },
];

const FALLBACK_WARMUP_QUESTIONS: Question[] = [
  {
    id: 'b01_fb_1',
    code: 'B01-KD-01',
    grade: '8',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Khởi động tư duy',
    lesson: 'Phản xạ Toán học',
    level: 'know',
    type: 'single_choice',
    stem: 'Giá trị của biểu thức (x + y)² tại x = 7 và y = 3 bằng bao nhiêu?',
    points: 10,
    explanation: 'Ta có (x + y)² = (7 + 3)² = 10² = 100.',
    status: 'approved',
    author: 'Tây Đô Smart EDU',
    version: 1,
    options: [
      { id: 'o1', label: 'A', text: '58' },
      { id: 'o2', label: 'B', text: '100' },
      { id: 'o3', label: 'C', text: '49' },
      { id: 'o4', label: 'D', text: '20' },
    ],
    correctAnswer: 'B',
  },
  {
    id: 'b01_fb_2',
    code: 'B01-KD-02',
    grade: '8',
    subject: 'science',
    textbook: 'Kết nối tri thức',
    chapter: 'Khởi động KHTN',
    lesson: 'Kiến thức chung',
    level: 'know',
    type: 'single_choice',
    stem: 'Khí nào chiếm tỉ lệ thể tích lớn nhất trong bầu khí quyển Trái Đất?',
    points: 10,
    explanation: 'Khí Nitơ (N₂) chiếm khoảng 78% thể tích không khí.',
    status: 'approved',
    author: 'Tây Đô Smart EDU',
    version: 1,
    options: [
      { id: 'o1', label: 'A', text: 'Oxygen (O₂)' },
      { id: 'o2', label: 'B', text: 'Carbon dioxide (CO₂)' },
      { id: 'o3', label: 'C', text: 'Nitrogen (N₂)' },
      { id: 'o4', label: 'D', text: 'Hydrogen (H₂)' },
    ],
    correctAnswer: 'C',
  },
  {
    id: 'b01_fb_3',
    code: 'B01-KD-03',
    grade: '8',
    subject: 'informatics',
    textbook: 'Kết nối tri thức',
    chapter: 'Khởi động Tin học',
    lesson: 'Tư duy thuật toán',
    level: 'understand',
    type: 'single_choice',
    stem: 'Đơn vị đo dung lượng thông tin nào sau đây lớn nhất?',
    points: 10,
    explanation: 'Thứ tự tăng dần: Byte < KB < MB < GB < TB.',
    status: 'approved',
    author: 'Tây Đô Smart EDU',
    version: 1,
    options: [
      { id: 'o1', label: 'A', text: 'Megabyte (MB)' },
      { id: 'o2', label: 'B', text: 'Kilobyte (KB)' },
      { id: 'o3', label: 'C', text: 'Terabyte (TB)' },
      { id: 'o4', label: 'D', text: 'Gigabyte (GB)' },
    ],
    correctAnswer: 'C',
  },
  {
    id: 'b01_fb_4',
    code: 'B01-KD-04',
    grade: '8',
    subject: 'history_geo',
    textbook: 'Kết nối tri thức',
    chapter: 'Địa lí Việt Nam',
    lesson: 'Vị trí địa lí',
    level: 'know',
    type: 'single_choice',
    stem: 'Thành phố Cần Thơ nằm bên bờ con sông lớn nào của vùng Đồng bằng sông Cửu Long?',
    points: 10,
    explanation: 'Thành phố Cần Thơ nằm bên bờ sông Hậu (Hậu Giang).',
    status: 'approved',
    author: 'Tây Đô Smart EDU',
    version: 1,
    options: [
      { id: 'o1', label: 'A', text: 'Sông Tiền' },
      { id: 'o2', label: 'B', text: 'Sông Hậu' },
      { id: 'o3', label: 'C', text: 'Sông Đồng Nai' },
      { id: 'o4', label: 'D', text: 'Sông Hồng' },
    ],
    correctAnswer: 'B',
  },
  {
    id: 'b01_fb_5',
    code: 'B01-KD-05',
    grade: '8',
    subject: 'english',
    textbook: 'Kết nối tri thức',
    chapter: 'Vocabulary Warm-up',
    lesson: 'School & Science',
    level: 'know',
    type: 'single_choice',
    stem: 'Choose the correct word: "Students conduct experiments in the school ___________."',
    points: 10,
    explanation: 'Laboratory (phòng thí nghiệm) là nơi thực hiện thí nghiệm khoa học.',
    status: 'approved',
    author: 'Tây Đô Smart EDU',
    version: 1,
    options: [
      { id: 'o1', label: 'A', text: 'canteen' },
      { id: 'o2', label: 'B', text: 'laboratory' },
      { id: 'o3', label: 'C', text: 'playground' },
      { id: 'o4', label: 'D', text: 'library' },
    ],
    correctAnswer: 'B',
  },
];

/**
 * Unbiased cryptographic random integer in [0, max - 1].
 */
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

/**
 * Sound Synthesizer for B01 – Ai Nhanh Hơn (Game Show Buzzer, Countdown, Correct/Wrong, Victory)
 */
class SpeedShowSoundEngine {
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

  public playStartShow(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + i * 0.07;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.24);
      });
    } catch {}
  }

  public playBuzzerHit(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(784, ctx.currentTime);
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.34);
    } catch {}
  }

  public playCorrect(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = ctx.currentTime + i * 0.08;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.11, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    } catch {}
  }

  public playWrong(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const notes = [311.13, 277.18];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const start = ctx.currentTime + i * 0.16;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.27);
      });
    } catch {}
  }

  public playTimeUp(isMuted: boolean) {
    if (isMuted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.46);
    } catch {}
  }
}

export const SpeedChallengeGame: React.FC<SpeedChallengeGameProps> = ({
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
  // Primary State Machine: SETUP -> READY -> QUESTION_DISPLAYED -> BUZZER_OPEN -> BUZZED -> ANSWERING -> JUDGING -> SCORED -> NEXT_QUESTION -> FINISHED
  const [gameState, setGameState] = useState<SpeedGameState>('SETUP');
  const [competitionMode, setCompetitionMode] = useState<SpeedCompetitionMode>('TEAM');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Question Bank Filters
  const [filterGrade, setFilterGrade] = useState<string>('ALL');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterChapter, setFilterChapter] = useState<string>('ALL');
  const [filterLesson, setFilterLesson] = useState<string>('ALL');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [desiredQuestionCount, setDesiredQuestionCount] = useState<number>(10);

  // Timing & Scoring Rules Configuration
  const [buzzerWindowSec, setBuzzerWindowSec] = useState<number>(15);
  const [answerWindowSec, setAnswerWindowSec] = useState<number>(30);
  const [pointsCorrect, setPointsCorrect] = useState<number>(10);
  const [enableWrongPenalty, setEnableWrongPenalty] = useState<boolean>(false);
  const [pointsWrongPenalty, setPointsWrongPenalty] = useState<number>(5);
  const [allowStealOnWrong, setAllowStealOnWrong] = useState<boolean>(true);

  // Mode 1 (Individual 2-8 students) selection state
  const [selectedIndividualIds, setSelectedIndividualIds] = useState<string[]>([]);

  // Mode 2 (Team 2-4 teams) configuration state
  const [teamCount, setTeamCount] = useState<number>(4);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>([
    TEAM_PRESETS[0].defaultName,
    TEAM_PRESETS[1].defaultName,
    TEAM_PRESETS[2].defaultName,
    TEAM_PRESETS[3].defaultName,
  ]);
  const [manualTeamMap, setManualTeamMap] = useState<Record<string, number>>({});

  // Mode 3 (Online Room Beta) state
  const [roomCode] = useState<string>(() => `B01-${Math.floor(1000 + Math.random() * 9000)}`);
  const [onlineBuzzerQueue, setOnlineBuzzerQueue] = useState<
    Array<{ contenderId: string; contenderName: string; receivedAt: string }>
  >([]);

  // Active Match Runtime State
  const [sessionId] = useState<string>(() => `B01_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const [contenders, setContenders] = useState<SpeedContender[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);

  // Two Independent Timers
  const [buzzerTimeLeft, setBuzzerTimeLeft] = useState<number>(15);
  const [answerTimeLeft, setAnswerTimeLeft] = useState<number>(30);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);

  // Active Buzzer Winner & Locked Contenders for current question
  const [activeBuzzerContenderId, setActiveBuzzerContenderId] = useState<string | null>(null);
  const [lockedOutContenderIds, setLockedOutContenderIds] = useState<Set<string>>(new Set());
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string>('');
  const [revealCorrectAnswer, setRevealCorrectAnswer] = useState<boolean>(false);
  const [lastJudgmentBanner, setLastJudgmentBanner] = useState<{
    type: 'correct' | 'wrong' | 'timeout' | 'skipped';
    message: string;
  } | null>(null);

  // Manual Score Adjustment & Undo Stack
  const [scoringLogs, setScoringLogs] = useState<ScoringLogEntry[]>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    contenders: SpeedContender[];
    gameState: SpeedGameState;
    lockedOut: string[];
    activeContenderId: string | null;
    logId: string;
  } | null>(null);
  const [adjustTargetId, setAdjustTargetId] = useState<string>('');
  const [adjustPointsDelta, setAdjustPointsDelta] = useState<string>('5');
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Supabase Persistence Status
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Refs for atomic buzzer arbitration & cleanup
  const buzzerLockRef = useRef<boolean>(false);
  const scoredLockRef = useRef<boolean>(false);
  const buzzerOpenTimestampRef = useRef<number | null>(null);
  const soundEngineRef = useRef<SpeedShowSoundEngine | null>(null);

  if (!soundEngineRef.current) {
    soundEngineRef.current = new SpeedShowSoundEngine();
  }

  // Present students in the selected class
  const presentStudents = useMemo(() => {
    const source = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return source.filter((s) => !absentIds.has(s.id));
  }, [allCandidates, availableCandidates, absentIds]);

  // Initialize default 4 individual students when class changes
  useEffect(() => {
    if (presentStudents.length > 0 && selectedIndividualIds.length === 0) {
      setSelectedIndividualIds(presentStudents.slice(0, Math.min(4, presentStudents.length)).map((s) => s.id));
    }
  }, [presentStudents, selectedIndividualIds.length]);

  // Authorized Questions from Smart EDU Question Bank
  const authorizedQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.status === 'approved') return true;
      if (userRole === 'admin' || userRole === 'reviewer') return true;
      return false;
    });
  }, [questions, userRole]);

  const availableGrades = useMemo(() => {
    const s = new Set<string>();
    authorizedQuestions.forEach((q) => {
      if (q.grade) s.add(q.grade);
    });
    return Array.from(s);
  }, [authorizedQuestions]);

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

  // Auto-assign students evenly across teams
  const handleAutoAssignTeams = useCallback(() => {
    const nextMap: Record<string, number> = {};
    const shuffled = [...presentStudents];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((st, idx) => {
      nextMap[st.id] = idx % teamCount;
    });
    setManualTeamMap(nextMap);
  }, [presentStudents, teamCount]);

  useEffect(() => {
    if (presentStudents.length > 0 && Object.keys(manualTeamMap).length === 0) {
      handleAutoAssignTeams();
    }
  }, [presentStudents, manualTeamMap, handleAutoAssignTeams]);

  // Build contenders list when starting the game
  const buildInitialContenders = useCallback((): SpeedContender[] => {
    if (competitionMode === 'INDIVIDUAL') {
      const chosenStudents = presentStudents
        .filter((s) => selectedIndividualIds.includes(s.id))
        .slice(0, 8);
      const list =
        chosenStudents.length >= 2
          ? chosenStudents
          : presentStudents.slice(0, Math.min(4, Math.max(2, presentStudents.length)));

      return list.map((st, idx) => {
        const preset = TEAM_PRESETS[idx % TEAM_PRESETS.length];
        return {
          id: `ind_${st.id}`,
          name: st.fullName,
          shortLabel: `HS ${idx + 1}`,
          colorHex: preset.colorHex,
          bgClass: preset.bgClass,
          borderClass: preset.borderClass,
          textClass: preset.textClass,
          badgeIcon: preset.badgeIcon,
          members: [st],
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          shortcutKey: String(idx + 1),
          lastReactionMs: null,
        };
      });
    }

    // TEAM or ONLINE_ROOM mode (2-4 teams)
    const count = Math.min(4, Math.max(2, teamCount));
    return Array.from({ length: count }, (_, tIdx) => {
      const preset = TEAM_PRESETS[tIdx % TEAM_PRESETS.length];
      const teamMembers = presentStudents.filter(
        (st, sIdx) => (manualTeamMap[st.id] ?? sIdx % count) === tIdx
      );
      return {
        id: `team_${tIdx + 1}`,
        name: customTeamNames[tIdx]?.trim() || preset.defaultName,
        shortLabel: `Đội ${tIdx + 1}`,
        colorHex: preset.colorHex,
        bgClass: preset.bgClass,
        borderClass: preset.borderClass,
        textClass: preset.textClass,
        badgeIcon: preset.badgeIcon,
        members: teamMembers,
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        shortcutKey: String(tIdx + 1),
        lastReactionMs: null,
      };
    });
  }, [
    competitionMode,
    presentStudents,
    selectedIndividualIds,
    teamCount,
    manualTeamMap,
    customTeamNames,
  ]);

  // Prepare & Start Match (SETUP -> READY -> QUESTION_DISPLAYED)
  const handleStartMatch = () => {
    const builtContenders = buildInitialContenders();
    if (builtContenders.length < 2) return;

    const sourcePool =
      filteredBankQuestions.length > 0 ? filteredBankQuestions : FALLBACK_WARMUP_QUESTIONS;
    const shuffledPool = [...sourcePool];
    for (let i = shuffledPool.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }
    const pickedQuestions = shuffledPool.slice(
      0,
      Math.min(desiredQuestionCount, shuffledPool.length)
    );

    setContenders(builtContenders);
    setAdjustTargetId(builtContenders[0]?.id || '');
    setSessionQuestions(pickedQuestions);
    setCurrentQuestionIdx(0);
    setScoringLogs([]);
    setUndoSnapshot(null);
    setOnlineBuzzerQueue([]);
    setLockedOutContenderIds(new Set());
    setActiveBuzzerContenderId(null);
    setSelectedOptionLabel('');
    setRevealCorrectAnswer(false);
    setLastJudgmentBanner(null);
    buzzerLockRef.current = false;
    scoredLockRef.current = false;

    soundEngineRef.current?.playStartShow(isMuted);
    setGameState('QUESTION_DISPLAYED');
    setBuzzerTimeLeft(buzzerWindowSec);
    setAnswerTimeLeft(answerWindowSec);
  };

  // Open Buzzer for current question (QUESTION_DISPLAYED -> BUZZER_OPEN)
  const handleOpenBuzzer = useCallback(() => {
    buzzerLockRef.current = false;
    scoredLockRef.current = false;
    setActiveBuzzerContenderId(null);
    setLastJudgmentBanner(null);
    setBuzzerTimeLeft(buzzerWindowSec);
    setIsTimerPaused(false);
    buzzerOpenTimestampRef.current = performance.now();
    setGameState('BUZZER_OPEN');
    soundEngineRef.current?.playStartShow(isMuted);
  }, [buzzerWindowSec, isMuted]);

  // Handle Atomic Buzzer Press (BUZZER_OPEN -> BUZZED -> ANSWERING)
  const handleTriggerBuzzer = useCallback(
    (contenderId: string, isOnlineEvent = false) => {
      if (gameState !== 'BUZZER_OPEN') return;
      if (buzzerLockRef.current) return;
      if (lockedOutContenderIds.has(contenderId)) return;

      const found = contenders.find((c) => c.id === contenderId);
      if (!found) return;

      // Lock immediately so no second contender can claim the same turn
      buzzerLockRef.current = true;
      const reactionMs =
        !isOnlineEvent && buzzerOpenTimestampRef.current
          ? Math.max(50, Math.round(performance.now() - buzzerOpenTimestampRef.current))
          : null;

      setContenders((prev) =>
        prev.map((c) => (c.id === contenderId ? { ...c, lastReactionMs: reactionMs } : c))
      );
      setActiveBuzzerContenderId(contenderId);
      setAnswerTimeLeft(answerWindowSec);
      setIsTimerPaused(false);
      soundEngineRef.current?.playBuzzerHit(isMuted);
      setGameState('ANSWERING');
    },
    [gameState, lockedOutContenderIds, contenders, answerWindowSec, isMuted]
  );

  // Keyboard shortcuts 1..8 for Teacher Buzzer Recording when BUZZER_OPEN
  useEffect(() => {
    if (gameState !== 'BUZZER_OPEN') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      const matched = contenders.find((c) => c.shortcutKey === e.key);
      if (matched) {
        e.preventDefault();
        handleTriggerBuzzer(matched.id, false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, contenders, handleTriggerBuzzer]);

  // Supabase Realtime Channel for Mode 3 (ONLINE_ROOM)
  useEffect(() => {
    if (competitionMode !== 'ONLINE_ROOM' || !isSupabaseConfigured) return;
    const channel = supabase.channel(`edu_b01_room_${roomCode}`);

    channel
      .on('broadcast', { event: 'student_buzz' }, (payload) => {
        const data = payload?.payload as { contenderId?: string; contenderName?: string };
        if (!data?.contenderId) return;
        const serverTimestamp = new Date().toLocaleTimeString('vi-VN');
        setOnlineBuzzerQueue((prev) => [
          ...prev,
          {
            contenderId: data.contenderId!,
            contenderName: data.contenderName || data.contenderId!,
            receivedAt: serverTimestamp,
          },
        ]);
        handleTriggerBuzzer(data.contenderId, true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [competitionMode, roomCode, handleTriggerBuzzer]);

  // Timer 1: Buzzer Countdown when in BUZZER_OPEN
  useEffect(() => {
    if (gameState !== 'BUZZER_OPEN' || isTimerPaused) return;
    const interval = window.setInterval(() => {
      setBuzzerTimeLeft((prev) => {
        if (prev <= 1) {
          soundEngineRef.current?.playTimeUp(isMuted);
          setLastJudgmentBanner({
            type: 'timeout',
            message: 'Hết thời gian bấm chuông giành quyền trả lời!',
          });
          setGameState('JUDGING');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameState, isTimerPaused, isMuted]);

  // Timer 2: Answer Countdown when in ANSWERING
  useEffect(() => {
    if (gameState !== 'ANSWERING' || isTimerPaused) return;
    const interval = window.setInterval(() => {
      setAnswerTimeLeft((prev) => {
        if (prev <= 1) {
          soundEngineRef.current?.playTimeUp(isMuted);
          setLastJudgmentBanner({
            type: 'timeout',
            message: 'Đã hết thời gian suy nghĩ trả lời! Giáo viên hãy đưa ra phán quyết.',
          });
          setGameState('JUDGING');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameState, isTimerPaused, isMuted]);

  const currentQuestion = sessionQuestions[currentQuestionIdx] || null;
  const activeContender = useMemo(
    () => contenders.find((c) => c.id === activeBuzzerContenderId) || null,
    [contenders, activeBuzzerContenderId]
  );

  // Persist session summary to Supabase audit_logs & localStorage
  const persistMatchToSupabase = useCallback(
    async (finalContenders: SpeedContender[], logs: ScoringLogEntry[]) => {
      try {
        localStorage.setItem(
          `taydo_b01_last_session_${teacherId}`,
          JSON.stringify({
            sessionId,
            className: resolvedClassName,
            competitionMode,
            contenders: finalContenders,
            logs,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {}

      if (!isSupabaseConfigured) return;
      setSyncStatus('syncing');
      try {
        const { error } = await supabase.from('audit_logs').insert({
          actor_id: teacherId || null,
          actor_role: userRole || 'teacher',
          action_type: 'edu_game_b01_session',
          entity_type: 'edu_game_session',
          entity_id: sessionId,
          metadata: {
            game_id: 'B01',
            game_title: 'Ai nhanh hơn (EDU Speed Challenge 1.0)',
            competition_mode: competitionMode,
            class_id: selectedSourceKey || resolvedClassName,
            class_name: resolvedClassName,
            question_count: sessionQuestions.length,
            standings: finalContenders.map((c) => ({
              id: c.id,
              name: c.name,
              score: c.score,
              correctCount: c.correctCount,
              wrongCount: c.wrongCount,
            })),
            scoring_logs: logs.slice(-25),
            finished_at: new Date().toISOString(),
          },
        });
        setSyncStatus(error ? 'error' : 'synced');
      } catch {
        setSyncStatus('error');
      }
    },
    [
      teacherId,
      sessionId,
      resolvedClassName,
      competitionMode,
      userRole,
      selectedSourceKey,
      sessionQuestions.length,
    ]
  );

  // Judge current answer: CORRECT or WRONG (with anti-double-score lock & Undo snapshot)
  const handleJudgeAnswer = (isCorrect: boolean) => {
    if (!activeContender || !currentQuestion) return;
    if (scoredLockRef.current) return;
    scoredLockRef.current = true;

    const delta = isCorrect
      ? pointsCorrect
      : enableWrongPenalty
      ? -Math.abs(pointsWrongPenalty)
      : 0;

    const logId = `log_${Date.now()}`;
    setUndoSnapshot({
      contenders: contenders.map((c) => ({ ...c })),
      gameState,
      lockedOut: Array.from(lockedOutContenderIds),
      activeContenderId: activeBuzzerContenderId,
      logId,
    });

    const updatedContenders = contenders.map((c) => {
      if (c.id !== activeContender.id) return c;
      return {
        ...c,
        score: c.score + delta,
        correctCount: isCorrect ? c.correctCount + 1 : c.correctCount,
        wrongCount: !isCorrect ? c.wrongCount + 1 : c.wrongCount,
      };
    });

    const newEntry: ScoringLogEntry = {
      id: logId,
      questionIndex: currentQuestionIdx + 1,
      questionCode: currentQuestion.code,
      contenderId: activeContender.id,
      contenderName: activeContender.name,
      outcome: isCorrect ? 'correct' : 'wrong',
      pointsDelta: delta,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    };

    const nextLogs = [newEntry, ...scoringLogs];
    setContenders(updatedContenders);
    setScoringLogs(nextLogs);

    if (isCorrect) {
      soundEngineRef.current?.playCorrect(isMuted);
      setRevealCorrectAnswer(true);
      setLastJudgmentBanner({
        type: 'correct',
        message: `Chính xác! ${activeContender.name} được cộng +${pointsCorrect} điểm!`,
      });
      setGameState('SCORED');
    } else {
      soundEngineRef.current?.playWrong(isMuted);
      const nextLocked = new Set(lockedOutContenderIds);
      nextLocked.add(activeContender.id);
      setLockedOutContenderIds(nextLocked);

      const remainingEligible = contenders.filter((c) => !nextLocked.has(c.id));
      if (allowStealOnWrong && remainingEligible.length > 0) {
        setLastJudgmentBanner({
          type: 'wrong',
          message: `${activeContender.name} trả lời chưa chính xác (${
            delta < 0 ? `${delta} điểm` : '0 điểm'
          }). Giáo viên có thể mở lại chuông cho các đội còn lại!`,
        });
        setGameState('JUDGING');
        scoredLockRef.current = false;
      } else {
        setRevealCorrectAnswer(true);
        setLastJudgmentBanner({
          type: 'wrong',
          message: `${activeContender.name} trả lời chưa chính xác (${
            delta < 0 ? `${delta} điểm` : '0 điểm'
          }).`,
        });
        setGameState('SCORED');
      }
    }
  };

  // Allow another team/student to steal after a wrong answer
  const handleReopenBuzzerForSteal = () => {
    buzzerLockRef.current = false;
    scoredLockRef.current = false;
    setActiveBuzzerContenderId(null);
    setSelectedOptionLabel('');
    setBuzzerTimeLeft(buzzerWindowSec);
    setIsTimerPaused(false);
    buzzerOpenTimestampRef.current = performance.now();
    setLastJudgmentBanner(null);
    setGameState('BUZZER_OPEN');
    soundEngineRef.current?.playStartShow(isMuted);
  };

  // Undo the most recent scoring action
  const handleUndoLastScore = () => {
    if (!undoSnapshot) return;
    setContenders(undoSnapshot.contenders);
    setLockedOutContenderIds(new Set(undoSnapshot.lockedOut));
    setActiveBuzzerContenderId(undoSnapshot.activeContenderId);
    setScoringLogs((prev) => prev.filter((item) => item.id !== undoSnapshot.logId));
    setGameState(undoSnapshot.gameState);
    setRevealCorrectAnswer(false);
    setLastJudgmentBanner(null);
    scoredLockRef.current = false;
    setUndoSnapshot(null);
  };

  // Manual score adjustment with required reason
  const handleManualAdjustScore = () => {
    if (!adjustTargetId) return;
    const delta = parseInt(adjustPointsDelta, 10);
    if (isNaN(delta) || delta === 0) return;

    const target = contenders.find((c) => c.id === adjustTargetId);
    if (!target) return;

    const updated = contenders.map((c) =>
      c.id === adjustTargetId ? { ...c, score: c.score + delta } : c
    );
    const entry: ScoringLogEntry = {
      id: `adj_${Date.now()}`,
      questionIndex: currentQuestionIdx + 1,
      questionCode: currentQuestion?.code || 'ĐIỀU CHỈNH',
      contenderId: target.id,
      contenderName: target.name,
      outcome: 'manual_adjust',
      pointsDelta: delta,
      reason: adjustReason.trim() || 'Giáo viên điều chỉnh điểm',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    };
    setContenders(updated);
    setScoringLogs((prev) => [entry, ...prev]);
    setAdjustReason('');
  };

  // Advance to next question or finish match (SCORED -> NEXT_QUESTION -> QUESTION_DISPLAYED / FINISHED)
  const handleNextQuestion = () => {
    buzzerLockRef.current = false;
    scoredLockRef.current = false;
    setActiveBuzzerContenderId(null);
    setLockedOutContenderIds(new Set());
    setSelectedOptionLabel('');
    setRevealCorrectAnswer(false);
    setLastJudgmentBanner(null);
    setUndoSnapshot(null);

    if (currentQuestionIdx + 1 < sessionQuestions.length) {
      setCurrentQuestionIdx((prev) => prev + 1);
      setBuzzerTimeLeft(buzzerWindowSec);
      setAnswerTimeLeft(answerWindowSec);
      setGameState('QUESTION_DISPLAYED');
    } else {
      setGameState('FINISHED');
      soundEngineRef.current?.playCorrect(isMuted);
      persistMatchToSupabase(contenders, scoringLogs);
    }
  };

  // Sorted Live Leaderboard with Tie-aware Ranks
  const rankedLeaderboard = useMemo(() => {
    const sorted = [...contenders].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.wrongCount - b.wrongCount;
    });

    let currentRank = 1;
    return sorted.map((item, idx) => {
      if (idx > 0 && item.score < sorted[idx - 1].score) {
        currentRank = idx + 1;
      }
      return { ...item, rank: currentRank };
    });
  }, [contenders]);

  // Export CSV Leaderboard & Match History
  const handleExportCSV = () => {
    const headers = ['Hạng', 'Đội/Học sinh', 'Tổng điểm', 'Số câu đúng', 'Số câu sai'];
    const rows = rankedLeaderboard.map((c) => [
      String(c.rank),
      `"${c.name.replace(/"/g, '""')}"`,
      String(c.score),
      String(c.correctCount),
      String(c.wrongCount),
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ket_Qua_B01_Ai_Nhanh_Hon_${resolvedClassName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Game Show Header Bar */}
      <div className="bg-gradient-to-r from-[#09152B] via-[#11244A] to-[#1E1B4B] border border-cyan-400/40 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-md">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                B01 · EDU SPEED CHALLENGE 1.0
              </span>
              <span className="text-xs text-amber-300 font-bold">
                Lớp: {resolvedClassName}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
              AI NHANH HƠN – ĐẤU TRƯỜNG PHẢN XẠ & KIẾN THỨC
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {gameState !== 'SETUP' && (
            <button
              type="button"
              onClick={() => {
                buzzerLockRef.current = false;
                scoredLockRef.current = false;
                setGameState('SETUP');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-300" />
              <span>Cấu hình lại</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setReducedMotion((r) => !r)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
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
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
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
              title="Toàn màn hình máy chiếu"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          SCREEN 1: SETUP CONFIGURATION SCREEN
         ===================================================================== */}
      {gameState === 'SETUP' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-md space-y-6">
          {/* Step 1 & 2: Class Selection & Competition Mode */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#006BFF]" />
                <span>1. Chọn Lớp & Chế Độ Thi Đấu</span>
              </div>

              {classes.length > 0 && onSelectSourceKey && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Lớp học áp dụng:
                  </label>
                  <select
                    value={selectedSourceKey}
                    onChange={(e) => onSelectSourceKey(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-[#0F2D52]"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        Lớp {cls.name} ({cls.studentCount} học sinh)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCompetitionMode('INDIVIDUAL')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    competitionMode === 'INDIVIDUAL'
                      ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-md'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <UserCheck className="w-4 h-4 mb-1" />
                  <div className="text-xs font-extrabold">Chế độ 1: Cá nhân</div>
                  <div className="text-[10px] opacity-80">2 – 8 học sinh</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCompetitionMode('TEAM')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    competitionMode === 'TEAM'
                      ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-md'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <Users className="w-4 h-4 mb-1" />
                  <div className="text-xs font-extrabold">Chế độ 2: Theo đội</div>
                  <div className="text-[10px] opacity-80">2 – 4 đội thi đấu</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCompetitionMode('ONLINE_ROOM')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    competitionMode === 'ONLINE_ROOM'
                      ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-md'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <Wifi className="w-4 h-4 mb-1" />
                  <div className="text-xs font-extrabold">Chế độ 3: Trực tuyến</div>
                  <div className="text-[10px] opacity-80">Phòng chuông Beta</div>
                </button>
              </div>

              {onOpenAbsentModal && (
                <button
                  type="button"
                  onClick={onOpenAbsentModal}
                  className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                  <span>Quản lý học sinh vắng mặt ({absentIds.size} vắng / {presentStudents.length} có mặt)</span>
                </button>
              )}
            </div>

            {/* Step 3: Participants / Teams Configuration */}
            <div className="lg:col-span-7 bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
              {competitionMode === 'INDIVIDUAL' ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52]">
                      2. Chọn 2 – 8 Học Sinh Thi Đấu Cá Nhân (Đã chọn: {selectedIndividualIds.length}/8)
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[4, 6, 8].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            const shuffled = [...presentStudents];
                            for (let i = shuffled.length - 1; i > 0; i--) {
                              const j = secureRandomInt(i + 1);
                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                            }
                            setSelectedIndividualIds(
                              shuffled.slice(0, Math.min(n, shuffled.length)).map((s) => s.id)
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-[#006BFF] text-[11px] font-bold"
                        >
                          Chọn ngẫu nhiên {n} HS
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    * Chế độ trình chiếu lớp học: Học sinh giơ tay hoặc bấm chuông vật lý, giáo viên nhấn nút của học sinh (hoặc phím tắt 1–8) để xác nhận người giành quyền trả lời trước.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1">
                    {presentStudents.map((st) => {
                      const isChecked = selectedIndividualIds.includes(st.id);
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedIndividualIds((prev) => {
                              if (prev.includes(st.id)) {
                                return prev.length > 2 ? prev.filter((id) => id !== st.id) : prev;
                              }
                              if (prev.length >= 8) return prev;
                              return [...prev, st.id];
                            });
                          }}
                          className={`p-2 rounded-xl border text-left text-xs font-bold truncate transition-all ${
                            isChecked
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {isChecked ? '✓ ' : ''}
                          {st.fullName}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52]">
                      2. Thiết Lập Đội Thi Đấu (2 – 4 Đội)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">Số đội:</span>
                      {[2, 3, 4].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTeamCount(cnt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                            teamCount === cnt
                              ? 'bg-[#006BFF] text-white'
                              : 'bg-white border border-slate-300 text-slate-700'
                          }`}
                        >
                          {cnt} Đội
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleAutoAssignTeams}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1"
                      >
                        <Shuffle className="w-3 h-3" /> Chia đội tự động
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Array.from({ length: teamCount }, (_, idx) => {
                      const preset = TEAM_PRESETS[idx];
                      const members = presentStudents.filter(
                        (s, sIdx) => (manualTeamMap[s.id] ?? sIdx % teamCount) === idx
                      );
                      return (
                        <div
                          key={idx}
                          className="bg-white rounded-xl border-2 p-2.5 space-y-1.5"
                          style={{ borderColor: preset.colorHex }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-black text-white"
                              style={{ backgroundColor: preset.colorHex }}
                            >
                              ĐỘI {idx + 1} (Phím {idx + 1})
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {members.length} thành viên
                            </span>
                          </div>
                          <input
                            type="text"
                            value={customTeamNames[idx] || ''}
                            onChange={(e) => {
                              const next = [...customTeamNames];
                              next[idx] = e.target.value;
                              setCustomTeamNames(next);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-extrabold text-[#0F2D52]"
                          />
                          <div className="text-[11px] text-slate-500 truncate">
                            TV: {members.map((m) => m.fullName.split(' ').pop()).join(', ') || 'Chưa có'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {competitionMode === 'ONLINE_ROOM' && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                      <div className="font-extrabold flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-amber-600" />
                        <span>Phòng Bấm Chuông Trực Tuyến (Trạng thái: Thử nghiệm Beta) · Mã phòng: {roomCode}</span>
                      </div>
                      <p>
                        * Lưu ý kỹ thuật: Độ trễ mạng Internet giữa các thiết bị di động có thể ảnh hưởng đến thứ tự gói tin bấm chuông gửi về kênh Supabase Realtime. Hệ thống phân xử theo thứ tự sự kiện tiếp nhận đầu tiên và không tuyên bố đo chính xác phản xạ vật lý tuyệt đối qua mạng.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Step 4–7: Smart EDU Question Bank Filters */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#006BFF]" />
                <span>3. Chọn Bộ Câu Hỏi Từ Ngân Hàng Smart EDU</span>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                Số câu hỏi hợp lệ khớp bộ lọc: {filteredBankQuestions.length} câu
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Khối lớp
                </label>
                <select
                  value={filterGrade}
                  onChange={(e) => {
                    setFilterGrade(e.target.value);
                    setFilterSubject('ALL');
                    setFilterChapter('ALL');
                    setFilterLesson('ALL');
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="ALL">Tất cả khối</option>
                  {(['6', '7', '8', '9'] as Grade[]).map((g) => (
                    <option key={g} value={g}>
                      Khối {g} {availableGrades.includes(g) ? '' : '(0)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Môn học
                </label>
                <select
                  value={filterSubject}
                  onChange={(e) => {
                    setFilterSubject(e.target.value);
                    setFilterChapter('ALL');
                    setFilterLesson('ALL');
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="ALL">Tất cả môn ({availableSubjects.length})</option>
                  {availableSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {SUBJECT_LABELS[sub] || sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Chương / Chủ đề
                </label>
                <select
                  value={filterChapter}
                  onChange={(e) => {
                    setFilterChapter(e.target.value);
                    setFilterLesson('ALL');
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="ALL">Tất cả chương ({availableChapters.length})</option>
                  {availableChapters.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Bài học
                </label>
                <select
                  value={filterLesson}
                  onChange={(e) => setFilterLesson(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="ALL">Tất cả bài ({availableLessons.length})</option>
                  {availableLessons.map((ls) => (
                    <option key={ls} value={ls}>
                      {ls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Mức độ
                </label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="ALL">Mọi mức độ</option>
                  <option value="know">{LEVEL_LABELS.know}</option>
                  <option value="understand">{LEVEL_LABELS.understand}</option>
                  <option value="apply">{LEVEL_LABELS.apply}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Số lượng câu hỏi
                </label>
                <select
                  value={desiredQuestionCount}
                  onChange={(e) => setDesiredQuestionCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                >
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} câu hỏi
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredBankQuestions.length > 0 &&
              filteredBankQuestions.length < desiredQuestionCount && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-semibold">
                  * Lưu ý: Bộ lọc hiện tại có {filteredBankQuestions.length} câu hỏi được duyệt (ít hơn mức {desiredQuestionCount} câu đã chọn). Hệ thống sẽ sử dụng tối đa {filteredBankQuestions.length} câu hiện có.
                </p>
              )}

            {filteredBankQuestions.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-semibold">
                * Hiện chưa có câu hỏi đã duyệt khớp bộ lọc trên. Hệ thống sẽ sử dụng {FALLBACK_WARMUP_QUESTIONS.length} câu hỏi khởi động mẫu chuẩn của Tây Đô Smart EDU để giáo viên trải nghiệm ngay.
              </p>
            )}
          </div>

          {/* Step 8 & 9: Timers & Scoring Rules */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F2D52] flex items-center gap-2">
              <TimerIcon className="w-4 h-4 text-[#006BFF]" />
              <span>4. Cấu Hình Hai Đồng Hồ Độc Lập & Quy Tắc Tính Điểm</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Đồng hồ 1: Chờ bấm chuông
                </label>
                <select
                  value={buzzerWindowSec}
                  onChange={(e) => setBuzzerWindowSec(Number(e.target.value))}
                  className="w-full font-extrabold text-xs text-[#0F2D52] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                >
                  <option value={10}>10 giây</option>
                  <option value={15}>15 giây (Mặc định)</option>
                  <option value={20}>20 giây</option>
                  <option value={30}>30 giây</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Đồng hồ 2: Thời gian trả lời
                </label>
                <select
                  value={answerWindowSec}
                  onChange={(e) => setAnswerWindowSec(Number(e.target.value))}
                  className="w-full font-extrabold text-xs text-[#0F2D52] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                >
                  <option value={15}>15 giây</option>
                  <option value={30}>30 giây (Mặc định)</option>
                  <option value={45}>45 giây</option>
                  <option value={60}>60 giây</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Trả lời ĐÚNG cộng:
                </label>
                <select
                  value={pointsCorrect}
                  onChange={(e) => setPointsCorrect(Number(e.target.value))}
                  className="w-full font-extrabold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5"
                >
                  <option value={5}>+5 điểm</option>
                  <option value={10}>+10 điểm (Mặc định)</option>
                  <option value={15}>+15 điểm</option>
                  <option value={20}>+20 điểm</option>
                </select>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Trừ điểm khi SAI
                  </span>
                  <input
                    type="checkbox"
                    checked={enableWrongPenalty}
                    onChange={(e) => setEnableWrongPenalty(e.target.checked)}
                    className="rounded text-[#006BFF]"
                  />
                </div>
                {enableWrongPenalty ? (
                  <select
                    value={pointsWrongPenalty}
                    onChange={(e) => setPointsWrongPenalty(Number(e.target.value))}
                    className="w-full mt-1 font-extrabold text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1"
                  >
                    <option value={2}>-2 điểm</option>
                    <option value={5}>-5 điểm</option>
                    <option value={10}>-10 điểm</option>
                  </select>
                ) : (
                  <span className="text-xs font-bold text-slate-500 mt-1">
                    Không trừ điểm (0đ)
                  </span>
                )}
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Nhường quyền khi SAI
                  </span>
                  <input
                    type="checkbox"
                    checked={allowStealOnWrong}
                    onChange={(e) => setAllowStealOnWrong(e.target.checked)}
                    className="rounded text-[#006BFF]"
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 mt-1">
                  {allowStealOnWrong ? 'Cho đội khác bấm tiếp' : 'Đóng câu hỏi ngay'}
                </span>
              </div>
            </div>
          </div>

          {/* Start Game CTA */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={handleStartMatch}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#006BFF] via-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-base shadow-xl flex items-center gap-2.5 transition-all"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>BẮT ĐẦU TRÒ CHƠI B01 – AI NHANH HƠN ➔</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: ACTIVE GAME SHOW STAGE & LIVE LEADERBOARD (60-65% / 35-40%)
         ===================================================================== */}
      {gameState !== 'SETUP' && gameState !== 'FINISHED' && currentQuestion && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT 60-65%: Question Stage, Dual Timers, Buzzer Podiums & Judging Controls */}
          <div className="lg:col-span-7 xl:col-span-8 bg-gradient-to-b from-[#09152B] via-[#0F2447] to-[#131C38] rounded-3xl border-2 border-cyan-400/40 p-4 sm:p-6 text-white shadow-2xl flex flex-col justify-between space-y-4">
            {/* Top Progress & Dual Independent Clocks */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs sm:text-sm">
                    CÂU HỎI {currentQuestionIdx + 1} / {sessionQuestions.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-cyan-300 text-xs font-bold">
                    {currentQuestion.code} · {LEVEL_LABELS[currentQuestion.level] || currentQuestion.level}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold">
                    +{pointsCorrect} điểm
                  </span>
                </div>

                {/* Dual Independent Clocks Display */}
                <div className="flex items-center gap-2">
                  {/* Clock 1: Buzzer Window */}
                  <div
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                      gameState === 'BUZZER_OPEN'
                        ? buzzerTimeLeft <= 5
                          ? 'bg-rose-600/30 border-rose-400 text-rose-200 animate-pulse'
                          : 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900/70 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                    <div>
                      <div className="text-[9px] font-bold uppercase">Giành quyền</div>
                      <div className="text-sm sm:text-base font-black font-mono leading-none">
                        {buzzerTimeLeft}s
                      </div>
                    </div>
                  </div>

                  {/* Clock 2: Answer Window */}
                  <div
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                      gameState === 'ANSWERING'
                        ? answerTimeLeft <= 5
                          ? 'bg-rose-600/30 border-rose-400 text-rose-200 animate-pulse'
                          : 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-900/70 border-slate-700 text-slate-400'
                    }`}
                  >
                    <TimerIcon className="w-4 h-4" />
                    <div>
                      <div className="text-[9px] font-bold uppercase">Trả lời</div>
                      <div className="text-sm sm:text-base font-black font-mono leading-none">
                        {answerTimeLeft}s
                      </div>
                    </div>
                  </div>

                  {(gameState === 'BUZZER_OPEN' || gameState === 'ANSWERING') && (
                    <button
                      type="button"
                      onClick={() => setIsTimerPaused((p) => !p)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white"
                      title={isTimerPaused ? 'Tiếp tục đồng hồ' : 'Tạm dừng đồng hồ'}
                    >
                      {isTimerPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Question Progress Bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-[#006BFF] to-amber-400 transition-all duration-300"
                  style={{
                    width: `${((currentQuestionIdx + 1) / Math.max(1, sessionQuestions.length)) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Central Question Display Board */}
            <div className="bg-slate-950/85 border-2 border-cyan-400/40 rounded-2xl p-4 sm:p-6 shadow-inner space-y-4 max-h-[340px] overflow-y-auto">
              <div className="text-base sm:text-xl lg:text-2xl font-extrabold text-white leading-relaxed">
                {currentQuestion.stem}
              </div>

              {currentQuestion.image && (
                <div className="flex justify-center">
                  <img
                    src={currentQuestion.image}
                    alt="Hình minh họa câu hỏi"
                    className="max-h-44 rounded-xl border border-slate-700 object-contain"
                  />
                </div>
              )}

              {/* Single Choice Options A, B, C, D */}
              {currentQuestion.type === 'single_choice' && currentQuestion.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {currentQuestion.options.map((opt) => {
                    const isPicked = selectedOptionLabel === opt.label;
                    const isCorrectOpt =
                      revealCorrectAnswer &&
                      (currentQuestion.correctAnswer === opt.label ||
                        currentQuestion.correctAnswer === opt.id);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedOptionLabel(opt.label)}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                          isCorrectOpt
                            ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                            : isPicked
                            ? 'bg-amber-500/30 border-amber-400 text-white'
                            : 'bg-slate-900/90 border-slate-700/80 text-slate-100 hover:border-cyan-400/60'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                            isCorrectOpt
                              ? 'bg-emerald-400 text-slate-950'
                              : isPicked
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-cyan-300'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="text-sm sm:text-base font-bold">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* True / False Statements */}
              {currentQuestion.type === 'true_false_group' && currentQuestion.subItems && (
                <div className="space-y-2">
                  {currentQuestion.subItems.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between gap-3 text-xs sm:text-sm"
                    >
                      <span className="font-bold">
                        <strong className="text-cyan-300">{sub.label})</strong> {sub.text}
                      </span>
                      {revealCorrectAnswer && (
                        <span
                          className={`px-2.5 py-0.5 rounded font-black ${
                            sub.isCorrect
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {sub.isCorrect ? 'ĐÚNG' : 'SAI'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {revealCorrectAnswer && (
                <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-400/50 text-xs sm:text-sm text-emerald-200 space-y-1">
                  {currentQuestion.correctAnswer && (
                    <div className="font-black text-emerald-300">
                      ✓ ĐÁP ÁN ĐÚNG: {currentQuestion.correctAnswer}
                    </div>
                  )}
                  {currentQuestion.explanation && (
                    <div>Giải thích: {currentQuestion.explanation}</div>
                  )}
                </div>
              )}
            </div>

            {/* Buzzer Podiums Area */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>
                    {competitionMode === 'ONLINE_ROOM'
                      ? `BÀN CHUÔNG TRỰC TUYẾN (Mã phòng: ${roomCode}) & GHI NHẬN CỦA GIÁO VIÊN`
                      : 'BÀN BẤM CHUÔNG GIÀNH QUYỀN TRẢ LỜI (Nhấn nút hoặc phím tắt 1–8)'}
                  </span>
                </span>
                <span className="text-[11px] font-bold text-slate-300">
                  Trạng thái:{' '}
                  <strong className="text-amber-300">
                    {gameState === 'QUESTION_DISPLAYED'
                      ? 'Chờ mở chuông'
                      : gameState === 'BUZZER_OPEN'
                      ? 'ĐANG MỞ CHUÔNG!'
                      : gameState === 'ANSWERING'
                      ? 'Đang trả lời'
                      : 'Phán quyết / Điểm số'}
                  </strong>
                </span>
              </div>

              <div
                className={`grid gap-2.5 ${
                  contenders.length <= 4
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                {contenders.map((c) => {
                  const isWinnerBuzzer = activeBuzzerContenderId === c.id;
                  const isLockedOut = lockedOutContenderIds.has(c.id);
                  const canPress = gameState === 'BUZZER_OPEN' && !isLockedOut;

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={!canPress}
                      onClick={() => handleTriggerBuzzer(c.id, false)}
                      className={`relative rounded-2xl p-3 border-2 text-left transition-all flex flex-col justify-between ${
                        isWinnerBuzzer
                          ? `bg-gradient-to-br ${c.bgClass} text-white border-white scale-[1.03] shadow-[0_0_28px_rgba(250,204,21,0.75)] z-10`
                          : isLockedOut
                          ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                          : canPress
                          ? 'bg-slate-900/90 hover:bg-slate-800 border-cyan-400/60 text-white cursor-pointer hover:scale-[1.02] shadow-lg'
                          : 'bg-slate-900/60 border-slate-700/70 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] font-black uppercase">
                          Phím {c.shortcutKey}
                        </span>
                        <span className="text-xs font-black text-amber-300">{c.score} điểm</span>
                      </div>

                      <div className="my-2 font-black text-sm sm:text-base truncate">{c.name}</div>

                      <div className="flex items-center justify-between text-[10px] font-extrabold">
                        {isWinnerBuzzer ? (
                          <span className="text-amber-200 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" /> GIÀNH QUYỀN!
                          </span>
                        ) : isLockedOut ? (
                          <span className="text-rose-400">Đã khóa lượt này</span>
                        ) : canPress ? (
                          <span className="text-cyan-300">BẤM CHUÔNG NGAY</span>
                        ) : (
                          <span className="opacity-70">Chờ hiệu lệnh</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Banner & Teacher Action Bar */}
            {lastJudgmentBanner && (
              <div
                className={`p-3 rounded-2xl border-2 font-extrabold text-xs sm:text-sm flex items-center justify-between gap-2 ${
                  lastJudgmentBanner.type === 'correct'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : lastJudgmentBanner.type === 'wrong'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-amber-500/20 border-amber-400 text-amber-200'
                }`}
              >
                <span>{lastJudgmentBanner.message}</span>
                {undoSnapshot && (
                  <button
                    type="button"
                    onClick={handleUndoLastScore}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Hoàn tác
                  </button>
                )}
              </div>
            )}

            {/* Stage Control Buttons depending on State Machine */}
            <div className="pt-2 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRevealCorrectAnswer((v) => !v)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-cyan-200 flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{revealCorrectAnswer ? 'Ẩn đáp án' : 'Công bố đáp án'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>
                    {currentQuestionIdx + 1 < sessionQuestions.length
                      ? 'Bỏ qua / Câu tiếp'
                      : 'Kết thúc phiên'}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {gameState === 'QUESTION_DISPLAYED' && (
                  <button
                    type="button"
                    onClick={handleOpenBuzzer}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-sm shadow-xl flex items-center gap-2"
                  >
                    <Bell className="w-4 h-4 fill-current" />
                    <span>MỞ CHUÔNG GIÀNH QUYỀN ({buzzerWindowSec}s) ➔</span>
                  </button>
                )}

                {(gameState === 'ANSWERING' ||
                  (gameState === 'JUDGING' && activeContender)) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleJudgeAnswer(true)}
                      className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>XÁC NHẬN ĐÚNG (+{pointsCorrect}đ)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleJudgeAnswer(false)}
                      className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-lg flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>
                        XÁC NHẬN SAI ({enableWrongPenalty ? `-${pointsWrongPenalty}đ` : '0đ'})
                      </span>
                    </button>
                  </>
                )}

                {gameState === 'JUDGING' &&
                  allowStealOnWrong &&
                  contenders.some((c) => !lockedOutContenderIds.has(c.id)) && (
                    <button
                      type="button"
                      onClick={handleReopenBuzzerForSteal}
                      className="px-4 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg flex items-center gap-1.5"
                    >
                      <Bell className="w-4 h-4" />
                      <span>MỞ LẠI CHUÔNG CHO ĐỘI KHÁC</span>
                    </button>
                  )}

                {gameState === 'SCORED' && (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-[#006BFF] to-indigo-600 text-white font-black text-sm shadow-xl flex items-center gap-2"
                  >
                    <span>
                      {currentQuestionIdx + 1 < sessionQuestions.length
                        ? 'CÂU HỎI TIẾP THEO ➔'
                        : 'XEM BẢNG VÀNG CHUNG CUỘC ➔'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 35-40%: Live Leaderboard, Manual Adjustment & Scoring Logs */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between gap-4">
            {/* Live Leaderboard Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#0F2D52]">
                    Bảng Xếp Hạng Trực Tiếp
                  </h4>
                </div>
                {undoSnapshot && (
                  <button
                    type="button"
                    onClick={handleUndoLastScore}
                    className="text-xs font-bold text-[#006BFF] hover:underline flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Hoàn tác
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {rankedLeaderboard.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-2 ${
                      item.rank === 1 && item.score > 0
                        ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                          item.rank === 1
                            ? 'bg-amber-400 text-slate-950'
                            : item.rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : item.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        #{item.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-extrabold text-[#0F2D52] truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-2">
                          <span className="text-emerald-600">Đúng: {item.correctCount}</span>
                          <span>·</span>
                          <span className="text-rose-600">Sai: {item.wrongCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base sm:text-lg font-black text-[#006BFF]">
                        {item.score} đ
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Teacher Manual Score Adjustment with Reason */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#006BFF]" />
                <span>Điều chỉnh điểm có ghi lý do</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={adjustTargetId}
                  onChange={(e) => setAdjustTargetId(e.target.value)}
                  className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  {contenders.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={adjustPointsDelta}
                  onChange={(e) => setAdjustPointsDelta(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                  placeholder="+5 / -5"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Lý do cộng/trừ điểm..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleManualAdjustScore}
                  className="px-3 py-1.5 rounded-xl bg-[#006BFF] text-white text-xs font-bold"
                >
                  Cập nhật
                </button>
              </div>
            </div>

            {/* Recent Scoring Log Feed */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-2 flex-1">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Nhật ký chấm điểm ({scoringLogs.length})</span>
                {competitionMode === 'ONLINE_ROOM' && (
                  <span className="text-[10px] text-cyan-600">
                    Hàng đợi Realtime: {onlineBuzzerQueue.length}
                  </span>
                )}
              </div>

              {scoringLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Chưa có lượt chấm điểm nào trong phiên.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {scoringLogs.slice(0, 8).map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <strong className="text-[#0F2D52]">Câu {log.questionIndex}:</strong>{' '}
                        {log.contenderName}
                        {log.reason && (
                          <span className="text-slate-500"> ({log.reason})</span>
                        )}
                      </div>
                      <span
                        className={`font-black shrink-0 ${
                          log.pointsDelta > 0
                            ? 'text-emerald-600'
                            : log.pointsDelta < 0
                            ? 'text-rose-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {log.pointsDelta > 0 ? `+${log.pointsDelta}đ` : `${log.pointsDelta}đ`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: FINISHED CHAMPIONSHIP PODIUM & SUMMARY EXPORT
         ===================================================================== */}
      {gameState === 'FINISHED' && (
        <div className="bg-gradient-to-b from-[#09152B] via-[#10254C] to-[#0F172A] rounded-3xl border-2 border-amber-400/70 p-6 sm:p-8 text-white shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-400 text-amber-300 text-xs font-black uppercase tracking-widest">
              <Trophy className="w-4 h-4" /> TỔNG KẾT CHUNG CUỘC · B01 AI NHANH HƠN
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              BẢNG VÀNG VINH DANH LỚP {resolvedClassName.toUpperCase()}
            </h2>
            { rankedLeaderboard.filter((c) => c.rank === 1).length > 1 && (
              <p className="text-sm font-bold text-amber-300">
                ★ Chúc mừng {rankedLeaderboard.filter((c) => c.rank === 1).map((c) => c.name).join(' & ')} ĐỒNG HẠNG NHẤT! ★
              </p>
            )}
          </div>

          {/* Final Standings Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {rankedLeaderboard.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl p-5 border-2 flex flex-col justify-between ${
                  item.rank === 1
                    ? 'bg-gradient-to-b from-amber-400/25 to-orange-500/20 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.35)]'
                    : 'bg-slate-900/85 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black ${
                      item.rank === 1
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-cyan-300'
                    }`}
                  >
                    HẠNG #{item.rank}
                  </span>
                  {item.rank === 1 && <Trophy className="w-6 h-6 text-amber-400" />}
                </div>

                <div className="my-4">
                  <h3 className="text-lg font-black text-white">{item.name}</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Đúng: <strong className="text-emerald-300">{item.correctCount}</strong> · Sai:{' '}
                    <strong className="text-rose-300">{item.wrongCount}</strong>
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-slate-300">Tổng điểm:</span>
                  <span className="text-2xl font-black text-amber-300">{item.score} đ</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-cyan-500/20">
            <div className="text-xs text-cyan-200">
              {syncStatus === 'synced'
                ? '✓ Đã lưu lịch sử phiên chơi lên Supabase & bộ nhớ trình duyệt.'
                : 'Kết quả phiên chơi đã được lưu an toàn.'}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-cyan-300" />
                <span>Xuất kết quả CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setGameState('SETUP')}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-[#006BFF] to-indigo-600 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>CHƠI PHIÊN MỚI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
