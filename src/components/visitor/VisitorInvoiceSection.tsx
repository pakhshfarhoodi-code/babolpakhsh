import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LoadingBill, LoadingBillItem, Order, Visitor, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatOrderDate, formatPrice } from './helpers';
import { VisitorInvoicePrintModal } from './VisitorInvoicePrintModal';
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  AlertCircle,
  Edit2,
  Trash2,
  Printer,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  User,
  History,
  Info,
  Bell,
  Package,
  X,
} from 'lucide-react';

import { ProductCatalog } from '../shop/ProductCatalog';

interface VisitorInvoiceSectionProps {
  currentVisitor: Visitor;
  orders: Order[];
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const VisitorInvoiceSection: React.FC<VisitorInvoiceSectionProps> = ({
  currentVisitor,
  orders,
  isOpen,
  onToggleOpen,
}) => {
  const { loadingBills, products, showToast, refreshData } = useApp();

  // Active Draft / Current Invoice state
  const [activeBill, setActiveBill] = useState<LoadingBill | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTickingOrders, setIsTickingOrders] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftRequestInFlight = useRef(false);
  const lastAttemptedStatusRef = useRef<string | null>(null);

  // Optimistic order selection and rapid-toggle synchronization
  const [optimisticOrderIds, setOptimisticOrderIds] = useState<Set<string> | null>(null);
  const pendingDraftOrdersRef = useRef<Set<string> | null>(null);
  const isSyncingOrdersRef = useRef<boolean>(false);
  const lastSyncedOrdersRef = useRef<string | null>(null);
  const manuallyToggledOrderIdsRef = useRef<Set<string>>(new Set());

  // Collapsed order items state (default is open, so collapsed set starts empty)
  const [collapsedOrderIds, setCollapsedOrderIds] = useState<Set<string>>(new Set());

  // Surplus items modal state (using shared ProductCatalog)
  const [isSurplusModalOpen, setIsSurplusModalOpen] = useState(false);
  const [surplusCart, setSurplusCart] = useState<Record<string, number>>({});
  const [surplusCustomerLabel, setSurplusCustomerLabel] = useState<string>('');
  const [isSubmittingSurplus, setIsSubmittingSurplus] = useState(false);

  // Edit quantity modal state
  const [editingItem, setEditingItem] = useState<LoadingBillItem | null>(null);
  const [editQty, setEditQty] = useState<number | string>(1);
  const [isUpdatingLine, setIsUpdatingLine] = useState(false);

  // View / Print modal state
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<LoadingBill | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'current' | 'archive'>('current');

  // Visitor bills
  const visitorBills = useMemo(() => {
    return loadingBills.filter((b) => b.visitor_id === currentVisitor.id);
  }, [loadingBills, currentVisitor.id]);

  // Find active draft or in-progress bill
  const currentVisitorBill = useMemo(() => {
    // 1. Look for a draft bill
    const draft = visitorBills.find((b) => b.status === 'draft');
    if (draft) return draft;

    // 2. Look for pending or approved (in-progress) bill
    const inProgress = visitorBills.find((b) => b.status === 'pending' || b.status === 'approved');
    if (inProgress) return inProgress;

    // 3. Most recent bill
    return visitorBills[0] || null;
  }, [visitorBills]);

  // Sync activeBill with context updates
  useEffect(() => {
    if (currentVisitorBill) {
      setActiveBill(currentVisitorBill);
    }
  }, [currentVisitorBill]);

