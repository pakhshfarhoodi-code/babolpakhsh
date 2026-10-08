import React, { useState } from 'react';
import { Order } from '../../types';
import { formatPrice } from './helpers';
import { Truck, ChevronDown, ChevronUp, Users } from 'lucide-react';

interface OrderVisitorItem {
  id: string;
  name: string;
  quantity: number;
  pack: number;
  baseUnit: string;
  unit: string;
  visitorPrice: number;
  lineTotal: number;
}

interface EligibleOrdersStepProps {
  eligibleOrders: Order[];
  selectedOrderIds: Set<string>;
  isReadOnly: boolean;
  onToggleOrder: (orderId: string) => void;
  onToggleAllOrders: () => void;
  getOrderVisitorDetails: (ord: Order) => { items: OrderVisitorItem[]; orderTotal: number };
}

export const EligibleOrdersStep: React.FC<EligibleOrdersStepProps> = ({
  eligibleOrders,
  selectedOrderIds,
  isReadOnly,
  onToggleOrder,
  onToggleAllOrders,
  getOrderVisitorDetails,
}) => {
  // Collapsed order items (empty set = all open by default)
  const [collapsedOrderIds, setCollapsedOrderIds] = useState<Set<string>>(new Set());

  const toggleOrderCollapse = (orderId: string) => {
    setCollapsedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const areAllCollapsed =
    eligibleOrders.length > 0 &&
    eligibleOrders.every((o) => collapsedOrderIds.has(o.id));

  const handleToggleCollapseAll = () => {
    if (areAllCollapsed) {
      // Expand all (empty collapsed set)
      setCollapsedOrderIds(new Set());
    } else {
      // Collapse all
      setCollapsedOrderIds(new Set(eligibleOrders.map((o) => o.id)));
    }
  };

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-5 shadow-sm space-y-3.5">
      {/* Step Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center num-fa">
            ۱
          </span>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-100">
              مشتریان و سفارش‌های قابل بارگیری
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <span className="text-slate-400 text-[11px] sm:text-xs">
            <strong className="num-fa text-slate-200">{selectedOrderIds.size.toLocaleString('fa-IR')}</strong> از{' '}
            <strong className="num-fa text-slate-200">{eligibleOrders.length.toLocaleString('fa-IR')}</strong> انتخاب شده
          </span>

          {eligibleOrders.length > 0 && (
            <button
              type="button"
              onClick={handleToggleCollapseAll}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
            >
              {areAllCollapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>بازکردن همه اقلام</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  <span>جمع‌کردن همه اقلام</span>
                </>
              )}
            </button>
          )}

          {!isReadOnly && eligibleOrders.length > 0 && (
            <button
              type="button"
              onClick={onToggleAllOrders}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline underline-offset-4"
            >
              {selectedOrderIds.size === eligibleOrders.length
                ? 'لغو انتخاب همه'
                : 'انتخاب همه'}
            </button>
          )}
        </div>
      </div>

      {/* Orders Grid */}
      {eligibleOrders.length === 0 ? (
        <div className="py-6 px-4 text-center rounded-2xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs">
          سفارش آماده بارگیری جدیدی برای این ویزیتور در وضعیت «آماده ارسال» موجود نیست.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[30rem] overflow-y-auto pr-1">
          {eligibleOrders.map((ord) => {
            const isChecked = selectedOrderIds.has(ord.id);
            const isCollapsed = collapsedOrderIds.has(ord.id);
            const { items: orderVisitorItems, orderTotal: orderVisitorTotal } =
              getOrderVisitorDetails(ord);

            return (
              <div
                key={ord.id}
                className={`p-3 rounded-2xl border transition ${
                  isChecked
                    ? 'bg-blue-950/20 border-blue-500/40 text-slate-100 shadow-xs'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                } ${isReadOnly ? 'opacity-80' : ''}`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <label className="flex items-start gap-2.5 min-w-0 cursor-pointer flex-1 select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isReadOnly}
                      onChange={() => onToggleOrder(ord.id)}
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm truncate text-slate-200">
                        {ord.supermarket_name}
                      </p>
                      <span className="text-[11px] text-slate-500 block">
                        #{ord.id}
                      </span>
                    </div>
                  </label>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left">
                      <span className="text-xs sm:text-sm font-bold text-emerald-400 num-fa">
                        {formatPrice(orderVisitorTotal)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        تومان خرید
                      </span>
                    </div>

                    {isChecked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleOrderCollapse(ord.id);
                        }}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        title={isCollapsed ? 'نمایش اقلام' : 'بستن اقلام'}
                        aria-label={isCollapsed ? 'نمایش اقلام' : 'بستن اقلام'}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible items under ticked customer (Default open) */}
                {isChecked && !isCollapsed && orderVisitorItems.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800/40 px-1">
                      <span>نام کالا</span>
                      <div className="flex items-center gap-4">
                        <span>تعداد</span>
                        <span className="w-24 text-left">مبلغ خرید</span>
                      </div>
                    </div>
                    {orderVisitorItems.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs py-1 px-1 rounded hover:bg-slate-800/40 transition"
                      >
                        <span className="truncate max-w-[50%] text-slate-200 font-medium text-[11px]">
                          {it.name}
                        </span>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-slate-300 text-[11px] num-fa">
                            {it.quantity.toLocaleString('fa-IR')} {it.unit}
                          </span>
                          <span className="w-24 text-left font-medium text-emerald-400 text-[11px] num-fa">
                            {formatPrice(it.lineTotal)}{' '}
                            <span className="text-[9px] text-slate-500 font-normal">ت</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
