import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Store,
  Phone,
  MapPin,
  Truck,
  Plus,
  Minus,
  ShoppingCart,
  CheckCircle2,
  Clock,
  PackageCheck,
  Search,
  AlertTriangle,
  Layers,
  Tag,
  X,
} from 'lucide-react';

export const SupermarketPortal: React.FC = () => {
  const {
    selectedSupermarketId,
    supermarkets,
    visitors,
    products,
    categories,
    orders,
    createOrder,
  } = useApp();

  const currentStore = supermarkets.find((s) => s.id === selectedSupermarketId) || supermarkets[0];
  const assignedVisitor = visitors.find((v) => v.id === currentStore.assigned_visitor_id);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Store's orders
  const storeOrders = orders.filter((o) => o.supermarket_id === currentStore.id);

  // Extract unique brands from active products
  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) {
        brandsSet.add(p.brand.trim());
      }
    });
    return Array.from(brandsSet);
  }, [products]);

  const filteredProducts = products.filter((p) => {
    if (!p.is_active) return false;
    if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) return false;
    if (selectedBrand !== 'all' && p.brand !== selectedBrand) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(term);
      const matchBrand = p.brand && p.brand.toLowerCase().includes(term);
      if (!matchName && !matchBrand) return false;
    }
    return true;
  });

  const updateQuantity = (productId: string, delta: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const available = prod.stock - prod.reserved_stock;
    const currentQty = cart[productId] || 0;
    const newQty = Math.max(0, currentQty + delta);

    if (newQty > available) {
      setNotification({
        type: 'error',
        message: `حداکثر موجودی قابل سفارش برای ${prod.name}، ${available} ${prod.unit} است.`,
      });
      return;
    }

    setNotification(null);
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

  const cartTotalAmount = cartItems.reduce((sum, i) => sum + i.total, 0);
  const totalItemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const handleCheckout = () => {
    if (cartItems.length === 0) return;

    const res = createOrder({
      supermarketId: currentStore.id,
      visitorId: assignedVisitor?.id || visitors[0].id,
      items: cartItems.map((c) => ({
        productId: c.productId,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
      })),
    });

    if (res.success) {
      setCart({});
      setNotification({ type: 'success', message: 'سفارش شما با موفقیت ثبت شد و به ویزیتور منطقه ارجاع گردید.' });
      setActiveTab('history');
    } else {
      setNotification({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Store Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-l from-slate-900 via-emerald-950/30 to-slate-900 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">{currentStore.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-900/80 text-emerald-300 border border-emerald-700/50">
                مدیریت: {currentStore.owner}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentStore.address}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {assignedVisitor && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">ویزیتور اختصاصی شما:</p>
                <p className="font-bold text-slate-200">{assignedVisitor.name}</p>
                <a href={`tel:${assignedVisitor.phone}`} className="text-blue-400 hover:text-blue-300 text-[11px] flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" />
                  <span>{assignedVisitor.phone}</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>کاتالوگ سفارش مستقیم از شرکت ({products.length} کالا)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>پیگیری فاکتورها و سوابق سفارشات ({storeOrders.length})</span>
        </button>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            notification.type === 'error'
              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Tab: CATALOG & CART */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Catalog (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Dual Filter Section: Search + Category Filter + Brand Filter */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-sm">
              {/* Search Bar & Active Count */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="جستجو در محصولات، برند، طعم..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-9 pl-8 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute left-2.5 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">
                    نمایش <strong className="text-emerald-400 font-bold">{filteredProducts.length}</strong> از {products.filter(p => p.is_active).length} کالا
                  </span>
                  {(selectedCategoryId !== 'all' || selectedBrand !== 'all' || searchTerm) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId('all');
                        setSelectedBrand('all');
                        setSearchTerm('');
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      حذف فیلترها
                    </button>
                  )}
                </div>
              </div>

              {/* Filter 1: Category Filter (به همین شکل فعلی) */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>فیلتر دسته‌بندی کالا:</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                      selectedCategoryId === 'all'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    همه دسته‌ها
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        selectedCategoryId === c.id
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter 2: Brand Filter (براساس برند محصولات) */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>فیلتر بر اساس برند محصولات:</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedBrand('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                      selectedBrand === 'all'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    همه برندها
                  </button>
                  {availableBrands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setSelectedBrand(brand)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        selectedBrand === brand
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-2">
                <p className="text-slate-300 font-semibold text-xs">کالایی با فیلترهای انتخابی یافت نشد.</p>
                <p className="text-[11px] text-slate-500">می‌توانید فیلتر دسته‌بندی یا برند را تغییر دهید یا دکمه حذف فیلترها را بزنید.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId('all');
                    setSelectedBrand('all');
                    setSearchTerm('');
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium cursor-pointer"
                >
                  نمایش همه محصولات
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredProducts.map((prod) => {
                  const available = prod.stock - prod.reserved_stock;
                  const qty = cart[prod.id] || 0;
                  const isOutOfStock = available <= 0;

                  return (
                    <div
                      key={prod.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition ${
                        qty > 0
                          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-800 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {prod.brand && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold">
                                {prod.brand}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {categories.find((c) => c.id === prod.category_id)?.name}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-100 line-clamp-2">{prod.name}</h4>
                          <p className="text-xs font-extrabold text-emerald-400 mt-1">
                            {prod.price.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-400">تومان</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            وضعیت موجودی: <span className={available > 0 ? 'text-slate-300 font-semibold' : 'text-rose-400 font-semibold'}>{available > 0 ? `${available} ${prod.unit}` : 'ناموجود'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">قیمت مصوب کارخانه</span>
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(prod.id, -1)}
                            disabled={qty === 0}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 flex items-center justify-center transition cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-slate-100">{qty}</span>
                          <button
                            onClick={() => updateQuantity(prod.id, 1)}
                            disabled={isOutOfStock || qty >= available}
                            className="w-6 h-6 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white flex items-center justify-center transition cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Sidebar (1 col) */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  <span>سبد سفارش سوپرمارکت</span>
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {totalItemCount} کالا
                </span>
              </div>

              {cartItems.length === 0 ? (
                <div className="py-14 text-center text-slate-500 text-xs">
                  سبد خرید شما خالی است. اقلام مورد نظر را اضافه کنید.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div key={item.productId} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                        <span className="font-bold text-emerald-400">{item.total.toLocaleString('fa-IR')} ت</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
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

            <div className="pt-4 border-t border-slate-800 space-y-3 mt-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>تعداد اقلام:</span>
                  <span className="font-semibold text-slate-200">{totalItemCount} عدد / بسته</span>
                </div>
                <div className="flex items-center justify-between text-slate-200 font-bold">
                  <span>مبلغ قابل پرداخت فاکتور:</span>
                  <span className="text-base text-emerald-400">{cartTotalAmount.toLocaleString('fa-IR')} تومان</span>
                </div>
              </div>

              <button
                disabled={cartItems.length === 0}
                onClick={handleCheckout}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ارسال مستقیم سفارش به ویزیتور</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: ORDER HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200">سوابق سفارشات و فاکتورهای فروشگاه</h3>
            <p className="text-xs text-slate-400 mt-0.5">وضعیت تحویل کالاهای زنجیره سرد به صورت لحظه‌ای</p>
          </div>

          <div className="divide-y divide-slate-800/80">
            {storeOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                هنوز سفارشی برای این سوپرمارکت ثبت نشده است.
              </div>
            ) : (
              storeOrders.map((order) => {
                const statusConfig = {
                  assigned: { label: 'در نوبت بارگیری و توزیع', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  delegated: { label: 'در مسیر انتقال به ویزیتور جایگزین', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  delivered: { label: 'تحویل داده شد و تسویه گردید', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  undelivered: { label: 'عدم تحویل (برگشت به سردخانه)', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                }[order.status];

                return (
                  <div key={order.id} className="p-4 hover:bg-slate-800/30 transition">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-400 text-sm">{order.id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusConfig.bg}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          تاریخ ثبت: {order.order_date} | ویزیتور تحویل‌دهنده: <span className="text-slate-300 font-semibold">{order.visitor_name}</span>
                        </p>
                      </div>

                      <div className="text-left">
                        <span className="text-base font-extrabold text-slate-100">
                          {order.total_amount.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-400">تومان</span>
                        </span>
                      </div>
                    </div>

                    {order.items && order.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap gap-2 text-xs">
                        {order.items.map((it) => (
                          <span key={it.id} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                            {it.name} - <span className="font-bold text-slate-100">{it.quantity} عدد</span> ({it.price.toLocaleString('fa-IR')} ت)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
