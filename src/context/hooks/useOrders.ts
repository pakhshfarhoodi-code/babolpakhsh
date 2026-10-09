import React, { useState, useEffect, useCallback } from 'react';
import {
  Order,
  OrderChannel,
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
import { LEGACY_MOCK_NAMES } from './useCatalog';

import { generateStructuredInvoiceNumber } from '../../utils/numberToPersianWords';
import { getItemUnitPriceAndTotal, getPackSize } from '../../utils/orderLine';

export interface CreateOrderPayload {
  supermarketId: string;
  visitorId: string;
  orderSource?: 'visitor' | 'supermarket';
  pickupDiscountPercent?: number;
  founderDiscountPercent?: number;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    items_per_package?: number | string | null;
    unit?: string;
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
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!saved) return [];
    try {
      const parsed: Order[] = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (o) =>
            Boolean(o.id) &&
            !o.items?.some((it) => LEGACY_MOCK_NAMES.has(it.name?.trim()))
        )
        .map((o) => ({
          ...o,
          supermarket_name: o.supermarket_name || 'فروشگاه نامشخص',
        }));
    } catch {
      return [];
    }
  });

  const [reassignmentRequests, setReassignmentRequests] = useState<ReassignmentRequest[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.REASSIGNMENTS);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.REASSIGNMENTS, JSON.stringify(reassignmentRequests));
  }, [reassignmentRequests]);

  // Create Order (Reserves stock & appends audit ledger, ISO timestamp)
  const createOrder = useCallback(
    async (payload: CreateOrderPayload): Promise<{ success: boolean; message: string; orderId?: string; order?: Order }> => {
      const isSelfBuyer = Boolean(payload.supermarketId?.startsWith('self-'));
      const selfVisitorId = isSelfBuyer ? payload.supermarketId.replace('self-', '') : '';
      const selfVisitor = isSelfBuyer ? visitors.find((v) => v.id === selfVisitorId) : null;

      const supermarket =
        (isSelfBuyer
          ? {
              id: payload.supermarketId,
              name: `خودم (${selfVisitor?.name || 'ویزیتور'})`,
              owner: selfVisitor?.name || 'ویزیتور',
              phone: selfVisitor?.phone || '',
              address: 'خرید شخصی ویزیتور',
              assigned_visitor_id: '',
              username: selfVisitor?.username || 'visitor',
              credit_limit: 100000000,
              current_debt: 0,
              is_active: true,
            }
          : null) ||
        supermarkets.find((s) => s.id === payload.supermarketId) ||
        supermarkets[0] ||
        {
          id: payload.supermarketId || '',
          name: 'فروشگاه طرف قرارداد',
          owner: 'متصدی فروشگاه',
          phone: '۰۹۱۱۰۰۰۰۰۰۰',
          address: 'ثبت شده در سامانه مرکزی پخش',
          assigned_visitor_id: 'direct',
          username: 'supermarket',
          credit_limit: 50000000,
          current_debt: 0,
          is_active: true,
        };

      // Determine order source (visitor vs supermarket direct)
      const orderSource: 'visitor' | 'supermarket' = payload.orderSource || 'visitor';

      // Check if this is a direct order from Farhoodi distribution
      const isDirectOrder =
        orderSource === 'supermarket' &&
        (payload.visitorId === 'direct' ||
          !payload.visitorId ||
          supermarket.assigned_visitor_id === 'direct' ||
          !supermarket.assigned_visitor_id);

      let finalAssignedVisitorId: string = 'direct';
      let finalVisitorName: string = 'خرید مستقیم از پخش مرکزی';
      if (isSelfBuyer || payload.visitorId === '') {
        finalAssignedVisitorId = '';
        finalVisitorName = '';
      } else if (!isDirectOrder) {
        const foundVisitor =
          visitors.find((v) => v.id === payload.visitorId) ||
          visitors.find((v) => v.id === supermarket.assigned_visitor_id);
        if (foundVisitor) {
          finalAssignedVisitorId = foundVisitor.id;
          finalVisitorName = foundVisitor.name;
        } else if (orderSource === 'visitor') {
          // If initiated in visitor portal, fallback to current or first visitor
          const defaultVis = visitors[0];
          finalAssignedVisitorId = defaultVis?.id || '';
          finalVisitorName = defaultVis?.name || 'واحد ویزیت و توزیع';
        }
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
        const available = Math.round((prod.stock - prod.reserved_stock) * 1000) / 1000;
        if (item.quantity > available) {
          return {
            success: false,
            message: `موجودی ناکافی برای ${prod.name}. موجودی قابل فروش: ${available} ${prod.unit}`,
          };
        }
      }

      let orderId: string;
      if (isSupabaseConfigured && supabase) {
        const { data: orderNumberData, error: orderNumberError } = await supabase.rpc(
          'next_order_number',
          {
            p_source: orderSource,
            p_supermarket_id: supermarket.id,
            p_visitor_id: finalAssignedVisitorId === 'direct' ? null : finalAssignedVisitorId,
          }
        );

        if (orderNumberError) {
          return {
            success: false,
            message: orderNumberError.message || 'خطا در دریافت شماره سفارش از سرور.',
          };
        }

        if (
          orderNumberData &&
          typeof orderNumberData === 'object' &&
          (orderNumberData as { success?: boolean; message?: string }).success === false
        ) {
          return {
            success: false,
            message:
              (orderNumberData as { message?: string }).message || 'خطا در صدور شماره سفارش از سرور.',
          };
        }

        if (!orderNumberData || typeof orderNumberData !== 'string') {
          return {
            success: false,
            message: 'خطا در ایجاد شماره سفارش از سرور.',
          };
        }

        orderId = orderNumberData.trim();
      } else {
        // Generate structured invoice ID according to business formula (Offline / mock mode only)
        orderId = generateStructuredInvoiceNumber({
          orderSource,
          visitorId: finalAssignedVisitorId === 'direct' ? undefined : finalAssignedVisitorId,
          supermarketId: supermarket.id,
          visitors,
          supermarkets,
          existingOrders: orders,
        });
      }

      const orderIsoDate = new Date().toISOString();
      const isVisitorChannel = orderSource === 'visitor' || Boolean(finalAssignedVisitorId && finalAssignedVisitorId !== 'direct');

      const totalAmount = payload.items.reduce((sum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        const { total } = getItemUnitPriceAndTotal(item, prod, isVisitorChannel);
        return sum + total;
      }, 0);

      // Determine explicit order channel:
      // direct -> store_direct, registered by visitor -> visitor_field, store self with visitor -> store_self
      let orderChannel: OrderChannel;
      if (isDirectOrder) {
        orderChannel = 'store_direct';
      } else if (orderSource === 'visitor') {
        orderChannel = 'visitor_field';
      } else {
        orderChannel = 'store_self';
      }

      const newOrder: Order = {
        id: orderId,
        supermarket_id: supermarket.id,
        supermarket_name: supermarket.name,
        assigned_visitor_id: isSelfBuyer ? null : (finalAssignedVisitorId || null),
        visitor_name: isSelfBuyer ? '' : finalVisitorName,
        status: 'assigned',
        total_amount: totalAmount,
        order_source: orderSource,
        order_channel: orderChannel,
        order_date: orderIsoDate,
        pickup_discount_percent: orderSource === 'visitor' ? 0 : (payload.pickupDiscountPercent || 0),
        founder_discount_percent: payload.founderDiscountPercent || 0,
        items: payload.items.map((i, idx) => {
          const prod = products.find((p) => p.id === i.productId);
          return {
            id: `item-${Date.now()}-${idx}`,
            order_id: orderId,
            product_id: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            items_per_package: getPackSize(i.items_per_package ?? prod?.items_per_package),
            unit: i.unit ?? prod?.unit,
          };
        }),
      };

      const newTxList: InventoryTransaction[] = payload.items.map((item) => ({
        id: `tx-${Date.now()}-${item.productId}`,
        product_id: item.productId,
        product_name: item.name,
        transaction_type: 'reserve',
        quantity: item.quantity,
        reference_id: orderId,
        created_at: orderIsoDate,
      }));

      // In Supabase mode, attempt atomic RPC create_order_transaction
      if (isSupabaseConfigured && supabase) {
        // Ensure supermarket profile/row exists before foreign key constraint check
        // Only insert if row does not exist at all; never overwrite existing row or assigned_visitor_id
        if (newOrder.supermarket_id) {
          const { data: existingSm } = await supabase
            .from('supermarkets')
            .select('id')
            .eq('id', newOrder.supermarket_id)
            .maybeSingle();

          if (!existingSm) {
            const sm = supermarkets.find((s) => s.id === newOrder.supermarket_id) || supermarket;
            if (sm) {
              await supabase.from('profiles').upsert(
                {
                  id: sm.id,
                  name: sm.name,
                  role: 'supermarket',
                  phone: sm.phone || '',
                  username: (sm as any).username || (sm.phone ? sm.phone : sm.id),
                },
                { onConflict: 'id', ignoreDuplicates: true }
              );

              // Do NOT send assigned_visitor_id, and use ignoreDuplicates: true to never overwrite existing record
              await supabase.from('supermarkets').upsert(
                {
                  id: sm.id,
                  name: sm.name,
                  owner: sm.owner || '',
                  phone: sm.phone || '',
                  address: sm.address || '',
                  is_active: sm.is_active ?? true,
                },
                { onConflict: 'id', ignoreDuplicates: true }
              );
            }
          }
        }

        const validVisitorId =
          finalAssignedVisitorId && finalAssignedVisitorId !== 'direct'
            ? (visitors.some((v) => v.id === finalAssignedVisitorId) ? finalAssignedVisitorId : null)
            : null;

        const { data, error } = await supabase.rpc('create_order_transaction', {
          p_order_id: newOrder.id,
          p_supermarket_id: newOrder.supermarket_id || null,
          p_supermarket_name: newOrder.supermarket_name,
          p_assigned_visitor_id: validVisitorId,
          p_visitor_name: newOrder.visitor_name,
          p_status: newOrder.status,
          p_total_amount: newOrder.total_amount,
          p_order_channel: newOrder.order_channel,
          p_items: payload.items.map((i) => {
            const prod = products.find((p) => p.id === i.productId);
            return {
              productId: i.productId,
              name: i.name,
              price: i.price,
              quantity: Math.round((Number(i.quantity) || 0) * 1000) / 1000,
              items_per_package: i.items_per_package ?? prod?.items_per_package,
              unit: i.unit ?? prod?.unit,
            };
          }),
        });

        if (error) {
          return { success: false, message: error.message || 'خطا در ثبت سفارش روی سرور.' };
        }

        if (data && (data as any).success === false) {
          return { success: false, message: (data as any).message || 'خطا در ثبت تراکنشی سفارش روی سرور.' };
        }

        // Store-self orders pickup discount application (Visitors orders NEVER get pickup discount)
        const finalPickupDiscountPercent = orderSource === 'visitor' ? 0 : (payload.pickupDiscountPercent || 0);
        const finalFounderDiscountPercent = payload.founderDiscountPercent || 0;

        newOrder.pickup_discount_percent = finalPickupDiscountPercent;
        newOrder.founder_discount_percent = finalFounderDiscountPercent;

        if (finalPickupDiscountPercent > 0 || finalFounderDiscountPercent > 0) {
          const updatePayload: Record<string, number> = {};
          if (finalPickupDiscountPercent > 0) updatePayload.pickup_discount_percent = finalPickupDiscountPercent;
          if (finalFounderDiscountPercent > 0) updatePayload.founder_discount_percent = finalFounderDiscountPercent;
          await supabase.from('orders').update(updatePayload).eq('id', newOrder.id);
        }

        // Read back server-side calculated discounts
        const { data: serverOrderData } = await supabase
          .from('orders')
          .select('pickup_discount_percent, founder_discount_percent, discount_percent, discount_status')
          .eq('id', newOrder.id)
          .single();

        if (serverOrderData) {
          newOrder.pickup_discount_percent = serverOrderData.pickup_discount_percent;
          newOrder.founder_discount_percent = serverOrderData.founder_discount_percent ?? finalFounderDiscountPercent;
          newOrder.discount_percent = serverOrderData.discount_percent;
          newOrder.discount_status = serverOrderData.discount_status;
        }
      }

      // ONLY on success (or in mock mode): update local state & reserved stock
      setProducts((prev) =>
        prev.map((p) => {
          const ordered = payload.items.find((i) => i.productId === p.id);
          if (ordered) {
            return {
              ...p,
              reserved_stock: Math.round((p.reserved_stock + ordered.quantity) * 1000) / 1000,
            };
          }
          return p;
        })
      );

      addInventoryTransactions(newTxList);

      setOrders((prev) => {
        const next = [newOrder, ...prev.filter((o) => o.id !== newOrder.id)];
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      return {
        success: true,
        message: `سفارش با شماره ${orderId} با موفقیت ثبت و موجودی رزرو شد.`,
        orderId,
        order: newOrder,
      };
    },
    [orders, supermarkets, visitors, products, setProducts, addInventoryTransactions]
  );

  // Update order status (with reserved stock release on 'undelivered' and stock deduction on 'delivered')
  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderStatus) => {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) return;

      const nowIso = new Date().toISOString();

      // Case 1: Status change to 'delivered'
      if (status === 'delivered' && targetOrder.status !== 'delivered') {
        const isStockAlreadyDeducted =
          targetOrder.stock_deducted === true ||
          (Boolean(targetOrder.loading_bill_id) &&
            targetOrder.status === 'loading');

        if (!isStockAlreadyDeducted) {
          const items = targetOrder.items || [];
          if (items.length > 0) {
            // Deduct both physical stock & reserved stock for each item
            setProducts((prev) =>
              prev.map((p) => {
                const item = items.find((i) => i.product_id === p.id);
                if (item) {
                  return {
                    ...p,
                    stock: Math.max(0, p.stock - item.quantity),
                    reserved_stock: Math.max(0, p.reserved_stock - item.quantity),
                  };
                }
                return p;
              })
            );

            const overrideTx: InventoryTransaction[] = items.map((it) => ({
              id: `tx-${Date.now()}-ovr-${it.product_id}`,
              product_id: it.product_id,
              product_name: it.name,
              transaction_type: 'manual_delivery_override',
              quantity: -it.quantity,
              reference_id: orderId,
              created_at: nowIso,
            }));
            addInventoryTransactions(overrideTx);

            if (isSupabaseConfigured && supabase) {
              supabase
                .rpc('override_order_delivery', { p_order_id: orderId })
                .then(() => {}, () => {});
              supabase
                .from('orders')
                .update({ status: 'delivered', stock_deducted: true })
                .eq('id', orderId)
                .then(() => {});
            }
          }
        } else {
          if (isSupabaseConfigured && supabase) {
            supabase
              .from('orders')
              .update({ status: 'delivered', stock_deducted: true })
              .eq('id', orderId)
              .then(() => {});
          }
        }

        setOrders((prev) =>
          prev.map((order) => {
            if (order.id === orderId) {
              return { ...order, status: 'delivered', stock_deducted: true };
            }
            return order;
          })
        );
        return;
      }

      // Case 2: Status change to 'undelivered'
      if (
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
            created_at: nowIso,
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
          .rpc('request_order_reassignment', {
            p_order_id: orderId,
            p_to_visitor_id: toVisitorId || null,
          })
          .then(({ error }) => {
            if (error) console.error('خطا در ثبت درخواست واگذاری روی Supabase:', error);
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
        }

        if (isSupabaseConfigured && supabase) {
          supabase
            .rpc('respond_order_reassignment', {
              p_request_id: requestId,
              p_accept: true,
            })
            .then(({ error }) => {
              if (error) console.error('خطا در تایید درخواست واگذاری روی Supabase:', error);
            });
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
            .rpc('respond_order_reassignment', {
              p_request_id: requestId,
              p_accept: false,
            })
            .then(({ error }) => {
              if (error) console.error('خطا در رد درخواست واگذاری روی Supabase:', error);
            });
        }
      }
    },
    [reassignmentRequests, visitors, selectedVisitorId]
  );

  // Direct Assignment / Transfer by Admin (takes immediate effect)
  const assignOrderVisitor = useCallback(
    (
      orderId: string,
      targetVisitorId: string | 'direct',
      adminName: string = 'مدیر ارشد'
    ): { success: boolean; message: string; targetVisitorName?: string } => {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) return { success: false, message: 'سفارش مورد نظر یافت نشد.' };

      let newVisitorId = 'direct';
      let newVisitorName = 'خرید مستقیم از پخش مرکزی';
      if (targetVisitorId !== 'direct') {
        const foundVis = visitors.find((v) => v.id === targetVisitorId);
        if (!foundVis) {
          return { success: false, message: 'ویزیتور مورد نظر یافت نشد.' };
        }
        newVisitorId = foundVis.id;
        newVisitorName = foundVis.name;
      }

      const oldVisitorId = targetOrder.assigned_visitor_id;

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              assigned_visitor_id: newVisitorId,
              visitor_name: newVisitorName,
              // If order was in delegated status, clear delegation and keep ready
              status: o.status === 'delegated' ? 'assigned' : o.status,
              reassignment_id: null,
            };
          }
          return o;
        })
      );

      // Cancel any pending reassignment requests for this order
      if (targetOrder.reassignment_id) {
        setReassignmentRequests((prev) =>
          prev.map((r) =>
            r.order_id === orderId && r.status === 'pending'
              ? { ...r, status: 'accepted' }
              : r
          )
        );
      }

      // Sync with Supabase
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('orders')
          .update({
            assigned_visitor_id: newVisitorId === 'direct' ? null : newVisitorId,
            visitor_name: newVisitorName,
            status: targetOrder.status === 'delegated' ? 'assigned' : targetOrder.status,
            reassignment_id: null,
          })
          .eq('id', orderId)
          .then(({ error }) => {
            if (error) console.error('خطا در تخصیص سفارش روی Supabase:', error);
          });

        supabase
          .from('order_visitor_history')
          .insert({
            order_id: orderId,
            old_visitor_id: oldVisitorId === 'direct' ? null : oldVisitorId,
            new_visitor_id: newVisitorId === 'direct' ? null : newVisitorId,
            changed_by: `${adminName} (مدیریت مرکزی)`,
          })
          .then(({ error }) => {
            if (error) console.warn('ثبت تاریخچه انتقال ویزیتور:', error);
          });
      }

      return {
        success: true,
        message:
          newVisitorId === 'direct'
            ? `سفارش ${orderId} به مدیریت مستقیم پخش مرکزی محول شد.`
            : `سفارش ${orderId} به ${newVisitorName} محول شد.`,
        targetVisitorName: newVisitorName,
      };
    },
    [orders, visitors]
  );

  // Delete Order (Releases reserved stock, removes from Supabase and local storage)
  const deleteOrder = useCallback(
    async (orderId: string): Promise<{ success: boolean; message: string }> => {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) {
        return { success: false, message: 'سفارش مورد نظر یافت نشد.' };
      }

      // If order was in assigned, loading, or delegated status, release reserved stock
      if (
        targetOrder.status !== 'delivered' &&
        targetOrder.status !== 'undelivered'
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
            id: `tx-${Date.now()}-del-${it.product_id}`,
            product_id: it.product_id,
            product_name: it.name,
            transaction_type: 'release_reserve',
            quantity: -it.quantity,
            reference_id: orderId,
            created_at: new Date().toISOString(),
          }));
          addInventoryTransactions(releaseTx);
        }
      }

      // Delete from Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('order_items').delete().eq('order_id', orderId);
          await supabase.from('reassignment_requests').delete().eq('order_id', orderId);
          const { error: ordErr } = await supabase.from('orders').delete().eq('id', orderId);
          if (ordErr) {
            console.warn('Supabase delete order warning:', ordErr.message);
          }
        } catch (dbErr) {
          console.error('Error deleting order from Supabase:', dbErr);
        }
      }

      // Remove from local state
      setOrders((prev) => {
        const next = prev.filter((o) => o.id !== orderId);
        if (!isSupabaseConfigured) {
          try {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // Remove any reassignment requests for this order
      setReassignmentRequests((prev) => prev.filter((r) => r.order_id !== orderId));

      return {
        success: true,
        message: `سفارش ${orderId} با موفقیت حذف و موجودی آزاد گردید.`,
      };
    },
    [orders, setProducts, addInventoryTransactions]
  );

  // Update Order (Edits order items, updates reserved stock delta and total amount)
  const updateOrder = useCallback(
    async (
      orderId: string,
      updatedItems: {
        productId: string;
        name: string;
        price: number;
        quantity: number;
        items_per_package?: number | string | null;
        unit?: string;
      }[]
    ): Promise<{ success: boolean; message: string }> => {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) return { success: false, message: 'سفارش مورد نظر یافت نشد.' };

      if (targetOrder.status !== 'assigned') {
        return { success: false, message: 'سفارش در مرحله در راه قرار گرفته و دیگر قابل ویرایش نیست.' };
      }

      if (!updatedItems || updatedItems.length === 0) {
        return { success: false, message: 'سبد سفارش نمی‌تواند خالی باشد. در صورت تمایل می‌توانید سفارش را حذف کنید.' };
      }

      const oldItems = targetOrder.items || [];
      const nowIso = new Date().toISOString();

      // Check stock availability for increases
      for (const item of updatedItems) {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return { success: false, message: `کالای ${item.name} یافت نشد.` };

        const oldQty = oldItems.find((i) => i.product_id === item.productId)?.quantity || 0;
        const diffQty = item.quantity - oldQty;
        if (diffQty > 0) {
          const available = Math.round((prod.stock - prod.reserved_stock) * 1000) / 1000;
          if (diffQty > available) {
            return {
              success: false,
              message: `موجودی ناکافی برای افزایش ${prod.name}. موجودی قابل فروش: ${available} ${prod.unit}`,
            };
          }
        }
      }

      // Calculate reserved stock delta for each product
      setProducts((prev) =>
        prev.map((p) => {
          const oldQty = oldItems.find((i) => i.product_id === p.id)?.quantity || 0;
          const newQty = updatedItems.find((i) => i.productId === p.id)?.quantity || 0;
          const delta = newQty - oldQty;
          if (delta !== 0) {
            return {
              ...p,
              reserved_stock: Math.max(0, Math.round((p.reserved_stock + delta) * 1000) / 1000),
            };
          }
          return p;
        })
      );

      const isVisitorChannel =
        targetOrder.order_channel === 'visitor_field' ||
        targetOrder.order_source === 'visitor' ||
        Boolean(targetOrder.assigned_visitor_id && targetOrder.assigned_visitor_id !== 'direct');

      const newTotalAmount = updatedItems.reduce((sum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        const { total } = getItemUnitPriceAndTotal(item, prod, isVisitorChannel);
        return sum + total;
      }, 0);

      const updatedOrderObj: Order = {
        ...targetOrder,
        total_amount: newTotalAmount,
        invoice_revised_at: nowIso,
        items: updatedItems.map((i, idx) => {
          const prod = products.find((p) => p.id === i.productId);
          return {
            id: `item-${Date.now()}-${idx}`,
            order_id: orderId,
            product_id: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            items_per_package: getPackSize(i.items_per_package ?? prod?.items_per_package),
            unit: i.unit ?? prod?.unit,
          };
        }),
      };

      // Supabase sync
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('order_items').delete().eq('order_id', orderId);

          const itemRows = updatedItems.map((i) => {
            const prod = products.find((p) => p.id === i.productId);
            return {
              order_id: orderId,
              product_id: i.productId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              items_per_package: i.items_per_package ?? prod?.items_per_package,
              unit: i.unit ?? prod?.unit,
            };
          });
          await supabase.from('order_items').insert(itemRows);

          await supabase
            .from('orders')
            .update({
              total_amount: newTotalAmount,
              invoice_revised_at: nowIso,
            })
            .eq('id', orderId);
        } catch (err) {
          console.error('Error updating order on Supabase:', err);
        }
      }

      setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrderObj : o)));

      return {
        success: true,
        message: `سفارش ${orderId} با موفقیت به‌روزرسانی شد.`,
      };
    },
    [orders, products, setProducts]
  );

  return {
    orders,
    setOrders,
    reassignmentRequests,
    setReassignmentRequests,
    createOrder,
    updateOrder,
    updateOrderStatus,
    requestReassignment,
    respondToReassignment,
    assignOrderVisitor,
    deleteOrder,
  };
}
