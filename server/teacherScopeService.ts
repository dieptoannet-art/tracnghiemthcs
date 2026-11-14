import type { ClassRoleAssignment, ClassRoleType, TeachingAssignment } from '../src/types/index.ts';
import { getSubjectDisplayName, resolveCanonicalSubject } from '../src/utils/subjectCatalog.ts';
import { isValidUuid, writeServerAuditLog, type ServiceResult } from './adminAccountsService.ts';

export interface StaffCaller {
  id: string;
  email: string;
  fullName: string;
  role: 'teacher' | 'admin';
}

export interface StaffVerifyResult {
  ok: boolean;
  status: number;
  code?: string;
  message?: string;
  caller?: StaffCaller;
}

function isMissingSchemaError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return (
    code === '42703' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('schema cache') ||
    msg.includes('Could not find') ||
    msg.includes('does not exist')
  );
}

function normalizeSubjectKey(raw?: string | null): string {
  const res = resolveCanonicalSubject(raw);
  if (res.ok && res.subjectId) return res.subjectId;
  return String(raw || '').trim().toLowerCase();
}

export async function verifyStaffCaller(
  supabaseAdmin: any,
  authHeader?: string | null
): Promise<StaffVerifyResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Thiếu token xác thực phiên đăng nhập.'
    };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Token xác thực không hợp lệ.'
    };
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_SESSION',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
    };
  }

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profErr) {
    return {
      ok: false,
      status: 500,
      code: 'PROFILE_VERIFY_FAILED',
      message: `Không thể xác minh vai trò từ public.profiles: ${profErr.message}`
    };
  }
  if (!profile) {
    return {
      ok: false,
      status: 403,
      code: 'PROFILE_NOT_FOUND',
      message: 'Tài khoản chưa có hồ sơ trong bảng public.profiles.'
    };
  }
  if (profile.role !== 'teacher' && profile.role !== 'admin') {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'Từ chối truy cập (403): Chức năng này chỉ dành cho Giáo viên hoặc Quản trị viên.'
    };
  }

  return {
    ok: true,
    status: 200,
    caller: {
      id: String(profile.id),
      email: String(profile.email || userData.user.email || ''),
      fullName: String(profile.full_name || 'Giáo viên'),
      role: profile.role as 'teacher' | 'admin'
    }
  };
}

/**
 * Checks whether a teacher is actively assigned to teach `subject` in `classId`
 * within the class's current `school_year` (`needs_subject_completion = false`).
 * When status = 'ended', publish & grading permissions expire immediately.
 * Admin bypasses scope restriction cleanly.
 */
export async function checkTeacherClassSubjectScope(
  supabaseAdmin: any,
  caller: StaffCaller,
  classId: string,
  subject: string
): Promise<{
  allowed: boolean;
  status: number;
  code?: string;
  message?: string;
  cls?: any;
  normalizedSubject?: string;
}> {
  if (!isValidUuid(classId)) {
    return {
      allowed: false,
      status: 400,
      code: 'INVALID_CLASS_ID',
      message: 'Mã lớp học không hợp lệ.'
    };
  }

  const subjectKey = normalizeSubjectKey(subject);
  if (!subjectKey) {
    return {
      allowed: false,
      status: 400,
      code: 'MISSING_SUBJECT',
      message: 'Đề kiểm tra chưa xác định môn học hợp lệ.'
    };
  }

  const { data: cls, error: clsErr } = await supabaseAdmin
    .from('classes')
    .select('id, name, grade, school_year, teacher_id')
    .eq('id', classId)
    .maybeSingle();

  if (clsErr || !cls) {
    return {
      allowed: false,
      status: 404,
      code: 'CLASS_NOT_FOUND',
      message: 'Không tìm thấy lớp học được chọn.'
    };
  }

  if (caller.role === 'admin') {
    return { allowed: true, status: 200, cls, normalizedSubject: subjectKey };
  }

  const { data: taRows, error: taErr } = await supabaseAdmin
    .from('teaching_assignments')
    .select('id, school_year, subject, status, needs_subject_completion')
    .eq('teacher_id', caller.id)
    .eq('class_id', classId)
    .eq('status', 'active');

  if (taErr) {
    return {
      allowed: false,
      status: 500,
      code: 'TEACHING_SCOPE_QUERY_FAILED',
      message: `Không thể kiểm tra phân công giảng dạy: ${taErr.message}`
    };
  }

  const hasExactActiveAssignment = (taRows || []).some((ta: any) => {
    if (ta.status !== 'active' || ta.needs_subject_completion || !ta.subject) return false;
    const taSubjectKey = normalizeSubjectKey(String(ta.subject));
    return (
      taSubjectKey === subjectKey &&
      String(ta.school_year || '').trim() === String(cls.school_year || '').trim()
    );
  });

  if (!hasExactActiveAssignment) {
    return {
      allowed: false,
      status: 403,
      code: 'FORBIDDEN_TEACHING_SCOPE',
      message: `Từ chối thao tác (403): Bạn không có phân công giảng dạy đang hoạt động cho môn "${getSubjectDisplayName(subjectKey)}" tại lớp ${cls.name} (${cls.school_year}).`
    };
  }

  return { allowed: true, status: 200, cls, normalizedSubject: subjectKey };
}

