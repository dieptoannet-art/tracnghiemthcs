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
  teacherCode?: string;
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
  subject: SubjectId | string;
  textbook: Textbook;
  chapter: string;
  lesson: string;
  yccd?: string; // Yêu cầu cần đạt
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
  examSection?: 'part1' | 'part2' | 'part3';
}

export interface YccdItem {
  stableKey: string;
  subject: string;
  subjectKey: string;
  grade: Grade;
  topic: string;
  unit: string;
  yccd: string;
  sourceLabel: string;
  level: CognitiveLevel;
  levelLabel: string;
  topicId: string;
  topicShortLabel: string;
  unitId: string;
  yccdId: string;
  competencyCode?: string;
  orderIndex: number;
}

export interface MatrixPointConfig {
  targetTotalScore: number;
  singleChoicePerQuestion: number;
  trueFalsePerSubItem: number;
  shortAnswerPerQuestion: number;
  essayPerSubItem: number;
  targetCognitiveRatio: {
    knowPercent: number;
    understandPercent: number;
    applyPercent: number;
  };
}

export interface MatrixAllocationCell {
  unitKey: string;
  level: CognitiveLevel;
  questionType: QuestionType;
  count: number;
  rawCountText: string;
  codeText: string;
  isManualCode: boolean;
  linkedYccdKeys: string[];
  codeYccdMap?: Record<string, string[]>;
}

export interface MatrixDraftState {
  id: string;
  title: string;
  subject: string;
  subjectKey: SubjectId;
  grade: Grade;
  period: ExamPeriod;
  schoolYear: string;
  durationMinutes: number;
  showShortAnswer: boolean;
  selectedYccdKeys: string[];
  allocations: Record<string, MatrixAllocationCell>;
  competencyOverrides: Record<string, string>;
  pointConfig: MatrixPointConfig;
  updatedAt: string;
  authorName?: string;
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
  draftState?: MatrixDraftState;
  updatedAt?: string;
  authorId?: string;
  authorName?: string;
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
  questionCount?: number;
  totalPoints: number;
  shuffledCode?: string;
  lockedQuestionIds?: string[];
  createdAt: string;
  author: string;
  authorId?: string;
  clientRequestId?: string;
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
  roundLabel?: string;
  assignedBy?: string;
  clientRequestId?: string;
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

export interface QuestionGradingDetail {
  pointsAwarded?: number;
  teacherFeedback?: string;
  gradedBy?: string;
  gradedAt?: string;
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
  teacherFeedback?: string | null;
  gradingDetails?: Record<string, QuestionGradingDetail>;
  gradedBy?: string | null;
  gradedAt?: string | null;
}

export interface ClassRoom {
  id: string;
  name: string;
  classCode?: string;
  grade: Grade;
  teacherName: string;
  teacherId?: string;
  schoolYear?: string;
  studentCount: number;
  inviteCode: string;
  students: {
    id: string;
    code: string;
    fullName: string;
    email: string;
    gender?: 'Nam' | 'Nữ';
  }[];
}

export interface TeachingAssignment {
  id: string;
  schoolYear: string;
  teacherId: string;
  teacherCode?: string | null;
  teacherName?: string;
  teacherEmail?: string;
  classId: string;
  classCode?: string | null;
  className?: string;
  grade?: Grade | string;
  subject: SubjectId | string | null;
  subjectLabel?: string;
  status: 'active' | 'ended';
  needsSubjectCompletion: boolean;
  notes?: string | null;
  startedAt?: string;
  endedAt?: string | null;
}

export type ClassRoleType = 'homeroom' | 'class_manager';

export interface ClassRoleAssignment {
  id: string;
  schoolYear: string;
  classId: string;
  classCode?: string | null;
  className?: string;
  grade?: Grade | string;
  teacherId: string;
  teacherCode?: string | null;
  teacherName?: string;
  teacherEmail?: string;
  roleType: ClassRoleType;
  roleLabel?: string;
  status: 'active' | 'ended';
  notes?: string | null;
  grantedAt?: string;
  endedAt?: string | null;
}

export interface CutoverMissingSubjectItem {
  teachingAssignmentId: string;
  schoolYear: string;
  classId: string;
  classCode?: string | null;
  className: string;
  grade: string;
  teacherId: string;
  teacherCode?: string | null;
  teacherName: string;
  teacherEmail: string;
  affectedAssignmentsCount: number;
  affectedSubmissionsCount: number;
  notes?: string | null;
}

export interface CutoverImpactedClassItem {
  classId: string;
  className: string;
  classCode?: string | null;
  grade: string;
  schoolYear: string;
  legacyTeacherId?: string | null;
  legacyTeacherName?: string | null;
  legacyTeacherCode?: string | null;
  missingSubjectCount: number;
  completedSubjectCount: number;
  explicitClassRoleCount: number;
  totalAssignmentsCount: number;
  totalSubmissionsCount: number;
  unmappedAssignmentsCount: number;
  impactReason: string;
}

export interface CutoverReadinessReport {
  readyForCutover: boolean;
  missingSubjectCount: number;
  impactedClassCount: number;
  missingSubjectItems: CutoverMissingSubjectItem[];
  impactedClasses: CutoverImpactedClassItem[];
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

export type StudyMaterialType =
  | 'de_cuong'
  | 'phieu_bai_tap'
  | 'de_tham_khao'
  | 'so_tay'
  | 'tep_thuc_hanh';

export type StudyMaterialStatus = 'draft' | 'published';

export interface StudyDocument {
  id: string;
  title: string;
  topic?: string;
  grade: Grade;
  subject: SubjectId;
  materialType: StudyMaterialType;
  examTerm?: ExamPeriod | null;
  lessonId?: string | null;
  chapterKey?: string | null;
  chapterLabel?: string | null;
  lessonLabel?: string | null;
  author: string;
  authorId?: string;
  description: string;
  usageInstructions?: string | null;
  fileName?: string | null;
  fileFormat?: string | null;
  fileUrl?: string | null;
  storagePath?: string | null;
  fileSizeBytes?: number | null;
  status: StudyMaterialStatus;
  updatedAt?: string | null;
  createdAt?: string | null;
  answerKeyFileName?: string | null;
  answerKeyFileUrl?: string | null;
  answerKeyStoragePath?: string | null;
  isAnswerKeyPublished?: boolean;
}

export interface StudyMaterialNavIntent {
  grade?: Grade | 'all';
  subject?: SubjectId | 'all';
  materialType?: StudyMaterialType | 'all';
  examTerm?: ExamPeriod | 'all';
  chapterKey?: string | 'all';
  lessonId?: string | 'all';
  searchQuery?: string;
  openMaterialId?: string;
}

