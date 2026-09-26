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

  createOrder: (payload: CreateOrderPayload) => { success: boolean; message: string; orderId?: string };
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  requestReassignment: (orderId: string, toVisitorId: string | null) => void;
  respondToReassignment: (requestId: string, accept: boolean) => void;
  createLoadingBill: (visitorId: string, orderIds: string[]) => void;
  approveLoadingBill: (billId: string) => void;
  updateProductPrice: (productId: string, newPrice: number) => void;
  updateProductStock: (productId: string, additionalStock: number) => void;
  addNewProduct: (product: Omit<Product, 'id' | 'reserved_stock'>) => void;
  deleteProduct: (productId: string) => { success: boolean; message: string };
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

  // Visitors & Supermarkets
  const [visitors] = useState<Visitor[]>(INITIAL_VISITORS);

  const [supermarkets, setSupermarkets] = useState<Supermarket[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUPERMARKETS);
    return saved ? JSON.parse(saved) : INITIAL_SUPERMARKETS;
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

  // Thin wrapper to invoke create-staff-account Edge Function
  const createStaffAccount = useCallback(async (payload: CreateStaffAccountPayload): Promise<CreateStaffAccountResult> => {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'اتصال به پایگاه داده سوپابیس برقرار نیست. لطفاً متغیرهای محیطی را بررسی کنید.',
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

      return {
        success: true,
        username: data?.username || payload.username,
        role: data?.role || payload.role,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در برقراری ارتباط با سرور';
      return { success: false, error: msg };
    }
  }, []);

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
    deleteProduct: catalog.deleteProduct,
    addCategory: catalog.addCategory,
    updateCategory: catalog.updateCategory,
    deleteCategory: catalog.deleteCategory,
    addBrand: catalog.addBrand,
    updateBrand: catalog.updateBrand,
    deleteBrand: catalog.deleteBrand,
    registerSupermarket: auth.registerSupermarket,
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
    createStaffAccount,
    catalog.categories,
    catalog.brands,
    catalog.products,
    catalog.priceHistories,
    catalog.updateProductPrice,
    catalog.addNewProduct,
    catalog.deleteProduct,
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
