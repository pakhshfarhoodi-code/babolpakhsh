// Helper utilities and storage keys for AppContext and sub-hooks

export const STORAGE_KEYS = {
  AUTH_LOGGED_IN: 'alborz_auth_logged_in',
  AUTH_ROLE: 'alborz_auth_role',
  AUTH_VISITOR_ID: 'alborz_auth_visitor_id',
  AUTH_SUPERMARKET_ID: 'alborz_auth_supermarket_id',
  THEME: 'alborz_theme',
  CATEGORIES: 'alborz_categories_v2',
  BRANDS: 'alborz_brands_v2',
  PRODUCTS: 'alborz_products_v1',
  ORDERS: 'alborz_orders_v1',
  REASSIGNMENTS: 'alborz_reassignments_v1',
  LOADING_BILLS: 'alborz_loading_bills_v1',
  TRANSACTIONS: 'alborz_tx_v1',
  PRICE_HISTORIES: 'alborz_price_histories_v1',
  UNITS: 'alborz_units_v1',
  SUPERMARKETS: 'alborz_supermarkets_v1',
  VISITORS: 'alborz_visitors_v1',
  DELETED_PRODUCT_IDS: 'farhoodi_deleted_product_ids_v1',
  DELETED_SUPERMARKET_IDS: 'farhoodi_deleted_supermarket_ids_v1',
  DELETED_VISITOR_IDS: 'farhoodi_deleted_visitor_ids_v1',
} as const;

// Read tombstoned deleted IDs from localStorage
export const getDeletedIds = (key: string): Set<string> => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

// Add ID to tombstone set to prevent automatic revival during sync
export const addDeletedId = (key: string, id: string): void => {
  try {
    const set = getDeletedIds(key);
    set.add(id);
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // quota fallback
  }
};

// Collision-free unique ID generator using crypto.randomUUID
export const generateUniqueId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

// Normalize Persian and Arabic digits to English ASCII digits
export const normalizeDigits = (str: string): string => {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.split(persianDigits[i]).join(String(i));
    result = result.split(arabicDigits[i]).join(String(i));
  }
  return result;
};

// Synthetic email generator for Supabase Auth that works reliably with English, Persian, numbers, or mixed usernames
export const toSyntheticEmail = (username: string): string => {
  const normalized = normalizeDigits(username.trim()).toLowerCase();
  if (normalized.includes('@')) {
    return normalized;
  }
  // If clean ASCII with length >= 3
  const clean = normalized.replace(/[^a-z0-9_-]/g, '');
  if (clean.length >= 3) {
    return `${clean}@babolpakhsh.internal`;
  }
  // For Persian or non-ASCII strings, encode characters uniquely into hex representation
  let hex = '';
  for (let i = 0; i < normalized.length; i++) {
    hex += normalized.charCodeAt(i).toString(16);
  }
  return `u_${hex || 'shop'}@babolpakhsh.internal`;
};
