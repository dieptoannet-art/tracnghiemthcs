import crypto from 'crypto';
import type {
  ClassRoleAssignment,
  ClassRoleType,
  CutoverImpactedClassItem,
  CutoverMissingSubjectItem,
  CutoverReadinessReport,
  Grade,
  TeachingAssignment,
  UserRole
} from '../src/types/index.ts';
import { getSubjectDisplayName, resolveCanonicalSubject } from '../src/utils/subjectCatalog.ts';
import {
  buildStudentInternalAuthEmail,
  isStudentInternalAuthEmail,
  isValidStudentCode,
  normalizeInternalAuthDomain,
  normalizeStudentCode
} from '../src/utils/studentAuthHelper.ts';

export interface AdminCaller {
  id: string;
  email: string;
  fullName: string;
  role: 'admin';
}

export interface AuthVerifyResult {
  ok: boolean;
  status: number;
  code?: string;
  message?: string;
  caller?: AdminCaller;
}

export interface ServiceResult<T = unknown> {
  ok: boolean;
  status: number;
  code?: string;
  message?: string;
  data?: T;
}

export type RealAuthStatus =
  | 'active'
  | 'confirmed_pending_login'
  | 'invited'
  | 'unconfirmed'
  | 'no_auth_user';

export interface AdminAccountRecord {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  grade: string | null;
  studentCode: string | null;
  teacherCode: string | null;
  subject: string | null;
  schoolName: string;
  createdAt: string | null;
  authStatus: RealAuthStatus;
  authStatusLabel: string;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
  lastSignInAt: string | null;
  enrolledClasses: { id: string; name: string; classCode?: string | null; grade: string; schoolYear?: string }[];
  teachingClasses: {
    id: string;
    name: string;
    classCode?: string | null;
    grade: string;
    schoolYear?: string;
    subject?: string | null;
    subjectLabel?: string;
  }[];
}

export interface AdminClassStudentSummary {
  id: string;
  code: string;
  fullName: string;
  email: string;
}

export interface AdminClassSummary {
  id: string;
  name: string;
  classCode: string | null;
  grade: string;
  schoolYear: string;
  teacherId: string | null;
  teacherName: string | null;
  inviteCode: string;
  memberCount: number;
  students: AdminClassStudentSummary[];
}

export interface AdminAuditLogRow {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  details: string;
}

export interface AdminWorkspacePayload {
  accounts: AdminAccountRecord[];
  classes: AdminClassSummary[];
  teachingAssignments: TeachingAssignment[];
  classRoles: ClassRoleAssignment[];
  cutoverReadiness: CutoverReadinessReport;
  auditLogs: AdminAuditLogRow[];
  auditLogsWarning?: string | null;
  teachingSchemaReady: boolean;
  teachingSchemaWarning?: string | null;
  teacherPerClassLimitNotice: string;
  serviceRoleConfigured?: boolean;
}

export interface CreateClassRoleInput {
  schoolYear?: string;
  classId: string;
  teacherId: string;
  roleType: ClassRoleType;
  notes?: string;
}

export interface CreateAccountInput {
  fullName: string;
  email?: string;
  role: 'student' | 'teacher' | 'reviewer';
  studentCode?: string;
  teacherCode?: string;
  grade?: string;
  subject?: string;
  classId?: string;
  replaceExistingClassTeacher?: boolean;
}

export interface CreateAccountResponseData {
  accountCreated: boolean;
  profileSaved: boolean;
  inviteSent: boolean;
  account: AdminAccountRecord;
  classAssigned: boolean;
  classError?: string;
  initialPassword?: string;
  loginIdentifier?: string;
  mustChangePassword?: boolean;
  classConflict?: {
    classId: string;
    className: string;
    currentTeacherId: string;
    currentTeacherName: string;
  };
}

export interface CreateClassInput {
  name: string;
  grade: string;
  schoolYear: string;
  classCode?: string;
}

export interface UpdateClassInput {
  name?: string;
  grade?: string;
  schoolYear?: string;
  classCode?: string;
}

export interface CreateTeachingAssignmentBatchInput {
  schoolYear: string;
  teacherId: string;
  subject: string;
  classIds: string[];
  notes?: string;
}

export interface UpdateTeachingAssignmentInput {
  schoolYear?: string;
  classId?: string;
  subject?: string;
  notes?: string;
}

export interface ExcelImportRowResult {
  rowNumber: number;
  status: 'ready' | 'created' | 'reused' | 'skipped' | 'partial_failed' | 'error';
  statusLabel: string;
  code?: string;
  message: string;
  columns: Record<string, string>;
  accountId?: string;
  accountCreated?: boolean;
  classAssigned?: boolean;
  canRetryClassAssign?: boolean;
  existingAccountId?: string;
  existingRole?: string;
  initialPassword?: string;
  loginIdentifier?: string;
  mustChangePassword?: boolean;
}

export interface ExcelImportBatchResult {
  kind: 'students' | 'teachers' | 'assignments';
  dryRun: boolean;
  targetClass?: { id: string; name: string; classCode?: string | null; grade: string; schoolYear: string };
  summary: {
    totalRows: number;
    readyToApply: number;
    createdCount: number;
    reusedCount: number;
    skippedCount: number;
    partialFailedCount: number;
    errorCount: number;
  };
  rows: ExcelImportRowResult[];
}

const VALID_ROLES: UserRole[] = ['student', 'teacher', 'reviewer', 'admin'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveStudentInternalDomain(): string {
  return normalizeInternalAuthDomain(process.env.STUDENT_AUTH_INTERNAL_DOMAIN);
}

/**
 * Tạo mật khẩu khởi tạo ngẫu nhiên, riêng biệt và đủ mạnh cho học sinh mới
 * bằng CSPRNG (crypto.randomInt), loại bỏ các ký tự dễ nhầm lẫn (0/O/1/l/I).
 */
export function generateInitialStudentPassword(): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#%!+';
  const allAlnum = uppers + lowers + digits;

  const chars: string[] = [
    uppers[crypto.randomInt(0, uppers.length)],
    lowers[crypto.randomInt(0, lowers.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)]
  ];

  for (let i = 0; i < 4; i++) {
    chars.push(allAlnum[crypto.randomInt(0, allAlnum.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return `Td${chars.join('')}`;
}

export function isValidUuid(val?: string | null): boolean {
  return Boolean(val && UUID_REGEX.test(val.trim()));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeCode(code?: string | null): string {
  return normalizeStudentCode(code);
}

function isMissingSchemaObjectError(err: any): boolean {
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

export function formatInviteEmailError(errMsg: string): string {
  const lower = (errMsg || '').toLowerCase();
  if (
    lower.includes('smtp') ||
    lower.includes('error sending') ||
    lower.includes('mail') ||
    lower.includes('rate limit') ||
    lower.includes('unexpected_failure')
  ) {
    return (
      `Chưa thể gửi email mời từ Supabase Auth (${errMsg}). ` +
      'Vui lòng kiểm tra cấu hình Authentication → SMTP Settings, Email Templates (Invite user) và URL Configuration (Site URL / Redirect URLs) trên Supabase Dashboard.'
    );
  }
  return `Lỗi Supabase Auth khi gửi lời mời email: ${errMsg}`;
}

export function deriveAuthStatus(
  authUser: any,
  hasVerifiedProfileRow = false
): {
  status: RealAuthStatus;
  label: string;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
  lastSignInAt: string | null;
} {
  if (!authUser) {
    if (hasVerifiedProfileRow) {
      return {
        status: 'active',
        label: 'Đã kích hoạt',
        emailConfirmedAt: null,
        invitedAt: null,
        lastSignInAt: null
      };
    }
    return {
      status: 'no_auth_user',
      label: 'Chưa liên kết Auth',
      emailConfirmedAt: null,
      invitedAt: null,
      lastSignInAt: null
    };
  }
  const emailConfirmedAt = authUser.email_confirmed_at ? String(authUser.email_confirmed_at) : null;
  const invitedAt = authUser.invited_at ? String(authUser.invited_at) : null;
  const lastSignInAt = authUser.last_sign_in_at ? String(authUser.last_sign_in_at) : null;
  const isStudentCodeAuth =
    isStudentInternalAuthEmail(authUser.email) ||
    authUser.user_metadata?.auth_login_mode === 'student_code';

  if (emailConfirmedAt && lastSignInAt) {
    return {
      status: 'active',
      label: 'Đã kích hoạt',
      emailConfirmedAt,
      invitedAt,
      lastSignInAt
    };
  }
  if (emailConfirmedAt) {
    return {
      status: 'confirmed_pending_login',
      label: isStudentCodeAuth ? 'Đã cấp MK (Chờ ĐN)' : 'Đã xác nhận email',
      emailConfirmedAt,
      invitedAt,
      lastSignInAt
    };
  }
  if (invitedAt) {
    return {
      status: 'invited',
      label: 'Đã gửi lời mời',
      emailConfirmedAt,
      invitedAt,
      lastSignInAt
    };
  }
  return {
    status: 'unconfirmed',
    label: 'Chờ xác nhận email',
    emailConfirmedAt,
    invitedAt,
    lastSignInAt
  };
}

function isAuthAdminNotAllowedError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err || '').toLowerCase();
  const code = String(err.code || '').toLowerCase();
  const status = Number(err.status || 0);
  return (
    code === 'not_admin' ||
    status === 401 ||
    status === 403 ||
    msg.includes('not allowed') ||
    msg.includes('not_admin') ||
    msg.includes('service_role') ||
    msg.includes(' forbidden') ||
    msg.includes('jwt')
  );
}

export async function listAllAuthUsers(
  supabaseAdmin: any
): Promise<{ users: any[]; error?: string; authAdminAvailable: boolean }> {
  if (supabaseAdmin?.__isServiceRoleClient === false || !supabaseAdmin?.auth?.admin?.listUsers) {
    return { users: [], authAdminAvailable: false };
  }

  const allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      if (isAuthAdminNotAllowedError(error)) {
        return { users: [], authAdminAvailable: false };
      }
      return {
        users: [],
        error: error.message || 'Không thể truy vấn danh sách Auth users.',
        authAdminAvailable: true
      };
    }
    const batch = Array.isArray(data?.users) ? data.users : [];
    allUsers.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
    if (page > 20) break;
  }

  return { users: allUsers, authAdminAvailable: true };
}

export async function writeServerAuditLog(
  supabaseAdmin: any,
  caller: AdminCaller,
  action: string,
  target: string,
  details: string,
  targetId?: string
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      actor_name: caller.fullName || caller.email,
      role: caller.role,
      action,
      target,
      details
    };
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      ...payload,
      actor_id: caller.id,
      target_id: targetId || null
    });
    if (error) {
      await supabaseAdmin.from('audit_logs').insert(payload);
    }
  } catch {
    // Audit logging is best-effort
  }
}

export async function verifyAdminCaller(
  supabaseAdmin: any,
  authHeader?: string | null
): Promise<AuthVerifyResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Thiếu token xác thực phiên đăng nhập. Vui lòng đăng nhập bằng tài khoản Quản trị viên.'
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

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_SESSION',
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
    };
  }

  const authUserId = userData.user.id;
  const { data: profile, error: profError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', authUserId)
    .maybeSingle();

  if (profError) {
    return {
      ok: false,
      status: 500,
      code: 'PROFILE_VERIFY_FAILED',
      message: `Không thể xác minh vai trò từ bảng public.profiles: ${profError.message}`
    };
  }

  if (!profile) {
    return {
      ok: false,
      status: 403,
      code: 'PROFILE_NOT_FOUND',
      message: 'Tài khoản chưa có hồ sơ trong bảng public.profiles nên không thể truy cập khu vực quản trị.'
    };
  }

  if (profile.role !== 'admin') {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'Từ chối truy cập (403): Chức năng này chỉ dành cho Quản trị viên (role = admin).'
    };
  }

  return {
    ok: true,
    status: 200,
    caller: {
      id: String(profile.id),
      email: String(profile.email || userData.user.email || ''),
      fullName: String(profile.full_name || 'Quản trị viên'),
      role: 'admin'
    }
  };
}

async function queryProfilesSafe(supabaseAdmin: any) {
  let res = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, grade, student_code, teacher_code, subject, school_name, created_at')
    .order('created_at', { ascending: false });
  let hasTeacherCodeColumn = true;
  if (res.error && isMissingSchemaObjectError(res.error)) {
    hasTeacherCodeColumn = false;
    res = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, grade, student_code, subject, school_name, created_at')
      .order('created_at', { ascending: false });
  }
  return { res, hasTeacherCodeColumn };
}

async function queryClassesSafe(supabaseAdmin: any) {
  let res = await supabaseAdmin
    .from('classes')
    .select('id, name, class_code, grade, school_year, teacher_id, teacher_name, invite_code, created_at')
    .order('grade', { ascending: true });
  let hasClassCodeColumn = true;
  if (res.error && isMissingSchemaObjectError(res.error)) {
    hasClassCodeColumn = false;
    res = await supabaseAdmin
      .from('classes')
      .select('id, name, grade, school_year, teacher_id, teacher_name, invite_code, created_at')
      .order('grade', { ascending: true });
  }
  return { res, hasClassCodeColumn };
}

export function buildCutoverReadinessReport(params: {
  classRows: any[];
  teachingAssignments: TeachingAssignment[];
  classRoles: ClassRoleAssignment[];
  assignmentRows: any[];
  examRows: any[];
  submissionRows: any[];
  profileById: Map<string, any>;
}): CutoverReadinessReport {
  const {
    classRows,
    teachingAssignments,
    classRoles,
    assignmentRows,
    examRows,
    submissionRows,
    profileById
  } = params;

  const examSubjectById = new Map<string, string>();
  for (const ex of examRows || []) {
    const res = resolveCanonicalSubject(ex?.subject);
    examSubjectById.set(
      String(ex.id),
      res.ok && res.subjectId ? res.subjectId : String(ex?.subject || '').trim().toLowerCase()
    );
  }

  const subCountByAsg = new Map<string, number>();
  for (const s of submissionRows || []) {
    const aid = String(s.assignment_id || '');
    if (!aid) continue;
    subCountByAsg.set(aid, (subCountByAsg.get(aid) || 0) + 1);
  }

  const asgsByClass = new Map<string, any[]>();
  for (const a of assignmentRows || []) {
    const cid = String(a.class_id || '');
    if (!cid) continue;
    const list = asgsByClass.get(cid) || [];
    list.push(a);
    asgsByClass.set(cid, list);
  }

  const missingSubjectItems: CutoverMissingSubjectItem[] = [];
  for (const ta of teachingAssignments) {
    if (ta.status !== 'active') continue;
    const hasSubject = Boolean(ta.subject && String(ta.subject).trim());
    if (!ta.needsSubjectCompletion && hasSubject) continue;

    const clsAsgs = asgsByClass.get(ta.classId) || [];
    const affectedAsgs = clsAsgs.filter(
      a => !a.assigned_by || String(a.assigned_by) === ta.teacherId
    );
    const affectedSubs = affectedAsgs.reduce(
      (sum, a) => sum + (subCountByAsg.get(String(a.id)) || 0),
      0
    );

    missingSubjectItems.push({
      teachingAssignmentId: ta.id,
      schoolYear: ta.schoolYear,
      classId: ta.classId,
      classCode: ta.classCode || null,
      className: ta.className || 'Lớp học',
      grade: String(ta.grade || ''),
      teacherId: ta.teacherId,
      teacherCode: ta.teacherCode || null,
      teacherName: ta.teacherName || 'Giáo viên',
      teacherEmail: ta.teacherEmail || '',
      affectedAssignmentsCount: affectedAsgs.length,
      affectedSubmissionsCount: affectedSubs,
      notes: ta.notes || null
    });
  }

  const impactedClasses: CutoverImpactedClassItem[] = [];
  for (const cls of classRows || []) {
    const cid = String(cls.id);
    const schoolYear = String(cls.school_year || '2025-2026');
    const clsMissing = teachingAssignments.filter(
      ta =>
        ta.classId === cid &&
        ta.status === 'active' &&
        (ta.needsSubjectCompletion || !ta.subject || !String(ta.subject).trim())
    ).length;

    const clsCompleted = teachingAssignments.filter(
      ta =>
        ta.classId === cid &&
        ta.status === 'active' &&
        !ta.needsSubjectCompletion &&
        Boolean(ta.subject && String(ta.subject).trim()) &&
        ta.schoolYear.trim() === schoolYear.trim()
    ).length;

    const clsRolesCount = classRoles.filter(
      cr =>
        cr.classId === cid &&
        cr.status === 'active' &&
        cr.schoolYear.trim() === schoolYear.trim()
    ).length;

    const clsAsgs = asgsByClass.get(cid) || [];
    const totalSubCount = clsAsgs.reduce(
      (sum, a) => sum + (subCountByAsg.get(String(a.id)) || 0),
      0
    );

    let unmappedAsgsCount = 0;
    for (const a of clsAsgs) {
      if (!a.assigned_by) {
        unmappedAsgsCount += 1;
        continue;
      }
      const rawSubj = a.subject_code || examSubjectById.get(String(a.exam_id)) || '';
      const resolvedSubj = resolveCanonicalSubject(rawSubj);
      const normSubj = resolvedSubj.ok && resolvedSubj.subjectId
        ? resolvedSubj.subjectId
        : String(rawSubj).trim().toLowerCase();

      const hasMatchingTa = teachingAssignments.some(ta => {
        if (
          ta.classId !== cid ||
          ta.teacherId !== String(a.assigned_by) ||
          ta.status !== 'active' ||
          ta.needsSubjectCompletion ||
          !ta.subject ||
          ta.schoolYear.trim() !== schoolYear.trim()
        ) {
          return false;
        }
        const taSubjRes = resolveCanonicalSubject(ta.subject);
        const taNorm = taSubjRes.ok && taSubjRes.subjectId
          ? taSubjRes.subjectId
          : String(ta.subject).trim().toLowerCase();
        return Boolean(normSubj && taNorm === normSubj);
      });

      if (!hasMatchingTa) {
        unmappedAsgsCount += 1;
      }
    }

    const legacyTeacherId = cls.teacher_id ? String(cls.teacher_id) : null;
    const legacyTeacherProf = legacyTeacherId ? profileById.get(legacyTeacherId) : null;
    const isLegacyOnlyUnmapped = Boolean(legacyTeacherId && clsRolesCount === 0 && clsCompleted === 0);

    if (clsMissing > 0 || isLegacyOnlyUnmapped || unmappedAsgsCount > 0) {
      let impactReason = 'Sẵn sàng';
      if (clsMissing > 0 && legacyTeacherId && clsRolesCount === 0) {
        impactReason =
          'Còn phân công "Thiếu môn" và giáo viên cũ chưa có vai trò phụ trách lớp riêng (class_roles). Sẽ mất quyền giao/chấm/quản lý thành viên khi bật Bước 5.';
      } else if (clsMissing > 0) {
        impactReason =
          'Còn phân công "Thiếu môn" chưa xác định môn giảng dạy (sẽ bị chặn giao/chấm bài ở Bước 5).';
      } else if (isLegacyOnlyUnmapped) {
        impactReason =
          'Lớp chỉ có teacher_id cũ, chưa có phân công môn và chưa cấp vai trò phụ trách lớp (sẽ không có giáo viên truy cập lớp ở Bước 5).';
      } else if (unmappedAsgsCount > 0) {
        impactReason =
          'Có lượt giao bài cũ mà người giao chưa có phân công hoạt động đúng môn tại lớp.';
      }

      impactedClasses.push({
        classId: cid,
        className: String(cls.name || 'Lớp học'),
        classCode: cls.class_code ? String(cls.class_code) : null,
        grade: String(cls.grade || ''),
        schoolYear,
        legacyTeacherId,
        legacyTeacherName: legacyTeacherProf?.full_name
          ? String(legacyTeacherProf.full_name)
          : cls.teacher_name
          ? String(cls.teacher_name)
          : null,
        legacyTeacherCode: legacyTeacherProf?.teacher_code ? String(legacyTeacherProf.teacher_code) : null,
        missingSubjectCount: clsMissing,
        completedSubjectCount: clsCompleted,
        explicitClassRoleCount: clsRolesCount,
        totalAssignmentsCount: clsAsgs.length,
        totalSubmissionsCount: totalSubCount,
        unmappedAssignmentsCount: unmappedAsgsCount,
        impactReason
      });
    }
  }

  return {
    readyForCutover: missingSubjectItems.length === 0 && impactedClasses.length === 0,
    missingSubjectCount: missingSubjectItems.length,
    impactedClassCount: impactedClasses.length,
    missingSubjectItems,
    impactedClasses
  };
}

