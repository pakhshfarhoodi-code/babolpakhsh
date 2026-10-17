/**
 * Helper utilities for Store & Order Discounts
 * Formula:
 * Total Discount % = min(100, pickup_discount_percent + founder_discount_percent + (approved ? manual_discount_percent : 0))
 * Discounted Unit Price = Math.round(original_unit_price * (100 - total_discount_percent) / 100)
 */

export const DEFAULT_FOUNDER_DISCOUNT_PERCENT = 5;
export const FOUNDER_INITIAL_CAPACITY = 100;
export const FOUNDER_QUALIFYING_LIMIT = 100;
export const FOUNDER_MAX_ORDERS_PER_STORE = 3;

export interface StoreRankInfo {
  rank: number;
  totalStores: number;
  isFounderEligible: boolean;
  remainingCapacity: number;
}

export interface FounderDiscountStatus {
  isFounderEligible: boolean;
  usedOrdersCount: number;
  remainingOrdersCount: number;
  isFounderQuotaAvailable: boolean;
  isStoreFounderOptedIn: boolean;
  isFounderActive: boolean;
  founderPercent: number;
  ordersLimit: number;
  rank: number;
  campaignNo?: number;
}

export interface OrderDiscountResolution {
  appliedType: 'pickup' | 'founder' | 'none';
  pickupPercent: number;   // درصد اعمال‌شده (۰ اگر اعمال نشد)
  founderPercent: number;  // درصد اعمال‌شده (۰ اگر اعمال نشد)
  eligiblePickup: number;  // درصدی که مشمول بود (قبل از انتخاب)
  eligibleFounder: number;
  skippedReason?: string;
}

export function getProductDiscountPercent(
  product: { discount_percent?: number; discount_starts_at?: string | null; discount_ends_at?: string | null },
  now: Date = new Date()
): number {
  const p = Number(product?.discount_percent) || 0;
  if (p <= 0) return 0;
  if (product.discount_starts_at) {
    const start = new Date(product.discount_starts_at);
    if (!isNaN(start.getTime()) && now < start) return 0;
  }
  if (product.discount_ends_at) {
    const end = new Date(product.discount_ends_at);
    if (!isNaN(end.getTime()) && now > end) return 0;
  }
  return Math.min(100, Math.max(0, p));
}

export function resolveOrderDiscounts(eligiblePickup: number, eligibleFounder: number): OrderDiscountResolution {
  const p = Math.max(0, eligiblePickup || 0);
  const f = Math.max(0, eligibleFounder || 0);

  if (p <= 0 && f <= 0) {
    return {
      appliedType: 'none',
      pickupPercent: 0,
      founderPercent: 0,
      eligiblePickup: p,
      eligibleFounder: f,
    };
  }

  if (p > 0 && f <= 0) {
    return {
      appliedType: 'pickup',
      pickupPercent: p,
      founderPercent: 0,
      eligiblePickup: p,
      eligibleFounder: f,
    };
  }

  if (f > 0 && p <= 0) {
    return {
      appliedType: 'founder',
      pickupPercent: 0,
      founderPercent: f,
      eligiblePickup: p,
      eligibleFounder: f,
    };
  }

  if (f > p) {
    return {
      appliedType: 'founder',
      pickupPercent: 0,
      founderPercent: f,
      eligiblePickup: p,
      eligibleFounder: f,
      skippedReason: `تحویل حضوری (${p}٪) مشمول است ولی ورودی جدید (${f}٪) بالاتر است`,
    };
  } else if (p > f) {
    return {
      appliedType: 'pickup',
      pickupPercent: p,
      founderPercent: 0,
      eligiblePickup: p,
      eligibleFounder: f,
      skippedReason: `ورودی جدید (${f}٪) مشمول است ولی تحویل حضوری (${p}٪) بالاتر است`,
    };
  } else {
    return {
      appliedType: 'pickup',
      pickupPercent: p,
      founderPercent: 0,
      eligiblePickup: p,
      eligibleFounder: f,
      skippedReason: `هر دو (${p}٪) برابرند؛ تحویل حضوری اعمال شد تا سهمیه ورودی جدید حفظ شود`,
    };
  }
}

