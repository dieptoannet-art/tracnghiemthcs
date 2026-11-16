import {
  Assignment,
  AuditLog,
  ClassRoleAssignment,
  ClassRoom,
  Exam,
  ExamMatrix,
  Question,
  StudyDocument,
  Submission,
  TeachingAssignment,
  UserProfile,
} from '../types/index';
import {
  INITIAL_ASSIGNMENTS,
  INITIAL_CLASSES,
  INITIAL_EXAMS,
  INITIAL_MATRICES,
  INITIAL_QUESTIONS,
  INITIAL_STUDY_DOCS,
  INITIAL_SUBMISSIONS,
} from '../data/mockData';
import {
  GuestClassSession,
  loadGuestSession,
  saveGuestSession,
  clearAllGuestData,
} from '../components/teacher/GuestRosterManager';

export const DEMO_SANDBOX_STORAGE_KEY = 'taydo_demo_sandbox_v1';
export const DEMO_PRIMARY_CLASS_ID = 'demo-cls-8a1';

const LAST_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ',
  'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý',
];
const MALE_MIDDLE = ['Văn', 'Minh', 'Quốc', 'Gia', 'Đức', 'Anh', 'Khánh', 'Hữu', 'Tuấn', 'Thanh'];
const FEMALE_MIDDLE = ['Thị', 'Ngọc', 'Phương', 'Thùy', 'Bảo', 'Minh', 'Thanh', 'Khánh', 'Gia', 'Lan'];
const MALE_FIRST = [
  'An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Hải', 'Hiếu', 'Hoàng', 'Hùng', 'Khang',
  'Khoa', 'Khôi', 'Long', 'Minh', 'Nam', 'Nhân', 'Phát', 'Phong', 'Phúc', 'Quân',
  'Quang', 'Sơn', 'Tân', 'Thắng', 'Thịnh',
];
const FEMALE_FIRST = [
  'Ánh', 'Châu', 'Diệp', 'Giang', 'Hà', 'Hân', 'Hương', 'Khánh', 'Linh', 'Mai',
  'My', 'Ngân', 'Ngọc', 'Nhi', 'Nhung', 'Oanh', 'Phương', 'Quỳnh', 'Tâm', 'Thảo',
  'Thư', 'Thương', 'Trang', 'Trinh', 'Uyên',
];

export interface DemoStudentRecord {
  id: string;
  code: string;
  fullName: string;
  email: string;
  gender: 'Nam' | 'Nữ';
}

/**
 * Generates exactly 50 fictitious synthetic THCS students (zero real school/personal data).
 */
export function generateSynthetic50Students(): DemoStudentRecord[] {
  const result: DemoStudentRecord[] = [];
  for (let i = 0; i < 50; i++) {
    const num = String(i + 1).padStart(2, '0');
    const gender: 'Nam' | 'Nữ' = i % 2 === 0 ? 'Nam' : 'Nữ';
    const ln = LAST_NAMES[(i * 5 + 3) % LAST_NAMES.length];
    const mn =
      gender === 'Nam'
        ? MALE_MIDDLE[(i * 3 + 1) % MALE_MIDDLE.length]
        : FEMALE_MIDDLE[(i * 3 + 2) % FEMALE_MIDDLE.length];
    const fn =
      gender === 'Nam'
        ? MALE_FIRST[Math.floor(i / 2) % MALE_FIRST.length]
        : FEMALE_FIRST[Math.floor(i / 2) % FEMALE_FIRST.length];

    const code = `DM80${num}`;
    result.push({
      id: `demo-stu-${num}`,
      code,
      fullName: `${ln} ${mn} ${fn}`,
      email: `${code.toLowerCase()}@demo.taydo.local`,
      gender,
    });
  }
  return result;
}

