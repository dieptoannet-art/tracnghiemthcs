import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question, SingleChoiceOption } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameVoiceEnabled,
  saveEduGameVoiceEnabled,
} from '../../../utils/eduGameAudioController';
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
  BookOpen,
  Shuffle,
  Eye,
  Check,
  X,
  Lock,
  Unlock,
  KeyRound,
  Star,
  Gem,
  HelpCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export type GameMode = 'class' | 'individual' | 'teams';
export type ScoringMode = 'fixed' | 'secret';

export interface DoorItem {
  id: string;
  number: number;
  isOpen: boolean;
  rewardType: 'star' | 'trophy' | 'crystal' | 'book';
  rewardPoints: number; // 10, 20, or 30
  question: Question | null;
}

export interface TeamScore {
  id: string;
  name: string;
  score: number;
  color: string;
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
  * Cryptographic random integer in [0, max - 1].
  */
function secureRandomInt(max: number): number {
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

function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// Audio & strict Vietnamese voice synthesis are managed via shared EduGameSoundBank & EduGameVoiceController.

// Sample questions fallback with "Dữ liệu mẫu" tag
const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 'sample_q1',
    code: 'TOAN6_B07_01',
    subject: 'math',
    grade: '6',
    chapter: 'Số học & Phân số',
    level: 'know',
    type: 'single_choice',
    stem: 'Số nguyên tố nhỏ nhất là số nào?',
    options: [
      { id: 'o1', label: 'A', text: '0' },
      { id: 'o2', label: 'B', text: '1' },
      { id: 'o3', label: 'C', text: '2' },
      { id: 'o4', label: 'D', text: '3' },
    ],
    correctAnswer: 'C',
    explanation: 'Số 2 là số nguyên tố chẵn duy nhất và là số nguyên tố nhỏ nhất.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 1',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q2',
    code: 'TOAN7_B07_02',
    subject: 'math',
    grade: '7',
    chapter: 'Hình học trực quan',
    level: 'understand',
    type: 'single_choice',
    stem: 'Tổng ba góc trong một tam giác bằng bao nhiêu độ?',
    options: [
      { id: 'o1', label: 'A', text: '90°' },
      { id: 'o2', label: 'B', text: '180°' },
      { id: 'o3', label: 'C', text: '270°' },
      { id: 'o4', label: 'D', text: '360°' },
    ],
    correctAnswer: 'B',
    explanation: 'Theo định lý tổng ba góc của một tam giác, tổng số đo ba góc luôn bằng 180°.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 2',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q3',
    code: 'TOAN8_B07_03',
    subject: 'math',
    grade: '8',
    chapter: 'Đại số bậc nhất',
    level: 'know',
    type: 'single_choice',
    stem: 'Khai triển hằng đẳng thức (a + b)² ta được kết quả nào?',
    options: [
      { id: 'o1', label: 'A', text: 'a² + b²' },
      { id: 'o2', label: 'B', text: 'a² - b²' },
      { id: 'o3', label: 'C', text: 'a² + 2ab + b²' },
      { id: 'o4', label: 'D', text: 'a² - 2ab + b²' },
    ],
    correctAnswer: 'C',
    explanation: 'Hằng đẳng thức đáng nhớ: (a + b)² = a² + 2ab + b².',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 3',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q4',
    code: 'TOAN9_B07_04',
    subject: 'math',
    grade: '9',
    chapter: 'Hàm số và Phương trình',
    level: 'understand',
    type: 'single_choice',
    stem: 'Phương trình bậc hai ax² + bx + c = 0 (a ≠ 0) có nghiệm kép khi biệt thức Δ bằng:',
    options: [
      { id: 'o1', label: 'A', text: 'Δ > 0' },
      { id: 'o2', label: 'B', text: 'Δ = 0' },
      { id: 'o3', label: 'C', text: 'Δ < 0' },
      { id: 'o4', label: 'D', text: 'Δ ≥ 0' },
    ],
    correctAnswer: 'B',
    explanation: 'Khi Δ = 0, phương trình có nghiệm kép x₁ = x₂ = -b / (2a).',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 4',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q5',
    code: 'KHTN6_B07_05',
    subject: 'science',
    grade: '6',
    chapter: 'Chất quanh ta',
    level: 'know',
    type: 'single_choice',
    stem: 'Thể nào của nước có hình dạng cố định và thể tích cố định?',
    options: [
      { id: 'o1', label: 'A', text: 'Thể rắn (Đá)' },
      { id: 'o2', label: 'B', text: 'Thể lỏng' },
      { id: 'o3', label: 'C', text: 'Thể khí' },
      { id: 'o4', label: 'D', text: 'Cả ba thể trên' },
    ],
    correctAnswer: 'A',
    explanation: 'Ở thể rắn, các hạt liên kết chặt chẽ nên có cả hình dạng và thể tích cố định.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 5',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q6',
    code: 'KHTN7_B07_06',
    subject: 'science',
    grade: '7',
    chapter: 'Năng lượng ánh sáng',
    level: 'understand',
    type: 'single_choice',
    stem: 'Hiện tượng ánh sáng bị đổi hướng khi truyền qua mặt phân cách giữa hai môi trường trong suốt gọi là:',
    options: [
      { id: 'o1', label: 'A', text: 'Phản xạ ánh sáng' },
      { id: 'o2', label: 'B', text: 'Khúc xạ ánh sáng' },
      { id: 'o3', label: 'C', text: 'Tán sắc ánh sáng' },
      { id: 'o4', label: 'D', text: 'Giao thoa ánh sáng' },
    ],
    correctAnswer: 'B',
    explanation: 'Khúc xạ ánh sáng là hiện tượng lệch phương (đổi hướng) của các tia sáng khi truyền qua mặt phân cách.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 6',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q7',
    code: 'TIN8_B07_07',
    subject: 'informatics',
    grade: '8',
    chapter: 'Thuật toán & Lập trình',
    level: 'know',
    type: 'single_choice',
    stem: 'Trong Python, từ khóa nào dùng để khai báo một hàm (function)?',
    options: [
      { id: 'o1', label: 'A', text: 'func' },
      { id: 'o2', label: 'B', text: 'define' },
      { id: 'o3', label: 'C', text: 'def' },
      { id: 'o4', label: 'D', text: 'function' },
    ],
    correctAnswer: 'C',
    explanation: 'Trong Python, hàm được định nghĩa bằng từ khóa def theo sau là tên hàm và ngoặc tròn.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 7',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q8',
    code: 'TOAN6_B07_08',
    subject: 'math',
    grade: '6',
    chapter: 'Số học',
    level: 'know',
    type: 'single_choice',
    stem: 'Ước chung lớn nhất của 12 và 18 là số nào?',
    options: [
      { id: 'o1', label: 'A', text: '2' },
      { id: 'o2', label: 'B', text: '3' },
      { id: 'o3', label: 'C', text: '6' },
      { id: 'o4', label: 'D', text: '12' },
    ],
    correctAnswer: 'C',
    explanation: 'Ước chung của 12 và 18 gồm 1, 2, 3, 6. Số lớn nhất là 6.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 8',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q9',
    code: 'TOAN7_B07_09',
    subject: 'math',
    grade: '7',
    chapter: 'Tỉ lệ thức',
    level: 'understand',
    type: 'single_choice',
    stem: 'Từ tỉ lệ thức a/b = c/d, ta suy ra đẳng thức nào sau đây?',
    options: [
      { id: 'o1', label: 'A', text: 'ad = bc' },
      { id: 'o2', label: 'B', text: 'ab = cd' },
      { id: 'o3', label: 'C', text: 'ac = bd' },
      { id: 'o4', label: 'D', text: 'a + b = c + d' },
    ],
    correctAnswer: 'A',
    explanation: 'Tính chất cơ bản của tỉ lệ thức: Nếu a/b = c/d thì ad = bc.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 9',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q10',
    code: 'TOAN8_B07_10',
    subject: 'math',
    grade: '8',
    chapter: 'Đa giác & Tam giác đồng dạng',
    level: 'understand',
    type: 'single_choice',
    stem: 'Tỉ số đồng dạng của hai tam giác đồng dạng là tỉ số giữa:',
    options: [
      { id: 'o1', label: 'A', text: 'Hai cạnh bất kỳ' },
      { id: 'o2', label: 'B', text: 'Hai cạnh tương ứng' },
      { id: 'o3', label: 'C', text: 'Hai chu vi tương ứng' },
      { id: 'o4', label: 'D', text: 'Hai diện tích tương ứng' },
    ],
    correctAnswer: 'B',
    explanation: 'Tỉ số đồng dạng k bằng tỉ số độ dài hai cạnh tương ứng của hai tam giác.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 10',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q11',
    code: 'KHTN8_B07_11',
    subject: 'science',
    grade: '8',
    chapter: 'Phản ứng hóa học',
    level: 'know',
    type: 'single_choice',
    stem: 'Dấu hiệu nhận biết có phản ứng hóa học xảy ra là gì?',
    options: [
      { id: 'o1', label: 'A', text: 'Có chất mới tạo thành' },
      { id: 'o2', label: 'B', text: 'Có sự thay đổi màu sắc hoặc tỏa/thu nhiệt' },
      { id: 'o3', label: 'C', text: 'Có xuất hiện chất kết tủa hoặc chất khí' },
      { id: 'o4', label: 'D', text: 'Tất cả các ý trên' },
    ],
    correctAnswer: 'D',
    explanation: 'Các dấu hiệu bao gồm đổi màu, tạo chất khí, kết tủa và thay đổi nhiệt độ.',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 11',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
  {
    id: 'sample_q12',
    code: 'TOAN9_B07_12',
    subject: 'math',
    grade: '9',
    chapter: 'Đường tròn',
    level: 'understand',
    type: 'single_choice',
    stem: 'Góc nội tiếp chắn nửa đường tròn có số đo bằng bao nhiêu độ?',
    options: [
      { id: 'o1', label: 'A', text: '45°' },
      { id: 'o2', label: 'B', text: '60°' },
      { id: 'o3', label: 'C', text: '90°' },
      { id: 'o4', label: 'D', text: '180°' },
    ],
    correctAnswer: 'C',
    explanation: 'Góc nội tiếp chắn nửa đường tròn là góc vuông (có số đo 90°).',
    textbook: 'Kết nối tri thức',
    lesson: 'Bài 12',
    status: 'approved',
    author: 'Admin',
    version: 1,
    points: 1,
  },
];

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
  // Game Configuration States
  const [isConfiguring, setIsConfiguring] = useState<boolean>(true);
  const [gameMode, setGameMode] = useState<GameMode>('class');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('secret');
  const [doorCount, setDoorCount] = useState<number>(9); // 6, 9, or 12
  const [timeLimit, setTimeLimit] = useState<number>(30); // 0, 15, 30, 60
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceControllerRef = useRef<EduGameVoiceController | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const studentTurnSeqRef = useRef<number>(0);

