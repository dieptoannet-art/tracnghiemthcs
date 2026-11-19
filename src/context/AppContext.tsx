import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import {
  UserRole,
  Grade,
  SubjectId,
  ExamPeriod,
  Question,
  ClassRoom,
  ExamMatrix,
  Exam,
  Assignment,
  Submission,
  GeminiAssistantConfig,
  AuditLog,
  StudyDocument,
  StudyMaterialNavIntent,
  SubmissionAnswer,
  UserProfile,
  SupabaseConnectionState,
  YccdItem,
  TeachingAssignment,
  ClassRoleAssignment
} from '../types';
import yccdCatalogSeed from '../data/yccdCatalogSeed.json';
import { mergeYccdCatalog, normalizeYccdItem } from '../utils/yccdCsvParser';
import {
  INITIAL_QUESTIONS,
  INITIAL_CLASSES,
  INITIAL_MATRICES,
  INITIAL_EXAMS,
  INITIAL_ASSIGNMENTS,
  INITIAL_SUBMISSIONS,
  INITIAL_GEMINI_ASSISTANTS,
  INITIAL_STUDY_DOCS,
  INITIAL_AUDIT_LOGS
} from '../data/mockData';
import {
  supabase,
  isSupabaseConfigured,
  fetchUserProfileDetailed,
  testSupabaseConnection,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from '../lib/supabase';
import {
  fetchStudentAssignmentsFromSupabase,
  fetchTeacherWorkspaceFromSupabase,
  syncCreateClassOnSupabase,
  syncEnrollStudentOnSupabase,
  syncJoinClassByInviteCode,
  syncPublishExamAssignmentOnSupabase,
  syncSaveExamOnSupabase,
  PublishExamAssignmentParams,
  SaveExamDraftParams
} from '../utils/supabaseAssignmentSync';
import {
  LOCAL_STUDY_MATERIALS_KEY,
  SaveStudyMaterialPayload,
  deleteStudyMaterialFromSupabase,
  fetchStudyMaterialsFromSupabase,
  hasValidAttachedFile,
  inferFileFormat,
  normalizeLegacyStudyDocument,
  saveStudyMaterialToSupabase
} from '../utils/studyMaterialsSync';
import {
  buildStudentInternalAuthEmail,
  isValidStudentCode,
  normalizeStudentCode
} from '../utils/studentAuthHelper';
import {
  DEMO_STUDENT_IDENTITY,
  DEMO_STUDENT_PROFILE,
  DEMO_TEACHER_PROFILE,
  DemoWorkspaceRole,
  KhktDemoWorkspaceState,
  buildNavigationUrl,
  createFreshKhktDemoState,
  isDemoPathname,
  loadKhktDemoMeta,
  loadKhktDemoState,
  resetKhktDemoSandbox,
  resolveRouteLocation,
  sanitizeDemoView,
  saveKhktDemoMeta,
  saveKhktDemoState
} from '../utils/khktDemoSandbox';


interface AppContextType {
  accessMode: string;
  setAccessMode: (mode: string) => void;
  isDemoSandbox: boolean;
  demoRole: DemoWorkspaceRole;
  setDemoRole: (role: DemoWorkspaceRole) => void;
  demoResetVersion: number;
  enterKhktDemo: (targetView?: string) => void;
  exitDemoToRealLogin: () => void;
  enterPublicGuest: () => void;
  enterDemoRole: (role: string, targetView?: string) => void;
  enterKhktShowcase: (presentation?: boolean) => void;
  exitDemoToWorkspace: (targetView?: string) => void;
  resetDemoSandbox: () => void;
  preferredDemoAssignmentId: string | null;
  setPreferredDemoAssignmentId: (id: string | null) => void;
  khktPresentationStep: number;
  setKhktPresentationStep: (step: number) => void;
  reducedMotion: boolean;
  setReducedMotion: (val: boolean) => void;
  coreKnowledgeTargetLessonId: string | null;
  openCoreKnowledgeLesson: (lessonId: string) => void;
  clearCoreKnowledgeTargetLesson: () => void;

  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  isSupabaseLiveConfigured: boolean;
  supabaseConfig: {
    url: string;
    anonKey: string;
    isConnected: boolean;
  };
  setSupabaseConfig: React.Dispatch<React.SetStateAction<{ url: string; anonKey: string; isConnected: boolean }>>;

  // Real Supabase User, Profile & Status
  supabaseStatus: SupabaseConnectionState;
  supabaseStatusLabel: string;
  authVerified: boolean;
  dbVerified: boolean;
  connectionError: string | null;
  verifySupabase: () => Promise<{ success: boolean; message: string; authVerified?: boolean; dbVerified?: boolean }>;

  user: User | null;
  userProfile: UserProfile | null;
  authenticatedProdUser: User | null;
  authenticatedProdProfile: UserProfile | null;
  authenticatedProdRole: UserRole;
  profileStatus: 'idle' | 'loading' | 'loaded' | 'not_found' | 'error';
  profileError: string | null;
  retryLoadProfile: () => Promise<void>;
  authLoading: boolean;
  authError: string | null;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register' | 'forgot_password' | 'set_password';
  setAuthModalMode: (mode: 'login' | 'register' | 'forgot_password' | 'set_password') => void;
  openAuthModal: (mode?: 'login' | 'register' | 'forgot_password' | 'set_password') => void;
  signIn: (
    identifier: string,
    pass: string
  ) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    role: 'student' | 'teacher',
    grade?: Grade,
    studentCode?: string,
    subject?: string
  ) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePasswordForRecovery: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Filters
  selectedGrade: Grade;
  setSelectedGrade: (grade: Grade) => void;
  selectedSubject: SubjectId;
  setSelectedSubject: (subject: SubjectId) => void;
  selectedPeriod: ExamPeriod;
  setSelectedPeriod: (period: ExamPeriod) => void;

  // Active View Navigation
  currentView: string;
  setCurrentView: (view: string) => void;

  // Data Collections (Supabase when authenticated; browser demo when unauthenticated/unconfigured)
  questions: Question[];
  classes: ClassRoom[];
  enrolledClassIds: string[] | null;
  matrices: ExamMatrix[];
  exams: Exam[];
  assignments: Assignment[];
  teachingAssignments: TeachingAssignment[];
  classRoles: ClassRoleAssignment[];
  submissions: Submission[];
  assignmentDataLoading: boolean;
  assignmentDataError: string | null;
  teachingSchemaWarning: string | null;
  isUsingDemoAssignmentsData: boolean;
  retryLoadAssignmentData: () => Promise<void>;
  geminiAssistants: GeminiAssistantConfig[];
  studyDocs: StudyDocument[];
  studyDocsLoading: boolean;
  studyDocsError: string | null;
  retryLoadStudyDocs: () => Promise<void>;
  studyMaterialNavIntent: StudyMaterialNavIntent | null;
  openStudyMaterialsWithIntent: (intent: StudyMaterialNavIntent) => void;
  clearStudyMaterialNavIntent: () => void;
  saveStudyMaterialAsync: (
    payload: Omit<SaveStudyMaterialPayload, 'author' | 'authorId'> & { author?: string }
  ) => Promise<{ success: boolean; material?: StudyDocument; isDemo?: boolean; error?: string }>;
  deleteStudyMaterialAsync: (id: string) => Promise<{ success: boolean; error?: string }>;
  auditLogs: AuditLog[];
  yccdCatalog: YccdItem[];
  pendingMatrixPrompt: string;
  setPendingMatrixPrompt: (prompt: string) => void;

  // Student Profile
  studentUser: {
    id: string;
    code: string;
    fullName: string;
    className: string;
    school: string;
  };

  // Actions
  addQuestion: (q: Question) => void;
  updateQuestion: (q: Question) => void;
  deleteQuestion: (id: string) => void;
  approveQuestion: (id: string) => void;
  importQuestionsBatch: (newQuestions: Partial<Question>[]) => void;
  importYccdItems: (incoming: YccdItem[]) => { inserted: number; updated: number; unchanged: number };
  createMatrix: (matrix: ExamMatrix) => void;
  saveMatrixDraft: (matrix: ExamMatrix) => Promise<{ savedToSupabase: boolean; error?: string }>;
  deleteMatrixDraft: (matrixId: string) => Promise<void>;
  createExam: (exam: Exam) => void;
  saveExamAsync: (
    params: Omit<SaveExamDraftParams, 'teacherId' | 'teacherRole' | 'teacherName'>
  ) => Promise<{ success: boolean; exam?: Exam; isDemo?: boolean; error?: string }>;
  createAssignment: (asg: Assignment) => void;
  publishExamAssignmentAsync: (
    params: Omit<PublishExamAssignmentParams, 'teacherId' | 'teacherRole' | 'teacherName'>
  ) => Promise<{ success: boolean; exam?: Exam; assignment?: Assignment; isDemo?: boolean; error?: string }>;
  submitExamSession: (submission: Submission) => void;
  gradeEssayQuestion: (submissionId: string, questionId: string, pointsAwarded: number, feedback: string) => void;
  addClassRoom: (cls: ClassRoom) => void;
  addStudentToClass: (classId: string, student: { id: string; code: string; fullName: string; email: string; gender: 'Nam' | 'Nữ' }) => void;
  createClassRoomAsync: (params: {
    name: string;
    grade: Grade;
    schoolYear?: string;
  }) => Promise<{ success: boolean; classRoom?: ClassRoom; isDemo?: boolean; error?: string }>;
  enrollStudentInClassAsync: (params: {
    classId: string;
    identifier: string;
    demoFallback?: { code: string; fullName: string; gender: 'Nam' | 'Nữ' };
  }) => Promise<{ success: boolean; isDemo?: boolean; error?: string }>;
  joinClassByInviteCodeAsync: (
    inviteCode: string
  ) => Promise<{ success: boolean; className?: string; error?: string }>;
  addAuditLog: (action: string, target: string, details: string) => void;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Mode & Auth States
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);

  // Vai trò luôn mặc định an toàn là 'student' cho đến khi xác thực phiên Supabase và đọc từ public.profiles.
  // Tuyệt đối không suy diễn vai trò từ localStorage, tên hiển thị "GV." hay user_metadata.
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentRole, setCurrentRoleState] = useState<UserRole>('student');
  const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'loaded' | 'not_found' | 'error'>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);

  const currentRoleRef = useRef<UserRole>(currentRole);
  useEffect(() => {
    currentRoleRef.current = currentRole;
  }, [currentRole]);

  const initialRouteRef = useRef(
    typeof window !== 'undefined'
      ? resolveRouteLocation(window.location.pathname, window.location.search)
      : { isDemo: false, view: 'dashboard', isDirectProtectedPath: false }
  );

  // Supabase Auth & Verification States
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(
    initialRouteRef.current.isDemo ? false : isSupabaseConfigured
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot_password' | 'set_password'>('login');

  const openAuthModal = useCallback((mode: 'login' | 'register' | 'forgot_password' | 'set_password' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  // Connection real verification trackers
  const [authVerified, setAuthVerified] = useState<boolean>(false);
  const [dbVerified, setDbVerified] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Exact real-world status according to strict rules:
  // - Chưa có URL/key hợp lệ: "Chưa cấu hình Supabase"
  // - Có cấu hình nhưng chưa xác minh: "Đã cấu hình — chưa xác minh"
  // - Chỉ xác nhận Auth khi có bằng chứng xác thực thành công (có phiên người dùng thực tế)
  const supabaseStatus: SupabaseConnectionState = React.useMemo(() => {
    if (!isSupabaseConfigured) return 'unconfigured';
    // Chỉ coi Auth là đã xác minh khi người dùng có phiên đăng nhập thực tế hợp lệ (user !== null và authVerified)
    const hasAuthProof = Boolean(user && authVerified);
    if (connectionError && !hasAuthProof && !dbVerified) return 'error';
    if (hasAuthProof && dbVerified) return 'verified_all';
    if (hasAuthProof && !dbVerified) return 'verified_auth_only';
    if (!hasAuthProof && dbVerified) return 'verified_db_only';
    return 'configured_unverified';
  }, [user, authVerified, dbVerified, connectionError]);

  const supabaseStatusLabel: string = React.useMemo(() => {
    switch (supabaseStatus) {
      case 'unconfigured':
        return 'Chưa cấu hình Supabase';
      case 'configured_unverified':
        return 'Đã cấu hình — chưa xác minh';
      case 'verified_auth_only':
        return 'Đã xác minh: Auth';
      case 'verified_db_only':
        return 'Đã xác minh: CSDL';
      case 'verified_all':
        return 'Đã xác minh: Auth & CSDL';
      case 'error':
        return 'Lỗi kết nối Supabase';
      default:
        return 'Chưa cấu hình Supabase';
    }
  }, [supabaseStatus]);

  const verifySupabase = useCallback(async () => {
    if (accessModeRef.current !== 'PRODUCTION_USER') {
      return {
        success: false,
        message: 'Bản demo KHKT không kết nối Supabase thật.',
        authVerified: false,
        dbVerified: false
      };
    }
    if (!isSupabaseConfigured) {
      setAuthVerified(false);
      setDbVerified(false);
      return {
        success: false,
        message: 'Chưa cấu hình Supabase URL hoặc Publishable Key.',
        authVerified: false,
        dbVerified: false
      };
    }

    try {
      const res = await testSupabaseConnection();
      // Chỉ xác nhận Auth khi có bằng chứng người dùng thực tế
      if (res.authVerified && user) {
        setAuthVerified(true);
      } else {
        setAuthVerified(false);
      }
      if (res.dbVerified) setDbVerified(true);
      if (!res.success) {
        setConnectionError(res.message);
      } else {
        setConnectionError(null);
      }
      return res;
    } catch (err: any) {
      const msg = err?.message || 'Lỗi mạng khi kiểm tra Supabase.';
      setConnectionError(msg);
      return {
        success: false,
        message: msg,
        authVerified: false,
        dbVerified: false
      };
    }
  }, [user]);

  const [supabaseConfig, setSupabaseConfig] = useState({
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    isConnected: isSupabaseConfigured
  });

  const [accessMode, setAccessMode] = useState<string>(() =>
    initialRouteRef.current.isDemo ? 'DEMO_KHKT' : 'PRODUCTION_USER'
  );
  const [demoRole, setDemoRoleState] = useState<DemoWorkspaceRole>(() =>
    initialRouteRef.current.isDemo ? loadKhktDemoMeta().demoRole : 'teacher'
  );
  const [demoResetVersion, setDemoResetVersion] = useState<number>(0);
  const [demoState, setDemoState] = useState<KhktDemoWorkspaceState>(() =>
    initialRouteRef.current.isDemo ? loadKhktDemoState() : createFreshKhktDemoState()
  );
  const setAccessModeState = setAccessMode;
  const accessModeRef = useRef(accessMode);
  useEffect(() => {
    accessModeRef.current = accessMode;
  }, [accessMode]);

  const setDemoRole = useCallback((nextRole: DemoWorkspaceRole) => {
    setDemoRoleState(nextRole);
  }, []);

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('taydo_reduced_motion');
      if (saved === 'true') return true;
      if (saved === 'false') return false;
      return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (accessMode !== 'PRODUCTION_USER') return;
    try {
      localStorage.setItem('taydo_reduced_motion', String(reducedMotion));
    } catch {}
  }, [reducedMotion, accessMode]);

  const [coreKnowledgeTargetLessonId, setCoreKnowledgeTargetLessonId] = useState<string | null>(null);
  const [preferredDemoAssignmentId, setPreferredDemoAssignmentId] = useState<string | null>(null);
  const [khktPresentationStep, setKhktPresentationStepState] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    try {
      const saved = Number(sessionStorage.getItem('taydo_khkt_pres_step') || '1');
      if (saved >= 1 && saved <= 6) return saved;
    } catch {}
    return 1;
  });

  const setKhktPresentationStep = useCallback((step: number) => {
    const clamped = Math.max(1, Math.min(6, Math.round(step)));
    setKhktPresentationStepState(clamped);
    try {
      sessionStorage.setItem('taydo_khkt_pres_step', String(clamped));
    } catch {}
  }, []);

  const initialDemoMeta = initialRouteRef.current.isDemo ? loadKhktDemoMeta() : null;
  const [selectedGrade, setSelectedGrade] = useState<Grade>(initialDemoMeta?.selectedGrade || '8');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>(initialDemoMeta?.selectedSubject || 'math');
  const [selectedPeriod, setSelectedPeriod] = useState<ExamPeriod>(initialDemoMeta?.selectedPeriod || 'mid1');
  const [currentView, setCurrentViewState] = useState<string>(() => initialRouteRef.current.view);

  const setCurrentView = useCallback((view: string) => {
    const inDemo = accessModeRef.current !== 'PRODUCTION_USER';
    const nextView = inDemo ? sanitizeDemoView(view) : view;
    setCurrentViewState(nextView);
    if (typeof window !== 'undefined') {
      try {
        const nextUrl = buildNavigationUrl(nextView, window.location.href, inDemo);
        window.history.replaceState({}, '', nextUrl);
      } catch {}
    }
  }, []);

  const openCoreKnowledgeLesson = useCallback(
    (lessonId: string) => {
      setCoreKnowledgeTargetLessonId(lessonId);
      setCurrentView('student_core_knowledge');
    },
    [setCurrentView]
  );

  const clearCoreKnowledgeTargetLesson = useCallback(() => {
    setCoreKnowledgeTargetLessonId(null);
  }, []);

  const enterKhktDemo = useCallback((targetView: string = 'dashboard') => {
    const safeView = sanitizeDemoView(targetView);
    const loadedState = loadKhktDemoState();
    const loadedMeta = loadKhktDemoMeta();
    accessModeRef.current = 'DEMO_KHKT';
    setDemoState(loadedState);
    setDemoRoleState(loadedMeta.demoRole);
    setAccessModeState('DEMO_KHKT');
    setCurrentViewState(safeView);
    setAuthLoading(false);
    if (typeof window !== 'undefined') {
      try {
        const nextUrl = buildNavigationUrl(safeView, window.location.href, true);
        window.history.pushState({}, '', nextUrl);
      } catch {}
    }
  }, []);

  const exitDemoToRealLogin = useCallback(() => {
    accessModeRef.current = 'PRODUCTION_USER';
    setAccessModeState('PRODUCTION_USER');
    setCurrentViewState('login_portal');
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', '/?view=login_portal');
      } catch {}
    }
  }, []);

  const enterPublicGuest = useCallback(() => {
    enterKhktDemo('dashboard');
  }, [enterKhktDemo]);

  const enterDemoRole = useCallback(
    (role: string, targetView?: string) => {
      const normalized: DemoWorkspaceRole = role === 'student' ? 'student' : 'teacher';
      setDemoRoleState(normalized);
      enterKhktDemo(targetView || 'dashboard');
    },
    [enterKhktDemo]
  );

  const enterKhktShowcase = useCallback(
    (_presentation: boolean = false) => {
      enterKhktDemo('dashboard');
    },
    [enterKhktDemo]
  );

  const exitDemoToWorkspace = useCallback(
    (targetView: string = 'dashboard') => {
      accessModeRef.current = 'PRODUCTION_USER';
      setAccessModeState('PRODUCTION_USER');
      const resolvedView = userRef.current ? targetView : 'login_portal';
      setCurrentViewState(resolvedView);
      if (typeof window !== 'undefined') {
        try {
          const nextUrl = buildNavigationUrl(resolvedView, window.location.href, false);
          window.history.pushState({}, '', nextUrl);
        } catch {}
      }
    },
    []
  );

  const resetDemoSandbox = useCallback(() => {
    const { state: freshState, meta: freshMeta } = resetKhktDemoSandbox();
    setDemoState(freshState);
    setDemoRoleState(freshMeta.demoRole);
    setSelectedGrade(freshMeta.selectedGrade);
    setSelectedSubject(freshMeta.selectedSubject);
    setSelectedPeriod(freshMeta.selectedPeriod);
    setPreferredDemoAssignmentId(null);
    setDemoResetVersion(v => v + 1);
    setCurrentViewState('dashboard');
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState({}, '', '/demo');
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const resolved = resolveRouteLocation(
        window.location.pathname,
        window.location.search
      );
      if (resolved.isDemo) {
        accessModeRef.current = 'DEMO_KHKT';
        setAccessModeState('DEMO_KHKT');
        setDemoState(loadKhktDemoState());
        setDemoRoleState(loadKhktDemoMeta().demoRole);
        setCurrentViewState(resolved.view);
      } else {
        accessModeRef.current = 'PRODUCTION_USER';
        setAccessModeState('PRODUCTION_USER');
        setCurrentViewState(resolved.view);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const safeReadLocalArray = <T,>(key: string, fallback: T[]): { data: T[]; error: string | null } => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { data: fallback, error: null };
    }
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return { data: fallback, error: null };
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        return { data: fallback, error: 'Không thể đọc dữ liệu giao bài đã lưu trên trình duyệt.' };
      }
      return { data: parsed as T[], error: null };
    } catch {
      return { data: fallback, error: 'Không thể đọc dữ liệu giao bài đã lưu trên trình duyệt.' };
    }
  };

  const [assignmentDataLoading, setAssignmentDataLoading] = useState<boolean>(false);
  const [assignmentDataError, setAssignmentDataError] = useState<string | null>(() => {
    const keys = ['taydo_classes', 'taydo_exams', 'taydo_assignments', 'taydo_submissions'];
    for (const key of keys) {
      const check = safeReadLocalArray(key, []);
      if (check.error) return check.error;
    }
    return null;
  });

  // Local storage collections for business logic
  const [questions, setQuestions] = useState<Question[]>(() => {
    return safeReadLocalArray('taydo_questions', INITIAL_QUESTIONS).data;
  });

  const [classes, setClasses] = useState<ClassRoom[]>(() => {
    return safeReadLocalArray('taydo_classes', INITIAL_CLASSES).data;
  });

  const [matrices, setMatrices] = useState<ExamMatrix[]>(() => {
    return safeReadLocalArray('taydo_matrices', INITIAL_MATRICES).data;
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    return safeReadLocalArray('taydo_exams', INITIAL_EXAMS).data;
  });

  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    return safeReadLocalArray('taydo_assignments', INITIAL_ASSIGNMENTS).data;
  });

  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [classRoles, setClassRoles] = useState<ClassRoleAssignment[]>([]);
  const [teachingSchemaWarning, setTeachingSchemaWarning] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    return safeReadLocalArray('taydo_submissions', INITIAL_SUBMISSIONS).data;
  });

  const [geminiAssistants] = useState<GeminiAssistantConfig[]>(INITIAL_GEMINI_ASSISTANTS);
  const [studyDocs, setStudyDocs] = useState<StudyDocument[]>(() => {
    const res = safeReadLocalArray<any>(LOCAL_STUDY_MATERIALS_KEY, INITIAL_STUDY_DOCS);
    return res.data.map(normalizeLegacyStudyDocument);
  });
  const [studyDocsLoading, setStudyDocsLoading] = useState<boolean>(false);
  const [studyDocsError, setStudyDocsError] = useState<string | null>(() => {
    const res = safeReadLocalArray<any>(LOCAL_STUDY_MATERIALS_KEY, INITIAL_STUDY_DOCS);
    return res.error ? 'Không thể đọc dữ liệu thư viện tài liệu học tập trên trình duyệt.' : null;
  });
  const [studyMaterialNavIntent, setStudyMaterialNavIntent] = useState<StudyMaterialNavIntent | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [pendingMatrixPrompt, setPendingMatrixPrompt] = useState<string>('');

  const [yccdCatalog, setYccdCatalog] = useState<YccdItem[]>(() => {
    const seedList = (yccdCatalogSeed as YccdItem[]).map(normalizeYccdItem);
    try {
      const saved = localStorage.getItem('taydo_yccd_catalog_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as YccdItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeYccdCatalog(seedList, parsed.map(normalizeYccdItem)).merged;
        }
      }
    } catch {
      // ignore storage errors
    }
    return seedList;
  });

  const yccdCatalogRef = useRef<YccdItem[]>(yccdCatalog);
  useEffect(() => {
    yccdCatalogRef.current = yccdCatalog;
  }, [yccdCatalog]);

  const [enrolledClassIds, setEnrolledClassIds] = useState<string[] | null>(null);
  const isDemoSandbox = accessMode !== 'PRODUCTION_USER';
  const isAuthenticatedSupabase = Boolean(isSupabaseConfigured && user && !isDemoSandbox);
  const isUsingDemoAssignmentsData = isDemoSandbox || !isAuthenticatedSupabase;

  const isUsingDemoRef = useRef<boolean>(isUsingDemoAssignmentsData);
  useEffect(() => {
    isUsingDemoRef.current = isUsingDemoAssignmentsData;
  }, [isUsingDemoAssignmentsData]);

  // Persist isolated KHKT demo state & progress ONLY under taydo_khkt_demo_v1_* keys
  useEffect(() => {
    if (!isDemoSandbox) return;
    saveKhktDemoState(demoState);
  }, [demoState, isDemoSandbox]);

  useEffect(() => {
    if (!isDemoSandbox) return;
    saveKhktDemoMeta({
      view: currentView,
      demoRole,
      selectedGrade,
      selectedSubject,
      selectedPeriod,
      updatedAt: new Date().toISOString()
    });
  }, [isDemoSandbox, currentView, demoRole, selectedGrade, selectedSubject, selectedPeriod]);

  // Sync to real local storage ONLY outside /demo KHKT sandbox (never contaminate real keys from /demo)
  useEffect(() => {
    if (isDemoSandbox || assignmentDataError) return;
    localStorage.setItem('taydo_questions', JSON.stringify(questions));
  }, [questions, assignmentDataError, isDemoSandbox]);

  useEffect(() => {
    if (isDemoSandbox || assignmentDataError || !isUsingDemoAssignmentsData) return;
    localStorage.setItem('taydo_classes', JSON.stringify(classes));
  }, [classes, assignmentDataError, isUsingDemoAssignmentsData, isDemoSandbox]);

  useEffect(() => {
    if (isDemoSandbox) return;
    localStorage.setItem('taydo_matrices', JSON.stringify(matrices));
  }, [matrices, isDemoSandbox]);

  useEffect(() => {
    if (isDemoSandbox) return;
    localStorage.setItem('taydo_yccd_catalog_v1', JSON.stringify(yccdCatalog));
  }, [yccdCatalog, isDemoSandbox]);

  useEffect(() => {
    if (isDemoSandbox || assignmentDataError || !isUsingDemoAssignmentsData) return;
    localStorage.setItem('taydo_exams', JSON.stringify(exams));
  }, [exams, assignmentDataError, isUsingDemoAssignmentsData, isDemoSandbox]);

  useEffect(() => {
    if (isDemoSandbox || assignmentDataError || !isUsingDemoAssignmentsData) return;
    localStorage.setItem('taydo_assignments', JSON.stringify(assignments));
  }, [assignments, assignmentDataError, isUsingDemoAssignmentsData, isDemoSandbox]);

  useEffect(() => {
    if (isDemoSandbox || assignmentDataError || !isUsingDemoAssignmentsData) return;
    localStorage.setItem('taydo_submissions', JSON.stringify(submissions));
  }, [submissions, assignmentDataError, isUsingDemoAssignmentsData, isDemoSandbox]);

  const loadAssignmentsForSession = useCallback(
    async (explicitUser?: User | null, explicitRole?: UserRole) => {
      if (accessModeRef.current !== 'PRODUCTION_USER') {
        setAssignmentDataLoading(false);
        return;
      }
      const activeUser = explicitUser !== undefined ? explicitUser : userRef.current;
      const activeRole = explicitRole || currentRoleRef.current;

      setAssignmentDataLoading(true);
      setAssignmentDataError(null);

      try {
        if (isSupabaseConfigured && activeUser) {
          if (activeRole === 'student') {
            const res = await fetchStudentAssignmentsFromSupabase(activeUser.id);
            if (res.error || !res.data) {
              setClasses([]);
              setEnrolledClassIds([]);
              setExams([]);
              setAssignments([]);
              setTeachingAssignments([]);
              setClassRoles([]);
              setTeachingSchemaWarning(null);
              setSubmissions([]);
              setAssignmentDataError(
                res.error || 'Không thể tải danh sách bài được giao từ Supabase.'
              );
              return;
            }
            setClasses(res.data.classes);
            setEnrolledClassIds(res.data.enrolledClassIds);
            setExams(res.data.exams);
            setAssignments(res.data.assignments);
            setTeachingAssignments([]);
            setClassRoles([]);
            setTeachingSchemaWarning(null);
            setSubmissions(res.data.submissions);
            return;
          }

          const teacherRes = await fetchTeacherWorkspaceFromSupabase(activeUser.id, activeRole);
          if (teacherRes.error || !teacherRes.data) {
            setClasses([]);
            setEnrolledClassIds(null);
            setExams([]);
            setAssignments([]);
            setTeachingAssignments([]);
            setClassRoles([]);
            setTeachingSchemaWarning(null);
            setSubmissions([]);
            setAssignmentDataError(
              teacherRes.error || 'Không thể tải dữ liệu lớp và bài giao từ Supabase.'
            );
            return;
          }
          setClasses(teacherRes.data.classes);
          setEnrolledClassIds(null);
          setExams(teacherRes.data.exams);
          setAssignments(teacherRes.data.assignments);
          setTeachingAssignments(teacherRes.data.teachingAssignments);
          setClassRoles(teacherRes.data.classRoles || []);
          setTeachingSchemaWarning(teacherRes.data.teachingSchemaWarning);
          setSubmissions(teacherRes.data.submissions);
          return;
        }

        // Demo / Local mode when Supabase is unconfigured or user has not signed in
        const classesRes = safeReadLocalArray('taydo_classes', INITIAL_CLASSES);
        const examsRes = safeReadLocalArray('taydo_exams', INITIAL_EXAMS);
        const assignmentsRes = safeReadLocalArray('taydo_assignments', INITIAL_ASSIGNMENTS);
        const submissionsRes = safeReadLocalArray('taydo_submissions', INITIAL_SUBMISSIONS);

        const localError =
          classesRes.error || examsRes.error || assignmentsRes.error || submissionsRes.error;
        if (localError) {
          setAssignmentDataError(localError);
          return;
        }

        setEnrolledClassIds(null);
        setClasses(classesRes.data);
        setExams(examsRes.data);
        setAssignments(assignmentsRes.data);
        setTeachingAssignments(
          classesRes.data.map(c => ({
            id: `demo-ta-${c.id}`,
            schoolYear: c.schoolYear || '2025-2026',
            teacherId: c.teacherId || 'demo-teacher',
            teacherName: c.teacherName,
            classId: c.id,
            classCode: c.classCode || c.name.replace(/\s+/g, '').toUpperCase(),
            className: c.name,
            grade: c.grade,
            subject: 'math',
            subjectLabel: 'Toán',
            status: 'active',
            needsSubjectCompletion: false
          }))
        );
        setClassRoles(
          classesRes.data.map(c => ({
            id: `demo-cr-${c.id}`,
            schoolYear: c.schoolYear || '2025-2026',
            classId: c.id,
            classCode: c.classCode || c.name.replace(/\s+/g, '').toUpperCase(),
            className: c.name,
            grade: c.grade,
            teacherId: c.teacherId || 'demo-teacher',
            roleType: 'homeroom',
            roleLabel: 'Chủ nhiệm lớp',
            status: 'active'
          }))
        );
        setTeachingSchemaWarning(null);
        setSubmissions(submissionsRes.data);
      } catch (err: any) {
        if (isSupabaseConfigured && activeUser) {
          setClasses([]);
          setEnrolledClassIds([]);
          setExams([]);
          setAssignments([]);
          setTeachingAssignments([]);
          setClassRoles([]);
          setSubmissions([]);
        }
        setAssignmentDataError(err?.message || 'Đã xảy ra lỗi khi tải danh sách bài được giao.');
      } finally {
        setAssignmentDataLoading(false);
      }
    },
    []
  );

  const retryLoadAssignmentData = useCallback(async () => {
    await loadAssignmentsForSession(userRef.current, currentRoleRef.current);
  }, [loadAssignmentsForSession]);

  const loadStudyMaterialsForSession = useCallback(
    async (explicitUser?: User | null, explicitRole?: UserRole) => {
      if (accessModeRef.current !== 'PRODUCTION_USER') {
        setStudyDocsLoading(false);
        return;
      }
      const activeUser = explicitUser !== undefined ? explicitUser : userRef.current;
      const activeRole = explicitRole || currentRoleRef.current;

      setStudyDocsLoading(true);
      setStudyDocsError(null);

      try {
        if (isSupabaseConfigured && activeUser) {
          const canManage = activeRole === 'teacher' || activeRole === 'admin' || activeRole === 'reviewer';
          const res = await fetchStudyMaterialsFromSupabase(canManage);
          if (res.error || !res.data) {
            setStudyDocs([]);
            setStudyDocsError(res.error || 'Không thể tải danh sách tài liệu học tập từ Supabase.');
            return;
          }
          setStudyDocs(res.data);
          return;
        }

        const localRes = safeReadLocalArray<any>(LOCAL_STUDY_MATERIALS_KEY, INITIAL_STUDY_DOCS);
        if (localRes.error) {
          setStudyDocs([]);
          setStudyDocsError('Không thể đọc danh sách tài liệu học tập đã lưu trên trình duyệt.');
          return;
        }
        setStudyDocs(localRes.data.map(normalizeLegacyStudyDocument));
      } catch (err: any) {
        setStudyDocsError(err?.message || 'Đã xảy ra lỗi khi tải thư viện tài liệu học tập.');
      } finally {
        setStudyDocsLoading(false);
      }
    },
    []
  );

  const retryLoadStudyDocs = useCallback(async () => {
    await loadStudyMaterialsForSession(userRef.current, currentRoleRef.current);
  }, [loadStudyMaterialsForSession]);

  const openStudyMaterialsWithIntent = useCallback((intent: StudyMaterialNavIntent) => {
    setStudyMaterialNavIntent(intent);
    setCurrentView('student_study_materials');
  }, [setCurrentView]);

  const clearStudyMaterialNavIntent = useCallback(() => {
    setStudyMaterialNavIntent(null);
  }, []);

  // Protected Role Setter:
  // Khi đã bật Supabase, vai trò CHỈ lấy từ bảng public.profiles trong cơ sở dữ liệu.
  // Tuyệt đối không cho client tự chuyển hoặc tự nâng quyền.
  const setCurrentRole = useCallback((_newRole: UserRole) => {
    if (user && userProfile) {
      console.warn('Vai trò tài khoản được lấy cố định từ public.profiles:', userProfile.role);
      setCurrentRoleState(userProfile.role);
      return;
    }
    if (isSupabaseConfigured) {
      console.warn('Không thể đổi vai trò ở trình duyệt khi chưa xác thực phiên Supabase.');
      setCurrentRoleState('student');
      return;
    }
    setCurrentRoleState('student');
  }, [user, userProfile]);

  // Giữ ref cho user để tránh làm biến đổi loadProfile reference gây re-render vô tận
  const userRef = useRef<User | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Fetch shared YCCĐ catalog from Supabase (paginated to support > 1,000 rows cleanly)
  const syncYccdCatalogFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const pageSize = 1000;
      let from = 0;
      const remoteRows: YccdItem[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('yccd_catalog')
          .select('*')
          .order('order_index', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          console.warn('Lưu ý khi tải danh mục YCCĐ từ Supabase (dùng bản cục bộ):', error.message);
          return;
        }
        if (!data || data.length === 0) break;

        for (const row of data as any[]) {
          remoteRows.push(
            normalizeYccdItem({
              stableKey: row.stable_key,
              subject: row.subject,
              subjectKey: row.subject_key,
              grade: row.grade,
              topic: row.topic,
              unit: row.unit,
              yccd: row.yccd,
              sourceLabel: row.source_label,
              level: row.level,
              levelLabel: row.level_label,
              topicId: row.topic_id,
              topicShortLabel: row.topic_short_label,
              unitId: row.unit_id,
              yccdId: row.yccd_id,
              competencyCode: row.competency_code || undefined,
              orderIndex: Number(row.order_index ?? 0)
            })
          );
        }

        if (data.length < pageSize) break;
        from += pageSize;
      }

      if (remoteRows.length > 0) {
        const { merged } = mergeYccdCatalog(yccdCatalogRef.current, remoteRows);
        yccdCatalogRef.current = merged;
        setYccdCatalog(merged);
        try {
          localStorage.setItem('taydo_yccd_catalog_v1', JSON.stringify(merged));
        } catch {}
      }
    } catch (err: any) {
      console.warn('Ngoại lệ khi tải danh mục YCCĐ từ Supabase:', err?.message || err);
    }
  }, []);

  // Fetch saved exam_matrices drafts from Supabase for authenticated teachers/admins
  const syncMatricesFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('exam_matrices')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('Lưu ý khi tải hồ sơ ma trận từ Supabase:', error.message);
        return;
      }
      if (!data || data.length === 0) return;

      const remoteMatrices: ExamMatrix[] = (data as any[]).map(row => ({
        id: row.id,
        title: row.title,
        grade: row.grade,
        subject: row.subject,
        period: row.period,
        schoolYear: row.school_year || '2025 - 2026',
        durationMinutes: Number(row.duration_minutes ?? 45),
        totalPoints: Number(row.total_points ?? 10),
        cognitiveRatio: row.cognitive_ratio || { knowPercent: 40, understandPercent: 30, applyPercent: 30 },
        rows: Array.isArray(row.rows) ? row.rows : [],
        draftState: row.matrix_state || undefined,
        updatedAt: row.updated_at || row.created_at,
        authorId: row.created_by || undefined
      }));

      setMatrices(prev => {
        const byId = new Map<string, ExamMatrix>();
        for (const item of prev) byId.set(item.id, item);
        for (const remote of remoteMatrices) {
          const existing = byId.get(remote.id);
          if (!existing) {
            byId.set(remote.id, remote);
          } else {
            const existingTime = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
            const remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
            if (remoteTime >= existingTime) {
              byId.set(remote.id, { ...existing, ...remote });
            }
          }
        }
        const mergedList = Array.from(byId.values()).sort((a, b) => {
          const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
          const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
          return tb - ta;
        });
        try {
          localStorage.setItem('taydo_matrices', JSON.stringify(mergedList));
        } catch {}
        return mergedList;
      });
    } catch (err: any) {
      console.warn('Ngoại lệ khi tải ma trận từ Supabase:', err?.message || err);
    }
  }, []);

  // Load and refresh user profile from Supabase (strictly from public.profiles; never disguise errors)
  const loadProfile = useCallback(async (userId: string, currentUser?: User | null) => {
    setProfileStatus('loading');
    setProfileError(null);

    try {
      const result = await fetchUserProfileDetailed(userId);
      const effectiveUser = currentUser || userRef.current;

      if (result.status === 'found' && result.profile) {
        const prof = result.profile;
        setUserProfile(prof);
        setCurrentRoleState(prof.role);
        setProfileStatus('loaded');
        setProfileError(null);
        setIsDemoMode(false);
        setDbVerified(true);

        if (prof.role !== 'student') {
          syncMatricesFromSupabase();
        }
        await Promise.all([
          loadAssignmentsForSession(effectiveUser || ({ id: userId } as User), prof.role),
          loadStudyMaterialsForSession(effectiveUser || ({ id: userId } as User), prof.role)
        ]);
        return;
      }

      if (result.status === 'error') {
        // Không che giấu lỗi DB / RLS bằng hồ sơ giả
        setUserProfile(null);
        setCurrentRoleState('student');
        setProfileStatus('error');
        setProfileError(result.error || 'Không thể tải hồ sơ và vai trò tài khoản từ bảng public.profiles.');
        setIsDemoMode(false);
        return;
      }

      // result.status === 'not_found': chỉ tạo hồ sơ ban đầu với role='student', sau đó đọc lại từ CSDL để xác nhận
      const fallbackName =
        (typeof effectiveUser?.user_metadata?.full_name === 'string' && effectiveUser.user_metadata.full_name.trim()) ||
        effectiveUser?.email?.split('@')[0] ||
        'Học sinh';
      const fallbackGrade = ['6', '7', '8', '9'].includes(String(effectiveUser?.user_metadata?.grade))
        ? String(effectiveUser?.user_metadata?.grade)
        : '8';

      const { error: upsertErr } = await supabase.from('profiles').upsert(
        {
          id: userId,
          email: effectiveUser?.email || '',
          full_name: fallbackName,
          role: 'student',
          grade: fallbackGrade,
          student_code: effectiveUser?.user_metadata?.student_code || null,
          school_name: 'Trường THCS Tây Đô'
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

      if (upsertErr) {
        setUserProfile(null);
        setCurrentRoleState('student');
        setProfileStatus('error');
        setProfileError(
          `Tài khoản chưa có hồ sơ trên public.profiles và không thể khởi tạo mặc định: ${upsertErr.message}`
        );
        return;
      }

      const recheck = await fetchUserProfileDetailed(userId);
      if (recheck.status === 'found' && recheck.profile) {
        const verifiedProf = recheck.profile;
        setUserProfile(verifiedProf);
        setCurrentRoleState(verifiedProf.role);
        setProfileStatus('loaded');
        setProfileError(null);
        setIsDemoMode(false);
        setDbVerified(true);
        await Promise.all([
          loadAssignmentsForSession(effectiveUser || ({ id: userId } as User), verifiedProf.role),
          loadStudyMaterialsForSession(effectiveUser || ({ id: userId } as User), verifiedProf.role)
        ]);
      } else {
        setUserProfile(null);
        setCurrentRoleState('student');
        setProfileStatus('error');
        setProfileError(
          recheck.error || 'Không tìm thấy bản ghi hồ sơ trong bảng public.profiles sau khi khởi tạo.'
        );
      }
    } catch (err: any) {
      setUserProfile(null);
      setCurrentRoleState('student');
      setProfileStatus('error');
      setProfileError(err?.message || 'Lỗi không xác định khi tải hồ sơ người dùng.');
    }
  }, [syncMatricesFromSupabase, loadAssignmentsForSession, loadStudyMaterialsForSession]);

  const refreshProfile = useCallback(async () => {
    if (userRef.current) {
      await loadProfile(userRef.current.id, userRef.current);
    }
  }, [loadProfile]);

  const retryLoadProfile = refreshProfile;

  // Initialize session, verify Supabase and listen to Auth state changes (SKIPPED COMPLETELY in /demo KHKT sandbox)
  useEffect(() => {
    if (isDemoSandbox) {
      setAuthLoading(false);
      return;
    }

    verifySupabase();

    if (!isSupabaseConfigured) {
      setIsDemoMode(true);
      setAuthLoading(false);
      return;
    }

    syncYccdCatalogFromSupabase();

    const hashParams = typeof window !== 'undefined' ? window.location.hash : '';
    const isInviteOrRecoveryLink =
      hashParams.includes('type=recovery') || hashParams.includes('type=invite');

    let isMounted = true;
    setAuthLoading(true);

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted || accessModeRef.current !== 'PRODUCTION_USER') return;
      if (error) {
        console.warn('Lỗi khôi phục phiên Supabase:', error.message);
        setConnectionError(error.message);
        setAuthLoading(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        setAuthVerified(true);
        if (isInviteOrRecoveryLink || session.user.user_metadata?.must_change_password === true) {
          setAuthModalMode('set_password');
          setAuthModalOpen(true);
        }
        loadProfile(session.user.id, session.user).finally(() => {
          if (isMounted) setAuthLoading(false);
        });
      } else {
        setUser(null);
        setUserProfile(null);
        setCurrentRoleState('student');
        setProfileStatus('idle');
        setProfileError(null);
        setAuthLoading(false);
      }
    }).catch(err => {
      if (isMounted) {
        console.warn('Ngoại lệ khi khôi phục phiên Supabase:', err?.message || err);
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted || accessModeRef.current !== 'PRODUCTION_USER') return;

      if (event === 'PASSWORD_RECOVERY') {
        if (session?.user) {
          setUser(session.user);
          setAuthVerified(true);
          setAccessModeState('PRODUCTION_USER');
          await loadProfile(session.user.id, session.user);
        }
        setAuthModalMode('set_password');
        setAuthModalOpen(true);
        setAuthLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setAuthVerified(true);
        if (session.user.user_metadata?.must_change_password === true) {
          setAuthModalMode('set_password');
          setAuthModalOpen(true);
        }
        await loadProfile(session.user.id, session.user);
        setIsDemoMode(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
        setAuthVerified(false);
        setCurrentRoleState('student');
        setProfileStatus('idle');
        setProfileError(null);
        setIsDemoMode(true);
        await Promise.all([
          loadAssignmentsForSession(null, 'student'),
          loadStudyMaterialsForSession(null, 'student')
        ]);
      }
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isDemoSandbox, loadProfile, loadAssignmentsForSession, loadStudyMaterialsForSession]);

  // Supabase Auth Actions
  const signIn = async (
    identifierRaw: string,
    pass: string
  ): Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }> => {
    setAuthLoading(true);
    setAuthError(null);
    const trimmedIdentifier = String(identifierRaw || '').trim();

    if (isSupabaseConfigured) {
      try {
        // 1. Luồng Học sinh đăng nhập bằng Mã học sinh (không chứa '@')
        if (!trimmedIdentifier.includes('@')) {
          const cleanCode = normalizeStudentCode(trimmedIdentifier);
          if (!isValidStudentCode(cleanCode)) {
            const msg = 'Mã học sinh không hợp lệ (chỉ gồm chữ cái, chữ số, dấu gạch ngang hoặc gạch dưới).';
            setAuthError(msg);
            setAuthLoading(false);
            return { success: false, error: msg };
          }

          try {
            const res = await fetch('/api/auth/student-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentCode: cleanCode,
                password: pass
              })
            });
            const payload = await res.json().catch(() => null);
            const accessToken = payload?.accessToken || payload?.session?.access_token;
            const refreshToken = payload?.refreshToken || payload?.session?.refresh_token;

            if (res.ok && payload?.ok && accessToken && refreshToken) {
              const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });

              if (sessionErr) {
                setAuthError(sessionErr.message);
                setAuthLoading(false);
                return { success: false, error: sessionErr.message };
              }

              const activeUser = sessionData.user || payload.user;
              if (activeUser) {
                setUser(activeUser);
                await loadProfile(activeUser.id, activeUser);
                setAccessModeState('PRODUCTION_USER');
                setIsDemoMode(false);
                if (currentView === 'login_portal') {
                  setCurrentView('dashboard');
                }
                const mustChange = Boolean(
                  payload.mustChangePassword || activeUser.user_metadata?.must_change_password
                );
                if (mustChange) {
                  setAuthModalMode('set_password');
                  setAuthModalOpen(true);
                }
                setAuthLoading(false);
                addAuditLog(
                  'Đăng nhập',
                  `Mã HS: ${cleanCode}`,
                  'Học sinh đăng nhập thành công bằng Mã học sinh'
                );
                return { success: true, mustChangePassword: mustChange };
              }
            }

            if (res.status === 400 || res.status === 401 || res.status === 403) {
              const msg = payload?.message || 'Mã học sinh hoặc mật khẩu không chính xác.';
              setAuthError(msg);
              setAuthLoading(false);
              return { success: false, error: msg };
            }
          } catch {
            // Fallback sang xác thực trực tiếp qua định danh kỹ thuật nội bộ nếu nhánh API tạm thời gián đoạn
          }

          const fallbackEmail = buildStudentInternalAuthEmail(cleanCode);
          const { data: fallbackData, error: fallbackErr } = await supabase.auth.signInWithPassword({
            email: fallbackEmail,
            password: pass
          });

          if (fallbackErr || !fallbackData.user) {
            const msg = 'Mã học sinh hoặc mật khẩu không chính xác.';
            setAuthError(msg);
            setAuthLoading(false);
            return { success: false, error: msg };
          }

          setUser(fallbackData.user);
          await loadProfile(fallbackData.user.id, fallbackData.user);
          setAccessModeState('PRODUCTION_USER');
          setIsDemoMode(false);
          if (currentView === 'login_portal') {
            setCurrentView('dashboard');
          }
          const mustChange = Boolean(fallbackData.user.user_metadata?.must_change_password);
          if (mustChange) {
            setAuthModalMode('set_password');
            setAuthModalOpen(true);
          }
          setAuthLoading(false);
          addAuditLog(
            'Đăng nhập',
            `Mã HS: ${cleanCode}`,
            'Học sinh đăng nhập thành công bằng Mã học sinh'
          );
          return { success: true, mustChangePassword: mustChange };
        }

        // 2. Luồng đăng nhập bằng Email (Giáo viên / Quản trị viên / Học sinh cũ có email)
        const cleanEmail = trimmedIdentifier.toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pass
        });

        if (error) {
          setAuthError(error.message);
          setAuthLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          setUser(data.user);
          await loadProfile(data.user.id, data.user);
          setAccessModeState('PRODUCTION_USER');
          setIsDemoMode(false);
          if (currentView === 'login_portal') {
            setCurrentView('dashboard');
          }
          const mustChange = Boolean(data.user.user_metadata?.must_change_password);
          if (mustChange) {
            setAuthModalMode('set_password');
            setAuthModalOpen(true);
          }
          setAuthLoading(false);
          addAuditLog('Đăng nhập', data.user.email || cleanEmail, 'Đăng nhập thành công vào hệ thống Supabase');
          return { success: true, mustChangePassword: mustChange };
        }

        setAuthLoading(false);
        return { success: false, error: 'Không nhận được thông tin tài khoản.' };
      } catch (err: any) {
        const msg = err?.message || 'Lỗi mạng khi kết nối đăng nhập Supabase.';
        setAuthError(msg);
        setAuthLoading(false);
        return { success: false, error: msg };
      }
    } else {
      // Hỗ trợ đăng nhập tài khoản đã đăng ký trong chế độ cục bộ / trình duyệt
      const savedAccounts = localStorage.getItem('taydo_registered_accounts');
      if (savedAccounts) {
        try {
          const list = JSON.parse(savedAccounts);
          const cleanCode = normalizeStudentCode(trimmedIdentifier);
          const matched = list.find(
            (acc: any) =>
              (acc.email && acc.email.toLowerCase() === trimmedIdentifier.toLowerCase()) ||
              (acc.studentCode && normalizeStudentCode(acc.studentCode) === cleanCode)
          );
          if (matched) {
            if (matched.password && matched.password !== pass) {
              setAuthLoading(false);
              return { success: false, error: 'Mật khẩu không chính xác.' };
            }
            setUserProfile(matched);
            setCurrentRoleState(matched.role);
            setIsDemoMode(true);
            setAuthLoading(false);
            addAuditLog(
              'Đăng nhập',
              trimmedIdentifier,
              `Đăng nhập vai trò ${matched.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}`
            );
            return { success: true };
          }
        } catch {
          // tiếp tục thông báo bên dưới
        }
      }

      setAuthLoading(false);
      return {
        success: false,
        error: 'Chưa cấu hình Supabase URL & Key. Bạn có thể sử dụng chức năng "Đăng ký tài khoản" để tạo tài khoản Học sinh hoặc Giáo viên và kiểm thử ngay trên trình duyệt.'
      };
    }
  };

  const signUp = async (
    email: string,
    pass: string,
    fullName: string,
    role: 'student' | 'teacher' = 'student',
    grade: Grade = '8',
    studentCode?: string,
    subject?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setAuthLoading(true);
    setAuthError(null);

    // 1. Nếu Supabase đã cấu hình, mọi tài khoản tự đăng ký CHỈ nhận vai trò 'student'
    // Quyền giáo viên mới do Quản trị viên cấp qua luồng tin cậy (Quản lý tài khoản)
    if (isSupabaseConfigured) {
      try {
        const assignedCode = studentCode || `HS-${Date.now().toString().slice(-5)}`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: {
              full_name: fullName,
              role: 'student',
              grade: grade,
              student_code: assignedCode,
              school_name: 'Trường THCS Tây Đô'
            }
          }
        });

        if (error) {
          setAuthError(error.message);
          setAuthLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          // Đảm bảo hồ sơ ban đầu trên bảng profiles luôn là 'student'
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              full_name: fullName,
              email: data.user.email || email,
              role: 'student',
              grade: grade,
              student_code: assignedCode,
              subject: null,
              school_name: 'Trường THCS Tây Đô'
            }, { onConflict: 'id', ignoreDuplicates: true });
          } catch (profileErr) {
            console.warn('Lưu phụ trợ vào bảng profiles:', profileErr);
          }

          // Nếu Supabase trả về phiên đăng nhập ngay (Auto-confirm email)
          if (data.session) {
            setUser(data.user);
            setAuthVerified(true);
            await loadProfile(data.user.id, data.user);
            setIsDemoMode(false);
          }
        }

        setAuthLoading(false);
        addAuditLog(
          'Đăng ký tài khoản',
          email,
          `Đăng ký tài khoản thành công cho ${fullName} với vai trò Học sinh`
        );
        return { success: true };
      } catch (err: any) {
        const msg = err?.message || 'Lỗi kết nối khi đăng ký tài khoản lên Supabase.';
        setAuthError(msg);
        setAuthLoading(false);
        return { success: false, error: msg };
      }
    } else {
      // 2. Chế độ cục bộ / Demo (khi chưa cấu hình Supabase URL/Key thật):
      // Lưu vào LocalStorage và áp dụng ngay vai trò Giáo viên hoặc Học sinh để hiển thị đúng các menu
      try {
        const fakeId = `local-${Date.now()}`;
        const newLocalProfile: UserProfile = {
          id: fakeId,
          email,
          fullName,
          role,
          grade: role === 'student' ? grade : undefined,
          studentCode: role === 'student' ? (studentCode || `HS-${Date.now().toString().slice(-5)}`) : undefined,
          schoolName: 'Trường THCS Tây Đô',
          subject: role === 'teacher' ? (subject || 'Toán học') : undefined
        };

        const savedAccounts = localStorage.getItem('taydo_registered_accounts');
        const list = savedAccounts ? JSON.parse(savedAccounts) : [];
        // Cập nhật hoặc thêm mới
        const existingIndex = list.findIndex((a: any) => a.email.toLowerCase() === email.toLowerCase());
        if (existingIndex >= 0) {
          list[existingIndex] = { ...newLocalProfile, password: pass };
        } else {
          list.push({ ...newLocalProfile, password: pass });
        }
        localStorage.setItem('taydo_registered_accounts', JSON.stringify(list));

        // Thiết lập ngay vai trò và hồ sơ tài khoản để giao diện và các menu phản hồi lập tức!
        setUserProfile(newLocalProfile);
        setCurrentRoleState(role);
        setIsDemoMode(true);
        setAuthLoading(false);

        addAuditLog(
          'Đăng ký tài khoản (Cục bộ)',
          email,
          `Khởi tạo tài khoản ${fullName} với vai trò ${role === 'teacher' ? 'Giáo viên' : 'Học sinh'}`
        );
        return { success: true };
      } catch (err: any) {
        setAuthLoading(false);
        return { success: false, error: err?.message || 'Lỗi khi tạo tài khoản cục bộ.' };
      }
    }
  };

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'Vui lòng nhập Email đăng nhập cần khôi phục mật khẩu.' };
    }
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Chức năng gửi email đặt lại mật khẩu chỉ hoạt động khi đã kết nối Supabase Auth.'
      };
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        ...(redirectTo ? { redirectTo } : {})
      });
      setAuthLoading(false);
      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes('smtp') || lower.includes('mail') || lower.includes('rate limit') || lower.includes('sending')) {
          return {
            success: false,
            error:
              `Không thể gửi email đặt lại mật khẩu (${error.message}). ` +
              'Vui lòng kiểm tra cấu hình Authentication → SMTP Settings & URL Configuration (Redirect URLs) trong Supabase Dashboard.'
          };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      setAuthLoading(false);
      return { success: false, error: err?.message || 'Lỗi mạng khi gửi yêu cầu đặt lại mật khẩu.' };
    }
  };

  const updatePasswordForRecovery = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Chưa cấu hình Supabase Auth.' };
    }
    if (newPassword.trim().length < 6) {
      return { success: false, error: 'Mật khẩu mới cần tối thiểu 6 ký tự.' };
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword.trim(),
        data: {
          must_change_password: false,
          password_changed_at: new Date().toISOString()
        }
      });
      if (error) {
        setAuthLoading(false);
        return { success: false, error: error.message };
      }
      if (data.user) {
        setUser(data.user);
        await loadProfile(data.user.id, data.user);
      }
      setAuthLoading(false);
      return { success: true };
    } catch (err: any) {
      setAuthLoading(false);
      return { success: false, error: err?.message || 'Không thể cập nhật mật khẩu mới.' };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured && user) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Lỗi khi đăng xuất:', err);
      }
    }
    try {
      localStorage.removeItem('taydo_active_profile');
    } catch {}
    setUser(null);
    setUserProfile(null);
    setCurrentRoleState('student');
    setProfileStatus('idle');
    setProfileError(null);
    setIsDemoMode(true);
    setAccessModeState('PRODUCTION_USER');
    setCurrentView('dashboard');
    await Promise.all([
      loadAssignmentsForSession(null, 'student'),
      loadStudyMaterialsForSession(null, 'student')
    ]);
    addAuditLog('Đăng xuất', 'Hệ thống', 'Người dùng đã đăng xuất khỏi phiên làm việc');
  };

  const effectiveRole: UserRole = isDemoSandbox ? demoRole : currentRole;
  const effectiveUser = isDemoSandbox ? null : user;
  const effectiveUserProfile = isDemoSandbox
    ? demoRole === 'teacher'
      ? DEMO_TEACHER_PROFILE
      : DEMO_STUDENT_PROFILE
    : userProfile;
  const effectiveQuestions = isDemoSandbox ? demoState.questions : questions;
  const effectiveClasses = isDemoSandbox ? demoState.classes : classes;
  const effectiveMatrices = isDemoSandbox ? demoState.matrices : matrices;
  const effectiveExams = isDemoSandbox ? demoState.exams : exams;
  const effectiveAssignments = isDemoSandbox ? demoState.assignments : assignments;
  const effectiveSubmissions = isDemoSandbox ? demoState.submissions : submissions;
  const effectiveStudyDocs = isDemoSandbox ? demoState.studyDocs : studyDocs;
  const effectiveAuditLogs = isDemoSandbox ? demoState.auditLogs : auditLogs;
  const effectiveTeachingAssignments = isDemoSandbox ? [] : teachingAssignments;
  const effectiveClassRoles = isDemoSandbox ? [] : classRoles;

  const studentUser = isDemoSandbox
    ? {
        id: DEMO_STUDENT_IDENTITY.id,
        code: DEMO_STUDENT_IDENTITY.code,
        fullName: DEMO_STUDENT_IDENTITY.fullName,
        className: DEMO_STUDENT_IDENTITY.className,
        school: DEMO_STUDENT_IDENTITY.school
      }
    : {
        id: userProfile?.id || (user ? user.id : 'stu-01'),
        code: userProfile?.studentCode || 'HS80101',
        fullName: userProfile?.fullName || (currentRole === 'teacher' ? 'Giáo viên' : 'Học sinh'),
        className: userProfile?.grade ? `Lớp ${userProfile.grade}A1` : 'Lớp 8A1',
        school: userProfile?.schoolName || 'Trường THCS Tây Đô'
      };

  // Actions (Strict Demo vs Production isolation)
  const addAuditLog = (action: string, target: string, details: string) => {
    const actorName = effectiveUserProfile?.fullName || (effectiveRole === 'teacher' ? 'Giáo viên' : effectiveRole === 'admin' ? 'Quản trị viên' : studentUser.fullName);
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('vi-VN'),
      actor: actorName,
      role: effectiveRole,
      action,
      target,
      details
    };
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, auditLogs: [newLog, ...prev.auditLogs].slice(0, 200) }));
      return;
    }
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const addQuestion = (q: Question) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép thêm câu hỏi vào ngân hàng.');
      return;
    }
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, questions: [q, ...prev.questions] }));
      addAuditLog('Thêm câu hỏi mới (Demo)', q.code, `Thêm câu hỏi dạng ${q.type} vào Sandbox Demo`);
      return;
    }
    setQuestions(prev => [q, ...prev]);
    addAuditLog('Thêm câu hỏi mới', q.code, `Thêm câu hỏi dạng ${q.type} vào ngân hàng`);
  };

  const updateQuestion = (q: Question) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép cập nhật câu hỏi.');
      return;
    }
    if (isDemoSandbox) {
      setDemoState(prev => ({
        ...prev,
        questions: prev.questions.map(item => (item.id === q.id ? q : item))
      }));
      addAuditLog('Cập nhật câu hỏi (Demo)', q.code, `Cập nhật câu hỏi Demo v${q.version}`);
      return;
    }
    setQuestions(prev => prev.map(item => item.id === q.id ? q : item));
    addAuditLog('Cập nhật câu hỏi', q.code, `Cập nhật nội dung câu hỏi phiên bản v${q.version}`);
  };

  const deleteQuestion = (id: string) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép xóa câu hỏi.');
      return;
    }
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, questions: prev.questions.filter(q => q.id !== id) }));
      return;
    }
    const target = questions.find(q => q.id === id);
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (target) {
      addAuditLog('Xóa câu hỏi', target.code, 'Đã xóa câu hỏi khỏi ngân hàng');
    }
  };

  const approveQuestion = (id: string) => {
    if (isDemoSandbox || (currentRole !== 'admin' && currentRole !== 'reviewer')) {
      console.warn('Truy cập trái quyền: Chỉ Quản trị viên hoặc Người kiểm duyệt trong Không gian Thật mới có quyền duyệt câu hỏi.');
      return;
    }
    setQuestions(prev =>
      prev.map(q => q.id === id ? { ...q, status: 'approved' } : q)
    );
    const target = questions.find(q => q.id === id);
    if (target) {
      addAuditLog('Duyệt câu hỏi', target.code, 'Phê duyệt câu hỏi vào ngân hàng chính thức');
    }
  };

  const importQuestionsBatch = (newQuestions: Partial<Question>[]) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép nhập file câu hỏi.');
      return;
    }
    const formatted: Question[] = newQuestions.map((nq, i) => ({
      id: `q-imp-${Date.now()}-${i}`,
      code: nq.code || `IMP-${Date.now()}-${i}`,
      grade: nq.grade || selectedGrade,
      subject: nq.subject || selectedSubject,
      textbook: nq.textbook || 'Kết nối tri thức',
      chapter: nq.chapter || 'Chương 1',
      lesson: nq.lesson || 'Bài 1',
      yccd: nq.yccd || 'Chuẩn kiến thức GDPT 2018',
      level: nq.level || 'know',
      type: nq.type || 'single_choice',
      stem: nq.stem || 'Nội dung câu hỏi nhập khẩu',
      points: nq.points || 0.25,
      explanation: nq.explanation || 'Lời giải chi tiết',
      status: 'pending',
      author: effectiveUserProfile?.fullName || 'Nhập khẩu từ Excel',
      version: 1,
      options: nq.options || [
        { id: 'opt-a', label: 'A', text: 'Phương án A' },
        { id: 'opt-b', label: 'B', text: 'Phương án B' },
        { id: 'opt-c', label: 'C', text: 'Phương án C' },
        { id: 'opt-d', label: 'D', text: 'Phương án D' }
      ],
      correctAnswer: nq.correctAnswer || 'A'
    }));

    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, questions: [...formatted, ...prev.questions] }));
      addAuditLog('Nhập câu hỏi (Demo)', `${formatted.length} câu`, 'Nhập vào Sandbox Demo cục bộ');
      return;
    }
    setQuestions(prev => [...formatted, ...prev]);
    addAuditLog('Nhập file câu hỏi', `${formatted.length} câu`, 'Nhập hàng loạt câu hỏi từ file');
  };

  const importYccdItems = (incoming: YccdItem[]): { inserted: number; updated: number; unchanged: number } => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép nhập danh mục YCCĐ.');
      return { inserted: 0, updated: 0, unchanged: 0 };
    }
    const normalizedIncoming = incoming.map(normalizeYccdItem);
    const { merged, inserted, updated, unchanged, upsertedItems } = mergeYccdCatalog(
      yccdCatalogRef.current,
      normalizedIncoming
    );
    yccdCatalogRef.current = merged;
    setYccdCatalog(merged);
    if (!isDemoSandbox) {
      try {
        localStorage.setItem('taydo_yccd_catalog_v1', JSON.stringify(merged));
      } catch {}
    }
    addAuditLog(
      'Nhập danh mục YCCĐ',
      `${incoming.length} dòng`,
      `Thêm mới ${inserted}, cập nhật ${updated}, giữ nguyên ${unchanged}`
    );

    if (!isDemoSandbox && isSupabaseConfigured && user && upsertedItems.length > 0) {
      const payload = upsertedItems.map(item => ({
        stable_key: item.stableKey,
        subject: item.subject,
        subject_key: item.subjectKey,
        grade: item.grade,
        topic: item.topic,
        unit: item.unit,
        yccd: item.yccd,
        source_label: item.sourceLabel,
        level: item.level,
        level_label: item.levelLabel,
        topic_id: item.topicId,
        topic_short_label: item.topicShortLabel,
        unit_id: item.unitId,
        yccd_id: item.yccdId,
        competency_code: item.competencyCode || null,
        order_index: item.orderIndex,
        updated_by: user.id
      }));

      (async () => {
        const chunkSize = 200;
        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize);
          const { error } = await supabase.from('yccd_catalog').upsert(chunk, { onConflict: 'stable_key' });
          if (error) {
            console.warn('Đồng bộ YCCĐ lên Supabase (giữ bản cục bộ):', error.message);
            break;
          }
        }
      })();
    }

    return { inserted, updated, unchanged };
  };

  const createMatrix = (matrix: ExamMatrix) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép tạo ma trận đề thi.');
      return;
    }
    const updateList = (prev: ExamMatrix[]) => {
      const idx = prev.findIndex(m => m.id === matrix.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = matrix;
        return next;
      }
      return [matrix, ...prev];
    };
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, matrices: updateList(prev.matrices) }));
      addAuditLog('Tạo ma trận (Demo)', matrix.title, `Ma trận Demo tổng điểm ${matrix.totalPoints}đ`);
      return;
    }
    setMatrices(updateList);
    addAuditLog('Tạo ma trận', matrix.title, `Thiết lập ma trận tổng điểm ${matrix.totalPoints}đ`);
  };

  const saveMatrixDraft = async (
    matrix: ExamMatrix
  ): Promise<{ savedToSupabase: boolean; error?: string }> => {
    if (effectiveRole === 'student') {
      return { savedToSupabase: false, error: 'Học sinh không có quyền lưu ma trận đề.' };
    }
    const enriched: ExamMatrix = {
      ...matrix,
      updatedAt: new Date().toISOString(),
      authorId: isDemoSandbox ? 'demo-teacher-01' : (user?.id || userProfile?.id),
      authorName: effectiveUserProfile?.fullName || matrix.authorName || 'Giáo viên'
    };

    if (isDemoSandbox) {
      setDemoState(prev => {
        const idx = prev.matrices.findIndex(m => m.id === enriched.id);
        const next =
          idx >= 0
            ? prev.matrices.map((item, i) => (i === idx ? enriched : item))
            : [enriched, ...prev.matrices];
        return { ...prev, matrices: next };
      });
      addAuditLog(
        'Lưu bản nháp ma trận (Demo)',
        enriched.title,
        `Tổng ${enriched.totalPoints.toFixed(2)}đ • ${enriched.durationMinutes} phút (chỉ lưu cục bộ Demo)`
      );
      return { savedToSupabase: false };
    }

    setMatrices(prev => {
      const idx = prev.findIndex(m => m.id === enriched.id);
      const next =
        idx >= 0
          ? prev.map((item, i) => (i === idx ? enriched : item))
          : [enriched, ...prev];
      try {
        localStorage.setItem('taydo_matrices', JSON.stringify(next));
      } catch {}
      return next;
    });
    addAuditLog(
      'Lưu bản nháp ma trận',
      enriched.title,
      `Tổng ${enriched.totalPoints.toFixed(2)}đ • ${enriched.durationMinutes} phút`
    );

    if (isSupabaseConfigured && user) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(enriched.id);
      try {
        const rowPayload: Record<string, unknown> = {
          ...(isUuid ? { id: enriched.id } : {}),
          title: enriched.title,
          grade: enriched.grade,
          subject: enriched.subject,
          period: enriched.period,
          school_year: enriched.schoolYear,
          duration_minutes: enriched.durationMinutes,
          total_points: enriched.totalPoints,
          cognitive_ratio: enriched.cognitiveRatio,
          rows: enriched.rows,
          matrix_state: enriched.draftState || null,
          created_by: user.id
        };
        const { error } = isUuid
          ? await supabase.from('exam_matrices').upsert(rowPayload, { onConflict: 'id' })
          : await supabase.from('exam_matrices').insert(rowPayload);
        if (error) {
          console.warn('Lưu ma trận lên Supabase (đã lưu cục bộ):', error.message);
          return { savedToSupabase: false, error: error.message };
        }
        return { savedToSupabase: true };
      } catch (err: any) {
        return { savedToSupabase: false, error: err?.message || 'Lỗi mạng khi đồng bộ Supabase' };
      }
    }

    return { savedToSupabase: false };
  };

  const deleteMatrixDraft = async (matrixId: string): Promise<void> => {
    if (effectiveRole === 'student') return;
    if (isDemoSandbox) {
      setDemoState(prev => ({
        ...prev,
        matrices: prev.matrices.filter(m => m.id !== matrixId)
      }));
      return;
    }
    setMatrices(prev => {
      const next = prev.filter(m => m.id !== matrixId);
      try {
        localStorage.setItem('taydo_matrices', JSON.stringify(next));
      } catch {}
      return next;
    });
    addAuditLog('Xóa bản nháp ma trận', matrixId, 'Đã xóa hồ sơ ma trận khỏi danh sách');
    if (isSupabaseConfigured && user && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(matrixId)) {
      await supabase.from('exam_matrices').delete().eq('id', matrixId);
    }
  };

  const createExam = (exam: Exam) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép tạo đề kiểm tra.');
      return;
    }
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, exams: [exam, ...prev.exams] }));
      addAuditLog('Tạo đề kiểm tra (Demo)', exam.code, `Tạo đề Demo ${exam.code}`);
      return;
    }
    setExams(prev => [exam, ...prev]);
    addAuditLog('Tạo đề kiểm tra', exam.code, `Tạo mã đề ${exam.code} với ${exam.questions.length} câu`);
  };

  const saveExamAsync = async (
    params: Omit<SaveExamDraftParams, 'teacherId' | 'teacherRole' | 'teacherName'>
  ): Promise<{ success: boolean; exam?: Exam; isDemo?: boolean; error?: string }> => {
    if (effectiveRole !== 'teacher' && effectiveRole !== 'admin') {
      return { success: false, error: 'Học sinh không có quyền tạo hoặc lưu đề kiểm tra.' };
    }
    if (!params.newExamDraft.questions || params.newExamDraft.questions.length === 0) {
      return { success: false, error: 'Vui lòng chọn ít nhất 1 câu hỏi vào đề.' };
    }

    if (!isDemoSandbox && isSupabaseConfigured && user) {
      const res = await syncSaveExamOnSupabase({
        ...params,
        teacherId: user.id,
        teacherRole: currentRole,
        teacherName: userProfile?.fullName || 'Giáo viên'
      });
      if (!res.success || !res.exam) {
        return { success: false, error: res.error || 'Không thể lưu đề kiểm tra lên Supabase.' };
      }
      setExams(prev => {
        if (prev.some(e => e.id === res.exam!.id)) return prev;
        return [res.exam!, ...prev];
      });
      addAuditLog(
        'Lưu đề kiểm tra (Supabase)',
        res.exam.code,
        `Lưu đề ${res.exam.title} (Khối ${res.exam.grade}, ${res.exam.subject}) gồm ${res.exam.questionCount ?? res.exam.questions.length} câu`
      );
      return { success: true, exam: res.exam, isDemo: false };
    }

    const currentExamsList = isDemoSandbox ? demoState.exams : exams;
    const existingDemo = currentExamsList.find(e => e.clientRequestId && e.clientRequestId === params.examRequestId);
    if (existingDemo) {
      return { success: true, exam: existingDemo, isDemo: true };
    }

    const demoExam: Exam = {
      id: `demo-exam-${Date.now()}`,
      code: params.newExamDraft.code.trim().toUpperCase(),
      title: params.newExamDraft.title.trim(),
      grade: params.newExamDraft.grade,
      subject: params.newExamDraft.subject,
      period: params.newExamDraft.period,
      durationMinutes: params.newExamDraft.durationMinutes,
      questions: params.newExamDraft.questions,
      lockedQuestionIds: params.newExamDraft.lockedQuestionIds,
      questionCount: params.newExamDraft.questions.length,
      totalPoints: params.newExamDraft.totalPoints,
      createdAt: new Date().toISOString().split('T')[0],
      author: effectiveUserProfile?.fullName || 'Giáo viên Demo',
      clientRequestId: params.examRequestId
    };
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, exams: [demoExam, ...prev.exams] }));
    } else {
      setExams(prev => [demoExam, ...prev]);
    }
    addAuditLog(
      'Lưu đề kiểm tra (Demo)',
      demoExam.code,
      `Lưu đề ${demoExam.title} (Khối ${demoExam.grade}, ${demoExam.subject}) gồm ${demoExam.questions.length} câu`
    );
    return { success: true, exam: demoExam, isDemo: true };
  };

  const createAssignment = (asg: Assignment) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép giao bài kiểm tra.');
      return;
    }
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, assignments: [asg, ...prev.assignments] }));
      return;
    }
    setAssignments(prev => [asg, ...prev]);
    addAuditLog('Giao bài kiểm tra', asg.className, `Giao bài ${asg.examTitle} cho ${asg.className}`);
  };

  const publishExamAssignmentAsync = async (
    params: Omit<PublishExamAssignmentParams, 'teacherId' | 'teacherRole' | 'teacherName'>
  ): Promise<{ success: boolean; exam?: Exam; assignment?: Assignment; isDemo?: boolean; error?: string }> => {
    if (effectiveRole !== 'teacher' && effectiveRole !== 'admin') {
      return { success: false, error: 'Học sinh không có quyền tạo đề hoặc giao bài.' };
    }

    if (!isDemoSandbox && isSupabaseConfigured && user) {
      const res = await syncPublishExamAssignmentOnSupabase({
        ...params,
        teachingAssignments,
        teachingSchemaReady: !teachingSchemaWarning,
        teacherId: user.id,
        teacherRole: currentRole,
        teacherName: userProfile?.fullName || 'Giáo viên'
      });

      if (!res.success || !res.exam || !res.assignment) {
        return { success: false, error: res.error || 'Không thể giao bài lên Supabase.' };
      }

      setExams(prev => {
        if (prev.some(e => e.id === res.exam!.id)) return prev;
        return [res.exam!, ...prev];
      });
      setAssignments(prev => {
        if (prev.some(a => a.id === res.assignment!.id)) return prev;
        return [res.assignment!, ...prev];
      });
      addAuditLog(
        'Giao bài kiểm tra (Supabase)',
        res.assignment.className,
        `Giao bài ${res.assignment.examTitle} (${params.assignmentSettings.roundLabel}) cho ${res.assignment.className}`
      );
      return { success: true, exam: res.exam, assignment: res.assignment, isDemo: false };
    }

    const currentAssignmentsList = isDemoSandbox ? demoState.assignments : assignments;
    const currentExamsList = isDemoSandbox ? demoState.exams : exams;
    const duplicateLocal = currentAssignmentsList.find(a => a.clientRequestId === params.publishRequestId);
    if (duplicateLocal) {
      const existingExamLocal = currentExamsList.find(e => e.id === duplicateLocal.examId);
      return { success: true, exam: existingExamLocal, assignment: duplicateLocal, isDemo: true };
    }

    let resolvedExam = params.existingExam || null;
    if (!resolvedExam && params.newExamDraft) {
      if (params.newExamDraft.questions.length === 0) {
        return { success: false, error: 'Vui lòng chọn ít nhất 1 câu hỏi vào đề.' };
      }
      resolvedExam = {
        id: `demo-exam-${Date.now()}`,
        code: params.newExamDraft.code.trim().toUpperCase(),
        title: params.newExamDraft.title.trim(),
        grade: params.newExamDraft.grade,
        subject: params.newExamDraft.subject,
        period: params.newExamDraft.period,
        durationMinutes: params.newExamDraft.durationMinutes,
        questions: params.newExamDraft.questions,
        questionCount: params.newExamDraft.questions.length,
        totalPoints: params.newExamDraft.totalPoints,
        createdAt: new Date().toISOString().split('T')[0],
        author: effectiveUserProfile?.fullName || 'Giáo viên Demo',
        clientRequestId: params.examRequestId
      };
      if (isDemoSandbox) {
        setDemoState(prev => ({ ...prev, exams: [resolvedExam!, ...prev.exams] }));
      } else {
        setExams(prev => [resolvedExam!, ...prev]);
      }
    }

    if (!resolvedExam) {
      return { success: false, error: 'Không tìm thấy đề thi để giao.' };
    }

    const localAssignment: Assignment = {
      id: `demo-asg-${Date.now()}`,
      examId: resolvedExam.id,
      examTitle: resolvedExam.title,
      classId: params.targetClass.id,
      className: params.targetClass.name,
      grade: resolvedExam.grade,
      subject: resolvedExam.subject,
      openTime: params.assignmentSettings.openTimeIso,
      closeTime: params.assignmentSettings.closeTimeIso,
      durationMinutes: params.assignmentSettings.durationMinutes,
      attemptsAllowed: params.assignmentSettings.attemptsAllowed,
      allowReview: params.assignmentSettings.allowReview,
      showSolutionAfterSubmit: params.assignmentSettings.showSolutionAfterSubmit,
      shuffleQuestions: params.assignmentSettings.shuffleQuestions,
      shuffleOptions: params.assignmentSettings.shuffleOptions,
      isComputerLabMode: params.assignmentSettings.isComputerLabMode,
      status: 'active',
      roundLabel: params.assignmentSettings.roundLabel,
      clientRequestId: params.publishRequestId
    };
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, assignments: [localAssignment, ...prev.assignments] }));
    } else {
      setAssignments(prev => [localAssignment, ...prev]);
    }
    addAuditLog(
      'Giao bài kiểm tra (Demo)',
      localAssignment.className,
      `Giao bài ${localAssignment.examTitle} (${params.assignmentSettings.roundLabel}) cho ${localAssignment.className}`
    );
    return { success: true, exam: resolvedExam, assignment: localAssignment, isDemo: true };
  };

  const submitExamSession = (sub: Submission) => {
    const updateSubs = (prev: Submission[]) => {
      const existing = prev.findIndex(s => s.assignmentId === sub.assignmentId && s.studentId === sub.studentId);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = sub;
        return copy;
      }
      return [sub, ...prev];
    };
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, submissions: updateSubs(prev.submissions) }));
      addAuditLog('Nộp bài kiểm tra (Demo)', sub.examTitle, `Học sinh Demo nộp bài đạt ${sub.score.toFixed(2)}đ`);
      return;
    }
    setSubmissions(updateSubs);
    addAuditLog('Nộp bài kiểm tra', sub.examTitle, `Học sinh ${sub.studentName} nộp bài đạt ${sub.score.toFixed(2)}đ`);
  };

  const gradeEssayQuestion = (submissionId: string, questionId: string, pointsAwarded: number, feedback: string) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép chấm bài tự luận.');
      return;
    }
    const nowIso = new Date().toISOString();
    const applyGrade = (prev: Submission[]) =>
      prev.map(sub => {
        if (sub.id !== submissionId) return sub;
        const currentAns = sub.answers[questionId];
        if (!currentAns) return sub;

        const maxScore = sub.maxScore || 10;
        const clampedPts = Math.max(0, pointsAwarded);
        const updatedAns: SubmissionAnswer = {
          ...currentAns,
          pointsAwarded: clampedPts,
          teacherFeedback: feedback
        };

        const newAnswers = { ...sub.answers, [questionId]: updatedAns };
        const nextGradingDetails = {
          ...(sub.gradingDetails || {}),
          [questionId]: {
            pointsAwarded: clampedPts,
            teacherFeedback: feedback,
            gradedBy: isDemoSandbox ? 'demo-teacher-01' : user?.id,
            gradedAt: nowIso
          }
        };

        const total = Object.values(newAnswers).reduce((sum, a) => sum + (a.pointsAwarded || 0), 0);

        return {
          ...sub,
          answers: newAnswers,
          gradingDetails: nextGradingDetails,
          teacherFeedback: feedback,
          gradedBy: isDemoSandbox ? 'demo-teacher-01' : user?.id,
          gradedAt: nowIso,
          score: Math.min(maxScore, Math.max(0, total)),
          status: 'graded' as const
        };
      });
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, submissions: applyGrade(prev.submissions) }));
      addAuditLog('Chấm bài tự luận (Demo)', submissionId, `Chấm điểm Demo: ${pointsAwarded} điểm`);
      return;
    }
    setSubmissions(applyGrade);
    addAuditLog('Chấm bài tự luận', submissionId, `Chấm điểm câu hỏi tự luận: ${pointsAwarded} điểm`);
  };

  const addClassRoom = (cls: ClassRoom) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép tạo lớp học.');
      return;
    }
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, classes: [cls, ...prev.classes] }));
      return;
    }
    setClasses(prev => [cls, ...prev]);
    addAuditLog('Tạo lớp học', cls.name, `Tạo lớp mới với sĩ số ${cls.studentCount}`);
  };

  const addStudentToClass = (classId: string, student: { id: string; code: string; fullName: string; email: string; gender: 'Nam' | 'Nữ' }) => {
    if (effectiveRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép thêm học sinh vào lớp.');
      return;
    }
    const applyEnroll = (prev: ClassRoom[]) =>
      prev.map(c => {
        if (c.id !== classId) return c;
        return {
          ...c,
          studentCount: c.studentCount + 1,
          students: [...c.students, student]
        };
      });
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, classes: applyEnroll(prev.classes) }));
      return;
    }
    setClasses(applyEnroll);
    addAuditLog('Thêm học sinh', student.fullName, `Thêm vào lớp ${classId}`);
  };

  const createClassRoomAsync = async (params: {
    name: string;
    grade: Grade;
    schoolYear?: string;
  }): Promise<{ success: boolean; classRoom?: ClassRoom; isDemo?: boolean; error?: string }> => {
    if (effectiveRole !== 'teacher' && effectiveRole !== 'admin') {
      return { success: false, error: 'Chỉ Giáo viên hoặc Quản trị viên mới có quyền tạo lớp học.' };
    }
    const cleanName = params.name.trim();
    if (!cleanName) {
      return { success: false, error: 'Vui lòng nhập tên lớp học.' };
    }
    const inviteCode = `TAYDO-${cleanName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()}-${new Date().getFullYear().toString().slice(-2)}${Math.floor(10 + Math.random() * 89)}`;

    if (!isDemoSandbox && isSupabaseConfigured && user) {
      const res = await syncCreateClassOnSupabase({
        name: cleanName,
        grade: params.grade,
        teacherId: user.id,
        teacherName: userProfile?.fullName || 'Giáo viên',
        inviteCode,
        schoolYear: params.schoolYear || '2025-2026'
      });
      if (!res.success || !res.classRoom) {
        return { success: false, error: res.error || 'Không thể tạo lớp trên Supabase.' };
      }
      setClasses(prev => [res.classRoom!, ...prev]);
      addAuditLog('Tạo lớp học (Supabase)', res.classRoom.name, `Tạo lớp ${res.classRoom.name} với mã mời ${res.classRoom.inviteCode}`);
      return { success: true, classRoom: res.classRoom, isDemo: false };
    }

    const demoCls: ClassRoom = {
      id: `demo-cls-${Date.now()}`,
      name: cleanName,
      grade: params.grade,
      teacherName: effectiveUserProfile?.fullName || 'Giáo viên Demo',
      studentCount: 0,
      inviteCode,
      students: []
    };
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, classes: [demoCls, ...prev.classes] }));
    } else {
      setClasses(prev => [demoCls, ...prev]);
    }
    addAuditLog('Tạo lớp học (Demo)', demoCls.name, `Tạo lớp mẫu ${demoCls.name}`);
    return { success: true, classRoom: demoCls, isDemo: true };
  };

  const enrollStudentInClassAsync = async (params: {
    classId: string;
    identifier: string;
    demoFallback?: { code: string; fullName: string; gender: 'Nam' | 'Nữ' };
  }): Promise<{ success: boolean; isDemo?: boolean; error?: string }> => {
    if (effectiveRole !== 'teacher' && effectiveRole !== 'admin') {
      return { success: false, error: 'Chỉ Giáo viên hoặc Quản trị viên mới có quyền thêm học sinh vào lớp.' };
    }

    if (!isDemoSandbox && isSupabaseConfigured && user) {
      const res = await syncEnrollStudentOnSupabase(params.classId, params.identifier);
      if (!res.success || !res.student) {
        return { success: false, error: res.error || 'Không thể thêm học sinh vào lớp trên Supabase.' };
      }
      setClasses(prev =>
        prev.map(c => {
          if (c.id !== params.classId) return c;
          const exists = c.students.some(st => st.id === res.student!.id);
          const nextStudents = exists ? c.students : [...c.students, res.student!];
          return {
            ...c,
            studentCount: nextStudents.length,
            students: nextStudents
          };
        })
      );
      addAuditLog('Thêm học sinh (Supabase)', res.student.fullName, `Liên kết vào lớp ${params.classId}`);
      return { success: true, isDemo: false };
    }

    const fallback = params.demoFallback;
    if (!fallback || !fallback.fullName.trim() || !fallback.code.trim()) {
      return { success: false, error: 'Vui lòng nhập đầy đủ họ tên và mã học sinh.' };
    }
    const cleanCode = fallback.code.trim().toUpperCase();
    const newStu = {
      id: `demo-stu-${Date.now()}`,
      code: cleanCode,
      fullName: fallback.fullName.trim(),
      email: `${cleanCode.toLowerCase()}@demo.taydo.local`,
      gender: fallback.gender
    };
    const applyDemoEnroll = (prev: ClassRoom[]) =>
      prev.map(c => {
        if (c.id !== params.classId) return c;
        const nextStudents = [...c.students, newStu];
        return { ...c, studentCount: nextStudents.length, students: nextStudents };
      });
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, classes: applyDemoEnroll(prev.classes) }));
    } else {
      setClasses(applyDemoEnroll);
    }
    addAuditLog('Thêm học sinh (Demo)', newStu.fullName, `Thêm vào lớp mẫu ${params.classId}`);
    return { success: true, isDemo: true };
  };

  const joinClassByInviteCodeAsync = async (
    inviteCode: string
  ): Promise<{ success: boolean; className?: string; error?: string }> => {
    if (isDemoSandbox || !isSupabaseConfigured || !user) {
      return {
        success: false,
        error: 'Chức năng tham gia lớp qua mã mời thật chỉ hoạt động khi đăng nhập tài khoản Học sinh trong Không gian Chính thức.'
      };
    }
    const res = await syncJoinClassByInviteCode(inviteCode);
    if (!res.success) {
      return { success: false, error: res.error || 'Không thể tham gia lớp học.' };
    }
    await loadAssignmentsForSession(user, currentRole);
    addAuditLog('Tham gia lớp', res.className || inviteCode, 'Học sinh tham gia lớp bằng mã mời');
    return { success: true, className: res.className };
  };

  const saveStudyMaterialAsync = async (
    payload: Omit<SaveStudyMaterialPayload, 'author' | 'authorId'> & { author?: string }
  ): Promise<{ success: boolean; material?: StudyDocument; isDemo?: boolean; error?: string }> => {
    if (effectiveRole !== 'teacher' && effectiveRole !== 'admin') {
      return { success: false, error: 'Chỉ Giáo viên hoặc Quản trị viên mới có quyền quản lý tài liệu.' };
    }

    const cleanTitle = payload.title.trim();
    if (!cleanTitle) {
      return { success: false, error: 'Vui lòng nhập tên tài liệu.' };
    }

    const activeStudyDocs = isDemoSandbox ? demoState.studyDocs : studyDocs;
    const existingDoc =
      payload.existingMaterial ||
      (payload.id ? activeStudyDocs.find(d => d.id === payload.id) || null : null);

    const hasIncomingFile = Boolean(
      payload.selectedFile ||
      (payload.externalFileUrl && payload.externalFileUrl.trim()) ||
      hasValidAttachedFile(existingDoc)
    );

    if (payload.status === 'published' && !hasIncomingFile) {
      return {
        success: false,
        error: 'Vui lòng tải lên tệp tài liệu (PDF, Excel...) hoặc nhập đường dẫn tệp hợp lệ trước khi công bố cho học sinh.'
      };
    }

    const authorName = payload.author?.trim() || effectiveUserProfile?.fullName || 'Giáo viên';

    if (!isDemoSandbox && isSupabaseConfigured && user) {
      const res = await saveStudyMaterialToSupabase({
        ...payload,
        title: cleanTitle,
        author: authorName,
        authorId: user.id,
        existingMaterial: existingDoc
      });

      if (!res.success || !res.material) {
        return { success: false, error: res.error || 'Không thể lưu tài liệu lên Supabase.' };
      }

      setStudyDocs(prev => {
        const idx = prev.findIndex(item => item.id === res.material!.id);
        if (idx >= 0) {
          return prev.map((item, i) => (i === idx ? res.material! : item));
        }
        return [res.material!, ...prev];
      });

      addAuditLog(
        res.material.status === 'published' ? 'Công bố tài liệu học tập' : 'Lưu nháp tài liệu học tập',
        res.material.title,
        `Lưu tài liệu (${res.material.materialType}) lên Supabase`
      );
      return { success: true, material: res.material, isDemo: false };
    }

    // Local / Demo mode fallback (preserve ID and links)
    let fileName = existingDoc?.fileName ?? null;
    let fileFormat = existingDoc?.fileFormat ?? null;
    let fileUrl = existingDoc?.fileUrl ?? null;
    let fileSizeBytes = existingDoc?.fileSizeBytes ?? null;

    if (payload.selectedFile) {
      const f = payload.selectedFile;
      fileName = f.name;
      fileFormat = inferFileFormat(f.name, f.type);
      fileSizeBytes = f.size;

      if (f.size <= 3 * 1024 * 1024) {
        fileUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Không thể đọc tệp vừa chọn.'));
          reader.readAsDataURL(f);
        });
      } else {
        fileUrl = URL.createObjectURL(f);
      }
    } else if (payload.externalFileUrl !== undefined) {
      const trimmedUrl = (payload.externalFileUrl || '').trim();
      if (trimmedUrl) {
        fileUrl = trimmedUrl;
        if (!fileName || trimmedUrl !== existingDoc?.fileUrl) {
          const seg = trimmedUrl.split('?')[0].split('/').pop() || 'tai-lieu';
          fileName = decodeURIComponent(seg);
          fileFormat = inferFileFormat(fileName);
          fileSizeBytes = null;
        }
      }
    }

    const preservedId = existingDoc?.id || payload.id || `demo-doc-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const isLinkedToTerm = payload.materialType === 'de_cuong' || payload.materialType === 'de_tham_khao';
    const isLinkedToLesson = payload.materialType === 'phieu_bai_tap' || payload.materialType === 'tep_thuc_hanh';

    const savedLocal: StudyDocument = {
      id: preservedId,
      title: cleanTitle,
      topic: payload.topic?.trim() || undefined,
      grade: payload.grade,
      subject: payload.subject,
      materialType: payload.materialType,
      examTerm: isLinkedToTerm ? (payload.examTerm || null) : null,
      lessonId: isLinkedToLesson ? (payload.lessonId || null) : null,
      chapterKey: isLinkedToLesson ? (payload.chapterKey || null) : null,
      chapterLabel: isLinkedToLesson ? (payload.chapterLabel || null) : null,
      lessonLabel: isLinkedToLesson ? (payload.lessonLabel || null) : null,
      author: authorName,
      authorId: effectiveUserProfile?.id,
      description: payload.description.trim(),
      usageInstructions: payload.usageInstructions?.trim() || null,
      fileName,
      fileFormat,
      fileUrl,
      storagePath: null,
      fileSizeBytes,
      status: payload.status,
      updatedAt: nowIso,
      createdAt: existingDoc?.createdAt || nowIso
    };

    const nextList = (() => {
      const idx = activeStudyDocs.findIndex(item => item.id === savedLocal.id);
      if (idx >= 0) {
        return activeStudyDocs.map((item, i) => (i === idx ? savedLocal : item));
      }
      return [savedLocal, ...activeStudyDocs];
    })();

    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, studyDocs: nextList }));
      return { success: true, material: savedLocal, isDemo: true };
    }

    setStudyDocs(nextList);
    try {
      const persistable = nextList.map(item =>
        item.fileUrl && item.fileUrl.startsWith('blob:')
          ? { ...item, fileUrl: null }
          : item
      );
      localStorage.setItem(LOCAL_STUDY_MATERIALS_KEY, JSON.stringify(persistable));
    } catch {}

    addAuditLog(
      savedLocal.status === 'published' ? 'Công bố tài liệu (Cục bộ)' : 'Lưu nháp tài liệu (Cục bộ)',
      savedLocal.title,
      `Lưu tài liệu ID ${savedLocal.id}`
    );

    return { success: true, material: savedLocal, isDemo: true };
  };

  const deleteStudyMaterialAsync = async (
    id: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (effectiveRole !== 'teacher' && effectiveRole !== 'admin') {
      return { success: false, error: 'Chỉ Giáo viên hoặc Quản trị viên mới có quyền xóa tài liệu.' };
    }
    const activeStudyDocs = isDemoSandbox ? demoState.studyDocs : studyDocs;
    const target = activeStudyDocs.find(d => d.id === id);
    if (!target) return { success: false, error: 'Không tìm thấy tài liệu cần xóa.' };

    if (!isDemoSandbox && isSupabaseConfigured && user) {
      const res = await deleteStudyMaterialFromSupabase(target);
      if (!res.success) {
        return { success: false, error: res.error || 'Không thể xóa tài liệu trên Supabase.' };
      }
    }

    const nextList = activeStudyDocs.filter(d => d.id !== id);
    if (isDemoSandbox) {
      setDemoState(prev => ({ ...prev, studyDocs: nextList }));
      return { success: true };
    }

    setStudyDocs(nextList);
    if (!isSupabaseConfigured || !user) {
      try {
        localStorage.setItem(LOCAL_STUDY_MATERIALS_KEY, JSON.stringify(nextList));
      } catch {}
    }
    addAuditLog('Xóa tài liệu học tập', target.title, `Đã xóa tài liệu ID ${target.id}`);
    return { success: true };
  };

  const resetDemoData = () => {
    if (isDemoSandbox) {
      resetDemoSandbox();
      return;
    }
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép khôi phục dữ liệu gốc.');
      return;
    }
    localStorage.removeItem('taydo_questions');
    localStorage.removeItem('taydo_classes');
    localStorage.removeItem('taydo_exams');
    localStorage.removeItem('taydo_assignments');
    localStorage.removeItem('taydo_submissions');
    localStorage.removeItem(LOCAL_STUDY_MATERIALS_KEY);
    setQuestions(INITIAL_QUESTIONS);
    setClasses(INITIAL_CLASSES);
    setMatrices(INITIAL_MATRICES);
    setExams(INITIAL_EXAMS);
    setAssignments(INITIAL_ASSIGNMENTS);
    setSubmissions(INITIAL_SUBMISSIONS);
    setStudyDocs(INITIAL_STUDY_DOCS);
  };

  return (
    <AppContext.Provider
      value={{
        accessMode,
        setAccessMode,
        isDemoSandbox,
        demoRole,
        setDemoRole,
        demoResetVersion,
        enterKhktDemo,
        exitDemoToRealLogin,
        enterPublicGuest,
        enterDemoRole,
        enterKhktShowcase,
        exitDemoToWorkspace,
        resetDemoSandbox,
        reducedMotion,
        setReducedMotion,
        coreKnowledgeTargetLessonId,
        openCoreKnowledgeLesson,
        clearCoreKnowledgeTargetLesson,
        preferredDemoAssignmentId,
        setPreferredDemoAssignmentId,
        khktPresentationStep,
        setKhktPresentationStep,
        currentRole: effectiveRole,
        setCurrentRole,
        isDemoMode: isDemoSandbox ? true : isDemoMode,
        setIsDemoMode,
        isSupabaseLiveConfigured: isDemoSandbox ? false : isSupabaseConfigured,
        supabaseStatus,
        supabaseStatusLabel,
        authVerified,
        dbVerified,
        connectionError,
        verifySupabase,
        supabaseConfig,
        setSupabaseConfig,
        user: effectiveUser,
        userProfile: effectiveUserProfile,
        authenticatedProdUser: isDemoSandbox ? null : user,
        authenticatedProdProfile: isDemoSandbox ? null : userProfile,
        authenticatedProdRole: isDemoSandbox ? 'student' : currentRole,
        profileStatus: isDemoSandbox ? 'idle' : profileStatus,
        profileError: isDemoSandbox ? null : profileError,
        retryLoadProfile,
        authLoading: isDemoSandbox ? false : authLoading,
        authError,
        authModalOpen,
        setAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        openAuthModal,
        signIn,
        signUp,
        requestPasswordReset,
        updatePasswordForRecovery,
        signOut,
        refreshProfile,
        selectedGrade,
        setSelectedGrade,
        selectedSubject,
        setSelectedSubject,
        selectedPeriod,
        setSelectedPeriod,
        currentView,
        setCurrentView,
        questions: effectiveQuestions,
        classes: effectiveClasses,
        enrolledClassIds: isDemoSandbox ? demoState.classes.map(c => c.id) : enrolledClassIds,
        matrices: effectiveMatrices,
        exams: effectiveExams,
        assignments: effectiveAssignments,
        teachingAssignments: effectiveTeachingAssignments,
        classRoles: effectiveClassRoles,
        submissions: effectiveSubmissions,
        assignmentDataLoading: isDemoSandbox ? false : assignmentDataLoading,
        assignmentDataError: isDemoSandbox ? null : assignmentDataError,
        teachingSchemaWarning: isDemoSandbox ? null : teachingSchemaWarning,
        isUsingDemoAssignmentsData,
        retryLoadAssignmentData,
        geminiAssistants,
        studyDocs: effectiveStudyDocs,
        studyDocsLoading: isDemoSandbox ? false : studyDocsLoading,
        studyDocsError: isDemoSandbox ? null : studyDocsError,
        retryLoadStudyDocs,
        studyMaterialNavIntent,
        openStudyMaterialsWithIntent,
        clearStudyMaterialNavIntent,
        saveStudyMaterialAsync,
        deleteStudyMaterialAsync,
        auditLogs: effectiveAuditLogs,
        yccdCatalog,
        pendingMatrixPrompt,
        setPendingMatrixPrompt,
        studentUser,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        approveQuestion,
        importQuestionsBatch,
        importYccdItems,
        createMatrix,
        saveMatrixDraft,
        deleteMatrixDraft,
        createExam,
        saveExamAsync,
        createAssignment,
        publishExamAssignmentAsync,
        submitExamSession,
        gradeEssayQuestion,
        addClassRoom,
        addStudentToClass,
        createClassRoomAsync,
        enrollStudentInClassAsync,
        joinClassByInviteCodeAsync,
        addAuditLog,
        resetDemoData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
