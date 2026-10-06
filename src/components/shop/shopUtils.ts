import { Order, Product } from '../../types';
export { formatOrderDate, formatPersianDate, formatPersianDateOnly, isTodayInTehran } from '../../utils/dateUtils';

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

const faNumberFormatter = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 3,
});

/**
 * Format raw number to Persian digits with Persian thousand separators (٬)
 */
export function formatNumberFa(amount: number | string): string {
  const num = typeof amount === 'number' ? (isNaN(amount) ? 0 : amount) : (Number(amount) || 0);
  return faNumberFormatter.format(num).replace(/,/g, '٬');
}

/**
 * Converts English digits to Persian digits in any string or number
 */
export function toPersianDigits(input: string | number): string {
  if (input === null || input === undefined || input === '') return '';
  return input.toString().replace(/[0-9]/g, (d) => ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'][parseInt(d, 10)]);
}

/**
 * Format numbers and prices in Persian currency format with non-breaking space
 */
export function formatPrice(amount: number, unit = 'تومان'): string {
  const num = typeof amount === 'number' ? (isNaN(amount) ? 0 : amount) : (Number(amount) || 0);
  const formatted = faNumberFormatter.format(num).replace(/,/g, '٬');
  return `${formatted}\u00A0${unit}`;
}

/**
 * Shopkeeper friendly order status labels
 */
export function getOrderStatusLabel(status: Order['status']): {
  label: string;
  colorClass: string;
  step: number; // 1: registered (ثبت شده), 2: on the way (در راه), 3: delivered/undelivered
} {
  switch (status) {
    case 'assigned':
      return {
        label: 'ثبت شده',
        colorClass: 'bg-blue-950 text-blue-400 border-blue-800',
        step: 1,
      };
    case 'delegated':
    case 'loading':
      return {
        label: 'در راه',
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
 * Common catalog filter logic for products (categories, brand/selectedBrands, search, and inStockOnly toggle)
 */
export function filterCatalogProducts(
  products: Product[],
  options: {
    categoryId?: string;
    brand?: string;
    selectedBrands?: string[];
    searchTerm?: string;
    inStockOnly?: boolean;
  }
): Product[] {
  const { categoryId = 'all', brand = 'all', selectedBrands, searchTerm = '', inStockOnly = false } = options;
  const term = searchTerm.toLowerCase().trim();

  return products.filter((p) => {
    if (!p.is_active) return false;
    // When inStockOnly is active, hide is_market_test ("به زودی") products
    if (inStockOnly && p.is_market_test) return false;
    if (categoryId !== 'all' && p.category_id !== categoryId) return false;

    // Multi-brand filter support
    if (selectedBrands && selectedBrands.length > 0) {
      const pBrand = (p.brand || '').trim();
      if (!selectedBrands.includes(pBrand)) return false;
    } else if (brand !== 'all') {
      if (p.brand !== brand) return false;
    }

    if (term) {
      const matchName = p.name.toLowerCase().includes(term);
      const matchBrand = p.brand && p.brand.toLowerCase().includes(term);
      if (!matchName && !matchBrand) return false;
    }
    return true;
  });
}

/**
 * Normalizes Persian product name to find its base family name for grouping
 * (e.g. "پنیر پیتزا مطهر ۲ کیلویی" and "پنیر پیتزا دالیا ۵۰۰ گرمی" -> "پنیر پیتزا")
 */
export function getProductFamilyKey(name: string): string {
  if (!name) return '';
  let clean = name.trim()
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    // Remove numbers and common unit/size terms in Persian/English
    .replace(/[۰-۹0-9]+(\s*(کیلو|کیلویی|گرم|گرمی|درصد|%|عددی|عدد|لیتر|لیتری|cc|ml|gr|kg))?/gi, '')
    // Remove brackets, dashes, slashes, punctuation
    .replace(/[()[\]–\-_/\\,،.+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(' ').filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]} ${words[1]}`.toLowerCase();
  }
  return (words[0] || clean).toLowerCase();
}

export interface SortCatalogOptions {
  popular?: boolean;
  byName?: boolean;
  byPrice?: boolean;
  productSalesMap?: Record<string, number>;
}

/**
 * Sorts catalog products based on popularity (most sold), alphabetical name, and price (low to high).
 * Supports combined name + price sorting where same family/base items (e.g. all pizza cheese varieties)
 * appear together, ordered from lowest price to highest price.
 */
export function sortCatalogProducts(
  products: Product[],
  options: SortCatalogOptions
): Product[] {
  const { popular = false, byName = false, byPrice = false, productSalesMap = {} } = options;

  const sorted = [...products];

  // Case 1: Both Name and Price are selected
  // Items of the same family/name group appear together, ordered by price from lowest to highest
  if (byName && byPrice) {
    sorted.sort((a, b) => {
      const familyA = getProductFamilyKey(a.name);
      const familyB = getProductFamilyKey(b.name);

      const familyComp = familyA.localeCompare(familyB, 'fa');
      if (familyComp !== 0) {
        return familyComp;
      }

      // Inside same family: sort by price ascending (lowest price first)
      if (a.price !== b.price) {
        return a.price - b.price;
      }

      // Tiebreaker: full name
      return a.name.localeCompare(b.name, 'fa');
    });
    return sorted;
  }

  // Case 2: Only Name is selected (alphabetical)
  if (byName) {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    return sorted;
  }

  // Case 3: Only Price is selected (lowest price to highest price)
  if (byPrice) {
    sorted.sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }
      return a.name.localeCompare(b.name, 'fa');
    });
    return sorted;
  }

  // Case 4: Popular (Default - highest sales count first)
  if (popular) {
    sorted.sort((a, b) => {
      const salesA = productSalesMap[a.id] || 0;
      const salesB = productSalesMap[b.id] || 0;
      if (salesB !== salesA) {
        return salesB - salesA;
      }
      // If sales are equal, sort by likes count (if market test) or alphabetical name
      const likesA = (a as any).likes_count || 0;
      const likesB = (b as any).likes_count || 0;
      if (likesB !== likesA) {
        return likesB - likesA;
      }
      return a.name.localeCompare(b.name, 'fa');
    });
    return sorted;
  }

  return sorted;
}


