import express, { type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateStudentByCode } from './adminAccountsService.ts';
import {
  createDefaultSupabaseAdminClient,
  resolveServerSupabaseAnonKey,
  resolveServerSupabaseUrl
} from './createAdminRouter.ts';

export interface AuthRouterOptions {
  getSupabaseAdmin?: () => any;
  createAnonAuthClient?: () => any;
}

export function createAuthRouter(options: AuthRouterOptions = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  router.post('/student-login', async (req: Request, res: Response) => {
    const studentCode = String(req.body?.studentCode || req.body?.identifier || '').trim();
    const password = String(req.body?.password || '');

    const supabaseUrl = resolveServerSupabaseUrl();
    const supabaseAnonKey = resolveServerSupabaseAnonKey();

    const adminClient = options.getSupabaseAdmin
      ? options.getSupabaseAdmin()
      : createDefaultSupabaseAdminClient();

    const createAnonClient =
      options.createAnonAuthClient ||
      (() => {
        if (!supabaseUrl || !supabaseAnonKey) return null;
        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
      });

    // If no service role client is configured, use an ephemeral anon client for public.profiles lookup if RLS allows
    const lookupClient = adminClient || createAnonClient();

    const result = await authenticateStudentByCode(studentCode, password, {
      supabaseLookupClient: lookupClient,
      createAnonAuthClient: createAnonClient
    });

    if (!result.ok || !result.data) {
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
