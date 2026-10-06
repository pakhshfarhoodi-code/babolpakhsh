import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { QuantityStepper } from './QuantityStepper';
import { formatPrice } from './shopUtils';
import { Price } from './Price';
import {
  X,
  Trash2,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Percent,
} from 'lucide-react';
import {
  getStorePickupDiscountEnabled,
  calculateTotalDiscountPercent,
  calculateDiscountedPrice,
} from '../../utils/storeDiscount';

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
  const { invoiceSettings, currentUser, selectedSupermarketId, supermarkets } = useApp();
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Re-evaluation listener for store discount
  const [, setDiscountVersion] = useState(0);
  useEffect(() => {
    const handler = () => setDiscountVersion((v) => v + 1);
    window.addEventListener('store-discount-changed', handler);
    return () => window.removeEventListener('store-discount-changed', handler);
  }, []);

  const currentShop = supermarkets.find(
    (s) => s.id === selectedSupermarketId || (currentUser?.id && s.id === currentUser.id)
  );
  const storeId = currentShop?.id || currentUser?.id || '';
  const pickupPercent = invoiceSettings?.pickup_discount_percent || 3;
  const pickupEnabled = getStorePickupDiscountEnabled(storeId);
  const founderEnabled = Boolean(currentShop?.founder_discount_enabled);
  const founderPercent = currentShop?.founder_discount_percent || 3;

  const totalDiscountPercent = calculateTotalDiscountPercent(
    pickupEnabled ? pickupPercent : 0,
    founderEnabled ? founderPercent : 0,
    0
  );

  // Derive cart items with full product data and discounted pricing
  const cartEntries = Object.entries(cart)
    .map(([productId, quantity]) => {
      const numQty = Number(quantity);
      const product = products.find((p) => p.id === productId);
      if (!product || numQty <= 0) return null;
      const multiplier = product.items_per_package && product.items_per_package > 0 ? product.items_per_package : 1;
      const available = Math.round(Math.max(0, product.stock - product.reserved_stock) * 1000) / 1000;
      
      const originalUnitPrice = product.price;
      const discountedUnitPrice = calculateDiscountedPrice(originalUnitPrice, totalDiscountPercent);
      const originalRowTotal = originalUnitPrice * numQty * multiplier;
      const discountedRowTotal = discountedUnitPrice * numQty * multiplier;

      return {
        product,
        quantity: numQty,
        available,
        multiplier,
        originalUnitPrice,
        discountedUnitPrice,
        unitCartonPrice: discountedUnitPrice * multiplier,
        originalRowTotal,
        discountedRowTotal,
        rowTotal: discountedRowTotal,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const originalTotalAmount = cartEntries.reduce((sum, item) => sum + item.originalRowTotal, 0);
  const payableTotalAmount = cartEntries.reduce((sum, item) => sum + item.discountedRowTotal, 0);
  const discountAmount = originalTotalAmount - payableTotalAmount;
  const totalItemsCount = Math.round(cartEntries.reduce((sum, item) => sum + item.quantity, 0) * 1000) / 1000;

  // Shared Cart Content Layout
  const content = (
    <div className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${
      cartEntries.length === 0 ? 'h-auto' : 'h-full max-h-[calc(100vh-6rem)]'
    }`}>
      {/* Header: single line 'سبد سفارش · ۰ کالا' */}
      <div className="p-2.5 sm:p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
            سبد سفارش · <span className="num-fa">{cartEntries.length.toLocaleString('fa-IR')}</span> کالا
            {cartEntries.length > 0 && (
              <span className="num-fa"> ({totalItemsCount.toLocaleString('fa-IR')} واحد)</span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
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
          <div className="py-4 px-3 text-center text-slate-400 flex items-center justify-center gap-2">
            <ShoppingBag className="w-7 h-7 text-slate-600 shrink-0" />
            <p className="text-xs font-semibold text-slate-400">سبد خالی است.</p>
          </div>
        ) : (
          cartEntries.map(({ product, quantity, available, multiplier, originalUnitPrice, discountedUnitPrice, unitCartonPrice, originalRowTotal, discountedRowTotal }) => (
            <div
              key={product.id}
              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-100 truncate">{product.name}</h4>
                  <div className="text-[11px] text-slate-400 mt-0.5 space-y-0.5">
                    {multiplier > 1 ? (
                      <div className="flex items-baseline gap-1">
                        <span>فی هر بسته: </span>
                        {totalDiscountPercent > 0 && (
                          <span className="line-through text-slate-500 font-mono text-[10px]">
                            {formatPrice(originalUnitPrice * multiplier)}
                          </span>
                        )}
                        <Price value={unitCartonPrice} size="sm" tone="default" unit="تومان" bold />
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span>فی: </span>
                        {totalDiscountPercent > 0 && (
                          <span className="line-through text-slate-500 font-mono text-[10px]">
                            {formatPrice(originalUnitPrice)}
                          </span>
                        )}
                        <Price value={discountedUnitPrice} size="sm" tone="muted" unit={`تومان / ${product.unit}`} bold={false} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  {totalDiscountPercent > 0 && (
                    <span className="line-through text-slate-500 font-mono text-[10px] block text-left">
                      {formatPrice(originalRowTotal)}
                    </span>
                  )}
                  <Price value={discountedRowTotal} size="sm" tone="success" unit="تومان" bold className="block" />
                  {multiplier > 1 && (
                    <span className="text-[10px] text-indigo-400 num-fa block">
                      {(quantity * multiplier).toLocaleString('fa-IR')} عدد
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span className="text-xs text-slate-400 font-medium num-fa">
                  {multiplier > 1
                    ? `${quantity.toLocaleString('fa-IR')} بسته (${multiplier.toLocaleString('fa-IR')} عددی)`
                    : `${quantity.toLocaleString('fa-IR')} ${product.unit}`}
                </span>
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
          {/* Discount Breakdown when totalDiscountPercent > 0 */}
          {totalDiscountPercent > 0 && (
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>جمع کل قبل از تخفیف:</span>
                <span className="font-mono font-bold text-slate-300">
                  {formatPrice(originalTotalAmount)} تومان
                </span>
              </div>
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span className="flex items-center gap-1">
                  <Percent className="w-3 h-3 text-emerald-400" />
                  <span>تخفیف ویژه اختصاصی ({totalDiscountPercent}٪):</span>
                </span>
                <span className="font-mono font-black">
                  -{formatPrice(discountAmount)} تومان
                </span>
              </div>
            </div>
          )}

          {/* Summary Row */}
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-bold text-slate-200">
              {totalDiscountPercent > 0 ? 'مبلغ قابل پرداخت:' : 'جمع کل سفارش:'}
            </span>
            <Price
              value={payableTotalAmount}
              size="lg"
              tone="success"
              unit="تومان"
              bold
              className="text-base sm:text-lg font-extrabold"
            />
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
      <div className={`sticky top-20 ${cartEntries.length === 0 ? 'h-auto' : 'h-[calc(100vh-6rem)]'}`}>
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
