import { UserRole } from './index';

export type AccessMode =
  | 'PUBLIC_GUEST'
  | 'DEMO_TEACHER'
  | 'DEMO_STUDENT'
  | 'KHKT_SHOWCASE'
  | 'PRODUCTION_USER';

export type DemoRole = 'teacher' | 'student';

export interface ResolvedRouteState {
  view: string;
  suggestedAccessMode?: AccessMode;
}

export interface RoutePermissionInput {
  view: string;
  accessMode: AccessMode;
  prodRole: UserRole;
  prodAuthenticated: boolean;
  prodProfileStatus: 'idle' | 'loading' | 'loaded' | 'not_found' | 'error';
  isSupabaseConfigured: boolean;
}

export interface RoutePermissionResult {
  allowed: boolean;
  reason?:
    | 'VERIFYING_SESSION'
    | 'AUTH_REQUIRED'
    | 'PROFILE_ERROR'
    | 'ADMIN_PRODUCTION_ONLY'
    | 'DEMO_STUDENT_FORBIDDEN_TEACHER_ROUTE'
    | 'STUDENT_FORBIDDEN'
    | 'ADMIN_ONLY';
}

export const CLEAN_PATH_BY_VIEW: Record<string, string> = {
  dashboard: '/',
  public_explore: '/explore',
  khkt_showcase: '/khkt',
  khkt_presentation: '/khkt/presentation',
  login_portal: '/login',
};

export const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  PUBLIC_GUEST: 'Khách trải nghiệm (Demo)',
  DEMO_TEACHER: 'Giáo viên Demo (50 HS)',
  DEMO_STUDENT: 'Học sinh Demo',
  KHKT_SHOWCASE: 'Trình diễn KHKT 2027',
  PRODUCTION_USER: 'Tài khoản Chính thức',
};

/**
 * Pure URL parser supporting clean paths (/explore, /khkt, /khkt/presentation, /login),
 * legacy paths (/admin, /teacher/classes, ...), query (?view=...), and hashes.
 * Preserves `?view=teacher_student_call` 100%.
 */
