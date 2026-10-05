import React, { useRef, useState } from 'react';
import { Order, Supermarket, Visitor, InvoiceSettings, DEFAULT_INVOICE_SETTINGS } from '../../types';
import { exportElementToPdf, printInvoiceDocument } from '../../utils/pdfExport';
import { formatPriceToWords } from '../../utils/numberToPersianWords';
import { formatOrderDate } from '../../utils/dateUtils';
import { useApp } from '../../context/AppContext';
import {
  Printer,
  FileDown,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Store,
  FileText,
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

  const { products, invoiceSettings: contextSettings } = useApp();
  const settings: InvoiceSettings = contextSettings || DEFAULT_INVOICE_SETTINGS;

  if (!isOpen || !order) return null;

  // Format Persian currency
  const formatCurrency = (amount: number) => {
    return (amount || 0).toLocaleString('fa-IR');
  };

  // Seller logic: check if order is direct or assigned to a visitor
  const isDirectOrder = !order.assigned_visitor_id || order.assigned_visitor_id === 'direct';

  // Sale type label from settings
  const saleTypeTitle = isDirectOrder
    ? (settings.direct_sale_title || 'فروش مستقیم')
    : (settings.visitor_sale_title || 'فروش از طریق ویزیتور');

  // Visitor display string: ONLY for non-direct orders, never substitute for direct orders
  const visitorName = !isDirectOrder ? (order.visitor_name || visitor?.name || '') : '';
  const visitorPhone = !isDirectOrder && visitor?.phone ? visitor.phone : '';
  const visitorDisplay = visitorName
    ? (visitorPhone ? `${visitorName} — ${visitorPhone}` : visitorName)
    : '';

  // Central distribution phone numbers from settings (only rows with show_in_invoice !== false)
  const activeCentralPhones = (settings.phones || []).filter(
    (p) => p.show_in_invoice !== false && p.number && p.number.trim()
  );
  const centralPhonesText = activeCentralPhones
    .map((p) => (p.label ? `${p.label}: ${p.number}` : p.number))
    .join('  |  ');

  // Buyer details: strictly from order/supermarket, no fake defaults or dashes if missing
  const buyerName = order.supermarket_name || supermarket?.name || '';
  const buyerOwner = supermarket?.owner || '';
  const buyerPhone = supermarket?.phone || '';
  const buyerAddress = supermarket?.address || '';

  // Format order date display in Asia/Tehran timezone with Persian Solar Hijri calendar
  const formattedDate = formatOrderDate(order.order_date);

  // Financial calculations
  const rawSubtotal = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );
  const subtotal = rawSubtotal > 0 ? rawSubtotal : (order.total_amount || 0);
  const hasVat = Boolean(settings.has_vat);
  const vatPercent = Number(settings.vat_percent) || 0;
  const vatAmount = hasVat ? Math.round(subtotal * (vatPercent / 100)) : 0;
  const finalTotal = subtotal + vatAmount;
  const priceInWords = formatPriceToWords(finalTotal);

  const totalItemsCount = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  // Printing & PDF export handlers
  const handlePrint = () => {
    printInvoiceDocument(printRef.current, order.id, settings.paper_size || 'A4');
  };

  const handleExportPdf = async () => {
    if (!printRef.current) return;
    setIsExportingPdf(true);
    setExportFeedback(null);

    const fileName = `فاکتور_${order.id}.pdf`;
    const success = await exportElementToPdf(printRef.current, fileName, settings.paper_size || 'A4');
    setIsExportingPdf(false);

    if (success) {
      setExportFeedback({
        type: 'success',
        message: 'فایل PDF آماده شد و پنجره ذخیره/دانلود باز گردید.',
      });
      setTimeout(() => setExportFeedback(null), 4000);
    } else {
      printInvoiceDocument(printRef.current, order.id, settings.paper_size || 'A4');
      setExportFeedback({
        type: 'success',
        message: 'صفحه ذخیره باز شد. گزینه «ذخیره به عنوان PDF» را انتخاب نمایید.',
      });
      setTimeout(() => setExportFeedback(null), 5000);
    }
  };

  // Check if any payment details are present
  const hasPaymentDetails = Boolean(
    settings.bank_account_holder ||
    settings.card_number ||
    settings.iban ||
    settings.payment_terms
  );

  // Check if any legal IDs are present
  const hasLegalIds = Boolean(
    settings.national_id ||
    settings.economic_code ||
    settings.registration_number ||
    settings.postal_code
  );

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

        {/* Invoice Viewport Container (Light, ink-friendly paper preview) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 print:p-0 print:overflow-visible">
          {/* Printable Invoice Paper Container */}
          <div
            id="printable-invoice"
            ref={printRef}
            className={`invoice-paper bg-white text-slate-900 rounded-xl p-4 sm:p-6 mx-auto shadow-xl border border-slate-200 print:border-none print:shadow-none print:p-0 print:max-w-none print:rounded-none flex flex-col ${
              settings.paper_size === 'A5' ? 'max-w-2xl' : 'max-w-3xl'
            }`}
            style={{ direction: 'rtl' }}
          >
            {/* ========================================================================= */}
            {/* 1. Header (Single Row: Brand/Logo & Tagline right, Meta Block left) */}
            {/* ========================================================================= */}
            <div className="pb-1.5 mb-1.5 border-b border-slate-200">
              <div className="flex items-center justify-between gap-3">
                {/* Right: Logo, Brand Name & Tagline */}
                <div className="flex items-center gap-3">
                  {settings.show_logo !== false && settings.logo_url && (
                    <img
                      src={settings.logo_url}
                      alt={settings.brand_name || 'لوگو'}
                      className="w-12 h-12 object-contain rounded-lg border border-slate-200 shrink-0"
                    />
                  )}
                  <div>
                    {settings.brand_name && (
                      <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                        {settings.brand_name}
                        {settings.legal_name && settings.legal_name !== settings.brand_name && (
                          <span className="text-slate-600 font-bold text-xs mr-2">
                            ({settings.legal_name})
                          </span>
                        )}
                      </h1>
                    )}
                    {settings.tagline && (
                      <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                        {settings.tagline}
                      </p>
                    )}
                  </div>
                </div>

                {/* Left: Small 2-Column Meta Block (No black background) */}
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-2 text-[11px] leading-snug min-w-[210px] shrink-0">
                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-slate-500 font-medium">شماره:</span>
                      <span className="font-bold text-slate-900 dir-ltr inline-block num-fa">{order.id}</span>
                    </div>
                    {formattedDate && (
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-slate-500 font-medium">تاریخ:</span>
                        <span className="num-fa font-bold text-slate-800">{formattedDate}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-slate-500 font-medium">نوع:</span>
                      <span className="font-bold text-slate-900 truncate">{saleTypeTitle}</span>
                    </div>
                    {settings.copy_label ? (
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-slate-500 font-medium">نسخه:</span>
                        <span className="font-bold text-slate-800 truncate">{settings.copy_label}</span>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              </div>

              {/* Invoice Title Ribbon: Simple clean headline with underline (NOT a black bar) */}
              <div className="border-b-2 border-slate-800 pb-1 mt-2.5 mb-1.5 text-center">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-wide">
                  {settings.invoice_title || 'صورت‌حساب فروش و تحویل کالا'}
                </h2>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. Compact Seller & Buyer Cards Side-by-Side (Reduced height & light border) */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-2 gap-2 mb-2 text-[11px] leading-snug">
              {/* Seller Information Card */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>مشخصات فروشنده</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {(settings.legal_name || settings.brand_name) && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">نام: </span>
                        <strong className="text-slate-900">{settings.legal_name || settings.brand_name}</strong>
                      </div>
                    )}
                    {centralPhonesText && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">تلفن تماس: </span>
                        <span className="num-fa text-slate-900">{centralPhonesText}</span>
                      </div>
                    )}
                    {/* Visitor row: ONLY if non-direct and show_visitor_info is true */}
                    {!isDirectOrder && settings.show_visitor_info !== false && visitorDisplay && (
                      <div className="truncate col-span-2">
                        <span className="text-slate-500 font-medium">ویزیتور: </span>
                        <strong className="text-slate-900 num-fa">{visitorDisplay}</strong>
                      </div>
                    )}
                    {settings.national_id && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">شناسه ملی: </span>
                        <span className="num-fa text-slate-900">{settings.national_id}</span>
                      </div>
                    )}
                    {settings.economic_code && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">کد اقتصادی: </span>
                        <span className="num-fa text-slate-900">{settings.economic_code}</span>
                      </div>
                    )}
                    {settings.registration_number && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">شماره ثبت: </span>
                        <span className="num-fa text-slate-900">{settings.registration_number}</span>
                      </div>
                    )}
                    {settings.postal_code && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">کد پستی: </span>
                        <span className="num-fa text-slate-900">{settings.postal_code}</span>
                      </div>
                    )}
                  </div>
                </div>
                {settings.address && (
                  <div className="border-t border-slate-200 mt-1.5 pt-1 text-[10px] text-slate-700 truncate">
                    <span className="text-slate-500 font-medium">نشانی: </span>
                    <span>{settings.address}</span>
                  </div>
                )}
              </div>

              {/* Buyer Information Card */}
              <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>مشخصات خریدار</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {buyerName && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">فروشگاه: </span>
                        <strong className="text-slate-900">{buyerName}</strong>
                      </div>
                    )}
                    {buyerOwner && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">متصدی: </span>
                        <strong className="text-slate-900">{buyerOwner}</strong>
                      </div>
                    )}
                    {buyerPhone && (
                      <div className="truncate col-span-2">
                        <span className="text-slate-500 font-medium">تلفن: </span>
                        <span className="num-fa text-slate-900">{buyerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
                {settings.show_buyer_address !== false && buyerAddress && (
                  <div className="border-t border-slate-200 mt-1.5 pt-1 text-[10px] text-slate-700 truncate">
                    <span className="text-slate-500 font-medium">نشانی: </span>
                    <span>{buyerAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. Items Table (Light gray header, compact rows, repeat thead on page break) */}
            {/* ========================================================================= */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-2 flex-1">
              <table className="items-table w-full text-right text-[11px] border-collapse">
                <thead style={{ display: 'table-header-group' }}>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                    <th className="py-1.5 px-1.5 border-l border-slate-300 text-center w-8">ردیف</th>
                    <th className="py-1.5 px-2 border-l border-slate-300 text-right w-auto">شرح کالا</th>
                    <th className="py-1.5 px-2 border-l border-slate-300 text-center w-24">تعداد / واحد</th>
                    <th className="py-1.5 px-2 border-l border-slate-300 text-left w-28 whitespace-nowrap">قیمت واحد (تومان)</th>
                    <th className="py-1.5 px-2 text-left w-32 whitespace-nowrap">مبلغ کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, index) => {
                      const rowTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                      const itemName = item.name || (item as any).product_name || 'کالای توزیعی';

                      // Look up unit specified in catalog
                      const productObj = products.find((p) => p.id === item.product_id);
                      const packCount = item.items_per_package || productObj?.items_per_package;
                      const unitStr = (item as any).unit || productObj?.unit || 'عدد';
                      const formattedQtyUnit = packCount && packCount > 1
                        ? `${(Number(item.quantity) || 0).toLocaleString('fa-IR')} ${unitStr} (${packCount} عددی)`
                        : `${(Number(item.quantity) || 0).toLocaleString('fa-IR')} ${unitStr}`;

                      return (
                        <tr
                          key={item.id || index}
                          className={`break-inside-avoid print-avoid-break ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                          style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                        >
                          <td className="py-1 px-1.5 border-l border-slate-200 text-center font-bold text-slate-600 num-fa">
                            {(index + 1).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-1 px-2 border-l border-slate-200 font-semibold text-slate-900 leading-snug">
                            {itemName}
                          </td>
                          <td className="py-1 px-2 border-l border-slate-200 text-center font-bold text-slate-800 whitespace-nowrap num-fa">
                            {formattedQtyUnit}
                          </td>
                          <td className="py-1 px-2 border-l border-slate-200 text-left font-medium text-slate-800 whitespace-nowrap num-fa">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="py-1 px-2 text-left font-bold text-slate-950 whitespace-nowrap num-fa">
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

            {/* ========================================================================= */}
            {/* 4. Bottom Block in Two Columns (Sticky to last rows, break-inside-avoid) */}
            {/* ========================================================================= */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 break-inside-avoid print-avoid-break text-[11px]"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              {/* Right Side (in RTL): Words Amount & Bank/Payment info */}
              <div className="space-y-2 flex flex-col justify-between">
                {/* Words Amount Display (if enabled) */}
                {settings.show_amount_in_words !== false && (
                  <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/70">
                    <span className="text-slate-500 font-medium">مبلغ کل به حروف: </span>
                    <strong className="text-slate-900 num-fa font-bold">{priceInWords} تومان</strong>
                  </div>
                )}

                {/* Bank Account & Payment Terms (Only fields that are non-empty) */}
                {hasPaymentDetails && (
                  <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/70 text-[10px] space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {settings.bank_account_holder && (
                        <span>
                          <span className="text-slate-500">حساب: </span>
                          <strong className="text-slate-900">{settings.bank_account_holder}</strong>
                        </span>
                      )}
                      {settings.card_number && (
                        <span>
                          <span className="text-slate-500">شماره کارت: </span>
                          <strong className="num-fa dir-ltr inline-block text-slate-900">{settings.card_number}</strong>
                        </span>
                      )}
                      {settings.iban && (
                        <span>
                          <span className="text-slate-500">شبا: </span>
                          <strong className="dir-ltr inline-block text-slate-900">
                            IR{settings.iban.replace(/^IR/i, '')}
                          </strong>
                        </span>
                      )}
                    </div>
                    {settings.payment_terms && (
                      <div className="border-t border-slate-200 pt-1 text-[9px] text-slate-600">
                        <span className="font-semibold text-slate-700">شرایط پرداخت: </span>
                        {settings.payment_terms}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Left Side (in RTL): Numerical Totals & Breakdown */}
              <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 space-y-1.5 flex flex-col justify-between">
                <div className="space-y-1 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">تعداد کل اقلام:</span>
                    <strong className="text-slate-900 num-fa font-bold">
                      {totalItemsCount.toLocaleString('fa-IR')}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">جمع کل اقلام:</span>
                    <span className="text-slate-900 num-fa font-bold">
                      {formatCurrency(subtotal)} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                    </span>
                  </div>
                  {hasVat && (
                    <div className="flex items-center justify-between text-amber-800">
                      <span>مالیات و عوارض ({vatPercent}٪):</span>
                      <span className="num-fa font-bold">
                        {formatCurrency(vatAmount)} <span className="text-[10px] font-normal">تومان</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Final Payable Amount (Prominent without heavy black bar) */}
                <div className="border-t-2 border-slate-800 pt-1.5 flex items-center justify-between font-black text-slate-950">
                  <span className="text-xs sm:text-sm font-bold text-slate-900">مبلغ قابل پرداخت:</span>
                  <div className="text-base sm:text-lg font-black text-slate-950 num-fa">
                    {formatCurrency(finalTotal)}{' '}
                    <span className="text-[11px] font-normal text-slate-600">تومان</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 5. Footer (Signatures, Terms & Contact - Break-inside avoid) */}
            {/* ========================================================================= */}
            <div
              className="mt-3 pt-2 border-t border-slate-200 break-inside-avoid print-avoid-break space-y-2 text-[10px]"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              {/* Signature and Stamp Boxes (Three boxes: Seller, Buyer, Receiver) */}
              {settings.show_signature_boxes !== false && (
                <div className="grid grid-cols-3 gap-3 text-center text-slate-700">
                  <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/40 min-h-[55px] flex flex-col justify-between">
                    <span className="font-bold text-slate-800">امضا و مهر فروشنده</span>
                    <span className="text-[9px] text-slate-400 mt-4">{settings.brand_name || 'واحد فروش'}</span>
                  </div>
                  <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/40 min-h-[55px] flex flex-col justify-between">
                    <span className="font-bold text-slate-800">امضا و مهر خریدار</span>
                    <span className="text-[9px] text-slate-400 mt-4">{buyerName || 'متصدی فروشگاه'}</span>
                  </div>
                  <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/40 min-h-[55px] flex flex-col justify-between">
                    <span className="font-bold text-slate-800">امضا و اثر انگشت تحویل‌گیرنده</span>
                    <span className="text-[9px] text-slate-400 mt-4">نام و امضا</span>
                  </div>
                </div>
              )}

              {/* Footer Terms & Delivery Note */}
              {settings.footer_notes && (
                <p className="text-[10px] text-slate-600 text-center leading-relaxed">
                  {settings.footer_notes}
                </p>
              )}

              {/* Website / Contact & Page Number Strip */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200 pt-1">
                <div>
                  {settings.website_or_contact ? (
                    <span className="num-fa">{settings.website_or_contact}</span>
                  ) : (
                    <span />
                  )}
                </div>
                {settings.show_page_number !== false && (
                  <div className="num-fa text-slate-600">صفحه ۱ از ۱</div>
                )}
              </div>
            </div>
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
