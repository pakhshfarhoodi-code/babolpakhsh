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
  show_visitor_info: boolean;
  direct_sale_title: string;
  visitor_sale_title: string;

  // E. Title and Appearance
  invoice_title: string;
  show_logo: boolean;
  show_buyer_address: boolean;
  show_amount_in_words: boolean;
  show_signature_boxes: boolean;
  show_page_number: boolean;

  // F. Amount and Payment
  has_vat: boolean;
  vat_percent: number;
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
}

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
  has_vat: false,
  vat_percent: 10,
  bank_account_holder: 'صنایع غذایی فرهودی',
  card_number: '',
  iban: '',
  payment_terms: 'نقدی هنگام تحویل کالا / چک صیادی با هماهنگی مدیریت',
  footer_notes: 'اجناس تحویل شده از نظر سلامت ظاهری، انجماد و تاریخ مصرف مورد تایید خریدار قرار گرفت.',
  website_or_contact: 'barfroosh.ir',
  copy_label: 'نسخه فروشگاه',
  paper_size: 'A4',
  compact_table: false,
};

export function getInvoiceSettings(raw?: unknown): InvoiceSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_INVOICE_SETTINGS };
  }
  const r = raw as Partial<InvoiceSettings>;
  return {
    ...DEFAULT_INVOICE_SETTINGS,
    ...r,
    phones: Array.isArray(r.phones) ? r.phones : DEFAULT_INVOICE_SETTINGS.phones,
  };
}

