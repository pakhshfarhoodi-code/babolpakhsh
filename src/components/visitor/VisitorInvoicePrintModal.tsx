import React, { useRef, useState } from 'react';
import { LoadingBill, Visitor, Product, Order } from '../../types';
import { printInvoiceDocument } from '../../utils/pdfExport';
import { InvoicePrintView } from '../invoice/InvoicePrintView';
import { useApp } from '../../context/AppContext';
import {
  Printer,
  X,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  Layers,
  FileText,
} from 'lucide-react';

interface VisitorInvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: LoadingBill | null;
  visitor: Visitor;
  products: Product[];
  orders?: Order[];
}

export const VisitorInvoicePrintModal: React.FC<VisitorInvoicePrintModalProps> = ({
  isOpen,
  onClose,
  bill,
  visitor,
  products,
  orders: propOrders,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { orders: contextOrders, showToast } = useApp();
  const allOrders = propOrders || contextOrders || [];

  // Toggle for optional Page 2: Customer breakdown (بدون قیمت) - پیش‌فرض خاموش
  const [showCustomerBreakdown, setShowCustomerBreakdown] = useState<boolean>(false);

  if (!isOpen || !bill) return null;

  const isFinal = bill.status === 'approved' || bill.status === 'loaded';
  const isDraft = !isFinal;
  const isRevised = (bill.revision_count ?? 0) > 0;

  const handlePrint = () => {
    if (!printRef.current) return;

    // Validation: Block print if any item has missing/zero price
    const invalidItem = (bill.items || []).find((it) => {
      const prod = products.find((p) => p.id === it.product_id || p.name === it.product_name);
      const vp = Number(prod?.visitor_price ?? (it.visitor_price ?? (prod?.price ?? 0)));
      return vp <= 0;
    });

    if (invalidItem) {
      showToast(`قیمت برای کالای «${invalidItem.product_name}» تعریف نشده است.`, 'error');
      return;
    }

    printInvoiceDocument(printRef.current);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col my-auto max-h-[94vh] h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar (Controls & Actions) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/90 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-400" />
              <span>
                {isFinal ? 'چاپ فاکتور بارگیری و حواله رسمی' : 'پیش‌نمایش پیش‌نویس فاکتور'}
              </span>
            </h3>

            {/* Status Indicator */}
            {isDraft ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-600/40">
                <Clock className="w-3.5 h-3.5" />
                <span>پیش‌نویس غیرنهایی</span>
              </span>
            ) : bill.status === 'loaded' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                <Truck className="w-3.5 h-3.5" />
                <span>بارگیری شده (نهایی)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تایید رسمی (قیمت‌ها قفل)</span>
              </span>
            )}

            {isRevised && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600/40">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>اصلاح‌شده ({bill.revision_count} بار)</span>
              </span>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Customer Breakdown Page 2 Switch */}
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCustomerBreakdown}
                onChange={(e) => setShowCustomerBreakdown(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>چاپ ریز مشتریان (صفحه دوم بدون قیمت)</span>
            </label>

            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Invoice Preview Scrollable Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 pb-16 sm:pb-20 bg-slate-950/60 flex justify-center">
          <div
            ref={printRef}
            id="printable-invoice"
            className="invoice-paper bg-white text-slate-900 rounded-2xl shadow-xl w-full max-w-[210mm] border border-slate-200 overflow-visible mb-6"
          >
            <InvoicePrintView
              bill={bill}
              visitor={visitor}
              products={products}
              orders={allOrders}
              showCustomerBreakdown={showCustomerBreakdown}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
