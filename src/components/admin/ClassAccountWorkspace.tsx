import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type {
  ClassRoleAssignment,
  ClassRoleType,
  CutoverReadinessReport,
  Grade,
  TeachingAssignment,
  UserRole
} from '../../types';
import { CANONICAL_SUBJECT_CATALOG, getSubjectDisplayName } from '../../utils/subjectCatalog';
import {
  downloadClassStudentsTemplate,
  downloadTeachersTemplate,
  downloadTeachingAssignmentsTemplate,
  type ExcelImportKind
} from '../../utils/importExportTemplates';
import { ExcelImportModal, type ExcelImportTargetClass } from './ExcelImportModal';
import {
  formatAccountLoginDisplay,
  isStudentInternalAuthEmail
} from '../../utils/studentAuthHelper';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Info,
  Key,
  Layers,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import type {
  AdminAccountRecord,
  AdminAuditLogRow,
  AdminClassSummary,
  RealAuthStatus
} from '../../../server/adminAccountsService';

type WorkspaceTab = 'classes' | 'teachers' | 'assignments' | 'accounts_audit';

const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Học sinh',
  teacher: 'Giáo viên',
  reviewer: 'Kiểm duyệt',
  admin: 'Quản trị'
};

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  student: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  teacher: 'bg-blue-50 text-blue-800 border-blue-200',
  reviewer: 'bg-purple-50 text-purple-800 border-purple-200',
  admin: 'bg-red-50 text-red-800 border-red-200'
};

