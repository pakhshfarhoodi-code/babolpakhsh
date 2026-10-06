import React, { useLayoutEffect, useRef, useState, useMemo } from 'react';
import {
  Order,
  Supermarket,
  Visitor,
  InvoiceSettings,
  InvoiceSectionKey,
  TableColumnKey,
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_INVOICE_SETTINGS,
  DEFAULT_INVOICE_LAYOUT_SETTINGS,
  DEFAULT_INVOICE_STYLE_SETTINGS,
  DEFAULT_TABLE_COLUMNS,
} from '../../types';
import { numberToPersianWords } from '../../utils/numberToPersianWords';
import { formatOrderDate } from '../../utils/dateUtils';
import {
  getPackSize,
  isPackaged,
  getBaseUnit,
  getUnitColumnText,
  getUnitPriceFromOrderItem,
  computeLine,
} from '../../utils/orderLine';
import { Building2, Store } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface InvoiceDocumentProps {
  order: Order;
  settings?: InvoiceSettings;
  supermarket?: Supermarket | null;
  visitor?: Visitor | null;
  isPrintMode?: boolean;
  className?: string;
  interactiveColumns?: boolean;
  onColumnWidthsChange?: (newWidths: Record<TableColumnKey, number>) => void;
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
  order,
  settings: propSettings,
  supermarket,
  visitor,
  className = '',
  interactiveColumns = false,
  onColumnWidthsChange,
}) => {
  const { products = [] } = useApp();
  const settings = propSettings || DEFAULT_INVOICE_SETTINGS;
  const show = settings.show;
  const layout = settings.layout;
  const style = settings.style || DEFAULT_INVOICE_STYLE_SETTINGS;

  // ---------------------------------------------------------------------------
  // Style & Sizing Classes
  // ---------------------------------------------------------------------------
  const baseFontClass =
    style.base_font_size === 'small'
      ? 'text-[10px]'
      : style.base_font_size === 'large'
      ? 'text-[12.5px]'
      : 'text-[11px]';

  const sectionSpacingClass =
    style.section_spacing === 'compact'
      ? 'mb-1 gap-1.5'
      : style.section_spacing === 'spacious'
      ? 'mb-3.5 sm:mb-4 gap-3.5'
      : 'mb-2 gap-2';

  const sectionMarginBottom =
    style.section_spacing === 'compact'
      ? 'mb-1'
      : style.section_spacing === 'spacious'
      ? 'mb-3 sm:mb-3.5'
      : 'mb-2';

  const headerTitleClass = `${
    style.header_title_size === 'small'
      ? 'text-xs sm:text-sm'
      : style.header_title_size === 'large'
      ? 'text-base sm:text-xl'
      : 'text-sm sm:text-base'
  } ${style.header_title_bold !== false ? 'font-extrabold' : 'font-normal'}`;

  const brandTitleClass = `${
    style.brand_title_size === 'small'
      ? 'text-sm sm:text-base'
      : style.brand_title_size === 'large'
      ? 'text-lg sm:text-2xl'
      : 'text-base sm:text-lg'
  } ${style.brand_title_bold !== false ? 'font-black' : 'font-semibold'}`;

  const cardPaddingClass =
    style.card_padding === 'compact'
      ? 'p-1.5'
      : style.card_padding === 'spacious'
      ? 'p-3.5 sm:p-4'
      : 'p-2 sm:p-2.5';

  const cardLabelClass = `${
    style.card_labels_size === 'small'
      ? 'text-[9.5px]'
      : style.card_labels_size === 'large'
      ? 'text-[12px]'
      : 'text-[10.5px]'
  } ${style.card_labels_bold ? 'font-bold text-slate-700' : 'font-medium text-slate-500'}`;

  const cardValueClass = `${
    style.card_values_size === 'small'
      ? 'text-[10px]'
      : style.card_values_size === 'large'
      ? 'text-[12.5px]'
      : 'text-[11px]'
  } ${style.card_values_bold !== false ? 'font-bold text-slate-900' : 'font-normal text-slate-800'}`;

  const tableRowPaddingClass =
    style.table_density === 'compact'
      ? 'py-0.5 px-1.5'
      : style.table_density === 'spacious'
      ? 'py-2 px-2.5'
      : 'py-1 px-2';

  const tableFontClass =
    style.table_font_size === 'small'
      ? 'text-[10px]'
      : style.table_font_size === 'large'
      ? 'text-xs sm:text-sm'
      : 'text-[11px] sm:text-xs';

  const tableHeadWeightClass = style.table_header_bold !== false ? 'font-bold' : 'font-medium';

  const totalsFontClass = `${
    style.totals_font_size === 'small'
      ? 'text-[10.5px]'
      : style.totals_font_size === 'large'
      ? 'text-xs sm:text-sm'
      : 'text-[11px] sm:text-xs'
  } ${style.totals_bold !== false ? 'font-semibold' : 'font-normal'}`;

  const paymentFontClass = `${
    style.payment_font_size === 'small'
      ? 'text-[10px]'
      : style.payment_font_size === 'large'
      ? 'text-xs sm:text-sm'
      : 'text-[11px] sm:text-xs'
  } ${style.payment_bold ? 'font-semibold' : 'font-normal'}`;

  const termsFontClass = `${
    style.terms_font_size === 'small'
      ? 'text-[9.5px]'
      : style.terms_font_size === 'large'
      ? 'text-[12px]'
      : 'text-[10.5px]'
  } ${style.terms_bold ? 'font-bold' : 'font-normal'}`;

  const footerFontClass =
    style.footer_font_size === 'small'
      ? 'text-[9.5px]'
      : style.footer_font_size === 'large'
      ? 'text-[12px]'
      : 'text-[10.5px]';

  const signaturesHeightClass =
    style.signatures_height === 'small'
      ? 'h-12'
      : style.signatures_height === 'large'
      ? 'h-24'
      : 'h-16';

  const isRounded = style.rounded_corners !== false && style.box_rounded !== 'none';
  const roundedBoxClass = !isRounded
    ? 'rounded-none'
    : style.box_rounded === 'small'
    ? 'rounded'
    : style.box_rounded === 'large'
    ? 'rounded-2xl'
    : 'rounded-lg';

  const getBorderClass = (strength?: string) => {
    if (strength === 'none') return `border-0 ${roundedBoxClass}`;
    if (strength === 'light') return `border border-slate-200 ${roundedBoxClass}`;
    if (strength === 'bold') return `border-2 border-slate-800 ${roundedBoxClass}`;
    return `border border-slate-300 ${roundedBoxClass}`;
  };

  const cardBorderClass = getBorderClass(style.card_border || (style.border_thickness === 'thick' ? 'bold' : style.border_thickness === 'medium' ? 'normal' : 'light'));
  const tableBorderClass = getBorderClass(style.table_border || (style.border_thickness === 'thick' ? 'bold' : style.border_thickness === 'medium' ? 'normal' : 'light'));
  const footerDividerClass =
    style.footer_border === 'none'
      ? 'border-0'
      : style.footer_border === 'bold'
      ? 'border-t-2 border-slate-800'
      : style.footer_border === 'light'
      ? 'border-t border-slate-200'
      : 'border-t border-slate-300';

  const borderClass = cardBorderClass;

  // ---------------------------------------------------------------------------
  // Currency & Formatting
  // ---------------------------------------------------------------------------
  const currencyLabel = settings.currency_label || 'تومان';

  const formatMoney = (rawAmount: number): string => {
    return Math.round(rawAmount).toLocaleString('fa-IR');
  };

  // ---------------------------------------------------------------------------
  // Seller & Buyer Data Logic
  // ---------------------------------------------------------------------------
  const isDirectOrder = !order.assigned_visitor_id || order.assigned_visitor_id === 'direct';

  const saleTypeTitle = isDirectOrder
    ? (settings.direct_sale_title || 'فروش مستقیم')
    : (settings.visitor_sale_title || 'فروش از طریق ویزیتور');

  const visitorName = !isDirectOrder ? (order.visitor_name || visitor?.name || '') : '';
  const visitorPhone = !isDirectOrder && visitor?.phone ? visitor.phone : '';
  const hasVisitorInfo = Boolean(show.seller_visitor && visitorName);

  const activeCentralPhones = show.seller_phones
    ? (settings.phones || []).filter(
        (p) => p.show_in_invoice !== false && p.number && p.number.trim().length > 0
      )
    : [];

  const buyerStoreName = (show.buyer_store_name && (order.supermarket_name || supermarket?.name)) || '';
  const buyerOwner = (show.buyer_owner && supermarket?.owner) || '';
  const buyerPhone = (show.buyer_phone && supermarket?.phone) || '';
  const buyerAddress = (show.buyer_address && supermarket?.address) || '';
  const hasAnyBuyerInfo = Boolean(buyerStoreName || buyerOwner || buyerPhone || buyerAddress);

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

  const rawDate = formatOrderDate(order.order_date);
  const formattedDate = show.order_date ? rawDate : '';

  // ---------------------------------------------------------------------------
  // Financial & Discount Calculations
  // ---------------------------------------------------------------------------
  const rawItems = order.items || [];

  const pickupDiscountPercent = order.pickup_discount_percent || 0;
  const founderDiscountPercent = order.founder_discount_percent || 0;
  const manualDiscountPercent = order.discount_status === 'approved' ? (order.discount_percent || 0) : 0;
  const totalDiscountPercent = Math.min(100, Math.max(0, pickupDiscountPercent + founderDiscountPercent + manualDiscountPercent));

  // originalSubtotal is the sum of raw item totals before discount
  const originalSubtotal = rawItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id);
    const rawItemsPerPkg =
      item.items_per_package ||
      (item as any).product?.items_per_package ||
      (product as any)?.items_per_package ||
      '';
    const pack = getPackSize(rawItemsPerPkg);
    const unitPrice = getUnitPriceFromOrderItem({ price: item.price, items_per_package: pack });
    const { total } = computeLine({
      quantity: Number(item.quantity) || 0,
      pack,
      unitPrice,
      discountPercent: 0,
    });
    return sum + total;
  }, 0);

  const subtotal = originalSubtotal > 0 ? originalSubtotal : (order.total_amount || 0);

  // Calculate discounted row totals and sum them up with computeLine
  const discountedSubtotal = rawItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id);
    const rawItemsPerPkg =
      item.items_per_package ||
      (item as any).product?.items_per_package ||
      (product as any)?.items_per_package ||
      '';
    const pack = getPackSize(rawItemsPerPkg);
    const unitPrice = getUnitPriceFromOrderItem({ price: item.price, items_per_package: pack });
    const { total } = computeLine({
      quantity: Number(item.quantity) || 0,
      pack,
      unitPrice,
      discountPercent: totalDiscountPercent,
    });
    return sum + total;
  }, 0);

  // Discount Amounts for Summary
  const pickupDiscountAmount = Math.round(subtotal * (pickupDiscountPercent / 100));
  const founderDiscountAmount = Math.round(subtotal * (founderDiscountPercent / 100));
  const manualDiscountAmount = Math.round(subtotal * (manualDiscountPercent / 100));

  const hasOverallDiscount = totalDiscountPercent > 0;

  // VAT
  const hasVat = Boolean(settings.has_vat);
  const vatPercent = Number(settings.vat_percent) || 0;
  const vatAmount = hasVat ? Math.round(discountedSubtotal * (vatPercent / 100)) : 0;

  const finalTotal = discountedSubtotal + vatAmount;

  const finalDisplayAmount = finalTotal;
  const priceInWords = show.amount_in_words
    ? `${numberToPersianWords(finalDisplayAmount)} ${currencyLabel} تمام`
    : '';

  const totalItemsCount = rawItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

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

  const hasAnySummaryInfo = Boolean(
    show.summary_items_count ||
    show.summary_subtotal ||
    hasOverallDiscount ||
    (show.summary_vat && hasVat) ||
    show.summary_final_total
  );

  const termsText = (show.terms_and_conditions && settings.footer_notes) || '';
  const hasAnySignature = Boolean(
    show.signatures_seller ||
    show.signatures_buyer ||
    show.signatures_receiver
  );

  const isA5 = settings.paper_size === 'A5';

  // ---------------------------------------------------------------------------
  // Section Renderers
  // ---------------------------------------------------------------------------

  const renderHeader = (pageIndex: number, totalPagesCount: number = 1) => {
    if (pageIndex > 0) {
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
              ادامه صفحه {(pageIndex + 1).toLocaleString('fa-IR')} از {totalPagesCount.toLocaleString('fa-IR')}
            </div>
          </div>
        </div>
      );
    }

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
                <h1 className={`${brandTitleClass} text-slate-900 tracking-tight leading-snug`}>
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
              className={`bg-slate-50 ${borderClass} p-2 text-[11px] leading-snug min-w-[210px] shrink-0 ${
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
            <h2 className={`${headerTitleClass} text-slate-900 tracking-wide`}>
              {settings.invoice_title}
            </h2>
          </div>
        )}
      </div>
    );
  };
  // ---------------------------------------------------------------------------
  // Active Columns & Layout Calculations
  // ---------------------------------------------------------------------------
  const activeColumns = useMemo(() => {
    const rawWidths = layout.column_widths || DEFAULT_COLUMN_WIDTHS;
    const tableCols = settings.table_columns || DEFAULT_TABLE_COLUMNS;

    const alignClassMap: Record<TableColumnKey, string> = {
      row_index: 'text-center',
      product_name: 'text-right',
      items_per_package: 'text-center',
      quantity_unit: 'text-center',
      unit_price: 'text-center',
      discount_percent: 'text-center',
      total_price: 'text-center',
    };

    const defaultLabelMap: Record<TableColumnKey, string> = {
      row_index: '#',
      product_name: 'شرح کالا / خدمات',
      quantity_unit: 'تعداد',
      items_per_package: 'واحد (تعداد در کارتن)',
      unit_price: totalDiscountPercent > 0 ? `قیمت اصلی (${currencyLabel})` : `قیمت واحد (${currencyLabel})`,
      discount_percent: totalDiscountPercent > 0 ? `قیمت با تخفیف (${currencyLabel})` : 'تخفیف (٪)',
      total_price: `مبلغ کل (${currencyLabel})`,
    };

    const cols: {
      key: TableColumnKey;
      label: string;
      alignClass: string;
      rawWidth: number;
    }[] = [];

    tableCols.forEach((colConfig) => {
      // Force discount_percent to be visible if totalDiscountPercent > 0
      const isVisible = colConfig.key === 'discount_percent' && totalDiscountPercent > 0
        ? true
        : colConfig.visible;

      if (!isVisible) return;

      let displayLabel = colConfig.label?.trim();
      
      // Override label with dynamic label map if it is empty, or matching previous default labels
      if (!displayLabel || 
          displayLabel === 'فی' || 
          displayLabel === 'تعداد / واحد' || 
          displayLabel === 'تعداد در کارتن' || 
          displayLabel === 'تخفیف' || 
          displayLabel === 'تخفیف (٪)' || 
          displayLabel === `فی (${currencyLabel})` || 
          displayLabel === `قیمت اصلی (${currencyLabel})` || 
          displayLabel === `قیمت با تخفیف (${currencyLabel})`
      ) {
        displayLabel = defaultLabelMap[colConfig.key];
      }

      if (colConfig.key === 'total_price' && (displayLabel === 'مبلغ کل' || displayLabel === `مبلغ کل (${currencyLabel})`)) {
        displayLabel = `مبلغ کل (${currencyLabel})`;
      }

      cols.push({
        key: colConfig.key,
        label: displayLabel,
        alignClass: alignClassMap[colConfig.key] || 'text-center',
        rawWidth: rawWidths[colConfig.key] ?? DEFAULT_COLUMN_WIDTHS[colConfig.key],
      });
    });

    const totalRaw = cols.reduce((sum, c) => sum + (c.rawWidth || 10), 0) || 100;
    return cols.map((c) => ({
      ...c,
      normalizedPercent: Number(((c.rawWidth / totalRaw) * 100).toFixed(2)),
    }));
  }, [settings.table_columns, layout.column_widths, currencyLabel, totalDiscountPercent]);

  // Pointer drag resizing state
  const tableRef = useRef<HTMLTableElement>(null);
  const resizeStateRef = useRef<{
    colIdx: number;
    startX: number;
    startWidthA: number;
    startWidthB: number;
    tableWidth: number;
    rafId: number | null;
  } | null>(null);

  const handleStartResize = (e: React.PointerEvent, colIdx: number) => {
    if (colIdx >= activeColumns.length - 1) return;
    const tableEl = tableRef.current;
    if (!tableEl) return;

    const tableWidth = tableEl.offsetWidth || 700;
    const colA = activeColumns[colIdx];
    const colB = activeColumns[colIdx + 1];

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    resizeStateRef.current = {
      colIdx,
      startX: e.clientX,
      startWidthA: colA.normalizedPercent,
      startWidthB: colB.normalizedPercent,
      tableWidth,
      rafId: null,
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;

      if (state.rafId !== null) cancelAnimationFrame(state.rafId);

      state.rafId = requestAnimationFrame(() => {
        // In RTL: moving pointer to the left (moveEvent.clientX < state.startX) expands column A and shrinks column B
        const deltaPx = state.startX - moveEvent.clientX;
        const deltaPercent = (deltaPx / state.tableWidth) * 100;

        const minPercent = 8;
        const totalPair = state.startWidthA + state.startWidthB;
        let newWidthA = Math.max(minPercent, Math.min(totalPair - minPercent, state.startWidthA + deltaPercent));
        let newWidthB = totalPair - newWidthA;

        const currentMap = { ...(layout.column_widths || DEFAULT_COLUMN_WIDTHS) };
        currentMap[activeColumns[state.colIdx].key] = Math.round(newWidthA);
        currentMap[activeColumns[state.colIdx + 1].key] = Math.round(newWidthB);

        if (onColumnWidthsChange) {
          onColumnWidthsChange(currentMap);
        }
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (resizeStateRef.current?.rafId) cancelAnimationFrame(resizeStateRef.current.rafId);
      resizeStateRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const renderSellerCard = () => {
    if (!hasAnySellerInfo) return null;
    const cols = layout.seller_card_columns === 1 ? 'grid-cols-1' : 'grid-cols-2';

    return (
      <div
        className={`${cardBorderClass} ${cardPaddingClass} bg-slate-50/50 flex flex-col justify-between leading-snug`}
      >
        <div>
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span>مشخصات فروشنده</span>
          </div>

          <div className={`grid ${cols} gap-x-2 gap-y-1`}>
            {(sellerLegalName || sellerName) && (
              <div className="truncate">
                <span className={cardLabelClass}>نام: </span>
                <strong className={cardValueClass}>{sellerLegalName || sellerName}</strong>
              </div>
            )}

            {activeCentralPhones.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <span className={`${cardLabelClass} shrink-0`}>
                  {p.label ? `${p.label}:` : 'تلفن:'}
                </span>
                <strong className={`num-fa dir-ltr inline-block ${cardValueClass}`}>{p.number}</strong>
              </div>
            ))}

            {hasVisitorInfo && (
              <div className="col-span-full truncate bg-blue-50/60 rounded px-1.5 py-0.5 border border-blue-100 text-blue-900 font-medium">
                <span className={cardLabelClass}>ویزیتور: </span>
                <strong className={`font-bold text-blue-950 ${cardValueClass}`}>
                  {visitorName}
                  {visitorPhone ? ` — ${visitorPhone}` : ''}
                </strong>
              </div>
            )}

            {sellerNationalId && (
              <div>
                <span className={cardLabelClass}>شناسه ملی: </span>
                <span className={`num-fa dir-ltr inline-block ${cardValueClass}`}>
                  {sellerNationalId}
                </span>
              </div>
            )}

            {sellerEconomicCode && (
              <div>
                <span className={cardLabelClass}>کد اقتصادی: </span>
                <span className={`num-fa dir-ltr inline-block ${cardValueClass}`}>
                  {sellerEconomicCode}
                </span>
              </div>
            )}

            {sellerRegistrationNumber && (
              <div>
                <span className={cardLabelClass}>شماره ثبت: </span>
                <span className={`num-fa dir-ltr inline-block ${cardValueClass}`}>
                  {sellerRegistrationNumber}
                </span>
              </div>
            )}

            {sellerPostalCode && (
              <div>
                <span className={cardLabelClass}>کد پستی: </span>
                <span className={`num-fa dir-ltr inline-block ${cardValueClass}`}>{sellerPostalCode}</span>
              </div>
            )}
          </div>
        </div>

        {sellerAddress && (
          <div className="mt-1.5 pt-1 border-t border-slate-200 text-slate-700">
            <span className={cardLabelClass}>آدرس: </span>
            <span className={cardValueClass}>{sellerAddress}</span>
          </div>
        )}
      </div>
    );
  };

  const renderBuyerCard = () => {
    if (!hasAnyBuyerInfo) return null;
    const cols = layout.buyer_card_columns === 1 ? 'grid-cols-1' : 'grid-cols-2';

    return (
      <div
        className={`${cardBorderClass} ${cardPaddingClass} bg-slate-50/50 flex flex-col justify-between leading-snug`}
      >
        <div>
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span>مشخصات خریدار</span>
          </div>

          <div className={`grid ${cols} gap-x-2 gap-y-1`}>
            {buyerStoreName && (
              <div className="truncate">
                <span className={cardLabelClass}>فروشگاه: </span>
                <strong className={cardValueClass}>{buyerStoreName}</strong>
              </div>
            )}

            {buyerOwner && (
              <div className="truncate">
                <span className={cardLabelClass}>متصدی: </span>
                <strong className={cardValueClass}>{buyerOwner}</strong>
              </div>
            )}

            {buyerPhone && (
              <div className="flex items-center gap-1.5">
                <span className={`${cardLabelClass} shrink-0`}>تلفن: </span>
                <strong className={`num-fa dir-ltr inline-block ${cardValueClass}`}>{buyerPhone}</strong>
              </div>
            )}
          </div>
        </div>

        {buyerAddress && (
          <div className="mt-1.5 pt-1 border-t border-slate-200 text-slate-700">
            <span className={cardLabelClass}>آدرس: </span>
            <span className={cardValueClass}>{buyerAddress}</span>
          </div>
        )}
      </div>
    );
  };

  const renderItemsTableHead = () => {
    return (
      <thead>
        <tr className="bg-slate-100/90 text-slate-800 border-b border-slate-300">
          {activeColumns.map((col, idx) => (
            <th
              key={col.key}
              style={{ width: `${col.normalizedPercent}%` }}
              className={`relative ${tableRowPaddingClass} ${tableHeadWeightClass} ${col.alignClass} border-l last:border-l-0 border-slate-300 select-none overflow-hidden`}
            >
              <span>{col.label}</span>
              {interactiveColumns && idx < activeColumns.length - 1 && (
                <div
                  onPointerDown={(e) => handleStartResize(e, idx)}
                  className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-20 flex items-center justify-center group touch-none"
                  title="برای تغییر عرض ستون بکشید"
                >
                  <div className="w-1 h-3.5 bg-blue-500 rounded group-hover:w-1.5 group-hover:bg-blue-600 transition-all opacity-70 group-hover:opacity-100" />
                </div>
              )}
            </th>
          ))}
        </tr>
      </thead>
    );
  };

  const renderItemRow = (item: typeof rawItems[0], globalIndex: number) => {
    // Lookup missing items_per_package and unit from AppContext products
    const product = products.find((p) => p.id === item.product_id);
    const rawItemsPerPkg =
      item.items_per_package ||
      (item as any).product?.items_per_package ||
      (product as any)?.items_per_package ||
      '';

    const pack = getPackSize(rawItemsPerPkg);
    const packaged = isPackaged(pack);
    const rawUnit = (item as any).unit || product?.unit || settings.default_unit_name || 'عدد';
    const baseUnit = getBaseUnit(rawUnit, pack);

    const qty = Number(item.quantity) || 0;
    const unitPrice = getUnitPriceFromOrderItem({ price: item.price, items_per_package: pack });
    const { discountedUnitPrice, total: lineTotal } = computeLine({
      quantity: qty,
      pack,
      unitPrice,
      discountPercent: totalDiscountPercent,
    });

    const isLastCol = (idx: number) => idx === activeColumns.length - 1;

    return (
      <tr key={item.product_id || globalIndex} className="hover:bg-slate-50/50 break-inside-avoid">
        {activeColumns.map((col, colIdx) => {
          const borderClass = isLastCol(colIdx) ? '' : 'border-l border-slate-200';

          switch (col.key) {
            case 'row_index':
              return (
                <td
                  key={col.key}
                  className={`${tableRowPaddingClass} text-center num-fa text-slate-600 font-medium ${borderClass}`}
                >
                  {globalIndex}
                </td>
              );

            case 'product_name':
              return (
                <td
                  key={col.key}
                  className={`${tableRowPaddingClass} font-bold text-slate-900 ${borderClass} break-words text-right`}
                >
                  {(item as any).product_name || item.name}
                </td>
              );

            case 'quantity_unit':
              return (
                <td
                  key={col.key}
                  className={`${tableRowPaddingClass} text-center ${borderClass}`}
                >
                  <span className="num-fa font-bold text-slate-800">
                    {qty.toLocaleString('fa-IR')}
                  </span>
                  {packaged && (
                    <span className="text-[10px] text-slate-500 mr-1 font-normal">کارتن</span>
                  )}
                </td>
              );

            case 'items_per_package':
              return (
                <td
                  key={col.key}
                  className={`${tableRowPaddingClass} text-center num-fa text-slate-700 ${borderClass} font-medium`}
                >
                  {getUnitColumnText(pack, baseUnit)}
                </td>
              );

            case 'unit_price':
              return (
                <td
                  key={col.key}
                  className={`${tableRowPaddingClass} text-center num-fa font-bold text-slate-700 ${borderClass}`}
                >
                  {formatMoney(unitPrice)}
                </td>
              );

            case 'discount_percent':
              return (
                <td
                  key={col.key}
                  className={`${tableRowPaddingClass} text-center num-fa font-bold text-slate-700 ${borderClass}`}
                >
                  {totalDiscountPercent > 0
                    ? formatMoney(discountedUnitPrice)
                    : '۰٪'}
                </td>
              );

            case 'total_price':
              return (
                <td
                  key={col.key}
                  className={`${tableRowPaddingClass} text-center num-fa font-black text-slate-900 ${borderClass}`}
                >
                  {formatMoney(lineTotal)}
                </td>
              );

            default:
              return null;
          }
        })}
      </tr>
    );
  };

  const renderItemsTable = (itemsChunk: typeof rawItems, startIndex: number) => {
    return (
      <div className={`${sectionMarginBottom} overflow-hidden ${tableBorderClass}`}>
        <table ref={tableRef} className={`w-full text-right border-collapse table-fixed ${tableFontClass} items-table`}>
          <colgroup>
            {activeColumns.map((col) => (
              <col key={col.key} style={{ width: `${col.normalizedPercent}%` }} />
            ))}
          </colgroup>
          {renderItemsTableHead()}
          <tbody className="divide-y divide-slate-200">
            {itemsChunk.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length || 7} className="py-6 text-center text-slate-400 text-xs">
                  هیچ قلم کالایی در این سفارش ثبت نشده است.
                </td>
              </tr>
            ) : (
              itemsChunk.map((item, idx) => renderItemRow(item, startIndex + idx + 1))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPaymentInfo = () => {
    if (!hasAnyPaymentInfo) return null;

    return (
      <div
        className={`${cardBorderClass} ${cardPaddingClass} bg-slate-50/50 flex flex-col justify-between ${paymentFontClass} leading-snug break-inside-avoid`}
      >
        <div>
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
            مشخصات پرداخت و تسویه
          </div>

          {show.amount_in_words && priceInWords && (
            <div className="mb-2 p-1.5 bg-white rounded border border-slate-200 text-slate-800">
              <span className={cardLabelClass}>مبلغ به حروف: </span>
              <strong className={cardValueClass}>{priceInWords}</strong>
            </div>
          )}

          <div className="space-y-1 text-slate-700">
            {paymentHolder && (
              <div className="flex items-center justify-between gap-2">
                <span className={cardLabelClass}>صاحب حساب:</span>
                <span className={cardValueClass}>{paymentHolder}</span>
              </div>
            )}

            {paymentCard && (
              <div className="flex items-center justify-between gap-2">
                <span className={cardLabelClass}>شماره کارت:</span>
                <span className={`num-fa dir-ltr inline-block ${cardValueClass}`}>
                  {paymentCard}
                </span>
              </div>
            )}

            {paymentIban && (
              <div className="flex items-center justify-between gap-2">
                <span className={cardLabelClass}>شماره شبا:</span>
                <span className={`num-fa dir-ltr inline-block ${cardValueClass}`}>
                  {paymentIban}
                </span>
              </div>
            )}
          </div>
        </div>

        {paymentTermsText && (
          <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10.5px] text-slate-600">
            <span className={cardLabelClass}>شرایط تسویه: </span>
            <span className={cardValueClass}>{paymentTermsText}</span>
          </div>
        )}
      </div>
    );
  };

  const renderTotalsSummary = () => {
    if (!hasAnySummaryInfo) return null;

    return (
      <div
        className={`${cardBorderClass} ${cardPaddingClass} bg-slate-50/50 flex flex-col justify-between ${totalsFontClass} break-inside-avoid`}
      >
        <div className="space-y-1.5">
          {show.summary_items_count && (
            <div className="flex items-center justify-between text-slate-600">
              <span className={cardLabelClass}>تعداد کل اقلام سفارش:</span>
              <span className={`num-fa ${cardValueClass}`}>{totalItemsCount.toLocaleString('fa-IR')}</span>
            </div>
          )}

          {show.summary_subtotal && (
            <div className="flex items-center justify-between text-slate-700">
              <span className={cardLabelClass}>جمع کل اقلام (قبل از تخفیف):</span>
              <span className={`num-fa ${cardValueClass}`}>
                {formatMoney(subtotal)} {currencyLabel}
              </span>
            </div>
          )}

          {pickupDiscountPercent > 0 && pickupDiscountAmount > 0 && (
            <div className="flex items-center justify-between text-blue-700 font-medium">
              <span className={cardLabelClass}>تخفیف تحویل درب انبار ({pickupDiscountPercent}٪):</span>
              <span className={`num-fa font-bold text-blue-700 ${cardValueClass}`}>
                -{formatMoney(pickupDiscountAmount)} {currencyLabel}
              </span>
            </div>
          )}

          {founderDiscountPercent > 0 && founderDiscountAmount > 0 && (
            <div className="flex items-center justify-between text-purple-700 font-medium">
              <span className={cardLabelClass}>تخفیف ۱۰۰ نفر اول ({founderDiscountPercent}٪):</span>
              <span className={`num-fa font-bold text-purple-700 ${cardValueClass}`}>
                -{formatMoney(founderDiscountAmount)} {currencyLabel}
              </span>
            </div>
          )}

          {manualDiscountPercent > 0 && manualDiscountAmount > 0 && (
            <div className="flex items-center justify-between text-amber-700 font-medium">
              <span className={cardLabelClass}>تخفیف دستی ({manualDiscountPercent}٪):</span>
              <span className={`num-fa font-bold text-amber-700 ${cardValueClass}`}>
                -{formatMoney(manualDiscountAmount)} {currencyLabel}
              </span>
            </div>
          )}

          {show.summary_vat && hasVat && vatAmount > 0 && (
            <div className="flex items-center justify-between text-slate-700">
              <span className={cardLabelClass}>مالیات و ارزش افزوده ({vatPercent}٪):</span>
              <span className={`num-fa ${cardValueClass}`}>
                {formatMoney(vatAmount)} {currencyLabel}
              </span>
            </div>
          )}
        </div>

        {show.summary_final_total && (
          <div className="mt-2 pt-2 border-t-2 border-slate-800 flex items-center justify-between bg-slate-100/80 -mx-2.5 -mb-2.5 p-2.5 rounded-b-lg">
            <span className="font-black text-slate-950 text-xs sm:text-sm">مبلغ قابل پرداخت:</span>
            <span className="num-fa font-black text-slate-950 text-sm sm:text-base">
              {formatMoney(finalTotal)} {currencyLabel}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderTerms = () => {
    if (!termsText) return null;

    return (
      <div className={`${cardBorderClass} p-2 ${termsFontClass} leading-relaxed text-slate-700 bg-slate-50/40 break-inside-avoid`}>
        <span className="font-bold text-slate-900">شرایط و توضیحات: </span>
        <span>{termsText}</span>
      </div>
    );
  };

  const renderSignatures = () => {
    const activeBoxesCount = [
      show.signatures_seller,
      show.signatures_buyer,
      show.signatures_receiver,
    ].filter(Boolean).length;

    if (!hasAnySignature || activeBoxesCount === 0) return null;

    const gridColsClass =
      activeBoxesCount === 1
        ? 'grid-cols-1 max-w-sm mx-auto'
        : activeBoxesCount === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';

    return (
      <div className={`grid ${gridColsClass} gap-2 text-center text-[11px] break-inside-avoid pt-1`}>
        {show.signatures_seller && (
          <div className={`${cardBorderClass} p-2 bg-slate-50/40 ${signaturesHeightClass} flex flex-col justify-between`}>
            <span className="font-bold text-slate-800">امضا و مهر فروشنده</span>
            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
          </div>
        )}

        {show.signatures_buyer && (
          <div className={`${cardBorderClass} p-2 bg-slate-50/40 ${signaturesHeightClass} flex flex-col justify-between`}>
            <span className="font-bold text-slate-800">امضا و مهر خریدار</span>
            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
          </div>
        )}

        {show.signatures_receiver && (
          <div className={`${cardBorderClass} p-2 bg-slate-50/40 ${signaturesHeightClass} flex flex-col justify-between`}>
            <span className="font-bold text-slate-800">امضای تحویل‌گیرنده کالا</span>
            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Dynamic Height Measurement & Pagination Engine (useLayoutEffect)
  // ---------------------------------------------------------------------------
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const [measuredChunks, setMeasuredChunks] = useState<typeof rawItems[] | null>(null);

  useLayoutEffect(() => {
    if (!measureContainerRef.current) return;

    const root = measureContainerRef.current;
    const headerEl = root.querySelector('[data-measure="header"]') as HTMLElement | null;
    const subHeaderEl = root.querySelector('[data-measure="sub_header"]') as HTMLElement | null;
    const sellerEl = root.querySelector('[data-measure="seller"]') as HTMLElement | null;
    const buyerEl = root.querySelector('[data-measure="buyer"]') as HTMLElement | null;
    const theadEl = root.querySelector('[data-measure="thead"]') as HTMLElement | null;
    const summaryBlockEl = root.querySelector('[data-measure="summary_block"]') as HTMLElement | null;

    const headerH = headerEl?.offsetHeight || 135;
    const subHeaderH = subHeaderEl?.offsetHeight || 42;
    const sellerH = sellerEl?.offsetHeight || 0;
    const buyerH = buyerEl?.offsetHeight || 0;
    const theadH = theadEl?.offsetHeight || 38;
    const summaryBlockH = summaryBlockEl?.offsetHeight || 220;

    // Measure each row height individually
    const rowEls = root.querySelectorAll('[data-measure-row]');
    const rowHeights: number[] = [];
    rowEls.forEach((el) => {
      rowHeights.push((el as HTMLElement).offsetHeight || 34);
    });

    // Usable height of paper (A4: 297mm ≈ 1122.5px; A5: 210mm ≈ 793.7px)
    // Subtract top padding (10mm ~38px), bottom padding (14mm ~53px), footer space (32px), safety margin (20px)
    const totalPageHeight = isA5 ? 794 : 1122;
    const pagePaddingV = isA5 ? 90 : 110;
    const usablePageH = totalPageHeight - pagePaddingV;

    // Parties cards combined height
    let partiesH = 0;
    if (sellerH > 0 && buyerH > 0) {
      // If paired side-by-side in grid
      partiesH = Math.max(sellerH, buyerH) + 8;
    } else {
      partiesH = (sellerH || buyerH) + (sellerH || buyerH ? 8 : 0);
    }

    const page1TopH = headerH + partiesH + theadH;
    const page1AvailH = usablePageH - page1TopH;
    const subPageTopH = subHeaderH + theadH;
    const subPageAvailH = usablePageH - subPageTopH;

    const totalCount = rawItems.length;
    if (totalCount === 0) {
      setMeasuredChunks([[]]);
      return;
    }

    // Check single page possibility:
    const totalItemsHeight = rowHeights.reduce((a, b) => a + b, 0);
    if (totalItemsHeight + summaryBlockH <= page1AvailH) {
      setMeasuredChunks([rawItems]);
      return;
    }

    // Multi-page distribution
    const chunks: typeof rawItems[] = [];
    let currentIndex = 0;

    // Page 1: fill up to page1AvailH
    let p1Height = 0;
    let p1End = 0;
    while (p1End < totalCount && p1Height + rowHeights[p1End] <= page1AvailH) {
      p1Height += rowHeights[p1End];
      p1End++;
    }
    // Prevent empty page 1 if an unusual huge row occurs
    if (p1End === 0 && totalCount > 0) p1End = 1;

    chunks.push(rawItems.slice(0, p1End));
    currentIndex = p1End;

    // Intermediate and Last pages
    while (currentIndex < totalCount) {
      const remainingCount = totalCount - currentIndex;
      let remainingH = 0;
      for (let i = currentIndex; i < totalCount; i++) {
        remainingH += rowHeights[i];
      }

      // Can all remaining items + summary fit on this page?
      if (remainingH + summaryBlockH <= subPageAvailH) {
        chunks.push(rawItems.slice(currentIndex));
        currentIndex = totalCount;
        break;
      }

      // Fill current page with items up to subPageAvailH
      let pageH = 0;
      let countOnThisPage = 0;
      while (
        currentIndex + countOnThisPage < totalCount &&
        pageH + rowHeights[currentIndex + countOnThisPage] <= subPageAvailH
      ) {
        pageH += rowHeights[currentIndex + countOnThisPage];
        countOnThisPage++;
      }

      if (countOnThisPage === 0) countOnThisPage = 1;

      // Check if after adding this chunk, remaining items on next page would be 0 (summary alone)
      if (currentIndex + countOnThisPage === totalCount) {
        // Summary won't fit on this page, and next page would have 0 items!
        // Move last 2 items (or at least 1) to next page so summary block is NEVER alone
        const itemsToMove = Math.min(Math.max(1, Math.floor(countOnThisPage / 2)), 2);
        countOnThisPage = Math.max(1, countOnThisPage - itemsToMove);
      }

      chunks.push(rawItems.slice(currentIndex, currentIndex + countOnThisPage));
      currentIndex += countOnThisPage;
    }

    setMeasuredChunks(chunks);
  }, [
    rawItems,
    settings,
    show,
    layout,
    style,
    isA5,
    hasAnySellerInfo,
    hasAnyBuyerInfo,
    hasAnySummaryInfo,
    hasAnyPaymentInfo,
    hasAnySignature,
    termsText,
    products,
  ]);

  // Initial fallback partitioning before layout measurement completes
  const fallbackChunks = useMemo(() => {
    if (rawItems.length <= 6) return [rawItems];
    const res: typeof rawItems[] = [];
    res.push(rawItems.slice(0, 8));
    let idx = 8;
    while (idx < rawItems.length) {
      const rem = rawItems.length - idx;
      if (rem <= 8) {
        res.push(rawItems.slice(idx));
        break;
      }
      res.push(rawItems.slice(idx, idx + 12));
      idx += 12;
    }
    return res;
  }, [rawItems]);

  const pageItemChunks = measuredChunks || fallbackChunks;
  const totalPages = pageItemChunks.length;

  const renderSectionByKey = (
    key: InvoiceSectionKey,
    pageIndex: number,
    itemsChunk: typeof rawItems,
    startIndex: number
  ) => {
    switch (key) {
      case 'header':
        return renderHeader(pageIndex, totalPages);
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

  let cumulativeIndex = 0;

  return (
    <>
      {/* Invisible Measurement Container for useLayoutEffect */}
      <div
        ref={measureContainerRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-99999px',
          left: '-99999px',
          width: isA5 ? '148mm' : '210mm',
          visibility: 'hidden',
          pointerEvents: 'none',
          boxSizing: 'border-box',
          padding: '10mm 12mm',
        }}
        className={baseFontClass}
      >
        <div data-measure="header">{renderHeader(0, 1)}</div>
        <div data-measure="sub_header">{renderHeader(1, 2)}</div>
        {hasAnySellerInfo && <div data-measure="seller">{renderSellerCard()}</div>}
        {hasAnyBuyerInfo && <div data-measure="buyer">{renderBuyerCard()}</div>}
        <div data-measure="thead">
          <table className="w-full text-right border-collapse items-table">
            {renderItemsTableHead()}
          </table>
        </div>
        <table className="w-full text-right border-collapse items-table">
          <tbody>
            {rawItems.map((item, idx) => (
              <React.Fragment key={idx}>
                {React.cloneElement(renderItemRow(item, idx + 1), {
                  'data-measure-row': idx,
                } as any)}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <div data-measure="summary_block" className="space-y-2">
          {renderPaymentInfo()}
          {renderTotalsSummary()}
          {renderTerms()}
          {renderSignatures()}
        </div>
      </div>

      {/* Main Visible Multi-Page Document */}
      <div
        className={`invoice-document-root flex flex-col items-center gap-6 print:gap-0 ${baseFontClass} ${className}`}
        style={{ direction: 'rtl', width: '100%' }}
      >
        {pageItemChunks.map((chunk, pageIndex) => {
          const startIndex = cumulativeIndex;
          cumulativeIndex += chunk.length;
          const isLastPage = pageIndex === totalPages - 1;

          return (
            <div
              key={`page-${pageIndex}`}
              className={`invoice-page-sheet bg-white text-slate-900 rounded-xl shadow-xl ${borderClass} print:border-none print:shadow-none print:m-0 print:rounded-none flex flex-col justify-between relative overflow-hidden`}
              style={{
                width: isA5 ? '148mm' : '210mm',
                minWidth: isA5 ? '148mm' : '210mm',
                maxWidth: isA5 ? '148mm' : '210mm',
                minHeight: isA5 ? '210mm' : '297mm',
                height: isA5 ? '210mm' : '297mm',
                maxHeight: isA5 ? '210mm' : '297mm',
                boxSizing: 'border-box',
                padding: '10mm 12mm 14mm 12mm',
                margin: '0 auto',
                pageBreakAfter: !isLastPage ? 'always' : 'auto',
                breakAfter: !isLastPage ? 'page' : 'auto',
              }}
            >
              {/* Top / Main Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {renderPageSections(pageIndex, chunk, startIndex)}
              </div>

              {/* Fixed Bottom Page Footer Bar (Positioned at bottom of page) */}
              <div
                className={`absolute bottom-[8mm] left-[12mm] right-[12mm] pt-2 ${footerDividerClass} ${footerFontClass} text-slate-500 flex items-center justify-between gap-2`}
              >
                <div>
                  {show.contact_footer && settings.website_or_contact && (
                    <span>سامانه / ارتباط: {settings.website_or_contact}</span>
                  )}
                </div>

                {show.page_number && (
                  <div className="num-fa font-bold text-slate-700">
                    صفحه {(pageIndex + 1).toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
