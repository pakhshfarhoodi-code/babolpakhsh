import React, { useState, useMemo } from 'react';
import { LoadingBill, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatNumber } from './helpers';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  PackageCheck,
  Ban,
  Boxes,
  X,
  ListChecks,
  RotateCw,
  Truck,
  Check,
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
  const { retryFetch } = useApp();

  // Mode: Checklist mode toggled on/off
  const [isChecklistMode, setIsChecklistMode] = useState<boolean>(false);
  const [checkedProductIds, setCheckedProductIds] = useState<Set<string>>(new Set());

  // Shortage warning modal state
  const [isShortageConfirmOpen, setIsShortageConfirmOpen] = useState(false);

  // Cancellation modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Aggregate items directly from bill.items
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const aggregatedItems = useMemo(() => {
    if (!bill.items || bill.items.length === 0) return [];

    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        totalQuantity: number;
        unit: string;
        currentStock: number;
        isShortage: boolean;
        shortageCount: number;
      }
    >();

    for (const it of bill.items) {
      const prod = productMap.get(it.product_id);
      const curStock = prod ? prod.stock : 0;
      const unit = prod?.unit || 'بسته';

      const existing = map.get(it.product_id);
      if (existing) {
        existing.totalQuantity += it.quantity;
      } else {
        map.set(it.product_id, {
          productId: it.product_id,
          productName: it.product_name,
          totalQuantity: it.quantity,
          unit,
          currentStock: curStock,
          isShortage: false,
          shortageCount: 0,
        });
      }
    }

    return Array.from(map.values()).map((item) => {
      const isShortage = item.currentStock < item.totalQuantity;
      return {
        ...item,
        isShortage,
        shortageCount: isShortage ? item.totalQuantity - item.currentStock : 0,
      };
    });
  }, [bill.items, productMap]);

  const hasAnyShortage = aggregatedItems.some((i) => i.isShortage);
  const allChecked =
    aggregatedItems.length > 0 && checkedProductIds.size === aggregatedItems.length;

  const handleToggleItem = (productId: string) => {
    setCheckedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
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

  const handleApproveClick = () => {
    if (hasAnyShortage) {
      setIsShortageConfirmOpen(true);
    } else {
      onApprove(bill.id);
    }
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) {
      setCancelError('لطفاً دلیل لغو فاکتور بارگیری را وارد نمایید.');
      return;
    }
    onCancel(bill.id, cancelReason.trim());
    setIsCancelModalOpen(false);
    setCancelReason('');
    setCancelError(null);
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-indigo-500/30 shadow-md space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono font-black text-sm text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-700/60">
            {bill.invoice_no || bill.id}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-200">
            <User className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-slate-400 font-medium">ویزیتور:</span>
            <span className="font-bold text-slate-100">{bill.visitor_name}</span>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>آماده خروج از سردخانه</span>
          </span>

          {(bill.revision_count ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-amber-400 border border-slate-700 text-[10px] font-bold">
              {bill.revision_count} بار اصلاح شده
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>تایید: {bill.approved_at || bill.created_at}</span>
        </div>
      </div>

      {/* Items Section */}
      {!bill.items || bill.items.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
          <p className="font-bold text-amber-300">اقلام این فاکتور بارگذاری نشد.</p>
          <p className="text-slate-500">برای دریافت مجدد اقلام از پایگاه داده، دکمه تلاش مجدد را بزنید.</p>
          <button
            type="button"
            onClick={retryFetch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-400" />
            <span>تلاش مجدد (بارگذاری اقلام)</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary / Checklist Toggle Bar */}
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2 text-slate-300 font-bold">
              <PackageCheck className="w-4 h-4 text-indigo-400" />
              <span>اقلام فاکتور بار ({aggregatedItems.length} قلم کالا)</span>
            </div>

            <div className="flex items-center gap-2">
              {isChecklistMode && (
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

              <button
                type="button"
                onClick={() => setIsChecklistMode(!isChecklistMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  isChecklistMode
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>{isChecklistMode ? 'بستن چک‌لیست' : 'بارگیری با چک‌لیست (نیروی انبار)'}</span>
              </button>
            </div>
          </div>

          {/* Items List (Standard List or Interactive Checklist) */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {aggregatedItems.map((item) => {
              const isChecked = checkedProductIds.has(item.productId);

              return (
                <div
                  key={item.productId}
                  onClick={() => isChecklistMode && handleToggleItem(item.productId)}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                    isChecklistMode ? 'cursor-pointer select-none' : ''
                  } ${
                    isChecked
                      ? 'bg-indigo-950/20 border-indigo-500/50 text-slate-200'
                      : item.isShortage
                      ? 'bg-rose-950/15 border-rose-800/40 text-rose-200'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isChecklistMode && (
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-950 border-slate-700'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className={`font-bold truncate ${isChecked ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                        {item.productName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span>موجودی فعلی سردخانه: {formatNumber(item.currentStock)} {item.unit}</span>
                        {item.isShortage && (
                          <span className="text-rose-400 font-bold flex items-center gap-1 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/50">
                            <AlertTriangle className="w-3 h-3" />
                            <span>کسری موجودی: {item.shortageCount} واحد</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <div className="font-black text-indigo-300 font-mono">
                      {formatNumber(item.totalQuantity)} <span className="font-normal text-slate-400 text-[11px]">{item.unit}</span>
                    </div>
                    {isChecklistMode && (
                      <span className="text-[10px] text-slate-500">
                        {isChecked ? 'تیک خورد' : 'در انتظار'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warning Note if any shortage exists */}
      {hasAnyShortage && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            هشدار موجودی: موجودی فیزیکی برخی اقلام کمتر از تعداد درخواستی فاکتور است. دکمه «تایید همه» همراه با هشدار اختصاصی در دسترس است.
          </span>
        </div>
      )}

      {/* Action Buttons: Confirm Exit (All or with Checklist), Cancel */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
        {/* Cancel Button */}
        <button
          type="button"
          onClick={() => {
            setCancelReason('');
            setCancelError(null);
            setIsCancelModalOpen(true);
          }}
          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-98"
        >
          <Ban className="w-4 h-4 text-rose-400" />
          <span>لغو فاکتور بارگیری</span>
        </button>

        <div className="flex items-center gap-2">
          {/* If Checklist Mode is Active: Show Checklist Submit */}
          {isChecklistMode ? (
            <button
              type="button"
              onClick={handleApproveClick}
              disabled={!allChecked}
              className={`min-h-[38px] px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                allChecked
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 active:scale-98'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تایید خروج با چک‌لیست ({checkedProductIds.size} از {aggregatedItems.length})</span>
            </button>
          ) : (
            /* Standard Mode: Quick "تایید همه و خروج بار" */
            <button
              type="button"
              onClick={handleApproveClick}
              className="min-h-[38px] px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 active:scale-98 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>تایید همه و خروج بار از سردخانه</span>
            </button>
          )}
        </div>
      </div>

      {/* Shortage Confirmation Modal */}
      {isShortageConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>هشدار کمبود موجودی فیزیکی انبار</span>
              </div>
              <button
                type="button"
                onClick={() => setIsShortageConfirmOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              یک یا چند قلم از این فاکتور با کسری موجودی مواجه است. آیا با تایید قطعی خروج بار از سردخانه و کسر موجودی موافقید؟
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsShortageConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsShortageConfirmOpen(false);
                  onApprove(bill.id);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs transition shadow-md cursor-pointer active:scale-98"
              >
                تایید خروج علیرغم کسری
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Ban className="w-4 h-4" />
                <span>لغو فاکتور بارگیری {bill.invoice_no || bill.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              با لغو فاکتور، سفارش‌های متصل به وضعیت «آماده ارسال» بازگشته و رزرو اقلام آزاد می‌شود.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200">
                علت لغو فاکتور <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  if (cancelError) setCancelError(null);
                }}
                rows={3}
                placeholder="مثال: عدم حضور راننده، کسری انبار، مغایرت اقلام..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
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
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 cursor-pointer active:scale-98"
              >
                ثبت و لغو فاکتور
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
