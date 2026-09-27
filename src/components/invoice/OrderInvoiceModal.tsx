import React, { useRef, useState } from 'react';
import { Order, Supermarket, Visitor } from '../../types';
import { exportElementToPdf, printInvoiceDocument } from '../../utils/pdfExport';
import { formatPriceToWords } from '../../utils/numberToPersianWords';
import {
  Printer,
  FileDown,
  X,
  CheckCircle2,
  Clock,
  Truck,
  Store,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  AlertCircle,
  PackageCheck,
  Building2,
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

  if (!isOpen || !order) return null;

  // Format Persian price
  const formatCurrency = (amount: number) => {
    return (amount || 0).toLocaleString('fa-IR');
  };

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
          label: 'آماده ارسال و توزیع',
          bg: 'bg-blue-50 text-blue-700 border-blue-300',
          icon: Truck,
        };
    }
  };

  const statusBadge = getStatusBadge(order.status);
  const StatusIcon = statusBadge.icon;

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
        message: 'فایل PDF فاکتور با موفقیت ایجاد و دانلود شد.',
      });
      setTimeout(() => setExportFeedback(null), 4000);
    } else {
      setExportFeedback({
        type: 'error',
        message: 'خطا در تولید فایل PDF. می‌توانید از دکمه چاپ استفاده کنید.',
      });
    }
  };

  const handlePrint = () => {
    printInvoiceDocument();
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
  const sellerVisitor = order.visitor_name || visitor?.name || 'واحد توزیع و لجستیک';
  const visitorPhone = visitor?.phone || '---';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:bg-white">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="no-print p-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>پیش‌نمایش فاکتور رسمی سفارش</span>
                <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-blue-400 border border-slate-700">
                  {order.id}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                امکان استخراج نسخه دیجیتال PDF و چاپ بر روی انواع چاپگرها (A4 / A5)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{isExportingPdf ? 'در حال ایجاد PDF...' : 'دریافت فایل PDF'}</span>
            </button>

            {/* Paper Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ کاغذی (پرینت)</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="بستن پنجره فاکتور"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert if PDF was exported */}
        {exportFeedback && (
          <div
            className={`no-print mx-4 mt-3 p-3 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in ${
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0 print:overflow-visible">
          {/* Paper Sheet Preview */}
          <div
            id="printable-invoice"
            ref={printRef}
            className="invoice-paper bg-white text-slate-900 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto shadow-xl border border-slate-200 print:border-none print:shadow-none print:p-4 print:max-w-none print:rounded-none"
            style={{ direction: 'rtl' }}
          >
            {/* 1. Official Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5">
              <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                {/* Brand & Identity */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-black text-sm">
                      ب
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                        بارفروش | شبکه پخش عمده فرهودی
                      </h1>
                      <p className="text-[11px] font-semibold text-slate-600">
                        سامانه جامع سفارش‌گیری و توزیع زنجیره سرد مواد غذایی و پروتئینی
                      </p>
                    </div>
                  </div>
                </div>

                {/* Factor Meta Info */}
                <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 min-w-[210px] text-xs space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 font-medium">شماره صورت‌حساب:</span>
                    <span className="font-mono font-bold text-slate-950 dir-ltr text-sm">
                      {order.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 font-medium">تاریخ و زمان:</span>
                    <span className="font-bold text-slate-900">{formattedDate}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                    <span className="text-slate-600 font-medium">وضعیت سفارش:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border inline-flex items-center gap-1 ${statusBadge.bg}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      <span>{statusBadge.label}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Title Ribbon */}
              <div className="mt-3 text-center bg-slate-900 text-white py-1.5 px-4 rounded-lg font-bold text-xs tracking-wider">
                صورت‌حساب فروش کالا و خدمات (فاکتور رسمی توزیع)
              </div>
            </div>

            {/* 2. Two-Column Seller & Buyer Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-xs">
              {/* Seller Information */}
              <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-700" />
                  <span>مشخصات فروشنده (توزیع‌کننده):</span>
                </div>
                <div className="space-y-1 text-slate-700 leading-relaxed">
                  <p>
                    <span className="text-slate-500 font-medium">نام شرکت:</span>{' '}
                    <strong className="text-slate-900">شبکه پخش عمده فرهودی (بارفروش)</strong>
                  </p>
                  <p>
                    <span className="text-slate-500 font-medium">دفتر مرکزی و انبار:</span>{' '}
                    <span>مرکز توزیع و زنجیره سرد استان</span>
                  </p>
                  <p>
                    <span className="text-slate-500 font-medium">تلفن پشتیبانی و سفارشات:</span>{' '}
                    <span className="font-mono text-slate-900">۰۹۱۲۳۴۵۶۷۸۹ - ۰۱۱۳۳۲۲۱۱۰۰</span>
                  </p>
                  <p>
                    <span className="text-slate-500 font-medium">ویزیتور / مسئول فاکتور:</span>{' '}
                    <strong className="text-slate-900">{sellerVisitor}</strong>{' '}
                    {visitorPhone !== '---' && (
                      <span className="text-slate-500 font-mono text-[11px]">({visitorPhone})</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Buyer Information */}
              <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-700" />
                  <span>مشخصات خریدار (فروشگاه / سوپرمارکت):</span>
                </div>
                <div className="space-y-1 text-slate-700 leading-relaxed">
                  <p>
                    <span className="text-slate-500 font-medium">نام فروشگاه:</span>{' '}
                    <strong className="text-slate-900">{buyerName}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500 font-medium">مدیریت / متصدی:</span>{' '}
                    <strong className="text-slate-900">{buyerOwner}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500 font-medium">تلفن تماس:</span>{' '}
                    <span className="font-mono text-slate-900">{buyerPhone}</span>
                  </p>
                  <p className="truncate" title={buyerAddress}>
                    <span className="text-slate-500 font-medium">نشانی تحویل:</span>{' '}
                    <span>{buyerAddress}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Items Table */}
            <div className="border border-slate-900 rounded-xl overflow-hidden mb-5">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="py-2.5 px-3 border-l border-slate-700 text-center w-12">ردیف</th>
                    <th className="py-2.5 px-3 border-l border-slate-700">شرح کالا / خدمات</th>
                    <th className="py-2.5 px-3 border-l border-slate-700 text-center w-24">تعداد / واحد</th>
                    <th className="py-2.5 px-3 border-l border-slate-700 text-left w-28">قیمت واحد (تومان)</th>
                    <th className="py-2.5 px-3 text-left w-32">مبلغ کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, index) => {
                      const rowTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                      const itemName = item.name || (item as any).product_name || 'کالای توزیعی';
                      return (
                        <tr
                          key={item.id || index}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}
                        >
                          <td className="py-2.5 px-3 border-l border-slate-200 text-center font-bold text-slate-600">
                            {(index + 1).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-2.5 px-3 border-l border-slate-200 font-semibold text-slate-900">
                            {itemName}
                          </td>
                          <td className="py-2.5 px-3 border-l border-slate-200 text-center font-bold text-slate-800">
                            {(Number(item.quantity) || 0).toLocaleString('fa-IR')}{' '}
                            <span className="text-[10px] text-slate-500 font-normal">عدد/بسته</span>
                          </td>
                          <td className="py-2.5 px-3 border-l border-slate-200 text-left font-mono font-medium text-slate-800">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-950">
                            {formatCurrency(rowTotal)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-medium">
                        اقلام فاکتور یافت نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 4. Totals and Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-5 text-xs">
              {/* Words Amount and Conditions */}
              <div className="sm:col-span-7 border border-slate-300 rounded-xl p-3.5 bg-slate-50 space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-slate-500 font-medium block mb-1">مبلغ کل به حروف فارسی:</span>
                  <p className="font-bold text-slate-900 bg-white p-2 rounded-lg border border-slate-200 leading-relaxed text-[13px]">
                    {priceInWords}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                  <p>• فاکتور فوق پس از رویت و شمارش اقلام توسط خریدار تسویه می‌گردد.</p>
                  <p>• هرگونه مغایرت باید حداکثر تا ۲۴ ساعت پس از تحویل به پشتیبانی اعلام شود.</p>
                </div>
              </div>

              {/* Numerical Calculation Box */}
              <div className="sm:col-span-5 border border-slate-900 rounded-xl overflow-hidden divide-y divide-slate-200">
                <div className="flex items-center justify-between p-2.5 bg-slate-50">
                  <span className="text-slate-600 font-medium">تعداد کل اقلام:</span>
                  <span className="font-bold text-slate-900">
                    {totalItemsCount.toLocaleString('fa-IR')} عدد / کارتن
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50">
                  <span className="text-slate-600 font-medium">تخفیف / آفر توزیع:</span>
                  <span className="font-bold text-slate-600">۰ تومان</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900 text-white font-black text-sm">
                  <span>مبلغ قابل پرداخت:</span>
                  <div className="text-left font-mono">
                    <span className="text-base">{formatCurrency(order.total_amount)}</span>
                    <span className="text-xs font-normal mr-1.5 text-slate-300">تومان</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Signatures and Official Stamp Boxes */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-slate-300 text-xs">
              <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center h-28 flex flex-col justify-between">
                <span className="font-bold text-slate-700">مهر و امضای متصدی فروشگاه (تحویل‌گیرنده):</span>
                <span className="text-[10px] text-slate-400">صحت سفارش و اقلام مورد تایید است</span>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center h-28 flex flex-col justify-between">
                <span className="font-bold text-slate-700">مهر و امضای شرکت پخش فرهودی (تحویل‌دهنده):</span>
                <div className="text-[10px] text-slate-500 font-medium">
                  شبکه پخش عمده فرهودی (بارفروش)
                </div>
              </div>
            </div>

            {/* Footer Watermark */}
            <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[10px] text-slate-400">
              صادر شده توسط سامانه یکپارچه بارفروش | نسخه چاپی معتبر فاکتور فروش
            </div>
          </div>
        </div>

        {/* Bottom Bar Controls for Mobile/Desktop convenience */}
        <div className="no-print p-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 flex items-center gap-1">
            <span className="hidden sm:inline">شماره پیگیری فاکتور:</span>
            <span className="font-mono text-slate-200 font-bold">{order.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{isExportingPdf ? 'در حال خروجی PDF...' : 'دانلود PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فاکتور</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
