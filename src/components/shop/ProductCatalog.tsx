import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { ProductRow } from './ProductRow';
import { BrandDropdown } from './BrandDropdown';
import { filterCatalogProducts, sortCatalogProducts } from './shopUtils';
import {
  Search,
  X,
  Package,
  Check,
  Flame,
  ArrowDownAZ,
  ArrowDownNarrowWide,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

export interface ProductCatalogProps {
  products: Product[];
  cart: Record<string, number>;
  onChangeQuantity: (productId: string, qty: number) => void;
  onExceedLimit?: (maxAvailable: number) => void;
  priceMode?: 'store' | 'visitor';
  defaultInStockOnly?: boolean;
  topProductsCard?: React.ReactNode;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  cart,
  onChangeQuantity,
  onExceedLimit,
  priceMode = 'store',
  defaultInStockOnly = false,
  topProductsCard,
}) => {
  const { categories, orders } = useApp();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState<boolean>(defaultInStockOnly);

  // 3 New Display & Sort filters
  // Popular is active by default as requested: "بطور پیش فرض همیشه باید همین فیبتر فعال باشد"
  const [isPopularActive, setIsPopularActive] = useState<boolean>(true);
  const [sortByName, setSortByName] = useState<boolean>(false);
  const [sortByPrice, setSortByPrice] = useState<boolean>(false);

  // Calculate sales volume for each product across past valid orders
  const productSalesMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!orders || orders.length === 0) return map;
    for (const order of orders) {
      if (order.status === 'undelivered') continue;
      for (const item of order.items || []) {
        const q = Number(item.quantity) || 0;
        map[item.product_id] = (map[item.product_id] || 0) + q;
      }
    }
    return map;
  }, [orders]);

  // Available brands in currently selected category (only active products)
  const availableBrandsInCategory = useMemo(() => {
    const brandsSet = new Set<string>();
    products.forEach((p) => {
      if (!p.is_active) return;
      if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) return;
      if (p.brand && p.brand.trim()) {
        brandsSet.add(p.brand.trim());
      }
    });
    return Array.from(brandsSet).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [products, selectedCategoryId]);

  // Count active products for each brand
  const brandProductCountMap = useMemo(() => {
    const countMap: Record<string, number> = {};
    products.forEach((p) => {
      if (!p.is_active) return;
      if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) return;
      if (inStockOnly && p.is_market_test) return;
      const b = (p.brand || '').trim();
      if (b) {
        countMap[b] = (countMap[b] || 0) + 1;
      }
    });
    return countMap;
  }, [products, selectedCategoryId, inStockOnly]);

  // Remove any selected brands that are no longer available in the active category
  useEffect(() => {
    if (selectedBrands.length > 0) {
      const validBrands = selectedBrands.filter((b) => availableBrandsInCategory.includes(b));
      if (validBrands.length !== selectedBrands.length) {
        setSelectedBrands(validBrands);
      }
    }
  }, [availableBrandsInCategory, selectedBrands]);

  // Filter products using multi-brand and keyword search
  const filteredProducts = useMemo(() => {
    const matched = filterCatalogProducts(products, {
      categoryId: selectedCategoryId,
      selectedBrands,
      searchTerm,
      inStockOnly,
    });

    // Apply sorting logic (Popular / Name / Price / Name + Price)
    return sortCatalogProducts(matched, {
      popular: isPopularActive,
      byName: sortByName,
      byPrice: sortByPrice,
      productSalesMap,
    });
  }, [
    products,
    selectedCategoryId,
    selectedBrands,
    searchTerm,
    inStockOnly,
    isPopularActive,
    sortByName,
    sortByPrice,
    productSalesMap,
  ]);

  // Toggle handlers for the 3 display/sort filters
  const handleTogglePopular = useCallback(() => {
    setIsPopularActive(true);
    setSortByName(false);
    setSortByPrice(false);
  }, []);

  const handleToggleByName = useCallback(() => {
    if (sortByName) {
      setSortByName(false);
      // If price is not active either, fallback to default popular
      if (!sortByPrice) {
        setIsPopularActive(true);
      }
    } else {
      setSortByName(true);
      setIsPopularActive(false);
      // sortByPrice remains active if already toggled! Both can be active at the same time
    }
  }, [sortByName, sortByPrice]);

  const handleToggleByPrice = useCallback(() => {
    if (sortByPrice) {
      setSortByPrice(false);
      // If name is not active either, fallback to default popular
      if (!sortByName) {
        setIsPopularActive(true);
      }
    } else {
      setSortByPrice(true);
      setIsPopularActive(false);
      // sortByName remains active if already toggled! Both can be active at the same time
    }
  }, [sortByPrice, sortByName]);

  // Remove a single brand tag
  const handleRemoveBrand = useCallback((brandToRemove: string) => {
    setSelectedBrands((prev) => prev.filter((b) => b !== brandToRemove));
  }, []);

  // Clear all filters
  const handleClearAllFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedCategoryId('all');
    setSelectedBrands([]);
    setInStockOnly(defaultInStockOnly);
    setIsPopularActive(true);
    setSortByName(false);
    setSortByPrice(false);
  }, [defaultInStockOnly]);

  const isBothNameAndPrice = sortByName && sortByPrice;

  const isAnyFilterActive =
    searchTerm.trim() !== '' ||
    selectedCategoryId !== 'all' ||
    selectedBrands.length > 0 ||
    inStockOnly !== defaultInStockOnly ||
    !isPopularActive ||
    sortByName ||
    sortByPrice;

  return (
    <div className="space-y-3.5">
      {/* 1. Search, Multi-Brand Dropdown, Categories & Sort Bar */}
      <div className="space-y-2.5 bg-slate-900/60 p-2.5 sm:p-3.5 rounded-2xl border border-slate-800/80 shadow-sm">
        {/* Row 1: Search input + Brand Multi-Select Dropdown Menu */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی نام یا برند کالا..."
              className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-8 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Replaced old single filter button with Multi-Select Brand Dropdown Menu */}
          <BrandDropdown
            availableBrands={availableBrandsInCategory}
            selectedBrands={selectedBrands}
            onChangeSelectedBrands={setSelectedBrands}
            brandProductCountMap={brandProductCountMap}
          />
        </div>

        {/* Row 2: Category chips + In-Stock toggle chip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {/* All chip */}
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`h-8 px-3 rounded-xl whitespace-nowrap font-semibold transition cursor-pointer shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            همه
          </button>

          {/* "موجود" Toggle Chip */}
          <button
            type="button"
            onClick={() => setInStockOnly((prev) => !prev)}
            className={`h-8 px-3 rounded-xl whitespace-nowrap font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              inStockOnly
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
            title={inStockOnly ? 'نمایش همه کالاها (شامل به زودی)' : 'مخفی‌سازی کالاهای تست بازار (به زودی)'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${inStockOnly ? 'bg-white' : 'bg-emerald-400'}`} />
            <span>موجود</span>
          </button>

          {/* Category chips */}
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategoryId(c.id)}
              className={`h-8 px-3 rounded-xl whitespace-nowrap font-semibold transition cursor-pointer shrink-0 ${
                selectedCategoryId === c.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Row 3: 3 New Display & Sort Filters */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span>نمایش بر اساس:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Filter 1: محبوب‌ترین‌ها (پرفروش‌ترین) - پیش‌فرض همیشه فعال */}
            <button
              type="button"
              onClick={handleTogglePopular}
              className={`h-8 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                isPopularActive
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
              title="کالاهایی که بیشترین فروش را دارند در ابتدای لیست نمایش داده می‌شوند (فیلتر پیش‌فرض)"
            >
              <Flame className={`w-3.5 h-3.5 ${isPopularActive ? 'text-amber-300 fill-amber-300' : 'text-slate-400'}`} />
              <span>محبوب‌ترین‌ها</span>
              {isPopularActive && <Check className="w-3 h-3 stroke-[3]" />}
            </button>

            {/* Filter 2: بر اساس نام (حروف الفبا) */}
            <button
              type="button"
              onClick={handleToggleByName}
              className={`h-8 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                sortByName
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
              title="مرتب‌سازی بر اساس حروف الفبای نام کالا"
            >
              <ArrowDownAZ className={`w-3.5 h-3.5 ${sortByName ? 'text-emerald-100' : 'text-slate-400'}`} />
              <span>بر اساس نام (الفبا)</span>
              {sortByName && <Check className="w-3 h-3 stroke-[3]" />}
            </button>

            {/* Filter 3: بر اساس قیمت (کمترین به بیشترین) */}
            <button
              type="button"
              onClick={handleToggleByPrice}
              className={`h-8 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                sortByPrice
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
              title="مرتب‌سازی بر اساس قیمت: کمترین قیمت در بالا و بیشترین قیمت در پایین"
            >
              <ArrowDownNarrowWide className={`w-3.5 h-3.5 ${sortByPrice ? 'text-emerald-100' : 'text-slate-400'}`} />
              <span>بر اساس قیمت</span>
              {sortByPrice && <Check className="w-3 h-3 stroke-[3]" />}
            </button>
          </div>
        </div>

        {/* Helpful Banner when both Name and Price are selected */}
        {isBothNameAndPrice && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 px-3 flex items-center gap-2 text-[11px] text-emerald-300">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              فیلتر ترکیبی <strong>نام + قیمت</strong> فعال است: اقلام هم‌نوع (مانند انواع پنیر پیتزا) در کنار یکدیگر و به ترتیب از کمترین قیمت به بیشترین قیمت مرتب شده‌اند.
            </span>
          </div>
        )}

        {/* Clear filters and active tags summary */}
        {isAnyFilterActive && (
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Selected brands tags with quick removal */}
              {selectedBrands.map((b) => (
                <span
                  key={b}
                  className="bg-slate-800/90 text-emerald-400 border border-slate-700/60 px-2 py-0.5 rounded-lg flex items-center gap-1 text-[11px]"
                >
                  <span>برند: {b}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBrand(b)}
                    className="hover:text-rose-400 transition cursor-pointer p-0.5"
                    title={`حذف فیلتر برند ${b}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {inStockOnly !== defaultInStockOnly && (
                <span className="bg-slate-800/90 text-emerald-400 border border-slate-700/60 px-2 py-0.5 rounded-lg text-[11px]">
                  {inStockOnly ? 'فقط کالاهای موجود' : 'شامل کالاهای تست بازار'}
                </span>
              )}

              {/* Active sort badges */}
              {isPopularActive && (
                <span className="bg-slate-800/90 text-amber-300 border border-slate-700/60 px-2 py-0.5 rounded-lg text-[11px] flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>محبوب‌ترین‌ها</span>
                </span>
              )}

              {isBothNameAndPrice ? (
                <span className="bg-slate-800/90 text-emerald-400 border border-slate-700/60 px-2 py-0.5 rounded-lg text-[11px]">
                  الفبایی + از ارزان‌ترین به گران‌ترین
                </span>
              ) : (
                <>
                  {sortByName && (
                    <span className="bg-slate-800/90 text-emerald-400 border border-slate-700/60 px-2 py-0.5 rounded-lg text-[11px]">
                      الفبای نام کالا
                    </span>
                  )}
                  {sortByPrice && (
                    <span className="bg-slate-800/90 text-emerald-400 border border-slate-700/60 px-2 py-0.5 rounded-lg text-[11px]">
                      کمترین به بیشترین قیمت
                    </span>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer font-medium mr-auto"
            >
              حذف همه فیلترها
            </button>
          </div>
        )}
      </div>

      {/* Optional Top Products Card (ReorderCard in SupermarketPortal) */}
      {topProductsCard}

      {/* 2. Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center text-slate-400 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6">
          <Package className="w-12 h-12 mx-auto text-slate-600" />
          <p className="text-xs font-bold text-slate-300">کالایی با فیلترهای انتخابی یافت نشد.</p>
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              حذف فیلترها و نمایش همه
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
          {filteredProducts.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              quantity={cart[product.id] || 0}
              onChangeQuantity={(qty) => onChangeQuantity(product.id, qty)}
              onExceedLimit={onExceedLimit}
              priceMode={priceMode}
            />
          ))}
        </div>
      )}
    </div>
  );
};
