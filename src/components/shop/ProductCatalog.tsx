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
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  cart,
  onChangeQuantity,
  onExceedLimit,
  priceMode = 'store',
  defaultInStockOnly = false,
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
    <div className="space-y-2.5">
      {/* 1. Search, Multi-Brand Dropdown, Categories & Sort Bar */}
      <div className="space-y-2 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 shadow-xs">
        {/* Row 1: Search input (flex-1, h-9) + Brand Multi-Select Dropdown Menu + Sort Segmented Control */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1 min-w-[170px]">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی کالا یا برند..."
              className="w-full h-9 bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-7 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2 top-2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Multi-Select Brand Dropdown Menu */}
          <BrandDropdown
            availableBrands={availableBrandsInCategory}
            selectedBrands={selectedBrands}
            onChangeSelectedBrands={setSelectedBrands}
            brandProductCountMap={brandProductCountMap}
          />

          {/* Segmented Sort Control */}
          <div className="inline-flex items-center rounded-xl bg-slate-950 border border-slate-800 p-0.5 shrink-0 h-9">
            <button
              type="button"
              onClick={handleTogglePopular}
              className={`h-full px-2 sm:px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                isPopularActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="محبوب‌ترین‌ها (پرفروش‌ترین کالاها)"
            >
              <Flame className={`w-3.5 h-3.5 ${isPopularActive ? 'text-amber-300 fill-amber-300' : 'text-slate-400'}`} />
              <span className="hidden md:inline">محبوب‌ترین‌ها</span>
            </button>

            <button
              type="button"
              onClick={handleToggleByName}
              className={`h-full px-2 sm:px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                sortByName
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="مرتب‌سازی بر اساس نام (الفبا)"
            >
              <ArrowDownAZ className={`w-3.5 h-3.5 ${sortByName ? 'text-white' : 'text-slate-400'}`} />
              <span className="hidden md:inline">الفبا</span>
              {sortByName && <Check className="w-2.5 h-2.5 stroke-[3] hidden sm:inline" />}
            </button>

            <button
              type="button"
              onClick={handleToggleByPrice}
              className={`h-full px-2 sm:px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                sortByPrice
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="مرتب‌سازی بر اساس قیمت (ارزان‌ترین)"
            >
              <ArrowDownNarrowWide className={`w-3.5 h-3.5 ${sortByPrice ? 'text-white' : 'text-slate-400'}`} />
              <span className="hidden md:inline">قیمت</span>
              {sortByPrice && <Check className="w-2.5 h-2.5 stroke-[3] hidden sm:inline" />}
            </button>
          </div>
        </div>

        {/* Row 2: Category chips + In-Stock toggle chip in horizontal scrollable row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
          {/* All chip */}
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg whitespace-nowrap font-bold text-xs transition cursor-pointer shrink-0 ${
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
            className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg whitespace-nowrap font-bold text-xs transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
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
              className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg whitespace-nowrap font-bold text-xs transition cursor-pointer shrink-0 ${
                selectedCategoryId === c.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Helpful Banner when both Name and Price are selected */}
        {isBothNameAndPrice && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 px-2.5 flex items-center gap-2 text-[11px] text-emerald-300">
            <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              فیلتر ترکیبی <strong>نام + قیمت</strong> فعال است: اقلام هم‌نوع در کنار هم و از کمترین به بیشترین قیمت مرتب شده‌اند.
            </span>
          </div>
        )}

        {/* Clear filters and active tags summary (Only visible when a non-default filter is active) */}
        {isAnyFilterActive && (
          <div className="pt-1.5 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 flex-wrap gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium num-fa">
                {filteredProducts.length.toLocaleString('fa-IR')} کالا
              </span>
              {/* Selected brands tags with quick removal */}
              {selectedBrands.map((b) => (
                <span
                  key={b}
                  className="bg-slate-800/90 text-emerald-300 border border-slate-700/60 px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px]"
                >
                  <span>{b}</span>
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
                <span className="bg-slate-800/90 text-emerald-300 border border-slate-700/60 px-2 py-0.5 rounded-md text-[11px]">
                  {inStockOnly ? 'فقط کالاهای موجود' : 'شامل کالاهای تست بازار'}
                </span>
              )}

              {!isPopularActive && (
                <span className="bg-slate-800/90 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded-md text-[11px]">
                  {isBothNameAndPrice ? 'الفبایی + ارزان‌ترین' : sortByName ? 'الفبای نام کالا' : 'کمترین به بیشترین قیمت'}
                </span>
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

      {/* 2. Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2.5 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5">
          <Package className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-xs font-bold text-slate-300">کالایی با فیلترهای انتخابی یافت نشد.</p>
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              حذف فیلترها و نمایش همه
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-2">
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
