import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatPrice } from './helpers';
import { AccountLedgerModal } from './AccountLedgerModal';
import {
  Wallet,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  ShieldCheck,
  ShieldAlert,
  FileText,
  CreditCard,
  Building,
  RefreshCw,
  Plus,
  Ban,
  Check,
} from 'lucide-react';

interface FinancialAccountsTabProps {
  initialProfileId?: string | null;
}

export const FinancialAccountsTab: React.FC<FinancialAccountsTabProps> = ({
  initialProfileId = null,
}) => {
  const {
    visitors,
    supermarkets,
    financialAccounts,
    accountTransactions,
    cheques,
    activateFinancialAccount,
    deactivateFinancialAccount,
    getAccountSummary,
    refreshData,
    showToast,
  } = useApp();

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debtors' | 'creditors' | 'settled'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'visitor' | 'supermarket'>('visitor');

  // Ledger Modal State
  const [selectedProfileIdForLedger, setSelectedProfileIdForLedger] = useState<string | null>(initialProfileId || null);

  useEffect(() => {
    if (initialProfileId) {
      setSelectedProfileIdForLedger(initialProfileId);
      const isSupermarket = supermarkets.some((s) => s.id === initialProfileId);
      if (isSupermarket) {
        setRoleFilter('supermarket');
      } else {
        const isVisitor = visitors.some((v) => v.id === initialProfileId);
        if (isVisitor) {
          setRoleFilter('visitor');
        }
      }
    }
  }, [initialProfileId, supermarkets, visitors]);

  // Quick Action Modal for Activation
  const [activatingProfileId, setActivatingProfileId] = useState<string | null>(null);
  const [activatingLimit, setActivatingLimit] = useState<number | ''>(50000000);
  const [isActivating, setIsActivating] = useState(false);

  // Deactivate Confirm State
  const [deactivatingAccount, setDeactivatingAccount] = useState<{ id: string; name: string } | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Compute profile summaries
  // Generic architecture: covers both visitors and supermarkets, default view focuses on visitors as requested
  const allProfiles = useMemo(() => {
    const list: Array<{ id: string; name: string; phone: string; role: 'visitor' | 'supermarket' }> = [];
    visitors.forEach((v) => list.push({ id: v.id, name: v.name, phone: v.phone, role: 'visitor' }));
    supermarkets.forEach((s) => list.push({ id: s.id, name: s.name, phone: s.phone, role: 'supermarket' }));
    return list;
  }, [visitors, supermarkets]);

  // Combined Account Rows
  const accountRows = useMemo(() => {
    return allProfiles.map((p) => {
      const summary = getAccountSummary(p.id);
      const acc = financialAccounts.find((a) => a.profile_id === p.id);
      return {
        profileId: p.id,
        name: p.name,
        phone: p.phone,
        role: p.role,
        hasAccount: Boolean(acc),
        accountId: acc?.id || '',
        accountNumber: acc?.account_number || 'فاقد حساب',
        isActive: acc?.is_active || false,
        creditLimit: acc?.credit_limit || 0,
        totalDebit: summary?.total_debit || 0,
        totalCredit: summary?.total_credit || 0,
        currentBalance: summary?.current_balance || 0,
        txCount: summary?.transactions_count || 0,
        lastTxAt: summary?.last_transaction_at || null,
      };
    });
  }, [allProfiles, financialAccounts, getAccountSummary]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return accountRows.filter((row) => {
      // Role filter
      if (roleFilter !== 'all' && row.role !== roleFilter) return false;

      // Status filter
      if (statusFilter === 'active' && !row.isActive) return false;
      if (statusFilter === 'inactive' && row.isActive) return false;

      // Balance filter
      if (balanceFilter === 'debtors' && row.currentBalance <= 0) return false;
      if (balanceFilter === 'creditors' && row.currentBalance >= 0) return false;
      if (balanceFilter === 'settled' && row.currentBalance !== 0) return false;

      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchName = row.name.toLowerCase().includes(q);
        const matchPhone = row.phone.includes(q);
        const matchAcc = row.accountNumber.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchAcc) return false;
      }

      return true;
    });
  }, [accountRows, roleFilter, statusFilter, balanceFilter, searchTerm]);

  // Overall Statistics KPI
  const stats = useMemo(() => {
    const activeAccs = accountRows.filter((r) => r.isActive);
    const totalDebits = activeAccs.reduce((sum, r) => sum + r.totalDebit, 0);
    const totalCredits = activeAccs.reduce((sum, r) => sum + r.totalCredit, 0);
    // Net company receivables (from debtors)
    const companyReceivables = activeAccs
      .filter((r) => r.currentBalance > 0)
      .reduce((sum, r) => sum + r.currentBalance, 0);
    const pendingChequesAmount = cheques
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    return {
      totalAccountsCount: accountRows.length,
      activeAccountsCount: activeAccs.length,
      inactiveAccountsCount: accountRows.length - activeAccs.length,
      totalDebits,
      totalCredits,
      companyReceivables,
      pendingChequesAmount,
    };
  }, [accountRows, cheques]);

  // Handle Quick Activate Submit
  const handleQuickActivate = async () => {
    if (!activatingProfileId) return;
    setIsActivating(true);
    try {
      const res = await activateFinancialAccount(activatingProfileId, Number(activatingLimit) || 0);
      if (res.success) {
        showToast(res.message, 'success');
        setActivatingProfileId(null);
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsActivating(false);
    }
  };

  // Handle Quick Deactivate Submit
  const handleQuickDeactivate = async () => {
    if (!deactivatingAccount) return;
    setIsDeactivating(true);
    try {
      const res = await deactivateFinancialAccount(deactivatingAccount.id, deactivateReason);
      if (res.success) {
        showToast(res.message, 'success');
        setDeactivatingAccount(null);
        setDeactivateReason('');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="space-y-6 select-text" dir="rtl">
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Net Receivables (مطالبات شرکت از بدهکاران) */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>کل مطالبات شرکت (بدهکاران)</span>
            <ArrowDownLeft className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
            {formatPrice(stats.companyReceivables)}
            <span className="text-xs font-normal text-slate-400 mr-1">تومان</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">جمع مانده بدهی ویزیتورها به پخش مرکزی</p>
        </div>

        {/* KPI 2: Pending Cheques Amount */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>چک‌های در جریان وصول</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            {formatPrice(stats.pendingChequesAmount)}
            <span className="text-xs font-normal text-slate-400 mr-1">تومان</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {cheques.filter((c) => c.status === 'pending').length} فقره چک نزد صندوق
          </p>
        </div>

        {/* KPI 3: Total Credits (پرداختی‌های ثبت‌شده) */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>مجموع دریافتی‌ها و بستانکاری</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {formatPrice(stats.totalCredits)}
            <span className="text-xs font-normal text-slate-400 mr-1">تومان</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">کلیه پرداخت‌های نقدی، بانکی و چک</p>
        </div>

        {/* KPI 4: Active Accounts Count */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span>وضعیت دفاتر حساب</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-100">
            {stats.activeAccountsCount}
            <span className="text-xs font-normal text-slate-400 mr-1">حساب فعال</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{stats.inactiveAccountsCount} حساب در وضعیت غیرفعال</p>
        </div>
      </div>

      {/* Control Toolbar (Search, Filter, Actions) */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو با نام ویزیتور، شماره موبایل، شماره حساب دفتری..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Role Filter Switch */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setRoleFilter('visitor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'visitor' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ویزیتورها ({accountRows.filter((r) => r.role === 'visitor').length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('supermarket')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'supermarket' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              سوپرمارکت‌ها ({accountRows.filter((r) => r.role === 'supermarket').length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                roleFilter === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              همه نقش‌ها
            </button>
          </div>

          {/* Status & Balance Dropdowns */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">تمام وضعیت‌های حساب</option>
              <option value="active">فقط حساب‌های فعال</option>
              <option value="inactive">فقط حساب‌های غیرفعال</option>
            </select>

            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">تمام ترازها</option>
              <option value="debtors">فقط بدهکاران به شرکت</option>
              <option value="creditors">فقط بستانکاران (طلبکاران)</option>
              <option value="settled">حساب‌های تسویه‌شده (مانده صفر)</option>
            </select>

            <button
              type="button"
              onClick={() => refreshData()}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer"
              title="تازه‌سازی اطلاعات"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Accounts Table */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="p-4 font-semibold">طرف حساب (نام و نقش)</th>
                <th className="p-4 font-semibold">شماره حساب دفتری</th>
                <th className="p-4 font-semibold">وضعیت حساب</th>
                <th className="p-4 font-semibold">سقف اعتبار</th>
                <th className="p-4 font-semibold text-rose-400">جمع بدهکاری</th>
                <th className="p-4 font-semibold text-emerald-400">جمع بستانکاری</th>
                <th className="p-4 font-semibold">مانده کل حساب</th>
                <th className="p-4 font-semibold">گردش‌ها</th>
                <th className="p-4 font-semibold text-center">عملیات مالی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-bold text-sm">هیچ حساب دفتری مطابق با فیلترها یافت نشد.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isDebtor = row.currentBalance > 0;
                  const isCreditor = row.currentBalance < 0;

                  return (
                    <tr key={row.profileId} className="hover:bg-slate-800/40 transition">
                      {/* Name & Phone */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-600/15 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/20">
                            {row.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{row.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                {row.role === 'visitor' ? 'ویزیتور' : 'سوپرمارکت'}
                              </span>
                            </div>
                            <div className="text-slate-400 font-mono text-[11px] mt-0.5">{row.phone}</div>
                          </div>
                        </div>
                      </td>

                      {/* Account Number */}
                      <td className="p-4 font-mono">
                        {row.hasAccount ? (
                          <span className="text-blue-300 font-bold bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-900/60">
                            {row.accountNumber}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">تعریف نشده</span>
                        )}
                      </td>

                      {/* Active Status Badge */}
                      <td className="p-4">
                        {row.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            حساب فعال
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            غیرفعال
                          </span>
                        )}
                      </td>

                      {/* Credit Limit */}
                      <td className="p-4 font-mono text-slate-300">
                        {row.creditLimit > 0 ? `${formatPrice(row.creditLimit)} ت` : 'نامحدود'}
                      </td>

                      {/* Total Debit */}
                      <td className="p-4 font-mono font-bold text-rose-400">
                        {formatPrice(row.totalDebit)} ت
                      </td>

                      {/* Total Credit */}
                      <td className="p-4 font-mono font-bold text-emerald-400">
                        {formatPrice(row.totalCredit)} ت
                      </td>

                      {/* Balance */}
                      <td className="p-4">
                        <div className="font-mono font-bold text-sm">
                          {isDebtor ? (
                            <span className="text-rose-400">
                              {formatPrice(row.currentBalance)} ت
                              <span className="text-[10px] block text-rose-500/80 font-normal">بدهکار</span>
                            </span>
                          ) : isCreditor ? (
                            <span className="text-emerald-400">
                              {formatPrice(Math.abs(row.currentBalance))} ت
                              <span className="text-[10px] block text-emerald-500/80 font-normal">بستانکار</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              ۰ ت
                              <span className="text-[10px] block text-slate-500 font-normal">بی‌حساب</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Transactions Count */}
                      <td className="p-4 text-slate-400 text-xs">
                        <span className="font-bold text-slate-200">{row.txCount}</span> سند
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* View Ledger Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedProfileIdForLedger(row.profileId)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            <Wallet className="w-3.5 h-3.5 text-blue-400" />
                            <span>دفتر حساب</span>
                          </button>

                          {/* Toggle Active / Inactive */}
                          {!row.isActive ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActivatingProfileId(row.profileId);
                                setActivatingLimit(row.creditLimit || 50000000);
                              }}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                              title="فعال‌سازی حساب"
                            >
                              فعال‌سازی
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeactivatingAccount({ id: row.accountId, name: row.name })}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                              title="غیرفعال‌سازی حساب"
                            >
                              غیرفعال‌سازی
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Ledger Modal Drawer */}
      {selectedProfileIdForLedger && (
        <AccountLedgerModal
          isOpen={Boolean(selectedProfileIdForLedger)}
          onClose={() => setSelectedProfileIdForLedger(null)}
          profileId={selectedProfileIdForLedger}
        />
      )}

      {/* Quick Activate Modal */}
      {activatingProfileId && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
          onClick={() => setActivatingProfileId(null)}
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
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                با فعال‌سازی حساب، امکان ثبت فاکتورهای معوق و دریافت پرداخت برای این شخص فعال می‌شود.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">سقف اعتبار مجاز (تومان)</label>
                <input
                  type="number"
                  value={activatingLimit}
                  onChange={(e) => setActivatingLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActivatingProfileId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={isActivating}
                  onClick={handleQuickActivate}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50"
                >
                  {isActivating ? 'در حال فعال‌سازی...' : 'تایید و فعال‌سازی'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Deactivate Confirm Modal */}
      {deactivatingAccount && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
          onClick={() => setDeactivatingAccount(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>غیرفعال‌سازی حساب «{deactivatingAccount.name}»</span>
            </h4>
            <p className="text-xs text-slate-300">
              غیرفعال‌سازی فقط وضعیت حساب را تغییر می‌دهد و هیچ‌یک از سوابق مالی قبلی حذف نخواهد شد.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">دلیل غیرفعال‌سازی (اختیاری)</label>
              <input
                type="text"
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="دلیل غیرفعال‌سازی..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeactivatingAccount(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isDeactivating}
                onClick={handleQuickDeactivate}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer disabled:opacity-50"
              >
                {isDeactivating ? 'در حال ثبت...' : 'تایید غیرفعال‌سازی'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
