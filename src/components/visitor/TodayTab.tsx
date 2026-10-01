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
  onCreateLoadingBill: (
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

  // Loading Bill accordion & selection
  const [isBillSectionOpen, setIsBillSectionOpen] = useState(false);
  const [selectedOrdersForBill, setSelectedOrdersForBill] = useState<string[]>([]);
  const [billSuccessMessage, setBillSuccessMessage] = useState<string | null>(null);
  const [billErrorMessage, setBillErrorMessage] = useState<string | null>(null);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);

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

  // Loading bill handler
  const handleGenerateBill = async () => {
    const targetOrderIds =
      selectedOrdersForBill.length > 0
        ? selectedOrdersForBill
        : pendingOrders.map((o) => o.id);

    if (targetOrderIds.length === 0 || isGeneratingBill) return;

    setIsGeneratingBill(true);
    setBillErrorMessage(null);
    setBillSuccessMessage(null);

    try {
      const res = await onCreateLoadingBill(currentVisitor?.id || '', targetOrderIds);
      if (res && res.success) {
        setSelectedOrdersForBill([]);
        setBillSuccessMessage(res.message);
        setTimeout(() => setBillSuccessMessage(null), 5000);
      } else {
        setBillErrorMessage(res?.message || 'خطا در صدور برگه بارگیری.');
        setTimeout(() => setBillErrorMessage(null), 6000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت برگه بارگیری.';
      setBillErrorMessage(msg);
      setTimeout(() => setBillErrorMessage(null), 6000);
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrdersForBill((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

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

      {/* Bill Success Feedback */}
      {billSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{billSuccessMessage}</span>
        </div>
      )}

      {/* Bill Error Feedback */}
      {billErrorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{billErrorMessage}</span>
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
          <div className="space-y-3">
            {activeDeliveryOrders.map((order) => {
              const shop = supermarketMap.get(order.supermarket_id);
              const isMenuOpen = activeMenuOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800/90 shadow-sm relative transition hover:border-slate-700"
                >
                  {/* Card Top: Shop Name & Amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100 truncate">
                          {order.supermarket_name}
                        </span>
                        <span className="text-xs font-mono text-slate-500">{order.id}</span>
                        {order.status === 'loading' && (() => {
                          const bill = order.loading_bill_id
                            ? loadingBills.find((b) => b.id === order.loading_bill_id)
                            : loadingBills.find((b) => b.items?.some((it) => it.order_id === order.id));

                          if (bill?.status === 'approved') {
                            return (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-medium inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <span>تایید شده</span>
                              </span>
                            );
                          }
                          if (bill?.status === 'cancelled') {
                            return (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-700/60 font-medium inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                <span>لغو شده</span>
                              </span>
                            );
                          }
                          return (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-700/60 font-medium inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                              <span>در انتظار انبار</span>
                            </span>
                          );
                        })()}
                      </div>

                      {/* Address / Shop Info */}
                      {!order.supermarket_id ? (
                        <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-1 flex-wrap">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-semibold">فروشگاه حذف شده است</span>
                        </div>
                      ) : !shop ? (
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[11px] font-medium">
                            فروشگاه خارج از لیست شما
                          </span>
                        </div>
                      ) : shop.address ? (
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 min-w-0" title={shop.address}>
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{shop.address}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 min-w-0">
                          <span className="truncate">آدرس ثبت نشده</span>
                        </div>
                      )}
                    </div>

                    <div className="text-left shrink-0">
                      <div className="font-black text-sm text-slate-100">
                        {formatPrice(order.total_amount)}
                      </div>
                      <span className="text-xs text-slate-400">تومان</span>
                    </div>
                  </div>

                  {/* Items Preview Chips */}
                  {order.items && order.items.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 text-xs text-slate-300">
                      {order.items.map((it) => (
                        <span
                          key={it.id}
                          className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg text-xs"
                        >
                          {it.name} ({it.quantity})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Card Actions: Deliver Button + Phone Call + 3-Dot Menu */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                    {/* Big Green Deliver Button */}
                    <button
                      type="button"
                      onClick={() => onDeliverOrder(order.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تحویل شد</span>
                    </button>

                    {/* Phone Call button */}
                    {shop?.phone && (
                      <a
                        href={`tel:${shop.phone}`}
                        title={`تماس با فروشگاه (${shop.phone})`}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition flex items-center justify-center cursor-pointer shrink-0"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}

                    {/* Quick Invoice & Print Button */}
                    <button
                      type="button"
                      onClick={() => setInvoiceOrder(order)}
                      title="مشاهده فاکتور، چاپ کاغذی و دانلود PDF"
                      className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    {/* 3-Dot Menu Toggle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuOrderId(isMenuOpen ? null : order.id)
                        }
                        className={`p-2 rounded-xl border transition cursor-pointer ${
                          isMenuOpen
                            ? 'bg-slate-800 border-slate-600 text-white'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                        title="گزینه‌های بیشتر"
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

      {/* 5. Loading Bill Section (Accordion / Bottom card when pending orders exist) */}
      {pendingOrders.length > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setIsBillSectionOpen((prev) => !prev)}
            className="w-full p-4 flex items-center justify-between text-right hover:bg-slate-800/40 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-100">
                  صدور برگه بارگیری و حواله سردخانه
                </h3>
                <p className="text-xs text-slate-400">
                  ارسال فاکتورهای آماده برای تحویل‌گیری بار از انبار مرکزی
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-xs font-semibold hidden sm:inline-block">
                {selectedOrdersForBill.length > 0
                  ? `${selectedOrdersForBill.length} سفارش انتخاب شده`
                  : 'انتخاب سریع همه'}
              </span>
              {isBillSectionOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {isBillSectionOpen && (
            <div className="p-4 pt-1 border-t border-slate-800 space-y-3 bg-slate-950/40 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span>سفارشات مورد نظر برای صدور حواله را انتخاب کنید:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedOrdersForBill.length === pendingOrders.length) {
                      setSelectedOrdersForBill([]);
                    } else {
                      setSelectedOrdersForBill(pendingOrders.map((o) => o.id));
                    }
                  }}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  {selectedOrdersForBill.length === pendingOrders.length
                    ? 'عدم انتخاب همه'
                    : 'انتخاب همه'}
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pendingOrders.map((ord) => {
                  const isChecked =
                    selectedOrdersForBill.length === 0 ||
                    selectedOrdersForBill.includes(ord.id);

                  return (
                    <label
                      key={ord.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-blue-950/40 border-blue-500/40 text-slate-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOrderSelection(ord.id)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                        />
                        <span className="font-bold truncate">{ord.supermarket_name}</span>
                        <span className="font-mono text-xs text-slate-500">{ord.id}</span>
                      </div>
                      <span className="font-bold text-slate-300 shrink-0">
                        {formatPrice(ord.total_amount)} تومان
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateBill}
                  disabled={isGeneratingBill}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-xs transition shadow-md cursor-pointer ${
                    isGeneratingBill
                      ? 'bg-indigo-800 text-indigo-300 cursor-not-allowed opacity-75'
                      : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25 active:scale-98'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>
                    {isGeneratingBill
                      ? 'در حال صدور برگه بارگیری...'
                      : `صدور برگه بارگیری (${selectedOrdersForBill.length || pendingOrders.length} فاکتور)`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
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
