/**
 * Helper utilities for Store & Order Discounts
 * Formula:
 * Total Discount % = min(100, pickup_discount_percent + founder_discount_percent + (approved ? manual_discount_percent : 0))
 * Discounted Unit Price = Math.round(original_unit_price * (100 - total_discount_percent) / 100)
 */

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
