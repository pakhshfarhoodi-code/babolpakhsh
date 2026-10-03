import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Product, Category } from '../../types';
import { Download, FileSpreadsheet, Filter, Check, X, Layers, Tag } from 'lucide-react';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  brands: string[];
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  products,
  categories,
  brands,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [includeStock, setIncludeStock] = useState<boolean>(true);
  const [includeVisitorPrice, setIncludeVisitorPrice] = useState<boolean>(true);

  if (!isOpen) return null;

  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
    if (selectedBrand !== 'all' && (p.brand || 'متفرقه') !== selectedBrand) return false;
    return true;
  });

  const handleExport = () => {
    const exportRows = filteredProducts.map((p) => {
      const cat = categories.find((c) => c.id === p.category_id);
      const row: Record<string, any> = {
        'کد کالا': p.id,
        'نام کالا': p.name,
        'برند': p.brand || 'متفرقه',
        'دسته‌بندی': cat?.name || 'عمومی',
      };

      if (includeVisitorPrice) {
        row['قیمت خرید ویزیتور (تومان)'] = p.visitor_price || Math.round(p.price * 0.85);
      }

      row['قیمت خرید فروشگاه (تومان)'] = p.price;
      row['قیمت مصرف‌کننده (تومان)'] = p.consumer_price && p.consumer_price > 0 ? p.consumer_price : '';

      if (includeStock) {
        row['موجودی کل انبار'] = p.stock;
        row['موجودی رزرو شده'] = p.reserved_stock;
        row['موجودی آزاد قابل فروش'] = Math.round(Math.max(0, p.stock - p.reserved_stock) * 1000) / 1000;
      }

      row['واحد شمارش'] = p.unit;
      row['تعداد در کارتن/بسته'] = p.items_per_package && p.items_per_package > 0 ? p.items_per_package : '';
      row['وضعیت کالا'] = p.is_active ? 'فعال' : 'غیرفعال';

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();

    let sheetName = 'کاتالوگ کالاها';
    if (selectedCategory !== 'all') {
      const cat = categories.find((c) => c.id === selectedCategory);
      if (cat) sheetName = cat.name.slice(0, 25);
    } else if (selectedBrand !== 'all') {
      sheetName = selectedBrand.slice(0, 25);
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const dateStr = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .replace(/[\/\\]/g, '-');

    const fileName = `گزارش_کالاهای_بارفروش_فرهودی_${sheetName}_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">استخراج فایل اکسل کاتالوگ و قیمت‌ها</h2>
              <p className="text-xs text-slate-400 mt-0.5">دانلود تجمیعی یا تفکیک‌شده بر اساس دسته و برند</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Filters */}
        <div className="p-5 sm:p-6 space-y-4 text-right">
          {/* Category Filter */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>فیلتر بر اساس دسته‌بندی کالا</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">همه دسته‌بندی‌ها ({products.length} کالا)</option>
              {categories.map((c) => {
                const count = products.filter((p) => p.category_id === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({count} کالا)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Brand Filter */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>فیلتر بر اساس برند / شرکت تولیدکننده</span>
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">همه برندها</option>
              {brands.map((b) => {
                const count = products.filter((p) => (p.brand || 'متفرقه') === b).length;
                return (
                  <option key={b} value={b}>
                    {b} ({count} کالا)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Export Options */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-300 block">گزینه‌های ستون‌های خروجی:</label>
            
            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 cursor-pointer">
              <input
                type="checkbox"
                checked={includeVisitorPrice}
                onChange={(e) => setIncludeVisitorPrice(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-xs text-slate-200">
                درج ستون قیمت خرید ویزیتور (مخصوص مدیریت و امور مالی)
              </span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 cursor-pointer">
              <input
                type="checkbox"
                checked={includeStock}
                onChange={(e) => setIncludeStock(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-xs text-slate-200">
                درج اطلاعات تفصیلی موجودی انبار (کل، رزرو شده، آزاد)
              </span>
            </label>
          </div>

          {/* Info Banner */}
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200 flex items-center justify-between">
            <span>تعداد کالاهای منتخب جهت استخراج:</span>
            <strong className="text-emerald-400 font-mono text-sm">{filteredProducts.length} کالا</strong>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 transition cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={filteredProducts.length === 0}
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-blue-600/30"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>دانلود فایل اکسل</span>
          </button>
        </div>
      </div>
    </div>
  );
};
