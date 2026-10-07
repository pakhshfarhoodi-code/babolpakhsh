import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  InvoiceSettings,
  InvoiceShowSettings,
  InvoiceLayoutSettings,
  InvoiceStyleSettings,
  InvoiceSectionKey,
  TableColumnKey,
  CentralPhone,
  DEFAULT_INVOICE_SETTINGS,
  DEFAULT_INVOICE_STYLE_SETTINGS,
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_TABLE_COLUMNS,
  getInvoiceSettings,
} from '../../types';
import { InvoiceDocument } from '../invoice/InvoiceDocument';
import {
  Building2,
  Phone,
  DollarSign,
  ChevronDown,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
  Save,
  RotateCcw,
  Store,
  Printer,
  Table,
  Sliders,
  MoveVertical,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Type,
  Percent,
  Box,
} from 'lucide-react';

// Resize & compress image in browser
function resizeImageToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('لطفاً یک فایل تصویری (PNG, JPG, WebP) انتخاب فرمایید.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 256;
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('خطا در ایجاد بوم پردازش تصویر.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let dataUri = canvas.toDataURL('image/webp', 0.85);
        if (dataUri.length > 150 * 1024 * 1.33) {
          dataUri = canvas.toDataURL('image/jpeg', 0.7);
        }
        resolve(dataUri);
      };
      img.onerror = () => reject(new Error('خطا در بارگذاری فایل تصویر.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('خطا در خواندن فایل تصویر.'));
    reader.readAsDataURL(file);
  });
}

const SECTION_LABELS: Record<InvoiceSectionKey, string> = {
  header: 'سربرگ و هویت برند',
  seller: 'مشخصات فروشنده (پخش مرکزی)',
  buyer: 'مشخصات خریدار (فروشگاه)',
  items_table: 'جدول اقلام سفارش',
  payment_info: 'اطلاعات و حساب بانکی',
  totals_summary: 'خلاصه محاسبات و جمع‌ها',
  terms: 'شرایط و توضیحات فاکتور',
  signatures: 'کادرهای امضا و تایید',
};

