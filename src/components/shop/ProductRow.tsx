import React, { useState } from 'react';
import { Product } from '../../types';
import { QuantityStepper } from './QuantityStepper';
import { formatPrice, LOW_STOCK_THRESHOLD } from './shopUtils';
import { Package, Maximize2, X, Tag, Warehouse } from 'lucide-react';

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
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const available = Math.max(0, product.stock - product.reserved_stock);
  const isOutOfStock = available <= 0;
  const isLowStock = !isOutOfStock && available <= LOW_STOCK_THRESHOLD;

  return (
    <>
      <div
        className={`p-3 rounded-2xl bg-slate-900 border border-slate-800 transition shadow-xs flex items-center justify-between gap-3 ${
          isOutOfStock ? 'opacity-60 bg-slate-950/40' : 'hover:border-slate-700'
        }`}
      >
        {/* Right side: Product Image + Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* 56px-64px clickable image with zoom hover badge */}
          <button
            type="button"
            onClick={() => setIsImageModalOpen(true)}
            className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer shadow-xs hover:border-emerald-500/60 transition"
            title="برای مشاهده تصویر بزرگ کالا کلیک کنید"
          >
            {!imageError && product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                loading="lazy"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Package className="w-6 h-6 text-slate-600" />
            )}

            {/* Hover Zoom Icon */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
              <Maximize2 className="w-4 h-4 text-emerald-300 drop-shadow-md" />
            </div>

            {/* Stock Badges */}
            {isOutOfStock ? (
              <span className="absolute bottom-0 inset-x-0 bg-rose-950/90 text-rose-300 text-xs font-bold text-center py-0.5 border-t border-rose-800/60 z-10">
                ناموجود
              </span>
            ) : isLowStock ? (
              <span className="absolute bottom-0 inset-x-0 bg-amber-950/90 text-amber-300 text-xs font-semibold text-center py-0.5 border-t border-amber-800/60 z-10">
                کم‌موجود
              </span>
            ) : null}
          </button>

          {/* Name, Brand & Price */}
          <div className="min-w-0 flex-1 space-y-1">
            <h4
              onClick={() => setIsImageModalOpen(true)}
              className="text-sm font-bold text-slate-100 line-clamp-2 leading-snug hover:text-emerald-400 transition cursor-pointer"
              title={product.name}
            >
              {product.name}
            </h4>

            {product.brand && (
              <p className="text-xs text-slate-400">
                برند: <span className="text-slate-300 font-semibold">{product.brand}</span>
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

      {/* Large Image Lightbox / Modal */}
      {isImageModalOpen && (
        <div
          onClick={() => setIsImageModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-0 my-auto animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-base text-slate-100 truncate">{product.name}</h3>
                {product.brand && (
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-semibold">
                    برند: {product.brand}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer shrink-0"
                title="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Image Preview */}
            <div className="relative w-full h-72 sm:h-80 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800 p-2">
              {!imageError && product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-contain rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-600">
                  <Package className="w-16 h-16" />
                  <span className="text-xs text-slate-500">تصویر اختصاصی برای این کالا ثبت نشده است</span>
                </div>
              )}

              {/* Status Badge Over Image */}
              {isOutOfStock ? (
                <div className="absolute top-4 right-4 bg-rose-600/90 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-lg">
                  ناموجود در سردخانه
                </div>
              ) : isLowStock ? (
                <div className="absolute top-4 right-4 bg-amber-600/90 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-lg">
                  کم‌موجود ({available} {product.unit})
                </div>
              ) : null}
            </div>

            {/* Price & Order Action Bar */}
            <div className="p-4 sm:p-5 bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">قیمت خرید فروشگاه:</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      {formatPrice(product.price)}
                    </span>
                    <span className="text-xs text-slate-400">/ {product.unit}</span>
                  </div>
                </div>

                {product.consumer_price && product.consumer_price > 0 && (
                  <div className="text-left">
                    <span className="text-[11px] text-slate-400 block mb-0.5">قیمت مصرف‌کننده:</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">
                      {formatPrice(product.consumer_price)}
                    </span>
                  </div>
                )}
              </div>

              {/* Stock info and Order Controls */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                  <span>موجودی آزاد:</span>
                  <span className="font-bold text-slate-200">
                    {available.toLocaleString('fa-IR')} {product.unit}
                  </span>
                </div>

                {/* Direct Quantity Stepper */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">تعداد سفارش:</span>
                  <QuantityStepper
                    quantity={quantity}
                    available={available}
                    onChange={onChangeQuantity}
                    disabled={isOutOfStock}
                    onExceedLimit={onExceedLimit}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
