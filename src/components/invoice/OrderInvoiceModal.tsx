import React, { useRef, useState } from 'react';
import { Order, Supermarket, Visitor } from '../../types';
import { exportElementToPdf, printInvoiceDocument } from '../../utils/pdfExport';
import { formatPriceToWords } from '../../utils/numberToPersianWords';
import { useApp } from '../../context/AppContext';
import {
  Printer,
  FileDown,
  X,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  ShieldCheck,
  AlertCircle,
  PackageCheck,
  Store,
} from 'lucide-react';

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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const { products } = useApp();

  if (!isOpen || !order) return null;

  // Format Persian price
  const formatCurrency = (amount: number) => {
    return (amount || 0).toLocaleString('fa-IR');
  };

  // Determine invoice type tag
  const isVisitorOrder =
    order.order_source === 'visitor' || (order.id && order.id.startsWith('VS'));

  // Status badge config
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'delivered':
        return {
          label: 'تحویل داده شده',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
          icon: CheckCircle2,
        };
      case 'loading':
        return {
          label: 'در حال بارگیری از انبار',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-300',
          icon: PackageCheck,
        };
      case 'delegated':
        return {
          label: 'در حال واگذاری به همکار',
          bg: 'bg-amber-50 text-amber-700 border-amber-300',
          icon: Clock,
        };
      case 'undelivered':
        return {
          label: 'عدم تحویل',
          bg: 'bg-rose-50 text-rose-700 border-rose-300',
          icon: AlertCircle,
        };
      case 'assigned':
      default:
        return {
          label: 'آماده توزیع مویرگی',
          bg: 'bg-blue-50 text-blue-700 border-blue-300',
          icon: Truck,
        };
    }
  };

  const totalItemsCount = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  const priceInWords = formatPriceToWords(order.total_amount);

  // Handle PDF export
  const handleExportPdf = async () => {
    if (!printRef.current) return;
    setIsExportingPdf(true);
    setExportFeedback(null);

    const safeStoreName = (order.supermarket_name || 'store').replace(/\s+/g, '_');
    const fileName = `فاکتور_${order.id}_${safeStoreName}.pdf`;

    const success = await exportElementToPdf(printRef.current, fileName);
    setIsExportingPdf(false);

    if (success) {
      setExportFeedback({
        type: 'success',
        message: 'فایل PDF آماده شد و پنجره ذخیره/دانلود باز گردید.',
      });
      setTimeout(() => setExportFeedback(null), 4000);
    } else {
      printInvoiceDocument(printRef.current);
      setExportFeedback({
        type: 'success',
        message: 'صفحه ذخیره باز شد. گزینه «ذخیره به عنوان PDF» را انتخاب نمایید.',
      });
      setTimeout(() => setExportFeedback(null), 5000);
    }
  };

  const handlePrint = () => {
    printInvoiceDocument(printRef.current);
  };

  // Format order date display
  const formattedDate = (() => {
    if (!order.order_date) return '---';
    if (order.order_date.includes('T') || order.order_date.startsWith('20')) {
      try {
        const d = new Date(order.order_date);
        return new Intl.DateTimeFormat('fa-IR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(d);
      } catch {
        return order.order_date;
      }
    }
    return order.order_date;
  })();

  const buyerName = order.supermarket_name || supermarket?.name || 'فروشگاه طرف قرارداد';
  const buyerOwner = supermarket?.owner || 'متصدی فروشگاه';
  const buyerPhone = supermarket?.phone || '---';
  const buyerAddress = supermarket?.address || 'ثبت شده در سامانه مرکزی پخش';
  const isDirectOrder = !order.assigned_visitor_id || order.assigned_visitor_id === 'direct';
  const sellerVisitor = isDirectOrder
    ? 'واحد فروش و پخش مرکزی فرهودی'
    : (order.visitor_name || visitor?.name || 'واحد توزیع مویرگی');
  const visitorPhone = isDirectOrder
    ? (visitor?.phone || '۰۱۱-۳۲۲۲۰۰۰۰')
    : (visitor?.phone || '---');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:bg-white">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="no-print p-3 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <span>پیش‌نمایش فاکتور رسمی پخش مویرگی</span>
                <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-blue-400 border border-slate-700 font-bold tracking-wider dir-ltr">
                  {order.id}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    isVisitorOrder
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isVisitorOrder ? 'ویزیتوری (VS)' : 'سفارش مستقیم (SP)'}
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

        {/* Feedback Alert if PDF was exported */}
        {exportFeedback && (
          <div
            className={`no-print mx-4 mt-2 p-2 rounded-xl text-xs flex items-center gap-2 animate-in fade-in shrink-0 ${
              exportFeedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {exportFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{exportFeedback.message}</span>
          </div>
        )}

        {/* Invoice Viewport Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 print:p-0 print:overflow-visible">
          {/* Paper Sheet Preview */}
          <div
            id="printable-invoice"
            ref={printRef}
            className="invoice-paper bg-white text-slate-900 rounded-xl p-4 sm:p-5 max-w-3xl mx-auto shadow-xl border border-slate-200 print:border-none print:shadow-none print:p-2 print:max-w-none print:rounded-none flex flex-col"
            style={{ direction: 'rtl' }}
          >
            {/* 1. Header (Logo, Identity & Meta Chips - Barcode Box Removed Completely) */}
            <div className="border-b border-slate-900 pb-2 mb-2">
              <div className="flex items-center justify-between gap-2">
                {/* Brand & Identity */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-900 text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs border border-blue-950">
                    ب
                  </div>
                  <div>
                    <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
                      <span>بارفروش</span>
                      <span className="text-slate-300 font-light">|</span>
                      <span className="text-blue-900">شبکه پخش عمده فرهودی</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                      سامانه سفارش‌گیری و توزیع مویرگی زنجیره سرد مواد غذایی
                    </p>
                  </div>
                </div>

                {/* Factor Meta Box (Compact Header Right Side) */}
                <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                  <div className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded font-mono font-bold text-slate-900 dir-ltr">
                    شماره: {order.id}
                  </div>
                  <div className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded font-medium text-slate-700">
                    تاریخ: {formattedDate}
                  </div>
                </div>
              </div>

              {/* Title Ribbon (Compressed Height) */}
              <div className="mt-1.5 bg-slate-900 text-white py-1 px-3 rounded-md font-bold text-[11px] flex items-center justify-between tracking-wide leading-none">
                <span>صورت‌حساب فروش و تحویل کالا</span>
                <span className="text-[10px] font-mono text-slate-300">
                  {isVisitorOrder ? 'سفارش ویزیتوری' : 'سفارش مستقیم فروشگاه'}
                </span>
              </div>
            </div>

            {/* 2. Compact Seller & Buyer Info (Single Row) */}
            <div className="grid grid-cols-2 gap-2 mb-2 text-[11px] leading-tight">
              {/* Seller Information (Right Side in RTL) */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/80 space-y-1">
                <div className="flex items-center gap-1 font-bold text-slate-900 border-b border-slate-200 pb-0.5 text-[11px]">
                  <Building2 className="w-3 h-3 text-blue-700 shrink-0" />
                  <span>فروشنده: شبکه پخش عمده فرهودی</span>
                </div>
                <div className="text-slate-700 space-y-0.5 text-[10px]">
                  <p className="truncate">
                    <span className="text-slate-500 font-medium">دفتر/انبار:</span> مرکز لجستیک و زنجیره سرد
                  </p>
                  <p className="truncate">
                    <span className="text-slate-500 font-medium">تلفن:</span>{' '}
                    <span className="font-mono text-slate-900">۰۹۱۲۳۴۵۶۷۸۹ - ۰۱۱۳۳۲۲۱۱۰۰</span>
                  </p>
                  <p className="truncate">
                    <span className="text-slate-500 font-medium">موزع/ویزیتور:</span>{' '}
                    <strong className="text-slate-900">{sellerVisitor}</strong>{' '}
                    {visitorPhone !== '---' && (
                      <span className="text-slate-500 font-mono text-[9px]">({visitorPhone})</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Buyer Information (Left Side in RTL) */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/80 space-y-1">
                <div className="flex items-center gap-1 font-bold text-slate-900 border-b border-slate-200 pb-0.5 text-[11px]">
                  <Store className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>خریدار: {buyerName}</span>
                </div>
                <div className="text-slate-700 space-y-0.5 text-[10px]">
                  <p className="truncate">
                    <span className="text-slate-500 font-medium">متصدی:</span>{' '}
                    <strong className="text-slate-900">{buyerOwner}</strong>
                  </p>
                  <p className="truncate">
                    <span className="text-slate-500 font-medium">تلفن:</span>{' '}
                    <span className="font-mono text-slate-900">{buyerPhone}</span>
                  </p>
                  <p className="truncate" title={buyerAddress}>
                    <span className="text-slate-500 font-medium">نشانی:</span>{' '}
                    <span>{buyerAddress}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Items Table (Primary Functional Section) */}
            <div className="border border-slate-900 rounded-lg overflow-hidden mb-2 flex-1">
              <table className="w-full text-right text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold leading-none">
                    <th className="py-1.5 px-1.5 border-l border-slate-700 text-center w-9">ردیف</th>
                    <th className="py-1.5 px-2 border-l border-slate-700 text-right w-auto">شرح کالا</th>
                    <th className="py-1.5 px-2 border-l border-slate-700 text-center w-24">تعداد / واحد</th>
                    <th className="py-1.5 px-2 border-l border-slate-700 text-left w-28 whitespace-nowrap">قیمت واحد (تومان)</th>
                    <th className="py-1.5 px-2 text-left w-32 whitespace-nowrap">مبلغ کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, index) => {
                      const rowTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                      const itemName = item.name || (item as any).product_name || 'کالای توزیعی';
                      
                      // Look up unit specified by admin in catalog
                      const productObj = products.find((p) => p.id === item.product_id);
                      const packCount = item.items_per_package || productObj?.items_per_package;
                      const unitStr = (item as any).unit || productObj?.unit || 'عدد';
                      const formattedQtyUnit = packCount && packCount > 1
                        ? `${(Number(item.quantity) || 0).toLocaleString('fa-IR')} ${unitStr} (${packCount} عددی)`
                        : `${(Number(item.quantity) || 0).toLocaleString('fa-IR')} ${unitStr}`;

                      return (
                        <tr
                          key={item.id || index}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                        >
                          <td className="py-1 px-1.5 border-l border-slate-200 text-center font-bold text-slate-600 text-[10px]">
                            {(index + 1).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-1 px-2 border-l border-slate-200 font-semibold text-slate-900 leading-snug">
                            {itemName}
                          </td>
                          <td className="py-1 px-2 border-l border-slate-200 text-center font-bold text-slate-800 whitespace-nowrap">
                            {formattedQtyUnit}
                          </td>
                          <td className="py-1 px-2 border-l border-slate-200 text-left font-mono font-medium text-slate-800 whitespace-nowrap">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="py-1 px-2 text-left font-mono font-bold text-slate-950 whitespace-nowrap">
                            {formatCurrency(rowTotal)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-500 font-medium">
                        اقلام فاکتور یافت نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 4. Compact Totals and Financial Summary */}
            <div className="space-y-1 mt-1 text-[11px]">
              {/* Words Amount Display - Single Compact Row */}
              <div className="border border-slate-300 rounded-lg p-1.5 px-2.5 bg-slate-50 flex items-center justify-between gap-2">
                <span className="text-slate-600 font-medium shrink-0">مبلغ کل به حروف:</span>
                <span className="font-bold text-slate-900 text-[11px] truncate">
                  {priceInWords} تومان
                </span>
              </div>

              {/* Numerical Totals Box */}
              <div className="border border-slate-900 rounded-lg overflow-hidden flex items-center justify-between bg-slate-900 text-white p-2">
                <div className="flex items-center gap-3 text-slate-300 text-[10px]">
                  <span>
                    تعداد کل اقلام:{' '}
                    <strong className="text-white font-mono">{totalItemsCount.toLocaleString('fa-IR')}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-200">مبلغ قابل پرداخت:</span>
                  <div className="font-mono font-black text-sm text-emerald-400">
                    {formatCurrency(order.total_amount)} <span className="text-[10px] font-normal text-slate-300">تومان</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar Controls */}
        <div className="no-print p-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            <span>شماره فاکتور:</span>
            <span className="font-mono text-slate-200 font-bold dir-ltr">{order.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'در حال خروجی...' : 'دانلود PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ فاکتور</span>
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
