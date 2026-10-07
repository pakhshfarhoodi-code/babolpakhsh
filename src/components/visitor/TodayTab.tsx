import React, { useState, useMemo } from 'react';
import {
  Order,
  Supermarket,
  ReassignmentRequest,
  Visitor,
} from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Truck,
  CheckCircle2,
  Phone,
  MoreVertical,
  ArrowRightLeft,
  XCircle,
  FileText,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MapPin,
  Sparkles,
  Info,
  Printer,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { isToday, formatPrice } from './helpers';
import { OrderInvoiceModal } from '../invoice/OrderInvoiceModal';
import { VisitorInvoiceSection } from './VisitorInvoiceSection';

interface TodayTabProps {
  currentVisitor: Visitor;
  orders: Order[];
  supermarkets: Supermarket[];
  allSupermarkets?: Supermarket[];
  incomingHandovers: ReassignmentRequest[];
  outgoingHandovers: ReassignmentRequest[];
  onDeliverOrder: (orderId: string) => void;
  onOpenUndeliveredModal: (order: Order) => void;
  onOpenDelegateModal: (order: Order) => void;
  onRespondHandover: (requestId: string, accept: boolean) => void;
  onCreateLoadingBill?: (
    visitorId: string,
    orderIds: string[]
  ) => Promise<{ success: boolean; message: string; billId?: string }> | { success: boolean; message: string; billId?: string };
}

