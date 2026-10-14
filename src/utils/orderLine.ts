/**
 * Standard Order Line and Packaging Logic
 * 
 * Rules:
 * 1. product.unit: Only base unit ('عدد', 'کیلوگرم', 'لیتر', ...).
 * 2. product.price & product.visitor_price: Price of one single base unit.
 * 3. product.items_per_package: Count of base units per carton (if <= 1 or empty, item is non-packaged with multiplier 1).
 * 4. order_items.price: Keeps price of one whole sale package/carton (unit_price * items_per_package).
 * 5. Rounding is strictly applied only on unit price (discounted unit price).
 */

export const PACKAGE_WORDS = ['کارتن', 'جعبه', 'بسته', 'پک', 'باکس'];

/**
 * واحدهای «محتوا/اندازهگیری». اگر واحد کالا یکی از اینهاست و کالا بستهای است (pack > 1)،
 * یعنی واحد همان چیزی است که داخل بسته قرار دارد (مثلاً ۱۰ کیلوگرم) و واحد فروش
 * (ستون تعداد) به «کارتن» برمیگردد.
 * هر واحد دیگری (کارتن، بسته، کیسه، جعبه، سطل، شانه، دبه، ... یا هر واحد دلخواه ادمین)
 * «واحد فروش» است و باید عیناً در ستون تعداد فاکتور نمایش داده شود؛ محتوای هر واحد = «عدد».
 */
export const CONTENT_UNIT_WORDS = [
  'عدد', 'دانه', 'تکه', 'کیلوگرم', 'کیلو', 'گرم', 'لیتر', 'میلیلیتر', 'متر',
];

/** آیا این واحد یک «ظرف/بستهبندی» (واحد فروش) است؟ */
export function isContainerUnit(unit?: string | null): boolean {
  const u = (unit || '').trim();
  return u.length > 0 && !CONTENT_UNIT_WORDS.includes(u);
}

export type PackInput =
  | { items_per_package?: number | string | null }
  | number
  | string
  | null
  | undefined;

/**
 * Extracts pack multiplier. If > 0 returns that number; otherwise 1.
 */
export function getPackSize(x: PackInput): number {
  if (x === null || x === undefined) return 1;
  if (typeof x === 'number') {
    return x > 0 ? x : 1;
  }
  if (typeof x === 'string') {
    const n = parseFloat(x);
    return !isNaN(n) && n > 0 ? n : 1;
  }
  if (typeof x === 'object' && 'items_per_package' in x) {
    const val = (x as { items_per_package?: number | string | null }).items_per_package;
    if (val === null || val === undefined) return 1;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return !isNaN(n) && n > 0 ? n : 1;
  }
  return 1;
}

/**
 * Checks if an item is packaged (pack > 1).
 */
export function isPackaged(x: PackInput): boolean {
  return getPackSize(x) > 1;
}

/**
 * Returns the unit of the CONTENT of one sale unit.
 * If item is packaged and the admin-selected unit is a container word (کارتن، بسته، کیسه، ...)
 * or empty, the content is counted in 'عدد'.
 */
export function getBaseUnit(unit?: string | null, pack?: number | PackInput): string {
  const p = typeof pack === 'number' ? pack : getPackSize(pack);
  const u = (unit || '').trim();
  if (p > 1 && (!u || isContainerUnit(u))) {
    return 'عدد';
  }
  return u || 'عدد';
}

/**
 * Returns the SALE unit label shown next to the quantity (e.g. '۱ بسته', '۲ کیسه').
 * - packaged + container unit (بسته، کیسه، کارتن، ...) -> that exact unit chosen by admin
 * - packaged + content/measure unit (عدد، کیلوگرم، ...) or empty -> 'کارتن' (legacy fallback)
 * - non-packaged -> the unit itself
 */
export function getSaleUnitLabel(unit?: string | null, pack?: number | PackInput): string {
  const p = typeof pack === 'number' ? pack : getPackSize(pack);
  if (p > 1) {
    return isContainerUnit(unit) ? (unit as string).trim() : 'کارتن';
  }
  return getBaseUnit(unit, p);
}

