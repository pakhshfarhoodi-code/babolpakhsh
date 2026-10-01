import React, { useState, useMemo } from 'react';
import { LoadingBill, Product } from '../../types';
import {
  aggregateBillItems,
  AggregatedBillItem,
  formatNumber,
} from './helpers';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  PackageCheck,
  Ban,
  Boxes,
  X,
} from 'lucide-react';

interface PendingBillCardProps {
  bill: LoadingBill;
  products: Product[];
  onApprove: (billId: string) => void;
  onCancel: (billId: string, reason: string) => void;
}

export const PendingBillCard: React.FC<PendingBillCardProps> = ({
  bill,
  products,
  onApprove,
  onCancel,
}) => {
  // Compute aggregated items
  const aggregatedItems: AggregatedBillItem[] = useMemo(
    () => aggregateBillItems(bill, products),
    [bill, products]
  );

  // Track checked item IDs
  const [checkedProductIds, setCheckedProductIds] = useState<Set<string>>(new Set());

  // Cancellation modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) {
      setCancelError('لطفاً دلیل لغو برگه بارگیری را وارد نمایید.');
      return;
    }
    onCancel(bill.id, cancelReason.trim());
    setIsCancelModalOpen(false);
    setCancelReason('');
    setCancelError(null);
  };

  const handleToggleItem = (productId: string) => {
    setCheckedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (checkedProductIds.size === aggregatedItems.length) {
      setCheckedProductIds(new Set());
    } else {
      setCheckedProductIds(new Set(aggregatedItems.map((i) => i.productId)));
    }
  };

  const allChecked =
    aggregatedItems.length > 0 &&
    checkedProductIds.size === aggregatedItems.length;

  const hasAnyShortage = aggregatedItems.some((i) => i.isShortage);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-indigo-500/30 shadow-md space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-bold text-sm text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/60">
            {bill.id}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-200">
            <User className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-slate-400 font-medium">ویزیتور:</span>
            <span className="font-bold text-slate-100">{bill.visitor_name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-4 h-4 text-slate-500" />
          <span>زمان صدور: {bill.created_at}</span>
        </div>
      </div>

      {/* Picking Checklist Title & Quick Select */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-bold">
          <PackageCheck className="w-4 h-4 text-indigo-400" />
          <span>چک‌لیست تجمیعی اقلام بارگیری ({aggregatedItems.length} قلم کالا)</span>
        </div>
        {aggregatedItems.length > 0 && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
          >
            {checkedProductIds.size === aggregatedItems.length
              ? 'عدم انتخاب همه'
              : 'تیک زدن همه اقلام'}
          </button>
        )}
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {aggregatedItems.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 bg-slate-900/60 rounded-xl">
            هیچ قلم کالایی در این برگه ثبت نشده است.
          </div>
        ) : (
          aggregatedItems.map((item) => {
            const isChecked = checkedProductIds.has(item.productId);

            return (
              <div
                key={item.productId}
                onClick={() => handleToggleItem(item.productId)}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                  isChecked
                    ? 'bg-indigo-950/20 border-indigo-500/50 text-slate-200'
                    : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                {/* Right: Checkbox and Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                      isChecked
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-700'
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold truncate ${
                        isChecked ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}
                    >
                      {item.productName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span>
                        موجودی انبار: {formatNumber(item.currentStock)} {item.unit}
                      </span>
                      {item.isShortage && (
                        <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>موجودی کافی نیست</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Left: Quantity Required */}
                <div className="text-left shrink-0">
                  <div className="text-xs font-black text-indigo-300">
                    {formatNumber(item.totalQuantity)}{' '}
                    <span className="font-normal text-slate-400">{item.unit}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {isChecked ? 'برداشته شد' : 'منتظر تایید'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Warning Note if any shortage exists */}
      {hasAnyShortage && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            توجه: موجودی فیزیکی برخی اقلام کمتر از تعداد درخواستی برگه است. با توجه به عدم امکان
            اصلاح مقادیر، تایید نهایی با مسئولیت انباردار انجام می‌شود.
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
        {/* Cancel Button */}
        <button
          type="button"
          onClick={() => {
            setCancelReason('');
            setCancelError(null);
            setIsCancelModalOpen(true);
          }}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-98"
        >
          <Ban className="w-4 h-4 text-rose-400" />
          <span>لغو برگه بارگیری</span>
        </button>

        {/* Final Approve Button (Requires all items checked) */}
        <button
          type="button"
          onClick={() => onApprove(bill.id)}
          disabled={!allChecked}
          className={`min-h-[40px] px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
            allChecked
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 active:scale-98'
              : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>تایید نهایی خروج بار از سردخانه</span>
          {!allChecked && (
            <span className="text-slate-400 text-xs font-normal">
              ({checkedProductIds.size} از {aggregatedItems.length})
            </span>
          )}
        </button>
      </div>

      {/* Cancellation Reason Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Ban className="w-4 h-4" />
                <span>لغو برگه بارگیری {bill.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              با لغو این برگه، تمامی سفارش‌های مندرج در آن مجدداً به وضعیت آماده ارسال بازمی‌گردند و
              ویزیتور می‌تواند مجدداً اقدام به صدور برگه نماید. موجودی فیزیکی انبار دست‌نخورده باقی می‌ماند.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>علت لغو برگه بارگیری <span className="text-rose-400">*</span></span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  if (cancelError) setCancelError(null);
                }}
                rows={3}
                placeholder="مثال: عدم حضور راننده، نقص فنی خودرو، مغایرت موجودی با فاکتور..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition resize-none"
              />
              {cancelError && (
                <p className="text-xs text-rose-400 flex items-center gap-1 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{cancelError}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 cursor-pointer active:scale-98"
              >
                ثبت و لغو برگه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