export async function listAdminWorkspace(
  supabaseAdmin: any
): Promise<ServiceResult<AdminWorkspacePayload>> {
  const [authRes, profQuery, clsQuery, membersRes, taRes, crRes, asgRes, exmRes, subRes, auditRes] =
    await Promise.all([
      listAllAuthUsers(supabaseAdmin),
      queryProfilesSafe(supabaseAdmin),
      queryClassesSafe(supabaseAdmin),
      supabaseAdmin.from('class_members').select('id, class_id, student_id, joined_at'),
      supabaseAdmin
        .from('teaching_assignments')
        .select('id, school_year, teacher_id, class_id, subject, status, needs_subject_completion, notes, started_at, ended_at, created_at')
        .order('school_year', { ascending: false }),
      supabaseAdmin
        .from('class_roles')
        .select('id, school_year, class_id, teacher_id, role_type, status, notes, granted_at, ended_at')
        .order('school_year', { ascending: false }),
      supabaseAdmin.from('assignments').select('id, class_id, exam_id, assigned_by, subject_code'),
      supabaseAdmin.from('exams').select('id, subject'),
      supabaseAdmin.from('submissions').select('id, assignment_id'),
      supabaseAdmin
        .from('audit_logs')
        .select('id, timestamp, actor_name, role, action, target, details')
        .order('timestamp', { ascending: false })
        .limit(100)
    ]);

  const profilesRes = profQuery.res;
  const classesRes = clsQuery.res;

  if (profilesRes.error) {
    return {
      ok: false,
      status: 500,
      code: 'PROFILES_QUERY_FAILED',
      message: `Không thể tải danh sách hồ sơ từ public.profiles: ${profilesRes.error.message}`
    };
  }
  if (classesRes.error) {
    return {
      ok: false,
      status: 500,
      code: 'CLASSES_QUERY_FAILED',
      message: `Không thể tải danh sách lớp học từ public.classes: ${classesRes.error.message}`
    };
  }
  if (membersRes.error) {
    return {
      ok: false,
      status: 500,
      code: 'CLASS_MEMBERS_QUERY_FAILED',
      message: `Không thể tải danh sách thành viên lớp: ${membersRes.error.message}`
    };
  }
  if (authRes.error) {
    return {
      ok: false,
      status: 500,
      code: 'AUTH_USERS_QUERY_FAILED',
      message: `Không thể tải trạng thái xác thực từ Supabase Auth: ${authRes.error}`
    };
  }

  const teachingSchemaReady =
    profQuery.hasTeacherCodeColumn && clsQuery.hasClassCodeColumn && !taRes.error;
  const teachingSchemaWarning = !teachingSchemaReady
    ? 'CSDL Supabase chưa áp dụng đủ migration bước 4 (src/data/04_teaching_assignments_and_codes.sql). Chức năng đa giáo viên theo (Lớp, Môn, Năm học) và danh sách "Thiếu môn" cần chạy file SQL 04 trong Supabase SQL Editor.'
    : null;

  const authById = new Map<string, any>();
  for (const au of authRes.users) {
    if (au?.id) authById.set(String(au.id), au);
  }

  const profileRows = profilesRes.data || [];
  const profileById = new Map<string, any>(profileRows.map((p: any) => [String(p.id), p]));

  const classRows = classesRes.data || [];
  const classMap = new Map<string, any>(classRows.map((cls: any) => [String(cls.id), cls]));

  const memberRows = membersRes.data || [];
  const studentsByClass = new Map<string, AdminClassStudentSummary[]>();
  const enrolledByStudent = new Map<
    string,
    { id: string; name: string; classCode?: string | null; grade: string; schoolYear?: string }[]
  >();

  for (const m of memberRows) {
    const cid = String(m.class_id);
    const sid = String(m.student_id);
    const cls = classMap.get(cid);
    const stuProfile = profileById.get(sid);

    const clsRoster = studentsByClass.get(cid) || [];
    if (!clsRoster.some(item => item.id === sid)) {
      clsRoster.push({
        id: sid,
        code: stuProfile?.student_code ? String(stuProfile.student_code) : '',
        fullName: String(stuProfile?.full_name || 'Học sinh'),
        email: String(stuProfile?.email || '')
      });
    }
    studentsByClass.set(cid, clsRoster);

    if (cls) {
      const list = enrolledByStudent.get(sid) || [];
      if (!list.some(item => item.id === cid)) {
        list.push({
          id: cid,
          name: String(cls.name || 'Lớp học'),
          classCode: cls.class_code ? String(cls.class_code) : null,
          grade: String(cls.grade || ''),
          schoolYear: cls.school_year ? String(cls.school_year) : undefined
        });
      }
      enrolledByStudent.set(sid, list);
    }
  }

  const teachingAssignments: TeachingAssignment[] = !taRes.error && Array.isArray(taRes.data)
    ? taRes.data.map((row: any) => {
        const teacherProf = profileById.get(String(row.teacher_id));
        const cls = classMap.get(String(row.class_id));
        const subj = row.subject ? String(row.subject) : null;
        return {
          id: String(row.id),
          schoolYear: String(row.school_year || cls?.school_year || '2025-2026'),
          teacherId: String(row.teacher_id),
          teacherCode: teacherProf?.teacher_code ? String(teacherProf.teacher_code) : null,
          teacherName: String(teacherProf?.full_name || 'Giáo viên'),
          teacherEmail: String(teacherProf?.email || ''),
          classId: String(row.class_id),
          classCode: cls?.class_code ? String(cls.class_code) : null,
          className: String(cls?.name || 'Lớp học'),
          grade: (cls?.grade as Grade) || '8',
          subject: subj,
          subjectLabel: getSubjectDisplayName(subj),
          status: row.status === 'ended' ? 'ended' : 'active',
          needsSubjectCompletion: Boolean(row.needs_subject_completion || !subj),
          notes: row.notes ? String(row.notes) : null,
          startedAt: row.started_at ? String(row.started_at) : undefined,
          endedAt: row.ended_at ? String(row.ended_at) : null
        };
      })
    : classRows
        .filter((c: any) => Boolean(c.teacher_id))
        .map((c: any) => {
          const teacherProf = profileById.get(String(c.teacher_id));
          return {
            id: `legacy-${c.id}-${c.teacher_id}`,
            schoolYear: String(c.school_year || '2025-2026'),
            teacherId: String(c.teacher_id),
            teacherCode: teacherProf?.teacher_code ? String(teacherProf.teacher_code) : null,
            teacherName: String(teacherProf?.full_name || c.teacher_name || 'Giáo viên'),
            teacherEmail: String(teacherProf?.email || ''),
            classId: String(c.id),
            classCode: c.class_code ? String(c.class_code) : null,
            className: String(c.name || 'Lớp học'),
            grade: (c.grade as Grade) || '8',
            subject: null,
            subjectLabel: 'Chưa bổ sung môn',
            status: 'active' as const,
            needsSubjectCompletion: true,
            notes: 'Thiếu môn — phân công cũ từ classes.teacher_id (chưa tự suy đoán môn).'
          };
        });

  const classRoles: ClassRoleAssignment[] = !crRes.error && Array.isArray(crRes.data)
    ? crRes.data.map((row: any) => {
        const teacherProf = profileById.get(String(row.teacher_id));
        const cls = classMap.get(String(row.class_id));
        const roleType: ClassRoleType = row.role_type === 'class_manager' ? 'class_manager' : 'homeroom';
        return {
          id: String(row.id),
          schoolYear: String(row.school_year || cls?.school_year || '2025-2026'),
          classId: String(row.class_id),
          classCode: cls?.class_code ? String(cls.class_code) : null,
          className: String(cls?.name || 'Lớp học'),
          grade: (cls?.grade as Grade) || '8',
          teacherId: String(row.teacher_id),
          teacherCode: teacherProf?.teacher_code ? String(teacherProf.teacher_code) : null,
          teacherName: String(teacherProf?.full_name || 'Giáo viên'),
          teacherEmail: String(teacherProf?.email || ''),
          roleType,
          roleLabel: roleType === 'homeroom' ? 'Chủ nhiệm lớp' : 'Quản lý danh sách lớp',
          status: row.status === 'ended' ? 'ended' : 'active',
          notes: row.notes ? String(row.notes) : null,
          grantedAt: row.granted_at ? String(row.granted_at) : undefined,
          endedAt: row.ended_at ? String(row.ended_at) : null
        };
      })
    : [];

  const teachingByTeacher = new Map<string, AdminAccountRecord['teachingClasses']>();
  for (const ta of teachingAssignments) {
    if (ta.status !== 'active') continue;
    const list = teachingByTeacher.get(ta.teacherId) || [];
    list.push({
      id: ta.classId,
      name: ta.className || 'Lớp học',
      classCode: ta.classCode || null,
      grade: String(ta.grade || ''),
      schoolYear: ta.schoolYear,
      subject: ta.subject,
      subjectLabel: ta.subjectLabel
    });
    teachingByTeacher.set(ta.teacherId, list);
  }
  for (const cls of classRows) {
    if (cls.teacher_id) {
      const tid = String(cls.teacher_id);
      const cid = String(cls.id);
      const list = teachingByTeacher.get(tid) || [];
      if (!list.some(item => item.id === cid)) {
        list.push({
          id: cid,
          name: String(cls.name || 'Lớp học'),
          classCode: cls.class_code ? String(cls.class_code) : null,
          grade: String(cls.grade || ''),
          schoolYear: cls.school_year ? String(cls.school_year) : undefined,
          subject: null,
          subjectLabel: 'Chưa bổ sung môn'
        });
      }
      teachingByTeacher.set(tid, list);
    }
  }

  const accounts: AdminAccountRecord[] = profileRows.map((p: any) => {
    const pid = String(p.id);
    const authUser = authById.get(pid);
    const authMeta = deriveAuthStatus(authUser, !authRes.authAdminAvailable);
    return {
      id: pid,
      fullName: String(p.full_name || 'Chưa đặt tên'),
      email: String(p.email || authUser?.email || ''),
      role: (VALID_ROLES.includes(p.role) ? p.role : 'student') as UserRole,
      grade: p.grade ? String(p.grade) : null,
      studentCode: p.student_code ? String(p.student_code) : null,
      teacherCode: p.teacher_code ? String(p.teacher_code) : null,
      subject: p.subject ? String(p.subject) : null,
      schoolName: String(p.school_name || 'Trường THCS Tây Đô'),
      createdAt: p.created_at ? String(p.created_at) : null,
      authStatus: authMeta.status,
      authStatusLabel: authMeta.label,
      emailConfirmedAt: authMeta.emailConfirmedAt,
      invitedAt: authMeta.invitedAt,
      lastSignInAt: authMeta.lastSignInAt,
      enrolledClasses: enrolledByStudent.get(pid) || [],
      teachingClasses: teachingByTeacher.get(pid) || []
    };
  });

  const classes: AdminClassSummary[] = classRows.map((c: any) => {
    const cid = String(c.id);
    const roster = studentsByClass.get(cid) || [];
    const activeTeachersForClass = teachingAssignments
      .filter(ta => ta.classId === cid && ta.status === 'active')
      .map(ta => `${ta.teacherName || 'GV'}${ta.subject ? ` (${getSubjectDisplayName(ta.subject)})` : ''}`);
    const uniqueTeacherSummary = Array.from(new Set(activeTeachersForClass)).join(', ');

    return {
      id: cid,
      name: String(c.name || ''),
      classCode: c.class_code ? String(c.class_code) : null,
      grade: String(c.grade || ''),
      schoolYear: String(c.school_year || '2025-2026'),
      teacherId: c.teacher_id ? String(c.teacher_id) : null,
      teacherName: uniqueTeacherSummary || (c.teacher_name ? String(c.teacher_name) : null),
      inviteCode: String(c.invite_code || ''),
      memberCount: roster.length,
      students: roster
    };
  });

  const cutoverReadiness = buildCutoverReadinessReport({
    classRows,
    teachingAssignments,
    classRoles,
    assignmentRows: !asgRes.error && Array.isArray(asgRes.data) ? asgRes.data : [],
    examRows: !exmRes.error && Array.isArray(exmRes.data) ? exmRes.data : [],
    submissionRows: !subRes.error && Array.isArray(subRes.data) ? subRes.data : [],
    profileById
  });

  const auditLogs: AdminAuditLogRow[] = !auditRes.error && Array.isArray(auditRes.data)
    ? auditRes.data.map((row: any) => ({
        id: String(row.id),
        timestamp: String(row.timestamp || ''),
        actor: String(row.actor_name || 'Hệ thống'),
        role: String(row.role || 'admin'),
        action: String(row.action || ''),
        target: String(row.target || ''),
        details: String(row.details || '')
      }))
    : [];

  return {
    ok: true,
    status: 200,
    data: {
      accounts,
      classes,
      teachingAssignments,
      classRoles,
      cutoverReadiness,
      auditLogs,
      auditLogsWarning: auditRes.error
        ? 'Bảng public.audit_logs chưa sẵn sàng hoặc cần chạy migration 03_admin_accounts_rbac.sql.'
        : null,
      teachingSchemaReady,
      teachingSchemaWarning,
      teacherPerClassLimitNotice: teachingSchemaReady
        ? 'Hệ thống tách riêng vai trò phụ trách lớp (public.class_roles) và phân công giảng dạy theo môn (public.teaching_assignments).'
        : 'Hãy chạy migration 04_teaching_assignments_and_codes.sql để bổ sung bảng phân công môn, class_roles và danh sách "Thiếu môn" trước khi bật Bước 5.',
      serviceRoleConfigured: Boolean(authRes.authAdminAvailable)
    }
  };
}

export async function getCutoverReadinessReport(
  supabaseAdmin: any
): Promise<ServiceResult<CutoverReadinessReport>> {
  const ws = await listAdminWorkspace(supabaseAdmin);
  if (!ws.ok || !ws.data) {
    return {
      ok: false,
      status: ws.status,
      code: ws.code,
      message: ws.message
    };
  }
  return {
    ok: true,
    status: 200,
    data: ws.data.cutoverReadiness
  };
}

