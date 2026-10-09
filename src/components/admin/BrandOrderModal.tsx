import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import {
  Layers,
  X,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  Save,
  Search,
  Sparkles,
  Info,
  RotateCcw,
} from 'lucide-react';

interface BrandOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: string[];
  products: Product[];
  onSaveOrder: (orderedBrands: string[]) => Promise<{ success: boolean; message: string }>;
}

export const BrandOrderModal: React.FC<BrandOrderModalProps> = ({
  isOpen,
  onClose,
  brands,
  products,
  onSaveOrder,
}) => {
  const [orderedList, setOrderedList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize orderedList when modal opens or brands change
  useEffect(() => {
    if (isOpen) {
      // Collect all brands: system brands plus any brand strings found on products
      const allBrandsSet = new Set<string>();
      brands.forEach((b) => {
        if (b && b.trim()) allBrandsSet.add(b.trim());
      });
      products.forEach((p) => {
        if (p.brand && p.brand.trim()) allBrandsSet.add(p.brand.trim());
      });

      const list: string[] = [];
      // Keep existing order first
      brands.forEach((b) => {
        const clean = b.trim();
        if (allBrandsSet.has(clean) && !list.includes(clean)) {
          list.push(clean);
        }
      });
      // Append any unlisted brands
      allBrandsSet.forEach((b) => {
        if (!list.includes(b)) {
          list.push(b);
        }
      });

      setOrderedList(list);
      setFeedback(null);
      setSearchTerm('');
    }
  }, [isOpen, brands, products]);

  // Count active and in-stock products per brand
  const brandStats = useMemo(() => {
    const stats: Record<string, { total: number; available: number }> = {};
    for (const b of orderedList) {
      stats[b] = { total: 0, available: 0 };
    }
    for (const p of products) {
      const b = (p.brand || 'متفرقه').trim();
      if (!stats[b]) {
        stats[b] = { total: 0, available: 0 };
      }
      if (p.is_active !== false) {
        stats[b].total += 1;
        const avail = Math.max(0, (p.stock || 0) - (p.reserved_stock || 0));
        if (avail > 0 || p.is_market_test) {
          stats[b].available += 1;
        }
      }
    }
    return stats;
  }, [orderedList, products]);

  if (!isOpen) return null;

  const moveBrand = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedList.length) return;

    const copy = [...orderedList];
    const item = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = item;
    setOrderedList(copy);
  };

  const moveToTop = (index: number) => {
    if (index === 0) return;
    const copy = [...orderedList];
    const [item] = copy.splice(index, 1);
    copy.unshift(item);
    setOrderedList(copy);
  };

  const handleResetAlphabetical = () => {
    const sorted = [...orderedList].sort((a, b) => a.localeCompare(b, 'fa'));
    setOrderedList(sorted);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await onSaveOrder(orderedList);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'ترتیب برندها با موفقیت ذخیره شد.' });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: res.message || 'خطا در ذخیره ترتیب برندها' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'خطا در ارتباط با سرور هنگام ذخیره' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredDisplay = orderedList
    .map((brand, originalIndex) => ({ brand, originalIndex }))
    .filter(({ brand }) => !searchTerm.trim() || brand.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                ترتیب نمایش برندها در کاتالوگ فروشگاه
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تعیین اولویت کلونی‌های کالا بر اساس برند
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-3 bg-purple-950/40 border-b border-purple-900/40 text-purple-200 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px] sm:text-xs">
            در کاتالوگ فروشگاه، کالاها به ترتیب برندهای زیر به‌صورت <strong>کلونی‌های مجزا</strong> نمایش داده می‌شوند.
            اگر تمام کالاهای یک برند <strong>ناموجود یا غیرفعال</strong> شوند، آن برند به‌صورت خودکار از کاتالوگ فروشگاه حذف می‌گردد.
          </p>
        </div>

        {/* Toolbar: Search & Reset */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی برند..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={handleResetAlphabetical}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
            title="مرتب‌سازی الفبایی پیش‌فرض"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">الفبایی</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`m-3 p-3 rounded-xl border flex items-center gap-2 text-xs font-bold animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Brands Re-order List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filteredDisplay.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              برندی با این نام یافت نشد.
            </div>
          ) : (
            filteredDisplay.map(({ brand, originalIndex }) => {
              const stat = brandStats[brand] || { total: 0, available: 0 };
              const isFirst = originalIndex === 0;
              const isLast = originalIndex === orderedList.length - 1;
              const isOutOfStock = stat.available === 0;

              return (
                <div
                  key={brand}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                    isOutOfStock
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Position Rank & Brand Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-purple-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
                      {originalIndex + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-100 truncate">
                          {brand}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-rose-950/70 text-rose-300 border border-rose-800/40">
                            ناموجود (در کاتالوگ مخفی می‌شود)
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
                            {stat.available} کالا موجود
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        مجموع {stat.total} کالای تعریف‌شده
                      </span>
                    </div>
                  </div>

                  {/* Right: Move Up / Down Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => moveBrand(originalIndex, 'up')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 transition cursor-pointer"
                      title="یک ردیف به بالا"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => moveBrand(originalIndex, 'down')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 transition cursor-pointer"
                      title="یک ردیف به پایین"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => moveToTop(originalIndex)}
                      className="px-2 py-1 rounded-lg bg-purple-600/15 hover:bg-purple-600/25 disabled:opacity-30 border border-purple-500/30 text-purple-300 text-[10px] font-bold transition cursor-pointer hidden xs:inline"
                      title="انتقال به اولویت اول"
                    >
                      بالای بالا
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره ترتیب برندها'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
