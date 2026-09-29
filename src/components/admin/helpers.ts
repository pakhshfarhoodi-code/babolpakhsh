import { Order, Product, Supermarket, Visitor, Category } from '../../types';

export const LOW_STOCK_THRESHOLD = 20;

// Convert Persian digits to English digits
export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

export const getTodayJalali = (): JalaliDateParts => {
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()).split(/[\/\-]/);
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
    };
  } catch {
    return { year: 1403, month: 7, day: 1 };
  }
};

export const parseJalaliDate = (dateStr?: string): JalaliDateParts | null => {
  if (!dateStr) return null;

  // 1. Check if dateStr is an ISO 8601 or Gregorian timestamp (from Supabase or toISOString)
  if (dateStr.includes('T') || (dateStr.startsWith('20') && !isNaN(Date.parse(dateStr)))) {
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      try {
        const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(parsedDate).split(/[\/\-]/);
        return {
          year: parseInt(parts[0], 10),
          month: parseInt(parts[1], 10),
          day: parseInt(parts[2], 10),
        };
      } catch {
        // fallback
      }
    }
  }

  // 2. Otherwise parse as Jalali string
  const norm = toEnglishDigits(dateStr);
  const match = norm.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
  };
};

export const jalaliToDayCount = (y: number, m: number, d: number): number => {
  let days = y * 365 + Math.floor((y * 682 - 110) / 2816);
  if (m <= 6) {
    days += (m - 1) * 31;
  } else {
    days += 6 * 31 + (m - 7) * 30;
  }
  days += d;
  return days;
};

export const isToday = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const parsed = parseJalaliDate(dateStr);
  if (!parsed) return false;
  const today = getTodayJalali();
  return (
    parsed.year === today.year &&
    parsed.month === today.month &&
    parsed.day === today.day
  );
};

export const isWithinDays = (dateStr: string | undefined, daysLimit: number): boolean => {
  if (!dateStr) return false;
  const parsed = parseJalaliDate(dateStr);
  if (!parsed) return false;
  const today = getTodayJalali();
  const orderDays = jalaliToDayCount(parsed.year, parsed.month, parsed.day);
  const todayDays = jalaliToDayCount(today.year, today.month, today.day);
  const diff = todayDays - orderDays;
  return diff >= 0 && diff <= daysLimit;
};

export const formatPrice = (price: number): string => {
  return price.toLocaleString('fa-IR');
};

export const formatOrderDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('T') || (dateStr.startsWith('20') && !isNaN(Date.parse(dateStr)))) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    }
  }
  return dateStr;
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

export const getCategorySalesSummaries = (
  categories: Category[],
  products: Product[],
  orders: Order[]
): CategorySalesSummary[] => {
  const productCatMap = new Map<string, string>();
  products.forEach((p) => productCatMap.set(p.id, p.category_id));

  const catSalesMap = new Map<string, { totalSales: number; itemsSold: number }>();
  categories.forEach((c) => catSalesMap.set(c.id, { totalSales: 0, itemsSold: 0 }));

  orders
    .filter((o) => o.status !== 'undelivered')
    .forEach((order) => {
      order.items?.forEach((item) => {
        const catId = productCatMap.get(item.product_id);
        if (catId && catSalesMap.has(catId)) {
          const current = catSalesMap.get(catId)!;
          current.totalSales += item.price * item.quantity;
          current.itemsSold += item.quantity;
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