export function getStoreRegistrationRank(
  supermarkets: Array<{ id: string; created_at?: string }>,
  storeId?: string | null
): StoreRankInfo {
  if (!supermarkets || supermarkets.length === 0) {
    return {
      rank: 1,
      totalStores: 0,
      isFounderEligible: true,
      remainingCapacity: FOUNDER_INITIAL_CAPACITY,
    };
  }

  const sorted = [...supermarkets].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });

  const idx = storeId ? sorted.findIndex((s) => s.id === storeId) : -1;
  const rank = idx >= 0 ? idx + 1 : sorted.length + 1;
  const totalStores = sorted.length;
  const isFounderEligible = rank <= FOUNDER_QUALIFYING_LIMIT;
  const remainingCapacity = Math.max(0, FOUNDER_INITIAL_CAPACITY - totalStores);

  return { rank, totalStores, isFounderEligible, remainingCapacity };
}

export function getStoreFounderDiscountStorageKey(storeId: string): string {
  return `farhoodi_store_founder_discount_${storeId}`;
}

export function getStorePickupDiscountStorageKey(storeId: string): string {
  return `farhoodi_store_pickup_discount_${storeId}`;
}

export function getStorePickupDiscountEnabled(
  storeId: string,
  storeObject?: { pickup_discount_opt_in?: boolean } | null
): boolean {
  if (storeObject && typeof storeObject.pickup_discount_opt_in === 'boolean') {
    return storeObject.pickup_discount_opt_in;
  }
  if (!storeId || typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(getStorePickupDiscountStorageKey(storeId));
    if (val !== null) return val === 'true';
    return false; // Default pickup: off
  } catch {
    return false;
  }
}

export function setStorePickupDiscountEnabled(storeId: string, enabled: boolean): void {
  if (!storeId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorePickupDiscountStorageKey(storeId), enabled ? 'true' : 'false');
  } catch (err) {
    console.error('Failed to save pickup discount state:', err);
  }
}

export function getStoreFounderDiscountUserEnabled(
  storeId: string,
  storeObject?: { founder_discount_opt_in?: boolean; founder_discount_enabled?: boolean } | null
): boolean {
  if (storeObject && typeof storeObject.founder_discount_opt_in === 'boolean') {
    return storeObject.founder_discount_opt_in;
  }
  if (!storeId || typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(getStoreFounderDiscountStorageKey(storeId));
    if (val !== null) {
      return val === 'true';
    }
    if (storeObject && typeof storeObject.founder_discount_enabled === 'boolean') {
      return storeObject.founder_discount_enabled;
    }
    return true; // Default founder: on
  } catch {
    return true;
  }
}

export function setStoreFounderDiscountUserEnabled(storeId: string, enabled: boolean): void {
  if (!storeId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStoreFounderDiscountStorageKey(storeId), enabled ? 'true' : 'false');
  } catch (err) {
    console.error('Failed to save founder discount state:', err);
  }
}

