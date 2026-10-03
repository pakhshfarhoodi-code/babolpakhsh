import { Order, Product } from '../../types';

export const LOW_STOCK_THRESHOLD = 10;

/**
 * Normalizes Persian and Arabic numbers in string to English numbers and parses float decimal
 */
export function normalizeDigits(input: string | number): number {
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  if (!input) return 0;
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];

  let str = input.toString();
  for (let i = 0; i < 10; i++) {
    str = str.replace(persianDigits[i], i.toString()).replace(arabicDigits[i], i.toString());
  }

  // Replace Persian momayyez (٫), slash (/), or comma (,) with standard dot (.)
  str = str.replace(/[٫,/]/g, '.');

  // Remove any character except digits and dot
  const cleanStr = str.replace(/[^\d.]/g, '');
  if (!cleanStr) return 0;

  // Handle multiple dots if any
  const parts = cleanStr.split('.');
  const formatted = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : parts[0];
  const parsed = parseFloat(formatted);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Rounds a quantity to 3 decimal places
 */
export function roundQty(qty: number): number {
  if (typeof qty !== 'number' || isNaN(qty)) return 0;
  return Math.round(qty * 1000) / 1000;
}

/**
 * Clamps quantity to 0 .. maxAvailable (rounded to 3 decimal places)
 */
export function clampQuantity(
  val: number,
  maxAvailable: number
): { quantity: number; clamped: boolean } {
  const roundedVal = roundQty(val);
  const roundedMax = roundQty(maxAvailable);
  if (roundedVal <= 0) return { quantity: 0, clamped: false };
  if (roundedMax <= 0) return { quantity: 0, clamped: true };
  if (roundedVal > roundedMax) return { quantity: roundedMax, clamped: true };
  return { quantity: roundedVal, clamped: false };
}

/**
 * Format numbers and prices in Persian currency format
 */
export function formatPrice(amount: number): string {
  return `${amount.toLocaleString('fa-IR')} تومان`;
}

/**
 * Shopkeeper friendly order status labels
 */
export function getOrderStatusLabel(status: Order['status']): {
  label: string;
  colorClass: string;
  step: number; // 1: registered, 2: on the way, 3: delivered/undelivered
} {
  switch (status) {
    case 'assigned':
      return {
        label: 'در انتظار ارسال',
        colorClass: 'bg-blue-950 text-blue-400 border-blue-800',
        step: 1,
      };
    case 'delegated':
      return {
        label: 'در حال هماهنگی ارسال',
        colorClass: 'bg-amber-950 text-amber-400 border-amber-800',
        step: 2,
      };
    case 'delivered':
      return {
        label: 'تحویل شد',
        colorClass: 'bg-emerald-950 text-emerald-400 border-emerald-800',
        step: 3,
      };
    case 'undelivered':
      return {
        label: 'تحویل نشد',
        colorClass: 'bg-rose-950 text-rose-400 border-rose-800',
        step: 3,
      };
    default:
      return {
        label: 'ثبت شده',
        colorClass: 'bg-slate-800 text-slate-300 border-slate-700',
        step: 1,
      };
  }
}

/**
 * Get the latest order of the given store
 */
export function getLastOrder(orders: Order[], storeId: string): Order | undefined {
  const storeOrders = orders.filter((o) => o.supermarket_id === storeId);
  if (storeOrders.length === 0) return undefined;
  return storeOrders[0]; // Already ordered from newest to oldest
}

/**
 * Calculates top purchased products by frequency/total quantity for the store
 */
export function getTopPurchasedProducts(
  orders: Order[],
  products: Product[],
  storeId: string,
  limit = 5
): Product[] {
  const storeOrders = orders.filter((o) => o.supermarket_id === storeId);
  if (storeOrders.length === 0) return [];

  const qtyMap: Record<string, number> = {};
  for (const order of storeOrders) {
    for (const item of order.items || []) {
      qtyMap[item.product_id] = (qtyMap[item.product_id] || 0) + item.quantity;
    }
  }

  // Active products only
  const activeProducts = products.filter((p) => p.is_active);

  const sorted = activeProducts
    .filter((p) => (qtyMap[p.id] || 0) > 0)
    .sort((a, b) => (qtyMap[b.id] || 0) - (qtyMap[a.id] || 0));

  return sorted.slice(0, limit);
}

/**
 * Builds cart items from a previous order, adjusting for current stock and unavailable items
 */
export function buildCartFromOrder(
  order: Order,
  products: Product[]
): {
  cart: Record<string, number>;
  unavailableItems: string[];
  reducedItems: string[];
} {
  const newCart: Record<string, number> = {};
  const unavailableItems: string[] = [];
  const reducedItems: string[] = [];

  for (const item of order.items || []) {
    const prod = products.find((p) => p.id === item.product_id);
    if (!prod || !prod.is_active) {
      unavailableItems.push(item.name);
      continue;
    }

    const available = roundQty(Math.max(0, prod.stock - prod.reserved_stock));
    if (available <= 0) {
      unavailableItems.push(prod.name);
      continue;
    }

    const roundedItemQty = roundQty(item.quantity);
    if (roundedItemQty > available) {
      newCart[prod.id] = available;
      reducedItems.push(`${prod.name} (از ${roundedItemQty} به ${available} کاهش یافت)`);
    } else {
      newCart[prod.id] = roundedItemQty;
    }
  }

  return { cart: newCart, unavailableItems, reducedItems };
}

/**
 * Common catalog filter logic for products (categories, brand, search, and inStockOnly toggle)
 */
export function filterCatalogProducts(
  products: Product[],
  options: {
    categoryId?: string;
    brand?: string;
    searchTerm?: string;
    inStockOnly?: boolean;
  }
): Product[] {
  const { categoryId = 'all', brand = 'all', searchTerm = '', inStockOnly = false } = options;
  const term = searchTerm.toLowerCase().trim();

  return products.filter((p) => {
    if (!p.is_active) return false;
    // When inStockOnly is active, hide is_market_test ("به زودی") products
    if (inStockOnly && p.is_market_test) return false;
    if (categoryId !== 'all' && p.category_id !== categoryId) return false;
    if (brand !== 'all' && p.brand !== brand) return false;
    if (term) {
      const matchName = p.name.toLowerCase().includes(term);
      const matchBrand = p.brand && p.brand.toLowerCase().includes(term);
      if (!matchName && !matchBrand) return false;
    }
    return true;
  });
}

