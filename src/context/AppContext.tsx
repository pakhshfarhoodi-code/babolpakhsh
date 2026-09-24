import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
  ProductPriceHistory
} from '../types';
import {
  INITIAL_PROFILES,
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

interface CreateOrderPayload {
  supermarketId: string;
  visitorId: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
}

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
  loginWithCredentials: (username: string, password: string, allowedRoles?: UserRole[]) => { success: boolean; message?: string };
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
    username?: string;
    password?: string;
  }) => { success: boolean; message: string; supermarket?: Supermarket };
  resetToDefaults: () => void;
  isOnlineDb: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CATEGORIES: 'alborz_categories_v2',
  BRANDS: 'alborz_brands_v2',
  PRODUCTS: 'alborz_products_v1',
  ORDERS: 'alborz_orders_v1',
  REASSIGNMENTS: 'alborz_reassignments_v1',
  LOADING_BILLS: 'alborz_loading_bills_v1',
  TRANSACTIONS: 'alborz_tx_v1',
  PRICE_HISTORIES: 'alborz_price_histories_v1',
  SUPERMARKETS: 'alborz_supermarkets_v1',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('alborz_auth_logged_in');
    return saved !== null ? saved === 'true' : true;
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alborz_theme');
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
    localStorage.setItem('alborz_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [role, setRole] = useState<UserRole>('admin');
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>('vis-1');
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string>('shop-1');

  useEffect(() => {
    localStorage.setItem('alborz_auth_logged_in', String(isLoggedIn));
  }, [isLoggedIn]);

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!saved) return INITIAL_CATEGORIES;
    try {
      const parsed: Category[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [brands, setBrands] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BRANDS);
    if (!saved) return INITIAL_BRANDS;
    try {
      const parsed: string[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return INITIAL_BRANDS;
    } catch {
      return INITIAL_BRANDS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(brands));
  }, [brands]);

  const [visitors] = useState<Visitor[]>(INITIAL_VISITORS);

  const [supermarkets, setSupermarkets] = useState<Supermarket[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUPERMARKETS);
    return saved ? JSON.parse(saved) : INITIAL_SUPERMARKETS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!saved) return INITIAL_PRODUCTS;
    try {
      const parsed: Product[] = JSON.parse(saved);
      // Merge with INITIAL_PRODUCTS to ensure any newly added categories/products and brand properties exist
      const existingIds = new Set(parsed.map((p) => p.id));
      const updatedExisting = parsed.map((p) => {
        const init = INITIAL_PRODUCTS.find((ip) => ip.id === p.id);
        return {
          ...p,
          brand: p.brand || init?.brand,
        };
      });
      const missingInitial = INITIAL_PRODUCTS.filter((ip) => !existingIds.has(ip.id));
      return [...updatedExisting, ...missingInitial];
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [reassignmentRequests, setReassignmentRequests] = useState<ReassignmentRequest[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REASSIGNMENTS);
    return saved ? JSON.parse(saved) : [];
  });

  const [loadingBills, setLoadingBills] = useState<LoadingBill[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOADING_BILLS);
    return saved ? JSON.parse(saved) : INITIAL_LOADING_BILLS;
  });

  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY_TRANSACTIONS;
  });

  const [priceHistories, setPriceHistories] = useState<ProductPriceHistory[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRICE_HISTORIES);
    return saved ? JSON.parse(saved) : [];
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REASSIGNMENTS, JSON.stringify(reassignmentRequests));
  }, [reassignmentRequests]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOADING_BILLS, JSON.stringify(loadingBills));
  }, [loadingBills]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(inventoryTransactions));
  }, [inventoryTransactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRICE_HISTORIES, JSON.stringify(priceHistories));
  }, [priceHistories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUPERMARKETS, JSON.stringify(supermarkets));
  }, [supermarkets]);

  // If Supabase is connected, attempt initial load and poll every 20 seconds
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    async function loadFromSupabase() {
      try {
        const { data: prods } = await supabase!.from('products').select('*');
        if (prods && prods.length > 0) {
          setProducts(prods);
        }
        const { data: ords } = await supabase!.from('orders').select('*, items:order_items(*)');
        if (ords && ords.length > 0) {
          setOrders(ords);
        }
      } catch (err) {
        console.warn('Supabase fetch failed, continuing with local data:', err);
      }
    }
    loadFromSupabase();
    const interval = setInterval(loadFromSupabase, 20000); // هر ۲۰ ثانیه
    return () => clearInterval(interval);
  }, []);

  // 1. Submit Order (Reserves stock & appends audit ledger)
  const createOrder = (payload: CreateOrderPayload) => {
    const supermarket = supermarkets.find((s) => s.id === payload.supermarketId);
    const visitor = visitors.find((v) => v.id === payload.visitorId);

    if (!supermarket || !visitor) {
      return { success: false, message: 'اطلاعات فروشگاه یا ویزیتور نامعتبر است.' };
    }

    if (!payload.items || payload.items.length === 0) {
      return { success: false, message: 'سبد سفارش خالی است.' };
    }

    // Verify stock availability
    for (const item of payload.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) {
        return { success: false, message: `کالای ${item.name} یافت نشد.` };
      }
      const available = prod.stock - prod.reserved_stock;
      if (item.quantity > available) {
        return {
          success: false,
          message: `موجودی ناکافی برای ${prod.name}. موجودی قابل فروش: ${available} ${prod.unit}`,
        };
      }
    }

    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const totalAmount = payload.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const newOrder: Order = {
      id: orderId,
      supermarket_id: supermarket.id,
      supermarket_name: supermarket.name,
      assigned_visitor_id: visitor.id,
      visitor_name: visitor.name,
      status: 'assigned',
      total_amount: totalAmount,
      order_date: nowPersian,
      items: payload.items.map((i, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        order_id: orderId,
        product_id: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
    };

    // Update reserved stock
    setProducts((prev) =>
      prev.map((p) => {
        const ordered = payload.items.find((i) => i.productId === p.id);
        if (ordered) {
          return {
            ...p,
            reserved_stock: p.reserved_stock + ordered.quantity,
          };
        }
        return p;
      })
    );

    // Add inventory transactions
    const newTxList: InventoryTransaction[] = payload.items.map((item) => ({
      id: `tx-${Date.now()}-${item.productId}`,
      product_id: item.productId,
      product_name: item.name,
      transaction_type: 'reserve',
      quantity: item.quantity,
      reference_id: orderId,
      created_at: nowPersian,
    }));

    setInventoryTransactions((prev) => [...newTxList, ...prev]);
    setOrders((prev) => [newOrder, ...prev]);

    // ارسال به Supabase در پس‌زمینه
    if (isSupabaseConfigured && supabase) {
      supabase
        .rpc('create_order_transaction', {
          p_order_id: newOrder.id,
          p_supermarket_id: newOrder.supermarket_id,
          p_supermarket_name: newOrder.supermarket_name,
          p_assigned_visitor_id: newOrder.assigned_visitor_id,
          p_visitor_name: newOrder.visitor_name,
          p_status: newOrder.status,
          p_total_amount: newOrder.total_amount,
          p_items: payload.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        })
        .then(({ error }) => {
          if (error) console.error('خطا در ثبت سفارش روی Supabase:', error);
        });
    }

    return { success: true, message: `سفارش با شماره ${orderId} با موفقیت ثبت و موجودی رزرو شد.`, orderId };
  };

  // 2. Update order status
  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          return { ...order, status };
        }
        return order;
      })
    );

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .then(({ error }) => {
          if (error) console.error('خطا در به‌روزرسانی وضعیت سفارش روی Supabase:', error);
        });
    }
  };

  // 3. Request Reassignment (Handover between visitors)
  const requestReassignment = (orderId: string, toVisitorId: string | null) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const fromVisitor = visitors.find((v) => v.id === order.assigned_visitor_id);
    const toVisitor = toVisitorId ? visitors.find((v) => v.id === toVisitorId) : null;

    const reqId = `REQ-${Date.now().toString().slice(-4)}`;
    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const newReq: ReassignmentRequest = {
      id: reqId,
      order_id: orderId,
      supermarket_name: order.supermarket_name,
      from_visitor_id: order.assigned_visitor_id,
      from_visitor_name: fromVisitor?.name || order.visitor_name,
      to_visitor_id: toVisitorId,
      to_visitor_name: toVisitor ? toVisitor.name : 'عمومی (هر ویزیتوری)',
      status: 'pending',
      timestamp: nowPersian,
    };

    setReassignmentRequests((prev) => [newReq, ...prev]);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'delegated', reassignment_id: reqId } : o))
    );
  };

  // 4. Respond to Reassignment
  const respondToReassignment = (requestId: string, accept: boolean) => {
    const req = reassignmentRequests.find((r) => r.id === requestId);
    if (!req) return;

    setReassignmentRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: accept ? 'accepted' : 'rejected' } : r))
    );

    if (accept) {
      // Transfer order to recipient
      const recipientVisitor = visitors.find((v) => v.id === (req.to_visitor_id || selectedVisitorId));
      if (recipientVisitor) {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === req.order_id) {
              return {
                ...o,
                assigned_visitor_id: recipientVisitor.id,
                visitor_name: recipientVisitor.name,
                status: 'assigned',
                reassignment_id: null,
              };
            }
            return o;
          })
        );
      }
    } else {
      // Revert to assigned
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === req.order_id) {
            return { ...o, status: 'assigned', reassignment_id: null };
          }
          return o;
        })
      );
    }
  };

  // 5. Create Loading Bill (Barghiri)
  const createLoadingBill = (visitorId: string, orderIds: string[]) => {
    const visitor = visitors.find((v) => v.id === visitorId);
    if (!visitor || orderIds.length === 0) return;

    const selectedOrders = orders.filter((o) => orderIds.includes(o.id));
    const itemsMap = new Map<string, { productId: string; name: string; quantity: number; orderId: string }>();

    for (const ord of selectedOrders) {
      if (ord.items) {
        for (const it of ord.items) {
          const key = `${ord.id}-${it.product_id}`;
          itemsMap.set(key, {
            productId: it.product_id,
            name: it.name,
            quantity: it.quantity,
            orderId: ord.id,
          });
        }
      }
    }

    const billId = `LB-${Math.floor(500 + Math.random() * 500)}`;
    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const billItems = Array.from(itemsMap.values()).map((val, idx) => ({
      id: `lbi-${Date.now()}-${idx}`,
      loading_bill_id: billId,
      order_id: val.orderId,
      product_id: val.productId,
      product_name: val.name,
      quantity: val.quantity,
    }));

    const bill: LoadingBill = {
      id: billId,
      visitor_id: visitorId,
      visitor_name: visitor.name,
      status: 'pending',
      created_at: nowPersian,
      items: billItems,
    };

    setLoadingBills((prev) => [bill, ...prev]);

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('loading_bills')
        .insert({
          id: billId,
          visitor_id: visitorId,
          visitor_name: visitor.name,
          status: 'pending',
        })
        .then(({ error }) => {
          if (error) {
            console.error('خطا در ثبت برگه بارگیری روی Supabase:', error);
            return;
          }
          if (billItems.length > 0) {
            supabase
              .from('loading_bill_items')
              .insert(
                billItems.map((item) => ({
                  id: item.id,
                  loading_bill_id: item.loading_bill_id,
                  order_id: item.order_id,
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: item.quantity,
                }))
              )
              .then(({ error: itemsErr }) => {
                if (itemsErr) console.error('خطا در ثبت اقلام برگه بارگیری روی Supabase:', itemsErr);
              });
          }
        });
    }
  };

  // 6. Approve Loading Bill (Cold-chain warehouse commits dispatch & deducts physical stock)
  const approveLoadingBill = (billId: string) => {
    const bill = loadingBills.find((b) => b.id === billId);
    if (!bill || bill.status === 'approved') return;

    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    // Deduct physical stock & release reserved stock
    const itemDeltas = new Map<string, number>();
    if (bill.items) {
      for (const item of bill.items) {
        itemDeltas.set(item.product_id, (itemDeltas.get(item.product_id) || 0) + item.quantity);
      }
    }

    setProducts((prev) =>
      prev.map((p) => {
        const qty = itemDeltas.get(p.id);
        if (qty) {
          return {
            ...p,
            stock: Math.max(0, p.stock - qty),
            reserved_stock: Math.max(0, p.reserved_stock - qty),
          };
        }
        return p;
      })
    );

    // Record ledger transactions
    const newTx: InventoryTransaction[] = [];
    itemDeltas.forEach((qty, prodId) => {
      const prod = products.find((p) => p.id === prodId);
      newTx.push({
        id: `tx-${Date.now()}-out-${prodId}`,
        product_id: prodId,
        product_name: prod?.name || 'کالا',
        transaction_type: 'load_out',
        quantity: qty,
        reference_id: billId,
        created_at: nowPersian,
      });
      newTx.push({
        id: `tx-${Date.now()}-rel-${prodId}`,
        product_id: prodId,
        product_name: prod?.name || 'کالا',
        transaction_type: 'release_reserve',
        quantity: -qty,
        reference_id: billId,
        created_at: nowPersian,
      });
    });

    setInventoryTransactions((prev) => [...newTx, ...prev]);
    setLoadingBills((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, status: 'approved' } : b))
    );

    if (isSupabaseConfigured && supabase) {
      supabase
        .rpc('approve_loading_bill_transaction', { p_loading_bill_id: billId })
        .then(({ error }) => {
          if (error) console.error('خطا در تایید برگه بارگیری روی Supabase:', error);
        });
    }
  };

  // 7. Update product price
  const updateProductPrice = (productId: string, newPrice: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod || prod.price === newPrice) return;

    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const historyRecord: ProductPriceHistory = {
      id: `price-hist-${Date.now()}`,
      product_id: productId,
      old_price: prod.price,
      new_price: newPrice,
      changed_by: 'مدیریت مرکزی',
      changed_at: nowPersian,
    };

    setPriceHistories((prev) => [historyRecord, ...prev]);
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, price: newPrice } : p))
    );

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .update({ price: newPrice })
        .eq('id', productId)
        .then(({ error }) => {
          if (error) console.error('خطا در تغییر قیمت کالا روی Supabase:', error);
        });

      supabase
        .from('product_price_history')
        .insert({
          product_id: productId,
          old_price: prod.price,
          new_price: newPrice,
          changed_by: 'مدیریت مرکزی',
        })
        .then(({ error }) => {
          if (error) console.error('خطا در ثبت تاریخچه قیمت روی Supabase:', error);
        });
    }
  };

  // 8. Update product stock (Warehouse adjustment)
  const updateProductStock = (productId: string, additionalStock: number) => {
    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    let targetStock = 0;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const newStock = Math.max(0, p.stock + additionalStock);
          targetStock = newStock;
          return { ...p, stock: newStock };
        }
        return p;
      })
    );

    const prod = products.find((p) => p.id === productId);
    setInventoryTransactions((prev) => [
      {
        id: `tx-${Date.now()}-adj-${productId}`,
        product_id: productId,
        product_name: prod?.name || 'کالا',
        transaction_type: 'manual_adjustment',
        quantity: additionalStock,
        reference_id: 'ورود به انبار سردخانه',
        created_at: nowPersian,
      },
      ...prev,
    ]);

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .update({ stock: targetStock })
        .eq('id', productId)
        .then(({ error }) => {
          if (error) console.error('خطا در به‌روزرسانی موجودی انبار روی Supabase:', error);
        });

      supabase
        .from('inventory_transactions')
        .insert({
          product_id: productId,
          transaction_type: 'manual_adjustment',
          quantity: additionalStock,
          reference_id: 'ورود به انبار سردخانه',
        })
        .then(({ error }) => {
          if (error) console.error('خطا در ثبت تراکنش انبار روی Supabase:', error);
        });
    }
  };

  // 9. Add new product
  const addNewProduct = (newProd: Omit<Product, 'id' | 'reserved_stock'>) => {
    const id = `prod-${Date.now().toString().slice(-4)}`;
    setProducts((prev) => [
      ...prev,
      {
        ...newProd,
        id,
        reserved_stock: 0,
      },
    ]);
    if (newProd.brand && newProd.brand.trim()) {
      const bTrimmed = newProd.brand.trim();
      setBrands((prev) => (prev.includes(bTrimmed) ? prev : [...prev, bTrimmed]));
    }

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .insert({
          id,
          name: newProd.name,
          category_id: newProd.category_id,
          brand: newProd.brand,
          price: newProd.price,
          stock: newProd.stock,
          reserved_stock: 0,
          unit: newProd.unit,
          image_url: newProd.image_url,
          is_active: newProd.is_active,
        })
        .then(({ error }) => {
          if (error) console.error('خطا در افزودن کالای جدید روی Supabase:', error);
        });
    }
  };

  // 10. Delete product
  const deleteProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return { success: false, message: 'کالای مورد نظر یافت نشد.' };
    if (prod.reserved_stock > 0) {
      return {
        success: false,
        message: `امکان حذف کالا وجود ندارد زیرا ${prod.reserved_stock} واحد از آن در سفارشات جاری رزرو است.`,
      };
    }
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    return { success: true, message: `کالای «${prod.name}» با موفقیت حذف گردید.` };
  };

  // 11. Add category
  const addCategory = (name: string, icon = 'Layers') => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: 'لطفاً نام دسته‌بندی را وارد نمایید.' };
    }
    const exists = categories.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, message: 'دسته‌بندی با این نام قبلاً ثبت شده است.' };
    }
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      icon,
      sort_order: categories.length + 1,
      created_at: new Date().toISOString(),
    };
    setCategories((prev) => [...prev, newCat]);
    return { success: true, message: `دسته‌بندی «${trimmed}» با موفقیت افزوده شد.`, category: newCat };
  };

  // 11b. Update category
  const updateCategory = (categoryId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return { success: false, message: 'نام دسته‌بندی نمی‌تواند خالی باشد.' };
    }
    const exists = categories.some(
      (c) => c.id !== categoryId && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      return { success: false, message: 'دسته‌بندی دیگری با این نام از قبل وجود دارد.' };
    }
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, name: trimmed } : c))
    );
    return { success: true, message: `نام دسته‌بندی با موفقیت به «${trimmed}» تغییر یافت.` };
  };

  // 12. Delete category
  const deleteCategory = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) {
      return { success: false, message: 'دسته‌بندی یافت نشد.' };
    }
    const remainingCats = categories.filter((c) => c.id !== categoryId);
    const fallbackCatId = remainingCats.length > 0 ? remainingCats[0].id : 'cat-1';

    // Reassign products of this category to fallback category
    setProducts((prev) =>
      prev.map((p) => (p.category_id === categoryId ? { ...p, category_id: fallbackCatId } : p))
    );

    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    return { success: true, message: `دسته‌بندی «${cat.name}» با موفقیت حذف شد.` };
  };

  // 13. Add brand
  const addBrand = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: 'لطفاً نام برند را وارد نمایید.' };
    }
    const exists = brands.some((b) => b.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, message: 'این برند قبلاً در فهرست برندها تعریف شده است.' };
    }
    setBrands((prev) => [...prev, trimmed]);
    return { success: true, message: `برند «${trimmed}» با موفقیت افزوده شد.` };
  };

  // 13b. Update brand
  const updateBrand = (oldBrandName: string, newBrandName: string) => {
    const trimmed = newBrandName.trim();
    if (!trimmed) {
      return { success: false, message: 'نام برند نمی‌تواند خالی باشد.' };
    }
    if (trimmed.toLowerCase() !== oldBrandName.trim().toLowerCase()) {
      const exists = brands.some((b) => b.trim().toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        return { success: false, message: 'این برند از قبل در فهرست برندها تعریف شده است.' };
      }
    }
    // Update brands list
    setBrands((prev) =>
      prev.map((b) => (b.trim().toLowerCase() === oldBrandName.trim().toLowerCase() ? trimmed : b))
    );
    // Update products that use this brand
    setProducts((prev) =>
      prev.map((p) =>
        p.brand && p.brand.trim().toLowerCase() === oldBrandName.trim().toLowerCase()
          ? { ...p, brand: trimmed }
          : p
      )
    );
    return { success: true, message: `نام برند با موفقیت به «${trimmed}» تغییر یافت.` };
  };

  // 14. Delete brand
  const deleteBrand = (brandName: string) => {
    const trimmed = brandName.trim();
    const exists = brands.some((b) => b.trim().toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      return { success: false, message: 'برند مورد نظر یافت نشد.' };
    }

    // Reassign any products with this brand to "متفرقه"
    setProducts((prev) =>
      prev.map((p) =>
        p.brand && p.brand.trim().toLowerCase() === trimmed.toLowerCase()
          ? { ...p, brand: 'متفرقه' }
          : p
      )
    );

    setBrands((prev) => prev.filter((b) => b.trim().toLowerCase() !== trimmed.toLowerCase()));
    return { success: true, message: `برند «${trimmed}» با موفقیت حذف شد.` };
  };

  const currentUser: CurrentUser = useMemo(() => {
    if (role === 'admin') {
      return {
        id: 'admin-1',
        name: 'مدیریت مرکزی البرز',
        username: 'admin',
        role: 'admin',
        roleTitle: 'مدیر ارشد',
        phone: '۰۹۱۲۰۰۰۰۰۰۰',
      };
    }
    if (role === 'warehouse') {
      return {
        id: 'wh-1',
        name: 'انباردار سردخانه البرز',
        username: 'warehouse',
        role: 'warehouse',
        roleTitle: 'انباردار سردخانه',
        phone: '۰۹۱۲۱۱۱۰۰۰۰',
      };
    }
    if (role === 'visitor') {
      const v = visitors.find((vis) => vis.id === selectedVisitorId) || visitors[0];
      return {
        id: v?.id || 'vis-1',
        name: v?.name || 'علیرضا رضایی',
        username: v?.username || 'visitor1',
        role: 'visitor',
        roleTitle: `ویزیتور (${v?.region || 'منطقه توزیع'})`,
        phone: v?.phone || '۰۹۱۲۳۴۵۶۷۸۹',
      };
    }
    if (role === 'supermarket') {
      const s = supermarkets.find((sm) => sm.id === selectedSupermarketId) || supermarkets[0];
      return {
        id: s?.id || 'shop-1',
        name: s?.name || 'سوپرمارکت بهاران',
        username: s?.username || 'shop1',
        role: 'supermarket',
        roleTitle: `فروشگاه (${s?.owner || 'مدیریت'})`,
        phone: s?.phone || '۰۹۱۲۱۱۱۱۱۱۱',
      };
    }
    return {
      id: 'admin-1',
      name: 'مدیریت مرکزی البرز',
      username: 'admin',
      role: 'admin',
      roleTitle: 'مدیر ارشد',
      phone: '۰۹۱۲۰۰۰۰۰۰۰',
    };
  }, [role, selectedVisitorId, selectedSupermarketId, visitors, supermarkets]);

  const registerSupermarket = (data: {
    name: string;
    owner: string;
    phone: string;
    address: string;
    assigned_visitor_id: string;
    username: string;
    password: string;
  }) => {
    const trimmedName = data.name.trim();
    const trimmedPhone = data.phone.trim();
    const trimmedUsername = data.username.trim();
    const trimmedPassword = data.password.trim();

    if (!trimmedName) {
      return { success: false, message: 'لطفاً نام فروشگاه را وارد نمایید.' };
    }
    if (!trimmedPhone) {
      return { success: false, message: 'لطفاً شماره تماس را وارد نمایید.' };
    }
    if (!trimmedUsername) {
      return { success: false, message: 'تعیین نام کاربری جهت ورود به حساب الزامی است.' };
    }
    if (!trimmedPassword) {
      return { success: false, message: 'تعیین رمز عبور جهت ورود به حساب الزامی است.' };
    }

    // Check duplicate phone
    const phoneExists = supermarkets.some((s) => s.phone.replace(/\s+/g, '') === trimmedPhone.replace(/\s+/g, ''));
    if (phoneExists) {
      return { success: false, message: 'این شماره تماس قبلاً برای یک فروشگاه دیگر ثبت شده است.' };
    }

    // Check duplicate username
    const usernameExists = supermarkets.some(
      (s) => s.username && s.username.trim().toLowerCase() === trimmedUsername.toLowerCase()
    );
    if (usernameExists) {
      return {
        success: false,
        message: 'این نام کاربری قبلاً توسط فروشگاه دیگری ثبت شده است. لطفاً نام کاربری دیگری انتخاب نمایید.',
      };
    }

    const newId = `shop-${Date.now()}`;
    const newSupermarket: Supermarket = {
      id: newId,
      name: trimmedName,
      owner: data.owner.trim() || 'مدیر فروشگاه',
      phone: trimmedPhone,
      address: data.address.trim() || 'تهران - منطقه توزیع زنجیره سرد',
      assigned_visitor_id: data.assigned_visitor_id || 'vis-1',
      username: trimmedUsername,
      password: trimmedPassword,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    setSupermarkets((prev) => [newSupermarket, ...prev]);
    setSelectedSupermarketId(newId);
    setRole('supermarket');
    setIsLoggedIn(true);
    localStorage.setItem('alborz_auth_logged_in', 'true');

    return { success: true, message: 'حساب کاربری فروشگاه با موفقیت ایجاد شد و وارد شدید.', supermarket: newSupermarket };
  };

  const loginWithCredentials = (
    inputUser: string,
    inputPass: string,
    allowedRoles?: UserRole[]
  ): { success: boolean; message?: string } => {
    const cleanUser = inputUser.trim().toLowerCase();
    const cleanPass = inputPass.trim();

    // 1. Search in predefined profiles
    const matchedProfile = INITIAL_PROFILES.find((p) => {
      if (allowedRoles && !allowedRoles.includes(p.role)) return false;
      const u = p.username.toLowerCase();
      // Allow login via username or phone
      const phoneDigits = p.phone.replace(/[^0-9]/g, '');
      const inputDigits = cleanUser.replace(/[^0-9]/g, '');
      const isUserMatch = u === cleanUser || (inputDigits.length > 5 && phoneDigits === inputDigits);
      const isPassMatch = (p.password || '123') === cleanPass;
      return isUserMatch && isPassMatch;
    });

    if (matchedProfile) {
      setRole(matchedProfile.role);
      if (matchedProfile.role === 'visitor') {
        setSelectedVisitorId(matchedProfile.id);
      } else if (matchedProfile.role === 'supermarket') {
        setSelectedSupermarketId(matchedProfile.id);
      }
      setIsLoggedIn(true);
      localStorage.setItem('alborz_auth_logged_in', 'true');
      return { success: true };
    }

    // 2. Search in registered supermarkets (if role allows)
    if (!allowedRoles || allowedRoles.includes('supermarket')) {
      const matchedSm = supermarkets.find((s) => {
        const u = (s.username || s.id).toLowerCase();
        const phoneDigits = s.phone.replace(/[^0-9]/g, '');
        const inputDigits = cleanUser.replace(/[^0-9]/g, '');
        const isUserMatch = u === cleanUser || (inputDigits.length > 5 && phoneDigits === inputDigits);
        const isPassMatch = (s.password || '123') === cleanPass;
        return isUserMatch && isPassMatch;
      });

      if (matchedSm) {
        setRole('supermarket');
        setSelectedSupermarketId(matchedSm.id);
        setIsLoggedIn(true);
        localStorage.setItem('alborz_auth_logged_in', 'true');
        return { success: true };
      }
    }

    return {
      success: false,
      message: 'نام کاربری یا رمز عبور وارد شده نادرست است.',
    };
  };

  const login = (profileId: string) => {
    const profile = INITIAL_PROFILES.find((p) => p.id === profileId);
    if (profile) {
      setRole(profile.role);
      if (profile.role === 'visitor') {
        setSelectedVisitorId(profile.id);
      } else if (profile.role === 'supermarket') {
        setSelectedSupermarketId(profile.id);
      }
    } else {
      // Check if it's a dynamic supermarket registered by the user
      const dynamicSm = supermarkets.find((s) => s.id === profileId);
      if (dynamicSm) {
        setRole('supermarket');
        setSelectedSupermarketId(dynamicSm.id);
      }
    }
    setIsLoggedIn(true);
    localStorage.setItem('alborz_auth_logged_in', 'true');
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.setItem('alborz_auth_logged_in', 'false');
  };

  const resetToDefaults = () => {
    localStorage.clear();
    setCategories(INITIAL_CATEGORIES);
    setBrands(INITIAL_BRANDS);
    setProducts(INITIAL_PRODUCTS);
    setOrders(INITIAL_ORDERS);
    setReassignmentRequests([]);
    setLoadingBills(INITIAL_LOADING_BILLS);
    setInventoryTransactions(INITIAL_INVENTORY_TRANSACTIONS);
    setPriceHistories([]);
    setSupermarkets(INITIAL_SUPERMARKETS);
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        selectedVisitorId,
        setSelectedVisitorId,
        selectedSupermarketId,
        setSelectedSupermarketId,
        isLoggedIn,
        currentUser,
        login,
        loginWithCredentials,
        logout,
        categories,
        brands,
        products,
        visitors,
        supermarkets,
        orders,
        reassignmentRequests,
        loadingBills,
        inventoryTransactions,
        priceHistories,
        createOrder,
        updateOrderStatus,
        requestReassignment,
        respondToReassignment,
        createLoadingBill,
        approveLoadingBill,
        updateProductPrice,
        updateProductStock,
        addNewProduct,
        deleteProduct,
        addCategory,
        updateCategory,
        deleteCategory,
        addBrand,
        updateBrand,
        deleteBrand,
        registerSupermarket,
        resetToDefaults,
        isOnlineDb: isSupabaseConfigured,
        theme,
        toggleTheme,
      }}
    >
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
