import React, { useState, useMemo, useEffect } from 'react';
import { LoadingBill, Order, Product, OrderChannel } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Truck,
  Clock,
  User,
  Package,
  CheckCircle2,
  Ban,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
  Store,
  Building2,
  DollarSign,
  Boxes,
  X,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { formatPrice } from './helpers';
import { aggregateBillItems } from '../warehouse/helpers';

interface LoadingBillsTabProps {
  initialBillId?: string | null;
  initialStatusFilter?: string;
  onNavigateToOrder?: (orderId: string) => void;
}

export function getBillAgeInfo(createdAt: string): {
  hours: number;
  minutes: number;
  formattedText: string;
  isOverdue: boolean;
} {
  let createdDate: Date | null = null;
  const parsed = Date.parse(createdAt);
  if (!isNaN(parsed)) {
    createdDate = new Date(parsed);
  } else {
    createdDate = new Date();
  }

  const diffMs = Math.max(0, Date.now() - createdDate.getTime());
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let formattedText = '';
  if (hours === 0 && minutes < 2) {
    formattedText = 'چند لحظه پیش';
  } else if (hours === 0) {
    formattedText = `${minutes} دقیقه در انتظار`;
  } else if (minutes === 0) {
    formattedText = `${hours} ساعت در انتظار`;
  } else {
    formattedText = `${hours} ساعت و ${minutes} دقیقه در انتظار`;
  }

  return {
    hours,
    minutes,
    formattedText,
    isOverdue: hours >= 4,
  };
}

