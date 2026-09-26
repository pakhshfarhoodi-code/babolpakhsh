import React, { useState } from 'react';
import { Category } from '../../types';
import { CategorySelectPicker, BrandSelectPicker } from '../CategoryBrandSelectors';
import { PackagePlus, X } from 'lucide-react';

interface NewProductModalProps {
  isOpen: boolean;
  categories: Category[];
  brands: string[];
  onClose: () => void;
  onCreateProduct: (data: {
    name: string;
    brand: string;
    category_id: string;
    price: number;
    visitor_price?: number;
    stock: number;
    unit: string;
    image_url: string;
  }) => void;
}

export const NewProductModal: React.FC<NewProductModalProps> = ({
  isOpen,
  categories,
  brands,
  onClose,
  onCreateProduct,
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('میهن');
  const [categoryId, setCategoryId] = useState('cat-1');
  const [price, setPrice] = useState<number>(0);
  const [visitorPrice, setVisitorPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(50);
  const [unit, setUnit] = useState('عدد');

  if (!isOpen) return null;

  const getSampleImage = (catId: string) => {
    switch (catId) {
      case 'cat-1': // بستنی و پالپ
        return 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
      case 'cat-2': // محصولات منجمد و پروتئینی
        return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
      case 'cat-3': // لبنیات زنجیره سرد
        return 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
      case 'cat-4': // نوشیدنی خنک
        return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
      case 'cat-5': // کیک و تنقلات سوپرمارکتی
      default:
        return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer';
    }
  };

  const handlePriceChange = (val: number) => {
    setPrice(val);
    if (!visitorPrice || visitorPrice === Math.round(price * 0.85)) {
      setVisitorPrice(Math.round(val * 0.85));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price <= 0) return;

    onCreateProduct({
      name: name.trim(),
      brand: brand.trim() || 'متفرقه',
      category_id: categoryId,
      price,
      visitor_price: visitorPrice > 0 ? visitorPrice : Math.round(price * 0.85),
      stock,
      unit,
      image_url: getSampleImage(categoryId),
    });

    onClose();
    setName('');
    setBrand('میهن');
    setPrice(0);
    setVisitorPrice(0);
    setStock(50);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <PackagePlus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-100">تعریف کالای جدید در سردخانه</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-medium">نام کالا</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
              placeholder="مثال: بستنی دبل چاکلت میهن"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CategorySelectPicker
              selectedCategoryId={categoryId}
              onSelectCategory={setCategoryId}
            />
            <BrandSelectPicker
              selectedBrand={brand}
              onSelectBrand={setBrand}
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">واحد سنجش</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="عدد">عدد</option>
              <option value="باکس">باکس</option>
              <option value="بسته">بسته</option>
              <option value="کیلوگرم">کیلوگرم</option>
              <option value="سطل">سطل</option>
              <option value="جعبه">جعبه</option>
            </select>
          </div>

          {/* Dual Pricing Section */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-300 block">نرخ‌گذاری دوگانه کالا:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-emerald-400 mb-1 font-semibold text-[11px]">
                  قیمت خرید فروشگاه (تومان)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={price || ''}
                  onChange={(e) => handlePriceChange(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner font-mono font-bold"
                  placeholder="85000"
                />
              </div>
              <div>
                <label className="block text-blue-400 mb-1 font-semibold text-[11px]">
                  قیمت خرید ویزیتور (تومان)
                </label>
                <input
                  type="number"
                  min="1000"
                  value={visitorPrice || ''}
                  onChange={(e) => setVisitorPrice(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-blue-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-inner font-mono font-bold"
                  placeholder="72250"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">موجودی اولیه فیزیکی</label>
            <input
              type="number"
              min="1"
              required
              value={stock || ''}
              onChange={(e) => setStock(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner font-mono"
              placeholder="50"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition shadow-md shadow-indigo-600/25"
            >
              ثبت کالا در سردخانه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
