import React, { useEffect, useCallback, useRef } from 'react';
import {
  Product,
  Order,
  Category,
  ReassignmentRequest,
  Supermarket,
  Visitor,
  LoadingBill,
  InventoryTransaction,
  ProductLike,
} from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { LEGACY_MOCK_NAMES } from './useCatalog';
import { STORAGE_KEYS, getOrderChannel, purgeOperationalLocalStorage } from '../utils';

export type SyncTable =
  | 'products'
  | 'orders'
  | 'categories'
  | 'brands'
  | 'reassignment_requests'
  | 'supermarkets'
  | 'visitors'
  | 'loading_bills'
  | 'inventory_transactions'
  | 'product_likes';

export const ALL_SYNC_TABLES: SyncTable[] = [
  'products',
  'orders',
  'categories',
  'brands',
  'reassignment_requests',
  'supermarkets',
  'visitors',
  'loading_bills',
  'inventory_transactions',
  'product_likes',
];

interface UseSupabaseSyncProps {
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setBrands: React.Dispatch<React.SetStateAction<string[]>>;
  setUnits?: React.Dispatch<React.SetStateAction<string[]>>;
  setReassignmentRequests: React.Dispatch<React.SetStateAction<ReassignmentRequest[]>>;
  setSupermarkets: React.Dispatch<React.SetStateAction<Supermarket[]>>;
  setVisitors: React.Dispatch<React.SetStateAction<Visitor[]>>;
  setLoadingBills: React.Dispatch<React.SetStateAction<LoadingBill[]>>;
  setInventoryTransactions: React.Dispatch<React.SetStateAction<InventoryTransaction[]>>;
  setProductLikes?: React.Dispatch<React.SetStateAction<ProductLike[]>>;
  role?: string;
  currentUser?: { id: string; name: string; role: string };
  onShowToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  setIsDataReady?: React.Dispatch<React.SetStateAction<boolean>>;
  setFetchError?: React.Dispatch<React.SetStateAction<string | null>>;
  reloadCounter?: number;
}

