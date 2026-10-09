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
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MapPin,
  Package,
  Plus,
  Navigation,
} from 'lucide-react';
import { isToday, formatPrice } from './helpers';
import { OrderInvoiceModal } from '../invoice/OrderInvoiceModal';

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
  onOpenNewOrder?: () => void;
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
  onOpenNewOrder,
}) => {
  const { loadingBills } = useApp();

  // Active menu dropdown state for card actions
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // Expanded items state per order (default closed)
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  const toggleOrderItems = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Combined handovers collapsible state (default open if incoming requests exist, else closed)
  const totalHandovers = incomingHandovers.length + outgoingHandovers.length;
  const [isHandoversOpen, setIsHandoversOpen] = useState(() => incomingHandovers.length > 0);

  // Supermarket lookup map built from allSupermarkets (full database list)
  const supermarketListToUse = allSupermarkets && allSupermarkets.length > 0 ? allSupermarkets : supermarkets;

  const supermarketMap = useMemo(() => {
    const map = new Map<string, Supermarket>();
    supermarketListToUse.forEach((s) => map.set(s.id, s));
    return map;
  }, [supermarketListToUse]);

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
      {/* 1. Top Sleek KPI Bar */}
      <div className="px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-y-1.5 gap-x-3 text-xs sm:text-sm text-slate-300">
        <div className="flex items-center gap-1.5">
          <Truck className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="num-fa font-bold text-amber-400">{activeDeliveryOrders.length.toLocaleString('fa-IR')}</strong> سفارش در انتظار تحویل
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-600 hidden xs:inline">·</span>
          <span>
            <strong className="num-fa font-bold text-emerald-400">{formatPrice(todayDeliveredTotal)}</strong> تومان تحویل‌شده امروز
          </span>
          {todayDeliveredCount > 0 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-medium inline-flex items-center gap-1">
                <span className="num-fa font-bold">{todayDeliveredCount.toLocaleString('fa-IR')}</span>
                <span>موفق</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Combined Collapsible Handovers Section */}
      {totalHandovers > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setIsHandoversOpen((prev) => !prev)}
            className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-2 text-right hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ArrowRightLeft className={`w-4 h-4 ${incomingHandovers.length > 0 ? 'text-amber-400' : 'text-blue-400'}`} />
              <span className="font-bold text-xs sm:text-sm text-slate-200">
                درخواست‌های واگذاری ({totalHandovers.toLocaleString('fa-IR')})
              </span>
              {incomingHandovers.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                  {incomingHandovers.length.toLocaleString('fa-IR')} ورودی
                </span>
              )}
            </div>
            <div className="text-slate-400">
              {isHandoversOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isHandoversOpen && (
            <div className="p-3 sm:p-3.5 pt-0 space-y-3 border-t border-slate-800/60">
              {/* Incoming handovers */}
              {incomingHandovers.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <span>پیشنهاد انتقال سفارش جدید از همکاران ({incomingHandovers.length.toLocaleString('fa-IR')})</span>
                  </div>
                  <div className="space-y-2">
                    {incomingHandovers.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-xl bg-slate-950 border border-amber-500/20 text-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5"
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

              {/* Outgoing handovers */}
              {outgoingHandovers.length > 0 && (
                <div className="space-y-2 pt-2">
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
            </div>
          )}
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
          <div className="py-6 px-4 text-center rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-200">همه سفارش‌ها تحویل داده شده‌اند</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              سفارش در انتظار تحویلی برای امروز وجود ندارد.
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
              const isItemsExpanded = expandedOrderIds.has(order.id);

              return (
                <div
                  key={order.id}
                  className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xs relative transition hover:border-slate-700 flex flex-col justify-between gap-1.5"
                >
                  {/* Line 1: Shop Name (truncate) & Amount (num-fa, bold) */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="font-bold text-xs sm:text-sm text-slate-100 truncate" title={displayStoreName}>
                        {displayStoreName}
                      </span>
                      {order.status === 'loading' && (() => {
                        const bill = order.loading_bill_id
                          ? loadingBills.find((b) => b.id === order.loading_bill_id)
                          : loadingBills.find((b) => b.items?.some((it) => it.order_id === order.id));

                        if (bill?.status === 'approved') {
                          return (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950/90 text-blue-300 border border-blue-700/50 font-medium inline-flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>تایید شده</span>
                            </span>
                          );
                        }
                        if (bill?.status === 'loaded') {
                          return (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/50 font-medium inline-flex items-center gap-1 shrink-0">
                              <Truck className="w-2.5 h-2.5 text-emerald-400" />
                              <span>بارگیری شد</span>
                            </span>
                          );
                        }
                        if (bill?.status === 'cancelled') {
                          return (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950/90 text-rose-300 border border-rose-700/50 font-medium inline-flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                              <span>لغو شده</span>
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/90 text-amber-300 border border-amber-700/50 font-medium inline-flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            <span>در انتظار انبار</span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="text-left shrink-0 flex items-baseline gap-1">
                      <span className="num-fa font-black text-xs sm:text-sm text-slate-100">
                        {formatPrice(order.total_amount)}
                      </span>
                      <span className="text-[10px] text-slate-400">تومان</span>
                    </div>
                  </div>

                  {/* Line 2: Single-line address (truncate) & small, muted Order ID */}
                  <div className="flex items-center justify-between gap-2 min-w-0 text-[11px]">
                    <div className="min-w-0 flex-1 truncate">
                      {isDeletedStore ? (
                        <span className="text-rose-400 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span className="truncate">فروشگاه حذف شده است</span>
                        </span>
                      ) : shop?.address ? (
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="text-slate-400 flex items-center gap-1 min-w-0" title={shop.address}>
                            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{shop.address}</span>
                          </span>
                          {typeof shop.latitude === 'number' && typeof shop.longitude === 'number' && (
                            <a
                              href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition shrink-0"
                              title="مسیریابی روی نقشه"
                            >
                              <Navigation className="w-2.5 h-2.5" />
                              <span>نقشه</span>
                            </a>
                          )}
                        </div>
                      ) : orderCustomerLabel ? (
                        <span className="text-purple-300 truncate">
                          {orderCustomerLabel.includes('همراه ویزیتور') || orderCustomerLabel.includes('مازاد خودرو') || orderCustomerLabel === 'مازاد خودرو / مستقیم'
                            ? 'اقلام مازاد'
                            : `اقلام مازاد: ${orderCustomerLabel}`}
                        </span>
                      ) : (
                        <span className="text-slate-500 truncate">آدرس ثبت نشده</span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-slate-500 bg-slate-950/80 px-1 py-0.5 rounded border border-slate-800/80 shrink-0">
                      #{order.id}
                    </span>
                  </div>

                  {/* Line 3: "N items" button (default closed) */}
                  {order.items && order.items.length > 0 && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleOrderItems(order.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 py-0.5 px-2 rounded-lg bg-slate-950/70 border border-slate-800/80 transition cursor-pointer"
                        title={isItemsExpanded ? 'بستن اقلام سفارش' : 'مشاهده اقلام سفارش'}
                        aria-label={isItemsExpanded ? 'بستن اقلام سفارش' : 'مشاهده اقلام سفارش'}
                      >
                        <Package className="w-3 h-3 text-slate-400" />
                        <span>
                          <strong className="num-fa font-bold">{order.items.length.toLocaleString('fa-IR')}</strong> قلم
                        </span>
                        {isItemsExpanded ? (
                          <ChevronUp className="w-3 h-3 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-slate-500" />
                        )}
                      </button>

                      {isItemsExpanded && (
                        <div className="pt-1 flex flex-wrap gap-1 text-[11px] text-slate-300 animate-in fade-in">
                          {order.items.map((it) => (
                            <span
                              key={it.id}
                              className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded-md text-[10.5px] text-slate-300"
                            >
                              {it.name} (<span className="num-fa">{it.quantity.toLocaleString('fa-IR')}</span>)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Line 4: Action row with 40x40px icon buttons and flex-1 h-10 deliver button */}
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center gap-1.5">
                    {/* Big Green Deliver Button: flex-1, h-10 */}
                    <button
                      type="button"
                      onClick={() => onDeliverOrder(order.id)}
                      className="h-10 flex-1 flex items-center justify-center gap-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs transition shadow-sm shadow-emerald-600/20 cursor-pointer"
                      title="تایید تحویل سفارش"
                      aria-label="تایید تحویل سفارش"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>تحویل شد</span>
                    </button>

                    {/* Phone Call button: 40x40px */}
                    {shop?.phone ? (
                      <a
                        href={`tel:${shop.phone}`}
                        title="تماس با مشتری"
                        aria-label="تماس با مشتری"
                        className="w-10 h-10 shrink-0 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700/80 transition flex items-center justify-center cursor-pointer"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="شماره تماس ثبت نشده"
                        aria-label="شماره تماس ثبت نشده"
                        className="w-10 h-10 shrink-0 rounded-xl bg-slate-900/60 text-slate-600 border border-slate-800 transition flex items-center justify-center cursor-not-allowed opacity-60"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    )}

                    {/* Quick Invoice & Print Button: 40x40px */}
                    <button
                      type="button"
                      onClick={() => setInvoiceOrder(order)}
                      title="مشاهده و چاپ فاکتور"
                      aria-label="مشاهده و چاپ فاکتور"
                      className="w-10 h-10 shrink-0 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition flex items-center justify-center cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    {/* 3-Dot Menu Toggle: 40x40px */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuOrderId(isMenuOpen ? null : order.id)
                        }
                        className={`w-10 h-10 rounded-xl border transition flex items-center justify-center cursor-pointer ${
                          isMenuOpen
                            ? 'bg-slate-800 border-slate-600 text-white'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                        title="گزینه‌های بیشتر"
                        aria-label="گزینه‌های بیشتر"
                      >
                        <MoreVertical className="w-4 h-4" />
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

      {/* Mobile Floating Action Button (FAB) for New Order (only visible on mobile, at bottom-20) */}
      {onOpenNewOrder && (
        <button
          type="button"
          onClick={onOpenNewOrder}
          className="sm:hidden fixed bottom-20 left-4 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-xl shadow-blue-600/40 flex items-center justify-center border-2 border-slate-900 transition cursor-pointer"
          title="ثبت سفارش جدید"
          aria-label="ثبت سفارش جدید"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

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
