import React, { useEffect } from 'react';
import { Product, Order, Category, ReassignmentRequest, Supermarket } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface UseSupabaseSyncProps {
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setBrands: React.Dispatch<React.SetStateAction<string[]>>;
  setReassignmentRequests: React.Dispatch<React.SetStateAction<ReassignmentRequest[]>>;
  setSupermarkets: React.Dispatch<React.SetStateAction<Supermarket[]>>;
}

export function useSupabaseSync({
  setProducts,
  setOrders,
  setCategories,
  setBrands,
  setReassignmentRequests,
  setSupermarkets,
}: UseSupabaseSyncProps) {
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
        const { data: cats } = await supabase!.from('categories').select('*').order('sort_order', { ascending: true });
        if (cats && cats.length > 0) {
          setCategories(cats);
        }
        const { data: brs } = await supabase!.from('brands').select('name');
        if (brs && brs.length > 0) {
          setBrands(brs.map((b: { name: string }) => b.name));
        }
        const { data: reassigns } = await supabase!.from('reassignment_requests').select('*').order('timestamp', { ascending: false });
        if (reassigns && reassigns.length > 0) {
          setReassignmentRequests(reassigns);
        }
        const { data: sms } = await supabase!.from('supermarkets').select('*');
        if (sms && sms.length > 0) {
          setSupermarkets((prev) => {
            return sms.map((sm) => {
              const localMatch = prev.find((p) => p.id === sm.id);
              return {
                ...sm,
                username: localMatch?.username,
                password: localMatch?.password || '123',
              };
            });
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
  ]);
}
