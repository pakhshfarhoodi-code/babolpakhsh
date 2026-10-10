import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserRole,
  CurrentUser,
  Product,
  ProductLike,
  Category,
  Visitor,
  Supermarket,
  Order,
  ReassignmentRequest,
  LoadingBill,
  InventoryTransaction,
  OrderStatus,
  ProductPriceHistory,
  CreateStaffAccountPayload,
  CreateStaffAccountResult,
  UpdateSupermarketPayload,
  UpdateVisitorPayload,
  InvoiceSettings,
  DEFAULT_INVOICE_SETTINGS,
  getInvoiceSettings,
  FinancialAccount,
  AccountTransaction,
  Cheque,
  PaymentAllocation,
  FinancialAccountSummary,
  ChequeStatus,
  ChequeDetailsInput,
  PaymentAllocationInput,
  AdminProfile,
  DEFAULT_ADMIN_PROFILE,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_BRANDS,
  INITIAL_PRODUCTS,
  INITIAL_VISITORS,
  INITIAL_SUPERMARKETS,
  INITIAL_ORDERS,
  INITIAL_LOADING_BILLS,
  INITIAL_INVENTORY_TRANSACTIONS,
} from '../data/initialData';
import { supabase, isSupabaseConfigured, getFunctionErrorMessage } from '../lib/supabase';
import {
  STORAGE_KEYS,
  generateUniqueId,
  toSyntheticEmail,
  addDeletedId,
  normalizeDigits,
  normalizePhone,
  isValidMobile,
  MIN_PASSWORD_LENGTH,
} from './utils';
import { useAuth } from './hooks/useAuth';
import { useCatalog } from './hooks/useCatalog';
import { useWarehouse } from './hooks/useWarehouse';
import { useOrders, CreateOrderPayload } from './hooks/useOrders';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { useFinancialAccounts } from './hooks/useFinancialAccounts';
import { syncPwaIconsAndManifest } from '../utils/pwaIcons';
import { CheckCircle2, AlertTriangle, Info, X, Bell, Clock } from 'lucide-react';

// Re-export helpers for backwards compatibility
export { generateUniqueId, toSyntheticEmail };

