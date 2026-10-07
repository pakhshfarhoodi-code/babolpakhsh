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
 * Returns base unit name. If item is packaged and unit is a package word, returns 'عدد'.
 */
export function getBaseUnit(unit?: string | null, pack?: number | PackInput): string {
  const p = typeof pack === 'number' ? pack : getPackSize(pack);
  const u = (unit || '').trim();
  if (p > 1 && (!u || PACKAGE_WORDS.includes(u))) {
    return 'عدد';
  }
  return u || 'عدد';
}

/**
 * Returns sale unit label (e.g. 'کارتن' for packaged, or base unit for non-packaged).
 */
export function getSaleUnitLabel(unit?: string | null, pack?: number | PackInput): string {
  const p = typeof pack === 'number' ? pack : getPackSize(pack);
  if (p > 1) {
    return 'کارتن';
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

  if (pack <= 1) return rawPrice;

  // Reference base price from catalog product
  const pVisitorPrice = Number(product?.visitor_price ?? 0);
  const pStorePrice = Number(product?.price ?? 0);

  if (isVisitorOrder) {
    if (pVisitorPrice > 0) return pVisitorPrice;
    if (rawPrice > 0) {
      if (pStorePrice > 0 && Math.abs(rawPrice - pStorePrice * pack) < Math.abs(rawPrice - pStorePrice)) {
        return Math.round(rawPrice / pack);
      }
      return rawPrice;
    }
  }

  if (!isVisitorOrder && pStorePrice > 0) {
    if (Math.abs(rawPrice - pStorePrice * pack) < Math.abs(rawPrice - pStorePrice)) {
      // rawPrice is carton price
      return Math.round(rawPrice / pack);
    }
    return pStorePrice;
  }

  return rawPrice;
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
  },
  product?: { price?: number; visitor_price?: number; items_per_package?: number } | null,
  isVisitorOrder: boolean = false
): ItemPricingDetails {
  const pack = getPackSize(item.items_per_package || product?.items_per_package);
  const qty = Number(item.quantity) || 0;
  const rawPrice = Number(item.price) || 0;

  const pVisitorPrice = Number(product?.visitor_price ?? 0);
  const pStorePrice = Number(product?.price ?? 0);

  let unitPrice = 0;

  if (isVisitorOrder) {
    if (pVisitorPrice > 0) {
      unitPrice = pVisitorPrice;
    } else if (rawPrice > 0) {
      if (pStorePrice > 0 && Math.abs(rawPrice - pStorePrice * pack) < Math.abs(rawPrice - pStorePrice)) {
        unitPrice = Math.round(rawPrice / pack);
      } else {
        unitPrice = rawPrice;
      }
    }
  } else {
    if (pStorePrice > 0) {
      if (rawPrice > 0 && Math.abs(rawPrice - pStorePrice * pack) < Math.abs(rawPrice - pStorePrice)) {
        unitPrice = Math.round(rawPrice / pack);
      } else {
        unitPrice = pStorePrice;
      }
    } else if (rawPrice > 0) {
      unitPrice = rawPrice;
    }
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
 * Packaged: "۲ کارتن × ۵۰ عدد × ۳۵٬۰۰۰ = ۳٬۵۰۰٬۰۰۰"
 * Non-packaged: "۲٫۵ کیلوگرم × ۲۰۰٬۰۰۰ = ۵۰۰٬۰۰۰"
 */
export function formatLineCalculation(
  quantity: number,
  pack: number | PackInput,
  unitPrice: number,
  baseUnit: string,
  discountPercent: number = 0
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
    return `${qtyStr} کارتن × ${p.toLocaleString('fa-IR')} ${bu} × ${unitPriceStr} = ${totalStr} تومان`;
  }
  return `${qtyStr} ${bu} × ${unitPriceStr} = ${totalStr} تومان`;
}