export function formatBillDateTime(isoOrDateStr: string): string {
  if (!isoOrDateStr) return '-';
  const parsed = Date.parse(isoOrDateStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return new Intl.DateTimeFormat('fa-IR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
  return isoOrDateStr;
}

export const LoadingBillsTab: React.FC<LoadingBillsTabProps> = ({
  initialBillId = null,
  initialStatusFilter = 'all',
  onNavigateToOrder,
}) => {
  const { loadingBills, orders, products, cancelLoadingBill, currentUser } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(initialBillId || null);

  // Cancellation modal state
  const [cancelModalBill, setCancelModalBill] = useState<LoadingBill | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [toastFeedback, setToastFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync expandedBillId when initialBillId changes
  useEffect(() => {
    if (initialBillId) {
      setExpandedBillId(initialBillId);
      // Ensure the bill is visible by resetting status filter if needed
      const targetBill = loadingBills.find((b) => b.id === initialBillId);
      if (targetBill && statusFilter !== 'all' && targetBill.status !== statusFilter) {
        setStatusFilter('all');
      }
    }
  }, [initialBillId, loadingBills, statusFilter]);

  // Pre-index orders by loading_bill_id for high performance
  const ordersByBillId = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders.forEach((o) => {
      if (o.loading_bill_id) {
        const list = map.get(o.loading_bill_id) || [];
        list.push(o);
        map.set(o.loading_bill_id, list);
      }
    });
    return map;
  }, [orders]);

  // Status Filter options
  const statusChips = [
    { id: 'all', label: 'همه برگه‌ها' },
    { id: 'pending', label: 'در انتظار تایید انبار' },
    { id: 'approved', label: 'تایید شده (ترخیص)' },
    { id: 'cancelled', label: 'لغو شده' },
  ];

  // Counts for status chips
  const statusCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let cancelled = 0;
    loadingBills.forEach((b) => {
      if (b.status === 'pending') pending++;
      else if (b.status === 'approved') approved++;
      else if (b.status === 'cancelled') cancelled++;
    });
    return {
      all: loadingBills.length,
      pending,
      approved,
      cancelled,
    };
  }, [loadingBills]);

  // Filtered Loading Bills
  const filteredBills = useMemo(() => {
    return loadingBills.filter((bill) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && bill.status !== statusFilter) {
        return false;
      }

      // 2. Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchId = bill.id.toLowerCase().includes(term);
        const matchVisitor = bill.visitor_name.toLowerCase().includes(term);

        // Check if any order or supermarket inside matches
        const billOrders = ordersByBillId.get(bill.id) || [];
        const matchShop = billOrders.some(
          (o) =>
            o.supermarket_name.toLowerCase().includes(term) ||
            o.id.toLowerCase().includes(term)
        );

        if (!matchId && !matchVisitor && !matchShop) {
          return false;
        }
      }

      return true;
    });
  }, [loadingBills, statusFilter, searchTerm, ordersByBillId]);

  // Handle Cancel Bill Submission
  const handleConfirmCancel = async () => {
    if (!cancelModalBill) return;
    if (!cancelReason.trim()) {
      setCancelError('وارد کردن دلیل لغو برگه بارگیری الزامی است.');
      return;
    }

    setIsCancelling(true);
    try {
      const res = await cancelLoadingBill(
        cancelModalBill.id,
        currentUser?.name || 'مدیریت ارشد',
        cancelReason.trim()
      );

      if (res && res.success) {
        setToastFeedback({ type: 'success', message: res.message });
        setCancelModalBill(null);
        setCancelReason('');
        setCancelError(null);
      } else {
        setCancelError(res?.message || 'خطا در لغو برگه بارگیری.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در لغو برگه.';
      setCancelError(msg);
    } finally {
      setIsCancelling(false);
      setTimeout(() => setToastFeedback(null), 5000);
    }
  };

  const channelMap: Record<OrderChannel, { label: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
    visitor_field: {
      label: 'ویزیتور در محل',
      bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      icon: Truck,
    },
    store_self: {
      label: 'ثبت توسط فروشگاه',
      bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      icon: Store,
    },
    store_direct: {
      label: 'خرید مستقیم',
      bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: Building2,
    },
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastFeedback && (
        <div
          className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold shadow-lg animate-in fade-in ${
            toastFeedback.type === 'success'
              ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border border-rose-500/50 text-rose-300'
          }`}
        >
          {toastFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastFeedback.message}</span>
        </div>
      )}

      {/* Top Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium ml-1">وضعیت برگه:</span>
            {statusChips.map((chip) => {
              const count = statusCounts[chip.id as keyof typeof statusCounts];
              const isActive = statusFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono ${
                      isActive ? 'bg-white/20 text-white font-bold' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                  {chip.id === 'pending' && count > 0 && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی شماره برگه، ویزیتور یا نام فروشگاه..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">فهرست حواله‌های بارگیری و ترخیص سردخانه</h3>
            {statusFilter === 'pending' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                در انتظار ترخیص انبار
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">{filteredBills.length} برگه یافت شد</span>
        </div>

        {filteredBills.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            برگه بارگیری مطابق با فیلتر انتخابی یافت نشد.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredBills.map((bill) => {
              const isExpanded = expandedBillId === bill.id;
              const isPending = bill.status === 'pending';
              const isCancelled = bill.status === 'cancelled';
              const isApproved = bill.status === 'approved';

              const ageInfo = getBillAgeInfo(bill.created_at);

              // Associated orders
              const billOrders = ordersByBillId.get(bill.id) || [];
              const uniqueStoreCount = new Set(billOrders.map((o) => o.supermarket_id).filter(Boolean)).size || billOrders.length;
              const ordersCount = bill.orders_count || billOrders.length;

              // Aggregated items
              const aggregatedItems = aggregateBillItems(bill, products);
              const totalItemsCount = aggregatedItems.reduce((sum, it) => sum + it.totalQuantity, 0);

              // Calculate financial amounts: Prefer total_visitor_cost & total_store_amount, fallback to item snapshots, fallback to current product
              let totalVisitorCost = bill.total_visitor_cost ?? 0;
              let totalStoreAmount = bill.total_store_amount ?? 0;

              if (!bill.total_visitor_cost || !bill.total_store_amount) {
                let calcVisitor = 0;
                let calcStore = 0;
                if (bill.items) {
                  for (const it of bill.items) {
                    const prod = products.find((p) => p.id === it.product_id);
                    const fallbackStore = prod ? Number(prod.price) : 0;
                    const fallbackVisitor = prod?.visitor_price ?? Math.round(fallbackStore * 0.85);

                    const storePrice = it.store_price ?? fallbackStore;
                    const visitorPrice = it.visitor_price ?? fallbackVisitor;

                    calcStore += storePrice * it.quantity;
                    calcVisitor += visitorPrice * it.quantity;
                  }
                }
                if (!bill.total_visitor_cost) totalVisitorCost = calcVisitor;
                if (!bill.total_store_amount) totalStoreAmount = calcStore;
              }

              const visitorGrossMargin = Math.max(0, totalStoreAmount - totalVisitorCost);

              return (
                <div
                  key={bill.id}
                  className={`transition-colors ${
                    isExpanded
                      ? 'bg-slate-950/60'
                      : isPending && ageInfo.isOverdue
                      ? 'bg-rose-950/10 hover:bg-rose-950/20'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  {/* Summary Row */}
                  <div
                    onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    {/* Right: Bill No & Visitor */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-bold text-xs text-indigo-300 bg-indigo-950/90 px-2.5 py-1 rounded-lg border border-indigo-800/60 shrink-0">
                        {bill.id}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-slate-100 truncate">{bill.visitor_name}</p>
                          <span className="text-[11px] text-slate-400 font-mono hidden xs:inline">
                            • {formatBillDateTime(bill.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>{ordersCount} سفارش</span>
                          <span>•</span>
                          <span>{uniqueStoreCount} فروشگاه</span>
                          <span>•</span>
                          <span>{totalItemsCount} عدد کالا</span>
                        </div>
                      </div>
                    </div>

                    {/* Left: Status Badges, Bill Age & Controls */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      {/* Bill Age for Pending */}
                      {isPending && (
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs border ${
                            ageInfo.isOverdue
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/80 font-bold animate-pulse'
                              : 'bg-amber-950/40 text-amber-300 border-amber-800/60 font-semibold'
                          }`}
                          title={ageInfo.isOverdue ? 'بیش از ۴ ساعت در انتظار تایید انبار است!' : 'زمان انتظار'}
                        >
                          {ageInfo.isOverdue ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          <span>{ageInfo.formattedText}</span>
                        </div>
                      )}

                      {/* Main Status Badge */}
                      {isApproved && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ترخیص شده</span>
                        </span>
                      )}

                      {isCancelled && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <Ban className="w-3.5 h-3.5" />
                          <span>لغو شده</span>
                        </span>
                      )}

                      {isPending && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>در انتظار انبار</span>
                        </span>
                      )}

                      {/* Arrow */}
                      <span className="p-1 rounded-lg text-slate-400 hover:text-slate-200">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Accordion Details */}
                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-slate-800/80 bg-slate-950/70 space-y-4 animate-in fade-in">
                      {/* Financial KPI Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. Visitor Buy Cost */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-right">
                          <span className="text-[11px] text-blue-300 block font-semibold">مجموع بهای خرید ویزیتور:</span>
                          <span className="font-black font-mono text-blue-400 text-sm mt-0.5 block">
                            {formatPrice(totalVisitorCost)} <span className="text-[10px] font-normal text-slate-400">تومان</span>
                          </span>
                        </div>

                        {/* 2. Supermarkets Invoice Amount */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-right">
                          <span className="text-[11px] text-emerald-300 block font-semibold">مجموع فاکتور فروشگاه‌ها:</span>
                          <span className="font-black font-mono text-emerald-400 text-sm mt-0.5 block">
                            {formatPrice(totalStoreAmount)} <span className="text-[10px] font-normal text-slate-400">تومان</span>
                          </span>
                        </div>

                        {/* 3. Gross Margin */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-right">
                          <span className="text-[11px] text-purple-300 block font-semibold">کارمزد ناخالص توزیع:</span>
                          <span className="font-black font-mono text-purple-400 text-sm mt-0.5 block">
                            {formatPrice(visitorGrossMargin)} <span className="text-[10px] font-normal text-slate-400">تومان</span>
                          </span>
                        </div>
                      </div>

                      {/* Audit Notice: Approved / Cancelled */}
                      {isApproved && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>
                              این برگه با موفقیت توسط <strong>{bill.approved_by || 'انباردار'}</strong> تایید و اقلام از موجودی فیزیکی سردخانه ترخیص گردیده‌اند.
                            </span>
                          </div>
                          {bill.approved_at && (
                            <span className="text-[11px] text-slate-400 font-mono">زمان تایید: {bill.approved_at}</span>
                          )}
                        </div>
                      )}

                      {isCancelled && (
                        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs space-y-1.5">
                          <div className="flex items-center gap-2 font-bold text-rose-400">
                            <Ban className="w-4 h-4 shrink-0" />
                            <span>برگه بارگیری لغو شده است</span>
                          </div>
                          <p className="text-slate-200 text-xs pr-6">
                            علت لغو: <strong className="text-rose-200">{bill.cancel_reason || 'دلیلی ثبت نشده است.'}</strong>
                          </p>
                          {(bill.cancelled_by || bill.cancelled_at) && (
                            <div className="text-[11px] text-slate-400 pr-6 flex items-center gap-3 pt-1 border-t border-rose-900/40">
                              {bill.cancelled_by && <span>لغو توسط: {bill.cancelled_by}</span>}
                              {bill.cancelled_at && <span>زمان: {bill.cancelled_at}</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* (الف) جدول اقلام تجمیعی به تفکیک کالا */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-indigo-400" />
                            <span>(الف) ریز اقلام تجمیعی بارگیری ({aggregatedItems.length} قلم کالا):</span>
                          </span>
                          <span className="text-slate-400">مجموع: {totalItemsCount} واحد</span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                              <tr>
                                <th className="p-2.5 font-semibold">نام کالا</th>
                                <th className="p-2.5 font-semibold text-center">تعداد درخواستی</th>
                                <th className="p-2.5 font-semibold">موجودی انبار</th>
                                <th className="p-2.5 font-semibold text-blue-400">نرخ ویزیتور</th>
                                <th className="p-2.5 font-semibold text-blue-300">مجموع ویزیتور</th>
                                <th className="p-2.5 font-semibold text-emerald-400">نرخ فروشگاه</th>
                                <th className="p-2.5 font-semibold text-emerald-300">مجموع فروشگاه</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80 bg-slate-950">
                              {aggregatedItems.map((item) => {
                                const prod = products.find((p) => p.id === item.productId);
                                const fallbackStore = prod ? Number(prod.price) : 0;
                                const fallbackVisitor = prod?.visitor_price ?? Math.round(fallbackStore * 0.85);

                                // Find a billItem snapshot if available
                                const rawItem = bill.items?.find((i) => i.product_id === item.productId);
                                const storePrice = rawItem?.store_price ?? fallbackStore;
                                const visitorPrice = rawItem?.visitor_price ?? fallbackVisitor;

                                return (
                                  <tr key={item.productId} className="hover:bg-slate-900/40">
                                    <td className="p-2.5 font-semibold text-slate-100 flex items-center gap-1.5">
                                      <span>{item.productName}</span>
                                      {item.isShortage && isPending && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                          کسری
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center font-mono font-bold text-slate-200">
                                      {item.totalQuantity} <span className="font-normal text-slate-400">{item.unit}</span>
                                    </td>
                                    <td className="p-2.5 text-slate-300 font-mono text-[11px]">
                                      {item.currentStock} {item.unit}
                                    </td>
                                    <td className="p-2.5 font-mono text-blue-400">{formatPrice(visitorPrice)}</td>
                                    <td className="p-2.5 font-mono font-bold text-blue-300">
                                      {formatPrice(visitorPrice * item.totalQuantity)}
                                    </td>
                                    <td className="p-2.5 font-mono text-emerald-400">{formatPrice(storePrice)}</td>
                                    <td className="p-2.5 font-mono font-bold text-emerald-300">
                                      {formatPrice(storePrice * item.totalQuantity)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* (ب) لیست سفارش‌های داخل برگه */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-blue-400" />
                            <span>(ب) سفارش‌های مندرج در این برگه ({billOrders.length} فاکتور):</span>
                          </span>
                        </div>

                        {billOrders.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-500 bg-slate-900 rounded-xl">
                            سفارشی برای این برگه بارگیری یافت نشد.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            {billOrders.map((ord) => {
                              const ch = ord.order_channel || 'visitor_field';
                              const chInfo = channelMap[ch as OrderChannel] || channelMap.visitor_field;
                              const ChIcon = chInfo.icon;

                              return (
                                <div
                                  key={ord.id}
                                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition"
                                >
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-xs text-blue-400">{ord.id}</span>
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${chInfo.bg}`}>
                                        <ChIcon className="w-2.5 h-2.5" />
                                        <span>{chInfo.label}</span>
                                      </span>
                                    </div>
                                    <p className="font-medium text-slate-200 truncate">{ord.supermarket_name}</p>
                                    <p className="text-[11px] font-mono font-bold text-emerald-400">
                                      {formatPrice(ord.total_amount)} تومان
                                    </p>
                                  </div>

                                  {onNavigateToOrder && (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateToOrder(ord.id)}
                                      className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
                                      title="مشاهده جزئیات سفارش در تب سفارش‌ها"
                                    >
                                      <span>مشاهده</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions: Cancel Bill for Pending */}
                      {isPending && (
                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                          <p className="text-[11px] text-slate-400">
                            تایید نهایی خروج فیزیکی این حواله در پنل انباردار سردخانه انجام می‌پذیرد.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalBill(bill);
                              setCancelReason('');
                              setCancelError(null);
                            }}
                            className="min-h-[38px] px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 hover:text-rose-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-98 shadow-sm"
                          >
                            <Ban className="w-4 h-4 text-rose-400" />
                            <span>لغو برگه بارگیری</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancellation Modal */}
      {cancelModalBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Ban className="w-4 h-4" />
                <span>لغو برگه بارگیری {cancelModalBill.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalBill(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              با لغو این حواله، سفارش‌های متصل به آن مجدداً به وضعیت آماده ارسال بازمی‌گردند و امکان صدور برگه جدید توسط ویزیتور فراهم می‌شود. موجودی انبار تغییری نخواهد کرد.
            </p>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-200 block">
                علت لغو برگه بارگیری <span className="text-rose-400">*</span>:
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  if (cancelError) setCancelError(null);
                }}
                rows={3}
                placeholder="مثال: عدم حضور راننده، کسری موجودی سردخانه، مغایرت فاکتورها..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition resize-none"
              />
              {cancelError && (
                <p className="text-xs text-rose-400 flex items-center gap-1 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{cancelError}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setCancelModalBill(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 cursor-pointer active:scale-98 flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isCancelling ? 'در حال لغو...' : 'ثبت قطعی و لغو برگه'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
