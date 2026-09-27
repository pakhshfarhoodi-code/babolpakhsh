import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserRole,
  CurrentUser,
  Product,
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
import { STORAGE_KEYS, generateUniqueId, toSyntheticEmail } from './utils';
import { useAuth } from './hooks/useAuth';
import { useCatalog } from './hooks/useCatalog';
import { useWarehouse } from './hooks/useWarehouse';
import { useOrders, CreateOrderPayload } from './hooks/useOrders';
import { useSupabaseSync } from './hooks/useSupabaseSync';

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

  categories: Category[];
  brands: string[];
  products: Product[];
  visitors: Visitor[];
  supermarkets: Supermarket[];
  orders: Order[];
  reassignmentRequests: ReassignmentRequest[];
  loadingBills: LoadingBill[];
  inventoryTransactions: InventoryTransaction[];
  priceHistories: ProductPriceHistory[];

  createOrder: (payload: CreateOrderPayload) => { success: boolean; message: string; orderId?: string; order?: Order };
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  requestReassignment: (orderId: string, toVisitorId: string | null) => void;
  respondToReassignment: (requestId: string, accept: boolean) => void;
  createLoadingBill: (visitorId: string, orderIds: string[]) => void;
  approveLoadingBill: (billId: string) => void;
  updateProductPrice: (productId: string, newPrice: number, newVisitorPrice?: number) => void;
  updateProductStock: (productId: string, additionalStock: number) => void;
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
  deleteProduct: (productId: string) => { success: boolean; message: string };
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
  updateVisitor: (id: string, payload: UpdateVisitorPayload) => Promise<{ success: boolean; message: string }>;
  deleteVisitor: (id: string) => Promise<{ success: boolean; message: string }>;
  createStaffAccount: (payload: CreateStaffAccountPayload) => Promise<CreateStaffAccountResult>;
  resetToDefaults: () => void;
  isOnlineDb: boolean;
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
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'light') {
        document.documentElement.classList.add('theme-light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.remove('theme-light');
        document.documentElement.classList.add('dark');
      }
    }
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const DUMMY_VISITOR_IDS = new Set(['vis-1', 'vis-2', 'vis-3']);

  // Visitors & Supermarkets
  const [visitors, setVisitors] = useState<Visitor[]>(() => {
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
    localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(visitors));
  }, [visitors]);

  const DUMMY_SUPERMARKET_IDS = new Set(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']);

  const [supermarkets, setSupermarkets] = useState<Supermarket[]>(() => {
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
    localStorage.setItem(STORAGE_KEYS.SUPERMARKETS, JSON.stringify(supermarkets));
  }, [supermarkets]);

  // Hook 1: Authentication & User Management
  const auth = useAuth({
    visitors,
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

  // Hook 5: Supabase Realtime / Polling Sync
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
        const updateData: Record<string, unknown> = {
          name: payload.name.trim(),
          owner: payload.owner.trim(),
          phone: payload.phone.trim(),
          address: payload.address.trim(),
          assigned_visitor_id: payload.assigned_visitor_id,
          is_active: payload.is_active,
        };
        if (payload.username) {
          updateData.username = payload.username.trim();
        }

        const { error: smError } = await supabase
          .from('supermarkets')
          .update(updateData)
          .eq('id', id);

        if (smError) {
          return { success: false, message: `خطا در ویرایش سوپرمارکت در سرور: ${smError.message}` };
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

      setSupermarkets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...payload } : s))
      );

      return { success: true, message: 'مشخصات فروشگاه با موفقیت ویرایش شد.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ویرایش مشتری';
      return { success: false, message: msg };
    }
  }, [setSupermarkets]);

  // Delete Supermarket (both local and Supabase)
  const deleteSupermarket = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: smError } = await supabase
          .from('supermarkets')
          .delete()
          .eq('id', id);

        if (smError) {
          return { success: false, message: `خطا در حذف سوپرمارکت از پایگاه داده: ${smError.message}` };
        }

        // Also delete profile
        await supabase
          .from('profiles')
          .delete()
          .eq('id', id);
      }

      setSupermarkets((prev) => prev.filter((s) => s.id !== id));

      return { success: true, message: 'مشتری با موفقیت حذف گردید.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در حذف مشتری';
      return { success: false, message: msg };
    }
  }, [setSupermarkets]);

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

  // Update Visitor information
  const updateVisitor = useCallback(async (id: string, payload: UpdateVisitorPayload): Promise<{ success: boolean; message: string }> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const updateData: Record<string, unknown> = {};
        if (payload.name !== undefined) updateData.name = payload.name.trim();
        if (payload.phone !== undefined) updateData.phone = payload.phone.trim();
        if (payload.region !== undefined) updateData.region = payload.region.trim();
        if (payload.is_active !== undefined) updateData.is_active = payload.is_active;

        if (Object.keys(updateData).length > 0) {
          const { error: visError } = await supabase
            .from('visitors')
            .update(updateData)
            .eq('id', id);

          if (visError) {
            console.warn('Supabase visitor update warning:', visError.message);
          }

          if (payload.name || payload.phone) {
            await supabase
              .from('profiles')
              .update({
                ...(payload.name && { name: payload.name.trim() }),
                ...(payload.phone && { phone: payload.phone.trim() }),
              })
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
      if (isSupabaseConfigured && supabase) {
        const { error: visError } = await supabase.from('visitors').delete().eq('id', id);
        if (visError) {
          return { success: false, message: `خطا در حذف ویزیتور از دیتابیس: این ویزیتور دارای سفارش یا مشتری متصل است (${visError.message})` };
        }
        await supabase.from('profiles').delete().eq('id', id);
      }

      setVisitors((prev) => prev.filter((v) => v.id !== id));

      return { success: true, message: 'ویزیتور با موفقیت حذف گردید.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در حذف ویزیتور';
      return { success: false, message: msg };
    }
  }, [setVisitors]);

  // Thin wrapper to invoke create-staff-account Edge Function
  const createStaffAccount = useCallback(async (payload: CreateStaffAccountPayload): Promise<CreateStaffAccountResult> => {
    if (!isSupabaseConfigured) {
      if (payload.role === 'visitor') {
        const newVis: Visitor = {
          id: generateUniqueId('vis'),
          name: payload.name.trim(),
          phone: payload.phone.trim(),
          region: payload.region?.trim() || 'مرکز استان',
          username: payload.username.trim(),
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setVisitors((prev) => [...prev, newVis]);
      }
      return {
        success: true,
        username: payload.username,
        role: payload.role,
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-staff-account', {
        body: payload,
      });

      if (error) {
        let errorMessage = error.message || 'خطا در ارتباط با Edge Function';
        if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
          errorMessage = data.error;
        } else if ('context' in error && error.context && typeof error.context === 'object') {
          try {
            const errorBody = await (error.context as Response).json();
            if (errorBody?.error) errorMessage = errorBody.error;
          } catch {
            // ignore
          }
        }
        return { success: false, error: errorMessage };
      }

      if (data && data.success === false) {
        return { success: false, error: data.error || 'خطا در ایجاد حساب' };
      }

      if (payload.role === 'visitor') {
        const createdVisitorId = data?.userId || data?.id || generateUniqueId('vis');
        const newVis: Visitor = {
          id: createdVisitorId,
          name: payload.name.trim(),
          phone: payload.phone.trim(),
          region: payload.region?.trim() || 'مرکز استان',
          username: payload.username.trim(),
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setVisitors((prev) => {
          if (prev.some((v) => v.id === createdVisitorId || (v.username && v.username.toLowerCase() === newVis.username?.toLowerCase()))) {
            return prev.map((v) => (v.id === createdVisitorId || v.username === newVis.username ? { ...v, ...newVis } : v));
          }
          return [...prev, newVis];
        });
      }

      return {
        success: true,
        username: data?.username || payload.username,
        role: data?.role || payload.role,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در برقراری ارتباط با سرور';
      return { success: false, error: msg };
    }
  }, [setVisitors]);

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
    products: catalog.products,
    visitors,
    supermarkets,
    orders: orders.orders,
    reassignmentRequests: orders.reassignmentRequests,
    loadingBills: warehouse.loadingBills,
    inventoryTransactions: warehouse.inventoryTransactions,
    priceHistories: catalog.priceHistories,
    createOrder: orders.createOrder,
    updateOrderStatus: orders.updateOrderStatus,
    requestReassignment: orders.requestReassignment,
    respondToReassignment: orders.respondToReassignment,
    createLoadingBill: warehouse.createLoadingBill,
    approveLoadingBill: warehouse.approveLoadingBill,
    updateProductPrice: catalog.updateProductPrice,
    updateProductStock: warehouse.updateProductStock,
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
    registerSupermarket: auth.registerSupermarket,
    updateSupermarket,
    deleteSupermarket,
    toggleSupermarketApproval,
    updateVisitor,
    deleteVisitor,
    createStaffAccount,
    resetToDefaults,
    isOnlineDb: isSupabaseConfigured,
    theme,
    toggleTheme,
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
    updateVisitor,
    deleteVisitor,
    createStaffAccount,
    catalog.categories,
    catalog.brands,
    catalog.products,
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
    visitors,
    supermarkets,
    orders.orders,
    orders.reassignmentRequests,
    orders.createOrder,
    orders.updateOrderStatus,
    orders.requestReassignment,
    orders.respondToReassignment,
    warehouse.loadingBills,
    warehouse.inventoryTransactions,
    warehouse.createLoadingBill,
    warehouse.approveLoadingBill,
    warehouse.updateProductStock,
    resetToDefaults,
    theme,
    toggleTheme,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
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
