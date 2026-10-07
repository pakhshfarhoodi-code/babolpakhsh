import { Order, Product, Supermarket, Visitor, Category } from '../../types';

export const LOW_STOCK_THRESHOLD = 20;

import {
  getTodayJalali as getTodayJalaliUtil,
  getTehranDateParts,
  isTodayInTehran,
  isWithinDaysInTehran,
  formatOrderDate as formatOrderDateUtil,
  toEnglishDigits as toEngDigits,
  jalaliToDayCount as jalaliDays,
} from '../../utils/dateUtils';

export const toEnglishDigits = toEngDigits;
export const jalaliToDayCount = jalaliDays;

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

export const getTodayJalali = (): JalaliDateParts => {
  return getTodayJalaliUtil();
};

export const parseJalaliDate = (dateStr?: string): JalaliDateParts | null => {
  if (!dateStr) return null;
  const parts = getTehranDateParts(dateStr);
  if (!parts) return null;
  return { year: parts.year, month: parts.month, day: parts.day };
};

export const isToday = (dateStr?: string): boolean => {
  return isTodayInTehran(dateStr);
};

export const isWithinDays = (dateStr: string | undefined, daysLimit: number): boolean => {
  return isWithinDaysInTehran(dateStr, daysLimit);
};

export const formatPrice = (price: number): string => {
  return price.toLocaleString('fa-IR');
};

export const formatOrderDate = (dateStr?: string): string => {
  return formatOrderDateUtil(dateStr);
};

// Check if a store had no orders in last 30 days
export const isStoreInactiveFor30Days = (supermarketId: string, orders: Order[]): boolean => {
  const storeOrders = orders.filter((o) => o.supermarket_id === supermarketId);
  if (storeOrders.length === 0) return true;
  
  // Find the latest order date
  const hasRecentOrder = storeOrders.some((o) => isWithinDays(o.order_date, 30));
  return !hasRecentOrder;
};

// Aggregate sales by visitor
export interface VisitorSalesSummary {
  visitor: Visitor;
  totalSales: number;
  ordersCount: number;
  deliveredCount: number;
}

export const getVisitorSalesSummaries = (visitors: Visitor[], orders: Order[]): VisitorSalesSummary[] => {
  const list: VisitorSalesSummary[] = visitors.map((v) => {
    const vOrders = orders.filter((o) => o.assigned_visitor_id === v.id);
    const validOrders = vOrders.filter((o) => o.status !== 'undelivered');
    const totalSales = validOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const deliveredCount = vOrders.filter((o) => o.status === 'delivered').length;

    return {
      visitor: v,
      totalSales,
      ordersCount: vOrders.length,
      deliveredCount,
    };
  });

  const directOrders = orders.filter(
    (o) =>
      o.assigned_visitor_id === 'direct' ||
      !o.assigned_visitor_id ||
      o.visitor_name?.includes('مستقیم')
  );

  if (directOrders.length > 0) {
    const validDirect = directOrders.filter((o) => o.status !== 'undelivered');
    const totalDirectSales = validDirect.reduce((sum, o) => sum + o.total_amount, 0);
    const deliveredDirectCount = directOrders.filter((o) => o.status === 'delivered').length;

    list.unshift({
      visitor: {
        id: 'direct',
        name: 'پخش مرکزی (خرید مستقیم)',
        phone: '---',
        region: 'مرکزی',
        is_active: true,
      },
      totalSales: totalDirectSales,
      ordersCount: directOrders.length,
      deliveredCount: deliveredDirectCount,
    });
  }

  return list.sort((a, b) => b.totalSales - a.totalSales);
};

// Aggregate sales by product category
export interface CategorySalesSummary {
  category: Category;
  totalSales: number;
  itemsSold: number;
}

import { getItemUnitPriceAndTotal } from '../../utils/orderLine';

export const getCategorySalesSummaries = (
  categories: Category[],
  products: Product[],
  orders: Order[]
): CategorySalesSummary[] => {
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  const catSalesMap = new Map<string, { totalSales: number; itemsSold: number }>();
  categories.forEach((c) => catSalesMap.set(c.id, { totalSales: 0, itemsSold: 0 }));

  orders
    .filter((o) => o.status !== 'undelivered')
    .forEach((order) => {
      const isVisitorOrder =
        order.order_channel === 'visitor_field' ||
        order.order_source === 'visitor' ||
        Boolean(order.assigned_visitor_id && order.assigned_visitor_id !== 'direct');

      order.items?.forEach((item) => {
        const prod = productMap.get(item.product_id);
        const catId = prod?.category_id;
        if (catId && catSalesMap.has(catId)) {
          const { pack, total } = getItemUnitPriceAndTotal(item, prod, isVisitorOrder);
          const current = catSalesMap.get(catId)!;
          current.totalSales += total;
          current.itemsSold += item.quantity * pack;
        }
      });
    });

  return categories.map((cat) => {
    const data = catSalesMap.get(cat.id) || { totalSales: 0, itemsSold: 0 };
    return {
      category: cat,
      totalSales: data.totalSales,
      itemsSold: data.itemsSold,
    };
  }).sort((a, b) => b.totalSales - a.totalSales);
};
