import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LoadingBill, LoadingBillItem, Order, Product, Visitor, InvoiceAudit } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatPrice } from './helpers';
import { formatOrderDate } from '../visitor/helpers';
import { VisitorInvoicePrintModal } from '../visitor/VisitorInvoicePrintModal';
import { DirectInvoiceSheet } from './DirectInvoiceSheet';
import { RecordPaymentModal } from './RecordPaymentModal';
import {
  computeLine,
  getPackSize,
  getBaseUnit,
  getUnitColumnText,
} from '../../utils/orderLine';
import { formatUnifiedBillNumber } from '../../utils/numberToPersianWords';
import {
  Search,
  Truck,
  Clock,
  User,
  Package,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Building2,
  Store,
  X,
  AlertCircle,
  Filter,
  Plus,
  Edit2,
  Trash2,
  History,
  Printer,
  Ban,
  Info,
  Calendar,
  Layers,
  Check,
  CreditCard,
  Wallet,
  ArrowDownLeft,
} from 'lucide-react';

export interface BillAgeInfo {
  hours: number;
  minutes: number;
  formattedText: string;
  isOverdue: boolean;
}

export const getBillAgeInfo = (dateStr?: string | null): BillAgeInfo => {
  if (!dateStr) {
    return { hours: 0, minutes: 0, formattedText: 'نامشخص', isOverdue: false };
  }
  const createdTime = Date.parse(dateStr);
  if (isNaN(createdTime)) {
    return { hours: 0, minutes: 0, formattedText: 'نامشخص', isOverdue: false };
  }
  const diffMs = Math.max(0, Date.now() - createdTime);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let formattedText = '';
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    formattedText = `${days} روز پیش`;
  } else if (hours > 0) {
    formattedText = `${hours} ساعت و ${minutes} دقیقه پیش`;
  } else {
    formattedText = `${minutes} دقیقه پیش`;
  }

  const isOverdue = hours >= 3;

  return { hours, minutes, formattedText, isOverdue };
};

export const formatBillDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return 'نامشخص';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateStr;
  }
};

interface LoadingBillsTabProps {
  initialBillId?: string | null;
  initialStatusFilter?: string;
  onNavigateToOrder?: (orderId: string) => void;
}

