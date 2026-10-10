import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { ProductRow } from './ProductRow';
import { BrandDropdown } from './BrandDropdown';
import { filterCatalogProducts, sortCatalogProducts, sortBrandColonyProducts } from './shopUtils';
import {
  getStorePickupDiscountEnabled,
  setStorePickupDiscountEnabled,
  getStoreRegistrationRank,
  getStoreFounderDiscountStatus,
} from '../../utils/storeDiscount';
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
  Lock,
  Percent,
  Sparkles,
  Users,
} from 'lucide-react';

const StoreDiscountSwitchesBox: React.FC = () => {
  const { invoiceSettings, currentUser, selectedSupermarketId, supermarkets, orders } = useApp();
  const currentShop = supermarkets.find(
    (s) =>
      s.id === selectedSupermarketId ||
      (currentUser?.id && s.id === currentUser.id) ||
      (currentUser?.username && s.username && s.username.toLowerCase() === currentUser.username.toLowerCase()) ||
      (currentUser?.phone && s.phone === currentUser.phone)
  );
  const storeId = currentShop?.id || currentUser?.id || 'store_default';

  // Warehouse pickup discount enabled status (admin global control)
  const isPickupGloballyEnabled = invoiceSettings?.pickup_discount_enabled !== false;
  const pickupPercent = invoiceSettings?.pickup_discount_percent || 3;

  const [pickupEnabled, setPickupEnabled] = useState<boolean>(() => {
    return isPickupGloballyEnabled && getStorePickupDiscountEnabled(storeId);
  });

  useEffect(() => {
    if (!isPickupGloballyEnabled) {
      setPickupEnabled(false);
      return;
    }
    setPickupEnabled(getStorePickupDiscountEnabled(storeId));
  }, [storeId, isPickupGloballyEnabled]);

  const handleTogglePickup = () => {
    if (!isPickupGloballyEnabled) return;
    const nextVal = !pickupEnabled;
    setPickupEnabled(nextVal);
    setStorePickupDiscountEnabled(storeId, nextVal);
    // Dispatch custom event so ProductRow & CartSheet re-evaluate instantly
    window.dispatchEvent(new Event('store-discount-changed'));
  };

  // 5% Founder Discount for the first 100 people (strictly active for first 3 orders)
  const founderStatus = useMemo(() => {
    return getStoreFounderDiscountStatus(supermarkets, orders, storeId);
  }, [supermarkets, orders, storeId]);

  const [showFounderInfo, setShowFounderInfo] = useState(false);

  // If pickup discount is globally disabled and founder discount is exhausted/inactive, hide the whole component
  if (!isPickupGloballyEnabled && !founderStatus.isFounderActive) {
    return null;
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-2 shadow-sm text-[0.9em]">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-200 flex-wrap gap-1">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <Percent className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>تخفیف‌های ویژه تحویل و عضویت فروشگاه:</span>
        </span>
      </div>

      {/* Grid of active discount options */}
      <div className={`grid grid-cols-1 ${isPickupGloballyEnabled && founderStatus.isFounderActive ? 'md:grid-cols-2' : ''} gap-2 text-[11px]`}>
        {/* Switch A: Pickup Discount (Shown only when admin enabled) */}
        {isPickupGloballyEnabled && (
          <div
            onClick={handleTogglePickup}
            className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition select-none ${
              pickupEnabled
                ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-100 hover:border-emerald-400 shadow-sm'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-200 hover:border-rose-400 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${
                  pickupEnabled ? 'bg-emerald-500' : 'bg-rose-600'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                    pickupEnabled ? 'translate-x-[-14px]' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="font-bold text-[11px]">
                {pickupPercent}٪ تخفیف تحویل سفارش درب انبار
              </span>
            </div>
            <span
              className={`text-[9.5px] px-2 py-0.5 rounded-md font-bold border ${
                pickupEnabled
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50'
                  : 'bg-rose-500/20 text-rose-200 border-rose-500/50'
              }`}
            >
              {pickupEnabled ? 'روشن (فعال)' : 'خاموش (غیرفعال)'}
            </span>
          </div>
        )}

        {/* Unified Card: 5% Founder Discount for First 100 people */}
        {founderStatus.isFounderActive && (
          <div
            onClick={() => setShowFounderInfo((prev) => !prev)}
            className="p-2 rounded-lg border flex items-center justify-between cursor-pointer transition select-none bg-gradient-to-r from-purple-950/70 via-slate-900 to-amber-950/60 border-purple-500/50 text-purple-100 hover:border-purple-400 shadow-sm"
            title="جهت مشاهده جزئیات تخفیف کلیک کنید"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold text-[11px] text-white truncate">
                کد تخفیف ۵٪ ویژه ۱۰۰ فروشگاه اول
              </span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-md font-bold border bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shrink-0">
              فعال ({founderStatus.remainingOrdersCount.toLocaleString('fa-IR')} سفارش مانده)
            </span>
          </div>
        )}
      </div>

      {/* Info notice when clicking Founder switch */}
      {showFounderInfo && founderStatus.isFounderActive && (
        <div className="p-2.5 rounded-lg bg-purple-950/90 border border-purple-500/40 text-purple-200 text-[11px] flex items-center justify-between gap-2 animate-in fade-in shadow-sm">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="font-bold text-white text-[11px]">
                طرح تخفیف ویژه ۵ درصدی ۱۰۰ فروشگاه اول:
              </p>
              <p className="text-[10.5px] text-purple-100 font-medium tracking-tight whitespace-normal leading-normal">
                تبریک! شما به عنوان ۱۰۰ فروشگاه اول در سامانه ثبت‌نام شده‌اید. تخفیف ۵ درصدی برای ۳ سفارش اول شما فعال است (تاکنون {founderStatus.usedOrdersCount.toLocaleString('fa-IR')} بار استفاده شده و برای {founderStatus.remainingOrdersCount.toLocaleString('fa-IR')} سفارش دیگر فعال خواهد بود).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFounderInfo(false)}
            className="text-purple-400 hover:text-white p-1 cursor-pointer shrink-0"
            title="بستن"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

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
  const { categories, orders, brands, productOrderMap } = useApp();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState<boolean>(defaultInStockOnly);

  // 3 Display & Sort filters (mutually exclusive; default is null for brand colonies view)
  const [activeSort, setActiveSort] = useState<'popular' | 'name' | 'price' | null>(null);

  const isPopularActive = activeSort === 'popular';
  const sortByName = activeSort === 'name';
  const sortByPrice = activeSort === 'price';

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

  // Check if a brand has at least one active & available product in the system
  const isBrandAvailable = useCallback(
    (brandName: string) => {
      const bClean = (brandName || 'متفرقه').trim().toLowerCase();
      const allBrandItems = products.filter(
        (p) => (p.brand || 'متفرقه').trim().toLowerCase() === bClean
      );
      return allBrandItems.some((p) => {
        if (p.is_active === false) return false;
        const avail = Math.max(0, (p.stock || 0) - (p.reserved_stock || 0));
        return avail > 0 || (Boolean(p.is_market_test) && !inStockOnly);
      });
    },
    [products, inStockOnly]
  );

  // Available brands in currently selected category (only active & in-stock products)
  const availableBrandsInCategory = useMemo(() => {
    const brandsSet = new Set<string>();
    products.forEach((p) => {
      if (!p.is_active) return;
      const avail = Math.max(0, (p.stock || 0) - (p.reserved_stock || 0));
      const hasStock = avail > 0 || (Boolean(p.is_market_test) && !inStockOnly);
      if (!hasStock) return;
      if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) return;
      if (p.brand && p.brand.trim()) {
        brandsSet.add(p.brand.trim());
      }
    });
    return Array.from(brandsSet).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [products, selectedCategoryId, inStockOnly]);

  // Count active and in-stock products for each brand
  const brandProductCountMap = useMemo(() => {
    const countMap: Record<string, number> = {};
    products.forEach((p) => {
      if (!p.is_active) return;
      const avail = Math.max(0, (p.stock || 0) - (p.reserved_stock || 0));
      const hasStock = avail > 0 || (Boolean(p.is_market_test) && !inStockOnly);
      if (!hasStock) return;
      if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) return;
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

    // Omit any brand whose products are ALL out of stock or inactive from the catalog
    const availableBrandProducts = matched.filter((p) => isBrandAvailable(p.brand || 'متفرقه'));

    // Apply mutually exclusive sorting logic (Popular / Name / Price)
    return sortCatalogProducts(availableBrandProducts, {
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
    isBrandAvailable,
  ]);

  // Mutually exclusive toggle handlers for sort filters (clicking active sort toggles it off back to brand colonies)
  const handleTogglePopular = useCallback(() => {
    setActiveSort((prev) => (prev === 'popular' ? null : 'popular'));
  }, []);

  const handleToggleByName = useCallback(() => {
    setActiveSort((prev) => (prev === 'name' ? null : 'name'));
  }, []);

  const handleToggleByPrice = useCallback(() => {
    setActiveSort((prev) => (prev === 'price' ? null : 'price'));
  }, []);

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
    setActiveSort(null);
  }, [defaultInStockOnly]);

  const isAnyFilterActive =
    searchTerm.trim() !== '' ||
    selectedCategoryId !== 'all' ||
    selectedBrands.length > 0 ||
    inStockOnly !== defaultInStockOnly ||
    activeSort !== null;

  // Compute Brand Colonies for default view (when activeSort === null)
  // Rule: Follow Admin priority order. If all products of a brand are out-of-stock or inactive, omit from catalog!
  const brandColonies = useMemo(() => {
    if (activeSort !== null) return [];

    const orderedBrandNames: string[] = [];
    const seen = new Set<string>();

    (brands || []).forEach((b) => {
      const clean = (b || '').trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        orderedBrandNames.push(clean);
      }
    });

    products.forEach((p) => {
      const clean = (p.brand || 'متفرقه').trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        orderedBrandNames.push(clean);
      }
    });

    const colonies: Array<{ brandName: string; products: Product[] }> = [];

    for (const bName of orderedBrandNames) {
      // 1. Rule: If all products of this brand are out-of-stock or inactive, omit brand colony entirely!
      if (!isBrandAvailable(bName)) {
        continue;
      }

      // 2. Gather products for this brand matching current user filters
      const matchingItems = filteredProducts.filter(
        (p) => (p.brand || 'متفرقه').trim().toLowerCase() === bName.toLowerCase()
      );

      if (matchingItems.length > 0) {
        // Sort products within brand: In-stock first, test middle, out-of-stock last + Admin custom order
        const customBrandOrder = productOrderMap?.[bName] || productOrderMap?.[bName.trim()] || [];
        const sortedItems = sortBrandColonyProducts(matchingItems, customBrandOrder);

        colonies.push({
          brandName: bName,
          products: sortedItems,
        });
      }
    }

    return colonies;
  }, [activeSort, brands, products, filteredProducts, isBrandAvailable, productOrderMap]);

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

              {activeSort !== null && (
                <span className="bg-slate-800/90 text-emerald-300 border border-slate-700/60 px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1">
                  <span>
                    {activeSort === 'popular'
                      ? 'مرتب‌سازی: محبوب‌ترین‌ها'
                      : activeSort === 'name'
                      ? 'مرتب‌سازی: الفبای نام کالا'
                      : 'مرتب‌سازی: کمترین به بیشترین قیمت'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSort(null)}
                    className="hover:text-rose-400 p-0.5 cursor-pointer"
                    title="حذف مرتب‌سازی و بازگشت به نمایش کلونی برندها"
                  >
                    <X className="w-3 h-3" />
                  </button>
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

      {/* Store Discount Options Box (Top of Catalog) */}
      <StoreDiscountSwitchesBox />

      {/* 2. Products Grid / Brand Colonies */}
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
      ) : activeSort !== null ? (
        /* Flat sorted grid when an explicit sort filter (alphabet, price, popular) is toggled */
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-1 border-b border-slate-800">
            <span>
              نمایش مرتب‌شده بر اساس{' '}
              <strong className="text-emerald-400">
                {activeSort === 'popular' ? 'محبوب‌ترین‌ها' : activeSort === 'name' ? 'الفبا' : 'ارزان‌ترین قیمت'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setActiveSort(null)}
              className="text-[11px] text-blue-400 hover:underline cursor-pointer"
            >
              بازگشت به نمایش دسته‌ای برندها
            </button>
          </div>
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
        </div>
      ) : brandColonies.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2.5 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5">
          <Package className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-xs font-bold text-slate-300">تمام کالاهای برندهای این بخش در حال حاضر ناموجود هستند.</p>
        </div>
      ) : (
        /* Sequential Brand Colonies (Default View) */
        <div className="space-y-5">
          {brandColonies.map((colony) => (
            <div
              key={colony.brandName}
              className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3 shadow-xs"
            >
              {/* Colony Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <span className="text-slate-400 font-normal text-xs">برند:</span>
                    <span>{colony.brandName}</span>
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full num-fa">
                    {colony.products.length.toLocaleString('fa-IR')} کالا
                  </span>
                </div>
              </div>

              {/* Products in this Colony */}
              <div className="grid grid-cols-1 min-[420px]:grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-2">
                {colony.products.map((product) => (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
