import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { QuantityStepper } from './QuantityStepper';
import { formatPrice, LOW_STOCK_THRESHOLD } from './shopUtils';
import { Price } from './Price';
import { Package, Maximize2, X, Tag, Warehouse, Heart, Clock, Sparkles, Check } from 'lucide-react';
import { SafeImage } from '../common/SafeImage';
import {
  getStorePickupDiscountEnabled,
  calculateTotalDiscountPercent,
  calculateDiscountedPrice,
} from '../../utils/storeDiscount';
import {
  getPackSize,
  isPackaged,
  getBaseUnit,
  getSaleUnitLabel,
} from '../../utils/orderLine';

interface ProductRowProps {
  product: Product;
  quantity: number;
  onChangeQuantity: (qty: number) => void;
  onExceedLimit?: (maxAvailable: number) => void;
  priceMode?: 'store' | 'visitor';
}

export const ProductRow: React.FC<ProductRowProps> = ({
  product,
  quantity,
  onChangeQuantity,
  onExceedLimit,
  priceMode = 'store',
}) => {
  const { invoiceSettings, productLikes, toggleProductLike, currentUser, selectedSupermarketId, supermarkets } = useApp();
  const [imageError, setImageError] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);

  // Discount re-evaluation listener
  const [, setDiscountVersion] = useState(0);
  useEffect(() => {
    const handler = () => setDiscountVersion((v) => v + 1);
    window.addEventListener('store-discount-changed', handler);
    return () => window.removeEventListener('store-discount-changed', handler);
  }, []);

  const isMarketTest = Boolean(product.is_market_test);
  const available = Math.round(Math.max(0, product.stock - product.reserved_stock) * 1000) / 1000;
  const isOutOfStock = !isMarketTest && available <= 0;
  const isLowStock = !isMarketTest && !isOutOfStock && available <= LOW_STOCK_THRESHOLD;

  const displayPrice = priceMode === 'visitor'
    ? Number(product.visitor_price ?? 0)
    : product.price;

  const currentShop = supermarkets.find(
    (s) => s.id === selectedSupermarketId || (currentUser.id && s.id === currentUser.id)
  );

  const shopInfo = {
    id: currentShop?.id || currentUser.id || 'current-shop',
    name: currentShop?.name || currentUser.name || 'فروشگاه',
    owner: currentShop?.owner || '',
    phone: currentShop?.phone || currentUser.phone || '',
  };

  const pickupPercent = invoiceSettings?.pickup_discount_percent || 3;
  const pickupEnabled = priceMode === 'store' && getStorePickupDiscountEnabled(shopInfo.id);
  const founderEnabled = priceMode === 'store' && Boolean(currentShop?.founder_discount_enabled);
  const founderPercent = currentShop?.founder_discount_percent || 3;

  const totalDiscountPercent = calculateTotalDiscountPercent(
    pickupEnabled ? pickupPercent : 0,
    founderEnabled ? founderPercent : 0,
    0
  );

  const discountedPrice = calculateDiscountedPrice(displayPrice, totalDiscountPercent);

  const itemLikes = productLikes.filter((pl) => pl.product_id === product.id);
  const hasLiked = itemLikes.some((pl) => pl.supermarket_id === shopInfo.id);

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    setLikeError(null);
    const res = await toggleProductLike(product.id, shopInfo);
    if (!res.success) {
      setLikeError(res.message);
      setTimeout(() => setLikeError(null), 4000);
    }
    setIsLiking(false);
  };

  return (
    <>
      <div
        className={`relative overflow-hidden p-2 rounded-xl border transition shadow-xs flex items-stretch gap-2.5 ${
          isOutOfStock
            ? 'opacity-60 bg-slate-950/40 border-slate-800'
            : quantity > 0
            ? 'bg-slate-900 border-emerald-500/70 shadow-emerald-950/30 ring-1 ring-emerald-500/40'
            : isMarketTest
            ? 'market-test-card border-violet-500/40 bg-slate-900 hover:border-violet-500/60'
            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Part A: Image (Square 72px on sm+, 64px on mobile, relative, object-cover) */}
        <button
          type="button"
          onClick={() => setIsImageModalOpen(true)}
          className={`group relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg bg-slate-950 border flex items-center justify-center shrink-0 overflow-hidden cursor-pointer shadow-xs transition ${
            isMarketTest ? 'border-violet-500/50 hover:border-violet-400' : 'border-slate-800/80 hover:border-emerald-500/60'
          }`}
          title="برای مشاهده تصویر بزرگ کالا کلیک کنید"
        >
          <SafeImage
            src={product.image_url}
            alt={product.name}
            categoryId={product.category_id}
            productName={product.name}
            className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
          />

          {/* Hover Zoom Icon */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
            <Maximize2 className="w-4 h-4 text-emerald-300 drop-shadow-md" />
          </div>

          {/* Narrow bottom status bar on image (never over text) */}
          {isMarketTest ? (
            <span className="absolute bottom-0 inset-x-0 bg-violet-950/95 text-violet-200 text-[10px] font-bold text-center py-0.5 border-t border-violet-700/60 z-10 leading-tight">
              به‌زودی
            </span>
          ) : isOutOfStock ? (
            <span className="absolute bottom-0 inset-x-0 bg-rose-950/95 text-rose-300 text-[10px] font-bold text-center py-0.5 border-t border-rose-800/60 z-10 leading-tight">
              ناموجود
            </span>
          ) : isLowStock ? (
            <span className="absolute bottom-0 inset-x-0 bg-amber-950/95 text-amber-300 text-[10px] font-semibold text-center py-0.5 border-t border-amber-800/60 z-10 leading-tight">
              کم‌موجود
            </span>
          ) : null}
        </button>

        {/* Part B: Text Column (flex-1, min-w-0, flex-col, gap-0.5) */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5 justify-center">
          {/* Line 1: Name (text-[13px], font-medium, leading-snug, line-clamp-2) */}
          <h4
            onClick={() => setIsImageModalOpen(true)}
            className="text-[13px] font-medium leading-snug line-clamp-2 text-slate-100 hover:text-emerald-400 transition cursor-pointer"
            title={product.name}
          >
            {product.name}
          </h4>

          {/* Line 2: Brand and Package badge in 1 line */}
          {(product.brand || (product.items_per_package && product.items_per_package > 0)) && (
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] leading-tight pt-0.5">
              {product.brand ? (
                <span className="truncate min-w-0 text-slate-400" title={`برند: ${product.brand}`}>
                  برند: <span className="text-slate-300 font-semibold">{product.brand}</span>
                </span>
              ) : null}
              {product.brand && product.items_per_package && product.items_per_package > 0 ? (
                <span className="text-slate-500 shrink-0">·</span>
              ) : null}
              {product.items_per_package && product.items_per_package > 0 ? (
                <span className="shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/30 text-[11px] num-fa">
                  بسته {product.items_per_package.toLocaleString('fa-IR')} عددی
                </span>
              ) : null}
            </div>
          )}

          {/* Line 3: Price block with mt-auto, flex-col without wrap */}
          <div className="mt-auto flex flex-col gap-0.5 pt-0.5 leading-tight min-w-0">
            {/* Purchase Price: 14px bold number + 'تومان / واحد' with Price component and whitespace-nowrap */}
            <div className="flex items-baseline whitespace-nowrap min-w-0 flex-wrap gap-1">
              {totalDiscountPercent > 0 ? (
                <>
                  <span className="line-through text-slate-500 text-[11px] font-mono shrink-0">
                    {formatPrice(displayPrice)}
                  </span>
                  <Price
                    value={discountedPrice}
                    size="lg"
                    tone="success"
                    unit={`تومان / ${product.unit}`}
                    bold
                    className="truncate text-[13px] sm:text-[14px]"
                  />
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800/60 shrink-0">
                    ({totalDiscountPercent}٪ تخفیف)
                  </span>
                </>
              ) : (
                <Price
                  value={displayPrice}
                  size="lg"
                  tone={isMarketTest ? 'violet' : 'success'}
                  unit={`تومان / ${product.unit}`}
                  bold
                  className="truncate text-[13px] sm:text-[14px]"
                />
              )}
            </div>

            {/* Consumer Price (Only when consumer_price > 0): 11px amber, whitespace-nowrap */}
            {Boolean(product.consumer_price && product.consumer_price > 0) && (
              <div className="flex items-baseline gap-1 text-[11px] whitespace-nowrap font-medium min-w-0 leading-tight">
                <span className="text-slate-400 text-[10.5px] sm:text-[11px] shrink-0">مصرف‌کننده:</span>
                <Price
                  value={product.consumer_price}
                  size="sm"
                  tone="amber"
                  unit="تومان"
                  bold
                  className="truncate text-[10.5px] sm:text-[11px]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Part C: Action Area (shrink-0, w-[92px], items-center) */}
        <div className="shrink-0 w-[92px] flex flex-col justify-center items-center my-auto">
          {isMarketTest ? (
            <div className="w-full flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={handleLikeClick}
                disabled={isLiking}
                title="با ثبت علاقه‌مندی، از موجود شدن کالا باخبر خواهید شد"
                aria-label="با ثبت علاقه‌مندی، از موجود شدن کالا باخبر خواهید شد"
                className={`h-9 w-full rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-95 select-none ${
                  hasLiked
                    ? 'market-test-btn-liked bg-violet-600 hover:bg-violet-500 text-white border border-violet-500 shadow-violet-900/30'
                    : 'market-test-btn-unliked bg-violet-950/80 hover:bg-violet-900 text-violet-200 border border-violet-700/60 hover:border-violet-500'
                }`}
              >
                {hasLiked ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5] text-white shrink-0" />
                ) : (
                  <Heart className="w-3.5 h-3.5 text-violet-400 group-hover:text-rose-400 shrink-0" />
                )}
                <span className="truncate">{hasLiked ? 'ثبت شد' : 'علاقه‌مندی'}</span>
              </button>

              {likeError ? (
                <div className="text-[10px] text-rose-400 dark:text-rose-300 text-center leading-tight line-clamp-2">
                  {likeError}
                </div>
              ) : (
                <span className="text-[10.5px] sm:text-[11px] leading-tight text-center text-slate-500 dark:text-slate-400 select-none line-clamp-2">
                  موجود شد، خبرتان می‌کنیم
                </span>
              )}
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
              <SafeImage
                src={product.image_url}
                alt={product.name}
                categoryId={product.category_id}
                productName={product.name}
                className="w-full h-full object-contain rounded-2xl"
              />

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
                  <span className="text-xs text-slate-400 block mb-0.5">
                    {priceMode === 'visitor' ? 'قیمت خرید ویزیتور:' : 'قیمت خرید فروشگاه:'}
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <Price
                      value={displayPrice * (product.items_per_package && product.items_per_package > 0 ? product.items_per_package : 1)}
                      size="lg"
                      tone={isMarketTest ? 'violet' : 'success'}
                      unit="تومان"
                      bold
                      className="text-lg sm:text-xl font-black"
                    />
                    <span className="text-xs text-slate-400">/ هر {product.unit}</span>
                    {product.items_per_package && product.items_per_package > 0 && (
                      <span className="text-xs text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-lg font-bold num-fa inline-flex items-center gap-1">
                        <span>{product.items_per_package.toLocaleString('fa-IR')} عددی</span>
                        <span className="text-indigo-400 font-normal">(دانه‌ای <Price value={displayPrice} size="sm" tone="violet" unit="تومان" />)</span>
                      </span>
                    )}
                  </div>
                </div>

                {product.consumer_price && product.consumer_price > 0 && (
                  <div className="text-left">
                    <span className="text-[11px] text-slate-400 block mb-0.5">قیمت مصرف‌کننده:</span>
                    <div className="flex flex-col items-end">
                      <Price
                        value={product.consumer_price * (product.items_per_package && product.items_per_package > 0 ? product.items_per_package : 1)}
                        size="md"
                        tone="amber"
                        unit="تومان"
                        bold
                      />
                      {product.items_per_package && product.items_per_package > 0 && (
                        <div className="text-[10px] text-amber-400/80 num-fa mt-0.5">
                          (هر عدد: <Price value={product.consumer_price} size="sm" tone="amber" unit="تومان" />)
                        </div>
                      )}
                    </div>
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
                      <span className="text-[11px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full num-fa text-slate-300">
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
                    <span className="font-bold text-slate-200 num-fa">
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
