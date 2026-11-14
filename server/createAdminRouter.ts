import express, { type Request, type Response, type NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  assignUserToClass,
  createClassByAdmin,
  createClassRoleByAdmin,
  createOrInviteAccount,
  createTeachingAssignmentsBatch,
  endClassRoleByAdmin,
  endTeachingAssignment,
  getCutoverReadinessReport,
  listAdminWorkspace,
  resendInviteEmail,
  runStudentClassImport,
  runTeacherImport,
  runTeachingAssignmentImport,
  unassignUserFromClass,
  updateTeachingAssignment,
  updateUserRoleByAdmin,
  verifyAdminCaller,
  type AdminCaller
} from './adminAccountsService.ts';

const FALLBACK_PUBLIC_SUPABASE_URL = 'https://hhtwbmzqjpbbhqoqpsse.supabase.co';

export function resolveServerSupabaseEnv() {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    FALLBACK_PUBLIC_SUPABASE_URL
  ).trim();

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const publicAppUrl = (process.env.PUBLIC_APP_URL || '').trim();

  return {
    supabaseUrl,
    serviceRoleKey,
    publicAppUrl,
    isServiceRoleConfigured: Boolean(supabaseUrl && serviceRoleKey)
  };
}

export function createDefaultSupabaseAdminClient() {
  const env = resolveServerSupabaseEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return null;
  }
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function resolveRedirectUrl(req: Request, configuredAppUrl?: string): string | undefined {
  if (configuredAppUrl) return configuredAppUrl;
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('http')) {
    return origin;
  }
  const host = req.get('host');
  if (host) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    return `${proto}://${host}`;
  }
  return undefined;
}

export interface AdminRouterOptions {
  getSupabaseAdmin?: () => any;
}