export function getStoreFounderDiscountStatus(
  supermarkets: Array<{
    id: string;
    created_at?: string;
    founder_discount_enabled?: boolean;
    founder_discount_percent?: number;
    founder_orders_limit?: number;
    founder_campaign_no?: number;
    founder_discount_opt_in?: boolean;
  }>,
  orders: Array<{ supermarket_id: string; status?: string; founder_discount_percent?: number; founder_campaign_no?: number }>,
  storeId?: string | null
): FounderDiscountStatus {
  if (!storeId) {
    return {
      isFounderEligible: false,
      usedOrdersCount: 0,
      remainingOrdersCount: 0,
      isFounderQuotaAvailable: false,
      isStoreFounderOptedIn: false,
      isFounderActive: false,
      founderPercent: 0,
      ordersLimit: 3,
      rank: 999,
    };
  }

  const currentStore = supermarkets.find((s) => s.id === storeId);
  const isFounderEligible = currentStore?.founder_discount_enabled === true;
  const storePercent =
    typeof currentStore?.founder_discount_percent === 'number'
      ? currentStore.founder_discount_percent
      : DEFAULT_FOUNDER_DISCOUNT_PERCENT;
  const ordersLimit =
    typeof currentStore?.founder_orders_limit === 'number'
      ? currentStore.founder_orders_limit
      : 3;

  const storeOrders = (orders || []).filter(
    (o) => o.supermarket_id === storeId && o.status !== 'cancelled'
  );

  const storeCampaignNo = currentStore?.founder_campaign_no;
  const explicitFounderOrders = storeOrders.filter(
    (o) =>
      (o.founder_discount_percent ?? 0) > 0 &&
      (storeCampaignNo == null ||
        o.founder_campaign_no == null ||
        o.founder_campaign_no === storeCampaignNo)
  );

  const usedOrdersCount = Math.min(
    ordersLimit,
    explicitFounderOrders.length
  );

  const remainingOrdersCount = Math.max(0, ordersLimit - usedOrdersCount);
  const isFounderQuotaAvailable = isFounderEligible && remainingOrdersCount > 0;

  const isStoreFounderOptedIn = getStoreFounderDiscountUserEnabled(storeId, currentStore);

  const isFounderActive = isFounderQuotaAvailable && isStoreFounderOptedIn;
  const founderPercent = isFounderActive ? storePercent : 0;

  return {
    isFounderEligible,
    usedOrdersCount,
    remainingOrdersCount,
    isFounderQuotaAvailable,
    isStoreFounderOptedIn,
    isFounderActive,
    founderPercent,
    ordersLimit,
    rank: 1,
    campaignNo: storeCampaignNo,
  };
}

export function calculateTotalDiscountPercent(
  pickupPercent: number = 0,
  founderPercent: number = 0,
  manualPercent: number = 0
): number {
  const sum = (pickupPercent || 0) + (founderPercent || 0) + (manualPercent || 0);
  return Math.min(100, Math.max(0, sum));
}

export function calculateDiscountedPrice(
  originalPrice: number,
  totalDiscountPercent: number
): number {
  if (!totalDiscountPercent || totalDiscountPercent <= 0) {
    return originalPrice;
  }
  return Math.round((originalPrice * (100 - totalDiscountPercent)) / 100);
}

export function getStoreOrderDiscountPlan(args: {
  store?: any;
  supermarkets?: Array<any>;
  orders?: Array<any>;
  invoiceSettings?: any;
  priceMode: 'store' | 'visitor' | 'consumer';
}): OrderDiscountResolution & { founderStatus: FounderDiscountStatus; pickupGloballyEnabled: boolean; storeWantsPickup: boolean } {
  const { store, supermarkets = [], orders = [], invoiceSettings, priceMode } = args || {};
  const storeId = store?.id || null;

  const pickupGloballyEnabled = invoiceSettings?.pickup_discount_enabled !== false;
  const storeWantsPickup = storeId ? getStorePickupDiscountEnabled(storeId, store) : false;
  const eligiblePickup = pickupGloballyEnabled && storeWantsPickup && priceMode === 'store'
    ? (Number(invoiceSettings?.pickup_discount_percent) || 3)
    : 0;

  const founderStatus = getStoreFounderDiscountStatus(supermarkets, orders, storeId);
  const eligibleFounder = priceMode === 'store' && founderStatus.isFounderActive
    ? founderStatus.founderPercent
    : 0;

  const resolution = resolveOrderDiscounts(eligiblePickup, eligibleFounder);

  return {
    ...resolution,
    founderStatus,
    pickupGloballyEnabled,
    storeWantsPickup,
  };
}
