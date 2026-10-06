export type UserRole = 'admin' | 'warehouse' | 'visitor' | 'supermarket';

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  phone: string;
  username?: string;
}

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  username: string;
  is_active?: boolean;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at?: string;
}

export interface Product {
  id: string;
  category_id: string;
  brand?: string;
  name: string;
  price: number; // Store purchase price (قیمت خرید سوپرمارکت‌ها)
  visitor_price?: number; // Visitor purchase price from company (قیمت خرید ویزیتور)
  consumer_price?: number; // Optional Consumer Price (قیمت مصرف‌کننده)
  stock: number;
  reserved_stock: number;
  unit: string;
  items_per_package?: number; // فیلد اختیاری تعداد (تعداد در کارتن/بسته)
  image_url: string;
  is_active: boolean;
  is_market_test?: boolean; // قابلیت تست بازار و اعلام به زودی
  created_at?: string;
}

export interface ProductLike {
  id: string;
  product_id: string;
  supermarket_id: string;
  supermarket_name: string;
  supermarket_owner?: string;
  supermarket_phone?: string;
  created_at: string;
}

export interface ProductPriceHistory {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  old_visitor_price?: number;
  new_visitor_price?: number;
  changed_by: string;
  changed_at: string;
}

export interface Visitor {
  id: string;
  name: string;
  phone: string;
  region: string;
  username?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Supermarket {
  id: string;
  name: string;
  owner: string;
  phone: string;
  address: string;
  assigned_visitor_id: string;
  is_active: boolean;
  username?: string;
  created_at?: string;
  founder_discount_enabled?: boolean;
  founder_discount_percent?: number;
  approval_status?: 'pending' | 'approved' | 'rejected';
  registration_source?: string;
  approved_at?: string | null;
  approved_by?: string | null;
  approval_note?: string | null;
}

export type OrderStatus = 'assigned' | 'loading' | 'delegated' | 'delivered' | 'undelivered';

export type OrderChannel = 'visitor_field' | 'store_self' | 'store_direct';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  items_per_package?: number;
  unit?: string;
  created_at?: string;
}

export interface Order {
  id: string;
  supermarket_id: string;
  supermarket_name: string;
  assigned_visitor_id: string | null;
  visitor_name: string;
  status: OrderStatus;
  total_amount: number;
  order_source?: 'visitor' | 'supermarket';
  order_channel?: OrderChannel;
  reassignment_id?: string | null;
  loading_bill_id?: string | null;
  invoice_revised_at?: string | null;
  order_date: string;
  items?: OrderItem[];
  stock_deducted?: boolean;
  discount_percent?: number;
  discount_status?: 'none' | 'pending' | 'approved' | 'rejected';
  discount_set_by?: string;
  discount_reviewed_by?: string;
  discount_reviewed_at?: string;
  pickup_discount_percent?: number;
  founder_discount_percent?: number;
  created_at?: string;
}

export interface OrderVisitorHistory {
  id: string;
  order_id: string;
  old_visitor_id: string | null;
  new_visitor_id: string;
  changed_by: string;
  changed_at: string;
}

export type ReassignmentStatus = 'pending' | 'accepted' | 'rejected';

export interface ReassignmentRequest {
  id: string;
  order_id: string;
  supermarket_name: string;
  from_visitor_id: string;
  from_visitor_name: string;
  to_visitor_id: string | null;
  to_visitor_name: string;
  status: ReassignmentStatus;
  timestamp: string;
}

export type LoadingBillStatus = 'draft' | 'pending' | 'approved' | 'loaded' | 'cancelled';

export type LoadingBillItemSource = 'order' | 'visitor_manual' | 'admin_manual';

export interface LoadingBillItem {
  id: string;
  loading_bill_id: string;
  order_id?: string | null;
  product_id: string;
  product_name: string;
  quantity: number;
  original_quantity?: number;
  source?: LoadingBillItemSource;
  customer_label?: string | null;
  line_note?: string | null;
  visitor_price?: number;
  store_price?: number;
  items_per_package?: number;
  unit?: string;
  created_at?: string;
}

