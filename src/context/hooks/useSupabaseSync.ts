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

interface UseSupabaseSyncProps {
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setBrands: React.Dispatch<React.SetStateAction<string[]>>;
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
  const DUMMY_PRODUCT_IDS = new Set(['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6', 'prod-7', 'prod-8', 'prod-9']);
  const DUMMY_SUPERMARKET_IDS = new Set(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']);
  const DUMMY_VISITOR_IDS = new Set(['vis-1', 'vis-2', 'vis-3']);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Proactively clean up any legacy seed mock data from Supabase
    supabase.from('products').delete().in('id', Array.from(DUMMY_PRODUCT_IDS)).then(() => {});
    supabase.from('supermarkets').delete().in('id', Array.from(DUMMY_SUPERMARKET_IDS)).then(() => {});
    supabase.from('visitors').delete().in('id', Array.from(DUMMY_VISITOR_IDS)).then(() => {});
    supabase.from('profiles').delete().in('id', Array.from(DUMMY_VISITOR_IDS)).then(() => {});

    async function loadFromSupabase() {
      try {
        // 1. Products
        const { data: prods } = await supabase!.from('products').select('*');
        if (prods) {
          const cleanProds = prods.filter((p: Product) => !DUMMY_PRODUCT_IDS.has(p.id));
          setProducts(cleanProds);
        }

        // 2. Orders (includes loading_bill_id & status='loading')
        const { data: ords } = await supabase!.from('orders').select('*, items:order_items(*)');
        if (ords) {
          setOrders(ords);
        }

        // 3. Categories (reflect exact database state, even if empty)
        const { data: cats } = await supabase!.from('categories').select('*').order('sort_order', { ascending: true });
        if (cats !== null && cats !== undefined) {
          setCategories(cats);
        }

        // 4. Brands (reflect exact database state, even if empty)
        const { data: brs } = await supabase!.from('brands').select('name');
        if (brs !== null && brs !== undefined) {
          setBrands(brs.map((b: { name: string }) => b.name));
        }

        // 5. Reassignment Requests
        const { data: reassigns } = await supabase!.from('reassignment_requests').select('*').order('timestamp', { ascending: false });
        if (reassigns) {
          setReassignmentRequests(reassigns);
        }

        // Fetch profiles to enrich username for supermarkets & visitors
        const { data: profiles } = await supabase!.from('profiles').select('id, name, role, phone, username');
        const profileMap = new Map<string, { username?: string; name?: string; phone?: string }>(
          (profiles || []).map((p) => [p.id, p])
        );

        // 6. Supermarkets
        const { data: sms } = await supabase!.from('supermarkets').select('*');
        if (sms) {
          const cleanSms = sms.filter((sm: Supermarket) => !DUMMY_SUPERMARKET_IDS.has(sm.id));
          setSupermarkets((prev) => {
            return cleanSms.map((sm: Supermarket) => {
              const localMatch = prev.find((p) => p.id === sm.id);
              const prof = profileMap.get(sm.id);
              return {
                ...sm,
                username: prof?.username || localMatch?.username || sm.username || '',
                password: localMatch?.password || sm.password || '123',
              };
            });
          });
        }

        // 7. Visitors
        const { data: visData } = await supabase!.from('visitors').select('*');
        if (visData !== null && visData !== undefined) {
          const cleanVis = visData.filter((v: Visitor) => !DUMMY_VISITOR_IDS.has(v.id));
          setVisitors((prev) => {
            return cleanVis.map((v: Visitor) => {
              const localMatch = prev.find((p) => p.id === v.id);
              const prof = profileMap.get(v.id);
              return {
                ...v,
                username: prof?.username || localMatch?.username || v.username || '',
              };
            });
          });
        }

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
