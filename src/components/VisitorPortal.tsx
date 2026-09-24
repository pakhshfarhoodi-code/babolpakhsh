import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { NewOrderModal } from './NewOrderModal';
import { SupermarketRegisterModal } from './SupermarketRegisterModal';
import {
  Truck,
  Plus,
  Store,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  FileText,
  Clock,
  Send,
  AlertCircle,
  Users,
  BarChart3,
  Calendar,
  Search,
  Printer,
  ChevronLeft,
  TrendingUp,
  Receipt,
  Building2,
  ShoppingBag,
  Package,
  Layers,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';
import { Supermarket, Order } from '../types';

export const VisitorPortal: React.FC = () => {
  const {
    selectedVisitorId,
    visitors,
    supermarkets,
    orders,
    reassignmentRequests,
    loadingBills,
    updateOrderStatus,
    requestReassignment,
    respondToReassignment,
    createLoadingBill,
  } = useApp();

  const currentVisitor = visitors.find((v) => v.id === selectedVisitorId) || visitors[0];

  // Tab State
  const [activeTab, setActiveTab] = useState<'orders' | 'customers'>('orders');

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isRegisterStoreModalOpen, setIsRegisterStoreModalOpen] = useState(false);
  const [selectedSupermarketForOrder, setSelectedSupermarketForOrder] = useState<string | undefined>(undefined);
  const [delegateOrderId, setDelegateOrderId] = useState<string | null>(null);
  const [targetVisitorId, setTargetVisitorId] = useState<string>('');
  const [selectedOrdersForBill, setSelectedOrdersForBill] = useState<string[]>([]);
  const [billCreatedMessage, setBillCreatedMessage] = useState<string | null>(null);

  // Customer Management state
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerTimeFilter, setCustomerTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [selectedCustomerForReport, setSelectedCustomerForReport] = useState<Supermarket | null>(null);
  const [printReportType, setPrintReportType] = useState<'aggregated' | 'individual' | null>(null);

  // Filtered data for current visitor
  const mySupermarkets = useMemo(
    () => supermarkets.filter((s) => s.assigned_visitor_id === currentVisitor.id),
    [supermarkets, currentVisitor.id]
  );

  const myOrders = useMemo(
    () => orders.filter((o) => o.assigned_visitor_id === currentVisitor.id),
    [orders, currentVisitor.id]
  );

  // Incoming handover proposals to this visitor (or open broadcast)
  const incomingHandovers = reassignmentRequests.filter(
    (r) =>
      r.status === 'pending' &&
      r.from_visitor_id !== currentVisitor.id &&
      (!r.to_visitor_id || r.to_visitor_id === currentVisitor.id)
  );

  // Outgoing proposals from this visitor
  const outgoingHandovers = reassignmentRequests.filter(
    (r) => r.from_visitor_id === currentVisitor.id && r.status === 'pending'
  );

  const pendingDeliveryOrders = myOrders.filter((o) => o.status === 'assigned');
  const deliveredOrders = myOrders.filter((o) => o.status === 'delivered');
  const deliveredTotal = deliveredOrders.reduce((sum, o) => sum + o.total_amount, 0);

  // Handlers
  const handleOpenNewOrder = (supermarketId?: string) => {
    setSelectedSupermarketForOrder(supermarketId);
    setIsOrderModalOpen(true);
  };

  const handleDelegateSubmit = (orderId: string) => {
    requestReassignment(orderId, targetVisitorId ? targetVisitorId : null);
    setDelegateOrderId(null);
    setTargetVisitorId('');
  };

  const handleGenerateLoadingBill = () => {
    if (selectedOrdersForBill.length === 0) return;
    createLoadingBill(currentVisitor.id, selectedOrdersForBill);
    setSelectedOrdersForBill([]);
    setBillCreatedMessage('برگه بارگیری با موفقیت صادر و جهت تایید به انبار سردخانه ارسال شد.');
    setTimeout(() => setBillCreatedMessage(null), 4000);
  };

  const toggleOrderSelectionForBill = (orderId: string) => {
    setSelectedOrdersForBill((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Helper to convert Persian digits to English digits
  const toEnglishDigits = (str: string) =>
    str.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());

  // Convert Jalali date (year, month, day) to an absolute day count
  const jalaliToDayCount = (y: number, m: number, d: number): number => {
    let days = y * 365 + Math.floor((y * 682 - 110) / 2816);
    if (m <= 6) {
      days += (m - 1) * 31;
    } else {
      days += 6 * 31 + (m - 7) * 30;
    }
    days += d;
    return days;
  };

  // Get current Jalali date parts
  const getTodayJalali = () => {
    try {
      const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()).split('/');
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10),
      };
    } catch {
      return { year: 1403, month: 7, day: 1 };
    }
  };

  // Helper to filter orders by time range
  const filterOrdersByTime = (
    orderList: Order[],
    timeRange: 'all' | 'today' | 'week' | 'month' | 'year'
  ) => {
    if (timeRange === 'all') return orderList;

    const today = getTodayJalali();
    const todayDayCount = jalaliToDayCount(today.year, today.month, today.day);

    return orderList.filter((o) => {
      const norm = toEnglishDigits(o.order_date || '');
      const match = norm.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (!match) return true;

      const oYear = parseInt(match[1], 10);
      const oMonth = parseInt(match[2], 10);
      const oDay = parseInt(match[3], 10);
      const orderDayCount = jalaliToDayCount(oYear, oMonth, oDay);
      const daysDiff = todayDayCount - orderDayCount;

      if (timeRange === 'today') {
        return daysDiff === 0 || (oYear === today.year && oMonth === today.month && oDay === today.day);
      }
      if (timeRange === 'week') {
        return daysDiff >= 0 && daysDiff <= 6;
      }
      if (timeRange === 'month') {
        return (oYear === today.year && oMonth === today.month) || (daysDiff >= 0 && daysDiff <= 30);
      }
      if (timeRange === 'year') {
        return oYear === today.year || oYear === 1403 || oYear === 1404;
      }
      return true;
    });
  };

  // Filtered orders according to time filter
  const timeFilteredMyOrders = useMemo(
    () => filterOrdersByTime(myOrders, customerTimeFilter),
    [myOrders, customerTimeFilter]
  );

  // Aggregated analytics across all customers
  const aggregatedStats = useMemo(() => {
    const totalRevenue = timeFilteredMyOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalOrdersCount = timeFilteredMyOrders.length;
    const deliveredCount = timeFilteredMyOrders.filter((o) => o.status === 'delivered').length;
    const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;
    const activeCustomerCount = mySupermarkets.length;

    return {
      totalRevenue,
      totalOrdersCount,
      deliveredCount,
      avgOrderValue,
      activeCustomerCount,
    };
  }, [timeFilteredMyOrders, mySupermarkets]);

  // Customer detailed metrics for list and ranking
  const customersReportData = useMemo(() => {
    return mySupermarkets
      .map((shop) => {
        const shopOrders = timeFilteredMyOrders.filter((o) => o.supermarket_id === shop.id);
        const allShopOrders = myOrders.filter((o) => o.supermarket_id === shop.id);
        const totalPurchases = shopOrders.reduce((sum, o) => sum + o.total_amount, 0);
        const deliveredPurchases = shopOrders
          .filter((o) => o.status === 'delivered')
          .reduce((sum, o) => sum + o.total_amount, 0);
        const ordersCount = shopOrders.length;

        // Share of visitor's total sales
        const sharePercent =
          aggregatedStats.totalRevenue > 0
            ? Math.round((totalPurchases / aggregatedStats.totalRevenue) * 100)
            : 0;

        // Last order
        const lastOrder = [...allShopOrders].sort((a, b) => b.id.localeCompare(a.id))[0];

        return {
          supermarket: shop,
          ordersCount,
          totalPurchases,
          deliveredPurchases,
          sharePercent,
          lastOrderDate: lastOrder ? lastOrder.order_date : 'بدون سفارش',
          recentOrders: allShopOrders,
        };
      })
      .filter((item) => {
        if (!customerSearchTerm.trim()) return true;
        const term = customerSearchTerm.trim().toLowerCase();
        return (
          item.supermarket.name.toLowerCase().includes(term) ||
          item.supermarket.owner.toLowerCase().includes(term) ||
          item.supermarket.phone.includes(term) ||
          item.supermarket.address.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.totalPurchases - a.totalPurchases);
  }, [mySupermarkets, timeFilteredMyOrders, myOrders, customerSearchTerm, aggregatedStats.totalRevenue]);

  // Specific customer report data if selected
  const activeCustomerReport = useMemo(() => {
    if (!selectedCustomerForReport) return null;
    const customerOrders = timeFilteredMyOrders.filter(
      (o) => o.supermarket_id === selectedCustomerForReport.id
    );
    const allCustomerOrders = myOrders.filter(
      (o) => o.supermarket_id === selectedCustomerForReport.id
    );
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const deliveredAmount = customerOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total_amount, 0);

    // Most purchased items
    const itemMap = new Map<string, { name: string; count: number; total: number }>();
    customerOrders.forEach((o) => {
      o.items?.forEach((it) => {
        const existing = itemMap.get(it.product_id) || { name: it.name, count: 0, total: 0 };
        existing.count += it.quantity;
        existing.total += it.price * it.quantity;
        itemMap.set(it.product_id, existing);
      });
    });
    const topItems = Array.from(itemMap.values()).sort((a, b) => b.count - a.count);

    return {
      supermarket: selectedCustomerForReport,
      orders: customerOrders,
      allOrders: allCustomerOrders,
      totalAmount,
      deliveredAmount,
      ordersCount: customerOrders.length,
      topItems,
    };
  }, [selectedCustomerForReport, timeFilteredMyOrders, myOrders]);

  return (
    <div className="space-y-6">
      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>سفارشات و عملیات توزیع</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 border border-slate-700">
              {myOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>مدیریت مشتریان و گزارشات آماری</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 border border-slate-700">
              {mySupermarkets.length} فروشگاه
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleOpenNewOrder()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/25 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت سفارش ویزیت حضوری</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: ORDERS & DELIVERY
          ======================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-xs text-slate-400">سفارشات در انتظار توزیع</p>
              <p className="text-xl font-bold text-amber-400 mt-1">
                {pendingDeliveryOrders.length}{' '}
                <span className="text-xs font-normal text-slate-400">فاکتور</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-xs text-slate-400">فروش موفق امروز</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">
                {deliveredTotal.toLocaleString('fa-IR')}{' '}
                <span className="text-xs font-normal text-slate-400">تومان</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <p className="text-xs text-slate-400">سوپرمارکت‌های تحت پوشش</p>
              <p className="text-xl font-bold text-blue-400 mt-1">
                {mySupermarkets.length}{' '}
                <span className="text-xs font-normal text-slate-400">مشتری دائم</span>
              </p>
            </div>
          </div>

          {/* Incoming Handovers Alert */}
          {incomingHandovers.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <ArrowRightLeft className="w-4 h-4" />
                <span>پیشنهاد انتقال سفارش جدید از همکاران ({incomingHandovers.length} مورد)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {incomingHandovers.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">{req.supermarket_name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        از طرف: <span className="text-slate-300">{req.from_visitor_name}</span> ({req.timestamp})
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => respondToReassignment(req.id, true)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] cursor-pointer"
                      >
                        پذیرش سفارش
                      </button>
                      <button
                        onClick={() => respondToReassignment(req.id, false)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] cursor-pointer"
                      >
                        رد
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {billCreatedMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{billCreatedMessage}</span>
            </div>
          )}

          {/* Main Grid: Orders & Fast Route */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders Column (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>فهرست سفارشات من و صدور برگه بارگیری</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      سفارشات آماده ارسال را تیک بزنید و حواله بارگیری انبار صادر کنید.
                    </p>
                  </div>

                  {pendingDeliveryOrders.length > 0 && (
                    <button
                      disabled={selectedOrdersForBill.length === 0}
                      onClick={handleGenerateLoadingBill}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>صدور برگه بارگیری سردخانه ({selectedOrdersForBill.length})</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3 mt-4">
                  {myOrders.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      سفارشی برای این ویزیتور ثبت نشده است. با دکمه بالا سفارش جدید ثبت کنید.
                    </div>
                  ) : (
                    myOrders.map((order) => {
                      const isSelected = selectedOrdersForBill.includes(order.id);
                      const isAssigned = order.status === 'assigned';

                      return (
                        <div
                          key={order.id}
                          className={`p-3.5 rounded-xl border transition ${
                            isSelected
                              ? 'bg-blue-950/30 border-blue-500/50'
                              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              {isAssigned && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleOrderSelectionForBill(order.id)}
                                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                                />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-blue-400">{order.id}</span>
                                  <span className="font-semibold text-xs text-slate-200">{order.supermarket_name}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{order.order_date}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-200">
                                {order.total_amount.toLocaleString('fa-IR')} تومان
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                  order.status === 'delivered'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : order.status === 'delegated'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : order.status === 'undelivered'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                }`}
                              >
                                {order.status === 'delivered'
                                  ? 'تحویل شد'
                                  : order.status === 'delegated'
                                  ? 'در حال واگذاری'
                                  : order.status === 'undelivered'
                                  ? 'عدم تحویل'
                                  : 'آماده ارسال'}
                              </span>
                            </div>
                          </div>

                          {/* Items Preview */}
                          {order.items && order.items.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 text-[11px]">
                              {order.items.map((it) => (
                                <span
                                  key={it.id}
                                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                                >
                                  {it.name} ({it.quantity})
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          {isAssigned && (
                            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                              <button
                                onClick={() => setDelegateOrderId(order.id)}
                                className="flex items-center gap-1 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>واگذاری به همکار دیگر</span>
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'undelivered')}
                                  className="px-2.5 py-1 rounded bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/60 flex items-center gap-1 text-[11px] cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>عدم تحویل</span>
                                </button>
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'delivered')}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 text-[11px] cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>ثبت تحویل موفق</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Quick Route Column (1 col) */}
            <div className="space-y-4">
              <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Store className="w-4 h-4 text-blue-400" />
                    <span>مسیر ویزیت سوپرمارکت‌ها</span>
                  </h3>
                  <span className="text-xs text-slate-400">{mySupermarkets.length} فروشگاه</span>
                </div>

                <div className="space-y-3 mt-3">
                  {mySupermarkets.map((shop) => (
                    <div key={shop.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{shop.name}</span>
                        <span className="text-[11px] text-slate-400">{shop.owner}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span>{shop.address}</span>
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
                        <a
                          href={`tel:${shop.phone}`}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[11px]"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{shop.phone}</span>
                        </a>
                        <button
                          onClick={() => handleOpenNewOrder(shop.id)}
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>ثبت سفارش</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: CUSTOMERS & ANALYTICAL REPORTS
          ======================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Controls Bar: Time Filter, Search & Print Buttons */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <input
                  type="text"
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  placeholder="جستجوی فروشگاه، نام مالک یا شماره تماس..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
              </div>

              {/* Time Range Filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setCustomerTimeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                    customerTimeFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  همه سوابق
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTimeFilter('today')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                    customerTimeFilter === 'today'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  امروز
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTimeFilter('week')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                    customerTimeFilter === 'week'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  این هفته
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTimeFilter('month')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                    customerTimeFilter === 'month'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ماه جاری
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerTimeFilter('year')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                    customerTimeFilter === 'year'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  سال جاری
                </button>
              </div>
            </div>

            {/* Print & Store Creation Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintReportType('aggregated')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition cursor-pointer shadow-sm"
                title="مشاهده و چاپ گزارش تجمیعی کل مشتریان"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>چاپ کارنامه تجمیعی کل</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRegisterStoreModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>+ ثبت مشتری (فروشگاه) جدید</span>
              </button>
            </div>
          </div>

          {/* Section 1: Aggregated Summary Cards (تجمیع کل مشتریان) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>گزارش تجمیعی کل مشتریان و عملکرد فروش</span>
                <span className="text-xs font-normal text-slate-400">
                  (بازه زمانی:{' '}
                  {customerTimeFilter === 'all'
                    ? 'کل دوران'
                    : customerTimeFilter === 'today'
                    ? 'امروز'
                    : customerTimeFilter === 'week'
                    ? 'این هفته'
                    : customerTimeFilter === 'month'
                    ? 'ماه جاری'
                    : 'سال جاری'}
                  )
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                <p className="text-xs text-slate-400">مجموع فروش تجمیعی</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {aggregatedStats.totalRevenue.toLocaleString('fa-IR')}{' '}
                  <span className="text-xs font-normal text-slate-400">تومان</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                <p className="text-xs text-slate-400">تعداد کل فاکتورها</p>
                <p className="text-lg font-bold text-blue-400 mt-1">
                  {aggregatedStats.totalOrdersCount}{' '}
                  <span className="text-xs font-normal text-slate-400">سفارش</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                <p className="text-xs text-slate-400">میانگین هر سفارش</p>
                <p className="text-lg font-bold text-amber-400 mt-1">
                  {aggregatedStats.avgOrderValue.toLocaleString('fa-IR')}{' '}
                  <span className="text-xs font-normal text-slate-400">تومان</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
                <p className="text-xs text-slate-400">مشتریان فعال تحت پوشش</p>
                <p className="text-lg font-bold text-purple-400 mt-1">
                  {aggregatedStats.activeCustomerCount}{' '}
                  <span className="text-xs font-normal text-slate-400">فروشگاه</span>
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Detailed Customer Comparison Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>فهرست فروشگاه‌های مشتری و سهم فروش</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  جهت مشاهده کارنامه و سفارشات قبلی هر مشتری، روی دکمه گزارش تکی کلیک کنید.
                </p>
              </div>
              <span className="text-xs text-slate-400">{customersReportData.length} مشتری</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4 font-semibold">رتبه</th>
                    <th className="py-3 px-4 font-semibold">نام فروشگاه و مدیر</th>
                    <th className="py-3 px-4 font-semibold">تلفن و آدرس</th>
                    <th className="py-3 px-4 font-semibold text-center">تعداد فاکتور</th>
                    <th className="py-3 px-4 font-semibold">مبلغ کل خرید</th>
                    <th className="py-3 px-4 font-semibold">سهم از کل فروش</th>
                    <th className="py-3 px-4 font-semibold">آخرین خرید</th>
                    <th className="py-3 px-4 font-semibold text-center">عملیات و کارنامه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {customersReportData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        مشتری مطابق با فیلتر یافت نشد. با دکمه بالا فروشگاه جدید ثبت کنید.
                      </td>
                    </tr>
                  ) : (
                    customersReportData.map((item, idx) => (
                      <tr
                        key={item.supermarket.id}
                        className={`hover:bg-slate-800/40 transition ${
                          selectedCustomerForReport?.id === item.supermarket.id
                            ? 'bg-blue-950/30 border-r-4 border-r-blue-500'
                            : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-100 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{item.supermarket.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">مدیریت: {item.supermarket.owner}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          <div className="flex items-center gap-1 text-[11px] text-blue-300">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <a href={`tel:${item.supermarket.phone}`} className="hover:underline">
                              {item.supermarket.phone}
                            </a>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            {item.supermarket.address}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold">
                            {item.ordersCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-emerald-400 text-sm">
                            {item.totalPurchases.toLocaleString('fa-IR')}
                          </span>{' '}
                          <span className="text-[10px] text-slate-400">تومان</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${Math.min(100, item.sharePercent)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-300">{item.sharePercent}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-400">
                          {item.lastOrderDate}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenNewOrder(item.supermarket.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition text-xs font-bold cursor-pointer shadow-sm shadow-emerald-600/25 whitespace-nowrap"
                              title="ثبت سفارش حضوری برای این فروشگاه"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>ثبت سفارش</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedCustomerForReport(item.supermarket)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition text-xs font-semibold cursor-pointer whitespace-nowrap"
                              title="مشاهده کارنامه و سفارشات قبلی این مشتری"
                            >
                              گزارش تکی
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Individual Customer Report Drilldown (گزارش تکی مشتری) */}
          {activeCustomerReport && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-blue-800/50 shadow-xl space-y-5 animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-slate-100">
                        کارنامه و گزارش تفصیلی «{activeCustomerReport.supermarket.name}»
                      </h4>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/40">
                        مشتری اختصاصی
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      مدیریت: {activeCustomerReport.supermarket.owner} | تلفن: {activeCustomerReport.supermarket.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintReportType('individual')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer shadow-sm transition"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                    <span>چاپ کارنامه این مشتری</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenNewOrder(activeCustomerReport.supermarket.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت سفارش برای این فروشگاه</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCustomerForReport(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer"
                    title="بستن گزارش تکی"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Individual KPI Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[11px] text-slate-400">مجموع خرید در بازه انتخابی</p>
                  <p className="text-base font-bold text-emerald-400 mt-1">
                    {activeCustomerReport.totalAmount.toLocaleString('fa-IR')} تومان
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[11px] text-slate-400">تعداد فاکتورهای ثبت شده</p>
                  <p className="text-base font-bold text-blue-400 mt-1">
                    {activeCustomerReport.ordersCount} فاکتور
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[11px] text-slate-400">آدرس تحویل سفارشات</p>
                  <p className="text-xs text-slate-300 mt-1 truncate" title={activeCustomerReport.supermarket.address}>
                    {activeCustomerReport.supermarket.address}
                  </p>
                </div>
              </div>

              {/* Orders History of This Customer */}
              <div>
                <h5 className="font-bold text-xs text-slate-200 mb-2.5 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-blue-400" />
                  <span>ریز سفارشات قبلی این مشتری ({activeCustomerReport.orders.length} فاکتور)</span>
                </h5>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {activeCustomerReport.orders.length === 0 ? (
                    <div className="py-4 text-center text-slate-500 text-xs">
                      سفارشی در این بازه زمانی برای این فروشگاه ثبت نشده است.
                    </div>
                  ) : (
                    activeCustomerReport.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-blue-400">{ord.id}</span>
                            <span className="text-slate-400">تاریخ: {ord.order_date}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1 text-[11px] text-slate-300">
                            {ord.items?.map((it) => (
                              <span key={it.id} className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                                {it.name} ({it.quantity})
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-200">
                            {ord.total_amount.toLocaleString('fa-IR')} تومان
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              ord.status === 'delivered'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : ord.status === 'undelivered'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {ord.status === 'delivered' ? 'تحویل شد' : ord.status === 'undelivered' ? 'عدم تحویل' : 'در حال پردازش'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          PRINT / EXPORT MODAL (AGGREGATED & INDIVIDUAL)
          ======================================================== */}
      {printReportType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <h4 className="font-bold text-sm text-slate-100">
                  {printReportType === 'aggregated'
                    ? 'پیش‌نمایش چاپ گزارش تجمیعی کل مشتریان'
                    : `پیش‌نمایش چاپ کارنامه مالی «${selectedCustomerForReport?.name}»`}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>پرینت گزارش</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintReportType(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="p-6 overflow-y-auto space-y-5 bg-white text-slate-900 print:p-0 print:m-0">
              {/* Report Header Paper style */}
              <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">سامانه پخش مویرگی البرز</h2>
                  <p className="text-xs text-slate-600">شبکه توزیع سراسری و زنجیره سرد منجمد</p>
                </div>
                <div className="text-left text-xs text-slate-700">
                  <p>
                    <strong>ویزیتور مسئول:</strong> {currentVisitor.name}
                  </p>
                  <p>
                    <strong>منطقه توزیع:</strong> {currentVisitor.region}
                  </p>
                  <p>
                    <strong>تاریخ گزارش:</strong>{' '}
                    {new Intl.DateTimeFormat('fa-IR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    }).format(new Date())}
                  </p>
                </div>
              </div>

              {printReportType === 'aggregated' ? (
                <>
                  <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 text-xs flex justify-between">
                    <span>
                      <strong>بازه زمانی گزارش:</strong>{' '}
                      {customerTimeFilter === 'all'
                        ? 'کلیه سوابق'
                        : customerTimeFilter === 'today'
                        ? 'امروز'
                        : customerTimeFilter === 'week'
                        ? 'این هفته'
                        : customerTimeFilter === 'month'
                        ? 'ماه جاری'
                        : 'سال جاری'}
                    </span>
                    <span>
                      <strong>تعداد مشتریان تحت پوشش:</strong> {mySupermarkets.length} فروشگاه
                    </span>
                    <span>
                      <strong>مجموع کل گردش مالی:</strong>{' '}
                      {aggregatedStats.totalRevenue.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>

                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-200 border-b border-slate-400 text-slate-800">
                        <th className="py-2 px-2 border border-slate-300">ردیف</th>
                        <th className="py-2 px-2 border border-slate-300">نام فروشگاه</th>
                        <th className="py-2 px-2 border border-slate-300">مدیر فروشگاه</th>
                        <th className="py-2 px-2 border border-slate-300">تلفن تماس</th>
                        <th className="py-2 px-2 border border-slate-300 text-center">تعداد فاکتور</th>
                        <th className="py-2 px-2 border border-slate-300">مجموع خرید (تومان)</th>
                        <th className="py-2 px-2 border border-slate-300 text-center">سهم فروش</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customersReportData.map((c, i) => (
                        <tr key={c.supermarket.id} className="border-b border-slate-200">
                          <td className="py-2 px-2 border border-slate-300 text-center">{i + 1}</td>
                          <td className="py-2 px-2 border border-slate-300 font-bold">{c.supermarket.name}</td>
                          <td className="py-2 px-2 border border-slate-300">{c.supermarket.owner}</td>
                          <td className="py-2 px-2 border border-slate-300 dir-ltr">{c.supermarket.phone}</td>
                          <td className="py-2 px-2 border border-slate-300 text-center font-bold">
                            {c.ordersCount}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 font-bold text-slate-900">
                            {c.totalPurchases.toLocaleString('fa-IR')}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-center">{c.sharePercent}%</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400">
                        <td colSpan={4} className="py-2 px-2 border border-slate-300 text-left">
                          جمع کل تجمیعی:
                        </td>
                        <td className="py-2 px-2 border border-slate-300 text-center">
                          {aggregatedStats.totalOrdersCount}
                        </td>
                        <td className="py-2 px-2 border border-slate-300">
                          {aggregatedStats.totalRevenue.toLocaleString('fa-IR')} تومان
                        </td>
                        <td className="py-2 px-2 border border-slate-300 text-center">۱۰۰٪</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              ) : (
                <>
                  {activeCustomerReport && (
                    <div className="space-y-4">
                      <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 text-xs space-y-1">
                        <p>
                          <strong>فروشگاه مشتری:</strong> {activeCustomerReport.supermarket.name} |{' '}
                          <strong>مدیریت:</strong> {activeCustomerReport.supermarket.owner}
                        </p>
                        <p>
                          <strong>شماره تماس:</strong> {activeCustomerReport.supermarket.phone} |{' '}
                          <strong>آدرس:</strong> {activeCustomerReport.supermarket.address}
                        </p>
                        <p>
                          <strong>مجموع خرید ثبت‌شده:</strong>{' '}
                          {activeCustomerReport.totalAmount.toLocaleString('fa-IR')} تومان |{' '}
                          <strong>تعداد کل فاکتورها:</strong> {activeCustomerReport.ordersCount} فاکتور
                        </p>
                      </div>

                      <h4 className="font-bold text-xs text-slate-800">ریز فاکتورهای سفارش داده شده:</h4>
                      <table className="w-full text-right text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-200 border-b border-slate-400 text-slate-800">
                            <th className="py-2 px-2 border border-slate-300">شماره فاکتور</th>
                            <th className="py-2 px-2 border border-slate-300">تاریخ ثبت</th>
                            <th className="py-2 px-2 border border-slate-300">اقلام سفارش</th>
                            <th className="py-2 px-2 border border-slate-300">مبلغ (تومان)</th>
                            <th className="py-2 px-2 border border-slate-300 text-center">وضعیت</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeCustomerReport.orders.map((ord) => (
                            <tr key={ord.id} className="border-b border-slate-200">
                              <td className="py-2 px-2 border border-slate-300 font-mono font-bold">{ord.id}</td>
                              <td className="py-2 px-2 border border-slate-300">{ord.order_date}</td>
                              <td className="py-2 px-2 border border-slate-300">
                                {ord.items?.map((it) => `${it.name} (${it.quantity})`).join('، ')}
                              </td>
                              <td className="py-2 px-2 border border-slate-300 font-bold">
                                {ord.total_amount.toLocaleString('fa-IR')}
                              </td>
                              <td className="py-2 px-2 border border-slate-300 text-center">
                                {ord.status === 'delivered' ? 'تحویل شد' : 'ثبت شده'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Signatures Footer */}
              <div className="pt-8 grid grid-cols-2 text-center text-xs text-slate-700">
                <div>
                  <p>امضاء و تایید ویزیتور مسئول</p>
                  <p className="mt-8 font-bold">{currentVisitor.name}</p>
                </div>
                <div>
                  <p>مهر و تایید سرپرست فروش / حسابداری</p>
                  <p className="mt-8">......................................</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delegate / Transfer order */}
      {delegateOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-bold text-sm text-slate-100 mb-2">واگذاری سفارش {delegateOrderId}</h3>
            <p className="text-xs text-slate-400 mb-3">
              در صورت عدم امکان تحویل، این سفارش را به همکار دیگر یا تابلوی عمومی ویزیتورها منتقل کنید:
            </p>

            <select
              value={targetVisitorId}
              onChange={(e) => setTargetVisitorId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-4 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">انتشار عمومی برای همه همکاران</option>
              {visitors
                .filter((v) => v.id !== currentVisitor.id)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.region})
                  </option>
                ))}
            </select>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDelegateOrderId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => handleDelegateSubmit(delegateOrderId)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
              >
                ارسال پیشنهاد واگذاری
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      <NewOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        defaultSupermarketId={selectedSupermarketForOrder}
        defaultVisitorId={currentVisitor.id}
      />

      {/* Register Supermarket Modal */}
      <SupermarketRegisterModal
        isOpen={isRegisterStoreModalOpen}
        onClose={() => setIsRegisterStoreModalOpen(false)}
        defaultVisitorId={currentVisitor.id}
      />
    </div>
  );
};
