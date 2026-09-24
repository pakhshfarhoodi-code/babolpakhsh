import React, { useState } from 'react';
import { X, Check, Search, Tag } from 'lucide-react';

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  availableBrands: string[];
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;
  onClearFilter: () => void;
}

export const FilterSheet: React.FC<FilterSheetProps> = ({
  isOpen,
  onClose,
  availableBrands,
  selectedBrand,
  onSelectBrand,
  onClearFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredBrands = availableBrands.filter((b) =>
    b.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">فیلتر برند کالا</h3>
              <p className="text-xs text-slate-400">{availableBrands.length} برند در این دسته‌بندی</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input if more than 5 brands */}
        {availableBrands.length > 5 && (
          <div className="p-3 border-b border-slate-800 bg-slate-950/20">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی نام برند..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Brands List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
          {/* Option: All Brands */}
          <button
            type="button"
            onClick={() => {
              onSelectBrand('all');
              onClose();
            }}
            className={`w-full p-3 rounded-xl text-right flex items-center justify-between text-xs font-bold transition cursor-pointer ${
              selectedBrand === 'all'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 border border-slate-800/60'
            }`}
          >
            <span>همه برندها</span>
            {selectedBrand === 'all' && <Check className="w-4 h-4 text-emerald-400" />}
          </button>

          {filteredBrands.map((brand) => {
            const isSelected = selectedBrand === brand;
            return (
              <button
                key={brand}
                type="button"
                onClick={() => {
                  onSelectBrand(brand);
                  onClose();
                }}
                className={`w-full p-3 rounded-xl text-right flex items-center justify-between text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 border border-slate-800/60'
                }`}
              >
                <span>{brand}</span>
                {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            );
          })}

          {filteredBrands.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs">
              برندی با این نام یافت نشد.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
          {selectedBrand !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                onClearFilter();
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
            >
              پاک کردن فیلتر برند
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
