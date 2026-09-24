import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Search,
  Plus,
  Minus,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Check,
  Store,
  MapPin,
} from 'lucide-react';

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
    supermarkets,
    visitors,
    createOrder,
  } = useApp();

  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string>(
    defaultSupermarketId || supermarkets[0]?.id || ''
  );
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Sync selectedSupermarketId if defaultSupermarketId changes
  useEffect(() => {
    if (defaultSupermarketId) {
      setSelectedSupermarketId(defaultSupermarketId);
    } else if (!selectedSupermarketId && supermarkets.length > 0) {
      setSelectedSupermarketId(supermarkets[0].id);
    }
  }, [defaultSupermarketId, supermarkets, isOpen]);

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

  if (!isOpen) return null;

  const currentSupermarket = supermarkets.find((s) => s.id === selectedSupermarketId);
  const currentVisitor = visitors.find((v) => v.id === (defaultVisitorId || currentSupermarket?.assigned_visitor_id));

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

  const filteredProducts = products.filter((p) => {
    if (!p.is_active) return false;
    if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) return false;
    if (searchTerm && !p.name.includes(searchTerm)) return false;
    return true;
  });

  const updateQuantity = (productId: string, delta: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const available = prod.stock - prod.reserved_stock;
    const currentQty = cart[productId] || 0;
    const newQty = Math.max(0, currentQty + delta);

    if (newQty > available) {
      setFeedback({
        type: 'error',
        message: `حداکثر موجودی قابل سفارش برای ${prod.name}، ${available} ${prod.unit} می‌باشد.`,
      });
      return;
    }

    setFeedback(null);
    setCart((prev) => {
      if (newQty === 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const cartItems = Object.entries(cart).map(([productId, quantity]) => {
    const prod = products.find((p) => p.id === productId)!;
    const qty = Number(quantity);
    return {
      productId,
      name: prod.name,
      price: prod.price,
      quantity: qty,
      unit: prod.unit,
      total: prod.price * qty,
    };
  });

  const cartTotalAmount = cartItems.reduce((sum, item) => sum + item.total, 0);
  const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = () => {
    if (!currentSupermarket || !currentVisitor) {
      setFeedback({ type: 'error', message: 'لطفاً سوپرمارکت و ویزیتور را مشخص کنید.' });
      return;
    }

    if (cartItems.length === 0) {
      setFeedback({ type: 'error', message: 'هیچ کالایی به سبد اضافه نشده است.' });
      return;
    }

    const res = createOrder({
      supermarketId: currentSupermarket.id,
      visitorId: currentVisitor.id,
      items: cartItems.map((c) => ({
        productId: c.productId,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
      })),
    });

    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setFeedback({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">ثبت سفارش جدید و تخصیص به ویزیتور</h2>
              <p className="text-[11px] text-slate-400">کالاهای انتخابی بلافاصله در سیستم سردخانه رزرو می‌شوند</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Store & Visitor Selector */}
        <div className="p-4 bg-slate-950/30 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Custom Searchable Customer Dropdown */}
          <div className="relative" ref={storeDropdownRef}>
            <label className="block text-slate-400 mb-1 font-medium">سوپرمارکت مقصد سفارش:</label>
            
            {/* Dropdown trigger button */}
            <button
              type="button"
              onClick={() => setIsStoreDropdownOpen((prev) => !prev)}
              className={`w-full bg-slate-900 border rounded-lg p-2 text-slate-200 flex items-center justify-between transition cursor-pointer text-right shadow-sm ${
                isStoreDropdownOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Store className="w-3 h-3" />
                </div>
                {currentSupermarket ? (
                  <div className="truncate">
                    <span className="font-bold text-slate-100">{currentSupermarket.name}</span>
                    <span className="text-slate-400 text-[11px] mr-1.5">({currentSupermarket.owner})</span>
                  </div>
                ) : (
                  <span className="text-slate-500">انتخاب سوپرمارکت مقصد...</span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                  isStoreDropdownOpen ? 'rotate-180 text-blue-400' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isStoreDropdownOpen && (
              <div className="absolute z-30 top-full mt-1.5 right-0 left-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* 1st Row: Search input box */}
                <div className="p-2 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-10">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={storeSearchTerm}
                      onChange={(e) => setStoreSearchTerm(e.target.value)}
                      placeholder="جستجوی نام فروشگاه یا مدیر مشتری..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pr-8 pl-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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

                {/* Customer items list */}
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/60 no-scrollbar">
                  {filteredSupermarkets.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      هیچ مشتری یا فروشگاهی با مشخصات «{storeSearchTerm}» یافت نشد.
                    </div>
                  ) : (
                    filteredSupermarkets.map((s) => {
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
                          className={`w-full p-2.5 text-right flex items-center justify-between gap-2 transition cursor-pointer text-xs ${
                            isSelected
                              ? 'bg-blue-600/15 text-blue-200'
                              : 'hover:bg-slate-800/80 text-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-100">{s.name}</span>
                              <span className="text-[11px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700/60">
                                {s.owner}
                              </span>
                            </div>
                            {s.address && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 truncate">
                                <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                <span className="truncate">{s.address}</span>
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/40">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">ویزیتور تخصیص‌یافته:</label>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-semibold flex items-center justify-between">
              <span>{currentVisitor?.name || 'ویزیتور عمومی'}</span>
              <span className="text-[10px] text-blue-400 px-2 py-0.5 rounded bg-blue-950 border border-blue-800">
                {currentVisitor?.region}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-4 mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              feedback.type === 'error'
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Body Split: Left Products Catalog, Right Cart Summary */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          {/* Products List (2 cols) */}
          <div className="lg:col-span-2 p-4 flex flex-col overflow-y-auto border-b lg:border-b-0 lg:border-l border-slate-800 space-y-3">
            {/* Search & Categories */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="جستجوی کالا..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full text-xs">
                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition ${
                    selectedCategoryId === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  همه دسته‌ها
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition ${
                      selectedCategoryId === c.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {filteredProducts.map((prod) => {
                const available = prod.stock - prod.reserved_stock;
                const qty = cart[prod.id] || 0;
                const isOutOfStock = available <= 0;

                return (
                  <div
                    key={prod.id}
                    className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                      qty > 0
                        ? 'bg-blue-950/20 border-blue-500/50'
                        : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        className="w-14 h-14 rounded-lg object-cover border border-slate-800 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs text-slate-100 truncate">{prod.name}</h4>
                        <p className="text-xs font-bold text-blue-400 mt-1">
                          {prod.price.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-400">تومان</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          موجودی قابل سفارش: <span className={available > 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>{available} {prod.unit}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">واحد: {prod.unit}</span>
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(prod.id, -1)}
                          disabled={qty === 0}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 flex items-center justify-center transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-100">{qty}</span>
                        <button
                          onClick={() => updateQuantity(prod.id, 1)}
                          disabled={isOutOfStock || qty >= available}
                          className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white flex items-center justify-center transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart Sidebar (1 col) */}
          <div className="p-4 bg-slate-950/40 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200">پیش‌فاکتور سفارش</span>
                <span className="text-xs text-blue-400 font-semibold">{totalItemCount} قلم کالا</span>
              </div>

              {cartItems.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  کالایی به سبد خرید اضافه نشده است.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div key={item.productId} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                        <span className="font-bold text-slate-300">{item.total.toLocaleString('fa-IR')} ت</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>
                          {item.quantity} {item.unit} × {item.price.toLocaleString('fa-IR')}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, -item.quantity)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">جمع کل فاکتور:</span>
                <span className="text-base font-bold text-emerald-400">
                  {cartTotalAmount.toLocaleString('fa-IR')} تومان
                </span>
              </div>

              <button
                disabled={cartItems.length === 0}
                onClick={handleSubmit}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>ثبت نهایی و رزرو در سردخانه</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