/**
 * Returns unit column text for invoice table:
 * If pack > 1 -> `${pack} ${baseUnit}` (e.g. '۵۰ عدد' or '۱۰ کیلوگرم')
 * Otherwise -> just baseUnit (e.g. 'کیلوگرم' or 'عدد') without "1" and without "—".
 */
export function getUnitColumnText(pack: number | PackInput, baseUnit: string): string {
  const p = typeof pack === 'number' ? pack : getPackSize(pack);
  const bu = baseUnit || 'عدد';
  if (p > 1) {
    return `${p.toLocaleString('fa-IR')} ${bu}`;
  }
  return bu;
}

/**
 * Helper to match a product from product list by id or product name
 */
export function findProductMatch<T extends { id?: string; name?: string }>(
  item: { product_id?: string | null; productId?: string | null; name?: string | null; product_name?: string | null },
  products: T[]
): T | null {
  if (!products || products.length === 0) return null;
  const pId = item.product_id || item.productId;
  if (pId) {
    const foundById = products.find((p) => p.id === pId);
    if (foundById) return foundById;
  }
  const rawName = (item.name || item.product_name || '').trim().toLowerCase();
  if (rawName) {
    const foundByName = products.find((p) => (p.name || '').trim().toLowerCase() === rawName);
    if (foundByName) return foundByName;
  }
  return null;
}

/**
 * Calculates unit price from order item accounting for carton vs single unit pricing.
 */
export function getUnitPriceFromOrderItem(
  item: {
    price: number;
    items_per_package?: number | string | null;
  },
  product?: { price?: number; visitor_price?: number; items_per_package?: number } | null,
  isVisitorOrder: boolean = false
): number {
  const pack = getPackSize(item.items_per_package || product?.items_per_package);
  const rawPrice = Number(item.price || 0);

  // Reference base price from catalog product
  const pVisitorPrice = Number(product?.visitor_price ?? 0);
  const pStorePrice = Number(product?.price ?? 0);

  // If rawPrice is dummy placeholder (<= 1) and catalog has real price, ignore rawPrice
  const hasRealRaw = rawPrice > 1;

  if (pack <= 1) {
    if (isVisitorOrder) {
      if (pVisitorPrice > 1) return pVisitorPrice;
      if (pStorePrice > 1) return pStorePrice;
      return hasRealRaw ? rawPrice : (pVisitorPrice || pStorePrice || rawPrice);
    } else {
      if (pStorePrice > 1) return pStorePrice;
      if (hasRealRaw) return rawPrice;
      return pVisitorPrice > 1 ? pVisitorPrice : rawPrice;
    }
  }

  if (isVisitorOrder) {
    if (pVisitorPrice > 1) return pVisitorPrice;
    if (pStorePrice > 1) return pStorePrice;
    if (hasRealRaw) {
      if (pStorePrice > 0 && Math.abs(rawPrice - pStorePrice * pack) < Math.abs(rawPrice - pStorePrice)) {
        return Math.round(rawPrice / pack);
      }
      return rawPrice;
    }
    return pVisitorPrice || pStorePrice || rawPrice;
  }

  if (!isVisitorOrder && pStorePrice > 1) {
    if (hasRealRaw && Math.abs(rawPrice - pStorePrice * pack) < Math.abs(rawPrice - pStorePrice)) {
      // rawPrice is carton price
      return Math.round(rawPrice / pack);
    }
    return pStorePrice;
  }

  return hasRealRaw ? rawPrice : (pStorePrice || pVisitorPrice || rawPrice);
}

export interface ItemPricingDetails {
  pack: number;
  unitPrice: number;
  cartonPrice: number;
  total: number;
}

/**
 * Robust helper to calculate package multiplier, unit price, carton price, and total line amount
 */
