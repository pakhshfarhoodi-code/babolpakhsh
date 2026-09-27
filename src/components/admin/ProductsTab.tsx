import React, { useState, useMemo } from 'react';
import { Product, Category, ProductPriceHistory } from '../../types';
import {
  Search,
  Plus,
  Edit2,
  Edit3,
  Check,
  X,
  History,
  Trash2,
  Boxes,
  Tag,
  Layers,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  FileSpreadsheet,
  Upload,
  Download,
  Percent,
  Scale,
  CheckSquare,
  Square,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { LOW_STOCK_THRESHOLD, formatPrice } from './helpers';
import { PriceHistoryDrawer } from './PriceHistoryDrawer';
import { CategorySelectPicker, BrandSelectPicker } from '../CategoryBrandSelectors';
import { ExcelImportModal } from './ExcelImportModal';
import { ExcelExportModal } from './ExcelExportModal';

const STANDARD_UNITS = ['عدد', 'باکس', 'کارتن', 'کیلوگرم', 'بسته', 'بطری', 'دبه', 'کیسه', 'شانه', 'قوطی'];

interface ProductsTabProps {
  products: Product[];
  categories: Category[];
  brands: string[];
  priceHistories: ProductPriceHistory[];
  initialFilterType?: 'lowStock' | 'all';
  onUpdateProductPrice: (productId: string, newPrice: number, newVisitorPrice?: number) => void;
  onAddNewProduct: (newProd: Omit<Product, 'id'>) => void;
  onBulkUpsertProducts?: (items: any[]) => Promise<{ success: boolean; createdCount: number; updatedCount: number; message: string }> | { success: boolean; createdCount: number; updatedCount: number; message: string };
  onDeleteProduct: (productId: string) => { success: boolean; message: string };
  onBulkDeleteProducts?: (productIds: string[]) => Promise<{ success: boolean; message: string; count: number }>;
  onBulkUpdateProducts?: (
    productIds: string[],
    updates: {
      category_id?: string;
      brand?: string;
      unit?: string;
      priceAdjustmentPercent?: number;
      fixedPrice?: number;
      is_active?: boolean;
    }
  ) => Promise<{ success: boolean; message: string; count: number }>;
  onOpenEditCategory: (cat: { id: string; name: string }) => void;
  onOpenEditBrand: (brand: string) => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  categories,
  brands,
  priceHistories,
  initialFilterType = 'all',
  onUpdateProductPrice,
  onAddNewProduct,
  onBulkUpsertProducts,
  onDeleteProduct,
  onBulkDeleteProducts,
  onBulkUpdateProducts,
  onOpenEditCategory,
  onOpenEditBrand,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [onlyLowStock, setOnlyLowStock] = useState(initialFilterType === 'lowStock');
  const [onlyInactive, setOnlyInactive] = useState(false);

  // Quick Inline Price Editing (both store price and visitor price)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempStorePrice, setTempStorePrice] = useState<number>(0);
  const [tempVisitorPrice, setTempVisitorPrice] = useState<number>(0);

  // Modals for Excel Import / Export
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isExcelExportOpen, setIsExcelExportOpen] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState<string | null>(null);

  // Price History Drawer state
  const [historyDrawerProduct, setHistoryDrawerProduct] = useState<Product | null>(null);

  // Add Product Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('میهن');
  const [newProdCat, setNewProdCat] = useState('cat-1');
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [newProdVisitorPrice, setNewProdVisitorPrice] = useState(0);
  const [newProdStock, setNewProdStock] = useState(0);
  const [newProdUnit, setNewProdUnit] = useState('عدد');

  // Delete product confirmation
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  // Bulk selection and actions state
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bulk Edit Form state
  const [bulkCatId, setBulkCatId] = useState<string>('');
  const [bulkBrandName, setBulkBrandName] = useState<string>('');
  const [bulkUnitName, setBulkUnitName] = useState<string>('');
  const [bulkPriceChangeType, setBulkPriceChangeType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [bulkPriceValue, setBulkPriceValue] = useState<number>(0);
  const [bulkActiveStatus, setBulkActiveStatus] = useState<'keep' | 'active' | 'inactive'>('keep');

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleExecuteBulkDelete = async () => {
    if (!onBulkDeleteProducts || selectedProductIds.length === 0) return;
    setIsBulkProcessing(true);
    setBulkFeedback(null);
    try {
      const res = await onBulkDeleteProducts(selectedProductIds);
      if (res.success) {
        setSelectedProductIds([]);
        setIsBulkDeleteOpen(false);
        setExcelFeedback(res.message);
        setTimeout(() => setExcelFeedback(null), 5000);
      } else {
        setBulkFeedback({ type: 'error', message: res.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در حذف گروهی کالاها';
      setBulkFeedback({ type: 'error', message: msg });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleExecuteBulkEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onBulkUpdateProducts || selectedProductIds.length === 0) return;
    setIsBulkProcessing(true);
    setBulkFeedback(null);

    const updates: {
      category_id?: string;
      brand?: string;
      unit?: string;
      priceAdjustmentPercent?: number;
      fixedPrice?: number;
      is_active?: boolean;
    } = {};

    if (bulkCatId) updates.category_id = bulkCatId;
    if (bulkBrandName.trim()) updates.brand = bulkBrandName.trim();
    if (bulkUnitName) updates.unit = bulkUnitName;
    if (bulkPriceChangeType === 'percent' && bulkPriceValue !== 0) {
      updates.priceAdjustmentPercent = bulkPriceValue;
    } else if (bulkPriceChangeType === 'fixed' && bulkPriceValue > 0) {
      updates.fixedPrice = bulkPriceValue;
    }
    if (bulkActiveStatus === 'active') updates.is_active = true;
    if (bulkActiveStatus === 'inactive') updates.is_active = false;

    try {
      const res = await onBulkUpdateProducts(selectedProductIds, updates);
      if (res.success) {
        setIsBulkEditOpen(false);
        setSelectedProductIds([]);
        setExcelFeedback(res.message);
        setTimeout(() => setExcelFeedback(null), 5000);
      } else {
        setBulkFeedback({ type: 'error', message: res.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ویرایش گروهی کالاها';
      setBulkFeedback({ type: 'error', message: msg });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const freeStock = product.stock - product.reserved_stock;

      // Low stock filter
      if (onlyLowStock && freeStock >= LOW_STOCK_THRESHOLD) {
        return false;
      }

      // Inactive filter
      if (onlyInactive && product.is_active) {
        return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'all' && product.category_id !== selectedCategoryFilter) {
        return false;
      }

      // Brand filter
      if (selectedBrandFilter !== 'all' && (product.brand || 'متفرقه') !== selectedBrandFilter) {
        return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = product.name.toLowerCase().includes(term);
        const matchBrand = (product.brand || '').toLowerCase().includes(term);
        if (!matchName && !matchBrand) return false;
      }

      return true;
    });
  }, [products, onlyLowStock, onlyInactive, selectedCategoryFilter, selectedBrandFilter, searchTerm]);

  const handleSavePrice = (productId: string) => {
    if (tempStorePrice > 0) {
      onUpdateProductPrice(productId, tempStorePrice, tempVisitorPrice > 0 ? tempVisitorPrice : undefined);
    }
    setEditingPriceId(null);
  };

  const handleBulkImportConfirm = async (items: any[]) => {
    if (onBulkUpsertProducts) {
      const result = await onBulkUpsertProducts(items);
      setExcelFeedback(result.message);
      setTimeout(() => setExcelFeedback(null), 6000);
      return result;
    }
  };

  const getSampleImage = (catId: string) => {
    switch (catId) {
      case 'cat-1':
        return 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
      case 'cat-2':
        return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
      case 'cat-3':
        return 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
      case 'cat-4':
        return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
      case 'cat-5':
      default:
        return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
    }
  };

  const handleCreateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || newProdPrice <= 0) return;

    const visitorPrice = newProdVisitorPrice > 0 ? newProdVisitorPrice : Math.round(newProdPrice * 0.85);

    onAddNewProduct({
      name: newProdName.trim(),
      brand: newProdBrand.trim() || 'متفرقه',
      category_id: newProdCat,
      price: newProdPrice,
      visitor_price: visitorPrice,
      stock: newProdStock,
      reserved_stock: 0,
      unit: newProdUnit,
      image_url: getSampleImage(newProdCat),
      is_active: true,
    });

    setIsAddModalOpen(false);
    setNewProdName('');
    setNewProdBrand('میهن');
    setNewProdPrice(0);
    setNewProdVisitorPrice(0);
    setNewProdStock(0);
  };

  const handleDeleteConfirm = () => {
    if (!productToDelete) return;
    const res = onDeleteProduct(productToDelete.id);
    if (res.success) {
      setProductToDelete(null);
      setDeleteFeedback(null);
    } else {
      setDeleteFeedback(res.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick status toggle chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyLowStock((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                onlyLowStock
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>فقط کم‌موجودها</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyInactive((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                onlyInactive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>فقط غیرفعال‌ها</span>
            </button>

            {(onlyLowStock || onlyInactive || selectedCategoryFilter !== 'all' || selectedBrandFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setOnlyLowStock(false);
                  setOnlyInactive(false);
                  setSelectedCategoryFilter('all');
                  setSelectedBrandFilter('all');
                  setSearchTerm('');
                }}
                className="text-xs text-blue-400 hover:underline cursor-pointer mr-1"
              >
                پاک‌کردن فیلترها
              </button>
            )}
          </div>

          {/* Action Buttons: Excel Import, Excel Export, Add Product */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExcelImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition cursor-pointer"
              title="بارگذاری و تطبیق اکسل کالاها و قیمت‌ها"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>ورود با اکسل</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExcelExportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-bold transition cursor-pointer"
              title="استخراج کاتالوگ یا قیمت‌ها در قالب اکسل"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی اکسل</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف کالای جدید</span>
            </button>
          </div>
        </div>

        {/* Excel Feedback Banner if active */}
        {excelFeedback && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-medium flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{excelFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setExcelFeedback(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Categories, Brands & Search Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Select */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">تمام دسته‌بندی‌ها</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Brand Select */}
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">تمام برندها</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی نام کالا یا برند..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar if items are selected */}
      {selectedProductIds.length > 0 && (
        <div className="p-3 bg-blue-950/70 border border-blue-800/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            <span className="text-xs font-bold text-blue-200">
              {selectedProductIds.length} کالا انتخاب شده است
            </span>
            <span className="text-[11px] text-blue-400/80">
              (از کل {filteredProducts.length} کالای فیلتر شده)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkFeedback(null);
                setIsBulkEditOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>ویرایش گروهی</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkFeedback(null);
                setIsBulkDeleteOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف گروهی</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              لغو انتخاب
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-sm text-slate-100">
              فهرست کالاها، قیمت مصوب و مدیریت موجودی
            </h3>
            {selectedProductIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                {selectedProductIds.length} مورد انتخابی
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">{filteredProducts.length} کالا</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            کالایی با شرایط فیلتر فعلی یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3 text-center w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      title={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0 ? 'لغو انتخاب همه' : 'انتخاب همه کالاهای نمایش داده شده'}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition cursor-pointer"
                    >
                      {selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 font-semibold">نام و مشخصات کالا</th>
                  <th className="py-3 px-4 font-semibold">دسته</th>
                  <th className="py-3 px-4 font-semibold">برند</th>
                  <th className="py-3 px-4 font-semibold">قیمت مصوب فروش</th>
                  <th className="py-3 px-4 font-semibold text-emerald-400">قیمت فروشگاه</th>
                  <th className="py-3 px-4 font-semibold text-blue-400">قیمت خرید ویزیتور</th>
                  <th className="py-3 px-4 font-semibold">کل سردخانه</th>
                  <th className="py-3 px-4 font-semibold">رزرو سفارشات</th>
                  <th className="py-3 px-4 font-semibold">موجودی آزاد</th>
                  <th className="py-3 px-4 font-semibold">واحد</th>
                  <th className="py-3 px-4 font-semibold text-center">وضعیت</th>
                  <th className="py-3 px-4 font-semibold text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((product) => {
                  const freeStock = product.stock - product.reserved_stock;
                  const isEditing = editingPriceId === product.id;
                  const categoryObj = categories.find((c) => c.id === product.category_id);
                  const isLow = freeStock < LOW_STOCK_THRESHOLD;
                  const visitorPrice = product.visitor_price || Math.round(product.price * 0.85);
                  const isSelected = selectedProductIds.includes(product.id);

                  return (
                    <tr key={product.id} className={`transition ${isSelected ? 'bg-blue-950/30' : 'hover:bg-slate-800/35'}`}>
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectProduct(product.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      {/* Name & Image */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <span className="font-semibold text-slate-100">{product.name}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                          {categoryObj?.name || 'سردخانه‌ای'}
                        </span>
                      </td>

                      {/* Brand */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-semibold">
                          {product.brand || 'متفرقه'}
                        </span>
                      </td>

                      {/* Store Purchase Price (Editable Inline) */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="space-y-1">
                            <span className="text-[10px] text-emerald-400 block font-bold">فروشگاه:</span>
                            <input
                              type="number"
                              min="1000"
                              value={tempStorePrice}
                              onChange={(e) => setTempStorePrice(Number(e.target.value))}
                              className="w-24 px-2 py-1 bg-slate-950 border border-emerald-500 rounded-lg text-xs text-emerald-300 font-mono"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold font-mono text-emerald-400">
                              {formatPrice(product.price)}
                            </span>
                            <span className="text-[11px] text-slate-500">تومان</span>
                          </div>
                        )}
                      </td>

                      {/* Visitor Purchase Price (Editable Inline) */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <div className="space-y-1">
                              <span className="text-[10px] text-blue-400 block font-bold">ویزیتور:</span>
                              <input
                                type="number"
                                min="1000"
                                value={tempVisitorPrice}
                                onChange={(e) => setTempVisitorPrice(Number(e.target.value))}
                                className="w-24 px-2 py-1 bg-slate-950 border border-blue-500 rounded-lg text-xs text-blue-300 font-mono"
                              />
                            </div>
                            <div className="flex items-center gap-1 pt-4">
                              <button
                                type="button"
                                onClick={() => handleSavePrice(product.id)}
                                className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer shadow-xs"
                                title="ذخیره قیمت‌های جدید"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPriceId(null)}
                                className="p-1 rounded-md bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                                title="انصراف"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold font-mono text-blue-400">
                              {formatPrice(visitorPrice)}
                            </span>
                            <span className="text-[11px] text-slate-500">تومان</span>
                          </div>
                        )}
                      </td>

                      {/* Stock Info */}
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {formatPrice(product.stock)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-amber-400">
                        {formatPrice(product.reserved_stock)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-black ${
                            isLow ? 'text-rose-400 font-bold' : 'text-emerald-400'
                          }`}
                        >
                          {formatPrice(freeStock)}
                        </span>
                        {isLow && (
                          <span className="mr-1 text-xs text-rose-400 font-normal">
                            (کم‌موجود)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{product.unit}</td>

                      {/* Active Status Toggle (with tooltip since context updater is proposed) */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          disabled
                          title="قابلیت فعال/غیرفعال‌سازی در آپدیت بعدی AppContext اضافه می‌شود"
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border opacity-80 cursor-not-allowed ${
                            product.is_active
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          <span>{product.is_active ? 'فعال' : 'غیرفعال'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Price Change Button */}
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPriceId(product.id);
                                setTempStorePrice(product.price);
                                setTempVisitorPrice(product.visitor_price || Math.round(product.price * 0.85));
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 inline-flex items-center gap-1 cursor-pointer transition"
                              title="تغییر رسمی نرخ"
                            >
                              <Edit2 className="w-3 h-3 text-blue-400" />
                              <span className="text-xs">تغییر نرخ</span>
                            </button>
                          )}

                          {/* Price History Drawer Trigger */}
                          <button
                            type="button"
                            onClick={() => setHistoryDrawerProduct(product)}
                            className="p-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1 cursor-pointer transition"
                            title="مشاهده تاریخچه تغییرات نرخ"
                          >
                            <History className="w-3 h-3 text-blue-400" />
                            <span className="text-xs">تاریخچه</span>
                          </button>

                          {/* Delete Product */}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteFeedback(null);
                              setProductToDelete(product);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 cursor-pointer transition"
                            title="حذف کالا از سیستم"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer: Price History */}
      <PriceHistoryDrawer
        product={historyDrawerProduct}
        priceHistories={priceHistories}
        isOpen={Boolean(historyDrawerProduct)}
        onClose={() => setHistoryDrawerProduct(null)}
      />

      {/* Modal: Define New Product */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100">تعریف کالای جدید در سامانه</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">نام کالا</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="مثال: بستنی مگنوم دابل شکلات"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <CategorySelectPicker
                  selectedCategoryId={newProdCat}
                  onSelectCategory={setNewProdCat}
                  onEditCategoryClick={onOpenEditCategory}
                />
                <BrandSelectPicker
                  selectedBrand={newProdBrand}
                  onSelectBrand={setNewProdBrand}
                  onEditBrandClick={onOpenEditBrand}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between">
                    <span>قیمت خرید فروشگاه (تومان) <span className="text-amber-400">*</span></span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    value={newProdPrice || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setNewProdPrice(val);
                      if (!newProdVisitorPrice || newProdVisitorPrice === Math.round(newProdPrice * 0.85)) {
                        setNewProdVisitorPrice(Math.round(val * 0.85));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="مثال: 45000"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">نرخ رسمی فروش به مشتریان سوپرمارکت</span>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between">
                    <span>قیمت خرید ویزیتور (تومان)</span>
                    <span className="text-[10px] text-blue-400">محرمانه</span>
                  </label>
                  <input
                    type="number"
                    min="1000"
                    value={newProdVisitorPrice || ''}
                    onChange={(e) => setNewProdVisitorPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="محاسبه خودکار (۸۵٪)"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">نرخ فاکتور حواله ویزیتور به شرکت</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">واحد سنجش</label>
                  <select
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="عدد">عدد</option>
                    <option value="باکس">باکس</option>
                    <option value="بسته">بسته</option>
                    <option value="کیلوگرم">کیلوگرم</option>
                    <option value="جعبه">جعبه</option>
                    <option value="سطل">سطل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    موجودی اولیه فیزیکی سردخانه
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProdStock || ''}
                    onChange={(e) => setNewProdStock(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  ثبت و تعریف کالا
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        categories={categories}
        brands={brands}
        existingProducts={products}
        onImportConfirm={handleBulkImportConfirm}
      />

      {/* Excel Export Modal */}
      <ExcelExportModal
        isOpen={isExcelExportOpen}
        onClose={() => setIsExcelExportOpen(false)}
        products={products}
        categories={categories}
        brands={brands}
      />

      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-100">حذف کالا از سیستم</h3>
            <p className="text-xs text-slate-300">
              آیا از حذف کالای <span className="text-rose-400 font-bold">{productToDelete.name}</span> اطمینان دارید؟
            </p>

            {deleteFeedback && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {deleteFeedback}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/30"
              >
                تایید حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-slate-100">
                  ویرایش گروهی ({selectedProductIds.length} کالا)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bulkFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  bulkFeedback.type === 'error'
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                }`}
              >
                {bulkFeedback.message}
              </div>
            )}

            <form onSubmit={handleExecuteBulkEdit} className="space-y-4">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                فیلدهایی را که مایل به تغییر دسته‌جمعی آنها هستید مشخص نمایید. مواردی که روی «بدون تغییر» باشند به همان شکل قبلی حفظ خواهند شد.
              </p>

              {/* Category Change */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  تغییر دسته‌بندی:
                </label>
                <select
                  value={bulkCatId}
                  onChange={(e) => setBulkCatId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">(بدون تغییر در دسته‌بندی کالاها)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Brand Change */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  تغییر برند / کارخانه سازنده:
                </label>
                <div className="flex gap-2">
                  <select
                    value={brands.includes(bulkBrandName) ? bulkBrandName : bulkBrandName ? 'custom' : ''}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setBulkBrandName(e.target.value);
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">(بدون تغییر در برند کالاها)</option>
                    {brands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="custom">برند دلخواه دیگر...</option>
                  </select>
                  <input
                    type="text"
                    value={bulkBrandName}
                    onChange={(e) => setBulkBrandName(e.target.value)}
                    placeholder="یا وارد کردن نام برند..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-600"
                  />
                </div>
              </div>

              {/* Unit Change */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  تغییر واحد شمارش:
                </label>
                <select
                  value={bulkUnitName}
                  onChange={(e) => setBulkUnitName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">(بدون تغییر در واحد کالاها)</option>
                  {STANDARD_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price adjustment */}
              <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <label className="text-xs font-semibold text-slate-300 block">
                  تنظیم قیمت فروشگاه:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkPriceChangeType('none');
                      setBulkPriceValue(0);
                    }}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkPriceChangeType === 'none'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    بدون تغییر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkPriceChangeType('percent');
                      setBulkPriceValue(bulkPriceValue || 10);
                    }}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkPriceChangeType === 'percent'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    تغییر درصدی (±%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkPriceChangeType('fixed');
                      setBulkPriceValue(bulkPriceValue || 50000);
                    }}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkPriceChangeType === 'fixed'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    قیمت ثابت (تومان)
                  </button>
                </div>

                {bulkPriceChangeType === 'percent' && (
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-400">درصد تغییر:</span>
                    <input
                      type="number"
                      step="1"
                      value={bulkPriceValue}
                      onChange={(e) => setBulkPriceValue(Number(e.target.value))}
                      placeholder="مثلاً 10 برای +۱۰٪ یا -5 برای ۵٪ تخفیف"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono text-center"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                )}

                {bulkPriceChangeType === 'fixed' && (
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-400">مبلغ جدید:</span>
                    <input
                      type="number"
                      min="100"
                      step="500"
                      value={bulkPriceValue}
                      onChange={(e) => setBulkPriceValue(Number(e.target.value))}
                      placeholder="قیمت به تومان"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono text-center"
                    />
                    <span className="text-xs text-slate-400">تومان</span>
                  </div>
                )}
              </div>

              {/* Status Change */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  وضعیت نمایش / فعالیت:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkActiveStatus('keep')}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkActiveStatus === 'keep'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    بدون تغییر
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkActiveStatus('active')}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkActiveStatus === 'active'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    فعال‌سازی همه
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkActiveStatus('inactive')}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkActiveStatus === 'inactive'
                        ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    غیرفعال‌سازی همه
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(false)}
                  disabled={isBulkProcessing}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isBulkProcessing}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isBulkProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>اعمال ویرایش گروهی</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-slate-100">حذف گروهی کالاها</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از حذف دائم <span className="text-rose-400 font-bold">{selectedProductIds.length}</span> کالای انتخاب‌شده از پایگاه داده و سامانه اطمینان دارید؟
            </p>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
              ⚠️ توجه: کالاهایی که در سفارشات فعال ثبت شده باشند، به دلیل رزرو سردخانه حذف نخواهند شد.
            </div>

            {bulkFeedback && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {bulkFeedback.message}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkDeleteOpen(false)}
                disabled={isBulkProcessing}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkDelete}
                disabled={isBulkProcessing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isBulkProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>تایید حذف {selectedProductIds.length} کالا</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
