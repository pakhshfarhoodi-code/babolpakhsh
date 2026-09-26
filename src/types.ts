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
  stock: number;
  reserved_stock: number;
  unit: string;
  image_url: string;
  is_active: boolean;
  created_at?: string;
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
  password?: string;
  created_at?: string;
}

export type OrderStatus = 'assigned' | 'loading' | 'delegated' | 'delivered' | 'undelivered';

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
  assigned_visitor_id: string;
  visitor_name: string;
  status: OrderStatus;
  total_amount: number;
  reassignment_id?: string | null;
  loading_bill_id?: string | null;
  order_date: string;
  items?: OrderItem[];
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

export type LoadingBillStatus = 'pending' | 'approved' | 'cancelled';

export interface LoadingBillItem {
  id: string;
  loading_bill_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  created_at?: string;
}

export interface LoadingBill {
  id: string;
  visitor_id: string;
  visitor_name: string;
  status: LoadingBillStatus;
  created_at: string;
  items?: LoadingBillItem[];
}

export type InventoryTransactionType = 'reserve' | 'release_reserve' | 'load_out' | 'return' | 'manual_adjustment';

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
  is_active: boolean;
}

export interface UpdateVisitorPayload {
  name?: string;
  phone?: string;
  region?: string;
  username?: string;
  is_active?: boolean;
}

