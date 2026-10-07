import React, { useState, useMemo } from 'react';
import {
  FinancialAccount,
  AccountTransaction,
  Cheque,
  LoadingBill,
  Visitor,
  Supermarket,
  ChequeStatus,
  ChequeDetailsInput,
  PaymentAllocationInput,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { formatPrice } from './helpers';
import {
  X,
  CreditCard,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Ban,
  Check,
  Calendar,
  Layers,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  Hash,
  Building,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface AccountLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string | null;
}

export const AccountLedgerModal: React.FC<AccountLedgerModalProps> = ({
  isOpen,
  onClose,
  profileId,
}) => {
  const {
    visitors,
    supermarkets,
    loadingBills,
    financialAccounts,
    accountTransactions,
    cheques,
    paymentAllocations,
    activateFinancialAccount,
    deactivateFinancialAccount,
    recordFinancialPayment,
    updateChequeStatus,
    manualFinancialEntry,
    getAccountSummary,
    getInvoiceSettlementStatus,
    showToast,
  } = useApp();

  // Active Tab inside Ledger
  const [activeTab, setActiveTab] = useState<'journal' | 'invoices' | 'cheques'>('journal');

  // Modals for the two primary financial operations
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false); // دریافت از طرف حساب
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);         // پرداخت به طرف حساب
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);

  // Form states
  const [creditLimitInput, setCreditLimitInput] = useState<number | ''>(50000000);
  const [notesInput, setNotesInput] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Receive From Counterparty Form states (دریافت از طرف حساب)
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
  // Allocations to invoices in receive modal
  const [selectedAllocations, setSelectedAllocations] = useState<Record<string, number>>({});

  // 2. Pay To Counterparty Form states (پرداخت به طرف حساب)
  const [payoutMethod, setPayoutMethod] = useState<'bank_transfer' | 'cash_payment'>('bank_transfer');
  const [payoutAmount, setPayoutAmount] = useState<number | ''>('');
  const [payoutRefId, setPayoutRefId] = useState('');
  const [payoutDescription, setPayoutDescription] = useState('');

  // Cheque action state (clearing / returning / cancelling)
  const [selectedChequeForAction, setSelectedChequeForAction] = useState<Cheque | null>(null);
  const [chequeActionType, setChequeActionType] = useState<'cleared' | 'returned' | 'cancelled' | null>(null);
  const [chequeActionReason, setChequeActionReason] = useState('');

  // Filtering inside journal
  const [txFilterType, setTxFilterType] = useState<string>('all');
  const [txSearchQuery, setTxSearchQuery] = useState('');

  // Lookups
  const targetVisitor = useMemo(() => visitors.find((v) => v.id === profileId), [visitors, profileId]);
  const targetSupermarket = useMemo(() => supermarkets.find((s) => s.id === profileId), [supermarkets, profileId]);
  const personName = targetVisitor?.name || targetSupermarket?.name || 'کاربر سیستم';
  const personPhone = targetVisitor?.phone || targetSupermarket?.phone || '';
  const personRole = targetVisitor ? 'ویزیتور' : targetSupermarket ? 'سوپرمارکت' : 'کاربر';

  // Account
  const account = useMemo(
    () => financialAccounts.find((a) => a.profile_id === profileId),
    [financialAccounts, profileId]
  );
  const isAccountActive = account?.is_active || false;

  // Account Summary calculation
  const summary = useMemo(() => {
    if (!profileId) return null;
    return getAccountSummary(profileId);
  }, [profileId, getAccountSummary, financialAccounts, accountTransactions]);

  // Account's transactions
  const accountTxs = useMemo(() => {
    if (!profileId) return [];
    return accountTransactions
      .filter((tx) => (account ? tx.account_id === account.id : tx.profile_id === profileId))
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }, [accountTransactions, account, profileId]);

  // Filtered transactions
  const filteredTxs = useMemo(() => {
    return accountTxs.filter((tx) => {
      if (txFilterType !== 'all' && tx.transaction_type !== txFilterType) return false;
      if (txSearchQuery) {
        const q = txSearchQuery.toLowerCase();
        const matchDesc = tx.description?.toLowerCase().includes(q);
        const matchRef = tx.reference_id?.toLowerCase().includes(q);
        const matchType = tx.transaction_type.toLowerCase().includes(q);
        if (!matchDesc && !matchRef && !matchType) return false;
      }
      return true;
    });
  }, [accountTxs, txFilterType, txSearchQuery]);

  // Cheques for this account
  const accountCheques = useMemo(() => {
    if (!profileId) return [];
    return cheques
      .filter((c) => (account ? c.account_id === account.id : c.profile_id === profileId))
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
  }, [cheques, account, profileId]);

  // Invoices for this visitor (loading bills)
  const visitorBills = useMemo(() => {
    if (!profileId) return [];
    return loadingBills
      .filter((b) => b.visitor_id === profileId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [loadingBills, profileId]);

  // Unsettled invoices for allocation in payment modal
  const unsettledInvoices = useMemo(() => {
    return visitorBills.map((bill) => {
      const { totalPaid, remainingDue, status } = getInvoiceSettlementStatus(
        bill.id,
        Number(bill.total_visitor_cost || 0)
      );
      return {
        ...bill,
        totalPaid,
        remainingDue,
        settlementStatus: status,
      };
    });
  }, [visitorBills, getInvoiceSettlementStatus]);

  if (!isOpen || !profileId) return null;

  // Handle Activate Account
  const handleConfirmActivate = async () => {
    setIsSubmitting(true);
    try {
      const res = await activateFinancialAccount(profileId, Number(creditLimitInput) || 0, notesInput);
      if (res.success) {
        showToast(res.message, 'success');
        setIsActivateModalOpen(false);
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deactivate Account
  const handleConfirmDeactivate = async () => {
    if (!account) return;
    setIsSubmitting(true);
    try {
      const res = await deactivateFinancialAccount(account.id, deactivateReason);
      if (res.success) {
        showToast(res.message, 'success');
        setIsDeactivateConfirmOpen(false);
        setDeactivateReason('');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Auto-Allocate Payment to Oldest Invoices
  const handleAutoAllocate = (amountToAllocate: number) => {
    let rem = amountToAllocate;
    const newAllocs: Record<string, number> = {};

    // Sort by created_at ascending (oldest first)
    const unpaidOldest = [...unsettledInvoices]
      .filter((inv) => inv.remainingDue > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const inv of unpaidOldest) {
      if (rem <= 0) break;
      const allocAmt = Math.min(rem, inv.remainingDue);
      newAllocs[inv.id] = allocAmt;
      rem -= allocAmt;
    }

    setSelectedAllocations(newAllocs);
  };

  // 1. Handle Submit Receive from counterparty (دریافت از طرف حساب)
  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      showToast('لطفاً مبلغ معتبر برای دریافت وارد کنید.', 'warning');
      return;
    }

    if (paymentType === 'cheque_payment') {
      if (!chequeForm.cheque_number.trim() || !chequeForm.bank_name.trim() || !chequeForm.account_owner.trim()) {
        showToast('لطفاً مشخصات الزامی چک (شماره چک، نام بانک و صاحب حساب) را تکمیل کنید.', 'warning');
        return;
      }
    }

    // Prepare allocations array
    const allocArray: PaymentAllocationInput[] = Object.entries(selectedAllocations)
      .filter(([_, amt]) => amt > 0)
      .map(([invId, amt]) => ({ invoice_id: invId, amount: amt }));

    setIsSubmitting(true);
    try {
      const res = await recordFinancialPayment({
        profileId,
        paymentType,
        amount,
        referenceId: paymentRefId.trim() || undefined,
        description: paymentDescription.trim() || undefined,
        chequeDetails: paymentType === 'cheque_payment' ? chequeForm : undefined,
        allocations: allocArray.length > 0 ? allocArray : undefined,
      });

      if (res.success) {
        showToast(res.message || 'دریافت از طرف حساب با موفقیت ثبت شد.', 'success');
        setIsReceiveModalOpen(false);
        setPaymentAmount('');
        setPaymentRefId('');
        setPaymentDescription('');
        setSelectedAllocations({});
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Handle Submit Payout to counterparty (پرداخت به طرف حساب)
  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) {
      showToast('لطفاً مبلغ معتبر برای پرداخت وارد کنید.', 'warning');
      return;
    }
    if (!payoutDescription.trim()) {
      showToast('لطفاً بابت و شرح پرداخت را وارد کنید.', 'warning');
      return;
    }

    const methodLabel = payoutMethod === 'bank_transfer' ? 'حواله / کارت بانکی' : 'پرداخت نقدی';
    const fullDesc = `پرداخت به طرف حساب (${methodLabel}): ${payoutDescription.trim()}`;

    setIsSubmitting(true);
    try {
      const res = await manualFinancialEntry({
        profileId,
        type: 'manual_debit',
        amount,
        description: fullDesc,
        referenceId: payoutRefId.trim() || undefined,
        entryType: 'debit',
      });

      if (res.success) {
        showToast(res.message || 'پرداخت به طرف حساب با موفقیت ثبت شد.', 'success');
        setIsPayModalOpen(false);
        setPayoutAmount('');
        setPayoutRefId('');
        setPayoutDescription('');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cheque Status Change Submit
  const handleConfirmChequeStatus = async () => {
    if (!selectedChequeForAction || !chequeActionType) return;
    setIsSubmitting(true);
    try {
      const res = await updateChequeStatus(
        selectedChequeForAction.id,
        chequeActionType,
        chequeActionReason.trim()
      );
      if (res.success) {
        showToast(res.message, 'success');
        setSelectedChequeForAction(null);
        setChequeActionType(null);
        setChequeActionReason('');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice_debt':
        return 'بدهی فاکتور';
      case 'cash_payment':
        return 'دریافت نقدی';
      case 'bank_transfer':
        return 'دریافت حواله / کارت';
      case 'cheque_payment':
        return 'دریافت با چک';
      case 'manual_debit':
        return 'پرداخت به طرف حساب';
      case 'manual_credit':
        return 'دریافت از طرف حساب';
      case 'refund':
        return 'برگشت وجه';
      case 'cheque_return':
        return 'برگشت چک';
      case 'account_adjustment':
        return 'تعدیل حساب';
      case 'opening_balance':
        return 'مانده اولیه';
      default:
        return type;
    }
  };

  const getChequeStatusBadge = (status: ChequeStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            در جریان وصول
          </span>
        );
      case 'cleared':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            وصول شده (پاس شد)
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            برگشت خورده
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/30">
            <Ban className="w-3 h-3" />
            ابطال شده
          </span>
        );
    }
  };

  const currentBalance = summary?.current_balance ?? 0;
  const isDebtor = currentBalance > 0;
  const isCreditor = currentBalance < 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col my-auto max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-inner">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-100">{personName}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-blue-900/40 text-blue-300 border border-blue-800/40 font-semibold">
                  {personRole}
                </span>
                {isAccountActive ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    حساب فعال
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    حساب غیرفعال
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span className="font-mono">{personPhone}</span>
                {account && (
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700/50">
                    شماره حساب: {account.account_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Activate / Deactivate Button & Close */}
          <div className="flex items-center gap-2">
            {!isAccountActive ? (
              <button
                type="button"
                onClick={() => setIsActivateModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>فعال‌سازی حساب</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsDeactivateConfirmOpen(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>غیرفعال‌سازی حساب</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Account Summary Cards */}
        <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Card 1: Unified Net Balance (مانده حساب) */}
          <div
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
              isDebtor
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                : isCreditor
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-blue-400" />
                  مانده حساب
                </span>
                {isDebtor ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                    بدهکار به شرکت
                  </span>
                ) : isCreditor ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    بستانکار از شرکت
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                    تسویه کامل
                  </span>
                )}
              </div>

              <div className="my-1.5">
                {isDebtor ? (
                  <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 flex items-baseline gap-1.5 flex-wrap">
                    <span>{formatPrice(currentBalance)}</span>
                    <span className="text-sm font-bold text-rose-400">تومان بدهکاری</span>
                  </div>
                ) : isCreditor ? (
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 flex items-baseline gap-1.5 flex-wrap">
                    <span>{formatPrice(Math.abs(currentBalance))}</span>
                    <span className="text-sm font-bold text-emerald-400">تومان بستانکاری</span>
                  </div>
                ) : (
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 flex items-baseline gap-1.5">
                    <span>تسویه</span>
                    <span className="text-xs font-normal text-slate-400">(مانده حساب: ۰ تومان)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Combined breakdown summary of debit vs credit */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400 pt-2.5 mt-2 border-t border-slate-800/80">
              <span className="flex items-center gap-1">
                <span className="text-slate-500">جمع بدهکاری (فاکتورها و...):</span>
                <span className="font-mono text-rose-400 font-semibold">{formatPrice(summary?.total_debit ?? 0)} تومان</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500">جمع بستانکاری (پرداخت‌ها):</span>
                <span className="font-mono text-emerald-400 font-semibold">{formatPrice(summary?.total_credit ?? 0)} تومان</span>
              </span>
            </div>
          </div>

          {/* Card 2: Pending Cheques Amount */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  چک‌های در جریان وصول
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                  نزد صندوق
                </span>
              </div>
              <div className="my-1.5 text-xl sm:text-2xl font-black font-mono text-amber-400 flex items-baseline gap-1.5">
                <span>
                  {formatPrice(
                    accountCheques.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.amount || 0), 0)
                  )}
                </span>
                <span className="text-xs font-normal text-slate-400">تومان</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2.5 mt-2 border-t border-slate-800/80">
              <span className="text-slate-500">تعداد چک‌های ثبت‌شده در انتظار سررسید:</span>
              <span className="font-mono text-amber-300 font-bold">
                {accountCheques.filter((c) => c.status === 'pending').length} فقره چک
              </span>
            </div>
          </div>
        </div>

        {/* Action Toolbar & Navigation Tabs */}
        <div className="px-4 sm:px-5 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs switch */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('journal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'journal'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>گردش‌های مالی ({accountTxs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'invoices'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>فاکتورها و تسویه‌ها ({visitorBills.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cheques')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'cheques'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>چک‌ها ({accountCheques.length})</span>
            </button>
          </div>

          {/* Action Buttons (Strictly only the 2 primary operations: دریافت از طرف حساب و پرداخت به طرف حساب) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Button 1: دریافت از طرف حساب */}
            <button
              type="button"
              disabled={!isAccountActive}
              onClick={() => {
                if (!isAccountActive) {
                  showToast('حساب دفتری غیرفعال است. ابتدا آن را فعال کنید.', 'warning');
                  return;
                }
                setIsReceiveModalOpen(true);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isAccountActive
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
              title={!isAccountActive ? 'ثبت تراکنش برای حساب غیرفعال مجاز نیست' : 'طرف حساب به ما پول پرداخت می‌کند (کاهش بدهی یا ثبت بستانکاری مازاد)'}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>دریافت از طرف حساب</span>
            </button>

            {/* Button 2: پرداخت به طرف حساب */}
            <button
              type="button"
              disabled={!isAccountActive}
              onClick={() => {
                if (!isAccountActive) {
                  showToast('حساب دفتری غیرفعال است. ابتدا آن را فعال کنید.', 'warning');
                  return;
                }
                setIsPayModalOpen(true);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isAccountActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
              title={!isAccountActive ? 'ثبت تراکنش برای حساب غیرفعال مجاز نیست' : 'ما به طرف حساب پول پرداخت می‌کنیم (کاهش بستانکاری یا افزایش بدهی)'}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>پرداخت به طرف حساب</span>
            </button>
          </div>
        </div>

        {/* TAB 1: JOURNAL / TRANSACTIONS LIST */}
        {activeTab === 'journal' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Search and Filter for Transactions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجو در شرح سند، شماره فیش و..."
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={txFilterType}
                  onChange={(e) => setTxFilterType(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">همه انواع گردش‌ها</option>
                  <option value="invoice_debt">بدهی فاکتور</option>
                  <option value="cash_payment">دریافت نقدی</option>
                  <option value="bank_transfer">دریافت حواله / کارت</option>
                  <option value="cheque_payment">دریافت با چک</option>
                  <option value="manual_debit">پرداخت به طرف حساب</option>
                  <option value="manual_credit">دریافت از طرف حساب</option>
                  <option value="cheque_return">برگشت چک</option>
                  <option value="account_adjustment">تعدیل حساب</option>
                </select>
              </div>
            </div>

            {/* Transactions Table */}
            {filteredTxs.length === 0 ? (
              <div className="p-12 text-center bg-slate-950 rounded-2xl border border-slate-800">
                <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-200">هیچ گردشی در دفتر این حساب یافت نشد</p>
                <p className="text-xs text-slate-400 mt-1">تراکنش‌های ثبت‌شده، فاکتورها و دریافت/پرداخت‌ها در اینجا فهرست می‌شوند.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="p-3 font-semibold">تاریخ و زمان</th>
                      <th className="p-3 font-semibold">نوع عملیات</th>
                      <th className="p-3 font-semibold">شرح سند / پیگیری</th>
                      <th className="p-3 font-semibold text-rose-400">بدهکار (پرداخت به وی / بدهی)</th>
                      <th className="p-3 font-semibold text-emerald-400">بستانکار (دریافت از وی / تسویه)</th>
                      <th className="p-3 font-semibold">ثبت‌کننده</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {filteredTxs.map((tx) => {
                      const isDebit = tx.entry_type === 'debit';
                      const isCredit = tx.entry_type === 'credit';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-900/50 transition">
                          <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {new Date(tx.transaction_date).toLocaleDateString('fa-IR')}
                            <span className="text-[10px] text-slate-400 mr-1.5">
                              {new Date(tx.transaction_date).toLocaleTimeString('fa-IR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                isDebit
                                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              }`}
                            >
                              {getTransactionTypeLabel(tx.transaction_type)}
                            </span>
                          </td>
                          <td className="p-3 max-w-[280px]">
                            <div className="font-medium text-slate-100 truncate">{tx.description || '-'}</div>
                            {tx.reference_id && (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                کد پیگیری: {tx.reference_id}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-rose-400 whitespace-nowrap">
                            {isDebit ? formatPrice(tx.amount) : '-'}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {isCredit ? formatPrice(tx.amount) : '-'}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                            {tx.created_by_name || 'سیستم'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INVOICES & SETTLEMENTS */}
        {activeTab === 'invoices' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <span>
                فهرست حواله‌ها و فاکتورهای بارگیری این ویزیتور و میزان تسویه هر فاکتور:
              </span>
              <span className="text-slate-400 font-bold">{visitorBills.length} فاکتور ثبت‌شده</span>
            </div>

            {unsettledInvoices.length === 0 ? (
              <div className="p-12 text-center bg-slate-950 rounded-2xl border border-slate-800">
                <Layers className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-200">هیچ فاکتوری برای این ویزیتور ثبت نشده است.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="p-3 font-semibold">شماره فاکتور</th>
                      <th className="p-3 font-semibold">تاریخ ثبت</th>
                      <th className="p-3 font-semibold">وضعیت فاکتور</th>
                      <th className="p-3 font-semibold">مبلغ کل فاکتور</th>
                      <th className="p-3 font-semibold text-emerald-400">مجموع پرداختی</th>
                      <th className="p-3 font-semibold text-rose-400">معوق همان فاکتور</th>
                      <th className="p-3 font-semibold">وضعیت تسویه</th>
                      <th className="p-3 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {unsettledInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3 font-bold text-blue-400 font-mono">
                          {inv.invoice_no || inv.id}
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          {new Date(inv.created_at).toLocaleDateString('fa-IR')}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">
                            {inv.status === 'loaded' ? 'بارگیری شده' : inv.status === 'approved' ? 'تایید انبار' : inv.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold">
                          {formatPrice(inv.total_visitor_cost || 0)} تومان
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          {formatPrice(inv.totalPaid)} تومان
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-400">
                          {formatPrice(inv.remainingDue)} تومان
                        </td>
                        <td className="p-3">
                          {inv.settlementStatus === 'settled' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              تسویه کامل
                            </span>
                          ) : inv.settlementStatus === 'partially_paid' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              پرداخت ناقص
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              پرداخت نشده
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {inv.remainingDue > 0 && isAccountActive && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentAmount(inv.remainingDue);
                                setSelectedAllocations({ [inv.id]: inv.remainingDue });
                                setPaymentDescription(`تسویه فاکتور ${inv.invoice_no || inv.id}`);
                                setIsReceiveModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition cursor-pointer"
                            >
                              دریافت وجه فاکتور
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CHEQUES MANAGEMENT */}
        {activeTab === 'cheques' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <span>مدیریت چک‌های صیادی و عادی دریافت‌شده از این ویزیتور:</span>
              <span className="text-slate-400 font-bold">{accountCheques.length} فقره چک</span>
            </div>

            {accountCheques.length === 0 ? (
              <div className="p-12 text-center bg-slate-950 rounded-2xl border border-slate-800">
                <CreditCard className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-200">هیچ چکی برای این حساب ثبت نشده است.</p>
                <p className="text-xs text-slate-400 mt-1">
                  در زمان ثبت پرداخت با انتخاب نوع «پرداخت با چک»، چک به این لیست اضافه خواهد شد.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="p-3 font-semibold">شماره چک</th>
                      <th className="p-3 font-semibold">شناسه صیادی</th>
                      <th className="p-3 font-semibold">بانک و شعبه</th>
                      <th className="p-3 font-semibold">صاحب حساب</th>
                      <th className="p-3 font-semibold">تاریخ سررسید</th>
                      <th className="p-3 font-semibold">مبلغ چک</th>
                      <th className="p-3 font-semibold">وضعیت</th>
                      <th className="p-3 font-semibold text-center">اقدامات ادمین</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {accountCheques.map((chk) => (
                      <tr key={chk.id} className="hover:bg-slate-900/50 transition">
                        <td className="p-3 font-bold font-mono text-blue-400">{chk.cheque_number}</td>
                        <td className="p-3 font-mono text-slate-300">{chk.sayad_number || '-'}</td>
                        <td className="p-3">
                          <span className="font-semibold">{chk.bank_name}</span>
                          {chk.branch_name && <span className="text-slate-400 text-[11px] mr-1">({chk.branch_name})</span>}
                        </td>
                        <td className="p-3">{chk.account_owner}</td>
                        <td className="p-3 font-mono font-bold text-amber-400">
                          {new Date(chk.due_date).toLocaleDateString('fa-IR')}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {formatPrice(chk.amount)} تومان
                        </td>
                        <td className="p-3 whitespace-nowrap">{getChequeStatusBadge(chk.status)}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {chk.status === 'pending' && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedChequeForAction(chk);
                                  setChequeActionType('cleared');
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                                title="ثبت وصول چک"
                              >
                                وصول شد
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedChequeForAction(chk);
                                  setChequeActionType('returned');
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                                title="برگشت چک"
                              >
                                برگشت
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedChequeForAction(chk);
                                  setChequeActionType('cancelled');
                                }}
                                className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer"
                                title="ابطال چک"
                              >
                                ابطال
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* OPERATION 1: RECEIVE FROM COUNTERPARTY (دریافت از طرف حساب)                */}
        {/* ========================================================================= */}
        {isReceiveModalOpen && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm overflow-y-auto"
            onClick={() => setIsReceiveModalOpen(false)}
          >
            <div
              className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <span>دریافت از طرف حساب</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      کاهش بدهی یا ثبت بستانکاری مازاد - طرف حساب: <strong className="text-slate-200">{personName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Account Status Info Box */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">مانده کل حساب پیش از دریافت:</span>
                <span className="font-mono font-bold">
                  {isDebtor ? (
                    <span className="text-rose-400">{formatPrice(currentBalance)} تومان بدهکار به شرکت</span>
                  ) : isCreditor ? (
                    <span className="text-emerald-400">{formatPrice(Math.abs(currentBalance))} تومان بستانکار از شرکت</span>
                  ) : (
                    <span className="text-slate-400">تسویه کامل (۰ تومان)</span>
                  )}
                </span>
              </div>

              <form onSubmit={handleSubmitReceive} className="space-y-4">
                {/* Method selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">روش پرداخت</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType('cash_payment')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        paymentType === 'cash_payment'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      پرداخت نقدی
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('bank_transfer')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        paymentType === 'bank_transfer'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      حواله / کارت‌به‌کارت
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('cheque_payment')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        paymentType === 'cheque_payment'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      پرداخت با چک
                    </button>
                  </div>
                </div>

                {/* Amount and Ref */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      مبلغ پرداختی (تومان) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setPaymentAmount(val);
                        if (typeof val === 'number' && val > 0) {
                          handleAutoAllocate(val);
                        }
                      }}
                      placeholder="مثال: 50000000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                      required
                    />
                    {typeof paymentAmount === 'number' && paymentAmount > 0 && (
                      <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                        {formatPrice(paymentAmount)} تومان
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">شماره سند / کد پیگیری</label>
                    <input
                      type="text"
                      value={paymentRefId}
                      onChange={(e) => setPaymentRefId(e.target.value)}
                      placeholder="مثال: 948271 یا فیش شماره..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Cheque Specific Fields */}
                {paymentType === 'cheque_payment' && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <h5 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" />
                      <span>مشخصات چک دریافتی</span>
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          شماره سریال چک <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={chequeForm.cheque_number}
                          onChange={(e) => setChequeForm({ ...chequeForm, cheque_number: e.target.value })}
                          placeholder="مثال: 123456/78"
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-100"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">شناسه صیادی ۱۶ رقمی</label>
                        <input
                          type="text"
                          maxLength={16}
                          value={chequeForm.sayad_number || ''}
                          onChange={(e) => setChequeForm({ ...chequeForm, sayad_number: e.target.value })}
                          placeholder="کد ۱۶ رقمی صیادی"
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          نام بانک <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={chequeForm.bank_name}
                          onChange={(e) => setChequeForm({ ...chequeForm, bank_name: e.target.value })}
                          placeholder="مثال: بانک ملت، ملی، صادرات..."
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">نام شعبه</label>
                        <input
                          type="text"
                          value={chequeForm.branch_name || ''}
                          onChange={(e) => setChequeForm({ ...chequeForm, branch_name: e.target.value })}
                          placeholder="مثال: شعبه مرکزی"
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          صاحب حساب / صادرکننده <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={chequeForm.account_owner}
                          onChange={(e) => setChequeForm({ ...chequeForm, account_owner: e.target.value })}
                          placeholder="نام و نام خانوادگی صادرکننده"
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          تاریخ سررسید <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={chequeForm.due_date}
                          onChange={(e) => setChequeForm({ ...chequeForm, due_date: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-100"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Allocation Section */}
                {unsettledInvoices.filter((i) => i.remainingDue > 0).length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        <span>تخصیص به فاکتورهای معوق (اختیاری)</span>
                      </span>
                      {typeof paymentAmount === 'number' && paymentAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAutoAllocate(paymentAmount)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                        >
                          تخصیص خودکار به قدیمی‌ترین
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {unsettledInvoices
                        .filter((inv) => inv.remainingDue > 0)
                        .map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-200">{inv.invoice_no || inv.id}</span>
                              <span className="text-slate-400 text-[11px] mr-2">
                                (معوق: {formatPrice(inv.remainingDue)} ت)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                placeholder="مبلغ تخصیص"
                                value={selectedAllocations[inv.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  setSelectedAllocations({
                                    ...selectedAllocations,
                                    [inv.id]: Math.min(val, inv.remainingDue),
                                  });
                                }}
                                className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-left"
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">توضیحات</label>
                  <textarea
                    rows={2}
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    placeholder="توضیحات اختیاری سند پرداخت..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'در حال ثبت...' : 'ثبت دریافت از طرف حساب'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OPERATION 2: PAY TO COUNTERPARTY (پرداخت به طرف حساب)                      */}
        {/* ========================================================================= */}
        {isPayModalOpen && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm overflow-y-auto"
            onClick={() => setIsPayModalOpen(false)}
          >
            <div
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <span>پرداخت به طرف حساب</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      خروج وجه از شرکت (کاهش بستانکاری / افزایش بدهی) - طرف حساب: <strong className="text-slate-200">{personName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dynamic Balance Impact Explainer */}
              <div
                className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                  isCreditor
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : isDebtor
                    ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                {isCreditor ? (
                  <div>
                    <strong className="block mb-1 text-emerald-200">وضعیت فعلی: بستانکار ({formatPrice(Math.abs(currentBalance))} تومان)</strong>
                    طرف حساب در حال حاضر از شرکت طلبکار (بستانکار) است. پرداخت شما تا این مبلغ، طلب ایشان را تسویه خواهد کرد؛ هر مبلغ مازادی به عنوان بدهی جدید ایشان ثبت می‌گردد.
                  </div>
                ) : isDebtor ? (
                  <div>
                    <strong className="block mb-1 text-rose-200">وضعیت فعلی: بدهکار ({formatPrice(currentBalance)} تومان)</strong>
                    طرف حساب در حال حاضر به شرکت بدهکار است. پرداخت این مبلغ مستقیماً به جمع بدهی‌های ایشان به شرکت افزوده خواهد شد.
                  </div>
                ) : (
                  <div>
                    <strong className="block mb-1 text-slate-200">وضعیت فعلی: تسویه کامل (۰ تومان)</strong>
                    طرف حساب در حال حاضر بی‌حساب است. با ثبت این پرداخت، معادل همین مبلغ به عنوان بدهی ایشان به شرکت ثبت خواهد شد.
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmitPayout} className="space-y-4">
                {/* Method selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">روش پرداخت وجه</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPayoutMethod('bank_transfer')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        payoutMethod === 'bank_transfer'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      حواله / کارت‌به‌کارت بانکی
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayoutMethod('cash_payment')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        payoutMethod === 'cash_payment'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      پرداخت نقدی
                    </button>
                  </div>
                </div>

                {/* Amount and Ref */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      مبلغ پرداختی (تومان) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="مثال: 5000000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-rose-500"
                      required
                    />
                    {typeof payoutAmount === 'number' && payoutAmount > 0 && (
                      <p className="text-[11px] text-rose-400 mt-1 font-mono">
                        {formatPrice(payoutAmount)} تومان
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">شماره سند / کد پیگیری بانکی</label>
                    <input
                      type="text"
                      value={payoutRefId}
                      onChange={(e) => setPayoutRefId(e.target.value)}
                      placeholder="شماره فیش، شماره ارجاع و..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Description (Required) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    بابت و شرح پرداخت <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={payoutDescription}
                    onChange={(e) => setPayoutDescription(e.target.value)}
                    placeholder="علت پرداخت (مثلاً: تسویه طلب بستانکاری، مساعده، برگشت وجه، کارمزد و...)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsPayModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'در حال ثبت...' : 'ثبت پرداخت به طرف حساب'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: ACTIVATE ACCOUNT PROMPT */}
        {isActivateModalOpen && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsActivateModalOpen(false)}
          >
            <div
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>فعال‌سازی حساب دفتری</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsActivateModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5">
                <p className="text-xs text-slate-300 leading-relaxed">
                  با فعال‌سازی حساب دفتری برای «{personName}»، امکان ثبت فاکتورهای معوق، دریافت و پرداخت‌های نقدی و چک
                  برای ایشان فعال خواهد شد.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سقف اعتبار مجاز (تومان)</label>
                  <input
                    type="number"
                    value={creditLimitInput}
                    onChange={(e) => setCreditLimitInput(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">یادداشت اداری / توضیحات</label>
                  <textarea
                    rows={2}
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="توضیحات قرارداد، ضمانت‌نامه‌ها..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsActivateModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmActivate}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'در حال فعال‌سازی...' : 'تایید و فعال‌سازی حساب'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 5: DEACTIVATE CONFIRMATION (REQUIREMENT 3: DOES NOT DELETE HISTORY) */}
        {isDeactivateConfirmOpen && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsDeactivateConfirmOpen(false)}
          >
            <div
              className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">غیرفعال‌سازی حساب دفتری</h4>
                  <p className="text-xs text-slate-400 mt-0.5">سوابق مالی و گردش‌های قبلی حذف نخواهند شد.</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                با غیرفعال کردن این حساب، صرفاً امکان ثبت تراکنش یا فاکتور جدید تا زمان فعال‌سازی مجدد مسدود می‌شود. کلیه
                اسناد، چک‌ها و مانده بدهی/طلب قبلی عیناً در سیستم باقی خواهند ماند.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">دلیل غیرفعال‌سازی (اختیاری)</label>
                <input
                  type="text"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  placeholder="مثال: تسویه و پایان همکاری، تعلیق موقت..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDeactivateConfirmOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmDeactivate}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'تایید غیرفعال‌سازی'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 6: CHEQUE STATUS ACTION PROMPT (CLEAR / RETURN / CANCEL) */}
        {selectedChequeForAction && chequeActionType && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setSelectedChequeForAction(null);
              setChequeActionType(null);
            }}
          >
            <div
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    chequeActionType === 'cleared'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : chequeActionType === 'returned'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {chequeActionType === 'cleared' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : chequeActionType === 'returned' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Ban className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">
                    {chequeActionType === 'cleared'
                      ? 'ثبت وصول چک'
                      : chequeActionType === 'returned'
                      ? 'اعلام برگشت چک'
                      : 'ابطال چک'}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    شماره چک: {selectedChequeForAction.cheque_number} - مبلغ:{' '}
                    {formatPrice(selectedChequeForAction.amount)} تومان
                  </p>
                </div>
              </div>

              {chequeActionType === 'returned' && (
                <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 leading-relaxed">
                  توجه: با ثبت برگشت چک، مبلغ {formatPrice(selectedChequeForAction.amount)} تومان مجدداً به صورت بدهکار
                  (افزایش بدهی) در حساب شخص درج خواهد شد تا مانده حساب دقیق بماند.
                </div>
              )}

              {chequeActionType === 'returned' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">دلیل برگشت چک</label>
                  <input
                    type="text"
                    value={chequeActionReason}
                    onChange={(e) => setChequeActionReason(e.target.value)}
                    placeholder="مثال: کسر موجودی، مغایرت امضا..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChequeForAction(null);
                    setChequeActionType(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmChequeStatus}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
                    chequeActionType === 'cleared'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : chequeActionType === 'returned'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {isSubmitting ? 'در حال ثبت...' : 'تایید تغییر وضعیت'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
