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
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { STORAGE_KEYS, generateUniqueId, toSyntheticEmail, addDeletedId } from './utils';
import { useAuth } from './hooks/useAuth';
import { useCatalog } from './hooks/useCatalog';
import { useWarehouse } from './hooks/useWarehouse';
import { useOrders, CreateOrderPayload } from './hooks/useOrders';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { CheckCircle2, AlertTriangle, Info, X, Bell } from 'lucide-react';

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

  isLoggedIn: boolean;
  currentUser: CurrentUser;
  login: (profileId: string) => void;
  loginWithCredentials: (username: string, password: string, allowedRoles?: UserRole[]) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;

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
  createOrder: (payload: CreateOrderPayload) => { success: boolean; message: string; orderId?: string; order?: Order };
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
    stock?: number;
    unit?: string;
    is_active?: boolean;
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
  addUnit: (name: string) => { success: boolean; message: string };
  updateUnit: (oldUnitName: string, newUnitName: string) => { success: boolean; message: string };
  deleteUnit: (unitName: string) => { success: boolean; message: string };
  registerSupermarket: (data: {
    name: string;
    owner: string;
    phone: string;
    address: string;
    assigned_visitor_id: string;
    username: string;
    password: string;
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
  theme: 'dark' | 'light';
  toggleTheme: () => void;
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

  // Global Toast notification system
  const [globalToast, setGlobalToast] = useState<{
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  } | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setGlobalToast({ message, type });
    setTimeout(() => {
      setGlobalToast((curr) => (curr?.message === message ? null : curr));
    }, 5000);
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
      if (isSupabaseConfigured && supabase) {
        // If assigned_visitor_id is specified and not 'direct'/'', verify it exists in visitors list
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

        const updateData: Record<string, unknown> = {
          name: payload.name.trim(),
          owner: payload.owner.trim(),
          phone: payload.phone.trim(),
          address: payload.address.trim(),
          assigned_visitor_id: validVisitorId,
          is_active: payload.is_active,
        };
        if (payload.username) {
          updateData.username = payload.username.trim();
        }

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

        // Also update profiles table phone, name, and username
        await supabase
          .from('profiles')
          .update({
            name: payload.name.trim(),
            phone: payload.phone.trim(),
            ...(payload.username && { username: payload.username.trim() }),
          })
          .eq('id', id);
      }

      // Update supermarkets in local state only after server confirmation (or offline mode)
      setSupermarkets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...payload, assigned_visitor_id: payload.assigned_visitor_id || 'direct' } : s))
      );

      return { success: true, message: 'مشخصات فروشگاه با موفقیت ویرایش شد.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ویرایش مشتری';
      return { success: false, message: msg };
    }
  }, [visitors, setSupermarkets]);

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
        // Unlink supermarket_id from orders so foreign key constraint does not block supermarket deletion
        // Historical invoices maintain their items and snapshot of supermarket_name
        const { error: orderUnlinkErr } = await supabase
          .from('orders')
          .update({ supermarket_id: null })
          .eq('supermarket_id', id);

        if (orderUnlinkErr) {
          return { success: false, message: `خطا در آزادسازی سوابق سفارش‌های فروشگاه: ${orderUnlinkErr.message}` };
        }

        // Delete from supermarkets table
        const { error: smError } = await supabase
          .from('supermarkets')
          .delete()
          .eq('id', id);

        if (smError) {
          return { success: false, message: `خطا در حذف فروشگاه از سرور: ${smError.message}` };
        }

        // Delete from profiles table
        const { error: profError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);

        if (profError) {
          console.warn('Profile delete warning on Supabase:', profError.message);
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

      setSupermarkets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, password: newPassword } : s))
      );

      if (isSupabaseConfigured && supabase) {
        // 1. Update profiles table with the new password
        await supabase
          .from('profiles')
          .update({ password: newPassword })
          .eq('id', id);

        // 2. Update supermarkets table with the new password
        await supabase
          .from('supermarkets')
          .update({ password: newPassword })
          .eq('id', id);

        // 3. Try to invoke edge function to update Supabase Auth user password if available
        try {
          await supabase.functions.invoke('create-staff-account', {
            body: {
              action: 'reset_password',
              userId: id,
              username: target.username,
              password: newPassword,
            },
          });
        } catch (fnErr) {
          console.warn('Supabase password reset function invocation note:', fnErr);
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
  }, [supermarkets, setSupermarkets]);

  // Update Visitor information
  const updateVisitor = useCallback(async (id: string, payload: UpdateVisitorPayload): Promise<{ success: boolean; message: string }> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const updateData: Record<string, unknown> = {};
        if (payload.name !== undefined) updateData.name = payload.name.trim();
        if (payload.phone !== undefined) updateData.phone = payload.phone.trim();
        if (payload.region !== undefined) updateData.region = payload.region.trim();
        if (payload.username !== undefined) updateData.username = payload.username.trim();
        if (payload.is_active !== undefined) updateData.is_active = payload.is_active;
        if (payload.password !== undefined) updateData.password = payload.password;

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
          if (payload.phone) profileUpdates.phone = payload.phone.trim();
          if (payload.username) profileUpdates.username = payload.username.trim();
          if (payload.password) profileUpdates.password = payload.password;

          if (Object.keys(profileUpdates).length > 0) {
            await supabase
              .from('profiles')
              .update(profileUpdates)
              .eq('id', id);
          }
        }
      }

      setVisitors((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...payload } : v))
      );

      return { success: true, message: 'مشخصات ویزیتور با موفقیت بروزرسانی شد.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ویرایش ویزیتور';
      return { success: false, message: msg };
    }
  }, [setVisitors]);

  // Delete Visitor
  const deleteVisitor = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Record tombstone immediately
      addDeletedId(STORAGE_KEYS.DELETED_VISITOR_IDS, id);

      if (isSupabaseConfigured && supabase) {
        // Unlink assigned_visitor_id in supermarkets and orders to prevent FK constraint failure
        const { error: smUnlinkErr } = await supabase.from('supermarkets').update({ assigned_visitor_id: null }).eq('assigned_visitor_id', id);
        if (smUnlinkErr) {
          return { success: false, message: `خطا در آزادسازی فروشگاه‌های تحت پوشش ویزیتور: ${smUnlinkErr.message}` };
        }

        const { error: ordUnlinkErr } = await supabase.from('orders').update({ assigned_visitor_id: null }).eq('assigned_visitor_id', id);
        if (ordUnlinkErr) {
          return { success: false, message: `خطا در آزادسازی سفارش‌های تحت پوشش ویزیتور: ${ordUnlinkErr.message}` };
        }

        // Unlink in loading_bills
        await supabase.from('loading_bills').update({ visitor_id: null }).eq('visitor_id', id);

        // Unlink in order_visitor_history
        await supabase.from('order_visitor_history').update({ new_visitor_id: null }).eq('new_visitor_id', id);
        await supabase.from('order_visitor_history').update({ old_visitor_id: null }).eq('old_visitor_id', id);

        // Clean up or unlink reassignment requests
        await supabase.from('reassignment_requests').delete().or(`from_visitor_id.eq.${id},to_visitor_id.eq.${id}`);

        // Delete from visitors table
        const { error: visError } = await supabase.from('visitors').delete().eq('id', id);
        if (visError) {
          return { success: false, message: `خطا در حذف ویزیتور از سرور: ${visError.message}` };
        }

        // Delete profile
        const { error: profError } = await supabase.from('profiles').delete().eq('id', id);
        if (profError) {
          console.warn('Profile delete warning:', profError.message);
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

      setVisitors((prev) =>
        prev.map((v) => (v.id === id ? { ...v, password: newPassword } : v))
      );

      if (isSupabaseConfigured && supabase) {
        // 1. Update profiles table with new password
        await supabase
          .from('profiles')
          .update({ password: newPassword })
          .eq('id', id);

        // 2. Update visitors table with new password
        await supabase
          .from('visitors')
          .update({ password: newPassword })
          .eq('id', id);

        // 3. Try edge function if available
        try {
          await supabase.functions.invoke('create-staff-account', {
            body: {
              action: 'reset_password',
              userId: id,
              username: target.username,
              password: newPassword,
            },
          });
        } catch (fnErr) {
          console.warn('Supabase password reset function invocation note:', fnErr);
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
  }, [visitors, setVisitors]);

  // Thin wrapper to invoke create-staff-account Edge Function
  const createStaffAccount = useCallback(async (payload: CreateStaffAccountPayload): Promise<CreateStaffAccountResult> => {
    const createdVisitorId = generateUniqueId('vis');
    const cleanUsername = payload.username.trim().toLowerCase();
    const cleanName = payload.name.trim();
    const cleanPhone = payload.phone.trim();
    const cleanRegion = (payload.region || 'مرکز استان').trim();

    if (!isSupabaseConfigured) {
      if (payload.role === 'visitor') {
        const newVis: Visitor = {
          id: createdVisitorId,
          name: cleanName,
          phone: cleanPhone,
          region: cleanRegion,
          username: cleanUsername,
          password: payload.password,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setVisitors((prev) => {
          const next = [...prev, newVis];
          try {
            localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      return {
        success: true,
        username: cleanUsername,
        role: payload.role,
      };
    }

    try {
      let finalUserId = createdVisitorId;

      // 1. Try invoking Edge Function if available
      try {
        const { data, error } = await supabase.functions.invoke('create-staff-account', {
          body: payload,
        });

        if (!error && data?.success !== false) {
          if (data?.userId || data?.id) {
            finalUserId = data.userId || data.id;
          }
        }
      } catch (edgeErr) {
        console.warn('Edge function invoke skipped or failed, using direct table fallback:', edgeErr);
      }

      // 2. Direct table upsert in Supabase to guarantee credentials exist in profiles & visitors tables
      await supabase.from('profiles').upsert({
        id: finalUserId,
        name: cleanName,
        phone: cleanPhone,
        role: payload.role,
        username: cleanUsername,
        password: payload.password,
      });

      if (payload.role === 'visitor') {
        const newVis: Visitor = {
          id: finalUserId,
          name: cleanName,
          phone: cleanPhone,
          region: cleanRegion,
          username: cleanUsername,
          password: payload.password,
          is_active: true,
          created_at: new Date().toISOString(),
        };

        await supabase.from('visitors').upsert({
          id: finalUserId,
          name: cleanName,
          phone: cleanPhone,
          region: cleanRegion,
          username: cleanUsername,
          password: payload.password,
          is_active: true,
        });

        setVisitors((prev) => {
          const exists = prev.some(
            (v) => v.id === finalUserId || (v.username && v.username.toLowerCase() === cleanUsername)
          );
          const next = exists
            ? prev.map((v) =>
                v.id === finalUserId || (v.username && v.username.toLowerCase() === cleanUsername)
                  ? { ...v, ...newVis }
                  : v
              )
            : [...prev, newVis];

          try {
            localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(next));
          } catch {}
          return next;
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
  }, [setVisitors]);

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
              name: currentSm.name,
              owner: currentSm.owner,
              phone: currentSm.phone,
              address: currentSm.address,
              assigned_visitor_id: targetVisitorId,
              is_active: currentSm.is_active ?? true,
            }).catch(() => {});
          }
        }
      }
      return res;
    },
    [orders, auth.currentUser.name, supermarkets, updateSupermarket]
  );

  // Memoized provider value so child components do not needlessly re-render
  const contextValue: AppContextType = useMemo(() => ({
    role: auth.role,
    setRole: auth.setRole,
    selectedVisitorId: auth.selectedVisitorId,
    setSelectedVisitorId: auth.setSelectedVisitorId,
    selectedSupermarketId: auth.selectedSupermarketId,
    setSelectedSupermarketId: auth.setSelectedSupermarketId,
    isLoggedIn: auth.isLoggedIn,
    currentUser: auth.currentUser,
    login: auth.login,
    loginWithCredentials: auth.loginWithCredentials,
    logout: auth.logout,
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
    theme,
    toggleTheme,
    showToast,
  }), [
    auth.role,
    auth.setRole,
    auth.selectedVisitorId,
    auth.setSelectedVisitorId,
    auth.selectedSupermarketId,
    auth.setSelectedSupermarketId,
    auth.isLoggedIn,
    auth.currentUser,
    auth.login,
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
    catalog.addUnit,
    catalog.updateUnit,
    catalog.deleteUnit,
    visitors,
    supermarkets,
    orders.orders,
    orders.reassignmentRequests,
    orders.createOrder,
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
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
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