export async function getTeacherScopePayload(
  supabaseAdmin: any,
  caller: StaffCaller
): Promise<
  ServiceResult<{
    classes: any[];
    teachingAssignments: TeachingAssignment[];
    classRoles: ClassRoleAssignment[];
  }>
> {
  let taQuery = supabaseAdmin
    .from('teaching_assignments')
    .select('id, school_year, teacher_id, class_id, subject, status, needs_subject_completion, notes, started_at, ended_at');

  let crQuery = supabaseAdmin
    .from('class_roles')
    .select('id, school_year, class_id, teacher_id, role_type, status, notes, granted_at, ended_at');

  if (caller.role !== 'admin') {
    taQuery = taQuery.eq('teacher_id', caller.id);
    crQuery = crQuery.eq('teacher_id', caller.id);
  }

  const [{ data: taRows, error: taErr }, crRes, { data: classRows, error: clsErr }] =
    await Promise.all([
      taQuery,
      crQuery,
      supabaseAdmin
        .from('classes')
        .select('id, name, class_code, grade, school_year, teacher_id, teacher_name, invite_code, created_at')
        .order('grade', { ascending: true })
    ]);

  if (clsErr || (taErr && !isMissingSchemaError(taErr))) {
    return {
      ok: false,
      status: 500,
      code: 'SCOPE_FETCH_FAILED',
      message: taErr?.message || clsErr?.message || 'Không thể tải phạm vi lớp và phân công.'
    };
  }

  const allClasses = classRows || [];
  const classById = new Map<string, any>(allClasses.map((c: any) => [String(c.id), c]));

  const taSchemaMissing = Boolean(taErr && isMissingSchemaError(taErr));
  const crSchemaMissing = Boolean(crRes.error && isMissingSchemaError(crRes.error));

  const validTaRows = !taErr && Array.isArray(taRows) ? taRows : [];
  const validCrRows = !crRes.error && Array.isArray(crRes.data) ? crRes.data : [];

  const activeAssignedClassIds = new Set(
    validTaRows
      .filter((ta: any) => {
        const cls = classById.get(String(ta.class_id));
        return (
          ta.status === 'active' &&
          !ta.needs_subject_completion &&
          Boolean(ta.subject && String(ta.subject).trim()) &&
          (!cls?.school_year || String(ta.school_year || '').trim() === String(cls.school_year).trim())
        );
      })
      .map((ta: any) => String(ta.class_id))
  );

  const activeManagedClassIds = new Set(
    validCrRows
      .filter((cr: any) => {
        const cls = classById.get(String(cr.class_id));
        return (
          cr.status === 'active' &&
          (!cls?.school_year || String(cr.school_year || '').trim() === String(cls.school_year).trim())
        );
      })
      .map((cr: any) => String(cr.class_id))
  );

  const scopedClasses =
    caller.role === 'admin'
      ? allClasses
      : allClasses.filter((c: any) => {
          const cid = String(c.id);
          if (activeAssignedClassIds.has(cid) || activeManagedClassIds.has(cid)) {
            return true;
          }
          // Fallback to legacy classes.teacher_id ONLY when Step 04 schema tables are absent
          return taSchemaMissing && crSchemaMissing && String(c.teacher_id || '') === caller.id;
        });

  const teachingAssignments: TeachingAssignment[] = validTaRows.map((row: any) => {
    const cls = classById.get(String(row.class_id));
    const subj = row.subject ? normalizeSubjectKey(String(row.subject)) : null;
    return {
      id: String(row.id),
      schoolYear: String(row.school_year || cls?.school_year || '2025-2026'),
      teacherId: String(row.teacher_id),
      classId: String(row.class_id),
      classCode: cls?.class_code ? String(cls.class_code) : null,
      className: String(cls?.name || 'Lớp học'),
      grade: cls?.grade || '8',
      subject: subj,
      subjectLabel: getSubjectDisplayName(subj),
      status: row.status === 'ended' ? 'ended' : 'active',
      needsSubjectCompletion: Boolean(row.needs_subject_completion || !subj),
      notes: row.notes ? String(row.notes) : null,
      startedAt: row.started_at ? String(row.started_at) : undefined,
      endedAt: row.ended_at ? String(row.ended_at) : null
    };
  });

  const classRoles: ClassRoleAssignment[] = validCrRows.map((row: any) => {
    const cls = classById.get(String(row.class_id));
    const roleType: ClassRoleType = row.role_type === 'class_manager' ? 'class_manager' : 'homeroom';
    return {
      id: String(row.id),
      schoolYear: String(row.school_year || cls?.school_year || '2025-2026'),
      classId: String(row.class_id),
      classCode: cls?.class_code ? String(cls.class_code) : null,
      className: String(cls?.name || 'Lớp học'),
      grade: cls?.grade || '8',
      teacherId: String(row.teacher_id),
      roleType,
      roleLabel: roleType === 'homeroom' ? 'Chủ nhiệm lớp' : 'Quản lý danh sách lớp',
      status: row.status === 'ended' ? 'ended' : 'active',
      notes: row.notes ? String(row.notes) : null,
      grantedAt: row.granted_at ? String(row.granted_at) : undefined,
      endedAt: row.ended_at ? String(row.ended_at) : null
    };
  });

  return {
    ok: true,
    status: 200,
    data: {
      classes: scopedClasses,
      teachingAssignments,
      classRoles
    }
  };
}