export function buildDemoClasses(): ClassRoom[] {
  const fiftyStudents = generateSynthetic50Students();
  const sixGradeStudents = fiftyStudents.slice(0, 12).map((s, idx) => ({
    ...s,
    id: `demo-6a1-${idx + 1}`,
    code: `DM60${String(idx + 1).padStart(2, '0')}`,
    email: `dm60${String(idx + 1).padStart(2, '0')}@demo.taydo.local`,
  }));
  const nineGradeStudents = fiftyStudents.slice(12, 24).map((s, idx) => ({
    ...s,
    id: `demo-9a1-${idx + 1}`,
    code: `DM90${String(idx + 1).padStart(2, '0')}`,
    email: `dm90${String(idx + 1).padStart(2, '0')}@demo.taydo.local`,
  }));

  return [
    {
      id: DEMO_PRIMARY_CLASS_ID,
      name: '8A1 (Demo 50 HS)',
      classCode: 'DEMO-8A1',
      grade: '8',
      teacherName: 'Giáo viên Demo (Mô phỏng)',
      teacherId: 'demo-teacher-01',
      schoolYear: '2025-2026',
      studentCount: fiftyStudents.length,
      inviteCode: 'DEMO-8A1-50HS',
      students: fiftyStudents,
    },
    {
      id: 'demo-cls-6a1',
      name: '6A1 (Tin học 6 Demo)',
      classCode: 'DEMO-6A1',
      grade: '6',
      teacherName: 'Giáo viên Demo (Mô phỏng)',
      teacherId: 'demo-teacher-01',
      schoolYear: '2025-2026',
      studentCount: sixGradeStudents.length,
      inviteCode: 'DEMO-6A1-TIN',
      students: sixGradeStudents,
    },
    {
      id: 'demo-cls-9a1',
      name: '9A1 (Toán 9 Demo)',
      classCode: 'DEMO-9A1',
      grade: '9',
      teacherName: 'Giáo viên Demo (Mô phỏng)',
      teacherId: 'demo-teacher-01',
      schoolYear: '2025-2026',
      studentCount: nineGradeStudents.length,
      inviteCode: 'DEMO-9A1-TOAN',
      students: nineGradeStudents,
    },
    ...INITIAL_CLASSES.map((c) => ({
      ...c,
      id: `demo-tpl-${c.id}`,
      name: `${c.name} (Mẫu)`,
      teacherId: 'demo-teacher-01',
    })),
  ];
}

export function buildDemoExams(questions: Question[]): Exam[] {
  const tin6Questions = questions.filter(
    (q) => q.subject === 'informatics' && q.grade === '6'
  );
  const math8Questions = questions.filter(
    (q) => q.subject === 'math' && q.grade === '8'
  );

  const demoTin6Exam: Exam = {
    id: 'demo-exam-tin6-b1',
    code: 'DEMO-TIN6-B01',
    title: 'Kiểm tra nhanh (Demo): Tin học 6 – Thông tin và dữ liệu',
    grade: '6',
    subject: 'informatics',
    period: 'mid1',
    durationMinutes: 15,
    questions: tin6Questions.slice(0, 6),
    questionCount: Math.min(6, tin6Questions.length),
    totalPoints: tin6Questions.slice(0, 6).reduce((acc, q) => acc + (q.points || 0.25), 0),
    createdAt: '2026-10-15',
    author: 'Hệ thống Demo Smart EDU',
  };

  const demoMath8Exam: Exam = {
    id: 'demo-exam-math8-demo',
    code: 'DEMO-TOAN8-GK1',
    title: 'Đề minh họa (Demo): Toán 8 – Đa thức & Hình học',
    grade: '8',
    subject: 'math',
    period: 'mid1',
    durationMinutes: 30,
    questions: math8Questions.slice(0, 5),
    questionCount: Math.min(5, math8Questions.length),
    totalPoints: math8Questions.slice(0, 5).reduce((acc, q) => acc + (q.points || 0.5), 0),
    createdAt: '2026-10-18',
    author: 'Hệ thống Demo Smart EDU',
  };

  return [
    demoTin6Exam,
    demoMath8Exam,
    ...INITIAL_EXAMS.map((ex) => ({
      ...ex,
      id: `demo-tpl-${ex.id}`,
    })),
  ];
}

export function buildDemoAssignments(exams: Exam[]): Assignment[] {
  const now = Date.now();
  const openIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const closeIso = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const tin6 = exams.find((e) => e.id === 'demo-exam-tin6-b1') || exams[0];
  const math8 = exams.find((e) => e.id === 'demo-exam-math8-demo') || exams[1] || exams[0];

  const base: Assignment[] = [];
  if (tin6) {
    base.push({
      id: 'demo-asg-tin6-b1',
      examId: tin6.id,
      examTitle: tin6.title,
      classId: 'demo-cls-6a1',
      className: '6A1 (Tin học 6 Demo)',
      grade: '6',
      subject: 'informatics',
      openTime: openIso,
      closeTime: closeIso,
      durationMinutes: 15,
      attemptsAllowed: 99,
      allowReview: true,
      showSolutionAfterSubmit: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      isComputerLabMode: false,
      status: 'active',
      roundLabel: 'Đợt Demo KHKT',
      assignedBy: 'Giáo viên Demo',
    });
  }
  if (math8) {
    base.push({
      id: 'demo-asg-math8-demo',
      examId: math8.id,
      examTitle: math8.title,
      classId: DEMO_PRIMARY_CLASS_ID,
      className: '8A1 (Demo 50 HS)',
      grade: '8',
      subject: 'math',
      openTime: openIso,
      closeTime: closeIso,
      durationMinutes: 30,
      attemptsAllowed: 99,
      allowReview: true,
      showSolutionAfterSubmit: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      isComputerLabMode: false,
      status: 'active',
      roundLabel: 'Đợt Demo Lớp 8',
      assignedBy: 'Giáo viên Demo',
    });
  }

  return [
    ...base,
    ...INITIAL_ASSIGNMENTS.map((a) => ({
      ...a,
      id: `demo-tpl-${a.id}`,
      examId: exams.some((e) => e.id === `demo-tpl-${a.examId}`) ? `demo-tpl-${a.examId}` : a.examId,
      openTime: openIso,
      closeTime: closeIso,
      status: 'active' as const,
    })),
  ];
}