export function createAdminRouter(options: AdminRouterOptions = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '5mb' }));

  const getAdminClient = options.getSupabaseAdmin || createDefaultSupabaseAdminClient;

  // Health/config diagnostic (never exposes secret values; only boolean status)
  router.get('/status', (_req: Request, res: Response) => {
    const env = resolveServerSupabaseEnv();
    const injectedAvailable = Boolean(options.getSupabaseAdmin && options.getSupabaseAdmin());
    res.json({
      ok: true,
      serviceRoleConfigured: env.isServiceRoleConfigured || injectedAvailable,
      missingEnvVars: env.isServiceRoleConfigured || injectedAvailable ? [] : ['SUPABASE_SERVICE_ROLE_KEY']
    });
  });

  // Require verified Supabase JWT + DB profiles.role === 'admin' on ALL routes below
  const requireVerifiedAdmin = async (
    req: Request & { adminCaller?: AdminCaller; supabaseAdminClient?: any },
    res: Response,
    next: NextFunction
  ) => {
    const adminClient = getAdminClient();
    if (!adminClient) {
      return res.status(503).json({
        ok: false,
        code: 'MISSING_SERVICE_ROLE_KEY',
        message:
          'Máy chủ chưa cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY (chỉ cấu hình phía server, không dùng tiền tố VITE_). Chức năng tạo/mời tài khoản và nhập Excel cần Service Role Key ở server.'
      });
    }

    try {
      const verifyRes = await verifyAdminCaller(adminClient, req.headers.authorization);
      if (!verifyRes.ok || !verifyRes.caller) {
        return res.status(verifyRes.status).json({
          ok: false,
          code: verifyRes.code,
          message: verifyRes.message
        });
      }
      req.adminCaller = verifyRes.caller;
      req.supabaseAdminClient = adminClient;
      next();
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        code: 'AUTH_MIDDLEWARE_ERROR',
        message: err?.message || 'Lỗi xác thực quyền Quản trị viên trên máy chủ.'
      });
    }
  };

  router.use(requireVerifiedAdmin);

  router.get('/users', async (req: any, res: Response) => {
    const result = await listAdminWorkspace(req.supabaseAdminClient);
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }
    return res.status(200).json({
      ok: true,
      ...result.data
    });
  });

  router.post('/users', async (req: any, res: Response) => {
    const env = resolveServerSupabaseEnv();
    const redirectTo = resolveRedirectUrl(req, env.publicAppUrl);
    const result = await createOrInviteAccount(
      req.supabaseAdminClient,
      req.body || {},
      req.adminCaller,
      redirectTo
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message,
        ...(result.data ? result.data : {})
      });
    }

    return res.status(result.status).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

  router.post('/users/:id/assign-class', async (req: any, res: Response) => {
    const { classId, replaceExistingTeacher, subject } = req.body || {};
    const result = await assignUserToClass(
      req.supabaseAdminClient,
      req.params.id,
      String(classId || ''),
      {
        replaceExistingTeacher: Boolean(replaceExistingTeacher),
        subject: subject ? String(subject) : undefined
      },
      req.adminCaller
    );

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message,
        ...(result.data ? result.data : {})
      });
    }

    return res.status(200).json({
      ok: true,
      message: result.message,
      ...result.data
    });
  });

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

  router.post('/users/:id/resend-invite', async (req: any, res: Response) => {
    const env = resolveServerSupabaseEnv();
    const redirectTo = resolveRedirectUrl(req, env.publicAppUrl);
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

  // Classes creation (Admin only)
  router.post('/classes', async (req: any, res: Response) => {
    const result = await createClassByAdmin(
      req.supabaseAdminClient,
      req.body || {},
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

  // Teaching assignments (Năm học - Giáo viên - Môn - Lớp)
  router.post('/teaching-assignments', async (req: any, res: Response) => {
    const result = await createTeachingAssignmentsBatch(
      req.supabaseAdminClient,
      req.body || {},
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

  router.patch('/teaching-assignments/:id', async (req: any, res: Response) => {
    const result = await updateTeachingAssignment(
      req.supabaseAdminClient,
      req.params.id,
      req.body || {},
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

  // Cutover readiness ("Thiếu môn" & lớp bị ảnh hưởng trước khi bật Bước 5)
  router.get('/cutover-readiness', async (req: any, res: Response) => {
    const result = await getCutoverReadinessReport(req.supabaseAdminClient);
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }
    return res.status(200).json({
      ok: true,
      readiness: result.data
    });
  });

  // Explicit Class Roles (homeroom / class_manager)
  router.post('/class-roles', async (req: any, res: Response) => {
    const result = await createClassRoleByAdmin(
      req.supabaseAdminClient,
      req.body || {},
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

  // Excel Two-Phase Import Endpoints (preview & confirm)
  router.post('/import/students/preview', async (req: any, res: Response) => {
    const { classId, rows } = req.body || {};
    const result = await runStudentClassImport(
      req.supabaseAdminClient,
      String(classId || ''),
      rows || [],
      req.adminCaller,
      undefined,
      true
    );
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, code: result.code, message: result.message });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  router.post('/import/students/confirm', async (req: any, res: Response) => {
    const env = resolveServerSupabaseEnv();
    const redirectTo = resolveRedirectUrl(req, env.publicAppUrl);
    const { classId, rows } = req.body || {};
    const result = await runStudentClassImport(
      req.supabaseAdminClient,
      String(classId || ''),
      rows || [],
      req.adminCaller,
      redirectTo,
      false
    );
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, code: result.code, message: result.message });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  router.post('/import/teachers/preview', async (req: any, res: Response) => {
    const { rows } = req.body || {};
    const result = await runTeacherImport(
      req.supabaseAdminClient,
      rows || [],
      req.adminCaller,
      undefined,
      true
    );
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, code: result.code, message: result.message });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  router.post('/import/teachers/confirm', async (req: any, res: Response) => {
    const env = resolveServerSupabaseEnv();
    const redirectTo = resolveRedirectUrl(req, env.publicAppUrl);
    const { rows } = req.body || {};
    const result = await runTeacherImport(
      req.supabaseAdminClient,
      rows || [],
      req.adminCaller,
      redirectTo,
      false
    );
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, code: result.code, message: result.message });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  router.post('/import/assignments/preview', async (req: any, res: Response) => {
    const { rows } = req.body || {};
    const result = await runTeachingAssignmentImport(
      req.supabaseAdminClient,
      rows || [],
      req.adminCaller,
      true
    );
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, code: result.code, message: result.message });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  router.post('/import/assignments/confirm', async (req: any, res: Response) => {
    const { rows } = req.body || {};
    const result = await runTeachingAssignmentImport(
      req.supabaseAdminClient,
      rows || [],
      req.adminCaller,
      false
    );
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, code: result.code, message: result.message });
    }
    return res.status(200).json({ ok: true, ...result.data });
  });

  return router;
}
