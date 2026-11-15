import express, { type Request, type Response, type NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL
} from '../src/lib/supabase.ts';
import {
  assignUserToClass,
  createClassByAdmin,
  updateClassByAdmin,
  deleteClassByAdmin,
  createClassRoleByAdmin,
  createOrInviteAccount,
  createTeachingAssignmentsBatch,
  endClassRoleByAdmin,
  endTeachingAssignment,
  getCutoverReadinessReport,
  listAdminWorkspace,
  resendInviteEmail,
  resetStudentPasswordByAdmin,
  runStudentClassImport,
  runTeacherImport,
  runTeachingAssignmentImport,
  unassignUserFromClass,
  updateTeachingAssignment,
  updateUserRoleByAdmin,
  verifyAdminCaller,
  type AdminCaller
} from './adminAccountsService.ts';

export interface AdminRouterOptions {
  getSupabaseAdmin?: () => any;
}

export function resolveServerSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  ).trim();
}

export function resolveServerSupabaseAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  ).trim();
}

/**
 * Creates a server-only Supabase client with SUPABASE_SERVICE_ROLE_KEY when configured.
 * NEVER reads service role key from VITE_* variables so it can never leak into frontend bundles.
 */
export function createDefaultSupabaseAdminClient() {
  const url = resolveServerSupabaseUrl();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !serviceRoleKey || serviceRoleKey === 'your-supabase-service-role-key') {
    return null;
  }

  const client: any = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  client.__isServiceRoleClient = true;
  return client;
}

/**
 * Resolves the best server-side Supabase client for the current request:
 * 1. Uses Service Role client if SUPABASE_SERVICE_ROLE_KEY is configured on the server.
 * 2. Otherwise creates a request-scoped authenticated client using the publishable/anon key
 *    and the caller's Bearer JWT token so Postgres RLS policies (public.is_admin_role() /
 *    public.is_staff_role()) authorize verified Admin/Teacher operations safely.
 */
export function resolveRequestSupabaseClient(
  authHeader?: string | null,
  customGetAdmin?: () => any
) {
  if (customGetAdmin) {
    const injected = customGetAdmin();
    if (injected) return injected;
  } else {
    const serviceClient = createDefaultSupabaseAdminClient();
    if (serviceClient) return serviceClient;
  }

  const url = resolveServerSupabaseUrl();
  const anonKey = resolveServerSupabaseAnonKey();
  if (!url || !anonKey) {
    return null;
  }

  const cleanBearer =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.trim() : undefined;

  const client: any = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: cleanBearer
      ? {
          headers: {
            Authorization: cleanBearer
          }
        }
      : undefined
  });
  client.__isServiceRoleClient = false;
  return client;
}

function resolvePublicAppRedirectUrl(req: Request): string | undefined {
  const configured = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('http')) {
    return origin.replace(/\/+$/, '');
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return undefined;
}