export function buildDemoSubmissions(students: DemoStudentRecord[]): Submission[] {
  const sampleScores = [9.5, 8.75, 8.0, 7.25, 9.0, 6.5];
  const generated: Submission[] = sampleScores.map((score, idx) => {
    const stu = students[idx] || students[0];
    return {
      id: `demo-sub-${idx + 1}`,
      assignmentId: idx % 2 === 0 ? 'demo-asg-tin6-b1' : 'demo-asg-math8-demo',
      examId: idx % 2 === 0 ? 'demo-exam-tin6-b1' : 'demo-exam-math8-demo',
      examTitle:
        idx % 2 === 0
          ? 'Kiểm tra nhanh (Demo): Tin học 6 – Thông tin và dữ liệu'
          : 'Đề minh họa (Demo): Toán 8 – Đa thức & Hình học',
      studentId: stu.id,
      studentName: stu.fullName,
      studentClass: idx % 2 === 0 ? '6A1 (Tin học 6 Demo)' : '8A1 (Demo 50 HS)',
      grade: idx % 2 === 0 ? '6' : '8',
      subject: idx % 2 === 0 ? 'informatics' : 'math',
      startTime: new Date(Date.now() - (idx + 2) * 3600000).toISOString(),
      submittedAt: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
      timeSpentSeconds: 420 + idx * 55,
      status: idx === 1 ? 'submitted' : 'graded',
      answers: {},
      score,
      maxScore: 10,
      tabSwitchCount: 0,
      teacherFeedback: idx === 1 ? null : 'Bài làm Demo rõ ràng, đúng trọng tâm kiến thức.',
      gradedBy: idx === 1 ? null : 'demo-teacher-01',
      gradedAt: idx === 1 ? null : new Date().toISOString(),
    };
  });

  return [...generated, ...INITIAL_SUBMISSIONS];
}

export interface DemoSandboxState {
  version: 1;
  questions: Question[];
  classes: ClassRoom[];
  matrices: ExamMatrix[];
  exams: Exam[];
  assignments: Assignment[];
  submissions: Submission[];
  studyDocs: StudyDocument[];
  auditLogs: AuditLog[];
  updatedAt: string;
}