export interface LoadingBill {
  id: string;
  invoice_no?: string | null;
  visitor_id: string;
  visitor_name: string;
  status: LoadingBillStatus;
  created_at: string;
  submitted_at?: string | null;
  finalized_at?: string | null;
  finalized_by?: string | null;
  revision_count?: number;
  admin_note?: string | null;
  items?: LoadingBillItem[];
  orders_count?: number;
  total_visitor_cost?: number;
  total_store_amount?: number;
  approved_by?: string;
  approved_at?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancel_reason?: string;
}

export interface InvoiceAudit {
  id: string;
  invoice_id: string;
  action: string;
  actor_name: string;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export type InventoryTransactionType = 'reserve' | 'release_reserve' | 'load_out' | 'return' | 'manual_adjustment' | 'manual_delivery_override';

export interface InventoryTransaction {
  id: string;
  product_id: string;
  product_name?: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  reference_id: string;
  created_at: string;
}

export interface CreateStaffAccountPayload {
  name: string;
  phone: string;
  role: 'admin' | 'warehouse' | 'visitor';
  region?: string;
  username?: string;
  password: string;
}

export interface CreateStaffAccountResult {
  success: boolean;
  username?: string;
  role?: 'admin' | 'warehouse' | 'visitor';
  error?: string;
}

export interface UpdateSupermarketPayload {
  name?: string;
  owner?: string;
  phone?: string;
  address?: string;
  assigned_visitor_id?: string | null;
  username?: string;
  is_active?: boolean;
}

export interface UpdateVisitorPayload {
  name?: string;
  phone?: string;
  region?: string;
  username?: string;
  is_active?: boolean;
}

export interface CentralPhone {
  id: string;
  label: string; // e.g. "دفتر", "موبایل", "پشتیبانی"
  number: string;
  show_in_invoice: boolean;
}

export type InvoiceSectionKey =
  | 'header'
  | 'seller'
  | 'buyer'
  | 'items_table'
  | 'payment_info'
  | 'totals_summary'
  | 'terms'
  | 'signatures';

export interface InvoiceShowSettings {
  // Header
  logo: boolean;
  brand_name: boolean;
  tagline: boolean;
  order_id: boolean;
  order_date: boolean;
  order_time: boolean;
  sale_type: boolean;
  version_badge: boolean;
  invoice_title: boolean;

  // Seller
  seller_name: boolean;
  seller_legal_name: boolean;
  seller_phones: boolean;
  seller_address: boolean;
  seller_visitor: boolean;
  seller_national_id: boolean;
  seller_economic_code: boolean;
  seller_registration_number: boolean;
  seller_postal_code: boolean;

  // Buyer
  buyer_store_name: boolean;
  buyer_owner: boolean;
  buyer_phone: boolean;
  buyer_address: boolean;

  // Table Columns
  col_row_index: boolean;
  col_product_name: boolean;
  col_items_per_package: boolean;
  col_quantity_unit: boolean;
  col_unit_price: boolean;
  col_discount_percent: boolean;
  col_total_price: boolean;

  // Summary & Totals
  summary_items_count: boolean;
  summary_subtotal: boolean;
  summary_discount: boolean;
  summary_vat: boolean;
  summary_final_total: boolean;

  // Payment & Details
  amount_in_words: boolean;
  payment_account_holder: boolean;
  payment_card: boolean;
  payment_iban: boolean;
  payment_terms: boolean;

