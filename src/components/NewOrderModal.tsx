import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Search,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Check,
  Store,
  MapPin,
  Filter,
  Clock,
  User,
} from 'lucide-react';
import { ProductRow } from './shop/ProductRow';
import { ProductCatalog } from './shop/ProductCatalog';
import { CartBar } from './shop/CartBar';
import { CartSheet } from './shop/CartSheet';
import { FilterSheet } from './shop/FilterSheet';
import { formatPrice, filterCatalogProducts } from './shop/shopUtils';
import { Order, Supermarket, Visitor } from '../types';
import { OrderInvoiceModal } from './invoice/OrderInvoiceModal';
import { FileText, Printer, Percent } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultSupermarketId?: string;
  defaultVisitorId?: string;
}

export const NewOrderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultSupermarketId,
  defaultVisitorId,
}) => {
  const {
    products,
    categories,
    brands,
    supermarkets,
    visitors,
    currentUser,
    createOrder,
    showToast,
    refreshData,
  } = useApp();

  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string>(
    defaultSupermarketId || 'self'
  );
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Sync selectedSupermarketId if defaultSupermarketId changes
  useEffect(() => {
    if (defaultSupermarketId) {
      setSelectedSupermarketId(defaultSupermarketId);
    } else if (!selectedSupermarketId) {
      setSelectedSupermarketId('self');
    }
  }, [defaultSupermarketId, isOpen, selectedSupermarketId]);

  // Close customer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setIsStoreDropdownOpen(false);
      }
    };
    if (isStoreDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStoreDropdownOpen]);

  // Available brands in selected category
  const availableBrandsInCategory = useMemo(() => {
    const brandSet = new Set<string>();
    products.forEach((p) => {
      if (!p.is_active) return;
      if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) return;
      if (p.brand && p.brand.trim()) {
        brandSet.add(p.brand.trim());
      }
    });
    return Array.from(brandSet).sort();
  }, [products, selectedCategoryId]);

  // Reset selected brand if no longer available
  useEffect(() => {
    if (selectedBrand !== 'all' && !availableBrandsInCategory.includes(selectedBrand)) {
      setSelectedBrand('all');
    }
  }, [selectedCategoryId, availableBrandsInCategory, selectedBrand]);

  const defaultFallbackStore: Supermarket = useMemo(() => ({
    id: 'sm-default',
    name: 'فروشگاه طرف قرارداد',
    owner: 'متصدی فروشگاه',
    phone: '',
    address: 'ثبت شده در سامانه مرکزی پخش',
    assigned_visitor_id: '',
    credit_limit: 50000000,
    current_debt: 0,
    is_active: true,
  }), []);

  const defaultFallbackVisitor: Visitor = useMemo(() => ({
    id: '',
    name: 'واحد توزیع و ویزیت',
    phone: '',
    region: 'عمومی',
    username: 'visitor',
    is_active: true,
  }), []);

  const isSelfOrder = selectedSupermarketId === 'self';

  const defaultVisitor = useMemo(() => {
    return (
      (defaultVisitorId ? visitors.find((v) => v.id === defaultVisitorId) : null) ||
      (currentUser?.role === 'visitor' ? visitors.find((v) => v.id === currentUser.id) : null) ||
      (currentUser?.role === 'visitor'
        ? {
            id: currentUser.id,
            name: currentUser.name,
            phone: currentUser.phone || '',
            region: 'ویزیتور',
            username: currentUser.username || 'visitor',
            is_active: true,
          }
        : null) ||
      visitors[0] ||
      defaultFallbackVisitor
    );
  }, [visitors, defaultVisitorId, currentUser, defaultFallbackVisitor]);

  const currentVisitorName =
    defaultVisitor?.name ||
    (currentUser?.role === 'visitor' ? currentUser.name : '') ||
    'ویزیتور';

  const selfBuyer: Supermarket = useMemo(() => ({
    id: `self-${defaultVisitor.id || 'visitor'}`,
    name: `خودم (${currentVisitorName})`,
    owner: currentVisitorName,
    phone: defaultVisitor.phone || '',
    address: 'خرید شخصی ویزیتور',
    assigned_visitor_id: '',
    credit_limit: 100000000,
    current_debt: 0,
    is_active: true,
  }), [defaultVisitor, currentVisitorName]);

  const currentSupermarket = isSelfOrder
    ? selfBuyer
    : (supermarkets.find((s) => s.id === selectedSupermarketId) ||
       supermarkets[0] ||
       defaultFallbackStore);

  const currentVisitor = isSelfOrder
    ? null
    : (visitors.find((v) => v.id === (defaultVisitorId || currentSupermarket?.assigned_visitor_id)) ||
       visitors[0] ||
       defaultFallbackVisitor);

  // Filter supermarkets by search term
  const filteredSupermarkets = supermarkets.filter((s) => {
    if (!storeSearchTerm.trim()) return true;
    const term = storeSearchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.owner.toLowerCase().includes(term) ||
      (s.address && s.address.toLowerCase().includes(term))
    );
  });

  const filteredProducts = useMemo(() => {
    return filterCatalogProducts(products, {
      categoryId: selectedCategoryId,
      brand: selectedBrand,
      searchTerm,
      inStockOnly,
    });
  }, [products, selectedCategoryId, selectedBrand, searchTerm, inStockOnly]);

  const handleSetQuantity = useCallback((productId: string, newQty: number) => {
    setFeedback(null);
    const targetProd = products.find((p) => p.id === productId);
    if (targetProd?.is_market_test) {
      setFeedback({
        type: 'error',
        message: 'کالاهای دارای برچسب «به زودی» در حال حاضر قابل سفارش نیستند.',
      });
      return;
    }
    const roundedQty = Math.round(newQty * 1000) / 1000;
    setCart((prev) => {
      if (roundedQty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: roundedQty };
    });
  }, [products]);

  const handleExceedLimit = useCallback((maxAvailable: number) => {
    setFeedback({
      type: 'error',
      message: `حداکثر موجودی قابل سفارش برای این کالا، ${maxAvailable} واحد می‌باشد.`,
    });
  }, []);

  const cartItems = useMemo(() => {
    return (Object.entries(cart) as [string, number][]).map(([productId, quantity]) => {
      const prod = products.find((p) => p.id === productId);
      if (!prod || quantity <= 0) return null;
      const multiplier = prod.items_per_package && prod.items_per_package > 0 ? prod.items_per_package : 1;
      const basePrice = isSelfOrder
        ? (Number(prod.visitor_price ?? 0) > 0 ? Number(prod.visitor_price) : prod.price)
        : prod.price;
      const cartonPrice = basePrice * multiplier;
      return {
        productId,
        name: prod.name,
        price: cartonPrice,
        basePrice,
        quantity,
        multiplier,
        unit: prod.unit,
        items_per_package: prod.items_per_package,
        total: cartonPrice * quantity,
      };
    }).filter((i): i is NonNullable<typeof i> => i !== null);
  }, [cart, products, isSelfOrder]);

  const cartTotalAmount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total, 0);
  }, [cartItems]);

  const totalItemCount = useMemo(() => {
    const sum = cartItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
    return Math.round(sum * 1000) / 1000;
  }, [cartItems]);

  const handleSubmit = async () => {
    if (isSubmittingRef.current || isSubmitting) return;

    if (!isSelfOrder && (!currentSupermarket?.id || !currentVisitor?.id)) {
      setFeedback({ type: 'error', message: 'لطفاً خریدار و ویزیتور را مشخص کنید.' });
      return;
    }

    if (cartItems.length === 0) {
      setFeedback({ type: 'error', message: 'هیچ کالایی به سبد اضافه نشده است.' });
      return;
    }

    const hasMarketTest = cartItems.some((item) => {
      const p = products.find((prod) => prod.id === item.productId);
      return p?.is_market_test;
    });
    if (hasMarketTest) {
      setFeedback({
        type: 'error',
        message: 'کالاهای دارای برچسب «به زودی» در حال حاضر قابل سفارش نیستند.',
      });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const res = await createOrder({
        supermarketId: currentSupermarket.id,
        visitorId: isSelfOrder ? '' : (currentVisitor?.id || ''),
        orderSource: 'visitor',
        items: cartItems.map((c) => ({
          productId: c.productId,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          items_per_package: c.items_per_package,
          unit: c.unit,
        })),
      });

      if (res.success) {
        if (res.order?.id && discountPercent > 0 && isSupabaseConfigured && supabase) {
          try {
            await supabase.rpc('set_order_discount', {
              p_order_id: res.order.id,
              p_percent: discountPercent,
            });
          } catch (err) {
            console.error('Error setting order discount:', err);
          }
        }
        setFeedback({ type: 'success', message: res.message });
        if (res.order) {
          setCreatedOrder(res.order);
        }
        setCart({});
        setDiscountPercent(0);
      } else {
        const errorMsg = res.message || 'خطا در ثبت سفارش روی سرور.';
        showToast(errorMsg, 'warning', 5000);
        await refreshData();
        setFeedback({ type: 'error', message: errorMsg });
      }
    } catch {
      const errorMsg = 'خطای ارتباط با سرور در ثبت سفارش.';
      showToast(errorMsg, 'warning', 5000);
      await refreshData();
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleClearCart = useCallback(() => {
    setCart({});
    showToast('سبد سفارش خالی شد.');
  }, [showToast]);

  const handleResetForNewOrder = () => {
    setCreatedOrder(null);
    setFeedback(null);
    setCart({});
    setDiscountPercent(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 sm:rounded-2xl w-full max-w-6xl h-full sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                ثبت سفارش برای فروشگاه (پنل ویزیتور)
              </h2>
              <p className="text-[10.5px] sm:text-xs text-slate-400 truncate">
                نمایش کاتالوگ دقیقاً مشابه اپلیکیشن فروشگاه · رزرو فوری در سردخانه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Completed / Success View */}
        {createdOrder ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-100">سفارش با موفقیت در سامانه ثبت شد</h3>
              <p className="text-xs text-slate-400">
                شماره فاکتور:{' '}
                <span className="font-mono font-bold text-emerald-400 dir-ltr text-xs sm:text-sm">{createdOrder.id}</span>
              </p>
            </div>

            <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-xs space-y-2 text-right">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">خریدار:</span>
                <span className="font-bold text-slate-200">{createdOrder.supermarket_name}</span>
              </div>
              {!createdOrder.supermarket_id?.startsWith('self-') && createdOrder.visitor_name && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ویزیتور مسئول:</span>
                  <span className="font-bold text-slate-200">{createdOrder.visitor_name}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">مبلغ کل فاکتور:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {formatPrice(createdOrder.total_amount)} تومان
                </span>
              </div>
            </div>

            <div className="w-full space-y-2 pt-1">
              {/* View / Print / PDF Invoice Button */}
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>مشاهده، چاپ کاغذی و دریافت فایل PDF فاکتور</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleResetForNewOrder}
                  className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
                >
                  ثبت سفارش دیگر
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-medium text-xs transition cursor-pointer"
                >
                  بستن پنجره
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Store & Visitor Selector + Discount Input (Compact Bar) */}
            <div className="p-2.5 sm:p-3 bg-slate-950/60 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs shrink-0">
              {/* Custom Searchable Customer Dropdown (sm:col-span-6) */}
              <div className="relative sm:col-span-6" ref={storeDropdownRef}>
                <label className="block text-[11px] text-slate-400 mb-0.5 font-medium">خریدار / فروشگاه:</label>
                
                {/* Dropdown trigger button */}
                <button
                  type="button"
                  onClick={() => setIsStoreDropdownOpen((prev) => !prev)}
                  className={`w-full bg-slate-900 border rounded-xl px-2.5 py-1.5 text-slate-200 flex items-center justify-between transition cursor-pointer text-right shadow-xs ${
                    isStoreDropdownOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelfOrder ? (
                      <>
                        <div className="w-5 h-5 rounded-md bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                          <User className="w-3 h-3" />
                        </div>
                        <div className="truncate flex items-center gap-1.5">
                          <span className="font-bold text-slate-100 text-xs">خودم ({currentVisitorName})</span>
                          <span className="text-[10px] text-purple-400 font-semibold bg-purple-950/60 px-1 py-0.2 rounded border border-purple-800/40">
                            قیمت ویزیتور
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-md bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <Store className="w-3 h-3" />
                        </div>
                        {currentSupermarket ? (
                          <div className="truncate flex items-center gap-1.5">
                            <span className="font-bold text-slate-100 text-xs truncate">{currentSupermarket.name}</span>
                            <span className="text-slate-400 text-[11px] truncate">({currentSupermarket.owner})</span>
                            {currentSupermarket.approval_status === 'pending' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <span>در انتظار تایید</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">انتخاب خریدار...</span>
                        )}
                      </>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isStoreDropdownOpen ? 'rotate-180 text-blue-400' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isStoreDropdownOpen && (
                  <div className="absolute z-50 top-full mt-1 right-0 left-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-10">
                      <div className="relative">
                        <Search className="w-3 h-3 absolute right-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          value={storeSearchTerm}
                          onChange={(e) => setStoreSearchTerm(e.target.value)}
                          placeholder="جستجوی نام یا مدیر خریدار..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pr-7 pl-7 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                        {storeSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setStoreSearchTerm('')}
                            className="absolute left-2 top-2 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/60 no-scrollbar">
                      {/* Option: خودم (ویزیتور) */}
                      {(!storeSearchTerm.trim() ||
                        'خودم'.includes(storeSearchTerm.trim()) ||
                        (currentVisitorName && currentVisitorName.toLowerCase().includes(storeSearchTerm.toLowerCase()))) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupermarketId('self');
                            setIsStoreDropdownOpen(false);
                            setStoreSearchTerm('');
                          }}
                          className={`w-full p-2 text-right flex items-center justify-between gap-2 transition cursor-pointer text-xs ${
                            isSelfOrder
                              ? 'bg-purple-600/20 text-purple-200'
                              : 'hover:bg-slate-800/80 text-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                              <User className="w-3 h-3" />
                            </div>
                            <span className="font-bold text-slate-100">خودم ({currentVisitorName})</span>
                          </div>
                          {isSelfOrder && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </button>
                      )}

                      {filteredSupermarkets.map((s) => {
                        const isSelected = s.id === selectedSupermarketId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSupermarketId(s.id);
                              setIsStoreDropdownOpen(false);
                              setStoreSearchTerm('');
                            }}
                            className={`w-full p-2 text-right flex items-center justify-between gap-2 transition cursor-pointer text-xs ${
                              isSelected
                                ? 'bg-blue-600/15 text-blue-200'
                                : 'hover:bg-slate-800/80 text-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-100">{s.name}</span>
                              <span className="text-[11px] text-slate-400 mr-1.5">({s.owner})</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Visitor Display (sm:col-span-3) */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] text-slate-400 mb-0.5 font-medium">ویزیتور سفارش:</label>
                <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-between h-[34px]">
                  <span className="truncate">{currentVisitor?.name || 'ویزیتور'}</span>
                  {currentVisitor?.region && (
                    <span className="text-[10px] text-blue-400 px-1.5 py-0.2 rounded bg-blue-950 border border-blue-800 shrink-0">
                      {currentVisitor.region}
                    </span>
                  )}
                </div>
              </div>

              {/* Proposed Discount % (sm:col-span-3) - Compact and non-intrusive */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] text-slate-400 mb-0.5 font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3 text-amber-400" />
                    <span>تخفیف دستی:</span>
                  </span>
                  {discountPercent > 0 && (
                    <span className="text-[9.5px] text-amber-400 font-bold">نیاز به تأیید ادمین</span>
                  )}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-full h-[34px] px-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs dir-ltr num-fa font-bold text-center focus:border-amber-500 focus:outline-none"
                    placeholder="0"
                  />
                  <span className="text-xs text-slate-400 font-bold shrink-0">٪</span>
                </div>
              </div>
            </div>

            {/* Feedback Alert if any */}
            {feedback && (
              <div
                className={`mx-3 sm:mx-4 mt-2 p-2 rounded-xl text-xs flex items-center gap-2 shrink-0 ${
                  feedback.type === 'error'
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                <span className="text-xs">{feedback.message}</span>
              </div>
            )}

            {/* Main Catalog & Cart Layout (Matching Supermarket Experience Exactly) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px] gap-3 p-2 sm:p-4 overflow-hidden items-start">
              {/* Products Catalog Column (Scrollable) */}
              <div className="h-full overflow-y-auto pr-0.5 pb-20 lg:pb-4 min-w-0 no-scrollbar">
                <ProductCatalog
                  products={products}
                  cart={cart}
                  onChangeQuantity={handleSetQuantity}
                  onExceedLimit={handleExceedLimit}
                  priceMode={isSelfOrder ? 'visitor' : 'store'}
                  defaultInStockOnly={false}
                  storeId={currentSupermarket?.id}
                />
              </div>

              {/* Desktop Sticky Cart Sheet (lg:block) */}
              <div className="hidden lg:block h-full max-h-[calc(92vh-9rem)] overflow-hidden">
                <CartSheet
                  isOpen={true}
                  isMobileModal={false}
                  onClose={() => {}}
                  cart={cart}
                  products={products}
                  onUpdateQuantity={handleSetQuantity}
                  onClearCart={handleClearCart}
                  onSubmitOrder={handleSubmit}
                  isSubmitting={isSubmitting}
                  errorMessage={feedback?.type === 'error' ? feedback.message : null}
                  onExceedLimit={handleExceedLimit}
                />
              </div>
            </div>

            {/* Mobile Sticky Cart Bar at the bottom */}
            <CartBar
              itemCount={totalItemCount}
              totalAmount={cartTotalAmount}
              onOpenCart={() => setIsMobileCartOpen(true)}
            />

            {/* Mobile Cart Sheet (Drawer Modal) */}
            <CartSheet
              isOpen={isMobileCartOpen}
              isMobileModal={true}
              onClose={() => setIsMobileCartOpen(false)}
              cart={cart}
              products={products}
              onUpdateQuantity={handleSetQuantity}
              onClearCart={handleClearCart}
              onSubmitOrder={handleSubmit}
              isSubmitting={isSubmitting}
              errorMessage={feedback?.type === 'error' ? feedback.message : null}
              onExceedLimit={handleExceedLimit}
            />
          </div>
        )}
      </div>

      {/* Official B2B Order Invoice Modal with PDF & Print */}
      <OrderInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        order={createdOrder}
        supermarket={currentSupermarket}
        visitor={currentVisitor}
      />
    </div>
  );
};
