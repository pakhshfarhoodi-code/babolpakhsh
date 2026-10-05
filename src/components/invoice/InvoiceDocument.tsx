import React from 'react';
import {
  Order,
  Supermarket,
  Visitor,
  InvoiceSettings,
  InvoiceSectionKey,
  DEFAULT_INVOICE_SETTINGS,
  DEFAULT_INVOICE_LAYOUT_SETTINGS,
} from '../../types';
import { formatPriceToWords } from '../../utils/numberToPersianWords';
import { formatOrderDate } from '../../utils/dateUtils';
import { Building2, Store } from 'lucide-react';

export interface InvoiceDocumentProps {
  order: Order;
  settings?: InvoiceSettings;
  supermarket?: Supermarket | null;
  visitor?: Visitor | null;
  isPrintMode?: boolean;
  className?: string;
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
  order,
  settings: propSettings,
  supermarket,
  visitor,
  isPrintMode = false,
  className = '',
}) => {
  const settings = propSettings || DEFAULT_INVOICE_SETTINGS;
  const show = settings.show;
  const layout = settings.layout;

  // Seller logic: check if order is direct or assigned to a visitor
  const isDirectOrder = !order.assigned_visitor_id || order.assigned_visitor_id === 'direct';

  // Sale type label from settings
  const saleTypeTitle = isDirectOrder
    ? (settings.direct_sale_title || 'فروش مستقیم')
    : (settings.visitor_sale_title || 'فروش از طریق ویزیتور');

  // Visitor display: ONLY for non-direct orders
  const visitorName = !isDirectOrder ? (order.visitor_name || visitor?.name || '') : '';
  const visitorPhone = !isDirectOrder && visitor?.phone ? visitor.phone : '';
  const hasVisitorInfo = Boolean(show.seller_visitor && visitorName);

  // Active central distribution phone numbers
  const activeCentralPhones = show.seller_phones
    ? (settings.phones || []).filter(
        (p) => p.show_in_invoice !== false && p.number && p.number.trim().length > 0
      )
    : [];

  // Buyer details: strictly from order/supermarket, no fake defaults
  const buyerStoreName = (show.buyer_store_name && (order.supermarket_name || supermarket?.name)) || '';
  const buyerOwner = (show.buyer_owner && supermarket?.owner) || '';
  const buyerPhone = (show.buyer_phone && supermarket?.phone) || '';
  const buyerAddress = (show.buyer_address && supermarket?.address) || '';

  const hasAnyBuyerInfo = Boolean(buyerStoreName || buyerOwner || buyerPhone || buyerAddress);

  // Seller details check
  const sellerName = (show.seller_name && settings.brand_name) || '';
  const sellerLegalName = (show.seller_legal_name && settings.legal_name) || '';
  const sellerAddress = (show.seller_address && settings.address) || '';
  const sellerNationalId = (show.seller_national_id && settings.national_id) || '';
  const sellerEconomicCode = (show.seller_economic_code && settings.economic_code) || '';
  const sellerRegistrationNumber = (show.seller_registration_number && settings.registration_number) || '';
  const sellerPostalCode = (show.seller_postal_code && settings.postal_code) || '';

  const hasAnySellerInfo = Boolean(
    sellerName ||
    sellerLegalName ||
    sellerAddress ||
    activeCentralPhones.length > 0 ||
    hasVisitorInfo ||
    sellerNationalId ||
    sellerEconomicCode ||
    sellerRegistrationNumber ||
    sellerPostalCode
  );

  // Format order date
  const rawDate = formatOrderDate(order.order_date);
  const formattedDate = show.order_date ? rawDate : '';

  // Order items calculations
  const rawItems = order.items || [];
  const rawSubtotal = rawItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );
  const subtotal = rawSubtotal > 0 ? rawSubtotal : (order.total_amount || 0);
  const hasVat = Boolean(settings.has_vat);
  const vatPercent = Number(settings.vat_percent) || 0;
  const vatAmount = hasVat ? Math.round(subtotal * (vatPercent / 100)) : 0;
  const finalTotal = subtotal + vatAmount;
  const priceInWords = show.amount_in_words ? formatPriceToWords(finalTotal) : '';

  const totalItemsCount = rawItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  // Check payment info presence
  const paymentHolder = (show.payment_account_holder && settings.bank_account_holder) || '';
  const paymentCard = (show.payment_card && settings.card_number) || '';
  const paymentIban = (show.payment_iban && settings.iban) || '';
  const paymentTermsText = (show.payment_terms && settings.payment_terms) || '';

  const hasAnyPaymentInfo = Boolean(
    paymentHolder ||
    paymentCard ||
    paymentIban ||
    paymentTermsText ||
    priceInWords
  );

  // Check summary info presence
  const hasAnySummaryInfo = Boolean(
    show.summary_items_count ||
    show.summary_subtotal ||
    (show.summary_vat && hasVat) ||
    show.summary_final_total
  );

  // Check terms presence
  const termsText = (show.terms_and_conditions && settings.footer_notes) || '';

  // Signatures presence
  const hasAnySignature = Boolean(
    show.signatures_seller ||
    show.signatures_buyer ||
    show.signatures_receiver
  );

  // Multi-page Pagination Engine
  const isA5 = settings.paper_size === 'A5';
  const singlePageMaxRows = isA5 ? 5 : 8;
  const multiPageFirstPageRows = isA5 ? 7 : 11;
  const multiPageMiddlePageRows = isA5 ? 12 : 18;
  const multiPageLastPageRowsWithSummary = isA5 ? 6 : 9;

  let pageItemChunks: typeof rawItems[] = [];

  if (rawItems.length <= singlePageMaxRows || rawItems.length === 0) {
    pageItemChunks = [rawItems];
  } else {
    // Multi-page slicing
    let currentIndex = 0;
    const totalCount = rawItems.length;

    // Page 1: with header & cards
    const page1Count = Math.min(totalCount, multiPageFirstPageRows);
    pageItemChunks.push(rawItems.slice(0, page1Count));
    currentIndex += page1Count;

    while (currentIndex < totalCount) {
      const remaining = totalCount - currentIndex;
      if (remaining <= multiPageLastPageRowsWithSummary) {
        pageItemChunks.push(rawItems.slice(currentIndex));
        currentIndex = totalCount;
      } else if (remaining <= multiPageMiddlePageRows) {
        // Split remaining reasonably
        const half = Math.ceil(remaining / 2);
        pageItemChunks.push(rawItems.slice(currentIndex, currentIndex + half));
        currentIndex += half;
      } else {
        pageItemChunks.push(rawItems.slice(currentIndex, currentIndex + multiPageMiddlePageRows));
        currentIndex += multiPageMiddlePageRows;
      }
    }
  }

  const totalPages = pageItemChunks.length;

  // ---------------------------------------------------------------------------
  // Sub-renderers for each section key
  // ---------------------------------------------------------------------------

  const renderHeader = (pageIndex: number) => {
    if (pageIndex > 0) {
      // Minimal header for page 2+
      return (
        <div className="pb-2 mb-2 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {show.logo && settings.logo_url && (
              <img
                src={settings.logo_url}
                alt={settings.brand_name || 'لوگو'}
                className="w-7 h-7 object-contain rounded border border-slate-200"
              />
            )}
            {show.brand_name && settings.brand_name && (
              <span className="font-bold text-slate-800">{settings.brand_name}</span>
            )}
            {show.invoice_title && (
              <span className="text-slate-500 font-medium">({settings.invoice_title})</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            {show.order_id && (
              <div>
                <span>شماره سفارش: </span>
                <strong className="num-fa dir-ltr inline-block text-slate-900">{order.id}</strong>
              </div>
            )}
            {show.order_date && formattedDate && (
              <div>
                <span>تاریخ: </span>
                <strong className="num-fa text-slate-800">{formattedDate}</strong>
              </div>
            )}
            <div className="num-fa font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              ادامه صفحه {pageIndex + 1} از {totalPages}
            </div>
          </div>
        </div>
      );
    }

    // Full Header for Page 1
    const logoPos = layout.logo_position || 'right';
    const orderPos = layout.order_info_position || 'left';

    const hasMetaBlock = Boolean(
      show.order_id ||
      (show.order_date && formattedDate) ||
      show.sale_type ||
      (show.version_badge && settings.copy_label)
    );

    return (
      <div className="pb-1.5 mb-1.5 border-b border-slate-200">
        <div
          className={`flex items-center justify-between gap-3 ${
            logoPos === 'left' ? 'flex-row-reverse' : ''
          }`}
        >
          {/* Brand & Identity */}
          <div
            className={`flex items-center gap-3 ${
              logoPos === 'center' ? 'mx-auto justify-center' : ''
            }`}
          >
            {show.logo && settings.logo_url && (
              <img
                src={settings.logo_url}
                alt={settings.brand_name || 'لوگو'}
                className="w-12 h-12 object-contain rounded-lg border border-slate-200 shrink-0"
              />
            )}
            <div>
              {show.brand_name && settings.brand_name && (
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                  {settings.brand_name}
                  {show.seller_legal_name &&
                    settings.legal_name &&
                    settings.legal_name !== settings.brand_name && (
                      <span className="text-slate-600 font-bold text-xs mr-2">
                        ({settings.legal_name})
                      </span>
                    )}
                </h1>
              )}
              {show.tagline && settings.tagline && (
                <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                  {settings.tagline}
                </p>
              )}
            </div>
          </div>

          {/* Meta Information Chip */}
          {hasMetaBlock && (
            <div
              className={`bg-slate-50 border border-slate-300 rounded-lg p-2 text-[11px] leading-snug min-w-[210px] shrink-0 ${
                orderPos === 'right' && logoPos === 'left' ? 'order-first' : ''
              }`}
            >
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
                {show.order_id && (
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-500 font-medium">شماره:</span>
                    <span className="font-bold text-slate-900 dir-ltr inline-block num-fa">
                      {order.id}
                    </span>
                  </div>
                )}
                {show.order_date && formattedDate && (
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-500 font-medium">تاریخ:</span>
                    <span className="num-fa font-bold text-slate-800">{formattedDate}</span>
                  </div>
                )}
                {show.sale_type && (
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-500 font-medium">نوع:</span>
                    <span className="font-bold text-slate-900 truncate">{saleTypeTitle}</span>
                  </div>
                )}
                {show.version_badge && settings.copy_label && (
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-500 font-medium">نسخه:</span>
                    <span className="font-bold text-slate-800 truncate">
                      {settings.copy_label}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Invoice Title Ribbon */}
        {show.invoice_title && settings.invoice_title && (
          <div className="border-b-2 border-slate-800 pb-1 mt-2.5 mb-1.5 text-center">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-wide">
              {settings.invoice_title}
            </h2>
          </div>
        )}
      </div>
    );
  };

  const renderSellerCard = () => {
    if (!hasAnySellerInfo) return null;
    const cols = layout.seller_card_columns === 1 ? 'grid-cols-1' : 'grid-cols-2';

    return (
      <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 flex flex-col justify-between text-[11px] leading-snug">
        <div>
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span>مشخصات فروشنده</span>
          </div>

          <div className={`grid ${cols} gap-x-2 gap-y-1`}>
            {(sellerLegalName || sellerName) && (
              <div className="truncate">
                <span className="text-slate-500 font-medium">نام: </span>
                <strong className="text-slate-900">{sellerLegalName || sellerName}</strong>
              </div>
            )}

            {/* Central Phones: Each phone on its own line */}
            {activeCentralPhones.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium shrink-0">
                  {p.label ? `${p.label}:` : 'تلفن:'}
                </span>
                <strong className="num-fa text-slate-800 dir-ltr inline-block">{p.number}</strong>
              </div>
            ))}

            {hasVisitorInfo && (
              <div className="col-span-full truncate bg-blue-50/60 rounded px-1.5 py-0.5 border border-blue-100 text-blue-900 font-medium">
                <span>ویزیتور: </span>
                <strong className="font-bold text-blue-950">
                  {visitorName}
                  {visitorPhone ? ` — ${visitorPhone}` : ''}
                </strong>
              </div>
            )}

            {sellerNationalId && (
              <div>
                <span className="text-slate-500 font-medium">شناسه ملی: </span>
                <span className="num-fa text-slate-800 dir-ltr inline-block">{sellerNationalId}</span>
              </div>
            )}

            {sellerEconomicCode && (
              <div>
                <span className="text-slate-500 font-medium">کد اقتصادی: </span>
                <span className="num-fa text-slate-800 dir-ltr inline-block">{sellerEconomicCode}</span>
              </div>
            )}

            {sellerRegistrationNumber && (
              <div>
                <span className="text-slate-500 font-medium">شماره ثبت: </span>
                <span className="num-fa text-slate-800 dir-ltr inline-block">
                  {sellerRegistrationNumber}
                </span>
              </div>
            )}

            {sellerPostalCode && (
              <div>
                <span className="text-slate-500 font-medium">کد پستی: </span>
                <span className="num-fa text-slate-800 dir-ltr inline-block">{sellerPostalCode}</span>
              </div>
            )}
          </div>
        </div>

        {sellerAddress && (
          <div className="mt-1.5 pt-1 border-t border-slate-200 text-slate-700">
            <span className="text-slate-500 font-medium">آدرس: </span>
            <span>{sellerAddress}</span>
          </div>
        )}
      </div>
    );
  };

  const renderBuyerCard = () => {
    if (!hasAnyBuyerInfo) return null;
    const cols = layout.buyer_card_columns === 1 ? 'grid-cols-1' : 'grid-cols-2';

    return (
      <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/50 flex flex-col justify-between text-[11px] leading-snug">
        <div>
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span>مشخصات خریدار</span>
          </div>

          <div className={`grid ${cols} gap-x-2 gap-y-1`}>
            {buyerStoreName && (
              <div className="truncate">
                <span className="text-slate-500 font-medium">فروشگاه: </span>
                <strong className="text-slate-900">{buyerStoreName}</strong>
              </div>
            )}

            {buyerOwner && (
              <div className="truncate">
                <span className="text-slate-500 font-medium">متصدی: </span>
                <strong className="text-slate-800">{buyerOwner}</strong>
              </div>
            )}

            {buyerPhone && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium shrink-0">تلفن: </span>
                <strong className="num-fa text-slate-800 dir-ltr inline-block">{buyerPhone}</strong>
              </div>
            )}
          </div>
        </div>

        {buyerAddress && (
          <div className="mt-1.5 pt-1 border-t border-slate-200 text-slate-700">
            <span className="text-slate-500 font-medium">آدرس: </span>
            <span>{buyerAddress}</span>
          </div>
        )}
      </div>
    );
  };

  const renderItemsTable = (itemsChunk: typeof rawItems, startIndex: number) => {
    return (
      <div className="mb-2 overflow-hidden rounded-lg border border-slate-300">
        <table className="w-full text-right border-collapse text-xs items-table">
          <thead>
            <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300">
              {show.col_row_index && (
                <th className="py-1.5 px-2 text-center w-10 border-l border-slate-300">#</th>
              )}
              {show.col_product_name && (
                <th className="py-1.5 px-2.5 border-l border-slate-300">شرح کالا / خدمات</th>
              )}
              {show.col_quantity_unit && (
                <th className="py-1.5 px-2 text-center w-24 border-l border-slate-300">
                  تعداد / واحد
                </th>
              )}
              {show.col_unit_price && (
                <th className="py-1.5 px-2 text-center w-28 border-l border-slate-300">
                  فی (ریال)
                </th>
              )}
              {show.col_total_price && (
                <th className="py-1.5 px-2 text-center w-32">مبلغ کل (ریال)</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {itemsChunk.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                  هیچ قلم کالایی در این سفارش ثبت نشده است.
                </td>
              </tr>
            ) : (
              itemsChunk.map((item, idx) => {
                const globalIndex = startIndex + idx + 1;
                const qty = Number(item.quantity) || 0;
                const unitPrice = Number(item.price) || 0;
                const itemTotal = qty * unitPrice;
                const unitName = (item as any).unit || 'عدد';

                return (
                  <tr
                    key={item.product_id || idx}
                    className="hover:bg-slate-50/50 break-inside-avoid"
                  >
                    {show.col_row_index && (
                      <td className="py-1 px-2 text-center num-fa text-slate-600 font-medium border-l border-slate-200">
                        {globalIndex}
                      </td>
                    )}
                    {show.col_product_name && (
                      <td className="py-1 px-2.5 font-bold text-slate-900 border-l border-slate-200">
                        {(item as any).product_name || item.name}
                      </td>
                    )}
                    {show.col_quantity_unit && (
                      <td className="py-1 px-2 text-center border-l border-slate-200">
                        <span className="num-fa font-bold text-slate-800">{qty}</span>
                        {unitName && (
                          <span className="text-[10px] text-slate-500 mr-1">{unitName}</span>
                        )}
                      </td>
                    )}
                    {show.col_unit_price && (
                      <td className="py-1 px-2 text-center num-fa font-bold text-slate-700 border-l border-slate-200">
                        {unitPrice.toLocaleString('fa-IR')}
                      </td>
                    )}
                    {show.col_total_price && (
                      <td className="py-1 px-2 text-center num-fa font-black text-slate-900">
                        {itemTotal.toLocaleString('fa-IR')}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPaymentInfo = () => {
    if (!hasAnyPaymentInfo) return null;

    return (
      <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50 flex flex-col justify-between text-[11px] leading-snug break-inside-avoid">
        <div>
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
            مشخصات پرداخت و تسویه
          </div>

          {show.amount_in_words && priceInWords && (
            <div className="mb-2 p-1.5 bg-white rounded border border-slate-200 text-slate-800">
              <span className="text-slate-500 font-medium">مبلغ به حروف: </span>
              <strong className="font-bold text-slate-900">{priceInWords} ریال</strong>
            </div>
          )}

          <div className="space-y-1 text-slate-700">
            {paymentHolder && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">صاحب حساب:</span>
                <span className="font-bold text-slate-900">{paymentHolder}</span>
              </div>
            )}

            {paymentCard && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">شماره کارت:</span>
                <span className="num-fa font-bold text-slate-900 dir-ltr inline-block">
                  {paymentCard}
                </span>
              </div>
            )}

            {paymentIban && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">شماره شبا:</span>
                <span className="num-fa font-bold text-slate-900 dir-ltr inline-block">
                  {paymentIban}
                </span>
              </div>
            )}
          </div>
        </div>

        {paymentTermsText && (
          <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10.5px] text-slate-600">
            <span className="text-slate-500 font-medium">شرایط تسویه: </span>
            <span>{paymentTermsText}</span>
          </div>
        )}
      </div>
    );
  };

  const renderTotalsSummary = () => {
    if (!hasAnySummaryInfo) return null;

    return (
      <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50 flex flex-col justify-between text-xs break-inside-avoid">
        <div className="space-y-1.5">
          {show.summary_items_count && (
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-medium">تعداد کل اقلام سفارش:</span>
              <span className="num-fa font-bold text-slate-800">{totalItemsCount}</span>
            </div>
          )}

          {show.summary_subtotal && (
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-medium">جمع کل اقلام:</span>
              <span className="num-fa font-bold text-slate-900">
                {subtotal.toLocaleString('fa-IR')} ریال
              </span>
            </div>
          )}

          {show.summary_vat && hasVat && (
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-medium">مالیات و عوارض ارزش افزوده ({vatPercent}٪):</span>
              <span className="num-fa font-bold text-slate-900">
                {vatAmount.toLocaleString('fa-IR')} ریال
              </span>
            </div>
          )}
        </div>

        {show.summary_final_total && (
          <div className="mt-2 pt-2 border-t-2 border-slate-800 flex items-center justify-between bg-slate-100/80 -mx-2.5 -mb-2.5 p-2.5 rounded-b-lg">
            <span className="font-black text-slate-950 text-xs sm:text-sm">مبلغ قابل پرداخت:</span>
            <span className="num-fa font-black text-slate-950 text-sm sm:text-base">
              {finalTotal.toLocaleString('fa-IR')} ریال
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderTerms = () => {
    if (!termsText) return null;

    return (
      <div className="border border-slate-300 rounded-lg p-2 text-[10.5px] leading-relaxed text-slate-700 bg-slate-50/40 break-inside-avoid">
        <span className="font-bold text-slate-900">شرایط و توضیحات: </span>
        <span>{termsText}</span>
      </div>
    );
  };

  const renderSignatures = () => {
    if (!hasAnySignature) return null;

    return (
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] break-inside-avoid pt-1">
        {show.signatures_seller && (
          <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/40 h-16 flex flex-col justify-between">
            <span className="font-bold text-slate-800">امضا و مهر فروشنده</span>
            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
          </div>
        )}

        {show.signatures_buyer && (
          <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/40 h-16 flex flex-col justify-between">
            <span className="font-bold text-slate-800">امضا و مهر خریدار</span>
            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
          </div>
        )}

        {show.signatures_receiver && (
          <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/40 h-16 flex flex-col justify-between">
            <span className="font-bold text-slate-800">امضای تحویل‌گیرنده کالا</span>
            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Page rendering helper with custom section ordering and pairing
  // ---------------------------------------------------------------------------

  const renderSectionByKey = (
    key: InvoiceSectionKey,
    pageIndex: number,
    itemsChunk: typeof rawItems,
    startIndex: number
  ) => {
    switch (key) {
      case 'header':
        return renderHeader(pageIndex);
      case 'seller':
        return pageIndex === 0 ? renderSellerCard() : null;
      case 'buyer':
        return pageIndex === 0 ? renderBuyerCard() : null;
      case 'items_table':
        return renderItemsTable(itemsChunk, startIndex);
      case 'payment_info':
        return pageIndex === totalPages - 1 ? renderPaymentInfo() : null;
      case 'totals_summary':
        return pageIndex === totalPages - 1 ? renderTotalsSummary() : null;
      case 'terms':
        return pageIndex === totalPages - 1 ? renderTerms() : null;
      case 'signatures':
        return pageIndex === totalPages - 1 ? renderSignatures() : null;
      default:
        return null;
    }
  };

  const renderPageSections = (
    pageIndex: number,
    itemsChunk: typeof rawItems,
    startIndex: number
  ) => {
    const orderList = layout.section_order || DEFAULT_INVOICE_LAYOUT_SETTINGS.section_order;
    const widths = layout.section_widths || DEFAULT_INVOICE_LAYOUT_SETTINGS.section_widths;
    const alignments = layout.section_alignments || DEFAULT_INVOICE_LAYOUT_SETTINGS.section_alignments;

    const renderedNodes: React.ReactNode[] = [];
    let i = 0;

    while (i < orderList.length) {
      const key1 = orderList[i];
      const width1 = widths[key1] || 'full';
      const align1 = alignments[key1] || 'right';

      // Check if we can pair two consecutive 'half' width sections together side-by-side
      const canPairWithNext =
        width1 === 'half' &&
        i + 1 < orderList.length &&
        (widths[orderList[i + 1]] || 'full') === 'half';

      if (canPairWithNext) {
        const key2 = orderList[i + 1];
        const align2 = alignments[key2] || 'right';

        const node1 = renderSectionByKey(key1, pageIndex, itemsChunk, startIndex);
        const node2 = renderSectionByKey(key2, pageIndex, itemsChunk, startIndex);

        if (node1 || node2) {
          renderedNodes.push(
            <div key={`pair-${key1}-${key2}-${pageIndex}`} className="grid grid-cols-2 gap-2 mb-2">
              <div
                className={`w-full ${
                  align1 === 'center' ? 'text-center' : align1 === 'left' ? 'text-left' : 'text-right'
                }`}
              >
                {node1}
              </div>
              <div
                className={`w-full ${
                  align2 === 'center' ? 'text-center' : align2 === 'left' ? 'text-left' : 'text-right'
                }`}
              >
                {node2}
              </div>
            </div>
          );
        }
        i += 2;
      } else {
        const node = renderSectionByKey(key1, pageIndex, itemsChunk, startIndex);
        if (node) {
          renderedNodes.push(
            <div
              key={`single-${key1}-${pageIndex}`}
              className={`mb-2 ${width1 === 'half' ? 'w-full sm:w-1/2' : 'w-full'} ${
                align1 === 'center' ? 'text-center' : align1 === 'left' ? 'text-left' : 'text-right'
              }`}
            >
              {node}
            </div>
          );
        }
        i += 1;
      }
    }

    return renderedNodes;
  };

  // ---------------------------------------------------------------------------
  // Main Render (One or Multiple Page Divs)
  // ---------------------------------------------------------------------------

  let cumulativeIndex = 0;

  return (
    <div
      className={`invoice-document-root flex flex-col gap-6 print:gap-0 ${className}`}
      style={{ direction: 'rtl' }}
    >
      {pageItemChunks.map((chunk, pageIndex) => {
        const startIndex = cumulativeIndex;
        cumulativeIndex += chunk.length;
        const isLastPage = pageIndex === totalPages - 1;

        return (
          <div
            key={`page-${pageIndex}`}
            className={`invoice-page-sheet bg-white text-slate-900 rounded-xl p-5 mx-auto shadow-xl border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:rounded-none flex flex-col justify-between relative ${
              isA5 ? 'max-w-2xl min-h-[600px] print:min-h-[210mm]' : 'max-w-3xl min-h-[850px] print:min-h-[297mm]'
            }`}
            style={{
              pageBreakAfter: !isLastPage ? 'always' : 'auto',
              breakAfter: !isLastPage ? 'page' : 'auto',
            }}
          >
            {/* Top / Main Content */}
            <div className="flex-1 flex flex-col">
              {renderPageSections(pageIndex, chunk, startIndex)}
            </div>

            {/* Bottom Page Footer Bar (Positioned at bottom of page) */}
            <div
              className={`pt-2 border-t border-slate-200 text-[10.5px] text-slate-500 flex items-center justify-between gap-2 mt-3 ${
                layout.stick_footer_to_bottom ? 'sticky bottom-0' : ''
              }`}
            >
              <div>
                {show.contact_footer && settings.website_or_contact && (
                  <span>سامانه / ارتباط: {settings.website_or_contact}</span>
                )}
              </div>

              {show.page_number && (
                <div className="num-fa font-bold text-slate-700">
                  صفحه {pageIndex + 1} از {totalPages}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
