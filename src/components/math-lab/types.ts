import { Grade, Question } from '../../types';

export type MathGrade = 6 | 7 | 8 | 9;

export type MathToolId =
  | 'M01'
  | 'M02'
  | 'M03'
  | 'M04'
  | 'M05'
  | 'M06'
  | 'M07'
  | 'M08'
  | 'M09'
  | 'M10'
  | 'M11'
  | 'M12'
  | 'M13'
  | 'M14'
  | 'M15'
  | 'M16'
  | 'M17'
  | 'M18';

export type MathKnowledgeStrand =
  | 'geometry_measurement' // Hình học và Đo lường
  | 'number_algebra'       // Số và Đại số
  | 'statistics_prob'      // Thống kê và Xác suất
  | 'practice_experience'; // Thực hành và Trải nghiệm

export const KNOWLEDGE_STRAND_LABELS: Record<MathKnowledgeStrand, string> = {
  geometry_measurement: 'Hình học & Đo lường',
  number_algebra: 'Số & Đại số',
  statistics_prob: 'Thống kê & Xác suất',
  practice_experience: 'Thực hành & Trải nghiệm',
};

export type PedagogicalMode =
  | 'EXPLORE'   // A. Khám phá tự do
  | 'GUIDED'    // B. Hoạt động có hướng dẫn
  | 'CHALLENGE'; // C. Thử thách đánh giá

export const PEDAGOGICAL_MODE_LABELS: Record<PedagogicalMode, string> = {
  EXPLORE: 'Khám phá tự do',
  GUIDED: 'Nhiệm vụ có hướng dẫn',
  CHALLENGE: 'Thử thách chấm điểm',
};

export type SixStepLearningPhase =
  | 'PREDICT'    // 1. Dự đoán
  | 'MANIPULATE' // 2. Thao tác
  | 'OBSERVE'    // 3. Quan sát
  | 'EXPLAIN'    // 4. Giải thích
  | 'CONCLUDE'   // 5. Kết luận
  | 'PRACTICE';  // 6. Luyện tập

export const SIX_STEP_LABELS: Record<SixStepLearningPhase, string> = {
  PREDICT: '1. Dự đoán',
  MANIPULATE: '2. Thao tác',
  OBSERVE: '3. Quan sát',
  EXPLAIN: '4. Giải thích',
  CONCLUDE: '5. Kết luận',
  PRACTICE: '6. Luyện tập',
};

export interface MathActivitySpec {
  id: string;
  toolId: MathToolId;
  title: string;
  grade: Grade;
  topic: string;
  relatedLesson: string; // Theo SGK Kết nối tri thức với cuộc sống
  objective: string;
  prompt: string;
  instructions: string[];
  predictionQuestion?: string;
  predictionOptions?: string[];
  toolPresetConfig: Record<string, unknown>;
  expectedOutcomeSummary: string;
  gradingRuleDescription: string;
  targetNumericValue?: number;
  numericTolerance?: number;
  targetExpression?: string;
  explanationLatex: string;
  completionCriteria: string;
}

export interface MathToolMetadata {
  id: MathToolId;
  code: MathToolId;
  nameVi: string;
  shortDescription: string;
  iconName: string;
  grades: Grade[];
  strand: MathKnowledgeStrand;
  strandLabel: string;
  learningObjectives: string[];
  isAvailable: boolean;
  featureFlagKey: string;
  features: string[];
  defaultConfig: Record<string, unknown>;
  storageRequirement: 'local_only' | 'local_and_optional_sync';
  sampleActivities: MathActivitySpec[];
}

export interface MathClassroomSession {
  id: string;
  code: string;
  toolId: MathToolId;
  activityId: string;
  grade: MathGrade;
  classId: string;
  className: string;
  teacherId?: string;
  teacherName?: string;
  status: 'ACTIVE' | 'CLOSED';
  createdAt: string;
  participantCount: number;
}

export interface MathActivityResultRecord {
  id: string;
  toolId: MathToolId;
  activityId: string;
  studentName: string;
  className?: string;
  completedSteps: SixStepLearningPhase[];
  predictionText?: string;
  conclusionText?: string;
  practiceAnswer?: string;
  isCorrect?: boolean;
  score: number;
  maxScore: number;
  completedAt: string;
}

export interface MathSavedConstruction {
  id: string;
  toolId: MathToolId;
  title: string;
  grade: MathGrade;
  updatedAt: string;
  payload: Record<string, unknown>;
}

export interface MathLabSharedProps {
  toolMeta: MathToolMetadata;
  selectedGrade: Grade;
  pedagogicalMode: PedagogicalMode;
  currentStep: SixStepLearningPhase;
  activeActivity: MathActivitySpec;
  isPresentationMode: boolean;
  isDarkTheme: boolean;
  mathQuestions: Question[];
  classStudents: { id: string; code: string; fullName: string }[];
  className: string;
  onRecordResult: (result: Omit<MathActivityResultRecord, 'id'>) => void;
  onSaveConstruction: (title: string, payload: Record<string, unknown>) => void;
}
