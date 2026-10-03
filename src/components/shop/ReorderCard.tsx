import React from 'react';
import { Product } from '../../types';
import { Flame, Plus, Check } from 'lucide-react';
import { formatPrice } from './shopUtils';

interface ReorderCardProps {
  topProducts: Product[];
  cart: Record<string, number>;
  onAddProductToCart: (productId: string) => void;
}

export const ReorderCard: React.FC<ReorderCardProps> = ({
  topProducts,
  cart,
  onAddProductToCart,
}) => {
  if (topProducts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold px-1">
        <Flame className="w-3.5 h-3.5 text-amber-400" />
        <span>پرخریدهای من</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {topProducts.map((p) => {
          const qtyInCart = cart[p.id] || 0;
          const available = Math.round(Math.max(0, p.stock - p.reserved_stock) * 1000) / 1000;
          const isOutOfStock = available <= 0;

          return (
            <div
              key={p.id}
              className="min-w-[170px] max-w-[200px] p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0 flex flex-col justify-between space-y-2 hover:border-slate-700 transition"
            >
              <div>
                <h5 className="text-xs font-bold text-slate-200 line-clamp-1 truncate" title={p.name}>
                  {p.name}
                </h5>
                <p className="text-xs text-emerald-400 font-extrabold mt-1">
                  {formatPrice(p.price)}
                </p>
              </div>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={() => onAddProductToCart(p.id)}
                className={`w-full h-8 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  isOutOfStock
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : qtyInCart > 0
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white'
                }`}
              >
                {isOutOfStock ? (
                  <span>ناموجود</span>
                ) : qtyInCart > 0 ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>در سبد ({qtyInCart.toLocaleString('fa-IR')})</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>افزودن سریع</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

