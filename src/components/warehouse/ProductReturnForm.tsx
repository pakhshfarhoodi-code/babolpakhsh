import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Product } from '../../types';
import { formatNumber } from './helpers';
import {
  RotateCcw,
  Search,
  X,
  Check,
} from 'lucide-react';

interface ProductReturnFormProps {
  products: Product[];
  onSubmitReturn: (productId: string, quantity: number, reason: string) => void;
}

export const ProductReturnForm: React.FC<ProductReturnFormProps> = ({
  products,
  onSubmitReturn,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selected product object
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Filtered products for combobox
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setSearchQuery(product.name);
    setIsDropdownOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedProductId('');
    setSearchQuery('');
    setIsDropdownOpen(true);
    searchInputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0) return;

    onSubmitReturn(selectedProductId, quantity, reason);

    // Reset form
    setSelectedProductId('');
    setSearchQuery('');
    setQuantity(1);
    setReason('');
    setIsDropdownOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-emerald-400" />
          <span>ثبت مرجوعی کالا به انبار</span>
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Combobox Search Input */}
        <div ref={containerRef} className="relative">
          <label className="block text-slate-300 font-medium mb-1.5">
            انتخاب کالا جهت مرجوعی:
          </label>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
                if (selectedProductId) {
                  setSelectedProductId('');
                }
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="جستجو نام کالا..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pr-9 pl-9 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />

            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="absolute left-3 top-2.5 p-1 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Combobox Options Dropdown */}
          {isDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-slate-950 border border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-800/60 animate-in fade-in">
              {filteredProducts.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">
                  کالایی یافت نشد.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = p.id === selectedProductId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-emerald-950/60 text-emerald-300'
                          : 'text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <p className="font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          موجودی فعلی:{' '}
                          <span className="font-mono font-bold text-slate-300">
                            {formatNumber(p.stock)}
                          </span>{' '}
                          {p.unit}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected Product Snapshot */}
        {selectedProduct && (
          <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">موجودی فعلی انبار:</span>
            <span className="font-bold text-emerald-300 font-mono">
              {formatNumber(selectedProduct.stock)} {selectedProduct.unit}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Quantity */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              تعداد مرجوعی:
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity || ''}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
              placeholder="1"
            />
          </div>

          {/* Reason */}
          <div className="sm:col-span-2">
            <label className="block text-slate-300 font-medium mb-1.5">
              دلیل مرجوعی (متن کوتاه):
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: انقضاء تاریخ / انصراف مغازه‌دار / آسیب بسته‌بندی"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedProductId || quantity <= 0}
          className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>ثبت مرجوعی به انبار</span>
        </button>
      </form>
    </div>
  );
};