export async function createClassByAdmin(
  supabaseAdmin: any,
  input: CreateClassInput,
  caller: AdminCaller
): Promise<ServiceResult<{ classRoom: AdminClassSummary }>> {
  const name = String(input.name || '').trim();
  const grade = String(input.grade || '').trim();
  const schoolYear = String(input.schoolYear || '2025-2026').trim();
  const rawClassCode = String(input.classCode || '').trim();
  const derivedCode = normalizeCode(
    rawClassCode ||
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9]/g, '')
  );

  if (!name) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_NAME', message: 'Vui lòng nhập tên lớp học.' };
  }
  if (!['6', '7', '8', '9'].includes(grade)) {
    return { ok: false, status: 400, code: 'INVALID_GRADE', message: 'Khối lớp phải từ 6 đến 9.' };
  }
  if (!schoolYear) {
    return { ok: false, status: 400, code: 'INVALID_SCHOOL_YEAR', message: 'Vui lòng nhập năm học (VD: 2025-2026).' };
  }
  if (!derivedCode) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_CODE', message: 'Mã lớp không hợp lệ.' };
  }

  const { res: clsQueryRes, hasClassCodeColumn } = await queryClassesSafe(supabaseAdmin);
  if (clsQueryRes.error) {
    return {
      ok: false,
      status: 500,
      code: 'CLASSES_QUERY_FAILED',
      message: `Không thể kiểm tra danh sách lớp hiện có: ${clsQueryRes.error.message}`
    };
  }

  const existingInYear = (clsQueryRes.data || []).filter(
    (c: any) => String(c.school_year || '').trim() === schoolYear
  );
  const dupByName = existingInYear.find(
    (c: any) => String(c.name || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (dupByName) {
    return {
      ok: false,
      status: 409,
      code: 'CLASS_NAME_EXISTS',
      message: `Lớp "${name}" đã tồn tại trong năm học ${schoolYear}.`
    };
  }

  if (hasClassCodeColumn) {
    const dupByCode = existingInYear.find(
      (c: any) => normalizeCode(c.class_code) === derivedCode
    );
    if (dupByCode) {
      return {
        ok: false,
        status: 409,
        code: 'CLASS_CODE_EXISTS',
        message: `Mã lớp "${derivedCode}" đã thuộc về lớp "${dupByCode.name}" trong năm học ${schoolYear}.`
      };
    }
  }

  const cleanCodeToken = derivedCode.replace(/[^A-Z0-9]/g, '') || 'LOP';
  const inviteCode = `TAYDO-${cleanCodeToken}-${new Date().getFullYear().toString().slice(-2)}${Math.floor(10 + Math.random() * 89)}`;

  const insertPayload: Record<string, any> = {
    name,
    grade,
    school_year: schoolYear,
    teacher_id: null,
    teacher_name: null,
    invite_code: inviteCode
  };
  if (hasClassCodeColumn) {
    insertPayload.class_code = derivedCode;
  }

  const selectCols = hasClassCodeColumn
    ? 'id, name, class_code, grade, school_year, teacher_id, teacher_name, invite_code'
    : 'id, name, grade, school_year, teacher_id, teacher_name, invite_code';

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('classes')
    .insert(insertPayload)
    .select(selectCols)
    .single();

  if (insertErr || !inserted) {
    return {
      ok: false,
      status: 500,
      code: 'CREATE_CLASS_FAILED',
      message: `Không thể tạo lớp học mới trên Supabase: ${insertErr?.message || 'Lỗi không xác định'}`
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Tạo lớp học mới',
    `${inserted.name} (${schoolYear})`,
    `Tạo lớp ${inserted.name}, Khối ${grade}, Mã lớp ${derivedCode}, Năm học ${schoolYear}`,
    String(inserted.id)
  );

  return {
    ok: true,
    status: 201,
    message: `Đã tạo lớp "${inserted.name}" (Năm học ${schoolYear}).`,
    data: {
      classRoom: {
        id: String(inserted.id),
        name: String(inserted.name),
        classCode: inserted.class_code ? String(inserted.class_code) : derivedCode,
        grade: String(inserted.grade),
        schoolYear: String(inserted.school_year),
        teacherId: null,
        teacherName: null,
        inviteCode: String(inserted.invite_code),
        memberCount: 0,
        students: []
      }
    }
  };
}

export async function updateClassByAdmin(
  supabaseAdmin: any,
  classId: string,
  input: UpdateClassInput,
  caller: AdminCaller
): Promise<ServiceResult<{ classRoom: AdminClassSummary }>> {
  if (!isValidUuid(classId)) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_ID', message: 'Mã định danh lớp học không hợp lệ.' };
  }

  const { res: clsQueryRes, hasClassCodeColumn } = await queryClassesSafe(supabaseAdmin);
  if (clsQueryRes.error) {
    return {
      ok: false,
      status: 500,
      code: 'CLASSES_QUERY_FAILED',
      message: `Không thể truy vấn danh sách lớp: ${clsQueryRes.error.message}`
    };
  }

  const allClasses = clsQueryRes.data || [];
  const currentClass = allClasses.find((c: any) => String(c.id) === classId);
  if (!currentClass) {
    return { ok: false, status: 404, code: 'CLASS_NOT_FOUND', message: 'Không tìm thấy lớp học cần chỉnh sửa.' };
  }

  const nextName = input.name !== undefined ? String(input.name).trim() : String(currentClass.name || '').trim();
  const nextGrade = input.grade !== undefined ? String(input.grade).trim() : String(currentClass.grade || '8').trim();
  const nextSchoolYear =
    input.schoolYear !== undefined
      ? String(input.schoolYear).trim()
      : String(currentClass.school_year || '2025-2026').trim();
  const rawClassCode =
    input.classCode !== undefined
      ? String(input.classCode).trim()
      : String(currentClass.class_code || '').trim();

  const derivedCode = normalizeCode(
    rawClassCode ||
      nextName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9]/g, '')
  );

  if (!nextName) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_NAME', message: 'Vui lòng nhập tên lớp học.' };
  }
  if (!['6', '7', '8', '9'].includes(nextGrade)) {
    return { ok: false, status: 400, code: 'INVALID_GRADE', message: 'Khối lớp phải từ 6 đến 9.' };
  }
  if (!nextSchoolYear) {
    return { ok: false, status: 400, code: 'INVALID_SCHOOL_YEAR', message: 'Vui lòng nhập năm học (VD: 2025-2026).' };
  }
  if (!derivedCode) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_CODE', message: 'Mã lớp không hợp lệ.' };
  }

  const siblingsInYear = allClasses.filter(
    (c: any) => String(c.id) !== classId && String(c.school_year || '').trim() === nextSchoolYear
  );

  const dupByName = siblingsInYear.find(
    (c: any) => String(c.name || '').trim().toLowerCase() === nextName.toLowerCase()
  );
  if (dupByName) {
    return {
      ok: false,
      status: 409,
      code: 'CLASS_NAME_EXISTS',
      message: `Lớp "${nextName}" đã tồn tại trong năm học ${nextSchoolYear}.`
    };
  }

  if (hasClassCodeColumn) {
    const dupByCode = siblingsInYear.find((c: any) => normalizeCode(c.class_code) === derivedCode);
    if (dupByCode) {
      return {
        ok: false,
        status: 409,
        code: 'CLASS_CODE_EXISTS',
        message: `Mã lớp "${derivedCode}" đã thuộc về lớp "${dupByCode.name}" trong năm học ${nextSchoolYear}.`
      };
    }
  }

  const updatePayload: Record<string, any> = {
    name: nextName,
    grade: nextGrade,
    school_year: nextSchoolYear
  };
  if (hasClassCodeColumn) {
    updatePayload.class_code = derivedCode;
  }

  const selectCols = hasClassCodeColumn
    ? 'id, name, class_code, grade, school_year, teacher_id, teacher_name, invite_code'
    : 'id, name, grade, school_year, teacher_id, teacher_name, invite_code';

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('classes')
    .update(updatePayload)
    .eq('id', classId)
    .select(selectCols)
    .single();

  if (updateErr || !updated) {
    return {
      ok: false,
      status: 500,
      code: 'UPDATE_CLASS_FAILED',
      message: `Không thể cập nhật thông tin lớp học: ${updateErr?.message || 'Lỗi không xác định'}`
    };
  }

  // Keep active teaching_assignments and class_roles school_year aligned if schoolYear was changed
  const prevYear = String(currentClass.school_year || '').trim();
  if (prevYear && prevYear !== nextSchoolYear) {
    await Promise.all([
      supabaseAdmin
        .from('teaching_assignments')
        .update({ school_year: nextSchoolYear, updated_by: caller.id })
        .eq('class_id', classId)
        .eq('status', 'active'),
      supabaseAdmin
        .from('class_roles')
        .update({ school_year: nextSchoolYear })
        .eq('class_id', classId)
        .eq('status', 'active')
    ]).catch(() => undefined);
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Cập nhật lớp học',
    `${updated.name} (${nextSchoolYear})`,
    `Cập nhật lớp ${updated.name}, Khối ${nextGrade}, Mã lớp ${derivedCode}, Năm học ${nextSchoolYear}`,
    classId
  );

  return {
    ok: true,
    status: 200,
    message: `Đã cập nhật thông tin lớp "${updated.name}" (${nextSchoolYear}).`,
    data: {
      classRoom: {
        id: String(updated.id),
        name: String(updated.name),
        classCode: updated.class_code ? String(updated.class_code) : derivedCode,
        grade: String(updated.grade),
        schoolYear: String(updated.school_year),
        teacherId: updated.teacher_id ? String(updated.teacher_id) : null,
        teacherName: updated.teacher_name ? String(updated.teacher_name) : null,
        inviteCode: String(updated.invite_code || ''),
        memberCount: 0,
        students: []
      }
    }
  };
}

export async function deleteClassByAdmin(
  supabaseAdmin: any,
  classId: string,
  caller: AdminCaller
): Promise<ServiceResult<{ deletedId: string; name: string }>> {
  if (!isValidUuid(classId)) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_ID', message: 'Mã định danh lớp học không hợp lệ.' };
  }

  const { data: cls, error: clsErr } = await supabaseAdmin
    .from('classes')
    .select('id, name, grade, school_year')
    .eq('id', classId)
    .maybeSingle();

  if (clsErr || !cls) {
    return { ok: false, status: 404, code: 'CLASS_NOT_FOUND', message: 'Không tìm thấy lớp học cần xóa.' };
  }

  // Protect student exam submissions & historical grades
  const { data: classAssignments, error: asgErr } = await supabaseAdmin
    .from('assignments')
    .select('id')
    .eq('class_id', classId);

  if (!asgErr && Array.isArray(classAssignments) && classAssignments.length > 0) {
    const asgIds = classAssignments.map((a: any) => String(a.id));
    const { data: existingSubs } = await supabaseAdmin
      .from('submissions')
      .select('id')
      .in('assignment_id', asgIds)
      .limit(1);

    if (Array.isArray(existingSubs) && existingSubs.length > 0) {
      return {
        ok: false,
        status: 409,
        code: 'CLASS_HAS_SUBMISSIONS',
        message: `Lớp "${cls.name}" (${cls.school_year}) đã có bài nộp điểm số của học sinh. Để bảo toàn dữ liệu lịch sử học tập, hệ thống không cho phép xóa lớp đã phát sinh bài làm.`
      };
    }
  }

  // Delete memberships, teaching_assignments, class_roles, and empty assignments for this class only
  await Promise.all([
    supabaseAdmin.from('class_members').delete().eq('class_id', classId),
    supabaseAdmin.from('teaching_assignments').delete().eq('class_id', classId),
    supabaseAdmin.from('class_roles').delete().eq('class_id', classId),
    supabaseAdmin.from('assignments').delete().eq('class_id', classId)
  ]).catch(() => undefined);

  const { error: delErr } = await supabaseAdmin
    .from('classes')
    .delete()
    .eq('id', classId);

  if (delErr) {
    return {
      ok: false,
      status: 500,
      code: 'DELETE_CLASS_FAILED',
      message: `Không thể xóa lớp "${cls.name}": ${delErr.message}`
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Xóa lớp học',
    `${cls.name} (${cls.school_year})`,
    `Đã xóa lớp ${cls.name} (Khối ${cls.grade}, Năm học ${cls.school_year})`,
    classId
  );

  return {
    ok: true,
    status: 200,
    message: `Đã xóa lớp "${cls.name}" (${cls.school_year}).`,
    data: {
      deletedId: classId,
      name: String(cls.name)
    }
  };
}

export async function createTeachingAssignmentsBatch(
  supabaseAdmin: any,
  input: CreateTeachingAssignmentBatchInput,
  caller: AdminCaller
): Promise<
  ServiceResult<{
    created: TeachingAssignment[];
    alreadyAssigned: { classId: string; className: string }[];
  }>
> {
  const schoolYear = String(input.schoolYear || '2025-2026').trim();
  const teacherId = String(input.teacherId || '').trim();
  const classIds = Array.isArray(input.classIds)
    ? Array.from(new Set(input.classIds.map(id => String(id || '').trim()).filter(Boolean)))
    : [];
  const notes = input.notes ? String(input.notes).trim() : null;

  if (!schoolYear) {
    return { ok: false, status: 400, code: 'INVALID_SCHOOL_YEAR', message: 'Vui lòng chọn năm học.' };
  }
  if (!isValidUuid(teacherId)) {
    return { ok: false, status: 400, code: 'INVALID_TEACHER_ID', message: 'Mã giáo viên không hợp lệ.' };
  }
  if (classIds.length === 0 || classIds.some(id => !isValidUuid(id))) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_IDS', message: 'Vui lòng chọn ít nhất 1 lớp học hợp lệ.' };
  }

  const subjectRes = resolveCanonicalSubject(input.subject);
  if (!subjectRes.ok || !subjectRes.subjectId) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_SUBJECT',
      message: subjectRes.error || 'Môn giảng dạy không hợp lệ.'
    };
  }
  const canonicalSubject = subjectRes.subjectId;

  const { data: teacherProfile, error: tErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, teacher_code')
    .eq('id', teacherId)
    .maybeSingle();

  if (tErr && isMissingSchemaObjectError(tErr)) {
    return {
      ok: false,
      status: 400,
      code: 'MIGRATION_04_REQUIRED',
      message: 'Cần chạy migration src/data/04_teaching_assignments_and_codes.sql trước khi lưu phân công giảng dạy theo môn.'
    };
  }

  if (tErr || !teacherProfile) {
    return { ok: false, status: 404, code: 'TEACHER_NOT_FOUND', message: 'Không tìm thấy hồ sơ giáo viên.' };
  }
  if (!['teacher', 'admin'].includes(teacherProfile.role)) {
    return {
      ok: false,
      status: 400,
      code: 'ROLE_NOT_TEACHER',
      message: 'Chỉ tài khoản có vai trò Giáo viên hoặc Quản trị viên mới được phân công giảng dạy.'
    };
  }

  const { data: classRows, error: cErr } = await supabaseAdmin
    .from('classes')
    .select('id, name, class_code, grade, school_year')
    .in('id', classIds);

  if (cErr) {
    return { ok: false, status: 500, code: 'CLASS_QUERY_FAILED', message: cErr.message };
  }

  const classById = new Map<string, any>((classRows || []).map((c: any) => [String(c.id), c]));
  for (const cid of classIds) {
    const cls = classById.get(cid);
    if (!cls) {
      return { ok: false, status: 404, code: 'CLASS_NOT_FOUND', message: `Không tìm thấy lớp học ID ${cid}.` };
    }
    if (String(cls.school_year || '').trim() !== schoolYear) {
      return {
        ok: false,
        status: 400,
        code: 'SCHOOL_YEAR_MISMATCH',
        message: `Lớp "${cls.name}" thuộc năm học ${cls.school_year}, không khớp với năm học phân công ${schoolYear}.`
      };
    }
  }

  const { data: existingRows, error: exErr } = await supabaseAdmin
    .from('teaching_assignments')
    .select('id, class_id, subject, status')
    .eq('teacher_id', teacherId)
    .eq('school_year', schoolYear)
    .eq('status', 'active')
    .in('class_id', classIds);

  if (exErr) {
    if (isMissingSchemaObjectError(exErr)) {
      return {
        ok: false,
        status: 400,
        code: 'MIGRATION_04_REQUIRED',
        message: 'Bảng public.teaching_assignments chưa tồn tại. Hãy chạy migration src/data/04_teaching_assignments_and_codes.sql.'
      };
    }
    return { ok: false, status: 500, code: 'ASSIGNMENT_CHECK_FAILED', message: exErr.message };
  }

  const alreadyActiveClassIds = new Set(
    (existingRows || [])
      .filter((r: any) => r.subject && String(r.subject).toLowerCase() === canonicalSubject.toLowerCase())
      .map((r: any) => String(r.class_id))
  );

  const alreadyAssigned: { classId: string; className: string }[] = [];
  const toInsert: any[] = [];

  for (const cid of classIds) {
    const cls = classById.get(cid);
    if (alreadyActiveClassIds.has(cid)) {
      alreadyAssigned.push({ classId: cid, className: String(cls.name) });
    } else {
      toInsert.push({
        school_year: schoolYear,
        teacher_id: teacherId,
        class_id: cid,
        subject: canonicalSubject,
        status: 'active',
        needs_subject_completion: false,
        notes,
        created_by: caller.id,
        updated_by: caller.id
      });
    }
  }

  let created: TeachingAssignment[] = [];
  if (toInsert.length > 0) {
    const { data: insertedRows, error: insErr } = await supabaseAdmin
      .from('teaching_assignments')
      .insert(toInsert)
      .select('id, school_year, teacher_id, class_id, subject, status, needs_subject_completion, notes, started_at, ended_at');

    if (insErr) {
      return {
        ok: false,
        status: 500,
        code: 'CREATE_ASSIGNMENT_FAILED',
        message: `Không thể lưu phân công giảng dạy: ${insErr.message}`
      };
    }

    created = (insertedRows || []).map((row: any) => {
      const cls = classById.get(String(row.class_id));
      return {
        id: String(row.id),
        schoolYear: String(row.school_year),
        teacherId: String(row.teacher_id),
        teacherCode: teacherProfile.teacher_code ? String(teacherProfile.teacher_code) : null,
        teacherName: String(teacherProfile.full_name),
        teacherEmail: String(teacherProfile.email),
        classId: String(row.class_id),
        classCode: cls?.class_code ? String(cls.class_code) : null,
        className: String(cls?.name || ''),
        grade: (cls?.grade as Grade) || '8',
        subject: String(row.subject),
        subjectLabel: getSubjectDisplayName(row.subject),
        status: 'active',
        needsSubjectCompletion: false,
        notes: row.notes ? String(row.notes) : null,
        startedAt: row.started_at ? String(row.started_at) : undefined,
        endedAt: null
      };
    });

    await writeServerAuditLog(
      supabaseAdmin,
      caller,
      'Phân công giảng dạy',
      teacherProfile.email || teacherProfile.full_name,
      `Phân công ${teacherProfile.full_name} dạy môn ${getSubjectDisplayName(canonicalSubject)} (${schoolYear}) cho ${created.map(c => c.className).join(', ')}`,
      teacherId
    );
  }

  return {
    ok: true,
    status: created.length > 0 ? 201 : 200,
    message:
      created.length > 0
        ? `Đã phân công ${teacherProfile.full_name} dạy môn ${getSubjectDisplayName(canonicalSubject)} cho ${created.length} lớp${alreadyAssigned.length > 0 ? ` (${alreadyAssigned.length} lớp đã tồn tại trước đó)` : ''}.`
        : `Tất cả ${alreadyAssigned.length} lớp đã được phân công môn ${getSubjectDisplayName(canonicalSubject)} cho giáo viên này.`,
    data: { created, alreadyAssigned }
  };
}

