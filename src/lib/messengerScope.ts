/**
 * Messenger Scope Utility
 *
 * Synchronously isolates Supabase auth storage key per messenger user account (Telegram / Eitaa),
 * preventing session collision when different accounts are opened on the same mobile device.
 */

function extractTelegramUserId(rawTgWebAppData: string): string | null {
  try {
    if (!rawTgWebAppData) return null;
    const params = new URLSearchParams(rawTgWebAppData);
    const userRaw = params.get('user');
    if (!userRaw) return null;
    const userObj = JSON.parse(userRaw);
    if (userObj && (userObj.id !== undefined && userObj.id !== null)) {
      return String(userObj.id);
    }
  } catch {}
  return null;
}

let cachedScope: string | null = null;

function computeMessengerScope(): string {
  // Source 1: window.Eitaa?.WebApp?.initDataUnsafe?.user?.id -> 'eitaa-<id>'
  try {
    const eitaaUser = typeof window !== 'undefined' ? (window as any).Eitaa?.WebApp?.initDataUnsafe?.user : null;
    if (eitaaUser && eitaaUser.id !== undefined && eitaaUser.id !== null) {
      return `eitaa-${eitaaUser.id}`;
    }
  } catch {}

  // Source 2: tgWebAppData parameter in location.hash -> 'tg-<id>'
  try {
    if (typeof window !== 'undefined' && window.location?.hash) {
      const hashStr = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashStr);
      const tgWebAppData = hashParams.get('tgWebAppData');
      if (tgWebAppData) {
        const tgId = extractTelegramUserId(tgWebAppData);
        if (tgId) {
          return `tg-${tgId}`;
        }
      }
    }
  } catch {}

  // Source 3: sessionStorage.getItem('__telegram__initParams') -> 'tg-<id>'
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const rawInitParams = window.sessionStorage.getItem('__telegram__initParams');
      if (rawInitParams) {
        const parsed = JSON.parse(rawInitParams);
        const tgWebAppData = parsed?.tgWebAppData;
        if (tgWebAppData && typeof tgWebAppData === 'string') {
          const tgId = extractTelegramUserId(tgWebAppData);
          if (tgId) {
            return `tg-${tgId}`;
          }
        }
      }
    }
  } catch {}

  // Additional fallback: window.Telegram?.WebApp?.initDataUnsafe?.user?.id if already present
  try {
    const tgUser = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initDataUnsafe?.user : null;
    if (tgUser && tgUser.id !== undefined && tgUser.id !== null) {
      return `tg-${tgUser.id}`;
    }
  } catch {}

  return '';
}

/**
 * Returns isolated scope identifier:
 * - 'eitaa-<id>' for Eitaa Mini App
 * - 'tg-<id>' for Telegram Mini App
 * - '' for regular web browser
 */
export function getMessengerScope(): string {
  if (cachedScope === null) {
    cachedScope = computeMessengerScope();
  }
  return cachedScope;
}