export function getItemUnitPriceAndTotal(
  item: {
    price: number;
    quantity: number;
    items_per_package?: number | string | null;
    product_id?: string;
    productId?: string;
    name?: string;
    product_name?: string;
  },
  product?: { price?: number; visitor_price?: number; items_per_package?: number } | null,
  isVisitorOrder: boolean = false
): ItemPricingDetails {
  const pack = getPackSize(item.items_per_package || product?.items_per_package);
  const qty = Number(item.quantity) || 0;
  const rawPrice = Number(item.price) || 0;

  const pVisitorPrice = Number(product?.visitor_price ?? 0);
  const pStorePrice = Number(product?.price ?? 0);
  const hasRealRaw = rawPrice > 1;

  // Reference catalog unit price (only used to detect legacy rows saved with a per-unit price,
  // and as a fallback when the saved price is a placeholder).
  const refPrice = isVisitorOrder
    ? (pVisitorPrice > 1 ? pVisitorPrice : (pStorePrice > 1 ? pStorePrice : 0))
    : (pStorePrice > 1 ? pStorePrice : 0);

  let unitPrice = 0;

  if (hasRealRaw) {
    // The price SAVED on the order item is the source of truth (it is what the customer saw and
    // agreed to). It never depends on the live catalog, so totals cannot change when products
    // load late, are re-fetched, or when the catalog price is edited later.
    if (pack <= 1) {
      unitPrice = rawPrice;
    } else if (refPrice > 0 && Math.abs(rawPrice - refPrice) < Math.abs(rawPrice - refPrice * pack)) {
      // legacy row that was saved with a per-unit price
      unitPrice = rawPrice;
    } else {
      // standard rule: order_items.price = price of one whole sale package (unit * pack)
      unitPrice = Math.round(rawPrice / pack);
    }
  } else if (isVisitorOrder) {
    unitPrice = pVisitorPrice > 1 ? pVisitorPrice : (pStorePrice > 1 ? pStorePrice : (pVisitorPrice || pStorePrice || rawPrice));
  } else {
    unitPrice = pStorePrice > 1 ? pStorePrice : (pVisitorPrice > 1 ? pVisitorPrice : (pStorePrice || rawPrice));
  }

  const cartonPrice = Math.round(unitPrice * pack);
  const total = Math.round(qty * pack * unitPrice);

  return { pack, unitPrice, cartonPrice, total };
}

export interface ComputeLineParams {
  quantity: number;
  pack: number | PackInput;
  unitPrice: number;
  discountPercent?: number;
}

export interface ComputeLineResult {
  discountedUnitPrice: number;
  total: number;
}

/**
 * Standard line calculation:
 * discountedUnitPrice = Math.round(unitPrice * (100 - discountPercent) / 100)
 * total = quantity * pack * discountedUnitPrice
 */
export function computeLine({
  quantity,
  pack,
  unitPrice,
  discountPercent = 0,
}: ComputeLineParams): ComputeLineResult {
  const safeQty = Number(quantity) || 0;
  const safePack = getPackSize(pack);
  const safeUnitPrice = Number(unitPrice) || 0;
  const safeDiscount = Math.max(0, Math.min(100, Number(discountPercent) || 0));

  const discountedUnitPrice = Math.round((safeUnitPrice * (100 - safeDiscount)) / 100);
  const total = Math.round(safeQty * safePack * discountedUnitPrice);

  return {
    discountedUnitPrice,
    total,
  };
}

/**
 * Helper to format line breakdown string:
 * Packaged: "۲ بسته × ۵۰ عدد × ۳۵٬۰۰۰ = ۳٬۵۰۰٬۰۰۰" (saleUnit = unit chosen by admin)
 * Non-packaged: "۲٫۵ کیلوگرم × ۲۰۰٬۰۰۰ = ۵۰۰٬۰۰۰"
 */
export function formatLineCalculation(
  quantity: number,
  pack: number | PackInput,
  unitPrice: number,
  baseUnit: string,
  discountPercent: number = 0,
  saleUnit: string = 'کارتن'
): string {
  const p = getPackSize(pack);
  const { discountedUnitPrice, total } = computeLine({
    quantity,
    pack: p,
    unitPrice,
    discountPercent,
  });

  const qtyStr = quantity.toLocaleString('fa-IR');
  const bu = baseUnit || 'عدد';
  const unitPriceStr = discountedUnitPrice.toLocaleString('fa-IR');
  const totalStr = total.toLocaleString('fa-IR');

  if (p > 1) {
    return `${qtyStr} ${saleUnit || 'کارتن'} × ${p.toLocaleString('fa-IR')} ${bu} × ${unitPriceStr} = ${totalStr} تومان`;
  }
  return `${qtyStr} ${bu} × ${unitPriceStr} = ${totalStr} تومان`;
}

