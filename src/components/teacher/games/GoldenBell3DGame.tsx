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
  X,
  AlertTriangle,
  ShieldCheck,
  Check,
  Bell,
  HeartHandshake,
  Search,
  Undo2,
  Edit3,
  History,
  LayoutGrid,
  MonitorPlay,
  UserCheck,
  UserX,
  MinusCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  SkipForward,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question } from '../../../types';
import { MathView } from '../../MathView';
import { SpaceRocketVoiceManager } from './SpaceRocketVoiceManager';

// ============================================================================
// TYPES & DETERMINISTIC LEDGER MODEL FOR C02: RUNG CHUÔNG VÀNG 3D
// ("QUẢNG TRƯỜNG TRI THỨC – CHINH PHỤC CHUÔNG VÀNG")
// ============================================================================

export type C02PlayMode = 'PRACTICE_NO_ELIMINATION' | 'CONQUEST_ELIMINATION';
export type C02QuestionCount = 5 | 10 | 15 | 20;
export type C02QuestionTimeLimit = 0 | 15 | 30 | 45 | 60; // 0 = Không giới hạn
export type C02DatasetKey = 'SAMPLE_MATH' | 'SAMPLE_INFORMATICS' | 'QUESTION_BANK';
export type C02QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER';

export type C02StagePhase =
  | 'SETUP'
  | 'QUESTION_READY'
  | 'ANSWERING'
  | 'TIME_UP'
  | 'ANSWER_REVEALED'
  | 'GRADING'
  | 'CONFIRMED'
  | 'FINISHED';

export type C02LayoutView = 'PRESENTATION' | 'GRADING_WORKSPACE';

export type C02StudentMark = 'UNGRADED' | 'CORRECT' | 'WRONG' | 'NO_ANSWER' | 'NOT_IN_ROUND';

export type C02ParticipantStatus = 'ACTIVE' | 'SIDELINED' | 'ABSENT';

export type C02StudentFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'UNGRADED'
  | 'CORRECT'
  | 'WRONG_OR_NO_ANSWER'
  | 'SIDELINED';

export type C02EndReason =
  | 'ALL_QUESTIONS_COMPLETED'
  | 'NO_ACTIVE_PLAYERS_ENDED_BY_TEACHER'
  | 'ENDED_EARLY_BY_TEACHER'
  | null;

export interface C02OptionItem {
  optionId: string;
  text: string;
}

export interface C02DisplayOption extends C02OptionItem {
  displayLabel: 'A' | 'B' | 'C' | 'D';
}

export interface C02QuestionItem {
  questionId: string;
  questionType: C02QuestionType;
  stem: string;
  options?: C02OptionItem[];
  correctOptionId?: string;
  correctAnswerText: string;
  explanation: string;
  topic: string;
  difficulty: 1 | 2 | 3; // 1: Nhận biết, 2: Thông hiểu, 3: Vận dụng
  allowShuffle: boolean;
  isSample?: boolean;
  imageUrl?: string;
}

export interface C02Participant {
  participantId: string; // Unique immutable ID (never name)
  stt: number; // 1..50
  fullName: string;
  code: string;
  isAbsent: boolean;
  isTemporaryLabel: boolean;
  isSampleStudent?: boolean;
}

export interface C02QuestionRecord {
  questionIndex: number; // 0-based
  questionNumber: number; // 1-based
  questionId: string;
  eligibleParticipantIds: string[]; // Participants who were ACTIVE at start of this question
  marks: Record<string, C02StudentMark>; // participantId -> CORRECT | WRONG | NO_ANSWER | NOT_IN_ROUND
  confirmedAt: number;
  editCount: number;
  lastEditedAt?: number;
  modeAtQuestion: C02PlayMode;
}

export interface C02RescueEvent {
  rescueId: string;
  afterQuestionNumber: number; // Triggered after confirming this question (1-based)
  rescuedParticipantIds: string[];
  timestamp: number;
  note?: string;
}

export interface C02ComputedParticipantState {
  participant: C02Participant;
  status: C02ParticipantStatus;
  score: number;
  correctCount: number;
  wrongCount: number;
  noAnswerCount: number;
  questionsParticipated: number;
  wasRescued: boolean;
  rescuedAfterQuestionNumbers: number[];
  eliminatedAtQuestionNumber: number | null;
  conqueredGoldenBell: boolean;
}

