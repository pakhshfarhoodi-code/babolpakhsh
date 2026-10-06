import React, { useState } from 'react';
import { Supermarket, Order } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  X,
  Store,
  Phone,
  MapPin,
  Plus,
  Receipt,
  Calendar,
  Package,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
} from 'lucide-react';
import { formatPrice, formatOrderDate } from './helpers';
import { OrderInvoiceModal } from '../invoice/OrderInvoiceModal';

interface CustomerDetailSheetProps {
  customer: Supermarket | null;
  orders: Order[];
  isOpen: boolean;
  onClose: () => void;
  onNewOrder: (customerId: string) => void;
}

export const CustomerDetailSheet: React.FC<CustomerDetailSheetProps> = ({
  customer,
  orders,
  isOpen,
  onClose,
  onNewOrder,
}) => {
  const { showToast } = useApp();
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  if (!isOpen || !customer) return null;

  const customerOrders = orders.filter((o) => o.supermarket_id === customer.id);
  const totalPurchases = customerOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const deliveredPurchases = customerOrders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + o.total_amount, 0);

  // Top 3 recent orders
  const recentOrders = [...customerOrders]
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-100 truncate">{customer.name}</h3>
                {customer.approval_status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>در انتظار تایید ادمین</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">مدیریت: {customer.owner}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Quick Info & Call */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">شماره تماس:</span>
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-1.5 text-xs text-blue-400 font-mono hover:underline dir-ltr"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{customer.phone}</span>
              </a>
            </div>

            <div className="pt-2 border-t border-slate-900 flex items-start gap-1.5 text-xs text-slate-300">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{customer.address}</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <p className="text-xs text-slate-400">مجموع خرید تاریخچه</p>
              <p className="text-sm font-bold text-emerald-400 mt-1">
                {formatPrice(totalPurchases)} <span className="text-xs text-slate-400">تومان</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <p className="text-xs text-slate-400">تعداد کل سفارش‌ها</p>
              <p className="text-sm font-bold text-blue-400 mt-1">
                {customerOrders.length} <span className="text-xs text-slate-400">فاکتور</span>
              </p>
            </div>
          </div>

          {/* Recent Orders (3 Last) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-400" />
                <span>۳ سفارش اخیر این فروشگاه</span>
              </h4>
              <span className="text-xs text-slate-400">از کل {customerOrders.length} سفارش</span>
            </div>

            {recentOrders.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs rounded-xl bg-slate-950/40 border border-slate-800/60">
                هنوز سفارشی برای این مشتری ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-400 font-mono">{ord.id}</span>
                        <span className="text-xs text-slate-400 num-fa">{formatOrderDate(ord.order_date)}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          ord.status === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : ord.status === 'undelivered'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {ord.status === 'delivered'
                          ? 'تحویل شد'
                          : ord.status === 'undelivered'
                          ? 'عدم تحویل'
                          : 'در حال ارسال'}
                      </span>
                    </div>

                    {ord.items && ord.items.length > 0 && (
                      <div className="flex flex-wrap gap-1 text-xs text-slate-300">
                        {ord.items.map((it) => (
                          <span
                            key={it.id}
                            className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-xs"
                          >
                            {it.name} ({it.quantity})
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceOrder(ord)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>فاکتور و چاپ / PDF</span>
                      </button>

                      <span className="font-bold text-slate-200 text-xs">
                        {formatPrice(ord.total_amount)} تومان
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (customer.approval_status === 'pending') {
                showToast('حساب این مشتری هنوز توسط ادمین تایید نشده است.', 'warning', 5000);
                return;
              }
              onClose();
              onNewOrder(customer.id);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs transition shadow-lg shadow-blue-600/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت سفارش جدید برای این مشتری</span>
          </button>
        </div>
      </div>

      {/* Official B2B Order Invoice Modal with PDF & Print */}
      <OrderInvoiceModal
        isOpen={!!selectedInvoiceOrder}
        onClose={() => setSelectedInvoiceOrder(null)}
        order={selectedInvoiceOrder}
        supermarket={customer}
      />
    </div>
  );
};