  // Footer & Signatures
  terms_and_conditions: boolean;
  contact_footer: boolean;
  signatures_seller: boolean;
  signatures_buyer: boolean;
  signatures_receiver: boolean;
  page_number: boolean;
}

export type TableColumnKey =
  | 'row_index'
  | 'product_name'
  | 'items_per_package'
  | 'quantity_unit'
  | 'unit_price'
  | 'discount_percent'
  | 'total_price';

export const DEFAULT_COLUMN_WIDTHS: Record<TableColumnKey, number> = {
  row_index: 6,
  product_name: 34,
  items_per_package: 12,
  quantity_unit: 12,
  unit_price: 13,
  discount_percent: 8,
  total_price: 15,
};

export type FontSizeOption = 'small' | 'normal' | 'large';
export type BorderStrength = 'none' | 'light' | 'normal' | 'bold';
export type SpacingOption = 'compact' | 'normal' | 'spacious';

export interface InvoiceLayoutSettings {
  section_order: InvoiceSectionKey[];
  section_widths: Record<InvoiceSectionKey, 'full' | 'half'>;
  section_alignments: Record<InvoiceSectionKey, 'right' | 'center' | 'left'>;
  column_widths?: Record<TableColumnKey, number>; // درصد عرض هر ستون جدول
  logo_position: 'right' | 'center' | 'left';
  order_info_position: 'left' | 'right' | 'center';
  stick_footer_to_bottom: boolean;
  seller_card_columns: 1 | 2;
  buyer_card_columns: 1 | 2;
}

export interface InvoiceStyleSettings {
  // Global & Spacing
  base_font_size: FontSizeOption; // مقیاس کلی فونت
  section_spacing: SpacingOption; // فاصله بین بخش‌ها (فشرده / معمولی / باز)
  
  // Header
  header_title_size: FontSizeOption;
  header_title_bold: boolean;
  brand_title_size: FontSizeOption;
  brand_title_bold: boolean;
  
  // Cards (فروشنده و خریدار)
  card_padding: SpacingOption;
  card_labels_size: FontSizeOption; // اندازه فونت برچسب‌های کارت‌ها
  card_labels_bold: boolean;
  card_values_size: FontSizeOption; // اندازه فونت مقادیر کارت‌ها
  card_values_bold: boolean;
  cards_font_size?: FontSizeOption; // legacy
  
  // Table
  table_font_size: FontSizeOption;
  table_header_bold: boolean;
  table_density: SpacingOption; // فاصله بین ردیف‌های جدول (فشرده / معمولی / باز)
  
  // Totals & Payment
  totals_font_size: FontSizeOption;
  totals_bold: boolean;
  payment_font_size: FontSizeOption;
  payment_bold: boolean;
  
  // Terms & Footer
  terms_font_size: FontSizeOption;
  terms_bold: boolean;
  footer_font_size: FontSizeOption;
  signatures_height: 'small' | 'medium' | 'large';
  
  // Borders & Corners
  card_border: BorderStrength; // کادر کارت‌ها: بدون خط / کمرنگ / معمولی / پررنگ
  table_border: BorderStrength; // خطوط جدول: بدون خط / کمرنگ / معمولی / پررنگ
  footer_border: BorderStrength; // خط جداکننده پاورقی
  border_thickness?: 'thin' | 'medium' | 'thick'; // legacy
  rounded_corners: boolean; // گوشه گرد روشن/خاموش
  box_rounded?: 'none' | 'small' | 'medium' | 'large'; // legacy
}

export interface InvoiceSettings {
  // A. Seller Info
  brand_name: string;
  legal_name: string;
  tagline: string;
  logo_url: string; // data URI or image URL
  address: string;

  // B. Central Distribution Phone Numbers
  phones: CentralPhone[];

  // C. Legal Identifiers (all optional)
  national_id?: string;
  economic_code?: string;
  registration_number?: string;
  postal_code?: string;

  // D. Visitor Info
  show_visitor_info?: boolean;
  direct_sale_title: string;
  visitor_sale_title: string;

  // E. Title and Appearance
  invoice_title: string;
  show_logo?: boolean;
  show_buyer_address?: boolean;
  show_amount_in_words?: boolean;
  show_signature_boxes?: boolean;
  show_page_number?: boolean;

  // F. Amount, Currency and Payment
  currency_label: string; // 'تومان' | 'ریال' | متن دلخواه
  default_unit_name: string; // پیش‌فرض واحد کالا (مثلا 'عدد')
  has_vat: boolean;
  vat_percent: number;
  has_overall_discount?: boolean;
  discount_percent?: number;
  pickup_discount_percent: number; // پیش‌فرض درصد تخفیف تحویل درب انبار (پیش‌فرض ۳)
  max_visitor_discount_percent: number; // حداکثر درصد تخفیف مجاز ویزیتور (پیش‌فرض ۱۰)
  bank_account_holder: string;
  card_number: string;
  iban: string;
  payment_terms: string;

  // G. Footer
  footer_notes: string;
  website_or_contact: string;
  copy_label: string;

