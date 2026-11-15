import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Clock,
  Undo2,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Award,
  Flame,
  Zap,
  Sliders,
  SkipForward,
  Lock,
  Check,
  X,
  ListChecks,
  SplitSquareVertical,
  Sparkles,
  Wifi,
  Plus,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question, Grade, CognitiveLevel, TrueFalseSubItem } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

// ============================================================================
// TYPES & STATE MACHINE
// ============================================================================

export type TrueFalsePlayMode =
  | 'LIGHTNING_REFLEX'
  | 'TWO_SIDES_ARENA'
  | 'TEAM_BATTLE'
  | 'FOUR_STATEMENTS_CHALLENGE';

export type TrueFalseStageState =
  | 'SETUP'
  | 'READY'
  | 'QUESTION_DISPLAYED'
  | 'ANSWERING'
  | 'LOCKED'
  | 'REVEALING'
  | 'SCORING'
  | 'NEXT_QUESTION'
  | 'FINISHED';

export type TeamTurnStyle = 'TURN_BASED' | 'ALL_TEAMS_SIMULTANEOUS' | 'BUZZER_CLAIM';

export type FourStatementScoringMethod = 'PER_ITEM_EQUAL' | 'CUSTOM_TIER_TABLE';

export interface SingleStatementItem {
  id: string;
  source: 'bank' | 'builtin' | 'manual';
  subject: string;
  grade: Grade;
  chapter: string;
  lesson: string;
  level: CognitiveLevel;
  contextStem?: string;
  statementText: string;
  isTrue: boolean;
  explanation: string;
  image?: string;
}

export interface FourStatementGroupItem {
  id: string;
  code: string;
  source: 'bank' | 'builtin' | 'manual';
  subject: string;
  grade: Grade;
  chapter: string;
  lesson: string;
  level: CognitiveLevel;
  stem: string;
  image?: string;
  subItems: Array<{
    id: string;
    label: 'a' | 'b' | 'c' | 'd';
    text: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
  generalExplanation: string;
}

export interface TrueFalseTeam {
  id: string;
  name: string;
  colorHex: string;
  members: StudentCandidate[];
  score: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  maxStreak: number;
}

export interface TrueFalseScoreAuditEntry {
  id: string;
  timestamp: string;
  questionIndex: number;
  targetName: string;
  teamId?: string;
  deltaPoints: number;
  reason: string;
}

export interface TrueFalseGameProps {
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
// CONSTANTS & BUILT-IN VERIFIED QUESTION BANK (THCS)
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

const LEVEL_LABELS: Record<CognitiveLevel, string> = {
  know: 'Nhận biết',
  understand: 'Thông hiểu',
  apply: 'Vận dụng',
};

const TEAM_PRESETS = [
  { id: 'tf-team-1', name: 'Đội Tia Chớp Xanh', colorHex: '#0EA5E9' },
  { id: 'tf-team-2', name: 'Đội Khiên Vàng', colorHex: '#F59E0B' },
  { id: 'tf-team-3', name: 'Đội Phượng Hoàng Đỏ', colorHex: '#F43F5E' },
  { id: 'tf-team-4', name: 'Đội Sao Băng Tím', colorHex: '#8B5CF6' },
];

const STORAGE_SESSION_KEY = 'taydo_smart_edu_b05_active_session_v1';
const STORAGE_FAV_CONFIG_KEY = 'taydo_smart_edu_b05_fav_config_v1';

const BUILTIN_SINGLE_STATEMENTS: SingleStatementItem[] = [
  {
    id: 'b05-st-1',
    source: 'builtin',
    subject: 'math',
    grade: '6',
    chapter: 'Số tự nhiên',
    lesson: 'Số nguyên tố và hợp số',
    level: 'know',
    statementText: 'Số 2 là số nguyên tố chẵn duy nhất trong tập hợp các số tự nhiên.',
    isTrue: true,
    explanation: 'ĐÚNG. Mọi số chẵn lớn hơn 2 đều chia hết cho 2 nên là hợp số; chỉ có 2 là số nguyên tố chẵn duy nhất.',
  },
  {
    id: 'b05-st-2',
    source: 'builtin',
    subject: 'math',
    grade: '7',
    chapter: 'Tam giác',
    lesson: 'Tổng ba góc của một tam giác',
    level: 'know',
    statementText: 'Trong một tam giác vuông, có thể có hai góc cùng là góc vuông.',
    isTrue: false,
    explanation: 'SAI. Tổng ba góc trong một tam giác bằng 180°. Nếu có 2 góc vuông (90° + 90° = 180°) thì góc thứ ba bằng 0° (vô lý).',
  },
  {
    id: 'b05-st-3',
    source: 'builtin',
    subject: 'science',
    grade: '6',
    chapter: 'Tế bào',
    lesson: 'Cấu tạo tế bào thực vật',
    level: 'understand',
    statementText: 'Lục lạp là bào quan giúp tế bào thực vật thực hiện quá trình quang hợp.',
    isTrue: true,
    explanation: 'ĐÚNG. Lục lạp chứa chất diệp lục giúp hấp thụ năng lượng ánh sáng mặt trời để tổng hợp chất hữu cơ.',
  },
  {
    id: 'b05-st-4',
    source: 'builtin',
    subject: 'informatics',
    grade: '6',
    chapter: 'Máy tính và cộng đồng',
    lesson: 'Bộ nhớ máy tính',
    level: 'know',
    statementText: 'Dữ liệu lưu trong bộ nhớ RAM sẽ vẫn được giữ nguyên sau khi tắt nguồn máy tính.',
    isTrue: false,
    explanation: 'SAI. RAM (Random Access Memory) là bộ nhớ khả biến, mọi dữ liệu tạm thời trong RAM sẽ bị mất khi tắt nguồn điện.',
  },
  {
    id: 'b05-st-5',
    source: 'builtin',
    subject: 'history_geo',
    grade: '8',
    chapter: 'Địa lí Việt Nam',
    lesson: 'Sông ngòi Việt Nam',
    level: 'know',
    statementText: 'Thành phố Cần Thơ nằm bên bờ sông Hậu – một nhánh lớn của sông Mê Kông.',
    isTrue: true,
    explanation: 'ĐÚNG. Cần Thơ nằm ở trung tâm vùng hạ lưu sông Hậu thuộc Đồng bằng sông Cửu Long.',
  },
  {
    id: 'b05-st-6',
    source: 'builtin',
    subject: 'science',
    grade: '8',
    chapter: 'Điện học',
    lesson: 'Dòng điện và nguồn điện',
    level: 'understand',
    statementText: 'Kim loại dẫn điện tốt là do trong kim loại có các electron tự do dịch chuyển có hướng.',
    isTrue: true,
    explanation: 'ĐÚNG. Các electron tự do trong kim loại mang điện tích âm và dễ dàng dịch chuyển khi có hiệu điện thế.',
  },
  {
    id: 'b05-st-7',
    source: 'builtin',
    subject: 'math',
    grade: '8',
    chapter: 'Tứ giác',
    lesson: 'Hình chữ nhật và hình thoi',
    level: 'understand',
    statementText: 'Mọi hình thoi đều có hai đường chéo bằng nhau.',
    isTrue: false,
    explanation: 'SAI. Hình thoi có hai đường chéo vuông góc với nhau tại trung điểm mỗi đường, nhưng chỉ bằng nhau khi hình thoi đó là hình vuông.',
  },
  {
    id: 'b05-st-8',
    source: 'builtin',
    subject: 'informatics',
    grade: '7',
    chapter: 'Mạng máy tính và Internet',
    lesson: 'An toàn thông tin',
    level: 'know',
    statementText: 'Đặt mật khẩu tài khoản trực tuyến trùng với ngày sinh hoặc "123456" là cách bảo mật an toàn cao.',
    isTrue: false,
    explanation: 'SAI. Mật khẩu "123456" hoặc ngày sinh rất dễ bị đoán. Mật khẩu mạnh cần kết hợp chữ hoa, chữ thường, chữ số và ký tự đặc biệt.',
  },
];

const BUILTIN_FOUR_STATEMENT_GROUPS: FourStatementGroupItem[] = [
  {
    id: 'b05-4st-1',
    code: 'TOAN7-TF-01',
    source: 'builtin',
    subject: 'math',
    grade: '7',
    chapter: 'Hình học phẳng',
    lesson: 'Tam giác cân và tam giác đều',
    level: 'understand',
    stem: 'Cho tam giác ABC cân tại đỉnh A có góc ở đỉnh ∠A = 60°. Xét tính Đúng hoặc Sai của 4 nhận định sau:',
    subItems: [
      {
        id: 'b05-4st-1a',
        label: 'a',
        text: 'Hai cạnh bên AB và AC có độ dài bằng nhau (AB = AC).',
        isCorrect: true,
        explanation: 'Đúng vì tam giác ABC cân tại đỉnh A.',
      },
      {
        id: 'b05-4st-1b',
        label: 'b',
        text: 'Hai góc ở đáy bằng nhau và mỗi góc có số đo bằng 60°.',
        isCorrect: true,
        explanation: 'Đúng vì ∠B = ∠C = (180° - 60°) / 2 = 60°.',
      },
      {
        id: 'b05-4st-1c',
        label: 'c',
        text: 'Tam giác ABC là một tam giác vuông cân tại A.',
        isCorrect: false,
        explanation: 'Sai vì ∠A = 60° ≠ 90°, tam giác ABC là tam giác đều.',
      },
      {
        id: 'b05-4st-1d',
        label: 'd',
        text: 'Ba cạnh của tam giác bằng nhau (AB = BC = CA).',
        isCorrect: true,
        explanation: 'Đúng vì tam giác cân có một góc bằng 60° là tam giác đều.',
      },
    ],
    generalExplanation:
      'Tam giác cân có một góc 60° là tam giác đều, do đó có 3 cạnh bằng nhau và 3 góc đều bằng 60° (ý a, b, d Đúng; ý c Sai).',
  },
  {
    id: 'b05-4st-2',
    code: 'KHTN6-TF-02',
    source: 'builtin',
    subject: 'science',
    grade: '6',
    chapter: 'Các thể của chất',
    lesson: 'Sự chuyển thể của nước',
    level: 'know',
    stem: 'Trong thí nghiệm đun nóng nước tinh khiết ở áp suất tiêu chuẩn, xét 4 nhận định dưới đây:',
    subItems: [
      {
        id: 'b05-4st-2a',
        label: 'a',
        text: 'Nước tinh khiết sôi ở nhiệt độ 100°C dưới áp suất khí quyển tiêu chuẩn.',
        isCorrect: true,
        explanation: 'Đúng theo tính chất vật lí của nước nguyên chất.',
      },
      {
        id: 'b05-4st-2b',
        label: 'b',
        text: 'Quá trình nước chuyển từ thể lỏng sang thể hơi gọi là sự đông đặc.',
        isCorrect: false,
        explanation: 'Sai, chuyển từ thể lỏng sang thể hơi là sự bay hơi (hoặc sự sôi).',
      },
      {
        id: 'b05-4st-2c',
        label: 'c',
        text: 'Trong suốt thời gian nước đang sôi, nhiệt độ của nước tiếp tục tăng lên 150°C.',
        isCorrect: false,
        explanation: 'Sai, trong suốt thời gian sôi, nhiệt độ của nước giữ không đổi ở 100°C.',
      },
      {
        id: 'b05-4st-2d',
        label: 'd',
        text: 'Khi hơi nước gặp lạnh và biến đổi thành các giọt nước lỏng, đó là sự ngưng tụ.',
        isCorrect: true,
        explanation: 'Đúng, chuyển từ thể hơi sang thể lỏng là sự ngưng tụ.',
      },
    ],
    generalExplanation:
      'Nước tinh khiết sôi ở 100°C và giữ nguyên nhiệt độ khi đang sôi. Chuyển từ lỏng sang hơi là bay hơi, từ hơi sang lỏng là ngưng tụ (a, d Đúng; b, c Sai).',
  },
  {
    id: 'b05-4st-3',
    code: 'TIN8-TF-03',
    source: 'builtin',
    subject: 'informatics',
    grade: '8',
    chapter: 'Đạo đức, pháp luật và văn hóa trong môi trường số',
    lesson: 'Sử dụng thông tin số an toàn và hợp pháp',
    level: 'understand',
    stem: 'Khi tìm kiếm và chia sẻ thông tin trên mạng xã hội hoặc Internet, xét các nhận định sau:',
    subItems: [
      {
        id: 'b05-4st-3a',
        label: 'a',
        text: 'Mọi thông tin đăng tải trên mạng xã hội đều đã được kiểm chứng và tuyệt đối chính xác.',
        isCorrect: false,
        explanation: 'Sai, thông tin trên mạng xã hội có thể chứa tin giả, cần đối chiếu từ nguồn chính thống.',
      },
      {
        id: 'b05-4st-3b',
        label: 'b',
        text: 'Khi trích dẫn bài viết hoặc hình ảnh của tác giả khác vào bài thuyết trình, cần ghi rõ nguồn và tên tác giả.',
        isCorrect: true,
        explanation: 'Đúng, ghi nguồn thể hiện sự tôn trọng bản quyền tác giả.',
      },
      {
        id: 'b05-4st-3c',
        label: 'c',
        text: 'Không nên tự ý đăng ảnh cá nhân và số điện thoại riêng tư của bạn học lên mạng khi chưa có sự đồng ý.',
        isCorrect: true,
        explanation: 'Đúng, bảo vệ quyền riêng tư và dữ liệu cá nhân của người khác.',
      },
      {
        id: 'b05-4st-3d',
        label: 'd',
        text: 'Có thể thoải mái bấm vào mọi đường link trúng thưởng lạ gửi qua tin nhắn để nhận quà.',
        isCorrect: false,
        explanation: 'Sai, các đường link lạ thường chứa mã độc hoặc lừa đảo chiếm đoạt tài khoản (Phishing).',
      },
    ],
    generalExplanation:
      'Người dùng thông minh cần kiểm chứng nguồn tin, tôn trọng bản quyền, bảo vệ dữ liệu cá nhân và cảnh giác trước các liên kết lừa đảo (b, c Đúng; a, d Sai).',
  },
];

// ============================================================================
// WEB AUDIO SYNTHESIZER FOR B05 GAME SHOW
// ============================================================================

class TrueFalseSoundEngine {
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