export interface GoldenBell3DGameProps {
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

export const C02_STORAGE_KEY = 'taydo_smart_edu_c02_active_session_v1';
export const C02_STORAGE_VERSION = 1;
const C02_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// ============================================================================
// POSITION-DEPENDENT OPTION DETECTION & SAFE SHUFFLE
// ============================================================================

const POSITIONAL_OPTION_PATTERNS = [
  /cả\s+a\s+và\s+b/i,
  /cả\s+a,\s*b/i,
  /cả\s+b\s+và\s+c/i,
  /cả\s+a,\s*b,\s*c/i,
  /tất\s+cả\s+các\s+đáp\s+án/i,
  /tất\s+cả\s+đều\s+đúng/i,
  /tất\s+cả\s+đều\s+sai/i,
  /cả\s+hai\s+đáp\s+án/i,
  /cả\s+3\s+đáp\s+án/i,
  /cả\s+ba\s+đáp\s+án/i,
  /đáp\s+án\s+a\s+và\s+b/i,
];

export function hasPositionalOptionDependency(options?: C02OptionItem[]): boolean {
  if (!options || options.length === 0) return false;
  return options.some((opt) =>
    POSITIONAL_OPTION_PATTERNS.some((pattern) => pattern.test(opt.text))
  );
}

export function buildDisplayOptionsForC02(
  question: C02QuestionItem,
  savedOptionOrder?: string[]
): C02DisplayOption[] {
  if (!question.options || question.options.length === 0) return [];
  const labels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

  let ordered: C02OptionItem[];
  if (savedOptionOrder && savedOptionOrder.length === question.options.length) {
    const map = new Map(question.options.map((o) => [o.optionId, o]));
    const reconstructed = savedOptionOrder
      .map((id) => map.get(id))
      .filter((o): o is C02OptionItem => Boolean(o));
    ordered = reconstructed.length === question.options.length ? reconstructed : [...question.options];
  } else if (question.allowShuffle && !hasPositionalOptionDependency(question.options)) {
    ordered = [...question.options].sort(() => Math.random() - 0.5);
  } else {
    ordered = [...question.options];
  }

  return ordered.slice(0, 4).map((opt, idx) => ({
    ...opt,
    displayLabel: labels[idx] || 'A',
  }));
}

// ============================================================================
// DETERMINISTIC LEDGER ENGINE (RECOMPUTES SCORES & STATUSES FROM HISTORY)
// ============================================================================

/**
 * Pure deterministic function that computes every participant's status, score,
 * rescue history, and Golden Bell conquest eligibility from:
 * - participants list
 * - confirmed questionRecords (up to any step)
 * - rescueEvents
 * - current playMode & whether session is finished
 */
export function computeParticipantsLedger(params: {
  participants: C02Participant[];
  questionRecords: C02QuestionRecord[];
  rescueEvents: C02RescueEvent[];
  currentPlayMode: C02PlayMode;
  initialPlayMode: C02PlayMode;
  switchedModeMidSession: boolean;
  totalPlannedQuestions: number;
  isSessionFinished: boolean;
}): C02ComputedParticipantState[] {
  const {
    participants,
    questionRecords,
    rescueEvents,
    currentPlayMode,
    switchedModeMidSession,
    totalPlannedQuestions,
    isSessionFinished,
  } = params;

  const completedQuestionsCount = questionRecords.length;

  return participants.map((p) => {
    if (p.isAbsent) {
      return {
        participant: p,
        status: 'ABSENT',
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        noAnswerCount: 0,
        questionsParticipated: 0,
        wasRescued: false,
        rescuedAfterQuestionNumbers: [],
        eliminatedAtQuestionNumber: null,
        conqueredGoldenBell: false,
      };
    }

    let status: C02ParticipantStatus = 'ACTIVE';
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let noAnswerCount = 0;
    let questionsParticipated = 0;
    let wasRescued = false;
    const rescuedAfterQuestionNumbers: number[] = [];
    let eliminatedAtQuestionNumber: number | null = null;

    // Sort records by questionIndex ascending
    const sortedRecords = [...questionRecords].sort((a, b) => a.questionIndex - b.questionIndex);

    for (const rec of sortedRecords) {
      const mark = rec.marks[p.participantId] || 'NOT_IN_ROUND';
      const wasEligible = rec.eligibleParticipantIds.includes(p.participantId);

      if (wasEligible && mark !== 'NOT_IN_ROUND') {
        questionsParticipated += 1;
        if (mark === 'CORRECT') {
          score += 10;
          correctCount += 1;
        } else if (mark === 'WRONG') {
          wrongCount += 1;
          if (rec.modeAtQuestion === 'CONQUEST_ELIMINATION') {
            status = 'SIDELINED';
            eliminatedAtQuestionNumber = rec.questionNumber;
          }
        } else if (mark === 'NO_ANSWER') {
          noAnswerCount += 1;
          if (rec.modeAtQuestion === 'CONQUEST_ELIMINATION') {
            status = 'SIDELINED';
            eliminatedAtQuestionNumber = rec.questionNumber;
          }
        }
      }

      // Check if any rescue event occurred right after this questionNumber
      const rescuesAfterThisQuestion = rescueEvents.filter(
        (ev) => ev.afterQuestionNumber === rec.questionNumber
      );
      for (const rev of rescuesAfterThisQuestion) {
        if (rev.rescuedParticipantIds.includes(p.participantId) && status === 'SIDELINED') {
          status = 'ACTIVE';
          wasRescued = true;
          if (!rescuedAfterQuestionNumbers.includes(rec.questionNumber)) {
            rescuedAfterQuestionNumbers.push(rec.questionNumber);
          }
        }
      }
    }

    // If mode was switched to PRACTICE_NO_ELIMINATION mid-session, everyone who is not absent is active for practice
    if (currentPlayMode === 'PRACTICE_NO_ELIMINATION') {
      status = 'ACTIVE';
    }

    // Determine "Chinh phục Chuông Vàng" criteria (Section 5)
    let conqueredGoldenBell = false;
    if (isSessionFinished && completedQuestionsCount > 0) {
      if (currentPlayMode === 'PRACTICE_NO_ELIMINATION' || switchedModeMidSession) {
        // In Practice mode (or if switched to Practice mid-session):
        // Must answer ALL scored questions correctly
        conqueredGoldenBell =
          completedQuestionsCount > 0 && correctCount === completedQuestionsCount;
      } else {
        // In pure CONQUEST_ELIMINATION mode:
        // Must complete the final planned question while still ACTIVE (meaning they answered the final question correctly!)
        const reachedFinalPlannedQuestion = completedQuestionsCount === totalPlannedQuestions;
        const lastRecord = sortedRecords[sortedRecords.length - 1];
        const answeredFinalCorrectly =
          Boolean(lastRecord) &&
          lastRecord.eligibleParticipantIds.includes(p.participantId) &&
          lastRecord.marks[p.participantId] === 'CORRECT';

        conqueredGoldenBell =
          reachedFinalPlannedQuestion && status === 'ACTIVE' && answeredFinalCorrectly;
      }
    }

    return {
      participant: p,
      status,
      score,
      correctCount,
      wrongCount,
      noAnswerCount,
      questionsParticipated,
      wasRescued,
      rescuedAfterQuestionNumbers,
      eliminatedAtQuestionNumber,
      conqueredGoldenBell,
    };
  });
}

// ============================================================================
// BUILT-IN SAMPLE DATASETS (SECTION 16: 20 MATH + 20 INFORMATICS QUESTIONS)
// Tagged "Dữ liệu mẫu" — Never written to real DB
// ============================================================================

export const SAMPLE_MATH_C02_QUESTIONS: C02QuestionItem[] = [
  {
    questionId: 'c02_math_01',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Kết quả của phép tính lũy thừa $2^3 \\cdot 2^2$ bằng bao nhiêu?',
    options: [
      { optionId: 'm01_a', text: '$2^5 = 32$' },
      { optionId: 'm01_b', text: '$2^6 = 64$' },
      { optionId: 'm01_c', text: '$4^5 = 1024$' },
      { optionId: 'm01_d', text: '$2^1 = 2$' },
    ],
    correctOptionId: 'm01_a',
    correctAnswerText: '2^5 = 32',
    explanation: 'Khi nhân hai lũy thừa cùng cơ số, ta giữ nguyên cơ số và cộng các số mũ: $2^3 \\cdot 2^2 = 2^{3+2} = 2^5 = 32$.',
    topic: 'Số học – Lũy thừa',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_02',
    questionType: 'TRUE_FALSE',
    stem: 'Khẳng định sau Đúng hay Sai: “Số $2$ là số nguyên tố chẵn duy nhất.”',
    options: [
      { optionId: 'm02_true', text: 'Đúng' },
      { optionId: 'm02_false', text: 'Sai' },
    ],
    correctOptionId: 'm02_true',
    correctAnswerText: 'Đúng',
    explanation: 'Mọi số chẵn lớn hơn 2 đều chia hết cho 2 nên là hợp số. Do đó 2 là số nguyên tố chẵn duy nhất.',
    topic: 'Số học – Số nguyên tố',
    difficulty: 1,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_math_03',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Ước chung lớn nhất của $18$ và $24$ là số nào?',
    options: [
      { optionId: 'm03_a', text: '$6$' },
      { optionId: 'm03_b', text: '$3$' },
      { optionId: 'm03_c', text: '$12$' },
      { optionId: 'm03_d', text: '$72$' },
    ],
    correctOptionId: 'm03_a',
    correctAnswerText: '6',
    explanation: 'Ta có $18 = 2 \\cdot 3^2$ và $24 = 2^3 \\cdot 3$. Suy ra $\\text{ƯCLN}(18, 24) = 2 \\cdot 3 = 6$.',
    topic: 'Số học – ƯCLN',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_04',
    questionType: 'SHORT_ANSWER',
    stem: 'Thực hiện phép tính: $(-15) + 27$ bằng bao nhiêu?',
    correctAnswerText: '12',
    explanation: 'Cộng hai số nguyên khác dấu: $27 - 15 = 12$.',
    topic: 'Số học – Số nguyên',
    difficulty: 1,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_math_05',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Rút gọn phân số $\\frac{18}{27}$ về dạng tối giản ta được phân số nào?',
    options: [
      { optionId: 'm05_a', text: '$\\frac{2}{3}$' },
      { optionId: 'm05_b', text: '$\\frac{6}{9}$' },
      { optionId: 'm05_c', text: '$\\frac{3}{4}$' },
      { optionId: 'm05_d', text: '$\\frac{1}{3}$' },
    ],
    correctOptionId: 'm05_a',
    correctAnswerText: '2/3',
    explanation: 'Chia cả tử và mẫu của $\\frac{18}{27}$ cho $\\text{ƯCLN}(18, 27) = 9$, ta được phân số tối giản $\\frac{2}{3}$.',
    topic: 'Phân số',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_06',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Tổng ba góc trong một tam giác bất kỳ luôn bằng bao nhiêu độ?',
    options: [
      { optionId: 'm06_a', text: '$180^\\circ$' },
      { optionId: 'm06_b', text: '$90^\\circ$' },
      { optionId: 'm06_c', text: '$360^\\circ$' },
      { optionId: 'm06_d', text: '$120^\\circ$' },
    ],
    correctOptionId: 'm06_a',
    correctAnswerText: '180°',
    explanation: 'Theo định lí tổng ba góc của một tam giác, tổng số đo ba góc trong một tam giác luôn bằng $180^\\circ$.',
    topic: 'Hình học phẳng',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_07',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Giá trị của $x$ thỏa mãn phương trình $2x - 7 = 13$ là:',
    options: [
      { optionId: 'm07_a', text: '$x = 10$' },
      { optionId: 'm07_b', text: '$x = 3$' },
      { optionId: 'm07_c', text: '$x = 6$' },
      { optionId: 'm07_d', text: '$x = 20$' },
    ],
    correctOptionId: 'm07_a',
    correctAnswerText: 'x = 10',
    explanation: 'Từ $2x - 7 = 13 \\Rightarrow 2x = 13 + 7 = 20 \\Rightarrow x = 20 : 2 = 10$.',
    topic: 'Biểu thức & Phương trình',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_08',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Kết quả của phép cộng hai phân số $\\frac{1}{3} + \\frac{1}{6}$ bằng:',
    options: [
      { optionId: 'm08_a', text: '$\\frac{1}{2}$' },
      { optionId: 'm08_b', text: '$\\frac{2}{9}$' },
      { optionId: 'm08_c', text: '$\\frac{2}{6}$' },
      { optionId: 'm08_d', text: '$\\frac{5}{6}$' },
    ],
    correctOptionId: 'm08_a',
    correctAnswerText: '1/2',
    explanation: 'Quy đồng mẫu số chung là 6: $\\frac{1}{3} + \\frac{1}{6} = \\frac{2}{6} + \\frac{1}{6} = \\frac{3}{6} = \\frac{1}{2}$.',
    topic: 'Phân số',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_09',
    questionType: 'SHORT_ANSWER',
    stem: 'Một hình chữ nhật có chiều dài $12\\text{ cm}$ và chiều rộng $5\\text{ cm}$. Chu vi hình chữ nhật đó là bao nhiêu $\\text{cm}$?',
    correctAnswerText: '34 cm (hoặc 34)',
    explanation: 'Chu vi hình chữ nhật là $C = 2 \\cdot (12 + 5) = 2 \\cdot 17 = 34\\text{ (cm)}$.',
    topic: 'Hình học phẳng',
    difficulty: 2,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_math_10',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Điểm kiểm tra Toán của 5 bạn trong tổ là: $7; 8; 8; 9; 8$. Trung bình cộng điểm của 5 bạn là:',
    options: [
      { optionId: 'm10_a', text: '$8,0$' },
      { optionId: 'm10_b', text: '$7,8$' },
      { optionId: 'm10_c', text: '$8,2$' },
      { optionId: 'm10_d', text: '$8,5$' },
    ],
    correctOptionId: 'm10_a',
    correctAnswerText: '8,0',
    explanation: 'Trung bình cộng bằng $\\frac{7 + 8 + 8 + 9 + 8}{5} = \\frac{40}{5} = 8,0$.',
    topic: 'Thống kê cơ bản',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_11',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Khai triển hằng đẳng thức $(x + 3)^2$ ta được biểu thức nào?',
    options: [
      { optionId: 'm11_a', text: '$x^2 + 6x + 9$' },
      { optionId: 'm11_b', text: '$x^2 + 3x + 9$' },
      { optionId: 'm11_c', text: '$x^2 + 9$' },
      { optionId: 'm11_d', text: '$x^2 + 6x + 6$' },
    ],
    correctOptionId: 'm11_a',
    correctAnswerText: 'x^2 + 6x + 9',
    explanation: 'Áp dụng bình phương của một tổng: $(A + B)^2 = A^2 + 2AB + B^2 \\Rightarrow (x + 3)^2 = x^2 + 2 \\cdot x \\cdot 3 + 3^2 = x^2 + 6x + 9$.',
    topic: 'Biểu thức đại số',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_12',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Cho tam giác $ABC$ vuông tại $A$ có $AB = 6\\text{ cm}, AC = 8\\text{ cm}$. Độ dài cạnh huyền $BC$ bằng:',
    options: [
      { optionId: 'm12_a', text: '$10\\text{ cm}$' },
      { optionId: 'm12_b', text: '$14\\text{ cm}$' },
      { optionId: 'm12_c', text: '$12\\text{ cm}$' },
      { optionId: 'm12_d', text: '$100\\text{ cm}$' },
    ],
    correctOptionId: 'm12_a',
    correctAnswerText: '10 cm',
    explanation: 'Theo định lí Pythagore trong tam giác vuông $ABC$: $BC = \\sqrt{AB^2 + AC^2} = \\sqrt{6^2 + 8^2} = \\sqrt{100} = 10\\text{ cm}$.',
    topic: 'Hình học – Định lí Pythagore',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_13',
    questionType: 'TRUE_FALSE',
    stem: 'Khẳng định sau Đúng hay Sai: “Trong một hình thoi, hai đường chéo luôn vuông góc với nhau.”',
    options: [
      { optionId: 'm13_true', text: 'Đúng' },
      { optionId: 'm13_false', text: 'Sai' },
    ],
    correctOptionId: 'm13_true',
    correctAnswerText: 'Đúng',
    explanation: 'Tính chất đặc trưng của hình thoi là hai đường chéo vuông góc với nhau và cắt nhau tại trung điểm của mỗi đường.',
    topic: 'Hình học – Tứ giác',
    difficulty: 2,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_math_14',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Cho hàm số $y = 2x - 1$. Giá trị của hàm số tại $x = 3$ là:',
    options: [
      { optionId: 'm14_a', text: '$y = 5$' },
      { optionId: 'm14_b', text: '$y = 6$' },
      { optionId: 'm14_c', text: '$y = 4$' },
      { optionId: 'm14_d', text: '$y = 7$' },
    ],
    correctOptionId: 'm14_a',
    correctAnswerText: 'y = 5',
    explanation: 'Thay $x = 3$ vào công thức $y = 2x - 1$, ta có $y = 2 \\cdot 3 - 1 = 5$.',
    topic: 'Hàm số & Đồ thị',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_15',
    questionType: 'SHORT_ANSWER',
    stem: 'Gieo một con xúc xắc cân đối và đồng chất 6 mặt. Có bao nhiêu kết quả thuận lợi cho biến cố “Số chấm xuất hiện là số chẵn”?',
    correctAnswerText: '3 (gồm mặt 2, 4, 6 chấm)',
    explanation: 'Các mặt có số chấm chẵn trên xúc xắc 6 mặt là 2, 4 và 6. Vậy có 3 kết quả thuận lợi.',
    topic: 'Thống kê & Xác suất',
    difficulty: 2,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_math_16',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Tìm hai số $x, y$ biết $\\frac{x}{3} = \\frac{y}{5}$ và $x + y = 32$:',
    options: [
      { optionId: 'm16_a', text: '$x = 12;\\; y = 20$' },
      { optionId: 'm16_b', text: '$x = 15;\\; y = 17$' },
      { optionId: 'm16_c', text: '$x = 9;\\; y = 23$' },
      { optionId: 'm16_d', text: '$x = 20;\\; y = 12$' },
    ],
    correctOptionId: 'm16_a',
    correctAnswerText: 'x = 12; y = 20',
    explanation: 'Áp dụng tính chất dãy tỉ số bằng nhau: $\\frac{x}{3} = \\frac{y}{5} = \\frac{x+y}{3+5} = \\frac{32}{8} = 4 \\Rightarrow x = 12, y = 20$.',
    topic: 'Đại số – Tỉ lệ thức',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_17',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Một hình thang có đáy lớn $10\\text{ cm}$, đáy nhỏ $6\\text{ cm}$ và chiều cao $5\\text{ cm}$. Diện tích hình thang đó bằng:',
    options: [
      { optionId: 'm17_a', text: '$40\\text{ cm}^2$' },
      { optionId: 'm17_b', text: '$80\\text{ cm}^2$' },
      { optionId: 'm17_c', text: '$30\\text{ cm}^2$' },
      { optionId: 'm17_d', text: '$50\\text{ cm}^2$' },
    ],
    correctOptionId: 'm17_a',
    correctAnswerText: '40 cm²',
    explanation: 'Diện tích hình thang: $S = \\frac{(a + b) \\cdot h}{2} = \\frac{(10 + 6) \\cdot 5}{2} = 40\\text{ cm}^2$.',
    topic: 'Hình học phẳng',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_18',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Phân tích đa thức $x^2 - 5x + 6$ thành nhân tử ta được kết quả nào?',
    options: [
      { optionId: 'm18_a', text: '$(x - 2)(x - 3)$' },
      { optionId: 'm18_b', text: '$(x + 2)(x + 3)$' },
      { optionId: 'm18_c', text: '$(x - 1)(x - 6)$' },
      { optionId: 'm18_d', text: '$(x + 1)(x - 6)$' },
    ],
    correctOptionId: 'm18_a',
    correctAnswerText: '(x - 2)(x - 3)',
    explanation: 'Tách hạng tử: $x^2 - 5x + 6 = x^2 - 2x - 3x + 6 = x(x - 2) - 3(x - 2) = (x - 2)(x - 3)$.',
    topic: 'Biểu thức đại số',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_19',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Với mọi giá trị thực của $x$, giá trị nhỏ nhất của biểu thức $P = (x - 4)^2 + 2025$ là:',
    options: [
      { optionId: 'm19_a', text: '$2025$' },
      { optionId: 'm19_b', text: '$2021$' },
      { optionId: 'm19_c', text: '$4$' },
      { optionId: 'm19_d', text: '$0$' },
    ],
    correctOptionId: 'm19_a',
    correctAnswerText: '2025',
    explanation: 'Vì $(x - 4)^2 \\ge 0$ với mọi $x \\in \\mathbb{R}$, nên $P = (x - 4)^2 + 2025 \\ge 2025$. Dấu bằng xảy ra khi $x = 4$.',
    topic: 'Biểu thức đại số – Cực trị',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_math_20',
    questionType: 'SHORT_ANSWER',
    stem: 'Tìm số tự nhiên $n$ biết $3^n + 3^{n+2} = 90$. Giá trị của $n$ bằng bao nhiêu?',
    correctAnswerText: 'n = 2 (hoặc 2)',
    explanation: 'Đặt nhân tử chung: $3^n \\cdot (1 + 3^2) = 90 \\Rightarrow 3^n \\cdot 10 = 90 \\Rightarrow 3^n = 9 = 3^2 \\Rightarrow n = 2$.',
    topic: 'Số học – Lũy thừa nâng cao',
    difficulty: 3,
    allowShuffle: false,
    isSample: true,
  },
];

export const SAMPLE_INFORMATICS_C02_QUESTIONS: C02QuestionItem[] = [
  {
    questionId: 'c02_info_01',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Thiết bị nào sau đây là thiết bị vào (Input Device) của máy tính?',
    options: [
      { optionId: 'i01_a', text: 'Bàn phím và chuột máy tính' },
      { optionId: 'i01_b', text: 'Màn hình hiển thị' },
      { optionId: 'i01_c', text: 'Loa và tai nghe thuần túy' },
      { optionId: 'i01_d', text: 'Máy chiếu lớp học' },
    ],
    correctOptionId: 'i01_a',
    correctAnswerText: 'Bàn phím và chuột máy tính',
    explanation: 'Bàn phím và chuột dùng để nhập dữ liệu, lệnh điều khiển vào máy tính nên là thiết bị vào (Input).',
    topic: 'Thiết bị số',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_02',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Trong hệ thống đo lường dung lượng dữ liệu chuẩn nhị phân, $1\\text{ Byte}$ bằng bao nhiêu $\\text{bit}$?',
    options: [
      { optionId: 'i02_a', text: '$8\\text{ bit}$' },
      { optionId: 'i02_b', text: '$10\\text{ bit}$' },
      { optionId: 'i02_c', text: '$16\\text{ bit}$' },
      { optionId: 'i02_d', text: '$1024\\text{ bit}$' },
    ],
    correctOptionId: 'i02_a',
    correctAnswerText: '8 bit',
    explanation: 'Đơn vị cơ bản của dữ liệu số là bit (0 hoặc 1), và $1\\text{ Byte} = 8\\text{ bit}$.',
    topic: 'Thông tin & Dữ liệu',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_03',
    questionType: 'TRUE_FALSE',
    stem: 'Khẳng định sau Đúng hay Sai: “Bộ nhớ RAM sẽ bị mất toàn bộ dữ liệu đang lưu tạm khi tắt nguồn máy tính.”',
    options: [
      { optionId: 'i03_true', text: 'Đúng' },
      { optionId: 'i03_false', text: 'Sai' },
    ],
    correctOptionId: 'i03_true',
    correctAnswerText: 'Đúng',
    explanation: 'RAM (Random Access Memory) là bộ nhớ truy cập ngẫu nhiên khả biến, chỉ lưu dữ liệu tạm thời khi máy đang hoạt động.',
    topic: 'Thiết bị & Bộ nhớ',
    difficulty: 1,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_info_04',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Phần mở rộng (đuôi tệp) nào sau đây thường là tệp văn bản của phần mềm Microsoft Word?',
    options: [
      { optionId: 'i04_a', text: '.docx' },
      { optionId: 'i04_b', text: '.mp3' },
      { optionId: 'i04_c', text: '.xlsx' },
      { optionId: 'i04_d', text: '.png' },
    ],
    correctOptionId: 'i04_a',
    correctAnswerText: '.docx',
    explanation: 'Tệp tài liệu soạn thảo Microsoft Word có phần mở rộng chuẩn là `.docx` (hoặc `.doc`).',
    topic: 'Tệp & Thư mục',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_05',
    questionType: 'SHORT_ANSWER',
    stem: 'Tổ hợp phím tắt chuẩn trên Windows dùng để Sao chép (Copy) nội dung đang chọn là gì?',
    correctAnswerText: 'Ctrl + C',
    explanation: 'Ctrl + C dùng để Sao chép (Copy), Ctrl + V dùng để Dán (Paste), và Ctrl + X dùng để Cắt (Cut).',
    topic: 'Soạn thảo & Thao tác tệp',
    difficulty: 1,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_info_06',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Phần mềm nào dưới đây là Trình duyệt web (Web Browser) dùng để truy cập các trang web trên Internet?',
    options: [
      { optionId: 'i06_a', text: 'Google Chrome' },
      { optionId: 'i06_b', text: 'Microsoft Excel' },
      { optionId: 'i06_c', text: 'Windows File Explorer' },
      { optionId: 'i06_d', text: 'Adobe Photoshop' },
    ],
    correctOptionId: 'i06_a',
    correctAnswerText: 'Google Chrome',
    explanation: 'Google Chrome (cùng với Firefox, Edge, Safari) là trình duyệt web giúp người dùng truy cập và xem các trang web.',
    topic: 'Mạng máy tính & Internet',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_07',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Trong cấu trúc cây thư mục trên máy tính, phát biểu nào sau đây là ĐÚNG?',
    options: [
      { optionId: 'i07_a', text: 'Một thư mục có thể chứa các tệp tin và các thư mục con bên trong' },
      { optionId: 'i07_b', text: 'Một tệp tin có thể chứa nhiều thư mục con bên trong' },
      { optionId: 'i07_c', text: 'Hai tệp tin cùng loại trong cùng một thư mục được phép đặt trùng hệt tên nhau' },
      { optionId: 'i07_d', text: 'Thư mục không thể đổi tên sau khi đã tạo' },
    ],
    correctOptionId: 'i07_a',
    correctAnswerText: 'Một thư mục có thể chứa các tệp tin và các thư mục con bên trong',
    explanation: 'Thư mục (Folder/Directory) là ngăn chứa giúp tổ chức dữ liệu theo hình cây, chứa được cả tệp tin và thư mục con.',
    topic: 'Tệp & Thư mục',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_08',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Mật khẩu nào dưới đây có độ an toàn cao nhất để bảo vệ tài khoản học tập trực tuyến?',
    options: [
      { optionId: 'i08_a', text: 'TayDo@Edu2027#9' },
      { optionId: 'i08_b', text: '12345678' },
      { optionId: 'i08_c', text: 'hocsinh123' },
      { optionId: 'i08_d', text: 'ngaysinh2012' },
    ],
    correctOptionId: 'i08_a',
    correctAnswerText: 'TayDo@Edu2027#9',
    explanation: 'Mật khẩu mạnh cần đủ độ dài (từ 8 ký tự trở lên) và kết hợp chữ hoa, chữ thường, chữ số cùng ký tự đặc biệt.',
    topic: 'An toàn số',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_09',
    questionType: 'TRUE_FALSE',
    stem: 'Khẳng định sau Đúng hay Sai: “Khi nhận được tin nhắn lạ yêu cầu cung cấp mã OTP ngân hàng hoặc mật khẩu tài khoản để nhận thưởng, em tuyệt đối không được cung cấp.”',
    options: [
      { optionId: 'i09_true', text: 'Đúng' },
      { optionId: 'i09_false', text: 'Sai' },
    ],
    correctOptionId: 'i09_true',
    correctAnswerText: 'Đúng',
    explanation: 'Mã OTP và mật khẩu là thông tin bảo mật cá nhân; việc chia sẻ cho người lạ sẽ dẫn đến nguy cơ bị chiếm đoạt tài khoản (lừa đảo Phishing).',
    topic: 'An toàn số',
    difficulty: 2,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_info_10',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Trong phần mềm bảng tính Excel, công thức nào sau đây tính tổng giá trị các ô từ `A1` đến `A5` đúng cú pháp?',
    options: [
      { optionId: 'i10_a', text: '=SUM(A1:A5)' },
      { optionId: 'i10_b', text: 'SUM(A1..A5)' },
      { optionId: 'i10_c', text: '=TOTAL(A1:A5)' },
      { optionId: 'i10_d', text: '=ADD(A1-A5)' },
    ],
    correctOptionId: 'i10_a',
    correctAnswerText: '=SUM(A1:A5)',
    explanation: 'Mọi công thức trong bảng tính bắt đầu bằng dấu `=`, hàm tính tổng là `SUM` và vùng địa chỉ liên tiếp ký hiệu bằng dấu hai chấm `:`.',
    topic: 'Bảng tính điện tử',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_11',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Bộ phận nào trong máy tính đóng vai trò là “bộ não” thực hiện các phép tính số học, logic và điều khiển mọi hoạt động của hệ thống?',
    options: [
      { optionId: 'i11_a', text: 'Bộ xử lý trung tâm (CPU)' },
      { optionId: 'i11_b', text: 'Ổ cứng lưu trữ (SSD/HDD)' },
      { optionId: 'i11_c', text: 'Card mạng không dây' },
      { optionId: 'i11_d', text: 'Bộ nguồn máy tính (PSU)' },
    ],
    correctOptionId: 'i11_a',
    correctAnswerText: 'Bộ xử lý trung tâm (CPU)',
    explanation: 'CPU (Central Processing Unit) là bộ xử lý trung tâm, đảm nhiệm giải mã lệnh, tính toán và điều khiển toàn bộ máy tính.',
    topic: 'Thiết bị số',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_12',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Ba cấu trúc điều khiển cơ bản để biểu diễn mọi thuật toán trong Tin học là gì?',
    options: [
      { optionId: 'i12_a', text: 'Tuần tự, Rẽ nhánh và Lặp' },
      { optionId: 'i12_b', text: 'Nhập dữ liệu, Lưu tệp và In ấn' },
      { optionId: 'i12_c', text: 'Sao chép, Cắt dán và Tìm kiếm' },
      { optionId: 'i12_d', text: 'Khởi động, Tạm dừng và Tắt máy' },
    ],
    correctOptionId: 'i12_a',
    correctAnswerText: 'Tuần tự, Rẽ nhánh và Lặp',
    explanation: 'Mọi thuật toán đều được xây dựng từ 3 cấu trúc điều khiển cơ bản: Tuần tự (Sequence), Rẽ nhánh (Selection) và Lặp (Iteration).',
    topic: 'Thuật toán & Lập trình',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_13',
    questionType: 'SHORT_ANSWER',
    stem: 'Trong sơ đồ khối mô tả thuật toán, hình thoi được sử dụng để biểu diễn thao tác gì?',
    correctAnswerText: 'Kiểm tra điều kiện (hoặc Rẽ nhánh / So sánh)',
    explanation: 'Trong sơ đồ khối chuẩn: Hình elip biểu diễn Bắt đầu/Kết thúc, Hình chữ nhật biểu diễn Xử lý/Tính toán, còn Hình thoi biểu diễn Kiểm tra điều kiện rẽ nhánh.',
    topic: 'Thuật toán',
    difficulty: 2,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_info_14',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Khi sử dụng công cụ tìm kiếm (Search Engine) trên Internet, để tìm chính xác cụm từ `"Tây Đô Smart EDU"` không bị tách rời, em nên đặt cụm từ đó trong dấu gì?',
    options: [
      { optionId: 'i14_a', text: 'Dấu ngoặc kép " "' },
      { optionId: 'i14_b', text: 'Dấu ngoặc vuông [ ]' },
      { optionId: 'i14_c', text: 'Dấu chấm hỏi ? ?' },
      { optionId: 'i14_d', text: 'Dấu gạch chéo / /' },
    ],
    correctOptionId: 'i14_a',
    correctAnswerText: 'Dấu ngoặc kép " "',
    explanation: 'Đặt từ khóa trong dấu ngoặc kép `"..."` giúp máy tìm kiếm lọc các kết quả chứa đúng nguyên văn cụm từ đó.',
    topic: 'Internet & Tìm kiếm thông tin',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_15',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Trong bảng tính Excel, nếu tại ô `C2` có công thức `=$A$1 + B2`, khi sao chép công thức từ ô `C2` xuống ô `C3` thì công thức tại ô `C3` sẽ là:',
    options: [
      { optionId: 'i15_a', text: '=$A$1 + B3' },
      { optionId: 'i15_b', text: '=$A$2 + B3' },
      { optionId: 'i15_c', text: '=$A$1 + B2' },
      { optionId: 'i15_d', text: '=A2 + B3' },
    ],
    correctOptionId: 'i15_a',
    correctAnswerText: '=$A$1 + B3',
    explanation: 'Địa chỉ tuyệt đối `$A$1` được cố định cả cột và hàng khi sao chép, còn địa chỉ tương đối `B2` tự động dịch chuyển thành `B3`.',
    topic: 'Bảng tính điện tử',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_16',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Cho đoạn thuật toán: Ban đầu `S = 0`. Lặp với `i` chạy từ `1` đến `4`: mỗi bước thực hiện `S = S + i`. Sau khi kết thúc vòng lặp, giá trị của `S` bằng bao nhiêu?',
    options: [
      { optionId: 'i16_a', text: '10' },
      { optionId: 'i16_b', text: '4' },
      { optionId: 'i16_c', text: '6' },
      { optionId: 'i16_d', text: '15' },
    ],
    correctOptionId: 'i16_a',
    correctAnswerText: '10',
    explanation: 'Vòng lặp cộng dồn các giá trị $i = 1, 2, 3, 4$ vào $S$: $S = 0 + 1 + 2 + 3 + 4 = 10$.',
    topic: 'Thuật toán – Vòng lặp',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_17',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Thuật toán Tìm kiếm nhị phân (Binary Search) chỉ áp dụng đúng khi danh sách dữ liệu đầu vào thỏa mãn điều kiện nào?',
    options: [
      { optionId: 'i17_a', text: 'Danh sách đã được sắp xếp theo thứ tự (tăng dần hoặc giảm dần)' },
      { optionId: 'i17_b', text: 'Danh sách có số phần tử là số chẵn' },
      { optionId: 'i17_c', text: 'Danh sách chỉ chứa các số nguyên âm' },
      { optionId: 'i17_d', text: 'Danh sách được xáo trộn ngẫu nhiên hoàn toàn' },
    ],
    correctOptionId: 'i17_a',
    correctAnswerText: 'Danh sách đã được sắp xếp theo thứ tự',
    explanation: 'Tìm kiếm nhị phân chia đôi phạm vi tìm kiếm ở mỗi bước dựa trên quan hệ lớn hơn/nhỏ hơn nên bắt buộc danh sách phải được sắp xếp trước.',
    topic: 'Thuật toán tìm kiếm',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_18',
    questionType: 'SHORT_ANSWER',
    stem: 'Đổi số nhị phân `1011` (hệ cơ số 2) sang hệ thập phân (hệ cơ số 10) ta được số nào?',
    correctAnswerText: '11',
    explanation: 'Ta có: $1011_2 = 1 \\cdot 2^3 + 0 \\cdot 2^2 + 1 \\cdot 2^1 + 1 \\cdot 2^0 = 8 + 0 + 2 + 1 = 11$.',
    topic: 'Biểu diễn dữ liệu – Hệ nhị phân',
    difficulty: 3,
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c02_info_19',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Giao thức mạng nào sau đây có tích hợp mã hóa bảo mật dữ liệu truyền tải giữa trình duyệt web và máy chủ web?',
    options: [
      { optionId: 'i19_a', text: 'HTTPS' },
      { optionId: 'i19_b', text: 'HTTP thường' },
      { optionId: 'i19_c', text: 'Telnet không mã hóa' },
      { optionId: 'i19_d', text: 'FTP chuẩn cũ' },
    ],
    correctOptionId: 'i19_a',
    correctAnswerText: 'HTTPS',
    explanation: 'HTTPS (Hypertext Transfer Protocol Secure) sử dụng chứng chỉ bảo mật SSL/TLS để mã hóa dữ liệu truyền giữa trình duyệt và máy chủ.',
    topic: 'An toàn mạng & Giao thức',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c02_info_20',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Với một danh sách gồm $32$ phần tử đã được sắp xếp tăng dần, thuật toán Tìm kiếm nhị phân cần tối đa bao nhiêu lần so sánh để kết luận một giá trị có trong danh sách hay không?',
    options: [
      { optionId: 'i20_a', text: '6 lần so sánh' },
      { optionId: 'i20_b', text: '32 lần so sánh' },
      { optionId: 'i20_c', text: '16 lần so sánh' },
      { optionId: 'i20_d', text: '2 lần so sánh' },
    ],
    correctOptionId: 'i20_a',
    correctAnswerText: '6 lần so sánh',
    explanation: 'Mỗi bước chia đôi phạm vi: $32 \\to 16 \\to 8 \\to 4 \\to 2 \\to 1 \\to 0$ (tối đa $\\lfloor \\log_2(32) \\rfloor + 1 = 5 + 1 = 6$ lần so sánh).',
    topic: 'Thuật toán tìm kiếm',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
];

const SAMPLE_STUDENT_NAMES_POOL: string[] = [
  'Nguyễn Minh An', 'Trần Hoàng Bách', 'Lê Ngọc Bảo Châu', 'Phạm Gia Bảo', 'Hoàng Minh Chiến',
  'Vũ Phương Dung', 'Đặng Quốc Đạt', 'Bùi Khánh Duy', 'Đỗ Thảo Giang', 'Ngô Gia Hân',
  'Dương Tuấn Hiển', 'Lý Minh Hiếu', 'Trương Bảo Hoàng', 'Phan Thanh Huyền', 'Huỳnh Gia Hưng',
  'Đinh Thiên Kim', 'Cao Tuấn Kiệt', 'Mai Ngọc Lan', 'Lâm Hoàng Long', 'Tạ Phương Linh',
  'Trịnh Quang Minh', 'Hà Bảo Nam', 'Võ Khánh Ngân', 'Đoàn Bích Ngọc', 'Nguyễn Khôi Nguyên',
  'Trần Thảo Nhi', 'Lê Hoàng Phong', 'Phạm Minh Phúc', 'Hoàng Bảo Quân', 'Vũ Thiên Quang',
  'Đặng Minh Sơn', 'Bùi Thanh Tâm', 'Đỗ Đức Thắng', 'Ngô Phương Thảo', 'Dương Quốc Thịnh',
  'Lý Minh Thư', 'Trương Thủy Tiên', 'Phan Anh Toàn', 'Huỳnh Bảo Trâm', 'Đinh Ngọc Trinh',
  'Cao Minh Triết', 'Mai Quốc Trung', 'Lâm Anh Tuấn', 'Tạ Thanh Tùng', 'Trịnh Cát Tường',
  'Hà Thảo Uyên', 'Võ Khánh Vân', 'Đoàn Quốc Việt', 'Nguyễn Hoàng Vũ', 'Trần Như Ý',
];

export function generateSampleParticipants(count: number): C02Participant[] {
  const safeCount = Math.max(1, Math.min(50, count));
  return Array.from({ length: safeCount }, (_, idx) => {
    const stt = idx + 1;
    const name = SAMPLE_STUDENT_NAMES_POOL[idx] || `Học sinh Mẫu ${String(stt).padStart(2, '0')}`;
    return {
      participantId: `c02_sample_stu_${stt}_${Math.random().toString(36).slice(2, 6)}`,
      stt,
      fullName: name,
      code: String(stt).padStart(2, '0'),
      isAbsent: false,
      isTemporaryLabel: false,
      isSampleStudent: true,
    };
  });
}

// ============================================================================
// WEB AUDIO SYNTHESIZER FOR GOLDEN BELL 3D
// No shaming sound on wrong answers; rich harmonic Golden Bell chime on victory
// ============================================================================

class GoldenBellSoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
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

  public playStartQuestion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [440, 554.37, 659.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const start = ctx.currentTime + i * 0.07;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.26);
      });
    } catch {}
  }

  public playTimeUpGong(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(293.66, ctx.currentTime + 0.65);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.72);
    } catch {}
  }

  public playConfirmRound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = ctx.currentTime + i * 0.08;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {}
  }

  public playRescueChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [392.0, 493.88, 587.33, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = ctx.currentTime + i * 0.09;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch {}
  }

  /**
   * Rich harmonic Golden Bell resonance — ONLY triggered when Golden Bell condition is truly met
   */
  public playGoldenBellToll(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const strikeOffsets = [0, 0.7, 1.4];
      strikeOffsets.forEach((offset) => {
        const harmonics = [
          { freq: 587.33, amp: 0.22, decay: 1.4 }, // D5 fundamental
          { freq: 1174.66, amp: 0.12, decay: 1.0 }, // D6 octave
          { freq: 1760.0, amp: 0.07, decay: 0.7 }, // A6 fifth
        ];
        harmonics.forEach((h) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const start = ctx.currentTime + offset;
          osc.frequency.setValueAtTime(h.freq, start);
          gain.gain.setValueAtTime(h.amp, start);
          gain.gain.exponentialRampToValueAtTime(0.0008, start + h.decay);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + h.decay + 0.05);
        });
      });
    } catch {}
  }

  public stopAll(): void {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        this.ctx.close().catch(() => {});
      } catch {}
      this.ctx = null;
    }
  }
}

