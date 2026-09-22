import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Warehouse,
  ThermometerSnowflake,
  FileCheck,
  CheckCircle2,
  Clock,
  Boxes,
  Plus,
  ArrowDownCircle,
  Truck,
  AlertCircle,
} from 'lucide-react';

export const WarehousePanel: React.FC = () => {
  const {
    products,
    loadingBills,
    inventoryTransactions,
    approveLoadingBill,
    updateProductStock,
  } = useApp();

  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [restockProductId, setRestockProductId] = useState<string>('');
  const [restockAmount, setRestockAmount] = useState<number>(10);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const pendingBills = loadingBills.filter((b) => b.status === 'pending');
  const approvedBills = loadingBills.filter((b) => b.status === 'approved');

  const handleApproveBill = (billId: string) => {
    approveLoadingBill(billId);
    setActionSuccess(`برگه بارگیری ${billId} تایید شد و اقلام به طور فیزیکی از موجودی سردخانه کسر گردید.`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProductId || restockAmount <= 0) return;

    updateProductStock(restockProductId, restockAmount);
    const prod = products.find((p) => p.id === restockProductId);
    setActionSuccess(`ورود ${restockAmount} واحد از ${prod?.name} با موفقیت در انبار سردخانه ثبت شد.`);
    setRestockProductId('');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Cold Storage Header Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-l from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">پایانه لجستیک و انبار سردخانه مرکزی البرز</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                دمای حسگرها: ۱۸.۴- درجه سانتی‌گراد
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تایید خروج فیزیکی حواله‌های بارگیری خودروهای مویرگی و کنترل موجودی انبار
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl text-xs">
          <ThermometerSnowflake className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-slate-300">سیستم برودتی:</span>
          <span className="text-emerald-400 font-bold">پایدار و استاندارد</span>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Grid: Left Loading Bills Approval, Right Restock Inbound */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loading Bills Dispatch (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-indigo-400" />
                  <span>حواله‌ها و برگه‌های بارگیری در انتظار تایید انبار ({pendingBills.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تایید حواله موجب کسر فیزیکی از سردخانه و تحویل به ویزیتور می‌شود
                </p>
              </div>
            </div>

            <div className="space-y-3.5 mt-4">
              {pendingBills.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  در حال حاضر برگه بارگیری تایید نشده‌ای وجود ندارد.
                </div>
              ) : (
                pendingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/30 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-indigo-400">{bill.id}</span>
                        <span className="text-xs font-semibold text-slate-200">
                          خودروی ویزیتور: {bill.visitor_name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">زمان صدور: {bill.created_at}</span>
                    </div>

                    {/* Items table */}
                    {bill.items && bill.items.length > 0 && (
                      <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800/80">
                        <p className="text-[11px] font-bold text-slate-400 mb-2">اقلام تحویلی به خودرو:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {bill.items.map((it) => (
                            <div
                              key={it.id}
                              className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between"
                            >
                              <span className="text-slate-300">{it.product_name}</span>
                              <span className="font-bold text-indigo-300">
                                {it.quantity} عدد
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end gap-2 text-xs">
                      <button
                        onClick={() => handleApproveBill(bill.id)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-2 transition shadow-md shadow-indigo-600/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تایید نهایی خروج بار از سردخانه</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Approved Loading Bills History */}
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-200 pb-3 border-b border-slate-800">
              سوابق برگه‌های بارگیری ترخیص شده
            </h3>
            <div className="space-y-2 mt-3 max-h-52 overflow-y-auto pr-1">
              {approvedBills.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">سابقه‌ای وجود ندارد.</div>
              ) : (
                approvedBills.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400">{b.id}</span>
                        <span className="text-slate-300">{b.visitor_name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{b.created_at}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ترخیص و خارج شده
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Fast Restock Entry (1 col) */}
        <div className="space-y-4">
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
              <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
              <span>ثبت ورود محموله جدید به سردخانه</span>
            </h3>

            <form onSubmit={handleRestockSubmit} className="space-y-3.5 mt-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">انتخاب کالا:</label>
                <select
                  required
                  value={restockProductId}
                  onChange={(e) => setRestockProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">انتخاب محصول دریافتی...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (فعلی: {p.stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">تعداد وارده به سردخانه:</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockAmount || ''}
                  onChange={(e) => setRestockAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="مثال: 50"
                />
              </div>

              <button
                type="submit"
                disabled={!restockProductId}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>افزایش موجودی فیزیکی انبار</span>
              </button>
            </form>
          </div>

          {/* Quick Stock Status Snapshot */}
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
              <Boxes className="w-4 h-4 text-blue-400" />
              <span>پایش موجودی فیزیکی و رزرو</span>
            </h3>

            <div className="space-y-2 mt-3 max-h-72 overflow-y-auto pr-1 text-xs">
              {products.map((p) => {
                const free = p.stock - p.reserved_stock;
                return (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-1">
                      <p className="font-semibold text-slate-200 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        رزرو سفارشات: <span className="text-amber-400 font-bold">{p.reserved_stock}</span> {p.unit}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="font-bold text-slate-100">{p.stock}</span>
                      <span className="text-[10px] text-slate-400 mr-1">کل</span>
                      <div className="text-[10px] text-emerald-400 font-bold">
                        {free} آزاد
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