  // Fetch or create draft on open
  const fetchOrCreateDraft = useCallback(async () => {
    if (draftRequestInFlight.current) return;
    if (!currentVisitor.id) return;

    setIsLoadingDraft(true);

    try {
      if (isSupabaseConfigured && supabase) {
        draftRequestInFlight.current = true;
        const { data, error } = await supabase.rpc('get_or_create_draft', {
          p_visitor_id: currentVisitor.id,
        });

        if (error) {
          const errorMsg = error.message || String(error);
          if (
            errorMsg.toLowerCase().includes('duplicate key') ||
            (error as { code?: string })?.code === '23505'
          ) {
            setDraftError(null);
            refreshData();
            return;
          }
          setDraftError(errorMsg || 'خطا در بارگذاری پیش‌نویس فاکتور.');
          showToast(errorMsg || 'خطا در بارگذاری پیش‌نویس فاکتور.', 'error');
          return;
        }

        if (!data || (data as { success?: boolean; message?: string }).success === false) {
          const msg = (data as { message?: string })?.message || 'خطا در ایجاد پیش‌نویس فاکتور.';
          if (msg.toLowerCase().includes('duplicate key')) {
            setDraftError(null);
            refreshData();
            return;
          }
          setDraftError(msg);
          showToast(msg, 'error');
          return;
        }

        const isNewDraft = Boolean((data as { is_new?: boolean })?.is_new);
        const billId =
          (data as { bill_id?: string })?.bill_id ||
          (data as { bill?: { id: string } })?.bill?.id;

        if (isNewDraft && billId) {
          // Automatic draft_set_orders: all eligible orders assigned to this visitor
          const { data: dbOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('assigned_visitor_id', currentVisitor.id)
            .eq('status', 'assigned')
            .is('loading_bill_id', null);

          const eligibleIds =
            dbOrders && dbOrders.length > 0
              ? dbOrders.map((o: { id: string }) => o.id)
              : orders
                  .filter(
                    (o) =>
                      o.assigned_visitor_id === currentVisitor.id &&
                      o.status === 'assigned' &&
                      (!o.loading_bill_id || o.loading_bill_id === billId)
                  )
                  .map((o) => o.id);

          if (eligibleIds.length > 0) {
            const { data: setOrdData, error: setOrdErr } = await supabase.rpc(
              'draft_set_orders',
              {
                p_invoice_id: billId,
                p_order_ids: eligibleIds,
              }
            );

            if (setOrdErr || (setOrdData as { success?: boolean })?.success === false) {
              const errMsg =
                setOrdErr?.message ||
                (setOrdData as { message?: string })?.message ||
                'خطا در ثبت خودکار سفارش‌ها.';
              showToast(errMsg, 'error');
            }
          }
        }

        setDraftError(null);
        // Refresh data cleanly without resets
        refreshData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در دریافت فاکتور.';
      if (msg.toLowerCase().includes('duplicate key')) {
        setDraftError(null);
        refreshData();
        return;
      }
      setDraftError(msg);
      showToast(msg, 'error');
    } finally {
      draftRequestInFlight.current = false;
      setIsLoadingDraft(false);
    }
  }, [currentVisitor.id, showToast, refreshData, orders]);

  // Trigger get_or_create_draft when section is opened
  useEffect(() => {
    if (!isOpen || !currentVisitor.id) return;

    const hasActiveDraftOrPending = visitorBills.some(
      (b) => b.status === 'draft' || b.status === 'pending' || b.status === 'approved'
    );
    if (hasActiveDraftOrPending) {
      return;
    }

    const currentStatuses = `${currentVisitor.id}:${visitorBills.map((b) => `${b.id}:${b.status}`).join(',')}`;
    if (lastAttemptedStatusRef.current === currentStatuses) {
      return;
    }

    lastAttemptedStatusRef.current = currentStatuses;
    fetchOrCreateDraft();
  }, [isOpen, currentVisitor.id, visitorBills.length]);

  // Active products map for details and stock
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Eligible assigned orders for this visitor (status === 'assigned' and not locked in another bill)
  const eligibleOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.assigned_visitor_id === currentVisitor.id &&
        o.status === 'assigned' &&
        (!o.loading_bill_id || (activeBill && o.loading_bill_id === activeBill.id))
    );
  }, [orders, currentVisitor.id, activeBill]);

  // Selected order IDs in active draft (with optimistic selection priority)
  const selectedOrderIdsInDraft = useMemo(() => {
    if (optimisticOrderIds !== null) {
      return optimisticOrderIds;
    }
    if (!activeBill?.items) return new Set<string>();
    const set = new Set<string>();
    activeBill.items.forEach((it) => {
      if (it.order_id) set.add(it.order_id);
    });
    return set;
  }, [optimisticOrderIds, activeBill]);

  // Synchronize optimistic selection back to database truth when idle
  useEffect(() => {
    if (!isSyncingOrdersRef.current && pendingDraftOrdersRef.current === null) {
      setOptimisticOrderIds(null);
    }
  }, [activeBill]);

  // Sequential background synchronization for rapid order toggles (latest choice wins)
  const syncDraftOrders = useCallback(async () => {
    if (isSyncingOrdersRef.current) return;
    if (!activeBill?.id) return;

    isSyncingOrdersRef.current = true;
    try {
      while (pendingDraftOrdersRef.current !== null && activeBill?.id) {
        const targetIds = Array.from(pendingDraftOrdersRef.current);
        const targetKey = targetIds.slice().sort().join(',');

        if (lastSyncedOrdersRef.current === targetKey) {
          pendingDraftOrdersRef.current = null;
          break;
        }

        const invoiceId = activeBill.id;
        const { data, error } = await supabase.rpc('draft_set_orders', {
          p_invoice_id: invoiceId,
          p_order_ids: targetIds,
        });

        if (error || !data || (data as { success?: boolean }).success === false) {
          const msg =
            error?.message || (data as { message?: string })?.message || 'خطا در ذخیره سفارش‌ها.';
          showToast(msg, 'error');
          // Revert optimistic selection on error
          setOptimisticOrderIds(null);
          pendingDraftOrdersRef.current = null;
          return;
        }

        lastSyncedOrdersRef.current = targetKey;

        const currentPendingKey = pendingDraftOrdersRef.current
          ? Array.from(pendingDraftOrdersRef.current).slice().sort().join(',')
          : null;

        if (currentPendingKey === targetKey) {
          pendingDraftOrdersRef.current = null;
          refreshData();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ذخیره سفارش‌ها.';
      showToast(msg, 'error');
      setOptimisticOrderIds(null);
      pendingDraftOrdersRef.current = null;
    } finally {
      isSyncingOrdersRef.current = false;
    }
  }, [activeBill?.id, showToast, refreshData]);

  // Handle toggling an order's inclusion in draft bill (Optimistic, non-blocking, no success toast)
  const handleToggleOrder = (orderId: string) => {
    if (!activeBill || activeBill.status !== 'draft') return;

    manuallyToggledOrderIdsRef.current.add(orderId);

    const currentSelected = new Set(
      optimisticOrderIds ?? Array.from(selectedOrderIdsInDraft)
    );

    if (currentSelected.has(orderId)) {
      currentSelected.delete(orderId);
    } else {
      currentSelected.add(orderId);
    }

    const nextSet = new Set(currentSelected);
    setOptimisticOrderIds(nextSet);
    pendingDraftOrdersRef.current = nextSet;
    syncDraftOrders();
  };

  // Identify new orders arrived after draft creation that are not yet in the draft
  const newArrivedOrders = useMemo(() => {
    if (!activeBill || activeBill.status !== 'draft') return [];
    const draftCreatedAt = activeBill.created_at ? new Date(activeBill.created_at).getTime() : 0;

    return eligibleOrders.filter((ord) => {
      if (selectedOrderIdsInDraft.has(ord.id)) return false;
      if (manuallyToggledOrderIdsRef.current.has(ord.id)) return false;

      const ordDate = ord.order_date;
      if (draftCreatedAt > 0 && ordDate) {
        return new Date(ordDate).getTime() > draftCreatedAt;
      }
      return false;
    });
  }, [activeBill, eligibleOrders, selectedOrderIdsInDraft]);

  // Handle "Add All" for newly arrived orders
  const handleAddAllNewOrders = () => {
    if (!activeBill || activeBill.status !== 'draft') return;

    const currentSelected = new Set(
      optimisticOrderIds ?? Array.from(selectedOrderIdsInDraft)
    );

    newArrivedOrders.forEach((o) => {
      currentSelected.add(o.id);
      manuallyToggledOrderIdsRef.current.delete(o.id);
    });

    const nextSet = new Set(currentSelected);
    setOptimisticOrderIds(nextSet);
    pendingDraftOrdersRef.current = nextSet;
    syncDraftOrders();
  };

  // Toggle order items accordion collapse
  const toggleOrderCollapse = (orderId: string) => {
    setCollapsedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Calculate order items and total exclusively with visitor purchasing price (zero store retail price)
  const getOrderVisitorDetails = useCallback(
    (ord: Order) => {
      let orderTotal = 0;
      const items = (ord.items || []).map((it) => {
        const prod = productMap.get(it.product_id);
        const unit = prod?.unit || 'بسته';
        const visitorPrice = Number(
          prod?.visitor_price ?? (prod?.price ? Math.round(Number(prod.price) * 0.85) : it.price)
        );
        const lineTotal = it.quantity * visitorPrice;
        orderTotal += lineTotal;
        return {
          id: it.id || `${ord.id}-${it.product_id}`,
          name: it.name,
          quantity: it.quantity,
          unit,
          visitorPrice,
          lineTotal,
        };
      });
      return { items, orderTotal };
    },
    [productMap]
  );

  // Aggregated items for visitor (strictly visitor purchasing price, no retail prices, no margins)
  const aggregatedItems = useMemo(() => {
    if (!activeBill?.items || activeBill.items.length === 0) return [];

    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        unit: string;
        totalQuantity: number;
        visitorPrice: number;
        totalAmount: number;
        manualLines: LoadingBillItem[];
        orderLinesCount: number;
      }
    >();

    for (const it of activeBill.items) {
      const prod = productMap.get(it.product_id);
      const packCount = it.items_per_package || prod?.items_per_package;
      const unit = packCount && packCount > 1
        ? `${it.unit || prod?.unit || 'کارتن'} (${packCount} عددی)`
        : (it.unit || prod?.unit || 'بسته');
      const vPrice = Number(
        it.visitor_price ?? (prod?.visitor_price ? Number(prod.visitor_price) * (packCount || 1) : Math.round(Number(prod?.price || 0) * (packCount || 1) * 0.85))
      );

      const existing = map.get(it.product_id);
      if (existing) {
        existing.totalQuantity = Math.round((existing.totalQuantity + it.quantity) * 1000) / 1000;
        existing.totalAmount += it.quantity * existing.visitorPrice;
        if (it.source === 'visitor_manual' || it.source === 'admin_manual') {
          existing.manualLines.push(it);
        } else {
          existing.orderLinesCount += 1;
        }
      } else {
        map.set(it.product_id, {
          productId: it.product_id,
          productName: it.product_name,
          unit,
          totalQuantity: it.quantity,
          visitorPrice: vPrice,
          totalAmount: it.quantity * vPrice,
          manualLines:
            it.source === 'visitor_manual' || it.source === 'admin_manual' ? [it] : [],
          orderLinesCount: it.source === 'order' ? 1 : 0,
        });
      }
    }

    return Array.from(map.values());
  }, [activeBill?.items, productMap]);

  // Grand totals
  const totalAmount = useMemo(() => {
    return aggregatedItems.reduce((sum, it) => sum + it.totalAmount, 0);
  }, [aggregatedItems]);

  const totalQuantity = useMemo(() => {
    const sum = aggregatedItems.reduce((acc, it) => acc + (Number(it.totalQuantity) || 0), 0);
    return Math.round(sum * 1000) / 1000;
  }, [aggregatedItems]);

  // Handle quantity change for surplus items in ProductCatalog modal
  const handleSurplusQuantityChange = useCallback(
    (productId: string, qty: number) => {
      const prod = productMap.get(productId) || products.find((p) => p.id === productId);
      const available = prod ? Math.round(Math.max(0, prod.stock - prod.reserved_stock) * 1000) / 1000 : 0;
      const validQty = Math.round(Math.max(0, Math.min(qty, available)) * 1000) / 1000;

      setSurplusCart((prev) => {
        if (validQty <= 0) {
          const next = { ...prev };
          delete next[productId];
          return next;
        }
        return { ...prev, [productId]: validQty };
      });
    },
    [productMap, products]
  );

  // Surplus totals calculation
  const totalSurplusCount = useMemo(() => {
    const sum = Object.values(surplusCart).reduce((acc, q) => acc + (Number(q) || 0), 0);
    return Math.round(sum * 1000) / 1000;
  }, [surplusCart]);

  const totalSurplusAmount = useMemo(() => {
    return Object.entries(surplusCart).reduce((sum, [pId, qty]) => {
      const prod = productMap.get(pId) || products.find((p) => p.id === pId);
      const vPrice = Number(
        prod?.visitor_price ?? (prod?.price ? Math.round(Number(prod.price) * 0.85) : 0)
      );
      return sum + (Number(qty) || 0) * vPrice;
    }, 0);
  }, [surplusCart, productMap, products]);

  // Handle surplus items submission to draft bill
  const handleSurplusSubmit = async () => {
    if (!activeBill || isSubmittingSurplus || totalSurplusCount <= 0) return;

    setIsSubmittingSurplus(true);
    const finalLabel = surplusCustomerLabel.trim() || 'موجودی همراه ویزیتور';
    const entries = Object.entries(surplusCart).filter(([_, qty]) => Number(qty) > 0);

    let successCount = 0;

    try {
      if (isSupabaseConfigured && supabase) {
        for (const [productId, qty] of entries) {
          const { data, error } = await supabase.rpc('invoice_add_manual_line', {
            p_invoice_id: activeBill.id,
            p_product_id: productId,
            p_qty: Math.round((Number(qty) || 0) * 1000) / 1000,
            p_customer_label: finalLabel,
            p_source: 'visitor_manual',
            p_line_note: null,
            p_unit_price: null,
            p_actor: currentVisitor.name,
          });

          if (error || !data || (data as { success?: boolean }).success === false) {
            const msg =
              error?.message ||
              (data as { message?: string })?.message ||
              `خطا در افزودن کالا به اقلام مازاد.`;
            showToast(msg, 'error');
          } else {
            successCount++;
          }
        }

        if (successCount > 0) {
          showToast(`${successCount} قلم مازاد با موفقیت به فاکتور بار افزوده شد.`, 'success');
          setSurplusCart({});
          setSurplusCustomerLabel('');
          setIsSurplusModalOpen(false);
          refreshData();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت اقلام مازاد.';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingSurplus(false);
    }
  };

  // Handle updating line quantity
  const handleUpdateLine = async () => {
    const parsedEditQty = Math.round((parseFloat(String(editQty)) || 0) * 1000) / 1000;
    if (!editingItem || parsedEditQty <= 0 || isUpdatingLine) return;
    setIsUpdatingLine(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('invoice_update_line', {
          p_line_id: editingItem.id,
          p_qty: parsedEditQty,
          p_unit_price: null,
          p_actor: currentVisitor.name,
          p_reason: 'ویرایش تعداد توسط ویزیتور',
        });

        if (error) {
          showToast(error.message || 'خطا در ویرایش تعداد کالا.', 'error');
          return;
        }

        if (!data || (data as { success?: boolean; message?: string }).success === false) {
          const msg = (data as { message?: string })?.message || 'خطا در ویرایش تعداد کالا.';
          showToast(msg, 'error');
          return;
        }

        showToast('تعداد کالا در فاکتور با موفقیت اصلاح شد.', 'success');
        setEditingItem(null);
        refreshData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در به‌روزرسانی ردیف.';
      showToast(msg, 'error');
    } finally {
      setIsUpdatingLine(false);
    }
  };

  // Handle removing manual line
  const handleRemoveLine = async (lineId: string) => {
    if (!window.confirm('آیا از حذف این ردیف از فاکتور بار اطمینان دارید؟')) return;

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('invoice_remove_line', {
          p_line_id: lineId,
          p_actor: currentVisitor.name,
          p_reason: 'حذف توسط ویزیتور',
        });

        if (error) {
          showToast(error.message || 'خطا در حذف قلم.', 'error');
          return;
        }

        if (!data || (data as { success?: boolean; message?: string }).success === false) {
          const msg = (data as { message?: string })?.message || 'خطا در حذف ردیف.';
          showToast(msg, 'error');
          return;
        }

        showToast('ردیف با موفقیت از فاکتور بار حذف شد.', 'success');
        refreshData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در حذف قلم.';
      showToast(msg, 'error');
    }
  };

  // Handle submit invoice to admin
  const handleSubmitInvoice = async () => {
    if (!activeBill || isSubmitting) return;

    if (!activeBill.items || activeBill.items.length === 0) {
      showToast('فاکتور بار فاقد هرگونه قلم کالا است. لطفاً حداقل یک سفارش یا قلم آزاد انتخاب کنید.', 'error');
      return;
    }

    if (!window.confirm('آیا از ارسال فاکتور بار برای تایید ادمین و انبار اطمینان دارید؟ پس از ارسال، فاکتور جهت بررسی قفل خواهد شد.')) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('submit_invoice', {
          p_invoice_id: activeBill.id,
          p_visitor_id: currentVisitor.id,
        });

        if (error) {
          showToast(error.message || 'خطا در ارسال فاکتور برای ادمین.', 'error');
          return;
        }

        if (!data || (data as { success?: boolean; message?: string }).success === false) {
          const msg = (data as { message?: string })?.message || 'خطا در ارسال فاکتور بارگیری.';
          showToast(msg, 'error');
          return;
        }

        showToast('فاکتور بار با موفقیت به ادمین و انبار ارسال شد.', 'success');
        refreshData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ارسال فاکتور.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: LoadingBill['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-blue-300 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span>پیش‌نویس بارگیری</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600/40 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>منتظر تایید ادمین</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-950/80 text-blue-300 border border-blue-600/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>تایید شد (آماده بارگیری)</span>
          </span>
        );
      case 'loaded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
            <Truck className="w-3.5 h-3.5 text-emerald-400" />
            <span>بارگیری شد (خروج از انبار)</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/80 text-rose-300 border border-rose-600/40">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>لغو شده</span>
          </span>
        );
      default:
        return null;
    }
  };

  const isReadOnly = activeBill && activeBill.status !== 'draft';

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg transition">
      {/* Header Bar Accordion Toggle */}
      <div
        onClick={onToggleOpen}
        className="w-full p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-right hover:bg-slate-800/40 transition cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shadow-sm shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-100">
                فاکتور بار من
              </h3>
              {activeBill && renderStatusBadge(activeBill.status)}
              {activeBill && (activeBill.revision_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3 h-3" />
                  <span>ادمین اصلاح کرد ({activeBill.revision_count} بار)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تجمیع اقلام بارگیری، انتخاب سفارش‌ها و اقلام آزاد مشتریان
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 mr-auto sm:mr-0">
          {activeBill?.invoice_no && (
            <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700/80 font-mono text-xs font-bold text-slate-200">
              {activeBill.invoice_no}
            </span>
          )}

          <div className="p-1 rounded-xl bg-slate-800 text-slate-400">
            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Main Accordion Body */}
      {isOpen && (
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/40 space-y-6 animate-in fade-in">
          {/* Sub Navigation: Current Active Invoice vs Archive */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSubTab('current')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeSubTab === 'current'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                فاکتور بار جاری
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('archive')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === 'archive'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>فاکتورهای من (آرشیو)</span>
                {visitorBills.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-300 text-[10px]">
                    {visitorBills.length}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Actions (Print / New Draft) */}
            <div className="flex items-center gap-2">
              {activeBill && (
                <button
                  type="button"
                  onClick={() => setSelectedBillForPrint(activeBill)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                    activeBill.status === 'approved' || activeBill.status === 'loaded'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                  title={activeBill.status === 'approved' || activeBill.status === 'loaded' ? 'چاپ و ذخیره فاکتور نهایی' : 'پیش‌نمایش پیش‌نویس فاکتور'}
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {activeBill.status === 'approved' || activeBill.status === 'loaded' ? 'چاپ / ذخیره PDF' : 'پیش‌نمایش فاکتور'}
                  </span>
                </button>
              )}

              {activeBill && (activeBill.status === 'loaded' || activeBill.status === 'cancelled') && (
                <button
                  type="button"
                  onClick={fetchOrCreateDraft}
                  disabled={isLoadingDraft}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>ایجاد پیش‌نویس بار جدید</span>
                </button>
              )}
            </div>
          </div>

          {activeSubTab === 'current' ? (
            <>
              {/* Draft error banner with retry button */}
              {draftError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{draftError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftError(null);
                      fetchOrCreateDraft();
                    }}
                    disabled={isLoadingDraft}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تلاش مجدد</span>
                  </button>
                </div>
              )}

              {/* If bill is cancelled, show reason banner */}
              {activeBill?.status === 'cancelled' && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>این فاکتور بار توسط ادمین یا سیستم لغو شده است:</span>
                  </div>
                  <p className="mr-6 text-slate-300 font-medium">
                    {activeBill.cancel_reason || 'دلیلی قید نشده است.'}
                  </p>
                </div>
              )}

              {/* If bill is pending, show waiting note */}
              {activeBill?.status === 'pending' && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                    <span>
                      فاکتور بار به انبار ارسال شده و در انتظار تایید و تخصیص شماره توسط ادمین است.
                    </span>
                  </div>
                  <span className="text-xs text-amber-400/80 font-mono">
                    تاریخ ارسال: {formatOrderDate(activeBill.submitted_at || activeBill.created_at)}
                  </span>
                </div>
              )}

              {/* 1. TOP SECTION: «فاکتور تجمیعی من» (Aggregated Items) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                      فاکتور تجمیعی من (اقلام بارگیری)
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    {aggregatedItems.length} ردیف کالا | {totalQuantity} واحد
                  </span>
                </div>

                {aggregatedItems.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs space-y-2">
                    <p className="font-semibold text-slate-300">هنوز قلمی در فاکتور بار اضافه نشده است.</p>
                    <p className="text-slate-500">
                      از بخش زیر سفارش‌های آماده ارسال را انتخاب کنید یا با دکمه «+ افزودن اقلام مازاد» کالا اضافه نمایید.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
                            <th className="py-3 px-4 w-12 text-center">ردیف</th>
                            <th className="py-3 px-4">شرح کالا</th>
                            <th className="py-3 px-3 w-20 text-center">تعداد کل</th>
                            <th className="py-3 px-4 w-32 text-left">قیمت خرید ویزیتور</th>
                            <th className="py-3 px-4 w-36 text-left">مبلغ کل (تومان)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {aggregatedItems.map((item, idx) => (
                            <React.Fragment key={item.productId}>
                              <tr className="hover:bg-slate-800/30 transition">
                                <td className="py-3 px-4 text-center text-slate-500 font-mono">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-100">{item.productName}</div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                    <span>واحد: {item.unit}</span>
                                    {item.orderLinesCount > 0 && (
                                      <span className="text-blue-400">
                                        ({item.orderLinesCount} سفارش)
                                      </span>
                                    )}
                                    {item.manualLines.length > 0 && (
                                      <span className="text-purple-400 font-medium">
                                        ({item.manualLines.length} قلم مازاد)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="font-black text-sm text-slate-100">
                                    {item.totalQuantity}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-left font-mono text-slate-300">
                                  {formatPrice(item.visitorPrice)}
                                </td>
                                <td className="py-3 px-4 text-left font-mono font-bold text-blue-400">
                                  {formatPrice(item.totalAmount)}
                                </td>
                              </tr>

                              {/* Manual lines breakdown subrows (editable & removable) */}
                              {item.manualLines.map((ml) => (
                                <tr key={ml.id} className="bg-purple-950/15 text-[11px] border-b border-purple-900/20">
                                  <td className="py-1.5 px-4 text-center text-purple-400">↳</td>
                                  <td className="py-1.5 px-4 text-purple-200" colSpan={1}>
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded-md bg-purple-900/40 text-purple-300 font-bold border border-purple-700/50">
                                        {ml.customer_label || 'اقلام مازاد'}
                                      </span>
                                      {ml.line_note && (
                                        <span className="text-slate-400">توضیح: {ml.line_note}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-3 text-center font-bold text-purple-300">
                                    {ml.quantity} {item.unit}
                                  </td>
                                  <td className="py-1.5 px-4 text-left font-mono text-slate-400">
                                    {formatPrice(ml.visitor_price || item.visitorPrice)}
                                  </td>
                                  <td className="py-1.5 px-4 text-left font-mono">
                                    <div className="flex items-center justify-between">
                                      <span className="text-purple-300">
                                        {formatPrice(ml.quantity * (ml.visitor_price || item.visitorPrice))}
                                      </span>

                                      {/* Edit & Delete actions for manual lines (only when draft) */}
                                      {!isReadOnly && (
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingItem(ml);
                                              setEditQty(ml.quantity);
                                            }}
                                            className="p-1 rounded hover:bg-slate-800 text-blue-400 transition cursor-pointer"
                                            title="ویرایش تعداد"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveLine(ml.id)}
                                            className="p-1 rounded hover:bg-slate-800 text-rose-400 transition cursor-pointer"
                                            title="حذف قلم"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-950 font-black border-t-2 border-slate-800 text-slate-100">
                            <td colSpan={2} className="py-3.5 px-4 text-right">
                              جمع کل فاکتور بار من:
                            </td>
                            <td className="py-3.5 px-3 text-center text-blue-400 text-sm">
                              {totalQuantity}
                            </td>
                            <td className="py-3.5 px-4"></td>
                            <td className="py-3.5 px-4 text-left font-mono text-base text-emerald-400">
                              {formatPrice(totalAmount)} تومان
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Surplus Item Add Button */}
                {!isReadOnly && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSurplusCart({});
                        setSurplusCustomerLabel('');
                        setIsSurplusModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-bold text-xs sm:text-sm border border-purple-500/30 transition cursor-pointer shadow-sm active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن اقلام مازاد</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. MIDDLE SECTION: Eligible Orders Checklist */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                      سفارش‌های قابل بارگیری (مشتریان سامانه)
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    {selectedOrderIdsInDraft.size} از {eligibleOrders.length} انتخاب شده
                  </span>
                </div>

                {/* New Orders Arrived Banner */}
                {newArrivedOrders.length > 0 && !isReadOnly && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-bold block">
                          {newArrivedOrders.length} سفارش جدید رسیده
                        </span>
                        <span className="text-[11px] text-amber-400/80">
                          این سفارش‌ها پس از ایجاد پیش‌نویس ثبت شده‌اند.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAllNewOrders}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-sm active:scale-95"
                    >
                      افزودن همه
                    </button>
                  </div>
                )}

                {eligibleOrders.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
                    سفارش آماده بارگیری جدیدی برای این ویزیتور در وضعیت «آماده ارسال» موجود نیست.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[30rem] overflow-y-auto pr-1">
                    {eligibleOrders.map((ord) => {
                      const isChecked = selectedOrderIdsInDraft.has(ord.id);
                      const isCollapsed = collapsedOrderIds.has(ord.id);
                      const { items: orderVisitorItems, orderTotal: orderVisitorTotal } =
                        getOrderVisitorDetails(ord);

                      return (
                        <div
                          key={ord.id}
                          className={`p-3 rounded-2xl border transition ${
                            isChecked
                              ? 'bg-blue-950/20 border-blue-500/40 text-slate-100 shadow-sm'
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                          } ${isReadOnly ? 'opacity-80' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex items-start gap-2.5 min-w-0 cursor-pointer flex-1 select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isReadOnly}
                                onChange={() => handleToggleOrder(ord.id)}
                                className="mt-0.5 w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-xs sm:text-sm truncate text-slate-200">
                                  {ord.supermarket_name}
                                </p>
                                <span className="text-[11px] font-mono text-slate-500 block">
                                  {ord.id}
                                </span>
                              </div>
                            </label>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-left">
                                <span className="text-xs sm:text-sm font-bold text-emerald-400">
                                  {formatPrice(orderVisitorTotal)}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  تومان (خرید ویزیتور)
                                </span>
                              </div>

                              {isChecked && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleOrderCollapse(ord.id);
                                  }}
                                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                  title={isCollapsed ? 'نمایش اقلام' : 'بستن اقلام'}
                                >
                                  {isCollapsed ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronUp className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Collapsible items under ticked customer (Default open) */}
                          {isChecked && !isCollapsed && orderVisitorItems.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
                              <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800/40 px-1">
                                <span>نام کالا</span>
                                <div className="flex items-center gap-4">
                                  <span>تعداد</span>
                                  <span className="w-24 text-left">مبلغ (خرید ویزیتور)</span>
                                </div>
                              </div>
                              {orderVisitorItems.map((it) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between text-xs py-1 px-1 rounded hover:bg-slate-800/40 transition"
                                >
                                  <span className="truncate max-w-[50%] text-slate-200 font-medium text-[11px]">
                                    {it.name}
                                  </span>
                                  <div className="flex items-center gap-4 shrink-0">
                                    <span className="text-slate-300 font-mono text-[11px]">
                                      {it.quantity} {it.unit}
                                    </span>
                                    <span className="w-24 text-left font-mono font-medium text-emerald-400 text-[11px]">
                                      {formatPrice(it.lineTotal)}{' '}
                                      <span className="text-[9px] text-slate-500">ت</span>
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. BOTTOM SUBMIT ACTION BAR */}
              {!isReadOnly && (
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span>
                      پس از تایید اقلام بالا، فاکتور را برای ادمین جهت صدور شماره و خروج از انبار ارسال کنید.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmitInvoice}
                    disabled={isSubmitting || aggregatedItems.length === 0}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs transition shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'در حال ارسال فاکتور...' : 'ارسال برای ادمین'}</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* 4. ARCHIVE SUBTAB: فاکتورهای من */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  <span>آرشیو فاکتورهای بارگیری من</span>
                </h4>
                <span className="text-xs text-slate-400">{visitorBills.length} فاکتور ثبت شده</span>
              </div>

              {visitorBills.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
                  هیچ فاکتور پیشین یا بارگیری‌شده‌ای یافت نشد.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visitorBills.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-100">
                            {b.invoice_no || b.id}
                          </span>
                          {renderStatusBadge(b.status)}
                          {(b.revision_count ?? 0) > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                              اصلاح‌شده ({b.revision_count} بار)
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px]">
                          تاریخ صدور: {formatOrderDate(b.created_at)}
                          {b.finalized_by && ` | تایید: ${b.finalized_by}`}
                          {b.orders_count !== undefined && ` | ${b.orders_count} سفارش`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-left">
                          <div className="font-mono font-bold text-sm text-slate-200">
                            {formatPrice(Number(b.total_visitor_cost || 0))} تومان
                          </div>
                          <span className="text-[10px] text-slate-500">مبلغ خرید ویزیتور</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedBillForPrint(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          <span>چاپ / ذخیره PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full-Page Modal: Add Surplus Items (ProductCatalog with visitor purchasing price & in-stock default) */}
      {isSurplusModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-100">
                  افزودن اقلام مازاد به فاکتور بار
                </h3>
                <p className="text-xs text-slate-400">
                  اقلام را با قیمت خرید ویزیتور و به تعداد دلخواه (شامل اعشاری) انتخاب نمایید
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSurplusModalOpen(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Catalog Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 max-w-5xl mx-auto w-full">
            <ProductCatalog
              products={products}
              cart={surplusCart}
              onChangeQuantity={handleSurplusQuantityChange}
              onExceedLimit={(max) =>
                showToast(`موجودی آزاد کالا به ${max.toLocaleString('fa-IR')} واحد محدود شد.`)
              }
              priceMode="visitor"
              defaultInStockOnly={true}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900 shrink-0 shadow-2xl">
            <div className="max-w-5xl mx-auto space-y-3">
              {/* Customer Label (Optional) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-xs font-semibold text-slate-400 shrink-0">
                  نام مشتری (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="در صورت خالی بودن، «موجودی همراه ویزیتور» ثبت می‌شود"
                  value={surplusCustomerLabel}
                  onChange={(e) => setSurplusCustomerLabel(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Summary and Submit */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">تعداد اقلام: </span>
                    <span className="font-bold font-mono text-purple-300">
                      {totalSurplusCount.toLocaleString('fa-IR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">جمع مبلغ (خرید ویزیتور): </span>
                    <span className="font-bold font-mono text-emerald-400 text-sm">
                      {formatPrice(totalSurplusAmount)}
                    </span>
                    <span className="text-[10px] text-slate-400 mr-1">تومان</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSurplusModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleSurplusSubmit}
                    disabled={isSubmittingSurplus || totalSurplusCount <= 0}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs transition shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingSurplus ? 'در حال افزودن اقلام...' : 'افزودن به فاکتور'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Manual Line Quantity */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <span>ویرایش تعداد کالا</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-slate-300 font-semibold">{editingItem.product_name}</p>
              <div>
                <label className="block text-slate-400 mb-1">تعداد جدید:</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleUpdateLine}
                  disabled={isUpdatingLine}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-md"
                >
                  {isUpdatingLine ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visitor Invoice Print & PDF Modal */}
      {selectedBillForPrint && (
        <VisitorInvoicePrintModal
          isOpen={!!selectedBillForPrint}
          onClose={() => setSelectedBillForPrint(null)}
          bill={selectedBillForPrint}
          visitor={currentVisitor}
          products={products}
          orders={orders}
        />
      )}
    </div>
  );
};
