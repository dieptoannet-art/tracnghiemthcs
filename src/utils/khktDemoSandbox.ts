import {
  Assignment,
  AuditLog,
  ClassRoom,
  Exam,
  ExamMatrix,
  ExamPeriod,
  Grade,
  Question,
  StudyDocument,
  SubjectId,
  Submission,
  UserProfile,
  UserRole,
} from '../types';
import {
  INITIAL_EXAMS,
  INITIAL_MATRICES,
  INITIAL_QUESTIONS,
} from '../data/mockData';

export const KHKT_DEMO_STORAGE_PREFIX = 'taydo_khkt_demo_v1_';

export const KHKT_DEMO_KEYS = {
  STATE: `${KHKT_DEMO_STORAGE_PREFIX}state`,
  META: `${KHKT_DEMO_STORAGE_PREFIX}meta`,
  RECENT_CORE_LESSON: `${KHKT_DEMO_STORAGE_PREFIX}recent_core_lesson`,
  GAME_GUEST_SESSION: `${KHKT_DEMO_STORAGE_PREFIX}game_guest_session`,
  GAME_GUEST_HISTORY: `${KHKT_DEMO_STORAGE_PREFIX}game_guest_history`,
  GAME_MODE_PREF: `${KHKT_DEMO_STORAGE_PREFIX}game_mode_pref`,
  GAME_FAVORITES: `${KHKT_DEMO_STORAGE_PREFIX}game_favorites`,
  GAME_CALL_PREFIX: `${KHKT_DEMO_STORAGE_PREFIX}call_game_`,
  EXAM_DRAFT_PREFIX: `${KHKT_DEMO_STORAGE_PREFIX}exam_draft_`,
} as const;

export type DemoWorkspaceRole = 'teacher' | 'student';

export interface KhktDemoWorkspaceState {
  version: number;
  questions: Question[];
  classes: ClassRoom[];
  matrices: ExamMatrix[];
  exams: Exam[];
  assignments: Assignment[];
  submissions: Submission[];
  studyDocs: StudyDocument[];
  auditLogs: AuditLog[];
}

export interface KhktDemoMeta {
  view: string;
  demoRole: DemoWorkspaceRole;
  selectedGrade: Grade;
  selectedSubject: SubjectId;
  selectedPeriod: ExamPeriod;
  updatedAt: string;
}

export const DEMO_STUDENT_IDENTITY = {
  id: 'demo-hs-khkt-01',
  code: 'DEMO8A01',
  fullName: 'Khách trải nghiệm (Học sinh Demo)',
  email: 'hocsinh.demo@sandbox.local',
  className: 'Lớp 8A1 (Demo KHKT)',
  school: 'Trường THCS Tây Đô (Bản demo KHKT)',
} as const;

export const DEMO_TEACHER_PROFILE: UserProfile = {
  id: 'demo-gv-khkt-01',
  email: 'giaovien.demo@sandbox.local',
  fullName: 'Khách trải nghiệm KHKT',
  role: 'teacher',
  teacherCode: 'GV-DEMO-KHKT',
  schoolName: 'Trường THCS Tây Đô (Bản demo KHKT)',
  subject: 'Toán - Tin học',
};

export const DEMO_STUDENT_PROFILE: UserProfile = {
  id: DEMO_STUDENT_IDENTITY.id,
  email: DEMO_STUDENT_IDENTITY.email,
  fullName: DEMO_STUDENT_IDENTITY.fullName,
  role: 'student',
  grade: '8',
  studentCode: DEMO_STUDENT_IDENTITY.code,
  schoolName: DEMO_STUDENT_IDENTITY.school,
};

