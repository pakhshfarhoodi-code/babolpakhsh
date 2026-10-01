import React, { useMemo } from 'react';
import { Order, Product, Supermarket, LoadingBill } from '../../types';
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  Store,
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  Users,
  CheckCircle2,
  UserCheck,
  Truck,
  Clock,
  FileCheck,
  FileText,
} from 'lucide-react';
import {
  LOW_STOCK_THRESHOLD,
  isToday,
  isStoreInactiveFor30Days,
  formatPrice,
} from './helpers';
import { getBillAgeInfo } from './LoadingBillsTab';

interface OverviewTabProps {
  orders: Order[];
  products: Product[];
  supermarkets: Supermarket[];
  loadingBills?: LoadingBill[];
  onNavigateToOrders: (statusFilter?: string) => void;
  onNavigateToProducts: (filterType?: 'lowStock') => void;
  onNavigateToTeam: () => void;
  onNavigateToLoadingBills?: (statusFilter?: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  orders,
  products,
  supermarkets,
  loadingBills = [],
  onNavigateToOrders,
  onNavigateToProducts,
  onNavigateToTeam,
  onNavigateToLoadingBills,
}) => {
  // 1. Action Items
  // A. Delegated orders
  const delegatedOrders = useMemo(
    () => orders.filter((o) => o.status === 'delegated'),
    [orders]
  );

  // B. Low stock products (free stock < threshold)
  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock - p.reserved_stock < LOW_STOCK_THRESHOLD),
    [products]
  );

  // C. Inactive supermarkets in last 30 days
  const inactiveStores = useMemo(
    () => supermarkets.filter((s) => s.is_active !== false && isStoreInactiveFor30Days(s.id, orders)),
    [supermarkets, orders]
  );

  // D. Pending new supermarket registrations waiting for approval
  const pendingRegistrations = useMemo(
    () => supermarkets.filter((s) => s.is_active === false),
    [supermarkets]
  );

  // E. Pending loading bills awaiting warehouse approval
  const pendingBills = useMemo(
    () => (loadingBills || []).filter((b) => b.status === 'pending'),
    [loadingBills]
  );

  const oldestPendingBill = useMemo(() => {
    if (pendingBills.length === 0) return null;
    return [...pendingBills].sort((a, b) => {
      const timeA = Date.parse(a.created_at) || 0;
      const timeB = Date.parse(b.created_at) || 0;
      return timeA - timeB;
    })[0];
  }, [pendingBills]);

  const oldestAgeInfo = useMemo(() => {
    if (!oldestPendingBill) return null;
    return getBillAgeInfo(oldestPendingBill.created_at);
  }, [oldestPendingBill]);

  // 2. Standard 3 KPIs
  const totalRevenue = useMemo(
    () => orders.filter((o) => o.status !== 'undelivered').reduce((sum, o) => sum + o.total_amount, 0),
    [orders]
  );

  const todayOrdersCount = useMemo(
    () => orders.filter((o) => isToday(o.order_date)).length,
    [orders]
  );

  const activeSupermarketsCount = useMemo(() => {
    const storeIdsWithOrders = new Set(orders.map((o) => o.supermarket_id));
    return supermarkets.filter((s) => storeIdsWithOrders.has(s.id)).length;
  }, [orders, supermarkets]);

  const totalActionItems =
    delegatedOrders.length +
    lowStockProducts.length +
    inactiveStores.length +
    pendingBills.length;

  return (
    <div className="space-y-6">
      {/* 3 Standard KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Total Revenue (Toman) */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">فروش کل سامانه (تومان)</p>
            <p className="text-xl sm:text-2xl font-black text-slate-100 mt-1">
              {formatPrice(totalRevenue)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">مجموع فاکتورهای معتبر</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Today's Orders Count */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">سفارش‌های ثبت‌شده امروز</p>
            <p className="text-xl sm:text-2xl font-black text-blue-400 mt-1">
              {todayOrdersCount}{' '}
              <span className="text-xs font-normal text-slate-400">سفارش</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">در گردش توزیع مویرگی</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Active Supermarkets */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">مشتریان فعال (دارای سفارش)</p>
            <p className="text-xl sm:text-2xl font-black text-purple-400 mt-1">
              {activeSupermarketsCount}{' '}
              <span className="text-xs font-normal text-slate-400">
                از {supermarkets.length} فروشگاه
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">شبکه فعال خرده‌فروشی</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Action Required Banner / Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>موارد نیازمند اقدام فوری ادمین</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            سفارش‌ها و کالاهایی که زنجیره پخش در آنها به رسیدگی یا تصمیم مدیریت نیاز دارد
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {totalActionItems} مورد باز
        </span>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Action 0: Supermarkets List */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-purple-500/50 transition shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-purple-300 border border-slate-700">
                {supermarkets.length}
              </span>
            </div>

            <h3 className="font-bold text-sm text-slate-200">شبکه مشتریان و فروشگاه‌ها</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              فهرست کامل فروشگاه‌ها و سوپرمارکت‌های طرف قرارداد. تمام ثبت‌نام‌های جدید بلافاصله فعال شده و امکان سفارش‌دهی دارند.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToTeam}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          >
            <span>مدیریت فروشگاه‌ها و ویزیتورها</span>
            <ArrowLeft className="w-4 h-4 text-purple-400" />
          </button>
        </div>

        {/* Action: Pending Loading Bills (Only shown if pendingBills.length > 0) */}
        {pendingBills.length > 0 && oldestPendingBill && oldestAgeInfo && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/40 flex flex-col justify-between space-y-4 hover:border-amber-500/80 transition shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {pendingBills.length} فاکتور منتظر شما
                </span>
              </div>

              <h3 className="font-bold text-sm text-slate-100">{pendingBills.length} فاکتور منتظر شما</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                فاکتورهای ارسالی ویزیتورها منتظر بررسی اقلام، اعمال توافقات و تایید نهایی هستند.
              </p>

              <div className="pt-1">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    oldestAgeInfo.isOverdue
                      ? 'bg-rose-950/60 text-rose-300 border-rose-800/60 font-bold'
                      : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>قدیمی‌ترین: {oldestAgeInfo.formattedText}</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToLoadingBills?.('pending')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <span>بررسی فاکتورهای ویزیتورها</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action 1: Delegated Orders */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                  delegatedOrders.length > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {delegatedOrders.length} سفارش
              </span>
            </div>

            <h3 className="font-bold text-sm text-slate-200">سفارش‌های معلق در واگذاری</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              این سفارش‌ها توسط ویزیتور اول واگذار شده اما هنوز توسط همکار دیگر یا تایید انبار پذیرفته نشده‌اند.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToOrders('delegated')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <span>مشاهده سفارش‌های معلق</span>
            <ArrowLeft className="w-4 h-4 text-amber-400" />
          </button>
        </div>

        {/* Action 2: Low Stock Products */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-rose-500/40 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <Boxes className="w-5 h-5" />
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                  lowStockProducts.length > 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {lowStockProducts.length} کالا
              </span>
            </div>

            <h3 className="font-bold text-sm text-slate-200">کالاهای کم‌موجود و رو به اتمام</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              موجودی آزاد این اقلام کمتر از آستانه استاندارد ({LOW_STOCK_THRESHOLD} واحد) است و خطر کسری بارگیری دارند.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToProducts('lowStock')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <span>بررسی موجودی و نرخ‌گذاری</span>
            <ArrowLeft className="w-4 h-4 text-rose-400" />
          </button>
        </div>

        {/* Action 3: Inactive Supermarkets (30 Days) */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Store className="w-5 h-5" />
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                  inactiveStores.length > 0
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {inactiveStores.length} فروشگاه
              </span>
            </div>

            <h3 className="font-bold text-sm text-slate-200">فروشگاه‌های راکد (۳۰ روز اخیر)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              مغازه‌دارانی که در ۳۰ روز گذشته خریدی ثبت نکرده‌اند و نیازمند پیگیری تلفنی یا ویزیت حضوری مجدد هستند.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToTeam}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <span>مدیریت تیم و مشتریان</span>
            <ArrowLeft className="w-4 h-4 text-blue-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
