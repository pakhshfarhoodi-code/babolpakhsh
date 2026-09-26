// Helper utilities and storage keys for AppContext and sub-hooks

export const STORAGE_KEYS = {
  AUTH_LOGGED_IN: 'alborz_auth_logged_in',
  THEME: 'alborz_theme',
  CATEGORIES: 'alborz_categories_v2',
  BRANDS: 'alborz_brands_v2',
  PRODUCTS: 'alborz_products_v1',
  ORDERS: 'alborz_orders_v1',
  REASSIGNMENTS: 'alborz_reassignments_v1',
  LOADING_BILLS: 'alborz_loading_bills_v1',
  TRANSACTIONS: 'alborz_tx_v1',
  PRICE_HISTORIES: 'alborz_price_histories_v1',
  SUPERMARKETS: 'alborz_supermarkets_v1',
} as const;

// Collision-free unique ID generator using crypto.randomUUID
export const generateUniqueId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

// Synthetic email generator for Supabase Auth
export const toSyntheticEmail = (username: string): string => {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `${clean || 'user'}@babolpakhsh.internal`;
};