export async function updateTeachingAssignment(
  supabaseAdmin: any,
  assignmentId: string,
  input: UpdateTeachingAssignmentInput,
  caller: AdminCaller
): Promise<ServiceResult<{ assignment: TeachingAssignment }>> {
  if (!isValidUuid(assignmentId)) {
    return { ok: false, status: 400, code: 'INVALID_UUID', message: 'Mã phân công không hợp lệ.' };
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('teaching_assignments')
    .select('id, school_year, teacher_id, class_id, subject, status, needs_subject_completion, notes, started_at, ended_at')
    .eq('id', assignmentId)
    .maybeSingle();

  if (fetchErr && isMissingSchemaObjectError(fetchErr)) {
    return {
      ok: false,
      status: 400,
      code: 'MIGRATION_04_REQUIRED',
      message: 'Cần chạy migration src/data/04_teaching_assignments_and_codes.sql trước khi chỉnh sửa phân công giảng dạy.'
    };
  }
  if (fetchErr || !existing) {
    return { ok: false, status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'Không tìm thấy bản ghi phân công.' };
  }

  const nextClassId = input.classId ? String(input.classId).trim() : String(existing.class_id);
  if (!isValidUuid(nextClassId)) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_ID', message: 'Mã lớp không hợp lệ.' };
  }

  let nextSubject = existing.subject ? String(existing.subject) : null;
  if (input.subject !== undefined) {
    const resolved = resolveCanonicalSubject(input.subject);
    if (!resolved.ok || !resolved.subjectId) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_SUBJECT',
        message: resolved.error || 'Môn giảng dạy không hợp lệ.'
      };
    }
    nextSubject = resolved.subjectId;
  }

  if (!nextSubject) {
    return { ok: false, status: 400, code: 'MISSING_SUBJECT', message: 'Vui lòng chọn môn giảng dạy.' };
  }

  const { data: cls, error: clsErr } = await supabaseAdmin
    .from('classes')
    .select('id, name, class_code, grade, school_year')
    .eq('id', nextClassId)
    .maybeSingle();
  if (clsErr || !cls) {
    return { ok: false, status: 404, code: 'CLASS_NOT_FOUND', message: 'Không tìm thấy lớp học đã chọn.' };
  }

  const nextSchoolYear = input.schoolYear ? String(input.schoolYear).trim() : String(cls.school_year);
  if (nextSchoolYear !== String(cls.school_year)) {
    return {
      ok: false,
      status: 400,
      code: 'SCHOOL_YEAR_MISMATCH',
      message: `Năm học (${nextSchoolYear}) không khớp với năm học của lớp ${cls.name} (${cls.school_year}).`
    };
  }

  // Prevent collision with another active assignment row
  if (existing.status === 'active') {
    const { data: dupRows } = await supabaseAdmin
      .from('teaching_assignments')
      .select('id, subject')
      .eq('school_year', nextSchoolYear)
      .eq('teacher_id', existing.teacher_id)
      .eq('class_id', nextClassId)
      .eq('status', 'active')
      .neq('id', assignmentId);

    const conflict = (dupRows || []).find(
      (r: any) => r.subject && String(r.subject).toLowerCase() === nextSubject!.toLowerCase()
    );
    if (conflict) {
      return {
        ok: false,
        status: 409,
        code: 'DUPLICATE_TEACHING_ASSIGNMENT',
        message: `Giáo viên này đã có phân công môn ${getSubjectDisplayName(nextSubject)} tại lớp ${cls.name} (${nextSchoolYear}).`
      };
    }
  }

  const updatePayload: Record<string, any> = {
    school_year: nextSchoolYear,
    class_id: nextClassId,
    subject: nextSubject,
    needs_subject_completion: false,
    updated_by: caller.id
  };
  if (input.notes !== undefined) {
    updatePayload.notes = input.notes ? String(input.notes).trim() : null;
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('teaching_assignments')
    .update(updatePayload)
    .eq('id', assignmentId)
    .select('id, school_year, teacher_id, class_id, subject, status, needs_subject_completion, notes, started_at, ended_at')
    .single();

  if (updErr || !updated) {
    return {
      ok: false,
      status: 500,
      code: 'UPDATE_ASSIGNMENT_FAILED',
      message: `Không thể cập nhật phân công: ${updErr?.message || 'Lỗi không xác định'}`
    };
  }

  const { data: teacherProf } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, teacher_code')
    .eq('id', updated.teacher_id)
    .maybeSingle();

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Cập nhật phân công giảng dạy',
    `${teacherProf?.full_name || updated.teacher_id} - ${cls.name}`,
    `Cập nhật môn ${getSubjectDisplayName(updated.subject)} tại lớp ${cls.name} (${nextSchoolYear})`,
    String(updated.teacher_id)
  );

  return {
    ok: true,
    status: 200,
    message: `Đã cập nhật phân công: ${teacherProf?.full_name || 'Giáo viên'} • ${getSubjectDisplayName(updated.subject)} • ${cls.name}.`,
    data: {
      assignment: {
        id: String(updated.id),
        schoolYear: String(updated.school_year),
        teacherId: String(updated.teacher_id),
        teacherCode: teacherProf?.teacher_code ? String(teacherProf.teacher_code) : null,
        teacherName: String(teacherProf?.full_name || 'Giáo viên'),
        teacherEmail: String(teacherProf?.email || ''),
        classId: String(updated.class_id),
        classCode: cls.class_code ? String(cls.class_code) : null,
        className: String(cls.name),
        grade: (cls.grade as Grade) || '8',
        subject: String(updated.subject),
        subjectLabel: getSubjectDisplayName(updated.subject),
        status: updated.status === 'ended' ? 'ended' : 'active',
        needsSubjectCompletion: false,
        notes: updated.notes ? String(updated.notes) : null,
        startedAt: updated.started_at ? String(updated.started_at) : undefined,
        endedAt: updated.ended_at ? String(updated.ended_at) : null
      }
    }
  };
}

export async function endTeachingAssignment(
  supabaseAdmin: any,
  assignmentId: string,
  caller: AdminCaller
): Promise<ServiceResult<{ id: string; status: 'ended' }>> {
  if (!isValidUuid(assignmentId)) {
    return { ok: false, status: 400, code: 'INVALID_UUID', message: 'Mã phân công không hợp lệ.' };
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('teaching_assignments')
    .select('id, school_year, teacher_id, class_id, subject, status')
    .eq('id', assignmentId)
    .maybeSingle();

  if (fetchErr && isMissingSchemaObjectError(fetchErr)) {
    return {
      ok: false,
      status: 400,
      code: 'MIGRATION_04_REQUIRED',
      message: 'Cần chạy migration src/data/04_teaching_assignments_and_codes.sql trước khi kết thúc phân công.'
    };
  }
  if (fetchErr || !existing) {
    return { ok: false, status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'Không tìm thấy bản ghi phân công.' };
  }

  if (existing.status === 'ended') {
    return {
      ok: true,
      status: 200,
      message: 'Phân công này đã kết thúc trước đó.',
      data: { id: assignmentId, status: 'ended' }
    };
  }

  const { error: updErr } = await supabaseAdmin
    .from('teaching_assignments')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      updated_by: caller.id
    })
    .eq('id', assignmentId);

  if (updErr) {
    return {
      ok: false,
      status: 500,
      code: 'END_ASSIGNMENT_FAILED',
      message: `Không thể kết thúc phân công: ${updErr.message}`
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Kết thúc phân công giảng dạy',
    assignmentId,
    `Kết thúc phân công môn ${getSubjectDisplayName(existing.subject)} (${existing.school_year})`,
    String(existing.teacher_id)
  );

  return {
    ok: true,
    status: 200,
    message: 'Đã kết thúc phân công giảng dạy (quyền giao bài và chấm bài theo môn này đã hết hiệu lực, lịch sử cũ vẫn được bảo toàn).',
    data: { id: assignmentId, status: 'ended' }
  };
}

export async function createClassRoleByAdmin(
  supabaseAdmin: any,
  input: CreateClassRoleInput,
  caller: AdminCaller
): Promise<ServiceResult<{ classRole: ClassRoleAssignment; alreadyActive?: boolean }>> {
  const classId = String(input.classId || '').trim();
  const teacherId = String(input.teacherId || '').trim();
  const roleType: ClassRoleType = input.roleType === 'class_manager' ? 'class_manager' : 'homeroom';
  const notes = input.notes ? String(input.notes).trim() : null;

  if (!isValidUuid(classId) || !isValidUuid(teacherId)) {
    return { ok: false, status: 400, code: 'INVALID_UUID', message: 'Mã lớp hoặc mã giáo viên không hợp lệ.' };
  }

  const [{ data: cls, error: clsErr }, { data: prof, error: profErr }] = await Promise.all([
    supabaseAdmin.from('classes').select('id, name, class_code, grade, school_year').eq('id', classId).maybeSingle(),
    supabaseAdmin.from('profiles').select('id, full_name, email, role, teacher_code').eq('id', teacherId).maybeSingle()
  ]);

  if (clsErr || !cls) {
    return { ok: false, status: 404, code: 'CLASS_NOT_FOUND', message: 'Không tìm thấy lớp học được chọn.' };
  }
  if (profErr || !prof) {
    return { ok: false, status: 404, code: 'TEACHER_NOT_FOUND', message: 'Không tìm thấy hồ sơ giáo viên.' };
  }
  if (prof.role !== 'teacher' && prof.role !== 'admin') {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_TEACHER_ROLE',
      message: 'Chỉ tài khoản vai trò Giáo viên hoặc Quản trị viên mới được cấp vai trò phụ trách lớp.'
    };
  }

  const schoolYear = String(input.schoolYear || cls.school_year || '2025-2026').trim();
  if (schoolYear !== String(cls.school_year || '2025-2026').trim()) {
    return {
      ok: false,
      status: 400,
      code: 'SCHOOL_YEAR_MISMATCH',
      message: `Năm học vai trò lớp (${schoolYear}) không khớp năm học của lớp (${cls.school_year}).`
    };
  }

  const { data: existing, error: exErr } = await supabaseAdmin
    .from('class_roles')
    .select('id, school_year, class_id, teacher_id, role_type, status, notes, granted_at, ended_at')
    .eq('school_year', schoolYear)
    .eq('class_id', classId)
    .eq('teacher_id', teacherId)
    .eq('role_type', roleType)
    .eq('status', 'active')
    .maybeSingle();

  if (exErr) {
    if (isMissingSchemaObjectError(exErr)) {
      return {
        ok: false,
        status: 400,
        code: 'MISSING_CLASS_ROLES_TABLE',
        message: 'Chưa chạy migration 04 (bảng public.class_roles chưa tồn tại).'
      };
    }
    return { ok: false, status: 500, code: 'CLASS_ROLE_CHECK_FAILED', message: exErr.message };
  }

  const roleLabel = roleType === 'homeroom' ? 'Chủ nhiệm lớp' : 'Quản lý danh sách lớp';

  if (existing) {
    return {
      ok: true,
      status: 200,
      message: `Giáo viên "${prof.full_name}" đã có vai trò "${roleLabel}" tại lớp ${cls.name} (${schoolYear}).`,
      data: {
        alreadyActive: true,
        classRole: {
          id: String(existing.id),
          schoolYear,
          classId,
          classCode: cls.class_code ? String(cls.class_code) : null,
          className: String(cls.name),
          grade: String(cls.grade || ''),
          teacherId,
          teacherCode: prof.teacher_code ? String(prof.teacher_code) : null,
          teacherName: String(prof.full_name),
          teacherEmail: String(prof.email || ''),
          roleType,
          roleLabel,
          status: 'active',
          notes: existing.notes ? String(existing.notes) : null,
          grantedAt: existing.granted_at ? String(existing.granted_at) : undefined,
          endedAt: null
        }
      }
    };
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('class_roles')
    .insert({
      school_year: schoolYear,
      class_id: classId,
      teacher_id: teacherId,
      role_type: roleType,
      status: 'active',
      notes,
      granted_by: caller.id
    })
    .select('id, school_year, class_id, teacher_id, role_type, status, notes, granted_at, ended_at')
    .single();

  if (insErr || !inserted) {
    return {
      ok: false,
      status: 500,
      code: 'CLASS_ROLE_INSERT_FAILED',
      message: insErr?.message || 'Không thể cấp vai trò phụ trách lớp.'
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Cấp vai trò phụ trách lớp',
    cls.name,
    `Cấp vai trò "${roleLabel}" cho ${prof.full_name} tại lớp ${cls.name} (${schoolYear})`,
    String(inserted.id)
  );

  return {
    ok: true,
    status: 201,
    message: `Đã cấp vai trò "${roleLabel}" cho ${prof.full_name} tại lớp ${cls.name} (${schoolYear}).`,
    data: {
      classRole: {
        id: String(inserted.id),
        schoolYear,
        classId,
        classCode: cls.class_code ? String(cls.class_code) : null,
        className: String(cls.name),
        grade: String(cls.grade || ''),
        teacherId,
        teacherCode: prof.teacher_code ? String(prof.teacher_code) : null,
        teacherName: String(prof.full_name),
        teacherEmail: String(prof.email || ''),
        roleType,
        roleLabel,
        status: 'active',
        notes,
        grantedAt: inserted.granted_at ? String(inserted.granted_at) : undefined,
        endedAt: null
      }
    }
  };
}

export async function endClassRoleByAdmin(
  supabaseAdmin: any,
  roleId: string,
  caller: AdminCaller
): Promise<ServiceResult<{ id: string; status: 'ended' }>> {
  if (!isValidUuid(roleId)) {
    return { ok: false, status: 400, code: 'INVALID_ROLE_ID', message: 'Mã vai trò phụ trách lớp không hợp lệ.' };
  }

  const { data: existing, error: exErr } = await supabaseAdmin
    .from('class_roles')
    .select('id, class_id, teacher_id, role_type, status')
    .eq('id', roleId)
    .maybeSingle();

  if (exErr || !existing) {
    return { ok: false, status: 404, code: 'CLASS_ROLE_NOT_FOUND', message: 'Không tìm thấy vai trò phụ trách lớp.' };
  }

  const { error: updErr } = await supabaseAdmin
    .from('class_roles')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', roleId);

  if (updErr) {
    return { ok: false, status: 500, code: 'CLASS_ROLE_END_FAILED', message: updErr.message };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Kết thúc vai trò phụ trách lớp',
    roleId,
    `Kết thúc vai trò phụ trách lớp (${existing.role_type}) cho giáo viên ${existing.teacher_id}`,
    roleId
  );

  return {
    ok: true,
    status: 200,
    message: 'Đã kết thúc vai trò phụ trách lớp.',
    data: { id: roleId, status: 'ended' }
  };
}

export async function assignUserToClass(
  supabaseAdmin: any,
  userId: string,
  classId: string,
  options: { replaceExistingTeacher?: boolean; subject?: string },
  caller: AdminCaller
): Promise<
  ServiceResult<{
    assigned: boolean;
    alreadyAssigned?: boolean;
    classId: string;
    className: string;
    conflict?: {
      classId: string;
      className: string;
      currentTeacherId: string;
      currentTeacherName: string;
    };
  }>
> {
  if (!isValidUuid(userId) || !isValidUuid(classId)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_UUID',
      message: 'Mã người dùng hoặc mã lớp học không hợp lệ.'
    };
  }

  const [{ data: profile, error: profErr }, { data: cls, error: clsErr }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('classes')
      .select('id, name, grade, school_year, teacher_id, teacher_name')
      .eq('id', classId)
      .maybeSingle()
  ]);

  if (profErr || !profile) {
    return {
      ok: false,
      status: 404,
      code: 'USER_NOT_FOUND',
      message: 'Không tìm thấy hồ sơ người dùng cần gán lớp.'
    };
  }

  if (clsErr || !cls) {
    return {
      ok: false,
      status: 404,
      code: 'CLASS_NOT_FOUND',
      message: 'Không tìm thấy lớp học được chọn trong CSDL.'
    };
  }

  if (profile.role === 'student') {
    const { data: existingMember, error: checkErr } = await supabaseAdmin
      .from('class_members')
      .select('id')
      .eq('class_id', classId)
      .eq('student_id', userId)
      .maybeSingle();

    if (checkErr) {
      return {
        ok: false,
        status: 500,
        code: 'CLASS_MEMBER_CHECK_FAILED',
        message: `Không thể kiểm tra thành viên lớp: ${checkErr.message}`
      };
    }

    if (existingMember) {
      return {
        ok: true,
        status: 200,
        message: `Học sinh "${profile.full_name}" đã thuộc lớp ${cls.name}.`,
        data: {
          assigned: true,
          alreadyAssigned: true,
          classId: String(cls.id),
          className: String(cls.name)
        }
      };
    }

    // NEVER delete existing class_members from other school years
    const { error: insertErr } = await supabaseAdmin
      .from('class_members')
      .upsert(
        { class_id: classId, student_id: userId },
        { onConflict: 'class_id,student_id', ignoreDuplicates: true }
      );

    if (insertErr && insertErr.code !== '23505') {
      return {
        ok: false,
        status: 500,
        code: 'ENROLL_STUDENT_FAILED',
        message: `Không thể gán học sinh vào lớp ${cls.name}: ${insertErr.message}`
      };
    }

    await writeServerAuditLog(
      supabaseAdmin,
      caller,
      'Gán học sinh vào lớp',
      profile.email || profile.full_name,
      `Gán học sinh ${profile.full_name} vào lớp ${cls.name}`,
      userId
    );

    return {
      ok: true,
      status: 200,
      message: `Đã gán học sinh "${profile.full_name}" vào lớp ${cls.name}.`,
      data: {
        assigned: true,
        classId: String(cls.id),
        className: String(cls.name)
      }
    };
  }

  if (profile.role === 'teacher') {
    if (options?.subject) {
      const batchRes = await createTeachingAssignmentsBatch(
        supabaseAdmin,
        {
          schoolYear: String(cls.school_year || '2025-2026'),
          teacherId: userId,
          subject: options.subject,
          classIds: [classId]
        },
        caller
      );
      if (!batchRes.ok) {
        return {
          ok: false,
          status: batchRes.status,
          code: batchRes.code,
          message: batchRes.message
        };
      }
      return {
        ok: true,
        status: 200,
        message: batchRes.message,
        data: {
          assigned: true,
          alreadyAssigned: (batchRes.data?.alreadyAssigned?.length || 0) > 0 && (batchRes.data?.created?.length || 0) === 0,
          classId: String(cls.id),
          className: String(cls.name)
        }
      };
    }

    // Legacy single-teacher fallback if no subject supplied
    if (cls.teacher_id && String(cls.teacher_id) === userId) {
      return {
        ok: true,
        status: 200,
        message: `Giáo viên "${profile.full_name}" hiện đã phụ trách lớp ${cls.name}.`,
        data: {
          assigned: true,
          alreadyAssigned: true,
          classId: String(cls.id),
          className: String(cls.name)
        }
      };
    }

    if (cls.teacher_id && String(cls.teacher_id) !== userId && !options?.replaceExistingTeacher) {
      let currentTeacherName = cls.teacher_name ? String(cls.teacher_name) : '';
      if (!currentTeacherName) {
        const { data: currentTeacher } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', cls.teacher_id)
          .maybeSingle();
        currentTeacherName = currentTeacher?.full_name || 'Giáo viên khác';
      }

      return {
        ok: false,
        status: 409,
        code: 'CLASS_HAS_TEACHER',
        message:
          `Lớp ${cls.name} hiện đã có giáo viên chủ nhiệm/phụ trách "${currentTeacherName}". ` +
          'Hãy sử dụng tab "Phân công giảng dạy" để thêm giáo viên theo từng môn cho lớp này.',
        data: {
          assigned: false,
          classId: String(cls.id),
          className: String(cls.name),
          conflict: {
            classId: String(cls.id),
            className: String(cls.name),
            currentTeacherId: String(cls.teacher_id),
            currentTeacherName
          }
        }
      };
    }

    const { error: updateErr } = await supabaseAdmin
      .from('classes')
      .update({
        teacher_id: userId,
        teacher_name: profile.full_name
      })
      .eq('id', classId);

    if (updateErr) {
      return {
        ok: false,
        status: 500,
        code: 'ASSIGN_TEACHER_FAILED',
        message: `Không thể phân công giáo viên cho lớp ${cls.name}: ${updateErr.message}`
      };
    }

    await writeServerAuditLog(
      supabaseAdmin,
      caller,
      'Phân công giáo viên vào lớp',
      cls.name,
      `Phân công ${profile.full_name} vào lớp ${cls.name}`,
      userId
    );

    return {
      ok: true,
      status: 200,
      message: `Đã phân công giáo viên "${profile.full_name}" cho lớp ${cls.name}.`,
      data: {
        assigned: true,
        classId: String(cls.id),
        className: String(cls.name)
      }
    };
  }

  return {
    ok: false,
    status: 400,
    code: 'UNSUPPORTED_ROLE_FOR_CLASS',
    message: 'Chỉ tài khoản Học sinh hoặc Giáo viên mới gán vào lớp học.'
  };
}

