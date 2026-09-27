import React, { useState, useEffect, useCallback } from 'react';
import {
  Order,
  ReassignmentRequest,
  OrderStatus,
  Product,
  Visitor,
  Supermarket,
  InventoryTransaction,
} from '../../types';
import { INITIAL_ORDERS } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId } from '../utils';

export interface CreateOrderPayload {
  supermarketId: string;
  visitorId: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
}

interface UseOrdersProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  supermarkets: Supermarket[];
  visitors: Visitor[];
  selectedVisitorId: string;
  addInventoryTransactions: (txs: InventoryTransaction[]) => void;
}

export function useOrders({
  products,
  setProducts,
  supermarkets,
  visitors,
  selectedVisitorId,
  addInventoryTransactions,
}: UseOrdersProps) {
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [reassignmentRequests, setReassignmentRequests] = useState<ReassignmentRequest[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REASSIGNMENTS);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REASSIGNMENTS, JSON.stringify(reassignmentRequests));
  }, [reassignmentRequests]);

  // Create Order (Reserves stock & appends audit ledger, ISO timestamp)
  const createOrder = useCallback(
    (payload: CreateOrderPayload) => {
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

      const orderId = generateUniqueId('ORD');
      const orderIsoDate = new Date().toISOString();
      const totalAmount = payload.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const newOrder: Order = {
        id: orderId,
        supermarket_id: supermarket.id,
        supermarket_name: supermarket.name,
        assigned_visitor_id: visitor.id,
        visitor_name: visitor.name,
        status: 'assigned',
        total_amount: totalAmount,
        order_date: orderIsoDate,
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
        created_at: orderIsoDate,
      }));

      addInventoryTransactions(newTxList);
      setOrders((prev) => [newOrder, ...prev]);

      // Send to Supabase
      if (isSupabaseConfigured && supabase) {
        supabase
          .rpc('create_order_transaction', {
            p_order_id: newOrder.id,
            p_supermarket_id: newOrder.supermarket_id,
            p_supermarket_name: newOrder.supermarket_name,
            p_assigned_visitor_id: newOrder.assigned_visitor_id,
            p_visitor_name: newOrder.visitor_name,
            p_status: newOrder.status,
            p_total_amount: newOrder.total_amount,
            p_items: payload.items.map((i) => ({
              productId: i.productId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })),
          })
          .then(({ error }) => {
            if (error) console.error('خطا در ثبت سفارش روی Supabase:', error);
          });
      }

      return {
        success: true,
        message: `سفارش با شماره ${orderId} با موفقیت ثبت و موجودی رزرو شد.`,
        orderId,
        order: newOrder,
      };
    },
    [supermarkets, visitors, products, setProducts, addInventoryTransactions]
  );

  // Update order status (with reserved stock release on 'undelivered')
  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderStatus) => {
      const targetOrder = orders.find((o) => o.id === orderId);

      // If changing to undelivered, release reserved stock
      if (
        targetOrder &&
        status === 'undelivered' &&
        targetOrder.status !== 'undelivered' &&
        targetOrder.status !== 'delivered'
      ) {
        const items = targetOrder.items || [];
        if (items.length > 0) {
          setProducts((prev) =>
            prev.map((p) => {
              const item = items.find((i) => i.product_id === p.id);
              if (item) {
                return {
                  ...p,
                  reserved_stock: Math.max(0, p.reserved_stock - item.quantity),
                };
              }
              return p;
            })
          );

          const releaseTx: InventoryTransaction[] = items.map((it) => ({
            id: `tx-${Date.now()}-rel-${it.product_id}`,
            product_id: it.product_id,
            product_name: it.name,
            transaction_type: 'release_reserve',
            quantity: -it.quantity,
            reference_id: orderId,
            created_at: new Date().toISOString(),
          }));
          addInventoryTransactions(releaseTx);

          if (isSupabaseConfigured && supabase) {
            supabase
              .rpc('release_order_reserved_stock', { p_order_id: orderId })
              .then(({ error }) => {
                if (error) {
                  console.warn('RPC release_order_reserved_stock failed, falling back to direct update:', error);
                  supabase.from('orders').update({ status }).eq('id', orderId).then(() => {});
                }
              });
          }
        }
      } else {
        if (isSupabaseConfigured && supabase) {
          supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId)
            .then(({ error }) => {
              if (error) console.error('خطا در به‌روزرسانی وضعیت سفارش روی Supabase:', error);
            });
        }
      }

      setOrders((prev) =>
        prev.map((order) => {
          if (order.id === orderId) {
            return { ...order, status };
          }
          return order;
        })
      );
    },
    [orders, setProducts, addInventoryTransactions]
  );

  // Request Reassignment (Handover between visitors, synced to Supabase)
  const requestReassignment = useCallback(
    (orderId: string, toVisitorId: string | null) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const fromVisitor = visitors.find((v) => v.id === order.assigned_visitor_id);
      const toVisitor = toVisitorId ? visitors.find((v) => v.id === toVisitorId) : null;

      const reqId = generateUniqueId('REQ');
      const nowIso = new Date().toISOString();

      const newReq: ReassignmentRequest = {
        id: reqId,
        order_id: orderId,
        supermarket_name: order.supermarket_name,
        from_visitor_id: order.assigned_visitor_id,
        from_visitor_name: fromVisitor?.name || order.visitor_name,
        to_visitor_id: toVisitorId,
        to_visitor_name: toVisitor ? toVisitor.name : 'عمومی (هر ویزیتوری)',
        status: 'pending',
        timestamp: nowIso,
      };

      setReassignmentRequests((prev) => [newReq, ...prev]);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'delegated', reassignment_id: reqId } : o))
      );

      if (isSupabaseConfigured && supabase) {
        supabase
          .from('reassignment_requests')
          .insert({
            id: reqId,
            order_id: orderId,
            supermarket_name: order.supermarket_name,
            from_visitor_id: order.assigned_visitor_id,
            from_visitor_name: fromVisitor?.name || order.visitor_name,
            to_visitor_id: toVisitorId,
            to_visitor_name: toVisitor ? toVisitor.name : 'عمومی (هر ویزیتوری)',
            status: 'pending',
          })
          .then(({ error }) => {
            if (error) console.error('خطا در ثبت درخواست واگذاری روی Supabase:', error);
          });

        supabase
          .from('orders')
          .update({ status: 'delegated', reassignment_id: reqId })
          .eq('id', orderId)
          .then(({ error }) => {
            if (error) console.error('خطا در به‌روزرسانی وضعیت سفارش روی Supabase:', error);
          });
      }
    },
    [orders, visitors]
  );

  // Respond to Reassignment (Accept/Reject handover, synced to Supabase)
  const respondToReassignment = useCallback(
    (requestId: string, accept: boolean) => {
      const req = reassignmentRequests.find((r) => r.id === requestId);
      if (!req) return;

      const newReqStatus = accept ? 'accepted' : 'rejected';
      setReassignmentRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: newReqStatus } : r))
      );

      if (accept) {
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

          if (isSupabaseConfigured && supabase) {
            supabase
              .from('reassignment_requests')
              .update({ status: 'accepted' })
              .eq('id', requestId)
              .then(({ error }) => {
                if (error) console.error('خطا در به‌روزرسانی درخواست واگذاری روی Supabase:', error);
              });

            supabase
              .from('orders')
              .update({
                assigned_visitor_id: recipientVisitor.id,
                visitor_name: recipientVisitor.name,
                status: 'assigned',
                reassignment_id: null,
              })
              .eq('id', req.order_id)
              .then(({ error }) => {
                if (error) console.error('خطا در انتقال سفارش روی Supabase:', error);
              });

            supabase
              .from('order_visitor_history')
              .insert({
                order_id: req.order_id,
                old_visitor_id: req.from_visitor_id,
                new_visitor_id: recipientVisitor.id,
                changed_by: recipientVisitor.name,
              })
              .then(({ error }) => {
                if (error) console.warn('خطا در ثبت تاریخچه انتقال ویزیتور روی Supabase:', error);
              });
          }
        }
      } else {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === req.order_id) {
              return { ...o, status: 'assigned', reassignment_id: null };
            }
            return o;
          })
        );

        if (isSupabaseConfigured && supabase) {
          supabase
            .from('reassignment_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId)
            .then(({ error }) => {
              if (error) console.error('خطا در رد درخواست واگذاری روی Supabase:', error);
            });

          supabase
            .from('orders')
            .update({ status: 'assigned', reassignment_id: null })
            .eq('id', req.order_id)
            .then(({ error }) => {
              if (error) console.error('خطا در بازگردانی سفارش روی Supabase:', error);
            });
        }
      }
    },
    [reassignmentRequests, visitors, selectedVisitorId]
  );

  return {
    orders,
    setOrders,
    reassignmentRequests,
    setReassignmentRequests,
    createOrder,
    updateOrderStatus,
    requestReassignment,
    respondToReassignment,
  };
}
