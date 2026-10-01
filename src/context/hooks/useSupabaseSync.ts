import React, { useEffect } from 'react';
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
import { STORAGE_KEYS, getDeletedIds, getMarketTestIds, setMarketTestId, getOrderChannel } from '../utils';

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
}: UseSupabaseSyncProps) {
  const DUMMY_SUPERMARKET_IDS = new Set(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']);
  const DUMMY_VISITOR_IDS = new Set(['vis-1', 'vis-2', 'vis-3']);

  // 1. Supabase Realtime & Polling Sync
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const PRESET_CAT_IDS = new Set(['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5']);

    // Proactively clean up legacy dummy mock accounts and mock products if any
    supabase.from('supermarkets').delete().in('id', Array.from(DUMMY_SUPERMARKET_IDS)).then(() => {});
    supabase.from('visitors').delete().in('id', Array.from(DUMMY_VISITOR_IDS)).then(() => {});
    supabase.from('profiles').delete().in('id', Array.from(DUMMY_VISITOR_IDS)).then(() => {});
    supabase.from('products').delete().in('name', Array.from(LEGACY_MOCK_NAMES)).then(() => {});
    supabase.from('inventory_transactions').delete().or('product_id.like.prod-%,reference_id.like.ord-%').then(() => {});

    async function loadFromSupabase() {
      try {
        // 1. Products - Merge with local state so newly imported items are never wiped out, but respect deleted tombstones
        const deletedProductIds = getDeletedIds(STORAGE_KEYS.DELETED_PRODUCT_IDS);
        const { data: prods, error: prodsErr } = await supabase!.from('products').select('*');
        if (!prodsErr && prods !== null) {
          // If Supabase returned any tombstoned products, actively purge them from Supabase
          if (deletedProductIds.size > 0) {
            const resurrected = prods.filter((p: Product) => deletedProductIds.has(p.id));
            if (resurrected.length > 0) {
              const resIds = resurrected.map((p: Product) => p.id);
              supabase!.from('products').delete().in('id', resIds).then(() => {});
            }
          }

          const validProds = (prods || []).filter(
            (p: Product) => !LEGACY_MOCK_NAMES.has(p.name?.trim()) && !deletedProductIds.has(p.id)
          );

          setProducts((prev) => {
            const marketTestIds = getMarketTestIds();
            const dbMap = new Map(validProds.map((p: Product) => [p.id, p]));
            const localMap = new Map(prev.map((p: Product) => [p.id, p]));
            const localOnlyItems: Product[] = [];

            // Merge server data with any locally edited properties (like name, is_active, image_url, is_market_test, etc.)
            const merged: Product[] = validProds.map((dbProd: Product) => {
              const localProd = localMap.get(dbProd.id);

              const finalName = (localProd?.name && localProd.name.trim() !== dbProd.name?.trim())
                ? localProd.name
                : dbProd.name;
              const finalBrand = (localProd?.brand && localProd.brand !== dbProd.brand)
                ? localProd.brand
                : dbProd.brand;
              const finalIsActive = localProd?.is_active !== undefined
                ? localProd.is_active
                : (dbProd.is_active ?? true);
              const finalImage = (localProd?.image_url && localProd.image_url !== dbProd.image_url) 
                ? localProd.image_url 
                : dbProd.image_url;

              // Check is_market_test:
              const isMarketTestInStorage = marketTestIds.has(dbProd.id);
              let finalIsMarketTest = false;
              if (isMarketTestInStorage) {
                finalIsMarketTest = true;
              } else if (dbProd.is_market_test === true) {
                finalIsMarketTest = true;
                setMarketTestId(dbProd.id, true);
              } else if (localProd?.is_market_test !== undefined) {
                finalIsMarketTest = Boolean(localProd.is_market_test);
              } else {
                finalIsMarketTest = false;
              }

              const mergedItem: Product = {
                ...dbProd,
                name: finalName,
                brand: finalBrand,
                image_url: finalImage,
                is_active: finalIsActive,
                is_market_test: finalIsMarketTest,
              };

              // If local edits differ from dbProd, re-sync to Supabase in background
              if (
                (localProd?.name && localProd.name.trim() !== dbProd.name?.trim()) ||
                (localProd?.is_active !== undefined && localProd.is_active !== dbProd.is_active) ||
                (localProd?.image_url && localProd.image_url !== dbProd.image_url)
              ) {
                if (isSupabaseConfigured && supabase) {
                  supabase.from('products').update({
                    name: finalName,
                    is_active: finalIsActive,
                    image_url: finalImage,
                  }).eq('id', dbProd.id).then(() => {});
                }
              }

              return mergedItem;
            });

            prev.forEach((localP) => {
              if (
                !LEGACY_MOCK_NAMES.has(localP.name?.trim()) &&
                !deletedProductIds.has(localP.id) &&
                !dbMap.has(localP.id)
              ) {
                merged.push(localP);
                localOnlyItems.push(localP);
              }
            });

            // If local products exist that aren't yet in Supabase (e.g. after refresh or offline import), auto-sync them up!
            if (localOnlyItems.length > 0 && isSupabaseConfigured && supabase) {
              const rows = localOnlyItems.map((p) => ({
                id: p.id,
                name: p.name,
                category_id: p.category_id || null,
                brand: p.brand || 'متفرقه',
                price: Number(p.price) || 0,
                visitor_price: p.visitor_price || Math.round(Number(p.price) * 0.85),
                consumer_price: p.consumer_price || null,
                stock: p.stock ?? 50,
                reserved_stock: p.reserved_stock ?? 0,
                unit: p.unit || 'عدد',
                image_url: p.image_url || 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer',
                is_active: p.is_active ?? true,
                is_market_test: Boolean(p.is_market_test),
              }));
              supabase.from('products').upsert(rows, { onConflict: 'id' }).then(({ error }) => {
                if (error) {
                  // Fallback without optional columns if schema is older
                  const rowsSafe = rows.map(({ is_market_test, consumer_price, visitor_price, ...rest }) => rest);
                  supabase.from('products').upsert(rowsSafe, { onConflict: 'id' }).then(() => {});
                }
              });
            }

            try {
              localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
            } catch {}

            return merged;
          });
        }

        // 2. Orders (includes loading_bill_id & status='loading')
        const { data: ords } = await supabase!.from('orders').select('*, items:order_items(*)');
        if (ords) {
          const cleanOrds = ords
            .filter(
              (o: Order) =>
                Boolean(o.id) &&
                !o.items?.some((it) => LEGACY_MOCK_NAMES.has(it.name?.trim()))
            )
            .map((o: Order) => ({
              ...o,
              supermarket_id: o.supermarket_id || 'direct-store',
              supermarket_name: o.supermarket_name || 'فروشگاه طرف قرارداد',
              assigned_visitor_id: o.assigned_visitor_id || 'direct',
              visitor_name:
                o.visitor_name ||
                (o.assigned_visitor_id && o.assigned_visitor_id !== 'direct'
                  ? 'ویزیتور'
                  : 'خرید مستقیم از پخش مرکزی'),
              order_channel: getOrderChannel(o),
            }));

          setOrders((prev) => {
            const dbIds = new Set(cleanOrds.map((o) => o.id));
            const localOnly = prev.filter(
              (o) => !dbIds.has(o.id) && !o.items?.some((it) => LEGACY_MOCK_NAMES.has(it.name?.trim()))
            );
            const merged = [...cleanOrds, ...localOnly];

            // Re-sync any local-only orders to Supabase in the background
            if (localOnly.length > 0 && isSupabaseConfigured && supabase) {
              localOnly.forEach(async (pendingOrder) => {
                try {
                  const validVisId =
                    pendingOrder.assigned_visitor_id && pendingOrder.assigned_visitor_id !== 'direct'
                      ? pendingOrder.assigned_visitor_id
                      : null;
                  await supabase!.from('orders').upsert({
                    id: pendingOrder.id,
                    supermarket_id: pendingOrder.supermarket_id && pendingOrder.supermarket_id !== 'direct-store' ? pendingOrder.supermarket_id : null,
                    supermarket_name: pendingOrder.supermarket_name,
                    assigned_visitor_id: validVisId,
                    visitor_name: pendingOrder.visitor_name || 'خرید مستقیم از پخش مرکزی',
                    status: pendingOrder.status,
                    total_amount: pendingOrder.total_amount,
                    order_source: pendingOrder.order_source || 'supermarket',
                    order_channel: getOrderChannel(pendingOrder),
                    order_date: pendingOrder.order_date,
                  }, { onConflict: 'id' });

                  if (pendingOrder.items && pendingOrder.items.length > 0) {
                    await supabase!.from('order_items').upsert(
                      pendingOrder.items.map((i) => ({
                        order_id: pendingOrder.id,
                        product_id: i.product_id,
                        name: i.name,
                        price: i.price,
                        quantity: i.quantity,
                      }))
                    );
                  }
                } catch (e) {
                  console.warn('Re-syncing pending local order note:', e);
                }
              });
            }

            try {
              localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(merged));
            } catch {}

            return merged;
          });
        }

        // 3. Categories - Defensive merge
        const { data: cats, error: catsErr } = await supabase!.from('categories').select('*').order('sort_order', { ascending: true });
        if (!catsErr && cats && cats.length > 0) {
          setCategories((prev) => {
            const dbIds = new Set(cats.map((c: Category) => c.id));
            const localOnly = prev.filter((c) => !dbIds.has(c.id));
            return [...cats, ...localOnly];
          });
        }

        // 4. Brands - Defensive merge
        const { data: brs, error: brsErr } = await supabase!.from('brands').select('name');
        if (!brsErr && brs && brs.length > 0) {
          const dbBrandNames = brs.map((b: { name: string }) => b.name);
          setBrands((prev) => Array.from(new Set([...dbBrandNames, ...prev])));
        }

        // 5. Reassignment Requests
        const { data: reassigns } = await supabase!.from('reassignment_requests').select('*').order('timestamp', { ascending: false });
        if (reassigns) {
          setReassignmentRequests(reassigns);
        }

        // Fetch profiles to enrich username & auto-reconcile missing supermarkets/visitors
        const { data: profiles } = await supabase!.from('profiles').select('*');
        const profileMap = new Map<string, Record<string, any>>(
          (profiles || []).map((p) => [p.id, p])
        );

        // 6. Supermarkets
        const deletedSupermarketIds = getDeletedIds(STORAGE_KEYS.DELETED_SUPERMARKET_IDS);
        const { data: sms } = await supabase!.from('supermarkets').select('*');
        if (sms && deletedSupermarketIds.size > 0) {
          const resurrectedSms = sms.filter((sm: Supermarket) => deletedSupermarketIds.has(sm.id));
          if (resurrectedSms.length > 0) {
            const resIds = resurrectedSms.map((s: Supermarket) => s.id);
            supabase!.from('supermarkets').delete().in('id', resIds).then(() => {});
            supabase!.from('profiles').delete().in('id', resIds).then(() => {});
          }
        }

        const cleanSms: Supermarket[] = sms
          ? sms.filter((sm: Supermarket) => !DUMMY_SUPERMARKET_IDS.has(sm.id) && !deletedSupermarketIds.has(sm.id))
          : [];

        setSupermarkets((prev) => {
          const dbMap = new Map(cleanSms.map((s: Supermarket) => [s.id, s]));
          const mapped = cleanSms.map((sm: Supermarket) => {
            const localMatch = prev.find((p) => p.id === sm.id);
            const prof = profileMap.get(sm.id);
            return {
              ...sm,
              assigned_visitor_id: sm.assigned_visitor_id || 'direct',
              username: prof?.username || localMatch?.username || sm.username || '',
              password: prof?.password || sm.password || localMatch?.password || '123',
            };
          });

          // Keep any locally created supermarkets that are not deleted and not in db yet
          prev.forEach((localSm) => {
            if (!deletedSupermarketIds.has(localSm.id) && !DUMMY_SUPERMARKET_IDS.has(localSm.id) && !dbMap.has(localSm.id)) {
              mapped.push({
                ...localSm,
                assigned_visitor_id: localSm.assigned_visitor_id || 'direct',
                username: localSm.username || '',
                password: localSm.password || '123',
              });
              if (isSupabaseConfigured && supabase) {
                const validVisitorId =
                  localSm.assigned_visitor_id && localSm.assigned_visitor_id !== 'direct'
                    ? localSm.assigned_visitor_id
                    : null;

                supabase.from('profiles').upsert({
                  id: localSm.id,
                  name: localSm.name,
                  role: 'supermarket',
                  phone: localSm.phone,
                  username: localSm.username,
                  password: localSm.password || '123',
                  is_active: localSm.is_active ?? true,
                }).then(() => {});

                supabase.from('supermarkets').upsert({
                  id: localSm.id,
                  name: localSm.name,
                  owner: localSm.owner,
                  phone: localSm.phone,
                  address: localSm.address,
                  assigned_visitor_id: validVisitorId,
                  username: localSm.username,
                  password: localSm.password || '123',
                  is_active: localSm.is_active ?? true,
                }).then(() => {});
              }
            }
          });

          try {
            localStorage.setItem(STORAGE_KEYS.SUPERMARKETS, JSON.stringify(mapped));
          } catch {}
          return mapped;
        });

        // 7. Visitors
        const deletedVisitorIds = getDeletedIds(STORAGE_KEYS.DELETED_VISITOR_IDS);
        const { data: visData } = await supabase!.from('visitors').select('*');
        if (visData && deletedVisitorIds.size > 0) {
          const resurrectedVis = visData.filter((v: Visitor) => deletedVisitorIds.has(v.id));
          if (resurrectedVis.length > 0) {
            const resVisIds = resurrectedVis.map((v: Visitor) => v.id);
            supabase!.from('visitors').delete().in('id', resVisIds).then(() => {});
            supabase!.from('profiles').delete().in('id', resVisIds).then(() => {});
          }
        }

        const cleanVis: Visitor[] = visData
          ? visData.filter((v: Visitor) => !DUMMY_VISITOR_IDS.has(v.id) && !deletedVisitorIds.has(v.id))
          : [];

        setVisitors((prev) => {
          const dbMap = new Map(cleanVis.map((v: Visitor) => [v.id, v]));
          const mapped = cleanVis.map((v: Visitor) => {
            const localMatch = prev.find((p) => p.id === v.id || (p.phone && v.phone && p.phone === v.phone));
            const prof = profileMap.get(v.id);
            let resolvedUsername = prof?.username || v.username || localMatch?.username || '';
            // Filter out any raw UUID string inadvertently stored as username
            if (resolvedUsername && resolvedUsername.includes('-') && resolvedUsername.length > 25) {
              resolvedUsername = (localMatch?.username && !localMatch.username.includes('-')) ? localMatch.username : '';
            }
            return {
              ...v,
              username: resolvedUsername,
              password: prof?.password || v.password || localMatch?.password || '123456',
            };
          });

          // Keep any locally created visitors that are not deleted and not in db yet
          prev.forEach((localV) => {
            if (!deletedVisitorIds.has(localV.id) && !DUMMY_VISITOR_IDS.has(localV.id) && !dbMap.has(localV.id)) {
              mapped.push({
                ...localV,
                username: localV.username || '',
                password: localV.password || '123456',
              });
              if (isSupabaseConfigured && supabase) {
                supabase.from('visitors').upsert({
                  id: localV.id,
                  name: localV.name,
                  phone: localV.phone,
                  region: localV.region || 'مرکز استان',
                  username: localV.username,
                  password: localV.password || '123456',
                  is_active: localV.is_active ?? true,
                }).then(() => {});
              }
            }
          });

          try {
            localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(mapped));
          } catch {}
          return mapped;
        });

        // 8. Loading Bills (with loading_bill_items fallback join)
        let fetchedBills: LoadingBill[] = [];
        const { data: billsData, error: billsErr } = await supabase!
          .from('loading_bills')
          .select('*, items:loading_bill_items(*)')
          .order('created_at', { ascending: false });

        if (!billsErr && billsData) {
          fetchedBills = billsData;
        } else {
          // Fallback query if joined foreign key relation fails or differs
          const { data: bData } = await supabase!
            .from('loading_bills')
            .select('*')
            .order('created_at', { ascending: false });
          const { data: iData } = await supabase!
            .from('loading_bill_items')
            .select('*');

          if (bData) {
            fetchedBills = bData.map((b: LoadingBill) => ({
              ...b,
              items: iData ? iData.filter((it: { loading_bill_id: string }) => it.loading_bill_id === b.id) : [],
            }));
          }
        }

        if (fetchedBills) {
          setLoadingBills(fetchedBills);
        }

        // 9. Inventory Transactions (limit 500)
        const { data: txData } = await supabase!
          .from('inventory_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);

        if (txData && txData.length > 0) {
          const validTxData = txData.filter(
            (t: InventoryTransaction) =>
              !LEGACY_MOCK_NAMES.has(t.product_name?.trim() || '') &&
              !t.product_id?.startsWith('prod-')
          );

          setInventoryTransactions((prev) => {
            const serverIds = new Set(validTxData.map((t: InventoryTransaction) => t.id));
            const localOnly = prev.filter(
              (p) =>
                !serverIds.has(p.id) &&
                !LEGACY_MOCK_NAMES.has(p.product_name?.trim() || '') &&
                !p.product_id?.startsWith('prod-')
            );
            return [...validTxData, ...localOnly];
          });
        }

        // 10. Product Likes (Market testing)
        if (setProductLikes) {
          try {
            const { data: likesData } = await supabase!.from('product_likes').select('*');
            if (likesData && Array.isArray(likesData)) {
              setProductLikes((prev) => {
                const dbIds = new Set(likesData.map((l: ProductLike) => `${l.product_id}_${l.supermarket_id}`));
                const localOnly = prev.filter((p) => !dbIds.has(`${p.product_id}_${p.supermarket_id}`));
                const merged = [...likesData, ...localOnly];
                try {
                  localStorage.setItem(STORAGE_KEYS.PRODUCT_LIKES, JSON.stringify(merged));
                } catch {}
                return merged;
              });
            }
          } catch {
            // Table might not exist yet on older schemas; ignore
          }
        }
      } catch (err: unknown) {
        console.warn('Supabase fetch failed, continuing with local data:', err);
      }
    }

    loadFromSupabase();
    const interval = setInterval(loadFromSupabase, 20000); // Poll every 20s

    // Realtime Supabase Channel Subscription for loading_bills & orders
    const billsChannel = supabase
      .channel('loading-bills-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'loading_bills' },
        async (payload) => {
          const newBillRaw = payload.new as LoadingBill;
          if (!newBillRaw || !newBillRaw.id) return;

          // Fetch items for this new bill with a single fetch
          let items: any[] = [];
          try {
            const { data: itemsData } = await supabase!
              .from('loading_bill_items')
              .select('*')
              .eq('loading_bill_id', newBillRaw.id);
            if (itemsData) items = itemsData;
          } catch (e) {
            console.warn('Failed to fetch loading_bill_items for new bill:', e);
          }

          const completeBill: LoadingBill = {
            ...newBillRaw,
            items,
          };

          setLoadingBills((prev) => {
            if (prev.some((b) => b.id === completeBill.id)) return prev;
            const updated = [completeBill, ...prev];
            try {
              localStorage.setItem(STORAGE_KEYS.LOADING_BILLS, JSON.stringify(updated));
            } catch {}
            return updated;
          });

          // Show Toast notification for warehouse and admin
          if (role === 'warehouse' || role === 'admin') {
            onShowToast?.(`برگه جدید از ${completeBill.visitor_name}`, 'info');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'loading_bills' },
        (payload) => {
          const updatedBillRaw = payload.new as LoadingBill;
          if (!updatedBillRaw || !updatedBillRaw.id) return;

          setLoadingBills((prev) => {
            const oldBill = prev.find((b) => b.id === updatedBillRaw.id);
            const merged: LoadingBill = {
              ...oldBill,
              ...updatedBillRaw,
              items: oldBill?.items || updatedBillRaw.items || [],
            };
            const updated = prev.map((b) => (b.id === merged.id ? merged : b));
            try {
              localStorage.setItem(STORAGE_KEYS.LOADING_BILLS, JSON.stringify(updated));
            } catch {}
            return updated;
          });

          // Show Toast for visitor when their own bill status changes
          if (role === 'visitor' && currentUser) {
            const isMyBill =
              updatedBillRaw.visitor_id === currentUser.id ||
              updatedBillRaw.visitor_name === currentUser.name;
            if (isMyBill) {
              if (updatedBillRaw.status === 'approved') {
                onShowToast?.('برگه شما تایید شد', 'success');
              } else if (updatedBillRaw.status === 'cancelled') {
                const reasonText = updatedBillRaw.cancel_reason ? `: ${updatedBillRaw.cancel_reason}` : '';
                onShowToast?.(`برگه شما لغو شد${reasonText}`, 'error');
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updatedOrder = payload.new as Order;
          if (!updatedOrder || !updatedOrder.id) return;

          setOrders((prev) => {
            const updated = prev.map((o) =>
              o.id === updatedOrder.id
                ? {
                    ...o,
                    ...updatedOrder,
                    status: updatedOrder.status,
                    loading_bill_id: updatedOrder.loading_bill_id,
                  }
                : o
            );
            try {
              localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      if (billsChannel && supabase) {
        supabase.removeChannel(billsChannel);
      }
    };
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
    role,
    currentUser,
    onShowToast,
  ]);

  // 2. LocalStorage Cross-Tab Realtime Sync (Works seamlessly in local / offline storage mode)
  useEffect(() => {
    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.key) return;

      // When loading bills are updated by another tab
      if (e.key === STORAGE_KEYS.LOADING_BILLS && e.newValue) {
        try {
          const newBills: LoadingBill[] = JSON.parse(e.newValue);
          if (Array.isArray(newBills)) {
            setLoadingBills((prev) => {
              const prevIds = new Set(prev.map((b) => b.id));
              const newlyInserted = newBills.find((b) => !prevIds.has(b.id));

              // Toast for warehouse/admin when a new bill was added in another tab
              if (newlyInserted && (role === 'warehouse' || role === 'admin')) {
                onShowToast?.(`برگه جدید از ${newlyInserted.visitor_name}`, 'info');
              }

              // Toast for visitor when a bill status changed in another tab
              newBills.forEach((newB) => {
                const oldB = prev.find((b) => b.id === newB.id);
                if (oldB && oldB.status !== newB.status) {
                  if (role === 'visitor' && currentUser) {
                    const isMyBill =
                      newB.visitor_id === currentUser.id ||
                      newB.visitor_name === currentUser.name;
                    if (isMyBill) {
                      if (newB.status === 'approved') {
                        onShowToast?.('برگه شما تایید شد', 'success');
                      } else if (newB.status === 'cancelled') {
                        const reasonText = newB.cancel_reason ? `: ${newB.cancel_reason}` : '';
                        onShowToast?.(`برگه شما لغو شد${reasonText}`, 'error');
                      }
                    }
                  }
                }
              });

              return newBills;
            });
          }
        } catch (err) {
          console.warn('Storage event parsing for loading bills failed:', err);
        }
      }

      // When orders are updated by another tab
      if (e.key === STORAGE_KEYS.ORDERS && e.newValue) {
        try {
          const newOrders: Order[] = JSON.parse(e.newValue);
          if (Array.isArray(newOrders)) {
            setOrders(newOrders);
          }
        } catch (err) {
          console.warn('Storage event parsing for orders failed:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [setLoadingBills, setOrders, role, currentUser, onShowToast]);
}
