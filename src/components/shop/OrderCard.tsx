import React, { useState } from 'react';
import { Order } from '../../types';
import { getOrderStatusLabel, formatPrice, formatOrderDate } from './shopUtils';
import { Price } from './Price';
import {
  ChevronDown,
  RotateCcw,
  Phone,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Package,
  FileText,
  Printer,
  AlertTriangle,
  Percent,
} from 'lucide-react';
import {
  calculateTotalDiscountPercent,
  calculateDiscountedPrice,
} from '../../utils/storeDiscount';

interface OrderCardProps {
  order: Order;
  assignedVisitor?: { name: string; phone: string };
  onReorder: (order: Order) => void;
  onViewInvoice?: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  assignedVisitor,
  onReorder,
  onViewInvoice,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusInfo = getOrderStatusLabel(order.status);

  const pickupDiscount = order.pickup_discount_percent || 0;
  const founderDiscount = order.founder_discount_percent || 0;
  const manualDiscount = order.discount_status === 'approved' ? (order.discount_percent || 0) : 0;
  const totalDiscountPercent = calculateTotalDiscountPercent(pickupDiscount, founderDiscount, manualDiscount);

  const discountedTotal = order.items && order.items.length > 0
    ? order.items.reduce((sum, item) => {
        const discountedUnitPrice = calculateDiscountedPrice(item.price, totalDiscountPercent);
        return sum + discountedUnitPrice * item.quantity;
      }, 0)
    : calculateDiscountedPrice(order.total_amount, totalDiscountPercent);

  return (
    <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xs hover:border-slate-700 transition">
      {/* Top Row: Order ID, Date, Status Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs text-slate-100 dir-ltr bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
            {order.id}
          </span>
          <span className="text-xs text-slate-400 num-fa">
            {formatOrderDate(order.order_date)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pickupDiscount > 0 && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              تخفیف تحویل {pickupDiscount}٪
            </span>
          )}
          {founderDiscount > 0 && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
              تخفیف ۱۰۰ نفر اول {founderDiscount}٪
            </span>
          )}
          {manualDiscount > 0 && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              تخفیف فاکتور {manualDiscount}٪
            </span>
          )}

          {order.invoice_revised_at && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
              title="تعداد اقلام یا مبالغ این سفارش در فاکتور بارگیری توسط ادمین اصلاح شده است"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>فاکتور اصلاح شد</span>
            </span>
          )}
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusInfo.colorClass}`}
          >
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Visual 3-Step Progress Stepper */}
      <div className="py-1">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {/* Step 1: ثبت شد */}
          <div className="space-y-1">
            <div
              className={`h-1.5 rounded-full ${
                statusInfo.step >= 1 ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            />
            <span
              className={statusInfo.step >= 1 ? 'text-emerald-400 font-bold' : 'text-slate-500'}
            >
              ثبت شد
            </span>
          </div>

          {/* Step 2: در راه */}
          <div className="space-y-1">
            <div
              className={`h-1.5 rounded-full ${
                statusInfo.step >= 2 ? 'bg-amber-500' : 'bg-slate-800'
              }`}
            />
            <span
              className={statusInfo.step >= 2 ? 'text-amber-400 font-bold' : 'text-slate-500'}
            >
              در راه
            </span>
          </div>

          {/* Step 3: تحویل شد / تحویل نشد */}
          <div className="space-y-1">
            <div
              className={`h-1.5 rounded-full ${
                statusInfo.step >= 3
                  ? order.status === 'undelivered'
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                  : 'bg-slate-800'
              }`}
            />
            <span
              className={
                statusInfo.step >= 3
                  ? order.status === 'undelivered'
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-400 font-bold'
                  : 'text-slate-500'
              }
            >
              {order.status === 'undelivered' ? 'تحویل نشد' : 'تحویل شد'}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Row: Price & Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2 flex-wrap sm:flex-nowrap">
        <div className="text-xs flex items-center flex-wrap gap-1.5 min-w-0">
          <span className="text-slate-400">مبلغ سفارش: </span>
          {totalDiscountPercent > 0 ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="line-through text-slate-500 text-[11px] font-mono">
                {formatPrice(order.total_amount)}
              </span>
              <Price
                value={discountedTotal}
                size="md"
                tone="success"
                unit="تومان"
                bold
                className="text-sm font-extrabold"
              />
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800/50">
                ({totalDiscountPercent}٪ تخفیف)
              </span>
            </div>
          ) : (
            <Price
              value={order.total_amount}
              size="md"
              tone="success"
              unit="تومان"
              bold
              className="text-sm font-extrabold"
            />
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* If undelivered: Call visitor or central distribution button */}
          {order.status === 'undelivered' && (
            <a
              href={`tel:${assignedVisitor?.phone || '01132220000'}`}
              title="تماس جهت بررسی علت عدم تحویل سفارش"
              className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs flex items-center gap-1 border border-rose-500/30 transition"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{assignedVisitor?.phone ? 'تماس با ویزیتور' : 'تماس با پشتیبانی'}</span>
            </a>
          )}

          {/* View Invoice & Print / PDF Button */}
          {onViewInvoice && (
            <button
              type="button"
              onClick={() => onViewInvoice(order)}
              className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
              title="مشاهده فاکتور رسمی، چاپ و دریافت PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>فاکتور / PDF</span>
            </button>
          )}

          {/* Reorder Button */}
          <button
            type="button"
            onClick={() => onReorder(order)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>سفارش مجدد</span>
          </button>

          {/* Expand Details Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title={isExpanded ? 'بستن جزئیات' : 'مشاهده اقلام'}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Expandable Order Details */}
      {isExpanded && (
        <div className="pt-3 border-t border-slate-800 space-y-2.5 text-xs">
          {order.visitor_name && (
            <div className="flex items-center justify-between text-slate-400">
              <span>ویزیتور ثبت‌کننده / مسئول:</span>
              <span className="font-bold text-slate-200">{order.visitor_name}</span>
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-slate-950/60 divide-y divide-slate-800/60 space-y-1.5">
            {order.items && order.items.map((item, idx) => {
              const originalRowTotal = item.price * item.quantity;
              const discountedRowTotal = calculateDiscountedPrice(item.price, totalDiscountPercent) * item.quantity;
              return (
                <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-200 truncate">{item.name || 'کالا'}</span>
                    <span className="text-slate-500 text-[11px] num-fa">
                      × {item.quantity.toLocaleString('fa-IR')} {item.unit || ''}
                      {item.items_per_package && item.items_per_package > 1 && ` (${item.items_per_package.toLocaleString('fa-IR')} عددی)`}
                    </span>
                  </div>
                  <div className="text-left shrink-0">
                    {totalDiscountPercent > 0 && (
                      <span className="line-through text-slate-500 font-mono text-[10px] block text-left">
                        {formatPrice(originalRowTotal)}
                      </span>
                    )}
                    <Price
                      value={discountedRowTotal}
                      size="sm"
                      tone="default"
                      unit="تومان"
                      bold
                      className="text-slate-300 font-bold"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