const AUTH_STATUS_CLASSES: Record<RealAuthStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  confirmed_pending_login: 'bg-teal-50 text-teal-700 border-teal-200',
  invited: 'bg-blue-50 text-blue-700 border-blue-200',
  unconfirmed: 'bg-amber-50 text-amber-800 border-amber-200',
  no_auth_user: 'bg-slate-100 text-slate-600 border-slate-300'
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const ClassAccountWorkspace: React.FC = () => {
  const { user, currentRole, userProfile, retryLoadAssignmentData } = useApp();

  const [accounts, setAccounts] = useState<AdminAccountRecord[]>([]);
  const [classes, setClasses] = useState<AdminClassSummary[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [classRoles, setClassRoles] = useState<ClassRoleAssignment[]>([]);
  const [cutoverReadiness, setCutoverReadiness] = useState<CutoverReadinessReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([]);
  const [auditWarning, setAuditWarning] = useState<string | null>(null);
  const [teachingSchemaReady, setTeachingSchemaReady] = useState<boolean>(true);
  const [teachingSchemaWarning, setTeachingSchemaWarning] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverMissingKey, setServerMissingKey] = useState<boolean>(false);
  const [serviceRoleConfigured, setServiceRoleConfigured] = useState<boolean>(true);
  const [readOnlyMode, setReadOnlyMode] = useState<boolean>(false);

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('classes');
  const [showAdminGuide, setShowAdminGuide] = useState<boolean>(false);
  const [pageBanner, setPageBanner] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Tab 1: Classes state
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classYearFilter, setClassYearFilter] = useState<string>('all');
  const [classGradeFilter, setClassGradeFilter] = useState<'all' | Grade>('all');
  const [classSearch, setClassSearch] = useState<string>('');
  const [createClassOpen, setCreateClassOpen] = useState<boolean>(false);
  const [newClassSchoolYear, setNewClassSchoolYear] = useState<string>('2025-2026');
  const [newClassGrade, setNewClassGrade] = useState<Grade>('8');
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassCode, setNewClassCode] = useState<string>('');
  const [creatingClass, setCreatingClass] = useState<boolean>(false);
  const [createClassError, setCreateClassError] = useState<string | null>(null);

  // Edit Class Modal state
  const [editingClass, setEditingClass] = useState<AdminClassSummary | null>(null);
  const [editClassSchoolYear, setEditClassSchoolYear] = useState<string>('2025-2026');
  const [editClassGrade, setEditClassGrade] = useState<Grade>('8');
  const [editClassName, setEditClassName] = useState<string>('');
  const [editClassCode, setEditClassCode] = useState<string>('');
  const [updatingClass, setUpdatingClass] = useState<boolean>(false);
  const [editClassError, setEditClassError] = useState<string | null>(null);

  // Delete Class Modal state
  const [deletingClassTarget, setDeletingClassTarget] = useState<AdminClassSummary | null>(null);
  const [deletingClassBusy, setDeletingClassBusy] = useState<boolean>(false);
  const [deleteClassError, setDeleteClassError] = useState<string | null>(null);

  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [classRoleTeacherId, setClassRoleTeacherId] = useState<string>('');
  const [classRoleType, setClassRoleType] = useState<ClassRoleType>('homeroom');
  const [savingClassRole, setSavingClassRole] = useState<boolean>(false);
  const [endingClassRoleId, setEndingClassRoleId] = useState<string | null>(null);
  const [classRoleError, setClassRoleError] = useState<string | null>(null);

  // Tab 2: Teachers state
  const [teacherSearch, setTeacherSearch] = useState<string>('');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'all' | RealAuthStatus>('all');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Tab 3: Teaching Assignments state
  const [assignViewMode, setAssignViewMode] = useState<'by_teacher' | 'by_class'>('by_teacher');
  const [assignYearFilter, setAssignYearFilter] = useState<string>('all');
  const [assignSubjectFilter, setAssignSubjectFilter] = useState<string>('all');
  const [assignStatusFilter, setAssignStatusFilter] = useState<'active' | 'ended' | 'all'>('active');

  // Create Teaching Assignment Modal (1 teacher + 1 subject + multiple classes)
  const [createTaOpen, setCreateTaOpen] = useState<boolean>(false);
  const [taSchoolYear, setTaSchoolYear] = useState<string>('2025-2026');
  const [taTeacherId, setTaTeacherId] = useState<string>('');
  const [taSubject, setTaSubject] = useState<string>('math');
  const [taClassIds, setTaClassIds] = useState<string[]>([]);
  const [taNotes, setTaNotes] = useState<string>('');
  const [savingTa, setSavingTa] = useState<boolean>(false);
  const [taError, setTaError] = useState<string | null>(null);

  // Edit Teaching Assignment Modal
  const [editingTa, setEditingTa] = useState<TeachingAssignment | null>(null);
  const [editTaSchoolYear, setEditTaSchoolYear] = useState<string>('2025-2026');
  const [editTaClassId, setEditTaClassId] = useState<string>('');
  const [editTaSubject, setEditTaSubject] = useState<string>('math');
  const [editTaNotes, setEditTaNotes] = useState<string>('');
  const [updatingTa, setUpdatingTa] = useState<boolean>(false);
  const [editTaError, setEditTaError] = useState<string | null>(null);

  // End Teaching Assignment Confirmation Modal
  const [endingTaTarget, setEndingTaTarget] = useState<TeachingAssignment | null>(null);
  const [endingTaBusy, setEndingTaBusy] = useState<boolean>(false);

  // Accounts & Audit sub-filters
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [accountRoleFilter, setAccountRoleFilter] = useState<'all' | UserRole>('all');
  const [showAuditInsideAccounts, setShowAuditInsideAccounts] = useState<boolean>(false);

  // Excel Import Modal
  const [excelModal, setExcelModal] = useState<{
    isOpen: boolean;
    kind: ExcelImportKind;
    targetClass: ExcelImportTargetClass | null;
  }>({
    isOpen: false,
    kind: 'students',
    targetClass: null
  });

  // Create Single Account Modal (Student in Class OR Teacher)
  const [createAccountOpen, setCreateAccountOpen] = useState<boolean>(false);
  const [formRole, setFormRole] = useState<'student' | 'teacher'>('student');
  const [formFullName, setFormFullName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formStudentCode, setFormStudentCode] = useState<string>('');
  const [formTeacherCode, setFormTeacherCode] = useState<string>('');
  const [formGrade, setFormGrade] = useState<Grade>('8');
  const [formClassId, setFormClassId] = useState<string>('');
  const [submittingCreate, setSubmittingCreate] = useState<boolean>(false);
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);
  const [existingConflictId, setExistingConflictId] = useState<string | null>(null);
  const [splitCreatedAccount, setSplitCreatedAccount] = useState<AdminAccountRecord | null>(null);
  const [splitClassError, setSplitClassError] = useState<string | null>(null);
  const [splitRetryClassId, setSplitRetryClassId] = useState<string>('');
  const [retryingClassAssign, setRetryingClassAssign] = useState<boolean>(false);
  const [createdStudentCredentials, setCreatedStudentCredentials] = useState<{
    studentCode: string;
    fullName: string;
    initialPassword: string;
  } | null>(null);

  // Inspect Account & Role Drawer
  const [selectedAccount, setSelectedAccount] = useState<AdminAccountRecord | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole>('student');
  const [updatingRole, setUpdatingRole] = useState<boolean>(false);
  const [assignClassIdInDrawer, setAssignClassIdInDrawer] = useState<string>('');
  const [assigningClassInDrawer, setAssigningClassInDrawer] = useState<boolean>(false);
  const [resettingStudentPassword, setResettingStudentPassword] = useState<boolean>(false);
  const [resetPasswordResult, setResetPasswordResult] = useState<{
    studentCode: string;
    fullName: string;
    initialPassword: string;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [drawerNotice, setDrawerNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }, []);

  const loadReadOnlyFallback = useCallback(async () => {
    const [profRes, clsRes, memRes, taRes, crRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, role, grade, student_code, teacher_code, subject, school_name, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('classes')
        .select('id, name, class_code, grade, school_year, teacher_id, teacher_name, invite_code')
        .order('grade', { ascending: true }),
      supabase.from('class_members').select('class_id, student_id'),
      supabase
        .from('teaching_assignments')
        .select('id, school_year, teacher_id, class_id, subject, status, needs_subject_completion, notes, started_at, ended_at')
        .order('school_year', { ascending: false }),
      supabase
        .from('class_roles')
        .select('id, school_year, class_id, teacher_id, role_type, status, notes, granted_at, ended_at')
        .order('school_year', { ascending: false })
    ]);

    if (profRes.error) {
      throw new Error(`Lỗi truy vấn public.profiles: ${profRes.error.message}`);
    }
    if (clsRes.error) {
      throw new Error(`Lỗi truy vấn public.classes: ${clsRes.error.message}`);
    }
    if (memRes.error) {
      throw new Error(`Lỗi truy vấn public.class_members: ${memRes.error.message}`);
    }

    const profMap = new Map<string, any>((profRes.data || []).map((p: any) => [String(p.id), p]));
    const clsRows = clsRes.data || [];
    const memRows = memRes.data || [];
    const clsMap = new Map<string, any>(clsRows.map((c: any) => [String(c.id), c]));
    const studentsByClass = new Map<string, { id: string; code: string; fullName: string; email: string }[]>();
    const enrolledMap = new Map<string, { id: string; name: string; grade: string; schoolYear?: string }[]>();

    for (const m of memRows) {
      const cid = String(m.class_id);
      const sid = String(m.student_id);
      const cls = clsMap.get(cid);
      const stu = profMap.get(sid);
      if (cls) {
        const list = enrolledMap.get(sid) || [];
        list.push({ id: cid, name: cls.name, grade: cls.grade, schoolYear: cls.school_year });
        enrolledMap.set(sid, list);
      }
      if (stu) {
        const sList = studentsByClass.get(cid) || [];
        sList.push({
          id: sid,
          code: String(stu.student_code || ''),
          fullName: String(stu.full_name || 'Học sinh'),
          email: String(stu.email || '')
        });
        studentsByClass.set(cid, sList);
      }
    }

    const fallbackTas: TeachingAssignment[] = !taRes.error && Array.isArray(taRes.data)
      ? taRes.data.map((row: any) => {
          const teacherProf = profMap.get(String(row.teacher_id));
          const cls = clsMap.get(String(row.class_id));
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
      : [];

    const fallbackClassRoles: ClassRoleAssignment[] = !crRes.error && Array.isArray(crRes.data)
      ? crRes.data.map((row: any) => {
          const teacherProf = profMap.get(String(row.teacher_id));
          const cls = clsMap.get(String(row.class_id));
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

    const teachingMap = new Map<string, { id: string; name: string; grade: string; schoolYear?: string; subjectLabel?: string }[]>();
    for (const ta of fallbackTas) {
      if (ta.status !== 'active') continue;
      const list = teachingMap.get(ta.teacherId) || [];
      list.push({
        id: ta.classId,
        name: ta.className || 'Lớp học',
        grade: String(ta.grade || ''),
        schoolYear: ta.schoolYear,
        subjectLabel: ta.subjectLabel
      });
      teachingMap.set(ta.teacherId, list);
    }

    setAccounts(
      (profRes.data || []).map((p: any) => ({
        id: String(p.id),
        fullName: String(p.full_name || 'Chưa đặt tên'),
        email: String(p.email || ''),
        role: (p.role as UserRole) || 'student',
        grade: p.grade ? String(p.grade) : null,
        studentCode: p.student_code ? String(p.student_code) : null,
        teacherCode: p.teacher_code ? String(p.teacher_code) : null,
        subject: p.subject ? String(p.subject) : null,
        schoolName: String(p.school_name || 'Trường THCS Tây Đô'),
        createdAt: p.created_at ? String(p.created_at) : null,
        authStatus: 'active',
        authStatusLabel: 'Đã kích hoạt',
        emailConfirmedAt: null,
        invitedAt: null,
        lastSignInAt: null,
        enrolledClasses: enrolledMap.get(String(p.id)) || [],
        teachingClasses: teachingMap.get(String(p.id)) || []
      }))
    );

    setClasses(
      clsRows.map((c: any) => {
        const roster = studentsByClass.get(String(c.id)) || [];
        return {
          id: String(c.id),
          name: String(c.name),
          classCode: c.class_code ? String(c.class_code) : null,
          grade: String(c.grade),
          schoolYear: String(c.school_year || '2025-2026'),
          teacherId: c.teacher_id ? String(c.teacher_id) : null,
          teacherName: c.teacher_name ? String(c.teacher_name) : null,
          inviteCode: String(c.invite_code || ''),
          memberCount: roster.length,
          students: roster
        };
      })
    );
    setTeachingAssignments(fallbackTas);
    setClassRoles(fallbackClassRoles);
    setCutoverReadiness(null);
  }, []);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setServerMissingKey(false);
    setReadOnlyMode(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        setLoadError('Chưa có phiên đăng nhập Quản trị viên hợp lệ. Vui lòng đăng nhập lại.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });

      const payload = await res.json().catch(() => null);

      if (res.status === 503 && payload?.code === 'MISSING_SERVICE_ROLE_KEY') {
        setServerMissingKey(true);
        setServiceRoleConfigured(false);
        await loadReadOnlyFallback();
        setLoading(false);
        return;
      }

      if (!res.ok || !payload?.ok) {
        setLoadError(payload?.message || `Máy chủ từ chối yêu cầu (${res.status}).`);
        setLoading(false);
        return;
      }

      const nextAccounts: AdminAccountRecord[] = payload.accounts || [];
      const nextClasses: AdminClassSummary[] = payload.classes || [];
      const nextAssignments: TeachingAssignment[] = payload.teachingAssignments || [];

      setAccounts(nextAccounts);
      setClasses(nextClasses);
      setTeachingAssignments(nextAssignments);
      setClassRoles(payload.classRoles || []);
      setCutoverReadiness(payload.cutoverReadiness || null);
      setAuditLogs(payload.auditLogs || []);
      setAuditWarning(payload.auditLogsWarning || null);
      setTeachingSchemaReady(payload.teachingSchemaReady !== false);
      setTeachingSchemaWarning(payload.teachingSchemaWarning || null);
      setServiceRoleConfigured(payload.serviceRoleConfigured !== false);

      setSelectedAccount(prev => {
        if (!prev) return null;
        return nextAccounts.find(a => a.id === prev.id) || null;
      });
      setSelectedClassId(prev => {
        if (prev && nextClasses.some(c => c.id === prev)) return prev;
        return nextClasses[0]?.id || '';
      });
    } catch (err: any) {
      setLoadError(err?.message || 'Không thể kết nối tới API quản trị /api/admin/users.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, loadReadOnlyFallback]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const refreshAll = useCallback(async () => {
    await fetchWorkspace();
    retryLoadAssignmentData();
  }, [fetchWorkspace, retryLoadAssignmentData]);

  // School Years catalog derived from classes + teaching assignments
  const schoolYearOptions = useMemo(() => {
    const set = new Set<string>(['2025-2026']);
    classes.forEach(c => {
      if (c.schoolYear) set.add(c.schoolYear);
    });
    teachingAssignments.forEach(t => {
      if (t.schoolYear) set.add(t.schoolYear);
    });
    return Array.from(set).sort().reverse();
  }, [classes, teachingAssignments]);

  // Teachers list
  const teacherAccounts = useMemo(
    () => accounts.filter(a => a.role === 'teacher'),
    [accounts]
  );

  // Filtered classes
  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    return classes.filter(c => {
      if (classYearFilter !== 'all' && c.schoolYear !== classYearFilter) return false;
      if (classGradeFilter !== 'all' && c.grade !== classGradeFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.classCode || '').toLowerCase().includes(q) ||
        c.inviteCode.toLowerCase().includes(q)
      );
    });
  }, [classes, classYearFilter, classGradeFilter, classSearch]);

  useEffect(() => {
    if (filteredClasses.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!filteredClasses.some(c => c.id === selectedClassId)) {
      setSelectedClassId(filteredClasses[0].id);
    }
  }, [filteredClasses, selectedClassId]);

  const activeClass = useMemo(
    () => filteredClasses.find(c => c.id === selectedClassId) || filteredClasses[0] || null,
    [filteredClasses, selectedClassId]
  );

  const activeClassTeachingAssignments = useMemo(() => {
    if (!activeClass) return [];
    return teachingAssignments.filter(
      ta => ta.classId === activeClass.id && ta.status === 'active'
    );
  }, [teachingAssignments, activeClass]);

  const activeClassRoles = useMemo(() => {
    if (!activeClass) return [];
    return classRoles.filter(
      cr => cr.classId === activeClass.id && cr.status === 'active'
    );
  }, [classRoles, activeClass]);

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    return teacherAccounts.filter(t => {
      if (teacherStatusFilter !== 'all' && t.authStatus !== teacherStatusFilter) return false;
      if (!q) return true;
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.teacherCode || '').toLowerCase().includes(q)
      );
    });
  }, [teacherAccounts, teacherSearch, teacherStatusFilter]);

  // Legacy migrated rows needing subject completion
  const pendingSubjectCompletions = useMemo(
    () =>
      teachingAssignments.filter(
        ta => ta.status === 'active' && (ta.needsSubjectCompletion || !ta.subject)
      ),
    [teachingAssignments]
  );

  // Filtered teaching assignments
  const filteredTeachingAssignments = useMemo(() => {
    return teachingAssignments.filter(ta => {
      if (assignYearFilter !== 'all' && ta.schoolYear !== assignYearFilter) return false;
      if (assignSubjectFilter !== 'all' && (ta.subject || '') !== assignSubjectFilter) return false;
      if (assignStatusFilter !== 'all' && ta.status !== assignStatusFilter) return false;
      return true;
    });
  }, [teachingAssignments, assignYearFilter, assignSubjectFilter, assignStatusFilter]);

  const assignmentsGroupedByTeacher = useMemo(() => {
    const map = new Map<
      string,
      {
        teacherId: string;
        teacherName: string;
        teacherCode: string | null;
        teacherEmail: string;
        rows: TeachingAssignment[];
      }
    >();
    for (const ta of filteredTeachingAssignments) {
      const key = ta.teacherId;
      const existing = map.get(key) || {
        teacherId: ta.teacherId,
        teacherName: ta.teacherName || 'Giáo viên',
        teacherCode: ta.teacherCode || null,
        teacherEmail: ta.teacherEmail || '',
        rows: []
      };
      existing.rows.push(ta);
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'vi'));
  }, [filteredTeachingAssignments]);

  const assignmentsGroupedByClass = useMemo(() => {
    const map = new Map<
      string,
      {
        classId: string;
        className: string;
        classCode: string | null;
        grade: string;
        schoolYear: string;
        rows: TeachingAssignment[];
      }
    >();
    for (const ta of filteredTeachingAssignments) {
      const key = ta.classId;
      const existing = map.get(key) || {
        classId: ta.classId,
        className: ta.className || 'Lớp học',
        classCode: ta.classCode || null,
        grade: String(ta.grade || ''),
        schoolYear: ta.schoolYear,
        rows: [] as TeachingAssignment[]
      };
      existing.rows.push(ta);
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className, 'vi'));
  }, [filteredTeachingAssignments]);

  // Filtered all accounts (secondary inspection view)
  const filteredAllAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    return accounts.filter(acc => {
      if (accountRoleFilter !== 'all' && acc.role !== accountRoleFilter) return false;
      if (!q) return true;
      return (
        acc.fullName.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        (acc.studentCode || '').toLowerCase().includes(q) ||
        (acc.teacherCode || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, accountSearch, accountRoleFilter]);

  // =========================================================================
  // HANDLERS: TAB 1 — CREATE CLASS & REMOVE STUDENT FROM CLASS
  // =========================================================================
  const handleCreateClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingClass || readOnlyMode) return;
    setCreateClassError(null);
    setCreatingClass(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setCreateClassError('Phiên đăng nhập đã hết hạn.');
        setCreatingClass(false);
        return;
      }
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          schoolYear: newClassSchoolYear.trim() || '2025-2026',
          grade: newClassGrade,
          name: newClassName.trim(),
          classCode: newClassCode.trim()
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setCreateClassError(payload?.message || 'Không thể tạo lớp học.');
        setCreatingClass(false);
        return;
      }

      setCreateClassOpen(false);
      setNewClassName('');
      setNewClassCode('');
      setPageBanner({
        type: 'success',
        text: payload.message || `Đã tạo lớp ${payload.classRoom?.name} thành công.`
      });
      await refreshAll();
      if (payload.classRoom?.id) {
        setSelectedClassId(payload.classRoom.id);
      }
    } catch (err: any) {
      setCreateClassError(err?.message || 'Lỗi kết nối máy chủ khi tạo lớp.');
    } finally {
      setCreatingClass(false);
    }
  };

  const openEditClassModal = (cls: AdminClassSummary) => {
    setEditingClass(cls);
    setEditClassSchoolYear(cls.schoolYear || '2025-2026');
    setEditClassGrade((cls.grade as Grade) || '8');
    setEditClassName(cls.name || '');
    setEditClassCode(cls.classCode || '');
    setEditClassError(null);
  };

  const handleUpdateClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || updatingClass || readOnlyMode) return;
    setEditClassError(null);
    setUpdatingClass(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setEditClassError('Phiên đăng nhập đã hết hạn.');
        setUpdatingClass(false);
        return;
      }

      const res = await fetch(`/api/admin/classes/${editingClass.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          schoolYear: editClassSchoolYear.trim(),
          grade: editClassGrade,
          name: editClassName.trim(),
          classCode: editClassCode.trim()
        })
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setEditClassError(payload?.message || 'Không thể cập nhật thông tin lớp học.');
        setUpdatingClass(false);
        return;
      }

      setEditingClass(null);
      setPageBanner({
        type: 'success',
        text: payload.message || 'Đã cập nhật thông tin lớp học.'
      });
      await refreshAll();
    } catch (err: any) {
      setEditClassError(err?.message || 'Lỗi kết nối máy chủ khi cập nhật lớp.');
    } finally {
      setUpdatingClass(false);
    }
  };

  const handleConfirmDeleteClass = async () => {
    if (!deletingClassTarget || deletingClassBusy || readOnlyMode) return;
    setDeleteClassError(null);
    setDeletingClassBusy(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setDeleteClassError('Phiên đăng nhập đã hết hạn.');
        setDeletingClassBusy(false);
        return;
      }

      const res = await fetch(`/api/admin/classes/${deletingClassTarget.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setDeleteClassError(payload?.message || 'Không thể xóa lớp học.');
        setDeletingClassBusy(false);
        return;
      }

      const deletedName = deletingClassTarget.name;
      setDeletingClassTarget(null);
      setPageBanner({
        type: 'success',
        text: payload.message || `Đã xóa lớp "${deletedName}".`
      });
      await refreshAll();
    } catch (err: any) {
      setDeleteClassError(err?.message || 'Lỗi kết nối máy chủ khi xóa lớp.');
    } finally {
      setDeletingClassBusy(false);
    }
  };

  const handleRemoveStudentFromActiveClass = async (studentId: string, studentName: string) => {
    if (!activeClass || removingStudentId || readOnlyMode) return;
    setRemovingStudentId(studentId);
    setPageBanner(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/users/${studentId}/classes/${activeClass.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setPageBanner({
          type: 'error',
          text: payload?.message || `Không thể gỡ ${studentName} khỏi lớp ${activeClass.name}.`
        });
      } else {
        setPageBanner({
          type: 'success',
          text: `Đã gỡ ${studentName} khỏi lớp ${activeClass.name} (dữ liệu năm học khác được giữ nguyên).`
        });
        await refreshAll();
      }
    } finally {
      setRemovingStudentId(null);
    }
  };

  const handleGrantClassRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass || !classRoleTeacherId || savingClassRole || readOnlyMode) return;
    setClassRoleError(null);
    setSavingClassRole(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setClassRoleError('Phiên đăng nhập đã hết hạn.');
        return;
      }
      const res = await fetch('/api/admin/class-roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          schoolYear: activeClass.schoolYear,
          classId: activeClass.id,
          teacherId: classRoleTeacherId,
          roleType: classRoleType
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setClassRoleError(payload?.message || 'Không thể cấp vai trò phụ trách lớp.');
        return;
      }
      setClassRoleTeacherId('');
      setPageBanner({
        type: 'success',
        text: payload.message || `Đã cấp vai trò phụ trách lớp ${activeClass.name}.`
      });
      await refreshAll();
    } catch (err: any) {
      setClassRoleError(err?.message || 'Lỗi kết nối máy chủ khi cấp vai trò lớp.');
    } finally {
      setSavingClassRole(false);
    }
  };

  const handleEndClassRole = async (roleId: string) => {
    if (endingClassRoleId || readOnlyMode) return;
    setClassRoleError(null);
    setEndingClassRoleId(roleId);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/class-roles/${roleId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setClassRoleError(payload?.message || 'Không thể kết thúc vai trò phụ trách lớp.');
        return;
      }
      setPageBanner({
        type: 'success',
        text: payload.message || 'Đã kết thúc vai trò phụ trách lớp.'
      });
      await refreshAll();
    } catch (err: any) {
      setClassRoleError(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setEndingClassRoleId(null);
    }
  };

  // =========================================================================
  // HANDLERS: CREATE SINGLE STUDENT / TEACHER ACCOUNT
  // =========================================================================
  const openCreateStudentInClass = () => {
    if (!activeClass) return;
    setFormRole('student');
    setFormFullName('');
    setFormEmail('');
    setFormStudentCode('');
    setFormTeacherCode('');
    setFormGrade((activeClass.grade as Grade) || '8');
    setFormClassId(activeClass.id);
    setCreateAccountError(null);
    setExistingConflictId(null);
    setSplitCreatedAccount(null);
    setSplitClassError(null);
    setSplitRetryClassId('');
    setCreatedStudentCredentials(null);
    setCreateAccountOpen(true);
  };

  const openCreateTeacherModal = () => {
    setFormRole('teacher');
    setFormFullName('');
    setFormEmail('');
    setFormStudentCode('');
    setFormTeacherCode('');
    setFormClassId('');
    setCreateAccountError(null);
    setExistingConflictId(null);
    setSplitCreatedAccount(null);
    setSplitClassError(null);
    setSplitRetryClassId('');
    setCreatedStudentCredentials(null);
    setCreateAccountOpen(true);
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingCreate || readOnlyMode) return;

    setCreateAccountError(null);
    setExistingConflictId(null);
    setSubmittingCreate(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setCreateAccountError('Phiên đăng nhập đã hết hạn.');
        setSubmittingCreate(false);
        return;
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: formFullName.trim(),
          email: formRole === 'student' ? undefined : formEmail.trim(),
          role: formRole,
          studentCode: formRole === 'student' ? formStudentCode.trim() : undefined,
          teacherCode: formRole === 'teacher' ? formTeacherCode.trim() : undefined,
          grade: formRole === 'student' ? formGrade : undefined,
          classId: formRole === 'student' && formClassId ? formClassId : undefined
        })
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setCreateAccountError(payload?.message || `Không thể tạo tài khoản (${res.status}).`);
        if (payload?.existingAccountId) {
          setExistingConflictId(payload.existingAccountId);
        }
        setSubmittingCreate(false);
        return;
      }

      if (payload.accountCreated && formRole === 'student' && formClassId && !payload.classAssigned) {
        setSplitCreatedAccount(payload.account);
        setSplitClassError(payload.classError || 'Đã tạo tài khoản nhưng chưa gán được vào lớp.');
        setSplitRetryClassId(formClassId);
        if (payload.initialPassword) {
          setCreatedStudentCredentials({
            studentCode: payload.loginIdentifier || formStudentCode.trim().toUpperCase(),
            fullName: formFullName.trim(),
            initialPassword: payload.initialPassword
          });
        }
        await refreshAll();
        setSubmittingCreate(false);
        return;
      }

      if (formRole === 'student' && payload.initialPassword) {
        setCreatedStudentCredentials({
          studentCode: payload.loginIdentifier || formStudentCode.trim().toUpperCase(),
          fullName: formFullName.trim(),
          initialPassword: payload.initialPassword
        });
        setPageBanner({
          type: 'success',
          text: payload.message || 'Đã tạo tài khoản học sinh và khởi tạo mật khẩu lần đầu.'
        });
        await refreshAll();
        setSubmittingCreate(false);
        return;
      }

      setCreateAccountOpen(false);
      setPageBanner({
        type: 'success',
        text: payload.message || 'Đã tạo tài khoản thành công.'
      });
      await refreshAll();
    } catch (err: any) {
      setCreateAccountError(err?.message || 'Lỗi mạng khi gọi máy chủ.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleRetrySplitClassAssign = async () => {
    if (!splitCreatedAccount || !splitRetryClassId || retryingClassAssign) return;
    setRetryingClassAssign(true);
    setSplitClassError(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/users/${splitCreatedAccount.id}/assign-class`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ classId: splitRetryClassId })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setSplitClassError(payload?.message || 'Thử gán lớp lại chưa thành công.');
        return;
      }
      setSplitCreatedAccount(null);
      if (!createdStudentCredentials) {
        setCreateAccountOpen(false);
      }
      setPageBanner({
        type: 'success',
        text: `Đã hoàn tất gán ${splitCreatedAccount.fullName} vào lớp.`
      });
      await refreshAll();
    } finally {
      setRetryingClassAssign(false);
    }
  };

  // =========================================================================
  // HANDLERS: RESEND INVITE, RESET STUDENT PASSWORD & ACCOUNT DRAWER
  // =========================================================================
  const handleResendInvite = async (acc: AdminAccountRecord) => {
    if (readOnlyMode || resendingId) return;
    setResendingId(acc.id);
    setPageBanner(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/users/${acc.id}/resend-invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setPageBanner({
          type: 'error',
          text: payload?.message || `Không thể gửi lại email mời cho ${acc.email}.`
        });
      } else {
        setPageBanner({
          type: 'success',
          text: payload.message || `Đã gửi lại lời mời kích hoạt tới ${acc.email}.`
        });
        await fetchWorkspace();
      }
    } finally {
      setResendingId(null);
    }
  };

  const openInspectDrawer = (acc: AdminAccountRecord) => {
    setSelectedAccount(acc);
    setPendingRole(acc.role);
    setAssignClassIdInDrawer('');
    setResetPasswordResult(null);
    setDrawerNotice(null);
  };

  const handleResetStudentPasswordInDrawer = async () => {
    if (!selectedAccount || selectedAccount.role !== 'student' || readOnlyMode || resettingStudentPassword) {
      return;
    }
    setResettingStudentPassword(true);
    setDrawerNotice(null);
    setResetPasswordResult(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/users/${selectedAccount.id}/reset-student-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok || !payload?.initialPassword) {
        setDrawerNotice({
          type: 'error',
          text: payload?.message || 'Không thể cấp lại mật khẩu mới cho học sinh.'
        });
        return;
      }
      setResetPasswordResult({
        studentCode: payload.studentCode || selectedAccount.studentCode || '',
        fullName: selectedAccount.fullName,
        initialPassword: payload.initialPassword
      });
      setDrawerNotice({
        type: 'success',
        text: payload.message || 'Đã cấp mật khẩu khởi tạo mới cho học sinh.'
      });
      await refreshAll();
    } catch (err: any) {
      setDrawerNotice({
        type: 'error',
        text: err?.message || 'Lỗi mạng khi cấp lại mật khẩu học sinh.'
      });
    } finally {
      setResettingStudentPassword(false);
    }
  };

  const openExistingById = (accountId: string | null, email?: string) => {
    const found =
      (accountId && accounts.find(a => a.id === accountId)) ||
      (email && accounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase())) ||
      null;
    if (found) {
      setCreateAccountOpen(false);
      openInspectDrawer(found);
    }
  };

  const handleUpdateRoleInDrawer = async () => {
    if (!selectedAccount || readOnlyMode || updatingRole) return;
    setUpdatingRole(true);
    setDrawerNotice(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/users/${selectedAccount.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: pendingRole })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setDrawerNotice({
          type: 'error',
          text: payload?.message || 'Không thể cập nhật vai trò.'
        });
      } else {
        setDrawerNotice({
          type: 'success',
          text: payload.message || 'Đã cập nhật vai trò trên Supabase.'
        });
        await refreshAll();
      }
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleAssignClassInDrawer = async () => {
    if (!selectedAccount || !assignClassIdInDrawer || readOnlyMode || assigningClassInDrawer) return;
    setAssigningClassInDrawer(true);
    setDrawerNotice(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/users/${selectedAccount.id}/assign-class`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ classId: assignClassIdInDrawer })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setDrawerNotice({
          type: 'error',
          text: payload?.message || 'Không thể gán lớp cho tài khoản này.'
        });
      } else {
        setAssignClassIdInDrawer('');
        setDrawerNotice({
          type: 'success',
          text: payload.message || 'Đã gán lớp thành công.'
        });
        await refreshAll();
      }
    } finally {
      setAssigningClassInDrawer(false);
    }
  };

  // =========================================================================
  // HANDLERS: TAB 3 — TEACHING ASSIGNMENTS (CREATE / EDIT / END)
  // =========================================================================
  const classesMatchingTaYear = useMemo(
    () => classes.filter(c => !taSchoolYear || c.schoolYear === taSchoolYear),
    [classes, taSchoolYear]
  );

  const openCreateTeachingAssignmentModal = () => {
    const defaultYear = schoolYearOptions[0] || '2025-2026';
    setTaSchoolYear(defaultYear);
    setTaTeacherId(teacherAccounts[0]?.id || '');
    setTaSubject('math');
    setTaClassIds([]);
    setTaNotes('');
    setTaError(null);
    setCreateTaOpen(true);
  };

  const toggleTaClassSelection = (classId: string) => {
    setTaClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const handleCreateTeachingAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingTa || readOnlyMode) return;
    setTaError(null);
    if (!taTeacherId) {
      setTaError('Vui lòng chọn giáo viên.');
      return;
    }
    if (taClassIds.length === 0) {
      setTaError('Vui lòng chọn ít nhất một lớp học.');
      return;
    }

    setSavingTa(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setTaError('Phiên đăng nhập đã hết hạn.');
        setSavingTa(false);
        return;
      }

      const res = await fetch('/api/admin/teaching-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          schoolYear: taSchoolYear.trim(),
          teacherId: taTeacherId,
          subject: taSubject,
          classIds: taClassIds,
          notes: taNotes.trim() || undefined
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setTaError(payload?.message || 'Không thể lưu phân công giảng dạy.');
        setSavingTa(false);
        return;
      }

      setCreateTaOpen(false);
      setPageBanner({
        type: 'success',
        text: payload.message || 'Đã lưu phân công giảng dạy.'
      });
      await refreshAll();
    } catch (err: any) {
      setTaError(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setSavingTa(false);
    }
  };

  const openEditTaModal = (ta: TeachingAssignment) => {
    setEditingTa(ta);
    setEditTaSchoolYear(ta.schoolYear);
    setEditTaClassId(ta.classId);
    setEditTaSubject(ta.subject || 'math');
    setEditTaNotes(ta.notes || '');
    setEditTaError(null);
  };

  const handleUpdateTaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTa || updatingTa || readOnlyMode) return;
    setEditTaError(null);
    setUpdatingTa(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/teaching-assignments/${editingTa.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          schoolYear: editTaSchoolYear.trim(),
          classId: editTaClassId,
          subject: editTaSubject,
          notes: editTaNotes.trim()
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setEditTaError(payload?.message || 'Không thể cập nhật phân công.');
        setUpdatingTa(false);
        return;
      }
      setEditingTa(null);
      setPageBanner({
        type: 'success',
        text: payload.message || 'Đã cập nhật phân công giảng dạy.'
      });
      await refreshAll();
    } finally {
      setUpdatingTa(false);
    }
  };

  const handleConfirmEndTa = async () => {
    if (!endingTaTarget || endingTaBusy || readOnlyMode) return;
    setEndingTaBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/teaching-assignments/${endingTaTarget.id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setPageBanner({
          type: 'error',
          text: payload?.message || 'Không thể kết thúc phân công.'
        });
      } else {
        setPageBanner({
          type: 'success',
          text: payload.message || 'Đã kết thúc phân công giảng dạy.'
        });
        await refreshAll();
      }
      setEndingTaTarget(null);
    } finally {
      setEndingTaBusy(false);
    }
  };

  if (currentRole !== 'admin') {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-lg mx-auto space-y-3 font-serif">
        <Shield className="w-10 h-10 text-red-600 mx-auto" />
        <h3 className="text-lg font-bold text-[#082B52]">Không có quyền truy cập (403 Forbidden)</h3>
        <p className="text-xs text-slate-600">
          Chức năng Quản lý lớp &amp; tài khoản chỉ dành riêng cho Quản trị viên trường THCS Tây Đô.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-serif">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#006BFF]" />
            <span>Quản lý lớp &amp; tài khoản</span>
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Quản lý tập trung lớp học theo năm học, nhập danh sách Excel và phân công nhiều giáo viên – nhiều môn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F3F8FF] text-[#082B52] border border-[#DCE8F7] rounded-xl text-xs font-bold hover:bg-[#E4F0FF] disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#006BFF] ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới dữ liệu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'accounts_audit' ? 'classes' : 'accounts_audit')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap ${
              activeTab === 'accounts_audit'
                ? 'bg-[#082B52] text-white border-[#082B52]'
                : 'bg-white text-[#082B52] border-[#DCE8F7] hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Tất cả hồ sơ &amp; Nhật ký</span>
          </button>
        </div>
      </div>

      {/* Warning if Migration 04 not yet deployed */}
      {!teachingSchemaReady && teachingSchemaWarning && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-amber-900">
              Cần chạy bổ sung Migration 04 trên Supabase SQL Editor
            </p>
            <p className="leading-relaxed">{teachingSchemaWarning}</p>
          </div>
        </div>
      )}

      {/* Notice if Server Service Role Key is not configured */}
      {(!serviceRoleConfigured || serverMissingKey) && (
        <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs text-[#082B52] space-y-1.5">
          <div className="flex items-start gap-2.5">
            <Info className="w-5 h-5 text-[#006BFF] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-[#082B52]">
                Đang vận hành bằng quyền Quản trị viên xác thực qua RLS (JWT Admin)
              </p>
              <p className="text-slate-700 mt-0.5 leading-relaxed">
                Bạn có đầy đủ quyền tạo, sửa, xóa lớp học, gán học sinh hiện có, cấp vai trò chủ nhiệm và phân công giáo viên theo môn. Nếu cần gửi email mời tự động tạo tài khoản Auth mới tinh qua Supabase Auth Admin API, hãy bổ sung biến môi trường phía server <code>SUPABASE_SERVICE_ROLE_KEY</code> (không dùng tiền tố <code>VITE_</code>).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible First Admin Guide */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdminGuide(v => !v)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-[#082B52] hover:bg-[#F8FBFF]"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#006BFF]" />
            <span>Kiểm tra tài khoản Quản trị viên theo Auth UUID</span>
          </span>
          {showAdminGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdminGuide && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-100 text-xs text-slate-700 space-y-2.5 bg-[#FBFDFF]">
            <p>
              Tài khoản đang đăng nhập: <strong>{userProfile?.fullName}</strong> ({user?.email}) · Auth UUID:{' '}
              <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{user?.id || '—'}</code> · Vai trò:{' '}
              <strong>{ROLE_LABELS[currentRole]}</strong>.
            </p>
            <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto space-y-1">
              <p className="text-slate-400">-- Cấp quyền quản trị cho Auth UUID cụ thể trong Supabase SQL Editor:</p>
              <p>SELECT id, email FROM auth.users ORDER BY created_at ASC;</p>
              <p className="text-emerald-300">
                UPDATE public.profiles SET role = &apos;admin&apos;, updated_at = NOW() WHERE id = &apos;
                {user?.id || '<AUTH_USER_UUID>'}&apos;::uuid;
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {pageBanner && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold ${
            pageBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : pageBanner.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {pageBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : pageBanner.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{pageBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageBanner(null)}
            className="text-xs underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Load Error */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Không thể tải dữ liệu quản trị</p>
              <p className="mt-0.5">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchWorkspace}
            className="px-3.5 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shrink-0"
          >
            Thử tải lại
          </button>
        </div>
      )}

      {/* Summary KPI Cards: Lớp học | Giáo viên | Phân công giảng dạy | Tổng số tài khoản */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Tổng số lớp học</p>
            <p className="text-xl font-bold text-[#082B52] tabular-nums mt-0.5">
              {loading ? '...' : classes.length}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] flex items-center justify-center text-[#006BFF]">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Đội ngũ giáo viên</p>
            <p className="text-xl font-bold text-[#082B52] tabular-nums mt-0.5">
              {loading ? '...' : teacherAccounts.length}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] flex items-center justify-center text-[#006BFF]">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Phân công giảng dạy</p>
            <p className="text-xl font-bold text-[#082B52] tabular-nums mt-0.5">
              {loading ? '...' : teachingAssignments.filter(t => t.status === 'active').length}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] flex items-center justify-center text-[#006BFF]">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Tổng số tài khoản</p>
            <p className="text-xl font-bold text-[#082B52] tabular-nums mt-0.5">
              {loading ? '...' : accounts.length}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] flex items-center justify-center text-[#006BFF]">
            <Shield className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Primary 3-Tab Navigation Bar: Lớp học | Giáo viên | Phân công giảng dạy */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-[#DCE8F7]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              activeTab === 'classes'
                ? 'bg-[#006BFF] text-white shadow-xs'
                : 'text-[#082B52] hover:bg-[#F3F8FF]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Lớp học ({classes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('teachers')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              activeTab === 'teachers'
                ? 'bg-[#006BFF] text-white shadow-xs'
                : 'text-[#082B52] hover:bg-[#F3F8FF]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Giáo viên ({teacherAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              activeTab === 'assignments'
                ? 'bg-[#006BFF] text-white shadow-xs'
                : 'text-[#082B52] hover:bg-[#F3F8FF]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Phân công giảng dạy ({teachingAssignments.filter(t => t.status === 'active').length})</span>
            {pendingSubjectCompletions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                {pendingSubjectCompletions.length} cần bổ sung môn
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] text-slate-500 px-2 tabular-nums">
          Tổng tài khoản: <strong className="text-[#082B52]">{accounts.length}</strong>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: LỚP HỌC                                                     */}
      {/* =================================================================== */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={classSearch}
                  onChange={e => setClassSearch(e.target.value)}
                  placeholder="Tìm tên lớp, mã lớp, mã mời..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-[#DCE8F7] rounded-xl focus:border-[#006BFF] outline-hidden"
                />
              </div>

              <select
                value={classYearFilter}
                onChange={e => setClassYearFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-[#DCE8F7] rounded-xl bg-white font-semibold text-[#082B52]"
              >
                <option value="all">Tất cả năm học</option>
                {schoolYearOptions.map(y => (
                  <option key={y} value={y}>
                    Năm học {y}
                  </option>
                ))}
              </select>

              <select
                value={classGradeFilter}
                onChange={e => setClassGradeFilter(e.target.value as 'all' | Grade)}
                className="px-3 py-2 text-xs border border-[#DCE8F7] rounded-xl bg-white font-semibold text-[#082B52]"
              >
                <option value="all">Tất cả khối</option>
                <option value="6">Khối 6</option>
                <option value="7">Khối 7</option>
                <option value="8">Khối 8</option>
                <option value="9">Khối 9</option>
              </select>
            </div>

            <button
              type="button"
              disabled={readOnlyMode}
              onClick={() => {
                setCreateClassError(null);
                setNewClassSchoolYear(schoolYearOptions[0] || '2025-2026');
                setCreateClassOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-40 whitespace-nowrap self-start lg:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo lớp mới</span>
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 text-[#006BFF] animate-spin mx-auto mb-2" />
              Đang tải danh sách lớp học và học sinh...
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-10 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-[#1769C2] mx-auto" />
              <h3 className="text-base font-bold text-[#082B52]">Chưa có lớp học nào khớp bộ lọc</h3>
              <p className="text-xs text-slate-600">
                Hãy bấm &quot;Tạo lớp mới&quot; để khởi tạo lớp theo năm học và khối.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Master List */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden">
                <div className="px-4 py-3 bg-[#F3F8FF] border-b border-[#DCE8F7] text-xs font-bold text-[#082B52]">
                  Danh sách lớp ({filteredClasses.length})
                </div>
                <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                  {filteredClasses.map(cls => {
                    const isSelected = activeClass?.id === cls.id;
                    const taCount = teachingAssignments.filter(
                      ta => ta.classId === cls.id && ta.status === 'active'
                    ).length;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-[#EAF3FD] text-[#082B52]'
                            : 'hover:bg-[#F8FBFF] text-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#082B52] truncate">
                              {cls.name}
                            </span>
                            {cls.classCode && (
                              <span className="font-mono text-[11px] font-bold text-[#006BFF]">
                                {cls.classCode}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>Khối {cls.grade}</span>
                            <span aria-hidden="true">·</span>
                            <span>{cls.schoolYear}</span>
                            <span aria-hidden="true">·</span>
                            <span>{taCount} môn phân công</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#082B52] tabular-nums shrink-0">
                          {cls.memberCount} HS
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Detail Pane */}
              {activeClass && (
                <div className="lg:col-span-8 space-y-4">
                  {/* Class Info Card */}
                  <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold text-[#082B52]">{activeClass.name}</h3>
                          <span className="text-xs text-slate-500">·</span>
                          <span className="text-xs font-bold text-[#082B52]">
                            Khối {activeClass.grade}
                          </span>
                          <span className="text-xs text-slate-500">·</span>
                          <span className="text-xs font-bold text-[#006BFF]">
                            Năm học {activeClass.schoolYear}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                          <span>
                            Mã lớp:{' '}
                            <strong className="font-mono text-[#082B52]">
                              {activeClass.classCode || 'Chưa đặt'}
                            </strong>
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[#006BFF]">
                            <Key className="w-3.5 h-3.5" />
                            <span>Mã mời: {activeClass.inviteCode || '—'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!readOnlyMode && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditClassModal(activeClass)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE8F7] bg-white hover:bg-[#F3F8FF] text-xs font-bold text-[#082B52] whitespace-nowrap"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#006BFF]" />
                              <span>Sửa lớp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDeleteClassError(null);
                                setDeletingClassTarget(activeClass);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-xs font-bold text-red-700 whitespace-nowrap"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa lớp</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            downloadClassStudentsTemplate(activeClass.name, activeClass.schoolYear)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] hover:bg-[#E4F0FF] text-xs font-bold text-[#082B52] whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5 text-[#006BFF]" />
                          <span>Tải mẫu Excel</span>
                        </button>

                        <button
                          type="button"
                          disabled={readOnlyMode}
                          onClick={() =>
                            setExcelModal({
                              isOpen: true,
                              kind: 'students',
                              targetClass: {
                                id: activeClass.id,
                                name: activeClass.name,
                                classCode: activeClass.classCode,
                                grade: activeClass.grade,
                                schoolYear: activeClass.schoolYear
                              }
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Nhập học sinh</span>
                        </button>

                        <button
                          type="button"
                          disabled={readOnlyMode}
                          onClick={openCreateStudentInClass}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#082B52] hover:bg-[#0d3a6d] text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Thêm 1 học sinh</span>
                        </button>
                      </div>
                    </div>

                    {/* Assigned Teachers by Subject */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#082B52]">
                          Giáo viên giảng dạy tại lớp ({activeClassTeachingAssignments.length} phân công)
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('assignments')}
                          className="text-xs font-bold text-[#006BFF] hover:underline"
                        >
                          Quản lý phân công →
                        </button>
                      </div>
                      {activeClassTeachingAssignments.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Lớp chưa có phân công giáo viên – môn học nào cho năm học này.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {activeClassTeachingAssignments.map(ta => (
                            <span
                              key={ta.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                                ta.needsSubjectCompletion
                                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                                  : 'bg-[#F3F8FF] border-[#CBE2FB] text-[#082B52]'
                              }`}
                            >
                              <strong>
                                {ta.subject ? getSubjectDisplayName(ta.subject) : 'Chưa gán môn'}
                              </strong>
                              <span aria-hidden="true">·</span>
                              <span>{ta.teacherName || 'Giáo viên'}</span>
                              {ta.teacherCode ? (
                                <span className="font-mono text-[11px] text-[#006BFF]">
                                  ({ta.teacherCode})
                                </span>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Explicit Class Manager / Homeroom Roles (class_roles — separate from subject teaching) */}
                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#082B52]">
                          Vai trò phụ trách / chủ nhiệm lớp (class_roles — {activeClassRoles.length} đang hiệu lực)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Tách biệt với quyền dạy môn; chỉ Quản trị viên hoặc vai trò lớp được cấp rõ mới quản lý danh sách HS
                        </span>
                      </div>

                      {activeClassRoles.length === 0 ? (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                          {activeClass.teacherName
                            ? `Lớp chưa có bản ghi vai trò trong class_roles (phụ trách cũ trên lớp: ${activeClass.teacherName}). Hệ thống không tự cấp vai trò; hãy chọn giáo viên bên dưới để cấp quyền Chủ nhiệm hoặc Quản lý danh sách lớp nếu cần.`
                            : 'Lớp chưa có vai trò Chủ nhiệm / Quản lý danh sách lớp nào đang hiệu lực.'}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {activeClassRoles.map(cr => (
                            <span
                              key={cr.id}
                              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-950"
                            >
                              <strong>{cr.roleLabel}</strong>
                              <span aria-hidden="true">·</span>
                              <span>{cr.teacherName || 'Giáo viên'}</span>
                              {!readOnlyMode && (
                                <button
                                  type="button"
                                  disabled={endingClassRoleId === cr.id}
                                  onClick={() => handleEndClassRole(cr.id)}
                                  className="ml-1 text-[11px] text-red-700 hover:underline font-bold disabled:opacity-40"
                                >
                                  {endingClassRoleId === cr.id ? 'Đang kết thúc...' : 'Kết thúc'}
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {classRoleError && (
                        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                          {classRoleError}
                        </div>
                      )}

                      {!readOnlyMode && teachingSchemaReady && (
                        <form onSubmit={handleGrantClassRole} className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <select
                            value={classRoleTeacherId}
                            onChange={e => setClassRoleTeacherId(e.target.value)}
                            className="px-3 py-1.5 border border-[#DCE8F7] rounded-xl bg-white text-[#082B52] font-semibold"
                          >
                            <option value="">-- Chọn giáo viên phụ trách lớp --</option>
                            {teacherAccounts.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.fullName} {t.teacherCode ? `(${t.teacherCode})` : ''}
                              </option>
                            ))}
                          </select>

                          <select
                            value={classRoleType}
                            onChange={e => setClassRoleType(e.target.value as ClassRoleType)}
                            className="px-3 py-1.5 border border-[#DCE8F7] rounded-xl bg-white text-[#082B52] font-semibold"
                          >
                            <option value="homeroom">Chủ nhiệm lớp (homeroom)</option>
                            <option value="class_manager">Quản lý danh sách lớp (class_manager)</option>
                          </select>

                          <button
                            type="submit"
                            disabled={savingClassRole || !classRoleTeacherId}
                            className="px-3.5 py-1.5 rounded-xl bg-[#082B52] hover:bg-[#0d3a6d] text-white font-bold disabled:opacity-40"
                          >
                            {savingClassRole ? 'Đang lưu...' : 'Cấp vai trò lớp'}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Class Student Roster */}
                  <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-[#F8FBFF]">
                      <span className="text-xs font-bold text-[#082B52]">
                        Danh sách học sinh lớp {activeClass.name} ({activeClass.students.length} học sinh)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Liên kết bằng ID Supabase Auth · Lưu giữ nguyên dữ liệu các năm học trước
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#F3F8FF] text-[#12345B] font-bold border-b border-[#DCE8F7]">
                          <tr>
                            <th className="py-2.5 px-4 w-12 text-center">STT</th>
                            <th className="py-2.5 px-4">Mã học sinh</th>
                            <th className="py-2.5 px-4">Họ và tên</th>
                            <th className="py-2.5 px-4">Tài khoản đăng nhập</th>
                            <th className="py-2.5 px-4 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeClass.students.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400">
                                Lớp chưa có học sinh. Bấm &quot;Nhập học sinh&quot; để nhập danh sách từ Excel (2 cột: Mã học sinh, Họ và tên) hoặc &quot;Thêm 1 học sinh&quot;.
                              </td>
                            </tr>
                          ) : (
                            activeClass.students.map((st, idx) => {
                              const matchedAcc = accounts.find(a => a.id === st.id);
                              return (
                                <tr key={st.id} className="hover:bg-[#F8FBFF]">
                                  <td className="py-2.5 px-4 text-center text-slate-400 tabular-nums">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono font-bold text-[#006BFF]">
                                    {st.code || '—'}
                                  </td>
                                  <td className="py-2.5 px-4 font-bold text-[#082B52]">
                                    {st.fullName}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-slate-600">
                                    {formatAccountLoginDisplay(st.email, st.code, 'student')}
                                  </td>
                                  <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                                    {matchedAcc && (
                                      <button
                                        type="button"
                                        onClick={() => openInspectDrawer(matchedAcc)}
                                        className="px-2.5 py-1 rounded-lg bg-[#F3F8FF] border border-[#DCE8F7] text-[#082B52] font-bold hover:bg-[#E4F0FF]"
                                      >
                                        Hồ sơ
                                      </button>
                                    )}
                                    {!readOnlyMode && (
                                      <button
                                        type="button"
                                        disabled={removingStudentId === st.id}
                                        onClick={() =>
                                          handleRemoveStudentFromActiveClass(st.id, st.fullName)
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:text-red-700 hover:border-red-200 hover:bg-red-50 font-semibold disabled:opacity-40"
                                        title="Gỡ học sinh khỏi lớp này (không xóa tài khoản hay dữ liệu năm cũ)"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Gỡ khỏi lớp</span>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: GIÁO VIÊN                                                    */}
      {/* =================================================================== */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative flex-1 min-w-[210px] max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  placeholder="Tìm mã giáo viên, họ tên, email..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-[#DCE8F7] rounded-xl focus:border-[#006BFF] outline-hidden"
                />
              </div>

              <select
                value={teacherStatusFilter}
                onChange={e => setTeacherStatusFilter(e.target.value as 'all' | RealAuthStatus)}
                className="px-3 py-2 text-xs border border-[#DCE8F7] rounded-xl bg-white font-semibold text-[#082B52]"
              >
                <option value="all">Tất cả trạng thái Auth</option>
                <option value="active">Đã kích hoạt</option>
                <option value="invited">Đã gửi mời</option>
                <option value="unconfirmed">Chờ xác nhận</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadTeachersTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] hover:bg-[#E4F0FF] text-xs font-bold text-[#082B52] whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#006BFF]" />
                <span>Tải mẫu Excel</span>
              </button>

              <button
                type="button"
                disabled={readOnlyMode}
                onClick={() =>
                  setExcelModal({
                    isOpen: true,
                    kind: 'teachers',
                    targetClass: null
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#082B52] hover:bg-[#0d3a6d] text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Nhập danh sách giáo viên</span>
              </button>

              <button
                type="button"
                disabled={readOnlyMode}
                onClick={openCreateTeacherModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Thêm giáo viên</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 text-[#006BFF] animate-spin mx-auto mb-2" />
                Đang tải danh sách giáo viên...
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có tài khoản giáo viên nào khớp điều kiện tìm kiếm.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F3F8FF] text-[#12345B] font-bold border-b border-[#DCE8F7]">
                    <tr>
                      <th className="py-3 px-4">Mã GV</th>
                      <th className="py-3 px-4">Họ và tên</th>
                      <th className="py-3 px-4">Email đăng nhập</th>
                      <th className="py-3 px-4">Phân công giảng dạy đang hoạt động</th>
                      <th className="py-3 px-4">Trạng thái Auth</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeachers.map(t => {
                      const activeTas = teachingAssignments.filter(
                        ta => ta.teacherId === t.id && ta.status === 'active'
                      );
                      const canResend =
                        !readOnlyMode &&
                        (t.authStatus === 'invited' || t.authStatus === 'unconfirmed');
                      return (
                        <tr key={t.id} className="hover:bg-[#F8FBFF]">
                          <td className="py-3 px-4 font-mono font-bold text-[#006BFF]">
                            {t.teacherCode || '—'}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#082B52]">{t.fullName}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{t.email}</td>
                          <td className="py-3 px-4">
                            {activeTas.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {activeTas.map(ta => (
                                  <span
                                    key={ta.id}
                                    className="inline-block px-2 py-0.5 rounded-md bg-[#EAF5FF] border border-[#CBE2FB] text-[#082B52] font-semibold"
                                  >
                                    {ta.className} ·{' '}
                                    {ta.subject ? getSubjectDisplayName(ta.subject) : 'Chưa gán môn'}
                                  </span>
                                ))}
                              </div>
                            ) : t.teachingClasses.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {t.teachingClasses.map((c, idx) => (
                                  <span
                                    key={`${c.id}-${idx}`}
                                    className="inline-block px-2 py-0.5 rounded-md bg-[#EAF5FF] border border-[#CBE2FB] text-[#082B52] font-semibold"
                                  >
                                    {c.name}
                                    {c.subjectLabel ? ` · ${c.subjectLabel}` : ''}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">Chưa có phân công</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                AUTH_STATUS_CLASSES[t.authStatus]
                              }`}
                            >
                              {t.authStatusLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                            {canResend && (
                              <button
                                type="button"
                                disabled={resendingId === t.id}
                                onClick={() => handleResendInvite(t)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 text-[#006BFF] font-bold hover:bg-blue-50 disabled:opacity-40"
                              >
                                <Send className="w-3 h-3" />
                                <span>{resendingId === t.id ? 'Đang gửi...' : 'Gửi lại mời'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openInspectDrawer(t)}
                              className="px-2.5 py-1 rounded-lg bg-[#F3F8FF] border border-[#DCE8F7] text-[#082B52] font-bold hover:bg-[#E4F0FF]"
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: PHÂN CÔNG GIẢNG DẠY                                          */}
      {/* =================================================================== */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {/* Pending legacy subject completion alert */}
          {pendingSubjectCompletions.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-amber-900">
                    Có {pendingSubjectCompletions.length} phân công cũ chuyển sang từ lớp học chưa có môn
                  </p>
                  <p className="text-amber-900 mt-0.5">
                    Hệ thống không tự suy đoán môn học. Vui lòng chọn đúng môn giảng dạy cho từng phân công bên dưới để giáo viên có thể giao bài và chấm điểm theo phạm vi lớp – môn.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-7">
                {pendingSubjectCompletions.slice(0, 6).map(ta => (
                  <button
                    key={ta.id}
                    type="button"
                    disabled={readOnlyMode}
                    onClick={() => openEditTaModal(ta)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      Bổ sung môn: {ta.teacherName} — {ta.className} ({ta.schoolYear})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cutover Readiness Check before enabling Migration 05 */}
          {cutoverReadiness && (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#006BFF]" />
                  <h3 className="text-sm font-bold text-[#082B52]">
                    Kiểm tra sẵn sàng trước khi bật Bước 5 (05_enable_subject_rls_and_hardening.sql)
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg font-bold border ${
                    cutoverReadiness.readyForCutover
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  {cutoverReadiness.readyForCutover
                    ? 'Sẵn sàng bật phân quyền theo môn (Bước 5)'
                    : `Cần hoàn tất: ${cutoverReadiness.missingSubjectCount} thiếu môn · ${cutoverReadiness.impactedClassCount} lớp chịu ảnh hưởng`}
                </span>
              </div>

              {cutoverReadiness.missingSubjectItems.length > 0 && (
                <div className="space-y-2">
                  <p className="font-bold text-[#082B52]">
                    1. Danh sách &quot;Thiếu môn&quot; cần bổ sung đúng Giáo viên – Lớp – Môn – Năm học:
                  </p>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F3F8FF] text-[#12345B] font-bold">
                        <tr>
                          <th className="py-2 px-3">Giáo viên</th>
                          <th className="py-2 px-3">Lớp</th>
                          <th className="py-2 px-3">Năm học</th>
                          <th className="py-2 px-3 text-center">Bài đã giao</th>
                          <th className="py-2 px-3 text-center">Bài HS đã nộp</th>
                          <th className="py-2 px-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cutoverReadiness.missingSubjectItems.map(item => {
                          const matchedTa = teachingAssignments.find(t => t.id === item.teachingAssignmentId);
                          return (
                            <tr key={item.teachingAssignmentId} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-[#082B52]">
                                {item.teacherName}
                              </td>
                              <td className="py-2 px-3 font-bold">{item.className}</td>
                              <td className="py-2 px-3 tabular-nums">{item.schoolYear}</td>
                              <td className="py-2 px-3 text-center tabular-nums">
                                {item.affectedAssignmentsCount}
                              </td>
                              <td className="py-2 px-3 text-center tabular-nums">
                                {item.affectedSubmissionsCount}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {matchedTa && !readOnlyMode && (
                                  <button
                                    type="button"
                                    onClick={() => openEditTaModal(matchedTa)}
                                    className="px-2.5 py-1 rounded-lg bg-[#006BFF] text-white font-bold hover:bg-blue-600"
                                  >
                                    Bổ sung môn
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {cutoverReadiness.impactedClasses.length > 0 && (
                <div className="space-y-2">
                  <p className="font-bold text-[#082B52]">
                    2. Lớp sẽ bị ảnh hưởng quyền truy cập khi chuyển sang Bước 5:
                  </p>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F3F8FF] text-[#12345B] font-bold">
                        <tr>
                          <th className="py-2 px-3">Lớp học</th>
                          <th className="py-2 px-3">Năm học</th>
                          <th className="py-2 px-3">GV lớp cũ</th>
                          <th className="py-2 px-3 text-center">Vai trò class_roles</th>
                          <th className="py-2 px-3 text-center">Thiếu môn</th>
                          <th className="py-2 px-3">Lý do ảnh hưởng</th>
                          <th className="py-2 px-3 text-right">Xử lý</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cutoverReadiness.impactedClasses.map(cls => (
                          <tr key={cls.classId} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-[#082B52]">{cls.className}</td>
                            <td className="py-2 px-3 tabular-nums">{cls.schoolYear}</td>
                            <td className="py-2 px-3">{cls.legacyTeacherName || '—'}</td>
                            <td className="py-2 px-3 text-center tabular-nums">
                              {cls.explicitClassRoleCount}
                            </td>
                            <td className="py-2 px-3 text-center tabular-nums">
                              {cls.unmappedAssignmentsCount}
                            </td>
                            <td className="py-2 px-3 text-amber-900">{cls.impactReason}</td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClassId(cls.classId);
                                  setActiveTab('classes');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#F3F8FF] border border-[#DCE8F7] text-[#082B52] font-bold hover:bg-[#E4F0FF]"
                              >
                                Mở chi tiết lớp
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {cutoverReadiness.readyForCutover && (
                <p className="text-emerald-800 font-semibold">
                  Tất cả phân công đã có môn hợp lệ và không còn lớp phụ thuộc hoàn toàn vào teacher_id cũ. Quản trị viên có thể chạy <code>src/data/05_enable_subject_rls_and_hardening.sql</code> trên Supabase SQL Editor.
                </p>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* View mode toggle */}
              <div className="inline-flex p-1 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7]">
                <button
                  type="button"
                  onClick={() => setAssignViewMode('by_teacher')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    assignViewMode === 'by_teacher'
                      ? 'bg-[#082B52] text-white'
                      : 'text-[#082B52] hover:bg-white'
                  }`}
                >
                  Theo giáo viên
                </button>
                <button
                  type="button"
                  onClick={() => setAssignViewMode('by_class')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    assignViewMode === 'by_class'
                      ? 'bg-[#082B52] text-white'
                      : 'text-[#082B52] hover:bg-white'
                  }`}
                >
                  Theo lớp
                </button>
              </div>

              <select
                value={assignYearFilter}
                onChange={e => setAssignYearFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-[#DCE8F7] rounded-xl bg-white font-semibold text-[#082B52]"
              >
                <option value="all">Tất cả năm học</option>
                {schoolYearOptions.map(y => (
                  <option key={y} value={y}>
                    Năm học {y}
                  </option>
                ))}
              </select>

              <select
                value={assignSubjectFilter}
                onChange={e => setAssignSubjectFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-[#DCE8F7] rounded-xl bg-white font-semibold text-[#082B52]"
              >
                <option value="all">Tất cả môn</option>
                {CANONICAL_SUBJECT_CATALOG.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={assignStatusFilter}
                onChange={e => setAssignStatusFilter(e.target.value as 'active' | 'ended' | 'all')}
                className="px-3 py-2 text-xs border border-[#DCE8F7] rounded-xl bg-white font-semibold text-[#082B52]"
              >
                <option value="active">Đang giảng dạy</option>
                <option value="ended">Đã kết thúc</option>
                <option value="all">Tất cả trạng thái</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadTeachingAssignmentsTemplate(schoolYearOptions[0] || '2025-2026')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] hover:bg-[#E4F0FF] text-xs font-bold text-[#082B52] whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#006BFF]" />
                <span>Tải mẫu Excel</span>
              </button>

              <button
                type="button"
                disabled={readOnlyMode || !teachingSchemaReady}
                onClick={() =>
                  setExcelModal({
                    isOpen: true,
                    kind: 'assignments',
                    targetClass: null
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#082B52] hover:bg-[#0d3a6d] text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Nhập phân công</span>
              </button>

              <button
                type="button"
                disabled={readOnlyMode || !teachingSchemaReady}
                onClick={openCreateTeachingAssignmentModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm phân công</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-10 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 text-[#006BFF] animate-spin mx-auto mb-2" />
              Đang tải dữ liệu phân công giảng dạy...
            </div>
          ) : filteredTeachingAssignments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] p-10 text-center space-y-2.5">
              <Layers className="w-9 h-9 text-[#1769C2] mx-auto" />
              <h3 className="text-base font-bold text-[#082B52]">
                Chưa có phân công giảng dạy nào khớp bộ lọc
              </h3>
              <p className="text-xs text-slate-500">
                Bấm &quot;Thêm phân công&quot; để chọn 1 giáo viên, 1 môn và nhiều lớp trong cùng năm học, hoặc nhập hàng loạt từ Excel.
              </p>
            </div>
          ) : assignViewMode === 'by_teacher' ? (
            <div className="space-y-3">
              {assignmentsGroupedByTeacher.map(group => (
                <div
                  key={group.teacherId}
                  className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden"
                >
                  <div className="px-4 py-3 bg-[#F3F8FF] border-b border-[#DCE8F7] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#082B52]">{group.teacherName}</span>
                      {group.teacherCode && (
                        <span className="font-mono font-bold text-[#006BFF]">
                          {group.teacherCode}
                        </span>
                      )}
                      {group.teacherEmail && (
                        <span className="text-slate-500 font-mono">· {group.teacherEmail}</span>
                      )}
                    </div>
                    <span className="font-bold text-[#082B52] tabular-nums">
                      {group.rows.length} phân công
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[#12345B] bg-[#FBFDFF] border-b border-slate-100 font-bold">
                        <tr>
                          <th className="py-2 px-4">Năm học</th>
                          <th className="py-2 px-4">Lớp</th>
                          <th className="py-2 px-4">Môn giảng dạy</th>
                          <th className="py-2 px-4">Trạng thái</th>
                          <th className="py-2 px-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.rows.map(ta => (
                          <tr key={ta.id} className="hover:bg-[#F8FBFF]">
                            <td className="py-2.5 px-4 tabular-nums font-semibold text-slate-700">
                              {ta.schoolYear}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-[#082B52]">
                              {ta.className}{' '}
                              {ta.classCode ? (
                                <span className="font-mono text-[#006BFF] font-normal">
                                  ({ta.classCode})
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-4">
                              {ta.subject ? (
                                <span className="font-bold text-[#082B52]">
                                  {getSubjectDisplayName(ta.subject)}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                                  Chưa xác định môn
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              {ta.status === 'active' ? (
                                <span className="text-emerald-700 font-bold">Đang dạy</span>
                              ) : (
                                <span className="text-slate-500">Đã kết thúc</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                              {!readOnlyMode && (
                                <button
                                  type="button"
                                  onClick={() => openEditTaModal(ta)}
                                  className="px-2.5 py-1 rounded-lg bg-[#F3F8FF] border border-[#DCE8F7] text-[#082B52] font-bold hover:bg-[#E4F0FF]"
                                >
                                  {ta.needsSubjectCompletion ? 'Bổ sung môn' : 'Sửa'}
                                </button>
                              )}
                              {!readOnlyMode && ta.status === 'active' && (
                                <button
                                  type="button"
                                  onClick={() => setEndingTaTarget(ta)}
                                  className="px-2.5 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-bold"
                                >
                                  Kết thúc
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {assignmentsGroupedByClass.map(group => (
                <div
                  key={group.classId}
                  className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden"
                >
                  <div className="px-4 py-3 bg-[#F3F8FF] border-b border-[#DCE8F7] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#082B52]">{group.className}</span>
                      {group.classCode && (
                        <span className="font-mono font-bold text-[#006BFF]">{group.classCode}</span>
                      )}
                      {group.grade && <span className="text-slate-500">· Khối {group.grade}</span>}
                      <span className="text-slate-500">· Năm học {group.schoolYear}</span>
                    </div>
                    <span className="font-bold text-[#082B52] tabular-nums">
                      {group.rows.length} phân công
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[#12345B] bg-[#FBFDFF] border-b border-slate-100 font-bold">
                        <tr>
                          <th className="py-2 px-4">Môn giảng dạy</th>
                          <th className="py-2 px-4">Giáo viên</th>
                          <th className="py-2 px-4">Mã GV</th>
                          <th className="py-2 px-4">Trạng thái</th>
                          <th className="py-2 px-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.rows.map(ta => (
                          <tr key={ta.id} className="hover:bg-[#F8FBFF]">
                            <td className="py-2.5 px-4 font-bold text-[#082B52]">
                              {ta.subject ? (
                                getSubjectDisplayName(ta.subject)
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                                  Chưa xác định môn
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-[#082B52]">
                              {ta.teacherName || 'Giáo viên'}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[#006BFF]">
                              {ta.teacherCode || '—'}
                            </td>
                            <td className="py-2.5 px-4">
                              {ta.status === 'active' ? (
                                <span className="text-emerald-700 font-bold">Đang dạy</span>
                              ) : (
                                <span className="text-slate-500">Đã kết thúc</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                              {!readOnlyMode && (
                                <button
                                  type="button"
                                  onClick={() => openEditTaModal(ta)}
                                  className="px-2.5 py-1 rounded-lg bg-[#F3F8FF] border border-[#DCE8F7] text-[#082B52] font-bold hover:bg-[#E4F0FF]"
                                >
                                  {ta.needsSubjectCompletion ? 'Bổ sung môn' : 'Sửa'}
                                </button>
                              )}
                              {!readOnlyMode && ta.status === 'active' && (
                                <button
                                  type="button"
                                  onClick={() => setEndingTaTarget(ta)}
                                  className="px-2.5 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-bold"
                                >
                                  Kết thúc
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECONDARY VIEW: TẤT CẢ HỒ SƠ & NHẬT KÝ QUẢN TRỊ                     */}
      {/* =================================================================== */}
      {activeTab === 'accounts_audit' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAuditInsideAccounts(false)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                  !showAuditInsideAccounts
                    ? 'bg-[#082B52] text-white border-[#082B52]'
                    : 'bg-white text-[#082B52] border-[#DCE8F7]'
                }`}
              >
                Tất cả hồ sơ ({accounts.length})
              </button>
              <button
                type="button"
                onClick={() => setShowAuditInsideAccounts(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                  showAuditInsideAccounts
                    ? 'bg-[#082B52] text-white border-[#082B52]'
                    : 'bg-white text-[#082B52] border-[#DCE8F7]'
                }`}
              >
                Nhật ký quản trị ({auditLogs.length})
              </button>
            </div>

            {!showAuditInsideAccounts && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={accountSearch}
                    onChange={e => setAccountSearch(e.target.value)}
                    placeholder="Tìm tên, email, mã HS/GV..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-[#DCE8F7] rounded-xl"
                  />
                </div>
                <select
                  value={accountRoleFilter}
                  onChange={e => setAccountRoleFilter(e.target.value as 'all' | UserRole)}
                  className="px-3 py-1.5 text-xs border border-[#DCE8F7] rounded-xl bg-white font-semibold"
                >
                  <option value="all">Tất cả vai trò</option>
                  <option value="student">Học sinh</option>
                  <option value="teacher">Giáo viên</option>
                  <option value="reviewer">Kiểm duyệt</option>
                  <option value="admin">Quản trị</option>
                </select>
              </div>
            )}
          </div>

          {!showAuditInsideAccounts ? (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F3F8FF] text-[#12345B] font-bold border-b border-[#DCE8F7]">
                    <tr>
                      <th className="py-2.5 px-4">Họ và tên</th>
                      <th className="py-2.5 px-4">Mã HS / GV</th>
                      <th className="py-2.5 px-4">Định danh đăng nhập / Email</th>
                      <th className="py-2.5 px-4">Vai trò CSDL</th>
                      <th className="py-2.5 px-4">Trạng thái Auth</th>
                      <th className="py-2.5 px-4 text-right">Quản lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAllAccounts.map(acc => (
                      <tr key={acc.id} className="hover:bg-[#F8FBFF]">
                        <td className="py-2.5 px-4 font-bold text-[#082B52]">{acc.fullName}</td>
                        <td className="py-2.5 px-4 font-mono text-[#006BFF]">
                          {acc.teacherCode || acc.studentCode || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {formatAccountLoginDisplay(acc.email, acc.studentCode, acc.role)}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${
                              ROLE_BADGE_CLASSES[acc.role]
                            }`}
                          >
                            {ROLE_LABELS[acc.role]}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                              AUTH_STATUS_CLASSES[acc.authStatus]
                            }`}
                          >
                            {acc.authStatusLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openInspectDrawer(acc)}
                            className="px-2.5 py-1 rounded-lg bg-[#F3F8FF] border border-[#DCE8F7] text-[#082B52] font-bold hover:bg-[#E4F0FF]"
                          >
                            Chi tiết &amp; Vai trò
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden">
              {auditWarning && (
                <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
                  {auditWarning}
                </div>
              )}
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F3F8FF] text-[#12345B] font-bold border-b border-[#DCE8F7] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Thời gian</th>
                      <th className="py-2.5 px-4">Người thực hiện</th>
                      <th className="py-2.5 px-4">Hành động</th>
                      <th className="py-2.5 px-4">Đối tượng</th>
                      <th className="py-2.5 px-4">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chưa có nhật ký quản trị nào.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-[#082B52]">{log.actor}</td>
                          <td className="py-2.5 px-4 font-semibold text-[#006BFF]">{log.action}</td>
                          <td className="py-2.5 px-4 font-mono">{log.target}</td>
                          <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: TẠO LỚP HỌC MỚI                                              */}
      {/* =================================================================== */}
      {createClassOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateClassSubmit}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-[#082B52]">Tạo lớp học mới</h3>
              <button
                type="button"
                onClick={() => setCreateClassOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createClassError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                {createClassError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Năm học: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newClassSchoolYear}
                  onChange={e => setNewClassSchoolYear(e.target.value)}
                  placeholder="2025-2026"
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Khối lớp: <span className="text-red-500">*</span>
                </label>
                <select
                  value={newClassGrade}
                  onChange={e => setNewClassGrade(e.target.value as Grade)}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
                >
                  <option value="6">Khối 6</option>
                  <option value="7">Khối 7</option>
                  <option value="8">Khối 8</option>
                  <option value="9">Khối 9</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên lớp: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="VD: Lớp 8A1"
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mã lớp (duy nhất theo năm):
                </label>
                <input
                  type="text"
                  value={newClassCode}
                  onChange={e => setNewClassCode(e.target.value)}
                  placeholder="VD: 8A1"
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl font-mono"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Giáo viên bộ môn sẽ được gán cho lớp ở tab <strong>Phân công giảng dạy</strong> (một lớp có thể có nhiều giáo viên theo từng môn).
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={creatingClass}
                onClick={() => setCreateClassOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creatingClass || !newClassName.trim()}
                className="px-5 py-2 text-xs font-bold bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl disabled:opacity-40"
              >
                {creatingClass ? 'Đang tạo lớp...' : 'Tạo lớp'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: SỬA THÔNG TIN LỚP HỌC                                        */}
      {/* =================================================================== */}
      {editingClass && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleUpdateClassSubmit}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-[#082B52]">Cập nhật thông tin lớp học</h3>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editClassError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
                {editClassError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Năm học: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editClassSchoolYear}
                  onChange={e => setEditClassSchoolYear(e.target.value)}
                  placeholder="2025-2026"
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Khối lớp: <span className="text-red-500">*</span>
                </label>
                <select
                  value={editClassGrade}
                  onChange={e => setEditClassGrade(e.target.value as Grade)}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
                >
                  <option value="6">Khối 6</option>
                  <option value="7">Khối 7</option>
                  <option value="8">Khối 8</option>
                  <option value="9">Khối 9</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên lớp: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editClassName}
                  onChange={e => setEditClassName(e.target.value)}
                  placeholder="VD: Lớp 8A1"
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mã lớp (duy nhất theo năm):
                </label>
                <input
                  type="text"
                  value={editClassCode}
                  onChange={e => setEditClassCode(e.target.value)}
                  placeholder="VD: 8A1"
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={updatingClass}
                onClick={() => setEditingClass(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={updatingClass || !editClassName.trim()}
                className="px-5 py-2 text-xs font-bold bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl disabled:opacity-40"
              >
                {updatingClass ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: XÁC NHẬN XÓA LỚP HỌC                                         */}
      {/* =================================================================== */}
      {deletingClassTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#082B52]">
                  Xác nhận xóa lớp học {deletingClassTarget.name}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Bạn sắp xóa lớp <strong>{deletingClassTarget.name}</strong> (Khối{' '}
                  <strong>{deletingClassTarget.grade}</strong> · Năm học{' '}
                  <strong>{deletingClassTarget.schoolYear}</strong>). Hồ sơ tài khoản học sinh, giáo viên và dữ liệu các lớp khác vẫn được bảo toàn nguyên vẹn.
                </p>
              </div>
            </div>

            {deleteClassError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 font-semibold">
                {deleteClassError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingClassBusy}
                onClick={() => {
                  setDeletingClassTarget(null);
                  setDeleteClassError(null);
                }}
                className="px-4 py-2 font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deletingClassBusy}
                onClick={handleConfirmDeleteClass}
                className="px-4 py-2 font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-40"
              >
                {deletingClassBusy ? 'Đang xóa lớp...' : 'Xác nhận xóa lớp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: THÊM 1 HỌC SINH / 1 GIÁO VIÊN                                */}
      {/* =================================================================== */}
      {createAccountOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#082B52]">
                  {splitCreatedAccount
                    ? 'Hoàn tất gán lớp cho học sinh vừa tạo'
                    : formRole === 'student'
                    ? 'Thêm học sinh vào lớp'
                    : 'Thêm tài khoản giáo viên'}
                </h3>
                {formRole === 'student' && activeClass && !splitCreatedAccount && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Lớp nhận: <strong>{activeClass.name}</strong> · Năm học:{' '}
                    <strong>{activeClass.schoolYear}</strong>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCreateAccountOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {splitCreatedAccount ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                  Đã tạo tài khoản cho <strong>{splitCreatedAccount.fullName}</strong> (
                  {splitCreatedAccount.email}).
                </div>
                {splitClassError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950">
                    {splitClassError}
                  </div>
                )}
                <select
                  value={splitRetryClassId}
                  onChange={e => setSplitRetryClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Khối {c.grade} · {c.schoolYear})
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateAccountOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600"
                  >
                    Để sau
                  </button>
                  <button
                    type="button"
                    disabled={retryingClassAssign}
                    onClick={handleRetrySplitClassAssign}
                    className="px-4 py-2 bg-[#006BFF] text-white rounded-xl font-bold disabled:opacity-40"
                  >
                    {retryingClassAssign ? 'Đang gán...' : 'Thử gán lớp lại'}
                  </button>
                </div>
              </div>
            ) : createdStudentCredentials ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Đã tạo tài khoản học sinh thành công!</span>
                  </div>
                  <p className="leading-relaxed text-emerald-900/90">
                    Mật khẩu khởi tạo dưới đây <strong>chỉ hiển thị một lần duy nhất</strong>. Học sinh dùng <strong>Mã học sinh</strong> và mật khẩu này để đăng nhập, sau đó hệ thống sẽ yêu cầu đổi mật khẩu riêng.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FBFF] border border-[#DCE8F7] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Họ và tên học sinh:</span>
                    <strong className="text-[#082B52]">{createdStudentCredentials.fullName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tên đăng nhập (Mã học sinh):</span>
                    <code className="px-2 py-0.5 rounded bg-white border border-[#DCE8F7] font-mono font-bold text-[#006BFF]">
                      {createdStudentCredentials.studentCode}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Mật khẩu khởi tạo (1 lần):</span>
                    <div className="inline-flex items-center gap-1.5">
                      <code className="px-2.5 py-1 rounded bg-amber-50 border border-amber-300 font-mono font-bold text-sm text-[#082B52]">
                        {createdStudentCredentials.initialPassword}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(
                              `Mã HS: ${createdStudentCredentials.studentCode} | Mật khẩu: ${createdStudentCredentials.initialPassword}`
                            );
                            setCopiedToken('created_student_pw');
                            setTimeout(() => setCopiedToken(null), 2000);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#DCE8F7] hover:bg-[#F3F8FF] font-bold text-[#082B52]"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#006BFF]" />
                        <span>{copiedToken === 'created_student_pw' ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedStudentCredentials(null);
                      setCreateAccountOpen(false);
                    }}
                    className="px-5 py-2 bg-[#082B52] hover:bg-[#0d3a6d] text-white font-bold rounded-xl"
                  >
                    Đã lưu thông tin — Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAccountSubmit} className="space-y-3.5 text-xs">
                {createAccountError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-2">
                    <p className="font-medium">{createAccountError}</p>
                    {(existingConflictId || createAccountError.toLowerCase().includes('tồn tại')) && (
                      <button
                        type="button"
                        onClick={() => openExistingById(existingConflictId, formEmail)}
                        className="px-3 py-1 bg-white border border-red-300 text-red-800 rounded-lg font-bold"
                      >
                        Mở hồ sơ hiện có
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {formRole === 'student' ? 'Mã học sinh:' : 'Mã giáo viên:'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formRole === 'student' ? formStudentCode : formTeacherCode}
                      onChange={e =>
                        formRole === 'student'
                          ? setFormStudentCode(e.target.value)
                          : setFormTeacherCode(e.target.value)
                      }
                      placeholder={formRole === 'student' ? 'VD: HS9A101' : 'VD: GV001'}
                      className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Họ và tên: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formFullName}
                      onChange={e => setFormFullName(e.target.value)}
                      placeholder="Họ và tên đầy đủ"
                      className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl"
                    />
                  </div>
                </div>

                {formRole !== 'student' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Email đăng nhập: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      placeholder="ten@taydo.edu.vn"
                      className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl font-mono"
                    />
                  </div>
                )}

                <div className="p-3 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] text-[11px] text-[#12345B] flex items-start gap-2">
                  {formRole === 'student' ? (
                    <>
                      <Key className="w-4 h-4 text-[#006BFF] shrink-0 mt-0.5" />
                      <span>
                        Học sinh <strong>không cần email</strong>. Hệ thống tạo tài khoản trực tiếp bằng <strong>Mã học sinh</strong> và sinh mật khẩu khởi tạo ngẫu nhiên (hoặc giữ nguyên mật khẩu hiện có nếu học sinh đã có tài khoản từ trước).
                      </span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-[#006BFF] shrink-0 mt-0.5" />
                      <span>
                        Hệ thống gửi email mời kích hoạt Supabase Auth để giáo viên tự đặt mật khẩu. Không dùng tên hiển thị để suy đoán quyền.
                      </span>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={submittingCreate}
                    onClick={() => setCreateAccountOpen(false)}
                    className="px-4 py-2 font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submittingCreate ||
                      !formFullName.trim() ||
                      (formRole === 'student' ? !formStudentCode.trim() : !formEmail.trim())
                    }
                    className="px-5 py-2 font-bold bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl disabled:opacity-40"
                  >
                    {submittingCreate
                      ? 'Đang xử lý...'
                      : formRole === 'student'
                      ? 'Tạo / xếp lớp học sinh'
                      : 'Tạo & gửi lời mời'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: THÊM PHÂN CÔNG GIẢNG DẠY (1 GV + 1 MÔN + NHIỀU LỚP)         */}
      {/* =================================================================== */}
      {createTaOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateTeachingAssignmentSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#082B52]">Thêm phân công giảng dạy</h3>
                <p className="text-xs text-slate-500">
                  Chọn 1 giáo viên, 1 môn chuẩn và nhiều lớp giảng dạy trong cùng năm học.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateTaOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {taError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 font-semibold">
                {taError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Năm học:</label>
                <select
                  value={taSchoolYear}
                  onChange={e => {
                    setTaSchoolYear(e.target.value);
                    setTaClassIds([]);
                  }}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
                >
                  {schoolYearOptions.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Môn giảng dạy:</label>
                <select
                  value={taSubject}
                  onChange={e => setTaSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
                >
                  {CANONICAL_SUBJECT_CATALOG.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.shortCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1">Giáo viên:</label>
              <select
                value={taTeacherId}
                onChange={e => setTaTeacherId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
              >
                <option value="">-- Chọn giáo viên --</option>
                {teacherAccounts.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.teacherCode ? `[${t.teacherCode}] ` : ''}
                    {t.fullName} ({t.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">
                  Chọn các lớp được phân công ({taClassIds.length} lớp đã chọn):
                </label>
                {classesMatchingTaYear.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setTaClassIds(
                        taClassIds.length === classesMatchingTaYear.length
                          ? []
                          : classesMatchingTaYear.map(c => c.id)
                      )
                    }
                    className="text-[#006BFF] font-bold hover:underline"
                  >
                    {taClassIds.length === classesMatchingTaYear.length
                      ? 'Bỏ chọn tất cả'
                      : 'Chọn tất cả'}
                  </button>
                )}
              </div>

              {classesMatchingTaYear.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">
                  Chưa có lớp học nào thuộc năm học {taSchoolYear}.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2.5 border border-[#DCE8F7] rounded-xl bg-[#FBFDFF]">
                  {classesMatchingTaYear.map(cls => {
                    const checked = taClassIds.includes(cls.id);
                    return (
                      <label
                        key={cls.id}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#EAF3FD] border-[#006BFF] text-[#082B52] font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTaClassSelection(cls.id)}
                          className="w-3.5 h-3.5 text-[#006BFF]"
                        />
                        <span className="truncate">
                          {cls.name}
                          {cls.classCode ? ` (${cls.classCode})` : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1">Ghi chú (tùy chọn):</label>
              <input
                type="text"
                value={taNotes}
                onChange={e => setTaNotes(e.target.value)}
                placeholder="VD: Phân công học kỳ I – II năm học 2025-2026"
                className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={savingTa}
                onClick={() => setCreateTaOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingTa || !taTeacherId || taClassIds.length === 0}
                className="px-5 py-2 text-xs font-bold bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl disabled:opacity-40"
              >
                {savingTa ? 'Đang lưu...' : `Lưu phân công (${taClassIds.length} lớp)`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: SỬA / BỔ SUNG MÔN PHÂN CÔNG                                  */}
      {/* =================================================================== */}
      {editingTa && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleUpdateTaSubmit}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#082B52]">
                  {editingTa.needsSubjectCompletion
                    ? 'Bổ sung môn cho phân công chuyển tiếp'
                    : 'Cập nhật phân công giảng dạy'}
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Giáo viên: <strong>{editingTa.teacherName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTa(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editTaError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 font-semibold">
                {editTaError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Năm học:</label>
                <input
                  type="text"
                  value={editTaSchoolYear}
                  onChange={e => setEditTaSchoolYear(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lớp học:</label>
                <select
                  value={editTaClassId}
                  onChange={e => setEditTaClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.schoolYear})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Môn giảng dạy:</label>
                <select
                  value={editTaSubject}
                  onChange={e => setEditTaSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
                >
                  {CANONICAL_SUBJECT_CATALOG.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.shortCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú:</label>
                <input
                  type="text"
                  value={editTaNotes}
                  onChange={e => setEditTaNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DCE8F7] rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={updatingTa}
                onClick={() => setEditingTa(null)}
                className="px-4 py-2 font-bold text-slate-600 border border-slate-300 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={updatingTa}
                className="px-5 py-2 font-bold bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl disabled:opacity-40"
              >
                {updatingTa ? 'Đang lưu...' : 'Lưu cập nhật'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: XÁC NHẬN KẾT THÚC PHÂN CÔNG                                  */}
      {/* =================================================================== */}
      {endingTaTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-[#082B52]">
                  Xác nhận kết thúc phân công giảng dạy
                </h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Bạn sắp kết thúc phân công của <strong>{endingTaTarget.teacherName}</strong> tại lớp{' '}
                  <strong>{endingTaTarget.className}</strong> (môn{' '}
                  <strong>
                    {endingTaTarget.subject
                      ? getSubjectDisplayName(endingTaTarget.subject)
                      : 'Chưa gán môn'}
                  </strong>
                  ). Giáo viên sẽ không còn quyền giao bài mới hoặc chấm bài thuộc phạm vi này.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={endingTaBusy}
                onClick={() => setEndingTaTarget(null)}
                className="px-4 py-2 font-bold text-slate-600 border border-slate-300 rounded-xl"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={endingTaBusy}
                onClick={handleConfirmEndTa}
                className="px-4 py-2 font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-40"
              >
                {endingTaBusy ? 'Đang kết thúc...' : 'Xác nhận kết thúc'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CHI TIẾT HỒ SƠ, VAI TRÒ & GÁN LỚP                            */}
      {/* =================================================================== */}
      {selectedAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#DCE8F7] space-y-4 my-8 text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#082B52]">{selectedAccount.fullName}</h3>
                <p className="text-slate-500 font-mono mt-0.5">
                  {formatAccountLoginDisplay(
                    selectedAccount.email,
                    selectedAccount.studentCode,
                    selectedAccount.role
                  )}
                  {selectedAccount.teacherCode ? ` · Mã GV: ${selectedAccount.teacherCode}` : ''}
                  {selectedAccount.studentCode &&
                  !isStudentInternalAuthEmail(selectedAccount.email)
                    ? ` · Mã HS: ${selectedAccount.studentCode}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {drawerNotice && (
              <div
                className={`p-3 rounded-xl border font-semibold ${
                  drawerNotice.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {drawerNotice.text}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 bg-[#F8FBFF] border border-[#DCE8F7] rounded-xl p-3">
              <div>
                <span className="text-slate-500 block">Trạng thái Auth</span>
                <strong className="text-[#082B52]">{selectedAccount.authStatusLabel}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Gửi mời lúc</span>
                <span className="font-semibold tabular-nums">
                  {formatDateTime(selectedAccount.invitedAt)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Đăng nhập gần nhất</span>
                <span className="font-semibold tabular-nums">
                  {formatDateTime(selectedAccount.lastSignInAt)}
                </span>
              </div>
            </div>

            {/* Role Management */}
            <div className="border border-[#DCE8F7] rounded-xl p-3.5 space-y-2">
              <div className="font-bold text-[#082B52] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#006BFF]" />
                <span>Vai trò trên cơ sở dữ liệu (public.profiles.role)</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={pendingRole}
                  disabled={readOnlyMode || updatingRole}
                  onChange={e => setPendingRole(e.target.value as UserRole)}
                  className="flex-1 px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white font-semibold"
                >
                  <option value="student">Học sinh</option>
                  <option value="teacher">Giáo viên</option>
                  <option value="reviewer">Kiểm duyệt</option>
                  <option value="admin">Quản trị viên</option>
                </select>
                <button
                  type="button"
                  disabled={readOnlyMode || updatingRole || pendingRole === selectedAccount.role}
                  onClick={handleUpdateRoleInDrawer}
                  className="px-4 py-2 bg-[#082B52] text-white font-bold rounded-xl disabled:opacity-40 whitespace-nowrap"
                >
                  {updatingRole ? 'Đang lưu...' : 'Lưu vai trò'}
                </button>
              </div>
            </div>

            {/* Student Password Reset by Admin */}
            {selectedAccount.role === 'student' && !readOnlyMode && (
              <div className="border border-[#DCE8F7] rounded-xl p-3.5 space-y-2.5 bg-[#FBFDFF]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-[#082B52] flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-[#006BFF]" />
                      <span>Cấp lại mật khẩu học sinh (khi quên mật khẩu)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Tạo mật khẩu khởi tạo ngẫu nhiên mới và yêu cầu học sinh đổi lại khi đăng nhập.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={resettingStudentPassword}
                    onClick={handleResetStudentPasswordInDrawer}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-40 whitespace-nowrap"
                  >
                    {resettingStudentPassword ? 'Đang cấp MK...' : 'Cấp mật khẩu khởi tạo mới'}
                  </button>
                </div>

                {resetPasswordResult && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                    <p className="text-[11px] text-amber-900 font-semibold">
                      Mật khẩu mới chỉ hiển thị một lần duy nhất bên dưới. Hãy sao chép và gửi cho học sinh:
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-amber-200">
                      <div className="space-x-2">
                        <span className="text-slate-600">Mã HS:</span>
                        <code className="font-mono font-bold text-[#006BFF]">
                          {resetPasswordResult.studentCode || '—'}
                        </code>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-600">Mật khẩu mới:</span>
                        <code className="font-mono font-bold text-sm text-[#082B52]">
                          {resetPasswordResult.initialPassword}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(resetPasswordResult.initialPassword);
                            setCopiedToken('drawer_reset_pw');
                            setTimeout(() => setCopiedToken(null), 2000);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F3F8FF] border border-[#DCE8F7] hover:bg-[#E4F0FF] font-bold text-[#082B52]"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#006BFF]" />
                        <span>{copiedToken === 'drawer_reset_pw' ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Student Class Assignment */}
            {selectedAccount.role === 'student' && (
              <div className="border border-[#DCE8F7] rounded-xl p-3.5 space-y-2.5">
                <div className="font-bold text-[#082B52]">Các lớp học sinh đã tham gia</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAccount.enrolledClasses.map(c => (
                    <span
                      key={c.id}
                      className="px-2.5 py-1 rounded-lg bg-[#EAF5FF] border border-[#CBE2FB] font-bold text-[#082B52]"
                    >
                      {c.name} ({c.schoolYear || '2025-2026'})
                    </span>
                  ))}
                  {selectedAccount.enrolledClasses.length === 0 && (
                    <span className="text-slate-400">Chưa tham gia lớp nào.</span>
                  )}
                </div>

                {!readOnlyMode && (
                  <div className="flex gap-2 pt-1">
                    <select
                      value={assignClassIdInDrawer}
                      onChange={e => setAssignClassIdInDrawer(e.target.value)}
                      className="flex-1 px-3 py-2 border border-[#DCE8F7] rounded-xl bg-white"
                    >
                      <option value="">-- Chọn lớp để gán thêm --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Khối {c.grade} · {c.schoolYear})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={assigningClassInDrawer || !assignClassIdInDrawer}
                      onClick={handleAssignClassInDrawer}
                      className="px-4 py-2 bg-[#006BFF] text-white font-bold rounded-xl disabled:opacity-40"
                    >
                      {assigningClassInDrawer ? 'Đang gán...' : 'Gán lớp'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAccount(null)}
                className="px-5 py-2 bg-[#082B52] text-white font-bold rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: NHẬP EXCEL 3 BƯỚC                                            */}
      {/* =================================================================== */}
      <ExcelImportModal
        isOpen={excelModal.isOpen}
        kind={excelModal.kind}
        targetClass={excelModal.targetClass}
        defaultSchoolYear={schoolYearOptions[0] || '2025-2026'}
        getAccessToken={getAccessToken}
        onClose={() => setExcelModal(prev => ({ ...prev, isOpen: false }))}
        onCompleted={refreshAll}
      />
    </div>
  );
};
