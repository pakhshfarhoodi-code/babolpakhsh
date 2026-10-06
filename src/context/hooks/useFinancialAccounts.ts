import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FinancialAccount,
  AccountTransaction,
  Cheque,
  PaymentAllocation,
  FinancialAccountSummary,
  ChequeStatus,
  ChequeDetailsInput,
  PaymentAllocationInput,
  Visitor,
  Supermarket,
  LoadingBill,
} from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId } from '../utils';

interface UseFinancialAccountsProps {
  visitors: Visitor[];
  supermarkets: Supermarket[];
  loadingBills?: LoadingBill[];
  reloadCounter?: number;
  currentUser?: { id: string; role: string; name: string };
}

export function useFinancialAccounts({
  visitors,
  supermarkets,
  loadingBills = [],
  reloadCounter = 0,
  currentUser,
}: UseFinancialAccountsProps) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEYS.FINANCIAL_ACCOUNTS);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [transactions, setTransactions] = useState<AccountTransaction[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEYS.ACCOUNT_TRANSACTIONS);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [cheques, setCheques] = useState<Cheque[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEYS.CHEQUES);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [allocations, setAllocations] = useState<PaymentAllocation[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEYS.PAYMENT_ALLOCATIONS);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);

  // Sync to local storage
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.FINANCIAL_ACCOUNTS, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.CHEQUES, JSON.stringify(cheques));
  }, [cheques]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.PAYMENT_ALLOCATIONS, JSON.stringify(allocations));
  }, [allocations]);

  // Synchronization: Connect finalized visitor invoices to account ledger debt
  // 1. Debt is created ONLY when bill is finalized ('approved' or 'loaded')
  // 2. Draft/pending bills have NO financial effect
  // 3. Amount changes on finalized bills are registered as accurate account_adjustment
  // 4. Cancelled bills have their financial effect properly reversed
  // 5. Prevents duplicate effects by tracking net recorded debt for each bill
  useEffect(() => {
    if (!loadingBills || loadingBills.length === 0 || accounts.length === 0) return;

    let modified = false;
    let nextTransactions = [...transactions];

    for (const bill of loadingBills) {
      if (!bill.visitor_id) continue;
      const acc = accounts.find((a) => a.profile_id === bill.visitor_id && a.is_active);
      if (!acc) continue;

      const isFinalized = bill.status === 'approved' || bill.status === 'loaded';
      const isCancelled = bill.status === 'cancelled';
      const billCost = Math.round(Number(bill.total_visitor_cost || 0));

      // Calculate net recorded debt for this bill
      const billTxs = nextTransactions.filter(
        (t) =>
          (t.reference_invoice_id === bill.id || t.reference_id === bill.id) &&
          ['invoice_debt', 'account_adjustment', 'refund'].includes(t.transaction_type)
      );
      const netRecorded = billTxs.reduce(
        (sum, t) => sum + (t.entry_type === 'debit' ? Number(t.amount || 0) : -Number(t.amount || 0)),
        0
      );

      if (isFinalized) {
        if (billTxs.length === 0 && billCost > 0) {
          // Initial debt creation
          const nowIso = bill.finalized_at || bill.approved_at || new Date().toISOString();
          const newTx: AccountTransaction = {
            id: generateUniqueId('tx-debt'),
            account_id: acc.id,
            profile_id: bill.visitor_id,
            transaction_type: 'invoice_debt',
            entry_type: 'debit',
            amount: billCost,
            transaction_date: nowIso,
            reference_invoice_id: bill.id,
            reference_id: bill.id,
            description: `بدهی فاکتور ${bill.invoice_no || bill.id}`,
            created_by_name: bill.finalized_by || bill.approved_by || 'سیستم فاکتور',
            created_at: nowIso,
          };
          nextTransactions = [newTx, ...nextTransactions];
          modified = true;
        } else if (billTxs.length > 0 && billCost !== netRecorded) {
          // Price adjustment
          const nowIso = new Date().toISOString();
          if (billCost > netRecorded) {
            const diff = billCost - netRecorded;
            const newTx: AccountTransaction = {
              id: generateUniqueId('tx-adj'),
              account_id: acc.id,
              profile_id: bill.visitor_id,
              transaction_type: 'account_adjustment',
              entry_type: 'debit',
              amount: diff,
              transaction_date: nowIso,
              reference_invoice_id: bill.id,
              reference_id: bill.id,
              description: `تعدیل افزایش مبلغ فاکتور ${bill.invoice_no || bill.id}`,
              created_by_name: bill.finalized_by || bill.approved_by || 'سیستم فاکتور',
              created_at: nowIso,
            };
            nextTransactions = [newTx, ...nextTransactions];
            modified = true;
          } else if (billCost < netRecorded) {
            const diff = netRecorded - billCost;
            const newTx: AccountTransaction = {
              id: generateUniqueId('tx-adj'),
              account_id: acc.id,
              profile_id: bill.visitor_id,
              transaction_type: 'account_adjustment',
              entry_type: 'credit',
              amount: diff,
              transaction_date: nowIso,
              reference_invoice_id: bill.id,
              reference_id: bill.id,
              description: `تعدیل کاهش مبلغ فاکتور ${bill.invoice_no || bill.id}`,
              created_by_name: bill.finalized_by || bill.approved_by || 'سیستم فاکتور',
              created_at: nowIso,
            };
            nextTransactions = [newTx, ...nextTransactions];
            modified = true;
          }
        }
      } else if (isCancelled) {
        if (netRecorded > 0) {
          // Reversal of debt upon invoice cancellation
          const nowIso = new Date().toISOString();
          const newTx: AccountTransaction = {
            id: generateUniqueId('tx-rev'),
            account_id: acc.id,
            profile_id: bill.visitor_id,
            transaction_type: 'account_adjustment',
            entry_type: 'credit',
            amount: netRecorded,
            transaction_date: nowIso,
            reference_invoice_id: bill.id,
            reference_id: bill.id,
            description: `برگشت اثر مالی ناشی از لغو فاکتور ${bill.invoice_no || bill.id}`,
            created_by_name: bill.cancelled_by || 'سیستم فاکتور',
            created_at: nowIso,
          };
          nextTransactions = [newTx, ...nextTransactions];
          modified = true;
        }
      }
    }

    if (modified) {
      setTransactions(nextTransactions);
    }
  }, [loadingBills, accounts]);

  // Fetch from Supabase (Strictly Admin / Superadmin Only)
  const fetchFinancialData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      setAccounts([]);
      setTransactions([]);
      setCheques([]);
      setAllocations([]);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch Accounts
      const { data: accData, error: accErr } = await supabase
        .from('financial_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (!accErr && accData) {
        setAccounts(accData as FinancialAccount[]);
      }

      // 2. Fetch Transactions
      const { data: txData, error: txErr } = await supabase
        .from('account_transactions')
        .select('*')
        .order('transaction_date', { ascending: false });
      if (!txErr && txData) {
        setTransactions(txData as AccountTransaction[]);
      }

      // 3. Fetch Cheques
      const { data: chkData, error: chkErr } = await supabase
        .from('cheques')
        .select('*')
        .order('due_date', { ascending: true });
      if (!chkErr && chkData) {
        setCheques(chkData as Cheque[]);
      }

      // 4. Fetch Allocations
      const { data: allocData, error: allocErr } = await supabase
        .from('payment_allocations')
        .select('*')
        .order('created_at', { ascending: false });
      if (!allocErr && allocData) {
        setAllocations(allocData as PaymentAllocation[]);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData, reloadCounter]);

  // RPC 1: Activate Account (Activates account and backfills prior finalized bills)
  const activateAccount = useCallback(
    async (
      profileId: string,
      creditLimit: number = 0,
      notes: string = ''
    ): Promise<{ success: boolean; message: string; account?: FinancialAccount }> => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.rpc('admin_activate_financial_account', {
            p_profile_id: profileId,
            p_credit_limit: creditLimit,
            p_notes: notes || null,
          });

          if (error) {
            return { success: false, message: error.message || 'خطا در فعال‌سازی حساب در دیتابیس' };
          }
          if (data && (data as { success?: boolean }).success === false) {
            return { success: false, message: (data as { message?: string }).message || 'خطا در فعال‌سازی' };
          }

          await fetchFinancialData();
          return { success: true, message: (data as { message?: string })?.message || 'حساب با موفقیت فعال شد.' };
        }

        // Offline / LocalStorage fallback
        const nowIso = new Date().toISOString();
        const existing = accounts.find((a) => a.profile_id === profileId);
        let updatedAccount: FinancialAccount;

        if (existing) {
          updatedAccount = {
            ...existing,
            is_active: true,
            credit_limit: creditLimit,
            notes: notes || existing.notes,
            activated_at: nowIso,
            activated_by: currentUser?.name || 'مدیر سامانه',
            updated_at: nowIso,
          };
          setAccounts((prev) => prev.map((a) => (a.id === existing.id ? updatedAccount : a)));
        } else {
          const visCode = profileId.replace(/\D/g, '') || Math.floor(1000 + Math.random() * 9000).toString();
          updatedAccount = {
            id: generateUniqueId('acc'),
            profile_id: profileId,
            account_number: `ACC-VIS-${visCode.padStart(4, '0')}`,
            is_active: true,
            credit_limit: creditLimit,
            currency: 'تومان',
            notes,
            activated_at: nowIso,
            activated_by: currentUser?.name || 'مدیر سامانه',
            created_at: nowIso,
            updated_at: nowIso,
          };
          setAccounts((prev) => [updatedAccount, ...prev]);
        }

        // Backfill prior finalized bills of this profile (approved / loaded) into debt
        const priorBills = (loadingBills || []).filter(
          (b) =>
            b.visitor_id === profileId &&
            (b.status === 'approved' || b.status === 'loaded') &&
            Number(b.total_visitor_cost || 0) > 0
        );

        let backfilledCount = 0;
        setTransactions((prev) => {
          const toAdd: AccountTransaction[] = [];
          for (const b of priorBills) {
            const alreadyExists = prev.some(
              (t) =>
                (t.reference_invoice_id === b.id || t.reference_id === b.id) &&
                t.transaction_type === 'invoice_debt'
            );
            if (!alreadyExists) {
              const cost = Math.round(Number(b.total_visitor_cost || 0));
              const txIso = b.finalized_at || b.approved_at || nowIso;
              toAdd.push({
                id: generateUniqueId('tx-debt'),
                account_id: updatedAccount.id,
                profile_id: profileId,
                transaction_type: 'invoice_debt',
                entry_type: 'debit',
                amount: cost,
                transaction_date: txIso,
                reference_invoice_id: b.id,
                reference_id: b.id,
                description: `بدهی فاکتور ${b.invoice_no || b.id}`,
                created_by_name: b.finalized_by || b.approved_by || currentUser?.name || 'مدیر سامانه',
                created_at: nowIso,
              });
              backfilledCount++;
            }
          }
          return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
        });

        const successMsg =
          backfilledCount > 0
            ? `حساب دفتری کاربر فعال شد و ${backfilledCount} فاکتور قبلی به عنوان بدهی ثبت گردید.`
            : 'حساب دفتری کاربر با موفقیت فعال گردید.';

        return { success: true, message: successMsg, account: updatedAccount };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در فعال‌سازی حساب';
        return { success: false, message: msg };
      }
    },
    [accounts, currentUser, fetchFinancialData, loadingBills]
  );

  // RPC 2: Deactivate Account (Does NOT delete any history)
  const deactivateAccount = useCallback(
    async (accountId: string, reason: string = ''): Promise<{ success: boolean; message: string }> => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.rpc('admin_deactivate_financial_account', {
            p_account_id: accountId,
            p_reason: reason || null,
          });

          if (error) {
            return { success: false, message: error.message || 'خطا در غیرفعال‌سازی حساب' };
          }
          if (data && (data as { success?: boolean }).success === false) {
            return { success: false, message: (data as { message?: string }).message || 'خطا در غیرفعال‌سازی' };
          }

          await fetchFinancialData();
          return { success: true, message: (data as { message?: string })?.message || 'حساب با موفقیت غیرفعال شد.' };
        }

        // LocalStorage fallback
        const nowIso = new Date().toISOString();
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === accountId
              ? {
                  ...a,
                  is_active: false,
                  deactivated_at: nowIso,
                  deactivated_by: currentUser?.name || 'مدیر سامانه',
                  notes: reason ? `${a.notes ? a.notes + '\n' : ''}دلیل غیرفعال‌سازی: ${reason}` : a.notes,
                  updated_at: nowIso,
                }
              : a
          )
        );
        return { success: true, message: 'حساب با حفظ کلیه سوابق قبلی با موفقیت غیرفعال شد.' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در غیرفعال‌سازی حساب';
        return { success: false, message: msg };
      }
    },
    [currentUser, fetchFinancialData]
  );

  // RPC 3: Record Payment (Cash, Bank, Cheque with multi-invoice allocations)
  const recordPayment = useCallback(
    async (payload: {
      profileId: string;
      paymentType: 'cash_payment' | 'bank_transfer' | 'cheque_payment';
      amount: number;
      referenceId?: string;
      description?: string;
      chequeDetails?: ChequeDetailsInput;
      allocations?: PaymentAllocationInput[];
    }): Promise<{ success: boolean; message: string }> => {
      if (payload.amount <= 0) {
        return { success: false, message: 'مبلغ پرداختی باید بزرگتر از صفر باشد.' };
      }

      // Check account active state
      const acc = accounts.find((a) => a.profile_id === payload.profileId);
      if (!acc || !acc.is_active) {
        return { success: false, message: 'حساب دفتری این کاربر فعال نیست. امکان ثبت تراکنش برای حساب غیرفعال وجود ندارد.' };
      }

      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.rpc('admin_record_payment', {
            p_profile_id: payload.profileId,
            p_payment_type: payload.paymentType,
            p_amount: payload.amount,
            p_reference_id: payload.referenceId || null,
            p_description: payload.description || null,
            p_cheque_details: payload.chequeDetails ? payload.chequeDetails : null,
            p_allocations: payload.allocations && payload.allocations.length > 0 ? payload.allocations : null,
          });

          if (error) {
            return { success: false, message: error.message || 'خطا در ثبت پرداخت در دیتابیس' };
          }
          if (data && (data as { success?: boolean }).success === false) {
            return { success: false, message: (data as { message?: string }).message || 'خطا در ثبت پرداخت' };
          }

          await fetchFinancialData();
          return { success: true, message: (data as { message?: string })?.message || 'پرداخت با موفقیت ثبت شد.' };
        }

        // LocalStorage fallback
        const nowIso = new Date().toISOString();
        const txId = generateUniqueId('tx-fin');

        const newTx: AccountTransaction = {
          id: txId,
          account_id: acc.id,
          profile_id: payload.profileId,
          transaction_type: payload.paymentType,
          entry_type: 'credit',
          amount: payload.amount,
          transaction_date: nowIso,
          reference_id: payload.referenceId || null,
          description: payload.description || 'ثبت پرداخت مالی',
          created_by: currentUser?.id || 'admin',
          created_by_name: currentUser?.name || 'مدیر سامانه',
          created_at: nowIso,
        };
        setTransactions((prev) => [newTx, ...prev]);

        if (payload.paymentType === 'cheque_payment' && payload.chequeDetails) {
          const newCheque: Cheque = {
            id: generateUniqueId('chk'),
            account_id: acc.id,
            profile_id: payload.profileId,
            transaction_id: txId,
            amount: payload.amount,
            cheque_number: payload.chequeDetails.cheque_number,
            sayad_number: payload.chequeDetails.sayad_number || null,
            bank_name: payload.chequeDetails.bank_name,
            branch_name: payload.chequeDetails.branch_name || null,
            account_owner: payload.chequeDetails.account_owner,
            issue_date: payload.chequeDetails.issue_date || nowIso.slice(0, 10),
            due_date: payload.chequeDetails.due_date,
            status: 'pending',
            description: payload.chequeDetails.description || null,
            created_by: currentUser?.id || 'admin',
            created_at: nowIso,
            updated_at: nowIso,
          };
          setCheques((prev) => [newCheque, ...prev]);
        }

        if (payload.allocations && payload.allocations.length > 0) {
          const newAllocs: PaymentAllocation[] = payload.allocations.map((al) => ({
            id: generateUniqueId('alloc'),
            transaction_id: txId,
            invoice_type: 'loading_bill',
            invoice_id: al.invoice_id,
            allocated_amount: al.amount,
            created_by: currentUser?.id || 'admin',
            created_at: nowIso,
          }));
          setAllocations((prev) => [...newAllocs, ...prev]);
        }

        return { success: true, message: 'پرداخت با موفقیت ثبت شد.' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت پرداخت';
        return { success: false, message: msg };
      }
    },
    [accounts, currentUser, fetchFinancialData]
  );

  // RPC 4: Update Cheque Status (pending, cleared, returned, cancelled)
  const updateChequeStatus = useCallback(
    async (
      chequeId: string,
      newStatus: ChequeStatus,
      reason: string = ''
    ): Promise<{ success: boolean; message: string }> => {
      const chk = cheques.find((c) => c.id === chequeId);
      if (!chk) {
        return { success: false, message: 'چک مورد نظر یافت نشد.' };
      }

      if (chk.status === newStatus) {
        return { success: false, message: 'چک در حال حاضر در همین وضعیت قرار دارد.' };
      }

      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.rpc('admin_update_cheque_status', {
            p_cheque_id: chequeId,
            p_status: newStatus,
            p_reason: reason || null,
          });

          if (error) {
            return { success: false, message: error.message || 'خطا در تغییر وضعیت چک' };
          }
          if (data && (data as { success?: boolean }).success === false) {
            return { success: false, message: (data as { message?: string }).message || 'خطا در تغییر وضعیت چک' };
          }

          await fetchFinancialData();
          return { success: true, message: (data as { message?: string })?.message || 'وضعیت چک با موفقیت به‌روزرسانی شد.' };
        }

        // Local fallback
        const nowIso = new Date().toISOString();
        setCheques((prev) =>
          prev.map((c) =>
            c.id === chequeId
              ? {
                  ...c,
                  status: newStatus,
                  cleared_at: newStatus === 'cleared' ? nowIso : c.cleared_at,
                  returned_at: newStatus === 'returned' ? nowIso : c.returned_at,
                  return_reason: newStatus === 'returned' ? reason : c.return_reason,
                  updated_at: nowIso,
                }
              : c
          )
        );

        if (newStatus === 'returned') {
          // Re-debt to account (cheque bounce)
          const newTx: AccountTransaction = {
            id: generateUniqueId('tx-chk-ret'),
            account_id: chk.account_id,
            profile_id: chk.profile_id,
            transaction_type: 'cheque_return',
            entry_type: 'debit',
            amount: chk.amount,
            reference_id: chk.cheque_number,
            description: `برگشت چک شماره ${chk.cheque_number}${reason ? ` - دلیل: ${reason}` : ''}`,
            created_by: currentUser?.id || 'admin',
            created_by_name: currentUser?.name || 'مدیر سامانه',
            transaction_date: nowIso,
            created_at: nowIso,
          };
          setTransactions((prev) => [newTx, ...prev]);
        } else if (newStatus === 'cancelled') {
          const newTx: AccountTransaction = {
            id: generateUniqueId('tx-chk-canc'),
            account_id: chk.account_id,
            profile_id: chk.profile_id,
            transaction_type: 'account_adjustment',
            entry_type: 'debit',
            amount: chk.amount,
            reference_id: chk.cheque_number,
            description: `ابطال چک شماره ${chk.cheque_number}${reason ? ` - دلیل: ${reason}` : ''}`,
            created_by: currentUser?.id || 'admin',
            created_by_name: currentUser?.name || 'مدیر سامانه',
            transaction_date: nowIso,
            created_at: nowIso,
          };
          setTransactions((prev) => [newTx, ...prev]);
        }

        return { success: true, message: 'وضعیت چک با موفقیت به‌روزرسانی شد.' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در تغییر وضعیت چک';
        return { success: false, message: msg };
      }
    },
    [cheques, currentUser, fetchFinancialData]
  );

  // RPC 5: Manual Financial Entry (Manual Debit, Manual Credit, Opening Balance, Adjustment)
  const manualFinancialEntry = useCallback(
    async (payload: {
      profileId: string;
      type: 'manual_debit' | 'manual_credit' | 'opening_balance' | 'refund' | 'account_adjustment';
      amount: number;
      description: string;
      referenceId?: string;
      entryType?: 'debit' | 'credit';
    }): Promise<{ success: boolean; message: string }> => {
      if (payload.amount <= 0) {
        return { success: false, message: 'مبلغ تراکنش باید بزرگتر از صفر باشد.' };
      }

      const acc = accounts.find((a) => a.profile_id === payload.profileId);
      if (!acc || !acc.is_active) {
        return { success: false, message: 'حساب دفتری این کاربر فعال نیست. امکان ثبت تراکنش برای حساب غیرفعال وجود ندارد.' };
      }

      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.rpc('admin_manual_financial_entry', {
            p_profile_id: payload.profileId,
            p_type: payload.type,
            p_amount: payload.amount,
            p_description: payload.description,
            p_reference_id: payload.referenceId || null,
            p_entry_type: payload.entryType || null,
          });

          if (error) {
            return { success: false, message: error.message || 'خطا در ثبت تراکنش دستی' };
          }
          if (data && (data as { success?: boolean }).success === false) {
            return { success: false, message: (data as { message?: string }).message || 'خطا در ثبت تراکنش دستی' };
          }

          await fetchFinancialData();
          return { success: true, message: (data as { message?: string })?.message || 'تراکنش با موفقیت ثبت شد.' };
        }

        // Local fallback
        const nowIso = new Date().toISOString();
        let determinedEntryType: 'debit' | 'credit';
        if (payload.type === 'manual_debit' || payload.type === 'refund') {
          determinedEntryType = 'debit';
        } else if (payload.type === 'manual_credit') {
          determinedEntryType = 'credit';
        } else if (payload.type === 'account_adjustment') {
          determinedEntryType = payload.entryType || 'credit';
        } else if (payload.type === 'opening_balance') {
          determinedEntryType = payload.entryType || 'debit';
        } else {
          determinedEntryType = payload.entryType || 'debit';
        }

        const newTx: AccountTransaction = {
          id: generateUniqueId('tx-manual'),
          account_id: acc.id,
          profile_id: payload.profileId,
          transaction_type: payload.type,
          entry_type: determinedEntryType,
          amount: payload.amount,
          transaction_date: nowIso,
          reference_id: payload.referenceId || null,
          description: payload.description,
          created_by: currentUser?.id || 'admin',
          created_by_name: currentUser?.name || 'مدیر سامانه',
          created_at: nowIso,
        };
        setTransactions((prev) => [newTx, ...prev]);

        return { success: true, message: 'تراکنش با موفقیت در دفتر حساب ثبت شد.' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت تراکنش دستی';
        return { success: false, message: msg };
      }
    },
    [accounts, currentUser, fetchFinancialData]
  );

  // Helper 1: Calculate account summary for any profile dynamically
  const getAccountSummary = useCallback(
    (profileId: string): FinancialAccountSummary | null => {
      const acc = accounts.find((a) => a.profile_id === profileId);
      const visitor = visitors.find((v) => v.id === profileId);
      const supermarket = supermarkets.find((s) => s.id === profileId);

      const name = visitor?.name || supermarket?.name || 'کاربر سیستم';
      const role = visitor ? 'visitor' : supermarket ? 'supermarket' : 'کاربر';
      const phone = visitor?.phone || supermarket?.phone || '';

      const accTx = transactions.filter((t) => (acc ? t.account_id === acc.id : t.profile_id === profileId));
      const totalDebit = accTx.filter((t) => t.entry_type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0);
      const totalCredit = accTx.filter((t) => t.entry_type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0);
      const currentBalance = totalDebit - totalCredit;

      return {
        account_id: acc?.id || '',
        profile_id: profileId,
        profile_name: name,
        profile_role: role,
        profile_phone: phone,
        account_number: acc?.account_number || 'فاقد حساب',
        is_active: acc?.is_active || false,
        credit_limit: acc?.credit_limit || 0,
        total_debit: totalDebit,
        total_credit: totalCredit,
        current_balance: currentBalance,
        transactions_count: accTx.length,
        last_transaction_at: accTx[0]?.transaction_date || null,
      };
    },
    [accounts, visitors, supermarkets, transactions]
  );

  // Helper 2: Calculate payment settlement status for a specific invoice
  const getInvoiceSettlementStatus = useCallback(
    (invoiceId: string, invoiceTotal: number) => {
      const invAllocs = allocations.filter((al) => al.invoice_id === invoiceId);
      const totalPaid = invAllocs.reduce((sum, al) => sum + Number(al.allocated_amount || 0), 0);
      const remainingDue = Math.max(0, invoiceTotal - totalPaid);
      const status: 'settled' | 'partially_paid' | 'unpaid' =
        remainingDue <= 0 && invoiceTotal > 0 ? 'settled' : totalPaid > 0 ? 'partially_paid' : 'unpaid';

      return {
        totalPaid,
        remainingDue,
        status,
        allocationsCount: invAllocs.length,
      };
    },
    [allocations]
  );

  return {
    accounts,
    transactions,
    cheques,
    allocations,
    isLoading,
    fetchFinancialData,
    activateAccount,
    deactivateAccount,
    recordPayment,
    updateChequeStatus,
    manualFinancialEntry,
    getAccountSummary,
    getInvoiceSettlementStatus,
  };
}
