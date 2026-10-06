import React, { useState, useMemo, useEffect } from 'react';
import {
  LoadingBill,
  Visitor,
  Supermarket,
  ChequeDetailsInput,
  PaymentAllocationInput,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { formatPrice } from './helpers';
import {
  X,
  CreditCard,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  Search,
  DollarSign,
  AlertCircle,
  Building,
  Check,
} from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  defaultInvoiceId?: string;
  onSuccess?: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  profileId,
  defaultInvoiceId,
  onSuccess,
}) => {
  const {
    visitors,
    supermarkets,
    loadingBills,
    financialAccounts,
    recordFinancialPayment,
    getAccountSummary,
    getInvoiceSettlementStatus,
    showToast,
    refreshData,
  } = useApp();

  const profile = useMemo(() => {
    return (
      visitors.find((v) => v.id === profileId) ||
      supermarkets.find((s) => s.id === profileId) || {
        id: profileId,
        name: 'کاربر سیستم',
        phone: '',
      }
    );
  }, [visitors, supermarkets, profileId]);

  const accountSummary = useMemo(() => {
    return getAccountSummary(profileId);
  }, [getAccountSummary, profileId]);

  // Find all approved or loaded bills belonging to this profile
  const profileBills = useMemo(() => {
    return loadingBills
      .filter(
        (b) =>
          b.visitor_id === profileId &&
          (b.status === 'approved' || b.status === 'loaded')
      )
      .map((b) => {
        const total = Number(b.total_visitor_cost || 0);
        const settlement = getInvoiceSettlementStatus(b.id, total);
        return {
          ...b,
          settlement,
        };
      })
      .sort((a, b) => {
        // Invoices with outstanding due first, then by date desc
        if (a.settlement.remainingDue > 0 && b.settlement.remainingDue === 0) return -1;
        if (a.settlement.remainingDue === 0 && b.settlement.remainingDue > 0) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [loadingBills, profileId, getInvoiceSettlementStatus]);

  // Form states
  const [paymentType, setPaymentType] = useState<'cash_payment' | 'bank_transfer' | 'cheque_payment'>('cash_payment');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentRefId, setPaymentRefId] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [chequeForm, setChequeForm] = useState<ChequeDetailsInput>({
    cheque_number: '',
    sayad_number: '',
    bank_name: '',
    branch_name: '',
    account_owner: '',
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: '',
  });

  // Allocations mapping: invoiceId -> allocatedAmount
  const [selectedAllocations, setSelectedAllocations] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset when modal opens or defaultInvoiceId changes
  useEffect(() => {
    if (!isOpen) return;

    if (defaultInvoiceId) {
      const targetBill = profileBills.find((b) => b.id === defaultInvoiceId);
      if (targetBill) {
        const remaining = targetBill.settlement.remainingDue;
        const initialAmt = remaining > 0 ? remaining : Number(targetBill.total_visitor_cost || 0);
        setPaymentAmount(initialAmt);
        if (remaining > 0) {
          setSelectedAllocations({ [defaultInvoiceId]: remaining });
        } else {
          setSelectedAllocations({});
        }
        setPaymentDescription(`تسویه فاکتور ${targetBill.invoice_no || targetBill.id}`);
        return;
      }
    }

    // Default open invoice
    const firstDueBill = profileBills.find((b) => b.settlement.remainingDue > 0);
    if (firstDueBill) {
      setPaymentAmount(firstDueBill.settlement.remainingDue);
      setSelectedAllocations({ [firstDueBill.id]: firstDueBill.settlement.remainingDue });
      setPaymentDescription(`تسویه فاکتور ${firstDueBill.invoice_no || firstDueBill.id}`);
    } else {
      setPaymentAmount('');
      setSelectedAllocations({});
      setPaymentDescription('واریز به حساب دفتری');
    }
  }, [isOpen, defaultInvoiceId, profileBills]);

  // Computed total allocated
  const totalAllocated = useMemo(() => {
    return Object.values(selectedAllocations).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [selectedAllocations]);

  const parsedPaymentAmount = Number(paymentAmount) || 0;
  const unallocatedAmount = Math.max(0, parsedPaymentAmount - totalAllocated);
  const isOverAllocated = totalAllocated > parsedPaymentAmount;

  const handleAllocationChange = (invoiceId: string, val: number) => {
    const bill = profileBills.find((b) => b.id === invoiceId);
    if (!bill) return;

    const maxAllowed = bill.settlement.remainingDue;
    const clamped = Math.max(0, Math.min(val, maxAllowed));

    setSelectedAllocations((prev) => {
      const next = { ...prev };
      if (clamped <= 0) {
        delete next[invoiceId];
      } else {
        next[invoiceId] = clamped;
      }
      return next;
    });
  };

  const handleQuickAllocateBill = (invoiceId: string) => {
    const bill = profileBills.find((b) => b.id === invoiceId);
    if (!bill) return;

    const remainingDue = bill.settlement.remainingDue;
    if (remainingDue <= 0) return;

    // Allocate up to remaining payment budget or remaining bill due
    const currentAlloc = selectedAllocations[invoiceId] || 0;
    const otherAllocated = totalAllocated - currentAlloc;
    const availableFromPayment = Math.max(0, parsedPaymentAmount - otherAllocated);
    const toAllocate = Math.min(remainingDue, availableFromPayment > 0 ? availableFromPayment : remainingDue);

    if (toAllocate > 0) {
      handleAllocationChange(invoiceId, toAllocate);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!accountSummary || !accountSummary.is_active) {
      showToast('حساب دفتری این کاربر فعال نیست. ثبت تراکنش مالی برای حساب غیرفعال امکان‌پذیر نیست.', 'error');
      return;
    }

    if (parsedPaymentAmount <= 0) {
      showToast('لطفاً مبلغ پرداختی معتبر وارد کنید.', 'error');
      return;
    }

    if (isOverAllocated) {
      showToast('مجموع مبالغ تخصیص داده شده به فاکتورها نمی‌تواند از کل مبلغ پرداختی بیشتر باشد.', 'error');
      return;
    }

    // Prepare allocations payload
    const allocationsPayload: PaymentAllocationInput[] = Object.entries(selectedAllocations)
      .filter(([_, amt]) => Number(amt) > 0)
      .map(([invId, amt]) => ({
        invoice_id: invId,
        amount: Number(amt),
      }));

    // Additional validations
    for (const alloc of allocationsPayload) {
      const b = profileBills.find((item) => item.id === alloc.invoice_id);
      if (!b) {
        showToast('یکی از فاکتورهای انتخاب‌شده نامعتبر است.', 'error');
        return;
      }
      if (alloc.amount > b.settlement.remainingDue) {
        showToast(
          `مبلغ تخصیص فاکتور ${b.invoice_no || b.id} نمی‌تواند از معوق آن (${formatPrice(b.settlement.remainingDue)} تومان) بیشتر باشد.`,
          'error'
        );
        return;
      }
    }

    if (paymentType === 'cheque_payment') {
      if (!chequeForm.cheque_number.trim()) {
        showToast('شماره چک الزامی است.', 'error');
        return;
      }
      if (!chequeForm.bank_name.trim()) {
        showToast('نام بانک الزامی است.', 'error');
        return;
      }
      if (!chequeForm.account_owner.trim()) {
        showToast('نام صاحب حساب چک الزامی است.', 'error');
        return;
      }
      if (!chequeForm.due_date) {
        showToast('تاریخ سررسید چک الزامی است.', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await recordFinancialPayment({
        profileId,
        paymentType,
        amount: parsedPaymentAmount,
        referenceId: paymentRefId.trim() || undefined,
        description: paymentDescription.trim() || undefined,
        chequeDetails: paymentType === 'cheque_payment' ? chequeForm : undefined,
        allocations: allocationsPayload.length > 0 ? allocationsPayload : undefined,
      });

      if (res.success) {
        showToast(res.message || 'پرداخت و تخصیص فاکتورها با موفقیت ثبت شد.', 'success');
        refreshData();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.message || 'خطا در ثبت پرداخت.', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت پرداخت.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 text-xs space-y-5 my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                <span>ثبت دریافت و پرداخت مالی</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                حساب دفتری: <strong className="text-slate-200">{profile.name}</strong>
                {accountSummary && (
                  <span className="font-mono text-emerald-400 mr-2">
                    (مانده فعلی: {formatPrice(accountSummary.current_balance)} تومان)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning if account inactive */}
        {accountSummary && !accountSummary.is_active && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-bold">حساب دفتری این ویزیتور غیرفعال است!</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                ابتدا در تب «تیم» حساب دفتری ویزیتور را فعال نمایید تا امکان ثبت سند پرداخت فراهم گردد.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Payment Method Tabs */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1.5">روش دریافت / پرداخت:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('cash_payment')}
                className={`p-2.5 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  paymentType === 'cash_payment'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>نقدی (دریافت نقدی)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('bank_transfer')}
                className={`p-2.5 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  paymentType === 'bank_transfer'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>بانکی (کارت / حواله / پوز)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('cheque_payment')}
                className={`p-2.5 rounded-xl border text-center font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  paymentType === 'cheque_payment'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>چک صیادی</span>
              </button>
            </div>
          </div>

          {/* 2. Amount and Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                مبلغ پرداختی (تومان) <span className="text-rose-400">*</span>:
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="مثال: ۵,۰۰۰,۰۰۰"
                  className="w-full p-2.5 pr-3 pl-12 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono text-sm font-bold focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute left-3 top-2.5 text-slate-500 text-[11px]">تومان</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {paymentType === 'cheque_payment' ? 'شماره پیگیری / اندیکاتور' : 'شماره ارجاع / پیگیری فیش بانکی'}:
              </label>
              <input
                type="text"
                value={paymentRefId}
                onChange={(e) => setPaymentRefId(e.target.value)}
                placeholder="اختیاری - شماره تراکنش یا رسید"
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 3. Cheque Details if Cheque */}
          {paymentType === 'cheque_payment' && (
            <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-3 animate-in fade-in">
              <h4 className="font-bold text-xs text-purple-300 flex items-center gap-1.5 border-b border-purple-500/20 pb-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>مشخصات چک صیادی</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    شماره سریال چک <span className="text-rose-400">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={chequeForm.cheque_number}
                    onChange={(e) => setChequeForm({ ...chequeForm, cheque_number: e.target.value })}
                    placeholder="شماره سریال چک"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">شناسه ۱۶ رقمی صیاد:</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={chequeForm.sayad_number || ''}
                    onChange={(e) => setChequeForm({ ...chequeForm, sayad_number: e.target.value })}
                    placeholder="شناسه ۱۶ رقمی صیادی"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    نام بانک عهده <span className="text-rose-400">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={chequeForm.bank_name}
                    onChange={(e) => setChequeForm({ ...chequeForm, bank_name: e.target.value })}
                    placeholder="مثال: بانک ملت"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">شعبه بانک:</label>
                  <input
                    type="text"
                    value={chequeForm.branch_name || ''}
                    onChange={(e) => setChequeForm({ ...chequeForm, branch_name: e.target.value })}
                    placeholder="نام یا کد شعبه"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    صاحب حساب <span className="text-rose-400">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={chequeForm.account_owner}
                    onChange={(e) => setChequeForm({ ...chequeForm, account_owner: e.target.value })}
                    placeholder="نام صادرکننده چک"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    تاریخ سررسید <span className="text-rose-400">*</span>:
                  </label>
                  <input
                    type="date"
                    required
                    value={chequeForm.due_date}
                    onChange={(e) => setChequeForm({ ...chequeForm, due_date: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. Allocations Table: Multi-Invoice Allocation */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                <h4 className="font-bold text-xs text-slate-200">
                  تخصیص مبلغ به فاکتورهای بارگیری ({profileBills.length} فاکتور موجود)
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  جمع تخصیص یافته: <strong className="font-mono text-blue-400 font-bold">{formatPrice(totalAllocated)}</strong> تومان
                </span>
                {unallocatedAmount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    باقی‌مانده: {formatPrice(unallocatedAmount)} (بستانکاری در مانده)
                  </span>
                )}
                {isOverAllocated && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                    کسری: {formatPrice(totalAllocated - parsedPaymentAmount)} تومان مازاد!
                  </span>
                )}
              </div>
            </div>

            {profileBills.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-400 text-xs">
                هیچ فاکتور نهایی‌شده‌ای برای این ویزیتور ثبت نشده است. کل مبلغ به عنوان بستانکاری در مانده حساب ذخیره خواهد شد.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/80">
                {profileBills.map((bill) => {
                  const billAmt = Number(bill.total_visitor_cost || 0);
                  const remDue = bill.settlement.remainingDue;
                  const isSettled = remDue <= 0;
                  const currentAlloc = selectedAllocations[bill.id] || 0;

                  return (
                    <div
                      key={bill.id}
                      className={`p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs transition ${
                        currentAlloc > 0 ? 'bg-blue-950/25 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-100">
                            {bill.invoice_no || bill.id}
                          </span>
                          {bill.id === defaultInvoiceId && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-300 font-bold">
                              فاکتور انتخابی
                            </span>
                          )}
                          {isSettled ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/15 text-emerald-400 font-bold">
                              تسویه کامل
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/15 text-amber-300 font-bold">
                              معوق: {formatPrice(remDue)} تومان
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-3">
                          <span>مبلغ کل: {formatPrice(billAmt)} تومان</span>
                          <span>پرداخت شده: {formatPrice(bill.settlement.totalPaid)} تومان</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max={remDue}
                          value={currentAlloc > 0 ? currentAlloc : ''}
                          onChange={(e) => handleAllocationChange(bill.id, Number(e.target.value) || 0)}
                          placeholder="تخصیص (تومان)"
                          disabled={isSettled}
                          className="w-28 p-1.5 text-center rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-400 disabled:opacity-40"
                        />

                        {!isSettled && (
                          <button
                            type="button"
                            onClick={() => handleQuickAllocateBill(bill.id)}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white font-bold text-[11px] transition cursor-pointer"
                            title="تخصیص معوق به فاکتور"
                          >
                            کل معوق
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Description */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">توضیحات و یادداشت مالی:</label>
            <input
              type="text"
              value={paymentDescription}
              onChange={(e) => setPaymentDescription(e.target.value)}
              placeholder="شرح سند یا توضیحات تکمیلی..."
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <div className="text-[11px] text-slate-400">
              {parsedPaymentAmount > 0 && (
                <span>
                  مبلغ ثبت سند: <strong className="font-mono text-emerald-400 font-bold">{formatPrice(parsedPaymentAmount)}</strong> تومان
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting || parsedPaymentAmount <= 0 || isOverAllocated || (accountSummary && !accountSummary.is_active)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span>در حال ثبت پرداخت...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تایید و ثبت سند مالی</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