export const InvoiceSettingsTab: React.FC = () => {
  const { invoiceSettings, updateInvoiceSettings, showToast } = useApp();

  // Local form state
  const [form, setForm] = useState<InvoiceSettings>(() =>
    getInvoiceSettings(invoiceSettings)
  );

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview options
  const [previewSaleType, setPreviewSaleType] = useState<'direct' | 'visitor'>('direct');
  const [previewRowCount, setPreviewRowCount] = useState<6 | 11 | 19 | 30>(6);

  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    header: true,
    seller: true,
    visitor: false,
    buyer: false,
    table: true,
    totals: false,
    typography: true,
    layout: true,
    paper: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFieldChange = <K extends keyof InvoiceSettings>(
    field: K,
    value: InvoiceSettings[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleShowChange = <K extends keyof InvoiceShowSettings>(
    field: K,
    value: boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      show: {
        ...prev.show,
        [field]: value,
      },
    }));
  };

  const handleStyleChange = <K extends keyof InvoiceStyleSettings>(
    field: K,
    value: InvoiceStyleSettings[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        [field]: value,
      },
    }));
  };

  const handleLayoutFieldChange = <K extends keyof InvoiceLayoutSettings>(
    field: K,
    value: InvoiceLayoutSettings[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        [field]: value,
      },
    }));
  };

  const handleLayoutOrderChange = (index: number, direction: 'up' | 'down') => {
    setForm((prev) => {
      const order = [...prev.layout.section_order];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= order.length) return prev;
      const temp = order[index];
      order[index] = order[targetIndex];
      order[targetIndex] = temp;
      return {
        ...prev,
        layout: {
          ...prev.layout,
          section_order: order,
        },
      };
    });
  };

  const handleLayoutWidthToggle = (key: InvoiceSectionKey) => {
    setForm((prev) => {
      const current = prev.layout.section_widths[key] || 'full';
      const next = current === 'full' ? 'half' : 'full';
      return {
        ...prev,
        layout: {
          ...prev.layout,
          section_widths: {
            ...prev.layout.section_widths,
            [key]: next,
          },
        },
      };
    });
  };

  const handleLayoutAlignChange = (key: InvoiceSectionKey, align: 'right' | 'center' | 'left') => {
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        section_alignments: {
          ...prev.layout.section_alignments,
          [key]: align,
        },
      },
    }));
  };

  // Phone Management
  const handleAddPhone = () => {
    const newPhone: CentralPhone = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: 'دفتر',
      number: '',
      show_in_invoice: true,
    };
    setForm((prev) => ({
      ...prev,
      phones: [...prev.phones, newPhone],
    }));
  };

  const handleUpdatePhone = (id: string, updates: Partial<CentralPhone>) => {
    setForm((prev) => ({
      ...prev,
      phones: prev.phones.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  };

  const handleDeletePhone = (id: string) => {
    setForm((prev) => ({
      ...prev,
      phones: prev.phones.filter((p) => p.id !== id),
    }));
  };

  const handleMovePhone = (index: number, direction: 'up' | 'down') => {
    setForm((prev) => {
      const newPhones = [...prev.phones];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newPhones.length) return prev;
      const temp = newPhones[index];
      newPhones[index] = newPhones[targetIndex];
      newPhones[targetIndex] = temp;
      return { ...prev, phones: newPhones };
    });
  };

  // Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUri = await resizeImageToDataUri(file);
      handleFieldChange('logo_url', dataUri);
      showToast('لوگوی فاکتور با موفقیت بارگذاری شد.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در بارگذاری تصویر لوگو';
      showToast(msg, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    handleFieldChange('logo_url', '');
    showToast('لوگوی فاکتور حذف شد.', 'info');
  };

  const handleResetToDefaults = () => {
    if (window.confirm('آیا از بازنشانی کلیه تنظیمات فاکتور به مقادیر پیش‌فرض اطمینان دارید؟')) {
      setForm({ ...DEFAULT_INVOICE_SETTINGS });
      showToast('تنظیمات به حالت پیش‌فرض بازگردانده شد. برای اعمال دکمه ذخیره را بزنید.', 'info');
    }
  };

  const handleResetAppearance = () => {
    setForm((prev) => ({
      ...prev,
      style: { ...DEFAULT_INVOICE_STYLE_SETTINGS },
    }));
    showToast('ظاهر و استایل‌ها به حالت پیش‌فرض بازگردانده شد.', 'info');
  };

  const handleResetColumnWidths = () => {
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        column_widths: { ...DEFAULT_COLUMN_WIDTHS },
      },
    }));
    showToast('عرض ستون‌ها به حالت پیش‌فرض بازگردانده شد.', 'info');
  };

  const handleColumnOrderChange = (index: number, direction: 'up' | 'down') => {
    setForm((prev) => {
      const cols = [...(prev.table_columns || DEFAULT_TABLE_COLUMNS)];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= cols.length) return prev;
      const temp = cols[index];
      cols[index] = cols[targetIndex];
      cols[targetIndex] = temp;
      return { ...prev, table_columns: cols };
    });
  };

  const handleColumnLabelChange = (index: number, newLabel: string) => {
    setForm((prev) => {
      const cols = [...(prev.table_columns || DEFAULT_TABLE_COLUMNS)];
      cols[index] = { ...cols[index], label: newLabel };
      return { ...prev, table_columns: cols };
    });
  };

  const handleColumnVisibilityToggle = (index: number, visible: boolean) => {
    setForm((prev) => {
      const cols = [...(prev.table_columns || DEFAULT_TABLE_COLUMNS)];
      const targetCol = cols[index];
      cols[index] = { ...targetCol, visible };

      const colVisibilityKeyMap: Record<TableColumnKey, keyof InvoiceShowSettings> = {
        row_index: 'col_row_index',
        product_name: 'col_product_name',
        items_per_package: 'col_items_per_package',
        quantity_unit: 'col_quantity_unit',
        unit_price: 'col_unit_price',
        discount_percent: 'col_discount_percent',
        total_price: 'col_total_price',
      };

      const showKey = colVisibilityKeyMap[targetCol.key];
      return {
        ...prev,
        table_columns: cols,
        show: {
          ...prev.show,
          [showKey]: visible,
        },
      };
    });
  };

  const handleResetTableColumns = () => {
    setForm((prev) => ({
      ...prev,
      table_columns: DEFAULT_TABLE_COLUMNS.map((col) => ({ ...col })),
      show: {
        ...prev.show,
        col_row_index: true,
        col_product_name: true,
        col_items_per_package: true,
        col_quantity_unit: true,
        col_unit_price: true,
        col_discount_percent: false,
        col_total_price: true,
      },
    }));
    showToast('ترتیب و عناوین ستون‌های جدول به پیش‌فرض بازگشت.', 'info');
  };

  const handleColumnWidthChange = (columnKey: TableColumnKey, newWidth: number) => {
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        column_widths: {
          ...(prev.layout.column_widths || DEFAULT_COLUMN_WIDTHS),
          [columnKey]: newWidth,
        },
      },
    }));
  };

  const handleColumnWidthsBatchChange = (newWidths: Record<TableColumnKey, number>) => {
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        column_widths: newWidths,
      },
    }));
  };

  // Debounced settings state for buttery-smooth live preview (150ms)
  const [debouncedSettings, setDebouncedSettings] = useState<InvoiceSettings>(form);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSettings(form);
    }, 150);
    return () => clearTimeout(timer);
  }, [form]);

  const memoizedPreviewSettings = useMemo(() => debouncedSettings, [debouncedSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await updateInvoiceSettings(form);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ذخیره اطلاعات.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate mock order for live preview
  const generateMockItems = (count: number) => {
    const baseItems = [
      { product_id: 'm1', name: 'پنیر پیتزا مطهر ۲ کیلویی (رنده‌شده)', quantity: 4, unit: 'بسته', price: 345000, items_per_package: 6, discount_percent: 5 },
      { product_id: 'm2', name: 'سوسیس آلمانی ۸۰٪ گوشتیران', quantity: 6, unit: 'کیلوگرم', price: 198000, items_per_package: 10, discount_percent: 0 },
      { product_id: 'm3', name: 'خمیر پیراشکی ۹۵۹۵ (بسته ۱۲ عددی)', quantity: 10, unit: 'بسته', price: 42000, items_per_package: 24, discount_percent: 10 },
      { product_id: 'm4', name: 'همبرگر ممتاز ۹۰٪ مهیا پروتئین', quantity: 5, unit: 'بسته', price: 285000, items_per_package: 12, discount_percent: 0 },
      { product_id: 'm5', name: 'ناگت مرغ ۹۵۹۵ (بسته ۹۰۰ گرمی)', quantity: 8, unit: 'بسته', price: 175000, items_per_package: 10, discount_percent: 8 },
      { product_id: 'm6', name: 'پنیر گودا ورقه‌ای کاله ۲۵۰ گرمی', quantity: 12, unit: 'بسته', price: 89000, items_per_package: 20, discount_percent: 0 },
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      const base = baseItems[i % baseItems.length];
      result.push({
        id: `mock-item-${i + 1}`,
        order_id: 'mock-order-1',
        product_id: `mock-${i + 1}`,
        name: count > 6 ? `${base.name} (ردیف ${i + 1})` : base.name,
        quantity: base.quantity,
        unit: base.unit,
        price: base.price,
        items_per_package: base.items_per_package,
        discount_percent: base.discount_percent,
      });
    }
    return result;
  };

  const previewItems = generateMockItems(previewRowCount);
  const previewSubtotal = previewItems.reduce((acc, it) => acc + it.quantity * it.price, 0);

  const mockOrder = {
    id: previewSaleType === 'direct' ? 'SP01-1001-1' : 'VS04-2042-3',
    supermarket_id: 'sm-test-1',
    supermarket_name: 'هایپرمارکت بزرگ صدف',
    visitor_id: previewSaleType === 'visitor' ? 'v-test-1' : undefined,
    assigned_visitor_id: previewSaleType === 'visitor' ? 'v-test-1' : 'direct',
    visitor_name: previewSaleType === 'visitor' ? 'رضا کریمی' : undefined,
    status: 'delivered' as const,
    total_amount: previewSubtotal,
    created_at: new Date().toISOString(),
    order_date: new Date().toISOString(),
    items: previewItems,
  };

  const mockSupermarket = {
    id: 'sm-test-1',
    name: 'هایپرمارکت بزرگ صدف',
    owner: 'حاج محمد صادقی',
    phone: '۰۹۱۱۱۲۲۳۳۴۴',
    address: 'مازندران، بابل، میدان اوقاف، نبش کوچه صدف ۴',
    region: 'منطقه ۱ - مرکز شهر',
  };

  const mockVisitor = {
    id: 'v-test-1',
    name: 'رضا کریمی',
    phone: '۰۹۱۱۳۱۴۵۶۷۸',
    region: 'منطقه ۱',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-100">
              تنظیمات جامع، ابعاد و چیدمان فاکتور
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              تنظیم اندازه فونت‌ها و باکس‌ها، ستون تعداد در کارتن، تخفیف‌ها، کلیدهای فعال‌سازی و پیش‌نمایش زنده
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>پیش‌فرض</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Left / Live Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Settings Form Column */}
        <div className="lg:col-span-6 space-y-4">
          <form onSubmit={handleSave} className="space-y-4">
            {/* 1. Header & Identity */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('header')}
                className="w-full p-4 bg-slate-850 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-sm text-slate-200">۱. سربرگ و هویت برند</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openSections.header ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections.header && (
                <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
                  {/* Logo */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">لوگوی فاکتور</span>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <span>نمایش در فاکتور</span>
                        <input
                          type="checkbox"
                          checked={form.show.logo}
                          onChange={(e) => handleShowChange('logo', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </label>
                    </div>

                    <div className="flex items-center gap-4">
                      {form.logo_url ? (
                        <div className="relative group">
                          <img
                            src={form.logo_url}
                            alt="Logo"
                            className="w-16 h-16 object-contain rounded-lg border border-slate-700 bg-white p-1"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="absolute -top-2 -right-2 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow cursor-pointer"
                            title="حذف لوگو"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex-1 space-y-1.5">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          id="logo-upload-input"
                        />
                        <label
                          htmlFor="logo-upload-input"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>انتخاب تصویر لوگو</span>
                        </label>
                        <p className="text-[10.5px] text-slate-500">
                          فرمت‌های PNG، JPG و WebP (حداکثر ابعاد ۲۵۶ پیکسل)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Brand Name */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">نام تجاری / برند</label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <span>نمایش</span>
                        <input
                          type="checkbox"
                          checked={form.show.brand_name}
                          onChange={(e) => handleShowChange('brand_name', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={form.brand_name}
                      onChange={(e) => handleFieldChange('brand_name', e.target.value)}
                      placeholder="مثال: شبکه پخش عمده فرهودی"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Legal Name */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">نام رسمی / حقوقی شرکت</label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <span>نمایش</span>
                        <input
                          type="checkbox"
                          checked={form.show.seller_legal_name}
                          onChange={(e) => handleShowChange('seller_legal_name', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={form.legal_name}
                      onChange={(e) => handleFieldChange('legal_name', e.target.value)}
                      placeholder="مثال: صنایع غذایی منجمد و سردخانه‌ای فرهودی"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Tagline */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">شعار برند</label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <span>نمایش</span>
                        <input
                          type="checkbox"
                          checked={form.show.tagline}
                          onChange={(e) => handleShowChange('tagline', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={form.tagline}
                      onChange={(e) => handleFieldChange('tagline', e.target.value)}
                      placeholder="مثال: سامانه توزیع مویرگی زنجیره سرد"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Invoice Title */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">عنوان فاکتور</label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <span>نمایش</span>
                        <input
                          type="checkbox"
                          checked={form.show.invoice_title}
                          onChange={(e) => handleShowChange('invoice_title', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={form.invoice_title}
                      onChange={(e) => handleFieldChange('invoice_title', e.target.value)}
                      placeholder="مثال: صورت‌حساب فروش و تحویل کالا"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Copy label & chips */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">برچسب نسخه</label>
                      <input
                        type="text"
                        value={form.copy_label}
                        onChange={(e) => handleFieldChange('copy_label', e.target.value)}
                        placeholder="مثال: نسخه فروشگاه"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-2 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.order_id}
                          onChange={(e) => handleShowChange('order_id', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>نمایش شماره سفارش</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.order_date}
                          onChange={(e) => handleShowChange('order_date', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>نمایش تاریخ سفارش</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.sale_type}
                          onChange={(e) => handleShowChange('sale_type', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>نمایش نوع فروش (مستقیم/ویزیتوری)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>



            {/* 2. Seller & Central Phones */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('seller')}
                className="w-full p-4 bg-slate-850 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-slate-200">
                    ۲. مشخصات فروشنده، تلفن‌ها و شناسه قانونی
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openSections.seller ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections.seller && (
                <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
                  {/* Address */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">آدرس مرکز پخش</label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <span>نمایش</span>
                        <input
                          type="checkbox"
                          checked={form.show.seller_address}
                          onChange={(e) => handleShowChange('seller_address', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </label>
                    </div>
                    <textarea
                      rows={2}
                      value={form.address}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      placeholder="مثال: بابل، جاده قائمشهر، مجتمع پخش سردخانه‌ای فرهودی"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Central Phones List */}
                  <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">شماره‌های تماس پخش مرکزی</span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 mr-3">
                          <input
                            type="checkbox"
                            checked={form.show.seller_phones}
                            onChange={(e) => handleShowChange('seller_phones', e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                          />
                          <span>نمایش در فاکتور</span>
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddPhone}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن شماره</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {form.phones.map((phone, idx) => (
                        <div
                          key={phone.id}
                          className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <input
                            type="text"
                            value={phone.label}
                            onChange={(e) => handleUpdatePhone(phone.id, { label: e.target.value })}
                            placeholder="برچسب (مثلاً دفتر)"
                            className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-xs"
                          />
                          <input
                            type="text"
                            value={phone.number}
                            onChange={(e) => handleUpdatePhone(phone.id, { number: e.target.value })}
                            placeholder="شماره تماس"
                            className="flex-1 min-w-[120px] px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-xs dir-ltr num-fa"
                          />
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            <input
                              type="checkbox"
                              checked={phone.show_in_invoice}
                              onChange={(e) =>
                                handleUpdatePhone(phone.id, { show_in_invoice: e.target.checked })
                              }
                              className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                            />
                            <span>چاپ</span>
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMovePhone(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePhone(idx, 'down')}
                              disabled={idx === form.phones.length - 1}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePhone(phone.id)}
                              className="p-1 rounded hover:bg-rose-900/50 text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legal Identifiers */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">شناسه ملی</label>
                        <input
                          type="checkbox"
                          checked={form.show.seller_national_id}
                          onChange={(e) => handleShowChange('seller_national_id', e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <input
                        type="text"
                        value={form.national_id || ''}
                        onChange={(e) => handleFieldChange('national_id', e.target.value)}
                        placeholder="اختیاری"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs dir-ltr num-fa"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">کد اقتصادی</label>
                        <input
                          type="checkbox"
                          checked={form.show.seller_economic_code}
                          onChange={(e) =>
                            handleShowChange('seller_economic_code', e.target.checked)
                          }
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <input
                        type="text"
                        value={form.economic_code || ''}
                        onChange={(e) => handleFieldChange('economic_code', e.target.value)}
                        placeholder="اختیاری"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs dir-ltr num-fa"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">شماره ثبت</label>
                        <input
                          type="checkbox"
                          checked={form.show.seller_registration_number}
                          onChange={(e) =>
                            handleShowChange('seller_registration_number', e.target.checked)
                          }
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <input
                        type="text"
                        value={form.registration_number || ''}
                        onChange={(e) => handleFieldChange('registration_number', e.target.value)}
                        placeholder="اختیاری"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs dir-ltr num-fa"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">کد پستی</label>
                        <input
                          type="checkbox"
                          checked={form.show.seller_postal_code}
                          onChange={(e) => handleShowChange('seller_postal_code', e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <input
                        type="text"
                        value={form.postal_code || ''}
                        onChange={(e) => handleFieldChange('postal_code', e.target.value)}
                        placeholder="اختیاری"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs dir-ltr num-fa"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Table Columns & Discount Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('table')}
                className="w-full p-4 bg-slate-850 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Table className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-sm text-slate-200">
                    ۳. ستون‌های جدول اقلام، کارتن و تخفیف‌ها
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openSections.table ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections.table && (
                <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
                  {/* Table Column Reordering, Custom Titles & Visibility */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">
                        ترتیب، عناوین سفارشی و نمایش ستون‌های جدول:
                      </span>
                      <button
                        type="button"
                        onClick={handleResetTableColumns}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>بازگشت به پیش‌فرض ستون‌ها</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(form.table_columns || DEFAULT_TABLE_COLUMNS).map((col, idx) => {
                        const defaultLabels: Record<TableColumnKey, string> = {
                          row_index: '#',
                          product_name: 'شرح کالا / خدمات',
                          items_per_package: 'تعداد در کارتن',
                          quantity_unit: 'تعداد / واحد',
                          unit_price: `فی (${form.currency_label || 'تومان'})`,
                          discount_percent: 'تخفیف (٪)',
                          total_price: `مبلغ کل (${form.currency_label || 'تومان'})`,
                        };

                        return (
                          <div
                            key={col.key}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 shrink-0">
                                <input
                                  type="checkbox"
                                  checked={col.visible}
                                  onChange={(e) => handleColumnVisibilityToggle(idx, e.target.checked)}
                                  className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                                />
                                <span className="font-semibold text-slate-400 text-[11px] min-w-[70px]">
                                  {col.key === 'row_index' ? 'ردیف (#)' :
                                   col.key === 'product_name' ? 'شرح کالا' :
                                   col.key === 'items_per_package' ? 'تعداد در کارتن' :
                                   col.key === 'quantity_unit' ? 'تعداد/واحد' :
                                   col.key === 'unit_price' ? 'قیمت واحد (فی)' :
                                   col.key === 'discount_percent' ? 'درصد تخفیف' :
                                   'مبلغ کل'}
                                </span>
                              </label>

                              <input
                                type="text"
                                value={col.label}
                                onChange={(e) => handleColumnLabelChange(idx, e.target.value)}
                                placeholder={defaultLabels[col.key]}
                                className="flex-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleColumnOrderChange(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 cursor-pointer"
                                title="انتقال به بالا"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleColumnOrderChange(idx, 'down')}
                                disabled={idx === (form.table_columns?.length || DEFAULT_TABLE_COLUMNS.length) - 1}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 cursor-pointer"
                                title="انتقال به پایین"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Overall Discount Box */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(form.has_overall_discount)}
                          onChange={(e) =>
                            handleFieldChange('has_overall_discount', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>اعمال درصد تخفیف روی جمع کل فاکتور</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <span>نمایش سطر در خلاصه جمع‌ها</span>
                        <input
                          type="checkbox"
                          checked={form.show.summary_discount}
                          onChange={(e) =>
                            handleShowChange('summary_discount', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </label>
                    </div>

                    {form.has_overall_discount && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">درصد تخفیف کل سفارش:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.discount_percent || 0}
                          onChange={(e) =>
                            handleFieldChange('discount_percent', Number(e.target.value) || 0)
                          }
                          className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs num-fa text-center font-bold"
                        />
                        <span className="text-xs text-slate-400">درصد (٪)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Buyer & Visitor Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('buyer')}
                className="w-full p-4 bg-slate-850 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Store className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm text-slate-200">
                    ۴. مشخصات خریدار، ویزیتور و نوع فروش
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openSections.buyer ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections.buyer && (
                <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block mb-2">
                      فیلدهای کارت خریدار:
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.buyer_store_name}
                          onChange={(e) => handleShowChange('buyer_store_name', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>نام فروشگاه</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.buyer_owner}
                          onChange={(e) => handleShowChange('buyer_owner', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>نام متصدی / صاحب فروشگاه</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.buyer_phone}
                          onChange={(e) => handleShowChange('buyer_phone', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>شماره تماس خریدار</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.buyer_address}
                          onChange={(e) => handleShowChange('buyer_address', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>آدرس فروشگاه</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <input
                        type="checkbox"
                        checked={form.show.seller_visitor}
                        onChange={(e) => handleShowChange('seller_visitor', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                      />
                      <span>نمایش ردیف ویزیتور (فقط برای سفارش‌های منتسب به ویزیتور)</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">عنوان فروش مستقیم</label>
                        <input
                          type="text"
                          value={form.direct_sale_title}
                          onChange={(e) => handleFieldChange('direct_sale_title', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-300">عنوان فروش با ویزیتور</label>
                        <input
                          type="text"
                          value={form.visitor_sale_title}
                          onChange={(e) => handleFieldChange('visitor_sale_title', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Totals, Taxes & Payment */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('totals')}
                className="w-full p-4 bg-slate-850 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <DollarSign className="w-4 h-4 text-yellow-400" />
                  <span className="font-bold text-sm text-slate-200">
                    ۵. محاسبات، مالیات، حساب بانکی و امضاها
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openSections.totals ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections.totals && (
                <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
                  {/* Currency & Unit Settings */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-200 block">واحد پول و نمایش مبالغ:</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-medium">برچسب واحد پولی فاکتور:</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={form.currency_label || 'تومان'}
                            onChange={(e) => handleFieldChange('currency_label', e.target.value)}
                            placeholder="مثال: تومان یا ریال"
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleFieldChange('currency_label', 'تومان')}
                            className={`px-2 py-1.5 rounded-lg border text-xs cursor-pointer font-bold transition ${
                              form.currency_label === 'تومان'
                                ? 'bg-amber-600 border-amber-500 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            تومان
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFieldChange('currency_label', 'ریال')}
                            className={`px-2 py-1.5 rounded-lg border text-xs cursor-pointer font-bold transition ${
                              form.currency_label === 'ریال'
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            ریال
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-medium">نام واحد پیش‌فرض کالا:</label>
                        <input
                          type="text"
                          value={form.default_unit_name || 'عدد'}
                          onChange={(e) => handleFieldChange('default_unit_name', e.target.value)}
                          placeholder="مثال: عدد / کارتن / بسته"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs"
                        />
                      </div>

                      <div className="space-y-1 col-span-full pt-1 border-t border-slate-800">
                        <label className="text-slate-300 font-bold text-xs block">درصد تخفیف تحویل سفارش درب انبار (پیش‌فرض فروشگاه‌ها):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={form.pickup_discount_percent ?? 3}
                            onChange={(e) => handleFieldChange('pickup_discount_percent', Number(e.target.value) || 0)}
                            className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold num-fa text-center"
                          />
                          <span className="text-xs text-slate-400 font-medium">درصد (٪) — فروشگاه هنگام ثبت سفارش تحویل انبار این تخفیف را دریافت می‌کند.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* VAT */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                        <input
                          type="checkbox"
                          checked={form.has_vat}
                          onChange={(e) => handleFieldChange('has_vat', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>محاسبه مالیات بر ارزش افزوده (VAT)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                        <span>نمایش سطر مالیات</span>
                        <input
                          type="checkbox"
                          checked={form.show.summary_vat}
                          onChange={(e) => handleShowChange('summary_vat', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </label>
                    </div>

                    {form.has_vat && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">درصد مالیات:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.vat_percent}
                          onChange={(e) =>
                            handleFieldChange('vat_percent', Number(e.target.value) || 0)
                          }
                          className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs num-fa text-center font-bold"
                        />
                        <span className="text-xs text-slate-400">درصد (٪)</span>
                      </div>
                    )}
                  </div>

                  {/* Summary rows */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={form.show.summary_items_count}
                        onChange={(e) => handleShowChange('summary_items_count', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                      />
                      <span>نمایش تعداد کل اقلام</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={form.show.summary_final_total}
                        onChange={(e) => handleShowChange('summary_final_total', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                      />
                      <span>نمایش مبلغ قابل پرداخت</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={form.show.amount_in_words}
                        onChange={(e) => handleShowChange('amount_in_words', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                      />
                      <span>نمایش مبلغ نهایی به حروف</span>
                    </label>
                  </div>

                  {/* Bank & Payment info */}
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300 block">مشخصات حساب بانکی:</span>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-slate-400">نام صاحب حساب</label>
                        <input
                          type="checkbox"
                          checked={form.show.payment_account_holder}
                          onChange={(e) =>
                            handleShowChange('payment_account_holder', e.target.checked)
                          }
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <input
                        type="text"
                        value={form.bank_account_holder}
                        onChange={(e) => handleFieldChange('bank_account_holder', e.target.value)}
                        placeholder="مثال: صنایع غذایی فرهودی"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-400">شماره کارت</label>
                          <input
                            type="checkbox"
                            checked={form.show.payment_card}
                            onChange={(e) => handleShowChange('payment_card', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                          />
                        </div>
                        <input
                          type="text"
                          value={form.card_number}
                          onChange={(e) => handleFieldChange('card_number', e.target.value)}
                          placeholder="۱۶ رقم"
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs dir-ltr num-fa"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-400">شماره شبا</label>
                          <input
                            type="checkbox"
                            checked={form.show.payment_iban}
                            onChange={(e) => handleShowChange('payment_iban', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                          />
                        </div>
                        <input
                          type="text"
                          value={form.iban}
                          onChange={(e) => handleFieldChange('iban', e.target.value)}
                          placeholder="IR..."
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs dir-ltr num-fa"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-slate-400">شرایط پرداخت و تسویه</label>
                        <input
                          type="checkbox"
                          checked={form.show.payment_terms}
                          onChange={(e) => handleShowChange('payment_terms', e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <input
                        type="text"
                        value={form.payment_terms}
                        onChange={(e) => handleFieldChange('payment_terms', e.target.value)}
                        placeholder="مثال: نقدی هنگام تحویل / چک صیادی"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs"
                      />
                    </div>
                  </div>

                  {/* Footer notes, signatures & terms */}
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">
                          متن شرایط و توضیحات فاکتور
                        </label>
                        <input
                          type="checkbox"
                          checked={form.show.terms_and_conditions}
                          onChange={(e) =>
                            handleShowChange('terms_and_conditions', e.target.checked)
                          }
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={form.footer_notes}
                        onChange={(e) => handleFieldChange('footer_notes', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">
                          سطر وب‌سایت یا راه ارتباطی
                        </label>
                        <input
                          type="checkbox"
                          checked={form.show.contact_footer}
                          onChange={(e) => handleShowChange('contact_footer', e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                      </div>
                      <input
                        type="text"
                        value={form.website_or_contact}
                        onChange={(e) => handleFieldChange('website_or_contact', e.target.value)}
                        placeholder="مثال: barfroosh.ir"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs dir-ltr"
                      />
                    </div>

                    {/* Signatures & Page Number */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.signatures_seller}
                          onChange={(e) => handleShowChange('signatures_seller', e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>امضای فروشنده</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.signatures_buyer}
                          onChange={(e) => handleShowChange('signatures_buyer', e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>امضای خریدار</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.signatures_receiver}
                          onChange={(e) =>
                            handleShowChange('signatures_receiver', e.target.checked)
                          }
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>امضای تحویل‌گیرنده</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.show.page_number}
                          onChange={(e) => handleShowChange('page_number', e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>شماره صفحه</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 7. Typography, Font Sizes, Box Sizing & Visual Style (ظاهر، اندازه فونت‌ها و کادرها) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('typography')}
                className="w-full p-4 bg-slate-850 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Type className="w-4 h-4 text-pink-400" />
                  <span className="font-bold text-sm text-slate-200">
                    ۶. تنظیم ظاهر، فونت‌ها، ابعاد کادرها و خطوط فاکتور
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openSections.typography ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections.typography && (
                <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
                  {/* Reset Appearance Button */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">
                      تنظیمات اندازه فونت، ضخامت خطوط و فواصل بین بخش‌ها
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          style: { ...DEFAULT_INVOICE_STYLE_SETTINGS },
                        }));
                        showToast('تنظیمات ظاهر به حالت پیش‌فرض بازگردانده شد.', 'info');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>بازگشت به پیش‌فرض ظاهر</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Base Font Scale */}
                    <div className="space-y-1 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <label className="text-slate-300 font-bold block">اندازه فونت پایه فاکتور:</label>
                      <select
                        value={form.style.base_font_size}
                        onChange={(e) => handleStyleChange('base_font_size', e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="small">ریز و فشرده (۱۰ پیکسل)</option>
                        <option value="normal">استاندارد (۱۱ پیکسل)</option>
                        <option value="large">درشت و خوانا (۱۲.۵ پیکسل)</option>
                      </select>
                    </div>

                    {/* Section Spacing */}
                    <div className="space-y-1 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <label className="text-slate-300 font-bold block">فاصله بین بخش‌های فاکتور:</label>
                      <select
                        value={form.style.section_spacing}
                        onChange={(e) => handleStyleChange('section_spacing', e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="compact">فشرده (کمترین فاصله برای برگه‌های متراکم)</option>
                        <option value="normal">معمولی (استاندارد)</option>
                        <option value="spacious">باز و جادار</option>
                      </select>
                    </div>

                    {/* Header Title Size & Bold */}
                    <div className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-300 font-bold">اندازه عنوان فاکتور:</label>
                        <label className="flex items-center gap-1 cursor-pointer text-slate-300 text-[11px]">
                          <input
                            type="checkbox"
                            checked={form.style.header_title_bold !== false}
                            onChange={(e) => handleStyleChange('header_title_bold', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                          />
                          <span>بولد</span>
                        </label>
                      </div>
                      <select
                        value={form.style.header_title_size}
                        onChange={(e) => handleStyleChange('header_title_size', e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="small">کوچک</option>
                        <option value="normal">معمولی</option>
                        <option value="large">بزرگ</option>
                      </select>
                    </div>

                    {/* Brand Name Size & Bold */}
                    <div className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-300 font-bold">اندازه نام برند / سربرگ:</label>
                        <label className="flex items-center gap-1 cursor-pointer text-slate-300 text-[11px]">
                          <input
                            type="checkbox"
                            checked={form.style.brand_title_bold !== false}
                            onChange={(e) => handleStyleChange('brand_title_bold', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                          />
                          <span>بولد</span>
                        </label>
                      </div>
                      <select
                        value={form.style.brand_title_size}
                        onChange={(e) => handleStyleChange('brand_title_size', e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="small">کوچک</option>
                        <option value="normal">معمولی</option>
                        <option value="large">بزرگ</option>
                      </select>
                    </div>

                    {/* Card Labels Font & Bold */}
                    <div className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-300 font-bold">فونت عناوین/برچسب‌های کارت‌ها:</label>
                        <label className="flex items-center gap-1 cursor-pointer text-slate-300 text-[11px]">
                          <input
                            type="checkbox"
                            checked={form.style.card_labels_bold}
                            onChange={(e) => handleStyleChange('card_labels_bold', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                          />
                          <span>بولد</span>
                        </label>
                      </div>
                      <select
                        value={form.style.card_labels_size}
                        onChange={(e) => handleStyleChange('card_labels_size', e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="small">کوچک (۹.۵ پیکسل)</option>
                        <option value="normal">معمولی (۱۰.۵ پیکسل)</option>
                        <option value="large">بزرگ (۱۲ پیکسل)</option>
                      </select>
                    </div>

                    {/* Card Values Font & Bold */}
                    <div className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-300 font-bold">فونت مقادیر/اطلاعات کارت‌ها:</label>
                        <label className="flex items-center gap-1 cursor-pointer text-slate-300 text-[11px]">
                          <input
                            type="checkbox"
                            checked={form.style.card_values_bold !== false}
                            onChange={(e) => handleStyleChange('card_values_bold', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-800 border-slate-700"
                          />
                          <span>بولد</span>
                        </label>
                      </div>
                      <select
                        value={form.style.card_values_size}
                        onChange={(e) => handleStyleChange('card_values_size', e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="small">کوچک (۱۰ پیکسل)</option>
                        <option value="normal">معمولی (۱۱ پیکسل)</option>
                        <option value="large">بزرگ (۱۲.۵ پیکسل)</option>
                      </select>
                    </div>

                    {/* Card Padding */}
                    <div className="space-y-1 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <label className="text-slate-300 font-bold block">پدینگ و فضای داخلی کارت‌ها:</label>
                      <select
                        value={form.style.card_padding}
                        onChange={(e) => handleStyleChange('card_padding', e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="compact">فشرده (کمترین فضا)</option>
                        <option value="normal">معمولی (استاندارد)</option>
                        <option value="spacious">جادار و باز</option>
                      </select>
                    </div>

                    {/* Table Row Density */}
                    <div className="space-y-1 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <label className="text-slate-300 font-bold block">فاصله بین ردیف‌های جدول (تراکم):</label>
                      <select
                        value={form.style.table_density}
                        onChange={(e) => handleStyleChange('table_density', e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="compact">فشرده (برای جا شدن ردیف‌های بیشتر)</option>
                        <option value="normal">معمولی</option>
                        <option value="spacious">باز و جادار</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 8. Table Column Widths & Layout (عرض ستون‌ها و چیدمان فاکتور) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('layout')}
                className="w-full p-4 bg-slate-850 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Table className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-sm text-slate-200">
                    ۷. تنظیم عرض ستون‌های جدول اقلام و چیدمان بخش‌ها
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openSections.layout ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections.layout && (
                <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
                  {/* Column Widths Subsection */}
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-cyan-300">
                          تنظیم دقیق عرض ستون‌های فعال جدول اقلام (درصد از ۱۰۰٪)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          می‌توانید با اسلایدرهای زیر یا با کشیدن دستگیره بین سربرگ‌ها در پیش‌نمایش، عرض ستون‌ها را تغییر دهید.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            layout: {
                              ...prev.layout,
                              column_widths: { ...DEFAULT_COLUMN_WIDTHS },
                            },
                          }));
                          showToast('عرض ستون‌های جدول به پیش‌فرض بازگردانده شد.', 'info');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer transition shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>بازگشت به پیش‌فرض عرض‌ها</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {form.show.col_row_index && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">ستون ردیف (#):</span>
                            <span className="num-fa font-bold text-cyan-400">
                              {(form.layout.column_widths?.row_index ?? DEFAULT_COLUMN_WIDTHS.row_index)}٪
                            </span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={30}
                            value={form.layout.column_widths?.row_index ?? DEFAULT_COLUMN_WIDTHS.row_index}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setForm((prev) => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  column_widths: {
                                    ...(prev.layout.column_widths || DEFAULT_COLUMN_WIDTHS),
                                    row_index: val,
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-cyan-500 cursor-pointer"
                          />
                        </div>
                      )}

                      {form.show.col_product_name && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">شرح کالا / خدمات:</span>
                            <span className="num-fa font-bold text-cyan-400">
                              {(form.layout.column_widths?.product_name ?? DEFAULT_COLUMN_WIDTHS.product_name)}٪
                            </span>
                          </div>
                          <input
                            type="range"
                            min={15}
                            max={60}
                            value={form.layout.column_widths?.product_name ?? DEFAULT_COLUMN_WIDTHS.product_name}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setForm((prev) => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  column_widths: {
                                    ...(prev.layout.column_widths || DEFAULT_COLUMN_WIDTHS),
                                    product_name: val,
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-cyan-500 cursor-pointer"
                          />
                        </div>
                      )}

                      {form.show.col_items_per_package && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">تعداد در کارتن:</span>
                            <span className="num-fa font-bold text-cyan-400">
                              {(form.layout.column_widths?.items_per_package ?? DEFAULT_COLUMN_WIDTHS.items_per_package)}٪
                            </span>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={35}
                            value={form.layout.column_widths?.items_per_package ?? DEFAULT_COLUMN_WIDTHS.items_per_package}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setForm((prev) => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  column_widths: {
                                    ...(prev.layout.column_widths || DEFAULT_COLUMN_WIDTHS),
                                    items_per_package: val,
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-cyan-500 cursor-pointer"
                          />
                        </div>
                      )}

                      {form.show.col_quantity_unit && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">تعداد / واحد:</span>
                            <span className="num-fa font-bold text-cyan-400">
                              {(form.layout.column_widths?.quantity_unit ?? DEFAULT_COLUMN_WIDTHS.quantity_unit)}٪
                            </span>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={35}
                            value={form.layout.column_widths?.quantity_unit ?? DEFAULT_COLUMN_WIDTHS.quantity_unit}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setForm((prev) => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  column_widths: {
                                    ...(prev.layout.column_widths || DEFAULT_COLUMN_WIDTHS),
                                    quantity_unit: val,
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-cyan-500 cursor-pointer"
                          />
                        </div>
                      )}

                      {form.show.col_unit_price && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">فی (قیمت واحد):</span>
                            <span className="num-fa font-bold text-cyan-400">
                              {(form.layout.column_widths?.unit_price ?? DEFAULT_COLUMN_WIDTHS.unit_price)}٪
                            </span>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={35}
                            value={form.layout.column_widths?.unit_price ?? DEFAULT_COLUMN_WIDTHS.unit_price}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setForm((prev) => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  column_widths: {
                                    ...(prev.layout.column_widths || DEFAULT_COLUMN_WIDTHS),
                                    unit_price: val,
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-cyan-500 cursor-pointer"
                          />
                        </div>
                      )}

                      {form.show.col_discount_percent && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">درصد تخفیف (٪):</span>
                            <span className="num-fa font-bold text-cyan-400">
                              {(form.layout.column_widths?.discount_percent ?? DEFAULT_COLUMN_WIDTHS.discount_percent)}٪
                            </span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={30}
                            value={form.layout.column_widths?.discount_percent ?? DEFAULT_COLUMN_WIDTHS.discount_percent}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setForm((prev) => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  column_widths: {
                                    ...(prev.layout.column_widths || DEFAULT_COLUMN_WIDTHS),
                                    discount_percent: val,
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-cyan-500 cursor-pointer"
                          />
                        </div>
                      )}

                      {form.show.col_total_price && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">مبلغ کل ردیف:</span>
                            <span className="num-fa font-bold text-cyan-400">
                              {(form.layout.column_widths?.total_price ?? DEFAULT_COLUMN_WIDTHS.total_price)}٪
                            </span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={40}
                            value={form.layout.column_widths?.total_price ?? DEFAULT_COLUMN_WIDTHS.total_price}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setForm((prev) => ({
                                ...prev,
                                layout: {
                                  ...prev.layout,
                                  column_widths: {
                                    ...(prev.layout.column_widths || DEFAULT_COLUMN_WIDTHS),
                                    total_price: val,
                                  },
                                },
                              }));
                            }}
                            className="w-full accent-cyan-500 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top layout options */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400">موقعیت لوگو در سربرگ:</label>
                      <select
                        value={form.layout.logo_position}
                        onChange={(e) =>
                          handleLayoutFieldChange('logo_position', e.target.value as any)
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="right">سمت راست (استاندارد)</option>
                        <option value="center">وسط‌چین</option>
                        <option value="left">سمت چپ</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400">موقعیت بلوک شماره و تاریخ:</label>
                      <select
                        value={form.layout.order_info_position}
                        onChange={(e) =>
                          handleLayoutFieldChange('order_info_position', e.target.value as any)
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value="left">سمت چپ (استاندارد)</option>
                        <option value="right">سمت راست</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400">ستون‌های کارت فروشنده:</label>
                      <select
                        value={form.layout.seller_card_columns}
                        onChange={(e) =>
                          handleLayoutFieldChange(
                            'seller_card_columns',
                            Number(e.target.value) as 1 | 2
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value={2}>۲ ستونه (فشرده)</option>
                        <option value={1}>۱ ستونه (تک‌خطی)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400">ستون‌های کارت خریدار:</label>
                      <select
                        value={form.layout.buyer_card_columns}
                        onChange={(e) =>
                          handleLayoutFieldChange(
                            'buyer_card_columns',
                            Number(e.target.value) as 1 | 2
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                      >
                        <option value={2}>۲ ستونه (فشرده)</option>
                        <option value={1}>۱ ستونه (تک‌خطی)</option>
                      </select>
                    </div>

                    <div className="col-span-full pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={form.layout.stick_footer_to_bottom}
                          onChange={(e) =>
                            handleLayoutFieldChange('stick_footer_to_bottom', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                        />
                        <span>چسباندن پاورقی و امضا به انتهای صفحه چاپی</span>
                      </label>
                    </div>
                  </div>

                  {/* Section Ordering & Widths */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block mb-1">
                      ترتیب و عرض بخش‌ها (دو بخش نیم‌عرض پشت‌سرهم کنار هم قرار می‌گیرند):
                    </span>

                    <div className="space-y-1.5">
                      {form.layout.section_order.map((key, idx) => {
                        const width = form.layout.section_widths[key] || 'full';
                        const align = form.layout.section_alignments[key] || 'right';

                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="num-fa w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-200">
                                {SECTION_LABELS[key] || key}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Width toggle */}
                              <button
                                type="button"
                                onClick={() => handleLayoutWidthToggle(key)}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer ${
                                  width === 'full'
                                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                                    : 'bg-amber-600/20 text-amber-300 border-amber-500/30'
                                }`}
                                title="تغییر عرض بخش"
                              >
                                {width === 'full' ? 'تمام‌عرض (۱۰۰٪)' : 'نیم‌عرض (۵۰٪)'}
                              </button>

                              {/* Alignment Buttons */}
                              <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => handleLayoutAlignChange(key, 'right')}
                                  className={`p-1 rounded cursor-pointer ${
                                    align === 'right'
                                      ? 'bg-slate-700 text-white'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                  title="راست‌چین"
                                >
                                  <AlignRight className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLayoutAlignChange(key, 'center')}
                                  className={`p-1 rounded cursor-pointer ${
                                    align === 'center'
                                      ? 'bg-slate-700 text-white'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                  title="وسط‌چین"
                                >
                                  <AlignCenter className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLayoutAlignChange(key, 'left')}
                                  className={`p-1 rounded cursor-pointer ${
                                    align === 'left'
                                      ? 'bg-slate-700 text-white'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                  title="چپ‌چین"
                                >
                                  <AlignLeft className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Up / Down Reorder */}
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleLayoutOrderChange(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 cursor-pointer"
                                  title="انتقال به بالا"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLayoutOrderChange(idx, 'down')}
                                  disabled={idx === form.layout.section_order.length - 1}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 cursor-pointer"
                                  title="انتقال به پایین"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 9. Paper Size */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('paper')}
                className="w-full p-4 bg-slate-850 flex items-center justify-between text-right cursor-pointer hover:bg-slate-800/80 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Printer className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-sm text-slate-200">۸. قطع کاغذ و ابعاد چاپ</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    openSections.paper ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections.paper && (
                <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-900/50">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => handleFieldChange('paper_size', 'A4')}
                      className={`p-3 rounded-xl border text-center font-bold cursor-pointer transition ${
                        form.paper_size === 'A4'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      کاغذ A4 (استاندارد)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFieldChange('paper_size', 'A5')}
                      className={`p-3 rounded-xl border text-center font-bold cursor-pointer transition ${
                        form.paper_size === 'A5'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      کاغذ A5 (نیم‌برگ)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-900/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره نهایی تنظیمات فاکتور'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs sm:text-sm font-black text-slate-100">
                  پیش‌نمایش زنده فاکتور چاپی
                </h3>
              </div>

              {/* Preview Mode Toggles */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewSaleType('direct')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    previewSaleType === 'direct'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  فروش مستقیم
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSaleType('visitor')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    previewSaleType === 'visitor'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ویزیتوری
                </button>
              </div>
            </div>

            {/* Test row counts toggle */}
            <div className="flex items-center justify-between gap-2 py-2 text-[11px] text-slate-400">
              <span>تعداد اقلام تستی:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewRowCount(6)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    previewRowCount === 6
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  ۶ قلم
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewRowCount(11)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    previewRowCount === 11
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  ۱۱ قلم
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewRowCount(19)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    previewRowCount === 19
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  ۱۹ قلم
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewRowCount(30)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    previewRowCount === 30
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  ۳۰ قلم
                </button>
              </div>
            </div>

            {/* Live Invoice Preview Area */}
            <div className="mt-2 max-h-[75vh] overflow-y-auto rounded-xl p-2 bg-slate-950/70 border border-slate-800">
              <InvoiceDocument
                order={mockOrder as any}
                settings={memoizedPreviewSettings}
                supermarket={mockSupermarket as any}
                visitor={previewSaleType === 'visitor' ? (mockVisitor as any) : undefined}
                interactiveColumns={true}
                onColumnWidthsChange={handleColumnWidthsBatchChange}
                className="transform scale-95 origin-top"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
