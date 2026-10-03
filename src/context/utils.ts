// Helper utilities and storage keys for AppContext and sub-hooks
import { Order, OrderChannel } from '../types';

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
  PRODUCT_LIKES: 'farhoodi_product_likes_v1',
  MARKET_TEST_PRODUCT_IDS: 'farhoodi_market_test_product_ids_v1',
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

// Read Market Test product IDs from localStorage
export const getMarketTestIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MARKET_TEST_PRODUCT_IDS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

// Add or remove a single product ID from Market Test set
export const setMarketTestId = (productId: string, isMarketTest: boolean): void => {
  try {
    const set = getMarketTestIds();
    if (isMarketTest) {
      set.add(productId);
    } else {
      set.delete(productId);
    }
    localStorage.setItem(STORAGE_KEYS.MARKET_TEST_PRODUCT_IDS, JSON.stringify(Array.from(set)));
  } catch {
    // quota fallback
  }
};

// Bulk add or remove product IDs from Market Test set
export const setBulkMarketTestIds = (productIds: string[], isMarketTest: boolean): void => {
  try {
    const set = getMarketTestIds();
    productIds.forEach((id) => {
      if (isMarketTest) {
        set.add(id);
      } else {
        set.delete(id);
      }
    });
    localStorage.setItem(STORAGE_KEYS.MARKET_TEST_PRODUCT_IDS, JSON.stringify(Array.from(set)));
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

// Security and Authentication Constants
export const MIN_PASSWORD_LENGTH = 6;

// Standard Iranian mobile phone normalizer: converts 0098/98/+98 or 9xxxxxxxxx to 09xxxxxxxxx
export const normalizePhone = (str: string): string => {
  if (!str) return '';
  let clean = normalizeDigits(String(str).trim()).replace(/\D/g, '');
  if (clean.startsWith('0098')) {
    clean = '0' + clean.slice(4);
  } else if (clean.startsWith('98') && clean.length >= 12) {
    clean = '0' + clean.slice(2);
  } else if (clean.startsWith('9') && clean.length === 10) {
    clean = '0' + clean;
  }
  return clean;
};

// Validates whether input is a valid 11-digit Iranian mobile number (09xxxxxxxxx)
export const isValidMobile = (str: string): boolean => {
  const normalized = normalizePhone(str);
  return /^09\d{9}$/.test(normalized);
};

// Synthetic email generator for Supabase Auth using normalized phone numbers
export const toSyntheticEmail = (usernameOrPhone: string): string => {
  const normalizedPhone = normalizePhone(usernameOrPhone);
  if (isValidMobile(normalizedPhone)) {
    return `${normalizedPhone}@babolpakhsh.internal`;
  }
  const cleanDigits = normalizeDigits(usernameOrPhone).trim().replace(/\D/g, '');
  if (cleanDigits.length >= 10) {
    const p = normalizePhone(cleanDigits);
    return `${p}@babolpakhsh.internal`;
  }
  return `${normalizedPhone || 'user'}@babolpakhsh.internal`;
};

// Fallback helper to determine order_channel for legacy orders without explicit channel
export const getOrderChannel = (order: Partial<Order>): OrderChannel => {
  if (
    order.order_channel === 'visitor_field' ||
    order.order_channel === 'store_self' ||
    order.order_channel === 'store_direct'
  ) {
    return order.order_channel;
  }

  // 1. Direct distribution order (assigned_visitor_id is 'direct', null, or empty, or name indicates direct)
  const isDirect =
    order.assigned_visitor_id === 'direct' ||
    !order.assigned_visitor_id ||
    order.visitor_name?.includes('مستقیم');

  if (isDirect) {
    return 'store_direct';
  }

  // 2. Field order registered by visitor (order_source === 'visitor' or ID starts with 'VS')
  if (order.order_source === 'visitor' || (order.id && order.id.startsWith('VS'))) {
    return 'visitor_field';
  }

  // 3. Self order placed by supermarket with an assigned visitor
  return 'store_self';
};

// Clean up stale or obsolete local cache keys safely without deleting real data
export const purgeOperationalLocalStorage = (): void => {
  if (typeof window === 'undefined') return;
  // Only remove temporary obsolete tracking keys, never user products or data
  const keysToPurge = [
    STORAGE_KEYS.DELETED_PRODUCT_IDS,
    STORAGE_KEYS.DELETED_SUPERMARKET_IDS,
    STORAGE_KEYS.DELETED_VISITOR_IDS,
  ];
  keysToPurge.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });
};

