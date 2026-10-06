import React, { useState, useMemo } from 'react';
import { Order, Product } from '../../types';
import { formatPrice, roundQty } from './shopUtils';
import { getPackSize, getBaseUnit } from '../../utils/orderLine';
import { useApp } from '../../context/AppContext';
import {
  X,
  Plus,
  Trash2,
  Check,
  Package,
  Search,
  AlertTriangle,
  Loader2,
  Save,
  ShoppingBag,
} from 'lucide-react';

export interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  products: Product[];
  onSaveSuccess?: () => void;
}

interface EditableItem {
  productId: string;
  name: string;
  price: number; // store price
  quantity: number;
  unit?: string;
  items_per_package?: number;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  products,
  onSaveSuccess,
}) => {
  const { updateOrder, showToast, refreshData } = useApp();

  // Initialize editable items state from order
  const [items, setItems] = useState<EditableItem[]>(() => {
    if (!order || !order.items) return [];
    return order.items.map((it) => {
      const prod = products.find((p) => p.id === it.product_id);
      return {
        productId: it.product_id,
        name: it.name || prod?.name || 'کالا',
        price: it.price || prod?.price || 0,
        quantity: it.quantity,
        unit: it.unit || prod?.unit,
        items_per_package: it.items_per_package || prod?.items_per_package,
      };
    });
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when order prop changes
  React.useEffect(() => {
    if (order && order.items) {
      setItems(
        order.items.map((it) => {
          const prod = products.find((p) => p.id === it.product_id);
          return {
            productId: it.product_id,
            name: it.name || prod?.name || 'کالا',
            price: it.price || prod?.price || 0,
            quantity: it.quantity,
            unit: it.unit || prod?.unit,
            items_per_package: it.items_per_package || prod?.items_per_package,
          };
        })
      );
    }
  }, [order, products]);

  // Active available products from catalog not yet in order
  const filteredAvailableProducts = useMemo(() => {
    const activeProds = products.filter((p) => p.is_active && !p.is_market_test);
    const existingIds = new Set(items.map((i) => i.productId));
    const unselected = activeProds.filter((p) => !existingIds.has(p.id));

    if (!searchTerm.trim()) return unselected.slice(0, 10);
    const term = searchTerm.trim().toLowerCase();
    return unselected.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.brand && p.brand.toLowerCase().includes(term))
    );
  }, [products, items, searchTerm]);

  if (!isOpen || !order) return null;

  const handleUpdateQty = (productId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((it) => {
          if (it.productId !== productId) return it;
          const nextQty = roundQty(Math.max(0, it.quantity + delta));
          return { ...it, quantity: nextQty };
        })
        .filter((it) => it.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const handleAddProduct = (prod: Product) => {
    const pack = getPackSize(prod.items_per_package);
    const price = prod.price * pack; // store price per item/carton
    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        name: prod.name,
        price,
        quantity: 1,
        unit: prod.unit,
        items_per_package: prod.items_per_package,
      },
    ]);
  };

  const grandTotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

  const handleSave = async () => {
    if (items.length === 0) {
      showToast('سبد سفارش خالی است. جهت لغو کامل، از دکمه حذف سفارش استفاده فرمایید.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      }));

      const res = await updateOrder(order.id, payload);
      if (res.success) {
        showToast(res.message || 'سفارش با موفقیت ویرایش شد.', 'success');
        refreshData();
        if (onSaveSuccess) onSaveSuccess();
        onClose();
      } else {
        showToast(res.message || 'خطا در ثبت ویرایش سفارش.', 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ویرایش سفارش.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>ویرایش سفارش ثبت‌شده</span>
                <span className="font-mono text-xs text-blue-400 bg-slate-800 px-2 py-0.5 rounded dir-ltr inline-block">
                  {order.id}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تغییر تعداد کالاها یا افزودن اقلام جدید قبل از مرحله در راه
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Current Order Items */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>اقلام موجود در سفارش:</span>
              <span className="text-emerald-400 font-mono text-[11px]">
                {items.length} قلم کالا
              </span>
            </h3>

            {items.length === 0 ? (
              <div className="py-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                هیچ کالایی در سفارش وجود ندارد.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => {
                  const pack = getPackSize(it.items_per_package);
                  const baseUnit = getBaseUnit(it.unit, pack);
                  const rowTotal = it.price * it.quantity;

                  return (
                    <div
                      key={it.productId}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-slate-100 truncate">
                          {it.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          قیمت واحد: {formatPrice(it.price)}
                          {pack > 1 && ` (کارتن ${pack} عددی)`}
                        </p>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-900 rounded-lg p-1 border border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(it.productId, -1)}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-bold font-mono text-xs px-2 text-slate-100 min-w-[30px] text-center">
                            {it.quantity.toLocaleString('fa-IR')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(it.productId, 1)}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <span className="font-bold font-mono text-xs text-emerald-400 min-w-[80px] text-left">
                          {formatPrice(rowTotal)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.productId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition cursor-pointer"
                          title="حذف از سفارش"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Product Section */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-slate-300">افزودن کالای جدید به سفارش:</h3>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی نام یا برند کالا..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {filteredAvailableProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between text-xs transition"
                >
                  <div className="min-w-0 pr-1">
                    <span className="font-bold text-slate-200 block truncate">{prod.name}</span>
                    <span className="text-[10px] text-slate-400">
                      موجود: {Math.max(0, prod.stock - prod.reserved_stock)} {prod.unit} | {formatPrice(prod.price)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddProduct(prod)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-slate-400 text-xs font-semibold block">مبلغ کل جدید سفارش:</span>
            <span className="font-black text-emerald-400 text-base font-mono">
              {formatPrice(grandTotal)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="button"
              disabled={isSubmitting || items.length === 0}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>ذخیره تغییرات سفارش</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
