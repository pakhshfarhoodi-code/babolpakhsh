import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { formatPrice } from './helpers';
import {
  getPackSize,
  getBaseUnit,
} from '../../utils/orderLine';
import {
  Package,
  Plus,
  Sparkles,
  Search,
  ListFilter,
  Check,
} from 'lucide-react';

interface SurplusItemsStepProps {
  availableSurplusProducts: Product[];
  inlineSurplusCustomerLabel: string;
  isSubmittingInlineSurplus: boolean;
  isReadOnly: boolean;
  onChangeCustomerLabel: (label: string) => void;
  onAddInlineSurplus: (productId: string, qty: number) => Promise<void> | void;
  onOpenSurplusModal: () => void;
}

export const SurplusItemsStep: React.FC<SurplusItemsStepProps> = ({
  availableSurplusProducts,
  inlineSurplusCustomerLabel,
  isSubmittingInlineSurplus,
  isReadOnly,
  onChangeCustomerLabel,
  onAddInlineSurplus,
  onOpenSurplusModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [isCustomerLabelOpen, setIsCustomerLabelOpen] = useState(() => Boolean(inlineSurplusCustomerLabel));
  const [rowQuantities, setRowQuantities] = useState<Record<string, number | string>>({});

  // Filtered products for list mode
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableSurplusProducts.filter((p) => {
      // Exclude market test items
      if (p.is_market_test) return false;
      // Must have active status and valid visitor purchase price
      if (p.is_active === false || (p.visitor_price ?? 0) <= 0) return false;
      
      const freeStock = Math.max(0, p.stock - p.reserved_stock);
      // Filter out-of-stock when inStockOnly is active
      if (inStockOnly && freeStock <= 0) return false;

      // Filter by name or brand
      if (q) {
        const matchName = p.name?.toLowerCase().includes(q);
        const matchBrand = p.brand?.toLowerCase().includes(q);
        if (!matchName && !matchBrand) return false;
      }

      return true;
    });
  }, [availableSurplusProducts, searchQuery, inStockOnly]);

  const getRowQty = (productId: string) => {
    const val = rowQuantities[productId];
    if (val === undefined || val === '') return 1;
    const num = parseFloat(String(val));
    return isNaN(num) || num <= 0 ? 1 : num;
  };

  const handleRowQtyStep = (productId: string, delta: number, maxStock: number) => {
    const cur = getRowQty(productId);
    const next = Math.max(0.001, Math.min(maxStock > 0 ? maxStock : 9999, Math.round((cur + delta) * 1000) / 1000));
    setRowQuantities((prev) => ({ ...prev, [productId]: next }));
  };

  const handleRowQtyChange = (productId: string, rawVal: string, maxStock: number) => {
    if (rawVal === '') {
      setRowQuantities((prev) => ({ ...prev, [productId]: '' }));
      return;
    }
    const parsed = parseFloat(rawVal);
    if (isNaN(parsed)) return;
    const clamped = Math.max(0.001, Math.min(maxStock > 0 ? maxStock : parsed, parsed));
    setRowQuantities((prev) => ({ ...prev, [productId]: clamped }));
  };

  const handleRowAdd = async (productId: string) => {
    const qty = getRowQty(productId);
    await onAddInlineSurplus(productId, qty);
    // Reset quantity after successful add
    setRowQuantities((prev) => ({ ...prev, [productId]: 1 }));
  };

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-5 shadow-sm space-y-3.5">
      {/* 1. Step Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center num-fa">
            ۳
          </span>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-100">
              افزودن اقلام مازاد
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              قیمت خرید ویزیتور
            </span>
          </div>
        </div>

        {/* 2-State View Mode: List vs Visual Catalog */}
        {!isReadOnly && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              className="px-3 py-1 rounded-lg bg-purple-600 text-white font-bold text-xs shadow-xs cursor-default"
            >
              فهرست
            </button>
            <button
              type="button"
              onClick={onOpenSurplusModal}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium transition cursor-pointer"
              title="مشاهده کاتالوگ تصویری و انتخاب دسته‌جمعی"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>کاتالوگ تصویری</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Search, In-Stock Filter Chip & Shared Customer Label Link */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجوی نام کالا یا برند..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pr-9 pl-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/80 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* In-Stock Filter Chip */}
          <button
            type="button"
            onClick={() => setInStockOnly((prev) => !prev)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-medium transition cursor-pointer select-none ${
              inStockOnly
                ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>فقط کالاهای موجود</span>
            {inStockOnly && <Check className="w-3.5 h-3.5 text-emerald-400 mr-0.5" />}
          </button>
        </div>

        {/* Shared Optional Customer Name (Collapsed under link) */}
        {!isReadOnly && (
          <div>
            {!isCustomerLabelOpen && !inlineSurplusCustomerLabel ? (
              <button
                type="button"
                onClick={() => setIsCustomerLabelOpen(true)}
                className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition cursor-pointer flex items-center gap-1"
              >
                <span>+ افزودن نام مشتری یا برچسب (اختیاری)</span>
              </button>
            ) : (
              <div className="p-2 sm:p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2 animate-in fade-in">
                <label className="text-[11px] text-slate-400 font-medium shrink-0">
                  نام مشتری / برچسب:
                </label>
                <input
                  type="text"
                  placeholder="پیش‌فرض: اقلام مازاد"
                  value={inlineSurplusCustomerLabel}
                  onChange={(e) => onChangeCustomerLabel(e.target.value)}
                  className="flex-1 h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                {inlineSurplusCustomerLabel ? (
                  <button
                    type="button"
                    onClick={() => onChangeCustomerLabel('')}
                    className="text-slate-500 hover:text-slate-300 text-xs p-1"
                    title="پاک کردن"
                  >
                    ✕
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCustomerLabelOpen(false)}
                    className="text-slate-500 hover:text-slate-300 text-xs p-1"
                    title="بستن"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Compact Scrollable Product List (max height ~360px) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">کالایی یافت نشد</p>
            <p className="text-[11px] text-slate-500">
              {searchQuery
                ? 'کالایی با عبارت جستجوی واردشده پیدا نشد.'
                : 'کالای فعالی برای افزودن به اقلام مازاد وجود ندارد.'}
            </p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-800/60 pr-1">
            {filteredProducts.map((p) => {
              const pack = getPackSize(p.items_per_package);
              const baseUnit = getBaseUnit(p.unit, pack);
              const freeStock = Math.max(0, p.stock - p.reserved_stock);
              const effectivePrice =
                p.visitor_price && p.visitor_price > 1 ? p.visitor_price : (p.price || 0);
              const currentQty = getRowQty(p.id);

              return (
                <div
                  key={p.id}
                  className="p-2.5 sm:px-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 hover:bg-slate-900/40 transition"
                >
                  {/* Right: Product Name & Specs */}
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-bold text-xs sm:text-sm text-slate-100 truncate"
                      title={p.name}
                    >
                      {p.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 flex-wrap">
                      {p.brand && (
                        <span className="text-slate-300 font-medium">
                          {p.brand}
                        </span>
                      )}
                      {p.brand && <span className="text-slate-600">·</span>}
                      <span>
                        بسته <strong className="num-fa">{pack.toLocaleString('fa-IR')}</strong> عددی ({baseUnit})
                      </span>
                    </div>
                  </div>

                  {/* Middle: Visitor Price & Free Stock */}
                  <div className="flex items-center gap-3 sm:gap-4 text-xs shrink-0">
                    <div className="text-left">
                      <span className="font-black text-emerald-400 num-fa text-xs sm:text-sm">
                        {formatPrice(effectivePrice)}
                      </span>
                      <span className="text-[10px] text-slate-400 mr-1">تومان</span>
                    </div>

                    <div className="text-left min-w-[70px]">
                      <span className="text-[10px] text-slate-400 block">موجودی آزاد:</span>
                      <span
                        className={`font-bold num-fa text-xs ${
                          freeStock > 0 ? 'text-blue-400' : 'text-rose-400'
                        }`}
                      >
                        {freeStock.toLocaleString('fa-IR')} {p.unit || 'عدد'}
                      </span>
                    </div>
                  </div>

                  {/* Left: Quantity Stepper & Add Button */}
                  {!isReadOnly && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700/80 overflow-hidden h-9">
                        <button
                          type="button"
                          onClick={() => handleRowQtyStep(p.id, -1, freeStock)}
                          disabled={currentQty <= 1 || freeStock <= 0}
                          className="px-2.5 h-full text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer text-sm font-bold"
                          title="کاهش"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0.001"
                          max={freeStock > 0 ? freeStock : undefined}
                          step="any"
                          value={rowQuantities[p.id] ?? 1}
                          onChange={(e) => handleRowQtyChange(p.id, e.target.value, freeStock)}
                          className="w-12 h-full text-center text-xs text-slate-100 font-bold num-fa bg-transparent border-0 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRowQtyStep(p.id, 1, freeStock)}
                          disabled={currentQty >= freeStock || freeStock <= 0}
                          className="px-2.5 h-full text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer text-sm font-bold"
                          title="افزایش"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRowAdd(p.id)}
                        disabled={freeStock <= 0 || isSubmittingInlineSurplus || p.is_market_test}
                        className="h-9 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs transition shadow-sm shadow-purple-600/30 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        title="افزودن این کالا به فاکتور بار"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
