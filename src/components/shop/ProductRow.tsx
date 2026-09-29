import React, { useState } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { QuantityStepper } from './QuantityStepper';
import { formatPrice, LOW_STOCK_THRESHOLD } from './shopUtils';
import { Package, Maximize2, X, Tag, Warehouse, Heart, Clock, Sparkles } from 'lucide-react';

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
  const { productLikes, toggleProductLike, currentUser, selectedSupermarketId, supermarkets } = useApp();
  const [imageError, setImageError] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const isMarketTest = Boolean(product.is_market_test);
  const available = Math.max(0, product.stock - product.reserved_stock);
  const isOutOfStock = !isMarketTest && available <= 0;
  const isLowStock = !isMarketTest && !isOutOfStock && available <= LOW_STOCK_THRESHOLD;

  const currentShop = supermarkets.find(
    (s) => s.id === selectedSupermarketId || (currentUser.id && s.id === currentUser.id)
  );

  const shopInfo = {
    id: currentShop?.id || currentUser.id || 'current-shop',
    name: currentShop?.name || currentUser.name || 'فروشگاه',
    owner: currentShop?.owner || '',
    phone: currentShop?.phone || currentUser.phone || '',
  };

  const itemLikes = productLikes.filter((pl) => pl.product_id === product.id);
  const hasLiked = itemLikes.some((pl) => pl.supermarket_id === shopInfo.id);

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    await toggleProductLike(product.id, shopInfo);
    setIsLiking(false);
  };

  return (
    <>
      <div
        className={`relative overflow-hidden p-3 rounded-2xl border transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isMarketTest
            ? 'market-test-card border-violet-500/50 bg-slate-900 hover:border-violet-500/70 shadow-violet-950/20'
            : isOutOfStock
            ? 'opacity-60 bg-slate-950/40 border-slate-800'
            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Diagonal Corner Ribbon for "به زودی" */}
        {isMarketTest && (
          <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden pointer-events-none z-10">
            <div className="absolute top-3 -right-6 w-24 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white text-[10px] font-black text-center py-0.5 rotate-45 shadow-md border-y border-violet-300/30">
              به زودی
            </div>
          </div>
        )}

        {/* Right side: Product Image + Info */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          {/* 56px-64px clickable image with zoom hover badge */}
          <button
            type="button"
            onClick={() => setIsImageModalOpen(true)}
            className={`group relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-950 border flex items-center justify-center shrink-0 overflow-hidden cursor-pointer shadow-xs transition ${
              isMarketTest ? 'border-violet-500/50 hover:border-violet-400' : 'border-slate-800/80 hover:border-emerald-500/60'
            }`}
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4
                onClick={() => setIsImageModalOpen(true)}
                className="text-sm font-bold text-slate-100 line-clamp-2 leading-snug hover:text-emerald-400 transition cursor-pointer"
                title={product.name}
              >
                {product.name}
              </h4>
            </div>

            {product.brand && (
              <p className="text-xs text-slate-400">
                برند: <span className="text-slate-300 font-semibold">{product.brand}</span>
              </p>
            )}

            <div className="flex items-center gap-1.5 pt-0.5">
              <span className={`text-sm font-extrabold market-test-price ${isMarketTest ? 'text-violet-300' : 'text-emerald-400'}`}>
                {formatPrice(product.price)}
              </span>
              <span className="text-xs text-slate-500">/ {product.unit}</span>
            </div>
          </div>
        </div>

        {/* Left side: Action Area */}
        <div className="shrink-0 flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
          {isMarketTest ? (
            <div className="flex flex-col items-stretch sm:items-end gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleLikeClick}
                disabled={isLiking}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 ${
                  hasLiked
                    ? 'market-test-btn-liked bg-rose-600/25 text-rose-300 border border-rose-500/50 hover:bg-rose-600/35 shadow-rose-900/30'
                    : 'market-test-btn-unliked bg-violet-950/80 hover:bg-violet-900/90 text-violet-200 border border-violet-700/60 hover:border-violet-500'
                }`}
                title={hasLiked ? 'لغو علاقه‌مندی' : 'ثبت علاقه‌مندی به این کالا'}
              >
                <Heart
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    hasLiked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-violet-400 group-hover:text-rose-400'
                  }`}
                />
                <span>{hasLiked ? 'علاقه‌مندی ثبت شد' : 'علاقه‌مند به خرید'}</span>
                {itemLikes.length > 0 && (
                  <span className="text-[10px] bg-slate-900/90 border border-violet-800/80 px-1.5 py-0.2 rounded-full font-mono text-violet-300">
                    {itemLikes.length.toLocaleString('fa-IR')}
                  </span>
                )}
              </button>

              <p className="text-[10px] market-test-subtext text-violet-300/80 text-center sm:text-left leading-tight max-w-[170px]">
                لایک کنید تا پس از موجود شدن اطلاع‌رسانی گردد.
              </p>
            </div>
          ) : (
            <QuantityStepper
              quantity={quantity}
              available={available}
              onChange={onChangeQuantity}
              disabled={isOutOfStock}
              onExceedLimit={onExceedLimit}
            />
          )}
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
              {isMarketTest ? (
                <div className="absolute top-4 right-4 bg-violet-600/95 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                  <span>تست بازار (به زودی)</span>
                </div>
              ) : isOutOfStock ? (
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
                    <span className={`text-xl font-black font-mono ${isMarketTest ? 'text-violet-400' : 'text-emerald-400'}`}>
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
              {isMarketTest ? (
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="p-2.5 rounded-xl bg-violet-950/40 border border-violet-500/25 text-violet-200 text-xs leading-relaxed">
                    📢 در صورتی که علاقمند به سفارش این کالا هستید لایک کنید تا پس از موجود شدن اطلاع‌رسانی گردد.
                  </div>
                  <button
                    type="button"
                    onClick={handleLikeClick}
                    disabled={isLiking}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                      hasLiked
                        ? 'bg-rose-600/25 text-rose-300 border border-rose-500/50 hover:bg-rose-600/35'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        hasLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                      }`}
                    />
                    <span>{hasLiked ? 'علاقه‌مندی شما ثبت شده است' : 'اعلام نیاز و علاقه‌مندی به این کالا'}</span>
                    {itemLikes.length > 0 && (
                      <span className="text-[11px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full font-mono text-slate-300">
                        {itemLikes.length.toLocaleString('fa-IR')} لایک
                      </span>
                    )}
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