export interface StorageLike {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isDemoPathname(pathname: string): boolean {
  const normalized = (pathname || '').trim().toLowerCase();
  return normalized === '/demo' || normalized.startsWith('/demo/');
}

export function isKhktDemoRuntime(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  return isDemoPathname(window.location.pathname);
}

export const PROTECTED_TEACHER_VIEWS = new Set<string>([
  'teacher_lectures',
  'teacher_classes',
  'teacher_tools',
  'teacher_question_bank',
  'teacher_create_exam',
  'teacher_matrix',
  'teacher_grading',
  'teacher_gemini',
]);

export const PROTECTED_ADMIN_VIEWS = new Set<string>([
  'admin_accounts',
  'admin_curriculum',
  'admin_approval',
  'admin_settings',
]);

export function sanitizeDemoView(view: string): string {
  if (!view || view === 'login_portal' || PROTECTED_ADMIN_VIEWS.has(view) || view.startsWith('admin_')) {
    return 'dashboard';
  }
  return view;
}

export function resolveRouteLocation(
  pathname: string,
  search: string = ''
): { isDemo: boolean; view: string; isDirectProtectedPath: boolean } {
  const isDemo = isDemoPathname(pathname);
  const params = new URLSearchParams(search || '');
  const viewParam = params.get('view') || '';
  const lectureParam = params.get('lecture') || '';
  const cleanPath = (pathname || '/').trim().toLowerCase();

  if (isDemo) {
    let rawView = viewParam;
    if (!rawView && lectureParam) {
      rawView = 'teacher_lectures';
    }
    if (!rawView) {
      const subPath = cleanPath.replace(/^\/demo\/?/, '');
      if (subPath === 'bai-giang' || subPath === 'lectures') rawView = 'teacher_lectures';
      else if (subPath === 'kien-thuc' || subPath === 'core-knowledge') rawView = 'student_core_knowledge';
      else if (subPath === 'tro-choi' || subPath === 'games') rawView = 'teacher_student_call';
      else if (subPath === 'cong-cu-day-hoc' || subPath === 'teaching-tools') rawView = 'teacher_tools';
      else if (subPath === 'kiem-tra' || subPath === 'exam') rawView = 'student_assignments';
      else if (subPath === 'math-lab') rawView = 'math_lab';
      else rawView = 'dashboard';
    }
    return {
      isDemo: true,
      view: sanitizeDemoView(rawView),
      isDirectProtectedPath: false,
    };
  }

  // Real production paths outside /demo
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    const adminView = viewParam && viewParam.startsWith('admin_') ? viewParam : 'admin_accounts';
    return { isDemo: false, view: adminView, isDirectProtectedPath: true };
  }

  if (cleanPath === '/teacher' || cleanPath.startsWith('/teacher/')) {
    const teacherView =
      viewParam && viewParam.startsWith('teacher_') && viewParam !== 'teacher_student_call'
        ? viewParam
        : 'teacher_classes';
    return { isDemo: false, view: teacherView, isDirectProtectedPath: true };
  }

  if (viewParam) {
    const isProtected =
      PROTECTED_ADMIN_VIEWS.has(viewParam) ||
      viewParam.startsWith('admin_') ||
      PROTECTED_TEACHER_VIEWS.has(viewParam);
    return { isDemo: false, view: viewParam, isDirectProtectedPath: isProtected };
  }

  if (lectureParam) {
    return { isDemo: false, view: 'teacher_lectures', isDirectProtectedPath: true };
  }

  return { isDemo: false, view: 'dashboard', isDirectProtectedPath: false };
}

export function buildNavigationUrl(
  view: string,
  currentHref: string = '/',
  isDemo: boolean = false
): string {
  const safeView = isDemo ? sanitizeDemoView(view) : view;
  const targetPath = isDemo ? '/demo' : '/';

  try {
    const currentUrl = new URL(currentHref, 'http://localhost');
    const nextParams = new URLSearchParams();

    if (safeView !== 'dashboard') {
      nextParams.set('view', safeView);
    }

    if (safeView === 'teacher_lectures') {
      const lecture = currentUrl.searchParams.get('lecture');
      const mode = currentUrl.searchParams.get('mode');
      if (lecture) nextParams.set('lecture', lecture);
      if (mode) nextParams.set('mode', mode);
    }

    const qs = nextParams.toString();
    return qs ? `${targetPath}?${qs}` : targetPath;
  } catch {
    return safeView === 'dashboard' ? targetPath : `${targetPath}?view=${encodeURIComponent(safeView)}`;
  }
}

export interface ProductionRouteGuardInput {
  isDemoSandbox: boolean;
  currentView: string;
  pathname: string;
  search: string;
  isAuthenticated: boolean;
  authenticatedRole: UserRole;
}

export interface ProductionRouteGuardResult {
  allowed: boolean;
  reason?: 'unauthenticated' | 'insufficient_role';
  requiredLabel?: string;
}

/**
 * Enforces strict authentication & role guards on real teacher/admin routes outside /demo.
 * Keeps public homepage (/), student practice/core-knowledge, and public EDU Game Center intact.
 */
