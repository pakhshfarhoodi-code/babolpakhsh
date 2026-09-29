import React, { useState, useEffect, useCallback } from 'react';
import { LoadingBill, InventoryTransaction, Product, Visitor, Order } from '../../types';
import { INITIAL_LOADING_BILLS, INITIAL_INVENTORY_TRANSACTIONS } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId } from '../utils';

interface UseWarehouseProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  visitors: Visitor[];
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

export function useWarehouse({
  products,
  setProducts,
  visitors,
  orders,
  setOrders,
}: UseWarehouseProps) {
  const [loadingBills, setLoadingBills] = useState<LoadingBill[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOADING_BILLS);
    return saved ? JSON.parse(saved) : INITIAL_LOADING_BILLS;
  });

  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY_TRANSACTIONS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOADING_BILLS, JSON.stringify(loadingBills));
  }, [loadingBills]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(inventoryTransactions));
  }, [inventoryTransactions]);

  const addInventoryTransactions = useCallback((txs: InventoryTransaction[]) => {
    setInventoryTransactions((prev) => [...txs, ...prev]);
  }, []);

  // Create Loading Bill (locks orders in 'loading' status and assigns loading_bill_id)
  const createLoadingBill = useCallback((visitorId: string, orderIds: string[]) => {
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

    const billId = generateUniqueId('LB');
    const nowIso = new Date().toISOString();

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
      created_at: nowIso,
      items: billItems,
    };

    setLoadingBills((prev) => [bill, ...prev]);

    // Update orders: exclude from subsequent loading bill pools
    setOrders((prev) =>
      prev.map((o) => (orderIds.includes(o.id) ? { ...o, status: 'loading', loading_bill_id: billId } : o))
    );

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('orders')
        .update({ status: 'loading', loading_bill_id: billId })
        .in('id', orderIds)
        .then(({ error }) => {
          if (error) console.error('خطا در به‌روزرسانی وضعیت سفارشات در برگه بارگیری روی Supabase:', error);
        });

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
  }, [visitors, orders, setOrders]);

  // Approve Loading Bill (Cold-chain warehouse commits dispatch & deducts physical stock)
  const approveLoadingBill = useCallback((billId: string) => {
    const bill = loadingBills.find((b) => b.id === billId);
    if (!bill || bill.status === 'approved') return;

    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

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

    // Mark associated orders as stock_deducted = true
    setOrders((prev) =>
      prev.map((o) => (o.loading_bill_id === billId ? { ...o, stock_deducted: true } : o))
    );

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
        .from('orders')
        .update({ stock_deducted: true })
        .eq('loading_bill_id', billId)
        .then(() => {});

      supabase
        .rpc('approve_loading_bill_transaction', { p_loading_bill_id: billId })
        .then(({ error }) => {
          if (error) console.error('خطا در تایید برگه بارگیری روی Supabase:', error);
        });
    }
  }, [loadingBills, products, setProducts, setOrders]);

  // Record Product Return to Warehouse (Increases physical stock & inserts transaction_type = 'return')
  const recordProductReturn = useCallback((productId: string, quantity: number, reason: string): { success: boolean; message: string } => {
    if (!productId || quantity <= 0) {
      return { success: false, message: 'اطلاعات کالا و تعداد مرجوعی نامعتبر است.' };
    }

    const prod = products.find((p) => p.id === productId);
    if (!prod) {
      return { success: false, message: 'کالای مورد نظر در سیستم یافت نشد.' };
    }

    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    let targetStock = prod.stock + quantity;

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const newStock = p.stock + quantity;
          targetStock = newStock;
          return { ...p, stock: newStock };
        }
        return p;
      })
    );

    const refReason = reason.trim() ? `مرجوعی: ${reason.trim()}` : 'مرجوعی به انبار سردخانه';
    const txId = `tx-${Date.now()}-ret-${productId}`;

    const returnTx: InventoryTransaction = {
      id: txId,
      product_id: productId,
      product_name: prod.name,
      transaction_type: 'return',
      quantity: Math.abs(quantity),
      reference_id: refReason,
      created_at: nowPersian,
    };

    setInventoryTransactions((prev) => [returnTx, ...prev]);

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .update({ stock: targetStock })
        .eq('id', productId)
        .then(({ error }) => {
          if (error) console.error('خطا در به‌روزرسانی موجودی مرجوعی در Supabase:', error);
        });

      supabase
        .from('inventory_transactions')
        .insert({
          id: txId,
          product_id: productId,
          transaction_type: 'return',
          quantity: Math.abs(quantity),
          reference_id: refReason,
        })
        .then(({ error }) => {
          if (error) console.error('خطا در ثبت تراکنش مرجوعی در Supabase:', error);
        });
    }

    return {
      success: true,
      message: `تعداد ${quantity} واحد از «${prod.name}» با موفقیت مرجوع و به موجودی فیزیکی انبار افزوده شد.`,
    };
  }, [products, setProducts]);

  // Update product stock (Warehouse adjustment)
  const updateProductStock = useCallback((productId: string, additionalStock: number) => {
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
  }, [products, setProducts]);

  // Delete Inventory Transactions (Single or Batch)
  const deleteInventoryTransactions = useCallback(async (txIds: string[]): Promise<{ success: boolean; message: string; count: number }> => {
    if (txIds.length === 0) {
      return { success: false, message: 'هیچ تراکنشی انتخاب نشده است.', count: 0 };
    }

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('inventory_transactions')
          .delete()
          .in('id', txIds);

        if (error) {
          console.warn('Supabase inventory transactions delete error:', error.message);
        }
      }

      const idSet = new Set(txIds);
      setInventoryTransactions((prev) => {
        const next = prev.filter((tx) => !idSet.has(tx.id));
        try {
          localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(next));
        } catch {}
        return next;
      });

      return {
        success: true,
        message: `${txIds.length} تراکنش دفتر کل با موفقیت حذف گردید.`,
        count: txIds.length,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در حذف تراکنش‌های دفتر کل.';
      return { success: false, message: msg, count: 0 };
    }
  }, []);

  return {
    loadingBills,
    setLoadingBills,
    inventoryTransactions,
    setInventoryTransactions,
    addInventoryTransactions,
    deleteInventoryTransactions,
    createLoadingBill,
    approveLoadingBill,
    updateProductStock,
    recordProductReturn,
  };
}