export function resolveRouteFromLocation(
  pathnameRaw: string,
  searchRaw: string,
  hashRaw: string
): ResolvedRouteState {
  try {
    const cleanPath = (pathnameRaw || '/').replace(/\/+$/, '').toLowerCase() || '/';
    const params = new URLSearchParams(searchRaw || '');
    const qView = params.get('view')?.trim();

    if (qView) {
      if (qView === 'explore' || qView === 'public_explore') {
        return { view: 'public_explore', suggestedAccessMode: 'PUBLIC_GUEST' };
      }
      if (qView === 'khkt' || qView === 'khkt_showcase') {
        return { view: 'khkt_showcase', suggestedAccessMode: 'KHKT_SHOWCASE' };
      }
      if (qView === 'khkt_presentation') {
        return { view: 'khkt_presentation', suggestedAccessMode: 'KHKT_SHOWCASE' };
      }
      if (qView === 'login' || qView === 'login_portal') {
        return { view: 'login_portal' };
      }
      return { view: qView };
    }

    if (cleanPath === '/explore') {
      return { view: 'public_explore', suggestedAccessMode: 'PUBLIC_GUEST' };
    }
    if (cleanPath === '/khkt') {
      return { view: 'khkt_showcase', suggestedAccessMode: 'KHKT_SHOWCASE' };
    }
    if (cleanPath === '/khkt/presentation') {
      return { view: 'khkt_presentation', suggestedAccessMode: 'KHKT_SHOWCASE' };
    }
    if (cleanPath === '/login') {
      return { view: 'login_portal' };
    }

    if (cleanPath === '/admin' || cleanPath === '/admin/accounts') {
      return { view: 'admin_accounts', suggestedAccessMode: 'PRODUCTION_USER' };
    }
    if (cleanPath === '/admin/approval') {
      return { view: 'admin_approval', suggestedAccessMode: 'PRODUCTION_USER' };
    }
    if (cleanPath === '/admin/settings') {
      return { view: 'admin_settings', suggestedAccessMode: 'PRODUCTION_USER' };
    }
    if (cleanPath === '/teacher/classes') {
      return { view: 'teacher_classes' };
    }
    if (cleanPath === '/teacher/create-exam') {
      return { view: 'teacher_create_exam' };
    }
    if (cleanPath === '/student/assignments') {
      return { view: 'student_assignments' };
    }

    const cleanHash = (hashRaw || '').replace(/^#\/?/, '').trim();
    if (
      cleanHash &&
      !cleanHash.includes('access_token=') &&
      !cleanHash.includes('refresh_token=') &&
      !cleanHash.includes('type=')
    ) {
      return { view: cleanHash };
    }
  } catch {
    // fallback safely
  }

  return { view: 'dashboard' };
}

/**
 * Builds clean URL pathname + query string when switching views without breaking OAuth/recovery hash fragments.
 */
export function buildNavigationUrlForView(view: string, currentUrlHref: string): string {
  const url = new URL(currentUrlHref);
  const cleanTargetPath = CLEAN_PATH_BY_VIEW[view];

  if (cleanTargetPath) {
    url.pathname = cleanTargetPath;
    url.searchParams.delete('view');
    return `${url.pathname}${url.search}${url.hash}`;
  }

  // For sub-views (including ?view=teacher_student_call, math_lab, dashboard, etc.),
  // keep root pathname and sync ?view=... cleanly so direct reload works seamlessly.
  url.pathname = '/';
  if (view === 'dashboard') {
    url.searchParams.set('view', 'dashboard');
  } else {
    url.searchParams.set('view', view);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Pure RBAC + Sandbox isolation evaluator.
 * - Real admin_* routes NEVER open in PUBLIC_GUEST, DEMO_TEACHER, DEMO_STUDENT, or KHKT_SHOWCASE.
 * - Production teacher_* routes require verified Supabase teacher/admin role.
 * - In DEMO_TEACHER, teacher_* routes open ONLY against isolated Demo Sandbox data.
 */
export function checkViewAccessPermission(input: RoutePermissionInput): RoutePermissionResult {
  const {
    view,
    accessMode,
    prodRole,
    prodAuthenticated,
    prodProfileStatus,
    isSupabaseConfigured,
  } = input;

  const isPublicOpenRoute =
    view === 'public_explore' ||
    view === 'khkt_showcase' ||
    view === 'khkt_presentation' ||
    view === 'login_portal' ||
    view === 'dashboard' ||
    view === 'teacher_student_call' ||
    view === 'math_lab' ||
    view.startsWith('student_');

  const isTeacherRoute = view.startsWith('teacher_') && view !== 'teacher_student_call';
  const isAdminRoute = view.startsWith('admin_');
  const isAdminOnlyRoute =
    view === 'admin_accounts' || view === 'admin_settings' || view === 'admin_curriculum';

  // Admin routes are ALWAYS strictly isolated from Demo/Guest/Showcase and require Production verified Admin/Reviewer
  if (isAdminRoute) {
    if (accessMode !== 'PRODUCTION_USER') {
      return { allowed: false, reason: 'ADMIN_PRODUCTION_ONLY' };
    }
    if (isSupabaseConfigured && (prodProfileStatus === 'loading' || (!prodAuthenticated && prodProfileStatus === 'idle'))) {
      return { allowed: false, reason: 'AUTH_REQUIRED' };
    }
    if (isSupabaseConfigured && !prodAuthenticated) {
      return { allowed: false, reason: 'AUTH_REQUIRED' };
    }
    if (prodAuthenticated && prodProfileStatus === 'error') {
      return { allowed: false, reason: 'PROFILE_ERROR' };
    }
    if (prodRole === 'student') {
      return { allowed: false, reason: 'STUDENT_FORBIDDEN' };
    }
    if (prodRole === 'teacher') {
      return { allowed: false, reason: 'ADMIN_ONLY' };
    }
    if (prodRole === 'reviewer' && isAdminOnlyRoute) {
      return { allowed: false, reason: 'ADMIN_ONLY' };
    }
    return { allowed: true };
  }

  if (isPublicOpenRoute) {
    return { allowed: true };
  }

  if (isTeacherRoute) {
    if (accessMode === 'DEMO_TEACHER') {
      return { allowed: true };
    }
    if (accessMode === 'DEMO_STUDENT' || accessMode === 'PUBLIC_GUEST' || accessMode === 'KHKT_SHOWCASE') {
      return { allowed: false, reason: 'DEMO_STUDENT_FORBIDDEN_TEACHER_ROUTE' };
    }

    // PRODUCTION_USER
    if (isSupabaseConfigured && !prodAuthenticated) {
      return { allowed: false, reason: 'AUTH_REQUIRED' };
    }
    if (prodAuthenticated && prodProfileStatus === 'error') {
      return { allowed: false, reason: 'PROFILE_ERROR' };
    }
    if (prodRole === 'student') {
      return { allowed: false, reason: 'STUDENT_FORBIDDEN' };
    }
    return { allowed: true };
  }

  return { allowed: true };
}
