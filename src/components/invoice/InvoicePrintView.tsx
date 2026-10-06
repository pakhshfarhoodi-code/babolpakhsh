import React from 'react';
import { LoadingBill, LoadingBillItem, Visitor, Product, Order, InvoiceSettings, DEFAULT_INVOICE_SETTINGS } from '../../types';
import { formatPriceToWords, numberToPersianWords } from '../../utils/numberToPersianWords';
import { formatPrice } from '../visitor/helpers';
import { toPersianDigits } from '../shop/shopUtils';
import farhoodiLogo from '../../assets/images/farhoodi_b2b_logo.webp';
import { useApp } from '../../context/AppContext';
import {
  getPackSize,
  getBaseUnit,
  getUnitColumnText,
  isPackaged,
  computeLine,
} from '../../utils/orderLine';
import {
  FileText,
  Clock,
  CheckCircle2,
  Truck,
  AlertTriangle,
  Building2,
  Store,
  User,
  Package,
} from 'lucide-react';

export interface InvoicePrintViewProps {
  bill: LoadingBill;
  visitor: Visitor;
  products: Product[];
  orders?: Order[];
  showCustomerBreakdown?: boolean;
}

export const InvoicePrintView: React.FC<InvoicePrintViewProps> = ({
  bill,
  visitor,
  products,
  orders = [],
  showCustomerBreakdown = false,
}) => {
  const { invoiceSettings: contextSettings } = useApp();
  const settings: InvoiceSettings = contextSettings || DEFAULT_INVOICE_SETTINGS;
  const currencyLabel = settings.currency_label || 'تومان';

  // Map products for fast lookup
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  // Map orders for fast lookup of customer / supermarket names
  const orderMap = new Map<string, Order>();
  orders.forEach((o) => orderMap.set(o.id, o));

  // 1. Aggregated Items for Page 1 (Strictly visitor purchase price, no retail prices, no margin)
  const aggregatedItemsMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      pack: number;
      baseUnit: string;
      totalQuantity: number;
      visitorPrice: number;
      totalAmount: number;
      notes: string[];
    }
  >();

  if (bill.items) {
    for (const it of bill.items) {
      const prod = productMap.get(it.product_id);
      const pack = getPackSize(it.items_per_package || prod?.items_per_package);
      const baseUnit = getBaseUnit(it.unit || prod?.unit, pack);
      const vPrice = Number(prod?.visitor_price ?? (it.visitor_price ?? 0));
      const lineCalc = computeLine({
        quantity: it.quantity,
        pack,
        unitPrice: vPrice,
        discountPercent: 0,
      });

      const existing = aggregatedItemsMap.get(it.product_id);
      if (existing) {
        existing.totalQuantity = Math.round((existing.totalQuantity + it.quantity) * 1000) / 1000;
        existing.totalAmount += lineCalc.total;
        if (it.customer_label || it.line_note) {
          existing.notes.push([it.customer_label, it.line_note].filter(Boolean).join(' - '));
        }
      } else {
        aggregatedItemsMap.set(it.product_id, {
          productId: it.product_id,
          productName: it.product_name,
          pack,
          baseUnit,
          totalQuantity: it.quantity,
          visitorPrice: vPrice,
          totalAmount: lineCalc.total,
          notes: it.customer_label || it.line_note ? [[it.customer_label, it.line_note].filter(Boolean).join(' - ')] : [],
        });
      }
    }
  }

  const aggregatedList = Array.from(aggregatedItemsMap.values());
  const grandTotal = aggregatedList.reduce((acc, it) => acc + it.totalAmount, 0);
  const totalUnits = Math.round(aggregatedList.reduce((acc, it) => acc + (Number(it.totalQuantity) || 0), 0) * 1000) / 1000;

  // 2. Customer Groups for Page 2 (Breakdown without prices)
  const customerGroupsMap = new Map<
    string,
    {
      groupKey: string;
      customerName: string;
      source: 'order' | 'visitor_manual' | 'admin_manual';
      orderId?: string | null;
      items: LoadingBillItem[];
      totalUnits: number;
    }
  >();

  if (bill.items) {
    for (const it of bill.items) {
      const src = it.source || 'order';
      let groupKey = '';
      let customerName = '';

      if (it.order_id) {
        groupKey = `order-${it.order_id}`;
        const relatedOrder = orderMap.get(it.order_id);
        customerName = relatedOrder?.supermarket_name || it.customer_label || `سفارش سامانه ${it.order_id}`;
      } else if (it.customer_label) {
        groupKey = `manual-${it.customer_label}`;
        customerName = it.customer_label;
      } else {
        groupKey = `manual-general-${src}`;
        customerName = src === 'admin_manual' ? 'توافق تلفنی / حضوری ادمین' : 'اقلام مازاد ویزیتور';
      }

      const existing = customerGroupsMap.get(groupKey);
      if (existing) {
        existing.items.push(it);
        existing.totalUnits = Math.round((existing.totalUnits + it.quantity) * 1000) / 1000;
      } else {
        customerGroupsMap.set(groupKey, {
          groupKey,
          customerName,
          source: src,
          orderId: it.order_id,
          items: [it],
          totalUnits: it.quantity,
        });
      }
    }
  }

  const customerGroupsList = Array.from(customerGroupsMap.values());

  // Format Jalali Date
  const formatJalaliDate = (dateStr?: string | null): string => {
    if (!dateStr) return 'امروز';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const isFinal = bill.status === 'approved' || bill.status === 'loaded';
  const isDraft = !isFinal;
  const isRevised = (bill.revision_count ?? 0) > 0;

  return (
    <div className="printable-invoice-container w-full bg-white text-slate-900 font-sans leading-relaxed select-text" dir="rtl">
      {/* ========================================================================= */}
      {/* PAGE 1: A4 OFFICIAL VISITOR INVOICE (فاکتور تجمیعی و حواله بارگیری ویزیتور) */}
      {/* ========================================================================= */}
      <div className="invoice-page p-6 sm:p-8 min-h-[285mm] flex flex-col justify-between border-b border-dashed border-slate-300 print:border-none print:p-0">
        <div>
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-5">
            {/* Right: Company Logo and Branding */}
            <div className="flex items-center gap-3">
              {settings.show_logo !== false && (
                <img
                  src={settings.logo_url || farhoodiLogo}
                  alt={settings.brand_name || 'لوگوی فروشنده'}
                  className="w-14 h-14 object-contain rounded-xl border border-slate-200 p-0.5"
                />
              )}
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {settings.legal_name || settings.brand_name || 'صنایع غذایی منجمد و سردخانه‌ای'}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5 font-semibold">
                  {settings.tagline || 'حواله بارگیری و فاکتور توزیع مویرگی ویزیتور'}
                </p>
              </div>
            </div>

            {/* Left: Invoice Number & Date Box */}
            <div className="text-left space-y-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 min-w-[170px]">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 font-semibold">شماره سند:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {bill.invoice_no || bill.id}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 font-semibold">تاریخ تایید:</span>
                <span className="font-mono text-slate-800">
                  {formatJalaliDate(bill.finalized_at || bill.approved_at || bill.submitted_at || bill.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Watermark / Status & Revision Tag Banner */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2 text-xs">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              {isDraft ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-300 text-blue-800 font-black tracking-wide">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>پیش‌نمایش پیش‌نویس (غیرنهایی)</span>
                </div>
              ) : bill.status === 'loaded' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-black">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>بارگیری و خروج از انبار انجام شده</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 font-black">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>فاکتور رسمی و تایید شده</span>
                </div>
              )}

              {/* Revision Count Badge if modified */}
              {isRevised && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>اصلاح‌شده ({bill.revision_count} بار)</span>
                </div>
              )}
            </div>

            {/* Note on wholesale purchase */}
            <div className="text-slate-500 font-medium text-[11px]">
              * مبالغ مندرج صرفاً نرخ خرید و تحویل ویزیتور می‌باشد.
            </div>
          </div>

          {/* Visitor & Destination Metadata Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 border border-slate-200 rounded-xl p-3 mb-5 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">نام ویزیتور:</span>
              <strong className="text-slate-900 font-black mt-0.5 block">{visitor.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">منطقه / مسیر توزیع:</span>
              <span className="text-slate-800 font-bold mt-0.5 block">{visitor.region || 'مسیر سراسری'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">شماره تماس:</span>
              <span className="text-slate-800 font-mono mt-0.5 block">{visitor.phone || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">تاییدکننده انبار / ادمین:</span>
              <span className="text-slate-800 font-bold mt-0.5 block">{bill.finalized_by || 'مدیریت پخش'}</span>
            </div>
          </div>

          {/* Aggregated Items Table (Strictly visitor purchase price, NO retail prices, NO margins) */}
          <div className="overflow-hidden rounded-xl border border-slate-300 mb-5">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-black">
                  <th className="py-2.5 px-3 w-10 text-center">ردیف</th>
                  <th className="py-2.5 px-3">شرح کالای منجمد</th>
                  <th className="py-2.5 px-3 w-24 text-center">تعداد</th>
                  <th className="py-2.5 px-3 w-32 text-center">واحد (تعداد در کارتن)</th>
                  <th className="py-2.5 px-3 w-32 text-left">قیمت واحد ({currencyLabel})</th>
                  <th className="py-2.5 px-3 w-36 text-left">مبلغ کل ({currencyLabel})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {aggregatedList.map((item, index) => (
                  <tr key={item.productId} className="print-avoid-break hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-600 font-semibold">{toPersianDigits(index + 1)}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900">{toPersianDigits(item.productName)}</span>
                      {item.notes.length > 0 && (
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          اقلام متفرقه / آزاد: {item.notes.map((n) => toPersianDigits(n)).join(' ، ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                      <span className="text-sm">{toPersianDigits(item.totalQuantity.toLocaleString('fa-IR'))}</span>
                      {isPackaged(item.pack) && (
                        <span className="text-[10px] text-slate-500 font-normal mr-1">کارتن</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                      {getUnitColumnText(item.pack, item.baseUnit)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-bold text-slate-800">
                      {formatPrice(item.visitorPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-bold text-slate-900">
                      {formatPrice(item.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black border-t-2 border-slate-400 text-slate-900">
                  <td colSpan={2} className="py-3 px-3 text-right">
                    مجموع کل اقلام فاکتور ویزیتور:
                  </td>
                  <td className="py-3 px-3 text-center text-blue-900 font-black text-sm">
                    {toPersianDigits(totalUnits.toLocaleString('fa-IR'))}
                  </td>
                  <td colSpan={2} className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-left font-black text-sm text-slate-900">
                    {formatPrice(grandTotal)} {currencyLabel}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Words Total Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs mb-8 print-avoid-break">
            <div>
              <span className="text-slate-600 font-semibold">مبلغ کل فاکتور به حروف: </span>
              <strong className="font-black text-slate-900">{numberToPersianWords(grandTotal)} {currencyLabel} تمام</strong>
            </div>
            <div className="text-slate-500 text-[11px]">
              این برگه به منزله رسید قطعی بارگیری و تحویل از انبار شرکت پخش {settings.brand_name || 'مرکزی'} می‌باشد.
            </div>
          </div>
        </div>

        {/* Signatures Block (Bottom of Page 1) */}
        <div className="print-avoid-break pt-4 border-t border-slate-300 text-xs">
          <div className="grid grid-cols-2 gap-8 text-center">
            <div className="space-y-12">
              <p className="font-black text-slate-800">امضا و تایید مسئول انبار / سردخانه</p>
              <div className="h-10 border-b border-dashed border-slate-400 w-48 mx-auto"></div>
            </div>
            <div className="space-y-12">
              <p className="font-black text-slate-800">امضا و اثر انگشت ویزیتور (تحویل‌گیرنده)</p>
              <div className="h-10 border-b border-dashed border-slate-400 w-48 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAGE 2: OPTIONAL CUSTOMER BREAKDOWN (ریز اقلام به تفکیک مشتریان بدون قیمت) */}
      {/* ========================================================================= */}
      {showCustomerBreakdown && (
        <div className="invoice-page print-page-break p-6 sm:p-8 min-h-[285mm] flex flex-col justify-between">
          <div>
            {/* Header Page 2 */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-5">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  ریز اقلام تحویلی به تفکیک فروشگاه‌ها و مشتریان
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 font-semibold">
                  پیوست فاکتور بارگیری شماره: <span className="font-mono text-slate-900 font-bold">{bill.invoice_no || bill.id}</span> | ویزیتور: {visitor.name}
                </p>
              </div>

              <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800">
                فهرست تحویل کالا (فاقد قیمت)
              </div>
            </div>

            {/* Notice */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs mb-4">
              این پیوست صرفاً جهت توزیع و تحویل فیزیکی کالا به فروشگاه‌ها بوده و فاقد هرگونه اطلاعات قیمتی و ریالی است.
            </div>

            {/* List of Customers & Stores */}
            <div className="space-y-4">
              {customerGroupsList.map((group, gIdx) => (
                <div key={group.groupKey} className="print-avoid-break rounded-xl border border-slate-300 overflow-hidden">
                  {/* Customer Title Bar */}
                  <div className="bg-slate-100 p-2.5 px-3 flex items-center justify-between border-b border-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-600">{gIdx + 1}.</span>
                      <strong className="text-slate-900 font-bold text-xs">{group.customerName}</strong>
                      {group.source === 'order' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          سفارش سامانه ({group.orderId})
                        </span>
                      )}
                      {group.source === 'visitor_manual' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                          اقلام مازاد ویزیتور
                        </span>
                      )}
                      {group.source === 'admin_manual' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          قلم توافقی ادمین
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700 font-bold font-mono">
                      مجموع: {group.totalUnits} واحد
                    </div>
                  </div>

                  {/* Customer Items Table (STRICTLY NO PRICES) */}
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold text-[11px]">
                        <th className="py-2 px-3 w-8 text-center">ردیف</th>
                        <th className="py-2 px-3">نام کالای منجمد</th>
                        <th className="py-2 px-3 w-24 text-center">تعداد تحویلی</th>
                        <th className="py-2 px-3 w-32 text-center">واحد (تعداد در کارتن)</th>
                        <th className="py-2 px-3">توضیحات و هماهنگی</th>
                        <th className="py-2 px-3 w-32 text-center">امضای تحویل‌گیرنده</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {group.items.map((it, idx) => {
                        const prod = productMap.get(it.product_id);
                        const pack = getPackSize(it.items_per_package || prod?.items_per_package);
                        const baseUnit = getBaseUnit(it.unit || prod?.unit, pack);

                        return (
                          <tr key={it.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{it.product_name}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-900">
                              <span className="font-mono">{Number(it.quantity).toLocaleString('fa-IR')}</span>
                              {isPackaged(pack) && (
                                <span className="text-[10px] text-slate-500 font-normal mr-1">کارتن</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-600 font-medium">
                              {getUnitColumnText(pack, baseUnit)}
                            </td>
                            <td className="py-2 px-3 text-slate-600 text-[11px]">
                              {it.line_note || '-'}
                            </td>
                            <td className="py-2 px-3 text-center border-r border-slate-200">
                              <div className="h-6 w-24 border-b border-dotted border-slate-300 mx-auto"></div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom of Page 2 */}
          <div className="print-avoid-break pt-4 mt-6 border-t border-slate-300 text-xs text-center text-slate-500">
            پیوست توزیع مویرگی {settings.brand_name || 'مرکزی'} - تحویل گردید توسط ویزیتور: {visitor.name}
          </div>
        </div>
      )}
    </div>
  );
};