export async function unassignUserFromClass(
  supabaseAdmin: any,
  userId: string,
  classId: string,
  caller: AdminCaller
): Promise<ServiceResult<{ unassigned: boolean }>> {
  if (!isValidUuid(userId) || !isValidUuid(classId)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_UUID',
      message: 'Mã người dùng hoặc mã lớp học không hợp lệ.'
    };
  }

  const [{ data: profile }, { data: cls }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, email, role').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('classes').select('id, name, teacher_id').eq('id', classId).maybeSingle()
  ]);

  if (!profile || !cls) {
    return {
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Không tìm thấy hồ sơ hoặc lớp học.'
    };
  }

  if (profile.role === 'teacher' && cls.teacher_id === userId) {
    const { error } = await supabaseAdmin
      .from('classes')
      .update({ teacher_id: null, teacher_name: null })
      .eq('id', classId);
    if (error) {
      return {
        ok: false,
        status: 500,
        code: 'UNASSIGN_TEACHER_FAILED',
        message: `Không thể gỡ phân công giáo viên khỏi lớp ${cls.name}: ${error.message}`
      };
    }
    await writeServerAuditLog(
      supabaseAdmin,
      caller,
      'Gỡ phân công giáo viên',
      cls.name,
      `Gỡ phân công phụ trách lớp ${cls.name} của ${profile.full_name}`,
      userId
    );
    return { ok: true, status: 200, message: `Đã gỡ phân công lớp ${cls.name}.`, data: { unassigned: true } };
  }

  // Only remove membership of THIS specific class — never touch other classes or submissions
  const { error } = await supabaseAdmin
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', userId);

  if (error) {
    return {
      ok: false,
      status: 500,
      code: 'UNASSIGN_STUDENT_FAILED',
      message: `Không thể gỡ học sinh khỏi lớp ${cls.name}: ${error.message}`
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Gỡ học sinh khỏi lớp',
    profile.email || profile.full_name,
    `Gỡ ${profile.full_name} khỏi lớp ${cls.name}`,
    userId
  );

  return { ok: true, status: 200, message: `Đã gỡ khỏi lớp ${cls.name}.`, data: { unassigned: true } };
}

export async function createOrInviteAccount(
  supabaseAdmin: any,
  input: CreateAccountInput,
  caller: AdminCaller,
  redirectTo?: string
): Promise<ServiceResult<CreateAccountResponseData & { existingAccountId?: string }>> {
  const fullName = String(input.fullName || '').trim();
  const targetRole = input.role;
  const cleanCode = input.studentCode ? normalizeCode(input.studentCode) : '';
  const cleanTeacherCode = input.teacherCode ? normalizeCode(input.teacherCode) : '';
  const cleanGrade = input.grade ? String(input.grade).trim() : '';
  const cleanSubject = input.subject ? String(input.subject).trim() : '';
  const classId = input.classId ? String(input.classId).trim() : '';

  if (!fullName) {
    return { ok: false, status: 400, code: 'INVALID_FULL_NAME', message: 'Vui lòng nhập họ và tên.' };
  }
  if (!['student', 'teacher', 'reviewer'].includes(targetRole)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_ROLE',
      message: 'Vai trò tạo mới chỉ hỗ trợ Học sinh, Giáo viên hoặc Người kiểm duyệt.'
    };
  }
  if (targetRole === 'student' && cleanGrade && !['6', '7', '8', '9'].includes(cleanGrade)) {
    return { ok: false, status: 400, code: 'INVALID_GRADE', message: 'Khối lớp học sinh phải từ 6 đến 9.' };
  }
  if (classId && !isValidUuid(classId)) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_ID', message: 'Mã lớp học được chọn không hợp lệ.' };
  }

  // =========================================================================
  // LUỒNG TẠO / GÁN HỌC SINH BẰNG MÃ HỌC SINH (KHÔNG CẦN EMAIL HỌC SINH)
  // =========================================================================
  if (targetRole === 'student') {
    if (!cleanCode) {
      return {
        ok: false,
        status: 400,
        code: 'MISSING_STUDENT_CODE',
        message: 'Vui lòng nhập Mã học sinh (dùng làm tên đăng nhập cho học sinh).'
      };
    }
    if (!isValidStudentCode(cleanCode)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_STUDENT_CODE',
        message:
          'Mã học sinh không hợp lệ (chỉ gồm chữ cái không dấu, chữ số, dấu chấm/gạch ngang/gạch dưới, từ 2–32 ký tự).'
      };
    }

    const internalDomain = resolveStudentInternalDomain();
    const internalEmail = buildStudentInternalAuthEmail(cleanCode, internalDomain);

    const { data: matchedByCodeRows, error: codeCheckErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, grade, student_code, teacher_code, subject, school_name, created_at')
      .ilike('student_code', cleanCode);

    if (codeCheckErr) {
      return {
        ok: false,
        status: 500,
        code: 'STUDENT_CODE_CHECK_FAILED',
        message: `Lỗi kiểm tra Mã học sinh trong CSDL: ${codeCheckErr.message}`
      };
    }

    const exactCodeMatches = (matchedByCodeRows || []).filter(
      (r: any) => normalizeCode(r.student_code) === cleanCode
    );

    if (exactCodeMatches.length > 1) {
      return {
        ok: false,
        status: 409,
        code: 'AMBIGUOUS_STUDENT_CODE',
        message: `Mã học sinh "${cleanCode}" đang xuất hiện trên ${exactCodeMatches.length} hồ sơ khác nhau. Vui lòng kiểm tra và xử lý thủ công, hệ thống không tự gộp tài khoản.`
      };
    }

    const existingStudentProf = exactCodeMatches[0] || null;
    if (existingStudentProf) {
      const existingId = String(existingStudentProf.id);
      if (existingStudentProf.role !== 'student') {
        return {
          ok: false,
          status: 409,
          code: 'ROLE_CONFLICT_NOT_STUDENT',
          message: `Mã "${cleanCode}" đang thuộc về tài khoản vai trò "${existingStudentProf.role}".`,
          data: { existingAccountId: existingId } as any
        };
      }

      if (classId) {
        const assignRes = await assignUserToClass(supabaseAdmin, existingId, classId, {}, caller);
        if (!assignRes.ok) {
          return {
            ok: false,
            status: assignRes.status,
            code: assignRes.code || 'ENROLL_STUDENT_FAILED',
            message: assignRes.message || 'Không thể gán học sinh hiện có vào lớp.'
          };
        }

        return {
          ok: true,
          status: 200,
          message:
            assignRes.message ||
            `Học sinh "${existingStudentProf.full_name}" (${cleanCode}) đã tồn tại. Hệ thống giữ nguyên mật khẩu cũ và gán vào lớp.`,
          data: {
            accountCreated: false,
            profileSaved: true,
            inviteSent: false,
            loginIdentifier: cleanCode,
            account: {
              id: existingId,
              fullName: String(existingStudentProf.full_name || fullName),
              email: String(existingStudentProf.email || internalEmail),
              role: 'student',
              grade: existingStudentProf.grade ? String(existingStudentProf.grade) : cleanGrade || '8',
              studentCode: cleanCode,
              teacherCode: null,
              subject: null,
              schoolName: String(existingStudentProf.school_name || 'Trường THCS Tây Đô'),
              createdAt: existingStudentProf.created_at ? String(existingStudentProf.created_at) : null,
              authStatus: 'active',
              authStatusLabel: 'Đã kích hoạt',
              emailConfirmedAt: null,
              invitedAt: null,
              lastSignInAt: null,
              enrolledClasses: [
                {
                  id: assignRes.data?.classId || classId,
                  name: assignRes.data?.className || 'Lớp học',
                  grade: cleanGrade || '8'
                }
              ],
              teachingClasses: []
            },
            classAssigned: true
          }
        };
      }

      return {
        ok: false,
        status: 409,
        code: 'STUDENT_CODE_EXISTS',
        message: `Mã học sinh "${cleanCode}" đã tồn tại (${existingStudentProf.full_name}).`,
        data: { existingAccountId: existingId } as any
      };
    }

    if (supabaseAdmin?.__isServiceRoleClient === false || !supabaseAdmin?.auth?.admin?.createUser) {
      return {
        ok: false,
        status: 503,
        code: 'SERVICE_ROLE_REQUIRED_FOR_CREATE_USER',
        message:
          'Máy chủ cần cấu hình SUPABASE_SERVICE_ROLE_KEY để tạo tài khoản học sinh trực tiếp trên Supabase Auth.'
      };
    }

    const initialPassword = generateInitialStudentPassword();
    const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'student',
        grade: cleanGrade || '8',
        student_code: cleanCode,
        school_name: 'Trường THCS Tây Đô',
        must_change_password: true,
        auth_login_mode: 'student_code'
      }
    });

    if (createError || !createdData?.user) {
      const rawMsg = createError?.message || 'Không tạo được tài khoản học sinh trên Supabase Auth.';
      return {
        ok: false,
        status: 502,
        code: 'AUTH_CREATE_STUDENT_FAILED',
        message: `Lỗi tạo tài khoản học sinh (${cleanCode}): ${rawMsg}`
      };
    }

    const userId = String(createdData.user.id);
    const studentProfilePayload = {
      id: userId,
      full_name: fullName,
      email: internalEmail,
      role: 'student',
      grade: cleanGrade || '8',
      student_code: cleanCode,
      subject: null,
      school_name: 'Trường THCS Tây Đô'
    };

    const { data: savedStudentProfile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .upsert(studentProfilePayload, { onConflict: 'id' })
      .select('id, full_name, email, role, grade, student_code, subject, school_name, created_at')
      .single();

    if (profErr || !savedStudentProfile) {
      return {
        ok: false,
        status: 500,
        code: 'PROFILE_PERSIST_FAILED',
        message: `Đã tạo Auth cho mã ${cleanCode} nhưng chưa lưu được vào public.profiles: ${profErr?.message || 'Lỗi không xác định'}.`
      };
    }

    await writeServerAuditLog(
      supabaseAdmin,
      caller,
      'Tạo tài khoản học sinh theo mã',
      cleanCode,
      `Tạo tài khoản học sinh ${fullName} (Mã HS: ${cleanCode}) và cấp mật khẩu khởi tạo`,
      userId
    );

    let classAssigned = false;
    let classError: string | undefined;
    const enrolledClasses: AdminAccountRecord['enrolledClasses'] = [];

    if (classId) {
      const assignRes = await assignUserToClass(supabaseAdmin, userId, classId, {}, caller);
      if (assignRes.ok && assignRes.data?.assigned) {
        classAssigned = true;
        enrolledClasses.push({
          id: assignRes.data.classId,
          name: assignRes.data.className,
          grade: cleanGrade || ''
        });
      } else {
        classAssigned = false;
        classError = assignRes.message || 'Chưa thể gán lớp cho học sinh vừa tạo.';
      }
    }

    const accountRecord: AdminAccountRecord = {
      id: userId,
      fullName: String(savedStudentProfile.full_name),
      email: String(savedStudentProfile.email),
      role: 'student',
      grade: savedStudentProfile.grade ? String(savedStudentProfile.grade) : null,
      studentCode: cleanCode,
      teacherCode: null,
      subject: null,
      schoolName: String(savedStudentProfile.school_name || 'Trường THCS Tây Đô'),
      createdAt: savedStudentProfile.created_at ? String(savedStudentProfile.created_at) : null,
      authStatus: 'confirmed_pending_login',
      authStatusLabel: 'Đã cấp MK (Chờ ĐN)',
      emailConfirmedAt: new Date().toISOString(),
      invitedAt: null,
      lastSignInAt: null,
      enrolledClasses,
      teachingClasses: []
    };

    return {
      ok: true,
      status: 201,
      message:
        classId && !classAssigned
          ? `Đã tạo tài khoản học sinh ${cleanCode}, nhưng bước gán lớp chưa hoàn tất.`
          : `Đã tạo tài khoản học sinh ${cleanCode} thành công (đăng nhập bằng Mã HS và mật khẩu khởi tạo).`,
      data: {
        accountCreated: true,
        profileSaved: true,
        inviteSent: false,
        account: accountRecord,
        classAssigned,
        classError,
        initialPassword,
        loginIdentifier: cleanCode,
        mustChangePassword: true
      }
    };
  }

  // =========================================================================
  // LUỒNG TẠO TÀI KHOẢN GIÁO VIÊN / KIỂM DUYỆT (GIỮ NGUYÊN CƠ CHẾ EMAIL)
  // =========================================================================
  const cleanEmail = normalizeEmail(String(input.email || ''));
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    return { ok: false, status: 400, code: 'INVALID_EMAIL', message: 'Địa chỉ email không hợp lệ.' };
  }

  // 1. Check duplicate email in public.profiles
  const { data: existingProfileByEmail, error: existingCheckErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, grade, student_code, teacher_code, subject, school_name, created_at')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (existingCheckErr) {
    return {
      ok: false,
      status: 500,
      code: 'EMAIL_CHECK_FAILED',
      message: `Lỗi kiểm tra email tồn tại: ${existingCheckErr.message}`
    };
  }

  if (existingProfileByEmail) {
    return {
      ok: false,
      status: 409,
      code: 'EMAIL_EXISTS',
      message: `Email "${cleanEmail}" đã tồn tại (${existingProfileByEmail.full_name} • ${existingProfileByEmail.role}). Vui lòng mở hồ sơ hiện có để kiểm tra hoặc xử lý.`,
      data: {
        existingAccountId: String(existingProfileByEmail.id)
      } as any
    };
  }

  const authRes = await listAllAuthUsers(supabaseAdmin);
  if (authRes.error) {
    return {
      ok: false,
      status: 500,
      code: 'AUTH_CHECK_FAILED',
      message: `Không thể kiểm tra danh sách Auth users: ${authRes.error}`
    };
  }
  const existingAuthUser = authRes.users.find(
    au => au?.email && normalizeEmail(String(au.email)) === cleanEmail
  );
  if (existingAuthUser) {
    return {
      ok: false,
      status: 409,
      code: 'EMAIL_EXISTS',
      message: `Email "${cleanEmail}" đã tồn tại trên Supabase Auth. Hãy kiểm tra lại trong danh sách tài khoản.`,
      data: {
        existingAccountId: String(existingAuthUser.id)
      } as any
    };
  }

  // Check duplicate teacher_code if schema supports it
  if (targetRole === 'teacher' && cleanTeacherCode) {
    const { data: dupTeacherCode, error: tCodeErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .ilike('teacher_code', cleanTeacherCode)
      .maybeSingle();
    if (!tCodeErr && dupTeacherCode) {
      return {
        ok: false,
        status: 409,
        code: 'TEACHER_CODE_EXISTS',
        message: `Mã giáo viên "${cleanTeacherCode}" đã thuộc về giáo viên "${dupTeacherCode.full_name}" (${dupTeacherCode.email}).`
      };
    }
  }

  if (supabaseAdmin?.__isServiceRoleClient === false || !supabaseAdmin?.auth?.admin?.inviteUserByEmail) {
    return {
      ok: false,
      status: 503,
      code: 'SERVICE_ROLE_REQUIRED_FOR_INVITE',
      message:
        'Máy chủ chưa cấu hình SUPABASE_SERVICE_ROLE_KEY nên không thể gửi email mời tạo tài khoản Auth mới.'
    };
  }

  // 2. Invite via Supabase Auth Admin API
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    cleanEmail,
    {
      data: {
        full_name: fullName,
        role: 'student'
      },
      ...(redirectTo ? { redirectTo } : {})
    }
  );

  if (inviteError || !inviteData?.user) {
    const rawMsg = inviteError?.message || 'Không nhận được dữ liệu người dùng từ Supabase Auth.';
    if (isAuthAdminNotAllowedError(inviteError)) {
      return {
        ok: false,
        status: 503,
        code: 'SERVICE_ROLE_REQUIRED_FOR_INVITE',
        message:
          'Máy chủ cần cấu hình SUPABASE_SERVICE_ROLE_KEY để gửi lời mời kích hoạt tài khoản mới qua Supabase Auth Admin API.'
      };
    }
    const lowerMsg = rawMsg.toLowerCase();
    if (lowerMsg.includes('already') && lowerMsg.includes('registered')) {
      return {
        ok: false,
        status: 409,
        code: 'EMAIL_EXISTS',
        message: `Email "${cleanEmail}" đã được đăng ký trước đó. Vui lòng mở hồ sơ hiện có để kiểm tra.`
      };
    }
    return {
      ok: false,
      status: 502,
      code: 'INVITE_EMAIL_FAILED',
      message: formatInviteEmailError(rawMsg)
    };
  }

  const createdAuthUser = inviteData.user;
  const userId = String(createdAuthUser.id);

  // 3. Persist authoritative profile row via Service Role
  const basePayload: Record<string, any> = {
    id: userId,
    full_name: fullName,
    email: cleanEmail,
    role: targetRole,
    grade: null,
    student_code: null,
    subject: targetRole === 'teacher' ? (cleanSubject || null) : null,
    school_name: 'Trường THCS Tây Đô'
  };
  if (targetRole === 'teacher' && cleanTeacherCode) {
    basePayload.teacher_code = cleanTeacherCode;
  }

  let upsertRes = await supabaseAdmin
    .from('profiles')
    .upsert(basePayload, { onConflict: 'id' })
    .select('id, full_name, email, role, grade, student_code, teacher_code, subject, school_name, created_at')
    .single();

  if (upsertRes.error && isMissingSchemaObjectError(upsertRes.error)) {
    delete basePayload.teacher_code;
    upsertRes = await supabaseAdmin
      .from('profiles')
      .upsert(basePayload, { onConflict: 'id' })
      .select('id, full_name, email, role, grade, student_code, subject, school_name, created_at')
      .single();
  }

  if (upsertRes.error || !upsertRes.data) {
    return {
      ok: false,
      status: 500,
      code: 'PROFILE_PERSIST_FAILED',
      message: `Tài khoản Auth đã được tạo nhưng chưa thể lưu hồ sơ vào public.profiles: ${upsertRes.error?.message || 'Lỗi không xác định'}.`
    };
  }

  const savedProfile = upsertRes.data;

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Tạo & gửi lời mời tài khoản',
    cleanEmail,
    `Khởi tạo tài khoản ${fullName} với vai trò ${targetRole}${cleanTeacherCode ? ` (${cleanTeacherCode})` : ''}`,
    userId
  );

  let classAssigned = false;
  let classError: string | undefined;
  let classConflict: CreateAccountResponseData['classConflict'];
  const enrolledClasses: AdminAccountRecord['enrolledClasses'] = [];
  const teachingClasses: AdminAccountRecord['teachingClasses'] = [];

  if (classId) {
    const assignRes = await assignUserToClass(
      supabaseAdmin,
      userId,
      classId,
      {
        replaceExistingTeacher: Boolean(input.replaceExistingClassTeacher),
        subject: targetRole === 'teacher' ? cleanSubject || undefined : undefined
      },
      caller
    );

    if (assignRes.ok && assignRes.data?.assigned) {
      classAssigned = true;
      if (targetRole === 'teacher') {
        teachingClasses.push({
          id: assignRes.data.classId,
          name: assignRes.data.className,
          grade: ''
        });
      }
    } else {
      classAssigned = false;
      classError = assignRes.message || 'Chưa thể gán lớp cho tài khoản vừa tạo.';
      if (assignRes.data?.conflict) {
        classConflict = assignRes.data.conflict;
      }
    }
  }

  const authMeta = deriveAuthStatus(createdAuthUser);
  const accountRecord: AdminAccountRecord = {
    id: userId,
    fullName: String(savedProfile.full_name),
    email: String(savedProfile.email),
    role: savedProfile.role as UserRole,
    grade: savedProfile.grade ? String(savedProfile.grade) : null,
    studentCode: savedProfile.student_code ? String(savedProfile.student_code) : null,
    teacherCode: savedProfile.teacher_code ? String(savedProfile.teacher_code) : (cleanTeacherCode || null),
    subject: savedProfile.subject ? String(savedProfile.subject) : null,
    schoolName: String(savedProfile.school_name || 'Trường THCS Tây Đô'),
    createdAt: savedProfile.created_at ? String(savedProfile.created_at) : null,
    authStatus: authMeta.status === 'no_auth_user' ? 'invited' : authMeta.status,
    authStatusLabel: authMeta.status === 'no_auth_user' ? 'Đã gửi lời mời' : authMeta.label,
    emailConfirmedAt: authMeta.emailConfirmedAt,
    invitedAt: authMeta.invitedAt || new Date().toISOString(),
    lastSignInAt: authMeta.lastSignInAt,
    enrolledClasses,
    teachingClasses
  };

  return {
    ok: true,
    status: 201,
    message:
      classId && !classAssigned
        ? 'Đã tạo tài khoản và gửi email mời, nhưng bước gán lớp chưa hoàn tất.'
        : classId && classAssigned
        ? 'Đã tạo tài khoản, gửi email mời và gán lớp thành công.'
        : 'Đã tạo tài khoản và gửi email mời kích hoạt thành công.',
    data: {
      accountCreated: true,
      profileSaved: true,
      inviteSent: true,
      account: accountRecord,
      classAssigned,
      classError,
      classConflict
    }
  };
}

