import { supabase } from '../lib/supabase';
import {
  Assignment,
  ClassRoom,
  Exam,
  ExamPeriod,
  Grade,
  Question,
  SubjectId,
  Submission,
  UserRole
} from '../types';

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
    subject: (linkedExam?.subject || 'math') as SubjectId,
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
      tabSwitchCount: Number(row.tab_switch_count ?? 0)
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
}

export async function fetchTeacherWorkspaceFromSupabase(
  userId: string,
  role: UserRole
): Promise<{ data?: TeacherWorkspaceFetchResult; error?: string }> {
  if (!userId) return { error: 'Chưa xác thực tài khoản giáo viên.' };

  try {
    let classesQuery = supabase
      .from('classes')
      .select('id, name, grade, school_year, teacher_id, teacher_name, invite_code, created_at')
      .order('created_at', { ascending: false });

    if (role !== 'admin') {
      classesQuery = classesQuery.eq('teacher_id', userId);
    }

    const [classesRes, examsRes, assignmentsRes] = await Promise.all([
      classesQuery,
      supabase
        .from('exams')
        .select('id, code, title, matrix_id, grade, subject, period, duration_minutes, total_points, question_count, author_id, created_at, client_request_id')
        .order('created_at', { ascending: false }),
      supabase
        .from('assignments')
        .select(
          'id, exam_id, class_id, open_time, close_time, duration_minutes, attempts_allowed, allow_review, show_solution_after_submit, shuffle_questions, shuffle_options, is_computer_lab_mode, status, round_label, assigned_by, client_request_id, created_at'
        )
        .order('created_at', { ascending: false })
    ]);

    const firstError = classesRes.error || examsRes.error || assignmentsRes.error;
    if (firstError) {
      return { error: formatSupabaseErrorMessage(firstError, 'Không thể tải dữ liệu lớp và giao bài từ Supabase.') };
    }

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

    return {
      data: {
        classes: mappedClasses,
        exams: mappedExams,
        assignments: mappedAssignments
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

export interface PublishExamAssignmentParams {
  teacherId: string;
  teacherRole: UserRole;
  teacherName: string;
  targetClass: ClassRoom;
  existingExam?: Exam | null;
  newExamDraft?: {
    code: string;
    title: string;
    grade: Grade;
    subject: SubjectId;
    period: ExamPeriod;
    durationMinutes: number;
    questions: Question[];
    totalPoints: number;
  };
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
    assignmentSettings,
    publishRequestId,
    examRequestId
  } = params;

  // 1. Validate caller permission & ownership before sending
  if (teacherRole !== 'teacher' && teacherRole !== 'admin') {
    return { success: false, error: 'Chỉ tài khoản Giáo viên hoặc Quản trị viên mới có quyền giao bài.' };
  }
  if (!isValidUuid(targetClass.id)) {
    return { success: false, error: 'Lớp học chưa được đồng bộ trên Supabase. Vui lòng tạo lớp trên tài khoản Supabase trước.' };
  }
  if (teacherRole !== 'admin' && targetClass.teacherId && targetClass.teacherId !== teacherId) {
    return { success: false, error: 'Bạn không phải giáo viên phụ trách lớp học này.' };
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
      if (!newExamDraft.questions || newExamDraft.questions.length === 0) {
        return { success: false, error: 'Vui lòng chọn ít nhất 1 câu hỏi cho đề kiểm tra.' };
      }

      const validUuidQIds = newExamDraft.questions.map(q => q.id).filter(id => isValidUuid(id));
      const publicQuestions = newExamDraft.questions.map(stripQuestionAnswersForExam);
      const protectedKeys = extractProtectedExamKeys(newExamDraft.questions);

      let insertedExamRow: any = null;
      const { data: exData, error: exErr } = await supabase
        .from('exams')
        .insert({
          code: newExamDraft.code.trim().toUpperCase(),
          title: newExamDraft.title.trim(),
          grade: newExamDraft.grade,
          subject: newExamDraft.subject,
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
        // Idempotent recovery: if a prior attempt with same client_request_id already succeeded on server
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

      // Store protected answer keys in teacher/admin-only table
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

      resolvedExam = {
        ...mapExamSummaryRow(insertedExamRow),
        author: teacherName,
        questions: newExamDraft.questions,
        questionCount: newExamDraft.questions.length
      };
    } else {
      return { success: false, error: 'Chưa có đề kiểm tra để giao cho lớp.' };
    }

    // 3. Insert Assignment with idempotency key client_request_id
    const nowMs = Date.now();
    const openMs = Date.parse(assignmentSettings.openTimeIso);
    const derivedStatus: 'active' | 'scheduled' =
      !Number.isNaN(openMs) && openMs > nowMs + 60_000 ? 'scheduled' : 'active';

    let insertedAsgRow: any = null;
    const { data: asgData, error: asgErr } = await supabase
      .from('assignments')
      .insert({
        exam_id: resolvedExam.id,
        class_id: targetClass.id,
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
      })
      .select(
        'id, exam_id, class_id, open_time, close_time, duration_minutes, attempts_allowed, allow_review, show_solution_after_submit, shuffle_questions, shuffle_options, is_computer_lab_mode, status, round_label, assigned_by, client_request_id'
      )
      .single();

    if (asgErr) {
      if (asgErr.code === '23505') {
        const { data: existingAsg, error: fetchAsgErr } = await supabase
          .from('assignments')
          .select(
            'id, exam_id, class_id, open_time, close_time, duration_minutes, attempts_allowed, allow_review, show_solution_after_submit, shuffle_questions, shuffle_options, is_computer_lab_mode, status, round_label, assigned_by, client_request_id'
          )
          .eq('client_request_id', publishRequestId)
          .maybeSingle();
        if (fetchAsgErr || !existingAsg) {
          return { success: false, error: formatSupabaseErrorMessage(asgErr, 'Lượt giao bài này đã tồn tại hoặc không thể lưu lên Supabase.') };
        }
        insertedAsgRow = existingAsg;
      } else {
        return { success: false, error: formatSupabaseErrorMessage(asgErr, 'Không thể lưu lượt giao bài lên Supabase.') };
      }
    } else {
      insertedAsgRow = asgData;
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
