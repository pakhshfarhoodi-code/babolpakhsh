import { LoadingBill, Product } from '../../types';

export const LOW_STOCK_THRESHOLD = 20;

export interface AggregatedBillItem {
  productId: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  currentStock: number;
  availableStock: number;
  isShortage: boolean;
}

/**
 * Aggregates loading bill items across orders by productId
 * and checks current inventory levels for shortages.
 */
export function aggregateBillItems(
  bill: LoadingBill,
  products: Product[]
): AggregatedBillItem[] {
  const itemMap = new Map<string, { productName: string; totalQuantity: number }>();

  if (bill.items) {
    for (const item of bill.items) {
      const existing = itemMap.get(item.product_id);
      if (existing) {
        existing.totalQuantity += item.quantity;
      } else {
        itemMap.set(item.product_id, {
          productName: item.product_name,
          totalQuantity: item.quantity,
        });
      }
    }
  }

  const result: AggregatedBillItem[] = [];

  for (const [productId, val] of itemMap.entries()) {
    const product = products.find((p) => p.id === productId);
    const currentStock = product ? product.stock : 0;
    const reservedStock = product ? product.reserved_stock : 0;
    const availableStock = currentStock - reservedStock;

    // A shortage occurs if total physical stock is less than required by the bill
    const isShortage = currentStock < val.totalQuantity;

    result.push({
      productId,
      productName: val.productName,
      totalQuantity: val.totalQuantity,
      unit: product?.unit || 'واحد',
      currentStock,
      availableStock,
      isShortage,
    });
  }

  return result;
}

export function formatNumber(num: number): string {
  return num.toLocaleString('fa-IR');
}
