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
  password?: string;
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
  password?: string;
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
  password?: string;
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
  username: string;
  password: string;
}

export interface CreateStaffAccountResult {
  success: boolean;
  username?: string;
  role?: 'admin' | 'warehouse' | 'visitor';
  error?: string;
}

export interface UpdateSupermarketPayload {
  name: string;
  owner: string;
  phone: string;
  address: string;
  assigned_visitor_id: string;
  username?: string;
  password?: string;
  is_active: boolean;
}

export interface UpdateVisitorPayload {
  name?: string;
  phone?: string;
  region?: string;
  username?: string;
  password?: string;
  is_active?: boolean;
}

