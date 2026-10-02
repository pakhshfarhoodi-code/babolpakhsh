import { Category, Product, Visitor, Supermarket, Profile, Order, LoadingBill, InventoryTransaction } from '../types';

export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'admin-farhoodi',
    name: 'مدیریت ارشد شبکه پخش فرهودی',
    role: 'admin',
    phone: '09120000000',
    username: 'pakhshfarhoodi@gmail.com',
  },
  {
    id: 'admin-main',
    name: 'مدیریت ارشد سامانه',
    role: 'admin',
    phone: '09120000001',
    username: 'admin',
  },
  {
    id: 'warehouse-main',
    name: 'انباردار مرکزی',
    role: 'warehouse',
    phone: '09120000002',
    username: 'warehouse',
  },
];

export const INITIAL_CATEGORIES: Category[] = [];

export const INITIAL_BRANDS: string[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_VISITORS: Visitor[] = [];

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
