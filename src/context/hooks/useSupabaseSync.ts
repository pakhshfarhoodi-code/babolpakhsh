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
import { formatUnifiedBillNumber } from '../../utils/numberToPersianWords';

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

export const CRITICAL_TABLES: Set<SyncTable> = new Set([
  'products',
  'orders',
  'supermarkets',
  'visitors',
  'loading_bills',
  'categories',
  'brands',
]);

export const OPTIONAL_TABLES: Set<SyncTable> = new Set([
  'inventory_transactions',
  'product_likes',
  'reassignment_requests',
]);

/**
 * Promise wrapper enforcing a strict 15-second timeout on any network/database request.
 */
function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = 15000,
  errorMsg = 'مهلت زمانی درخواست (۱۵ ثانیه) به پایان رسید'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

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
  setUnits,
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
  // Session tracking to ensure no fetching occurs prior to successful authentication
  const currentUserIdRef = useRef<string | null>(null);
  const isInitialFetchDoneRef = useRef(false);
  const retryAttemptRef = useRef<number>(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Memoized Stringified State Cache to prevent redundant React re-renders
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

  // 3. Granular Table Fetch Functions with Explicit Column Projections & 15s Timeout

  // A. Fetch Products (Critical)
  const fetchProducts = useCallback(async () => {
    if (!supabase) return;
    const isStoreRole = role === 'supermarket';
    const storeColumns = 'id, category_id, brand, name, price, consumer_price, stock, reserved_stock, unit, items_per_package, image_url, is_active, is_market_test, created_at';
    const fullColumns = 'id, category_id, brand, name, price, visitor_price, consumer_price, stock, reserved_stock, unit, items_per_package, image_url, is_active, is_market_test, created_at';

    let prods: any[] | null = null;
    let prodsErr: any = null;

    if (isStoreRole) {
      // 1. Try reading from products_store view (which does not expose visitor_price)
      try {
        const viewRes = await withTimeout(
          supabase
            .from('products_store')
            .select(storeColumns),
          15000,
          'مهلت زمانی دریافت اطلاعات کالاها به پایان رسید'
        );

        if (viewRes.error) {
          const errCode = (viewRes.error as any)?.code;
          const errMsg = String((viewRes.error as any)?.message || '');
          const isMissingRelation =
            errCode === '42P01' ||
            errMsg.includes('42P01') ||
            (errMsg.toLowerCase().includes('relation') && errMsg.toLowerCase().includes('does not exist'));

          if (isMissingRelation) {
            // Fallback once to table 'products' with the store columns without visitor_price
            const fallbackRes = await withTimeout(
              supabase
                .from('products')
                .select(storeColumns),
              15000,
              'مهلت زمانی دریافت اطلاعات کالاها به پایان رسید'
            );
            prods = fallbackRes.data;
            prodsErr = fallbackRes.error;
          } else {
            prodsErr = viewRes.error;
          }
        } else {
          prods = viewRes.data;
        }
      } catch (err: any) {
        const errCode = err?.code;
        const errMsg = String(err?.message || '');
        const isMissingRelation =
          errCode === '42P01' ||
          errMsg.includes('42P01') ||
          (errMsg.toLowerCase().includes('relation') && errMsg.toLowerCase().includes('does not exist'));

        if (isMissingRelation) {
          // Fallback once to table 'products' with the store columns without visitor_price
          const fallbackRes = await withTimeout(
            supabase
              .from('products')
              .select(storeColumns),
            15000,
            'مهلت زمانی دریافت اطلاعات کالاها به پایان رسید'
          );
          prods = fallbackRes.data;
          prodsErr = fallbackRes.error;
        } else {
          prodsErr = err;
        }
      }
    } else {
      // For other roles (admin, warehouse, visitor): fetch full product columns including visitor_price
      const fullRes = await withTimeout(
        supabase
          .from('products')
          .select(fullColumns),
        15000,
        'مهلت زمانی دریافت اطلاعات کالاها به پایان رسید'
      );
      prods = fullRes.data;
      prodsErr = fullRes.error;
    }

    if (prodsErr) throw prodsErr;

    const validProds: Product[] = (prods || [])
      .filter((p: any) => !LEGACY_MOCK_NAMES.has(p.name?.trim()))
      .map((p: any) => ({
        ...p,
        visitor_price: isStoreRole ? undefined : (p.visitor_price !== undefined && p.visitor_price !== null ? Number(p.visitor_price) : undefined),
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
            const sanitized = isStoreRole
              ? parsed.map((p: any) => ({ ...p, visitor_price: undefined }))
              : parsed;
            const fallbackJson = JSON.stringify(sanitized);
            if (lastStateJsonRef.current.products !== fallbackJson) {
              lastStateJsonRef.current.products = fallbackJson;
              setProducts(sanitized);
            }
          }
        }
      } catch {}
    }
  }, [setProducts, role]);

  // B. Fetch Orders with Items (Critical)
  const fetchOrders = useCallback(async () => {
    if (!supabase) return;
    let ordsData: any[] = [];
    const { data: ords, error: ordsErr } = await withTimeout(
      supabase
        .from('orders')
        .select('id, supermarket_id, supermarket_name, assigned_visitor_id, visitor_name, status, total_amount, order_source, order_channel, reassignment_id, loading_bill_id, invoice_revised_at, order_date, stock_deducted, discount_percent, discount_status, discount_set_by, discount_reviewed_by, discount_reviewed_at, pickup_discount_percent, founder_discount_percent, items:order_items(id, order_id, product_id, name, price, quantity, items_per_package, unit, created_at)'),
      15000,
      'مهلت زمانی دریافت اطلاعات سفارش‌ها به پایان رسید'
    );

    if (!ordsErr && ords) {
      ordsData = ords;
    } else {
      // Fallback: query orders and order_items separately if relationship embedding fails
      const { data: rawOrders, error: rawOrdersErr } = await withTimeout(
        supabase
          .from('orders')
          .select('id, supermarket_id, supermarket_name, assigned_visitor_id, visitor_name, status, total_amount, order_source, order_channel, reassignment_id, loading_bill_id, invoice_revised_at, order_date, stock_deducted, discount_percent, discount_status, discount_set_by, discount_reviewed_by, discount_reviewed_at, pickup_discount_percent, founder_discount_percent'),
        15000,
        'مهلت زمانی دریافت اطلاعات سفارش‌ها به پایان رسید'
      );
      if (rawOrdersErr && ordsErr) throw ordsErr;
      const { data: rawItems } = await withTimeout(
        supabase.from('order_items').select('id, order_id, product_id, name, price, quantity, items_per_package, unit, created_at'),
        15000
      ).catch(() => ({ data: [] }));

      ordsData = (rawOrders || []).map((o: any) => ({
        ...o,
        items: (rawItems || []).filter((it: any) => it.order_id === o.id),
      }));
    }

    const cleanOrds: Order[] = ordsData
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

  // C. Fetch Categories (Critical)
  const fetchCategories = useCallback(async () => {
    if (!supabase) return;
    const { data: cats, error: catsErr } = await withTimeout(
      supabase
        .from('categories')
        .select('id, name, icon, sort_order, created_at')
        .order('sort_order', { ascending: true }),
      15000,
      'مهلت زمانی دریافت دسته‌بندی‌ها به پایان رسید'
    );

    if (catsErr) throw catsErr;

    if (cats && cats.length > 0) {
      const jsonStr = JSON.stringify(cats);
      if (lastStateJsonRef.current.categories !== jsonStr) {
        lastStateJsonRef.current.categories = jsonStr;
        setCategories(cats);
      }
    }
  }, [setCategories]);

  // D. Fetch Brands (Critical)
  const fetchBrands = useCallback(async () => {
    if (!supabase) return;
    const { data: brs, error: brsErr } = await withTimeout(
      supabase.from('brands').select('name'),
      15000,
      'مهلت زمانی دریافت برندها به پایان رسید'
    );

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

  // E. Fetch Reassignment Requests (Optional)
  const fetchReassignmentRequests = useCallback(async () => {
    if (!supabase) return;
    const { data: reassigns, error: reassignErr } = await withTimeout(
      supabase
        .from('reassignment_requests')
        .select('id, order_id, supermarket_name, from_visitor_id, from_visitor_name, to_visitor_id, to_visitor_name, status, timestamp, reason')
        .order('timestamp', { ascending: false }),
      15000,
      'مهلت زمانی دریافت درخواست‌های واگذاری به پایان رسید'
    );

    if (reassignErr) throw reassignErr;

    if (reassigns) {
      const jsonStr = JSON.stringify(reassigns);
      if (lastStateJsonRef.current.reassignment_requests !== jsonStr) {
        lastStateJsonRef.current.reassignment_requests = jsonStr;
        setReassignmentRequests(reassigns);
      }
    }
  }, [setReassignmentRequests]);

  // F. Fetch Supermarkets & Profiles (Critical)
  const fetchSupermarkets = useCallback(async () => {
    if (!supabase) return;
    const [smsRes, profRes] = await Promise.all([
      withTimeout(
        supabase
          .from('supermarkets')
          .select('id, name, owner, phone, address, assigned_visitor_id, is_active, username, created_at, founder_discount_enabled, founder_discount_percent, approval_status, registration_source, approved_at, approved_by, approval_note, latitude, longitude'),
        15000,
        'مهلت زمانی دریافت اطلاعات فروشگاه‌ها به پایان رسید'
      ),
      withTimeout(
        supabase.from('profiles').select('id, username'),
        15000,
        'مهلت زمانی دریافت مشخصات کاربری به پایان رسید'
      ).catch(() => ({ data: [], error: null })),
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
        founder_discount_enabled: Boolean(sm.founder_discount_enabled),
        founder_discount_percent: typeof sm.founder_discount_percent === 'number' ? sm.founder_discount_percent : 3,
        approval_status: (sm.approval_status as any) || 'approved',
        registration_source: sm.registration_source || undefined,
        approved_at: sm.approved_at || null,
        approved_by: sm.approved_by || null,
        approval_note: sm.approval_note || null,
        latitude: sm.latitude ?? null,
        longitude: sm.longitude ?? null,
      };
    });

    const jsonStr = JSON.stringify(cleanSms);
    if (lastStateJsonRef.current.supermarkets !== jsonStr) {
      lastStateJsonRef.current.supermarkets = jsonStr;
      setSupermarkets(cleanSms);
    }
  }, [setSupermarkets]);

  // G. Fetch Visitors & Profiles (Critical)
  const fetchVisitors = useCallback(async () => {
    if (!supabase) return;
    const [visRes, profRes] = await Promise.all([
      withTimeout(
        supabase
          .from('visitors')
          .select('id, name, phone, region, is_active, username, created_at'),
        15000,
        'مهلت زمانی دریافت اطلاعات ویزیتورها به پایان رسید'
      ),
      withTimeout(
        supabase.from('profiles').select('id, username'),
        15000,
        'مهلت زمانی دریافت مشخصات کاربری به پایان رسید'
      ).catch(() => ({ data: [], error: null })),
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

  // H. Fetch Loading Bills with Items (Critical)
  const fetchLoadingBills = useCallback(async () => {
    if (!supabase) return;
    let fetchedBills: LoadingBill[] = [];
    const { data: billsData, error: billsErr } = await withTimeout(
      supabase
        .from('loading_bills')
        .select('id, invoice_no, visitor_id, visitor_name, status, orders_count, total_visitor_cost, total_store_amount, revision_count, last_revised_by, approved_by, approved_at, finalized_by, finalized_at, cancel_reason, admin_note, exit_approved_by, exit_approved_at, created_at, submitted_at, items:loading_bill_items(id, loading_bill_id, order_id, product_id, product_name, quantity, original_quantity, store_price, visitor_price, source, customer_label, line_note, created_at)')
        .order('created_at', { ascending: false }),
      15000,
      'مهلت زمانی دریافت فاکتورهای بارگیری به پایان رسید'
    );

    if (!billsErr && billsData) {
      fetchedBills = billsData;
    } else {
      const { data: bData } = await withTimeout(
        supabase
          .from('loading_bills')
          .select('*')
          .order('created_at', { ascending: false }),
        15000
      );
      const { data: iData } = await withTimeout(
        supabase.from('loading_bill_items').select('*'),
        15000
      );

      if (bData) {
        fetchedBills = bData.map((b: LoadingBill) => ({
          ...b,
          items: iData ? iData.filter((it: { loading_bill_id: string }) => it.loading_bill_id === b.id) : [],
        }));
      }
    }

    // Unify all bill and invoice numbers to standard VS format (e.g. VS01-1001-1)
    fetchedBills = fetchedBills.map((b) => {
      const unifiedNo = formatUnifiedBillNumber(b.id, b.invoice_no, b.visitor_id);
      return {
        ...b,
        invoice_no: unifiedNo,
      };
    });

    // Silently patch any legacy records in remote Supabase table in background
    for (const b of fetchedBills) {
      if (b.invoice_no && (b.id?.startsWith('F-') || b.id?.startsWith('BL-') || b.invoice_no?.startsWith('F-') || b.invoice_no?.startsWith('BL-'))) {
        const unified = formatUnifiedBillNumber(b.id, b.invoice_no, b.visitor_id);
        supabase.from('loading_bills').update({ invoice_no: unified }).eq('id', b.id).then();
      }
    }

    const jsonStr = JSON.stringify(fetchedBills);
    if (lastStateJsonRef.current.loading_bills !== jsonStr) {
      lastStateJsonRef.current.loading_bills = jsonStr;
      setLoadingBills(fetchedBills);
    }
  }, [setLoadingBills]);

  // I. Fetch Inventory Transactions (Optional - Limited to Admin & Warehouse, max 500 rows)
  const fetchInventoryTransactions = useCallback(async () => {
    if (!supabase) return;
    // Cap: Only fetch for staff roles (admin and warehouse) to save CPU and network bandwidth
    if (role && role !== 'admin' && role !== 'warehouse') {
      return;
    }

    const { data: txData, error: txErr } = await withTimeout(
      supabase
        .from('inventory_transactions')
        .select('id, product_id, product_name, transaction_type, quantity, reference_id, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      15000,
      'مهلت زمانی دریافت تراکنش‌های انبار به پایان رسید'
    );

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

  // J. Fetch Product Likes (Optional)
  const fetchProductLikes = useCallback(async () => {
    if (!supabase || !setProductLikes) return;
    try {
      const { data: likesData, error: likesErr } = await withTimeout(
        supabase
          .from('product_likes')
          .select('id, product_id, supermarket_id, supermarket_name, supermarket_owner, supermarket_phone, created_at'),
        15000
      );

      if (!likesErr && likesData && Array.isArray(likesData)) {
        const jsonStr = JSON.stringify(likesData);
        if (lastStateJsonRef.current.product_likes !== jsonStr) {
          lastStateJsonRef.current.product_likes = jsonStr;
          setProductLikes(likesData);
        }
      }
    } catch (err) {
      console.warn('Optional product_likes sync notice:', err);
    }
  }, [setProductLikes]);

  // Forward declaration of scheduleReload for use in retry mechanism
  const scheduleReloadRef = useRef<((tables?: SyncTable[], immediate?: boolean) => void) | null>(null);

  // 4. Core Execution Coordinator with Critical Table Gating & Automatic Retry
  const executeDirtyFetches = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsDataReady?.(true);
      return;
    }

    // Guard: strictly do not fetch if user is not logged in with an active Supabase session
    if (!currentUserIdRef.current) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        currentUserIdRef.current = null;
        return;
      }
      currentUserIdRef.current = session.user.id;
    } catch {
      return;
    }

    if (isFetchingRef.current) {
      // Another fetch is already in flight. Queued tables will be picked up when it completes.
      return;
    }

    isFetchingRef.current = true;

    // Requirement 2: Clear fetchError at the start of every sync attempt
    setFetchError?.(null);

    // Snapshot tables that need sync
    const tablesToSync = new Set(dirtyTablesRef.current);
    dirtyTablesRef.current.clear();

    const tasks: { table: SyncTable; run: () => Promise<void> }[] = [];

    if (tablesToSync.has('products')) tasks.push({ table: 'products', run: fetchProducts });
    if (tablesToSync.has('orders')) tasks.push({ table: 'orders', run: fetchOrders });
    if (tablesToSync.has('categories')) tasks.push({ table: 'categories', run: fetchCategories });
    if (tablesToSync.has('brands')) tasks.push({ table: 'brands', run: fetchBrands });
    if (tablesToSync.has('reassignment_requests')) tasks.push({ table: 'reassignment_requests', run: fetchReassignmentRequests });
    if (tablesToSync.has('supermarkets')) tasks.push({ table: 'supermarkets', run: fetchSupermarkets });
    if (tablesToSync.has('visitors')) tasks.push({ table: 'visitors', run: fetchVisitors });
    if (tablesToSync.has('loading_bills')) tasks.push({ table: 'loading_bills', run: fetchLoadingBills });
    if (tablesToSync.has('inventory_transactions')) tasks.push({ table: 'inventory_transactions', run: fetchInventoryTransactions });
    if (tablesToSync.has('product_likes')) tasks.push({ table: 'product_likes', run: fetchProductLikes });

    const criticalErrors: { table: SyncTable; error: Error }[] = [];

    // Execute tasks concurrently with individual table error isolation
    const results = await Promise.allSettled(
      tasks.map(async ({ table, run }) => {
        try {
          await run();
        } catch (err: unknown) {
          const tableError = err instanceof Error ? err : new Error(String(err));
          if (CRITICAL_TABLES.has(table)) {
            criticalErrors.push({ table, error: tableError });
          } else {
            // Optional tables: warn only, do NOT trigger error banner
            console.warn(`Optional table (${table}) sync notice:`, tableError.message);
          }
        }
      })
    );

    isFetchingRef.current = false;

    // Evaluate results: Critical tables vs Optional tables
    if (criticalErrors.length === 0) {
      // Success! All critical tables loaded successfully
      setFetchError?.(null);
      setIsDataReady?.(true);
      isInitialFetchDoneRef.current = true;
      retryAttemptRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    } else {
      // Critical table(s) failed!
      console.warn('Critical tables sync failure:', criticalErrors);

      // Requirement 3: Automatic Retry Mechanism for initial load (up to 3 retries: 1s, 2s, 4s)
      if (!isInitialFetchDoneRef.current) {
        const retryDelays = [1000, 2000, 4000];
        const attempt = retryAttemptRef.current;

        if (attempt < 3) {
          const delay = retryDelays[attempt];
          retryAttemptRef.current = attempt + 1;
          setFetchError?.(null); // Keep error hidden during automated retry attempts

          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
          }

          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            scheduleReloadRef.current?.(ALL_SYNC_TABLES, true);
          }, delay);
        } else {
          // All 3 automatic retries failed. Now show the real error banner.
          const firstErr = criticalErrors[0]?.error?.message || 'خطا در برقراری ارتباط با پایگاه داده';
          setFetchError?.(firstErr);
          setIsDataReady?.(false);
        }
      } else {
        // Subsequent background polling/realtime failure after initial load succeeded
        console.warn('Background sync encountered critical error without breaking UI view:', criticalErrors);
      }
    }

    // Follow-up for any new realtime changes that queued up during this fetch
    if (dirtyTablesRef.current.size > 0 && typeof document !== 'undefined' && !document.hidden) {
      executeDirtyFetches();
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

  // Keep ref up to date for retry callbacks
  useEffect(() => {
    scheduleReloadRef.current = scheduleReload;
  }, [scheduleReload]);

  // 6. User Login/Logout Lifecycle Listener (Requirement 1)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsDataReady?.(true);
      return;
    }

    // Check existing active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (currentUserIdRef.current !== session.user.id) {
          currentUserIdRef.current = session.user.id;
          isInitialFetchDoneRef.current = false;
          retryAttemptRef.current = 0;
          setFetchError?.(null);
          purgeOperationalLocalStorage();
          scheduleReload(ALL_SYNC_TABLES, true);
        }
      } else {
        // No session: do NOT start fetching!
        currentUserIdRef.current = null;
        setIsDataReady?.(false);
        setFetchError?.(null);
      }
    });

    // Listen to Supabase auth events
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session?.user)) {
        if (session?.user && currentUserIdRef.current !== session.user.id) {
          currentUserIdRef.current = session.user.id;
          // Fresh user login: reset flags and immediately trigger full initial fetch
          isInitialFetchDoneRef.current = false;
          retryAttemptRef.current = 0;
          setFetchError?.(null);
          purgeOperationalLocalStorage();
          scheduleReload(ALL_SYNC_TABLES, true);
        }
      } else if (event === 'SIGNED_OUT' || !session) {
        if (currentUserIdRef.current !== null) {
          currentUserIdRef.current = null;
          // User logout: Reset all operational state and tracking refs
          setProducts([]);
          setOrders([]);
          setCategories([]);
          setBrands([]);
          setUnits?.([]);
          setReassignmentRequests([]);
          setSupermarkets([]);
          setVisitors([]);
          setLoadingBills([]);
          setInventoryTransactions([]);
          setProductLikes?.([]);

          setFetchError?.(null);
          setIsDataReady?.(false);
          isInitialFetchDoneRef.current = false;
          retryAttemptRef.current = 0;

          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          dirtyTablesRef.current.clear();
          lastStateJsonRef.current = {
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
          };
        }
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, [
    scheduleReload,
    setProducts,
    setOrders,
    setCategories,
    setBrands,
    setUnits,
    setReassignmentRequests,
    setSupermarkets,
    setVisitors,
    setLoadingBills,
    setInventoryTransactions,
    setProductLikes,
    setFetchError,
    setIsDataReady,
  ]);

  // 7. Background Event & Realtime Subscriptions (Active only when user is logged in)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    // 60-second backup polling (skip execution if tab is hidden or user not logged in)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden && currentUserIdRef.current) {
        scheduleReload(ALL_SYNC_TABLES);
      }
    }, 60000);

    // Visibility change handler: when user returns to tab, perform a fresh sync
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentUserIdRef.current) {
        scheduleReload(ALL_SYNC_TABLES);
      }
    };

    // Window focus handler: sync if not hidden
    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible' && currentUserIdRef.current) {
        scheduleReload(ALL_SYNC_TABLES);
      }
    };

    // Online reconnection handler
    const handleOnline = () => {
      if (currentUserIdRef.current) {
        scheduleReload(ALL_SYNC_TABLES, true);
        onShowToast?.('اتصال اینترنت برقرار شد. اطلاعات به‌روزرسانی شدند.', 'success');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    // Granular Realtime Supabase Channel Subscriptions for tables
    let channelBuilder = supabase
      .channel('app-db-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loading_bills' },
        (payload) => {
          if (!currentUserIdRef.current) return;
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
          if (currentUserIdRef.current) scheduleReload(['orders']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supermarkets' },
        () => {
          if (currentUserIdRef.current) scheduleReload(['supermarkets']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitors' },
        () => {
          if (currentUserIdRef.current) scheduleReload(['visitors']);
        }
      );

    // Subscribe to products table realtime changes ONLY for non-supermarket roles (admin, warehouse, visitor)
    if (role !== 'supermarket') {
      channelBuilder = channelBuilder.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          if (currentUserIdRef.current) scheduleReload(['products']);
        }
      );
    }

    channelBuilder = channelBuilder
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reassignment_requests' },
        () => {
          if (currentUserIdRef.current) scheduleReload(['reassignment_requests']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_transactions' },
        () => {
          if (currentUserIdRef.current) scheduleReload(['inventory_transactions']);
        }
      );

    const realtimeChannel = channelBuilder.subscribe();

    return () => {
      clearInterval(interval);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [scheduleReload, role, currentUser, onShowToast]);

  // 8. Manual Reload Trigger (when reloadCounter changes via refreshData or retryFetch)
  useEffect(() => {
    if (reloadCounter > 0 && currentUserIdRef.current) {
      isInitialFetchDoneRef.current = false;
      retryAttemptRef.current = 0;
      setFetchError?.(null);
      scheduleReload(ALL_SYNC_TABLES, true);
    }
  }, [reloadCounter, scheduleReload, setFetchError]);

  // 9. LocalStorage Cross-Tab Realtime Sync (Only active in mock / local storage mode)
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
