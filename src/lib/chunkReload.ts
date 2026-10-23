import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * بعد از هر دیپلوی، نام فایل‌های chunk (مثل EditOrderModal-xxxx.js) عوض می‌شود.
 * اگر یک تب قدیمی هنوز باز باشد و chunk قدیمی را بخواهد، مرورگر خطای
 * «error loading dynamically imported module» می‌دهد. راه‌حل: یک‌بار صفحه را تازه کن.
 */
const KEY = 'chunk-reload-at';
const COOLDOWN_MS = 30_000; // جلوگیری از حلقه‌ی بی‌نهایت اگر مشکل چیز دیگری بود

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|Loading chunk|ChunkLoadError/i.test(
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
    // اگر sessionStorage در دسترس نبود، فقط یک بار تلاش می‌کنیم
  }
  window.location.reload();
  return true;
}

/**
 * تلاش مجدد برای اجرای یک تابع ایمپورت پرومیس‌محور تا ۳ بار با تأخیرهای ۸۰۰ms و ۱۵۰۰ms
 */
export async function retryImport<T>(
  importer: () => Promise<T>,
  retries = 3,
  delays: number[] = [800, 1500]
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
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * بارگذاری lazy کامپوننت با حداکثر ۳ بار تلاش مجدد هنگام بروز خطای بارگذاری
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(() => retryImport(factory, 3, [800, 1500]));
}
