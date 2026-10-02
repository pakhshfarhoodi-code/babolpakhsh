import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-supabase-url') &&
  supabaseUrl.startsWith('http')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function getFunctionErrorMessage(error: unknown, fallback: string = 'خطای سرور در پردازش درخواست'): Promise<string> {
  if (!error) return fallback;
  if (typeof error === 'object' && error !== null && 'context' in error) {
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.clone().json();
        if (body?.error) return String(body.error);
        if (body?.message) return String(body.message);
      }
    } catch {
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.text === 'function') {
          const text = await ctx.clone().text();
          if (text) return text;
        }
      } catch {}
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function createIsolatedAuthClient() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
}


