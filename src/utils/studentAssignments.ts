import { Assignment, ClassRoom, Exam, Submission } from '../types';

export type AssignmentBucket = 'todo' | 'submitted' | 'overdue';

export interface StudentIdentity {
  id?: string;
  email?: string | null;
  code?: string | null;
  role?: string;
}

export interface StudentAssignmentItem {
  assignment: Assignment;
  exam: Exam | null;
  bucket: AssignmentBucket;
  taskTypeLabel: string;
  deadlineDate: Date | null;
  deadlineLabel: string;
  openDate: Date | null;
  isNotYetOpen: boolean;
  hasInProgressDraft: boolean;
  actionLabel: 'Bắt đầu' | 'Làm tiếp' | 'Chưa đến giờ mở' | 'Xem kết quả' | 'Đã quá hạn';
  submission: Submission | null;
  linkError: string | null;
}

export interface ClassifiedStudentAssignments {
  todo: StudentAssignmentItem[];
  submitted: StudentAssignmentItem[];
  overdue: StudentAssignmentItem[];
  totalVisible: number;
  hasEnrolledClasses: boolean;
}

export const MISSING_OR_INVALID_EXAM_MESSAGE = 'Không thể mở bài. Vui lòng báo giáo viên';

/**
 * Parse flexible datetime strings used across mockData, CreateExamModal (vi-VN locale), and Supabase ISO timestamps.
 */