export type { CreateOrderPayload };

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  selectedVisitorId: string;
  setSelectedVisitorId: (id: string) => void;
  selectedSupermarketId: string;
  setSelectedSupermarketId: (id: string) => void;

  authReady: boolean;
  isLoggedIn: boolean;
  currentUser: CurrentUser;
  loginWithCredentials: (username: string, password: string, allowedRoles?: UserRole[]) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', durationMs?: number) => void;

  categories: Category[];
  brands: string[];
  units: string[];
  products: Product[];
  productLikes: ProductLike[];
  visitors: Visitor[];
  supermarkets: Supermarket[];
  orders: Order[];
  reassignmentRequests: ReassignmentRequest[];
  loadingBills: LoadingBill[];
  inventoryTransactions: InventoryTransaction[];
  priceHistories: ProductPriceHistory[];
  deleteInventoryTransactions: (txIds: string[]) => Promise<{ success: boolean; message: string; count: number }>;
  createOrder: (payload: CreateOrderPayload) => Promise<{ success: boolean; message: string; orderId?: string; order?: Order }> | { success: boolean; message: string; orderId?: string; order?: Order };
  updateOrder: (
    orderId: string,
    updatedItems: { productId: string; name: string; price: number; quantity: number }[]
  ) => Promise<{ success: boolean; message: string }>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  requestReassignment: (orderId: string, toVisitorId: string | null) => void;
  respondToReassignment: (requestId: string, accept: boolean) => void;
  assignOrderVisitor: (
    orderId: string,
    targetVisitorId: string | 'direct',
    updateCustomerPermanent?: boolean
  ) => { success: boolean; message: string; targetVisitorName?: string };
  deleteOrder: (orderId: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  createLoadingBill: (
    visitorId: string,
    orderIds: string[]
  ) => Promise<{ success: boolean; message: string; billId?: string }> | { success: boolean; message: string; billId?: string };
  approveLoadingBill: (
    billId: string,
    approvedBy?: string
  ) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  cancelLoadingBill: (
    billId: string,
    cancelledBy: string,
    reason: string
  ) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  updateProductPrice: (productId: string, newPrice: number, newVisitorPrice?: number, newConsumerPrice?: number) => void;
  updateProduct: (productId: string, updates: Partial<Omit<Product, 'id' | 'reserved_stock'>>) => { success: boolean; message: string };
  toggleProductLike: (
    productId: string,
    supermarket: { id: string; name: string; owner?: string; phone?: string }
  ) => Promise<{ success: boolean; liked: boolean; message: string }>;
  updateProductStock: (productId: string, additionalStock: number) => void;
  recordProductReturn: (productId: string, quantity: number, reason: string) => { success: boolean; message: string };
  addNewProduct: (product: Omit<Product, 'id' | 'reserved_stock'>) => void;
  bulkUpsertProducts: (items: Array<{
    id?: string;
    name: string;
    category_id?: string;
    category_name?: string;
    brand?: string;
    price: number;
    visitor_price?: number;
    consumer_price?: number;
    stock?: number;
    unit?: string;
    items_per_package?: number;
    image_url?: string;
    is_active?: boolean;
    is_market_test?: boolean;
  }>) => { success: boolean; createdCount: number; updatedCount: number; message: string } | Promise<{ success: boolean; createdCount: number; updatedCount: number; message: string }>;
  deleteProduct: (productId: string) => Promise<{ success: boolean; message: string }>;
  bulkDeleteProducts: (productIds: string[]) => Promise<{ success: boolean; message: string; count: number }>;
  bulkUpdateProducts: (
    productIds: string[],
    updates: {
      category_id?: string;
      brand?: string;
      unit?: string;
      priceAdjustmentPercent?: number;
      fixedPrice?: number;
      is_active?: boolean;
    }
  ) => Promise<{ success: boolean; message: string; count: number }>;
  addCategory: (name: string, icon?: string) => { success: boolean; message: string; category?: Category };
  updateCategory: (categoryId: string, newName: string) => { success: boolean; message: string };
  deleteCategory: (categoryId: string) => { success: boolean; message: string };
  addBrand: (name: string) => { success: boolean; message: string };
  updateBrand: (oldBrandName: string, newBrandName: string) => { success: boolean; message: string };
  deleteBrand: (brandName: string) => { success: boolean; message: string };
  updateBrandOrder: (orderedBrands: string[]) => Promise<{ success: boolean; message: string }>;
  productOrderMap: Record<string, string[]>;
  updateProductOrder: (brandName: string, orderedProductIds: string[]) => Promise<{ success: boolean; message: string }>;
  addUnit: (name: string) => { success: boolean; message: string };
  updateUnit: (oldUnitName: string, newUnitName: string) => { success: boolean; message: string };
  deleteUnit: (unitName: string) => { success: boolean; message: string };
  registerSupermarket: (data: {
    name: string;
    owner?: string;
    phone: string;
    address?: string;
    assigned_visitor_id?: string;
    username?: string;
    password: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<{ success: boolean; message: string; supermarket?: Supermarket }>;
  updateSupermarket: (id: string, payload: UpdateSupermarketPayload) => Promise<{ success: boolean; message: string }>;
  deleteSupermarket: (id: string) => Promise<{ success: boolean; message: string }>;
  toggleSupermarketApproval: (id: string, currentStatus: boolean) => Promise<{ success: boolean; message: string; newStatus: boolean }>;
  resetSupermarketPassword: (id: string, newPassword?: string) => Promise<{ success: boolean; message: string }>;
  updateVisitor: (id: string, payload: UpdateVisitorPayload) => Promise<{ success: boolean; message: string }>;
  deleteVisitor: (id: string) => Promise<{ success: boolean; message: string }>;
  resetVisitorPassword: (id: string, newPassword?: string) => Promise<{ success: boolean; message: string }>;
  createStaffAccount: (payload: CreateStaffAccountPayload) => Promise<CreateStaffAccountResult>;
  resetToDefaults: () => void;
  isOnlineDb: boolean;
  isDataReady: boolean;
  fetchError: string | null;
  retryFetch: () => void;
  refreshData: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  invoiceSettings: InvoiceSettings;
  updateInvoiceSettings: (settings: InvoiceSettings) => Promise<{ success: boolean; message: string }>;
  adminProfile: AdminProfile;
  updateAdminProfile: (profile: AdminProfile) => Promise<{ success: boolean; message: string }>;
  financialAccounts: FinancialAccount[];
  accountTransactions: AccountTransaction[];
  cheques: Cheque[];
  paymentAllocations: PaymentAllocation[];
  isFinancialLoading: boolean;
  activateFinancialAccount: (profileId: string, creditLimit?: number, notes?: string) => Promise<{ success: boolean; message: string; account?: FinancialAccount }>;
  deactivateFinancialAccount: (accountId: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  recordFinancialPayment: (payload: {
    profileId: string;
    paymentType: 'cash_payment' | 'bank_transfer' | 'cheque_payment';
    amount: number;
    referenceId?: string;
    description?: string;
    chequeDetails?: ChequeDetailsInput;
    allocations?: PaymentAllocationInput[];
  }) => Promise<{ success: boolean; message: string }>;
  updateChequeStatus: (chequeId: string, status: ChequeStatus, reason?: string) => Promise<{ success: boolean; message: string }>;
  manualFinancialEntry: (payload: {
    profileId: string;
    type: 'manual_debit' | 'manual_credit' | 'opening_balance' | 'refund' | 'account_adjustment';
    amount: number;
    description: string;
    referenceId?: string;
    entryType?: 'debit' | 'credit';
  }) => Promise<{ success: boolean; message: string }>;
  getAccountSummary: (profileId: string) => FinancialAccountSummary | null;
  getInvoiceSettlementStatus: (invoiceId: string, invoiceTotal: number) => { totalPaid: number; remainingDue: number; status: 'settled' | 'partially_paid' | 'unpaid'; allocationsCount: number };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'light') {
        document.documentElement.classList.add('theme-light');
        document.documentElement.classList.remove('dark');
        document.body.classList.add('theme-light');
        document.body.classList.remove('dark');
      } else {
        document.documentElement.classList.remove('theme-light');
        document.documentElement.classList.add('dark');
        document.body.classList.remove('theme-light');
        document.body.classList.add('dark');
      }
    }
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const DUMMY_VISITOR_IDS = new Set(['vis-1', 'vis-2', 'vis-3']);

  // Database-first state readiness and error management
  const [isDataReady, setIsDataReady] = useState<boolean>(() => !isSupabaseConfigured);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);

  const retryFetch = useCallback(() => {
    setFetchError(null);
    setIsDataReady(false);
    setReloadCounter((c) => c + 1);
  }, []);

  const refreshData = useCallback(() => {
    setReloadCounter((c) => c + 1);
  }, []);

  // Visitors & Supermarkets
  const [visitors, setVisitors] = useState<Visitor[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.VISITORS);
    if (!saved) return [];
    try {
      const parsed: Visitor[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((v) => !DUMMY_VISITOR_IDS.has(v.id)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(visitors));
  }, [visitors]);

  const DUMMY_SUPERMARKET_IDS = new Set(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']);

  const [supermarkets, setSupermarkets] = useState<Supermarket[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.SUPERMARKETS);
    if (!saved) return [];
    try {
      const parsed: Supermarket[] = JSON.parse(saved);
      return parsed.filter((s) => !DUMMY_SUPERMARKET_IDS.has(s.id));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.SUPERMARKETS, JSON.stringify(supermarkets));
  }, [supermarkets]);

  // Hook 1: Authentication & User Management
  const auth = useAuth({
    visitors,
    setVisitors,
    supermarkets,
    setSupermarkets,
  });

  // Hook 2: Catalog (Products, Categories, Brands, Price History)
  const catalog = useCatalog();

  // Hook 3 & 4: Orders & Warehouse
  // We forward inventory transaction additions from orders to warehouse
  const orders = useOrders({
    products: catalog.products,
    setProducts: catalog.setProducts,
    supermarkets,
    visitors,
    selectedVisitorId: auth.selectedVisitorId,
    addInventoryTransactions: (txs) => warehouse.addInventoryTransactions(txs),
  });

  const warehouse = useWarehouse({
    products: catalog.products,
    setProducts: catalog.setProducts,
    visitors,
    orders: orders.orders,
    setOrders: orders.setOrders,
  });

  const financial = useFinancialAccounts({
    visitors,
    supermarkets,
    loadingBills: warehouse.loadingBills,
    reloadCounter,
    currentUser: auth.currentUser,
  });

  // Global Toast notification system
  const [globalToast, setGlobalToast] = useState<{
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  } | null>(null);

  const toastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', durationMs: number = 5000) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setGlobalToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setGlobalToast((curr) => (curr?.message === message ? null : curr));
    }, durationMs);
  }, []);

  // Hook 5: Supabase Realtime / Polling Sync & LocalStorage Cross-Tab Sync
  useSupabaseSync({
    setProducts: catalog.setProducts,
    setOrders: orders.setOrders,
    setCategories: catalog.setCategories,
    setBrands: catalog.setBrands,
    setReassignmentRequests: orders.setReassignmentRequests,
    setSupermarkets,
    setVisitors,
    setLoadingBills: warehouse.setLoadingBills,
    setInventoryTransactions: warehouse.setInventoryTransactions,
    setProductLikes: catalog.setProductLikes,
    role: auth.role,
    currentUser: auth.currentUser,
    onShowToast: showToast,
    setIsDataReady,
    setFetchError,
    reloadCounter,
  });

  // Reset to default factory state
  const resetToDefaults = useCallback(() => {
    localStorage.clear();
    catalog.setCategories(INITIAL_CATEGORIES);
    catalog.setBrands(INITIAL_BRANDS);
    catalog.setProducts(INITIAL_PRODUCTS);
    orders.setOrders(INITIAL_ORDERS);
    orders.setReassignmentRequests([]);
    warehouse.setLoadingBills(INITIAL_LOADING_BILLS);
    warehouse.setInventoryTransactions(INITIAL_INVENTORY_TRANSACTIONS);
    catalog.setPriceHistories([]);
    setSupermarkets(INITIAL_SUPERMARKETS);
  }, [catalog, orders, warehouse]);

  // Update Supermarket information (both local state and Supabase if online)
  const updateSupermarket = useCallback(async (id: string, payload: UpdateSupermarketPayload): Promise<{ success: boolean; message: string }> => {
    try {
      let normalizedPhone: string | undefined = undefined;
      if (payload.phone !== undefined) {
        normalizedPhone = normalizePhone(payload.phone);
        if (!isValidMobile(normalizedPhone)) {
          return { success: false, message: 'شماره موبایل معتبر وارد کنید' };
        }
        // Check uniqueness in local state
        const phoneExistsInState =
          supermarkets.some((s) => s.id !== id && normalizePhone(s.phone) === normalizedPhone) ||
          visitors.some((v) => v.id !== id && normalizePhone(v.phone) === normalizedPhone);
        if (phoneExistsInState) {
          return { success: false, message: 'این شماره تماس قبلاً برای حساب دیگری ثبت شده است.' };
        }
      }

      if (isSupabaseConfigured && supabase) {
        if (normalizedPhone) {
          // Check uniqueness in profiles table
          const { data: dupProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', normalizedPhone)
            .neq('id', id)
            .maybeSingle();

          if (dupProfile) {
            return { success: false, message: 'این شماره تماس قبلاً برای حساب دیگری ثبت شده است.' };
          }
        }

        const updateData: Record<string, unknown> = {};

        if (payload.name !== undefined) updateData.name = payload.name.trim();
        if (payload.owner !== undefined) updateData.owner = payload.owner.trim();
        if (normalizedPhone !== undefined) updateData.phone = normalizedPhone;
        if (payload.address !== undefined) updateData.address = payload.address.trim();
        if (payload.is_active !== undefined) updateData.is_active = payload.is_active;
        if (payload.latitude !== undefined) updateData.latitude = payload.latitude;
        if (payload.longitude !== undefined) updateData.longitude = payload.longitude;
        if (payload.verification_type !== undefined) updateData.verification_type = payload.verification_type;
        if (payload.verified_at !== undefined) updateData.verified_at = payload.verified_at;
        if (payload.verified_by !== undefined) updateData.verified_by = payload.verified_by;
        if (payload.verification_note !== undefined) updateData.verification_note = payload.verification_note;
        // NOTE: As per requirement 6, do NOT update username column on phone change!

        // Only touch assigned_visitor_id if explicitly supplied in payload
        if (payload.assigned_visitor_id !== undefined) {
          let validVisitorId: string | null = null;
          if (payload.assigned_visitor_id && payload.assigned_visitor_id !== 'direct') {
            const visitorExists = visitors.some((v) => v.id === payload.assigned_visitor_id);
            if (!visitorExists) {
              return {
                success: false,
                message: 'ویزیتور انتخاب‌شده در سیستم یافت نشد.',
              };
            }
            validVisitorId = payload.assigned_visitor_id;
          }
          updateData.assigned_visitor_id = validVisitorId;
        }

        const existingSm = supermarkets.find((s) => s.id === id);
        if (auth.currentUser?.role === 'supermarket' && auth.currentUser.id === id) {
          // Supermarket updating own store via secure update_my_store RPC
          const { error: rpcErr } = await supabase.rpc('update_my_store', {
            p_name: payload.name ?? existingSm?.name ?? '',
            p_owner: payload.owner ?? existingSm?.owner ?? '',
            p_address: payload.address ?? existingSm?.address ?? '',
            p_phone: normalizedPhone ?? existingSm?.phone ?? '',
          });

          if (rpcErr) {
            return { success: false, message: `خطا در ویرایش اطلاعات فروشگاه: ${rpcErr.message}` };
          }

          if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
            try {
              await supabase.rpc('set_store_location', {
                p_store_id: id,
                p_lat: payload.latitude,
                p_lng: payload.longitude,
              });
            } catch (locErr) {
              console.warn('Failed to call set_store_location:', locErr);
            }
          } else if (payload.latitude === null || payload.longitude === null) {
            try {
              await supabase.from('supermarkets').update({ latitude: null, longitude: null }).eq('id', id);
            } catch (clearErr) {
              console.warn('Failed to clear location:', clearErr);
            }
          }
        } else {
          // Admin or authorized staff direct update
          if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
            try {
              await supabase.rpc('set_store_location', {
                p_store_id: id,
                p_lat: payload.latitude,
                p_lng: payload.longitude,
              });
            } catch (locErr) {
              console.warn('Failed to call set_store_location (admin):', locErr);
            }
          }
          if (Object.keys(updateData).length > 0) {
            const { data: updatedRows, error: smError } = await supabase
              .from('supermarkets')
              .update(updateData)
              .eq('id', id)
              .select();

            if (smError) {
              return { success: false, message: `خطا در ویرایش سوپرمارکت در سرور: ${smError.message}` };
            }

            if (!updatedRows || updatedRows.length === 0) {
              return { success: false, message: 'ذخیره در سرور انجام نشد (عدم دسترسی یا عدم وجود رکورد).' };
            }
          }

          // Also update profiles table ONLY with explicitly provided fields (without changing username)
          const profileUpdates: Record<string, unknown> = {};
          if (payload.name !== undefined) profileUpdates.name = payload.name.trim();
          if (normalizedPhone !== undefined) profileUpdates.phone = normalizedPhone;

          if (Object.keys(profileUpdates).length > 0) {
            await supabase
              .from('profiles')
              .update(profileUpdates)
              .eq('id', id);
          }
        }
      }

      // Update supermarkets in local state only for explicitly changed fields
      setSupermarkets((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s };
          if (payload.name !== undefined) next.name = payload.name;
          if (payload.owner !== undefined) next.owner = payload.owner;
          if (normalizedPhone !== undefined) next.phone = normalizedPhone;
          if (payload.address !== undefined) next.address = payload.address;
          if (payload.is_active !== undefined) next.is_active = payload.is_active;
          if (payload.latitude !== undefined) next.latitude = payload.latitude;
          if (payload.longitude !== undefined) next.longitude = payload.longitude;
          if (payload.verification_type !== undefined) next.verification_type = payload.verification_type;
          if (payload.verified_at !== undefined) next.verified_at = payload.verified_at;
          if (payload.verified_by !== undefined) next.verified_by = payload.verified_by;
          if (payload.verification_note !== undefined) next.verification_note = payload.verification_note;
          if (payload.assigned_visitor_id !== undefined) {
            next.assigned_visitor_id = payload.assigned_visitor_id || 'direct';
          }
          return next;
        })
      );

      return { success: true, message: 'مشخصات فروشگاه با موفقیت ویرایش شد.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ویرایش مشتری';
      return { success: false, message: msg };
    }
  }, [visitors, supermarkets, setSupermarkets]);

  // Delete Supermarket (both local and Supabase, unlinking orders so historical invoices remain valid and orders are never deleted)
  const deleteSupermarket = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Record tombstone immediately
      addDeletedId(STORAGE_KEYS.DELETED_SUPERMARKET_IDS, id);

      // 2. Identify orders referencing this supermarket
      const smOrders = orders.orders.filter((o) => o.supermarket_id === id);

      // 3. Release reserved stock for any unfulfilled orders
      smOrders.forEach((ord) => {
        if (ord.status !== 'delivered' && ord.status !== 'undelivered') {
          const items = ord.items || [];
          if (items.length > 0) {
            catalog.setProducts((prev) =>
              prev.map((p) => {
                const item = items.find((i) => i.product_id === p.id);
                if (item) {
                  return {
                    ...p,
                    reserved_stock: Math.max(0, p.reserved_stock - item.quantity),
                  };
                }
                return p;
              })
            );
          }
        }
      });

      if (isSupabaseConfigured && supabase) {
        // Invoke delete_account on edge function to delete Auth user, profiles, and supermarkets rows (preserving orders)
        const { data: delData, error: delError } = await supabase.functions.invoke(
          'create-staff-account',
          {
            body: {
              action: 'delete_account',
              userId: id,
            },
          }
        );

        if (delError || delData?.success === false) {
          const errMsg = delData?.error || (await getFunctionErrorMessage(delError, 'خطا در حذف حساب کاربری فروشگاه از سرور.'));
          return {
            success: false,
            message: errMsg,
          };
        }
      }

      // Update supermarkets in local state
      setSupermarkets((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.SUPERMARKETS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // Update orders in local state: preserve historical orders with unlinked supermarket_id
      orders.setOrders((prev) => {
        const next = prev.map((o) =>
          o.supermarket_id === id ? { ...o, supermarket_id: '' } : o
        );
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      return { success: true, message: 'مشتری با موفقیت حذف گردید و سوابق سفارشات بایگانی شد.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در حذف مشتری';
      return { success: false, message: msg };
    }
  }, [orders, catalog, setSupermarkets]);

  // Quick toggle approval / active state for Supermarket
  const toggleSupermarketApproval = useCallback(async (id: string, currentStatus: boolean): Promise<{ success: boolean; message: string; newStatus: boolean }> => {
    const nextStatus = !currentStatus;
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: smError } = await supabase
          .from('supermarkets')
          .update({ is_active: nextStatus })
          .eq('id', id);

        if (smError) {
          return { success: false, message: `خطا در تغییر وضعیت تایید فروشگاه: ${smError.message}`, newStatus: currentStatus };
        }
      }

      setSupermarkets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: nextStatus } : s))
      );

      const msg = nextStatus
        ? 'فروشگاه با موفقیت تایید شد و دسترسی ورود به سامانه برای آن فعال گردید.'
        : 'دسترسی فروشگاه به سامانه غیرفعال گردید.';

      return { success: true, message: msg, newStatus: nextStatus };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در تغییر وضعیت تایید';
      return { success: false, message: msg, newStatus: currentStatus };
    }
  }, [setSupermarkets]);

  // Reset Supermarket Password (defaults to 123456 as requested)
  const resetSupermarketPassword = useCallback(async (id: string, newPassword: string = '123456'): Promise<{ success: boolean; message: string }> => {
    try {
      const target = supermarkets.find((s) => s.id === id);
      if (!target) {
        return { success: false, message: 'مشتری مورد نظر یافت نشد.' };
      }

      if (!newPassword || newPassword.trim().length < MIN_PASSWORD_LENGTH) {
        return { success: false, message: `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.` };
      }

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.functions.invoke('create-staff-account', {
          body: {
            action: 'reset_password',
            userId: id,
            password: newPassword,
          },
        });

        if (error || data?.success === false) {
          const errMsg = data?.error || (await getFunctionErrorMessage(error, 'خطا در بازنشانی رمز عبور در سرور.'));
          return {
            success: false,
            message: errMsg,
          };
        }
      }

      return {
        success: true,
        message: `رمز عبور فروشگاه «${target.name}» با موفقیت به ${newPassword} تغییر یافت.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در بازیابی رمز عبور';
      return { success: false, message: msg };
    }
  }, [supermarkets]);

  // Update Visitor information
  const updateVisitor = useCallback(async (id: string, payload: UpdateVisitorPayload): Promise<{ success: boolean; message: string }> => {
    try {
      let normalizedPhone: string | undefined = undefined;
      if (payload.phone !== undefined) {
        normalizedPhone = normalizePhone(payload.phone);
        if (!isValidMobile(normalizedPhone)) {
          return { success: false, message: 'شماره موبایل معتبر وارد کنید' };
        }
        // Check uniqueness in local state
        const phoneExistsInState =
          visitors.some((v) => v.id !== id && normalizePhone(v.phone) === normalizedPhone) ||
          supermarkets.some((s) => s.id !== id && normalizePhone(s.phone) === normalizedPhone);
        if (phoneExistsInState) {
          return { success: false, message: 'این شماره تماس قبلاً برای حساب دیگری ثبت شده است.' };
        }
      }

      if (isSupabaseConfigured && supabase) {
        if (normalizedPhone) {
          const { data: dupProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', normalizedPhone)
            .neq('id', id)
            .maybeSingle();

          if (dupProfile) {
            return { success: false, message: 'این شماره تماس قبلاً برای حساب دیگری ثبت شده است.' };
          }
        }

        const updateData: Record<string, unknown> = {};
        if (payload.name !== undefined) updateData.name = payload.name.trim();
        if (normalizedPhone !== undefined) updateData.phone = normalizedPhone;
        if (payload.region !== undefined) updateData.region = payload.region.trim();
        if (payload.is_active !== undefined) updateData.is_active = payload.is_active;
        // NOTE: As per requirement 6, do NOT update username column on phone change!

        if (Object.keys(updateData).length > 0) {
          const { error: visError } = await supabase
            .from('visitors')
            .update(updateData)
            .eq('id', id);

          if (visError) {
            console.warn('Supabase visitor update warning:', visError.message);
          }

          const profileUpdates: Record<string, unknown> = {};
          if (payload.name) profileUpdates.name = payload.name.trim();
          if (normalizedPhone) profileUpdates.phone = normalizedPhone;

          if (Object.keys(profileUpdates).length > 0) {
            await supabase
              .from('profiles')
              .update(profileUpdates)
              .eq('id', id);
          }
        }
      }

      setVisitors((prev) =>
        prev.map((v) => {
          if (v.id !== id) return v;
          return {
            ...v,
            name: payload.name !== undefined ? payload.name.trim() : v.name,
            phone: normalizedPhone !== undefined ? normalizedPhone : v.phone,
            region: payload.region !== undefined ? payload.region.trim() : v.region,
            is_active: payload.is_active !== undefined ? payload.is_active : v.is_active,
          };
        })
      );

      return { success: true, message: 'مشخصات ویزیتور با موفقیت بروزرسانی شد.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ویرایش ویزیتور';
      return { success: false, message: msg };
    }
  }, [visitors, supermarkets, setVisitors]);

  // Delete Visitor
  const deleteVisitor = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Record tombstone immediately
      addDeletedId(STORAGE_KEYS.DELETED_VISITOR_IDS, id);

      if (isSupabaseConfigured && supabase) {
        // Call edge function delete_account to delete Auth user, unbind foreign keys, delete visitor and profile
        const { data: delData, error: delError } = await supabase.functions.invoke(
          'create-staff-account',
          {
            body: {
              action: 'delete_account',
              userId: id,
            },
          }
        );

        if (delError || delData?.success === false) {
          const errMsg = delData?.error || (await getFunctionErrorMessage(delError, 'خطا در حذف حساب کاربری ویزیتور از سرور.'));
          return {
            success: false,
            message: errMsg,
          };
        }
      }

      setVisitors((prev) => {
        const next = prev.filter((v) => v.id !== id);
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // Update supermarkets: set assigned_visitor_id to 'direct'
      setSupermarkets((prev) => {
        const next = prev.map((s) => (s.assigned_visitor_id === id ? { ...s, assigned_visitor_id: 'direct' } : s));
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.SUPERMARKETS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // Update orders: set assigned_visitor_id to null and visitor_name to central direct
      orders.setOrders((prev) => {
        const next = prev.map((o) =>
          o.assigned_visitor_id === id
            ? { ...o, assigned_visitor_id: null, visitor_name: 'پخش مرکزی (مستقیم)' }
            : o
        );
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      return { success: true, message: 'ویزیتور با موفقیت حذف گردید.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در حذف ویزیتور';
      return { success: false, message: msg };
    }
  }, [setVisitors, setSupermarkets, orders]);

  // Reset Visitor Password (defaults to 123456 as requested)
  const resetVisitorPassword = useCallback(async (id: string, newPassword: string = '123456'): Promise<{ success: boolean; message: string }> => {
    try {
      const target = visitors.find((v) => v.id === id);
      if (!target) {
        return { success: false, message: 'ویزیتور مورد نظر یافت نشد.' };
      }

      if (!newPassword || newPassword.trim().length < MIN_PASSWORD_LENGTH) {
        return { success: false, message: `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.` };
      }

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.functions.invoke('create-staff-account', {
          body: {
            action: 'reset_password',
            userId: id,
            password: newPassword,
          },
        });

        if (error || data?.success === false) {
          const errMsg = data?.error || (await getFunctionErrorMessage(error, 'خطا در بازنشانی رمز عبور در سرور.'));
          return {
            success: false,
            message: errMsg,
          };
        }
      }

      return {
        success: true,
        message: `رمز عبور ویزیتور «${target.name}» با موفقیت به ${newPassword} تغییر یافت.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در بازیابی رمز عبور';
      return { success: false, message: msg };
    }
  }, [visitors]);

  // Wrapper to invoke create-staff-account Edge Function
  const createStaffAccount = useCallback(async (payload: CreateStaffAccountPayload): Promise<CreateStaffAccountResult> => {
    const createdVisitorId = generateUniqueId('vis');
    const cleanPhone = normalizePhone(payload.phone);
    const cleanName = payload.name.trim();
    const cleanRegion = (payload.region || 'مرکز استان').trim();
    const cleanPassword = normalizeDigits(payload.password.trim());
    const cleanUsername = cleanPhone;

    if (!cleanPhone || !isValidMobile(cleanPhone)) {
      return { success: false, error: 'شماره موبایل معتبر وارد کنید' };
    }

    if (!cleanPassword || cleanPassword.length < MIN_PASSWORD_LENGTH) {
      return { success: false, error: `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.` };
    }

    // Check uniqueness in local state
    const phoneExistsInState =
      visitors.some((v) => normalizePhone(v.phone) === cleanPhone) ||
      supermarkets.some((s) => normalizePhone(s.phone) === cleanPhone);

    if (phoneExistsInState) {
      return { success: false, error: 'این شماره قبلاً ثبت شده است.' };
    }

    if (!isSupabaseConfigured || !supabase) {
      if (payload.role === 'visitor') {
        const newVis: Visitor = {
          id: createdVisitorId,
          name: cleanName,
          phone: cleanPhone,
          region: cleanRegion,
          username: cleanUsername,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setVisitors((prev) => [...prev, newVis]);
      }
      return {
        success: true,
        username: cleanUsername,
        role: payload.role,
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-staff-account', {
        body: {
          action: 'create_staff',
          name: cleanName,
          phone: cleanPhone,
          role: payload.role,
          region: cleanRegion,
          password: cleanPassword,
        },
      });

      if (error || data?.success === false) {
        const errMsg = data?.error || (await getFunctionErrorMessage(error, 'خطا در ثبت کاربر پرسنل.'));
        return {
          success: false,
          error: errMsg,
        };
      }

      const finalUserId = data?.userId || createdVisitorId;

      if (payload.role === 'visitor') {
        const newVis: Visitor = {
          id: finalUserId,
          name: cleanName,
          phone: cleanPhone,
          region: cleanRegion,
          username: cleanUsername,
          is_active: true,
          created_at: new Date().toISOString(),
        };

        setVisitors((prev) => {
          const exists = prev.some(
            (v) => v.id === finalUserId || normalizePhone(v.phone) === cleanPhone
          );
          return exists
            ? prev.map((v) =>
                v.id === finalUserId || normalizePhone(v.phone) === cleanPhone
                  ? { ...v, ...newVis }
                  : v
              )
            : [...prev, newVis];
        });
      }

      return {
        success: true,
        username: cleanUsername,
        role: payload.role,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ساخت حساب';
      return { success: false, error: msg };
    }
  }, [visitors, supermarkets, setVisitors]);

  // Direct Assignment / Reassignment by Admin
  const assignOrderVisitor = useCallback(
    (
      orderId: string,
      targetVisitorId: string | 'direct',
      updateCustomerPermanent: boolean = false
    ) => {
      const res = orders.assignOrderVisitor(orderId, targetVisitorId, auth.currentUser.name);
      if (res.success && updateCustomerPermanent) {
        const ord = orders.orders.find((o) => o.id === orderId);
        if (ord && ord.supermarket_id) {
          const currentSm = supermarkets.find((s) => s.id === ord.supermarket_id);
          if (currentSm) {
            updateSupermarket(currentSm.id, {
              assigned_visitor_id: targetVisitorId,
            }).catch(() => {});
          }
        }
      }
      return res;
    },
    [orders, auth.currentUser.name, supermarkets, updateSupermarket]
  );

  // Invoice Settings state with localStorage fallback
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_setting_invoice_settings');
      if (saved) {
        try {
          return getInvoiceSettings(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
    return DEFAULT_INVOICE_SETTINGS;
  });

  // Keep PWA icons, favicon, Apple Touch Icon, and dynamic Web App Manifest in sync with logo_url
  useEffect(() => {
    syncPwaIconsAndManifest(invoiceSettings?.logo_url);
  }, [invoiceSettings?.logo_url]);

  // Admin & Central Distributor Profile state with localStorage fallback
  const [adminProfile, setAdminProfile] = useState<AdminProfile>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('barfroosh_admin_profile');
      if (saved) {
        try {
          return { ...DEFAULT_ADMIN_PROFILE, ...JSON.parse(saved) };
        } catch {
          // ignore
        }
      }
    }
    return DEFAULT_ADMIN_PROFILE;
  });

  // Catalog Product Order per Brand with localStorage fallback
  const [productOrderMap, setProductOrderMap] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('barfroosh_product_order');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch {}
      }
    }
    return {};
  });

  // Load invoice_settings & admin_profile from Supabase app_settings on startup & on data refresh
  useEffect(() => {
    let isMounted = true;
    const fetchInvoiceSettings = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'invoice_settings')
            .maybeSingle();

          if (!error && data && data.value && isMounted) {
            const parsed = getInvoiceSettings(data.value);
            setInvoiceSettings(parsed);
            if (typeof window !== 'undefined') {
              localStorage.setItem('app_setting_invoice_settings', JSON.stringify(parsed));
            }
          }

          // Fetch admin_profile
          const { data: adminProfData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'admin_profile')
            .maybeSingle();

          if (adminProfData && adminProfData.value && isMounted) {
            const parsed = { ...DEFAULT_ADMIN_PROFILE, ...(adminProfData.value as object) };
            setAdminProfile(parsed);
            if (typeof window !== 'undefined') {
              localStorage.setItem('barfroosh_admin_profile', JSON.stringify(parsed));
            }
          }

          // Fetch catalog_brand_order
          const { data: brandOrderData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'catalog_brand_order')
            .maybeSingle();

          if (brandOrderData && Array.isArray(brandOrderData.value) && isMounted) {
            const savedOrder = brandOrderData.value as string[];
            catalog.setBrands((prev) => {
              const sorted = [...prev].sort((a, b) => {
                const idxA = savedOrder.indexOf(a);
                const idxB = savedOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b, 'fa');
              });
              return sorted;
            });
          }

          // Fetch catalog_product_order
          const { data: prodOrderData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'catalog_product_order')
            .maybeSingle();

          if (prodOrderData && prodOrderData.value && typeof prodOrderData.value === 'object' && isMounted) {
            setProductOrderMap(prodOrderData.value as Record<string, string[]>);
            if (typeof window !== 'undefined') {
              localStorage.setItem('barfroosh_product_order', JSON.stringify(prodOrderData.value));
            }
          }
        } catch (err) {
          console.warn('Error fetching invoice_settings from app_settings:', err);
        }
      }
    };

    fetchInvoiceSettings();
    return () => {
      isMounted = false;
    };
  }, [reloadCounter]);

  // Update catalog brand order (admin action)
  const updateBrandOrder = useCallback(
    async (orderedBrands: string[]): Promise<{ success: boolean; message: string }> => {
      try {
        catalog.setBrands(orderedBrands);
        if (typeof window !== 'undefined') {
          localStorage.setItem('alborz_brands_v2', JSON.stringify(orderedBrands));
        }

        if (isSupabaseConfigured && supabase) {
          // 1. Try SECURITY DEFINER RPC first if provisioned
          const { error: rpcErr } = await supabase.rpc('set_catalog_brand_order', {
            p_brands: orderedBrands,
          });

          if (rpcErr) {
            // 2. Fallback to direct app_settings upsert
            const { error: upsertErr } = await supabase
              .from('app_settings')
              .upsert({ key: 'catalog_brand_order', value: orderedBrands }, { onConflict: 'key' });
            if (upsertErr) {
              console.error('Error saving brand order to app_settings:', upsertErr);
              return { success: false, message: 'خطا در ذخیره ترتیب برندها در سرور' };
            }
          }
        }
        return { success: true, message: 'ترتیب نمایش برندها در کاتالوگ با موفقیت ذخیره شد.' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ذخیره ترتیب برندها';
        return { success: false, message: msg };
      }
    },
    [catalog]
  );

  // Update catalog product order within a brand (admin action)
  const updateProductOrder = useCallback(
    async (brandName: string, orderedProductIds: string[]): Promise<{ success: boolean; message: string }> => {
      try {
        const cleanBrand = (brandName || 'متفرقه').trim();
        const updated: Record<string, string[]> = {
          ...productOrderMap,
          [cleanBrand]: orderedProductIds,
        };

        setProductOrderMap(updated);
        if (typeof window !== 'undefined') {
          localStorage.setItem('barfroosh_product_order', JSON.stringify(updated));
        }

        if (isSupabaseConfigured && supabase) {
          const { error: upsertErr } = await supabase
            .from('app_settings')
            .upsert({ key: 'catalog_product_order', value: updated }, { onConflict: 'key' });
          if (upsertErr) {
            console.error('Error saving product order to app_settings:', upsertErr);
            return { success: false, message: 'خطا در ذخیره ترتیب کالاها در سرور' };
          }
        }
        return { success: true, message: `ترتیب کالاهای برند «${cleanBrand}» با موفقیت ذخیره شد.` };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ذخیره ترتیب کالاها';
        return { success: false, message: msg };
      }
    },
    [productOrderMap]
  );

  // Update invoice settings (admin action via SECURITY DEFINER RPC with direct upsert fallback)
  const updateInvoiceSettings = useCallback(
    async (newSettings: InvoiceSettings): Promise<{ success: boolean; message: string }> => {
      try {
        if (isSupabaseConfigured && supabase) {
          // 1. Try SECURITY DEFINER RPC
          const { error: rpcErr } = await supabase.rpc('set_invoice_settings', {
            p_value: newSettings,
          });

          if (rpcErr) {
            console.warn('RPC set_invoice_settings failed, falling back to direct upsert:', rpcErr);
            // 2. Fallback to direct app_settings upsert (using only key & value)
            const { error: upsertErr } = await supabase
              .from('app_settings')
              .upsert({ key: 'invoice_settings', value: newSettings }, { onConflict: 'key' });

            if (upsertErr) {
              console.error('Error saving invoice settings to app_settings:', upsertErr);
              return {
                success: false,
                message: rpcErr.message || upsertErr.message || 'خطا در ذخیره‌سازی تنظیمات فاکتور در سرور',
              };
            }
          }
        }

        // Update local state and localStorage
        setInvoiceSettings(newSettings);
        if (typeof window !== 'undefined') {
          localStorage.setItem('app_setting_invoice_settings', JSON.stringify(newSettings));
        }

        return {
          success: true,
          message: 'تنظیمات فاکتور با موفقیت ذخیره شد.',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ذخیره تنظیمات';
        console.error('Exception in updateInvoiceSettings:', err);
        return {
          success: false,
          message: msg,
        };
      }
    },
    []
  );

  // Update admin & distributor profile (admin action)
  const updateAdminProfile = useCallback(
    async (newProfile: AdminProfile): Promise<{ success: boolean; message: string }> => {
      try {
        setAdminProfile(newProfile);
        if (typeof window !== 'undefined') {
          localStorage.setItem('barfroosh_admin_profile', JSON.stringify(newProfile));
        }

        if (isSupabaseConfigured && supabase) {
          // 1. Try SECURITY DEFINER RPC first if provisioned
          const { error: rpcErr } = await supabase.rpc('set_admin_profile', {
            p_value: newProfile,
          });

          if (rpcErr) {
            // 2. Fallback to direct app_settings upsert
            const { error: upsertErr } = await supabase
              .from('app_settings')
              .upsert({ key: 'admin_profile', value: newProfile }, { onConflict: 'key' });
            if (upsertErr) {
              console.error('Error saving admin profile to app_settings:', upsertErr);
              return { success: false, message: 'خطا در ذخیره مشخصات مدیر در سرور' };
            }
          }
        }

        return {
          success: true,
          message: 'مشخصات مدیریت و مرکز پخش با موفقیت ذخیره شد.',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ذخیره مشخصات مدیر';
        return { success: false, message: msg };
      }
    },
    []
  );

  // Memoized provider value so child components do not needlessly re-render
  const contextValue: AppContextType = useMemo(() => ({
    role: auth.role,
    setRole: auth.setRole,
    selectedVisitorId: auth.selectedVisitorId,
    setSelectedVisitorId: auth.setSelectedVisitorId,
    selectedSupermarketId: auth.selectedSupermarketId,
    setSelectedSupermarketId: auth.setSelectedSupermarketId,
    authReady: auth.authReady,
    isLoggedIn: auth.isLoggedIn,
    currentUser: auth.currentUser,
    loginWithCredentials: auth.loginWithCredentials,
    logout: auth.logout,
    invoiceSettings,
    updateInvoiceSettings,
    categories: catalog.categories,
    brands: catalog.brands,
    units: catalog.units,
    products: catalog.products,
    productLikes: catalog.productLikes,
    toggleProductLike: catalog.toggleProductLike,
    visitors,
    supermarkets,
    orders: orders.orders,
    reassignmentRequests: orders.reassignmentRequests,
    loadingBills: warehouse.loadingBills,
    inventoryTransactions: warehouse.inventoryTransactions,
    deleteInventoryTransactions: warehouse.deleteInventoryTransactions,
    priceHistories: catalog.priceHistories,
    createOrder: orders.createOrder,
    updateOrder: orders.updateOrder,
    updateOrderStatus: orders.updateOrderStatus,
    requestReassignment: orders.requestReassignment,
    respondToReassignment: orders.respondToReassignment,
    assignOrderVisitor,
    deleteOrder: orders.deleteOrder,
    createLoadingBill: warehouse.createLoadingBill,
    approveLoadingBill: warehouse.approveLoadingBill,
    cancelLoadingBill: warehouse.cancelLoadingBill,
    updateProductPrice: catalog.updateProductPrice,
    updateProduct: catalog.updateProduct,
    updateProductStock: warehouse.updateProductStock,
    recordProductReturn: warehouse.recordProductReturn,
    addNewProduct: catalog.addNewProduct,
    bulkUpsertProducts: catalog.bulkUpsertProducts,
    deleteProduct: catalog.deleteProduct,
    bulkDeleteProducts: catalog.bulkDeleteProducts,
    bulkUpdateProducts: catalog.bulkUpdateProducts,
    addCategory: catalog.addCategory,
    updateCategory: catalog.updateCategory,
    deleteCategory: catalog.deleteCategory,
    addBrand: catalog.addBrand,
    updateBrand: catalog.updateBrand,
    deleteBrand: catalog.deleteBrand,
    updateBrandOrder,
    productOrderMap,
    updateProductOrder,
    addUnit: catalog.addUnit,
    updateUnit: catalog.updateUnit,
    deleteUnit: catalog.deleteUnit,
    registerSupermarket: auth.registerSupermarket,
    updateSupermarket,
    deleteSupermarket,
    toggleSupermarketApproval,
    resetSupermarketPassword,
    updateVisitor,
    deleteVisitor,
    resetVisitorPassword,
    createStaffAccount,
    resetToDefaults,
    isOnlineDb: isSupabaseConfigured,
    isDataReady,
    fetchError,
    retryFetch,
    refreshData,
    theme,
    toggleTheme,
    showToast,
    adminProfile,
    updateAdminProfile,
    financialAccounts: financial.accounts,
    accountTransactions: financial.transactions,
    cheques: financial.cheques,
    paymentAllocations: financial.allocations,
    isFinancialLoading: financial.isLoading,
    activateFinancialAccount: financial.activateAccount,
    deactivateFinancialAccount: financial.deactivateAccount,
    recordFinancialPayment: financial.recordPayment,
    updateChequeStatus: financial.updateChequeStatus,
    manualFinancialEntry: financial.manualFinancialEntry,
    getAccountSummary: financial.getAccountSummary,
    getInvoiceSettlementStatus: financial.getInvoiceSettlementStatus,
  }), [
    auth.role,
    auth.setRole,
    auth.selectedVisitorId,
    auth.setSelectedVisitorId,
    auth.selectedSupermarketId,
    auth.setSelectedSupermarketId,
    auth.isLoggedIn,
    auth.currentUser,
    auth.loginWithCredentials,
    auth.logout,
    auth.registerSupermarket,
    updateSupermarket,
    deleteSupermarket,
    toggleSupermarketApproval,
    resetSupermarketPassword,
    updateVisitor,
    deleteVisitor,
    resetVisitorPassword,
    createStaffAccount,
    isDataReady,
    fetchError,
    retryFetch,
    refreshData,
    catalog.categories,
    catalog.brands,
    catalog.units,
    catalog.products,
    catalog.productLikes,
    catalog.toggleProductLike,
    catalog.priceHistories,
    catalog.updateProductPrice,
    catalog.addNewProduct,
    catalog.bulkUpsertProducts,
    catalog.deleteProduct,
    catalog.bulkDeleteProducts,
    catalog.bulkUpdateProducts,
    catalog.addCategory,
    catalog.updateCategory,
    catalog.deleteCategory,
    catalog.addBrand,
    catalog.updateBrand,
    catalog.deleteBrand,
    updateBrandOrder,
    productOrderMap,
    updateProductOrder,
    catalog.addUnit,
    catalog.updateUnit,
    catalog.deleteUnit,
    visitors,
    supermarkets,
    orders.orders,
    orders.reassignmentRequests,
    orders.createOrder,
    orders.updateOrder,
    orders.updateOrderStatus,
    orders.requestReassignment,
    orders.respondToReassignment,
    assignOrderVisitor,
    orders.deleteOrder,
    warehouse.loadingBills,
    warehouse.inventoryTransactions,
    warehouse.deleteInventoryTransactions,
    warehouse.createLoadingBill,
    warehouse.approveLoadingBill,
    warehouse.cancelLoadingBill,
    warehouse.updateProductStock,
    warehouse.recordProductReturn,
    resetToDefaults,
    theme,
    toggleTheme,
    showToast,
    invoiceSettings,
    updateInvoiceSettings,
    adminProfile,
    updateAdminProfile,
    financial.accounts,
    financial.transactions,
    financial.cheques,
    financial.allocations,
    financial.isLoading,
    financial.activateAccount,
    financial.deactivateAccount,
    financial.recordPayment,
    financial.updateChequeStatus,
    financial.manualFinancialEntry,
    financial.getAccountSummary,
    financial.getInvoiceSettlementStatus,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}

      {/* Real-time Global Toast Notification Banner */}
      {globalToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
          <div
            className={`p-3.5 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 backdrop-blur-xl ${
              globalToast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
                : globalToast.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/50 text-rose-200'
                : globalToast.type === 'warning'
                ? 'bg-amber-950/95 border-amber-500/50 text-amber-200'
                : 'bg-slate-900/95 border-blue-500/50 text-blue-200'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {globalToast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : globalToast.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              ) : globalToast.type === 'warning' ? (
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              ) : (
                <Bell className="w-5 h-5 text-blue-400 shrink-0 animate-bounce" />
              )}
              <span className="text-xs sm:text-sm font-bold truncate">
                {globalToast.message}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalToast(null)}
              className="p-1 rounded-lg hover:bg-white/10 transition cursor-pointer text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