export async function publishAssignmentWithScopeCheck(
  supabaseAdmin: any,
  caller: StaffCaller,
  body: any
): Promise<ServiceResult<{ exam: any; assignment: any }>> {
  const classId = String(body?.classId || '').trim();
  const examId = body?.examId ? String(body.examId).trim() : '';
  const newExamDraft = body?.newExamDraft || null;
  const settings = body?.assignmentSettings || {};
  const publishRequestId = body?.publishRequestId ? String(body.publishRequestId).trim() : '';
  const examRequestId = body?.examRequestId ? String(body.examRequestId).trim() : '';

  if (!isValidUuid(classId)) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_ID', message: 'Mã lớp học không hợp lệ.' };
  }
  if (publishRequestId && !isValidUuid(publishRequestId)) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST_ID', message: 'Mã yêu cầu giao bài (publishRequestId) không hợp lệ.' };
  }

  // Validate time window & numeric constraints early
  const nowMs = Date.now();
  const openTimeIso = settings.openTimeIso ? String(settings.openTimeIso) : new Date(nowMs).toISOString();
  const closeTimeIso = settings.closeTimeIso
    ? String(settings.closeTimeIso)
    : new Date(nowMs + 7 * 86400_000).toISOString();
  const openMs = Date.parse(openTimeIso);
  const closeMs = Date.parse(closeTimeIso);

  if (Number.isNaN(openMs) || Number.isNaN(closeMs)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_TIME_FORMAT',
      message: 'Thời điểm mở bài hoặc đóng bài không hợp lệ.'
    };
  }
  if (closeMs <= openMs) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_TIME_WINDOW',
      message: 'Thời điểm đóng bài (close_time) phải lớn hơn thời điểm mở bài (open_time).'
    };
  }

  const derivedStatus: 'active' | 'scheduled' = openMs > nowMs + 60_000 ? 'scheduled' : 'active';
  if (closeMs <= nowMs) {
    return {
      ok: false,
      status: 400,
      code: 'CLOSE_TIME_IN_PAST',
      message: 'Thời điểm đóng bài phải lớn hơn thời điểm hiện tại.'
    };
  }

  const attemptsAllowed = Number(settings.attemptsAllowed ?? 1);
  if (!Number.isFinite(attemptsAllowed) || attemptsAllowed < 1) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_ATTEMPTS_ALLOWED',
      message: 'Số lượt làm bài cho phép phải từ 1 trở lên.'
    };
  }

  let resolvedExam: any = null;

  if (examId) {
    if (!isValidUuid(examId)) {
      return { ok: false, status: 400, code: 'INVALID_EXAM_ID', message: 'Mã đề kiểm tra không hợp lệ.' };
    }
    const { data: exRow, error: exErr } = await supabaseAdmin
      .from('exams')
      .select('id, code, title, grade, subject, period, duration_minutes, total_points, question_count, author_id, created_at, client_request_id')
      .eq('id', examId)
      .maybeSingle();
    if (exErr || !exRow) {
      return { ok: false, status: 404, code: 'EXAM_NOT_FOUND', message: 'Không tìm thấy đề kiểm tra.' };
    }
    if (caller.role !== 'admin' && exRow.author_id && String(exRow.author_id) !== caller.id) {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN_EXAM_AUTHOR',
        message: 'Bạn không có quyền giao đề kiểm tra do giáo viên khác soạn.'
      };
    }
    resolvedExam = exRow;
  } else if (newExamDraft) {
    if (!newExamDraft.subject || !newExamDraft.title || !newExamDraft.code) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_EXAM_DRAFT',
        message: 'Thiếu thông tin đề kiểm tra (tên đề, mã đề, môn học).'
      };
    }
    const canonicalDraftSubj = resolveCanonicalSubject(String(newExamDraft.subject));
    if (!canonicalDraftSubj.ok || !canonicalDraftSubj.subjectId) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_SUBJECT',
        message: canonicalDraftSubj.error || 'Môn học của đề kiểm tra không hợp lệ.'
      };
    }

    const scopePrecheck = await checkTeacherClassSubjectScope(
      supabaseAdmin,
      caller,
      classId,
      canonicalDraftSubj.subjectId
    );
    if (!scopePrecheck.allowed) {
      return {
        ok: false,
        status: scopePrecheck.status,
        code: scopePrecheck.code,
        message: scopePrecheck.message
      };
    }

    const { data: exInserted, error: exInsErr } = await supabaseAdmin
      .from('exams')
      .insert({
        code: String(newExamDraft.code).trim().toUpperCase(),
        title: String(newExamDraft.title).trim(),
        grade: newExamDraft.grade || '8',
        subject: canonicalDraftSubj.subjectId,
        period: newExamDraft.period || 'mid1',
        duration_minutes: Math.max(1, Number(newExamDraft.durationMinutes || 45)),
        total_points: Number(newExamDraft.totalPoints || 10),
        question_count: Array.isArray(newExamDraft.questions) ? newExamDraft.questions.length : Number(newExamDraft.questionCount || 0),
        author_id: caller.id,
        client_request_id: examRequestId || null
      })
      .select('id, code, title, grade, subject, period, duration_minutes, total_points, question_count, author_id, created_at, client_request_id')
      .single();

    if (exInsErr || !exInserted) {
      return {
        ok: false,
        status: 500,
        code: 'SAVE_EXAM_FAILED',
        message: exInsErr?.message || 'Không thể lưu đề kiểm tra.'
      };
    }
    resolvedExam = exInserted;
  } else {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_EXAM',
      message: 'Thiếu đề kiểm tra cần giao.'
    };
  }

  const durationMinutes = Number(settings.durationMinutes ?? resolvedExam.duration_minutes ?? 45);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_DURATION',
      message: 'Thời lượng làm bài phải từ 1 phút trở lên.'
    };
  }

  // Enforce (class, subject) active teaching assignment scope
  const scopeCheck = await checkTeacherClassSubjectScope(
    supabaseAdmin,
    caller,
    classId,
    String(resolvedExam.subject)
  );
  if (!scopeCheck.allowed) {
    return {
      ok: false,
      status: scopeCheck.status,
      code: scopeCheck.code,
      message: scopeCheck.message
    };
  }

  const canonicalSubjectCode = scopeCheck.normalizedSubject || normalizeSubjectKey(resolvedExam.subject);

  const verifyExistingIdempotencyMatch = (existingAsg: any): ServiceResult<{ exam: any; assignment: any }> => {
    const sameActor = String(existingAsg.assigned_by || '') === caller.id;
    const sameExam = String(existingAsg.exam_id || '') === String(resolvedExam.id);
    const sameClass = String(existingAsg.class_id || '') === classId;
    if (!sameActor || !sameExam || !sameClass) {
      return {
        ok: false,
        status: 409,
        code: 'IDEMPOTENCY_KEY_CONFLICT',
        message:
          'Mã giao dịch (publishRequestId) đã được dùng cho một lượt giao bài, lớp học hoặc người giao khác. Vui lòng tạo mã yêu cầu mới.'
      };
    }
    return {
      ok: true,
      status: 200,
      data: { exam: resolvedExam, assignment: existingAsg }
    };
  };

  // Strict Idempotency Check BEFORE insert
  if (publishRequestId) {
    const { data: existingAsg, error: idempErr } = await supabaseAdmin
      .from('assignments')
      .select('*')
      .eq('client_request_id', publishRequestId)
      .maybeSingle();
    if (idempErr) {
      return {
        ok: false,
        status: 500,
        code: 'IDEMPOTENCY_CHECK_FAILED',
        message: `Không thể kiểm tra khóa trùng lặp giao bài: ${idempErr.message}`
      };
    }
    if (existingAsg) {
      return verifyExistingIdempotencyMatch(existingAsg);
    }
  }

  const basePayload: Record<string, any> = {
    exam_id: resolvedExam.id,
    class_id: classId,
    subject_code: canonicalSubjectCode,
    open_time: openTimeIso,
    close_time: closeTimeIso,
    duration_minutes: durationMinutes,
    attempts_allowed: attemptsAllowed,
    allow_review: settings.allowReview ?? true,
    show_solution_after_submit: Boolean(settings.showSolutionAfterSubmit),
    shuffle_questions: settings.shuffleQuestions ?? true,
    shuffle_options: settings.shuffleOptions ?? true,
    is_computer_lab_mode: Boolean(settings.isComputerLabMode),
    status: derivedStatus,
    round_label: String(settings.roundLabel || 'Đợt 1').trim() || 'Đợt 1',
    assigned_by: caller.id,
    client_request_id: publishRequestId || null
  };

  let insertRes = await supabaseAdmin
    .from('assignments')
    .insert(basePayload)
    .select('*')
    .single();

  if (insertRes.error && isMissingSchemaError(insertRes.error)) {
    // Fallback without subject_code only when pre-04 schema lacks subject_code column
    const { subject_code: _omit, ...legacyPayload } = basePayload;
    insertRes = await supabaseAdmin
      .from('assignments')
      .insert(legacyPayload)
      .select('*')
      .single();
  }

  // Handle concurrent race collision (23505 on client_request_id)
  if (insertRes.error && String(insertRes.error.code || '') === '23505' && publishRequestId) {
    const { data: racedAsg } = await supabaseAdmin
      .from('assignments')
      .select('*')
      .eq('client_request_id', publishRequestId)
      .maybeSingle();
    if (racedAsg) {
      return verifyExistingIdempotencyMatch(racedAsg);
    }
  }

  if (insertRes.error || !insertRes.data) {
    return {
      ok: false,
      status: String(insertRes.error?.code || '') === '42501' ? 403 : 500,
      code: 'ASSIGNMENT_INSERT_FAILED',
      message: insertRes.error?.message || 'Không thể lưu lượt giao bài.'
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    { id: caller.id, email: caller.email, fullName: caller.fullName, role: 'admin' },
    'Giao bài kiểm tra',
    scopeCheck.cls?.name || classId,
    `Giao đề "${resolvedExam.title}" (${getSubjectDisplayName(canonicalSubjectCode)}) cho lớp ${scopeCheck.cls?.name || classId}`,
    String(insertRes.data.id)
  );

  return {
    ok: true,
    status: 201,
    data: {
      exam: resolvedExam,
      assignment: insertRes.data
    }
  };
}