export function createAdminRouter(options: AdminRouterOptions = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '5mb' }));

  const requireVerifiedAdmin = async (
    req: Request & { adminCaller?: AdminCaller; supabaseAdminClient?: any },
    res: Response,
    next: NextFunction
  ) => {
    const adminClient = resolveRequestSupabaseClient(
      req.headers.authorization,
      options.getSupabaseAdmin
    );
    if (!adminClient) {
      return res.status(503).json({
        ok: false,
        code: 'MISSING_SUPABASE_CONFIG',
        message:
          'Máy chủ chưa cấu hình kết nối Supabase (SUPABASE_URL / SUPABASE_ANON_KEY hoặc SUPABASE_SERVICE_ROLE_KEY).'
      });
    }

    try {
      const verifyResult = await verifyAdminCaller(adminClient, req.headers.authorization);
      if (!verifyResult.ok || !verifyResult.caller) {
        return res.status(verifyResult.status).json({
          ok: false,
          code: verifyResult.code,
          message: verifyResult.message
        });
      }

      req.adminCaller = verifyResult.caller;
      req.supabaseAdminClient = adminClient;
      next();
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        code: 'ADMIN_AUTH_MIDDLEWARE_ERROR',
        message: err?.message || 'Lỗi không xác định khi kiểm tra quyền Quản trị viên.'
      });
    }
  };

  router.use(requireVerifiedAdmin);

  // 0. Diagnostics & Connection Status
  router.get('/connection-status', async (req: any, res: Response) => {
    const serviceRoleConfigured = Boolean(
      req.supabaseAdminClient?.__isServiceRoleClient !== false &&
        (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    );
    return res.status(200).json({
      ok: true,
      caller: req.adminCaller,
      supabaseUrlConfigured: Boolean(resolveServerSupabaseUrl()),
      serviceRoleConfigured,
      publicAppUrlConfigured: Boolean((process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim()),
      effectiveRedirectUrl: resolvePublicAppRedirectUrl(req) || null,
      clientMode: req.supabaseAdminClient?.__isServiceRoleClient === false ? 'authenticated_rls' : 'service_role'
    });
  });

  // 1. Load full Admin Workspace (Accounts + Classes + Teaching Assignments + Class Roles + Cutover + Audit Logs)
  router.get('/users', async (req: any, res: Response) => {
    const result = await listAdminWorkspace(req.supabaseAdminClient);
    if (!result.ok || !result.data) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      caller: req.adminCaller,
      ...result.data
    });
  });

  // 1b. Cutover Readiness Report (before enabling Migration 05)
  router.get('/cutover-readiness', async (req: any, res: Response) => {
    const result = await getCutoverReadinessReport(req.supabaseAdminClient);
    if (!result.ok || !result.data) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      caller: req.adminCaller,
      report: result.data
    });
  });

  // 2. Create a single account & send invite email (or reuse existing student when enrolling into a class)
  router.post('/users', async (req: any, res: Response) => {
    const redirectTo = resolvePublicAppRedirectUrl(req);
    const result = await createOrInviteAccount(
      req.supabaseAdminClient,
      {
        fullName: req.body?.fullName,
        email: req.body?.email,
        role: req.body?.role,
        studentCode: req.body?.studentCode,
        teacherCode: req.body?.teacherCode,
        grade: req.body?.grade,
        subject: req.body?.subject,
        classId: req.body?.classId,
        replaceExistingClassTeacher: req.body?.replaceExistingClassTeacher
      },
      req.adminCaller,
      redirectTo
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message,
        ...(result.data || {})
      });
    }

    return res.status(result.status).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 3. Update role in public.profiles
  router.patch('/users/:id/role', async (req: any, res: Response) => {
    const result = await updateUserRoleByAdmin(
      req.supabaseAdminClient,
      req.params.id,
      req.body?.role,
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 4. Assign student or teacher to class
  router.post('/users/:id/assign-class', async (req: any, res: Response) => {
    const result = await assignUserToClass(
      req.supabaseAdminClient,
      req.params.id,
      req.body?.classId,
      {
        replaceExistingTeacher: Boolean(req.body?.replaceExistingTeacher),
        subject: req.body?.subject
      },
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message,
        ...(result.data || {})
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 5. Remove student from a specific class
  router.delete('/users/:id/classes/:classId', async (req: any, res: Response) => {
    const result = await unassignUserFromClass(
      req.supabaseAdminClient,
      req.params.id,
      req.params.classId,
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 6. Resend invite email
  router.post('/users/:id/resend-invite', async (req: any, res: Response) => {
    const redirectTo = resolvePublicAppRedirectUrl(req);
    const result = await resendInviteEmail(
      req.supabaseAdminClient,
      req.params.id,
      req.adminCaller,
      redirectTo
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 6b. Reset student password by Admin (generates a one-time initial password and sets must_change_password = true)
  router.post('/users/:id/reset-student-password', async (req: any, res: Response) => {
    const result = await resetStudentPasswordByAdmin(
      req.supabaseAdminClient,
      req.params.id,
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 7. Create a new class
  router.post('/classes', async (req: any, res: Response) => {
    const result = await createClassByAdmin(
      req.supabaseAdminClient,
      {
        name: req.body?.name,
        grade: req.body?.grade,
        schoolYear: req.body?.schoolYear,
        classCode: req.body?.classCode
      },
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(201).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 7b. Update an existing class
  router.patch('/classes/:id', async (req: any, res: Response) => {
    const result = await updateClassByAdmin(
      req.supabaseAdminClient,
      req.params.id,
      {
        name: req.body?.name,
        grade: req.body?.grade,
        schoolYear: req.body?.schoolYear,
        classCode: req.body?.classCode
      },
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 7c. Delete a class (protects classes with student exam submissions)
  router.delete('/classes/:id', async (req: any, res: Response) => {
    const result = await deleteClassByAdmin(
      req.supabaseAdminClient,
      req.params.id,
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 8. Create teaching assignments (1 Teacher + 1 Subject + Multiple Classes in School Year)
  router.post('/teaching-assignments', async (req: any, res: Response) => {
    const result = await createTeachingAssignmentsBatch(
      req.supabaseAdminClient,
      {
        schoolYear: req.body?.schoolYear,
        teacherId: req.body?.teacherId,
        subject: req.body?.subject,
        classIds: req.body?.classIds,
        notes: req.body?.notes
      },
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(result.status).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 9. Update teaching assignment (e.g., complete missing subject or change subject/class)
  router.patch('/teaching-assignments/:id', async (req: any, res: Response) => {
    const result = await updateTeachingAssignment(
      req.supabaseAdminClient,
      req.params.id,
      {
        schoolYear: req.body?.schoolYear,
        classId: req.body?.classId,
        subject: req.body?.subject,
        notes: req.body?.notes
      },
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 10. End teaching assignment (status = 'ended', preserves historical records)
  router.post('/teaching-assignments/:id/end', async (req: any, res: Response) => {
    const result = await endTeachingAssignment(
      req.supabaseAdminClient,
      req.params.id,
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 10b. Grant explicit Class Manager / Homeroom role (separate from subject teaching)
  router.post('/class-roles', async (req: any, res: Response) => {
    const result = await createClassRoleByAdmin(
      req.supabaseAdminClient,
      {
        schoolYear: req.body?.schoolYear,
        classId: req.body?.classId,
        teacherId: req.body?.teacherId,
        roleType: req.body?.roleType,
        notes: req.body?.notes
      },
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(result.status).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 10c. End Class Manager / Homeroom role
  router.post('/class-roles/:id/end', async (req: any, res: Response) => {
    const result = await endClassRoleByAdmin(
      req.supabaseAdminClient,
      req.params.id,
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  // 11. Excel Import 1: Students into a specific Class (Preview & Confirm)
  router.post('/import/students/preview', async (req: any, res: Response) => {
    const redirectTo = resolvePublicAppRedirectUrl(req);
    const result = await runStudentClassImport(
      req.supabaseAdminClient,
      req.body?.classId,
      req.body?.rows,
      req.adminCaller,
      redirectTo,
      true
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  router.post('/import/students/confirm', async (req: any, res: Response) => {
    const redirectTo = resolvePublicAppRedirectUrl(req);
    const result = await runStudentClassImport(
      req.supabaseAdminClient,
      req.body?.classId,
      req.body?.rows,
      req.adminCaller,
      redirectTo,
      false
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  // 12. Excel Import 2: Teachers list (Preview & Confirm)
  router.post('/import/teachers/preview', async (req: any, res: Response) => {
    const redirectTo = resolvePublicAppRedirectUrl(req);
    const result = await runTeacherImport(
      req.supabaseAdminClient,
      req.body?.rows,
      req.adminCaller,
      redirectTo,
      true
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  router.post('/import/teachers/confirm', async (req: any, res: Response) => {
    const redirectTo = resolvePublicAppRedirectUrl(req);
    const result = await runTeacherImport(
      req.supabaseAdminClient,
      req.body?.rows,
      req.adminCaller,
      redirectTo,
      false
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  // 13. Excel Import 3: Teaching Assignments (Preview & Confirm)
  router.post('/import/assignments/preview', async (req: any, res: Response) => {
    const result = await runTeachingAssignmentImport(
      req.supabaseAdminClient,
      req.body?.rows,
      req.adminCaller,
      true
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  router.post('/import/assignments/confirm', async (req: any, res: Response) => {
    const result = await runTeachingAssignmentImport(
      req.supabaseAdminClient,
      req.body?.rows,
      req.adminCaller,
      false
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  return router;
}
