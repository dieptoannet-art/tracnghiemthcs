import { createClient } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';

// Read Supabase environment variables
// Supports modern publishable key and standard anon key
const envUrl = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  ''
).trim();

const envKey = (
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
  ''
).trim();

// Check if valid URL and Key are provided
export const isSupabaseConfigured = Boolean(
  envUrl &&
  envKey &&
  envUrl.startsWith('http') &&
  !envUrl.includes('your-project-id') &&
  !envKey.includes('...')
);

export const SUPABASE_URL = envUrl;
export const SUPABASE_ANON_KEY = envKey;

// Create Supabase client instance (or a dummy client if unconfigured to avoid crash)
export const supabase = createClient(
  isSupabaseConfigured ? envUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? envKey : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Test connectivity to the Supabase endpoint and distinguish Auth vs Database verification
 */
/**
 * Test connectivity to the Supabase endpoint and distinguish Auth service reachability vs User Auth verification
 * CRITICAL: Only verifies Auth when there is genuine proof of authentication (active user session).
 * Never prints secret keys or tokens.
 */
export async function testSupabaseConnection(customUrl?: string, customKey?: string): Promise<{
  success: boolean;
  message: string;
  statusCode?: number;
  authServiceAvailable?: boolean;
  authVerified?: boolean;
  dbVerified?: boolean;
}> {
  const targetUrl = customUrl?.trim() || envUrl;
  const targetKey = customKey?.trim() || envKey;

  const isTargetValid = Boolean(
    targetUrl &&
    targetKey &&
    targetUrl.startsWith('http') &&
    !targetUrl.includes('your-project-id') &&
    !targetKey.includes('...')
  );

  if (!isTargetValid) {
    return {
      success: false,
      message: 'Chưa cấu hình Supabase URL hoặc Publishable Key hợp lệ.',
      authServiceAvailable: false,
      authVerified: false,
      dbVerified: false
    };
  }

  let dbOk = false;
  let authServiceOk = false;
  let errors: string[] = [];

  // 1. Kiểm tra Cơ sở dữ liệu (REST API / CSDL)
  try {
    const pingUrl = `${targetUrl.replace(/\/$/, '')}/rest/v1/`;
    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`,
      },
    });

    // 200: Open API spec / REST endpoint trả về thành công
    // 401 hoặc 404: Endpoint máy chủ phản hồi mã chuẩn Supabase
    if (res.ok || res.status === 200 || res.status === 401 || res.status === 404) {
      dbOk = true;
    } else {
      errors.push(`CSDL phản hồi mã: ${res.status}`);
    }
  } catch (err: any) {
    errors.push(`Lỗi kết nối CSDL: ${err?.message || 'Mạng/CORS'}`);
  }

  // 2. Kiểm tra Dịch vụ Xác thực Auth (Endpoint reachability)
  try {
    const authPingUrl = `${targetUrl.replace(/\/$/, '')}/auth/v1/settings`;
    const authRes = await fetch(authPingUrl, {
      method: 'GET',
      headers: {
        apikey: targetKey,
      },
    });

    if (authRes.ok || authRes.status === 200) {
      authServiceOk = true;
    } else {
      errors.push(`Dịch vụ Auth phản hồi mã: ${authRes.status}`);
    }
  } catch (err: any) {
    errors.push(`Lỗi kết nối dịch vụ Auth: ${err?.message || 'Mạng/CORS'}`);
  }

  // 3. Kiểm tra bằng chứng xác thực thành công (Active User Session)
  // Chỉ xác nhận Auth khi có bằng chứng phiên người dùng đăng nhập hợp lệ thực tế!
  let userAuthProof = false;
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (!sessionErr && sessionData?.session?.user) {
      userAuthProof = true;
    }
  } catch {
    userAuthProof = false;
  }

  if (dbOk && userAuthProof) {
    return {
      success: true,
      message: 'Đã xác minh thành công cả Phiên đăng nhập (Auth) và Cơ sở dữ liệu (CSDL)!',
      authServiceAvailable: true,
      authVerified: true,
      dbVerified: true,
      statusCode: 200
    };
  } else if (userAuthProof) {
    return {
      success: true,
      message: 'Đã xác minh thành công Phiên đăng nhập (Auth).',
      authServiceAvailable: true,
      authVerified: true,
      dbVerified: false,
      statusCode: 200
    };
  } else if (dbOk) {
    return {
      success: true,
      message: authServiceOk
        ? 'Máy chủ Supabase và dịch vụ Auth phản hồi tốt. Chưa có tài khoản đăng nhập để xác thực Auth.'
        : 'Đã kết nối thành công Cơ sở dữ liệu (CSDL).',
      authServiceAvailable: authServiceOk,
      authVerified: false,
      dbVerified: true,
      statusCode: 200
    };
  } else {
    return {
      success: false,
      message: errors.join('; ') || 'Không thể kết nối đến máy chủ Supabase.',
      authServiceAvailable: authServiceOk,
      authVerified: false,
      dbVerified: false
    };
  }
}

/**
 * Fetch profile from public.profiles table by user ID
 * Handles schema cache missing table and network fetch errors gracefully.
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      const msg = error.message || '';
      const isMissingTable =
        msg.includes("Could not find the table 'public.profiles'") ||
        msg.includes('schema cache') ||
        error.code === 'PGRST204' ||
        error.code === 'PGRST205' ||
        error.code === '42P01';

      if (isMissingTable) {
        console.warn('Bảng profiles chưa có trong schema cache Supabase. Hệ thống sử dụng hồ sơ mặc định an toàn.');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || error.code === 'FetchError') {
        console.warn('Không thể kết nối mạng tới Supabase khi nạp hồ sơ. Hệ thống dùng hồ sơ mặc định.');
      } else {
        console.warn('Thông báo khi tải hồ sơ Supabase:', msg);
      }
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name || 'Người dùng',
      role: (data.role as UserRole) || 'student',
      grade: data.grade,
      studentCode: data.student_code,
      schoolName: data.school_name || 'Trường THCS Tây Đô',
      subject: data.subject,
      createdAt: data.created_at,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
      console.warn('Không thể kết nối mạng tới Supabase khi tải hồ sơ (ngoại lệ mạng).');
    } else {
      console.warn('Ngoại lệ khi tải hồ sơ:', errMsg);
    }
    return null;
  }
}