export const TodayTab: React.FC<TodayTabProps> = ({
  currentVisitor,
  orders,
  supermarkets,
  allSupermarkets,
  incomingHandovers,
  outgoingHandovers,
  onDeliverOrder,
  onOpenUndeliveredModal,
  onOpenDelegateModal,
  onRespondHandover,
  onCreateLoadingBill,
}) => {
  const { loadingBills } = useApp();

  // Active menu dropdown state for card actions
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // Visitor Invoice section open state
  const [isInvoiceSectionOpen, setIsInvoiceSectionOpen] = useState(true);

  // Supermarket lookup map built from allSupermarkets (full database list)
  const supermarketListToUse = allSupermarkets && allSupermarkets.length > 0 ? allSupermarkets : supermarkets;

  const supermarketMap = useMemo(() => {
    const map = new Map<string, Supermarket>();
    supermarketListToUse.forEach((s) => map.set(s.id, s));
    return map;
  }, [supermarketListToUse]);

  // Orders eligible for new loading bill (strictly status === 'assigned' and not yet in a loading bill)
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.assigned_visitor_id === (currentVisitor?.id || '') && o.status === 'assigned' && !o.loading_bill_id),
    [orders, currentVisitor?.id]
  );

  // Active delivery orders (both assigned and loading, ready for delivery or undelivered actions)
  const activeDeliveryOrders = useMemo(
    () => orders.filter((o) => o.assigned_visitor_id === (currentVisitor?.id || '') && (o.status === 'assigned' || o.status === 'loading')),
    [orders, currentVisitor?.id]
  );

  // Today delivered total amount (only orders with order_date today & status delivered)
  const todayDeliveredTotal = useMemo(() => {
    return orders
      .filter(
        (o) =>
          o.assigned_visitor_id === (currentVisitor?.id || '') &&
          o.status === 'delivered' &&
          isToday(o.order_date)
      )
      .reduce((sum, o) => sum + o.total_amount, 0);
  }, [orders, currentVisitor?.id]);

  const todayDeliveredCount = useMemo(() => {
    return orders.filter(
      (o) =>
        o.assigned_visitor_id === (currentVisitor?.id || '') &&
        o.status === 'delivered' &&
        isToday(o.order_date)
    ).length;
  }, [orders, currentVisitor?.id]);

  return (
    <div className="space-y-4 pb-20 sm:pb-8">
      {/* 1. Top Summary KPI Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">سفارشات در انتظار تحویل</span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-400">{activeDeliveryOrders.length}</span>
            <span className="text-xs text-slate-400">فاکتور فعال</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">مبلغ تحویل‌شده امروز</span>
            {todayDeliveredCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                {todayDeliveredCount} موفق
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-400">
              {formatPrice(todayDeliveredTotal)}
            </span>
            <span className="text-xs text-slate-400">تومان</span>
          </div>
        </div>
      </div>

      {/* 2. Incoming Handovers Alert Card */}
      {incomingHandovers.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <ArrowRightLeft className="w-4 h-4" />
            <span>پیشنهاد انتقال سفارش جدید از همکاران ({incomingHandovers.length})</span>
          </div>
          <div className="space-y-2">
            {incomingHandovers.map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5"
              >
                <div>
                  <p className="font-bold text-slate-100">{req.supermarket_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    از طرف: <span className="text-slate-300 font-medium">{req.from_visitor_name}</span>
                    <span className="text-slate-500 mr-1.5">({req.timestamp})</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => onRespondHandover(req.id, true)}
                    className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm"
                  >
                    پذیرش سفارش
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondHandover(req.id, false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition cursor-pointer"
                  >
                    رد
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Outgoing Handovers (Pending Proposals sent by this visitor) */}
      {outgoingHandovers.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>واگذاری‌های ارسالی من (در انتظار پاسخ همکاران)</span>
          </div>
          <div className="space-y-2">
            {outgoingHandovers.map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-slate-200">{req.supermarket_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    مقصد:{' '}
                    <span className="text-blue-300">
                      {req.to_visitor_name || 'انتشار عمومی'}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  title="قابلیت لغو درخواست واگذاری به‌زودی فعال خواهد شد"
                  className="px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-500 border border-slate-700/40 text-xs cursor-not-allowed"
                >
                  لغو درخواست (به‌زودی)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Active Delivery Orders Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-400" />
            <span>برنامه توزیع و تحویل امروز</span>
          </h2>
          <span className="text-xs text-slate-400">{activeDeliveryOrders.length} سفارش فعال</span>
        </div>

        {activeDeliveryOrders.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-200">همه سفارش‌ها تحویل داده شده‌اند</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              سفارش در انتظار تحویلی برای امروز وجود ندارد. برای ثبت سفارش جدید از دکمه «+ سفارش جدید» استفاده کنید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            {activeDeliveryOrders.map((order) => {
              const shop =
                (order.supermarket_id ? supermarketMap.get(order.supermarket_id) : undefined) ||
                allSupermarkets?.find((s) => s.id === order.supermarket_id);

              const rawOrder = order as Order & { customer_label?: string };
              const orderCustomerLabel = rawOrder.customer_label;
              const displayStoreName =
                order.supermarket_name || orderCustomerLabel || shop?.name || 'مشتری نامشخص';
              const isDeletedStore = !order.supermarket_id && !orderCustomerLabel;
              const isMenuOpen = activeMenuOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xs relative transition hover:border-slate-700 flex flex-col justify-between gap-2.5"
                >
                  {/* Card Top: Shop Info & Amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-100 truncate max-w-[160px] sm:max-w-[190px]">
                          {displayStoreName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {order.id}
                        </span>
                        {order.status === 'loading' && (() => {
                          const bill = order.loading_bill_id
                            ? loadingBills.find((b) => b.id === order.loading_bill_id)
                            : loadingBills.find((b) => b.items?.some((it) => it.order_id === order.id));

                          if (bill?.status === 'approved') {
                            return (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950/90 text-blue-300 border border-blue-700/50 font-medium inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                <span>تایید شده</span>
                              </span>
                            );
                          }
                          if (bill?.status === 'loaded') {
                            return (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/50 font-medium inline-flex items-center gap-1">
                                <Truck className="w-2.5 h-2.5 text-emerald-400" />
                                <span>بارگیری شد</span>
                              </span>
                            );
                          }
                          if (bill?.status === 'cancelled') {
                            return (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-700/50 font-medium inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                <span>لغو شده</span>
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-700/50 font-medium inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                              <span>در انتظار انبار</span>
                            </span>
                          );
                        })()}
                      </div>

                      {/* Address / Shop Info */}
                      {isDeletedStore ? (
                        <div className="flex items-center gap-1 text-[11px] text-rose-400 mt-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span className="font-medium">فروشگاه حذف شده است</span>
                        </div>
                      ) : shop?.address ? (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1 min-w-0" title={shop.address}>
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{shop.address}</span>
                        </div>
                      ) : orderCustomerLabel ? (
                        <div className="flex items-center gap-1 text-[11px] text-purple-300 mt-1 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-[10px] font-medium truncate">
                            اقلام مازاد: {orderCustomerLabel}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 min-w-0">
                          <span className="truncate">آدرس ثبت نشده</span>
                        </div>
                      )}
                    </div>

                    <div className="text-left shrink-0">
                      <div className="font-black text-xs sm:text-sm text-slate-100">
                        {formatPrice(order.total_amount)}
                      </div>
                      <span className="text-[10px] text-slate-400">تومان</span>
                    </div>
                  </div>

                  {/* Items Preview Chips (Compact) */}
                  {order.items && order.items.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-800/70 flex flex-wrap gap-1 text-[11px] text-slate-300">
                      {order.items.slice(0, 3).map((it) => (
                        <span
                          key={it.id}
                          className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded-md text-[10.5px] text-slate-300"
                        >
                          {it.name} ({it.quantity})
                        </span>
                      ))}
                      {order.items.length > 3 && (
                        <span className="bg-slate-800/80 border border-slate-700/60 px-1.5 py-0.5 rounded-md text-[10px] text-slate-400">
                          +{order.items.length - 3} قلم دیگر
                        </span>
                      )}
                    </div>
                  )}

                  {/* Card Actions: Deliver Button + Phone Call + Invoice + 3-Dot Menu */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                    {/* Big Green Deliver Button */}
                    <button
                      type="button"
                      onClick={() => onDeliverOrder(order.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs transition shadow-sm shadow-emerald-600/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تحویل شد</span>
                    </button>

                    {/* Phone Call button */}
                    {shop?.phone && (
                      <a
                        href={`tel:${shop.phone}`}
                        title={`تماس با فروشگاه (${shop.phone})`}
                        className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition flex items-center justify-center cursor-pointer shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Quick Invoice & Print Button */}
                    <button
                      type="button"
                      onClick={() => setInvoiceOrder(order)}
                      title="مشاهده، چاپ یا دانلود فاکتور"
                      className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>

                    {/* 3-Dot Menu Toggle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuOrderId(isMenuOpen ? null : order.id)
                        }
                        className={`p-1.5 rounded-xl border transition cursor-pointer ${
                          isMenuOpen
                            ? 'bg-slate-800 border-slate-600 text-white'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                        title="گزینه‌های بیشتر"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setActiveMenuOrderId(null)}
                          />
                          <div className="absolute left-0 bottom-full mb-1 z-30 w-44 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl py-1 animate-in fade-in">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                setInvoiceOrder(order);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-400 hover:bg-slate-800 transition cursor-pointer text-right"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>مشاهده و چاپ فاکتور</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onOpenDelegateModal(order);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-400 hover:bg-slate-800 transition cursor-pointer text-right border-t border-slate-800/80"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>واگذاری به همکار</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuOrderId(null);
                                onOpenUndeliveredModal(order);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-slate-800 transition cursor-pointer text-right border-t border-slate-800/80"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>ثبت عدم تحویل</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Visitor Invoice Section: فاکتور بار من */}
      <VisitorInvoiceSection
        currentVisitor={currentVisitor}
        orders={orders}
        isOpen={isInvoiceSectionOpen}
        onToggleOpen={() => setIsInvoiceSectionOpen((prev) => !prev)}
      />

      {/* Official B2B Order Invoice Modal with PDF & Print */}
      <OrderInvoiceModal
        isOpen={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        order={invoiceOrder}
        supermarket={
          invoiceOrder
            ? supermarketMap.get(invoiceOrder.supermarket_id) || null
            : null
        }
        visitor={currentVisitor}
      />
    </div>
  );
};
