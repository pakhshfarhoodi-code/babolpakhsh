import React, { useState } from 'react';
import { ArrowRightLeft, X, Send, Users } from 'lucide-react';
import { Order, Visitor } from '../../types';

interface DelegateModalProps {
  order: Order | null;
  visitors: Visitor[];
  currentVisitorId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderId: string, targetVisitorId: string | null) => void;
}

export const DelegateModal: React.FC<DelegateModalProps> = ({
  order,
  visitors,
  currentVisitorId,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [targetVisitorId, setTargetVisitorId] = useState<string>('');

  if (!isOpen || !order) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(order.id, targetVisitorId ? targetVisitorId : null);
    setTargetVisitorId('');
    onClose();
  };

  const otherVisitors = visitors.filter((v) => v.id !== currentVisitorId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">واگذاری سفارش به همکار</h3>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              در صورت عدم توانایی در تحویل، این سفارش را به یک همکار خاص یا برای دریافت سریع‌تر به تمام همکاران منتشر کنید:
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                انتخاب ویزیتور مقصد:
              </label>
              <select
                value={targetVisitorId}
                onChange={(e) => setTargetVisitorId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
              >
                <option value="">📢 انتشار عمومی برای تمامی همکاران</option>
                {otherVisitors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.region})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                پس از ارسال درخواست، سفارش در وضعیت «در انتظار واگذاری» قرار می‌گیرد و همکار مقصد می‌تواند آن را قبول کند.
              </span>
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
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/20 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارسال پیشنهاد واگذاری</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