  public playStart(muted: boolean) {
    if (muted) return;
    [392, 523.25, 659.25, 783.99].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 150, 'triangle', 0.13), idx * 75);
    });
  }

  public playSelect(muted: boolean) {
    if (muted) return;
    this.playTone(580, 60, 'sine', 0.09);
  }

  public playLock(muted: boolean) {
    if (muted) return;
    this.playTone(440, 90, 'triangle', 0.11);
  }

  public playCorrect(muted: boolean) {
    if (muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 160, 'sine', 0.15), idx * 70);
    });
  }

  public playWrong(muted: boolean) {
    if (muted) return;
    [250, 196].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 240, 'sawtooth', 0.12), idx * 145);
    });
  }

  public playTimeout(muted: boolean) {
    if (muted) return;
    [330, 293.66, 246.94].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 200, 'triangle', 0.12), idx * 120);
    });
  }

  public playVictory(muted: boolean) {
    if (muted) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 220, 'triangle', 0.15), idx * 90);
    });
  }
}

const tfSound = new TrueFalseSoundEngine();

// ============================================================================
// MAIN COMPONENT: TrueFalseGame (B05)
// ============================================================================

export const TrueFalseGame: React.FC<TrueFalseGameProps> = ({
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
  // 1. Primary Mode & Stage State Machine
  const [playMode, setPlayMode] = useState<TrueFalsePlayMode>('LIGHTNING_REFLEX');
  const [stageState, setStageState] = useState<TrueFalseStageState>('READY');
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

  // 2. Question Filter & Source Configuration
  const [filterGrade, setFilterGrade] = useState<Grade | 'ALL'>('ALL');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterChapter, setFilterChapter] = useState<string>('');
  const [filterLesson, setFilterLesson] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<CognitiveLevel | 'ALL'>('ALL');
  const [targetQuestionCount, setTargetQuestionCount] = useState<number>(8);
  const [questionTimeSec, setQuestionTimeSec] = useState<number>(10); // Default 10s (5/10/15/20/30s)
  const [includeBuiltinFallback, setIncludeBuiltinFallback] = useState<boolean>(true);

  // 3. Scoring Rules & Bonuses
  const [pointsPerCorrect, setPointsPerCorrect] = useState<number>(10);
  const [enableStreakBonus, setEnableStreakBonus] = useState<boolean>(true);
  const [streakBonusPoints, setStreakBonusPoints] = useState<number>(5);
  const [enableSpeedBonus, setEnableSpeedBonus] = useState<boolean>(true);
  const [speedBonusPoints, setSpeedBonusPoints] = useState<number>(5);
  const [fourStatementScoringMethod, setFourStatementScoringMethod] =
    useState<FourStatementScoringMethod>('PER_ITEM_EQUAL');
  const [customTierPoints, setCustomTierPoints] = useState<[number, number, number, number]>([
    2, 5, 10, 20,
  ]); // 1 ý đúng, 2 ý đúng, 3 ý đúng, 4 ý đúng

  // 4. Custom Statements Added by Teacher in Session
  const [customSingleStatements, setCustomSingleStatements] = useState<SingleStatementItem[]>([]);
  const [newStatementText, setNewStatementText] = useState<string>('');
  const [newStatementIsTrue, setNewStatementIsTrue] = useState<boolean>(true);
  const [newStatementExplanation, setNewStatementExplanation] = useState<string>('');

  // 5. Active Question Index & Timer
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(10);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const questionStartTimestampRef = useRef<number>(Date.now());
  const sessionStartIsoRef = useRef<string>(new Date().toISOString());

  // 6. Mode 1, 2, 3 Single-Statement Selection State
  const [selectedChoice, setSelectedChoice] = useState<boolean | null>(null);
  const [calledStudent, setCalledStudent] = useState<StudentCandidate | null>(null);
  const [individualScore, setIndividualScore] = useState<number>(0);
  const [individualStreak, setIndividualStreak] = useState<number>(0);

  // Mode 2: Two Sides Arena (Đấu trường hai phía cả lớp)
  const [classCountTrueSide, setClassCountTrueSide] = useState<number>(0);
  const [classCountFalseSide, setClassCountFalseSide] = useState<number>(0);
  const [totalClassCorrectAccumulated, setTotalClassCorrectAccumulated] = useState<number>(0);

  // Mode 3: Team Battle (Thi đấu theo đội 2-4 đội)
  const [teamCount, setTeamCount] = useState<number>(3);
  const [teamTurnStyle, setTeamTurnStyle] = useState<TeamTurnStyle>('TURN_BASED');
  const [teams, setTeams] = useState<TrueFalseTeam[]>([]);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number>(0);
  const [buzzedTeamId, setBuzzedTeamId] = useState<string | null>(null);
  const [simultaneousTeamChoices, setSimultaneousTeamChoices] = useState<
    Record<string, boolean | null>
  >({});

  // Mode 4: Four Statements Challenge (a, b, c, d)
  const [fourChoices, setFourChoices] = useState<Record<'a' | 'b' | 'c' | 'd', boolean | null>>({
    a: null,
    b: null,
    c: null,
    d: null,
  });

  // Scoring Guard & Undo History
  const [scoredQuestionKeys, setScoredQuestionKeys] = useState<string[]>([]);
  const [scoreAuditLog, setScoreAuditLog] = useState<TrueFalseScoreAuditEntry[]>([]);
  const [lastRoundResultBanner, setLastRoundResultBanner] = useState<{
    isSuccess: boolean;
    headline: string;
    detail: string;
  } | null>(null);

  // ============================================================================
  // BUILD QUESTION POOLS FROM SUPABASE BANK + BUILT-IN
  // ============================================================================

  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((s) => !absentIds.has(s.id));
  }, [allCandidates, availableCandidates, absentIds]);

  const approvedBankQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (q.status === 'approved' || userRole === 'admin' || userRole === 'reviewer') {
        if (filterGrade !== 'ALL' && String(q.grade) !== String(filterGrade)) return false;
        if (filterSubject !== 'ALL' && q.subject !== filterSubject) return false;
        if (
          filterChapter.trim() &&
          q.chapter &&
          !q.chapter.toLowerCase().includes(filterChapter.toLowerCase())
        ) {
          return false;
        }
        if (
          filterLesson.trim() &&
          q.lesson &&
          !q.lesson.toLowerCase().includes(filterLesson.toLowerCase())
        ) {
          return false;
        }
        if (filterLevel !== 'ALL' && q.level !== filterLevel) return false;
        return true;
      }
      return false;
    });
  }, [
    questions,
    userRole,
    filterGrade,
    filterSubject,
    filterChapter,
    filterLesson,
    filterLevel,
  ]);

  // Extract 4-Statement Groups (Mode 4)
  const bankFourStatementGroups = useMemo<FourStatementGroupItem[]>(() => {
    return approvedBankQuestions
      .filter((q) => q.type === 'true_false_group' && Array.isArray(q.subItems) && q.subItems.length >= 4)
      .map((q) => {
        const subItems = (q.subItems as TrueFalseSubItem[]).slice(0, 4).map((sub, idx) => ({
          id: sub.id || `${q.id}-sub-${idx}`,
          label: (['a', 'b', 'c', 'd'][idx] || 'a') as 'a' | 'b' | 'c' | 'd',
          text: sub.text,
          isCorrect: Boolean(sub.isCorrect),
        }));
        return {
          id: q.id,
          code: q.code || `TF-${q.id.slice(0, 5)}`,
          source: 'bank',
          subject: String(q.subject || 'general'),
          grade: q.grade || '6',
          chapter: q.chapter || '',
          lesson: q.lesson || '',
          level: q.level || 'know',
          stem: q.stem,
          image: q.image,
          subItems,
          generalExplanation: q.explanation || 'Đối chiếu từng nhận định a, b, c, d với kiến thức bài học.',
        };
      });
  }, [approvedBankQuestions]);

  // Extract Single Statements (Mode 1, 2, 3) from true_false_group subItems (with contextStem preserved)
  const bankSingleStatements = useMemo<SingleStatementItem[]>(() => {
    const items: SingleStatementItem[] = [];
    bankFourStatementGroups.forEach((grp) => {
      grp.subItems.forEach((sub) => {
        items.push({
          id: `${grp.id}_${sub.label}`,
          source: 'bank',
          subject: grp.subject,
          grade: grp.grade,
          chapter: grp.chapter,
          lesson: grp.lesson,
          level: grp.level,
          contextStem: grp.stem,
          statementText: `Ý ${sub.label}) ${sub.text}`,
          isTrue: sub.isCorrect,
          explanation: grp.generalExplanation,
          image: grp.image,
        });
      });
    });
    return items;
  }, [bankFourStatementGroups]);

  const activeSingleDeck = useMemo<SingleStatementItem[]>(() => {
    const filteredBuiltin = includeBuiltinFallback
      ? BUILTIN_SINGLE_STATEMENTS.filter((item) => {
          if (filterGrade !== 'ALL' && item.grade !== filterGrade) return false;
          if (filterSubject !== 'ALL' && item.subject !== filterSubject) return false;
          if (filterLevel !== 'ALL' && item.level !== filterLevel) return false;
          return true;
        })
      : [];
    const combined = [...customSingleStatements, ...bankSingleStatements, ...filteredBuiltin];
    const pool = combined.length > 0 ? combined : BUILTIN_SINGLE_STATEMENTS;
    return pool.slice(0, targetQuestionCount);
  }, [
    customSingleStatements,
    bankSingleStatements,
    includeBuiltinFallback,
    filterGrade,
    filterSubject,
    filterLevel,
    targetQuestionCount,
  ]);

  const activeFourGroupDeck = useMemo<FourStatementGroupItem[]>(() => {
    const filteredBuiltin = includeBuiltinFallback
      ? BUILTIN_FOUR_STATEMENT_GROUPS.filter((item) => {
          if (filterGrade !== 'ALL' && item.grade !== filterGrade) return false;
          if (filterSubject !== 'ALL' && item.subject !== filterSubject) return false;
          if (filterLevel !== 'ALL' && item.level !== filterLevel) return false;
          return true;
        })
      : [];
    const combined = [...bankFourStatementGroups, ...filteredBuiltin];
    const pool = combined.length > 0 ? combined : BUILTIN_FOUR_STATEMENT_GROUPS;
    return pool.slice(0, targetQuestionCount);
  }, [
    bankFourStatementGroups,
    includeBuiltinFallback,
    filterGrade,
    filterSubject,
    filterLevel,
    targetQuestionCount,
  ]);

  const totalQuestionsInDeck =
    playMode === 'FOUR_STATEMENTS_CHALLENGE'
      ? activeFourGroupDeck.length
      : activeSingleDeck.length;

  const currentSingleItem =
    activeSingleDeck[Math.min(currentQuestionIndex, Math.max(0, activeSingleDeck.length - 1))] ||
    BUILTIN_SINGLE_STATEMENTS[0];

  const currentFourGroupItem =
    activeFourGroupDeck[
      Math.min(currentQuestionIndex, Math.max(0, activeFourGroupDeck.length - 1))
    ] || BUILTIN_FOUR_STATEMENT_GROUPS[0];

  // ============================================================================
  // INITIALIZE TEAMS & RESTORE SAVED CONFIG
  // ============================================================================

  const buildTeams = useCallback(
    (count: number): TrueFalseTeam[] => {
      return TEAM_PRESETS.slice(0, count).map((preset, idx) => ({
        id: preset.id,
        name: preset.name,
        colorHex: preset.colorHex,
        members: presentStudents.filter((_, i) => i % count === idx),
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        streak: 0,
        maxStreak: 0,
      }));
    },
    [presentStudents]
  );

  useEffect(() => {
    setTeams(buildTeams(teamCount));
  }, [teamCount, buildTeams]);

  // Restore favorite config on mount
  useEffect(() => {
    try {
      const rawFav = localStorage.getItem(STORAGE_FAV_CONFIG_KEY);
      if (rawFav) {
        const fav = JSON.parse(rawFav);
        if (typeof fav.questionTimeSec === 'number') setQuestionTimeSec(fav.questionTimeSec);
        if (typeof fav.pointsPerCorrect === 'number') setPointsPerCorrect(fav.pointsPerCorrect);
        if (typeof fav.enableStreakBonus === 'boolean') setEnableStreakBonus(fav.enableStreakBonus);
      }
    } catch {
      // Ignore
    }
  }, []);

  // ============================================================================
  // COUNTDOWN TIMER
  // ============================================================================

  useEffect(() => {
    if (!isTimerRunning) return;
    if (timeLeftSec <= 0) {
      setIsTimerRunning(false);
      tfSound.playTimeout(isMuted);
      setStageState('LOCKED');
      setLastRoundResultBanner({
        isSuccess: false,
        headline: 'HẾT THỜI GIAN TRẢ LỜI!',
        detail: 'Đồng hồ đã về 0s. Giáo viên nhấn "Công bố đáp án" để xem lời giải thích.',
      });
      return;
    }
    const timer = window.setInterval(() => {
      setTimeLeftSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTimerRunning, timeLeftSec, isMuted]);

  // ============================================================================
  // STATE MACHINE HANDLERS
  // ============================================================================

  const prepareQuestionRound = useCallback(
    (index: number) => {
      setCurrentQuestionIndex(index);
      setSelectedChoice(null);
      setFourChoices({ a: null, b: null, c: null, d: null });
      setSimultaneousTeamChoices({});
      setBuzzedTeamId(null);
      setLastRoundResultBanner(null);
      const defaultTime =
        playMode === 'FOUR_STATEMENTS_CHALLENGE'
          ? Math.max(20, questionTimeSec * 2)
          : questionTimeSec;
      setTimeLeftSec(defaultTime);
      setIsTimerRunning(true);
      questionStartTimestampRef.current = Date.now();
      setStageState('QUESTION_DISPLAYED');
    },
    [playMode, questionTimeSec]
  );

  const handleStartSession = () => {
    setScoredQuestionKeys([]);
    setScoreAuditLog([]);
    setIndividualScore(0);
    setIndividualStreak(0);
    setTotalClassCorrectAccumulated(0);
    setTeams(buildTeams(teamCount));
    sessionStartIsoRef.current = new Date().toISOString();
    tfSound.playStart(isMuted);
    prepareQuestionRound(0);
  };

  const handlePickRandomStudent = () => {
    if (!presentStudents.length) return;
    const idx = Math.floor(Math.random() * presentStudents.length);
    setCalledStudent(presentStudents[idx]);
    tfSound.playSelect(isMuted);
  };

  const handleChooseSingleOption = (choice: boolean) => {
    if (
      stageState === 'LOCKED' ||
      stageState === 'REVEALING' ||
      stageState === 'SCORING' ||
      stageState === 'FINISHED'
    ) {
      return;
    }
    setSelectedChoice(choice);
    setStageState('ANSWERING');
    tfSound.playSelect(isMuted);
  };

  const handleLockAnswer = () => {
    if (
      stageState === 'LOCKED' ||
      stageState === 'REVEALING' ||
      stageState === 'SCORING' ||
      stageState === 'FINISHED'
    ) {
      return;
    }
    setIsTimerRunning(false);
    setStageState('LOCKED');
    tfSound.playLock(isMuted);
  };

  // Persist completed session to Supabase public.audit_logs
  const persistSessionToSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      await supabase.from('audit_logs').insert({
        actor_id: teacherId,
        actor_role: 'teacher',
        action_type: 'EDU_GAME_SESSION_COMPLETED',
        entity_type: 'edu_game_b05',
        entity_id: `B05_${Date.now()}`,
        metadata: {
          game_id: 'B05',
          game_title: 'Đúng hay sai (EDU True or False Challenge 1.0)',
          play_mode: playMode,
          class_name: resolvedClassName,
          teacher_name: teacherName,
          question_count: totalQuestionsInDeck,
          individual_score: individualScore,
          class_total_correct: totalClassCorrectAccumulated,
          teams_summary: teams.map((t) => ({
            name: t.name,
            score: t.score,
            correctCount: t.correctCount,
            wrongCount: t.wrongCount,
            maxStreak: t.maxStreak,
          })),
          audit_entries: scoreAuditLog.slice(0, 20),
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
    totalQuestionsInDeck,
    individualScore,
    totalClassCorrectAccumulated,
    teams,
    scoreAuditLog,
  ]);

  // Reveal & Score Current Question
  const handleRevealAndScore = () => {
    const roundKey = `${playMode}-q-${currentQuestionIndex}`;
    const alreadyScored = scoredQuestionKeys.includes(roundKey);
    setIsTimerRunning(false);
    setStageState('REVEALING');

    const responseMs = Math.max(0, Date.now() - questionStartTimestampRef.current);
    const isFastResponse = enableSpeedBonus && responseMs <= 4500 && timeLeftSec > 0;

    // ------------------------------------------------------------------------
    // CASE A: MODE 4 – FOUR STATEMENTS CHALLENGE (a, b, c, d)
    // ------------------------------------------------------------------------
    if (playMode === 'FOUR_STATEMENTS_CHALLENGE') {
      let correctSubCount = 0;
      currentFourGroupItem.subItems.forEach((sub) => {
        if (fourChoices[sub.label] === sub.isCorrect) {
          correctSubCount += 1;
        }
      });

      let earnedPoints = 0;
      if (fourStatementScoringMethod === 'PER_ITEM_EQUAL') {
        earnedPoints = correctSubCount * 5; // 5đ mỗi ý đúng (tương đương 0.25đ x 4 = 1.0đ chuẩn)
      } else {
        earnedPoints =
          correctSubCount > 0 ? customTierPoints[correctSubCount - 1] || 0 : 0;
      }

      if (correctSubCount >= 3) {
        tfSound.playCorrect(isMuted);
      } else {
        tfSound.playWrong(isMuted);
      }

      if (!alreadyScored) {
        setScoredQuestionKeys((prev) => [...prev, roundKey]);
        if (teams.length > 0) {
          const targetTeam = teams[activeTeamIndex];
          setTeams((prev) =>
            prev.map((t, idx) =>
              idx === activeTeamIndex
                ? {
                    ...t,
                    score: t.score + earnedPoints,
                    correctCount: t.correctCount + (correctSubCount === 4 ? 1 : 0),
                    wrongCount: t.wrongCount + (correctSubCount < 4 ? 1 : 0),
                  }
                : t
            )
          );
          setScoreAuditLog((prev) => [
            {
              id: `aud-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              questionIndex: currentQuestionIndex + 1,
              targetName: targetTeam.name,
              teamId: targetTeam.id,
              deltaPoints: earnedPoints,
              reason: `Đúng ${correctSubCount}/4 nhận định (+${earnedPoints}đ · quy đổi ${(
                correctSubCount * 0.25
              ).toFixed(2)}/1.0đ)`,
            },
            ...prev,
          ]);
        } else {
          setIndividualScore((prev) => prev + earnedPoints);
        }
      }

      setLastRoundResultBanner({
        isSuccess: correctSubCount >= 3,
        headline: `KẾT QUẢ 4 NHẬN ĐỊNH: ĐÚNG ${correctSubCount}/4 Ý (+${earnedPoints} điểm)`,
        detail: `Quy đổi thang 1,0 điểm: ${(correctSubCount * 0.25).toFixed(2)} điểm. ${
          currentFourGroupItem.generalExplanation
        }`,
      });
      setStageState('SCORING');
      return;
    }

    // ------------------------------------------------------------------------
    // CASE B: MODE 2 – TWO SIDES ARENA (Cả lớp chọn phía ĐÚNG / SAI)
    // ------------------------------------------------------------------------
    if (playMode === 'TWO_SIDES_ARENA') {
      const truth = currentSingleItem.isTrue;
      const winningStudentsCount = truth ? classCountTrueSide : classCountFalseSide;
      tfSound.playCorrect(isMuted);

      if (!alreadyScored) {
        setScoredQuestionKeys((prev) => [...prev, roundKey]);
        setTotalClassCorrectAccumulated((prev) => prev + winningStudentsCount);
        setScoreAuditLog((prev) => [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            questionIndex: currentQuestionIndex + 1,
            targetName: `Cả lớp (${winningStudentsCount} HS chọn đúng)`,
            deltaPoints: winningStudentsCount * pointsPerCorrect,
            reason: `Đáp án ${truth ? 'ĐÚNG' : 'SAI'} · Giáo viên xác nhận ${winningStudentsCount} HS trả lời đúng`,
          },
          ...prev,
        ]);
      }

      setLastRoundResultBanner({
        isSuccess: true,
        headline: `ĐÁP ÁN CHÍNH XÁC: ${truth ? 'ĐÚNG' : 'SAI'} (${winningStudentsCount} học sinh chọn đúng)`,
        detail: currentSingleItem.explanation,
      });
      setStageState('SCORING');
      return;
    }

    // ------------------------------------------------------------------------
    // CASE C: MODE 3 – TEAM BATTLE (All Teams Simultaneous)
    // ------------------------------------------------------------------------
    if (playMode === 'TEAM_BATTLE' && teamTurnStyle === 'ALL_TEAMS_SIMULTANEOUS') {
      const truth = currentSingleItem.isTrue;
      tfSound.playCorrect(isMuted);

      if (!alreadyScored) {
        setScoredQuestionKeys((prev) => [...prev, roundKey]);
        setTeams((prev) =>
          prev.map((team) => {
            const teamPick = simultaneousTeamChoices[team.id];
            const isTeamRight = teamPick === truth;
            const nextStreak = isTeamRight ? team.streak + 1 : 0;
            const streakBonus =
              isTeamRight && enableStreakBonus && nextStreak > 0 && nextStreak % 3 === 0
                ? streakBonusPoints
                : 0;
            const gained = isTeamRight ? pointsPerCorrect + streakBonus : 0;
            return {
              ...team,
              score: team.score + gained,
              correctCount: team.correctCount + (isTeamRight ? 1 : 0),
              wrongCount: team.wrongCount + (isTeamRight ? 0 : 1),
              streak: nextStreak,
              maxStreak: Math.max(team.maxStreak, nextStreak),
            };
          })
        );
      }

      setLastRoundResultBanner({
        isSuccess: true,
        headline: `CÔNG BỐ ĐÁP ÁN: ${truth ? 'ĐÚNG' : 'SAI'}`,
        detail: currentSingleItem.explanation,
      });
      setStageState('SCORING');
      return;
    }

    // ------------------------------------------------------------------------
    // CASE D: MODE 1 (LIGHTNING REFLEX) OR MODE 3 (TURN_BASED / BUZZER_CLAIM)
    // ------------------------------------------------------------------------
    const truth = currentSingleItem.isTrue;
    const isCorrect = selectedChoice !== null && selectedChoice === truth;

    if (isCorrect) {
      tfSound.playCorrect(isMuted);
    } else {
      tfSound.playWrong(isMuted);
    }

    if (!alreadyScored && selectedChoice !== null) {
      setScoredQuestionKeys((prev) => [...prev, roundKey]);

      if (playMode === 'TEAM_BATTLE' && teams.length > 0) {
        const targetIdx =
          teamTurnStyle === 'BUZZER_CLAIM' && buzzedTeamId
            ? Math.max(
                0,
                teams.findIndex((t) => t.id === buzzedTeamId)
              )
            : activeTeamIndex;
        const targetTeam = teams[targetIdx] || teams[0];
        const nextStreak = isCorrect ? targetTeam.streak + 1 : 0;
        const streakBonus =
          isCorrect && enableStreakBonus && nextStreak > 0 && nextStreak % 3 === 0
            ? streakBonusPoints
            : 0;
        const fastBonus = isCorrect && isFastResponse ? speedBonusPoints : 0;
        const totalAward = isCorrect ? pointsPerCorrect + streakBonus + fastBonus : 0;

        setTeams((prev) =>
          prev.map((t, idx) =>
            idx === targetIdx
              ? {
                  ...t,
                  score: t.score + totalAward,
                  correctCount: t.correctCount + (isCorrect ? 1 : 0),
                  wrongCount: t.wrongCount + (isCorrect ? 0 : 1),
                  streak: nextStreak,
                  maxStreak: Math.max(t.maxStreak, nextStreak),
                }
              : t
          )
        );

        setScoreAuditLog((prev) => [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            questionIndex: currentQuestionIndex + 1,
            targetName: targetTeam.name,
            teamId: targetTeam.id,
            deltaPoints: totalAward,
            reason: isCorrect
              ? `Trả lời ĐÚNG (+${pointsPerCorrect}đ${
                  streakBonus ? ` +${streakBonus}đ chuỗi 3` : ''
                }${fastBonus ? ` +${fastBonus}đ tốc độ` : ''})`
              : 'Trả lời SAI (0đ)',
          },
          ...prev,
        ]);
      } else {
        // Individual / Lightning Reflex
        const nextStreak = isCorrect ? individualStreak + 1 : 0;
        setIndividualStreak(nextStreak);
        const streakBonus =
          isCorrect && enableStreakBonus && nextStreak > 0 && nextStreak % 3 === 0
            ? streakBonusPoints
            : 0;
        const fastBonus = isCorrect && isFastResponse ? speedBonusPoints : 0;
        const totalAward = isCorrect ? pointsPerCorrect + streakBonus + fastBonus : 0;
        setIndividualScore((prev) => prev + totalAward);

        setScoreAuditLog((prev) => [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            questionIndex: currentQuestionIndex + 1,
            targetName: calledStudent ? calledStudent.fullName : 'Cá nhân / Lớp',
            deltaPoints: totalAward,
            reason: isCorrect
              ? `Trả lời ĐÚNG (+${totalAward}đ)`
              : 'Trả lời SAI (0đ)',
          },
          ...prev,
        ]);
      }
    }

    setLastRoundResultBanner({
      isSuccess: isCorrect,
      headline:
        selectedChoice === null
          ? `ĐÁP ÁN CHÍNH XÁC LÀ: ${truth ? 'ĐÚNG' : 'SAI'}`
          : isCorrect
          ? `CHÍNH XÁC! ĐÁP ÁN LÀ ${truth ? 'ĐÚNG' : 'SAI'}`
          : `CHƯA CHÍNH XÁC! ĐÁP ÁN ĐÚNG LÀ ${truth ? 'ĐÚNG' : 'SAI'}`,
      detail: currentSingleItem.explanation,
    });
    setStageState('SCORING');
  };

  // Next Question or Finish Session
  const handleNextQuestion = () => {
    if (currentQuestionIndex + 1 >= totalQuestionsInDeck) {
      setIsTimerRunning(false);
      setStageState('FINISHED');
      tfSound.playVictory(isMuted);
      persistSessionToSupabase();
      return;
    }

    if (playMode === 'TEAM_BATTLE' && teams.length > 1) {
      setActiveTeamIndex((prev) => (prev + 1) % teams.length);
    }
    setStageState('NEXT_QUESTION');
    prepareQuestionRound(currentQuestionIndex + 1);
  };

  // Undo Last Score Entry
  const handleUndoLastScore = () => {
    if (scoreAuditLog.length === 0) return;
    const [latest, ...rest] = scoreAuditLog;
    setScoreAuditLog(rest);
    if (latest.teamId) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === latest.teamId
            ? { ...t, score: Math.max(0, t.score - latest.deltaPoints) }
            : t
        )
      );
    } else {
      setIndividualScore((prev) => Math.max(0, prev - latest.deltaPoints));
    }
  };

  // Add manual statement
  const handleAddManualStatement = () => {
    if (!newStatementText.trim()) return;
    const created: SingleStatementItem = {
      id: `manual-b05-${Date.now()}`,
      source: 'manual',
      subject: filterSubject === 'ALL' ? 'general' : filterSubject,
      grade: filterGrade === 'ALL' ? '6' : filterGrade,
      chapter: filterChapter || 'Chủ đề bổ sung',
      lesson: filterLesson || 'Bài học bổ sung',
      level: 'know',
      statementText: newStatementText.trim(),
      isTrue: newStatementIsTrue,
      explanation:
        newStatementExplanation.trim() ||
        `Nhận định này có đáp án chuẩn là ${newStatementIsTrue ? 'ĐÚNG' : 'SAI'}.`,
    };
    setCustomSingleStatements((prev) => [created, ...prev]);
    setNewStatementText('');
    setNewStatementExplanation('');
  };

  // Save favorite config
  const handleSaveFavoriteConfig = () => {
    try {
      localStorage.setItem(
        STORAGE_FAV_CONFIG_KEY,
        JSON.stringify({
          questionTimeSec,
          pointsPerCorrect,
          enableStreakBonus,
        })
      );
    } catch {
      // Ignore
    }
  };

  // Start first question when mounting in READY state
  useEffect(() => {
    if (stageState === 'READY') {
      prepareQuestionRound(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // RENDER UI
  // ============================================================================

  const maxTimerForCurrent =
    playMode === 'FOUR_STATEMENTS_CHALLENGE'
      ? Math.max(20, questionTimeSec * 2)
      : questionTimeSec;
  const timerProgressPercent = Math.max(
    0,
    Math.min(100, (timeLeftSec / Math.max(1, maxTimerForCurrent)) * 100)
  );

  return (
    <div className="space-y-4">
      {/* TOP GAME SHOW BAR */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-700/80 p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Game Identity & 4 Mode Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5 pr-3 border-r border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-rose-500 flex items-center justify-center text-slate-950 font-black shadow-md">
                <SplitSquareVertical className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 tracking-wider">
                    B05 · KHỞI ĐỘNG
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-sky-300 font-semibold">{resolvedClassName}</span>
                </div>
                <h2 className="text-base font-black tracking-tight text-white">
                  Đúng Hay Sai – EDU True or False Challenge
                </h2>
              </div>
            </div>

            {/* 4 Segmented Play Modes */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setPlayMode('LIGHTNING_REFLEX');
                  setCurrentQuestionIndex(0);
                  prepareQuestionRound(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  playMode === 'LIGHTNING_REFLEX'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                1. Phản xạ chớp nhoáng
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayMode('TWO_SIDES_ARENA');
                  setCurrentQuestionIndex(0);
                  prepareQuestionRound(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  playMode === 'TWO_SIDES_ARENA'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
                2. Đấu trường hai phía
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayMode('TEAM_BATTLE');
                  setCurrentQuestionIndex(0);
                  prepareQuestionRound(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  playMode === 'TEAM_BATTLE'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                3. Thi đấu theo đội
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayMode('FOUR_STATEMENTS_CHALLENGE');
                  setCurrentQuestionIndex(0);
                  prepareQuestionRound(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  playMode === 'FOUR_STATEMENTS_CHALLENGE'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                4. Thử thách 4 nhận định (a–d)
              </button>
            </div>
          </div>

          {/* Right: Setup, Sound, Absent & Fullscreen Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSetupModal((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                showSetupModal
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Cấu hình & Ngân hàng ({approvedBankQuestions.length})
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
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

            <button
              type="button"
              onClick={handleStartSession}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Ván mới
            </button>

            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
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
      {/* COLLAPSIBLE SETUP & QUESTION BANK CONFIGURATION PANEL                */}
      {/* ==================================================================== */}
      {showSetupModal && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Thiết Lập Trò Chơi B05 & Lọc Ngân Hàng Câu Hỏi Smart EDU
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Tùy chỉnh thời gian đếm ngược, nguồn câu hỏi từ Ngân hàng Supabase, quy tắc chấm điểm và thưởng chuỗi.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveFavoriteConfig}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
              >
                Lưu cấu hình yêu thích
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSetupModal(false);
                  handleStartSession();
                }}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                Áp dụng & Bắt đầu
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value as Grade | 'ALL')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value="ALL">Tất cả khối (6–9)</option>
                <option value="6">Khối 6</option>
                <option value="7">Khối 7</option>
                <option value="8">Khối 8</option>
                <option value="9">Khối 9</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn học</label>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value="ALL">Tất cả môn học</option>
                {Object.entries(SUBJECT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ nhận thức</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as CognitiveLevel | 'ALL')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value="ALL">Tất cả mức độ</option>
                <option value="know">Nhận biết</option>
                <option value="understand">Thông hiểu</option>
                <option value="apply">Vận dụng</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Thời gian suy nghĩ / câu
              </label>
              <select
                value={questionTimeSec}
                onChange={(e) => setQuestionTimeSec(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value={5}>5 giây (Siêu tốc)</option>
                <option value={10}>10 giây (Mặc định)</option>
                <option value={15}>15 giây</option>
                <option value={20}>20 giây</option>
                <option value={30}>30 giây</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng câu hỏi</label>
              <select
                value={targetQuestionCount}
                onChange={(e) => setTargetQuestionCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
              >
                <option value={5}>5 câu</option>
                <option value={8}>8 câu</option>
                <option value={10}>10 câu</option>
                <option value={15}>15 câu</option>
              </select>
            </div>
          </div>

          {/* Question Bank Status Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900">
                Trạng thái Ngân hàng câu hỏi Đúng/Sai đã duyệt: {bankFourStatementGroups.length} câu 4 nhận định ({bankSingleStatements.length} nhận định đơn)
              </div>
              <div className="text-slate-600">
                Hệ thống không tự ý biến phương án sai của câu trắc nghiệm ABCD thành nhận định Sai khi thiếu bối cảnh. Nếu ngân hàng chưa đủ số câu yêu cầu, bạn có thể bật bộ câu hỏi chuẩn THCS tích hợp sẵn hoặc thêm nhận định mới bên dưới.
              </div>
            </div>
            <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBuiltinFallback}
                onChange={(e) => setIncludeBuiltinFallback(e.target.checked)}
                className="rounded border-slate-300"
              />
              Kết hợp bộ câu hỏi chuẩn THCS tích hợp sẵn
            </label>
          </div>

          {/* Quick Add Custom True/False Statement */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              Thêm nhanh nhận định Đúng/Sai của Giáo viên vào phiên hiện tại
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <input
                type="text"
                value={newStatementText}
                onChange={(e) => setNewStatementText(e.target.value)}
                placeholder="Nhập nội dung nhận định (VD: Tổng ba góc trong một tam giác bằng 180°.)"
                className="md:col-span-5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 bg-white"
              />
              <select
                value={newStatementIsTrue ? 'TRUE' : 'FALSE'}
                onChange={(e) => setNewStatementIsTrue(e.target.value === 'TRUE')}
                className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 bg-white"
              >
                <option value="TRUE">Đáp án: ĐÚNG</option>
                <option value="FALSE">Đáp án: SAI</option>
              </select>
              <input
                type="text"
                value={newStatementExplanation}
                onChange={(e) => setNewStatementExplanation(e.target.value)}
                placeholder="Giải thích ngắn gọn..."
                className="md:col-span-3 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 bg-white"
              />
              <button
                type="button"
                onClick={handleAddManualStatement}
                className="md:col-span-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3"
              >
                + Thêm nhận định
              </button>
            </div>
          </div>

          {/* Online Participation Transparency Notice (Section X & XIV) */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Chế độ tham gia trực tuyến bằng điện thoại học sinh:</strong> Hiện ở trạng thái <em>Đang phát triển (Chưa đánh dấu Sẵn sàng)</em> để đảm bảo chống gian lận máy chủ. Phiên bản hiện tại ưu tiên hoàn thiện 100% chế độ trình chiếu trực tiếp trên lớp học.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MAIN GAME SHOW STAGE (65-70% LEFT) & SCOREBOARD PANEL (30-35% RIGHT) */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT 8 COLUMNS (~67%): QUESTION & TRUE/FALSE ARENA STAGE */}
        <div className="lg:col-span-8 bg-gradient-to-b from-[#071126] via-[#0D1F40] to-[#0F172A] rounded-2xl border border-sky-500/30 p-5 sm:p-6 text-white flex flex-col justify-between relative overflow-hidden shadow-xl min-h-[580px]">
          {/* Stage Header: Question Progress, Subject Meta & Circular Countdown */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-3.5">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                <span>
                  CÂU {currentQuestionIndex + 1} / {totalQuestionsInDeck}
                </span>
                <span>·</span>
                <span>
                  {playMode === 'FOUR_STATEMENTS_CHALLENGE'
                    ? SUBJECT_LABELS[currentFourGroupItem.subject] || currentFourGroupItem.subject
                    : SUBJECT_LABELS[currentSingleItem.subject] || currentSingleItem.subject}
                </span>
                <span>·</span>
                <span>
                  Khối{' '}
                  {playMode === 'FOUR_STATEMENTS_CHALLENGE'
                    ? currentFourGroupItem.grade
                    : currentSingleItem.grade}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-200 mt-0.5">
                {playMode === 'LIGHTNING_REFLEX'
                  ? 'Chế độ 1: Phản xạ chớp nhoáng (Chọn ĐÚNG hoặc SAI)'
                  : playMode === 'TWO_SIDES_ARENA'
                  ? 'Chế độ 2: Đấu trường hai phía (Tương tác cả lớp)'
                  : playMode === 'TEAM_BATTLE'
                  ? `Chế độ 3: Thi đấu theo đội (${teams[activeTeamIndex]?.name || 'Đội 1'})`
                  : 'Chế độ 4: Thử thách 4 nhận định (Xét tính Đúng/Sai của 4 ý a, b, c, d)'}
              </h3>
            </div>

            {/* Circular Countdown Clock & Progress Bar */}
            <div className="flex items-center gap-3">
              <div className="w-32 hidden sm:block">
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>{isTimerRunning ? 'Đang đếm ngược' : 'Đã dừng đồng hồ'}</span>
                  <span className="font-mono tabular-nums text-amber-300">{timeLeftSec}s</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      timeLeftSec <= 3
                        ? 'bg-rose-500'
                        : timeLeftSec <= 6
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${timerProgressPercent}%` }}
                  />
                </div>
              </div>

              <div
                className={`w-12 h-12 rounded-2xl border-2 flex flex-col items-center justify-center font-mono font-black tabular-nums ${
                  timeLeftSec <= 3
                    ? 'bg-rose-950 border-rose-400 text-rose-300'
                    : 'bg-slate-900 border-amber-400 text-amber-300'
                }`}
              >
                <span className="text-base leading-none">{timeLeftSec}</span>
                <span className="text-[9px] text-slate-400">GIÂY</span>
              </div>
            </div>
          </div>

          {/* CENTER STAGE: STATEMENT DISPLAY & INTERACTIVE TRUE/FALSE BUTTONS */}
          {stageState === 'FINISHED' ? (
            <div className="relative z-10 my-auto py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center mx-auto">
                <Trophy className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white">
                  HOÀN THÀNH PHIÊN CHƠI B05 – ĐÚNG HAY SAI!
                </h3>
                <p className="text-sm text-slate-300">
                  Đã hoàn thành {totalQuestionsInDeck} thử thách. Kết quả phiên chơi đã được ghi nhận.
                </p>
              </div>

              {playMode === 'TEAM_BATTLE' && teams.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
                  {[...teams]
                    .sort((a, b) => b.score - a.score)
                    .map((t, idx) => (
                      <div
                        key={t.id}
                        className="p-4 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-amber-400">Hạng #{idx + 1}</div>
                          <div className="text-sm font-black text-white">{t.name}</div>
                          <div className="text-xs text-slate-400">
                            Đúng {t.correctCount} · Chuỗi cao nhất: {t.maxStreak}
                          </div>
                        </div>
                        <div className="text-xl font-mono font-black text-emerald-400 tabular-nums">
                          {t.score}đ
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="inline-block px-6 py-4 rounded-2xl bg-slate-900 border border-amber-400/50">
                  <div className="text-xs text-slate-400">TỔNG ĐIỂM ĐẠT ĐƯỢC</div>
                  <div className="text-3xl font-mono font-black text-amber-300 mt-1 tabular-nums">
                    {individualScore} điểm
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={handleStartSession}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg"
                >
                  Chơi lại phiên mới
                </button>
              </div>
            </div>
          ) : playMode === 'FOUR_STATEMENTS_CHALLENGE' ? (
            /* ================================================================ */
            /* MODE 4: FOUR STATEMENTS CHALLENGE (a, b, c, d)                   */
            /* ================================================================ */
            <div className="relative z-10 my-3 space-y-4 overflow-y-auto max-h-[440px] pr-1">
              {/* Stem Box */}
              <div className="bg-slate-900/95 border border-purple-400/40 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs font-bold text-purple-300 mb-1">
                  <span>CÂU DẪN / TÌNH HUỐNG ({currentFourGroupItem.code})</span>
                  <span>
                    {fourStatementScoringMethod === 'PER_ITEM_EQUAL'
                      ? 'Phương án A: Mỗi ý đúng +5đ (0,25đ/ý)'
                      : 'Phương án B: Bảng điểm lũy tiến'}
                  </span>
                </div>
                <p className="text-base sm:text-lg font-extrabold text-white leading-relaxed">
                  {currentFourGroupItem.stem}
                </p>
              </div>

              {/* 4 Sub-items a, b, c, d */}
              <div className="space-y-2.5">
                {currentFourGroupItem.subItems.map((sub) => {
                  const chosen = fourChoices[sub.label];
                  const isRevealed = stageState === 'REVEALING' || stageState === 'SCORING';
                  const isSubRight = chosen === sub.isCorrect;

                  return (
                    <div
                      key={sub.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isRevealed
                          ? isSubRight
                            ? 'bg-emerald-950/75 border-emerald-400'
                            : 'bg-rose-950/75 border-rose-400'
                          : 'bg-slate-900/85 border-slate-700'
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="text-sm font-bold text-white leading-snug">
                          <span className="text-amber-300 font-black mr-1.5">
                            Ý {sub.label})
                          </span>
                          {sub.text}
                        </div>
                        {isRevealed && (
                          <div className="text-xs text-slate-300">
                            Đáp án đúng:{' '}
                            <strong
                              className={
                                sub.isCorrect ? 'text-emerald-300' : 'text-rose-300'
                              }
                            >
                              {sub.isCorrect ? 'ĐÚNG' : 'SAI'}
                            </strong>
                            {sub.explanation ? ` — ${sub.explanation}` : ''}
                          </div>
                        )}
                      </div>

                      {/* ĐÚNG / SAI Toggle Buttons for Sub-item */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={
                            stageState === 'LOCKED' ||
                            stageState === 'REVEALING' ||
                            stageState === 'SCORING'
                          }
                          onClick={() => {
                            setFourChoices((prev) => ({ ...prev, [sub.label]: true }));
                            setStageState('ANSWERING');
                            tfSound.playSelect(isMuted);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-1 ${
                            chosen === true
                              ? 'bg-emerald-500 border-emerald-300 text-slate-950 shadow-md'
                              : 'bg-slate-800 border-slate-600 text-emerald-300 hover:border-emerald-400'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          ĐÚNG
                        </button>
                        <button
                          type="button"
                          disabled={
                            stageState === 'LOCKED' ||
                            stageState === 'REVEALING' ||
                            stageState === 'SCORING'
                          }
                          onClick={() => {
                            setFourChoices((prev) => ({ ...prev, [sub.label]: false }));
                            setStageState('ANSWERING');
                            tfSound.playSelect(isMuted);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-1 ${
                            chosen === false
                              ? 'bg-rose-500 border-rose-300 text-white shadow-md'
                              : 'bg-slate-800 border-slate-600 text-rose-300 hover:border-rose-400'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          SAI
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================================================================ */
            /* MODE 1, 2, 3: SINGLE STATEMENT & GIANT SYMMETRIC ĐÚNG/SAI ARENA  */
            /* ================================================================ */
            <div className="relative z-10 my-auto space-y-5 py-3">
              {/* Statement Display Card */}
              <div className="bg-slate-900/95 border-2 border-sky-400/40 rounded-2xl p-5 sm:p-6 shadow-inner space-y-2">
                {currentSingleItem.contextStem && (
                  <div className="text-xs font-semibold text-sky-300 bg-sky-950/60 border border-sky-800/60 rounded-lg px-3 py-1.5">
                    Ngữ cảnh: {currentSingleItem.contextStem}
                  </div>
                )}
                <div
                  className={`font-black text-white leading-relaxed ${
                    isFullscreen ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
                  }`}
                >
                  {currentSingleItem.statementText}
                </div>
              </div>

              {/* TWO SYMMETRIC GIANT BUTTONS: ĐÚNG (GREEN) & SAI (RED/ROSE) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ĐÚNG BUTTON */}
                <button
                  type="button"
                  disabled={
                    stageState === 'LOCKED' ||
                    stageState === 'REVEALING' ||
                    stageState === 'SCORING'
                  }
                  onClick={() => handleChooseSingleOption(true)}
                  className={`group relative rounded-2xl p-6 border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                    selectedChoice === true
                      ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 border-white text-slate-950 shadow-xl scale-[1.01]'
                      : 'bg-gradient-to-b from-emerald-600/90 to-emerald-800/90 hover:from-emerald-500 hover:to-emerald-700 border-emerald-400/70 text-white shadow-lg'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-black/20 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black tracking-wide">ĐÚNG</span>
                  <span className="text-xs font-bold opacity-90">
                    {selectedChoice === true ? 'Đã chọn ĐÚNG' : 'Nhấn để chọn ĐÚNG'}
                  </span>
                </button>

                {/* SAI BUTTON */}
                <button
                  type="button"
                  disabled={
                    stageState === 'LOCKED' ||
                    stageState === 'REVEALING' ||
                    stageState === 'SCORING'
                  }
                  onClick={() => handleChooseSingleOption(false)}
                  className={`group relative rounded-2xl p-6 border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                    selectedChoice === false
                      ? 'bg-gradient-to-b from-rose-400 to-rose-600 border-white text-white shadow-xl scale-[1.01]'
                      : 'bg-gradient-to-b from-rose-600/90 to-rose-800/90 hover:from-rose-500 hover:to-rose-700 border-rose-400/70 text-white shadow-lg'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-black/20 flex items-center justify-center">
                    <XCircle className="w-8 h-8" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black tracking-wide">SAI</span>
                  <span className="text-xs font-bold opacity-90">
                    {selectedChoice === false ? 'Đã chọn SAI' : 'Nhấn để chọn SAI'}
                  </span>
                </button>
              </div>

              {/* MODE 2 EXTRA BAR: TWO-SIDES CLASSROOM COUNTER */}
              {playMode === 'TWO_SIDES_ARENA' && (
                <div className="bg-slate-900/90 border border-sky-500/40 rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-sky-300">
                      Ghi nhận số học sinh chọn mỗi phía (Giơ bảng Đ/S hoặc di chuyển 2 phía):
                    </span>
                    <span className="text-slate-400">
                      Chỉ lưu số liệu Giáo viên thực tế nhập/xác nhận trên lớp
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between bg-emerald-950/70 border border-emerald-500/40 rounded-xl px-3.5 py-2">
                      <span className="text-xs font-bold text-emerald-300">
                        Số HS chọn phía ĐÚNG:
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={classCountTrueSide}
                        onChange={(e) =>
                          setClassCountTrueSide(Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-16 rounded-lg bg-slate-900 border border-emerald-400 px-2 py-1 text-center font-mono font-black text-emerald-300"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-rose-950/70 border border-rose-500/40 rounded-xl px-3.5 py-2">
                      <span className="text-xs font-bold text-rose-300">
                        Số HS chọn phía SAI:
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={classCountFalseSide}
                        onChange={(e) =>
                          setClassCountFalseSide(Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-16 rounded-lg bg-slate-900 border border-rose-400 px-2 py-1 text-center font-mono font-black text-rose-300"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOTTOM STAGE BAR: EXPLANATION REVEAL & ROUND ACTION BUTTONS */}
          {stageState !== 'FINISHED' && (
            <div className="relative z-10 space-y-3 pt-3 border-t border-slate-800">
              {lastRoundResultBanner && (
                <div
                  className={`p-4 rounded-xl border ${
                    lastRoundResultBanner.isSuccess
                      ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100'
                      : 'bg-rose-950/90 border-rose-400 text-rose-100'
                  }`}
                >
                  <div className="font-black text-sm flex items-center gap-2">
                    {lastRoundResultBanner.isSuccess ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{lastRoundResultBanner.headline}</span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                    {lastRoundResultBanner.detail}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLockAnswer}
                    disabled={
                      stageState === 'LOCKED' ||
                      stageState === 'REVEALING' ||
                      stageState === 'SCORING'
                    }
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    1. Khóa đáp án
                  </button>

                  <button
                    type="button"
                    onClick={handleRevealAndScore}
                    disabled={stageState === 'SCORING'}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    2. Công bố đáp án & Giải thích
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <SkipForward className="w-4 h-4" />
                    {currentQuestionIndex + 1 >= totalQuestionsInDeck
                      ? 'Kết thúc & Xem bảng vàng'
                      : 'Câu tiếp theo'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT 4 COLUMNS (~33%): SCOREBOARD, TEAM CONTROLS & AUDIT LOG */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* STUDENT PICKER / MODE CONTROL CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-blue-600" />
                Điều Khiển Lượt Chơi & Chấm Điểm
              </h4>
              {scoreAuditLog.length > 0 && (
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

            {/* Individual Student Caller */}
            {playMode !== 'TEAM_BATTLE' && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Học sinh trả lời:</span>
                  <button
                    type="button"
                    onClick={handlePickRandomStudent}
                    className="text-blue-600 hover:underline font-bold"
                  >
                    Gọi ngẫu nhiên
                  </button>
                </div>
                <div className="text-sm font-black text-slate-900">
                  {calledStudent
                    ? `${calledStudent.fullName} (${calledStudent.code})`
                    : 'Cả lớp cùng tham gia'}
                </div>
              </div>
            )}

            {/* Mode 4 Scoring Method Switcher */}
            {playMode === 'FOUR_STATEMENTS_CHALLENGE' && (
              <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200 space-y-2">
                <div className="text-xs font-black text-purple-900">
                  Phương án chấm câu 4 nhận định (a, b, c, d):
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFourStatementScoringMethod('PER_ITEM_EQUAL')}
                    className={`p-2 rounded-lg text-left font-bold border ${
                      fourStatementScoringMethod === 'PER_ITEM_EQUAL'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Phương án A: Chấm từng ý (0,25đ/ý · +5đ trò chơi/ý)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFourStatementScoringMethod('CUSTOM_TIER_TABLE')}
                    className={`p-2 rounded-lg text-left font-bold border ${
                      fourStatementScoringMethod === 'CUSTOM_TIER_TABLE'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Phương án B: Bảng điểm lũy tiến ({customTierPoints.join(' / ')}đ)
                  </button>
                </div>
              </div>
            )}

            {/* Mode 3 Team Battle Controls */}
            {playMode === 'TEAM_BATTLE' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center gap-1">
                    {[2, 3, 4].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setTeamCount(cnt)}
                        className={`px-2.5 py-1 rounded-lg font-bold ${
                          teamCount === cnt
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-white border border-slate-300 text-slate-700'
                        }`}
                      >
                        {cnt} đội
                      </button>
                    ))}
                  </div>

                  <select
                    value={teamTurnStyle}
                    onChange={(e) => setTeamTurnStyle(e.target.value as TeamTurnStyle)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-800"
                  >
                    <option value="TURN_BASED">Lần lượt theo lượt</option>
                    <option value="ALL_TEAMS_SIMULTANEOUS">Các đội cùng trả lời</option>
                    <option value="BUZZER_CLAIM">Giành quyền trả lời</option>
                  </select>
                </div>

                {/* Teams Scoreboard List */}
                <div className="space-y-2">
                  {teams.map((t, idx) => {
                    const isTurn =
                      (teamTurnStyle === 'TURN_BASED' && idx === activeTeamIndex) ||
                      (teamTurnStyle === 'BUZZER_CLAIM' && buzzedTeamId === t.id);

                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setActiveTeamIndex(idx);
                          if (teamTurnStyle === 'BUZZER_CLAIM') setBuzzedTeamId(t.id);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all space-y-2 ${
                          isTurn
                            ? 'bg-amber-50 border-amber-500 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: t.colorHex }}
                            />
                            <div className="truncate">
                              <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                <span>{t.name}</span>
                                {t.streak >= 2 && (
                                  <span className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5">
                                    <Flame className="w-3 h-3" /> Chuỗi {t.streak}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Đúng {t.correctCount} · Sai {t.wrongCount} · {t.members.length} HS
                              </div>
                            </div>
                          </div>
                          <div className="text-base font-mono font-black text-slate-900 tabular-nums">
                            {t.score}đ
                          </div>
                        </div>

                        {/* Simultaneous choice buttons for each team */}
                        {teamTurnStyle === 'ALL_TEAMS_SIMULTANEOUS' && (
                          <div
                            className="flex items-center gap-2 pt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={stageState === 'LOCKED' || stageState === 'SCORING'}
                              onClick={() =>
                                setSimultaneousTeamChoices((prev) => ({
                                  ...prev,
                                  [t.id]: true,
                                }))
                              }
                              className={`flex-1 py-1 rounded-lg text-[11px] font-black border ${
                                simultaneousTeamChoices[t.id] === true
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-slate-50 border-slate-300 text-emerald-700'
                              }`}
                            >
                              ĐÚNG
                            </button>
                            <button
                              type="button"
                              disabled={stageState === 'LOCKED' || stageState === 'SCORING'}
                              onClick={() =>
                                setSimultaneousTeamChoices((prev) => ({
                                  ...prev,
                                  [t.id]: false,
                                }))
                              }
                              className={`flex-1 py-1 rounded-lg text-[11px] font-black border ${
                                simultaneousTeamChoices[t.id] === false
                                  ? 'bg-rose-600 border-rose-600 text-white'
                                  : 'bg-slate-50 border-slate-300 text-rose-700'
                              }`}
                            >
                              SAI
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Individual / Two-Sides Score Summary */
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500">Tổng điểm hiện tại</div>
                  <div className="text-2xl font-mono font-black text-blue-600 tabular-nums mt-0.5">
                    {individualScore}đ
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500">
                    {playMode === 'TWO_SIDES_ARENA'
                      ? 'Lượt HS chọn đúng'
                      : 'Chuỗi đúng liên tiếp'}
                  </div>
                  <div className="text-2xl font-mono font-black text-emerald-600 tabular-nums mt-0.5">
                    {playMode === 'TWO_SIDES_ARENA'
                      ? totalClassCorrectAccumulated
                      : individualStreak}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AUDIT LOG & SCORING HISTORY CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Nhật Ký Chấm Điểm Phiên Chơi
              </h4>
              {scoreAuditLog.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">
                  Chưa có lượt chấm điểm nào trong phiên này.
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {scoreAuditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          Câu #{entry.questionIndex} · {entry.targetName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{entry.reason}</div>
                      </div>
                      <span
                        className={`font-mono font-black shrink-0 tabular-nums ${
                          entry.deltaPoints > 0 ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        +{entry.deltaPoints}đ
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Điểm trò chơi dùng để xếp hạng trong phiên</span>
              <span className="font-bold text-slate-700">B05 v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
