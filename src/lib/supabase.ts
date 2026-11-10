import { createClient } from '@supabase/supabase-js';
import { getMessengerScope } from './messengerScope';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-supabase-url') &&
  supabaseUrl.startsWith('http')
);

const scope = getMessengerScope();

/**
 * Resilient fetch wrapper with timeout and retry for Iranian network conditions.
 * Prevents 60-second status 0 hangs and handles transient network disconnects.
 * Each attempt has a 12s timeout. Retries up to maxRetries times with exponential backoff.
 */
export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 8000,
  maxRetries = 2
): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // If caller provided a signal, merge with timeout controller
    if (init?.signal) {
      if (init.signal.aborted) {
        clearTimeout(timeoutTimer);
        controller.abort();
      } else {
        init.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeoutTimer);
            controller.abort();
          },
          { once: true }
        );
      }
    }

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutTimer);
      return response;
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      lastError = err;
      attempt++;

      // If user aborted explicitly or max retries reached, stop
      if (init?.signal?.aborted || attempt > maxRetries) {
        break;
      }

      // Backoff delay before retry (800ms, 1600ms)
      const backoff = attempt * 800;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError;
}

export const supabase = isSupabaseConfigured
  ? createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          storageKey: scope ? `sb-barfroosh-auth-${scope}` : undefined,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: {
          fetch: (url, opts) => resilientFetch(url, opts, 8000, 2),
        },
      }
    )
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
    global: {
      fetch: (url, opts) => resilientFetch(url, opts, 8000, 2),
    },
  });
}

/**
 * Quick connectivity test with timeout and retry
 */
export async function pingSupabaseConnection(timeoutMs = 7000): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'پیکربندی Supabase انجام نشده است.' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const { error } = await supabase.from('profiles').select('id').limit(1).abortSignal(controller.signal);
    clearTimeout(timer);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return {
      ok: false,
      error: isTimeout ? 'مهلت زمان اتصال به سرور به پایان رسید (Timeout)' : 'خطا در برقراری ارتباط با پایگاه داده',
    };
  }
}


