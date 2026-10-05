import React, { useState, useId, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { InvoiceSettings, CentralPhone, DEFAULT_INVOICE_SETTINGS } from '../../types';
import { normalizePhone } from '../../context/utils';
import { numberToPersianWords } from '../../utils/numberToPersianWords';
import {
  Building2,
  Phone,
  FileText,
  DollarSign,
  FileCheck2,
  Layers,
  ChevronDown,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Store,
  Truck,
  Printer,
  FileSpreadsheet,
  HelpCircle,
  Eye,
  Info,
} from 'lucide-react';

// Resize & compress image in browser to max 256px and < 150KB
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

        // Try webp or jpeg format
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

function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = normalizePhone(phone);
  // Iranian phone (mobile or landline with area code): 10 or 11 digits starting with 0
  return /^0\d{9,10}$/.test(clean);
}

export const InvoiceSettingsTab: React.FC = () => {
  const { invoiceSettings, updateInvoiceSettings, showToast } = useApp();

  // Local form state cloned from global settings
  const [form, setForm] = useState<InvoiceSettings>(() => ({
    ...DEFAULT_INVOICE_SETTINGS,
    ...invoiceSettings,
    phones: Array.isArray(invoiceSettings.phones) && invoiceSettings.phones.length > 0
      ? invoiceSettings.phones.map((p) => ({ ...p }))
      : DEFAULT_INVOICE_SETTINGS.phones.map((p) => ({ ...p })),
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview Mode: 'direct' (فروش مستقیم) or 'visitor' (با ویزیتور)
  const [previewMode, setPreviewMode] = useState<'direct' | 'visitor'>('direct');

  // Accordion open/collapse states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    seller: true,
    phones: true,
    legal: false,
    visitor: true,
    appearance: false,
    payment: false,
    footer: false,
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

  // Central Phones Management
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
    setUploadError(null);
    try {
      const dataUri = await resizeImageToDataUri(file);
      handleFieldChange('logo_url', dataUri);
      showToast('لوگوی فاکتور با موفقیت بارگذاری شد.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در بارگذاری تصویر لوگو';
      setUploadError(msg);
      showToast(msg, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    handleFieldChange('logo_url', '');
    showToast('لوگوی فاکتور حذف شد.', 'info');
  };

  // Reset to Defaults
  const handleResetToDefaults = () => {
    if (window.confirm('آیا از بازنشانی کلیه تنظیمات فاکتور به مقادیر پیش‌فرض اطمینان دارید؟')) {
      setForm({ ...DEFAULT_INVOICE_SETTINGS });
      showToast('تنظیمات به حالت پیش‌فرض بازگردانده شد. برای اعمال نهایی دکمه ذخیره را بزنید.', 'info');
    }
  };

  // Save Settings
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
    } catch {
      showToast('خطای پیش‌بینی نشده در ذخیره اطلاعات.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Check if active phones for invoice are configured
  const activeInvoicePhones = form.phones.filter((p) => p.show_in_invoice && p.number.trim());
  const hasNoInvoicePhone = activeInvoicePhones.length === 0;

  // Sample Invoice Preview Data
  const sampleItems = [
    { name: 'پنیر پیتزا مطهر ۲ کیلویی (رنده‌شده)', qty: 4, unit: 'بسته', price: 345000 },
    { name: 'سوسیس آلمانی ۸۰ درصد گوشتیران', qty: 6, unit: 'کیلوگرم', price: 198000 },
    { name: 'خمیر پیراشکی ۹۵۹۵ (بسته ۱۲ عددی)', qty: 10, unit: 'بسته', price: 42000 },
  ];

  const sampleSubtotal = sampleItems.reduce((acc, it) => acc + it.qty * it.price, 0);
  const sampleVatAmount = form.has_vat ? Math.round(sampleSubtotal * ((form.vat_percent || 10) / 100)) : 0;
  const sampleTotalPayable = sampleSubtotal + sampleVatAmount;
  const sampleTotalItemsCount = sampleItems.reduce((acc, it) => acc + it.qty, 0);

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">تنظیمات سربرگ و اطلاعات فاکتور رسمی</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                شخصی‌سازی مشخصات شرکت، شماره‌های تماس، لوگو، مالیات و ساختار چاپی فاکتورهای فروشگاه و ویزیتور
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition flex items-center gap-1.5 cursor-pointer"
            title="بازنشانی مقادیر به پیش‌فرض‌های اولیه"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>پیش‌فرض</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <span>در حال ذخیره...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>ذخیره تنظیمات</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Form on Left/Right, Live Preview on Other */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ============================================================== */}
        {/* Column 1: Settings Form (7 cols on xl) */}
        {/* ============================================================== */}
        <div className="xl:col-span-7 space-y-4">
          {/* Warning Banner: No phone configured for invoice */}
          {hasNoInvoicePhone && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 shadow-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <p className="font-semibold leading-relaxed">
                شماره پخش مرکزی ثبت نشده و روی فاکتور چاپ نمی‌شود. لطفاً در بخش «شماره‌های تماس» حداقل یک شماره ثبت فرمایید.
              </p>
            </div>
          )}

          {/* Card A: اطلاعات فروشنده */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('seller')}
              className="w-full p-3.5 bg-slate-950/60 hover:bg-slate-800/40 transition flex items-center justify-between text-right cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-100">الف) اطلاعات فروشنده و هویت برند</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.seller ? 'rotate-180 text-blue-400' : ''
                }`}
              />
            </button>

            {openSections.seller && (
              <div className="p-4 space-y-3.5 border-t border-slate-800/80 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">نام تجاری یا برند:</label>
                    <input
                      type="text"
                      value={form.brand_name}
                      onChange={(e) => handleFieldChange('brand_name', e.target.value)}
                      placeholder="مثال: شبکه پخش عمده فرهودی"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">نام کامل یا حقوقی شرکت:</label>
                    <input
                      type="text"
                      value={form.legal_name}
                      onChange={(e) => handleFieldChange('legal_name', e.target.value)}
                      placeholder="مثال: صنایع غذایی منجمد و سردخانه‌ای فرهودی"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">شعار یا توضیح یک‌خطی سربرگ:</label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) => handleFieldChange('tagline', e.target.value)}
                    placeholder="مثال: سامانه سفارش‌گیری و توزیع مویرگی زنجیره سرد مواد غذایی"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">نشانی دفتر یا انبار پخش مرکزی:</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    placeholder="مثال: بابل، جاده قائمشهر، مجتمع پخش سردخانه‌ای فرهودی"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Logo Uploader */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-slate-300 font-medium mb-2">لوگوی سربرگ فاکتور (حداکثر ۲۵۶ پیکسل و ۱۵۰ کیلوبایت):</label>
                  <div className="flex items-center gap-3">
                    {form.logo_url ? (
                      <div className="relative group w-14 h-14 rounded-xl bg-white border border-slate-300 p-1 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                        <img
                          src={form.logo_url}
                          alt="پیش‌نمایش لوگو"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-950 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 shrink-0">
                        <ImageIcon className="w-6 h-6 stroke-1" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="invoice-logo-input"
                          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{form.logo_url ? 'تغییر تصویر لوگو' : 'آپلود لوگوی شرکت'}</span>
                        </label>
                        <input
                          id="invoice-logo-input"
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />

                        {form.logo_url && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition text-xs font-medium cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف لوگو</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        تصویر در مرورگر کوچک و بهینه می‌شود تا به صورت ایمن و خودکار در دیتابیس ذخیره گردد.
                      </p>
                    </div>
                  </div>
                  {uploadError && <p className="text-xs text-rose-400 mt-1">{uploadError}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Card B: شماره‌های تماس پخش مرکزی */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('phones')}
              className="w-full p-3.5 bg-slate-950/60 hover:bg-slate-800/40 transition flex items-center justify-between text-right cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-100">ب) شماره‌های تماس پخش مرکزی</span>
                <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full num-fa font-bold">
                  {form.phones.length} شماره
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.phones ? 'rotate-180 text-emerald-400' : ''
                }`}
              />
            </button>

            {openSections.phones && (
              <div className="p-4 space-y-3 border-t border-slate-800/80 text-xs">
                <p className="text-slate-400 text-[11px]">
                  شماره‌های تلفن ثابت، پشتیبانی و همراه پخش را وارد کنید. فقط مواردی که تیک «نمایش در فاکتور» دارند در فاکتور چاپ خواهند شد.
                </p>

                <div className="space-y-2">
                  {form.phones.map((phone, idx) => {
                    const isValid = isValidPhone(phone.number);
                    return (
                      <div
                        key={phone.id}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2 flex-wrap"
                      >
                        {/* Order Reorder */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMovePhone(idx, 'up')}
                            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="انتقال به بالا"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === form.phones.length - 1}
                            onClick={() => handleMovePhone(idx, 'down')}
                            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            title="انتقال به پایین"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Label Input */}
                        <div className="w-24 shrink-0">
                          <input
                            type="text"
                            value={phone.label}
                            onChange={(e) => handleUpdatePhone(phone.id, { label: e.target.value })}
                            placeholder="دفتر / همراه"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Phone Number Input */}
                        <div className="flex-1 min-w-[130px]">
                          <input
                            type="tel"
                            dir="ltr"
                            value={phone.number}
                            onChange={(e) => handleUpdatePhone(phone.id, { number: e.target.value })}
                            placeholder="۰۱۱۳۳۲۲۱۱۰۰ یا ۰۹۱۲..."
                            className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border text-slate-100 text-xs font-mono focus:outline-none ${
                              phone.number && !isValid ? 'border-amber-500/80' : 'border-slate-700 focus:border-blue-500'
                            }`}
                          />
                        </div>

                        {/* Show In Invoice Checkbox */}
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer shrink-0 select-none">
                          <input
                            type="checkbox"
                            checked={phone.show_in_invoice}
                            onChange={(e) => handleUpdatePhone(phone.id, { show_in_invoice: e.target.checked })}
                            className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span>چاپ در فاکتور</span>
                        </label>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeletePhone(phone.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                          title="حذف شماره"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAddPhone}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>افزودن شماره تماس جدید</span>
                </button>
              </div>
            )}
          </div>

          {/* Card C: شناسه‌های قانونی */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('legal')}
              className="w-full p-3.5 bg-slate-950/60 hover:bg-slate-800/40 transition flex items-center justify-between text-right cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="w-4 h-4 text-purple-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-100">ج) شناسه‌های قانونی شرکت (اختیاری)</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.legal ? 'rotate-180 text-purple-400' : ''
                }`}
              />
            </button>

            {openSections.legal && (
              <div className="p-4 space-y-3 border-t border-slate-800/80 text-xs">
                <p className="text-slate-400 text-[11px]">
                  در صورت تمایل به چاپ فاکتور رسمی مالیاتی با شناسه ملی و کد اقتصادی، مقادیر زیر را تکمیل کنید.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">شناسه ملی:</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.national_id || ''}
                      onChange={(e) => handleFieldChange('national_id', e.target.value)}
                      placeholder="۱۴۰۰..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">کد اقتصادی:</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.economic_code || ''}
                      onChange={(e) => handleFieldChange('economic_code', e.target.value)}
                      placeholder="۴۱۱..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">شماره ثبت شرکت:</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.registration_number || ''}
                      onChange={(e) => handleFieldChange('registration_number', e.target.value)}
                      placeholder="۱۲۳۴۵"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">کد پستی ۱۰ رقمی:</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.postal_code || ''}
                      onChange={(e) => handleFieldChange('postal_code', e.target.value)}
                      placeholder="۴۷۱..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card D: تنظیمات ویزیتور و نوع فروش */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('visitor')}
              className="w-full p-3.5 bg-slate-950/60 hover:bg-slate-800/40 transition flex items-center justify-between text-right cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-amber-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-100">د) ویزیتور و برچسب‌های نوع سفارش</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.visitor ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>

            {openSections.visitor && (
              <div className="p-4 space-y-3.5 border-t border-slate-800/80 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="font-semibold text-slate-200 block">نمایش نام و شماره ویزیتور در کارت فروشنده:</span>
                    <span className="text-slate-400 text-[11px]">در صورت فعال بودن، اگر سفارش از طریق ویزیتور ثبت شده باشد، مشخصات ویزیتور در فاکتور چاپ می‌شود.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.show_visitor_info}
                    onChange={(e) => handleFieldChange('show_visitor_info', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">متن سفارش فروش مستقیم:</label>
                    <input
                      type="text"
                      value={form.direct_sale_title}
                      onChange={(e) => handleFieldChange('direct_sale_title', e.target.value)}
                      placeholder="فروش مستقیم پخش مرکزی"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">متن سفارش از طریق ویزیتور:</label>
                    <input
                      type="text"
                      value={form.visitor_sale_title}
                      onChange={(e) => handleFieldChange('visitor_sale_title', e.target.value)}
                      placeholder="فروش از طریق ویزیتور"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card E: عنوان و ظاهر */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('appearance')}
              className="w-full p-3.5 bg-slate-950/60 hover:bg-slate-800/40 transition flex items-center justify-between text-right cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-100">هـ) عنوان فاکتور و کنترل اجزای بصری</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.appearance ? 'rotate-180 text-cyan-400' : ''
                }`}
              />
            </button>

            {openSections.appearance && (
              <div className="p-4 space-y-3.5 border-t border-slate-800/80 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">عنوان اصلی فاکتور:</label>
                  <input
                    type="text"
                    value={form.invoice_title}
                    onChange={(e) => handleFieldChange('invoice_title', e.target.value)}
                    placeholder="صورت‌حساب فروش و تحویل کالا"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-slate-200">نمایش لوگو در سربرگ</span>
                    <input
                      type="checkbox"
                      checked={form.show_logo}
                      onChange={(e) => handleFieldChange('show_logo', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-slate-200">نمایش نشانی کامل خریدار</span>
                    <input
                      type="checkbox"
                      checked={form.show_buyer_address}
                      onChange={(e) => handleFieldChange('show_buyer_address', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-slate-200">نمایش مبلغ به حروف</span>
                    <input
                      type="checkbox"
                      checked={form.show_amount_in_words}
                      onChange={(e) => handleFieldChange('show_amount_in_words', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-slate-200">نمایش کادرهای امضا (فروشنده، خریدار، تحویل)</span>
                    <input
                      type="checkbox"
                      checked={form.show_signature_boxes}
                      onChange={(e) => handleFieldChange('show_signature_boxes', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-slate-200">نمایش شماره صفحه</span>
                    <input
                      type="checkbox"
                      checked={form.show_page_number}
                      onChange={(e) => handleFieldChange('show_page_number', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Card F: مبلغ و پرداخت */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('payment')}
              className="w-full p-3.5 bg-slate-950/60 hover:bg-slate-800/40 transition flex items-center justify-between text-right cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-100">و) مالیات بر ارزش افزوده و حساب‌های بانکی</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.payment ? 'rotate-180 text-emerald-400' : ''
                }`}
              />
            </button>

            {openSections.payment && (
              <div className="p-4 space-y-3.5 border-t border-slate-800/80 text-xs">
                {/* VAT switch and percentage */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200 block">محاسبه مالیات بر ارزش افزوده (VAT):</span>
                      <span className="text-slate-400 text-[11px]">در صورت فعال بودن، ردیف مالیات به جمع اقلام اضافه و در فاکتور منعکس می‌شود.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.has_vat}
                      onChange={(e) => handleFieldChange('has_vat', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                    />
                  </div>

                  {form.has_vat && (
                    <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                      <span className="text-slate-300 font-medium">درصد مالیات بر ارزش افزوده:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={form.vat_percent}
                        onChange={(e) => handleFieldChange('vat_percent', Number(e.target.value) || 0)}
                        className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-center text-xs"
                      />
                      <span className="text-slate-400">درصد (پیش‌فرض ۱۰٪)</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">نام صاحب حساب:</label>
                    <input
                      type="text"
                      value={form.bank_account_holder}
                      onChange={(e) => handleFieldChange('bank_account_holder', e.target.value)}
                      placeholder="صنایع غذایی فرهودی"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">شماره کارت بانکی:</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.card_number}
                      onChange={(e) => handleFieldChange('card_number', e.target.value)}
                      placeholder="۶۰۳۷-۹۹..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">شماره شبا (IBAN):</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.iban}
                      onChange={(e) => handleFieldChange('iban', e.target.value)}
                      placeholder="IR..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">متن شرایط و نحوه پرداخت:</label>
                  <input
                    type="text"
                    value={form.payment_terms}
                    onChange={(e) => handleFieldChange('payment_terms', e.target.value)}
                    placeholder="نقدی هنگام تحویل کالا / چک صیادی با هماهنگی مدیریت"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card G: پاورقی و توضیحات فاکتور */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('footer')}
              className="w-full p-3.5 bg-slate-950/60 hover:bg-slate-800/40 transition flex items-center justify-between text-right cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-100">ز) متن پاورقی، برچسب نسخه و وب‌سایت</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.footer ? 'rotate-180 text-indigo-400' : ''
                }`}
              />
            </button>

            {openSections.footer && (
              <div className="p-4 space-y-3.5 border-t border-slate-800/80 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">متن شرایط و تعهدات زیر فاکتور:</label>
                  <textarea
                    rows={2}
                    value={form.footer_notes}
                    onChange={(e) => handleFieldChange('footer_notes', e.target.value)}
                    placeholder="اجناس تحویل شده از نظر سلامت ظاهری، انجماد و تاریخ مصرف مورد تایید خریدار قرار گرفت."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">سطر تماس یا نشانی وب‌سایت در پاورقی:</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.website_or_contact}
                      onChange={(e) => handleFieldChange('website_or_contact', e.target.value)}
                      placeholder="barfroosh.ir"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500 text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">برچسب نسخه فاکتور:</label>
                    <input
                      type="text"
                      value={form.copy_label}
                      onChange={(e) => handleFieldChange('copy_label', e.target.value)}
                      placeholder="نسخه فروشگاه / نسخه حسابداری"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card H: اندازه کاغذ و جدول */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection('paper')}
              className="w-full p-3.5 bg-slate-950/60 hover:bg-slate-800/40 transition flex items-center justify-between text-right cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-100">ح) ابعاد کاغذ چاپی و تراکم جدول</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.paper ? 'rotate-180 text-emerald-400' : ''
                }`}
              />
            </button>

            {openSections.paper && (
              <div className="p-4 space-y-3.5 border-t border-slate-800/80 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">قطع پیش‌فرض کاغذ چاپ:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleFieldChange('paper_size', 'A4')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          form.paper_size === 'A4'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        قطع استاندارد A4
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFieldChange('paper_size', 'A5')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          form.paper_size === 'A5'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        قطع نیم‌برگ A5
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 self-end">
                    <div>
                      <span className="text-slate-200 font-medium block">حالت فشرده ردیف‌های جدول:</span>
                      <span className="text-slate-400 text-[11px]">پدینگ کمتر سطرها برای جا شدن اقلام بیشتر</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.compact_table}
                      onChange={(e) => handleFieldChange('compact_table', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* Column 2: Live Invoice Preview (5 cols on xl, sticky) */}
        {/* ============================================================== */}
        <div className="xl:col-span-5 space-y-3 xl:sticky xl:top-20">
          {/* Live Preview Mode Switcher */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
              <Eye className="w-4 h-4 text-blue-400" />
              <span>پیش‌نمایش زنده فاکتور</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setPreviewMode('direct')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  previewMode === 'direct'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                فروش مستقیم
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('visitor')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  previewMode === 'visitor'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                با ویزیتور
              </button>
            </div>
          </div>

          {/* Paper Sheet Preview Container (Rendered exactly based on form settings) */}
          <div className="rounded-2xl border border-slate-700/80 bg-white text-slate-900 p-4 shadow-2xl space-y-3 font-sans max-h-[82vh] overflow-y-auto no-scrollbar">
            {/* Header: Brand & Identity */}
            <div className="border-b-2 border-slate-900 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {form.show_logo && form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt={form.brand_name}
                      className="w-10 h-10 object-contain rounded-lg border border-slate-200 p-0.5 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-blue-900 text-white flex items-center justify-center font-black text-lg shrink-0">
                      {(form.brand_name || 'ف').slice(0, 1)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="font-black text-sm text-slate-900 leading-tight truncate">
                      {form.brand_name || 'شبکه پخش عمده'}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                      {form.legal_name || 'صنایع غذایی منجمد'}
                    </p>
                    {form.tagline && (
                      <p className="text-[9px] text-slate-400 truncate mt-0.5">
                        {form.tagline}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-left space-y-0.5 shrink-0 text-[10px]">
                  <div className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded font-mono font-bold text-slate-900 dir-ltr">
                    شماره: {previewMode === 'direct' ? 'SP01-1004-1' : 'VS03-1004-1'}
                  </div>
                  <div className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-slate-700 font-medium">
                    تاریخ: ۱۴۰۳/۰۷/۱۴
                  </div>
                  {form.show_page_number && (
                    <div className="text-[9px] text-slate-400 text-center font-mono">
                      صفحه ۱ از ۱
                    </div>
                  )}
                </div>
              </div>

              {/* Title Ribbon */}
              <div className="mt-2 bg-slate-900 text-white py-1 px-2.5 rounded-md font-bold text-[11px] flex items-center justify-between leading-none">
                <span>{form.invoice_title || 'صورت‌حساب فروش و تحویل کالا'}</span>
                <span className="text-[10px] text-slate-300 font-medium">
                  {previewMode === 'direct' ? form.direct_sale_title : form.visitor_sale_title}
                </span>
              </div>
            </div>

            {/* Seller & Buyer Info Cards */}
            <div className="grid grid-cols-2 gap-2 text-[10px] leading-snug">
              {/* Seller Box */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 space-y-1">
                <div className="flex items-center gap-1 font-bold text-slate-900 border-b border-slate-200 pb-0.5 text-[10.5px]">
                  <Building2 className="w-3 h-3 text-blue-700 shrink-0" />
                  <span className="truncate">فروشنده: {form.brand_name}</span>
                </div>
                <div className="text-slate-700 space-y-0.5 text-[9.5px]">
                  <p className="line-clamp-2">
                    <span className="text-slate-500 font-medium">نشانی:</span> {form.address || 'مرکز پخش سردخانه‌ای'}
                  </p>
                  <p className="truncate">
                    <span className="text-slate-500 font-medium">تلفن:</span>{' '}
                    {activeInvoicePhones.length > 0 ? (
                      <span className="font-mono text-slate-900">
                        {activeInvoicePhones.map((p) => `${p.label}: ${p.number}`).join(' · ')}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold">(شماره ثبت نشده)</span>
                    )}
                  </p>
                  {form.show_visitor_info && previewMode === 'visitor' && (
                    <p className="truncate text-blue-900 font-bold border-t border-slate-200/80 pt-0.5">
                      <span>ویزیتور:</span> مهدی حسینی (۰۹۱۲۳۴۵۶۷۸۹)
                    </p>
                  )}
                </div>
              </div>

              {/* Buyer Box */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50 space-y-1">
                <div className="flex items-center gap-1 font-bold text-slate-900 border-b border-slate-200 pb-0.5 text-[10.5px]">
                  <Store className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span className="truncate">خریدار: سوپرمارکت بهار</span>
                </div>
                <div className="text-slate-700 space-y-0.5 text-[9.5px]">
                  <p className="truncate">
                    <span className="text-slate-500 font-medium">متصدی:</span> محمد رضایی
                  </p>
                  <p className="truncate">
                    <span className="text-slate-500 font-medium">تلفن:</span>{' '}
                    <span className="font-mono text-slate-900">۰۹۱۱۱۲۲۳۳۴۴</span>
                  </p>
                  {form.show_buyer_address && (
                    <p className="line-clamp-1">
                      <span className="text-slate-500 font-medium">نشانی:</span> بابل، میدان کارگر، روبروی بانک ملی
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Optional Legal IDs Bar */}
            {(form.national_id || form.economic_code || form.registration_number || form.postal_code) && (
              <div className="border border-slate-200 rounded-lg p-1.5 bg-slate-50 text-[9px] font-mono flex items-center justify-around text-slate-700 flex-wrap gap-1">
                {form.national_id && <span>شناسه ملی: {form.national_id}</span>}
                {form.economic_code && <span>کد اقتصادی: {form.economic_code}</span>}
                {form.registration_number && <span>شماره ثبت: {form.registration_number}</span>}
                {form.postal_code && <span>کد پستی: {form.postal_code}</span>}
              </div>
            )}

            {/* Items Table */}
            <div className="border border-slate-900 rounded-lg overflow-hidden">
              <table className="w-full text-right text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold leading-none">
                    <th className="py-1 px-1.5 border-l border-slate-700 text-center w-7">ردیف</th>
                    <th className="py-1 px-2 border-l border-slate-700 text-right">شرح کالا</th>
                    <th className="py-1 px-1.5 border-l border-slate-700 text-center w-16">تعداد</th>
                    <th className="py-1 px-1.5 border-l border-slate-700 text-left w-20">فی (تومان)</th>
                    <th className="py-1 px-2 text-left w-24">مبلغ کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sampleItems.map((item, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                    >
                      <td className={`border-l border-slate-200 text-center font-bold text-slate-600 text-[9px] ${form.compact_table ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>
                        {(idx + 1).toLocaleString('fa-IR')}
                      </td>
                      <td className={`border-l border-slate-200 font-semibold text-slate-900 leading-tight ${form.compact_table ? 'py-0.5 px-1.5' : 'py-1 px-2'}`}>
                        {item.name}
                      </td>
                      <td className={`border-l border-slate-200 text-center font-bold text-slate-800 whitespace-nowrap ${form.compact_table ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>
                        {item.qty.toLocaleString('fa-IR')} {item.unit}
                      </td>
                      <td className={`border-l border-slate-200 text-left font-mono font-medium text-slate-800 whitespace-nowrap ${form.compact_table ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>
                        {item.price.toLocaleString('fa-IR')}
                      </td>
                      <td className={`text-left font-mono font-bold text-slate-950 whitespace-nowrap ${form.compact_table ? 'py-0.5 px-1.5' : 'py-1 px-2'}`}>
                        {(item.qty * item.price).toLocaleString('fa-IR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Totals */}
            <div className="space-y-1.5 text-[10px]">
              {form.show_amount_in_words && (
                <div className="border border-slate-300 rounded-lg p-1.5 px-2 bg-slate-50 flex items-center justify-between gap-1.5">
                  <span className="text-slate-600 font-medium shrink-0 text-[9.5px]">مبلغ کل به حروف:</span>
                  <span className="font-bold text-slate-900 truncate">
                    {numberToPersianWords(sampleTotalPayable)} تومان
                  </span>
                </div>
              )}

              {/* VAT and Totals Ribbon */}
              <div className="border border-slate-900 rounded-lg bg-slate-900 text-white p-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-300 text-[9.5px]">
                  <span>اقلام: <strong className="text-white font-mono">{sampleTotalItemsCount.toLocaleString('fa-IR')}</strong></span>
                  {form.has_vat && (
                    <span className="text-amber-300">
                      (مالیات {form.vat_percent}٪: {sampleVatAmount.toLocaleString('fa-IR')} ت)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-200 font-bold text-[11px]">مبلغ قابل پرداخت:</span>
                  <div className="font-mono font-black text-sm text-emerald-400">
                    {sampleTotalPayable.toLocaleString('fa-IR')}{' '}
                    <span className="text-[9px] font-normal text-slate-300">تومان</span>
                  </div>
                </div>
              </div>

              {/* Bank Account Details (if specified) */}
              {(form.card_number || form.iban || form.bank_account_holder) && (
                <div className="border border-slate-300 rounded-lg p-1.5 px-2 bg-slate-50 text-[9px] leading-tight text-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <span className="font-medium text-slate-800">
                    واریز به حساب: <strong>{form.bank_account_holder}</strong>
                  </span>
                  {form.card_number && <span className="font-mono">کارت: {form.card_number}</span>}
                  {form.iban && <span className="font-mono dir-ltr">{form.iban}</span>}
                </div>
              )}

              {/* Payment Terms */}
              {form.payment_terms && (
                <div className="text-[9px] text-slate-600 leading-tight">
                  <span className="font-semibold text-slate-800">شرایط پرداخت:</span> {form.payment_terms}
                </div>
              )}
            </div>

            {/* Signature Boxes */}
            {form.show_signature_boxes && (
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-300 text-center text-[9px] text-slate-600">
                <div className="border border-dashed border-slate-300 rounded-lg p-2 h-14 flex flex-col justify-between">
                  <span className="font-bold text-slate-800">مهر و امضای فروشنده</span>
                </div>
                <div className="border border-dashed border-slate-300 rounded-lg p-2 h-14 flex flex-col justify-between">
                  <span className="font-bold text-slate-800">امضای خریدار / متصدی</span>
                </div>
                <div className="border border-dashed border-slate-300 rounded-lg p-2 h-14 flex flex-col justify-between">
                  <span className="font-bold text-slate-800">امضای تحویل‌گیرنده</span>
                </div>
              </div>
            )}

            {/* Footer Notes & Website */}
            <div className="border-t border-slate-300 pt-1.5 text-[8.5px] text-slate-500 flex items-center justify-between gap-2 leading-tight">
              <span className="truncate">{form.footer_notes}</span>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                {form.website_or_contact && <span>{form.website_or_contact}</span>}
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-sans text-slate-700">
                  {form.copy_label || 'نسخه فروشگاه'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
