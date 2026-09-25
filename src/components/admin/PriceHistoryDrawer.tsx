import React from 'react';
import { Product, ProductPriceHistory } from '../../types';
import { X, History, TrendingUp, TrendingDown, Clock, User } from 'lucide-react';
import { formatPrice } from './helpers';

interface PriceHistoryDrawerProps {
  product: Product | null;
  priceHistories: ProductPriceHistory[];
  isOpen: boolean;
  onClose: () => void;
}

export const PriceHistoryDrawer: React.FC<PriceHistoryDrawerProps> = ({
  product,
  priceHistories,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !product) return null;

  const productHistories = priceHistories
    .filter((h) => h.product_id === product.id)
    .sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-r border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-250">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">تاریخچه تغییرات قیمت</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{product.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current price badge */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">قیمت مصوب جاری:</span>
            <div className="text-base font-black text-emerald-400">
              {formatPrice(product.price)}{' '}
              <span className="text-xs font-normal text-slate-400">تومان</span>
            </div>
          </div>
        </div>

        {/* History timeline list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {productHistories.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs space-y-2">
              <History className="w-8 h-8 text-slate-600 mx-auto" />
              <p>تغییر قیمتی برای این کالا ثبت نشده است.</p>
              <p className="text-slate-600">نرخ پایه هنگام ایجاد کالا ثبت شده است.</p>
            </div>
          ) : (
            productHistories.map((hist) => {
              const diff = hist.new_price - hist.old_price;
              const isIncrease = diff > 0;

              return (
                <div
                  key={hist.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      {isIncrease ? (
                        <TrendingUp className="w-4 h-4 text-rose-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className={isIncrease ? 'text-rose-400' : 'text-emerald-400'}>
                        {isIncrease ? 'افزایش نرخ' : 'کاهش نرخ'} ({formatPrice(Math.abs(diff))} تومان)
                      </span>
                    </div>
                    <span className="text-slate-400 text-xs font-mono">{hist.changed_at}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                    <div className="space-y-0.5">
                      <span className="text-slate-500 text-xs">نرخ قبلی:</span>
                      <p className="font-medium text-slate-400 line-through">
                        {formatPrice(hist.old_price)} تومان
                      </p>
                    </div>
                    <div className="text-left space-y-0.5">
                      <span className="text-slate-500 text-xs">نرخ مصوب جدید:</span>
                      <p className="font-bold text-slate-100">
                        {formatPrice(hist.new_price)} تومان
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-500 pt-1 text-xs">
                    <User className="w-3.5 h-3.5 text-slate-600" />
                    <span>تغییردهنده: {hist.changed_by}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/70 text-right">
          <p className="text-xs text-slate-500">
            فاکتورهای قبلی با نرخ مصوب زمان ثبت محاسبه شده‌اند و تغییر قیمت تاثیری در گذشته ندارد.
          </p>
        </div>
      </div>
    </div>
  );
};
