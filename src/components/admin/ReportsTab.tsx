import React, { useState, useMemo } from 'react';
import { InventoryTransaction, Order, Product, Category, Visitor, LoadingBill } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Truck,
  Layers,
  Search,
  Calendar,
  Package,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  isToday,
  isWithinDays,
  formatPrice,
  getVisitorSalesSummaries,
  getCategorySalesSummaries,
} from './helpers';
import { SupplementaryReports } from './SupplementaryReports';
import { getPackSize } from '../../utils/orderLine';

interface ReportsTabProps {
  inventoryTransactions: InventoryTransaction[];
  orders: Order[];
  products: Product[];
  categories: Category[];
  visitors: Visitor[];
  loadingBills?: LoadingBill[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  inventoryTransactions,
  orders,
  products,
  categories,
  visitors,
  loadingBills = [],
}) => {
  const { deleteInventoryTransactions } = useApp();
  const [activeSubSection, setActiveSubSection] = useState<'loadingBills' | 'inventoryLedger' | 'salesAnalytics'>('loadingBills');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  // Ledger Filter & Selection states
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [ledgerTimeFilter, setLedgerTimeFilter] = useState<'all' | 'today' | 'week'>('all');
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isDeletingTx, setIsDeletingTx] = useState(false);
  const [ledgerFeedback, setLedgerFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const isAllFilteredSelected = useMemo(() => {
    if (filteredTransactions.length === 0) return false;
    return filteredTransactions.every((tx) => selectedTxIds.includes(tx.id));
  }, [filteredTransactions, selectedTxIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredSet = new Set(filteredTransactions.map((t) => t.id));
      setSelectedTxIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const allFilteredIds = filteredTransactions.map((t) => t.id);
      setSelectedTxIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedTx = async () => {
    if (selectedTxIds.length === 0) return;
    setIsDeletingTx(true);
    setLedgerFeedback(null);
    try {
      const count = selectedTxIds.length;
      const res = await deleteInventoryTransactions(selectedTxIds);
      if (res.success) {
        setSelectedTxIds([]);
        setLedgerFeedback({
          type: 'success',
          message: `${count} تراکنش با موفقیت از دفتر کل انبار حذف گردید.`,
        });
      } else {
        setLedgerFeedback({ type: 'error', message: res.message });
      }
    } catch {
      setLedgerFeedback({ type: 'error', message: 'خطا در حذف تراکنش‌های انتخابی.' });
    } finally {
      setIsDeletingTx(false);
      setTimeout(() => setLedgerFeedback(null), 3500);
    }
  };

  const handleDeleteSingleTx = async (id: string) => {
    setIsDeletingTx(true);
    setLedgerFeedback(null);
    try {
      const res = await deleteInventoryTransactions([id]);
      if (res.success) {
        setSelectedTxIds((prev) => prev.filter((i) => i !== id));
        setLedgerFeedback({
          type: 'success',
          message: 'تراکنش با موفقیت از دفتر کل حذف شد.',
        });
      } else {
        setLedgerFeedback({ type: 'error', message: res.message });
      }
    } catch {
      setLedgerFeedback({ type: 'error', message: 'خطا در حذف تراکنش.' });
    } finally {
      setIsDeletingTx(false);
      setTimeout(() => setLedgerFeedback(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubSection('loadingBills')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubSection === 'loadingBills'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>حواله‌های بارگیری ویزیتورها</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-950 text-slate-300 text-xs">
              {loadingBills.length}
            </span>
          </button>

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

      {/* SECTION 0: LOADING BILLS WITH DUAL PRICING (VISITOR COST VS STORE PRICE) */}
      {activeSubSection === 'loadingBills' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>حواله‌های تجمیعی بارگیری ویزیتورها</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                فهرست فاکتورهای ترخیص و بارگیری ویزیتورها و وضعیت حواله‌ها
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-950 border border-blue-800 text-blue-300">
              {loadingBills.length} حواله ثبت شده
            </span>
          </div>

          {loadingBills.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
              هنوز حواله بارگیری تجمیعی توسط ویزیتورها صادر نگردیده است.
            </div>
          ) : (
            <div className="space-y-3">
              {loadingBills.map((bill) => {
                const isExpanded = expandedBillId === bill.id;

                // Compute total visitor buy cost
                let totalVisitorBuyCost = bill.total_visitor_cost ?? 0;
                let totalItemsCount = 0;

                const billItems = bill.items || [];
                const needsRecalc = !bill.total_visitor_cost;
                if (needsRecalc) {
                  totalVisitorBuyCost = 0;
                }

                billItems.forEach((it) => {
                  totalItemsCount += it.quantity;
                  if (needsRecalc) {
                    const prod = products.find((p) => p.id === it.product_id);
                    const fallbackStorePrice = prod?.price || 0;
                    const storePrice = it.store_price ?? fallbackStorePrice;
                    const visitorPrice = it.visitor_price ?? (prod?.visitor_price ?? 0);
                    const pack = getPackSize(it.items_per_package || prod?.items_per_package);

                    totalVisitorBuyCost += visitorPrice * pack * it.quantity;
                  }
                });

                return (
                  <div
                    key={bill.id}
                    className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm"
                  >
                    {/* Header summary bar */}
                    <div
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-bold text-xs text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/60">
                          {bill.id}
                        </span>
                        <div>
                          <p className="font-bold text-xs text-slate-100">{bill.visitor_name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">تاریخ: {bill.created_at}</p>
                        </div>
                      </div>

                      {/* Financial indicators for Admin */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {/* 1. Total Visitor Purchase Cost */}
                        <div className="p-2 rounded-xl bg-blue-950/60 border border-blue-800/60 text-right">
                          <span className="text-[10px] text-blue-300 block font-semibold">مجموع خرید ویزیتور:</span>
                          <span className="font-black font-mono text-blue-400 text-sm">
                            {formatPrice(totalVisitorBuyCost)}{' '}
                            <span className="text-[10px] font-normal text-slate-400">تومان</span>
                          </span>
                        </div>

                        {/* Status */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            bill.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : bill.status === 'cancelled'
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {bill.status === 'approved'
                            ? 'تایید انبار شده'
                            : bill.status === 'cancelled'
                            ? 'لغو شده'
                            : 'در انتظار خروج'}
                        </span>

                        <span className="p-1 text-slate-400 hover:text-slate-200">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Accordion */}
                    {isExpanded && (
                      <div className="p-4 pt-2 border-t border-slate-800/80 bg-slate-950/60 space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-blue-400" />
                            <span>ریز اقلام حواله بارگیری:</span>
                          </span>
                          <span>مجموع اقلام: {totalItemsCount} عدد/بسته</span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                              <tr>
                                <th className="p-2.5">نام کالا</th>
                                <th className="p-2.5 text-center">تعداد</th>
                                <th className="p-2.5 text-blue-400">نرخ خرید ویزیتور</th>
                                <th className="p-2.5 text-blue-300">مجموع خرید ویزیتور</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 bg-slate-950">
                              {billItems.map((item, idx) => {
                                const prod = products.find((p) => p.id === item.product_id);
                                const fallbackStorePrice = prod?.price || 0;
                                const storePrice = item.store_price ?? fallbackStorePrice;
                                const visitorPrice =
                                  item.visitor_price ?? (prod?.visitor_price ?? 0);

                                return (
                                  <tr key={idx} className="hover:bg-slate-900/50">
                                    <td className="p-2.5 font-semibold text-slate-100">{item.product_name}</td>
                                    <td className="p-2.5 text-center font-mono font-bold text-slate-200">
                                      {item.quantity}
                                    </td>
                                    <td className="p-2.5 font-mono text-blue-400">{formatPrice(visitorPrice)}</td>
                                    <td className="p-2.5 font-mono font-bold text-blue-300">
                                      {formatPrice(visitorPrice * item.quantity)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

            {/* Time, Search & Batch Deletion Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 flex-wrap">
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

              {/* Search input & Delete actions */}
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {selectedTxIds.length > 0 && (
                  <button
                    type="button"
                    disabled={isDeletingTx}
                    onClick={handleDeleteSelectedTx}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingTx ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>حذف {selectedTxIds.length} موارد انتخابی</span>
                  </button>
                )}

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
          </div>

          {/* Feedback banner */}
          {ledgerFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
                ledgerFeedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-800 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {ledgerFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{ledgerFeedback.message}</span>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-sm text-slate-100">
                دفتر دوبل ورود، خروج و رزروهای زنجیره انبار
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{filteredTransactions.length} تراکنش ثبت شده</span>
                {filteredTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{isAllFilteredSelected ? 'لغو انتخاب همه' : 'انتخاب همه'}</span>
                  </button>
                )}
              </div>
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
                      <th className="py-3 px-3 text-center w-10">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {isAllFilteredSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4 font-semibold">نام و کد محصول</th>
                      <th className="py-3 px-4 font-semibold">نوع عملیات انبارداری</th>
                      <th className="py-3 px-4 font-semibold">تعداد تغییر یافته</th>
                      <th className="py-3 px-4 font-semibold">سند مرجع / حواله</th>
                      <th className="py-3 px-4 font-semibold">زمان ثبت</th>
                      <th className="py-3 px-4 text-center font-semibold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTransactions.map((tx) => {
                      const isSelected = selectedTxIds.includes(tx.id);
                      const typeMap = {
                        reserve: { label: 'رزرو سفارش جدید', color: 'text-amber-400' },
                        release_reserve: { label: 'آزادسازی رزرو (تحویل)', color: 'text-blue-400' },
                        load_out: { label: 'خروج فیزیکی از سردخانه', color: 'text-rose-400' },
                        return: { label: 'مرجوعی کالا به انبار', color: 'text-emerald-400' },
                        manual_adjustment: { label: 'ورود بار به انبار', color: 'text-cyan-400' },
                      }[tx.transaction_type];

                      return (
                        <tr
                          key={tx.id}
                          className={`transition ${
                            isSelected ? 'bg-blue-950/30' : 'hover:bg-slate-800/35'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectRow(tx.id)}
                              className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600" />
                              )}
                            </button>
                          </td>
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
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleTx(tx.id)}
                              disabled={isDeletingTx}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                              title="حذف این تراکنش از دفتر کل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
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

      {/* Supplementary Reports (Muted accordion at the very bottom of the page) */}
      <SupplementaryReports loadingBills={loadingBills} visitors={visitors} />
    </div>
  );
};
