import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { OverviewTab } from './admin/OverviewTab';
import { OrdersTab } from './admin/OrdersTab';
import { LoadingBillsTab } from './admin/LoadingBillsTab';
import { ProductsTab } from './admin/ProductsTab';
import { TeamTab } from './admin/TeamTab';
import { ReportsTab } from './admin/ReportsTab';
import { InvoiceSettingsTab } from './admin/InvoiceSettingsTab';
import { FinancialAccountsTab } from './admin/FinancialAccountsTab';
import { LOW_STOCK_THRESHOLD, isStoreInactiveFor30Days } from './admin/helpers';
import {
  Building2,
  AlertTriangle,
  ShoppingBag,
  Tag,
  Users,
  BarChart3,
  Pencil,
  X,
  Check,
  FileText,
  Truck,
  FileSpreadsheet,
  Wallet,
  Settings,
} from 'lucide-react';
import { AdminProfileModal } from './AdminProfileModal';
import { AdminSettingsModal } from './admin/AdminSettingsModal';

export type AdminTabKey =
  | 'overview'
  | 'orders'
  | 'products'
  | 'team'
  | 'financial_accounts'
  | 'reports'
  | 'invoice_settings';

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
    loadingBills,
    inventoryTransactions,
    priceHistories,
    updateProductPrice,
    updateProduct,
    addNewProduct,
    bulkUpsertProducts,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpdateProducts,
    updateOrderStatus,
    requestReassignment,
    assignOrderVisitor,
    deleteOrder,
    updateCategory,
    updateBrand,
  } = useApp();

  const [internalTab, setInternalTab] = useState<AdminTabKey>('overview');
  const activeTab = onTabChange && externalTab ? externalTab : internalTab;

  const setActiveTab = (tab: AdminTabKey) => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };

  // Orders Segmented Control & Filter state
  const [ordersViewMode, setOrdersViewMode] = useState<'orders' | 'bills'>('orders');
  const [highlightedBillId, setHighlightedBillId] = useState<string | null>(null);
  const [billsStatusFilterHint, setBillsStatusFilterHint] = useState<string>('all');
  const [ordersStatusFilterHint, setOrdersStatusFilterHint] = useState<string>('all');
  const [productsFilterHint, setProductsFilterHint] = useState<'lowStock' | 'all'>('all');

  // Category and Brand Quick Edit state
  const [editingCategoryModal, setEditingCategoryModal] = useState<{ id: string; name: string } | null>(null);
  const [newCatNameInput, setNewCatNameInput] = useState('');
  const [editingBrandModal, setEditingBrandModal] = useState<string | null>(null);
  const [newBrandNameInput, setNewBrandNameInput] = useState('');
  const [catBrandFeedback, setCatBrandFeedback] = useState<string | null>(null);
  const [isAdminProfileModalOpen, setIsAdminProfileModalOpen] = useState(false);
  const [isAdminSettingsModalOpen, setIsAdminSettingsModalOpen] = useState(false);

  // Badge count for Overview Tab & Pending approvals
  const pendingApprovalsCount = useMemo(() => {
    return supermarkets.filter((s) => s.is_active === false).length;
  }, [supermarkets]);

  const pendingStoresCount = useMemo(() => {
    return supermarkets.filter((s) => s.approval_status === 'pending').length;
  }, [supermarkets]);

  const pendingBillsCount = useMemo(() => {
    return loadingBills.filter((b) => b.status === 'pending').length;
  }, [loadingBills]);

  const actionItemsCount = useMemo(() => {
    const delegatedCount = orders.filter((o) => o.status === 'delegated').length;
    const lowStockCount = products.filter((p) => (Math.round((p.stock - p.reserved_stock) * 1000) / 1000) < LOW_STOCK_THRESHOLD).length;
    const inactiveStoresCount = supermarkets.filter((s) => s.is_active !== false && isStoreInactiveFor30Days(s.id, orders)).length;
    return delegatedCount + lowStockCount + inactiveStoresCount + pendingBillsCount + pendingStoresCount;
  }, [orders, products, supermarkets, pendingBillsCount, pendingStoresCount]);

  // Tab Navigation Handlers from Overview Cards
  const handleNavigateToOrders = (statusFilter = 'all') => {
    setOrdersStatusFilterHint(statusFilter);
    setOrdersViewMode('orders');
    setHighlightedBillId(null);
    setActiveTab('orders');
  };

  const handleNavigateToLoadingBills = (statusFilter = 'pending', billId?: string) => {
    setBillsStatusFilterHint(statusFilter);
    setOrdersViewMode('bills');
    setHighlightedBillId(billId || null);
    setActiveTab('orders');
  };

  const handleNavigateToProducts = (filterType: 'lowStock' | 'all' = 'all') => {
    setProductsFilterHint(filterType);
    setActiveTab('products');
  };

  const [teamStoreFilterHint, setTeamStoreFilterHint] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');

  const handleNavigateToTeam = (statusFilter: string = 'all') => {
    setTeamStoreFilterHint((statusFilter as any) || 'all');
    setActiveTab('team');
  };

  const [selectedFinancialProfileId, setSelectedFinancialProfileId] = useState<string | null>(null);
  const [financialNavKey, setFinancialNavKey] = useState(0);

  const handleNavigateToFinancialAccount = (profileId: string) => {
    setSelectedFinancialProfileId(profileId);
    setFinancialNavKey((k) => k + 1);
    setActiveTab('financial_accounts');
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
      id: 'financial_accounts' as const,
      label: 'حساب‌های دفتری',
      icon: Wallet,
      badge: null,
      badgeColor: '',
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
    {
      id: 'invoice_settings' as const,
      label: 'تنظیمات فاکتور',
      icon: FileSpreadsheet,
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
              {item.id === 'orders' && pendingBillsCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full font-black text-[11px] bg-amber-400 text-slate-950 font-mono shadow-sm animate-pulse"
                  title={`${pendingBillsCount} فاکتور منتظر بررسی ادمین`}
                >
                  {pendingBillsCount}
                </span>
              )}
              {item.id === 'team' && pendingStoresCount > 0 && (
                <span
                  className="px-1.5 py-0.2 rounded-full font-black text-[11px] bg-amber-400 text-slate-950 font-mono shadow-sm animate-pulse"
                  title={`${pendingStoresCount} فروشگاه در انتظار تایید`}
                >
                  {pendingStoresCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAdminSettingsModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            title="تنظیمات کلی سامانه (تخفیف ۳ درصدی، تایید انبار و...)"
          >
            <Settings className="w-4 h-4 text-blue-400" />
            <span>تنظیمات سامانه</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAdminProfileModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            title="مشاهده و ویرایش مشخصات مدیریت و مرکز پخش"
          >
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>پروفایل مدیریت</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <OverviewTab
          orders={orders}
          products={products}
          supermarkets={supermarkets}
          loadingBills={loadingBills}
          onNavigateToOrders={handleNavigateToOrders}
          onNavigateToProducts={handleNavigateToProducts}
          onNavigateToTeam={handleNavigateToTeam}
          onNavigateToLoadingBills={handleNavigateToLoadingBills}
        />
      )}

      {/* Tab 2: Orders & Loading Bills */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Segmented Control for Orders vs Loading Bills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => {
                setOrdersViewMode('orders');
                setHighlightedBillId(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                ordersViewMode === 'orders'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>سفارش‌های فروشگاه‌ها</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-xs font-mono ${
                  ordersViewMode === 'orders' ? 'bg-white/20 text-white font-bold' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrdersViewMode('bills');
                setHighlightedBillId(null);
                setBillsStatusFilterHint('pending');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                ordersViewMode === 'bills'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>فاکتورهای ویزیتورها</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-xs font-mono ${
                  ordersViewMode === 'bills' ? 'bg-white/20 text-white font-bold' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {loadingBills.length}
              </span>
              {pendingBillsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 font-mono shadow-xs animate-pulse flex items-center gap-1">
                  <span>{pendingBillsCount}</span>
                  <span className="text-[10px] hidden xs:inline">در انتظار</span>
                </span>
              )}
            </button>
          </div>

          {/* Sub-view 1: OrdersTab */}
          {ordersViewMode === 'orders' && (
            <OrdersTab
              orders={orders}
              visitors={visitors}
              initialStatusFilter={ordersStatusFilterHint}
              onUpdateOrderStatus={updateOrderStatus}
              onRequestReassignment={requestReassignment}
              onAssignOrderVisitor={assignOrderVisitor}
              onDeleteOrder={deleteOrder}
              onOpenBill={(billId) => handleNavigateToLoadingBills('all', billId)}
            />
          )}

          {/* Sub-view 2: LoadingBillsTab */}
          {ordersViewMode === 'bills' && (
            <LoadingBillsTab
              initialBillId={highlightedBillId}
              initialStatusFilter={billsStatusFilterHint}
              onNavigateToOrder={(orderId) => {
                setOrdersViewMode('orders');
                setOrdersStatusFilterHint('all');
              }}
            />
          )}
        </div>
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
          onUpdateProduct={updateProduct}
          onAddNewProduct={addNewProduct}
          onBulkUpsertProducts={bulkUpsertProducts}
          onDeleteProduct={deleteProduct}
          onBulkDeleteProducts={bulkDeleteProducts}
          onBulkUpdateProducts={bulkUpdateProducts}
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
          initialStoreStatusFilter={teamStoreFilterHint}
          onNavigateToFinancialAccount={handleNavigateToFinancialAccount}
        />
      )}

      {/* Tab: Financial Accounts (حساب‌های دفتری) */}
      {activeTab === 'financial_accounts' && (
        <FinancialAccountsTab
          key={financialNavKey}
          initialProfileId={selectedFinancialProfileId}
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
          loadingBills={useApp().loadingBills}
        />
      )}

      {/* Tab 6: Invoice Settings */}
      {activeTab === 'invoice_settings' && (
        <InvoiceSettingsTab />
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

      {/* Admin Profile Modal */}
      {isAdminProfileModalOpen && (
        <AdminProfileModal
          isOpen={isAdminProfileModalOpen}
          onClose={() => setIsAdminProfileModalOpen(false)}
          initialEditMode={true}
        />
      )}

      {/* Admin Global Settings Modal (تخفیف ۳ درصدی، تایید انبار و...) */}
      <AdminSettingsModal
        isOpen={isAdminSettingsModalOpen}
        onClose={() => setIsAdminSettingsModalOpen(false)}
      />
    </div>
  );
};
