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

  // 1. Supabase Database-First Fetch & Sync
  const loadFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsDataReady?.(true);
      return;
    }

    try {
      // 1. Products - DB is the primary source of truth, fallback to local cache if DB is empty
      const { data: prods, error: prodsErr } = await supabase.from('products').select('*');
      if (prodsErr) throw prodsErr;

      const validProds: Product[] = (prods || [])
        .filter((p: Product) => !LEGACY_MOCK_NAMES.has(p.name?.trim()))
        .map((p: Product) => ({
          ...p,
          is_active: p.is_active ?? true,
          is_market_test: Boolean(p.is_market_test),
        }));

      if (validProds.length > 0) {
        setProducts(validProds);
        try {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(validProds));
        } catch {}
      } else {
        // If DB returned 0 products (e.g. fresh DB before migration), keep locally imported products
        try {
          const localSaved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProducts(parsed);
            } else {
              setProducts([]);
            }
          } else {
            setProducts([]);
          }
        } catch {
          setProducts([]);
        }
      }

      // 2. Orders with items - DB is the single source of truth, replaces state
      const { data: ords, error: ordsErr } = await supabase.from('orders').select('*, items:order_items(*)');
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
      setOrders(cleanOrds);

      // 3. Categories
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (cats && cats.length > 0) {
        setCategories(cats);
      }

      // 4. Brands
      const { data: brs } = await supabase.from('brands').select('name');
      if (brs && brs.length > 0) {
        const dbBrandNames = Array.from(new Set(brs.map((b: { name: string }) => b.name).filter(Boolean)));
        setBrands(dbBrandNames);
      }

      // 5. Reassignment Requests
      const { data: reassigns } = await supabase
        .from('reassignment_requests')
        .select('*')
        .order('timestamp', { ascending: false });
      if (reassigns) {
        setReassignmentRequests(reassigns);
      }

      // Fetch profiles with explicit columns (no password column selected)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, role, phone, username, is_active, created_at');
      const profileMap = new Map<string, Record<string, any>>(
        (profiles || []).map((p) => [p.id, p])
      );

      // 6. Supermarkets - DB is single source of truth, replaces state (explicit columns, no password)
      const { data: sms, error: smsErr } = await supabase
        .from('supermarkets')
        .select('id, name, owner, phone, address, assigned_visitor_id, is_active, username, created_at');
      if (smsErr) throw smsErr;

      const cleanSms: Supermarket[] = (sms || []).map((sm: any) => {
        const prof = profileMap.get(sm.id);
        return {
          id: sm.id,
          name: sm.name,
          owner: sm.owner || '',
          phone: sm.phone || '',
          address: sm.address || '',
          assigned_visitor_id: sm.assigned_visitor_id || 'direct',
          is_active: sm.is_active ?? true,
          username: prof?.username || sm.username || sm.phone || '',
          created_at: sm.created_at,
        };
      });
      setSupermarkets(cleanSms);

      // 7. Visitors - DB is single source of truth, replaces state (explicit columns, no password)
      const { data: visData, error: visErr } = await supabase
        .from('visitors')
        .select('id, name, phone, region, is_active, username, created_at');
      if (visErr) throw visErr;

      const cleanVis: Visitor[] = (visData || []).map((v: any) => {
        const prof = profileMap.get(v.id);
        let resolvedUsername = prof?.username || v.username || '';
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
      setVisitors(cleanVis);

      // 8. Loading Bills (with loading_bill_items)
      let fetchedBills: LoadingBill[] = [];
      const { data: billsData, error: billsErr } = await supabase
        .from('loading_bills')
        .select('*, items:loading_bill_items(*)')
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
      setLoadingBills(fetchedBills);

      // 9. Inventory Transactions (limit 500)
      const { data: txData } = await supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (txData) {
        const validTxData = txData.filter(
          (t: InventoryTransaction) =>
            !LEGACY_MOCK_NAMES.has(t.product_name?.trim() || '') &&
            !t.product_id?.startsWith('prod-')
        );
        setInventoryTransactions(validTxData);
      }

      // 10. Product Likes (Market testing)
      if (setProductLikes) {
        try {
          const { data: likesData } = await supabase.from('product_likes').select('*');
          if (likesData && Array.isArray(likesData)) {
            setProductLikes(likesData);
          }
        } catch {
          // table optional
        }
      }

      // Mark success
      setFetchError?.(null);
      setIsDataReady?.(true);
      isInitialFetchDoneRef.current = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ارتباط با پایگاه داده';
      console.warn('Supabase fetch notice:', msg);
      if (!isInitialFetchDoneRef.current) {
        setFetchError?.(msg);
      }
    }
  }, [
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
    setIsDataReady,
    setFetchError,
  ]);

  // Initial load, reload on trigger, and background 60s fallback polling
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsDataReady?.(true);
      return;
    }

    // Purge old operational localStorage keys once on startup in Supabase mode
    purgeOperationalLocalStorage();

    loadFromSupabase();

    // 60-second backup polling
    const interval = setInterval(loadFromSupabase, 60000);

    // Event listeners: tab visibility, window focus, and online reconnection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadFromSupabase();
      }
    };

    const handleWindowFocus = () => {
      loadFromSupabase();
    };

    const handleOnline = () => {
      loadFromSupabase();
      onShowToast?.('اتصال اینترنت برقرار شد. اطلاعات به‌روزرسانی شدند.', 'success');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    // Realtime Supabase Channel Subscriptions for tables
    const realtimeChannel = supabase
      .channel('app-db-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loading_bills' },
        async (payload) => {
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
          loadFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supermarkets' },
        () => {
          loadFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitors' },
        () => {
          loadFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          loadFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reassignment_requests' },
        () => {
          loadFromSupabase();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [loadFromSupabase, reloadCounter, role, currentUser, onShowToast, setIsDataReady]);

  // 2. LocalStorage Cross-Tab Realtime Sync (Only active in mock / local storage mode)
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