export function evaluateProductionRouteAccess(
  input: ProductionRouteGuardInput
): ProductionRouteGuardResult {
  if (input.isDemoSandbox) {
    if (PROTECTED_ADMIN_VIEWS.has(input.currentView) || input.currentView.startsWith('admin_')) {
      return {
        allowed: false,
        reason: 'insufficient_role',
        requiredLabel: 'Quản trị viên (chỉ khả dụng ở hệ thống chính thức)',
      };
    }
    return { allowed: true };
  }

  const cleanPath = (input.pathname || '/').trim().toLowerCase();
  const isAdminRoute =
    PROTECTED_ADMIN_VIEWS.has(input.currentView) ||
    input.currentView.startsWith('admin_') ||
    cleanPath === '/admin' ||
    cleanPath.startsWith('/admin/');

  if (isAdminRoute) {
    if (!input.isAuthenticated) {
      return {
        allowed: false,
        reason: 'unauthenticated',
        requiredLabel: 'Quản trị viên hệ thống',
      };
    }
    const isApprovalOnly = input.currentView === 'admin_approval';
    const hasAdminRole = isApprovalOnly
      ? input.authenticatedRole === 'admin' || input.authenticatedRole === 'reviewer'
      : input.authenticatedRole === 'admin';
    if (!hasAdminRole) {
      return {
        allowed: false,
        reason: 'insufficient_role',
        requiredLabel: isApprovalOnly ? 'Quản trị viên hoặc Kiểm duyệt viên' : 'Quản trị viên hệ thống',
      };
    }
    return { allowed: true };
  }

  const isTeacherRoute =
    PROTECTED_TEACHER_VIEWS.has(input.currentView) ||
    cleanPath === '/teacher' ||
    cleanPath.startsWith('/teacher/');

  if (isTeacherRoute) {
    if (!input.isAuthenticated) {
      return {
        allowed: false,
        reason: 'unauthenticated',
        requiredLabel: 'Giáo viên hoặc Quản trị viên',
      };
    }

    // Authenticated students may open integrated 3D lessons in explicit student self-study mode
    if (input.currentView === 'teacher_lectures' && input.authenticatedRole === 'student') {
      const params = new URLSearchParams(input.search || '');
      if (params.get('mode') === 'student' && Boolean(params.get('lecture'))) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'insufficient_role',
        requiredLabel: 'Giáo viên',
      };
    }

    const hasTeacherRole =
      input.authenticatedRole === 'teacher' ||
      input.authenticatedRole === 'admin' ||
      input.authenticatedRole === 'reviewer';

    if (!hasTeacherRole) {
      return {
        allowed: false,
        reason: 'insufficient_role',
        requiredLabel: 'Giáo viên hoặc Quản trị viên',
      };
    }
  }

  return { allowed: true };
}

function generateDemoClassStudents(
  prefix: string,
  count: number,
  includeDemoGuestStudent: boolean
): ClassRoom['students'] {
  const lastNames = [
    'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ',
    'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý',
  ];
  const maleMiddles = ['Văn', 'Minh', 'Hoàng', 'Quốc', 'Gia', 'Đức', 'Tuấn', 'Hữu'];
  const femaleMiddles = ['Thị', 'Ngọc', 'Thanh', 'Phương', 'Thùy', 'Khánh', 'Bảo', 'Mai'];
  const maleNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Hải', 'Hiếu', 'Hùng', 'Khang', 'Khoa', 'Long', 'Nam', 'Phát', 'Phúc', 'Quân', 'Quang', 'Sơn', 'Thịnh', 'Trí', 'Tuấn'];
  const femaleNames = ['Anh', 'Bích', 'Châu', 'Duyên', 'Giang', 'Hà', 'Hân', 'Hương', 'Lan', 'Linh', 'Mai', 'My', 'Ngân', 'Ngọc', 'Nhi', 'Phương', 'Quỳnh', 'Thảo', 'Thư', 'Trang', 'Uyên', 'Vân', 'Vy', 'Yến'];

  const list: ClassRoom['students'] = [];
  if (includeDemoGuestStudent) {
    list.push({
      id: DEMO_STUDENT_IDENTITY.id,
      code: DEMO_STUDENT_IDENTITY.code,
      fullName: DEMO_STUDENT_IDENTITY.fullName,
      email: DEMO_STUDENT_IDENTITY.email,
      gender: 'Nam',
    });
  }

  const startIdx = includeDemoGuestStudent ? 1 : 0;
  for (let i = startIdx; i < count; i++) {
    const isMale = i % 2 === 0;
    const ln = lastNames[i % lastNames.length];
    const mn = isMale
      ? maleMiddles[(i * 3) % maleMiddles.length]
      : femaleMiddles[(i * 3) % femaleMiddles.length];
    const fn = isMale
      ? maleNames[(i * 5) % maleNames.length]
      : femaleNames[(i * 5) % femaleNames.length];
    const stt = String(i + 1).padStart(2, '0');
    list.push({
      id: `demo-stu-${prefix}-${stt}`,
      code: `DEMO${prefix.toUpperCase()}${stt}`,
      fullName: `${ln} ${mn} ${fn}`,
      email: `hs.${prefix}.${stt}@demo.sandbox.local`,
      gender: isMale ? 'Nam' : 'Nữ',
    });
  }
  return list;
}

