/**
 * Helper utilities for Store & Order Discounts
 * Formula:
 * Total Discount % = min(100, pickup_discount_percent + founder_discount_percent + (approved ? manual_discount_percent : 0))
 * Discounted Unit Price = Math.round(original_unit_price * (100 - total_discount_percent) / 100)
 */

export const DEFAULT_FOUNDER_DISCOUNT_PERCENT = 5;
export const FOUNDER_INITIAL_CAPACITY = 90;
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
  isFounderActive: boolean;
  founderPercent: number;
  rank: number;
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

  // Sort chronologically ascending by created_at
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

/**
 * Calculates whether the 5% founder discount for the first 100 stores is active,
 * ensuring it applies strictly to the first 3 orders of each store.
 */
export function getStoreFounderDiscountStatus(
  supermarkets: Array<{ id: string; created_at?: string }>,
  orders: Array<{ supermarket_id: string; status?: string; founder_discount_percent?: number }>,
  storeId?: string | null
): FounderDiscountStatus {
  if (!storeId) {
    return {
      isFounderEligible: false,
      usedOrdersCount: 0,
      remainingOrdersCount: 0,
      isFounderActive: false,
      founderPercent: 0,
      rank: 999,
    };
  }

  const { rank, isFounderEligible } = getStoreRegistrationRank(supermarkets, storeId);

  // Count non-cancelled orders belonging to this store
  const storeOrders = (orders || []).filter(
    (o) => o.supermarket_id === storeId && o.status !== 'cancelled'
  );

  const explicitFounderOrders = storeOrders.filter(
    (o) => (o.founder_discount_percent ?? 0) > 0
  );

  // If store is eligible, every placed non-cancelled order counts towards the 3 orders quota
  const usedOrdersCount = Math.min(
    FOUNDER_MAX_ORDERS_PER_STORE,
    Math.max(explicitFounderOrders.length, storeOrders.length)
  );

  const remainingOrdersCount = Math.max(0, FOUNDER_MAX_ORDERS_PER_STORE - usedOrdersCount);
  const isFounderActive = isFounderEligible && remainingOrdersCount > 0;
  const founderPercent = isFounderActive ? DEFAULT_FOUNDER_DISCOUNT_PERCENT : 0;

  return {
    isFounderEligible,
    usedOrdersCount,
    remainingOrdersCount,
    isFounderActive,
    founderPercent,
    rank,
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

export function getStorePickupDiscountStorageKey(storeId: string): string {
  return `farhoodi_store_pickup_discount_${storeId}`;
}

export function getStorePickupDiscountEnabled(storeId: string): boolean {
  if (!storeId || typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(getStorePickupDiscountStorageKey(storeId));
    return val === 'true';
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
