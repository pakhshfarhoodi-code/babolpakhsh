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
