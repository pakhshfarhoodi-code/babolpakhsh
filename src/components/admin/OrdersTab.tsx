import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, Visitor } from '../../types';
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
} from 'lucide-react';
import { isToday, isWithinDays, formatPrice } from './helpers';
import { OrderOverrideModal } from './OrderOverrideModal';

interface OrdersTabProps {
  orders: Order[];
  visitors: Visitor[];
  initialStatusFilter?: string;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onRequestReassignment: (orderId: string, newVisitorId: string) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  visitors,
  initialStatusFilter = 'all',
  onUpdateOrderStatus,
  onRequestReassignment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week'>('all');

  // Override modal state
  const [overrideModalOrder, setOverrideModalOrder] = useState<Order | null>(null);
  const [overrideTargetStatus, setOverrideTargetStatus] = useState<OrderStatus | null>(null);

  // Reassignment Modal state
  const [reassignModalOrder, setReassignModalOrder] = useState<Order | null>(null);
  const [selectedTargetVisitor, setSelectedTargetVisitor] = useState('');

  // Status Chip config
  const statusChips = [
    { id: 'all', label: 'همه سفارش‌ها' },
    { id: 'assigned', label: 'آماده ارسال' },
    { id: 'delegated', label: 'در حال واگذاری' },
    { id: 'delivered', label: 'تحویل شده' },
    { id: 'undelivered', label: 'عدم تحویل' },
  ];

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      // 2. Time Filter
      if (timeFilter === 'today' && !isToday(order.order_date)) {
        return false;
      }
      if (timeFilter === 'week' && !isWithinDays(order.order_date, 7)) {
        return false;
      }

      // 3. Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchId = order.id.toLowerCase().includes(term);
        const matchShop = order.supermarket_name.toLowerCase().includes(term);
        const matchVisitor = order.visitor_name.toLowerCase().includes(term);
        if (!matchId && !matchShop && !matchVisitor) return false;
      }

      return true;
    });
  }, [orders, statusFilter, timeFilter, searchTerm]);

  const handleOpenOverride = (order: Order, target: OrderStatus) => {
    setOverrideModalOrder(order);
    setOverrideTargetStatus(target);
  };

  const handleConfirmOverride = (orderId: string, status: OrderStatus, _reason: string) => {
    onUpdateOrderStatus(orderId, status);
  };

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModalOrder || !selectedTargetVisitor) return;
    onRequestReassignment(reassignModalOrder.id, selectedTargetVisitor);
    setReassignModalOrder(null);
    setSelectedTargetVisitor('');
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-sm">
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
          <h3 className="font-bold text-sm text-slate-100">
            فهرست فاکتورها و سفارشات پخش مویرگی
          </h3>
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
                  <th className="py-3 px-4 font-semibold">ویزیتور تخصیص‌یافته</th>
                  <th className="py-3 px-4 font-semibold">مبلغ کل (تومان)</th>
                  <th className="py-3 px-4 font-semibold">تاریخ ثبت</th>
                  <th className="py-3 px-4 font-semibold text-center">وضعیت</th>
                  <th className="py-3 px-4 font-semibold text-center">عملیات مدیریتی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((order) => {
                  const statusMap: Record<OrderStatus, { text: string; bg: string }> = {
                    assigned: {
                      text: 'آماده ارسال',
                      bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                    },
                    delegated: {
                      text: 'در حال واگذاری',
                      bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    },
                    delivered: {
                      text: 'تحویل داده شد',
                      bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    },
                    undelivered: {
                      text: 'عدم تحویل',
                      bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                    },
                  };

                  const currentStatus = statusMap[order.status];

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/35 transition">
                      <td className="py-3 px-4 font-bold text-blue-400 font-mono">{order.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {order.supermarket_name}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-500" />
                          <span>{order.visitor_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">
                        {formatPrice(order.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">{order.order_date}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-medium border text-xs ${currentStatus.bg}`}
                        >
                          {currentStatus.text}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Deliver button (only if not delivered) */}
                          {order.status !== 'delivered' && (
                            <button
                              type="button"
                              onClick={() => handleOpenOverride(order, 'delivered')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                              title="تایید تحویل سفارش توسط مدیریت"
                            >
                              تایید تحویل
                            </button>
                          )}

                          {/* Undeliver override button (if not undelivered) */}
                          {order.status !== 'undelivered' && (
                            <button
                              type="button"
                              onClick={() => handleOpenOverride(order, 'undelivered')}
                              className="px-2.5 py-1 rounded-lg bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition cursor-pointer"
                              title="تغییر وضعیت به عدم تحویل با ثبت دلیل"
                            >
                              عدم تحویل
                            </button>
                          )}

                          {/* Request Reassignment Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setReassignModalOrder(order);
                              setSelectedTargetVisitor('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                            title="درخواست واگذاری به ویزیتور دیگر"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>درخواست انتقال ویزیتور</span>
                          </button>
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

      {/* Reassign Request Modal */}
      {reassignModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">درخواست انتقال ویزیتور سفارش</h3>
                  <p className="text-xs text-slate-400 font-mono">{reassignModalOrder.id}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4 text-xs">
              <p className="text-slate-300">
                ویزیتور فعلی: <span className="font-bold text-slate-100">{reassignModalOrder.visitor_name}</span>
              </p>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">
                  انتخاب ویزیتور جدید برای تحویل این فاکتور:
                </label>
                <select
                  required
                  value={selectedTargetVisitor}
                  onChange={(e) => setSelectedTargetVisitor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">انتخاب ویزیتور جدید...</option>
                  {visitors
                    .filter((v) => v.id !== reassignModalOrder.assigned_visitor_id)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.region})
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                با ارسال این فرم، درخواست واگذاری سفارش برای ویزیتور مربوطه ارسال خواهد شد تا تایید یا رد کند.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReassignModalOrder(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={!selectedTargetVisitor}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  ثبت درخواست انتقال
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
