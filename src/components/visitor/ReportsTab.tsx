import React, { useState, useMemo } from 'react';
import { Supermarket, Order, Visitor } from '../../types';
import {
  BarChart3,
  Search,
  Printer,
  X,
  Store,
  Phone,
  Plus,
  Building2,
  Receipt,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
} from 'lucide-react';
import {
  toEnglishDigits,
  getTodayJalali,
  jalaliToDayCount,
  formatPrice,
} from './helpers';

interface ReportsTabProps {
  currentVisitor: Visitor;
  customers: Supermarket[];
  orders: Order[];
  onOpenNewOrder: (customerId: string) => void;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  currentVisitor,
  customers,
  orders,
  onOpenNewOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [selectedCustomerForReport, setSelectedCustomerForReport] = useState<Supermarket | null>(null);
  const [printReportType, setPrintReportType] = useState<'aggregated' | 'individual' | null>(null);

  // Time filter logic
  const filterOrdersByTime = (
    orderList: Order[],
    range: 'all' | 'today' | 'week' | 'month' | 'year'
  ) => {
    if (range === 'all') return orderList;

    const today = getTodayJalali();
    const todayDayCount = jalaliToDayCount(today.year, today.month, today.day);

    return orderList.filter((o) => {
      const norm = toEnglishDigits(o.order_date || '');
      const match = norm.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (!match) return true;

      const oYear = parseInt(match[1], 10);
      const oMonth = parseInt(match[2], 10);
      const oDay = parseInt(match[3], 10);
      const orderDayCount = jalaliToDayCount(oYear, oMonth, oDay);
      const daysDiff = todayDayCount - orderDayCount;

      if (range === 'today') {
        return daysDiff === 0 || (oYear === today.year && oMonth === today.month && oDay === today.day);
      }
      if (range === 'week') {
        return daysDiff >= 0 && daysDiff <= 6;
      }
      if (range === 'month') {
        return (oYear === today.year && oMonth === today.month) || (daysDiff >= 0 && daysDiff <= 30);
      }
      if (range === 'year') {
        return oYear === today.year || oYear === 1403 || oYear === 1404;
      }
      return true;
    });
  };

  const timeFilteredOrders = useMemo(
    () => filterOrdersByTime(orders, timeFilter),
    [orders, timeFilter]
  );

  // Aggregated KPI Stats
  const aggregatedStats = useMemo(() => {
    const totalRevenue = timeFilteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalOrdersCount = timeFilteredOrders.length;
    const deliveredCount = timeFilteredOrders.filter((o) => o.status === 'delivered').length;
    const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;
    const activeCustomerCount = customers.length;

    return {
      totalRevenue,
      totalOrdersCount,
      deliveredCount,
      avgOrderValue,
      activeCustomerCount,
    };
  }, [timeFilteredOrders, customers]);

