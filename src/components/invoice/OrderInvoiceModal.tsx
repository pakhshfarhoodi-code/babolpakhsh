import React, { useRef } from 'react';
import { Order, Supermarket, Visitor, InvoiceSettings, DEFAULT_INVOICE_SETTINGS } from '../../types';
import { printInvoiceDocument } from '../../utils/pdfExport';
import { useApp } from '../../context/AppContext';
import { InvoiceDocument } from './InvoiceDocument';
import { Printer, X, FileText } from 'lucide-react';

interface OrderInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  supermarket?: Supermarket | null;
  visitor?: Visitor | null;
}

export const OrderInvoiceModal: React.FC<OrderInvoiceModalProps> = ({
  isOpen,
  onClose,
  order,
  supermarket,
  visitor,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { invoiceSettings: contextSettings } = useApp();
  const settings: InvoiceSettings = contextSettings || DEFAULT_INVOICE_SETTINGS;

  if (!isOpen || !order) return null;

  const isDirectOrder = !order.assigned_visitor_id || order.assigned_visitor_id === 'direct';

  const handlePrint = () => {
    printInvoiceDocument(printRef.current, order.id, settings.paper_size || 'A4');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:bg-white">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="no-print p-3 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <span>پیش‌نمایش فاکتور فروشگاه</span>
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-blue-400 border border-slate-700 font-bold dir-ltr inline-block num-fa">
                  {order.id}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    isDirectOrder
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {isDirectOrder ? 'سفارش مستقیم (SP)' : 'ویزیتوری (VS)'}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
              title="بستن پنجره فاکتور"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Viewport Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 print:p-0 print:overflow-visible">
          <div id="printable-invoice" ref={printRef}>
            <InvoiceDocument
              order={order}
              settings={settings}
              supermarket={supermarket}
              visitor={visitor}
            />
          </div>
        </div>

        {/* Bottom Bar Controls (Hidden in Print) */}
        <div className="no-print p-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            <span>شماره فاکتور:</span>
            <span className="num-fa text-slate-200 font-bold dir-ltr inline-block">{order.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer text-xs shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ یا دانلود فاکتور</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer text-xs"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
