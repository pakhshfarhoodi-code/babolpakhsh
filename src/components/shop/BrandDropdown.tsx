import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X, Tag, Filter } from 'lucide-react';

export interface BrandDropdownProps {
  availableBrands: string[];
  selectedBrands: string[];
  onChangeSelectedBrands: (brands: string[]) => void;
  brandProductCountMap?: Record<string, number>;
}

export const BrandDropdown: React.FC<BrandDropdownProps> = ({
  availableBrands,
  selectedBrands,
  onChangeSelectedBrands,
  brandProductCountMap = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Filter available brands by internal search
  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return availableBrands;
    return availableBrands.filter((b) => b.toLowerCase().includes(q));
  }, [availableBrands, brandSearch]);

  const isAllSelected = selectedBrands.length === 0;

  const handleToggleBrand = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      const next = selectedBrands.filter((b) => b !== brand);
      onChangeSelectedBrands(next);
    } else {
      onChangeSelectedBrands([...selectedBrands, brand]);
    }
  };

  const handleSelectAll = () => {
    onChangeSelectedBrands([]);
  };

  const handleClear = () => {
    onChangeSelectedBrands([]);
  };

  // Label to show on the button
  const buttonLabel = useMemo(() => {
    if (selectedBrands.length === 0) {
      return 'انتخاب برند (همه)';
    }
    if (selectedBrands.length === 1) {
      return `برند: ${selectedBrands[0]}`;
    }
    return `${selectedBrands.length} برند انتخاب شده`;
  }, [selectedBrands]);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Dropdown Trigger Button (Replaces old filter button) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-10 px-3 rounded-xl border font-bold text-xs flex items-center gap-2 transition cursor-pointer select-none ${
          selectedBrands.length > 0
            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/60 shadow-xs'
            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
        }`}
        title="انتخاب برندها (امکان انتخاب همزمان چند برند)"
      >
        <Tag className={`w-4 h-4 ${selectedBrands.length > 0 ? 'text-emerald-400' : 'text-slate-400'}`} />
        <span className="max-w-[110px] sm:max-w-[150px] truncate">{buttonLabel}</span>
        {selectedBrands.length > 0 && (
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0">
            {selectedBrands.length.toLocaleString('fa-IR')}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Box */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-72 sm:w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60 p-3 z-50 space-y-2.5 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              <span>انتخاب برندها</span>
              <span className="text-[11px] font-normal text-slate-400">(امکان چندتایی)</span>
            </div>

            {selectedBrands.length > 0 ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
              >
                پاک کردن
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400/90 font-medium bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                همه برندها
              </span>
            )}
          </div>

          {/* Search inside brands if multiple */}
          {availableBrands.length > 4 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="جستجو در بین برندها..."
                className="w-full h-8 bg-slate-950 border border-slate-800 rounded-lg pr-8 pl-7 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {brandSearch && (
                <button
                  type="button"
                  onClick={() => setBrandSearch('')}
                  className="absolute left-2 top-2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Brands List */}
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-xs">
            {/* "همه برندها" option */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition text-right cursor-pointer ${
                isAllSelected
                  ? 'bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/40'
                  : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                    isAllSelected
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                      : 'border-slate-600 bg-slate-950'
                  }`}
                >
                  {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>همه برندها</span>
              </div>
              <span className="text-[11px] text-slate-400">
                ({availableBrands.length.toLocaleString('fa-IR')} برند)
              </span>
            </button>

            {/* Individual Brands */}
            {filteredBrands.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                برندی با این عنوان یافت نشد
              </div>
            ) : (
              filteredBrands.map((brand) => {
                const isSelected = selectedBrands.includes(brand);
                const count = brandProductCountMap[brand] || 0;
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => handleToggleBrand(brand)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition text-right cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/40'
                        : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                            : 'border-slate-600 bg-slate-950'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{brand}</span>
                    </div>

                    {count > 0 && (
                      <span className="text-[11px] text-slate-400 shrink-0 mr-1.5">
                        {count.toLocaleString('fa-IR')} کالا
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {selectedBrands.length === 0
                ? 'تمام برندها نمایش داده می‌شوند'
                : `${selectedBrands.length.toLocaleString('fa-IR')} برند انتخاب شده`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
            >
              تأیید
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