  // Customer detailed rankings
  const customersReportData = useMemo(() => {
    return customers
      .map((shop) => {
        const shopOrders = timeFilteredOrders.filter((o) => o.supermarket_id === shop.id);
        const allShopOrders = orders.filter((o) => o.supermarket_id === shop.id);
        const totalPurchases = shopOrders.reduce((sum, o) => sum + o.total_amount, 0);
        const deliveredPurchases = shopOrders
          .filter((o) => o.status === 'delivered')
          .reduce((sum, o) => sum + o.total_amount, 0);
        const ordersCount = shopOrders.length;

        const sharePercent =
          aggregatedStats.totalRevenue > 0
            ? Math.round((totalPurchases / aggregatedStats.totalRevenue) * 100)
            : 0;

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
        if (!searchTerm.trim()) return true;
        const term = searchTerm.trim().toLowerCase();
        return (
          item.supermarket.name.toLowerCase().includes(term) ||
          item.supermarket.owner.toLowerCase().includes(term) ||
          item.supermarket.phone.includes(term) ||
          item.supermarket.address.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.totalPurchases - a.totalPurchases);
  }, [customers, timeFilteredOrders, orders, searchTerm, aggregatedStats.totalRevenue]);

  // Drilldown data for active customer report
  const activeCustomerReport = useMemo(() => {
    if (!selectedCustomerForReport) return null;
    const customerOrders = timeFilteredOrders.filter(
      (o) => o.supermarket_id === selectedCustomerForReport.id
    );
    const allCustomerOrders = orders.filter(
      (o) => o.supermarket_id === selectedCustomerForReport.id
    );
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const deliveredAmount = customerOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total_amount, 0);

    return {
      supermarket: selectedCustomerForReport,
      orders: customerOrders,
      allOrders: allCustomerOrders,
      totalAmount,
      deliveredAmount,
      ordersCount: customerOrders.length,
    };
  }, [selectedCustomerForReport, timeFilteredOrders, orders]);

  return (
    <div className="space-y-4 pb-20 sm:pb-8">
      {/* Top Filter & Action Bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Time range tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              همه سوابق
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'today'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'week'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              این هفته
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ماه جاری
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('year')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                timeFilter === 'year'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              سال جاری
            </button>
          </div>

          {/* Print Aggregated Report */}
          <button
            type="button"
            onClick={() => setPrintReportType('aggregated')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>چاپ کارنامه تجمیعی کل</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="فیلتر نام فروشگاه، مالک یا آدرس..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 pr-9 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <p className="text-[11px] text-slate-400">مجموع فروش دوره</p>
          <p className="text-base sm:text-lg font-black text-emerald-400 mt-1">
            {formatPrice(aggregatedStats.totalRevenue)}{' '}
            <span className="text-[10px] font-normal text-slate-400">تومان</span>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <p className="text-[11px] text-slate-400">تعداد کل فاکتورها</p>
          <p className="text-base sm:text-lg font-black text-blue-400 mt-1">
            {aggregatedStats.totalOrdersCount}{' '}
            <span className="text-[10px] font-normal text-slate-400">سفارش</span>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <p className="text-[11px] text-slate-400">میانگین هر سفارش</p>
          <p className="text-base sm:text-lg font-black text-amber-400 mt-1">
            {formatPrice(aggregatedStats.avgOrderValue)}{' '}
            <span className="text-[10px] font-normal text-slate-400">تومان</span>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <p className="text-[11px] text-slate-400">مشتریان تحت پوشش</p>
          <p className="text-base sm:text-lg font-black text-purple-400 mt-1">
            {aggregatedStats.activeCustomerCount}{' '}
            <span className="text-[10px] font-normal text-slate-400">فروشگاه</span>
          </p>
        </div>
      </div>

      {/* Detailed Customer Table / List */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span>گزارش فروش به تفکیک مشتری</span>
          </h3>
          <span className="text-xs text-slate-400">{customersReportData.length} مشتری</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-2.5 px-3 font-semibold">فروشگاه</th>
                <th className="py-2.5 px-3 font-semibold text-center">فاکتورها</th>
                <th className="py-2.5 px-3 font-semibold">مبلغ کل خرید</th>
                <th className="py-2.5 px-3 font-semibold">سهم</th>
                <th className="py-2.5 px-3 font-semibold text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {customersReportData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    مشتری مطابق با فیلتر یافت نشد.
                  </td>
                </tr>
              ) : (
                customersReportData.map((item) => (
                  <tr
                    key={item.supermarket.id}
                    className={`hover:bg-slate-800/40 transition ${
                      selectedCustomerForReport?.id === item.supermarket.id
                        ? 'bg-blue-950/30 border-r-4 border-r-blue-500'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-100">{item.supermarket.name}</div>
                      <p className="text-[11px] text-slate-400">{item.supermarket.owner}</p>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold text-[11px]">
                        {item.ordersCount}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-emerald-400">
                        {formatPrice(item.totalPurchases)}
                      </span>{' '}
                      <span className="text-[10px] text-slate-400">تومان</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, item.sharePercent)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-300 font-bold">{item.sharePercent}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerForReport(item.supermarket)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        کارنامه تکی
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Customer Drilldown Card */}
      {activeCustomerReport && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-blue-800/50 shadow-xl space-y-4 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">
                  کارنامه تفصیلی «{activeCustomerReport.supermarket.name}»
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
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
                <span>چاپ کارنامه</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCustomerForReport(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[11px] text-slate-400">مجموع خرید در بازه</p>
              <p className="text-sm font-bold text-emerald-400 mt-1">
                {formatPrice(activeCustomerReport.totalAmount)} تومان
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[11px] text-slate-400">تعداد فاکتورها</p>
              <p className="text-sm font-bold text-blue-400 mt-1">
                {activeCustomerReport.ordersCount} فاکتور
              </p>
            </div>
          </div>

          {/* Orders list in drilldown */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {activeCustomerReport.orders.map((ord) => (
              <div
                key={ord.id}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-400">{ord.id}</span>
                    <span className="text-[11px] text-slate-400">{ord.order_date}</span>
                  </div>
                  {ord.items && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                      {ord.items.map((i) => `${i.name} (${i.quantity})`).join('، ')}
                    </p>
                  )}
                </div>
                <div className="text-left shrink-0">
                  <div className="font-bold text-slate-200">{formatPrice(ord.total_amount)} تومان</div>
                  <span
                    className={`text-[10px] font-medium ${
                      ord.status === 'delivered' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {ord.status === 'delivered' ? 'تحویل شد' : 'در حال پردازش'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printReportType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <h4 className="font-bold text-sm text-slate-100">
                  {printReportType === 'aggregated'
                    ? 'پیش‌نمایش چاپ کارنامه تجمیعی کل'
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

            <div className="p-6 overflow-y-auto space-y-5 bg-white text-slate-900 print:p-0">
              <div className="border-b-2 border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">سامانه پخش مویرگی البرز</h2>
                  <p className="text-xs text-slate-600">گزارش عملکرد ویزیتور و فروشگاه‌ها</p>
                </div>
                <div className="text-left text-xs text-slate-700">
                  <p>
                    <strong>ویزیتور:</strong> {currentVisitor.name} ({currentVisitor.region})
                  </p>
                </div>
              </div>

              {printReportType === 'aggregated' ? (
                <>
                  <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-300 text-xs flex justify-between">
                    <span>
                      <strong>تعداد مشتریان:</strong> {customers.length} فروشگاه
                    </span>
                    <span>
                      <strong>مجموع گردش مالی:</strong> {formatPrice(aggregatedStats.totalRevenue)} تومان
                    </span>
                  </div>

                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-200 border-b border-slate-400 text-slate-800">
                        <th className="py-2 px-2 border border-slate-300">ردیف</th>
                        <th className="py-2 px-2 border border-slate-300">نام فروشگاه</th>
                        <th className="py-2 px-2 border border-slate-300">مدیر</th>
                        <th className="py-2 px-2 border border-slate-300 text-center">تعداد فاکتور</th>
                        <th className="py-2 px-2 border border-slate-300">مجموع خرید (تومان)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customersReportData.map((c, i) => (
                        <tr key={c.supermarket.id} className="border-b border-slate-200">
                          <td className="py-1.5 px-2 border border-slate-300 text-center">{i + 1}</td>
                          <td className="py-1.5 px-2 border border-slate-300 font-bold">{c.supermarket.name}</td>
                          <td className="py-1.5 px-2 border border-slate-300">{c.supermarket.owner}</td>
                          <td className="py-1.5 px-2 border border-slate-300 text-center">{c.ordersCount}</td>
                          <td className="py-1.5 px-2 border border-slate-300 font-bold">
                            {formatPrice(c.totalPurchases)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                activeCustomerReport && (
                  <div className="space-y-3">
                    <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-300 text-xs space-y-1">
                      <p>
                        <strong>فروشگاه:</strong> {activeCustomerReport.supermarket.name} |{' '}
                        <strong>مدیر:</strong> {activeCustomerReport.supermarket.owner}
                      </p>
                      <p>
                        <strong>مجموع خرید:</strong> {formatPrice(activeCustomerReport.totalAmount)} تومان
                      </p>
                    </div>

                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-200 border-b border-slate-400 text-slate-800">
                          <th className="py-1.5 px-2 border border-slate-300">شماره</th>
                          <th className="py-1.5 px-2 border border-slate-300">تاریخ</th>
                          <th className="py-1.5 px-2 border border-slate-300">مبلغ (تومان)</th>
                          <th className="py-1.5 px-2 border border-slate-300 text-center">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCustomerReport.orders.map((ord) => (
                          <tr key={ord.id} className="border-b border-slate-200">
                            <td className="py-1.5 px-2 border border-slate-300 font-mono">{ord.id}</td>
                            <td className="py-1.5 px-2 border border-slate-300">{ord.order_date}</td>
                            <td className="py-1.5 px-2 border border-slate-300 font-bold">
                              {formatPrice(ord.total_amount)}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center">
                              {ord.status === 'delivered' ? 'تحویل شد' : 'ثبت شده'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
