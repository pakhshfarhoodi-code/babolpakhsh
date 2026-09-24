import React from 'react';
import { ShoppingBag, ChevronUp } from 'lucide-react';
import { formatPrice } from './shopUtils';

interface CartBarProps {
  itemCount: number;
  totalAmount: number;
  onOpenCart: () => void;
}

export const CartBar: React.FC<CartBarProps> = ({
  itemCount,
  totalAmount,
  onOpenCart,
}) => {
  if (itemCount <= 0) return null;

  return (
    <aside
      aria-label="نوار سبد خرید"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 p-3 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-md mx-auto">
        <button
          type="button"
          onClick={onOpenCart}
          className="w-full h-12 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-between transition cursor-pointer"
        >
          {/* Item count badge + Title */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold">
              سبد خرید ({itemCount.toLocaleString('fa-IR')} قلم)
            </span>
          </div>

          {/* Total Price & Action Chevron */}
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-xs sm:text-sm">
              {formatPrice(totalAmount)}
            </span>
            <div className="w-6 h-6 rounded-lg bg-black/20 flex items-center justify-center">
              <ChevronUp className="w-4 h-4" />
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
};
