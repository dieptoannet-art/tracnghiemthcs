import express, { type Request, type Response, type NextFunction } from 'express';
import { createDefaultSupabaseAdminClient } from './createAdminRouter.ts';
import {
  getTeacherScopePayload,
  gradeSubmissionWithScopeCheck,
  publishAssignmentWithScopeCheck,
  verifyStaffCaller,
  type StaffCaller
} from './teacherScopeService.ts';

export interface TeacherRouterOptions {
  getSupabaseAdmin?: () => any;
}

export function createTeacherRouter(options: TeacherRouterOptions = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  const getAdminClient = options.getSupabaseAdmin || createDefaultSupabaseAdminClient;

  const requireVerifiedStaff = async (
    req: Request & { staffCaller?: StaffCaller; supabaseAdminClient?: any },
    res: Response,
    next: NextFunction
  ) => {
    const adminClient = getAdminClient();
    if (!adminClient) {
      return res.status(503).json({
        ok: false,
        code: 'MISSING_SERVICE_ROLE_KEY',
        message: 'Máy chủ chưa cấu hình SUPABASE_SERVICE_ROLE_KEY.'
      });
    }

    try {
      const verifyRes = await verifyStaffCaller(adminClient, req.headers.authorization);
      if (!verifyRes.ok || !verifyRes.caller) {
        return res.status(verifyRes.status).json({
          ok: false,
          code: verifyRes.code,
          message: verifyRes.message
        });
      }
      req.staffCaller = verifyRes.caller;
      req.supabaseAdminClient = adminClient;
      next();
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        code: 'STAFF_AUTH_MIDDLEWARE_ERROR',
        message: err?.message || 'Lỗi xác thực quyền giáo viên trên máy chủ.'
      });
    }
  };

  router.use(requireVerifiedStaff);

  router.get('/scope', async (req: any, res: Response) => {
    const result = await getTeacherScopePayload(req.supabaseAdminClient, req.staffCaller);
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

  router.post('/assignments', async (req: any, res: Response) => {
    const result = await publishAssignmentWithScopeCheck(
      req.supabaseAdminClient,
      req.staffCaller,
      req.body || {}
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
      ...result.data
    });
  });

  router.patch('/submissions/:id/grade', async (req: any, res: Response) => {
    const result = await gradeSubmissionWithScopeCheck(
      req.supabaseAdminClient,
      req.staffCaller,
      req.params.id,
      req.body || {}
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

  return router;
}