export interface OrderPricingInput {
  items?: Array<{
    price: number;
    quantity: number;
    items_per_package?: number | string | null;
    product_id?: string;
    productId?: string;
    name?: string;
    product_name?: string;
  }> | null;
  supermarket_id?: string | null;
  total_amount?: number | null;
  pickup_discount_percent?: number | null;
  founder_discount_percent?: number | null;
  discount_status?: string | null;
  discount_percent?: number | null;
}

export interface OrderPricingResult {
  isVisitorOrder: boolean;
  pickupPercent: number;
  founderPercent: number;
  manualPercent: number;
  totalDiscountPercent: number;
  /** sum of line totals before discount */
  subtotal: number;
  /** sum of line totals after discount (same per-line rounding as the printed invoice) */
  discountedSubtotal: number;
}

/**
 * SINGLE source of truth for an order's money totals.
 * Used by the invoice (InvoiceDocument) and the admin orders list so both always show the same number.
 * Store invoices use the store price; only visitor self-orders ("self-" supermarket ids) use visitor price.
 */
export function getOrderPricing(
  order: OrderPricingInput,
  products: Array<{ id: string; name?: string; price?: number; visitor_price?: number; items_per_package?: number }>
): OrderPricingResult {
  const items = order.items || [];
  const isVisitorOrder = Boolean(order.supermarket_id?.startsWith('self-'));

  const pickupPercent = order.pickup_discount_percent || 0;
  const founderPercent = order.founder_discount_percent || 0;
  const manualPercent = order.discount_status === 'approved' ? (order.discount_percent || 0) : 0;
  const totalDiscountPercent = Math.min(100, Math.max(0, pickupPercent + founderPercent + manualPercent));

  let rawSubtotal = 0;
  let discountedSum = 0;
  for (const item of items) {
    const product = findProductMatch(item, products);
    const { pack, unitPrice, total } = getItemUnitPriceAndTotal(item, product, isVisitorOrder);
    rawSubtotal += total;
    discountedSum += computeLine({
      quantity: Number(item.quantity) || 0,
      pack,
      unitPrice,
      discountPercent: totalDiscountPercent,
    }).total;
  }

  if (rawSubtotal > 0) {
    return {
      isVisitorOrder, pickupPercent, founderPercent, manualPercent, totalDiscountPercent,
      subtotal: rawSubtotal,
      discountedSubtotal: discountedSum,
    };
  }

  const fallback = Number(order.total_amount || 0);
  return {
    isVisitorOrder, pickupPercent, founderPercent, manualPercent, totalDiscountPercent,
    subtotal: fallback,
    discountedSubtotal: Math.round(fallback * (1 - totalDiscountPercent / 100)),
  };
}

/**
 * Splits (subtotal - discountedSubtotal) between the active discounts so that the displayed
 * discount lines always add up exactly to the difference shown in the totals (no 1-5 toman drift
 * caused by per-unit rounding). The last active discount absorbs the rounding remainder.
 */
export function splitDiscountAmounts(p: OrderPricingResult): { pickup: number; founder: number; manual: number } {
  const totalDiscount = Math.max(0, p.subtotal - p.discountedSubtotal);
  const active: Array<['pickup' | 'founder' | 'manual', number]> = [];
  if (p.pickupPercent > 0) active.push(['pickup', p.pickupPercent]);
  if (p.founderPercent > 0) active.push(['founder', p.founderPercent]);
  if (p.manualPercent > 0) active.push(['manual', p.manualPercent]);

  const out = { pickup: 0, founder: 0, manual: 0 };
  if (active.length === 0 || totalDiscount === 0) return out;

  const sumPct = active.reduce((a, [, pct]) => a + pct, 0);
  let allocated = 0;
  active.forEach(([key, pct], i) => {
    if (i === active.length - 1) {
      out[key] = totalDiscount - allocated;
    } else {
      const part = Math.round((totalDiscount * pct) / sumPct);
      out[key] = part;
      allocated += part;
    }
  });
  return out;
}

