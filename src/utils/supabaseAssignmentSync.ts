import { supabase } from '../lib/supabase';
import {
  Assignment,
  ClassRoleAssignment,
  ClassRoleType,
  ClassRoom,
  Exam,
  ExamPeriod,
  Grade,
  Question,
  QuestionGradingDetail,
  SubjectId,
  Submission,
  SubmissionAnswer,
  TeachingAssignment,
  UserRole
} from '../types';
import { getSubjectDisplayName, resolveCanonicalSubject } from './subjectCatalog';

function normalizeSubjectKey(raw?: string | null): string {
  const res = resolveCanonicalSubject(raw);
  if (res.ok && res.subjectId) return res.subjectId;
  return String(raw || '').trim().toLowerCase();
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value?: string | null): boolean {
  return Boolean(value && UUID_REGEX.test(value));
}

export function generateRequestUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Strip all answer keys, solutions, accepted answers, and grading rubrics before storing student-readable exam payload.
 */
export function stripQuestionAnswersForExam(q: Question): Record<string, unknown> {
  return {
    id: q.id,
    code: q.code,
    grade: q.grade,
    subject: q.subject,
    textbook: q.textbook,
    chapter: q.chapter,
    lesson: q.lesson,
    yccd: q.yccd,
    competency: q.competency,
    level: q.level,
    type: q.type,
    stem: q.stem,
    image: q.image,
    points: q.points,
    options: q.options?.map(opt => ({
      id: opt.id,
      label: opt.label,
      text: opt.text
    })),
    subItems: q.subItems?.map(sub => ({
      id: sub.id,
      label: sub.label,
      text: sub.text,
      level: sub.level,
      yccd: sub.yccd
    })),
    isNumericTolerance: q.isNumericTolerance,
    examSection: q.examSection
  };
}

/**
 * Extract sensitive grading keys/solutions to store in exam_protected_keys (teachers/admins only).
 */
export function extractProtectedExamKeys(questions: Question[]): Record<string, unknown> {
  const keys: Record<string, unknown> = {};
  for (const q of questions) {
    keys[q.id] = {
      correctAnswer: q.correctAnswer ?? null,
      subItemAnswers: q.subItems?.map(sub => ({ id: sub.id, isCorrect: sub.isCorrect })) ?? null,
      acceptedAnswers: q.acceptedAnswers ?? null,
      numericTolerance: q.numericTolerance ?? null,
      rubric: q.rubric ?? null,
      sampleAnswer: q.sampleAnswer ?? null,
      explanation: q.explanation ?? ''
    };
  }
  return keys;
}

