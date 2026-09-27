import { Category, Product, Visitor, Supermarket, Profile, Order, LoadingBill, InventoryTransaction } from '../types';

export const INITIAL_PROFILES: Profile[] = [
  { id: 'admin-1', name: 'مدیریت مرکزی فرهودی (بارفروش)', role: 'admin', username: 'admin', password: '123', phone: '۰۹۱۲۰۰۰۰۰۰۰' },
  { id: 'wh-1', name: 'انباردار مرکزی فرهودی', role: 'warehouse', username: 'warehouse', password: '123', phone: '۰۹۱۲۱۱۱۰۰۰۰' },
  { id: 'vis-1', name: 'علیرضا رضایی', role: 'visitor', username: 'visitor1', password: '123', phone: '۰۹۱۲۳۴۵۶۷۸۹' },
  { id: 'vis-2', name: 'مریم حسینی', role: 'visitor', username: 'visitor2', password: '123', phone: '۰۹۱۹۸۷۶۵۴۳۲' },
  { id: 'vis-3', name: 'محمد کریمی', role: 'visitor', username: 'visitor3', password: '123', phone: '۰۹۱۸۲۲۲۳۳۴۴' },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'بستنی و پالپ', icon: 'IceCream', sort_order: 1 },
  { id: 'cat-2', name: 'محصولات منجمد و پروتئینی', icon: 'Beef', sort_order: 2 },
  { id: 'cat-3', name: 'لبنیات زنجیره سرد', icon: 'Milk', sort_order: 3 },
  { id: 'cat-4', name: 'نوشیدنی خنک', icon: 'CupSoda', sort_order: 4 },
  { id: 'cat-5', name: 'کیک و تنقلات سوپرمارکتی', icon: 'Cookie', sort_order: 5 },
];

export const INITIAL_BRANDS: string[] = [
  'میهن',
  'دومینو',
  'کاله',
  'سن‌ایچ',
  'پاک',
  'دمس',
  'سولیکو',
  'ب آ',
  'پامچال',
  'دامداران',
  'عالیس',
  'آناتا',
  'شیرین عسل',
];

// Default empty arrays ready for production data
export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_VISITORS: Visitor[] = [
  { id: 'vis-1', name: 'علیرضا رضایی', username: 'visitor1', phone: '۰۹۱۲۳۴۵۶۷۸۹', region: 'منطقه ۱ (شمال تهران)', is_active: true },
  { id: 'vis-2', name: 'مریم حسینی', username: 'visitor2', phone: '۰۹۱۹۸۷۶۵۴۳۲', region: 'منطقه ۲ (غرب تهران)', is_active: true },
  { id: 'vis-3', name: 'محمد کریمی', username: 'visitor3', phone: '۰۹۱۸۲۲۲۳۳۴۴', region: 'منطقه ۳ (شرق تهران)', is_active: true },
];

export const INITIAL_SUPERMARKETS: Supermarket[] = [];

export const getRelativeJalaliDate = (daysAgo: number = 0, timeStr = '10:30') => {
  try {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return `${parts} ${timeStr}`;
  } catch {
    return `1403/07/01 ${timeStr}`;
  }
};

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_LOADING_BILLS: LoadingBill[] = [];

export const INITIAL_INVENTORY_TRANSACTIONS: InventoryTransaction[] = [];