/**
 * Cấp lại mật khẩu khởi tạo ngẫu nhiên mới cho Học sinh khi quên mật khẩu (chỉ Quản trị viên thực hiện).
 */
export async function resetStudentPasswordByAdmin(
  supabaseAdmin: any,
  targetUserId: string,
  caller: AdminCaller
): Promise<
  ServiceResult<{
    studentId: string;
    studentCode: string;
    fullName: string;
    initialPassword: string;
    mustChangePassword: boolean;
  }>
> {
  if (!isValidUuid(targetUserId)) {
    return { ok: false, status: 400, code: 'INVALID_UUID', message: 'ID học sinh không hợp lệ.' };
  }

  if (supabaseAdmin?.__isServiceRoleClient === false || !supabaseAdmin?.auth?.admin?.updateUserById) {
    return {
      ok: false,
      status: 503,
      code: 'SERVICE_ROLE_REQUIRED',
      message: 'Máy chủ cần cấu hình SUPABASE_SERVICE_ROLE_KEY để cấp lại mật khẩu học sinh trên Supabase Auth.'
    };
  }

  const { data: targetProfile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, student_code, grade')
    .eq('id', targetUserId)
    .maybeSingle();

  if (profErr || !targetProfile) {
    return {
      ok: false,
      status: 404,
      code: 'STUDENT_NOT_FOUND',
      message: 'Không tìm thấy hồ sơ học sinh trong CSDL.'
    };
  }

  if (targetProfile.role !== 'student') {
    return {
      ok: false,
      status: 400,
      code: 'NOT_A_STUDENT',
      message: 'Chức năng cấp lại mật khẩu khởi tạo chỉ áp dụng cho tài khoản Học sinh.'
    };
  }

  const cleanCode = normalizeCode(targetProfile.student_code);
  if (!cleanCode) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_STUDENT_CODE',
      message: 'Học sinh này chưa có Mã học sinh trong hồ sơ. Vui lòng cập nhật Mã học sinh trước.'
    };
  }

  const { data: authData, error: authGetErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
  if (authGetErr || !authData?.user) {
    return {
      ok: false,
      status: 404,
      code: 'AUTH_USER_NOT_FOUND',
      message: 'Không tìm thấy tài khoản tương ứng trên Supabase Auth.'
    };
  }

  const initialPassword = generateInitialStudentPassword();
  const existingMeta =
    authData.user.user_metadata && typeof authData.user.user_metadata === 'object'
      ? authData.user.user_metadata
      : {};

  const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    password: initialPassword,
    email_confirm: true,
    user_metadata: {
      ...existingMeta,
      full_name: targetProfile.full_name,
      role: 'student',
      student_code: cleanCode,
      must_change_password: true,
      password_reset_at: new Date().toISOString()
    }
  });

  if (updateAuthErr) {
    return {
      ok: false,
      status: 502,
      code: 'RESET_PASSWORD_FAILED',
      message: `Không thể đặt lại mật khẩu trên Supabase Auth: ${updateAuthErr.message}`
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Cấp lại mật khẩu học sinh',
    cleanCode,
    `Cấp mật khẩu khởi tạo mới cho học sinh ${targetProfile.full_name} (Mã HS: ${cleanCode}) — yêu cầu đổi mật khẩu lần đầu`,
    targetUserId
  );

  return {
    ok: true,
    status: 200,
    message: `Đã cấp mật khẩu khởi tạo mới cho học sinh "${targetProfile.full_name}" (${cleanCode}).`,
    data: {
      studentId: targetUserId,
      studentCode: cleanCode,
      fullName: String(targetProfile.full_name || ''),
      initialPassword,
      mustChangePassword: true
    }
  };
}

