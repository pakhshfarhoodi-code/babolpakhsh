import React, { lazy, ComponentType, LazyExoticComponent } from 'react';

const KEY = 'chunk-reload-at';
const COOLDOWN_MS = 30_000;

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|Loading chunk|ChunkLoadError|NS_ERROR_NET_PARTIAL_TRANSFER|net::ERR_INCOMPLETE_CHUNKED_ENCODING|net::ERR_CONTENT_LENGTH_MISMATCH|Failed to fetch/i.test(
    msg,
  );
}

/** true یعنی صفحه در حال ریلود است. */
export function reloadOnceForNewDeploy(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // ignore
  }
  window.location.reload();
  return true;
}

/**
 * تلاش مجدد برای اجرای یک تابع ایمپورت پرومیس‌محور تا ۳ بار با backoff تصاعدی (۱۰۰۰ms، ۲۰۰۰ms، ۳۵۰۰ms)
 */
export async function retryImport<T>(
  importer: () => Promise<T>,
  retries = 3,
  delays: number[] = [1000, 2000, 3500]
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await importer();
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        throw err;
      }
      const delay = delays[attempt - 1] ?? delays[delays.length - 1];
      console.warn(`[retryImport] Attempt ${attempt}/${retries} failed. Retrying in ${delay}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * بارگذاری lazy کامپوننت با ۳ بار تلاش مجدد خودکار و backoff
 * در صورت شکست نهایی، کامپوننت خطای قابل فهم با دکمه تلاش مجدد نشان می‌دهد نه صفحه سفید
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(() =>
    retryImport(factory, 3, [1000, 2000, 3500]).catch((err) => {
      console.error('[lazyWithRetry] All retries failed for chunk:', err);
      const ChunkFallback: React.FC<any> = () =>
        React.createElement(
          'div',
          {
            className:
              'p-6 my-6 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 max-w-md mx-auto shadow-2xl',
            dir: 'rtl',
          },
          React.createElement(
            'div',
            {
              className:
                'w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center text-xl',
            },
            '⚠️'
          ),
          React.createElement(
            'div',
            { className: 'space-y-1' },
            React.createElement(
              'h3',
              { className: 'text-sm font-bold text-slate-100' },
              'اتصال اینترنت ضعیف است'
            ),
            React.createElement(
              'p',
              { className: 'text-xs text-slate-400 leading-relaxed' },
              'دریافت فایل‌های این بخش با قطعی مواجه شد. لطفاً اتصال اینترنت را بررسی نموده و دوباره تلاش فرمایید.'
            )
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => window.location.reload(),
              className:
                'px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition cursor-pointer active:scale-95',
            },
            'تلاش مجدد'
          )
        );
      return { default: ChunkFallback as unknown as T };
    })
  );
}

