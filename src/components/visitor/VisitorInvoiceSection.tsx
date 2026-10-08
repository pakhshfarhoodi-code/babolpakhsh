import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LoadingBill, LoadingBillItem, Order, Visitor, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatOrderDate, formatPrice } from './helpers';
import { VisitorInvoicePrintModal } from './VisitorInvoicePrintModal';
import {
  getPackSize,
  getBaseUnit,
  getUnitColumnText,
  getSaleUnitLabel,
  computeLine,
} from '../../utils/orderLine';
import {
  Plus,
  Send,
  Printer,
  History,
  RotateCcw,
  AlertCircle,
  X,
  Edit2,
  Package,
} from 'lucide-react';
import { ProductCatalog } from '../shop/ProductCatalog';
import { InvoiceStatusStepper } from './InvoiceStatusStepper';
import { EligibleOrdersStep } from './EligibleOrdersStep';
import { SurplusItemsStep } from './SurplusItemsStep';
import { InvoiceReviewStep } from './InvoiceReviewStep';

interface VisitorInvoiceSectionProps {
  currentVisitor: Visitor;
  orders: Order[];
}

export const VisitorInvoiceSection: React.FC<VisitorInvoiceSectionProps> = ({
  currentVisitor,
  orders,
}) => {
  const {
    loadingBills,
    products,
    showToast,
    refreshData,
  } = useApp();

  // Active Draft / Current Invoice state
  const [activeBill, setActiveBill] = useState<LoadingBill | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftRequestInFlight = useRef(false);
  const lastAttemptedStatusRef = useRef<string | null>(null);

  // Deselected order IDs (default empty set -> all eligible orders are checked by default)
  const [deselectedOrderIds, setDeselectedOrderIds] = useState<Set<string>>(new Set());
  const pendingDraftOrdersRef = useRef<Set<string> | null>(null);
  const isSyncingOrdersRef = useRef<boolean>(false);
  const lastSyncedOrdersRef = useRef<string | null>(null);

  // Inline surplus section state
  const [inlineSurplusProductId, setInlineSurplusProductId] = useState<string>('');
  const [inlineSurplusQty, setInlineSurplusQty] = useState<number | string>(1);
  const [inlineSurplusCustomerLabel, setInlineSurplusCustomerLabel] = useState<string>('');
  const [inlineSurplusSearch, setInlineSurplusSearch] = useState<string>('');
  const [isSubmittingInlineSurplus, setIsSubmittingInlineSurplus] = useState(false);

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

  // Fetch or create draft on mount
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

  // Trigger get_or_create_draft on mount if needed
  useEffect(() => {
    if (!currentVisitor.id) return;

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
  }, [currentVisitor.id, visitorBills.length, fetchOrCreateDraft]);

  // Active products map for details and stock
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => {
      map.set(p.id, p);
      if (p.name) map.set(p.name.trim().toLowerCase(), p);
    });
    return map;
  }, [products]);

  // Eligible assigned orders for this visitor
  const eligibleOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        (o.assigned_visitor_id === currentVisitor.id ||
          (o.supermarket_id?.startsWith('self-') && o.supermarket_id === `self-${currentVisitor.id}`)) &&
        o.status === 'assigned' &&
        (!o.loading_bill_id || (activeBill && o.loading_bill_id === activeBill.id))
    );
  }, [orders, currentVisitor.id, activeBill]);

  // Selected order IDs
  const selectedOrderIds = useMemo(() => {
    const set = new Set<string>();
    eligibleOrders.forEach((o) => {
      if (!deselectedOrderIds.has(o.id)) {
        set.add(o.id);
      }
    });
    return set;
  }, [eligibleOrders, deselectedOrderIds]);

  // Sequential background synchronization for draft orders
  const syncDraftOrders = useCallback(async () => {
    if (isSyncingOrdersRef.current) return;
    if (!activeBill?.id || activeBill.status !== 'draft') return;

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
      pendingDraftOrdersRef.current = null;
    } finally {
      isSyncingOrdersRef.current = false;
    }
  }, [activeBill?.id, activeBill?.status, showToast, refreshData]);

  // Synchronize draft when selectedOrderIds change
  useEffect(() => {
    if (!activeBill || activeBill.status !== 'draft') return;
    if (eligibleOrders.length === 0) return;

    const targetIds = Array.from(selectedOrderIds);
    const targetKey = targetIds.slice().sort().join(',');

    const currentDraftOrderIds = new Set<string>();
    (activeBill.items || []).forEach((it) => {
      if (it.order_id) currentDraftOrderIds.add(it.order_id);
    });
    const currentKey = Array.from(currentDraftOrderIds).sort().join(',');

    if (lastSyncedOrdersRef.current === targetKey || currentKey === targetKey) {
      return;
    }

    pendingDraftOrdersRef.current = selectedOrderIds;
    syncDraftOrders();
  }, [activeBill, selectedOrderIds, syncDraftOrders, eligibleOrders.length]);

  // Handle toggling an order's inclusion in draft bill
  const handleToggleOrder = (orderId: string) => {
    if (!activeBill || activeBill.status !== 'draft') return;

    setDeselectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Handle Select All / Deselect All
  const handleToggleAllOrders = () => {
    if (!activeBill || activeBill.status !== 'draft') return;

    if (selectedOrderIds.size === eligibleOrders.length) {
      setDeselectedOrderIds(new Set(eligibleOrders.map((o) => o.id)));
    } else {
      setDeselectedOrderIds(new Set());
    }
  };

  // Calculate order items and total with visitor price
  const getOrderVisitorDetails = useCallback(
    (ord: Order) => {
      let orderTotal = 0;
      const items = (ord.items || []).map((it) => {
        const prod = productMap.get(it.product_id) || (it.name ? productMap.get(it.name.trim().toLowerCase()) : undefined);
        const pack = getPackSize(it.items_per_package || prod?.items_per_package);
        const baseUnit = getBaseUnit(it.unit || prod?.unit, pack);

        const liveVisitorPrice = Number(prod?.visitor_price ?? 0);
        const liveStorePrice = Number(prod?.price ?? 0);
        const rawItemPrice = Number(it.price ?? 0);

        const visitorPrice = liveVisitorPrice > 1
          ? liveVisitorPrice
          : (liveStorePrice > 1
              ? liveStorePrice
              : (rawItemPrice > 1 ? rawItemPrice : (liveVisitorPrice || rawItemPrice)));

        const lineCalc = computeLine({
          quantity: it.quantity,
          pack,
          unitPrice: visitorPrice,
          discountPercent: 0,
        });
        orderTotal += lineCalc.total;
        return {
          id: it.id || `${ord.id}-${it.product_id}`,
          name: it.name,
          quantity: it.quantity,
          pack,
          baseUnit,
          unit: getSaleUnitLabel(it.unit || prod?.unit, pack),
          visitorPrice,
          lineTotal: lineCalc.total,
        };
      });
      return { items, orderTotal };
    },
    [productMap]
  );

  // Aggregated items for visitor
  const aggregatedItems = useMemo(() => {
    if (!activeBill?.items || activeBill.items.length === 0) return [];

    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        pack: number;
        baseUnit: string;
        unit: string;
        totalQuantity: number;
        visitorPrice: number;
        totalAmount: number;
        manualLines: LoadingBillItem[];
        orderLinesCount: number;
      }
    >();

    for (const it of activeBill.items) {
      const prod = productMap.get(it.product_id) || (it.product_name ? productMap.get(it.product_name.trim().toLowerCase()) : undefined);
      const pack = getPackSize(it.items_per_package || prod?.items_per_package);
      const baseUnit = getBaseUnit(it.unit || prod?.unit, pack);

      const liveVisitorPrice = Number(prod?.visitor_price ?? 0);
      const liveStorePrice = Number(prod?.price ?? 0);
      const savedVisitorPrice = Number(it.visitor_price ?? 0);
      const savedStorePrice = Number(it.store_price ?? 0);

      const vPrice = liveVisitorPrice > 1
        ? liveVisitorPrice
        : (savedVisitorPrice > 1
            ? savedVisitorPrice
            : (liveStorePrice > 1
                ? liveStorePrice
                : (savedStorePrice > 1 ? savedStorePrice : (savedVisitorPrice || liveVisitorPrice))));

      const lineCalc = computeLine({
        quantity: it.quantity,
        pack,
        unitPrice: vPrice,
        discountPercent: 0,
      });

      const existingKey = it.product_id || (it.product_name ? it.product_name.trim().toLowerCase() : String(Math.random()));
      const existing = map.get(existingKey);
      if (existing) {
        existing.totalQuantity = Math.round((existing.totalQuantity + it.quantity) * 1000) / 1000;
        existing.totalAmount += lineCalc.total;
        if (it.source === 'visitor_manual' || it.source === 'admin_manual') {
          existing.manualLines.push(it);
        } else {
          existing.orderLinesCount += 1;
        }
      } else {
        map.set(existingKey, {
          productId: it.product_id || existingKey,
          productName: it.product_name || prod?.name || 'کالای نامشخص',
          pack,
          baseUnit,
          unit: getUnitColumnText(pack, baseUnit),
          totalQuantity: it.quantity,
          visitorPrice: vPrice,
          totalAmount: lineCalc.total,
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

  const totalSurplusCount = useMemo(() => {
    const sum = Object.values(surplusCart).reduce((acc, q) => acc + (Number(q) || 0), 0);
    return Math.round(sum * 1000) / 1000;
  }, [surplusCart]);

  const totalSurplusAmount = useMemo(() => {
    return Object.entries(surplusCart).reduce((sum, [pId, qty]) => {
      const prod = productMap.get(pId) || products.find((p) => p.id === pId);
      const pack = getPackSize(prod?.items_per_package);
      const vPrice = Number(prod?.visitor_price ?? 0);
      const lineCalc = computeLine({
        quantity: Number(qty) || 0,
        pack,
        unitPrice: vPrice,
        discountPercent: 0,
      });
      return sum + lineCalc.total;
    }, 0);
  }, [surplusCart, productMap, products]);

  // Available products for inline surplus selection
  const availableSurplusProducts = useMemo(() => {
    return products.filter((p) => p.is_active !== false && (p.visitor_price ?? 0) > 0);
  }, [products]);

  const selectedSurplusProduct = useMemo(() => {
    return availableSurplusProducts.find((p) => p.id === inlineSurplusProductId);
  }, [availableSurplusProducts, inlineSurplusProductId]);

  const filteredQuickProducts = useMemo(() => {
    const q = inlineSurplusSearch.trim().toLowerCase();
    return availableSurplusProducts
      .filter((p) => {
        const freeStock = Math.max(0, p.stock - p.reserved_stock);
        if (freeStock <= 0) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
        );
      })
      .slice(0, 12);
  }, [availableSurplusProducts, inlineSurplusSearch]);

  const currentManualLines = useMemo(() => {
    return (activeBill?.items || []).filter(
      (it) => it.source === 'visitor_manual' || it.source === 'admin_manual'
    );
  }, [activeBill?.items]);

  const totalSurplusAmountInBill = useMemo(() => {
    return currentManualLines.reduce((sum, it) => {
      const prod = productMap.get(it.product_id) || (it.product_name ? productMap.get(it.product_name.trim().toLowerCase()) : undefined);
      const effectivePrice = (prod?.visitor_price && prod.visitor_price > 1)
        ? prod.visitor_price
        : ((it.visitor_price && it.visitor_price > 1)
            ? it.visitor_price
            : (prod?.price && prod.price > 1 ? prod.price : (it.visitor_price || 0)));
      return sum + it.quantity * effectivePrice;
    }, 0);
  }, [currentManualLines, productMap]);

  // Handle direct addition of surplus item
  const handleAddInlineSurplus = async (productIdToAdd?: string, qtyToAdd?: number) => {
    const prodId = productIdToAdd || inlineSurplusProductId;
    const qty = qtyToAdd !== undefined ? qtyToAdd : parseFloat(String(inlineSurplusQty)) || 0;

    if (!activeBill || activeBill.status !== 'draft') {
      showToast('تنها در وضعیت پیش‌نویس فاکتور امکان افزودن بار مازاد وجود دارد.', 'error');
      return;
    }

    if (!prodId) {
      showToast('لطفاً یک کالا را برای افزودن به بار مازاد انتخاب فرمایید.', 'error');
      return;
    }

    if (qty <= 0) {
      showToast('تعداد کالا باید بزرگتر از صفر باشد.', 'error');
      return;
    }

    const prod = productMap.get(prodId) || products.find((p) => p.id === prodId);
    const effectivePrice = (prod?.visitor_price && prod.visitor_price > 1) ? prod.visitor_price : (prod?.price || 0);
    if (effectivePrice <= 0) {
      showToast(`قیمت خرید برای کالای «${prod?.name || 'انتخاب شده'}» تعریف نشده است.`, 'error');
      return;
    }

    setIsSubmittingInlineSurplus(true);
    const finalLabel = inlineSurplusCustomerLabel.trim() || 'اقلام مازاد';

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('invoice_add_manual_line', {
          p_invoice_id: activeBill.id,
          p_product_id: prodId,
          p_qty: Math.round(qty * 1000) / 1000,
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
            'خطا در افزودن کالا به اقلام مازاد.';
          showToast(msg, 'error');
          return;
        }

        showToast(`کالای «${prod.name}» با تعداد ${qty} به فاکتور بار افزوده شد.`, 'success');
        setInlineSurplusProductId('');
        setInlineSurplusQty(1);
        refreshData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت قلم مازاد.';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingInlineSurplus(false);
    }
  };

  // Open print modal with validation
  const handleOpenPrintModal = (billToPrint: LoadingBill) => {
    const invalidItem = (billToPrint.items || []).find((it) => {
      const prod = productMap.get(it.product_id) || products.find((p) => p.id === it.product_id || p.name === it.product_name);
      const vp = Number(prod?.visitor_price ?? (it.visitor_price ?? (prod?.price ?? 0)));
      return vp <= 0;
    });

    if (invalidItem) {
      showToast(`قیمت خرید برای کالای «${invalidItem.product_name}» تعریف نشده است.`, 'error');
      return;
    }
    setSelectedBillForPrint(billToPrint);
  };

  // Handle surplus items submission to draft bill
  const handleSurplusSubmit = async () => {
    if (!activeBill || isSubmittingSurplus || totalSurplusCount <= 0) return;

    const entries = Object.entries(surplusCart).filter(([_, qty]) => Number(qty) > 0);

    for (const [productId] of entries) {
      const prod = productMap.get(productId) || products.find((p) => p.id === productId);
      const effectivePrice = (prod?.visitor_price && prod.visitor_price > 1) ? prod.visitor_price : (prod?.price || 0);
      if (effectivePrice <= 0) {
        showToast(`قیمت خرید برای کالای «${prod?.name || 'انتخاب شده'}» تعریف نشده است.`, 'error');
        return;
      }
    }

    setIsSubmittingSurplus(true);
    const finalLabel = surplusCustomerLabel.trim() || 'موجودی همراه ویزیتور';

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

    const invalidItem = (activeBill.items || []).find((it) => {
      const prod = productMap.get(it.product_id) || products.find((p) => p.id === it.product_id || p.name === it.product_name);
      const vp = Number(prod?.visitor_price ?? (it.visitor_price ?? (prod?.price ?? 0)));
      return vp <= 0;
    });

    if (invalidItem) {
      showToast(`قیمت خرید برای کالای «${invalidItem.product_name}» تعریف نشده است.`, 'error');
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

  const isReadOnly = Boolean(activeBill && activeBill.status !== 'draft');

  return (
    <div className="space-y-4">
      {/* 1. Top Sub Navigation Bar: Current Invoice vs Archive */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('current')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'current'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
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
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>آرشیو فاکتورهای من</span>
            {visitorBills.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-300 text-[10px] num-fa">
                {visitorBills.length.toLocaleString('fa-IR')}
              </span>
            )}
          </button>
        </div>

        {/* Quick Action Buttons (Print / New Draft) */}
        <div className="flex items-center gap-2">
          {activeBill && (
            <button
              type="button"
              onClick={() => handleOpenPrintModal(activeBill)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeBill.status === 'approved' || activeBill.status === 'loaded'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80'
              }`}
              title={activeBill.status === 'approved' || activeBill.status === 'loaded' ? 'چاپ و ذخیره فاکتور نهایی' : 'پیش‌نمایش پیش‌نویس فاکتور'}
            >
              <Printer className="w-3.5 h-3.5" />
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ایجاد پیش‌نویس جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Progress Stepper (Always Visible on Current Tab) */}
      {activeSubTab === 'current' && (
        <InvoiceStatusStepper
          status={activeBill?.status}
          cancelReason={activeBill?.cancel_reason}
          submittedAt={activeBill?.submitted_at}
          createdAt={activeBill?.created_at}
          revisionCount={activeBill?.revision_count}
        />
      )}

      {/* 3. Main Content: Current Tab vs Archive Tab */}
      {activeSubTab === 'current' ? (
        <div className="space-y-4">
          {/* Draft Error Banner */}
          {draftError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 flex-wrap">
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

          {/* SECTION 1: Customers & Eligible Orders */}
          <EligibleOrdersStep
            eligibleOrders={eligibleOrders}
            selectedOrderIds={selectedOrderIds}
            isReadOnly={isReadOnly}
            onToggleOrder={handleToggleOrder}
            onToggleAllOrders={handleToggleAllOrders}
            getOrderVisitorDetails={getOrderVisitorDetails}
          />

          {/* SECTION 2: My Aggregated Invoice (فاکتور تجمیعی من) */}
          <InvoiceReviewStep
            aggregatedItems={aggregatedItems}
            totalQuantity={totalQuantity}
            totalAmount={totalAmount}
            isReadOnly={isReadOnly}
            onEditManualLine={(item) => {
              setEditingItem(item);
              setEditQty(item.quantity);
            }}
            onRemoveManualLine={handleRemoveLine}
          />

          {/* SECTION 3: Surplus Items (افزودن اقلام مازاد) */}
          <SurplusItemsStep
            availableSurplusProducts={availableSurplusProducts}
            inlineSurplusCustomerLabel={inlineSurplusCustomerLabel}
            isSubmittingInlineSurplus={isSubmittingInlineSurplus}
            isReadOnly={isReadOnly}
            onChangeCustomerLabel={setInlineSurplusCustomerLabel}
            onAddInlineSurplus={handleAddInlineSurplus}
            onOpenSurplusModal={() => {
              setSurplusCart({});
              setSurplusCustomerLabel('');
              setIsSurplusModalOpen(true);
            }}
          />

          {/* Sticky Bottom Action Bar (Requirement 3: Single submission bar, above mobile bottom nav) */}
          {!isReadOnly && (
            <div className="sticky bottom-16 sm:bottom-0 z-30 p-3 sm:p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <div>
                  <span className="text-slate-400 block text-[11px]">مجموع فاکتور بار:</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black text-emerald-400 num-fa">
                      {formatPrice(totalAmount)}
                    </span>
                    <span className="text-[10px] text-slate-400">تومان</span>
                  </div>
                </div>

                <div className="hidden xs:block border-r border-slate-800 pr-3">
                  <span className="text-slate-400 block text-[11px]">تعداد اقلام:</span>
                  <div className="text-xs sm:text-sm font-bold text-slate-200">
                    <span className="num-fa">{aggregatedItems.length.toLocaleString('fa-IR')}</span> ردیف کالا ·{' '}
                    <span className="num-fa">{totalQuantity.toLocaleString('fa-IR')}</span> واحد
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmitInvoice}
                disabled={isSubmitting || aggregatedItems.length === 0}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="ارسال فاکتور بار برای تایید ادمین و انبار"
                aria-label="ارسال فاکتور بار برای تایید ادمین و انبار"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>{isSubmitting ? 'در حال ارسال فاکتور...' : 'ارسال برای ادمین'}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ARCHIVE TAB */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <span>آرشیو فاکتورهای بارگیری من</span>
            </h4>
            <span className="text-xs text-slate-400">
              <strong className="num-fa text-slate-200">{visitorBills.length.toLocaleString('fa-IR')}</strong> فاکتور ثبت شده
            </span>
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
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-100">
                        {b.invoice_no || `#${b.id.slice(0, 8)}`}
                      </span>
                      {b.status === 'draft' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-blue-300 border border-blue-500/30">
                          پیش‌نویس
                        </span>
                      )}
                      {b.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-950 text-amber-300 border border-amber-500/30">
                          در انتظار ادمین
                        </span>
                      )}
                      {b.status === 'approved' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-950 text-blue-300 border border-blue-500/30">
                          تایید شده
                        </span>
                      )}
                      {b.status === 'loaded' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          بارگیری شد
                        </span>
                      )}
                      {b.status === 'cancelled' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-rose-950 text-rose-300 border border-rose-500/30">
                          لغو شده
                        </span>
                      )}
                      {(b.revision_count ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                          اصلاح‌شده (<span className="num-fa">{b.revision_count?.toLocaleString('fa-IR')}</span> بار)
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      تاریخ صدور: {formatOrderDate(b.created_at)}
                      {b.finalized_by && ` | تایید: ${b.finalized_by}`}
                      {b.orders_count !== undefined && (
                        <> | <span className="num-fa">{b.orders_count.toLocaleString('fa-IR')}</span> سفارش</>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-left">
                      <div className="font-bold text-sm text-slate-200 num-fa">
                        {formatPrice(Number(b.total_visitor_cost || 0))} تومان
                      </div>
                      <span className="text-[10px] text-slate-500">مبلغ خرید ویزیتور</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenPrintModal(b)}
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

      {/* Full-Page Modal: Add Surplus Items (ProductCatalog) */}
      {isSurplusModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md">
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
                  اقلام را با قیمت خرید ویزیتور و به تعداد دلخواه انتخاب نمایید
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

          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900 shrink-0 shadow-2xl">
            <div className="max-w-5xl mx-auto space-y-3">
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

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">تعداد اقلام: </span>
                    <span className="font-bold text-purple-300 num-fa">
                      {totalSurplusCount.toLocaleString('fa-IR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">جمع مبلغ: </span>
                    <span className="font-bold text-emerald-400 text-sm num-fa">
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
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 num-fa text-sm focus:outline-none focus:border-blue-500"
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
