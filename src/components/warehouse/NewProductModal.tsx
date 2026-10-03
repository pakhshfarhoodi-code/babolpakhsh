import React, { useState } from 'react';
import { Category } from '../../types';
import { CategorySelectPicker, BrandSelectPicker } from '../CategoryBrandSelectors';
import { PackagePlus, X, DollarSign, Warehouse, Package } from 'lucide-react';

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
    consumer_price?: number;
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
  const [brand, setBrand] = useState(() => brands[0] || '');
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id || '');
  const [price, setPrice] = useState<number>(0);
  const [visitorPrice, setVisitorPrice] = useState<number>(0);
  const [consumerPrice, setConsumerPrice] = useState<number>(0);
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
      consumer_price: consumerPrice > 0 ? consumerPrice : undefined,
      stock,
      unit,
      image_url: getSampleImage(categoryId),
    });

    onClose();
    setName('');
    setPrice(0);
    setVisitorPrice(0);
    setConsumerPrice(0);
    setStock(50);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-5 my-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">تعریف کالای جدید در انبار و سردخانه</h3>
              <p className="text-xs text-slate-400">اطلاعات کالا، نرخ‌ها و موجودی ورودی به انبار را ثبت کنید</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Basic Info */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              شناسه کالا
            </span>

            <div>
              <label className="block text-slate-200 mb-1 font-semibold">
                نام کامل کالا <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <CategorySelectPicker
                selectedCategoryId={categoryId}
                onSelectCategory={setCategoryId}
              />
              <BrandSelectPicker
                selectedBrand={brand}
                onSelectBrand={setBrand}
              />
            </div>
          </div>

          {/* Pricing Section */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              نرخ‌گذاری کالا (تومان)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-emerald-400 mb-1 font-semibold">
                  خرید فروشگاه <span className="text-amber-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={price || ''}
                  onChange={(e) => handlePriceChange(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-emerald-300 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-blue-400 mb-1 font-semibold flex items-center justify-between">
                  <span>خرید ویزیتور</span>
                  <span className="text-[10px] text-blue-400">محرمانه</span>
                </label>
                <input
                  type="number"
                  min="1000"
                  value={visitorPrice || ''}
                  onChange={(e) => setVisitorPrice(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-blue-300 focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-amber-400 mb-1 font-semibold flex items-center justify-between">
                  <span>قیمت مصرف‌کننده</span>
                  <span className="text-[10px] text-slate-400">اختیاری</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={consumerPrice || ''}
                  onChange={(e) => setConsumerPrice(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-amber-300 focus:outline-none focus:border-amber-500 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Inventory & Unit */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5" />
              موجودی و واحد سنجش
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">واحد سنجش</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value="عدد">عدد</option>
                  <option value="باکس">باکس</option>
                  <option value="بسته">بسته</option>
                  <option value="کیلوگرم">کیلوگرم</option>
                  <option value="سطل">سطل</option>
                  <option value="جعبه">جعبه</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">موجودی اولیه فیزیکی انبار</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={stock || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setStock(isNaN(val) ? 0 : Math.round(val * 1000) / 1000);
                  }}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
            >
              <PackagePlus className="w-4 h-4" />
              <span>ثبت کالا در سردخانه</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