export async function updateUserRoleByAdmin(
  supabaseAdmin: any,
  targetUserId: string,
  newRole: UserRole,
  caller: AdminCaller
): Promise<ServiceResult<{ id: string; role: UserRole }>> {
  if (!isValidUuid(targetUserId)) {
    return { ok: false, status: 400, code: 'INVALID_UUID', message: 'ID tài khoản không hợp lệ.' };
  }
  if (!VALID_ROLES.includes(newRole)) {
    return { ok: false, status: 400, code: 'INVALID_ROLE', message: 'Vai trò không hợp lệ.' };
  }

  const { data: targetProfile, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', targetUserId)
    .maybeSingle();

  if (fetchErr || !targetProfile) {
    return { ok: false, status: 404, code: 'USER_NOT_FOUND', message: 'Không tìm thấy hồ sơ tài khoản.' };
  }

  if (targetProfile.role === newRole) {
    return {
      ok: true,
      status: 200,
      message: 'Vai trò tài khoản không thay đổi.',
      data: { id: targetUserId, role: newRole }
    };
  }

  if (targetProfile.role === 'admin' && newRole !== 'admin') {
    const { data: adminRows } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');
    if (Array.isArray(adminRows) && adminRows.length <= 1) {
      return {
        ok: false,
        status: 400,
        code: 'LAST_ADMIN_PROTECTED',
        message: 'Không thể hạ quyền Quản trị viên duy nhất còn lại trong hệ thống.'
      };
    }
  }

  const { error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId);

  if (updateErr) {
    return {
      ok: false,
      status: 500,
      code: 'ROLE_UPDATE_FAILED',
      message: `Không thể cập nhật vai trò trên CSDL: ${updateErr.message}`
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Thay đổi vai trò tài khoản',
    targetProfile.email || targetProfile.full_name,
    `Chuyển vai trò của ${targetProfile.full_name} từ ${targetProfile.role} sang ${newRole}`,
    targetUserId
  );

  return {
    ok: true,
    status: 200,
    message: `Đã cập nhật vai trò của "${targetProfile.full_name}" thành ${newRole}.`,
    data: { id: targetUserId, role: newRole }
  };
}

export async function resendInviteEmail(
  supabaseAdmin: any,
  targetUserId: string,
  caller: AdminCaller,
  redirectTo?: string
): Promise<ServiceResult<{ sent: boolean; email: string }>> {
  if (!isValidUuid(targetUserId)) {
    return { ok: false, status: 400, code: 'INVALID_UUID', message: 'ID tài khoản không hợp lệ.' };
  }

  if (supabaseAdmin?.__isServiceRoleClient === false || !supabaseAdmin?.auth?.admin?.getUserById) {
    return {
      ok: false,
      status: 503,
      code: 'SERVICE_ROLE_REQUIRED_FOR_INVITE',
      message: 'Máy chủ cần cấu hình SUPABASE_SERVICE_ROLE_KEY để gửi lại email mời kích hoạt.'
    };
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
  if (authErr || !authData?.user) {
    return {
      ok: false,
      status: 404,
      code: 'AUTH_USER_NOT_FOUND',
      message: 'Không tìm thấy tài khoản tương ứng trên Supabase Auth.'
    };
  }

  const authUser = authData.user;
  if (!authUser.email) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_EMAIL',
      message: 'Tài khoản không có địa chỉ email hợp lệ.'
    };
  }

  if (authUser.email_confirmed_at) {
    return {
      ok: false,
      status: 400,
      code: 'ALREADY_CONFIRMED',
      message:
        'Tài khoản đã xác nhận email trước đó. Người dùng có thể bấm "Quên mật khẩu" trên màn hình đăng nhập để đặt lại mật khẩu.'
    };
  }

  const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(authUser.email, {
    ...(redirectTo ? { redirectTo } : {})
  });

  if (inviteErr) {
    return {
      ok: false,
      status: 502,
      code: 'INVITE_EMAIL_FAILED',
      message: formatInviteEmailError(inviteErr.message)
    };
  }

  await writeServerAuditLog(
    supabaseAdmin,
    caller,
    'Gửi lại email mời kích hoạt',
    authUser.email,
    `Gửi lại email mời kích hoạt tài khoản cho ${authUser.email}`,
    targetUserId
  );

  return {
    ok: true,
    status: 200,
    message: `Đã gửi lại email mời kích hoạt tới ${authUser.email}.`,
    data: { sent: true, email: authUser.email }
  };
}

function summarizeImportResults(
  kind: ExcelImportBatchResult['kind'],
  dryRun: boolean,
  results: ExcelImportRowResult[],
  targetClass?: ExcelImportBatchResult['targetClass']
): ExcelImportBatchResult {
  return {
    kind,
    dryRun,
    ...(targetClass ? { targetClass } : {}),
    summary: {
      totalRows: results.length,
      readyToApply: results.filter(r => r.status === 'ready').length,
      createdCount: results.filter(r => r.status === 'created').length,
      reusedCount: results.filter(r => r.status === 'reused').length,
      skippedCount: results.filter(r => r.status === 'skipped').length,
      partialFailedCount: results.filter(r => r.status === 'partial_failed').length,
      errorCount: results.filter(r => r.status === 'error').length
    },
    rows: results
  };
}

/**
 * Import 1: Nhập học sinh vào 1 lớp cụ thể theo mẫu chuẩn 2 cột (Mã học sinh, Họ và tên)
 * - Không yêu cầu email học sinh, không gửi email mời.
 * - Học sinh mới được tạo trực tiếp trên Supabase Auth với định danh kỹ thuật nội bộ và mật khẩu khởi tạo ngẫu nhiên.
 * - Học sinh đã tồn tại (kể cả học sinh đã tạo ở các lần trước) được đối chiếu theo Mã học sinh,
 *   giữ nguyên tài khoản Auth, email và mật khẩu cũ, chỉ bổ sung liên kết vào lớp nếu chưa có.
 */
export async function runStudentClassImport(
  supabaseAdmin: any,
  classId: string,
  rows: Array<{ rowNumber?: number; studentCode?: string; fullName?: string; email?: string }>,
  caller: AdminCaller,
  _redirectTo: string | undefined,
  dryRun: boolean
): Promise<ServiceResult<ExcelImportBatchResult>> {
  if (!isValidUuid(classId)) {
    return { ok: false, status: 400, code: 'INVALID_CLASS_ID', message: 'Lớp học đích không hợp lệ.' };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, status: 400, code: 'EMPTY_IMPORT_ROWS', message: 'Danh sách học sinh tải lên đang trống.' };
  }

  const [{ data: cls, error: clsErr }, profQuery, authRes, { data: existingMembers }] = await Promise.all([
    supabaseAdmin
      .from('classes')
      .select('id, name, grade, school_year, class_code')
      .eq('id', classId)
      .maybeSingle(),
    queryProfilesSafe(supabaseAdmin),
    listAllAuthUsers(supabaseAdmin),
    supabaseAdmin.from('class_members').select('student_id').eq('class_id', classId)
  ]);

  if (clsErr || !cls) {
    return { ok: false, status: 404, code: 'CLASS_NOT_FOUND', message: 'Không tìm thấy lớp học đích trong CSDL.' };
  }
  if (profQuery.res.error) {
    return { ok: false, status: 500, code: 'PROFILES_QUERY_FAILED', message: profQuery.res.error.message };
  }
  if (authRes.error) {
    return { ok: false, status: 500, code: 'AUTH_USERS_QUERY_FAILED', message: authRes.error };
  }

  const targetClass = {
    id: String(cls.id),
    name: String(cls.name),
    classCode: cls.class_code ? String(cls.class_code) : null,
    grade: String(cls.grade || '8'),
    schoolYear: String(cls.school_year || '2026-2027')
  };

  const internalDomain = resolveStudentInternalDomain();
  const profiles = profQuery.res.data || [];
  const profileById = new Map<string, any>();
  const profileByEmail = new Map<string, any>();
  const profilesByCode = new Map<string, any[]>();

  for (const p of profiles) {
    const pid = String(p.id);
    profileById.set(pid, p);
    if (p.email) {
      profileByEmail.set(normalizeEmail(String(p.email)), p);
    }
    if (p.student_code) {
      const normCode = normalizeCode(String(p.student_code));
      if (normCode) {
        const list = profilesByCode.get(normCode) || [];
        list.push(p);
        profilesByCode.set(normCode, list);
      }
    }
  }

  const authById = new Map<string, any>();
  const authByEmail = new Map<string, any>();
  const authUsersByCode = new Map<string, any[]>();

  for (const au of authRes.users) {
    if (!au?.id) continue;
    const uid = String(au.id);
    authById.set(uid, au);
    if (au.email) {
      authByEmail.set(normalizeEmail(String(au.email)), au);
    }
    const metaCode = au.user_metadata?.student_code ? normalizeCode(String(au.user_metadata.student_code)) : '';
    if (metaCode) {
      const list = authUsersByCode.get(metaCode) || [];
      list.push(au);
      authUsersByCode.set(metaCode, list);
    }
  }

  const memberStudentIds = new Set<string>(
    (existingMembers || []).map((m: any) => String(m.student_id))
  );

  const seenCodesInFile = new Map<string, number>();
  const results: ExcelImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] || {};
    const rowNumber = Number(raw.rowNumber || i + 2);
    const cleanCode = normalizeCode(raw.studentCode);
    const fullName = String(raw.fullName || '').trim();
    const columns = {
      'Mã học sinh': cleanCode,
      'Họ và tên': fullName
    };

    if (!cleanCode || !fullName) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lỗi thiếu dữ liệu',
        code: 'MISSING_FIELDS',
        message: 'Cần nhập đầy đủ 2 cột bắt buộc: Mã học sinh và Họ và tên.',
        columns
      });
      continue;
    }

    if (!isValidStudentCode(cleanCode)) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Mã HS không hợp lệ',
        code: 'INVALID_STUDENT_CODE',
        message: `Mã học sinh "${cleanCode}" không hợp lệ (chỉ dùng chữ cái không dấu, chữ số, dấu chấm/gạch ngang/gạch dưới, từ 2–32 ký tự).`,
        columns
      });
      continue;
    }

    const prevCodeRow = seenCodesInFile.get(cleanCode);
    if (prevCodeRow !== undefined) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Trùng lặp trong tệp',
        code: 'DUPLICATE_IN_FILE',
        message: `Mã học sinh "${cleanCode}" bị lặp lại với dòng ${prevCodeRow} trong tệp tải lên.`,
        columns
      });
      continue;
    }
    seenCodesInFile.set(cleanCode, rowNumber);

    const internalEmail = buildStudentInternalAuthEmail(cleanCode, internalDomain);

    // Tập hợp tất cả bản ghi có thể tương ứng với Mã học sinh này từ profiles và auth.users
    const candidateUserIds = new Set<string>();
    const codeProfiles = profilesByCode.get(cleanCode) || [];
    for (const cp of codeProfiles) {
      candidateUserIds.add(String(cp.id));
    }

    const internalEmailProfile = profileByEmail.get(internalEmail);
    if (internalEmailProfile) {
      candidateUserIds.add(String(internalEmailProfile.id));
    }

    const codeAuthUsers = authUsersByCode.get(cleanCode) || [];
    for (const cau of codeAuthUsers) {
      candidateUserIds.add(String(cau.id));
    }

    const internalAuthUser = authByEmail.get(internalEmail);
    if (internalAuthUser) {
      candidateUserIds.add(String(internalAuthUser.id));
    }

    // Nếu 1 học sinh khớp với nhiều bản ghi không rõ tương ứng -> báo Quản trị viên xử lý, không tự gộp/xóa
    if (candidateUserIds.size > 1) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Trùng nhiều bản ghi',
        code: 'AMBIGUOUS_STUDENT_RECORDS',
        message: `Mã học sinh "${cleanCode}" tương ứng với ${candidateUserIds.size} bản ghi tài khoản khác nhau trong hệ thống. Hệ thống giữ nguyên dữ liệu, không tự gộp hay xóa; vui lòng kiểm tra trong mục Quản lý tài khoản.`,
        columns
      });
      continue;
    }

    const existingStudentId = candidateUserIds.size === 1 ? Array.from(candidateUserIds)[0] : null;
    const existingProf = existingStudentId ? profileById.get(existingStudentId) : null;
    const existingAuth = existingStudentId ? authById.get(existingStudentId) : null;

    if (existingProf && existingProf.role !== 'student') {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Sai vai trò tài khoản',
        code: 'ROLE_CONFLICT_NOT_STUDENT',
        message: `Mã "${cleanCode}" đang gắn với tài khoản vai trò "${existingProf.role}". Không thể nhập làm học sinh.`,
        columns,
        existingAccountId: String(existingProf.id),
        existingRole: String(existingProf.role)
      });
      continue;
    }

    if (
      existingProf &&
      existingProf.student_code &&
      normalizeCode(existingProf.student_code) !== cleanCode
    ) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lệch Mã học sinh',
        code: 'STUDENT_CODE_MISMATCH',
        message: `Tài khoản hiện có đang mang Mã học sinh "${existingProf.student_code}", không khớp với "${cleanCode}".`,
        columns,
        existingAccountId: String(existingProf.id)
      });
      continue;
    }

    // Học sinh đã thuộc lớp đích -> bỏ qua an toàn, giữ nguyên tài khoản & mật khẩu cũ
    if (existingStudentId && memberStudentIds.has(existingStudentId)) {
      results.push({
        rowNumber,
        status: 'skipped',
        statusLabel: 'Đã thuộc lớp (Bỏ qua)',
        message: `Học sinh "${existingProf?.full_name || fullName}" (${cleanCode}) đã có trong lớp ${targetClass.name}. Giữ nguyên tài khoản, email và mật khẩu hiện có.`,
        columns,
        accountId: existingStudentId,
        loginIdentifier: cleanCode
      });
      continue;
    }

    if (dryRun) {
      results.push({
        rowNumber,
        status: 'ready',
        statusLabel: existingStudentId ? 'Đã có TK · Sẵn sàng thêm lớp' : 'Sẵn sàng tạo mới & thêm lớp',
        message: existingStudentId
          ? `Học sinh "${existingProf?.full_name || fullName}" (${cleanCode}) đã tồn tại. Sẽ giữ nguyên mật khẩu hiện có và chỉ liên kết vào lớp ${targetClass.name}.`
          : `Sẽ tạo tài khoản mới (đăng nhập bằng Mã HS: ${cleanCode}, cấp mật khẩu khởi tạo ngẫu nhiên, không gửi email) và thêm vào lớp ${targetClass.name}.`,
        columns,
        ...(existingStudentId ? { accountId: existingStudentId } : {}),
        loginIdentifier: cleanCode
      });
      continue;
    }

    // Thực thi bước xác nhận (dryRun = false)
    // Trường hợp 1: Học sinh đã tồn tại -> giữ nguyên tài khoản Auth & mật khẩu cũ, chỉ đồng bộ hồ sơ/lớp
    if (existingStudentId) {
      if (!existingProf) {
        const preservedEmail = existingAuth?.email ? normalizeEmail(String(existingAuth.email)) : internalEmail;
        const { error: upsertErr } = await supabaseAdmin.from('profiles').upsert(
          {
            id: existingStudentId,
            full_name: fullName,
            email: preservedEmail,
            role: 'student',
            grade: targetClass.grade,
            student_code: cleanCode,
            school_name: 'Trường THCS Tây Đô'
          },
          { onConflict: 'id' }
        );
        if (upsertErr) {
          results.push({
            rowNumber,
            status: 'error',
            statusLabel: 'Lỗi đồng bộ hồ sơ',
            code: 'PROFILE_PERSIST_FAILED',
            message: `Không thể đồng bộ hồ sơ học sinh cho ID ${existingStudentId}: ${upsertErr.message}`,
            columns,
            accountId: existingStudentId
          });
          continue;
        }
      } else if (!existingProf.student_code) {
        await supabaseAdmin
          .from('profiles')
          .update({ student_code: cleanCode })
          .eq('id', existingStudentId);
      }

      const enrollRes = await assignUserToClass(supabaseAdmin, existingStudentId, classId, {}, caller);
      if (!enrollRes.ok) {
        results.push({
          rowNumber,
          status: 'partial_failed',
          statusLabel: 'Đã có tài khoản, lỗi gán lớp',
          code: enrollRes.code || 'ENROLL_FAILED',
          message: enrollRes.message || `Không thể thêm học sinh vào lớp ${targetClass.name}.`,
          columns,
          accountId: existingStudentId,
          accountCreated: false,
          classAssigned: false,
          canRetryClassAssign: true,
          loginIdentifier: cleanCode
        });
        continue;
      }

      memberStudentIds.add(existingStudentId);
      results.push({
        rowNumber,
        status: 'reused',
        statusLabel: 'Đã dùng lại TK & thêm vào lớp',
        message: `Đã giữ nguyên tài khoản hiện có (${cleanCode}) và liên kết vào lớp ${targetClass.name}.`,
        columns,
        accountId: existingStudentId,
        classAssigned: true,
        loginIdentifier: cleanCode
      });
      continue;
    }

    // Trường hợp 2: Học sinh mới -> tạo trực tiếp qua Supabase Auth Admin API (createUser, không gửi email)
    if (supabaseAdmin?.__isServiceRoleClient === false || !supabaseAdmin?.auth?.admin?.createUser) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Thiếu quyền tạo Auth',
        code: 'SERVICE_ROLE_REQUIRED_FOR_NEW_USER',
        message: `Mã học sinh "${cleanCode}" chưa có tài khoản. Máy chủ cần cấu hình SUPABASE_SERVICE_ROLE_KEY để tạo tài khoản học sinh hàng loạt trên Supabase Auth.`,
        columns
      });
      continue;
    }

    const initialPassword = generateInitialStudentPassword();
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'student',
        grade: targetClass.grade,
        student_code: cleanCode,
        school_name: 'Trường THCS Tây Đô',
        must_change_password: true,
        auth_login_mode: 'student_code'
      }
    });

    if (createError || !createData?.user) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lỗi tạo tài khoản Auth',
        code: 'CREATE_USER_FAILED',
        message: `Không thể tạo tài khoản Auth cho mã "${cleanCode}": ${createError?.message || 'Lỗi không xác định'}.`,
        columns
      });
      continue;
    }

    const newUserId = String(createData.user.id);
    const { error: profInsertErr } = await supabaseAdmin.from('profiles').upsert(
      {
        id: newUserId,
        full_name: fullName,
        email: internalEmail,
        role: 'student',
        grade: targetClass.grade,
        student_code: cleanCode,
        school_name: 'Trường THCS Tây Đô'
      },
      { onConflict: 'id' }
    );

    if (profInsertErr) {
      results.push({
        rowNumber,
        status: 'partial_failed',
        statusLabel: 'Đã tạo Auth, lỗi hồ sơ',
        code: 'PROFILE_PERSIST_FAILED',
        message: `Đã tạo tài khoản Auth (${cleanCode}) nhưng lỗi lưu bảng profiles: ${profInsertErr.message}`,
        columns,
        accountId: newUserId,
        accountCreated: true,
        classAssigned: false,
        initialPassword,
        loginIdentifier: cleanCode,
        mustChangePassword: true
      });
      continue;
    }

    const createdProfObj = {
      id: newUserId,
      email: internalEmail,
      student_code: cleanCode,
      role: 'student',
      full_name: fullName
    };
    profileById.set(newUserId, createdProfObj);
    profileByEmail.set(internalEmail, createdProfObj);
    profilesByCode.set(cleanCode, [createdProfObj]);

    const enrollRes = await assignUserToClass(supabaseAdmin, newUserId, classId, {}, caller);
    if (!enrollRes.ok) {
      results.push({
        rowNumber,
        status: 'partial_failed',
        statusLabel: 'Đã tạo TK, lỗi gán lớp',
        code: enrollRes.code || 'ENROLL_FAILED',
        message: `Đã tạo tài khoản học sinh (${cleanCode}) nhưng chưa thể gán vào lớp ${targetClass.name}: ${enrollRes.message}`,
        columns,
        accountId: newUserId,
        accountCreated: true,
        classAssigned: false,
        canRetryClassAssign: true,
        initialPassword,
        loginIdentifier: cleanCode,
        mustChangePassword: true
      });
      continue;
    }

    memberStudentIds.add(newUserId);

    results.push({
      rowNumber,
      status: 'created',
      statusLabel: 'Tạo mới & thêm vào lớp',
      message: `Đã tạo tài khoản học sinh (Tên ĐN: ${cleanCode}) và thêm vào lớp ${targetClass.name}.`,
      columns,
      accountId: newUserId,
      accountCreated: true,
      classAssigned: true,
      initialPassword,
      loginIdentifier: cleanCode,
      mustChangePassword: true
    });
  }

  if (!dryRun) {
    const createdCount = results.filter(r => r.status === 'created').length;
    const reusedCount = results.filter(r => r.status === 'reused').length;
    await writeServerAuditLog(
      supabaseAdmin,
      caller,
      'Nhập học sinh từ Excel (Mẫu 2 cột)',
      `${targetClass.name} (${targetClass.schoolYear})`,
      `Xử lý ${results.length} dòng: tạo mới ${createdCount} học sinh, liên kết ${reusedCount} học sinh hiện có vào lớp ${targetClass.name}`,
      classId
    );
  }

  return {
    ok: true,
    status: 200,
    data: summarizeImportResults('students', dryRun, results, targetClass)
  };
}

/**
 * Import 2: Nhập danh sách giáo viên từ Excel (Mã giáo viên, Họ và tên, Email đăng nhập)
 */
export async function runTeacherImport(
  supabaseAdmin: any,
  rows: Array<{ rowNumber?: number; teacherCode?: string; fullName?: string; email?: string }>,
  caller: AdminCaller,
  redirectTo: string | undefined,
  dryRun: boolean
): Promise<ServiceResult<ExcelImportBatchResult>> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, status: 400, code: 'EMPTY_IMPORT_ROWS', message: 'Danh sách giáo viên tải lên đang trống.' };
  }

  const [profQuery, authRes] = await Promise.all([
    queryProfilesSafe(supabaseAdmin),
    listAllAuthUsers(supabaseAdmin)
  ]);

  if (profQuery.res.error) {
    return { ok: false, status: 500, code: 'PROFILES_QUERY_FAILED', message: profQuery.res.error.message };
  }
  if (!profQuery.hasTeacherCodeColumn) {
    return {
      ok: false,
      status: 400,
      code: 'MIGRATION_04_REQUIRED',
      message: 'Cột profiles.teacher_code chưa tồn tại. Hãy chạy migration src/data/04_teaching_assignments_and_codes.sql trước khi nhập danh sách giáo viên có Mã giáo viên.'
    };
  }
  if (authRes.error) {
    return { ok: false, status: 500, code: 'AUTH_USERS_QUERY_FAILED', message: authRes.error };
  }

  const profiles = profQuery.res.data || [];
  const profileByEmail = new Map<string, any>();
  const profileByTeacherCode = new Map<string, any>();

  for (const p of profiles) {
    if (p.email) profileByEmail.set(normalizeEmail(String(p.email)), p);
    if (p.teacher_code) profileByTeacherCode.set(normalizeCode(String(p.teacher_code)), p);
  }

  const authByEmail = new Map<string, any>();
  for (const au of authRes.users) {
    if (au?.email) authByEmail.set(normalizeEmail(String(au.email)), au);
  }

  const seenEmailsInFile = new Map<string, number>();
  const seenCodesInFile = new Map<string, number>();
  const results: ExcelImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] || {};
    const rowNumber = Number(raw.rowNumber || i + 2);
    const cleanCode = normalizeCode(raw.teacherCode);
    const fullName = String(raw.fullName || '').trim();
    const cleanEmail = normalizeEmail(String(raw.email || ''));
    const columns = {
      'Mã giáo viên': cleanCode,
      'Họ và tên': fullName,
      'Email đăng nhập': cleanEmail
    };

    if (!cleanCode || !fullName || !cleanEmail) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lỗi thiếu dữ liệu',
        code: 'MISSING_FIELDS',
        message: 'Cần nhập đầy đủ Mã giáo viên, Họ và tên và Email đăng nhập.',
        columns
      });
      continue;
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Email không hợp lệ',
        code: 'INVALID_EMAIL',
        message: `Địa chỉ email "${cleanEmail}" không đúng định dạng.`,
        columns
      });
      continue;
    }

    const prevEmailRow = seenEmailsInFile.get(cleanEmail);
    const prevCodeRow = seenCodesInFile.get(cleanCode);
    if (prevEmailRow !== undefined || prevCodeRow !== undefined) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Trùng lặp trong tệp',
        code: 'DUPLICATE_IN_FILE',
        message:
          prevEmailRow !== undefined
            ? `Email "${cleanEmail}" bị lặp lại với dòng ${prevEmailRow} trong tệp Excel.`
            : `Mã giáo viên "${cleanCode}" bị lặp lại với dòng ${prevCodeRow} trong tệp Excel.`,
        columns
      });
      continue;
    }
    seenEmailsInFile.set(cleanEmail, rowNumber);
    seenCodesInFile.set(cleanCode, rowNumber);

    const profEmail = profileByEmail.get(cleanEmail);
    const profCode = profileByTeacherCode.get(cleanCode);
    const authUser = authByEmail.get(cleanEmail);

    // NEVER auto-change role if email already belongs to another role (student/admin/reviewer)
    if (profEmail && profEmail.role !== 'teacher') {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Trùng email khác vai trò',
        code: 'ROLE_CONFLICT_EXISTING_USER',
        message: `Email "${cleanEmail}" đã thuộc tài khoản "${profEmail.full_name}" (vai trò hiện tại: ${profEmail.role}). Hệ thống không tự động đổi vai trò qua file Excel — Quản trị viên vui lòng xử lý thủ công trên hồ sơ hiện có.`,
        columns,
        existingAccountId: String(profEmail.id),
        existingRole: String(profEmail.role)
      });
      continue;
    }

    if (profEmail && profCode && String(profEmail.id) !== String(profCode.id)) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Xung đột Email & Mã GV',
        code: 'CONFLICT_EMAIL_CODE_MISMATCH',
        message: `Email "${cleanEmail}" thuộc "${profEmail.full_name}", nhưng Mã giáo viên "${cleanCode}" đã thuộc "${profCode.full_name}" (${profCode.email}).`,
        columns
      });
      continue;
    }

    if (profCode && !profEmail) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Trùng Mã giáo viên',
        code: 'TEACHER_CODE_EXISTS',
        message: `Mã giáo viên "${cleanCode}" đã được gán cho "${profCode.full_name}" (${profCode.email}).`,
        columns,
        existingAccountId: String(profCode.id)
      });
      continue;
    }

    if (profEmail && profEmail.teacher_code && normalizeCode(profEmail.teacher_code) !== cleanCode) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lệch Mã giáo viên',
        code: 'TEACHER_CODE_MISMATCH',
        message: `Giáo viên "${profEmail.full_name}" (${cleanEmail}) đang có mã "${profEmail.teacher_code}", không khớp với mã "${cleanCode}" trong file.`,
        columns,
        existingAccountId: String(profEmail.id)
      });
      continue;
    }

    // Existing teacher with same code -> idempotent skip
    if (profEmail && profEmail.teacher_code && normalizeCode(profEmail.teacher_code) === cleanCode) {
      results.push({
        rowNumber,
        status: 'skipped',
        statusLabel: 'Đã tồn tại (Bỏ qua)',
        message: `Giáo viên "${profEmail.full_name}" (${cleanCode}) đã có trên hệ thống. Không tạo trùng.`,
        columns,
        accountId: String(profEmail.id)
      });
      continue;
    }

    // Existing teacher without teacher_code -> backfill code
    if (profEmail && !profEmail.teacher_code) {
      if (dryRun) {
        results.push({
          rowNumber,
          status: 'ready',
          statusLabel: 'Sẵn sàng cập nhật mã GV',
          message: `Giáo viên "${profEmail.full_name}" đã tồn tại và sẽ được bổ sung Mã giáo viên "${cleanCode}".`,
          columns
        });
        continue;
      }

      const { error: updErr } = await supabaseAdmin
        .from('profiles')
        .update({ teacher_code: cleanCode })
        .eq('id', profEmail.id);
      if (updErr) {
        results.push({
          rowNumber,
          status: 'error',
          statusLabel: 'Lỗi cập nhật mã GV',
          code: 'TEACHER_CODE_UPDATE_FAILED',
          message: updErr.message,
          columns
        });
        continue;
      }
      profileByTeacherCode.set(cleanCode, { ...profEmail, teacher_code: cleanCode });
      results.push({
        rowNumber,
        status: 'reused',
        statusLabel: 'Đã cập nhật mã GV',
        message: `Đã giữ nguyên tài khoản giáo viên "${profEmail.full_name}" và gắn Mã giáo viên ${cleanCode}.`,
        columns,
        accountId: String(profEmail.id)
      });
      continue;
    }

    if (authUser && !profEmail) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Auth đã có chưa đồng bộ hồ sơ',
        code: 'AUTH_EXISTS_WITHOUT_PROFILE',
        message: `Email "${cleanEmail}" đã tồn tại trên Supabase Auth (ID ${authUser.id}) nhưng chưa có hồ sơ public.profiles. Vui lòng kiểm tra trên danh sách tài khoản.`,
        columns,
        existingAccountId: String(authUser.id)
      });
      continue;
    }

    if (dryRun) {
      results.push({
        rowNumber,
        status: 'ready',
        statusLabel: 'Sẵn sàng tạo & mời GV',
        message: `Tạo tài khoản giáo viên (${cleanCode}) và gửi lời mời kích hoạt qua email.`,
        columns
      });
      continue;
    }

    // New teacher account -> inviteUserByEmail + profiles upsert with role='teacher' (strictly verified admin server-side)
    if (supabaseAdmin?.__isServiceRoleClient === false || !supabaseAdmin?.auth?.admin?.inviteUserByEmail) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Cần tài khoản đã đăng ký',
        code: 'SERVICE_ROLE_REQUIRED_FOR_NEW_USER',
        message: `Email "${cleanEmail}" chưa có hồ sơ trên hệ thống. Để tự động gửi lời mời tạo Auth mới, máy chủ cần cấu hình SUPABASE_SERVICE_ROLE_KEY (hoặc giáo viên tự đăng ký tài khoản trước).`,
        columns
      });
      continue;
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        data: { full_name: fullName, role: 'student' },
        ...(redirectTo ? { redirectTo } : {})
      }
    );

    if (inviteError || !inviteData?.user) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lỗi gửi mời Auth',
        code: 'INVITE_EMAIL_FAILED',
        message: formatInviteEmailError(inviteError?.message || 'Không tạo được tài khoản Auth.'),
        columns
      });
      continue;
    }

    const newTeacherId = String(inviteData.user.id);
    const { error: profInsErr } = await supabaseAdmin.from('profiles').upsert(
      {
        id: newTeacherId,
        full_name: fullName,
        email: cleanEmail,
        role: 'teacher',
        teacher_code: cleanCode,
        school_name: 'Trường THCS Tây Đô'
      },
      { onConflict: 'id' }
    );

    if (profInsErr) {
      results.push({
        rowNumber,
        status: 'partial_failed',
        statusLabel: 'Đã tạo Auth, lỗi hồ sơ',
        code: 'PROFILE_PERSIST_FAILED',
        message: `Đã gửi mời Auth (${newTeacherId}) nhưng lỗi lưu profiles: ${profInsErr.message}`,
        columns,
        accountId: newTeacherId,
        accountCreated: true
      });
      continue;
    }

    const createdStub = {
      id: newTeacherId,
      full_name: fullName,
      email: cleanEmail,
      role: 'teacher',
      teacher_code: cleanCode
    };
    profileByEmail.set(cleanEmail, createdStub);
    profileByTeacherCode.set(cleanCode, createdStub);

    results.push({
      rowNumber,
      status: 'created',
      statusLabel: 'Đã tạo & gửi mời GV',
      message: `Đã tạo tài khoản giáo viên "${fullName}" (${cleanCode}) và gửi email mời.`,
      columns,
      accountId: newTeacherId,
      accountCreated: true
    });
  }

  if (!dryRun) {
    const createdOrUpdated = results.filter(r => r.status === 'created' || r.status === 'reused').length;
    await writeServerAuditLog(
      supabaseAdmin,
      caller,
      'Nhập danh sách giáo viên từ Excel',
      `${results.length} dòng`,
      `Nhập/cập nhật ${createdOrUpdated} giáo viên từ tệp Excel`,
      caller.id
    );
  }

  return {
    ok: true,
    status: 200,
    data: summarizeImportResults('teachers', dryRun, results)
  };
}

