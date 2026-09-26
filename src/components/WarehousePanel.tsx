import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Warehouse,
  FileCheck,
  CheckCircle2,
  Plus,
  History,
  AlertTriangle,
  Boxes,
  Sparkles,
  FileSpreadsheet,
  Upload,
  Download,
} from 'lucide-react';
import { PendingBillCard } from './warehouse/PendingBillCard';
import { BillHistoryList } from './warehouse/BillHistoryList';
import { RestockForm } from './warehouse/RestockForm';
import { LowStockList } from './warehouse/LowStockList';
import { NewProductModal } from './warehouse/NewProductModal';
import { ExcelImportModal } from './admin/ExcelImportModal';
import { ExcelExportModal } from './admin/ExcelExportModal';
import { LOW_STOCK_THRESHOLD, formatNumber } from './warehouse/helpers';

export type WarehouseTabKey = 'pending' | 'history';

interface WarehousePanelProps {
  activeTab?: WarehouseTabKey;
  onTabChange?: (tab: WarehouseTabKey) => void;
}

export const WarehousePanel: React.FC<WarehousePanelProps> = ({
  activeTab: externalTab,
  onTabChange,
}) => {
  const {
    products,
    categories,
    brands,
    loadingBills,
    approveLoadingBill,
    updateProductStock,
    addNewProduct,
    bulkUpsertProducts,
  } = useApp();

  const [internalTab, setInternalTab] = useState<WarehouseTabKey>('pending');
  const activeTab = onTabChange && externalTab ? externalTab : internalTab;

  const setActiveTab = (tab: WarehouseTabKey) => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };

  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isExcelExportOpen, setIsExcelExportOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Filter pending vs approved bills
  const pendingBills = useMemo(
    () => loadingBills.filter((b) => b.status === 'pending'),
    [loadingBills]
  );

  const approvedBills = useMemo(
    () => loadingBills.filter((b) => b.status === 'approved'),
    [loadingBills]
  );

  // Real KPI calculations (zero fake sensor data)
  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length,
    [products]
  );

  const handleApproveBill = (billId: string) => {
    approveLoadingBill(billId);
    setActionFeedback(`برگه بارگیری ${billId} تایید شد و اقلام به طور قطعی از موجودی سردخانه ترخیص شدند.`);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleRestockSubmit = (productId: string, amount: number) => {
    updateProductStock(productId, amount);
    const prod = products.find((p) => p.id === productId);
    setActionFeedback(`ورود ${formatNumber(amount)} واحد از ${prod?.name || 'کالا'} با موفقیت ثبت شد.`);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleCreateProduct = (data: {
    name: string;
    brand: string;
    category_id: string;
    price: number;
    visitor_price?: number;
    stock: number;
    unit: string;
    image_url: string;
  }) => {
    addNewProduct({
      name: data.name,
      brand: data.brand,
      category_id: data.category_id,
      price: data.price,
      visitor_price: data.visitor_price,
      stock: data.stock,
      unit: data.unit,
      image_url: data.image_url,
      is_active: true,
    });
    setActionFeedback(`کالای جدید «${data.name}» با موجودی ${formatNumber(data.stock)} ${data.unit} در سردخانه تعریف شد.`);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleBulkImportConfirm = (items: any[]) => {
    if (bulkUpsertProducts) {
      const result = bulkUpsertProducts(items);
      setActionFeedback(result.message);
      setTimeout(() => setActionFeedback(null), 6000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Operations Summary */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-l from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/90 shadow-xl shadow-indigo-950/20 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0 border border-indigo-400/20">
              <Warehouse className="w-6 h-6" />
            </div>
            <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-sm"></span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-100 tracking-tight">
                پایانه لجستیک و انبار سردخانه مرکزی
              </h2>
              <span className="hidden md:inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 shadow-inner">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>زنجیره سرد</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ترخیص حواله‌های خودروهای پخش مویرگی و کنترل موجودی فیزیکی
            </p>
          </div>
        </div>

        {/* Real KPI Metrics & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs shadow-inner">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
            <span className="text-slate-400">برگه‌ها:</span>
            <span className="font-black text-indigo-300 font-mono text-xs">
              {formatNumber(pendingBills.length)}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs shadow-inner">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <span className="text-slate-400">کم‌موجود:</span>
            <span className="font-black text-amber-300 font-mono text-xs">
              {formatNumber(lowStockCount)}
            </span>
          </div>

          {/* Excel Import & Export */}
          <button
            type="button"
            onClick={() => setIsExcelImportOpen(true)}
            className="px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="بارگذاری و تطبیق اکسل کالاها و قیمت‌ها"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">ورود با اکسل</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExcelExportOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="استخراج کاتالوگ و موجودی با اکسل"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">خروجی اکسل</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewProductModalOpen(true)}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/30 border border-indigo-400/30 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف کالای جدید</span>
          </button>
        </div>
      </div>

      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Loading Bills (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
            
            {/* Dedicated Tabs (Identical to Supermarket Portal style) */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span>برگه‌های در انتظار</span>
                <span
                  className={`w-5 h-5 rounded-full font-extrabold text-xs flex items-center justify-center font-mono ${
                    activeTab === 'pending'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {formatNumber(pendingBills.length)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <History className="w-4 h-4" />
                <span>تاریخچه ترخیص</span>
                <span
                  className={`w-5 h-5 rounded-full font-extrabold text-xs flex items-center justify-center font-mono ${
                    activeTab === 'history'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {formatNumber(approvedBills.length)}
                </span>
              </button>
            </div>

            {/* Sub-Tab 1: Pending Bills Cards */}
            {activeTab === 'pending' && (
              <div className="space-y-3.5">
                {pendingBills.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                    <FileCheck className="w-8 h-8 text-slate-600 mx-auto" />
                    <p>در حال حاضر هیچ برگه بارگیری در انتظار تایید وجود ندارد.</p>
                    <p className="text-slate-600">
                      ویزیتورها پس از جمع‌آوری سفارش‌های روزانه، حواله جدید صادر خواهند کرد.
                    </p>
                  </div>
                ) : (
                  pendingBills.map((bill) => (
                    <PendingBillCard
                      key={bill.id}
                      bill={bill}
                      products={products}
                      onApprove={handleApproveBill}
                    />
                  ))
                )}
              </div>
            )}

            {/* Sub-Tab 2: Approved History (Accordion) */}
            {activeTab === 'history' && (
              <BillHistoryList approvedBills={approvedBills} />
            )}
          </div>
        </div>

        {/* Right Column: Restock Entry Form & Low Stock Monitoring */}
        <div className="space-y-5">
          {/* Quick Restock Inbound Form */}
          <RestockForm
            products={products}
            onRestockSubmit={handleRestockSubmit}
            onOpenNewProductModal={() => setIsNewProductModalOpen(true)}
          />

          {/* Low Stock Live Monitor */}
          <LowStockList products={products} />
        </div>
      </div>

      {/* Modal: Define New Product in Warehouse */}
      <NewProductModal
        isOpen={isNewProductModalOpen}
        categories={categories}
        brands={brands}
        onClose={() => setIsNewProductModalOpen(false)}
        onSubmit={handleCreateProduct}
      />

      {/* Modal: Excel Import & Column Matching */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        categories={categories}
        existingProducts={products}
        onImportConfirm={handleBulkImportConfirm}
      />

      {/* Modal: Excel Export with Category & Brand Filters */}
      <ExcelExportModal
        isOpen={isExcelExportOpen}
        onClose={() => setIsExcelExportOpen(false)}
        products={products}
        categories={categories}
        brands={brands}
      />
    </div>
  );
};
