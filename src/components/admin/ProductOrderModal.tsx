import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { getProductAvailabilityTier } from '../shop/shopUtils';
import {
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Save,
  Search,
  Sparkles,
  RotateCcw,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ProductOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: string[];
  products: Product[];
  productOrderMap: Record<string, string[]>;
  onSaveProductOrder: (brandName: string, orderedProductIds: string[]) => Promise<{ success: boolean; message: string }>;
  initialBrand?: string;
}

export const ProductOrderModal: React.FC<ProductOrderModalProps> = ({
  isOpen,
  onClose,
  brands,
  products,
  productOrderMap,
  onSaveProductOrder,
  initialBrand,
}) => {
  // 1. Available brands that have products
  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>();
    // First keep existing brands order
    (brands || []).forEach((b) => {
      const clean = (b || '').trim();
      if (clean) brandSet.add(clean);
    });
    // Add any brands from products
    products.forEach((p) => {
      const clean = (p.brand || 'متفرقه').trim();
      if (clean) brandSet.add(clean);
    });

    // Filter to only brands that actually have products in system
    const result: string[] = [];
    brandSet.forEach((b) => {
      const hasProducts = products.some((p) => (p.brand || 'متفرقه').trim().toLowerCase() === b.toLowerCase());
      if (hasProducts) {
        result.push(b);
      }
    });

    return result;
  }, [brands, products]);

  // Active brand selection
  const [selectedBrand, setSelectedBrand] = useState<string>(() => {
    if (initialBrand && availableBrands.includes(initialBrand)) {
      return initialBrand;
    }
    return availableBrands[0] || 'متفرقه';
  });

  // Keep selectedBrand valid if availableBrands changes
  useEffect(() => {
    if (availableBrands.length > 0 && !availableBrands.includes(selectedBrand)) {
      setSelectedBrand(availableBrands[0]);
    }
  }, [availableBrands, selectedBrand]);

  // 2. Ordered product list for currently selected brand
  const [orderedProductIds, setOrderedProductIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize ordered products when modal opens or selectedBrand changes
  useEffect(() => {
    if (!isOpen) return;

    // Filter all products of the selected brand
    const brandProducts = products.filter(
      (p) => (p.brand || 'متفرقه').trim().toLowerCase() === selectedBrand.toLowerCase()
    );

    const existingOrder = productOrderMap[selectedBrand] || productOrderMap[selectedBrand.trim()] || [];

    // Order existing products according to saved order, then append any remaining products
    const initialList: Product[] = [];
    const addedIds = new Set<string>();

    existingOrder.forEach((id) => {
      const match = brandProducts.find((p) => p.id === id);
      if (match && !addedIds.has(match.id)) {
        initialList.push(match);
        addedIds.add(match.id);
      }
    });

    // Sort remaining products with availability tier, then alphabetical
    const remaining = brandProducts.filter((p) => !addedIds.has(p.id));
    remaining.sort((a, b) => {
      const tierDiff = getProductAvailabilityTier(a) - getProductAvailabilityTier(b);
      if (tierDiff !== 0) return tierDiff;
      return a.name.localeCompare(b.name, 'fa');
    });

    remaining.forEach((p) => {
      initialList.push(p);
      addedIds.add(p.id);
    });

    setOrderedProductIds(initialList.map((p) => p.id));
    setFeedback(null);
    setSearchTerm('');
  }, [isOpen, selectedBrand, products, productOrderMap]);

  // Product lookup map for fast rendering
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Count products and available counts per brand for tab badges
  const brandStatsMap = useMemo(() => {
    const map: Record<string, { total: number; inStock: number }> = {};
    availableBrands.forEach((b) => {
      map[b] = { total: 0, inStock: 0 };
    });

    products.forEach((p) => {
      const b = (p.brand || 'متفرقه').trim();
      if (!map[b]) {
        map[b] = { total: 0, inStock: 0 };
      }
      map[b].total += 1;
      const avail = Math.max(0, (p.stock || 0) - (p.reserved_stock || 0));
      if (avail > 0 && !p.is_market_test) {
        map[b].inStock += 1;
      }
    });
    return map;
  }, [availableBrands, products]);

  if (!isOpen) return null;

  // Move product up or down
  const moveProduct = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedProductIds.length) return;

    const copy = [...orderedProductIds];
    const item = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = item;
    setOrderedProductIds(copy);
  };

  // Move product to absolute top or bottom
  const moveToExtreme = (index: number, to: 'top' | 'bottom') => {
    if (to === 'top' && index === 0) return;
    if (to === 'bottom' && index === orderedProductIds.length - 1) return;

    const copy = [...orderedProductIds];
    const [item] = copy.splice(index, 1);
    if (to === 'top') {
      copy.unshift(item);
    } else {
      copy.push(item);
    }
    setOrderedProductIds(copy);
  };

  // Smart Auto-Sort: Available first -> Test middle -> Out of stock last
  const handleAutoSort = () => {
    const currentItems = orderedProductIds
      .map((id) => productMap.get(id))
      .filter((p): p is Product => Boolean(p));

    currentItems.sort((a, b) => {
      const tierDiff = getProductAvailabilityTier(a) - getProductAvailabilityTier(b);
      if (tierDiff !== 0) return tierDiff;
      return a.name.localeCompare(b.name, 'fa');
    });

    setOrderedProductIds(currentItems.map((p) => p.id));
    setFeedback({
      type: 'success',
      message: 'کالاها به‌صورت هوشمند مرتب شدند (کالاهای موجود در بالا، تست بازار در میانه و ناموجودها در انتها). برای ذخیره نهایی، دکمه ذخیره را بزنید.',
    });
  };

  // Reset to Alphabetical
  const handleResetAlphabetical = () => {
    const currentItems = orderedProductIds
      .map((id) => productMap.get(id))
      .filter((p): p is Product => Boolean(p));

    currentItems.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    setOrderedProductIds(currentItems.map((p) => p.id));
    setFeedback({
      type: 'success',
      message: 'کالاها بر اساس حروف الفبا مرتب شدند.',
    });
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await onSaveProductOrder(selectedBrand, orderedProductIds);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
      } else {
        setFeedback({ type: 'error', message: res.message || 'خطا در ذخیره ترتیب کالاها' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ذخیره';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered product items based on user search in modal
  const displayedItems = orderedProductIds
    .map((id, index) => {
      const product = productMap.get(id);
      return { id, product, originalIndex: index };
    })
    .filter(({ product }) => {
      if (!product) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return product.name.toLowerCase().includes(term);
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Package className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-100">
                تنظیم اولویت و ترتیب نمایش کالاها در کاتالوگ
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              کالاهای هر برند را به ترتیب دلخواه بچینید. در سیستم کاتالوگ، کالاهای موجود همیشه در صدر، کالاهای تست بازار در میانه و کالاهای ناموجود به‌طور خودکار در انتهای هر برند قرار می‌گیرند.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Brand Selector Tabs */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800/80">
          <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>انتخاب برند برای تنظیم ترتیب کالاها:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            {availableBrands.map((b) => {
              const stats = brandStatsMap[b] || { total: 0, inStock: 0 };
              const isSelected = selectedBrand.toLowerCase() === b.toLowerCase();
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedBrand(b)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <span>{b}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isSelected ? 'bg-indigo-700/80 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {stats.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls & Search Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/50 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          {/* Quick Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`جستجو در بین کالاهای برند «${selectedBrand}»...`}
              className="w-full h-9 pr-9 pl-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 transition"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoSort}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition cursor-pointer shadow-xs"
              title="کالاهای دارای موجودی به اول لیست و ناموجودها به آخر منتقل می‌شوند"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>مرتب‌سازی هوشمند موجودی</span>
            </button>

            <button
              type="button"
              onClick={handleResetAlphabetical}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
              title="مرتب‌سازی الفبایی"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>حروف الفبا</span>
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl flex items-center gap-2 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
                : 'bg-rose-950/50 border border-rose-800 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 divide-y divide-slate-800/40">
          {displayedItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-medium">
              هیچ کالایی برای نمایش در این برند یافت نشد.
            </div>
          ) : (
            displayedItems.map(({ id, product, originalIndex }) => {
              if (!product) return null;

              const availStock = Math.max(0, (product.stock || 0) - (product.reserved_stock || 0));
              const isMarketTest = Boolean(product.is_market_test);
              const isOutOfStock = availStock <= 0 && !isMarketTest;

              return (
                <div
                  key={id}
                  className={`pt-2 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-xl transition ${
                    isOutOfStock
                      ? 'bg-slate-950/40 opacity-70 border border-slate-800/40'
                      : isMarketTest
                      ? 'bg-amber-950/20 border border-amber-900/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50'
                  }`}
                >
                  {/* Left (RTL right): Rank, Image & Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-300 shrink-0 font-mono">
                      {originalIndex + 1}
                    </div>

                    {/* Product Image Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-slate-500" />
                      )}
                    </div>

                    {/* Title and Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                          {product.name}
                        </span>

                        {/* Status badge */}
                        {isMarketTest ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            تست بازار
                          </span>
                        ) : isOutOfStock ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            ناموجود
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            موجود: {availStock} {product.unit || 'عدد'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                        <span>قیمت: {product.price?.toLocaleString('fa-IR')} تومان</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Move buttons) */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Move to Top */}
                    <button
                      type="button"
                      disabled={originalIndex === 0}
                      onClick={() => moveToExtreme(originalIndex, 'top')}
                      title="انتقال به ابتدای لیست"
                      className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer border border-slate-800"
                    >
                      <ArrowUpToLine className="w-3.5 h-3.5 text-indigo-400" />
                    </button>

                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={originalIndex === 0}
                      onClick={() => moveProduct(originalIndex, 'up')}
                      title="یک ردیف بالاتر"
                      className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer border border-slate-800"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={originalIndex === orderedProductIds.length - 1}
                      onClick={() => moveProduct(originalIndex, 'down')}
                      title="یک ردیف پایین‌تر"
                      className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer border border-slate-800"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                    </button>

                    {/* Move to Bottom */}
                    <button
                      type="button"
                      disabled={originalIndex === orderedProductIds.length - 1}
                      onClick={() => moveToExtreme(originalIndex, 'bottom')}
                      title="انتقال به انتهای لیست"
                      className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer border border-slate-800"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>
              کالاهای با ردیف کمتر (۱، ۲، ...) در کاتالوگ فروشگاه‌ها بالاتر دیده خواهند شد.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'در حال ذخیره...' : `ذخیره ترتیب «${selectedBrand}»`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
