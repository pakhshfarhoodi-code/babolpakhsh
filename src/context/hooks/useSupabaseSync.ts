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
} from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { LEGACY_MOCK_NAMES } from './useCatalog';

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
}: UseSupabaseSyncProps) {
  const DUMMY_SUPERMARKET_IDS = new Set(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']);
  const DUMMY_VISITOR_IDS = new Set(['vis-1', 'vis-2', 'vis-3']);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const PRESET_CAT_IDS = new Set(['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5']);

    // Proactively clean up legacy dummy mock accounts and mock products if any
    supabase.from('supermarkets').delete().in('id', Array.from(DUMMY_SUPERMARKET_IDS)).then(() => {});
    supabase.from('visitors').delete().in('id', Array.from(DUMMY_VISITOR_IDS)).then(() => {});
    supabase.from('profiles').delete().in('id', Array.from(DUMMY_VISITOR_IDS)).then(() => {});
    supabase.from('products').delete().in('name', Array.from(LEGACY_MOCK_NAMES)).then(() => {});

    async function loadFromSupabase() {
      try {
        // 1. Products - Merge with local state so newly imported items are never wiped out
        const { data: prods, error: prodsErr } = await supabase!.from('products').select('*');
        if (!prodsErr && prods !== null) {
          const validProds = (prods || []).filter((p: Product) => !LEGACY_MOCK_NAMES.has(p.name?.trim()));
          setProducts((prev) => {
            const dbMap = new Map(validProds.map((p: Product) => [p.id, p]));
            const merged: Product[] = [...validProds];
            const localOnlyItems: Product[] = [];
            prev.forEach((localP) => {
              if (!LEGACY_MOCK_NAMES.has(localP.name?.trim()) && !dbMap.has(localP.id)) {
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
              }));
              supabase.from('products').upsert(rows, { onConflict: 'id' }).then(({ error }) => {
                if (error) {
                  // Fallback without optional columns if schema is older
                  const rowsSafe = rows.map(({ consumer_price, visitor_price, ...rest }) => rest);
                  supabase.from('products').upsert(rowsSafe, { onConflict: 'id' }).then(() => {});
                }
              });
            }

            return merged;
          });
        }

        // 2. Orders (includes loading_bill_id & status='loading')
        const { data: ords } = await supabase!.from('orders').select('*, items:order_items(*)');
        if (ords && ords.length > 0) {
          const cleanOrds = ords.filter((o: Order) => !o.items?.some((it) => LEGACY_MOCK_NAMES.has(it.name?.trim())));
          setOrders(cleanOrds);
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
        const { data: sms } = await supabase!.from('supermarkets').select('*');
        const cleanSms: Supermarket[] = sms
          ? sms.filter((sm: Supermarket) => !DUMMY_SUPERMARKET_IDS.has(sm.id))
          : [];

        setSupermarkets((prev) => {
          return cleanSms.map((sm: Supermarket) => {
            const localMatch = prev.find((p) => p.id === sm.id);
            const prof = profileMap.get(sm.id);
            return {
              ...sm,
              username: prof?.username || localMatch?.username || sm.username || '',
              password: prof?.password || sm.password || localMatch?.password || '123',
            };
          });
        });

        // 7. Visitors
        const { data: visData } = await supabase!.from('visitors').select('*');
        const cleanVis: Visitor[] = visData
          ? visData.filter((v: Visitor) => !DUMMY_VISITOR_IDS.has(v.id))
          : [];

        setVisitors((prev) => {
          return cleanVis.map((v: Visitor) => {
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
          setInventoryTransactions((prev) => {
            const serverIds = new Set(txData.map((t: InventoryTransaction) => t.id));
            const localOnly = prev.filter((p) => !serverIds.has(p.id));
            return [...txData, ...localOnly];
          });
        }
      } catch (err: unknown) {
        console.warn('Supabase fetch failed, continuing with local data:', err);
      }
    }

    loadFromSupabase();
    const interval = setInterval(loadFromSupabase, 20000); // Poll every 20s
    return () => clearInterval(interval);
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
  ]);
}
