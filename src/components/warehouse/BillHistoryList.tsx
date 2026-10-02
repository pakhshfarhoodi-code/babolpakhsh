import React, { useState } from 'react';
import { LoadingBill, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNumber } from './helpers';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  CheckCircle2,
  Package,
  Ban,
  AlertTriangle,
  RotateCw,
  Truck,
} from 'lucide-react';

interface BillHistoryListProps {
  bills: LoadingBill[];
  products: Product[];
}

export const BillHistoryList: React.FC<BillHistoryListProps> = ({
  bills,
  products,
}) => {
  const { refreshData } = useApp();
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  const toggleExpand = (billId: string) => {
    setExpandedBillId((prev) => (prev === billId ? null : billId));
  };

  // Draft bills must NEVER be seen in the warehouse panel!
  const validHistoryBills = bills.filter((b) => b.status !== 'draft');

  if (validHistoryBills.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
        هیچ سابقه‌ای از برگه‌های ترخیص یا لغو شده در سیستم وجود ندارد.
      </div>
    );
  }

  const renderStatusBadge = (status: LoadingBill['status']) => {
    switch (status) {
      case 'loaded':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" />
            <span>خروج از انبار انجام شده</span>
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>تایید شده (در انتظار خروج)</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <Ban className="w-3.5 h-3.5" />
            <span>لغو شده</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2.5" dir="rtl">
      {validHistoryBills.map((bill) => {
        const isExpanded = expandedBillId === bill.id;
        const isCancelled = bill.status === 'cancelled';
        const hasItems = bill.items && bill.items.length > 0;
        const totalItemsCount = hasItems
          ? bill.items!.reduce((sum, i) => sum + i.quantity, 0)
          : 0;

        return (
          <div
            key={bill.id}
            className={`rounded-xl border overflow-hidden transition-colors ${
              isCancelled
                ? 'bg-slate-950/50 border-slate-800/80 opacity-90'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            {/* Header Accordion Bar */}
            <div
              onClick={() => toggleExpand(bill.id)}
              className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-900/60 transition select-none flex-wrap sm:flex-nowrap"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg border shrink-0 bg-slate-900 text-slate-200 border-slate-700">
                  {bill.invoice_no || bill.id}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-slate-200 truncate">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-400">ویزیتور:</span>
                  <span className="font-semibold truncate">{bill.visitor_name}</span>
                </div>

                {(bill.revision_count ?? 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                    {bill.revision_count} ویرایش
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{bill.finalized_at || bill.approved_at || bill.created_at}</span>
                </div>

                {renderStatusBadge(bill.status)}

                <span className="p-1 text-slate-400 hover:text-slate-200">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </div>
            </div>

            {/* Accordion Content */}
            {isExpanded && (
              <div className="p-4 pt-2 border-t border-slate-800/80 bg-slate-900/40 space-y-3 text-xs">
                {/* Cancelled Banner */}
                {isCancelled && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>علت لغو فاکتور بارگیری:</span>
                    </div>
                    <p className="text-slate-200 font-medium pr-6">
                      {bill.cancel_reason || 'دلیلی ثبت نشده است.'}
                    </p>
                    {(bill.cancelled_by || bill.cancelled_at) && (
                      <div className="text-[11px] text-slate-400 pr-6 flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 mt-1">
                        {bill.cancelled_by && <span>لغو توسط: {bill.cancelled_by}</span>}
                        {bill.cancelled_at && <span>• زمان لغو: {bill.cancelled_at}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Finalized Metadata */}
                {!isCancelled && (bill.approved_by || bill.finalized_by) && (
                  <div className="text-slate-400 flex items-center gap-2 pb-1 border-b border-slate-800/60 flex-wrap">
                    <span>تایید و ترخیص توسط: <strong className="text-slate-200">{bill.approved_by || bill.finalized_by}</strong></span>
                    {(bill.finalized_at || bill.approved_at) && (
                      <span className="font-mono">• زمان: {bill.finalized_at || bill.approved_at}</span>
                    )}
                    {bill.orders_count !== undefined && (
                      <span>• تعداد سفارش‌ها: {bill.orders_count}</span>
                    )}
                  </div>
                )}

                {/* Items List or Refetch Error */}
                {!hasItems ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                    <p className="font-bold text-amber-300">اقلام این فاکتور بارگذاری نشد.</p>
                    <button
                      type="button"
                      onClick={refreshData}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                      <span>تلاش مجدد (بارگذاری مجدد اقلام)</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5 font-bold text-slate-300">
                        <Package className="w-3.5 h-3.5 text-indigo-400" />
                        <span>اقلام مندرج در فاکتور:</span>
                      </span>
                      <span>مجموع: {formatNumber(totalItemsCount)} واحد</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {bill.items!.map((it) => (
                        <div
                          key={it.id}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-200 truncate">{it.product_name}</p>
                            {it.customer_label && (
                              <p className="text-[11px] text-slate-400 truncate">مشتری: {it.customer_label}</p>
                            )}
                          </div>
                          <span className="font-mono font-bold text-indigo-300 shrink-0">
                            {formatNumber(it.quantity)} عدد
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
