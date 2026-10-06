import React, { useState, useEffect, useCallback } from 'react';
import { LoadingBill, LoadingBillItem, InventoryTransaction, Product, Visitor, Order } from '../../types';
import { INITIAL_LOADING_BILLS, INITIAL_INVENTORY_TRANSACTIONS } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId } from '../utils';
import { extractCodeFromId } from '../../utils/numberToPersianWords';

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
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.LOADING_BILLS);
    return saved ? JSON.parse(saved) : INITIAL_LOADING_BILLS;
  });

  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY_TRANSACTIONS;
  });

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.LOADING_BILLS, JSON.stringify(loadingBills));
  }, [loadingBills]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(inventoryTransactions));
  }, [inventoryTransactions]);

  const addInventoryTransactions = useCallback((txs: InventoryTransaction[]) => {
    setInventoryTransactions((prev) => [...txs, ...prev]);
  }, []);

  // Create Loading Bill (Atomically locks orders in 'loading' status, snapshots prices, and syncs via RPC)
  const createLoadingBill = useCallback(
    async (
      visitorId: string,
      orderIds: string[]
    ): Promise<{ success: boolean; message: string; billId?: string }> => {
      const visitor = visitors.find((v) => v.id === visitorId);
      if (!visitor) {
        return { success: false, message: 'اطلاعات ویزیتور در سیستم یافت نشد.' };
      }
      if (!orderIds || orderIds.length === 0) {
        return { success: false, message: 'هیچ سفارشی برای صدور برگه بارگیری انتخاب نشده است.' };
      }

      // Check current local orders
      const selectedOrders = orders.filter((o) => orderIds.includes(o.id));
      if (selectedOrders.length !== orderIds.length) {
        return { success: false, message: 'برخی از سفارش‌های انتخابی در سیستم یافت نشدند.' };
      }

      // Concurrency check: Ensure none of the orders are already in a loading bill or not in 'assigned' status
      const busyOrders = selectedOrders.filter(
        (o) => o.status !== 'assigned' || Boolean(o.loading_bill_id)
      );
      if (busyOrders.length > 0) {
        return {
          success: false,
          message: 'برخی سفارش‌های انتخابی قبلاً در برگه بارگیری دیگری ثبت شده یا از وضعیت آماده ارسال خارج شده‌اند.',
        };
      }

      const otherVisitorOrders = selectedOrders.filter((o) => o.assigned_visitor_id !== visitorId);
      if (otherVisitorOrders.length > 0) {
        return {
          success: false,
          message: 'تمامی سفارش‌های انتخابی باید متعلق به ویزیتور جاری باشند.',
        };
      }

      // Generate readable bill ID: BL-{visitorCode2Digits}-{seq3Digits}
      const visitorCode = extractCodeFromId(visitorId, 2, visitors);
      const visitorBills = loadingBills.filter((b) => b.visitor_id === visitorId);
      let seq = visitorBills.length + 1;
      let billId = `BL-${visitorCode}-${String(seq).padStart(3, '0')}`;
      const existingIds = new Set(loadingBills.map((b) => b.id));
      while (existingIds.has(billId)) {
        seq++;
        billId = `BL-${visitorCode}-${String(seq).padStart(3, '0')}`;
      }

      const nowIso = new Date().toISOString();
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

      let totalVisitorCost = 0;
      let totalStoreAmount = 0;

      const billItems: LoadingBillItem[] = Array.from(itemsMap.values()).map((val, idx) => {
        const prod = products.find((p) => p.id === val.productId);
        const multiplier = prod?.items_per_package && prod.items_per_package > 0 ? prod.items_per_package : 1;
        const storePrice = prod ? Number(prod.price) * multiplier : 0;
        const visitorPrice = prod && prod.visitor_price ? Number(prod.visitor_price) * multiplier : 0;

        totalStoreAmount += storePrice * val.quantity;
        totalVisitorCost += visitorPrice * val.quantity;

        return {
          id: `lbi-${Date.now()}-${idx}`,
          loading_bill_id: billId,
          order_id: val.orderId,
          product_id: val.productId,
          product_name: val.name,
          quantity: val.quantity,
          visitor_price: visitorPrice,
          store_price: storePrice,
          items_per_package: prod?.items_per_package,
          unit: prod?.unit,
          created_at: nowIso,
        };
      });

      const bill: LoadingBill = {
        id: billId,
        visitor_id: visitorId,
        visitor_name: visitor.name,
        status: 'pending',
        created_at: nowIso,
        items: billItems,
        orders_count: selectedOrders.length,
        total_visitor_cost: totalVisitorCost,
        total_store_amount: totalStoreAmount,
      };

      let finalBill: LoadingBill;

      // In Supabase mode, call ONLY supabase.rpc('create_loading_bill_transaction', ...)
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('create_loading_bill_transaction', {
          p_bill_id: billId,
          p_visitor_id: visitorId,
          p_order_ids: orderIds,
        });

        if (error) {
          console.error('RPC create_loading_bill_transaction error:', error);
          return {
            success: false,
            message: error.message || 'خطا در ثبت برگه بارگیری روی سرور.',
          };
        }

        if (data && (data as any).success === false) {
          return {
            success: false,
            message: (data as any).message || 'خطا در ثبت تراکنشی برگه بارگیری.',
          };
        }

        // Fetch created loading bill from DB with its items
        const { data: dbBill, error: fetchErr } = await supabase
          .from('loading_bills')
          .select('*, items:loading_bill_items(*)')
          .eq('id', billId)
          .maybeSingle();

        if (fetchErr || !dbBill) {
          return {
            success: false,
            message: fetchErr?.message || 'برگه بارگیری پس از ثبت از سرور دریافت نشد.',
          };
        }

        if (!dbBill.items || dbBill.items.length === 0) {
          return {
            success: false,
            message: 'اقلام سفارش‌ها روی سرور ثبت نشده‌اند.',
          };
        }

        finalBill = dbBill as LoadingBill;
      } else {
        finalBill = bill;
      }

      // Commit to local state (and localStorage in offline mode)
      setLoadingBills((prev) => {
        const next = [finalBill, ...prev.filter((b) => b.id !== billId)];
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.LOADING_BILLS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      setOrders((prev) => {
        const next = prev.map((o) =>
          orderIds.includes(o.id) ? { ...o, status: 'loading' as const, loading_bill_id: billId } : o
        );
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      return {
        success: true,
        message: `برگه بارگیری ${billId} شامل ${selectedOrders.length} سفارش با موفقیت صادر و به سردخانه ارسال شد.`,
        billId,
      };
    },
    [visitors, orders, products, loadingBills, setOrders]
  );

  // Cancel Loading Bill (reverts orders to assigned without touching inventory)
  const cancelLoadingBill = useCallback(
    async (
      billId: string,
      cancelledBy: string = 'انباردار',
      reason: string
    ): Promise<{ success: boolean; message: string }> => {
      if (!reason || !reason.trim()) {
        return { success: false, message: 'ثبت دلیل لغو برگه بارگیری الزامی است.' };
      }

      const bill = loadingBills.find((b) => b.id === billId);
      if (!bill) {
        return { success: false, message: 'برگه بارگیری مورد نظر یافت نشد.' };
      }
      if (bill.status !== 'pending') {
        return { success: false, message: 'تنها برگه‌های در انتظار تایید (pending) امکان لغو دارند.' };
      }

      const nowIso = new Date().toISOString();

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('cancel_loading_bill_transaction', {
          p_bill_id: billId,
          p_cancelled_by: cancelledBy,
          p_reason: reason.trim(),
        });

        if (error) {
          console.error('RPC cancel_loading_bill_transaction error:', error);
          return { success: false, message: error.message || 'خطا در لغو برگه روی سرور.' };
        }
        if (data && (data as any).success === false) {
          return { success: false, message: (data as any).message || 'خطا در لغو برگه بارگیری.' };
        }
      }

      // Revert in local state & localStorage
      setLoadingBills((prev) => {
        const next = prev.map((b) =>
          b.id === billId
            ? {
                ...b,
                status: 'cancelled' as const,
                cancelled_by: cancelledBy,
                cancelled_at: nowIso,
                cancel_reason: reason.trim(),
              }
            : b
        );
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.LOADING_BILLS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      setOrders((prev) => {
        const next = prev.map((o) =>
          o.loading_bill_id === billId ? { ...o, status: 'assigned' as const, loading_bill_id: null } : o
        );
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      return {
        success: true,
        message: `برگه بارگیری ${billId} لغو شد و سفارش‌ها به وضعیت آماده ارسال بازگشتند.`,
      };
    },
    [loadingBills, setOrders]
  );

  // Approve Loading Bill (Cold-chain warehouse commits dispatch & deducts physical stock)
  const approveLoadingBill = useCallback(
    async (
      billId: string,
      approvedBy: string = 'انباردار'
    ): Promise<{ success: boolean; message: string }> => {
      const bill = loadingBills.find((b) => b.id === billId);
      if (!bill) {
        return { success: false, message: 'برگه بارگیری مورد نظر یافت نشد.' };
      }
      if (bill.status !== 'pending') {
        return { success: false, message: 'این برگه قبلاً تایید یا لغو شده است.' };
      }

      const nowIso = new Date().toISOString();
      const nowPersian = new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('approve_loading_bill_transaction', {
          p_loading_bill_id: billId,
          p_approved_by: approvedBy,
        });

        if (error) {
          console.error('RPC approve_loading_bill_transaction error:', error);
          return { success: false, message: error.message || 'خطا در تایید برگه روی سرور.' };
        }
        if (data && (data as any).success === false) {
          return { success: false, message: (data as any).message || 'خطا در تایید برگه بارگیری.' };
        }
      }

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
        prev.map((b) =>
          b.id === billId
            ? {
                ...b,
                status: 'approved' as const,
                approved_by: approvedBy,
                approved_at: nowIso,
              }
            : b
        )
      );

      return {
        success: true,
        message: `برگه بارگیری ${billId} با موفقیت تایید و خروج از سردخانه انجام شد.`,
      };
    },
    [loadingBills, products, setProducts, setOrders]
  );

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
        .rpc('adjust_product_stock_transaction', {
          p_product_id: productId,
          p_quantity: Math.round(Math.abs(quantity) * 1000) / 1000,
          p_tx_type: 'return',
          p_reference: refReason,
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
        .rpc('adjust_product_stock_transaction', {
          p_product_id: productId,
          p_quantity: Math.round(additionalStock * 1000) / 1000,
          p_tx_type: 'manual_adjustment',
          p_reference: 'ورود به انبار سردخانه',
        })
        .then(({ error }) => {
          if (error) console.error('خطا در به‌روزرسانی موجودی انبار روی Supabase:', error);
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
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(next));
          } catch {}
        }
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
    cancelLoadingBill,
    updateProductStock,
    recordProductReturn,
  };
}