  // H. Paper
  paper_size: 'A4' | 'A5';
  compact_table: boolean;

  // I. Comprehensive Feature Visibility Flags
  show: InvoiceShowSettings;

  // J. Configurable Layout
  layout: InvoiceLayoutSettings;

  // K. Visual Styling & Typography
  style: InvoiceStyleSettings;

  // L. Table Columns Configuration
  table_columns: InvoiceTableColumnConfig[];
}

export interface InvoiceTableColumnConfig {
  key: TableColumnKey;
  label: string;
  visible: boolean;
}

export const DEFAULT_TABLE_COLUMNS: InvoiceTableColumnConfig[] = [
  { key: 'row_index', label: '#', visible: true },
  { key: 'product_name', label: 'شرح کالا / خدمات', visible: true },
  { key: 'quantity_unit', label: 'تعداد', visible: true },
  { key: 'items_per_package', label: 'واحد (تعداد در کارتن)', visible: true },
  { key: 'unit_price', label: 'قیمت واحد', visible: true },
  { key: 'discount_percent', label: 'تخفیف (٪)', visible: false },
  { key: 'total_price', label: 'مبلغ کل', visible: true },
];

export const DEFAULT_INVOICE_SHOW_SETTINGS: InvoiceShowSettings = {
  logo: true,
  brand_name: true,
  tagline: true,
  order_id: true,
  order_date: true,
  order_time: true,
  sale_type: true,
  version_badge: true,
  invoice_title: true,

  seller_name: true,
  seller_legal_name: true,
  seller_phones: true,
  seller_address: true,
  seller_visitor: true,
  seller_national_id: true,
  seller_economic_code: true,
  seller_registration_number: true,
  seller_postal_code: true,

  buyer_store_name: true,
  buyer_owner: true,
  buyer_phone: true,
  buyer_address: true,

  col_row_index: true,
  col_product_name: true,
  col_items_per_package: true,
  col_quantity_unit: true,
  col_unit_price: true,
  col_discount_percent: false,
  col_total_price: true,

  summary_items_count: true,
  summary_subtotal: true,
  summary_discount: false,
  summary_vat: true,
  summary_final_total: true,

  amount_in_words: true,
  payment_account_holder: true,
  payment_card: true,
  payment_iban: true,
  payment_terms: true,

  terms_and_conditions: true,
  contact_footer: true,
  signatures_seller: true,
  signatures_buyer: true,
  signatures_receiver: true,
  page_number: true,
};

export const DEFAULT_INVOICE_LAYOUT_SETTINGS: InvoiceLayoutSettings = {
  section_order: [
    'header',
    'seller',
    'buyer',
    'items_table',
    'payment_info',
    'totals_summary',
    'terms',
    'signatures',
  ],
  section_widths: {
    header: 'full',
    seller: 'half',
    buyer: 'half',
    items_table: 'full',
    payment_info: 'half',
    totals_summary: 'half',
    terms: 'full',
    signatures: 'full',
  },
  section_alignments: {
    header: 'right',
    seller: 'right',
    buyer: 'right',
    items_table: 'right',
    payment_info: 'right',
    totals_summary: 'right',
    terms: 'right',
    signatures: 'right',
  },
  column_widths: { ...DEFAULT_COLUMN_WIDTHS },
  logo_position: 'right',
  order_info_position: 'left',
  stick_footer_to_bottom: true,
  seller_card_columns: 2,
  buyer_card_columns: 2,
};

export const DEFAULT_INVOICE_STYLE_SETTINGS: InvoiceStyleSettings = {
  base_font_size: 'normal',
  section_spacing: 'normal',
  header_title_size: 'normal',
  header_title_bold: true,
  brand_title_size: 'normal',
  brand_title_bold: true,
  card_padding: 'normal',
  card_labels_size: 'normal',
  card_labels_bold: false,
  card_values_size: 'normal',
  card_values_bold: true,
  cards_font_size: 'normal',
  table_font_size: 'normal',
  table_header_bold: true,
  table_density: 'normal',
  totals_font_size: 'normal',
  totals_bold: true,
  payment_font_size: 'normal',
  payment_bold: false,
  terms_font_size: 'normal',
  terms_bold: false,
  footer_font_size: 'normal',
  signatures_height: 'medium',
  card_border: 'normal',
  table_border: 'normal',
  footer_border: 'normal',
  border_thickness: 'thin',
  rounded_corners: true,
  box_rounded: 'medium',
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  brand_name: 'شبکه پخش عمده فرهودی',
  legal_name: 'صنایع غذایی منجمد و سردخانه‌ای فرهودی',
  tagline: 'سامانه سفارش‌گیری و توزیع مویرگی زنجیره سرد مواد غذایی',
  logo_url: '',
  address: 'بابل، جاده قائمشهر، مجتمع پخش سردخانه‌ای فرهودی',
  phones: [
    { id: 'p1', label: 'دفتر فروش', number: '۰۱۱۳۳۲۲۱۱۰۰', show_in_invoice: true },
    { id: 'p2', label: 'موبایل و پشتیبانی', number: '۰۹۱۲۳۴۵۶۷۸۹', show_in_invoice: true },
  ],
  national_id: '',
  economic_code: '',
  registration_number: '',
  postal_code: '',
  show_visitor_info: true,
  direct_sale_title: 'فروش مستقیم پخش مرکزی',
  visitor_sale_title: 'فروش از طریق ویزیتور',
  invoice_title: 'صورت‌حساب فروش و تحویل کالا',
  show_logo: true,
  show_buyer_address: true,
  show_amount_in_words: true,
  show_signature_boxes: true,
  show_page_number: true,
  currency_label: 'تومان',
  default_unit_name: 'عدد',
  has_vat: false,
  vat_percent: 10,
  has_overall_discount: false,
  discount_percent: 0,
  pickup_discount_percent: 3,
  max_visitor_discount_percent: 10,
  bank_account_holder: 'صنایع غذایی فرهودی',
  card_number: '',
  iban: '',
  payment_terms: 'نقدی هنگام تحویل کالا / چک صیادی با هماهنگی مدیریت',
  footer_notes: 'اجناس تحویل شده از نظر سلامت ظاهری، انجماد و تاریخ مصرف مورد تایید خریدار قرار گرفت.',
  website_or_contact: 'barfroosh.ir',
  copy_label: 'نسخه فروشگاه',
  paper_size: 'A4',
  compact_table: false,
  show: DEFAULT_INVOICE_SHOW_SETTINGS,
  layout: DEFAULT_INVOICE_LAYOUT_SETTINGS,
  style: DEFAULT_INVOICE_STYLE_SETTINGS,
  table_columns: DEFAULT_TABLE_COLUMNS,
};

export function getInvoiceSettings(raw?: unknown): InvoiceSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_INVOICE_SETTINGS };
  }
  const r = raw as Partial<InvoiceSettings>;
  const rawShow = (r.show && typeof r.show === 'object') ? (r.show as Partial<InvoiceShowSettings>) : {};
  const rawLayout = (r.layout && typeof r.layout === 'object') ? (r.layout as Partial<InvoiceLayoutSettings>) : {};
  const rawStyle = (r.style && typeof r.style === 'object') ? (r.style as Partial<InvoiceStyleSettings>) : {};

  // Compatibility bridges for legacy top-level booleans if show object was partially populated:
  const show: InvoiceShowSettings = {
    ...DEFAULT_INVOICE_SHOW_SETTINGS,
    ...(r.show_logo !== undefined ? { logo: r.show_logo } : {}),
    ...(r.show_buyer_address !== undefined ? { buyer_address: r.show_buyer_address } : {}),
    ...(r.show_amount_in_words !== undefined ? { amount_in_words: r.show_amount_in_words } : {}),
    ...(r.show_page_number !== undefined ? { page_number: r.show_page_number } : {}),
    ...(r.show_visitor_info !== undefined ? { seller_visitor: r.show_visitor_info } : {}),
    ...rawShow,
  };

  const layout: InvoiceLayoutSettings = {
    ...DEFAULT_INVOICE_LAYOUT_SETTINGS,
    ...rawLayout,
    section_widths: {
      ...DEFAULT_INVOICE_LAYOUT_SETTINGS.section_widths,
      ...(rawLayout.section_widths || {}),
    },
    section_alignments: {
      ...DEFAULT_INVOICE_LAYOUT_SETTINGS.section_alignments,
      ...(rawLayout.section_alignments || {}),
    },
    column_widths: {
      ...DEFAULT_COLUMN_WIDTHS,
      ...(rawLayout.column_widths || {}),
    },
    section_order: Array.isArray(rawLayout.section_order) && rawLayout.section_order.length > 0
      ? rawLayout.section_order
      : DEFAULT_INVOICE_LAYOUT_SETTINGS.section_order,
  };

  const style: InvoiceStyleSettings = {
    ...DEFAULT_INVOICE_STYLE_SETTINGS,
    ...rawStyle,
  };

  // Visibility mapping
  const colVisibilityKeyMap: Record<TableColumnKey, keyof InvoiceShowSettings> = {
    row_index: 'col_row_index',
    product_name: 'col_product_name',
    items_per_package: 'col_items_per_package',
    quantity_unit: 'col_quantity_unit',
    unit_price: 'col_unit_price',
    discount_percent: 'col_discount_percent',
    total_price: 'col_total_price',
  };

  let mergedColumns: InvoiceTableColumnConfig[] = [];
  if (Array.isArray(r.table_columns) && r.table_columns.length > 0) {
    mergedColumns = r.table_columns.map((col) => {
      let label = col.label;
      // Upgrade legacy default labels if they match old defaults
      if (label === 'فی' || label === 'فی (تومان)' || label === 'فی (ریال)') {
        label = 'قیمت واحد';
      } else if (label === 'تعداد / واحد') {
        label = 'تعداد';
      } else if (label === 'تعداد در کارتن') {
        label = 'واحد (تعداد در کارتن)';
      }

      return {
        ...col,
        label,
        visible: show[colVisibilityKeyMap[col.key]] ?? col.visible ?? true,
      };
    });

    // Check if the order of items_per_package and quantity_unit matches legacy default (where items_per_package was before quantity_unit)
    const itemsPkgIdx = mergedColumns.findIndex((c) => c.key === 'items_per_package');
    const qtyUnitIdx = mergedColumns.findIndex((c) => c.key === 'quantity_unit');
    if (itemsPkgIdx >= 0 && qtyUnitIdx >= 0 && itemsPkgIdx < qtyUnitIdx) {
      // Check if it's the exact old default order
      const keysOrder = mergedColumns.map((c) => c.key);
      const isOldOrder = keysOrder.join(',').startsWith('row_index,product_name,items_per_package,quantity_unit');
      if (isOldOrder) {
        const itemPkgCol = mergedColumns[itemsPkgIdx];
        const qtyCol = mergedColumns[qtyUnitIdx];
        mergedColumns[itemsPkgIdx] = qtyCol;
        mergedColumns[qtyUnitIdx] = itemPkgCol;
      }
    }

    // Append any missing column key
    DEFAULT_TABLE_COLUMNS.forEach((defCol) => {
      if (!mergedColumns.some((c) => c.key === defCol.key)) {
        mergedColumns.push({
          ...defCol,
          visible: show[colVisibilityKeyMap[defCol.key]] ?? defCol.visible,
        });
      }
    });
  } else {
    mergedColumns = DEFAULT_TABLE_COLUMNS.map((defCol) => ({
      ...defCol,
      visible: show[colVisibilityKeyMap[defCol.key]] ?? defCol.visible,
    }));
  }

  return {
    ...DEFAULT_INVOICE_SETTINGS,
    ...r,
    currency_label: r.currency_label || 'تومان',
    pickup_discount_percent:
      typeof r.pickup_discount_percent === 'number' && r.pickup_discount_percent >= 0
        ? r.pickup_discount_percent
        : 3,
    max_visitor_discount_percent:
      typeof r.max_visitor_discount_percent === 'number' && r.max_visitor_discount_percent >= 0
        ? r.max_visitor_discount_percent
        : 10,
    default_unit_name: r.default_unit_name || 'عدد',
    show,
    layout,
    style,
    table_columns: mergedColumns,
    phones: Array.isArray(r.phones) ? r.phones : DEFAULT_INVOICE_SETTINGS.phones,
  };
}



