import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Product, Visitor, Supermarket, Order, LoadingBill, LoadingBillItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ProductCatalog } from '../shop/ProductCatalog';
import { roundQty, formatPrice } from '../shop/shopUtils';
import { VisitorInvoicePrintModal } from '../visitor/VisitorInvoicePrintModal';
import { OrderInvoiceModal } from '../invoice/OrderInvoiceModal';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Printer,
  ShoppingBag,
  FileText,
  User,
  Truck,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  Sparkles,
  Info,
  Calendar,
  Store,
  Send,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface ManualInvoiceLine {
  id: string;
  product_id: string;
  product: Product;
  quantity: number;
  unit_price: number; // Unit price (store or visitor depending on mode)
  customer_label: string;
  line_note: string;
}

export interface DirectInvoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialVisitorId?: string | null;
  initialSupermarketId?: string | null;
  mode?: 'visitor' | 'direct_store' | 'market_test';
  priceMode?: 'store' | 'visitor';
  onSuccess?: (invoiceId: string, isIssued: boolean) => void;
}

export const DirectInvoiceSheet: React.FC<DirectInvoiceSheetProps> = ({
  isOpen,
  onClose,
  initialVisitorId = null,
  initialSupermarketId = null,
  mode = 'visitor',
  priceMode = mode === 'direct_store' ? 'store' : 'visitor',
  onSuccess,
}) => {
  const isStoreMode = mode === 'direct_store';
  const effectivePriceMode = isStoreMode ? 'store' : priceMode;

  const {
    visitors,
    supermarkets,
    products,
    orders,
    loadingBills,
    currentUser,
    showToast,
    refreshData,
  } = useApp();

  // Active Visitors
  const activeVisitors = useMemo(() => {
    return visitors.filter((v) => v.is_active !== false);
  }, [visitors]);

  // Active Supermarkets
  const activeSupermarkets = useMemo(() => {
    return supermarkets.filter((s) => s.is_active !== false);
  }, [supermarkets]);

  // Selected Visitor State
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>(() => {
    if (initialVisitorId) return initialVisitorId;
    return activeVisitors[0]?.id || '';
  });

  // Selected Store State (for direct_store mode)
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (initialSupermarketId) return initialSupermarketId;
    return activeSupermarkets[0]?.id || '';
  });

  // Sync selected entities when props change or modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialVisitorId) {
        setSelectedVisitorId(initialVisitorId);
      } else if (!selectedVisitorId && activeVisitors.length > 0) {
        setSelectedVisitorId(activeVisitors[0].id);
      }

      if (initialSupermarketId) {
        setSelectedStoreId(initialSupermarketId);
      } else if (!selectedStoreId && activeSupermarkets.length > 0) {
        setSelectedStoreId(activeSupermarkets[0].id);
      }
    }
  }, [isOpen, initialVisitorId, initialSupermarketId, activeVisitors, activeSupermarkets, selectedVisitorId, selectedStoreId]);

  const selectedVisitor = useMemo(() => {
    return visitors.find((v) => v.id === selectedVisitorId) || null;
  }, [visitors, selectedVisitorId]);

  const selectedStore = useMemo(() => {
    return supermarkets.find((s) => s.id === selectedStoreId) || null;
  }, [supermarkets, selectedStoreId]);

  // Store Mode Delivery Type: 'visitor' (به نام ویزیتور فروشگاه) or 'direct' (مستقیم از پخش مرکزی)
  const [deliveryType, setDeliveryType] = useState<'visitor' | 'direct'>('visitor');

  // Sync delivery type when store changes
  useEffect(() => {
    if (selectedStore) {
      if (selectedStore.assigned_visitor_id) {
        setDeliveryType('visitor');
      } else {
        setDeliveryType('direct');
      }
    }
  }, [selectedStore]);

  // Store Mode Immediate Delivery Toggle (تحویل فوری)
  const [deliverNow, setDeliverNow] = useState<boolean>(false);

  // Tab for Left Column: 'catalog' (manual lines) or 'orders' (system orders for visitor mode)
  const [leftTab, setLeftTab] = useState<'catalog' | 'orders'>('catalog');

  // Selected System Orders for this visitor (visitor mode only)
  const visitorReadyOrders = useMemo(() => {
    if (!selectedVisitorId || isStoreMode) return [];
    return orders.filter(
      (o) =>
        o.assigned_visitor_id === selectedVisitorId &&
        o.status === 'assigned' &&
        !o.loading_bill_id
    );
  }, [orders, selectedVisitorId, isStoreMode]);

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Reset selected orders when switching visitor
  useEffect(() => {
    setSelectedOrderIds(new Set());
  }, [selectedVisitorId]);

  // Manual Lines added from Catalog
  const [manualLines, setManualLines] = useState<ManualInvoiceLine[]>([]);
  const [adminNote, setAdminNote] = useState<string>('');

  // Cart format for ProductCatalog
  const catalogCart = useMemo(() => {
    const cartObj: Record<string, number> = {};
    manualLines.forEach((line) => {
      cartObj[line.product_id] = line.quantity;
    });
    return cartObj;
  }, [manualLines]);

  // Filter out market test ("به زودی") products so they cannot be added
  const availableCatalogProducts = useMemo(() => {
    return products.filter((p) => p.is_active && !p.is_market_test);
  }, [products]);

  // Price Editing state for a specific line
  const [editingPriceLineId, setEditingPriceLineId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastCreatedResult, setLastCreatedResult] = useState<{
    invoice_id: string;
    invoice_no?: string | null;
    status: string;
    message: string;
    bill: LoadingBill | null;
    createdOrder?: Order | null;
  } | null>(null);

  // Print modal states
  const [isVisitorPrintModalOpen, setIsVisitorPrintModalOpen] = useState<boolean>(false);
  const [isStoreInvoiceModalOpen, setIsStoreInvoiceModalOpen] = useState<boolean>(false);

  // Store assigned visitor details
  const storeAssignedVisitor = useMemo(() => {
    if (!selectedStore?.assigned_visitor_id) return null;
    return visitors.find((v) => v.id === selectedStore.assigned_visitor_id) || null;
  }, [selectedStore, visitors]);

  // Handle quantity change from ProductCatalog
  const handleCatalogQuantityChange = useCallback(
    (productId: string, qty: number) => {
      const roundedQty = roundQty(qty);
      const prod = products.find((p) => p.id === productId);
      if (!prod) return;

      setManualLines((prev) => {
        const existingIdx = prev.findIndex((line) => line.product_id === productId);

        if (roundedQty <= 0) {
          if (existingIdx >= 0) {
            return prev.filter((_, idx) => idx !== existingIdx);
          }
          return prev;
        }

        const defaultPrice = isStoreMode
          ? prod.price
          : prod.visitor_price || Math.round(prod.price * 0.85);

        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: roundedQty,
          };
          return updated;
        }

        const newLine: ManualInvoiceLine = {
          id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product_id: productId,
          product: prod,
          quantity: roundedQty,
          unit_price: defaultPrice,
          customer_label: isStoreMode ? (selectedStore?.name || 'فروشگاه') : 'مازاد خودرو / مستقیم',
          line_note: '',
        };
        return [...prev, newLine];
      });
    },
    [products, isStoreMode, selectedStore]
  );

  // Toggle selection of a system order
  const handleToggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleSelectAllOrders = () => {
    if (selectedOrderIds.size === visitorReadyOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(visitorReadyOrders.map((o) => o.id)));
    }
  };

  // Update line unit price (Admin custom price)
  const handleStartEditPrice = (line: ManualInvoiceLine) => {
    setEditingPriceLineId(line.id);
    setEditPriceValue(line.unit_price.toString());
  };

  const handleSavePrice = (lineId: string) => {
    const numPrice = Number(editPriceValue.replace(/[^0-9.]/g, ''));
    if (!isNaN(numPrice) && numPrice >= 0) {
      setManualLines((prev) =>
        prev.map((l) => (l.id === lineId ? { ...l, unit_price: numPrice } : l))
      );
    }
    setEditingPriceLineId(null);
  };

  // Remove a manual line
  const handleRemoveLine = (lineId: string) => {
    setManualLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  // Update line quantity directly
  const handleUpdateLineQty = (lineId: string, delta: number) => {
    setManualLines((prev) =>
      prev
        .map((l) => {
          if (l.id !== lineId) return l;
          const nextQty = roundQty(Math.max(0, l.quantity + delta));
          return { ...l, quantity: nextQty };
        })
        .filter((l) => l.quantity > 0)
    );
  };

  // Calculate totals from selected orders (visitor mode only)
  const selectedOrdersData = useMemo(() => {
    if (isStoreMode) return [];
    return visitorReadyOrders.filter((o) => selectedOrderIds.has(o.id));
  }, [visitorReadyOrders, selectedOrderIds, isStoreMode]);

  const ordersVisitorTotal = useMemo(() => {
    if (isStoreMode) return 0;
    return selectedOrdersData.reduce((sum, ord) => {
      const ordVisitorCost = (ord.items || []).reduce((itemSum, item) => {
        const prod = products.find((p) => p.id === item.product_id);
        const itemVisPrice = prod?.visitor_price || Math.round(item.price * 0.85);
        return itemSum + item.quantity * itemVisPrice;
      }, 0);
      return sum + ordVisitorCost;
    }, 0);
  }, [selectedOrdersData, products, isStoreMode]);

  const ordersItemsCount = useMemo(() => {
    if (isStoreMode) return 0;
    return selectedOrdersData.reduce((sum, ord) => {
      return sum + (ord.items || []).reduce((iSum, i) => iSum + i.quantity, 0);
    }, 0);
  }, [selectedOrdersData, isStoreMode]);

  // Calculate manual lines totals
  const manualLinesTotal = useMemo(() => {
    return manualLines.reduce((sum, line) => {
      return sum + line.quantity * line.unit_price;
    }, 0);
  }, [manualLines]);

  const manualLinesItemsCount = useMemo(() => {
    return manualLines.reduce((sum, line) => sum + line.quantity, 0);
  }, [manualLines]);

  // Grand total for the invoice
  const grandTotalAmount = ordersVisitorTotal + manualLinesTotal;
  const grandTotalQuantity = roundQty(ordersItemsCount + manualLinesItemsCount);

  // Submit Store Direct Invoice
  const handleSubmitStoreInvoice = async () => {
    if (!selectedStoreId || !selectedStore) {
      showToast('لطفاً فروشگاه مورد نظر را انتخاب نمایید.', 'error');
      return;
    }

    if (manualLines.length === 0) {
      showToast('لطفاً حداقل یک قلم کالا به فاکتور فروشگاه اضافه کنید.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        showToast('پایگاه داده سوپابیس متصل نیست.', 'error');
        setIsSubmitting(false);
        return;
      }

      const p_lines = manualLines.map((line) => ({
        product_id: line.product_id,
        quantity: roundQty(line.quantity),
        unit_price: line.unit_price,
        line_note: line.line_note || null,
      }));

      const finalVisitorId =
        deliveryType === 'visitor' && selectedStore.assigned_visitor_id
          ? selectedStore.assigned_visitor_id
          : null;

      const { data, error } = await supabase.rpc('admin_create_store_invoice', {
        p_supermarket_id: selectedStoreId,
        p_lines: p_lines,
        p_visitor_id: finalVisitorId,
        p_deliver_now: deliverNow,
        p_note: adminNote.trim() || null,
      });

      if (error) {
        showToast(error.message || 'خطا در صدور فاکتور مستقیم فروشگاه.', 'error');
        setIsSubmitting(false);
        return;
      }

      if (!data || (data as { success?: boolean; message?: string }).success === false) {
        const errorMsg =
          (data as { message?: string })?.message || 'خطا در صدور فاکتور مستقیم فروشگاه.';
        showToast(errorMsg, 'error');
        setIsSubmitting(false);
        return;
      }

      const res = data as {
        success: boolean;
        message: string;
        order_id: string;
      };

      showToast(res.message || 'فاکتور مستقیم فروشگاه با موفقیت صادر گردید.', 'success');

      await refreshData();

      // Build synthesized Order object for direct print / invoice view
      const createdOrderObj: Order = {
        id: res.order_id,
        supermarket_id: selectedStore.id,
        supermarket_name: selectedStore.name,
        assigned_visitor_id: finalVisitorId,
        visitor_name: finalVisitorId && storeAssignedVisitor ? storeAssignedVisitor.name : 'پخش مرکزی',
        status: deliverNow ? 'delivered' : 'assigned',
        total_amount: grandTotalAmount,
        order_source: 'supermarket',
        order_channel: finalVisitorId ? 'store_self' : 'store_direct',
        stock_deducted: deliverNow,
        order_date: new Date().toISOString(),
        items: manualLines.map((l) => ({
          id: l.id,
          order_id: res.order_id,
          product_id: l.product_id,
          name: l.product.name,
          price: l.unit_price,
          quantity: l.quantity,
          unit: l.product.unit,
        })),
      };

      setLastCreatedResult({
        invoice_id: res.order_id,
        invoice_no: res.order_id,
        status: deliverNow ? 'delivered' : 'assigned',
        message: res.message,
        bill: null,
        createdOrder: createdOrderObj,
      });

      if (onSuccess) {
        onSuccess(res.order_id, deliverNow);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت فاکتور فروشگاه.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Visitor Invoice to server
  const handleSubmitVisitorInvoice = async (issueImmediate: boolean) => {
    if (!selectedVisitorId) {
      showToast('لطفاً ویزیتور مورد نظر را انتخاب نمایید.', 'error');
      return;
    }

    if (selectedOrderIds.size === 0 && manualLines.length === 0) {
      showToast('لطفاً حداقل یک سفارش یا یک قلم کالای مازاد به فاکتور اضافه کنید.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        showToast('پایگاه داده سوپابیس متصل نیست.', 'error');
        setIsSubmitting(false);
        return;
      }

      const p_lines = manualLines.map((line) => ({
        product_id: line.product_id,
        quantity: roundQty(line.quantity),
        visitor_price: line.unit_price,
        customer_label: line.customer_label || 'مازاد / مستقیم',
        line_note: line.line_note || null,
      }));

      const p_order_ids = Array.from(selectedOrderIds);

      const { data, error } = await supabase.rpc('admin_create_visitor_invoice', {
        p_visitor_id: selectedVisitorId,
        p_lines: p_lines,
        p_order_ids: p_order_ids,
        p_note: adminNote.trim() || null,
        p_issue: issueImmediate,
      });

      if (error) {
        showToast(error.message || 'خطا در صدور فاکتور مستقیم ویزیتور.', 'error');
        setIsSubmitting(false);
        return;
      }

      if (!data || (data as { success?: boolean; message?: string }).success === false) {
        const errorMsg =
          (data as { message?: string })?.message || 'خطا در صدور فاکتور مستقیم ویزیتور.';
        showToast(errorMsg, 'error');
        setIsSubmitting(false);
        return;
      }

      const res = data as {
        success: boolean;
        message: string;
        invoice_id: string;
        invoice_no?: string | null;
        status: string;
      };

      showToast(res.message || 'فاکتور مستقیم با موفقیت صادر گردید.', 'success');

      await refreshData();

      // Find or build loading bill object for print view
      const billObj: LoadingBill = {
        id: res.invoice_id,
        invoice_no: res.invoice_no || null,
        visitor_id: selectedVisitorId,
        visitor_name: selectedVisitor?.name || 'ویزیتور',
        status: (res.status as any) || (issueImmediate ? 'approved' : 'pending'),
        created_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        orders_count: selectedOrderIds.size,
        total_visitor_cost: grandTotalAmount,
        admin_note: adminNote || null,
        items: [
          ...selectedOrdersData.flatMap((ord) =>
            (ord.items || []).map((it) => {
              const prod = products.find((p) => p.id === it.product_id);
              return {
                id: `bi-${ord.id}-${it.id}`,
                loading_bill_id: res.invoice_id,
                order_id: ord.id,
                product_id: it.product_id,
                product_name: it.name,
                quantity: it.quantity,
                store_price: it.price,
                visitor_price: prod?.visitor_price || Math.round(it.price * 0.85),
                source: 'order' as const,
                customer_label: ord.supermarket_name,
              };
            })
          ),
          ...manualLines.map((line) => ({
            id: line.id,
            loading_bill_id: res.invoice_id,
            order_id: undefined,
            product_id: line.product_id,
            product_name: line.product.name,
            quantity: line.quantity,
            store_price: line.product.price,
            visitor_price: line.unit_price,
            source: 'admin_manual' as const,
            customer_label: line.customer_label,
            line_note: line.line_note,
          })),
        ],
      };

      setLastCreatedResult({
        invoice_id: res.invoice_id,
        invoice_no: res.invoice_no,
        status: res.status,
        message: res.message,
        bill: billObj,
      });

      if (onSuccess) {
        onSuccess(res.invoice_id, issueImmediate);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت فاکتور مستقیم.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form for a new invoice
  const handleResetForNew = () => {
    setLastCreatedResult(null);
    setSelectedOrderIds(new Set());
    setManualLines([]);
    setAdminNote('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden text-slate-100"
      dir="rtl"
    >
      {/* 1. Header Bar */}
      <header className="h-16 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              isStoreMode
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isStoreMode ? <Store className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-100">
                {isStoreMode ? 'صدور فاکتور مستقیم فروشگاه' : 'صدور فاکتور مستقیم ویزیتور'}
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                پنل مدیریت
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isStoreMode
                ? 'ثبت سفارش مستقیم و صدور فاکتور فروش برای سوپرمارکت با نرخ مصوب خرید فروشگاه'
                : 'تخصیص اقلام مازاد و سفارش‌های تجمیعی به ویزیتور با قیمت خرید ویزیتور'}
            </p>
          </div>
        </div>

        {/* Entity Selector & Close Button */}
        <div className="flex items-center gap-3">
          {isStoreMode ? (
            /* Supermarket Selector */
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Store className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-semibold">فروشگاه:</span>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-bold text-blue-300 focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                {activeSupermarkets.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                    {s.name} ({s.owner || s.address?.slice(0, 15) || 'فروشگاه'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* Visitor Selector */
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-semibold">ویزیتور:</span>
              <select
                value={selectedVisitorId}
                onChange={(e) => setSelectedVisitorId(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-bold text-emerald-300 focus:outline-none cursor-pointer"
              >
                {activeVisitors.map((v) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-slate-100">
                    {v.name} ({v.region})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Main Content Area or Success View */}
      {lastCreatedResult ? (
        // Success View
        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="max-w-md w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100">فاکتور با موفقیت صادر گردید</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {lastCreatedResult.message}
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>{isStoreMode ? 'شماره سفارش / فاکتور:' : 'شناسه فاکتور:'}</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {lastCreatedResult.invoice_no || lastCreatedResult.invoice_id}
                </span>
              </div>

              {isStoreMode ? (
                <>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>فروشگاه:</span>
                    <span className="font-bold text-slate-200">{selectedStore?.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>نحوه ارسال / توزیع:</span>
                    <span className="font-semibold text-blue-300">
                      {deliveryType === 'visitor' && storeAssignedVisitor
                        ? `ویزیتور: ${storeAssignedVisitor.name}`
                        : 'مستقیم از پخش مرکزی'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>وضعیت سفارش:</span>
                    <span
                      className={`font-bold ${
                        lastCreatedResult.status === 'delivered'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {lastCreatedResult.status === 'delivered'
                        ? 'تحویل فوری (انجام شد)'
                        : 'آماده بارگیری (Assigned)'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-slate-400">
                  <span>ویزیتور:</span>
                  <span className="font-bold text-slate-200">{selectedVisitor?.name}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-400">
                <span>مبلغ کل فاکتور:</span>
                <span className="font-bold text-emerald-300 text-sm">
                  {formatPrice(grandTotalAmount)}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {/* Print Button */}
              {isStoreMode ? (
                <button
                  type="button"
                  onClick={() => setIsStoreInvoiceModalOpen(true)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-950/50"
                >
                  <Printer className="w-4 h-4" />
                  <span>مشاهده و چاپ فاکتور فروشگاه</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsVisitorPrintModalOpen(true)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950/50"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ فاکتور و برگ خروج</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleResetForNew}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  صدور فاکتور جدید
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition cursor-pointer"
                >
                  باز کردن در لیست
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Standard Invoice Creation Split Layout
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column (Catalog & System Orders) - 7 Cols */}
          <div className="lg:col-span-7 flex flex-col h-full border-l border-slate-800 overflow-hidden bg-slate-950/40">
            {/* Header Tabs / Title */}
            <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/60 shrink-0">
              {isStoreMode ? (
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">
                    کاتالوگ کالاهای پخش (قیمت خرید فروشگاه)
                  </span>
                  {manualLines.length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                      {manualLines.length}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLeftTab('catalog')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      leftTab === 'catalog'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>کاتالوگ کالاها (اقلام مازاد / مستقیم)</span>
                    {manualLines.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-white text-emerald-950 text-[10px] font-extrabold flex items-center justify-center">
                        {manualLines.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeftTab('orders')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      leftTab === 'orders'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>سفارش‌های آماده بارگیری این ویزیتور</span>
                    {visitorReadyOrders.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                        {visitorReadyOrders.length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {!isStoreMode && leftTab === 'orders' && visitorReadyOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllOrders}
                  className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  {selectedOrderIds.size === visitorReadyOrders.length
                    ? 'لغو انتخاب همه'
                    : 'انتخاب همه سفارش‌ها'}
                </button>
              )}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {isStoreMode || leftTab === 'catalog' ? (
                <div className="space-y-4">
                  <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Info className={`w-4 h-4 shrink-0 ${isStoreMode ? 'text-blue-400' : 'text-emerald-400'}`} />
                      <span>
                        {isStoreMode
                          ? 'کالاهای درخواستی فروشگاه را از کاتالوگ با قیمت مصوب فروشگاه انتخاب فرمایید.'
                          : 'کالاهای مورد نیاز را از کاتالوگ با قیمت خرید ویزیتور انتخاب نمایید.'}
                      </span>
                    </div>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-lg border ${
                        isStoreMode
                          ? 'text-blue-400 bg-blue-950/60 border-blue-800/40'
                          : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                      }`}
                    >
                      {isStoreMode ? 'قیمت خرید فروشگاه' : 'قیمت خرید ویزیتور'}
                    </span>
                  </div>

                  <ProductCatalog
                    products={availableCatalogProducts}
                    cart={catalogCart}
                    onChangeQuantity={handleCatalogQuantityChange}
                    priceMode={effectivePriceMode}
                    defaultInStockOnly={true}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {visitorReadyOrders.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-3 bg-slate-900/30 border border-slate-800/60 rounded-3xl p-6">
                      <ShoppingBag className="w-12 h-12 mx-auto text-slate-600" />
                      <p className="text-xs font-bold text-slate-300">
                        در حال حاضر هیچ سفارش آماده بارگیری (assigned) برای این ویزیتور ثبت نشده است.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        می‌توانید از تب کاتالوگ، اقلام مستقیم را به فاکتور اضافه فرمایید.
                      </p>
                    </div>
                  ) : (
                    visitorReadyOrders.map((order) => {
                      const isSelected = selectedOrderIds.has(order.id);
                      return (
                        <div
                          key={order.id}
                          onClick={() => handleToggleOrder(order.id)}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-950/30 border-blue-500/50 shadow-sm'
                              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-600 bg-slate-950'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-xs sm:text-sm text-slate-100">
                                    {order.supermarket_name}
                                  </h4>
                                  <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                    {order.id}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  ثبت شده در: {order.order_date ? order.order_date.slice(0, 16) : 'امروز'}
                                </p>
                              </div>
                            </div>

                            <div className="text-left">
                              <span className="text-xs font-bold text-emerald-300">
                                {(order.items || []).length} قلم کالا
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Invoice Summary, Delivery Options & Actions - 5 Cols */}
          <div className="lg:col-span-5 flex flex-col h-full overflow-hidden bg-slate-900/90">
            {/* Header */}
            <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 bg-slate-900">
              <div className="flex items-center gap-2">
                <FileText className={`w-4 h-4 ${isStoreMode ? 'text-blue-400' : 'text-emerald-400'}`} />
                <span className="text-xs font-bold text-slate-200">
                  {isStoreMode ? 'پیش‌نمایش اقلام فاکتور فروشگاه' : 'اقلام انتخابی فاکتور ویزیتور'}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {grandTotalQuantity} قلم در مجموع
              </span>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {/* Store Mode Delivery Options Card */}
              {isStoreMode && selectedStore && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-slate-200">نحوه تخصیص و ارسال:</span>
                    </div>
                    {storeAssignedVisitor && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        ویزیتور منطقه: <strong className="text-blue-300">{storeAssignedVisitor.name}</strong>
                      </span>
                    )}
                  </div>

                  {/* Delivery radio options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                        deliveryType === 'visitor'
                          ? 'bg-blue-950/40 border-blue-500/60 text-blue-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryType"
                        value="visitor"
                        checked={deliveryType === 'visitor'}
                        onChange={() => setDeliveryType('visitor')}
                        className="text-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold">به نام ویزیتور فروشگاه</span>
                        <span className="text-[10px] text-slate-500">
                          {storeAssignedVisitor ? storeAssignedVisitor.name : 'ویزیتور اختصاصی'}
                        </span>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                        deliveryType === 'direct'
                          ? 'bg-blue-950/40 border-blue-500/60 text-blue-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryType"
                        value="direct"
                        checked={deliveryType === 'direct'}
                        onChange={() => setDeliveryType('direct')}
                        className="text-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold">مستقیم از پخش مرکزی</span>
                        <span className="text-[10px] text-slate-500">بدون تخصیص ویزیتور</span>
                      </div>
                    </label>
                  </div>

                  {/* Deliver Now Toggle */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deliverNow}
                        onChange={(e) => setDeliverNow(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>تحویل فوری بار (کسر آنی از انبار و وضعیت Delivered)</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    {isStoreMode ? 'اقلام سبد خرید فروشگاه' : 'اقلام مازاد / مستقیم انتخابی'}
                  </span>
                  {manualLines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setManualLines([])}
                      className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                    >
                      پاک کردن همه
                    </button>
                  )}
                </div>

                {manualLines.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-2xl">
                    <Package className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-xs font-semibold">هیچ کالایی از کاتالوگ انتخاب نشده است.</p>
                    <p className="text-[11px] text-slate-600">
                      از ستون سمت راست روی دکمه‌های + کالا کلیک کنید.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {manualLines.map((line) => {
                      const lineTotal = line.quantity * line.unit_price;
                      const isEditingPrice = editingPriceLineId === line.id;

                      return (
                        <div
                          key={line.id}
                          className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-xs text-slate-100">
                                {line.product.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {line.product.brand ? `برند: ${line.product.brand} | ` : ''}
                                واحد: {line.product.unit}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(line.id)}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition cursor-pointer"
                              title="حذف ردیف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Quantity & Unit Price Row */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">
                            {/* Quantity Stepper */}
                            <div className="flex items-center gap-1.5 bg-slate-900 rounded-lg p-1 border border-slate-800">
                              <button
                                type="button"
                                onClick={() => handleUpdateLineQty(line.id, -1)}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-bold font-mono text-xs px-2 text-slate-100">
                                {line.quantity.toLocaleString('fa-IR')}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateLineQty(line.id, 1)}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            {/* Unit Price (Editable by Admin) */}
                            <div className="flex items-center gap-1.5">
                              {isEditingPrice ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={editPriceValue}
                                    onChange={(e) => setEditPriceValue(e.target.value)}
                                    placeholder="قیمت واحد"
                                    className="w-24 h-7 bg-slate-900 border border-emerald-500 rounded px-1.5 text-xs text-emerald-300 font-mono focus:outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSavePrice(line.id)}
                                    className="p-1 bg-emerald-600 rounded hover:bg-emerald-500 text-white cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPrice(line)}
                                  className="flex items-center gap-1 hover:bg-slate-900 px-2 py-1 rounded text-slate-300 hover:text-emerald-300 transition cursor-pointer border border-transparent hover:border-slate-800"
                                  title="کلیک برای ویرایش قیمت واحد"
                                >
                                  <span className="text-[11px] text-slate-400">واحد:</span>
                                  <span className="font-bold font-mono">
                                    {line.unit_price.toLocaleString('fa-IR')} ت
                                  </span>
                                  <Edit2 className="w-3 h-3 text-slate-500" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Line Total */}
                          <div className="flex justify-between items-center text-[11px] text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg">
                            <span>جمع ردیف:</span>
                            <span className="font-bold text-emerald-400 font-mono">
                              {formatPrice(lineTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Note input */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-300">
                  یادداشت و دستورالعمل فاکتور (اختیاری):
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={
                    isStoreMode
                      ? 'مثال: فاکتور مستقیم، تحویل به صندوق‌دار فروشگاه...'
                      : 'مثال: فاکتور تکمیلی منطقه بابلسر، تحویل به راننده توزیع...'
                  }
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* 3. Bottom Action Bar */}
            <div className="border-t border-slate-800 p-4 bg-slate-900/95 space-y-3 shrink-0">
              {/* Grand Total */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-semibold">
                    {isStoreMode ? 'مبلغ کل فاکتور فروشگاه:' : 'مبلغ کل فاکتور ویزیتور:'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {isStoreMode ? 'مبنای تسویه و پرداخت سوپرمارکت' : 'مبنای تسویه ویزیتور با پخش مرکزی'}
                  </p>
                </div>
                <div className="text-left">
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {formatPrice(grandTotalAmount)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {isStoreMode ? (
                /* Store Mode Action Button */
                <button
                  type="button"
                  disabled={isSubmitting || manualLines.length === 0}
                  onClick={handleSubmitStoreInvoice}
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-950/50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : deliverNow ? (
                    <Zap className="w-4 h-4 text-amber-300" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {deliverNow ? 'ثبت و تحویل فوری بار' : 'ثبت سفارش و صدور فاکتور فروشگاه'}
                  </span>
                </button>
              ) : (
                /* Visitor Mode Action Buttons */
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Button 1: Save as Pending */}
                  <button
                    type="button"
                    disabled={isSubmitting || (selectedOrderIds.size === 0 && manualLines.length === 0)}
                    onClick={() => handleSubmitVisitorInvoice(false)}
                    className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-400" />
                    )}
                    <span>ذخیره (در انتظار تایید)</span>
                  </button>

                  {/* Button 2: Issue Directly */}
                  <button
                    type="button"
                    disabled={isSubmitting || (selectedOrderIds.size === 0 && manualLines.length === 0)}
                    onClick={() => handleSubmitVisitorInvoice(true)}
                    className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950/50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>صدور نهایی</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visitor Print Modal */}
      {isVisitorPrintModalOpen && lastCreatedResult?.bill && selectedVisitor && (
        <VisitorInvoicePrintModal
          isOpen={isVisitorPrintModalOpen}
          onClose={() => setIsVisitorPrintModalOpen(false)}
          bill={lastCreatedResult.bill}
          visitor={selectedVisitor}
          products={products}
          orders={orders}
        />
      )}

      {/* Store Invoice Print Modal */}
      {isStoreInvoiceModalOpen && lastCreatedResult?.createdOrder && selectedStore && (
        <OrderInvoiceModal
          isOpen={isStoreInvoiceModalOpen}
          onClose={() => setIsStoreInvoiceModalOpen(false)}
          order={lastCreatedResult.createdOrder}
          supermarket={selectedStore}
          visitor={storeAssignedVisitor}
        />
      )}
    </div>
  );
};
