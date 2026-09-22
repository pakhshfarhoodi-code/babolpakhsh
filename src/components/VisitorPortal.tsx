import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NewOrderModal } from './NewOrderModal';
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
} from 'lucide-react';

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
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedSupermarketForOrder, setSelectedSupermarketForOrder] = useState<string | undefined>(undefined);
  const [delegateOrderId, setDelegateOrderId] = useState<string | null>(null);
  const [targetVisitorId, setTargetVisitorId] = useState<string>('');
  const [selectedOrdersForBill, setSelectedOrdersForBill] = useState<string[]>([]);
  const [billCreatedMessage, setBillCreatedMessage] = useState<string | null>(null);

  // Filtered data for current visitor
  const mySupermarkets = supermarkets.filter((s) => s.assigned_visitor_id === currentVisitor.id);
  const myOrders = orders.filter((o) => o.assigned_visitor_id === currentVisitor.id);

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

  return (
    <div className="space-y-6">
      {/* Visitor Profile Hero Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-l from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">{currentVisitor.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-900/80 text-blue-300 border border-blue-700/50">
                {currentVisitor.region}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">شماره تماس سازمانی: {currentVisitor.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenNewOrder()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت سفارش ویزیت حضوری</span>
          </button>
        </div>
      </div>

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
              <div key={req.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">{req.supermarket_name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    از طرف: <span className="text-slate-300">{req.from_visitor_name}</span> ({req.timestamp})
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => respondToReassignment(req.id, true)}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px]"
                  >
                    پذیرش سفارش
                  </button>
                  <button
                    onClick={() => respondToReassignment(req.id, false)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px]"
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
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{billCreatedMessage}</span>
        </div>
      )}

      {/* Main Grid: Left Orders, Right Supermarkets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-200">سفارشات تحت مسئولیت توزیع</h3>
                <p className="text-xs text-slate-400">سفارشات نیازمند تحویل را انتخاب و برگه بارگیری صادر کنید</p>
              </div>

              {pendingDeliveryOrders.length > 0 && (
                <button
                  disabled={selectedOrdersForBill.length === 0}
                  onClick={handleGenerateLoadingBill}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition"
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
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0"
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
                            className="flex items-center gap-1 text-slate-400 hover:text-amber-400 transition"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>واگذاری به همکار دیگر</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateOrderStatus(order.id, 'undelivered')}
                              className="px-2.5 py-1 rounded bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/60 flex items-center gap-1 text-[11px]"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>عدم تحویل</span>
                            </button>
                            <button
                              onClick={() => updateOrderStatus(order.id, 'delivered')}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 text-[11px]"
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

        {/* Route / Supermarkets Column (1 col) */}
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
                      className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] flex items-center gap-1"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-4 focus:outline-none focus:border-blue-500"
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
                onClick={() => setDelegateOrderId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                انصراف
              </button>
              <button
                onClick={() => handleDelegateSubmit(delegateOrderId)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold"
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
    </div>
  );
};
