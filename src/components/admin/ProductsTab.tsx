import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
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
  PackagePlus,
  Package,
  DollarSign,
  Warehouse,
  Image as ImageIcon,
  Camera,
  Heart,
  Sparkles,
  Clock,
  Phone,
} from 'lucide-react';
import { LOW_STOCK_THRESHOLD, formatPrice } from './helpers';
import { PriceHistoryDrawer } from './PriceHistoryDrawer';
import { CategorySelectPicker, BrandSelectPicker, UnitSelectPicker } from '../CategoryBrandSelectors';
import { ExcelImportModal } from './ExcelImportModal';
import { ExcelExportModal } from './ExcelExportModal';
import { MarketTestLikesModal } from './MarketTestLikesModal';

interface ProductsTabProps {
  products: Product[];
  categories: Category[];
  brands: string[];
  priceHistories: ProductPriceHistory[];
  initialFilterType?: 'lowStock' | 'all';
  onUpdateProductPrice: (productId: string, newPrice: number, newVisitorPrice?: number, newConsumerPrice?: number) => void;
  onUpdateProduct?: (productId: string, updates: Partial<Omit<Product, 'id' | 'reserved_stock'>>) => { success: boolean; message: string };
  onAddNewProduct: (newProd: Omit<Product, 'id'>) => void;
  onBulkUpsertProducts?: (items: any[]) => Promise<{ success: boolean; createdCount: number; updatedCount: number; message: string }> | { success: boolean; createdCount: number; updatedCount: number; message: string };
  onDeleteProduct: (productId: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
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
      is_market_test?: boolean;
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
  onUpdateProduct,
  onAddNewProduct,
  onBulkUpsertProducts,
  onDeleteProduct,
  onBulkDeleteProducts,
  onBulkUpdateProducts,
  onOpenEditCategory,
  onOpenEditBrand,
}) => {
  const { units, orders, productLikes, supermarkets } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [onlyLowStock, setOnlyLowStock] = useState(initialFilterType === 'lowStock');
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [onlyMarketTest, setOnlyMarketTest] = useState(false);

  // Quick Inline Price Editing (visitor price, store price, consumer price)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempVisitorPrice, setTempVisitorPrice] = useState<number>(0);
  const [tempStorePrice, setTempStorePrice] = useState<number>(0);
  const [tempConsumerPrice, setTempConsumerPrice] = useState<number>(0);

  // Modals for Excel Import / Export
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isExcelExportOpen, setIsExcelExportOpen] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState<string | null>(null);

  // Price History Drawer state
  const [historyDrawerProduct, setHistoryDrawerProduct] = useState<Product | null>(null);

  // Likes details modal state
  const [selectedLikesProduct, setSelectedLikesProduct] = useState<Product | null>(null);

  // Add Product Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState(() => brands[0] || '');
  const [newProdCat, setNewProdCat] = useState(() => categories[0]?.id || '');
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [newProdVisitorPrice, setNewProdVisitorPrice] = useState(0);
  const [newProdConsumerPrice, setNewProdConsumerPrice] = useState(0);
  const [newProdStock, setNewProdStock] = useState(0);
  const [newProdUnit, setNewProdUnit] = useState('عدد');
  const [newProdImage, setNewProdImage] = useState<string>('');
  const [newProdIsMarketTest, setNewProdIsMarketTest] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setAddModalError('حجم تصویر نباید بیشتر از ۳ مگابایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setNewProdImage(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Full Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdBrand, setEditProdBrand] = useState('');
  const [editProdCat, setEditProdCat] = useState('');
  const [editProdPrice, setEditProdPrice] = useState(0);
  const [editProdVisitorPrice, setEditProdVisitorPrice] = useState(0);
  const [editProdConsumerPrice, setEditProdConsumerPrice] = useState(0);
  const [editProdStock, setEditProdStock] = useState(0);
  const [editProdUnit, setEditProdUnit] = useState('عدد');
  const [editProdImage, setEditProdImage] = useState('');
  const [editProdIsActive, setEditProdIsActive] = useState(true);
  const [editProdIsMarketTest, setEditProdIsMarketTest] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setEditProdName(prod.name);
    setEditProdBrand(prod.brand || brands[0] || 'متفرقه');
    setEditProdCat(prod.category_id || categories[0]?.id || '');
    setEditProdPrice(prod.price);
    setEditProdVisitorPrice(prod.visitor_price || Math.round(prod.price * 0.85));
    setEditProdConsumerPrice(prod.consumer_price || 0);
    setEditProdStock(prod.stock);
    setEditProdUnit(prod.unit || 'عدد');
    setEditProdImage(prod.image_url || '');
    setEditProdIsActive(prod.is_active !== false);
    setEditProdIsMarketTest(Boolean(prod.is_market_test));
    setEditModalError(null);
  };

  const handleEditImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setEditModalError('حجم تصویر نباید بیشتر از ۳ مگابایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setEditProdImage(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveFullProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editProdName.trim()) {
      setEditModalError('نام کالا نمی‌تواند خالی باشد.');
      return;
    }
    if (!editProdPrice || editProdPrice <= 0) {
      setEditModalError('قیمت خرید فروشگاه باید معتبر باشد.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const finalImage = editProdImage.trim() || editingProduct.image_url || getSampleImage(editProdCat);
      const visitorPrice = editProdVisitorPrice > 0 ? editProdVisitorPrice : Math.round(editProdPrice * 0.85);

      if (onUpdateProduct) {
        onUpdateProduct(editingProduct.id, {
          name: editProdName.trim(),
          brand: editProdBrand.trim() || 'متفرقه',
          category_id: editProdCat,
          price: editProdPrice,
          visitor_price: visitorPrice,
          consumer_price: editProdConsumerPrice > 0 ? editProdConsumerPrice : undefined,
          stock: editProdStock,
          unit: editProdUnit,
          image_url: finalImage,
          is_active: editProdIsActive,
          is_market_test: editProdIsMarketTest,
        });
      } else {
        onUpdateProductPrice(
          editingProduct.id,
          editProdPrice,
          visitorPrice,
          editProdConsumerPrice > 0 ? editProdConsumerPrice : undefined
        );
      }

      setEditingProduct(null);
      setEditModalError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ذخیره کالا';
      setEditModalError(msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete product confirmation
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  // Check if invoice or order was previously issued for this product
  const productHasInvoices = useMemo(() => {
    if (!productToDelete) return false;
    return orders.some((o) =>
      o.items?.some(
        (i) => i.product_id === productToDelete.id || i.name?.trim() === productToDelete.name?.trim()
      )
    );
  }, [productToDelete, orders]);

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
  const [bulkMarketTestStatus, setBulkMarketTestStatus] = useState<'keep' | 'marketTest' | 'normal'>('keep');

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

  // Check if any of the bulk-selected products have invoices or orders
  const bulkSelectedHaveInvoices = useMemo(() => {
    if (selectedProductIds.length === 0) return false;
    const selectedSet = new Set(selectedProductIds);
    return orders.some((o) =>
      o.items?.some(
        (i) =>
          (i.product_id && selectedSet.has(i.product_id)) ||
          (i.name && products.some((p) => selectedSet.has(p.id) && p.name?.trim() === i.name?.trim()))
      )
    );
  }, [selectedProductIds, orders, products]);

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
      is_market_test?: boolean;
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
    if (bulkMarketTestStatus === 'marketTest') updates.is_market_test = true;
    if (bulkMarketTestStatus === 'normal') updates.is_market_test = false;

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

      // Market test filter
      if (onlyMarketTest && !product.is_market_test) {
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
  }, [products, onlyLowStock, onlyInactive, onlyMarketTest, selectedCategoryFilter, selectedBrandFilter, searchTerm]);

  const handleSavePrice = (productId: string) => {
    if (tempStorePrice > 0) {
      onUpdateProductPrice(
        productId,
        tempStorePrice,
        tempVisitorPrice > 0 ? tempVisitorPrice : undefined,
        tempConsumerPrice > 0 ? tempConsumerPrice : undefined
      );
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

  const handleCreateProductSubmit = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAddModalError(null);

    if (!newProdName.trim()) {
      setAddModalError('لطفاً نام کامل کالا را وارد نمایید.');
      return;
    }
    if (!newProdPrice || newProdPrice <= 0) {
      setAddModalError('لطفاً قیمت معتبر فروش به فروشگاه را وارد نمایید.');
      return;
    }

    const visitorPrice = newProdVisitorPrice > 0 ? newProdVisitorPrice : Math.round(newProdPrice * 0.85);

    onAddNewProduct({
      name: newProdName.trim(),
      brand: newProdBrand.trim() || 'متفرقه',
      category_id: newProdCat,
      price: newProdPrice,
      visitor_price: visitorPrice,
      consumer_price: newProdConsumerPrice > 0 ? newProdConsumerPrice : undefined,
      stock: newProdStock,
      reserved_stock: 0,
      unit: newProdUnit,
      image_url: newProdImage.trim() || getSampleImage(newProdCat),
      is_active: true,
      is_market_test: newProdIsMarketTest,
    });

    setIsAddModalOpen(false);
    setNewProdName('');
    setNewProdPrice(0);
    setNewProdVisitorPrice(0);
    setNewProdConsumerPrice(0);
    setNewProdStock(0);
    setNewProdImage('');
    setNewProdIsMarketTest(false);
    setAddModalError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    setIsDeletingProduct(true);
    setDeleteFeedback(null);
    try {
      const res = await onDeleteProduct(productToDelete.id);
      if (res.success) {
        setProductToDelete(null);
        setDeleteFeedback(null);
      } else {
        setDeleteFeedback(res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در حذف کالا';
      setDeleteFeedback(msg);
    } finally {
      setIsDeletingProduct(false);
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

            <button
              type="button"
              onClick={() => setOnlyMarketTest((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                onlyMarketTest
                  ? 'bg-violet-500/25 text-violet-300 border border-violet-500/50 shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>فقط تست بازار</span>
            </button>

            {(onlyLowStock || onlyInactive || onlyMarketTest || selectedCategoryFilter !== 'all' || selectedBrandFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setOnlyLowStock(false);
                  setOnlyInactive(false);
                  setOnlyMarketTest(false);
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
                  <th className="py-3 px-4 font-semibold text-blue-400">قیمت خرید ویزیتور</th>
                  <th className="py-3 px-4 font-semibold text-emerald-400">قیمت خرید فروشگاه</th>
                  <th className="py-3 px-4 font-semibold text-amber-400">قیمت مصرف کننده</th>
                  <th className="py-3 px-4 font-semibold">کل سردخانه</th>
                  <th className="py-3 px-4 font-semibold">رزرو سفارشات</th>
                  <th className="py-3 px-4 font-semibold">موجودی آزاد</th>
                  <th className="py-3 px-4 font-semibold">واحد</th>
                  <th className="py-3 px-4 font-semibold text-center">نمایش در کاتالوگ</th>
                  <th className="py-3 px-4 font-semibold text-center text-violet-400">تست بازار و لایک‌ها</th>
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
                  const itemLikes = productLikes.filter((pl) => pl.product_id === product.id);

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
                      {/* Name & Image with Direct Click-to-Edit Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(product)}
                            className="relative group w-10 h-10 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shrink-0 cursor-pointer shadow-xs hover:border-blue-500 transition"
                            title="برای تغییر، آپلود یا ویرایش عکس این کالا کلیک کنید"
                          >
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover transition duration-200 group-hover:scale-110"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                              <Camera className="w-4 h-4 text-blue-300" />
                            </div>
                          </button>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-100 block truncate">{product.name}</span>
                            {product.brand && (
                              <span className="text-[11px] text-slate-400 font-normal">{product.brand}</span>
                            )}
                          </div>
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
                      {/* 1. Visitor Purchase Price (قیمت خرید ویزیتور) */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="space-y-1">
                            <span className="text-[10px] text-blue-400 block font-bold">ویزیتور:</span>
                            <input
                              type="number"
                              min="0"
                              value={tempVisitorPrice}
                              onChange={(e) => setTempVisitorPrice(Number(e.target.value))}
                              className="w-24 px-2 py-1 bg-slate-950 border border-blue-500 rounded-lg text-xs text-blue-300 font-mono"
                            />
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
                      {/* 2. Store Purchase Price (قیمت خرید فروشگاه) */}
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
                      {/* 3. Consumer Price (قیمت مصرف کننده) */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <div className="space-y-1">
                              <span className="text-[10px] text-amber-400 block font-bold">مصرف‌کننده:</span>
                              <input
                                type="number"
                                min="0"
                                value={tempConsumerPrice}
                                onChange={(e) => setTempConsumerPrice(Number(e.target.value))}
                                className="w-24 px-2 py-1 bg-slate-950 border border-amber-500 rounded-lg text-xs text-amber-300 font-mono"
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
                        ) : product.consumer_price && product.consumer_price > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold font-mono text-amber-400">
                              {formatPrice(product.consumer_price)}
                            </span>
                            <span className="text-[11px] text-slate-500">تومان</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-xs">—</span>
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

                      {/* Active Status Toggle (Show / Hide in store catalog) */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateProduct) {
                              onUpdateProduct(product.id, { is_active: !product.is_active });
                            }
                          }}
                          title={product.is_active ? 'کلیک کنید تا کالا در کاتالوگ فروشگاه‌ها مخفی شود' : 'کلیک کنید تا کالا در کاتالوگ فروشگاه‌ها نمایش داده شود'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                            product.is_active
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${product.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          <span>{product.is_active ? 'فعال در کاتالوگ' : 'مخفی / غیرفعال'}</span>
                        </button>
                      </td>

                      {/* Market Test Status & Likes List Trigger */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1.5 justify-center">
                          {/* Market test toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onUpdateProduct) {
                                onUpdateProduct(product.id, { is_market_test: !product.is_market_test });
                              }
                            }}
                            title={product.is_market_test ? 'کلیک برای خروج از حالت تست بازار' : 'کلیک برای فعال‌سازی حالت تست بازار (نمایش به صورت "به زودی" با دکمه لایک)'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              product.is_market_test
                                ? 'bg-violet-500/25 hover:bg-violet-500/35 text-violet-300 border-violet-500/50 shadow-xs shadow-violet-900/40'
                                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700/80'
                            }`}
                          >
                            <Sparkles className={`w-3 h-3 ${product.is_market_test ? 'text-violet-400' : 'text-slate-500'}`} />
                            <span>{product.is_market_test ? 'تست بازار (فعال)' : 'عادی'}</span>
                          </button>

                          {/* Likes count button -> Opens MarketTestLikesModal */}
                          <button
                            type="button"
                            onClick={() => setSelectedLikesProduct(product)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                              itemLikes.length > 0
                                ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800'
                            }`}
                            title="مشاهده لیست فروشگاه‌هایی که این کالا را لایک کرده‌اند"
                          >
                            <Heart className={`w-3 h-3 ${itemLikes.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
                            <span>{itemLikes.length.toLocaleString('fa-IR')} لایک</span>
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Main Full Edit Button (Opens Modal with Image Upload, Name, Category, Prices, etc.) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(product)}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs shadow-blue-600/25 transition active:scale-95 shrink-0"
                            title="ویرایش کامل مشخصات، نام، دسته‌بندی، قیمت و آپلود عکس کالا"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>ویرایش کالا</span>
                          </button>

                          {/* Quick Inline Price Change Button */}
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPriceId(product.id);
                                setTempVisitorPrice(product.visitor_price || Math.round(product.price * 0.85));
                                setTempStorePrice(product.price);
                                setTempConsumerPrice(product.consumer_price || 0);
                              }}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 inline-flex items-center gap-1 cursor-pointer transition shrink-0"
                              title="تغییر سریع نرخ"
                            >
                              <Tag className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-xs">تغییر نرخ</span>
                            </button>
                          )}

                          {/* Price History Drawer Trigger */}
                          <button
                            type="button"
                            onClick={() => setHistoryDrawerProduct(product)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 inline-flex items-center gap-1 cursor-pointer transition shrink-0"
                            title="مشاهده تاریخچه تغییرات نرخ"
                          >
                            <History className="w-3.5 h-3.5 text-blue-400" />
                          </button>

                          {/* Delete Product */}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteFeedback(null);
                              setProductToDelete(product);
                            }}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer transition shrink-0"
                            title="حذف کالا از سیستم"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">تعریف کالای جدید در سامانه</h3>
                  <p className="text-xs text-slate-400">اطلاعات کالا، دسته‌بندی، قیمت‌ها و موجودی انبار را وارد کنید</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Section 1: Basic Info */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  اطلاعات شناسه کالا
                </span>
                
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    نام کامل کالا <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition"
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
              </div>

              {/* Section 2: Pricing Structure */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  ساختار قیمت‌گذاری (تومان)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-200 mb-1 font-semibold flex items-center justify-between">
                      <span>خرید ویزیتور</span>
                      <span className="text-[10px] text-blue-400">محرمانه</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProdVisitorPrice || ''}
                      onChange={(e) => setNewProdVisitorPrice(Number(e.target.value))}
                      placeholder={newProdPrice ? `${Math.round(newProdPrice * 0.85)}` : 'نرخ ویزیتور'}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">نرخ حواله شرکت به ویزیتور</span>
                  </div>

                  <div>
                    <label className="block text-slate-200 mb-1 font-semibold">
                      خرید فروشگاه <span className="text-amber-400">*</span>
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
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">نرخ فروش به سوپرمارکت</span>
                  </div>

                  <div>
                    <label className="block text-slate-200 mb-1 font-semibold flex items-center justify-between">
                      <span>قیمت مصرف‌کننده</span>
                      <span className="text-[10px] text-amber-400">اختیاری</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProdConsumerPrice || ''}
                      onChange={(e) => setNewProdConsumerPrice(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">درج روی جلد کالا (در صورت وجود)</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Inventory & Unit */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5" />
                  موجودی و واحد سنجش
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <UnitSelectPicker
                    selectedUnit={newProdUnit}
                    onSelectUnit={setNewProdUnit}
                  />

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      موجودی اولیه فیزیکی سردخانه
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProdStock || ''}
                      onChange={(e) => setNewProdStock(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Product Image (Upload File, Image URL or Presets) */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  تصویر و نمای کالا
                </span>

                <div className="flex flex-col sm:flex-row gap-3.5 items-start">
                  {/* Image Preview Box */}
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden relative group">
                    <img
                      src={newProdImage || getSampleImage(newProdCat)}
                      alt="پیش‌نمایش تصویر کالا"
                      className="w-full h-full object-cover"
                    />
                    {newProdImage && (
                      <button
                        type="button"
                        onClick={() => setNewProdImage('')}
                        title="حذف تصویر اختصاصی و استفاده از تصویر پیش‌فرض"
                        className="absolute inset-0 bg-black/60 text-rose-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Upload and URL Controls */}
                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>انتخاب فایل عکس از سیستم...</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-slate-500">(فرمت‌های JPG، PNG، WebP)</span>
                    </div>

                    <div>
                      <input
                        type="url"
                        placeholder="یا درج لینک مستقیم عکس (https://...)..."
                        value={newProdImage.startsWith('data:') ? '' : newProdImage}
                        onChange={(e) => setNewProdImage(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 dir-ltr text-left font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: Market Test Setting */}
              <div className="space-y-2.5 p-3.5 rounded-2xl bg-violet-950/20 border border-violet-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    وضعیت تست بازار (سنجش کشش و دریافت لایک از فروشگاه‌ها)
                  </span>

                  <button
                    type="button"
                    onClick={() => setNewProdIsMarketTest(!newProdIsMarketTest)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      newProdIsMarketTest
                        ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-900/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{newProdIsMarketTest ? 'تست بازار: فعال (به زودی)' : 'تست بازار: غیرفعال (عادی)'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-violet-200/80 leading-relaxed">
                  در صورت فعال‌سازی، این کالا با برچسب «به زودی» در کاتالوگ فروشگاه‌ها قرار می‌گیرد و به جای دکمه سفارش، دکمه «اعلام علاقه‌مندی و لایک» برای فروشگاه‌ها فعال خواهد شد.
                </p>
              </div>

              {addModalError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{addModalError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddModalError(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleCreateProductSubmit}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>ثبت و تعریف کالا</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Product & Image Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 my-auto">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-100">ویرایش مشخصات و تصویر کالا</h3>
                    <span className="font-mono text-xs text-blue-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
                      {editingProduct.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تغییر عکس، نام، دسته‌بندی، نرخ‌های مصوب و موجودی کالا
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setEditModalError(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveFullProduct} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Section 1: Product Image Upload & Link (Top Priority) */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" />
                    تصویر و عکس اختصاصی کالا
                  </span>
                  <span className="text-[11px] text-slate-400">نمایش در کاتالوگ فروشگاه و ویزیتور</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
                  {/* Image Preview Box with Hover Actions */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden relative group shadow-md">
                    <img
                      src={editProdImage || getSampleImage(editProdCat)}
                      alt="پیش‌نمایش تصویر کالا"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition text-white text-[10px]">
                      <Camera className="w-5 h-5 text-blue-300" />
                      <span>تغییر تصویر</span>
                    </div>
                  </div>

                  {/* Upload Controls & URL Input */}
                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95">
                        <Upload className="w-3.5 h-3.5" />
                        <span>انتخاب فایل عکس از کامپیوتر یا گوشی...</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditImageFileChange}
                          className="hidden"
                        />
                      </label>

                      {editProdImage && (
                        <button
                          type="button"
                          onClick={() => setEditProdImage('')}
                          className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
                          title="استفاده مجدد از تصویر پیش‌فرض دسته‌بندی"
                        >
                          بازنشانی به پیش‌فرض
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] text-slate-400 font-medium">
                        یا لینک مستقیم تصویر (از هاست اختصاصی، یوپلود، آروان و...):
                      </label>
                      <input
                        type="url"
                        placeholder="https://your-host.ir/images/product.jpg"
                        value={editProdImage.startsWith('data:') ? '' : editProdImage}
                        onChange={(e) => setEditProdImage(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 dir-ltr text-left font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Product Name, Category & Brand */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  مشخصات هویتی کالا
                </span>

                <div>
                  <label className="block text-slate-200 mb-1 font-semibold text-xs">
                    نام کامل کالا <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editProdName}
                    onChange={(e) => setEditProdName(e.target.value)}
                    placeholder="نام کالا را وارد نمایید..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <CategorySelectPicker
                    selectedCategoryId={editProdCat}
                    onSelectCategory={setEditProdCat}
                    onEditCategoryClick={onOpenEditCategory}
                  />
                  <BrandSelectPicker
                    selectedBrand={editProdBrand}
                    onSelectBrand={setEditProdBrand}
                    onEditBrandClick={onOpenEditBrand}
                  />
                </div>
              </div>

              {/* Section 3: Pricing Structure */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  نرخ‌گذاری و قیمت‌های مصوب (تومان)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-200 mb-1 font-semibold text-xs flex items-center justify-between">
                      <span>خرید ویزیتور</span>
                      <span className="text-[10px] text-blue-400">محرمانه</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editProdVisitorPrice || ''}
                      onChange={(e) => setEditProdVisitorPrice(Number(e.target.value))}
                      placeholder="نرخ حواله ویزیتور"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">نرخ تحویل به ویزیتور</span>
                  </div>

                  <div>
                    <label className="block text-slate-200 mb-1 font-semibold text-xs">
                      خرید فروشگاه (اصلی) <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1000"
                      value={editProdPrice || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setEditProdPrice(val);
                        if (!editProdVisitorPrice || editProdVisitorPrice === Math.round(editProdPrice * 0.85)) {
                          setEditProdVisitorPrice(Math.round(val * 0.85));
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">مبنای فاکتور سوپرمارکت</span>
                  </div>

                  <div>
                    <label className="block text-slate-200 mb-1 font-semibold text-xs flex items-center justify-between">
                      <span>مصرف‌کننده</span>
                      <span className="text-[10px] text-slate-500">اختیاری</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editProdConsumerPrice || ''}
                      onChange={(e) => setEditProdConsumerPrice(Number(e.target.value))}
                      placeholder="قیمت درج شده رو جلد"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-amber-300 focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">قیمت روی جلد کالا</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Inventory, Catalog Visibility & Market Test */}
              <div className="space-y-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5" />
                  موجودی سردخانه، وضعیت عرضه و تست بازار
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <UnitSelectPicker
                    selectedUnit={editProdUnit}
                    onSelectUnit={setEditProdUnit}
                  />

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium text-xs">
                      کل موجودی فیزیکی سردخانه
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editProdStock}
                      onChange={(e) => setEditProdStock(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium text-xs">نمایش در کاتالوگ فروشگاه</label>
                    <button
                      type="button"
                      onClick={() => setEditProdIsActive(!editProdIsActive)}
                      className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        editProdIsActive
                          ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <Check className={`w-4 h-4 ${editProdIsActive ? 'opacity-100' : 'opacity-40'}`} />
                      <span>{editProdIsActive ? 'فعال (قابل مشاهده)' : 'مخفی از کاتالوگ'}</span>
                    </button>
                  </div>
                </div>

                {/* Market Test Toggle & Likes Section */}
                <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between sm:justify-start gap-3 flex-1">
                    <div>
                      <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                        وضعیت تست بازار (سنجش کشش)
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        نمایش کالا با برچسب «به زودی» بدون امکان سفارش و دریافت لایک از فروشگاه‌ها
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditProdIsMarketTest(!editProdIsMarketTest)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                        editProdIsMarketTest
                          ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-900/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{editProdIsMarketTest ? 'تست بازار فعال' : 'کالای عادی'}</span>
                    </button>
                  </div>

                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => setSelectedLikesProduct(editingProduct)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                      title="مشاهده لیست فروشگاه‌های علاقه‌مند به این کالا"
                    >
                      <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                      <span>
                        مشاهده {productLikes.filter((pl) => pl.product_id === editingProduct.id).length.toLocaleString('fa-IR')} فروشگاه علاقه‌مند
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {editModalError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{editModalError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setEditModalError(null);
                  }}
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/30 cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال ذخیره تغییرات...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ذخیره تغییرات کالا</span>
                    </>
                  )}
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
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-slate-100">حذف کالا از سیستم</h3>
                <p className="text-xs text-slate-300">
                  آیا از حذف کالای <span className="text-rose-400 font-bold">{productToDelete.name}</span> اطمینان دارید؟
                </p>
              </div>
            </div>

            {/* Warning if invoice/order was previously issued for this product */}
            {productHasInvoices && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>هشدار: قبلاً برای این کالا فاکتور صادر شده است!</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed pr-5">
                  سوابق و مبالغ فاکتورهای قبلی در سیستم حفظ خواهد شد، اما کالا از لیست اقلام و کاتالوگ فروش کلاً حذف می‌گردد.
                </p>
              </div>
            )}

            {deleteFeedback && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {deleteFeedback}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setProductToDelete(null);
                  setDeleteFeedback(null);
                }}
                disabled={isDeletingProduct}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeletingProduct}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingProduct ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <span>تایید حذف کالا</span>
                )}
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
                  {units.map((u) => (
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
                  وضعیت نمایش در کاتالوگ فروشگاه:
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
                    فعال در کاتالوگ
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
                    مخفی از کاتالوگ
                  </button>
                </div>
              </div>

              {/* Market Test Bulk Setting */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  وضعیت تست بازار (به زودی و دریافت لایک):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkMarketTestStatus('keep')}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkMarketTestStatus === 'keep'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    بدون تغییر
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMarketTestStatus('marketTest')}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkMarketTestStatus === 'marketTest'
                        ? 'bg-violet-600/30 border-violet-500 text-violet-300 shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    فعال‌سازی تست بازار
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMarketTestStatus('normal')}
                    className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      bulkMarketTestStatus === 'normal'
                        ? 'bg-slate-800 border-slate-600 text-slate-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    کالای عادی (خروج از تست)
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

            {bulkSelectedHaveInvoices ? (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>هشدار: قبلاً برای برخی از این اقلام فاکتور صادر شده است!</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed pr-5">
                  سوابق، ریز اقلام و مبالغ فاکتورهای قبلی در بایگانی حفظ می‌گردد، اما این کالاها از لیست اقلام فعال و کاتالوگ فروش کلاً حذف خواهند شد.
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[11px] leading-relaxed">
                این عملیات کالاها را به طور کامل از کاتالوگ و سیستم حذف می‌کند.
              </div>
            )}

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

      {/* Market Test Likes Details Modal */}
      {selectedLikesProduct && (
        <MarketTestLikesModal
          product={selectedLikesProduct}
          likes={productLikes.filter((pl) => pl.product_id === selectedLikesProduct.id)}
          supermarkets={supermarkets}
          onClose={() => setSelectedLikesProduct(null)}
          onToggleMarketTest={() => {
            if (onUpdateProduct) {
              onUpdateProduct(selectedLikesProduct.id, { is_market_test: !selectedLikesProduct.is_market_test });
              setSelectedLikesProduct((prev) => (prev ? { ...prev, is_market_test: !prev.is_market_test } : null));
            }
          }}
        />
      )}
    </div>
  );
};
