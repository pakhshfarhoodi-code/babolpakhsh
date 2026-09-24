import React, { useState } from 'react';
import { Product } from '../../types';
import { QuantityStepper } from './QuantityStepper';
import { formatPrice, LOW_STOCK_THRESHOLD } from './shopUtils';
import { Package } from 'lucide-react';

interface ProductRowProps {
  product: Product;
  quantity: number;
  onChangeQuantity: (qty: number) => void;
  onExceedLimit?: (maxAvailable: number) => void;
}

export const ProductRow: React.FC<ProductRowProps> = ({
  product,
  quantity,
  onChangeQuantity,
  onExceedLimit,
}) => {
  const [imageError, setImageError] = useState(false);
  const available = Math.max(0, product.stock - product.reserved_stock);
  const isOutOfStock = available <= 0;
  const isLowStock = !isOutOfStock && available <= LOW_STOCK_THRESHOLD;

  return (
    <div
      className={`p-3 rounded-2xl bg-slate-900 border border-slate-800 transition shadow-xs flex items-center justify-between gap-3 ${
        isOutOfStock ? 'opacity-60 bg-slate-950/40' : 'hover:border-slate-700'
      }`}
    >
      {/* Right side: Product Image + Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* 56px-64px lazy image with fallback */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center shrink-0 overflow-hidden relative">
          {!imageError && product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-6 h-6 text-slate-600" />
          )}

          {/* Stock Badges */}
          {isOutOfStock ? (
            <span className="absolute bottom-0 inset-x-0 bg-rose-950/90 text-rose-300 text-xs font-bold text-center py-0.5 border-t border-rose-800/60">
              ناموجود
            </span>
          ) : isLowStock ? (
            <span className="absolute bottom-0 inset-x-0 bg-amber-950/90 text-amber-300 text-xs font-semibold text-center py-0.5 border-t border-amber-800/60">
              کم‌موجود
            </span>
          ) : null}
        </div>

        {/* Name, Brand & Price */}
        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-sm font-bold text-slate-100 line-clamp-2 leading-snug">
            {product.name}
          </h4>

          {product.brand && (
            <p className="text-xs text-slate-400">
              برند: {product.brand}
            </p>
          )}

          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-sm font-extrabold text-emerald-400">
              {formatPrice(product.price)}
            </span>
            <span className="text-xs text-slate-500">/ {product.unit}</span>
          </div>
        </div>
      </div>

      {/* Left side: Quantity Stepper */}
      <div className="shrink-0 flex items-center">
        <QuantityStepper
          quantity={quantity}
          available={available}
          onChange={onChangeQuantity}
          disabled={isOutOfStock}
          onExceedLimit={onExceedLimit}
        />
      </div>
    </div>
  );
};
