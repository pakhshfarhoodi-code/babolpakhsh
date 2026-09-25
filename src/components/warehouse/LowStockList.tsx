import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { LOW_STOCK_THRESHOLD, formatNumber } from './helpers';
import {
  Boxes,
  Search,
  Filter,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface LowStockListProps {
  products: Product[];
}

export const LowStockList: React.FC<LowStockListProps> = ({ products }) => {
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredProducts = useMemo(() => {
    let result = products;

    if (onlyLowStock) {
      result = result.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }

    return result;
  }, [products, onlyLowStock, searchTerm]);

  const totalLowStockCount = useMemo(
    () => products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length,
    [products]
  );

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-sm space-y-3.5">
      {/* Header and Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Boxes className="w-4 h-4 text-indigo-400" />
          <span>پایش موجودی فیزیکی و رزرو سردخانه</span>
        </h3>

        {/* Filter Chip / Switch */}
        <button
          type="button"
          onClick={() => setOnlyLowStock((prev) => !prev)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
            onlyLowStock
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>فقط کم‌موجودها (زیر {LOW_STOCK_THRESHOLD})</span>
          <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
            {totalLowStockCount}
          </span>
        </button>
      </div>

      {/* Mini Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="جستجوی سریع در نام کالا یا برند..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pr-8 pl-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
        <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-3 pointer-events-none" />
      </div>

      {/* Products List */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
        {filteredProducts.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60">
            {onlyLowStock
              ? 'هیچ کالایی با موجودی بحرانی یا کمتر از آستانه یافت نشد.'
              : 'کالایی با این مشخصات یافت نشد.'}
          </div>
        ) : (
          filteredProducts.map((p) => {
            const free = p.stock - p.reserved_stock;
            const isLow = p.stock <= LOW_STOCK_THRESHOLD;

            return (
              <div
                key={p.id}
                className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                  isLow
                    ? 'bg-amber-950/15 border-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    {isLow && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <p className="font-semibold text-slate-200 text-xs truncate">
                      {p.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span>برند: {p.brand || 'عمومی'}</span>
                    <span>·</span>
                    <span>
                      رزرو سفارشات:{' '}
                      <span className="text-amber-400 font-bold font-mono">
                        {formatNumber(p.reserved_stock)}
                      </span>{' '}
                      {p.unit}
                    </span>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <div className="text-xs font-bold text-slate-100 font-mono">
                    {formatNumber(p.stock)}{' '}
                    <span className="text-xs font-normal text-slate-400">کل</span>
                  </div>
                  <div
                    className={`text-xs font-bold font-mono ${
                      free <= 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatNumber(free)} آزاد
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
