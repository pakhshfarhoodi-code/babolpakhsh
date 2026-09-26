import React, { useState } from 'react';
import { XCircle, X, AlertTriangle } from 'lucide-react';
import { Order } from '../../types';

interface UndeliveredModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderId: string, reason?: string) => void;
}

export const UndeliveredModal: React.FC<UndeliveredModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [selectedPredefined, setSelectedPredefined] = useState<string>('');

  if (!isOpen || !order) return null;

  const predefinedReasons = [
    'مغازه بسته بود / عدم حضور صاحب فروشگاه',
    'درخواست انصراف یا لغو توسط مغازه‌دار',
    'کسری یا آسیب کالا هنگام حمل',
    'مشکل در تسویه حساب یا پرداخت وجه',
    'آدرس نادرست / عدم امکان دسترسی',
  ];

  const handleSelectPredefined = (text: string) => {
    setSelectedPredefined(text);
    setReason(text);
  };

  const handleConfirm = () => {
    onConfirm(order.id, reason.trim() || undefined);
    setReason('');
    setSelectedPredefined('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">ثبت عدم تحویل سفارش</h3>
              <p className="text-xs text-slate-400 font-mono">{order.id} - {order.supermarket_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-300">
            آیا از تغییر وضعیت سفارش به <span className="text-rose-400 font-bold">«عدم تحویل»</span> اطمینان دارید؟
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              انتخاب سریع دلیل عدم تحویل (اختیاری):
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {predefinedReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSelectPredefined(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition text-right cursor-pointer ${
                    selectedPredefined === r
                      ? 'bg-rose-950/70 border border-rose-600/50 text-rose-200'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              توضیحات و یادداشت تکمیلی:
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="در صورت نیاز دلیل عدم تحویل یا توضیحات اضافه را بنویسید..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>تایید عدم تحویل</span>
          </button>
        </div>
      </div>
    </div>
  );
};