  useEffect(() => {
    soundBankRef.current = new EduGameSoundBank();
    voiceControllerRef.current = new EduGameVoiceController();
    return () => {
      soundBankRef.current?.dispose();
      soundBankRef.current = null;
      voiceControllerRef.current?.dispose();
      voiceControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      soundBankRef.current?.stopAll();
      voiceControllerRef.current?.stop();
    }
  }, [isMuted]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
    saveEduGameVoiceEnabled(voiceEnabled);
    if (!voiceEnabled) {
      voiceControllerRef.current?.stop();
    }
  }, [voiceEnabled]);

  // Teams configuration
  const [teams, setTeams] = useState<TeamScore[]>([
    { id: 't1', name: 'Đội 1 (Sao Vàng)', score: 0, color: 'from-amber-500 to-yellow-600' },
    { id: 't2', name: 'Đội 2 (Tia Chớp)', score: 0, color: 'from-blue-500 to-cyan-600' },
    { id: 't3', name: 'Đội 3 (Sáng Tạo)', score: 0, color: 'from-emerald-500 to-teal-600' },
    { id: 't4', name: 'Đội 4 (Quyết Tâm)', score: 0, color: 'from-purple-500 to-indigo-600' },
  ]);
  const [activeTeamIndex, setActiveTeamIndex] = useState<number>(0);

  // Active student turn in individual / class mode
  const [activeStudent, setActiveStudent] = useState<StudentCandidate | null>(null);

  // Session & Doors State
  const [sessionId, setSessionId] = useState<string>(() => `b07_sess_${Date.now().toString(36)}`);
  const [doors, setDoors] = useState<DoorItem[]>([]);
  const [selectedDoor, setSelectedDoor] = useState<DoorItem | null>(null);

  // Question Modal & Answering State
  const [showQuestionModal, setShowQuestionModal] = useState<boolean>(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number>(30);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Reward Reveal Popup State
  const [showRewardModal, setShowRewardModal] = useState<boolean>(false);
  const [revealedReward, setRevealedReward] = useState<{ type: string; points: number } | null>(null);

  // Game Over / Summary State
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);

  // Present students
  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((st) => !absentIds.has(st.id));
  }, [allCandidates, availableCandidates, absentIds]);

  // Combined Question Pool (Bank + Samples)
  const activeQuestionPool = useMemo(() => {
    const validBank = questions.filter((q) => q && q.stem && q.correctAnswer);
    if (validBank.length >= doorCount) {
      return validBank;
    }
    const combined = [...validBank, ...SAMPLE_QUESTIONS];
    return combined;
  }, [questions, doorCount]);

  // Initialize Session & Doors
  const handleStartGame = () => {
    soundBankRef.current?.unlock();
    soundBankRef.current?.stopAll();
    voiceControllerRef.current?.stop();

    const shuffledQuestions = fisherYatesShuffle(activeQuestionPool);
    const rewardTypes: ('star' | 'trophy' | 'crystal' | 'book')[] = ['star', 'trophy', 'crystal', 'book'];
    const pointValues = [10, 20, 30];

    const newDoors: DoorItem[] = [];
    for (let i = 0; i < doorCount; i++) {
      const q = shuffledQuestions[i % shuffledQuestions.length] || SAMPLE_QUESTIONS[0];
      const rewardType = rewardTypes[i % rewardTypes.length];
      const rewardPoints = scoringMode === 'secret' ? pointValues[i % pointValues.length] : 10;

      newDoors.push({
        id: `door_${i + 1}_${Date.now()}`,
        number: i + 1,
        isOpen: false,
        rewardType,
        rewardPoints,
        question: q,
      });
    }

    setDoors(newDoors);
    setIsConfiguring(false);
    setShowSummaryModal(false);
    setSelectedDoor(null);
    setShowQuestionModal(false);
    setShowRewardModal(false);

    soundBankRef.current?.playCardShuffle(isMutedRef.current);

    if (gameMode === 'individual' && presentStudents.length > 0) {
      const picked = presentStudents[secureRandomInt(presentStudents.length)];
      setActiveStudent(picked);
      studentTurnSeqRef.current += 1;
      void voiceControllerRef.current?.announceStudentOnce({
        turnId: `a10_${sessionId}_${studentTurnSeqRef.current}_${picked.id}`,
        studentName: picked.fullName,
        customText: `Mời bạn ${picked.fullName} chọn thẻ bài bí mật!`,
        isMuted: isMutedRef.current,
        voiceEnabled: voiceEnabledRef.current,
      });
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!timerRunning || timeLimit <= 0) return;
    const interval = window.setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          if (!isAnswerSubmitted) {
            handleCheckAnswer(null, true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, timeLimit, isAnswerSubmitted]);

  // Click a door / secret card
  const handleDoorClick = (door: DoorItem) => {
    if (door.isOpen || showQuestionModal || showRewardModal || isConfiguring) return;

    soundBankRef.current?.unlock();
    soundBankRef.current?.playCardFlip(isMutedRef.current);

    setSelectedDoor(door);
    setSelectedOptionId(null);
    setIsAnswerSubmitted(false);
    setIsCorrectAnswer(null);
    setTimerRemaining(timeLimit > 0 ? timeLimit : 30);
    setTimerRunning(timeLimit > 0);
    setShowQuestionModal(true);
  };

  // Check Answer
  const handleCheckAnswer = (chosenOptId: string | null, isTimeout = false) => {
    if (isAnswerSubmitted || !selectedDoor || !selectedDoor.question) return;
    setTimerRunning(false);
    setIsAnswerSubmitted(true);

    const q = selectedDoor.question;
    let correct = false;

    if (!isTimeout && chosenOptId !== null && q.options) {
      const selectedOpt = q.options.find((o) => o.id === chosenOptId);
      if (selectedOpt && q.correctAnswer) {
        const correctVal = q.correctAnswer.trim().toLowerCase();
        correct =
          selectedOpt.label.trim().toLowerCase() === correctVal ||
          selectedOpt.text.trim().toLowerCase() === correctVal ||
          selectedOpt.id.trim().toLowerCase() === correctVal;
      }
    }

    setIsCorrectAnswer(correct);

    if (correct) {
      soundBankRef.current?.playRevealChime(isMutedRef.current);
    } else {
      soundBankRef.current?.playSoftError(isMutedRef.current);
    }
  };

  // Teacher evaluates oral / short answer
  const handleTeacherEvaluate = (correct: boolean) => {
    if (!selectedDoor) return;
    setIsAnswerSubmitted(true);
    setIsCorrectAnswer(correct);
    if (correct) {
      soundBankRef.current?.playRevealChime(isMutedRef.current);
    } else {
      soundBankRef.current?.playSoftError(isMutedRef.current);
    }
  };

  // Proceed to Open Door & Get Reward
  const handleProceedToOpenDoor = () => {
    setShowQuestionModal(false);
    if (!selectedDoor) return;

    setDoors((prev) =>
      prev.map((d) => (d.id === selectedDoor.id ? { ...d, isOpen: true } : d))
    );

    const earnedPts = isCorrectAnswer ? selectedDoor.rewardPoints : 0;
    if (earnedPts > 0) {
      if (gameMode === 'teams') {
        setTeams((prev) =>
          prev.map((t, idx) =>
            idx === activeTeamIndex ? { ...t, score: t.score + earnedPts } : t
          )
        );
      } else if (gameMode === 'individual' && activeStudent) {
        onPick(activeStudent, { bonusPoints: earnedPts, note: `Mở ô cửa #${selectedDoor.number}`, sessionId });
      }
    }

    setRevealedReward({
      type: selectedDoor.rewardType,
      points: earnedPts,
    });
    setShowRewardModal(true);

    if (gameMode === 'teams') {
      setActiveTeamIndex((prev) => (prev + 1) % teams.length);
    } else if (gameMode === 'individual' && presentStudents.length > 0) {
      const nextStudent = presentStudents[secureRandomInt(presentStudents.length)];
      setActiveStudent(nextStudent);
      studentTurnSeqRef.current += 1;
      void voiceControllerRef.current?.announceStudentOnce({
        turnId: `a10_${sessionId}_${studentTurnSeqRef.current}_${nextStudent.id}`,
        studentName: nextStudent.fullName,
        customText: `Lượt tiếp theo, mời bạn ${nextStudent.fullName}!`,
        isMuted: isMutedRef.current,
        voiceEnabled: voiceEnabledRef.current,
      });
    }
  };

  const allDoorsOpened = doors.length > 0 && doors.every((d) => d.isOpen);

  return (
    <div className="w-full flex flex-col space-y-4 select-none">
      {/* ===================================================================
          1. CONFIGURATION MODAL / SETUP SCREEN
         =================================================================== */}
      {isConfiguring ? (
        <div className="w-full max-w-4xl mx-auto rounded-3xl border-2 border-amber-400/60 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0A0F1D] p-6 sm:p-8 shadow-2xl text-white space-y-6">
          <div className="text-center space-y-2">
            <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black uppercase tracking-wider">
              Tây Đô Smart EDU • B07
            </span>
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-cyan-300 bg-clip-text text-transparent">
              Đại Sảnh Những Ô Cửa Bí Mật 3D
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
              Trò chơi khởi động tiết học (3–7 phút). Giáo viên chọn ô cửa chứa câu hỏi, học sinh trả lời để mở cửa khám phá phần thưởng 3D và tích điểm!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Game Mode */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="block text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                1. Chế độ chơi:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'class', label: 'Cả lớp', icon: Users },
                  { key: 'individual', label: 'Cá nhân', icon: Trophy },
                  { key: 'teams', label: '2–4 Đội', icon: Layers },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setGameMode(m.key as GameMode)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                        gameMode === m.key
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scoring Mode */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="block text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                2. Quy tắc tính điểm:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'secret', label: 'Điểm bí mật (10–30đ)' },
                  { key: 'fixed', label: 'Điểm cố định (10đ/câu)' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setScoringMode(s.key as ScoringMode)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      scoringMode === s.key
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-black'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Door Count */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="block text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                3. Số lượng ô cửa:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[6, 9, 12].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setDoorCount(cnt)}
                    className={`p-3 rounded-xl border text-sm font-black transition-all cursor-pointer text-center ${
                      doorCount === cnt
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {cnt} ô cửa
                  </button>
                ))}
              </div>
            </div>

            {/* Time Limit */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <label className="block text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                4. Thời gian trả lời:
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
                    onClick={() => setTimeLimit(t.sec)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      timeLimit === t.sec
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={handleStartGame}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-base shadow-[0_0_30px_rgba(251,191,36,0.6)] flex items-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Bắt Đầu Khám Phá Ô Cửa 3D</span>
            </button>
          </div>
        </div>
      ) : (
        /* ===================================================================
           2. MAIN 3D STAGE & DOORS GRID
           =================================================================== */
        <div className="w-full flex flex-col space-y-4">
          {/* Top Bar / Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  soundBankRef.current?.stopAll();
                  voiceControllerRef.current?.stop();
                  setTimerRunning(false);
                  setIsConfiguring(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Cài đặt lại</span>
              </button>
              <div>
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
                  <span>B07 • Ô Cửa Bí Mật 3D</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 text-[10px]">
                    {resolvedClassName}
                  </span>
                </h3>
              </div>
            </div>

            {/* Team or Student Turn info + Audio Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {gameMode === 'teams' ? (
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-amber-400/30 text-xs font-bold">
                  <span>Lượt chơi:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black">
                    {teams[activeTeamIndex]?.name}
                  </span>
                </div>
              ) : gameMode === 'individual' && activeStudent ? (
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-cyan-400/30 text-xs font-bold">
                  <span>Học sinh:</span>
                  <span className="text-cyan-300 font-black">{activeStudent.fullName}</span>
                </div>
              ) : null}

              <div className="text-xs font-bold text-slate-300 tabular-nums">
                Đã mở: <strong className="text-amber-400">{doors.filter((d) => d.isOpen).length}</strong> / {doors.length}
              </div>

              {onToggleMute && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-rose-200">Tắt âm</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Âm thanh</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setVoiceEnabled((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  voiceEnabled && !isMuted
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
                title="Đọc tên học sinh bằng giọng tiếng Việt (không đọc giọng tiếng Anh)"
              >
                {voiceEnabled ? 'Đọc tên: BẬT' : 'Đọc tên: TẮT'}
              </button>
            </div>
          </div>

          {/* Teams Scoreboard Bar (if team mode) */}
          {gameMode === 'teams' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {teams.map((team, idx) => (
                <div
                  key={team.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    idx === activeTeamIndex
                      ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                      : 'border-slate-800 bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${team.color}`} />
                    <span className="text-xs font-bold text-white truncate max-w-[100px] sm:max-w-none">
                      {team.name}
                    </span>
                  </div>
                  <span className="text-sm font-black text-amber-300 tabular-nums">
                    {team.score} đ
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 3D Doors Stage Area */}
          <div className="relative rounded-3xl border-4 border-amber-400/60 bg-gradient-to-b from-[#0B132B] via-[#1C2541] to-[#0A0F1D] p-6 sm:p-10 shadow-2xl overflow-hidden min-h-[520px] flex flex-col items-center justify-center">
            {/* Ambient Stage Glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-400/10 rounded-full blur-3xl" />
            </div>

            {/* Doors Grid */}
            <div
              className={`grid gap-5 w-full max-w-5xl mx-auto z-10 ${
                doorCount === 6
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : doorCount === 9
                  ? 'grid-cols-3 sm:grid-cols-3'
                  : 'grid-cols-3 sm:grid-cols-4'
              }`}
            >
              {doors.map((door) => (
                <div
                  key={door.id}
                  onClick={() => handleDoorClick(door)}
                  className={`relative aspect-[3/4] rounded-2xl border-4 transition-all duration-500 cursor-pointer select-none group perspective-[1000px] ${
                    door.isOpen
                      ? 'border-emerald-500/80 bg-emerald-950/40 shadow-inner'
                      : 'border-amber-400/90 bg-gradient-to-b from-[#2A1B0C] via-[#3D2612] to-[#1F1308] shadow-[0_10px_25px_rgba(0,0,0,0.6)] hover:border-yellow-300 hover:scale-[1.02]'
                  }`}
                >
                  {/* Door Structure (Hinged 3D Door Swing when opened) */}
                  <div
                    className={`absolute inset-0 rounded-xl transition-transform duration-700 origin-left ${
                      door.isOpen ? 'rotate-y-[-110deg]' : 'rotate-y-0'
                    }`}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Front Face of Door */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#854D0E] via-[#A16207] to-[#713F12] border-2 border-amber-300/60 p-3 flex flex-col items-center justify-between shadow-md">
                      {/* Door Frame Ornaments */}
                      <div className="w-full h-full border border-amber-200/40 rounded-lg p-2 flex flex-col items-center justify-between relative">
                        {/* Brass Handle */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-8 rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 border border-yellow-200 shadow-md" />

                        <span className="text-[10px] sm:text-xs font-black uppercase text-amber-200 tracking-widest">
                          Ô CỬA
                        </span>

                        {/* Large Door Number */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-950/80 border-2 border-amber-300 flex items-center justify-center shadow-inner">
                          <span className="text-2xl sm:text-3xl font-black text-amber-300 tabular-nums">
                            {door.number}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold text-amber-100 flex items-center gap-1">
                          <KeyRound className="w-3 h-3" />
                          <span>Chạm để mở</span>
                        </span>
                      </div>
                    </div>

                    {/* Back Face / Inside Door (visible when opened) */}
                    <div
                      className="absolute inset-0 rounded-xl bg-slate-900 border-2 border-emerald-500 p-3 flex flex-col items-center justify-center text-center backface-hidden"
                      style={{ transform: 'rotateY(180deg)' }}
                    >
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                      <span className="text-xs font-bold text-emerald-200">Đã mở</span>
                      <span className="text-sm font-black text-amber-300 mt-1">
                        +{door.rewardPoints} đ
                      </span>
                    </div>
                  </div>

                  {/* Revealed Reward Badge when Open */}
                  {door.isOpen && (
                    <div className="absolute inset-0 rounded-2xl bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-center p-2 z-20 animate-fade-in">
                      <Sparkles className="w-8 h-8 text-amber-400 animate-bounce mb-1" />
                      <span className="text-xs font-black text-amber-300 uppercase">
                        {door.rewardType === 'star' ? 'Ngôi Sao May Mắn' : door.rewardType === 'trophy' ? 'Cúp Vàng Danh Dự' : door.rewardType === 'crystal' ? 'Tinh Thể Tri Thức' : 'Sách Vàng Tri Thức'}
                      </span>
                      <span className="text-sm font-black text-emerald-400 mt-1">
                        +{door.rewardPoints} điểm
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          3. QUESTION MODAL (POPUP WHEN DOOR IS CHOSEN)
         =================================================================== */}
      {showQuestionModal && selectedDoor && selectedDoor.question && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0A0F1D] p-6 sm:p-8 text-white shadow-2xl space-y-5 animate-scale-up">
            {/* Header: Door Number & Timer */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs">
                  Ô Cửa #{selectedDoor.number}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {selectedDoor.question.chapter || 'Kiến thức trọng tâm'}
                </span>
              </div>

              {timeLimit > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-black text-sm tabular-nums">
                  <TimerIcon className="w-4 h-4" />
                  <span>{timerRemaining}s</span>
                </div>
              )}
            </div>

            {/* Question Content */}
            <div className="space-y-3">
              <h4 className="text-base sm:text-lg font-black text-white leading-relaxed">
                {selectedDoor.question.stem}
              </h4>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {selectedDoor.question.options?.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  const correctVal = selectedDoor.question?.correctAnswer?.trim().toLowerCase() || '';
                  const isCorrectOpt =
                    opt.label.trim().toLowerCase() === correctVal ||
                    opt.text.trim().toLowerCase() === correctVal ||
                    opt.id.trim().toLowerCase() === correctVal;

                  let btnCls = 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10';
                  if (isAnswerSubmitted) {
                    if (isCorrectOpt) {
                      btnCls = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-black';
                    } else if (isSelected && !isCorrectOpt) {
                      btnCls = 'bg-rose-500/20 border-rose-500 text-rose-300';
                    }
                  } else if (isSelected) {
                    btnCls = 'bg-amber-400 text-slate-950 border-amber-300 font-black';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isAnswerSubmitted}
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold text-left transition-all flex items-center justify-between cursor-pointer ${btnCls}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-black/30 flex items-center justify-center text-xs">
                          {opt.label}
                        </span>
                        <span>{opt.text}</span>
                      </span>
                      {isAnswerSubmitted && isCorrectOpt && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Answer Feedback & Explanation */}
            {isAnswerSubmitted && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-1.5 animate-fade-in ${
                  isCorrectAnswer
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="font-black flex items-center gap-1.5 text-sm">
                  {isCorrectAnswer ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Chính xác! (+{selectedDoor.rewardPoints} điểm thưởng)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>Chưa chính xác! (Đáp án đúng: {selectedDoor.question.correctAnswer})</span>
                    </>
                  )}
                </div>
                {selectedDoor.question.explanation && (
                  <p className="opacity-90">{selectedDoor.question.explanation}</p>
                )}
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                <span>GV đánh giá hoặc chốt đáp án</span>
              </div>

              <div className="flex items-center gap-2">
                {!isAnswerSubmitted ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTeacherEvaluate(true)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>GV duyệt Đúng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheckAnswer(selectedOptionId)}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md cursor-pointer"
                    >
                      Chốt Đáp Án
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleProceedToOpenDoor}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <span>Mở Ô Cửa & Nhận Thưởng</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          4. REWARD REVEAL POPUP
         =================================================================== */}
      {showRewardModal && revealedReward && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-[#1A103C] via-[#261758] to-[#0D0722] p-8 text-white shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400 mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.6)]">
              <Sparkles className="w-10 h-10 text-amber-300 animate-bounce" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-black uppercase text-amber-300 tracking-widest">
                Phần Thưởng Ô Cửa 3D
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {revealedReward.type === 'star' ? 'Ngôi Sao May Mắn' : revealedReward.type === 'trophy' ? 'Cúp Vàng Danh Dự' : revealedReward.type === 'crystal' ? 'Tinh Thể Tri Thức' : 'Sách Vàng Tri Thức'}
              </h3>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 pt-1 tabular-nums">
                +{revealedReward.points} Điểm Thưởng
              </p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowRewardModal(false);
                  if (allDoorsOpened) {
                    setShowSummaryModal(true);
                  }
                }}
                className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-md cursor-pointer"
              >
                Tiếp Tục Khám Phá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          5. GAME SUMMARY MODAL (LEADERBOARD & REPLAY)
         =================================================================== */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#0A0F1D] p-6 sm:p-8 text-white shadow-2xl space-y-6 text-center animate-scale-up">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto animate-bounce" />
            <div className="space-y-1">
              <span className="text-xs font-black uppercase text-amber-300 tracking-wider">
                Tổng Kết Trò Chơi • Tây Đô Smart EDU
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Đại Sảnh Ô Cửa Bí Mật Hoàn Tất!
              </h3>
              <p className="text-xs text-slate-300">
                Toàn bộ {doors.length} ô cửa đã được mở thành công.
              </p>
            </div>

            {gameMode === 'teams' && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-300 uppercase">Bảng Xếp Hạng Đội</h4>
                <div className="space-y-2">
                  {[...teams]
                    .sort((a, b) => b.score - a.score)
                    .map((team, idx) => (
                      <div
                        key={team.id}
                        className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-bold"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs">
                            #{idx + 1}
                          </span>
                          <span>{team.name}</span>
                        </div>
                        <span className="text-sm font-black text-amber-300 tabular-nums">
                          {team.score} điểm
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="pt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleStartGame}
                className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Chơi Lại Ván Mới</span>
              </button>
              <button
                type="button"
                onClick={() => setIsConfiguring(true)}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Về Màn Hình Cài Đặt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
