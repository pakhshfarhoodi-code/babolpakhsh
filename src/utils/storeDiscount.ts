/**
 * Helper utilities for Store & Order Discounts
 * Formula:
 * Total Discount % = min(100, pickup_discount_percent + founder_discount_percent + (approved ? manual_discount_percent : 0))
 * Discounted Unit Price = Math.round(original_unit_price * (100 - total_discount_percent) / 100)
 */

export const DEFAULT_FOUNDER_DISCOUNT_PERCENT = 5;
export const FOUNDER_INITIAL_CAPACITY = 80;
export const FOUNDER_QUALIFYING_LIMIT = 100;

export interface StoreRankInfo {
  rank: number;
  totalStores: number;
  isFounderEligible: boolean;
  remainingCapacity: number;
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