function encodeDemoDocDataUrl(title: string, lines: string[]): string {
  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:28px auto;padding:24px;color:#0f2d52;line-height:1.65;background:#f8fbff}h1{font-size:22px;color:#1769f4;margin-bottom:8px}.tag{display:inline-block;padding:4px 10px;border-radius:8px;background:#fef3c7;color:#92400e;font-weight:700;font-size:12px;margin-bottom:14px}.card{background:#fff;border:1px solid #dbeafe;border-radius:14px;padding:18px;margin-top:12px}li{margin:6px 0}</style></head><body><span class="tag">BẢN DEMO KHKT · HỌC LIỆU MẪU CỤC BỘ</span><h1>${title}</h1><div class="card"><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul></div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export function createFreshKhktDemoState(): KhktDemoWorkspaceState {
  // Deep clone questions with isolated demo IDs and keep mapping for exams/submissions
  const idMap = new Map<string, string>();
  const demoQuestions: Question[] = INITIAL_QUESTIONS.map((q) => {
    const demoId = `demo-${q.id}`;
    idMap.set(q.id, demoId);
    return {
      ...q,
      id: demoId,
      options: q.options ? q.options.map(o => ({ ...o })) : undefined,
      subItems: q.subItems ? q.subItems.map(s => ({ ...s })) : undefined,
      acceptedAnswers: q.acceptedAnswers ? [...q.acceptedAnswers] : undefined,
      rubric: q.rubric ? q.rubric.map(r => ({ ...r })) : undefined,
    };
  });

  const findDemoQ = (origId: string): Question | undefined =>
    demoQuestions.find(q => q.id === idMap.get(origId));

  const math8Qs = ['q-t8-01', 'q-t8-02', 'q-t8-03', 'q-t8-04', 'q-t8-05']
    .map(findDemoQ)
    .filter((q): q is Question => Boolean(q));

  const tin8Qs = ['q-tin8-01', 'q-tin8-02', 'q-tin8-03', 'q-tin8-04']
    .map(findDemoQ)
    .filter((q): q is Question => Boolean(q));

  const math9Qs = ['q-t9-01', 'q-t9-02', 'q-t9-03', 'q-t9-04']
    .map(findDemoQ)
    .filter((q): q is Question => Boolean(q));

  const students8A1 = generateDemoClassStudents('8a1', 50, true);
  const students9A1 = generateDemoClassStudents('9a1', 35, false);
  const students6A1 = generateDemoClassStudents('6a1', 32, false);

  const demoClasses: ClassRoom[] = [
    {
      id: 'demo-cls-8a1',
      name: 'Lớp 8A1 (Demo KHKT)',
      grade: '8',
      teacherName: 'Giáo viên Demo KHKT',
      studentCount: students8A1.length,
      inviteCode: 'DEMO-8A1-KHKT',
      students: students8A1,
    },
    {
      id: 'demo-cls-9a1',
      name: 'Lớp 9A1 (Demo KHKT)',
      grade: '9',
      teacherName: 'Giáo viên Demo KHKT',
      studentCount: students9A1.length,
      inviteCode: 'DEMO-9A1-KHKT',
      students: students9A1,
    },
    {
      id: 'demo-cls-6a1',
      name: 'Lớp 6A1 (Demo KHKT)',
      grade: '6',
      teacherName: 'Giáo viên Demo KHKT',
      studentCount: students6A1.length,
      inviteCode: 'DEMO-6A1-KHKT',
      students: students6A1,
    },
  ];

  const demoMatrices: ExamMatrix[] = INITIAL_MATRICES.map((m) => ({
    ...m,
    id: `demo-${m.id}`,
    title: `${m.title} [Mẫu KHKT]`,
    cognitiveRatio: { ...m.cognitiveRatio },
    rows: m.rows.map(r => ({ ...r })),
  }));

  const demoExams: Exam[] = [
    {
      ...INITIAL_EXAMS[0],
      id: 'demo-exam-toan8-gk1',
      code: 'DEMO-101 · TOÁN 8',
      title: 'Bài kiểm tra mẫu Toán 8 – Đa thức & Tứ giác (Bản demo KHKT)',
      author: 'Giáo viên Demo KHKT',
      createdAt: '2026-11-01',
      questions: math8Qs.length > 0 ? math8Qs : demoQuestions.slice(0, 5),
      questionCount: math8Qs.length > 0 ? math8Qs.length : 5,
    },
    {
      ...INITIAL_EXAMS[1],
      id: 'demo-exam-tin8-gk1',
      code: 'DEMO-102 · TIN HỌC 8',
      title: 'Bài kiểm tra mẫu Tin học 8 – Bảng tính & Thuật toán (Bản demo KHKT)',
      author: 'Giáo viên Demo KHKT',
      createdAt: '2026-11-02',
      questions: tin8Qs.length > 0 ? tin8Qs : demoQuestions.slice(0, 4),
      questionCount: tin8Qs.length > 0 ? tin8Qs.length : 4,
    },
    {
      id: 'demo-exam-toan9-c1',
      code: 'DEMO-103 · TOÁN 9',
      title: 'Bài kiểm tra nhanh Toán 9 – Hệ phương trình & Căn bậc hai (Bản demo KHKT)',
      grade: '9',
      subject: 'math',
      period: 'mid1',
      durationMinutes: 30,
      totalPoints: 10.0,
      author: 'Giáo viên Demo KHKT',
      createdAt: '2026-11-05',
      questions: math9Qs.length > 0 ? math9Qs : demoQuestions.slice(0, 4),
      questionCount: math9Qs.length > 0 ? math9Qs.length : 4,
    },
  ];

  // Use a far-future closeTime so KHKT demo assignments are always active & ready to take
  const demoAssignments: Assignment[] = [
    {
      id: 'demo-asg-toan8-01',
      examId: 'demo-exam-toan8-gk1',
      examTitle: 'Kiểm tra mẫu Toán 8 – Đa thức & Hình bình hành (Bản demo KHKT)',
      classId: 'demo-cls-8a1',
      className: 'Lớp 8A1 (Demo KHKT)',
      grade: '8',
      subject: 'math',
      openTime: '2026-01-01 07:00',
      closeTime: '2099-12-31 23:59',
      durationMinutes: 30,
      attemptsAllowed: 5,
      allowReview: true,
      showSolutionAfterSubmit: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      isComputerLabMode: false,
      status: 'active',
    },
    {
      id: 'demo-asg-tin8-02',
      examId: 'demo-exam-tin8-gk1',
      examTitle: 'Kiểm tra mẫu Tin học 8 – Bảng tính & An toàn mạng (Bản demo KHKT)',
      classId: 'demo-cls-8a1',
      className: 'Lớp 8A1 (Demo KHKT)',
      grade: '8',
      subject: 'informatics',
      openTime: '2026-01-01 07:00',
      closeTime: '2099-12-31 23:59',
      durationMinutes: 25,
      attemptsAllowed: 5,
      allowReview: true,
      showSolutionAfterSubmit: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      isComputerLabMode: true,
      status: 'active',
    },
    {
      id: 'demo-asg-toan9-03',
      examId: 'demo-exam-toan9-c1',
      examTitle: 'Ôn tập mẫu Toán 9 – Hệ hai phương trình bậc nhất hai ẩn',
      classId: 'demo-cls-9a1',
      className: 'Lớp 9A1 (Demo KHKT)',
      grade: '9',
      subject: 'math',
      openTime: '2026-01-01 07:00',
      closeTime: '2099-12-31 23:59',
      durationMinutes: 30,
      attemptsAllowed: 5,
      allowReview: true,
      showSolutionAfterSubmit: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      isComputerLabMode: false,
      status: 'active',
    },
  ];

  // Sample submissions:
  // 1) A pending essay submission from a sample demo classmate so Teacher Grading works immediately
  // 2) A historical graded submission from a sample demo classmate for analytics
  const sampleStudent2 = students8A1[1];
  const sampleStudent3 = students8A1[2];

  const demoSubmissions: Submission[] = [
    {
      id: 'demo-sub-01',
      assignmentId: 'demo-asg-toan8-01',
      examId: 'demo-exam-toan8-gk1',
      examTitle: 'Kiểm tra mẫu Toán 8 – Đa thức & Hình bình hành (Bản demo KHKT)',
      studentId: sampleStudent2?.id || 'demo-stu-8a1-02',
      studentName: sampleStudent2?.fullName || 'Trần Ngọc Anh (Mẫu)',
      studentClass: 'Lớp 8A1 (Demo KHKT)',
      grade: '8',
      subject: 'math',
      startTime: '2026-11-10 08:00',
      submittedAt: '2026-11-10 08:22',
      timeSpentSeconds: 1320,
      status: 'submitted',
      score: 2.0,
      maxScore: 4.0,
      tabSwitchCount: 0,
      answers: {
        'demo-q-t8-01': {
          questionId: 'demo-q-t8-01',
          questionType: 'single_choice',
          selectedOption: 'A',
          isCorrect: true,
          pointsAwarded: 0.25,
        },
        'demo-q-t8-02': {
          questionId: 'demo-q-t8-02',
          questionType: 'single_choice',
          selectedOption: 'A',
          isCorrect: true,
          pointsAwarded: 0.25,
        },
        'demo-q-t8-03': {
          questionId: 'demo-q-t8-03',
          questionType: 'true_false_group',
          trueFalseAnswers: { 'sub-1': true, 'sub-2': true, 'sub-3': true, 'sub-4': false },
          isCorrect: true,
          pointsAwarded: 1.0,
        },
        'demo-q-t8-04': {
          questionId: 'demo-q-t8-04',
          questionType: 'short_answer',
          shortAnswerText: '4',
          isCorrect: true,
          pointsAwarded: 0.5,
        },
        'demo-q-t8-05': {
          questionId: 'demo-q-t8-05',
          questionType: 'essay',
          essayAnswerText:
            'a) Xét tứ giác ADME có MD // AE và ME // AD (giả thiết) nên ADME là hình bình hành.\nb) Vì tam giác ABC cân tại A nên góc B = góc C. Lại có MD // AC nên góc DMB = góc C (đồng vị), suy ra góc B = góc DMB nên tam giác MBD cân tại D.',
          pointsAwarded: 0,
        },
      },
    },
    {
      id: 'demo-sub-02',
      assignmentId: 'demo-asg-tin8-02',
      examId: 'demo-exam-tin8-gk1',
      examTitle: 'Kiểm tra mẫu Tin học 8 – Bảng tính & An toàn mạng (Bản demo KHKT)',
      studentId: sampleStudent3?.id || 'demo-stu-8a1-03',
      studentName: sampleStudent3?.fullName || 'Lê Văn Bình (Mẫu)',
      studentClass: 'Lớp 8A1 (Demo KHKT)',
      grade: '8',
      subject: 'informatics',
      startTime: '2026-11-11 09:00',
      submittedAt: '2026-11-11 09:18',
      timeSpentSeconds: 1080,
      status: 'graded',
      score: 1.75,
      maxScore: 2.0,
      tabSwitchCount: 0,
      teacherFeedback: 'Nắm vững hàm COUNTIF và nguyên tắc an toàn thông tin (Dữ liệu mẫu KHKT).',
      answers: {
        'demo-q-tin8-01': {
          questionId: 'demo-q-tin8-01',
          questionType: 'single_choice',
          selectedOption: 'A',
          isCorrect: true,
          pointsAwarded: 0.25,
        },
        'demo-q-tin8-02': {
          questionId: 'demo-q-tin8-02',
          questionType: 'single_choice',
          selectedOption: 'B',
          isCorrect: false,
          pointsAwarded: 0,
        },
        'demo-q-tin8-03': {
          questionId: 'demo-q-tin8-03',
          questionType: 'true_false_group',
          trueFalseAnswers: { 'tin-sub-1': true, 'tin-sub-2': false, 'tin-sub-3': false, 'tin-sub-4': true },
          isCorrect: true,
          pointsAwarded: 1.0,
        },
        'demo-q-tin8-04': {
          questionId: 'demo-q-tin8-04',
          questionType: 'short_answer',
          shortAnswerText: '20',
          isCorrect: true,
          pointsAwarded: 0.5,
        },
      },
    },
  ];

  const demoStudyDocs: StudyDocument[] = [
    {
      id: 'demo-doc-01',
      title: 'Đề cương ôn tập mẫu Giữa kỳ I – Toán 8 (Bản demo KHKT)',
      topic: 'Đa thức nhiều biến, Hằng đẳng thức & Hình bình hành',
      grade: '8',
      subject: 'math',
      materialType: 'de_cuong',
      examTerm: 'mid1',
      author: 'Tổ Toán THCS Tây Đô (Mẫu KHKT)',
      description: 'Tài liệu mẫu cục bộ giúp khách tham quan KHKT trải nghiệm bộ lọc, xem trước và tải về mà không truy cập kho lưu trữ thật.',
      fileName: 'De_cuong_Toan8_Demo_KHKT.html',
      fileFormat: 'HTML',
      fileUrl: encodeDemoDocDataUrl('Đề cương ôn tập mẫu Giữa kỳ I – Toán 8', [
        'Chủ đề 1: Đơn thức và đa thức nhiều biến – thu gọn, tìm bậc, cộng trừ nhân đa thức.',
        'Chủ đề 2: 7 hằng đẳng thức đáng nhớ và ứng dụng phân tích đa thức thành nhân tử.',
        'Chủ đề 3: Tứ giác, hình thang cân, hình bình hành và dấu hiệu nhận biết.',
      ]),
      storagePath: null,
      fileSizeBytes: 2480,
      status: 'published',
      updatedAt: '2026-11-10T08:00:00.000Z',
    },
    {
      id: 'demo-doc-02',
      title: 'Phiếu bài tập mẫu Toán 9 – Giải hệ hai phương trình bậc nhất hai ẩn',
      topic: 'Phương pháp thế & phương pháp cộng đại số',
      grade: '9',
      subject: 'math',
      materialType: 'phieu_bai_tap',
      lessonId: 'toan_9_c1_b2',
      chapterKey: '1_Chương I. Phương trình và hệ hai phương trình bậc nhất hai ẩn',
      chapterLabel: 'Chương I. Phương trình và hệ hai phương trình bậc nhất hai ẩn',
      lessonLabel: 'Bài 2. Giải hệ hai phương trình bậc nhất hai ẩn',
      author: 'Tổ Toán THCS Tây Đô (Mẫu KHKT)',
      description: 'Phiếu bài tập minh họa đồng bộ với Bài 2 Toán 9 trong kho Bài giảng 3D.',
      fileName: 'Phieu_bai_tap_Toan9_Bai2_Demo.html',
      fileFormat: 'HTML',
      fileUrl: encodeDemoDocDataUrl('Phiếu bài tập mẫu Toán 9 – Bài 2', [
        'Bài 1: Giải hệ phương trình bằng phương pháp thế: 2x - y = 3 và x + 2y = 4.',
        'Bài 2: Giải hệ phương trình bằng phương pháp cộng đại số: 3x + 2y = 7 và 2x - 3y = -4.',
        'Bài 3: Giải bài toán thực tế về vườn cải bắp bằng cách lập hệ phương trình.',
      ]),
      storagePath: null,
      fileSizeBytes: 2150,
      status: 'published',
      updatedAt: '2026-11-12T08:00:00.000Z',
    },
    {
      id: 'demo-doc-03',
      title: 'Sổ tay hàm bảng tính & an toàn mạng – Tin học 8 (Mẫu KHKT)',
      topic: 'Hàm COUNTIF, SUMIF và quy tắc an toàn không gian mạng',
      grade: '8',
      subject: 'informatics',
      materialType: 'so_tay',
      author: 'Tổ Tin học THCS Tây Đô (Mẫu KHKT)',
      description: 'Sổ tay tra cứu nhanh cú pháp bảng tính và tình huống bảo mật 2FA trong bản demo KHKT.',
      fileName: 'So_tay_Tin8_Demo_KHKT.html',
      fileFormat: 'HTML',
      fileUrl: encodeDemoDocDataUrl('Sổ tay Tin học 8 – Bản demo KHKT', [
        'COUNTIF(range, criteria): Đếm số ô thỏa mãn điều kiện trong vùng dữ liệu.',
        'SUMIF(range, criteria, [sum_range]): Tính tổng các ô thỏa mãn điều kiện.',
        'An toàn mạng: Không chia sẻ mã OTP, bật xác thực 2 lớp (2FA), đặt mật khẩu mạnh.',
      ]),
      storagePath: null,
      fileSizeBytes: 1980,
      status: 'published',
      updatedAt: '2026-11-14T08:00:00.000Z',
    },
  ];

  const demoAuditLogs: AuditLog[] = [
    {
      id: 'demo-log-01',
      timestamp: 'Bản demo KHKT',
      actor: 'Hệ thống Demo KHKT',
      role: 'teacher',
      action: 'Khởi tạo dữ liệu mẫu',
      target: 'Sandbox cục bộ',
      details: 'Đã nạp bộ dữ liệu mẫu tách biệt (3 lớp, 3 đề kiểm tra, 50 học sinh mẫu) trên trình duyệt.',
    },
  ];

  return {
    version: 1,
    questions: demoQuestions,
    classes: demoClasses,
    matrices: demoMatrices,
    exams: demoExams,
    assignments: demoAssignments,
    submissions: demoSubmissions,
    studyDocs: demoStudyDocs,
    auditLogs: demoAuditLogs,
  };
}

