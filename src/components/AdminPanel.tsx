import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Product, OrderStatus } from '../types';
import {
  ShoppingBag,
  TrendingUp,
  Boxes,
  Users,
  Search,
  Plus,
  Edit2,
  Check,
  X,
  History,
  FileSpreadsheet,
  AlertCircle,
  Truck,
  CheckCircle,
  Clock,
  ArrowRightLeft,
  UserPlus,
  Tag,
  Layers,
  Trash2,
  Pencil,
} from 'lucide-react';
import { SupermarketRegisterModal } from './SupermarketRegisterModal';
import { CategorySelectPicker, BrandSelectPicker } from './CategoryBrandSelectors';

export const AdminPanel: React.FC = () => {
  const {
    products,
    categories,
    brands,
    orders,
    visitors,
    supermarkets,
    inventoryTransactions,
    priceHistories,
    updateProductPrice,
    addNewProduct,
    deleteProduct,
    updateOrderStatus,
    requestReassignment,
    updateCategory,
    updateBrand,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'visitors' | 'transactions' | 'pricing'>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRegisterStoreModalOpen, setIsRegisterStoreModalOpen] = useState(false);
  const [reassigningOrderId, setReassigningOrderId] = useState<string | null>(null);
  const [selectedNewVisitor, setSelectedNewVisitor] = useState<string>('');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteProductFeedback, setDeleteProductFeedback] = useState<string | null>(null);

  // Category and Brand Quick Edit state
  const [editingCategoryModal, setEditingCategoryModal] = useState<{ id: string; name: string } | null>(null);
  const [newCatNameInput, setNewCatNameInput] = useState('');
  const [editingBrandModal, setEditingBrandModal] = useState<string | null>(null);
  const [newBrandNameInput, setNewBrandNameInput] = useState('');
  const [catBrandFeedback, setCatBrandFeedback] = useState<string | null>(null);

  // New product form state
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('میهن');
  const [newProdCat, setNewProdCat] = useState('cat-1');
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [newProdStock, setNewProdStock] = useState(0);
  const [newProdUnit, setNewProdUnit] = useState('عدد');

  // KPI Calculations
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== 'undelivered' ? o.total_amount : 0), 0);
  const totalPhysicalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalReservedStock = products.reduce((sum, p) => sum + p.reserved_stock, 0);
  const deliveredOrders = orders.filter((o) => o.status === 'delivered').length;

  const handleSavePrice = (productId: string) => {
    if (tempPrice > 0) {
      updateProductPrice(productId, tempPrice);
    }
    setEditingPriceId(null);
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

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || newProdPrice <= 0) return;

    addNewProduct({
      name: newProdName.trim(),
      brand: newProdBrand.trim() || 'متفرقه',
      category_id: newProdCat,
      price: newProdPrice,
      stock: newProdStock,
      unit: newProdUnit,
      image_url: getSampleImage(newProdCat),
      is_active: true,
    });

    setIsAddModalOpen(false);
    setNewProdName('');
    setNewProdBrand('میهن');
    setNewProdPrice(0);
    setNewProdStock(0);
  };

  const handleReassignSubmit = (orderId: string) => {
    if (!selectedNewVisitor) return;
    requestReassignment(orderId, selectedNewVisitor);
    setReassigningOrderId(null);
    setSelectedNewVisitor('');
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">گردش فروش کل سفارشات</p>
            <p className="text-xl font-bold text-slate-100 mt-1">
              {totalRevenue.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-400">تومان</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">تعداد سفارشات فعال / تحویل شده</p>
            <p className="text-xl font-bold text-slate-100 mt-1">
              {orders.length.toLocaleString('fa-IR')} <span className="text-xs text-emerald-400">({deliveredOrders} تحویل شده)</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">موجودی فیزیکی کل / رزرو شده</p>
            <p className="text-xl font-bold text-slate-100 mt-1">
              {totalPhysicalStock.toLocaleString('fa-IR')} <span className="text-xs text-amber-400">({totalReservedStock} رزرو)</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">تیم پخش و سوپرمارکت‌ها</p>
            <p className="text-xl font-bold text-slate-100 mt-1">
              {visitors.length} ویزیتور <span className="text-xs text-slate-400">/ {supermarkets.length} فروشگاه</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            مدیریت سفارشات ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'products'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            کالاها، قیمت و موجودی ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('visitors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'visitors'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            ویزیتورها و مشتریان
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'transactions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            دفتر تراکنش‌های انبار ({inventoryTransactions.length})
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'pricing'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            تاریخچه قیمت‌گذاری ({priceHistories.length})
          </button>
        </div>
      </div>

      {/* Tab Content: ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-200">سفارشات ثبت شده در سامانه پخش</h2>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی فروشگاه یا شماره سفارش..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">شماره سفارش</th>
                  <th className="p-3">سوپرمارکت</th>
                  <th className="p-3">ویزیتور تخصیص‌یافته</th>
                  <th className="p-3">مبلغ کل (تومان)</th>
                  <th className="p-3">تاریخ ثبت</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders
                  .filter((o) => {
                    if (!searchTerm.trim()) return true;
                    const term = searchTerm.toLowerCase().trim();
                    return (
                      o.id.toLowerCase().includes(term) ||
                      o.supermarket_name.toLowerCase().includes(term) ||
                      o.visitor_name.toLowerCase().includes(term)
                    );
                  })
                  .map((order) => {
                    const statusConfig = {
                      assigned: { label: 'تخصیص یافته', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                      delegated: { label: 'در حال واگذاری', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                      delivered: { label: 'تحویل داده شد', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                      undelivered: { label: 'عدم تحویل', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                    }[order.status];

                    return (
                      <tr key={order.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold text-blue-400">{order.id}</td>
                        <td className="p-3 font-medium text-slate-200">{order.supermarket_name}</td>
                        <td className="p-3 text-slate-300 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-500" />
                          <span>{order.visitor_name}</span>
                        </td>
                        <td className="p-3 font-bold text-slate-200">
                          {order.total_amount.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3 text-slate-400">{order.order_date}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusConfig.bg}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {order.status === 'assigned' && (
                              <button
                                onClick={() => setReassigningOrderId(order.id)}
                                title="انتقال سفارش به ویزیتور دیگر"
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] flex items-center gap-1"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                                <span>انتقال ویزیتور</span>
                              </button>
                            )}
                            {order.status !== 'delivered' && (
                              <button
                                onClick={() => updateOrderStatus(order.id, 'delivered')}
                                title="ثبت تحویل موفق"
                                className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>تایید تحویل</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: PRODUCTS & PRICING */}
      {activeTab === 'products' && (
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-200">فهرست کالاها و مدیریت موجودی انبار</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  موجودی قابل سفارش = موجودی فیزیکی منهای موجودی رزرو شده
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>تعریف کالای جدید</span>
                </button>
                <div className="relative w-56 sm:w-64">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="جستجوی کالا یا برند..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Dual Filter Controls: Categories & Brands */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
                <div className="flex items-center gap-1 text-slate-400 pl-1 shrink-0 font-medium">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>دسته‌بندی:</span>
                </div>
                <button
                  onClick={() => setSelectedCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    selectedCategoryFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  همه دسته‌ها
                </button>
                {categories.map((c) => (
                  <div key={c.id} className="inline-flex items-center shrink-0">
                    <div
                      className={`inline-flex items-center gap-1 rounded-lg text-xs font-medium whitespace-nowrap transition border ${
                        selectedCategoryFilter === c.id
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryFilter(c.id)}
                        className="px-2.5 py-1 cursor-pointer"
                      >
                        {c.name}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategoryModal(c);
                          setNewCatNameInput(c.name);
                          setCatBrandFeedback(null);
                        }}
                        title={`ویرایش نام دسته‌بندی «${c.name}»`}
                        className={`p-1 pl-1.5 rounded-l-lg transition cursor-pointer ${
                          selectedCategoryFilter === c.id
                            ? 'text-white/80 hover:text-white hover:bg-blue-700'
                            : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800'
                        }`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Brand Filter Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                <div className="flex items-center gap-1 text-slate-400 font-medium shrink-0">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>فیلتر برند:</span>
                </div>
                <div className="flex items-center gap-1">
                  <select
                    value={selectedBrandFilter}
                    onChange={(e) => setSelectedBrandFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="all">همه برندها ({brands.length})</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>
                        برند {brand}
                      </option>
                    ))}
                  </select>
                  {selectedBrandFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBrandModal(selectedBrandFilter);
                        setNewBrandNameInput(selectedBrandFilter);
                        setCatBrandFeedback(null);
                      }}
                      title={`ویرایش نام برند «${selectedBrandFilter}»`}
                      className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition cursor-pointer shrink-0 shadow-sm"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">کالا</th>
                  <th className="p-3">دسته‌بندی</th>
                  <th className="p-3">برند</th>
                  <th className="p-3">قیمت واحد (تومان)</th>
                  <th className="p-3">موجودی فیزیکی</th>
                  <th className="p-3">رزرو شده</th>
                  <th className="p-3">موجودی آزاد</th>
                  <th className="p-3">واحد</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3 text-center">عملیات کالا</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products
                  .filter((p) => {
                    const term = searchTerm.toLowerCase().trim();
                    const matchSearch =
                      !term ||
                      p.name.toLowerCase().includes(term) ||
                      (p.brand && p.brand.toLowerCase().includes(term));
                    const matchCategory =
                      selectedCategoryFilter === 'all' || p.category_id === selectedCategoryFilter;
                    const matchBrand =
                      selectedBrandFilter === 'all' || p.brand === selectedBrandFilter;
                    return matchSearch && matchCategory && matchBrand;
                  })
                  .map((product) => {
                    const freeStock = product.stock - product.reserved_stock;
                    const isEditing = editingPriceId === product.id;
                    const categoryObj = categories.find((c) => c.id === product.category_id);

                    return (
                      <tr key={product.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 flex items-center gap-2">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                          <span className="font-semibold text-slate-200">{product.name}</span>
                        </td>
                        <td className="p-3 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                            {categoryObj?.name || 'عمومی'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-semibold">
                            {product.brand || 'متفرقه'}
                          </span>
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={tempPrice}
                                onChange={(e) => setTempPrice(Number(e.target.value))}
                                className="w-24 px-2 py-1 bg-slate-950 border border-blue-500 rounded text-xs text-white"
                              />
                              <button
                                onClick={() => handleSavePrice(product.id)}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingPriceId(null)}
                                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-100">
                              {product.price.toLocaleString('fa-IR')}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-slate-200">{product.stock.toLocaleString('fa-IR')}</td>
                        <td className="p-3 font-semibold text-amber-400">
                          {product.reserved_stock.toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-bold ${
                              freeStock > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {freeStock.toLocaleString('fa-IR')}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{product.unit}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              product.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500 border-slate-700'
                            }`}
                          >
                            {product.is_active ? 'فعال' : 'غیرفعال'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isEditing && (
                              <button
                                onClick={() => {
                                  setEditingPriceId(product.id);
                                  setTempPrice(product.price);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                                title="تغییر رسمی قیمت با ثبت در تاریخچه"
                              >
                                <Edit2 className="w-3 h-3 text-blue-400" />
                                <span className="text-[10px]">تغییر نرخ</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setDeleteProductFeedback(null);
                                setProductToDelete(product);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                              title="حذف کالا از سامانه"
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
        </div>
      )}

      {/* Tab Content: VISITORS & STORES */}
      {activeTab === 'visitors' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
            <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-400" />
              <span>فهرست ویزیتورها و مناطق توزیع</span>
            </h2>
            <div className="space-y-3">
              {visitors.map((visitor) => {
                const assignedCount = supermarkets.filter((s) => s.assigned_visitor_id === visitor.id).length;
                const visitorOrders = orders.filter((o) => o.assigned_visitor_id === visitor.id);
                return (
                  <div key={visitor.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-200 text-xs">{visitor.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{visitor.region}</p>
                      <p className="text-[11px] text-slate-500">{visitor.phone}</p>
                    </div>
                    <div className="text-left">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-blue-950/70 border border-blue-800 text-blue-300 text-xs font-medium">
                        {assignedCount} فروشگاه تحت پوشش
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1">{visitorOrders.length} سفارش جاری</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>فهرست سوپرمارکت‌های طرف قرارداد ({supermarkets.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsRegisterStoreModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>افزودن فروشگاه</span>
              </button>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {supermarkets.map((shop) => {
                const visitor = visitors.find((v) => v.id === shop.assigned_visitor_id);
                return (
                  <div key={shop.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-200 text-xs">{shop.name}</p>
                      <span className="text-[11px] text-slate-400">مالک: {shop.owner}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{shop.address}</p>
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">شماره تماس: {shop.phone}</span>
                      <span className="text-blue-400">ویزیتور: {visitor?.name || 'تعیین نشده'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: INVENTORY TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-200">دفتر کل تراکنش‌های ورود و خروج انبار</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ثبت دوبل رزرو سفارش، خروج فیزیکی با برگه بارگیری و تعدیل دستی موجودی
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">کد کالا / نام کالا</th>
                  <th className="p-3">نوع عملیات</th>
                  <th className="p-3">تعداد تغییر یافته</th>
                  <th className="p-3">سند مرجع / حواله</th>
                  <th className="p-3">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {inventoryTransactions.map((tx) => {
                  const txTypeMap = {
                    reserve: { label: 'رزرو سفارش جدید', color: 'text-amber-400' },
                    release_reserve: { label: 'آزادسازی رزرو (تحویل)', color: 'text-blue-400' },
                    load_out: { label: 'خروج فیزیکی از سردخانه', color: 'text-rose-400' },
                    return: { label: 'مرجوعی کالا به انبار', color: 'text-emerald-400' },
                    manual_adjustment: { label: 'ورود بار به انبار', color: 'text-teal-400' },
                  }[tx.transaction_type];

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-medium text-slate-200">{tx.product_name || tx.product_id}</td>
                      <td className="p-3">
                        <span className={`font-semibold ${txTypeMap?.color}`}>{txTypeMap?.label}</span>
                      </td>
                      <td className="p-3 font-bold text-slate-100">
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </td>
                      <td className="p-3 text-slate-400">{tx.reference_id}</td>
                      <td className="p-3 text-slate-400">{tx.created_at}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: PRICING AUDIT */}
      {activeTab === 'pricing' && (
        <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-200">تاریخچه تغییرات رسمی نرخ کالاها</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              مبنای ثبت فاکتورها، نرخ مصوب در لحظه ثبت سفارش است
            </p>
          </div>
          {priceHistories.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              هنوز تغییری در قیمت‌های پایه ثبت نشده است.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">کد کالا</th>
                    <th className="p-3">نرخ قبلی (تومان)</th>
                    <th className="p-3">نرخ جدید (تومان)</th>
                    <th className="p-3">ثبت کننده</th>
                    <th className="p-3">زمان تغییر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {priceHistories.map((hist) => {
                    const prod = products.find((p) => p.id === hist.product_id);
                    return (
                      <tr key={hist.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-200">{prod?.name || hist.product_id}</td>
                        <td className="p-3 text-slate-400 line-through">{hist.old_price.toLocaleString('fa-IR')}</td>
                        <td className="p-3 font-bold text-emerald-400">{hist.new_price.toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-slate-300">{hist.changed_by}</td>
                        <td className="p-3 text-slate-400">{hist.changed_at}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add New Product */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100">تعریف کالای جدید در سامانه</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">نام کالا</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="مثال: بستنی مگنوم شکلاتی"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <CategorySelectPicker
                  selectedCategoryId={newProdCat}
                  onSelectCategory={setNewProdCat}
                />
                <BrandSelectPicker
                  selectedBrand={newProdBrand}
                  onSelectBrand={setNewProdBrand}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">قیمت فروش (تومان)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    value={newProdPrice || ''}
                    onChange={(e) => setNewProdPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="مثال: 35000"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">واحد سنجش</label>
                  <select
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="عدد">عدد</option>
                    <option value="باکس">باکس</option>
                    <option value="بسته">بسته</option>
                    <option value="کیلوگرم">کیلوگرم</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">موجودی اولیه فیزیکی سردخانه</label>
                <input
                  type="number"
                  min="0"
                  value={newProdStock || ''}
                  onChange={(e) => setNewProdStock(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  ذخیره کالا
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reassign Order */}
      {reassigningOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-bold text-sm text-slate-100 mb-2">انتقال سفارش {reassigningOrderId}</h3>
            <p className="text-xs text-slate-400 mb-3">ویزیتور جدید برای تحویل این سفارش را انتخاب کنید:</p>
            <select
              value={selectedNewVisitor}
              onChange={(e) => setSelectedNewVisitor(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 mb-4 focus:outline-none focus:border-blue-500"
            >
              <option value="">انتخاب ویزیتور مقصد...</option>
              {visitors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.region})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setReassigningOrderId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                انصراف
              </button>
              <button
                disabled={!selectedNewVisitor}
                onClick={() => handleReassignSubmit(reassigningOrderId)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 disabled:opacity-50 text-white font-medium hover:bg-blue-500"
              >
                تایید انتقال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Register New Supermarket */}
      <SupermarketRegisterModal
        isOpen={isRegisterStoreModalOpen}
        onClose={() => setIsRegisterStoreModalOpen(false)}
      />

      {/* Modal: Confirm Delete Product */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">تأیید حذف کالا</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  آیا از حذف کالای «<strong className="text-white">{productToDelete.name}</strong>» مطمئن هستید؟
                </p>
              </div>
            </div>

            {deleteProductFeedback && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                {deleteProductFeedback}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setProductToDelete(null);
                  setDeleteProductFeedback(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteProduct(productToDelete.id);
                  if (res.success) {
                    setProductToDelete(null);
                    setDeleteProductFeedback(null);
                  } else {
                    setDeleteProductFeedback(res.message);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer shadow-lg shadow-rose-600/30"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal for Editing Category */}
      {editingCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Pencil className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-100">ویرایش نام دسته‌بندی</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategoryModal(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {catBrandFeedback && (
              <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                {catBrandFeedback}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCatNameInput.trim()) return;
                const res = updateCategory(editingCategoryModal.id, newCatNameInput.trim());
                if (res.success) {
                  setEditingCategoryModal(null);
                  setCatBrandFeedback(null);
                } else {
                  setCatBrandFeedback(res.message);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 mb-1 font-medium">عنوان دسته‌بندی:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCatNameInput}
                  onChange={(e) => setNewCatNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="نام دسته‌بندی..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCategoryModal(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Editing Brand */}
      {editingBrandModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Pencil className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-100">ویرایش نام برند</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingBrandModal(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {catBrandFeedback && (
              <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                {catBrandFeedback}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newBrandNameInput.trim()) return;
                const res = updateBrand(editingBrandModal, newBrandNameInput.trim());
                if (res.success) {
                  if (selectedBrandFilter === editingBrandModal) {
                    setSelectedBrandFilter(newBrandNameInput.trim());
                  }
                  setEditingBrandModal(null);
                  setCatBrandFeedback(null);
                } else {
                  setCatBrandFeedback(res.message);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 mb-1 font-medium">نام برند / کارخانه:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newBrandNameInput}
                  onChange={(e) => setNewBrandNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  placeholder="نام برند..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBrandModal(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer shadow-lg shadow-amber-500/30 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
