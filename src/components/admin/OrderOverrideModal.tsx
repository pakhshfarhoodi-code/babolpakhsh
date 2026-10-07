import React, { useState } from 'react';
import { Order, OrderStatus } from '../../types';
import { X, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';

interface OrderOverrideModalProps {
  order: Order | null;
  targetStatus: OrderStatus | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderId: string, status: OrderStatus, reason: string) => void;
}

export const OrderOverrideModal: React.FC<OrderOverrideModalProps> = ({
  order,
  targetStatus,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order || !targetStatus) return null;

  const statusTitleMap: Record<OrderStatus, string> = {
    assigned: 'آماده ارسال (تخصیص‌یافته)',
    loading: 'در حال بارگیری (حواله سردخانه)',
    delegated: 'در حال واگذاری به همکار',
    delivered: 'تحویل داده شد (موفق)',
    undelivered: 'عدم تحویل (برگشتی)',
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('وارد کردن دلیل تغییر وضعیت مدیریتی اجباری است.');
      return;
    }

    onConfirm(order.id, targetStatus, reason.trim());
    setReason('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">تغییر وضعیت مستقیم سفارش (مدیریت)</h3>
              <p className="text-xs text-slate-400 font-mono">{order.id} - {order.supermarket_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm}>
          <div className="p-4 space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">وضعیت فعلی:</span>
                <span className="font-semibold text-slate-200">{statusTitleMap[order.status]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">وضعیت جدید:</span>
                <span className="font-bold text-blue-400">{statusTitleMap[targetStatus]}</span>
              </div>
            </div>

            {order.status === 'loading' && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-1 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>هشدار تاییدیه: این سفارش در برگه بارگیری است</span>
                </div>
                <p className="text-amber-200/90 text-[11px] leading-relaxed pr-5">
                  این سفارش در حال حاضر به برگه بارگیری شماره <strong className="font-mono text-amber-300">{order.loading_bill_id || 'فعال'}</strong> متصل است. تغییر وضعیت دستی ممکن است با کسر موجودی انبار ناسازگار شود.
                </p>
              </div>
            )}

            <p className="text-slate-300">
              جهت حفظ انضباط مالی و حسابرسی سیستم پخش، لطفاً دلیل تغییر دستی وضعیت را ثبت فرمایید:
            </p>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                دلیل یا یادداشت تغییر وضعیت <span className="text-rose-400">*</span>:
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="مثال: تسویه نقدی دستی با سرپرست فروش انجام شد / هماهنگی تلفنی با مغازه‌دار..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              {errorMsg && <p className="text-rose-400 text-xs mt-1">{errorMsg}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950/70 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>ثبت تغییر وضعیت دستی</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