export const LoadingBillsTab: React.FC<LoadingBillsTabProps> = ({
  initialBillId = null,
  initialStatusFilter = 'pending',
  onNavigateToOrder,
}) => {
  const {
    loadingBills,
    orders,
    products,
    visitors,
    currentUser,
    getAccountSummary,
    getInvoiceSettlementStatus,
    showToast,
    refreshData,
  } = useApp();

  // Active status filter (default 'pending' as specified)
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(initialBillId || null);

  // Financial payment modal state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);

  // View switch: 'by_product' (به تفکیک کالا) vs 'by_customer' (به تفکیک مشتری)
  const [viewMode, setViewMode] = useState<'by_product' | 'by_customer'>('by_product');

  // Modals state
  // 1. Add Agreed Line (admin_manual - inline 14th row in table)
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');
  const [agreementProductId, setAgreementProductId] = useState('');
  const [agreementQty, setAgreementQty] = useState<number | string>(1);
  const [agreementCustomerLabel, setAgreementCustomerLabel] = useState('');
  const [agreementLineNote, setAgreementLineNote] = useState('');
  const [agreementUnitPrice, setAgreementUnitPrice] = useState<number | ''>('');
  const [isSubmittingAgreement, setIsSubmittingAgreement] = useState(false);

  // Selected product object for inline entry
  const selectedInlineProduct = useMemo(
    () => products.find((p) => p.id === agreementProductId),
    [products, agreementProductId]
  );

  // Filtered products for searchable combobox in the inline row
  const filteredInlineProducts = useMemo(() => {
    const q = inlineSearchQuery.toLowerCase().trim();
    if (!q) {
      return products.filter((p) => p.is_active).slice(0, 15);
    }
    return products
      .filter(
        (p) =>
          p.is_active &&
          (p.name.toLowerCase().includes(q) ||
            (p.brand && p.brand.toLowerCase().includes(q)) ||
            (p.unit && p.unit.toLowerCase().includes(q)))
      )
      .slice(0, 20);
  }, [products, inlineSearchQuery]);

  const handleSelectInlineProduct = (p: Product) => {
    setAgreementProductId(p.id);
    setInlineSearchQuery(p.name);
    const defaultVPrice = p.visitor_price ?? 0;
    setAgreementUnitPrice(defaultVPrice);
  };

  const handleCancelAddInline = () => {
    setIsAddingInline(false);
    setAgreementProductId('');
    setInlineSearchQuery('');
    setAgreementQty(1);
    setAgreementCustomerLabel('');
    setAgreementLineNote('');
    setAgreementUnitPrice('');
  };

  // 2. Edit line modal (Qty / Price / Reason)
  const [editingLine, setEditingLine] = useState<LoadingBillItem | null>(null);
  const [editQty, setEditQty] = useState<number | string>(1);
  const [editUnitPrice, setEditUnitPrice] = useState<number | ''>('');
  const [editReason, setEditReason] = useState('');
  const [isUpdatingLine, setIsUpdatingLine] = useState(false);

  // 3. Finalize / Approve modal
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // 4. Cancel bill modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // 5. Print modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // 6. Direct Invoice Sheet Modal
  const [isDirectInvoiceOpen, setIsDirectInvoiceOpen] = useState(false);
  const [directInvoiceMode, setDirectInvoiceMode] = useState<'visitor' | 'direct_store'>('visitor');
  const [isDirectInvoiceMenuOpen, setIsDirectInvoiceMenuOpen] = useState(false);

  // 7. Audit trail state
  const [auditLogs, setAuditLogs] = useState<InvoiceAudit[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isAuditAccordionOpen, setIsAuditAccordionOpen] = useState(false);

  // Synchronize initial bill id if passed
  useEffect(() => {
    if (initialBillId) {
      setSelectedBillId(initialBillId);
      const targetBill = loadingBills.find((b) => b.id === initialBillId);
      if (targetBill && statusFilter !== 'all' && targetBill.status !== statusFilter) {
        setStatusFilter('all');
      }
    }
  }, [initialBillId, loadingBills, statusFilter]);

  // Selected bill object
  const activeBill = useMemo(() => {
    if (!selectedBillId) return null;
    return loadingBills.find((b) => b.id === selectedBillId) || null;
  }, [selectedBillId, loadingBills]);

  // Load audit trail when activeBill changes
  const fetchAuditLogs = useCallback(async (billId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    setIsLoadingAudit(true);
    try {
      // Query invoice_audit_logs view first, fallback to invoice_audit table
      let res = await supabase
        .from('invoice_audit_logs')
        .select('*')
        .eq('invoice_id', billId)
        .order('created_at', { ascending: false });

      if (res.error) {
        res = await supabase
          .from('invoice_audit')
          .select('*')
          .eq('invoice_id', billId)
          .order('created_at', { ascending: false });
      }

      if (!res.error && res.data) {
        setAuditLogs(res.data as InvoiceAudit[]);
      }
    } catch {
      // Non-fatal audit log fetch error
    } finally {
      setIsLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    if (activeBill?.id) {
      fetchAuditLogs(activeBill.id);
    } else {
      setAuditLogs([]);
    }
  }, [activeBill?.id, fetchAuditLogs]);

  // Products map
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Filter options
  const statusChips = [
    { id: 'pending', label: 'منتظر بررسی' },
    { id: 'approved', label: 'تایید شده (آماده خروج)' },
    { id: 'loaded', label: 'خروج از انبار شده' },
    { id: 'draft', label: 'پیش‌نویس ویزیتورها' },
    { id: 'cancelled', label: 'لغو شده' },
    { id: 'all', label: 'همه فاکتورها' },
  ];

  // Status counts
  const statusCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let loaded = 0;
    let draft = 0;
    let cancelled = 0;

    loadingBills.forEach((b) => {
      if (b.status === 'pending') pending++;
      else if (b.status === 'approved') approved++;
      else if (b.status === 'loaded') loaded++;
      else if (b.status === 'draft') draft++;
      else if (b.status === 'cancelled') cancelled++;
    });

    return {
      all: loadingBills.length,
      pending,
      approved,
      loaded,
      draft,
      cancelled,
    };
  }, [loadingBills]);

  // Filtered bills list
  const filteredBills = useMemo(() => {
    return loadingBills.filter((bill) => {
      if (statusFilter !== 'all' && bill.status !== statusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchId = bill.id.toLowerCase().includes(term);
        const matchInvoiceNo = bill.invoice_no?.toLowerCase().includes(term);
        const matchVisitor = bill.visitor_name.toLowerCase().includes(term);
        if (!matchId && !matchInvoiceNo && !matchVisitor) return false;
      }
      return true;
    });
  }, [loadingBills, statusFilter, searchTerm]);

  // Helper to accurately calculate total visitor cost of any bill considering pack multipliers
  const calculateBillVisitorTotal = useCallback((bill: LoadingBill): number => {
    if (bill.items && bill.items.length > 0) {
      return bill.items.reduce((acc, it) => {
        const prod = productMap.get(it.product_id);
        const pack = getPackSize(it.items_per_package || prod?.items_per_package);
        const vPrice = Number(it.visitor_price ?? prod?.visitor_price ?? 0);
        return acc + computeLine({
          quantity: it.quantity,
          pack,
          unitPrice: vPrice,
          discountPercent: 0,
        }).total;
      }, 0);
    }
    return Number(bill.total_visitor_cost || 0);
  }, [productMap]);

  // Aggregated items for the selected bill (Strictly visitor purchase price, factoring in carton/package multipliers)
  const aggregatedBillItems = useMemo(() => {
    if (!activeBill?.items) return [];

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
        currentStock: number;
        availableStock: number;
        isShortage: boolean;
        shortageCount: number;
        lines: LoadingBillItem[];
      }
    >();

    for (const it of activeBill.items) {
      const prod = productMap.get(it.product_id);
      const pack = getPackSize(it.items_per_package || prod?.items_per_package);
      const baseUnit = getBaseUnit(it.unit || prod?.unit, pack);
      const unit = getUnitColumnText(pack, baseUnit);
      const curStock = prod ? prod.stock : 0;
      const resStock = prod ? prod.reserved_stock : 0;
      const availStock = Math.round(Math.max(0, curStock - resStock) * 1000) / 1000;
      const vPrice = Number(it.visitor_price ?? prod?.visitor_price ?? 0);
      const lineCalc = computeLine({
        quantity: it.quantity,
        pack,
        unitPrice: vPrice,
        discountPercent: 0,
      });

      const existing = map.get(it.product_id);
      if (existing) {
        existing.totalQuantity = Math.round((existing.totalQuantity + it.quantity) * 1000) / 1000;
        existing.totalAmount += lineCalc.total;
        existing.lines.push(it);
      } else {
        map.set(it.product_id, {
          productId: it.product_id,
          productName: it.product_name,
          pack,
          baseUnit,
          unit,
          totalQuantity: it.quantity,
          visitorPrice: vPrice,
          totalAmount: lineCalc.total,
          currentStock: curStock,
          availableStock: availStock,
          isShortage: false,
          shortageCount: 0,
          lines: [it],
        });
      }
    }

    // Calculate shortage based on physical stock vs bill requirement
    const result = Array.from(map.values()).map((item) => {
      const isShortage = item.currentStock < item.totalQuantity;
      const shortageCount = isShortage ? Math.round((item.totalQuantity - item.currentStock) * 1000) / 1000 : 0;
      return {
        ...item,
        isShortage,
        shortageCount,
      };
    });

    return result;
  }, [activeBill?.items, productMap]);

  // Grand totals
  const billTotalAmount = useMemo(() => {
    return aggregatedBillItems.reduce((acc, it) => acc + it.totalAmount, 0);
  }, [aggregatedBillItems]);

  const billTotalUnits = useMemo(() => {
    const sum = aggregatedBillItems.reduce((acc, it) => acc + (Number(it.totalQuantity) || 0), 0);
    return Math.round(sum * 1000) / 1000;
  }, [aggregatedBillItems]);

  const hasAnyShortage = useMemo(() => {
    return aggregatedBillItems.some((it) => it.isShortage);
  }, [aggregatedBillItems]);

  // Customer Grouped items for View Mode 2 («به تفکیک مشتری»)
  const customerGroupedItems = useMemo(() => {
    if (!activeBill?.items) return [];

    const groupMap = new Map<
      string,
      {
        id: string;
        name: string;
        orderId?: string | null;
        source: 'order' | 'visitor_manual' | 'admin_manual';
        items: LoadingBillItem[];
        totalAmount: number;
      }
    >();

    for (const it of activeBill.items) {
      let groupKey = '';
      let groupName = '';
      const src = it.source || 'order';

      if (it.order_id) {
        groupKey = `order-${it.order_id}`;
        const relatedOrder = orders.find((o) => o.id === it.order_id);
        groupName = relatedOrder?.supermarket_name || it.customer_label || `سفارش ${it.order_id}`;
      } else if (it.customer_label) {
        groupKey = `manual-${it.customer_label}`;
        groupName = it.customer_label;
      } else {
        groupKey = `manual-unknown-${src}`;
        groupName = src === 'admin_manual' ? 'توافق حضوری / تلفنی ادمین' : 'اقلام مازاد ویزیتور';
      }

      const prod = productMap.get(it.product_id);
      const pack = getPackSize(it.items_per_package || prod?.items_per_package);
      const itemPrice = Number(it.visitor_price ?? prod?.visitor_price ?? 0);
      const rowAmount = computeLine({
        quantity: it.quantity,
        pack,
        unitPrice: itemPrice,
        discountPercent: 0,
      }).total;

      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.items.push(it);
        existing.totalAmount += rowAmount;
      } else {
        groupMap.set(groupKey, {
          id: groupKey,
          name: groupName,
          orderId: it.order_id,
          source: src,
          items: [it],
          totalAmount: rowAmount,
        });
      }
    }

    return Array.from(groupMap.values());
  }, [activeBill?.items, orders, productMap]);

  // Handlers for Operations

  // 1. Add Agreed Line (admin_manual - telephone or in-person agreement)
  const handleAddAgreementLine = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAgreementQty = Math.round((parseFloat(String(agreementQty)) || 0) * 1000) / 1000;
    if (!activeBill || !agreementProductId || parsedAgreementQty <= 0 || isSubmittingAgreement) return;

    setIsSubmittingAgreement(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('invoice_add_manual_line', {
          p_invoice_id: activeBill.id,
          p_product_id: agreementProductId,
          p_qty: parsedAgreementQty,
          p_customer_label: agreementCustomerLabel.trim() || 'توافق حضوری / تلفنی ادمین',
          p_source: 'admin_manual',
          p_line_note: agreementLineNote.trim() || null,
          p_unit_price: agreementUnitPrice !== '' ? Number(agreementUnitPrice) : null,
          p_actor: currentUser.name || 'ادمین',
        });

        if (error) {
          showToast(error.message || 'خطا در افزودن قلم توافقی.', 'error');
          return;
        }

        if (!data || (data as { success?: boolean; message?: string }).success === false) {
          const msg = (data as { message?: string })?.message || 'خطا در ثبت قلم توافقی.';
          showToast(msg, 'error');
          return;
        }

        showToast('قلم توافقی با موفقیت به فاکتور ویزیتور افزوده شد.', 'success');
        setAgreementProductId('');
        setInlineSearchQuery('');
        setAgreementQty(1);
        setAgreementCustomerLabel('');
        setAgreementLineNote('');
        setAgreementUnitPrice('');
        setIsAddingInline(false);
        refreshData();
        if (activeBill) fetchAuditLogs(activeBill.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت قلم توافقی.';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingAgreement(false);
    }
  };

  // 2. Update Line (Quantity / Price with Reason via invoice_update_line)
  const handleUpdateLine = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedEditQty = Math.round((parseFloat(String(editQty)) || 0) * 1000) / 1000;
    if (!editingLine || parsedEditQty <= 0 || isUpdatingLine) return;

    setIsUpdatingLine(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('invoice_update_line', {
          p_line_id: editingLine.id,
          p_qty: parsedEditQty,
          p_unit_price: editUnitPrice !== '' ? Number(editUnitPrice) : null,
          p_actor: currentUser.name || 'ادمین',
          p_reason: editReason.trim() || 'اصلاح ادمین',
        });

        if (error) {
          showToast(error.message || 'خطا در ویرایش قلم فاکتور.', 'error');
          return;
        }

        if (!data || (data as { success?: boolean; message?: string }).success === false) {
          const msg = (data as { message?: string })?.message || 'خطا در ویرایش قلم فاکتور.';
          showToast(msg, 'error');
          return;
        }

        showToast('ردیف فاکتور با موفقیت اصلاح شد و دفعات اصلاح ثبت گردید.', 'success');
        setEditingLine(null);
        refreshData();
        if (activeBill) fetchAuditLogs(activeBill.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در به‌روزرسانی ردیف فاکتور.';
      showToast(msg, 'error');
    } finally {
      setIsUpdatingLine(false);
    }
  };

  // 3. Remove Line with Reason (calls invoice_delete_line with fallback to invoice_remove_line)
  const handleRemoveLine = async (lineId: string, lineName?: string) => {
    const reason = window.prompt(
      `علت حذف ردیف «${lineName || 'کالا'}» از فاکتور را وارد نمایید (اختیاری):`,
      'کسری موجودی / تصمیم ادمین'
    );
    if (reason === null) return; // user cancelled

    try {
      if (isSupabaseConfigured && supabase) {
        // Try invoice_delete_line first as specified in prompt
        let res = await supabase.rpc('invoice_delete_line', {
          p_line_id: lineId,
          p_actor: currentUser.name || 'ادمین',
          p_reason: reason.trim() || 'حذف توسط ادمین',
        });

        if (res.error) {
          // Fallback to invoice_remove_line
          res = await supabase.rpc('invoice_remove_line', {
            p_line_id: lineId,
            p_actor: currentUser.name || 'ادمین',
            p_reason: reason.trim() || 'حذف توسط ادمین',
          });
        }

        if (res.error) {
          showToast(res.error.message || 'خطا در حذف قلم از فاکتور.', 'error');
          return;
        }

        if (!res.data || (res.data as { success?: boolean; message?: string }).success === false) {
          const msg = (res.data as { message?: string })?.message || 'خطا در حذف قلم.';
          showToast(msg, 'error');
          return;
        }

        showToast('ردیف با موفقیت از فاکتور حذف و رزرو آزاد گردید.', 'success');
        refreshData();
        if (activeBill) fetchAuditLogs(activeBill.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در حذف قلم.';
      showToast(msg, 'error');
    }
  };

  // 4. Approve Loading Bill / Lock Prices: approve_loading_bill_transaction
  const handleConfirmApprove = async () => {
    if (!activeBill || isApproving) return;

    setIsApproving(true);
    try {
      if (isSupabaseConfigured && supabase) {
        if (billTotalAmount > 0) {
          await supabase
            .from('loading_bills')
            .update({ total_visitor_cost: billTotalAmount })
            .eq('id', activeBill.id);
        }

        const { data, error } = await supabase.rpc('approve_loading_bill_transaction', {
          p_loading_bill_id: activeBill.id,
          p_approved_by: currentUser.name || 'ادمین',
        });

        if (error) {
          showToast(error.message || 'خطا در تایید قیمت‌ها و فاکتور.', 'error');
          return;
        }

        if (!data || (data as { success?: boolean; message?: string }).success === false) {
          const msg = (data as { message?: string })?.message || 'خطا در تایید قیمت‌ها و فاکتور.';
          showToast(msg, 'error');
          return;
        }

        const res = data as { message?: string; invoice_no?: string };
        showToast(
          res.message || `فاکتور تایید شد و شماره ${res.invoice_no || activeBill.id} تثبیت گردید.`,
          'success'
        );
        setIsApproveModalOpen(false);
        refreshData();
        if (activeBill) fetchAuditLogs(activeBill.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در تایید فاکتور.';
      showToast(msg, 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // 5. Cancel Invoice with Mandatory Reason: cancel_invoice
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBill || !cancelReasonInput.trim() || isCancelling) return;

    setIsCancelling(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('cancel_invoice', {
          p_invoice_id: activeBill.id,
          p_actor: currentUser.name || 'ادمین',
          p_reason: cancelReasonInput.trim(),
        });

        if (error) {
          showToast(error.message || 'خطا در لغو فاکتور.', 'error');
          return;
        }

        if (!data || (data as { success?: boolean; message?: string }).success === false) {
          const msg = (data as { message?: string })?.message || 'خطا در لغو فاکتور.';
          showToast(msg, 'error');
          return;
        }

        showToast('فاکتور با موفقیت لغو شد و سفارش‌ها به وضعیت آماده ارسال بازگشتند.', 'success');
        setCancelReasonInput('');
        setIsCancelModalOpen(false);
        refreshData();
        if (activeBill) fetchAuditLogs(activeBill.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در لغو فاکتور.';
      showToast(msg, 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  // Status badge helper
  const renderStatusBadge = (status: LoadingBill['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600/40 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>منتظر بررسی ادمین</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-950/80 text-blue-300 border border-blue-600/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>تایید شده (قیمت‌ها قفل)</span>
          </span>
        );
      case 'loaded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
            <Truck className="w-3.5 h-3.5 text-emerald-400" />
            <span>خروج از انبار انجام شده</span>
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>پیش‌نویس ویزیتور</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/80 text-rose-300 border border-rose-600/40">
            <Ban className="w-3.5 h-3.5 text-rose-400" />
            <span>لغو شده</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Helper to format audit detail text
  const formatAuditDetails = (log: InvoiceAudit) => {
    const details = log.details as Record<string, unknown> | null;
    if (!details) return log.action;

    switch (log.action) {
      case 'invoice_update_line':
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-200">
              ویرایش ردیف: {String(details.product_name || 'کالا')}
            </p>
            <p className="text-slate-400">
              تعداد قدیم: <span className="font-mono text-slate-300">{String(details.old_qty ?? '-')}</span> ➔ جدید: <span className="font-mono text-emerald-400 font-bold">{String(details.new_qty ?? '-')}</span>
              {details.new_price ? (
                <> | نرخ توافقی: <span className="font-mono text-blue-300">{formatPrice(Number(details.new_price))} تومان</span></>
              ) : null}
            </p>
            {Boolean(details.reason) && (
              <p className="text-amber-300/80 text-[11px]">علت ویرایش: {String(details.reason)}</p>
            )}
          </div>
        );
      case 'invoice_add_manual_line':
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-purple-300">
              افزودن قلم توافقی: {String(details.product_name || 'کالای دستی')} ({String(details.quantity)} عدد)
            </p>
            <p className="text-slate-400">
              مشتری: <span className="text-slate-200">{String(details.customer_label || 'عمومی')}</span>
              {Boolean(details.line_note) && <> | توضیح: <span className="text-slate-300">{String(details.line_note)}</span></>}
            </p>
          </div>
        );
      case 'invoice_remove_line':
      case 'invoice_delete_line':
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-rose-300">حذف قلم از فاکتور</p>
            {Boolean(details.reason) && (
              <p className="text-slate-400">علت: {String(details.reason)}</p>
            )}
          </div>
        );
      case 'finalize_invoice':
      case 'approve_loading_bill_transaction':
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-emerald-300">تایید قیمت‌ها و تثبیت فاکتور بارگیری</p>
            {Boolean(details.invoice_no) && (
              <p className="font-mono text-blue-300 font-bold">شماره سند: {formatUnifiedBillNumber(activeBill?.id, String(details.invoice_no))}</p>
            )}
          </div>
        );
      case 'cancel_invoice':
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-rose-400">لغو کامل فاکتور</p>
            {Boolean(details.reason) && (
              <p className="text-slate-400">علت لغو: {String(details.reason)}</p>
            )}
          </div>
        );
      case 'submit_invoice':
        return <p className="text-amber-300">ارسال فاکتور توسط ویزیتور جهت بررسی ادمین</p>;
      case 'create_draft':
        return <p className="text-slate-400">ایجاد پیش‌نویس اولیه فاکتور بارگیری</p>;
      case 'confirm_loading_exit':
        return <p className="text-emerald-400 font-semibold">تایید ترخیص و خروج نهایی بار از انبار</p>;
      default:
        return <p className="text-slate-400">{JSON.stringify(details)}</p>;
    }
  };

  const isEditable = activeBill && (activeBill.status === 'pending' || activeBill.status === 'approved');

  return (
    <div className="space-y-5" dir="rtl">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>فاکتورهای ویزیتورها</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            بررسی اقلام بارگیری، تایید نرخ خرید ویزیتور، ثبت اقلام توافقی و چاپ حواله رسمی
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Direct Invoice Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDirectInvoiceMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-emerald-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ صدور فاکتور مستقیم</span>
              <ChevronDown className="w-3.5 h-3.5 mr-0.5" />
            </button>

            {isDirectInvoiceMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsDirectInvoiceMenuOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl z-30 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectInvoiceMode('visitor');
                      setIsDirectInvoiceOpen(true);
                      setIsDirectInvoiceMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-right text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-emerald-400 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold">برای ویزیتور</span>
                      <span className="text-[10px] text-slate-400">تخصیص سفارش و اقلام مازاد</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDirectInvoiceMode('direct_store');
                      setIsDirectInvoiceOpen(true);
                      setIsDirectInvoiceMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-right text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-blue-400 flex items-center gap-2.5 transition cursor-pointer border-t border-slate-800/80"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold">برای فروشگاه</span>
                      <span className="text-[10px] text-slate-400">صدور فاکتور و تحویل مستقیم</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Pending Counter alert banner if pending exists */}
          {statusCounts.pending > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold animate-pulse">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{statusCounts.pending} فاکتور منتظر بررسی شما</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Status Filter Chips with Counts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {statusChips.map((chip) => {
          const isActive = statusFilter === chip.id;
          const count = (statusCounts as Record<string, number>)[chip.id] || 0;

          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setStatusFilter(chip.id);
                setSelectedBillId(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                isActive
                  ? chip.id === 'pending'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{chip.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full font-mono text-[11px] ${
                  isActive
                    ? chip.id === 'pending'
                      ? 'bg-slate-950/20 text-slate-950 font-black'
                      : 'bg-white/20 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Main Master-Detail Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Bills List (4 cols on lg) */}
        <div className={`space-y-3 ${activeBill ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجوی نام ویزیتور، شماره فاکتور یا شناسه..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {filteredBills.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs space-y-1">
              <p className="font-bold text-slate-300">هیچ فاکتوری در این وضعیت یافت نشد.</p>
              <p className="text-slate-500">فیلتر دیگری را انتخاب یا عبارت جستجو را تغییر دهید.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
              {filteredBills.map((bill) => {
                const isSelected = selectedBillId === bill.id;
                const ageInfo = bill.status === 'pending' ? getBillAgeInfo(bill.submitted_at || bill.created_at) : null;

                return (
                  <div
                    key={bill.id}
                    onClick={() => setSelectedBillId(bill.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 shadow-xs ${
                      isSelected
                        ? 'bg-blue-950/30 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-100">
                            {bill.visitor_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 font-mono text-xs font-bold text-blue-300 border border-slate-800">
                            {formatUnifiedBillNumber(bill.id, bill.invoice_no)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          تاریخ: {formatBillDateTime(bill.submitted_at || bill.created_at)}
                        </p>
                      </div>

                      <div className="text-left shrink-0">
                        {renderStatusBadge(bill.status)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
                      <div className="text-slate-400">
                        <span>مبلغ خرید ویزیتور: </span>
                        <span className="font-mono font-bold text-slate-200">
                          {formatPrice(calculateBillVisitorTotal(bill))} تومان
                        </span>
                      </div>

                      {/* Revision count or Pending age */}
                      <div className="flex items-center gap-1.5">
                        {(bill.revision_count ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            {bill.revision_count} ویرایش
                          </span>
                        )}
                        {ageInfo && (
                          <span className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>{ageInfo.formattedText}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Invoice Detail Page (8 cols on lg) */}
        {activeBill ? (
          <div className="lg:col-span-8 bg-slate-900 rounded-3xl border border-slate-800 p-4 sm:p-6 space-y-6 shadow-xl">
            {/* Top Detail Header: Visitor Name, Invoice No, Status, Revision Count */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-slate-100">
                    فاکتور بارگیری {activeBill.visitor_name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-950 text-blue-300 border border-blue-600/40 font-mono font-bold text-xs">
                    {formatUnifiedBillNumber(activeBill.id, activeBill.invoice_no)}
                  </span>
                  {renderStatusBadge(activeBill.status)}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  <span>تاریخ ارسال: <strong className="text-slate-300">{formatOrderDate(activeBill.submitted_at || activeBill.created_at)}</strong></span>
                  {activeBill.status === 'pending' && (
                    <>
                      <span>•</span>
                      <span className="text-amber-400 flex items-center gap-1 font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>سن فاکتور: {getBillAgeInfo(activeBill.submitted_at || activeBill.created_at).formattedText}</span>
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-300 border border-slate-800 font-bold">
                    {activeBill.revision_count ?? 0} بار ویرایش شده
                  </span>
                  {activeBill.finalized_by && (
                    <>
                      <span>•</span>
                      <span>تاییدکننده: <strong className="text-emerald-300">{activeBill.finalized_by}</strong></span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Toolbar: Approve, Cancel, Print, Record Payment */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* 0. Record Financial Payment Button (only for approved or loaded bills) */}
                {(activeBill.status === 'approved' || activeBill.status === 'loaded') && (
                  <button
                    type="button"
                    onClick={() => setIsRecordPaymentOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
                    title="ثبت دریافت از طرف حساب بابت تسویه این فاکتور"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>دریافت از طرف حساب</span>
                  </button>
                )}

                {/* 1. Official Print / Preview Button */}
                {activeBill.status === 'approved' || activeBill.status === 'loaded' ? (
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>چاپ فاکتور نهایی</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 text-xs font-bold border border-blue-500/40 transition cursor-pointer"
                    title="پیش‌نمایش سند قبل از تایید نهایی"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>پیش‌نمایش پیش‌نویس (غیرنهایی)</span>
                  </button>
                )}

                {/* 2. Cancel Invoice Button: Only if not loaded and not already cancelled */}
                {activeBill.status !== 'loaded' && activeBill.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelReasonInput('');
                      setIsCancelModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 transition cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-400" />
                    <span>لغو فاکتور</span>
                  </button>
                )}

                {/* 3. Approve Invoice Button: Only when status === 'pending' */}
                {activeBill.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => setIsApproveModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تایید قیمت‌ها و فاکتور</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4-Metric Financial Ledger Summary Card */}
            {(() => {
              const billCost = billTotalAmount > 0 ? billTotalAmount : Number(activeBill.total_visitor_cost || 0);
              const settlement = getInvoiceSettlementStatus(activeBill.id, billCost);
              const visitorAccount = getAccountSummary(activeBill.visitor_id);
              const isAccountActive = Boolean(visitorAccount?.is_active);

              return (
                <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-slate-200">وضعیت مالی و تسویه فاکتور</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAccountActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          حساب دفتری فعال ({visitorAccount.account_number})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          حساب دفتری غیرفعال
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                    {/* Metric 1: مبلغ فاکتور */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400 block font-medium">مبلغ فاکتور</span>
                      <div className="font-mono font-black text-sm text-slate-100">
                        {formatPrice(billCost)}{' '}
                        <span className="text-[10px] font-normal text-slate-500 font-sans">تومان</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">جمع خرید ویزیتور</span>
                    </div>

                    {/* Metric 2: پرداخت‌شده این فاکتور */}
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                      <span className="text-[11px] text-emerald-300 block font-medium">پرداخت‌شده این فاکتور</span>
                      <div className="font-mono font-black text-sm text-emerald-400">
                        {formatPrice(settlement.totalPaid)}{' '}
                        <span className="text-[10px] font-normal text-emerald-500/70 font-sans">تومان</span>
                      </div>
                      <span className="text-[10px] text-emerald-400/80 block">
                        {settlement.allocationsCount > 0
                          ? `${settlement.allocationsCount} تراکنش تخصیصی`
                          : 'بدون پرداخت مستقیم'}
                      </span>
                    </div>

                    {/* Metric 3: معوق این فاکتور */}
                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1">
                      <span className="text-[11px] text-amber-300 block font-medium">معوق این فاکتور</span>
                      <div className="font-mono font-black text-sm text-amber-400">
                        {formatPrice(settlement.remainingDue)}{' '}
                        <span className="text-[10px] font-normal text-amber-500/70 font-sans">تومان</span>
                      </div>
                      <span className="text-[10px] block font-semibold">
                        {settlement.remainingDue === 0 ? (
                          <span className="text-emerald-400 font-bold">✓ تسویه کامل</span>
                        ) : settlement.totalPaid > 0 ? (
                          <span className="text-amber-400 font-bold">پرداخت ناقص</span>
                        ) : (
                          <span className="text-rose-400 font-bold">پرداخت نشده</span>
                        )}
                      </span>
                    </div>

                    {/* Metric 4: مانده کل حساب ویزیتور (کاملاً مجزا از معوق این فاکتور) */}
                    <div className="p-3 rounded-xl bg-blue-950/25 border border-blue-500/40 space-y-1">
                      <span className="text-[11px] text-blue-300 block font-medium">مانده کل حساب ویزیتور</span>
                      <div className="font-mono font-black text-sm text-blue-200">
                        {visitorAccount ? formatPrice(Math.abs(visitorAccount.current_balance)) : 0}{' '}
                        <span className="text-[10px] font-normal text-blue-400/70 font-sans">تومان</span>
                      </div>
                      <span className="text-[10px] block font-bold">
                        {!isAccountActive ? (
                          <span className="text-slate-400">حساب غیرفعال</span>
                        ) : visitorAccount.current_balance > 0 ? (
                          <span className="text-rose-400">بدهکار به شرکت</span>
                        ) : visitorAccount.current_balance < 0 ? (
                          <span className="text-emerald-400">بستانکار از شرکت</span>
                        ) : (
                          <span className="text-slate-300">بی‌حساب و تسویه</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Warning if warehouse stock shortage */}
            {hasAnyShortage && activeBill.status !== 'loaded' && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>هشدار کمبود موجودی فیزیکی در انبار:</span>
                </div>
                <p className="text-slate-300">
                  یک یا چند قلم از این فاکتور با کسری موجودی فیزیکی مواجه است. پیش از تایید، تعداد را کاهش دهید یا قلم مربوطه را حذف کنید.
                </p>
              </div>
            )}

            {/* Switchable View Tabs: «به تفکیک کالا» vs «به تفکیک مشتری» */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('by_product')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    viewMode === 'by_product'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  به تفکیک کالا (نمای تجمیعی)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('by_customer')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    viewMode === 'by_customer'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  به تفکیک مشتری (ریز توزیع و توافقات)
                </button>
              </div>
            </div>

            {/* VIEW MODE 1: «به تفکیک کالا» (Strictly visitor purchase price, no store price, no profit) */}
            {viewMode === 'by_product' && (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                        <th className="py-3 px-3.5 w-10 text-center">ردیف</th>
                        <th className="py-3 px-3.5">نام کالا</th>
                        <th className="py-3 px-3 text-center w-20">واحد</th>
                        <th className="py-3 px-3 text-center w-24">تعداد کل</th>
                        <th className="py-3 px-3.5 text-left w-28">قیمت خرید ویزیتور</th>
                        <th className="py-3 px-3.5 text-left w-32">مبلغ کل (تومان)</th>
                        {isEditable && <th className="py-3 px-3 text-center w-24">عملیات</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {aggregatedBillItems.map((item, idx) => (
                        <tr
                          key={item.productId}
                          className={`transition ${
                            item.isShortage ? 'bg-rose-950/20 border-rose-500/30' : 'hover:bg-slate-800/20'
                          }`}
                        >
                          <td className="py-3 px-3.5 text-center text-slate-500 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-slate-100">{item.productName}</span>
                            {item.isShortage && (
                              <div className="text-[11px] text-rose-400 font-bold mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>کسری موجودی: {item.shortageCount} واحد (موجودی انبار: {item.currentStock})</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400">
                            <span>{item.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-black text-sm text-slate-100 font-mono">
                            {item.totalQuantity}
                          </td>
                          <td className="py-3 px-3.5 text-left font-mono text-slate-300">
                            {formatPrice(item.visitorPrice)}
                          </td>
                          <td className="py-3 px-3.5 text-left font-mono font-bold text-blue-400">
                            {formatPrice(item.totalAmount)}
                          </td>
                          {isEditable && (
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {item.lines.length === 1 ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingLine(item.lines[0]);
                                        setEditQty(item.lines[0].quantity);
                                        setEditUnitPrice(item.lines[0].visitor_price ?? '');
                                        setEditReason('');
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-slate-800 text-blue-400 transition cursor-pointer"
                                      title="ویرایش تعداد یا قیمت خرید ویزیتور"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLine(item.lines[0].id, item.productName)}
                                      className="p-1.5 rounded-lg hover:bg-slate-800 text-rose-400 transition cursor-pointer"
                                      title="حذف قلم"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setViewMode('by_customer')}
                                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                                  >
                                    ریز {item.lines.length} ردیف
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}

                      {/* Row N+1: Inactive / Dormant agreed item row (خام) */}
                      {isEditable && !isAddingInline && (
                        <tr
                          onClick={() => setIsAddingInline(true)}
                          className="border-t-2 border-dashed border-purple-500/40 bg-purple-950/15 hover:bg-purple-950/30 transition cursor-pointer group"
                          title="برای جستجو و افزودن کالا کلیک کنید"
                        >
                          <td className="py-2.5 px-3 text-center text-purple-400 font-mono text-xs font-bold">
                            {aggregatedBillItems.length + 1}
                          </td>
                          <td colSpan={isEditable ? 6 : 5} className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-2 text-purple-300 font-bold text-xs group-hover:text-purple-200 transition">
                              <Plus className="w-4 h-4 text-purple-400" />
                              <span>برای جستجو و افزودن کالا کلیک کنید</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Row N+1: Active inline form for adding agreed item */}
                      {isEditable && isAddingInline && (
                        <>
                          <tr className="bg-purple-950/35 border-t-2 border-purple-500/70 transition shadow-inner">
                            {/* Row Number */}
                            <td className="py-3 px-3.5 text-center font-mono font-bold text-purple-300 text-xs align-top">
                              <span className="w-6 h-6 rounded-full bg-purple-900/70 border border-purple-400/60 inline-flex items-center justify-center text-white">
                                {aggregatedBillItems.length + 1}
                              </span>
                            </td>

                            {/* Product Search & Selection */}
                            <td className="py-3 px-3.5 align-top">
                              <div className="space-y-1.5 min-w-[220px]">
                                {selectedInlineProduct ? (
                                  <div className="p-2 rounded-xl bg-slate-900 border border-purple-500/60 flex items-start justify-between gap-2 shadow-xs">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-100 text-xs">
                                          {selectedInlineProduct.name}
                                        </span>
                                        {selectedInlineProduct.brand && (
                                          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                            {selectedInlineProduct.brand}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-purple-300 font-mono mt-0.5 flex items-center gap-2">
                                        <span>
                                          موجودی قابل فروش: {Math.round(Math.max(0, selectedInlineProduct.stock - selectedInlineProduct.reserved_stock) * 1000) / 1000} {selectedInlineProduct.unit}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAgreementProductId('');
                                        setInlineSearchQuery('');
                                      }}
                                      className="text-[11px] text-purple-400 hover:text-purple-200 underline font-semibold shrink-0 cursor-pointer pt-0.5"
                                    >
                                      تعویض کالا
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={inlineSearchQuery}
                                        onChange={(e) => setInlineSearchQuery(e.target.value)}
                                        placeholder="جستجوی نام یا برند کالا..."
                                        className="w-full bg-slate-950 border border-purple-500 rounded-xl py-2 pr-8 pl-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                      />
                                      <Search className="w-3.5 h-3.5 text-purple-400 absolute right-2.5 top-2.5 pointer-events-none" />
                                    </div>

                                    {/* Scrollable list of matching products */}
                                    <div className="max-h-44 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-1 divide-y divide-slate-800/80 shadow-lg">
                                      {filteredInlineProducts.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-slate-500">
                                          کالایی با این نام یافت نشد.
                                        </div>
                                      ) : (
                                        filteredInlineProducts.map((p) => {
                                          const avail = Math.round(Math.max(0, p.stock - p.reserved_stock) * 1000) / 1000;
                                          const vPrice = p.visitor_price ?? 0;
                                          return (
                                            <div
                                              key={p.id}
                                              onClick={() => handleSelectInlineProduct(p)}
                                              className="p-2 hover:bg-purple-950/70 rounded-lg cursor-pointer transition flex items-center justify-between gap-2 text-right"
                                            >
                                              <div className="min-w-0 flex-1">
                                                <div className="font-semibold text-xs text-slate-200 truncate">
                                                  {p.name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                  {p.brand && <span>برند: {p.brand}</span>}
                                                  <span className={avail <= 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-mono'}>
                                                    موجودی: {avail} {p.unit}
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="font-mono text-purple-300 font-bold text-xs shrink-0">
                                                {formatPrice(vPrice)}
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Unit / Weight column */}
                            <td className="py-3 px-3 text-center font-bold text-slate-200 text-xs align-top pt-4">
                              {selectedInlineProduct ? (
                                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-purple-300 font-mono text-[11px]">
                                  {selectedInlineProduct.unit}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>

                            {/* Quantity / Weight input */}
                            <td className="py-3 px-3 text-center align-top pt-3">
                              <div className="space-y-1">
                                <input
                                  type="number"
                                  min="0.001"
                                  step="any"
                                  value={agreementQty}
                                  onChange={(e) => setAgreementQty(e.target.value)}
                                  placeholder="تعداد / وزن"
                                  className="w-20 p-2 text-center bg-slate-950 border border-purple-500/70 rounded-xl text-slate-100 font-mono font-bold text-xs focus:outline-none focus:border-purple-400"
                                />
                                {selectedInlineProduct && (
                                  <span className="block text-[10px] text-slate-400">
                                    برحسب {selectedInlineProduct.unit}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Visitor Price input */}
                            <td className="py-3 px-3.5 text-left align-top pt-3">
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={agreementUnitPrice}
                                    onChange={(e) => setAgreementUnitPrice(e.target.value ? Number(e.target.value) : '')}
                                    placeholder={
                                      selectedInlineProduct
                                        ? String(selectedInlineProduct.visitor_price ?? 0)
                                        : 'نرخ'
                                    }
                                    className="w-24 p-2 text-left bg-slate-950 border border-purple-500/70 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-purple-400"
                                  />
                                  <span className="text-[10px] text-slate-400">تومان</span>
                                </div>
                                <span className="block text-[10px] text-slate-500 text-left">
                                  فی خرید ویزیتور
                                </span>
                              </div>
                            </td>

                            {/* Total Row Amount */}
                            <td className="py-3 px-3.5 text-left font-mono font-bold text-xs text-purple-300 align-top pt-4">
                              {formatPrice(
                                computeLine({
                                  quantity: Number(agreementQty) || 0,
                                  pack: selectedInlineProduct ? getPackSize(selectedInlineProduct.items_per_package) : 1,
                                  unitPrice: agreementUnitPrice !== ''
                                    ? Number(agreementUnitPrice)
                                    : (selectedInlineProduct?.visitor_price ?? 0),
                                  discountPercent: 0,
                                }).total
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-3 text-center align-top pt-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={handleAddAgreementLine}
                                  disabled={!agreementProductId || (Number(agreementQty) || 0) <= 0 || isSubmittingAgreement}
                                  className="px-2.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-sm"
                                  title="افزودن این ردیف به فاکتور"
                                >
                                  {isSubmittingAgreement ? (
                                    <span className="text-[10px]">...</span>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>ثبت</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelAddInline}
                                  disabled={isSubmittingAgreement}
                                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                  title="انصراف"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Extra info row: Customer label and optional note */}
                          <tr className="bg-purple-950/20 border-b-2 border-purple-500/40 text-xs">
                            <td colSpan={7} className="py-2.5 px-3.5">
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                  <span className="text-slate-400 text-[11px] shrink-0 font-medium">
                                    مشتری / فروشگاه (اختیاری):
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="مثلاً: سوپرمارکت بهار / آقای رضایی"
                                    value={agreementCustomerLabel}
                                    onChange={(e) => setAgreementCustomerLabel(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                  <span className="text-slate-400 text-[11px] shrink-0 font-medium">
                                    توضیح (اختیاری):
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="مثلاً: سفارش تلفنی فوری / توافق حضوری"
                                    value={agreementLineNote}
                                    onChange={(e) => setAgreementLineNote(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-950 font-black border-t-2 border-slate-800 text-slate-100">
                        <td colSpan={3} className="py-3.5 px-3.5 text-right">
                          جمع کل اقلام فاکتور ویزیتور:
                        </td>
                        <td className="py-3.5 px-3 text-center text-blue-400 text-sm font-mono">
                          {billTotalUnits}
                        </td>
                        <td className="py-3.5 px-3.5"></td>
                        <td className="py-3.5 px-3.5 text-left font-mono text-base text-emerald-400" colSpan={isEditable ? 2 : 1}>
                          {formatPrice(billTotalAmount)} تومان
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW MODE 2: «به تفکیک مشتری» (Showing customer label, source badge, line_note) */}
            {viewMode === 'by_customer' && (
              <div className="space-y-4">
                {customerGroupedItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    هیچ ردیفی در این فاکتور یافت نشد.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerGroupedItems.map((group) => (
                      <div
                        key={group.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-100">{group.name}</span>
                            {group.source === 'order' && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-900/40 text-blue-300 border border-blue-700/50 text-[10px] font-bold">
                                سامانه (سفارش {group.orderId})
                              </span>
                            )}
                            {group.source === 'visitor_manual' && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-900/40 text-purple-300 border border-purple-700/50 text-[10px] font-bold">
                                ویزیتور (اقلام مازاد)
                              </span>
                            )}
                            {group.source === 'admin_manual' && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-900/40 text-amber-300 border border-amber-700/50 text-[10px] font-bold">
                                قلم توافقی ادمین (تلفنی / حضوری)
                              </span>
                            )}
                          </div>

                          <div className="text-left font-mono font-bold text-xs text-slate-300">
                            مجموع: {formatPrice(group.totalAmount)} تومان
                          </div>
                        </div>

                        {/* Items under this customer */}
                        <div className="space-y-1.5">
                          {group.items.map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 text-xs text-slate-200 flex-wrap gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span className="font-bold text-slate-100">{it.product_name}</span>
                                {it.line_note && (
                                  <span className="text-[11px] text-amber-300/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                                    توضیح: {it.line_note}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {(() => {
                                  const prod = products.find((p) => p.id === it.product_id);
                                  const packCount = it.items_per_package || prod?.items_per_package;
                                  const unitStr = it.unit || prod?.unit || 'واحد';
                                  return (
                                    <span className="font-mono font-bold text-slate-100">
                                      {it.quantity} {unitStr}
                                      {packCount && packCount > 1 && (
                                        <span className="text-[11px] text-indigo-400 font-semibold mr-1 font-sans">
                                          ({packCount} عددی)
                                        </span>
                                      )}
                                    </span>
                                  );
                                })()}
                                <span className="font-mono text-slate-400">
                                  فی: {formatPrice(Number(it.visitor_price || 0))}
                                </span>

                                {isEditable && (
                                  <div className="flex items-center gap-1 mr-2 border-r border-slate-800 pr-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingLine(it);
                                        setEditQty(it.quantity);
                                        setEditUnitPrice(it.visitor_price ?? '');
                                        setEditReason('');
                                      }}
                                      className="p-1 rounded hover:bg-slate-800 text-blue-400 transition cursor-pointer"
                                      title="ویرایش تعداد یا نرخ توافقی"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLine(it.id, it.product_name)}
                                      className="p-1 rounded hover:bg-slate-800 text-rose-400 transition cursor-pointer"
                                      title="حذف قلم"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom button in customer view to add agreement item */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('by_product');
                      setIsAddingInline(true);
                    }}
                    className="w-full p-3 rounded-2xl border-2 border-dashed border-purple-500/40 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm hover:border-purple-400"
                  >
                    <Plus className="w-4 h-4 text-purple-400" />
                    <span>برای جستجو و افزودن کالا کلیک کنید</span>
                  </button>
                )}
              </div>
            )}

            {/* 4. Audit Trail Accordion: تاریخچه تغییرات فاکتور (کی، چه ادیتی کرد، مقدار قدیم و جدید) */}
            <div className="border border-slate-800 rounded-2xl bg-slate-950/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAuditAccordionOpen(!isAuditAccordionOpen)}
                className="w-full p-3.5 flex items-center justify-between text-right text-xs font-bold text-slate-300 hover:bg-slate-900/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  <span>تاریخچه تغییرات و سوابق اصلاحات فاکتور ({auditLogs.length} رویداد)</span>
                </div>
                {isAuditAccordionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isAuditAccordionOpen && (
                <div className="p-3.5 border-t border-slate-800 space-y-2 text-xs">
                  {isLoadingAudit ? (
                    <p className="text-slate-400 text-center py-2">در حال دریافت سوابق...</p>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-slate-500 text-center py-2">هیچ رویدادی در تاریخچه این فاکتور ثبت نشده است.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100">{log.actor_name}</span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 font-mono text-[10px] text-blue-300">
                                {log.action}
                              </span>
                            </div>
                            <div className="text-xs">
                              {formatAuditDetails(log)}
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                            {formatBillDateTime(log.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-3">
            <FileText className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="font-bold text-slate-200">فاکتوری انتخاب نشده است</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              لطفاً برای مشاهده اقلام، بررسی توافقات و تایید نهایی، یکی از فاکتورهای لیست سمت راست را انتخاب کنید.
            </p>
          </div>
        )}
      </div>



      {/* Modal 2: Edit Line (Quantity and/or Price with reason) */}
      {editingLine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setEditingLine(null)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <span>ویرایش تعداد و قیمت قلم فاکتور</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingLine(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateLine} className="space-y-3.5">
              <p className="text-slate-200 font-bold">{editingLine.product_name}</p>

              <div>
                <label className="block text-slate-400 mb-1">تعداد کالا:</label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">قیمت خرید ویزیتور (تومان):</label>
                <input
                  type="number"
                  placeholder="بدون تغییر"
                  value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">علت ویرایش (اختیاری):</label>
                <input
                  type="text"
                  placeholder="مثال: توافق نرخ جدید / کسری انبار"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLine(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingLine}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingLine ? 'در حال ثبت...' : 'ذخیره اصلاحات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Approve Loading Bill & Lock Prices Confirmation Modal */}
      {isApproveModalOpen && activeBill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setIsApproveModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>تایید قیمت‌ها و فاکتور بارگیری</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <p className="font-bold flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>قیمت‌ها و فاکتور قفل می‌شوند</span>
                </p>
                <p className="mt-1 text-slate-300">
                  با تایید، شماره فاکتور رسمی صادر شده و جهت ترخیص نهایی آماده می‌گردد. خروج از انبار توسط مسئول انبار انجام خواهد شد.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>تعداد کل اقلام فاکتور:</span>
                  <span className="text-slate-100 font-bold">{billTotalUnits} عدد</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>مجموع مبلغ خرید ویزیتور:</span>
                  <span className="text-emerald-400 font-bold">{formatPrice(billTotalAmount)} تومان</span>
                </div>
              </div>

              {hasAnyShortage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                  هشدار: اقلامی در این فاکتور با کسری موجودی انبار مواجه هستند!
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApprove}
                  disabled={isApproving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isApproving ? 'در حال ثبت تایید...' : 'تایید قیمت‌ها و صدور رسمی'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Cancel Invoice with Mandatory Reason */}
      {isCancelModalOpen && activeBill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setIsCancelModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>لغو فاکتور بارگیری</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-3.5">
              <p className="text-slate-300">
                با لغو فاکتور، رزرو اقلام آزاد شده و سفارش‌های متصل به وضعیت «آماده ارسال» بازمی‌گردند.
              </p>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  علت لغو فاکتور (الزامی):
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="علت لغو فاکتور را وارد کنید..."
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isCancelling || !cancelReasonInput.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? 'در حال ثبت لغو...' : 'تایید لغو فاکتور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Visitor Invoice Print & PDF Modal (only when approved or loaded) */}
      {isPrintModalOpen && activeBill && (
        <VisitorInvoicePrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          bill={activeBill}
          visitor={
            visitors.find((v) => v.id === activeBill.visitor_id) || {
              id: activeBill.visitor_id,
              name: activeBill.visitor_name,
              phone: '',
              region: 'مرکزی',
              is_active: true,
            }
          }
          products={products}
        />
      )}

      {/* Direct Invoice Sheet (Visitor or Store) */}
      {isDirectInvoiceOpen && (
        <DirectInvoiceSheet
          isOpen={isDirectInvoiceOpen}
          mode={directInvoiceMode}
          priceMode={directInvoiceMode === 'direct_store' ? 'store' : 'visitor'}
          onClose={() => setIsDirectInvoiceOpen(false)}
          onSuccess={() => {
            refreshData();
          }}
        />
      )}

      {/* Record Financial Payment Modal */}
      {isRecordPaymentOpen && activeBill && (
        <RecordPaymentModal
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          profileId={activeBill.visitor_id}
          defaultInvoiceId={activeBill.id}
          onSuccess={() => {
            refreshData();
          }}
        />
      )}
    </div>
  );
};
