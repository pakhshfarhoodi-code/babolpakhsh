import React, { useState } from 'react';
import { Product } from '../../types';
import { QuantityStepper } from './QuantityStepper';
import { formatPrice } from './shopUtils';
import {
  X,
  Trash2,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';

interface CartSheetProps {
  isOpen: boolean;
  isMobileModal: boolean;
  onClose: () => void;
  cart: Record<string, number>;
  products: Product[];
  onUpdateQuantity: (productId: string, qty: number) => void;
  onClearCart: () => void;
  onSubmitOrder: () => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onExceedLimit?: (max: number) => void;
}

export const CartSheet: React.FC<CartSheetProps> = ({
  isOpen,
  isMobileModal,
  onClose,
  cart,
  products,
  onUpdateQuantity,
  onClearCart,
  onSubmitOrder,
  isSubmitting,
  errorMessage,
  onExceedLimit,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Derive cart items with full product data
  const cartEntries = Object.entries(cart)
    .map(([productId, quantity]) => {
      const numQty = Number(quantity);
      const product = products.find((p) => p.id === productId);
      if (!product || numQty <= 0) return null;
      const available = Math.round(Math.max(0, product.stock - product.reserved_stock) * 1000) / 1000;
      return {
        product,
        quantity: numQty,
        available,
        rowTotal: product.price * numQty,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const totalAmount = cartEntries.reduce((sum, item) => sum + item.rowTotal, 0);
  const totalItemsCount = Math.round(cartEntries.reduce((sum, item) => sum + item.quantity, 0) * 1000) / 1000;

  // Shared Cart Content Layout
  const content = (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">سبد سفارش فروشگاه</h3>
            <p className="text-xs text-slate-400">
              {cartEntries.length.toLocaleString('fa-IR')} کالا ({totalItemsCount.toLocaleString('fa-IR')} واحد)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {cartEntries.length > 0 && !isConfirmingClear && (
            <button
              type="button"
              onClick={() => setIsConfirmingClear(true)}
              title="خالی کردن تمام سبد"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer text-xs flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خالی کردن</span>
            </button>
          )}

          {isMobileModal && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Confirmation to Clear Cart */}
      {isConfirmingClear && (
        <div className="p-3 bg-rose-950/50 border-b border-rose-900/60 flex items-center justify-between gap-2 text-xs text-rose-200">
          <span>آیا مطمئن هستید تمام اقلام حذف شوند؟</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsConfirmingClear(false)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => {
                onClearCart();
                setIsConfirmingClear(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold"
            >
              بله، خالی کن
            </button>
          </div>
        </div>
      )}

      {/* Error Message inside Cart if any */}
      {errorMessage && (
        <div className="m-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
        {cartEntries.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <ShoppingBag className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-xs font-semibold">سبد خرید شما خالی است.</p>
            <p className="text-xs text-slate-500">از کاتالوگ محصولات، کالاهای مورد نیاز را اضافه کنید.</p>
          </div>
        ) : (
          cartEntries.map(({ product, quantity, available, rowTotal }) => (
            <div
              key={product.id}
              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-100 truncate">{product.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    فی: {product.price.toLocaleString('fa-IR')} تومان
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-400 shrink-0">
                  {formatPrice(rowTotal)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                <span className="text-xs text-slate-500">واحد: {product.unit}</span>
                <QuantityStepper
                  compact
                  quantity={quantity}
                  available={available}
                  onChange={(qty) => onUpdateQuantity(product.id, qty)}
                  onExceedLimit={onExceedLimit}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer & Final Checkout Button */}
      {cartEntries.length > 0 && (
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
          {/* Summary Row */}
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-medium text-slate-400">جمع کل سفارش:</span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-400">
              {formatPrice(totalAmount)}
            </span>
          </div>

          {/* Submit Order Button */}
          <button
            type="button"
            disabled={isSubmitting || cartEntries.length === 0}
            onClick={onSubmitOrder}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span>در حال ثبت سفارش...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت سفارش</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  // If on desktop (rendered as sidebar), render directly
  if (!isMobileModal) {
    return (
      <div className="sticky top-20 h-[calc(100vh-6rem)]">
        {content}
      </div>
    );
  }

  // If on mobile (rendered as bottom sheet), wrap in modal backdrop
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {content}
      </div>
    </div>
  );
};