export function parseAssignmentDate(raw?: string | null): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Format "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"
  const ymdMatch = trimmed.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (ymdMatch) {
    const [, y, m, d, hh = '23', mm = '59', ss = '59'] = ymdMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // 2. Vietnamese locale: "HH:mm(:ss)? DD/MM/YYYY" or "DD/MM/YYYY(,? HH:mm(:ss)?)"
  const timeFirstMatch = trimmed.match(
    /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*,?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );
  if (timeFirstMatch) {
    const [, hh, mm, ss = '0', d, m, y] = timeFirstMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dateFirstMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (dateFirstMatch) {
    const [, d, m, y, hh = '23', mm = '59', ss = '59'] = dateFirstMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // 3. Full ISO-8601 / timezone-aware timestamps
  const parsedMs = Date.parse(trimmed);
  if (!Number.isNaN(parsedMs)) {
    return new Date(parsedMs);
  }

  return null;
}

export function formatAssignmentDeadline(raw?: string | null): string {
  if (!raw || !raw.trim()) return '';
  const parsed = parseAssignmentDate(raw);
  if (!parsed) return raw.trim();

  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} • ${hh}:${min}`;
}

export function getAssignmentTaskType(assignment: Assignment, exam?: Exam | null): string {
  if (assignment.isComputerLabMode) {
    return 'Thực hành phòng máy';
  }

  if (exam?.period) {
    switch (exam.period) {
      case 'mid1':
        return 'Kiểm tra Giữa kỳ I';
      case 'final1':
        return 'Kiểm tra Cuối kỳ I';
      case 'mid2':
        return 'Kiểm tra Giữa kỳ II';
      case 'final2':
        return 'Kiểm tra Cuối kỳ II';
    }
  }

  const title = (assignment.examTitle || exam?.title || '').toLowerCase();
  if (title.includes('thực hành')) return 'Bài thực hành';
  if (title.includes('luyện tập') || title.includes('bài tập')) return 'Bài tập';
  if (title.includes('ôn tập')) return 'Ôn tập';
  return 'Bài kiểm tra';
}

/**
 * Determine classes the current student account belongs to.
 * Only students explicitly enrolled in a class roster are granted access to that class's assignments.
 */
export function getEnrolledClassIdsForStudent(
  classes: ClassRoom[],
  identity: StudentIdentity
): Set<string> {
  const enrolledIds = new Set<string>();
  const idMatch = identity.id?.trim();
  const emailMatch = identity.email?.trim().toLowerCase();
  const codeMatch = identity.code?.trim().toLowerCase();

  if (!idMatch && !emailMatch && !codeMatch) {
    return enrolledIds;
  }

  for (const cls of classes) {
    const isMember = (cls.students || []).some(st => {
      if (idMatch && st.id === idMatch) return true;
      if (emailMatch && st.email && st.email.trim().toLowerCase() === emailMatch) return true;
      if (codeMatch && st.code && st.code.trim().toLowerCase() === codeMatch) return true;
      return false;
    });
    if (isMember) {
      enrolledIds.add(cls.id);
    }
  }

  return enrolledIds;
}

export function filterAssignmentsForStudent(
  assignments: Assignment[],
  classes: ClassRoom[],
  identity: StudentIdentity
): Assignment[] {
  // Non-student accounts without student roster membership should not receive arbitrary student assignments
  if (identity.role && identity.role !== 'student') {
    const enrolled = getEnrolledClassIdsForStudent(classes, identity);
    if (enrolled.size === 0) return [];
    return assignments.filter(a => enrolled.has(a.classId));
  }

  const enrolledClassIds = getEnrolledClassIdsForStudent(classes, identity);
  if (enrolledClassIds.size === 0) return [];

  return assignments.filter(a => Boolean(a.classId) && enrolledClassIds.has(a.classId));
}

/**
 * Strictly validate an assignment -> exam link without falling back to sample/first exam.
 */
export function validateAssignmentExamLink(
  assignment: Assignment | null | undefined,
  exams: Exam[],
  options: { requireLoadedQuestions?: boolean } = {}
): { valid: boolean; exam: Exam | null; error?: string } {
  const { requireLoadedQuestions = true } = options;

  if (!assignment || !assignment.examId) {
    return { valid: false, exam: null, error: MISSING_OR_INVALID_EXAM_MESSAGE };
  }

  const matchedExam = exams.find(e => e.id === assignment.examId) || null;
  if (!matchedExam) {
    return { valid: false, exam: null, error: MISSING_OR_INVALID_EXAM_MESSAGE };
  }

  if (matchedExam.id !== assignment.examId) {
    return { valid: false, exam: null, error: MISSING_OR_INVALID_EXAM_MESSAGE };
  }

  if (assignment.subject && matchedExam.subject && matchedExam.subject !== assignment.subject) {
    return { valid: false, exam: null, error: MISSING_OR_INVALID_EXAM_MESSAGE };
  }

  if (assignment.grade && matchedExam.grade && matchedExam.grade !== assignment.grade) {
    return { valid: false, exam: null, error: MISSING_OR_INVALID_EXAM_MESSAGE };
  }

  const loadedCount = Array.isArray(matchedExam.questions) ? matchedExam.questions.length : 0;
  const summaryCount = typeof matchedExam.questionCount === 'number' ? matchedExam.questionCount : loadedCount;

  if (requireLoadedQuestions ? loadedCount === 0 : summaryCount === 0) {
    return { valid: false, exam: null, error: MISSING_OR_INVALID_EXAM_MESSAGE };
  }

  return { valid: true, exam: matchedExam };
}

export function getExamDraftStorageKey(assignmentId: string, studentId: string): string {
  return `exam_session_${assignmentId}_${studentId}`;
}

export function hasInProgressExamDraft(assignmentId: string, studentId: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(getExamDraftStorageKey(assignmentId, studentId));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(
      parsed &&
        typeof parsed === 'object' &&
        (parsed.answers || parsed.flagged || typeof parsed.secondsLeft === 'number' || parsed.timestamp)
    );
  } catch {
    return false;
  }
}

export function classifyStudentAssignments(params: {
  assignments: Assignment[];
  classes: ClassRoom[];
  exams: Exam[];
  submissions: Submission[];
  identity: StudentIdentity;
  enrolledClassIds?: string[];
  now?: Date;
  hasDraftFn?: (assignmentId: string, studentId: string) => boolean;
}): ClassifiedStudentAssignments {
  const {
    assignments,
    classes,
    exams,
    submissions,
    identity,
    enrolledClassIds,
    now = new Date(),
    hasDraftFn = hasInProgressExamDraft
  } = params;

  const resolvedEnrolledIds = enrolledClassIds
    ? new Set(enrolledClassIds)
    : getEnrolledClassIdsForStudent(classes, identity);

  const visibleAssignments =
    resolvedEnrolledIds.size === 0
      ? []
      : assignments.filter(a => Boolean(a.classId) && resolvedEnrolledIds.has(a.classId));

  const studentId = identity.id || '';

  const todo: StudentAssignmentItem[] = [];
  const submitted: StudentAssignmentItem[] = [];
  const overdue: StudentAssignmentItem[] = [];

  for (const assignment of visibleAssignments) {
    const linkCheck = validateAssignmentExamLink(assignment, exams, { requireLoadedQuestions: false });
    const exam = linkCheck.exam;

    // Match submission for this assignment and current student
    const studentSubmission =
      submissions.find(
        sub =>
          sub.assignmentId === assignment.id &&
          Boolean(studentId) &&
          sub.studentId === studentId &&
          (sub.status === 'submitted' || sub.status === 'graded' || Boolean(sub.submittedAt))
      ) || null;

    const deadlineDate = parseAssignmentDate(assignment.closeTime);
    const openDate = parseAssignmentDate(assignment.openTime);
    const deadlineLabel = formatAssignmentDeadline(assignment.closeTime);
    const taskTypeLabel = getAssignmentTaskType(assignment, exam);

    const isPastDeadline =
      assignment.status === 'closed' ||
      (deadlineDate !== null && now.getTime() > deadlineDate.getTime());

    const isNotYetOpen =
      assignment.status === 'scheduled' &&
      openDate !== null &&
      now.getTime() < openDate.getTime();

    const hasDraft = Boolean(studentId) && hasDraftFn(assignment.id, studentId);

    if (studentSubmission) {
      submitted.push({
        assignment,
        exam,
        bucket: 'submitted',
        taskTypeLabel,
        deadlineDate,
        deadlineLabel,
        openDate,
        isNotYetOpen: false,
        hasInProgressDraft: false,
        actionLabel: 'Xem kết quả',
        submission: studentSubmission,
        linkError: linkCheck.error || null
      });
      continue;
    }

    if (isPastDeadline) {
      overdue.push({
        assignment,
        exam,
        bucket: 'overdue',
        taskTypeLabel,
        deadlineDate,
        deadlineLabel,
        openDate,
        isNotYetOpen: false,
        hasInProgressDraft: hasDraft,
        actionLabel: 'Đã quá hạn',
        submission: null,
        linkError: linkCheck.error || null
      });
      continue;
    }

    todo.push({
      assignment,
      exam,
      bucket: 'todo',
      taskTypeLabel,
      deadlineDate,
      deadlineLabel,
      openDate,
      isNotYetOpen,
      hasInProgressDraft: hasDraft,
      actionLabel: isNotYetOpen ? 'Chưa đến giờ mở' : hasDraft ? 'Làm tiếp' : 'Bắt đầu',
      submission: null,
      linkError: linkCheck.error || null
    });
  }

  // Sort "Cần làm" by nearest deadline ascending; tasks without closeTime placed last
  todo.sort((a, b) => {
    const aTs = a.deadlineDate ? a.deadlineDate.getTime() : Number.POSITIVE_INFINITY;
    const bTs = b.deadlineDate ? b.deadlineDate.getTime() : Number.POSITIVE_INFINITY;
    if (aTs !== bTs) return aTs - bTs;
    return (a.assignment.examTitle || '').localeCompare(b.assignment.examTitle || '', 'vi');
  });

  // Sort "Quá hạn" by most recently missed deadline first
  overdue.sort((a, b) => {
    const aTs = a.deadlineDate ? a.deadlineDate.getTime() : 0;
    const bTs = b.deadlineDate ? b.deadlineDate.getTime() : 0;
    return bTs - aTs;
  });

  // Sort "Đã nộp" by submission time descending
  submitted.sort((a, b) => {
    const aSubTs = parseAssignmentDate(a.submission?.submittedAt)?.getTime() ?? 0;
    const bSubTs = parseAssignmentDate(b.submission?.submittedAt)?.getTime() ?? 0;
    return bSubTs - aSubTs;
  });

  return {
    todo,
    submitted,
    overdue,
    totalVisible: visibleAssignments.length,
    hasEnrolledClasses: resolvedEnrolledIds.size > 0
  };
}
