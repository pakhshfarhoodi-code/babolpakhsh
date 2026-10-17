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

import { getProductDiscountPercent } from './storeDiscount';

export const PACKAGE_WORDS = ['کارتن', 'جعبه', 'بسته', 'پک', 'باکس'];

export const CONTENT_UNIT_WORDS = [
  'عدد', 'دانه', 'تکه', 'کیلوگرم', 'کیلو', 'گرم', 'لیتر', 'میلی‌لیتر', 'متر',
];

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

export function isPackaged(x: PackInput): boolean {
  return getPackSize(x) > 1;
}

export function getBaseUnit(unit?: string | null, pack?: number | PackInput): string {
  const p = typeof pack === 'number' ? pack : getPackSize(pack);
  const u = (unit || '').trim();
  if (p > 1 && (!u || isContainerUnit(u))) {
    return 'عدد';
  }
  return u || 'عدد';
}

export function getSaleUnitLabel(unit?: string | null, pack?: number | PackInput): string {
  const p = typeof pack === 'number' ? pack : getPackSize(pack);
  if (p > 1) {
    return isContainerUnit(unit) ? (unit as string).trim() : 'کارتن';
  }
  return getBaseUnit(unit, p);
}

export function getUnitColumnText(pack: number | PackInput, baseUnit: string): string {
  const p = typeof pack === 'number' ? pack : getPackSize(pack);
  const bu = baseUnit || 'عدد';
  if (p > 1) {
    return `${p.toLocaleString('fa-IR')} ${bu}`;
  }
  return bu;
}

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