/**
 * Column-safe grading handler:
 * - Resolves class + subject scope from assignment.subject_code (frozen snapshot) or exam.subject.
 * - Updates ONLY grading fields: score, status, teacher_feedback, grading_details, graded_by, graded_at.
 * - NEVER modifies submissions.answers, student_id, assignment_id, submitted_at, or start_time.
 */
export async function gradeSubmissionWithScopeCheck(
  supabaseAdmin: any,
  caller: StaffCaller,
  submissionId: string,
  body: {
    questionId?: string;
    pointsAwarded?: number;
    teacherFeedback?: string;
    feedback?: string;
    score?: number;
  }
): Promise<ServiceResult<{ submission: any }>> {
  if (!isValidUuid(submissionId)) {
    return { ok: false, status: 400, code: 'INVALID_SUBMISSION_ID', message: 'Mã bài nộp không hợp lệ.' };
  }

  let subQuery = await supabaseAdmin
    .from('submissions')
    .select('id, assignment_id, student_id, answers, grading_details, teacher_feedback, score, max_score, status, graded_by, graded_at')
    .eq('id', submissionId)
    .maybeSingle();

  let hasExtendedGradingColumns = true;
  if (subQuery.error && isMissingSchemaError(subQuery.error)) {
    hasExtendedGradingColumns = false;
    subQuery = await supabaseAdmin
      .from('submissions')
      .select('id, assignment_id, student_id, answers, score, max_score, status')
      .eq('id', submissionId)
      .maybeSingle();
  }

  if (subQuery.error || !subQuery.data) {
    return { ok: false, status: 404, code: 'SUBMISSION_NOT_FOUND', message: 'Không tìm thấy bài nộp.' };
  }
  const sub = subQuery.data;

  let asgQuery = await supabaseAdmin
    .from('assignments')
    .select('id, class_id, exam_id, subject_code')
    .eq('id', sub.assignment_id)
    .maybeSingle();

  if (asgQuery.error && isMissingSchemaError(asgQuery.error)) {
    asgQuery = await supabaseAdmin
      .from('assignments')
      .select('id, class_id, exam_id')
      .eq('id', sub.assignment_id)
      .maybeSingle();
  }

  if (asgQuery.error || !asgQuery.data) {
    return { ok: false, status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'Không tìm thấy lượt giao bài.' };
  }
  const asg = asgQuery.data;

  const { data: exm, error: exErr } = await supabaseAdmin
    .from('exams')
    .select('id, subject')
    .eq('id', asg.exam_id)
    .maybeSingle();

  const targetSubject = asg.subject_code || exm?.subject || '';
  if ((exErr && !targetSubject) || !targetSubject) {
    return { ok: false, status: 404, code: 'EXAM_NOT_FOUND', message: 'Không xác định được môn học của bài nộp.' };
  }

  const scopeCheck = await checkTeacherClassSubjectScope(
    supabaseAdmin,
    caller,
    String(asg.class_id),
    String(targetSubject)
  );
  if (!scopeCheck.allowed) {
    return {
      ok: false,
      status: scopeCheck.status,
      code: scopeCheck.code,
      message: scopeCheck.message
    };
  }

  const maxScore = Number(sub.max_score || 10);
  const nowIso = new Date().toISOString();
  const rawAnswers = sub.answers && typeof sub.answers === 'object' ? sub.answers : {};
  const existingDetails =
    sub.grading_details && typeof sub.grading_details === 'object' ? { ...sub.grading_details } : {};

  const trimmedQuestionId = body.questionId ? String(body.questionId).trim() : '';
  const feedbackText = body.teacherFeedback ?? body.feedback;

  if (trimmedQuestionId) {
    const prevDetail = existingDetails[trimmedQuestionId] || {};
    const prevAns = rawAnswers[trimmedQuestionId] || {};
    const nextPoints =
      body.pointsAwarded !== undefined
        ? Math.max(0, Number(body.pointsAwarded))
        : Number(prevDetail.pointsAwarded ?? prevAns.pointsAwarded ?? 0);

    if (!Number.isFinite(nextPoints)) {
      return { ok: false, status: 400, code: 'INVALID_POINTS', message: 'Điểm câu hỏi không hợp lệ.' };
    }

    existingDetails[trimmedQuestionId] = {
      pointsAwarded: nextPoints,
      teacherFeedback:
        feedbackText !== undefined
          ? String(feedbackText)
          : String(prevDetail.teacherFeedback ?? prevAns.teacherFeedback ?? ''),
      gradedBy: caller.id,
      gradedAt: nowIso
    };
  }

  // Calculate total score using immutable answers + grading_details overlay (never write back to answers)
  let computedScore: number;
  if (body.score !== undefined) {
    const parsedScore = Number(body.score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_SCORE_RANGE',
        message: `Điểm tổng phải nằm trong khoảng 0 đến ${maxScore}.`
      };
    }
    computedScore = parsedScore;
  } else {
    const questionKeys = new Set([
      ...Object.keys(rawAnswers),
      ...Object.keys(existingDetails)
    ]);
    let sum = 0;
    for (const qk of questionKeys) {
      const detailPts = existingDetails[qk]?.pointsAwarded;
      const answerPts = rawAnswers[qk]?.pointsAwarded;
      sum += Number(detailPts ?? answerPts ?? 0);
    }
    computedScore = Math.min(maxScore, Math.max(0, sum));
  }

  // Strictly update ONLY grading columns (NEVER answers, student_id, assignment_id, submitted_at, start_time)
  const gradingUpdatePayload: Record<string, any> = hasExtendedGradingColumns
    ? {
        score: computedScore,
        status: 'graded',
        teacher_feedback:
          feedbackText !== undefined ? String(feedbackText) : sub.teacher_feedback ?? null,
        grading_details: existingDetails,
        graded_by: caller.id,
        graded_at: nowIso
      }
    : {
        score: computedScore,
        status: 'graded'
      };

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('submissions')
    .update(gradingUpdatePayload)
    .eq('id', submissionId)
    .select('*')
    .single();

  if (updErr || !updated) {
    return {
      ok: false,
      status: String(updErr?.code || '') === '42501' ? 403 : 500,
      code: 'GRADE_SUBMISSION_FAILED',
      message: updErr?.message || 'Không thể lưu kết quả chấm bài.'
    };
  }

  return {
    ok: true,
    status: 200,
    message: 'Đã lưu điểm và nhận xét chấm bài.',
    data: { submission: updated }
  };
}

