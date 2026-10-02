import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { ProductRow } from './ProductRow';
import { FilterSheet } from './FilterSheet';
import { filterCatalogProducts } from './shopUtils';
import { Search, X, SlidersHorizontal, Package, Check } from 'lucide-react';

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
  const { categories } = useApp();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(defaultInStockOnly);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

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
    return Array.from(brandsSet);
  }, [products, selectedCategoryId]);

  // Reset selected brand if no longer present in chosen category
  useEffect(() => {
    if (selectedBrand !== 'all' && !availableBrandsInCategory.includes(selectedBrand)) {
      setSelectedBrand('all');
    }
  }, [selectedCategoryId, availableBrandsInCategory, selectedBrand]);

  // Filtered Products using common filterCatalogProducts helper
  const filteredProducts = useMemo(() => {
    return filterCatalogProducts(products, {
      categoryId: selectedCategoryId,
      brand: selectedBrand,
      searchTerm,
      inStockOnly,
    });
  }, [products, selectedCategoryId, selectedBrand, searchTerm, inStockOnly]);

  // Clear all filters
  const handleClearAllFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedCategoryId('all');
    setSelectedBrand('all');
    setInStockOnly(defaultInStockOnly);
  }, [defaultInStockOnly]);

  const isAnyFilterActive =
    searchTerm.trim() !== '' ||
    selectedCategoryId !== 'all' ||
    selectedBrand !== 'all' ||
    inStockOnly !== defaultInStockOnly;

  return (
    <div className="space-y-3.5">
      {/* 1. Search & Filter Bar */}
      <div className="space-y-2 bg-slate-900/60 p-2.5 sm:p-3 rounded-2xl border border-slate-800/80">
        {/* Row 1: Search input + Brand filter button */}
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

          {/* Filter Sheet Trigger Button */}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(true)}
            className={`h-10 px-3 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
              selectedBrand !== 'all'
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
            title="فیلتر بر اساس برند"
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>فیلتر</span>
            {selectedBrand !== 'all' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>
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

        {/* Clear filters link if active */}
        {isAnyFilterActive && (
          <div className="pt-1 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedBrand !== 'all' && (
                <span className="bg-slate-800 px-2 py-0.5 rounded-lg text-emerald-400">
                  برند: {selectedBrand}
                </span>
              )}
              {inStockOnly !== defaultInStockOnly && (
                <span className="bg-slate-800 px-2 py-0.5 rounded-lg text-emerald-400">
                  {inStockOnly ? 'فقط کالاهای موجود' : 'شامل کالاهای تست بازار'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs text-rose-400 hover:underline cursor-pointer"
            >
              حذف فیلترها
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
              حذف فیلترها
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

      {/* Brand Filter Sheet */}
      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        availableBrands={availableBrandsInCategory}
        selectedBrand={selectedBrand}
        onSelectBrand={(b) => setSelectedBrand(b)}
        onClearFilter={() => setSelectedBrand('all')}
      />
    </div>
  );
};