export function getUnitPriceFromOrderItem(
  item: {
    price: number;
    items_per_package?: number | string | null;
  },
  product?: { price?: number; visitor_price?: number; items_per_package?: number } | null,
  isVisitorOrder: boolean = false,
  useOrderPrice: boolean = false
): number {
  const pack = getPackSize(item.items_per_package || product?.items_per_package);
  const rawPrice = Number(item.price || 0);

  if (useOrderPrice) {
    return pack > 1 ? Math.round(rawPrice / pack) : rawPrice;
  }

  const pVisitorPrice = Number(product?.visitor_price ?? 0);
  const pStorePrice = Number(product?.price ?? 0);
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
  isVisitorOrder: boolean = false,
  useOrderPrice: boolean = false
): ItemPricingDetails {
  const pack = getPackSize(item.items_per_package || product?.items_per_package);
  const qty = Number(item.quantity) || 0;
  const rawPrice = Number(item.price) || 0;

  if (useOrderPrice) {
    const unitPrice = pack > 1 ? Math.round(rawPrice / pack) : rawPrice;
    const cartonPrice = Math.round(unitPrice * pack);
    const total = Math.round(qty * pack * unitPrice);
    return { pack, unitPrice, cartonPrice, total };
  }

  const pVisitorPrice = Number(product?.visitor_price ?? 0);
  const pStorePrice = Number(product?.price ?? 0);
  const hasRealRaw = rawPrice > 1;

  const refPrice = isVisitorOrder
    ? (pVisitorPrice > 1 ? pVisitorPrice : (pStorePrice > 1 ? pStorePrice : 0))
    : (pStorePrice > 1 ? pStorePrice : 0);

  let unitPrice = 0;

  if (hasRealRaw) {
    if (pack <= 1) {
      unitPrice = rawPrice;
    } else if (refPrice > 0 && Math.abs(rawPrice - refPrice) < Math.abs(rawPrice - refPrice * pack)) {
      unitPrice = rawPrice;
    } else {
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
  itemDiscountPercent?: number;
  discountPercent?: number;
}

export interface ComputeLineResult {
  itemDiscountedUnitPrice: number;
  discountedUnitPrice: number;
  total: number;
}

/**
 * Standard stepwise line calculation:
 * itemDiscountedUnitPrice = round(unitPrice * (100 - itemDiscountPercent) / 100)
 * discountedUnitPrice = round(itemDiscountedUnitPrice * (100 - orderDiscountPercent) / 100)
 * total = qty * pack * discountedUnitPrice
 */
export function computeLine({
  quantity,
  pack,
  unitPrice,
  itemDiscountPercent = 0,
  discountPercent = 0,
}: ComputeLineParams): ComputeLineResult {
  const safeQty = Number(quantity) || 0;
  const safePack = getPackSize(pack);
  const safeUnitPrice = Number(unitPrice) || 0;
  const safeItemDisc = Math.max(0, Math.min(100, Number(itemDiscountPercent) || 0));
  const safeOrderDisc = Math.max(0, Math.min(100, Number(discountPercent) || 0));

  const itemDiscountedUnitPrice = Math.round((safeUnitPrice * (100 - safeItemDisc)) / 100);
  const discountedUnitPrice = Math.round((itemDiscountedUnitPrice * (100 - safeOrderDisc)) / 100);
  const total = Math.round(safeQty * safePack * discountedUnitPrice);

  return {
    itemDiscountedUnitPrice,
    discountedUnitPrice,
    total,
  };
}

export function formatLineCalculation(
  quantity: number,
  pack: number | PackInput,
  unitPrice: number,
  baseUnit: string,
  discountPercent: number = 0,
  saleUnit: string = 'کارتن',
  itemDiscountPercent: number = 0
): string {
  const p = getPackSize(pack);
  const { discountedUnitPrice, total } = computeLine({
    quantity,
    pack: p,
    unitPrice,
    itemDiscountPercent,
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
    discount_percent?: number | null;
  }> | null;
  supermarket_id?: string | null;
  customer_type?: string | null;
  consumer_savings?: number | null;
  total_amount?: number | null;
  pickup_discount_percent?: number | null;
  founder_discount_percent?: number | null;
  discount_status?: string | null;
  discount_percent?: number | null;
}

export interface OrderPricingResult {
  isVisitorOrder: boolean;
  isConsumerOrder: boolean;
  consumerSavings: number;
  pickupPercent: number;
  founderPercent: number;
  manualPercent: number;
  totalDiscountPercent: number;
  subtotal: number;
  discountedSubtotal: number;
  itemDiscountedSubtotal: number;
  productDiscountAmount: number;
  orderDiscountAmount: number;
  totalDiscountAmount: number;
  totalDiscountEffectivePercent: number;
}

export function getOrderPricing(
  order: OrderPricingInput,
  products: Array<{ id: string; name?: string; price?: number; visitor_price?: number; items_per_package?: number; discount_percent?: number; discount_starts_at?: string | null; discount_ends_at?: string | null }>
): OrderPricingResult {
  const items = order.items || [];
  const isConsumerOrder = order.customer_type === 'consumer';
  const isVisitorOrder = !isConsumerOrder && Boolean(order.supermarket_id?.startsWith('self-'));

  const pickupPercent = isConsumerOrder ? 0 : (order.pickup_discount_percent || 0);
  const founderPercent = isConsumerOrder ? 0 : (order.founder_discount_percent || 0);
  const manualPercent = isConsumerOrder ? 0 : (order.discount_status === 'approved' ? (order.discount_percent || 0) : 0);
  const totalDiscountPercent = isConsumerOrder ? 0 : Math.min(100, Math.max(0, pickupPercent + founderPercent + manualPercent));
  const consumerSavings = isConsumerOrder ? Number(order.consumer_savings || 0) : 0;

  let rawSubtotal = 0;
  let itemDiscSubtotal = 0;
  let finalDiscSubtotal = 0;

  for (const item of items) {
    const product = findProductMatch(item, products);
    const { pack, unitPrice, total } = getItemUnitPriceAndTotal(item, product, isVisitorOrder, isConsumerOrder);
    
    const rawItemDisc = isConsumerOrder || isVisitorOrder ? 0 : (item.discount_percent ?? (product ? getProductDiscountPercent(product) : 0));
    const itemPercent = Math.max(0, Math.min(100, Number(rawItemDisc) || 0));

    rawSubtotal += total;

    const lineRes = computeLine({
      quantity: Number(item.quantity) || 0,
      pack,
      unitPrice,
      itemDiscountPercent: itemPercent,
      discountPercent: totalDiscountPercent,
    });

    itemDiscSubtotal += Math.round((Number(item.quantity) || 0) * pack * lineRes.itemDiscountedUnitPrice);
    finalDiscSubtotal += lineRes.total;
  }

  const subtotal = rawSubtotal > 0 ? (isConsumerOrder ? (rawSubtotal + consumerSavings) : rawSubtotal) : Number(order.total_amount || 0);
  const itemDiscountedSubtotal = rawSubtotal > 0 ? itemDiscSubtotal : subtotal;
  const discountedSubtotal = rawSubtotal > 0 ? finalDiscSubtotal : (isConsumerOrder ? subtotal : Math.round(subtotal * (1 - totalDiscountPercent / 100)));

  const productDiscountAmount = Math.max(0, subtotal - itemDiscountedSubtotal);
  const orderDiscountAmount = Math.max(0, itemDiscountedSubtotal - discountedSubtotal);
  const totalDiscountAmount = isConsumerOrder ? consumerSavings : Math.max(0, subtotal - discountedSubtotal);
  const totalDiscountEffectivePercent = subtotal > 0 ? Number((totalDiscountAmount / subtotal * 100).toFixed(1)) : 0;

  return {
    isVisitorOrder,
    isConsumerOrder,
    consumerSavings,
    pickupPercent,
    founderPercent,
    manualPercent,
    totalDiscountPercent,
    subtotal,
    discountedSubtotal,
    itemDiscountedSubtotal,
    productDiscountAmount,
    orderDiscountAmount,
    totalDiscountAmount,
    totalDiscountEffectivePercent,
  };
}

export function splitDiscountAmounts(p: OrderPricingResult): { product: number; pickup: number; founder: number; manual: number } {
  const totalOrderDiscount = Math.max(0, p.orderDiscountAmount);
  const active: Array<['pickup' | 'founder' | 'manual', number]> = [];
  if (p.pickupPercent > 0) active.push(['pickup', p.pickupPercent]);
  if (p.founderPercent > 0) active.push(['founder', p.founderPercent]);
  if (p.manualPercent > 0) active.push(['manual', p.manualPercent]);

  const out = { product: p.productDiscountAmount, pickup: 0, founder: 0, manual: 0 };
  if (active.length === 0 || totalOrderDiscount === 0) return out;

  const sumPct = active.reduce((a, [, pct]) => a + pct, 0);
  let allocated = 0;
  active.forEach(([key, pct], i) => {
    if (i === active.length - 1) {
      out[key] = totalOrderDiscount - allocated;
    } else {
      const part = Math.round((totalOrderDiscount * pct) / sumPct);
      out[key] = part;
      allocated += part;
    }
  });
  return out;
}