export function formatSupabaseErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;
  const msg = String(error.message || error.details || fallback);
  const code = String(error.code || '');

  if (
    msg.includes('schema cache') ||
    msg.includes('Could not find the table') ||
    msg.includes('Could not find the function') ||
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42703' ||
    code === '42883'
  ) {
    const objectMatch =
      msg.match(/table\s+['"]?([a-zA-Z0-9_.]+)['"]?/i) ||
      msg.match(/function\s+([a-zA-Z0-9_.]+(?:\([^)]*\))?)/i) ||
      msg.match(/relation\s+["']?([a-zA-Z0-9_.]+)["']?/i) ||
      msg.match(/column\s+["']?([a-zA-Z0-9_.]+)["']?/i);
    const missingObject = objectMatch?.[1];
    const detailSuffix = missingObject
      ? ` (Thiếu đối tượng: ${missingObject}${code ? ` • ${code}` : ''})`
      : code
      ? ` (Mã lỗi: ${code})`
      : '';

    return `CSDL Supabase chưa áp dụng đủ 2 bước migration: hãy chạy 01_bootstrap_assignment_tables.sql rồi đến 02_sync_classes_exams_assignments.sql trong Supabase SQL Editor${detailSuffix}.`;
  }

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('AbortError')) {
    return 'Không thể kết nối mạng tới Supabase. Vui lòng kiểm tra kết nối Internet và thử lại.';
  }

  if (code === '42501' || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('permission denied')) {
    // Giữ nguyên thông báo tiếng Việt cụ thể do hàm RPC của hệ thống trả về nếu có
    if (/[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(msg)) {
      return msg;
    }
    return 'Tài khoản hiện tại không đủ quyền thực hiện thao tác này theo chính sách bảo mật (RLS) của Supabase.';
  }

  return msg;
}

function mapExamSummaryRow(row: any): Exam {
  return {
    id: String(row.id),
    code: String(row.code || ''),
    title: String(row.title || ''),
    matrixId: row.matrix_id || undefined,
    grade: (row.grade as Grade) || '8',
    subject: (row.subject as SubjectId) || 'math',
    period: (row.period as ExamPeriod) || 'mid1',
    durationMinutes: Number(row.duration_minutes ?? 45),
    questions: [],
    questionCount: Number(row.question_count ?? (Array.isArray(row.question_ids) ? row.question_ids.length : 0)),
    totalPoints: Number(row.total_points ?? 10),
    createdAt: row.created_at ? String(row.created_at).split('T')[0] : '',
    author: row.author_name || 'Giáo viên',
    authorId: row.author_id || undefined,
    clientRequestId: row.client_request_id || undefined
  };
}

function mapAssignmentRow(
  row: any,
  examById: Map<string, Exam>,
  classById: Map<string, ClassRoom>
): Assignment {
  const linkedExam = examById.get(String(row.exam_id));
  const linkedClass = classById.get(String(row.class_id));
  return {
    id: String(row.id),
    examId: String(row.exam_id),
    examTitle: linkedExam?.title || row.exam_title || 'Nhiệm vụ học tập',
    classId: String(row.class_id),
    className: linkedClass?.name || row.class_name || 'Lớp học',
    grade: (linkedExam?.grade || linkedClass?.grade || '8') as Grade,
    subject: (row.subject_code || linkedExam?.subject || 'math') as SubjectId,
    openTime: String(row.open_time || ''),
    closeTime: String(row.close_time || ''),
    durationMinutes: Number(row.duration_minutes ?? linkedExam?.durationMinutes ?? 45),
    attemptsAllowed: Number(row.attempts_allowed ?? 1),
    allowReview: Boolean(row.allow_review ?? true),
    showSolutionAfterSubmit: Boolean(row.show_solution_after_submit ?? false),
    shuffleQuestions: Boolean(row.shuffle_questions ?? true),
    shuffleOptions: Boolean(row.shuffle_options ?? true),
    isComputerLabMode: Boolean(row.is_computer_lab_mode ?? false),
    status: (row.status as 'active' | 'closed' | 'scheduled') || 'active',
    roundLabel: row.round_label || undefined,
    assignedBy: row.assigned_by || undefined,
    clientRequestId: row.client_request_id || undefined
  };
}

export interface StudentSupabaseFetchResult {
  classes: ClassRoom[];
  enrolledClassIds: string[];
  exams: Exam[];
  assignments: Assignment[];
  submissions: Submission[];
}

export function mapStudentAssignedSummariesPayload(
  payload: any,
  expectedStudentId: string
): StudentSupabaseFetchResult {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const payloadStudentId = safePayload.studentId ? String(safePayload.studentId) : expectedStudentId;
  if (expectedStudentId && payloadStudentId && payloadStudentId !== expectedStudentId) {
    throw new Error('Phiên tài khoản học sinh không khớp với dữ liệu trả về.');
  }

  const rawClasses = Array.isArray(safePayload.classes) ? safePayload.classes : [];
  const rawExams = Array.isArray(safePayload.exams) ? safePayload.exams : [];
  const rawAssignments = Array.isArray(safePayload.assignments) ? safePayload.assignments : [];
  const rawSubmissions = Array.isArray(safePayload.submissions) ? safePayload.submissions : [];

  const effectiveStudentId = expectedStudentId || payloadStudentId;

  const mappedClasses: ClassRoom[] = rawClasses.map((row: any) => ({
    id: String(row.id),
    name: String(row.name || 'Lớp học'),
    grade: (row.grade as Grade) || '8',
    teacherName: String(row.teacher_name || 'Giáo viên'),
    teacherId: row.teacher_id ? String(row.teacher_id) : undefined,
    schoolYear: row.school_year || '2025-2026',
    studentCount: 0,
    inviteCode: '',
    students: [{ id: effectiveStudentId, code: '', fullName: '', email: '' }]
  }));

  const enrolledClassIds = Array.from(new Set(mappedClasses.map(c => c.id)));
  const classById = new Map<string, ClassRoom>(mappedClasses.map(c => [c.id, c]));

  // Summary only — NEVER read public_questions, question_ids, answer keys, or solutions
  const mappedExams: Exam[] = rawExams.map((row: any) => ({
    id: String(row.id),
    code: String(row.code || ''),
    title: String(row.title || ''),
    grade: (row.grade as Grade) || '8',
    subject: (row.subject as SubjectId) || 'math',
    period: (row.period as ExamPeriod) || 'mid1',
    durationMinutes: Number(row.duration_minutes ?? 45),
    questions: [],
    questionCount: Number(row.question_count ?? 0),
    totalPoints: Number(row.total_points ?? 10),
    createdAt: row.created_at ? String(row.created_at).split('T')[0] : '',
    author: 'Giáo viên'
  }));
  const examById = new Map<string, Exam>(mappedExams.map(e => [e.id, e]));

  const mappedAssignments: Assignment[] = rawAssignments.map((row: any) =>
    mapAssignmentRow(row, examById, classById)
  );
  const asgById = new Map<string, Assignment>(mappedAssignments.map(a => [a.id, a]));

  const mappedSubmissions: Submission[] = rawSubmissions.map((row: any) => {
    const asg = asgById.get(String(row.assignment_id));
    const exm = asg ? examById.get(asg.examId) : undefined;
    return {
      id: String(row.id),
      assignmentId: String(row.assignment_id),
      examId: asg?.examId || exm?.id || '',
      examTitle: asg?.examTitle || exm?.title || 'Bài kiểm tra',
      studentId: String(row.student_id || effectiveStudentId),
      studentName: '',
      studentClass: asg?.className || '',
      grade: (asg?.grade || exm?.grade || '8') as Grade,
      subject: (asg?.subject || exm?.subject || 'math') as SubjectId,
      startTime: row.start_time ? String(row.start_time) : '',
      submittedAt: row.submitted_at ? String(row.submitted_at) : '',
      timeSpentSeconds: Number(row.time_spent_seconds ?? 0),
      status: (row.status as 'in_progress' | 'submitted' | 'graded') || 'submitted',
      answers: {},
      score: Number(row.score ?? 0),
      maxScore: Number(row.max_score ?? exm?.totalPoints ?? 10),
      tabSwitchCount: Number(row.tab_switch_count ?? 0),
      teacherFeedback: row.teacher_feedback ? String(row.teacher_feedback) : undefined,
      gradingDetails:
        row.grading_details && typeof row.grading_details === 'object'
          ? (row.grading_details as Record<string, QuestionGradingDetail>)
          : undefined,
      gradedBy: row.graded_by ? String(row.graded_by) : undefined,
      gradedAt: row.graded_at ? String(row.graded_at) : undefined
    };
  });

  return {
    classes: mappedClasses,
    enrolledClassIds,
    exams: mappedExams,
    assignments: mappedAssignments,
    submissions: mappedSubmissions
  };
}

/**
 * Fetch ONLY student-permitted classes, assignment summaries, exam metadata summaries
 * (zero question content / answers / solutions), and the student's own submission status
 * via the hardened SECURITY DEFINER RPC `get_student_assigned_summaries`.
 */
export async function fetchStudentAssignmentsFromSupabase(
  studentId: string
): Promise<{ data?: StudentSupabaseFetchResult; error?: string }> {
  if (!studentId) {
    return { error: 'Thiếu thông tin phiên đăng nhập học sinh.' };
  }

  try {
    const { data, error } = await supabase.rpc('get_student_assigned_summaries');

    if (error) {
      return {
        error: formatSupabaseErrorMessage(
          error,
          'Không thể tải danh sách bài được giao từ Supabase.'
        )
      };
    }

    return {
      data: mapStudentAssignedSummariesPayload(data, studentId)
    };
  } catch (err: any) {
    return {
      error: formatSupabaseErrorMessage(
        err,
        'Đã xảy ra lỗi khi tải bài được giao từ Supabase.'
      )
    };
  }
}

export interface TeacherWorkspaceFetchResult {
  classes: ClassRoom[];
  exams: Exam[];
  assignments: Assignment[];
  teachingAssignments: TeachingAssignment[];
  classRoles: ClassRoleAssignment[];
  submissions: Submission[];
  teachingSchemaWarning: string | null;
}

function isMissingSchemaErr(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return (
    code === '42703' ||
    code === '42P01' ||
    code === '42883' ||
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('schema cache') ||
    msg.includes('Could not find') ||
    msg.includes('does not exist')
  );
}

function hydrateSubmissionAnswersWithGradingDetails(
  rawAnswers: unknown,
  rawDetails: unknown
): Record<string, SubmissionAnswer> {
  const answersObj =
    rawAnswers && typeof rawAnswers === 'object' ? { ...(rawAnswers as Record<string, any>) } : {};
  const detailsObj =
    rawDetails && typeof rawDetails === 'object'
      ? (rawDetails as Record<string, QuestionGradingDetail>)
      : {};

  for (const [qId, detail] of Object.entries(detailsObj)) {
    if (!detail || typeof detail !== 'object') continue;
    const prev = answersObj[qId];
    if (prev && typeof prev === 'object') {
      answersObj[qId] = {
        ...prev,
        pointsAwarded:
          detail.pointsAwarded !== undefined ? Number(detail.pointsAwarded) : prev.pointsAwarded,
        teacherFeedback:
          detail.teacherFeedback !== undefined ? String(detail.teacherFeedback) : prev.teacherFeedback
      };
    }
  }
  return answersObj;
}

export async function fetchTeacherWorkspaceFromSupabase(
  userId: string,
  role: UserRole
): Promise<{ data?: TeacherWorkspaceFetchResult; error?: string }> {
  if (!userId) return { error: 'Chưa xác thực tài khoản giáo viên.' };

  try {
    // RLS on public.classes automatically scopes classes to active teaching_assignments OR active class_roles
    // (or legacy teacher_id prior to Step 05 cutover).
    let classesRes: { data: any[] | null; error: any } = await supabase
      .from('classes')
      .select('id, name, class_code, grade, school_year, teacher_id, teacher_name, invite_code, created_at')
      .order('created_at', { ascending: false });

    if (classesRes.error && isMissingSchemaErr(classesRes.error)) {
      classesRes = await supabase
        .from('classes')
        .select('id, name, grade, school_year, teacher_id, teacher_name, invite_code, created_at')
        .order('created_at', { ascending: false });
    }

    let taQuery = supabase
      .from('teaching_assignments')
      .select('id, school_year, teacher_id, class_id, subject, status, needs_subject_completion, notes, started_at, ended_at');
    if (role !== 'admin') {
      taQuery = taQuery.eq('teacher_id', userId);
    }

    let crQuery = supabase
      .from('class_roles')
      .select('id, school_year, class_id, teacher_id, role_type, status, notes, granted_at, ended_at');
    if (role !== 'admin') {
      crQuery = crQuery.eq('teacher_id', userId);
    }

    const [examsRes, initialAssignmentsRes, taRes, crRes, initialSubmissionsRes] = await Promise.all([
      supabase
        .from('exams')
        .select('id, code, title, matrix_id, grade, subject, period, duration_minutes, total_points, question_count, author_id, created_at, client_request_id')
        .order('created_at', { ascending: false }),
      supabase
        .from('assignments')
        .select(
          'id, exam_id, class_id, subject_code, open_time, close_time, duration_minutes, attempts_allowed, allow_review, show_solution_after_submit, shuffle_questions, shuffle_options, is_computer_lab_mode, status, round_label, assigned_by, client_request_id, created_at'
        )
        .order('created_at', { ascending: false }),
      taQuery,
      crQuery,
      supabase
        .from('submissions')
        .select(
          'id, assignment_id, student_id, start_time, submitted_at, time_spent_seconds, status, answers, score, max_score, tab_switch_count, teacher_feedback, grading_details, graded_by, graded_at'
        )
        .order('submitted_at', { ascending: false })
        .limit(200)
    ]);

    let assignmentsRes: { data: any[] | null; error: any } = initialAssignmentsRes;
    if (assignmentsRes.error && isMissingSchemaErr(assignmentsRes.error)) {
      assignmentsRes = await supabase
        .from('assignments')
        .select(
          'id, exam_id, class_id, open_time, close_time, duration_minutes, attempts_allowed, allow_review, show_solution_after_submit, shuffle_questions, shuffle_options, is_computer_lab_mode, status, round_label, assigned_by, client_request_id, created_at'
        )
        .order('created_at', { ascending: false });
    }

    let submissionsRes: { data: any[] | null; error: any } = initialSubmissionsRes;
    if (submissionsRes.error && isMissingSchemaErr(submissionsRes.error)) {
      submissionsRes = await supabase
        .from('submissions')
        .select('id, assignment_id, student_id, start_time, submitted_at, time_spent_seconds, status, answers, score, max_score, tab_switch_count')
        .order('submitted_at', { ascending: false })
        .limit(200);
    }

    const firstError = classesRes.error || examsRes.error || assignmentsRes.error;
    if (firstError) {
      return { error: formatSupabaseErrorMessage(firstError, 'Không thể tải dữ liệu lớp và giao bài từ Supabase.') };
    }

    const teachingSchemaMissing = Boolean(taRes.error && isMissingSchemaErr(taRes.error));
    const teachingSchemaWarning = teachingSchemaMissing
      ? 'CSDL Supabase chưa chạy migration bước 4 (src/data/04_teaching_assignments_and_codes.sql). Đang dùng phạm vi lớp học cũ.'
      : null;

    const classRows = classesRes.data || [];
    const classIds = classRows.map((c: any) => String(c.id));

    let membersRows: any[] = [];
    if (classIds.length > 0) {
      const { data: mData, error: mErr } = await supabase
        .from('class_members')
        .select('id, class_id, student_id, joined_at')
        .in('class_id', classIds);
      if (mErr) {
        return { error: formatSupabaseErrorMessage(mErr, 'Không thể tải danh sách thành viên lớp.') };
      }
      membersRows = mData || [];
    }

    const studentIds = Array.from(new Set(membersRows.map(m => String(m.student_id))));
    const profileMap = new Map<string, any>();
    if (studentIds.length > 0) {
      const { data: pData, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, student_code, grade')
        .in('id', studentIds);
      if (!pErr && pData) {
        for (const p of pData) {
          profileMap.set(String(p.id), p);
        }
      }
    }

    const membersByClass = new Map<string, ClassRoom['students']>();
    for (const m of membersRows) {
      const cid = String(m.class_id);
      const sid = String(m.student_id);
      const prof = profileMap.get(sid);
      const list = membersByClass.get(cid) || [];
      list.push({
        id: sid,
        code: String(prof?.student_code || ''),
        fullName: String(prof?.full_name || 'Học sinh'),
        email: String(prof?.email || '')
      });
      membersByClass.set(cid, list);
    }

    const mappedClasses: ClassRoom[] = classRows.map((row: any) => {
      const roster = membersByClass.get(String(row.id)) || [];
      return {
        id: String(row.id),
        name: String(row.name),
        classCode: row.class_code ? String(row.class_code) : undefined,
        grade: (row.grade as Grade) || '8',
        teacherName: String(row.teacher_name || 'Giáo viên'),
        teacherId: row.teacher_id ? String(row.teacher_id) : undefined,
        schoolYear: row.school_year || '2025-2026',
        studentCount: roster.length,
        inviteCode: String(row.invite_code || ''),
        students: roster
      };
    });

    const classById = new Map<string, ClassRoom>(mappedClasses.map(c => [c.id, c]));
    const mappedExams: Exam[] = (examsRes.data || []).map(mapExamSummaryRow);
    const examById = new Map<string, Exam>(mappedExams.map(e => [e.id, e]));
    const mappedAssignments: Assignment[] = (assignmentsRes.data || []).map((row: any) =>
      mapAssignmentRow(row, examById, classById)
    );
    const asgById = new Map<string, Assignment>(mappedAssignments.map(a => [a.id, a]));

    const mappedTeachingAssignments: TeachingAssignment[] = !taRes.error && Array.isArray(taRes.data)
      ? taRes.data.map((row: any) => {
          const cls = classById.get(String(row.class_id));
          const subj = row.subject ? String(row.subject) : null;
          return {
            id: String(row.id),
            schoolYear: String(row.school_year || cls?.schoolYear || '2025-2026'),
            teacherId: String(row.teacher_id),
            classId: String(row.class_id),
            classCode: cls?.classCode || null,
            className: cls?.name || 'Lớp học',
            grade: cls?.grade || '8',
            subject: subj,
            subjectLabel: getSubjectDisplayName(subj),
            status: row.status === 'ended' ? 'ended' : 'active',
            needsSubjectCompletion: Boolean(row.needs_subject_completion || !subj),
            notes: row.notes ? String(row.notes) : null,
            startedAt: row.started_at ? String(row.started_at) : undefined,
            endedAt: row.ended_at ? String(row.ended_at) : null
          };
        })
      : [];

    const mappedClassRoles: ClassRoleAssignment[] = !crRes.error && Array.isArray(crRes.data)
      ? crRes.data.map((row: any) => {
          const cls = classById.get(String(row.class_id));
          const roleType: ClassRoleType = row.role_type === 'class_manager' ? 'class_manager' : 'homeroom';
          return {
            id: String(row.id),
            schoolYear: String(row.school_year || cls?.schoolYear || '2025-2026'),
            classId: String(row.class_id),
            classCode: cls?.classCode || null,
            className: cls?.name || 'Lớp học',
            grade: cls?.grade || '8',
            teacherId: String(row.teacher_id),
            roleType,
            roleLabel: roleType === 'homeroom' ? 'Chủ nhiệm lớp' : 'Quản lý danh sách lớp',
            status: row.status === 'ended' ? 'ended' : 'active',
            notes: row.notes ? String(row.notes) : null,
            grantedAt: row.granted_at ? String(row.granted_at) : undefined,
            endedAt: row.ended_at ? String(row.ended_at) : null
          };
        })
      : [];

    const mappedSubmissions: Submission[] = !submissionsRes.error && Array.isArray(submissionsRes.data)
      ? submissionsRes.data.map((row: any) => {
          const asg = asgById.get(String(row.assignment_id));
          const exm = asg ? examById.get(asg.examId) : undefined;
          const stu = profileMap.get(String(row.student_id));
          const gradingDetails =
            row.grading_details && typeof row.grading_details === 'object'
              ? (row.grading_details as Record<string, QuestionGradingDetail>)
              : undefined;
          return {
            id: String(row.id),
            assignmentId: String(row.assignment_id),
            examId: asg?.examId || exm?.id || '',
            examTitle: asg?.examTitle || exm?.title || 'Bài kiểm tra',
            studentId: String(row.student_id),
            studentName: String(stu?.full_name || stu?.student_code || 'Học sinh'),
            studentClass: asg?.className || '',
            grade: (asg?.grade || exm?.grade || '8') as Grade,
            subject: (asg?.subject || exm?.subject || 'math') as SubjectId,
            startTime: row.start_time ? String(row.start_time) : '',
            submittedAt: row.submitted_at ? String(row.submitted_at) : '',
            timeSpentSeconds: Number(row.time_spent_seconds ?? 0),
            status: (row.status as 'in_progress' | 'submitted' | 'graded') || 'submitted',
            answers: hydrateSubmissionAnswersWithGradingDetails(row.answers, gradingDetails),
            score: Number(row.score ?? 0),
            maxScore: Number(row.max_score ?? exm?.totalPoints ?? 10),
            tabSwitchCount: Number(row.tab_switch_count ?? 0),
            teacherFeedback: row.teacher_feedback ? String(row.teacher_feedback) : undefined,
            gradingDetails,
            gradedBy: row.graded_by ? String(row.graded_by) : undefined,
            gradedAt: row.graded_at ? String(row.graded_at) : undefined
          };
        })
      : [];

    return {
      data: {
        classes: mappedClasses,
        exams: mappedExams,
        assignments: mappedAssignments,
        teachingAssignments: mappedTeachingAssignments,
        classRoles: mappedClassRoles,
        submissions: mappedSubmissions,
        teachingSchemaWarning
      }
    };
  } catch (err: any) {
    return { error: formatSupabaseErrorMessage(err, 'Lỗi khi tải dữ liệu giáo viên từ Supabase.') };
  }
}

export async function syncCreateClassOnSupabase(params: {
  name: string;
  grade: Grade;
  teacherId: string;
  teacherName: string;
  inviteCode: string;
  schoolYear?: string;
}): Promise<{ success: boolean; classRoom?: ClassRoom; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('classes')
      .insert({
        name: params.name.trim(),
        grade: params.grade,
        school_year: params.schoolYear || '2025-2026',
        teacher_id: params.teacherId,
        teacher_name: params.teacherName,
        invite_code: params.inviteCode.trim().toUpperCase()
      })
      .select('id, name, grade, school_year, teacher_id, teacher_name, invite_code, created_at')
      .single();

    if (error || !data) {
      return {
        success: false,
        error: formatSupabaseErrorMessage(error, 'Không thể tạo lớp học trên Supabase.')
      };
    }

    return {
      success: true,
      classRoom: {
        id: String(data.id),
        name: String(data.name),
        grade: (data.grade as Grade) || params.grade,
        teacherName: String(data.teacher_name || params.teacherName),
        teacherId: data.teacher_id ? String(data.teacher_id) : params.teacherId,
        schoolYear: data.school_year || '2025-2026',
        studentCount: 0,
        inviteCode: String(data.invite_code),
        students: []
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatSupabaseErrorMessage(err, 'Lỗi kết nối khi tạo lớp trên Supabase.')
    };
  }
}

export async function syncEnrollStudentOnSupabase(
  classId: string,
  identifier: string
): Promise<{
  success: boolean;
  student?: { id: string; code: string; fullName: string; email: string };
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('teacher_enroll_student', {
      p_class_id: classId,
      p_identifier: identifier.trim()
    });

    if (error || !data) {
      return {
        success: false,
        error: formatSupabaseErrorMessage(error, 'Không thể thêm học sinh vào lớp trên Supabase.')
      };
    }

    return {
      success: true,
      student: {
        id: String((data as any).id),
        code: String((data as any).code || ''),
        fullName: String((data as any).fullName || 'Học sinh'),
        email: String((data as any).email || '')
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatSupabaseErrorMessage(err, 'Lỗi kết nối khi thêm học sinh vào lớp.')
    };
  }
}

export async function syncJoinClassByInviteCode(
  inviteCode: string
): Promise<{ success: boolean; classId?: string; className?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('join_class_by_invite_code', {
      p_invite_code: inviteCode.trim().toUpperCase()
    });

    if (error || !data) {
      return {
        success: false,
        error: formatSupabaseErrorMessage(error, 'Không thể tham gia lớp với mã mời này.')
      };
    }

    return {
      success: true,
      classId: String((data as any).classId),
      className: String((data as any).className || '')
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatSupabaseErrorMessage(err, 'Lỗi kết nối khi tham gia lớp.')
    };
  }
}

export interface NewExamDraftInput {
  code: string;
  title: string;
  grade: Grade;
  subject: SubjectId;
  period: ExamPeriod;
  durationMinutes: number;
  questions: Question[];
  lockedQuestionIds?: string[];
  totalPoints: number;
}

export interface SaveExamDraftParams {
  teacherId: string;
  teacherRole: UserRole;
  teacherName: string;
  newExamDraft: NewExamDraftInput;
  examRequestId: string;
}

export async function syncSaveExamOnSupabase(
  params: SaveExamDraftParams
): Promise<{ success: boolean; exam?: Exam; error?: string }> {
  const { teacherId, teacherRole, teacherName, newExamDraft, examRequestId } = params;

  if (teacherRole !== 'teacher' && teacherRole !== 'admin') {
    return { success: false, error: 'Chỉ tài khoản Giáo viên hoặc Quản trị viên mới có quyền lưu đề kiểm tra.' };
  }
  if (!newExamDraft.questions || newExamDraft.questions.length === 0) {
    return { success: false, error: 'Vui lòng chọn ít nhất 1 câu hỏi cho đề kiểm tra.' };
  }

  try {
    const validUuidQIds = newExamDraft.questions.map(q => q.id).filter(id => isValidUuid(id));
    const publicQuestions = newExamDraft.questions.map(stripQuestionAnswersForExam);
    const protectedKeys = extractProtectedExamKeys(newExamDraft.questions);

    const canonicalSubject = normalizeSubjectKey(newExamDraft.subject) || newExamDraft.subject;
    let insertedExamRow: any = null;
    const { data: exData, error: exErr } = await supabase
      .from('exams')
      .insert({
        code: newExamDraft.code.trim().toUpperCase(),
        title: newExamDraft.title.trim(),
        grade: newExamDraft.grade,
        subject: canonicalSubject,
        period: newExamDraft.period,
        duration_minutes: newExamDraft.durationMinutes,
        total_points: newExamDraft.totalPoints,
        question_ids: validUuidQIds,
        question_count: newExamDraft.questions.length,
        public_questions: publicQuestions,
        author_id: teacherId,
        client_request_id: examRequestId
      })
      .select('id, code, title, matrix_id, grade, subject, period, duration_minutes, total_points, question_count, author_id, created_at, client_request_id')
      .single();

    if (exErr) {
      if (exErr.code === '23505') {
        const { data: existingRow, error: fetchExistingErr } = await supabase
          .from('exams')
          .select('id, code, title, matrix_id, grade, subject, period, duration_minutes, total_points, question_count, author_id, created_at, client_request_id')
          .eq('client_request_id', examRequestId)
          .maybeSingle();
        if (fetchExistingErr || !existingRow) {
          return { success: false, error: formatSupabaseErrorMessage(exErr, 'Không thể tạo đề thi trên Supabase.') };
        }
        insertedExamRow = existingRow;
      } else {
        return { success: false, error: formatSupabaseErrorMessage(exErr, 'Không thể tạo đề thi trên Supabase.') };
      }
    } else {
      insertedExamRow = exData;
    }

    const { error: keysErr } = await supabase.from('exam_protected_keys').upsert(
      {
        exam_id: insertedExamRow.id,
        keys: protectedKeys,
        updated_by: teacherId
      },
      { onConflict: 'exam_id' }
    );
    if (keysErr) {
      return {
        success: false,
        error: formatSupabaseErrorMessage(keysErr, 'Không thể lưu khóa đáp án bảo vệ của đề thi trên Supabase.')
      };
    }

    const resolvedExam: Exam = {
      ...mapExamSummaryRow(insertedExamRow),
      author: teacherName,
      questions: newExamDraft.questions,
      lockedQuestionIds: newExamDraft.lockedQuestionIds,
      questionCount: newExamDraft.questions.length
    };

    return { success: true, exam: resolvedExam };
  } catch (err: any) {
    return {
      success: false,
      error: formatSupabaseErrorMessage(err, 'Lỗi kết nối khi lưu đề kiểm tra lên Supabase.')
    };
  }
}

export interface PublishExamAssignmentParams {
  teacherId: string;
  teacherRole: UserRole;
  teacherName: string;
  targetClass: ClassRoom;
  existingExam?: Exam | null;
  newExamDraft?: NewExamDraftInput;
  teachingAssignments?: TeachingAssignment[];
  teachingSchemaReady?: boolean;
  assignmentSettings: {
    openTimeIso: string;
    closeTimeIso: string;
    durationMinutes: number;
    attemptsAllowed: number;
    allowReview: boolean;
    showSolutionAfterSubmit: boolean;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    isComputerLabMode: boolean;
    roundLabel: string;
  };
  publishRequestId: string;
  examRequestId: string;
}

export async function syncPublishExamAssignmentOnSupabase(
  params: PublishExamAssignmentParams
): Promise<{
  success: boolean;
  exam?: Exam;
  assignment?: Assignment;
  error?: string;
}> {
  const {
    teacherId,
    teacherRole,
    teacherName,
    targetClass,
    existingExam,
    newExamDraft,
    teachingAssignments,
    teachingSchemaReady,
    assignmentSettings,
    publishRequestId,
    examRequestId
  } = params;

  // 1. Validate caller permission & ownership before sending
  if (teacherRole !== 'teacher' && teacherRole !== 'admin') {
    return { success: false, error: 'Chỉ tài khoản Giáo viên hoặc Quản trị viên mới có quyền giao bài.' };
  }
  if (!isValidUuid(targetClass.id)) {
    return { success: false, error: 'Lớp học chưa được đồng bộ trên Supabase. Vui lòng liên hệ Quản trị viên tạo lớp.' };
  }

  const targetSubject = existingExam?.subject || newExamDraft?.subject;
  const normalizedTargetSubject = normalizeSubjectKey(targetSubject);

  const nowMs = Date.now();
  const openMs = Date.parse(assignmentSettings.openTimeIso);
  const closeMs = Date.parse(assignmentSettings.closeTimeIso);
  if (Number.isNaN(openMs) || Number.isNaN(closeMs)) {
    return { success: false, error: 'Thời gian mở đề hoặc hạn nộp bài không hợp lệ.' };
  }
  if (closeMs <= openMs) {
    return { success: false, error: 'Hạn nộp bài (close_time) phải lớn hơn thời gian mở đề (open_time).' };
  }
  if (closeMs <= nowMs) {
    return { success: false, error: 'Hạn nộp bài phải lớn hơn thời điểm hiện tại.' };
  }
  if (!Number.isFinite(assignmentSettings.durationMinutes) || assignmentSettings.durationMinutes < 1) {
    return { success: false, error: 'Thời lượng làm bài phải từ 1 phút trở lên.' };
  }
  if (!Number.isFinite(assignmentSettings.attemptsAllowed) || assignmentSettings.attemptsAllowed < 1) {
    return { success: false, error: 'Số lượt làm bài cho phép phải từ 1 trở lên.' };
  }

  if (teacherRole !== 'admin') {
    const enforceMatrix =
      teachingSchemaReady !== false || (Array.isArray(teachingAssignments) && teachingAssignments.length > 0);
    if (enforceMatrix && normalizedTargetSubject) {
      const hasActiveScope = (teachingAssignments || []).some(
        ta =>
          ta.teacherId === teacherId &&
          ta.classId === targetClass.id &&
          ta.status === 'active' &&
          !ta.needsSubjectCompletion &&
          ta.subject &&
          normalizeSubjectKey(ta.subject) === normalizedTargetSubject &&
          (!targetClass.schoolYear || ta.schoolYear === targetClass.schoolYear)
      );
      if (!hasActiveScope) {
        return {
          success: false,
          error: `Bạn không có phân công giảng dạy đang hoạt động cho môn "${getSubjectDisplayName(normalizedTargetSubject)}" tại lớp ${targetClass.name}.`
        };
      }
    } else if (!targetClass.teacherId || targetClass.teacherId !== teacherId) {
      return { success: false, error: 'Bạn không phải giáo viên được phân công cho lớp học này.' };
    }
  }

  let resolvedExam: Exam | null = existingExam ? { ...existingExam } : null;

  try {
    // 2. Validate or create Exam on Supabase
    if (resolvedExam) {
      if (!isValidUuid(resolvedExam.id)) {
        return { success: false, error: 'Đề thi được chọn là đề mẫu cục bộ, chưa có trên Supabase.' };
      }
      if (teacherRole !== 'admin' && resolvedExam.authorId && resolvedExam.authorId !== teacherId) {
        return { success: false, error: 'Bạn không có quyền giao đề thi của giáo viên khác.' };
      }
    } else if (newExamDraft) {
      const saveRes = await syncSaveExamOnSupabase({
        teacherId,
        teacherRole,
        teacherName,
        newExamDraft,
        examRequestId
      });
      if (!saveRes.success || !saveRes.exam) {
        return { success: false, error: saveRes.error || 'Không thể lưu đề kiểm tra trên Supabase.' };
      }
      resolvedExam = saveRes.exam;
    } else {
      return { success: false, error: 'Chưa có đề kiểm tra để giao cho lớp.' };
    }

    // 3. Call hardened RPC `publish_exam_assignment` first (enforces teaching_assignments & idempotency at DB level);
    //    fallback to direct insert if RPC from migration 04/05 isn't deployed yet.
    const derivedStatus: 'active' | 'scheduled' =
      openMs > nowMs + 60_000 ? 'scheduled' : 'active';

    let insertedAsgRow: any = null;
    const rpcRes = await supabase.rpc('publish_exam_assignment', {
      p_exam_id: resolvedExam.id,
      p_class_id: targetClass.id,
      p_open_time: assignmentSettings.openTimeIso,
      p_close_time: assignmentSettings.closeTimeIso,
      p_duration_minutes: assignmentSettings.durationMinutes,
      p_attempts_allowed: assignmentSettings.attemptsAllowed,
      p_allow_review: assignmentSettings.allowReview,
      p_show_solution_after_submit: assignmentSettings.showSolutionAfterSubmit,
      p_shuffle_questions: assignmentSettings.shuffleQuestions,
      p_shuffle_options: assignmentSettings.shuffleOptions,
      p_is_computer_lab_mode: assignmentSettings.isComputerLabMode,
      p_status: derivedStatus,
      p_round_label: assignmentSettings.roundLabel.trim() || 'Đợt 1',
      p_client_request_id: publishRequestId
    });

    if (!rpcRes.error && rpcRes.data) {
      insertedAsgRow = rpcRes.data;
    } else if (rpcRes.error && !isMissingSchemaErr(rpcRes.error)) {
      return {
        success: false,
        error: formatSupabaseErrorMessage(rpcRes.error, 'Không thể giao bài trên Supabase.')
      };
    } else {
      // Fallback insert when RPC is not yet deployed
      const fallbackSubjectCode = normalizeSubjectKey(resolvedExam.subject) || resolvedExam.subject;
      const baseInsertPayload: Record<string, any> = {
        exam_id: resolvedExam.id,
        class_id: targetClass.id,
        subject_code: fallbackSubjectCode,
        open_time: assignmentSettings.openTimeIso,
        close_time: assignmentSettings.closeTimeIso,
        duration_minutes: assignmentSettings.durationMinutes,
        attempts_allowed: assignmentSettings.attemptsAllowed,
        allow_review: assignmentSettings.allowReview,
        show_solution_after_submit: assignmentSettings.showSolutionAfterSubmit,
        shuffle_questions: assignmentSettings.shuffleQuestions,
        shuffle_options: assignmentSettings.shuffleOptions,
        is_computer_lab_mode: assignmentSettings.isComputerLabMode,
        status: derivedStatus,
        round_label: assignmentSettings.roundLabel.trim() || 'Đợt 1',
        assigned_by: teacherId,
        client_request_id: publishRequestId
      };

      let insertFallback = await supabase
        .from('assignments')
        .insert(baseInsertPayload)
        .select(
          'id, exam_id, class_id, open_time, close_time, duration_minutes, attempts_allowed, allow_review, show_solution_after_submit, shuffle_questions, shuffle_options, is_computer_lab_mode, status, round_label, assigned_by, client_request_id'
        )
        .single();

      if (insertFallback.error && isMissingSchemaErr(insertFallback.error)) {
        const { subject_code: _omit, ...legacyInsertPayload } = baseInsertPayload;
        insertFallback = await supabase
          .from('assignments')
          .insert(legacyInsertPayload)
          .select(
            'id, exam_id, class_id, open_time, close_time, duration_minutes, attempts_allowed, allow_review, show_solution_after_submit, shuffle_questions, shuffle_options, is_computer_lab_mode, status, round_label, assigned_by, client_request_id'
          )
          .single();
      }

      if (insertFallback.error) {
        if (insertFallback.error.code === '23505') {
          const { data: existingAsg, error: fetchAsgErr } = await supabase
            .from('assignments')
            .select(
              'id, exam_id, class_id, open_time, close_time, duration_minutes, attempts_allowed, allow_review, show_solution_after_submit, shuffle_questions, shuffle_options, is_computer_lab_mode, status, round_label, assigned_by, client_request_id'
            )
            .eq('client_request_id', publishRequestId)
            .maybeSingle();
          if (fetchAsgErr || !existingAsg) {
            return {
              success: false,
              error: formatSupabaseErrorMessage(
                insertFallback.error,
                'Lượt giao bài này đã tồn tại hoặc không thể lưu lên Supabase.'
              )
            };
          }
          if (
            String(existingAsg.assigned_by || '') !== teacherId ||
            String(existingAsg.exam_id || '') !== resolvedExam.id ||
            String(existingAsg.class_id || '') !== targetClass.id
          ) {
            return {
              success: false,
              error:
                'Mã yêu cầu giao bài (client_request_id) đã được dùng cho một lượt giao bài, lớp học hoặc người giao khác (xung đột 409).'
            };
          }
          insertedAsgRow = existingAsg;
        } else {
          return {
            success: false,
            error: formatSupabaseErrorMessage(insertFallback.error, 'Không thể lưu lượt giao bài lên Supabase.')
          };
        }
      } else {
        insertedAsgRow = insertFallback.data;
      }
    }

    const examById = new Map([[resolvedExam.id, resolvedExam]]);
    const classById = new Map([[targetClass.id, targetClass]]);
    const finalAssignment = mapAssignmentRow(insertedAsgRow, examById, classById);

    return {
      success: true,
      exam: resolvedExam,
      assignment: finalAssignment
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatSupabaseErrorMessage(err, 'Lỗi kết nối khi phát hành và giao bài lên Supabase.')
    };
  }
}

export async function syncGradeSubmissionViaRpc(params: {
  submissionId: string;
  questionId: string;
  pointsAwarded: number;
  feedback: string;
  score?: number;
}): Promise<{ success: boolean; submission?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('grade_submission', {
      p_submission_id: params.submissionId,
      p_question_id: params.questionId,
      p_points_awarded: params.pointsAwarded,
      p_teacher_feedback: params.feedback,
      p_score: params.score ?? null
    });

    if (error || !data) {
      return {
        success: false,
        error: formatSupabaseErrorMessage(error, 'Không thể lưu điểm chấm bài qua Supabase RPC.')
      };
    }

    return { success: true, submission: data };
  } catch (err: any) {
    return {
      success: false,
      error: formatSupabaseErrorMessage(err, 'Lỗi kết nối khi lưu điểm chấm bài.')
    };
  }
}