export function useSupabaseSync({
  setProducts,
  setOrders,
  setCategories,
  setBrands,
  setReassignmentRequests,
  setSupermarkets,
  setVisitors,
  setLoadingBills,
  setInventoryTransactions,
  setProductLikes,
  role,
  currentUser,
  onShowToast,
  setIsDataReady,
  setFetchError,
  reloadCounter = 0,
}: UseSupabaseSyncProps) {
  const isInitialFetchDoneRef = useRef(false);

  // 1. Memoized Stringified State Cache to avoid redundant React re-renders
  const lastStateJsonRef = useRef<Record<SyncTable, string>>({
    products: '',
    orders: '',
    categories: '',
    brands: '',
    reassignment_requests: '',
    supermarkets: '',
    visitors: '',
    loading_bills: '',
    inventory_transactions: '',
    product_likes: '',
  });

  // 2. Debounce and Execution Lock Tracking
  const dirtyTablesRef = useRef<Set<SyncTable>>(new Set());
  const isFetchingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 3. Granular Table Fetch Functions with Explicit Column Projections

  // A. Fetch Products
  const fetchProducts = useCallback(async () => {
    if (!supabase) return;
    const { data: prods, error: prodsErr } = await supabase
      .from('products')
      .select('id, category_id, brand, name, price, visitor_price, consumer_price, stock, reserved_stock, unit, items_per_package, image_url, is_active, is_market_test, created_at');

    if (prodsErr) throw prodsErr;

    const validProds: Product[] = (prods || [])
      .filter((p: Product) => !LEGACY_MOCK_NAMES.has(p.name?.trim()))
      .map((p: Product) => ({
        ...p,
        is_active: p.is_active ?? true,
        is_market_test: Boolean(p.is_market_test),
      }));

    const jsonStr = JSON.stringify(validProds);
    if (validProds.length > 0) {
      if (lastStateJsonRef.current.products !== jsonStr) {
        lastStateJsonRef.current.products = jsonStr;
        setProducts(validProds);
        try {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, jsonStr);
        } catch {}
      }
    } else {
      try {
        const localSaved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const fallbackJson = JSON.stringify(parsed);
            if (lastStateJsonRef.current.products !== fallbackJson) {
              lastStateJsonRef.current.products = fallbackJson;
              setProducts(parsed);
            }
          }
        }
      } catch {}
    }
  }, [setProducts]);

  // B. Fetch Orders with Items
  const fetchOrders = useCallback(async () => {
    if (!supabase) return;
    const { data: ords, error: ordsErr } = await supabase
      .from('orders')
      .select('id, supermarket_id, supermarket_name, assigned_visitor_id, visitor_name, status, total_amount, order_source, order_channel, reassignment_id, loading_bill_id, invoice_revised_at, order_date, stock_deducted, items:order_items(id, order_id, product_id, name, price, quantity, items_per_package, unit, created_at)');

    if (ordsErr) throw ordsErr;

    const cleanOrds: Order[] = (ords || [])
      .filter(
        (o: Order) =>
          Boolean(o.id) &&
          !o.items?.some((it) => LEGACY_MOCK_NAMES.has(it.name?.trim()))
      )
      .map((o: Order) => ({
        ...o,
        supermarket_id: o.supermarket_id || '',
        supermarket_name: o.supermarket_name || 'فروشگاه نامشخص',
        assigned_visitor_id: o.assigned_visitor_id || 'direct',
        visitor_name:
          o.visitor_name ||
          (o.assigned_visitor_id && o.assigned_visitor_id !== 'direct'
            ? 'ویزیتور'
            : 'خرید مستقیم از پخش مرکزی'),
        order_channel: getOrderChannel(o),
      }));

    const jsonStr = JSON.stringify(cleanOrds);
    if (lastStateJsonRef.current.orders !== jsonStr) {
      lastStateJsonRef.current.orders = jsonStr;
      setOrders(cleanOrds);
    }
  }, [setOrders]);

  // C. Fetch Categories
  const fetchCategories = useCallback(async () => {
    if (!supabase) return;
    const { data: cats, error: catsErr } = await supabase
      .from('categories')
      .select('id, name, icon, sort_order, created_at')
      .order('sort_order', { ascending: true });

    if (catsErr) throw catsErr;

    if (cats && cats.length > 0) {
      const jsonStr = JSON.stringify(cats);
      if (lastStateJsonRef.current.categories !== jsonStr) {
        lastStateJsonRef.current.categories = jsonStr;
        setCategories(cats);
      }
    }
  }, [setCategories]);

  // D. Fetch Brands
  const fetchBrands = useCallback(async () => {
    if (!supabase) return;
    const { data: brs, error: brsErr } = await supabase.from('brands').select('name');
    if (brsErr) throw brsErr;

    if (brs && brs.length > 0) {
      const dbBrandNames = Array.from(new Set(brs.map((b: { name: string }) => b.name).filter(Boolean)));
      const jsonStr = JSON.stringify(dbBrandNames);
      if (lastStateJsonRef.current.brands !== jsonStr) {
        lastStateJsonRef.current.brands = jsonStr;
        setBrands(dbBrandNames);
      }
    }
  }, [setBrands]);

  // E. Fetch Reassignment Requests
  const fetchReassignmentRequests = useCallback(async () => {
    if (!supabase) return;
    const { data: reassigns, error: reassignErr } = await supabase
      .from('reassignment_requests')
      .select('id, order_id, supermarket_name, from_visitor_id, from_visitor_name, to_visitor_id, to_visitor_name, status, timestamp, reason')
      .order('timestamp', { ascending: false });

    if (reassignErr) throw reassignErr;

    if (reassigns) {
      const jsonStr = JSON.stringify(reassigns);
      if (lastStateJsonRef.current.reassignment_requests !== jsonStr) {
        lastStateJsonRef.current.reassignment_requests = jsonStr;
        setReassignmentRequests(reassigns);
      }
    }
  }, [setReassignmentRequests]);

  // F. Fetch Supermarkets & Profiles
  const fetchSupermarkets = useCallback(async () => {
    if (!supabase) return;
    const [smsRes, profRes] = await Promise.all([
      supabase
        .from('supermarkets')
        .select('id, name, owner, phone, address, assigned_visitor_id, is_active, username, created_at'),
      supabase
        .from('profiles')
        .select('id, username'),
    ]);

    if (smsRes.error) throw smsRes.error;

    const profileMap = new Map<string, string>(
      (profRes.data || []).map((p: { id: string; username?: string }) => [p.id, p.username || ''])
    );

    const cleanSms: Supermarket[] = (smsRes.data || []).map((sm: any) => {
      const profUsername = profileMap.get(sm.id);
      return {
        id: sm.id,
        name: sm.name,
        owner: sm.owner || '',
        phone: sm.phone || '',
        address: sm.address || '',
        assigned_visitor_id: sm.assigned_visitor_id || 'direct',
        is_active: sm.is_active ?? true,
        username: profUsername || sm.username || sm.phone || '',
        created_at: sm.created_at,
      };
    });

    const jsonStr = JSON.stringify(cleanSms);
    if (lastStateJsonRef.current.supermarkets !== jsonStr) {
      lastStateJsonRef.current.supermarkets = jsonStr;
      setSupermarkets(cleanSms);
    }
  }, [setSupermarkets]);

  // G. Fetch Visitors & Profiles
  const fetchVisitors = useCallback(async () => {
    if (!supabase) return;
    const [visRes, profRes] = await Promise.all([
      supabase
        .from('visitors')
        .select('id, name, phone, region, is_active, username, created_at'),
      supabase
        .from('profiles')
        .select('id, username'),
    ]);

    if (visRes.error) throw visRes.error;

    const profileMap = new Map<string, string>(
      (profRes.data || []).map((p: { id: string; username?: string }) => [p.id, p.username || ''])
    );

    const cleanVis: Visitor[] = (visRes.data || []).map((v: any) => {
      const profUsername = profileMap.get(v.id);
      let resolvedUsername = profUsername || v.username || '';
      if (resolvedUsername && resolvedUsername.includes('-') && resolvedUsername.length > 25) {
        resolvedUsername = '';
      }
      return {
        id: v.id,
        name: v.name,
        phone: v.phone || '',
        region: v.region || 'منطقه توزیع',
        username: resolvedUsername || v.phone || '',
        is_active: v.is_active ?? true,
        created_at: v.created_at,
      };
    });

    const jsonStr = JSON.stringify(cleanVis);
    if (lastStateJsonRef.current.visitors !== jsonStr) {
      lastStateJsonRef.current.visitors = jsonStr;
      setVisitors(cleanVis);
    }
  }, [setVisitors]);

  // H. Fetch Loading Bills with Items
  const fetchLoadingBills = useCallback(async () => {
    if (!supabase) return;
    let fetchedBills: LoadingBill[] = [];
    const { data: billsData, error: billsErr } = await supabase
      .from('loading_bills')
      .select('id, invoice_no, visitor_id, visitor_name, status, orders_count, total_visitor_cost, total_store_amount, revision_count, last_revised_by, approved_by, approved_at, finalized_by, finalized_at, cancel_reason, admin_note, exit_approved_by, exit_approved_at, created_at, submitted_at, items:loading_bill_items(id, loading_bill_id, order_id, product_id, product_name, quantity, original_quantity, store_price, visitor_price, source, customer_label, line_note, created_at)')
      .order('created_at', { ascending: false });

    if (!billsErr && billsData) {
      fetchedBills = billsData;
    } else {
      const { data: bData } = await supabase
        .from('loading_bills')
        .select('*')
        .order('created_at', { ascending: false });
      const { data: iData } = await supabase.from('loading_bill_items').select('*');

      if (bData) {
        fetchedBills = bData.map((b: LoadingBill) => ({
          ...b,
          items: iData ? iData.filter((it: { loading_bill_id: string }) => it.loading_bill_id === b.id) : [],
        }));
      }
    }

    const jsonStr = JSON.stringify(fetchedBills);
    if (lastStateJsonRef.current.loading_bills !== jsonStr) {
      lastStateJsonRef.current.loading_bills = jsonStr;
      setLoadingBills(fetchedBills);
    }
  }, [setLoadingBills]);

  // I. Fetch Inventory Transactions (Limited to Admin & Warehouse, max 500 rows)
  const fetchInventoryTransactions = useCallback(async () => {
    if (!supabase) return;
    // Cap: Only fetch for staff roles (admin and warehouse) to save CPU and network bandwidth
    if (role && role !== 'admin' && role !== 'warehouse') {
      return;
    }

    const { data: txData, error: txErr } = await supabase
      .from('inventory_transactions')
      .select('id, product_id, product_name, transaction_type, quantity, reference_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (txErr) throw txErr;

    if (txData) {
      const validTxData = txData.filter(
        (t: InventoryTransaction) =>
          !LEGACY_MOCK_NAMES.has(t.product_name?.trim() || '') &&
          !t.product_id?.startsWith('prod-')
      );
      const jsonStr = JSON.stringify(validTxData);
      if (lastStateJsonRef.current.inventory_transactions !== jsonStr) {
        lastStateJsonRef.current.inventory_transactions = jsonStr;
        setInventoryTransactions(validTxData);
      }
    }
  }, [setInventoryTransactions, role]);

  // J. Fetch Product Likes
  const fetchProductLikes = useCallback(async () => {
    if (!supabase || !setProductLikes) return;
    try {
      const { data: likesData, error: likesErr } = await supabase
        .from('product_likes')
        .select('id, product_id, supermarket_id, supermarket_name, supermarket_owner, supermarket_phone, created_at');

      if (!likesErr && likesData && Array.isArray(likesData)) {
        const jsonStr = JSON.stringify(likesData);
        if (lastStateJsonRef.current.product_likes !== jsonStr) {
          lastStateJsonRef.current.product_likes = jsonStr;
          setProductLikes(likesData);
        }
      }
    } catch {
      // optional table
    }
  }, [setProductLikes]);

  // 4. Core Execution Coordinator
  const executeDirtyFetches = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsDataReady?.(true);
      return;
    }

    if (isFetchingRef.current) {
      // Another fetch is already in flight. Queued tables will be picked up when it completes.
      return;
    }

    isFetchingRef.current = true;

    // Snapshot tables that need sync
    const tablesToSync = new Set(dirtyTablesRef.current);
    dirtyTablesRef.current.clear();

    const tasks: Promise<void>[] = [];

    if (tablesToSync.has('products')) tasks.push(fetchProducts());
    if (tablesToSync.has('orders')) tasks.push(fetchOrders());
    if (tablesToSync.has('categories')) tasks.push(fetchCategories());
    if (tablesToSync.has('brands')) tasks.push(fetchBrands());
    if (tablesToSync.has('reassignment_requests')) tasks.push(fetchReassignmentRequests());
    if (tablesToSync.has('supermarkets')) tasks.push(fetchSupermarkets());
    if (tablesToSync.has('visitors')) tasks.push(fetchVisitors());
    if (tablesToSync.has('loading_bills')) tasks.push(fetchLoadingBills());
    if (tablesToSync.has('inventory_transactions')) tasks.push(fetchInventoryTransactions());
    if (tablesToSync.has('product_likes')) tasks.push(fetchProductLikes());

    try {
      const results = await Promise.allSettled(tasks);
      const firstRejected = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;

      if (firstRejected) {
        const msg =
          firstRejected.reason instanceof Error
            ? firstRejected.reason.message
            : 'خطا در بارگیری داده‌ها از سرور';
        console.warn('Supabase sync notice:', msg);
        if (!isInitialFetchDoneRef.current) {
          setFetchError?.(msg);
        }
      } else {
        setFetchError?.(null);
      }

      setIsDataReady?.(true);
      isInitialFetchDoneRef.current = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ارتباط با سرور';
      console.warn('Supabase sync global catch:', msg);
      if (!isInitialFetchDoneRef.current) {
        setFetchError?.(msg);
      }
    } finally {
      isFetchingRef.current = false;

      // If new realtime events arrived while the query was running, trigger an immediate follow-up
      if (dirtyTablesRef.current.size > 0 && typeof document !== 'undefined' && !document.hidden) {
        executeDirtyFetches();
      }
    }
  }, [
    fetchProducts,
    fetchOrders,
    fetchCategories,
    fetchBrands,
    fetchReassignmentRequests,
    fetchSupermarkets,
    fetchVisitors,
    fetchLoadingBills,
    fetchInventoryTransactions,
    fetchProductLikes,
    setIsDataReady,
    setFetchError,
  ]);

  // 5. Debounced Scheduler (800ms trailing debounce for background events)
  const scheduleReload = useCallback(
    (tables: SyncTable[] = ALL_SYNC_TABLES, immediate = false) => {
      // Mark requested tables as dirty
      tables.forEach((t) => dirtyTablesRef.current.add(t));

      if (immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        executeDirtyFetches();
        return;
      }

      // If tab is hidden, postpone until tab becomes visible again
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        executeDirtyFetches();
      }, 800);
    },
    [executeDirtyFetches]
  );

  // 6. Main Lifecycle Effect
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsDataReady?.(true);
      return;
    }

    // Purge old operational localStorage keys once on startup in Supabase mode
    purgeOperationalLocalStorage();

    // Initial full load (immediate, no debounce delay)
    scheduleReload(ALL_SYNC_TABLES, true);

    // 60-second backup polling (skip execution if tab is hidden)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        scheduleReload(ALL_SYNC_TABLES);
      }
    }, 60000);

    // Visibility change handler: when user returns to tab, perform a fresh sync
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleReload(ALL_SYNC_TABLES);
      }
    };

    // Window focus handler: sync if not hidden
    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible') {
        scheduleReload(ALL_SYNC_TABLES);
      }
    };

    // Online reconnection handler
    const handleOnline = () => {
      scheduleReload(ALL_SYNC_TABLES, true);
      onShowToast?.('اتصال اینترنت برقرار شد. اطلاعات به‌روزرسانی شدند.', 'success');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    // Granular Realtime Supabase Channel Subscriptions for tables
    const realtimeChannel = supabase
      .channel('app-db-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loading_bills' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newBillRaw = payload.new as LoadingBill;
            if (role === 'warehouse' || role === 'admin') {
              onShowToast?.(`برگه جدید از ${newBillRaw.visitor_name || 'ویزیتور'}`, 'info');
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedBill = payload.new as LoadingBill;
            if (role === 'visitor' && currentUser) {
              const isMyBill =
                updatedBill.visitor_id === currentUser.id ||
                updatedBill.visitor_name === currentUser.name;
              if (isMyBill) {
                if (updatedBill.status === 'approved') {
                  onShowToast?.('برگه شما تایید شد', 'success');
                } else if (updatedBill.status === 'cancelled') {
                  const reasonText = updatedBill.cancel_reason ? `: ${updatedBill.cancel_reason}` : '';
                  onShowToast?.(`برگه شما لغو شد${reasonText}`, 'error');
                }
              }
            }
          }
          // Only reload loading_bills table
          scheduleReload(['loading_bills']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // Only reload orders table
          scheduleReload(['orders']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supermarkets' },
        () => {
          // Only reload supermarkets table
          scheduleReload(['supermarkets']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitors' },
        () => {
          // Only reload visitors table
          scheduleReload(['visitors']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          // Only reload products table
          scheduleReload(['products']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reassignment_requests' },
        () => {
          // Only reload reassignment_requests table
          scheduleReload(['reassignment_requests']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_transactions' },
        () => {
          // Only reload inventory_transactions table
          scheduleReload(['inventory_transactions']);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [scheduleReload, role, currentUser, onShowToast, setIsDataReady]);

  // 7. Manual Reload Trigger (when reloadCounter changes via refreshData)
  useEffect(() => {
    if (reloadCounter > 0) {
      scheduleReload(ALL_SYNC_TABLES, true);
    }
  }, [reloadCounter, scheduleReload]);

  // 8. LocalStorage Cross-Tab Realtime Sync (Only active in mock / local storage mode)
  useEffect(() => {
    if (isSupabaseConfigured) return;

    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.key) return;

      if (e.key === STORAGE_KEYS.LOADING_BILLS && e.newValue) {
        try {
          const newBills: LoadingBill[] = JSON.parse(e.newValue);
          if (Array.isArray(newBills)) {
            setLoadingBills(newBills);
          }
        } catch {}
      }

      if (e.key === STORAGE_KEYS.ORDERS && e.newValue) {
        try {
          const newOrders: Order[] = JSON.parse(e.newValue);
          if (Array.isArray(newOrders)) {
            setOrders(newOrders);
          }
        } catch {}
      }

      if (e.key === STORAGE_KEYS.PRODUCTS && e.newValue) {
        try {
          const newProducts: Product[] = JSON.parse(e.newValue);
          if (Array.isArray(newProducts)) {
            setProducts(newProducts);
          }
        } catch {}
      }

      if (e.key === STORAGE_KEYS.SUPERMARKETS && e.newValue) {
        try {
          const newSupermarkets: Supermarket[] = JSON.parse(e.newValue);
          if (Array.isArray(newSupermarkets)) {
            setSupermarkets(newSupermarkets);
          }
        } catch {}
      }

      if (e.key === STORAGE_KEYS.VISITORS && e.newValue) {
        try {
          const newVisitors: Visitor[] = JSON.parse(e.newValue);
          if (Array.isArray(newVisitors)) {
            setVisitors(newVisitors);
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [setLoadingBills, setOrders, setProducts, setSupermarkets, setVisitors]);
}