export function createInitialDemoSandboxState(): DemoSandboxState {
  const classes = buildDemoClasses();
  const questions = [...INITIAL_QUESTIONS];
  const exams = buildDemoExams(questions);
  const assignments = buildDemoAssignments(exams);
  const submissions = buildDemoSubmissions(generateSynthetic50Students());
  const studyDocs = [...INITIAL_STUDY_DOCS];

  return {
    version: 1,
    questions,
    classes,
    matrices: [...INITIAL_MATRICES],
    exams,
    assignments,
    submissions,
    studyDocs,
    auditLogs: [
      {
        id: 'demo-log-init',
        timestamp: new Date().toLocaleString('vi-VN'),
        actor: 'Hệ thống Demo Sandbox',
        role: 'teacher',
        action: 'Khởi tạo dữ liệu Demo',
        target: '50 học sinh mẫu · Lớp 8A1 & 6A1',
        details: 'Môi trường trải nghiệm độc lập cục bộ, không kết nối hoặc thay đổi CSDL thật.',
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function loadDemoSandboxState(): DemoSandboxState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createInitialDemoSandboxState();
  }
  try {
    const raw = window.localStorage.getItem(DEMO_SANDBOX_STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialDemoSandboxState();
      window.localStorage.setItem(DEMO_SANDBOX_STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<DemoSandboxState>;
    if (
      parsed &&
      parsed.version === 1 &&
      Array.isArray(parsed.classes) &&
      Array.isArray(parsed.exams) &&
      Array.isArray(parsed.assignments)
    ) {
      return parsed as DemoSandboxState;
    }
  } catch {
    // fallback to clean seed
  }
  const fresh = createInitialDemoSandboxState();
  try {
    window.localStorage.setItem(DEMO_SANDBOX_STORAGE_KEY, JSON.stringify(fresh));
  } catch {}
  return fresh;
}

export function saveDemoSandboxState(state: DemoSandboxState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      DEMO_SANDBOX_STORAGE_KEY,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
    );
  } catch {
    // ignore storage quota issue gracefully
  }
}

export function buildDemoTeachingAssignments(classes: ClassRoom[]): TeachingAssignment[] {
  return classes.map((c) => ({
    id: `demo-ta-${c.id}`,
    schoolYear: c.schoolYear || '2025-2026',
    teacherId: 'demo-teacher-01',
    teacherName: c.teacherName || 'Giáo viên Demo',
    classId: c.id,
    classCode: c.classCode || c.name.replace(/\s+/g, '').toUpperCase(),
    className: c.name,
    grade: c.grade,
    subject: c.grade === '6' ? 'informatics' : 'math',
    subjectLabel: c.grade === '6' ? 'Tin học' : 'Toán',
    status: 'active',
    needsSubjectCompletion: false,
  }));
}

export function buildDemoClassRoles(classes: ClassRoom[]): ClassRoleAssignment[] {
  return classes.map((c) => ({
    id: `demo-cr-${c.id}`,
    schoolYear: c.schoolYear || '2025-2026',
    classId: c.id,
    classCode: c.classCode || c.name.replace(/\s+/g, '').toUpperCase(),
    className: c.name,
    grade: c.grade,
    teacherId: 'demo-teacher-01',
    roleType: 'homeroom',
    roleLabel: 'Chủ nhiệm lớp (Demo)',
    status: 'active',
  }));
}

export function buildDemoUserProfile(role: 'teacher' | 'student'): UserProfile {
  if (role === 'teacher') {
    return {
      id: 'demo-teacher-01',
      email: 'teacher.demo@sandbox.taydo.local',
      fullName: 'Giáo viên Demo (50 HS)',
      role: 'teacher',
      teacherCode: 'DEMO-GV01',
      schoolName: 'THCS Tây Đô (Môi trường Demo)',
      subject: 'Toán – Tin học',
    };
  }
  return {
    id: 'demo-stu-01',
    email: 'dm8001@demo.taydo.local',
    fullName: 'Nguyễn Minh An (HS Demo)',
    role: 'student',
    grade: '8',
    studentCode: 'DM8001',
    schoolName: 'THCS Tây Đô (Môi trường Demo)',
  };
}

/**
 * Ensures EDU Game Center Guest Roster always has 50 synthetic demo students ready
 * on first visit in Public Guest / Demo / Showcase mode (zero impact on saved custom rosters).
 */
export function ensureDemo50GuestRosterSeeded(): GuestClassSession {
  const existing = loadGuestSession();
  if (existing.students.length > 0) {
    return existing;
  }
  const fifty = generateSynthetic50Students();
  const seededSession: GuestClassSession = {
    ...existing,
    className: 'Lớp 8A1 (Demo 50 HS)',
    activityName: 'Trải nghiệm KHKT – Gọi tên công bằng & Đua vịt 3D',
    students: fifty.map((s, idx) => ({
      guestStudentId: `gst_demo_${String(idx + 1).padStart(2, '0')}`,
      stt: idx + 1,
      fullName: s.fullName,
      participating: true,
      note: `Tổ ${(idx % 4) + 1}`,
    })),
    calledStudentIds: [],
    allowRepeat: false,
    shareAcrossGames: true,
    updatedAt: new Date().toISOString(),
  };
  saveGuestSession(seededSession);
  return seededSession;
}

export function resetDemoGuestRosterTo50(): GuestClassSession {
  const cleared = clearAllGuestData();
  const fifty = generateSynthetic50Students();
  const seeded: GuestClassSession = {
    ...cleared,
    className: 'Lớp 8A1 (Demo 50 HS)',
    activityName: 'Trải nghiệm KHKT – Gọi tên công bằng & Đua vịt 3D',
    students: fifty.map((s, idx) => ({
      guestStudentId: `gst_demo_${String(idx + 1).padStart(2, '0')}`,
      stt: idx + 1,
      fullName: s.fullName,
      participating: true,
      note: `Tổ ${(idx % 4) + 1}`,
    })),
    calledStudentIds: [],
    allowRepeat: false,
    shareAcrossGames: true,
    updatedAt: new Date().toISOString(),
  };
  saveGuestSession(seeded);
  return seeded;
}

export function resetDemoSandboxAll(): DemoSandboxState {
  const fresh = createInitialDemoSandboxState();
  saveDemoSandboxState(fresh);
  resetDemoGuestRosterTo50();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Clear local draft exam answers created during demo sessions only
      const keys = Object.keys(window.localStorage);
      for (const k of keys) {
        if (k.startsWith('taydo_exam_draft_demo-')) {
          window.localStorage.removeItem(k);
        }
      }
    } catch {}
  }
  return fresh;
}
