import React, { useState, useMemo } from 'react';
import { InventoryTransaction, Order, Product, Category, Visitor } from '../../types';
import {
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Truck,
  Layers,
  Search,
  Calendar,
} from 'lucide-react';
import {
  isToday,
  isWithinDays,
  formatPrice,
  getVisitorSalesSummaries,
  getCategorySalesSummaries,
} from './helpers';

interface ReportsTabProps {
  inventoryTransactions: InventoryTransaction[];
  orders: Order[];
  products: Product[];
  categories: Category[];
  visitors: Visitor[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  inventoryTransactions,
  orders,
  products,
  categories,
  visitors,
}) => {
  const [activeSubSection, setActiveSubSection] = useState<'inventoryLedger' | 'salesAnalytics'>('inventoryLedger');

  // Ledger Filter states
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [ledgerTimeFilter, setLedgerTimeFilter] = useState<'all' | 'today' | 'week'>('all');
  const [txSearchTerm, setTxSearchTerm] = useState('');

  // 1. Transaction Ledger Filters
  const filteredTransactions = useMemo(() => {
    return inventoryTransactions.filter((tx) => {
      if (txTypeFilter !== 'all' && tx.transaction_type !== txTypeFilter) {
        return false;
      }
      if (ledgerTimeFilter === 'today' && !isToday(tx.created_at)) {
        return false;
      }
      if (ledgerTimeFilter === 'week' && !isWithinDays(tx.created_at, 7)) {
        return false;
      }
      if (txSearchTerm.trim()) {
        const term = txSearchTerm.toLowerCase().trim();
        const matchName = (tx.product_name || tx.product_id).toLowerCase().includes(term);
        const matchRef = tx.reference_id.toLowerCase().includes(term);
        if (!matchName && !matchRef) return false;
      }
      return true;
    });
  }, [inventoryTransactions, txTypeFilter, ledgerTimeFilter, txSearchTerm]);

  // 2. Sales Analytics by Visitor
  const visitorSummaries = useMemo(
    () => getVisitorSalesSummaries(visitors, orders),
    [visitors, orders]
  );

  // 3. Sales Analytics by Category
  const categorySummaries = useMemo(
    () => getCategorySalesSummaries(categories, products, orders),
    [categories, products, orders]
  );

  const txTypeChips = [
    { id: 'all', label: 'همه تراکنش‌ها' },
    { id: 'reserve', label: 'رزرو سفارش جدید' },
    { id: 'release_reserve', label: 'آزادسازی رزرو (تحویل)' },
    { id: 'load_out', label: 'خروج فیزیکی سردخانه' },
    { id: 'return', label: 'مرجوعی به انبار' },
    { id: 'manual_adjustment', label: 'ورود بار به انبار' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubSection('inventoryLedger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubSection === 'inventoryLedger'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>دفتر کل تراکنش‌های انبار</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-950 text-slate-300 text-xs">
              {inventoryTransactions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubSection('salesAnalytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubSection === 'salesAnalytics'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>گزارشات تحلیلی فروش (ویزیتور و دسته)</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: INVENTORY LEDGER */}
      {activeSubSection === 'inventoryLedger' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
            {/* Tx Types */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium ml-1">نوع عملیات:</span>
              {txTypeChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setTxTypeFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    txTypeFilter === chip.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Time & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium ml-1">بازه زمانی:</span>
                <button
                  type="button"
                  onClick={() => setLedgerTimeFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    ledgerTimeFilter === 'all'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  همه
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTimeFilter('today')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    ledgerTimeFilter === 'today'
                      ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  امروز
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTimeFilter('week')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    ledgerTimeFilter === 'week'
                      ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ۷ روز اخیر
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={txSearchTerm}
                  onChange={(e) => setTxSearchTerm(e.target.value)}
                  placeholder="جستجوی نام کالا یا سند حواله..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100">
                دفتر دوبل ورود، خروج و رزروهای زنجیره انبار
              </h3>
              <span className="text-xs text-slate-400">{filteredTransactions.length} تراکنش ثبت شده</span>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                تراکنشی مطابق با فیلتر یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">نام و کد محصول</th>
                      <th className="py-3 px-4 font-semibold">نوع عملیات انبارداری</th>
                      <th className="py-3 px-4 font-semibold">تعداد تغییر یافته</th>
                      <th className="py-3 px-4 font-semibold">سند مرجع / حواله</th>
                      <th className="py-3 px-4 font-semibold">زمان ثبت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTransactions.map((tx) => {
                      const typeMap = {
                        reserve: { label: 'رزرو سفارش جدید', color: 'text-amber-400' },
                        release_reserve: { label: 'آزادسازی رزرو (تحویل)', color: 'text-blue-400' },
                        load_out: { label: 'خروج فیزیکی از سردخانه', color: 'text-rose-400' },
                        return: { label: 'مرجوعی کالا به انبار', color: 'text-emerald-400' },
                        manual_adjustment: { label: 'ورود بار به انبار', color: 'text-cyan-400' },
                      }[tx.transaction_type];

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/35 transition">
                          <td className="py-3 px-4 font-medium text-slate-100">
                            {tx.product_name || tx.product_id}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-bold ${typeMap?.color}`}>
                              {typeMap?.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-100 font-mono">
                            {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono">{tx.reference_id}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono">{tx.created_at}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: SALES ANALYTICS (BY VISITOR & BY CATEGORY) */}
      {activeSubSection === 'salesAnalytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Visitor Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-slate-100">کارنامه و سهم فروش ویزیتورها</h3>
              </div>
              <span className="text-xs text-slate-400">{visitors.length} ویزیتور</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">ویزیتور</th>
                    <th className="py-3 px-4 font-semibold">منطقه</th>
                    <th className="py-3 px-4 font-semibold text-center">تعداد فاکتور</th>
                    <th className="py-3 px-4 font-semibold text-center">تحویل شده</th>
                    <th className="py-3 px-4 font-semibold">مجموع فروش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {visitorSummaries.map((item) => (
                    <tr key={item.visitor.id} className="hover:bg-slate-800/35 transition">
                      <td className="py-3 px-4 font-bold text-slate-100">{item.visitor.name}</td>
                      <td className="py-3 px-4 text-slate-300">{item.visitor.region}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-200">
                        {item.ordersCount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-emerald-400 font-bold">{item.deliveredCount}</span>
                      </td>
                      <td className="py-3 px-4 font-black text-emerald-400">
                        {formatPrice(item.totalSales)}{' '}
                        <span className="text-xs font-normal text-slate-400">تومان</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales by Category Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-slate-100">فروش بر اساس دسته‌بندی کالاها</h3>
              </div>
              <span className="text-xs text-slate-400">{categories.length} دسته‌بندی</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">نام دسته‌بندی</th>
                    <th className="py-3 px-4 font-semibold text-center">تعداد قلم فروخته‌شده</th>
                    <th className="py-3 px-4 font-semibold">مجموع گردش مالی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {categorySummaries.map((cat) => (
                    <tr key={cat.category.id} className="hover:bg-slate-800/35 transition">
                      <td className="py-3 px-4 font-bold text-slate-100">{cat.category.name}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-200">
                        {formatPrice(cat.itemsSold)}
                      </td>
                      <td className="py-3 px-4 font-black text-emerald-400">
                        {formatPrice(cat.totalSales)}{' '}
                        <span className="text-xs font-normal text-slate-400">تومان</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