/**
 * Import 3: Nhập phân công giảng dạy từ Excel (Năm học, Mã giáo viên, Môn, Mã lớp)
 */
export async function runTeachingAssignmentImport(
  supabaseAdmin: any,
  rows: Array<{ rowNumber?: number; schoolYear?: string; teacherCode?: string; subjectRaw?: string; classCode?: string }>,
  caller: AdminCaller,
  dryRun: boolean
): Promise<ServiceResult<ExcelImportBatchResult>> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, status: 400, code: 'EMPTY_IMPORT_ROWS', message: 'Tệp phân công giảng dạy đang trống.' };
  }

  const [profQuery, clsQuery, taRes] = await Promise.all([
    queryProfilesSafe(supabaseAdmin),
    queryClassesSafe(supabaseAdmin),
    supabaseAdmin
      .from('teaching_assignments')
      .select('id, school_year, teacher_id, class_id, subject, status')
      .eq('status', 'active')
  ]);

  if (taRes.error && isMissingSchemaObjectError(taRes.error)) {
    return {
      ok: false,
      status: 400,
      code: 'MIGRATION_04_REQUIRED',
      message: 'Cần chạy migration src/data/04_teaching_assignments_and_codes.sql trước khi nhập phân công giảng dạy.'
    };
  }
  if (!profQuery.hasTeacherCodeColumn || !clsQuery.hasClassCodeColumn) {
    return {
      ok: false,
      status: 400,
      code: 'MIGRATION_04_REQUIRED',
      message: 'Cần chạy migration src/data/04_teaching_assignments_and_codes.sql để có cột Mã giáo viên và Mã lớp.'
    };
  }
  if (profQuery.res.error || clsQuery.res.error || taRes.error) {
    return {
      ok: false,
      status: 500,
      code: 'WORKSPACE_QUERY_FAILED',
      message:
        profQuery.res.error?.message ||
        clsQuery.res.error?.message ||
        taRes.error?.message ||
        'Không thể truy vấn dữ liệu phân công.'
    };
  }

  const teacherProfiles = (profQuery.res.data || []).filter(
    (p: any) => p.role === 'teacher' || p.role === 'admin'
  );
  const classRows = clsQuery.res.data || [];

  const activeKeySet = new Set<string>();
  for (const ta of taRes.data || []) {
    if (ta.subject) {
      activeKeySet.add(
        `${String(ta.school_year).trim()}::${String(ta.teacher_id)}::${String(ta.class_id)}::${String(ta.subject).trim().toLowerCase()}`
      );
    }
  }

  const seenInFile = new Map<string, number>();
  const results: ExcelImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] || {};
    const rowNumber = Number(raw.rowNumber || i + 2);
    const schoolYear = String(raw.schoolYear || '').trim();
    const teacherCode = normalizeCode(raw.teacherCode);
    const subjectRaw = String(raw.subjectRaw || '').trim();
    const classCode = normalizeCode(raw.classCode);

    const columns = {
      'Năm học': schoolYear,
      'Mã giáo viên': teacherCode,
      'Môn': subjectRaw,
      'Mã lớp': classCode
    };

    if (!schoolYear || !teacherCode || !subjectRaw || !classCode) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lỗi thiếu dữ liệu',
        code: 'MISSING_FIELDS',
        message: 'Cần nhập đầy đủ 4 cột: Năm học, Mã giáo viên, Môn, Mã lớp.',
        columns
      });
      continue;
    }

    // 1. Resolve canonical subject unambiguously
    const subjRes = resolveCanonicalSubject(subjectRaw);
    if (!subjRes.ok || !subjRes.subjectId) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Môn học không hợp lệ',
        code: subjRes.ambiguous ? 'AMBIGUOUS_SUBJECT' : 'INVALID_SUBJECT',
        message: subjRes.error || `Không khớp môn "${subjectRaw}" trong danh mục môn THCS chuẩn.`,
        columns
      });
      continue;
    }
    const canonicalSubject = subjRes.subjectId;
    const subjectLabel = getSubjectDisplayName(canonicalSubject);

    // 2. Match teacher by teacher_code unambiguously
    const matchedTeachers = teacherProfiles.filter(
      (p: any) => p.teacher_code && normalizeCode(p.teacher_code) === teacherCode
    );
    if (matchedTeachers.length === 0) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Không tìm thấy GV',
        code: 'TEACHER_NOT_FOUND',
        message: `Không tìm thấy tài khoản Giáo viên có Mã giáo viên "${teacherCode}".`,
        columns
      });
      continue;
    }
    if (matchedTeachers.length > 1) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Trùng nhiều GV cùng mã',
        code: 'TEACHER_AMBIGUOUS',
        message: `Mã giáo viên "${teacherCode}" khớp với ${matchedTeachers.length} tài khoản khác nhau. Vui lòng chuẩn hóa trước khi nhập.`,
        columns
      });
      continue;
    }
    const teacher = matchedTeachers[0];

    // 3. Match class by class_code within schoolYear unambiguously
    const classesInYear = classRows.filter(
      (c: any) => String(c.school_year || '').trim() === schoolYear
    );
    let matchedClasses = classesInYear.filter(
      (c: any) => c.class_code && normalizeCode(c.class_code) === classCode
    );
    if (matchedClasses.length === 0) {
      const compactCode = classCode.replace(/\s+/g, '');
      matchedClasses = classesInYear.filter(
        (c: any) => normalizeCode(String(c.name || '')).replace(/\s+/g, '') === compactCode
      );
    }

    if (matchedClasses.length === 0) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Không tìm thấy lớp',
        code: 'CLASS_NOT_FOUND_IN_YEAR',
        message: `Không tìm thấy lớp có Mã lớp "${classCode}" trong năm học "${schoolYear}".`,
        columns
      });
      continue;
    }
    if (matchedClasses.length > 1) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lớp trùng nhiều kết quả',
        code: 'CLASS_AMBIGUOUS',
        message: `Mã lớp "${classCode}" trong năm học "${schoolYear}" khớp nhiều hơn 1 lớp (${matchedClasses.map((c: any) => c.name).join(', ')}).`,
        columns
      });
      continue;
    }
    const targetCls = matchedClasses[0];

    const compositeKey = `${schoolYear}::${teacher.id}::${targetCls.id}::${canonicalSubject}`;
    const prevRow = seenInFile.get(compositeKey);
    if (prevRow !== undefined) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Trùng phân công trong tệp',
        code: 'DUPLICATE_IN_FILE',
        message: `Phân công "${teacher.full_name} • ${subjectLabel} • ${targetCls.name} (${schoolYear})" bị lặp lại với dòng ${prevRow}.`,
        columns
      });
      continue;
    }
    seenInFile.set(compositeKey, rowNumber);

    if (activeKeySet.has(compositeKey)) {
      results.push({
        rowNumber,
        status: 'skipped',
        statusLabel: 'Đã phân công (Bỏ qua)',
        message: `Phân công "${teacher.full_name} • ${subjectLabel} • ${targetCls.name} (${schoolYear})" đang hoạt động. Không tạo trùng.`,
        columns
      });
      continue;
    }

    if (dryRun) {
      results.push({
        rowNumber,
        status: 'ready',
        statusLabel: 'Sẵn sàng phân công',
        message: `Phân công ${teacher.full_name} dạy môn ${subjectLabel} tại lớp ${targetCls.name} (${schoolYear}).`,
        columns
      });
      continue;
    }

    const { error: insErr } = await supabaseAdmin.from('teaching_assignments').insert({
      school_year: schoolYear,
      teacher_id: teacher.id,
      class_id: targetCls.id,
      subject: canonicalSubject,
      status: 'active',
      needs_subject_completion: false,
      created_by: caller.id,
      updated_by: caller.id
    });

    if (insErr) {
      results.push({
        rowNumber,
        status: 'error',
        statusLabel: 'Lỗi lưu phân công',
        code: 'INSERT_ASSIGNMENT_FAILED',
        message: insErr.message,
        columns
      });
      continue;
    }

    activeKeySet.add(compositeKey);
    results.push({
      rowNumber,
      status: 'created',
      statusLabel: 'Đã phân công',
      message: `Đã phân công ${teacher.full_name} dạy môn ${subjectLabel} tại lớp ${targetCls.name} (${schoolYear}).`,
      columns
    });
  }

  if (!dryRun) {
    const createdCount = results.filter(r => r.status === 'created').length;
    await writeServerAuditLog(
      supabaseAdmin,
      caller,
      'Nhập phân công giảng dạy từ Excel',
      `${results.length} dòng`,
      `Tạo mới ${createdCount} phân công giảng dạy từ tệp Excel`,
      caller.id
    );
  }

  return {
    ok: true,
    status: 200,
    data: summarizeImportResults('assignments', dryRun, results)
  };
}

export interface StudentCodeLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: any;
  mustChangePassword: boolean;
  studentCode: string;
}

/**
 * Xác thực đăng nhập cho Học sinh bằng Mã học sinh và Mật khẩu:
 * - Không yêu cầu học sinh cung cấp email cá nhân.
 * - Hỗ trợ cả học sinh mới (dùng định danh kỹ thuật nội bộ) lẫn học sinh đã tạo trước đó (có student_code trong profiles).
 * - Nếu 1 mã học sinh bị trùng trên nhiều bản ghi, từ chối và báo Quản trị viên xử lý.
 * - Không để lộ định danh kỹ thuật nội bộ hoặc email trong phản hồi lỗi.
 */
export async function authenticateStudentByCode(
  studentCodeRaw: string,
  passwordRaw: string,
  options: {
    supabaseLookupClient?: any;
    createAnonAuthClient: () => any;
  }
): Promise<ServiceResult<StudentCodeLoginResponse>> {
  const cleanCode = normalizeCode(studentCodeRaw);
  const password = String(passwordRaw || '').trim();

  if (!cleanCode || !password) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_CREDENTIALS',
      message: 'Vui lòng nhập đầy đủ Mã học sinh và Mật khẩu.'
    };
  }

  if (!isValidStudentCode(cleanCode)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_STUDENT_CODE',
      message: 'Mã học sinh không đúng định dạng hợp lệ.'
    };
  }

  if (password.length < 6) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PASSWORD',
      message: 'Mật khẩu cần tối thiểu 6 ký tự.'
    };
  }

  const internalDomain = resolveStudentInternalDomain();
  const internalEmail = buildStudentInternalAuthEmail(cleanCode, internalDomain);
  const candidateEmails: string[] = [];

  if (options.supabaseLookupClient) {
    const { data: rows, error: lookupErr } = await options.supabaseLookupClient
      .from('profiles')
      .select('id, full_name, email, role, student_code')
      .ilike('student_code', cleanCode);

    if (!lookupErr && Array.isArray(rows)) {
      const exactMatches = rows.filter(
        (r: any) => normalizeCode(r.student_code) === cleanCode
      );

      if (exactMatches.length > 1) {
        return {
          ok: false,
          status: 409,
          code: 'AMBIGUOUS_STUDENT_CODE',
          message:
            'Mã học sinh này đang xuất hiện trên nhiều hồ sơ không rõ tương ứng. Vui lòng báo Quản trị viên nhà trường kiểm tra.'
        };
      }

      if (exactMatches.length === 1) {
        const matched = exactMatches[0];
        if (matched.role && matched.role !== 'student') {
          return {
            ok: false,
            status: 403,
            code: 'NOT_STUDENT_ACCOUNT',
            message: 'Tài khoản Giáo viên / Quản trị viên vui lòng đăng nhập bằng Email.'
          };
        }
        if (matched.email) {
          const normMatchedEmail = normalizeEmail(String(matched.email));
          if (normMatchedEmail) {
            candidateEmails.push(normMatchedEmail);
          }
        }
      }
    }
  }

  if (!candidateEmails.includes(internalEmail)) {
    candidateEmails.push(internalEmail);
  }

  const anonClient = options.createAnonAuthClient();
  if (!anonClient?.auth?.signInWithPassword) {
    return {
      ok: false,
      status: 503,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Máy chủ chưa cấu hình kết nối xác thực Supabase.'
    };
  }

  for (const candidateEmail of candidateEmails) {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: candidateEmail,
      password
    });

    if (!error && data?.session && data?.user) {
      const metaRole = data.user.user_metadata?.role;
      if (metaRole && metaRole !== 'student') {
        return {
          ok: false,
          status: 403,
          code: 'NOT_STUDENT_ACCOUNT',
          message: 'Tài khoản Giáo viên / Quản trị viên vui lòng đăng nhập bằng Email.'
        };
      }

      const mustChangePassword = Boolean(data.user.user_metadata?.must_change_password);
      return {
        ok: true,
        status: 200,
        message: 'Đăng nhập thành công.',
        data: {
          accessToken: String(data.session.access_token),
          refreshToken: String(data.session.refresh_token),
          user: data.user,
          mustChangePassword,
          studentCode: cleanCode
        }
      };
    }
  }

  return {
    ok: false,
    status: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Mã học sinh hoặc mật khẩu không chính xác.'
  };
}

