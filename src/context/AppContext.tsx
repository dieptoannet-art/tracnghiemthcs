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
  SubmissionAnswer,
  UserProfile,
  SupabaseConnectionState,
  YccdItem
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
  fetchUserProfile,
  testSupabaseConnection,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from '../lib/supabase';

interface AppContextType {
  // Mode & Auth
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
  authLoading: boolean;
  authError: string | null;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register';
  setAuthModalMode: (mode: 'login' | 'register') => void;
  openAuthModal: (mode?: 'login' | 'register') => void;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    role: 'student' | 'teacher',
    grade?: Grade,
    studentCode?: string,
    subject?: string
  ) => Promise<{ success: boolean; error?: string }>;
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

  // Data Collections (Currently local / cached)
  questions: Question[];
  classes: ClassRoom[];
  matrices: ExamMatrix[];
  exams: Exam[];
  assignments: Assignment[];
  submissions: Submission[];
  geminiAssistants: GeminiAssistantConfig[];
  studyDocs: StudyDocument[];
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
  createAssignment: (asg: Assignment) => void;
  submitExamSession: (submission: Submission) => void;
  gradeEssayQuestion: (submissionId: string, questionId: string, pointsAwarded: number, feedback: string) => void;
  addClassRoom: (cls: ClassRoom) => void;
  addStudentToClass: (classId: string, student: { id: string; code: string; fullName: string; email: string; gender: 'Nam' | 'Nữ' }) => void;
  addAuditLog: (action: string, target: string, details: string) => void;
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Mode & Auth States
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);

  // Khôi phục hồ sơ đã lưu hoặc mặc định tài khoản Giáo viên GV. Diệp Thanh Toàn
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('taydo_active_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.fullName && parsed.fullName.includes('Diệp Thanh Toàn')) {
          parsed.fullName = 'GV. Diệp Thanh Toàn';
        }
        return parsed;
      }
    } catch {}
    return {
      id: 'teacher-dieptoan',
      email: 'dieptoan.net@gmail.com',
      fullName: 'GV. Diệp Thanh Toàn',
      role: 'teacher',
      subject: 'Tin học',
      schoolName: 'Trường THCS Tây Đô'
    };
  });

  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('taydo_active_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.role) return parsed.role;
      }
    } catch {}
    return 'teacher';
  });

  // Supabase Auth & Verification States
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
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

  const [selectedGrade, setSelectedGrade] = useState<Grade>('8');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('math');
  const [selectedPeriod, setSelectedPeriod] = useState<ExamPeriod>('mid1');
  const [currentView, setCurrentView] = useState<string>('dashboard');

  // Local storage collections for business logic
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('taydo_questions');
    return saved ? JSON.parse(saved) : INITIAL_QUESTIONS;
  });

  const [classes, setClasses] = useState<ClassRoom[]>(() => {
    const saved = localStorage.getItem('taydo_classes');
    return saved ? JSON.parse(saved) : INITIAL_CLASSES;
  });

  const [matrices, setMatrices] = useState<ExamMatrix[]>(() => {
    const saved = localStorage.getItem('taydo_matrices');
    return saved ? JSON.parse(saved) : INITIAL_MATRICES;
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem('taydo_exams');
    return saved ? JSON.parse(saved) : INITIAL_EXAMS;
  });

  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = localStorage.getItem('taydo_assignments');
    return saved ? JSON.parse(saved) : INITIAL_ASSIGNMENTS;
  });

  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    const saved = localStorage.getItem('taydo_submissions');
    return saved ? JSON.parse(saved) : INITIAL_SUBMISSIONS;
  });

  const [geminiAssistants] = useState<GeminiAssistantConfig[]>(INITIAL_GEMINI_ASSISTANTS);
  const [studyDocs] = useState<StudyDocument[]>(INITIAL_STUDY_DOCS);
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

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('taydo_questions', JSON.stringify(questions));
  }, [questions]);

  useEffect(() => {
    localStorage.setItem('taydo_classes', JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem('taydo_matrices', JSON.stringify(matrices));
  }, [matrices]);

  useEffect(() => {
    localStorage.setItem('taydo_yccd_catalog_v1', JSON.stringify(yccdCatalog));
  }, [yccdCatalog]);

  useEffect(() => {
    localStorage.setItem('taydo_exams', JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem('taydo_assignments', JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem('taydo_submissions', JSON.stringify(submissions));
  }, [submissions]);

  // Protected Role Setter:
  // Nguồn vai trò lấy từ hồ sơ CSDL Supabase khi đã đăng nhập hoặc mặc định an toàn là 'student'.
  // Tuyệt đối không mặc định là Quản trị và không cho phép tự nâng quyền!
  const setCurrentRole = useCallback((newRole: UserRole) => {
    // Nếu người dùng đã đăng nhập, vai trò bắt buộc theo hồ sơ cơ sở dữ liệu, không thể tự đổi ở client
    if (user && userProfile) {
      console.warn('Không thể tự thay đổi vai trò. Vai trò được bảo vệ theo hồ sơ CSDL:', userProfile.role);
      setCurrentRoleState(userProfile.role);
      return;
    }

    // Chặn tự nâng quyền: Tài khoản ở vai trò Học sinh KHÔNG ĐƯỢC tự nâng lên Giáo viên hoặc Quản trị
    if (currentRole === 'student' && newRole !== 'student') {
      console.warn('Từ chối thao tác: Học sinh không được phép tự nâng quyền thành Giáo viên hoặc Quản trị viên.');
      return;
    }

    // Chỉ cho phép chuyển vai trò nếu tài khoản hiện tại có quyền Quản trị viên (để xem thử góc nhìn)
    if (currentRole === 'admin') {
      setCurrentRoleState(newRole);
      return;
    }

    // Mặc định luôn giữ vai trò Học sinh an toàn
    setCurrentRoleState('student');
  }, [user, userProfile, currentRole]);

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

  // Load and refresh user profile from Supabase
  const loadProfile = useCallback(async (userId: string, currentUser?: User | null) => {
    try {
      const prof = await fetchUserProfile(userId);
      if (prof) {
        setUserProfile(prof);
        setCurrentRoleState(prof.role);
        setIsDemoMode(false);
        setDbVerified(true); // Đã truy vấn thành công bảng CSDL profiles
        try {
          localStorage.setItem('taydo_active_profile', JSON.stringify(prof));
        } catch {}
        if (prof.role !== 'student') {
          syncMatricesFromSupabase();
        }
      } else {
        const effectiveUser = currentUser || userRef.current;
        // Đọc vai trò được chọn từ user_metadata khi đăng ký (teacher hoặc student)
        const userEmail = effectiveUser?.email?.toLowerCase() || '';
        const isKnownTeacher = userEmail.includes('dieptoan') || userEmail.includes('giaovien');
        const metaRole = (effectiveUser?.user_metadata?.role as UserRole) || (isKnownTeacher ? 'teacher' : 'student');
        const defaultProf: UserProfile = {
          id: userId,
          email: effectiveUser?.email || '',
          fullName: effectiveUser?.user_metadata?.full_name || effectiveUser?.email?.split('@')[0] || (metaRole === 'teacher' ? 'Thầy Cô Giáo' : 'Học sinh'),
          role: metaRole === 'teacher' ? 'teacher' : 'student',
          grade: effectiveUser?.user_metadata?.grade || '8',
          schoolName: effectiveUser?.user_metadata?.school_name || 'Trường THCS Tây Đô',
          subject: effectiveUser?.user_metadata?.subject || (metaRole === 'teacher' ? 'Tin học' : undefined)
        };
        setUserProfile(defaultProf);
        setCurrentRoleState(defaultProf.role);
        setIsDemoMode(false);
        try {
          localStorage.setItem('taydo_active_profile', JSON.stringify(defaultProf));
        } catch {}

        // Tự động đảm bảo bản ghi tồn tại trong bảng public.profiles để thỏa mãn RLS Supabase
        try {
          await supabase.from('profiles').upsert({
            id: userId,
            email: defaultProf.email,
            full_name: defaultProf.fullName,
            role: defaultProf.role,
            school_name: defaultProf.schoolName,
            subject: defaultProf.subject
          }, { onConflict: 'id', ignoreDuplicates: true });
        } catch (upsertErr) {
          console.warn('Lưu ý khi tạo hồ sơ ban đầu trên Supabase:', upsertErr);
        }
        if (defaultProf.role !== 'student') {
          syncMatricesFromSupabase();
        }
      }
    } catch (err) {
      console.warn('Lỗi khi nạp hồ sơ người dùng:', err);
    }
  }, [syncMatricesFromSupabase]);

  const refreshProfile = useCallback(async () => {
    if (userRef.current) {
      await loadProfile(userRef.current.id, userRef.current);
    }
  }, [loadProfile]);

  // Initialize session, verify Supabase and listen to Auth state changes (chạy một lần khi mount)
  useEffect(() => {
    // 0. Tự động kiểm tra và xác thực kết nối Supabase CSDL ngay khi khởi chạy
    verifySupabase();

    if (!isSupabaseConfigured) {
      setIsDemoMode(true);
      return;
    }

    syncYccdCatalogFromSupabase();

    let isMounted = true;
    setAuthLoading(true);

    // 1. Restore existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('Lỗi khôi phục phiên Supabase:', error.message);
        setConnectionError(error.message);
        setAuthLoading(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        setAuthVerified(true); // Đã có phiên xác thực Auth thực tế
        loadProfile(session.user.id, session.user).finally(() => {
          if (isMounted) setAuthLoading(false);
        });
      } else {
        setAuthLoading(false);
      }
    }).catch(err => {
      if (isMounted) {
        console.warn('Ngoại lệ khi khôi phục phiên Supabase:', err?.message || err);
        setAuthLoading(false);
      }
    });

    // 2. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setAuthVerified(true);
        await loadProfile(session.user.id, session.user);
        setIsDemoMode(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
        setAuthVerified(false);
        setCurrentRoleState('student');
        setIsDemoMode(true);
      }
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Supabase Auth Actions
  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setAuthLoading(true);
    setAuthError(null);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
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
          setIsDemoMode(false);
          setAuthLoading(false);
          addAuditLog('Đăng nhập', data.user.email || '', 'Đăng nhập thành công vào hệ thống Supabase');
          return { success: true };
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
          const matched = list.find((acc: any) => acc.email.toLowerCase() === email.toLowerCase());
          if (matched) {
            if (matched.password && matched.password !== pass) {
              setAuthLoading(false);
              return { success: false, error: 'Mật khẩu không chính xác.' };
            }
            setUserProfile(matched);
            setCurrentRoleState(matched.role);
            setIsDemoMode(true);
            setAuthLoading(false);
            addAuditLog('Đăng nhập', email, `Đăng nhập vai trò ${matched.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}`);
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

    // 1. Nếu Supabase đã cấu hình, lưu trực tiếp vào Supabase Auth & CSDL profiles
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: {
              full_name: fullName,
              role: role,
              grade: role === 'student' ? grade : undefined,
              student_code: role === 'student' ? (studentCode || `HS-${Date.now().toString().slice(-5)}`) : undefined,
              subject: role === 'teacher' ? (subject || 'Toán học') : undefined,
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
          // Lưu trực tiếp vào bảng profiles trên Supabase để đảm bảo dữ liệu phân quyền luôn được ghi nhận
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              full_name: fullName,
              email: data.user.email || email,
              role: role,
              grade: role === 'student' ? grade : null,
              student_code: role === 'student' ? (studentCode || `HS-${Date.now().toString().slice(-5)}`) : null,
              subject: role === 'teacher' ? (subject || 'Toán học') : null,
              school_name: 'Trường THCS Tây Đô'
            });
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
          `Đăng ký tài khoản thành công cho ${fullName} với vai trò ${role === 'teacher' ? 'Giáo viên' : 'Học sinh'}`
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
    setIsDemoMode(true);
    addAuditLog('Đăng xuất', 'Hệ thống', 'Người dùng đã đăng xuất khỏi phiên làm việc');
  };

  // Student Profile representation
  const studentUser = {
    id: userProfile?.id || (user ? user.id : 'stu-01'),
    code: userProfile?.studentCode || 'HS80101',
    fullName: userProfile?.fullName || (currentRole === 'teacher' ? 'Thầy Diệp Thanh Toàn' : 'Nguyễn Văn An'),
    className: userProfile?.grade ? `Lớp ${userProfile.grade}A1` : 'Lớp 8A1',
    school: userProfile?.schoolName || 'Trường THCS Tây Đô'
  };

  // Actions
  const addAuditLog = (action: string, target: string, details: string) => {
    const actorName = userProfile?.fullName || (currentRole === 'teacher' ? 'Thầy Diệp Thanh Toàn' : currentRole === 'admin' ? 'Quản trị viên' : studentUser.fullName);
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('vi-VN'),
      actor: actorName,
      role: currentRole,
      action,
      target,
      details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const addQuestion = (q: Question) => {
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép thêm câu hỏi vào ngân hàng.');
      return;
    }
    setQuestions(prev => [q, ...prev]);
    addAuditLog('Thêm câu hỏi mới', q.code, `Thêm câu hỏi dạng ${q.type} vào ngân hàng`);
  };

  const updateQuestion = (q: Question) => {
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép cập nhật câu hỏi.');
      return;
    }
    setQuestions(prev => prev.map(item => item.id === q.id ? q : item));
    addAuditLog('Cập nhật câu hỏi', q.code, `Cập nhật nội dung câu hỏi phiên bản v${q.version}`);
  };

  const deleteQuestion = (id: string) => {
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép xóa câu hỏi.');
      return;
    }
    const target = questions.find(q => q.id === id);
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (target) {
      addAuditLog('Xóa câu hỏi', target.code, 'Đã xóa câu hỏi khỏi ngân hàng');
    }
  };

  const approveQuestion = (id: string) => {
    if (currentRole !== 'admin' && currentRole !== 'reviewer') {
      console.warn('Truy cập trái quyền: Chỉ Quản trị viên hoặc Người kiểm duyệt mới có quyền duyệt câu hỏi.');
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
    if (currentRole === 'student') {
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
      author: userProfile?.fullName || 'Nhập khẩu từ Excel',
      version: 1,
      options: nq.options || [
        { id: 'opt-a', label: 'A', text: 'Phương án A' },
        { id: 'opt-b', label: 'B', text: 'Phương án B' },
        { id: 'opt-c', label: 'C', text: 'Phương án C' },
        { id: 'opt-d', label: 'D', text: 'Phương án D' }
      ],
      correctAnswer: nq.correctAnswer || 'A'
    }));

    setQuestions(prev => [...formatted, ...prev]);
    addAuditLog('Nhập file câu hỏi', `${formatted.length} câu`, 'Nhập hàng loạt câu hỏi từ file');
  };

  const importYccdItems = (incoming: YccdItem[]): { inserted: number; updated: number; unchanged: number } => {
    if (currentRole === 'student') {
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
    try {
      localStorage.setItem('taydo_yccd_catalog_v1', JSON.stringify(merged));
    } catch {}
    addAuditLog(
      'Nhập danh mục YCCĐ',
      `${incoming.length} dòng`,
      `Thêm mới ${inserted}, cập nhật ${updated}, giữ nguyên ${unchanged}`
    );

    if (isSupabaseConfigured && user && upsertedItems.length > 0) {
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
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép tạo ma trận đề thi.');
      return;
    }
    setMatrices(prev => {
      const idx = prev.findIndex(m => m.id === matrix.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = matrix;
        return next;
      }
      return [matrix, ...prev];
    });
    addAuditLog('Tạo ma trận', matrix.title, `Thiết lập ma trận tổng điểm ${matrix.totalPoints}đ`);
  };

  const saveMatrixDraft = async (
    matrix: ExamMatrix
  ): Promise<{ savedToSupabase: boolean; error?: string }> => {
    if (currentRole === 'student') {
      return { savedToSupabase: false, error: 'Học sinh không có quyền lưu ma trận đề.' };
    }
    const enriched: ExamMatrix = {
      ...matrix,
      updatedAt: new Date().toISOString(),
      authorId: user?.id || userProfile?.id,
      authorName: userProfile?.fullName || matrix.authorName || 'GV. Diệp Thanh Toàn'
    };

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
    if (currentRole === 'student') return;
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
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép tạo đề kiểm tra.');
      return;
    }
    setExams(prev => [exam, ...prev]);
    addAuditLog('Tạo đề kiểm tra', exam.code, `Tạo mã đề ${exam.code} với ${exam.questions.length} câu`);
  };

  const createAssignment = (asg: Assignment) => {
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép giao bài kiểm tra.');
      return;
    }
    setAssignments(prev => [asg, ...prev]);
    addAuditLog('Giao bài kiểm tra', asg.className, `Giao bài ${asg.examTitle} cho ${asg.className}`);
  };

  const submitExamSession = (sub: Submission) => {
    setSubmissions(prev => {
      const existing = prev.findIndex(s => s.assignmentId === sub.assignmentId && s.studentId === sub.studentId);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = sub;
        return copy;
      }
      return [sub, ...prev];
    });
    addAuditLog('Nộp bài kiểm tra', sub.examTitle, `Học sinh ${sub.studentName} nộp bài đạt ${sub.score.toFixed(2)}đ`);
  };

  const gradeEssayQuestion = (submissionId: string, questionId: string, pointsAwarded: number, feedback: string) => {
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép chấm bài tự luận.');
      return;
    }
    setSubmissions(prev =>
      prev.map(sub => {
        if (sub.id !== submissionId) return sub;
        const currentAns = sub.answers[questionId];
        if (!currentAns) return sub;

        const updatedAns: SubmissionAnswer = {
          ...currentAns,
          pointsAwarded,
          teacherFeedback: feedback
        };

        const newAnswers = { ...sub.answers, [questionId]: updatedAns };
        const total = Object.values(newAnswers).reduce((sum, a) => sum + (a.pointsAwarded || 0), 0);

        return {
          ...sub,
          answers: newAnswers,
          score: Math.min(10, total),
          status: 'graded'
        };
      })
    );
    addAuditLog('Chấm bài tự luận', submissionId, `Chấm điểm câu hỏi tự luận: ${pointsAwarded} điểm`);
  };

  const addClassRoom = (cls: ClassRoom) => {
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép tạo lớp học.');
      return;
    }
    setClasses(prev => [cls, ...prev]);
    addAuditLog('Tạo lớp học', cls.name, `Tạo lớp mới với sĩ số ${cls.studentCount}`);
  };

  const addStudentToClass = (classId: string, student: { id: string; code: string; fullName: string; email: string; gender: 'Nam' | 'Nữ' }) => {
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép thêm học sinh vào lớp.');
      return;
    }
    setClasses(prev =>
      prev.map(c => {
        if (c.id !== classId) return c;
        return {
          ...c,
          studentCount: c.studentCount + 1,
          students: [...c.students, student]
        };
      })
    );
    addAuditLog('Thêm học sinh', student.fullName, `Thêm vào lớp ${classId}`);
  };

  const resetDemoData = () => {
    if (currentRole === 'student') {
      console.warn('Truy cập trái quyền: Học sinh không được phép khôi phục dữ liệu gốc.');
      return;
    }
    localStorage.removeItem('taydo_questions');
    localStorage.removeItem('taydo_classes');
    localStorage.removeItem('taydo_exams');
    localStorage.removeItem('taydo_assignments');
    localStorage.removeItem('taydo_submissions');
    setQuestions(INITIAL_QUESTIONS);
    setClasses(INITIAL_CLASSES);
    setMatrices(INITIAL_MATRICES);
    setExams(INITIAL_EXAMS);
    setAssignments(INITIAL_ASSIGNMENTS);
    setSubmissions(INITIAL_SUBMISSIONS);
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        isDemoMode,
        setIsDemoMode,
        isSupabaseLiveConfigured: isSupabaseConfigured,
        supabaseStatus,
        supabaseStatusLabel,
        authVerified,
        dbVerified,
        connectionError,
        verifySupabase,
        supabaseConfig,
        setSupabaseConfig,
        user,
        userProfile,
        authLoading,
        authError,
        authModalOpen,
        setAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        openAuthModal,
        signIn,
        signUp,
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
        questions,
        classes,
        matrices,
        exams,
        assignments,
        submissions,
        geminiAssistants,
        studyDocs,
        auditLogs,
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
        createAssignment,
        submitExamSession,
        gradeEssayQuestion,
        addClassRoom,
        addStudentToClass,
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
