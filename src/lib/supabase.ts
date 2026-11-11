import { createClient } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';

// Default project credentials configured for THCS Tây Đô
export const DEFAULT_SUPABASE_URL = 'https://hhtwbmzqjpbbhqoqpsse.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XkHTL_jwWOBKiEGDtJ4-1g_MEaxSdGb';

export const normalizeSupabaseUrl = (url: string): string => {
  if (!url) return '';
  let cleaned = url.trim();
  // Tự động sửa lỗi gõ thiếu chữ 'p' trong mã dự án THCS Tây Đô (hqoqsse -> hqoqpsse)
  if (cleaned.includes('hhtwbmzqjpbbhqoqsse.supabase.co')) {
    cleaned = cleaned.replace('hhtwbmzqjpbbhqoqsse.supabase.co', 'hhtwbmzqjpbbhqoqpsse.supabase.co');
  }
  return cleaned;
};

// Read from localStorage (if user updated in guide modal), or Vite env, or fallback to default
const getStoredConfig = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem('taydo_supabase_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url && parsed.anonKey) {
          return { url: normalizeSupabaseUrl(parsed.url), key: parsed.anonKey.trim() };
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
};

const storedConfig = getStoredConfig();

const rawUrl = normalizeSupabaseUrl(
  storedConfig?.url ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL
);

const rawKey = (
  storedConfig?.key ||
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
  DEFAULT_SUPABASE_ANON_KEY
).trim();

export let SUPABASE_URL = rawUrl;
export let SUPABASE_ANON_KEY = rawKey;

// Check if valid URL and Key are provided
export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith('http') &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_ANON_KEY.includes('...')
);

// Create Supabase client instance
export let supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Cập nhật cấu hình Supabase URL & Key ngay lập tức tại runtime
 */
export function updateSupabaseCredentials(newUrl: string, newKey: string) {
  const cleanUrl = normalizeSupabaseUrl(newUrl);
  const cleanKey = newKey.trim();

  SUPABASE_URL = cleanUrl;
  SUPABASE_ANON_KEY = cleanKey;

  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(
      'taydo_supabase_config',
      JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
    );
  }

  supabase = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabase;
}

/**
 * Đặt lại cấu hình Supabase về mặc định
 */
export function resetSupabaseCredentials() {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('taydo_supabase_config');
  }
  SUPABASE_URL = DEFAULT_SUPABASE_URL;
  SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;
  supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabase;
}

/**
 * Test connectivity to the Supabase endpoint and distinguish Auth vs Database verification
 */
export async function testSupabaseConnection(customUrl?: string, customKey?: string): Promise<{
  success: boolean;
  message: string;
  statusCode?: number;
  authServiceAvailable?: boolean;
  authVerified?: boolean;
  dbVerified?: boolean;
  isPausedOrDnsError?: boolean;
  helpGuidance?: string;
}> {
  const targetUrl = normalizeSupabaseUrl(customUrl || SUPABASE_URL);
  const targetKey = (customKey || SUPABASE_ANON_KEY).trim();

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
  let isNetworkOrDns = false;

  // 1. Kiểm tra Cơ sở dữ liệu (REST API / CSDL)
  try {
    const pingUrl = `${targetUrl.replace(/\/$/, '')}/rest/v1/`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`,
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // 200: Open API spec / REST endpoint trả về thành công
    // 401 hoặc 404: Endpoint máy chủ phản hồi mã chuẩn Supabase
    if (res.ok || res.status === 200 || res.status === 401 || res.status === 404) {
      dbOk = true;
    } else {
      errors.push(`CSDL phản hồi mã: ${res.status}`);
    }
  } catch (err: any) {
    const errMsg = err?.message || 'Mạng/CORS';
    if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || err?.name === 'AbortError') {
      isNetworkOrDns = true;
      errors.push('Không thể kết nối tới máy chủ (Failed to fetch / Timeout)');
    } else {
      errors.push(`Lỗi kết nối CSDL: ${errMsg}`);
    }
  }

  // 2. Kiểm tra Dịch vụ Xác thực Auth (Endpoint reachability)
  try {
    const authPingUrl = `${targetUrl.replace(/\/$/, '')}/auth/v1/settings`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const authRes = await fetch(authPingUrl, {
      method: 'GET',
      headers: {
        apikey: targetKey,
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (authRes.ok || authRes.status === 200) {
      authServiceOk = true;
    } else {
      errors.push(`Dịch vụ Auth phản hồi mã: ${authRes.status}`);
    }
  } catch (err: any) {
    const errMsg = err?.message || 'Mạng/CORS';
    if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || err?.name === 'AbortError') {
      isNetworkOrDns = true;
      errors.push('Dịch vụ Auth không phản hồi (Failed to fetch)');
    } else {
      errors.push(`Lỗi kết nối dịch vụ Auth: ${errMsg}`);
    }
  }

  // 3. Kiểm tra bằng chứng xác thực thành công (Active User Session)
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
    let guidance = '';
    if (isNetworkOrDns) {
      guidance = 'Dự án Supabase có thể đang ở trạng thái TẠM DỪNG (Paused) trên gói Free do lâu ngày không có request, hoặc mã Project URL chưa đúng. Vui lòng vào trang quản trị Supabase bấm "Restore project", hoặc kiểm tra lại URL từ mục Settings ➔ API.';
    }

    return {
      success: false,
      message: errors.join('; ') || 'Không thể kết nối đến máy chủ Supabase.',
      authServiceAvailable: authServiceOk,
      authVerified: false,
      dbVerified: false,
      isPausedOrDnsError: isNetworkOrDns,
      helpGuidance: guidance
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
