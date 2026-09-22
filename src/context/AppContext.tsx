import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
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
  INITIAL_CATEGORIES,
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
  
  categories: Category[];
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
  resetToDefaults: () => void;
  isOnlineDb: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PRODUCTS: 'alborz_products_v1',
  ORDERS: 'alborz_orders_v1',
  REASSIGNMENTS: 'alborz_reassignments_v1',
  LOADING_BILLS: 'alborz_loading_bills_v1',
  TRANSACTIONS: 'alborz_tx_v1',
  PRICE_HISTORIES: 'alborz_price_histories_v1',
  SUPERMARKETS: 'alborz_supermarkets_v1',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>('admin');
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>('vis-1');
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string>('shop-1');

  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [visitors] = useState<Visitor[]>(INITIAL_VISITORS);

  const [supermarkets, setSupermarkets] = useState<Supermarket[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUPERMARKETS);
    return saved ? JSON.parse(saved) : INITIAL_SUPERMARKETS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
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

  // If Supabase is connected, attempt initial load
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

    const bill: LoadingBill = {
      id: billId,
      visitor_id: visitorId,
      visitor_name: visitor.name,
      status: 'pending',
      created_at: nowPersian,
      items: Array.from(itemsMap.values()).map((val, idx) => ({
        id: `lbi-${Date.now()}-${idx}`,
        loading_bill_id: billId,
        order_id: val.orderId,
        product_id: val.productId,
        product_name: val.name,
        quantity: val.quantity,
      })),
    };

    setLoadingBills((prev) => [bill, ...prev]);
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
  };

  // 8. Update product stock (Warehouse adjustment)
  const updateProductStock = (productId: string, additionalStock: number) => {
    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const newStock = Math.max(0, p.stock + additionalStock);
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
  };

  const resetToDefaults = () => {
    localStorage.clear();
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
        categories,
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
        resetToDefaults,
        isOnlineDb: isSupabaseConfigured,
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