// ============================================================================
// 3D GOLDEN BELL SCULPTURE COMPONENT (SECTION 4)
// Features: Arch Hanger (Giá treo), Crown (Đỉnh chuông), Metallic 3D Body (Thân chuông),
// Bell Rim/Mouth (Miệng chuông), and Dynamic Clapper (Quả lắc)
// ============================================================================

interface GoldenBell3DSculptureProps {
  isRinging: boolean;
  progressRatio: number; // 0..1
  reducedMotion: boolean;
  size?: 'compact' | 'large';
  onSkipRinging?: () => void;
}

const GoldenBell3DSculpture: React.FC<GoldenBell3DSculptureProps> = ({
  isRinging,
  progressRatio,
  reducedMotion,
  size = 'compact',
  onSkipRinging,
}) => {
  const isLarge = size === 'large';

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none ${
        isLarge ? 'w-56 h-60' : 'w-36 h-40'
      }`}
      style={{ perspective: '900px' }}
    >
      {/* Warm Ambient Spotlight Halo */}
      <div
        className={`absolute rounded-full pointer-events-none transition-all duration-700 ${
          isRinging
            ? 'w-full h-full bg-amber-400/35 blur-2xl scale-110'
            : 'w-4/5 h-4/5 bg-amber-400/15 blur-xl'
        }`}
      />

      {/* Acoustic Resonance Rings when Ringing */}
      {isRinging && !reducedMotion && (
        <>
          <div className="absolute inset-2 rounded-full border-2 border-amber-300/70 animate-ping pointer-events-none" />
          <div className="absolute inset-5 rounded-full border border-cyan-300/50 animate-pulse pointer-events-none" />
        </>
      )}

      {/* 3D SVG Architectural Frame + Swinging Bell Assembly */}
      <svg
        viewBox="0 0 220 230"
        className="w-full h-full overflow-visible drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)]"
        aria-label="Chuông Vàng 3D Tây Đô Smart EDU"
      >
        <defs>
          {/* Metallic Gold 3D Cylinder Gradient for Bell Body */}
          <linearGradient id="c02BellBodyGrad" x1="0%" y1="0%" x2="100%" y2="15%">
            <stop offset="0%" stopColor="#92400E" />
            <stop offset="18%" stopColor="#D97706" />
            <stop offset="38%" stopColor="#FDE047" />
            <stop offset="52%" stopColor="#FEF9C3" />
            <stop offset="68%" stopColor="#F59E0B" />
            <stop offset="88%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>

          {/* Inner Mouth Shadow Gradient */}
          <radialGradient id="c02BellInnerMouth" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#451A03" />
            <stop offset="65%" stopColor="#78350F" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>

          {/* Clapper Sphere Metallic Gradient */}
          <radialGradient id="c02ClapperGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="45%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#78350F" />
          </radialGradient>

          {/* Arch Pillar Gradient */}
          <linearGradient id="c02ArchPillarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="35%" stopColor="#1E3A8A" />
            <stop offset="65%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>

        {/* 1. 3D Stage Pedestal Base */}
        <ellipse cx="110" cy="212" rx="86" ry="12" fill="#0B1528" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.45" />
        <ellipse cx="110" cy="209" rx="72" ry="8" fill="#172554" stroke="#F59E0B" strokeWidth="1.2" strokeOpacity="0.6" />

        {/* 2. Support Arch Frame (Giá treo chuông) */}
        <path
          d="M 38 208 L 46 42 Q 110 12 174 42 L 182 208"
          fill="none"
          stroke="url(#c02ArchPillarGrad)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* Golden Arch Top Beam */}
        <path
          d="M 40 44 Q 110 16 180 44"
          fill="none"
          stroke="url(#c02BellBodyGrad)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Top Suspension Mount */}
        <rect x="96" y="25" width="28" height="14" rx="4" fill="url(#c02BellBodyGrad)" stroke="#FEF08A" strokeWidth="1" />

        {/* 3. Swinging Bell Group (Thân chuông + Miệng chuông + Quả lắc) */}
        <g
          style={{
            transformOrigin: '110px 38px',
            transform:
              isRinging && !reducedMotion
                ? 'rotate(-9deg)'
                : 'rotate(0deg)',
            animation:
              isRinging && !reducedMotion
                ? 'c02BellSwing 0.55s ease-in-out infinite alternate'
                : 'none',
          }}
        >
          {/* Crown Loop (Quai treo đỉnh chuông) */}
          <path
            d="M 98 54 C 98 36, 122 36, 122 54"
            fill="none"
            stroke="url(#c02BellBodyGrad)"
            strokeWidth="6.5"
          />
          <ellipse cx="110" cy="56" rx="18" ry="6" fill="url(#c02BellBodyGrad)" />

          {/* Main 3D Bell Body (Thân chuông kim loại vàng) */}
          <path
            d="M 92 56
               C 84 62, 74 88, 68 126
               C 63 148, 52 162, 48 168
               L 172 168
               C 168 162, 157 148, 152 126
               C 146 88, 136 62, 128 56
               Z"
            fill="url(#c02BellBodyGrad)"
            stroke="#FEF08A"
            strokeWidth="1.2"
          />

          {/* Decorative Engraved Knowledge Bands on Bell Body */}
          <path
            d="M 80 86 Q 110 93 140 86"
            fill="none"
            stroke="#FEF9C3"
            strokeWidth="2"
            strokeOpacity="0.8"
          />
          <path
            d="M 65 138 Q 110 148 155 138"
            fill="none"
            stroke="#FEF9C3"
            strokeWidth="2.5"
            strokeOpacity="0.85"
          />

          {/* Specular Vertical Highlight Strip */}
          <path
            d="M 98 62 C 94 88, 88 124, 82 158"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeOpacity="0.45"
          />

          {/* Star Emblem on Bell Chest */}
          <polygon
            points="110,98 114,108 125,108 116,114 119,125 110,118 101,125 104,114 95,108 106,108"
            fill="#FEF9C3"
            stroke="#92400E"
            strokeWidth="1"
          />

          {/* 3D Bell Mouth Rim (Miệng chuông) */}
          <ellipse
            cx="110"
            cy="168"
            rx="62"
            ry="13"
            fill="url(#c02BellInnerMouth)"
            stroke="url(#c02BellBodyGrad)"
            strokeWidth="4"
          />

          {/* Clapper Assembly (Quả lắc chuông chuyển động ngược pha hợp lý) */}
          <g
            style={{
              transformOrigin: '110px 150px',
              animation:
                isRinging && !reducedMotion
                  ? 'c02ClapperSwing 0.55s ease-in-out infinite alternate-reverse'
                  : 'none',
            }}
          >
            <line
              x1="110"
              y1="154"
              x2="110"
              y2="178"
              stroke="#FDE047"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle
              cx="110"
              cy="183"
              r="10.5"
              fill="url(#c02ClapperGrad)"
              stroke="#FEF9C3"
              strokeWidth="1.5"
            />
          </g>
        </g>

        {/* Progress Arc Ring Around Base */}
        <ellipse
          cx="110"
          cy="209"
          rx="72"
          ry="8"
          fill="none"
          stroke="#22D3EE"
          strokeWidth="2.5"
          strokeDasharray={`${Math.round(progressRatio * 230)} 240`}
        />
      </svg>

      {/* CSS Keyframes for realistic Bell + Clapper motion */}
      <style>{`
        @keyframes c02BellSwing {
          0% { transform: rotate(-11deg); }
          100% { transform: rotate(11deg); }
        }
        @keyframes c02ClapperSwing {
          0% { transform: translateX(-10px) rotate(-14deg); }
          100% { transform: translateX(10px) rotate(14deg); }
        }
      `}</style>

      {isRinging && onSkipRinging && (
        <button
          type="button"
          onClick={onSkipRinging}
          className="mt-1 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-amber-200 border border-amber-400/40 text-[11px] font-bold cursor-pointer"
        >
          Bỏ qua hiệu ứng chuông
        </button>
      )}
    </div>
  );
};

// ============================================================================
// PERSISTENCE INTERFACE (ISOLATED KEY: taydo_smart_edu_c02_active_session_v1)
// ============================================================================

interface C02PersistedSession {
  version: number;
  savedAt: number;
  playMode: C02PlayMode;
  initialPlayMode: C02PlayMode;
  switchedModeMidSession: boolean;
  switchedAtQuestionNumber: number | null;
  datasetKey: C02DatasetKey;
  questionCount: C02QuestionCount;
  timeLimitSeconds: C02QuestionTimeLimit;
  autoStartTimer: boolean;
  rescueEnabled: boolean;
  maxRescueCount: number;
  participants: C02Participant[];
  questionPool: C02QuestionItem[];
  optionOrdersByQuestionId: Record<string, string[]>;
  currentQuestionIndex: number;
  stagePhase: C02StagePhase;
  draftMarks: Record<string, C02StudentMark>;
  questionRecords: C02QuestionRecord[];
  rescueEvents: C02RescueEvent[];
  remainingMsSnapshot: number;
  endReason: C02EndReason;
}

function loadC02PersistedSession(): C02PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(C02_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as C02PersistedSession;
    if (
      !parsed ||
      parsed.version !== C02_STORAGE_VERSION ||
      !Array.isArray(parsed.participants) ||
      !Array.isArray(parsed.questionPool) ||
      parsed.questionPool.length === 0 ||
      Date.now() - parsed.savedAt > C02_SESSION_TTL_MS
    ) {
      window.localStorage.removeItem(C02_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(C02_STORAGE_KEY);
    } catch {}
    return null;
  }
}

function saveC02PersistedSession(session: C02PersistedSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(C02_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

function clearC02PersistedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(C02_STORAGE_KEY);
  } catch {}
}

// ============================================================================
// MAIN COMPONENT: GoldenBell3DGame (C02 – RUNG CHUÔNG VÀNG 3D)
// ============================================================================

export const GoldenBell3DGame: React.FC<GoldenBell3DGameProps> = ({
  allCandidates = [],
  absentIds = new Set(),
  classes = [],
  questions = [],
  selectedSourceKey = 'manual',
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onCloseGame,
}) => {
  // 1. Setup Configuration State
  const [playMode, setPlayMode] = useState<C02PlayMode>('PRACTICE_NO_ELIMINATION');
  const [initialPlayMode, setInitialPlayMode] = useState<C02PlayMode>('PRACTICE_NO_ELIMINATION');
  const [switchedModeMidSession, setSwitchedModeMidSession] = useState<boolean>(false);
  const [switchedAtQuestionNumber, setSwitchedAtQuestionNumber] = useState<number | null>(null);

  const [datasetKey, setDatasetKey] = useState<C02DatasetKey>('SAMPLE_MATH');
  const [questionCount, setQuestionCount] = useState<C02QuestionCount>(10);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<C02QuestionTimeLimit>(30);
  const [autoStartTimer, setAutoStartTimer] = useState<boolean>(false);
  const [rescueEnabled, setRescueEnabled] = useState<boolean>(true);
  const [maxRescueCount] = useState<number>(1);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // 2. Roster & Participants Setup State
  const [rosterInputMode, setRosterInputMode] = useState<'CLASS_LIST' | 'QUICK_TEXT' | 'SAMPLE_LIST'>(() =>
    allCandidates.length > 0 ? 'CLASS_LIST' : 'SAMPLE_LIST'
  );
  const [quickTextNames, setQuickTextNames] = useState<string>('');
  const [sampleStudentCount, setSampleStudentCount] = useState<number>(10);
  const [autoLabelCount, setAutoLabelCount] = useState<number>(10);
  const [setupParticipants, setSetupParticipants] = useState<C02Participant[]>(() => {
    if (allCandidates.length > 0 && allCandidates.length <= 50) {
      return allCandidates.map((c, idx) => ({
        participantId: `c02_cls_${c.id}_${idx + 1}`,
        stt: idx + 1,
        fullName: c.fullName,
        code: c.code || String(idx + 1).padStart(2, '0'),
        isAbsent: absentIds.has(c.id),
        isTemporaryLabel: false,
      }));
    }
    return generateSampleParticipants(10);
  });
  const [rosterErrorMsg, setRosterErrorMsg] = useState<string | null>(null);

  // Sync when teacher switches class in CLASS_LIST mode during SETUP
  const handleSyncFromClassCandidates = useCallback(() => {
    setRosterErrorMsg(null);
    if (allCandidates.length === 0) {
      setRosterErrorMsg('Lớp hiện tại chưa có danh sách học sinh. Bạn có thể nhập nhanh tên hoặc tạo nhãn tạm "Học sinh 01...".');
      return;
    }
    if (allCandidates.length > 50) {
      setRosterErrorMsg(
        `Danh sách lớp đang có ${allCandidates.length} học sinh (vượt giới hạn tối đa 50 học sinh của sân khấu C02). Vui lòng đánh dấu vắng bớt hoặc chỉnh danh sách xuống tối đa 50 người tham gia.`
      );
    }
    const mapped: C02Participant[] = allCandidates.map((c, idx) => ({
      participantId: `c02_cls_${c.id}_${idx + 1}`,
      stt: idx + 1,
      fullName: c.fullName,
      code: c.code || String(idx + 1).padStart(2, '0'),
      isAbsent: absentIds.has(c.id),
      isTemporaryLabel: false,
    }));
    setSetupParticipants(mapped);
  }, [allCandidates, absentIds]);

  const handleApplyQuickTextRoster = () => {
    setRosterErrorMsg(null);
    const lines = quickTextNames
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      // Auto-generate temporary labels "Học sinh 01..." per Section 6
      const count = Math.max(1, Math.min(50, autoLabelCount));
      const tempList: C02Participant[] = Array.from({ length: count }, (_, idx) => {
        const stt = idx + 1;
        const code = String(stt).padStart(2, '0');
        return {
          participantId: `c02_temp_${stt}_${Date.now()}`,
          stt,
          fullName: `Học sinh ${code}`,
          code,
          isAbsent: false,
          isTemporaryLabel: true,
        };
      });
      setSetupParticipants(tempList);
      return;
    }

    if (lines.length > 50) {
      setRosterErrorMsg(
        `Bạn đã nhập ${lines.length} dòng tên (vượt giới hạn 50 học sinh). Hệ thống không tự động cắt bớt để tránh thiếu sót; vui lòng giảm xuống tối đa 50 dòng.`
      );
      return;
    }

    const customList: C02Participant[] = lines.map((name, idx) => {
      const stt = idx + 1;
      const code = String(stt).padStart(2, '0');
      return {
        participantId: `c02_manual_${stt}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        stt,
        fullName: name,
        code,
        isAbsent: false,
        isTemporaryLabel: false,
      };
    });
    setSetupParticipants(customList);
  };

  const handleApplySampleRoster = (count: number) => {
    setRosterErrorMsg(null);
    setSampleStudentCount(count);
    setSetupParticipants(generateSampleParticipants(count));
  };

  const handleToggleSetupAbsent = (participantId: string) => {
    setSetupParticipants((prev) =>
      prev.map((p) => (p.participantId === participantId ? { ...p, isAbsent: !p.isAbsent } : p))
    );
  };

  // Detect duplicate names so we can clearly highlight disambiguation by STT
  const duplicateNamesSet = useMemo(() => {
    const counts = new Map<string, number>();
    setupParticipants.forEach((p) => {
      const norm = p.fullName.trim().toLowerCase();
      counts.set(norm, (counts.get(norm) || 0) + 1);
    });
    const dupes = new Set<string>();
    counts.forEach((c, k) => {
      if (c > 1) dupes.add(k);
    });
    return dupes;
  }, [setupParticipants]);

  // 3. Question Bank Conversion & Availability Check (Section 6 & 10)
  const validBankQuestions = useMemo<C02QuestionItem[]>(() => {
    const seenIds = new Set<string>();
    const list: C02QuestionItem[] = [];

    for (const q of questions) {
      if (!q || !q.stem) continue;
      const stem = q.stem.trim();
      if (!stem) continue;
      const qId = q.id || `bank_${list.length + 1}`;
      if (seenIds.has(qId)) continue;

      const difficulty: 1 | 2 | 3 =
        q.level === 'know'
          ? 1
          : q.level === 'understand'
          ? 2
          : q.level === 'apply' || q.level === 'high_apply'
          ? 3
          : 2;

      const topicLabel = q.chapter || q.lesson || q.subject || 'Ngân hàng câu hỏi';

      if (Array.isArray(q.options) && q.options.length === 4) {
        const optionItems: C02OptionItem[] = q.options.map((opt, idx) => ({
          optionId: `${qId}_opt_${opt.id || opt.label || idx}`,
          text: (opt.text || '').trim(),
        }));
        const target = String(q.correctAnswer || '').trim().toLowerCase();
        const matchedIdx = q.options.findIndex(
          (opt) =>
            (opt.id || '').trim().toLowerCase() === target ||
            (opt.label || '').trim().toLowerCase() === target ||
            (opt.text || '').trim().toLowerCase() === target
        );
        const correctIdx = matchedIdx >= 0 ? matchedIdx : 0;

        seenIds.add(qId);
        list.push({
          questionId: qId,
          questionType: 'MULTIPLE_CHOICE',
          stem,
          options: optionItems,
          correctOptionId: optionItems[correctIdx].optionId,
          correctAnswerText: optionItems[correctIdx].text,
          explanation:
            (q.explanation || '').trim() ||
            `Đáp án đúng là: ${optionItems[correctIdx].text}.`,
          topic: topicLabel,
          difficulty,
          allowShuffle: !hasPositionalOptionDependency(optionItems),
          isSample: false,
        });
      } else if (q.correctAnswer && String(q.correctAnswer).trim()) {
        seenIds.add(qId);
        list.push({
          questionId: qId,
          questionType: 'SHORT_ANSWER',
          stem,
          correctAnswerText: String(q.correctAnswer).trim(),
          explanation:
            (q.explanation || '').trim() ||
            `Đáp án đúng: ${String(q.correctAnswer).trim()}.`,
          topic: topicLabel,
          difficulty,
          allowShuffle: false,
          isSample: false,
        });
      }
    }
    return list;
  }, [questions]);

  const availablePoolForDataset = useMemo<C02QuestionItem[]>(() => {
    if (datasetKey === 'SAMPLE_MATH') return SAMPLE_MATH_C02_QUESTIONS;
    if (datasetKey === 'SAMPLE_INFORMATICS') return SAMPLE_INFORMATICS_C02_QUESTIONS;
    return validBankQuestions;
  }, [datasetKey, validBankQuestions]);

  // 4. Active Session Runtime State
  const [stagePhase, setStagePhase] = useState<C02StagePhase>('SETUP');
  const [layoutView, setLayoutView] = useState<C02LayoutView>('PRESENTATION');
  const [questionPool, setQuestionPool] = useState<C02QuestionItem[]>([]);
  const [optionOrdersByQuestionId, setOptionOrdersByQuestionId] = useState<Record<string, string[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);

  // Ledger state: questionRecords + rescueEvents
  const [questionRecords, setQuestionRecords] = useState<C02QuestionRecord[]>([]);
  const [rescueEvents, setRescueEvents] = useState<C02RescueEvent[]>([]);

  // Current question grading draft state + undo history stack
  const [draftMarks, setDraftMarks] = useState<Record<string, C02StudentMark>>({});
  const [draftUndoStack, setDraftUndoStack] = useState<Record<string, C02StudentMark>[]>([]);
  const [isEditingConfirmedQuestion, setIsEditingConfirmedQuestion] = useState<boolean>(false);

  // Batch confirmation modal for "Mark ungraded as NO_ANSWER / WRONG"
  const [pendingBatchAction, setPendingBatchAction] = useState<{
    targetMark: 'NO_ANSWER' | 'WRONG';
    targetIds: string[];
  } | null>(null);

  // Rescue modal state (Section 9)
  const [showRescueModal, setShowRescueModal] = useState<boolean>(false);
  const [selectedRescueIds, setSelectedRescueIds] = useState<Set<string>>(new Set());

  // Controlled Rollback modal state (Section 11)
  const [showRollbackModal, setShowRollbackModal] = useState<boolean>(false);
  const [rollbackTargetQuestionNumber, setRollbackTargetQuestionNumber] = useState<number>(1);

  // Student grid filter & search (Section 8)
  const [studentFilter, setStudentFilter] = useState<C02StudentFilter>('ALL');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [isRosterPanelExpanded, setIsRosterPanelExpanded] = useState<boolean>(true);

  // Pause & End Reason
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [endReason, setEndReason] = useState<C02EndReason>(null);
  const [isBellRinging, setIsBellRinging] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [summaryTab, setSummaryTab] = useState<'LEADERBOARD' | 'KNOWLEDGE_REVIEW' | 'HISTORY_LOG'>('LEADERBOARD');

  // Saved session recovery prompt
  const [savedSessionToRestore, setSavedSessionToRestore] = useState<C02PersistedSession | null>(() =>
    loadC02PersistedSession()
  );

  // 5. Single Deadline-Based Timer (Section 12)
  const [remainingMs, setRemainingMs] = useState<number>(30000);
  const deadlineRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const activeStepTokenRef = useRef<number>(0);
  const isConfirmLockRef = useRef<boolean>(false);

  // Sound & Voice Managers
  const soundRef = useRef<GoldenBellSoundEngine>(new GoldenBellSoundEngine());
  const voiceRef = useRef<SpaceRocketVoiceManager>(new SpaceRocketVoiceManager());

  useEffect(() => {
    soundRef.current.muted = isMuted;
    if (isMuted || !voiceEnabled) {
      voiceRef.current.cancel();
    }
  }, [isMuted, voiceEnabled]);

  useEffect(() => {
    const soundEngine = soundRef.current;
    const voiceManager = voiceRef.current;
    return () => {
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      soundEngine.stopAll();
      voiceManager.cancel();
    };
  }, []);

  // Compute Ledger State up to BEFORE current question (or all confirmed questions)
  const recordsBeforeCurrent = useMemo(() => {
    return questionRecords.filter((r) => r.questionIndex < currentQuestionIndex);
  }, [questionRecords, currentQuestionIndex]);

  const rescueEventsBeforeCurrent = useMemo(() => {
    return rescueEvents.filter((ev) => ev.afterQuestionNumber <= currentQuestionIndex);
  }, [rescueEvents, currentQuestionIndex]);

  // Ledger state at the start of the current question (determines who is eligible to be graded in this question)
  const ledgerAtQuestionStart = useMemo(() => {
    return computeParticipantsLedger({
      participants: setupParticipants,
      questionRecords: recordsBeforeCurrent,
      rescueEvents: rescueEventsBeforeCurrent,
      currentPlayMode: playMode,
      initialPlayMode,
      switchedModeMidSession,
      totalPlannedQuestions: questionPool.length || questionCount,
      isSessionFinished: false,
    });
  }, [
    setupParticipants,
    recordsBeforeCurrent,
    rescueEventsBeforeCurrent,
    playMode,
    initialPlayMode,
    switchedModeMidSession,
    questionPool.length,
    questionCount,
  ]);

  // Full current ledger (including current question if already CONFIRMED, and any rescues after it)
  const currentLedger = useMemo(() => {
    return computeParticipantsLedger({
      participants: setupParticipants,
      questionRecords,
      rescueEvents,
      currentPlayMode: playMode,
      initialPlayMode,
      switchedModeMidSession,
      totalPlannedQuestions: questionPool.length || questionCount,
      isSessionFinished: stagePhase === 'FINISHED',
    });
  }, [
    setupParticipants,
    questionRecords,
    rescueEvents,
    playMode,
    initialPlayMode,
    switchedModeMidSession,
    questionPool.length,
    questionCount,
    stagePhase,
  ]);

  // Eligible participant IDs for the current question
  const eligibleIdsForCurrentQuestion = useMemo<string[]>(() => {
    if (playMode === 'PRACTICE_NO_ELIMINATION') {
      return setupParticipants.filter((p) => !p.isAbsent).map((p) => p.participantId);
    }
    return ledgerAtQuestionStart
      .filter((item) => item.status === 'ACTIVE')
      .map((item) => item.participant.participantId);
  }, [playMode, setupParticipants, ledgerAtQuestionStart]);

  const eligibleSetForCurrentQuestion = useMemo(
    () => new Set(eligibleIdsForCurrentQuestion),
    [eligibleIdsForCurrentQuestion]
  );

  const currentQuestion = questionPool[currentQuestionIndex] || null;

  const currentDisplayOptions = useMemo<C02DisplayOption[]>(() => {
    if (!currentQuestion) return [];
    return buildDisplayOptionsForC02(
      currentQuestion,
      optionOrdersByQuestionId[currentQuestion.questionId]
    );
  }, [currentQuestion, optionOrdersByQuestionId]);

  // Initialize draftMarks for current question whenever entering a new question
  const initDraftMarksForQuestion = useCallback(
    (eligibleIds: string[]) => {
      const eligibleLookup = new Set(eligibleIds);
      const nextMarks: Record<string, C02StudentMark> = {};
      setupParticipants.forEach((p) => {
        if (p.isAbsent) return;
        nextMarks[p.participantId] = eligibleLookup.has(p.participantId)
          ? 'UNGRADED'
          : 'NOT_IN_ROUND';
      });
      setDraftMarks(nextMarks);
      setDraftUndoStack([]);
      setIsEditingConfirmedQuestion(false);
    },
    [setupParticipants]
  );

  // Stop countdown timer cleanly
  const stopCountdownTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    deadlineRef.current = null;
  }, []);

  // Start countdown timer using single deadlineTimestamp
  const startCountdownTimer = useCallback(
    (durationMs: number, stepToken: number) => {
      stopCountdownTimer();
      if (timeLimitSeconds === 0) {
        setRemainingMs(0);
        return;
      }
      const targetDeadline = Date.now() + durationMs;
      deadlineRef.current = targetDeadline;
      setRemainingMs(durationMs);

      timerIntervalRef.current = window.setInterval(() => {
        if (activeStepTokenRef.current !== stepToken) {
          stopCountdownTimer();
          return;
        }
        if (!deadlineRef.current) return;
        const left = Math.max(0, deadlineRef.current - Date.now());
        setRemainingMs(left);
        if (left <= 0) {
          stopCountdownTimer();
          soundRef.current.playTimeUpGong();
          setStagePhase((prev) => (prev === 'ANSWERING' ? 'TIME_UP' : prev));
        }
      }, 200);
    },
    [stopCountdownTimer, timeLimitSeconds]
  );

  // Persist active session whenever state changes during active play
  useEffect(() => {
    if (stagePhase === 'SETUP') return;
    if (stagePhase === 'FINISHED') {
      clearC02PersistedSession();
      return;
    }
    saveC02PersistedSession({
      version: C02_STORAGE_VERSION,
      savedAt: Date.now(),
      playMode,
      initialPlayMode,
      switchedModeMidSession,
      switchedAtQuestionNumber,
      datasetKey,
      questionCount,
      timeLimitSeconds,
      autoStartTimer,
      rescueEnabled,
      maxRescueCount,
      participants: setupParticipants,
      questionPool,
      optionOrdersByQuestionId,
      currentQuestionIndex,
      stagePhase,
      draftMarks,
      questionRecords,
      rescueEvents,
      remainingMsSnapshot: remainingMs,
      endReason,
    });
  }, [
    stagePhase,
    playMode,
    initialPlayMode,
    switchedModeMidSession,
    switchedAtQuestionNumber,
    datasetKey,
    questionCount,
    timeLimitSeconds,
    autoStartTimer,
    rescueEnabled,
    maxRescueCount,
    setupParticipants,
    questionPool,
    optionOrdersByQuestionId,
    currentQuestionIndex,
    draftMarks,
    questionRecords,
    rescueEvents,
    remainingMs,
    endReason,
  ]);

  // Speak helper (Vietnamese TTS)
  const speakVietnameseText = useCallback(
    (text: string) => {
      if (isMuted || !voiceEnabled) return;
      const clean = text.replace(/\$/g, '').replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 phần $2');
      const res = voiceRef.current.speakVietnamese(clean, isMuted || !voiceEnabled);
      if (!res.spoken && res.reason === 'no_vietnamese_voice') {
        setVoiceNotice('Thiết bị chưa cài giọng đọc tiếng Việt (vi-VN). Trò chơi vẫn hoạt động bình thường với phụ đề trên màn hình.');
      }
    },
    [isMuted, voiceEnabled]
  );

  // ============================================================================
  // SESSION START & RESTORE HANDLERS
  // ============================================================================

  const handleStartSession = () => {
    setRosterErrorMsg(null);
    const presentParticipants = setupParticipants.filter((p) => !p.isAbsent);
    if (presentParticipants.length === 0) {
      setRosterErrorMsg('Cần ít nhất 1 học sinh có mặt hợp lệ để bắt đầu phiên chơi C02.');
      return;
    }
    if (presentParticipants.length > 50) {
      setRosterErrorMsg(
        `Hiện có ${presentParticipants.length} học sinh tham gia (vượt giới hạn tối đa 50 học sinh). Vui lòng đánh dấu vắng bớt hoặc giảm danh sách xuống tối đa 50 học sinh.`
      );
      return;
    }
    if (availablePoolForDataset.length < questionCount) {
      setRosterErrorMsg(
        `Nguồn câu hỏi đã chọn hiện có ${availablePoolForDataset.length} câu hợp lệ, chưa đủ ${questionCount} câu. Vui lòng giảm số câu xuống mức khả dụng.`
      );
      return;
    }

    // Build session question pool: sort by difficulty (1 -> 2 -> 3) when reliable difficulty exists
    const poolCopy = [...availablePoolForDataset];
    const selectedQuestions = poolCopy
      .sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2))
      .slice(0, questionCount);

    // Pre-generate option orders once per session so restore preserves exact option order
    const optionOrders: Record<string, string[]> = {};
    selectedQuestions.forEach((q) => {
      const displayOpts = buildDisplayOptionsForC02(q);
      if (displayOpts.length > 0) {
        optionOrders[q.questionId] = displayOpts.map((o) => o.optionId);
      }
    });

    setQuestionPool(selectedQuestions);
    setOptionOrdersByQuestionId(optionOrders);
    setCurrentQuestionIndex(0);
    setQuestionRecords([]);
    setRescueEvents([]);
    setInitialPlayMode(playMode);
    setSwitchedModeMidSession(false);
    setSwitchedAtQuestionNumber(null);
    setEndReason(null);
    setIsBellRinging(false);
    setIsPaused(false);
    setSavedSessionToRestore(null);
    setLayoutView('PRESENTATION');

    const initialEligibleIds = presentParticipants.map((p) => p.participantId);
    initDraftMarksForQuestion(initialEligibleIds);

    activeStepTokenRef.current += 1;
    const token = activeStepTokenRef.current;
    const initialMs = timeLimitSeconds * 1000;
    setRemainingMs(initialMs);

    soundRef.current.playStartQuestion();
    if (selectedQuestions[0]) {
      speakVietnameseText(`Câu hỏi số 1: ${selectedQuestions[0].stem}`);
    }

    if (autoStartTimer || timeLimitSeconds === 0) {
      setStagePhase('ANSWERING');
      if (timeLimitSeconds > 0) {
        startCountdownTimer(initialMs, token);
      }
    } else {
      setStagePhase('QUESTION_READY');
    }
  };

  const handleRestoreSavedSession = () => {
    if (!savedSessionToRestore) return;
    const s = savedSessionToRestore;
    setPlayMode(s.playMode);
    setInitialPlayMode(s.initialPlayMode);
    setSwitchedModeMidSession(s.switchedModeMidSession);
    setSwitchedAtQuestionNumber(s.switchedAtQuestionNumber);
    setDatasetKey(s.datasetKey);
    setQuestionCount(s.questionCount);
    setTimeLimitSeconds(s.timeLimitSeconds);
    setAutoStartTimer(s.autoStartTimer);
    setRescueEnabled(s.rescueEnabled);
    setSetupParticipants(s.participants);
    setQuestionPool(s.questionPool);
    setOptionOrdersByQuestionId(s.optionOrdersByQuestionId || {});
    setCurrentQuestionIndex(s.currentQuestionIndex);
    setQuestionRecords(s.questionRecords || []);
    setRescueEvents(s.rescueEvents || []);
    setDraftMarks(s.draftMarks || {});
    setDraftUndoStack([]);
    setRemainingMs(s.remainingMsSnapshot || s.timeLimitSeconds * 1000);
    setEndReason(s.endReason || null);
    setIsPaused(false);

    // If it was mid-countdown ('ANSWERING'), resume in 'QUESTION_READY' or paused-ready so teacher has control
    const restoredPhase =
      s.stagePhase === 'ANSWERING' && s.timeLimitSeconds > 0
        ? 'QUESTION_READY'
        : s.stagePhase;
    setStagePhase(restoredPhase);
    setSavedSessionToRestore(null);
  };

  const handleDiscardSavedSession = () => {
    clearC02PersistedSession();
    setSavedSessionToRestore(null);
  };

  // ============================================================================
  // QUESTION LIFECYCLE HANDLERS (SECTIONS 7, 8, 9, 11, 12)
  // ============================================================================

  const handleBeginTimerForCurrentQuestion = () => {
    if (stagePhase !== 'QUESTION_READY') return;
    activeStepTokenRef.current += 1;
    const token = activeStepTokenRef.current;
    setStagePhase('ANSWERING');
    const ms = remainingMs > 0 ? remainingMs : timeLimitSeconds * 1000;
    if (timeLimitSeconds > 0) {
      startCountdownTimer(ms, token);
    }
  };

  const handleManualStopAnswering = () => {
    if (stagePhase !== 'ANSWERING') return;
    stopCountdownTimer();
    soundRef.current.playTimeUpGong();
    setStagePhase('TIME_UP');
  };

  const handleRevealAnswer = () => {
    if (stagePhase !== 'ANSWERING' && stagePhase !== 'TIME_UP' && stagePhase !== 'QUESTION_READY') {
      return;
    }
    stopCountdownTimer();
    voiceRef.current.cancel();
    setStagePhase('ANSWER_REVEALED');
    if (currentQuestion) {
      speakVietnameseText(
        `Đáp án đúng là ${currentQuestion.correctAnswerText}. ${currentQuestion.explanation}`
      );
    }
  };

  const handleOpenGradingPhase = () => {
    if (stagePhase !== 'ANSWER_REVEALED' && stagePhase !== 'CONFIRMED') return;
    setStagePhase('GRADING');
    setLayoutView('GRADING_WORKSPACE');
  };

  // Update a single student's mark during GRADING
  const handleSetStudentMark = (participantId: string, nextMark: C02StudentMark) => {
    if (stagePhase !== 'GRADING' && stagePhase !== 'ANSWER_REVEALED') return;
    if (!eligibleSetForCurrentQuestion.has(participantId)) return;

    setDraftUndoStack((prev) => [...prev.slice(-15), { ...draftMarks }]);
    setDraftMarks((prev) => ({
      ...prev,
      [participantId]: nextMark,
    }));
  };

  // Batch action: Mark ALL eligible students in this question as CORRECT
  const handleBatchMarkAllEligibleCorrect = () => {
    if (stagePhase !== 'GRADING' && stagePhase !== 'ANSWER_REVEALED') return;
    setDraftUndoStack((prev) => [...prev.slice(-15), { ...draftMarks }]);
    setDraftMarks((prev) => {
      const next = { ...prev };
      eligibleIdsForCurrentQuestion.forEach((id) => {
        next[id] = 'CORRECT';
      });
      return next;
    });
  };

  // Request batch action on UNGRADED eligible students (requires confirmation modal)
  const handleRequestBatchMarkUngraded = (targetMark: 'NO_ANSWER' | 'WRONG') => {
    const ungradedIds = eligibleIdsForCurrentQuestion.filter(
      (id) => (draftMarks[id] || 'UNGRADED') === 'UNGRADED'
    );
    if (ungradedIds.length === 0) return;
    setPendingBatchAction({
      targetMark,
      targetIds: ungradedIds,
    });
  };

  const handleConfirmBatchMarkUngraded = () => {
    if (!pendingBatchAction) return;
    setDraftUndoStack((prev) => [...prev.slice(-15), { ...draftMarks }]);
    setDraftMarks((prev) => {
      const next = { ...prev };
      pendingBatchAction.targetIds.forEach((id) => {
        next[id] = pendingBatchAction.targetMark;
      });
      return next;
    });
    setPendingBatchAction(null);
  };

  const handleUndoGradingStep = () => {
    if (draftUndoStack.length === 0) return;
    const previous = draftUndoStack[draftUndoStack.length - 1];
    setDraftMarks(previous);
    setDraftUndoStack((prev) => prev.slice(0, -1));
  };

  const handleResetAllDraftToUngraded = () => {
    setDraftUndoStack((prev) => [...prev.slice(-15), { ...draftMarks }]);
    const next: Record<string, C02StudentMark> = {};
    setupParticipants.forEach((p) => {
      if (p.isAbsent) return;
      next[p.participantId] = eligibleSetForCurrentQuestion.has(p.participantId)
        ? 'UNGRADED'
        : 'NOT_IN_ROUND';
    });
    setDraftMarks(next);
  };

  // Preview statistics for current draftMarks
  const gradingPreviewStats = useMemo(() => {
    let ungraded = 0;
    let correct = 0;
    let wrong = 0;
    let noAnswer = 0;

    eligibleIdsForCurrentQuestion.forEach((id) => {
      const m = draftMarks[id] || 'UNGRADED';
      if (m === 'UNGRADED') ungraded += 1;
      else if (m === 'CORRECT') correct += 1;
      else if (m === 'WRONG') wrong += 1;
      else if (m === 'NO_ANSWER') noAnswer += 1;
    });

    const continuingAfterQuestion =
      playMode === 'PRACTICE_NO_ELIMINATION'
        ? eligibleIdsForCurrentQuestion.length
        : correct;

    const newlySidelinedCount =
      playMode === 'CONQUEST_ELIMINATION' ? wrong + noAnswer : 0;

    return {
      totalEligible: eligibleIdsForCurrentQuestion.length,
      ungraded,
      correct,
      wrong,
      noAnswer,
      continuingAfterQuestion,
      newlySidelinedCount,
    };
  }, [eligibleIdsForCurrentQuestion, draftMarks, playMode]);

  // Confirm current question results (Section 7 step 10-11 & Section 11 edit support)
  const handleConfirmQuestionResults = () => {
    if (isConfirmLockRef.current) return;
    if (gradingPreviewStats.ungraded > 0) return; // Must grade all eligible students first
    if (!currentQuestion) return;

    isConfirmLockRef.current = true;
    window.setTimeout(() => {
      isConfirmLockRef.current = false;
    }, 350);

    const existingRecord = questionRecords.find(
      (r) => r.questionIndex === currentQuestionIndex
    );

    const finalizedMarks: Record<string, C02StudentMark> = {};
    setupParticipants.forEach((p) => {
      if (p.isAbsent) return;
      if (!eligibleSetForCurrentQuestion.has(p.participantId)) {
        finalizedMarks[p.participantId] = 'NOT_IN_ROUND';
      } else {
        finalizedMarks[p.participantId] = draftMarks[p.participantId] || 'NO_ANSWER';
      }
    });

    const newRecord: C02QuestionRecord = {
      questionIndex: currentQuestionIndex,
      questionNumber: currentQuestionIndex + 1,
      questionId: currentQuestion.questionId,
      eligibleParticipantIds: [...eligibleIdsForCurrentQuestion],
      marks: finalizedMarks,
      confirmedAt: existingRecord ? existingRecord.confirmedAt : Date.now(),
      editCount: existingRecord ? existingRecord.editCount + 1 : 0,
      lastEditedAt: existingRecord ? Date.now() : undefined,
      modeAtQuestion: playMode,
    };

    setQuestionRecords((prev) => {
      const filtered = prev.filter((r) => r.questionIndex !== currentQuestionIndex);
      return [...filtered, newRecord].sort((a, b) => a.questionIndex - b.questionIndex);
    });

    setIsEditingConfirmedQuestion(false);
    setStagePhase('CONFIRMED');
    soundRef.current.playConfirmRound();
  };

  // Re-open confirmed question for editing BEFORE moving to next question (Section 11)
  const handleEditJustConfirmedQuestion = () => {
    if (stagePhase !== 'CONFIRMED') return;
    const rec = questionRecords.find((r) => r.questionIndex === currentQuestionIndex);
    if (!rec) return;
    // Remove any rescue event that was triggered right after this question so teacher can re-confirm cleanly
    setRescueEvents((prev) =>
      prev.filter((ev) => ev.afterQuestionNumber !== currentQuestionIndex + 1)
    );
    setDraftMarks({ ...rec.marks });
    setDraftUndoStack([]);
    setIsEditingConfirmedQuestion(true);
    setStagePhase('GRADING');
    setLayoutView('GRADING_WORKSPACE');
  };

  // Controlled Rollback to an earlier question (Section 11)
  const handleConfirmControlledRollback = () => {
    const targetIdx = rollbackTargetQuestionNumber - 1;
    if (targetIdx < 0 || targetIdx >= questionRecords.length) {
      setShowRollbackModal(false);
      return;
    }
    const targetRec = questionRecords.find((r) => r.questionIndex === targetIdx);
    // Keep only records strictly up to targetIdx, and load targetIdx in CONFIRMED state
    setQuestionRecords((prev) => prev.filter((r) => r.questionIndex <= targetIdx));
    setRescueEvents((prev) =>
      prev.filter((ev) => ev.afterQuestionNumber <= rollbackTargetQuestionNumber)
    );
    if (targetRec) {
      setDraftMarks({ ...targetRec.marks });
    }
    setCurrentQuestionIndex(targetIdx);
    setStagePhase('CONFIRMED');
    setShowRollbackModal(false);
  };

  // ============================================================================
  // RESCUE HANDLERS (SECTION 9)
  // ============================================================================

  const sidelinedParticipantsAfterCurrentQuestion = useMemo(() => {
    return currentLedger.filter((item) => item.status === 'SIDELINED');
  }, [currentLedger]);

  const activeParticipantsAfterCurrentQuestion = useMemo(() => {
    return currentLedger.filter((item) => item.status === 'ACTIVE');
  }, [currentLedger]);

  const canUseRescueNow = useMemo(() => {
    return (
      playMode === 'CONQUEST_ELIMINATION' &&
      rescueEnabled &&
      stagePhase === 'CONFIRMED' &&
      rescueEvents.length < maxRescueCount &&
      currentQuestionIndex < questionPool.length - 1
    );
  }, [
    playMode,
    rescueEnabled,
    stagePhase,
    rescueEvents.length,
    maxRescueCount,
    currentQuestionIndex,
    questionPool.length,
  ]);

  const handleOpenRescueModal = () => {
    if (stagePhase !== 'CONFIRMED' || playMode !== 'CONQUEST_ELIMINATION') return;
    if (sidelinedParticipantsAfterCurrentQuestion.length === 0) {
      // Do not consume rescue right if no eligible sidelined students
      return;
    }
    setSelectedRescueIds(
      new Set(sidelinedParticipantsAfterCurrentQuestion.map((s) => s.participant.participantId))
    );
    setShowRescueModal(true);
  };

  const handleToggleRescueStudent = (participantId: string) => {
    setSelectedRescueIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  };

  const handleConfirmRescue = () => {
    const chosenIds = Array.from(selectedRescueIds);
    if (chosenIds.length === 0) return;

    const newRescueEvent: C02RescueEvent = {
      rescueId: `rescue_${Date.now()}`,
      afterQuestionNumber: currentQuestionIndex + 1,
      rescuedParticipantIds: chosenIds,
      timestamp: Date.now(),
    };

    setRescueEvents((prev) => [...prev, newRescueEvent]);
    setShowRescueModal(false);
    soundRef.current.playRescueChime();
    speakVietnameseText(`Cứu trợ thành công! ${chosenIds.length} học sinh đã quay trở lại sàn thi đấu từ câu tiếp theo.`);
  };

  // Switch from Conquest to Practice mid-session when 0 active players remain (Section 5B)
  const handleSwitchToPracticeModeMidSession = () => {
    setPlayMode('PRACTICE_NO_ELIMINATION');
    setSwitchedModeMidSession(true);
    setSwitchedAtQuestionNumber(currentQuestionIndex + 1);
  };

  // Finish session and evaluate Golden Bell achievement
  const finalizeSession = useCallback(
    (reason: C02EndReason) => {
      stopCountdownTimer();
      voiceRef.current.cancel();
      setEndReason(reason);
      setStagePhase('FINISHED');
      clearC02PersistedSession();

      // Compute final ledger to see if anyone genuinely conquered the Golden Bell
      const finalComputed = computeParticipantsLedger({
        participants: setupParticipants,
        questionRecords,
        rescueEvents,
        currentPlayMode: playMode,
        initialPlayMode,
        switchedModeMidSession,
        totalPlannedQuestions: questionPool.length,
        isSessionFinished: true,
      });

      const bellConquerors = finalComputed.filter((item) => item.conqueredGoldenBell);
      if (bellConquerors.length > 0) {
        setIsBellRinging(true);
        soundRef.current.playGoldenBellToll();
        const names = bellConquerors.map((c) => c.participant.fullName).join(', ');
        speakVietnameseText(
          `Chúc mừng ${names} đã xuất sắc chinh phục Chuông Vàng Tri Thức Tây Đô Smart EDU!`
        );
      } else {
        setIsBellRinging(false);
        soundRef.current.playConfirmRound();
        speakVietnameseText('Phiên thi đấu Rung chuông vàng đã hoàn tất. Hãy cùng xem bảng tổng kết thành tích của lớp!');
      }
    },
    [
      stopCountdownTimer,
      setupParticipants,
      questionRecords,
      rescueEvents,
      playMode,
      initialPlayMode,
      switchedModeMidSession,
      questionPool.length,
      speakVietnameseText,
    ]
  );

  // Move to next question
  const handleAdvanceToNextQuestion = () => {
    if (stagePhase !== 'CONFIRMED') return;

    const isLastQuestion = currentQuestionIndex >= questionPool.length - 1;
    if (isLastQuestion) {
      finalizeSession('ALL_QUESTIONS_COMPLETED');
      return;
    }

    // In CONQUEST_ELIMINATION mode, check if 0 active players remain
    if (
      playMode === 'CONQUEST_ELIMINATION' &&
      activeParticipantsAfterCurrentQuestion.length === 0
    ) {
      // Blocked from auto-advancing; teacher chooses Rescue, Switch to Practice, or End
      return;
    }

    const nextIdx = currentQuestionIndex + 1;
    const nextQuestion = questionPool[nextIdx];

    // Determine who is eligible at the start of nextIdx
    const nextEligibleIds =
      playMode === 'PRACTICE_NO_ELIMINATION'
        ? setupParticipants.filter((p) => !p.isAbsent).map((p) => p.participantId)
        : activeParticipantsAfterCurrentQuestion.map((item) => item.participant.participantId);

    setCurrentQuestionIndex(nextIdx);
    initDraftMarksForQuestion(nextEligibleIds);
    setLayoutView('PRESENTATION');

    activeStepTokenRef.current += 1;
    const token = activeStepTokenRef.current;
    const initialMs = timeLimitSeconds * 1000;
    setRemainingMs(initialMs);

    soundRef.current.playStartQuestion();
    if (nextQuestion) {
      speakVietnameseText(`Câu hỏi số ${nextIdx + 1}: ${nextQuestion.stem}`);
    }

    if (autoStartTimer || timeLimitSeconds === 0) {
      setStagePhase('ANSWERING');
      if (timeLimitSeconds > 0) {
        startCountdownTimer(initialMs, token);
      }
    } else {
      setStagePhase('QUESTION_READY');
    }
  };

  // Pause / Resume handlers (Section 12)
  const handleTogglePause = () => {
    if (stagePhase === 'SETUP' || stagePhase === 'FINISHED') return;
    if (!isPaused) {
      if (stagePhase === 'ANSWERING' && deadlineRef.current) {
        const left = Math.max(0, deadlineRef.current - Date.now());
        setRemainingMs(left);
      }
      stopCountdownTimer();
      voiceRef.current.cancel();
      setIsPaused(true);
    } else {
      setIsPaused(false);
      if (stagePhase === 'ANSWERING' && timeLimitSeconds > 0 && remainingMs > 0) {
        activeStepTokenRef.current += 1;
        startCountdownTimer(remainingMs, activeStepTokenRef.current);
      }
    }
  };

  // Filtered students for Fast Grading Grid & Podium Strip (Section 8)
  const filteredStudentRows = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return currentLedger
      .filter((item) => !item.participant.isAbsent)
      .filter((item) => {
        const id = item.participant.participantId;
        const mark = draftMarks[id] || 'UNGRADED';
        const isEligibleThisRound = eligibleSetForCurrentQuestion.has(id);

        if (studentFilter === 'ACTIVE' && item.status !== 'ACTIVE') return false;
        if (studentFilter === 'SIDELINED' && item.status !== 'SIDELINED') return false;
        if (
          studentFilter === 'UNGRADED' &&
          (!isEligibleThisRound || mark !== 'UNGRADED')
        ) {
          return false;
        }
        if (
          studentFilter === 'CORRECT' &&
          (!isEligibleThisRound || mark !== 'CORRECT')
        ) {
          return false;
        }
        if (
          studentFilter === 'WRONG_OR_NO_ANSWER' &&
          (!isEligibleThisRound || (mark !== 'WRONG' && mark !== 'NO_ANSWER'))
        ) {
          return false;
        }

        if (!q) return true;
        const sttStr = String(item.participant.stt).padStart(2, '0');
        return (
          item.participant.fullName.toLowerCase().includes(q) ||
          sttStr.includes(q) ||
          String(item.participant.stt) === q
        );
      });
  }, [currentLedger, draftMarks, eligibleSetForCurrentQuestion, studentFilter, studentSearch]);

  // Overall class counts for top header bar
  const liveHeaderCounts = useMemo(() => {
    const present = currentLedger.filter((i) => !i.participant.isAbsent);
    const active = present.filter((i) => i.status === 'ACTIVE').length;
    const sidelined = present.filter((i) => i.status === 'SIDELINED').length;
    const ungraded = gradingPreviewStats.ungraded;
    return {
      totalPresent: present.length,
      active,
      sidelined,
      ungraded,
    };
  }, [currentLedger, gradingPreviewStats.ungraded]);

  // ============================================================================
  // RENDER: 1. SETUP SCREEN (SECTION 6)
  // ============================================================================

  if (stagePhase === 'SETUP') {
    const presentCount = setupParticipants.filter((p) => !p.isAbsent).length;

    return (
      <div className="w-full rounded-3xl bg-gradient-to-b from-[#071126] via-[#0D1E3A] to-[#09152B] text-white border border-sky-400/25 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-4 bg-slate-950/70 border-b border-sky-400/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onCloseGame && (
              <button
                type="button"
                onClick={onCloseGame}
                className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Quay lại Thư viện</span>
              </button>
            )}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                C02 · RUNG CHUÔNG VÀNG 3D · NHÓM C: CỦNG CỐ KIẾN THỨC
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                QUẢNG TRƯỜNG TRI THỨC – CHINH PHỤC CHUÔNG VÀNG
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
              <span>{isMuted ? 'Đang tắt âm' : 'Âm thanh: Bật'}</span>
            </button>
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Saved Session Recovery Banner */}
        {savedSessionToRestore && (
          <div className="mx-5 mt-4 p-4 rounded-2xl bg-amber-500/15 border border-amber-400/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-amber-300 shrink-0" />
              <div>
                <div className="text-sm font-extrabold text-amber-200">
                  Phát hiện phiên chơi C02 đang dở (Câu {savedSessionToRestore.currentQuestionIndex + 1}/{savedSessionToRestore.questionPool.length})
                </div>
                <div className="text-xs text-slate-300">
                  Chế độ: {savedSessionToRestore.playMode === 'PRACTICE_NO_ELIMINATION' ? 'Luyện tập không loại' : 'Chinh phục có loại'} · Đã chấm {savedSessionToRestore.questionRecords.length} câu
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreSavedSession}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Tiếp tục phiên đang dở
              </button>
              <button
                type="button"
                onClick={handleDiscardSavedSession}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Bắt đầu phiên mới
              </button>
            </div>
          </div>
        )}

        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: 3D Golden Bell Preview + Game Mode & Rules Config */}
          <div className="lg:col-span-7 space-y-5">
            {/* Hero Stage Preview Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0F244A] via-[#132C5C] to-[#0B1936] border border-amber-400/30 flex flex-col sm:flex-row items-center gap-5">
              <GoldenBell3DSculpture
                isRinging={false}
                progressRatio={0.75}
                reducedMotion={reducedMotion}
                size="compact"
              />
              <div className="space-y-2 text-center sm:text-left">
                <div className="text-xs font-bold text-cyan-300">
                  SÂN KHẤU 3D · LỚP 1–50 HỌC SINH · TRÌNH CHIẾU TRÊN MỘT MÁY
                </div>
                <h3 className="text-xl font-black text-amber-300">
                  Chinh Phục Chuông Vàng Tri Thức
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Giáo viên trình chiếu câu hỏi trên màn hình chính; học sinh giơ bảng con hoặc thẻ đáp án; giáo viên ghi nhận kết quả nhanh cho cả lớp và giải thích kiến thức sau mỗi câu.
                </p>
              </div>
            </div>

            {/* 1. Chế độ chơi (Section 5) */}
            <div className="p-5 rounded-2xl bg-slate-900/75 border border-slate-700/80 space-y-3">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                1. Chọn chế độ chơi
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPlayMode('PRACTICE_NO_ELIMINATION')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    playMode === 'PRACTICE_NO_ELIMINATION'
                      ? 'bg-sky-500/20 border-cyan-400 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">
                      A. Luyện tập không loại (Mặc định)
                    </span>
                    {playMode === 'PRACTICE_NO_ELIMINATION' && (
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                    Tất cả học sinh chơi hết bộ câu hỏi. Đúng +10đ, sai/không trả lời 0đ (không loại khỏi sàn). Trả lời đúng 100% số câu sẽ Chinh phục Chuông Vàng.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPlayMode('CONQUEST_ELIMINATION')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    playMode === 'CONQUEST_ELIMINATION'
                      ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-amber-300">
                      B. Chinh phục có loại & Cứu trợ
                    </span>
                    {playMode === 'CONQUEST_ELIMINATION' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                    Trả lời sai chuyển sang “Tạm rời sàn” (vẫn học cùng lớp). Có quyền Cứu trợ. Vượt qua câu cuối khi vẫn đang thi để Rung Chuông Vàng.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Bộ câu hỏi & Cấu hình câu (Section 6 & 16) */}
            <div className="p-5 rounded-2xl bg-slate-900/75 border border-slate-700/80 space-y-4">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                2. Bộ câu hỏi & Thời gian
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDatasetKey('SAMPLE_MATH')}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${
                    datasetKey === 'SAMPLE_MATH'
                      ? 'bg-blue-600/25 border-cyan-400 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-black">Bộ Toán THCS (20 câu)</div>
                  <div className="text-[11px] text-amber-300 mt-0.5">Dữ liệu mẫu · Lớp 6–9</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDatasetKey('SAMPLE_INFORMATICS')}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${
                    datasetKey === 'SAMPLE_INFORMATICS'
                      ? 'bg-blue-600/25 border-cyan-400 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-black">Bộ Tin học THCS (20 câu)</div>
                  <div className="text-[11px] text-amber-300 mt-0.5">Dữ liệu mẫu · Lớp 6–9</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDatasetKey('QUESTION_BANK');
                    if (validBankQuestions.length >= 5 && validBankQuestions.length < questionCount) {
                      const allowed: C02QuestionCount[] = [5, 10, 15, 20];
                      const fit = allowed.filter((c) => c <= validBankQuestions.length).pop() || 5;
                      setQuestionCount(fit);
                    }
                  }}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${
                    datasetKey === 'QUESTION_BANK'
                      ? 'bg-blue-600/25 border-cyan-400 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-black">Ngân hàng câu hỏi</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Khả dụng: {validBankQuestions.length} câu
                  </div>
                </button>
              </div>

              {datasetKey === 'QUESTION_BANK' && validBankQuestions.length < questionCount && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 flex items-center justify-between gap-2">
                  <span>
                    Ngân hàng hiện có <strong>{validBankQuestions.length}</strong> câu hợp lệ (đang chọn {questionCount} câu). Hệ thống không tự lặp câu.
                  </span>
                  {validBankQuestions.length >= 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allowed: C02QuestionCount[] = [5, 10, 15, 20];
                        const fit = allowed.filter((c) => c <= validBankQuestions.length).pop() || 5;
                        setQuestionCount(fit);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold shrink-0 cursor-pointer"
                    >
                      Giảm còn {[5, 10, 15, 20].filter((c) => c <= validBankQuestions.length).pop() || 5} câu
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">Số lượng câu hỏi:</div>
                  <div className="flex items-center gap-2">
                    {([5, 10, 15, 20] as C02QuestionCount[]).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black border cursor-pointer ${
                          questionCount === cnt
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                            : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {cnt} câu
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">Thời gian mỗi câu:</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {([0, 15, 30, 45, 60] as C02QuestionTimeLimit[]).map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setTimeLimitSeconds(sec)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-black border cursor-pointer ${
                          timeLimitSeconds === sec
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {sec === 0 ? 'Không giới hạn' : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Additional Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {playMode === 'CONQUEST_ELIMINATION' && (
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                    <span className="text-xs font-bold text-slate-200">
                      Cho phép Cứu trợ (1 lần/phiên)
                    </span>
                    <input
                      type="checkbox"
                      checked={rescueEnabled}
                      onChange={(e) => setRescueEnabled(e.target.checked)}
                      className="w-4 h-4 accent-amber-400"
                    />
                  </label>
                )}

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">
                    Tự bắt đầu tính giờ khi mở câu
                  </span>
                  <input
                    type="checkbox"
                    checked={autoStartTimer}
                    onChange={(e) => setAutoStartTimer(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">
                    Giọng đọc câu hỏi tiếng Việt
                  </span>
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">
                    Chế độ nhẹ / Giảm chuyển động
                  </span>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Student Roster Setup (1–50 Students, Attendance, Disambiguation) */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/75 border border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                3. Danh sách học sinh tham gia (1–50 HS)
              </label>
              <span className="text-xs font-bold text-amber-300">
                Có mặt: {presentCount}/{setupParticipants.length}
              </span>
            </div>

            {/* Roster Source Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRosterInputMode('SAMPLE_LIST');
                  handleApplySampleRoster(sampleStudentCount);
                }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold cursor-pointer ${
                  rosterInputMode === 'SAMPLE_LIST'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Danh sách mẫu
              </button>
              <button
                type="button"
                onClick={() => {
                  setRosterInputMode('QUICK_TEXT');
                }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold cursor-pointer ${
                  rosterInputMode === 'QUICK_TEXT'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Nhập nhanh / Nhãn tạm
              </button>
              <button
                type="button"
                onClick={() => {
                  setRosterInputMode('CLASS_LIST');
                  handleSyncFromClassCandidates();
                }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold cursor-pointer ${
                  rosterInputMode === 'CLASS_LIST'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Chọn lớp ({resolvedClassName})
              </button>
            </div>

            {/* Source Specific Controls */}
            {rosterInputMode === 'SAMPLE_LIST' && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Tạo danh sách thử nghiệm (Dữ liệu mẫu):</span>
                  <span className="text-amber-300 font-bold">Không lưu vào lớp thật</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[1, 2, 10, 20, 30, 50].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleApplySampleRoster(cnt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        sampleStudentCount === cnt && setupParticipants.length === cnt
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {cnt} HS
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rosterInputMode === 'QUICK_TEXT' && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <textarea
                  rows={4}
                  value={quickTextNames}
                  onChange={(e) => setQuickTextNames(e.target.value)}
                  placeholder="Nhập mỗi dòng 1 tên học sinh (tối đa 50 dòng). Nếu để trống, hệ thống sẽ tạo nhãn tạm 'Học sinh 01...' (không lưu thành hồ sơ thật)."
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span>Số nhãn tạm nếu để trống:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={autoLabelCount}
                      onChange={(e) => setAutoLabelCount(Number(e.target.value) || 10)}
                      className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-center text-xs font-bold text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyQuickTextRoster}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    Áp dụng danh sách
                  </button>
                </div>
              </div>
            )}

            {rosterInputMode === 'CLASS_LIST' && classes.length > 0 && onSelectSourceKey && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-300 font-bold">Đổi lớp học:</span>
                <select
                  value={selectedSourceKey}
                  onChange={(e) => {
                    onSelectSourceKey(e.target.value);
                    window.setTimeout(handleSyncFromClassCandidates, 50);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-bold"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.students?.length || 0} HS)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Duplicate Name Notice */}
            {duplicateNamesSet.size > 0 && (
              <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-400/40 text-[11px] text-sky-200">
                Phát hiện học sinh trùng họ tên: Hệ thống dùng mã định danh riêng và hiển thị rõ <strong>#Số thứ tự</strong> để phân biệt chính xác từng học sinh.
              </div>
            )}

            {/* Participant List with Pre-Session Attendance Toggle */}
            <div className="max-h-60 overflow-y-auto pr-1 space-y-1.5">
              {setupParticipants.map((p) => {
                const isDupe = duplicateNamesSet.has(p.fullName.trim().toLowerCase());
                return (
                  <div
                    key={p.participantId}
                    className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      p.isAbsent
                        ? 'bg-slate-950/40 border-slate-800/70 opacity-60'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono font-bold shrink-0">
                        #{String(p.stt).padStart(2, '0')}
                      </span>
                      <span className="font-bold text-white truncate">{p.fullName}</span>
                      {isDupe && (
                        <span className="text-[11px] text-cyan-300 shrink-0">
                          (Mã #{p.code})
                        </span>
                      )}
                      {p.isTemporaryLabel && (
                        <span className="text-[10px] text-slate-400 shrink-0">· Nhãn tạm</span>
                      )}
                      {p.isSampleStudent && (
                        <span className="text-[10px] text-amber-300/80 shrink-0">· Mẫu</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleSetupAbsent(p.participantId)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer ${
                        p.isAbsent
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {p.isAbsent ? 'Vắng mặt' : 'Có mặt'}
                    </button>
                  </div>
                );
              })}
            </div>

            {rosterErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <span>{rosterErrorMsg}</span>
              </div>
            )}

            {/* Start Game Button */}
            <button
              type="button"
              onClick={handleStartSession}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              <span>BẮT ĐẦU CHINH PHỤC CHUÔNG VÀNG ({presentCount} HS)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: 2. FINISHED SUMMARY SCREEN (SECTION 17)
  // ============================================================================

  if (stagePhase === 'FINISHED') {
    const presentLedger = currentLedger.filter((i) => !i.participant.isAbsent);
    const bellConquerors = presentLedger.filter((i) => i.conqueredGoldenBell);
    const sortedByRank = [...presentLedger].sort((a, b) => {
      if (b.conqueredGoldenBell !== a.conqueredGoldenBell) {
        return Number(b.conqueredGoldenBell) - Number(a.conqueredGoldenBell);
      }
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.participant.stt - b.participant.stt;
    });

    const endReasonLabel =
      endReason === 'ALL_QUESTIONS_COMPLETED'
        ? `Hoàn thành toàn bộ ${questionRecords.length}/${questionPool.length} câu hỏi`
        : endReason === 'NO_ACTIVE_PLAYERS_ENDED_BY_TEACHER'
        ? `Kết thúc ở câu ${questionRecords.length} do không còn thí sinh đang thi trên sàn`
        : `Giáo viên kết thúc phiên sau ${questionRecords.length}/${questionPool.length} câu hỏi`;

    return (
      <div className="w-full rounded-3xl bg-gradient-to-b from-[#071126] via-[#0D1E3A] to-[#09152B] text-white border border-amber-400/40 shadow-2xl overflow-hidden p-5 sm:p-7 space-y-6">
        {/* Top Summary Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              TỔNG KẾT PHIÊN THI ĐẤU · C02 – RUNG CHUÔNG VÀNG 3D
            </div>
            <h2 className="text-2xl font-black text-white mt-0.5">
              QUẢNG TRƯỜNG TRI THỨC – BẢNG VÀNG VINH DANH
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsBellRinging(false);
                handleStartSession();
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Chơi lại</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBellRinging(false);
                setStagePhase('SETUP');
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Chọn bộ khác / Thiết lập lại</span>
            </button>
            {onCloseGame && (
              <button
                type="button"
                onClick={onCloseGame}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Về thư viện</span>
              </button>
            )}
          </div>
        </div>

        {/* Mode Switched Mid-Session Transparency Banner (Section 5B & 17) */}
        {switchedModeMidSession && (
          <div className="p-4 rounded-2xl bg-sky-500/15 border border-sky-400/50 text-xs text-sky-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-sky-300 shrink-0" />
            <div>
              <strong>Ghi nhận thay đổi chế độ giữa phiên:</strong> Phiên chơi khởi đầu ở chế độ{' '}
              <em>Chinh phục có loại</em> và đã được giáo viên chuyển sang{' '}
              <em>Luyện tập không loại</em> từ sau câu {switchedAtQuestionNumber} để cả lớp tiếp tục ôn tập. Kết quả được tổng kết theo tiêu chí Luyện tập (không tính là một lượt Chinh phục có loại nguyên vẹn).
            </div>
          </div>
        )}

        {/* Golden Bell Hero Podium + Session Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-slate-900/75 border border-amber-400/30 rounded-2xl p-5">
          <div className="lg:col-span-4 flex flex-col items-center">
            <GoldenBell3DSculpture
              isRinging={isBellRinging && bellConquerors.length > 0}
              progressRatio={1}
              reducedMotion={reducedMotion}
              size="large"
              onSkipRinging={() => setIsBellRinging(false)}
            />
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Chế độ:{' '}
                <strong className="text-white">
                  {switchedModeMidSession
                    ? 'Chinh phục → Chuyển sang Luyện tập giữa phiên'
                    : playMode === 'PRACTICE_NO_ELIMINATION'
                    ? 'Luyện tập không loại'
                    : 'Chinh phục có loại'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Số câu đã hoàn thành:{' '}
                <strong className="text-cyan-300">
                  {questionRecords.length}/{questionPool.length} câu
                </strong>
              </span>
              <span>·</span>
              <span>
                Số người tham gia: <strong className="text-white">{presentLedger.length} HS</strong>
              </span>
              <span>·</span>
              <span>
                Nguyên nhân kết thúc: <strong className="text-amber-300">{endReasonLabel}</strong>
              </span>
            </div>

            {bellConquerors.length > 0 ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/15 border border-amber-400/60 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-black text-base">
                  <Trophy className="w-5 h-5" />
                  <span>
                    {bellConquerors.length === 1
                      ? 'QUÁN QUÂN CHINH PHỤC CHUÔNG VÀNG TRI THỨC'
                      : `ĐỒNG CHINH PHỤC CHUÔNG VÀNG (${bellConquerors.length} HỌC SINH)`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bellConquerors.map((c) => (
                    <div
                      key={c.participant.participantId}
                      className="px-3.5 py-2 rounded-xl bg-slate-950/85 border border-amber-300/60 text-sm font-black text-white flex items-center gap-2"
                    >
                      <span className="text-amber-300 font-mono">
                        #{String(c.participant.stt).padStart(2, '0')}
                      </span>
                      <span>{c.participant.fullName}</span>
                      <span className="text-xs font-bold text-cyan-300">
                        · {c.score}đ ({c.correctCount}/{questionRecords.length} câu đúng)
                      </span>
                      {c.wasRescued && (
                        <span className="text-[11px] font-bold text-emerald-300">
                          · Có sử dụng Cứu trợ (sau câu {c.rescuedAfterQuestionNumbers.join(', ')})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-950/75 border border-slate-700 space-y-1.5">
                <div className="text-sm font-black text-cyan-300">
                  Chưa có học sinh đạt điều kiện Rung Chuông Vàng ở lượt này
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hệ thống ghi nhận trung thực thành tích thực tế của từng học sinh mà không tự chọn người thắng giả định. Dưới đây là bảng điểm và số câu trả lời đúng của cả lớp!
                </p>
              </div>
            )}

            {/* Rescue Summary Note */}
            {rescueEvents.length > 0 && (
              <div className="text-xs text-emerald-300">
                Sự kiện Cứu trợ trong phiên: Đã kích hoạt {rescueEvents.length} lần (sau câu{' '}
                {rescueEvents.map((e) => e.afterQuestionNumber).join(', ')}, cứu{' '}
                {rescueEvents.reduce((acc, e) => acc + e.rescuedParticipantIds.length, 0)} học sinh quay lại sàn).
              </div>
            )}
          </div>
        </div>

        {/* Summary Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setSummaryTab('LEADERBOARD')}
            className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer ${
              summaryTab === 'LEADERBOARD'
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            Xem kết quả ({presentLedger.length} HS)
          </button>
          <button
            type="button"
            onClick={() => setSummaryTab('KNOWLEDGE_REVIEW')}
            className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer ${
              summaryTab === 'KNOWLEDGE_REVIEW'
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            Xem lại kiến thức ({questionRecords.length} câu đã chơi)
          </button>
        </div>

        {summaryTab === 'LEADERBOARD' && (
          <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/90">
                  <th className="py-3 px-4">Hạng</th>
                  <th className="py-3 px-4">STT & Họ tên</th>
                  <th className="py-3 px-4">Danh hiệu / Trạng thái cuối</th>
                  <th className="py-3 px-4">Số câu đúng</th>
                  <th className="py-3 px-4">Điểm số</th>
                  <th className="py-3 px-4">Ghi chú Cứu trợ</th>
                </tr>
              </thead>
              <tbody>
                {sortedByRank.map((row, idx) => (
                  <tr
                    key={row.participant.participantId}
                    className="border-b border-slate-800/60 hover:bg-slate-900/50"
                  >
                    <td className="py-2.5 px-4 font-black text-amber-300">#{idx + 1}</td>
                    <td className="py-2.5 px-4 font-bold text-white">
                      <span className="text-slate-400 font-mono mr-2">
                        #{String(row.participant.stt).padStart(2, '0')}
                      </span>
                      {row.participant.fullName}
                    </td>
                    <td className="py-2.5 px-4">
                      {row.conqueredGoldenBell ? (
                        <span className="text-amber-300 font-black">
                          Chinh phục Chuông Vàng
                        </span>
                      ) : row.status === 'ACTIVE' ? (
                        <span className="text-emerald-300 font-bold">Hoàn thành trên sàn</span>
                      ) : (
                        <span className="text-slate-400">
                          Tạm rời sàn ở câu {row.eliminatedAtQuestionNumber || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-cyan-300">
                      {row.correctCount}/{row.questionsParticipated} câu đã tham gia
                    </td>
                    <td className="py-2.5 px-4 font-black text-white">{row.score} điểm</td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {row.wasRescued
                        ? `Được cứu trợ sau câu ${row.rescuedAfterQuestionNumbers.join(', ')}`
                        : 'Không dùng cứu trợ'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {summaryTab === 'KNOWLEDGE_REVIEW' && (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {questionRecords.map((rec) => {
              const q = questionPool[rec.questionIndex];
              if (!q) return null;
              const correctStuCount = Object.values(rec.marks).filter((m) => m === 'CORRECT').length;
              return (
                <div
                  key={rec.questionId}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                    <span>
                      Câu {rec.questionNumber}: {q.topic}
                    </span>
                    <span className="text-cyan-300">
                      Đúng: {correctStuCount}/{rec.eligibleParticipantIds.length} HS tham gia câu này
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">
                    <MathView content={q.stem} />
                  </div>
                  <div className="text-xs text-emerald-300 font-bold">
                    Đáp án đúng: <MathView content={q.correctAnswerText} />
                  </div>
                  <div className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <MathView content={q.explanation} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER: 3. ACTIVE GAMEPLAY STAGE (16:9 PRESENTATION + FAST GRADING WORKSPACE)
  // ============================================================================

  const totalQuestions = questionPool.length;
  const currentQuestionNumber = currentQuestionIndex + 1;
  const progressRatio = totalQuestions > 0 ? currentQuestionNumber / totalQuestions : 0;
  const remainingSecondsDisplay = Math.ceil(remainingMs / 1000);
  const noActivePlayersRemainAfterConfirm =
    stagePhase === 'CONFIRMED' &&
    playMode === 'CONQUEST_ELIMINATION' &&
    activeParticipantsAfterCurrentQuestion.length === 0;

  return (
    <div className="relative w-full rounded-3xl bg-gradient-to-b from-[#060F22] via-[#0B1B38] to-[#081326] text-white border border-sky-400/30 shadow-2xl overflow-hidden select-none">
      {/* 1. TOP CONTROL BAR (Section 13: Quay lại, C02 – Rung chuông vàng, Âm thanh, Toàn màn hình) */}
      <div className="px-4 py-3 bg-slate-950/85 border-b border-sky-400/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              stopCountdownTimer();
              voiceRef.current.cancel();
              setStagePhase('SETUP');
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thiết lập</span>
          </button>

          {onCloseGame && (
            <button
              type="button"
              onClick={() => {
                stopCountdownTimer();
                voiceRef.current.cancel();
                onCloseGame();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 pl-1">
            <span className="text-xs font-black text-amber-300">C02 – Rung chuông vàng</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-300">
              {playMode === 'PRACTICE_NO_ELIMINATION'
                ? 'Luyện tập không loại'
                : 'Chinh phục có loại'}
            </span>
            {currentQuestion?.isSample && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] text-amber-300 font-semibold">Dữ liệu mẫu</span>
              </>
            )}
          </div>
        </div>

        {/* Live Statistics Strip: Câu hiện tại, Đang thi, Tạm rời sàn, Chưa chấm */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-black text-cyan-300">
            Câu {currentQuestionNumber}/{totalQuestions}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-300 font-bold">
            Đang thi: {liveHeaderCounts.active}
          </span>
          {playMode === 'CONQUEST_ELIMINATION' && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-rose-300 font-bold">
                Tạm rời sàn: {liveHeaderCounts.sidelined}
              </span>
            </>
          )}
          <span className="text-slate-600">·</span>
          <span className="text-amber-300 font-bold">
            Chưa chấm: {liveHeaderCounts.ungraded}
          </span>
        </div>

        {/* Right Controls: Layout Switcher, Pause, Audio, Rollback, Fullscreen */}
        <div className="flex items-center gap-1.5">
          {/* Fast Layout Switcher: "Trình chiếu câu hỏi" vs "Chấm kết quả" */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setLayoutView('PRESENTATION')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                layoutView === 'PRESENTATION'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Trình chiếu câu hỏi</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutView('GRADING_WORKSPACE')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                layoutView === 'GRADING_WORKSPACE'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Chấm kết quả ({liveHeaderCounts.totalPresent})</span>
            </button>
          </div>

          {questionRecords.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRollbackTargetQuestionNumber(questionRecords[questionRecords.length - 1].questionNumber);
                setShowRollbackModal(true);
              }}
              title="Quay lại câu trước có kiểm soát"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleTogglePause}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-300" />}
            <span className="hidden sm:inline">{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* 2. GOLDEN BELL PATHWAY PROGRESS BAR */}
      <div className="px-5 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center gap-3">
        <span className="text-[11px] font-bold text-slate-400 shrink-0">
          Đường tới Chuông Vàng:
        </span>
        <div className="flex-1 flex items-center gap-1 overflow-x-auto py-0.5">
          {questionPool.map((q, idx) => {
            const isDone = questionRecords.some((r) => r.questionIndex === idx);
            const isCurrent = idx === currentQuestionIndex;
            const hasRescueAfter = rescueEvents.some((e) => e.afterQuestionNumber === idx + 1);
            return (
              <div key={q.questionId} className="flex items-center gap-1 shrink-0">
                <div
                  className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center border ${
                    isCurrent
                      ? 'bg-amber-400 text-slate-950 border-amber-200 scale-105'
                      : isDone
                      ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  {idx + 1}
                </div>
                {hasRescueAfter && (
                  <span
                    title={`Đã cứu trợ sau câu ${idx + 1}`}
                    className="text-[10px] font-bold text-emerald-300 px-1"
                  >
                    +Cứu
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1 text-amber-300 text-xs font-black shrink-0">
          <Bell className="w-4 h-4" />
          <span>Đích</span>
        </div>
      </div>

      {/* Voice Notice if browser lacks Vietnamese TTS */}
      {voiceNotice && (
        <div className="px-4 py-1.5 bg-amber-500/15 border-b border-amber-400/30 text-[11px] text-amber-200 flex items-center justify-between">
          <span>{voiceNotice}</span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="underline font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 3. MAIN STAGE CONTENT AREA */}
      <div className="p-4 sm:p-6 space-y-5">
        {layoutView === 'PRESENTATION' ? (
          /* ================================================================
             LAYOUT A: QUESTION PRESENTATION STAGE ("Trình chiếu câu hỏi")
             ================================================================ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left/Center 8 cols: Central Question Board + Teacher Phase Controls */}
            <div className="lg:col-span-8 flex flex-col justify-between rounded-2xl bg-gradient-to-b from-[#0E2248] via-[#0B1B3A] to-[#08142C] border-2 border-cyan-400/40 p-5 sm:p-6 shadow-xl space-y-5">
              {/* Question Header & Timer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-cyan-300">
                    CÂU HỎI SỐ {currentQuestionNumber} / {totalQuestions} · {currentQuestion?.topic}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Hình thức:{' '}
                    {currentQuestion?.questionType === 'MULTIPLE_CHOICE'
                      ? 'Trắc nghiệm 4 phương án (A, B, C, D)'
                      : currentQuestion?.questionType === 'TRUE_FALSE'
                      ? 'Đúng / Sai'
                      : 'Trả lời ngắn trên bảng con'}
                    {' · '}
                    Mức độ:{' '}
                    {currentQuestion?.difficulty === 1
                      ? 'Nhận biết'
                      : currentQuestion?.difficulty === 2
                      ? 'Thông hiểu'
                      : 'Vận dụng'}
                  </div>
                </div>

                {/* Countdown Clock Widget */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => voiceRef.current.cancel()}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    Bỏ qua giọng đọc
                  </button>

                  <div
                    className={`px-4 py-2 rounded-2xl border-2 flex items-center gap-2 font-mono font-black text-base ${
                      timeLimitSeconds === 0
                        ? 'bg-slate-900 border-cyan-400/50 text-cyan-300'
                        : stagePhase === 'TIME_UP'
                        ? 'bg-rose-500/25 border-rose-400 text-rose-300'
                        : remainingSecondsDisplay <= 5 && stagePhase === 'ANSWERING'
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 animate-pulse'
                        : 'bg-slate-900 border-amber-400/60 text-amber-300'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>
                      {timeLimitSeconds === 0
                        ? 'Không giới hạn'
                        : stagePhase === 'TIME_UP'
                        ? '00s · HẾT GIỜ'
                        : `${String(remainingSecondsDisplay).padStart(2, '0')}s`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Question Stem & Options */}
              <div className="my-auto space-y-5 py-2">
                <div className="text-lg sm:text-xl md:text-2xl font-black text-white leading-relaxed">
                  {currentQuestion && <MathView content={currentQuestion.stem} />}
                </div>

                {/* Options Grid if Multiple Choice or True/False */}
                {currentDisplayOptions.length > 0 && (
                  <div
                    className={`grid gap-3 ${
                      currentDisplayOptions.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2'
                    }`}
                  >
                    {currentDisplayOptions.map((opt) => {
                      const isCorrectOpt =
                        (stagePhase === 'ANSWER_REVEALED' ||
                          stagePhase === 'GRADING' ||
                          stagePhase === 'CONFIRMED') &&
                        opt.optionId === currentQuestion?.correctOptionId;

                      return (
                        <div
                          key={opt.optionId}
                          className={`p-3.5 sm:p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                            isCorrectOpt
                              ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-lg shadow-emerald-500/15'
                              : 'bg-slate-950/75 border-slate-700/90 text-slate-100'
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                              isCorrectOpt
                                ? 'bg-emerald-400 text-slate-950'
                                : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                            }`}
                          >
                            {opt.displayLabel}
                          </span>
                          <div className="text-sm sm:text-base font-bold flex-1">
                            <MathView content={opt.text} />
                          </div>
                          {isCorrectOpt && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Time Up Notice Banner (Section 7 step 5) */}
                {stagePhase === 'TIME_UP' && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-400/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-sm font-black text-rose-200">
                      <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
                      <span>
                        DỪNG TRẢ LỜI! Học sinh giơ bảng đáp án. (Hết giờ không tự đánh sai cả lớp; giáo viên bấm Công bố đáp án để chấm).
                      </span>
                    </div>
                  </div>
                )}

                {/* Revealed Answer & Educational Explanation Box (Section 7 step 6-7) */}
                {(stagePhase === 'ANSWER_REVEALED' ||
                  stagePhase === 'GRADING' ||
                  stagePhase === 'CONFIRMED') &&
                  currentQuestion && (
                    <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-400/50 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-black text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>
                          ĐÁP ÁN ĐÚNG: <MathView content={currentQuestion.correctAnswerText} />
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        <strong className="text-amber-300">Giải thích kiến thức: </strong>
                        <MathView content={currentQuestion.explanation} />
                      </div>
                    </div>
                  )}
              </div>

              {/* Teacher Step-by-Step Action Bar (Section 7) */}
              <div className="pt-3 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-300 font-bold">
                  {stagePhase === 'QUESTION_READY' &&
                    'Bước 1: Đọc câu hỏi → Bấm "Bắt đầu tính giờ" để học sinh viết bảng con.'}
                  {stagePhase === 'ANSWERING' &&
                    'Bước 2: Học sinh đang trả lời trên bảng con/giấy/thẻ.'}
                  {stagePhase === 'TIME_UP' &&
                    'Bước 3: Đã hết giờ trả lời → Bấm "Công bố đáp án".'}
                  {stagePhase === 'ANSWER_REVEALED' &&
                    'Bước 4: Đã công bố đáp án & giải thích → Chuyển sang "Chấm kết quả" cho học sinh.'}
                  {stagePhase === 'GRADING' &&
                    `Bước 5: Chấm kết quả câu ${currentQuestionNumber} (Còn ${gradingPreviewStats.ungraded} HS chưa chấm).`}
                  {stagePhase === 'CONFIRMED' &&
                    `Đã xác nhận kết quả câu ${currentQuestionNumber}. Sẵn sàng chuyển sang câu tiếp theo!`}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {stagePhase === 'QUESTION_READY' && (
                    <>
                      <button
                        type="button"
                        onClick={handleBeginTimerForCurrentQuestion}
                        className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        <span>Bắt đầu tính giờ</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRevealAnswer}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        Công bố đáp án ngay
                      </button>
                    </>
                  )}

                  {stagePhase === 'ANSWERING' && (
                    <>
                      <button
                        type="button"
                        onClick={handleManualStopAnswering}
                        className="px-4 py-2.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 text-rose-200 border border-rose-400/50 text-xs font-bold cursor-pointer"
                      >
                        Dừng trả lời
                      </button>
                      <button
                        type="button"
                        onClick={handleRevealAnswer}
                        className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black cursor-pointer"
                      >
                        Công bố đáp án
                      </button>
                    </>
                  )}

                  {stagePhase === 'TIME_UP' && (
                    <button
                      type="button"
                      onClick={handleRevealAnswer}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Công bố đáp án</span>
                    </button>
                  )}

                  {(stagePhase === 'ANSWER_REVEALED' || stagePhase === 'GRADING') && (
                    <button
                      type="button"
                      onClick={handleOpenGradingPhase}
                      className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Mở bảng Chấm kết quả ({eligibleIdsForCurrentQuestion.length} HS)</span>
                    </button>
                  )}

                  {stagePhase === 'CONFIRMED' && (
                    <>
                      <button
                        type="button"
                        onClick={handleEditJustConfirmedQuestion}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa kết quả câu vừa rồi</span>
                      </button>

                      {canUseRescueNow && sidelinedParticipantsAfterCurrentQuestion.length > 0 && (
                        <button
                          type="button"
                          onClick={handleOpenRescueModal}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <HeartHandshake className="w-4 h-4" />
                          <span>
                            Kích hoạt Cứu trợ ({sidelinedParticipantsAfterCurrentQuestion.length} HS tạm rời sàn)
                          </span>
                        </button>
                      )}

                      {!noActivePlayersRemainAfterConfirm && (
                        <button
                          type="button"
                          onClick={handleAdvanceToNextQuestion}
                          className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>
                            {currentQuestionIndex >= totalQuestions - 1
                              ? 'Tổng kết & Rung Chuông Vàng'
                              : 'Câu tiếp theo'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right 4 cols: 3D Golden Bell Stage + Live Podium Summary */}
            <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl bg-slate-900/80 border border-amber-400/30 p-5 space-y-4">
              <div className="flex flex-col items-center text-center">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  QUẢNG TRƯỜNG TRI THỨC 3D
                </div>
                <GoldenBell3DSculpture
                  isRinging={false}
                  progressRatio={progressRatio}
                  reducedMotion={reducedMotion}
                  size="compact"
                />
                <div className="text-xs text-slate-300 mt-1">
                  {playMode === 'CONQUEST_ELIMINATION' &&
                  activeParticipantsAfterCurrentQuestion.length === 1 &&
                  currentQuestionIndex < totalQuestions - 1 ? (
                    <span className="text-amber-300 font-bold">
                      Còn 1 thí sinh trên sàn! Thí sinh vẫn phải tiếp tục vượt qua các câu còn lại để Chinh phục Chuông Vàng.
                    </span>
                  ) : (
                    <span>
                      Đang trên sàn: <strong className="text-emerald-300">{liveHeaderCounts.active}</strong> / {liveHeaderCounts.totalPresent} học sinh
                    </span>
                  )}
                </div>
              </div>

              {/* Zero Active Players Decision Box (Section 5B) */}
              {noActivePlayersRemainAfterConfirm && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-400/50 space-y-3">
                  <div className="text-xs font-black text-rose-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                    <span>Không còn học sinh nào đang thi trên sàn!</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Hệ thống đã dừng chuyển câu tự động. Giáo viên vui lòng chọn 1 trong 3 phương án xử lý:
                  </p>
                  <div className="space-y-2">
                    {canUseRescueNow && sidelinedParticipantsAfterCurrentQuestion.length > 0 && (
                      <button
                        type="button"
                        onClick={handleOpenRescueModal}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        <span>1. Dùng quyền Cứu trợ để đưa HS trở lại</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSwitchToPracticeModeMidSession}
                      className="w-full py-2 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>2. Chuyển sang Luyện tập không loại (chơi tiếp)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => finalizeSession('NO_ACTIVE_PLAYERS_ENDED_BY_TEACHER')}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                    >
                      <span>3. Kết thúc lượt và xem Tổng kết</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Preview of Numbered Student Podiums */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">
                    Bục thí sinh ({liveHeaderCounts.totalPresent} HS)
                  </span>
                  <button
                    type="button"
                    onClick={() => setLayoutView('GRADING_WORKSPACE')}
                    className="text-cyan-300 hover:underline font-bold cursor-pointer"
                  >
                    Mở rộng chấm nhanh →
                  </button>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {currentLedger
                    .filter((i) => !i.participant.isAbsent)
                    .map((item) => {
                      const mark = draftMarks[item.participant.participantId] || 'UNGRADED';
                      const isSidelined = item.status === 'SIDELINED';
                      return (
                        <div
                          key={item.participant.participantId}
                          title={`#${item.participant.stt} ${item.participant.fullName} · ${item.score}đ`}
                          className={`p-1.5 rounded-lg border text-center transition-all ${
                            isSidelined
                              ? 'bg-slate-950/40 border-slate-800 text-slate-500'
                              : mark === 'CORRECT'
                              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                              : mark === 'WRONG' || mark === 'NO_ANSWER'
                              ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                              : 'bg-slate-950/80 border-sky-400/30 text-white'
                          }`}
                        >
                          <div className="text-[10px] font-mono font-black">
                            #{String(item.participant.stt).padStart(2, '0')}
                          </div>
                          <div className="text-[10px] truncate font-semibold">
                            {item.participant.fullName.split(' ').pop()}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================
             LAYOUT B: FAST GRADING WORKSPACE FOR 1–50 STUDENTS (Section 8)
             ================================================================ */
          <div className="space-y-4">
            {/* Shared Screen Transparency Notice + Compact Question Reminder */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-400/30 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 max-w-3xl">
                <div className="text-xs font-bold text-amber-300">
                  BẢNG CHẤM NHANH CÂU {currentQuestionNumber}/{totalQuestions} · Đáp án đúng:{' '}
                  <span className="text-emerald-300">
                    {stagePhase === 'ANSWER_REVEALED' ||
                    stagePhase === 'GRADING' ||
                    stagePhase === 'CONFIRMED' ? (
                      <MathView content={currentQuestion?.correctAnswerText || ''} />
                    ) : (
                      '(Chưa công bố)'
                    )}
                  </span>
                </div>
                <div className="text-sm font-bold text-white">
                  {currentQuestion && <MathView content={currentQuestion.stem} />}
                </div>
                <div className="text-[11px] text-slate-400">
                  Lưu ý trình chiếu một màn hình: Mọi thao tác trên bảng chấm hiện đang hiển thị trực tiếp trên màn hình chung của lớp.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLayoutView('PRESENTATION')}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-slate-700 cursor-pointer"
              >
                ← Quay lại Trình chiếu câu hỏi
              </button>
            </div>

            {/* Batch Grading Actions & Live Preview Bar (Section 8) */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={stagePhase === 'CONFIRMED'}
                    onClick={handleBatchMarkAllEligibleCorrect}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-200 border border-emerald-400/50 text-xs font-black cursor-pointer"
                  >
                    Đánh dấu tất cả đang thi là ĐÚNG ({eligibleIdsForCurrentQuestion.length} HS)
                  </button>

                  <button
                    type="button"
                    disabled={stagePhase === 'CONFIRMED' || gradingPreviewStats.ungraded === 0}
                    onClick={() => handleRequestBatchMarkUngraded('NO_ANSWER')}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-200 border border-amber-400/50 text-xs font-bold cursor-pointer"
                  >
                    Đánh dấu {gradingPreviewStats.ungraded} người chưa chấm là KHÔNG TRẢ LỜI
                  </button>

                  <button
                    type="button"
                    disabled={stagePhase === 'CONFIRMED' || gradingPreviewStats.ungraded === 0}
                    onClick={() => handleRequestBatchMarkUngraded('WRONG')}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-200 border border-rose-400/50 text-xs font-bold cursor-pointer"
                  >
                    Đánh dấu {gradingPreviewStats.ungraded} người chưa chấm là SAI
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={stagePhase === 'CONFIRMED' || draftUndoStack.length === 0}
                    onClick={handleUndoGradingStep}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Hoàn tác ({draftUndoStack.length})</span>
                  </button>
                  <button
                    type="button"
                    disabled={stagePhase === 'CONFIRMED'}
                    onClick={handleResetAllDraftToUngraded}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Đặt lại Chưa chấm
                  </button>
                </div>
              </div>

              {/* Live Preview Before Confirming (Section 7 step 9-10) */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-slate-400">Xem trước kết quả câu {currentQuestionNumber}:</span>
                  <span className="text-emerald-300 font-black">
                    Đúng: {gradingPreviewStats.correct}
                  </span>
                  <span>·</span>
                  <span className="text-rose-300 font-black">
                    Sai: {gradingPreviewStats.wrong}
                  </span>
                  <span>·</span>
                  <span className="text-amber-300 font-black">
                    Không trả lời: {gradingPreviewStats.noAnswer}
                  </span>
                  <span>·</span>
                  <span className="text-cyan-300 font-black">
                    Tiếp tục sau câu này: {gradingPreviewStats.continuingAfterQuestion} HS
                  </span>
                  {gradingPreviewStats.ungraded > 0 && (
                    <span className="text-rose-300 font-bold">
                      (Còn {gradingPreviewStats.ungraded} HS cần chấm trước khi xác nhận)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {stagePhase !== 'CONFIRMED' ? (
                    <button
                      type="button"
                      disabled={gradingPreviewStats.ungraded > 0}
                      onClick={handleConfirmQuestionResults}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isEditingConfirmedQuestion
                          ? 'Cập nhật lại kết quả câu'
                          : 'Xác nhận kết quả câu'}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleEditJustConfirmedQuestion}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa kết quả câu vừa rồi</span>
                      </button>
                      {!noActivePlayersRemainAfterConfirm && (
                        <button
                          type="button"
                          onClick={handleAdvanceToNextQuestion}
                          className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>
                            {currentQuestionIndex >= totalQuestions - 1
                              ? 'Tổng kết phiên'
                              : 'Sang câu tiếp theo'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filters & Search Bar (Section 8) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'ALL', label: `Tất cả (${liveHeaderCounts.totalPresent})` },
                    { key: 'ACTIVE', label: `Đang thi (${liveHeaderCounts.active})` },
                    { key: 'UNGRADED', label: `Chưa chấm (${gradingPreviewStats.ungraded})` },
                    { key: 'CORRECT', label: `Đúng (${gradingPreviewStats.correct})` },
                    {
                      key: 'WRONG_OR_NO_ANSWER',
                      label: `Sai / Không TL (${gradingPreviewStats.wrong + gradingPreviewStats.noAnswer})`,
                    },
                    ...(playMode === 'CONQUEST_ELIMINATION'
                      ? [{ key: 'SIDELINED', label: `Tạm rời sàn (${liveHeaderCounts.sidelined})` }]
                      : []),
                  ] as { key: C02StudentFilter; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStudentFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      studentFilter === tab.key
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Tìm theo tên hoặc số thứ tự..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* 50-Student Grading Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredStudentRows.map((item) => {
                const p = item.participant;
                const isEligible = eligibleSetForCurrentQuestion.has(p.participantId);
                const mark = draftMarks[p.participantId] || 'UNGRADED';

                return (
                  <div
                    key={p.participantId}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 ${
                      !isEligible
                        ? 'bg-slate-950/40 border-slate-800/80 opacity-65'
                        : mark === 'CORRECT'
                        ? 'bg-emerald-950/40 border-emerald-400/60'
                        : mark === 'WRONG'
                        ? 'bg-rose-950/40 border-rose-400/60'
                        : mark === 'NO_ANSWER'
                        ? 'bg-amber-950/35 border-amber-400/50'
                        : 'bg-slate-900/90 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-mono font-black text-xs shrink-0">
                          #{String(p.stt).padStart(2, '0')}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-white truncate">
                          {p.fullName}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-cyan-300 shrink-0">
                        {item.score}đ · {item.correctCount} đúng
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-300">
                        Trạng thái:{' '}
                        <strong
                          className={
                            item.status === 'ACTIVE' ? 'text-emerald-300' : 'text-rose-300'
                          }
                        >
                          {item.status === 'ACTIVE' ? 'Đang thi' : 'Tạm rời sàn'}
                        </strong>
                        {item.wasRescued && ' (Đã cứu trợ)'}
                      </span>

                      <span className="font-bold">
                        {!isEligible
                          ? 'Không chấm ở câu này'
                          : mark === 'UNGRADED'
                          ? 'Chưa chấm'
                          : mark === 'CORRECT'
                          ? 'Kết quả: ĐÚNG'
                          : mark === 'WRONG'
                          ? 'Kết quả: SAI'
                          : 'Kết quả: KHÔNG TL'}
                      </span>
                    </div>

                    {/* Explicit Text + Icon Grading Buttons (Never color alone) */}
                    {isEligible && stagePhase !== 'CONFIRMED' && (
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSetStudentMark(p.participantId, 'CORRECT')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 border cursor-pointer ${
                            mark === 'CORRECT'
                              ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                              : 'bg-slate-950 text-emerald-300 border-slate-800 hover:border-emerald-400/50'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Đúng</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetStudentMark(p.participantId, 'WRONG')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 border cursor-pointer ${
                            mark === 'WRONG'
                              ? 'bg-rose-400 text-slate-950 border-rose-300'
                              : 'bg-slate-950 text-rose-300 border-slate-800 hover:border-rose-400/50'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Sai</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetStudentMark(p.participantId, 'NO_ANSWER')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer ${
                            mark === 'NO_ANSWER'
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-slate-950 text-amber-300 border-slate-800 hover:border-amber-400/50'
                          }`}
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>Không TL</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          MODAL 1: BATCH CONFIRMATION FOR UNGRADED STUDENTS (Section 8)
          ==================================================================== */}
      {pendingBatchAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/50 p-5 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-300 font-black text-base">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Xác nhận thao tác chấm hàng loạt</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Bạn sắp đánh dấu <strong>{pendingBatchAction.targetIds.length} học sinh</strong> đang ở trạng thái{' '}
              <em>Chưa chấm</em> thành{' '}
              <strong>
                {pendingBatchAction.targetMark === 'NO_ANSWER' ? 'KHÔNG TRẢ LỜI' : 'SAI'}
              </strong>
              . Bạn vẫn có thể Hoàn tác trước khi bấm Xác nhận kết quả câu.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingBatchAction(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchMarkUngraded}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Xác nhận áp dụng ({pendingBatchAction.targetIds.length} HS)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: TRANSPARENT RESCUE ("CỨU TRỢ" — Section 9)
          ==================================================================== */}
      {showRescueModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 border-2 border-emerald-400/60 p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-black text-lg">
                <HeartHandshake className="w-6 h-6" />
                <span>CỨU TRỢ THÍ SINH TẠM RỜI SÀN</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRescueModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Giáo viên có thể tổ chức hoạt động cứu trợ tại lớp, sau đó chọn những học sinh được quay lại thi đấu từ <strong>câu {currentQuestionNumber + 1}</strong>. Quy tắc minh bạch: Không sửa đáp án sai trước đó thành đúng và không cộng điểm bù cho các câu đã bỏ lỡ.
            </p>

            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300">
                Đã chọn cứu trợ: {selectedRescueIds.size} / {sidelinedParticipantsAfterCurrentQuestion.length} học sinh
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedRescueIds(
                      new Set(
                        sidelinedParticipantsAfterCurrentQuestion.map(
                          (s) => s.participant.participantId
                        )
                      )
                    )
                  }
                  className="text-cyan-300 hover:underline font-bold cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setSelectedRescueIds(new Set())}
                  className="text-slate-400 hover:underline font-bold cursor-pointer"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {sidelinedParticipantsAfterCurrentQuestion.map((item) => {
                const id = item.participant.participantId;
                const checked = selectedRescueIds.has(id);
                return (
                  <label
                    key={id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer ${
                      checked
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleRescueStudent(id)}
                        className="w-4 h-4 accent-emerald-400"
                      />
                      <span className="font-mono font-bold text-amber-300 text-xs">
                        #{String(item.participant.stt).padStart(2, '0')}
                      </span>
                      <span className="font-bold text-xs sm:text-sm">
                        {item.participant.fullName}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Tạm rời sàn ở câu {item.eliminatedAtQuestionNumber || '-'} · {item.score}đ
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRescueModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy (Chưa tiêu hao quyền)
              </button>
              <button
                type="button"
                disabled={selectedRescueIds.size === 0}
                onClick={handleConfirmRescue}
                className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 text-xs font-black cursor-pointer"
              >
                Xác nhận Cứu trợ ({selectedRescueIds.size} HS quay lại sàn)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: CONTROLLED ROLLBACK TO EARLIER QUESTION (Section 11)
          ==================================================================== */}
      {showRollbackModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/50 p-5 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-2 text-amber-300 font-black text-base">
              <History className="w-5 h-5" />
              <span>Quay lại câu hỏi trước có kiểm soát</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Chọn mốc câu hỏi bạn muốn quay về. Lưu ý: Các kết quả chấm và sự kiện cứu trợ phát sinh <strong>sau câu được chọn</strong> sẽ bị hủy để tính toán lại điểm và trạng thái nhất quán.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Chọn câu muốn quay về:
              </label>
              <select
                value={rollbackTargetQuestionNumber}
                onChange={(e) => setRollbackTargetQuestionNumber(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
              >
                {questionRecords.map((r) => (
                  <option key={r.questionNumber} value={r.questionNumber}>
                    Về cuối Câu {r.questionNumber} (Hủy các câu &gt; {r.questionNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRollbackModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmControlledRollback}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Xác nhận quay về Câu {rollbackTargetQuestionNumber}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          OVERLAY 4: PAUSE MASKING OVERLAY (Section 12: hides question & locks UI)
          ==================================================================== */}
      {isPaused && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
          <Pause className="w-12 h-12 text-amber-300" />
          <h3 className="text-xl font-black text-white">
            ĐANG TẠM DỪNG PHIÊN RUNG CHUÔNG VÀNG
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md">
            Đồng hồ đã tạm dừng và nội dung câu hỏi đang được ẩn để đảm bảo công bằng cho cả lớp.
          </p>
          <button
            type="button"
            onClick={handleTogglePause}
            className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Tiếp tục phiên chơi</span>
          </button>
        </div>
      )}
    </div>
  );
};
export default GoldenBell3DGame;
