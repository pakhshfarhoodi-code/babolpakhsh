import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { OverviewTab } from './admin/OverviewTab';
import { OrdersTab } from './admin/OrdersTab';
import { ProductsTab } from './admin/ProductsTab';
import { TeamTab } from './admin/TeamTab';
import { ReportsTab } from './admin/ReportsTab';
import { LOW_STOCK_THRESHOLD, isStoreInactiveFor30Days } from './admin/helpers';
import {
  AlertTriangle,
  ShoppingBag,
  Tag,
  Users,
  BarChart3,
  Pencil,
  X,
  Check,
} from 'lucide-react';

export type AdminTabKey = 'overview' | 'orders' | 'products' | 'team' | 'reports';

interface AdminPanelProps {
  activeTab?: AdminTabKey;
  onTabChange?: (tab: AdminTabKey) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  activeTab: externalTab,
  onTabChange,
}) => {
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

  const [internalTab, setInternalTab] = useState<AdminTabKey>('overview');
  const activeTab = onTabChange && externalTab ? externalTab : internalTab;

  const setActiveTab = (tab: AdminTabKey) => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };

  // Passing filter hints to sub-tabs
  const [ordersStatusFilterHint, setOrdersStatusFilterHint] = useState<string>('all');
  const [productsFilterHint, setProductsFilterHint] = useState<'lowStock' | 'all'>('all');

  // Category and Brand Quick Edit state
  const [editingCategoryModal, setEditingCategoryModal] = useState<{ id: string; name: string } | null>(null);
  const [newCatNameInput, setNewCatNameInput] = useState('');
  const [editingBrandModal, setEditingBrandModal] = useState<string | null>(null);
  const [newBrandNameInput, setNewBrandNameInput] = useState('');
  const [catBrandFeedback, setCatBrandFeedback] = useState<string | null>(null);

  // Badge count for Overview Tab
  const actionItemsCount = useMemo(() => {
    const delegatedCount = orders.filter((o) => o.status === 'delegated').length;
    const lowStockCount = products.filter((p) => p.stock - p.reserved_stock < LOW_STOCK_THRESHOLD).length;
    const inactiveStoresCount = supermarkets.filter((s) => isStoreInactiveFor30Days(s.id, orders)).length;
    return delegatedCount + lowStockCount + inactiveStoresCount;
  }, [orders, products, supermarkets]);

  // Tab Navigation Handlers from Overview Cards
  const handleNavigateToOrders = (statusFilter = 'all') => {
    setOrdersStatusFilterHint(statusFilter);
    setActiveTab('orders');
  };

  const handleNavigateToProducts = (filterType: 'lowStock' | 'all' = 'all') => {
    setProductsFilterHint(filterType);
    setActiveTab('products');
  };

  const handleNavigateToTeam = () => {
    setActiveTab('team');
  };

  const navItems = [
    {
      id: 'overview' as const,
      label: 'نیازمند بررسی',
      icon: AlertTriangle,
      badge: actionItemsCount > 0 ? actionItemsCount : null,
      badgeColor: 'bg-amber-400 text-slate-950 font-black',
      activeStyle:
        'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 border-amber-400 font-bold',
      inactiveHover: 'hover:text-amber-300 hover:bg-slate-900',
    },
    {
      id: 'orders' as const,
      label: 'سفارش‌ها',
      icon: ShoppingBag,
      badge: orders.length,
      badgeColor: 'bg-slate-800 text-slate-300 font-semibold',
      activeStyle:
        'bg-blue-600 text-white shadow-md shadow-blue-600/30 border-blue-500 font-bold',
      inactiveHover: 'hover:text-blue-300 hover:bg-slate-900',
    },
    {
      id: 'products' as const,
      label: 'کالا و قیمت‌گذاری',
      icon: Tag,
      badge: products.length,
      badgeColor: 'bg-slate-800 text-slate-300 font-semibold',
      activeStyle:
        'bg-blue-600 text-white shadow-md shadow-blue-600/30 border-blue-500 font-bold',
      inactiveHover: 'hover:text-blue-300 hover:bg-slate-900',
    },
    {
      id: 'team' as const,
      label: 'تیم و مشتریان',
      icon: Users,
      badge: supermarkets.length,
      badgeColor: 'bg-slate-800 text-slate-300 font-semibold',
      activeStyle:
        'bg-blue-600 text-white shadow-md shadow-blue-600/30 border-blue-500 font-bold',
      inactiveHover: 'hover:text-blue-300 hover:bg-slate-900',
    },
    {
      id: 'reports' as const,
      label: 'گزارش‌ها و انبار',
      icon: BarChart3,
      badge: null,
      badgeColor: '',
      activeStyle:
        'bg-blue-600 text-white shadow-md shadow-blue-600/30 border-blue-500 font-bold',
      inactiveHover: 'hover:text-blue-300 hover:bg-slate-900',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Navigation Tabs (Identical to Supermarket Portal style) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'orders') setOrdersStatusFilterHint('all');
                if (item.id === 'products') setProductsFilterHint('all');
                setActiveTab(item.id);
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? item.id === 'overview'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge !== null && item.badge !== undefined && (
                <span
                  className={`w-5 h-5 rounded-full font-extrabold text-xs flex items-center justify-center font-mono ${
                    isActive
                      ? item.id === 'overview'
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-white/20 text-white'
                      : item.id === 'overview'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <OverviewTab
          orders={orders}
          products={products}
          supermarkets={supermarkets}
          onNavigateToOrders={handleNavigateToOrders}
          onNavigateToProducts={handleNavigateToProducts}
          onNavigateToTeam={handleNavigateToTeam}
        />
      )}

      {/* Tab 2: Orders */}
      {activeTab === 'orders' && (
        <OrdersTab
          orders={orders}
          visitors={visitors}
          initialStatusFilter={ordersStatusFilterHint}
          onUpdateOrderStatus={updateOrderStatus}
          onRequestReassignment={requestReassignment}
        />
      )}

      {/* Tab 3: Products */}
      {activeTab === 'products' && (
        <ProductsTab
          products={products}
          categories={categories}
          brands={brands}
          priceHistories={priceHistories}
          initialFilterType={productsFilterHint}
          onUpdateProductPrice={updateProductPrice}
          onAddNewProduct={addNewProduct}
          onDeleteProduct={deleteProduct}
          onOpenEditCategory={(cat) => {
            setEditingCategoryModal(cat);
            setNewCatNameInput(cat.name);
            setCatBrandFeedback(null);
          }}
          onOpenEditBrand={(brand) => {
            setEditingBrandModal(brand);
            setNewBrandNameInput(brand);
            setCatBrandFeedback(null);
          }}
        />
      )}

      {/* Tab 4: Team */}
      {activeTab === 'team' && (
        <TeamTab
          visitors={visitors}
          supermarkets={supermarkets}
          orders={orders}
        />
      )}

      {/* Tab 5: Reports */}
      {activeTab === 'reports' && (
        <ReportsTab
          inventoryTransactions={inventoryTransactions}
          orders={orders}
          products={products}
          categories={categories}
          visitors={visitors}
        />
      )}

      {/* Modal for Editing Category */}
      {editingCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
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