export function loadKhktDemoState(storage: StorageLike | null = getDefaultStorage()): KhktDemoWorkspaceState {
  if (storage) {
    try {
      const raw = storage.getItem(KHKT_DEMO_KEYS.STATE);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<KhktDemoWorkspaceState>;
        if (
          parsed &&
          parsed.version === 1 &&
          Array.isArray(parsed.questions) &&
          Array.isArray(parsed.classes) &&
          Array.isArray(parsed.exams) &&
          Array.isArray(parsed.assignments)
        ) {
          return {
            version: 1,
            questions: parsed.questions,
            classes: parsed.classes,
            matrices: Array.isArray(parsed.matrices) ? parsed.matrices : [],
            exams: parsed.exams,
            assignments: parsed.assignments,
            submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
            studyDocs: Array.isArray(parsed.studyDocs) ? parsed.studyDocs : [],
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          };
        }
      }
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }
  const fresh = createFreshKhktDemoState();
  saveKhktDemoState(fresh, storage);
  return fresh;
}

export function saveKhktDemoState(
  state: KhktDemoWorkspaceState,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  if (!storage) return false;
  try {
    const persistableDocs = (state.studyDocs || []).map(doc =>
      doc.fileUrl && doc.fileUrl.startsWith('blob:') ? { ...doc, fileUrl: null } : doc
    );
    storage.setItem(
      KHKT_DEMO_KEYS.STATE,
      JSON.stringify({
        ...state,
        studyDocs: persistableDocs,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function getDefaultKhktDemoMeta(): KhktDemoMeta {
  return {
    view: 'dashboard',
    demoRole: 'teacher',
    selectedGrade: '8',
    selectedSubject: 'math',
    selectedPeriod: 'mid1',
    updatedAt: new Date().toISOString(),
  };
}

export function loadKhktDemoMeta(storage: StorageLike | null = getDefaultStorage()): KhktDemoMeta {
  const defaults = getDefaultKhktDemoMeta();
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(KHKT_DEMO_KEYS.META);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<KhktDemoMeta>;
    return {
      view: sanitizeDemoView(parsed.view || 'dashboard'),
      demoRole: parsed.demoRole === 'student' ? 'student' : 'teacher',
      selectedGrade: (['6', '7', '8', '9'].includes(String(parsed.selectedGrade))
        ? parsed.selectedGrade
        : '8') as Grade,
      selectedSubject: (parsed.selectedSubject || 'math') as SubjectId,
      selectedPeriod: (parsed.selectedPeriod || 'mid1') as ExamPeriod,
      updatedAt: parsed.updatedAt || defaults.updatedAt,
    };
  } catch {
    return defaults;
  }
}

export function saveKhktDemoMeta(
  meta: KhktDemoMeta,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      KHKT_DEMO_KEYS.META,
      JSON.stringify({
        ...meta,
        view: sanitizeDemoView(meta.view),
        updatedAt: new Date().toISOString(),
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears ONLY isolated KHKT demo keys (prefixed with taydo_khkt_demo_v1_).
 * Real production storage keys and Supabase sessions are NEVER touched.
 */
export function clearAllKhktDemoStorage(storage: StorageLike | null = getDefaultStorage()): number {
  if (!storage) return 0;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(KHKT_DEMO_STORAGE_PREFIX)) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      storage.removeItem(k);
    }
    return keysToDelete.length;
  } catch {
    return 0;
  }
}

export function resetKhktDemoSandbox(
  storage: StorageLike | null = getDefaultStorage()
): { state: KhktDemoWorkspaceState; meta: KhktDemoMeta; clearedKeys: number } {
  const clearedKeys = clearAllKhktDemoStorage(storage);
  const state = createFreshKhktDemoState();
  const meta = getDefaultKhktDemoMeta();
  saveKhktDemoState(state, storage);
  saveKhktDemoMeta(meta, storage);
  return { state, meta, clearedKeys };
}

export function getDemoScopedExamDraftKey(
  assignmentId: string,
  studentId: string,
  isDemo: boolean
): string {
  if (isDemo) {
    return `${KHKT_DEMO_KEYS.EXAM_DRAFT_PREFIX}${assignmentId}_${studentId}`;
  }
  return `exam_session_${assignmentId}_${studentId}`;
}
