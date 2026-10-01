import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, Visitor, OrderChannel } from '../../types';
import {
  Search,
  Truck,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Clock,
  ShieldAlert,
  Calendar,
  Filter,
  FileText,
  Printer,
  Building2,
  Check,
  UserCheck,
  AlertCircle,
  Store,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { isToday, isWithinDays, formatPrice, formatOrderDate } from './helpers';
import { OrderOverrideModal } from './OrderOverrideModal';
import { OrderInvoiceModal } from '../invoice/OrderInvoiceModal';
import { getOrderChannel } from '../../context/utils';

interface OrdersTabProps {
  orders: Order[];
  visitors: Visitor[];
  initialStatusFilter?: string;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onRequestReassignment?: (orderId: string, newVisitorId: string) => void;
  onAssignOrderVisitor?: (
    orderId: string,
    targetVisitorId: string | 'direct',
    updateCustomerPermanent?: boolean
  ) => { success: boolean; message: string; targetVisitorName?: string };
  onDeleteOrder?: (orderId: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  onOpenBill?: (billId: string) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  visitors,
  initialStatusFilter = 'all',
  onUpdateOrderStatus,
  onRequestReassignment,
  onAssignOrderVisitor,
  onDeleteOrder,
  onOpenBill,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  type ChannelFilterType = 'all' | 'visitor_field' | 'store_self' | 'store_direct';
  const [channelFilter, setChannelFilter] = useState<ChannelFilterType>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week'>('all');

  // Override modal state
  const [overrideModalOrder, setOverrideModalOrder] = useState<Order | null>(null);
  const [overrideTargetStatus, setOverrideTargetStatus] = useState<OrderStatus | null>(null);

  // Delete modal state
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Assignment Modal state (Supports direct assignment to visitor or central office)
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null);
  const [selectedTargetVisitor, setSelectedTargetVisitor] = useState<string>('');
  const [updateCustomerPermanent, setUpdateCustomerPermanent] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Invoice view / print modal state
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);

  // Status Chip config (with 'loading' added between assigned and delegated)
  const statusChips = [
    { id: 'all', label: 'همه سفارش‌ها' },
    { id: 'assigned', label: 'آماده ارسال' },
    { id: 'loading', label: 'در فاکتور بارگیری' },
    { id: 'delegated', label: 'در حال واگذاری' },
    { id: 'delivered', label: 'تحویل شده' },
    { id: 'undelivered', label: 'عدم تحویل' },
  ];

  // Channel Chip config based on getOrderChannel
  const channelChips: {
    id: ChannelFilterType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'all', label: 'همه', icon: Filter },
    { id: 'visitor_field', label: 'ویزیتور در محل', icon: Truck },
    { id: 'store_self', label: 'ثبت توسط فروشگاه', icon: Store },
    { id: 'store_direct', label: 'خرید مستقیم', icon: Building2 },
  ];

  // Channel metrics based on getOrderChannel
  const channelCounts = useMemo(() => {
    let visitorField = 0;
    let storeSelf = 0;
    let storeDirect = 0;

    orders.forEach((o) => {
      const ch = getOrderChannel(o);
      if (ch === 'visitor_field') visitorField++;
      else if (ch === 'store_self') storeSelf++;
      else if (ch === 'store_direct') storeDirect++;
    });

    return {
      all: orders.length,
      visitor_field: visitorField,
      store_self: storeSelf,
      store_direct: storeDirect,
    };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Channel Filter based on getOrderChannel
      if (channelFilter !== 'all') {
        const orderChannel = getOrderChannel(order);
        if (orderChannel !== channelFilter) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      // 3. Time Filter
      if (timeFilter === 'today' && !isToday(order.order_date)) {
        return false;
      }
      if (timeFilter === 'week' && !isWithinDays(order.order_date, 7)) {
        return false;
      }

      // 4. Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchId = order.id.toLowerCase().includes(term);
        const matchShop = order.supermarket_name.toLowerCase().includes(term);
        const matchVisitor = order.visitor_name?.toLowerCase().includes(term) ?? false;
        const matchBill = order.loading_bill_id?.toLowerCase().includes(term) ?? false;
        if (!matchId && !matchShop && !matchVisitor && !matchBill) return false;
      }

      return true;
    });
  }, [orders, channelFilter, statusFilter, timeFilter, searchTerm]);

  const handleOpenOverride = (order: Order, target: OrderStatus) => {
    setOverrideModalOrder(order);
    setOverrideTargetStatus(target);
  };

  const handleConfirmOverride = (orderId: string, status: OrderStatus, _reason: string) => {
    onUpdateOrderStatus(orderId, status);
  };

  const handleOpenAssignModal = (order: Order) => {
    setAssignModalOrder(order);
    const isDirect =
      order.assigned_visitor_id === 'direct' ||
      !order.assigned_visitor_id ||
      order.visitor_name?.includes('مستقیم');
    setSelectedTargetVisitor(isDirect ? '' : (order.assigned_visitor_id || ''));
    setUpdateCustomerPermanent(false);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalOrder || !selectedTargetVisitor) return;

    if (onAssignOrderVisitor) {
      const res = onAssignOrderVisitor(
        assignModalOrder.id,
        selectedTargetVisitor,
        updateCustomerPermanent
      );
      setFeedbackToast({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      setTimeout(() => setFeedbackToast(null), 4000);
    } else if (onRequestReassignment && selectedTargetVisitor !== 'direct') {
      onRequestReassignment(assignModalOrder.id, selectedTargetVisitor);
    }

    setAssignModalOrder(null);
    setSelectedTargetVisitor('');
  };

  const handleTakeOverDirect = () => {
    if (!assignModalOrder) return;
    if (onAssignOrderVisitor) {
      const res = onAssignOrderVisitor(
        assignModalOrder.id,
        'direct',
        updateCustomerPermanent
      );
      setFeedbackToast({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      setTimeout(() => setFeedbackToast(null), 4000);
    }
    setAssignModalOrder(null);
    setSelectedTargetVisitor('');
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback Notification */}
      {feedbackToast && (
        <div
          className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold shadow-lg animate-in fade-in duration-200 ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border border-rose-500/50 text-rose-300'
          }`}
        >
          {feedbackToast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-sm">
        {/* Sales Channel Tabs based on getOrderChannel */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 font-medium ml-1">کانال ثبت:</span>
            {channelChips.map((chip) => {
              const Icon = chip.icon;
              const count = channelCounts[chip.id];
              const isActive = channelFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setChannelFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{chip.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono ${
                      isActive ? 'bg-white/20 text-white font-bold' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium ml-1">وضعیت:</span>
          {statusChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatusFilter(chip.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                statusFilter === chip.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Time Chips & Search Box */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium ml-1">بازه زمانی:</span>
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              همه سوابق
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                timeFilter === 'today'
                  ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                timeFilter === 'week'
                  ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ۷ روز اخیر
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی فروشگاه، ویزیتور یا کد سفارش..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Orders Count and Table / Cards */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-100">
              فهرست فاکتورها و سفارشات پخش مویرگی
            </h3>
            {channelFilter !== 'all' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                {channelChips.find((c) => c.id === channelFilter)?.label}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">{filteredOrders.length} سفارش یافت شد</span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            سفارشی مطابق با فیلترهای انتخابی یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">کد سفارش</th>
                  <th className="py-3 px-4 font-semibold">سوپرمارکت مقصد</th>
                  <th className="py-3 px-4 font-semibold">کانال توزیع (ویزیتور)</th>
                  <th className="py-3 px-4 font-semibold">مبلغ کل (تومان)</th>
                  <th className="py-3 px-4 font-semibold">تاریخ ثبت</th>
                  <th className="py-3 px-4 font-semibold text-center">وضعیت</th>
                  <th className="py-3 px-4 font-semibold text-center">عملیات مدیریتی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((order) => {
                  const orderChannel = getOrderChannel(order);
                  const isDirect = orderChannel === 'store_direct';

                  const channelBadgeMap: Record<
                    OrderChannel,
                    { label: string; bg: string; icon: React.ComponentType<{ className?: string }> }
                  > = {
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

                  const chBadge = channelBadgeMap[orderChannel];
                  const ChIcon = chBadge.icon;

                  const statusMap: Record<OrderStatus, { text: string; bg: string }> = {
                    assigned: {
                      text: 'آماده ارسال',
                      bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                    },
                    loading: {
                      text: 'در برگه بارگیری',
                      bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
                    },
                    delegated: {
                      text: 'در حال واگذاری',
                      bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    },
                    delivered: {
                      text: 'تحویل شده',
                      bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    },
                    undelivered: {
                      text: 'عدم تحویل',
                      bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                    },
                  };

                  const currentStatus = statusMap[order.status];

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-800/35 transition ${
                        isDirect ? 'bg-amber-500/[0.02]' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-bold text-blue-400 font-mono text-xs">{order.id}</span>
                          {order.loading_bill_id && (
                            <button
                              type="button"
                              onClick={() => onOpenBill?.(order.loading_bill_id!)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/35 hover:border-indigo-400/60 transition cursor-pointer"
                              title={`مشاهده برگه بارگیری ${order.loading_bill_id}`}
                            >
                              <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span>برگه: {order.loading_bill_id}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {order.supermarket_name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${chBadge.bg}`}
                          >
                            <ChIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{chBadge.label}</span>
                          </div>
                          {orderChannel !== 'store_direct' && order.visitor_name && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 pr-0.5">
                              <span>ویزیتور:</span>
                              <strong className="text-slate-200 font-medium">{order.visitor_name}</strong>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">
                        {formatPrice(order.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {formatOrderDate(order.order_date)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-medium border text-xs ${currentStatus.bg}`}
                        >
                          {currentStatus.text}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Invoice View & Print / PDF Button */}
                          <button
                            type="button"
                            onClick={() => setInvoiceModalOrder(order)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                            title="مشاهده فاکتور، چاپ کاغذی و خروجی PDF"
                          >
                            <FileText className="w-3 h-3" />
                            <span>فاکتور / PDF</span>
                          </button>

                          {/* Deliver button (only if not delivered) */}
                          {order.status !== 'delivered' && (
                            <button
                              type="button"
                              onClick={() => handleOpenOverride(order, 'delivered')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
                                order.status === 'loading'
                                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50'
                                  : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30'
                              }`}
                              title={
                                order.status === 'loading'
                                  ? 'هشدار: این سفارش در برگه بارگیری است! تغییر دستی ممکن است با کسر موجودی انبار ناسازگار شود.'
                                  : 'تایید تحویل سفارش توسط مدیریت'
                              }
                            >
                              {order.status === 'loading' && (
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              )}
                              <span>تایید تحویل</span>
                            </button>
                          )}

                          {/* Undeliver override button (if not undelivered) */}
                          {order.status !== 'undelivered' && (
                            <button
                              type="button"
                              onClick={() => handleOpenOverride(order, 'undelivered')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
                                order.status === 'loading'
                                  ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60'
                                  : 'bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30'
                              }`}
                              title={
                                order.status === 'loading'
                                  ? 'هشدار: این سفارش در برگه بارگیری است! تغییر دستی ممکن است با کسر موجودی انبار ناسازگار شود.'
                                  : 'تغییر وضعیت به عدم تحویل با ثبت دلیل'
                              }
                            >
                              {order.status === 'loading' && (
                                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              )}
                              <span>عدم تحویل</span>
                            </button>
                          )}

                          {/* Assignment & Delegation Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(order)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
                              isDirect
                                ? 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border-amber-500/40 font-bold'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            }`}
                            title={
                              isDirect
                                ? 'تخصیص به ویزیتور اختصاصی'
                                : 'تغییر یا واگذاری ویزیتور'
                            }
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>{isDirect ? 'تخصیص ویزیتور' : 'انتقال ویزیتور'}</span>
                          </button>

                          {/* Delete Order Button */}
                          {onDeleteOrder && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmOrder(order)}
                              className="p-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-semibold transition cursor-pointer"
                              title="حذف کامل سفارش و آزادسازی موجودی"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Order Confirmation Modal */}
      {deleteConfirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  حذف قطعی سفارش و لغو فاکتور
                </h3>
                <p className="text-xs text-slate-400 font-mono">{deleteConfirmOrder.id}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">سوپرمارکت:</span>
                <span className="font-bold text-slate-200">{deleteConfirmOrder.supermarket_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">کانال / ویزیتور:</span>
                <span className="font-bold text-amber-300">{deleteConfirmOrder.visitor_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">مبلغ کل:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatPrice(deleteConfirmOrder.total_amount)} تومان
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">وضعیت فعلی:</span>
                <span className="font-semibold text-slate-300">{deleteConfirmOrder.status}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>توجه در حذف سفارش:</span>
              </p>
              <p className="text-slate-400 leading-relaxed text-[11px] pr-5">
                با حذف این سفارش، مقادیر اقلام رزروشده بلافاصله به موجودی آزاد انبار بازمی‌گردد و فاکتور از سوابق سیستم پاک می‌شود.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={() => setDeleteConfirmOrder(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isDeletingOrder}
                onClick={async () => {
                  if (!deleteConfirmOrder || !onDeleteOrder) return;
                  setIsDeletingOrder(true);
                  try {
                    const res = await onDeleteOrder(deleteConfirmOrder.id);
                    setFeedbackToast({
                      type: res.success ? 'success' : 'error',
                      message: res.message,
                    });
                    setTimeout(() => setFeedbackToast(null), 4000);
                    setDeleteConfirmOrder(null);
                  } finally {
                    setIsDeletingOrder(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-rose-600/25 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingOrder ? 'در حال حذف...' : 'تایید و حذف فاکتور'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Confirmation Modal with Reason */}
      <OrderOverrideModal
        order={overrideModalOrder}
        targetStatus={overrideTargetStatus}
        isOpen={Boolean(overrideModalOrder)}
        onClose={() => {
          setOverrideModalOrder(null);
          setOverrideTargetStatus(null);
        }}
        onConfirm={handleConfirmOverride}
      />

      {/* Order Assignment & Delegation Modal */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    تخصیص یا واگذاری سفارش به ویزیتور
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">{assignModalOrder.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order Brief */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">سوپرمارکت:</span>
                <span className="font-bold text-slate-200">{assignModalOrder.supermarket_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">کانال فعلی:</span>
                <span className="font-bold text-amber-400">{assignModalOrder.visitor_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">مبلغ سفارش:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatPrice(assignModalOrder.total_amount)} تومان
                </span>
              </div>
            </div>

            {/* Action 1: Assign to a Visitor */}
            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  انتخاب ویزیتور جدید جهت تحویل سفارش:
                </label>
                <div className="relative">
                  <select
                    value={selectedTargetVisitor}
                    onChange={(e) => setSelectedTargetVisitor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="">انتخاب ویزیتور...</option>
                    {visitors
                      .filter((v) => v.id !== assignModalOrder.assigned_visitor_id)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.region}) — {v.phone}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Checkbox: Permanently associate supermarket */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={updateCustomerPermanent}
                  onChange={(e) => setUpdateCustomerPermanent(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <span>
                  تخصیص دائم این ویزیتور به عنوان پشتیبان اختصاصی این فروشگاه (<strong className="text-slate-100">{assignModalOrder.supermarket_name}</strong>)
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!selectedTargetVisitor || selectedTargetVisitor === 'direct'}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-md shadow-blue-600/25 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>تخصیص به ویزیتور</span>
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-slate-500 text-[11px]">یا انتقال به دفتر مرکزی</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Action 2: Direct Central Management by Admin */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>مدیریت مستقیم توسط پخش مرکزی (دفتر مرکزی)</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                با انتخاب این گزینه، این سفارش از فهرست ویزیتورها خارج شده و مستقیماً توسط دفتر پخش مرکزی رسیدگی و توزیع خواهد شد.
              </p>
              <button
                type="button"
                onClick={handleTakeOverDirect}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
              >
                <Building2 className="w-4 h-4" />
                <span>تغییر کانال به خرید مستقیم پخش مرکزی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official B2B Order Invoice Modal with PDF & Print */}
      <OrderInvoiceModal
        isOpen={Boolean(invoiceModalOrder)}
        onClose={() => setInvoiceModalOrder(null)}
        order={invoiceModalOrder}
        visitor={
          invoiceModalOrder
            ? visitors.find((v) => v.id === invoiceModalOrder.assigned_visitor_id) || null
            : null
        }
      />
    </div>
  );
};
