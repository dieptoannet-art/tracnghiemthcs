export type UserRole = 'student' | 'teacher' | 'admin' | 'reviewer';

export type SupabaseConnectionState =
  | 'unconfigured'             // Chưa có URL/key hợp lệ -> "Chưa cấu hình Supabase"
  | 'configured_unverified'   // Có cấu hình nhưng chưa xác minh kết nối -> "Đã cấu hình — chưa xác minh"
  | 'verified_auth_only'      // Mới xác minh Auth -> "Đã xác minh: Auth"
  | 'verified_db_only'        // Mới xác minh CSDL -> "Đã xác minh: CSDL"
  | 'verified_all'            // Xác minh cả Auth và CSDL -> "Đã xác minh: Auth & CSDL"
  | 'error';                  // Lỗi kết nối Supabase

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  grade?: Grade;
  studentCode?: string;
  schoolName?: string;
  subject?: string;
  createdAt?: string;
}

export type Grade = '6' | '7' | '8' | '9';

export type ExamPeriod = 'mid1' | 'final1' | 'mid2' | 'final2';

export type SubjectId =
  | 'math'
  | 'literature'
  | 'english'
  | 'science'
  | 'history_geo'
  | 'informatics'
  | 'technology'
  | 'civics'
  | 'other';

export type QuestionType =
  | 'single_choice'      // Trắc nghiệm 1 đáp án đúng (A, B, C, D)
  | 'true_false_group'  // Đúng - Sai nhiều ý (a, b, c, d)
  | 'short_answer'       // Trả lời ngắn
  | 'essay';             // Tự luận

export type CognitiveLevel =
  | 'know'        // Nhận biết
  | 'understand'  // Thông hiểu
  | 'apply';      // Vận dụng (kèm vận dụng cao)

export type QuestionStatus =
  | 'draft'       // Nháp
  | 'pending'     // Chờ duyệt
  | 'approved'    // Được duyệt
  | 'deprecated'; // Ngừng sử dụng

export type Textbook =
  | 'Cánh Diều'
  | 'Kết nối tri thức'
  | 'Chân trời sáng tạo';

export interface SingleChoiceOption {
  id: string;
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface TrueFalseSubItem {
  id: string;
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  isCorrect: boolean; // true = Đúng, false = Sai
  level?: CognitiveLevel;
  yccd?: string;
}

export interface RubricCriterion {
  id: string;
  criterion: string;
  maxPoints: number;
}

export interface Question {
  id: string;
  code: string; // VD: TOAN8-CK1-01
  grade: Grade;
  subject: SubjectId;
  textbook: Textbook;
  chapter: string;
  lesson: string;
  yccd: string; // Yêu cầu cần đạt
  competency?: string; // Thành phần năng lực
  level: CognitiveLevel;
  type: QuestionType;
  stem: string; // Nội dung câu hỏi (hỗ trợ KaTeX, text, code)
  image?: string;
  points: number; // Mặc định thường là 0.25 đến 2.0
  explanation: string; // Lời giải chi tiết
  status: QuestionStatus;
  author: string;
  version: number;
  // Cho loại câu:
  options?: SingleChoiceOption[];
  correctAnswer?: string; // ID hoặc 'A'/'B'/'C'/'D'
  subItems?: TrueFalseSubItem[];
  acceptedAnswers?: string[]; // Cho dạng trả lời ngắn
  isNumericTolerance?: boolean;
  numericTolerance?: number;
  rubric?: RubricCriterion[]; // Cho tự luận
  sampleAnswer?: string;
}

export interface MatrixRow {
  id: string;
  topic: string;
  unit: string; // Đơn vị kiến thức
  yccd: string;
  questionType: QuestionType;
  knowCount: number;      // Số câu/ý Biết
  knowPoints: number;
  understandCount: number; // Số câu/ý Hiểu
  understandPoints: number;
  applyCount: number;     // Số câu/ý Vận dụng
  applyPoints: number;
}

export interface ExamMatrix {
  id: string;
  title: string;
  grade: Grade;
  subject: SubjectId;
  period: ExamPeriod;
  schoolYear: string;
  durationMinutes: number;
  totalPoints: number;
  rows: MatrixRow[];
  cognitiveRatio: {
    knowPercent: number;
    understandPercent: number;
    applyPercent: number;
  };
}

export interface Exam {
  id: string;
  code: string;
  title: string;
  matrixId?: string;
  grade: Grade;
  subject: SubjectId;
  period: ExamPeriod;
  durationMinutes: number;
  questions: Question[];
  totalPoints: number;
  shuffledCode?: string;
  lockedQuestionIds?: string[];
  createdAt: string;
  author: string;
}

export interface Assignment {
  id: string;
  examId: string;
  examTitle: string;
  classId: string;
  className: string;
  grade: Grade;
  subject: SubjectId;
  openTime: string;
  closeTime: string;
  durationMinutes: number;
  attemptsAllowed: number;
  allowReview: boolean;
  showSolutionAfterSubmit: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isComputerLabMode: boolean; // Tự đăng xuất sau khi nộp
  status: 'active' | 'closed' | 'scheduled';
}

export interface SubmissionAnswer {
  questionId: string;
  questionType: QuestionType;
  selectedOption?: string; // single_choice: 'A'
  trueFalseAnswers?: Record<string, boolean>; // subItem.id -> boolean
  shortAnswerText?: string;
  essayAnswerText?: string;
  essayImages?: string[]; // Ảnh chụp bài làm tự luận của học sinh
  isCorrect?: boolean;
  pointsAwarded?: number;
  teacherFeedback?: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  grade: Grade;
  subject: SubjectId;
  startTime: string;
  submittedAt: string;
  timeSpentSeconds: number;
  status: 'in_progress' | 'submitted' | 'graded';
  answers: Record<string, SubmissionAnswer>;
  score: number;
  maxScore: number;
  tabSwitchCount: number;
}

export interface ClassRoom {
  id: string;
  name: string;
  grade: Grade;
  teacherName: string;
  studentCount: number;
  inviteCode: string;
  students: {
    id: string;
    code: string;
    fullName: string;
    email: string;
    gender: 'Nam' | 'Nữ';
  }[];
}

export interface GeminiAssistantConfig {
  id: string;
  subject: SubjectId;
  name: string;
  description: string;
  externalUrl?: string; // Link URL if configured
  samplePromptTemplate: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: string;
  target: string;
  details: string;
}

export interface StudyDocument {
  id: string;
  title: string;
  grade: Grade;
  subject: SubjectId;
  type: 'de_cuong' | 'bai_giang' | 'cong_thuc' | 'de_mau';
  author: string;
  downloadUrl?: string;
  size: string;
  uploadedDate: string;
  description: string;
}
