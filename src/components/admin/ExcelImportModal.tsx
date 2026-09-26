import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product, Category } from '../../types';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw,
  Plus,
  Eye,
  Check,
  Download,
} from 'lucide-react';
import { formatPrice } from './helpers';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  existingProducts: Product[];
  onImportConfirm: (
    items: Array<{
      id?: string;
      name: string;
      category_id?: string;
      brand?: string;
      price: number;
      visitor_price?: number;
      stock?: number;
      unit?: string;
      is_active?: boolean;
    }>
  ) => void;
}

interface ColumnMapping {
  idCol: string;
  nameCol: string;
  brandCol: string;
  categoryCol: string;
  storePriceCol: string;
  visitorPriceCol: string;
  stockCol: string;
  unitCol: string;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  categories,
  existingProducts,
  onImportConfirm,
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [fileName, setFileName] = useState('');
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    idCol: '',
    nameCol: '',
    brandCol: '',
    categoryCol: '',
    storePriceCol: '',
    visitorPriceCol: '',
    stockCol: '',
    unitCol: '',
  });

  const [parsedRows, setParsedRows] = useState<
    Array<{
      id?: string;
      name: string;
      brand: string;
      category_id: string;
      category_name: string;
      price: number;
      visitor_price: number;
      stock: number;
      unit: string;
      isNew: boolean;
      isValid: boolean;
      error?: string;
    }>
  >([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Auto-detect column headers based on common Persian & English keywords
  const autoDetectColumns = (columns: string[]): ColumnMapping => {
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_\-]/g, '');

    const findMatch = (keywords: string[]) => {
      return (
        columns.find((col) => {
          const norm = normalize(col);
          return keywords.some((kw) => norm.includes(kw));
        }) || ''
      );
    };

    return {
      idCol: findMatch(['شناسه', 'کدکالا', 'کد', 'id', 'code', 'productid', 'sku']),
      nameCol: findMatch(['نامکالا', 'ناممحصول', 'عنوان', 'نام', 'name', 'title', 'product']),
      brandCol: findMatch(['برند', 'مارک', 'تولیدکننده', 'brand', 'maker', 'company']),
      categoryCol: findMatch(['دسته', 'گروه', 'گروهکالا', 'category', 'cat', 'group']),
      storePriceCol: findMatch([
        'قیمتفروشگاه',
        'قیمتمشتری',
        'قیمتسوپرمارکت',
        'قیمتمصرف',
        'قیمتفروش',
        'نرخفروشگاه',
        'storeprice',
        'shopprice',
        'price',
      ]),
      visitorPriceCol: findMatch([
        'قیمتوformatویزیتور',
        'قیمتوویزیتور',
        'قیمتخریدویزیتور',
        'نرخویزیتور',
        'خریدویزیتور',
        'visitorprice',
        'cost',
        'buyprice',
      ]),
      stockCol: findMatch(['موجودی', 'تعداد', 'انبار', 'stock', 'qty', 'quantity', 'inventory']),
      unitCol: findMatch(['واحد', 'واحدشمارش', 'بسته/عدد', 'unit', 'measure']),
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!data || data.length < 2) {
          setErrorMessage('فایل اکسل انتخاب‌شده حاوی داده کافی (سرستون و سطرها) نمی‌باشد.');
          setIsProcessing(false);
          return;
        }

        const rawHeaders = (data[0] || []).map((h) => String(h || '').trim()).filter(Boolean);
        if (rawHeaders.length === 0) {
          setErrorMessage('سرستون‌های فایل اکسل قابل شناسایی نیستند.');
          setIsProcessing(false);
          return;
        }

        // Convert rows to json objects
        const rows = XLSX.utils.sheet_to_json(ws) as any[];

        setHeaders(rawHeaders);
        setSheetData(rows);

        const detectedMapping = autoDetectColumns(rawHeaders);
        setMapping(detectedMapping);
        setStep('mapping');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطا در پردازش فایل اکسل.';
        setErrorMessage(msg);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('خطا در خواندن فایل اکسل.');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  // Build Preview from Mapping
  const handleProceedToPreview = () => {
    if (!mapping.nameCol) {
      setErrorMessage('لطفاً ستون مشخص‌کننده «نام کالا» را انتخاب کنید.');
      return;
    }
    if (!mapping.storePriceCol) {
      setErrorMessage('لطفاً ستون مشخص‌کننده «قیمت خرید فروشگاه» را انتخاب کنید.');
      return;
    }

    setErrorMessage(null);

    const rows: typeof parsedRows = [];

    sheetData.forEach((row, idx) => {
      const rawName = String(row[mapping.nameCol] || '').trim();
      if (!rawName) return; // ignore empty rows

      const rawId = mapping.idCol ? String(row[mapping.idCol] || '').trim() : undefined;
      const rawBrand = mapping.brandCol ? String(row[mapping.brandCol] || '').trim() : 'متفرقه';
      const rawCat = mapping.categoryCol ? String(row[mapping.categoryCol] || '').trim() : '';

      // Clean numeric prices (strip commas, spaces)
      const cleanNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const str = String(val).replace(/[^0-9.]/g, '');
        return parseFloat(str) || 0;
      };

      const storePrice = cleanNum(row[mapping.storePriceCol]);
      let visitorPrice = mapping.visitorPriceCol ? cleanNum(row[mapping.visitorPriceCol]) : 0;
      if (!visitorPrice && storePrice > 0) {
        visitorPrice = Math.round(storePrice * 0.85); // 85% default
      }

      const stock = mapping.stockCol ? cleanNum(row[mapping.stockCol]) : 50;
      const unit = mapping.unitCol ? String(row[mapping.unitCol] || '').trim() || 'عدد' : 'عدد';

      // Match category
      let matchedCat = categories.find((c) => c.name.trim() === rawCat || c.id === rawCat);
      if (!matchedCat && rawCat) {
        matchedCat = categories.find((c) => c.name.includes(rawCat) || rawCat.includes(c.name));
      }
      const category_id = matchedCat?.id || categories[0]?.id || 'cat-1';
      const category_name = matchedCat?.name || categories[0]?.name || 'عمومی';

      // Check if item exists
      const isExisting = existingProducts.some((p) => {
        if (rawId && p.id.toLowerCase() === rawId.toLowerCase()) return true;
        return p.name.trim().toLowerCase() === rawName.toLowerCase();
      });

      const isValid = storePrice > 0;
      const error = !isValid ? 'قیمت فروشگاه باید بزرگتر از صفر باشد' : undefined;

      rows.push({
        id: rawId,
        name: rawName,
        brand: rawBrand || 'متفرقه',
        category_id,
        category_name,
        price: storePrice,
        visitor_price: visitorPrice,
        stock,
        unit,
        isNew: !isExisting,
        isValid,
        error,
      });
    });

    if (rows.length === 0) {
      setErrorMessage('هیچ سطر معتبری با ستون‌های انتخابی استخراج نشد.');
      return;
    }

    setParsedRows(rows);
    setStep('preview');
  };

  const handleApplyImport = () => {
    const validItems = parsedRows.filter((r) => r.isValid);
    if (validItems.length === 0) {
      setErrorMessage('هیچ کالای معتبری برای ثبت در سامانه وجود ندارد.');
      return;
    }

    onImportConfirm(
      validItems.map((r) => ({
        id: r.id,
        name: r.name,
        category_id: r.category_id,
        brand: r.brand,
        price: r.price,
        visitor_price: r.visitor_price,
        stock: r.stock,
        unit: r.unit,
        is_active: true,
      }))
    );

    onClose();
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        'کد کالا': 'prod-101',
        'نام کالا': 'بستنی مگنوم کلاسیک',
        'برند': 'میهن',
        'دسته‌بندی': 'بستنی و پالپ',
        'قیمت فروشگاه (تومان)': 30000,
        'قیمت خرید ویزیتور (تومان)': 25500,
        'موجودی': 100,
        'واحد': 'عدد',
      },
      {
        'کد کالا': 'prod-102',
        'نام کالا': 'سوسیس کراکف پنیری',
        'برند': 'دمس',
        'دسته‌بندی': 'محصولات منجمد و پروتئینی',
        'قیمت فروشگاه (تومان)': 280000,
        'قیمت خرید ویزیتور (تومان)': 240000,
        'موجودی': 45,
        'واحد': 'کیلوگرم',
      },
      {
        'کد کالا': 'prod-103',
        'نام کالا': 'آبمیوه هلو ۱ لیتری',
        'برند': 'سن‌ایچ',
        'دسته‌بندی': 'نوشیدنی خنک',
        'قیمت فروشگاه (تومان)': 45000,
        'قیمت خرید ویزیتور (تومان)': 38000,
        'موجودی': 80,
        'واحد': 'باکس',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کالاها');
    XLSX.writeFile(wb, 'قالب_استاندارد_کالاهای_البرز.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">بارگذاری و تطبیق فایل اکسل کالاها و قیمت‌ها</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ایجاد کالاهای جدید، به‌روزرسانی قیمت‌های دوگانه (فروشگاه و ویزیتور) و موجودی انبار
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              ۱
            </span>
            <span className={step === 'upload' ? 'text-slate-100 font-bold' : 'text-slate-400'}>
              انتخاب و آپلود فایل
            </span>
          </div>

          <div className="h-0.5 w-8 bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step === 'mapping' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              ۲
            </span>
            <span className={step === 'mapping' ? 'text-slate-100 font-bold' : 'text-slate-400'}>
              تطبیق و نگاشت ستون‌ها
            </span>
          </div>

          <div className="h-0.5 w-8 bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step === 'preview' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              ۳
            </span>
            <span className={step === 'preview' ? 'text-slate-100 font-bold' : 'text-slate-400'}>
              پیش‌نمایش و اعمال نهایی
            </span>
          </div>
        </div>

        {/* Body content based on step */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6 text-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-8 sm:p-12 transition cursor-pointer bg-slate-950/40 hover:bg-emerald-950/10 flex flex-col items-center justify-center group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-100 mt-4">
                  فایل اکسل لیست کالاها و قیمت‌ها را اینجا رها کنید
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  پشتیبانی از فرمت‌های XLSX, XLS و CSV. ستون‌ها به صورت هوشمند بر اساس عناوین فارسی و انگلیسی تطبیق داده خواهند شد.
                </p>
                <button
                  type="button"
                  className="mt-5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
                >
                  انتخاب فایل از سیستم
                </button>
              </div>

              {/* Sample Template Download */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-right flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-200">نیاز به قالب آماده اکسل دارید؟</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    می‌توانید فایل نمونه با ستون‌های استاندارد قیمت فروشگاه و قیمت خرید ویزیتور را دانلود نمایید.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود تمپلیت اکسل نمونه</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4 text-right">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  فایل بارگذاری شده: <strong className="text-emerald-400 font-mono">{fileName}</strong> ({sheetData.length} سطر شناسایی شد)
                </span>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تعویض فایل</span>
                </button>
              </div>

              <p className="text-xs text-slate-400">
                ستون‌های فایل اکسل شما به صورت خودکار شناسایی شده‌اند. در صورت نیاز می‌توانید نگاشت هر فیلد را به ستون دلخواه تغییر دهید:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Product Name */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>نام کالا <span className="text-amber-400">*</span></span>
                    <span className="text-[10px] text-slate-500">الزامی</span>
                  </label>
                  <select
                    value={mapping.nameCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, nameCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- انتخاب ستون --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Product Code / ID */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>کد / شناسه کالا</span>
                    <span className="text-[10px] text-slate-500">اختیاری (تطبیق تکراری)</span>
                  </label>
                  <select
                    value={mapping.idCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, idCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- بدون ستون شناسه --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Store Purchase Price */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>قیمت خرید فروشگاه (تومان) <span className="text-amber-400">*</span></span>
                    <span className="text-[10px] text-emerald-400 font-bold">نمایش به مشتری</span>
                  </label>
                  <select
                    value={mapping.storePriceCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, storePriceCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- انتخاب ستون --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Visitor Purchase Price */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>قیمت خرید ویزیتور (تومان)</span>
                    <span className="text-[10px] text-blue-400 font-bold">محرمانه (فقط ادمین)</span>
                  </label>
                  <select
                    value={mapping.visitorPriceCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, visitorPriceCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- محاسبه خودکار (۸۵٪ قیمت فروشگاه) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Brand */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <label className="text-xs font-bold text-slate-200">برند / کارخانه سازنده</label>
                  <select
                    value={mapping.brandCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, brandCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- بدون برند (متفرقه) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <label className="text-xs font-bold text-slate-200">دسته‌بندی کالا</label>
                  <select
                    value={mapping.categoryCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, categoryCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- دسته پیش‌فرض --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock Quantity */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <label className="text-xs font-bold text-slate-200">موجودی انبار</label>
                  <select
                    value={mapping.stockCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, stockCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- بدون ستون موجودی --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <label className="text-xs font-bold text-slate-200">واحد شمارش (عدد / باکس / کیلو)</label>
                  <select
                    value={mapping.unitCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, unitCol: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- واحد پیش‌فرض (عدد) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4 text-right">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400">کل اقلام پردازش شده</span>
                  <p className="text-lg font-bold text-slate-100 font-mono mt-0.5">{parsedRows.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60">
                  <span className="text-[11px] text-emerald-300">کالاهای جدید</span>
                  <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {parsedRows.filter((r) => r.isNew && r.isValid).length}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60">
                  <span className="text-[11px] text-blue-300">به‌روزرسانی قیمت/موجودی</span>
                  <p className="text-lg font-bold text-blue-400 font-mono mt-0.5">
                    {parsedRows.filter((r) => !r.isNew && r.isValid).length}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60">
                  <span className="text-[11px] text-rose-300">خطادار (رد شده)</span>
                  <p className="text-lg font-bold text-rose-400 font-mono mt-0.5">
                    {parsedRows.filter((r) => !r.isValid).length}
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">وضعیت</th>
                        <th className="p-2.5">نام کالا</th>
                        <th className="p-2.5">برند</th>
                        <th className="p-2.5 text-emerald-400">قیمت فروشگاه</th>
                        <th className="p-2.5 text-blue-400">قیمت ویزیتور</th>
                        <th className="p-2.5">موجودی</th>
                        <th className="p-2.5">واحد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {parsedRows.map((row, i) => (
                        <tr key={i} className={`hover:bg-slate-900/60 ${!row.isValid ? 'bg-rose-950/10' : ''}`}>
                          <td className="p-2.5 whitespace-nowrap">
                            {!row.isValid ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                خطای قیمت
                              </span>
                            ) : row.isNew ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                + کالای جدید
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                ↺ به‌روزرسانی
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-100">{row.name}</td>
                          <td className="p-2.5 text-slate-300">{row.brand}</td>
                          <td className="p-2.5 font-bold font-mono text-emerald-400">{formatPrice(row.price)}</td>
                          <td className="p-2.5 font-bold font-mono text-blue-400">{formatPrice(row.visitor_price)}</td>
                          <td className="p-2.5 font-mono text-slate-300">{row.stock}</td>
                          <td className="p-2.5 text-slate-400">{row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div>
            {step === 'mapping' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>مرحله قبل</span>
              </button>
            )}
            {step === 'preview' && (
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>ویرایش نگاشت</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              انصراف
            </button>

            {step === 'mapping' && (
              <button
                type="button"
                onClick={handleProceedToPreview}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-600/30"
              >
                <span>مشاهده پیش‌نمایش</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {step === 'preview' && (
              <button
                type="button"
                onClick={handleApplyImport}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                <Check className="w-4 h-4" />
                <span>تایید و اعمال به کاتالوگ سامانه</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
