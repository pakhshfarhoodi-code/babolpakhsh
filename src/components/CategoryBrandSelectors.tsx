import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  X,
  ChevronDown,
  Layers,
  Tag,
  Check,
  AlertTriangle,
  Trash2,
  Pencil,
} from 'lucide-react';

interface CategorySelectPickerProps {
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  onEditCategoryClick?: (cat: { id: string; name: string }) => void;
}

export const CategorySelectPicker: React.FC<CategorySelectPickerProps> = ({
  selectedCategoryId,
  onSelectCategory,
  onEditCategoryClick,
}) => {
  const { categories, addCategory, updateCategory, deleteCategory, products } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; productCount: number } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setEditingCatId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0];

  const handleAddSubmit = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newCatName.trim()) return;

    const res = addCategory(newCatName.trim());
    if (res.success && res.category) {
      onSelectCategory(res.category.id);
      setNewCatName('');
      setIsAdding(false);
      setIsOpen(false);
      setFeedback({ type: 'success', message: res.message });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', message: res.message });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleEditSubmit = (e?: React.SyntheticEvent, catId?: string) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const idToEdit = catId || editingCatId;
    if (!idToEdit || !editingCatName.trim()) return;

    const res = updateCategory(idToEdit, editingCatName.trim());
    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
      setEditingCatId(null);
      setEditingCatName('');
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', message: res.message });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleOpenDeleteConfirm = (e: React.MouseEvent, catId: string, catName: string) => {
    e.stopPropagation();
    e.preventDefault();
    const productCount = products.filter((p) => p.category_id === catId).length;
    setPendingDelete({ id: catId, name: catName, productCount });
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;

    const catId = pendingDelete.id;
    const catName = pendingDelete.name;

    const res = deleteCategory(catId);
    if (res.success) {
      // If deleted category was selected, switch to another category
      if (selectedCategoryId === catId) {
        const remaining = categories.filter((c) => c.id !== catId);
        if (remaining.length > 0) {
          onSelectCategory(remaining[0].id);
        }
      }
      setFeedback({ type: 'success', message: `دسته‌بندی «${catName}» حذف شد.` });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', message: res.message });
      setTimeout(() => setFeedback(null), 3000);
    }

    setPendingDelete(null);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-slate-400 font-medium text-xs">دسته‌بندی کالا</label>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(!isAdding);
            if (!isOpen) setIsOpen(true);
          }}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold cursor-pointer py-0.5 px-1.5 rounded hover:bg-blue-950/40"
          title="تعریف دسته‌بندی جدید"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>افزودن دسته جدید</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`mb-2 p-2 rounded-lg text-xs font-medium transition ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Inline Add Category (NOT a nested form) */}
      {isAdding && (
        <div className="mb-2 p-2.5 bg-blue-950/70 border border-blue-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-blue-300 font-semibold">
            <span>نام دسته‌بندی جدید:</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAdding(false);
              }}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddSubmit(e);
                }
              }}
              placeholder="مثلاً: سس‌ها و ترشیجات..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddSubmit(e);
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm transition"
            >
              ثبت
            </button>
          </div>
        </div>
      )}

      {/* Main Select Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 text-slate-200 flex items-center justify-between transition cursor-pointer text-xs"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-slate-100">
            {selectedCategory ? selectedCategory.name : 'انتخاب دسته‌بندی...'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-800/80 p-1.5 no-scrollbar">
          <div className="px-2 py-1 text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>مدیریت و ویرایش با قلم (✎) یا حذف (×):</span>
            <span>{categories.length} دسته موجود</span>
          </div>

          {categories.map((cat) => {
            const isSelected = cat.id === selectedCategoryId;
            const isEditing = editingCatId === cat.id;
            const productCount = products.filter((p) => p.category_id === cat.id).length;

            if (isEditing) {
              return (
                <div
                  key={cat.id}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 bg-blue-950/80 border border-blue-700/80 rounded-lg flex items-center gap-1.5 my-1"
                >
                  <input
                    type="text"
                    autoFocus
                    value={editingCatName}
                    onChange={(e) => setEditingCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleEditSubmit(undefined, cat.id);
                      } else if (e.key === 'Escape') {
                        setEditingCatId(null);
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="نام جدید دسته‌بندی..."
                  />
                  <button
                    type="button"
                    onClick={() => handleEditSubmit(undefined, cat.id)}
                    title="ذخیره تغییرات"
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition shrink-0 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCatId(null)}
                    title="انصراف"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat.id);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition group ${
                  isSelected ? 'bg-blue-600/20 text-blue-300 font-bold' : 'hover:bg-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isSelected ? <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <div className="w-3.5 shrink-0" />}
                  <span className="text-xs truncate">{cat.name}</span>
                  {productCount > 0 && (
                    <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                      {productCount} کالا
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0 mr-1" onClick={(e) => e.stopPropagation()}>
                  {/* Pencil Edit Button (No text, icon only as requested) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setEditingCatId(cat.id);
                      setEditingCatName(cat.name);
                    }}
                    title={`ویرایش نام دسته‌بندی «${cat.name}»`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/60 border border-transparent hover:border-amber-800/50 transition cursor-pointer shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-400" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleOpenDeleteConfirm(e, cat.id, cat.name)}
                    title={`حذف دسته‌بندی «${cat.name}»`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/60 border border-transparent hover:border-rose-800/50 transition cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Deleting Category */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">تأیید حذف دسته‌بندی</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  آیا مطمئن هستید دسته‌بندی «<strong className="text-white">{pendingDelete.name}</strong>» حذف شود؟
                </p>
              </div>
            </div>

            {pendingDelete.productCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs leading-relaxed">
                ⚠️ <strong>هشدار:</strong> هم‌اکنون تعداد {pendingDelete.productCount} کالا در این دسته‌بندی قرار دارد. با حذف این دسته‌بندی، کالاهای مذکور به دسته‌بندی دیگری منتقل می‌شوند تا دسترسی به آن‌ها قطع نشود.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition shadow-lg shadow-rose-600/30"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface BrandSelectPickerProps {
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;
  onEditBrandClick?: (brand: string) => void;
}

export const BrandSelectPicker: React.FC<BrandSelectPickerProps> = ({
  selectedBrand,
  onSelectBrand,
  onEditBrandClick,
}) => {
  const { brands, addBrand, updateBrand, deleteBrand, products } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [editingBrandName, setEditingBrandName] = useState<string | null>(null);
  const [editingBrandVal, setEditingBrandVal] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ name: string; productCount: number } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setEditingBrandName(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddSubmit = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newBrandName.trim()) return;

    const trimmed = newBrandName.trim();
    const res = addBrand(trimmed);
    if (res.success) {
      onSelectBrand(trimmed);
      setNewBrandName('');
      setIsAdding(false);
      setIsOpen(false);
      setFeedback({ type: 'success', message: res.message });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', message: res.message });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleEditSubmit = (e?: React.SyntheticEvent, oldBrand?: string) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetBrand = oldBrand || editingBrandName;
    if (!targetBrand || !editingBrandVal.trim()) return;

    const trimmedNew = editingBrandVal.trim();
    const res = updateBrand(targetBrand, trimmedNew);
    if (res.success) {
      if (selectedBrand === targetBrand) {
        onSelectBrand(trimmedNew);
      }
      setFeedback({ type: 'success', message: res.message });
      setEditingBrandName(null);
      setEditingBrandVal('');
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', message: res.message });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleOpenDeleteConfirm = (e: React.MouseEvent, brandName: string) => {
    e.stopPropagation();
    e.preventDefault();
    const productCount = products.filter((p) => p.brand && p.brand.trim().toLowerCase() === brandName.trim().toLowerCase()).length;
    setPendingDelete({ name: brandName, productCount });
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;

    const brandName = pendingDelete.name;
    const res = deleteBrand(brandName);
    if (res.success) {
      // If deleted brand was selected, select the first remaining
      if (selectedBrand === brandName) {
        const remaining = brands.filter((b) => b !== brandName);
        if (remaining.length > 0) {
          onSelectBrand(remaining[0]);
        } else {
          onSelectBrand('');
        }
      }
      setFeedback({ type: 'success', message: `برند «${brandName}» حذف شد.` });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', message: res.message });
      setTimeout(() => setFeedback(null), 3000);
    }

    setPendingDelete(null);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-slate-400 font-medium text-xs">برند / شرکت تولیدکننده</label>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(!isAdding);
            if (!isOpen) setIsOpen(true);
          }}
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer py-0.5 px-1.5 rounded hover:bg-amber-950/40"
          title="تعریف برند جدید"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>افزودن برند جدید</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`mb-2 p-2 rounded-lg text-xs font-medium transition ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Inline Add Brand (NOT a nested form) */}
      {isAdding && (
        <div className="mb-2 p-2.5 bg-amber-950/70 border border-amber-800/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
            <span>نام برند یا کارخانه جدید:</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAdding(false);
              }}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddSubmit(e);
                }
              }}
              placeholder="مثلاً: پگاه، چوپان، فرمند..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddSubmit(e);
              }}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-sm transition"
            >
              ثبت
            </button>
          </div>
        </div>
      )}

      {/* Main Select Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 text-slate-200 flex items-center justify-between transition cursor-pointer text-xs"
      >
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-100">{selectedBrand || 'انتخاب برند...'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-800/80 p-1.5 no-scrollbar">
          <div className="px-2 py-1 text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>مدیریت و ویرایش با قلم (✎) یا حذف (×):</span>
            <span>{brands.length} برند موجود</span>
          </div>

          {brands.map((brand) => {
            const isSelected = brand === selectedBrand;
            const isEditing = editingBrandName === brand;
            const productCount = products.filter((p) => p.brand && p.brand.trim() === brand.trim()).length;

            if (isEditing) {
              return (
                <div
                  key={brand}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 bg-amber-950/80 border border-amber-700/80 rounded-lg flex items-center gap-1.5 my-1"
                >
                  <input
                    type="text"
                    autoFocus
                    value={editingBrandVal}
                    onChange={(e) => setEditingBrandVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleEditSubmit(undefined, brand);
                      } else if (e.key === 'Escape') {
                        setEditingBrandName(null);
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    placeholder="نام جدید برند..."
                  />
                  <button
                    type="button"
                    onClick={() => handleEditSubmit(undefined, brand)}
                    title="ذخیره تغییرات"
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition shrink-0 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBrandName(null)}
                    title="انصراف"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={brand}
                onClick={() => {
                  onSelectBrand(brand);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition group ${
                  isSelected ? 'bg-amber-500/20 text-amber-300 font-bold' : 'hover:bg-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isSelected ? <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <div className="w-3.5 shrink-0" />}
                  <span className="text-xs truncate">{brand}</span>
                  {productCount > 0 && (
                    <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                      {productCount} کالا
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0 mr-1" onClick={(e) => e.stopPropagation()}>
                  {/* Pencil Edit Button (No text, icon only as requested) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setEditingBrandName(brand);
                      setEditingBrandVal(brand);
                    }}
                    title={`ویرایش نام برند «${brand}»`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/60 border border-transparent hover:border-amber-800/50 transition cursor-pointer shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5 text-amber-400" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleOpenDeleteConfirm(e, brand)}
                    title={`حذف برند «${brand}»`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/60 border border-transparent hover:border-rose-800/50 transition cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Deleting Brand */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">تأیید حذف برند</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  آیا مطمئن هستید برند «<strong className="text-white">{pendingDelete.name}</strong>» حذف شود؟
                </p>
              </div>
            </div>

            {pendingDelete.productCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs leading-relaxed">
                ⚠️ <strong>هشدار:</strong> تعداد {pendingDelete.productCount} کالا با این برند ثبت شده‌اند. با حذف برند، عنوان برند این کالاها به «متفرقه» تغییر داده می‌شود تا اطلاعات کالاها حفظ گردد.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition shadow-lg shadow-rose-600/30"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
